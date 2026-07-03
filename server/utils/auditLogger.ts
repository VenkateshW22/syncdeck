import { db } from "../../src/db";
import { auditLogs } from "../../src/db/schema";

export async function logAuditEvent(io: any, roomId: string, action: string, performedBy?: string, details?: any, tx: any = db) {
  try {
    const [log] = await tx.insert(auditLogs).values({
      roomId,
      action,
      performedBy,
      details: details || {},
    }).returning();
    
    if (io) {
        // Run emit on next tick to give transaction a chance to commit
        process.nextTick(() => {
            io.of("/ws/rooms").to(`room:${roomId}`).emit("NEW_AUDIT_LOG", log);
        });
    }
  } catch (err) {
      console.error("Failed to log audit event:", err);
      // In a real robust system, push to a DLQ/Redis queue here for guaranteed delivery
      throw err; // Propagate error so transaction rolls back if audit fails
  }
}
