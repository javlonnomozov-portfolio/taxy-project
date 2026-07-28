import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distanceM: number;
  durationSec: number;
}

/**
 * Manzil qidirish (Nominatim) va marshrut (OSRM) — BACKEND PROKSI orqali.
 *
 * Nega klientdan to'g'ridan emas:
 *  - Nominatim'ning foydalanish shartlari aniq `User-Agent` va soniyasiga 1 so'rov
 *    chegarasini talab qiladi. Har bir bot/ilova foydalanuvchisi o'zi so'rasa,
 *    umumiy IP bo'yicha limit tez tugab, xizmat bloklanadi.
 *  - Kesh markazlashgan bo'ladi: bir xil so'rov (masalan "Registon") bir marta
 *    so'raladi va Redis'da saqlanadi.
 *  - Servis manzilini (self-host OSRM) klientlarga tarqatish shart emas.
 *
 * Sozlanmagan bo'lsa (`NOMINATIM_URL` / `OSRM_URL` yo'q) — 503 qaytaradi va
 * chaqiruvchi manzilsiz davom etadi (manzil MVP'da ixtiyoriy).
 */
@Injectable()
export class GeocodingService {
  private readonly log = new Logger(GeocodingService.name);
  private static readonly CACHE_SEC = 24 * 3600;
  private static readonly TIMEOUT_MS = 5000;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  private get nominatim(): string | undefined {
    return this.config.get<string>('NOMINATIM_URL');
  }
  private get osrm(): string | undefined {
    return this.config.get<string>('OSRM_URL');
  }

  /** Nominatim shartlari: o'zini tanitadigan User-Agent MAJBURIY. */
  private get userAgent(): string {
    return this.config.get<string>('GEO_USER_AGENT') ?? 'ToyTaxY/1.0 (taxi dispatch)';
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), GeocodingService.TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'uz,ru' },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Matn bo'yicha joy qidirish (avtoto'ldirish uchun). */
  async search(query: string, limit = 5): Promise<Place[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    if (!this.nominatim) throw new ServiceUnavailableException('Geokodlash sozlanmagan');

    const key = `geo:search:${q.toLowerCase()}:${limit}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached) as Place[];

    const url =
      `${this.nominatim}/search?format=jsonv2&limit=${limit}` +
      `&countrycodes=uz&q=${encodeURIComponent(q)}`;
    try {
      const raw = await this.fetchJson<Array<{ display_name: string; lat: string; lon: string }>>(url);
      const places: Place[] = raw.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
      }));
      await this.redis.set(key, JSON.stringify(places), 'EX', GeocodingService.CACHE_SEC).catch(() => {});
      return places;
    } catch (e) {
      this.log.warn(`Nominatim search xato (${q}): ${(e as Error).message}`);
      throw new ServiceUnavailableException('Manzil qidirish hozir ishlamayapti');
    }
  }

  /** Koordinatadan manzil (haydovchi/mijoz nuqtasini nomlash uchun). */
  async reverse(lat: number, lng: number): Promise<Place | null> {
    if (!this.nominatim) throw new ServiceUnavailableException('Geokodlash sozlanmagan');
    // 5 xona ≈ 1 m — keshni samarali qilish uchun yaxlitlaymiz.
    const key = `geo:rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached) as Place;

    const url = `${this.nominatim}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    try {
      const r = await this.fetchJson<{ display_name?: string }>(url);
      if (!r.display_name) return null;
      const place: Place = { label: r.display_name, lat, lng };
      await this.redis.set(key, JSON.stringify(place), 'EX', GeocodingService.CACHE_SEC).catch(() => {});
      return place;
    } catch (e) {
      this.log.warn(`Nominatim reverse xato: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Manzilni aniqlab bo‘lmadi');
    }
  }

  /**
   * Ikki nuqta orasidagi HAQIQIY yo'l masofasi (taxminiy narx uchun).
   * Eslatma: yakuniy narx haydovchi taksometridagi haqiqiy km bo'yicha
   * hisoblanadi — bu faqat oldindan ko'rsatiladigan taxmin.
   */
  async route(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteInfo> {
    if (!this.osrm) throw new ServiceUnavailableException('Marshrut xizmati sozlanmagan');
    const key = `geo:route:${from.lat.toFixed(4)},${from.lng.toFixed(4)}:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) return JSON.parse(cached) as RouteInfo;

    const url =
      `${this.osrm}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=false&alternatives=false`;
    try {
      const r = await this.fetchJson<{ routes?: Array<{ distance: number; duration: number }> }>(url);
      const first = r.routes?.[0];
      if (!first) throw new Error('marshrut topilmadi');
      const info: RouteInfo = {
        distanceM: Math.round(first.distance),
        durationSec: Math.round(first.duration),
      };
      await this.redis.set(key, JSON.stringify(info), 'EX', GeocodingService.CACHE_SEC).catch(() => {});
      return info;
    } catch (e) {
      this.log.warn(`OSRM route xato: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Marshrutni hisoblab bo‘lmadi');
    }
  }

  /** Xizmatlar sozlanganmi (klient UI'da qidiruvni ko'rsatish/yashirish uchun). */
  status(): { geocoding: boolean; routing: boolean } {
    return { geocoding: !!this.nominatim, routing: !!this.osrm };
  }
}
