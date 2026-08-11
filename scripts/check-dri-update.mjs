/**
 * 厚生労働省の食事摂取基準ページとアプリの準拠年版を比較する。
 * より新しい「YYYY年版」があれば exit 1（アプリ更新が必要）。
 *
 * Usage: node scripts/check-dri-update.mjs
 *        npm run check:dri
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const MHLW_URL =
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/eiyou/syokuji_kijyun.html';

const out = path.join(root, 'scripts', '.tmp-targets-dri.mjs');
execSync(
  'npx --yes esbuild src/lib/targets.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-targets-dri.mjs',
  { cwd: root, stdio: 'pipe' },
);
const mod = await import(pathToFileURL(out).href + `?t=${Date.now()}`);
fs.unlinkSync(out);

const appYear = mod.DRI_SOURCE.editionYear;
assert.ok(Number.isInteger(appYear) && appYear >= 2020, `invalid editionYear: ${appYear}`);

const res = await fetch(MHLW_URL, {
  headers: { 'User-Agent': 'eiyouseibun-dri-check/1.0' },
});
if (!res.ok) {
  console.error(`check-dri-update: failed to fetch MHLW page (${res.status})`);
  process.exit(2);
}
const html = await res.text();
const years = [...html.matchAll(/食事摂取基準[（(](\d{4})年版[）)]/g)].map((m) =>
  Number(m[1]),
);
const unique = [...new Set(years)].sort((a, b) => b - a);
if (unique.length === 0) {
  console.error('check-dri-update: no edition years found on MHLW page');
  process.exit(2);
}

const latest = unique[0];
console.log('check-dri-update:');
console.log(`  app editionYear: ${appYear} (${mod.DRI_SOURCE.name})`);
console.log(`  MHLW editions found: ${unique.join(', ')}`);
console.log(`  latest on MHLW: ${latest}`);
console.log(`  lastChecked in app: ${mod.DRI_SOURCE.lastChecked}`);

if (latest > appYear) {
  console.error(
    `\nUPDATE REQUIRED: MHLW has ${latest}年版 but app is still on ${appYear}.\n` +
      `Update src/lib/targets.ts (DRI_SOURCE + nutrient tables), verify-targets, then deploy.`,
  );
  process.exit(1);
}

console.log('  status: OK (app is on the latest published edition)');
process.exit(0);
