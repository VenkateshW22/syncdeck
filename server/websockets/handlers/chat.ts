import { Socket } from "socket.io";
import { redisClient, consumeTokenBucket, checkReplay } from "../../utils/redis";
import sanitizeHtml from "sanitize-html";
import { logAuditEvent } from "../../utils/auditLogger";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";
import { randomBytes } from "crypto";

export function registerChatHandlers(
  io: any,
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  rateLimits: { messageCount: number }
) {
  socket.on(SocketEvents.CHAT_MESSAGE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      
      const allowed = await consumeTokenBucket(user.userId, "chat", 10, 10);
      if (!allowed) {
        logger.warn("Rate limit exceeded for chat", { userId: user.userId, roomId: user.roomId });
        return callback({ success: false, error: "Rate limit exceeded" });
      }
      
      if (!payload || typeof payload.text !== "string" || !payload.text.trim()) {
        return callback({ success: false, error: "Invalid payload" });
      }
        
      if (payload.text.length > 500) {
        logger.warn("Oversized chat payload", { userId: user.userId, roomId: user.roomId, size: payload.text.length });
        return callback({ success: false, error: "Message too long (max 500 chars)" });
      }
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const message = {
        // H3 FIX: Use cryptographically random ID instead of Math.random() (predictable).
        id: randomBytes(9).toString("base64url"),
        senderId: user.userId,
        senderName: user.displayName, // Identity Verification (Phase 4)
        text: sanitizeHtml(payload.text.trim()),
        timestamp: Date.now(),
      };
      
      await redisClient.rPush(`room:${user.roomId}:chat`, JSON.stringify(message));
      await redisClient.lTrim(`room:${user.roomId}:chat`, -100, -1); // Keep last 100 messages max

      // Write-through persistence
      await logAuditEvent(io, user.roomId, "CHAT_MESSAGE_SENT", user.userId, message);

      roomsNamespace.to(ioRoomId).emit(SocketEvents.CHAT_MESSAGE_RECEIVED, message);
      callback({ success: true, messageId: message.id, timestamp: message.timestamp });
    } catch (error: any) {
      logger.error("Chat handler error", { error: error.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });
}
