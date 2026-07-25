import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 5: haydovchi push tokeni (Expo push) — fon rejimida taklif bildirishnomasi.
export class DriverPushToken1722200000000 implements MigrationInterface {
  name = 'DriverPushToken1722200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS push_token text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS push_token`);
  }
}
