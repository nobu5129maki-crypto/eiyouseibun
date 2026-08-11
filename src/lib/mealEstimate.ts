import {
  FOOD_DATABASE,
  emptyNutrients,
  type FoodEntry,
} from './foodDatabase';
import type { NutrientValues } from '../types';

export type MealEstimate = {
  displayName: string;
  nutrients: NutrientValues;
  confidence: number;
  matchedKeywords: string[];
  note: string;
  /** グラム換算できる単一食品のとき true */
  supportsGrams: boolean;
  /** 適用したグラム数（per100g のとき） */
  grams: number | null;
  /** 100gあたりの基準値（グラム再計算用） */
  per100g: NutrientValues | null;
  source: string;
};

function scaleNutrients(n: NutrientValues, factor: number): NutrientValues {
  const round1 = (v: number) => Math.round(v * factor * 10) / 10;
  const round2 = (v: number) => Math.round(v * factor * 100) / 100;
  return {
    energy_kcal: Math.round((n.energy_kcal ?? 0) * factor * 10) / 10,
    protein_g: round1(n.protein_g ?? 0),
    fat_g: round1(n.fat_g ?? 0),
    carb_g: round1(n.carb_g ?? 0),
    salt_g: round2(n.salt_g ?? 0),
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

/** 「150g」「２００グラム」などを抽出 */
export function parseGramsFromText(text: string): number | null {
  const normalized = text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/ｇ/g, 'g');
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*(?:g|グラム|ｸﾞﾗﾑ)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return n;
}

function portionFactor(text: string): number {
  if (/大盛|おおもり|特盛/.test(text)) return 1.3;
  if (/小盛|少なめ|半分/.test(text)) return 0.7;
  if (/2杯|ふたつ|2個|２杯|２個/.test(text)) return 1.8;
  return 1;
}

function findMatches(text: string): { food: FoodEntry; keyword: string }[] {
  const lower = text.toLowerCase();
  const hits: { food: FoodEntry; keyword: string; len: number }[] = [];

  for (const food of FOOD_DATABASE) {
    let best: string | null = null;
    for (const k of food.keywords) {
      const key = k.toLowerCase();
      if (lower.includes(key) || text.includes(k)) {
        if (!best || k.length > best.length) best = k;
      }
    }
    if (best) hits.push({ food, keyword: best, len: best.length });
  }

  // 長いキーワード優先。同じ食品は1つ。
  hits.sort((a, b) => b.len - a.len || b.food.weight - a.food.weight);
  const unique = new Map<string, { food: FoodEntry; keyword: string }>();
  for (const h of hits) {
    if (!unique.has(h.food.id)) unique.set(h.food.id, { food: h.food, keyword: h.keyword });
  }

  // 「ゆでブロッコリー」と「ブロッコリー」が両方当たるときは重い方だけ
  const foods = [...unique.values()];
  const filtered = foods.filter((a) => {
    if (a.food.mode !== 'per100g') return true;
    // より具体的な同系統（キーワード包含）があれば落とす
    return !foods.some(
      (b) =>
        b.food.id !== a.food.id &&
        b.food.weight > a.food.weight &&
        b.food.keywords.some((bk) =>
          a.food.keywords.some((ak) => bk.includes(ak) || ak.includes(bk)),
        ),
    );
  });

  return filtered;
}

export function nutrientsForGrams(
  per100g: NutrientValues,
  grams: number,
): NutrientValues {
  return scaleNutrients(per100g, grams / 100);
}

/**
 * 入力テキストから食事内容を推定する。
 * 成分表ベースの食品はグラム換算、料理は1食概算。
 */
export function estimateMealFromText(
  text: string,
  gramsOverride?: number | null,
): MealEstimate {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      displayName: '',
      nutrients: emptyNutrients(),
      confidence: 0,
      matchedKeywords: [],
      note: '食事内容を入力してください。',
      supportsGrams: false,
      grams: null,
      per100g: null,
      source: '',
    };
  }

  const matches = findMatches(trimmed);
  const portion = portionFactor(trimmed);
  const parsedGrams = parseGramsFromText(trimmed);

  if (matches.length === 0) {
    return {
      displayName: trimmed,
      nutrients: emptyNutrients(),
      confidence: 0,
      matchedKeywords: [],
      note:
        '辞書にない食品です。食品名を変えるか、手入力で数値を入れてください（一般的な1食の仮置きはしません）。',
      supportsGrams: false,
      grams: null,
      per100g: null,
      source: '',
    };
  }

  // 単一の per100g 食品 → グラム換算
  if (matches.length === 1 && matches[0].food.mode === 'per100g') {
    const food = matches[0].food;
    const grams =
      gramsOverride != null && gramsOverride > 0
        ? gramsOverride
        : parsedGrams ?? food.defaultGrams;
    const nutrients = nutrientsForGrams(food.nutrients, grams);
    return {
      displayName: `${food.name}（${grams}g）`,
      nutrients,
      confidence: 0.85,
      matchedKeywords: [matches[0].keyword],
      note: `${food.source}の100gあたりを${grams}gに換算しました。グラムを変えると再計算できます。`,
      supportsGrams: true,
      grams,
      per100g: { ...food.nutrients },
      source: food.source,
    };
  }

  // 複数 or 料理: 各食品を合算（per100g はデフォルトg、テキストにgがあれば優先）
  let totals = emptyNutrients();
  const names: string[] = [];
  const keywords: string[] = [];
  let anyPer100 = false;
  let singlePer100: FoodEntry | null = null;

  for (const m of matches) {
    keywords.push(m.keyword);
    if (m.food.mode === 'per100g') {
      anyPer100 = true;
      singlePer100 = m.food;
      const g = parsedGrams ?? m.food.defaultGrams;
      totals = addNutrients(totals, nutrientsForGrams(m.food.nutrients, g));
      names.push(`${m.food.name}（${g}g）`);
    } else {
      totals = addNutrients(totals, scaleNutrients(m.food.nutrients, portion));
      names.push(m.food.name);
    }
  }

  const supportsGrams =
    matches.length === 1 && matches[0].food.mode === 'per100g';
  const grams = supportsGrams
    ? gramsOverride ?? parsedGrams ?? matches[0].food.defaultGrams
    : null;

  return {
    displayName:
      portion !== 1 && !anyPer100
        ? `${names.join(' + ')}（分量調整あり）`
        : names.join(' + '),
    nutrients: totals,
    confidence: Math.min(0.9, 0.5 + matches.length * 0.12),
    matchedKeywords: keywords,
    note: `「${keywords.join('・')}」から成分表・料理概算で算出しました。保存前に確認してください。`,
    supportsGrams,
    grams,
    per100g: supportsGrams && singlePer100 ? { ...singlePer100.nutrients } : null,
    source: matches.map((m) => m.food.source).join(' / '),
  };
}
