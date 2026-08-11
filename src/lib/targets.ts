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

/**
 * 厚生労働省「日本人の食事摂取基準」への準拠メタ情報。
 * 新年版が出たら editionYear / name / period と栄養テーブルを必ず更新する。
 */
export const DRI_SOURCE = {
  name: '日本人の食事摂取基準（2025年版）',
  editionYear: 2025,
  publisher: '厚生労働省',
  url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/eiyou/syokuji_kijyun.html',
  period: '令和7〜11年度',
  /** check:dri で厚労省ページと突き合わせた日（YYYY-MM-DD） */
  lastChecked: '2026-08-11',
} as const;

/**
 * 設定画面などに表示する算出根拠（箇条書き）。
 * 数値は食事摂取基準2025年版の推奨量・目標量を中心に簡略化しています。
 */
export const TARGET_BASIS_LINES: string[] = [
  'エネルギー: Mifflin–St Jeor式で基礎代謝量（BMR）を推定し、活動係数を乗じて総消費量の目安とし、目標（減量−300／増量+300 kcal）を加減（下限1200 kcal）。',
  'たんぱく質: 体重×1.2 g（増量時1.6 g）と、総エネルギーの約15%相当の大きい方。食事摂取基準の目標量（成人おおむね13〜20%エネルギー）の範囲を意識。',
  '脂質: 総エネルギーの約25%（同基準の目標量20〜30%エネルギーの中央付近）。',
  '炭水化物: エネルギーからたんぱく質・脂質分を除いた残り（同基準の目標量50〜65%エネルギーを目安）。',
  '食塩: 同基準の目標量（成人 男性7.5 g未満・女性6.5 g未満）。高血圧・CKD重症化予防の観点では男女とも6.0 g未満。',
  '食物繊維: 同基準の目標量（年齢・性別ごと。例: 30〜64歳男性22 g以上、女性18 g以上）。',
  'ビタミンC: 同基準の推奨量（成人100 mg）。',
  'カルシウム・鉄: 同基準の推奨量（年齢・性別。鉄は月経のある女性を想定して18〜49歳で高めの値）。',
];

/** Mifflin-St Jeor BMR (kcal/day) */
export function calcBmr(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78;
}

function avg(a: number, b: number): number {
  return Math.round(((a + b) / 2) * 10) / 10;
}

/** 食塩相当量の目標量（g/日）※「未満」の上限側を目安値として表示 */
export function saltTarget(sex: Sex): number {
  if (sex === 'male') return 7.5;
  if (sex === 'female') return 6.5;
  return avg(7.5, 6.5);
}

/** 食物繊維の目標量（g/日） */
export function fiberTarget(sex: Sex, age: number): number {
  const male = (() => {
    if (age < 18) return 19;
    if (age <= 29) return 20;
    if (age <= 64) return 22;
    if (age <= 74) return 21;
    return 20;
  })();
  const female = (() => {
    if (age < 18) return 18;
    if (age >= 75) return 17;
    return 18;
  })();
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return Math.round(avg(male, female));
}

/** カルシウム推奨量（mg/日） */
export function calciumTarget(sex: Sex, age: number): number {
  const male = (() => {
    if (age < 18) return 800;
    if (age <= 29) return 800;
    return 750;
  })();
  const female = (() => {
    if (age < 18) return 650;
    if (age <= 74) return 650;
    return 600;
  })();
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return Math.round(avg(male, female));
}

/** 鉄の推奨量（mg/日）。女性18〜49歳は月経ありを想定 */
export function ironTarget(sex: Sex, age: number): number {
  const male = (() => {
    if (age <= 29) return 7.0;
    if (age <= 49) return 7.5;
    if (age <= 74) return 7.0;
    return 6.5;
  })();
  const female = (() => {
    if (age >= 18 && age <= 29) return 10.0;
    if (age >= 30 && age <= 49) return 10.5;
    if (age >= 50 && age <= 64) return 6.0; // 月経なしを既定
    if (age >= 65 && age <= 74) return 6.0;
    if (age >= 75) return 5.5;
    return 10.5; // 18歳未満は簡易
  })();
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return avg(male, female);
}

/** ビタミンC推奨量（mg/日） */
export function vitaminCTarget(age: number): number {
  if (age < 12) return 70;
  if (age < 15) return 90;
  return 100;
}

/**
 * 1日あたりの摂取目安を算出。
 * エネルギーは BMR×活動係数±目標、PFCはエネルギー比率ベース。
 * 食塩・食物繊維・微量栄養素は食事摂取基準（2025年版）の簡易テーブル。
 */
export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  const tdee = calcBmr(profile) * ACTIVITY_FACTOR[profile.activityLevel];
  const energy = Math.max(1200, Math.round(tdee + GOAL_DELTA[profile.goalType]));

  const proteinPerKg = profile.goalType === 'gain' ? 1.6 : 1.2;
  const protein_g = Math.round(
    Math.max(profile.weightKg * proteinPerKg, (energy * 0.15) / 4),
  );
  const fat_g = Math.round((energy * 0.25) / 9);
  const carbEnergy = energy - protein_g * 4 - fat_g * 9;
  const carb_g = Math.max(0, Math.round(carbEnergy / 4));

  return {
    energy_kcal: energy,
    protein_g,
    fat_g,
    carb_g,
    salt_g: saltTarget(profile.sex),
    fiber_g: fiberTarget(profile.sex, profile.age),
    vitamin_c_mg: vitaminCTarget(profile.age),
    calcium_mg: calciumTarget(profile.sex, profile.age),
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
