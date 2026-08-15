/**
 * バックアップ JSON の往復と不正ファイル拒否
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const settingsSrc = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.tsx'), 'utf8');
const onboardingSrc = fs.readFileSync(
  path.join(root, 'src/pages/OnboardingPage.tsx'),
  'utf8',
);
assert.match(settingsSrc, /BackupPanel/);
assert.match(onboardingSrc, /BackupPanel/);
assert.match(onboardingSrc, /showExport=\{false\}/);

const out = path.join(root, 'scripts', '.tmp-backup.mjs');
execSync(
  'npx --yes esbuild src/lib/backup.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-backup.mjs',
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

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

console.log('verify-backup: ok');
