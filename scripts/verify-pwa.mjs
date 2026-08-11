/**
 * PWA / インストール対応の静的チェック
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function mustExist(rel) {
  const p = path.join(root, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return p;
}

mustExist('public/manifest.webmanifest');
mustExist('public/sw.js');
mustExist('public/icons/icon-192.png');
mustExist('public/icons/icon-512.png');
mustExist('public/icons/apple-touch-icon.png');
mustExist('public/icons/icon.png');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /manifest\.webmanifest/);
assert.match(html, /apple-touch-icon/);
assert.match(html, /theme-color/);

const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
assert.match(main, /registerServiceWorker/);

const settings = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.tsx'), 'utf8');
assert.match(settings, /InstallAppPanel/);

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'),
);
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));

// PNG signature
for (const rel of [
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon.png',
]) {
  const buf = fs.readFileSync(path.join(root, rel));
  assert.equal(buf[0], 0x89);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
}

console.log('verify-pwa: OK');
