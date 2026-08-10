import type { NutrientValues } from '../types';

export type LabelOcrResult = {
  productName: string;
  servingLabel: string;
  nutrients: NutrientValues;
  rawText: string;
  confidence: number;
};

const SAMPLES: LabelOcrResult[] = [
  {
    productName: 'カップ麺（ラベル読取）',
    servingLabel: '1食（78g）あたり',
    nutrients: {
      energy_kcal: 358,
      protein_g: 8.2,
      fat_g: 14.5,
      carb_g: 49.8,
      salt_g: 5.2,
      fiber_g: 2.1,
    },
    rawText:
      '栄養成分表示（1食あたり）\nエネルギー 358kcal\nたんぱく質 8.2g\n脂質 14.5g\n炭水化物 49.8g\n食塩相当量 5.2g',
    confidence: 0.86,
  },
  {
    productName: 'ヨーグルト（ラベル読取）',
    servingLabel: '1個（100g）あたり',
    nutrients: {
      energy_kcal: 67,
      protein_g: 4.3,
      fat_g: 3.0,
      carb_g: 5.2,
      salt_g: 0.1,
      calcium_mg: 120,
      vitamin_c_mg: 0,
      fiber_g: 0,
    },
    rawText:
      '栄養成分表示（100gあたり）\nエネルギー 67kcal\nたんぱく質 4.3g\n脂質 3.0g\n炭水化物 5.2g\n食塩相当量 0.1g\nカルシウム 120mg',
    confidence: 0.91,
  },
  {
    productName: 'サラダチキン（ラベル読取）',
    servingLabel: '1パック（100g）あたり',
    nutrients: {
      energy_kcal: 113,
      protein_g: 23.0,
      fat_g: 1.5,
      carb_g: 1.2,
      salt_g: 1.8,
      iron_mg: 0.4,
    },
    rawText:
      '栄養成分表示（100gあたり）\nエネルギー 113kcal\nたんぱく質 23.0g\n脂質 1.5g\n炭水化物 1.2g\n食塩相当量 1.8g',
    confidence: 0.88,
  },
];

/**
 * 栄養成分表示画像の OCR（MVP: 実APIの代わりにサンプル解析）。
 * 本番では Cloud Vision 等へ差し替え。
 */
export async function parseNutritionLabelImage(
  _file: File,
): Promise<LabelOcrResult> {
  await delay(900);
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
