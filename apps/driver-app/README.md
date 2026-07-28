# @tty/driver-app — Haydovchi ilovasi (Expo / React Native)

Toy TaxY haydovchi mobil ilovasi. **Mustaqil Expo loyihasi** (pnpm workspace'dan tashqarida —
o'z `node_modules`). Telefonda **Expo Go** orqali darrov ishga tushadi.

## Imkoniyatlar
- Telefon + parol bilan **kirish** (super-admin bergan temp parol)
- Birinchi kirishda **parolni majburiy almashtirish**
- **Onlayn/oflayn** rejim + fon GPS (davomiy joylashuv yuborish)
- **Taklif** oynasi (masofa, izoh, 20 sek taymer) → qabul/rad
- **Safar** bosqichlari: yetib keldim → boshlash → tugatish
- Jonli **taksometr** (GPS masofasi bo'yicha)
- **Navigatsiya** (Yandex Maps) va mijozga **qo'ng'iroq** tugmalari
- i18n: o'zbek / rus

## Ishga tushirish

```bash
cd apps/driver-app
npm install
npx expo start
```

So'ng telefoningizda **Expo Go** ilovasini o'rnating (App Store / Play Market) va
terminaldagi **QR kodni** skanerlang. Ilova telefoningizda ochiladi.

> API manzili `app.json` > `extra.apiUrl` da (default — Railway production).
> Lokal API bilan sinash uchun uni `http://<kompyuter-IP>:3000` ga o'zgartiring
> (telefon va kompyuter bir Wi-Fi tarmog'ida bo'lsin; `localhost` telefonda ishlamaydi).

## Kirish ma'lumotlari
Super-admin panelda (**admin**) haydovchi qo'shadi → bir martalik parol beriladi →
shu telefon + parol bilan kiring → yangi parol o'rnating.

## Skriptlar
- `npm start` — Expo dev server
- `npm run typecheck` — TypeScript tekshirish

## Push bildirishnoma + fon GPS (dev-build kerak)

**Push** (ilova yopiqda taklif) va **fon rejimida GPS** Expo Go'da to'liq ishlamaydi —
**EAS dev-build** kerak. Kod tayyor; ishga tushirish qadamlari:

### 1. Firebase — BAJARILGAN ✅
Loyiha: **`toy-taxi`** (project number `757214142379`), Android paket
`uz.toytaxy.driver` — `app.json` dagi paket bilan mos.

`google-services.json` `apps/driver-app/` ga qo'yilgan va `.gitignore` da
(repo'ga tushmaydi). `app.json` da `android.googleServicesFile` allaqachon shunga
ishora qiladi, `extra.eas.projectId` ham to'ldirilgan.

### 2. FCM kalitini Expo'ga yuklash — QOLGAN QADAM
Backend bildirishnomani **Expo Push** (`exp.host`) orqali yuboradi, Expo esa uni
FCM'ga uzatadi. Ya'ni FCM server kaliti **Expo tomonida** turishi kerak —
backendda emas (`NotificationsService` da FCM kaliti umuman ishlatilmaydi).

Kerakli fayl: Firebase service account JSON (`toy-taxi-firebase-adminsdk-*.json`).

```bash
cd apps/driver-app
eas credentials --platform android
#   → Build credentials
#   → Push Notifications: Manage your FCM V1 service account key
#   → Set up a Google Service Account Key → faylni ko'rsating
```

> ⚠️ Bu fayl FCM'ga **to'liq server huquqini** beradi. Uni repo'ga qo'shmang
> (`.gitignore` da `*firebase-adminsdk*.json` bor), chat/messenjerda yubormang.
> U faqat Expo credential do'konida saqlanishi kerak. Sizib chiqsa — Firebase
> konsolida kalitni bekor qilib, yangisini yarating.

Tekshirish: `eas credentials --platform android` → FCM V1 bo'limida kalit
ko'rinishi kerak.

### 3. Dev-build (APK) qurish va o'rnatish
```bash
eas build --profile development --platform android
# APK tayyor bo'lgach telefonga o'rnating, so'ng:
npx expo start --dev-client
```
Endi push (Expo Push API orqali) va fon GPS ishlaydi.

> **Ishlashi:** haydovchi onlayn bo'lganda ilova push tokenini backendga yuboradi
> (`/drivers/push-token`). Yangi buyurtma kelganda backend Expo Push orqali bildirishnoma
> yuboradi (ilova yopiq bo'lsa ham). Fon rejimida joylashuv `expo-task-manager` orqali
> `/drivers/location` ga yuboriladi.

## OTA yangilanish (EAS Update)

Faqat **JS/TS** o'zgarganda (ekran, matn, mantiq) to'liq rebuild shart emas —
yangilanish ilovaga bir daqiqada yetadi:

```bash
cd apps/driver-app
eas update --branch preview --message "nima o'zgardi"
```

Haydovchi ilovani qayta ochganda yangi versiyani oladi.

**Qachon baribir REBUILD kerak:**
- yangi native paket qo'shilganda (`expo install <paket>`),
- `app.json` dagi native sozlama o'zgarganda (permissions, plugins, paket nomi),
- ilova versiyasi (`version`) o'zgarganda — `runtimeVersion` siyosati `appVersion`,
  ya'ni OTA faqat **bir xil versiyali** build'larga tushadi.

> Sozlash `eas update:configure` bilan qilingan: `updates.url` va
> `runtimeVersion: {"policy":"appVersion"}` `app.json` da, kanallar `eas.json` da
> (`development` / `preview` / `production`).

## Keyingi bosqich (TODO)
- In-app xarita (react-native-maps + OSM)
