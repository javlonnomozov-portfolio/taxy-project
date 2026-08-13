import { API_URL } from './config';

/**
 * Token yaroqsiz bo'lganda (muddati tugagan / hisob bloklangan) chaqiriladi.
 *
 * Busiz ilova qulflanib qolardi: token 7 kundan keyin tugaydi, server soketni
 * "jwt expired" bilan uzadi, ilova esa buni bilmay cheksiz "Ulanmoqda…" da
 * aylanaverardi. Haydovchi uchun ilova shunchaki ISHLAMAY qolardi.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // 401 FAQAT token yuborilgan so'rovda sessiya tugaganini bildiradi.
  // Login so'rovida (token yo'q) 401 — bu shunchaki "parol noto'g'ri".
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).message ?? text;
    } catch {
      /* ignore */
    }
    throw new Error(typeof msg === 'string' ? msg : 'Xatolik');
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export interface LoginResult {
  token: string;
  driverId: string;
  mustChangePassword: boolean;
}

export const driverApi = {
  login: (phone: string, password: string) =>
    api<LoginResult>('POST', '/auth/driver/login', { phone, password }),
  changePassword: (newPassword: string, token: string) =>
    api('POST', '/auth/driver/change-password', { newPassword }, token),
  me: (token: string) => api('GET', '/drivers/me', undefined, token),
};
