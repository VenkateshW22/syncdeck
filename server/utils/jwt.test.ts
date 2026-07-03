import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "./jwt";

describe("JWT Utils", () => {
  it("should generate and verify a token successfully", () => {
    const payload = { userId: "test-user-123", role: "HOST", roomId: "test-room-123" } as const;
    const token = generateToken(payload, 3600);
    
    expect(token).toBeDefined();
    
    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.role).toBe(payload.role);
  });

  it("should throw for invalid tokens", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow();
  });
});
