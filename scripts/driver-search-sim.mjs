// Haydovchilarni qidirish, filtrlash va tahrirlash (2026-09-14).
//
// MUAMMO: `GET /ops/drivers` 200 tagacha hammasini qaytaradi va panel ularni
// bitta jadvalda ko'rsatadi. Yuzlab haydovchida operator kerakli odamni ko'z
// bilan topa olmaydi.
//
// YECHIM: `GET /ops/drivers/search` — ism, telefon, davlat raqami bo'yicha
// qidiruv + holat/toifa/tasdiq/qarz filtrlari + sahifalash. Panel oynasidan
// profil va mashina toifasi tahrirlanadi.
//
// Ishga tushirish: `node scripts/driver-search-sim.mjs`
import { adminLogin, createDriver, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};

async function call(method, path, headers = {}, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}

async function main() {
  console.log(`\n=== Haydovchi qidiruvi sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };
  const S = (qs) => call('GET', '/ops/drivers/search?' + qs, ADM);

  // Har ishga tushirishda noyob belgi — eski sim haydovchilari aralashmasin.
  const tag = 'Qid' + Math.floor(100000 + Math.random() * 899999);
  const mk = async (suffix, category) => {
    const phone = simPhone();
    const plate = simPlate();
    const d = await createDriver(API, adminToken, {
      phone, firstName: tag + suffix, vehicle: { category, plate, model: 'M', seats: 4 },
    });
    return { ...d, phone, plate };
  };
  const a = await mk('ali', 'standard');
  const b = await mk('vali', 'comfort');
  const c = await mk('yuk', 'cargo');

  console.log('--- 1: qidiruv ---');
  const all = await S('q=' + tag);
  check('Belgi bo‘yicha 3 ta', all.data?.total === 3, JSON.stringify(all.data?.total));
  const one = await S('q=' + encodeURIComponent(tag + 'ali'));
  check('To‘liq ism bo‘yicha faqat bittasi', one.data?.total === 1 && one.data.items[0].id === a.driverId);
  const byPlate = await S('q=' + encodeURIComponent(a.plate));
  check('Davlat raqami bo‘yicha', byPlate.data?.items?.some((d) => d.id === a.driverId));
  const digits = a.phone.slice(-7);
  const spaced = `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  const byPhone = await S('q=' + encodeURIComponent(spaced));
  check(`Telefon bo‘shliqlar bilan ("${spaced}")`, byPhone.data?.items?.some((d) => d.id === a.driverId));
  const escaped = await S('q=' + encodeURIComponent(tag + '_'));
  check('"_" belgisi joker bo‘lib ishlamaydi (0 ta)', escaped.data?.total === 0, JSON.stringify(escaped.data?.total));

  console.log('\n--- 2: filtrlar va sahifalash ---');
  const comfort = await S(`q=${tag}&category=comfort`);
  check('Toifa filtri: faqat Comfort', comfort.data?.total === 1 && comfort.data.items[0].id === b.driverId);
  const page = await S(`q=${tag}&limit=1&offset=1`);
  check('Sahifalash: 1 ta element, jami 3', page.data?.items?.length === 1 && page.data?.total === 3);
  await call('POST', `/ops/drivers/${a.driverId}/block`, ADM);
  const blocked = await S(`q=${tag}&approval=blocked`);
  check('Tasdiq filtri: bloklangan', blocked.data?.total === 1 && blocked.data.items[0].id === a.driverId);
  const bad = await S('status=nomalum');
  check('Noto‘g‘ri filtr qiymati -> 400', bad.status === 400, String(bad.status));
  const noSecret = all.data?.items?.every((d) => !('passwordHash' in d) && !('pushToken' in d));
  check('Javobda parol hash va push token YO‘Q', noSecret);

  console.log('\n--- 3: tahrirlash ---');
  const renamed = await call('PUT', `/ops/drivers/${b.driverId}/profile`, ADM, { firstName: tag + 'yangi' });
  check('Ism o‘zgardi', renamed.status < 300 && renamed.data?.firstName === tag + 'yangi', `${renamed.status}`);
  const clash = await call('PUT', `/ops/drivers/${b.driverId}/profile`, ADM, { phone: a.phone });
  check('Boshqa haydovchining telefoni -> 409', clash.status === 409, String(clash.status));
  const recat = await call('PUT', `/ops/drivers/${c.driverId}/vehicle`, ADM, { category: 'standard' });
  check('Mashina toifasi o‘zgardi', recat.status < 300 && recat.data?.category === 'standard', `${recat.status}`);
  const cargoNow = await S(`q=${tag}&category=cargo`);
  check('Endi Yuk filtri bo‘sh', cargoNow.data?.total === 0);
  const trips = await call('GET', `/ops/drivers/${b.driverId}/trips`, ADM);
  check('Safarlar ro‘yxati qaytadi', trips.status === 200 && Array.isArray(trips.data));

  console.log('\n--- 4: huquqlar ---');
  const asDriver = await call('GET', '/ops/drivers/search?q=' + tag, { authorization: 'Bearer ' + b.token });
  check('Haydovchi tokeni -> 403', asDriver.status === 403, String(asDriver.status));

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
