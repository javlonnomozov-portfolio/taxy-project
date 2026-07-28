import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { CONFIG } from './config';
import { apiClient } from './api';
import { Lang, t } from './i18n';
import {
  cancelOrderKeyboard,
  categoryKeyboard,
  confirmKeyboard,
  langKeyboard,
  mainMenu,
  phoneKeyboard,
  pickupKeyboard,
  skipKeyboard,
} from './keyboards';
import { createSessionStore, resetDraft, Session, SessionStore } from './session';
import { trackOrder, stopTracking } from './tracker';

// Yakuniy (terminal) holatlar — bulardan keyin zakaz faol emas.
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_DRIVER',
  'CUSTOMER_NO_SHOW',
  'NO_DRIVER',
  'CLOSED_BY_OPERATOR',
]);

// Sessiyadagi activeOrderId hali ham backend'da faolmi? (tracker terminal eventni
// o'tkazib yuborsa — masalan socket uzilsa — stale bo'lib qolishi mumkin.)
async function stillActive(orderId: string): Promise<boolean> {
  try {
    const o = await apiClient.getOrder(orderId);
    if (!o || !o.status) return false; // topilmadi → faol emas
    return !TERMINAL_STATUSES.has(o.status);
  } catch {
    return true; // tarmoq xatosi — ehtiyot bo'lib bloklaymiz
  }
}

// Telefon raqamni normallashtirish: +998XXXXXXXXX yoki null (noto'g'ri).
// Eksport qilingan — test uchun (O'zbekiston raqam formatlari).
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (/^998\d{9}$/.test(d)) return '+' + d;
  if (/^\d{9}$/.test(d)) return '+998' + d;
  return null;
}

// Zakaz holatidan mijozga tushunarli iborani hosil qilish.
function statusPhrase(lang: Lang, orderStatus: string): string {
  switch (orderStatus) {
    case 'ARRIVED':
      return t(lang, 'taxi_arrived');
    case 'IN_PROGRESS':
      return t(lang, 'taxi_in_trip');
    default: // ACCEPTED, CONFIRMED, ARRIVING
      return t(lang, 'taxi_on_way');
  }
}

// "N soniya/daqiqa oldin" — joylashuv qachon yangilangani.
function agoText(lang: Lang, iso: string | null): string {
  if (!iso) return t(lang, 'ago_now');
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 5) return t(lang, 'ago_now');
  if (sec < 60) return t(lang, 'ago_sec', String(sec));
  return t(lang, 'ago_min', String(Math.floor(sec / 60)));
}

export function createBot(store: SessionStore = createSessionStore(CONFIG.redisUrl)): Telegraf {
  const bot = new Telegraf(CONFIG.botToken);

  // Sessiyani har update boshida yuklab, oxirida saqlaymiz. Handler'lar sinxron
  // `getSession(ctx)` bilan ishlaydi — 16 ta chaqiruv joyini async qilish shart emas.
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId == null) return next();
    const s = await store.get(chatId);
    (ctx.state as { session?: Session }).session = s;
    try {
      await next();
    } finally {
      await store.set(chatId, s); // xato bo'lsa ham holatni yo'qotmaymiz
    }
  });

  const getSession = (ctx: { state: object }): Session =>
    (ctx.state as { session: Session }).session;

  // Mijozni ro'yxatdan o'tkazish (contact yoki qo'lda yozilgan raqam).
  async function register(
    ctx: {
      chat?: { id: number };
      from?: { id: number; first_name?: string; last_name?: string };
      reply: (t: string, e?: object) => Promise<unknown>;
      state: object;
    },
    lang: Lang,
    phone: string,
  ) {
    const s = getSession(ctx);
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
    const s = getSession(ctx);
    await ctx.reply(t(s.lang, 'welcome'));
    await ctx.reply(t(s.lang, 'choose_lang'), langKeyboard);
  });

  // Til tanlash
  bot.action(/^lang:(uz|ru)$/, async (ctx) => {
    const s = getSession(ctx);
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
    const s = getSession(ctx);
    await register(ctx, s.lang, ctx.message.contact.phone_number);
  });

  // Matnli xabarlar (registratsiya / menyu / oqim qadamlari)
  bot.on(message('text'), async (ctx) => {
    const s = getSession(ctx);
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
      // Faol buyurtma bo'lsa uni backend'da ham bekor qilamiz (nafaqat draftni) —
      // aks holda "qidirilyapti" holatida zakaz osilib qolardi.
      if (s.activeOrderId) {
        try {
          await apiClient.cancelOrder(s.activeOrderId);
        } catch {
          /* allaqachon terminal bo'lishi mumkin — e'tiborsiz */
        }
        stopTracking(s.activeOrderId);
        s.activeOrderId = undefined;
      }
      resetDraft(s);
      return ctx.reply(t(s.lang, 'cancelled'), mainMenu(s.lang));
    }
    if (text === t(s.lang, 'menu_order')) {
      // Stale activeOrderId'ni backend bilan tekshiramiz — terminal bo'lsa tozalaymiz.
      if (s.activeOrderId && (await stillActive(s.activeOrderId))) {
        return ctx.reply(t(s.lang, 'active_exists'));
      }
      s.activeOrderId = undefined;
      s.step = 'category';
      s.draft = {};
      return ctx.reply(t(s.lang, 'choose_category'), categoryKeyboard(s.lang));
    }

    // 3) Oqim qadamlari: manzil va izoh (ikkalasi ham ixtiyoriy — o'tkazib yuborsa bo'ladi).
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
    const s = getSession(ctx);
    s.draft.category = ctx.match[1];
    s.step = 'pickup';
    await ctx.answerCbQuery();
    await ctx.reply(t(s.lang, 'ask_pickup'), pickupKeyboard(s.lang));
  });

  // Lokatsiya (olib ketish nuqtasi) → manzil so'rash (ixtiyoriy, o'tkazib yuborsa bo'ladi)
  bot.on(message('location'), async (ctx) => {
    const s = getSession(ctx);
    if (s.step !== 'pickup') return;
    const { latitude, longitude } = ctx.message.location;
    s.draft.pickup = { lat: latitude, lng: longitude };
    s.step = 'dest';
    await ctx.reply(t(s.lang, 'ask_dest'), skipKeyboard(s.lang));
  });

  // Tasdiqlash → buyurtma yaratish
  bot.action('order:confirm', async (ctx) => {
    const s = getSession(ctx);
    await ctx.answerCbQuery();
    if (s.step !== 'confirm' || !s.customerId || !s.draft.pickup || !s.draft.category) return;
    try {
      const order = await apiClient.createOrder({
        customerId: s.customerId,
        category: s.draft.category,
        pickup: s.draft.pickup,
        // Mijoz manzilni MATN sifatida yozadi (koordinata emas) → destAddress.
        destAddress: s.draft.destAddress,
        note: s.draft.note,
      });
      s.activeOrderId = order.id;
      resetDraft(s);
      // "Qidirilyapti" xabari bilan birga bekor qilish tugmasi — haydovchi
      // topilmasa ham mijoz zakazni bekor qila olsin.
      await ctx.reply(t(s.lang, 'searching'), cancelOrderKeyboard(s.lang));
      trackOrder({
        orderId: order.id,
        chatId: ctx.chat!.id,
        customerId: s.customerId,
        lang: s.lang,
        telegram: ctx.telegram,
        // DIQQAT: bu socket callback'i update tugagandan KEYIN ishlaydi, ya'ni
        // middleware sessiyani allaqachon saqlab bo'lgan. Shuning uchun `ctx.state`
        // dagi nusxani o'zgartirish yetarli emas — store orqali qayta yozamiz.
        onTerminal: (oid, status) => {
          const chatId = ctx.chat!.id;
          void store.update(chatId, (ss) => {
            if (ss.activeOrderId === oid) ss.activeOrderId = undefined;
            if (status === 'COMPLETED') ss.ratingOrderId = oid;
          });
        },
      });
    } catch (e) {
      const msg = (e as Error).message.includes('409') ? t(s.lang, 'active_exists') : t(s.lang, 'err');
      await ctx.reply(msg);
    }
  });

  bot.action('order:abort', async (ctx) => {
    const s = getSession(ctx);
    resetDraft(s);
    await ctx.answerCbQuery();
    await ctx.reply(t(s.lang, 'cancelled'), mainMenu(s.lang));
  });

  // Faol buyurtmani bekor qilish
  bot.action('order:cancel', async (ctx) => {
    const s = getSession(ctx);
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

  // Taksi joylashuvini ko'rish (10 soniyada bir marta ruxsat).
  bot.action('order:where', async (ctx) => {
    const s = getSession(ctx);
    if (!s.activeOrderId) {
      await ctx.answerCbQuery();
      return;
    }
    const now = Date.now();
    if (s.lastLocShownAt && now - s.lastLocShownAt < 10_000) {
      const wait = Math.ceil((10_000 - (now - s.lastLocShownAt)) / 1000);
      await ctx.answerCbQuery(t(s.lang, 'loc_too_soon', String(wait)));
      return;
    }
    await ctx.answerCbQuery();
    try {
      const loc = await apiClient.driverLocation(s.activeOrderId);
      if (!loc) {
        await ctx.reply(t(s.lang, 'loc_unavailable'));
        return;
      }
      s.lastLocShownAt = now;
      await ctx.replyWithLocation(loc.lat, loc.lng);
      await ctx.reply(
        t(s.lang, 'taxi_loc_caption', statusPhrase(s.lang, loc.orderStatus), agoText(s.lang, loc.at)),
      );
    } catch {
      await ctx.reply(t(s.lang, 'loc_unavailable'));
    }
  });

  // Baholash (1-5)
  bot.action(/^rate:([1-5])$/, async (ctx) => {
    const s = getSession(ctx);
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
