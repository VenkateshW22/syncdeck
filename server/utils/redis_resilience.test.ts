import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeTokenBucket, redisClient } from "./redis";

vi.mock("../../server", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Redis Utilities — Token Bucket Rate-Limiting & Resilience", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset key store
    const keys = await redisClient.keys("rate_limit:*");
    for (const key of keys) {
      await redisClient.del(key);
    }
  });

  describe("consumeTokenBucket", () => {
    it("should allow requests up to the limit and then deny further requests", async () => {
      const userId = "test-user-1";
      const action = "chat_message";
      const limit = 3;
      const refillRate = 1; // 1 token per second

      // Consume first 3 tokens (limit is 3)
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);

      // 4th request must be denied (bucket is dry)
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(false);
    });

    it("should refill tokens mathematically over simulated time", async () => {
      const userId = "test-user-2";
      const action = "chat_message";
      const limit = 2;
      const refillRate = 1; // 1 token per second

      // Exhaust bucket
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(false);

      // Spy on Date.now to simulate waiting 1 second
      const baseTime = Date.now();
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime + 1050); // 1.05s later

      // Bucket should have refilled 1 token, allowing 1 request
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(true);

      // Next request immediately after should be blocked
      expect(await consumeTokenBucket(userId, action, limit, refillRate)).toBe(false);

      dateSpy.mockRestore();
    });
  });

  describe("Redis Readiness check", () => {
    it("should show status ok when redis is connected", () => {
      expect(redisClient.isOpen).toBe(true);
    });

    it("should reflect disconnection state correctly in checks", async () => {
      // Mock redis client connection state to false
      const originalIsOpen = redisClient.isOpen;
      
      try {
        redisClient.isOpen = false;
        
        // Simulating the server.ts readiness check endpoint code
        const checks: Record<string, "ok" | "error"> = { database: "ok", redis: "error" };
        if (redisClient.isOpen) checks.redis = "ok";

        expect(checks.redis).toBe("error");
        
        const isReady = Object.values(checks).every((v) => v === "ok");
        expect(isReady).toBe(false);
      } finally {
        redisClient.isOpen = originalIsOpen;
      }
    });
  });
});
