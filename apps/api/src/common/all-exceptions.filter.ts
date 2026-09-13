import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type Redis from 'ioredis';

/** Bot shu kanalni tinglaydi (`apps/bot/src/alerts.ts`). */
export const BOT_ALERT_CHANNEL = 'bot:alert';

/** Bir xil xato haqida qayta xabar berishdan oldingi tinchlik oynasi. */
const ALERT_THROTTLE_MS = 5 * 60_000;
/** Bir daqiqada eng ko'pi shuncha xabar — xatolar "yomg'iri" chatni ko'mmasin. */
const ALERT_BURST_LIMIT = 5;
/** Throttle jadvali cheksiz o'smasin (har yangi kalit — bitta yozuv). */
const ALERT_KEYS_MAX = 200;

/**
 * Ulanish satrlaridagi parolni o'chiradi va matnni qisqartiradi.
 *
 * NEGA: xato matni Telegram chatiga ketadi. TypeORM/ioredis uzilish xatolari
 * ba'zan butun ulanish URL'ini (`redis://user:parol@host`) matnga qo'shadi —
 * u chatda, telefon bildirishnomasida va Telegram serverlarida qolib ketardi.
 */
function redact(text: string, max = 300): string {
  return text.replace(/:\/\/[^@\s/]*@/g, '://***@').slice(0, max);
}

/**
 * Yo'ldagi identifikatorlarni `:id` ga almashtiradi.
 *
 * Busiz har buyurtma alohida kalit bo'lib, bo'g'uv ishlamas edi: bitta buzuq
 * handler 100 ta zakaz uchun 100 ta xabar yuborardi.
 */
function routeKey(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{3,}/g, '/:id');
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
  path: string;
}

/** HTTP statusdan barqaror mashina o'qiy oladigan kod (klientlar shunga tayanadi). */
function statusCode(status: number): string {
  const map: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  };
  return map[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
}

/**
 * Barcha HTTP xatolarini bitta shaklga soladi, shunda 3 ta klient (bot, admin,
 * driver-app) javobni bir xil o'qiydi. Kutilmagan xatolar to'liq stack bilan
 * loglanadi, lekin mijozga ichki tafsilot chiqmaydi.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger(AllExceptionsFilter.name);

  /** Kalit → oxirgi xabar vaqti (bo'g'uv uchun). */
  private readonly sentAt = new Map<string, number>();
  private burstStart = 0;
  private burstCount = 0;

  /**
   * `redis` ixtiyoriy: usiz filtr avvalgidek faqat logga yozadi. Filtr
   * `main.ts` da QO'LDA yaratiladi (DI yo'q), shuning uchun klient tashqaridan
   * beriladi — testlarda parametrsiz qurish mumkin bo'lib qolsin.
   */
  constructor(private readonly redis?: Redis) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Ichki xatolik';
    // Standart kod statusdan — ba'zi istisnolar (masalan ThrottlerException) javobda
    // `error` maydonini bermaydi va aks holda hammasi INTERNAL_ERROR bo'lib qolardi.
    let code = isHttp ? statusCode(status) : 'INTERNAL_ERROR';
    if (isHttp) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else {
        const obj = payload as { message?: string | string[]; error?: string };
        message = obj.message ?? exception.message;
        if (obj.error) code = obj.error.replace(/\s+/g, '_').toUpperCase();
      }
    }

    // 5xx — haqiqiy nosozlik, to'liq kontekst bilan yozamiz. 4xx — kutilgan holat.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.log.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      this.alert(req, status, exception);
    }

    const body: ErrorBody = {
      statusCode: status,
      code,
      message,
      requestId: (req as Request & { id?: string }).id,
      timestamp: new Date().toISOString(),
      path: req.url,
    };
    res.status(status).json(body);
  }

  /**
   * 5xx haqida Telegram'ga xabar beradi (Redis → bot).
   *
   * NEGA: xatolar allaqachon to'liq stack bilan loglanadi, lekin loglarni
   * HECH KIM ko'rmaydi — nosozlik mijoz qo'ng'iroq qilgandagina bilinardi.
   * Tashqi xizmat (Sentry) o'rniga mavjud Redis pub/sub ustiga qurilgan:
   * yangi bog'liqlik ham, yangi hisob ham kerak emas.
   *
   * Xabarni bot FORMATLAYDI — bu yerdan faqat toza maydonlar ketadi.
   */
  private alert(req: Request, status: number, exception: unknown): void {
    if (!this.redis) return;
    try {
      const err = exception instanceof Error ? exception : null;
      const name = err?.name ?? 'Error';
      // So'rov satridan faqat yo'l qismi: `?` dan keyin mini app `initData`
      // (Telegram imzosi) va shunga o'xshash maxfiy parametrlar bo'lishi mumkin.
      const path = routeKey(req.url.split('?')[0]);
      const key = `${req.method} ${path} ${name}`;

      const now = Date.now();
      if (now - this.burstStart > 60_000) {
        this.burstStart = now;
        this.burstCount = 0;
      }
      if (this.burstCount >= ALERT_BURST_LIMIT) return;

      const last = this.sentAt.get(key);
      if (last !== undefined && now - last < ALERT_THROTTLE_MS) return;
      if (this.sentAt.size >= ALERT_KEYS_MAX) this.sentAt.clear();
      this.sentAt.set(key, now);
      this.burstCount += 1;

      const payload = {
        method: req.method,
        path,
        status,
        error: name,
        message: redact(err?.message ?? String(exception)),
        // Stack'ning BIRINCHI qatori — odatda aynan buzilgan joy. To'liq
        // stack chatga sig'maydi va logda allaqachon bor.
        frame: redact(err?.stack?.split('\n')[1]?.trim() ?? '', 200),
        requestId: (req as Request & { id?: string }).id,
        at: new Date().toISOString(),
      };

      void this.redis
        .publish(BOT_ALERT_CHANNEL, JSON.stringify(payload))
        .catch((e) => this.log.warn(`Ogohlantirish yuborilmadi: ${(e as Error).message}`));
    } catch (e) {
      // Ogohlantirishdagi nosozlik javobni buzmasin — bu ikkilamchi yo'l.
      this.log.warn(`Ogohlantirish tayyorlanmadi: ${(e as Error).message}`);
    }
  }
}
