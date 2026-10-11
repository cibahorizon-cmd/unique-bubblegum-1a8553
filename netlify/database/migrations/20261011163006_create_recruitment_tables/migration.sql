CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"candidate_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"cv" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Reçue' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"city" text NOT NULL,
	"contract" text NOT NULL,
	"description" text NOT NULL,
	"salary" text DEFAULT '' NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"company_about" text DEFAULT '' NOT NULL,
	"cv" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY,
	"operator_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"legal" text DEFAULT '' NOT NULL,
	"privacy" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "applications_candidate_job_unique" ON "applications" ("candidate_id","job_id");--> statement-breakpoint
CREATE INDEX "applications_job_index" ON "applications" ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_public_index" ON "jobs" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "jobs_owner_index" ON "jobs" ("owner_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_profiles_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id");