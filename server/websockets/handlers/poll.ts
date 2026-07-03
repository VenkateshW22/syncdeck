import { Socket } from "socket.io";
import { redisClient, consumeTokenBucket, checkReplay } from "../../utils/redis";
import sanitizeHtml from "sanitize-html";
import { logAuditEvent } from "../../utils/auditLogger";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";

import { queuePollVote } from "./pollBatcher";

export function registerPollHandlers(
  io: any,
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  checkIsHostOrCohost: () => Promise<boolean>
) {
  socket.on(SocketEvents.SUBMIT_POLL_VOTE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      
      const allowed = await consumeTokenBucket(user.userId, "poll_vote", 5, 1);
      if (!allowed) {
        logger.warn("Rate limit exceeded for poll vote", { userId: user.userId, roomId: user.roomId });
        return callback({ success: false, error: "Rate limit exceeded" });
      }

      if (
        !payload ||
        typeof payload.optionIndex !== "number" ||
        !Number.isInteger(payload.optionIndex) ||
        payload.optionIndex < 0 ||
        payload.optionIndex > 100
      ) {
        return callback({ success: false, error: "Invalid payload" });
      }
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const pollStr = await redisClient.get(`room:${user.roomId}:active_poll`);
      if (pollStr) {
        const poll = JSON.parse(pollStr);
        // Strict payload validation
        if (payload.optionIndex >= poll.options.length) {
            return callback({ success: false, error: "Invalid option index" });
        }
        
        if (!poll.votes) poll.votes = {};
        if (poll.votes[user.userId] !== undefined) {
            return callback({ success: false, error: "Already voted" });
        }
        
        // Enqueue vote for batching instead of direct Redis write and emit
        queuePollVote(ioRoomId, user.userId, payload.optionIndex, roomsNamespace);

        callback({ success: true, timestamp: Date.now() });
      } else {
        return callback({ success: false, error: "No active poll" });
      }
    } catch (error: any) {
      logger.error("Poll vote error", { error: error.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });

  socket.on(SocketEvents.START_POLL, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      const isHost = await checkIsHostOrCohost();
      if (!isHost) return callback({ success: false, error: "Unauthorized" });
      
      const allowed = await consumeTokenBucket(user.userId, "poll_create", 5, 1);
      if (!allowed) {
        return callback({ success: false, error: "Rate limit exceeded" });
      }

      if (!payload || !payload.question || !Array.isArray(payload.options))
        return callback({ success: false, error: "Invalid payload" });
        
      if (payload.question.length > 200) return callback({ success: false, error: "Question too long" });
      if (
        payload.options.length > 10 ||
        payload.options.some(
          (o: string) => typeof o !== "string" || o.length > 100,
        )
      ) {
        return callback({ success: false, error: "Invalid options" });
      }
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const newPoll = {
        question: sanitizeHtml(payload.question),
        options: payload.options.map((o: string) => sanitizeHtml(o)),
        votes: {}
      };

      await redisClient.set(`room:${user.roomId}:active_poll`, JSON.stringify(newPoll));
      roomsNamespace.to(ioRoomId).emit(SocketEvents.POLL_STARTED, newPoll);
      await logAuditEvent(io, user.roomId, "POLL_CREATED", user.userId, { question: newPoll.question });
      
      callback({ success: true, timestamp: Date.now() });
    } catch (error: any) {
      logger.error("Start poll error", { error: error.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });

  socket.on(SocketEvents.STOP_POLL, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      const isHost = await checkIsHostOrCohost();
      if (!isHost) return callback({ success: false, error: "Unauthorized" });
      
      if (payload?.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const pollStr = await redisClient.get(`room:${user.roomId}:active_poll`);
      await redisClient.del(`room:${user.roomId}:active_poll`);
      roomsNamespace.to(ioRoomId).emit(SocketEvents.POLL_STOPPED);
      if (pollStr) {
         await logAuditEvent(io, user.roomId, "POLL_ENDED", user.userId, JSON.parse(pollStr));
      }
      callback({ success: true, timestamp: Date.now() });
    } catch (error: any) {
      logger.error("Stop poll error", { error: error.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });
}
