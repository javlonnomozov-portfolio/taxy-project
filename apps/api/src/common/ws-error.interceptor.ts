import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, of } from 'rxjs';

export interface WsErrorAck {
  ok: false;
  code: string;
  message: string;
}

/**
 * Socket handler xato tashlaganda mijozga TUSHUNARLI ack qaytaradi.
 *
 * NEGA FILTER EMAS, INTERCEPTOR: Nest'ning `WsExceptionsHandler` filter'ni
 * `filter.func(exception, host)` deb chaqiradi va **qaytgan qiymatni ishlatmaydi** —
 * ya'ni exception filter orqali ack qaytarib bo'lmaydi (u faqat `client.emit('exception')`
 * qila oladi). Interceptor esa oqimga tushadi, shuning uchun `catchError` qaytargan qiymat
 * to'g'ridan Socket.IO ack callback'iga boradi.
 *
 * Busiz `TripsService` tashlagan `BadRequestException` da haydovchi ilovasiga hech qanday
 * javob kelmasdi va safar ekrani jimgina osilib qolardi.
 */
@Injectable()
export class WsErrorInterceptor implements NestInterceptor {
  private readonly log = new Logger(WsErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((exception: unknown) => {
        const isHttp = exception instanceof HttpException;
        const status = isHttp ? exception.getStatus() : 500;

        let message = 'Ichki xatolik';
        let code = 'INTERNAL_ERROR';
        if (isHttp) {
          const payload = exception.getResponse();
          if (typeof payload === 'string') {
            message = payload;
          } else {
            const obj = payload as { message?: string | string[]; error?: string };
            const raw = obj.message ?? exception.message;
            message = Array.isArray(raw) ? raw.join(', ') : raw;
            code = (obj.error ?? exception.name).replace(/\s+/g, '_').toUpperCase();
          }
        }

        // 5xx — haqiqiy nosozlik; 4xx — kutilgan biznes holati, log shishirmaymiz.
        if (status >= 500) {
          this.log.error(
            `WS '${String(context.getHandler().name)}' xatosi`,
            exception instanceof Error ? exception.stack : String(exception),
          );
        }

        const ack: WsErrorAck = { ok: false, code, message };
        return of(ack);
      }),
    );
  }
}
