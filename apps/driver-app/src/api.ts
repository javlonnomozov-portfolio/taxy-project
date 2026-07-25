import { API_URL } from './config';

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
