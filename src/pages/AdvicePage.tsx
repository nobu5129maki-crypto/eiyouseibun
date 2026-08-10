import { useApp } from '../store/AppContext';

export function AdvicePage() {
  const { advice, targets } = useApp();

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          不足栄養の提案
        </h1>
        <p className="muted">
          今日の記録から不足しがちな栄養素を検出し、食品例を提示します。
        </p>
      </header>

      {!targets && <p className="muted">先にプロフィールを設定してください。</p>}

      {targets && advice.length === 0 && (
        <div className="alert ok">
          <strong>大きな不足は見当たりません</strong>
          <div>
            引き続きバランスを意識して記録を続けましょう。食物繊維と発酵食品も意識するとより安心です。
          </div>
        </div>
      )}

      {advice.map((item, index) => (
        <section
          key={`${item.nutrientKey}-${index}`}
          className={`card ${item.severity === 'warning' ? 'alert warning' : ''}`}
        >
          <h2>{item.title}</h2>
          <p className="muted">{item.message}</p>
          <div>
            <strong style={{ fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
              おすすめの食品
            </strong>
            <div style={{ marginTop: 8 }}>
              {item.suggestions.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
