/**
 * 履歴の日・週・月集計とグラフUIの回帰テスト
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4173';

const pageSrc = fs.readFileSync(path.join(root, 'src/pages/HistoryPage.tsx'), 'utf8');
const chartSrc = fs.readFileSync(
  path.join(root, 'src/components/HistoryChart.tsx'),
  'utf8',
);
assert.match(pageSrc, /history-range-tabs/);
assert.match(pageSrc, /HistoryChart/);
assert.match(pageSrc, /週別/);
assert.match(pageSrc, /月別/);
assert.match(chartSrc, /history-chart/);

const out = path.join(root, 'scripts', '.tmp-history.mjs');
execSync(
  'npx --yes esbuild src/lib/historyStats.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-history.mjs',
  { cwd: root, stdio: 'pipe' },
);
const stats = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

const meals = [
  {
    id: '1',
    loggedAt: '2026-08-10T01:00:00.000Z', // JST 8/10 10:00 approx depends TZ - use local construction
    mealSlot: 'lunch',
    inputMethod: 'manual',
    displayName: 'A',
    nutrients: {
      energy_kcal: 500,
      protein_g: 20,
      fat_g: 10,
      carb_g: 60,
      salt_g: 2,
    },
  },
  {
    id: '2',
    loggedAt: '2026-08-11T01:00:00.000Z',
    mealSlot: 'dinner',
    inputMethod: 'manual',
    displayName: 'B',
    nutrients: {
      energy_kcal: 700,
      protein_g: 30,
      fat_g: 20,
      carb_g: 70,
      salt_g: 3,
    },
  },
];

// Use explicit local dates via Date ctor in module
const localMeals = [
  {
    ...meals[0],
    loggedAt: new Date(2026, 7, 3, 12, 0, 0).toISOString(), // Mon Aug 3
  },
  {
    ...meals[1],
    loggedAt: new Date(2026, 7, 5, 12, 0, 0).toISOString(), // Wed Aug 5 same week
  },
  {
    id: '3',
    loggedAt: new Date(2026, 7, 12, 12, 0, 0).toISOString(), // next week
    mealSlot: 'lunch',
    inputMethod: 'manual',
    displayName: 'C',
    nutrients: {
      energy_kcal: 400,
      protein_g: 15,
      fat_g: 10,
      carb_g: 50,
      salt_g: 1,
    },
  },
  {
    id: '4',
    loggedAt: new Date(2026, 6, 20, 12, 0, 0).toISOString(), // July
    mealSlot: 'snack',
    inputMethod: 'manual',
    displayName: 'D',
    nutrients: {
      energy_kcal: 200,
      protein_g: 5,
      fat_g: 5,
      carb_g: 20,
      salt_g: 0.5,
    },
  },
];

const daily = stats.buildDailyBuckets(localMeals);
assert.ok(daily.length >= 3);
assert.equal(daily.find((b) => b.key === '2026-08-03').intake.energy_kcal, 500);

const weekly = stats.buildWeeklyBuckets(localMeals);
assert.ok(weekly.length >= 2);
const weekOfAug3 = weekly.find((b) => b.key === '2026-08-03');
assert.ok(weekOfAug3);
assert.equal(weekOfAug3.intake.energy_kcal, 1200); // 500+700
assert.equal(weekOfAug3.activeDays, 2);

const monthly = stats.buildMonthlyBuckets(localMeals);
const aug = monthly.find((b) => b.key === '2026-08');
const jul = monthly.find((b) => b.key === '2026-07');
assert.ok(aug && jul);
assert.equal(aug.intake.energy_kcal, 1600); // 500+700+400
assert.equal(jul.intake.energy_kcal, 200);

const daySeries = stats.buildChartSeries(localMeals, 'day', 5);
assert.equal(daySeries.length, 5);

// Playwright UI
let previewProc = null;
async function ensurePreview() {
  if (process.env.APP_URL) return;
  try {
    if ((await fetch(BASE)).ok) return;
  } catch {
    /* start */
  }
  previewProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: root,
    shell: true,
    stdio: 'pipe',
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview failed');
}

await ensurePreview();

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
  meals: localMeals,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((state) => {
  localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
}, profileState);
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
await page.getByTestId('history-chart').waitFor({ state: 'visible', timeout: 10000 });
await page.getByTestId('history-range-week').click();
await page.getByTestId('history-chart').waitFor({ state: 'visible' });
await page.getByText('の週').first().waitFor({ state: 'visible' });
await page.getByTestId('history-range-month').click();
await page.getByText('2026年8月').waitFor({ state: 'visible', timeout: 5000 });
await page.getByTestId('history-nutrient-select').selectOption('protein_g');
await browser.close();
if (previewProc) previewProc.kill('SIGTERM');

console.log(
  JSON.stringify(
    {
      ok: true,
      dailyBuckets: daily.length,
      weeklyEnergy: weekOfAug3.intake.energy_kcal,
      monthlyAug: aug.intake.energy_kcal,
      uiWeekMonthOk: true,
    },
    null,
    2,
  ),
);
