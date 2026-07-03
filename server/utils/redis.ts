import { createClient } from "redis";

export class InMemoryRedisMock {
  private hash: Record<string, Record<string, string>> = {};
  private zset: Record<string, { score: number; value: string }[]> = {};
  private sets: Record<string, Set<string>> = {};
  private list: Record<string, string[]> = {};
  private kv: Record<string, string> = {};
  private timers: Record<string, NodeJS.Timeout> = {};

  public isOpen = true;

  on(event: string, handler: any) {
    if (event === "connect") {
      setTimeout(handler, 0);
    }
  }

  async consumeTokenBucket(key: string, limit: number, refillRate: number): Promise<boolean> {
    const now = Date.now();
    const stateStr = await this.get(key);
    let state = stateStr ? JSON.parse(stateStr) : { tokens: limit, lastRefill: now };

    const elapsedTime = now - state.lastRefill;
    if (elapsedTime > 0) {
      const tokensToAdd = (elapsedTime / 1000) * refillRate;
      state.tokens = Math.min(limit, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }

    if (state.tokens >= 1) {
      state.tokens -= 1;
      await this.set(key, JSON.stringify(state));
      await this.expire(key, 3600); // expire after 1h
      return true;
    }
    return false;
  }

  async checkReplay(requestId: string): Promise<boolean> {
    if (!requestId) return false;
    const key = `processed_request:${requestId}`;
    const exists = await this.get(key);
    if (exists) return true; // Replayed
    await this.set(key, "1");
    await this.expire(key, 300); // 5 mins
    return false; // Not replayed
  }

  private clearTimer(key: string) {
    if (this.timers[key]) {
      clearTimeout(this.timers[key]);
      delete this.timers[key];
    }
  }

  async expire(key: string, seconds: number) {
    this.clearTimer(key);
    this.timers[key] = setTimeout(() => {
      this.del(key);
    }, seconds * 1000);
  }

  async hSet(key: string, field: string, value: string) {
    if (!this.hash[key]) this.hash[key] = {};
    this.hash[key][field] = value;
  }

  async hGet(key: string, field: string) {
    if (!this.hash[key]) return null;
    return this.hash[key][field] || null;
  }

  async hDel(key: string, field: string) {
    if (this.hash[key]) {
      delete this.hash[key][field];
    }
  }

  async zAdd(key: string, member: { score: number; value: string }) {
    if (!this.zset[key]) this.zset[key] = [];
    this.zset[key].push(member);
    this.zset[key].sort((a, b) => a.score - b.score);
  }

  async zRem(key: string, value: string) {
    if (this.zset[key]) {
      this.zset[key] = this.zset[key].filter((m) => m.value !== value);
    }
  }

  async zRange(key: string, start: number, stop: number) {
    if (!this.zset[key]) return [];
    let end = stop === -1 ? this.zset[key].length : stop + 1;
    return this.zset[key].slice(start, end).map((m) => m.value);
  }

  async sAdd(key: string, value: string) {
    if (!this.sets[key]) this.sets[key] = new Set();
    this.sets[key].add(value);
  }

  async sRem(key: string, value: string) {
    if (this.sets[key]) {
      this.sets[key].delete(value);
    }
  }

  async sMembers(key: string) {
    if (!this.sets[key]) return [];
    return Array.from(this.sets[key]);
  }

  async sCard(key: string): Promise<number> {
    if (!this.sets[key]) return 0;
    return this.sets[key].size;
  }

  async sIsMember(key: string, value: string): Promise<boolean> {
    if (!this.sets[key]) return false;
    return this.sets[key].has(value);
  }

  async setNX(key: string, value: string): Promise<number> {
    if (this.kv[key] !== undefined) {
      return 0;
    }
    this.kv[key] = value;
    return 1;
  }

  async zRangeByScore(key: string, min: number, max: number): Promise<string[]> {
    if (!this.zset[key]) return [];
    return this.zset[key]
      .filter((m) => m.score >= min && m.score <= max)
      .map((m) => m.value);
  }

  async connect(): Promise<void> {}

  async lRange(key: string, start: number, stop: number) {
    if (!this.list[key]) return [];
    let end = stop === -1 ? this.list[key].length : stop + 1;
    // Fix start index parsing for negative indices
    let s = start < 0 ? Math.max(0, this.list[key].length + start) : start;
    let e = stop < 0 ? this.list[key].length + stop + 1 : end;
    return this.list[key].slice(s, e);
  }

  async rPush(key: string, value: string) {
    if (!this.list[key]) this.list[key] = [];
    this.list[key].push(value);
  }

  async lTrim(key: string, start: number, stop: number) {
    if (!this.list[key]) return;
    let s = start < 0 ? Math.max(0, this.list[key].length + start) : start;
    let end = stop === -1 ? this.list[key].length : stop + 1;
    let e = stop < 0 ? this.list[key].length + stop + 1 : end;
    this.list[key] = this.list[key].slice(s, e);
  }

  async get(key: string) {
    return this.kv[key] || null;
  }

  async set(key: string, value: string) {
    this.clearTimer(key);
    this.kv[key] = value;
  }

  async setEx(key: string, seconds: number, value: string) {
    this.clearTimer(key);
    this.kv[key] = value;
    this.timers[key] = setTimeout(() => {
      this.del(key);
    }, seconds * 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    const listKeys = Object.keys(this.list);
    // basic matcher since we don't have glob support natively
    // for 'room:*:chat'
    if (pattern.includes('*')) {
       const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
       return listKeys.filter(k => regex.test(k));
    }
    return listKeys.filter(k => k === pattern);
  }

  async duplicate() {
    return this;
  }

  async subscribe(channel: string, listener: any) {}
  async pSubscribe(pattern: string, listener: any) {}
  async publish(channel: string, message: string) {}
  async unsubscribe(channel: string) {}
  async pUnsubscribe(pattern: string) {}

  async del(key: string) {
    this.clearTimer(key);
    delete this.hash[key];
    delete this.zset[key];
    delete this.sets[key];
    delete this.list[key];
    delete this.kv[key];
  }

  multi() {
    const pipeline: any[] = [];
    const client = this;
    const multiObj = {
        rPush: function(key: string, value: string) { pipeline.push(async () => client.rPush(key, value)); return this; },
        lTrim: function(key: string, start: number, end: number) { pipeline.push(async () => client.lTrim(key, start, end)); return this; },
        setEx: function(key: string, seconds: number, value: string) { pipeline.push(async () => client.setEx(key, seconds, value)); return this; },
        exec: async function() { 
            const results = [];
            for (const fn of pipeline) results.push(await fn());
            return results;
        }
    };
    return multiObj as any;
  }

  async eval(script: string, args: any) {
    // Quick and dirty mock for the specific Lua script
    if (script.includes("active_poll")) {
      const pollStr = await this.get(args.keys[0]);
      if (pollStr) {
         const poll = JSON.parse(pollStr);
         if (!poll.votes) poll.votes = {};
         const votes = JSON.parse(args.arguments[0]);
         for (const [userId, optionIdx] of Object.entries(votes)) {
            if (userId === "__proto__" || userId === "constructor") continue;
            poll.votes[userId] = optionIdx as number;
         }
         await this.set(args.keys[0], JSON.stringify(poll));
         return pollStr;
      }
      return null;
    }
  }
}

// validateEnv() (server/config/env.ts, run at startup before this module is
// imported) already refuses to boot in production/staging without REDIS_URL.
// This is an extra safety net in case this module is ever imported from a code
// path that skipped validation (e.g. a script or test).
// C6 FIX: Include staging in this guard — staging must never silently degrade
// to an in-memory mock (which disables rate limiting and replay protection).
if ((process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") && !process.env.REDIS_URL) {
  throw new Error(
    `REDIS_URL is not set in ${process.env.NODE_ENV}. Refusing to start with an in-memory Redis mock.`
  );
}

export const redisClient = process.env.REDIS_URL
  ? (createClient({ url: process.env.REDIS_URL }) as any)
  : new InMemoryRedisMock();

// node-redis emits 'error' events on transient connection issues (reset,
// timeout, server restart). Without a listener, Node treats an unhandled
// 'error' event as fatal and crashes the whole process. This keeps the
// server alive; the client's built-in reconnect strategy handles recovery.
if (process.env.REDIS_URL) {
  redisClient.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("[Redis] Client error:", err.message);
  });
}

export async function consumeTokenBucket(userId: string, action: string, limit: number, refillRate: number): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const now = Date.now();
  const stateStr = await redisClient.get(key);
  let state = stateStr ? JSON.parse(stateStr) : { tokens: limit, lastRefill: now };

  const elapsedTime = now - state.lastRefill;
  if (elapsedTime > 0) {
    const tokensToAdd = (elapsedTime / 1000) * refillRate;
    state.tokens = Math.min(limit, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }

  if (state.tokens >= 1) {
    state.tokens -= 1;
    await redisClient.set(key, JSON.stringify(state));
    await redisClient.expire(key, 3600); // expire after 1h
    return true;
  }
  return false;
}

// L1 FIX: Use atomic setNX (SET if Not eXists) for replay protection.
// The previous get→set pattern had a race condition where two concurrent
// requests with the same requestId could both pass before either set the key.
export async function checkReplay(requestId: string): Promise<boolean> {
  if (!requestId) return false;
  const key = `processed_request:${requestId}`;
  // setNX returns 1 (truthy) if the key was newly set (not a replay),
  // or 0 (falsy) if the key already existed (replay detected).
  const wasNew = await redisClient.setNX(key, "1");
  if (!wasNew) return true; // Replayed
  // Set expiry separately — setNX doesn't support EX in node-redis v4 directly
  await redisClient.expire(key, 300); // 5 mins
  return false; // Not replayed
}

export async function connectRedis() {
  if (process.env.REDIS_URL) {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } else if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
