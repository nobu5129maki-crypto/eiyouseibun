import { useMemo } from 'react';
import { formatTime, todayKey } from '../lib/date';
import {
  PRIMARY_NUTRIENTS,
  getIntakeValue,
  getTargetValue,
  percentOfTarget,
  sumNutrients,
} from '../lib/nutrition';
import { useApp } from '../store/AppContext';

const MEAL_SLOT_LABEL = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夜',
  snack: '間食',
} as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function HistoryPage() {
  const { meals, targets, deleteMeal } = useApp();

  const days = useMemo(() => {
    const map = new Map<string, typeof meals>();
    for (const meal of meals) {
      const day = meal.loggedAt.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(meal);
      map.set(day, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [meals]);

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          履歴
        </h1>
        <p className="muted">日別の摂取サマリと記録一覧です。</p>
      </header>

      {days.length === 0 && <p className="muted">まだ履歴がありません。</p>}

      {days.map(([day, dayMeals]) => {
        const intake = sumNutrients(dayMeals, day);
        const overLabels =
          targets == null
            ? []
            : PRIMARY_NUTRIENTS.filter((n) => {
                const pct = percentOfTarget(
                  getIntakeValue(intake, n.key),
                  getTargetValue(targets, n.key),
                );
                return pct >= 100;
              }).map((n) => n.label);

        return (
          <section key={day} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>
                {day}
                {day === todayKey() ? '（今日）' : ''}
              </h2>
              <strong style={{ color: 'var(--accent)' }}>
                {Math.round(intake.energy_kcal)} kcal
              </strong>
            </div>

            {targets && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                タンパク質 {Math.round(intake.protein_g)}/{targets.protein_g}g ・
                脂質 {Math.round(intake.fat_g)}/{targets.fat_g}g ・ 炭水化物{' '}
                {Math.round(intake.carb_g)}/{targets.carb_g}g ・ 食塩相当量{' '}
                {round1(intake.salt_g)}/{targets.salt_g}g
              </p>
            )}

            {overLabels.length > 0 && (
              <p className="pct-over" style={{ fontSize: '0.85rem' }}>
                超過: {overLabels.join('・')}
              </p>
            )}

            {dayMeals.map((meal) => (
              <div key={meal.id} className="meal-row">
                <div>
                  <strong>{meal.displayName}</strong>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {MEAL_SLOT_LABEL[meal.mealSlot]} ・ {formatTime(meal.loggedAt)} ・{' '}
                    {meal.inputMethod === 'ocr_label'
                      ? 'ラベル読取'
                      : meal.inputMethod === 'text'
                        ? 'テキスト推測'
                        : '手入力'}
                  </div>
                </div>
                <div className="row">
                  <span className="muted">{Math.round(meal.nutrients.energy_kcal)}</span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => {
                      if (confirm(`「${meal.displayName}」を削除しますか？`)) {
                        deleteMeal(meal.id);
                      }
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
