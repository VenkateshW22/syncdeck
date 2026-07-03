import { Client } from "pg";
import { createClient } from "redis";

export async function clearDatabaseAndRedis() {
  const dbUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (dbUrl) {
    try {
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      await client.query("DELETE FROM audit_logs");
      await client.query("DELETE FROM resources");
      await client.query("DELETE FROM participants");
      await client.query("DELETE FROM rooms");
      await client.end();
      console.log("[E2E Cleanups] Cleaned PostgreSQL database");
    } catch (e: any) {
      console.error("[E2E Cleanups] PostgreSQL clean error:", e.message);
    }
  }

  if (redisUrl) {
    try {
      const redis = createClient({ url: redisUrl });
      await redis.connect();
      await redis.flushAll();
      await redis.disconnect();
      console.log("[E2E Cleanups] Cleaned Redis cache");
    } catch (e: any) {
      console.error("[E2E Cleanups] Redis clean error:", e.message);
    }
  }
}
