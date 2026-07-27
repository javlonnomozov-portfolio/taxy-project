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

### ⚠️ API FAQAT BITTA INSTANSIYADA ishlashi SHART

`numReplicas` ni **1** dan oshirmang. Dispatch holati butunlay xotirada saqlanadi
(`DispatchService.states` — `Map` + `setTimeout` taymerlari), bot sessiyasi ham
(`apps/bot/src/session.ts`), va Socket.IO Redis adapter'siz ishlaydi. Ikkinchi instansiya
qo'shilsa jimgina buziladi:

- ikkala instansiya bir zakazni parallel dispatch qiladi (haydovchi ikki marta taklif oladi);
- haydovchining javobi taklifni yuborgan instansiyaga tushmasa — e'tiborsiz qoladi;
- `realtime.emitToDriver(...)` boshqa instansiyadagi socketga yetmaydi.

Replica qo'shishdan **oldin** kerak: `@socket.io/redis-adapter`, dispatch taymerlarini
Redis/BullMQ delayed job'larga ko'chirish, bot sessiyasini Redis'ga o'tkazish.
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
- **Xarita xizmatlari** (OSRM/Nominatim) — og'ir, alohida bosqichda (hozir MVP ularsiz
  ishlaydi; admin xaritasi to'g'ridan OSM tile'laridan foydalanadi).

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
