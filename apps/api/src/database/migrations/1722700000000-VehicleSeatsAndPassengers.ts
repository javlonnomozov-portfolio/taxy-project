import { MigrationInterface, QueryRunner } from 'typeorm';

// 5+ yo'lovchi muammosi (2026-08-22).
//
// NEGA TOIFA EMAS, MASHINA: bitta toifa ichida turli sig'imdagi mashinalar
// yuradi — Standartda Damas (7 o'rin) ham, Cobalt/Nexia (4 o'rin) ham bor.
// Shuning uchun sig'im TOIFAGA emas, MASHINAGA bog'lanadi.
//
// `orders.passengers` — mijoz so'ragan yo'lovchilar soni. NULL = "aytmadi"
// (bot va Mini App'dan kelgan eski oqim), bunda filtr UMUMAN ishlamaydi va
// hamma narsa avvalgidek qoladi.
//
// Dispatch faqat `passengers > 4` bo'lganda filtrlaydi — oddiy zakazlar
// avvalgidek barcha haydovchilarga boradi ("taksi topilmadi" xavfi
// kengaymasin: SESSION-2026-08.md §2.5).
export class VehicleSeatsAndPassengers1722700000000 implements MigrationInterface {
  name = 'VehicleSeatsAndPassengers1722700000000';

  public async up(q: QueryRunner): Promise<void> {
    // 4 — eng keng tarqalgan yengil avtomobil (Cobalt/Nexia). Damas
    // haydovchilari admin panelda 7 ga o'zgartiradi.
    await q.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seats int NOT NULL DEFAULT 4`);
    await q.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS passengers int`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE vehicles DROP COLUMN IF EXISTS seats`);
    await q.query(`ALTER TABLE orders DROP COLUMN IF EXISTS passengers`);
  }
}
