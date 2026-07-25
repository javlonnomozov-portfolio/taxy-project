import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { CONFIG } from './config';
import { apiClient } from './api';
import { Lang, t } from './i18n';
import {
  categoryKeyboard,
  confirmKeyboard,
  langKeyboard,
  mainMenu,
  phoneKeyboard,
  pickupKeyboard,
  skipKeyboard,
} from './keyboards';
import { getSession, resetDraft } from './session';
import { trackOrder, stopTracking } from './tracker';

// Telefon raqamni normallashtirish: +998XXXXXXXXX yoki null (noto'g'ri).
function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (/^998\d{9}$/.test(d)) return '+' + d;
  if (/^\d{9}$/.test(d)) return '+998' + d;
  return null;
}

export function createBot(): Telegraf {
  const bot = new Telegraf(CONFIG.botToken);

  // Mijozni ro'yxatdan o'tkazish (contact yoki qo'lda yozilgan raqam).
  async function register(
    ctx: { chat?: { id: number }; from?: { id: number; first_name?: string; last_name?: string }; reply: (t: string, e?: object) => Promise<unknown> },
    lang: Lang,
    phone: string,
  ) {
    const s = getSession(ctx.chat!.id);
    try {
      const customer = await apiClient.upsertCustomer({
        telegramId: String(ctx.from!.id),
        phone,
        firstName: ctx.from!.first_name,
        lastName: ctx.from!.last_name,
        language: lang,
      });
      s.customerId = customer.id;
      s.phone = phone;
      s.step = 'idle';
      await ctx.reply(t(lang, 'registered'), mainMenu(lang));
    } catch {
      await ctx.reply(t(lang, 'err'));
    }
  }

  // /start → til tanlash
  bot.start(async (ctx) => {
    const s = getSession(ctx.chat.id);
    await ctx.reply(t(s.lang, 'welcome'));
    await ctx.reply(t(s.lang, 'choose_lang'), langKeyboard);
  });

  // Til tanlash
  bot.action(/^lang:(uz|ru)$/, async (ctx) => {
    const s = getSession(ctx.chat!.id);
    s.lang = ctx.match[1] as Lang;
    await ctx.answerCbQuery();
    if (!s.customerId || !s.phone) {
      await ctx.reply(t(s.lang, 'ask_phone'), phoneKeyboard(s.lang));
    } else {
      await ctx.reply(t(s.lang, 'registered'), mainMenu(s.lang));
    }
  });

  // Telefon ulashish (tugma) → ro'yxatdan o'tish
  bot.on(message('contact'), async (ctx) => {
    const s = getSession(ctx.chat.id);
    await register(ctx, s.lang, ctx.message.contact.phone_number);
  });

  // Matnli xabarlar (registratsiya / menyu / oqim qadamlari)
  bot.on(message('text'), async (ctx) => {
    const s = getSession(ctx.chat.id);
    const text = ctx.message.text.trim();

    // 1) Hali ro'yxatdan o'tmagan bo'lsa — matnni telefon raqam deb qabul qilamiz
    if (!s.customerId) {
      const phone = normalizePhone(text);
      if (!phone) return ctx.reply(t(s.lang, 'invalid_phone'), phoneKeyboard(s.lang));
      return register(ctx, s.lang, phone);
    }

    // 2) Menyu tugmalari
    if (text === t(s.lang, 'menu_lang')) {
      return ctx.reply(t(s.lang, 'choose_lang'), langKeyboard);
    }
    if (text === t(s.lang, 'cancel')) {
      resetDraft(s);
      return ctx.reply(t(s.lang, 'cancelled'), mainMenu(s.lang));
    }
    if (text === t(s.lang, 'menu_order')) {
      if (s.activeOrderId) return ctx.reply(t(s.lang, 'active_exists'));
      s.step = 'category';
      s.draft = {};
      return ctx.reply(t(s.lang, 'choose_category'), categoryKeyboard(s.lang));
    }

    // 3) Oqim qadamlari — matn qabul qilinadigan bosqichlar
    if (s.step === 'dest') {
      if (text !== t(s.lang, 'skip')) s.draft.destAddress = text;
      s.step = 'note';
      return ctx.reply(t(s.lang, 'ask_note'), skipKeyboard(s.lang));
    }
    if (s.step === 'note') {
      if (text !== t(s.lang, 'skip')) s.draft.note = text;
      s.step = 'confirm';
      return ctx.reply(t(s.lang, 'confirm_order', s.draft.category ?? ''), confirmKeyboard(s.lang));
    }

    // 4) Noto'g'ri kiritish — tegishli tugmadan foydalanishni so'raymiz
    if (s.step === 'category') return ctx.reply(t(s.lang, 'use_category_btn'), categoryKeyboard(s.lang));
    if (s.step === 'pickup') return ctx.reply(t(s.lang, 'use_location_btn'), pickupKeyboard(s.lang));
    if (s.step === 'confirm') return ctx.reply(t(s.lang, 'use_confirm_btn'), confirmKeyboard(s.lang));
    // Idle holatda tushunarsiz matn → menyuni ko'rsatamiz
    return ctx.reply(t(s.lang, 'use_menu'), mainMenu(s.lang));
  });

  // Toifa tanlash
  bot.action(/^cat:(standard|comfort|cargo)$/, async (ctx) => {
    const s = getSession(ctx.chat!.id);
    s.draft.category = ctx.match[1];
    s.step = 'pickup';
    await ctx.answerCbQuery();
    await ctx.reply(t(s.lang, 'ask_pickup'), pickupKeyboard(s.lang));
  });

  // Lokatsiya (olib ketish nuqtasi)
  bot.on(message('location'), async (ctx) => {
    const s = getSession(ctx.chat.id);
    if (s.step !== 'pickup') return;
    const { latitude, longitude } = ctx.message.location;
    s.draft.pickup = { lat: latitude, lng: longitude };
    s.step = 'dest';
    await ctx.reply(t(s.lang, 'ask_dest'), skipKeyboard(s.lang));
  });

  // Tasdiqlash → buyurtma yaratish
  bot.action('order:confirm', async (ctx) => {
    const s = getSession(ctx.chat!.id);
    await ctx.answerCbQuery();
    if (s.step !== 'confirm' || !s.customerId || !s.draft.pickup || !s.draft.category) return;
    try {
      const order = await apiClient.createOrder({
        customerId: s.customerId,
        category: s.draft.category,
        pickup: s.draft.pickup,
        note: s.draft.note,
      });
      s.activeOrderId = order.id;
      resetDraft(s);
      await ctx.reply(t(s.lang, 'searching'));
      trackOrder({
        orderId: order.id,
        chatId: ctx.chat!.id,
        customerId: s.customerId,
        lang: s.lang,
        telegram: ctx.telegram,
        onTerminal: (oid, status) => {
          const ss = getSession(ctx.chat!.id);
          if (ss.activeOrderId === oid) ss.activeOrderId = undefined;
          if (status === 'COMPLETED') ss.ratingOrderId = oid;
        },
      });
    } catch (e) {
      const msg = (e as Error).message.includes('409') ? t(s.lang, 'active_exists') : t(s.lang, 'err');
      await ctx.reply(msg);
    }
  });

  bot.action('order:abort', async (ctx) => {
    const s = getSession(ctx.chat!.id);
    resetDraft(s);
    await ctx.answerCbQuery();
    await ctx.reply(t(s.lang, 'cancelled'), mainMenu(s.lang));
  });

  // Faol buyurtmani bekor qilish
  bot.action('order:cancel', async (ctx) => {
    const s = getSession(ctx.chat!.id);
    await ctx.answerCbQuery();
    if (!s.activeOrderId) return;
    try {
      const res = await apiClient.cancelOrder(s.activeOrderId);
      stopTracking(s.activeOrderId);
      s.activeOrderId = undefined;
      await ctx.reply(
        t(s.lang, res.penalized ? 'cancelled_penalty' : 'cancelled_free'),
        mainMenu(s.lang),
      );
    } catch {
      await ctx.reply(t(s.lang, 'err'));
    }
  });

  // Baholash (1-5)
  bot.action(/^rate:([1-5])$/, async (ctx) => {
    const s = getSession(ctx.chat!.id);
    await ctx.answerCbQuery();
    if (!s.ratingOrderId) return;
    try {
      await apiClient.rateDriver(s.ratingOrderId, Number(ctx.match[1]));
      s.ratingOrderId = undefined;
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await ctx.reply(t(s.lang, 'thanks_rating'), mainMenu(s.lang));
    } catch {
      await ctx.reply(t(s.lang, 'err'));
    }
  });

  // Handler xatolarini yutamiz — bot hech qachon yiqilmasin (masalan eskirgan callback).
  bot.catch((err, ctx) => {
    console.error('[bot] handler xatosi:', (err as Error)?.message, 'update:', ctx.updateType);
  });

  return bot;
}
