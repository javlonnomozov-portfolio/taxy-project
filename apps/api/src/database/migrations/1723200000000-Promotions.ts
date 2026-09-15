import { MigrationInterface, QueryRunner } from 'typeorm';

// Haydovchi guruhlari va aksiyalar (2026-09-15).
//
// NEGA: foydalanuvchi yangi yilgacha haydovchilardan to'lov yechmasdan, har
// zakazga +300 so'm bonus bermoqchi edi va `per_order = -300` qo'yib ko'rmoqchi
// edi. Bu ISHLAMASDI: hisob `Math.max(0, fee)` bilan manfiyni 0 ga aylantiradi
// — haydovchi tekin ishlardi, lekin bonus tushmasdi. Umumiy sozlama esa
// manfiyni umuman rad etadi.
//
// Qarorlar (foydalanuvchi bilan kelishilgan):
// - aksiya BARCHA haydovchilarga yoki bitta GURUHGA qo'llanadi;
// - ikki raqam: to'lovdan chegirma (0..100 %) va har zakazga bonus (so'm);
// - qo'lda yoqib/o'chirish + ixtiyoriy boshlanish/tugash sanasi (o'zi tugaydi).
//
// Guruh aksiyada ishlatilayotgan bo'lsa O'CHIRILMAYDI (RESTRICT): aks holda
// aksiya ham jimgina yo'qolardi.
export class Promotions1723200000000 implements MigrationInterface {
  name = 'Promotions1723200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS driver_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS driver_group_members (
      group_id uuid NOT NULL REFERENCES driver_groups(id) ON DELETE CASCADE,
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      added_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, driver_id)
    )`);
    // Yakunlashda "haydovchi qaysi guruhlarda" so'raladi — driver_id bo'yicha.
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_driver_group_members_driver ON driver_group_members (driver_id)`,
    );

    await q.query(`CREATE TABLE IF NOT EXISTS promotions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      starts_at timestamptz,
      ends_at timestamptz,
      group_id uuid REFERENCES driver_groups(id) ON DELETE RESTRICT,
      commission_discount_percent int NOT NULL DEFAULT 0
        CHECK (commission_discount_percent BETWEEN 0 AND 100),
      bonus_per_order numeric(10,2) NOT NULL DEFAULT 0 CHECK (bonus_per_order >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT promotions_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS promotions`);
    await q.query(`DROP TABLE IF EXISTS driver_group_members`);
    await q.query(`DROP TABLE IF EXISTS driver_groups`);
  }
}
