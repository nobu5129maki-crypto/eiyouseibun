/**
 * OCR読み取り後にカロリー等の結果表示が出ることを Playwright で検証
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4173';

const pageSrc = fs.readFileSync(path.join(root, 'src/pages/RecordPage.tsx'), 'utf8');
const ocrSrc = fs.readFileSync(path.join(root, 'src/lib/labelOcr.ts'), 'utf8');
assert.match(pageSrc, /ocr-result-summary/);
assert.match(pageSrc, /ocr-error/);
assert.match(pageSrc, /読み取り結果/);
assert.doesNotMatch(pageSrc, /OCR 生テキスト/);
assert.match(ocrSrc, /hits < 2/);
assert.match(ocrSrc, /adaptive/);
assert.match(ocrSrc, /scoreParsedNutrition/);

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

let previewProc = null;
async function ensurePreview() {
  if (process.env.APP_URL) return;
  try {
    const res = await fetch(BASE);
    if (res.ok) return;
  } catch {
    /* start below */
  }
  previewProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: root,
    shell: true,
    stdio: 'pipe',
  });
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) {
        await new Promise((r) => setTimeout(r, 300));
        return;
      }
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

await ensurePreview();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.addInitScript((state) => {
  localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  window.__TEST_OCR_RESULT__ = {
    productName: '表示検証ラベル',
    servingLabel: '1袋当たり',
    nutrients: {
      energy_kcal: 203,
      protein_g: 7.0,
      fat_g: 9.4,
      carb_g: 22.5,
      salt_g: 1.9,
      fiber_g: 2.1,
    },
    rawText: 'エネルギー 203kcal\nたんぱく質 7.0g',
    confidence: 0.88,
  };
}, profileState);

await page.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'networkidle' });

const buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
await page.getByTestId('gallery-file-input').setInputFiles({
  name: 'label.png',
  mimeType: 'image/png',
  buffer,
});

await page.getByTestId('ocr-result-summary').waitFor({ state: 'visible', timeout: 15000 });
const energyText = await page.getByTestId('ocr-energy').innerText();
assert.match(energyText.replace(/\s/g, ''), /203/);
assert.match(await page.getByTestId('ocr-protein').innerText(), /7/);
assert.match(await page.getByTestId('ocr-fat').innerText(), /9\.4/);
assert.match(await page.getByTestId('ocr-carb').innerText(), /22\.5/);
assert.match(await page.getByTestId('ocr-salt').innerText(), /1\.9/);
assert.equal(await page.locator('#energy_kcal').inputValue(), '203');
assert.equal(await page.locator('#protein_g').inputValue(), '7');

// 失敗時は ocr-error が見える（結果フォームは出ない）
const failPage = await browser.newPage();
await failPage.addInitScript((state) => {
  localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  Object.defineProperty(window, '__TEST_OCR_RESULT__', {
    configurable: true,
    get() {
      throw new Error('検証用: 読み取り失敗');
    },
  });
}, profileState);
await failPage.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'networkidle' });
await failPage.getByTestId('gallery-file-input').setInputFiles({
  name: 'label2.png',
  mimeType: 'image/png',
  buffer,
});
await failPage.getByTestId('ocr-error').waitFor({ state: 'visible', timeout: 15000 });
const errText = await failPage.getByTestId('ocr-error').innerText();
assert.match(errText, /読み取り失敗|読み取れ|失敗/);
assert.equal(await failPage.getByTestId('ocr-result-summary').count(), 0);
await failPage.close();

await browser.close();
if (previewProc) previewProc.kill('SIGTERM');

console.log(
  JSON.stringify(
    {
      ok: true,
      energyShown: energyText.trim(),
      errorVisibleOnFailure: true,
    },
    null,
    2,
  ),
);
