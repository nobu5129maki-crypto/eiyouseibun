/**
 * 食事テキスト推測の回帰テスト（野菜g・飲料ml）
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function scaleNutrients(n, factor) {
  const r1 = (v) => Math.round(v * factor * 10) / 10;
  return {
    energy_kcal: Math.round((n.energy_kcal ?? 0) * factor * 10) / 10,
    protein_g: r1(n.protein_g ?? 0),
    fat_g: r1(n.fat_g ?? 0),
    carb_g: r1(n.carb_g ?? 0),
  };
}

function approx(a, b, eps = 0.15) {
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);
}

const dbSrc = fs.readFileSync(path.join(root, 'src/lib/foodDatabase.ts'), 'utf8');
const estSrc = fs.readFileSync(path.join(root, 'src/lib/mealEstimate.ts'), 'utf8');
const pageSrc = fs.readFileSync(path.join(root, 'src/pages/RecordPage.tsx'), 'utf8');

assert.match(dbSrc, /keywords:\s*\['ブロッコリー'/);
assert.match(dbSrc, /牛乳/);
assert.match(dbSrc, /mode:\s*'per100ml'/);
assert.match(dbSrc, /energy_kcal:\s*67/);
assert.match(estSrc, /parseMlFromText/);
assert.match(estSrc, /amountUnitOf/);
assert.match(estSrc, /isScalableFood/);
assert.match(pageSrc, /分量（ミリリットル）/);
assert.match(pageSrc, /amountUnit/);

const milk100 = { energy_kcal: 67, protein_g: 3.3, fat_g: 3.8, carb_g: 4.8 };
const m200 = scaleNutrients(milk100, 2);
approx(m200.energy_kcal, 134);
approx(m200.protein_g, 6.6);

const out = path.join(root, 'scripts', '.tmp-mealEstimate.mjs');
execSync(
  'npx --yes esbuild src/lib/mealEstimate.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-mealEstimate.mjs',
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

const milk = mod.estimateMealFromText('牛乳');
assert.equal(milk.supportsGrams, true);
assert.equal(milk.amountUnit, 'ml');
assert.equal(milk.grams, 200);
approx(milk.nutrients.energy_kcal, 134, 1);
approx(milk.nutrients.protein_g, 6.6, 0.2);
approx(milk.nutrients.calcium_mg, 220, 1);

const milk150 = mod.estimateMealFromText('牛乳150ml');
assert.equal(milk150.grams, 150);
approx(milk150.nutrients.energy_kcal, 100.5, 1);

const lowfat = mod.estimateMealFromText('低脂肪牛乳');
approx(lowfat.nutrients.energy_kcal, 92, 1);
assert.ok(lowfat.nutrients.energy_kcal < milk.nutrients.energy_kcal);

const soy = mod.estimateMealFromText('豆乳200ml');
assert.equal(soy.grams, 200);
approx(soy.nutrients.energy_kcal, 92, 1);

const broccoli = mod.estimateMealFromText('ブロッコリー');
assert.equal(broccoli.amountUnit, 'g');
approx(broccoli.nutrients.energy_kcal, 33, 0.5);

assert.equal(mod.parseMlFromText('牛乳２００ミリリットル'), 200);

console.log('verify-meal-estimate: OK');
console.log('  牛乳200ml:', milk.nutrients);
console.log('  牛乳150ml:', milk150.nutrients);
console.log('  低脂肪牛乳200ml:', lowfat.nutrients);
