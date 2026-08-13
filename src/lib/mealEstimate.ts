import {
  FOOD_DATABASE,
  amountUnitOf,
  emptyNutrients,
  hasAlcoholEnergy,
  isScalableFood,
  type AmountUnit,
  type FoodEntry,
} from './foodDatabase';
import type { NutrientValues } from '../types';

export type MealEstimate = {
  displayName: string;
  nutrients: NutrientValues;
  confidence: number;
  matchedKeywords: string[];
  note: string;
  /** 分量換算できる単一食品のとき true（g / ml） */
  supportsGrams: boolean;
  /** 適用した分量（g または ml） */
  grams: number | null;
  /** 表示・入力の単位 */
  amountUnit: AmountUnit | null;
  /** 100g または 100ml あたりの基準値 */
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

function normalizeDigits(text: string): string {
  return text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/ｍｌ/gi, 'ml')
    .replace(/ｇ/g, 'g');
}

/** 「150g」「２００グラム」などを抽出 */
export function parseGramsFromText(text: string): number | null {
  const normalized = normalizeDigits(text);
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*(?:g|グラム|ｸﾞﾗﾑ)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return n;
}

/** 「200ml」「２００ミリ」などを抽出 */
export function parseMlFromText(text: string): number | null {
  const normalized = normalizeDigits(text);
  const m = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:ml|ミリリットル|ミリ|cc|ＣＣ|CC)/i,
  );
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return n;
}

/** 「1杯」「一杯」→ 杯数。飲料のとき 1杯≒200ml として使う */
export function parseCupsFromText(text: string): number | null {
  const normalized = normalizeDigits(text);
  if (/一杯|１杯/.test(text) || /\b1杯/.test(normalized)) return 1;
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*杯/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 20) return null;
  return n;
}

function resolveAmount(
  text: string,
  food: FoodEntry,
  amountOverride?: number | null,
): number {
  if (amountOverride != null && amountOverride > 0) return amountOverride;
  const unit = amountUnitOf(food);
  if (unit === 'ml') {
    const ml = parseMlFromText(text);
    if (ml != null) return ml;
    const cups = parseCupsFromText(text);
    if (cups != null) return Math.round(cups * 200);
    const g = parseGramsFromText(text);
    if (g != null) return g; // 飲料で g 指定された場合も同量として扱う
    return food.defaultGrams;
  }
  const g = parseGramsFromText(text);
  if (g != null) return g;
  const ml = parseMlFromText(text);
  if (ml != null) return ml;
  return food.defaultGrams;
}

function portionFactor(text: string): number {
  if (/大盛|おおもり|特盛/.test(text)) return 1.3;
  if (/小盛|少なめ|半分/.test(text)) return 0.7;
  if (/2杯|ふたつ|2個|２杯|２個/.test(text)) return 1.8;
  return 1;
}

/** ひらがな・カタカナを揃えて部分一致しやすくする */
function foldKana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

function findMatches(text: string): { food: FoodEntry; keyword: string }[] {
  const lower = text.toLowerCase();
  const folded = foldKana(lower);
  const hits: { food: FoodEntry; keyword: string; len: number }[] = [];

  for (const food of FOOD_DATABASE) {
    let best: string | null = null;
    for (const k of food.keywords) {
      const key = k.toLowerCase();
      const keyFolded = foldKana(key);
      if (
        lower.includes(key) ||
        text.includes(k) ||
        folded.includes(keyFolded)
      ) {
        if (!best || k.length > best.length) best = k;
      }
    }
    if (best) hits.push({ food, keyword: best, len: best.length });
  }

  hits.sort((a, b) => b.len - a.len || b.food.weight - a.food.weight);
  const unique = new Map<string, { food: FoodEntry; keyword: string }>();
  for (const h of hits) {
    if (!unique.has(h.food.id)) unique.set(h.food.id, { food: h.food, keyword: h.keyword });
  }

  const foods = [...unique.values()];
  // 長いキーワードに含まれる短い一致は落とす（例: とんかつ丼 ⊂ とんかつ、カツカレー ⊂ カレー）
  const afterSubsume = foods.filter((a) => {
    return !foods.some(
      (b) =>
        b.food.id !== a.food.id &&
        b.keyword.length > a.keyword.length &&
        (b.keyword.includes(a.keyword) ||
          foldKana(b.keyword.toLowerCase()).includes(
            foldKana(a.keyword.toLowerCase()),
          )),
    );
  });

  // 「スタバのソイラテ」など: ブランド汎用（*_generic）は具体メニューがあるとき落とす
  const withoutBrandGeneric = afterSubsume.filter((a) => {
    if (!a.food.id.endsWith('_generic')) return true;
    return !afterSubsume.some((b) => b.food.id !== a.food.id);
  });

  const keywordsOverlap = (a: string[], b: string[]) =>
    a.some((ak) => b.some((bk) => ak === bk || ak.includes(bk) || bk.includes(ak)));

  // 料理（1食）が当たっているときは、同じ語の食材換算を足し込まない
  const withoutDishOverlap = withoutBrandGeneric.filter((a) => {
    if (!isScalableFood(a.food)) return true;
    return !withoutBrandGeneric.some(
      (b) =>
        b.food.id !== a.food.id &&
        !isScalableFood(b.food) &&
        keywordsOverlap(a.food.keywords, b.food.keywords),
    );
  });

  return withoutDishOverlap.filter((a) => {
    if (!isScalableFood(a.food)) return true;
    return !withoutDishOverlap.some(
      (b) =>
        b.food.id !== a.food.id &&
        b.food.weight > a.food.weight &&
        keywordsOverlap(a.food.keywords, b.food.keywords),
    );
  });
}

export function nutrientsForGrams(
  per100: NutrientValues,
  amount: number,
): NutrientValues {
  return scaleNutrients(per100, amount / 100);
}

function unitLabel(unit: AmountUnit): string {
  return unit === 'ml' ? 'ml' : 'g';
}

function alcoholNote(food: FoodEntry, amount: number): string {
  if (!hasAlcoholEnergy(food) || !food.alcohol_g) return '';
  const alcohol = Math.round(food.alcohol_g * (amount / 100) * 10) / 10;
  const carb = food.nutrients.carb_g ?? 0;
  if (carb < 0.5) {
    return `エネルギーは主にアルコール（約${alcohol}g）由来です。炭水化物はほぼ含まれません。`;
  }
  return `アルコール約${alcohol}gを含みます（エネルギーの一部はアルコール由来）。`;
}

function buildScaleNote(food: FoodEntry, amount: number, unit: AmountUnit): string {
  const u = unitLabel(unit);
  const base = `${food.source}の100${u}あたりを${amount}${u}に換算しました。分量を変えると再計算できます。`;
  const extra = alcoholNote(food, amount);
  return extra ? `${base} ${extra}` : base;
}

function emptyEstimate(note: string, displayName = ''): MealEstimate {
  return {
    displayName,
    nutrients: emptyNutrients(),
    confidence: 0,
    matchedKeywords: [],
    note,
    supportsGrams: false,
    grams: null,
    amountUnit: null,
    per100g: null,
    source: '',
  };
}

/**
 * 入力テキストから食事内容を推定する。
 * 成分表ベースの食品は g/ml 換算、料理は1食概算。
 */
export function estimateMealFromText(
  text: string,
  amountOverride?: number | null,
): MealEstimate {
  const trimmed = text.trim();
  if (!trimmed) {
    return emptyEstimate('食事内容を入力してください。');
  }

  const matches = findMatches(trimmed);
  const portion = portionFactor(trimmed);

  if (matches.length === 0) {
    return emptyEstimate(
      '辞書にない食品です。食品名を変えるか、手入力で数値を入れてください（一般的な1食の仮置きはしません）。',
      trimmed,
    );
  }

  // 単一の換算食品 → g/ml 換算
  if (matches.length === 1 && isScalableFood(matches[0].food)) {
    const food = matches[0].food;
    const unit = amountUnitOf(food);
    const amount = resolveAmount(trimmed, food, amountOverride);
    const nutrients = nutrientsForGrams(food.nutrients, amount);
    const u = unitLabel(unit);
    return {
      displayName: `${food.name}（${amount}${u}）`,
      nutrients,
      confidence: 0.85,
      matchedKeywords: [matches[0].keyword],
      note: buildScaleNote(food, amount, unit),
      supportsGrams: true,
      grams: amount,
      amountUnit: unit,
      per100g: { ...food.nutrients },
      source: food.source,
    };
  }

  let totals = emptyNutrients();
  const names: string[] = [];
  const keywords: string[] = [];
  let anyScalable = false;

  for (const m of matches) {
    keywords.push(m.keyword);
    if (isScalableFood(m.food)) {
      anyScalable = true;
      const unit = amountUnitOf(m.food);
      const amount = resolveAmount(trimmed, m.food, null);
      totals = addNutrients(totals, nutrientsForGrams(m.food.nutrients, amount));
      names.push(`${m.food.name}（${amount}${unitLabel(unit)}）`);
    } else {
      totals = addNutrients(totals, scaleNutrients(m.food.nutrients, portion));
      names.push(m.food.name);
    }
  }

  return {
    displayName:
      portion !== 1 && !anyScalable
        ? `${names.join(' + ')}（分量調整あり）`
        : names.join(' + '),
    nutrients: totals,
    confidence: Math.min(0.9, 0.5 + matches.length * 0.12),
    matchedKeywords: keywords,
    note: `「${keywords.join('・')}」から成分表・料理概算で算出しました。保存前に確認してください。`,
    supportsGrams: false,
    grams: null,
    amountUnit: null,
    per100g: null,
    source: matches.map((m) => m.food.source).join(' / '),
  };
}
