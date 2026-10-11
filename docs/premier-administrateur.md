# Premier administrateur et validation réelle de WutLigey

## Situation vérifiée le 11 octobre 2026

L’API Netlify a encore indiqué le déploiement de production publié à 16:38:20 UTC, antérieur aux corrections du webhook. Les corrections du dépôt ne doivent pas être considérées comme actives sur le domaine public avant vérification du nouveau déploiement. Le contrôle de la base de production a été refusé avec HTTP 401 pendant l’inspection précédente ; les migrations de cette branche restent à vérifier avec les droits du propriétaire.

Les projets juridiques intégrés au code ne sont pas des réglages enregistrés. Ils sont accessibles comme versions non validées sur les trois pages légales et proposés dans les champs administrateur vides, avec l’identité et le contact fournis. Ils sont sauvegardés en base uniquement lorsque l’administrateur enregistre le formulaire. La fin des CGU et la politique de confidentialité ont été préparées à la demande de l’exploitant ; les champs non confirmés et les mesures correspondantes restent à valider.

## 1. Vérifier le déploiement corrigé sur le site existant

Dans Netlify, ouvrir le projet `unique-bubblegum-1a8553`, sans créer un autre site. Lorsque les corrections sont présentes sur la branche de production du dépôt, lancer le déploiement correspondant dans l’interface Netlify et vérifier son état réussi. Ne pas promouvoir aveuglément un aperçu utilisant une base d’aperçu.

Dans la base de production, vérifier les migrations appliquées et la présence des colonnes attendues par le code, notamment `launch_enabled`, `suspended`, `cv_key`, `cv_name`, `documents_approved`, `validation_enabled`, `validation_emails` et `validation_only`. Les deux migrations déjà appliquées doivent rester intactes ; la migration additive `20261011195032_private_validation_and_legal_review` ajoute les contrôles de recette et de documents. Aucune réinitialisation, suppression de table ou suppression de compte existant n’est nécessaire.

Vérifier que la fonction Identity publiée utilise les événements `identity_signup` et `identity_userdeleted`, et non l’ancien contrôle `identity_validate`. Si l’invitation renvoie encore 422, consulter les journaux de cette invitation et les webhooks Identity configurés. Ne pas supprimer un webhook tiers sans vérifier sa provenance. Ne jamais partager un jeton ou un lien d’invitation complet dans un journal ou une conversation.

## 2. Créer manuellement le premier administrateur

1. Depuis l’interface Netlify du projet existant, ouvrir Identity et inviter une adresse dont le responsable contrôle réellement la boîte de réception. Le contact public n’est pas automatiquement une désignation d’administrateur.
2. Vérifier que l’invitation n’a pas renvoyé 422 et que le compte est apparu dans Identity. Si une invitation existe déjà, utiliser sa relance plutôt que créer inutilement un compte en doublon.
3. Ouvrir la boîte de réception et les courriers indésirables, puis accepter l’invitation reçue. Définir un mot de passe personnel d’au moins douze caractères. Ne communiquer ce mot de passe à personne.
4. Dans la fiche de cet utilisateur dans Netlify Identity, attribuer manuellement le rôle exact `admin`. Ne pas mettre ce rôle dans les métadonnées utilisateur ni dans le formulaire d’inscription public.
5. Se déconnecter puis se reconnecter par `/connexion`. Ouvrir `/compte` et vérifier l’affichage de l’administration, de l’annuaire et de la configuration.
6. Vérifier qu’un candidat ou un recruteur ordinaire n’a pas accès aux fonctions administrateur. Conserver la confirmation automatique des e-mails désactivée.

## 3. Enregistrer les informations du service sans ouvrir au public

Confirmer le nom d’éditeur et le contact proposés. Les trois projets sont proposés automatiquement dans les champs vides, sans remplacer les textes déjà sauvegardés. Compléter et relire les documents et vérifier les mesures correspondantes avant de cocher leur validation définitive. Les coordonnées de l’hébergeur, la conservation, les transferts et les formalités restent notamment à vérifier. Les déclarations de références administratives non applicables ne constituent pas un avis juridique.

Enregistrer comme brouillon en laissant l’ouverture publique décochée. Vérifier après rechargement que les valeurs enregistrées sont conservées. Ne pas insérer de texte fictif pour contourner les contrôles de longueur ou d’incomplétude.

## 4. Vérifier les e-mails et les parcours avec des comptes contrôlés

La réception réelle de l’invitation, de la confirmation d’inscription et de la récupération de mot de passe doit être constatée dans les boîtes de réception concernées. La présence d’un compte dans Identity ou un résultat de test simulé ne suffit pas. Vérifier aussi les liens expirés et déjà utilisés.

Le protocole détaillé figure dans `docs/validation.md` : profil candidat, PDF privé, profil entreprise, annonce en attente puis modérée, candidature, suivi, refus d’accès entre comptes et persistance après redéploiement. Utiliser uniquement des données et documents de validation autorisés.

Le formulaire permet maintenant d’activer la recette privée indépendamment de l’ouverture publique et sans attester de parcours non réalisés. Indiquer uniquement les adresses approuvées, enregistrer les projets de documents, puis activer cette recette. Les participants s’inscrivent avec ces adresses et confirment leurs comptes ; les offres déposées avant ouverture sont marquées comme privées, modérées par l’administrateur et consultables sur `/recette`. Vérifier les refus pour une adresse hors liste, les permissions sur les CV, puis désactiver la recette ou retirer les adresses après les essais. Les offres de recette ne deviennent jamais publiques automatiquement. Identity étant partagé avec le site, l’aperçu ne doit pas être considéré comme un environnement d’inscription totalement isolé.

## 5. Ouvrir seulement après validation

Après les essais réellement réussis et la configuration relue, confirmer l’ouverture depuis l’administration de production. Vérifier que les inscriptions, les publications et les candidatures sont effectivement disponibles et que le message de pré-lancement disparaît en conséquence. Contrôler les journaux après chaque parcours. Une fonctionnalité non testée doit rester signalée comme non validée.
