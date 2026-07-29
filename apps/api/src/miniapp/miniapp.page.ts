// Telegram Mini App sahifasi — "Taksi qayerda?" jonli xaritasi.
//
// Nega alohida sahifa, botdagi statik joylashuv o'rniga: Telegram'ga yuborilgan
// joylashuv "muzlab" qoladi (`replyWithLocation` jonli emas) va mijoz har safar
// tugmani qayta bosishi kerak edi. Bu sahifa har 5 soniyada o'zi yangilanadi.
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
</style>
</head>
<body>
<div id="map"></div>
<button id="recenter" title="center">◎</button>
<div id="sheet">
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
    document.getElementById('recenter').style.display = 'none';
    document.getElementById('sheet').style.height = '100%';
    elTitle.textContent = '';
    elSub.innerHTML = '<div class="msg">' + text + '</div>';
  }

  if (!tg || !tg.initData) { fail(t.outside); return; }
  tg.ready();
  tg.expand();
  document.title = t.title;

  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([41.31, 69.24], 13);
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

  poll();
})();
</script>
</body>
</html>`;
}
