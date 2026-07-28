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

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export type GeoSearchResult =
  | { kind: 'found'; places: Place[] }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

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
    destAddress?: string;
    note?: string;
  }) {
    return req<{ id: string; status: string }>('POST', '/orders', data);
  },

  cancelOrder(orderId: string) {
    return req<{ penalized: boolean }>('POST', `/orders/${orderId}/cancel`, { reason: 'customer' });
  },

  // Geokodlash yoqilganmi (bot ishga tushganda bir marta so'raladi).
  geoStatus() {
    return req<{ geocoding: boolean; routing: boolean }>('GET', '/geo/status');
  },

  /**
   * Manzil qidirish. Natijani UCH HOLATGA ajratamiz — avval hammasi bo'sh
   * ro'yxatga aylanib, "topilmadi" bilan "xizmat ishlamayapti" farqlanmasdi:
   *   found     — variantlar bor, mijoz tanlaydi
   *   not_found — qidiruv ishladi, lekin hech narsa topilmadi (mijozga aytamiz)
   *   error     — xizmat o'chiq yoki nosoz (jimgina matn bilan davom etamiz)
   */
  async searchPlace(q: string): Promise<GeoSearchResult> {
    try {
      const places = await req<Place[]>('GET', `/geo/search?q=${encodeURIComponent(q)}`);
      return places.length > 0 ? { kind: 'found', places } : { kind: 'not_found' };
    } catch (e) {
      return { kind: 'error', message: (e as Error).message };
    }
  },

  // Zakaz holatini olish (bot stale activeOrderId'ni tekshirishi uchun).
  getOrder(orderId: string) {
    return req<{ id: string; status: string } | null>('GET', `/orders/${orderId}`);
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
