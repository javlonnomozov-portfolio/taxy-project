# 02 — Telegram Bot (Mijoz)

**Stack:** Telegraf (`nestjs-telegraf`) · i18n (uz/ru) · backend API + Socket.IO
(status yangilanishlari). Bot backend `api` bilan bir monorepo'da (alohida yoki umumiy
service — [05-infra-devops.md](05-infra-devops.md)).

Bog'liq: [01-backend.md](01-backend.md), [06-domain-model.md](06-domain-model.md).

---

## Best practices
- Sahna (scene/wizard) asosida oqim; holatni serverda/Redis'da saqlash.
- Barcha matn i18n kalitlar orqali (uz/ru); til foydalanuvchi profilida.
- Idempotent handlerlar; tugma (inline keyboard) callback'lari uchun himoya.
- Location — Telegram native "Attach → Location" yoki live location.

---

## 1. Ro'yxatdan o'tish va til
- [ ] `/start` → til tanlash (uz/ru), keyin **telefon ulashish** (contact tugma)
- [ ] Customer auto-create (telegram_id, phone, til) backend orqali
- [ ] **Onboarding:** qisqa qadamli tanishtiruv (qanday taksi chaqirish) + "Yordam"
- [ ] Asosiy menyu: 🚕 Taksi chaqirish · 🕒 Oldindan buyurtma · 📋 Buyurtmalarim · ⚙️ Sozlamalar · ❓ Yordam

## 2. Taksi chaqirish oqimi
- [ ] **Lokatsiya yuborish** (olib ketish nuqtasi) → reverse geocode ko'rsatish
- [ ] **Mashina toifasi** tanlash: Oddiy / Komfort / Yukli
- [ ] **Manzil (ixtiyoriy):** yozish yoki xaritadan; berilsa **taxminiy narx** ko'rsatiladi
- [ ] **Izoh (ixtiyoriy):** "2 yo'lovchi", "yukim bor"
- [ ] Tasdiqlash → buyurtma yaratish (`POST /orders`)
- [ ] Cheklov: bir vaqtda bitta faol buyurtma (aks holda ogohlantirish)

## 3. Jonli status (buyurtmadan keyin)
- [ ] Holat xabarlari (Socket→bot→foydalanuvchi): izlanmoqda → topildi → yo'lda →
      yetib keldi → safarda → yakunlandi
- [ ] Haydovchi topilgach **haydovchi kartasi:** ism, mashina (rang/model/raqam),
      telefon, reyting; xaritada jonli joylashuvi + ETA
- [ ] **Bekor qilish** tugmasi (jarimasiz oyna qoidasi bilan — 2.9)
- [ ] Yakunda: yakuniy **narx** + (ixtiyoriy) **baholash** (kategoriyali yulduz)

## 4. Oldindan buyurtma
- [ ] Sana/vaqt tanlash (bir necha soatdan 1–2 kungacha)
- [ ] Operator ~2 soat oldin bog'lanib tasdiqlashini tushuntirish
- [ ] Tasdiqlangach oddiy oqimga o'tadi (dispatch)

## 5. Xavfsizlik va maxfiylik
- [ ] **SOS** tugmasi (safar davomida) → operatorga signal + joylashuv
- [ ] **Safarni ulashish** — jonli havolani yaqinlarга yuborish
- [ ] Sozlamalar: **`show_name`** (ism-familiyani haydovchiga ko'rsatish/yashirish)
- [ ] **Shikoyat** (safardan keyin): narx/safar/xatti-harakat

## 6. Boshqalar
- [ ] Buyurtmalar tarixi (narx, sana, haydovchi)
- [ ] Til/profil sozlamalari
- [ ] Operatordan kelgan xabarlarni ko'rsatish ("topilmadi", "kuting" va h.k.)

## Verification (bot)
- [ ] Test bot orqali to'liq oqim: chaqirish → status → yakun → baho
- [ ] Til almashtirish (uz/ru) barcha matnlarda ishlaydi
- [ ] Bir vaqtda ikkinchi buyurtma bloklanishi
