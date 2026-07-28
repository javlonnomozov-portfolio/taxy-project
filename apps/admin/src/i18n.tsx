import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'uz' | 'ru';

const LANG_KEY = 'tty_admin_lang';

const uz: Record<string, string> = {
  // Umumiy
  brand_sub: 'Operator / Admin panel',
  loading: 'Yuklanmoqda…',
  save: 'Saqlash',
  cancel: 'Bekor qilish',
  close: 'Yopish',
  confirm: 'Tasdiqlash',
  error: 'Xato',
  none: 'Yo‘q',
  total: 'Jami',
  search: 'Qidirish',
  logout: 'Chiqish',
  lang_switch: 'Русский',

  // Navigatsiya
  nav_dashboard: 'Panel',
  nav_orders: 'Zakazlar',
  nav_customers: 'Foydalanuvchilar',
  nav_scheduled: 'Oldindan buyurtmalar',
  nav_drivers: 'Haydovchilar',
  nav_settings: 'Sozlamalar',

  // Login
  login: 'Login',
  password: 'Parol',
  sign_in: 'Kirish',
  login_err: 'Login yoki parol noto‘g‘ri',

  // Dashboard
  dashboard_title: 'Boshqaruv paneli',
  stat_active_orders: 'Faol buyurtmalar',
  stat_online_drivers: 'Onlayn haydovchilar',
  stat_alerts: 'Ogohlantirishlar',
  m_total_24h: 'Zakaz (24 soat)',
  m_no_driver: 'Taksi topilmadi',
  m_completed: 'Yakunlangan',
  m_accept_time: 'O‘rtacha qabul vaqti',
  m_avg_fare: 'O‘rtacha safar narxi',
  dispatch_hint_1: '🚕 Buyurtma tanlandi.',
  dispatch_hint_2: 'Xaritadan yoki o‘ng paneldan bo‘sh taksini tanlab',
  dispatch_hint_3: 'so‘rov yuboring',
  offer_sent: 'So‘rov yuborildi — haydovchi qabul qilishini kuting.',
  order_closed: 'Buyurtma yopildi.',
  select_order_first: 'Avval quyidan zakazni tanlang',

  // Zakazlar
  orders_title: 'Zakazlar',
  tab_all: 'Hammasi',
  tab_active: 'Joriy',
  tab_done: 'Bajarilgan',
  tab_cancelled: 'Bekor/Topilmadi',
  showing: 'Ko‘rsatilmoqda',
  th_status: 'Holat',
  th_category: 'Toifa',
  th_price: 'Narx',
  th_created: 'Yaratilgan',
  th_finished: 'Tugagan',
  no_orders: 'Zakaz yo‘q',

  // Foydalanuvchilar
  customers_title: 'Foydalanuvchilar',
  search_customer: 'Qidirish (ism yoki telefon)',
  th_name: 'Ism',
  th_phone: 'Telefon',
  th_lang: 'Til',
  th_rating: 'Reyting',
  th_noshow: 'No-show',
  th_registered: 'Ro‘yxatdan',
  blocked: '🚫 Bloklangan',
  active: '✅ Faol',
  no_customers: 'Foydalanuvchi topilmadi',

  // Oldindan buyurtmalar
  scheduled_title: 'Oldindan buyurtmalar',
  scheduled_hint:
    'Operator ~2 soat oldin mijoz bilan bog‘lanib tasdiqlaydi; tasdiqdan keyin dispatch boshlanadi.',
  scheduled_confirm_q: 'Mijoz bilan tasdiqlandi — dispatch boshlansinmi?',
  th_scheduled_at: 'Belgilangan vaqt',
  th_note: 'Izoh',
  no_scheduled: 'Oldindan buyurtma yo‘q',

  // Sozlamalar
  settings_title: 'Sozlamalar',
  settings_saved: 'Sozlamalar saqlandi',
  tariff_saved: 'tarifi saqlandi',
  surge_section: 'Surge va bekor qilish',
  surge_active: 'Surge faol',
  surge_coef: 'Koeffitsient:',
  free_cancel: 'Jarimasiz bekor (sek):',
  tariffs_section: 'Tariflar (toifa bo‘yicha)',
  th_base: 'Baza',
  th_per_km: 'Km narx',
  th_wait_min: 'Kutish/daq',
  th_free_wait: 'Bepul kutish',
  th_night: 'Tungi ×',

  // Haydovchilar
  drivers_title: 'Haydovchilar',
  add_driver: '+ Haydovchi qo‘shish',
  new_driver: 'Yangi haydovchi (ofis KYC)',
  temp_password: 'Vaqtinchalik parol',
  temp_password_hint: 'Haydovchi birinchi kirishda parolni almashtiradi.',
  topup_q: 'To‘ldirish summasi (so‘m):',
  billing_q: 'Billing rejimi: subscription / percent / hybrid',
  percent_q: 'Foiz %:',
  driver_added: '✅ Haydovchi qo‘shildi — bir martalik parol',
  driver_added_hint: 'Haydovchiga bu ma’lumotlarni bering (parol faqat bir marta ko‘rsatiladi):',
  ph_phone: 'Telefon +99890...',
  ph_first: 'Ism',
  ph_last: 'Familiya',
  ph_make: 'Marka',
  ph_model: 'Model',
  ph_color: 'Rang',
  ph_plate: 'Davlat raqami',
  cat_standard: 'Oddiy',
  cat_comfort: 'Komfort',
  cat_cargo: 'Yukli',
  add: 'Qo‘shish',
  th_kyc: 'KYC',
  th_billing: 'Billing',
  th_cancel_rate: 'Bekor %',
  th_balance: 'Balans',
  th_actions: 'Amallar',
  approve: 'Tasdiqlash',
  block: 'Bloklash',
  topup: 'To‘ldirish',
  no_drivers: 'Haydovchi yo‘q',
  order_word: 'Buyurtma',
  taxi_panel: '🚖 Taksi',
  driver_word: 'Haydovchi',
  status_label: 'Holat',
  free_now: '🟢 Bo‘sh',
  on_trip: '⚪ Safarda',
  plate_label: 'Davlat raqami',
  rating_label: 'Reyting',
  category_label: 'Toifa',
  send_offer_btn: '📨 Shu taksiga so‘rov yuborish',
  taxi_busy: 'Bu taksi safarda — so‘rov yuborib bo‘lmaydi.',
  pick_order_hint: 'So‘rov yuborish uchun avval quyidan zakazni tanlang.',
  alerts_none: 'Hozircha yo‘q',
  select_taxi: 'Taksi tanlash',
  selected: 'Tanlangan ✓',
  no_active_orders: 'Faol buyurtma yo‘q',
  no: 'Yo‘q',
};

const ru: Record<string, string> = {
  brand_sub: 'Панель оператора / админа',
  loading: 'Загрузка…',
  save: 'Сохранить',
  cancel: 'Отмена',
  close: 'Закрыть',
  confirm: 'Подтвердить',
  error: 'Ошибка',
  none: 'Нет',
  total: 'Всего',
  search: 'Поиск',
  logout: 'Выйти',
  lang_switch: 'O‘zbekcha',

  nav_dashboard: 'Панель',
  nav_orders: 'Заказы',
  nav_customers: 'Пользователи',
  nav_scheduled: 'Предзаказы',
  nav_drivers: 'Водители',
  nav_settings: 'Настройки',

  login: 'Логин',
  password: 'Пароль',
  sign_in: 'Войти',
  login_err: 'Неверный логин или пароль',

  dashboard_title: 'Панель управления',
  stat_active_orders: 'Активные заказы',
  stat_online_drivers: 'Водители онлайн',
  stat_alerts: 'Оповещения',
  m_total_24h: 'Заказов (24 ч)',
  m_no_driver: 'Такси не найдено',
  m_completed: 'Завершено',
  m_accept_time: 'Среднее время принятия',
  m_avg_fare: 'Средняя стоимость',
  dispatch_hint_1: '🚕 Заказ выбран.',
  dispatch_hint_2: 'Выберите свободное такси на карте или справа и',
  dispatch_hint_3: 'отправьте запрос',
  offer_sent: 'Запрос отправлен — ждите принятия водителем.',
  order_closed: 'Заказ закрыт.',
  select_order_first: 'Сначала выберите заказ ниже',

  orders_title: 'Заказы',
  tab_all: 'Все',
  tab_active: 'Текущие',
  tab_done: 'Выполненные',
  tab_cancelled: 'Отменённые/Не найдено',
  showing: 'Показано',
  th_status: 'Статус',
  th_category: 'Категория',
  th_price: 'Цена',
  th_created: 'Создан',
  th_finished: 'Завершён',
  no_orders: 'Заказов нет',

  customers_title: 'Пользователи',
  search_customer: 'Поиск (имя или телефон)',
  th_name: 'Имя',
  th_phone: 'Телефон',
  th_lang: 'Язык',
  th_rating: 'Рейтинг',
  th_noshow: 'Неявки',
  th_registered: 'Регистрация',
  blocked: '🚫 Заблокирован',
  active: '✅ Активен',
  no_customers: 'Пользователи не найдены',

  scheduled_title: 'Предзаказы',
  scheduled_hint:
    'Оператор связывается с клиентом за ~2 часа и подтверждает; после подтверждения начинается диспетч.',
  scheduled_confirm_q: 'Подтверждено с клиентом — начать диспетч?',
  th_scheduled_at: 'Назначенное время',
  th_note: 'Комментарий',
  no_scheduled: 'Предзаказов нет',

  settings_title: 'Настройки',
  settings_saved: 'Настройки сохранены',
  tariff_saved: 'тариф сохранён',
  surge_section: 'Surge и отмена',
  surge_active: 'Surge активен',
  surge_coef: 'Коэффициент:',
  free_cancel: 'Отмена без штрафа (сек):',
  tariffs_section: 'Тарифы (по категориям)',
  th_base: 'База',
  th_per_km: 'Цена за км',
  th_wait_min: 'Ожидание/мин',
  th_free_wait: 'Беспл. ожидание',
  th_night: 'Ночной ×',

  drivers_title: 'Водители',
  add_driver: '+ Добавить водителя',
  new_driver: 'Новый водитель (офисный KYC)',
  temp_password: 'Временный пароль',
  temp_password_hint: 'Водитель сменит пароль при первом входе.',
  topup_q: 'Сумма пополнения (сум):',
  billing_q: 'Режим биллинга: subscription / percent / hybrid',
  percent_q: 'Процент %:',
  driver_added: '✅ Водитель добавлен — одноразовый пароль',
  driver_added_hint: 'Передайте водителю эти данные (пароль показывается только один раз):',
  ph_phone: 'Телефон +99890...',
  ph_first: 'Имя',
  ph_last: 'Фамилия',
  ph_make: 'Марка',
  ph_model: 'Модель',
  ph_color: 'Цвет',
  ph_plate: 'Госномер',
  cat_standard: 'Обычный',
  cat_comfort: 'Комфорт',
  cat_cargo: 'Грузовой',
  add: 'Добавить',
  th_kyc: 'KYC',
  th_billing: 'Биллинг',
  th_cancel_rate: 'Отмены %',
  th_balance: 'Баланс',
  th_actions: 'Действия',
  approve: 'Подтвердить',
  block: 'Заблокировать',
  topup: 'Пополнить',
  no_drivers: 'Водителей нет',
  order_word: 'Заказ',
  taxi_panel: '🚖 Такси',
  driver_word: 'Водитель',
  status_label: 'Статус',
  free_now: '🟢 Свободен',
  on_trip: '⚪ В поездке',
  plate_label: 'Госномер',
  rating_label: 'Рейтинг',
  category_label: 'Категория',
  send_offer_btn: '📨 Отправить запрос этому такси',
  taxi_busy: 'Такси в поездке — запрос отправить нельзя.',
  pick_order_hint: 'Сначала выберите заказ ниже, чтобы отправить запрос.',
  alerts_none: 'Пока нет',
  select_taxi: 'Выбрать такси',
  selected: 'Выбрано ✓',
  no_active_orders: 'Активных заказов нет',
  no: 'Нет',
};

const dicts: Record<Lang, Record<string, string>> = { uz, ru };

/** Kalit topilmasa uz'ga, u ham bo'lmasa kalitning o'ziga qaytadi (bo'sh matn ko'rsatmaymiz). */
export function translate(lang: Lang, key: string): string {
  return dicts[lang]?.[key] ?? uz[key] ?? key;
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(LANG_KEY) as Lang) || 'uz',
  );
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem(LANG_KEY, l);
        setLangState(l);
      },
      t: (key) => translate(lang, key),
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n I18nProvider ichida ishlatilishi kerak');
  return ctx;
}
