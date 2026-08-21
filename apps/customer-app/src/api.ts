import { API_URL } from './config';

/**
 * Token yaroqsiz bo'lganda (muddati tugagan / hisob bloklangan) chaqiriladi.
 *
 * Haydovchi ilovasida bu naqsh yo'q edi va token tugaganda ilova cheksiz
 * "Ulanmoqda…" da qotib qolgan edi. Shu xato takrorlanmasin.
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
