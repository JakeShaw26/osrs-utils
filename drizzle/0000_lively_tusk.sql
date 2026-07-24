CREATE TABLE "daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rsn_normalised" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"overall_xp" bigint,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE UNIQUE INDEX "daily_snapshots_key" ON "daily_snapshots" USING btree ("rsn_normalised","snapshot_date");