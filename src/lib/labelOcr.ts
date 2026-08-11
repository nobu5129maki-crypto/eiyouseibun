import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { NutrientValues } from '../types';
import {
  mergeParsedResults,
  parseNutritionText,
  type ParsedNutrition,
} from './parseNutritionText';

export type LabelOcrResult = {
  productName: string;
  servingLabel: string;
  nutrients: NutrientValues;
  rawText: string;
  confidence: number;
};

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('jpn+eng', 1, {
        logger: () => undefined,
      });
      return worker;
    })();
  }
  return workerPromise;
}

type PreprocessMode = 'contrast' | 'soft' | 'sharp';

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

async function preprocessImage(file: Blob, mode: PreprocessMode): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const maxSide = 2200;
  // 小数点を残すため過度な拡大・二値化は避ける
  const upscale = mode === 'sharp' ? 2.4 : mode === 'soft' ? 2.0 : 1.9;
  const scale = Math.min(upscale, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const mean = sum / (data.length / 4);

  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    if (mode === 'sharp') {
      gray = (gray - mean) * 1.35 + mean;
    } else if (mode === 'contrast') {
      gray = (gray - mean) * 1.2 + mean;
    } else {
      // soft: 小数点などの細い点を残す
      gray = (gray - mean) * 1.1 + mean;
    }

    // 完全二値化はしない（小数点が消えやすい）
    const v = Math.max(0, Math.min(255, gray));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 1),
  );
  return blob ?? file;
}

async function recognizeOne(
  worker: Worker,
  blob: Blob,
  psm: typeof PSM.SINGLE_BLOCK | typeof PSM.SINGLE_COLUMN,
): Promise<{ text: string; confidence: number; parsed: ParsedNutrition }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
  });
  const { data } = await worker.recognize(blob);
  const text = data.text || '';
  const parsed = parseNutritionText(text);
  const ocrConf = Number.isFinite(data.confidence) ? data.confidence / 100 : 0.4;
  return {
    text,
    confidence: ocrConf,
    parsed: {
      ...parsed,
      confidence: Math.min(0.98, (parsed.confidence + ocrConf) / 2),
    },
  };
}

function coreHitCount(parsed: ParsedNutrition): number {
  const n = parsed.nutrients;
  return [
    n.energy_kcal,
    n.protein_g,
    n.fat_g,
    n.carb_g,
    n.salt_g,
  ].filter((v) => (v ?? 0) > 0).length;
}

/**
 * 栄養成分表示画像を複数前処理×OCRし、最も妥当な結果を返す。
 */
export async function parseNutritionLabelImage(file: File): Promise<LabelOcrResult> {
  // テスト用フック
  const testResult = (window as unknown as { __TEST_OCR_RESULT__?: LabelOcrResult })
    .__TEST_OCR_RESULT__;
  if (testResult) return testResult;

  const worker = await getWorker();
  const modes: PreprocessMode[] = ['soft', 'contrast', 'sharp'];
  const passes: Awaited<ReturnType<typeof recognizeOne>>[] = [];

  // 原画像も1回（小数点保持に有利）
  passes.push(await recognizeOne(worker, file, PSM.SINGLE_BLOCK));

  for (const mode of modes) {
    const processed = await preprocessImage(file, mode);
    passes.push(await recognizeOne(worker, processed, PSM.SINGLE_BLOCK));
    if (mode === 'soft' || mode === 'contrast') {
      passes.push(await recognizeOne(worker, processed, PSM.SINGLE_COLUMN));
    }
  }

  const parsedList = passes.map((p) => p.parsed);
  const merged = mergeParsedResults(parsedList);

  // マージより単一パスの方が明らかに良い場合はそちらを採用
  const bestSingle = [...passes].sort((a, b) => {
    const diff = coreHitCount(b.parsed) - coreHitCount(a.parsed);
    if (diff !== 0) return diff;
    return b.parsed.confidence - a.parsed.confidence;
  })[0];

  const chosen =
    coreHitCount(merged) > coreHitCount(bestSingle.parsed)
      ? merged
      : coreHitCount(merged) === coreHitCount(bestSingle.parsed) &&
          merged.confidence >= bestSingle.parsed.confidence
        ? merged
        : bestSingle.parsed;

  const rawText = passes
    .map((p) => p.text.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || '';

  const hits = coreHitCount(chosen);
  if (hits === 0 && !rawText.trim()) {
    throw new Error(
      '文字を読み取れませんでした。ラベル全体が明るく、文字がボケないように再撮影してください。',
    );
  }

  // 数値が足りなくても結果画面へ進める（以前は throw して数値が一切出なかった）
  const weak = hits < 2;
  const noteExtra = weak
    ? '数値の読み取りが不十分です。下の欄を手で直すか、再撮影してください。'
    : '';

  return {
    productName: weak ? '栄養成分表示（読取・要確認）' : '栄養成分表示（読取）',
    servingLabel: [chosen.servingLabel, noteExtra].filter(Boolean).join(' / '),
    nutrients: chosen.nutrients,
    rawText,
    confidence: weak ? Math.min(chosen.confidence, 0.45) : chosen.confidence,
  };
}
