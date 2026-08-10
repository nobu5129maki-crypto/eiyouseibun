import type { DailyTargets, MealLog, NutrientKey, NutrientValues } from '../types';
import { isSameDay, todayKey } from './date';

export const PRIMARY_NUTRIENTS: {
  key: NutrientKey;
  label: string;
  unit: string;
}[] = [
  { key: 'energy_kcal', label: 'エネルギー', unit: 'kcal' },
  { key: 'protein_g', label: 'タンパク質', unit: 'g' },
  { key: 'fat_g', label: '脂質', unit: 'g' },
  { key: 'carb_g', label: '炭水化物', unit: 'g' },
  { key: 'salt_g', label: '食塩相当量', unit: 'g' },
];

export const MICRO_NUTRIENTS: {
  key: NutrientKey;
  label: string;
  unit: string;
}[] = [
  { key: 'fiber_g', label: '食物繊維', unit: 'g' },
  { key: 'vitamin_c_mg', label: 'ビタミンC', unit: 'mg' },
  { key: 'calcium_mg', label: 'カルシウム', unit: 'mg' },
  { key: 'iron_mg', label: '鉄', unit: 'mg' },
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

export function sumNutrients(meals: MealLog[], day = todayKey()): NutrientValues {
  return meals
    .filter((m) => isSameDay(m.loggedAt, day))
    .reduce<NutrientValues>((acc, meal) => {
      (Object.keys(EMPTY) as (keyof NutrientValues)[]).forEach((key) => {
        acc[key] = (acc[key] ?? 0) + (meal.nutrients[key] ?? 0);
      });
      return acc;
    }, { ...EMPTY });
}

export function percentOfTarget(intake: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((intake / target) * 1000) / 10;
}

export type ProgressTone = 'ok' | 'caution' | 'over';

export function progressTone(pct: number, nutrientKey: NutrientKey): ProgressTone {
  const overSensitive: NutrientKey[] = ['salt_g', 'fat_g', 'energy_kcal', 'carb_g'];
  if (overSensitive.includes(nutrientKey)) {
    if (pct >= 100) return 'over';
    if (pct >= 80) return 'caution';
    return 'ok';
  }
  if (pct >= 120) return 'over';
  if (pct < 50) return 'caution';
  return 'ok';
}

export function getTargetValue(targets: DailyTargets, key: NutrientKey): number {
  return targets[key];
}

export function getIntakeValue(intake: NutrientValues, key: NutrientKey): number {
  return intake[key] ?? 0;
}
