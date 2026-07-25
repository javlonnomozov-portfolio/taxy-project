# Toy TaxY (TTY)

Mahalliy taksilar uchun buyurtma platformasi. Mijoz **Telegram bot** orqali taksi
chaqiradi → buyurtma **eng yaqin haydovchilarga** (React Native ilova) real vaqtda
ko'rinadi → qulay haydovchi buyurtmani oladi. **Call-center operatori** tizimni kuzatadi
va muammoli holatlarni hal qiladi.

## Arxitektura (qisqacha)

| Qism | Texnologiya |
|------|-------------|
| Backend API + dispatch | NestJS (TypeScript), Socket.IO |
| Mijoz interfeysi | Telegram bot (Telegraf) |
| Haydovchi ilovasi | React Native |
| Admin/Operator panel | React (Vite) |
| Ma'lumot bazasi | PostgreSQL + PostGIS |
| Real-time / geo-index | Redis (`GEOSEARCH`) |
| Xarita | OpenStreetMap — MapLibre + OSRM + Nominatim |
| Push | FCM |
| Til | O'zbek + Rus |
| Deploy | Railway |

## Hujjatlar / Tasklar

To'liq workflow, biznes qarorlar va modul tasklari:

- [docs/tasks/00-ROADMAP.md](docs/tasks/00-ROADMAP.md) — yo'l xaritasi va sprintlar
- [docs/tasks/01-backend.md](docs/tasks/01-backend.md) — NestJS API + dispatch
- [docs/tasks/02-telegram-bot.md](docs/tasks/02-telegram-bot.md) — mijoz boti
- [docs/tasks/03-driver-app.md](docs/tasks/03-driver-app.md) — haydovchi ilovasi
- [docs/tasks/04-admin-operator.md](docs/tasks/04-admin-operator.md) — admin/operator panel
- [docs/tasks/05-infra-devops.md](docs/tasks/05-infra-devops.md) — infra + Railway deploy
- [docs/tasks/06-domain-model.md](docs/tasks/06-domain-model.md) — ma'lumot modeli + kontraktlar

## Status

Loyiha rejalashtirish bosqichida. Keyingi qadam: **Sprint 0 — monorepo skeleti va infra**
(qarang [00-ROADMAP.md](docs/tasks/00-ROADMAP.md)).
