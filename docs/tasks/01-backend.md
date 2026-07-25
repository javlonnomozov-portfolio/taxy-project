# 01 — Backend (NestJS API + Dispatch)

**Stack:** NestJS (TypeScript) · TypeORM/Prisma · PostgreSQL+PostGIS · Redis ·
Socket.IO · Telegraf (bot bilan umumiy yoki alohida). Modul-asosli arxitektura.

Bog'liq: [06-domain-model.md](06-domain-model.md).

---

## Best practices (butun backend uchun)
- Konfiguratsiya `@nestjs/config` + ENV validatsiya (zod/joi). Sirlar ENV'da.
- DTO + `class-validator` bilan kirish validatsiyasi; global `ValidationPipe`.
- Barcha pul/masofa hisob-kitobi **serverda** (mijoz/haydovchi ilovaga ishonmaslik).
- Xatoliklar: global exception filter, strukturali log (pino), Sentry.
- Testlar: dispatch va taksometr uchun unit; asosiy oqim uchun e2e.
- Migratsiyalar versiyalangan; `synchronize: false` (production).

---

## 1. Skelet va infratuzilma
- [ ] NestJS app + modul struktura (`auth`, `customers`, `drivers`, `orders`,
      `dispatch`, `pricing`, `geo`, `realtime`, `ratings`, `billing`, `ops`, `notifications`)
- [ ] Config module + ENV sxema validatsiya
- [ ] DB ulanish (Postgres+PostGIS), migratsiya toolchain
- [ ] Redis ulanish (ioredis) + Socket.IO Redis adapter
- [ ] Health endpoint (`/health`) — DB/Redis tekshiruvi
- [ ] Global: ValidationPipe, exception filter, logger, request-id

## 2. Auth va RBAC
- [ ] Haydovchi OTP: `POST /auth/driver/otp`, `/verify` → JWT (SMS provayder abstraktsiyasi)
- [ ] Mijoz identifikatsiyasi: Telegram `telegram_id` orqali (bot backend'da)
- [ ] Admin panel login → JWT, rollar **super_admin/admin/operator**
- [ ] RBAC guard + `@Roles()` dekorator; huquqlar matritsasi
- [ ] JWT refresh, blok qilingan foydalanuvchini rad etish

## 3. Foydalanuvchilar
- [ ] Customer CRUD (bot orqali auto-create), `show_name`, til, blok
- [ ] Driver ro'yxatdan o'tish, profil, `approval_status`, vehicle + `category`
- [ ] Driver KYC: hujjat yuklash/status (fayl saqlash — S3-mos yoki Railway volume)

## 4. Geo servis
- [ ] Redis `GEOADD`/`GEOSEARCH` — jonli haydovchi joylashuvi (radius bo'yicha)
- [ ] Joylashuvni qabul qilish (Socket) + throttle/rate-limit
- [ ] OSRM klient (marshrut, masofa, ETA), Nominatim klient (reverse/forward geocode)
- [ ] Xizmat zonasi tekshiruvi (pickup zona ichidami)

## 5. Dispatch engine ⭐ (yadro)
- [ ] Buyurtma yaratilганda nomzod tanlash: `GEOSEARCH` → **eng yaqin 5–7** ONLINE_IDLE,
      **toifa** + **blok** + **reputatsiya** filtri (tie-break reyting)
- [ ] Nomzodlarga Socket.IO orqali `order:offer` + har biriga **offer timeout**
- [ ] Otmen/timeout → keyingi eng yaqin haydovchini oynaga qo'shish (siljuvchi oyna)
- [ ] **Atomik biriktirish:** birinchi qabul yutadi (Redis lock yoki
      `UPDATE orders SET driver_id=... WHERE id=... AND status='DISPATCHING'`)
- [ ] Biriktirilgach qolganlarga `order:offer_cancelled`
- [ ] Radius eskalatsiyasi (2→4→6 km) nomzod tugaganda
- [ ] `no_driver_timeout` → status **NO_DRIVER** + `/ops` `alert`
- [ ] Barcha qadamlarni `order_events`'ga yozish

## 6. Order lifecycle
- [ ] Yaratish (bot), toifa, izoh, ixtiyoriy manzil, oldindan buyurtma (`scheduled_at`)
- [ ] Holat o'tishlari: ACCEPTED→CONFIRMED→ARRIVING→ARRIVED→IN_PROGRESS→COMPLETED
- [ ] Bekor qilish (mijoz/haydovchi/operator) + **jarimasiz oyna** qoidasi
- [ ] Mijoz **no-show** (ARRIVED taymer → CUSTOMER_NO_SHOW + kutish haqi)
- [ ] Cheklov: mijoz & haydovchi bir vaqtda bitta faol buyurtma

## 7. Pricing / taksometr
- [ ] Toifa tarifi (base/per_km/waiting) + tungi koeffitsient + qo'lda surge
- [ ] Jonli taksometr: haydovchidan GPS masofa → narx; server yakuniy `final_price`
- [ ] Kutish haqi hisobi (ARRIVED → start orasidagi ortiqcha vaqt)
- [ ] Manzil berilsa taxminiy narx (OSRM) — faqat ko'rsatma
- [ ] Anti-fraud (Sprint 3): taksometr masofasini OSRM bilan solishtirish

## 8. Realtime (Socket.IO)
- [ ] Namespace'lar: `/driver`, `/customer`, `/ops` (06-kontrakt)
- [ ] Auth middleware (JWT), Redis adapter (ko'p instansiya uchun)
- [ ] Location fan-out: mijozga faqat o'z buyurtmasi haydovchisi joylashuvi

## 9. Billing (Sprint 3)
- [ ] Per-haydovchi `billing_mode` (subscription/percent/hybrid) + `billing_config`
- [ ] Safar yakunida foiz yechish yoki obuna hisobi; `transactions`
- [ ] Balans manfiy → buyurtma cheklovi; ofis naqd to'ldirish (admin)
- [ ] Sodiqlik bonusi hisobi

## 10. Ratings / reputation (Sprint 3)
- [ ] Baho yozish (kategoriyali, ikki tomonlama, ixtiyoriy)
- [ ] Metrika hisoblash (cancel_rate, acceptance_rate, no_show, rating_avg)
- [ ] Chegara oshsa flag → `/ops` alert; dispatch tie-break'da ishlatish

## 11. Ops / admin API (RBAC)
- [ ] Monitoring, qo'lda biriktirish/yopish, KYC tasdiq, blok, blocklist
- [ ] Settings (tariflar, dispatch, surge, zona, retention), e'lon yuborish
- [ ] Statistika (buyurtma soni, bajarilish %, kutish vaqti, reyting taqsimoti)

## 12. Notifications
- [ ] FCM push (haydovchi ilova) abstraktsiyasi
- [ ] Bot orqali mijozga xabar yuborish interfeysi (bot service'ga event)

## Verification (backend)
- [ ] Unit: dispatch (siljuvchi oyna, atomik biriktirish, radius), taksometr, metrika
- [ ] e2e: buyurtma yaratish→dispatch→qabul→CONFIRMED→...→COMPLETED
- [ ] Dispatch simulyatsiyasi: Redis'ga soxta haydovchilar → faqat 5–7 taklif, otmen→keyingi
