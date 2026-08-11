/**
 * 1日目安の算出（食事摂取基準2025年版テーブル）の回帰テスト
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const targetsSrc = fs.readFileSync(path.join(root, 'src/lib/targets.ts'), 'utf8');
const settingsSrc = fs.readFileSync(
  path.join(root, 'src/pages/SettingsPage.tsx'),
  'utf8',
);

assert.match(targetsSrc, /食事摂取基準（2025年版）/);
assert.match(targetsSrc, /mhlw\.go\.jp/);
assert.match(settingsSrc, /目安の根拠/);
assert.match(settingsSrc, /DRI_SOURCE/);
assert.ok(
  !settingsSrc.includes('TARGET_BASIS_LINES'),
  'Settings should not list per-nutrient basis lines',
);

const out = path.join(root, 'scripts', '.tmp-targets.mjs');
execSync(
  'npx --yes esbuild src/lib/targets.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-targets.mjs',
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

assert.equal(mod.DRI_SOURCE.name, '日本人の食事摂取基準（2025年版）');
assert.equal(mod.DRI_SOURCE.editionYear, 2025);
assert.match(String(mod.DRI_SOURCE.lastChecked), /^\d{4}-\d{2}-\d{2}$/);
assert.ok(mod.TARGET_BASIS_LINES.length >= 6);

// 食塩: 目標量
assert.equal(mod.saltTarget('male'), 7.5);
assert.equal(mod.saltTarget('female'), 6.5);

// 食物繊維: 2025 年齢区分
assert.equal(mod.fiberTarget('male', 25), 20);
assert.equal(mod.fiberTarget('male', 40), 22);
assert.equal(mod.fiberTarget('male', 70), 21);
assert.equal(mod.fiberTarget('male', 80), 20);
assert.equal(mod.fiberTarget('female', 40), 18);
assert.equal(mod.fiberTarget('female', 80), 17);

// カルシウム推奨量
assert.equal(mod.calciumTarget('male', 25), 800);
assert.equal(mod.calciumTarget('male', 40), 750);
assert.equal(mod.calciumTarget('female', 25), 650);
assert.equal(mod.calciumTarget('female', 40), 650);
assert.equal(mod.calciumTarget('female', 80), 600);

// 鉄推奨量
assert.equal(mod.ironTarget('male', 35), 7.5);
assert.equal(mod.ironTarget('male', 25), 7.0);
assert.equal(mod.ironTarget('female', 35), 10.5);
assert.equal(mod.ironTarget('female', 25), 10.0);
assert.equal(mod.ironTarget('female', 55), 6.0);

assert.equal(mod.vitaminCTarget(30), 100);

const female40 = mod.calculateDailyTargets({
  displayName: 'test',
  age: 40,
  sex: 'female',
  heightCm: 160,
  weightKg: 55,
  activityLevel: 'light',
  goalType: 'maintain',
});
assert.equal(female40.salt_g, 6.5);
assert.equal(female40.fiber_g, 18);
assert.equal(female40.calcium_mg, 650);
assert.equal(female40.iron_mg, 10.5);
assert.equal(female40.vitamin_c_mg, 100);
assert.ok(female40.energy_kcal >= 1200);
assert.ok(female40.protein_g > 0);
assert.ok(female40.fat_g > 0);
assert.ok(female40.carb_g > 0);

const male35 = mod.calculateDailyTargets({
  displayName: 'test',
  age: 35,
  sex: 'male',
  heightCm: 170,
  weightKg: 70,
  activityLevel: 'moderate',
  goalType: 'maintain',
});
assert.equal(male35.fiber_g, 22);
assert.equal(male35.salt_g, 7.5);
assert.equal(male35.calcium_mg, 750);

console.log('verify-targets: OK');
console.log('  female40:', {
  energy: female40.energy_kcal,
  fiber: female40.fiber_g,
  calcium: female40.calcium_mg,
  iron: female40.iron_mg,
});
console.log('  male35:', {
  energy: male35.energy_kcal,
  fiber: male35.fiber_g,
  calcium: male35.calcium_mg,
});
