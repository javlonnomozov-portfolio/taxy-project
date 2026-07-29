# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat:** 2026-07-29 · **Branch:** `main` · **Repo:** `/home/javlon/Documents/GitHub/taxy-project`
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

## 2. 🔴 KUTILAYOTGAN SINOV — birinchi ish shu

### 2a. Ulanish ("Ulanmoqda…") — HAL BO'LDI ✅

Sabab: `transports: ['websocket', 'polling']` — Socket.IO shu tartibda sinaydi, WS
foydalanuvchi tarmog'ida bloklangan edi. Tuzatildi (`aec3e5f`): **polling BIRINCHI**.
Foydalanuvchi APK bilan sinab tasdiqladi — **yashil "Onlayn" ishlayapti**.

### 2b. "Onlayn, lekin taklif kelmaydi" — TUZATILDI, PROD'GA CHIQDI (`40d197f`)

Keyingi muammo: haydovchi Onlayn, botdan zakaz kelyapti, lekin **taklif bormayapti**.

**Sabab.** Dispatch faqat **Redis geo-indeksidan** (`geo:drivers:<toifa>`) qidiradi, DB
`status` ustunidan EMAS. Indeksga haydovchi **faqat `driver:location` kelganda** tushardi:

- `goOffline()` (va har uzilishdan keyingi 2 daqiqalik grace) indeksdan **o'chiradi**;
- `goOnline()` esa **qaytarmasdi** (`markIdle()` qaytaradi — asimmetriya shu yerda edi);
- telefon qimirlamasa `watchPositionAsync` `distanceInterval: 15` sababli yangi GPS
  nuqtasi **bermaydi**.

Natija: ilovada yashil "Onlayn", DB'da `ONLINE_IDLE`, lekin dispatch uchun haydovchi
**umuman mavjud emas** → zakaz darhol `NO_DRIVER`.

**Tuzatish:**
| Joy | Nima |
|---|---|
| `drivers.service.goOnline()` | oxirgi ma'lum joylashuvdan geo-indeksni tiklaydi |
| `dispatch.service.fillWindow()` | nomzod topilmasa SABABNI loglaydi (toifa, radius, indeksdagi soni) |
| `geo.service.countInIndex()` | shu diagnostika uchun |
| driver-app `goOnline()` | onlayn bo'lishda **darhol** bitta GPS nuqtasi yuboradi |
| driver-app | har daqiqada joylashuv "yurak urishi" + qayta ulanganda yuborish |

**Isbotlangan** — `pnpm sim:online-geo` (regressiya simi: haydovchi online → location →
uzilib qayta ulanadi → zakaz):
```
tuzatishsiz:  ❌ zakaz holati NO_DRIVER
tuzatish bilan: ✅ taklif keldi, DISPATCHING
```
`sim:dispatch` (10/10) va `sim:trip` (15/15) ham toza.

**API prod'ga deploy qilindi** (2026-07-29), `/health` ok.
**APK hali qayta qurilmagan** — dizayn tugadi, build qilish mumkin (4-bo'lim, 2-band).

### 2c. "Zakaz oldin, haydovchi keyin" — TUZATILDI, PROD'DA (`7dee020`)

Ikkita alohida muammo, ikkalasi ham bitta holatdan: zakaz kelganda hech kim onlayn emas.

**(1) Kech onlayn bo'lgan haydovchiga taklif bormasdi.** Zakaz NO_DRIVER'da qolardi va
uni qayta ko'taradigan hech narsa yo'q edi. Haydovchi keyin ishga chiqsa ham kutib
turgan zakazdan bexabar qolardi.
→ `DispatchService.retryPendingForDriver()` — haydovchi onlayn bo'lganda YOKI birinchi
GPS nuqtasi kelganda (geo-indeksga tushganda) o'z toifasidagi, 15 daqiqadan yangi,
radius ichidagi NO_DRIVER zakazlarni qayta dispatch qiladi.
NO_DRIVER→CREATED atomik. Mijoz orada YANGI zakaz bergan bo'lsa eskisi tiriltirilmaydi.

**(2) Operator biriktirsa mijoz ko'rmasdi.** API to'g'ri emit qilardi — muammo BOTDA edi:
`tracker.ts` `NO_DRIVER` ni terminal deb bilib **socketni yopardi**, keyingi `ACCEPTED`
hech qayerga bormasdi.
→ NO_DRIVER endi terminal emas. Sessiya bo'shatiladi (mijoz yangi zakaz bera olsin),
lekin kuzatuv 15 daqiqa saqlanadi; ACCEPTED kelsa zakaz sessiyada yana faol bo'ladi.

**Yo'l-yo'lakay:** `finalize()` va ownership listener'dagi ushlanmagan `void` promise'lar
`.catch()` bilan o'raldi — u yerdagi DB xatosi butun API jarayonini **yiqitardi**
(sim'da haqiqatan yiqitdi).

**Isbotlangan** — `pnpm sim:late-driver`: tuzatishsiz 3 ta tekshiruv yiqiladi,
tuzatish bilan 7/7. Boshqa simlar ham toza (dispatch 10/10, trip 15/15, race 9/9,
security 10/10, online-geo 1/1).

**api va bot prod'ga deploy qilindi** (2026-07-29).

**⚠️ Ochiq qolgan xavf:** operator `POST /ops/orders/:id/assign` mijozda BOSHQA faol
zakaz bor-yo'qligini tekshirmaydi. Mijoz "taksi topilmadi"dan keyin yangi zakaz bergan
bo'lsa, eski zakazga qo'lda biriktirish uni bir vaqtda ikkita safarga tushirishi mumkin.
Avto-qayta-dispatch yo'lida bu tekshiruv bor, operator yo'lida yo'q — mahsulot qarori.

---

### Sinov tartibi (MAVJUD APK bilan)

1. Ilovada **"Ishni boshlash"** → yashil **"Onlayn"**
2. Telegram: `@toy_taxy_bot` → `/start` → 🚕 Taksi chaqirish → toifa → lokatsiya → tasdiq
3. Ilovada taklif chiqishi kerak → "Qabul"
4. Safar bosqichlari: yetib keldim → boshladim → yakunladim

**⚠️ Toifa mos kelishi shart:** botdan tanlangan toifa (standard/comfort/cargo)
haydovchining mashinasi toifasiga **teng bo'lishi kerak** — geo-indeks toifalarga
bo'lingan, mos kelmasa taklif bormaydi. Hozirgi yagona haydovchining mashinasini
admin panelidan tekshiring.

**Agar hali ham taklif kelmasa** — endi sabab loglarda aniq yozilgan:
```bash
railway logs --service api | grep "Nomzod topilmadi"
# → toifa=standard, radius=6000m, shu toifadagi geo-indeksda 0 ta haydovchi
```
- `0 ta haydovchi` + to'g'ri toifa ⇒ ilova hech qachon GPS yubormagan
  (`drivers.last_lat` NULL) ⇒ **APK'ni qayta qurish kerak** (ilova tomondagi tuzatish).
- boshqa toifa ko'rsatsa ⇒ mijoz noto'g'ri toifa tanlagan.

### 2d. "Taksi qayerda?" — Telegram Mini App jonli xarita (`162bf75`)

Avval tugma statik joylashuv nuqtasi yuborardi — u muzlab qolardi va mijoz har
safar tugmani qayta bosishi kerak edi (10s bo'g'iq bilan). Endi Mini App ochiladi,
xarita **har 5 soniyada o'zi yangilanadi**.

| Endpoint | Nima |
|---|---|
| `GET /miniapp/track` | sahifa (Leaflet + OSM, kalit kerak emas) |
| `POST /miniapp/track` | jonli ma'lumot: haydovchi nuqtasi, olib ketish nuqtasi, mashina kartasi |

**Bu YAGONA guard'siz controller.** Himoya butunlay Telegram `initData` imzosida:
HMAC-SHA256 (doimiy vaqtli solishtirish) + `auth_date` eskirganini rad etish +
imzodagi telegram id zakaz mijozining `telegram_id` si bilan solishtiriladi.
Busiz `?order=<id>` bilan begona safarni kuzatish mumkin bo'lardi.

**Env:** `TELEGRAM_BOT_TOKEN` API'da — Railway servis-havolasi bilan qo'yilgan:
`${{bot.BOT_TOKEN}}` (bitta joyda turadi, nusxalanmaydi). **IXTIYORIY** — berilmasa
mini app 503 qaytaradi va bot eski statik tugmaga qaytadi.

**Bot:** `MINIAPP_URL` (default `API_BASE_URL + /miniapp/track`). Telegram `web_app`
tugmasi faqat **HTTPS** qabul qiladi — lokal dev'da (http) bot avtomatik eski
callback tugmasiga qaytadi, aks holda Telegram BUTUN klaviaturani rad etardi.

Tekshirildi: `pnpm sim:miniapp` 16/16 (jonli yangilanish + begona foydalanuvchi,
buzilgan imzo, yaroqsiz hash, mavjud bo'lmagan zakaz — hammasi rad etiladi),
+ 8 ta unit test imzo tekshiruvi uchun. Prod'da sahifa 200, imzosiz so'rov 403.

---

### 2e. Mini App prod'da 500 bergan edi — CORS (`b3be366`)

Foydalanuvchi Mini App'ni ochdi: xarita chiqdi, lekin "Ma'lumot olinmadi" yozildi.

**Sabab:** brauzer **POST** so'rovida `Origin` sarlavhasini **o'z-origin bo'lganda
ham** yuboradi. Mini App sahifasi API'ning o'zidan berilgani uchun `Origin` =
API domeni edi, allowlist'da esa faqat admin domeni bor — CORS rad etib 500 qaytardi.

Lokalda `CORS_ORIGINS` bo'sh (dev = hammaga ochiq) bo'lgani uchun `sim:miniapp`
16/16 o'tgan edi. **Klassik dev/prod farqi.**

**Tuzatish:** `selfOrigin()` — servis o'z public domenini `RAILWAY_PUBLIC_DOMAIN` /
`RAILWAY_STATIC_URL` dan oladi va `parseOrigins()` uni allowlist'ga qo'shadi
(env'da qo'lda yozib unutib bo'lmasin).

**Sim endi buni ushlaydi:** `Origin` sarlavhasi yuboriladi. Ushlash uchun API'ni
`CORS_ORIGINS` o'rnatilgan holda ishga tushiring:
```bash
CORS_ORIGINS=https://admin.example RAILWAY_PUBLIC_DOMAIN=http://localhost:3000 \
  TELEGRAM_BOT_TOKEN=123:TEST node apps/api/dist/main.js
```
Isbotlandi: `selfOrigin` bo'lmasa sim yiqiladi, bo'lsa 16/16.

Sahifa endi xato KODINI ko'rsatadi ("HTTP 500") va chizish xatosini tarmoq
xatosidan ajratadi — avval ikkalasi ham bir xil "Ma'lumot olinmadi" berardi.

---

### 2f. "Yetib keldim" himoyasi (`8193311`)

Haydovchi yo'lda turib "Yetib keldim" bosishi mumkin edi — joylashuv **umuman
tekshirilmasdi**. Ikki zarar: kutish soati erta ishga tushib mijoz ortiqcha
to'lardi, va mijozga "Taksi yetib keldi" yolg'on xabari borib u ko'chada yo'q
mashinani kutardi.

| Qatlam | Env | Default |
|---|---|---|
| Geofence — uzoqdan bosilsa RAD ETILADI | `ARRIVED_GEOFENCE_M` | **150** m |
| GPS eskirgan bo'lsa bloklamaymiz, belgilaymiz | `ARRIVED_LOCATION_STALE_SEC` | 120 s |
| Kutish haqiga yuqori chegara | `MAX_BILLABLE_WAIT_MIN` | 30 daq |

- Masofa tekshiruvi holat o'zgarishidan **OLDIN** — rad etilsa zakaz ARRIVED'ga o'tmaydi.
- Xato ilovaga ack bo'lib boradi va `Alert` bilan ko'rsatiladi:
  *"Siz hali yetib kelmadingiz — mijozdan 1.1 km uzoqdasiz"*.
- GPS'siz o'tkazilgan holatlar hodisaga `stale: true` + masofa bilan yoziladi va
  operatorga `ARRIVED_NO_GPS` ogohlantirishi ketadi.
- Chegara **narx hisobida** — `orders.waiting_minutes` da haqiqiy qiymat qoladi.

**150 m — foydalanuvchi tanlovi** (men 300 m tavsiya qilgandim: zich qurilgan
joyda GPS 20–50 m adashadi). Halol haydovchilar shikoyat qilsa — `ARRIVED_GEOFENCE_M`
ni Railway'dan oshiring, kod o'zgartirish shart emas.

Tekshirildi: `pnpm sim:arrived-guard` 8/8 + pricing chegarasiga 3 unit test.

---

### 2g. Mini App'dan buyurtma berish + baholash ixtiyoriy (`8bd3923`, `91f0815`)

**Xaritadan buyurtma.** Telegram lokatsiya tugmasi FAQAT telefonning joriy GPS
nuqtasini yubora oladi — mijoz boshqa manzilga taksi chaqira olmasdi, GPS
noto'g'ri ko'rsatgan binoda noto'g'ri nuqta ketardi. Endi mini app'da nuqtani
o'zi qo'yadi.

Mini app IKKI rejimli (bitta sahifa, `/miniapp/state` hal qiladi):
- faol buyurtma yo'q → **BUYURTMA**: xarita markazida qotgan nuqta (markerni
  barmoq bilan sudrashdan aniqroq — barmoq nuqtani yopmaydi), toifa, tugma
- faol buyurtma bor → **KUZATUV** (avvalgidek)

| Endpoint | Nima |
|---|---|
| `POST /miniapp/state` | faol buyurtma bormi → qaysi rejim |
| `POST /miniapp/order` | xaritadan tanlangan nuqta bilan buyurtma |

Barcha qoidalar `OrdersService.create()` da QOLADI. Mini app faqat kimligini
tekshiradi: imzo → telegram id → mijoz. Ro'yxatdan o'tmagan 403.
Qo'shimcha: daqiqasiga 5 buyurtma chegarasi.

**Bot menyusida** "🗺 Xaritadan chaqirish" (web_app). Eski matnli oqim
**ATAYLAB QOLDIRILDI** — eski Telegram mijozlarida mini app ochilmaydi va
lokatsiya tugmasi kam texnologiyali foydalanuvchi uchun bir bosishda ishlaydi.

**Manzil nomlari YO'Q** — foydalanuvchi qarori. `NOMINATIM_URL` bo'sh, teskari
geokodlash o'chiq. Mijoz xaritadan joyni ko'radi, lekin "Registon ko'chasi 12"
yozilmaydi. Kerak bo'lsa `/geo/*` endpointlari tayyor turibdi.

**Baholash ixtiyoriy.** Texnik jihatdan hech narsani bloklamasdi, lekin UX uni
majburiydek ko'rsatardi (5 ta yulduz, chiqish yo'li yo'q). Endi "O'tkazib
yuborish" tugmasi bor va matn "(ixtiyoriy)" deydi.

Tekshirildi: `pnpm sim:miniapp` **25/25**.

---

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

1. **🔴 Zakaz oqimini sinash** (2-bo'lim) — birinchi navbatda.
2. **🔴 EAS build — endi tayyor.** Yangi dizayn TO'LIQ joriy qilindi (`9c50004`, `fd3b0cd`), ilova tomondagi GPS tuzatishi ham shu buildga kiradi.
   ```bash
   cd apps/driver-app && eas build --platform android --profile preview
   ```
   Dizayn manbasi: Stitch maketlari (2026-07-29) + `docs/DRIVER-APP-DESIGN-PROMPT.md`.
   Tokenlar `apps/driver-app/src/theme.ts` da — rang/o'lcham o'zgarsa FAQAT shu fayl.
   Maketda YO'Q edi, ataylab qo'shildi: Oflayn ekranidagi "Ishni boshlash" tugmasi,
   ONLAYN holati, safar 1/2-bosqichi, yakuniy narx, Kabinet 3 tab.
   Maketda BOR edi, ataylab olinmadi (backendda ma'lumot yo'q): mijoz surati,
   mijoz reytingi, "To'lov: Naqd", pastki tab bar, to'liq ekran xarita foni.
3. **FCM kaliti Expo'ga yuklanishi** — jarayon boshlangan edi, tugadimi noma'lum.
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
4. **Haydovchilar qo'shish** — hozir 1 ta approved haydovchi (`+998990051630`).
   Botdan zakaz ishlashi uchun **kamida bitta ONLINE haydovchi shart**, VA uning
   mashinasi toifasi zakaz toifasiga mos bo'lishi kerak — aks holda `NO_DRIVER`.
   (`+998900000097/98/99` — diagnostika uchun yaratilgan, **bloklangan**, o'chirsa bo'ladi.)
5. **Xarita xizmatlari** (ixtiyoriy) — API'dagi `/geo/*` endpointlari tayyor va
   testlangan, lekin **hozir hech kim chaqirmaydi** (bot oqimidan manzil olib tashlangan).
   Kerak bo'lmasa o'chirsa bo'ladi.
6. **Railway healthcheck** — `RAILWAY_CONFIG_PATH` qo'yildi, faollashgani tekshirilmagan.
7. **In-app xarita** (react-native-maps) — driver-app TODO.

---

## 5. Bu sessiyada bajarilgan ish

```
8bd3923 feat(miniapp): xaritadan buyurtma berish (nuqta GPS bilan cheklanmaydi)
91f0815 fix(bot): haydovchini baholash IXTIYORIY ekani ko'rinadigan bo'ldi
1d234eb docs: HANDOFF — 'Yetib keldim' himoyasi
8193311 feat(trips): "Yetib keldim" geofence + kutish haqiga chegara
7dfcdc3 docs: HANDOFF — Mini App CORS tuzatishi
b3be366 fix(cors): API o'z domenini ham allowlist'ga qo'shsin (Mini App 500)
67ca7bb docs: HANDOFF — Telegram Mini App jonli xaritasi
162bf75 feat(miniapp): "Taksi qayerda?" — Telegram Mini App jonli xaritasi
7a5ca93 docs: HANDOFF — kech onlayn haydovchi va NO_DRIVER biriktirish tuzatishlari
7dee020 fix(dispatch,bot): kech onlayn haydovchi + NO_DRIVER'dan keyingi biriktirish
aec5421 docs: HANDOFF — dizayn tugagani va EAS build tayyorligi
fd3b0cd feat(driver-app): yangi dizayn tugallandi — safar, yakuniy narx, Kabinet
9c50004 feat(driver-app): yangi dizayn — tokenlar, Login, Parol, asosiy ekran
22b2cd4 docs: HANDOFF yangilandi + driver-app dizayn promptlari (Google Stitch)
40d197f fix(dispatch): "Onlayn" haydovchi taklif olmasligi tuzatildi (geo-indeks)
25cb16d docs: HANDOFF.md — 'Ulanmoqda' sababi topilgani va yangi APK bilan yangilash
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
- **Lokal DB foydalanuvchisi `tty`, port 5434** — `psql -U postgres` ishlamaydi:
  `docker exec tty_postgres psql -U tty -d tty -c "…"`.
- **`pkill -f "dist/main.js"` o'zini o'ldiradi** (buyruq matni shablonga tushadi) —
  `pkill -f "dist/mai[n].js"` yozing.
- **APK ichini tekshirishda** bundle Hermes bayt-kodida — `strings -a -n 4` ishlating,
  `grep -x` EMAS (aniq qator mosligi noto'g'ri natija beradi).

**Simlar:** `sim:dispatch sim:trip sim:sprint3 sim:bot sim:race sim:security sim:cluster
sim:online-geo sim:late-driver sim:miniapp sim:arrived-guard`

- **Socket handler qiymat qaytarmasa ack KELMAYDI** — `driver:offer_response`
  va `driver:location` shunday. Ularni sim'da `await emit(...)` bilan kutsangiz
  sim abadiy osiladi (ilova ham bu yerlarda ack kutmaydi).
- **`sim:miniapp` uchun API `TELEGRAM_BOT_TOKEN` bilan ishga tushirilishi kerak**
  (istalgan qiymat, masalan `123:TEST` — sim ham o'shani ishlatadi).
- **Simlar orasida API'ni QAYTA ISHGA TUSHIRING.** Dispatch holati xotirada (taymerlar
  bilan); DB'ni TRUNCATE qilsangiz taymer o'chirilgan zakazga murojaat qilib FK xatosi
  beradi. Bu prod'da bo'lmaydi (zakaz o'chirilmaydi), lekin sim'ni chalg'itadi.

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
- **"Onlayn" ≠ "dispatch ko'radi".** Holat ikki joyda yashardi: Postgres `status` va
  Redis geo-indeks. UI birinchisini ko'rsatardi, dispatch ikkinchisini o'qirdi — ular
  bir-biriga bog'lanmagan edi. Bir tushunchani ikki manbada saqlasangiz, ularni
  sinxronlashtiradigan yagona joy bo'lishi kerak.
- **`markIdle()` da tuzatilgan bug `goOnline()` da qolib ketgan edi** — hatto izohi
  ham o'sha muammoni tushuntirardi. Bir xatoni tuzatgach, o'sha shakldagi qo'shni
  yo'llarni ham qidiring.
- **Regressiya simi yozing, keyin tuzating.** `sim:online-geo` tuzatishsiz yiqilishi
  isbotlanmaganda, tuzatish "ishlayotganga o'xshardi" xolos.
