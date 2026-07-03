import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRedisMock } from "./redis";

describe("InMemoryRedisMock", () => {
  let client: InMemoryRedisMock;

  beforeEach(() => {
    client = new InMemoryRedisMock();
  });

  it("should set and get values", async () => {
    await client.set("key1", "value1");
    const val = await client.get("key1");
    expect(val).toBe("value1");
  });

  it("should handle lists (rPush, lRange, lTrim)", async () => {
    await client.rPush("list1", "a");
    await client.rPush("list1", "b");
    await client.rPush("list1", "c");
    
    let items = await client.lRange("list1", 0, -1);
    expect(items).toEqual(["a", "b", "c"]);
    
    await client.lTrim("list1", -2, -1);
    items = await client.lRange("list1", 0, -1);
    expect(items).toEqual(["b", "c"]);
  });

  it("should handle sets (sAdd, sMembers, sRem)", async () => {
    await client.sAdd("set1", "user1");
    await client.sAdd("set1", "user2");
    
    let members = await client.sMembers("set1");
    expect(members).toContain("user1");
    expect(members).toContain("user2");
    
    await client.sRem("set1", "user1");
    members = await client.sMembers("set1");
    expect(members).not.toContain("user1");
    expect(members).toContain("user2");
  });
  
  it("should handle keys pattern matching", async () => {
    await client.set("room:123:active", "true");
    await client.rPush("room:123:chat", "hello");
    await client.rPush("room:456:chat", "world");
    
    const keys = await client.keys("room:*:chat");
    expect(keys).toContain("room:123:chat");
    expect(keys).toContain("room:456:chat");
    expect(keys).not.toContain("room:123:active"); // It defaults to searching list keys in the mock
  });
});
