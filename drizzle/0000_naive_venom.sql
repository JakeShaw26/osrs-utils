CREATE TYPE "public"."clan_role" AS ENUM('guest', 'applicant', 'member', 'officer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."declaration_kind" AS ENUM('quest', 'diary', 'combat_achievement');--> statement-breakpoint
CREATE TYPE "public"."link_request_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rsn_normalised" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"overall_xp" bigint,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tile_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"verified_by" uuid,
	"evidence_url" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"auto_verifiable" boolean DEFAULT false NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flipping_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"buy_price" bigint NOT NULL,
	"sell_price" bigint NOT NULL,
	"tax_paid" bigint NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_state" (
	"job" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"last_run_at" timestamp with time zone,
	"last_completed_pass_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "member_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "declaration_kind" NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"notified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"discord_avatar" text,
	"cached_role" "clan_role" DEFAULT 'guest' NOT NULL,
	"roles_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsn_link_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"rsn_normalised" text NOT NULL,
	"rsn_display" text NOT NULL,
	"status" "link_request_status" DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsn_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"rsn_normalised" text NOT NULL,
	"rsn_display" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completions" ADD CONSTRAINT "event_completions_tile_id_event_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."event_tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completions" ADD CONSTRAINT "event_completions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_completions" ADD CONSTRAINT "event_completions_verified_by_members_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tiles" ADD CONSTRAINT "event_tiles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flipping_logs" ADD CONSTRAINT "flipping_logs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_declarations" ADD CONSTRAINT "member_declarations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_inventory_items" ADD CONSTRAINT "member_inventory_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_timers" ADD CONSTRAINT "member_timers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsn_link_requests" ADD CONSTRAINT "rsn_link_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsn_link_requests" ADD CONSTRAINT "rsn_link_requests_resolved_by_members_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsn_links" ADD CONSTRAINT "rsn_links_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsn_links" ADD CONSTRAINT "rsn_links_approved_by_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_snapshots_key" ON "daily_snapshots" USING btree ("rsn_normalised","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "event_completions_key" ON "event_completions" USING btree ("tile_id","member_id");--> statement-breakpoint
CREATE INDEX "flipping_logs_member_idx" ON "flipping_logs" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_declarations_key" ON "member_declarations" USING btree ("member_id","kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "member_inventory_key" ON "member_inventory_items" USING btree ("member_id","item_id");--> statement-breakpoint
CREATE INDEX "member_timers_due_idx" ON "member_timers" USING btree ("due_at","notified");--> statement-breakpoint
CREATE UNIQUE INDEX "members_discord_id_key" ON "members" USING btree ("discord_id");--> statement-breakpoint
CREATE INDEX "rsn_link_requests_status_idx" ON "rsn_link_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rsn_link_requests_rsn_idx" ON "rsn_link_requests" USING btree ("rsn_normalised");--> statement-breakpoint
CREATE UNIQUE INDEX "rsn_links_rsn_key" ON "rsn_links" USING btree ("rsn_normalised");--> statement-breakpoint
CREATE UNIQUE INDEX "rsn_links_one_primary_per_member" ON "rsn_links" USING btree ("member_id") WHERE "rsn_links"."is_primary";--> statement-breakpoint
CREATE INDEX "rsn_links_member_idx" ON "rsn_links" USING btree ("member_id");