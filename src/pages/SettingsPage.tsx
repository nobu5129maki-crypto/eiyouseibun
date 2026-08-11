import { Link } from 'react-router-dom';
import { CameraPermissionPanel } from '../components/CameraPermissionPanel';
import {
  ACTIVITY_LABELS,
  DRI_SOURCE,
  GOAL_LABELS,
  SEX_LABELS,
} from '../lib/targets';
import { useApp } from '../store/AppContext';

export function SettingsPage() {
  const { profile, targets, clearAll, meals } = useApp();

  return (
    <div className="stack">
      <header>
        <h1 className="brand" style={{ fontSize: '1.7rem' }}>
          設定
        </h1>
        <p className="muted">目標の再計算やデータの管理を行います。</p>
      </header>

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

          <Link className="btn btn-primary" to="/onboarding" style={{ textAlign: 'center' }}>
            プロフィールを編集・再計算
          </Link>
        </section>
      ) : (
        <p className="muted">プロフィール未設定です。</p>
      )}

      <section className="card">
        <h2>データ</h2>
        <p>保存済みの食事記録: {meals.length} 件</p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          データはこのブラウザの localStorage に保存されます。食事写真の推定は行わず、栄養成分表示の読取のみ画像を使います。
        </p>
        <button
          type="button"
          className="btn btn-danger"
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
