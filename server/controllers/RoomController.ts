import { Request, Response } from "express";
import { ZodError } from "zod";
import { RoomService } from "../services/RoomService";
import {
  CreateRoomDTOSchema,
  JoinRoomDTOSchema,
  ParticipantStatus,
  ParticipantRole,
} from "../../src/types";
import { generateToken } from "../utils/jwt";
import { ResourceService } from "../services/ResourceService";
import { ParticipantRepository } from "../repositories/ParticipantRepository";
import { AuditLogRepository } from "../repositories/AuditLogRepository";
import { RoomRepository } from "../repositories/RoomRepository";
import { logAuditEvent } from "../utils/auditLogger";
import sanitizeHtml from "sanitize-html";
import { db } from "../../src/db";
import { participants, rooms } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { validateDisplayName, validateRoomCode } from "../../src/utils/validation";
import { logger } from "../../server";

const roomService = new RoomService();
const resourceService = new ResourceService();
const participantRepo = new ParticipantRepository();
const auditLogRepo = new AuditLogRepository();
const roomRepo = new RoomRepository();

function getSafeErrorMessage(err: any, defaultMsg: string): string {
  if (process.env.NODE_ENV === "production") {
    const msg = err.message || "";
    if (
      msg.includes("database") ||
      msg.includes("relation") ||
      msg.includes("query") ||
      msg.includes("select") ||
      msg.includes("insert") ||
      msg.includes("update") ||
      msg.includes("delete") ||
      msg.includes("connection") ||
      msg.includes("pool") ||
      msg.includes("foreign key") ||
      msg.includes("unique constraint") ||
      msg.includes("drizzle")
    ) {
      return defaultMsg;
    }
  }
  return err.message || defaultMsg;
}

export class RoomController {
  private async isHostOrCohost(userId: string, roomId: string, userRole: string): Promise<boolean> {
    if (userRole === "HOST") return true;
    const p = await participantRepo.findById(userId);
    return p ? (p.roomId === roomId && p.role === "COHOST") : false;
  }

  async getResources(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const roomId = req.user.roomId;
      
      const room = await roomRepo.findById(roomId);
      if (!room || room.status === "DESTROYED") {
        res.status(404).json({ error: "Room not found or session expired" });
        return;
      }

      // H1 FIX: Verify the requesting participant belongs to this room in the DB,
      // not just trusting the roomId in the JWT (belt-and-suspenders ownership check).
      const participant = await participantRepo.findById(req.user.userId);
      if (!participant || participant.status === "REJECTED" || participant.status === "BANNED") {
        res.status(401).json({ error: "Unauthorized: Invalid participant status" });
        return;
      }
      if (participant.roomId !== roomId) {
        res.status(403).json({ error: "Forbidden: Room mismatch" });
        return;
      }

      const resources = await resourceService.getRoomResources(roomId);
      res.status(200).json(resources);
    } catch (err: any) {
      res
        .status(400)
        .json({ error: getSafeErrorMessage(err, "Failed to fetch resources") });
    }
  }

  async getParticipants(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const roomId = req.user.roomId;

      const room = await roomRepo.findById(roomId);
      if (!room || room.status === "DESTROYED") {
        res.status(404).json({ error: "Room not found or session expired" });
        return;
      }

      // H2 FIX: Verify ownership and strip sensitive internal fields.
      // ipHash, leftAt, and other internal fields must not be sent to participants.
      const participant = await participantRepo.findById(req.user.userId);
      if (!participant || participant.status === "REJECTED" || participant.status === "BANNED") {
        res.status(401).json({ error: "Unauthorized: Invalid participant status" });
        return;
      }
      if (participant.roomId !== roomId) {
        res.status(403).json({ error: "Forbidden: Room mismatch" });
        return;
      }

      const participants = await participantRepo.findByRoomId(roomId);
      const isHostOrCohost = req.user.role === "HOST" || participant.role === "COHOST";

      // Only hosts/cohosts see sensitive fields; participants see a safe subset.
      const safeParticipants = participants.map((p: any) => {
        if (isHostOrCohost) return p;
        // Strip internal fields from participant view
        const { ipHash, leftAt, ...safe } = p;
        return safe;
      });
      res.status(200).json(safeParticipants);
    } catch (err: any) {
      res
        .status(400)
        .json({ error: getSafeErrorMessage(err, "Failed to fetch participants") });
    }
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const isAuthorized = await this.isHostOrCohost(req.user.userId, req.user.roomId, req.user.role);
      if (!isAuthorized) {
        res.status(403).json({ error: "Forbidden: Host or Co-Host only" });
        return;
      }
      const logs = await auditLogRepo.findByRoomId(req.user!.roomId);
      res.status(200).json(logs);
    } catch (err: any) {
      res.status(400).json({ error: getSafeErrorMessage(err, "Failed to fetch audit logs") });
    }
  }

  async closeRoom(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "HOST") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const roomId = req.user.roomId;
      
      const io = req.app.get("io"); // We need to set this in server.ts

      const room = await roomService.closeRoom(roomId, req.user.userId);

      if (io) {
        io.of("/ws/rooms")
          .to(`room:${roomId}`)
          .emit("ROOM_STATE_CHANGED", { status: room.status });
      }

      logger.info("Room Closed", { roomId, hostId: req.user.userId, status: room.status });
      res.status(200).json({ success: true, status: room.status });
    } catch (err: any) {
      logger.error(`closeRoom failed: ${err.message}`, { error: err.message, stack: err.stack });
      res.status(400).json({ error: getSafeErrorMessage(err, "Failed to close room") });
    }
  }

  async updateParticipantStatus(req: Request, res: Response): Promise<void> {
    try {
      const isAuthorized = await this.isHostOrCohost(req.user!.userId, req.user!.roomId, req.user!.role);
      if (!isAuthorized) {
        res.status(403).json({ error: "Forbidden: Host or Co-Host only" });
        return;
      }
      const { participantId } = req.params;
      if (!/^[a-f0-9-]{36}$/.test(participantId)) {
        res.status(400).json({ error: "Invalid participantId format" });
        return;
      }
      const { status } = req.body;

      if (!Object.values(ParticipantStatus).includes(status)) {
        res.status(400).json({ error: "Invalid status value" });
        return;
      }

      console.log(
        `[RoomController] updateParticipantStatus requested by host ${req.user.userId} for participant ${participantId} to status ${status}`,
      );

      const io = req.app.get("io");

      const participant = await participantRepo.findById(participantId);
      if (!participant || participant.roomId !== req.user.roomId) {
        console.error(
          `[RoomController] updateParticipantStatus failed: participant not found`,
        );
        res.status(404).json({ error: "Participant not found" });
        return;
      }

      await db.transaction(async (tx) => {
        await participantRepo.updateStatus(participantId, status, tx);
        await logAuditEvent(io, req.user!.roomId, "PARTICIPANT_STATUS_UPDATED", participantId, { status }, tx);
      });

      try {
        const { invalidateHydrationCache } = await import("../websockets/hydration");
        invalidateHydrationCache(req.user!.roomId);
      } catch (err) {
        console.error("Failed to invalidate hydration cache:", err);
      }

      if (io) {
        // Emit to everyone that participant status changed
        io.of("/ws/rooms")
          .to(`room:${req.user!.roomId}`)
          .emit("PARTICIPANT_UPDATED", {
            participantId,
            status,
          });
      }

      console.log(`[RoomController] updateParticipantStatus successful`);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error(
        `[RoomController] updateParticipantStatus failed: ${err.message}`,
      );
      res
        .status(400)
        .json({ error: getSafeErrorMessage(err, "Failed to update participant") });
    }
  }

  async approveAllParticipants(req: Request, res: Response): Promise<void> {
    try {
      const isAuthorized = await this.isHostOrCohost(req.user!.userId, req.user!.roomId, req.user!.role);
      if (!isAuthorized) {
        res.status(403).json({ error: "Forbidden: Host or Co-Host only" });
        return;
      }

      console.log(
        `[RoomController] approveAllParticipants requested by host/cohost ${req.user!.userId} for room ${req.user!.roomId}`
      );

      const io = req.app.get("io");

      const approvedParticipants = await db.transaction(async (tx) => {
        const approved = await participantRepo.approveAllWaiting(req.user!.roomId, tx);
        if (approved.length > 0) {
          const participantIds = approved.map(p => p.id);
          await logAuditEvent(
            io,
            req.user!.roomId,
            "PARTICIPANT_STATUS_UPDATED_BULK",
            req.user!.userId,
            { status: "ONLINE", participantIds },
            tx
          );
        }
        return approved;
      });

      if (approvedParticipants.length > 0) {
        if (io) {
          const wsNamespace = io.of("/ws/rooms");
          const roomRoom = wsNamespace.to(`room:${req.user!.roomId}`);
          
          approvedParticipants.forEach((p) => {
            roomRoom.emit("PARTICIPANT_UPDATED", {
              participantId: p.id,
              status: "ONLINE",
            });
          });
        }
      }

      console.log(`[RoomController] approveAllParticipants successful: approved ${approvedParticipants.length} participants`);
      res.status(200).json({ success: true, count: approvedParticipants.length });
    } catch (err: any) {
      console.error(
        `[RoomController] approveAllParticipants failed: ${err.message}`
      );
      res
        .status(400)
        .json({ error: getSafeErrorMessage(err, "Failed to approve all participants") });
    }
  }

  async updateParticipantRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== "HOST") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const { participantId } = req.params;
      if (!/^[a-f0-9-]{36}$/.test(participantId)) {
        res.status(400).json({ error: "Invalid participantId format" });
        return;
      }
      const { role } = req.body;

      if (!Object.values(ParticipantRole).includes(role)) {
        res.status(400).json({ error: "Invalid role value" });
        return;
      }

      console.log(
        `[RoomController] updateParticipantRole requested by host ${req.user.userId} for participant ${participantId} to role ${role}`,
      );

      const io = req.app.get("io");

      const participant = await participantRepo.findById(participantId);
      if (!participant || participant.roomId !== req.user.roomId) {
        console.error(
          `[RoomController] updateParticipantRole failed: participant not found`,
        );
        res.status(404).json({ error: "Participant not found" });
        return;
      }

      if (participant.status === "BANNED" || participant.status === "REJECTED") {
        res.status(400).json({ error: "Cannot change role of banned or rejected participant" });
        return;
      }

      await db.transaction(async (tx) => {
        await tx.update(participants).set({ role }).where(eq(participants.id, participantId));
        await logAuditEvent(io, req.user!.roomId, "PARTICIPANT_ROLE_UPDATED", participantId, { role }, tx);
      });

      if (io) {
        io.of("/ws/rooms")
          .to(`room:${req.user!.roomId}`)
          .emit("PARTICIPANT_UPDATED", {
            participantId,
            role,
          });
      }

      console.log(`[RoomController] updateParticipantRole successful`);
      res.status(200).json({ success: true });
    } catch (err: any) {
      console.error(
        `[RoomController] updateParticipantRole failed: ${err.message}`,
      );
      res
        .status(400)
        .json({ error: getSafeErrorMessage(err, "Failed to update participant role") });
    }
  }

  async createRoom(req: Request, res: Response): Promise<void> {
    try {
      const parsed = CreateRoomDTOSchema.parse(req.body);
      if (parsed.hostName) parsed.hostName = sanitizeHtml(parsed.hostName);

      const nameVal = validateDisplayName(parsed.hostName || "", "HOST");
      if (!nameVal.isValid) {
        res.status(400).json({ error: nameVal.error || "Invalid host name" });
        return;
      }
      parsed.hostName = nameVal.cleanName!;

      const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

      const { room, host } = await roomService.createRoom(parsed, idempotencyKey);

      const hostToken = generateToken(
        {
          userId: host.id,
          roomId: room.id,
          role: "HOST",
          displayName: host.displayName,
        },
        "24h",
      );

      // App URL should come from env or default
      const appUrl =
        process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      logger.info("Room Created", { roomId: room.id, roomCode: room.roomCode, hostId: host.id });
      res.status(201).json({
        roomId: room.id,
        roomCode: room.roomCode,
        joinUrl: `${appUrl}/join/${room.roomCode}`,
        hostId: host.id,
        hostToken,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        logger.warn(`createRoom validation failed`, { details: err.issues });
        res.status(400).json({ error: "Invalid request payload", details: err.issues });
        return;
      }
      logger.error(`createRoom failed: ${err.message}`, { error: err.message, stack: err.stack });
      res.status(400).json({ error: getSafeErrorMessage(err, "Failed to create room") });
    }
  }

  async joinRoom(req: Request, res: Response): Promise<void> {
    try {
      const roomCode = req.params.roomCode;

      const codeVal = validateRoomCode(roomCode);
      if (!codeVal.isValid) {
        res.status(400).json({ error: codeVal.error || "Invalid room code" });
        return;
      }
      const validCode = codeVal.cleanName!;

      const parsed = JoinRoomDTOSchema.parse(req.body);
      if (parsed.displayName) parsed.displayName = sanitizeHtml(parsed.displayName);

      const nameVal = validateDisplayName(parsed.displayName || "", "STUDENT");
      if (!nameVal.isValid) {
        res.status(400).json({ error: nameVal.error || "Invalid display name" });
        return;
      }
      parsed.displayName = nameVal.cleanName!;

      const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

      const { room, participant } = await roomService.joinRoom(
        validCode,
        parsed,
        idempotencyKey
      );

      const token = generateToken(
        {
          userId: participant.id,
          roomId: room.id,
          role: "PARTICIPANT",
          displayName: participant.displayName,
        },
        "12h",
      );

      logger.info("Participant Joined via REST", { roomId: room.id, participantId: participant.id, status: participant.status });
      res.status(200).json({
        participantId: participant.id,
        token,
        status: participant.status === "WAITING" ? "PENDING" : "APPROVED",
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        logger.warn(`joinRoom validation failed`, { details: err.issues });
        res.status(400).json({ error: "Invalid request payload", details: err.issues });
        return;
      }
      logger.error(`joinRoom failed: ${err.message}`, { error: err.message, stack: err.stack });
      res.status(400).json({ error: getSafeErrorMessage(err, "Failed to join room") });
    }
  }
}
