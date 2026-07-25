import { CONFIG } from './config';

// API klient (ichki kalit bilan) — bot backend nomidan chaqiradi.
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(CONFIG.apiBaseUrl + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-internal-key': CONFIG.internalKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export interface Customer {
  id: string;
  language: string;
  phone: string | null;
}

export const apiClient = {
  upsertCustomer(data: {
    telegramId: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    language?: string;
  }) {
    return req<Customer>('POST', '/customers/upsert', data);
  },

  createOrder(data: {
    customerId: string;
    category: string;
    pickup: { lat: number; lng: number };
    destination?: { lat: number; lng: number };
    note?: string;
  }) {
    return req<{ id: string; status: string }>('POST', '/orders', data);
  },

  cancelOrder(orderId: string) {
    return req<{ penalized: boolean }>('POST', `/orders/${orderId}/cancel`, { reason: 'customer' });
  },

  rateDriver(orderId: string, score: number) {
    return req('POST', '/ratings/customer-to-driver', {
      orderId,
      scores: { manners: score, driving: score, car_condition: score, punctuality: score },
    });
  },
};
