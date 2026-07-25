# 03 — Haydovchi ilovasi (React Native)

**Stack:** React Native · MapLibre GL Native (OSM tiles) · Socket.IO client · FCM ·
background geolocation · lokal DB (offline buffer: SQLite/MMKV) · i18n (uz/ru).

Bog'liq: [01-backend.md](01-backend.md), [06-domain-model.md](06-domain-model.md).
Tarqatish (hozircha): **APK** ([05-infra-devops.md](05-infra-devops.md)).

---

## Best practices
- Narx/masofa faqat serverdan tasdiqlanadi; ilova ko'rsatadi, hisob-kitob serverda.
- Background location — ruxsatlar (foreground service Android), batareyani hisobga olish.
- Offline-first: safar/GPS lokal saqlanadi, ulanganda sync (idempotent).
- Socket qayta ulanish (reconnect) + holatni serverdan qayta olish.

## 1. Auth va onboarding
- [ ] Telefon + OTP login → JWT saqlash (secure storage)
- [ ] Ro'yxatdan o'tish: shaxsiy + mashina + toifa ma'lumoti (hujjatlar ofisda olinadi)
- [ ] **Admin tasdig'ini kutish** holati (pending ekrani)
- [ ] Onboarding qadamli yo'riqnoma + Yordam; til (uz/ru)

## 2. Onlayn/oflayn va joylashuv
- [ ] Katta **Onlayn/Oflayn** tugmasi (status)
- [ ] **Moslashuvchan GPS:** bo'sh ~10–15 sek, taklif/safarda ~3–5 sek
- [ ] Background/foreground service; **avto-oflayn** X daqiqa harakatsizlikda
- [ ] Joylashuvni Socket orqali yuborish (throttle)

## 3. Taklif (offer) ekrani
- [ ] `order:offer` kelganда: olib ketish nuqtasi (xarita), masofa/ETA, toifa, izoh,
      (bor bo'lsa) manzil, mijoz (raqam; ism faqat `show_name` bo'lsa)
- [ ] **Taymer** (15–20 sek), **Qabul** / **Otmen** tugmalari
- [ ] Push + ovoz/vibratsiya (ilova fonda bo'lsa ham)
- [ ] Boshqa haydovchi olsa `order:offer_cancelled` → ekrandan yo'qoladi

## 4. Safar oqimi
- [ ] Qabul → **CONFIRMED:** mijoz bilan bog'lanish/tasdiq (qo'ng'iroq yoki tugma)
- [ ] Navigatsiya: mijoz oldiga marshrut (OSRM) xaritada
- [ ] **"Yetib keldim"** (ARRIVED) → kutish taymeri; **"Mijoz kelmadi"** (no-show)
- [ ] **"Safar boshlandi"** (IN_PROGRESS) → jonli **taksometr** (base + km + kutish +
      tungi + toifa; server tasdiqlaydi)
- [ ] **"Tugatdim"** (COMPLETED) → naqd yakuniy narx ko'rsatiladi
- [ ] (Ixtiyoriy) **riderni baholash** (kategoriyali yulduz)

## 5. Offline-chidamlilik
- [ ] Safar davomida GPS trek + taksometr **lokal buffer**
- [ ] Ulanish qaytganda `trip:track_sync` orqali serverga yuborish (reconcile)
- [ ] Aloqa uzilsa ham taksometr ishlashda davom etadi

## 6. Balans, statistika, xavfsizlik
- [ ] **Balans:** joriy balans, obuna/foiz holati, transaksiyalar tarixi
- [ ] **Sodda statistika:** kunlik/haftalik daromad, safar soni, onlayn vaqt
- [ ] **SOS** tugmasi (safar davomida)
- [ ] Buyurtma tarixi
- [ ] Admin **e'lonlari** (announcement) ko'rsatish

## Verification (driver-app)
- [ ] Simulyatorda: onlayn → taklif → qabul → CONFIRMED → ... → COMPLETED
- [ ] Offline test: internet uzib safar, qayta ulanганda sync
- [ ] Avto-oflayn va moslashuvchan GPS chastotasi ishlashi
