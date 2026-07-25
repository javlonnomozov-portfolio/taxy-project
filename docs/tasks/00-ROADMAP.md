# Toy TaxY (TTY) — ROADMAP

> Mahalliy taksilar uchun buyurtma platformasi. Mijoz **Telegram bot** orqali taksi
> chaqiradi → buyurtma **eng yaqin haydovchilarga** (React Native ilova) real vaqtda
> ko'rinadi → qulay haydovchi oladi. **Operator** kuzatadi va muammoli holatlarni hal
> qiladi.

Bu fayl umumiy yo'l xaritasi. Har modul tasklari alohida fayllarda:
- [01-backend.md](01-backend.md) — NestJS API + dispatch
- [02-telegram-bot.md](02-telegram-bot.md) — mijoz boti
- [03-driver-app.md](03-driver-app.md) — haydovchi RN ilovasi
- [04-admin-operator.md](04-admin-operator.md) — admin/operator veb-panel
- [05-infra-devops.md](05-infra-devops.md) — infra + Railway deploy
- [06-domain-model.md](06-domain-model.md) — ma'lumot modeli + kontraktlar

---

## Texnologiya (tasdiqlangan)

| Qism | Texnologiya |
|------|-------------|
| Backend | Node.js + **NestJS** (TypeScript) |
| Real-time | **Socket.IO** |
| DB | **PostgreSQL + PostGIS** |
| Geo-index / cache / pub-sub | **Redis** (`GEOSEARCH`) |
| Telegram bot | **Telegraf** (`nestjs-telegraf`) |
| Haydovchi ilova | **React Native** |
| Admin panel | **React (Vite)** |
| Xarita | **OpenStreetMap** — MapLibre (tiles) + **OSRM** (routing) + **Nominatim** (geocode) |
| Push | **FCM** |
| Til | **O'zbek + Rus** (i18n) |
| Deploy | **Railway** (barcha partlar) |
| Monorepo | pnpm workspaces |

---

## Asosiy biznes qarorlar (qisqacha)

- **Narx:** base **4000 so'm** + jonli taksometr (haqiqiy yurilgan km) + kutish haqi +
  tungi tarif koeffitsienti + mashina toifasi tarifi. Manzil **ixtiyoriy**; berilsa
  taxminiy narx ko'rsatiladi.
- **Dispatch:** eng yaqin **5–7 haydovchi** (siljuvchi oyna) → birinchi "Qabul" yutadi.
  Otmen bo'lsa keyingi haydovchi qo'shiladi. Reyting tie-break. Toifa + blok filtri.
- **To'lov modeli:** naqd; platforma daromadi **default obuna**, admin har haydovchiga
  obuna/foiz/gibrid sozlaydi. Anti-bypass: sodiqlik bonusi, shikoyat+jazo (KYC).
- **Baholash:** ikki tomonlama, kategoriyali yulduz (ixtiyoriy) + avtomatik metrikalar.
- **Xavfsizlik:** ofisda KYC, SOS, safarni ulashish, GPS trek saqlash.
- **Rollar:** super-admin / admin / operator (RBAC).
- **Cheklovlar:** haydovchi & mijoz — bir vaqtda bitta faol buyurtma; bitta shahar.

To'liq tafsilotlar: [rejadagi 2-bo'lim workflow] va modul fayllari.

---

## Sprintlar

### Sprint 0 — Skelet (fundament)
**Maqsad:** monorepo va infra tayyor, bo'sh servislar ishga tushadi.
- [ ] Monorepo (pnpm workspaces): `apps/api`, `apps/bot`, `apps/admin`, `apps/driver-app`, `packages/shared`
- [ ] Docker Compose: Postgres+PostGIS, Redis (lokal dev)
- [ ] NestJS `api` skeleti (health endpoint), config module, ENV validatsiya
- [ ] `bot` skeleti (Telegraf, /start javob beradi)
- [ ] `admin` skeleti (Vite React, login sahifa placeholder)
- [ ] `driver-app` skeleti (RN, bo'sh ekran + login placeholder)
- [ ] Domain model migratsiyalari ([06-domain-model.md](06-domain-model.md))
- [ ] Lint/format/CI (GitHub Actions), Railway service konfiguratsiyalari
- **Done:** `docker compose up` + har servis lokal ishga tushadi; migratsiya o'tadi.

### Sprint 1 — Asosiy oqim (core dispatch)
**Maqsad:** buyurtma yaratish → dispatch → qabul → holat yangilanishi ishlaydi.
- [ ] Auth: mijoz (Telegram), haydovchi (telefon+SMS/OTP), JWT + RBAC
- [ ] Haydovchi ro'yxatdan o'tish (bosqichli) + admin tasdiq holati
- [ ] Bot: telefon ulashish, taksi chaqirish (lokatsiya, toifa, izoh), buyurtma yaratish
- [ ] Driver-app: onlayn/oflayn, joylashuv yuborish (Redis), taklif ekrani, qabul/otmen
- [ ] **Dispatch engine** (siljuvchi oyna, atomik biriktirish, radius eskalatsiyasi)
- [ ] Socket.IO gateway: taklif, holat yangilanishi, jonli joylashuv
- [ ] Order lifecycle: CREATED→DISPATCHING→ACCEPTED→CONFIRMED→ARRIVING→ARRIVED→IN_PROGRESS→COMPLETED
- **Done:** test bot orqali buyurtma → simulyator haydovchi qabul qiladi → holatlar oqadi.

### Sprint 2 — Taksometr + operator + xavfsizlik
**Maqsad:** narx hisoblanadi, operator kuzatadi, asosiy xavfsizlik bor.
- [ ] Taksometr: base + km + kutish haqi + tungi tarif + toifa tarifi
- [ ] Mijoz no-show oqimi (kutish taymeri + belgilash)
- [ ] Bekor qilish qoidasi (jarimasiz oyna + metrikaga yozish)
- [ ] Admin/operator panel: jonli xarita, buyurtma monitoring, qizil eskalatsiya, aralashuv
- [ ] Haydovchi KYC tasdiq (hujjat nusxalari), blok
- [ ] SOS, safarni ulashish, GPS trek saqlash
- [ ] Qo'lda biriktirish (NO_DRIVER), qo'lda surge koeffitsient
- **Done:** to'liq safar naqd narx bilan yakunlanadi; operator kuzatadi/aralasha oladi.

### Sprint 3 — Sayqal (monetizatsiya + reputatsiya + qulaylik)
**Maqsad:** biznes model, baholash, qo'shimcha turlar, kuzatuv.
- [ ] To'lov modeli: per-haydovchi obuna/foiz/gibrid, balans/transaksiyalar, ofis naqd
- [ ] Anti-bypass: sodiqlik bonusi, maxfiylik (`show_name`), shikoyat/jazo, qora ro'yxat
- [ ] Ikki tomonlama baholash + reputatsiya (metrikalar, dispatch tie-break, flaglar)
- [ ] Oldindan buyurtma (operator 2 soat oldin tasdiqlaydi)
- [ ] Push (FCM), i18n uz/ru, onboarding yo'riqnoma
- [ ] Statistika (admin) + haydovchi sodda statistikasi
- [ ] Nizolar (shikoyat + GPS/narx logi), e'lon yuborish
- [ ] Monitoring (Sentry + loglar), ma'lumot saqlash siyosati (retention)
- [ ] Anti-fraud: taksometr vs OSRM masofasi solishtirish
- **Done:** monetizatsiya ishlaydi, reputatsiya dispatch'ga ta'sir qiladi, kuzatuv bor.

---

## Keyingi bosqich (MVP'dan tashqari)
Shahar tashqarisi buyurtma · yuk/pochta yetkazish (COD modeli) · Payme/Click cashless ·
masked/proxy qo'ng'iroq · avtomatik surge · hujjat muddati kuzatuvi · referral/promokod ·
saqlangan manzillar (uy/ish) · qoraqalpoq/ingliz til · Play Store.

---

## Bog'liqliklar (tartib)
```
06-domain-model  ─▶  01-backend  ─┬─▶ 02-telegram-bot
                                  ├─▶ 03-driver-app
                                  └─▶ 04-admin-operator
05-infra-devops  ─▶ (barcha partlarni deploy)
```
