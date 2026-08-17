/**
 * O'zbekiston telefon raqamini yagona ko'rinishga keltirish: `+998XXXXXXXXX`.
 *
 * NEGA UMUMIY: raqam bazaga IKKI yo'ldan tushadi — bot'da qo'lda yozilgan matn
 * va Telegram "kontakt ulashish" tugmasi. Ikkinchisi raqamni ko'pincha `+` SIZ
 * beradi (`998990051630`). Normalizatsiya faqat birinchi yo'lda bor edi, ya'ni
 * mijozlar bazada `+` siz saqlanardi va haydovchi ilovasi `tel:998...` ochib,
 * telefon uni noto'g'ri raqam deb ko'rsatardi.
 *
 * `null` QAYTARMAYDI: chet el raqami yoki kutilmagan format bo'lsa, kirish
 * qiymati o'zgarishsiz qaytadi — ro'yxatdan o'tishni bloklamaslik uchun.
 * Faqat shaklni tartibga soladi, haqiqiyligini tekshirmaydi.
 */
export function normalizeUzPhone(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (/^998\d{9}$/.test(digits)) return '+' + digits; // 998XXXXXXXXX
  if (/^\d{9}$/.test(digits)) return '+998' + digits; // XXXXXXXXX (kodsiz)
  // Boshqa formatlar: allaqachon `+` bilan bo'lsa qoldiramiz, aks holda tegmaymiz.
  return trimmed;
}
