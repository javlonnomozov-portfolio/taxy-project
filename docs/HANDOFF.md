# Toy TaxY (TTY) — yangi chat uchun davom ettirish hujjati

> **Holat:** 2026-08-31 · **Branch:** `main` (toza, `origin/main` bilan bir xil)
> **Oxirgi commit:** `7cc0dca` (merge) · **Repo:** `d:\toy-taxy` (Windows, VSCode)
>
> Bu faylni yangi chatga tashlang va "davom et" deng.

---

## 0. HOZIRGI VAZIYAT — birinchi shuni o'qing

### 0.1 IKKI MASHINA TARMOQLANIB KETGAN EDI — birlashtirildi

Bu sessiyaning eng muhim topilmasi. **Ayni bir vazifa ikki mashinada
mustaqil bajarilgan edi:**

- **Linux mashinasi** (`/home/javlon/Documents/GitHub/taxy-project`)
  `e93898d` dan tarmoqlanib mijoz ilovasini Figma maketi bo'yicha qayta
  qurgan (`ed8a56d`) va `origin/main` ga push qilgan.
- **Windows mashinasi** (`d:\toy-taxy`) da esa 2026-08-23 sessiyasining
  **48 ta commit qilinmagan fayli** turgan edi — u ham mijoz ilovasini
  qayta qurgan, ustiga backend ishi ham bor edi.

`git push` `non-fast-forward` bilan rad etilganda bu aniqlandi.

**Qaysi backend prod'da turgani PROD SO'ROVI bilan hal qilindi** (taxmin
bilan emas — bu qoida keyingi safar ham ishlaydi):

```bash
for p in /health /customer/tariffs /customer/addresses /customer/history; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$API$p")  $p"
done
```

404 = endpoint yo'q, 401 = bor (avtorizatsiya so'ryapti). O'sha paytda
`/customer/tariffs` 401, qolganlari 404 edi → prod'da **uzoqdagi** backend
turgan, lokal HANDOFF'dagi "deploy qilingan" degani **eskirgan**.

**Birlashtirish natijasi** (`7cc0dca`, foydalanuvchi tasdiqlagan):

| Qayerdan | Nima olindi |
|---|---|
| `origin/main` | Maketning ANIQ ranglari, Figma'dan eksport qilingan mashina rasmlari, `CategoryCard`, `.env` yo'lini aniq ko'rsatish (`app.module`/`data-source`), haydovchi ilovasining kattaroq `MapView`'i |
| Windows | Buyurtmalar/Profil ekranlari, Uy/Ish manzillar, panel ostida qolmaydigan pin, sig'im filtri, `NO_DRIVER` bekor qilish, taklif muddatini olib tashlash |

### 0.2 Mijoz ilovasi — Figma maketi bo'yicha (TUGALLANDI)

Maket: `figma.com/design/8RflGALB1D3QfFWy9id1XG` → **"rider app"** bo'limi
(9 ta ekran). O'lchamlar 1080 px kenglikda chizilgan → **uchga bo'linadi**
(360 dp) va `src/theme.ts` dagi `L` blokida turadi.

**Tuzilma:** endi BITTA xarita ekrani, pastki panel esa zakaz holatiga
qarab o'zgaradi (tanlash → qidirish → haydovchi → yakun). Avval haydovchi
topilgach alohida scroll sahifaga o'tilardi va xarita kichkina oynachaga
siqilardi.

**Maketning kamchiliklari ATAYLAB tuzatildi** (ko'r-ko'rona ko'chirilmadi):

1. Maketda xaritadan Buyurtmalar/Profil'ga o'tish yo'li YO'Q edi (tab
   paneli ham chizilmagan) → asosiy tugma yonidagi kvadrat tugma shu
   vazifani oldi.
2. Maketda "Chiqish" tugmasi yo'q → hisobdan chiqishning boshqa yo'li
   bo'lmagani uchun Profil ekranida qoldirildi.
3. "5+" o'zi yetarli emas: 7 kishilik guruh 5 o'rinli mashinaga tushib
   qolardi → "5+" tanlanganda aniq son (5..8) so'raladi.
4. "1ta - 4ta" da yo'lovchilar soni serverga **umuman yuborilmaydi**
   (bot oqimi bilan bir xil) — aks holda haydovchi noto'g'ri son ko'rardi.
5. Kartada 3 000, tugmada 4000 deb yozilgan edi → ikkalasi bitta manbadan
   (`GET /customer/tariffs`, narx bo'yicha saralangan).
6. Maketda saqlangan Uy/Ish yo'q edi; ishlab turgan funksiya panelga emas,
   **xarita ustiga** chiqarildi — panel maketdagidek qoldi.

**Xaritadagi haqiqiy nuqson tuzatildi:** pin ekran MARKAZIDA turardi, ya'ni
ochiq panel ORTIDA qolardi — mijoz tanlayotgan nuqtasini ko'rmasdi. Endi
panel balandligi `onLayout` bilan o'lchanadi, `PickupPicker.bottomInset`
orqali WebView'ga uzatiladi, pin ko'rinadigan maydon markazida turadi va
tanlangan nuqta `map.getCenter()` emas, `containerPointToLatLng` bilan
olinadi.

### 0.3 Figma MCP kvotasi — oyiga 20 ta, HAR OY TIKLANADI

Figma **Starter** planida MCP uchun **oyiga 20 ta o'qish chaqiruvi** (seat
turidan qat'i nazar). 2026-08-31 da tugagan edi, 2026-09-11 da tiklangan —
ya'ni bu qattiq to'siq emas, oy boshini kutish kifoya.

**Kvotani tejash tartibi** (shu sessiyada 5 ta chaqiruvda hammasi olindi):

1. `get_screenshot` BUTUN bo'lim ustida (`111:378`, `maxDimension: 2600`) —
   bitta chaqiruvda 9 ta ekran ko'rinadi. Har ekranga alohida chaqirmang.
2. `get_design_context` faqat NOYOB ekranlarga. Maketda 6 ta bir xil
   "Client - standart" bor — ulardan BITTASI yetadi.
3. SVG/PNG manzillari javobning o'zida qaytadi — ularni `curl` bilan
   yuklab oling, `download_assets` ga alohida chaqiruv SARFLAMANG.

**Ekranlarning node ID'lari** (fayl `8RflGALB1D3QfFWy9id1XG`):

| Ekran | node-id |
|---|---|
| Butun "rider app" bo'limi | `111:378` |
| Buyurtma berish (xarita + panel) | `111:379` |
| Taksi qidirilmoqda | `111:717` |
| Buyurtmalar (tarix) | `111:733` |
| Profil | `111:673` |

**Maketdan olingan HAMMA qiymat `apps/customer-app/src/theme.ts` da** —
`C` (ranglar), `F` (shriftlar), `L` (o'lchamlar). Har biri yonida maketdagi
asl piksel qiymati izohda turibdi (maket 1080 px, telefon 360 dp — hamma
son UCHGA BO'LINGAN). Qayta Figma'ga kirish SHART EMAS: rang yoki o'lcham
kerak bo'lsa shu fayldan oling.

**Maketning ataylab tuzatilgan kamchiliklari** (qayta "tuzatmang"):

- Toifa narxi maketda 8 dp — telefonda o'qib bo'lmaydi, 10 ga oshirildi.
- Bekor qilingan buyurtmada "0 so'm" maketda OQ rangda, ya'ni ko'rinmaydi.
  Narx endi faqat yakunlangan safarda chiqadi.
- Panel radiusi maketda assimetrik (chapda 70, o'ngda 87) — 26 dp o'rtacha.
- "Chiqish" tugmasi maketda yo'q — hisobdan chiqishning boshqa yo'li
  bo'lmagani uchun Profil ekranida qoldirildi.
- "5+" tanlanganda aniq son (5..8) so'raladi — usiz 7 kishilik guruh
  5 o'rinli mashinaga tushib qolardi.

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
| **api** | https://api-production-13444.up.railway.app · `/health` ok · **2026-08-31 da `7cc0dca` dan deploy qilingan** · barcha `/customer/*` endpointlar bor (`/tariffs`, `/addresses`, `/history`, `/profile` GET+PUT, `/active`, `/orders/*`) · migratsiya 11 |
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

### Eng ustuvor

1. **APK'ni qurilmada sinash** — birlashtirilgandan keyingi birinchi build.
   Alohida diqqat: (a) pin ochiq panel ustida turibdimi, (b) "5+" tanlanganda
   aniq son chiqadimi, (c) Kabinet → Profil'da ism/familiya/telefon/til
   saqlanyaptimi (`PUT /customer/profile`), (d) Uy/Ish tugmalari ishlayaptimi.
2. **`docs/CUSTOMER-APP-PLAN.md` eskirgan** — u hali "faqat 1-bosqich
   bajarilgan" deb yozilgan, aslida Tarix, Kabinet, manzillar ham tayyor.
3. **Boshqa mashinada davom etilsa — AVVAL `git pull`.** §5.9 ga qarang:
   bu sessiyada aynan shu qilinmagani uchun bir xil ish ikki marta bajarildi.

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
10. **Mini app dizayni mijoz ilovasiga moslanmagan.** Struktura allaqachon
    bir xil — `miniapp.page.ts` da xarita, markaziy pin (`#centerPin`),
    toifa kartalari va kuzatuv paneli bor. Faqat ko'rinish farq qiladi:

    | | Mini app hozir | Mijoz ilovasi |
    |---|---|---|
    | Fon | `#0A0F1E` (to'q) | `#FFFFFF` |
    | Asosiy rang | `#5B8DEF` (ko'k) | `#0CAF50` (yashil) |
    | Xarita | 62% balandlik | to'liq ekran, karta suzadi |
    | Yo'lovchilar tanlagichi | yo'q | bor |
    | Toifa | matnli tugmacha | rasmli karta |

    Ya'ni bu **qayta qurish emas, palitra + joylashuv** ishi, bitta faylda.
    Foydalanuvchi APK dizaynini tasdiqlagach boshlanadi (2026-09-09 kelishuvi).

### 🗑 Eskirgan remote tarmoqlar — MERGE QILMANG

`git branch -r` da 4 ta ortiqcha tarmoq bor. 2026-09-09da tekshirildi:

- **`fix/bot-address-flow`** (`941b1b9`) — **o'lik.** Nominatim orqali manzil
  qidirish oqimini tuzatadi, lekin o'sha oqim `main`dan ataylab olib
  tashlangan (pastdagi "BEKOR QILINDI" bandi). Botda `nominatim`/`geocode`
  bitta ham uchramaydi; mini app pin bilan ishlaydi. Merge qilinsa
  geokodlash qaytib keladi. Saqlashga narsa yo'q — undagi CI qadami ham
  faqat o'sha simni ishga tushiradi.
- **`chore/reliability-and-observability`** — allaqachon `main`da, PR #1
  (`b0fd7c9`) sifatida squash qilingan. `race-sim.mjs`, `security-sim.mjs`
  joyida turibdi.
- **`apk/customer-preview`, `apk/driver-preview`** — faqat 65 MB'lik APK
  fayllari, manba kodi yo'q. Tarqatish endi GitHub Release orqali.

O'chirsa bo'ladi; SHA'lar shu yerda qolgani uchun keyin ham tiklanadi.

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

## 4. Mijoz ilovasi — fayl bo'yicha xarita

| Ish | Asosiy fayllar |
|---|---|
| Dizayn tokenlari (rang, shrift, maket o'lchamlari `L`) | `apps/customer-app/src/theme.ts` — **rang/o'lcham o'zgarsa FAQAT shu fayl** |
| Xarita ekrani + holatga qarab o'zgaruvchi panel | `src/screens/HomeScreen.tsx` (`Sheet`, `Cta`, `SquareBtn`, `Segment`, `FloatBtn`) |
| Panel ustida turadigan pin | `src/MapView.tsx` → `PickupPicker` (`bottomInset`, `__setInset`, `containerPointToLatLng`) |
| Kuzatuv xaritasi (to'liq ekran, markerlar) | `src/MapView.tsx` → `LiveMap` |
| Toifa kartasi (maketdagi mashina rasmlari) | `src/CategoryCard.tsx`, `assets/cars/*.png` |
| Kabinet (Buyurtmalar + Profil) | `src/screens/AccountScreen.tsx`, `HistoryScreen.tsx`, `ProfileScreen.tsx` |
| Profilni tahrirlash | `apps/api/src/customers/customer-app.controller.ts` (`PUT /customer/profile`), `customers.service.ts` (`updateProfile`) |
| Saqlangan Uy/Ish | `customers.service.ts`, migratsiya `1722700000000-CustomerSavedAddresses` |
| Sig'im filtri | `dispatch.service.ts` (`filterBySeats`), migratsiya `1722800000000-VehicleSeats`, admin `Drivers.tsx` |

**Navigatsiya:** `App.tsx` da 4 ta ekran — `loading / login / home / account`.
Pastki tab paneli **YO'Q** (maketda ham yo'q, `TabBar.tsx` o'chirildi):
xaritadan Kabinetga asosiy tugma yonidagi kvadrat tugma orqali o'tiladi,
Kabinetdan xaritaga — sarlavhadagi uy tugmasi orqali.

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

### 5.9 Ish boshlashdan OLDIN `git fetch` — bu sessiyada bir ish ikki marta qilindi

Windows mashinasida 48 ta commit qilinmagan fayl turgani sababli
`origin/main` bilan solishtirish qilinmagan edi. Linux mashinasi shu orada
AYNI vazifani (mijoz ilovasini Figma bo'yicha qayta qurish) bajarib push
qilgan. Buni faqat `git push` rad etganda bildik — ya'ni butun ish
tugagandan **keyin**.

**Qoida:** har sessiya boshida, hatto ishchi papka iflos bo'lsa ham:
```bash
git fetch origin && git log --oneline -5 origin/main && git status --short
```
Lokal HANDOFF "oxirgi commit X" desa, `origin/main` dagi bilan solishtiring.

**Ikkinchi qoida — HANDOFF'ga ishonmang, PROD'DAN so'rang.** Lokal HANDOFF
"backend deploy qilingan" der edi, aslida uning ustidan boshqa mashina
deploy qilgan. Endpoint bor-yo'qligini bir qatorda tekshirish mumkin
(404 = yo'q, 401 = bor) — §0.1 dagi skript.

**Uchinchi:** ikki tarmoq bir vaqtda migratsiya qo'shsa, **timestamp
to'qnashadi** (ikkalasi ham `1722600000000` olgan edi). Birlashtirganda:
prod'da ALLAQACHON qo'llanganini tegmang (uning nomi `migrations` jadvalida
yozilgan), qo'llanmaganini surib qo'ying. Va bitta ustunga ikki migratsiya
egalik qilmasin — `down()` da biri ikkinchisining ustunini o'chirib
yuboradi.

### 5.10 Figma MCP: kvota tor, `get_metadata` eng arzon chaqiruv

Starter planida MCP uchun **oyiga 20 ta o'qish chaqiruvi** (§0.3).
`get_screenshot` ni har ekran uchun alohida chaqirish kvotani darhol
tugatadi.

`get_metadata` bitta chaqiruvda butun sahifaning XML tuzilmasini beradi:
har frame, matn, koordinata va o'lcham. Undan **matnlar, joylashuv va
o'lchamlarni** to'liq olish mumkin — ya'ni maketning 80% i. Bermaydigani:
**ranglar va rasmlar**. Shuning uchun tartib: avval bitta `get_metadata`
(butun sahifa), keyin kvota qolsa faqat ranglar uchun bitta
`get_screenshot`.

### 5.11 Template literal ichidagi izohda backtick — satrni erta yopadi

`MapView.tsx` da WebView HTML'i template literal ichida yozilgan. Ichkaridagi
JS izohiga backtick qo'yilsa (`` // `inset` (panel balandligi) ``) u
template literal'ni TUGATADI va TypeScript tushunarsiz joyda
`TS1005: ';' expected` beradi. Izohlarda oddiy tirnoq ishlating.

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

### 6.1 APK'ni Windows'da LOKAL yig'ish (EAS'siz) — ishlaydi

`eas build --local` Windows'da ishlamaydi ("macOS or Linux is required"),
lekin **EAS umuman kerak emas**: `expo prebuild` + Gradle to'liq ishlaydi.
Bu 2026-08-31 da sinab ko'rildi va APK shu yo'l bilan yig'ildi (EAS hisobi
`jav1on` ga kirish yo'q edi — §6.2).

**Bu mashinadagi tuzoqlar (ikkalasi ham build'ni yiqitadi):**

1. **`JAVA_HOME` NOTO'G'RI:** `C:\Program Files\Java\jdk-17` — bunday
   katalog YO'Q. `java -version` esa ishlaydi, chunki PATH'dagi java
   boshqa joyda. Haqiqiy JDK:
   `C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot`
2. **`ANDROID_HOME` o'rnatilmagan.** SDK bor:
   `%LOCALAPPDATA%\Android\Sdk` (build-tools 34.0.0 + platform android-34
   — Expo SDK 51 uchun aynan keraklisi).

3. **NDK versiyasi mos kelmaydi.** RN 0.74/Expo 51 shabloni
   `ndkVersion = "26.1.10909125"` so'raydi, bu mashinada esa `27.1.12297006`
   o'rnatilgan. Undan ham yomoni: 2026-08-31 dagi uzilib qolgan build
   `ndk/26.1.10909125/` papkasini BO'SH holda qoldirgan (ichida faqat
   `.installer/`), shuning uchun AGP uni "bor" deb topadi-yu, keyin
   yiqiladi:
   ```
   [CXX1101] NDK at <SDK>/ndk/26.1.10909125 did not have a source.properties file
   ```
   Yechim — bo'sh papkani chetga surib, `android/build.gradle` dagi
   `ndkVersion` ni o'rnatilganiga o'zgartirish. Muqobil yo'l: AGP'ga
   26.1 ni qayta yuklatish (~700 MB, cmdline-tools o'rnatilmagani uchun
   `sdkmanager` YO'Q).

   ⚠️ `android/` `.gitignore` da, ya'ni **har `expo prebuild` dan keyin bu
   tuzatish yo'qoladi va qaytadan qo'llanadi.** Doimiy yechim —
   `expo-build-properties` plaginini qo'shib `ndkVersion` ni `app.json` ga
   ko'chirish (yangi bog'liqlik, hali qilinmagan).

**Retsept (PowerShell):**
```powershell
cd D:\toy-taxy\apps\customer-app
npx expo prebuild --platform android --no-install   # android/ yaratadi

$env:ANDROID_HOME     = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME        = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"

# android/local.properties KERAK (prebuild uni yaratmaydi):
#   sdk.dir=C\:\Users\Javlon\AppData\Local\Android\Sdk

cd android
.\gradlew.bat assembleRelease --no-daemon --console=plain
# natija: android/app/build/outputs/apk/release/app-release.apk
```

`android/` papkasi `.gitignore` da (ikkala ilova uchun ham) — repo
shishmasin. Uni O'CHIRMANG: qayta build ancha tez bo'ladi.

### 6.2 ⚠️ Lokal APK IMZOSI EAS'nikidan BOSHQA

Expo shabloni release'ni ham `android/app/debug.keystore` bilan imzolaydi
(build.gradle: `release { signingConfig signingConfigs.debug }`).

**Oqibatlari:**
- EAS bilan qurilgan eski ilova ustiga **o'rnatilmaydi** — foydalanuvchi
  avval eskisini o'chirishi kerak (bir marta).
- Lokal build'lar O'ZARO mos: `debug.keystore` shablonda qat'iy fayl,
  har prebuild'da bir xil — ya'ni keyingi lokal APK'lar ustiga tushadi.
- **Play Market uchun YARAMAYDI** — u debug kalit bilan imzolangan APK'ni
  qabul qilmaydi. Reliz uchun alohida keystore kerak (yoki EAS).

### 6.3 EAS hisobi: `jav1on`, `javl9n` EMAS

`app.json` → `owner: jav1on`, projectId `c3ad9431-a59d-4076-b067-002b1b96b9de`
(haydovchi: `862b155e-1193-4c77-87fb-0cb63e29ee9e`).

`javl9n` — ESKI hisob, build limiti tugagan (2026-08-01 da ko'chirilgan).
Uning tokeni bilan `eas project:info` shunday xato beradi:
```
Entity not authorized: AppEntity[c3ad9431-…] (action = READ)
```
Token so'raganda **`jav1on` bilan kirilganini** tekshiring —
`eas whoami` ro'yxatida `jav1on` ko'rinishi shart.

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
