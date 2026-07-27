import { WebView } from 'react-native-webview';
import { View } from 'react-native';

export interface MapMarker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

// Ichki xarita — WebView + Leaflet/OSM (Google Maps API key kerak emas).
// markers[0] odatda pickup/mijoz, markers[1] haydovchi yoki manzil bo'ladi.
export function MiniMap({
  markers,
  height = 200,
  line = true,
}: {
  markers: MapMarker[];
  height?: number;
  line?: boolean;
}) {
  const center = markers[0] ?? { lat: 39.7683, lng: 67.2792 };
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:#0f1420}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('m',{zoomControl:true,attributionControl:false}).setView([${center.lat},${center.lng}],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var ms = ${JSON.stringify(markers)};
  var pts = [];
  ms.forEach(function(m){
    var mk = L.circleMarker([m.lat,m.lng],{color:'#fff',fillColor:m.color,fillOpacity:1,radius:9,weight:2}).addTo(map);
    if(m.label){ mk.bindTooltip(m.label,{permanent:true,direction:'top',offset:[0,-8]}); }
    pts.push([m.lat,m.lng]);
  });
  ${line ? `if(ms.length>=2){ L.polyline([[ms[0].lat,ms[0].lng],[ms[1].lat,ms[1].lng]],{color:'#4c8dff',dashArray:'6',weight:3}).addTo(map); }` : ''}
  if(pts.length>1){ map.fitBounds(pts,{padding:[40,40],maxZoom:16}); }
</script></body></html>`;
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#0f1420' }}
        scrollEnabled={false}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
