import Redis from 'ioredis';
import { Lang } from './i18n';

export type Step = 'idle' | 'category' | 'pickup' | 'confirm';

export interface Draft {
  category?: string;
  pickup?: { lat: number; lng: number };
}

export interface Session {
  lang: Lang;
  customerId?: string;
  phone?: string;
  step: Step;
  draft: Draft;
  activeOrderId?: string;
  ratingOrderId?: string;
  lastLocShownAt?: number; // taksi joylashuvini ko'rsatish rate-limit (10s)
}

export const newSession = (): Session => ({ lang: 'uz', step: 'idle', draft: {} });

/** Sessiya 7 kun yashaydi — tashlab ketilgan suhbatlar Redis'da to'planib qolmasin. */
const TTL_SEC = 7 * 24 * 3600;
const key = (chatId: number) => `bot:session:${chatId}`;

export interface SessionStore {
  get(chatId: number): Promise<Session>;
  set(chatId: number, s: Session): Promise<void>;
  /** Yuklab → o'zgartirib → saqlash. Handler'dan TASHQARIDA (socket callback) kerak. */
  update(chatId: number, fn: (s: Session) => void): Promise<void>;
}

/**
 * Redis'dagi sessiya. Avval sessiyalar jarayon XOTIRASIDA (`Map`) edi, ya'ni:
 * bot qayta ishga tushsa yoki deploy bo'lsa — yarim qolgan buyurtma oqimlari
 * yo'qolardi; va ikkinchi instansiya qo'shib bo'lmasdi (foydalanuvchi qaysi
 * instansiyaga tushishiga qarab boshqa sessiyani ko'rardi).
 */
export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  async get(chatId: number): Promise<Session> {
    const raw = await this.redis.get(key(chatId)).catch(() => null);
    if (!raw) return newSession();
    try {
      // Yangi maydonlar qo'shilganda eski yozuvlar buzilmasin — default ustiga yoyamiz.
      return { ...newSession(), ...(JSON.parse(raw) as Session) };
    } catch {
      return newSession(); // buzuq yozuv — toza sessiyadan boshlaymiz
    }
  }

  async set(chatId: number, s: Session): Promise<void> {
    await this.redis.set(key(chatId), JSON.stringify(s), 'EX', TTL_SEC).catch(() => {});
  }

  async update(chatId: number, fn: (s: Session) => void): Promise<void> {
    const s = await this.get(chatId);
    fn(s);
    await this.set(chatId, s);
  }
}

/** REDIS_URL berilmaganda (lokal tez sinov / testlar) — xotiradagi zaxira. */
export class MemorySessionStore implements SessionStore {
  private readonly store = new Map<number, Session>();

  async get(chatId: number): Promise<Session> {
    return this.store.get(chatId) ?? newSession();
  }
  async set(chatId: number, s: Session): Promise<void> {
    this.store.set(chatId, s);
  }
  async update(chatId: number, fn: (s: Session) => void): Promise<void> {
    const s = await this.get(chatId);
    fn(s);
    await this.set(chatId, s);
  }
}

export function createSessionStore(redisUrl?: string): SessionStore {
  if (!redisUrl) {
    console.warn('[session] REDIS_URL yo‘q — sessiyalar xotirada (qayta ishga tushishda yo‘qoladi)');
    return new MemorySessionStore();
  }
  return new RedisSessionStore(new Redis(redisUrl));
}

export function resetDraft(s: Session): void {
  s.step = 'idle';
  s.draft = {};
}
