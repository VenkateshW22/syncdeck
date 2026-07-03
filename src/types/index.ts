import { z } from "zod";

// DTOs for Room (MapStruct equivalent validation & types)
export const CreateRoomDTOSchema = z.object({
  hostName: z
    .string()
    .trim()
    .min(1, "Host name is required")
    .max(50, "Host name cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Invalid characters in host name"),
  persistOnClose: z.boolean().default(false),
  waitingRoomEnabled: z.boolean().default(false),
});
export type CreateRoomDTO = z.infer<typeof CreateRoomDTOSchema>;

export const RoomResponseDTOSchema = z.object({
  roomId: z.string().uuid(),
  roomCode: z.string(),
  joinUrl: z.string(),
  hostToken: z.string(),
});
export type RoomResponseDTO = z.infer<typeof RoomResponseDTOSchema>;

// DTO for Join Room
export const JoinRoomDTOSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Invalid characters in display name"),
});
export type JoinRoomDTO = z.infer<typeof JoinRoomDTOSchema>;

export const JoinRoomResponseDTOSchema = z.object({
  participantId: z.string().uuid(),
  token: z.string(),
  status: z.enum(["APPROVED", "PENDING"]),
});
export type JoinRoomResponseDTO = z.infer<typeof JoinRoomResponseDTOSchema>;

// Domain Constants
export const RoomStatus = {
  CREATED: "CREATED",
  ACTIVE: "ACTIVE",
  CLOSING: "CLOSING",
  ARCHIVED: "ARCHIVED",
  DESTROYED: "DESTROYED",
} as const;
export type RoomStatusType = (typeof RoomStatus)[keyof typeof RoomStatus];

export const ParticipantRole = {
  HOST: "HOST",
  COHOST: "COHOST",
  PARTICIPANT: "PARTICIPANT",
} as const;
export type ParticipantRoleType =
  (typeof ParticipantRole)[keyof typeof ParticipantRole];

export const ParticipantStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  BANNED: "BANNED",
  WAITING: "WAITING",
  REJECTED: "REJECTED",
} as const;
export type ParticipantStatusType =
  (typeof ParticipantStatus)[keyof typeof ParticipantStatus];

export const ResourceType = {
  CODE_SNIPPET: "CODE_SNIPPET",
  URL_RESOURCE: "URL_RESOURCE",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  FILE_RESOURCE: "FILE_RESOURCE",
  IMAGE_RESOURCE: "IMAGE_RESOURCE",
} as const;
export type ResourceTypeType = (typeof ResourceType)[keyof typeof ResourceType];
