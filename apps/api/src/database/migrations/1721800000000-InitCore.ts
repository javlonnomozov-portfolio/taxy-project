import { MigrationInterface, QueryRunner } from 'typeorm';

// Boshlang'ich migratsiya: PostGIS + core jadvallar (Sprint 0).
// Qolgan jadvallar (ratings, transactions, complaints, ...) keyingi migratsiyalarda.
// Qarang: docs/tasks/06-domain-model.md
export class InitCore1721800000000 implements MigrationInterface {
  name = 'InitCore1721800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- enum turlari ---
    await q.query(`CREATE TYPE order_status AS ENUM (
      'CREATED','DISPATCHING','ACCEPTED','CONFIRMED','ARRIVING','ARRIVED',
      'IN_PROGRESS','COMPLETED','CANCELLED_BY_CUSTOMER','CANCELLED_BY_DRIVER',
      'CUSTOMER_NO_SHOW','NO_DRIVER','CLOSED_BY_OPERATOR')`);
    await q.query(`CREATE TYPE driver_status AS ENUM ('OFFLINE','ONLINE_IDLE','OFFERED','ON_TRIP')`);
    await q.query(`CREATE TYPE approval_status AS ENUM ('pending','approved','blocked')`);
    await q.query(`CREATE TYPE order_type AS ENUM ('standard','scheduled','intercity','delivery')`);
    await q.query(`CREATE TYPE vehicle_category AS ENUM ('standard','comfort','cargo')`);
    await q.query(`CREATE TYPE billing_mode AS ENUM ('subscription','percent','hybrid')`);

    // --- customers ---
    await q.query(`CREATE TABLE customers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      telegram_id bigint UNIQUE,
      phone text,
      first_name text,
      last_name text,
      show_name boolean NOT NULL DEFAULT false,
      language text NOT NULL DEFAULT 'uz',
      is_blocked boolean NOT NULL DEFAULT false,
      rating_avg numeric(3,2) NOT NULL DEFAULT 0,
      cancel_rate numeric(5,2) NOT NULL DEFAULT 0,
      no_show_count int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);

    // --- drivers ---
    await q.query(`CREATE TABLE drivers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone text UNIQUE NOT NULL,
      first_name text,
      last_name text,
      status driver_status NOT NULL DEFAULT 'OFFLINE',
      approval_status approval_status NOT NULL DEFAULT 'pending',
      billing_mode billing_mode NOT NULL DEFAULT 'subscription',
      billing_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      rating_avg numeric(3,2) NOT NULL DEFAULT 0,
      cancel_rate numeric(5,2) NOT NULL DEFAULT 0,
      acceptance_rate numeric(5,2) NOT NULL DEFAULT 0,
      completion_rate numeric(5,2) NOT NULL DEFAULT 0,
      last_location geography(Point,4326),
      last_seen_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX idx_drivers_last_location ON drivers USING GIST (last_location)`);

    // --- vehicles ---
    await q.query(`CREATE TABLE vehicles (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      make text, model text, color text, plate text,
      category vehicle_category NOT NULL DEFAULT 'standard',
      created_at timestamptz NOT NULL DEFAULT now())`);

    // --- tariffs ---
    await q.query(`CREATE TABLE tariffs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      category vehicle_category NOT NULL UNIQUE,
      base_fare numeric(10,2) NOT NULL DEFAULT 4000,
      per_km numeric(10,2) NOT NULL DEFAULT 0,
      waiting_per_min numeric(10,2) NOT NULL DEFAULT 0,
      free_wait_min int NOT NULL DEFAULT 3,
      night_from time NOT NULL DEFAULT '22:00',
      night_to time NOT NULL DEFAULT '06:00',
      night_multiplier numeric(4,2) NOT NULL DEFAULT 1.0)`);

    // --- orders ---
    await q.query(`CREATE TABLE orders (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id uuid NOT NULL REFERENCES customers(id),
      driver_id uuid REFERENCES drivers(id),
      order_type order_type NOT NULL DEFAULT 'standard',
      status order_status NOT NULL DEFAULT 'CREATED',
      vehicle_category vehicle_category NOT NULL DEFAULT 'standard',
      pickup_point geography(Point,4326) NOT NULL,
      pickup_address text,
      dest_point geography(Point,4326),
      dest_address text,
      note text,
      scheduled_at timestamptz,
      estimated_price numeric(10,2),
      final_price numeric(10,2),
      distance_m int,
      waiting_minutes int NOT NULL DEFAULT 0,
      surge_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
      night_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
      commission_amount numeric(10,2),
      created_at timestamptz NOT NULL DEFAULT now(),
      accepted_at timestamptz,
      started_at timestamptz,
      completed_at timestamptz)`);
    await q.query(`CREATE INDEX idx_orders_status ON orders (status)`);
    await q.query(`CREATE INDEX idx_orders_pickup ON orders USING GIST (pickup_point)`);
    await q.query(`CREATE INDEX idx_orders_customer ON orders (customer_id)`);
    await q.query(`CREATE INDEX idx_orders_driver ON orders (driver_id)`);

    // --- order_events (audit + metrika manbasi) ---
    await q.query(`CREATE TABLE order_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type text NOT NULL,
      actor text NOT NULL,
      actor_id uuid,
      reason text,
      payload jsonb,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX idx_order_events_order ON order_events (order_id)`);

    // --- settings (bitta global qator, key-value jsonb) ---
    await q.query(`CREATE TABLE settings (
      id int PRIMARY KEY DEFAULT 1,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT settings_singleton CHECK (id = 1))`);

    // --- admin_users (panel, RBAC) ---
    await q.query(`CREATE TABLE admin_users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      login text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'operator',
      created_at timestamptz NOT NULL DEFAULT now())`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS admin_users`);
    await q.query(`DROP TABLE IF EXISTS settings`);
    await q.query(`DROP TABLE IF EXISTS order_events`);
    await q.query(`DROP TABLE IF EXISTS orders`);
    await q.query(`DROP TABLE IF EXISTS tariffs`);
    await q.query(`DROP TABLE IF EXISTS vehicles`);
    await q.query(`DROP TABLE IF EXISTS drivers`);
    await q.query(`DROP TABLE IF EXISTS customers`);
    await q.query(`DROP TYPE IF EXISTS billing_mode`);
    await q.query(`DROP TYPE IF EXISTS vehicle_category`);
    await q.query(`DROP TYPE IF EXISTS order_type`);
    await q.query(`DROP TYPE IF EXISTS approval_status`);
    await q.query(`DROP TYPE IF EXISTS driver_status`);
    await q.query(`DROP TYPE IF EXISTS order_status`);
  }
}
