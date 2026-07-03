import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { ParticipantRepository } from "../repositories/ParticipantRepository";
import { RoomRepository } from "../repositories/RoomRepository";
import { logger } from "../../server";

const participantRepo = new ParticipantRepository();
const roomRepo = new RoomRepository();

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // C2 FIX: Accept tokens ONLY from the Authorization header.
  // Accepting tokens via query string (?token=...) causes the secret to
  // appear in server access logs, browser history, and Referer headers.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    
    // Revocation check: verify participant is still valid and not banned/rejected
    const p = await participantRepo.findById(payload.userId);
    if (!p || p.roomId !== payload.roomId || p.status === "BANNED" || p.status === "REJECTED") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Revocation check: verify room is still active
    const room = await roomRepo.findById(payload.roomId);
    if (!room || room.status === "DESTROYED" || room.status === "ARCHIVED") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireHost(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const p = await participantRepo.findById(req.user.userId);
    if (p && p.roomId === req.user.roomId && p.role === "HOST") {
      return next();
    }
  } catch (err) {
    logger.error("[AuthMiddleware] Error checking host status", {
      userId: req.user.userId,
      error: (err as Error).message,
    });
  }
  return res.status(403).json({ error: "Forbidden: Host only" });
}

export async function requireHostOrCohost(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const p = await participantRepo.findById(req.user.userId);
    if (p && p.roomId === req.user.roomId && (p.role === "HOST" || p.role === "COHOST")) {
      return next();
    }
  } catch (err) {
    // M3 FIX: Use structured logger, don't expose internal error details.
    logger.error("[AuthMiddleware] Error checking host or co-host status", {
      userId: req.user.userId,
      error: (err as Error).message,
    });
  }
  return res.status(403).json({ error: "Forbidden: Host or Co-Host only" });
}
