# Validation avant ouverture de Wutligey

## État vérifié le 11 octobre 2026

La base d’aperçu a répondu aux lectures. Deux migrations y étaient appliquées et ont été conservées intactes. La migration additive `20261011195032_private_validation_and_legal_review` a été générée pour les contrôles de recette et de validation des documents ; elle reste en attente sur l’aperçu au dernier contrôle et doit être appliquée par le déploiement. Les trois migrations ont été appliquées et testées sur les émulateurs locaux officiels. L’inspection de la branche de production a été refusée avec HTTP 401 ; son schéma et ses migrations restent à vérifier avec les droits nécessaires.

L’API du projet a confirmé que le déploiement de production publié est encore celui du 11 octobre 2026 à 16:38:20 UTC (`6acbbb68fb5a9cbb6a51ff81`). La correction du webhook dans le dépôt ne doit pas être considérée comme publiée sur ce domaine. Une invitation réelle sans erreur 422 doit être vérifiée après le déploiement corrigé.

Les informations confirmées de ciba Horizon et de Mouhamed Bassirou Cisse ont été intégrées aux projets de documents. Les articles 1 à 19 des CGU ont été conservés, l’article 20 et la suite ont été préparés, et une politique de confidentialité correspondant au code a été ajoutée. Les trois pages affichent les projets lorsque les champs enregistrés sont vides, avec un avertissement et une non-indexation tant que la validation est incomplète. Les champs administrateur vides sont préremplis sans écrasement des réglages. La sauvegarde en base nécessite une action explicite de l’administrateur. Les éléments non confirmés figurent dans `docs/points-juridiques-a-valider.md`.

Le domaine de production a répondu HTTP 200 pour l’accueil, l’inscription et les paramètres Identity. Identity y a indiqué que les inscriptions étaient ouvertes et la confirmation automatique désactivée. Les journaux accessibles du déploiement publié et des fonctions sur 24 heures n’ont pas présenté de niveau error/fatal ; cela n’a pas prouvé l’absence de refus de webhook. Le code du webhook a révélé le contrôle prématuré des invitations, car leur date n’est enregistrée qu’après la création initiale de l’utilisateur.

TypeScript, la syntaxe du client et la vérification des espaces dans le diff ont été contrôlés. Les migrations ont été appliquées dans une base locale de test utilisant l’émulateur officiel Netlify. Les essais de recrutement et de fichiers ont utilisé une véritable base locale et le serveur officiel Blobs, avec Identity simulé. Ils n’ont créé aucun compte, aucune offre ni aucun document dans les services de production. L’authentification simulée ne constitue pas un test d’inscription ou de connexion réel sur Identity.

La nouvelle recette privée et les pages juridiques ont été testées dans onze groupes locaux réussis. Chromium a contrôlé les trois pages, leurs liens et le consentement obligatoire non précoché à 1280, 390 et 320 pixels, sans débordement horizontal ni erreur JavaScript. Quatorze assertions ont vérifié la synchronisation des documents intégrés, le préremplissage non destructif et les restrictions de recette. Netlify Dev sur le port 8889 a servi neuf pages HTTP 200, redirigé l’espace privé anonyme et refusé le CV anonyme. Son émulateur de base a reçu les migrations avant le contrôle HTTP final. Les offres de recette publiées sont restées absentes des routes publiques après une ouverture simulée et une désactivation de recette. Aucun résultat local n’a été assimilé à une validation SMTP ou de production.

## Parcours à réaliser sur l’aperçu, puis sur le domaine final

### Administrateur et e-mails

Inviter une adresse réellement contrôlée depuis Netlify Identity. Vérifier l’arrivée de l’e-mail, suivre le lien, définir le mot de passe et vérifier l’absence d’erreur 422. Attribuer le rôle `admin` depuis Netlify Identity uniquement, se reconnecter et ouvrir `/compte`. Vérifier l’annuaire et la configuration. Un premier administrateur ne doit pas être obtenu en envoyant `role=admin` au formulaire.

Enregistrer les projets et informations réelles comme brouillon. Renseigner uniquement les adresses approuvées, activer la recette privée et laisser l’ouverture publique décochée. Aucune attestation de parcours n’est requise pour cette recette. Vérifier les refus hors liste dans l’API et le webhook, la confirmation des e-mails et les autorisations après connexion. Les offres de recette doivent être modérées, accessibles sur `/recette` et absentes du catalogue public, des pages publiques d’offres et des pages entreprises. Elles doivent rester privées après l’ouverture publique. Vérifier qu’une adresse retirée de la liste ne peut plus effectuer la recette. Les opérations de retrait de données restent accessibles à leurs propriétaires. Identity est partagé avec le site ; l’aperçu ne doit pas être supposé indépendant.

Créer un candidat et un recruteur via `/inscription`. Vérifier chaque e-mail de confirmation, l’accès refusé avant confirmation, puis la connexion. Demander un lien depuis `/mot-de-passe`, vérifier son arrivée, choisir un nouveau mot de passe, se déconnecter et se reconnecter. Vérifier les liens expirés ou déjà utilisés. Aucun mot de passe ne doit être communiqué dans une conversation ou enregistré dans un fichier du projet.

### Recruteur et offres

Compléter le profil entreprise, publier une vraie offre de validation, et vérifier qu’elle n’est pas publique avant modération. La valider depuis l’administration. Rechercher l’offre par titre, ville et contrat, consulter la page et la présentation de l’entreprise. Modifier l’offre et vérifier qu’elle retourne en attente et disparaît du catalogue jusqu’à nouvelle validation. Clôturer une offre, puis vérifier l’interdiction des candidatures et la réponse 410 à son ancienne adresse.

### Candidat et documents

Compléter le profil et le CV en texte, puis téléverser un PDF valide de moins de 3 Mo. Vérifier le téléchargement depuis son propre espace. Vérifier les refus des fichiers non PDF et des fichiers trop volumineux. Envoyer une candidature à l’offre validée, vérifier sa présence côté candidat et recruteur et le refus d’un doublon. Télécharger le PDF depuis la candidature reçue, changer son statut et vérifier le suivi côté candidat.

Remplacer le PDF personnel et vérifier que l’ancienne candidature conserve son document initial. Retirer la candidature et vérifier qu’elle disparaît et que son adresse de téléchargement ne donne plus accès au document. Supprimer le PDF personnel et vérifier qu’il n’est plus accessible. Les copies déjà téléchargées par un recruteur hors de Wutligey ne peuvent pas être révoquées par l’application ; cette limite doit être prise en compte dans la politique de confidentialité.

### Autorisations et administration

Utiliser un deuxième recruteur et vérifier qu’il ne peut ni lire les CV reçus par le premier, ni modifier ses offres ou le statut de ses candidatures. Vérifier qu’un candidat et un recruteur ne peuvent pas modifier la configuration, gérer les comptes ni obtenir les droits administrateur depuis des métadonnées de profil. Déconnecté, vérifier la redirection de `/compte` et le refus du téléchargement de CV.

Suspendre un recruteur depuis l’administration et vérifier son accès refusé, ses offres absentes des résultats et leurs adresses publiques indisponibles. Le réactiver et vérifier le retour attendu. Modifier un nom d’entreprise depuis l’administration et vérifier la remise en modération des offres publiées. Vérifier que le compte administrateur ne peut pas être suspendu depuis ce formulaire. Vérifier la suppression d’un compte de test depuis Identity et l’exécution complète de la suppression de ses données et fichiers non référencés.

### Déploiement et persistance

Autoriser le déploiement sur le projet existant après revue. Vérifier l’état réussi, l’application de la nouvelle migration et les abonnements d’événements Identity : `identity_signup` et `identity_userdeleted`. Aucun abonnement `identity_validate` à l’ancien contrôle ne doit rester dans le déploiement publié. S’il existe un ancien webhook manuel configuré en dehors de ce dépôt, le désactiver après vérification de sa provenance ; ne pas supprimer un webhook tiers sans diagnostic.

Vérifier les journaux après chaque parcours. Les messages `identity_signup_configuration_unavailable`, `identity_webhook_failed`, `cv_previous_document_cleanup_failed`, `api_unavailable` et `page_data_unavailable` signalent une intervention nécessaire. Ne pas publier de journaux contenant des données personnelles ou des secrets. Redéployer sur le même site et vérifier que profils, offres, candidatures et documents restent présents. Vérifier aussi le comportement sur téléphone et dans un navigateur déconnecté.

Une fois les essais réels réussis et les informations administratives validées, confirmer leur réalisation et l’ouverture dans la configuration de production. Le message de fermeture disparaît alors. Tant que ces essais, la création du premier administrateur et le déploiement n’ont pas été effectués, la plateforme ne doit pas être présentée comme entièrement opérationnelle.
