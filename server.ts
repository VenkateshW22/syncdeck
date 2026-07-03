// Must be the FIRST import in this file. Importing it runs env validation
// as a side effect (see server/config/env.ts), which must happen before any
// later-imported module (redis, db, jwt) reads process.env and silently
// falls back to an in-memory mock, an embedded DB, or a hardcoded secret.
import { env } from "./server/config/env";

import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import { RoomController } from "./server/controllers/RoomController";
import { FileController } from "./server/controllers/FileController";
import { setupWebSockets } from "./server/websockets/socketHandlers";
import { requireAuth, requireHost, requireHostOrCohost } from "./server/middlewares/auth";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import winston from "winston";
import { LoggingWinston } from "@google-cloud/logging-winston";

import { connectRedis } from "./server/utils/redis";
import { initializeDb } from "./src/db/index";
import compression from "compression";

// Setup Winston logger
const loggingWinston = new LoggingWinston();
export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === "production" ? [loggingWinston] : []),
  ],
});

async function startServer() {
  await connectRedis();
  await initializeDb();
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    maxHttpBufferSize: 1e6, // 1 MB limit to prevent large payload DoS attacks.
    cors: {
      origin: env.IS_PROD_LIKE ? env.APP_ORIGIN : "*",
      methods: ["GET", "POST", "PUT"],
    },
  });
  app.set("io", io);
  app.set("trust proxy", 1); // Trust first reverse proxy (Cloud Run / Load Balancer) for valid req.ip in rate limits
  const PORT = env.PORT;
  const roomController = new RoomController();
  const fileController = new FileController();

  // Middleware
  app.use(compression());
  app.use(helmet({
    // H5 FIX: Enable CSP for ALL environments (production, staging, development).
    // Disabling CSP in non-production environments masks XSS issues during testing.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],   // unsafe-inline needed for Vite HMR in dev
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "stun.l.google.com:*", "stun:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: '10kb' })); // Limit body size to prevent payload too large attacks
  // M1 FIX: extended:false uses the simple querystring library instead of qs,
  // preventing prototype pollution via crafted query strings like ?__proto__[admin]=true
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(cookieParser());

  // Rate Limiting Config
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      logger.warn(`Global Rate limit exceeded for IP: ${req.ip} | Path: ${req.path}`);
      res.status(options.statusCode).send(options.message);
    }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      logger.warn(`API Rate limit exceeded for IP: ${req.ip} | Path: ${req.path}`);
      res.status(options.statusCode).send(options.message);
    }
  });

  const joinLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    max: 50, 
    message: { error: "Too many join attempts, please wait." },
    handler: (req, res, next, options) => {
      logger.warn(`Join Rate limit exceeded for IP: ${req.ip} | Path: ${req.path}`);
      res.status(options.statusCode).send(options.message);
    }
  });

  // Health checks are hit frequently by orchestrators (Kubernetes, Cloud Run,
  // load balancers), often every few seconds — they must not share the
  // strict global rate limiter or the app will appear "down" under normal
  // operation.
  const healthLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120, // generous: supports sub-second probe intervals from multiple LB nodes
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Liveness: is the process up and responding at all.
  app.get("/api/v1/health", healthLimiter, (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Readiness: is the process able to serve real traffic (DB + Redis reachable).
  // Use this for load balancer / orchestrator readiness gates so instances
  // that lost their DB or Redis connection get taken out of rotation.
  app.get("/api/v1/health/ready", healthLimiter, async (req, res) => {
    const checks: Record<string, "ok" | "error"> = { database: "error", redis: "error" };
    try {
      const { pool } = await import("./src/db/index.js" as any);
      await pool.query("SELECT 1");
      checks.database = "ok";
    } catch (e) {
      logger.error("[Readiness] Database check failed", { error: (e as Error).message });
    }
    try {
      const { redisClient } = await import("./server/utils/redis.js" as any);
      if (redisClient.isOpen) checks.redis = "ok";
    } catch (e) {
      logger.error("[Readiness] Redis check failed", { error: (e as Error).message });
    }
    const isReady = Object.values(checks).every((v) => v === "ok");
    res.status(isReady ? 200 : 503).json({ status: isReady ? "ready" : "not_ready", checks });
  });

  app.use("/api/v1/rooms", apiLimiter);
  app.post("/api/v1/rooms", globalLimiter, (req, res) => roomController.createRoom(req, res));
  app.post("/api/v1/rooms/:roomCode/join", joinLimiter, (req, res) => roomController.joinRoom(req, res));

  
  // C1 FIX: Client error logger requires auth to prevent log flooding and injection.
  // Also validates and sanitizes the payload before writing to logs.
  app.post("/api/v1/log", apiLimiter, requireAuth, (req, res) => {
    const { error, stack, context, timestamp } = req.body;
    // Only log string fields; truncate to prevent log flooding.
    const safeError = typeof error === "string" ? error.substring(0, 500) : "unknown";
    const safeContext = typeof context === "string" ? context.substring(0, 200) : "unknown";
    const safeStack = typeof stack === "string" ? stack.substring(0, 2000) : undefined;
    logger.error("[Client App Error]", { context: safeContext, error: safeError, stack: safeStack, timestamp });
    res.status(200).json({ ok: true });
  });

  // Protected Routes
  app.get("/api/v1/rooms/resources", requireAuth, (req, res) => roomController.getResources(req, res));
  app.get("/api/v1/rooms/participants", requireAuth, (req, res) => roomController.getParticipants(req, res));
  app.get("/api/v1/rooms/audit-logs", requireAuth, requireHostOrCohost, (req, res) => roomController.getAuditLogs(req, res));
  app.post("/api/v1/rooms/close", requireAuth, requireHost, (req, res) => roomController.closeRoom(req, res));
  app.put("/api/v1/rooms/participants/approve-all", requireAuth, requireHostOrCohost, (req, res) => roomController.approveAllParticipants(req, res));
  app.put("/api/v1/rooms/participants/:participantId/status", requireAuth, requireHostOrCohost, (req, res) => roomController.updateParticipantStatus(req, res));
  app.put("/api/v1/rooms/participants/:participantId/role", requireAuth, requireHost, (req, res) => roomController.updateParticipantRole(req, res));
  
  // File Routes
  app.post("/api/v1/rooms/files/presigned-url", requireAuth, requireHostOrCohost, (req, res) => fileController.getPresignedUrl(req, res));
  app.put("/api/v1/uploads/:fileId", requireAuth, requireHostOrCohost, (req, res) => fileController.uploadFile(req, res));
  app.get("/api/v1/uploads/download/:fileId", requireAuth, (req, res) => fileController.downloadFile(req, res));

  // WebSocket Server setup
  setupWebSockets(io);

  // Vite middleware for development
  if (!env.IS_PROD_LIKE) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production/staging serving
    const distPath = path.join(process.cwd(), "dist");

    // H4 FIX: Static assets (JS/CSS/images) are content-hash fingerprinted by
    // Vite, so they can be cached indefinitely. But index.html must NEVER be
    // cached — it's the entry point for updates. Separate the two rules.
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }));
    app.use(express.static(distPath, { maxAge: 0, etag: true }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // M5 FIX: Exit after uncaughtException so the process orchestrator (Docker/
  // Kubernetes/PM2) can restart it cleanly. Continuing in an undefined state
  // after an uncaught exception is dangerous and can corrupt in-memory state.
  process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception] — exiting process:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejection — it could be a transient async error.
    // Log it for observability but keep the server alive.
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Express Error Handler]', err);
    res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  });

  const httpServer = server.listen(PORT, "0.0.0.0", () => {
    logger.info(`[Server] SyncDeck Engine running on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      redis: process.env.REDIS_URL ? 'Redis' : 'InMemoryMock (Fallback)',
      socketAdapter: process.env.REDIS_URL ? 'RedisAdapter' : 'MemoryAdapter',
      instanceId: process.env.K_REVISION || 'local',
    });
    console.log(`[Server] SyncDeck Engine running on port ${PORT}`);
  });

  const gracefulShutdown = async () => {
    console.log('Received kill signal, shutting down gracefully');
    httpServer.close(async () => {
      console.log('Closed out remaining connections');
      try {
        // io.close() will disconnect all sockets
        io.close();
        const { redisClient } = await import("./server/utils/redis.js" as any);
        if (redisClient?.isOpen) {
          await redisClient.quit();
        }
        const { pool } = await import("./src/db/index.js" as any);
        if (pool?.end) {
          await pool.end();
        }
      } catch (e) {
        console.error('[Shutdown] Error while closing connections:', e);
      } finally {
        process.exit(0);
      }
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };
  
  // Phase 2: Permanent Chat Archival Worker
  // Periodically saves Redis chat logs into the audit logs to prevent data loss on Redis evictions.
  setInterval(async () => {
      try {
          const { redisClient } = await import("./server/utils/redis.js" as any);
          const { db } = await import("./src/db/index.js" as any);
          const { auditLogs } = await import("./src/db/schema.js" as any);
          
          if (!redisClient.isOpen) return;
          
          const keys = await redisClient.keys('room:*:chat');
          for (const key of keys) {
              const roomId = key.split(':')[1];
              const chats = await redisClient.lRange(key, 0, -1);
              if (chats.length > 0) {
                  await db.insert(auditLogs).values({
                      roomId,
                      action: "CHAT_ARCHIVE",
                      details: JSON.stringify(chats.map((c: string) => JSON.parse(c))),
                      createdAt: new Date(),
                  });
              }
          }
      } catch (e) {
          console.error("Chat Archival Task Error:", e);
      }
  }, 3600000); // 1 hour

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('[Server Start Error]', err);
  // Fail fast: a process that never bound to its port should exit so the
  // orchestrator (Docker/Kubernetes/Cloud Run) restarts it immediately,
  // rather than leaving a zombie process running that never comes healthy.
  process.exit(1);
});
