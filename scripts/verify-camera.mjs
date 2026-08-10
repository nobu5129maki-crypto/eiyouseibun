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

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const context = await browser.newContext({
    permissions: ['camera'],
  });
  const page = await context.newPage();

  let getUserMediaCalled = false;
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__getUserMediaCalls = (window.__getUserMediaCalls ?? 0) + 1;
      window.__lastConstraints = constraints;
      return original(constraints);
    };
  });

  await page.addInitScript((state) => {
    localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
  }, profileState);
  await page.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'カメラで撮影' }).waitFor({
    state: 'visible',
    timeout: 15000,
  });

  const cameraBtn = page.getByRole('button', { name: 'カメラで撮影' });
  await cameraBtn.waitFor({ state: 'visible' });
  await cameraBtn.click();

  const dialog = page.getByRole('dialog', { name: 'カメラ撮影' });
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  // ファイル選択ダイアログ経路になっていないこと（input[capture] を使っていない）
  const captureInputs = await page.locator('input[capture]').count();
  if (captureInputs > 0) {
    throw new Error('capture 属性付き input が残っています（ファイル選択経路）');
  }

  await page.waitForFunction(() => (window.__getUserMediaCalls ?? 0) > 0, null, {
    timeout: 8000,
  });
  getUserMediaCalled = true;

  const shutter = page.getByRole('button', { name: '撮影する' });
  await shutter.waitFor({ state: 'visible' });
  // video 準備待ち
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
  if (!nameValue.includes('ラベル読取') && !nameValue) {
    throw new Error(`OCR 後の食品名が空です: ${nameValue}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        getUserMediaCalled,
        productName: nameValue,
        dialogOpened: true,
        noCaptureInput: captureInputs === 0,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch(async (err) => {
  console.error('VERIFY_FAILED:', err);
  process.exit(1);
});
