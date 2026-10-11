import { contracts, launchReady, serviceAnswers, type SiteSettings } from "./content.js";
import type { jobs, profiles, applications } from "../db/schema.js";

export type Job = typeof jobs.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Application = typeof applications.$inferSelect;

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("fr-SN", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" }).format(value);
}

export function activeJob(job: Job, now = new Date()) {
  return job.status === "published" && job.expiresAt > now;
}

export function notice(settings: SiteSettings) {
  return launchReady(settings) ? "" : '<aside class="notice" role="note">Les inscriptions publiques, les candidatures et la publication d’offres sont temporairement fermées. L’administration doit compléter les informations du service, vérifier les parcours et confirmer l’ouverture depuis son espace. Les comptes invités peuvent se connecter et préparer leur profil.</aside>';
}

export function layout(options: { title: string; description: string; path: string; origin: string; body: string; settings: SiteSettings; private?: boolean; noindex?: boolean }) {
  const navigation = [["/", "Accueil"], ["/offres", "Offres"], ["/stages", "Stages"], ["/tarifs", "Recruteurs"], ["/a-propos", "À propos"], ["/compte", "Mon espace"]];
  const indexing = options.private || options.noindex;
  return `<!DOCTYPE html><html lang="fr-SN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(options.title)}</title><meta name="description" content="${escapeHtml(options.description)}">${indexing ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${escapeHtml(options.origin + options.path)}">`}<meta name="theme-color" content="#0b2a5c"><link rel="stylesheet" href="/assets/site.css"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&display=swap" rel="stylesheet"><script type="module" src="/assets/app.js"></script></head><body><a class="skip-link" href="#contenu">Aller au contenu</a><header><div class="row"><a class="logo" href="/" aria-label="Wutligey, accueil"><img src="/assets/brand.svg" width="172" height="38" alt="Wutligey"></a><span class="mu sm">Emploi · Sénégal</span></div><nav id="nav" aria-label="Navigation principale">${navigation.map(([path, label]) => `<a href="${path}" ${path === options.path ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav></header><main id="contenu">${options.body}</main><footer>Wutligey · Emplois et stages au Sénégal<div class="links"><a href="/a-propos">À propos et questions fréquentes</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Politique de confidentialité</a><a href="/conditions">Conditions d’utilisation</a></div>${options.settings.contactEmail ? `<a href="mailto:${escapeHtml(options.settings.contactEmail)}">${escapeHtml(options.settings.contactEmail)}</a>` : ""}</footer></body></html>`;
}

export function jobCard(job: Job) {
  return `<article class="card"><div class="row"><h3><a href="${job.validationOnly ? "/recette/offres/" : "/offres/"}${job.id}">${escapeHtml(job.title)}</a></h3><span class="tag">${escapeHtml(job.contract)}</span></div><p class="mu sm">${escapeHtml(job.company)} · ${escapeHtml(job.city)}, Sénégal${job.remote ? " · Télétravail possible" : ""}</p><p>${escapeHtml(job.description.slice(0, 155))}${job.description.length > 155 ? "…" : ""}</p><div class="row"><span class="mu sm">Publiée le ${dateLabel(job.publishedAt ?? job.createdAt)}</span><a class="btn" href="${job.validationOnly ? "/recette/offres/" : "/offres/"}${job.id}">Voir l’offre</a></div></article>`;
}

export function emptyJobs() {
  return '<div class="card empty"><h2>Pas encore d’offre disponible</h2><p class="mu">Les offres réelles apparaîtront ici après leur validation. Aucun emploi fictif n’est présenté comme disponible.</p><a class="btn o" href="/tarifs">Vous recrutez au Sénégal ?</a></div>';
}

export function selectOptions(values: string[], selected = "") {
  return values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

export function searchForm(values = { query: "", city: "", contract: "" }, hero = false) {
  return `<form action="/offres" method="get" class="${hero ? "" : "filters card"}"><div><label for="query">Métier, mot-clé ou entreprise</label><input id="query" name="q" value="${escapeHtml(values.query)}" placeholder="Ex. comptable, développeur" maxlength="120"></div><div><label for="city">Ville au Sénégal</label><input id="city" name="ville" value="${escapeHtml(values.city)}" placeholder="Ex. Dakar" maxlength="80"></div><div><label for="contract">Contrat</label><select id="contract" name="contrat"><option value="">Tous les contrats</option>${selectOptions(contracts, values.contract)}</select></div><button class="btn ${hero ? "y" : ""}">Rechercher</button></form>`;
}

export function faq() {
  return `<section class="card faq"><h2>Questions fréquentes</h2>${serviceAnswers.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join("")}</section>`;
}

export function home(list: Job[], settings: SiteSettings) {
  return `<section class="hero"><div class="in"><p class="eyebrow">WUTLIGEY · SÉNÉGAL</p><h1>Trouvez votre prochain emploi au Sénégal.</h1><p>Emplois, stages et alternances : consultez les offres par métier, ville et contrat. La recherche et les candidatures sont gratuites pour les candidats.</p>${searchForm(undefined, true)}</div></section><div class="wrap intro">${notice(settings)}<div class="row section-title"><h2>Les dernières offres au Sénégal</h2><a href="/offres">Voir toutes les offres</a></div>${list.length ? `<div class="grid">${list.map(jobCard).join("")}</div>` : emptyJobs()}<div class="two section-title"><section class="card"><h2>Vous cherchez un emploi ?</h2><p>Préparez votre CV en texte, postulez aux offres actives et suivez vos candidatures dans votre espace privé.</p><a class="btn" href="/inscription?profil=candidat">Créer un compte candidat</a></section><section class="card"><h2>Vous recrutez au Sénégal ?</h2><p>Présentez votre entreprise, proposez une offre précise et recevez les candidatures dans votre espace recruteur.</p><a class="btn y" href="/tarifs">Découvrir l’espace recruteur</a></section></div>${faq()}</div>`;
}

export function listing(list: Job[], values: { query: string; city: string; contract: string }, settings: SiteSettings) {
  return `<div class="wrap"><p class="breadcrumbs"><a href="/">Accueil</a> / Offres</p><h1>${values.contract === "Stage" ? "Stages au Sénégal" : "Offres d’emploi au Sénégal"}</h1><p class="mu">Des offres actives avec une ville, un contrat et une entreprise identifiés.</p>${notice(settings)}${searchForm(values)}<p class="mu">${list.length} offre${list.length > 1 ? "s" : ""} correspondant à votre recherche${list.length === 200 ? " (200 premiers résultats)" : ""}.</p>${list.length ? `<div class="grid">${list.map(jobCard).join("")}</div>` : emptyJobs()}</div>`;
}

export function jobPage(job: Job, settings: SiteSettings, validationAllowed = false) {
  return `<div class="wrap prose"><p class="breadcrumbs"><a href="/">Accueil</a> / <a href="/offres">Offres</a> / ${escapeHtml(job.title)}</p><article class="card"><span class="tag">${escapeHtml(job.contract)}</span><h1 style="margin-top:12px">${escapeHtml(job.title)}</h1><p>${job.validationOnly ? escapeHtml(job.company) : `<a href="/entreprises/${encodeURIComponent(job.ownerId)}">${escapeHtml(job.company)}</a>`} · ${escapeHtml(job.city)}, Sénégal${job.remote ? " · Télétravail possible" : ""}</p><p class="mu sm">Publiée le ${dateLabel(job.publishedAt ?? job.createdAt)} · Candidatures jusqu’au ${dateLabel(job.expiresAt)}</p>${job.salary ? `<p><strong>Rémunération :</strong> ${escapeHtml(job.salary)} FCFA (XOF) / mois</p>` : '<p class="mu sm">Rémunération non précisée par le recruteur.</p>'}<h2>Description du poste</h2><div class="job-description">${escapeHtml(job.description)}</div><section>${(job.validationOnly ? validationAllowed : launchReady(settings)) ? `<h2>Postuler à cette offre</h2><p>Votre CV reste privé. Une copie sera envoyée uniquement au recruteur de cette offre lorsque vous postulerez.</p><form data-api="/api/applications"><input type="hidden" name="jobId" value="${job.id}"><label for="message">Message au recruteur (facultatif)</label><textarea id="message" name="message" rows="4" maxlength="3000"></textarea><p class="mu sm">Un compte candidat confirmé et un CV renseigné sont nécessaires. <a href="/compte">Ouvrir mon espace</a> ou <a href="/inscription?profil=candidat">créer mon compte</a>.</p><button class="btn">Envoyer ma candidature</button><p class="form-status" role="status" aria-live="polite"></p></form>` : notice(settings)}</section></article></div>`;
}
