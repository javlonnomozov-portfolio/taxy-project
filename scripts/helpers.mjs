// Sim/demo uchun umumiy yordamchilar (yangi driver oqimi: super-admin qo'shadi → temp parol → login).
export async function jx(API, method, path, body, headers = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : {};
}

export async function adminLogin(API, login = 'admin', password = process.env.ADMIN_PASSWORD || 'admin123') {
  const r = await jx(API, 'POST', '/auth/admin/login', { login, password });
  return r.token;
}

/**
 * Har ishga tushirishda YANGI telefon raqami.
 *
 * Qat'iy raqamli simlar bir marta ishlaydi: ikkinchi safar
 * "Bu telefon bilan haydovchi allaqachon mavjud" (403) bilan yiqiladi, chunki
 * lokal baza tozalanmaydi. Bu sabab bir necha sim "buzuq" ko'rinib turardi.
 */
export const simPhone = (prefix = '+99891') =>
  prefix + Math.floor(1000000 + Math.random() * 8999999);

/** Har ishga tushirishda yangi davlat raqami (mashina raqami ham unikal). */
export const simPlate = () =>
  '01' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
  Math.floor(100 + Math.random() * 899) +
  String.fromCharCode(65 + Math.floor(Math.random() * 26));

// Super-admin haydovchi qo'shadi, so'ng temp parol bilan login qiladi → {token, driverId}.
export async function createDriver(API, adminToken, { phone, firstName, lastName, vehicle }) {
  const res = await jx(
    API,
    'POST',
    '/ops/drivers',
    { phone, firstName, lastName, vehicle },
    { authorization: 'Bearer ' + adminToken },
  );
  const login = await jx(API, 'POST', '/auth/driver/login', { phone, password: res.tempPassword });
  return { token: login.token, driverId: login.driverId, tempPassword: res.tempPassword };
}
