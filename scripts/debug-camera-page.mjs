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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.log('PAGE_ERROR', err.message));
page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
await page.addInitScript((state) => {
  localStorage.setItem('eiyouseibun:v2', JSON.stringify(state));
}, profileState);
await page.goto(`${BASE}/record?mode=ocr`, { waitUntil: 'networkidle' });
console.log('URL', page.url());
console.log('TITLE', await page.title());
console.log('BODY_SNIP', (await page.locator('body').innerText()).slice(0, 800));
console.log(
  'HAS_PANEL',
  await page.locator('[data-testid="camera-permission-panel"]').count(),
);
console.log(
  'HAS_CAMERA_BTN',
  await page.getByRole('button', { name: 'カメラで撮影' }).count(),
);
await browser.close();
