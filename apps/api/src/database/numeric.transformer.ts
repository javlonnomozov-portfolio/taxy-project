import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric` ustunlari uchun transformer.
 *
 * NEGA KERAK: `pg` drayveri `numeric` ni **string** qaytaradi (aniqlikni yo'qotmaslik
 * uchun). Transformer'siz `order.finalPrice` — `"4000.00"` bo'ladi va bitta joyda
 * `Number(...)` unutilsa `"4000" + 500 === "4000500"` — jimgina noto'g'ri pul summasi.
 * Shuning uchun barcha `numeric` ustunlarga shu transformer qo'yilgan.
 *
 * Eslatma: TTY'da summalar so'mda va `Number.MAX_SAFE_INTEGER` dan ancha kichik,
 * shuning uchun `number` ga o'girish xavfsiz.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : Number(value);
  },
};
