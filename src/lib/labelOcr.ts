import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { NutrientValues } from '../types';
import {
  mergeParsedResults,
  parseNutritionText,
  scoreParsedNutrition,
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
      await worker.setParameters({
        user_defined_dpi: '300',
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
  }
  return workerPromise;
}

type PreprocessMode = 'soft' | 'contrast' | 'sharp' | 'adaptive' | 'invert';

type PsmMode =
  | typeof PSM.SINGLE_BLOCK
  | typeof PSM.SINGLE_COLUMN
  | typeof PSM.AUTO
  | typeof PSM.SPARSE_TEXT;

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

/** 文字が多い帯を優先してクロップ（余白・パッケージ写真のノイズを減らす） */
function cropTextBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const rowScore = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    let edges = 0;
    let prev = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (x > 0 && Math.abs(g - prev) > 28) edges += 1;
      prev = g;
    }
    rowScore[y] = edges;
  }

  let bestStart = 0;
  let bestEnd = height - 1;
  let bestSum = -1;
  const win = Math.max(40, Math.floor(height * 0.35));
  let sum = 0;
  for (let y = 0; y < height; y++) {
    sum += rowScore[y];
    if (y >= win) sum -= rowScore[y - win];
    if (y >= win - 1 && sum > bestSum) {
      bestSum = sum;
      bestEnd = y;
      bestStart = y - win + 1;
    }
  }

  const pad = Math.floor(win * 0.15);
  const y0 = Math.max(0, bestStart - pad);
  const y1 = Math.min(height - 1, bestEnd + pad);
  const xPad = Math.floor(width * 0.03);
  return { x: xPad, y: y0, w: Math.max(1, width - xPad * 2), h: Math.max(1, y1 - y0 + 1) };
}

async function preprocessImage(file: Blob, mode: PreprocessMode): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const maxSide = 2600;
  const upscale =
    mode === 'sharp' ? 2.6 : mode === 'adaptive' ? 2.3 : mode === 'invert' ? 2.1 : 2.2;
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

  const band = cropTextBand(ctx, width, height);
  const cropped = ctx.getImageData(band.x, band.y, band.w, band.h);
  canvas.width = band.w;
  canvas.height = band.h;
  ctx.putImageData(cropped, 0, 0);

  const image = ctx.getImageData(0, 0, band.w, band.h);
  const data = image.data;
  const w = band.w;
  const h = band.h;

  let sum = 0;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    sum += g;
  }
  const mean = sum / gray.length;

  // 簡易シャープ（細字・小数点のコントラストを上げる）
  const sharpened = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        sharpened[i] = gray[i];
        continue;
      }
      const lap =
        gray[i] * 5 -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - w] -
        gray[i + w];
      sharpened[i] = gray[i] * 0.65 + lap * 0.35;
    }
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let g = sharpened[p];

    if (mode === 'sharp') {
      g = (g - mean) * 1.45 + mean;
    } else if (mode === 'contrast') {
      g = (g - mean) * 1.3 + mean;
    } else if (mode === 'adaptive') {
      // 局所平均との差で強調（完全二値化はしない）
      const x = p % w;
      const y = (p / w) | 0;
      let local = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          local += gray[yy * w + xx];
          count += 1;
        }
      }
      const lm = local / count;
      g = g > lm - 8 ? 245 : Math.max(0, g * 0.85);
      g = (g - mean) * 1.15 + mean;
    } else if (mode === 'invert') {
      g = 255 - g;
      g = (g - (255 - mean)) * 1.25 + (255 - mean);
    } else {
      g = (g - mean) * 1.15 + mean;
    }

    const v = Math.max(0, Math.min(255, g));
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
  psm: PsmMode,
): Promise<{ text: string; confidence: number; parsed: ParsedNutrition }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
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
      confidence: Math.min(0.99, parsed.confidence * 0.65 + ocrConf * 0.35),
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
  const testResult = (window as unknown as { __TEST_OCR_RESULT__?: LabelOcrResult })
    .__TEST_OCR_RESULT__;
  if (testResult) return testResult;

  const worker = await getWorker();
  const passes: Awaited<ReturnType<typeof recognizeOne>>[] = [];

  // 原画像（小数点保持に有利）
  passes.push(await recognizeOne(worker, file, PSM.AUTO));
  passes.push(await recognizeOne(worker, file, PSM.SINGLE_BLOCK));

  const modes: PreprocessMode[] = ['adaptive', 'soft', 'contrast', 'sharp', 'invert'];
  for (const mode of modes) {
    const processed = await preprocessImage(file, mode);
    passes.push(await recognizeOne(worker, processed, PSM.SINGLE_BLOCK));
    passes.push(await recognizeOne(worker, processed, PSM.SINGLE_COLUMN));
    if (mode === 'adaptive' || mode === 'soft') {
      passes.push(await recognizeOne(worker, processed, PSM.SPARSE_TEXT));
      passes.push(await recognizeOne(worker, processed, PSM.AUTO));
    }
  }

  const parsedList = passes.map((p) => p.parsed);
  const merged = mergeParsedResults(parsedList);

  const bestSingle = [...passes]
    .map((p) => p.parsed)
    .sort((a, b) => scoreParsedNutrition(b) - scoreParsedNutrition(a))[0];

  const chosen =
    scoreParsedNutrition(merged) >= scoreParsedNutrition(bestSingle)
      ? merged
      : bestSingle;

  const rawText =
    passes
      .map((p) => p.text.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || '';

  const hits = coreHitCount(chosen);
  if (hits === 0 && !rawText.trim()) {
    throw new Error(
      '文字を読み取れませんでした。ラベル全体が明るく、文字がボケないように再撮影してください。',
    );
  }

  const weak = hits < 2;
  const noteExtra = weak
    ? '数値の読み取りが不十分です。下の欄を手で直すか、再撮影してください。'
    : '';

  return {
    productName: weak ? '栄養成分表示（読取・要確認）' : '栄養成分表示（読取）',
    servingLabel: [chosen.servingLabel, noteExtra].filter(Boolean).join(' / '),
    nutrients: chosen.nutrients,
    rawText: '', // UIには出さない（内部検証用にも保持しない）
    confidence: weak ? Math.min(chosen.confidence, 0.5) : chosen.confidence,
  };
}
