import { redisClient } from "../../utils/redis";
import { SocketEvents } from "../../../src/constants/socketEvents";
import { logger } from "../../../server";

// ioRoomId -> { optionIndex -> count }
const pendingVotes = new Map<string, Map<number, number>>();
// ioRoomId -> { userId -> optionIndex }
const pendingRedisVotes = new Map<string, Record<string, number>>();
const pollTimers = new Map<string, NodeJS.Timeout>();

export function queuePollVote(ioRoomId: string, userId: string, optionIndex: number, roomsNamespace: any) {
    if (!pendingVotes.has(ioRoomId)) {
        pendingVotes.set(ioRoomId, new Map());
        pendingRedisVotes.set(ioRoomId, {});
    }
    
    const roomVotes = pendingVotes.get(ioRoomId)!;
    roomVotes.set(optionIndex, (roomVotes.get(optionIndex) || 0) + 1);
    
    const redisVotes = pendingRedisVotes.get(ioRoomId)!;
    redisVotes[userId] = optionIndex;

    if (!pollTimers.has(ioRoomId)) {
        const timer = setTimeout(async () => {
            const currentRoomVotes = pendingVotes.get(ioRoomId)!;
            const currentRedisVotes = pendingRedisVotes.get(ioRoomId)!;
            
            pendingVotes.delete(ioRoomId);
            pendingRedisVotes.delete(ioRoomId);
            pollTimers.delete(ioRoomId);
            
            if (currentRoomVotes.size === 0) return;

            // Lua script to safely update JSON poll object in Redis
            const luaScript = `
                local pollStr = redis.call('GET', KEYS[1])
                if not pollStr then return nil end
                
                local poll = cjson.decode(pollStr)
                if not poll.votes then poll.votes = {} end
                
                local votesList = cjson.decode(ARGV[1])
                for userId, optionIdx in pairs(votesList) do
                    poll.votes[userId] = optionIdx
                end
                
                redis.call('SET', KEYS[1], cjson.encode(poll))
                return pollStr
            `;
            
            try {
                // Determine the room ID
                const redisKey = `${ioRoomId}:active_poll`; // ioRoomId is 'room:123'
                
                await redisClient.eval(luaScript, {
                    keys: [redisKey],
                    arguments: [JSON.stringify(currentRedisVotes)]
                });
                
                // Aggregate socket broadcasts
                for (const [optIdx, count] of currentRoomVotes.entries()) {
                    roomsNamespace
                        .to(ioRoomId)
                        .emit(SocketEvents.POLL_VOTE_RECEIVED, { optionIndex: optIdx, count });
                }
            } catch (e) {
                logger.error("Poll batching error", { error: e });
            }
        }, 250);
        pollTimers.set(ioRoomId, timer);
    }
}
