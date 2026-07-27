import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * `CORS_ORIGINS` (vergul bilan ajratilgan) → origin ro'yxati.
 * Bo'sh bo'lsa `null` — dev'da "hammaga ochiq" degani. Production'da bo'sh
 * qoldirib bo'lmaydi (env.validation.ts ishga tushishda to'xtatadi).
 */
export function parseOrigins(raw?: string): string[] | null {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, '')) // oxirgi '/' ni olib tashlaymiz
    .filter(Boolean);
  return list.length > 0 ? list : null;
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
