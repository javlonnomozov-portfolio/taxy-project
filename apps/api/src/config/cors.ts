import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * `CORS_ORIGINS` (vergul bilan ajratilgan) → origin ro'yxati.
 * Bo'sh bo'lsa `null` — dev'da "hammaga ochiq" degani. Production'da bo'sh
 * qoldirib bo'lmaydi (env.validation.ts ishga tushishda to'xtatadi).
 */
export function parseOrigins(raw?: string, self?: string | null): string[] | null {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '')) // oxirgi '/' ni olib tashlaymiz
    .filter(Boolean);
  if (list.length === 0) return null;
  // O'Z origin'i doim ro'yxatda bo'lsin — pastdagi izohga qarang.
  if (self && !list.includes(self)) list.push(self);
  return list;
}

/**
 * Servisning o'z public origin'i (Railway domenidan).
 *
 * MUHIM: Telegram Mini App sahifasi AYNAN SHU API tomonidan beriladi, ya'ni
 * uning `fetch('/miniapp/track')` so'rovi o'z-origin. Lekin brauzer **POST**
 * so'rovida `Origin` sarlavhasini o'z-origin bo'lganda ham yuboradi — u
 * allowlist'da bo'lmasa CORS uni rad etadi va 500 qaytadi.
 *
 * Aynan shu prod'da yuz berdi: lokalda `CORS_ORIGINS` bo'sh (hammaga ochiq)
 * bo'lgani uchun sim'lar buni ko'rsatmadi.
 */
export function selfOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const domain = env.RAILWAY_PUBLIC_DOMAIN || env.RAILWAY_STATIC_URL;
  if (!domain) return null;
  const clean = domain.trim().replace(/\/+$/, '');
  if (!clean) return null;
  return clean.startsWith('http') ? clean : `https://${clean}`;
}

/**
 * Socket.IO va HTTP uchun bir xil CORS qoidasi.
 * `origin` bo'lmagan so'rovlar (server-server, mobil ilova, curl) ruxsat etiladi —
 * ular brauzer emas va CORS ularga umuman tegishli emas. Bu MUHIM: haydovchi
 * ilovasi (React Native) va bot backend `Origin` sarlavhasini yubormaydi.
 */
export function corsOptions(allowed: string[] | null): CorsOptions {
  if (!allowed) return { origin: true, credentials: true };
  return {
    origin(origin, cb) {
      if (!origin || allowed.includes(origin.replace(/\/+$/, ''))) return cb(null, true);
      cb(new Error(`CORS: '${origin}' ruxsat etilmagan`), false);
    },
    credentials: true,
  };
}
