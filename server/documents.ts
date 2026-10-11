import { createHash, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { and, eq, or } from "drizzle-orm";
import { database } from "../db/index.js";
import { applications, jobs, profiles } from "../db/schema.js";
import { requireActor, RequestError, uuidPattern } from "./data.js";

export const maximumCvBytes = 3 * 1024 * 1024;

export function documentStore() {
  return getStore({ name: "wutligey-private-cvs", consistency: "strong" });
}

function documentScope() {
  if (process.env.CONTEXT === "production") return "production/";
  const branch = createHash("sha256").update(process.env.NETLIFY_DB_BRANCH ?? process.env.BRANCH ?? "local").digest("hex").slice(0, 24);
  return `preview/${branch}/`;
}

export async function limitedBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum) throw new RequestError(413, "Le contenu envoyé est trop volumineux.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new RequestError(413, "Le contenu envoyé est trop volumineux.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function validatePdf(name: string, bytes: Uint8Array) {
  if (!/\.pdf$/i.test(name) || bytes.byteLength < 12 || bytes.byteLength > maximumCvBytes || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-" || !Buffer.from(bytes.subarray(-4096)).includes(Buffer.from("%%EOF"))) {
    throw new RequestError(400, "Choisissez un CV PDF valide de 3 Mo maximum.");
  }
  return name.replace(/[\x00-\x1f\x7f/\\"<>]/g, "_").slice(-100);
}

export async function removeUnusedDocument(key: string) {
  if (!key || !key.startsWith(documentScope())) return;
  const db = database();
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.cvKey, key)).limit(1);
  const [application] = await db.select({ id: applications.id }).from(applications).where(eq(applications.cvKey, key)).limit(1);
  if (!profile && !application) await documentStore().delete(key);
}

export async function documentDownload(request: Request) {
  const actor = await requireActor();
  const applicationId = new URL(request.url).searchParams.get("application");
  let key = actor.profile.cvKey;
  let name = actor.profile.cvName;
  if (applicationId) {
    if (!uuidPattern.test(applicationId)) throw new RequestError(400, "Identifiant invalide.");
    const [application] = await database().select({ cvKey: applications.cvKey, cvName: applications.cvName }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.id, applicationId), or(eq(applications.candidateId, actor.user.id), eq(jobs.ownerId, actor.user.id))));
    if (!application) throw new RequestError(404, "Document introuvable.");
    key = application.cvKey;
    name = application.cvName;
  } else if (actor.profile.role !== "candidat" || actor.admin) {
    throw new RequestError(403, "Ce document ne vous appartient pas.");
  }
  if (!key) throw new RequestError(404, "Aucun CV PDF enregistré.");
  const bytes = await documentStore().get(key, { type: "arrayBuffer" });
  if (!bytes) throw new RequestError(404, "Document indisponible.");
  return new Response(bytes, { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="cv.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "sandbox",
  } });
}

export async function documentUpload(request: Request) {
  const actor = await requireActor();
  if (actor.profile.role !== "candidat" || actor.admin) throw new RequestError(403, "Un compte candidat est nécessaire.");
  const bytes = await limitedBody(request, maximumCvBytes + 16384);
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    throw new RequestError(400, "Téléversement invalide.");
  }
  const file = form.get("cvFile");
  if (!(file instanceof File) || file.size > maximumCvBytes) throw new RequestError(400, "Choisissez un CV PDF de 3 Mo maximum.");
  const data = await file.arrayBuffer();
  const name = validatePdf(file.name, new Uint8Array(data));
  const key = `${documentScope()}${randomUUID()}`;
  await documentStore().set(key, data);
  let oldKey = "";
  try {
    oldKey = await database().transaction(async (transaction) => {
      const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, actor.user.id)).for("update");
      if (!profile || profile.suspended) throw new RequestError(403, "Ce compte n’est pas disponible.");
      await transaction.update(profiles).set({ cvKey: key, cvName: name }).where(eq(profiles.id, actor.user.id));
      return profile.cvKey;
    });
  } catch (error) {
    await removeUnusedDocument(key);
    throw error;
  }
  try { await removeUnusedDocument(oldKey); } catch { console.error("cv_previous_document_cleanup_failed"); }
}

export async function checkDocumentStorage() {
  const key = `checks/${randomUUID()}`;
  const store = documentStore();
  try {
    await store.set(key, "wutligey-storage-check");
    if (await store.get(key, { type: "text" }) !== "wutligey-storage-check") throw new RequestError(503, "Le stockage des CV ne peut pas être validé.");
  } finally {
    await store.delete(key);
  }
}
