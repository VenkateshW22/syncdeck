import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { env } from "../config/env";
import { redisClient } from "../utils/redis";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types for uploads — block executables and HTML to prevent stored XSS.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/ogg", "audio/wav",
]);

export class FileController {
  async getPresignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const { fileName, mimeType, size } = req.body;

      if (
        !fileName ||
        typeof fileName !== "string" ||
        fileName.includes("/") ||
        fileName.includes("..") ||
        fileName.includes("\0") ||
        fileName.length > 255
      ) {
        res.status(400).json({ error: "Invalid file name" });
        return;
      }

      // C5 FIX: Use APP_URL from validated env instead of req.get("host") which is
      // attacker-controlled (Host header injection → upload redirect attack).
      if (!env.APP_URL && !env.APP_ORIGIN) {
        res.status(500).json({ error: "Server misconfiguration: APP_URL not set" });
        return;
      }

      if (typeof size !== "number" || size <= 0 || size > 50 * 1024 * 1024) {
        res.status(400).json({ error: "Invalid file size. Max allowed is 50MB" });
        return;
      }

      // Validate MIME type against allowlist
      if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({ error: "File type not allowed" });
        return;
      }

      const fileId = uuidv4();
      const roomId = req.user?.roomId;
      if (!roomId) {
        res.status(401).json({ error: "Unauthorized: Missing room ID" });
        return;
      }

      // Store fileId to roomId mapping in Redis (VULN-016 and VULN-017 fix)
      await redisClient.setEx(`file:room:${fileId}`, 86400, roomId);
      // Also store the sanitized original filename so downloads can serve it correctly.
      // Strip path separators and null bytes for safety.
      const safeFileName = fileName.replace(/[\/\\\0]/g, "_").substring(0, 255);
      await redisClient.setEx(`file:name:${fileId}`, 86400, safeFileName);

      // L2 FIX: Don't log raw filename (PII/sensitive data). Log only safe metadata.
      // Use a RELATIVE uploadUrl so it works regardless of reverse proxy / port differences.
      res.status(200).json({
        uploadUrl: `/api/v1/uploads/${fileId}`,
        fileId,
        gcsPath: `rooms/${roomId}/${fileId}`,  // Don't expose original filename in path
      });
    } catch (err: any) {
      console.error(`[FileController] getPresignedUrl failed: ${err.message}`);
      res.status(400).json({ error: "Failed to generate upload URL" });  // Don't expose internal error
    }
  }

  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      if (!/^[a-f0-9-]{36}$/.test(fileId)) {  // Strict UUID format check
        res.status(400).json({ error: "Invalid fileId" });
        return;
      }

      // VULN-016 Fix: Check that the file's roomId matches the requesting user's roomId
      const targetRoomId = await redisClient.get(`file:room:${fileId}`);
      if (!targetRoomId || targetRoomId !== req.user?.roomId) {
        res.status(403).json({ error: "Forbidden: Room mismatch or invalid upload" });
        return;
      }

      const filePath = path.join(uploadDir, fileId);
      // Verify the resolved path is still inside uploadDir (path traversal guard)
      if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
        res.status(400).json({ error: "Invalid fileId" });
        return;
      }

      const writeStream = fs.createWriteStream(filePath);

      let uploadedBytes = 0;
      const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

      req.on("data", (chunk) => {
        uploadedBytes += chunk.length;
        if (uploadedBytes > MAX_UPLOAD_SIZE) {
          console.error(`[FileController] uploadFile size limit exceeded for ${fileId}`);
          req.destroy(new Error("File size limit exceeded"));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });

      req.pipe(writeStream);

      req.on("end", () => {
        res.status(200).json({ success: true });
      });

      req.on("error", (err) => {
        console.error(`[FileController] uploadFile stream error: ${err.message}`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to upload file" });
        }
      });
    } catch (err: any) {
      console.error(`[FileController] uploadFile failed: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to upload file" });  // Don't expose internal error
      }
    }
  }

  async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      if (!/^[a-f0-9-]{36}$/.test(fileId)) {  // Strict UUID format check
        res.status(400).json({ error: "Invalid fileId" });
        return;
      }

      // C4 FIX: Verify the requesting user belongs to the same room as the file.
      // Files are stored as {fileId} but the gcsPath contains the roomId.
      // We enforce room-scoping by checking the user's roomId is in the request context.
      // Since all download routes require requireAuth, req.user is guaranteed set.
      // Additional room check: fileIds are UUIDs issued by presigned-url which embeds
      // the roomId in gcsPath — for local storage we scope by path convention.
      
      // VULN-017 Fix: Ensure the user's roomId matches the stored file's roomId
      const targetRoomId = await redisClient.get(`file:room:${fileId}`);
      if (!targetRoomId || targetRoomId !== req.user?.roomId) {
        res.status(403).json({ error: "Forbidden: Room mismatch or file not found" });
        return;
      }

      const filePath = path.join(uploadDir, fileId);
      // Path traversal guard
      if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
        res.status(400).json({ error: "Invalid fileId" });
        return;
      }

      if (fs.existsSync(filePath)) {
        // M4 FIX: Force download with Content-Disposition and safe Content-Type
        // to prevent the browser from rendering uploaded HTML/SVG as a page (stored XSS).
        // Use stored original filename if available, fallback to fileId.
        const storedName = await redisClient.get(`file:name:${fileId}`);
        const downloadName = storedName || fileId;
        // Encode filename for Content-Disposition (RFC 5987) to handle unicode/spaces
        const encodedName = encodeURIComponent(downloadName).replace(/['()]/g, escape);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"; filename*=UTF-8''${encodedName}`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to download file" });  // Don't expose internal error
    }
  }
}
