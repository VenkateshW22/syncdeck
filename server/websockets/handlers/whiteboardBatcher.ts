import { redisClient } from "../../utils/redis";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";

const drawQueues = new Map<string, any[]>();
const drawTimers = new Map<string, NodeJS.Timeout>();

export function queueDrawUpdate(ioRoomId: string, roomId: string, payload: any, roomsNamespace: any) {
    if (!drawQueues.has(ioRoomId)) {
        drawQueues.set(ioRoomId, []);
    }
    
    // Check if we are updating an existing line in the batch
    const queue = drawQueues.get(ioRoomId)!;
    const existingIdx = queue.findIndex(item => item.id === payload.id);
    if (existingIdx >= 0) {
        queue[existingIdx] = payload;
    } else {
        queue.push(payload);
    }

    if (!drawTimers.has(ioRoomId)) {
        const timer = setTimeout(async () => {
            const currentQueue = drawQueues.get(ioRoomId) || [];
            drawQueues.delete(ioRoomId);
            drawTimers.delete(ioRoomId);
            
            if (currentQueue.length === 0) return;

            try {
                // Pipeline Redis writes for all strokes in the batch
                const pipeline = redisClient.multi();
                for (const item of currentQueue) {
                    pipeline.rPush(`room:${roomId}:canvas`, JSON.stringify(item));
                }
                pipeline.lTrim(`room:${roomId}:canvas`, -3000, -1);
                await pipeline.exec();
                
                // Broadcast batch
                roomsNamespace.to(ioRoomId).emit(SocketEvents.DRAW_UPDATE, currentQueue);
            } catch (e) {
                logger.error("Draw batching error", { error: e });
            }
        }, 100);
        drawTimers.set(ioRoomId, timer);
    }
}
