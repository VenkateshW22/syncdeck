import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "../utils/jwt";
import { ParticipantRepository } from "../repositories/ParticipantRepository";
import { RoomRepository } from "../repositories/RoomRepository";
import { ResourceService } from "../services/ResourceService";
import { redisClient, consumeTokenBucket, checkReplay } from "../utils/redis";
import { SocketEvents } from "../../src/constants/socketEvents";
import { ParticipantStatus } from "../../src/types";
import { logger } from "../../server";

import { registerChatHandlers } from "./handlers/chat";
import { registerPollHandlers } from "./handlers/poll";
import { registerAttendanceHandlers, handleParticipantJoin, handleParticipantDisconnect } from "./handlers/attendance";
import { registerResourceHandlers } from "./handlers/resources";
import { registerWhiteboardHandlers } from "./handlers/whiteboard";
import { registerScreenShareHandlers } from "./handlers/screenShare";
import { registerReactionHandlers } from "./handlers/reactions";
import { hydrateParticipant } from "./hydration";

  // Local rate limits removed, using Redis instead

export function setupWebSockets(io: SocketIOServer) {
  // Use Redis adapter for horizontal scaling (e.g. multi-container Cloud Run deployment)
  // Only activate if real Redis URL is provided via environment to prevent local dev mock crash
  if (process.env.REDIS_URL) {
    const subClient = redisClient.duplicate();
    subClient.connect().then(() => {
        io.adapter(createAdapter(redisClient, subClient));
    }).catch((err: any) => console.error("Redis PubSub connection failed:", err));
  }

  const roomsNamespace = io.of("/ws/rooms");

  // Middleware for connection rate limiting and authentication
  roomsNamespace.use(async (socket, next) => {
    try {
      const ip = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
      const clientIp = Array.isArray(ip) ? ip[0] : ip;
      
      // Limit connection handshakes from same IP (max 20 burst, 2 per second refill)
      const allowed = await consumeTokenBucket(`ip:${clientIp}:socket_conn`, "socket_conn", 20, 2);
      if (!allowed) {
        logger.warn(`Connection rate limit exceeded for IP: ${clientIp}`);
        return next(new Error("Connection rate limit exceeded"));
      }
    } catch (err) {
      logger.error("Socket connection rate limit check error", { error: (err as Error).message });
    }

    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }
    try {
      const payload = verifyToken(token);
      socket.data.user = payload;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  const participantRepo = new ParticipantRepository();
  const roomRepo = new RoomRepository();
  const resourceService = new ResourceService();

  roomsNamespace.on("connection", async (socket: Socket) => {
    const user = socket.data.user;

    // Rate limiting trackers per socket to prevent DoS
    const rateLimits = {
      messageCount: 0,
      drawCount: 0,
      webrtcCount: 0,
    };
    let totalEvents = 0;
    
    const rateLimitReset = setInterval(() => {
      rateLimits.messageCount = 0;
      rateLimits.drawCount = 0;
      rateLimits.webrtcCount = 0;
      totalEvents = 0;
    }, 1000); // Reset every second
    
    socket.use((packet, next) => {
        totalEvents++;
        if (totalEvents > 100) {
            console.warn(`[Socket] Strict rate limit exceeded, disconnecting socket ${socket.id}`);
            socket.disconnect(true);
            return next(new Error("Rate limit exceeded"));
        }
        next();
    });

    // Join the socket room using the roomId from the token
    const ioRoomId = `room:${user.roomId}`;
    socket.join(ioRoomId);

    logger.info("Socket Connected", { 
      socketId: socket.id, 
      userId: user.userId, 
      role: user.role, 
      roomId: user.roomId 
    });

    // Phase 6: Multiple Tab Support
    const socketSetKey = `room:${user.roomId}:participant:${user.userId}:sockets`;
    await redisClient.sAdd(socketSetKey, socket.id);
    await redisClient.expire(socketSetKey, 86400);

    const activeSocketsCount = await redisClient.sCard(socketSetKey);
    if (activeSocketsCount > 1) {
        logger.info("Multiple sockets detected", { userId: user.userId, roomId: user.roomId, count: activeSocketsCount });
    }

    // Verify participant and room existence in database (survives database wipes/resets)
    let participant = await participantRepo.findById(user.userId);
    
    if (!participant || participant.roomId !== user.roomId) {
      // Phase 5: JWT Recovery
      // If room still exists, recreate participant record
      const roomExists = await roomRepo.findById(user.roomId);
      if (roomExists && roomExists.status !== "ARCHIVED" && roomExists.status !== "DESTROYED") {
        console.warn(`[Socket] Recovering missing participant ${user.userId} for room ${user.roomId}. Resetting role to PARTICIPANT to prevent privilege escalation.`);
        participant = await participantRepo.create({
           id: user.userId,
           roomId: user.roomId,
           displayName: user.displayName,
           // VULN-007 FIX: Do not trust role from JWT, could be forged/banned host.
           role: "PARTICIPANT",
           status: ParticipantStatus.ONLINE,
           ipHash: "",
        });
      } else {
        console.warn(`[Socket] Disconnecting socket ${socket.id}: participant ${user.userId} or room ${user.roomId} mismatch/not found in database.`);
        socket.disconnect(true);
        return;
      }
    }

    // Hydrate state for newly joined users
    try {
      const clientCanvasVersion = socket.handshake.auth.canvasVersion || 0;
      const lastEventSequence = socket.handshake.auth.lastEventSequence || 0;
      await hydrateParticipant(socket, user, clientCanvasVersion, lastEventSequence);
      socket.emit("READY", { timestamp: Date.now() });
    } catch (e) {
      console.error("[Socket] Failed to hydrate state:", e);
    }

    const checkIsHostOrCohost = async (): Promise<boolean> => {
      // VULN-008 FIX: Always query DB for current role, do not short-circuit on JWT role
      // to prevent stale tokens from retaining host/cohost privileges after demotion.
      const currentParticipant = await participantRepo.findById(user.userId);
      return currentParticipant?.role === "HOST" || currentParticipant?.role === "COHOST";
    };

    // Handle participant join logic
    const canJoin = await handleParticipantJoin(io, roomsNamespace, ioRoomId, user, participant, participantRepo);
    if (!canJoin) {
      socket.disconnect(true);
      return;
    }

    // Register all feature handlers
    registerChatHandlers(io, socket, roomsNamespace, ioRoomId, user, rateLimits);
    registerPollHandlers(io, socket, roomsNamespace, ioRoomId, user, checkIsHostOrCohost);
    registerAttendanceHandlers(io, socket, roomsNamespace, ioRoomId, user, participantRepo, checkIsHostOrCohost);
    registerResourceHandlers(io, socket, roomsNamespace, ioRoomId, user, resourceService, checkIsHostOrCohost);
    registerWhiteboardHandlers(socket, roomsNamespace, ioRoomId, user, checkIsHostOrCohost, rateLimits);
    registerScreenShareHandlers(io, socket, ioRoomId, user, checkIsHostOrCohost, rateLimits);
    registerReactionHandlers(socket, roomsNamespace, ioRoomId, user);

    socket.on("disconnect", async (reason) => {
      clearInterval(rateLimitReset);
      logger.info("Socket Disconnected", {
        socketId: socket.id,
        userId: user.userId,
        roomId: user.roomId,
        reason
      });
      await handleParticipantDisconnect(io, roomsNamespace, ioRoomId, user, participantRepo, socket);
    });
  });
}
