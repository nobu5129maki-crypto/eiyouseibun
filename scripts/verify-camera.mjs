import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'http://127.0.0.1:5173';

const profileState = {
  profile: {
    displayName: 'テスト',
    age: 30,
    sex: 'female',
    heightCm: 160,
    weightKg: 55,
    activityLevel: 'light',
    goalType: 'maintain',
  },
  targets: {
    energy_kcal: 1800,
    protein_g: 70,
    fat_g: 50,
    carb_g: 250,
    salt_g: 6.5,
    fiber_g: 18,
    vitamin_c_mg: 100,
    calcium_mg: 750,
    iron_mg: 10.5,
  },
  meals: [],
};

async function openOcrPage(page) {
  await page.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  }, profileState);
  await page.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'カメラで撮影' }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

async function verifyGrantedFlow() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });
  const context = await browser.newContext({ permissions: ['camera'] });
  const page = await context.newPage();

  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__getUserMediaCalls = (window.__getUserMediaCalls ?? 0) + 1;
      return original(constraints);
    };
  });

  await openOcrPage(page);

  // OCR 画面上に許可パネルがある
  await page.getByTestId('camera-permission-panel').first().waitFor({ state: 'visible' });
  await page.getByTestId('camera-permission-badge').first().waitFor({ state: 'visible' });

  // 設定方法を表示できる
  await page.getByTestId('camera-permission-settings').first().click();
  await page.getByTestId('camera-permission-help').first().waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'カメラで撮影' }).click();
  const dialog = page.getByRole('dialog', { name: 'カメラ撮影' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  // ダイアログ内でも許可 UI が出る
  await dialog.getByTestId('camera-permission-panel').waitFor({ state: 'visible' });
  await dialog
    .getByTestId('camera-permission-ask')
    .or(dialog.getByTestId('camera-permission-start'))
    .click();

  await page.waitForFunction(() => (window.__getUserMediaCalls ?? 0) > 0, null, {
    timeout: 8000,
  });

  const shutter = page.getByRole('button', { name: '撮影する' });
  await page.waitForFunction(() => {
    const video = document.querySelector('video.camera-video');
    return video && video.readyState >= 2 && video.videoWidth > 0;
  }, null, { timeout: 10000 });

  await shutter.scrollIntoViewIfNeeded();
  await shutter.click({ force: true });

  await page.getByRole('heading', { name: '記録内容（確認・編集）' }).waitFor({
    state: 'visible',
    timeout: 10000,
  });

  const nameValue = await page.locator('#name').inputValue();
  if (!nameValue) throw new Error('OCR 後の食品名が空です');

  // 設定ページにもカメラ設定がある
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'カメラ設定' }).waitFor({ state: 'visible' });
  await page.getByTestId('camera-permission-panel').waitFor({ state: 'visible' });

  await browser.close();
  return { grantedFlow: true, productName: nameValue };
}

async function verifyDeniedFlow() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      // fake-ui を付けない + 権限拒否で denied を再現
    ],
  });
  const context = await browser.newContext();
  await context.grantPermissions([], { origin: BASE });

  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const err = new DOMException('Permission denied', 'NotAllowedError');
      throw err;
    };
    // permissions.query も denied を返す
    const deniedStatus = {
      state: 'denied',
      addEventListener() {},
      removeEventListener() {},
      onchange: null,
    };
    navigator.permissions.query = async () => deniedStatus;
  });

  await openOcrPage(page);

  const badge = page.getByTestId('camera-permission-badge').first();
  await badge.waitFor({ state: 'visible' });
  const badgeText = (await badge.textContent())?.trim();
  if (badgeText !== '拒否') {
    throw new Error(`許可バッジが拒否ではありません: ${badgeText}`);
  }

  await page.getByTestId('camera-permission-ask').first().click();
  await page.getByTestId('camera-permission-message').first().waitFor({
    state: 'visible',
    timeout: 5000,
  });
  const msg = await page.getByTestId('camera-permission-message').first().textContent();
  if (!msg?.includes('拒否')) {
    throw new Error(`拒否メッセージが不正: ${msg}`);
  }

  await page.getByTestId('camera-permission-settings').first().click();
  await page.getByTestId('camera-permission-help').first().waitFor({ state: 'visible' });

  await browser.close();
  return { deniedFlow: true, badgeText };
}

async function main() {
  const granted = await verifyGrantedFlow();
  const denied = await verifyDeniedFlow();
  console.log(JSON.stringify({ ok: true, ...granted, ...denied }, null, 2));
}

main().catch((err) => {
  console.error('VERIFY_FAILED:', err);
  process.exit(1);
});
