import { drizzle as drizzlePGLite } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __pglite_client__: PGlite | undefined;
  __pg_pool__: Pool | undefined;
};

// Check if we have a real postgres URL
export const isProductionDB = !!(typeof process !== 'undefined' && process.env && process.env.DATABASE_URL);

// validateEnv() (server/config/env.ts, run at server startup) already
// refuses to boot in production without DATABASE_URL. This is a safety net
// for any other entrypoint that imports this module directly. PGlite is an
// embedded, single-process, non-persistent-across-deploys database — silently
// running production on it means data loss on every restart/redeploy and no
// way to share state across multiple instances.
if (process.env.NODE_ENV === 'production' && !isProductionDB) {
  throw new Error(
    'DATABASE_URL is not set in production. Refusing to start with the embedded PGlite database.'
  );
}

let dbInstance: any;
let pgClient: any;
let pgPool: any;

if (isProductionDB) {
  if (!globalForDb.__pg_pool__) {
    // Dynamic connection pooling based on heap allocation limits
    let dynamicMaxConns = 20;
    try {
        const v8 = require("v8");
        const heapLimitMB = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;
        dynamicMaxConns = Math.max(10, Math.min(100, Math.floor(heapLimitMB / 10)));
    } catch(e) {}
    
    globalForDb.__pg_pool__ = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || "0") || dynamicMaxConns,
    });
  }
  pgPool = globalForDb.__pg_pool__;
  pgClient = pgPool; // just for exports compat
  dbInstance = drizzleNodePg(pgPool, { schema });
} else {
  if (!globalForDb.__pglite_client__) {
    globalForDb.__pglite_client__ = new PGlite();
  }
  pgClient = globalForDb.__pglite_client__;
  pgPool = pgClient;
  dbInstance = drizzlePGLite(pgClient as any, { schema });
}

export const pool = pgPool;
export const client = pgClient;
export const db = dbInstance;

// create tables for testing without external postgres
export async function initializeDb() {
  if (isProductionDB) {
    // In production, migrations should typically run via drizzle-kit
    // Or we can just execute the raw SQL string on the Pool payload here 
    // for simplicity since there is no standard migration system here yet.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_code VARCHAR(10) UNIQUE NOT NULL,
        host_name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        persist_on_close BOOLEAN DEFAULT FALSE,
        waiting_room_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        closed_at TIMESTAMP WITH TIME ZONE
      );
  
      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        display_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        ip_hash VARCHAR(255),
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE
      );
      
      CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);

      CREATE TABLE IF NOT EXISTS resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        resource_type VARCHAR(50) NOT NULL,
        created_by UUID REFERENCES participants(id),
        title VARCHAR(255),
        description TEXT,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_resources_room_id ON resources(room_id);
      CREATE INDEX IF NOT EXISTS idx_resources_metadata_gin ON resources USING GIN (metadata);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES rooms(id),
        action VARCHAR(255) NOT NULL,
        details JSONB,
        performed_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_room_id ON audit_logs(room_id);
    `);
    return;
  }
  
  await client.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_code VARCHAR(10) UNIQUE NOT NULL,
      host_name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL,
      persist_on_close BOOLEAN DEFAULT FALSE,
      waiting_room_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      closed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      display_name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      ip_hash VARCHAR(255),
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      left_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      resource_type VARCHAR(50) NOT NULL,
      created_by UUID REFERENCES participants(id),
      title VARCHAR(255),
      description TEXT,
      metadata JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id),
      action VARCHAR(255) NOT NULL,
      details JSONB,
      performed_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

    CREATE INDEX IF NOT EXISTS idx_resources_metadata_gin_pglite ON resources USING GIN (metadata);
  `);
}
