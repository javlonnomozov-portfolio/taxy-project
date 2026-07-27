import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Butunlik va unumdorlik:
 * 1. trip_tracks(order_id) UNIQUE — atomik `points || ...` qo'shish uchun shart
 *    (TripsService.addTrack). Avval mavjud dublikatlarni bitta qatorga birlashtiramiz.
 * 2. Yetishmayotgan indekslar — issiq so'rovlar to'liq skanerlashdan qutuladi.
 */
export class IntegrityAndIndexes1722400000000 implements MigrationInterface {
  name = 'IntegrityAndIndexes1722400000000';

  public async up(q: QueryRunner): Promise<void> {
    // --- trip_tracks: dublikatlarni birlashtirish (eskisi bilan poyga natijasida paydo bo'lishi mumkin edi) ---
    // Eslatma: `min(id)` ishlamaydi — Postgres'da uuid uchun min() agregati yo'q,
    // shuning uchun saqlanadigan qatorni row_number() bilan tanlaymiz.
    await q.query(`
      WITH ranked AS (
        SELECT id, order_id,
               row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS rn,
               count(*)     OVER (PARTITION BY order_id) AS cnt
        FROM trip_tracks
      ),
      keep AS (SELECT id AS keep_id, order_id FROM ranked WHERE rn = 1 AND cnt > 1),
      merged AS (
        SELECT k.keep_id,
               COALESCE(jsonb_agg(pt ORDER BY pt->>'at') FILTER (WHERE pt IS NOT NULL),
                        '[]'::jsonb) AS all_points
        FROM keep k
        JOIN trip_tracks t ON t.order_id = k.order_id
        LEFT JOIN LATERAL jsonb_array_elements(t.points) AS pt ON true
        GROUP BY k.keep_id
      )
      UPDATE trip_tracks SET points = merged.all_points
      FROM merged WHERE trip_tracks.id = merged.keep_id
    `);
    await q.query(`
      DELETE FROM trip_tracks WHERE id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS rn
          FROM trip_tracks
        ) x WHERE x.rn > 1
      )
    `);

    // Eski oddiy indeks o'rniga UNIQUE (ON CONFLICT (order_id) uchun kerak).
    await q.query(`DROP INDEX IF EXISTS idx_trip_tracks_order`);
    await q.query(`CREATE UNIQUE INDEX uq_trip_tracks_order ON trip_tracks (order_id)`);

    // --- Yetishmayotgan indekslar ---
    // Har yangi zakazda faol buyurtma tekshiruvi (OrdersService.create).
    await q.query(`CREATE INDEX idx_orders_customer_status ON orders (customer_id, status)`);
    // Zakazlar tarixi / metrikalar (ops).
    await q.query(`CREATE INDEX idx_orders_created_at ON orders (created_at DESC)`);
    // Reputatsiya metrikalari order_events'dan hisoblanadi.
    await q.query(`CREATE INDEX idx_order_events_order_type ON order_events (order_id, type)`);
    await q.query(`CREATE INDEX idx_order_events_created_at ON order_events (created_at DESC)`);
    // Haydovchi balans tarixi (BillingService.listTransactions ORDER BY created_at DESC).
    await q.query(`CREATE INDEX idx_transactions_driver_created ON transactions (driver_id, created_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_transactions_driver_created`);
    await q.query(`DROP INDEX IF EXISTS idx_order_events_created_at`);
    await q.query(`DROP INDEX IF EXISTS idx_order_events_order_type`);
    await q.query(`DROP INDEX IF EXISTS idx_orders_created_at`);
    await q.query(`DROP INDEX IF EXISTS idx_orders_customer_status`);
    await q.query(`DROP INDEX IF EXISTS uq_trip_tracks_order`);
    await q.query(`CREATE INDEX idx_trip_tracks_order ON trip_tracks (order_id)`);
  }
}
