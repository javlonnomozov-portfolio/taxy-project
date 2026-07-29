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
    cat_cargo: 'Yuk',
    order_btn: 'Taksi chaqirish',
    ordering: 'Yuborilmoqda…',
    my_loc: 'Mening joylashuvim',
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
    cat_cargo: 'Грузовой',
    order_btn: 'Вызвать такси',
    ordering: 'Отправляем…',
    my_loc: 'Моё местоположение',
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
  :root {
    --bg: #0A0F1E; --panel: #131B2E; --border: #24304A;
    --text: #E8EDF7; --muted: #8B98B4; --accent: #5B8DEF; --ok: #3DDC84;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  #map { position: absolute; inset: 0 0 auto 0; height: 62%; background: var(--bg); }
  #sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 38%;
    background: var(--panel); border-top: 1px solid var(--border);
    border-radius: 18px 18px 0 0; padding: 18px 20px; overflow-y: auto; }
  .status { display: flex; align-items: center; gap: 10px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ok); flex: none; }
  .dot.wait { background: #FFB020; }
  h1 { font-size: 20px; font-weight: 800; margin: 0; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .card { margin-top: 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--border);
    border-radius: 14px; padding: 14px; }
  .car { font-size: 17px; font-weight: 700; }
  .plate { display: inline-block; margin-top: 6px; background: #1B2438; border: 1px solid var(--border);
    border-radius: 8px; padding: 4px 10px; font-weight: 700; letter-spacing: 1px; }
  .call { display: block; margin-top: 14px; text-align: center; text-decoration: none;
    background: var(--accent); color: #fff; font-weight: 700; font-size: 16px;
    border-radius: 14px; padding: 15px; }
  #recenter { position: absolute; right: 14px; top: calc(62% - 56px); z-index: 500;
    background: var(--panel); border: 1px solid var(--border); color: var(--text);
    border-radius: 50%; width: 42px; height: 42px; font-size: 18px; line-height: 1; }
  .msg { padding: 28px 20px; text-align: center; color: var(--muted); }
  .leaflet-container { background: #0A0F1E; }

  /* --- Buyurtma rejimi --- */
  /* Nuqta xarita MARKAZIDA qotib turadi, foydalanuvchi xaritani suradi. Bu
     markerni barmoq bilan sudrashdan ancha aniqroq (barmoq nuqtani yopmaydi). */
  #centerPin { position: absolute; left: 50%; z-index: 600; pointer-events: none;
    transform: translate(-50%, -100%); font-size: 34px; line-height: 1;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6)); }
  #orderSheet { position: absolute; left: 0; right: 0; bottom: 0;
    background: var(--panel); border-top: 1px solid var(--border);
    border-radius: 18px 18px 0 0; padding: 18px 20px 22px; }
  .cats { display: flex; gap: 8px; margin-top: 14px; }
  .cat { flex: 1; text-align: center; padding: 12px 6px; border-radius: 12px;
    border: 1px solid var(--border); background: #1B2438; color: var(--muted);
    font-size: 14px; font-weight: 600; }
  .cat.on { border-color: var(--accent); background: rgba(91,141,239,0.16); color: var(--text); }
  #orderBtn { width: 100%; margin-top: 16px; padding: 17px; border: 0;
    border-radius: 14px; background: var(--accent); color: #fff;
    font-size: 17px; font-weight: 800; }
  #orderBtn:disabled { opacity: 0.55; }
  #orderErr { color: #FF7B72; font-size: 13px; margin-top: 10px; min-height: 16px; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<div id="map"></div>
<div id="centerPin" class="hidden">📍</div>
<button id="recenter" class="hidden" title="center">◎</button>

<div id="orderSheet" class="hidden">
  <h1 id="orderTitle">…</h1>
  <div class="sub" id="orderHint"></div>
  <div class="cats" id="cats"></div>
  <div id="orderErr"></div>
  <button id="orderBtn">…</button>
</div>

<div id="sheet" class="hidden">
  <div class="status"><span class="dot wait" id="dot"></span><h1 id="title">…</h1></div>
  <div class="sub" id="sub"></div>
  <div id="info"></div>
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
            ';border:3px solid #0A0F1E;box-shadow:0 0 0 2px ' + color +
            '55;display:flex;align-items:center;justify-content:center;font-size:13px">' + label + '</div>',
    });
  }

  var driverMarker = null;
  var pickupMarker = null;
  var followDriver = true; // foydalanuvchi xaritani surganda kuzatishni to'xtatamiz

  map.on('dragstart', function () { followDriver = false; });
  document.getElementById('recenter').onclick = function () {
    followDriver = true;
    if (driverMarker) map.panTo(driverMarker.getLatLng());
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
    return t.searching;
  }

  var timer = null;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }

  function render(d) {
    elTitle.textContent = d.finished ? t.finished : statusText(d.orderStatus);
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
        (d.car.phone ? '<a class="call" href="tel:' + esc(d.car.phone) + '">📞 ' + esc(d.car.phone) + '</a>' : '');
    } else {
      elInfo.innerHTML = '';
    }
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

  /** Markazdagi nuqta xarita maydonining o'rtasida tursin. */
  function placeCenterPin() {
    var h = document.getElementById('map').clientHeight;
    elCenterPin.style.top = h / 2 + 'px';
  }

  function setMapHeight(pct) {
    document.getElementById('map').style.height = pct;
    elRecenter.style.top = 'calc(' + pct + ' - 56px)';
    map.invalidateSize();
    placeCenterPin();
  }

  function startOrdering() {
    elSheet.classList.add('hidden');
    elOrderSheet.classList.remove('hidden');
    elCenterPin.classList.remove('hidden');
    elRecenter.classList.add('hidden');
    document.getElementById('orderTitle').textContent = t.order_title;
    document.getElementById('orderHint').textContent = t.order_hint;
    elOrderBtn.textContent = t.order_btn;

    var cats = [['standard', t.cat_standard], ['comfort', t.cat_comfort], ['cargo', t.cat_cargo]];
    var box = document.getElementById('cats');
    box.innerHTML = '';
    cats.forEach(function (c) {
      var b = document.createElement('div');
      b.className = 'cat' + (c[0] === category ? ' on' : '');
      b.textContent = c[1];
      b.onclick = function () {
        category = c[0];
        Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      box.appendChild(b);
    });

    // Buyurtma varag'i balandligi o'zgaruvchan — xaritani unga moslaymiz.
    setMapHeight(100 - Math.round((elOrderSheet.offsetHeight / window.innerHeight) * 100) + '%');

    // Boshlang'ich markaz — mijozning GPS'i (ruxsat bersa).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) { map.setView([pos.coords.latitude, pos.coords.longitude], 16); },
        function () { /* ruxsat yo'q — FALLBACK qoladi */ },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }

    elOrderBtn.onclick = submitOrder;
  }

  function submitOrder() {
    var c = map.getCenter();
    elOrderBtn.disabled = true;
    elOrderBtn.textContent = t.ordering;
    elOrderErr.textContent = '';
    fetch('/miniapp/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        category: category,
        pickup: { lat: c.lat, lng: c.lng },
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
          elOrderBtn.textContent = t.order_btn;
          return;
        }
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        startTracking(res.body.orderId);
      })
      .catch(function (e) {
        elOrderErr.textContent = t.err + ' [' + (e && e.message ? e.message : 'network') + ']';
        elOrderBtn.disabled = false;
        elOrderBtn.textContent = t.order_btn;
      });
  }

  // ================= KUZATUV REJIMI =================

  function startTracking(id) {
    orderId = id;
    elOrderSheet.classList.add('hidden');
    elCenterPin.classList.add('hidden');
    elSheet.classList.remove('hidden');
    elRecenter.classList.remove('hidden');
    setMapHeight('62%');
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
