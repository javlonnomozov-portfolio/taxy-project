# 04 — Admin / Operator veb-panel (React)

**Stack:** React (Vite) · MapLibre GL JS (OSM tiles) · Socket.IO client (`/ops`) ·
backend REST (RBAC) · i18n (uz/ru).

Bog'liq: [01-backend.md](01-backend.md), [06-domain-model.md](06-domain-model.md).

---

## Rollar (RBAC)
- **super-admin:** hamma narsa + tizim sozlamalari, admin_users boshqaruvi
- **admin:** haydovchi/KYC/balans/tariflar/e'lon
- **operator:** buyurtma monitoring, aloqa, aralashuv, shikoyat, blok

UI har rolga mos ko'rinadi (menyu/harakatlar huquqqa qarab).

## Best practices
- Barcha yozuv harakatlari huquq tekshiruvidan o'tadi (frontend + backend).
- Jonli ma'lumot Socket orqali; muhim harakatlar tasdiqlashli (confirm).
- Katta ro'yxatlar — sahifalash/filtr/qidiruv.

---

## 1. Auth va layout
- [ ] Login (panel) → JWT; rolga qarab marshrutlash
- [ ] Layout, navigatsiya, til almashtirish

## 2. Jonli xarita (operator asosiy ekrani)
- [ ] Barcha **onlayn haydovchilar** (holat rangi) va **aktiv buyurtmalar** xaritada
- [ ] Real vaqt yangilanish (`driver:update`, `order:update`)
- [ ] Filtrlar (toifa, holat, hudud)

## 3. Buyurtma monitoringi + aralashuv
- [ ] Buyurtmalar ro'yxati/detali; holat tarixi (`order_events`)
- [ ] **Qizil eskalatsiya:** NO_DRIVER / eskirgan buyurtma alert
- [ ] **Qo'lda biriktirish** (biror haydovchiga) yoki **yopish** (CLOSED_BY_OPERATOR)
- [ ] Mijoz/haydovchiga bog'lanish (raqam) + botdan xabar yuborish ("kuting"/"topilmadi")

## 4. SOS va nizolar
- [ ] **SOS monitoringi:** kelgan signallar + joylashuv, tezkor ko'rinadi
- [ ] **Shikoyatlar:** ro'yxat, GPS trek + narx logini ko'rish, yechim/izoh, holat

## 5. Haydovchilar (admin)
- [ ] Ro'yxat, qidiruv, profil
- [ ] **KYC tasdiq:** ofisda olingan hujjat nusxalari (pasport/prava/guvohnoma) ko'rish/tasdiq
- [ ] Blok / faollashtirish
- [ ] **To'lov modeli:** per-haydovchi obuna/foiz/gibrid + qiymat sozlash
- [ ] **Balans:** ko'rish, ofis naqd to'ldirishni kiritish, transaksiyalar
- [ ] Reputatsiya flaglari (past reyting / yuqori bekor) — ogohlantirish/blok

## 6. Oldindan buyurtmalar
- [ ] Rejalashtirilgan buyurtmalar ro'yxati (vaqt bo'yicha)
- [ ] ~2 soat oldin mijoz bilan **tasdiqlash** oqimi → dispatch'ga uzatish

## 7. Sozlamalar (admin/super-admin)
- [ ] Tariflar (toifa bo'yicha: base/km/kutish), tungi tarif, **qo'lda surge**
- [ ] Dispatch: oyna hajmi, offer timeout, radius qadamlari, no-driver timeout
- [ ] Jarimasiz bekor oynasi, reyting/bekor chegaralari
- [ ] Xizmat zonasi (markaz + radius/chegara), retention muddati

## 8. E'lon va qora ro'yxat
- [ ] **E'lon yuborish:** barcha/tanlangan haydovchilarga push/xabar
- [ ] **Qora ro'yxat:** mijoz/haydovchi blok, bloklangan juftliklar

## 9. Statistika
- [ ] Buyurtma soni, bajarilish %, o'rtacha kutish vaqti, reyting taqsimoti
- [ ] (Sprint 3) grafiklar — [dataviz ko'rsatmalariga amal qilish]

## Verification (admin)
- [ ] Har rol (super-admin/admin/operator) mos huquq bilan ishlashi
- [ ] Jonli xarita real vaqt yangilanishi
- [ ] NO_DRIVER → qizil alert → qo'lda biriktirish oqimi
