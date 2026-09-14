import { Markup } from 'telegraf';
import { CONFIG, hasMiniapp } from './config';
import { Lang, t } from './i18n';

export const langKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("O'zbekcha 🇺🇿", 'lang:uz'), Markup.button.callback('Русский 🇷🇺', 'lang:ru')],
]);

export const phoneKeyboard = (lang: Lang) =>
  Markup.keyboard([[Markup.button.contactRequest(t(lang, 'share_phone_btn'))]])
    .resize()
    .oneTime();

export const mainMenu = (lang: Lang) =>
  Markup.keyboard([[t(lang, 'menu_order')], [t(lang, 'menu_lang')]]).resize();

/** Mini app havolasi (til bilan). */
export const miniappUrl = (lang: Lang, orderId?: string) =>
  `${CONFIG.miniappUrl}?lang=${lang}` + (orderId ? `&order=${encodeURIComponent(orderId)}` : '');

/**
 * Buyurtma boshlanishi: xaritadan tanlash (mini app) YOKI toifa tanlab
 * joriy GPS bilan davom etish (eski oqim, zaxira).
 *
 * DIQQAT — TUGMA TURI MUHIM: `web_app` REPLY klaviaturada `initData` BERMAYDI
 * (Telegram uni faqat inline tugma / menyu tugmasi / to'g'ridan havola uchun
 * beradi). Reply klaviaturaga qo'yilganda mini app "Bu sahifa Telegram ilovasi
 * ichida ochilishi kerak" deb ochilardi. Shuning uchun bu yerda faqat INLINE.
 */
export const orderStartKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard(
    (hasMiniapp
      ? [[Markup.button.webApp(t(lang, 'menu_order_map'), miniappUrl(lang))]]
      : ([] as ReturnType<typeof Markup.button.callback>[][])
    ).concat([
      [Markup.button.callback(t(lang, 'cat_standard'), 'cat:standard')],
      [Markup.button.callback(t(lang, 'cat_comfort'), 'cat:comfort')],
      [Markup.button.callback(t(lang, 'cat_cargo'), 'cat:cargo')],
    ]),
  );

export const categoryKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'cat_standard'), 'cat:standard')],
    [Markup.button.callback(t(lang, 'cat_comfort'), 'cat:comfort')],
    [Markup.button.callback(t(lang, 'cat_cargo'), 'cat:cargo')],
  ]);

export const pickupKeyboard = (lang: Lang) =>
  Markup.keyboard([
    [Markup.button.locationRequest(t(lang, 'send_location_btn'))],
    [t(lang, 'cancel')],
  ]).resize();

export const skipKeyboard = (lang: Lang) =>
  Markup.keyboard([[t(lang, 'skip')], [t(lang, 'cancel')]]).resize();

export const confirmKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'confirm'), 'order:confirm')],
    [Markup.button.callback(t(lang, 'cancel'), 'order:abort')],
  ]);

export const cancelOrderKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'cancel_order_btn'), 'order:cancel')]]);

/**
 * Comfort topilmadi — Standart bilan qayta qidirish.
 * Zakaz id TUGMANING O'ZIDA: NO_DRIVER'da sessiyadagi `activeOrderId` allaqachon
 * bo'shatilgan (mijoz yangi zakaz bera olishi uchun). 10 + 36 bayt < 64 chegara.
 */
export const switchStandardKeyboard = (lang: Lang, orderId: string) =>
  Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'switch_standard_btn'), `order:std:${orderId}`)]]);

// Haydovchi topilgach: taksi joylashuvini ko'rish + bekor qilish.
/**
 * Safar davomidagi klaviatura.
 *
 * "Taksi qayerda?" — Telegram Mini App (jonli xarita, o'zi yangilanadi).
 * Avval `replyWithLocation` bilan STATIK nuqta yuborilardi: u muzlab qolardi va
 * mijoz har safar tugmani qayta bosishi kerak edi.
 *
 * HTTPS bo'lmasa (lokal dev) — eski callback tugmasiga qaytamiz, aks holda
 * Telegram butun klaviaturani rad etadi.
 */
export const trackingKeyboard = (lang: Lang, orderId?: string) =>
  Markup.inlineKeyboard([
    [
      hasMiniapp && orderId
        ? Markup.button.webApp(
            t(lang, 'show_location_btn'),
            `${CONFIG.miniappUrl}?order=${encodeURIComponent(orderId)}&lang=${lang}`,
          )
        : Markup.button.callback(t(lang, 'show_location_btn'), 'order:where'),
    ],
    [Markup.button.callback(t(lang, 'cancel_order_btn'), 'order:cancel')],
  ]);

/**
 * Baholash IXTIYORIY — "o'tkazib yuborish" tugmasi shart. Avval faqat 5 ta
 * yulduz turardi va chiqish yo'li yo'q edi: mijoz baholashga majbur qilingandek
 * his qilardi.
 */
export const ratingKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard([
    [1, 2, 3, 4, 5].map((n) => Markup.button.callback(`${n}⭐`, `rate:${n}`)),
    [Markup.button.callback(t(lang, 'skip_rating_btn'), 'rate:skip')],
  ]);


