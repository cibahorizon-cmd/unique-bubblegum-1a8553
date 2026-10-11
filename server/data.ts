import { and, desc, eq, gt, ilike, or } from "drizzle-orm";
import { getUser, type User } from "@netlify/identity";
import { database } from "../db/index.js";
import { applications, jobs, profiles, settings } from "../db/schema.js";
import { defaultSettings } from "./content.js";

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export function passwordField(body: Record<string, unknown>, minimum = 1) {
  const value = body.password;
  if (typeof value !== "string" || value.length < minimum || value.length > 200) {
    throw new RequestError(400, "Mot de passe manquant ou trop court.");
  }
  return value;
}

export function textField(body: Record<string, unknown>, field: string, max: number, min = 0) {
  const value = body[field] ?? "";
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new RequestError(400, `Le champ « ${field} » est manquant ou invalide.`);
  }
  return value.trim();
}

export function uuidField(body: Record<string, unknown>, field: string) {
  const value = textField(body, field, 36, 36);
  if (!uuidPattern.test(value)) {
    throw new RequestError(400, "Identifiant invalide.");
  }
  return value;
}

export function emailField(body: Record<string, unknown>, field: string) {
  const value = textField(body, field, 254, 3).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    throw new RequestError(400, "Adresse e-mail invalide.");
  }
  return value;
}

export function expiryField(body: Record<string, unknown>) {
  const value = textField(body, "expiresAt", 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RequestError(400, "Date de fin invalide.");
  const expiry = new Date(`${value}T23:59:59.999Z`);
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== value || expiry <= new Date() || expiry.getTime() > Date.now() + 366 * 86400000) {
    throw new RequestError(400, "Choisissez une date de fin à venir, dans les douze prochains mois.");
  }
  return expiry;
}

export function isAdmin(user: User) {
  return user.roles?.includes("admin") === true;
}

export async function requireActor() {
  const user = await getUser();
  if (!user) throw new RequestError(401, "Connectez-vous pour continuer.");
  if (!user.confirmedAt) throw new RequestError(403, "Confirmez votre adresse e-mail avant de continuer.");
  const db = database();
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (existing) return { user, profile: existing, admin: isAdmin(user) };
  const metadata = user.userMetadata ?? {};
  await db.insert(profiles).values({
    id: user.id,
    name: String(user.name || "Mon compte").slice(0, 100),
    role: metadata.account_type === "recruteur" ? "recruteur" : "candidat",
  }).onConflictDoNothing();
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  return { user, profile, admin: isAdmin(user) };
}

export async function siteSettings() {
  const [current] = await database().select().from(settings).where(eq(settings.id, "main"));
  return current ?? defaultSettings;
}

export async function publicJobs(values = { query: "", city: "", contract: "" }, limit = 200, ownerId?: string) {
  const literal = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  const conditions = [eq(jobs.status, "published"), gt(jobs.expiresAt, new Date())];
  if (values.query) conditions.push(or(ilike(jobs.title, literal(values.query)), ilike(jobs.company, literal(values.query)), ilike(jobs.description, literal(values.query)))!);
  if (values.city) conditions.push(ilike(jobs.city, literal(values.city)));
  if (values.contract) conditions.push(eq(jobs.contract, values.contract));
  if (ownerId) conditions.push(eq(jobs.ownerId, ownerId));
  return database().select().from(jobs).where(and(...conditions)).orderBy(desc(jobs.publishedAt)).limit(limit);
}

export async function accountData(actor: Awaited<ReturnType<typeof requireActor>>) {
  const db = database();
  const jobList = actor.admin
    ? await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(200)
    : actor.profile.role === "recruteur"
      ? await db.select().from(jobs).where(eq(jobs.ownerId, actor.user.id)).orderBy(desc(jobs.createdAt)).limit(200)
      : [];
  const applicationList = actor.admin ? [] : await db.select({
    id: applications.id,
    jobId: applications.jobId,
    candidateId: applications.candidateId,
    name: applications.name,
    email: applications.email,
    cv: applications.cv,
    message: applications.message,
    status: applications.status,
    createdAt: applications.createdAt,
    jobTitle: jobs.title,
  }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(
    actor.profile.role === "candidat" ? eq(applications.candidateId, actor.user.id) : eq(jobs.ownerId, actor.user.id),
  ).orderBy(desc(applications.createdAt)).limit(200);
  return { jobList, applicationList };
}
