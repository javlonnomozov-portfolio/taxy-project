import { useCallback, useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { View } from 'react-native';
import { C } from './theme';

export interface MapMarker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

// Sahifa BIR MARTA yuklanadi, keyin nuqtalar `__setMarkers` orqali yangilanadi.
// Avval har GPS yangilanishida `source={{html}}` o'zgarib WebView qayta yuklanardi —
// kichik xaritada bu sezilmasdi, to'liq ekranda esa xarita doim "sakrab" turardi.
function buildHtml(line: boolean) {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${C.mapBg}}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('m',{zoomControl:false,attributionControl:false}).setView([39.7683,67.2792],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var LINE = ${line ? 'true' : 'false'};
  var framed = false;
  // Nuqtalar panel USTIDAGI ko'rinadigan maydonga sig'sin — pastdagi
  // inset (panel balandligi) hisobga olinadi.
  var inset = 0;
  window.__setInset = function(px){ inset = px; };
  window.__setMarkers = function(ms){
    layer.clearLayers();
    var pts = [];
    ms.forEach(function(m){
      var mk = L.circleMarker([m.lat,m.lng],{color:'#fff',fillColor:m.color,fillOpacity:1,radius:9,weight:2}).addTo(layer);
      if(m.label){ mk.bindTooltip(m.label,{permanent:true,direction:'top',offset:[0,-8]}); }
      pts.push([m.lat,m.lng]);
    });
    // Ko'rinishni FAQAT birinchi marta moslaymiz — aks holda foydalanuvchi
    // xaritani surgan zahoti keyingi GPS yangilanishi uni qaytarib olardi.
    if(!framed && pts.length){
      if(pts.length>1){ map.fitBounds(pts,{paddingTopLeft:[40,40],paddingBottomRight:[40,inset+40],maxZoom:16}); }
      else { map.setView(pts[0],15); }
      framed = true;
    }
    if(LINE && ms.length>=2){
      L.polyline([[ms[0].lat,ms[0].lng],[ms[1].lat,ms[1].lng]],{color:'${C.accent}',dashArray:'6',weight:3}).addTo(layer);
    }
  };
</script></body></html>`;
}

// Markaziy pin QATTIQ ekranga yopishtirilgan (Leaflet marker emas) — foydalanuvchi
// xaritani suradi, pin joyida qoladi, pin ostidagi koordinata "tanlangan nuqta" bo'ladi.
//
// PIN EKRAN MARKAZIDA EMAS: pastdagi panel xaritaning bir qismini yopadi va
// pin markazda tursa PANEL ORQASIDA qolardi — foydalanuvchi tanlayotgan
// nuqtasini umuman ko'rmasdi (avvalgi versiyadagi haqiqiy nuqson). Shuning
// uchun `inset` — panel balandligi — beriladi va pin ko'rinadigan maydon
// markaziga qo'yiladi. Shu sababli `map.getCenter()` ham ishlatilmaydi:
// pin ostidagi nuqta `containerPointToLatLng` bilan olinadi.
function buildPickerHtml() {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${C.mapBg}}
  .pin{position:absolute;left:50%;top:50%;width:28px;height:35px;margin-left:-14px;margin-top:-35px;pointer-events:none;z-index:1000}
</style>
</head><body><div id="m"></div>
<svg class="pin" viewBox="0 0 74 92.5" fill="${C.pin}"><path d="M43.5328 43.5328C45.3443 41.7214 46.25 39.5438 46.25 37C46.25 34.4562 45.3443 32.2786 43.5328 30.4672C41.7214 28.6557 39.5438 27.75 37 27.75C34.4562 27.75 32.2786 28.6557 30.4672 30.4672C28.6557 32.2786 27.75 34.4562 27.75 37C27.75 39.5438 28.6557 41.7214 30.4672 43.5328C32.2786 45.3443 34.4562 46.25 37 46.25C39.5438 46.25 41.7214 45.3443 43.5328 43.5328ZM37 80.2438C46.4042 71.6104 53.3802 63.7672 57.9281 56.7141C62.476 49.6609 64.75 43.3979 64.75 37.925C64.75 29.5229 62.0714 22.6432 56.7141 17.2859C51.3568 11.9286 44.7854 9.25 37 9.25C29.2146 9.25 22.6432 11.9286 17.2859 17.2859C11.9286 22.6432 9.25 29.5229 9.25 37.925C9.25 43.3979 11.524 49.6609 16.0719 56.7141C20.6198 63.7672 27.5958 71.6104 37 80.2438ZM37 92.5C24.5896 81.9396 15.3203 72.1307 9.19219 63.0734C3.06406 54.0161 0 45.6333 0 37.925C0 26.3625 3.71927 17.151 11.1578 10.2906C18.5964 3.43021 27.2104 0 37 0C46.7896 0 55.4036 3.43021 62.8422 10.2906C70.2807 17.151 74 26.3625 74 37.925C74 45.6333 70.9359 54.0161 64.8078 63.0734C58.6797 72.1307 49.4104 81.9396 37 92.5Z"/></svg>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('m',{zoomControl:false,attributionControl:false}).setView([39.7683,67.2792],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  var pinEl = document.querySelector('.pin');
  var inset = 0; // panel egallagan balandlik (px)

  function pinY(){ return Math.max(60, (map.getSize().y - inset) / 2); }
  function place(){ pinEl.style.top = pinY() + 'px'; }
  function send(){
    var c = map.containerPointToLatLng([map.getSize().x/2, pinY()]);
    window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng}));
  }

  // Berilgan nuqtani PIN OSTIGA olib keladi (xarita markaziga emas).
  window.__setCenter = function(lat,lng){
    var z = map.getZoom();
    var target = map.project([lat,lng], z);
    var half = map.getSize().divideBy(2);
    var pin = L.point(map.getSize().x/2, pinY());
    map.setView(map.unproject(target.add(half.subtract(pin)), z), z, {animate:false});
  };

  // Panel balandligi o'zgarganda pin ostidagi NUQTA saqlanadi — aks holda
  // panel o'zgargani sayin tanlangan joy o'zicha siljib ketardi.
  window.__setInset = function(px){
    if (px === inset) return;
    var keep = map.containerPointToLatLng([map.getSize().x/2, pinY()]);
    inset = px;
    place();
    window.__setCenter(keep.lat, keep.lng);
    send();
  };

  map.on('moveend', send);
  map.on('resize', place);

  // Foydalanuvchining HAQIQIY joylashuvi — maketdagi to'q sariq nuqta
  // (oq halqa ichida). Pin "tanlangan nuqta", bu esa "men shu yerdaman":
  // xaritani surgandan keyin ham o'z joyini yo'qotib qo'ymaslik uchun.
  var me = null;
  window.__setMe = function(lat,lng){
    if (me) { me.setLatLng([lat,lng]); return; }
    me = L.circleMarker([lat,lng], {
      radius: 8, color: '#FFFFFF', weight: 4,
      fillColor: '${C.pax}', fillOpacity: 1,
    }).addTo(map);
  };

  place();
</script></body></html>`;
}

/**
 * Buyurtma berishda "qayerdan olib ketamiz" nuqtasini tanlash — xarita
 * suriladi, pin joyida qoladi. Faqat pickup uchun (borish joyi
 * tanlanmaydi — mahsulot qarori: `CUSTOMER-APP-PLAN.md` §2.4).
 */
export function PickupPicker({
  center,
  moveToken,
  myLocation,
  bottomInset,
  onChange,
}: {
  center: { lat: number; lng: number };
  /**
   * Xaritani `center` ga MAJBURAN ko'chirish signali — har oshganda
   * bir marta `setView` chaqiriladi.
   *
   * NEGA COUNTER, masofa solishtiruvi EMAS: `moveend` xaritaning o'z
   * harakatida ham, dasturiy `setView` da ham bir xil ishlaydi, ya'ni
   * `center` prop ikkala holatda ham yangilanadi. Avval ularni masofa
   * bilan farqlardik (`d < 0.0001` bo'lsa "o'zi ko'chdi" deb) — lekin
   * foydalanuvchi tanlagan nuqta hozirgi markazga yaqin bo'lsa, bu
   * heuristika "o'zi ko'chdi" deb xato o'ylab, xaritani JOYIDA qoldirardi.
   * Aynan shu sabab "Uy"/"Ish" bosilgandan keyin GPS tugmasi ishlamay
   * qolgan edi. Counter aniq signal: uni faqat RN tomoni oshiradi,
   * `moveend` hech qachon oshirmaydi — cheksiz halqa ham bo'lmaydi.
   */
  moveToken: number;
  /** Foydalanuvchining haqiqiy joylashuvi — ko'k doira (tanlangan nuqta emas). */
  myLocation: { lat: number; lng: number } | null;
  /** Pastki panel egallagan balandlik (dp) — pin shuning ustida turadi. */
  bottomInset: number;
  onChange: (p: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<WebView>(null);
  const alive = useRef(false);
  const html = useMemo(buildPickerHtml, []);
  // `center` ni ref'da saqlaymiz: ko'chirish effekti FAQAT `moveToken` ga
  // bog'liq bo'lsin (aks holda har `moveend` dan keyin qayta ishga tushardi).
  const latest = useRef(center);
  latest.current = center;

  useEffect(() => {
    return () => {
      alive.current = false;
    };
  }, []);

  const applyCenter = useCallback(() => {
    if (!alive.current) return;
    const { lat, lng } = latest.current;
    ref.current?.injectJavaScript(
      `window.__setCenter && window.__setCenter(${lat}, ${lng}); true;`,
    );
  }, []);

  useEffect(() => {
    applyCenter();
  }, [moveToken, applyCenter]);

  useEffect(() => {
    if (!alive.current) return;
    ref.current?.injectJavaScript(
      `window.__setInset && window.__setInset(${Math.round(bottomInset)}); true;`,
    );
  }, [bottomInset]);

  // Ko'k doira — GPS nuqtasi o'zgarganda yangilanadi.
  useEffect(() => {
    if (!alive.current || !myLocation) return;
    ref.current?.injectJavaScript(
      `window.__setMe && window.__setMe(${myLocation.lat}, ${myLocation.lng}); true;`,
    );
  }, [myLocation]);

  return (
    <WebView
      ref={ref}
      source={{ html }}
      style={{ flex: 1, backgroundColor: C.mapBg }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      onLoadEnd={() => {
        alive.current = true;
        // Tartib MUHIM: avval panel balandligi, keyin markaz — aks holda
        // xarita bir marta noto'g'ri joyga o'rnatilib, ko'zga tashlanardi.
        ref.current?.injectJavaScript(
          `window.__setInset && window.__setInset(${Math.round(bottomInset)}); true;`,
        );
        applyCenter();
        if (myLocation) {
          ref.current?.injectJavaScript(
            `window.__setMe && window.__setMe(${myLocation.lat}, ${myLocation.lng}); true;`,
          );
        }
      }}
      onMessage={(e) => {
        try {
          const p = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number };
          if (typeof p.lat === 'number' && typeof p.lng === 'number') onChange(p);
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

/**
 * Kuzatuv xaritasi — mijoz va haydovchi nuqtalari, to'liq ekran bo'ylab.
 *
 * NEGA WebView O'ZIGA YOZADI (ota-komponentda `ref` emas): avval nuqtalar
 * o'zgarganda YECHIB OLINGAN WebView'ga ham `injectJavaScript` yozilardi.
 * `ref.current` hali null bo'lmasligi mumkin, native ko'rinish esa allaqachon
 * yo'q qilingan — native tomon null obyektga murojaat qilib ilovani YIQITARDI:
 *
 *   JNI DETECTED ERROR IN APPLICATION: obj == null
 *   in call to CallVoidMethodV ... (tid mqt_native_modu)
 *
 * Endi inject faqat (a) yuklanib bo'lgan, (b) hali ekranda turgan WebView'ga
 * boradi — yechib olinganda bayroq DARHOL o'chadi.
 */
export function LiveMap({
  markers,
  bottomInset = 0,
  line = true,
}: {
  markers: MapMarker[];
  /** Pastki panel balandligi — nuqtalar shuning ustiga sig'diriladi. */
  bottomInset?: number;
  line?: boolean;
}) {
  const ref = useRef<WebView>(null);
  const alive = useRef(false);
  const html = useMemo(() => buildHtml(line), [line]);
  // Effekt har render qayta ishlamasligi uchun nuqtalar solishtiriladigan kalit.
  const markersJson = JSON.stringify(markers);

  useEffect(() => {
    return () => {
      alive.current = false; // yechib olindi — endi inject qilmaymiz
    };
  }, []);

  const push = useCallback((json: string, inset: number) => {
    if (!alive.current) return;
    ref.current?.injectJavaScript(
      `window.__setInset && window.__setInset(${Math.round(inset)});` +
        `window.__setMarkers && window.__setMarkers(${json}); true;`,
    );
  }, []);

  useEffect(() => {
    push(markersJson, bottomInset);
  }, [markersJson, bottomInset, push]);

  return (
    <View style={{ flex: 1, backgroundColor: C.mapBg }}>
      <WebView
        ref={ref}
        source={{ html }}
        style={{ flex: 1, backgroundColor: C.mapBg }}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        // Sahifa bo'sh yuklanadi — joriy nuqtalarni yuklanish tugagach beramiz.
        onLoadEnd={() => {
          alive.current = true;
          push(markersJson, bottomInset);
        }}
      />
    </View>
  );
}
