// Mijoz ilovasi: "Uy"/"Ish" saqlangan manzillar (CUSTOMER-APP-PLAN.md ochiq
// savol #1). Alohida jadval EMAS — `customers` jadvalidagi ikkita qat'iy
// nuqta (home_*, work_*). `saveAddress` USTIGA YOZADI, ro'yxatga qo'shmaydi.
//
// Ishga tushirish: `node scripts/customer-addresses-sim.mjs`
import { jx, simPhone } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const INT = { 'x-internal-key': KEY };
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123:TEST';

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const raw = (method, path, body, headers = {}) =>
  fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

/** customer-auth-sim.mjs dagi bilan bir xil — mijoz JWT olish uchun. */
async function customerToken(telegramId) {
  const started = await j('POST', '/auth/customer/start', { deviceId: 'sim-' + telegramId });
  const conf = await j('POST', '/auth/customer/confirm', { nonce: started.nonce, telegramId }, INT);
  const verified = await j('POST', '/auth/customer/verify', { nonce: started.nonce, code: conf.code });
  return verified.token;
}

async function main() {
  console.log(`\n=== "Uy"/"Ish" saqlangan manzillar sim (API: ${API}) ===\n`);

  const tgId = String(810000000 + Math.floor(Math.random() * 1e6));
  await j('POST', '/customers/upsert', { telegramId: tgId, phone: simPhone('+99893'), firstName: 'M' }, INT);
  const token = await customerToken(tgId);
  const APP = { authorization: 'Bearer ' + token };

  console.log('--- 1: boshida bo\'sh ---');
  const empty = await j('GET', '/customer/addresses', undefined, APP);
  check('Uy yo\'q', empty.home === null, JSON.stringify(empty));
  check('Ish yo\'q', empty.work === null, JSON.stringify(empty));

  console.log('\n--- 2: Uyni saqlash ---');
  const home = { lat: 39.812, lng: 66.968 };
  const afterHome = await j('PUT', '/customer/addresses/home', home, APP);
  check('Uy saqlandi', afterHome.home?.lat === home.lat && afterHome.home?.lng === home.lng, JSON.stringify(afterHome));
  check('Ish hali yo\'q (Uy uni bosmagan)', afterHome.work === null, JSON.stringify(afterHome));

  console.log('\n--- 3: Ishni saqlash — Uy TEGILMAYDI ---');
  const work = { lat: 39.7683, lng: 67.2792 };
  const afterWork = await j('PUT', '/customer/addresses/work', work, APP);
  check('Ish saqlandi', afterWork.work?.lat === work.lat, JSON.stringify(afterWork));
  check('Uy hali ham turgan joyida', afterWork.home?.lat === home.lat, JSON.stringify(afterWork));

  console.log('\n--- 4: qayta saqlash USTIGA YOZADI (ro\'yxatga qo\'shilmaydi) ---');
  const home2 = { lat: 40.0, lng: 68.0 };
  const overwritten = await j('PUT', '/customer/addresses/home', home2, APP);
  check('Yangi qiymat qabul qilindi', overwritten.home?.lat === 40.0, JSON.stringify(overwritten));
  const afterOverwrite = await j('GET', '/customer/addresses', undefined, APP);
  check('Faqat bitta Uy qoladi (eskisi yo\'q)', afterOverwrite.home?.lat === 40.0, JSON.stringify(afterOverwrite));

  console.log('\n--- 5: o\'chirish ---');
  const cleared = await j('DELETE', '/customer/addresses/home', undefined, APP);
  check('Uy o\'chirildi', cleared.home === null, JSON.stringify(cleared));
  check('Ish tegilmagan', cleared.work?.lat === work.lat, JSON.stringify(cleared));

  console.log('\n--- 6: rad etish yo\'llari ---');
  const badLabel = await raw('PUT', '/customer/addresses/office', home, APP);
  check('Noto\'g\'ri label (ne "home" ne "work") → 400', badLabel.status === 400, 'HTTP ' + badLabel.status);

  const badPoint = await raw('PUT', '/customer/addresses/home', { lat: 999, lng: 68 }, APP);
  check('Yaroqsiz koordinata → 400', badPoint.status === 400, 'HTTP ' + badPoint.status);

  const noAuth = await raw('GET', '/customer/addresses', undefined, {});
  check('Tokensiz → 401', noAuth.status === 401, 'HTTP ' + noAuth.status);

  console.log('\n--- 7: begona mijoz o\'zinikini ko\'rmaydi ---');
  const tgId2 = String(820000000 + Math.floor(Math.random() * 1e6));
  await j('POST', '/customers/upsert', { telegramId: tgId2, phone: simPhone('+99894'), firstName: 'M2' }, INT);
  const token2 = await customerToken(tgId2);
  const other = await j('GET', '/customer/addresses', undefined, { authorization: 'Bearer ' + token2 });
  check('Yangi mijozda ikkalasi ham bo\'sh (birinchi mijozning Ishi ko\'rinmadi)', other.home === null && other.work === null, JSON.stringify(other));

  console.log(`\nNatija: ${passed} ✅  ${failed} ❌\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('Sim xato:', e.message); process.exit(1); });
