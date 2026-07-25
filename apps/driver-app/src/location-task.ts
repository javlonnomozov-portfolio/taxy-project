import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_URL } from './config';
import { storage } from './storage';

export const BG_LOCATION_TASK = 'tty-bg-location';

interface BgData {
  locations: Location.LocationObject[];
}

// Fon rejimida joylashuvni HTTP orqali serverga yuboradi (socket ochiq bo'lmaganda).
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const loc = (data as BgData).locations?.[0];
  if (!loc) return;
  const token = await storage.getToken();
  if (!token) return;
  try {
    await fetch(API_URL + '/drivers/location', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
    });
  } catch {
    /* keyingi yangilanishda qayta urinadi */
  }
});

export async function startBackgroundLocation(): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return; // fon ruxsati yo'q — foreground socket bilan ishlaydi
  const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
  if (already) return;
  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 8000,
    distanceInterval: 25,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Toy TaxY — ishdasiz',
      notificationBody: 'Buyurtmalarni olish uchun joylashuv yoqilgan',
      notificationColor: '#4c8dff',
    },
  });
}

export async function stopBackgroundLocation(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
}
