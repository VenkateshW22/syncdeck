import { Socket } from "socket.io";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { consumeTokenBucket } from "../../utils/redis";
import { logger } from "../../../server";

export function registerReactionHandlers(
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any
) {
  socket.on(SocketEvents.EMOJI_REACTION, async (payload) => {
    try {
      if (!payload || typeof payload.emoji !== "string") return;
      
      const allowed = await consumeTokenBucket(user.userId, "emoji", 15, 15);
      if (!allowed) return;
      
      const sanitizedEmoji = payload.emoji.trim();
      if (sanitizedEmoji.length > 8) return; // Payload limit Phase 7
      
      roomsNamespace.to(ioRoomId).emit(SocketEvents.EMOJI_REACTION_RECEIVED, {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        emoji: sanitizedEmoji,
        senderName: user.displayName, // Identity Verification Phase 4
        userId: user.userId,
        timestamp: Date.now()
      });
    } catch (e: any) {
      logger.error("Emoji reaction error", { error: e.message, userId: user.userId });
    }
  });
}
