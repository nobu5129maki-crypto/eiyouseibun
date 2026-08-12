/**
 * テキスト推測フローと小数入力の回帰テスト
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
assert.match(pageSrc, /estimate-button/);
assert.match(pageSrc, /resultFocusKey/);
assert.match(pageSrc, /isNutrientDraftText/);
assert.match(pageSrc, /辞書になくても確認フォーム/);

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

function killPreview() {
  if (!previewProc?.pid) return;
  try {
    process.kill(-previewProc.pid, 'SIGKILL');
  } catch {
    try {
      previewProc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
  previewProc = null;
}

await ensurePreview();
const browser = await chromium.launch({ headless: true });

async function withProfilePage(run) {
  const page = await browser.newPage();
  await page.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  }, profileState);
  try {
    await run(page);
  } finally {
    await page.close();
  }
}

// 1) 追加した一品料理で推測 → 確認フォームが進む
await withProfilePage(async (page) => {
  await page.goto(`${BASE}/record`, { waitUntil: 'networkidle' });
  await page.locator('#meal').fill('手羽先唐揚げ');
  await page.getByTestId('estimate-button').click();
  await page.getByTestId('record-confirm-form').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.locator('#name').inputValue(), '手羽先唐揚げ');
  assert.equal(await page.getByTestId('manual-field-protein_g').inputValue(), '28');
  assert.equal(await page.getByTestId('manual-field-energy_kcal').inputValue(), '380');
});

// 2) 筑前煮・照り焼きも単一マッチで進む
for (const [text, nameRe, kcal] of [
  ['筑前煮', /筑前煮/, '280'],
  ['照り焼き', /照り焼き/, '380'],
  ['手羽', /^手羽$/, '300'],
]) {
  await withProfilePage(async (page) => {
    await page.goto(`${BASE}/record`, { waitUntil: 'networkidle' });
    await page.locator('#meal').fill(text);
    await page.getByTestId('estimate-button').click();
    await page.getByTestId('record-confirm-form').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await page.locator('#name').inputValue(), nameRe);
    assert.equal(await page.getByTestId('manual-field-energy_kcal').inputValue(), kcal);
  });
}

// 3) 辞書にない場合でもフォームが開き、エラーが見える
await withProfilePage(async (page) => {
  await page.goto(`${BASE}/record`, { waitUntil: 'networkidle' });
  await page.locator('#meal').fill('存在しない謎フードXYZ');
  await page.getByTestId('estimate-button').click();
  await page.getByTestId('record-confirm-form').waitFor({ state: 'visible', timeout: 5000 });
  const err = page.locator('.alert.danger');
  await err.waitFor({ state: 'visible', timeout: 3000 });
  assert.match(await err.innerText(), /辞書にない|手入力/);
  assert.equal(await page.locator('#name').inputValue(), '存在しない謎フードXYZ');
});

// 4) 小数入力（タンパク質 0.5）
await withProfilePage(async (page) => {
  await page.goto(`${BASE}/record?mode=manual`, { waitUntil: 'networkidle' });
  await page.locator('#name').fill('小数テスト');
  const protein = page.getByTestId('manual-field-protein_g');
  await protein.click();
  await protein.pressSequentially('0.5', { delay: 40 });
  assert.equal(await protein.inputValue(), '0.5');

  const salt = page.getByTestId('manual-field-salt_g');
  await salt.click();
  await salt.pressSequentially('1.', { delay: 40 });
  assert.equal(await salt.inputValue(), '1.');
  await salt.pressSequentially('2', { delay: 40 });
  assert.equal(await salt.inputValue(), '1.2');

  await page.getByRole('button', { name: '記録してホームへ' }).click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
    timeout: 10000,
  });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eiyouseibun:v2')));
  const meal = saved.meals[0];
  assert.equal(meal.nutrients.protein_g, 0.5);
  assert.equal(meal.nutrients.salt_g, 1.2);
});

await browser.close();
killPreview();

console.log(
  JSON.stringify(
    {
      ok: true,
      estimateDishes: ['手羽先唐揚げ', '筑前煮', '照り焼き', '手羽'],
      unknownOpensForm: true,
      decimalInput: true,
    },
    null,
    2,
  ),
);
