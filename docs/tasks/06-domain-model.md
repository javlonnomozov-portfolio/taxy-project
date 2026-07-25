# 06 — Domain Model & Kontraktlar

Ma'lumot modeli, state mashinalari, Socket.IO va REST kontraktlari. Bu fayl boshqa
barcha modullar uchun **manba haqiqat** (source of truth).

---

## 1. State mashinalari

### Order (buyurtma) holatlari
```
CREATED
  → DISPATCHING            (yaqin haydovchilarga taklif ketmoqda)
  → ACCEPTED               (haydovchi qabul qildi)
  → CONFIRMED              (haydovchi mijoz bilan tasdiqladi)
  → ARRIVING               (mijoz oldiga bormoqda)
  → ARRIVED                (yetib keldi, kutish taymeri)
  → IN_PROGRESS            (safar boshlandi, taksometr ishlaydi)
  → COMPLETED              (yakunlandi, narx belgilandi)

Terminal/qo'shimcha:
  CANCELLED_BY_CUSTOMER
  CANCELLED_BY_DRIVER
  CUSTOMER_NO_SHOW         (mijoz kelmadi; kutish haqi + no-show metrikasi)
  NO_DRIVER                (haydovchi topilmadi; operatorga eskalatsiya)
  CLOSED_BY_OPERATOR
```

### Driver (haydovchi) holatlari
```
OFFLINE → ONLINE_IDLE → OFFERED → ON_TRIP → ONLINE_IDLE
```
- Avto-oflayn: X daqiqa harakatsizlik → OFFLINE.
- ON_TRIP paytida yangi taklif kelmaydi (bir vaqtda bitta buyurtma).

---

## 2. Jadvallar (PostgreSQL + PostGIS)

> Ustunlar indikativ; migratsiyada aniqlashtiriladi. `id` — UUID; `created_at`,
> `updated_at` — hamma jadvalda. Geo maydonlar `geography(Point,4326)`.

### `customers`
| ustun | tur | izoh |
|-------|-----|------|
| id | uuid | PK |
| telegram_id | bigint | unique |
| phone | text | |
| first_name, last_name | text | |
| show_name | boolean | haydovchiga ism ko'rinsinmi (2.10.1) |
| language | text | `uz` / `ru` |
| is_blocked | boolean | |
| rating_avg | numeric | keshlangan (2.8) |
| cancel_rate, no_show_count | numeric/int | avtomatik metrika |

### `drivers`
| ustun | tur | izoh |
|-------|-----|------|
| id | uuid | PK |
| phone | text | unique |
| first_name, last_name | text | |
| status | enum | OFFLINE/ONLINE_IDLE/OFFERED/ON_TRIP |
| approval_status | enum | pending/approved/blocked (KYC) |
| billing_mode | enum | subscription/percent/hybrid (default subscription) |
| billing_config | jsonb | tarif qiymatlari (obuna narxi, foiz %) |
| rating_avg | numeric | keshlangan |
| cancel_rate, acceptance_rate, completion_rate | numeric | avtomatik metrika |
| last_location | geography(Point) | oxirgi joylashuv (backup; jonli — Redis) |
| last_seen_at | timestamptz | avto-oflayn uchun |

### `vehicles`
| id, driver_id | uuid | |
| make, model, color, plate | text | |
| category | enum | standard / comfort / cargo (2.13) |

### `driver_documents` (KYC)
| id, driver_id | uuid | |
| type | enum | passport/license/vehicle_cert |
| file_url | text | nusxa (ofisda olingan) |
| status | enum | pending/approved/rejected |
| expires_at | date | (kuzatuv — keyingi bosqich) |

### `orders`
| ustun | tur | izoh |
|-------|-----|------|
| id | uuid | PK |
| customer_id | uuid | FK |
| driver_id | uuid | FK, null (biriktirilgach) |
| order_type | enum | standard / scheduled (MVP); intercity/delivery — zaxira |
| status | enum | yuqoridagi Order holatlari |
| vehicle_category | enum | mijoz tanlagan toifa |
| pickup_point | geography(Point) | |
| pickup_address | text | (reverse geocode) |
| dest_point | geography(Point) | nullable (ixtiyoriy) |
| dest_address | text | nullable |
| note | text | izoh |
| scheduled_at | timestamptz | oldindan buyurtma uchun |
| estimated_price | numeric | manzil berilsa (OSRM) |
| final_price | numeric | taksometr yakuni |
| distance_m | int | haqiqiy yurilgan masofa |
| waiting_minutes | int | kutish |
| surge_multiplier, night_multiplier | numeric | qo'llangan koeffitsientlar |
| commission_amount | numeric | (foiz modelida) |
| created_at, accepted_at, started_at, completed_at | timestamptz | |

### `order_events` (audit + metrika manbasi)
| id, order_id | uuid | |
| type | enum | created/dispatched/offered/accepted/declined/cancelled/arrived/started/completed/no_show/... |
| actor | enum | customer/driver/operator/system |
| actor_id | uuid | |
| reason | text | |
| payload | jsonb | |
| created_at | timestamptz | |

### `driver_locations`
> Jonli joylashuv **Redis**'da (`GEOSEARCH`). PostGIS'ga faqat davriy snapshot/oxirgi.

### `trip_tracks`
| id, order_id | uuid | |
| points | jsonb / geography(LineString) | GPS trek (offline sync natijasi) |
| retention_until | date | saqlash siyosati (2.15) |

### `tariffs`
| id | uuid | |
| category | enum | standard/comfort/cargo |
| base_fare | numeric | (default 4000) |
| per_km | numeric | |
| waiting_per_min | numeric | |
| free_wait_min | int | |
| night_from, night_to | time | |
| night_multiplier | numeric | |

### `settings` (global, key-value yoki bitta config qator)
- dispatch: `window_size` (5–7), `offer_timeout_sec` (15–20), `radius_steps` (2/4/6 km),
  `no_driver_timeout_sec`
- cancel: `free_cancel_sec`
- reputation: `min_rating`, `max_cancel_rate` chegaralari
- surge: `manual_multiplier`, `active`
- service_zone: markaz + radius/polygon
- retention_months (6–12)

### `ratings`
| id | uuid | |
| order_id | uuid | |
| from_role, to_role | enum | customer/driver |
| from_id, to_id | uuid | |
| scores | jsonb | kategoriya → 1..5 (muomala, haydash, ...) |
| comment | text | nullable |

### `reputation_stats` (keshlangan; yoki `order_events`'dan view)
| user_type, user_id | | |
| rating_avg, cancel_rate, acceptance_rate, no_show_count | | |

### `driver_balance` / `transactions`
- `driver_balance`: driver_id, balance
- `transactions`: driver_id, type (topup/commission/subscription/bonus), amount, ref_order_id, note

### `complaints`, `blocklist`, `announcements`, `loyalty_bonuses`, `sos_events`
- `complaints`: order_id, from, target, category, text, status(open/resolved), operator_note
- `blocklist`: customer_id, driver_id (juftlik yoki bir tomonlama), reason, created_by
- `announcements`: title, body, audience(all/selected), driver_ids, sent_at
- `loyalty_bonuses`: driver_id, rule, amount, granted_at
- `sos_events`: order_id, user, location, created_at, status

### `admin_users` (panel)
| id, phone/login, password_hash | | |
| role | enum | super_admin / admin / operator (RBAC) |

---

## 3. Socket.IO kontrakti (event nomlari)

### Namespace: `/driver` (haydovchi ilova)
| yo'nalish | event | payload |
|-----------|-------|---------|
| C→S | `driver:online` / `driver:offline` | `{}` |
| C→S | `driver:location` | `{ lat, lng, heading, speed }` |
| C→S | `driver:offer_response` | `{ orderId, accept: bool }` |
| C→S | `trip:arrived` / `trip:start` / `trip:complete` / `trip:no_show` | `{ orderId }` |
| C→S | `trip:track_sync` | `{ orderId, points[] }` (offline sync) |
| S→C | `order:offer` | `{ orderId, pickup, distance, category, note, customer{...} }` |
| S→C | `order:offer_cancelled` | `{ orderId }` (boshqa oldi) |
| S→C | `order:assigned` | `{ orderId, customer, meterConfig }` |
| S→C | `announcement` | `{ title, body }` |

### Namespace: `/customer` (bot backend proksi qiladi)
| S→C | `order:status` | `{ orderId, status, driver?{...}, eta? }` |
| S→C | `driver:location` | `{ orderId, lat, lng }` (jonli kuzatuv) |

### Namespace: `/ops` (admin/operator panel)
| S→C | `order:update` | `{ order }` |
| S→C | `driver:update` | `{ driver }` |
| S→C | `alert` | `{ type: NO_DRIVER/SOS/..., orderId, ... }` |

---

## 4. REST endpoint ro'yxati (yuqori daraja)

```
POST /auth/driver/otp            OTP yuborish
POST /auth/driver/verify         OTP tekshirish → JWT
POST /auth/admin/login           panel login → JWT

# Buyurtma (asosan bot backend chaqiradi)
POST /orders                     buyurtma yaratish
GET  /orders/:id                 holat
POST /orders/:id/cancel          bekor qilish

# Haydovchi
POST /drivers/register           ro'yxatdan o'tish
GET  /drivers/me                 profil + balans + statistika
GET  /drivers/me/stats           kunlik/haftalik statistika

# Ratings / complaints
POST /ratings                    baho berish
POST /complaints                 shikoyat

# Admin/Operator (RBAC)
GET  /ops/orders                 monitoring (filtrlar)
POST /ops/orders/:id/assign      qo'lda biriktirish
POST /ops/orders/:id/close       yopish
GET  /ops/drivers                haydovchilar
POST /ops/drivers/:id/approve    KYC tasdiq
POST /ops/drivers/:id/block      blok
PUT  /ops/drivers/:id/billing    to'lov modeli sozlash
POST /ops/drivers/:id/balance    balans to'ldirish (ofis naqd)
GET/PUT /ops/settings            sozlamalar (tariflar, dispatch, surge, zona)
POST /ops/announcements          e'lon yuborish
POST /ops/blocklist              blok qo'shish
GET  /ops/stats                  statistika
```

---

## Task ro'yxati (06)
- [ ] ER-diagramma chizish (dbdiagram/mermaid) va repo'ga qo'shish
- [ ] Migratsiyalar yozish (barcha jadvallar + PostGIS + indekslar)
- [ ] Geo indeks (GIST) `pickup_point`, `last_location` uchun
- [ ] `packages/shared`: TypeScript enum/tur va Socket.IO event kontraktlari (front/back umumiy)
- [ ] Metrika hisoblash formulalari (cancel_rate, acceptance_rate, rating_avg) hujjatlash
- [ ] Seed skript (test tariflar, settings, soxta haydovchi/mijoz)
