# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat:** 2026-07-28 kech · **Branch:** `main` (toza) · **Repo:** `/home/javlon/Documents/GitHub/taxy-project`
>
> Bu faylni yangi chatga tashlang va "davom et" deng.

---

## 1. Loyiha nima

Mahalliy taksilar uchun buyurtma platformasi. Mijoz **Telegram bot** orqali taksi chaqiradi
→ eng yaqin haydovchilarga (**Expo/React Native ilova**) siljuvchi oyna bilan taklif boradi
→ birinchi "Qabul" yutadi. Operator **veb-panel**dan kuzatadi.

**Stack:** pnpm monorepo · NestJS + Socket.IO + PostgreSQL + Redis · Telegraf bot ·
React/Vite admin · Expo driver-app · Railway deploy.

**Paketlar:** `apps/api`, `apps/bot`, `apps/admin`, `apps/driver-app` (workspace'dan
chiqarilgan — o'z `node_modules`, npm, EAS bilan quriladi), `packages/shared`.
Driver-app: owner `javl9n`, package `uz.toytaxy.driver`,
EAS projectId `486e16a1-b012-4256-b121-0ebbfc386cbd`.

**Bot oqimi (qisqartirilgan):** toifa → lokatsiya → tasdiq. Manzil va izoh **so'ralmaydi**.

---

## 2. 🔴 KUTILAYOTGAN TASDIQ — birinchi ish shu

Haydovchi ilovasidagi **"Ulanmoqda…"** muammosining sababi **topildi va tuzatildi**,
lekin **foydalanuvchi hali yangi APK'ni sinab ko'rmadi**.

### Sabab (aniqlangan)

Ilovada `transports: ['websocket', 'polling']` yozilgan edi. Socket.IO transportlarni
**aynan shu tartibda** sinaydi ⇒ avval WebSocket urinilardi. Foydalanuvchi tarmog'ida WS
upgrade bloklangan ⇒ ulanish yiqilardi va ilova jimgina "Ulanmoqda…" da qotardi.

Sabab faqat ilovaga `connect_error` ko'rsatish qo'shilgandan keyin ko'rindi — ekranda
**`websocket error`** chiqdi (foydalanuvchi skrinshot yubordi).

### Tuzatish (`aec3e5f`)

```ts
transports: ['polling', 'websocket']   // polling BIRINCHI
```

Ulanish oddiy HTTP (polling) orqali o'rnatiladi, so'ng imkon bo'lsa WS'ga ko'tariladi;
ko'tarilmasa polling'da ishlayveradi.

**Prod'ga qarshi isbotlangan** (WS butunlay bloklangan holat taqlid qilingan):
```
transports:['polling'], upgrade:false  →  CONNECT ✅ transport=polling
driver:online → {"ok":true}
```

### Yangi APK (sinash kerak)

```
https://expo.dev/artifacts/eas/evjf3kHqrTWit8oNB7Lin--mhsCawLj3jC-YmX5Qoh0.apk
```
Build `59de1d79` · commit `aec3e5ff` · ichi tekshirilgan
(polling ✅ websocket ✅ connect_error ✅ Kabinet ✅ Firebase ✅).

### Sinov tartibi

1. APK o'rnatilsin → **"Ishni boshlash"** → yashil **"Onlayn"** bo'lishi kerak
   (qizil `websocket error` yo'qolishi kerak).
2. Telegram: `@toy_taxy_bot` → `/start` → 🚕 Taksi chaqirish → toifa → lokatsiya → tasdiq
3. Ilovada taklif chiqadi → "Qabul"
4. Safar bosqichlari: yetib keldim → boshladim → yakunladim

**Agar hali ham ishlamasa:** ilova endi xatoni ekranda ko'rsatadi — o'sha matnni oling.
Server tomondan ham:
```bash
railway logs --service api | grep -E "Haydovchi ulandi|socketi uzildi|rad etildi"
```
(Eslatma: 2026-07-28 kuni Railway log API'si uzoq vaqt `operation timed out` berdi.
Ishlamasa, DB'dan `drivers.last_seen_at` ni tekshiring — `goOnline` muvaffaqiyatli
bo'lsa u yangilanadi.)

---

## 3. Production holati

| Servis | URL / holat |
|---|---|
| **api** | https://api-production-13444.up.railway.app · `/health` ok · eng so'nggi kod |
| **admin** | https://admin-production-42e5.up.railway.app · uz/ru i18n + metrikalar |
| **bot** | `@toy_taxy_bot` · polling · barqaror · qisqartirilgan oqim bilan |
| Postgres + Redis | Railway plugin · migratsiya 7 qo'llangan |

Deploy: `railway up --service api|admin|bot --ci` (repo rootdan).
**GitHub'ga ulanmagan** — merge deploy qilmaydi, qo'lda ishga tushiriladi.

**Muhim env (o'rnatilgan):**
- `CORS_ORIGINS=https://admin-production-42e5.up.railway.app` — prod'da **majburiy**,
  bo'lmasa API ishga tushmaydi (ataylab shunday).
- `RAILWAY_CONFIG_PATH=apps/api/railway.json`
- `NOMINATIM_URL` / `OSRM_URL` — **bo'sh** (xarita xizmatlari o'chiq).

---

## 4. Qolgan ishlar

1. **🔴 Yangi APK bilan sinov** (2-bo'lim) — birinchi navbatda.
2. **FCM kaliti Expo'ga yuklanishi** — jarayon boshlangan edi, tugadimi noma'lum.
   ```bash
   cd apps/driver-app && eas credentials --platform android
   ```
   Ketma-ketlik: `preview` → `Push Notifications: Manage your FCM V1 service account key`
   → `Set up a Google Service Account Key` → fayl:
   `~/Downloads/toy-taxi-firebase-adminsdk-fbsvc-fb514f8e04.json`
   (EAS faqat loyiha papkasidagi `.json` larni ko'rsatsa — faylni `apps/driver-app/` ga
   ko'chiring, u `.gitignore` da; ishlatib bo'lgach o'chiring.)
   **Rebuild kerak emas** — kalit Expo serverida turadi. Push faqat ilova yopiq
   bo'lganda kerak; ochiq turganda takliflar socket orqali keladi.
3. **Haydovchilar qo'shish** — hozir 1 ta approved haydovchi (`+998990051630`, OFFLINE).
   Botdan zakaz ishlashi uchun **kamida bitta ONLINE haydovchi shart** —
   aks holda zakaz darhol `NO_DRIVER` bo'ladi.
   (`+998900000097/98/99` — diagnostika uchun yaratilgan, **bloklangan**, o'chirsa bo'ladi.)
4. **Xarita xizmatlari** (ixtiyoriy) — API'dagi `/geo/*` endpointlari tayyor va
   testlangan, lekin **hozir hech kim chaqirmaydi** (bot oqimidan manzil olib tashlangan).
   Kerak bo'lmasa o'chirsa bo'ladi.
5. **Railway healthcheck** — `RAILWAY_CONFIG_PATH` qo'yildi, faollashgani tekshirilmagan.
6. **In-app xarita** (react-native-maps) — driver-app TODO.

---

## 5. Bu sessiyada bajarilgan ish

```
aec3e5f fix(driver-app): transport tartibi — polling BIRINCHI (websocket error tuzatildi)
e957df4 docs: HANDOFF.md ni joriy holatga yangilash
ccc9e38 fix(driver-app): ulanish xatosi ko'rinadigan bo'ldi
ab22aa8 feat(api): haydovchi socket ulanishi/uzilishini loglash
b20df18 feat(bot): manzil va izoh so'ralmaydi — oqim qisqartirildi
32755dc fix(driver-app): socket faqat WebSocket'ga bog'lanmasin (zaxira polling)
58507da fix(bot): 409 Conflict'da crash-loop o'rniga qayta urinish
37ca03c fix(bot): manzil qidiruvida mijoz variantni tanlaydi (#2)
b0fd7c9 feat: ishonchlilik, xavfsizlik, ko'p instansiya va testlar (#1)
```

**Kritik pul/poyga tuzatishlari (PR #1):**
- `trips.complete()` — komissiya status o'tishidan KEYIN va bitta tranzaksiyada
  (avval o'tish natijasi tekshirilmasdi → bekor qilingan zakazdan pul yechilardi).
- `billing.adjust()` — balans atomik, lost update yo'q.
- Bekor qilishlarga status guard'i. `addTrack()` atomik jsonb.
- `numeric` transformer — TypeORM `number` qaytaradi (string emas).

**Xavfsizlik:** CORS allowlist (HTTP+WS) · helmet · bloklangan hisob tokenini rad etish
(Redis kesh + socketni uzish) · login rate limit · 403 · prod ENV qattiq talablari.

**Masshtab:** Socket.IO Redis adapter · dispatch **egalik modeli**
(`dispatch:owner:<orderId>`, `SET NX` + TTL 90s; javob pub/sub orqali egasiga) ·
bot sessiyasi Redis'da. **Bot polling sababli 1 instansiyada qolishi kerak.**

**Kuzatuv:** global HTTP exception filter · **WS uchun interceptor** (filter EMAS) ·
pino redact + `x-request-id` · terminus health · Swagger `/docs` · `GET /ops/metrics` ·
socket ulanish/uzilish loglari.

**Sifat:** ESLint qo'shildi · **99 unit test** (api 57, bot 25, admin 17) — avval 0 ta ·
CI `integration` job'i (haqiqiy Postgres+Redis bilan simlar) ·
**CI 2026-07-25 dan beri hech qachon o'tmagan edi** (pnpm versiya ziddiyati) — tuzatildi.

---

## 6. Lokal ishga tushirish va tuzoqlar

```bash
pnpm db:up                                   # postgres:5434 + redis:6379
set -a; . ./.env; set +a
export ADMIN_LOGIN=admin ADMIN_PASSWORD=admin123 LOGIN_RATE_LIMIT=1000
pnpm --filter @tty/api migration:run
pnpm --filter @tty/shared build && pnpm --filter @tty/api build
node apps/api/dist/main.js
```

**Tuzoqlar (qimmatga tushgan):**
- `ConfigModule` `.env` ni **O'QIMAYDI** — env'ni qo'lda export qilish shart.
- **Simlarni ketma-ket haydashda `LOGIN_RATE_LIMIT=1000`** kerak (prod limiti 5/daq).
- **Har sim oldidan DB tozalash** (FIXED telefon raqamlar):
  `TRUNCATE orders, order_events, drivers, vehicles, customers, trip_tracks, sos_events,
  transactions, ratings RESTART IDENTITY CASCADE;` + `redis-cli FLUSHALL`
- **`sim:bot` `apps/bot/dist` dan import qiladi** — oldin `pnpm --filter @tty/bot build`.
- **`sim:sprint3`** API'ni `DISPATCH_WINDOW_SIZE=1` bilan talab qiladi.
- **`sim:cluster`** ikkita instansiya: `API_PORT=3000` va `API_PORT=3001`.
- **TypeORM:** `manager.query()` UPDATE uchun `[rows, affected]`, SELECT uchun `rows`.
- **Botni `getUpdates` bilan TEKSHIRMANG** — polling slotini o'g'irlab botni yiqitadi.
- **Bot deploy'da bitta 409 NORMAL** — `launchWithRetry` uni o'tkazadi.
- **APK ichini tekshirishda** bundle Hermes bayt-kodida — `strings -a -n 4` ishlating,
  `grep -x` EMAS (aniq qator mosligi noto'g'ri natija beradi).

**Simlar:** `sim:dispatch sim:trip sim:sprint3 sim:bot sim:race sim:security sim:cluster`

---

## 7. Arxitektura qarorlari (nega aynan shunday)

- **Dispatch egaligi, BullMQ emas** — dispatch mahsulotning yuragi va sim'lar bilan
  qoplangan; egalik modeli o'sha mantiqni o'zgartirmasdan ko'p instansiya to'g'riligini
  beradi, to'liq qayta yozishdan ancha kam xavf bilan.
- **WS uchun interceptor, filter emas** — Nest `filter.func()` natijasini ishlatmaydi,
  ya'ni exception filter orqali Socket.IO ack qaytarib bo'lmaydi.
- **CORS adapter darajasida** — `@WebSocketGateway({cors})` dekoratori env o'qiy olmaydi.
- **Prod ENV qattiq talablari** — xavfsizlik sozlamasi unutilganda servis jimgina zaif
  holatda ishlamasin, darhol tushunarli xato bilan to'xtasin.
- **`handleConnection` da `driverId` I/O'DAN OLDIN o'rnatiladi** — Socket.IO `connect` ni
  transport ulanishi bilanoq beradi, mijoz `driver:online` ni await'lar tugashidan oldin
  yuborishi mumkin (prod'da "Empty criteria" xatosini bergan).
- **`makeT` har til uchun bitta funksiya keshlaydi** — avval har renderda yangi funksiya
  qaytarib, `useCallback`/`useEffect` bog'liqligida cheksiz render tsikliga sabab bo'lgan.

---

## 8. Bu sessiyaning saboqlari

- **Jimgina yutilgan xatolar eng qimmatga tushdi.** `connect_error` handleri yo'qligi
  sababli oddiy transport tartibi xatosini topish yarim kun oldi. Xato ko'rsatish
  qo'shilishi bilan javob bir zumda ma'lum bo'ldi.
- **Izohga ishonmang, kodni tekshiring.** `32755dc` dagi izod "polling bilan ulanib,
  WS'ga ko'tariladi" degan edi, lekin massiv tartibi bunga teskari edi.
- **Diagnostika tizimni buzmasligi kerak.** Botni `getUpdates` bilan tekshirish uni
  yiqitdi.
