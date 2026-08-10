import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CameraCapture } from '../components/CameraCapture';
import { CameraPermissionPanel } from '../components/CameraPermissionPanel';
import { parseNutritionLabelImage } from '../lib/labelOcr';
import { estimateMealFromText } from '../lib/mealEstimate';
import {
  PRIMARY_NUTRIENTS,
  getTargetValue,
  percentOfTarget,
} from '../lib/nutrition';
import { useApp } from '../store/AppContext';
import type { InputMethod, MealSlot, NutrientValues } from '../types';

const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: '朝' },
  { key: 'lunch', label: '昼' },
  { key: 'dinner', label: '夜' },
  { key: 'snack', label: '間食' },
];

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

function guessSlot(): MealSlot {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

type Mode = 'text' | 'manual' | 'ocr';

export function RecordPage() {
  const [params] = useSearchParams();
  const modeParam = params.get('mode');
  const mode: Mode =
    modeParam === 'manual' ? 'manual' : modeParam === 'ocr' ? 'ocr' : 'text';
  const navigate = useNavigate();
  const { targets, addMeal } = useApp();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [mealText, setMealText] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mealSlot, setMealSlot] = useState<MealSlot>(guessSlot());
  const [nutrients, setNutrients] = useState<NutrientValues>({ ...EMPTY });
  const [note, setNote] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [rawText, setRawText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState<InputMethod>(
    mode === 'manual' ? 'manual' : mode === 'ocr' ? 'ocr_label' : 'text',
  );
  const [readyToEdit, setReadyToEdit] = useState(mode === 'manual');

  const title =
    mode === 'ocr'
      ? '栄養成分表示を読み取る'
      : mode === 'manual'
        ? '数値を手入力'
        : '食事を入力して推測';

  const subtitle =
    mode === 'ocr'
      ? 'パッケージの栄養成分表示をカメラまたは画像で読み取ります。食事そのものの写真は使いません。'
      : mode === 'manual'
        ? 'わかっている数値をそのまま記録します。'
        : '食べた内容を文字で入力し、タンパク質などを概算します。';

  const pctPreview = useMemo(() => {
    if (!targets) return [];
    return PRIMARY_NUTRIENTS.filter((n) => n.key !== 'energy_kcal').map((n) => {
      const pct = percentOfTarget(
        nutrients[n.key] ?? 0,
        getTargetValue(targets, n.key),
      );
      return { ...n, pct };
    });
  }, [nutrients, targets]);

  const setField = (key: keyof NutrientValues, value: string) => {
    const n = Number(value);
    setNutrients((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? n : 0,
    }));
  };

  const onEstimate = () => {
    const result = estimateMealFromText(mealText);
    if (!result.displayName && result.confidence === 0) {
      setError(result.note);
      return;
    }
    setError('');
    setDisplayName(result.displayName || mealText.trim());
    setNutrients({ ...EMPTY, ...result.nutrients });
    setConfidence(result.confidence);
    setMatched(result.matchedKeywords);
    setNote(result.note);
    setRawText('');
    setInputMethod('text');
    setReadyToEdit(true);
  };

  const onLabelImage = async (file: File | undefined) => {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setLoading(true);
    setError('');
    try {
      const parsed = await parseNutritionLabelImage(file);
      setDisplayName(parsed.productName);
      setNutrients({ ...EMPTY, ...parsed.nutrients });
      setConfidence(parsed.confidence);
      setMatched([]);
      setRawText(parsed.rawText);
      setNote(parsed.servingLabel);
      setInputMethod('ocr_label');
      setReadyToEdit(true);
    } catch {
      setError('栄養成分表示の読み取りに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('食品名を入力してください');
      return;
    }
    if (
      nutrients.protein_g + nutrients.fat_g + nutrients.carb_g + nutrients.energy_kcal <=
      0
    ) {
      setError('栄養素を入力または読み取ってください');
      return;
    }
    addMeal({
      displayName: displayName.trim(),
      mealSlot,
      inputMethod,
      note: note || undefined,
      nutrients,
    });
    navigate('/');
  };

  return (
    <div className="stack">
      <header>
        <p className="muted">
          <Link to="/">← ホーム</Link>
        </p>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          {title}
        </h1>
        <p className="muted">{subtitle}</p>
      </header>

      {mode === 'text' && (
        <section className="card">
          <h2>何を食べましたか？</h2>
          <div className="field">
            <label htmlFor="meal">食事内容</label>
            <textarea
              id="meal"
              value={mealText}
              onChange={(e) => setMealText(e.target.value)}
              placeholder="例: 親子丼と味噌汁、サラダチキンとご飯、ラーメン大盛"
            />
          </div>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            「大盛」「小盛」などの分量表現にも対応します。
          </p>
          <button type="button" className="btn btn-primary" onClick={onEstimate}>
            栄養素を推測
          </button>
        </section>
      )}

      {mode === 'ocr' && (
        <section className="card">
          <h2>栄養成分表示を撮影</h2>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            「カメラで撮影」は端末カメラを直接起動します（ファイル選択ではありません）。
            先にカメラ許可の状態を確認・設定してから撮影してください。
            MVP では OCR API の代わりにサンプル解析を返します。
          </p>

          <CameraPermissionPanel compact />

          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => {
                setError('');
                setCameraOpen(true);
              }}
            >
              カメラで撮影
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => galleryInputRef.current?.click()}
            >
              画像を選択
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void onLabelImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {loading && <p className="muted">読み取り中…</p>}
          {imagePreview && (
            <img
              src={imagePreview}
              alt="栄養成分表示のプレビュー"
              className="label-preview"
            />
          )}
          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => {
              setCameraOpen(false);
              void onLabelImage(file);
            }}
          />
        </section>
      )}

      {readyToEdit && (
        <form className="card stack" onSubmit={onSubmit}>
          <h2>記録内容（確認・編集）</h2>

          <div className="field">
            <label htmlFor="name">食品名</label>
            <input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>食事区分</label>
            <div className="row">
              {SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`chip ${mealSlot === s.key ? 'active' : ''}`}
                  onClick={() => setMealSlot(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {(
            [
              ['energy_kcal', 'エネルギー (kcal)'],
              ['protein_g', 'タンパク質 (g)'],
              ['fat_g', '脂質 (g)'],
              ['carb_g', '炭水化物 (g)'],
              ['salt_g', '食塩相当量 (g)'],
              ['fiber_g', '食物繊維 (g)'],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                inputMode="decimal"
                value={String(nutrients[key] ?? 0)}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}

          {confidence != null && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              {inputMethod === 'ocr_label' ? '読取' : '推測'}信頼度{' '}
              {(confidence * 100).toFixed(0)}%
              {matched.length > 0 ? `（一致: ${matched.join('・')}）` : ''}
              {confidence < 0.7 ? '（要確認）' : ''}
            </p>
          )}

          {note && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              {note}
            </p>
          )}

          {rawText && (
            <div className="raw-box">
              <strong style={{ fontSize: '0.8rem' }}>OCR 生テキスト</strong>
              <pre>{rawText}</pre>
            </div>
          )}

          {pctPreview.length > 0 && (
            <div className="alert ok">
              <strong>1日目安に対する割合</strong>
              {pctPreview.map((p) => (
                <div key={p.key} className={p.pct >= 100 ? 'pct-over' : undefined}>
                  {p.label}: {p.pct}%
                </div>
              ))}
            </div>
          )}

          {error && <div className="alert danger">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            記録してホームへ
          </button>
        </form>
      )}
    </div>
  );
}
