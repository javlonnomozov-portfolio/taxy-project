// Xavfsizlik tekshiruvi: bloklangan hisob, rol huquqi, CORS.
import { io } from 'socket.io-client';
import { jx, adminLogin, createDriver } from './helpers.mjs';

const API = process.env.API_URL || 'http://localhost:3000';
const j = (m, p, b, h) => jx(API, m, p, b, h);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${x}`)); };
const status = async (fn) => { try { await fn(); return 200; } catch (e) { const m = /→ (\d{3})/.exec(e.message); return m ? +m[1] : 0; } };

const adminToken = await adminLogin(API);
const H = { authorization: 'Bearer ' + adminToken };

console.log('\n=== TTY xavfsizlik simulyatsiyasi ===\n');

console.log('--- Bloklangan haydovchi tokeni ---');
const drv = await createDriver(API, adminToken, {
  phone: '+998937770001', firstName: 'Blok',
  vehicle: { make: 'X', model: 'Y', plate: 'BL001', category: 'standard' },
});
const D = { authorization: 'Bearer ' + drv.token };

check('Blokdan OLDIN /drivers/me ishlaydi', (await status(() => j('GET', '/drivers/me', null, D))) === 200);

const sock = io(API + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
let revoked = false, disconnected = false;
sock.on('session:revoked', () => { revoked = true; });
sock.on('disconnect', () => { disconnected = true; });
await new Promise((r) => sock.on('connect', r));
check('Blokdan OLDIN socket ulanadi', sock.connected);

await j('POST', `/ops/drivers/${drv.driverId}/block`, {}, H);
await sleep(600);

const codeAfter = await status(() => j('GET', '/drivers/me', null, D));
check('Blokdan KEYIN eski token RAD ETILADI (401)', codeAfter === 401, `(keldi ${codeAfter})`);
check('Ochiq socket majburan uzildi', disconnected, `(revoked-event=${revoked})`);

const sock2 = io(API + '/driver', { auth: { token: drv.token }, transports: ['websocket'] });
await sleep(800);
check('Bloklangan haydovchi qayta ulana OLMAYDI', !sock2.connected);
sock2.close(); sock.close();

await j('POST', `/ops/drivers/${drv.driverId}/approve`, {}, H);
await sleep(300);
check('Blok ochilgach token yana ishlaydi', (await status(() => j('GET', '/drivers/me', null, D))) === 200);

console.log('\n--- Rol huquqi (403, 401 emas) ---');
const roleCode = await status(() => j('GET', '/ops/drivers', null, D)); // haydovchi ops'ga
check('Haydovchi /ops/drivers ga 403 oladi', roleCode === 403, `(keldi ${roleCode})`);
const noTokenCode = await status(() => j('GET', '/ops/drivers', null, {}));
check('Tokensiz so\'rov 401 oladi', noTokenCode === 401, `(keldi ${noTokenCode})`);

console.log('\n--- Xavfsizlik sarlavhalari (helmet) ---');
const res = await fetch(API + '/health');
check('X-Content-Type-Options mavjud', res.headers.get('x-content-type-options') === 'nosniff');
check('X-Powered-By yashirilgan', !res.headers.get('x-powered-by'), `(${res.headers.get('x-powered-by')})`);

console.log(`\n=== Natija: ${pass} ✅ / ${fail} ❌ ===\n`);
process.exit(fail ? 1 : 0);
