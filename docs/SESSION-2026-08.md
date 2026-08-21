# Sessiya yozuvi — 2026-08-01 … 08-21

> Bu hujjat shu sessiyada nima qilingani, QANDAY QARORLAR qabul qilingani va
> nima ochiq qolganini saqlaydi. Kundalik ish uchun `HANDOFF.md` ni o'qing —
> u joriy holatni beradi. Bu fayl esa "nega shunday qilingan" ga javob beradi.

---

## 1. Qisqacha: nima o'zgardi

| Yo'nalish | Natija |
|---|---|
| Haydovchi ilovasi | Xarita to'liq ekran, safar tiklash, 3 ta crash tuzatildi |
| Mijoz ilovasi | **YANGI** — `apps/customer-app`, Telegram orqali kirish |
| Mini App | Narx + baholash + bekor qilish qo'shildi (bot bilan sinxron) |
| Billing | Yangi haydovchidan pul yechilmasdi — tuzatildi |
| Reyting | Yangi haydovchi 5.00 dan boshlaydi |
| Push | FCM kaliti yo'qolgan edi — tiklandi, qurilmada tasdiqlandi |
| Infratuzilma | Prod bazasi tozalandi, JWT 90 kun, yangi Expo hisobi |

---

## 2. Qabul qilingan QARORLAR (va nega)

### 2.1 Mijoz ilovasi Telegram orqali kiradi — SMS yo'q
O'zbekistonda deyarli barchada Telegram bor. SMS alohida identifikatsiya
tizimi, doimiy xarajat va yangi hujum yuzasi bo'lardi.

### 2.2 Kirish kodi MAJBURIY (xavfsizlik)
Avval deep link tasdiqlangach ilova avtomatik kirardi. **Foydalanuvchi
hisobni o'g'irlash yo'lini topdi:** hujumchi o'z ilovasida havola yaratib
qurbonga yuboradi ("shuni bosib bering"), qurbon Telegram'da tasdiqlaydi va
**hujumchining ilovasi** qurbon hisobiga token oladi.

Ildiz sabab: tasdiqlovchi va ilovani ushlab turgan odam boshqa-boshqa
bo'lishi mumkin edi. Kod ikkalasini bog'laydi.

### 2.3 Mijoz ilovasi Mini App'dan KO'P narsa qilmaydi
Ilovaning vazifasi — **kirish nuqtasi** (botni qidirish shart emas, ishonch
yuqori). Har qo'shilgan imkoniyat buziladigan yangi yuza, va foydalanuvchi
o'zi aytganidek "ilova ishdan chiqsa effekt teskari bo'ladi".

### 2.4 Faqat olib ketish nuqtasi — borish joyi SHART EMAS
Manzil xaritadan belgilanadi, **nomi bo'yicha qidirish bekor qilindi**
(geokodlash yoqilmaydi). Birovga buyurtma berish ham xaritadan tanlash
bilan hal bo'ladi.

### 2.5 4+ yo'lovchi uchun YANGI TOIFA KERAK EMAS
Mashinalar asosan **Damas** — 7 yo'lovchi sig'adi, ya'ni muammo amalda
yo'q. Mashina rusumini tanlash ham rad etildi: mashinalar soni oz, tanlov
qo'shilsa mijoz tanlaydi-yu, mos mashina topilmay "taksi topilmadi"
chiqadi. (Foydalanuvchi qarori, 2026-08-21.)

### 2.6 Yangi haydovchi 5.00 reyting bilan boshlaydi
"Birinchi mijoz 5 yulduz bergan" degan urug' ovoz; haqiqiy baholar kelgani
sari suyuladi. **Oqibati:** baholanmagan haydovchi (5.00) haqiqiy 4.5
olgandan (4.75) yuqori turadi va teng masofada undan oldin taklif oladi.
Sozlash: `apps/api/src/reputation/reputation.constants.ts`.

### 2.7 Yangi haydovchi `per_order` billing rejimida
Entity default'i `subscription` edi va u safardan **ataylab hech narsa
yechmaydi**. Operator qo'lda o'zgartirmasa, haydovchi bepul ishlab
yuraverardi. Qarz mexanizmi allaqachon ishlagan — shunchaki ishga
tushmagan, chunki komissiya doim 0 edi.

---

## 3. Topilgan XATOLAR va ildiz sabablari

Bular takrorlanmasligi uchun — har biri qanday topilgani ham muhim.

| Alomat | Ildiz sabab | Qanday topildi |
|---|---|---|
| Ilova jimgina yopiladi | Xarita YECHIB OLINGAN WebView'ga `injectJavaScript` yozardi → JNI `obj == null` | `adb logcat -b crash` |
| "Chiqish"da qulash | `watchPositionAsync` faqat "Ishni tugatish"da to'xtardi; ekran yopilgach orfan qolardi | logcat |
| Default holatga qaytish | `expo-updates` JS xatosida ilovani JIMGINA qayta ishga tushirardi | logcat + modul kodda umuman ishlatilmasligi |
| Safar yo'qolardi | Holat faqat React xotirasida edi | kod tahlili |
| Ilova "Ulanmoqda…" da qotardi | JWT 7 kunda tugardi, ilova 401 ni ishlamasdi | **prod logi** (`jwt expired`) |
| Raqam `+` siz | Botda ikki ro'yxatdan o'tish yo'li, biridan normalizatsiya tushib qolgan | bazadagi qiymat |
| Pul yechilmasdi | Billing rejimi `subscription` | bazadagi qiymat |
| Push kelmasdi | Expo hisobi ko'chirilganda FCM kaliti eski loyihada qolgan | Expo `InvalidCredentials` |
| Build yiqilardi | `expo-font` erkin diapazon → 57.x (SDK 54) | versiyalarni solishtirish |

### Eng qimmat saboq
**"Ishlamayapti" shikoyatida avval LOG o'qing.** Bu sessiyada men ikki marta
koddan boshlab taxmin qildim va ikkalasida ham noto'g'ri tashxis qo'ydim.
Prod logi va `adb logcat` javobni bir daqiqada berdi.

Batafsil naqshlar: `HANDOFF.md` 5-bo'lim.

---

## 4. OCHIQ savollar

1. **Mijoz ilovasi dizayni.** Foydalanuvchi maket yubordi (xarita + pastki
   karta + tab paneli: Asosiy / Buyurtmalar / Daromad / Menyu).
   - "Daromad" tabi mijoz ilovasida MA'NOSIZ (mijoz pul sarflaydi) —
     nima bo'lishi hal qilinmagan.
   - "Kabinet" mijozda nimani ko'rsatadi — aniqlanmagan.
   - "Uy"/"Ish" saqlangan manzillar — jadval YO'Q, qilinishi kerak.
2. **Mijozni bloklash endpointi YO'Q.** `customers.is_blocked` ustuni va
   tekshiruv kodi bor, lekin operator uni ishga sololmaydi.
3. **Mijoz ilovasiga push** — alohida Expo loyihasi, FCM kaliti alohida
   yuklanishi kerak.
4. **`CustomerGateway` ga JWT** — hozir faqat ichki kalit bilan ulanadi,
   ya'ni ilova jonli socket o'rniga polling qilyapti.
5. **Play Market** — AAB tayyor, lekin maxfiylik siyosati va do'kon sahifasi
   foydalanuvchi zimmasida.

---

## 5. Boshqa kompyuterda davom ettirish

```bash
git clone git@github.com:javlonnomozov-portfolio/taxy-project.git
cd taxy-project && pnpm install
cp .env.example .env          # qiymatlarni Railway'dan ko'chiring
pnpm db:up                    # postgres:5434 + redis:6379
```

Kerakli hisoblar (ikkalasi ham foydalanuvchida bor):
- `railway login` — deploy va prod bazaga ulanish uchun
- `eas login` (hisob `jav1on`) — APK/AAB yig'ish uchun

APK yig'ish uchun Android SDK (sudo KERAK EMAS):
```bash
sdkmanager --sdk_root=$HOME/Android/Sdk "platform-tools" \
  "platforms;android-34" "build-tools;34.0.0"
```
Batafsil: `HANDOFF.md` → "Lokal build".

⚠️ **Expo ilovalari pnpm workspace'dan CHIQARILGAN** — ularda `npm install`
ishlatiladi va `package-lock.json` MUHIM (uni o'chirmang: `expo-font`
darhol SDK 54 versiyasiga suriladi va build yiqiladi).
