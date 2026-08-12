/**
 * 手入力でタンパク質などの小数（0.5 など）を途中入力・保存できることを検証
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
assert.match(pageSrc, /isNutrientDraftText/);
assert.match(pageSrc, /parseNutrientDraft/);
assert.match(pageSrc, /nutrientDrafts/);
assert.ok(pageSrc.includes('/^\\d*\\.?\\d*$/'));

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
}, profileState);

await page.goto(`${BASE}/record?mode=manual`, { waitUntil: 'networkidle' });

await page.locator('#name').fill('プロテイン少量');

const protein = page.getByTestId('manual-field-protein_g');
await protein.click();
await protein.pressSequentially('0.5', { delay: 30 });
assert.equal(await protein.inputValue(), '0.5');

const salt = page.getByTestId('manual-field-salt_g');
await salt.click();
await salt.pressSequentially('1.2', { delay: 30 });
assert.equal(await salt.inputValue(), '1.2');

// 入力途中の「3.」が消えないこと
const fat = page.getByTestId('manual-field-fat_g');
await fat.click();
await fat.pressSequentially('3.', { delay: 30 });
assert.equal(await fat.inputValue(), '3.');
await fat.pressSequentially('4', { delay: 30 });
assert.equal(await fat.inputValue(), '3.4');

await page.getByRole('button', { name: '記録してホームへ' }).click();
await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', {
  timeout: 10000,
});

const saved = await page.evaluate(() => {
  const raw = localStorage.getItem('eiyouseibun:v2');
  return raw ? JSON.parse(raw) : null;
});
assert.ok(saved?.meals?.length >= 1);
const meal = saved.meals[saved.meals.length - 1];
assert.equal(meal.displayName, 'プロテイン少量');
assert.equal(meal.nutrients.protein_g, 0.5);
assert.equal(meal.nutrients.salt_g, 1.2);
assert.equal(meal.nutrients.fat_g, 3.4);

await browser.close();
if (previewProc) previewProc.kill('SIGTERM');

console.log(
  JSON.stringify(
    {
      ok: true,
      protein_g: meal.nutrients.protein_g,
      salt_g: meal.nutrients.salt_g,
      fat_g: meal.nutrients.fat_g,
    },
    null,
    2,
  ),
);
