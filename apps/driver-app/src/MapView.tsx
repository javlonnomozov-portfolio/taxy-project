import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:#0f1420}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('m',{zoomControl:true,attributionControl:false}).setView([39.7683,67.2792],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var LINE = ${line ? 'true' : 'false'};
  var framed = false;
  window.__setMarkers = function(ms){
    layer.clearLayers();
    var pts = [];
    ms.forEach(function(m){
      var mk = L.circleMarker([m.lat,m.lng],{color:'#fff',fillColor:m.color,fillOpacity:1,radius:9,weight:2}).addTo(layer);
      if(m.label){ mk.bindTooltip(m.label,{permanent:true,direction:'top',offset:[0,-8]}); }
      pts.push([m.lat,m.lng]);
    });
    if(LINE && ms.length>=2){
      L.polyline([[ms[0].lat,ms[0].lng],[ms[1].lat,ms[1].lng]],{color:'#4c8dff',dashArray:'6',weight:3}).addTo(layer);
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
        backgroundColor: 'rgba(19, 27, 46, 0.92)',
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

// Ichki xarita — WebView + Leaflet/OSM (Google Maps API key kerak emas).
// markers[0] odatda pickup/mijoz, markers[1] haydovchi yoki manzil bo'ladi.
export function MiniMap({
  markers,
  height = 200,
  line = true,
  lang = 'uz',
}: {
  markers: MapMarker[];
  height?: number;
  line?: boolean;
  lang?: Lang;
}) {
  const [full, setFull] = useState(false);
  const t = makeT(lang);
  const html = useMemo(() => buildHtml(line), [line]);

  const smallRef = useRef<WebView>(null);
  const fullRef = useRef<WebView>(null);
  // Effekt har render qayta ishlamasligi uchun nuqtalar solishtiriladigan kalit.
  const key = JSON.stringify(markers);

  const push = useCallback(() => {
    const js = `window.__setMarkers && window.__setMarkers(${key}); true;`;
    smallRef.current?.injectJavaScript(js);
    fullRef.current?.injectJavaScript(js);
  }, [key]);

  useEffect(push, [push]);

  const web = (ref: React.RefObject<WebView>, scroll: boolean) => (
    <WebView
      ref={ref}
      source={{ html }}
      style={{ flex: 1, backgroundColor: '#0f1420' }}
      scrollEnabled={scroll}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      // Yangi WebView (masalan, to'liq ekran oynasi) bo'sh yuklanadi —
      // joriy nuqtalarni yuklanish tugagach beramiz.
      onLoadEnd={push}
    />
  );

  // To'liq ekran ochiq bo'lganda ichki WebView yechib olinadi: arzon Android
  // telefonlarda ikkita Leaflet WebView bir vaqtda ilovani yiqitishi mumkin.
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f1420' }}>
      {!full && web(smallRef, false)}

      <View style={{ position: 'absolute', top: SP.sm, right: SP.sm }}>
        <MapButton icon="fullscreen" label={t('fullscreen')} onPress={() => setFull(true)} />
      </View>

      <Modal
        visible={full}
        animationType="fade"
        // Android'da "orqaga" tugmasi ham to'liq ekrandan chiqaradi.
        onRequestClose={() => setFull(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: '#0f1420' }}>
          {full && web(fullRef, true)}
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
        </View>
      </Modal>
    </View>
  );
}
