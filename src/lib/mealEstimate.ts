import type { NutrientValues } from '../types';

export type MealEstimate = {
  displayName: string;
  nutrients: NutrientValues;
  confidence: number;
  matchedKeywords: string[];
  note: string;
};

type FoodPattern = {
  keywords: string[];
  name: string;
  nutrients: NutrientValues;
  weight: number;
};

/** よくある食事のキーワード辞書（1食あたりの概算） */
const FOOD_PATTERNS: FoodPattern[] = [
  {
    keywords: ['親子丼', 'おやこどん'],
    name: '親子丼',
    nutrients: {
      energy_kcal: 720,
      protein_g: 32,
      fat_g: 22,
      carb_g: 95,
      salt_g: 3.8,
      fiber_g: 2.5,
      iron_mg: 2.1,
      vitamin_c_mg: 4,
      calcium_mg: 40,
    },
    weight: 3,
  },
  {
    keywords: ['牛丼', 'ぎゅうどん'],
    name: '牛丼',
    nutrients: {
      energy_kcal: 680,
      protein_g: 28,
      fat_g: 24,
      carb_g: 90,
      salt_g: 3.5,
      fiber_g: 2,
      iron_mg: 3.2,
      calcium_mg: 30,
      vitamin_c_mg: 2,
    },
    weight: 3,
  },
  {
    keywords: ['ラーメン', 'らーめん', '拉麺'],
    name: 'ラーメン',
    nutrients: {
      energy_kcal: 650,
      protein_g: 24,
      fat_g: 28,
      carb_g: 78,
      salt_g: 6.5,
      fiber_g: 3,
      vitamin_c_mg: 2,
      calcium_mg: 50,
      iron_mg: 1.5,
    },
    weight: 3,
  },
  {
    keywords: ['うどん'],
    name: 'うどん',
    nutrients: {
      energy_kcal: 420,
      protein_g: 14,
      fat_g: 6,
      carb_g: 78,
      salt_g: 4.2,
      fiber_g: 2.5,
      calcium_mg: 35,
      iron_mg: 1.2,
      vitamin_c_mg: 1,
    },
    weight: 2,
  },
  {
    keywords: ['そば', '蕎麦'],
    name: 'そば',
    nutrients: {
      energy_kcal: 400,
      protein_g: 16,
      fat_g: 5,
      carb_g: 72,
      salt_g: 3.8,
      fiber_g: 4,
      iron_mg: 2.4,
      calcium_mg: 40,
      vitamin_c_mg: 1,
    },
    weight: 2,
  },
  {
    keywords: ['カレー', 'かれー'],
    name: 'カレーライス',
    nutrients: {
      energy_kcal: 750,
      protein_g: 22,
      fat_g: 26,
      carb_g: 108,
      salt_g: 3.6,
      fiber_g: 5,
      vitamin_c_mg: 12,
      iron_mg: 2.5,
      calcium_mg: 55,
    },
    weight: 3,
  },
  {
    keywords: ['サラダチキン', 'ささみ'],
    name: 'サラダチキン',
    nutrients: {
      energy_kcal: 120,
      protein_g: 25,
      fat_g: 1.5,
      carb_g: 1,
      salt_g: 1.6,
      fiber_g: 0,
      iron_mg: 0.5,
      calcium_mg: 10,
      vitamin_c_mg: 0,
    },
    weight: 3,
  },
  {
    keywords: ['鶏胸', 'むね肉', 'チキン'],
    name: '鶏肉料理',
    nutrients: {
      energy_kcal: 280,
      protein_g: 35,
      fat_g: 8,
      carb_g: 10,
      salt_g: 1.8,
      fiber_g: 0.5,
      iron_mg: 0.8,
      calcium_mg: 15,
      vitamin_c_mg: 2,
    },
    weight: 2,
  },
  {
    keywords: ['卵', 'たまご', '玉子'],
    name: '卵料理',
    nutrients: {
      energy_kcal: 150,
      protein_g: 12,
      fat_g: 10,
      carb_g: 1,
      salt_g: 0.4,
      fiber_g: 0,
      iron_mg: 1.8,
      calcium_mg: 50,
      vitamin_c_mg: 0,
    },
    weight: 2,
  },
  {
    keywords: ['ヨーグルト'],
    name: 'ヨーグルト',
    nutrients: {
      energy_kcal: 70,
      protein_g: 4.5,
      fat_g: 3,
      carb_g: 5.5,
      salt_g: 0.1,
      fiber_g: 0,
      calcium_mg: 120,
      vitamin_c_mg: 0,
      iron_mg: 0.1,
    },
    weight: 2,
  },
  {
    keywords: ['納豆'],
    name: '納豆',
    nutrients: {
      energy_kcal: 100,
      protein_g: 8,
      fat_g: 5,
      carb_g: 6,
      salt_g: 0.9,
      fiber_g: 3.3,
      iron_mg: 1.5,
      calcium_mg: 45,
      vitamin_c_mg: 0,
    },
    weight: 2,
  },
  {
    keywords: ['サラダ', '野菜'],
    name: 'サラダ',
    nutrients: {
      energy_kcal: 120,
      protein_g: 3,
      fat_g: 6,
      carb_g: 12,
      salt_g: 0.8,
      fiber_g: 4,
      vitamin_c_mg: 40,
      calcium_mg: 40,
      iron_mg: 1,
    },
    weight: 2,
  },
  {
    keywords: ['ご飯', 'ごはん', '白米', 'ライス'],
    name: 'ご飯（茶碗1杯）',
    nutrients: {
      energy_kcal: 250,
      protein_g: 4,
      fat_g: 0.5,
      carb_g: 55,
      salt_g: 0,
      fiber_g: 0.5,
      calcium_mg: 5,
      iron_mg: 0.2,
      vitamin_c_mg: 0,
    },
    weight: 1,
  },
  {
    keywords: ['パン', 'トースト', '食パン'],
    name: 'パン',
    nutrients: {
      energy_kcal: 260,
      protein_g: 8,
      fat_g: 4,
      carb_g: 48,
      salt_g: 1.1,
      fiber_g: 2,
      calcium_mg: 30,
      iron_mg: 0.8,
      vitamin_c_mg: 0,
    },
    weight: 2,
  },
  {
    keywords: ['魚', '焼き魚', 'さば', '鮭', 'サーモン'],
    name: '魚料理',
    nutrients: {
      energy_kcal: 250,
      protein_g: 28,
      fat_g: 14,
      carb_g: 1,
      salt_g: 1.5,
      fiber_g: 0,
      iron_mg: 1.2,
      calcium_mg: 40,
      vitamin_c_mg: 1,
    },
    weight: 2,
  },
  {
    keywords: ['豆腐', '味噌汁', 'みそ汁'],
    name: '豆腐・味噌汁',
    nutrients: {
      energy_kcal: 80,
      protein_g: 6,
      fat_g: 3,
      carb_g: 6,
      salt_g: 1.5,
      fiber_g: 1.5,
      calcium_mg: 60,
      iron_mg: 1,
      vitamin_c_mg: 2,
    },
    weight: 1,
  },
  {
    keywords: ['弁当', '定食'],
    name: '弁当・定食',
    nutrients: {
      energy_kcal: 700,
      protein_g: 28,
      fat_g: 22,
      carb_g: 95,
      salt_g: 3.5,
      fiber_g: 6,
      vitamin_c_mg: 20,
      calcium_mg: 80,
      iron_mg: 2.5,
    },
    weight: 2,
  },
  {
    keywords: ['ハンバーガー', 'バーガー'],
    name: 'ハンバーガー',
    nutrients: {
      energy_kcal: 550,
      protein_g: 25,
      fat_g: 28,
      carb_g: 48,
      salt_g: 2.4,
      fiber_g: 2,
      calcium_mg: 100,
      iron_mg: 2.5,
      vitamin_c_mg: 4,
    },
    weight: 2,
  },
  {
    keywords: ['ステーキ', '焼肉'],
    name: '肉料理',
    nutrients: {
      energy_kcal: 450,
      protein_g: 35,
      fat_g: 30,
      carb_g: 5,
      salt_g: 2,
      fiber_g: 0,
      iron_mg: 3.5,
      calcium_mg: 20,
      vitamin_c_mg: 0,
    },
    weight: 2,
  },
];

const EMPTY: NutrientValues = {
  energy_kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carb_g: 0,
  salt_g: 0,
  fiber_g: 0,
  vitamin_c_mg: 0,
  calcium_mg: 0,
  iron_mg: 0,
};

function scaleForPortion(text: string): number {
  if (/大盛|おおもり|特盛/.test(text)) return 1.3;
  if (/小盛|少なめ|半分/.test(text)) return 0.7;
  if (/2杯|ふたつ|2個|２杯|２個/.test(text)) return 1.8;
  return 1;
}

function scaleNutrients(n: NutrientValues, factor: number): NutrientValues {
  const round1 = (v: number) => Math.round(v * factor * 10) / 10;
  return {
    energy_kcal: Math.round((n.energy_kcal ?? 0) * factor),
    protein_g: round1(n.protein_g ?? 0),
    fat_g: round1(n.fat_g ?? 0),
    carb_g: round1(n.carb_g ?? 0),
    salt_g: round1(n.salt_g ?? 0),
    fiber_g: round1(n.fiber_g ?? 0),
    vitamin_c_mg: round1(n.vitamin_c_mg ?? 0),
    calcium_mg: round1(n.calcium_mg ?? 0),
    iron_mg: round1(n.iron_mg ?? 0),
  };
}

function addNutrients(a: NutrientValues, b: NutrientValues): NutrientValues {
  return {
    energy_kcal: (a.energy_kcal ?? 0) + (b.energy_kcal ?? 0),
    protein_g: (a.protein_g ?? 0) + (b.protein_g ?? 0),
    fat_g: (a.fat_g ?? 0) + (b.fat_g ?? 0),
    carb_g: (a.carb_g ?? 0) + (b.carb_g ?? 0),
    salt_g: (a.salt_g ?? 0) + (b.salt_g ?? 0),
    fiber_g: (a.fiber_g ?? 0) + (b.fiber_g ?? 0),
    vitamin_c_mg: (a.vitamin_c_mg ?? 0) + (b.vitamin_c_mg ?? 0),
    calcium_mg: (a.calcium_mg ?? 0) + (b.calcium_mg ?? 0),
    iron_mg: (a.iron_mg ?? 0) + (b.iron_mg ?? 0),
  };
}

/**
 * 入力テキストから食事内容を推定する。
 * キーワード辞書ベースの概算（写真は使わない）。
 */
export function estimateMealFromText(text: string): MealEstimate {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      displayName: '',
      nutrients: { ...EMPTY },
      confidence: 0,
      matchedKeywords: [],
      note: '食事内容を入力してください。',
    };
  }

  const portion = scaleForPortion(trimmed);
  const matched: FoodPattern[] = [];
  const matchedKeywords: string[] = [];

  for (const pattern of FOOD_PATTERNS) {
    const hit = pattern.keywords.find((k) => trimmed.includes(k));
    if (hit) {
      matched.push(pattern);
      matchedKeywords.push(hit);
    }
  }

  // 重複名は重い方だけ残す
  const unique = new Map<string, FoodPattern>();
  for (const m of matched) {
    const prev = unique.get(m.name);
    if (!prev || m.weight > prev.weight) unique.set(m.name, m);
  }
  const foods = [...unique.values()];

  if (foods.length === 0) {
    // 未知の食事: 平均的な1食を仮置き
    const fallback = scaleNutrients(
      {
        energy_kcal: 550,
        protein_g: 20,
        fat_g: 18,
        carb_g: 70,
        salt_g: 2.5,
        fiber_g: 4,
        vitamin_c_mg: 15,
        calcium_mg: 60,
        iron_mg: 1.5,
      },
      portion,
    );
    return {
      displayName: trimmed,
      nutrients: fallback,
      confidence: 0.35,
      matchedKeywords: [],
      note: '辞書にない食事のため一般的な1食分の概算です。数値を調整してください。',
    };
  }

  let totals = { ...EMPTY };
  for (const food of foods) {
    totals = addNutrients(totals, food.nutrients);
  }
  totals = scaleNutrients(totals, portion);

  const confidence = Math.min(0.9, 0.45 + foods.length * 0.15 + (portion === 1 ? 0.05 : 0));
  const displayName =
    foods.length === 1 ? foods[0].name : foods.map((f) => f.name).join(' + ');

  return {
    displayName: portion !== 1 ? `${displayName}（分量調整あり）` : displayName,
    nutrients: totals,
    confidence,
    matchedKeywords,
    note: `「${matchedKeywords.join('・')}」から概算しました。保存前に数値を確認してください。`,
  };
}
