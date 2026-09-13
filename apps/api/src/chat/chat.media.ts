/**
 * Chat fayllarini tekshirish — SOF mantiq (DB'siz), shuning uchun to'g'ridan test qilinadi.
 *
 * NEGA BAYTLARDAN: klient yuborgan `Content-Type` ga ishonib bo'lmaydi. Rasm deb
 * `<svg onload=...>` yoki HTML yuborilsa va panel uni brauzerda ochsa, bu
 * operator sessiyasida skript ishga tushirish degani. Shuning uchun tur faylning
 * boshidagi "sehrli baytlar"dan aniqlanadi va keyin AYNAN shu tur bilan
 * qaytariladi. SVG ataylab qo'llab-quvvatlanmaydi.
 */

export type MediaKind = 'voice' | 'image';

/** Bitta fayl chegarasi. Telefon rasmni ~300 KB ga siqadi, 1 daqiqa ovoz ~1 MB. */
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
/** Ovozli xabar uzunligi (soniya). Ilova 60 da to'xtatadi, zaxira bilan. */
export const MAX_VOICE_SEC = 90;
export const MAX_TEXT_LEN = 2000;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_MIMES = new Set(['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/webm']);

const ascii = (buf: Buffer, from: number, to: number) => buf.toString('ascii', from, to);

/** Faylning haqiqiy turi boshidagi baytlardan; tanilmasa `null`. */
export function sniffMime(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === 'PNG') return 'image/png';
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  // expo-av Android'da .m4a yozadi: MPEG-4 konteyner, 4-baytdan "ftyp".
  if (ascii(buf, 4, 8) === 'ftyp') return 'audio/mp4';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (ascii(buf, 0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(buf, 0, 3) === 'ID3') return 'audio/mpeg';
  // ADTS AAC: 12 bit sinxron (FFF), layer = 00.
  if (buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return 'audio/aac';
  return null;
}

export type MediaCheck = { ok: true; mime: string } | { ok: false; reason: string };

/** Fayl so'ralgan turga (rasm/ovoz) mos va chegaradan oshmaganini tekshiradi. */
export function checkMedia(buf: Buffer | undefined, kind: MediaKind): MediaCheck {
  if (!buf || buf.length === 0) return { ok: false, reason: 'Fayl bo‘sh' };
  if (buf.length > MAX_MEDIA_BYTES) return { ok: false, reason: 'Fayl juda katta (2 MB dan oshmasin)' };

  const mime = sniffMime(buf);
  if (!mime) return { ok: false, reason: 'Fayl turi qo‘llab-quvvatlanmaydi' };

  const allowed = kind === 'image' ? IMAGE_MIMES : AUDIO_MIMES;
  if (!allowed.has(mime)) {
    return { ok: false, reason: kind === 'image' ? 'Bu rasm emas' : 'Bu ovozli xabar emas' };
  }
  return { ok: true, mime };
}
