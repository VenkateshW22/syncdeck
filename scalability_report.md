# Scalability Audit Report

## 1. Expected Behavior by User Count

### 10 Users
- **WebSockets / DB**: Minimal load. DB queries on join are imperceptible.
- **Canvas**: Smooth drawing. Redis handles the history seamlessly.
- **WebRTC**: Host streams to 9 viewers (~9-15 Mbps upstream). CPU overhead is manageable.
- **Chat / Polls**: Real-time broadcasts are instant.

### 50 Users
- **WebSockets / DB**: Noticeable CPU spike if all 50 users join simultaneously (thundering herd).
- **Canvas**: Hydration payload begins to grow large (up to 3000 strokes). Users might experience a slight delay when joining.
- **WebRTC**: The host's CPU and bandwidth are severely strained. The host must upload ~50-100 Mbps. Laptops will fan heavily and may throttle.
- **Chat / Polls**: Chat is fine. If all 50 vote simultaneously, 2,500 socket messages are generated. Manageable but inefficient.

### 100 Users
- **WebSockets / DB**: Simultaneous joins will bottleneck the Node.js event loop due to parsing/stringifying massive Canvas JSON arrays (up to 300K numbers).
- **Canvas**: Rendering 100 users' simultaneous drawings will cause local React/Konva frame drops on client devices.
- **WebRTC**: Breaks entirely for half the room. The hardcoded limit of 50 `RTCPeerConnection`s means users 51-100 will simply be rejected and see no screen share.
- **Chat / Polls**: The `O(N^2)` fan-out on poll voting (100 votes * 100 users = 10,000 messages) will cause noticeable UI lag.

### 200 - 500 Users
- **WebSockets / DB**: Node.js process risks OOM (Out Of Memory) crashes if users join concurrently, as `HYDRATE_STATE` buffers multiple massive JSON payloads in memory.
- **WebRTC**: Completely unscalable. Only 50 viewers get the stream.
- **Resource Distribution**: If the host shares a 5MB PDF and 500 users download it simultaneously, the server must push 2.5GB instantly, saturating the network interface and crashing standard Cloud Run/Node instances.

### 1000 Users
- **Total Failure**: The current architecture will collapse. DB connection pools will exhaust on join. Redis CPU will max out from `lRange` and rate limit checks. WebSockets will drop connections due to event loop starvation. 

---

## 2. Resource Estimates (per 1000 users)

- **CPU**: Host browser will reach 100% CPU attempting mesh encoding (failing). Node server will exceed 100% CPU purely parsing/stringifying JSON payloads for Canvas and Rate Limits.
- **Memory**: Node server will buffer ~600MB to 1GB+ of JSON payload data during a simultaneous 1000-user hydration surge, risking V8 heap limit OOM.
- **Redis Operations**: ~3,000 to 5,000 ops/second during active drawing and chatting due to Token Bucket rate limiting and continuous `rPush` / `lTrim`. 
- **Database Queries**: 2,000+ synchronous SQL queries during a simultaneous join (participant lookup + room lookup), overwhelming PostgreSQL connection pools.
- **Socket Traffic**: Poll vote avalanche (1M messages) + active drawing + chat will generate gigabytes of outbound socket traffic per minute.
- **Hydration Cost**: Assuming maximum canvas history (3000 elements), the hydration payload is ~5MB per user. 1000 joins = 5GB of JSON transferred over WebSockets.

---

## 3. Performance Bottlenecks Identified

### N² Algorithms & Fan-out
- **Poll Voting**: Every individual vote triggers a broadcast to the entire room. 1000 users voting = 1,000,000 socket emissions.
- **WebRTC Mesh**: `O(N)` connections for the host. 1000 users = 1000 simultaneous video encoders running on the host's browser (impossible).

### Expensive Loops & Renders
- **Canvas Hydration**: `HYDRATE_STATE` pulls up to 3000 elements, each with up to 500 points. The server parses this, stringifies it into a Socket payload, and the client parses it again. This blocks the main thread on both Node.js and the Browser.
- **Konva Rendering**: Rendering 1.5 million points without caching/flattening will lock up the client's GPU/CPU.

### Repeated Queries
- **Socket Connections**: `participantRepo.findById` and `roomRepo.findById` are queried on *every single connection/reconnection* without any caching layer.
- **Rate Limits**: `consumeTokenBucket` requires multiple Redis round-trips per check. Checked on every single drawing stroke and chat message, causing massive Redis I/O.

### Large Payloads
- **HYDRATE_STATE**: Bundling `chatMessages`, `canvasLines`, `activePoll`, and `screenShare` into one monolithic WebSocket event is an anti-pattern. WebSockets struggle with multi-megabyte frames.

---

## 4. Optimization Roadmap & Prioritized Improvements

### Priority 1: WebRTC Topography (Immediate Blocker > 50 Users)
- **Fix**: Migrate from a Mesh topology to an SFU (Selective Forwarding Unit) like LiveKit or Mediasoup. The host should upload exactly **one** stream to the server, and the server distributes it to the 1000 viewers.

### Priority 2: Canvas Snapshotting & Hydration (Event Loop Blocker)
- **Fix**: Move `canvasLines` out of the WebSocket `HYDRATE_STATE` payload. Clients should fetch the canvas history via a standard HTTP GET request with streaming JSON.
- **Fix**: Implement a snapshotting worker. Once `canvasLines` reaches 500 strokes, a background task should flatten them into a single rasterized image (or compressed buffer) and clear the history array.

### Priority 3: Connection Caching (Thundering Herd)
- **Fix**: Cache Room status (`status !== "ARCHIVED"`) and Participant authorization in Redis with a TTL of 5 minutes. Fallback to PostgreSQL only on cache miss.

### Priority 4: Event Batching (O(N²) Mitigation)
- **Fix**: Debounce Poll updates and Canvas drawing broadcasts. Instead of broadcasting every vote instantly, aggregate votes in Redis and broadcast a single `POLL_UPDATED` event every 1000ms.

### Priority 5: Rate Limiting Optimization
- **Fix**: Implement an in-memory LRU cache (e.g., `lru-cache`) inside the Node process for rate limiting. Only sync to Redis asynchronously, reducing Redis load by 90% during heavy drawing/chatting.

---

## 5. Load Test Scenarios

To validate breaking points before production deployment, execute the following scenarios using tools like Artillery or K6:

1. **Thundering Herd**: 500 users connecting and authenticating within a 5-second window.
   - *Expected Failure*: DB connection pool exhaustion.
2. **Canvas Flood**: 100 users continuously drawing for 60 seconds (hitting the 3000 stroke cap), followed by 50 new users joining.
   - *Expected Failure*: Node.js Event loop lag > 1000ms on new joins.
3. **Poll Avalanche**: 1000 users submitting a poll vote within 2 seconds.
   - *Expected Failure*: WebSocket dropping packets due to massive broadcast fan-out.
4. **Mesh Limit Test**: 60 simulated browsers requesting screen share simultaneously.
   - *Expected Failure*: Users 51-60 rejected; Host CPU spikes to 100%.
