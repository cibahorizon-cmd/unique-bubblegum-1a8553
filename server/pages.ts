import { launchReady, validationReady, type SiteSettings } from "./content.js";
import { escapeHtml, faq, notice, selectOptions } from "./html.js";

export function recruiters(settings: SiteSettings) {
  return `<div class="wrap prose"><h1>Recrutez au Sénégal avec Wutligey</h1><p>Publiez des offres d’emploi, de stage et d’alternance et gérez les candidatures depuis un espace privé.</p>${notice(settings)}<section class="card"><h2>Une offre claire, des candidatures ciblées</h2><ol><li>Créez votre compte recruteur et confirmez votre e-mail.</li><li>Renseignez votre entreprise et rédigez votre offre : ville, contrat, missions, compétences attendues et date de fin.</li><li>Après validation de l’administration, l’offre dispose d’une adresse publique que vous pouvez partager.</li><li>Consultez les CV des personnes ayant postulé et mettez à jour le statut de leurs candidatures.</li></ol><a class="btn" href="/inscription?profil=recruteur">Créer un compte recruteur</a></section><section class="card"><h2>Tarifs et facturation</h2><p>Les anciens forfaits de démonstration ont été retirés. Aucun abonnement payant ni paiement en ligne n’est proposé actuellement. Les éventuels tarifs futurs seront affichés en francs CFA (XOF) avant toute souscription.</p><p>La consultation des offres et les candidatures restent gratuites pour les candidats.</p></section></div>`;
}

export function about(settings: SiteSettings) {
  return `<div class="wrap prose"><h1>Wutligey : l’emploi et les stages au Sénégal</h1><section class="card"><h2>Pour les candidats et les recruteurs au Sénégal</h2><p>Wutligey met en relation les personnes qui recherchent un poste et les entreprises qui recrutent au Sénégal. Les offres précisent leur localisation, leur contrat et leurs missions.</p><p>Une validation de publication ne garantit pas une embauche. Vérifiez les informations d’une offre et ne versez jamais d’argent pour obtenir un emploi.</p>${settings.operatorName ? `<p><strong>Éditeur :</strong> ${escapeHtml(settings.operatorName)}</p>` : '<p class="mu">Les informations de l’éditeur sont en cours de finalisation avant l’ouverture des candidatures.</p>'}${settings.contactEmail ? `<p><strong>Contact :</strong> <a href="mailto:${escapeHtml(settings.contactEmail)}">${escapeHtml(settings.contactEmail)}</a></p>` : ""}</section>${notice(settings)}${faq()}</div>`;
}

export function legalPage(title: string, text: string, draft = true) {
  const sections = text.split(/\n\s*\n/).filter(Boolean).map((section) => {
    if (/^# /.test(section)) return "";
    const heading = section.match(/^#{2,3} (.+)$/);
    if (heading) return `<h2>${escapeHtml(heading[1])}</h2>`;
    if (section.split("\n").every((line) => line.startsWith("- "))) return `<ul>${section.split("\n").map((line) => `<li>${escapeHtml(line.slice(2))}</li>`).join("")}</ul>`;
    if (section.split("\n").every((line) => /^\d+\. /.test(line))) return `<ol>${section.split("\n").map((line) => `<li>${escapeHtml(line.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    return `<p>${escapeHtml(section)}</p>`;
  }).join("");
  return `<div class="wrap prose"><h1>${escapeHtml(title)}</h1>${draft ? '<aside class="notice" role="note">Projet à valider — cette version n’est pas définitive. Les champs à compléter et les décisions de conservation, de transfert et de formalités doivent être vérifiés par l’exploitant avant l’ouverture publique.</aside>' : ""}<section class="card legal-document">${sections || "Ces informations doivent être complétées par l’éditeur avant l’ouverture du service."}</section></div>`;
}

export function authentication(kind: "login" | "signup", role: string, settings: SiteSettings) {
  const signup = kind === "signup";
  const blocked = signup && !launchReady(settings) && !validationReady(settings);
  return `<div class="wrap"><section class="card form-card"><h1>${signup ? "Créer mon compte" : "Se connecter"}</h1>${blocked ? notice(settings) : signup && !launchReady(settings) ? '<aside class="notice" role="note">Recette privée : seules les adresses approuvées peuvent créer un compte. Les documents proposés sont des projets à valider.</aside>' : ""}<form data-api="/api/${signup ? "signup" : "login"}" data-redirect="/compte">${signup ? `<label for="name">Votre nom</label><input id="name" name="name" required maxlength="100" autocomplete="name"><label for="role">Votre profil</label><select id="role" name="role">${selectOptions(["candidat", "recruteur"], role)}</select>` : ""}<label for="email">Adresse e-mail</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email"><label for="password">Mot de passe${signup ? " (12 caractères minimum)" : ""}</label><input id="password" name="password" type="password" required ${signup ? 'minlength="12"' : ""} maxlength="200" autocomplete="${signup ? "new-password" : "current-password"}">${signup ? '<label><input type="checkbox" name="consent" required style="width:auto"> J’accepte les <a href="/conditions">conditions générales d’utilisation</a> et j’ai pris connaissance de la <a href="/confidentialite">politique de confidentialité</a>. <a href="/mentions-legales">Mentions légales</a>.</label>' : ""}<div class="actions"><button class="btn" ${blocked ? 'disabled aria-describedby="signup-availability"' : ""}>${signup ? "Créer mon compte" : "Se connecter"}</button></div><p class="form-status" role="status" aria-live="polite"></p></form>${blocked ? '<p id="signup-availability">L’inscription sera disponible après ouverture du service par l’administration. Pour un compte déjà invité, utilisez le lien reçu par e-mail puis connectez-vous.</p>' : ""}<p><a href="/${signup ? "connexion" : "inscription"}">${signup ? "J’ai déjà un compte" : "Créer un compte"}</a></p>${signup ? "" : '<a href="/mot-de-passe">Mot de passe oublié ?</a>'}</section></div>`;
}

export function passwordPage() {
  return '<div class="wrap"><section class="card form-card"><h1>Récupérer mon compte</h1><form data-api="/api/recovery"><label for="email">Adresse e-mail</label><input id="email" name="email" type="email" autocomplete="email" required><button class="btn" style="margin-top:16px">Recevoir le lien de récupération</button><p class="form-status" role="status" aria-live="polite"></p></form></section></div>';
}
