// Demo uchun doimiy onlayn haydovchi: taklifni qabul qiladi va safarni bosqichma-bosqich
// yakunlaydi (kechikishlar bilan — mijoz Telegram'da har bosqichni ko'radi).
import { io } from 'socket.io-client';

const API = process.env.API_BASE_URL || 'http://localhost:3000';
// Haydovchi joyi — buyurtma yaratilganda mijoz lokatsiyasiga yaqinlashtiramiz emas,
// balki katta radius bilan har qanday buyurtmani qamraymiz (demo API sozlamasi).
const loc = { lat: 41.311, lng: 69.24 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(m, p, b, h = {}) {
  const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : {};
}

async function main() {
  const phone = '+998901112233';
  const otp = await j('POST', '/auth/driver/otp', { phone });
  const v = await j('POST', '/auth/driver/verify', { phone, code: otp.devCode });
  await j('POST', '/drivers/register', {
    firstName: 'Demo', lastName: 'Haydovchi',
    vehicle: { category: 'standard', plate: '01 A 777 AA', make: 'Chevrolet', model: 'Cobalt', color: 'oq' },
  }, { authorization: 'Bearer ' + v.token });

  const s = io(API + '/driver', { auth: { token: v.token }, transports: ['websocket'] });
  const busy = new Set();
  s.on('connect', async () => {
    await new Promise((r) => s.emit('driver:online', {}, r));
    s.emit('driver:location', loc);
    console.log('[demo-driver] onlayn, taklif kutmoqda…');
  });
  setInterval(() => s.emit('driver:location', loc), 8000);

  s.on('order:offer', async (o) => {
    if (busy.has(o.orderId)) return;
    busy.add(o.orderId);
    console.log('[demo-driver] taklif keldi → qabul qilinmoqda', o.orderId);
    s.emit('driver:offer_response', { orderId: o.orderId, accept: true });
    await sleep(5000);
    s.emit('trip:arrived', { orderId: o.orderId });
    console.log('[demo-driver] yetib keldim');
    await sleep(4000);
    s.emit('trip:start', { orderId: o.orderId });
    console.log('[demo-driver] safar boshlandi');
    await sleep(7000);
    s.emit('trip:complete', { orderId: o.orderId, distanceM: 4200 });
    console.log('[demo-driver] safar yakunlandi');
    setTimeout(() => busy.delete(o.orderId), 30000);
  });
  s.on('order:offer_cancelled', (o) => busy.delete(o.orderId));
}
main().catch((e) => { console.error('[demo-driver] xato:', e.message); process.exit(1); });
