# Railway'ga deploy qilish — Toy TaxY (TTY)

Loyiha monorepo (pnpm workspaces). Railway'da **alohida servislar** sifatida deploy qilinadi.
Barcha servislar bitta repodan quriladi (build context = repo root), lekin har biri o'z
Dockerfile'iga ega.

## Servislar ro'yxati

| Servis | Turi | Dockerfile | Port |
|--------|------|-----------|------|
| **Postgres** | Railway plugin (PostGIS) | — | 5432 |
| **Redis** | Railway plugin | — | 6379 |
| **api** | Web (NestJS) | `apps/api/Dockerfile` | `$PORT` |
| **bot** | Worker (Telegraf) | `apps/bot/Dockerfile` | — |
| **admin** | Web (nginx statik) | `apps/admin/Dockerfile` | `$PORT` |

## 1. Ma'lumotlar bazasi (PostGIS)

Railway'ning oddiy Postgres plugini PostGIS'ni o'z ichiga olmaydi. Ikki variant:
- **Tavsiya:** "Add Service → Database → PostgreSQL" qo'shib, so'ng birinchi migratsiya
  `CREATE EXTENSION postgis` ni bajaradi (migratsiya `InitCore` shuni qiladi — superuser
  huquqi kerak; Railway Postgres'da mavjud).
- Yoki PostGIS image'li custom Docker service.

Redis: "Add Service → Database → Redis".

## 2. API servisi

- **New Service → GitHub repo** (shu repo).
- **Settings → Build:** Root Directory `/`, Dockerfile Path `apps/api/Dockerfile`
  (yoki `railway.json` avtomatik o'qiladi).
- **Variables:**
  ```
  NODE_ENV=production
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  DATABASE_SSL=true
  REDIS_URL=${{Redis.REDIS_URL}}
  JWT_SECRET=<kuchli-tasodifiy-satr>
  JWT_EXPIRES_IN=7d
  INTERNAL_API_KEY=<kuchli-tasodifiy-satr>
  DISPATCH_WINDOW_SIZE=6
  DISPATCH_OFFER_TIMEOUT_SEC=15
  DISPATCH_RADIUS_STEPS_M=2000,4000,6000
  DISPATCH_NO_DRIVER_TIMEOUT_SEC=60
  FCM_SERVER_KEY=            # ixtiyoriy
  SWAGGER_ENABLED=false      # 'true' bo'lsa /docs prod'da ochiladi
  LOGIN_RATE_LIMIT=5         # login urinishlari / daqiqa / hisob
  ```
  > `PORT` — Railway avtomatik beradi. Migratsiyalar start'dan oldin avtomatik ishlaydi
  > (`run-migrations.js`).
- **Healthcheck:** `/health` (railway.json'da sozlangan). Nosozlikda **503** qaytadi
  (`@nestjs/terminus`), ya'ni DB yoki Redis yiqilgan deploy o'tmaydi.

### Ko'p instansiya (replica) — qo'llab-quvvatlanadi

`numReplicas` ni oshirsa bo'ladi. Buning uchun uchta mexanizm bor:

1. **Socket.IO Redis adapter** — `emitToDriver(...)` va `fetchSockets()` barcha
   instansiyalarda ishlaydi. Busiz 1-instansiyaga ulangan haydovchi 2-instansiya
   yuborgan taklifni umuman olmasdi.
2. **Dispatch egaligi** — har zakazni aynan bitta instansiya boshqaradi
   (`dispatch:owner:<orderId>`, Redis `SET NX` + TTL 90s, heartbeat 30s). Boshqa
   instansiyaga tushgan haydovchi javobi pub/sub orqali egasiga uzatiladi.
   Instansiya o'lsa, egalik TTL bilan bo'shaydi va zakazni boshqasi
   `recoverOrphans()` orqali oladi.
3. **Bot sessiyasi Redis'da** (TTL 7 kun) — foydalanuvchi qaysi instansiyaga
   tushishidan qat'i nazar bir xil sessiyani ko'radi.

Tekshirish: `pnpm sim:cluster` — ikkita API instansiyasi (3000/3001) ko'tarilgan
holda haydaydi va zakaz A da, haydovchi B da bo'lgan holatni sinaydi.

> **Bot servisi esa bitta instansiyada qolishi kerak** — Telegram polling
> (`bot.launch()`) bir vaqtda faqat bitta iste'molchiga ruxsat beradi. Bot uchun
> replica kerak bo'lsa, avval webhook rejimiga o'tish lozim.
- Domen: "Settings → Networking → Generate Domain" → `https://<api>.up.railway.app`.

## 3. Bot servisi

- **New Service → shu repo.** Dockerfile Path `apps/bot/Dockerfile`.
- **Variables:**
  ```
  NODE_ENV=production
  BOT_TOKEN=<BotFather token>
  API_BASE_URL=https://<api>.up.railway.app
  INTERNAL_API_KEY=<api bilan bir xil>
  ```
- Port ochmaydi (worker). Domen shart emas.

## 4. Admin servisi

- **New Service → shu repo.** Dockerfile Path `apps/admin/Dockerfile`.
- **Build variable (build-time):**
  ```
  VITE_API_URL=https://<api>.up.railway.app
  ```
  > Bu build vaqtida statikaga bog'lanadi. O'zgartirsangiz qayta build kerak.
- Railway `PORT`'ni beradi; nginx `default.conf.template` uni `envsubst` orqali oladi.
- Domen: "Generate Domain" → panelga shu URL orqali kiriladi.
- Birinchi kirish: dev admin `admin/admin123` (production'da **almashtiring** — pastga qarang).

## 5. Production eslatmalari (best practice)

- **JWT_SECRET / INTERNAL_API_KEY** — kuchli, tasodifiy; api va bot'da `INTERNAL_API_KEY`
  bir xil bo'lishi shart.
- **Admin parol:** bcrypt (`bcryptjs`). Bootstrap super-admin `ADMIN_LOGIN`/`ADMIN_PASSWORD`
  env'laridan yaratiladi (create-if-missing).
- **DATABASE_SSL=true** — Railway Postgres uchun.
- **Replica: 1 ta** — yuqoridagi ogohlantirishga qarang.
- **Loglar:** `Authorization`, `x-internal-key` va parol maydonlari pino `redact` bilan
  yashiriladi. Har so'rovda `x-request-id` bor — nosozlikni kuzatishda shu id bo'yicha qidiring.
- **CORS:** api hozir hammaga ochiq (`enableCors()`); productionda admin domeniga cheklang.
- **Rate limiting:** `/auth/*/login` da `@nestjs/throttler` — `LOGIN_RATE_LIMIT` (default 5)
  urinish/daqiqa. Hisoblagich **IP + hisob** bo'yicha kalitlanadi (`LoginThrottlerGuard`),
  shuning uchun bitta NAT ortidagi ko'p haydovchi bir-birini bloklamaydi.
  `main.ts` da `trust proxy` yoqilgan — busiz Railway edge ortida hamma bitta IP bo'lib
  ko'rinardi va limit barchani bloklardi.
## Xarita xizmatlari (Nominatim / OSRM)

Manzil qidirish va marshrut **backend proksi** orqali ishlaydi (`GET /geo/search`,
`/geo/reverse`, `/geo/route` — ichki kalit bilan). Nega proksi:

- Nominatim shartlari aniq `User-Agent` va soniyasiga 1 so'rov chegarasini talab
  qiladi — har bir foydalanuvchi o'zi so'rasa umumiy IP tez bloklanadi;
- javoblar Redis'da 24 soat keshlanadi (bir xil so'rov bir marta ketadi);
- self-host servis manzilini klientlarga tarqatish shart emas.

**Sozlash (ixtiyoriy).** Env berilmasa xizmat o'chiq bo'ladi va 503 qaytaradi —
bot manzilsiz davom etadi (manzil MVP'da ixtiyoriy, taksometr haqiqiy km bo'yicha
hisoblaydi). API servisiga:

```
NOMINATIM_URL=https://nominatim.openstreetmap.org
OSRM_URL=https://router.project-osrm.org
GEO_USER_AGENT=ToyTaxY/1.0 (aloqa@sizning-domen.uz)
```

> ⚠️ Yuqoridagi **ommaviy demo serverlar** — ular ishlab chiqarish yuki uchun
> mo'ljallanmagan va shartlari tijoriy foydalanishni cheklaydi. Jonli xizmat uchun
> o'zingiznikini ko'taring:
> - **OSRM:** alohida Railway servisi + volume, O'zbekiston OSM ekstrakti
>   (Geofabrik) bilan oldindan `osrm-extract/partition/customize` qilingan image.
>   Nisbatan yengil — MVP uchun maqbul.
> - **Nominatim:** ancha og'ir (RAM + import vaqti). Muqobil — pullik hosted
>   geokodlash provayderi; yuk past, chunki manzil ixtiyoriy.

Tekshirish: `GET /geo/status` → `{ "geocoding": true, "routing": true }`.

## 6. Lokal build tekshirish (deploy'dan oldin)

```bash
docker build -f apps/api/Dockerfile -t tty-api .
docker build -f apps/bot/Dockerfile -t tty-bot .
docker build -f apps/admin/Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t tty-admin .
```

## 7. Deploy tartibi

1. Postgres + Redis pluginlarini qo'shing.
2. api servisini deploy qiling (migratsiyalar avtomatik ishlaydi) → domen oling.
3. bot va admin'ni `API_BASE_URL` / `VITE_API_URL` = api domeni bilan deploy qiling.
4. `@BotFather`'da bot webhook/polling — hozir **polling** (launch), qo'shimcha sozlash shart emas.
