# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat sanasi:** 2026-07-28 · **Branch:** `main` · **Repo:** `/home/javlon/Documents/GitHub/taxy-project`
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

---

## 2. ⚠️ HAL QILINMAGAN MUAMMO — asosiy ish shu

**Haydovchi ilovasida "Ishni boshlash" bosilganda "Ulanmoqda…" holatida qotib qoladi.**
Haydovchi onlayn bo'lmaydi → botdan berilgan zakaz `NO_DRIVER` bo'ladi.

### Chiqarib tashlangan sabablar (tekshirilgan)

| Tekshiruv | Natija | Qanday |
|---|---|---|
| Server socket | ✅ Ishlaydi | Node klient bilan prod'ga ulandim (ilova bilan bir xil sozlama): `CONNECT ✅ transport=websocket`, `driver:online → {"ok":true}`, 75s uzilmadi |
| CORS mobil ilovani bloklaydimi | ✅ Yo'q | `Origin`siz handshake → 200; yomon origin → 400 |
| Token | ✅ Yaroqli | Bugun 11:58 da ilovadan `POST /drivers/location` → **201** (okhttp) |
| Hisob holati | ✅ `approved`, bloklanmagan | DB |
| API URL | ✅ To'g'ri | HTTP va socket bir xil `API_URL` (`src/config.ts`) |

### Asosiy dalil

Haydovchi `+998990051630` ning `last_seen_at` — **7+ soat oldin**. `goOnline` muvaffaqiyatli
bo'lganda bu maydon yangilanadi ⇒ **urinishlar serverga umuman yetib bormayapti**.

### Nega sabab topilmadi

1. **Ilova xatoni ko'rsatmasdi** — `connect_error` handleri umuman yo'q edi; `driver:online`
   ack'i `{ok:false}` bo'lsa ham jimgina yutilardi. **Tuzatildi** (`ccc9e38`) — lekin
   samarasini ko'rish uchun yangi APK kerak.
2. **Railway log API'si 2026-07-28 kuni ishlamadi** — `railway logs` har safar
   `operation timed out`. Server tomondan kuzatib bo'lmadi.

### Keyingi qadam (aniq tartib)

1. Build **`0a0a2522`** holatini tekshiring (2026-07-28 ~19:58 da boshlangan, EAS navbatida edi):
   ```bash
   cd apps/driver-app
   npx eas-cli@latest build:view 0a0a2522-6d0f-4140-884e-efd0a7c12055
   ```
   Tugagan bo'lsa `Application Archive URL` dan APK'ni oling.
2. O'rnating → "Ishni boshlash" → status ostida **qizil xato matni** chiqadi.
3. O'sha matnga qarab:

| Xato matni | Ma'nosi |
|---|---|
| `timeout`, `xhr poll error`, `websocket error` | tarmoq / proksi |
| `jwt expired`, `Token yaroqsiz` | qayta login kerak |
| `Hisob bloklangan` | hisob holati |
| `Sessiya tayyor emas` | serverdagi race (tuzatilgan bo'lishi kerak) |

4. Server tomondan (loglar tiklansa):
   ```bash
   railway logs --service api | grep -E "Haydovchi ulandi|socketi uzildi|rad etildi"
   ```
   (`ab22aa8` da qo'shilgan, ishlashi test ulanish bilan tasdiqlangan.)

---

## 3. Production holati

| Servis | URL / holat |
|---|---|
| **api** | https://api-production-13444.up.railway.app · `/health` ok · eng so'nggi kod |
| **admin** | https://admin-production-42e5.up.railway.app · uz/ru i18n + metrikalar |
| **bot** | `@toy_taxy_bot` · polling · barqaror |
| Postgres + Redis | Railway plugin · migratsiya 7 qo'llangan |

Deploy: `railway up --service api|admin|bot --ci` (repo rootdan).
**GitHub'ga ulanmagan** — merge deploy qilmaydi, qo'lda ishga tushiriladi.

**Muhim env (o'rnatilgan):**
- `CORS_ORIGINS=https://admin-production-42e5.up.railway.app` — prod'da **majburiy**,
  bo'lmasa API ishga tushmaydi (ataylab).
- `RAILWAY_CONFIG_PATH=apps/api/railway.json` — busiz `railway.json` o'qilmaydi.
- `NOMINATIM_URL` / `OSRM_URL` — **bo'sh** (xarita xizmatlari o'chiq).

---

## 4. Bu sessiyada bajarilgan ish

```
ccc9e38 fix(driver-app): ulanish xatosi ko'rinadigan bo'ldi
ab22aa8 feat(api): haydovchi socket ulanishi/uzilishini loglash
b20df18 feat(bot): manzil va izoh so'ralmaydi — oqim qisqartirildi
32755dc fix(driver-app): socket faqat WebSocket'ga bog'lanmasin (zaxira polling)
58507da fix(bot): 409 Conflict'da crash-loop o'rniga qayta urinish
37ca03c fix(bot): manzil qidiruvida mijoz variantni tanlaydi (#2)
b0fd7c9 feat: ishonchlilik, xavfsizlik, ko'p instansiya va testlar (#1)
```

**Kritik tuzatishlar (PR #1):**
- `trips.complete()` — komissiya status o'tishidan KEYIN va bitta tranzaksiyada
  (avval o'tish natijasi tekshirilmasdi → bekor qilingan zakazdan pul yechilardi).
- `billing.adjust()` — balans atomik, lost update yo'q.
- Bekor qilishlarga status guard'i.
- `addTrack()` — atomik jsonb, GPS nuqtalari yo'qolmaydi.
- `numeric` transformer — TypeORM `number` qaytaradi.

**Xavfsizlik:** CORS allowlist (HTTP+WS), helmet, bloklangan hisob tokenini rad etish
(Redis kesh + socketni uzish), login rate limit, 403, prod ENV qattiq talablari.

**Masshtab:** Socket.IO Redis adapter · dispatch **egalik modeli**
(`dispatch:owner:<orderId>`, `SET NX` + TTL 90s; javob pub/sub orqali egasiga) ·
bot sessiyasi Redis'da. **Bot polling sababli 1 instansiyada qolishi kerak.**

**Kuzatuv:** global HTTP exception filter · **WS uchun interceptor** (filter EMAS) ·
pino redact + `x-request-id` · terminus health · Swagger `/docs` · `GET /ops/metrics`.

**Sifat:** ESLint qo'shildi · **99 unit test** (api 57, bot 25, admin 17) — avval 0 ta ·
CI `integration` job'i (haqiqiy Postgres+Redis bilan simlar) ·
**CI 2026-07-25 dan beri hech qachon o'tmagan edi** (pnpm versiya ziddiyati) — tuzatildi.

**Bot oqimi qisqartirildi:** toifa → lokatsiya → tasdiq (manzil va izoh so'ralmaydi).

---

## 5. Qolgan ishlar

1. **⚠️ "Ulanmoqda" muammosi** (2-bo'lim) — asosiy.
2. **FCM kalitini Expo'ga yuklash** — busiz push yetkazilmaydi:
   `cd apps/driver-app && eas credentials --platform android` → Push Notifications → FCM V1
   → `~/Downloads/toy-taxi-firebase-adminsdk-*.json`.
   (`google-services.json` joyida va to'g'ri — APK ichida tekshirilgan.)
3. **Haydovchilar qo'shish** — hozir 1 ta approved haydovchi (OFFLINE).
   Botdan zakaz ishlashi uchun **kamida bitta ONLINE haydovchi shart**.
   (`+998900000098` va `+998900000099` — diagnostika uchun yaratilgan, bloklangan.)
4. **Xarita xizmatlari** (ixtiyoriy) — `NOMINATIM_URL`/`OSRM_URL`. API'dagi `/geo/*`
   endpointlari tayyor va testlangan, lekin **hozir hech kim chaqirmaydi** (bot oqimidan
   manzil olib tashlangan). Kerak bo'lmasa o'chirsa bo'ladi.
5. **Railway healthcheck** — `RAILWAY_CONFIG_PATH` qo'yildi, keyingi deployda faollashishi
   kerak; tekshirilmagan.
6. **In-app xarita** (react-native-maps) — driver-app TODO.

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
- **Simlarni ketma-ket haydashda `LOGIN_RATE_LIMIT=1000`** kerak (prod limiti 5/daq →
  5-simdan keyin 429).
- **Har sim oldidan DB tozalash** (FIXED telefon raqamlar):
  `TRUNCATE orders, order_events, drivers, vehicles, customers, trip_tracks, sos_events,
  transactions, ratings RESTART IDENTITY CASCADE;` + `redis-cli FLUSHALL`
- **`sim:bot` `apps/bot/dist` dan import qiladi** — oldin `pnpm --filter @tty/bot build`.
- **`sim:sprint3`** API'ni `DISPATCH_WINDOW_SIZE=1` bilan talab qiladi.
- **`sim:cluster`** ikkita instansiya: `API_PORT=3000` va `API_PORT=3001`.
- **TypeORM:** `manager.query()` UPDATE uchun `[rows, affected]`, SELECT uchun `rows`.
- **Botni `getUpdates` bilan TEKSHIRMANG** — polling slotini o'g'irlab botni yiqitadi.
- **Bot deploy'da bitta 409 NORMAL** — `launchWithRetry` uni o'tkazadi.

**Simlar:** `sim:dispatch sim:trip sim:sprint3 sim:bot sim:race sim:security sim:cluster`

---

## 7. Arxitektura qarorlari (nega aynan shunday)

- **Dispatch egaligi, BullMQ emas** — dispatch mahsulotning yuragi va sim'lar bilan
  qoplangan; egalik modeli o'sha mantiqni o'zgartirmasdan ko'p instansiya to'g'riligini
  beradi, to'liq qayta yozishdan ancha kam xavf bilan.
- **WS uchun interceptor, filter emas** — Nest `filter.func()` natijasini ishlatmaydi,
  ya'ni exception filter orqali Socket.IO ack qaytarib bo'lmaydi.
- **CORS adapter darajasida** — `@WebSocketGateway({cors})` dekoratori env o'qiy olmaydi
  (u modul yuklanganda hisoblanadi).
- **Prod ENV qattiq talablari** — xavfsizlik sozlamasi unutilganda servis jimgina zaif
  holatda ishlamasin, balki darhol tushunarli xato bilan to'xtasin.
- **`handleConnection` da `driverId` I/O'DAN OLDIN o'rnatiladi** — Socket.IO `connect` ni
  transport ulanishi bilanoq beradi, mijoz `driver:online` ni await'lar tugashidan oldin
  yuborishi mumkin (prod'da bir marta "Empty criteria" xatosini bergan).
- **`makeT` har til uchun bitta funksiya keshlaydi** — avval har renderda yangi funksiya
  qaytarib, `useCallback`/`useEffect` bog'liqligida cheksiz render tsikliga sabab bo'lgan.
