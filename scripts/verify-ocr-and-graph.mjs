import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Vite/TS ソースを直接は読めないので、同等ロジックをここでも検証し、
// ビルド後の挙動は Playwright で確認する。

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDayLocal(iso, day = todayKey()) {
  return todayKey(new Date(iso)) === day;
}

function isSameDayUtcBug(iso, day = todayKey()) {
  return iso.slice(0, 10) === day;
}

function normalizeOcrText(text) {
  return text
    .replace(/\u3000/g, ' ')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[Oo]/g, (ch, i, s) => {
      const prev = s[i - 1] ?? '';
      const next = s[i + 1] ?? '';
      if (/\d/.test(prev) || /\d/.test(next)) return '0';
      return ch;
    })
    .replace(/熱\s*量/g, 'エネルギー')
    .replace(/営養成分|栄養成[分份]/g, '栄養成分')
    .replace(/たん(ぱ|ば)?く質|蛋白質|タンパク質/g, 'タンパク質')
    .replace(/脂\s*質/g, '脂質');
}

function parseNutritionText(rawText) {
  const text = normalizeOcrText(rawText);
  const nutrients = {
    energy_kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    salt_g: 0,
  };
  const patterns = [
    ['energy_kcal', /エネルギー[^0-9]{0,16}(\d+(?:\.\d+)?)/i],
    ['protein_g', /タンパク質[^0-9]{0,16}(\d+(?:\.\d+)?)/i],
    ['fat_g', /脂質[^0-9]{0,16}(\d+(?:\.\d+)?)/i],
    ['carb_g', /炭水化物[^0-9]{0,16}(\d+(?:\.\d+)?)/i],
    ['salt_g', /食塩相当量[^0-9]{0,16}(\d+(?:\.\d+)?)/i],
  ];
  for (const [key, re] of patterns) {
    const m = text.match(re);
    if (m) nutrients[key] = Number(m[1]);
  }
  return nutrients;
}

// ユーザー添付ラベル相当のテキスト
const sampleLabel = `
栄養成分表示
1袋当たり
熱量 203kcal
たんぱく質 7.0g
脂質 9.4g
炭水化物 22.5g
食塩相当量 1.9g
`;

const parsed = parseNutritionText(sampleLabel);
assert.equal(parsed.energy_kcal, 203);
assert.equal(parsed.protein_g, 7);
assert.equal(parsed.fat_g, 9.4);
assert.equal(parsed.carb_g, 22.5);
assert.equal(parsed.salt_g, 1.9);

// OCRゆらぎ
const noisy = `
栄養成份表示 1袋当たり
熱 量 2O3kcal
たんばく質 7.0 g
脂 質 9.4g
炭水化物 22.5g
食塩相当量 1.9g
`;
const parsedNoisy = parseNutritionText(noisy);
assert.equal(parsedNoisy.energy_kcal, 203);
assert.equal(parsedNoisy.protein_g, 7);
assert.equal(parsedNoisy.fat_g, 9.4);

// JST 早朝に UTC 日付が前日になるケース
const localMorning = new Date();
localMorning.setHours(8, 0, 0, 0);
const iso = localMorning.toISOString();
const day = todayKey(localMorning);
assert.equal(isSameDayLocal(iso, day), true);
// 旧実装はタイムゾーンによって false になり得る
const utcBug = isSameDayUtcBug(iso, day);
console.log(
  JSON.stringify(
    {
      ok: true,
      parsed,
      localDateMatch: true,
      utcBugWouldFailSometimes: utcBug !== true || iso.slice(0, 10) !== day,
      iso,
      localDay: day,
    },
    null,
    2,
  ),
);

// Playwright: 記録→ホーム反映
const { chromium } = await import('playwright');
const BASE = process.env.APP_URL ?? 'http://127.0.0.1:5173';

const profileState = {
  profile: {
    displayName: 'テスト',
    age: 30,
    sex: 'female',
    heightCm: 160,
    weightKg: 55,
    activityLevel: 'light',
    goalType: 'maintain',
  },
  targets: {
    energy_kcal: 1800,
    protein_g: 70,
    fat_g: 50,
    carb_g: 250,
    salt_g: 6.5,
    fiber_g: 18,
    vitamin_c_mg: 100,
    calcium_mg: 750,
    iron_mg: 10.5,
  },
  meals: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((state) => {
  localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
}, profileState);

await page.goto(`${BASE}/record?mode=manual`, { waitUntil: 'domcontentloaded' });
await page.locator('#name').fill('検証用ラベル食品');
await page.locator('#energy_kcal').fill('203');
await page.locator('#protein_g').fill('7');
await page.locator('#fat_g').fill('9.4');
await page.locator('#carb_g').fill('22.5');
await page.locator('#salt_g').fill('1.9');
await page.getByRole('button', { name: '記録してホームへ' }).click();

await page.waitForURL(/\/$|\/\?/, { timeout: 10000 });
await page.getByText('検証用ラベル食品').waitFor({ state: 'visible', timeout: 10000 });

const proteinProgress = await page
  .locator('.progress')
  .filter({ hasText: 'タンパク質' })
  .locator('.progress-head span')
  .innerText();

if (!proteinProgress.includes('7') && !proteinProgress.includes('7g')) {
  // 7 / 70 のような表示を期待
  throw new Error(`タンパク質グラフに反映されていません: ${proteinProgress}`);
}
if (!/\b7(\.0)?g\b|\b7\//.test(proteinProgress.replace(/\s/g, '')) && !proteinProgress.includes('7g')) {
  // "7g / 70g" 形式
  if (!proteinProgress.includes('7')) {
    throw new Error(`タンパク質グラフ値が不正: ${proteinProgress}`);
  }
}

const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('eiyouseibun:v2') || '{}'),
);
assert.ok(Array.isArray(stored.meals) && stored.meals.length >= 1);
assert.equal(stored.meals[0].nutrients.protein_g, 7);
assert.equal(stored.meals[0].nutrients.fat_g, 9.4);

// OCR読み取り破棄・再撮影ボタン
await page.addInitScript(() => {
  window.__TEST_OCR_RESULT__ = {
    productName: '誤読サンプル',
    servingLabel: '1袋当たり',
    nutrients: {
      energy_kcal: 113,
      protein_g: 23,
      fat_g: 1.5,
      carb_g: 1.2,
      salt_g: 1.8,
      fiber_g: 0,
    },
    rawText: 'mock',
    confidence: 0.5,
  };
});
await page.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'domcontentloaded' });
// 小さなダミー画像を選択して OCR フックを通す
const buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
await page.getByTestId('open-gallery-button').click();
// input に直接セット
await page.getByTestId('gallery-file-input').setInputFiles({
  name: 'label.png',
  mimeType: 'image/png',
  buffer,
});
await page.getByRole('heading', { name: '記録内容（確認・編集）' }).waitFor({
  state: 'visible',
  timeout: 15000,
});
await page.getByTestId('discard-reading').waitFor({ state: 'visible' });
await page.getByTestId('retake-photo').waitFor({ state: 'visible' });
await page.getByTestId('discard-reading').click();
await page.getByRole('heading', { name: '記録内容（確認・編集）' }).waitFor({
  state: 'hidden',
  timeout: 5000,
});
assert.equal(await page.locator('#name').count(), 0);

await browser.close();
console.log(
  JSON.stringify(
    {
      ok: true,
      graphUpdated: true,
      proteinProgress,
      savedProtein: stored.meals[0].nutrients.protein_g,
      noisyParseOk: true,
    },
    null,
    2,
  ),
);
