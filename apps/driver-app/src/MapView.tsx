import {
  forwardRef,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WebView } from 'react-native-webview';
import { Modal, Platform, StatusBar, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { C, R, SP } from './theme';
import { Lang, makeT } from './i18n';

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
  // Leaflet'ning o'z +/- boshqaruvi O'CHIRILGAN: u brauzer uslubida chiqadi va
  // dizaynga mos kelmaydi. O'rniga RN tomonda ZoomControl chiziladi va
  // window.__zoom orqali shu xaritaga buyruq beradi.
  var map = L.map('m',{zoomControl:false,attributionControl:false}).setView([39.7683,67.2792],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var LINE = ${line ? 'true' : 'false'};
  var framed = false;
  window.__zoom = function(d){ if(d > 0){ map.zoomIn(); } else { map.zoomOut(); } };
  window.__setMarkers = function(ms){
    layer.clearLayers();
    var pts = [];
    ms.forEach(function(m){
      var mk = L.circleMarker([m.lat,m.lng],{color:'#fff',fillColor:m.color,fillOpacity:1,radius:9,weight:2}).addTo(layer);
      if(m.label){ mk.bindTooltip(m.label,{permanent:true,direction:'top',offset:[0,-8]}); }
      pts.push([m.lat,m.lng]);
    });
    if(LINE && ms.length>=2){
      L.polyline([[ms[0].lat,ms[0].lng],[ms[1].lat,ms[1].lng]],{color:'${C.accent}',dashArray:'6',weight:3}).addTo(layer);
    }
    // Ko'rinishni FAQAT birinchi marta moslaymiz — aks holda haydovchi
    // xaritani surgan/kattalashtirgan zahoti keyingi GPS yangilanishi uni qaytarib olardi.
    if(!framed && pts.length){
      if(pts.length>1){ map.fitBounds(pts,{padding:[40,40],maxZoom:16}); }
      else { map.setView(pts[0],15); }
      framed = true;
    }
  };
</script></body></html>`;
}

/** Xarita ustidagi yumaloq tugma — kattalashtirish/kichiklashtirish. */
function MapButton({
  icon,
  onPress,
  label,
}: {
  icon: 'fullscreen' | 'fullscreen-exit';
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Haydovchi mashinada bosadi — teginish maydoni ikonkadan kattaroq.
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 40,
        height: 40,
        borderRadius: R.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.chrome,
        borderColor: C.border,
        borderWidth: 1,
        // Android'da WebView ustidagi element `elevation`siz bosilmay qolishi mumkin.
        elevation: 4,
        zIndex: 2,
      }}
    >
      <MaterialIcons name={icon} size={22} color={C.text} />
    </TouchableOpacity>
  );
}

/** WebView ichidagi Leaflet xaritasiga tashqaridan buyruq berish uchun. */
export interface MapHandle {
  zoomIn(): void;
  zoomOut(): void;
}

/**
 * Xarita ustidagi +/- ustuni — Leaflet'ning o'chirilgan `zoomControl`i o'rniga.
 *
 * Fon/ramka `MapButton` bilan bir xil (`C.chrome`), chunki ikkalasi bitta
 * xarita ustida yonma-yon turadi — mijoz ilovasida oq, haydovchinikida to'q.
 */
function ZoomControl({
  onZoomIn,
  onZoomOut,
  t,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  t: (key: string) => string;
}) {
  const cell = (icon: 'add' | 'remove', onPress: () => void, key: string) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(key)}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <MaterialIcons name={icon} size={22} color={C.text} />
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        borderRadius: R.pill,
        overflow: 'hidden',
        backgroundColor: C.chrome,
        borderColor: C.border,
        borderWidth: 1,
        // Android'da WebView ustidagi element `elevation`siz bosilmay qolishi mumkin.
        elevation: 4,
        zIndex: 2,
      }}
    >
      {cell('add', onZoomIn, 'zoom_in')}
      <View style={{ height: 1, marginHorizontal: 8, backgroundColor: C.border }} />
      {cell('remove', onZoomOut, 'zoom_out')}
    </View>
  );
}

/**
 * Bitta WebView — nuqtalarni O'ZI yangilaydi.
 *
 * NEGA ALOHIDA KOMPONENT: avval ota-komponent ikkita `ref` ushlab, nuqtalar
 * o'zgarganda IKKALASIGA ham `injectJavaScript` yozardi — jumladan to'liq
 * ekran ochilganda YECHIB OLINGAN ichki WebView'ga ham. `ref.current` hali
 * null bo'lmasligi mumkin, native ko'rinish esa allaqachon yo'q qilingan;
 * native tomon null obyektga murojaat qilib ilovani YIQITARDI:
 *
 *   JNI DETECTED ERROR IN APPLICATION: obj == null
 *   in call to CallVoidMethodV ... (tid mqt_native_modu)
 *
 * Endi har WebView faqat O'ZIGA yozadi va faqat (a) yuklanib bo'lgan,
 * (b) hali ekranda turgan bo'lsa. Yechib olinganda bayroq DARHOL o'chadi,
 * ya'ni keyin hech qanday inject navbatga qo'yilmaydi.
 */
const MapWebView = forwardRef<
  MapHandle,
  {
    html: string;
    markersJson: string;
    scroll: boolean;
  }
>(function MapWebView({ html, markersJson, scroll }, handle) {
  const ref = useRef<WebView>(null);
  const alive = useRef(false); // ekranda VA yuklanib bo'lganmi

  useEffect(() => {
    return () => {
      alive.current = false; // yechib olindi — endi inject qilmaymiz
    };
  }, []);

  const push = useCallback((json: string) => {
    if (!alive.current) return;
    ref.current?.injectJavaScript(`window.__setMarkers && window.__setMarkers(${json}); true;`);
  }, []);

  // Zoom ham AYNAN o'sha `alive` qo'riqchisidan o'tadi — yechib olingan
  // WebView'ga inject qilish yuqorida tasvirlangan JNI yiqilishini beradi.
  const zoom = useCallback((dir: 1 | -1) => {
    if (!alive.current) return;
    ref.current?.injectJavaScript(`window.__zoom && window.__zoom(${dir}); true;`);
  }, []);

  useImperativeHandle(handle, () => ({ zoomIn: () => zoom(1), zoomOut: () => zoom(-1) }), [zoom]);

  useEffect(() => {
    push(markersJson);
  }, [markersJson, push]);

  return (
    <WebView
      ref={ref}
      source={{ html }}
      style={{ flex: 1, backgroundColor: C.mapBg }}
      scrollEnabled={scroll}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      // Sahifa bo'sh yuklanadi — joriy nuqtalarni yuklanish tugagach beramiz.
      onLoadEnd={() => {
        alive.current = true;
        push(markersJson);
      }}
    />
  );
});

// Ichki xarita — WebView + Leaflet/OSM (Google Maps API key kerak emas).
// markers[0] odatda pickup/mijoz, markers[1] haydovchi yoki manzil bo'ladi.
export function MiniMap({
  markers,
  height = 200,
  line = true,
  lang = 'uz',
  overlay,
}: {
  markers: MapMarker[];
  height?: number;
  line?: boolean;
  lang?: Lang;
  /**
   * To'liq ekranda xarita USTIDA turadigan asosiy amallar
   * ("Qabul qilish", "Yetib keldim" va h.k.).
   *
   * Xarita butun ekranni egallaganda haydovchi safarni boshqara olmay qolardi —
   * tugmalarga yetish uchun har safar kichiklashtirish kerak edi.
   */
  overlay?: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const t = makeT(lang);
  const html = useMemo(() => buildHtml(line), [line]);

  // Effekt har render qayta ishlamasligi uchun nuqtalar solishtiriladigan kalit.
  const key = JSON.stringify(markers);

  // Ichki va to'liq ekran WebView'lari uchun ALOHIDA ref: bir vaqtda faqat
  // bittasi ekranda bo'ladi, zoom buyrug'i o'sha turganiga ketishi kerak.
  const inlineMap = useRef<MapHandle>(null);
  const fullMap = useRef<MapHandle>(null);

  const web = (scroll: boolean, r: RefObject<MapHandle>) => (
    <MapWebView ref={r} html={html} markersJson={key} scroll={scroll} />
  );

  // To'liq ekran ochiq bo'lganda ichki WebView yechib olinadi: arzon Android
  // telefonlarda ikkita Leaflet WebView bir vaqtda ilovani yiqitishi mumkin.
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: C.mapBg }}>
      {!full && web(false, inlineMap)}

      <View style={{ position: 'absolute', top: SP.sm, right: SP.sm }}>
        <MapButton icon="fullscreen" label={t('fullscreen')} onPress={() => setFull(true)} />
      </View>

      <View style={{ position: 'absolute', right: SP.sm, bottom: SP.sm }}>
        <ZoomControl
          t={t}
          onZoomIn={() => inlineMap.current?.zoomIn()}
          onZoomOut={() => inlineMap.current?.zoomOut()}
        />
      </View>

      <Modal
        visible={full}
        animationType="fade"
        // Android'da "orqaga" tugmasi ham to'liq ekrandan chiqaradi.
        onRequestClose={() => setFull(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: C.mapBg }}>
          {full && web(true, fullMap)}
          <View
            style={{
              position: 'absolute',
              right: SP.lg,
              // Android'da SafeAreaView ishlamaydi — status bar balandligi qo'lda.
              top: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 44) + SP.lg,
            }}
          >
            <MapButton
              icon="fullscreen-exit"
              label={t('exit_fullscreen')}
              onPress={() => setFull(false)}
            />
          </View>

          <View
            style={{
              position: 'absolute',
              right: SP.lg,
              top: '50%',
              // Ustun balandligi 83 (40 + 1 ajratkich + 40 + 2 ramka) — markazga tekislash.
              transform: [{ translateY: -41 }],
            }}
          >
            <ZoomControl
              t={t}
              onZoomIn={() => fullMap.current?.zoomIn()}
              onZoomOut={() => fullMap.current?.zoomOut()}
            />
          </View>

          {overlay ? (
            <View
              // `pointerEvents="box-none"` — tugmalar bosiladi, lekin ular
              // orasidagi bo'sh joydan xaritani surish mumkin bo'lib qoladi.
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: SP.lg,
                paddingTop: SP.lg,
                paddingBottom: SP.xxl,
                backgroundColor: C.chrome,
                borderTopLeftRadius: R.xl,
                borderTopRightRadius: R.xl,
                borderTopWidth: 1,
                borderColor: C.border,
                elevation: 8,
              }}
            >
              {overlay}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
