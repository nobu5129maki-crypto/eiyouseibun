import type { DailyTargets, MealLog, NutrientKey, NutrientValues } from '../types';
import {
  addDays,
  daysInMonth,
  formatMonthLabel,
  formatWeekLabel,
  monthKey,
  startOfWeek,
  todayKey,
  weekKey,
} from './date';
import { PRIMARY_NUTRIENTS } from './nutrition';

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

export type HistoryRange = 'day' | 'week' | 'month';

export type HistoryBucket = {
  key: string;
  label: string;
  meals: MealLog[];
  intake: NutrientValues;
  /** 期間内に記録があった日数 */
  activeDays: number;
  /** 期間の日数（週=7、月=その月の日数、日=1） */
  periodDays: number;
};

function emptyIntake(): NutrientValues {
  return { ...EMPTY };
}

function addMealToIntake(acc: NutrientValues, meal: MealLog): NutrientValues {
  const next = { ...acc };
  (Object.keys(EMPTY) as (keyof NutrientValues)[]).forEach((key) => {
    next[key] = (next[key] ?? 0) + (meal.nutrients[key] ?? 0);
  });
  return next;
}

export function sumMeals(meals: MealLog[]): NutrientValues {
  return meals.reduce<NutrientValues>(
    (acc, meal) => addMealToIntake(acc, meal),
    emptyIntake(),
  );
}

/** 日別バケット（新しい順） */
export function buildDailyBuckets(meals: MealLog[]): HistoryBucket[] {
  const map = new Map<string, MealLog[]>();
  for (const meal of meals) {
    const day = todayKey(new Date(meal.loggedAt));
    const list = map.get(day) ?? [];
    list.push(meal);
    map.set(day, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, dayMeals]) => ({
      key: day,
      label: day === todayKey() ? `${day}（今日）` : day,
      meals: dayMeals.sort(
        (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
      ),
      intake: sumMeals(dayMeals),
      activeDays: 1,
      periodDays: 1,
    }));
}

/** 週別バケット（月曜始まり・新しい順） */
export function buildWeeklyBuckets(meals: MealLog[]): HistoryBucket[] {
  const map = new Map<string, MealLog[]>();
  for (const meal of meals) {
    const key = weekKey(todayKey(new Date(meal.loggedAt)));
    const list = map.get(key) ?? [];
    list.push(meal);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([start, weekMeals]) => {
      const days = new Set(weekMeals.map((m) => todayKey(new Date(m.loggedAt))));
      return {
        key: start,
        label: `${formatWeekLabel(start)}の週`,
        meals: weekMeals.sort(
          (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
        ),
        intake: sumMeals(weekMeals),
        activeDays: days.size,
        periodDays: 7,
      };
    });
}

/** 月別バケット（新しい順） */
export function buildMonthlyBuckets(meals: MealLog[]): HistoryBucket[] {
  const map = new Map<string, MealLog[]>();
  for (const meal of meals) {
    const key = monthKey(todayKey(new Date(meal.loggedAt)));
    const list = map.get(key) ?? [];
    list.push(meal);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, monthMeals]) => {
      const days = new Set(monthMeals.map((m) => todayKey(new Date(m.loggedAt))));
      return {
        key: month,
        label: formatMonthLabel(month),
        meals: monthMeals.sort(
          (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
        ),
        intake: sumMeals(monthMeals),
        activeDays: days.size,
        periodDays: daysInMonth(month),
      };
    });
}

export function bucketsForRange(
  meals: MealLog[],
  range: HistoryRange,
): HistoryBucket[] {
  if (range === 'week') return buildWeeklyBuckets(meals);
  if (range === 'month') return buildMonthlyBuckets(meals);
  return buildDailyBuckets(meals);
}

/** グラフ用: 古い→新しいの連続系列（記録のない期間も0埋め） */
export function buildChartSeries(
  meals: MealLog[],
  range: HistoryRange,
  points = 14,
): { key: string; label: string; value: number; intake: NutrientValues }[] {
  const today = todayKey();
  const series: { key: string; label: string; value: number; intake: NutrientValues }[] =
    [];

  if (range === 'day') {
    const byDay = new Map(
      buildDailyBuckets(meals).map((b) => [b.key, b] as const),
    );
    for (let i = points - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const bucket = byDay.get(day);
      const intake = bucket?.intake ?? emptyIntake();
      const d = new Date(day + 'T12:00:00');
      series.push({
        key: day,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: intake.energy_kcal,
        intake,
      });
    }
    return series;
  }

  if (range === 'week') {
    const byWeek = new Map(
      buildWeeklyBuckets(meals).map((b) => [b.key, b] as const),
    );
    let cursor = startOfWeek(today);
    const keys: string[] = [];
    for (let i = 0; i < points; i++) {
      keys.unshift(cursor);
      cursor = addDays(cursor, -7);
    }
    for (const key of keys) {
      const bucket = byWeek.get(key);
      const intake = bucket?.intake ?? emptyIntake();
      series.push({
        key,
        label: formatWeekLabel(key).split('〜')[0],
        value: intake.energy_kcal,
        intake,
      });
    }
    return series;
  }

  // month
  const byMonth = new Map(
    buildMonthlyBuckets(meals).map((b) => [b.key, b] as const),
  );
  const [ty, tm] = today.split('-').map(Number);
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(ty, tm - 1 - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = byMonth.get(key);
    const intake = bucket?.intake ?? emptyIntake();
    series.push({
      key,
      label: `${date.getMonth() + 1}月`,
      value: intake.energy_kcal,
      intake,
    });
  }
  return series;
}

export function periodTarget(
  targets: DailyTargets | null,
  key: NutrientKey,
  periodDays: number,
): number {
  if (!targets) return 0;
  return (targets[key] ?? 0) * periodDays;
}

export function chartNutrientOptions() {
  return PRIMARY_NUTRIENTS.map((n) => ({
    key: n.key,
    label: n.label,
    unit: n.unit,
  }));
}
