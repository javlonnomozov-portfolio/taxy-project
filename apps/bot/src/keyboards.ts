import { Markup } from 'telegraf';
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

// Haydovchi topilgach: taksi joylashuvini ko'rish + bekor qilish.
export const trackingKeyboard = (lang: Lang) =>
  Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'show_location_btn'), 'order:where')],
    [Markup.button.callback(t(lang, 'cancel_order_btn'), 'order:cancel')],
  ]);

export const ratingKeyboard = () =>
  Markup.inlineKeyboard([
    [1, 2, 3, 4, 5].map((n) => Markup.button.callback(`${n}⭐`, `rate:${n}`)),
  ]);


