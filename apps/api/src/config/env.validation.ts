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
  // Dispatch sozlamalari (default; keyin DB settings bilan almashtiriladi)
  DISPATCH_WINDOW_SIZE: z.coerce.number().default(6),
  DISPATCH_OFFER_TIMEOUT_SEC: z.coerce.number().default(15),
  DISPATCH_RADIUS_STEPS_M: z.string().default('2000,4000,6000'),
  DISPATCH_NO_DRIVER_TIMEOUT_SEC: z.coerce.number().default(60),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Noto'g'ri ENV konfiguratsiya:\n${issues}`);
  }
  return parsed.data;
}
