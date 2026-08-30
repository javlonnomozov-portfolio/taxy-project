import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

// TypeORM CLI (migratsiya) va NestJS uchun umumiy DataSource.
// `.env` monorepo ILDIZIDA — cwd ga tayanib bo'lmaydi, chunki
// `pnpm --filter @tty/api migration:run` uni apps/api ga o'zgartiradi.
// __dirname: src/database/ (dev) yoki dist/database/ (build) — 4 daraja yuqori.
loadEnv({ path: join(__dirname, '../../../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // Railway/boshqa managed Postgres uchun (DATABASE_SSL=true).
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
