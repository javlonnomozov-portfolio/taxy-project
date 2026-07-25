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

## Keyingi bosqich (TODO)
- In-app xarita (react-native-maps + OSM)
- Fon rejimida location (expo-task-manager) ilova yopiqda ham
- Push (FCM) — ilova yopiqda taklif bildirishnomasi
- Balans/tarix, SOS, reyting ekranlari
