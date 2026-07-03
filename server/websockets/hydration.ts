import { Socket } from "socket.io";
import { redisClient } from "../utils/redis";
import { SocketEvents } from "../../src/constants/socketEvents";
import { logger } from "../../server";

const MAX_CHAT_HISTORY = process.env.MAX_CHAT_HISTORY ? parseInt(process.env.MAX_CHAT_HISTORY) : 100;
const MAX_CANVAS_LAYERS = process.env.MAX_CANVAS_LAYERS ? parseInt(process.env.MAX_CANVAS_LAYERS) : 3000;
const MAX_HYDRATION_SIZE = process.env.MAX_HYDRATION_SIZE ? parseInt(process.env.MAX_HYDRATION_SIZE) : 5 * 1024 * 1024; // 5MB

interface RoomCache {
    chatMessages?: { str: string, obj: any[] };
    canvasLines?: { str: string, obj: any[] };
    handsRaised?: { str: string, obj: any[] };
    activePoll?: { str: string, obj: any };
    screenShare?: { str: string, obj: any };
    timestamp: number;
    canvasVersion: number;
}

const hydrationCache = new Map<string, RoomCache>();

export function invalidateHydrationCache(roomId: string) {
    hydrationCache.delete(roomId);
}

export async function hydrateParticipant(socket: Socket, user: any, clientCanvasVersion: number = 0, lastEventSequence: number = 0) {
    const startTime = Date.now();
    const roomId = user.roomId;
    const ioRoomId = `room:${roomId}`;
    
    if (lastEventSequence === 0 && clientCanvasVersion === 0) {
        logger.info("Refresh Recovery / First Join detected", { userId: user.userId, roomId, event: "Refresh Recovery" });
    } else {
        logger.info("Reconnect / Offline Recovery detected", { userId: user.userId, roomId, clientCanvasVersion, lastEventSequence, event: "Offline Recovery" });
    }

    // Check if we can do delta replay
    const currentSeqStr = await redisClient.get(`${ioRoomId}:seq`);
    const currentSeq = currentSeqStr ? parseInt(currentSeqStr, 10) : 0;
    
    if (lastEventSequence > 0 && lastEventSequence < currentSeq) {
        // Try to fetch missed events
        const missedEvents = await redisClient.zRangeByScore(`${ioRoomId}:events`, lastEventSequence + 1, currentSeq);
        if (missedEvents.length === (currentSeq - lastEventSequence)) {
            logger.info("Performing deterministic replay", { userId: user.userId, roomId, lastEventSequence, currentSeq });
            const events = missedEvents.map(e => JSON.parse(e));
            for (const event of events) {
                socket.emit(event.type, event.payload);
            }
            // Update client sequence
            socket.emit(SocketEvents.HYDRATE_STATE, { version: currentSeq });
            return;
        }
    }
    
    // Fallback to full hydration
    logger.info("Falling back to full hydration", { userId: user.userId, roomId, lastEventSequence, currentSeq });
    
    let cache = hydrationCache.get(roomId);
    if (!cache || Date.now() - cache.timestamp > 1000) {
        // Cache stale, refresh
        cache = { timestamp: Date.now(), canvasVersion: 0 };
        
        const chatMessagesStr = await redisClient.lRange(`${ioRoomId}:chat`, -MAX_CHAT_HISTORY, -1);
        const chatObj = chatMessagesStr.map(m => JSON.parse(m));
        cache.chatMessages = { str: JSON.stringify(chatObj), obj: chatObj };
        
        const canvasLinesStr = await redisClient.lRange(`${ioRoomId}:canvas`, -MAX_CANVAS_LAYERS, -1);
        const canvasObj = canvasLinesStr.map(m => JSON.parse(m));
        cache.canvasLines = { str: JSON.stringify(canvasObj), obj: canvasObj };
        cache.canvasVersion = canvasObj.length;
        
        const handsRaised = await redisClient.sMembers(`${ioRoomId}:hands`);
        cache.handsRaised = { str: JSON.stringify(handsRaised), obj: handsRaised };
        
        const activePollStr = await redisClient.get(`${ioRoomId}:active_poll`);
        if (activePollStr) {
            try {
                const pollObj = JSON.parse(activePollStr);
                cache.activePoll = { str: activePollStr, obj: pollObj };
            } catch(e) {}
        }
        
        const screenShareStr = await redisClient.get(`${ioRoomId}:screen_share`);
        if (screenShareStr) {
            try {
                const ssObj = JSON.parse(screenShareStr);
                cache.screenShare = { str: screenShareStr, obj: ssObj };
            } catch(e) {}
        }
        
        hydrationCache.set(roomId, cache);
    }
    
    // Size check
    let totalSize = 0;
    if (cache.chatMessages) totalSize += cache.chatMessages.str.length;
    if (cache.canvasLines) totalSize += cache.canvasLines.str.length;
    if (cache.handsRaised) totalSize += cache.handsRaised.str.length;
    
    if (totalSize > MAX_HYDRATION_SIZE) {
        logger.warn("Hydration size limit exceeded, truncating canvas", { roomId, totalSize });
        cache.canvasLines = { str: "[]", obj: [] }; // Drop canvas for this hydration if too large
    }

    // Split hydration into feature-specific payloads to avoid blocking event loop
    const version = Date.now();
    
    socket.emit(SocketEvents.HYDRATE_STATE, { version, chatMessages: cache.chatMessages?.obj || [] });
    
    if (cache.canvasLines && cache.canvasLines.obj.length > 0) {
        const serverCanvasVersion = cache.canvasLines.obj.length;
        
        if (clientCanvasVersion === serverCanvasVersion) {
            // Client is fully up-to-date, skip hydration
            logger.info("Hydration skipped for canvas, versions match", { userId: user.userId, roomId, canvasVersion: serverCanvasVersion });
        } else if (clientCanvasVersion > 0 && clientCanvasVersion < serverCanvasVersion) {
            // Delta synchronization
            logger.info("Sending canvas delta", { userId: user.userId, roomId, clientCanvasVersion, serverCanvasVersion });
            const delta = cache.canvasLines.obj.slice(clientCanvasVersion);
            
            const chunks = [];
            const chunkSize = 500;
            for (let i = 0; i < delta.length; i += chunkSize) {
                chunks.push(delta.slice(i, i + chunkSize));
            }
            for (const chunk of chunks) {
                socket.emit(SocketEvents.HYDRATE_STATE, { version, canvasLines: chunk, isDelta: true });
            }
        } else {
            // Full snapshot recovery
            logger.info("Sending full canvas snapshot", { userId: user.userId, roomId, serverCanvasVersion });
            const chunks = [];
            const chunkSize = 500;
            for (let i = 0; i < cache.canvasLines.obj.length; i += chunkSize) {
                chunks.push(cache.canvasLines.obj.slice(i, i + chunkSize));
            }
            for (let i = 0; i < chunks.length; i++) {
                socket.emit(SocketEvents.HYDRATE_STATE, { version, canvasLines: chunks[i], isChunk: i > 0 });
            }
        }
    } else {
        socket.emit(SocketEvents.HYDRATE_STATE, { version, canvasLines: [] });
    }
    
    socket.emit(SocketEvents.HYDRATE_STATE, { version, handsRaised: cache.handsRaised?.obj || [] });
    socket.emit(SocketEvents.HYDRATE_STATE, { version, activePoll: cache.activePoll?.obj || null });
    socket.emit(SocketEvents.HYDRATE_STATE, { version, screenShare: cache.screenShare?.obj || null });

    const duration = Date.now() - startTime;
    logger.info("Hydration completed", { userId: user.userId, roomId, durationMs: duration, payloadBytes: totalSize });
}
