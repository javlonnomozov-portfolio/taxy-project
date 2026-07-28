// KO'P INSTANSIYA testi: dispatch ikkita API instansiyasida to'g'ri ishlaydimi?
//
// Stsenariy (eng muhim holat): zakaz A-instansiyada yaratiladi (u dispatch egasi
// bo'ladi), haydovchi esa B-instansiyaga ulangan. Ya'ni:
//   - taklif A dan chiqib, Redis adapter orqali B dagi socketga yetishi kerak;
//   - haydovchining javobi B ga tushib, pub/sub orqali A ga uzatilishi kerak.
// Egalik/uzatishsiz haydovchi taklifni ko'rmasdi yoki javobi yo'qolardi.
import { io } from 'socket.io-client';
import { jx, adminLogin, createDriver } from './helpers.mjs';

const A = process.env.API_A || 'http://localhost:3000';
const B = process.env.API_B || 'http://localhost:3001';
const KEY = process.env.INTERNAL_API_KEY || 'dev_internal_key';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${x}`)); };
async function waitFor(fn, ms = 8000, step = 100) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(step); }
  return false;
}

console.log(`\n=== TTY klaster simulyatsiyasi (A=${A}, B=${B}) ===\n`);

const token = await adminLogin(A);
const H = { authorization: 'Bearer ' + token };
const drv = await createDriver(A, token, {
  phone: '+998944445555', firstName: 'Klaster',
  vehicle: { make: 'Chevrolet', model: 'Nexia', plate: 'CL001', category: 'standard' },
});
const customer = await jx(A, 'POST', '/customers/upsert',
  { telegramId: '960000001', phone: '+998944440001' }, { 'x-internal-key': KEY });

// Haydovchi B-instansiyaga ulanadi (zakaz A da yaratiladi).
const s = io(B + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
const offers = [];
let assigned = null;
s.on('order:offer', (o) => offers.push(o));
s.on('order:assigned', (a) => { assigned = a; });
await new Promise((r) => s.on('connect', r));
await new Promise((res) => s.emit('driver:online', {}, res));
s.emit('driver:location', { lat: 39.7683, lng: 67.2792 });
await sleep(500);
check('Haydovchi B-instansiyaga ulandi va onlayn', true);

// Zakaz A-instansiyada.
const order = await jx(A, 'POST', '/orders',
  { customerId: customer.id, category: 'standard', pickup: { lat: 39.7683, lng: 67.2792 } },
  { 'x-internal-key': KEY });

check('A da yaratilgan zakaz taklifi B dagi haydovchiga yetdi',
  await waitFor(() => offers.some((o) => o.orderId === order.id)),
  '(Redis adapter ishlamayapti)');

// Javob B ga tushadi → pub/sub orqali A (egasi) ga uzatilishi kerak.
s.emit('driver:offer_response', { orderId: order.id, accept: true });

check('B ga kelgan javob A dagi egasiga uzatildi (zakaz ACCEPTED)',
  await waitFor(async () => (await jx(A, 'GET', `/orders/${order.id}`, null, { 'x-internal-key': KEY })).status === 'ACCEPTED'),
  '(javob yo\'qoldi — pub/sub uzatish ishlamayapti)');

check('Haydovchi order:assigned oldi', await waitFor(() => assigned?.orderId === order.id));

// Ikkala instansiya ham bir xil holatni ko'radi (umumiy DB).
const viaB = await jx(B, 'GET', `/orders/${order.id}`, null, { 'x-internal-key': KEY });
check('B ham zakazni ACCEPTED ko\'radi', viaB.status === 'ACCEPTED', `(${viaB.status})`);

// Ikki marta taklif yuborilmaganini tekshiramiz.
const dupes = offers.filter((o) => o.orderId === order.id).length;
check('Haydovchi taklifni AYNAN BIR MARTA oldi (ikkala instansiya dispatch qilmadi)',
  dupes === 1, `(${dupes} marta)`);

s.close();
console.log(`\n=== Natija: ${pass} ✅ / ${fail} ❌ ===\n`);
process.exit(fail ? 1 : 0);
