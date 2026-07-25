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
