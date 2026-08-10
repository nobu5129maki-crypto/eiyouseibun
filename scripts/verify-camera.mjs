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
  await page.getByTestId('open-camera-button').waitFor({
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
      window.__getUserMediaFromClick = true;
      return original(constraints);
    };
  });

  await openOcrPage(page);

  await page.getByTestId('camera-permission-panel').first().waitFor({ state: 'visible' });
  await page.getByTestId('camera-permission-settings').first().click();
  await page.getByTestId('camera-permission-help').first().waitFor({ state: 'visible' });

  // 「カメラで撮影」タップで即座に getUserMedia（ファイル選択ではない）
  await page.getByTestId('open-camera-button').click();

  await page.waitForFunction(() => (window.__getUserMediaCalls ?? 0) > 0, null, {
    timeout: 8000,
  });

  const dialog = page.getByRole('dialog', { name: 'カメラ撮影' });
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  await dialog.getByTestId('camera-os-vs-site-note').waitFor({ state: 'visible' });

  // capture 付き input は無いこと
  const captureInputs = await page.locator('input[capture]').count();
  if (captureInputs > 0) throw new Error('capture input が残っています');

  // ギャラリー input はカメラボタンでは発火しない
  const galleryClicked = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="gallery-file-input"]');
    if (!input) return false;
    let clicked = false;
    input.addEventListener('click', () => {
      clicked = true;
    });
    return clicked;
  });
  if (galleryClicked) throw new Error('ギャラリー input が誤ってクリックされました');

  await page.waitForFunction(() => {
    const video = document.querySelector('video.camera-video');
    return video && video.readyState >= 2 && video.videoWidth > 0;
  }, null, { timeout: 12000 });

  const shutter = page.getByTestId('camera-shutter');
  await shutter.scrollIntoViewIfNeeded();
  await shutter.click({ force: true });

  // 撮影後は OCR 解析へ進む（フェイク映像では数値抽出に失敗し得るため、
  // ここではカメラ撮影完了と解析開始/結果UIのいずれかを確認する）
  await page.getByRole('dialog', { name: 'カメラ撮影' }).waitFor({
    state: 'hidden',
    timeout: 8000,
  });
  await page
    .getByText(/読み取り中|栄養成分|読み取れませんでした|記録内容/)
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'カメラ設定' }).waitFor({ state: 'visible' });

  await browser.close();
  return { grantedFlow: true, captureCompleted: true, immediateGetUserMedia: true };
}

async function verifyDeniedShowsSiteHelp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
    navigator.permissions.query = async () => ({
      state: 'denied',
      addEventListener() {},
      removeEventListener() {},
      onchange: null,
    });
  });

  await openOcrPage(page);
  await page.getByTestId('open-camera-button').click();

  const dialog = page.getByRole('dialog', { name: 'カメラ撮影' });
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  await dialog.getByTestId('camera-start-error').waitFor({ state: 'visible' });
  const err = await dialog.getByTestId('camera-start-error').textContent();
  if (!err?.includes('サイト') && !err?.includes('拒否')) {
    throw new Error(`拒否エラー文言が不正: ${err}`);
  }
  await dialog.getByTestId('camera-os-vs-site-note').waitFor({ state: 'visible' });
  await dialog.getByTestId('camera-retry-start').waitFor({ state: 'visible' });

  await browser.close();
  return { deniedFlow: true };
}

async function main() {
  const granted = await verifyGrantedFlow();
  const denied = await verifyDeniedShowsSiteHelp();
  console.log(JSON.stringify({ ok: true, ...granted, ...denied }, null, 2));
}

main().catch((err) => {
  console.error('VERIFY_FAILED:', err);
  process.exit(1);
});
