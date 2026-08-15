/**
 * バックアップ JSON の往復と、書き出し（共有失敗時のダウンロード）回帰
 */
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = process.env.BACKUP_VERIFY_PORT ?? '4178';
const BASE = process.env.APP_URL ?? `http://127.0.0.1:${PORT}`;

const settingsSrc = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.tsx'), 'utf8');
const onboardingSrc = fs.readFileSync(
  path.join(root, 'src/pages/OnboardingPage.tsx'),
  'utf8',
);
const panelSrc = fs.readFileSync(path.join(root, 'src/components/BackupPanel.tsx'), 'utf8');
const exportSrc = fs.readFileSync(path.join(root, 'src/lib/backupExport.ts'), 'utf8');
assert.match(settingsSrc, /BackupPanel/);
assert.match(onboardingSrc, /BackupPanel/);
assert.match(onboardingSrc, /showExport=\{false\}/);
assert.match(panelSrc, /exportBackupFile/);
assert.match(exportSrc, /shouldTryFileShare/);
assert.match(exportSrc, /downloadBackup/);
assert.match(exportSrc, /isAbortError/);

function bundle(entry, outfile) {
  execSync(
    `npx --yes esbuild ${entry} --bundle --platform=node --format=esm --outfile=${outfile}`,
    { cwd: root, stdio: 'pipe' },
  );
  return outfile;
}

const backupOut = path.join(root, 'scripts', '.tmp-backup.mjs');
bundle('src/lib/backup.ts', 'scripts/.tmp-backup.mjs');
const mod = await import(pathToFileURL(backupOut).href + `?t=${Date.now()}`);
fs.unlinkSync(backupOut);

const sample = mod.makeBackup(
  {
    profile: {
      displayName: 'たろう',
      age: 30,
      sex: 'male',
      heightCm: 170,
      weightKg: 65,
      activityLevel: 'light',
      goalType: 'maintain',
    },
    targets: {
      energy_kcal: 2200,
      protein_g: 65,
      fat_g: 60,
      carb_g: 300,
      salt_g: 7.5,
      fiber_g: 21,
      vitamin_c_mg: 100,
      calcium_mg: 750,
      iron_mg: 7.5,
    },
    meals: [
      {
        id: 'm1',
        loggedAt: '2026-08-15T03:00:00.000Z',
        mealSlot: 'breakfast',
        inputMethod: 'manual',
        displayName: 'ごはん',
        nutrients: { energy_kcal: 250, protein_g: 4, fat_g: 0.5, carb_g: 55 },
      },
    ],
  },
  Date.UTC(2026, 7, 15, 3, 0, 0),
);

const parsed = mod.parseBackup(mod.stringifyBackup(sample));
assert.equal(parsed.ok, true);
assert.equal(parsed.backup.state.profile.displayName, 'たろう');
assert.equal(parsed.backup.state.meals[0].displayName, 'ごはん');
assert.equal(mod.backupSummary(sample), 'たろうの食事記録1件');
assert.equal(
  mod.backupFileName(Date.UTC(2026, 7, 15, 3, 0, 0)),
  '栄養バランス-バックアップ-2026-08-15.json',
);

const other = mod.parseBackup(JSON.stringify({ v: 1, meals: [] }));
assert.equal(other.ok, false);

const broken = mod.parseBackup('これはバックアップではない');
assert.equal(broken.ok, false);

const badMeal = structuredClone(sample);
badMeal.state.meals[0].id = 1;
const bad = mod.parseBackup(JSON.stringify(badMeal));
assert.equal(bad.ok, false);

const exportOut = path.join(root, 'scripts', '.tmp-backup-export.mjs');
bundle('src/lib/backupExport.ts', 'scripts/.tmp-backup-export.mjs');
const exp = await import(pathToFileURL(exportOut).href + `?t=${Date.now()}`);
fs.unlinkSync(exportOut);

assert.equal(exp.isAbortError({ name: 'AbortError' }), true);
assert.equal(exp.isAbortError({ name: 'NotAllowedError' }), false);
assert.equal(exp.isAbortError(new Error('fail')), false);

let shareCalls = 0;
let downloaded = [];

function makeHost({ ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', share, canShare } = {}) {
  shareCalls = 0;
  downloaded = [];
  return {
    navigator: {
      userAgent: ua,
      platform: ua.includes('MacIntel') ? 'MacIntel' : 'Win32',
      maxTouchPoints: ua.includes('iPad') ? 5 : 0,
      share: share
        ? async (data) => {
            shareCalls += 1;
            return share(data);
          }
        : undefined,
      canShare,
    },
    createObjectURL: () => 'blob:backup-test',
    revokeObjectURL: () => {},
    document: {
      createElement: () => {
        const el = {
          href: '',
          download: '',
          rel: '',
          style: { display: '' },
          click() {
            downloaded.push({ href: el.href, name: el.download });
          },
          remove() {},
        };
        return el;
      },
      body: { appendChild() {} },
    },
  };
}

const backupFile = exp.createBackupFile(mod.stringifyBackup(sample), '栄養バランス-バックアップ-2026-08-15.json');
assert.equal(backupFile.name, '栄養バランス-バックアップ-2026-08-15.json');

{
  const host = makeHost({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' });
  assert.equal(exp.shouldTryFileShare(host.navigator), false);
  const winResult = await exp.exportBackupFile(backupFile, host);
  assert.equal(winResult, 'downloaded');
  assert.equal(shareCalls, 0);
  assert.equal(downloaded.length, 1);
  assert.equal(downloaded[0].name, backupFile.name);
}

{
  const host = makeHost({
    ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile',
    canShare: () => true,
    share: async () => {
      throw Object.assign(new Error('Share failed'), { name: 'NotAllowedError' });
    },
  });
  assert.equal(exp.shouldTryFileShare(host.navigator), true);
  const androidFail = await exp.exportBackupFile(backupFile, host);
  assert.equal(androidFail, 'downloaded');
  assert.equal(shareCalls, 1);
  assert.equal(downloaded.length, 1);
}

{
  const host = makeHost({
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    canShare: () => true,
    share: async () => {},
  });
  const iosOk = await exp.exportBackupFile(backupFile, host);
  assert.equal(iosOk, 'shared');
  assert.equal(shareCalls, 1);
  assert.equal(downloaded.length, 0);
}

{
  const host = makeHost({
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    canShare: () => true,
    share: async () => {
      throw Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    },
  });
  await assert.rejects(() => exp.exportBackupFile(backupFile, host), (err) => exp.isAbortError(err));
  assert.equal(downloaded.length, 0);
}

const profileState = {
  profile: {
    displayName: 'たろう',
    age: 30,
    sex: 'male',
    heightCm: 170,
    weightKg: 65,
    activityLevel: 'light',
    goalType: 'maintain',
  },
  targets: {
    energy_kcal: 2200,
    protein_g: 65,
    fat_g: 60,
    carb_g: 300,
    salt_g: 7.5,
    fiber_g: 21,
    vitamin_c_mg: 100,
    calcium_mg: 750,
    iron_mg: 7.5,
  },
  meals: sample.state.meals,
};

let previewProc = null;
async function ensurePreview() {
  if (process.env.APP_URL) return;
  try {
    if ((await fetch(BASE)).ok) return;
  } catch {
    /* start */
  }
  let logs = '';
  previewProc = spawn(`npx vite preview --host 127.0.0.1 --port ${PORT}`, {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  previewProc.stdout?.on('data', (chunk) => {
    logs += String(chunk);
  });
  previewProc.stderr?.on('data', (chunk) => {
    logs += String(chunk);
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* wait */
    }
    if (previewProc.exitCode != null) {
      throw new Error(`preview exited ${previewProc.exitCode}: ${logs.trim()}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview failed: ${logs.trim()}`);
}

function killPreview() {
  if (!previewProc?.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(previewProc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      previewProc.kill('SIGKILL');
    }
  } catch {
    /* ignore */
  }
  previewProc = null;
}

await ensurePreview();
const browser = await chromium.launch({ headless: true });

async function exportAndAssertDownload(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.getByTestId('backup-export').click(),
  ]);
  assert.match(download.suggestedFilename(), /栄養バランス-バックアップ-.*\.json/);
  const tmp = await download.path();
  assert.ok(tmp);
  const json = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  assert.equal(json.kind, 'eiyouseibun-backup');
  assert.equal(json.state.profile.displayName, 'たろう');
  await page.getByText('を書き出しました').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.getByText('書き出せませんでした').count(), 0);
}

try {
  const desktop = await browser.newPage();
  await desktop.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  }, profileState);
  await desktop.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await desktop.getByTestId('backup-export').waitFor({ state: 'visible' });
  await exportAndAssertDownload(desktop);
  await desktop.close();

  const shareFail = await browser.newPage();
  await shareFail.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('There was an error attempting to share', 'NotAllowedError');
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
  }, profileState);
  await shareFail.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await exportAndAssertDownload(shareFail);
  await shareFail.close();
} finally {
  await browser.close();
  killPreview();
}

console.log('verify-backup: ok');
process.exit(0);
