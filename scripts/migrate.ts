#!/usr/bin/env tsx
/**
 * scripts/migrate.ts
 *
 * Runs Drizzle ORM migrations against the database pointed to by DATABASE_URL.
 *
 * Usage:
 *   npm run migrate              # uses DATABASE_URL from .env
 *   DATABASE_URL=postgres://... npm run migrate
 *
 * In CI/CD pipelines run this step BEFORE starting the application container.
 * The script exits with code 1 on failure so the pipeline stops.
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "[Migrate] ❌  DATABASE_URL is not set.\n" +
    "           Set it in your .env file or pass it as an environment variable.\n" +
    "           Example: DATABASE_URL=postgresql://user:pass@host:5432/syncdeck"
  );
  process.exit(1);
}

// When bundled with esbuild --format=cjs, __dirname is available.
// When run directly with tsx (ESM), resolve from cwd.
const MIGRATIONS_FOLDER = typeof __dirname !== "undefined"
  ? path.resolve(__dirname, "../drizzle/migrations")
  : path.resolve(process.cwd(), "drizzle/migrations");

async function runMigrations() {
  console.log(`[Migrate] 🚀  Connecting to database...`);
  console.log(`[Migrate]     Target: ${DATABASE_URL!.replace(/:([^@]+)@/, ":****@")}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: (process.env.NODE_ENV === "production" || process.env.DB_SSL === "true")
      ? { rejectUnauthorized: false }
      : false,
    max: 1, // Migrations need only one connection
  });

  try {
    const db = drizzle(pool);
    console.log(`[Migrate] 📂  Running migrations from: ${MIGRATIONS_FOLDER}`);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`[Migrate] ✅  Migrations completed successfully.`);
  } catch (err) {
    console.error(`[Migrate] ❌  Migration failed:`, err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
