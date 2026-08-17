/**
 * Yangi haydovchining boshlang'ich reytingi — "birinchi mijoz 5 yulduz bergan"
 * degan taxminiy ovoz.
 *
 * NEGA: reytingsiz haydovchi `0.00` bilan ko'rinardi. Bu ham mijozga yomon
 * signal berardi, ham dispatch tie-break'ida (yaqin masofadagi haydovchilar
 * orasida reyting bo'yicha saralash) uni doim oxirgi o'ringa tushirardi —
 * ya'ni yangi haydovchi zakaz olishi qiyinlashardi va reyting yig'a olmasdi.
 *
 * Bu ovoz O'CHMAYDI, balki haqiqiy baholar kelgani sari SUYULADI:
 *   reyting = (5 * SEED_VOTES + baholar yig'indisi) / (SEED_VOTES + baholar soni)
 * Bitta haqiqiy 5 kelsa → 5.00; bitta 1 kelsa → 3.00; baholar ko'paygani sari
 * urug'ning ta'siri sezilmay qoladi.
 */
export const SEED_RATING = 5;

/** Urug' necha ovozga teng. 1 = "bitta mijoz baho bergan". */
export const SEED_VOTES = 1;
