# 05 — Infratuzilma va Deploy (Railway)

Lokal — **Docker Compose**; production — **Railway** (barcha partlar).

Bog'liq: [06-domain-model.md](06-domain-model.md), [01-backend.md](01-backend.md).

---

## 1. Monorepo
- [ ] pnpm workspaces: `apps/api`, `apps/bot`, `apps/admin`, `apps/driver-app`,
      `packages/shared` (turlar + Socket kontraktlari)
- [ ] Umumiy tsconfig, eslint, prettier, husky (pre-commit lint)
- [ ] `.env.example` har servis uchun

## 2. Lokal (Docker Compose)
- [ ] `postgres` (PostGIS image) + init: `CREATE EXTENSION postgis`
- [ ] `redis`
- [ ] `osrm` — O'zbekiston OSM ekstrakti (Geofabrik) + `osrm-extract/partition/customize`
- [ ] `nominatim` (og'ir; ixtiyoriy lokal) yoki hosted geocode
- [ ] `tileserver-gl` / MapLibre uchun OSM tiles (yoki hosted)
- [ ] `api`, `bot`, `admin` dev rejimda
- [ ] `docker compose up` bilan hammasi ko'tariladi (health)

## 3. Xarita servislari — strategiya (best practice)
> OSRM/Nominatim/tile **katta data + xotira** talab qiladi. Railway'da resurs qimmat.
- [ ] **OSRM:** alohida Railway service + **volume** (O'zbekiston ekstrakti bilan
      oldindan build qilingan image). MVP uchun maqbul.
- [ ] **Nominatim:** og'ir — MVP'da **hosted geocode** (yoki cheklangan self-host) tanlash,
      sabablarini hujjatlash. (Manzil ixtiyoriy bo'lgani uchun geocode yuki past.)
- [ ] **Tiles:** MapLibre + hosted OSM style yoki yengil tileserver; CSP/limitlarni hisobga olish

## 4. Railway deploy
- [ ] **Postgres** plugin (PostGIS extension yoqish) + **Redis** plugin
- [ ] `api` service (Dockerfile), ENV = Railway variables (DB/Redis URL, JWT secret,
      BOT_TOKEN, FCM key, OSRM/geocode URL)
- [ ] `bot` service (alohida yoki `api` ichida — webhook rejimi tavsiya)
- [ ] `admin` — static build (Vite) → Railway static/nginx
- [ ] `osrm` service + volume
- [ ] Migratsiya deploy bosqichida avtomatik ishga tushishi (release command)
- [ ] Domenlar, HTTPS, bot **webhook** URL sozlash

## 5. CI/CD
- [ ] GitHub Actions: lint + test + build (har PR)
- [ ] `main`'ga merge → Railway auto-deploy (har servis)
- [ ] `driver-app`: **APK** build (EAS/Gradle) artifact sifatida (hozircha faqat APK)

## 6. Kuzatuv va ma'lumot
- [ ] **Sentry** (api/bot/admin/driver-app) + strukturali loglar (pino)
- [ ] **Retention job** (2.15): trek/log 6–12 oy, keyin arxiv/o'chirish (cron)
- [ ] Backup: Postgres kunlik backup (Railway/pg_dump)
- [ ] Health/uptime monitoring

## 7. Sirlar va xavfsizlik
- [ ] Sirlar faqat ENV/Railway variables (repo'da yo'q)
- [ ] Rate limiting (auth, order create), CORS, helmet
- [ ] Fayl saqlash (KYC hujjatlari): xavfsiz storage + kirish nazorati

## Verification (infra)
- [ ] Lokal `docker compose up` — barcha servis + migratsiya
- [ ] Railway staging deploy — bot webhook, api health, admin ochiladi
- [ ] OSRM marshrut/masofa, geocode, tiles ishlashi
