import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 2: safar treki + SOS jadvallari, tarif va settings seed.
export class TripAndSeed1721900000000 implements MigrationInterface {
  name = 'TripAndSeed1721900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE trip_tracks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      points jsonb NOT NULL DEFAULT '[]'::jsonb,
      retention_until date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX idx_trip_tracks_order ON trip_tracks (order_id)`);

    await q.query(`CREATE TABLE sos_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
      actor text NOT NULL,
      actor_id uuid,
      lat double precision,
      lng double precision,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now())`);

    // Standart tariflar (so'm). Admin sozlamada o'zgartiradi (2.13).
    await q.query(`INSERT INTO tariffs
      (category, base_fare, per_km, waiting_per_min, free_wait_min, night_from, night_to, night_multiplier)
      VALUES
      ('standard', 4000, 2000, 500, 3, '22:00', '06:00', 1.2),
      ('comfort',  6000, 3000, 700, 3, '22:00', '06:00', 1.2),
      ('cargo',    8000, 4000, 1000, 5, '22:00', '06:00', 1.2)
      ON CONFLICT (category) DO NOTHING`);

    await q.query(`INSERT INTO settings (id, config)
      VALUES (1, '{"surgeMultiplier":1.0,"surgeActive":false,"freeCancelSec":120}'::jsonb)
      ON CONFLICT (id) DO NOTHING`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM settings WHERE id = 1`);
    await q.query(`DELETE FROM tariffs WHERE category IN ('standard','comfort','cargo')`);
    await q.query(`DROP TABLE IF EXISTS sos_events`);
    await q.query(`DROP TABLE IF EXISTS trip_tracks`);
  }
}
