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

### 1. Firebase (Android push uchun)
1. https://console.firebase.google.com — yangi loyiha yarating.
2. Android app qo'shing (package: `uz.toytaxy.driver`), `google-services.json` yuklab oling.
3. Uni `apps/driver-app/` ga qo'ying (git'ga qo'shmang — maxfiy).

### 2. EAS sozlash
```bash
cd apps/driver-app
npm i -g eas-cli
eas login
eas init                 # app.json > extra.eas.projectId ni to'ldiradi
eas credentials          # Android → FCM (google-services.json) yuklang
```

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

## Keyingi bosqich (TODO)
- In-app xarita (react-native-maps + OSM)
- Balans/tarix, SOS, reyting ekranlari
