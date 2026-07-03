import { eq, and } from "drizzle-orm";
import { db } from "../../src/db";
import { participants } from "../../src/db/schema";
import { ParticipantStatusType } from "../../src/types";
import { redisClient } from "../utils/redis";

export class ParticipantRepository {
  async create(participant: typeof participants.$inferInsert, tx: any = db) {
    const [created] = await tx
      .insert(participants)
      .values(participant)
      .returning();
    if (created && created.id) {
       const { ipHash, ...safe } = created;
       await redisClient.setEx(`db:participant:${created.id}`, 300, JSON.stringify(safe));
    }
    return created;
  }

  async findById(id: string, tx: any = db) {
    const cached = await redisClient.get(`db:participant:${id}`);
    if (cached) return JSON.parse(cached);
    const [participant] = await tx
      .select()
      .from(participants)
      .where(eq(participants.id, id));
    if (participant) {
       const { ipHash, ...safe } = participant;
       await redisClient.setEx(`db:participant:${id}`, 300, JSON.stringify(safe));
    }
    return participant;
  }

  async findByRoomId(roomId: string, tx: any = db) {
    return tx
      .select()
      .from(participants)
      .where(eq(participants.roomId, roomId));
  }

  async updateStatus(id: string, status: ParticipantStatusType, tx: any = db) {
    const payload =
      status === "OFFLINE" ? { status, leftAt: new Date() } : { status };
    const [updated] = await tx
      .update(participants)
      .set(payload)
      .where(eq(participants.id, id))
      .returning();
    if (updated) {
       const { ipHash, ...safe } = updated;
       await redisClient.setEx(`db:participant:${id}`, 300, JSON.stringify(safe));
    }
    return updated;
  }

  async approveAllWaiting(roomId: string, tx: any = db) {
    const updatedList = await tx
      .update(participants)
      .set({ status: "ONLINE" })
      .where(
        and(
          eq(participants.roomId, roomId),
          eq(participants.status, "WAITING")
        )
      )
      .returning();
    
    // Invalidate/update cache for all
    if (updatedList.length > 0) {
        const pipeline = redisClient.multi();
        for (const p of updatedList) {
            const { ipHash, ...safe } = p;
            pipeline.setEx(`db:participant:${p.id}`, 300, JSON.stringify(safe));
        }
        await pipeline.exec();
    }
    return updatedList;
  }
}
