import { and, eq, gt } from "drizzle-orm";
import { AuthError, MissingIdentityError, login, logout, requestPasswordRecovery, signup, verifyRequestOrigin } from "@netlify/identity";
import { database } from "../db/index.js";
import { applications, jobs, profiles, settings } from "../db/schema.js";
import { contracts, launchReady } from "./content.js";
import { emailField, expiryField, passwordField, requireActor, RequestError, siteSettings, textField, uuidField } from "./data.js";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function api(request: Request, path: string) {
  try {
    const paths = ["/api/logout", "/api/login", "/api/recovery", "/api/signup", "/api/settings", "/api/profile", "/api/jobs", "/api/jobs/status", "/api/applications", "/api/applications/withdraw", "/api/applications/status"];
    if (!paths.includes(path)) return json({ error: "Adresse introuvable." }, 404);
    if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
    try { verifyRequestOrigin(request); } catch { throw new RequestError(403, "Origine de la requête non autorisée."); }
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError(415, "Format de requête invalide.");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65000) throw new RequestError(413, "Le contenu envoyé est trop volumineux.");
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new RequestError(400, "Requête invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError(400, "Requête invalide.");
    if (path === "/api/logout") {
      await logout();
      return json({ message: "Déconnexion effectuée." });
    }
    if (path === "/api/login") {
      const password = passwordField(body);
      await login(emailField(body, "email"), password);
      return json({ message: "Connexion réussie.", redirect: "/compte" });
    }
    if (path === "/api/recovery") {
      const email = emailField(body, "email");
      try { await requestPasswordRecovery(email); } catch (error) {
        if (error instanceof MissingIdentityError) throw error;
      }
      return json({ message: "Si ce compte existe, un lien de récupération a été envoyé. Consultez votre boîte e-mail." });
    }
    const currentSettings = await siteSettings();
    if (path === "/api/signup") {
      if (!launchReady(currentSettings)) throw new RequestError(503, "Les inscriptions ouvrent après finalisation des informations du service.");
      if (body.consent !== "on") throw new RequestError(400, "Acceptez les conditions et prenez connaissance de la confidentialité.");
      const role = textField(body, "role", 12, 1);
      if (!["candidat", "recruteur"].includes(role)) throw new RequestError(400, "Profil invalide.");
      const user = await signup(emailField(body, "email"), passwordField(body, 12), {
        full_name: textField(body, "name", 100, 2),
        account_type: role,
        terms_accepted_at: new Date().toISOString(),
      });
      return json({ message: user.confirmedAt ? "Votre compte est créé." : "Votre compte a été créé. Confirmez votre adresse grâce au lien reçu par e-mail avant de vous connecter.", redirect: user.confirmedAt ? "/compte" : null }, 201);
    }
    const actor = await requireActor();
    const db = database();
    if (path === "/api/settings") {
      if (!actor.admin) throw new RequestError(403, "Accès réservé à l’administration.");
      const values = {
        operatorName: textField(body, "operatorName", 200, 2),
        contactEmail: emailField(body, "contactEmail"),
        legal: textField(body, "legal", 15000, 80),
        privacy: textField(body, "privacy", 15000, 80),
        terms: textField(body, "terms", 15000, 80),
      };
      await db.insert(settings).values({ id: "main", ...values }).onConflictDoUpdate({ target: settings.id, set: values });
      return json({ message: "Informations publiques enregistrées." });
    }
    if (path === "/api/applications/withdraw") {
      const deleted = await db.delete(applications).where(and(eq(applications.id, uuidField(body, "applicationId")), eq(applications.candidateId, actor.user.id))).returning({ id: applications.id });
      if (!deleted.length) throw new RequestError(404, "Candidature introuvable.");
      return json({ message: "La candidature et sa copie de CV ont été supprimées." });
    }
    if (path === "/api/jobs/status") {
      const jobId = uuidField(body, "jobId");
      const status = textField(body, "status", 12, 1);
      if (!actor.admin && status !== "closed") throw new RequestError(403, "Seule l’administration valide la publication.");
      if (!["published", "rejected", "closed"].includes(status)) throw new RequestError(400, "Statut invalide.");
      if (status === "published" && !launchReady(currentSettings)) throw new RequestError(409, "Complétez d’abord les informations du service.");
      const conditions = [eq(jobs.id, jobId)];
      if (!actor.admin) conditions.push(eq(jobs.ownerId, actor.user.id));
      if (status === "published") conditions.push(gt(jobs.expiresAt, new Date()));
      const updated = await db.update(jobs).set({ status, ...(status === "published" ? { publishedAt: new Date() } : {}) }).where(and(...conditions)).returning({ id: jobs.id });
      if (!updated.length) throw new RequestError(404, "Offre introuvable ou expirée.");
      return json({ message: "Statut de l’offre mis à jour." });
    }
    if (!launchReady(currentSettings)) throw new RequestError(503, "Le service prépare son ouverture. Les candidatures et les publications ne sont pas encore ouvertes.");
    if (path === "/api/profile") {
      const name = textField(body, "name", 100, 2);
      const values = actor.profile.role === "candidat" ? { name, cv: textField(body, "cv", 12000) } : {
        name,
        company: textField(body, "company", 150, 2),
        companyAbout: textField(body, "companyAbout", 3000),
      };
      await db.update(profiles).set(values).where(eq(profiles.id, actor.user.id));
      return json({ message: "Informations enregistrées." });
    }
    if (path === "/api/jobs") {
      if (actor.profile.role !== "recruteur") throw new RequestError(403, "Un compte recruteur est nécessaire.");
      if (!actor.profile.company) throw new RequestError(400, "Renseignez votre entreprise dans votre espace recruteur.");
      const contract = textField(body, "contract", 20, 1);
      if (!contracts.includes(contract)) throw new RequestError(400, "Contrat invalide.");
      const salary = textField(body, "salary", 9);
      if (salary && (!/^\d{1,9}$/.test(salary) || Number(salary) < 1)) throw new RequestError(400, "Le salaire doit être un montant mensuel positif en FCFA (XOF).");
      await db.insert(jobs).values({
        ownerId: actor.user.id,
        title: textField(body, "title", 150, 3),
        company: actor.profile.company,
        city: textField(body, "city", 80, 2),
        contract,
        description: textField(body, "description", 12000, 100),
        salary,
        remote: body.remote === "on",
        expiresAt: expiryField(body),
      });
      return json({ message: "Votre offre est enregistrée et attend sa validation." }, 201);
    }
    if (path === "/api/applications") {
      if (actor.profile.role !== "candidat") throw new RequestError(403, "Un compte candidat est nécessaire.");
      if (!actor.profile.cv.trim()) throw new RequestError(400, "Renseignez votre CV dans votre espace candidat avant de postuler.");
      if (!actor.user.email) throw new RequestError(400, "Votre compte doit disposer d’une adresse e-mail.");
      const jobId = uuidField(body, "jobId");
      const message = textField(body, "message", 3000);
      await db.transaction(async (transaction) => {
        const [job] = await transaction.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "published"), gt(jobs.expiresAt, new Date()))).for("update");
        if (!job) throw new RequestError(410, "Cette offre n’accepte plus de candidatures.");
        const result = await transaction.insert(applications).values({ jobId, candidateId: actor.user.id, name: actor.profile.name, email: actor.user.email!, cv: actor.profile.cv, message }).onConflictDoNothing().returning({ id: applications.id });
        if (!result.length) throw new RequestError(409, "Vous avez déjà postulé à cette offre.");
      });
      return json({ message: "Candidature envoyée. Vous pouvez la suivre dans votre espace." }, 201);
    }
    if (path === "/api/applications/status") {
      if (actor.profile.role !== "recruteur") throw new RequestError(403, "Un compte recruteur est nécessaire.");
      const applicationId = uuidField(body, "applicationId");
      const status = textField(body, "status", 20, 1);
      if (!["Reçue", "En cours", "Entretien", "Refusée", "Retenue"].includes(status)) throw new RequestError(400, "Statut invalide.");
      const [owned] = await db.select({ id: applications.id }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.id, applicationId), eq(jobs.ownerId, actor.user.id)));
      if (!owned) throw new RequestError(404, "Candidature introuvable.");
      await db.update(applications).set({ status }).where(eq(applications.id, applicationId));
      return json({ message: "Statut de la candidature mis à jour." });
    }
    return json({ error: "Adresse introuvable." }, 404);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof MissingIdentityError) return json({ error: "Les comptes ne sont pas encore disponibles. Réessayez après l’activation du service." }, 503);
    if (error instanceof AuthError) return json({ error: "Impossible de valider cette demande. Vérifiez vos informations et la confirmation de votre e-mail." }, error.status === 429 ? 429 : 400);
    return json({ error: "Le service est temporairement indisponible. Réessayez dans quelques instants." }, 503);
  }
}
