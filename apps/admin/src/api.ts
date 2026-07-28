// API klient — bearer token bilan.
export const API_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'tty_admin_token';
const ROLE_KEY = 'tty_admin_role';

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get role() {
    return localStorage.getItem(ROLE_KEY);
  },
  set(token: string, role: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
};

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth.token ? { authorization: 'Bearer ' + auth.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    auth.clear();
    location.href = '/login';
  }
  const text = await res.text();
  if (!res.ok) throw new Error(errorMessage(text, res.status));
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * API bir xil xato shaklini qaytaradi: `{ statusCode, code, message, requestId }`.
 * Foydalanuvchiga xom JSON emas, o'qiladigan matn ko'rsatamiz.
 */
export function errorMessage(text: string, status: number): string {
  if (!text) return `Xatolik (${status})`;
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    return msg || `Xatolik (${status})`;
  } catch {
    return text;
  }
}
