import type { ActivityLevel, DailyTargets, GoalType, Sex, UserProfile } from '../types';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTA: Record<GoalType, number> = {
  lose: -300,
  maintain: 0,
  gain: 300,
};

/** Mifflin-St Jeor BMR (kcal/day) */
export function calcBmr(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78;
}

function saltTarget(sex: Sex): number {
  return sex === 'male' ? 7.5 : 6.5;
}

function fiberTarget(sex: Sex): number {
  return sex === 'male' ? 21 : 18;
}

function calciumTarget(age: number): number {
  if (age < 30) return 800;
  return 750;
}

function ironTarget(sex: Sex, age: number): number {
  if (sex === 'female' && age >= 18 && age <= 49) return 10.5;
  return 7.5;
}

/**
 * 1日あたりの摂取目安を算出。
 * エネルギーは BMR×活動係数±目標、PFCはエネルギー比率ベース。
 * 食塩・食物繊維・一部微量栄養素は食事摂取基準の簡易テーブル。
 */
export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  const tdee = calcBmr(profile) * ACTIVITY_FACTOR[profile.activityLevel];
  const energy = Math.max(1200, Math.round(tdee + GOAL_DELTA[profile.goalType]));

  const proteinPerKg = profile.goalType === 'gain' ? 1.6 : 1.2;
  const protein_g = Math.round(Math.max(profile.weightKg * proteinPerKg, (energy * 0.15) / 4));
  const fat_g = Math.round((energy * 0.25) / 9);
  const carbEnergy = energy - protein_g * 4 - fat_g * 9;
  const carb_g = Math.max(0, Math.round(carbEnergy / 4));

  return {
    energy_kcal: energy,
    protein_g,
    fat_g,
    carb_g,
    salt_g: saltTarget(profile.sex),
    fiber_g: fiberTarget(profile.sex),
    vitamin_c_mg: 100,
    calcium_mg: calciumTarget(profile.age),
    iron_mg: ironTarget(profile.sex, profile.age),
  };
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'ほとんど動かない',
  light: '軽い運動（週1–2）',
  moderate: '中程度（週3–5）',
  active: '活発（ほぼ毎日）',
  very_active: '非常に活発',
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose: '減量',
  maintain: '維持',
  gain: '増量',
};

export const SEX_LABELS: Record<Sex, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
};
