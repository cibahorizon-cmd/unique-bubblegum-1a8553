import { and, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { admin as identityAdmin, AuthError, MissingIdentityError, getSettings, login, logout, requestPasswordRecovery, signup, verifyRequestOrigin } from "@netlify/identity";
import { database } from "../db/index.js";
import { applications, jobs, profiles, settings } from "../db/schema.js";
import { configurationReady, contracts, launchReady, recruitmentAllowed, validationAccess, validationReady } from "./content.js";
import { emailField, expiryField, isAdmin, passwordField, requireActor, RequestError, siteSettings, textField, uuidField } from "./data.js";
import { checkDocumentStorage, documentDownload, documentUpload, limitedBody, removeUnusedDocument } from "./documents.js";

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function api(request: Request, path: string) {
  try {
    if (path === "/api/cv" && ["GET", "HEAD"].includes(request.method)) {
      const response = await documentDownload(request);
      return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
    }
    const paths = ["/api/logout", "/api/login", "/api/recovery", "/api/signup", "/api/settings", "/api/accounts/status", "/api/accounts/type", "/api/companies/update", "/api/profile", "/api/cv", "/api/cv/remove", "/api/jobs", "/api/jobs/edit", "/api/jobs/status", "/api/applications", "/api/applications/withdraw", "/api/applications/status"];
    if (!paths.includes(path)) return json({ error: "Adresse introuvable." }, 404);
    if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
    try { verifyRequestOrigin(request); } catch { throw new RequestError(403, "Origine de la requête non autorisée."); }
    if (path === "/api/cv") {
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new RequestError(415, "Format de téléversement invalide.");
      await documentUpload(request);
      return json({ message: "Votre CV PDF privé a été enregistré." }, 201);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RequestError(415, "Format de requête invalide.");
    const raw = new TextDecoder().decode(await limitedBody(request, 200000));
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new RequestError(400, "Requête invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError(400, "Requête invalide.");
    if (path === "/api/logout") {
      await logout();
      return json({ message: "Déconnexion effectuée." });
    }
    if (path === "/api/login") {
      const password = passwordField(body);
      const user = await login(emailField(body, "email"), password);
      try {
        const [profile] = await database().select({ suspended: profiles.suspended }).from(profiles).where(eq(profiles.id, user.id));
        if (profile?.suspended) throw new RequestError(403, "Ce compte a été suspendu. Contactez l’administration.");
      } catch (error) { await logout(); throw error; }
      return json({ message: "Connexion réussie.", redirect: "/compte" });
    }
    if (path === "/api/recovery") {
      const email = emailField(body, "email");
      try { await requestPasswordRecovery(email); } catch (error) {
        if (!(error instanceof AuthError) || ![400, 404].includes(error.status ?? 0)) throw error;
      }
      return json({ message: "Si ce compte existe, un lien de récupération a été envoyé. Consultez votre boîte e-mail." });
    }
    const currentSettings = await siteSettings();
    if (path === "/api/signup") {
      if (!recruitmentAllowed(currentSettings, typeof body.email === "string" ? body.email : undefined)) throw new RequestError(503, "Les inscriptions publiques sont fermées. La recette est réservée aux adresses approuvées par l’administration.");
      if (body.consent !== "on") throw new RequestError(400, "Acceptez les conditions et prenez connaissance de la confidentialité.");
      const role = textField(body, "role", 12, 1);
      if (!["candidat", "recruteur"].includes(role)) throw new RequestError(400, "Profil invalide.");
      const user = await signup(emailField(body, "email"), passwordField(body, 12), {
        full_name: textField(body, "name", 100, 2),
        account_type: role,
        terms_accepted_at: new Date().toISOString(),
        terms_digest: createHash("sha256").update(currentSettings.terms).digest("hex"),
        privacy_digest: createHash("sha256").update(currentSettings.privacy).digest("hex"),
      });
      return json({ message: user.confirmedAt ? "Votre compte est créé." : "Votre compte a été créé. Confirmez votre adresse grâce au lien reçu par e-mail avant de vous connecter.", redirect: user.confirmedAt ? "/compte" : null }, 201);
    }
    const actor = await requireActor();
    const db = database();
    if (path === "/api/settings") {
      if (!actor.admin) throw new RequestError(403, "Accès réservé à l’administration.");
      const approvedEmails = textField(body, "validationEmails", 5000).split(/[\s,;]+/).filter(Boolean).map((email) => email.toLowerCase());
      if (approvedEmails.length > 30 || approvedEmails.some((email) => email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) throw new RequestError(400, "Indiquez au maximum 30 adresses de recette valides, séparées par des lignes.");
      const values = {
        operatorName: textField(body, "operatorName", 200),
        contactEmail: body.contactEmail ? emailField(body, "contactEmail") : "",
        legal: textField(body, "legal", 25000),
        privacy: textField(body, "privacy", 25000),
        terms: textField(body, "terms", 25000),
        launchEnabled: body.launchEnabled === "on",
        documentsApproved: body.documentsApproved === "on",
        validationEnabled: body.validationEnabled === "on",
        validationEmails: [...new Set(approvedEmails)].join("\n"),
      };
      if (values.documentsApproved && !configurationReady({ id: "main", ...values })) throw new RequestError(400, "Les documents comportent encore des informations à compléter. Enregistrez-les comme projets non validés.");
      if (values.launchEnabled) {
        if (!configurationReady({ id: "main", ...values })) throw new RequestError(400, "Complétez l’éditeur, le contact et les trois textes (80 caractères minimum chacun), sans champs à compléter ni marqueurs de modèle, avant l’ouverture.");
        if (!values.documentsApproved) throw new RequestError(400, "Validez les documents juridiques définitifs avant l’ouverture publique.");
        if (body.checksConfirmed !== "on") throw new RequestError(400, "Validez les parcours et les e-mails avant d’ouvrir le service.");
      }
      if (values.validationEnabled && !validationReady({ id: "main", ...values })) throw new RequestError(400, "Renseignez l’éditeur, le contact, les trois projets de documents et au moins une adresse autorisée pour la recette.");
      if (values.launchEnabled || values.validationEnabled) {
        const identity = await getSettings();
        if (identity.disableSignup || identity.autoconfirm) throw new RequestError(503, "Dans Netlify Identity, ouvrez les inscriptions et désactivez la confirmation automatique.");
        await checkDocumentStorage();
      }
      await db.insert(settings).values({ id: "main", ...values }).onConflictDoUpdate({ target: settings.id, set: values });
      return json({ message: values.launchEnabled ? "Configuration validée et service ouvert." : values.validationEnabled ? "Recette privée activée pour les adresses autorisées. Le service reste fermé au public." : "Informations enregistrées. Le service reste fermé au public." });
    }
    if (path === "/api/accounts/status" || path === "/api/accounts/type") {
      if (!actor.admin) throw new RequestError(403, "Accès réservé à l’administration.");
      const userId = uuidField(body, "userId");
      const target = await identityAdmin.getUser(userId);
      if (userId === actor.user.id || isAdmin(target)) throw new RequestError(403, "Les comptes administrateur ne peuvent pas être modifiés ici.");
      if (path === "/api/accounts/type") {
        const role = textField(body, "role", 12, 1);
        if (!["candidat", "recruteur"].includes(role)) throw new RequestError(400, "Profil invalide.");
        await db.transaction(async (transaction) => {
          const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, userId)).for("update");
          const [job] = await transaction.select({ id: jobs.id }).from(jobs).where(eq(jobs.ownerId, userId)).limit(1);
          const [application] = await transaction.select({ id: applications.id }).from(applications).where(eq(applications.candidateId, userId)).limit(1);
          if (job || application || profile?.cvKey || profile?.cv.trim()) throw new RequestError(409, "Un compte avec des offres, candidatures ou un CV ne peut pas changer de profil.");
          await identityAdmin.updateUser(userId, { app_metadata: { ...target.appMetadata, account_type: role } });
          await transaction.insert(profiles).values({ id: userId, name: (target.name ?? "Mon compte").slice(0, 100), role }).onConflictDoUpdate({ target: profiles.id, set: { role } });
        });
        return json({ message: "Profil du compte mis à jour. Aucun droit administrateur n’a été attribué." });
      }
      const status = textField(body, "status", 12, 1);
      if (!["active", "suspended"].includes(status)) throw new RequestError(400, "Statut invalide.");
      const suspended = status === "suspended";
      await db.insert(profiles).values({ id: userId, name: (target.name ?? "Mon compte").slice(0, 100), role: target.appMetadata?.account_type === "recruteur" ? "recruteur" : "candidat", suspended }).onConflictDoUpdate({ target: profiles.id, set: { suspended } });
      return json({ message: suspended ? "Compte suspendu. Ses offres ne sont plus publiques." : "Compte réactivé." });
    }
    if (path === "/api/companies/update") {
      if (!actor.admin) throw new RequestError(403, "Accès réservé à l’administration.");
      const ownerId = uuidField(body, "userId");
      const values = { company: textField(body, "company", 150, 2), companyAbout: textField(body, "companyAbout", 3000) };
      await db.transaction(async (transaction) => {
        const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, ownerId)).for("update");
        if (!profile || profile.role !== "recruteur") throw new RequestError(404, "Entreprise introuvable.");
        await transaction.update(profiles).set(values).where(eq(profiles.id, ownerId));
        if (profile.company !== values.company) {
          await transaction.update(jobs).set({ company: values.company, status: "pending", publishedAt: null }).where(and(eq(jobs.ownerId, ownerId), eq(jobs.status, "published")));
        }
      });
      return json({ message: "Entreprise mise à jour. Les offres dont le nom d’entreprise a changé nécessitent une nouvelle validation." });
    }
    if (path === "/api/cv/remove") {
      if (actor.profile.role !== "candidat" || actor.admin) throw new RequestError(403, "Un compte candidat est nécessaire.");
      const key = await db.transaction(async (transaction) => {
        const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, actor.user.id)).for("update");
        if (!profile) throw new RequestError(404, "Profil introuvable.");
        await transaction.update(profiles).set({ cvKey: "", cvName: "" }).where(eq(profiles.id, actor.user.id));
        return profile.cvKey;
      });
      await removeUnusedDocument(key);
      return json({ message: "CV PDF personnel supprimé. Les copies des candidatures restent disponibles jusqu’à leur retrait." });
    }
    if (path === "/api/applications/withdraw") {
      const deleted = await db.delete(applications).where(and(eq(applications.id, uuidField(body, "applicationId")), eq(applications.candidateId, actor.user.id))).returning({ id: applications.id, cvKey: applications.cvKey });
      if (!deleted.length) throw new RequestError(404, "Candidature introuvable.");
      await removeUnusedDocument(deleted[0].cvKey);
      return json({ message: "La candidature et sa copie de CV ont été supprimées." });
    }
    if (path === "/api/jobs/status") {
      const jobId = uuidField(body, "jobId");
      const status = textField(body, "status", 12, 1);
      if (!actor.admin && status !== "closed") throw new RequestError(403, "Seule l’administration valide la publication.");
      if (!["published", "rejected", "closed"].includes(status)) throw new RequestError(400, "Statut invalide.");
      const [existingJob] = await db.select({ validationOnly: jobs.validationOnly }).from(jobs).where(eq(jobs.id, jobId));
      if (status === "published" && !(existingJob?.validationOnly ? validationReady(currentSettings) : launchReady(currentSettings))) throw new RequestError(503, "Activez la recette privée pour une offre de recette, ou ouvrez le service pour une offre publique.");
      const conditions = [eq(jobs.id, jobId)];
      if (!actor.admin) conditions.push(eq(jobs.ownerId, actor.user.id));
      if (status === "published") conditions.push(gt(jobs.expiresAt, new Date()));
      const updated = await db.update(jobs).set({ status, ...(status === "published" ? { publishedAt: new Date() } : {}) }).where(and(...conditions)).returning({ id: jobs.id });
      if (!updated.length) throw new RequestError(404, "Offre introuvable ou expirée.");
      return json({ message: "Statut de l’offre mis à jour." });
    }
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
    if (!recruitmentAllowed(currentSettings, actor.user.email)) throw new RequestError(503, "Le service est fermé au public. Seuls les comptes autorisés peuvent effectuer la recette privée.");
    if (path === "/api/jobs" || path === "/api/jobs/edit") {
      if (actor.profile.role !== "recruteur" || actor.admin) throw new RequestError(403, "Un compte recruteur est nécessaire.");
      if (!actor.profile.company) throw new RequestError(400, "Renseignez votre entreprise dans votre espace recruteur.");
      const contract = textField(body, "contract", 20, 1);
      if (!contracts.includes(contract)) throw new RequestError(400, "Contrat invalide.");
      const salary = textField(body, "salary", 9);
      if (salary && (!/^\d{1,9}$/.test(salary) || Number(salary) < 1)) throw new RequestError(400, "Le salaire doit être un montant mensuel positif en FCFA (XOF).");
      const values = {
        ownerId: actor.user.id,
        title: textField(body, "title", 150, 3),
        company: actor.profile.company,
        city: textField(body, "city", 80, 2),
        contract,
        description: textField(body, "description", 12000, 100),
        salary,
        remote: body.remote === "on",
        expiresAt: expiryField(body),
      };
      if (path === "/api/jobs/edit") {
        const jobId = uuidField(body, "jobId");
        const [existingJob] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, actor.user.id)));
        if (!existingJob) throw new RequestError(404, "Offre introuvable.");
        if (existingJob.validationOnly ? !validationAccess(currentSettings, actor.user.email) : !launchReady(currentSettings)) throw new RequestError(403, "Cette offre ne fait pas partie de votre parcours actuellement autorisé.");
        const updated = await db.update(jobs).set({ ...values, status: "pending", publishedAt: null }).where(and(eq(jobs.id, jobId), eq(jobs.ownerId, actor.user.id))).returning({ id: jobs.id });
        if (!updated.length) throw new RequestError(404, "Offre introuvable.");
        return json({ message: "Offre modifiée et renvoyée en modération. Elle n’est plus publique jusqu’à sa validation." });
      }
      await db.transaction(async (transaction) => {
        const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, actor.user.id)).for("update");
        if (!profile || profile.suspended || profile.role !== "recruteur") throw new RequestError(403, "Un compte recruteur actif est nécessaire.");
        if (!profile.company) throw new RequestError(400, "Renseignez votre entreprise dans votre espace recruteur.");
        await transaction.insert(jobs).values({ ...values, company: profile.company, validationOnly: !launchReady(currentSettings) });
      });
      return json({ message: "Votre offre est enregistrée et attend sa validation." }, 201);
    }
    if (path === "/api/applications") {
      if (actor.profile.role !== "candidat" || actor.admin) throw new RequestError(403, "Un compte candidat est nécessaire.");
      if (!actor.user.email) throw new RequestError(400, "Votre compte doit disposer d’une adresse e-mail.");
      const jobId = uuidField(body, "jobId");
      const message = textField(body, "message", 3000);
      await db.transaction(async (transaction) => {
        const [profile] = await transaction.select().from(profiles).where(eq(profiles.id, actor.user.id)).for("update");
        if (!profile || profile.suspended) throw new RequestError(403, "Ce compte n’est pas disponible.");
        if (!profile.cv.trim() && !profile.cvKey) throw new RequestError(400, "Renseignez votre CV en texte ou téléversez un PDF dans votre espace candidat avant de postuler.");
        const [job] = await transaction.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "published"), gt(jobs.expiresAt, new Date()))).for("update");
        if (!job) throw new RequestError(410, "Cette offre n’accepte plus de candidatures.");
        if (job.validationOnly ? !validationAccess(currentSettings, actor.user.email) : !launchReady(currentSettings)) throw new RequestError(403, "Cette offre ne fait pas partie de votre parcours actuellement autorisé.");
        const [owner] = await transaction.select({ suspended: profiles.suspended }).from(profiles).where(eq(profiles.id, job.ownerId));
        if (!owner || owner.suspended) throw new RequestError(410, "Cette offre n’accepte plus de candidatures.");
        const result = await transaction.insert(applications).values({ jobId, candidateId: actor.user.id, name: profile.name, email: actor.user.email!, cv: profile.cv, cvKey: profile.cvKey, cvName: profile.cvName, message }).onConflictDoNothing().returning({ id: applications.id });
        if (!result.length) throw new RequestError(409, "Vous avez déjà postulé à cette offre.");
      });
      return json({ message: "Candidature envoyée. Vous pouvez la suivre dans votre espace." }, 201);
    }
    if (path === "/api/applications/status") {
      if (actor.profile.role !== "recruteur") throw new RequestError(403, "Un compte recruteur est nécessaire.");
      const applicationId = uuidField(body, "applicationId");
      const status = textField(body, "status", 20, 1);
      if (!["Reçue", "En cours", "Entretien", "Refusée", "Retenue"].includes(status)) throw new RequestError(400, "Statut invalide.");
      const [owned] = await db.select({ id: applications.id, validationOnly: jobs.validationOnly }).from(applications).innerJoin(jobs, eq(jobs.id, applications.jobId)).where(and(eq(applications.id, applicationId), eq(jobs.ownerId, actor.user.id)));
      if (!owned) throw new RequestError(404, "Candidature introuvable.");
      if (owned.validationOnly && !validationAccess(currentSettings, actor.user.email)) throw new RequestError(403, "Votre compte n’est pas autorisé à effectuer cette recette.");
      await db.update(applications).set({ status }).where(eq(applications.id, applicationId));
      return json({ message: "Statut de la candidature mis à jour." });
    }
    return json({ error: "Adresse introuvable." }, 404);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof MissingIdentityError) return json({ error: "Les comptes ne sont pas encore disponibles. Réessayez après l’activation du service." }, 503);
    if (error instanceof AuthError) {
      if (error.status === 422 && /webhook/i.test(error.message)) {
        console.error("identity_webhook_failed");
        return json({ error: "Identity n’a pas pu finaliser l’inscription. L’administration doit vérifier les événements Identity dans les journaux Netlify." }, 503);
      }
      return json({ error: "Impossible de valider cette demande. Vérifiez vos informations et la confirmation de votre e-mail." }, error.status === 429 ? 429 : 400);
    }
    console.error("api_unavailable", { path });
    return json({ error: "Le service est temporairement indisponible. Réessayez dans quelques instants." }, 503);
  }
}
