/**
 * 設定 > データの UI 要件チェック
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/pages/SettingsPage.tsx'), 'utf8');

assert.ok(!/localStorage/.test(src), 'must not show localStorage notice');
assert.ok(!/このブラウザ/.test(src), 'must not show browser storage notice');
assert.match(src, /deleteMeal/);
assert.match(src, /settings-meal-list/);
assert.match(src, /settings-delete-meal/);
assert.match(src, /すべてのデータを削除/);
assert.match(src, /保存済みの食事記録/);
assert.match(src, /MEXT_FOOD_SOURCE/);

console.log('verify-settings-data: OK');
