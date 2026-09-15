// Telegram Mini App sahifasi — IKKI rejim:
//   1) BUYURTMA — xaritadan olib ketish nuqtasini tanlash va taksi chaqirish
//   2) KUZATUV  — "Taksi qayerda?" jonli xaritasi (har 5 soniyada yangilanadi)
//
// Qaysi rejim ekanini `/miniapp/state` hal qiladi: mijozda faol buyurtma bo'lsa
// darhol kuzatuv ochiladi.
//
// Nega buyurtma ham shu yerda: Telegram'ning lokatsiya tugmasi FAQAT telefonning
// joriy GPS nuqtasini yuboradi — mijoz boshqa manzilni, ko'cha burchagini yoki
// GPS noto'g'ri ko'rsatgan binodan tashqarini ko'rsata olmasdi. Xaritada esa
// nuqtani o'zi qo'yadi.
//
// Kuzatuv rejimi nega kerak edi: Telegram'ga yuborilgan joylashuv "muzlab"
// qoladi (`replyWithLocation` jonli emas) va mijoz har safar tugmani qayta
// bosishi kerak edi.
//
// Xarita — Leaflet + OSM (driver-app'dagi MiniMap bilan bir xil yondashuv,
// Google Maps API kaliti kerak emas).

const T = {
  uz: {
    title: 'Taksi qayerda?',
    searching: 'Taksi qidirilmoqda…',
    on_the_way: 'Taksi yo‘lda',
    arrived: 'Taksi yetib keldi',
    in_progress: 'Safardasiz',
    finished: 'Safar yakunlandi',
    no_location: 'Joylashuv hali yo‘q',
    updated: 'yangilandi',
    just_now: 'hozirgina',
    sec_ago: 's oldin',
    min_ago: 'daq oldin',
    recenter: 'Markazga',
    outside: 'Bu sahifa Telegram ilovasi ichida ochilishi kerak.',
    denied: 'Bu buyurtmani ko‘rish huquqi yo‘q.',
    err: 'Ma’lumot olinmadi. Qayta urinilmoqda…',
    you: 'Siz',
    taxi: 'Taksi',
    order_title: 'Qayerdan olib ketamiz?',
    order_hint: 'Xaritani suring — nuqta shu yerda qoladi',
    cat_standard: 'Standart',
    cat_comfort: 'Komfort',
    cat_cargo: 'Yuk tashish',
    pax_label: 'Yo‘lovchilar soni:',
    pax_few: '1ta - 4ta',
    pax_many: '5+',
    from_price: '{v} so‘mdan',
    order_btn: 'Taksi chaqirish',
    ordering: 'Yuborilmoqda…',
    my_loc: 'Mening joylashuvim',
    price: 'Narx',
    extra: 'Qo‘shimcha',
    som: 'so‘m',
    rate_prompt: 'Xohlasangiz, haydovchini baholang (ixtiyoriy):',
    thanks_rating: 'Bahoyingiz uchun rahmat! 🙏',
    skip_rating: 'O‘tkazib yuborish',
    cancelled: 'Buyurtma bekor qilindi',
    cancel_btn: '❌ Buyurtmani bekor qilish',
    no_driver: 'Taksi topilmadi',
    no_driver_info: 'Hozircha bo‘sh taksi topilmadi. Buyurtmangiz saqlanib turibdi — taksi bo‘shashi bilan sizga yuboramiz. Xohlasangiz, bekor qilishingiz mumkin.',
    no_driver_comfort: 'Comfort mashina hali topilmadi — qidirishda davom etamiz. Kutishni xohlamasangiz, Standart mashina chaqiring (narx Standart bo‘yicha).',
    switch_standard_btn: 'Standart buyurtma berish',
    searching_comfort: 'Comfort qidirilmoqda…',
    cancel_confirm: 'Buyurtma bekor qilinsinmi?',
    cancel_confirm_penalty: 'Haydovchi allaqachon yo‘lda. Bekor qilish bekor darajangizga ta’sir qiladi. Davom etamizmi?',
    cancelled_free: 'Buyurtma bekor qilindi (jarimasiz).',
    cancelled_penalty: 'Buyurtma bekor qilindi. ⚠️ Bu bekor darajangizga ta’sir qiladi.',
  },
  ru: {
    title: 'Где такси?',
    searching: 'Ищем такси…',
    on_the_way: 'Такси в пути',
    arrived: 'Такси приехало',
    in_progress: 'Вы в поездке',
    finished: 'Поездка завершена',
    no_location: 'Местоположение пока недоступно',
    updated: 'обновлено',
    just_now: 'только что',
    sec_ago: 'с назад',
    min_ago: 'мин назад',
    recenter: 'В центр',
    outside: 'Эту страницу нужно открывать внутри Telegram.',
    denied: 'Нет доступа к этому заказу.',
    err: 'Не удалось получить данные. Повторяем…',
    you: 'Вы',
    taxi: 'Такси',
    order_title: 'Откуда вас забрать?',
    order_hint: 'Двигайте карту — точка останется здесь',
    cat_standard: 'Стандарт',
    cat_comfort: 'Комфорт',
    cat_cargo: 'Грузоперевозка',
    pax_label: 'Пассажиров:',
    pax_few: '1 - 4',
    pax_many: '5+',
    from_price: 'от {v} сум',
    order_btn: 'Вызвать такси',
    ordering: 'Отправляем…',
    my_loc: 'Моё местоположение',
    price: 'Стоимость',
    extra: 'Доплата',
    som: 'сум',
    rate_prompt: 'Если хотите, оцените водителя (необязательно):',
    thanks_rating: 'Спасибо за оценку! 🙏',
    skip_rating: 'Пропустить',
    cancelled: 'Заказ отменён',
    cancel_btn: '❌ Отменить заказ',
    no_driver: 'Такси не найдено',
    no_driver_info: 'Пока свободное такси не найдено. Ваш заказ сохранён — как только такси освободится, мы его отправим. При желании вы можете отменить заказ.',
    no_driver_comfort: 'Машина Comfort пока не найдена — продолжаем поиск. Если не хотите ждать, вызовите машину Стандарт (цена по тарифу Стандарт).',
    switch_standard_btn: 'Заказать Стандарт',
    searching_comfort: 'Ищем Comfort…',
    cancel_confirm: 'Отменить заказ?',
    cancel_confirm_penalty: 'Водитель уже в пути. Отмена повлияет на ваш рейтинг отмен. Продолжить?',
    cancelled_free: 'Заказ отменён (без штрафа).',
    cancelled_penalty: 'Заказ отменён. ⚠️ Это повлияет на ваш рейтинг отмен.',
  },
};

export function miniappPage(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>Toy TaxY</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  /* Palitra mijoz ilovasi bilan BIR XIL (apps/customer-app/src/theme.ts).
     Mini app avval to'q ko'k temada edi — endi bitta brend ko'rinishi. */
  :root {
    --bg: #FFFFFF; --screen: #F4F7FB; --card: #FBFBFB; --map: #EDEDED;
    --ink: #171E2A; --muted: rgba(23,30,42,0.52);
    --line: rgba(23,30,42,0.16); --hair: rgba(23,30,42,0.10);
    --green: #0CAF50; --green-soft: #E4F6EB; --amber: #F68F0A; --red: #BC0000;
    --r-card: 16px; --r-sheet: 28px;
    --sh-card: 0 1px 3px rgba(23,30,42,0.07);
    --sh-raised: 0 6px 16px -8px rgba(12,175,80,0.55);
    --sh-sheet: 0 -18px 40px -24px rgba(23,30,42,0.35);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

  /* Xarita TO'LIQ ekran, varaq uning ustida suzadi (maketdagi tartib).
     Avval xarita 62% balandlikda edi va safar davomida kichkina qolardi. */
  #map { position: absolute; inset: 0; background: var(--map); }
  .leaflet-container { background: var(--map); }

  .sheet-base { position: absolute; left: 0; right: 0; bottom: 0; z-index: 600;
    background: var(--bg); border-top: 1px solid var(--hair);
    border-radius: var(--r-sheet) var(--r-sheet) 0 0;
    box-shadow: var(--sh-sheet); padding: 14px 12px 20px; }
  #sheet { max-height: 72%; overflow-y: auto; }

  .status { display: flex; align-items: center; gap: 10px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); flex: none; }
  .dot.wait { background: var(--amber); }
  h1 { font-size: 21px; font-weight: 500; margin: 0; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }

  .card { margin-top: 14px; background: var(--screen); border: 1px solid var(--hair);
    border-radius: var(--r-card); padding: 12px; }
  .car { font-size: 16px; font-weight: 700; }
  .plate { display: inline-block; margin-top: 6px; background: var(--bg); border: 1px solid var(--line);
    border-radius: 8px; padding: 4px 10px; font-weight: 700; letter-spacing: 1px; }
  .call { display: block; margin-top: 14px; text-align: center; text-decoration: none;
    background: var(--green); color: #fff; font-weight: 800; font-size: 17px;
    border-radius: var(--r-card); padding: 16px; box-shadow: var(--sh-raised); }

  #recenter { position: absolute; right: 12px; z-index: 700;
    background: var(--bg); border: 1px solid var(--hair); color: var(--green);
    border-radius: 50%; width: 46px; height: 46px; font-size: 20px; line-height: 1;
    box-shadow: var(--sh-card); }
  .msg { padding: 28px 20px; text-align: center; color: var(--muted); }


  /* --- Buyurtma rejimi --- */
  /* Nuqta xarita MARKAZIDA qotib turadi, foydalanuvchi xaritani suradi. Bu
     markerni barmoq bilan sudrashdan ancha aniqroq (barmoq nuqtani yopmaydi).
     Pin varaq USTIDAGI ko'rinadigan maydon markazida turadi — aks holda u
     varaq ortida qolardi. */
  #centerPin { position: absolute; left: 50%; z-index: 650; pointer-events: none;
    width: 28px; height: 35px; margin-left: -14px; transform: translateY(-100%);
    filter: drop-shadow(0 4px 8px rgba(23,30,42,0.35)); }
  #centerPin svg { display: block; width: 100%; height: 100%; }

  .paxrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .paxlabel { color: var(--amber); font-size: 17px; font-weight: 800; }
  .seg { display: flex; height: 42px; padding: 4px; border-radius: 999px;
    background: var(--amber); box-shadow: var(--sh-card); }
  .seg button { border: 0; background: none; color: #fff; font-size: 17px; font-weight: 700;
    padding: 0 16px; border-radius: 999px; font-family: inherit; }
  .seg button.on { background: var(--bg); color: var(--amber); box-shadow: var(--sh-card); }

  .cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
  .cat { height: 84px; border-radius: var(--r-card); border: 1px solid var(--line);
    background: var(--bg); box-shadow: var(--sh-card); padding: 5px 4px 0;
    display: flex; flex-direction: column; align-items: center; }
  .cat img { width: 76px; height: 44px; object-fit: contain; }
  .cat b { font-size: 15px; line-height: 18px; font-weight: 700; color: var(--ink); margin-top: 1px; }
  .cat span { font-size: 11px; line-height: 13px; color: var(--muted); }
  .cat.on { border-color: var(--green); background: var(--green-soft);
    box-shadow: var(--sh-raised); transform: translateY(-1px); }

  #orderBtn { width: 100%; margin-top: 12px; height: 60px; border: 0;
    border-radius: var(--r-card); background: var(--green); color: #fff;
    box-shadow: var(--sh-raised); font-family: inherit; }
  #orderBtn .big { display: block; font-size: 25px; font-weight: 800; line-height: 1.05; }
  #orderBtn .small { display: block; font-size: 13px; font-weight: 500; opacity: 0.94; }
  #orderBtn:disabled { opacity: 0.55; box-shadow: none; }
  #orderErr { color: var(--red); font-size: 13px; margin-top: 8px; min-height: 16px; }
  .hidden { display: none !important; }

  /* --- Yakuniy narx va baholash (bot chatidagi bilan bir xil) --- */
  .price { margin-top: 14px; text-align: center; }
  .price .lbl { color: var(--muted); font-size: 13px; }
  .price .val { color: var(--green); font-size: 34px; font-weight: 800; margin-top: 2px; }
  .price .val small { font-size: 17px; font-weight: 700; }
  .rate-q { color: var(--muted); font-size: 13px; margin-top: 16px; text-align: center; }
  .stars { display: flex; gap: 8px; margin-top: 10px; }
  .star { flex: 1; padding: 12px 0; border-radius: 12px; border: 1px solid var(--line);
    background: var(--card); color: var(--ink); font-size: 15px; font-weight: 700; }
  .star:disabled { opacity: 0.5; }
  .skip { display: block; width: 100%; margin-top: 10px; padding: 13px; border: 0;
    background: none; color: var(--muted); font-size: 14px; }
  .thanks { margin-top: 16px; text-align: center; color: var(--green);
    font-size: 16px; font-weight: 700; }
  /* Bekor qilish — asosiy amal EMAS: to'ldirilgan tugma emas, ramkali va
     tasdiq so'raydi (tasodifan bosilib safar bekor bo'lmasin). */
  .cancel { display: block; width: 100%; margin-top: 12px; padding: 16px;
    border: 2px solid var(--red); border-radius: 26px; background: var(--bg);
    color: var(--red); font-size: 17px; font-weight: 800; }
  .cancel:disabled { opacity: 0.5; }
  .switch { display: block; width: 100%; margin-top: 12px; padding: 16px;
    border: 0; border-radius: 26px; background: #0CAF50;
    color: #fff; font-size: 17px; font-weight: 800; }
  .switch:disabled { opacity: 0.5; }
  .sw-hint { margin-top: 10px; color: #51565F; font-size: 14px; line-height: 1.4; }
</style>
</head>
<body>
<div id="map"></div>
<div id="centerPin" class="hidden"><svg viewBox="0 0 74 92.5" fill="#BC0000"><path d="M43.5328 43.5328C45.3443 41.7214 46.25 39.5438 46.25 37C46.25 34.4562 45.3443 32.2786 43.5328 30.4672C41.7214 28.6557 39.5438 27.75 37 27.75C34.4562 27.75 32.2786 28.6557 30.4672 30.4672C28.6557 32.2786 27.75 34.4562 27.75 37C27.75 39.5438 28.6557 41.7214 30.4672 43.5328C32.2786 45.3443 34.4562 46.25 37 46.25C39.5438 46.25 41.7214 45.3443 43.5328 43.5328ZM37 80.2438C46.4042 71.6104 53.3802 63.7672 57.9281 56.7141C62.476 49.6609 64.75 43.3979 64.75 37.925C64.75 29.5229 62.0714 22.6432 56.7141 17.2859C51.3568 11.9286 44.7854 9.25 37 9.25C29.2146 9.25 22.6432 11.9286 17.2859 17.2859C11.9286 22.6432 9.25 29.5229 9.25 37.925C9.25 43.3979 11.524 49.6609 16.0719 56.7141C20.6198 63.7672 27.5958 71.6104 37 80.2438ZM37 92.5C24.5896 81.9396 15.3203 72.1307 9.19219 63.0734C3.06406 54.0161 0 45.6333 0 37.925C0 26.3625 3.71927 17.151 11.1578 10.2906C18.5964 3.43021 27.2104 0 37 0C46.7896 0 55.4036 3.43021 62.8422 10.2906C70.2807 17.151 74 26.3625 74 37.925C74 45.6333 70.9359 54.0161 64.8078 63.0734C58.6797 72.1307 49.4104 81.9396 37 92.5Z"/></svg></div>
<button id="recenter" class="hidden" title="center">◎</button>

<div id="orderSheet" class="sheet-base hidden">
  <div class="paxrow">
    <span class="paxlabel" id="paxLabel"></span>
    <div class="seg" id="seg"></div>
  </div>
  <div class="cats" id="cats"></div>
  <div id="orderErr"></div>
  <button id="orderBtn">…</button>
</div>

<div id="sheet" class="sheet-base hidden">
  <div class="status"><span class="dot wait" id="dot"></span><h1 id="title">…</h1></div>
  <div class="sub" id="sub"></div>
  <div id="info"></div>
  <div id="cancelWrap"></div>
  <div id="finish"></div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  var L10N = ${JSON.stringify(T)};
  var tg = window.Telegram && window.Telegram.WebApp;
  var params = new URLSearchParams(location.search);
  var orderId = params.get('order');
  var t = L10N[params.get('lang') === 'ru' ? 'ru' : 'uz'];

  var elTitle = document.getElementById('title');
  var elSub = document.getElementById('sub');
  var elInfo = document.getElementById('info');
  var elDot = document.getElementById('dot');

  function fail(text) {
    document.getElementById('map').style.display = 'none';
    document.getElementById('recenter').classList.add('hidden');
    document.getElementById('centerPin').classList.add('hidden');
    document.getElementById('orderSheet').classList.add('hidden');
    var sheet = document.getElementById('sheet');
    sheet.classList.remove('hidden');
    sheet.style.height = '100%';
    elTitle.textContent = '';
    elSub.innerHTML = '<div class="msg">' + text + '</div>';
  }

  if (!tg || !tg.initData) { fail(t.outside); return; }
  tg.ready();
  tg.expand();
  document.title = t.title;

  // Xizmat hududi markazi (GPS bo'lmasa shu yerdan boshlaymiz).
  var FALLBACK = [39.7683, 67.2792];
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView(FALLBACK, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  function pin(color, label) {
    return L.divIcon({
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      html: '<div style="width:26px;height:26px;border-radius:50%;background:' + color +
            ';border:3px solid #FFFFFF;box-shadow:0 0 0 2px ' + color +
            '55;display:flex;align-items:center;justify-content:center;font-size:13px">' + label + '</div>',
    });
  }

  var driverMarker = null;
  var pickupMarker = null;
  var followDriver = true; // foydalanuvchi xaritani surganda kuzatishni to'xtatamiz

  map.on('dragstart', function () { followDriver = false; });

  /*
   * O'Z JOYLASHUVI — BIR MARTA so'raladi, keyin keshdan ishlatiladi.
   *
   * NEGA: Telegram WebView geolokatsiya ruxsatini ESLAB QOLMAYDI — har
   * getCurrentPosition chaqiruvida "Allow Toy TaxY to access your location?"
   * oynasi qaytadan chiqadi. Tugma har bosilganda so'ralardi va bu juda
   * bezor qilardi.
   *
   * YECHIM: watchPosition BIR MARTA ishga tushiriladi (ruxsat bir marta
   * so'raladi), nuqta keshda yangilanib turadi. Tugma esa faqat keshdagi
   * nuqtaga suradi — hech qanday yangi ruxsat so'ramaydi.
   *
   * DIQQAT: bu izoh SHABLON SATRI ichida — teskari qo'shtirnoq ishlatmang,
   * u satrni uzib yuboradi (aynan shunday bo'ldi va build yiqildi).
   */
  var myLoc = null;
  var meMarker = null;
  var geoWatchId = null;
  var geoDenied = false;

  /*
   * "Siz shu yerdasiz" belgisi. Markazdagi qizil nuqta TANLANGAN olib ketish
   * joyi, bu esa mijozning HAQIQIY joylashuvi — ikkisi farq qilishi mumkin
   * (aynan shu uchun xarita bor). Ikkisini ko'rmasa mijoz nuqtani qayerga
   * qo'yayotganini tushunmaydi.
   */
  function updateMeMarker() {
    if (!myLoc) return;
    if (!meMarker) {
      meMarker = L.marker([myLoc.lat, myLoc.lng], { icon: pin('#F68F0A', ''), zIndexOffset: -100 })
        .addTo(map)
        .bindTooltip(t.you);
    } else {
      meMarker.setLatLng([myLoc.lat, myLoc.lng]);
    }
  }

  function setMyLoc(lat, lng) {
    myLoc = { lat: lat, lng: lng };
    updateMeMarker();
  }

  function startGeoWatch(onFirstFix) {
    if (!navigator.geolocation || geoDenied) return;
    if (geoWatchId !== null) {
      // Allaqachon kuzatilyapti — nuqta bo'lsa darhol beramiz.
      if (myLoc && onFirstFix) onFirstFix(myLoc);
      return;
    }
    var btn = document.getElementById('recenter');
    btn.disabled = true;
    geoWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        btn.disabled = false;
        var first = !myLoc;
        setMyLoc(pos.coords.latitude, pos.coords.longitude);
        if (first && onFirstFix) onFirstFix(myLoc);
      },
      function () {
        btn.disabled = false;
        // Rad etildi yoki GPS yo'q — QAYTA SO'RAMAYMIZ.
        geoDenied = true;
        if (geoWatchId !== null) {
          navigator.geolocation.clearWatch(geoWatchId);
          geoWatchId = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  function stopGeoWatch() {
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
  }

  /*
   * Joylashuvni so'rash. Ikki yo'l:
   *
   * 1) Telegram LocationManager (Bot API 8.0+) — ENG YAXSHISI: ruxsatni
   *    Telegram o'z sozlamalarida eslab qoladi, ya'ni mini app har ochilganda
   *    qayta so'ralmaydi.
   * 2) Zaxira — brauzer geolokatsiyasi. Bu yerda ruxsat mini app har
   *    ochilganda bir marta so'raladi (Telegram WebView uni saqlamaydi).
   */
  function requestMyLoc(cb) {
    var lm = tg.LocationManager;
    if (lm && typeof lm.getLocation === 'function') {
      var ask = function () {
        lm.getLocation(function (loc) {
          if (loc && loc.latitude != null) {
            setMyLoc(loc.latitude, loc.longitude);
            if (cb) cb(myLoc);
          } else {
            geoDenied = true; // rad etildi — bezor qilmaymiz
          }
        });
      };
      if (lm.isInited) ask();
      else lm.init(ask);
      return;
    }
    startGeoWatch(cb);
  }

  /** Xaritani o'z joylashuvimga surish — keshdan, ruxsat so'ramasdan. */
  function centerOnMe() {
    if (myLoc) {
      setViewAtPin(myLoc.lat, myLoc.lng, 16);
      return;
    }
    // Hali nuqta yo'q — bir marta so'raymiz.
    requestMyLoc(function (loc) {
      setViewAtPin(loc.lat, loc.lng, 16);
    });
  }

  document.getElementById('recenter').onclick = function () {
    // KUZATUV rejimida — taksiga qaytadi; BUYURTMA rejimida — o'z joylashuvimga.
    if (driverMarker) {
      followDriver = true;
      map.panTo(driverMarker.getLatLng());
    } else {
      centerOnMe();
    }
  };

  function ago(iso) {
    if (!iso) return '';
    var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 10) return t.just_now;
    if (s < 60) return s + ' ' + t.sec_ago;
    return Math.round(s / 60) + ' ' + t.min_ago;
  }

  function statusText(st) {
    if (st === 'ARRIVED') return t.arrived;
    if (st === 'IN_PROGRESS') return t.in_progress;
    if (st === 'ACCEPTED') return t.on_the_way;
    if (st === 'NO_DRIVER') return t.no_driver;
    return t.searching;
  }

  var timer = null;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }

  // Oxirgi kelgan holat — baho yuborilgach sahifani so'rovsiz qayta chizish uchun
  // (safar tugagach poll() to'xtaydi, ya'ni yangi ma'lumot kelmaydi).
  var lastData = null;

  function render(d) {
    lastData = d;
    // Comfort topilmasa ham qidiruv davom etadi - yakuniy eshitiladigan
    // "Taksi topilmadi" o'rniga shuni aytamiz (ilova bilan bir xil).
    var comfortSearch = d.category === 'comfort' && (d.orderStatus === 'DISPATCHING' || d.orderStatus === 'NO_DRIVER');
    elTitle.textContent = d.finished ? t.finished : (comfortSearch ? t.searching_comfort : statusText(d.orderStatus));
    elDot.className = 'dot' + (d.driver ? '' : ' wait');

    if (!pickupMarker) {
      pickupMarker = L.marker([d.pickup.lat, d.pickup.lng], { icon: pin('#FF7B72', '🧍') })
        .addTo(map).bindTooltip(t.you);
    }

    if (d.driver) {
      var ll = [d.driver.lat, d.driver.lng];
      if (!driverMarker) {
        driverMarker = L.marker(ll, { icon: pin('#3DDC84', '🚕') }).addTo(map).bindTooltip(t.taxi);
        map.fitBounds(L.latLngBounds([ll, [d.pickup.lat, d.pickup.lng]]).pad(0.35));
      } else {
        driverMarker.setLatLng(ll);
        if (followDriver) map.panTo(ll, { animate: true });
      }
      elSub.textContent = t.updated + ': ' + ago(d.driver.at);
    } else {
      elSub.textContent = t.no_location;
      map.setView([d.pickup.lat, d.pickup.lng], 14);
    }

    if (d.car) {
      elInfo.innerHTML =
        '<div class="card"><div class="car">' + esc(d.car.name) + '</div>' +
        (d.car.model ? '<div class="sub">' + esc(d.car.model) + '</div>' : '') +
        (d.car.plate ? '<div class="plate">' + esc(d.car.plate) + '</div>' : '') +
        '</div>' +
        // Safar tugagach qo'ng'iroq tugmasi kerak emas — tugmalar orasida
        // baholash yulduzlari ko'rinmay qolardi.
        (d.car.phone && !d.finished
          ? '<a class="call" href="tel:' + esc(d.car.phone) + '">📞 ' + esc(d.car.phone) + '</a>'
          : '');
    } else {
      elInfo.innerHTML = '';
    }

    renderCancel(d);
    renderFinish(d);
  }

  var cancelBusy = false;

  /**
   * Bekor qilish tugmasi. Bot chatida bor edi, mini app'da yo'q edi — mijoz
   * xaritani ochib turib bekor qilolmasdi, chatga qaytishi kerak edi.
   */
  function renderCancel(d) {
    var el = document.getElementById('cancelWrap');
    var html = '';
    // Comfort topilmadi: kutib turish o'rniga Standart taklif qilinadi. Qoida
    // serverda (canSwitchToStandard) - ilova va bot bilan bir xil.
    if (d.canSwitchToStandard) {
      html += '<div class="sw-hint">' + esc(t.no_driver_comfort) + '</div>' +
              '<button class="switch" id="switchBtn">' + esc(t.switch_standard_btn) + '</button>';
    } else if (d.orderStatus === 'NO_DRIVER') {
      // "Taksi topilmadi" yolg'iz turganda yakuniy eshitilardi - mijoz zakaz
      // bekor bo'ldi deb o'ylardi, holbuki haydovchi onlayn bo'lsa u qayta ko'tariladi.
      html += '<div class="sw-hint">' + esc(t.no_driver_info) + '</div>';
    }
    if (d.cancellable) {
      html += '<button class="cancel" id="cancelBtn">' + esc(t.cancel_btn) + '</button>';
    }
    el.innerHTML = html;
    var sw = document.getElementById('switchBtn');
    if (sw) sw.addEventListener('click', sendSwitch);
    var cb = document.getElementById('cancelBtn');
    if (!cb) return;
    cb.addEventListener('click', function () {
      if (cancelBusy) return;
      // Haydovchi biriktirilgan bo'lsa bekor qilish jarimali — mijoz buni
      // BOSISHDAN OLDIN bilsin.
      var msg = d.driver || d.car ? t.cancel_confirm_penalty : t.cancel_confirm;
      if (tg.showConfirm) {
        tg.showConfirm(msg, function (ok) { if (ok) sendCancel(); });
      } else if (confirm(msg)) {
        sendCancel();
      }
    });
  }

  var switchBusy = false;

  /** Comfort topilmadi - Standart bilan qayta qidirish, keyin holat darhol yangilanadi. */
  function sendSwitch() {
    if (switchBusy) return;
    switchBusy = true;
    var btn = document.getElementById('switchBtn');
    if (btn) btn.disabled = true;
    fetch('/miniapp/switch-standard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId: orderId }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function () {
        switchBusy = false;
        poll();
      })
      .catch(function (e) {
        switchBusy = false;
        if (btn) btn.disabled = false;
        elSub.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
      });
  }

  function sendCancel() {
    cancelBusy = true;
    var btn = document.getElementById('cancelBtn');
    if (btn) btn.disabled = true;
    fetch('/miniapp/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId: orderId }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (res) {
        cancelBusy = false;
        if (tg.showAlert) {
          tg.showAlert(res.penalized ? t.cancelled_penalty : t.cancelled_free);
        }
        returnToOrdering();
      })
      .catch(function (e) {
        cancelBusy = false;
        if (btn) btn.disabled = false;
        elSub.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
      });
  }

  // Raqamni 4000 → 4 000 ko'rinishida yozamiz. Regexsiz: bu fayl shablon
  // satri ichida va teskari chiziqlar yo'qolib, regex buzilardi.
  function money(n) {
    var s = String(Math.round(Number(n) || 0));
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
      out += s.charAt(i);
    }
    return out;
  }

  var rateSent = false;

  /**
   * Safar yakunlangach: narx + baholash. Bot chatida bu allaqachon bor edi,
   * mini app esa faqat sarlavhani almashtirib qo'yardi — mijoz bir vaqtning
   * o'zida ikki xil holatni ko'rardi.
   */
  function renderFinish(d) {
    var el = document.getElementById('finish');
    if (!d.finished) { el.innerHTML = ''; return; }

    // Bekor qilingan safar uchun na narx, na baho bo'ladi — ko'rsatadigan
    // narsa yo'q, shuning uchun darhol buyurtma rejimiga qaytamiz.
    if (!d.completed) {
      if (tg.showAlert) tg.showAlert(t.cancelled);
      returnToOrdering();
      return;
    }

    var html = '';
    if (d.finalPrice != null) {
      html += '<div class="price"><div class="lbl">' + esc(t.price) + '</div>' +
              '<div class="val">' + money(d.finalPrice) + ' <small>' + esc(t.som) + '</small></div></div>';
      // Operator qo'shgan summa ALOHIDA qator. U yakuniy narxga allaqachon
      // kirgan, lekin jimgina kirsa mijoz "nega bunchalik ko'p?" deb qolardi.
      if (d.fareAdjustment) {
        html += '<div class="lbl" style="text-align:center;margin-top:-6px">' +
                esc(t.extra) + ': ' + (d.fareAdjustment > 0 ? '+' : '') +
                money(d.fareAdjustment) + ' ' + esc(t.som) +
                (d.fareAdjustmentReason ? ' \u2014 ' + esc(d.fareAdjustmentReason) : '') +
                '</div>';
      }
    }

    // d.rated bot chatidan berilgan bahoni ham qamrab oladi — ikki oyna
    // bir xil holatni ko'rsatishi shundan.
    if (d.rated || rateSent) {
      html += '<div class="thanks">' + esc(t.thanks_rating) + '</div>';
      el.innerHTML = html;
      return;
    }

    html += '<div class="rate-q">' + esc(t.rate_prompt) + '</div><div class="stars" id="stars">';
    for (var n = 1; n <= 5; n++) {
      html += '<button class="star" data-score="' + n + '">' + n + '⭐</button>';
    }
    html += '</div><button class="skip" id="skipRate">' + esc(t.skip_rating) + '</button>';
    el.innerHTML = html;

    var stars = el.querySelectorAll('.star');
    for (var k = 0; k < stars.length; k++) {
      stars[k].addEventListener('click', function () {
        sendRate(Number(this.getAttribute('data-score')));
      });
    }
    document.getElementById('skipRate').addEventListener('click', function () {
      rateSent = true;
      renderFinish(d);
    });
  }

  function sendRate(score) {
    var buttons = document.querySelectorAll('.star');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
    fetch('/miniapp/rate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId: orderId, score: score }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        rateSent = true;
        lastData.rated = true;
        renderFinish(lastData);
      })
      .catch(function (e) {
        // Xatoni KO'RSATAMIZ va tugmalarni qaytaramiz — jimgina yutilsa
        // mijoz baho ketdi deb o'ylardi.
        for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;
        elSub.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
      });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function poll() {
    fetch('/miniapp/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, orderId: orderId }),
    })
      .then(function (r) {
        if (r.status === 403 || r.status === 404) throw new Error('denied');
        // Xato KODINI matnga chiqaramiz: "Ma'lumot olinmadi" o'zi hech narsa
        // aytmaydi — CORS/500 muammosini topish uchun yarim soat ketgan edi.
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        try {
          render(d);
        } catch (re) {
          // Chizishdagi xato tarmoq xatosidan farqlansin (avval ikkalasi ham
          // bir xil "Ma'lumot olinmadi" ko'rinardi).
          elSub.textContent = t.err + ' [render: ' + (re && re.message) + ']';
        }
        // Safar tugagach so'rovlarni to'xtatamiz — bekorga tarmoq sarflamaymiz.
        if (!d.finished) schedule(5000);
      })
      .catch(function (e) {
        if (e.message === 'denied') { fail(t.denied); return; }
        elSub.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
        schedule(8000);
      });
  }

  // ================= BUYURTMA REJIMI =================

  var elOrderSheet = document.getElementById('orderSheet');
  var elOrderBtn = document.getElementById('orderBtn');
  var elOrderErr = document.getElementById('orderErr');
  var elCenterPin = document.getElementById('centerPin');
  var elSheet = document.getElementById('sheet');
  var elRecenter = document.getElementById('recenter');
  var category = 'standard';
  var paxBig = false;
  var tariffs = {};
  var CAR = { standard: 'standart', comfort: 'komfort', cargo: 'yuk' };

  function som(v) {
    // DIQQAT: bu satr template literal ICHIDA — regex eskeyplari IKKI marta
    // yozilishi shart. Bitta backslash bilan yozilganda TypeScript uni satr
    // eskeypi deb o'qib yeb qo'yadi va sahifaga /B(?=(d{3})+(?!d))/ bo'lib
    // tushadi — narx razryadlarga umuman ajratilmaydi (12000, 12 000 emas).
    return String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' ');
  }

  /**
   * Pin va "joylashuvim" tugmasi VARAQ USTIDA tursin.
   *
   * Xarita to'liq ekran bo'lgani uchun uning geometrik markazi varaq ortiga
   * tushadi — mijoz tanlayotgan nuqtasini ko'rmasdi. Shuning uchun
   * ko'rinadigan maydon (ekran minus varaq) markazi hisoblanadi.
   */
  function pinY() {
    var sheet = !elOrderSheet.classList.contains('hidden')
      ? elOrderSheet
      : (!elSheet.classList.contains('hidden') ? elSheet : null);
    var inset = sheet ? sheet.offsetHeight : 0;
    return Math.max(120, window.innerHeight - inset) / 2;
  }

  function layout() {
    var y = pinY();
    elCenterPin.style.top = Math.round(y) + 'px';
    elRecenter.style.top = Math.round(y * 2 - 58) + 'px';
    map.invalidateSize();
  }

  /**
   * Pin OSTIDAGI koordinata — xarita MARKAZI emas.
   *
   * Pin varaq ustidagi ko'rinadigan maydon markazida turadi, xaritaning
   * geometrik markazi esa varaq ortida qoladi. Ikkisi taxminan yarim varaq
   * balandligiga farq qiladi — ya'ni buyurtma mijoz ko'rsatgan joydan
   * PASTROQQA ketardi. Aynan shu xato ilovada ham bo'lgan va tuzatilgan.
   */
  function latLngAtPin() {
    return map.containerPointToLatLng([map.getSize().x / 2, pinY()]);
  }

  /** Berilgan nuqtani PIN OSTIGA olib keladi (markazga emas). */
  function setViewAtPin(lat, lng, zoom) {
    var z = zoom == null ? map.getZoom() : zoom;
    var target = map.project([lat, lng], z);
    var half = map.getSize().divideBy(2);
    var pin = L.point(map.getSize().x / 2, pinY());
    map.setView(map.unproject(target.add(half.subtract(pin)), z), z, { animate: true });
  }

  window.addEventListener('resize', layout);

  /**
   * Buyurtma varag'ining MATNLI qismini chizadi.
   *
   * startOrdering() dan ajratilgan: til almashtirilganda varaqni qaytadan
   * chizish kerak, lekin centerOnMe() ni QAYTA chaqirmaslik shart —
   * Telegram WebView geolokatsiya ruxsatini eslamaydi va har chaqiruvda
   * so'rov oynasi qayta chiqadi.
   */
  function paintOrderSheet() {
    document.getElementById('paxLabel').textContent = t.pax_label;

    // Yo'lovchilar tanlagichi: "5+" da serverga 5 yuboriladi va bu YETARLI —
    // parkda 4 yoki 7 o'rinli mashinalar bor, oraliq yo'q.
    var seg = document.getElementById('seg');
    seg.innerHTML = '';
    [[false, t.pax_few], [true, t.pax_many]].forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = o[0] === paxBig ? 'on' : '';
      b.textContent = o[1];
      b.onclick = function () {
        paxBig = o[0];
        Array.prototype.forEach.call(seg.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      seg.appendChild(b);
    });

    var cats = [['standard', t.cat_standard], ['comfort', t.cat_comfort], ['cargo', t.cat_cargo]];
    var box = document.getElementById('cats');
    box.innerHTML = '';
    cats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat' + (c[0] === category ? ' on' : '');
      var price = tariffs[c[0]] != null ? t.from_price.replace('{v}', som(tariffs[c[0]])) : '';
      b.innerHTML = '<img src="/miniapp/cars/' + CAR[c[0]] + '" alt=""><b>' + esc(c[1])
        + '</b><span>' + esc(price) + '</span>';
      b.onclick = function () {
        category = c[0];
        Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        paintOrderBtn();
      };
      box.appendChild(b);
    });

    paintOrderBtn();
    layout();
  }

  function startOrdering() {
    elSheet.classList.add('hidden');
    elOrderSheet.classList.remove('hidden');
    elCenterPin.classList.remove('hidden');
    // "Mening joylashuvim" tugmasi BUYURTMA rejimida ham kerak: xaritani
    // surgandan keyin o'z joyiga qaytadigan yo'l yo'q edi.
    elRecenter.classList.remove('hidden');
    elRecenter.title = t.my_loc;
    paintOrderSheet();

    // Boshlang'ich markaz — mijozning GPS'i (ruxsat bermasa FALLBACK qoladi).
    // Ruxsat FAQAT shu yerda bir marta so'raladi; keyingi tugma bosishlari
    // keshdagi nuqtani ishlatadi.
    centerOnMe();

    elOrderBtn.onclick = submitOrder;
  }

  /** Tugmada tanlangan toifa va uning boshlang'ich narxi turadi (maketdagidek). */
  function paintOrderBtn() {
    var fare = tariffs[category];
    var name = t['cat_' + (category === 'standard' ? 'standard' : category === 'comfort' ? 'comfort' : 'cargo')];
    elOrderBtn.innerHTML = '<span class="big">' + esc(t.order_btn) + '</span>'
      + (fare != null
        ? '<span class="small">' + esc(name) + ' - ' + esc(t.from_price.replace('{v}', som(fare))) + '</span>'
        : '');
  }

  function submitOrder() {
    // Pin OSTIDAGI nuqta — map.getCenter() EMAS (yuqoridagi izohga qarang).
    var c = latLngAtPin();
    elOrderBtn.disabled = true;
    elOrderBtn.innerHTML = '<span class="big">' + esc(t.ordering) + '</span>';
    elOrderErr.textContent = '';
    fetch('/miniapp/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        category: category,
        pickup: { lat: c.lat, lng: c.lng },
        passengers: paxBig ? 5 : undefined,
      }),
    })
      .then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; });
      })
      .then(function (res) {
        if (!res.ok) {
          // Server sababini AYNAN ko'rsatamiz (masalan "Sizda allaqachon faol
          // buyurtma bor") — umumiy "xatolik" hech narsa tushuntirmaydi.
          elOrderErr.textContent = (res.body && res.body.message) || ('HTTP ' + res.status);
          elOrderBtn.disabled = false;
          paintOrderBtn();
          return;
        }
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        startTracking(res.body.orderId);
      })
      .catch(function (e) {
        elOrderErr.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
        elOrderBtn.disabled = false;
        paintOrderBtn();
      });
  }

  // ================= KUZATUV REJIMI =================

  /**
   * Kuzatuvdan buyurtma rejimiga qaytish.
   *
   * Avval bekor qilingan safar ekranni QOTIRIB qo'yardi: varaqda "Buyurtma
   * bekor qilindi" yozuvi qolar, qaytish yo'li esa umuman yo'q edi — mijoz
   * Telegram'ni yopib qayta ochishga majbur bo'lardi.
   */
  function returnToOrdering() {
    clearTimeout(timer);
    orderId = null;
    lastData = null;
    rateSent = false;
    elSheet.classList.add('hidden');
    elInfo.innerHTML = '';
    document.getElementById('cancelWrap').innerHTML = '';
    document.getElementById('finish').innerHTML = '';
    startOrdering();
  }

  function startTracking(id) {
    orderId = id;
    elOrderSheet.classList.add('hidden');
    elCenterPin.classList.add('hidden');
    elSheet.classList.remove('hidden');
    elRecenter.classList.remove('hidden');
    elRecenter.title = t.taxi;
    // Kuzatuvda o'z joylashuvimiz kerak emas (olib ketish nuqtasi allaqachon
    // 🧍 bilan ko'rsatiladi) — ikkinchi odamcha chalkashtirardi.
    // GPS kuzatuvini ham to'xtatamiz, batareyani bekorga yemasin.
    stopGeoWatch();
    if (meMarker) {
      map.removeLayer(meMarker);
      meMarker = null;
    }
    layout();
    poll();
  }

  // ================= BOSHLANISH =================

  // Havolada zakaz bo'lsa (botdagi "Taksi qayerda?" tugmasi) — darhol kuzatuv.
  if (orderId) {
    startTracking(orderId);
  } else {
    fetch('/miniapp/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(function (r) {
        if (r.status === 403) throw new Error('denied');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (d.tariffs) {
          d.tariffs.forEach(function (x) { tariffs[x.category] = x.baseFare; });
        }
        if (d.orderId) startTracking(d.orderId);
        else startOrdering();
      })
      .catch(function (e) {
        if (e.message === 'denied') { fail(t.denied); return; }
        // Holatni bilmasak ham buyurtma berishga to'sqinlik qilmaymiz.
        startOrdering();
        elOrderErr.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
      });
  }
})();
</script>
</body>
</html>`;
}
