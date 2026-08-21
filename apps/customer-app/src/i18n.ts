export type Lang = 'uz' | 'ru';

const dict: Record<Lang, Record<string, string>> = {
  uz: {
    app_name: 'Toy TaxY',
    login_title: 'Xush kelibsiz',
    login_sub: 'Kirish Telegram orqali — parol kerak emas',
    login_btn: 'Telegram orqali kirish',
    login_waiting: 'Telegram’da tasdiqlang…',
    login_code_hint: 'Telegram ochilmadimi? Botdagi 6 xonali kodni kiriting:',
    login_code_ph: '000000',
    login_code_btn: 'Kirish',
    login_retry: 'Qaytadan urinish',
    login_expired: 'Muddati tugadi. Qaytadan urinib ko‘ring.',
    session_expired: 'Sessiya muddati tugadi. Qaytadan kiring.',

    where_from: 'Qayerdan olib ketamiz?',
    move_map: 'Xaritani suring — nuqta shu yerda qoladi',
    cat_standard: 'Standart',
    cat_comfort: 'Komfort',
    cat_cargo: 'Yuk',
    order_btn: 'Taksi chaqirish',
    ordering: 'Yuborilmoqda…',
    my_loc: 'Mening joylashuvim',

    searching: 'Taksi qidirilmoqda…',
    on_the_way: 'Taksi yo‘lda',
    arrived: 'Taksi yetib keldi',
    in_progress: 'Safardasiz',
    finished: 'Safar yakunlandi',
    cancelled: 'Buyurtma bekor qilindi',
    no_location: 'Joylashuv hali yo‘q',
    updated: 'yangilandi',
    just_now: 'hozirgina',
    sec_ago: 's oldin',
    min_ago: 'daq oldin',
    you: 'Siz',
    taxi: 'Taksi',

    cancel_btn: 'Buyurtmani bekor qilish',
    cancel_confirm: 'Buyurtma bekor qilinsinmi?',
    cancel_confirm_penalty:
      'Haydovchi allaqachon yo‘lda. Bekor qilish bekor darajangizga ta’sir qiladi. Davom etamizmi?',
    cancelled_free: 'Buyurtma bekor qilindi (jarimasiz).',
    cancelled_penalty: 'Buyurtma bekor qilindi. ⚠️ Bu bekor darajangizga ta’sir qiladi.',
    yes: 'Ha',
    no: 'Yo‘q',

    price: 'Narx',
    som: 'so‘m',
    rate_prompt: 'Xohlasangiz, haydovchini baholang:',
    thanks_rating: 'Bahoyingiz uchun rahmat!',
    skip: 'O‘tkazib yuborish',
    new_order: 'Yangi buyurtma',

    err: 'Xatolik yuz berdi',
    err_network: 'Tarmoq bilan bog‘lanib bo‘lmadi',
    open_telegram: 'Telegram orqali davom etish',
    loc_permission: 'Joylashuv ruxsati kerak',
    lang_switch: 'Русский',
  },
  ru: {
    app_name: 'Toy TaxY',
    login_title: 'Добро пожаловать',
    login_sub: 'Вход через Telegram — пароль не нужен',
    login_btn: 'Войти через Telegram',
    login_waiting: 'Подтвердите в Telegram…',
    login_code_hint: 'Telegram не открылся? Введите 6-значный код из бота:',
    login_code_ph: '000000',
    login_code_btn: 'Войти',
    login_retry: 'Попробовать снова',
    login_expired: 'Срок истёк. Попробуйте снова.',
    session_expired: 'Сессия истекла. Войдите снова.',

    where_from: 'Откуда вас забрать?',
    move_map: 'Двигайте карту — точка останется здесь',
    cat_standard: 'Стандарт',
    cat_comfort: 'Комфорт',
    cat_cargo: 'Грузовой',
    order_btn: 'Вызвать такси',
    ordering: 'Отправляем…',
    my_loc: 'Моё местоположение',

    searching: 'Ищем такси…',
    on_the_way: 'Такси в пути',
    arrived: 'Такси приехало',
    in_progress: 'Вы в поездке',
    finished: 'Поездка завершена',
    cancelled: 'Заказ отменён',
    no_location: 'Местоположение пока недоступно',
    updated: 'обновлено',
    just_now: 'только что',
    sec_ago: 'с назад',
    min_ago: 'мин назад',
    you: 'Вы',
    taxi: 'Такси',

    cancel_btn: 'Отменить заказ',
    cancel_confirm: 'Отменить заказ?',
    cancel_confirm_penalty:
      'Водитель уже в пути. Отмена повлияет на ваш рейтинг отмен. Продолжить?',
    cancelled_free: 'Заказ отменён (без штрафа).',
    cancelled_penalty: 'Заказ отменён. ⚠️ Это повлияет на ваш рейтинг отмен.',
    yes: 'Да',
    no: 'Нет',

    price: 'Стоимость',
    som: 'сум',
    rate_prompt: 'Если хотите, оцените водителя:',
    thanks_rating: 'Спасибо за оценку!',
    skip: 'Пропустить',
    new_order: 'Новый заказ',

    err: 'Произошла ошибка',
    err_network: 'Не удалось связаться с сетью',
    open_telegram: 'Продолжить через Telegram',
    loc_permission: 'Нужен доступ к геолокации',
    lang_switch: 'O‘zbekcha',
  },
};

// Har til uchun BITTA funksiya keshlanadi — aks holda `t` har renderda
// o'zgarib, uni bog'liqlikka qo'ygan komponent cheksiz qayta renderga tushardi.
const translators = new Map<Lang, (key: string) => string>();

export function makeT(lang: Lang): (key: string) => string {
  let fn = translators.get(lang);
  if (!fn) {
    fn = (key: string) => dict[lang][key] ?? dict.uz[key] ?? key;
    translators.set(lang, fn);
  }
  return fn;
}
