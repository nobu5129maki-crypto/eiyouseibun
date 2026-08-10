import { Link, useNavigate } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { formatDisplayDate, formatTime } from '../lib/date';
import {
  MICRO_NUTRIENTS,
  PRIMARY_NUTRIENTS,
  getIntakeValue,
  getTargetValue,
  percentOfTarget,
  progressTone,
} from '../lib/nutrition';
import { useApp } from '../store/AppContext';

const MEAL_SLOT_LABEL = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夜',
  snack: '間食',
} as const;

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export function HomePage() {
  const navigate = useNavigate();
  const { profile, targets, todayIntake, todayMeals, advice, deleteMeal } = useApp();
  if (!profile || !targets) return null;

  const overs = PRIMARY_NUTRIENTS.filter((n) => {
    const pct = percentOfTarget(
      getIntakeValue(todayIntake, n.key),
      getTargetValue(targets, n.key),
    );
    return pct >= 100;
  });

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          こんにちは、{profile.displayName}さん
        </h1>
        <p className="muted">{formatDisplayDate()} の摂取状況</p>
      </header>

      {overs.length > 0 && (
        <div className="alert danger">
          <strong>過剰摂取の注意</strong>
          <div>
            {overs.map((o) => o.label).join('・')}
            が 1 日の目安を超えています。
          </div>
        </div>
      )}

      <section className="card">
        <h2>今日の進捗</h2>
        {PRIMARY_NUTRIENTS.map((n) => {
          const intake = getIntakeValue(todayIntake, n.key);
          const target = getTargetValue(targets, n.key);
          const pct = percentOfTarget(intake, target);
          return (
            <ProgressBar
              key={n.key}
              label={n.label}
              pct={pct}
              tone={progressTone(pct, n.key)}
              valueLabel={`${round(intake)}${n.unit} / ${target}${n.unit}（${pct}%）`}
            />
          );
        })}
      </section>

      <section className="card">
        <h2>微量栄養素</h2>
        <div className="grid-2">
          {MICRO_NUTRIENTS.map((n) => {
            const intake = getIntakeValue(todayIntake, n.key);
            const target = getTargetValue(targets, n.key);
            const pct = percentOfTarget(intake, target);
            return (
              <div key={n.key} className="field" style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 10 }}>
                <span className="muted">{n.label}</span>
                <strong style={{ fontSize: '1.4rem' }}>{pct}%</strong>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {round(intake)}/{target}
                  {n.unit}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="stack">
        <Link
          className="btn btn-primary"
          to="/record?mode=ocr"
          style={{ textAlign: 'center' }}
        >
          栄養成分表示を読み取る
        </Link>
        <Link className="btn btn-secondary" to="/record" style={{ textAlign: 'center' }}>
          食事を入力して推測
        </Link>
        <Link
          className="btn btn-secondary"
          to="/record?mode=manual"
          style={{ textAlign: 'center' }}
        >
          数値を手入力
        </Link>
      </div>

      {advice.length > 0 && (
        <Link to="/advice" className="alert warning" style={{ display: 'block' }}>
          <strong>不足栄養素の提案が {advice.length} 件</strong>
          <div>{advice[0].title} ほか</div>
        </Link>
      )}

      <section className="card">
        <h2>今日の記録</h2>
        {todayMeals.length === 0 ? (
          <p className="muted">まだ記録がありません。</p>
        ) : (
          todayMeals.map((meal) => (
            <div key={meal.id} className="meal-row">
              <div style={{ flex: 1 }}>
                <strong>{meal.displayName}</strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {MEAL_SLOT_LABEL[meal.mealSlot]} ・ {formatTime(meal.loggedAt)} ・{' '}
                  {Math.round(meal.nutrients.energy_kcal)} kcal
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  タンパク質 {Math.round(meal.nutrients.protein_g * 10) / 10}g / 炭水化物{' '}
                  {Math.round(meal.nutrients.carb_g * 10) / 10}g
                </div>
              </div>
              <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  data-testid={`delete-meal-${meal.id}`}
                  onClick={() => {
                    if (confirm(`「${meal.displayName}」を削除しますか？`)) {
                      deleteMeal(meal.id);
                    }
                  }}
                >
                  削除
                </button>
                {meal.inputMethod === 'ocr_label' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    data-testid={`retake-meal-${meal.id}`}
                    onClick={() => {
                      if (
                        confirm(
                          `「${meal.displayName}」を削除して再撮影しますか？`,
                        )
                      ) {
                        deleteMeal(meal.id);
                        navigate('/record?mode=ocr');
                      }
                    }}
                  >
                    再撮影
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
