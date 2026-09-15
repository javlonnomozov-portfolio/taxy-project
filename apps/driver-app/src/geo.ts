export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Ikki nuqta orasidagi masofa, metrda.
 *
 * Alohida faylda, chunki uni ekran ham, fon joylashuv vazifasi ham ishlatadi
 * (taksometr ilova yopiq paytda ham sanaladi) — ikki nusxa bir kuni farq qilardi.
 */
export function haversine(a: LatLng, b: LatLng): number {
  const EARTH_R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}
