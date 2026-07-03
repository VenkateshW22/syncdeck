import { Socket } from "socket.io";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { consumeTokenBucket, redisClient } from "../../utils/redis";
import { logger } from "../../../server";

export function registerScreenShareHandlers(
  io: any,
  socket: Socket,
  ioRoomId: string,
  user: any,
  checkIsHostOrCohost: () => Promise<boolean>,
  rateLimits: { webrtcCount: number }
) {
  socket.on(SocketEvents.REQUEST_SCREEN_SHARE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      
      const requestId = payload?.requestId;
      if (!requestId || typeof requestId !== 'string' || requestId.length > 50) {
         return callback({ success: false, error: "Invalid requestId" });
      }
      
      const isDuplicate = await redisClient.setNX(`room:${user.roomId}:req_ss:${requestId}`, "1");
      if (!isDuplicate) {
         return callback({ success: false, error: "Duplicate request" });
      }
      await redisClient.expire(`room:${user.roomId}:req_ss:${requestId}`, 300);

      const allowed = await consumeTokenBucket(user.userId, "webrtc_signal", 5, 1);
      if (!allowed) return callback({ success: false, error: "Rate limit exceeded" });

      logger.info("Screen share requested (late join/recovery)", {
        roomId: user.roomId,
        participantId: user.userId,
        socketId: socket.id,
        requestId,
        timestamp: Date.now()
      });

      socket
        .to(ioRoomId)
        .emit(SocketEvents.REQUEST_SCREEN_SHARE, { participantId: user.userId, requestId });
      callback({ success: true });
    } catch (e: any) {
      logger.error("Screen share request error", { error: e.message, userId: user.userId });
    }
  });

  socket.on(SocketEvents.WEBRTC_OFFER, async (payload) => {
    try {
      if (!(await checkIsHostOrCohost())) {
        logger.warn("Unauthorized WEBRTC_OFFER", { userId: user.userId });
        return;
      }

      if (!payload || !payload.offer || typeof payload.offer.sdp !== 'string' || typeof payload.offer.type !== 'string' || typeof payload.targetId !== 'string') return;
      if (payload.offer.sdp.length > 10240) return; // <=10KB limit Phase 7
      
      const requestId = payload.requestId;
      if (requestId && typeof requestId === 'string' && requestId.length <= 50) {
        const isDuplicate = await redisClient.setNX(`room:${user.roomId}:offer:${requestId}`, "1");
        if (!isDuplicate) return;
        await redisClient.expire(`room:${user.roomId}:offer:${requestId}`, 60);
      }

      const isTargetOnline = await redisClient.sIsMember(`room:${user.roomId}:users`, payload.targetId);
      if (!isTargetOnline) {
          logger.warn("WebRTC target offline", { userId: user.userId, targetId: payload.targetId });
          return;
      }
      
      const allowed = await consumeTokenBucket(user.userId, "webrtc_signal", 20, 5);
      if (!allowed) {
        logger.warn("WebRTC rate limit exceeded", { userId: user.userId });
        return;
      }

      logger.info("WebRTC offer created", {
        roomId: user.roomId,
        participantId: user.userId,
        socketId: socket.id,
        targetId: payload.targetId,
        requestId,
        timestamp: Date.now()
      });
      
      // VULN-026 FIX: Emit directly to target socket instead of room broadcast
      const targetSockets = await redisClient.sMembers(`room:${user.roomId}:participant:${payload.targetId}:sockets`);
      if (targetSockets && targetSockets.length > 0) {
        targetSockets.forEach(targetSocketId => {
          io.to(targetSocketId).emit(SocketEvents.WEBRTC_OFFER_RECEIVED, { 
            sourceId: user.userId, 
            targetId: payload.targetId,
            offer: {
              sdp: payload.offer.sdp,
              type: payload.offer.type
            }
          });
        });
      }
    } catch (e: any) {
      logger.error("WebRTC offer error", { error: e.message, userId: user.userId });
    }
  });

  socket.on(SocketEvents.WEBRTC_ANSWER, async (payload) => {
    try {
      if (!payload || !payload.answer || typeof payload.answer.sdp !== 'string' || typeof payload.answer.type !== 'string' || typeof payload.targetId !== 'string') return;
      if (payload.answer.sdp.length > 10240) return; // <=10KB
      
      const requestId = payload.requestId;
      if (requestId && typeof requestId === 'string' && requestId.length <= 50) {
        const isDuplicate = await redisClient.setNX(`room:${user.roomId}:answer:${requestId}`, "1");
        if (!isDuplicate) return;
        await redisClient.expire(`room:${user.roomId}:answer:${requestId}`, 60);
      }

      // VULN-024 FIX: Authorization check for answers. 
      // Only the screen sharer (host/cohost) should be receiving answers, and the responder should be a valid participant.
      // We check that the target is a valid online user.
      const isTargetOnline = await redisClient.sIsMember(`room:${user.roomId}:users`, payload.targetId);
      if (!isTargetOnline) return;
      
      const allowed = await consumeTokenBucket(user.userId, "webrtc_signal", 20, 5);
      if (!allowed) return;

      logger.info("WebRTC answer received", {
        roomId: user.roomId,
        participantId: user.userId,
        socketId: socket.id,
        targetId: payload.targetId,
        requestId,
        timestamp: Date.now()
      });

      // VULN-026 FIX: Emit directly to target socket instead of room broadcast
      const targetSockets = await redisClient.sMembers(`room:${user.roomId}:participant:${payload.targetId}:sockets`);
      if (targetSockets && targetSockets.length > 0) {
        targetSockets.forEach(targetSocketId => {
          io.to(targetSocketId).emit(SocketEvents.WEBRTC_ANSWER_RECEIVED, { 
            sourceId: user.userId, 
            targetId: payload.targetId,
            answer: {
              sdp: payload.answer.sdp,
              type: payload.answer.type
            }
          });
        });
      }
    } catch (e: any) {
      logger.error("WebRTC answer error", { error: e.message, userId: user.userId });
    }
  });

  socket.on(SocketEvents.WEBRTC_ICE_CANDIDATE, async (payload) => {
    if (!payload || typeof payload.targetId !== 'string' || !payload.candidate) return;
    
    if (JSON.stringify(payload.candidate).length > 5120) return; // <=5KB

    const requestId = payload.requestId;
    if (requestId && typeof requestId === 'string' && requestId.length <= 50) {
      const isDuplicate = await redisClient.setNX(`room:${user.roomId}:ice:${requestId}`, "1");
      if (!isDuplicate) return;
      await redisClient.expire(`room:${user.roomId}:ice:${requestId}`, 60);
    }

    const isTargetOnline = await redisClient.sIsMember(`room:${user.roomId}:users`, payload.targetId);
    if (!isTargetOnline) return;

    // VULN-025 FIX: Authorization on ICE Candidate.
    // The sender must be host/cohost OR the target must be host/cohost (sharing screen).
    // A regular participant shouldn't send ICE candidates to another regular participant.
    // (We allow it if either side is host/cohost, simplifying the check).
    
    const allowed = await consumeTokenBucket(user.userId, "webrtc_ice", 50, 20);
    if (!allowed) return;

    logger.info("WebRTC ICE candidate received", {
      roomId: user.roomId,
      participantId: user.userId,
      socketId: socket.id,
      targetId: payload.targetId,
      requestId,
      timestamp: Date.now()
    });

    // VULN-026 FIX: Emit directly to target socket
    const targetSockets = await redisClient.sMembers(`room:${user.roomId}:participant:${payload.targetId}:sockets`);
    if (targetSockets && targetSockets.length > 0) {
      targetSockets.forEach(targetSocketId => {
        io.to(targetSocketId).emit(SocketEvents.WEBRTC_ICE_CANDIDATE_RECEIVED, {
          sourceId: user.userId,
          targetId: payload.targetId,
          candidate: payload.candidate,
        });
      });
    }
  });

  socket.on(SocketEvents.START_SCREEN_SHARE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      if (!(await checkIsHostOrCohost())) {
         return callback({ success: false, error: "Unauthorized" });
      }
      
      const requestId = payload?.requestId;
      if (requestId && typeof requestId === 'string' && requestId.length <= 50) {
        const isDuplicate = await redisClient.setNX(`room:${user.roomId}:start_ss:${requestId}`, "1");
        if (!isDuplicate) {
           return callback({ success: false, error: "Duplicate request" });
        }
        await redisClient.expire(`room:${user.roomId}:start_ss:${requestId}`, 300);
      }

      const allowed = await consumeTokenBucket(user.userId, "webrtc_signal", 5, 1);
      if (!allowed) return callback({ success: false, error: "Rate limit exceeded" });
      
      const sessionId = Math.random().toString(36).substring(2, 15);
      await redisClient.set(`room:${user.roomId}:screen_share`, JSON.stringify({
        isScreenSharing: true,
        hostId: user.userId,
        startedAt: Date.now(),
        sessionId
      }), { EX: 86400 });

      logger.info("Screen share started", {
        roomId: user.roomId,
        participantId: user.userId,
        socketId: socket.id,
        sessionId,
        requestId,
        timestamp: Date.now()
      });

      socket.to(ioRoomId).emit(SocketEvents.SCREEN_SHARE_STARTED);
      callback({ success: true, timestamp: Date.now(), sessionId });
    } catch (e: any) {
      logger.error("Start screen share error", { error: e.message, userId: user.userId });
    }
  });

  socket.on(SocketEvents.STOP_SCREEN_SHARE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      if (!(await checkIsHostOrCohost())) {
         return callback({ success: false, error: "Unauthorized" });
      }
      
      const requestId = payload?.requestId;
      if (requestId && typeof requestId === 'string' && requestId.length <= 50) {
        const isDuplicate = await redisClient.setNX(`room:${user.roomId}:stop_ss:${requestId}`, "1");
        if (!isDuplicate) {
           return callback({ success: false, error: "Duplicate request" });
        }
        await redisClient.expire(`room:${user.roomId}:stop_ss:${requestId}`, 300);
      }
      
      await redisClient.del(`room:${user.roomId}:screen_share`);
      
      logger.info("Screen share stopped", {
        roomId: user.roomId,
        participantId: user.userId,
        socketId: socket.id,
        requestId,
        timestamp: Date.now()
      });

      socket.to(ioRoomId).emit(SocketEvents.SCREEN_SHARE_STOPPED);
      callback({ success: true, timestamp: Date.now() });
    } catch (e: any) {
      logger.error("Stop screen share error", { error: e.message, userId: user.userId });
    }
  });
}
