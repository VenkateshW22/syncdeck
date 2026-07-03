import { vi, describe, it, expect, beforeEach } from "vitest";

// 1. Setup automatic mocks (these are safely hoisted by Vitest)
vi.mock("../repositories/ParticipantRepository");
vi.mock("../repositories/RoomRepository");
vi.mock("../utils/jwt");
vi.mock("../../server", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// 2. Import mocked modules and the middleware
import { ParticipantRepository } from "../repositories/ParticipantRepository";
import { RoomRepository } from "../repositories/RoomRepository";
import { verifyToken } from "../utils/jwt";
import { requireAuth, requireHost, requireHostOrCohost } from "./auth";

describe("Authentication Middlewares (requireAuth, requireHost, requireHostOrCohost)", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    req = {
      headers: {},
    };
    
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    next = vi.fn();
  });

  describe("requireAuth", () => {
    it("should allow access with a valid token and active room/participant status", async () => {
      req.headers.authorization = "Bearer valid-token-xyz";
      
      const mockPayload = { userId: "user-1", roomId: "room-1", role: "PARTICIPANT" };
      vi.mocked(verifyToken).mockReturnValue(mockPayload as any);
      
      // Mock repository prototype calls
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        status: "ONLINE",
      } as any);
      
      vi.spyOn(RoomRepository.prototype, "findById").mockResolvedValue({
        id: "room-1",
        status: "ACTIVE",
      } as any);

      await requireAuth(req, res, next);

      expect(req.user).toEqual(mockPayload);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 if Authorization header is missing", async () => {
      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if Authorization header is not in Bearer format", async () => {
      req.headers.authorization = "Basic credentials-here";

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if token validation throws an error", async () => {
      req.headers.authorization = "Bearer corrupted-token";
      vi.mocked(verifyToken).mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if participant does not exist", async () => {
      req.headers.authorization = "Bearer valid-token";
      vi.mocked(verifyToken).mockReturnValue({ userId: "user-1", roomId: "room-1" } as any);
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue(null as any);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if participant belongs to a different room", async () => {
      req.headers.authorization = "Bearer valid-token";
      vi.mocked(verifyToken).mockReturnValue({ userId: "user-1", roomId: "room-1" } as any);
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "different-room-id",
        status: "ONLINE",
      } as any);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 if participant status is BANNED", async () => {
      req.headers.authorization = "Bearer valid-token";
      vi.mocked(verifyToken).mockReturnValue({ userId: "user-1", roomId: "room-1" } as any);
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        status: "BANNED",
      } as any);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 if room does not exist", async () => {
      req.headers.authorization = "Bearer valid-token";
      vi.mocked(verifyToken).mockReturnValue({ userId: "user-1", roomId: "room-1" } as any);
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        status: "ONLINE",
      } as any);
      vi.spyOn(RoomRepository.prototype, "findById").mockResolvedValue(null as any);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 if room status is DESTROYED", async () => {
      req.headers.authorization = "Bearer valid-token";
      vi.mocked(verifyToken).mockReturnValue({ userId: "user-1", roomId: "room-1" } as any);
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        status: "ONLINE",
      } as any);
      vi.spyOn(RoomRepository.prototype, "findById").mockResolvedValue({
        id: "room-1",
        status: "DESTROYED",
      } as any);

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });
  });

  describe("requireHost", () => {
    it("should call next if authenticated user has HOST role", async () => {
      req.user = { userId: "user-1", roomId: "room-1", role: "HOST" };
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        role: "HOST",
      } as any);

      await requireHost(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 if authenticated user has PARTICIPANT role", async () => {
      req.user = { userId: "user-1", roomId: "room-1", role: "PARTICIPANT" };
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        role: "PARTICIPANT",
      } as any);

      await requireHost(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: Host only" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if req.user is missing", async () => {
      await requireHost(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });
  });

  describe("requireHostOrCohost", () => {
    it("should call next if authenticated user has HOST role", async () => {
      req.user = { userId: "user-1", roomId: "room-1", role: "HOST" };
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-1",
        roomId: "room-1",
        role: "HOST",
      } as any);

      await requireHostOrCohost(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should call next if authenticated user has COHOST role", async () => {
      req.user = { userId: "user-2", roomId: "room-1", role: "COHOST" };
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-2",
        roomId: "room-1",
        role: "COHOST",
      } as any);

      await requireHostOrCohost(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should return 403 if authenticated user is only a PARTICIPANT", async () => {
      req.user = { userId: "user-3", roomId: "room-1", role: "PARTICIPANT" };
      vi.spyOn(ParticipantRepository.prototype, "findById").mockResolvedValue({
        id: "user-3",
        roomId: "room-1",
        role: "PARTICIPANT",
      } as any);

      await requireHostOrCohost(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: Host or Co-Host only" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
