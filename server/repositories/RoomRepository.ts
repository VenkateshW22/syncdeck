import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { rooms } from "../../src/db/schema";
import { RoomStatusType } from "../../src/types";
import { redisClient } from "../utils/redis";

export class RoomRepository {
  async create(room: typeof rooms.$inferInsert, tx: any = db) {
    const [created] = await tx.insert(rooms).values(room).returning();
    if (created && created.id) {
       await redisClient.setEx(`db:room:${created.id}`, 300, JSON.stringify(created));
       await redisClient.setEx(`db:room:code:${created.roomCode}`, 300, JSON.stringify(created));
    }
    return created;
  }

  async findByCode(roomCode: string, tx: any = db) {
    const cached = await redisClient.get(`db:room:code:${roomCode}`);
    if (cached) return JSON.parse(cached);
    const [room] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, roomCode));
    if (room) {
       await redisClient.setEx(`db:room:${room.id}`, 300, JSON.stringify(room));
       await redisClient.setEx(`db:room:code:${room.roomCode}`, 300, JSON.stringify(room));
    }
    return room;
  }

  async findById(id: string, tx: any = db) {
    const cached = await redisClient.get(`db:room:${id}`);
    if (cached) return JSON.parse(cached);
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, id));
    if (room) {
       await redisClient.setEx(`db:room:${room.id}`, 300, JSON.stringify(room));
       await redisClient.setEx(`db:room:code:${room.roomCode}`, 300, JSON.stringify(room));
    }
    return room;
  }

  async updateStatus(id: string, status: RoomStatusType, tx: any = db) {
    const [updated] = await tx
      .update(rooms)
      .set({
        status,
        closedAt:
          status === "ARCHIVED" ||
          status === "DESTROYED" ||
          status === "CLOSING"
            ? new Date()
            : null,
      })
      .where(eq(rooms.id, id))
      .returning();
    if (updated) {
      if (status === "DESTROYED" || status === "ARCHIVED") {
        await redisClient.del(`db:room:${updated.id}`);
        await redisClient.del(`db:room:code:${updated.roomCode}`);
      } else {
        await redisClient.setEx(`db:room:${updated.id}`, 300, JSON.stringify(updated));
        await redisClient.setEx(`db:room:code:${updated.roomCode}`, 300, JSON.stringify(updated));
      }
    }
    return updated;
  }

  async delete(id: string, tx: any = db) {
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, id));
    await tx.delete(rooms).where(eq(rooms.id, id));
    if (room) {
       await redisClient.del(`db:room:${room.id}`);
       await redisClient.del(`db:room:code:${room.roomCode}`);
    }
  }
}
