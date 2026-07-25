# Toy TaxY (TTY) — Yangi chat uchun davom ettirish prompti

> Quyidagi matnni yangi chatga to'liq nusxalab tashlang. U loyihaning holati, stack va
> keyingi qadamlarni tushuntiradi.

---

## PROMPT (nusxalang) ⬇️

Men **Toy TaxY (TTY)** loyihasida ishlayapman va uni davom ettirmoqchiman. Sen avtonom
ravishda ("davom et" desam keyingi topshiriqlarga ham o't) ishlaysan, best practice qilasan.

**Loyiha nima:** Mahalliy taksilar uchun buyurtma platformasi. Mijoz **Telegram bot**
orqali taksi chaqiradi → eng yaqin 5–7 haydovchiga (**React Native / Expo ilova**) real
vaqtda taklif boradi → qulay bo'lgan haydovchi **birinchi "Qabul"** bosib yutadi.
Operator/admin **veb-panel**dan kuzatadi.

**Repo:** `/home/javlon/Documents/GitHub/taxy-project` (pnpm monorepo, git branch `main`).

### Stack
- **Backend (`apps/api`):** NestJS + TypeScript, TypeORM, **PostgreSQL (PostGIS EMAS —
  olib tashlangan)**, **Redis** (GEOSEARCH dispatch), Socket.IO (3 gateway: /driver
  /customer /ops). JWT + RBAC (super_admin/admin/operator/driver/customer), bcryptjs.
- **Bot (`apps/bot`):** Telegraf, i18n uz/ru. `.env` da haqiqiy `BOT_TOKEN` bor (gitignore).
- **Admin (`apps/admin`):** React + Vite + react-leaflet (OSM xarita) + socket.io-client.
- **Haydovchi ilovasi (`apps/driver-app`):** Expo / React Native. **MUSTAQIL loyiha** —
  pnpm workspace'dan chiqarilgan (`pnpm-workspace.yaml` da `!apps/driver-app`), o'z
  `node_modules` (npm), EAS bilan quriladi. Owner: `javl9n`, package: `uz.toytaxy.driver`,
  EAS projectId: `486e16a1-b012-4256-b121-0ebbfc386cbd`.
- **Deploy:** Railway (har servis uchun Dockerfile + railway.json, migratsiya start'da
  avtomatik). Prod API: `https://api-production-13444.up.railway.app`,
  Admin: `https://admin-production-42e5.up.railway.app`. Bot ham Railway'da.

### Bajarilgan ishlar (hammasi ISHLAYDI, prod'da tekshirilgan)
- Sprint 0–3 backend: dispatch (siljuvchi oyna Redis GEO, atomik biriktirish, radius
  eskalatsiya, NO_DRIVER, reyting tie-break), taksometr/pricing (base+km+kutish+tungi+
  surge), safar lifecycle, no-show, bekor qoidasi, trip_tracks+SOS, billing (obuna/foiz/
  gibrid, balans, transaksiyalar), ikki tomonlama baho + reputatsiya, oldindan buyurtma,
  Ops API (RBAC). 5 ta migratsiya (`apps/api/src/database/migrations/`).
- **Haydovchi auth:** super-admin qo'lda haydovchi qo'shadi (`POST /ops/drivers` → bir
  martalik temp parol) → haydovchi telefon+parol bilan kiradi → birinchi kirishda
  majburiy parol almashtirish (`must_change_password`). Self-OTP OLIB TASHLANGAN.
- **Admin panel:** login (super-admin `ADMIN_LOGIN`/`ADMIN_PASSWORD` env'dan seed),
  jonli xarita, haydovchilar (qo'shish/approve/block/billing/topup), sozlamalar+tariflar,
  oldindan buyurtmalar.
- **Telegram bot:** to'liq oqim (ro'yxatdan o'tish, taksi chaqirish, jonli status,
  bekor, baholash), noto'g'ri kiritishda qayta so'rash.
- **Driver-app (Expo):** login, majburiy parol almashtirish, Home (onlayn/oflayn + GPS,
  taklif oynasi 20s taymer, safar bosqichlari, jonli taksometr, navigatsiya/qo'ng'iroq),
  Socket.IO /driver, i18n, AsyncStorage.
- **Push + fon GPS:** backend Expo Push API orqali (migratsiya 5: `drivers.push_token`,
  `POST /drivers/push-token`, `POST /drivers/location`), driver-app expo-notifications +
  expo-task-manager fon rejimi.
- **APK qurildi (EAS preview):** o'rnatiladigan APK tayyor (jonli prod API'ga ulanadi).

### Test skriptlari (`scripts/`, standalone .mjs)
`pnpm sim:dispatch` (9), `pnpm sim:trip` (14), `pnpm sim:sprint3` (11, API `window=1`
bilan), `pnpm sim:bot` (11). Lokal Postgres port **5434**, Redis 6379 (docker-compose).

### Muhim eslatmalar / tuzoqlar
- **PostGIS YO'Q** — geografiya lat/lng double precision, `gen_random_uuid()` ishlatiladi
  (Railway Postgres'da PostGIS yo'q edi). Redis GEO dispatch'ni bajaradi.
- **`.env`** gitignore'da, haqiqiy BOT_TOKEN bor — commit qilma.
- **driver-app** ni buildlashdan oldin `data/` (docker volume, root-egali) EACCES
  bermasin: `docker-compose down` + volume tozalash kerak bo'lishi mumkin.
- Docker konteynerlar hozir **o'chirilgan** bo'lishi mumkin — lokal test kerak bo'lsa
  `docker-compose up -d postgres redis`.

### QOLGAN ISHLAR (keyingi bosqich — hali boshlanmagan)
1. **Push'ni to'liq ishga tushirish:** hozirgi preview APK'da FCM yo'q → remote push
   ishlamaydi. `google-services.json` (Firebase) + `eas credentials` kerak, so'ng
   dev/production build. (Kod tayyor.)
2. **In-app xarita:** driver-app'ga `react-native-maps` (yoki MapLibre) + OSM.
3. **Driver-app qo'shimcha ekranlar:** balans, safar tarixi, SOS, reyting/statistika.
4. **Admin UI i18n:** hozir faqat o'zbek, rus qo'shish.
5. **OSRM/Nominatim:** marshrut/ETA/geokodlash (hozir tashqi navigatsiya).
6. **Anti-fraud:** taksometr masofasini OSRM bilan solishtirish.

To'liq reja: `~/.claude/plans/taxi-loyihasini-boshlamoqchiman-local-cryptic-stonebraker.md`.
Task hujjatlari: `docs/tasks/00-06*.md` (00-ROADMAP, 06 = domain model source-of-truth).

**Hozir men shuni qilmoqchiman:** [BU YERGA KEYINGI ISTAGINGIZNI YOZING — masalan:
"Push'ni FCM bilan to'liq ishga tushiramiz" yoki "driver-app'ga in-app xarita qo'shamiz"
yoki "1-punktdan boshla"].

---

## Foydali havolalar / ma'lumotlar
- **APK (preview, 2026-08-08 gacha):**
  `https://expo.dev/artifacts/eas/wCCOzUlz4k0rGRMFi31wDziNJtDA3nINUld-5XOUv0c.apk`
- **EAS build sahifasi:** https://expo.dev/accounts/javl9n/projects/tty-driver/builds
- **Prod API:** https://api-production-13444.up.railway.app
- **Prod Admin:** https://admin-production-42e5.up.railway.app
