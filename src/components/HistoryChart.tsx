import type { NutrientKey, NutrientValues } from '../types';

export type ChartPoint = {
  key: string;
  label: string;
  intake: NutrientValues;
};

type Props = {
  points: ChartPoint[];
  nutrientKey: NutrientKey;
  targetPerPeriod?: number;
  unit: string;
};

function valueOf(intake: NutrientValues, key: NutrientKey): number {
  return intake[key] ?? 0;
}

export function HistoryChart({
  points,
  nutrientKey,
  targetPerPeriod = 0,
  unit,
}: Props) {
  const values = points.map((p) => valueOf(p.intake, nutrientKey));
  const maxRaw = Math.max(...values, targetPerPeriod, 1);
  const max = maxRaw * 1.15;

  const width = 320;
  const height = 160;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const gap = 4;
  const barW = Math.max(6, (innerW - gap * (points.length - 1)) / points.length);

  const targetY =
    targetPerPeriod > 0
      ? padT + innerH - (targetPerPeriod / max) * innerH
      : null;

  const labelStep = points.length > 10 ? 2 : 1;

  return (
    <div className="history-chart" data-testid="history-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="摂取量の棒グラフ"
        className="history-chart-svg"
      >
        {targetY != null && (
          <g>
            <line
              x1={padL}
              x2={width - padR}
              y1={targetY}
              y2={targetY}
              className="history-chart-target"
            />
            <text
              x={width - padR}
              y={targetY - 4}
              textAnchor="end"
              className="history-chart-target-label"
            >
              目安
            </text>
          </g>
        )}

        {points.map((p, i) => {
          const v = values[i];
          const h = Math.max(0, (v / max) * innerH);
          const x = padL + i * (barW + gap);
          const y = padT + innerH - h;
          const over = targetPerPeriod > 0 && v > targetPerPeriod * 1.05;
          return (
            <g key={p.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                className={over ? 'history-bar over' : 'history-bar'}
              >
                <title>
                  {p.label}: {Math.round(v * 10) / 10}
                  {unit}
                </title>
              </rect>
              {i % labelStep === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="history-chart-xlabel"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="history-chart-legend muted">
        棒 = 期間合計 / 破線 = 目安（1日目標×日数）
      </div>
    </div>
  );
}
