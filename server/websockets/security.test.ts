import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerChatHandlers } from "./handlers/chat";
import { registerScreenShareHandlers } from "./handlers/screenShare";
import { registerPollHandlers } from "./handlers/poll";
import { SocketEvents } from "../../src/constants/socketEvents";

// Mocks
vi.mock("../../server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let mockBucketAllowed = true;
let mockIsReplay = false;

vi.mock("../utils/redis", () => ({
  redisClient: {
    rPush: vi.fn(),
    lTrim: vi.fn(),
    sAdd: vi.fn(),
    sRem: vi.fn(),
    get: vi.fn(),
    setEx: vi.fn(),
    sIsMember: vi.fn().mockResolvedValue(true),
    sMembers: vi.fn().mockResolvedValue(["target-socket-id"]),
  },
  consumeTokenBucket: vi.fn().mockImplementation(() => mockBucketAllowed),
  checkReplay: vi.fn().mockImplementation(() => mockIsReplay),
}));

describe("WebSocket Security & Validation", () => {
  let mockSocket: any;
  let mockIo: any;
  let mockRoomsNamespace: any;
  let callbacks: any;
  let emittedEvents: any[];
  
  beforeEach(() => {
    mockBucketAllowed = true;
    mockIsReplay = false;
    callbacks = {};
    emittedEvents = [];
    
    mockSocket = {
      on: vi.fn((event, cb) => {
        callbacks[event] = cb;
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn((event, payload) => {
        emittedEvents.push({ event, payload });
      }),
      data: {}
    };
    
    mockRoomsNamespace = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn((event, payload) => {
        emittedEvents.push({ event, payload });
      }),
    };
    
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn((event, payload) => {
        emittedEvents.push({ event, payload });
      }),
    };
  });

  describe("Phase 1 & 2 & 7: Payload Validation & Size Limits", () => {
    it("should reject oversized chat messages", async () => {
      const user = { userId: "user1", roomId: "room1", displayName: "Test", role: "PARTICIPANT" };
      registerChatHandlers(mockIo, mockSocket, mockRoomsNamespace, "room1", user, { messageCount: 0 });
      
      const chatHandler = callbacks[SocketEvents.CHAT_MESSAGE];
      expect(chatHandler).toBeDefined();
      
      const oversizedText = "a".repeat(501);
      const callbackSpy = vi.fn();
      
      await chatHandler({ text: oversizedText }, callbackSpy);
      
      expect(callbackSpy).toHaveBeenCalledWith({ success: false, error: "Message too long (max 500 chars)" });
    });

    it("should reject malformed chat payloads", async () => {
      const user = { userId: "user1", roomId: "room1", displayName: "Test", role: "PARTICIPANT" };
      registerChatHandlers(mockIo, mockSocket, mockRoomsNamespace, "room1", user, { messageCount: 0 });
      
      const chatHandler = callbacks[SocketEvents.CHAT_MESSAGE];
      const callbackSpy = vi.fn();
      
      await chatHandler({ text: 123 }, callbackSpy); // Not a string
      expect(callbackSpy).toHaveBeenCalledWith({ success: false, error: "Invalid payload" });
      
      await chatHandler(null, callbackSpy); // Null payload
      expect(callbackSpy).toHaveBeenCalledWith({ success: false, error: "Invalid payload" });
    });
  });

  describe("Phase 3 & 4: Authorization & Identity Verification", () => {
    it("should prevent participants from initiating host-only signaling", async () => {
      const user = { userId: "user1", roomId: "room1", displayName: "Test", role: "PARTICIPANT" };
      const isHostMock = vi.fn().mockResolvedValue(false);
      registerScreenShareHandlers(mockIo, mockSocket, "room1", user, isHostMock, { webrtcCount: 0 });
      
      const offerHandler = callbacks[SocketEvents.WEBRTC_OFFER];
      await offerHandler({ offer: { sdp: "dummy", type: "offer" }, targetId: "target1" });
      
      // Should not emit anything since it's unauthorized
      expect(emittedEvents.length).toBe(0);
    });

    it("should allow hosts to initiate signaling", async () => {
      const user = { userId: "host1", roomId: "room1", displayName: "Host", role: "HOST" };
      const isHostMock = vi.fn().mockResolvedValue(true);
      registerScreenShareHandlers(mockIo, mockSocket, "room1", user, isHostMock, { webrtcCount: 0 });
      
      const offerHandler = callbacks[SocketEvents.WEBRTC_OFFER];
      await offerHandler({ offer: { sdp: "dummy", type: "offer" }, targetId: "target1" });
      
      if (emittedEvents.length === 0) {
        console.error("No events emitted!");
      }
      
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe(SocketEvents.WEBRTC_OFFER_RECEIVED);
      expect(emittedEvents[0].payload.sourceId).toBe("host1");
    });
  });

  describe("Phase 8: Replay Protection", () => {
    it("should reject duplicate requests", async () => {
      mockIsReplay = true; // Simulate replay detection
      
      const user = { userId: "user1", roomId: "room1", displayName: "Test", role: "PARTICIPANT" };
      registerChatHandlers(mockIo, mockSocket, mockRoomsNamespace, "room1", user, { messageCount: 0 });
      
      const chatHandler = callbacks[SocketEvents.CHAT_MESSAGE];
      const callbackSpy = vi.fn();
      
      await chatHandler({ text: "Hello", requestId: "req-123" }, callbackSpy);
      
      expect(callbackSpy).toHaveBeenCalledWith({ success: false, error: "Duplicate request" });
    });
  });

  describe("Phase 11: Rate Limiting", () => {
    it("should reject events when rate limit is exceeded", async () => {
      mockBucketAllowed = false; // Simulate rate limit exceeded
      
      const user = { userId: "user1", roomId: "room1", displayName: "Test", role: "PARTICIPANT" };
      registerChatHandlers(mockIo, mockSocket, mockRoomsNamespace, "room1", user, { messageCount: 0 });
      
      const chatHandler = callbacks[SocketEvents.CHAT_MESSAGE];
      const callbackSpy = vi.fn();
      
      await chatHandler({ text: "Hello" }, callbackSpy);
      
      expect(callbackSpy).toHaveBeenCalledWith({ success: false, error: "Rate limit exceeded" });
    });
  });
});
