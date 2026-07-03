import { Socket } from "socket.io";
import { redisClient, consumeTokenBucket, checkReplay } from "../../utils/redis";
import { logAuditEvent } from "../../utils/auditLogger";
import { ParticipantRepository } from "../../repositories/ParticipantRepository";
import { ParticipantStatus } from "../../../src/types";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";

export function registerAttendanceHandlers(
  io: any,
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  participantRepo: ParticipantRepository,
  checkIsHostOrCohost: () => Promise<boolean>
) {
  socket.on(SocketEvents.HEARTBEAT, async () => {
    // Refresh participant's active status in Redis
    await redisClient.setEx(`room:${user.roomId}:participant:${user.userId}:heartbeat`, 60, "1");
  });

  socket.on(SocketEvents.RAISE_HAND, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      
      if (user.role !== "PARTICIPANT") return callback({ success: false, error: "Unauthorized" });
      
      const allowed = await consumeTokenBucket(user.userId, "raise_hand", 10, 10);
      if (!allowed) {
         return callback({ success: false, error: "Rate limit exceeded" });
      }
      
      if (!payload || typeof payload.isRaised !== "boolean") {
         return callback({ success: false, error: "Invalid payload" });
      }
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      if (payload.isRaised) {
          await redisClient.sAdd(`room:${user.roomId}:hands`, user.userId);
      } else {
          await redisClient.sRem(`room:${user.roomId}:hands`, user.userId);
      }
      
      roomsNamespace.to(ioRoomId).emit(SocketEvents.PARTICIPANT_HAND_RAISED, {
        participantId: user.userId,
        isRaised: payload.isRaised,
      });
      
      // Log hand raised
      await logAuditEvent(io, user.roomId, "PARTICIPANT_HAND_RAISED", user.userId, { isRaised: payload.isRaised });
      
      callback({ success: true, timestamp: Date.now() });
    } catch (e: any) {
      logger.error("Raise hand error", { error: e.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });

  socket.on(SocketEvents.MODERATE_USER, async (payload) => {
    if (!(await checkIsHostOrCohost())) return;
    // To be implemented in Phase 5
  });
}

export async function handleParticipantJoin(
  io: any,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  participant: any,
  participantRepo: ParticipantRepository
) {
  if (user.role === "PARTICIPANT") {
    if (
      participant.status === "BANNED" ||
      participant.status === "REJECTED"
    ) {
      return false; // disconnect
    }
    if (participant.status !== "WAITING") {
      // Mark as online and broadcast to room (Host should see this)
      await participantRepo.updateStatus(
        user.userId,
        ParticipantStatus.ONLINE,
      );
    }
    await redisClient.sAdd(`room:${user.roomId}:users`, user.userId);
    await redisClient.expire(`room:${user.roomId}:users`, 86400); // 24h TTL
    const currentParticipant = await participantRepo.findById(user.userId);
    roomsNamespace
      .to(ioRoomId)
      .emit(SocketEvents.PARTICIPANT_JOINED, { 
        participantId: user.userId, 
        status: currentParticipant?.status || ParticipantStatus.ONLINE 
      });
    
    await logAuditEvent(io, user.roomId, "PARTICIPANT_JOINED", user.userId, { status: currentParticipant?.status });
  }
  return true;
}

export async function handleParticipantDisconnect(
  io: any,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  participantRepo: ParticipantRepository,
  socket: Socket
) {
  // Remove this socket from the active set immediately
  const socketSetKey = `room:${user.roomId}:participant:${user.userId}:sockets`;
  await redisClient.sRem(socketSetKey, socket.id);

  // Grace period before marking offline
  const timeoutDuration = user.role === "HOST" ? 300000 : 5000; // 5 mins for Host, 5s for Participant

  setTimeout(async () => {
    // Phase 6: Multiple Tab Support Verification
    const count = await redisClient.sCard(socketSetKey);
    if (count > 0) {
      console.log(`[Socket] Reconnect or multi-tab detected for ${user.userId}. Active sockets: ${count}. Aborting offline state transition.`);
      return;
    }

    if (user.role === "PARTICIPANT") {
      const participant = await participantRepo.findById(user.userId);
      if (participant && participant.status !== ParticipantStatus.WAITING) {
        await participantRepo.updateStatus(
          user.userId,
          ParticipantStatus.OFFLINE,
        );
      }
      await redisClient.sRem(`room:${user.roomId}:users`, user.userId);
      await redisClient.sRem(`room:${user.roomId}:hands`, user.userId);
      roomsNamespace
        .to(ioRoomId)
        .emit(SocketEvents.PARTICIPANT_LEFT, { participantId: user.userId });
      
      await logAuditEvent(io, user.roomId, "PARTICIPANT_LEFT", user.userId, { socketId: socket.id });
    } else if (user.role === "HOST") {
      // Phase 4: Host Recovery
      console.log(`[Socket] Host ${user.userId} failed to reconnect within grace period. Closing room ${user.roomId}`);
      const { RoomRepository } = await import("../../repositories/RoomRepository.js" as any);
      const roomRepo = new RoomRepository();
      const room = await roomRepo.findById(user.roomId);
      
      if (room && room.status !== "ARCHIVED" && room.status !== "DESTROYED" && !room.persistOnClose) {
         await roomRepo.updateStatus(user.roomId, "ARCHIVED");
         roomsNamespace.to(ioRoomId).emit("SESSION_CLOSED", { reason: "HOST_TIMEOUT" });
         
         const { db } = await import("../../../src/db/index.js" as any);
         const { participants } = await import("../../../src/db/schema.js" as any);
         const { eq } = await import("drizzle-orm");
         await db.update(participants).set({ status: "OFFLINE", leftAt: new Date() }).where(eq(participants.roomId, user.roomId));
         await logAuditEvent(io, user.roomId, "SESSION_CLOSED", user.userId, { reason: "HOST_TIMEOUT" });
      }
    }
  }, timeoutDuration);
}
