import { Link } from 'react-router-dom';
import { CameraPermissionPanel } from '../components/CameraPermissionPanel';
import { InstallAppPanel } from '../components/InstallAppPanel';
import { formatTime, todayKey } from '../lib/date';
import {
  ACTIVITY_LABELS,
  DRI_SOURCE,
  GOAL_LABELS,
  SEX_LABELS,
} from '../lib/targets';
import { MEXT_FOOD_SOURCE } from '../lib/foodDatabase';
import { useApp } from '../store/AppContext';

const MEAL_SLOT_LABEL = {
  breakfast: '朝',
  lunch: '昼',
  dinner: '夜',
  snack: '間食',
} as const;

const INPUT_LABEL = {
  ocr_label: 'ラベル読取',
  text: 'テキスト推測',
  manual: '手入力',
} as const;

export function SettingsPage() {
  const { profile, targets, clearAll, meals, deleteMeal } = useApp();

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          設定
        </h1>
        <p className="muted">目標の再計算やデータの管理を行います。</p>
      </header>

      <InstallAppPanel />

      <section className="card">
        <h2>カメラ設定</h2>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          栄養成分表示の読み取りに使うカメラの許可状態を確認・変更できます。
        </p>
        <CameraPermissionPanel />
      </section>

      {profile && targets ? (
        <section className="card">
          <h2>プロフィール</h2>
          <p>
            {profile.displayName} / {profile.age}歳 / {SEX_LABELS[profile.sex]}
          </p>
          <p>
            {profile.heightCm} cm ・ {profile.weightKg} kg
          </p>
          <p>活動量: {ACTIVITY_LABELS[profile.activityLevel]}</p>
          <p>目標: {GOAL_LABELS[profile.goalType]}</p>

          <h3 style={{ marginTop: 8 }}>1日の目安</h3>
          <p>{targets.energy_kcal} kcal</p>
          <p>
            タンパク質 {targets.protein_g}g / 脂質 {targets.fat_g}g / 炭水化物{' '}
            {targets.carb_g}g
          </p>
          <p>
            食塩 {targets.salt_g}g ・ 食物繊維 {targets.fiber_g}g
          </p>
          <p>
            ビタミンC {targets.vitamin_c_mg}mg ・ カルシウム {targets.calcium_mg}
            mg ・ 鉄 {targets.iron_mg}mg
          </p>

          <h3 style={{ marginTop: 16 }}>目安の根拠</h3>
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
            {DRI_SOURCE.publisher}
            「
            <a href={DRI_SOURCE.url} target="_blank" rel="noreferrer">
              {DRI_SOURCE.name}
            </a>
            」（{DRI_SOURCE.period}）に基づく簡易目安です。基準が改定されたときはアプリ側の目安も更新します。医療上の指示がある場合はそれに従ってください。
          </p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            テキスト推測の食品データは
            {MEXT_FOOD_SOURCE.publisher}
            「
            <a href={MEXT_FOOD_SOURCE.url} target="_blank" rel="noreferrer">
              {MEXT_FOOD_SOURCE.name}
            </a>
            」の収載{MEXT_FOOD_SOURCE.foodCount}食品（可食部100g/100ml）に、料理1食分の概算を加えたものです。
          </p>

          <Link className="btn btn-primary" to="/onboarding" style={{ textAlign: 'center' }}>
            プロフィールを編集・再計算
          </Link>
        </section>
      ) : (
        <p className="muted">プロフィール未設定です。</p>
      )}

      <section className="card" data-testid="settings-data">
        <h2>データ</h2>
        <p>保存済みの食事記録: {meals.length} 件</p>

        {meals.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            削除できる食事記録はありません。
          </p>
        ) : (
          <div className="stack" style={{ gap: 8 }} data-testid="settings-meal-list">
            {meals.map((meal) => (
              <div key={meal.id} className="meal-row" data-testid="settings-meal-row">
                <div>
                  <strong>{meal.displayName}</strong>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {todayKey(new Date(meal.loggedAt))} ・{' '}
                    {MEAL_SLOT_LABEL[meal.mealSlot]} ・ {formatTime(meal.loggedAt)} ・{' '}
                    {INPUT_LABEL[meal.inputMethod]}
                  </div>
                </div>
                <div className="row">
                  <span className="muted">
                    {Math.round(meal.nutrients.energy_kcal)} kcal
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    data-testid="settings-delete-meal"
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
          </div>
        )}

        <button
          type="button"
          className="btn btn-danger"
          style={{ marginTop: 12 }}
          data-testid="settings-clear-all"
          onClick={() => {
            if (confirm('プロフィールとすべての食事記録を削除しますか？')) {
              clearAll();
            }
          }}
        >
          すべてのデータを削除
        </button>
      </section>
    </div>
  );
}
