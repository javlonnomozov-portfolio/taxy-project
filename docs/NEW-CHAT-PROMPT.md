# Yangi chatni boshlash uchun prompt

Quyidagini nusxalab yangi chatga tashlang.

---

```
Toy TaxY — mahalliy taksi platformasi (Bulung'ur, Samarqand). Loyihani
davom ettiramiz. O'zbek tilida gaplash.

Repo allaqachon shu kompyuterda klon qilingan bo'lishi kerak:
git@github.com:javlonnomozov-portfolio/taxy-project.git

BIRINCHI NAVBATDA shu uchta faylni o'qi:
1. docs/HANDOFF.md          — joriy holat, env'lar, build yo'llari, TUZOQLAR
2. docs/SESSION-2026-08.md  — qabul qilingan qarorlar va ularning sabablari
3. docs/CUSTOMER-APP-PLAN.md — mijoz ilovasi rejasi va ochiq savollar

MUHIM: bu ISHLAB TURGAN tizim, haqiqiy haydovchi va mijozlar bor.
Prod'ga tegishdan oldin ayt. Baza tozalash, deploy, Railway o'zgaruvchisi —
bularni so'ramasdan qilma.

Menda bor: railway CLI (login qilingan), eas CLI (hisob `jav1on`),
gh CLI, Android SDK (APK'ni lokal yig'ish uchun — bulut limiti tugagan).

ISH USULI (bular qimmatga tushgan saboqlar, HANDOFF 5-bo'limda batafsil):
- "Ishlamayapti" desam — avval LOG o'qi, koddan taxmin qilma.
  Prod: railway logs --service api
  Telefon: adb logcat -b crash -d   (USB bilan ulayman)
- Tuzatish uchun avval regressiya simi yoz va u tuzatishsiz YIQILISHINI
  isbotla (scripts/*-sim.mjs naqshi bo'yicha).
- Bir xil ishni qiladigan ikkinchi yo'l bo'lsa, ikkalasini yonma-yon
  solishtir — bu loyihada asimmetriya xatosi 7 marta takrorlangan.
- Xatoni jimgina yutma, ekranga chiqar.
- Expo ilovalarida package-lock.json ni O'CHIRMA (expo-font darhol SDK 54
  ga suriladi va build yiqiladi).

HOZIRGI HOLAT:
- API, bot, admin, Mini App — prod'da ishlaydi
- Haydovchi ilovasi — ishlaydi, APK relizda
- Mijoz ilovasi — yangi, asosiy oqim ishlaydi (Telegram orqali kirish +
  kod, xaritadan buyurtma, kuzatuv, bekor qilish, baholash)
- Ikkala APK: github.com/javlonnomozov-portfolio/taxy-project/releases

KEYINGI ISHLAR (muhimlik tartibida):
1. Mijoz ilovasi dizayni — men maket berganman: xarita + pastki karta
   (Qayerdan? / Uy / Ish) + tab paneli. Faqat OLIB KETISH nuqtasi,
   borish joyi shart emas, manzil FAQAT xaritadan (nomi bo'yicha
   qidirish bekor qilingan).
   Hal qilinmagan: "Daromad" tabi mijozda nima bo'lishi, "Kabinet"
   nima ko'rsatishi, "Uy"/"Ish" saqlangan manzillar (jadval yo'q).
2. CustomerGateway ga JWT — hozir ilova socket o'rniga polling qilyapti
3. Mijoz ilovasiga FCM kaliti (alohida Expo loyihasi)
4. Mijozni bloklash endpointi yo'q (ustun va kod bor, operator ishlatolmaydi)

Tayyor bo'lsang ayt, nimadan boshlashimizni aytaman.
```

---

## Nega shunday yozilgan

- **Hujjatlarni o'qishdan boshlaydi** — kontekstni qayta tushuntirish shart emas.
- **Prod ogohlantirishi** — bu tizimda haqiqiy foydalanuvchilar bor.
- **Ish usuli** bandi eng muhimi: shu sessiyada eng ko'p vaqt "log o'qish
  o'rniga koddan taxmin qilish" ga ketgan.
- **Ochiq savollar** ro'yxati — yangi chat ularni qaytadan so'ramasligi uchun.
