CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"action" varchar(255) NOT NULL,
	"details" jsonb,
	"performed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"display_name" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"ip_hash" varchar(255),
	"joined_at" timestamp with time zone DEFAULT now(),
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid,
	"resource_type" varchar(50) NOT NULL,
	"created_by" uuid,
	"title" varchar(255),
	"description" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(10) NOT NULL,
	"host_name" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"persist_on_close" boolean DEFAULT false,
	"waiting_room_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone,
	CONSTRAINT "rooms_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_participants_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_room_id_idx" ON "audit_logs" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "participant_room_id_idx" ON "participants" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "participant_status_idx" ON "participants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "resource_room_id_idx" ON "resources" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "resource_type_idx" ON "resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "room_code_idx" ON "rooms" USING btree ("room_code");--> statement-breakpoint
CREATE INDEX "room_status_idx" ON "rooms" USING btree ("status");