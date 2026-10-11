import type { Config } from "@netlify/functions";
import { and, eq } from "drizzle-orm";
import { database } from "../../db/index.js";
import { jobs, profiles } from "../../db/schema.js";
import { api } from "../../server/api.js";
import { defaultSettings, hasIncompleteInformation, recruitmentAllowed, validationAccess } from "../../server/content.js";
import { providedLegalDocuments } from "../../server/legal-content.js";
import { accountData, adminAccounts, publicJobs, requireActor, RequestError, siteSettings, uuidPattern } from "../../server/data.js";
import { dashboard } from "../../server/dashboard.js";
import { activeJob, escapeHtml, home, jobCard, jobPage, layout, listing } from "../../server/html.js";
import { about, authentication, legalPage, passwordPage, recruiters } from "../../server/pages.js";

export function htmlResponse(body: string, status = 200, privatePage = false, noindex = false) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...(privatePage || noindex ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    },
  });
}

export default async function site(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/")) return api(request, path);
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Méthode non autorisée", { status: 405, headers: { Allow: "GET, HEAD" } });
  try {
    const settings = await siteSettings();
    let title = "Wutligey — Emplois, stages et alternances au Sénégal";
    let description = "Recherchez un emploi, un stage ou une alternance au Sénégal avec Wutligey. Consultez les offres par ville et contrat et postulez gratuitement.";
    let body = "";
    let status = 200;
    let privatePage = false;
    const preview = Boolean(process.env.CONTEXT && process.env.CONTEXT !== "production");
    let noindex = preview;
    if (path === "/") {
      body = home(await publicJobs(undefined, 6), settings);
    } else if (path === "/offres" || path === "/stages") {
      const values = { query: (url.searchParams.get("q") ?? "").slice(0, 120), city: (url.searchParams.get("ville") ?? "").slice(0, 80), contract: path === "/stages" ? "Stage" : (url.searchParams.get("contrat") ?? "").slice(0, 20) };
      title = path === "/stages" ? "Stages au Sénégal — Wutligey" : "Offres d’emploi au Sénégal — Wutligey";
      description = path === "/stages" ? "Découvrez les stages ouverts au Sénégal : entreprise, ville, missions et modalités de candidature sur Wutligey." : "Consultez les offres d’emploi actives au Sénégal : CDI, CDD, alternance et freelance. Filtrez par métier, entreprise et ville.";
      noindex = preview || Boolean(values.query || values.city || (path === "/offres" && values.contract));
      body = listing(await publicJobs(values), values, settings);
    } else if (path.startsWith("/offres/")) {
      const id = path.slice("/offres/".length);
      const [job] = uuidPattern.test(id) ? await database().select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.validationOnly, false))) : [];
      const [owner] = job ? await database().select({ suspended: profiles.suspended }).from(profiles).where(eq(profiles.id, job.ownerId)) : [];
      if (!job || !owner || owner.suspended || job.status === "pending" || job.status === "rejected") {
        status = 404;
        noindex = true;
        title = "Offre introuvable — Wutligey";
        body = '<div class="wrap"><h1>Offre introuvable</h1><p>Cette offre n’est pas disponible publiquement.</p><a class="btn" href="/offres">Consulter les offres actives</a></div>';
      } else if (!activeJob(job)) {
        status = 410;
        noindex = true;
        title = "Offre clôturée — Wutligey";
        body = '<div class="wrap"><h1>Cette offre est clôturée ou expirée</h1><p>Elle n’accepte plus de candidatures.</p><a class="btn" href="/offres">Consulter les offres actives au Sénégal</a></div>';
      } else {
        title = `${job.title} — ${job.company}, ${job.city} | Wutligey`;
        description = `${job.company} recrute : ${job.title} à ${job.city}, Sénégal (${job.contract}). ${job.description.slice(0, 100)}`;
        body = jobPage(job, settings);
      }
    } else if (path === "/recette" || path.startsWith("/recette/offres/")) {
      privatePage = true;
      noindex = true;
      const actor = await requireActor();
      if (!actor.admin && !validationAccess(settings, actor.user.email)) throw new RequestError(403, "La recette privée est réservée aux comptes autorisés.");
      title = "Recette privée — WutLigey";
      if (path === "/recette") {
        const offers = await publicJobs(undefined, 200, undefined, true);
        body = `<div class="wrap"><h1>Recette privée</h1><p class="notice">Ces offres de validation ne sont pas publiques. Utilisez uniquement des données autorisées. L’ouverture publique reste indépendante.</p><p><a href="/compte">Mon espace</a></p><div class="grid">${offers.map(jobCard).join("") || "<p>Aucune offre de recette validée pour le moment.</p>"}</div></div>`;
      } else {
        const id = path.slice("/recette/offres/".length);
        const [job] = uuidPattern.test(id) ? await database().select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.validationOnly, true))) : [];
        const [owner] = job ? await database().select({ suspended: profiles.suspended }).from(profiles).where(eq(profiles.id, job.ownerId)) : [];
        if (!job || !owner || owner.suspended || job.status !== "published") throw new RequestError(404, "Offre de recette introuvable.");
        if (!activeJob(job)) throw new RequestError(410, "Cette offre de recette est expirée.");
        body = jobPage(job, settings, !actor.admin && validationAccess(settings, actor.user.email));
      }
    } else if (path.startsWith("/entreprises/")) {
      const ownerId = path.slice("/entreprises/".length);
      const companyJobs = uuidPattern.test(ownerId) ? await publicJobs(undefined, 200, ownerId) : [];
      const [company] = companyJobs.length ? await database().select({ company: profiles.company, companyAbout: profiles.companyAbout }).from(profiles).where(eq(profiles.id, ownerId)) : [];
      if (!company) {
        status = 404;
        noindex = true;
        title = "Entreprise introuvable — Wutligey";
        body = '<div class="wrap"><h1>Entreprise indisponible</h1><p>Cette entreprise n’a pas d’offre active sur Wutligey.</p><a href="/offres">Consulter les offres</a></div>';
      } else {
        title = `${company.company} — Offres d’emploi au Sénégal | Wutligey`;
        description = `Consultez les offres d’emploi actives de ${company.company} au Sénégal sur Wutligey.`;
        noindex = preview || !company.companyAbout;
        body = `<div class="wrap"><p class="breadcrumbs"><a href="/offres">Offres</a> / Entreprise</p><h1>${escapeHtml(company.company)}</h1>${company.companyAbout ? `<div class="card company-description">${escapeHtml(company.companyAbout)}</div>` : ""}<h2 class="section-title">Offres actives au Sénégal</h2><div class="grid">${companyJobs.map(jobCard).join("")}</div></div>`;
      }
    } else if (path === "/tarifs") {
      title = "Recruteurs au Sénégal : publication d’offres et tarifs — Wutligey";
      description = "Découvrez comment publier une offre au Sénégal et gérer les candidatures sur Wutligey. Informations sur le fonctionnement et la facturation.";
      body = recruiters(settings);
    } else if (path === "/a-propos") {
      title = "À propos de Wutligey et questions fréquentes — Emploi au Sénégal";
      description = "Comment fonctionne Wutligey au Sénégal ? Retrouvez les réponses sur les candidatures, la gratuité, la confidentialité des CV et la publication d’offres.";
      body = about(settings);
    } else if (["/mentions-legales", "/confidentialite", "/conditions"].includes(path)) {
      const documents = { "/mentions-legales": ["Mentions légales", settings.legal || providedLegalDocuments.legal], "/confidentialite": ["Politique de confidentialité", settings.privacy || providedLegalDocuments.privacy], "/conditions": ["Conditions générales d’utilisation", settings.terms || providedLegalDocuments.terms] };
      const [label, text] = documents[path as keyof typeof documents];
      title = `${label} — Wutligey`;
      description = `${label} du service Wutligey, plateforme d’emploi au Sénégal.`;
      const draft = !settings.documentsApproved || hasIncompleteInformation(text);
      noindex = preview || draft;
      body = legalPage(label, text, draft);
    } else if (path === "/connexion" || path === "/inscription") {
      privatePage = true;
      const signup = path === "/inscription";
      title = `${signup ? "Créer un compte" : "Se connecter"} — Wutligey`;
      body = authentication(signup ? "signup" : "login", url.searchParams.get("profil") === "recruteur" ? "recruteur" : "candidat", settings);
    } else if (path === "/mot-de-passe") {
      privatePage = true;
      title = "Récupérer mon compte — Wutligey";
      body = passwordPage();
    } else if (path === "/compte") {
      privatePage = true;
      const actor = await requireActor();
      const data = await accountData(actor);
      const page = Math.min(10000, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
      const accounts = actor.admin ? await adminAccounts(page) : [];
      title = "Mon espace privé — Wutligey";
      body = dashboard(actor.profile, data.jobList, data.applicationList, settings, actor.admin, accounts, page, recruitmentAllowed(settings, actor.user.email), validationAccess(settings, actor.user.email));
    } else {
      status = 404;
      noindex = true;
      title = "Page introuvable — Wutligey";
      body = '<div class="wrap"><h1>Page introuvable</h1><a href="/">Revenir à l’accueil</a></div>';
    }
    const page = layout({ title, description, body, path, origin: url.origin, settings, private: privatePage, noindex });
    return htmlResponse(request.method === "HEAD" ? "" : page, status, privatePage, noindex);
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) return new Response(null, { status: 303, headers: { Location: "/connexion", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
    const status = error instanceof RequestError ? error.status : 503;
    if (!(error instanceof RequestError)) console.error("page_data_unavailable", { path });
    const body = `<div class="wrap prose"><h1>${status === 403 ? "Accès non autorisé" : "Le service est temporairement indisponible"}</h1><p>${error instanceof RequestError ? escapeHtml(error.message) : "Les données ne peuvent pas être chargées pour le moment. Réessayez dans quelques instants."}</p><a class="btn o" href="/">Revenir à l’accueil</a></div>`;
    return htmlResponse(request.method === "HEAD" ? "" : layout({ title: "Wutligey — Service indisponible", description: "Plateforme d’emploi au Sénégal.", path, origin: url.origin, body, settings: defaultSettings, noindex: true }), status, true);
  }
}

export const config: Config = {
  path: ["/", "/offres", "/stages", "/offres/:id", "/entreprises/:id", "/recette", "/recette/offres/:id", "/tarifs", "/a-propos", "/mentions-legales", "/confidentialite", "/conditions", "/connexion", "/inscription", "/mot-de-passe", "/compte", "/api/*"],
  preferStatic: false,
};
