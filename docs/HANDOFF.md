# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat:** 2026-08-23 · **Branch:** `main`, lekin **48 faylda commit qilinmagan
> o'zgarish bor** (pastga qarang) · **Repo:** `d:\toy-taxy` (Windows, VSCode
> ichidagi Claude Code)
> **Oxirgi COMMIT:** `e93898d` — bu commit'dan keyingi ish hali git'ga
> tushmagan, garchi **backend'i production'da allaqachon ishlayotgan bo'lsa ham**.
>
> Bu faylni yangi chatga tashlang va "davom et" deng.

---

## 0. HOZIRGI VAZIYAT — birinchi shuni o'qing

**Eng muhim narsa:** bu sessiyada (2026-08-21 dan 2026-08-23 gacha, ikki kunlik
uzun sessiya, bir necha marta kontekst siqilgan) juda katta hajmda ish
qilindi — mijoz ilovasi deyarli qaytadan yozildi, haydovchi ilovasi qayta
dizayn qilindi, backend'ga bir nechta muhim tuzatish kirdi. **Hech biri
`git commit` qilinmagan.** Faqat backend qismi (`apps/api`) qo'lda
`railway up` bilan production'ga deploy qilingan — ya'ni **production kod
bilan git'dagi `main` HOZIR BIR-BIRIGA MOS EMAS**. Agar kimdir git'dan
toza clone qilsa, production'da ishlayotgan xatti-harakatni OLMAYDI.

**Keyingi sessiya uchun birinchi qaror:** foydalanuvchi bilan gaplashib,
shu 48 faylni commit qilish kerakmi (deyarli aniq — HA, chunki ishlab
turgan, sinovdan o'tgan kod) va qachon.

### 0.1 Ochiq (tugallanmagan) topshiriq: mijoz ilovasi — YANGI Figma dizayn

Foydalanuvchi customer-app'ni **ikkinchi marta** qayta qurishni so'radi —
bu safar Figma linkidan:
```
https://www.figma.com/design/8RflGALB1D3QfFWy9id1XG/Toy-taxi?node-id=0-1&p=f&t=rQguhWaiRRjhDcsm-0
```
Talab: shu dizayn bo'yicha qayta qur, **dizayndagi kamchiliklarni
to'g'irlab ket** (ya'ni ko'r-ko'rona nusxa ko'chirmang, muammoli joylarni
top va yaxshiroq qil), keyin APK yig'ib GitHub'ga yukla.

**Holat:** Figma'ga hali kirilmagan.
- To'g'ridan-to'g'ri `WebFetch` bilan ochib bo'lmadi — 403 (shaxsiy fayl,
  Figma tashqi so'rovni bloklaydi).
- Figma MCP serverini ulashga harakat qilindi (`claude mcp add` orqali,
  foydalanuvchi buyruq berdi). Server **qo'shildi, lekin hali
  AUTENTIFIKATSIYADAN o'tmagan** (`/mcp` → "0 connected, 1 not
  connected"). OAuth login shu (non-interactive) sessiyadan bajarib
  bo'lmaydi — foydalanuvchi buni **interaktiv** terminalda `/mcp` →
  `figma` tanlash → login havolasini ochish orqali o'zi yakunlashi kerak.
- **Muqobil yo'l (agar MCP ishlamasa):** foydalanuvchidan Figma
  ekranlarining skrinshotlarini so'rang (avvalgi customer-app/driver-app
  qayta dizaynlarida aynan shu usul juda yaxshi ishladi — u telefondan
  screenshot olib shu yerga tashlaydi).
- Figma MCP ulangandan keyin: `figma-design-to-code` skill'ini albatta
  oldin yuklang (MAJBURIY prerequisite — `get_design_context` chaqirishdan
  oldin).

**"Dizayndagi kamchiliklarni to'g'irla" talabiga qanday yondashish kerak:**
avvalgi ikki marta (customer-app, keyin driver-app) xuddi shunday vaziyat
bo'lgan — foydalanuvchi qog'ozdagi/rasmdagi dizaynni SO'ZMA-SO'Z emas,
loyihaning haqiqiy imkoniyatlariga moslab qurish kerak edi. Masalan:
oldingi customer-app mockup'ida "aniq narx tanlashda" ko'rsatilgan edi —
bu haqiqiy taksometr arxitekturasiga (km oldindan noma'lum) to'g'ri
kelmasdi, shuning uchun "...dan boshlab" bazaviy narxga almashtirildi
(foydalanuvchi bilan kelishilgach). Xuddi shunday: yangi Figma dizaynda
ham loyihada YO'Q funksiyalar (masalan geokodlash/manzil qidirish — bu
ATAYLAB o'chirilgan, §3dagi "Hal qilingan mahsulot savollari"ga qarang)
yoki mavjud arxitekturaga zid narsalar bo'lishi mumkin — ko'r-ko'rona
nusxalamang, nomuvofiqlikni foydalanuvchiga ayting va qaror so'rang.

### 0.2 Bu sessiyada nima qilindi (commit qilinmagan, lekin ishlaydi va sinovdan o'tgan)

**Mijoz ilovasi (`apps/customer-app`) — deyarli to'liq qayta yozildi:**
- Yangi dizayn: oq fon + yashil aksent (`#00B14F`), avval qorong'i edi.
  Tokenlar: `src/theme.ts` (`C`, `R`, `F`, `SP`, `S`, `shadow`).
- Pastki tab paneli qo'shildi: **Asosiy / Buyurtmalar / Kabinet**
  (`src/TabBar.tsx`, `src/screens/HistoryScreen.tsx`,
  `src/screens/ProfileScreen.tsx` — uchalasi ham YANGI fayl, hali
  git'da `??` holatida).
- Xaritadan pin sudrab "qayerdan olib ketamiz" tanlash — haqiqiy ishlaydi
  (`src/MapView.tsx` → `PickupPicker`, Leaflet↔RN `postMessage` ko'prigi).
- GPS: kesh (`getLastKnownPositionAsync`) darhol, aniq nuqta 8s
  `timeout`li poyga bilan — GPS signalisiz abadiy spinner qolmasin.
- "Uy"/"Ish" saqlangan manzillar (backend: `customers.home_lat/lng`,
  `work_lat/lng` — migratsiya `1722600000000-CustomerSavedAddresses.ts`,
  endpointlar `GET/PUT/DELETE /customer/addresses/:label`).
- 5+ yo'lovchi uchun sig'im filtri: `vehicles.seats` (migratsiya
  `1722700000000-VehicleSeatsAndPassengers.ts`), `orders.passengers`,
  dispatch faqat `passengers > 4` bo'lganda tekshiradi (SESSION-2026-08.md
  §2.5 sababli — oddiy zakazlarda filtr UMUMAN ishlamaydi). Admin panelda
  o'rin sonini tahrirlash (`Drivers.tsx`, `PUT /ops/drivers/:id/vehicle`).
- Toifa tanlashda bazaviy narx "...dan boshlab" (`GET /customer/tariffs`,
  admin panelda sozlanadi — taksometr, yakuniy narx EMAS).
- Draggable pastki panel (`Animated`+`PanResponder`, yangi kutubxona
  QO'SHILMAGAN — HANDOFF 5.1f'dagi xavfdan saqlanish uchun).
- `NO_DRIVER` holatida bekor qilish TUZATILDI (pastga qarang, §0.3).

**Haydovchi ilovasi (`apps/driver-app`) — dizayn + xatti-harakat:**
- Xuddi shu oq/yashil tema `src/theme.ts`ga ko'chirildi (bitta fayl —
  qolgan ekranlar token orqali avtomatik yangi ko'rinishga o'tdi).
- **Taklif muddati BUTUNLAY olib tashlandi** — foydalanuvchining aniq
  qarori (xavfini tushuntirdim, "butunlay olib tashlash"ni tanladi).
  Countdown, progress bar, avtomatik rad etish — hammasi yo'q. Haydovchi
  qabul/rad qilguncha taklif turadi.
- Zakazlar ro'yxati **masofa bo'yicha saralanadi** (eng yaqinidan).

**Backend (`apps/api`) — PRODUCTION'GA DEPLOY QILINGAN:**
1. `NO_DRIVER` holatida mijoz endi bekor qila oladi, jarimasiz
   (`orders.constants.ts`: `CUSTOMER_CANCELLABLE_STATUSES` ga qo'shildi;
   `trips.service.ts`: `penalized` hisobida `NO_DRIVER` maxsus holat).
   Muammo: mijoz "taksi topilmadi" holatida abadiy "qidirilmoqda"
   ko'rardi VA bekor ham qilolmasdi ("Bekor qilib bo'lmaydi" xatosi) —
   bu bot/mini-app/ilova UCHALASIGA ham tegishli edi (bitta umumiy metod).
2. **Taklif muddati (`DISPATCH_OFFER_TIMEOUT_SEC`) butunlay olib
   tashlandi** — `dispatch.service.ts`dan `setTimeout`,
   `offerTimeoutMs`, `timeoutSec` maydonlari butunlay chiqarildi.
   `onNoDriver()`dagi operator-oynasi qayta tekshiruvi endi
   `DISPATCH_NO_DRIVER_TIMEOUT_SEC` bilan ishlaydi (haydovchiga
   ko'rinmaydi, faqat ichki). `.env.example`, `env.validation.ts`,
   `docs/deploy-railway.md`dan ham o'chirildi.
3. Yuqoridagi barcha yangi endpointlar (`/customer/tariffs`,
   `/customer/addresses`, `/customer/history`, `/customer/profile`) +
   sig'im filtri — hammasi deploy qilingan.

Ikkalasi ham (`railway up --service api --ci`) muvaffaqiyatli, `/health`
tekshirildi. Lekin **bu deploylar git commit'siz qilindi** — Railway
git'dan emas, joriy ishchi papkadan quradi (`railway up` shunday
ishlaydi), shuning uchun kod prod'da bor, `main`da yo'q.

### 0.3 GitHub'ga yuklangan APK'lar (git branch orqali, `.gitignore`ni chetlab)

APK fayllar odatiy holda `.gitignore`da (repo tarixini shishirmaslik
uchun). Foydalanuvchi telefondan boshqarayotgani va kompyuteriga
ulanmagani uchun (USB yo'q) APK'larni **alohida branch'larga** `git add -f`
bilan qo'shib push qilindi — bu branch'lar hech qachon `main`ga merge
qilinmasin, faqat vaqtinchalik yuklab-olish uchun:

```
apk/customer-preview → apps/customer-app/toy-taxy-customer-2026-08-23-nodriver-fix.apk
apk/driver-preview   → apps/driver-app/toy-taxy-driver-2026-08-23-new-design.apk
```

GitHub'dan yuklab olish (telefon brauzerida, repo shaxsiy — login kerak):
```
https://github.com/javlonnomozov-portfolio/taxy-project/blob/apk/customer-preview/apps/customer-app/toy-taxy-customer-2026-08-23-nodriver-fix.apk
https://github.com/javlonnomozov-portfolio/taxy-project/blob/apk/driver-preview/apps/driver-app/toy-taxy-driver-2026-08-23-new-design.apk
```

**Yangi APK kerak bo'lsa:** branch'ni checkout qiling, eski APK'ni
`git rm --cached`, yangisini `git add -f`, commit, push — xuddi shu
branch'ga (git avtomatik "rename" deb his qiladi, tarix shishmaydi).
Keyin **albatta `git checkout main`ga qayting** — asosiy branch'da
48 ta commit qilinmagan fayl bor, ularni yo'qotmang.

**EAS build — bu mashinada MUHIM cheklovlar:**
- `eas build --local` **Windows'da ISHLAMAYDI** ("Unsupported platform,
  macOS or Linux is required"). Faqat **cloud build**
  (`eas build -p android --profile preview --non-interactive --no-wait`).
- Cloud build **faqat git bilan kuzatilgan fayllarni** yuklaydi. Bu
  `apps/driver-app/google-services.json` (Firebase, `.gitignore`da)
  bilan ikki marta build'ni yiqitdi (`EAS_BUILD_MISSING_GOOGLE_SERVICES_JSON_ERROR`).
  **Yechim — faylni HECH QACHON git'ga qo'shmasdan:**
  1. `apps/driver-app/.easignore` yaratildi (bo'sh bo'lsa ham) — bu EAS
     yuklashni git-kuzatuvidan MUSTAQIL qiladi, `google-services.json`
     endi to'g'ridan-to'g'ri kiradi.
  2. Qo'shimcha xavfsizlik: fayl EAS'ning file-type environment
     variable'i sifatida ham saqlangan (`GOOGLE_SERVICES_JSON`, preview
     environment, `eas env:set` bilan) + `.eas/hooks/eas-build-pre-install.sh`
     uni build boshida nusxalaydi (agar `.easignore` biror sabab bilan
     yetarli bo'lmasa, zaxira yo'l).
  3. Fayl LOKAL kompyuterda `apps/driver-app/google-services.json` da
     turibdi (git'ga HECH QACHON qo'shilmagan). Yangi mashinada bu fayl
     yo'q bo'ladi — Firebase konsolidan qayta yuklab olish kerak
     (`toy-taxi` loyihasi → Project Settings → Your apps →
     `uz.toytaxy.driver` → `google-services.json`). Bu MIJOZ ilovasiga
     KERAK EMAS — faqat haydovchi ilovasida FCM push bor.
- Build uchun EAS hisobiga kirish: `EXPO_TOKEN` env var bilan (parol
  SO'RALMASIN — foydalanuvchi expo.dev → Account Settings → Access
  Tokens'dan token yaratib beradi). Token vaqtinchalik, hech qayerga
  saqlanmagan — yangi sessiyada qaytadan so'rash kerak bo'ladi.
- `apps/customer-app/app.json`dagi `extra.apiUrl` PROD API'ga
  qaytarilgan (`https://api-production-13444.up.railway.app`) — sessiya
  davomida vaqtincha `localhost:3000`ga o'zgartirilgan edi, buni har doim
  build'dan OLDIN tekshiring.

---

## 1. Loyiha nima

Mahalliy taksilar uchun buyurtma platformasi (Bulung'ur, Samarqand viloyati).
Mijoz **Telegram bot**, **Telegram Mini App** yoki endi **mijoz ilovasi**
orqali taksi chaqiradi → eng yaqin haydovchilarga (**Expo/React Native
ilova**) taklif boradi → birinchi "Qabul" yutadi. Operator **veb-panel**dan
kuzatadi va aralashadi.

**Stack:** pnpm monorepo · NestJS + Socket.IO + PostgreSQL + Redis · Telegraf bot ·
React/Vite admin · Expo driver-app + customer-app · Railway deploy.

**Paketlar:** `apps/api`, `apps/bot`, `apps/admin`, `apps/driver-app`,
`apps/customer-app` (oxirgi ikkalasi workspace'dan **chiqarilgan** — o'z
`node_modules`, npm, EAS bilan quriladi), `packages/shared`.

Customer-app: paket `uz.toytaxy.customer`, EAS projectId
`c3ad9431-a59d-4076-b067-002b1b96b9de`. Mijoz Telegram bot orqali kiradi
(deep link → bot **6 xonali kod** beradi → ilova `verify` bilan kiradi —
kod MAJBURIY, avtomatik kirish hisob o'g'irlash yo'lini ochgan edi,
2026-08-21).

Driver-app: owner `jav1on`, package `uz.toytaxy.driver`,
EAS projectId `862b155e-1193-4c77-87fb-0cb63e29ee9e`.

---

## 2. Production holati

| Servis | URL / holat |
|---|---|
| **api** | https://api-production-13444.up.railway.app · `/health` ok · barcha `/customer/*` endpointlar (§0.2) 2026-08-23 holatiga qadar deploy qilingan |
| **admin** | https://admin-production-42e5.up.railway.app |
| **bot** | `@toy_taxy_bot` · polling · barqaror |
| Postgres + Redis | Railway plugin |

**Deploy:** `railway up --service api|admin|bot --ci` (repo rootdan).
Bu mashinada `railway` CLI **allaqachon login qilingan va `toy-taxy`
loyihasiga ulangan** (`~/.railway/config.json` — boshqa loyihalar:
`imdod`, `optom-chek`, `uzum-report` ham shu ro'yxatda, ehtiyot bo'ling,
`railway status` bilan qaysi servisga ulanganingizni tekshiring).
**GitHub'ga ulanmagan** — merge deploy qilmaydi, qo'lda ishga tushiriladi.
Migratsiyalar konteyner startida **avtomatik** ishlaydi.

> ⚠️ **Ilova yangi endpoint ishlatsa, API'ni DEPLOY QILING — ikkalasini
> BIRGA.** Bu qoida shu sessiyada yana ikki marta tasdiqlandi (§0.2).

**Muhim env (o'zgarmagan, avvalgidan):** `CORS_ORIGINS`,
`TELEGRAM_BOT_USERNAME=toy_taxy_bot`, `TELEGRAM_BOT_TOKEN=${{bot.BOT_TOKEN}}`,
`JWT_EXPIRES_IN=90d`, `ARRIVED_GEOFENCE_M=150`, `NOMINATIM_URL`/`OSRM_URL`
bo'sh. **`DISPATCH_OFFER_TIMEOUT_SEC` ENDI YO'Q** (§0.2.2) — Railway'da
hali turgan bo'lsa ham kod uni o'qimaydi, xavfsiz.

---

## 3. Qolgan ishlar

### Eng ustuvor (shu sessiyadan qolgan)

1. **Figma dizayni bo'yicha customer-app'ni qayta qurish** — §0.1 ga qarang.
2. **Figma MCP autentifikatsiyasi** — foydalanuvchi interaktiv
   terminalda `/mcp` orqali yakunlashi kerak.
3. **48 faylni COMMIT QILISH** — foydalanuvchi bilan kelishib. Mantiqiy
   bo'laklarga bo'lib commit qilingani ma'qul (customer-app dizayni,
   driver-app dizayni + taklif muddati, backend NO_DRIVER/timeout
   tuzatishlari, migratsiyalar) — bittalab, `git log` uslubiga mos
   (qisqa, "nega" ga urg'u beruvchi commit xabarlari, misollar §4da).
4. **`docs/CUSTOMER-APP-PLAN.md` yangilash kerak** — u hali eski (faqat
   1-bosqich bajarilgan deb yozilgan), aslida 3-4-5-bosqichlar ham
   katta qismda bajarildi (Tarix, Kabinet, manzillar). O'qing va
   moslashtiring.

### Eski (hali dolzarb)

5. **Haydovchilar qo'shish.** Prod bazasida haydovchi/mijoz/zakaz yo'q
   edi (2026-08-13da tozalangan) — hozir holatini `railway run` yoki
   admin panel orqali tekshiring, sim ishlatilgan bo'lishi mumkin.
6. **Play Market uchun AAB** — customer-app uchun ham, driver-app uchun
   ham hali yig'ilmagan (faqat preview/APK profili ishlatilgan).
7. **`CustomerGateway`ga JWT** — hali ichki kalit bilan ishlaydi, ilova
   polling qiladi (5s), jonli socket emas. `CUSTOMER-APP-PLAN.md` §3bda
   batafsil.
8. **Mijozni bloklash endpointi yo'q** — `is_blocked` ustuni bor,
   operator panelidan ishlatib bo'lmaydi.
9. **In-app xarita** (react-native-maps) — hozir WebView+Leaflet,
   ikkala ilovada ham.

### ✅ Hal qilingan mahsulot savollari (o'zgarmagan, qayta ochilmasin)

- **4+ yo'lovchi uchun yangi TOIFA/mashina rusumi tanlash — KERAK EMAS.**
  Buning o'rniga sig'im MASHINAGA bog'lanadi (§0.2, `vehicles.seats`) —
  bu ziddiyat EMAS, balki dastlabki qarorni buzmaydigan qo'shimcha yechim.
- **Manzilni nomi bo'yicha qidirish — BEKOR QILINDI.** Faqat xaritadan
  belgilash (yoki saqlangan Uy/Ish). Borish joyi ham shart emas.
- **Narx oldindan aniq ko'rsatilmaydi** — faqat "...dan boshlab" bazaviy
  narx (taksometr arxitekturasi km oldindan bilishni talab qilmaydi).
- **Haydovchi ilovasida taklif muddati YO'Q** (2026-08-23, §0.2/0.3).

### ⚠️ Ochiq xavflar

- **Operator `assign`** mijozda boshqa faol zakaz borligini tekshirmaydi
  (avvalgidan o'zgarmagan).
- **Geofence 150 m** — foydalanuvchi tanlovi.
- **`google-services.json` bu mashinaga bog'liq** — boshqa kompyuterda
  davom etilsa, Firebase konsolidan qayta yuklab olish kerak (§0.3).

---

## 4. Bu sessiyada nima o'zgardi — fayl bo'yicha xarita

Hech biri commit qilinmagani uchun commit-hash jadvali o'rniga — qaysi
ishni qaysi fayllarda qidirish kerak:

| Ish | Asosiy fayllar |
|---|---|
| Mijoz ilovasi dizayni + tab panel | `apps/customer-app/src/theme.ts`, `TabBar.tsx`, `App.tsx`, `screens/HomeScreen.tsx`, `screens/HistoryScreen.tsx` (yangi), `screens/ProfileScreen.tsx` (yangi) |
| Xaritadan pin tanlash | `apps/customer-app/src/MapView.tsx` (`PickupPicker`) |
| Uy/Ish manzillar | `apps/api/src/customers/customers.service.ts`, `customer-app.controller.ts`, migratsiya `1722600000000-*`, sim `scripts/customer-addresses-sim.mjs` |
| Sig'im filtri (5+ yo'lovchi) | `apps/api/src/dispatch/dispatch.service.ts` (`filterBySeats`), `entities/vehicle.entity.ts`, `entities/order.entity.ts`, migratsiya `1722700000000-*`, admin `Drivers.tsx`, sim `scripts/seat-filter-sim.mjs` |
| Tariflar ko'rsatish | `apps/api/src/customers/customer-orders.service.ts` (`tariffs()`) |
| `NO_DRIVER` bekor qilish tuzatishi | `apps/api/src/orders/orders.constants.ts`, `trips/trips.service.ts` |
| Taklif muddatini olib tashlash | `apps/api/src/dispatch/dispatch.service.ts` (butun fayl bo'ylab), `config/env.validation.ts`, `.env.example`, `docs/deploy-railway.md` |
| Haydovchi ilovasi dizayni | `apps/driver-app/src/theme.ts`, `MapView.tsx`, `App.tsx`, `app.json` |
| Haydovchi: muddatsiz + masofa saralash | `apps/driver-app/src/screens/HomeScreen.tsx` (`offers.map` atrofi) |
| EAS/Firebase build tuzoqlari | `apps/driver-app/.easignore`, `.eas/hooks/eas-build-pre-install.sh` (ikkalasi ham yangi, git'da `??`) |

**Sessiya yozuvi:** `docs/SESSION-2026-08.md` — bu **eski** (2026-08-01
gacha), shu sessiyaning qarorlari hali yozilmagan. Yangi bo'lim
qo'shish yoki `SESSION-2026-08-23.md` deb alohida fayl ochish mantiqiy.

**Dizayn tokenlari bir joyda:** ikkala mobil ilova → `src/theme.ts`,
admin → `src/styles.css`. Rang/o'lcham o'zgarsa FAQAT shu fayllar
(bu qoida shu sessiyada ham to'g'ri ishladi — bitta fayl almashtirish
bilan haydovchi ilovasi butunlay yangi ko'rinishga o'tdi).

---

## 5. Takrorlanadigan NAQSHLAR (eng qimmat saboqlar)

> 5.1 – 5.3 avvalgi sessiyalardan — HANDOFF'ning oldingi versiyasida
> to'liq matn bor edi (asimmetriya naqshi, prod logini avval o'qish, fon
> rejimi cheklovlari, native crash/logcat, Expo versiya nomuvofiqligi,
> jimgina yutilgan xatolar, regressiya simi avval). **Qisqartirilmadi —
> pastda git tarixida** (`git show 990e861:docs/HANDOFF.md` bilan
> ko'rish mumkin) **hammasi bor, faqat joy tejash uchun bu versiyada
> qayta yozilmadi.** Muhim: ular hali ham to'g'ri, faqat bu yerda
> takrorlanmadi.

### 5.4 Windows mashinada `pkill` node jarayonini o'ldirmaydi

`pkill -f "dist/mai[n].js"` Linux'da ishlaydi (HANDOFF 5.1'dagi
o'z-o'zini o'ldirish tuzog'idan saqlanish uchun), lekin Git Bash orqali
Windows'da nohup bilan boshlangan node jarayonlarini KO'RMAYDI —
"o'chirilgan" server aslida portni ushlab qolaveradi, ikkinchi server
`EADDRINUSE` bilan yiqiladi va eski (yangilanmagan) server javob
berishda davom etadi — bu chalg'ituvchi, chunki `curl /health` baribir
"ok" qaytaradi.

**Ishonchli yo'l — PowerShell orqali:**
```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
```
Qayta ishga tushirishdan oldin porti bo'shaganini tekshiring
(`curl` ulanmasligi kerak).

### 5.5 Docker Desktop Windows'da qo'lda ishga tushirilishi kerak

`docker ps` `dockerDesktopLinuxEngine` pipe xatosi bilan yiqilsa, Docker
Desktop ishlamayapti:
```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```
Keyin `docker ps` javob berguncha kuting (odatda 5-10s, konteynerlar
allaqachon mavjud bo'lsa tezroq).

### 5.6 `dispatch-sim.mjs`ning "6 ta taklif 800ms ichida" tekshiruvi — atayin FLAKY, kod xatosi EMAS

Bu Windows/Docker Desktop muhitida bir necha marta 6 tadan kamroq
(1–5) taklif bilan muvaffaqiyatsiz tugadi. **Buni to'g'ridan-to'g'ri
o'zgartirilgan kod bilan bog'lamang** — men buni ATAYLAB tekshirdim:
`filterBySeats()`ni vaqtincha o'chirib qayta ishga tushirdim, XATOLIK
AYNAN O'SHA edi. Sabab — sim'ning 800ms kutish oynasi shu mashinada
(cloud IDE + Docker Desktop WSL2 qatlami) 6 ta ketma-ket takliflar uchun
juda tor. Boshqa testlar (2, 3, 4 — rad etish, qabul qilish, NO_DRIVER)
har doim barqaror o'tdi.

> **Qoida:** `dispatch-sim`ning aniq-son tekshiruvi muvaffaqiyatsiz
> bo'lsa, avval Redis+orders holatini tozalab (pastga qarang) 2-3 marta
> qayta ishga tushiring. Barqaror muvaffaqiyatsizlik bo'lmasa, bu
> muhitning tezligi, kod emas.

Shuningdek: `seat-filter-sim.mjs`ning test-4 (sig'imga mos haydovchi
yo'q holati) o'zining zakazini BEKOR QILMAGAN edi — bu keyingi
dispatch-sim ishga tushishlarida `recoverOrphans()` orqali qayta
tiklanib, keraksiz shovqin va noaniq muvaffaqiyatsizliklarga sabab
bo'lardi. Tuzatildi (sim endi test-4 oxirida o'z zakazini bekor qiladi),
lekin **umumiy qoida:** har bir sim yaratgan zakazini oxirida bekor
qilishi/yopishi SHART — aks holda keyingi sim ishga tushishlarini
zaharlaydi.

### 5.7 `NO_DRIVER` — bitta umumiy metodni tuzatish uch kanalni ham tuzatadi

`CUSTOMER_CANCELLABLE_STATUSES`ga `NO_DRIVER` qo'shilishi bot, mini app
VA mijoz ilovasi — uchalasini ham bir vaqtda tuzatdi, chunki uchalasi
ham `TripsService.cancelByCustomer()` orqali o'tadi (`/orders/:id/cancel`
va `/customer/orders/:id/cancel` ikkalasi ham shu metodga keladi). Bu
HANDOFF 5.1dagi "asimmetriya naqshi"ning aksi — bu safar mantiq
ATAYLAB bitta joyda saqlangani uchun uch kanalni alohida-alohida
tuzatish shart bo'lmadi.

### 5.8 Frontend'dagi "ikkinchi bosish" xatolari — server javobini kutayotganda tugmani o'chiring

Mijoz "Bekor qilish"ni ikki marta bossa (birinchi so'rov hali javob
bermagan bo'lsa-yu, `Alert.alert` tasdiqlash oynasi yopilgach tugma
darhol qayta bosiladigan bo'lsa), ikkinchi so'rov serverda "allaqachon
bekor qilingan" xatosiga uchraydi — foydalanuvchiga chalkash ko'rinadi
("Bekor qilindi" sarlavhasi TURIB, "Bekor qilib bo'lmaydi" xatosi
chiqadi). Tuzatish: so'rov davomida `busy`/`cancelling` holat bilan
tugmani `disabled` qiling, poll yangilanishini kutmang.

---

## 6. Lokal ishga tushirish (Windows, `d:\toy-taxy`)

```bash
# 1) Docker Desktop ishga tushganini tekshiring (5.5)
docker ps

# 2) Konteynerlar yo'q bo'lsa
pnpm db:up                                   # postgres:5434 + redis:6379

# 3) Env
set -a; . ./.env; set +a
export ADMIN_LOGIN=admin ADMIN_PASSWORD=admin123 LOGIN_RATE_LIMIT=1000 \
  TELEGRAM_BOT_TOKEN=123:TEST TELEGRAM_BOT_USERNAME=toy_taxy_bot

# 4) Migratsiya + build + ishga tushirish
pnpm --filter @tty/api migration:run
pnpm --filter @tty/shared build && pnpm --filter @tty/api build
nohup node apps/api/dist/main.js > apps/api/api.log 2>&1 & disown
```

**Windows'ga xos qo'shimcha tuzoqlar (Linux uchun yozilgan eski
qo'llanmadan tashqari — ular hali ham to'g'ri):**
- Server o'chirish/qayta ishga tushirish — `pkill` EMAS, §5.4 (PowerShell).
- `eas build --local` ishlamaydi — §0.3.
- `apps/customer-app`, `apps/driver-app` — `npm install` (pnpm emas),
  alohida papkalarda. Root'dan `pnpm install` faqat `apps/api`,
  `apps/admin`, `apps/bot`, `packages/shared` ni qamraydi.
- Bash tool POSIX (`/d/toy-taxy`), PowerShell tool alohida (`d:\toy-taxy`)
  — ikkalasi ham bor, kerakli joyda ishlatilsin (git/node — Bash,
  process/Docker boshqaruvi — ko'pincha PowerShell ishonchliroq).

**Simlar orasida tozalash (avvalgidan KENGAYTIRILGAN — §5.6):**
```bash
docker exec tty_redis redis-cli FLUSHALL
docker exec tty_postgres psql -U tty -d tty -c \
  "UPDATE orders SET status='CLOSED_BY_OPERATOR' WHERE status IN ('CREATED','DISPATCHING','NO_DRIVER');"
```
(Eski `--scan --pattern 'geo:drivers:*'` usuli ham ishlaydi, lekin
`FLUSHALL` + orders tozalash ancha ishonchliroq — `recoverOrphans()`
eskirgan zakazlarni ham qayta tiklashi mumkinligini unutmang.)

**Yangi simlar (shu sessiyada yozilgan):**
```
sim:customer-addresses   # scripts/customer-addresses-sim.mjs — 14 tekshiruv
sim:seat-filter          # scripts/seat-filter-sim.mjs — 11 tekshiruv
```
Ikkalasi ham `TELEGRAM_BOT_USERNAME` sozlangan API talab qiladi
(customer-auth oqimidan foydalanadi).

Unit: api **80** (o'zgarmagan — bu sessiyaning o'zgarishlari asosan
integratsiya darajasida, sim bilan qoplangan).

---

## 7. Arxitektura qarorlari (nega aynan shunday)

Avvalgi qarorlar (dispatch egaligi, Redis geo-indeks, WS interceptor,
CORS adapter darajasida, Mini App guard'siz, bot↔API pub/sub, balans
manfiyga o'tishi, kutish chegarasi narx hisobida, `makeT` keshlash) —
**o'zgarmagan**, git tarixida to'liq matn bor.

**Yangi qarorlar (shu sessiyada):**
- **Sig'im mashinaga bog'lanadi, toifaga emas.** Chunki bitta toifa
  ichida turli sig'imdagi mashinalar yuradi (Standartda Damas HAM,
  Cobalt/Nexia HAM bor).
- **Taklif muddati — mahsulot qarori bilan olib tashlandi**, texnik
  majburiyat emas. Xavfi ochiq aytilgan (aloqa uzilgan haydovchida
  zakaz operatorgacha "osilib" qolishi mumkin) — foydalanuvchi buni
  bilib tanlagan.
- **APK'lar git branch orqali tarqatiladi** (asosiy branch'ni
  shishirmasdan) — chunki foydalanuvchi USB orqali ulanolmaydi
  (telefondan boshqaradi), boshqa yetkazish kanali yo'q.

---

## 8. Sinov tartibi

O'zgarmagan (APK o'rnatish → Onlayn → bot/mini-app/ilovadan buyurtma →
taklif → qabul → safar bosqichlari), faqat endi:
- Haydovchi ilovasida taklif muddati YO'Q — cheksiz kutishi mumkin.
- Mijoz ilovasida "Taksi topilmadi" holatida ENDI bekor qilish tugmasi
  chiqadi va ishlaydi.
- Mijoz ilovasida pastki tab panel bor — Buyurtmalar (tarix) va
  Kabinet (profil, til, chiqish) ni ham sinang.

**Muammo bo'lsa — diagnostika loglarda (o'zgarmagan):**
```bash
railway logs --service api | grep "Nomzod topilmadi"
railway logs --service api | grep "bekor qildi"
```
