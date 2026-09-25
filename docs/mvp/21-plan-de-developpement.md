# Plan et stratégie de développement — du socle au premier usage

> **Date :** 2026-09-25 · **Rédigé par :** Claude Code, à la demande du fondateur
> **Public :** le développeur (ou l'agent `dev-react-node`) qui démarre le produit réel sur `main`.
> **Statut :** proposition de séquence et de méthode. La séquence relève de `chef-de-projet` ; les
> choix marqués **« à valider (architecte) »** relèvent d'`architecte` ; les écarts du §3 relèvent
> de l'arbitre indiqué. Ce document ne modifie aucune décision de `CLAUDE.md` §13.
> **Ce document ne remplace aucune spécification.** Il dit dans quel ordre construire, comment
> vérifier, et ce qui manque encore pour coder. En cas d'écart, `CLAUDE.md` puis `docs/mvp/00` à
> `20` font foi, et c'est ce plan qui est corrigé.

---

## 0. L'essentiel

**Premier usage à livrer.** Une marque et un créateur créent chacun un compte INFLUX réel (e-mail →
code à 6 chiffres → informations complémentaires), et chaque inscription devient un **contact Brevo**
(sous 1 h — le consentement étant obligatoire pour créer un compte, D63) et, quand la configuration l'autorise, un **contact Apollo** (sous 24 h).
Une panne de Brevo ou d'Apollo n'empêche jamais une inscription (`05` RG72).

**Deux niveaux de « prêt », à ne pas confondre :**

| Niveau | Ce qui est vrai | Dépend de |
|---|---|---|
| **Prêt en `staging` (démontrable)** | Les deux inscriptions fonctionnent sur `staging` avec des données synthétiques ; le worker traite la file en `dry_run` ; un essai manuel depuis le poste de développement crée de vrais contacts dans les **comptes Brevo et Apollo de test** (D62) | Le développement seul (fin du jalon J6) |
| **Prêt en production (ouvert au public)** | Idem en production, avec désinscriptions dans les deux sens, backoffice de supervision, surveillance active, documents légaux | J7 à J9 **et** des portes non techniques : société créée (D25), validation du juriste sur Apollo (D33), CGU (D29), domaines d'envoi authentifiés (§5.8) |

**Le chemin : dix jalons.**

| Jalon | Lot | Contenu | À la fin, on peut montrer | Durée |
|---|---|---|---|---|
| **J0** | 0 | Poste, dépôt, intégration continue | `pnpm check` tourne en CI | 1 j |
| **J1** | 0 | Squelette `apps/api`, `apps/backoffice`, `packages/contracts`, passe-plat | Les quatre processus démarrent, `/health` répond | 3 j |
| **J2** | 0 | Base socle : schémas, rôles, RLS, registre, tests T2 T3 T4 T6 T16 | `supabase db reset` depuis zéro, tests de droits verts | 4-5 j |
| **J3** | 0 | Authentification : code membre (D43), sessions opaques, backoffice mot de passe + TOTP | Un compte de démonstration par rôle se connecte réellement | 4-5 j |
| **J4** | 0 | `staging` sur Railway + Supabase, migrations par la CI, collecte d'erreurs (D60) | Déploiement automatique sur `staging` | 3-4 j |
| **J5** | 1 | Inscription marque et créateur, transaction unique, file alimentée | Deux comptes réels créés sur `staging` | 4-5 j |
| **J6** | 1 | Worker, connecteurs Brevo et Apollo, qualification, garde-fous | **Premier usage démontrable** | 4-5 j |
| **J7** | 1 | Retours Brevo (désinscriptions, rebonds), espace membre minimal | Un retrait de consentement fait le tour complet | 3-4 j |
| **J8** | 1 | Backoffice v0 : inscrits, états de synchronisation, rejeu, réglages Apollo | Le commercial pilote la file sans le développeur | 4-5 j |
| **J9** | 1 | Sortie du mode maquette de la landing, en-têtes, surveillance active, production | Prêt technique pour la mise en ligne | 4-5 j |

**Calendrier indicatif** — un développeur à plein temps, démarrage le lundi 2026-09-28, hors jours
fériés :

| Étape | Jours ouvrés cumulés | Fin au plus tôt | Fin probable |
|---|---|---|---|
| Lot 0 livré (J0 à J4) | 15 à 18 | 2026-10-16 | 2026-10-21 |
| **Premier usage démontrable en `staging`** (J6) | 23 à 28 | 2026-10-28 | 2026-11-04 |
| Lot 1 prêt pour la mise en ligne (J9) | 34 à 42 | 2026-11-12 | 2026-11-24 |

> **Écart assumé avec le cadrage.** `00` §7 annonce 1-2 semaines pour le Lot 0 et 3-4 pour le Lot 1.
> Ce plan compte plutôt **3 semaines puis 4** : depuis le cadrage, le Lot 0 a reçu les dix points
> bloquants de la revue de sécurité (`03` §9.1) et la collecte de surveillance interne (D60, 3 à
> 5 jours selon `02` §20.10). La mise en ligne dépend donc d'une **société créée vers la mi-novembre**,
> et non en semaine 5.

**Cinq règles qu'aucune urgence ne suspend.**

1. **Aucune donnée réelle avant que le socle de sécurité soit en place** (B1 à B10, `03` §9.1). On
   construit la tranche verticale *sur* le socle, jamais à côté.
2. **Le code de connexion suit le contrat de `02` §18.10 à la lettre** : envoi synchrone, une seule
   tentative, plancher de 1 000 ms, aucun appel externe sous transaction, jamais dans
   `outbox_events`.
3. **Tout ce qu'un juriste ou le fondateur peut encore changer est une configuration, jamais une
   constante** : périmètre et base légale Apollo, pays de prospection, pays bloqués, calendrier de
   réessais, plafonds de débit (`05` Q1 à Q4).
4. **Aucun test automatisé n'appelle un service externe réel** (`18` §1.3, `16` RG148). Les vrais
   appels ne se font qu'à la main, depuis le poste de développement, vers les comptes de test (D62).
5. **Un écart de spécification découvert en codant arrête le code** : on le consigne, on le fait
   trancher, on corrige la spécification, puis on code (§3).

---

## 1. Point de départ (état au 2026-09-25)

| Élément | État | Conséquence pour le développeur |
|---|---|---|
| `main` | Landing (`apps/web`), spécifications (`docs/`), outillage (`.claude/`), `apps/api/.env.example` | Le produit réel part de zéro (D44). **Ne jamais copier un fichier de la branche `demo`** |
| `apps/web` | Next.js 16, next-intl, Tailwind v4, tokens, gardes G1 à G7 (`tests/guards.test.ts`), formulaire de démonstration en trois étapes (`StartFormSection`), constante `IS_MOCKUP = true` | Socle front conservé ; le formulaire et le module fictif disparaissent au J9 (`02` §13) |
| `apps/api`, `apps/backoffice`, `packages/contracts` | **Dossiers non suivis** : seulement des `node_modules` et des fichiers générés, restes de la maquette | À supprimer au J0 avant de créer les vrais paquets |
| `.env` à la racine et `apps/api/.env` | Fichiers de la maquette (ignorés par Git) | Ne jamais les lire depuis le produit réel ; le chargeur de configuration ne lit que `apps/api/.env.local` |
| `apps/api/.env.local` | Présent, toutes les variables de `.env.example` renseignées (valeurs non lues pour ce plan) | Voir §2.3 : pile locale recommandée par défaut |
| Outils du poste | Node 22.22, pnpm 11.27 présents ; **Docker, CLI Supabase, `gh`, `psql` absents** | À installer au J0 : sans Docker, pas de base jetable, donc pas de tests de droits (`18` §9.3 A-1) |
| Comptes externes | GitHub (dépôt `cdurbal/influx`), Supabase, Brevo, Apollo créés ; Railway à confirmer | Rien n'est encore configuré ni branché (`CLAUDE.md` §8) |
| Intégration continue | Aucun workflow (`.github/` absent) | Créée au J0 |

---

## 2. Stratégie de développement

### 2.1 Principes

1. **Les spécifications font foi, la maquette jamais.** Chaque tâche cite la règle qu'elle
   implémente (`05` RG44, `03` A-9…). Une règle introuvable est un écart (§3), pas une liberté.
2. **Socle sécurisé d'abord, puis tranche verticale fine, puis élargissement.** Le premier usage est
   rendu démontrable le plus tôt possible (J6), puis durci (J7 à J9). On ne soigne pas les écrans
   avant que le flux complet passe.
3. **La base est l'arbitre.** Contrainte, clé étrangère, déclencheur et politique RLS avant tout
   contrôle applicatif (`04` §1, R1). Une règle qui n'existe que dans `apps/api` sera contournée par
   le premier script.
4. **Chaque migration contient sa table, ses droits, ses politiques et son test** (`04` §11.1). Une
   table sans ligne dans la matrice de `03` fait échouer la CI (T2) : on déclare avant de créer.
5. **Configuration en table, lue au moment de l'usage** (`leads.sync_settings`,
   `backoffice.sla_policies`) : une décision juridique se bascule sans redéploiement.
6. **`staging` d'abord, production sur accord explicite du fondateur**, toujours.
7. **Petits commits, fréquents, sur `main`** (dérogation du 2026-09-17), en *Conventional Commits*,
   en anglais.

### 2.2 Pourquoi le socle avant la tranche verticale

La tentation serait de brancher un formulaire sur Supabase et Brevo en deux jours. C'est exactement
ce que la maquette a fait, et c'est pourquoi elle est jetable. Trois éléments du socle ne se
rattrapent pas après coup :

- **les rôles Postgres et la RLS** (B1 à B3) : ajoutés après, ils imposent de reprendre chaque
  requête et chaque test ;
- **le registre chaîné et les acceptations de CGU** : une inscription enregistrée sans version de
  CGU est une clause de non-contournement perdue pour toujours (`05` §Besoin, point 3) ;
- **les sessions opaques révocables** (B4) : un jeton autoportant ne se révoque pas.

Le socle coûte trois semaines ; la tranche verticale qui s'y appuie ne coûte ensuite que deux
jalons (J5, J6).

### 2.3 Les quatre environnements

| | Poste local | Intégration continue | `staging` | `production` |
|---|---|---|---|---|
| **Base** | Pile Supabase locale (`supabase start`, Docker) : Postgres **et** GoTrue | Pile Supabase locale jetable, recréée à chaque exécution | Projet Supabase `staging` (UE) | Projet Supabase `production` — région après D25, restauration à un instant donné (D57) |
| **Données** | `supabase/seed` + saisies synthétiques | `supabase/seed` | `supabase/seed` **seul** (B9) | Réelles |
| **Brevo** | Doublure par défaut ; essai manuel en `BREVO_MODE=redirect` avec le compte de test (D62) | Doublure (`16` RG148) | `disabled` ou `redirect`, compte de test | `live`, compte de production, trois sous-domaines authentifiés |
| **Apollo** | Doublure ; essai manuel en `SYNC_MODE=live` avec le compte de test et la liste blanche | Doublure | **Aucune clé** (`skipped_no_credentials`) | `live` après validation du juriste (D33) |
| **Accès** | — | — | Protégé + `noindex` (I-6) | Public (web) ; backoffice sur sous-domaine dédié |

> **Recommandation (à valider, architecte).** `.env.example` prévoit que `apps/api/.env.local` porte
> les valeurs de `staging`. Pour le travail quotidien et les tests, pointer plutôt vers la **pile
> locale** : remise à zéro en une commande, aucune donnée partagée, GoTrue réel (on vérifie son
> comportement au lieu de le supposer). Les valeurs `staging` vont dans un second fichier ignoré
> (`apps/api/.env.staging.local`) pour les vérifications ponctuelles.

**En local, le code de connexion arrive par e-mail réel** : `BREVO_MODE=redirect` avec le compte
Brevo de test et `BREVO_TEST_RECIPIENTS` réglé sur l'adresse du développeur (`16` RG115 et RG117).
Aucune « porte de développement » n'affiche le code : il ne doit apparaître dans aucun journal
(`05` RG52). Dans les tests automatisés, c'est la doublure Brevo qui restitue le message au harnais.

### 2.4 Stratégie de test

Référence : `18` (plan de test) et `03` §8 (T1 à T19). Ce tableau dit **où** chaque famille vit.

| Niveau | Outil *(à valider, architecte)* | Contenu | Quand |
|---|---|---|---|
| Unitaire | Vitest | Fonctions pures : normalisation de l'adresse, schémas zod, phrase de correspondance, calendrier de réessais, qualification Apollo, mapping Brevo et Apollo, classement des erreurs | Chaque commit |
| Base de données | Vitest + harnais de rôles (`packages/test-kit`, `18` A-2) sur la pile locale | T2 (matrice déclarée), T3, T4, T6, T16, contraintes | Chaque commit |
| Intégration API | Vitest + `fastify.inject()` + pile locale + doublures | Demande et vérification du code, inscription, worker, T8, TM1, T17 | Chaque commit |
| Contrat des connecteurs | Doublures à échanges enregistrés, expurgés de tout secret (`16` RG148) | Mapping réel, `4xx`, `5xx`, `429`, idempotence | Chaque commit |
| Gardes structurelles | ESLint + tests de garde | Imports interdits, `process.env`, `react/no-danger`, tokens, parité FR/EN | Chaque commit |
| Bout en bout | Playwright (`18` A-5) | Un parcours nominal par porte, un parcours négatif | Avant chaque déploiement `staging` |
| Planifié | Workflow hebdomadaire et nocturne | T12 (dépendances), mesure chronométrée de la demande de code (`18` C-2) | Hebdomadaire / nocturne |

**GoTrue n'est pas doublé** : la pile locale le fournit, et plusieurs règles reposent sur son
comportement réel (un nouveau code invalide le précédent, durée de 10 minutes — `02` §18.7). Ce
sont des tests, pas des hypothèses.

**Budget de durée de la CI : 10 minutes** (`18` A-4). La matrice T2 s'exécute en transactions
annulées regroupées, pas en un test par assertion.

### 2.5 Discipline de dépôt et définition de « terminé »

Un jalon est terminé quand **toutes** ces conditions sont réunies :

- [ ] `pnpm check` vert en local et en CI (format, types, lint, tests, build) ;
- [ ] les tests exigés par le jalon passent trois fois de suite (aucun test instable, `18` §1.3) ;
- [ ] chaque écart rencontré est consigné au §3, tranché par son arbitre, et **la spécification
      concernée est corrigée** (décision structurante : `CLAUDE.md` §13 aussi) ;
- [ ] toute migration touchant `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction
      `SECURITY DEFINER` ou un attribut de rôle porte le marqueur `security-reviewed: <date>` dans son
      message de commit, vérifié par la CI (`03` I-4) — tant que le fondateur n'a pas levé la
      dérogation sur `supabase/migrations/**` (F-4) ;
- [ ] toute variable nouvelle est documentée dans le `.env.example` concerné (skill `env-secrets`).

**Agents et skills à solliciter**, dans l'esprit de `00` §7 : `architecte` (J1, choix de
dépendances), `expert-database` + skill `supabase-schema` (J2, chaque migration),
`expert-cybersecurite` (fin de J2, J3 et J9 — veto), `expert-integrations-api` + skills
`lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` (J6, J7), `expert-ux` + skill
`design-system-influx` (J5, J8), `testeur` + skill `test-strategy` (fin de chaque jalon),
`integrateur` + skills `railway-deploy`, `env-secrets` (J0, J4, J9).

### 2.6 Dépendances à faire valider par `architecte` au J1

Toutes en **version exacte** (`savePrefix: ""`), publiées depuis plus d'un jour
(`minimumReleaseAge`), et **documentation de la version installée lue avant usage** (`02` §15,
règle 15).

| Besoin | Proposition | Remarque |
|---|---|---|
| Schémas partagés | `zod` | Source unique : validation d'entrée, filtre de sortie, types (`02` §9.1) |
| Serveur | `fastify` 5 + `@fastify/cookie` + `fastify-type-provider-zod` | Le sérialiseur de réponse retire tout champ non déclaré (`02` §2.5, point 4) |
| Accès aux données | `drizzle-orm` + pilote `postgres` (`prepare: false`) | D5 ; `drizzle-kit push` interdit |
| Auth et Storage | `@supabase/supabase-js`, importé **uniquement** dans `apps/api/src/platform/supabase.ts` | D5, règle 2 |
| Journaux | `pino` (intégré à Fastify) avec masquage des champs sensibles | `02` §20.8 |
| Construction de `apps/api` | `tsup` (esbuild, déjà autorisé dans `allowBuilds`), deux entrées `main` et `worker`, paquets de l'espace de travail intégrés au bundle | Évite de construire `packages/contracts` à part ; les fronts le consomment par `transpilePackages` |
| Bout en bout | `@playwright/test` | `18` A-5 |
| CLI Supabase | Installation système (Scoop sous Windows) ou dépendance de développement `supabase` autorisée dans `allowBuilds` | La version doit être la même en local et en CI |

---

## 3. Écarts à trancher avant ou pendant le code

Relevés en croisant `02`, `03`, `04`, `05`, `16`, `17` et `18`. Chacun **bloque le jalon indiqué** ;
la proposition est une hypothèse de travail, pas une décision.

| # | Écart | Proposition | Arbitre | Bloque |
|---|---|---|---|---|
| **EC-1** | **Rôles Postgres incohérents.** `04` §3.2 crée `influx_service` et rend `influx_app` membre de tous les rôles ; `02` §5 et `03` P7 imposent `influx_app` membre des seuls quatre rôles métier, et une **seconde grappe** avec `influx_auth`, `influx_worker`, `influx_privacy` ; `03` P8 ajoute `influx_audit_writer`, D60 ajoute `influx_ops` | Suivre `03`, qui fait foi. **Un rôle de connexion élevé par service** : celui de `api` n'est membre que d'`influx_auth`, celui du `worker` d'`influx_worker` (puis `influx_privacy` au Lot 5) — le processus HTTP ne peut alors jamais emprunter les droits du worker. Corriger `04` §3.2 et le commentaire d'`ELEVATED_DATABASE_URL` dans `.env.example` | `expert-cybersecurite` (veto) + `expert-database` | J2 |
| **EC-2** | **Aucune table de sessions** dans `04`, alors que la session opaque révocable est bloquante (A-9, B4) | `identity.sessions` : empreinte SHA-256 de l'identifiant (le cookie porte la valeur brute), compte, surface (`member` · `backoffice`), `aal`, création, dernière activité, expiration glissante (30 j membres, 8 h / 30 min backoffice), plafond absolu de 180 j, `revoked_at` et motif, navigateur résumé, pays approximatif | `expert-database` + `expert-cybersecurite` | J3 |
| **EC-3** | **Cinq tentatives par code** (`05` RG42, A-2) sans support : `identity.auth_request_throttle` ne connaît que les portées `email` et `ip` | Portée supplémentaire `login_request`, dont la clé est l'identifiant de la ligne `leads.transactional_sends` porté par le cookie de parcours. Au cinquième échec, régénérer un code **sans l'envoyer** pour invalider le précédent — comportement GoTrue à vérifier | `expert-cybersecurite` | J3 |
| **EC-4** | **L'état « code vérifié, compte non créé »** (`05` RG5) n'a pas d'objet | Jeton d'inscription signé (cookie `__Host-`, `httpOnly`, 30 min) portant `auth_user_id`, adresse et porte. Le compte n'existe qu'à la validation de l'écran 3. Le brouillon de l'écran 3 reste en mémoire : le stockage navigateur est interdit par ESLint (`02` §13.2) | `expert-cybersecurite` | J3 |
| **EC-5** | **Opérations de pré-authentification non nommées.** `03` P7 définit E-2 comme « vérification du code, création du compte au premier passage », or le compte naît à l'écran 3 ; le canal de secours (`05` RG65) et la connexion du backoffice écrivent aussi sans session | Rattacher explicitement la finalisation de l'inscription et la connexion du backoffice à **E-2**, le canal de secours à **E-1** (même rôle `influx_auth`), par une révision signée de `03` P7 plutôt que par une nouvelle opération | `expert-cybersecurite` (liste fermée signée) | J3, J5 |
| **EC-6** | `leads.transactional_sends.template_ref` référence `backoffice.email_templates`, table du **Lot 5**, alors que le journal naît au Lot 1 (migration `0108`) | Colonne texte sans clé étrangère jusqu'à `0503` ; codes de modèles en union fermée dans `packages/contracts` (`16` RG85) | `expert-database` | J3 |
| **EC-7** | `transactional_sends.outbox_event_id` est un `uuid` qui référence `outbox_events(id)`, un `bigint` | Type `bigint` | `expert-database` | J3 |
| **EC-8** | **Clés de `leads.sync_settings`** (`04` §5.8) incomplètes et contradictoires avec `05` : pas de liste de pays bloqués à l'inscription (RG8) ; `apollo_blocked_countries` est une liste de **blocage** alors que RG84 exige une liste d'**autorisation**, vide par défaut | Clés : `apollo_scope`, `apollo_legal_basis` (valeur par défaut `consentement_requis`, surcharge par pays), `apollo_prospecting_countries` (autorisation, **vide**), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, et les identifiants de listes et de modèles Brevo | `expert-database` + `expert-integrations-api` | J5, J6 |
| **EC-9** | **Calendrier de réessais** : 6 tentatives dans `02` §6, 10 dans `05` RG79 (et `attempts <= 10` dans `04`) | Valeur de départ de `retry_schedule` = `05` RG79 | `architecte` | J6 |
| **EC-10** | **Événements émis à l'inscription** : `05` RG73 prévoit `consent.granted` « à l'inscription » en plus de `lead.created` ; `18` §10 attend « quatre lignes de file » | À l'inscription, `lead.created` seul : trois lignes (`brevo_contact`, `apollo_contact`, `brevo_transactional` pour la bienvenue) — le consommateur relit le consentement (RG37) ; `consent.granted` et `consent.revoked` pour les changements ultérieurs. Corriger `18` en conséquence | `product-owner` + `testeur` | J5 |
| **EC-11** | **D54 et D55 non modélisées** : ni table des invitations, ni colonnes de source d'acquisition (`04` §12.11, points 9 et 10) ; le mapping Brevo `16` §M4 n'a pas les attributs UTM exigés par `05` RG122 | Colonnes figées sur `identity.accounts` (J5), table des invitations (J8), attributs `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `REFERRER_DOMAIN`, `HEARD_FROM` ajoutés à `16` §M4 | `expert-database` + `expert-conformite-rgpd` (veto) | J5, J8 |
| **EC-12** | **Aucun chemin pour le webhook Brevo.** `apps/api` n'a pas d'hôte public (`02` §12) ; le passe-plat ne relaie qu'une liste blanche d'en-têtes (PP-5) qui exclut l'en-tête du jeton (`16` RG146) ; la table qui stocke l'événement brut avant traitement (RG147) n'existe pas | Chemin borné `/api/v1/webhooks/brevo/<jeton>` relayé par le passe-plat de `apps/web`, avec l'en-tête du jeton ajouté à la liste blanche **pour ce seul chemin** ; contrôle des plages d'adresses IP dans `apps/api` sur `x-forwarded-for` réécrit (PP-6) ; table d'événements entrants en ajout seul, consommée par le worker | `architecte` + `expert-cybersecurite` (veto) | J7 |
| **EC-13** | Le Lot 0 promet « un compte de démonstration par rôle se connecte réellement dans les trois espaces » (`00` §7), mais `02` §13.3 et `18` §10 interdisent de lever une garde de `apps/web` au Lot 0 — or la connexion membre passe par le passe-plat, donc par la levée de G5 | Lever G5 au J1, **dans le commit qui introduit le passe-plat et sa garde de liste blanche** (la règle « une garde ne tombe qu'avec son remplaçant » est tenue). G1, G2, G4 et G6 attendent le J9 | `architecte` + `testeur` | J1 |
| **EC-14** | « Mes données » (export, suppression) figure dans l'espace du Lot 1 (`05` RG57, RG71), mais l'exécution des demandes RGPD est au Lot 5 (E-5, `backoffice.data_subject_requests`) | Au Lot 1 : dépôt de la demande depuis l'espace membre, accusé de réception, exécution manuelle par un administrateur selon une procédure écrite ; table avancée au Lot 1 si nécessaire | `chef-de-projet` + `expert-conformite-rgpd` (veto) | J7 |
| **EC-15** | `02` §7 et `04` §13 renvoient à `AccountForm.tsx`, qui n'existe plus sur `main` ; le formulaire en trois étapes de la landing ne correspond pas au parcours réel ; les boutons pointent vers `/signup`, `/login`, `/signup/advertiser`, `/signup/creator` alors que `17` §2.6 fixe des chemins localisés | Écrans écrits d'après `17` §3. Chemins des portes à fixer (par exemple `/fr/inscription/marque` · `/en/signup/brand`) ; « Me connecter » ouvre l'écran 1 précédé du choix de porte ; la section formulaire de la landing devient un renvoi vers les deux portes (tests `TM10` adaptés) | `expert-ux` + `product-owner` | J5, J9 |
| **EC-16** | Les points d'accès publics de Supabase Auth restent joignables avec la clé *publishable*, qui n'est pas un secret : inscription publique, envoi natif d'un code par GoTrue | Désactiver l'inscription publique (l'API d'administration reste utilisable), ne configurer aucun envoi d'e-mail natif de GoTrue, et **vérifier par un test** qu'aucun envoi ni aucune création d'utilisateur n'est déclenchable sans `apps/api` | `expert-cybersecurite` | J3 |
| **EC-17** | **Codes de secours du second facteur** (MFA-3) : à vérifier si Supabase Auth les fournit | S'ils n'existent pas nativement : table dédiée, codes hachés, usage unique, génération journalisée, consommation alertée (MFA-4) | `expert-cybersecurite` + `expert-database` | J3 |
| **EC-18** | **Variables absentes de `.env.example`** : secret interne du passe-plat (`x-influx-internal`, PP-8), poivre des empreintes de débit (`04` §12.10, point 4), destinataires de secours des alertes de disponibilité (D60) ; aucun `.env.example` pour `apps/web` et `apps/backoffice` (`INFLUX_API_INTERNAL_URL`) | Les ajouter, avec valeurs factices, dans le commit qui les utilise | `integrateur` + `expert-cybersecurite` | J1, J3 |

---

## 4. Lot 0 — le socle (J0 à J4)

### J0 — Poste, dépôt et intégration continue (1 jour)

1. Installer **Docker Desktop** (moteur WSL 2), la **CLI Supabase**, **GitHub CLI** ; en option la
   CLI Railway et `psql`.
2. Supprimer les restes de la maquette : `apps/api/node_modules`, `apps/backoffice/` (entier),
   `packages/contracts/node_modules` ; laisser ou supprimer `.env` et `apps/api/.env` (ignorés,
   jamais lus par le produit réel).
3. Créer `.github/workflows/ci.yml` : installation (`corepack enable`, `pnpm install
   --frozen-lockfile`), `pnpm check`. Workflow hebdomadaire vide, prêt pour T12.
4. **Fondateur** : second facteur activé sur GitHub, Supabase et Railway ; nombre de personnes
   ayant accès limité (`03` F-3). Trancher F-4 (dérogation sur `supabase/migrations/**`).

**Terminé quand** : la CI tourne sur `main` et reste verte sur l'état actuel.

### J1 — Squelette des applications et des contrats (3 jours)

1. **`packages/contracts`** (`@influx/contracts`) : `errors.ts` (union fermée des codes et
   enveloppe `{ error: { code, message, details, requestId } }`, `02` §9.2), `common.ts` (langue
   `fr` · `en`, pays ISO 3166-1, pagination par curseur), `elevated-operations.ts` (union fermée
   E-1 à E-5, `03` P7), dossier `identity/` vide prêt pour J3.
2. **`apps/api`** (`@influx/api`) :
   - `src/config/` : schéma zod des variables, **échec au démarrage** si une variable manque ;
     refus de démarrer si `BREVO_MODE=live` hors production ou `SYNC_MODE=dry_run` en production
     (`02` §12.4, `16` RG116) ; lecture de `.env.local` en développement seulement ;
   - `src/server.ts` : Fastify, identifiant de requête, enveloppe d'erreur sans trace (T13),
     `pino` avec masquage (cookies, `authorization`, corps, adresses, codes) et champ de version
     (`RAILWAY_GIT_COMMIT_SHA`) ;
   - `src/main.ts` : écoute sur `::` (réseau privé Railway en IPv6, `02` §12.1), `GET /health` ;
     `src/worker.ts` : boucle vide qui journalise son mode ; arrêt propre sur `SIGTERM` pour les
     deux ;
   - `src/platform/supabase.ts` : seul point d'import de `@supabase/*` ;
   - vérification de l'en-tête interne `x-influx-internal` sur toute requête hors `/health`
     (PP-8, I-7).
3. **`apps/backoffice`** (`@influx/backoffice`) : Next.js, français seul, sans next-intl (D36),
   `X-Robots-Tag: noindex, nofollow, noarchive` sur **toutes** les réponses, tokens repris de
   `apps/web/src/styles/tokens.css` (copie contrôlée en attendant `packages/ui`), page de connexion
   vide.
4. **Passe-plat** `src/app/api/[...path]/route.ts` dans les deux fronts, avec les conditions PP-1 à
   PP-12 de `03` §6.4 ; **levée de G5 et garde de liste blanche dans le même commit** (EC-13) ;
   `src/server/api-client.ts`, seul module autorisé à appeler le réseau.
5. **ESLint** (`02` §13.2) : imports de `@supabase/*`, `drizzle-orm`, `pg`, `postgres` interdits
   dans les fronts ; `process.env` interdit hors `src/config/` ; `react/no-danger` en erreur dans
   les deux fronts (B10) ; dans `apps/api`, import croisé d'un `repository.ts` d'un autre domaine
   interdit.
6. **Gardes extraites dans un harnais partagé** (`packages/test-kit`) et étendues à
   `apps/backoffice` (G3, G7) (`18` §10, Lot 0).

**Tests** : garde de liste blanche du passe-plat, refus de démarrage sur configuration incohérente
(première moitié de T17), T11 sur les artefacts de construction.
**Terminé quand** : `api`, `worker`, `web` et `backoffice` démarrent en local ; `web` joint
`api` par le passe-plat ; une règle ESLint violée volontairement fait échouer la CI.

### J2 — Base de données socle (4 à 5 jours)

1. `supabase init` ; `supabase/config.toml` : **aucun de nos schémas exposé** par l'API de
   données (P6).
2. Migrations `0001` à `0008` de `04` §11.2, **corrigées selon EC-1** :

   | Fichier | Contenu | Point d'attention |
   |---|---|---|
   | `0001_init_schemas_and_roles` | Schémas par domaine, `influx_app` (connexion, `NOINHERIT`, membre des quatre rôles métier), rôles métier sans connexion, rôles élevés et leurs rôles de connexion par service, `REVOKE ALL` sur `anon` et `authenticated`, `ALTER DEFAULT PRIVILEGES` par schéma | **Aucun `BYPASSRLS`, aucun `SUPERUSER`** (T4). Les mots de passe des rôles de connexion ne sont **jamais** dans une migration : ils sont posés par un script de la CI à partir d'un secret, ou à la main par le fondateur |
   | `0002_influx_helpers` | `current_account_id`, `current_account_role`, `current_aal`, `has_aal2`, `touch_updated_at`, `assert_append_only` | Appel en sous-requête scalaire dans les politiques (`04` §4.1) |
   | `0003_reference_core` | Pays (249), devises avec `minor_unit`, langues | Données de référence = migration, pas seed (`04` §11.1) |
   | `0004_identity_core` | `accounts`, `account_roles` (contrainte D41), commercial responsable, `agent_profiles` (compte de secours), `grant_role()`, **`identity.sessions` (EC-2)** | `FORCE ROW LEVEL SECURITY` en plus d'`ENABLE` (P1) |
   | `0005_identity_terms_and_consent` | `terms_versions`, `terms_acceptances`, `consent_events` | Ajout seul, index de version en vigueur |
   | `0006_audit_chain` | `event_types`, `audit_events`, `chain_checks`, `audit.append()`, ligne de genèse | Irréversible dès la première ligne réelle ; écritures sérialisées par verrou **de transaction** |
   | `0007_billing_commission_rates_empty` | Table **vide**, aucun droit d'écriture applicatif | T16 |
   | `0008_backoffice_ownership` | `ownership_assignments` | — |

3. **Déclaration Drizzle** alignée à la main dans `apps/api/src/db/schema/` (`pgSchema()` par
   schéma) : le SQL fait foi.
4. **`apps/api/src/db/index.ts`** : deux grappes (`DATABASE_URL`, `ELEVATED_DATABASE_URL`),
   `withUserTransaction(request, fn)` — ouvrir la transaction, lire en **une** requête indexée le
   compte, son rôle, sa suspension et la session, `SET LOCAL ROLE influx_<rôle>`, poser
   `request.jwt.claims`, `influx.account`, `influx.role`, `influx.aal`, exécuter, valider — et
   `withElevatedTransaction(operation, fn)`, qui **refuse à l'exécution** toute opération hors de
   l'union fermée et écrit une ligne d'audit (`03` §6.7).
5. **Harnais de rôles** (`packages/test-kit`) : ouvrir, prendre un rôle, poser le contexte,
   exécuter, annuler.
6. **Matrice attendue** de T2 dans un fichier déclaratif dérivé de `03` §3 : toute table de nos
   schémas absente du fichier fait échouer la CI.
7. **CI** : `supabase start`, `supabase db reset` (migrations + seed), mots de passe de test posés,
   tests de base ; contrôle du marqueur `security-reviewed:` (I-4).
8. **À vérifier dans la documentation Supabase** : format de connexion d'un rôle personnalisé au
   multiplexeur (utilisateur suffixé par la référence du projet), requêtes préparées désactivées.

**Tests** : T2 (tables du Lot 0), T3 (ajout seul, altération détectée), T4, T6 (statique : les
appelants de `withElevatedTransaction` égalent la liste), T16 (aucune multiplication d'un montant,
table des taux vide et non inscriptible).
**Terminé quand** : la base se reconstruit depuis zéro en une commande, en local et en CI, et les
cinq familles sont vertes. **Revue `expert-cybersecurite` des migrations avant de poursuivre.**

### J3 — Authentification et sessions (4 à 5 jours)

1. **Réglages GoTrue** (local puis `staging`) : longueur du code 6, validité 600 s, inscription
   publique désactivée et aucun envoi natif (EC-16), second facteur TOTP activé, clés de
   signature asymétriques.
2. **Migration `0108`** avancée du Lot 1 (`04` §11.2 le prévoit « la plus précoce ») :
   `leads.transactional_sends`, `identity.auth_request_throttle`, corrigées selon EC-3, EC-6, EC-7.
3. **`POST /v1/auth/request-code`** : implémentation **littérale** des dix étapes de `02` §18.10
   (plancher de 1 000 ms, deux transactions courtes, création GoTrue inconditionnelle, code obtenu
   par l'API d'administration sans envoi, envoi Brevo unitaire avec `Idempotency-Key`, une seule
   tentative, disjoncteur, cookie de parcours uniquement si `sent`, `200` uniforme). Le connecteur
   d'envoi unitaire est le premier morceau du module Brevo (§5.4).
4. **`POST /v1/auth/verify-code`** : vérification GoTrue, compteur de tentatives (EC-3), puis
   routage de `05` RG66 à RG69 et de `17` §2.5 — compte membre : session opaque (EC-2) et cookie
   `__Host-influx-session` ; compte interne : aucune session, message ; compte suspendu : aucune
   session ; adresse inconnue : jeton d'inscription (EC-4). **Le jeton GoTrue n'est qu'une preuve
   ponctuelle** : la session est la ligne en base (`03` §6.2).
5. **Session** : renouvellement silencieux, `POST /v1/auth/logout`, révocation immédiate à la
   suspension (A-9).
6. **Backoffice** : comptes créés par invitation d'un administrateur ou par script d'amorçage,
   jamais par inscription ; mot de passe de 12 caractères minimum vérifié contre les mots de passe
   compromis (B-1) ; inscription du TOTP **imposée avant tout accès** (B-2) ; `aal2` exigé par
   `apps/api` et par les politiques ; cookie `__Host-influx-ops-session` en `SameSite=Strict`,
   8 h, 30 min d'inactivité ; codes de secours (EC-17).
7. **Compte de secours** (B7, MFA-10) et alerte `internal.critical_alert` à chaque connexion —
   **fondateur** : scellement physique des codes.
8. **Seed** : un compte de démonstration par rôle, adresses sur un domaine réservé (`example.test`),
   version de CGU fictive marquée comme telle.
9. **Écrans minimaux** : connexion du backoffice, et accueil vide de chaque espace. Le parcours
   membre complet (écrans 1 à 3) est construit au J5 ; au J3, un écran minimal, construit avec les
   tokens existants, suffit.

**Tests** : T8 (un seul code valide, expiration, cinq tentatives, plafonds par adresse et par IP,
blocage de l'attaquant et non de la victime, chemin d'exécution identique pour une adresse connue
et inconnue — assertion déterministe, `18` C-2 —, session révoquée à la suspension, route
backoffice sans `aal2` ⇒ `403`) ; lead-pipeline T1 (le code n'écrit rien dans `outbox_events`) et
T10 (aucun réessai automatique) ; code absent de tout journal, trace, réponse et cookie.
**Terminé quand** : chacun des quatre comptes de démonstration se connecte réellement dans son
espace, en local.

### J4 — `staging`, déploiement et collecte de surveillance (3 à 4 jours)

1. **Supabase `staging`** : réglages GoTrue du J3, migrations appliquées par la CI avec
   `DIRECT_DATABASE_URL` (secret de l'environnement GitHub `staging`, **jamais** sur Railway,
   CI-5), mots de passe des rôles posés, seed.
2. **Railway `staging`** : quatre services (`web`, `backoffice`, `api`, `worker`) ; `api` **sans
   domaine public** ; chemins surveillés incluant `packages/**` et `pnpm-lock.yaml` ; option
   « attendre la CI » activée ; contrôles de santé ; variables posées **sur le seul service qui en a
   besoin** (skill `env-secrets`) ; `staging` protégé et non indexé (I-6).
3. **Collecte D60** (`02` §20.5) : schéma `ops` (groupes d'erreurs, occurrences, métriques à la
   minute), rôle d'écriture seule à faire signer (EC-1), capture des erreurs serveur, histogrammes
   de durée par route, route `POST /v1/ops/client-errors` pour les espaces connectés. Les alertes,
   la sonde et l'écran « Santé technique » viennent au J9.
4. **Procédure écrite de retour à la version précédente** (`02` §20.7, point 5).

**Terminé quand** : un commit sur `main` passe la CI, migre `staging` puis y est déployé ; les
quatre comptes de démonstration se connectent sur `staging`.

### Lot 0 livré

Cases de `18` §10 « Lot 0 » : les dix points bloquants B1 à B10 cochés avec leur test, T2 T3 T4 T6
T11 T12 T16 verts, I-4 I-5 I-7 I-12 en place, **aucune objection ouverte de
`expert-cybersecurite`**.

---

## 5. Lot 1 — le premier usage (J5 à J9)

### 5.1 Le flux, de bout en bout

```
 Navigateur            apps/web                 apps/api                    Postgres (Supabase)
 ─────────             ────────                 ────────                    ───────────────────
 Écran 1 e-mail ──► passe-plat ──► POST /v1/auth/request-code ──► journal P0 ─► Brevo (code, P0)
 Écran 2 code   ──► passe-plat ──► POST /v1/auth/verify-code  ──► GoTrue ; jeton d'inscription
 Écran 3 infos  ──► passe-plat ──► POST /v1/signup ── UNE transaction (RG7) ─────────────────────┐
                                                     compte · rôle · CGU acceptées ·             │
                                                     2 consentements · statut déclaré ·          │
                                                     entreprise · source d'acquisition ·         │
                                                     registre · 3 lignes outbox_events           │
                                   ◄── session + routage vers l'espace du rôle ◄─────────────────┘
                                                                                     │
 worker (service distinct) ── prise de lot ── relecture de l'état ── qualification ──┤
        ├─► Brevo  : contact (si consentement)            → contact_sync_states      │
        ├─► Brevo  : bienvenue (toujours, P1)             → transactional_sends      │
        └─► Apollo : contact (si périmètre + qualification) → contact_sync_states    │
```

### 5.2 Le contrat d'API du Lot 1

Préfixes proposés : `/v1/…` pour les membres et le public, `/v1/bo/…` pour le backoffice *(à
valider, architecte)*. Chaque route déclare un schéma de requête **et** de réponse
(`packages/contracts`).

| Route | Accès | Chemin base | Règles |
|---|---|---|---|
| `POST /v1/auth/request-code` | Public | E-1 | `02` §18.10 ; `05` RG39 à RG52 |
| `POST /v1/auth/verify-code` | Cookie de parcours | E-2 | RG42 à RG47, RG53, RG66 à RG69 |
| `GET /v1/terms/current` | Public | Lecture | RG25, RG27 |
| `POST /v1/signup` | Jeton d'inscription | E-2 (EC-5) | RG5, RG7, RG8, RG11 à RG38, RG73, RG120 |
| `POST /v1/auth/logout` | Membre | Utilisateur | — |
| `GET` · `PATCH /v1/me` | Membre | Utilisateur | RG15, RG71 |
| `GET` · `PUT /v1/me/consent` | Membre | Utilisateur | RG34, RG92, RG95 |
| `GET` · `DELETE /v1/me/sessions[/:id]` | Membre | Utilisateur | RG56 |
| `POST /v1/me/email-change` et ses deux confirmations | Membre, code frais | Utilisateur | RG57, RG58 (A-11) |
| `POST /v1/me/terms/accept` | Membre | Utilisateur | RG28 |
| `POST /v1/support/code-not-received` | Public, débit limité | E-1 (EC-5) | RG65 |
| `POST /v1/webhooks/brevo/:token` | Brevo | Écriture brute (EC-12) | `16` RG146, RG147 |
| `/v1/bo/accounts`, `/v1/bo/sync/*`, `/v1/bo/settings/apollo`, `/v1/bo/invitations`… | `agent` · `admin` en `aal2` | Utilisateur | `05` RG97 à RG108, RG116 à RG119 |

### J5 — Inscription marque et créateur (4 à 5 jours)

1. **Migrations du Lot 1** (`04` §11.2, corrigées) : `0101` (file et états de synchronisation,
   contrainte RG35), `0103` (réglages, clés d'EC-8, valeurs d'attente), `0104` (statut déclaré
   **non nul**, santé de l'adresse, `set_declared_status()`, `correct_email()`), `0105`
   (incidents de délivrance), `0106` (`profiles.advertiser_profiles` minimal, déclaré dans la
   matrice de `03`), colonnes de source d'acquisition (EC-11). `0102` et `0107` attendent le J8.
2. **Versions de CGU** : pages publiques de lecture en FR et EN sans connexion (RG27) ; en
   `staging`, texte fictif marqué comme tel. Empreinte calculée à la publication, immuable ensuite.
3. **`POST /v1/signup`**, variante discriminée par rôle, **une transaction** : compte, rôle,
   acceptation (version, empreinte copiée, langue réellement affichée — RG24, RG25), **deux**
   événements de consentement avec le libellé exact présenté (RG32, RG33 — `granted` vrai ou faux),
   attestation de majorité datée pour un créateur (RG20), statut déclaré (`business` imposé pour
   une marque, RG22), entreprise, source d'acquisition figée (RG120), événements du registre, trois
   lignes de file (EC-10) ; refus si le pays est bloqué (RG8) ou si aucune CGU n'est publiée
   (`05`, cas limite n° 1). **Idempotent** sur `auth_user_id` : un double envoi ne crée rien de plus
   (RG110). Validation rejouée côté serveur avec les mêmes schémas que le front (RG10, TM10.3).
4. **Écrans** d'après `17` §3 : les deux portes, écran 1 (mention d'information visible, RG6),
   écran 2 (six cases pour un seul champ logique, phrase de correspondance, compte à rebours,
   panneau « je ne reçois pas le code »), écran 3 en **deux variantes jamais fondues** ; états de
   `17` §3.5 ; accessibilité de `17` §3.6 ; clés de traduction de `05` RG112 et `17` §3 dans
   `locales/<langue>/auth.json`, parité vérifiée. Changer de porte décoche le consentement (RG4).
5. **Espaces après inscription** : accueil minimal de chaque rôle (RG71), `noindex`.

**Tests** : CA1 à CA10, CA22, CA65 à CA69 ; TM10 ; T2 étendu aux tables du Lot 1 ; Playwright :
une inscription nominale par porte, avec la doublure Brevo.
**Terminé quand** : sur `staging`, une marque et un créateur s'inscrivent de bout en bout, et les
lignes de file attendues existent.

### J6 — Déversement vers Brevo et Apollo (4 à 5 jours)

1. **La boucle du worker**, en trois temps courts — jamais d'appel externe sous transaction (`02`
   §18.4 G4, lead-pipeline T9) :

   ```
   (1) PRISE     transaction : SELECT … WHERE status='pending' AND available_at<=now()
                 ORDER BY priority, available_at, id LIMIT 20 FOR UPDATE SKIP LOCKED
                 — en écartant toute ligne dont un événement antérieur du même
                   (subject_key, destination) n'est pas terminé (ordre, RG77)
                 → status='processing', locked_by, locked_at ; COMMIT
   (2) APPEL     hors transaction : relire l'état, qualifier, appeler le connecteur
   (3) ISSUE     transaction : succeeded | skipped + motif | pending + available_at
                 (réessai, RG79) | failed + cause en clair ; contact_sync_states ; COMMIT
   ```

   **Les révocations et suppressions (priorité 0) ne sont pas soumises à ce contrôle d'ordre** :
   sinon un `lead.created` plus ancien, en attente d'un réessai à trois heures, retiendrait la
   révocation bien au-delà de l'objectif de 5 minutes (RG78, RG92). C'est sans risque, parce que le
   consommateur relit l'état : l'ancien événement, traité après, verra le consentement retiré et
   sera ignoré. Bail d'expiration : une ligne restée `processing` au-delà de quelques minutes
   redevient `pending` (redémarrage en plein lot, TM1.10). Interrogation toutes les 2 s en activité, 5 s au
   repos ; battement de cœur à chaque tour (`02` §11.3). Priorités proposées : `0` révocations et
   suppressions, `10` transactionnels P1, `50` P2, `100` synchronisations ordinaires
   (lead-pipeline, ordre complet).
2. **Relecture et qualification**, à la consommation et jamais à l'émission (RG37, RG80) :
   - contact Brevo : consentement `marketing_email` en vigueur, sinon `skipped` motif
     `no_consent` ;
   - contact Apollo : **toute** la qualification de RG82 — adresse vérifiée, aucune opposition,
     pays dans `apollo_prospecting_countries`, périmètre (RG81), base légale (RG83), statut
     déclaré, entreprise pour une marque — sinon `skipped` avec son motif ;
   - garde-fous (`02` §12.4) : `SYNC_MODE=dry_run` ⇒ `succeeded` avec `dry_run: true` et ce qui
     aurait été envoyé ; destinataire hors liste blanche ⇒ `skipped_non_production` ; aucune clé ⇒
     `skipped_no_credentials`.
   - Les motifs sont une **union fermée** dans `packages/contracts`, chacun associé à sa cause en
     clair de RG99 et à sa nature (cas normal ou échec, RG100).
3. **Module Brevo** (`apps/api/src/domains/leads/connectors/brevo/`) : les opérations 1, 2, 6 et 7
   de `16` §M1 au Lot 1 ; mapping de `16` §M4 (plus EC-11) écrit comme une fonction typée ;
   **contrôle de sortie** qui refuse tout champ non déclaré (RG137) ; limiteur de débit **par
   catégorie** (contacts ≈ 10/s, transactionnel séparé, lead-pipeline règle 12) ; classement
   transitoire · permanent · authentification (`16` M5) ; date de vérification de la documentation
   inscrite dans le module (RG150). Un créateur a un attribut `COMPANY` **vide**, jamais son nom
   (RG142).
4. **Bienvenue** (`account.welcome_advertiser` et `account.welcome_creator`, P1) : ligne
   `brevo_transactional` dont la clé d'idempotence **n'inclut pas** l'identifiant d'événement
   (RG76) — l'unicité `(destination, idempotency_key)` de la file garantit un seul e-mail par
   compte ; chaque envoi est journalisé dans `transactional_sends`.
5. **Module Apollo** (`connectors/apollo/`) : documentation officielle lue au moment de coder
   (déduplication, limites du plan, champs personnalisés) ; création ou mise à jour idempotente —
   identifiant Apollo conservé dans `contact_sync_states`, recherche avant création ; champs du
   contexte INFLUX de la skill `apollo-lead-sync` dont le **périmètre appliqué** ; **aucun
   réimport** de donnée enrichie (RG85) ; inscription en séquence **désactivée par défaut**,
   activable par configuration quand `expert-marketing` l'aura définie.
6. **Réévaluation** après changement de périmètre (RG81) : fonction de service prête au J6, écran
   au J8.

> **Avec les valeurs d'attente, rien ne part vers Apollo, et c'est voulu** : la liste des pays de
> prospection est vide tant qu'`expert-conformite-rgpd` ne l'a pas renseignée (RG84). Pour voir
> Apollo fonctionner en local, renseigner cette liste **dans le seed de développement uniquement**.

**Essai manuel sur le poste de développement** (D62, conditions de `16` RG115) :

1. `BREVO_MODE=redirect`, `BREVO_TEST_RECIPIENTS` = adresse du développeur ; `SYNC_MODE=live`,
   `NON_PRODUCTION_RECIPIENT_ALLOWLIST` = le domaine des adresses de test ; clés des comptes de
   test dans `apps/api/.env.local`.
2. S'inscrire comme marque, comme créateur `professionnel` et comme créateur `particulier`
   (consentement obligatoire, D63) ; vérifier qu'une inscription sans la case est refusée.
3. Constater : trois contacts Brevo (attributs, listes) ; **un seul e-mail de bienvenue par compte** — donc un
   par inscription de l'essai, et aucun second envoi après un rejeu ou une double soumission
   (RG76, RG86) ; après
   un retrait de consentement, la ligne suivante est `skipped`, jamais `failed` ; dans Apollo, la
   marque et le créateur `professionnel`, le créateur `particulier` étant écarté pour cause de périmètre (valeur d'attente
   `annonceurs_et_createurs_pro`).
4. Enregistrer une fois les échanges réels, **expurgés**, comme fixtures des doublures (RG148).

**Tests** : TM1.1 à TM1.10 ; CA37 à CA50 ; lead-pipeline T5, T6, T9 ; T17 (quatre verrous) ;
scénarios 1 à 6 et 13 à 14 de `16` RG148.
**Terminé quand — premier usage démontrable** : sur `staging` en `dry_run`, chaque inscription
produit ses lignes et le worker les traite avec le bon statut ; l'essai manuel ci-dessus passe ; une
panne simulée de Brevo et d'Apollo n'empêche aucune inscription (CA37).

### J7 — Retours de Brevo et espace membre minimal (3 à 4 jours)

1. **Webhook Brevo** selon EC-12, avec les six compensations de `16` RG146 : jeton en en-tête
   comparé en temps constant (deux valeurs pendant une rotation), chemin non devinable, plages
   d'adresses IP, fenêtre de 15 minutes, idempotence, aucune preuve fondée sur le seul webhook.
   Réponse immédiate, traitement par le worker (RG147).
2. **Traitements** (`16` RG106) : désinscription, plainte, rebond dur, adresse invalide, blocage ⇒
   `consent_events` (source `brevo_webhook`), `contact_sync_states` (`unsubscribed_at`, liste de
   suppression pour une plainte, RG93) ; rebond dur **transactionnel** ⇒
   `email_delivery_incidents` et `accounts.email_status = 'undeliverable'` ; `delivered` sur un
   code ⇒ colonne d'accusé de `transactional_sends`.
3. **Rapprochement quotidien** des 48 dernières heures (RG91), tâche E-4.
4. **Purge des utilisateurs GoTrue orphelins** après 24 h (`02` §18.5, E-4), par l'API
   d'administration et jamais par `DELETE` sur le schéma `auth`.
5. **Espace membre** (RG71) : mes informations (langue modifiable ⇒ `lead.updated`, RG15 ; le
   droit du membre à modifier lui-même pays, statut et entreprise reste à confirmer, RG73 et RG108),
   préférences de communication (valeur, date, origine ; retrait en un geste ⇒ `consent.revoked`
   prioritaire, effet immédiat dans INFLUX), mes sessions et « fermer toutes les sessions », mes
   données (EC-14), déconnexion.
6. **Changement d'adresse** avec double confirmation (RG58, A-11) ; **notification de nouvel
   appareil** (RG55, A-12) ; **ré-acceptation des CGU** bloquante (RG28) ; **canal de secours**
   (RG65).

**Tests** : CA32 à CA36, CA52 à CA55, CA70 ; lead-pipeline T7 et T8 ; scénarios 7 à 9 de `16`
RG148.

### J8 — Backoffice v0 (4 à 5 jours)

1. Migrations `0102` (catalogue des files, délais) et `0107` (alertes, double validation), table
   des invitations (EC-11).
2. **Liste des inscrits** (RG97) : colonnes, filtres, tri ; recherche exacte libre, recherche
   partielle limitée en débit et journalisée (RG98) ; **aucun export nominatif** (RG106).
3. **Fiche d'un inscrit** : état par destination avec **cause en clair** (RG99), distinction
   visuelle entre échec et cas normal (RG100), bandeau des compteurs du jour (RG105).
4. **Rejeu** unitaire, et en lot plafonné à 200 (RG101) — le lot exige la double validation (`03`
   §3.5), donc la **procédure dégradée** PD1 à PD7 tant qu'un seul administrateur existe ; même clé
   d'idempotence (RG102) ; rien à rejouer sur un `skipped` (RG103).
5. **Réglages Apollo** réservés à `admin` : périmètre, base légale, pays de prospection ; journal
   de l'ancienne et de la nouvelle valeur ; réévaluation mise en file (RG81, CA43).
6. **Corrections** (RG108) par les fonctions `SECURITY DEFINER` : statut, pays, langue (agent),
   rôle (admin), avec motif ; **correction d'adresse** d'un compte injoignable (`correct_email()`,
   événement `critical`, Q8 ouverte).
7. **Files** : adresses injoignables, canal de secours, échecs de synchronisation ; **alertes** de
   RG104 et **indicateurs de délivrabilité** du code (RG63, `16` RG98, AL48).
8. **Invitations nominatives** (D54, RG116 à RG119) : création, code à usage unique, attribution du
   commercial responsable à l'inscription. L'envoi de l'e-mail d'invitation dépend de D35 : au Lot 1,
   le commercial transmet le lien lui-même.

**Tests** : CA56 à CA64 ; T14 sur les routes du backoffice ; parcours de double validation dégradée.

### J9 — Durcissement, landing branchée, mise en ligne (4 à 5 jours)

1. **Sortie du mode maquette de `apps/web`** (`02` §13.3, dans le même changement) : retrait du
   module fictif, d'`IS_MOCKUP` et du bandeau ; G2 remplacée par la garde resserrée et la CSP
   testée ; G4 et G6 retirées ; G1 resserrée ; boutons et portes de la landing branchés sur les vrais
   chemins (EC-15). Le bandeau disparaît dans le commit de la première donnée réelle, jamais avant.
2. **En-têtes et CSP** par surface (`03` §6.5, T10) ; passe-plat complet (T7) ; erreurs sans détail
   (T13) ; limitation de débit (T15) ; analyse des artefacts (T11).
3. **Surveillance active** (`02` §20.5 à §20.7) : alertes par e-mail (les alertes de disponibilité
   partent directement vers Brevo, jamais par la file), sonde du worker chaque minute, surveillance
   du worker par l'API, écran « Santé technique » ; plan de rodage de 30 jours.
4. **Environnement `production`** préparé à l'identique de `staging`, sans être ouvert.
5. **Relectures humaines** de `18` §10 « Lot 1 » : textes FR et EN des pages et des e-mails,
   documents légaux relus par un juriste, domaines d'envoi vérifiés, `staging` fermé au public.

### 5.8 Portes de la mise en production

Aucune n'est technique ; toutes bloquent l'ouverture au public (`00` §7 Lot 1, `18` §10).

| Porte | Qui | Référence |
|---|---|---|
| Société créée ; mentions légales possibles | Fondateur + avocat fiscaliste | D25 |
| Périmètre et base légale Apollo validés par un juriste ; pays de prospection renseignés | Fondateur + `expert-conformite-rgpd` (veto) | D33, `05` Q1 à Q3 |
| CGU FR et EN avec clause de non-contournement, supervision des conversations, conservation probatoire ; politique de confidentialité nommant Brevo et Apollo | Fondateur + juriste | D29, A5, A10, R-1 |
| Trois sous-domaines d'envoi authentifiés (SPF, DKIM, DMARC) sur le compte Brevo de production | Fondateur + `integrateur` | `16` RG9, `CLAUDE.md` §14.3 |
| Comptes Brevo et Apollo au nom de la société ; contrats de sous-traitance signés | Fondateur | `CLAUDE.md` §14.3 |
| Textes de la landing relus ; revue visuelle du budget d'effets | `expert-marketing` + `expert-conformite-rgpd` ; `expert-ux` | D48, D59 |
| Aucune objection ouverte de `expert-cybersecurite` ni de `expert-conformite-rgpd` | Les deux experts | `CLAUDE.md` §10.3 |
| **Accord explicite du fondateur** pour la mise en production | Fondateur | `CLAUDE.md` §10.3, règle 6 |

---

## 6. Configuration des services externes

À dérouler par environnement. **F** = action du fondateur (compte, facturation, DNS) ;
**D** = action du développeur, documentée dans le dépôt.

**Supabase**
- [ ] **F** Projet `staging` en UE ; projet `production` créé **après** D25 (la région ne change
      plus ensuite), avec restauration à un instant donné (D57, coût à chiffrer).
- [ ] **D** Clés de signature JWT asymétriques ; réglages GoTrue du J3 ; aucun de nos schémas exposé
      par l'API de données ; `public` vide.
- [ ] **D** Mots de passe des rôles de connexion posés hors migration ; `DIRECT_DATABASE_URL` dans
      les seuls secrets GitHub.

**Brevo** — compte de test dès maintenant (D62), compte de production au J9
- [ ] **D** Attributs de contact de `16` §M4, complétés des attributs d'acquisition (EC-11).
- [ ] **D** Listes par rôle et par langue *(proposition, à valider par `expert-marketing`)*.
- [ ] **D** Modèles transactionnels FR et EN : `auth.login_code`, `account.welcome_advertiser`,
      `account.welcome_creator`, puis `auth.new_device`, `auth.email_change_*`,
      `internal.critical_alert` ; contenu du code conforme à `05` RG49.
- [ ] **D** Webhook (J7) avec en-tête personnalisé et chemin à jeton.
- [ ] **F** Compte de test sans aucun des trois sous-domaines de production (RG115, condition 3).

**Apollo** — compte de test dès maintenant, production après D33
- [ ] **D** Champs personnalisés du contexte INFLUX ; aucune boîte d'envoi, aucune séquence active
      sur le compte de test.
- [ ] **F** Séquences de production définies avec `expert-marketing`, activées seulement après
      validation du juriste.

**Railway**
- [ ] **F** Projet, environnements `staging` puis `production`, décision sur l'offre Pro (D60).
- [ ] **D** Configuration des quatre services décrite dans le dépôt (commandes, chemins surveillés,
      variables par service) : un réglage qui n'existe que dans l'interface est perdu.

**GitHub**
- [ ] **F** Second facteur ; environnements `staging` et `production` avec leurs secrets.
- [ ] **D** Workflows : CI à chaque commit, migrations `staging` puis déploiement, contrôles
      hebdomadaires.

**Domaines et DNS**
- [ ] **F** Nom de domaine, sous-domaine du backoffice, enregistrement `CAA`, trois sous-domaines
      d'envoi (`tx.`, `news.`, `pro.`, `16` RG9 et Q13) ; abonnement aux pages d'état de Railway,
      Supabase et Brevo (D60).

---

## 7. Après le Lot 1 : la feuille de route

Chaque lot commence par la même séquence : décisions obtenues, spécification relue, migrations et
matrice des droits, tests de droits, puis écrans.

| Lot | Décisions à obtenir avant de coder | Première étape technique | Tests qui portent le lot |
|---|---|---|---|
| **2 — Profils, réseaux, badge** | D34, D61 (`07` Q15 et Q16), D24 instruite, `03` R-4 et R-5 | Migrations `0201` à `0207` : trois objets créateur, compartiments Storage privés ; création de `packages/domain` et `packages/ui` | **T1** (anonymisation sur la charge brute), T9, T14, TM5, TM11 |
| **3 — Campagnes, recherche anonymisée** | D38, facettes de `10` | Migrations `0301` à `0306` ; domaine `search` avec k-anonymat, pagination plafonnée, journal | T1 rejoué, T15, TM12 ; mesure manuelle des 30 secondes |
| **4 — Mise en relation, messagerie à trois** | D30, apartés (`04` §5.7.1 A2), conditions mobiles de D58 | Migrations `0401` à `0406` ; `reveal_identity()` et affaire créée à la révélation | **T18**, T5, T19, TM2, TM3, corpus de détection |
| **5 — Backoffice, pipeline, e-mails** | D35, D36, `03` R-7 | Migrations `0501` à `0503` ; interrupteur d'urgence | TM4, TM6, TM8, TM9 |
| **6 — Recette, audit, ouverture** | Levée des deux vetos ; test d'intrusion (F-9) | Parcours de bout en bout en douze étapes (`18` §7) | Toutes les familles ; restauration répétée |

---

## 8. Risques de réalisation

| Risque | Signal | Parade |
|---|---|---|
| **La pile Supabase locale est lourde sous Windows** | Démarrage lent, mémoire saturée | Moteur WSL 2, 8 Go alloués ; en dernier recours, tests de base en CI seulement — jamais de tests de droits supprimés |
| **Le comportement de GoTrue diffère de ce que suppose `02` §18.7** (code obtenu sans envoi, invalidation du code précédent, durée) | Test J3 rouge | Le constater au J3, pas au J9 ; repli documenté par D37 (« si l'on se trompe ») |
| **Drizzle en version pré-1.0** | Rupture à une montée de version | Version exacte, couche `repository.ts` par domaine (`02` §5) |
| **La CI dépasse 10 minutes** | Durée mesurée | Matrice T2 en transactions groupées ; bout en bout avant déploiement seulement |
| **Délivrabilité réelle inconnue avant la production** | AL48 dès l'ouverture | Rodage de 30 jours, seuils de D37 ; ajout du mot de passe en 2 à 3 jours si nécessaire |
| **Un seul développeur** | Connaissance qui ne vit que dans une tête | Petits commits, spécifications corrigées au fil de l'eau (§2.5), procédures écrites |
| **Les portes non techniques glissent** (D25, D33, D29) | Aucune date de création de société | Le développement n'est pas bloqué (tout est configuration) ; la mise en ligne l'est — à suivre chaque semaine avec le fondateur |
| **Le périmètre grossit** (additifs, alertes, écrans) | Jalon qui s'allonge | Tout ajout passe par `chef-de-projet` et remplace quelque chose (`00` §10.2) |

---

## 9. Guide de lecture pour le développeur

| Avant | Lire |
|---|---|
| Tout | `CLAUDE.md` (§3, §6, §13, §16) ; `00` §4 et §7 ; ce document §2 et §3 |
| J1 | `02` §2, §4, §8, §9, §12, §13, §15 ; `03` §6.4 (passe-plat) et §7 ; `docs/landing-page/01-architecture.md` §11 |
| J2 | `04` §1 à §4, §5.1, §11 ; `03` §1 à §4 et §8 (T2, T3, T4, T6, T16) ; skill `supabase-schema` |
| J3 | `02` §7 et §18 (en entier) ; `03` §6.1, §6.2, §6.3, §6.9 ; `05` §F et §G ; `04` §5.8 (`transactional_sends`, `auth_request_throttle`) |
| J4 | `02` §11, §12, §19, §20 ; skills `railway-deploy`, `env-secrets` |
| J5 | `05` §A à §E, §H, §L, additif D54/D55 ; `17` §2.5, §2.6, §3 ; skill `design-system-influx` |
| J6 | `02` §6 et §11 ; `05` §I ; `16` §H, §J, §M ; skills `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` ; `18` TM1 et T17 |
| J7 | `05` §F (RG54 à RG58), §J ; `16` §I et §M6 ; `17` §6 |
| J8 | `05` §K ; `15` §C, §F ; `17b` §3.11 et §3.13 ; skill `backoffice-ops` ; `03` §1.3 |
| J9 | `02` §13 et §20 ; `03` §6.5 ; `18` §5 et §10 « Lot 1 » |
