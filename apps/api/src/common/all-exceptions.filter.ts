import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
}
