import { providedLegalDocuments } from "./legal-content.js";

export const contracts = ["CDI", "CDD", "Stage", "Alternance", "Freelance"];

export const defaultSettings = {
  id: "main",
  operatorName: "",
  contactEmail: "",
  legal: "",
  privacy: "",
  terms: "",
  launchEnabled: false,
  documentsApproved: false,
  validationEnabled: false,
  validationEmails: "",
};

export type SiteSettings = typeof defaultSettings;

export function configurationDraft(settings: SiteSettings): SiteSettings {
  return {
    ...settings,
    operatorName: settings.operatorName.trim() ? settings.operatorName : "ciba Horizon",
    contactEmail: settings.contactEmail.trim() ? settings.contactEmail : "cibahorizon@gmail.com",
    legal: settings.legal.trim() ? settings.legal : providedLegalDocuments.legal,
    privacy: settings.privacy.trim() ? settings.privacy : providedLegalDocuments.privacy,
    terms: settings.terms.trim() ? settings.terms : providedLegalDocuments.terms,
  };
}

export function hasIncompleteInformation(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\ba\s+(?:completer|renseigner|preciser|definir)\b|\[(?:nom\s+et\s+prenom|fonction|adresse\s+electronique|a\s+completer)[^\]]*\]|\{\{[^}]+\}\}|\bdocument\s+incomplet\b|\btexte\s+tronque\b/i.test(normalized);
}

export function configurationReady(settings: SiteSettings) {
  return settings.operatorName.trim().length >= 2 && !hasIncompleteInformation(settings.operatorName) && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(settings.contactEmail) && [settings.legal, settings.privacy, settings.terms].every((text) => text.trim().length >= 80 && !hasIncompleteInformation(text));
}

export function launchReady(settings: SiteSettings) {
  return settings.launchEnabled && settings.documentsApproved && configurationReady(settings);
}

export function validationReady(settings: SiteSettings) {
  return settings.validationEnabled && settings.operatorName.trim().length >= 2 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(settings.contactEmail) && [settings.legal, settings.privacy, settings.terms].every((text) => text.trim().length >= 80) && settings.validationEmails.trim().length > 0;
}

export function validationAccess(settings: SiteSettings, email?: string) {
  return validationReady(settings) && Boolean(email && settings.validationEmails.split("\n").includes(email.trim().toLowerCase()));
}

export function recruitmentAllowed(settings: SiteSettings, email?: string) {
  return launchReady(settings) || validationAccess(settings, email);
}

export const serviceAnswers = [
  ["Où trouver des offres sur Wutligey ?", "Wutligey est destiné à la recherche d’emploi, de stages et d’alternances au Sénégal. Chaque offre indique sa ville et son type de contrat. Seules les offres actives validées pour publication apparaissent dans les résultats."],
  ["La recherche d’emploi est-elle payante ?", "La consultation des offres et la candidature sur Wutligey sont gratuites pour les candidats. Ne versez pas d’argent à un recruteur pour obtenir un poste."],
  ["Comment postuler à une offre ?", "Créez un compte candidat, confirmez votre adresse e-mail, puis renseignez votre CV en texte ou téléversez un PDF dans votre espace personnel. Ouvrez une offre active et envoyez votre candidature. Vous pouvez suivre son statut dans votre espace candidat."],
  ["Qui peut consulter mon CV ?", "Votre CV n’est pas publié sur le site et il n’existe pas de CVthèque publique. Quand vous postulez, une copie de votre CV et votre adresse e-mail sont transmises au recruteur de cette offre. Modifier votre CV ne modifie pas les copies déjà envoyées. Vous pouvez retirer une candidature depuis votre espace."],
  ["Comment publier une offre au Sénégal ?", "Créez un compte recruteur, confirmez votre adresse e-mail et renseignez votre entreprise. Déposez une offre précise avec sa ville, son contrat, ses missions et une date de fin. Elle reste en attente jusqu’à sa validation par l’administration."],
  ["Que se passe-t-il quand une offre expire ?", "Une offre clôturée ou expirée n’apparaît plus dans les résultats et n’accepte plus de candidatures. Son ancienne adresse indique qu’elle n’est plus disponible."],
] as const;
