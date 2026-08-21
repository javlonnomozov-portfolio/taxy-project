# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat:** 2026-08-01 · **Branch:** `main` (toza) · **Repo:** `/home/javlon/Documents/GitHub/taxy-project`
> **Oxirgi commit:** `eec7c94`
>
> Bu faylni yangi chatga tashlang va "davom et" deng.

---

## 1. Loyiha nima

Mahalliy taksilar uchun buyurtma platformasi (Bulung'ur, Samarqand viloyati).
Mijoz **Telegram bot** yoki **Telegram Mini App** orqali taksi chaqiradi
→ eng yaqin haydovchilarga (**Expo/React Native ilova**) taklif boradi
→ birinchi "Qabul" yutadi. Operator **veb-panel**dan kuzatadi va aralashadi.

**Stack:** pnpm monorepo · NestJS + Socket.IO + PostgreSQL + Redis · Telegraf bot ·
React/Vite admin · Expo driver-app · Railway deploy.

**Paketlar:** `apps/api`, `apps/bot`, `apps/admin`, `apps/driver-app`
(workspace'dan **chiqarilgan** — o'z `node_modules`, npm, EAS bilan quriladi),
`packages/shared`.

Driver-app: owner `jav1on`, package `uz.toytaxy.driver`,
EAS projectId `862b155e-1193-4c77-87fb-0cb63e29ee9e`
(eski hisob `javl9n` build limitini tugatgan — 2026-08-01 da ko'chirildi).

---

## 2. Production holati

| Servis | URL / holat |
|---|---|
| **api** | https://api-production-13444.up.railway.app · `/health` ok · `/trips/active` · `/miniapp/rate` · `/miniapp/cancel` · `/auth/customer/*` (2026-08-17) |
| **admin** | https://admin-production-42e5.up.railway.app · yangi dizayn |
| **bot** | `@toy_taxy_bot` · polling · barqaror · `CANCELLED_BY_CUSTOMER` ishlanadi (2026-08-01) |
| Postgres + Redis | Railway plugin · **migratsiya 8** qo'llangan |

**Deploy:** `railway up --service api|admin|bot --ci` (repo rootdan).
**GitHub'ga ulanmagan** — merge deploy qilmaydi, qo'lda ishga tushiriladi.
Migratsiyalar konteyner startida **avtomatik** ishlaydi (`Dockerfile` CMD).

> ⚠️ **Ilova yangi endpoint ishlatsa, API'ni DEPLOY QILING.** APK prod API'ga
> qaraydi (`app.json` → `extra.apiUrl`). Safar tiklash APK'da tayyor turib,
> prod'da `/trips/active` yo'qligi sababli **jimgina ishlamay turgan** edi:
> ilova 404 oladi, `catch` ga tushadi va hech narsa ko'rsatmaydi. APK'ni
> yig'ishdan oldin emas, **birga** deploy qiling.

**Muhim env:**
- `CORS_ORIGINS=https://admin-production-42e5.up.railway.app` — prod'da **majburiy**.
  Kod o'z domenini avtomatik qo'shadi (`selfOrigin()`), qo'lda yozish shart emas.
- `TELEGRAM_BOT_USERNAME=toy_taxy_bot` (api) — mijoz ilovasi deep link'i uchun
  (`https://t.me/<username>?start=<nonce>`). Bo'lmasa `/auth/customer/start`
  aniq xato beradi.
- `TELEGRAM_BOT_TOKEN` (api) — Railway **servis-havolasi** bilan: `${{bot.BOT_TOKEN}}`.
  Ixtiyoriy: bo'lmasa mini app 503 qaytaradi va bot eski tugmaga qaytadi.
- `JWT_EXPIRES_IN=90d` (2026-08-13 da `7d` dan oshirildi — haydovchi har hafta
  ilovadan chiqib ketardi). Ilova muddat tugashini endi to'g'ri ishlaydi
  (login ekraniga sabab bilan qaytaradi). Bloklash baribir DARHOL ta'sir
  qiladi (`session:revoked`), token muddatiga bog'liq emas.
  **DIQQAT:** bu o'zgaruvchini o'zgartirgach `railway redeploy --service api`
  qiling — Railway o'zgaruvchini saqlaydi, lekin konteynerni QAYTA ISHGA
  TUSHIRMAYDI va eski qiymat amalda qolaveradi (hostname o'zgarganini
  loglardan tekshiring). 90 kun ekani token `exp` maydonidan tasdiqlangan.
- `ADMIN_PASSWORD` — **admin seed faqat admin YO'Q bo'lsa ishlaydi**
  (`admin-seed.service.ts`: `if (existing) return`). Parolni almashtirish
  uchun `admin_users` qatorini o'chirib, yangi parol bilan redeploy qiling.
- `ARRIVED_GEOFENCE_M=150` · `ARRIVED_LOCATION_STALE_SEC=120` · `MAX_BILLABLE_WAIT_MIN=30`
- `NOMINATIM_URL` / `OSRM_URL` — **bo'sh** (manzil nomlari/marshrut o'chiq, ataylab).

### 🟢 Eng so'nggi APK (LOKAL build, commit `300286f`)

```
apps/driver-app/toy-taxy-driver-300286f.apk   (66 MB, .gitignore'da)
```

⚠️ **Keystore o'zgargan** (Expo hisobi `javl9n` → `jav1on`, loyiha
`862b155e-1193-4c77-87fb-0cb63e29ee9e`). Bu APK eski ilova ustiga
o'rnatilMAYDI — haydovchi bir marta eskisini o'chirishi kerak. Bundan
keyingi yangilanishlar oddiy.
Ichida: yangi dizayn · GPS tuzatishi · status bar · bekor qilish himoyasi ·
oflayn taklif tuzatishi · `ErrorBoundary` · **xaritani to'liq ekranga ochish**
(amal tugmalari bilan) · **ilova o'ldirilsa faol safar tiklanadi** ·
**token muddati tugasa login ekraniga qaytadi** ·
**xarita WebView crash tuzatilgan** (2026-08-17 da telefonda tasdiqlangan).
Oldingi bulut APK (commit `7458e0a`):
`https://expo.dev/artifacts/eas/lb71xPeZJo8dIChQuaTrQH5_J7aQqixd5X6jcfW_Re8.apk`

#### Play Market uchun AAB (APK EMAS)

```
apps/driver-app/toy-taxy-driver-300286f.aab   (31 MB, .gitignore'da)
```
Play Market **APK qabul qilmaydi** — AAB kerak. Yig'ish:
```bash
cd apps/driver-app && eas build -p android --profile production --local
```
(`preview` profili APK, `production` profili AAB beradi — `eas.json`.)

⚠️ **Play App Signing** — Google do'konda O'Z kalitini ishlatadi. Ya'ni
do'kondan o'rnatilgan ilova hozirgi APK ustiga TUSHMAYDI: haydovchilar bir
marta o'chirib qayta o'rnatishi kerak bo'ladi.

Do'konga yuklashdan oldin (kodga aloqasi yo'q): Play Console hisobi ($25),
**maxfiylik siyosati URL** (majburiy — ilova joylashuv yig'adi), fon
joylashuvi uchun alohida tushuntirish va odatda **video**, do'kon sahifasi
(ikonka, 2+ skrinshot), "shaxsiy ma'lumot yig'iladi" deklaratsiyasi.

#### Lokal build (bepul, limitsiz) — Expo Free tarifi tugaganda

Free tarifda oylik Android build limiti bor; tugasa bulut buildi
`Error: build command failed` bilan darhol yiqiladi (kod aybdor emas).
Lokal build limitga kirmaydi va EAS'dagi keystore bilan imzolaydi:

```bash
export ANDROID_HOME=$HOME/Android/Sdk ANDROID_SDK_ROOT=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH
cd apps/driver-app && eas build -p android --profile preview --local
```

Talab: `platforms;android-34` + `build-tools;34.0.0` + `platform-tools`
(`~/Android/Sdk` ichida, `sdkmanager --sdk_root=$ANDROID_HOME` bilan o'rnatiladi
— **sudo kerak emas**). JDK 21 yetarli, 17 shart emas. NDK **kerak emas**
(bog'liqliklarning hammasi tayyor AAR). `/usr/lib/android-sdk` (apt) —
chalg'ituvchi, ishlatilmaydi.

Log'da `npx -y expo-doctor exited with non-zero code: 1` chiqishi **normal** —
bu ogohlantirish bosqichi, keyin `Build successful` keladi.

---

## 3. Qolgan ishlar

1. **Haydovchilar qo'shish.** 2026-08-13 da prod bazasi TOZALANDI —
   haydovchi ham, mijoz ham, zakaz ham YO'Q (0 ta). Foydalanuvchi o'zi
   qo'shadi. Zakaz ishlashi uchun **kamida bitta ONLINE haydovchi** VA uning
   mashinasi toifasi zakaz toifasiga **mos** bo'lishi shart — aks holda
   `NO_DRIVER`. Tariflar (3 ta) va sozlamalar saqlab qolindi.
2. ~~FCM kaliti~~ — **HAL QILINDI (2026-08-17).** Push ishlayapti:
   Expo ticket + receipt = `ok` VA bildirishnoma haqiqiy telefonga
   yetib kelgani foydalanuvchi tomonidan tasdiqlangan.

   ⚠️ **Nima bo'lgan edi:** Expo hisobi `javl9n` → `jav1on` ga
   ko'chirilganda FCM kaliti ESKI loyihada qolgan. Push jimgina ishlamay
   turgan — Expo `InvalidCredentials` qaytarardi, lekin buni hech kim
   ko'rmasdi, chunki `NotificationsService` xatoni faqat `log.warn` qiladi.

   **Yangi Expo loyihasi yaratilsa FCM kalitini QAYTA yuklash shart:**
   ```bash
   cd apps/driver-app && eas credentials -p android
   #  → production → Google Service Account
   #  → ...Key for Push Notifications (FCM V1) → Set up...
   #  → ~/Downloads/toy-taxi-firebase-adminsdk-fbsvc-fb514f8e04.json
   ```
   Firebase loyihasi: `toy-taxi`, paket `uz.toytaxy.driver`.
   **Rebuild kerak emas.** Push faqat ilova YOPIQ bo'lganda kerak —
   ilova ochiq bo'lsa soket + mahalliy bildirishnoma ishlaydi.

   Tekshirish (haqiqiy push yuboradi):
   ```bash
   curl -s -X POST https://exp.host/--/api/v2/push/send \
     -H 'content-type: application/json' \
     -d '[{"to":"<ExponentPushToken>","title":"sinov","body":"sinov"}]'
   ```
3. **Xarita xizmatlari** (ixtiyoriy) — `/geo/*` tayyor, lekin hech kim
   chaqirmaydi. Mini app'da manzil nomlari yo'q (foydalanuvchi qarori).
4. **Railway healthcheck** — `RAILWAY_CONFIG_PATH` qo'yildi, faollashgani
   tekshirilmagan.
5. **In-app xarita** (react-native-maps) — driver-app TODO. Hozir WebView+Leaflet.
6. **APK hajmi** — ABI bo'yicha ajratilsa ~25 MB ga tushadi (`eas.json`).

### ⚠️ Ochiq xavflar (mahsulot qarori kutilmoqda)

- **Operator `assign`** mijozda BOSHQA faol zakaz bor-yo'qligini tekshirmaydi.
  Mijoz "taksi topilmadi"dan keyin yangi zakaz bergan bo'lsa, eskisiga qo'lda
  biriktirish uni ikkita safarga tushirishi mumkin. Avto-qayta-dispatch yo'lida
  bu tekshiruv **bor**, operator yo'lida **yo'q**.
- **Geofence 150 m** — foydalanuvchi tanlovi (men 300 m tavsiya qilgandim).
  Halol haydovchi "yaqinman, bosolmayapman" desa → `ARRIVED_GEOFENCE_M` ni
  Railway'dan oshiring, kod tegilmaydi.

---

## 4. Nima qilingan (qisqacha) — hammasi prod'da

| Commit | Nima |
|---|---|
| `aec3e5f` | Socket transport tartibi: **polling BIRINCHI** ("Ulanmoqda…" tuzatildi) |
| `40d197f` | **Geo-indeks:** `goOnline()` indeksni tiklaydi + nomzod topilmasa sabab loglanadi |
| `7dee020` | Kech onlayn haydovchiga kutib turgan zakaz + bot NO_DRIVER'da kuzatuvni saqlaydi |
| `162bf75` | **Mini App** "Taksi qayerda?" jonli xarita (initData imzosi bilan) |
| `b3be366` | CORS: API o'z domenini allowlist'ga qo'shadi (Mini App 500 bergan edi) |
| `8193311` | **"Yetib keldim" geofence** + kutish haqiga chegara |
| `8bd3923` | Mini App'dan **xaritadan buyurtma berish** |
| `d99b117` | Mini App kirish nuqtasi (inline/menyu tugmasi) + bot↔miniapp Redis sinxronligi |
| `7419a9d` | **"Har zakaz uchun to'lov"** billing rejimi (migratsiya 8) |
| `73562c2` | Driver-app: status bar + bekor qilish tuzoqlari |
| `9a09d3e` | Baholashdan keyin menyu qaytishi + poyga tuzatildi |
| `50f80e4` | Joylashuv ruxsati bir marta so'raladi (LocationManager/watchPosition) |
| `7cb6af1` | Mijoz bekor qilganda **dispatch ham to'xtatiladi** |
| `7458e0a` | Oflayn holatda taklif ko'rinmasin + `ErrorBoundary` |
| `e700826` | Safarlar tarixi **NULLS FIRST** bug (COALESCE bilan tartiblash) |
| `ca46c09` `a957dc6` | **Admin panel yangi dizayn** + brauzer prompt/confirm o'rniga modal |
| `1778381` | Xaritani **to'liq ekranga ochish** + xarita har GPS nuqtasida qayta yuklanmaydi |
| `978c0e0` | **Ilova o'ldirilsa faol safar tiklanadi** (`GET /trips/active`) + to'liq ekranda amal tugmalari |
| `44533e7` | Yangi Expo hisobi (**keystore o'zgargan** — qayta o'rnatish kerak) |
| `9df6411` | **Mini app: narx + baholash** (bot chati bilan sinxron) + takroriy baho himoyasi |
| `dd8114d` | **Mini app: bekor qilish tugmasi** + bot `CANCELLED_BY_CUSTOMER` ni ishlaydi + sim gigiyenasi |
| `448f1fe` | **Token tugaganda ilova qulflanib qolmaydi** (401 → login) + `session:revoked` tinglanadi |
| `d17b031` | To'liq ekranda mijozgacha masofa `0.0 km` ko'rsatardi (bosib o'tilgan masofa chiqarilardi) |
| `43ef55b` | Fonda ruxsat so'ramaslik + `AppState` tekshiruvi (crash sababi BU EMAS edi) |
| `300286f` | **Ilova qulashi**: xarita yechib olingan WebView'ga `injectJavaScript` yozardi → JNI `obj == null` |
| `43aac41` | **Mijoz raqami `+` siz saqlanardi** — kontakt ulashish yo'lida normalizatsiya yo'q edi |
| `f5ab131` | **Yangi haydovchi 5.00 reyting** bilan boshlaydi (urug' ovoz, suyuladi) |
| `dcbf156` | Mijoz ilovasi rejasi — `docs/CUSTOMER-APP-PLAN.md` |
| `eec7c94` | **Mijoz ilovasiga Telegram orqali kirish** (nonce + kod, `customer` roli) |

**Dizayn hujjatlari:** `docs/DRIVER-APP-DESIGN-PROMPT.md`,
`docs/ADMIN-DESIGN-PROMPT.md` (ikkalasi ham mavjud koddan o'qib yozilgan;
admin promptida **qat'iy cheklovlar** bo'limi bor — Stitch mavjud bo'lmagan
ma'lumotlarni o'ylab topishga moyil).

**Dizayn tokenlari bir joyda:** driver-app → `src/theme.ts`,
admin → `src/styles.css`. Rang/o'lcham o'zgarsa FAQAT shu fayllar.

---

## 5. Takrorlanadigan NAQSHLAR (eng qimmat saboqlar)

### 5.1 Asimmetriya naqshi — **5 marta takrorlandi**

Bir xil ishni qiladigan ikki yo'l bor, biridan yon ta'sir tushib qolgan:

| Bor | Yo'q edi |
|---|---|
| `markIdle()` geo-indeksni tiklardi | `goOnline()` — yo'q |
| Backend NO_DRIVER'ni yakuniy demaydi | bot — yakuniy derdi |
| `ops.close()` `dispatch.abort()` chaqirardi | `cancelByCustomer()` — yo'q |
| `markOnTrip()` indeksdan chiqarardi | `goOffline()` taklifni qaytarib olmasdi |
| baho berish menyuni qaytarardi | "o'tkazib yuborish" — yo'q |

> **Qoida:** holatni o'zgartiradigan yangi metod yozganda, o'sha holatni
> o'zgartiradigan MAVJUD metodlarni yonma-yon qo'yib solishtiring.

**`dispatch.abort()` ni chaqirishi shart bo'lgan joylar:** `ops.close()`,
`ops.assign()`, `dispatch.offerToDriver()`, `trips.cancelByCustomer()`.
**Taklifni qaytarib olishi shart:** `goOffline()` (gateway'da `goOfflineAndWithdraw`).

### 5.1b "Ishlamayapti" shikoyatida AVVAL prod logini o'qing

Ilova "Ulanmoqda…" da qotib qolgani uchun yarim soat kod o'qildi — javob
bitta buyruqda turgan edi:
```bash
railway logs --service api | grep -iE "rad etildi|jwt|401"
# → Haydovchi socket ulanishi rad etildi: jwt expired
```
Server nega rad etganini ALLAQACHON yozadi. Taxmin qilishdan oldin o'qing.

### 5.1c Fon rejimida qilib bo'lmaydigan ishlar (Android 12+)

Ilova tizim tomonidan FONDA ham ishga tushiriladi (qayta ishga tushirish,
joylashuv, push). O'shanda quyidagilar jarayonni O'LDIRADI:
- **foreground service ochish** (`Location.startLocationUpdatesAsync` ning
  `foregroundService` sozlamasi) → `ForegroundServiceStartNotAllowedException`;
- **ruxsat oynasini ochish** (`request*PermissionsAsync`) — Activity yo'q.

Alomat: soket 5-60 soniyada ulanib-uzilib turadi, logda "rad etildi" YO'Q
(auth joyida), ya'ni jarayon o'lib qayta ishga tushmoqda. `ErrorBoundary`
buni USHLAMAYDI — bu JS xatosi emas.

> **Qoida:** `useEffect(..., [])` ichida joylashuv/ruxsat/servis bilan
> ishlaydigan kod yozsangiz, `AppState.currentState === 'active'` ni
> tekshiring. Avtomatik yo'lda ruxsat SO'RAMANG — `get*PermissionsAsync`
> bilan faqat o'qing.

### 5.1d Native crashni ErrorBoundary USHLAMAYDI — logcat oling

Ilova "o'zidan o'zi chiqib ketsa" va ekranda hech narsa ko'rinmasa, bu JS
xatosi EMAS. Telefonni USB bilan ulab:
```bash
export PATH=$HOME/Android/Sdk/platform-tools:$PATH
adb logcat -b crash -d | grep -A 20 toytaxy      # o'tgan crashlar
adb logcat -b crash -c                            # buferni tozalash
```
Bir marta shu bilan aniqlandi:
`JNI DETECTED ERROR IN APPLICATION: obj == null ... (tid mqt_native_modu)`
— xarita YECHIB OLINGAN WebView'ga `injectJavaScript` yozayotgan edi.

> **Qoida:** `ref.current?.` tekshiruvi YETARLI EMAS. Native ko'rinish yo'q
> qilingan bo'lsa ham `ref.current` hali null bo'lmasligi mumkin. Komponent
> ekranda ekanini ALOHIDA bayroq bilan kuzating (unmount cleanup'da o'chiring).

Bu yerda men avval foreground service deb TAXMIN qilib, noto'g'ri tuzatish
yozgan edim. Logcat bir daqiqada haqiqatni ko'rsatdi.

### 5.2 Jimgina yutilgan xatolar eng ko'p vaqt oladi

`connect_error` handleri yo'qligi · CORS 500 sababi ko'rinmasligi ·
ack tekshirilmasligi · ilova "keeps stopping" — hammasi shu sabab.
**Xatoni ekranga chiqaring**, keyin tuzating.

### 5.3 Regressiya simini AVVAL yozing

Har tuzatish uchun: sim tuzatishsiz **yiqilishi** isbotlanmasa, tuzatish
"ishlayotganga o'xshaydi" xolos. Bu sessiyada har safar shunday qilindi.

---

## 6. Lokal ishga tushirish va TUZOQLAR

```bash
pnpm db:up                                   # postgres:5434 + redis:6379
set -a; . ./.env; set +a
export ADMIN_LOGIN=admin ADMIN_PASSWORD=admin123 LOGIN_RATE_LIMIT=1000
pnpm --filter @tty/api migration:run
pnpm --filter @tty/shared build && pnpm --filter @tty/api build
node apps/api/dist/main.js
```

**Tuzoqlar (har biri qimmatga tushgan):**

- `ConfigModule` `.env` ni **O'QIMAYDI** — env'ni qo'lda export qilish shart.
- Lokal DB useri **`tty`**, port **5434**:
  `docker exec tty_postgres psql -U tty -d tty -c "…"` (`-U postgres` ishlamaydi).
- `pkill -f "dist/main.js"` **o'zini o'ldiradi** → `pkill -f "dist/mai[n].js"`.
- **Simlar orasida API'ni QAYTA ISHGA TUSHIRING** — dispatch holati xotirada
  (taymerlar bilan); DB'ni TRUNCATE qilsangiz taymer o'chirilgan zakazga
  murojaat qilib FK xatosi beradi.
- **Socket handler qiymat qaytarmasa ack KELMAYDI** (`driver:offer_response`,
  `driver:location`). `await emit(...)` bilan kutsangiz sim abadiy osiladi.
- `sim:miniapp` uchun API `TELEGRAM_BOT_TOKEN=123:TEST` bilan ishga tushirilsin.
- **Prod CORS xatolarini lokalda ko'rmaysiz** — `CORS_ORIGINS` bo'sh bo'lsa
  hammaga ochiq. Brauzerdan API'ga so'rov qo'shsangiz shunday sinang:
  `CORS_ORIGINS=https://admin.example RAILWAY_PUBLIC_DOMAIN=http://localhost:3000`
- **Botni `getUpdates` bilan TEKSHIRMANG** — polling slotini o'g'irlab yiqitadi.
- **Bot deploy'da bitta 409 NORMAL** — `launchWithRetry` uni o'tkazadi.
- `TypeORM`: `manager.query()` UPDATE uchun `[rows, affected]`, SELECT uchun `rows`.
- **Nullable ustun bo'yicha `DESC` tartiblashda Postgres NULL'ni BIRINCHI qo'yadi.**
  `COALESCE` yoki `NULLS LAST` ishlating (safarlar tarixi shundan buzilgan edi).
- `miniapp.page.ts` — sahifa **shablon satri** ichida: izohlarda ham teskari
  qo'shtirnoq ishlatmang, build yiqiladi.
- **driver-app'ga bog'liqlik qo'shsangiz** `npm install --package-lock-only`
  ni ham ishga tushiring — EAS `npm ci` ishlatadi, lock mos kelmasa yiqiladi.
- **APK ichini tekshirishda** `strings -a -n 4` faqat ASCII uchun ishonchli.
  **Hermes ASCII bo'lmagan satrlarni UTF-16LE da saqlaydi** va `strings -e l`
  ham kirillchani TOPMAYDI (tekshirildi: `Скрыть карту` bundle ichida bor, lekin
  `strings -e l` nol natija beradi). Bayt darajasida qidiring:
  ```bash
  unzip -o app.apk assets/index.android.bundle
  python3 -c "d=open('assets/index.android.bundle','rb').read()
  print(any(d.count('MATN'.encode(e)) for e in ('utf-8','utf-16-le')))"
  ```
  **Nazorat namunasi ishlating:** o'zgarishdan OLDIN ham mavjud bo'lgan satrni
  qidiring — u topilmasa, muammo APK'da emas, qidiruv usulida.
- `SafeAreaView` **`react-native`dan Android'da hech narsa qilmaydi** (faqat iOS).
  `paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0`.
- **Telegram `web_app` tugmasi REPLY klaviaturada `initData` BERMAYDI** —
  faqat inline tugma / menyu tugmasi / to'g'ridan havola.

**Simlar:**
```
sim:dispatch sim:trip sim:sprint3 sim:bot sim:race sim:security sim:cluster
sim:online-geo sim:late-driver sim:miniapp sim:arrived-guard sim:miniapp-sync
sim:per-order sim:customer-cancel sim:offline-withdraw sim:trip-history
sim:trip-resume sim:miniapp-rating sim:customer-auth
```

**Ikkitasi alohida sozlama talab qiladi:**
- `sim:sprint3` — API `DISPATCH_WINDOW_SIZE=1` bilan ishga tushirilsin
  (`dispatch` simi esa ODATIY oyna bilan ishlaydi — ikkalasi bitta API'da
  bir vaqtda o'tmaydi).
- `sim:cluster` — ikkinchi API instansiyasi kerak (`API_B`, port 3001).
  Busiz sim osilib qoladi.

**Simlar orasida lokal muhitni tozalang** — geo-indeksda qolgan haydovchilar
yangi simning zakazini o'zlashtirib, sim sababsiz yiqiladi:
```bash
docker exec tty_redis redis-cli --scan --pattern 'geo:drivers:*' \
  | xargs -r -n1 docker exec tty_redis redis-cli DEL
docker exec tty_postgres psql -U tty -d tty \
  -c "UPDATE drivers SET status='OFFLINE' WHERE status<>'OFFLINE';"
```
Telefon raqamlari `helpers.mjs` dagi `simPhone()`/`simPlate()` bilan olinadi —
qat'iy raqam yozmang, ikkinchi ishga tushirishda 403 beradi.
Oxirgi 8 tasi shu sessiyada yozilgan regressiya simlari — har biri o'z
tuzatishisiz **yiqilishi isbotlangan**.

Unit: api 80 · bot 25 · admin 17.

---

## 7. Arxitektura qarorlari (nega aynan shunday)

- **Dispatch egaligi, BullMQ emas** — dispatch mahsulotning yuragi va sim'lar
  bilan qoplangan; egalik modeli (`dispatch:owner:<orderId>`, `SET NX` + TTL)
  o'sha mantiqni o'zgartirmasdan ko'p instansiya to'g'riligini beradi.
- **Dispatch faqat Redis geo-indeksidan qidiradi** (`geo:drivers:<toifa>`), DB
  `status` ustunidan EMAS. "Onlayn" ≠ "dispatch ko'radi".
- **WS uchun interceptor, filter emas** — Nest `filter.func()` natijasini
  ishlatmaydi, ya'ni exception filter orqali Socket.IO ack qaytarib bo'lmaydi.
- **CORS adapter darajasida** — `@WebSocketGateway({cors})` env o'qiy olmaydi.
- **Prod ENV qattiq talablari** — xavfsizlik sozlamasi unutilganda servis
  jimgina zaif holatda ishlamasin.
- **`handleConnection` da `driverId` I/O'DAN OLDIN o'rnatiladi** — Socket.IO
  `connect` ni transport ulanishi bilanoq beradi.
- **Mini App — yagona guard'siz controller.** Himoya butunlay Telegram
  `initData` imzosida: HMAC-SHA256 + `auth_date` + telegram id ↔ mijoz.
- **Bot↔API Redis pub/sub orqali** (`bot:track`) — mini app botga o'zi xabar
  bera olmaydi (`sendData()` faqat reply klaviaturada, u yerda initData yo'q).
- **Balans manfiyga o'tadi — ataylab.** Qarzdor haydovchi ham safarni
  yakunlaydi; aks holda mijoz ham osilib qolardi.
- **Kutish chegarasi narx hisobida**, `start()` da emas — `orders.waiting_minutes`
  da haqiqiy qiymat qoladi.
- **`makeT` har til uchun bitta funksiya keshlaydi** — aks holda cheksiz render.

---

## 8. Sinov tartibi

1. APK o'rnating → **"Ishni boshlash"** → yashil **"Onlayn"**
2. Telegram `@toy_taxy_bot` → `/start` → menyuda **"🗺 Xaritadan chaqirish"**
   (mini app) yoki eski **"🚕 Taksi chaqirish"** (bot oqimi)
3. Ilovada taklif → "Qabul"
4. Safar: yetib keldim (geofence 150 m!) → boshladim → yakunladim

**⚠️ Toifa mos kelishi shart** — geo-indeks toifalarga bo'lingan.

**Muammo bo'lsa — diagnostika loglarda:**
```bash
railway logs --service api | grep "Nomzod topilmadi"     # nega taklif ketmadi
railway logs --service api | grep "bekor qildi"          # kim, qaysi bosqichda
```
Ilova qulasa — endi `ErrorBoundary` xato matnini **ekranda** ko'rsatadi,
skrinshot yetarli.
