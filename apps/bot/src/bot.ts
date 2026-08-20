import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { CONFIG } from './config';
import { normalizeUzPhone } from '@tty/shared';
import { apiClient } from './api';
import { Lang, t } from './i18n';
import {
  cancelOrderKeyboard,
  confirmKeyboard,
  langKeyboard,
  mainMenu,
  miniappUrl,
  orderStartKeyboard,
  phoneKeyboard,
  pickupKeyboard,
} from './keyboards';
import { hasMiniapp } from './config';
import { createSessionStore, resetDraft, Session, SessionStore } from './session';
import { listenMiniappOrders } from './miniapp-events';
import { trackOrder, stopTracking, markCancelAnnounced } from './tracker';

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
      // Ilovadan kelgan bo'lsa — endi kirishni tasdiqlay olamiz.
      if (s.pendingLoginNonce) await confirmAppLogin(ctx, s.pendingLoginNonce);
    } catch {
      await ctx.reply(t(lang, 'err'));
    }
  }

  /**
   * Chat menyu tugmasi (matn maydoni yonidagi) mini app'ni ochsin.
   *
   * Bu — mini app uchun eng ko'rinadigan kirish nuqtasi VA u `initData` beradi
   * (reply klaviatura tugmasi bermaydi). Til tanlangach yangilaymiz.
   */
  async function setMenuButton(
    telegram: Telegraf['telegram'],
    chatId: number,
    lang: Lang,
  ): Promise<void> {
    if (!hasMiniapp) return;
    await telegram
      .setChatMenuButton({
        chatId,
        menuButton: {
          type: 'web_app',
          text: t(lang, 'menu_order_map'),
          web_app: { url: miniappUrl(lang) },
        },
      })
      .catch(() => {
        /* eski mijoz yoki ruxsat yo'q — menyu tugmasisiz ham hammasi ishlaydi */
      });
  }

  /**
   * Ilova kirishini tasdiqlash. Mijoz ro'yxatdan o'tgan bo'lsa darhol,
   * bo'lmasa `register()` tugagach chaqiriladi.
   */
  async function confirmAppLogin(
    ctx: { from?: { id: number }; reply: (t: string, e?: object) => Promise<unknown>; state: object },
    nonce: string,
  ): Promise<void> {
    const s = getSession(ctx);
    try {
      const res = await apiClient.confirmCustomerLogin(nonce, String(ctx.from!.id));
      s.pendingLoginNonce = undefined;
      await ctx.reply(t(s.lang, 'login_code', res.code), { parse_mode: 'HTML' });
    } catch {
      // Nonce eskirgan yoki mijoz topilmadi — sabab ilovada emas, SHU YERDA
      // ko'rinsin, aks holda foydalanuvchi ikki oynada ham jim qolardi.
      s.pendingLoginNonce = undefined;
      await ctx.reply(t(s.lang, 'login_failed'));
    }
  }

  // /start → til tanlash. `/start <nonce>` bo'lsa — ilovaga kirish.
  bot.start(async (ctx) => {
    const s = getSession(ctx);
    // Telegraf deep link payload'ini shu yerda beradi: t.me/<bot>?start=<nonce>
    const nonce = (ctx as { startPayload?: string }).startPayload;

    if (nonce) {
      if (s.customerId) return confirmAppLogin(ctx, nonce);
      // Hali ro'yxatdan o'tmagan — avval telefon, keyin tasdiqlaymiz.
      s.pendingLoginNonce = nonce;
      await ctx.reply(t(s.lang, 'login_need_phone'));
      return ctx.reply(t(s.lang, 'ask_phone'), phoneKeyboard(s.lang));
    }

    await ctx.reply(t(s.lang, 'welcome'));
    await ctx.reply(t(s.lang, 'choose_lang'), langKeyboard);
  });

  // Til tanlash
  bot.action(/^lang:(uz|ru)$/, async (ctx) => {
    const s = getSession(ctx);
    s.lang = ctx.match[1] as Lang;
    await ctx.answerCbQuery();
    await setMenuButton(ctx.telegram, ctx.chat!.id, s.lang);
    if (!s.customerId || !s.phone) {
      await ctx.reply(t(s.lang, 'ask_phone'), phoneKeyboard(s.lang));
    } else {
      await ctx.reply(t(s.lang, 'registered'), mainMenu(s.lang));
    }
  });

  // Telefon ulashish (tugma) → ro'yxatdan o'tish
  bot.on(message('contact'), async (ctx) => {
    const s = getSession(ctx);
    // Telegram kontakt raqamini ko'pincha `+` SIZ beradi (`998990051630`).
    // Avval u xom holda uzatilardi — qo'lda yozish yo'lida normalizatsiya bor
    // edi, bu yo'lda esa yo'q (HANDOFF 5.1 asimmetriyasi). Natijada mijoz
    // bazada `+` siz saqlanib, haydovchi ilovasi `tel:998...` ochardi va
    // telefon uni noto'g'ri raqam deb ko'rsatardi.
    await register(ctx, s.lang, normalizeUzPhone(ctx.message.contact.phone_number));
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
        // Javobni shu yerda o'zimiz yozamiz — tracker takrorlamasin
        // (`order:cancel` tugmasi yo'lida ham xuddi shunday).
        markCancelAnnounced(s.activeOrderId);
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
      return ctx.reply(t(s.lang, 'choose_category'), orderStartKeyboard(s.lang));
    }

    // 3) Oqim qadamlari: manzil va izoh (ikkalasi ham ixtiyoriy — o'tkazib yuborsa bo'ladi).
    // 4) Noto'g'ri kiritish — tegishli tugmadan foydalanishni so'raymiz
    if (s.step === 'category') return ctx.reply(t(s.lang, 'use_category_btn'), orderStartKeyboard(s.lang));
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
    // Manzil va izoh SO'RALMAYDI — oqim qisqa: toifa → lokatsiya → tasdiq.
    // Narx haydovchi taksometridagi haqiqiy km bo'yicha hisoblanadi.
    s.step = 'confirm';
    await ctx.reply(t(s.lang, 'confirm_order', s.draft.category ?? ''), confirmKeyboard(s.lang));
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
      });
      s.activeOrderId = order.id;
      resetDraft(s);
      // "Qidirilyapti" xabari bilan birga bekor qilish tugmasi — haydovchi
      // topilmasa ham mijoz zakazni bekor qila olsin.
      await ctx.reply(t(s.lang, 'searching'), cancelOrderKeyboard(s.lang));
      startTracking(ctx.telegram, ctx.chat!.id, s.customerId, s.lang, order.id);
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
      // Tracker'ga aytamiz: bu bekorni BIZ e'lon qilamiz. Busiz `order:status`
      // hodisasi soket yopilishidan oldin yetib kelsa, mijoz ikkita bir xil
      // xabar olardi.
      markCancelAnnounced(s.activeOrderId);
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

  // Baholashni o'tkazib yuborish — baholash IXTIYORIY.
  bot.action('rate:skip', async (ctx) => {
    const s = getSession(ctx);
    await ctx.answerCbQuery();
    s.ratingOrderId = undefined;
    // Tugmalarni olib tashlaymiz, lekin xabarni o'chirmaymiz (narx ko'rinib tursin).
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    // ASOSIY MENYUNI QAYTARAMIZ — busiz mijoz "Taksi chaqirish" tugmasini
    // ko'rmay qolardi. Safar davomida reply-klaviatura almashgan edi va uni
    // FAQAT baho berish yo'li qaytarardi; "o'tkazib yuborish" da esa yo'q edi.
    await ctx.reply(t(s.lang, 'use_menu'), mainMenu(s.lang));
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

  /**
   * Zakazni Telegram'da kuzatishni boshlash.
   *
   * DIQQAT: tracker callback'lari update tugagandan KEYIN ishlaydi, ya'ni
   * middleware sessiyani allaqachon saqlab bo'lgan. Shuning uchun `ctx.state`
   * dagi nusxani o'zgartirish yetarli emas — store orqali qayta yozamiz.
   */
  function startTracking(
    telegram: Telegraf['telegram'],
    chatId: number,
    customerId: string,
    lang: Lang,
    orderId: string,
  ): void {
    trackOrder({
      orderId,
      chatId,
      customerId,
      lang,
      telegram,
      // Promise QAYTARAMIZ (avval `void` edi) — tracker uni kutadi, shunda
      // xabar yuborilishidan oldin sessiya yozilib bo'ladi va mijoz darhol
      // baho bossa ham `ratingOrderId` joyida bo'ladi.
      onTerminal: (oid, status) =>
        store.update(chatId, (ss) => {
          if (ss.activeOrderId === oid) ss.activeOrderId = undefined;
          if (status === 'COMPLETED') ss.ratingOrderId = oid;
        }),
      // NO_DRIVER'dan keyin operator (yoki kech onlayn bo'lgan haydovchi)
      // zakazni oldi — sessiyada uni yana faol qilamiz.
      onAssigned: (oid) =>
        store.update(chatId, (ss) => {
          if (!ss.activeOrderId) ss.activeOrderId = oid;
        }),
    });
  }

  /**
   * Mini app'dan berilgan buyurtmani ham botda kuzatamiz.
   *
   * Busiz mijoz mini app'da zakaz berib, Telegram'da HECH QANDAY xabar
   * olmasdi — na "haydovchi topildi", na bekor qilish tugmasi. API bu haqda
   * Redis pub/sub orqali xabar beradi (ikkalasi bitta Redis'ni bo'lishadi).
   */
  listenMiniappOrders(async (telegramId, orderId) => {
    // Shaxsiy chatda chat id = foydalanuvchi id.
    const chatId = Number(telegramId);
    if (!Number.isFinite(chatId)) return;
    const s = await store.get(chatId);
    if (!s.customerId) return; // botda ro'yxatdan o'tmagan — kuzatib bo'lmaydi
    if (s.activeOrderId === orderId) return; // allaqachon kuzatilmoqda
    s.activeOrderId = orderId;
    await store.set(chatId, s);
    await bot.telegram
      .sendMessage(chatId, t(s.lang, 'searching'), cancelOrderKeyboard(s.lang))
      .catch(() => {});
    startTracking(bot.telegram, chatId, s.customerId, s.lang, orderId);
  });

  // Handler xatolarini yutamiz — bot hech qachon yiqilmasin (masalan eskirgan callback).
  bot.catch((err, ctx) => {
    console.error('[bot] handler xatosi:', (err as Error)?.message, 'update:', ctx.updateType);
  });

  return bot;
}
