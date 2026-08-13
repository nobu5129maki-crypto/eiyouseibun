/**
 * 食品DB総点検: 異常ゼロ・アルコール説明・ハイボール炭水化物
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'scripts', '.tmp-foods.mjs');

execSync(
  'npx --yes esbuild src/lib/foodDatabase.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-foods.mjs',
  { cwd: root, stdio: 'pipe' },
);
const { FOOD_DATABASE, hasAlcoholEnergy } = await import(
  pathToFileURL(out).href + `?t=${Date.now()}`
);
fs.unlinkSync(out);

const byId = Object.fromEntries(FOOD_DATABASE.map((f) => [f.id, f]));
const byKeyword = (kw) => FOOD_DATABASE.find((f) => f.keywords.includes(kw));

// ハイボールは炭水化物0表示にならないよう代表値 > 0
assert.ok(byId.highball, 'highball missing');
assert.ok(
  (byId.highball.nutrients.carb_g ?? 0) > 0,
  `highball carb must be > 0, got ${byId.highball.nutrients.carb_g}`,
);
assert.ok((byId.highball.alcohol_g ?? 0) > 0, 'highball needs alcohol_g');

// ジンジャー/コーラ割りは明確に炭水化物あり
assert.ok((byId.ginger_highball.nutrients.carb_g ?? 0) >= 4);
assert.ok((byId.cola_highball.nutrients.carb_g ?? 0) >= 5);

// 糖を含む酒類は炭水化物0禁止
for (const kw of [
  'ビール',
  '発泡酒',
  'ワイン',
  '赤ワイン',
  '白ワイン',
  '日本酒',
  '梅酒',
  'チューハイ',
  'カクテル',
  'マッコリ',
  'シードル',
  'リキュール',
  'ハイボール',
]) {
  const f = byKeyword(kw);
  assert.ok(f, `missing ${kw}`);
  assert.ok(
    (f.nutrients.carb_g ?? 0) > 0,
    `${kw} should have carbs > 0, got ${f.nutrients.carb_g}`,
  );
}

// 蒸留酒は炭水化物0でよいが alcohol_g 必須
const spiritKeywords = ['焼酎', 'ウイスキー', 'ブランデー', 'ウォッカ', 'ジン', 'ラム'];
for (const kw of spiritKeywords) {
  const f = byKeyword(kw);
  assert.ok(f, `missing ${kw}`);
  assert.ok(
    (f.nutrients.carb_g ?? 0) < 0.5,
    `${kw} spirit carb should be ~0, got ${f.nutrients.carb_g}`,
  );
  assert.ok((f.alcohol_g ?? 0) > 10, `${kw} needs alcohol_g`);
  assert.equal(hasAlcoholEnergy(f), true);
}

// 一般食品: エネルギーがあるのに主要栄養素が全滅はNG（蒸留酒以外）
const spiritIds = new Set(
  spiritKeywords.map((kw) => byKeyword(kw)?.id).filter(Boolean),
);
for (const f of FOOD_DATABASE) {
  if (spiritIds.has(f.id)) continue;
  const n = f.nutrients;
  const e = n.energy_kcal ?? 0;
  const macros = (n.protein_g ?? 0) + (n.fat_g ?? 0) + (n.carb_g ?? 0);
  if (e >= 40) {
    assert.ok(
      macros > 0 || (f.alcohol_g ?? 0) > 0,
      `${f.id}: energy ${e} but no macros/alcohol`,
    );
  }
  // 異常値（料理1食分は炭水化物100g超もあり得る）
  const carbMax = f.mode === 'serving' ? 200 : 105;
  const energyMax = f.mode === 'serving' ? 1500 : 1000;
  assert.ok(e >= 0 && e < energyMax, `${f.id} energy out of range: ${e}`);
  assert.ok((n.protein_g ?? 0) <= 100, `${f.id} protein too high`);
  assert.ok((n.fat_g ?? 0) <= 100, `${f.id} fat too high`);
  assert.ok((n.carb_g ?? 0) <= carbMax, `${f.id} carb too high`);
  assert.ok((n.salt_g ?? 0) <= 100, `${f.id} salt too high`);
}

assert.ok(
  FOOD_DATABASE.length >= 2500,
  `expected full MEXT table, got ${FOOD_DATABASE.length}`,
);
assert.ok(
  FOOD_DATABASE.some(
    (f) => f.id.startsWith('mext_') && f.keywords.includes('こまつな'),
  ),
  'komatsuna missing',
);

console.log(
  JSON.stringify(
    {
      ok: true,
      foods: FOOD_DATABASE.length,
      highballCarb: byId.highball.nutrients.carb_g,
      gingerCarb: byId.ginger_highball.nutrients.carb_g,
      colaCarb: byId.cola_highball.nutrients.carb_g,
    },
    null,
    2,
  ),
);
