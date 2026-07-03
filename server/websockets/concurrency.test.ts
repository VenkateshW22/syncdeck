import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerPollHandlers } from "./handlers/poll";
import { SocketEvents } from "../../src/constants/socketEvents";
import { redisClient } from "../utils/redis";

vi.mock("../../server", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WebSocket Concurrency & Batching Tests", () => {
  let mockSocket: any;
  let mockRoomsNamespace: any;
  let mockIo: any;
  let emittedEvents: any[];
  let socketCallback: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    emittedEvents = [];
    
    // Initialize Redis state
    await redisClient.set(
      "room:room-123:active_poll",
      JSON.stringify({
        question: "Concurrent test poll?",
        options: ["Option A", "Option B"],
        votes: {},
      })
    );

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

    // Spy on and mock eval to process active poll updates during batch flushes
    vi.spyOn(redisClient, "eval").mockImplementation(async (script: string, args: any) => {
      const pollStr = await redisClient.get(args.keys[0]);
      if (pollStr) {
         const poll = JSON.parse(pollStr);
         if (!poll.votes) poll.votes = {};
         const votes = JSON.parse(args.arguments[0]);
         for (const [userId, optionIdx] of Object.entries(votes)) {
            poll.votes[userId] = optionIdx as number;
         }
         await redisClient.set(args.keys[0], JSON.stringify(poll));
         return pollStr;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should process 50 concurrent votes and write them atomically without conflicts", async () => {
    // 1. We will simulate registering 50 separate sockets representing 50 different users
    const userIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);
    const promises: Promise<any>[] = [];

    // Trigger queueing logic concurrently
    userIds.forEach((userId) => {
      const socketListeners: Record<string, Function> = {};
      const individualSocket = {
        on: vi.fn((event, cb) => {
          socketListeners[event] = cb;
        }),
      } as any;

      const userSession = {
        userId,
        roomId: "room-123",
        role: "PARTICIPANT",
      };

      registerPollHandlers(
        mockIo,
        individualSocket,
        mockRoomsNamespace,
        "room:room-123",
        userSession,
        async () => false
      );

      const voteHandler = socketListeners[SocketEvents.SUBMIT_POLL_VOTE];
      expect(voteHandler).toBeDefined();

      // Submit vote concurrently (alternating between option 0 and option 1)
      const optionIndex = userId.endsWith("0") || userId.endsWith("2") || userId.endsWith("4") || userId.endsWith("6") || userId.endsWith("8") ? 0 : 1;
      const callbackSpy = vi.fn();
      
      const promise = voteHandler({ optionIndex }, callbackSpy);
      promises.push(promise);
    });

    // Await all handlers trigger (they enqueue votes)
    await Promise.all(promises);

    // 2. Wait for 250ms batching delay (use fake timers to execute all pending async tasks)
    await vi.runAllTimersAsync();

    // 3. Verify Redis active_poll state has all 50 votes
    const pollStr = await redisClient.get("room:room-123:active_poll");
    
    expect(pollStr).toBeDefined();
    
    const poll = JSON.parse(pollStr!);
    expect(poll.votes).toBeDefined();
    expect(Object.keys(poll.votes).length).toBe(50);

    // Verify some specific users' votes
    expect(poll.votes["user-0"]).toBe(0);
    expect(poll.votes["user-1"]).toBe(1);
    expect(poll.votes["user-49"]).toBe(1);

    // 4. Verify socket broadcasts aggregated counts to rooms namespace
    const voteReceivedEvents = emittedEvents.filter(
      (e) => e.event === SocketEvents.POLL_VOTE_RECEIVED
    );
    expect(voteReceivedEvents.length).toBeGreaterThan(0);
  });
});
