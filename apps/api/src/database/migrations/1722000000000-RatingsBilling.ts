import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 3: baholash (ratings), billing (transactions) + drivers.balance.
export class RatingsBilling1722000000000 implements MigrationInterface {
  name = 'RatingsBilling1722000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS balance numeric(12,2) NOT NULL DEFAULT 0`);

    await q.query(`CREATE TABLE ratings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      direction text NOT NULL, -- 'customer_to_driver' | 'driver_to_customer'
      driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
      scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      overall numeric(3,2) NOT NULL,
      comment text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ratings_unique UNIQUE (order_id, direction))`);
    await q.query(`CREATE INDEX idx_ratings_driver ON ratings (driver_id)`);
    await q.query(`CREATE INDEX idx_ratings_customer ON ratings (customer_id)`);

    await q.query(`CREATE TABLE transactions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      type text NOT NULL, -- commission | topup | subscription | adjustment
      amount numeric(12,2) NOT NULL, -- musbat: balans oshadi, manfiy: kamayadi
      balance_after numeric(12,2) NOT NULL,
      order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
      note text,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX idx_transactions_driver ON transactions (driver_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS transactions`);
    await q.query(`DROP TABLE IF EXISTS ratings`);
    await q.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS balance`);
  }
}
