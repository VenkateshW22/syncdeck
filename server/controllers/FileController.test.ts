import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock redis
vi.mock("../utils/redis", () => {
  const store: Record<string, string> = {};
  return {
    redisClient: {
      setEx: vi.fn().mockImplementation(async (key, seconds, val) => {
        store[key] = val;
      }),
      get: vi.fn().mockImplementation(async (key) => {
        return store[key] || null;
      }),
    },
  };
});

// Mock environment config
vi.mock("../config/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    APP_ORIGIN: "http://localhost:3000",
  },
}));

// Mock filesystem
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    createWriteStream: vi.fn().mockReturnValue({
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
    }),
    unlinkSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  }),
  unlinkSync: vi.fn(),
}));

import { FileController } from "./FileController";
import { redisClient } from "../utils/redis";

describe("FileController Hardening & Security validations", () => {
  let fileController: FileController;
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fileController = new FileController();
    
    req = {
      body: {},
      params: {},
      user: { roomId: "room-123", userId: "user-abc" },
    };
    
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      sendFile: vi.fn().mockReturnThis(),
    };
  });

  describe("getPresignedUrl", () => {
    it("should reject path-traversal filenames", async () => {
      req.body = { fileName: "../../malicious.txt", mimeType: "text/plain", size: 100 };
      await fileController.getPresignedUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid file name" });
    });

    it("should reject null-byte filenames", async () => {
      req.body = { fileName: "malicious\0.txt", mimeType: "text/plain", size: 100 };
      await fileController.getPresignedUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid file name" });
    });

    it("should reject oversized files (> 50MB)", async () => {
      req.body = { fileName: "big.txt", mimeType: "text/plain", size: 55 * 1024 * 1024 };
      await fileController.getPresignedUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid file size. Max allowed is 50MB" });
    });

    it("should reject unallowed MIME types (executables or html)", async () => {
      req.body = { fileName: "run.exe", mimeType: "application/octet-stream", size: 100 };
      await fileController.getPresignedUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "File type not allowed" });
    });

    it("should accept valid PDF file and save room alignment metadata in Redis", async () => {
      req.body = { fileName: "slides.pdf", mimeType: "application/pdf", size: 5 * 1024 * 1024 };
      await fileController.getPresignedUrl(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        uploadUrl: expect.stringContaining("/api/v1/uploads/"),
        fileId: expect.any(String),
        gcsPath: expect.stringContaining("rooms/room-123/"),
      }));

      // Verify that Redis was populated with roomId checks
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining("file:room:"),
        86400,
        "room-123"
      );
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining("file:name:"),
        86400,
        "slides.pdf"
      );
    });
  });

  describe("uploadFile / downloadFile Room Security", () => {
    const validUuid = "12345678-1234-1234-1234-123456789abc";

    it("should reject upload if fileId is not a valid UUID format", async () => {
      req.params = { fileId: "malformed_uuid" };
      await fileController.uploadFile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid fileId" });
    });

    it("should reject upload if the file belongs to a different room than the user's room", async () => {
      req.params = { fileId: validUuid };
      // Stub Redis to return a different roomId
      vi.mocked(redisClient.get).mockResolvedValueOnce("different-room-id");

      await fileController.uploadFile(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: Room mismatch or invalid upload" });
    });

    it("should reject download if the file belongs to a different room", async () => {
      req.params = { fileId: validUuid };
      vi.mocked(redisClient.get).mockResolvedValueOnce("different-room-id");

      await fileController.downloadFile(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: Room mismatch or file not found" });
    });

    it("should enforce safe download headers to block stored XSS", async () => {
      req.params = { fileId: validUuid };
      vi.mocked(redisClient.get)
        .mockResolvedValueOnce("room-123") // roomId matches
        .mockResolvedValueOnce("safe-slides.pdf"); // filename matches

      await fileController.downloadFile(req, res);

      // Verify safety headers are set
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/octet-stream");
      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining("attachment;")
      );
      expect(res.sendFile).toHaveBeenCalled();
    });
  });
});
