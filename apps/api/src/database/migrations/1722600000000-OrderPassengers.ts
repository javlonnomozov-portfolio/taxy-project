import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Zakazga yo'lovchilar soni.
 *
 * Mijoz ilovasi maketida "Yo'lovchilar soni: 1ta-4ta / 5+" tanlagichi bor.
 * Busiz tanlagich hech narsaga ta'sir qilmasdi — foydalanuvchi tanlaydi, lekin
 * haydovchi buni bilmaydi va kelgan mashinaga hamma sig'maydi.
 *
 * NULLABLE: bot va Mini App orqali kelgan eski zakazlarda bu qiymat yo'q va
 * bo'lishi ham shart emas.
 */
export class OrderPassengers1722600000000 implements MigrationInterface {
  name = 'OrderPassengers1722600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS passengers int`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders DROP COLUMN IF EXISTS passengers`);
  }
}
