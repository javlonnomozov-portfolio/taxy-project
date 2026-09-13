import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type Redis from 'ioredis';
import { AllExceptionsFilter, BOT_ALERT_CHANNEL } from './all-exceptions.filter';

/** Filtr kutgan minimal `ArgumentsHost` — HTTP kontekst ustida. */
function hostFor(method: string, url: string, requestId?: string): ArgumentsHost {
  const res = {
    status() {
      return res;
    },
    json() {
      return res;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method, url, id: requestId }),
    }),
  } as unknown as ArgumentsHost;
}

/** Chop etilgan xabarlarni yig'adigan soxta Redis. */
function fakeRedis(): { redis: Redis; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  const redis = {
    publish: (channel: string, raw: string) => {
      expect(channel).toBe(BOT_ALERT_CHANNEL);
      sent.push(JSON.parse(raw));
      return Promise.resolve(1);
    },
  } as unknown as Redis;
  return { redis, sent };
}

describe('AllExceptionsFilter — ogohlantirish', () => {
  it('4xx uchun xabar yubormaydi (kutilgan holat)', () => {
    const { redis, sent } = fakeRedis();
    new AllExceptionsFilter(redis).catch(
      new HttpException('Topilmadi', HttpStatus.NOT_FOUND),
      hostFor('GET', '/customer/orders/abc'),
    );
    expect(sent).toHaveLength(0);
  });

  it('5xx uchun yo‘l, xato va stack qatorini yuboradi', () => {
    const { redis, sent } = fakeRedis();
    const err = new TypeError('x aniqlanmagan');
    new AllExceptionsFilter(redis).catch(err, hostFor('POST', '/customer/orders', 'req-1'));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'POST',
      path: '/customer/orders',
      status: 500,
      error: 'TypeError',
      message: 'x aniqlanmagan',
      requestId: 'req-1',
    });
  });

  it('so‘rov satrini olib tashlaydi (mini app `initData` chatga ketmasin)', () => {
    const { redis, sent } = fakeRedis();
    new AllExceptionsFilter(redis).catch(
      new Error('yiqildi'),
      hostFor('GET', '/miniapp/track?initData=user%3D1%26hash%3Dsecret'),
    );
    expect(sent[0].path).toBe('/miniapp/track');
  });

  it('xato matnidagi ulanish parolini o‘chiradi', () => {
    const { redis, sent } = fakeRedis();
    new AllExceptionsFilter(redis).catch(
      new Error('connect ECONNREFUSED redis://default:parol123@redis.internal:6379'),
      hostFor('GET', '/health'),
    );
    expect(sent[0].message).not.toContain('parol123');
    expect(sent[0].message).toContain('://***@');
  });

  it('bir xil xatoni takror yubormaydi, boshqa xatoni yuboradi', () => {
    const { redis, sent } = fakeRedis();
    const filter = new AllExceptionsFilter(redis);
    const host = hostFor('POST', '/customer/orders');

    filter.catch(new TypeError('bir xil'), host);
    filter.catch(new TypeError('bir xil'), host);
    expect(sent).toHaveLength(1);

    filter.catch(new RangeError('boshqa'), host);
    expect(sent).toHaveLength(2);
  });

  it('yo‘ldagi id larni birlashtiradi — 100 ta zakaz 100 ta xabar bermaydi', () => {
    const { redis, sent } = fakeRedis();
    const filter = new AllExceptionsFilter(redis);
    filter.catch(
      new Error('yiqildi'),
      hostFor('GET', '/customer/orders/3f1b2c4d-1111-2222-3333-444455556666/track'),
    );
    filter.catch(
      new Error('yiqildi'),
      hostFor('GET', '/customer/orders/aaaabbbb-1111-2222-3333-444455556666/track'),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe('/customer/orders/:id/track');
  });

  it('bir daqiqada 5 tadan ko‘p yubormaydi (xatolar yomg‘iri)', () => {
    const { redis, sent } = fakeRedis();
    const filter = new AllExceptionsFilter(redis);
    for (let i = 0; i < 10; i++) {
      filter.catch(new Error('yiqildi'), hostFor('GET', `/a${i}`));
    }
    expect(sent).toHaveLength(5);
  });

  it('Redis‘siz ham ishlaydi (javob baribir qaytadi)', () => {
    expect(() =>
      new AllExceptionsFilter().catch(new Error('yiqildi'), hostFor('GET', '/health')),
    ).not.toThrow();
  });
});

describe('AllExceptionsFilter — obyektli javoblar', () => {
  it('health 503 (error OBYEKT) filtrni yiqitmaydi va ogohlantirish yuboradi', () => {
    const { redis, sent } = fakeRedis();
    const terminus = new HttpException(
      { status: 'error', info: {}, error: { database: { status: 'down' } }, details: {} },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(() => new AllExceptionsFilter(redis).catch(terminus, hostFor('GET', '/health'))).not.toThrow();
    expect(sent).toHaveLength(1);
    expect(sent[0].status).toBe(503);
  });

  it('error matn bo‘lsa kod avvalgidek undan olinadi', () => {
    let body: { code?: string } = {};
    const res = {
      status() {
        return res;
      },
      json(b: { code?: string }) {
        body = b;
        return res;
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'GET', url: '/x' }) }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(
      new HttpException({ message: 'yomon', error: 'Bad Request' }, HttpStatus.BAD_REQUEST),
      host,
    );
    expect(body.code).toBe('BAD_REQUEST');
  });
});
