import jwt from "jsonwebtoken";
import { env } from "../config/env";

// validateEnv() (called at server startup) guarantees these are set to
// real, sufficiently long secrets in production. The fallbacks here only
// ever apply in local development.
const JWT_SECRET = env.JWT_SECRET;
const REFRESH_SECRET = env.REFRESH_SECRET;

// Pin the algorithm explicitly to prevent "alg: none" and RS256 confusion attacks.
const JWT_SIGN_OPTIONS: jwt.SignOptions = { algorithm: "HS256" };
const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = { algorithms: ["HS256"] };

export interface JwtPayload {
  userId: string;
  roomId: string;
  role: "HOST" | "PARTICIPANT";
  displayName?: string;
}

export function generateToken(
  payload: JwtPayload,
  expiresIn: string | number = "15m",
) {
  return jwt.sign(payload, JWT_SECRET, { ...JWT_SIGN_OPTIONS, expiresIn: expiresIn as any });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { ...JWT_SIGN_OPTIONS, expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET, JWT_VERIFY_OPTIONS) as JwtPayload;
}
