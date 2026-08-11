/**
 * 食事テキスト推測の回帰テスト
 * - ソース上のブロッコリー成分が正しいこと
 * - グラム換算が想定どおりであること
 * - 旧フォールバック（~550kcal / P20 / F18）に戻っていないこと
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ブロッコリー（生）100g: 33 / 4.3 / 0.5
assert.match(dbSrc, /keywords:\s*\['ブロッコリー'/);
assert.match(dbSrc, /energy_kcal:\s*33/);
assert.match(dbSrc, /protein_g:\s*4\.3/);
assert.match(dbSrc, /fat_g:\s*0\.5/);
assert.match(dbSrc, /mode:\s*'per100g'/);

// 旧フォールバックを廃止
assert.doesNotMatch(estSrc, /energy_kcal:\s*550/);
assert.match(estSrc, /supportsGrams/);
assert.match(estSrc, /parseGramsFromText/);
assert.match(estSrc, /nutrientsForGrams/);

// UI にグラム入力
assert.match(pageSrc, /grams-input/);
assert.match(pageSrc, /分量（グラム）/);
assert.match(pageSrc, /onGramsChange/);

const broccoli100 = {
  energy_kcal: 33,
  protein_g: 4.3,
  fat_g: 0.5,
  carb_g: 6.6,
};

const g100 = scaleNutrients(broccoli100, 1);
approx(g100.energy_kcal, 33);
approx(g100.protein_g, 4.3);
approx(g100.fat_g, 0.5);

const g150 = scaleNutrients(broccoli100, 1.5);
approx(g150.energy_kcal, 49.5);
approx(g150.protein_g, 6.5);
approx(g150.fat_g, 0.8);

assert.ok(g100.energy_kcal < 100, 'must not resemble 500kcal meal fallback');
assert.ok(g100.protein_g < 10, 'must not resemble 20g protein fallback');
assert.ok(g100.fat_g < 2, 'must not resemble 18g fat fallback');

console.log('verify-meal-estimate: OK');
console.log('  ブロッコリー100g相当:', g100);
console.log('  ブロッコリー150g相当:', g150);
