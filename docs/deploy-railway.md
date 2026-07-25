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
  ```
  > `PORT` — Railway avtomatik beradi. Migratsiyalar start'dan oldin avtomatik ishlaydi
  > (`run-migrations.js`).
- **Healthcheck:** `/health` (railway.json'da sozlangan).
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
- **Admin parol:** hozircha oddiy matn (`admin_users.password_hash`). Productionda bcrypt
  qo'shing va admin'ni yangi parol bilan yarating (SQL orqali yoki keyingi seed).
- **DATABASE_SSL=true** — Railway Postgres uchun.
- **CORS:** api hozir hammaga ochiq (`enableCors()`); productionda admin domeniga cheklang.
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
