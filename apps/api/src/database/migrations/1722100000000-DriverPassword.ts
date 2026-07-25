import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 4: haydovchi parol bilan kirishi (super-admin qo'shadi, temp parol, majburiy almashtirish).
export class DriverPassword1722100000000 implements MigrationInterface {
  name = 'DriverPassword1722100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash text`);
    await q.query(
      `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS must_change_password`);
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS password_hash`);
  }
}
