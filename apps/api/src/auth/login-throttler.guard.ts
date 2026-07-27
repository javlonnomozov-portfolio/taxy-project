import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Login uchun rate limit — hisoblagich IP + HISOB bo'yicha kalitlanadi.
 *
 * NEGA faqat IP emas: bitta mobil operator NAT'i yoki taksopark ofisi ortida o'nlab
 * haydovchi bo'ladi. Sof IP kaliti bilan 5 ta haydovchi kirsa 6-chisi bloklanardi —
 * ya'ni himoya haqiqiy foydalanuvchilarni jazolardi (buni simlar ham darhol ko'rsatdi).
 *
 * Hisob bo'yicha kalitlash brute force'ni to'g'ri to'xtatadi: hujumchi bitta parolni
 * tanlashga urinsa, aynan o'sha telefon/login bo'yicha 5 tadan keyin to'xtaydi.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const body = (req.body ?? {}) as { phone?: string; login?: string };
    const account = (body.phone ?? body.login ?? 'anonim').toString().toLowerCase().trim();
    return `${req.ip}:${account}`;
  }

  /** Standart xabar "ThrottlerException: Too Many Requests" — foydalanuvchiga o'zbekcha. */
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Juda ko‘p urinish. 1 daqiqadan so‘ng qayta urinib ko‘ring.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
