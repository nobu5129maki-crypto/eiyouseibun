import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackupPanel } from '../components/BackupPanel';
import {
  ACTIVITY_LABELS,
  DRI_SOURCE,
  GOAL_LABELS,
  SEX_LABELS,
  calculateDailyTargets,
} from '../lib/targets';
import { useApp } from '../store/AppContext';
import type { ActivityLevel, GoalType, Sex } from '../types';

export function OnboardingPage() {
  const { saveProfile, profile, targets, meals, restoreAll } = useApp();
  const navigate = useNavigate();
  const isEditing = Boolean(profile);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [age, setAge] = useState(String(profile?.age ?? 30));
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [heightCm, setHeightCm] = useState(String(profile?.heightCm ?? 160));
  const [weightKg, setWeightKg] = useState(String(profile?.weightKg ?? 55));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'light',
  );
  const [goalType, setGoalType] = useState<GoalType>(
    profile?.goalType ?? 'maintain',
  );
  const [preview, setPreview] = useState(
    profile ? calculateDailyTargets(profile) : null,
  );
  const [error, setError] = useState('');

  const buildProfile = () => {
    const ageN = Number(age);
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!displayName.trim()) {
      setError('表示名を入力してください');
      return null;
    }
    if (![ageN, h, w].every((n) => Number.isFinite(n) && n > 0)) {
      setError('年齢・身長・体重は正の数値で入力してください');
      return null;
    }
    setError('');
    return {
      displayName: displayName.trim(),
      age: ageN,
      sex,
      heightCm: h,
      weightKg: w,
      activityLevel,
      goalType,
    };
  };

  const onPreview = () => {
    const next = buildProfile();
    if (!next) return;
    setPreview(calculateDailyTargets(next));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = buildProfile();
    if (!next) return;
    saveProfile(next);
    navigate('/');
  };

  return (
    <div className="stack">
      <header>
        <p className="brand">Eiyo Balance</p>
        <p className="muted">
          年齢・体格・活動量から 1 日の栄養摂取目安を自動設定します（
          {DRI_SOURCE.name} 等に基づく簡易目安）。
        </p>
      </header>

      {!isEditing ? (
        <BackupPanel
          state={{ profile, targets, meals }}
          restoreAll={restoreAll}
          showExport={false}
          onRestored={(next) => {
            if (next.profile) navigate('/');
          }}
        />
      ) : null}

      <form className="card stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="name">表示名</label>
          <input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: たろう"
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="age">年齢</label>
            <input
              id="age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="field">
            <label>性別</label>
            <div className="row">
              {(Object.keys(SEX_LABELS) as Sex[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`chip ${sex === key ? 'active' : ''}`}
                  onClick={() => setSex(key)}
                >
                  {SEX_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="height">身長 (cm)</label>
            <input
              id="height"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="weight">体重 (kg)</label>
            <input
              id="weight"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>活動量</label>
          <div className="row">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`chip ${activityLevel === key ? 'active' : ''}`}
                onClick={() => setActivityLevel(key)}
              >
                {ACTIVITY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>目標</label>
          <div className="row">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`chip ${goalType === key ? 'active' : ''}`}
                onClick={() => setGoalType(key)}
              >
                {GOAL_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert danger">{error}</div>}

        {preview && (
          <div className="alert ok">
            <strong>1日の摂取目安</strong>
            <div>
              エネルギー {preview.energy_kcal} kcal / タンパク質{' '}
              {preview.protein_g}g / 脂質 {preview.fat_g}g / 炭水化物{' '}
              {preview.carb_g}g
            </div>
            <div>
              食塩 {preview.salt_g}g ・ 食物繊維 {preview.fiber_g}g
            </div>
            <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
              根拠の詳細は設定画面に記載しています。
            </div>
          </div>
        )}

        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={onPreview}>
            目安を計算
          </button>
          <button type="submit" className="btn btn-primary">
            {isEditing ? '保存して戻る' : 'はじめる'}
          </button>
        </div>
      </form>
    </div>
  );
}
