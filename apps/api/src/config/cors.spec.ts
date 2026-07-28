import { corsOptions, parseOrigins } from './cors';
import { validateEnv } from './env.validation';

type OriginFn = (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => void;

/** `corsOptions` dan origin tekshiruvchini chaqirib, ruxsat berilganini qaytaradi. */
function allows(allowed: string[] | null, origin: string | undefined): boolean {
  const opts = corsOptions(allowed);
  if (typeof opts.origin === 'boolean') return opts.origin;
  let ok = false;
  (opts.origin as unknown as OriginFn)(origin, (_e, res) => {
    ok = !!res;
  });
  return ok;
}

describe('parseOrigins', () => {
  it('bo\'sh/aniqlanmagan qiymatda null qaytaradi (dev: hammaga ochiq)', () => {
    expect(parseOrigins(undefined)).toBeNull();
    expect(parseOrigins('')).toBeNull();
    expect(parseOrigins('  ,  ')).toBeNull();
  });

  it('vergul bilan ajratadi va oxirgi slashni olib tashlaydi', () => {
    expect(parseOrigins('https://a.uz/, https://b.uz')).toEqual(['https://a.uz', 'https://b.uz']);
  });
});

describe('corsOptions', () => {
  const allowed = ['https://admin.tty.uz'];

  it('ro\'yxatdagi origin\'ga ruxsat beradi', () => {
    expect(allows(allowed, 'https://admin.tty.uz')).toBe(true);
  });

  it('oxirgi slash farq qilmaydi', () => {
    expect(allows(allowed, 'https://admin.tty.uz/')).toBe(true);
  });

  it('begona origin\'ni RAD ETADI', () => {
    expect(allows(allowed, 'https://yomon.example')).toBe(false);
  });

  it('origin\'siz so\'rovga ruxsat beradi (mobil ilova, bot, curl — brauzer emas)', () => {
    expect(allows(allowed, undefined)).toBe(true);
  });

  it('ro\'yxat bo\'lmasa hammaga ochiq (dev)', () => {
    expect(allows(null, 'https://istalgan.example')).toBe(true);
  });
});

describe('validateEnv — production xavfsizlik talablari', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://u:p@h:5432/db',
    REDIS_URL: 'redis://h:6379',
    JWT_SECRET: 'x'.repeat(32),
    INTERNAL_API_KEY: 'kuchli-tasodifiy-kalit',
    CORS_ORIGINS: 'https://admin.tty.uz',
  };

  it('to\'g\'ri prod konfiguratsiyani qabul qiladi', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('dev INTERNAL_API_KEY default\'ini prod\'da RAD ETADI', () => {
    expect(() => validateEnv({ ...base, INTERNAL_API_KEY: 'dev_internal_key' })).toThrow(
      /INTERNAL_API_KEY/,
    );
  });

  it('qisqa JWT_SECRET ni prod\'da RAD ETADI', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'qisqa123' })).toThrow(/JWT_SECRET/);
  });

  it('CORS_ORIGINS bo\'sh bo\'lsa prod\'da RAD ETADI', () => {
    expect(() => validateEnv({ ...base, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
  });

  it('bo\'sh ixtiyoriy URL (masalan `OSRM_URL=`) ni "berilmagan" deb qabul qiladi', () => {
    // `.env` da ko'pincha `OSRM_URL=` bo'sh qoladi — avval bu servisni umuman
    // ishga tushirmasdi ("Invalid url").
    expect(() => validateEnv({ ...base, OSRM_URL: '', NOMINATIM_URL: '' })).not.toThrow();
  });

  it('noto\'g\'ri URL berilsa baribir RAD ETADI', () => {
    expect(() => validateEnv({ ...base, OSRM_URL: 'osrm-server' })).toThrow(/OSRM_URL/);
  });

  it('dev\'da bu talablar qo\'llanmaydi (qulay default\'lar)', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: base.DATABASE_URL,
        REDIS_URL: base.REDIS_URL,
        JWT_SECRET: 'devsecret',
      }),
    ).not.toThrow();
  });
});
