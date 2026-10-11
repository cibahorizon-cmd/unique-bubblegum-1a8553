import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  company: text("company").notNull().default(""),
  companyAbout: text("company_about").notNull().default(""),
  cv: text("cv").notNull().default(""),
  cvKey: text("cv_key").notNull().default(""),
  cvName: text("cv_name").notNull().default(""),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => profiles.id),
  title: text("title").notNull(),
  company: text("company").notNull(),
  city: text("city").notNull(),
  contract: text("contract").notNull(),
  description: text("description").notNull(),
  salary: text("salary").notNull().default(""),
  remote: boolean("remote").notNull().default(false),
  status: text("status").notNull().default("pending"),
  validationOnly: boolean("validation_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("jobs_public_index").on(table.status, table.expiresAt),
  index("jobs_owner_index").on(table.ownerId),
]);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  candidateId: text("candidate_id").notNull().references(() => profiles.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  cv: text("cv").notNull(),
  cvKey: text("cv_key").notNull().default(""),
  cvName: text("cv_name").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("Reçue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("applications_candidate_job_unique").on(table.candidateId, table.jobId),
  index("applications_job_index").on(table.jobId),
]);

export const settings = pgTable("site_settings", {
  id: text("id").primaryKey(),
  operatorName: text("operator_name").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  legal: text("legal").notNull().default(""),
  privacy: text("privacy").notNull().default(""),
  terms: text("terms").notNull().default(""),
  launchEnabled: boolean("launch_enabled").notNull().default(false),
  documentsApproved: boolean("documents_approved").notNull().default(false),
  validationEnabled: boolean("validation_enabled").notNull().default(false),
  validationEmails: text("validation_emails").notNull().default(""),
});
