// Poyga shartlari simulyatsiyasi — pul yo'qotadigan holatlarni tekshiradi.
//
// Simlar odatda ketma-ket oqimni tekshiradi; bu skript ATAYLAB parallel
// operatsiyalar yuboradi va invariantlarni tasdiqlaydi:
//   1. `complete` va `cancel` bir vaqtda → faqat BITTASI o'tadi.
//   2. Komissiya AYNAN BIR MARTA yechiladi (yoki umuman yechilmaydi).
//   3. Parallel `topup`'larda balans yo'qolmaydi (lost update yo'q).
//   4. Parallel `trackSync`'da GPS nuqtalari yo'qolmaydi.
//
// Ishga tushirish: API + Postgres + Redis ko'tarilgan holda `node scripts/race-sim.mjs`
import { io } from 'socket.io-client';
import { jx, adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_URL || 'http://localhost:3000';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const j = (m, p, b, h) => jx(API, m, p, b, h);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function waitFor(fn, ms = 4000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

const emitAck = (s, ev, data) =>
  new Promise((res) => {
    let done = false;
    s.emit(ev, data, (r) => {
      done = true;
      res(r);
    });
    setTimeout(() => !done && res(null), 4000);
  });

const pickup = { lat: 39.7683, lng: 67.2792 };

async function main() {
  console.log(`\n=== TTY poyga (race) simulyatsiyasi (${API}) ===\n`);
  const adminToken = await adminLogin(API);
  const H = { authorization: 'Bearer ' + adminToken };

  const drv = await createDriver(API, adminToken, {
    phone: '+998935550001',
    firstName: 'Poyga',
    vehicle: { make: 'Chevrolet', model: 'Cobalt', plate: '01R001RA', category: 'standard' },
  });
  // Foiz billing — komissiya bo'lishi uchun.
  await j('PUT', `/ops/drivers/${drv.driverId}/billing`, { mode: 'percent', config: { percent: 10 } }, H);

  const customer = await j('POST', '/customers/upsert', { telegramId: '950000001', phone: '+998935559001' }, { 'x-internal-key': KEY });

  const s = io(API + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
  s.offers = [];
  s.on('order:offer', (o) => s.offers.push(o));
  await new Promise((r) => s.on('connect', r));
  await emitAck(s, 'driver:online', {});
  s.emit('driver:location', pickup);
  await sleep(300);

  // DIQQAT: bu yerda ataylab joylashuvni QAYTA YUBORMAYMIZ — safar tugagach
  // `markIdle()` haydovchini geo-indeksga o'zi qaytarishi kerak (aks holda ikkinchi
  // zakaz NO_DRIVER bo'lib qoladi). Ya'ni bu funksiya markIdle uchun ham testdir.
  // `gotOffer` — taklif kelganini bildiradi (markIdle geo tiklanishining isboti).
  async function newTripInProgress() {
    s.offers = [];
    const o = await j('POST', '/orders', { customerId: customer.id, category: 'standard', pickup }, { 'x-internal-key': KEY });
    const gotOffer = await waitFor(() => s.offers.some((x) => x.orderId === o.id));
    if (!gotOffer) return { order: o, gotOffer: false, inProgress: false };
    s.emit('driver:offer_response', { orderId: o.id, accept: true });
    await waitFor(async () => (await j('GET', `/orders/${o.id}`, null, { 'x-internal-key': KEY })).status === 'ACCEPTED');
    await emitAck(s, 'trip:arrived', { orderId: o.id });
    await emitAck(s, 'trip:start', { orderId: o.id });
    const inProgress = await waitFor(
      async () => (await j('GET', `/orders/${o.id}`, null, { 'x-internal-key': KEY })).status === 'IN_PROGRESS',
    );
    return { order: o, gotOffer, inProgress };
  }

  const balanceOf = async () => {
    const txns = await j('GET', `/ops/drivers/${drv.driverId}/transactions`, null, H);
    return txns;
  };

  // --- Test 1: complete vs cancel bir vaqtda ---
  console.log('--- Test 1: `complete` va `cancel` bir vaqtda ---');
  const t1 = await newTripInProgress();
  const o1 = t1.order;
  check('1-safar boshlandi (IN_PROGRESS)', t1.inProgress);
  const txnsBefore = await balanceOf();

  const [completeRes, cancelRes] = await Promise.allSettled([
    emitAck(s, 'trip:complete', { orderId: o1.id, distanceM: 5000 }),
    j('POST', `/orders/${o1.id}/cancel`, { reason: 'poyga' }, { 'x-internal-key': KEY }),
  ]);

  const final1 = await j('GET', `/orders/${o1.id}`, null, { 'x-internal-key': KEY });
  const completedOk = completeRes.status === 'fulfilled' && completeRes.value?.ok !== false;
  const cancelOk = cancelRes.status === 'fulfilled';

  check(
    'Zakaz yakuniy holati izchil (COMPLETED yoki CANCELLED, ikkalasi emas)',
    ['COMPLETED', 'CANCELLED_BY_CUSTOMER'].includes(final1.status),
    `(status=${final1.status})`,
  );
  check(
    'Faqat bitta operatsiya g\'olib chiqdi',
    completedOk !== cancelOk || final1.status === 'COMPLETED',
    `(complete=${completedOk} cancel=${cancelOk} status=${final1.status})`,
  );

  const txnsAfter = await balanceOf();
  const newComm = txnsAfter.filter((t) => t.type === 'commission' && t.orderId === o1.id);
  check(
    'Komissiya ko\'pi bilan BIR MARTA yozildi',
    newComm.length <= 1,
    `(${newComm.length} ta)`,
  );
  check(
    'Bekor qilingan zakazdan komissiya yechilmadi',
    final1.status === 'COMPLETED' ? newComm.length === 1 : newComm.length === 0,
    `(status=${final1.status}, komissiya=${newComm.length})`,
  );
  check(
    'Barcha transaksiya summalari raqam (NaN yo\'q)',
    txnsAfter.every((t) => Number.isFinite(Number(t.amount)) && Number.isFinite(Number(t.balanceAfter))),
  );

  // --- Test 2: parallel to'ldirish (lost update) ---
  console.log('\n--- Test 2: parallel balans to\'ldirish (lost update yo\'qmi) ---');
  // DIQQAT: transaksiyalar ro'yxatiga tayanib bo'lmaydi — `created_at` `now()` bilan
  // to'ldiriladi, u esa Postgres'da TRANZAKSIYA BOSHLANISH vaqti, shuning uchun parallel
  // yozuvlarda `created_at` tartibi haqiqiy qo'llanish tartibiga mos kelmaydi.
  // Yagona ishonchli manba — haydovchining o'z balansi.
  const driverBalance = async () => {
    const list = await j('GET', '/ops/drivers', null, H);
    return Number(list.find((d) => d.id === drv.driverId).balance);
  };
  const beforeBal = await driverBalance();

  const N = 10;
  const AMOUNT = 1000;
  await Promise.all(
    Array.from({ length: N }, () =>
      j('POST', `/ops/drivers/${drv.driverId}/topup`, { amount: AMOUNT }, H),
    ),
  );
  const afterBal = await driverBalance();
  check(
    `${N} ta parallel to'ldirish to'liq qo'shildi (+${N * AMOUNT})`,
    afterBal === beforeBal + N * AMOUNT,
    `(kutilgan ${beforeBal + N * AMOUNT}, keldi ${afterBal})`,
  );
  const after = await j('GET', `/ops/drivers/${drv.driverId}/transactions`, null, H);
  const topupTxns = after.filter((t) => t.type === 'topup');
  const distinct = new Set(topupTxns.map((t) => Number(t.balanceAfter)));
  check(
    'Har to\'ldirish o\'z balanceAfter qiymatiga ega (takrorlanmagan)',
    distinct.size === topupTxns.length,
    `(${topupTxns.length} yozuv, ${distinct.size} xil qiymat)`,
  );

  // --- Test 3: parallel trek sinxronizatsiyasi ---
  console.log('\n--- Test 3: parallel GPS trek sinxronizatsiyasi ---');
  // Bu zakaz 1-testdan KEYIN yaratiladi, ya'ni haydovchi allaqachon bir safarni
  // tugatgan. Taklif kelishining o'zi `markIdle()` geo-indeksni tiklaganini isbotlaydi.
  const t3 = await newTripInProgress();
  check('Safardan keyin haydovchi YANA taklif oldi (markIdle geo-indeksni tikladi)', t3.gotOffer);
  const o3 = t3.order;
  const BATCHES = 8;
  const PER = 5;
  await Promise.all(
    Array.from({ length: BATCHES }, (_, b) =>
      emitAck(s, 'trip:track_sync', {
        orderId: o3.id,
        points: Array.from({ length: PER }, (_, i) => ({
          lat: pickup.lat + b / 10000,
          lng: pickup.lng + i / 10000,
          at: new Date(Date.now() + b * 1000 + i).toISOString(),
        })),
      }),
    ),
  );
  await sleep(500);
  await emitAck(s, 'trip:complete', { orderId: o3.id, distanceM: 1000 });
  // Trek nuqtalari DB'da (HTTP endpoint yo'q) — chaqiruvchi skript psql bilan tekshiradi.
  console.log(`  ℹ️  TRACK_CHECK orderId=${o3.id} kutilgan=${BATCHES * PER}`);

  s.close();
  console.log(`\n=== Natija: ${pass} ✅ / ${fail} ❌ ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('SIM XATO:', e.message);
  process.exit(1);
});
