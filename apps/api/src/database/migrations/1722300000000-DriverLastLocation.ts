import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 6: haydovchining oxirgi ma'lum joylashuvi (onlayn + safar davomida).
// Xarita ("active taksilar") va mijozga taksi joylashuvini ko'rsatish uchun.
export class DriverLastLocation1722300000000 implements MigrationInterface {
  name = 'DriverLastLocation1722300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lat double precision`);
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lng double precision`);
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_location_at timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS last_lat`);
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS last_lng`);
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS last_location_at`);
  }
}
