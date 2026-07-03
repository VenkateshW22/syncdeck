import { Socket } from "socket.io";
import { redisClient, consumeTokenBucket, checkReplay } from "../../utils/redis";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";

import { queueDrawUpdate } from "./whiteboardBatcher";

export function registerWhiteboardHandlers(
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  checkIsHostOrCohost: () => Promise<boolean>,
  rateLimits: { drawCount: number }
) {
  socket.on(SocketEvents.DRAW, async (payload) => {
    try {
      if (!(await checkIsHostOrCohost())) return;
      
      const allowed = await consumeTokenBucket(user.userId, "draw", 30, 10);
      if (!allowed) return;
      
      // Strict payload validation: validate points are finite numbers
      if (!payload || typeof payload !== 'object') return;
      if (!Array.isArray(payload.points) || typeof payload.color !== 'string' || typeof payload.strokeWidth !== 'number' || typeof payload.id !== 'string') return;
      
      if (payload.points.length > 500) return; // Drop overly large payloads
      for (const point of payload.points) {
          if (typeof point !== 'number' || !Number.isFinite(point)) {
              return; // Drop invalid frame
          }
      }
      
      const cleanTool = (typeof payload.tool === 'string' && ["pen", "eraser"].includes(payload.tool)) ? payload.tool : "pen";
      const cleanColor = /^#[0-9a-fA-F]{3,8}$/.test(payload.color) ? payload.color : "#4f46e5";
      const cleanGCO = ["source-over", "destination-out"].includes(payload.globalCompositeOperation)
        ? payload.globalCompositeOperation
        : "source-over";
      const cleanLineCap = ["round", "butt", "square"].includes(payload.lineCap) ? payload.lineCap : "round";
      const cleanLineJoin = ["round", "bevel", "miter"].includes(payload.lineJoin) ? payload.lineJoin : "round";
 
      // Prevent Spread - explicitly construct payload
      const sanitizedPayload = {
        id: payload.id,
        tool: cleanTool,
        color: cleanColor,
        strokeWidth: Math.min(Math.max(payload.strokeWidth, 1), 50),
        points: payload.points,
        tension: typeof payload.tension === 'number' && Number.isFinite(payload.tension) ? payload.tension : 0.5,
        lineCap: cleanLineCap,
        lineJoin: cleanLineJoin,
        globalCompositeOperation: cleanGCO,
      };
      
      // Broadcast to everyone else in the room
      if (rateLimits.drawCount > 50) return; // Prevent spamming draw events
      rateLimits.drawCount++;
      
      // Enqueue for batching
      queueDrawUpdate(ioRoomId, user.roomId, sanitizedPayload, roomsNamespace);
    } catch (e: any) {
      logger.error("Draw error", { error: e.message, userId: user.userId });
    }
  });

  socket.on(SocketEvents.CLEAR_CANVAS, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      if (!(await checkIsHostOrCohost())) {
         return callback({ success: false, error: "Unauthorized" });
      }
      
      if (payload?.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      await redisClient.del(`room:${user.roomId}:canvas`);
      socket.to(ioRoomId).emit(SocketEvents.CANVAS_CLEARED);
      callback({ success: true, timestamp: Date.now() });
    } catch (e: any) {
      logger.error("Clear canvas error", { error: e.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: "Internal error" });
    }
  });
}
