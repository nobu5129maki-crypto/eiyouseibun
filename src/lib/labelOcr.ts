import { createWorker, type Worker } from 'tesseract.js';
import type { NutrientValues } from '../types';
import { parseNutritionText } from './parseNutritionText';

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

/** コントラスト強調して OCR 精度を上げる */
async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1.8, maxSide / Math.max(bitmap.width, bitmap.height));
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
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // コントラスト強調 + 軽い二値化寄り
    const boosted = gray < 140 ? gray * 0.75 : Math.min(255, gray * 1.25);
    const v = boosted > 165 ? 255 : boosted < 110 ? 0 : boosted;
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

/**
 * 栄養成分表示画像を OCR し、PFC・食塩などを抽出する。
 */
export async function parseNutritionLabelImage(file: File): Promise<LabelOcrResult> {
  const processed = await preprocessImage(file);
  const worker = await getWorker();
  const { data } = await worker.recognize(processed);
  const rawText = data.text || '';
  const parsed = parseNutritionText(rawText);

  const hasCore =
    (parsed.nutrients.protein_g ?? 0) > 0 ||
    (parsed.nutrients.fat_g ?? 0) > 0 ||
    (parsed.nutrients.carb_g ?? 0) > 0 ||
    (parsed.nutrients.energy_kcal ?? 0) > 0;

  if (!hasCore) {
    throw new Error(
      '栄養成分の数値を読み取れませんでした。文字がはっきり写るように再度撮影してください。',
    );
  }

  const ocrConf = Number.isFinite(data.confidence) ? data.confidence / 100 : 0.5;
  const confidence = Math.min(0.96, Math.max(0.4, (parsed.confidence + ocrConf) / 2));

  return {
    productName: '栄養成分表示（読取）',
    servingLabel: parsed.servingLabel,
    nutrients: parsed.nutrients,
    rawText,
    confidence,
  };
}
