export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type InputMethod = 'text' | 'manual' | 'ocr_label';

export type NutrientKey =
  | 'energy_kcal'
  | 'protein_g'
  | 'fat_g'
  | 'carb_g'
  | 'salt_g'
  | 'fiber_g'
  | 'vitamin_c_mg'
  | 'calcium_mg'
  | 'iron_mg';

export type UserProfile = {
  displayName: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
};

export type DailyTargets = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  salt_g: number;
  fiber_g: number;
  vitamin_c_mg: number;
  calcium_mg: number;
  iron_mg: number;
};

export type NutrientValues = {
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  salt_g: number;
  fiber_g?: number;
  vitamin_c_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
};

export type MealLog = {
  id: string;
  loggedAt: string;
  mealSlot: MealSlot;
  inputMethod: InputMethod;
  displayName: string;
  note?: string;
  nutrients: NutrientValues;
};

export type AppState = {
  profile: UserProfile | null;
  targets: DailyTargets | null;
  meals: MealLog[];
};

export type AdviceItem = {
  nutrientKey: NutrientKey;
  title: string;
  message: string;
  suggestions: string[];
  severity: 'info' | 'warning';
};
