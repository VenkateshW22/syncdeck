import { db } from "../../src/db";
import { auditLogs } from "../../src/db/schema";
import { eq, desc } from "drizzle-orm";

export class AuditLogRepository {
  async create(log: typeof auditLogs.$inferInsert, tx: any = db) {
    const [created] = await tx.insert(auditLogs).values(log).returning();
    return created;
  }

  async findByRoomId(roomId: string, tx: any = db) {
    return tx.select().from(auditLogs).where(eq(auditLogs.roomId, roomId)).orderBy(desc(auditLogs.createdAt));
  }
}
