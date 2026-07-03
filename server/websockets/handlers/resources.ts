import { Socket } from "socket.io";
import { ResourceType } from "../../../src/types";
import { ResourceService } from "../../services/ResourceService";
import sanitizeHtml from "sanitize-html";
import { logAuditEvent } from "../../utils/auditLogger";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { checkReplay, consumeTokenBucket, redisClient } from "../../utils/redis";
import { logger } from "../../../server";

function sanitizeMetadata(type: string, metadata: any): any {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  const clean: any = {};
  if (type === "CODE_SNIPPET") {
    clean.language = typeof metadata.language === "string" ? metadata.language.substring(0, 50) : "javascript";
    clean.content = typeof metadata.content === "string" ? sanitizeHtml(metadata.content) : "";
  } else if (type === "ANNOUNCEMENT") {
    clean.message = typeof metadata.message === "string" ? sanitizeHtml(metadata.message) : "";
  } else if (type === "URL_RESOURCE") {
    if (typeof metadata.url === "string") {
      let urlStr = metadata.url.trim();
      if (/^javascript:/i.test(urlStr)) {
        clean.url = "";
      } else {
        if (!/^(https?:\/\/|\/)/i.test(urlStr)) {
          urlStr = `https://${urlStr}`;
        }
        if (urlStr.length < 2048) {
          clean.url = urlStr;
        } else {
          clean.url = "";
        }
      }
    } else {
      clean.url = "";
    }
  } else if (type === "FILE_RESOURCE") {
    if (typeof metadata.fileUrl === "string") {
      const urlStr = metadata.fileUrl.trim();
      if (/^\/api\/v1\/uploads\/download\/[a-f0-9-]{36}$/i.test(urlStr)) {
        clean.fileUrl = urlStr;
      }
    }
    clean.fileName = typeof metadata.fileName === "string" ? sanitizeHtml(metadata.fileName).substring(0, 255) : "file";
  }
  return clean;
}

export function registerResourceHandlers(
  io: any,
  socket: Socket,
  roomsNamespace: any,
  ioRoomId: string,
  user: any,
  resourceService: ResourceService,
  checkIsHostOrCohost: () => Promise<boolean>
) {
  socket.on(SocketEvents.ADD_RESOURCE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      
      const allowed = await consumeTokenBucket(user.userId, "resource", 10, 10);
      if (!allowed) {
        logger.warn("Rate limit exceeded for add resource", { userId: user.userId, roomId: user.roomId });
        return callback({ success: false, error: "Rate limit exceeded" });
      }

      if (!(await checkIsHostOrCohost())) {
        return callback({ success: false, error: "Unauthorized: Host or Co-Host only" });
      }
      
      if (
        !payload ||
        !payload.type ||
        !Object.values(ResourceType).includes(payload.type)
      ) {
        return callback({ success: false, error: "Invalid resource type" });
      }
      
      if (payload.title && payload.title.length > 100)
        return callback({ success: false, error: "Title too long" });
        
      if (payload.metadata?.message && payload.metadata.message.length > 5000)
        return callback({ success: false, error: "Message too long" });
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      if (payload.title) payload.title = sanitizeHtml(payload.title);
      payload.metadata = sanitizeMetadata(payload.type, payload.metadata);

      const resource = await resourceService.addResource(
        user.roomId,
        user.userId,
        payload,
      );
      roomsNamespace.to(ioRoomId).emit(SocketEvents.RESOURCE_ADDED, resource);
      await logAuditEvent(io, user.roomId, "RESOURCE_UPLOADED", user.userId, { resourceType: payload.type, title: payload.title });
      callback({ success: true, resource });
    } catch (err: any) {
      logger.error("Add resource error", { error: err.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: err.message });
    }
  });

  socket.on(SocketEvents.EDIT_RESOURCE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      const allowed = await consumeTokenBucket(user.userId, "resource", 10, 10);
      if (!allowed) {
        return callback({ success: false, error: "Rate limit exceeded" });
      }

      if (!(await checkIsHostOrCohost())) {
        return callback({ success: false, error: "Unauthorized: Host or Co-Host only" });
      }
      
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return callback({ success: false, error: "Invalid resource ID" });
      }
      
      if (payload.title && payload.title.length > 100)
        return callback({ success: false, error: "Title too long" });
        
      if (payload.metadata?.message && payload.metadata.message.length > 5000)
        return callback({ success: false, error: "Message too long" });
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const resourceStr = await redisClient.hGet(`room:${user.roomId}:resources`, payload.id);
      if (!resourceStr) {
        return callback({ success: false, error: "Resource not found" });
      }
      const existing = JSON.parse(resourceStr);

      const { id, ...updateData } = payload;
      if (updateData.title) updateData.title = sanitizeHtml(updateData.title);
      if (updateData.metadata) {
        updateData.metadata = sanitizeMetadata(existing.type, updateData.metadata);
      }

      const resource = await resourceService.updateResource(user.roomId, id, updateData);
      roomsNamespace.to(ioRoomId).emit(SocketEvents.RESOURCE_UPDATED, resource);
      callback({ success: true, resource });
    } catch (err: any) {
      logger.error("Edit resource error", { error: err.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: err.message });
    }
  });

  socket.on(SocketEvents.REMOVE_RESOURCE, async (payload, callback) => {
    try {
      if (typeof callback !== "function") callback = () => {};
      const allowed = await consumeTokenBucket(user.userId, "resource", 10, 10);
      if (!allowed) {
        return callback({ success: false, error: "Rate limit exceeded" });
      }

      if (!(await checkIsHostOrCohost())) {
        return callback({ success: false, error: "Unauthorized: Host or Co-Host only" });
      }
      
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return callback({ success: false, error: "Invalid resource ID" });
      }
      
      if (payload.requestId) {
        const isReplay = await checkReplay(String(payload.requestId));
        if (isReplay) return callback({ success: false, error: "Duplicate request" });
      }
      
      const { id } = payload;
      await resourceService.removeResource(user.roomId, id);
      roomsNamespace.to(ioRoomId).emit(SocketEvents.RESOURCE_REMOVED, { id });
      await logAuditEvent(io, user.roomId, "RESOURCE_REMOVED", user.userId, { resourceId: id });
      callback({ success: true });
    } catch (err: any) {
      logger.error("Remove resource error", { error: err.message, userId: user.userId });
      if (typeof callback === "function") callback({ success: false, error: err.message });
    }
  });
}
