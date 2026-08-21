# Mijoz ilovasi — reja (muhokama uchun)

> **Holat:** 1-BOSQICH BAJARILDI · 2026-08-17
> Auth API + bot tomoni tayyor va simlar bilan qoplangan. Qolgani 6-bo'limda.

---

## 1. Nega kerak (foydalanuvchi bergan sabab)

- **Topish osonligi.** Telegram botni qidirish kerak; ilova telefonda alohida
  ikonka bo'lib turadi.
- **Ishonch.** Mijoz uchun "ilovasi bor xizmat" jiddiyroq ko'rinadi.

**Foydalanuvchi o'zi aytgan xavf:** ilova ishdan chiqsa, effekt TESKARI
bo'ladi. Bu haqiqiy xavf — 4-bo'limda unga qarshi choralar.

**Nima MUAMMO EMAS:** funksiya yetishmasligi. Mini App allaqachon xaritadan
chaqirish, jonli kuzatish, bekor qilish, narx va baholashni qamraydi. Ilova
yangi imkoniyat uchun emas, KIRISH NUQTASI uchun quriladi.

---

## 2. Kirish (autentifikatsiya)

Telegram identifikatsiya manbai bo'lib qoladi: SMS xarajati yo'q, alohida
parol tizimi yo'q, mavjud `customers` yozuvlari qayta ishlatiladi.

### Oqim

```
Ilova                      Telegram bot                 API
  |                             |                        |
  |-- POST /auth/customer/start ------------------------->|   nonce yaratadi
  |<-- { nonce, deepLink, expiresIn } --------------------|   Redis, TTL 5 daq
  |                             |                        |
  |-- deepLink ochadi --------->|                        |
  |   t.me/<bot>?start=<nonce>  |                        |
  |                             |-- nonce'ni tasdiqlaydi->|   nonce → telegramId
  |                             |   + 6 xonali kod        |
  |                             |<-- kodni chatga yozadi -|
  |                             |                        |
  |-- POST /auth/customer/poll { nonce } ---------------->|   tasdiqlangan bo'lsa
  |<-- { token } ----------------------------------------|   DARHOL kiradi
```

**Ikki yo'l, bitta server mantig'i:**

1. **Avtomatik (asosiy).** Ilova `nonce` bilan deep link ochadi, so'ng
   `poll` qiladi. Foydalanuvchi HECH NARSA YOZMAYDI — bot chatida "Kirish
   tasdiqlandi" chiqadi, ilova o'zi ichkariga o'tadi.
2. **Kod bilan (zaxira).** Deep link ishlamasa (Telegram o'rnatilmagan,
   boshqa telefonda, brauzer ushlab qolgan) — bot bergan **6 xonali kodni**
   ilovada qo'lda kiritish: `POST /auth/customer/verify { nonce, code }`.

Zaxira yo'l SHART: deep link Android'da har doim ham ishlamaydi, va busiz
foydalanuvchi boshi berk ko'chada qoladi.

### Xavfsizlik shartlari (kelishilishi kerak)

| Shart | Qiymat | Nega |
|---|---|---|
| Kod uzunligi | 6 xona | Qulaylik va xavfsizlik muvozanati |
| Amal qilish muddati | 5 daqiqa | Uzoq yashagan kod o'g'irlanishi mumkin |
| Ishlatilishi | **BIR MARTALIK** | Qayta ishlatilsa sessiya ko'chiriladi |
| Kiritish urinishlari | 5 ta, keyin nonce o'ladi | Busiz 6 xonani tanlab olish mumkin |
| `start` so'rovi chastotasi | 1 daqiqada 5 ta / qurilma | Bot spam'iga qarshi |
| Bog'lanish | nonce ↔ telegramId ↔ customerId | Kod boshqa hisobga ishlamaydi |

Saqlash — Redis (`auth:nonce:<nonce>`), TTL bilan. Yangi jadval kerak emas.

### Token

Ilova `role: 'customer'` bo'lgan JWT oladi. Hozir JWT'da faqat `driver` va
admin rollari bor — **yangi rol va guard qo'shiladi**.

`JWT_EXPIRES_IN=90d` mijozga ham tegishli. Ilova 401 ni allaqachon to'g'ri
ishlaydigan naqsh bilan yozilishi kerak (haydovchi ilovasidagi
`setUnauthorizedHandler` bilan bir xil) — aks holda token tugaganda ilova
qulflanib qoladi (bu haydovchi ilovasida bir marta sodir bo'lgan).

---

## 3. API: takrorlamaslik shartlari

Mini App endpointlari (`/miniapp/*`) `initData` imzosiga tayanadi; ilova
esa JWT bilan keladi. **Mantiqni ikki marta yozish MUMKIN EMAS** — bu
HANDOFF 5.1 dagi asimmetriya naqshini takrorlaydi va bir kuni biri
yangilanmay qoladi (mini app'da baholash bor, ilovada yo'q — aynan shu
xato allaqachon bo'lgan).

**Qoida:** biznes mantiq servisda qoladi, controller faqat "kim so'rayapti"
ni aniqlaydi:

```
MiniappService.track(initData, orderId)  ─┐
                                          ├─► OrdersViewService.track(customerId, orderId)
CustomerAppController.track(jwt, orderId)─┘
```

Xuddi shu narsa `order`, `cancel`, `rate` uchun ham.

---

## 3b. Sinxronlik: ilova va bot bir vaqtda ishlaydi

Talab: mijoz ilovada zakaz bersa bot chatida ham ko'rinsin, botda bekor
qilsa ilovada ham yopilsin. Manba bitta — API; ikkala kanal ham UNGA
qaraydi, bir-biriga emas.

### ⚠️ Topilgan to'siq: `/customer` socket ilovaga OCHIQ EMAS

`customer.gateway.ts` hozir `internalKey + customerId` bilan ulanadi —
ya'ni uni faqat BOT proksi qila oladi. Ichki kalit mijoz ilovasiga
JOYLASHTIRILMAYDI (u APK ichidan chiqarib olinadi va butun tizimga kirish
beradi).

Demak 3-bosqichdan oldin: `CustomerGateway` JWT'ni ham qabul qilsin
(`role: 'customer'` → `customer:<sub>` xonasiga qo'shilsin), ichki kalit
yo'li esa bot uchun qoladi. Bittasi ikkinchisini almashtirmaydi.

Busiz ilova holatni pollingga majbur bo'ladi: kechikish, ortiqcha trafik
va bot bilan ko'rinadigan farq.

---

## 4. "Ilova ishdan chiqsa" — himoya choralari

Foydalanuvchi aytgan xavfga qarshi uchta qoida. Bularsiz ilova chiqarilmasin.

### 4.1 Bot va Mini App HECH QACHON o'chmaydi

Ilova — qo'shimcha kirish nuqtasi, yagona yo'l emas. Bu qoida saqlansa,
ilova butunlay ishlamay qolsa ham mijoz zakaz bera oladi.

### 4.2 Ilova xato holatda Telegram'ga yo'naltiradi

Server javob bermasa, versiya eskirgan bo'lsa yoki kutilmagan xato bo'lsa —
bo'sh ekran EMAS, balki: xato matni + **"Telegram orqali davom etish"**
tugmasi (bot deep link'i). Nosozlik boshi berk ko'cha bo'lmasin.

### 4.3 Xatolar KO'RINADIGAN bo'lsin

Bu sessiyaning eng qimmat saboqi: haydovchi ilovasi ikki marta jimgina
qulab, sabab faqat telefon USB bilan ulanганda topildi
(`JNI DETECTED ERROR IN APPLICATION: obj == null`). `ErrorBoundary` native
crashni USHLAMAYDI.

Mijoz ilovasida bu xavf kattaroq — mijoz ko'p va ular kutmaydi. Shuning
uchun **birinchi versiyadanoq**:
- crash hisoboti (Sentry yoki API'ga oddiy `POST /client-errors`);
- `minSupportedVersion` — API eskirgan versiyaga "yangilang" deb aytadi
  (buzuq relizni to'xtatish uchun yagona vosita);
- haydovchi ilovasidagi `ErrorBoundary` + 401 ishlash naqshlari ko'chiriladi.

---

## 4b. Reliz qoidalari (birinchi chiqishdan OLDIN)

Bularsiz ilova Play Market'ga chiqarilmasin — keyin qo'shib bo'lmaydi.

1. **Bosqichma-bosqich tarqatish.** Play Console'da 10-20% dan boshlang.
   Native crash ko'rinmasligini hisobga olsak, bu yagona amaliy himoya.
2. **Versiya to'xtatgichi.** API `minSupportedVersion` qaytarsin, ilova
   undan past bo'lsa "yangilang" ekranini ko'rsatsin. Buzuq reliz chiqib
   ketsa uni to'xtatishning BOSHQA yo'li yo'q — foydalanuvchi o'zi
   yangilamaydi. Buzuq versiya chiqqandan KEYIN buni qo'shib bo'lmaydi.
3. **Crash hisoboti v1 dan.** Sentry yoki `POST /client-errors`.
4. **Imkoniyat pariteti.** Ilovaga qo'shilgan har narsa bot/Mini App'da
   ham bo'lsin, yoki "faqat ilovada" deb ATAYLAB belgilansin. Bu sessiyada
   parite ikki marta buzilgan (baholash, bekor qilish) — uchinchi kanal
   qo'shilgach xato ehtimoli yana oshadi.
5. **Operator ishlata olmaydigan funksiya chiqarilmasin.** Misol: mijozni
   bloklash kodi BOR, lekin operator paneli yo'q — ya'ni amalda yo'q.

---

## 5. Ekranlar (birinchi versiya)

Mini App'da bor narsadan ortiq EMAS — maqsad kirish nuqtasi, yangi
funksiya emas.

1. **Kirish** — "Telegram orqali kirish" tugmasi + kod kiritish maydoni
2. **Bosh ekran** — xarita, "Qayerdan olib ketamiz?" pin, toifa tanlash
3. **Kutish** — "Taksi qidirilmoqda", bekor qilish
4. **Kuzatuv** — haydovchi kartasi, jonli xarita, qo'ng'iroq, bekor qilish
5. **Yakun** — narx + baholash
6. **Tarix** — oxirgi safarlar (Mini App'da yo'q, arzon qo'shimcha)

Dizayn tokenlari haydovchi ilovasidan olinadi (`src/theme.ts`) — ikki ilova
bir xil ko'rinsin.

---

## 6. Bosqichlar

| # | Ish | Natija |
|---|---|---|
| 1 | ✅ Auth: nonce + kod + `customer` roli + guard | `pnpm sim:customer-auth` — 20 ta tekshiruv |
| 2 | Mantiqni servisga chiqarish (`/miniapp/*` bilan umumiy) + `CustomerGateway` ga JWT | Takrorlanish yo'q, jonli sinxronlik |
| 3 | Expo ilova: kirish + zakaz berish + kuzatuv | Sinovdan o'tadigan APK |
| 4 | Xato ko'rinuvchanligi (4.3) | Reliz uchun shart |
| 5 | Tarix, saqlangan manzillar | Ixtiyoriy |
| 6 | Play Market | AAB + maxfiylik siyosati |

**1-bosqich mustaqil qiymatga ega:** kod bilan kirish tayyor bo'lsa, uni
Mini App'da ham, kelajakdagi har qanday mijozda ham ishlatish mumkin.

---

## 7. Ochiq savollar

1. ~~Telegramsiz mijoz~~ — **HAL QILINDI (2026-08-17).** O'zbekistonda
   deyarli barchada Telegram bor, shuning uchun Telegram orqali kirish
   YAGONA yo'l bo'lib qoladi. SMS zaxirasi rejadan chiqarildi: u alohida
   identifikatsiya tizimi, xarajat va yangi hujum yuzasini olib kelardi.
2. **Ikkinchi ilova = ikki barobar saqlash.** Har tuzatish ikki joyda
   sinaladi, ikki APK yig'iladi. Bunga tayyormizmi?
3. **Mijozni bloklash endpointi YO'Q.** `AccountStatusService.customerActive`
   tayyor va `customers.is_blocked` ustuni bor, lekin operator uni ishga
   sololmaydi (`/ops/customers` faqat ro'yxat qaytaradi). Ya'ni suiiste'mol
   qiluvchi mijozni to'xtatib bo'lmaydi. Kichik ish — kerak bo'lsa aytilsin.
4. **Play Market ikkalasi uchunmi?** Haydovchi ilovasi fon joylashuvi
   sababli Google tekshiruvidan qiyin o'tadi (video talab qilinadi);
   mijoz ilovasida bu muammo yo'q.
