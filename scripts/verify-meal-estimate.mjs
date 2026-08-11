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
assert.match(dbSrc, /アーモンド/);
assert.match(dbSrc, /ミックスナッツ/);
assert.match(dbSrc, /くるみ/);
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

// ナッツ類（既定25g）: アーモンド 578kcal/100g → 約144.5
const almond = mod.estimateMealFromText('アーモンド');
assert.equal(almond.supportsGrams, true);
assert.equal(almond.amountUnit, 'g');
assert.equal(almond.grams, 25);
approx(almond.nutrients.energy_kcal, 144.5, 2);
approx(almond.nutrients.protein_g, 5.3, 0.3);
approx(almond.nutrients.fat_g, 13.5, 0.4);

const almond40 = mod.estimateMealFromText('アーモンド40g');
assert.equal(almond40.grams, 40);
approx(almond40.nutrients.energy_kcal, 231.2, 2);

const mixed = mod.estimateMealFromText('ミックスナッツ');
assert.equal(mixed.grams, 30);
approx(mixed.nutrients.energy_kcal, 183, 3);

const walnut = mod.estimateMealFromText('くるみ');
assert.ok(walnut.nutrients.energy_kcal > 100);
assert.ok(walnut.matchedKeywords.some((k) => /くるみ|クルミ/.test(k)));

// 具体名が汎用「ナッツ」より優先
const cashew = mod.estimateMealFromText('カシューナッツ');
assert.match(cashew.displayName, /カシュー/);
assert.ok(!/ミックス/.test(cashew.displayName));

assert.equal(mod.parseMlFromText('牛乳２００ミリリットル'), 200);

console.log('verify-meal-estimate: OK');
console.log('  牛乳200ml:', milk.nutrients);
console.log('  アーモンド25g:', almond.nutrients);
console.log('  ミックスナッツ30g:', mixed.nutrients);
