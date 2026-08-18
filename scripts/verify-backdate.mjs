/**
 * 過去日の入力忘れ記録と日付クランプの回帰テスト
 */
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = process.env.BACKDATE_VERIFY_PORT ?? '4179';
const BASE = process.env.APP_URL ?? `http://127.0.0.1:${PORT}`;

const recordSrc = fs.readFileSync(path.join(root, 'src/pages/RecordPage.tsx'), 'utf8');
const historySrc = fs.readFileSync(path.join(root, 'src/pages/HistoryPage.tsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.tsx'), 'utf8');

assert.match(recordSrc, /data-testid="record-day"/);
assert.match(recordSrc, /loggedAtForDay/);
assert.match(recordSrc, /記録して履歴へ/);
assert.match(historySrc, /history-backfill-day/);
assert.match(historySrc, /history-backfill-go/);
assert.match(historySrc, /history-add-for-day/);
assert.match(settingsSrc, /履歴を含むすべての食事記録/);
assert.match(settingsSrc, /容量のために消す必要はありません/);

const out = path.join(root, 'scripts', '.tmp-date.mjs');
execSync(
  'npx --yes esbuild src/lib/date.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-date.mjs',
  { cwd: root, stdio: 'pipe' },
);
const dateLib = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

const now = new Date(2026, 7, 18, 20, 50, 0);
assert.equal(dateLib.todayKey(now), '2026-08-18');
assert.equal(dateLib.clampRecordDay('2026-08-17', now), '2026-08-17');
assert.equal(dateLib.clampRecordDay('2026-08-19', now), '2026-08-18');
assert.equal(dateLib.clampRecordDay('2020-01-01', now), dateLib.minRecordDay(now));
assert.equal(dateLib.clampRecordDay('not-a-date', now), '2026-08-18');
assert.equal(dateLib.isValidDayKey('2026-02-30'), false);
assert.equal(dateLib.isValidDayKey('2026-02-28'), true);

const iso = dateLib.isoFromLocalDay('2026-08-16', { hours: 19, minutes: 0 });
assert.equal(dateLib.todayKey(new Date(iso)), '2026-08-16');

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
  previewProc = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', `--port`, PORT],
    {
      cwd: root,
      shell: true,
      stdio: 'ignore',
      detached: true,
    },
  );
  previewProc.unref();
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
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(previewProc.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      process.kill(-previewProc.pid, 'SIGKILL');
    }
  } catch {
    try {
      previewProc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
  previewProc = null;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

await ensurePreview();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  }, profileState);

  const past = yesterdayKey();
  await page.goto(`${BASE}/record?mode=manual&date=${past}`, {
    waitUntil: 'networkidle',
  });
  assert.equal(await page.getByTestId('record-day').inputValue(), past);
  await page.locator('#name').fill('昨日の忘れ分');
  await page.getByTestId('manual-field-energy_kcal').fill('320');
  await page.getByTestId('manual-field-protein_g').fill('12');
  await page.getByRole('button', { name: '記録して履歴へ' }).click();
  await page.waitForURL((url) => url.pathname === '/history', { timeout: 5000 });
  await page.getByTestId('history-bucket').first().waitFor({ state: 'visible' });
  const body = await page.locator('body').innerText();
  assert.match(body, /昨日の忘れ分/);
  await page.close();
} finally {
  await browser.close();
  killPreview();
}

console.log('verify-backdate: OK');
