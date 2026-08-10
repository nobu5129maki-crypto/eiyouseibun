import type { ProgressTone } from '../lib/nutrition';

type Props = {
  label: string;
  valueLabel: string;
  pct: number;
  tone: ProgressTone;
};

export function ProgressBar({ label, valueLabel, pct, tone }: Props) {
  const width = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="progress">
      <div className="progress-head">
        <strong>{label}</strong>
        <span className={tone === 'over' ? 'pct-over' : 'muted'}>
          {valueLabel}
          {tone === 'over' ? ' 超過' : ''}
        </span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
