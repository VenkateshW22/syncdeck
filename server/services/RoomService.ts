import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { RoomRepository } from "../repositories/RoomRepository";
import { ParticipantRepository } from "../repositories/ParticipantRepository";
import {
  CreateRoomDTO,
  JoinRoomDTO,
  RoomStatus,
  ParticipantRole,
  ParticipantStatus,
} from "../../src/types";
import { ResourceService } from "./ResourceService";
import { db } from "../../src/db";
import * as schema from "../../src/db/schema";
import { redisClient } from "../utils/redis";

export class RoomService {
  private roomRepo = new RoomRepository();
  private participantRepo = new ParticipantRepository();

  private generateRoomCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  }

  async createRoom(data: CreateRoomDTO, idempotencyKey?: string) {
    if (idempotencyKey) {
      const cached = await redisClient.get(`idemp:create:${idempotencyKey}`);
      if (cached) return JSON.parse(cached);
    }

    return await db.transaction(async (tx) => {
      const roomCode = this.generateRoomCode();
      const roomId = uuidv4();
  
      // Create room
      const room = await this.roomRepo.create({
        id: roomId,
        roomCode,
        hostName: data.hostName,
        status: RoomStatus.CREATED,
        persistOnClose: data.persistOnClose,
        waitingRoomEnabled: data.waitingRoomEnabled,
      }, tx);
  
      // Create host participant
      const hostId = uuidv4();
      const host = await this.participantRepo.create({
        id: hostId,
        roomId: room.id,
        displayName: data.hostName,
        role: ParticipantRole.HOST,
        status: ParticipantStatus.ONLINE,
      }, tx);
  
      const result = { room, host };
      if (idempotencyKey) {
        // VULN-040 FIX: Store only safe subset of room and host in Redis cache to prevent ipHash leak.
        const safeResult = {
          room: {
            id: room.id,
            roomCode: room.roomCode,
            status: room.status,
            persistOnClose: room.persistOnClose,
            waitingRoomEnabled: room.waitingRoomEnabled,
          },
          host: {
            id: host.id,
            roomId: host.roomId,
            displayName: host.displayName,
            role: host.role,
            status: host.status,
          }
        };
        // Run Redis cleanup in background or best effort
        redisClient.setEx(`idemp:create:${idempotencyKey}`, 3600, JSON.stringify(safeResult)).catch((e) => {
           console.error("Failed to set idempotency key for createRoom", e);
         });
      }
      return result;
    });
  }

  async joinRoom(roomCode: string, data: JoinRoomDTO, idempotencyKey?: string) {
    if (idempotencyKey) {
      const cached = await redisClient.get(`idemp:join:${idempotencyKey}`);
      if (cached) return JSON.parse(cached);
    }

    return await db.transaction(async (tx) => {
      const room = await this.roomRepo.findByCode(roomCode, tx);
      if (!room) throw new Error("Room not found");
      if (
        room.status === RoomStatus.ARCHIVED ||
        room.status === RoomStatus.DESTROYED
      ) {
        throw new Error("Room is closed");
      }
  
      const participantId = uuidv4();
      const status = room.waitingRoomEnabled
        ? ParticipantStatus.WAITING
        : ParticipantStatus.ONLINE;
  
      const participant = await this.participantRepo.create({
        id: participantId,
        roomId: room.id,
        displayName: data.displayName,
        role: ParticipantRole.PARTICIPANT,
        status: status,
      }, tx);
  
      const result = { room, participant };
      if (idempotencyKey) {
        // VULN-040 FIX: Store only safe subset in Redis cache to prevent ipHash leak.
        const safeResult = {
          room: {
            id: room.id,
            roomCode: room.roomCode,
            status: room.status,
            persistOnClose: room.persistOnClose,
            waitingRoomEnabled: room.waitingRoomEnabled,
          },
          participant: {
            id: participant.id,
            roomId: participant.roomId,
            displayName: participant.displayName,
            role: participant.role,
            status: participant.status,
          }
        };
        redisClient.setEx(`idemp:join:${idempotencyKey}`, 3600, JSON.stringify(safeResult)).catch((e) => {
           console.error("Failed to set idempotency key for joinRoom", e);
         });
      }
      return result;
    });
  }

  async closeRoom(roomId: string, hostId: string) {
    const roomInfo = await this.roomRepo.findById(roomId);
    if (!roomInfo) {
      // If room is already deleted or not found, just return a dummy room to let the client clear session
      return { status: RoomStatus.DESTROYED } as any;
    }

    const resourceService = new ResourceService();

    const room = await db.transaction(async (tx) => {
      if (roomInfo.persistOnClose) {
        const resources = await resourceService.getRoomResources(roomId);
        for (const res of resources) {
          await tx
            .insert(schema.resources)
            .values({
              id: res.id,
              roomId: roomId,
              resourceType: res.type,
              title: res.title,
              description: res.description,
              metadata: res.metadata,
              createdBy: res.createdBy,
              createdAt: new Date(res.createdAt),
            })
            .onConflictDoNothing();
        }
        await this.roomRepo.updateStatus(roomId, RoomStatus.ARCHIVED, tx);
        roomInfo.status = RoomStatus.ARCHIVED;
      } else {
        await this.roomRepo.updateStatus(roomId, RoomStatus.DESTROYED, tx);
        roomInfo.status = RoomStatus.DESTROYED;
      }
      return roomInfo;
    });

    // Redis cleanup with retry mechanism
    const cleanupRedis = async (retries = 3) => {
       for (let i = 0; i < retries; i++) {
         try {
           await redisClient.del(`room:${roomId}:resources`);
           await redisClient.del(`room:${roomId}:resource_order`);
           await redisClient.del(`room:${roomId}:users`);
           return;
         } catch (err) {
           console.error(`Redis cleanup failed on try ${i+1} for room ${roomId}`, err);
           if (i === retries - 1) {
             // In a real system, we'd queue this to a DLQ or scheduled task
             console.error(`FATAL: Redis cleanup failed completely for room ${roomId}`);
           }
           await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
         }
       }
    };
    
    // Fire and forget, don't block response
    cleanupRedis().catch(console.error);

    return room;
  }
}
