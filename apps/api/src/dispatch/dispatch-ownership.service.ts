import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS, REDIS_SUB } from '../redis/redis.module';

/** Egaga yo'naltiriladigan xabar (haydovchi javobi). */
export interface DispatchResponseMsg {
  orderId: string;
  driverId: string;
  accept: boolean;
}

const CHANNEL = 'dispatch:response';
const ownerKey = (orderId: string) => `dispatch:owner:${orderId}`;

/**
 * Dispatch EGALIGI — ko'p instansiyada to'g'ri ishlash uchun.
 *
 * MUAMMO: dispatch holati (taklif oynasi, `setTimeout` taymerlari) jarayon
 * xotirasida. Ikkinchi instansiya qo'shilsa: (a) ikkalasi bir zakazni dispatch
 * qilib, haydovchi ikki marta taklif olardi; (b) haydovchining javobi uning
 * socketi ulangan instansiyaga tushadi — agar u dispatch'ni boshqarmayotgan
 * bo'lsa, javob jimgina yo'qolardi.
 *
 * YECHIM: har zakazni AYNAN BITTA instansiya boshqaradi (Redis'da `SET NX` bilan
 * olingan egalik). Boshqa instansiyaga tushgan javob Redis pub/sub orqali egasiga
 * uzatiladi. Egalik TTL bilan — instansiya o'lsa, kalit muddati tugaydi va zakazni
 * boshqasi `recoverOrphans()` orqali oladi.
 *
 * Nega to'liq BullMQ emas: dispatch mahsulotning yuragi va uning holat mashinasi
 * allaqachon sinovdan o'tgan. Egalik modeli o'sha mantiqni saqlagan holda ko'p
 * instansiya to'g'riligini beradi — qayta yozishdan ko'ra ancha kam xavf bilan.
 */
@Injectable()
export class DispatchOwnershipService implements OnModuleDestroy {
  private readonly log = new Logger(DispatchOwnershipService.name);
  /** Shu jarayonning nomi — loglarda va egalik kalitida ko'rinadi. */
  readonly instanceId = randomUUID();

  /** Egalik muddati. Heartbeat shundan qisqaroq oraliqda yangilab turadi. */
  private static readonly TTL_SEC = 90;
  private static readonly HEARTBEAT_MS = 30_000;

  private readonly owned = new Set<string>();
  private heartbeat?: NodeJS.Timeout;
  private onResponse?: (m: DispatchResponseMsg) => void;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUB) private readonly sub: Redis,
  ) {}

  /** Egaga kelgan javoblarni qayta ishlovchini ro'yxatdan o'tkazish (DispatchService). */
  async listen(handler: (m: DispatchResponseMsg) => void): Promise<void> {
    this.onResponse = handler;
    await this.sub.subscribe(CHANNEL);
    this.sub.on('message', (ch, raw) => {
      if (ch !== CHANNEL) return;
      try {
        const msg = JSON.parse(raw) as DispatchResponseMsg & { owner: string };
        // Faqat BIZGA tegishli zakazlar (o'z xabarimizni ham qayta ishlamaymiz).
        if (msg.owner !== this.instanceId || !this.owned.has(msg.orderId)) return;
        this.onResponse?.(msg);
      } catch {
        /* buzuq xabar — e'tiborsiz */
      }
    });

    this.heartbeat = setInterval(() => {
      void this.refresh();
    }, DispatchOwnershipService.HEARTBEAT_MS);
  }

  /** Zakaz egaligini olish. `false` — boshqa instansiya boshqarmoqda. */
  async acquire(orderId: string): Promise<boolean> {
    const ok = await this.redis
      .set(ownerKey(orderId), this.instanceId, 'EX', DispatchOwnershipService.TTL_SEC, 'NX')
      .catch(() => null);
    if (ok === 'OK') {
      this.owned.add(orderId);
      return true;
    }
    // Allaqachon bizniki bo'lishi mumkin (qayta dispatch).
    const cur = await this.redis.get(ownerKey(orderId)).catch(() => null);
    if (cur === this.instanceId) {
      this.owned.add(orderId);
      return true;
    }
    return false;
  }

  async release(orderId: string): Promise<void> {
    this.owned.delete(orderId);
    // Faqat o'zimiznikini o'chiramiz — boshqa instansiya olgan bo'lsa tegmaymiz.
    const cur = await this.redis.get(ownerKey(orderId)).catch(() => null);
    if (cur === this.instanceId) await this.redis.del(ownerKey(orderId)).catch(() => {});
  }

  isOwner(orderId: string): boolean {
    return this.owned.has(orderId);
  }

  /**
   * Javobni egasiga yuborish. `true` — uzatildi (yoki egasi yo'q, chaqiruvchi
   * o'zi hal qiladi), `false` — biz egasimiz, lokal ishlash kerak.
   */
  async forwardResponse(msg: DispatchResponseMsg): Promise<boolean> {
    if (this.owned.has(msg.orderId)) return false; // o'zimiznikimiz
    const owner = await this.redis.get(ownerKey(msg.orderId)).catch(() => null);
    if (!owner) return false; // egasi yo'q — chaqiruvchi lokal urinadi
    await this.redis.publish(CHANNEL, JSON.stringify({ ...msg, owner })).catch(() => {});
    return true;
  }

  private async refresh(): Promise<void> {
    for (const orderId of this.owned) {
      await this.redis
        .set(ownerKey(orderId), this.instanceId, 'EX', DispatchOwnershipService.TTL_SEC)
        .catch(() => {});
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    // Egalikni bo'shatamiz — TTL tugashini kutmasdan boshqa instansiya olsin.
    const ids = [...this.owned];
    this.owned.clear();
    for (const orderId of ids) {
      const cur = await this.redis.get(ownerKey(orderId)).catch(() => null);
      if (cur === this.instanceId) await this.redis.del(ownerKey(orderId)).catch(() => {});
    }
    if (ids.length > 0) this.log.warn(`${ids.length} ta dispatch egaligi bo'shatildi`);
  }
}
