# Eiyo Balance

Vite + React の栄養バランス管理 Web アプリです。

## デプロイ方針（必須）

コードを修正したら、その都度必ず次を完了すること。

1. `git add` → `git commit`
2. `git push` で GitHub に反映
3. `vercel --prod` で Vercel 本番デプロイ

Expo Go は使わない。食事写真での推定は行わず、栄養成分表示のカメラ読取とテキスト推測を使う。

## 食事摂取基準の追従（必須）

1日の目安は厚生労働省「日本人の食事摂取基準」の最新版に合わせる。

- 準拠版・根拠: `src/lib/targets.ts` の `DRI_SOURCE` / `TARGET_BASIS_LINES`
- 改定チェック: `npm run check:dri`（厚労省ページの最新年版とアプリの editionYear を比較）
- 新年版や数値改定を検知したら、テーブル更新 → 検証 → GitHub push → Vercel 本番デプロイまで行う（先送りしない）
