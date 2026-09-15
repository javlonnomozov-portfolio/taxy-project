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

### ❌ 2026-09-12 maketidan RAD ETILGAN elementlar (qayta qo'shilmasin)

Foydalanuvchi yangi maket yubordi va "ortiqcha qismlarini tashlab ket" dedi.
To'rt yangi elementdan FAQAT "Profil" tugmasi tasdiqlandi. Qolgan uchtasi
ataylab qilinmadi — ular quyidagi qarorlarga zid:

- **Kartada sig'im belgisi ("1-4")** — sig'im TOIFAGA emas, MASHINAGA
  bog'langan (§7). Standartda Damas (7) ham, Nexia (4) ham yuradi, ya'ni
  toifaga yozilgan son yolg'on bo'lardi. Ustiga `/customer/tariffs` javobida
  `seats` yo'q.
- **"Address location" qidiruv qatori** — manzilni nomi bo'yicha qidirish
  bekor qilingan, `NOMINATIM_URL` ataylab bo'sh.
- **"Yurish/Nogiron" uchinchi bo'lak** — serverda bunday tushuncha yo'q:
  yangi ustun, migratsiya va dispatch mantig'i kerak. Bu dizayn emas,
  YANGI FUNKSIYA.

### ✅ Bekor qilingan buyurtma — darhol asosiy ekranga (2026-09-12)

Avval bekor qilingan safar boshi berk ko'chaga olib borardi: ilovada
"Yangi buyurtma" tugmasi, mini appda esa ekran QOTIB qolardi (qaytish yo'li
umuman yo'q edi). Endi ikkala kanalda ham sabab aytilib, darhol buyurtma
ekraniga qaytadi. Sabab MAJBURIY: haydovchi bekor qilganda jimgina
qaytarish chalkash bo'lardi. "Yangi buyurtma" faqat YAKUNLANGAN safarda
qoladi — u yerda narx va baho bor.

### ✅ Mini appda profil bor, tarix YO'Q (2026-09-12)

`POST /miniapp/profile` va `POST /miniapp/profile/save` — ism, familiya,
telefon, til. `/customer/profile` JWT talab qiladi, mini app esa `initData`
bilan ishlaydi, shuning uchun alohida marshrut. MANTIQ TAKRORLANMAYDI:
ikkalasi ham `CustomersService.updateProfile` ga tushadi.

Buyurtmalar tarixi mini appga ATAYLAB qo'shilmadi (foydalanuvchi qarori) —
u faqat ilovada.

### ✅ Narx modeli va toifalar — kelishilgan qarorlar (2026-09-13)

Foydalanuvchi bilan kelishildi, qayta ochilmasin:

| Qaror | Qanday | Nega |
|---|---|---|
| **Comfort mashina Standart zakazni ham oladi** | `servedCategories()` (`dispatch.util.ts`) — Comfort haydovchi `geo:drivers:comfort` va `geo:drivers:standard` ikkalasida turadi | Kichik shaharda toifani qat'iy ajratish "taksi topilmadi" degani. 2026-09-13 da aynan shu sabab Standart zakaz Comfort haydovchiga ko'rinmagan |
| Bir tomonlama | Standart mashina Comfort zakazni **ko'rmaydi**, Yuk butunlay alohida | Aks holda Comfort toifasi ma'nosini yo'qotadi |
| **Narx mijoz tanlagan toifa bo'yicha** | `trips.complete()` `order.vehicleCategory` ni ishlatadi — kod o'zgarmadi | Mijozga Standart narx ko'rsatilgan; Comfort mashina kelgani uchun qimmat olish — aldash |
| Haydovchi ilovasida rang | Comfort zakaz — **oltin** (`C.premium` #B78108, krem fon, chap chiziq, COMFORT chipi), Standart — oddiy yashil | Bir ro'yxatda ikki xil pullik zakaz turadi, haydovchi bir qarashda ajratsin |
| **Surge toifa bo'yicha** | `tariffs.surge_multiplier`; global `surgeActive` — bosh kalit | Standart taqchilligi Yuk narxini ko'tarmasin. Migratsiya global qiymatni har toifaga ko'chirgan |
| Tungi soatlar panelda | `nightFrom`/`nightTo` Sozlamalar jadvalida | Avval faqat SQL bilan o'zgarardi |
| **Operator narxni tuzatadi** | `POST /ops/orders/:id/fare` `{amount, reason}` → `orders.fare_adjustment` | Yuk, uzoq kutish kabi kelishuvlar pul tizimdan TASHQARIDA olinardi |
| Qo'shimcha koeffitsientga ko'paytirilmaydi | `total = max(0, taksometr × tungi × surge + qo'shimcha)` | Kelishilgan "yuk uchun 5 000" tunda 6 000 ga aylanmasin |
| Toifa o'zgartirilmaydi, qo'shimcha qo'shiladi | — | Toifani almashtirish safar o'rtasida taksometrni sakratadi |
| Faqat FAOL zakazda, sabab majburiy | server 400 qaytaradi | Yakunlangan narx mijozga aytilgan va komissiya yechilgan |
| OPERATOR ham qila oladi (admin shart emas) | `@Roles(OPERATOR, ...)`, `order_events` ga `fare_adjusted` yoziladi | Mijoz bilan telefonda aynan operator gaplashadi |

**Qayerda ko'rinadi:** admin → Zakazlar (ustun + "Narxni tuzatish"), haydovchi
ilovasi (to'q sariq karta + taksometrga qo'shilgan, `announcement` soket
hodisasi — avval ilova uni UMUMAN tinglamasdi), mijoz ilovasi va mini app
(yakuniy narx ostida alohida qator).

**Tarif endpointi endi validatsiyali** (`UpdateTariffDto`) — avval
`Record<string, number>` bo'lib, tana to'g'ridan entity'ga yozilardi.

**Simlar:** `sim:category-overlap` (15), `sim:fare-adjustment` (12).

> ⚠️ **Sim yozishda tuzoq:** `driver:offer_response` handleri **ack
> qaytarmaydi** (trip:* esa `{ ok: true }` qaytaradi). Uni `await emit(...)`
> qilgan sim hech qanday xatosiz ABADIY qotib qoladi. Yangi simlarda
> `emit` ga muddat qo'yilgan — shu naqshdan foydalaning.

> ⚠️ **Dispatch log'idagi "Nomzod topilmadi" har doim ham nosozlik emas.**
> U oyna (`windowSize`) to'lmay qolganda ham chiqadi — masalan 2 ta
> haydovchi bor, oyna 6 ta. Haqiqiy "hech kimga taklif ketmadi" holati —
> faqat `NO_DRIVER` statusi.

### ✅ Haydovchi ↔ panel chati (2026-09-13)

**Foydalanuvchi talabi:** haydovchi ilovasida admin bilan chat — matn, ovozli
xabar, rasm. Panelda xaritadan haydovchini bosganda oyna ochiladi: holat,
reyting va shu haydovchi bilan chat.

| Qaror | Qanday | Nega |
|---|---|---|
| Fayllar **Postgres ichida** | `chat_media` (bytea, `select: false`) + `driver_messages` | Foydalanuvchi tanladi: yangi hisob/bog'liqlik yo'q. Baytlar alohida jadvalda — ro'yxat megabaytlarni tortmasin |
| Har haydovchi bilan **bitta** suhbat, barcha panel rollari ko'radi va yozadi | `/ops/chat/*` — OPERATOR, ADMIN, SUPER_ADMIN; har xabarda `author_login` | Kechasi ham navbatchi javob bera olsin. Cheklash kerak bo'lsa — faqat `@Roles` |
| Fayl turi **baytlardan** aniqlanadi | `chat/chat.media.ts` (`sniffMime`) | Klient `Content-Type` iga ishonilmaydi: rasm deb yuborilgan SVG/HTML panelda skript bo'lib ochilardi. SVG qo'llanmaydi |
| Chegaralar | fayl 2 MB (multer, 413), ovoz 90 s, matn 2000, daqiqasiga 20 xabar (Redis, 429) | Tasodifiy tugma yoki skript chatni ko'mmasin |
| Begona fayl — **404**, 403 emas | `ChatService.media` | Fayl mavjudligini ham oshkor qilmaymiz |
| Panelda rasm/ovoz blob orqali | `DriverWindow.tsx` `MediaView` | `<img src>` Bearer yubormaydi; tokenni havolaga yozish uni tarix va proksi loglariga chiqarardi |

**Panel:** `apps/admin/src/pages/DriverWindow.tsx` — `DriverWindow` (xaritada
haydovchi bosilganda: holat, reyting, mashina, bugungi safar/daromad, balans,
stavkalar, faol zakaz, chat) va `ChatInbox` (haydovchi tanlanmaganda —
suhbatlar ro'yxati; oflayn haydovchi xaritada yo'q, unga shu yerdan kiriladi).
Yangi xabar kelganda Dashboard toast chiqaradi.

**API:** haydovchi `GET/POST /chat/messages`, `POST /chat/media` (multipart:
`file`, `kind`, `durationSec`), `POST /chat/read`, `GET /chat/unread`,
`GET /chat/media/:id`. Panel: `/ops/chat/conversations`,
`/ops/chat/drivers/:id/{summary,messages,media,read}`, `/ops/chat/media/:id`.
Soket: `chat:message`, `chat:read` (haydovchi xonasi + `ops`).

**Sim:** `sim:driver-chat` — 23 tekshiruv.

**Rollar (holat):** kodda 3 ta — `super_admin`, `admin`, `operator`. Akkauntni
FAQAT `super_admin` API orqali yaratadi (`POST /ops/admins`); panelda buning
sahifasi ham, ro'yxat endpointi ham YO'Q.

> ⚠️ **Tuzatilgan jiddiy nuqson (prod'da ham bor edi):** `AllExceptionsFilter`
> `payload.error` ni doim matn deb `.replace` qilardi. `@nestjs/terminus` health
> tekshiruvi 503 da unga OBYEKT qo'yadi — filtr ichidagi xato butun jarayonni
> o'ldirardi. Ya'ni baza bir lahza sekinlashsa (health 3 s timeout) API QULARDI.
> 2026-09-13 da lokal API aynan shunday yiqildi (fonda Gradle bazani
> sekinlashtirgan). Endi faqat `typeof === 'string'` bo'lsa ishlatiladi, test bor.

### ✅ Parol tiklash va admin xabari uchun push (2026-09-14)

**Parolni tiklash.** Operator haydovchining parolini bilmaydi va tiklash yo'li
YO'Q edi — shuning uchun Damasli haydovchi 2026-09-13 da BLOKLANGAN (kira
olmagani uchun), ya'ni Standart toifa bitta mashinasiz qolgan.

`POST /ops/drivers/:id/reset-password` (ADMIN+) bir martalik parol qaytaradi;
panelda Haydovchilar sahifasidagi "Parolni tiklash" tugmasi uni bir marta
ko'rsatadi (nusxalash tugmasi bilan) va qayta so'rab bo'lmaydi — bazada
bcrypt hash turadi. `mustChangePassword` yoqiladi.

> Mavjud sessiyalar ATAYLAB uzilmaydi: haydovchi safarda bo'lishi mumkin, uni
> yo'l o'rtasida chiqarish zakazni yo'qotardi. Telefon yo'qolgan holatda
> avval BLOKLANADI (u soketlarni uzadi), keyin parol tiklanadi.

Sim: `sim:password-reset` — 8 tekshiruv, jumladan "eski parol endi ishlamaydi",
tokensiz 401 va haydovchi tokeni bilan 403.

**Admin xabari uchun push.** Chatda FAQAT panel yozganda haydovchiga Expo push
ketadi (`ChatService.publish`) — foydalanuvchi qarori. Ilova yopiq bo'lsa
soket yo'q, xabar faqat shu yo'l bilan yetadi. Push kanali mavjud `orders`
kanalidan foydalanadi — alohida "chat" kanali ilovaga yangi build talab
qilardi.

### ✅ Mijoz ilovasi: 5 s polling o'rniga soket (2026-09-14)

Ilova zakaz holatini har 5 soniyada so'rardi — safar davomida yuzlab so'rov,
batareya va server yuki.

**Tuzoq:** jonli kanal (`/customer`) bor edi, lekin u FAQAT `INTERNAL_API_KEY`
bilan ochilardi — u bot backend uchun mo'ljallangan. Kalitni ilovaga qo'yib
bo'lmaydi: u butun ichki API'ni ochadi va APK ichidan chiqarib olinadi.
Shuning uchun `customer.gateway.ts` ga MIJOZ JWT'si bilan ulanish yo'li
qo'shildi (rol tekshiruvi + `AccountStatusService`). Ichki kalit yo'li
o'zgarmadi — bot avvalgidek ishlaydi.

**Ilovada:** `src/socket.ts` → `order:status` kelganda darhol
`GET /customer/orders/:id` (yagona haqiqat manbai baribir server javobi),
`driver:location` esa to'g'ridan xaritaga tushadi. Poll 5 s → **30 s**,
ya'ni zaxira yo'l bo'lib qoldi.

> `tick()` boshida `stop()` SHART: soket ham, taymer ham uni chaqiradi —
> aks holda har hodisada yangi zanjir qo'shilib, so'rovlar ko'payib ketardi.

Sim: `sim:customer-socket` — 8 tekshiruv (tokensiz/buzuq token/haydovchi
tokeni UZILADI; holat o'zgarishi so'rovsiz yetib keladi).

### ✅ Comfort topilmasa Standartga o'tkazish; haydovchilar qidiruvi va oynasi; chat push'i (2026-09-14)

**Comfort → Standart.** Comfort mashinalar kam; Comfort zakaz NO_DRIVER'da
qolib ketardi, holbuki bo'sh Standart mashina bor. Endi NO_DRIVER + Comfort
bo'lsa server `canSwitchToStandard: true` qaytaradi va tugma chiqadi:

| Kanal | Qayerda | Yo'l |
|---|---|---|
| Mijoz ilovasi | NO_DRIVER varag'i | `POST /customer/orders/:id/switch-standard` |
| Mini app | holat varag'i | `POST /miniapp/switch-standard` |
| Bot | "taksi topilmadi" xabarida inline tugma (`order:std:<id>`) | `POST /orders/:id/switch-standard` (ichki kalit) |
| Panel | Dashboard zakaz qatori | `POST /ops/orders/:id/switch-standard` (operator+) |

Yadro: `DispatchService.switchToStandard` — Comfort + (NO_DRIVER yoki DISPATCHING);
holat va toifa BITTA atomik so'rovda (`→CREATED`, `comfort→standard`),
operator taymeri bekor qilinadi, `category_changed` hodisasi yoziladi, `start()`.
Mijozning boshqa faol zakazi bo'lsa 409. Narx Standart bo'yicha tushadi — matnda
OCHIQ aytiladi. Bot'da tugmada zakaz id bor, chunki NO_DRIVER'da sessiyadagi
`activeOrderId` allaqachon bo'shatilgan. Sim: `sim:comfort-fallback`.

**2026-09-15 yangilanishi — taklif qidiruv TO'XTASHINI kutmaydi.** Mijoz skrinshot
yubordi: Comfort zakazda faqat "Taksi topilmadi" + "Bekor qilish". Ikki sabab:
(1) qurilmada eski ilova (v5 dan oldin); (2) **loyiha nuqsoni** — Comfort
haydovchi onlayn bo'lib taklifga javob bermasa, taklif muddatsiz turadi, zakaz
hech qachon NO_DRIVER'ga tushmaydi va tugma umuman chiqmasdi.

| Qoida | Qayerda | Nega |
|---|---|---|
| Taklif Comfort + DISPATCHING'da `COMFORT_SUGGEST_AFTER_SEC` (sukut 60) dan keyin, NO_DRIVER'da darhol | `dispatch.util.ts` `standardSuggestAt` / `canSuggestStandard` | Foydalanuvchi qarori: "topilmasa tavsiya berilsin va Comfort izlashda davom etsin" |
| Taklif chiqqanda Comfort qidiruvi TO'XTAMAYDI; sarlavha "Comfort qidirilmoqda…" | ilova, mini app | "Taksi topilmadi" yakuniy eshitiladi — mijoz kutishni bas qilardi |
| `track` javobida `standardSuggestAt` (ISO) | `customer-orders.service.ts` | Qidiruv davomida holat o'zgarmaydi va soket jim — ilova aynan shu vaqtda so'raydi, 30 s zaxira pollni kutmaydi |
| DISPATCHING'da o'tkazish: avval atomik UPDATE, KEYIN `abort()` | `switchToStandard` | Comfort qabul qilish yutsa → 0 qator, 409 (topilgan mashina yo'qolmaydi). Bizniki yutsa → kechikkan qabul `tryAssign` da 0 qator, haydovchiga `order:offer_cancelled` |
| "Boshqa faol zakaz" tekshiruvi o'zini chiqarib tashlaydi (`id: Not(orderId)`) | shu yerda | DISPATCHING ham faol — aks holda har doim 409 bo'lardi |
| Bot: `trackOrder` dan 60 s keyin bir marta xabar + tugma; NO_DRIVER'da takrorlanmaydi | `tracker.ts` `suggestTimers` / `suggested` | Bot polling qilmaydi — taymer kerak |
| Panel: tugma DISPATCHING Comfort qatorida ham | `Dashboard.tsx` | Operator mijoz qo'ng'irog'ida o'tkaza olsin |

Sim ilova qisqa chegara bilan ishga tushirilishi kerak:
`TELEGRAM_BOT_USERNAME=... COMFORT_SUGGEST_AFTER_SEC=4 node apps/api/dist/main.js`
(aks holda "1b" bo'limi 60 s kutadi).

### ✅ "Taksi topilmadi" zakaz qayta ochilganda yo'qolmaydi (2026-09-15)

**Hodisa (prod, zakaz `1b34afdf`):** Standart zakaz yagona haydovchiga taklif
qilindi, haydovchi "Ishni tugatish"ni bosdi → NO_DRIVER. Mijoz mini app'ni qayta
ochdi — buyurtma ekrani chiqdi ("zakaz bekor bo'lib ketibdi"). Haydovchi qayta
onlayn bo'lgach `retryPendingForDriver` o'sha zakazni ko'tardi va u ACCEPTED
bo'ldi: mijoz bexabar, haydovchi yo'lda.

**Sabab:** `NO_DRIVER` `TERMINAL_STATUSES` da — `activeOrderId` uni qaytarmasdi.
Holbuki zakaz 15 daqiqa davomida tirik (qayta ko'tariladi).

| Qoida | Qayerda | Nega |
|---|---|---|
| `NO_DRIVER_PENDING_MS` (15 daq) — BITTA qiymat | `orders.constants.ts`; `RETRY_PENDING_MAX_AGE_MS` shunga teng | Qayta ko'tarish, mijozga ko'rsatish va yopish bir xil oynaga tayanishi shart |
| `activeOrderId` shu oynadagi NO_DRIVER'ni ham qaytaradi | `customer-orders.service.ts` | Ilova (`/customer/active`) va mini app (`/miniapp/state`) qayta ochilganda kuzatuvga qaytadi |
| Yangi zakazda oynadagi NO_DRIVER zakazlar `CANCELLED_BY_CUSTOMER` (atomik, hodisa `superseded_by_new_order`) | `OrdersService.create` → `closePendingNoDriver`, faol tekshiruvdan OLDIN | Aks holda yangi zakaz tugagach eskisi tirilib, ikkinchi taksi kelardi. Mijozga socket xabari YO'Q — bot eski zakaz uchun "bekor qilindi" deb chalkashtirardi |
| Global `ACTIVE_STATUSES` O'ZGARMADI | — | U dispatch, chat, panel va "bitta faol zakaz" qoidasida ishlatiladi; NO_DRIVER'ni u yerga qo'shish qayta ko'tarishni o'zi bloklardi |
| Mini app: standart NO_DRIVER'da "buyurtmangiz saqlanib turibdi" izohi | `miniapp.page.ts` `renderCancel` | Yolg'iz "Taksi topilmadi" yakuniy eshitilardi |

Sim: `sim:no-driver-restore` (8). `sim:dispatch` dagi "Aynan 6 ta taklif"
tekshiruvi 800 ms kutish sababli BEQAROR (2–4 keladi); 3 s bilan 10/10 — bu
o'zgarishga bog'liq emas.

### ✅ Taksometr ilova yopilib ochilganda kamaymaydi (2026-09-15)

**Hodisa:** safar davomida taksometr 4 124 so'm edi; haydovchi ilovani yopib,
yo'l yurib, qayta ochganda 4 094 so'm.

**Sabab:** masofa faqat ekrandagi `watchPositionAsync` da sanalib, AsyncStorage'ga
15 soniyada bir saqlanardi. Ilova o'ldirilganda (1) oxirgi ≤15 s yo'qolardi,
(2) yopiq paytda yurilgan yo'l umuman qo'shilmasdi — fon joylashuv vazifasi
nuqtalarni faqat serverga yuborardi, qayta ochilganda esa oxirgi nuqta
xotirada yo'q edi.

| Qoida | Qayerda | Nega |
|---|---|---|
| Saqlangan yozuv — taksometrning YAGONA manbai: `{orderId, distanceM, inProgress, last}` | `storage.ts` | Ekran va fon vazifasi bir yozuvga qo'shadi, ekran undan o'qiydi |
| Har GPS nuqtasida `addTripPoint` — masofa SAQLANGAN `last` dan o'lchanadi | `storage.ts` | Yopiq oraliq (fon joylashuvi ruxsati yo'q bo'lsa ham) kamida to'g'ri chiziq bo'lib qo'shiladi |
| Ekranda — `HomeScreen`, fonda/o'ldirilganda — fon vazifasi (`AppState.currentState` bo'yicha) | `HomeScreen.tsx` watch, `location-task.ts` | Ikkalasi birga sanasa har nuqta ikki marta tushardi |
| Fon vazifasi to'plamdagi HAMMA nuqtani qo'shadi | `location-task.ts` | Android nuqtalarni to'plab beradi |
| `markTripStage` shu zakazning masofasi va `last` ini saqlaydi | bosqich effekti | Tiklash ham shu yerdan o'tadi — nolga tushirmasin |
| Fondan qaytganda va `trip:complete` da saqlangan kattaroq qiymat olinadi | `syncActiveTrip`, `complete()` | Ekran hali yangilanmagan bo'lishi mumkin |
| `haversine` — `geo.ts` | — | Ekran va fon vazifasi bir xil hisoblasin |

Qurilmada qo'lda tekshirish kerak (simda GPS yo'q): safar boshlash → yurish →
ilovani yopish (swipe) → yurish → ochish: narx kamaymasligi, yopiq paytdagi
yo'l qo'shilgan bo'lishi.

**Haydovchilar qidiruvi.** `GET /ops/drivers/search?q=&status=&approval=&category=&balance=negative&limit=&offset=`
— ism+familiya, telefon (bo'shliqlar bilan ham), davlat raqami; LIKE belgilari
("%", "_") ekranlanadi. Eski `GET /ops/drivers` o'zgarmadi (simlar unga tayanadi).
Panel: qidiruv + filtrlar + 25 tadan sahifalash; qator bosilganda `DriverDetail`
oynasi (Ma'lumot va chat = xaritadagi `DriverWindow`, Tahrirlash, Balans tarixi,
Safarlar). Yangi: `PUT /ops/drivers/:id/profile` (telefon unikal, 409),
`PUT /ops/drivers/:id/vehicle` endi `category` ham oladi — o'zgarganda toifa
keshi (`driver:cat:*`) va geo-indeks DARHOL yangilanadi. `GET /ops/drivers/:id/trips`.
Sim: `sim:driver-search` (16).

**Chat push'i (haydovchi ilovasi).** Ilova OCHIQ bo'lsa chat bildirishnomasi
ko'rsatilmaydi (`setNotificationHandler` — `data.type === 'chat'`), yopiq/fonda
bo'lsa tizim ko'rsatadi. Chat ochilganda shtorkadagi chat bildirishnomalari
o'chiriladi; bildirishnoma bosilsa to'g'ridan chat ochiladi (ilova yopiq bo'lsa
`getLastNotificationResponseAsync`).

### ✅ Aksiyalar va haydovchi guruhlari; chat 3 kunda o'chadi (2026-09-15)

**Nega:** foydalanuvchi yangi yilgacha to'lov yechmasdan har zakazga +300 so'm
bermoqchi edi va `per_order = -300` qo'yib ko'rmoqchi edi. **Bu ISHLAMAYDI:**
`computeCommission` manfiyni `Math.max(0, …)` bilan 0 ga aylantiradi —
haydovchi tekin ishlaydi, lekin bonus tushmaydi; umumiy `perOrderFee` esa
manfiyni 400 bilan rad etadi. Manfiy to'lovni "bonus" qilib ishlatmang.

**Model:** `driver_groups` + `driver_group_members` (bir haydovchi bir nechta
guruhda) va `promotions`: `commission_discount_percent` (0..100) va
`bonus_per_order` (so'm), `group_id` (null = barchaga), `active` (qo'lda) va
ixtiyoriy `starts_at` / `ends_at`.

| Qoida | Qayerda | Nega |
|---|---|---|
| Ishlaydi: `active` VA boshlanish o'tgan VA tugash kelmagan | `promotions.util.ts` `promoState` | Qo'lda o'chiq aksiya sanadan qat'i nazar ishlamaydi |
| Tugash vaqtining O'ZI kirmaydi | shu yerda | "31-dekabr oxirigacha" = `ends_at` 1-yanvar 00:00 (panelda "Yangi yilgacha" tugmasi) |
| Bir nechta aksiya QO'SHILMAYDI | `pickBenefit` | Eng katta chegirma va eng katta bonus alohida olinadi — aks holda +100 va +300 birga +400 berib yuborardi |
| Safar yakunlanadigan TRANZAKSIYA ichida | `BillingService.applyCommission` → `PromotionsService.benefitFor(manager)` | To'lov va bonus bir xil holatga tayanadi |
| Bonus alohida tranzaksiya `type='bonus'` | `transactions.type` — `text`, migratsiya shart emas | Balans tarixida "Aksiya bonusi" bo'lib ko'rinadi |
| Aksiyadagi guruh o'chmaydi (409, FK RESTRICT) | `deleteGroup` | Aks holda aksiya jimgina yo'qolardi |
| Chegirmasiz va bonussiz aksiya — 400 | `apply` | Hech narsa qilmaydigan aksiya "ishlayapti" deb turmasin |

**Panel:** "Aksiyalar" sahifasi (aksiyalar jadvali + holat nishoni, yoqish/o'chirish,
tahrir; guruhlar va a'zolar — haydovchini qidirib qo'shish). Haydovchi
oynasining "Tahrirlash" bo'limida guruh belgilari. Faqat ADMIN+.

**Sim:** `sim:promotions` — 19 tekshiruv, har holat HAQIQIY safar bilan
(balans harakati aynan kutilgan summaga teng): aksiyasiz -1000, guruh a'zosi
+300 va to'lovsiz, a'zo bo'lmagan -1000, kelajak/o'tgan/o'chiq aksiya ishlamaydi,
barchaga 50% + 100, ikki aksiya qo'shilmaydi, 409/400/403.

**Chat tozalash:** `ChatRetentionService` — ishga tushgach 30 s dan keyin va
soatiga bir marta `CHAT_RETENTION_DAYS` (sukut 3) dan eski xabarlar va ularning
fayllari BITTA SQL (data-modifying CTE) bilan o'chadi. Noto'g'ri qiymat 3 ga
tushadi (butun chat o'chib ketmasin). Joy Postgres ichida qayta ishlatiladi
(autovacuum), OS'ga darhol qaytmaydi.

**Haydovchi kabineti:** profil kartasi faqat "Ko'rsatkichlar" bo'limida; "Chiqish"
kabinet pastida, tasdiq bilan. `GET /drivers/me` endi aniq maydonlar ro'yxati
(avval butun entity — parol hash va push token bilan).

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

`MapView.tsx` da WebView HTML'i, `miniapp.page.ts` da esa butun Mini App
sahifasi template literal ichida yozilgan. Ikki xil tuzoq bor va ikkalasi
ham shu sessiyada yana bir marta tushdi:

**(a) Backtick izohda** — (`` // `inset` (panel balandligi) ``) template
literal'ni TUGATADI, TypeScript tushunarsiz joyda `TS1005: ';' expected`
yoki `Parsing error: Invalid character` beradi. Izohlarda oddiy tirnoq
ishlating.

**(b) Regex eskeyplari YEYILADI — jim, xatosiz** (2026-09-13). Template
literal ichida `/\B(?=(\d{3})+(?!\d))/g` deb yozilsa, TypeScript `\B` va
`\d` ni SATR eskeypi deb o'qiydi va sahifaga `/B(?=(d{3})+(?!d))/` bo'lib
tushadi. Hech qanday xato chiqmaydi, regex shunchaki ishlamay qo'yadi —
mini appda narx oylar davomida "12000" ko'rinib turdi, "12 000" emas.

> Template literal ichida regex yozganda eskeyplarni **ikkilantiring**:
> `\\B`, `\\d`, `\\s`. `pnpm lint` buni `no-useless-escape` bilan
> ushlaydi — shuning uchun lint YASHIL turishi shart (6-qadam).

---

### 5.12 Xatolar haqida Telegram'ga xabar (2026-09-13)

5xx xatolar to'liq stack bilan loglanardi, lekin loglarga hech kim
qaramaydi — prod'dagi nosozlik faqat mijoz qo'ng'iroq qilganda bilinardi.

Endi `AllExceptionsFilter` 5xx bo'lganda `bot:alert` Redis kanaliga yozadi,
bot esa uni `ADMIN_CHAT_ID` chatiga yuboradi (`apps/bot/src/alerts.ts`).
Sentry o'rniga shu tanlandi: yangi bog'liqlik ham, tashqi hisob ham,
oylik to'lov ham yo'q — API va bot allaqachon bitta Redis'ni bo'lishadi.

**Yoqish:** Railway'da bot servisiga `ADMIN_CHAT_ID` qo'shing (o'z
Telegram ID'ingizni `@userinfobot` beradi). Berilmasa — jim o'chiq.

**Nimalar ATAYLAB yuborilmaydi:**
- So'rov satri (`?...`) kesib tashlanadi — mini app `initData` (Telegram
  imzosi) chatga, telefon bildirishnomasiga va Telegram serverlariga
  tushmasin.
- Xato matnidagi ulanish paroli o'chiriladi (`redis://user:parol@` →
  `://***@`) — TypeORM/ioredis uzilish xatolari ba'zan butun URL'ni
  matnga qo'shadi.

**Bo'g'uv uch qavat** (aks holda bitta buzuq handler chatni ko'mardi):
bir xil xato uchun 5 daqiqa jimlik, daqiqasiga eng ko'pi 5 xabar, yo'ldagi
id lar `:id` ga birlashtiriladi.

Filtr `main.ts` da QO'LDA quriladi (DI konteynerida emas), shuning uchun
Redis klienti `app.get(REDIS)` orqali beriladi. Klient ixtiyoriy — usiz
filtr avvalgidek faqat logga yozadi (testlar shunday ishlaydi).

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

   ✅ **TUZATILDI (2026-09-13).** `plugins/withAndroidRelease.js` har
   `expo prebuild` da `ndkVersion` ni `TTY_ANDROID_NDK` dan o'rnatadi.
   O'zgaruvchi berilmasa shablon qiymati qoladi (boshqa mashinalar
   buzilmasin). Yangi bog'liqlik qo'shilmadi — `expo-build-properties`
   kerak bo'lmadi.

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

### 6.2 APK imzosi — endi o'z kalitimiz bilan (2026-09-13)

**Avval:** Expo shabloni reliz build'ini ham `android/app/debug.keystore`
bilan imzolardi (`release { signingConfig signingConfigs.debug }`). Bu
kalitning MAXFIY qismi React Native shablonida ochiq turibdi — ya'ni
istalgan odam bizning ilova ustiga tushadigan soxta APK yasay olardi.
Play Market ham bunday APK'ni qabul qilmaydi.

**Endi:** `plugins/withAndroidRelease.js` (ikkala ilovada) reliz imzosini
shartli qiladi. Parollar FAQAT muhit o'zgaruvchilaridan olinadi — na
repoda, na `gradle.properties` da hech narsa qolmaydi:

```bash
export TTY_ANDROID_KEYSTORE="C:/kalitlar/toy-taxy.jks"   # TO'LIQ yo'l
export TTY_ANDROID_KEYSTORE_PASSWORD=...
export TTY_ANDROID_KEY_ALIAS=toytaxy
export TTY_ANDROID_KEY_PASSWORD=...
export TTY_ANDROID_NDK=27.1.12297006                      # 6.1 dagi tuzoq
```

`TTY_ANDROID_KEYSTORE` berilmasa build AVVALGIDEK debug kaliti bilan
imzolanadi va Gradle logida ogohlantirish chiqadi — sinov build'lari
uchun yetarli, hech narsa buzilmaydi. Ikkala shox ham
`:app:signingReport` bilan tekshirilgan (2026-09-13).

**Kalitni yaratish (bir marta, kalit REPOGA TUSHMAYDI):**

```bash
keytool -genkeypair -v -keystore C:/kalitlar/toy-taxy.jks \
  -alias toytaxy -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ **Kalitni yo'qotsangiz Play Market'dagi ilovani boshqa YANGILAB
BO'LMAYDI** — faqat yangi paket nomi bilan yangi ilova joylash qoladi.
Uni repodan tashqarida, zaxirasi bilan saqlang (`.gitignore`: `*.keystore`,
`*.jks`).

**O'tish:** reliz kaliti debug kalitidan boshqa, shuning uchun yangi imzoli
APK eski (debug imzoli) ilova ustiga **o'rnatilmaydi** — foydalanuvchi
bir marta eskisini o'chirishi kerak. Kalitni almashtirish uchun eng yaxshi
payt — Play Market'ga chiqishdan OLDIN.

**Play Market uchun AAB:**
```bash
cd apps/customer-app/android && ./gradlew.bat bundleRelease
# natija: app/build/outputs/bundle/release/app-release.aab
```

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

### 6.7 Versiya raqami — `pnpm bump:mobile`

`app.json` da `versionCode` UMUMAN yo'q edi, ya'ni Expo uni har build'da
`1` qilib qo'yardi. Oqibati: telefondagi ilova qaysi build ekanini aytib
bo'lmasdi, Android uni yangilanish deb hisoblamasdi, Play Market esa bir
xil `versionCode` li ikkinchi APK'ni rad etadi.

Endi `versionCode` `app.json` da turadi (`2` dan boshlandi) va skript uni
oshiradi:

```bash
pnpm bump:mobile mijoz             # versionCode +1
pnpm bump:mobile haydovchi --patch # versionCode +1 va 1.0.0 -> 1.0.1
```

`eas.json` da `appVersionSource` `remote` dan `local` ga o'tkazildi —
aks holda EAS va lokal build har xil raqam qo'yardi.

**Reliz tartibi:** `pnpm bump:mobile mijoz` → `expo prebuild` →
`gradlew.bat assembleRelease` → `pnpm release:apk <apk>` (6.5).

---

### 6.4 APK tarqatish — GitHub Release (`gh` SHART EMAS)

Repo **OCHIQ (public)** — 2026-09-11 da API orqali tekshirildi
(`private: false`). Release'dagi APK'ni istalgan kishi login'siz yuklab
oladi; mijoz ilovasida maxfiy kalit yo'q, shuning uchun bu xavfsiz.

**Konvensiya:**

| Teg | Nima | Holat |
|---|---|---|
| `v1.0.0` | EAS imzoli, ikkala ilova (`toy-taxy-haydovchi.apk`, `toy-taxy-mijoz.apk`) | **latest** |
| `mijoz-2026-09-11` | lokal build, debug kaliti, Figma dizayni | prerelease |

Lokal (debug imzoli) build'larni **prerelease** qiling. Aks holda u
"latest" bo'lib qoladi va `releases/latest/download/toy-taxy-haydovchi.apk`
havolasi 404 beradi — yangi release'da haydovchi APK'si yo'q.

**`gh` o'rnatilmagan** (winget ham yo'q), lekin kerak ham emas: Git
Credential Manager'da `javlonnomozov-portfolio` uchun `repo` scope'li token
saqlangan. Uni CHOP ETMASDAN olish:

```bash
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' \
  | GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 git credential fill \
  | sed -n 's/^password=//p')
```

Keyin ikki so'rov:
1. `POST https://api.github.com/repos/javlonnomozov-portfolio/taxy-project/releases`
   — `tag_name`, `target_commitish` (to'liq SHA), `prerelease: true`,
   `make_latest: "false"` → javobdan `id`.
2. `POST https://uploads.github.com/repos/javlonnomozov-portfolio/taxy-project/releases/<id>/assets?name=<fayl>.apk`
   — `Content-Type: application/vnd.android.package-archive`,
   `--data-binary @<apk>`. 66 MB ~10 s da yuklanadi.

Teg API tomonidan yaratiladi — keyin `git fetch origin --tags`.

---

### 6.6 `railway up` "operation timed out" — sabab `.railwayignore` da

2026-09-12 da deploy uch marta shu xato bilan yiqildi, holbuki `railway
whoami` va `status` darhol javob berardi va tarmoq joyida edi. Sabab:
`railway up` BUTUN papkani yuklaydi, `.railwayignore` da esa faqat `data/`,
`*.log`, `node_modules/` bor edi. Ya'ni yuklamaga `apps/customer-app/android/`
(Gradle build keshi) va har build'dan qolgan 66 MB'lik APK'lar kirardi —
gigabaytlar.

Endi `.railwayignore` mobil ilovalarni butunlay chiqarib tashlaydi. Bu
XAVFSIZ: `apps/api/Dockerfile` faqat `packages/shared` va `apps/api` ni
ko'chiradi, `pnpm-workspace.yaml` ham ikkala ilovani ataylab chiqarib
tashlagan.

> Lokal build'dan keyin qolgan APK'larni o'chirib turing — ular baribir
> GitHub Release'da (§6.5), ish papkasida esa faqat joy egallaydi.

### 6.5 APK yetkazish — O'ZGARMAS havola (`mijoz-latest`)

Foydalanuvchi har build'da yangi havola olishni istamaydi. Shu sabab
**qo'zg'aluvchi teg** ishlatiladi: `mijoz-latest` har safar yangi commit'ga
ko'chadi, fayl nomi esa doim bir xil. Havola hech qachon o'zgarmaydi:

```
https://github.com/javlonnomozov-portfolio/taxy-project/releases/download/mijoz-latest/toy-taxy-mijoz.apk
```

**Bitta buyruq** (skript §6.4 dagi qo'lda `curl` qadamlarini almashtiradi):

```bash
node scripts/publish-apk.mjs apps/customer-app/<yangi>.apk
# yoki: pnpm release:apk apps/customer-app/<yangi>.apk
```

Skript o'zi: tegni HEAD ga ko'chiradi, reliz matnini yangilaydi, eski
faylni o'chirib yangisini yuklaydi va havolani chop etadi. Token Git
Credential Manager'dan olinadi (`gh` KERAK EMAS, u o'rnatilmagan ham).

⚠️ **`prerelease: true` va `make_latest: "false"` MAJBURIY.** Aks holda bu
reliz "latest" bo'lib qoladi va
`releases/latest/download/toy-taxy-haydovchi.apk` havolasi 404 beradi —
haydovchi APK'si `v1.0.0` relizida, bunisida esa yo'q. 2026-09-12 da
tekshirildi: mijoz havolasi 200, haydovchi havolasi ham 200.

Sanali relizlar (`mijoz-2026-09-11`, `mijoz-2026-09-12`) arxiv sifatida
qoladi — eski versiyaga qaytish kerak bo'lsa.

---


**Haydovchi uchun ham o'zgarmas havola (2026-09-13):**

```
https://github.com/javlonnomozov-portfolio/taxy-project/releases/download/haydovchi-latest/toy-taxy-haydovchi.apk
```

```bash
node scripts/publish-apk.mjs <apk> --tag haydovchi-latest --name toy-taxy-haydovchi.apk --label haydovchi
```

`--label` bo'lmasa reliz sarlavhasi "mijoz" bo'lib chiqadi. Birinchi chiqarilgan
build — versionCode 3 (oltin Comfort kartasi, narx tuzatish kartasi, admin bilan chat).

> ⚠️ Eski `releases/latest/download/toy-taxy-haydovchi.apk` (v1.0.0) — EAS
> kaliti bilan imzolangan. Yangi lokal build debug kaliti bilan (6.2), shuning
> uchun uning ustiga **o'rnatilmaydi**: haydovchi eski ilovani bir marta o'chirib,
> keyin yangisini o'rnatishi kerak. Keyingi `haydovchi-latest` build'lari bir-birining
> ustiga o'rnatilaveradi.

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
