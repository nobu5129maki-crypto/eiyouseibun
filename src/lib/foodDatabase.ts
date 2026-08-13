import type { NutrientValues } from '../types';
import customFoodsJson from '../data/custom-foods.json';
import mextFoodsJson from '../data/mext-foods.json';

export type FoodUnitMode = 'per100g' | 'per100ml' | 'serving';
export type AmountUnit = 'g' | 'ml';

export type FoodEntry = {
  id: string;
  /** マッチ用（長い語を優先するため長い順に登録する） */
  keywords: string[];
  name: string;
  /** 日本食品標準成分表ベースの概算値（100g または 100ml あたり） */
  nutrients: NutrientValues;
  mode: FoodUnitMode;
  /** per100g/ml のときの標準分量、serving のときは1食分 */
  defaultGrams: number;
  source: string;
  weight: number;
  /** アルコール量 g / 100g or 100ml（エネルギー説明用） */
  alcohol_g?: number;
};

export const MEXT_FOOD_SOURCE = {
  name: '日本食品標準成分表（八訂）増補2023年',
  publisher: '文部科学省',
  url: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html',
  foodCount: 2538,
} as const;

/** PFCだけでは説明できないアルコール由来エネルギーがあるか */
export function hasAlcoholEnergy(food: FoodEntry): boolean {
  return (food.alcohol_g ?? 0) > 0.2;
}

export function amountUnitOf(food: FoodEntry): AmountUnit {
  return food.mode === 'per100ml' ? 'ml' : 'g';
}

export function isScalableFood(food: FoodEntry): boolean {
  return food.mode === 'per100g' || food.mode === 'per100ml';
}

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

const CUSTOM_FOODS = customFoodsJson as FoodEntry[];
const reservedKeywords = new Set(CUSTOM_FOODS.flatMap((f) => f.keywords));

const MEXT_FOODS = (mextFoodsJson as FoodEntry[]).map((food) => ({
  ...food,
  keywords: food.keywords.filter((k) => !reservedKeywords.has(k)),
}));

/**
 * 文部科学省「日本食品標準成分表（八訂）増補2023年」の収載食品に、
 * 料理1食分・市販メニューなど成分表外の概算を加えた辞書。
 */
export const FOOD_DATABASE: FoodEntry[] = [...CUSTOM_FOODS, ...MEXT_FOODS];

export function emptyNutrients(): NutrientValues {
  return { ...EMPTY };
}
