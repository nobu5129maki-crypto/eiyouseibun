# Eiyo Balance（栄養バランス管理）

過剰摂取を防ぎ、1日の栄養バランスを管理する Web アプリです。  
**ブラウザで動作**するため、Expo Go は不要です。

- GitHub: https://github.com/nobu5129maki-crypto/eiyouseibun
- 本番: https://eiyouseibun.vercel.app

修正のたびに GitHub push と Vercel 本番デプロイを行います。

## スマホへのインストール（PWA）

本番サイトをスマホのブラウザで開き、ホーム画面に追加できます。

- **Android（Chrome など）**: メニュー →「アプリをインストール」／設定画面の「インストール」ボタン
- **iPhone（Safari）**: 共有 →「ホーム画面に追加」

アプリアイコンは `public/icons/`（`icon.png` / `icon-512.png` など）です。

## 方針

- 食事そのものの**写真撮影によるカロリー測定は行わない**
- **パッケージの栄養成分表示**はカメラ / 画像選択で読み取り可能
- **入力した食事内容（テキスト）**から、タンパク質・脂質・炭水化物などを概算
- 数値は保存前に確認・手修正できる

## 機能

- プロフィールから 1 日の摂取目安を自動算出
- ホームのプログレスバー（超過時は警告色）
- 栄養成分表示のカメラ読取（Tesseract.js による実OCR）
- テキスト入力による栄養素推測 / 手入力記録
- 履歴・不足栄養アドバイス・設定

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` が開きます。

```bash
npm run build    # 本番ビルド
npm run preview  # ビルド結果の確認
```

## 主要ディレクトリ

```
src/
  pages/        画面
  components/   UI部品
  lib/          目標算出・テキスト推測・アドバイス
  store/        localStorage 永続化
```
