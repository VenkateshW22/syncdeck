import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: varchar("room_code", { length: 10 }).unique().notNull(),
  hostName: varchar("host_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  persistOnClose: boolean("persist_on_close").default(false),
  waitingRoomEnabled: boolean("waiting_room_enabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => {
  return {
    roomCodeIdx: index("room_code_idx").on(table.roomCode),
    statusIdx: index("room_status_idx").on(table.status),
  };
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  ipHash: varchar("ip_hash", { length: 255 }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (table) => {
  return {
    roomIdIdx: index("participant_room_id_idx").on(table.roomId),
    statusIdx: index("participant_status_idx").on(table.status),
  };
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  createdBy: uuid("created_by").references(() => participants.id),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    roomIdIdx: index("resource_room_id_idx").on(table.roomId),
    resourceTypeIdx: index("resource_type_idx").on(table.resourceType),
  };
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => rooms.id),
  action: varchar("action", { length: 255 }).notNull(),
  details: jsonb("details"),
  performedBy: uuid("performed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    roomIdIdx: index("audit_room_id_idx").on(table.roomId),
  };
});

export const roomsRelations = relations(rooms, ({ many }) => ({
  participants: many(participants),
  resources: many(resources),
  auditLogs: many(auditLogs),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  room: one(rooms, {
    fields: [participants.roomId],
    references: [rooms.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  room: one(rooms, {
    fields: [resources.roomId],
    references: [rooms.id],
  }),
  createdByParticipant: one(participants, {
    fields: [resources.createdBy],
    references: [participants.id],
  }),
}));
