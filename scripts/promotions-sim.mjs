// Aksiyalar va haydovchi guruhlari (2026-09-15).
//
// MUAMMO: foydalanuvchi yangi yilgacha haydovchilardan to'lov yechmasdan har
// zakazga +300 so'm bermoqchi edi va `per_order = -300` qo'yib ko'rmoqchi edi.
// Bu ishlamasdi: hisob manfiyni 0 ga aylantiradi — haydovchi tekin ishlardi,
// lekin bonus tushmasdi.
//
// YECHIM: aksiya = to'lovdan chegirma (%) + har zakazga bonus (so'm), barchaga
// yoki guruhga, qo'lda yoqiladi va ixtiyoriy sana oralig'ida o'zi ishlaydi.
// Bir nechtasi to'g'ri kelsa QO'SHILMAYDI (eng katta chegirma / eng katta bonus).
//
// Pul bilan bog'liq, shuning uchun har holat haqiqiy safar yakunlanishi bilan
// tekshiriladi: balans harakati aynan kutilgan summaga teng bo'lishi shart.
//
// Ishga tushirish: `node scripts/promotions-sim.mjs`
import { io } from 'socket.io-client';
import { adminLogin, createDriver, jx, simPhone, simPlate } from './helpers.mjs';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const INT = { 'x-internal-key': KEY };
const pickup = { lat: 41.311, lng: 69.24 };
const FEE = 1000; // har zakaz uchun odatdagi to'lov
const DAY = 24 * 3600_000;

let passed = 0, failed = 0;
const check = (n, c, e = '') => {
  if (c) { passed++; console.log(`  ✅ ${n}`); } else { failed++; console.log(`  ❌ ${n} ${e}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = (m, p, b, h = {}) => jx(API, m, p, b, h);
const emit = (s, ev, data) =>
  new Promise((res) => {
    const to = setTimeout(() => res(undefined), 5000);
    s.emit(ev, data, (r) => { clearTimeout(to); res(r); });
  });

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
  console.log(`\n=== Aksiyalar sim (API: ${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const ADM = { authorization: 'Bearer ' + adminToken };
  const created = { promos: [], groups: [] };

  // Haydovchilar ONLAYN BO'LMAYDI — zakaz NO_DRIVER'ga tushadi va operator
  // aniq haydovchiga biriktiradi. Shunda qaysi haydovchi safar qilgani aniq.
  const mkDriver = async (label) => {
    const d = await createDriver(API, adminToken, {
      phone: simPhone(), firstName: label,
      vehicle: { category: 'standard', plate: simPlate(), model: label, seats: 4 },
    });
    await j('PUT', `/ops/drivers/${d.driverId}/billing`, { mode: 'per_order', config: { perOrder: FEE } }, ADM);
    const socket = io(API + '/driver', { auth: { token: d.token }, transports: ['websocket'] });
    await new Promise((r) => socket.on('connect', r));
    return { ...d, socket, label };
  };

  /** Bitta to'liq safar; shu zakaz bo'yicha balans harakatlarini qaytaradi. */
  const trip = async (drv) => {
    const c = await j('POST', '/customers/upsert',
      { telegramId: String(830000000 + Math.floor(Math.random() * 1e6)), phone: simPhone('+99893'), firstName: 'M' }, INT);
    const o = await j('POST', '/orders', { customerId: c.id, category: 'standard', pickup }, INT);
    await sleep(1500);
    await j('POST', `/ops/orders/${o.id}/assign`, { driverId: drv.driverId }, ADM);
    await sleep(400);
    await emit(drv.socket, 'trip:arrived', { orderId: o.id });
    await sleep(300);
    await emit(drv.socket, 'trip:start', { orderId: o.id });
    await sleep(300);
    await emit(drv.socket, 'trip:complete', { orderId: o.id, distanceM: 2000 });
    await sleep(900);
    const txs = await j('GET', `/ops/drivers/${drv.driverId}/transactions`, undefined, ADM);
    const mine = txs.filter((x) => x.orderId === o.id);
    return {
      net: mine.reduce((s, x) => s + Number(x.amount), 0),
      types: mine.map((x) => x.type).sort().join(','),
    };
  };

  const promo = async (body) => {
    const r = await call('POST', '/ops/promotions', ADM, body);
    if (r.status < 300) created.promos.push(r.data.id);
    return r;
  };
  const clearPromos = async () => {
    for (const id of created.promos.splice(0)) await call('DELETE', `/ops/promotions/${id}`, ADM);
  };

  try {
    const a = await mkDriver('Birinchi');
    const b = await mkDriver('Oddiy');

    console.log('--- 0: aksiyasiz ---');
    const base = await trip(a);
    check(`Odatdagi to'lov yechiladi (-${FEE})`, base.net === -FEE && base.types === 'commission', JSON.stringify(base));

    console.log('\n--- 1: guruh aksiyasi (chegirma 100%, bonus 300) ---');
    const g = await call('POST', '/ops/driver-groups', ADM, { name: 'Sim birinchilar ' + Date.now() });
    check('Guruh yaratildi', g.status < 300, `${g.status}`);
    created.groups.push(g.data.id);
    await call('POST', `/ops/driver-groups/${g.data.id}/members`, ADM, { driverId: a.driverId });
    const again = await call('POST', `/ops/driver-groups/${g.data.id}/members`, ADM, { driverId: a.driverId });
    check('Takror qo‘shish xato bermaydi', again.status < 300, String(again.status));
    const groupsOfA = await call('GET', `/ops/drivers/${a.driverId}/groups`, ADM);
    check('Haydovchi guruhlari ro‘yxatida', groupsOfA.data?.some((x) => x.id === g.data.id));

    const p1 = await promo({ name: 'Yangi yil', groupId: g.data.id, commissionDiscountPercent: 100, bonusPerOrder: 300 });
    check('Aksiya yaratildi', p1.status < 300, `${p1.status} ${JSON.stringify(p1.data)}`);
    const inGroup = await trip(a);
    check('Guruh a’zosi: to‘lov yo‘q, +300 bonus', inGroup.net === 300 && inGroup.types === 'bonus', JSON.stringify(inGroup));
    const outGroup = await trip(b);
    check(`Guruhda yo‘q haydovchi: odatdagidek -${FEE}`, outGroup.net === -FEE, JSON.stringify(outGroup));

    console.log('\n--- 2: sana oralig‘i ---');
    await call('PUT', `/ops/promotions/${p1.data.id}`, ADM, { startsAt: new Date(Date.now() + DAY).toISOString() });
    const list = await call('GET', '/ops/promotions', ADM);
    check('Kelajak boshlanish: holat "scheduled"', list.data?.find((x) => x.id === p1.data.id)?.state === 'scheduled');
    const future = await trip(a);
    check('Hali boshlanmagan aksiya ishlamaydi', future.net === -FEE, JSON.stringify(future));

    await call('PUT', `/ops/promotions/${p1.data.id}`, ADM, {
      startsAt: new Date(Date.now() - 2 * DAY).toISOString(),
      endsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const ended = await trip(a);
    check('Tugash vaqti o‘tgan aksiya o‘zi to‘xtaydi', ended.net === -FEE, JSON.stringify(ended));

    await call('PUT', `/ops/promotions/${p1.data.id}`, ADM, { startsAt: null, endsAt: null, active: false });
    const off = await trip(a);
    check('Qo‘lda o‘chirilgan aksiya ishlamaydi', off.net === -FEE, JSON.stringify(off));
    await call('PUT', `/ops/promotions/${p1.data.id}`, ADM, { active: true });

    console.log('\n--- 3: barchaga va bir nechta aksiya ---');
    const p2 = await promo({ name: 'Hammaga yarim', commissionDiscountPercent: 50, bonusPerOrder: 100 });
    check('Barchaga aksiya yaratildi', p2.status < 300, `${p2.status}`);
    const allB = await trip(b);
    check(`Guruhsiz haydovchi: -${FEE / 2} to‘lov, +100 bonus`, allB.net === -(FEE / 2) + 100, JSON.stringify(allB));
    const bothA = await trip(a);
    check('Ikkala aksiya: QO‘SHILMAYDI (100% chegirma, bonus 300, 400 emas)', bothA.net === 300, JSON.stringify(bothA));

    console.log('\n--- 4: himoya ---');
    const inUse = await call('DELETE', `/ops/driver-groups/${g.data.id}`, ADM);
    check('Aksiyadagi guruhni o‘chirib bo‘lmaydi (409)', inUse.status === 409, String(inUse.status));
    const badPct = await call('POST', '/ops/promotions', ADM, { name: 'X', commissionDiscountPercent: 150, bonusPerOrder: 0 });
    check('Chegirma 150% -> 400', badPct.status === 400, String(badPct.status));
    const badWindow = await promo({
      name: 'X', commissionDiscountPercent: 10, bonusPerOrder: 0,
      startsAt: new Date(Date.now() + DAY).toISOString(), endsAt: new Date().toISOString(),
    });
    check('Tugash boshlanishdan oldin -> 400', badWindow.status === 400, String(badWindow.status));
    const empty = await promo({ name: 'Bo‘sh', commissionDiscountPercent: 0, bonusPerOrder: 0 });
    check('Chegirmasiz va bonussiz aksiya -> 400', empty.status === 400, String(empty.status));
    const asDriver = await call('GET', '/ops/promotions', { authorization: 'Bearer ' + a.token });
    check('Haydovchi tokeni -> 403', asDriver.status === 403, String(asDriver.status));

    a.socket.close();
    b.socket.close();
  } finally {
    // Barchaga tegadigan aksiya boshqa simlarning hisobini buzmasin.
    await clearPromos();
    for (const id of created.groups) await call('DELETE', `/ops/driver-groups/${id}`, ADM);
  }

  console.log(`\n=== Natija: ${passed} o'tdi, ${failed} yiqildi ===\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('SIM XATOSI:', e); process.exit(1); });
