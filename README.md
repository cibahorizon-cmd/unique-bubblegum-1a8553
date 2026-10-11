# Wutligey — préparation du lancement au Sénégal

Le site conserve son identité visuelle et publie des pages HTML rendues côté serveur par Netlify Functions. Les liens de navigation, les offres et les entreprises disposent d’adresses normales, accessibles sans exécuter JavaScript. JavaScript intervient uniquement pour les formulaires et les parcours de confirmation de compte.

## Données et comptes

Les profils, offres, candidatures et informations publiques du service sont stockés dans Netlify Database avec Drizzle. Les comptes et mots de passe sont gérés par Netlify Identity ; aucun mot de passe n’est enregistré dans les tables de l’application.

Le schéma se trouve dans `db/schema.ts`. La migration initiale a été générée dans `netlify/database/migrations/` et sera appliquée par Netlify au déploiement. Les modifications ultérieures du schéma doivent également avoir une migration générée avec Drizzle Kit.

Les données de démonstration ne sont pas importées. Le catalogue commence vide. Les profils candidat et recruteur sont distincts ; seul un rôle `admin` attribué dans Netlify Identity permet de modifier les informations publiques et de valider les offres.

## Ouvrir le service

1. Après le déploiement, ouvrir Identity dans le tableau de bord Netlify et inviter le premier administrateur.
2. Accepter l’invitation par e-mail, puis attribuer le rôle `admin` à ce compte dans Identity.
3. Se connecter sur `/connexion` et ouvrir `/compte`.
4. Renseigner le nom réel de l’éditeur, son contact public et les textes de mentions légales, confidentialité et conditions d’utilisation adaptés au service au Sénégal. Faire valider leur contenu si nécessaire.
5. Créer un compte recruteur confirmé, renseigner l’entreprise et proposer de véritables offres. Valider leur publication depuis le compte administrateur.
6. Vérifier la page publique, la candidature, sa réception par le recruteur et son retrait. Vérifier également les e-mails de confirmation, d’invitation et de récupération sur le domaine choisi.
7. Vérifier l’accès anonyme depuis un navigateur déconnecté et avec le test d’URL en direct de Search Console. Le précédent audit a constaté une réponse HTTP 401 sur les adresses publiques ; aucune restriction de plateforme n’a été modifiée par le code.

Les inscriptions publiques, les candidatures et le dépôt d’offres restent fermés tant que les informations du service ne sont pas complètes. Le contrôle d’inscription existe également dans l’événement de validation Identity. Les invitations permettent de créer le premier compte administrateur avant cette ouverture.

## Périmètre initial

Les candidats disposent d’un CV en texte privé, de candidatures suivies et du retrait de leurs candidatures. Les recruteurs disposent d’une présentation d’entreprise, du dépôt d’offres, de leur clôture et de la gestion des candidatures reçues. L’administration gère les informations publiques et la modération.

Les anciennes offres fictives, connexions de démonstration et données métier en localStorage ont été retirées. Les anciens forfaits et paiements fictifs ne sont plus proposés. La CVthèque publique, les pièces jointes, les modèles de CV PDF, les lettres générées, les favoris, les alertes e-mail, la messagerie interne et les candidatures spontanées du prototype ne sont pas inclus dans ce lancement initial ; aucune action ne prétend les exécuter. Aucun abonnement payant n’est actif. Les éventuels tarifs devront être confirmés avant une mise en place de facturation ; les montants salariaux saisis sur les offres sont mensuels, en FCFA (XOF).

## Confidentialité et cycle de vie

Les espaces privés et les API sont servis sans cache et avec une directive de non-indexation. Les recruteurs ne voient que les candidatures envoyées à leurs propres offres. Aucun CV ni e-mail de candidat ne figure dans les pages publiques. Une candidature contient une copie du CV au moment de son envoi ; elle peut être retirée et supprimée par son auteur. La suppression d’un utilisateur depuis Identity déclenche la suppression de ses données métier et, pour un recruteur, de ses offres et candidatures associées. L’administrateur doit vérifier l’exécution de cet événement lors d’une suppression.

Les offres restent privées avant validation, disparaissent des résultats à expiration ou clôture, et leurs anciennes adresses renvoient HTTP 410. Les offres inconnues ou non publiées renvoient HTTP 404. Les pages de filtres et les documents juridiques encore incomplets ne sont pas destinés à l’indexation. Les aperçus sont marqués non indexables lorsque Netlify fournit le contexte de déploiement.

## Développement et vérification

Installer les dépendances avec `npm install`. Utiliser `npm run check` pour vérifier TypeScript et `node --check client/app.js` pour vérifier la syntaxe du client.

Le déploiement exécute automatiquement le script de préparation déclaré dans `netlify.toml` : il copie la page HTML de secours dans le répertoire public et regroupe le client Identity dans un fichier JavaScript. La fonction de rendu a priorité sur la page statique à l’accueil.

Le serveur de développement Netlify utilise le port prévu pour cet environnement : `/opt/buildhome/node-deps/node_modules/.bin/netlify dev --port 8889`. Une base et les migrations appliquées sont nécessaires pour tester réellement les parcours métier. Aucun build n’a été exécuté manuellement pendant cette intervention.
