import { MigrationInterface, QueryRunner } from 'typeorm';

// Mijoz ilovasi: "Uy"/"Ish" tez tugmalari (CUSTOMER-APP-PLAN.md ochiq savol #1).
// Alohida jadval EMAS — faqat ikkita qat'iy nom (Uy, Ish), ro'yxat emas.
export class CustomerSavedAddresses1722600000000 implements MigrationInterface {
  name = 'CustomerSavedAddresses1722600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS home_lat double precision`);
    await q.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS home_lng double precision`);
    await q.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS work_lat double precision`);
    await q.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS work_lng double precision`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE customers DROP COLUMN IF EXISTS home_lat`);
    await q.query(`ALTER TABLE customers DROP COLUMN IF EXISTS home_lng`);
    await q.query(`ALTER TABLE customers DROP COLUMN IF EXISTS work_lat`);
    await q.query(`ALTER TABLE customers DROP COLUMN IF EXISTS work_lng`);
  }
}
