import { z } from 'zod';

// ENV validatsiya sxemasi (best practice: ishga tushishdan oldin tekshirish).
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Railway PORT'ni beradi; bo'lmasa API_PORT.
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(['true', 'false']).optional(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('7d'),
  INTERNAL_API_KEY: z.string().min(8).default('dev_internal_key'),
  ADMIN_LOGIN: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  // Prod'da /docs yopiq; ochish uchun aniq 'true' qilish kerak.
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  // Login urinishlari: HAR HISOB uchun daqiqasiga nechta (brute force himoyasi).
  // Prod'da 5 yetarli; lokal simlar ketma-ket login qilgani uchun ularni
  // yuqoriroq qiymat bilan ishga tushirish mumkin.
  LOGIN_RATE_LIMIT: z.coerce.number().default(5),
  // Dispatch sozlamalari (default; keyin DB settings bilan almashtiriladi)
  DISPATCH_WINDOW_SIZE: z.coerce.number().default(6),
  DISPATCH_OFFER_TIMEOUT_SEC: z.coerce.number().default(120), // taklif oynasi — kamida 2 daqiqa
  DISPATCH_RADIUS_STEPS_M: z.string().default('2000,4000,6000'),
  DISPATCH_NO_DRIVER_TIMEOUT_SEC: z.coerce.number().default(180), // taklif oynasidan uzunroq
  // CORS: ruxsat etilgan origin'lar, vergul bilan (masalan admin domeni).
  // Bo'sh bo'lsa — dev'da hammaga ochiq, PROD'da esa ishga tushmaydi (pastga qarang).
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const DEV_INTERNAL_KEY = 'dev_internal_key';

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Noto'g'ri ENV konfiguratsiya:\n${issues}`);
  }

  // Production uchun qo'shimcha talablar. Bularni sxemaga qo'shib bo'lmaydi, chunki
  // dev'da qulay default'lar kerak — shuning uchun faqat NODE_ENV=production'da tekshiramiz.
  // Maqsad: xavfsizlik sozlamasi UNUTILGANDA servis jimgina zaif holatda ishlab
  // ketmasin, balki DARHOL va tushunarli xato bilan to'xtasin.
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const errors: string[] = [];
    if (env.INTERNAL_API_KEY === DEV_INTERNAL_KEY) {
      errors.push(
        `INTERNAL_API_KEY: production'da '${DEV_INTERNAL_KEY}' default qiymati taqiqlanadi — ` +
          'kuchli tasodifiy kalit qo\'ying (api va bot\'da bir xil)',
      );
    }
    if (env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET: production\'da kamida 32 belgi bo\'lishi kerak');
    }
    if (!env.CORS_ORIGINS?.trim()) {
      errors.push(
        'CORS_ORIGINS: production\'da aniq ko\'rsatilishi shart (masalan ' +
          'https://admin-xxx.up.railway.app). Hammaga ochiq CORS admin tokenini xavf ostiga qo\'yadi',
      );
    }
    if (errors.length > 0) {
      throw new Error(`Production ENV xavfsizlik talablari bajarilmadi:\n  - ${errors.join('\n  - ')}`);
    }
  }
  return env;
}
