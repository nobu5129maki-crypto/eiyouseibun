import { useMemo, useState } from 'react';
import { HistoryChart } from '../components/HistoryChart';
import { formatTime, todayKey } from '../lib/date';
import {
  bucketsForRange,
  buildChartSeries,
  chartNutrientOptions,
  periodTarget,
  type HistoryRange,
} from '../lib/historyStats';
import {
  PRIMARY_NUTRIENTS,
  getIntakeValue,
  getTargetValue,
  percentOfTarget,
} from '../lib/nutrition';
import { useApp } from '../store/AppContext';
import type { NutrientKey } from '../types';

const MEAL_SLOT_LABEL = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夜',
  snack: '間食',
} as const;

const RANGE_OPTIONS: { key: HistoryRange; label: string }[] = [
  { key: 'day', label: '日別' },
  { key: 'week', label: '週別' },
  { key: 'month', label: '月別' },
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function HistoryPage() {
  const { meals, targets, deleteMeal } = useApp();
  const [range, setRange] = useState<HistoryRange>('day');
  const [nutrientKey, setNutrientKey] = useState<NutrientKey>('energy_kcal');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const buckets = useMemo(() => bucketsForRange(meals, range), [meals, range]);
  const chartPoints = useMemo(() => {
    const count = range === 'month' ? 6 : range === 'week' ? 8 : 14;
    return buildChartSeries(meals, range, count);
  }, [meals, range]);

  const nutrientOpts = chartNutrientOptions();
  const selectedNutrient =
    nutrientOpts.find((n) => n.key === nutrientKey) ?? nutrientOpts[0];

  const targetPerPeriod = useMemo(() => {
    if (!targets) return 0;
    if (range === 'day') return getTargetValue(targets, nutrientKey);
    if (range === 'week') return periodTarget(targets, nutrientKey, 7);
    // 月は平均30日換算の目安線
    return periodTarget(targets, nutrientKey, 30);
  }, [targets, nutrientKey, range]);

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          履歴
        </h1>
        <p className="muted">日・週・月の摂取サマリをグラフで確認できます。</p>
      </header>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>期間</h2>
        </div>
        <div className="row" data-testid="history-range-tabs">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`chip ${range === opt.key ? 'active' : ''}`}
              data-testid={`history-range-${opt.key}`}
              onClick={() => {
                setRange(opt.key);
                setExpandedKey(null);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="history-nutrient">グラフの栄養素</label>
          <select
            id="history-nutrient"
            data-testid="history-nutrient-select"
            value={nutrientKey}
            onChange={(e) => setNutrientKey(e.target.value as NutrientKey)}
          >
            {nutrientOpts.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {meals.length === 0 ? (
          <p className="muted">まだ履歴がありません。</p>
        ) : (
          <HistoryChart
            points={chartPoints}
            nutrientKey={nutrientKey}
            targetPerPeriod={targetPerPeriod}
            unit={selectedNutrient.unit}
          />
        )}
      </section>

      {buckets.length === 0 && meals.length > 0 && (
        <p className="muted">この期間の集計がありません。</p>
      )}

      {buckets.map((bucket) => {
        const periodDays = bucket.periodDays;
        const avgEnergy = bucket.activeDays
          ? bucket.intake.energy_kcal / bucket.activeDays
          : 0;
        const overLabels =
          targets == null
            ? []
            : PRIMARY_NUTRIENTS.filter((n) => {
                const target = periodTarget(targets, n.key, periodDays);
                const pct = percentOfTarget(
                  getIntakeValue(bucket.intake, n.key),
                  target,
                );
                return pct >= 100;
              }).map((n) => n.label);

        const open = expandedKey === bucket.key || range === 'day';

        return (
          <section key={bucket.key} className="card" data-testid="history-bucket">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>{bucket.label}</h2>
              <strong style={{ color: 'var(--accent)' }}>
                {Math.round(bucket.intake.energy_kcal)} kcal
              </strong>
            </div>

            {range !== 'day' && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                記録日 {bucket.activeDays}/{bucket.periodDays}日 ・ 記録日平均{' '}
                {Math.round(avgEnergy)} kcal
              </p>
            )}

            {targets && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                タンパク質 {Math.round(bucket.intake.protein_g)}/
                {Math.round(periodTarget(targets, 'protein_g', periodDays))}g ・
                脂質 {Math.round(bucket.intake.fat_g)}/
                {Math.round(periodTarget(targets, 'fat_g', periodDays))}g ・
                炭水化物 {Math.round(bucket.intake.carb_g)}/
                {Math.round(periodTarget(targets, 'carb_g', periodDays))}g ・
                食塩 {round1(bucket.intake.salt_g)}/
                {round1(periodTarget(targets, 'salt_g', periodDays))}g
                {range !== 'day' ? '（期間目安）' : ''}
              </p>
            )}

            {overLabels.length > 0 && (
              <p className="pct-over" style={{ fontSize: '0.85rem' }}>
                超過: {overLabels.join('・')}
              </p>
            )}

            {range !== 'day' && (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="history-toggle-meals"
                onClick={() =>
                  setExpandedKey((prev) => (prev === bucket.key ? null : bucket.key))
                }
              >
                {open ? '食事明細を閉じる' : `食事明細（${bucket.meals.length}件）`}
              </button>
            )}

            {open &&
              bucket.meals.map((meal) => (
                <div key={meal.id} className="meal-row">
                  <div>
                    <strong>{meal.displayName}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {range !== 'day' ? `${todayKey(new Date(meal.loggedAt))} ・ ` : ''}
                      {MEAL_SLOT_LABEL[meal.mealSlot]} ・ {formatTime(meal.loggedAt)} ・{' '}
                      {meal.inputMethod === 'ocr_label'
                        ? 'ラベル読取'
                        : meal.inputMethod === 'text'
                          ? 'テキスト推測'
                          : '手入力'}
                    </div>
                  </div>
                  <div className="row">
                    <span className="muted">
                      {Math.round(meal.nutrients.energy_kcal)}
                    </span>
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
