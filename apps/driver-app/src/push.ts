import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

/** Admin chat xabari push'i shu belgi bilan keladi (`ChatService.publish`). */
const isChat = (data: unknown) => (data as { type?: string } | null)?.type === 'chat';

// Ilova OCHIQ bo'lganda kelgan bildirishnomalar shu yerdan o'tadi.
//
// Chat xabari ilova ochiq paytda KO'RSATILMAYDI (foydalanuvchi qarori): u
// allaqachon soket orqali yetib kelgan va tepadagi "Chat" nishonida turibdi.
// Ilova yopiq/fonda bo'lsa bu handler chaqirilmaydi — tizim o'zi ko'rsatadi.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const chat = isChat(n.request.content.data);
    return {
      shouldShowAlert: !chat,
      shouldPlaySound: !chat,
      shouldSetBadge: false,
    };
  },
});

/**
 * Chiqib turgan chat bildirishnomalarini o'chirish — haydovchi xabarni
 * ko'rgach (chat ochilganda) ular shtorkada osilib qolmasin. Buyurtma
 * bildirishnomalariga tegilmaydi.
 */
export async function dismissChatNotifications(): Promise<void> {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => isChat(n.request.content.data))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Chat bildirishnomasi bosilganda chaqiriladi (ilova fonda bo'lsa).
 * Obunani bekor qiluvchi funksiya qaytaradi.
 */
export function onChatNotificationTap(cb: () => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    if (isChat(r.notification.request.content.data)) cb();
  });
  return () => sub.remove();
}

/**
 * Ilova butunlay YOPIQ bo'lib, chat bildirishnomasini bosib ochilganmi.
 * Bu holatda tinglovchi hali ulanmagan bo'ladi — shuning uchun alohida.
 */
export async function openedFromChatNotification(): Promise<boolean> {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    return !!last && isChat(last.notification.request.content.data);
  } catch {
    return false;
  }
}

// Taklif kelganda mahalliy bildirishnoma — ovoz + vibratsiya bilan.
// Ilova fonda (lekin jarayon tirik) bo'lganda ham haydovchi diqqatini tortadi.
export async function notifyOffer(distanceKm: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚕 Yangi buyurtma!',
        body: `${distanceKm} km uzoqlikda — qabul qiling`,
        sound: 'default',
        vibrate: [0, 250, 250, 250],
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // darhol
    });
  } catch {
    /* ignore */
  }
}

// Expo push tokenini olish (dev-build kerak; Expo Go SDK 51'da cheklangan).
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Buyurtmalar',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    // EAS projectId sozlanmagan / Expo Go — push'siz davom etamiz.
    return null;
  }
}
