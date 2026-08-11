/**
 * 栄養成分テキスト抽出の精度回帰テスト
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'scripts', '.tmp-parse.mjs');

execSync(
  'npx --yes esbuild src/lib/parseNutritionText.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-parse.mjs',
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

function check(label, text, expect) {
  const r = mod.parseNutritionText(text);
  for (const [k, v] of Object.entries(expect)) {
    assert.ok(
      Math.abs((r.nutrients[k] ?? 0) - v) <= 0.15,
      `${label}: ${k} expected ${v}, got ${r.nutrients[k]}`,
    );
  }
}

check('clean', `
栄養成分表示
1袋当たり
熱量 203kcal
たんぱく質 7.0g
脂質 9.4g
炭水化物 22.5g
食塩相当量 1.9g
`, { energy_kcal: 203, protein_g: 7, fat_g: 9.4, carb_g: 22.5, salt_g: 1.9 });

check('noisy', `
栄養成份表示 1袋当たり
熱 量 2O3kcal
たんばく質 7.0 g
脂 質 9.4g
炭水化物 22.5g
食塩相当量 1.9g
`, { energy_kcal: 203, protein_g: 7, fat_g: 9.4 });

check('lost-dot', `
栄養成分表示 1袋当たり
熱量 203kcal
たんぱく質 70g
脂質 94g
炭水化物 225g
食塩相当量 19g
`, { protein_g: 7, fat_g: 9.4, carb_g: 22.5, salt_g: 1.9 });

check('line-split', `
栄養成分表示
エネルギー
203kcal
タンパク質
7.0g
脂質
9.4g
炭水化物
22.5g
食塩相当量
1.9g
`, { energy_kcal: 203, protein_g: 7, fat_g: 9.4, carb_g: 22.5, salt_g: 1.9 });

check('prefer-serving', `
栄養成分表示
100gあたり エネルギー 339kcal タンパク質 11.7g
1袋当たり エネルギー 203kcal タンパク質 7.0g 脂質 9.4g 炭水化物 22.5g 食塩相当量 1.9g
`, { energy_kcal: 203, protein_g: 7 });

check('sodium', `
栄養成分表示
エネルギー 120kcal
タンパク質 3g
脂質 2g
炭水化物 20g
ナトリウム 400mg
`, { salt_g: 1.02 });

const a = mod.parseNutritionText(`エネルギー 203kcal タンパク質 7g 脂質 9.4g 炭水化物 22.5g`);
const b = mod.parseNutritionText(`エネルギー 999kcal タンパク質 70g`);
const merged = mod.mergeParsedResults([a, b, a]);
assert.ok(Math.abs(merged.nutrients.energy_kcal - 203) <= 1);
assert.ok(Math.abs(merged.nutrients.protein_g - 7) <= 0.2);

const pageSrc = fs.readFileSync(path.join(root, 'src/pages/RecordPage.tsx'), 'utf8');
assert.doesNotMatch(pageSrc, /OCR 生テキスト/);

console.log('verify-parse-nutrition: OK');
