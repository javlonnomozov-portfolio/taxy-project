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
  /** Ilova kirishini tasdiqlash — 6 xonali kod qaytaradi. */
  confirmCustomerLogin(nonce: string, telegramId: string) {
    return req<{ code: string }>('POST', '/auth/customer/confirm', { nonce, telegramId });
  },

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

  // Zakaz holatini olish (bot stale activeOrderId'ni tekshirishi uchun).
  getOrder(orderId: string) {
    return req<{ id: string; status: string; vehicleCategory?: string } | null>('GET', `/orders/${orderId}`);
  },

  /** Comfort topilmadi — mijoz roziligi bilan Standart'ga o'tkazib qayta qidirish. */
  switchToStandard(orderId: string) {
    return req<{ ok: true; category: string }>('POST', `/orders/${orderId}/switch-standard`, {});
  },

  // Biriktirilgan taksining oxirgi joylashuvi va holati (mijozga ko'rsatish uchun).
  driverLocation(orderId: string) {
    return req<{
      orderStatus: string;
      driverStatus: string;
      lat: number;
      lng: number;
      at: string | null;
    } | null>('GET', `/orders/${orderId}/driver-location`);
  },

  rateDriver(orderId: string, score: number) {
    return req('POST', '/ratings/customer-to-driver', {
      orderId,
      scores: { manners: score, driving: score, car_condition: score, punctuality: score },
    });
  },
};
