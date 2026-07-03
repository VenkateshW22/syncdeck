import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { resources } from "../../src/db/schema";

export class ResourceRepository {
  async create(resource: typeof resources.$inferInsert, tx: any = db) {
    const [created] = await tx.insert(resources).values(resource).returning();
    return created;
  }

  async findByRoomId(roomId: string, tx: any = db) {
    return tx.select().from(resources).where(eq(resources.roomId, roomId));
  }

  async delete(id: string, tx: any = db) {
    await tx.delete(resources).where(eq(resources.id, id));
  }
}
