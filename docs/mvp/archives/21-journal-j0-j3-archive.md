# ARCHIVE — Journaux d'exécution et revues clos (J0, J1, J2, J3 commits 1 à 8)

> **Statut : ARCHIVE HISTORIQUE.** **INTERDICTION AUX AGENTS IA DE LIRE CE FICHIER PAR DÉFAUT** (économie de tokens). Le plan de développement actif et léger est dans `docs/mvp/21-plan-de-developpement.md`. Ce fichier conserve l'intégralité des journaux, revues et écarts tranchés (EC-1 à EC-57) des jalons J0 à J3 (commit 8).

---

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
5. **Seul un écart structurant arrête le code (révisé le 2026-09-29 — directive de vélocité du fondateur)** :
   un micro-écart technique ou de librairie (`EC-*`) qui ne touche aucun invariant métier est tranché
   sur-le-champ de la manière la plus sûre/conservatrice par l'agent qui code, **sans arrêter le
   développement et sans créer de commit `docs(mvp):` intermédiaire**. Les ajustements documentaires
   et la **revue de sécurité (`expert-cybersecurite`) sont groupés en une seule passe à la fin de
   chaque jalon**.

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
   implémente (`05` RG44, `03` A-9…). Face à un micro-écart technique, appliquer la solution la plus conservatrice sans bloquer le jalon (§0, règle 5).
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

> **Recommandation — validée avec amendements par `architecte` le 2026-09-25 (§4, J1-D).**
> `.env.example` prévoit que `apps/api/.env.local` porte les valeurs de `staging`. Pour le travail
> quotidien et les tests, pointer plutôt vers la **pile locale** : remise à zéro en une commande,
> aucune donnée partagée, GoTrue réel (on vérifie son comportement au lieu de le supposer). Les
> valeurs `staging` vont dans un second fichier ignoré (`apps/api/.env.staging.local`) pour les
> vérifications ponctuelles. Amendements : la bascule se fait au J2, pas au J1 (le J1 ne lit aucune
> variable de base) ; le fichier `staging` ne porte ni clé Brevo, ni clé Apollo, ni
> `DIRECT_DATABASE_URL`.

**En local, le code de connexion arrive par e-mail réel** : `BREVO_MODE=redirect` avec le compte
Brevo de test et `BREVO_TEST_RECIPIENTS` réglé sur l'adresse du développeur (`16` RG115 et RG117).
Aucune « porte de développement » n'affiche le code : il ne doit apparaître dans aucun journal
(`05` RG52). Dans les tests automatisés, c'est la doublure Brevo qui restitue le message au harnais.

### 2.4 Stratégie de test

Référence : `18` (plan de test) et `03` §8 (T1 à T19). Ce tableau dit **où** chaque famille vit.

| Niveau | Outil *(validé par `architecte` le 2026-09-25 ; versions au §4, J1-A)* | Contenu | Quand |
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
- [ ] **directive de vélocité (2026-09-29)** : aucun commit `docs(mvp):` intermédiaire n'est créé entre
      deux sous-commits d'un jalon pour documenter des micro-écarts (`EC-*`). Les ajustements de
      spécification et la **revue de sécurité (`expert-cybersecurite`) sont effectués en une seule
      passe groupée à la fin du jalon** ;
- [ ] toute migration touchant `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction
      `SECURITY DEFINER` ou un attribut de rôle porte le marqueur `security-reviewed: <date>` dans son
      message de commit, vérifié par la CI (`03` I-4) et validé lors de la revue groupée du jalon ;
- [ ] toute variable nouvelle est documentée dans le `.env.example` concerné (skill `env-secrets`).

**Agents et skills à solliciter** (en revue groupée par jalon, `CLAUDE.md` §10.3 règle 8) : `architecte` (J1, choix de
dépendances), `expert-database` + skill `supabase-schema` (migrations d'un jalon en un lot),
`expert-cybersecurite` (**une seule revue groupée en fin de jalon**, jamais entre chaque sous-commit — veto), `expert-integrations-api` + skills
`lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` (J6, J7), `expert-ux` + skill
`design-system-influx` (J5, J8), `testeur` + skill `test-strategy` (fin de chaque jalon),
`integrateur` + skills `railway-deploy`, `env-secrets` (J0, J4, J9).

### 2.6 Dépendances — tranchées par `architecte` le 2026-09-25

Toutes en **version exacte** (`savePrefix: ""`), publiées depuis plus d'un jour
(`minimumReleaseAge`), et **documentation de la version installée lue avant usage** (`02` §15,
règle 15). **Versions, espaces de travail et jalon d'entrée : §4, J1-A** (source unique ; ce
tableau n'en garde que la décision).

| Besoin | Décision | Remarque |
|---|---|---|
| Schémas partagés | `zod` | Source unique : validation d'entrée, filtre de sortie, types (`02` §9.1) |
| Serveur | `fastify` 5 + `@fastify/cookie` (J3). **`fastify-type-provider-zod` écarté** : compilateurs zod écrits dans `apps/api/src/platform/` | Le sérialiseur de réponse retire tout champ non déclaré (`02` §2.5, point 4) ; motifs du refus en J1-A |
| Accès aux données | `drizzle-orm` + pilote `postgres` (`prepare: false`), au J2. `drizzle-kit` non installé | D5 ; `drizzle-kit push` interdit |
| Auth et Storage | `@supabase/auth-js` au J3, `@supabase/storage-js` au Lot 2 — *révisé le 2026-09-27 (J3-B) : plus `@supabase/supabase-js`* —, importés **uniquement** dans `apps/api/src/platform/supabase.ts` | D5, règle 2 |
| Journaux | `pino` en dépendance directe (le worker journalise sans Fastify), masquage des champs sensibles. `pino-pretty` écarté | `02` §20.8 |
| Construction de `apps/api` | **Aucune** : Node exécute le TypeScript par effacement des types. **`tsup` écarté** (plus maintenu) | Décision J1-B |
| Bout en bout | `@playwright/test`, au J5 | `18` A-5 |
| CLI Supabase | **Dépendance de développement `supabase` à la racine**, au J2 ; pas d'installation système | Une seule version, dans le verrou, en local et en CI ; aucun script d'installation (binaires par dépendances optionnelles) |

---

## 3. Écarts à trancher avant ou pendant le code

Relevés en croisant `02`, `03`, `04`, `05`, `16`, `17` et `18`. Chacun **bloque le jalon indiqué** ;
la proposition est une hypothèse de travail, pas une décision.

| # | Écart | Proposition | Arbitre | Bloque |
|---|---|---|---|---|
| **EC-1** | **Rôles Postgres incohérents.** `04` §3.2 crée `influx_service` et rend `influx_app` membre de tous les rôles ; `02` §5 et `03` P7 imposent `influx_app` membre des seuls quatre rôles métier, et une **seconde grappe** avec `influx_auth`, `influx_worker`, `influx_privacy` ; `03` P8 ajoute `influx_audit_writer`, D60 ajoute `influx_ops` | Suivre `03`, qui fait foi. **Un rôle de connexion élevé par service** : celui de `api` n'est membre que d'`influx_auth`, celui du `worker` d'`influx_worker` (puis `influx_privacy` au Lot 5) — le processus HTTP ne peut alors jamais emprunter les droits du worker. Corriger `04` §3.2 et le commentaire d'`ELEVATED_DATABASE_URL` dans `.env.example` | `expert-cybersecurite` (veto) + `expert-database` | J2 — **Tranché par `expert-cybersecurite` le 2026-09-26** : proposition retenue et **durcie** — **un rôle de connexion par rôle élevé**, une variable par rôle de connexion. Liste fermée, attributs, appartenances, propriétaires et règles d'écriture de `0001` : **`03` §4 P7, « Les rôles Postgres — liste fermée »**, qui fait foi. En bref : `influx_app` (`LOGIN NOINHERIT`, membre des **quatre rôles métier seuls**, `WITH INHERIT FALSE, SET TRUE` ; son **unique droit propre** est `EXECUTE` sur `identity.resolve_session()`) ; `influx_auth_login` → `influx_auth` seul (E-1, E-2) ; `influx_worker_login` → `influx_worker` seul (E-3, E-4) ; propriétaires de fonctions `SECURITY DEFINER` `NOLOGIN` **sans aucun membre** : `influx_audit_writer` (`audit.append`), `influx_session_resolver` (`identity.resolve_session`), `influx_identity_definer` (`identity.grant_role`). **`influx_service` est supprimé** (jamais créé ; chaque droit qui lui était destiné va au rôle précis ou disparaît). **Tables et schémas** : propriété du rôle de migration (`postgres` du projet, `DIRECT_DATABASE_URL`, CI seule) ; **aucune fonction `SECURITY DEFINER` ne lui appartient**, car `postgres` porte `BYPASSRLS` sur Supabase. Plus tard : `influx_ops` + `influx_ops_login` (J4, E-6 à signer avec sa migration), `influx_intro_owner` (Lot 4), `influx_privacy` + `influx_privacy_login` (Lot 5, **pas** ajouté au rôle du worker : un défaut de traitement d'une réponse Brevo ou Apollo ne doit jamais atteindre l'anonymisation transverse). Aucun `BYPASSRLS`, aucun `SUPERUSER`, aucun mot de passe dans une migration |
| **EC-2** | **Aucune table de sessions** dans `04`, alors que la session opaque révocable est bloquante (A-9, B4) | `identity.sessions` : empreinte SHA-256 de l'identifiant (le cookie porte la valeur brute), compte, surface (`member` · `backoffice`), `aal`, création, dernière activité, expiration glissante (30 j membres, 8 h / 30 min backoffice), plafond absolu de 180 j, `revoked_at` et motif, navigateur résumé, pays approximatif | `expert-database` + `expert-cybersecurite` | J3 |
| **EC-3** | **Cinq tentatives par code** (`05` RG42, A-2) sans support : `identity.auth_request_throttle` ne connaît que les portées `email` et `ip` | Portée supplémentaire `login_request`, dont la clé est l'identifiant de la ligne `leads.transactional_sends` porté par le cookie de parcours. Au cinquième échec, régénérer un code **sans l'envoyer** pour invalider le précédent — comportement GoTrue à vérifier. *Fait établi par `architecte` le 2026-09-27 (J3-A b4 à b6) : GoTrue ne compte aucun échec ; un nouveau `generateLink` remplace le code en cours ; la régénération est donc réalisable (à constater en pile locale)* | `expert-cybersecurite` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — tentative **réservée atomiquement avant** l'appel à GoTrue, clé aléatoire (jamais séquentielle), **régénération sans envoi au cinquième échec retenue** (G-1), seuils par IP et globaux. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-4** | **L'état « code vérifié, compte non créé »** (`05` RG5) n'a pas d'objet | Jeton d'inscription signé (cookie `__Host-`, `httpOnly`, 30 min) portant `auth_user_id`, adresse et porte. Le compte n'existe qu'à la validation de l'écran 3. Le brouillon de l'écran 3 reste en mémoire : le stockage navigateur est interdit par ESLint (`02` §13.2) | `expert-cybersecurite` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — `SameSite=Strict`, porte = simple valeur par défaut, relecture de l'utilisateur GoTrue à la consommation, rejeu sans effet. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-5** | **Opérations de pré-authentification non nommées.** `03` P7 définit E-2 comme « vérification du code, création du compte au premier passage », or le compte naît à l'écran 3 ; le canal de secours (`05` RG65) et la connexion du backoffice écrivent aussi sans session | Rattacher explicitement la finalisation de l'inscription et la connexion du backoffice à **E-2**, le canal de secours à **E-1** (même rôle `influx_auth`), par une révision signée de `03` P7 plutôt que par une nouvelle opération | `expert-cybersecurite` (liste fermée signée) | J3, J5 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu — **révision signée de `03` P7 faite** : cinq entrées inchangées, un motif nommé par point d'usage (E-1 : `identity.request_code`, `support.report_delivery_issue` ; E-2 : `identity.verify_code`, `identity.complete_signup`, `identity.backoffice_sign_in`, `identity.backoffice_enroll_totp`, `identity.backoffice_reauthenticate`). Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-6** | `leads.transactional_sends.template_ref` référence `backoffice.email_templates`, table du **Lot 5**, alors que le journal naît au Lot 1 (migration `0108`) | Colonne texte sans clé étrangère jusqu'à `0503` ; codes de modèles en union fermée dans `packages/contracts` (`16` RG85) | `expert-database` | J3 — **Tranché par `expert-database` le 2026-09-28** : retenu tel quel dans `0015` (contrainte de format du code, paire `template_ref` / `template_version`) ; la clé étrangère entre avec `0503` |
| **EC-7** | `transactional_sends.outbox_event_id` est un `uuid` qui référence `outbox_events(id)`, un `bigint` | Type `bigint` | `expert-database` | J3 — **Tranché par `expert-database` le 2026-09-28** : `bigint` **sans clé étrangère** dans `0015`, nul pour toute ligne `P0` (contrainte) et non inscriptible par `influx_auth` ; `0101` ajoute la clé étrangère en créant `outbox_events` (EC-37) |
| **EC-8** | **Clés de `leads.sync_settings`** (`04` §5.8) incomplètes et contradictoires avec `05` : pas de liste de pays bloqués à l'inscription (RG8) ; `apollo_blocked_countries` est une liste de **blocage** alors que RG84 exige une liste d'**autorisation**, vide par défaut | Clés : `apollo_scope`, `apollo_legal_basis` (valeur par défaut `consentement_requis`, surcharge par pays), `apollo_prospecting_countries` (autorisation, **vide**), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, et les identifiants de listes et de modèles Brevo | `expert-database` + `expert-integrations-api` | J5, J6 |
| **EC-9** | **Calendrier de réessais** : 6 tentatives dans `02` §6, 10 dans `05` RG79 (et `attempts <= 10` dans `04`) | Valeur de départ de `retry_schedule` = `05` RG79 | `architecte` | J6 |
| **EC-10** | **Événements émis à l'inscription** : `05` RG73 prévoit `consent.granted` « à l'inscription » en plus de `lead.created` ; `18` §10 attend « quatre lignes de file » | À l'inscription, `lead.created` seul : trois lignes (`brevo_contact`, `apollo_contact`, `brevo_transactional` pour la bienvenue) — le consommateur relit le consentement (RG37) ; `consent.granted` et `consent.revoked` pour les changements ultérieurs. Corriger `18` en conséquence | `product-owner` + `testeur` | J5 |
| **EC-11** | **D54 et D55 non modélisées** : ni table des invitations, ni colonnes de source d'acquisition (`04` §12.11, points 9 et 10) ; le mapping Brevo `16` §M4 n'a pas les attributs UTM exigés par `05` RG122 | Colonnes figées sur `identity.accounts` (J5), table des invitations (J8), attributs `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `REFERRER_DOMAIN`, `HEARD_FROM` ajoutés à `16` §M4 | `expert-database` + `expert-conformite-rgpd` (veto) | J5, J8 |
| **EC-12** | **Aucun chemin pour le webhook Brevo.** `apps/api` n'a pas d'hôte public (`02` §12) ; le passe-plat ne relaie qu'une liste blanche d'en-têtes (PP-5) qui exclut l'en-tête du jeton (`16` RG146) ; la table qui stocke l'événement brut avant traitement (RG147) n'existe pas | Chemin borné `/api/v1/webhooks/brevo/<jeton>` relayé par le passe-plat de `apps/web`, avec l'en-tête du jeton ajouté à la liste blanche **pour ce seul chemin** ; contrôle des plages d'adresses IP dans `apps/api` sur l'adresse relayée `x-real-ip` (PP-6, A5 ; *corrigé le 2026-09-25 : jamais `x-forwarded-for`*) ; table d'événements entrants en ajout seul, consommée par le worker | `architecte` + `expert-cybersecurite` (veto) | J7 — *conflit signalé le 2026-09-25 (revue de fin de J1)* : le contrôle d'origine A4 (`03` §6.4) **refuserait ce `POST` de serveur à serveur**, sans `origin` ni `sec-fetch-site` ; une exception nommée et fermée est à trancher par `expert-cybersecurite` avant le J7. Le jeton de chemin s'écrit dans `[A-Za-z0-9_-]` (PP-2, R1) |
| **EC-13** | Le Lot 0 promet « un compte de démonstration par rôle se connecte réellement dans les trois espaces » (`00` §7), mais `02` §13.3 et `18` §10 interdisent de lever une garde de `apps/web` au Lot 0 — or la connexion membre passe par le passe-plat, donc par la levée de G5 | Lever G5 au J1, **dans le commit qui introduit le passe-plat et sa garde de liste blanche** (la règle « une garde ne tombe qu'avec son remplaçant » est tenue). G1, G2, G4 et G6 attendent le J9 | `architecte` + `testeur` | J1 — **tranché par `architecte` le 2026-09-25, élargi** (§4, J1-C) : la garde annexe « aucune API réseau » est scindée dans le même commit. `02` §13.3 corrigé. **Couverture confirmée par `testeur` le 2026-09-25** (commit 9ef4b0a ; G1, G2, G4, G6 toujours actives, aucune perte à l'extraction) |
| **EC-14** | « Mes données » (export, suppression) figure dans l'espace du Lot 1 (`05` RG57, RG71), mais l'exécution des demandes RGPD est au Lot 5 (E-5, `backoffice.data_subject_requests`) | Au Lot 1 : dépôt de la demande depuis l'espace membre, accusé de réception, exécution manuelle par un administrateur selon une procédure écrite ; table avancée au Lot 1 si nécessaire | `chef-de-projet` + `expert-conformite-rgpd` (veto) | J7 |
| **EC-15** | `02` §7 et `04` §13 renvoient à `AccountForm.tsx`, qui n'existe plus sur `main` ; le formulaire en trois étapes de la landing ne correspond pas au parcours réel ; les boutons pointent vers `/signup`, `/login`, `/signup/advertiser`, `/signup/creator` alors que `17` §2.6 fixe des chemins localisés | Écrans écrits d'après `17` §3. Chemins des portes à fixer (par exemple `/fr/inscription/marque` · `/en/signup/brand`) ; « Me connecter » ouvre l'écran 1 précédé du choix de porte ; la section formulaire de la landing devient un renvoi vers les deux portes (tests `TM10` adaptés) | `expert-ux` + `product-owner` | J5, J9 |
| **EC-16** | Les points d'accès publics de Supabase Auth restent joignables avec la clé *publishable*, qui n'est pas un secret : inscription publique, envoi natif d'un code par GoTrue | Désactiver l'inscription publique (l'API d'administration reste utilisable), ne configurer aucun envoi d'e-mail natif de GoTrue, et **vérifier par un test** qu'aucun envoi ni aucune création d'utilisateur n'est déclenchable sans `apps/api`. *Précisé le 2026-09-27 (J3-A a3, a4) : l'API d'administration reste utilisable inscription fermée (code source) ; ne configurer aucun envoi ne suffit pas, voir EC-41* | `expert-cybersecurite` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu avec EC-41 — inscription fermée, crochet « puits », `max_frequency` 60 s, `secure_password_change`, constats ; clé *publishable* désactivée au J4 si le projet le permet (G-1). Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-17** | **Codes de secours du second facteur** (MFA-3) : à vérifier si Supabase Auth les fournit | S'ils n'existent pas nativement : table dédiée, codes hachés, usage unique, génération journalisée, consommation alertée (MFA-4). *Fait établi le 2026-09-27 (J3-A c3) : **ils n'existent pas** ; forme proposée en J3-C règle 9* | `expert-cybersecurite` + `expert-database` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — table dédiée sans droit des rôles métier, consommation atomique, **un code de secours ne satisfait jamais R**. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-18** | **Variables absentes de `.env.example`** : secret interne du passe-plat (`x-influx-internal`, PP-8), poivre des empreintes de débit (`04` §12.10, point 4), destinataires de secours des alertes de disponibilité (D60) ; aucun `.env.example` pour `apps/web` et `apps/backoffice` (`INFLUX_API_INTERNAL_URL`) | Les ajouter, avec valeurs factices, dans le commit qui les utilise | `integrateur` + `expert-cybersecurite` | J1, J3 — **noms et fichiers arrêtés par `architecte` le 2026-09-25** (§4, J1-F) ; reste la confirmation `integrateur` + `expert-cybersecurite` |
| **EC-19** | **Porteurs des variables Brevo.** `02` §12.3 réserve `BREVO_API_KEY` au worker, alors que `apps/api` envoie lui-même le code de connexion (D43, `02` §18.10) et les alertes de disponibilité (D60, `02` §20.5), et reçoit le webhook (EC-12) ; `apps/api/.env.example` n'indique aucun service pour les variables Brevo | `api` : `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN`, `BREVO_IP_ALLOWLIST`. `worker` : les cinq premières, plus `BREVO_SENDER_MARKETING`, `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID`. Corriger `02` §12.3, la skill `env-secrets` et `.env.example` | `integrateur` + `expert-cybersecurite` (clé Brevo sur le service HTTP) | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — clé Brevo sur `api` **acceptée** ; **deux clés distinctes** (`api`, `worker`) ; `BREVO_MODE` et `BREVO_TEST_RECIPIENTS` sur `api` dès le commit 8 ; secrets du webhook sur `api` seul (J7) ; garde statique des chemins Brevo ; restriction IP chez Brevo à surveiller. `02` §12.3, skill `env-secrets` et `.env.example` corrigés. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-20** | **Une variable pour deux rôles de connexion.** Si EC-1 retient un rôle de connexion élevé par service, `ELEVATED_DATABASE_URL` prend deux valeurs différentes (`api`, `worker`) : impossible dans le seul `apps/api/.env.local` où tournent les deux processus, et une valeur posée sur le mauvais service Railway ne se voit pas | Deux noms qui disent le rôle : `AUTH_DATABASE_URL` (`api`, rôle de connexion membre d'`influx_auth` seul) et `WORKER_DATABASE_URL` (`worker`) ; `ELEVATED_DATABASE_URL` disparaît | `expert-cybersecurite` + `expert-database` (avec EC-1), `integrateur` | J2 — **Tranché par `expert-cybersecurite` le 2026-09-26** : proposition retenue. **`api`** : `DATABASE_URL` (`influx_app`) et `AUTH_DATABASE_URL` (`influx_auth_login`), plus `OPS_DATABASE_URL` au J4. **`worker`** : `WORKER_DATABASE_URL` (`influx_worker_login`) **seule** — ni `DATABASE_URL` ni `AUTH_DATABASE_URL` —, plus `PRIVACY_DATABASE_URL` au Lot 5. `DIRECT_DATABASE_URL` : CI seule (CI-5), inchangée. **`ELEVATED_DATABASE_URL` disparaît** partout (`02` §12.3, J1-D, J2 point 4, T4.6, skill `env-secrets`). Refus de démarrage : l'utilisateur de chaque URL (avant le `.` du multiplexeur) doit être **exactement** le rôle attendu ; deux URL d'un même processus ne partagent jamais le même utilisateur ; à l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont vérifiés en base ; sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent), la présence d'une variable de base réservée à un autre service fait échouer le démarrage. **`apps/api/.env.example`**, dans le commit du J2 qui les lit : trois lignes `DATABASE_URL=postgresql://influx_app.your-project-ref:CHANGE_ME@HOST:6543/postgres`, `AUTH_DATABASE_URL=postgresql://influx_auth_login.your-project-ref:CHANGE_ME@HOST:6543/postgres`, `WORKER_DATABASE_URL=postgresql://influx_worker_login.your-project-ref:CHANGE_ME@HOST:6543/postgres`, chacune commentée avec son rôle, ses appartenances, ses opérations et son **seul** service ; un commentaire rappelle le format `<rôle>.<référence du projet>`, le port 6543 (mode transaction), TLS obligatoire, et qu'en pile locale la connexion est directe, sans suffixe |
| **EC-21** | **PP-6 : d'où vient l'adresse IP du client ?** Un gestionnaire de route Next.js n'a pas accès à la connexion (la propriété `ip` de la requête a disparu en Next.js 15) : l'adresse ne peut venir que d'un en-tête posé par l'entrée de Railway, dont on ignore s'il écrase une valeur fournie par le client. La limitation de débit par IP (T8, T15) en dépend | Une fonction unique `clientAddress()` dans `src/server/relay.ts`, qui lit l'en-tête documenté par Railway (l'entrée ajoutée par Railway, jamais celle du client) ; `apps/api` ne lit l'adresse relayée qu'après validation du secret interne ; **constat sur `staging` au J4** avec un en-tête forgé | `expert-cybersecurite` + `integrateur` | J3 (usage), J4 (constat) — **tranché par `expert-cybersecurite` le 2026-09-25** (revue de fin de J1, A5 ; `03` PP-6 et §6.4) : source unique **`x-real-ip`** écrit par l'entrée Railway, **jamais `x-forwarded-for`** ; `clientAddress()` ne garde que la forme `^[0-9A-Fa-f:.]{2,45}$` et retransmet sous `x-real-ip` ; `apps/api` en `trustProxy: false`, `request.ip` jamais lu, `x-real-ip` lu après `identifySurface`, validé par zod, `::ffff:` ramené en IPv4, clé /32 ou /64 en empreinte HMAC-SHA-256 (`AUTH_THROTTLE_PEPPER`), jamais en clair dans `ops` ni `pino` ; adresse absente ou invalide : compteur par e-mail + compteur global à plafond strict + `warn`, alerte en production ; constat J4 refait à chaque changement d'entrée (un CDN change la source) |
| **EC-22** | **La route de santé publique de `apps/web`** (D60, `02` §20.10) n'entre pas dans la liste blanche de G5 (`02` §13.1 : « le seul fichier de route autorisé »), et le `proxy.ts` de next-intl la redirigerait vers `/fr/…` | Liste blanche à deux entrées : `src/app/health/route.ts`, réponse `200` ou `503` **à corps vide**, fondée sur `GET /v1/status` par le client d'API, mêmes contraintes de contenu que le passe-plat, exclue du `matcher` du proxy | `architecte` + `expert-cybersecurite` (`02` §20.12) | J9 (sonde) |
| **EC-23** | **La skill `env-secrets` indique « Local : `.env` »** (§ Ajouter une variable, étape 4), alors que D62 impose `apps/api/.env.local` (le `.env` est chargé par la maquette) ; elle ne dit rien des fichiers des fronts ni du fichier `staging` | Étape 4 : `apps/api/.env.local` (pile locale et clés de test D62), `apps/api/.env.staging.local` (sans clé Brevo ni Apollo, sans `DIRECT_DATABASE_URL`), `apps/<front>/.env.local` (chargé nativement par Next.js) | `integrateur` | J1 (documentation) — **Fait le 2026-09-26** par `integrateur` : étape 4 de la skill `env-secrets` réécrite selon la proposition (avec l'alignement d'EC-20) |
| **EC-24** | **`SESSION_COOKIE_SECRET` est décrit comme « secret de signature du cookie de session »**, alors que la session est un identifiant opaque dont seule l'empreinte est en base (EC-2) : il n'y a rien à signer. Son usage réel serait la signature des jetons courts (cookie de parcours, jeton d'inscription d'EC-4) | Nommer la variable d'après son usage réel (`AUTH_TOKEN_SIGNING_SECRET`), ou corriger sa description ; ne pas signer l'identifiant de session | `expert-cybersecurite` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu — `AUTH_TOKEN_SIGNING_SECRET`, l'identifiant de session n'est jamais signé, valeur distincte des autres secrets ; `02` §12.3, skill `env-secrets`, `03` T11 et `.env.example` corrigés. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-25** | **Libellés du backoffice : « aucun fichier de traduction » ou un module de libellés ?** `18` §5, annexe 1, dit que tant que D36 est ouverte, la garde vérifie que `apps/backoffice` n'a **aucun** fichier de traduction ; J1-E (§4) crée `src/messages/fr.ts`, module unique de libellés français, pour qu'aucun littéral ne soit écrit en JSX | *Appliquée au J1, sans risque (relevé par `dev-react-node` le 2026-09-25)* : la garde du backoffice vérifie un **seul** module de libellés, `src/messages/fr.ts`, l'absence de tout dossier `locales/` et de tout fichier JSON sous `src/`, et l'absence de `next-intl` (dépendance et imports). La décision D36 reste ainsi visible. Reformuler `18` §5, annexe 1, en ce sens | `testeur` + `architecte` | — (J1 livré avec la proposition) |
| **EC-26** | **Messages `FST_*` conservés dans le journal (A1) : deux d'entre eux citent des valeurs.** A1 conserve le message des erreurs `FST_*`. Or le gabarit de `FST_ERR_REP_ALREADY_SENT` cite **l'URL brute de la requête, chaîne de requête comprise** (`02` §20.8 l'interdit), et celui de `FST_ERR_FAILED_ERROR_SERIALIZATION` cite **le message d'une autre erreur** (qui peut porter des paramètres SQL). D'autres gabarits de Fastify 5.12.5 interpolent une valeur (`FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH`), mais ne passent pas par le journal dans notre configuration | *Appliqué au plus prudent par `dev-react-node` le 2026-09-25 (457663e)* : le message de ces **deux** codes est écarté comme celui de toute autre erreur (le code suffit au diagnostic), liste fermée dans `apps/api/src/platform/logger.ts`. À confirmer, ou à remplacer par « aucun message `FST_*` » (plus simple, plus sûr, un peu moins lisible). **Tranché par `expert-cybersecurite` (2026-09-25) : aucun message `FST_*`.** Le message n'est conservé que pour `ApiError`, `RequestValidationError` et `ConfigError` ; la liste `FASTIFY_CODES_QUOTING_VALUES` disparaît, le code et le statut suffisent. Motifs : une liste d'exclusions est une liste noire, contraire au principe de liste blanche d'A1 ; les greffons `@fastify/*` attendus au J3 utilisent aussi le préfixe `FST_` ; et le correctif d'EC-27 fait passer par notre code `FST_ERR_BAD_URL` et `FST_ERR_MAX_PARAM_LENGTH`, dont le message recopie l'URL. Test : une erreur `FST_*` portant un marqueur dans son message ne le laisse dans aucune ligne. **Même commit qu'EC-27** | `expert-cybersecurite` | J3 (avec EC-27) |
| **EC-27** | **La réponse de Fastify à une URL mal encodée contourne l'enveloppe, le secret interne et le filtre de sortie.** `GET /v1/%zz?email=…` reçoit un `400` au format propre de Fastify — `{"error":"Bad Request","code":"FST_ERR_BAD_URL","message":"'/v1/%zz?email=…' is not a valid url component","statusCode":400}` —, **avant** le contrôle du secret (le routeur répond seul, sans crochet ni journal) : un appelant sans secret obtient une réponse hors enveloppe (T7.9, T13.4) qui **recopie l'URL**. Constaté le 2026-09-25 par `dev-react-node`. Injoignable par le passe-plat depuis R1 (tout `%` refusé), donc seulement si le réseau privé devient joignable (le cas que PP-8 couvre) | Option `frameworkErrors` de Fastify : répondre `401` en enveloppe si le secret est absent ou inconnu, sinon `404 not_found` en enveloppe, sans rien recopier ; un test par code `FST_ERR_BAD_URL` et `FST_ERR_ASYNC_CONSTRAINT`. Non appliqué dans la passe J1-J (hors de la liste). **Tranché par `expert-cybersecurite` (2026-09-25) : correctif `frameworkErrors` au J3, en premier commit du J3, et au plus tard avant toute route `/v1/` à paramètre.** Périmètre élargi à **`FST_ERR_MAX_PARAM_LENGTH`, joignable par le passe-plat** dès qu'une route à paramètre existe : le passe-plat admet 200 caractères, Fastify limite un paramètre à 100 ; constaté le 2026-09-25 (route d'essai `/v1/creators/:id`) : `GET /v1/creators/<150 caractères>` reçoit un `414` hors enveloppe, avant le secret, qui recopie le chemin. Réponse : `401` en enveloppe si le secret est absent ou inconnu, sinon `404 not_found` en enveloppe, pour les **trois** codes ; rien de la requête n'est recopié ; ligne de journal sans message (EC-26) ; identifiant de requête selon A3. Tests : les trois codes, avec et sans secret, marqueur dans le chemin et dans la chaîne de requête absent de la réponse et du journal | `expert-cybersecurite` + `architecte` | J3 (premier commit, avant toute route à paramètre) |
| **EC-28** | **`18` T7.1 et T7.2 contredisent `03` PP-2 et PP-6 révisés.** T7.1 attend des refus « **après décodage** » (R1 : plus aucun décodage, tout `%` refusé) ; T7.2 attend que `x-forwarded-for` et `x-real-ip` soient « **réécrits** » (A5 : `x-forwarded-for` ni lu ni relayé, `x-real-ip` retransmis seulement s'il a la forme d'une adresse) | Reformuler T7.1 et T7.2 d'après PP-2 et PP-6 ; les tests unitaires du passe-plat suivent déjà `03` (4058bf2) | `testeur` | **Fait le 2026-09-25** (T7.1 et T7.2 reformulés dans `18`) |
| **EC-29** | **Qui écrit une session ?** *(relevé par `expert-database` au J2, 2026-09-26.)* `0004` crée `identity.sessions` (EC-2) et `identity.resolve_session()`, **en lecture seule** (`03` P7). Restent sans chemin d'écriture : la **création** à la vérification du code (membre) ou à la connexion du backoffice, le **renouvellement glissant** (`last_activity_at`, `idle_expires_at`) à chaque requête, et la **révocation** (déconnexion, suspension, changement de rôle, réinitialisation du second facteur, A-9) | Création : `influx_auth` (E-2, rattachement d'EC-5), `INSERT` de colonnes nommées dans `0108`. Renouvellement : `UPDATE (last_activity_at, idle_expires_at)` accordé aux quatre rôles métier **sur leur seule session**, borné en base par les contraintes de durée déjà posées (30 j / 180 j membres, 30 min / 8 h backoffice). Révocation par le titulaire : `UPDATE (revoked_at, revocation_reason)` sur sa ligne, motifs `logout` et `revoked_by_holder` seulement ; révocation d'un tiers, suspension : fonction `SECURITY DEFINER` journalisée (propriétaire `influx_identity_definer`) | `expert-cybersecurite` (veto) + `expert-database` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : création retenue (`influx_auth`, E-2) ; **renouvellement et révocation par le titulaire remplacés** par deux fonctions `SECURITY DEFINER` (`identity.touch_session`, `identity.revoke_own_session`) qui calculent les dates en base, plus un déclencheur d'irréversibilité — le droit `UPDATE (revoked_at, …)` proposé permettait de ressusciter une session révoquée. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-30** | **Création du compte à l'inscription** *(J2, 2026-09-26).* `04` §5.1 interdit toute écriture directe de `identity.account_roles` par un rôle d'exécution, et `identity.grant_role()` est réservée à `influx_admin` ; or l'inscription (E-2, sans session) doit créer **dans une transaction** le compte, **son rôle**, l'acceptation des CGU (`channel = 'signup'`), le consentement (D63) et, en cas d'invitation, le commercial responsable (D54) | Une fonction `SECURITY DEFINER` nommée `identity.provision_account(...)`, propriétaire `influx_identity_definer`, `EXECUTE` à `influx_auth` seul : rôle **limité à `advertiser` ou `creator`**, identité GoTrue et adresse issues de la vérification du code, écriture du registre. Pas de `GRANT INSERT` direct sur `account_roles` à `influx_auth` | `expert-cybersecurite` (liste fermée signée) + `expert-database` | J5 (J3 pour les comptes de démonstration, créés par script sous le rôle de migration) |
| **EC-31** | **Lecture du registre par un agent : « limitée à son périmètre d'exploitation » (`03` C(38))** — le périmètre n'est pas défini, donc pas exprimable en politique | `0006` n'accorde **aucune** lecture de `audit.audit_events` à `influx_agent` (l'administrateur lit, en `aal2`). Proposition : au J8, lecture par l'agent de l'**historique d'un objet** qu'il consulte (fiche de compte), par une fonction qui filtre sur `subject_type` et `subject_id` et journalise la consultation, plutôt qu'un `GRANT SELECT` sur la table | `expert-cybersecurite` | J8 |
| **EC-32** | **Noms de migrations incompatibles avec la CLI Supabase.** La CLI n'applique que les fichiers `<chiffres>_<nom>.sql` ; `04` §11.2 prévoit `0402a`, `0402b`, `0402c` (Lot 4), qui seraient **ignorés sans erreur**, et un ordre d'application (`0402a` avant `0402`) que le tri ne donnerait pas | Renuméroter au Lot 4 en entiers dans l'ordre d'application (par exemple `0402` → `0405`, décalage des suivants), et ajouter à la CI un contrôle qui échoue sur tout fichier de `supabase/migrations/` ne respectant pas `^[0-9]{4}_[a-z0-9_]+\.sql$` | `expert-database` + `integrateur` | Lot 4 (contrôle CI : J4) |
| **EC-33** | **Bornes des rôles de connexion** (`03` P7, règle 6 : « valeurs : `architecte` »). `0001` les pose avec des **valeurs d'attente** pour que T4.2 trouve `rolconnlimit` et `rolconfig` renseignés : `influx_app` 60 connexions, `statement_timeout` et `idle_in_transaction_session_timeout` 15 s ; `influx_auth_login` 20, 5 s ; `influx_worker_login` 10, 60 s | Valeurs à fixer par `architecte` d'après la taille de la grappe Supavisor (`[db.pooler]`), le plancher de 1 s de la demande de code (`02` §18.10) et la durée des purges du worker ; toute correction passe par une nouvelle migration | `architecte` | J4 (avant `staging`) |
| **EC-34** | **Autorité de certification du multiplexeur Supabase** *(relevé par `dev-react-node` au J2, 2026-09-27).* `03` P7 règle 1 exige TLS avec vérification du certificat (« autorité de Supabase »). `apps/api/src/db/pool.ts` active `ssl: { rejectUnauthorized: true }` hors hôte de bouclage, mais avec les autorités de Node : si le certificat de Supavisor est signé par l'autorité propre de Supabase, la connexion à `staging` échouera | Variable `DATABASE_CA_CERT` (certificat racine téléchargé depuis le tableau de bord, public), lue par `src/config/`, passée en `ssl.ca` ; constat sur `staging` au J4 | `integrateur` + `expert-cybersecurite` | J4 |
| **EC-35** | **Écarts d'écriture des tests du J2** *(`dev-react-node`, 2026-09-27)*, hypothèses appliquées au plus prudent : (1) forme `vide` ajoutée à T2 pour `billing.commission_rates` lu par `admin` (`0007` accorde `SELECT`, alors que `18` T2 règle 3 dit « toutes ses lignes `refus_droit` ») ; (2) un membre sans contexte qui insère dans `terms_acceptances` est refusé par le déclencheur `prepare_terms_acceptance()` (`23503`, même message qu'une version inconnue) avant la politique (`42501`) : déclaré `filteredInsertCode` dans le fichier d'attendus ; (3) T2.2 exclut, en plus de `supabase_migrations`, `_realtime` et `extensions`, créés par Supabase sous le rôle `postgres` ; (4) T6.3 exempte `src/config/schema.ts` (nomme toutes les variables pour refuser une variable mal placée, EC-20) et `packages/contracts/src/elevated-operations.ts` (déclare P) ; (5) le plancher de cas exécutés par famille (`18` §3 règle 2) n'est pas codé : seuls `.skip`, `.todo`, `.only` sont refusés ; (6) T4.7 « même cas pour la grappe élevée » n'est pas testable tant que l'union est vide : à écrire au J3 avec E-1 ; (7) la CI se connecte en direct (port 54322), pas par le multiplexeur local (`03` P7 règle 7, `18` §3 point 4) ; (8) T3.8 ouvre 50 connexions `influx_app` sur une limite provisoire de 60 (EC-33) | Confirmer ou corriger `18` T2, T2.2, T6.3 et §3 en conséquence | `testeur` + `expert-cybersecurite` | J3 — **Tranché le 2026-09-27** : les huit points acceptés, (5) plancher exigé au J3, (6) avec E-1, (7) multiplexeur éprouvé au J4 ; `18` corrigé. Voir J2, « Vérification de fin de J2 par `testeur` » |
| **EC-36** | **Ligne d'audit de `withElevatedTransaction`** *(J2, 2026-09-27).* `03` §6.7 point 7 exige une ligne par élévation ; son code d'événement, son sujet et son volume (C-7 : seulement si la transaction écrit) ne sont pas fixés. Implémentation d'attente : `audit.append('elevated.<opération>', 'elevated_operation', gen_random_uuid(), {operation})` après la fonction, à chaque transaction élevée. Aucun code `elevated.*` n'existe dans `audit.event_types` et `influx_auth` / `influx_worker` n'ont pas `EXECUTE` sur `audit.append()` : sans migration du J3, la première élévation échouera (voulu) | Codes et sujet dans la migration du J3 (`0108`), avec M2 ; appliquer C-7 | `expert-database` + `expert-cybersecurite` | J3 |
| **EC-37** | **Numérotation des migrations du J3** *(`architecte`, 2026-09-27, J3-A)*. `0108` appliquée au J3 puis au J4 sur `staging` précéderait `0101` à `0106`, écrites aux J5 et J6 : `supabase db push` **refuse** d'appliquer une migration plus ancienne que la dernière appliquée, sauf option `--include-all` (constat documenté). Et `transactional_sends.outbox_event_id` référence `outbox_events`, créée par `0101` | Numéroter **dans l'ordre d'application** : les migrations du J3 prennent `0010`, `0011`… (suite du Lot 0) ; `04` §11.2 renumérote la série `01xx` (même règle qu'EC-32) ; `outbox_event_id` en `bigint` **sans clé étrangère** jusqu'à `0101`, qui l'ajoute (une ligne `P0` l'a toujours nulle, D43) ; contrôle de CI : un nouveau fichier ne précède jamais le dernier fichier existant | `expert-database` + `integrateur` | J3 (première migration du jalon) — **Tranché par `expert-database` le 2026-09-28** : le J3 prend `0010` (crochet « puits », commit 5) puis `0011` à `0015` (commit 6) ; **`0108` disparaît** de la série du Lot 1, qui garde `0101` à `0107`, appliquées dans l'ordre des numéros ; `0101` ajoute la clé étrangère `transactional_sends.outbox_event_id → outbox_events(id)`. `04` §11.2 corrigé. **Contrôle de CI laissé à `integrateur`, avec celui d'EC-32 (J4)** : format `^[0-9]{4}_[a-z0-9_]+\.sql$`, et aucun fichier ajouté dont le numéro précède le plus grand numéro existant sur la branche de base |
| **EC-38** | **Limites de débit de GoTrue par adresse IP, alors que tout vient de `apps/api`** *(J3-A b9)*. GoTrue limite `/verify` à 30 requêtes par 5 min et par IP, `/token` à 150, le défi et la vérification TOTP à 15 par minute (non réglable). Vues de GoTrue, toutes les demandes viennent de l'adresse d'`apps/api` : ces seuils deviennent **un plafond global de la plateforme**, qu'un attaquant peut épuiser pour empêcher toute connexion | En-tête **`Sb-Forwarded-For`** sur chaque appel d'`apps/api` (clé secrète exigée, option `security_sb_forwarded_for_enabled` du projet), valeur = adresse normalisée d'A5 si elle est valide, rien sinon ; limites de la pile locale relevées dans `config.toml` pour les tests. **À valider** : l'adresse IP de l'utilisateur est alors transmise à Supabase (sous-traitant déjà désigné) et peut être conservée par le journal d'audit de GoTrue (`auth.audit_log_entries`) — durée, et désactivation possible de ce journal, à instruire. **Avis `expert-conformite-rgpd` du 2026-09-27 : autorisé sous conditions** (gravité **importante**, non bloquante pour le code du J3). L'adresse IP est une donnée personnelle (CJUE, *Breyer*, C-582/14) ; la transmettre à Supabase, déjà sous-traitant, pour limiter les tentatives **par client** relève de l'**intérêt légitime de sécurité** (art. 6.1 f et considérant 49 RGPD ; art. 32 : la disponibilité fait partie de la sécurité), sans consentement. « Ne rien transmettre » n'est **pas** retenu : la minimisation se mesure à une finalité qu'on doit pouvoir atteindre, et un plafond global rendrait la connexion de tous bloquable. Conditions : **(1) valeur préférée, une adresse de substitution pseudonyme** plutôt que l'adresse réelle (art. 25, protection dès la conception) : adresse IPv6 privée (`fd00::/8`) tirée de l'empreinte HMAC d'A5 (clé /32 ou /64, `AUTH_THROTTLE_PEPPER`), stable par client — GoTrue limite aussi bien, et Supabase ne reçoit ni l'adresse ni de quoi géolocaliser la personne. Acceptation par GoTrue à constater en pile locale (commit 7), faisabilité et innocuité à confirmer par `expert-cybersecurite` ; **repli** si le constat échoue ou si la sécurité s'y oppose : adresse réelle normalisée, **IPv6 tronquée à son préfixe /64** ; **(2)** adresse absente ou invalide : rien n'est transmis (déjà prévu) ; **(3) conservation côté Supabase bornée et écrite** dans `04` §9.1 : réglage « écrire les journaux d'audit dans la base » **désactivé** (INFLUX a son propre registre), ou, si `expert-cybersecurite` le veut, purge de `auth.audit_log_entries` à **90 jours** au plus ; journaux de la plateforme Supabase : durée fixée par l'offre (7 jours en Pro), **aucun renvoi de journaux (« log drain ») vers un tiers** sans nouvel avis ; test de constat : quelles tables du schéma `auth` gardent une adresse après chaque parcours (`sessions`, vidée par J3-C règle 2 ; `mfa_challenges` ; `audit_log_entries` ; `flow_state`), résultat reporté au §9.1 ; **(4)** politique de confidentialité : adresse IP traitée pour la sécurité de la connexion, intérêt légitime, destinataires (Railway, Supabase), durées ; **(5)** registre des traitements (ligne « sécurité de l'authentification ») et, avant la mise en ligne du Lot 1, contrat de sous-traitance Supabase signé et **lieu de stockage des journaux de la plateforme** vérifié dans la liste de ses sous-traitants ultérieurs (transfert hors UE possible). Détail : « Avis de conformité du J3 » (après J3-H) | `expert-cybersecurite` + `expert-conformite-rgpd` (veto, transmission de l'IP) ; `integrateur` (réglage J4) | J3 (code), J4 (réglage) — **Tranché par `expert-cybersecurite` le 2026-09-27** (partie sécurité) : en-tête **exigé** ; valeur **retenue avec l'avis de conformité** : **adresse IPv6 pseudonyme** de `fd00::/8` dérivée par HMAC (aucune adresse réelle chez Supabase), faisabilité et innocuité confirmées, acceptation par GoTrue à constater (commit 7 ou J4) ; repli : adresse réelle, IPv6 tronquée à /64 ; `auth.audit_log_entries` conservé et purgé à 90 jours (trace de G-1) ; limites locales jamais poussées vers un projet hébergé. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-39** | **Anti-rejeu du TOTP (B-3) non garanti par GoTrue** *(J3-A c4)*. Un défi est à usage unique et lié à l'adresse IP, mais **le même code** peut être présenté avec un nouveau défi dans sa fenêtre (période 30 s, un pas de décalage toléré : ≈ 90 s) | Conserver par compte l'empreinte HMAC du dernier code accepté et sa date ; refuser le même code pendant 90 s. Écarté : le crochet « MFA verification attempt » de GoTrue (logique hors de notre code et de nos tests) | `expert-cybersecurite` + `expert-database` | J3 (commit 6) — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — même code refusé **120 s**, écriture conditionnelle dans la transaction qui crée la session. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-40** | **Backoffice : pas de session `aal1`, et fraîcheur (R) sur la ligne de session** *(J3-C règle 4)*. Les appels TOTP de GoTrue exigent la session GoTrue de l'utilisateur, qu'on ne conserve pas d'une requête à l'autre (J3-C règle 2). Et `identity.sessions` n'a aucune colonne pour la dernière vérification TOTP, exigée pour R (revue du 2026-09-26, point (c)) | Session backoffice **née en `aal2`** (plus strict que `03` §6.2 : aucune session `aal1` n'existe) ; connexion en une requête ; inscription du TOTP en deux requêtes, **mot de passe ressaisi à la seconde** ; R = mot de passe + code ; colonnes `mfa_verified_at` et `mfa_method` (`totp` · `recovery_code`) sur `identity.sessions`, écrites par E-2, et contrainte « session backoffice ⇒ `aal2` » | `expert-cybersecurite` (veto) + `expert-database` ; `expert-ux` (ressaisie) | J3 (commits 6, 10) — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — contrainte surface ⇔ `aal`, fraîcheur écrite par `influx_auth` seul, R ≤ 5 min et jamais par un code de secours, plancher de durée, épinglage du facteur (G-1). Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-41** | **Envois natifs par les points d'accès publics de GoTrue** *(précise EC-16, J3-A a4)*. `/otp`, `/recover`, `/resend`, `/magiclink` envoient un e-mail à un utilisateur **existant**, inscription fermée ou non ; la clé *publishable* n'est pas un secret ; ne configurer aucun SMTP ne suffit pas (l'expéditeur intégré de Supabase prend le relais sur un projet hébergé) | **Crochet d'envoi « puits »** : fonction Postgres `auth_hooks.refuse_native_email(event jsonb)` qui refuse tout envoi et **n'écrit rien** (la charge porte un code), schéma dédié sans table, `EXECUTE` à `supabase_auth_admin` seul, `search_path` vide, déclarée par `[auth.hook.send_email]` (`pg-functions://…`). `generateLink` n'envoie rien, donc ne l'appelle pas (code source). Notifications natives de sécurité laissées désactivées. Ce n'est pas le crochet HTTP écarté par `02` §18.7. À constater : la réponse de GoTrue au refus, et **qu'un `/otp` refusé n'écrase pas le code en cours** d'un membre | `expert-cybersecurite` + `expert-database` | J3 (commit 5) — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci, avec EC-16. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-42** | **Asymétrie de durée chez GoTrue à l'étape 5 de `02` §18.10** *(J3-A b7)*. `admin.createUser` **insère** un utilisateur pour une adresse jamais demandée et répond `422 email_exists` sans écrire pour une adresse connue — donc pour tout compte INFLUX. R1 supprime la branche chez nous, pas cet écart chez GoTrue ; le plancher de 1 000 ms ne le masque que si la requête entière tient dessous | Mesurer au J3, en pile locale, la distribution des durées de l'étape 5 dans les deux cas et la part des requêtes qui dépassent le plancher ; si l'écart dépasse le bruit de l'appel à Brevo, porter le plancher au p99 mesuré. Le contrat de §18.10 ne change pas | `expert-cybersecurite` | J3 (commit 8) — **Tranché par `expert-cybersecurite` le 2026-09-27** : mesure locale au J3, **mesure décisive sur `staging` au J4** ; seuil : plus de 0,5 % des demandes d'une classe au-dessus du plancher ⇒ plancher = p99,9 de la classe la plus lente + 20 %. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-43** | **« Pays approximatif » sans source.** A-8 (e-mail du code), B-7 et BO-6 (connexion depuis un pays inhabituel), `sessions.country_code` : ni l'entrée Railway ni le passe-plat ne fournissent de pays, et aucune base de géolocalisation n'est retenue (J3-B) | Au MVP : `country_code` nul ; l'e-mail cite l'heure et le navigateur ; le signal « pays inhabituel » devient « navigateur inconnu » tant qu'une source n'existe pas. Sources possibles : en-tête d'un CDN (décision « domaines et DNS »), base GeoLite2 (licence, mise à jour mensuelle). **Avis `expert-conformite-rgpd` du 2026-09-27 : proposition du MVP approuvée** (colonne nulle, e-mail sans pays, signal « navigateur inconnu ») : c'est la solution la plus minimale, et aucune obligation n'impose de connaître le pays. **Une source future est acceptable sous conditions, sur nouvel avis avant son activation.** Par ordre de préférence : (a) **base de pays locale** (GeoLite2 Country ou équivalent) — aucune donnée ne sort ; licence à vérifier (celle de GeoLite2 impose notamment de supprimer les versions périmées) ; (b) **en-tête pays d'un CDN** — acceptable seulement si le CDN est retenu pour d'autres raisons, car c'est lui qui devient destinataire de tout le trafic (contrat de sous-traitance, transfert) : la décision de conformité porte sur le CDN, pas sur l'en-tête. Conditions communes : **niveau pays seul** (ISO 3166-1 alpha-2 ; jamais ville, région, coordonnées ni opérateur) ; déduit à la volée, **l'adresse n'est pas conservée** ; **finalité de sécurité seule** (e-mail du code, alerte, écran « mes sessions ») — jamais segmentation, Brevo, Apollo, recherche, statistiques commerciales, ni substitut au pays déclaré ; conservation = celle de la ligne de session ; **aucune suspension automatique** sur ce seul signal (le titulaire ou un humain confirme) ; mention dans la politique de confidentialité. **Point juriste** : la Loi 25 (Québec, art. 8.1 de la loi sur le secteur privé) impose d'informer au préalable et de laisser **désactivées par défaut** les fonctions permettant de localiser une personne — à qualifier avant d'activer une source pour des utilisateurs québécois | `expert-cybersecurite` + `product-owner` | J5 (e-mail), J8 (alerte) — **Tranché par `expert-cybersecurite` le 2026-09-27** (partie sécurité) : accepté, à surveiller (`03` S-12) — `country_code` nul, signal « navigateur inconnu » au J8, nouveauté du réseau proposée à `expert-conformite-rgpd`. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-44** | **Alertes du compte de secours (MFA-10) et de la consommation d'un code de secours (MFA-4) au J3.** Aucun canal d'alerte n'existe avant la file (`0101`, J6) et les alertes (J9) | J3 : ligne d'audit (`agent.break_glass_login`, consommation d'un code de secours) et ligne `pino` de niveau `error` sans donnée ; e-mail d'alerte par la file au J6 ; **bloquant avant toute mise en ligne** | `expert-cybersecurite` + `chef-de-projet` | J3, J6, J9 — **Tranché par `expert-cybersecurite` le 2026-09-27** : **accord**, sous conditions — codes d'audit au commit 6, test, e-mail à tous les administrateurs et au fondateur au J6 ; bloquant avant tout compte interne réel et toute mise en ligne. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-45** | **Invitation des comptes internes (MFA-1, B-8) et amorçage de la production.** Aucune table d'invitation n'existe ; le J3 prévoit « invitation ou script » | J3 : **script seulement** (comptes de démonstration, compte de secours). Invitation (lien à usage unique de 72 h lié à l'adresse, choix du mot de passe avec B-1) : J8. Premier administrateur de production : script lancé par une tâche de CI manuelle de l'environnement GitHub `production`, avec le rôle de migration et la clé secrète, jamais depuis un poste | `chef-de-projet` + `expert-cybersecurite` ; `integrateur` | J3, J8, J9 — **Tranché par `expert-cybersecurite` le 2026-09-27** : **accord**, sous conditions — script refusé hors hôte de bouclage, tâche de production approuvée par le fondateur, sans secret affiché, par invitation (jeton d'enrôlement de G-1). Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-46** | **Variables Supabase de `02` §12.3.** `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_JWKS_URL` n'ont aucun usage : tout appel à GoTrue porte la clé secrète (exigée par `Sb-Forwarded-For`, EC-38) et INFLUX ne vérifie aucun JWT (J3-C règle 3). Le worker n'a besoin de `SUPABASE_SECRET_KEY` qu'avec la purge E-4 des utilisateurs GoTrue (J6) | Retirer les deux variables ; `SUPABASE_URL` et `SUPABASE_SECRET_KEY` sur `api` au J3, `SUPABASE_SECRET_KEY` sur `worker` au J6 ; corriger `02` §12.3 et la skill `env-secrets` | `integrateur` + `expert-cybersecurite` | J3 — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, durci — une clé secrète Supabase **par service**, en-têtes sortants masqués, forme des en-têtes à constater au J4. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-47** | **Limitation de débit de la connexion du backoffice (BO-6, B-7).** `identity.auth_request_throttle` ne prévoit que les demandes de code des membres | Portées supplémentaires par adresse et par IP pour les échecs de connexion du backoffice (mot de passe ou code), seuils à fixer ; freiner l'essai, jamais verrouiller le compte (A-4) ; réponse identique quelle que soit l'étape en échec | `expert-cybersecurite` + `expert-database` | J3 (commit 6) — **Tranché par `expert-cybersecurite` le 2026-09-27** : seuils fixés — couple (adresse, IP) 5 / 15 min, IP 20 / h, IP inconnue 10 / h, adresse 10 échecs / h = alerte **sans blocage**, compte de secours 1 échec = alerte, plateforme 30 / h ; réservation avant GoTrue. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-48** | **Le contrôle I-4 ne couvre pas `supabase/config.toml`**, dont la section `[auth]` porte des réglages de sécurité (inscription, crochet d'envoi, TOTP, durée du code) | Étendre `packages/test-kit/scripts/check-security-review.ts` aux lignes modifiées des sections `[auth…]` de `supabase/config.toml` | `expert-cybersecurite` + `testeur` | J3 (commit 5) — **Tranché par `expert-cybersecurite` le 2026-09-27** : retenu, élargi à `[api]`, `[storage*]` et au motif `auth_hooks`. Règles et tests : §4, J3, « Arbitrages de sécurité du J3 » |
| **EC-49** | **La clé masquée `code` (J3-C règle 7) efface le code des erreurs gardé par A1** *(`dev-react-node`, 2026-09-27, commit 3 du J3)*. A1 (J1-J) conserve le `code` d'une erreur (`FST_*`, SQLSTATE, plus tard code d'erreur de GoTrue) : c'est l'élément de diagnostic retenu par EC-26 (« le code et le statut suffisent »). J3-C règle 7 ajoute `code` aux clés masquées, pour le code de connexion. Or pino applique le masquage **après** les sérialiseurs (constaté : `err.code` devient `[redacted]`), et un chemin `*.code` ne sait pas exclure `err` | *Appliqué au plus prudent, réversible (`0422906`)* : `code` masqué à tous les niveaux, comme l'exige la règle 7 ; le sérialiseur d'erreurs écrit le code sous **`errorCode`** (`err.errorCode`, `cause.errorCode`), comme les lignes de refus (`errorCode` au premier niveau) ; tests de J1-J et d'EC-27 alignés. À confirmer, ou à remplacer par une clé propre au code de connexion (`loginCode`, déjà masquée) en retirant `code` de la liste | `expert-cybersecurite` | J3 (commit 3) — **Tranché par `expert-cybersecurite` le 2026-09-27 : `errorCode` retenu**, `code` reste masqué à tous les niveaux (retirer `code` ferait dépendre le filet de la discipline de nommage, alors que `code` est le nom naturel du code de connexion dans un corps ou une réponse de GoTrue). **Correction exigée (Important, commit correctif avant le commit 7)** : `errorCode` n'est écrit que si la valeur a la forme d'un code de diagnostic, `^(?:[A-Za-z][A-Za-z0-9_]{1,63}\|[0-9A-Z]{5})$` (`FST_*`, `ERR_*`, `E*`, `UND_ERR_*`, codes GoTrue, SQLSTATE), sinon `"[unrecognized]"` — constaté en local : une erreur portant `code: "654321"` est aujourd'hui écrite `errorCode: "654321"`. Détail et tests : « Revue de sécurité des commits 1 à 4 du J3 » (§4) |
| **EC-50** | **`[auth.email] enable_signup = false` coupe le fournisseur e-mail de GoTrue, pas seulement l'inscription** *(`expert-database`, 2026-09-28, commit 5)*. J3-A a3 exige les deux `enable_signup` à `false`. Constaté dans l'environnement du conteneur local : la CLI 2.117 traduit `[auth] enable_signup = false` en `GOTRUE_DISABLE_SIGNUP=true`, mais `[auth.email] enable_signup = false` en **`GOTRUE_EXTERNAL_EMAIL_ENABLED=false`**, c'est-à-dire le fournisseur « Email » désactivé tout entier. D'après le code source de GoTrue, ce réglage refuse la connexion par mot de passe (`Email logins are disabled`), donc la connexion du backoffice (commit 10), et peut-être la vérification du code (commit 9). **Non constaté en HTTP** : l'appel de GoTrue avec la clé secrète locale m'a été refusé par le contrôle des permissions (voir « Commits 5 et 6 du J3 ») | Laisser la valeur exigée (`false`) dans le commit 5 ; **constater au commit 7** (`signInWithPassword` d'un utilisateur créé par l'administration, `verifyOtp` d'un code obtenu par `generateLink`) ; si le refus est confirmé, passer `[auth.email] enable_signup` à `true` : la fermeture de l'inscription reste portée par `[auth] enable_signup = false` (`GOTRUE_DISABLE_SIGNUP`), et le constat « `POST /auth/v1/signup` refusé » la prouve | `architecte` + `expert-cybersecurite` | Commit 7 (constat), avant les commits 9 et 10 — **Avis `expert-cybersecurite` du 2026-09-28 : plan retenu.** `false` au commit 5 (échec fermé). Si le constat du commit 7 confirme le refus de `signInWithPassword` ou de `verifyOtp`, passer `[auth.email] enable_signup` à `true` dans un commit marqué (I-4), à trois conditions : `[auth] enable_signup = false` inchangé et vérifié par `t8-auth-settings` ; constats `POST /auth/v1/signup` refusé **et** `POST /auth/v1/otp` avec `create_user: true` pour une adresse inconnue ⇒ aucun utilisateur créé ; au J4, sur les projets hébergés, fournisseur « Email » activé et « Allow new users to sign up » désactivé, relus par `integrateur`. Trois constats verts : pas de nouvelle relecture de ma part. Un constat divergent me revient. **Constaté au commit 7 (2026-09-28) : divergent** — `verifyOtp` fonctionne, `signInWithPassword` est refusé : **EC-55**. **Tranché par `expert-cybersecurite` le 2026-09-28 : bascule à `true` retenue**, dans le commit marqué d'EC-55 (conditions et tests : ligne EC-55 et « Arbitrages après le commit 7 ») |
| **EC-51** | **Les limites locales par `env()` rendent toute commande de la CLI Supabase dépendante de deux variables** *(`expert-database`, 2026-09-28, commit 5)*. EC-38 point 4 impose `env()` pour les limites relevées en local. Constaté : sans `INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT` et `INFLUX_LOCAL_AUTH_VERIFY_LIMIT`, `supabase start`, `stop`, `status` et `db reset` échouent tous (`CliConfigParseError`) — échec fermé, mais chaque poste et chaque agent doit les exporter ; et au J4, un `supabase config push` lancé avec ces variables à `1000` pousserait `1000` vers un projet hébergé | Appliqué dans le commit 5 : les deux variables au niveau du flux de CI (`1000`). **À trancher** : (a) un script `pnpm db:*` qui les pose pour la pile locale seulement (proposé), documenté dans la skill `env-secrets` ; (b) au J4, `config push` par un script qui les **impose à `30`** (valeur par défaut de GoTrue) et refuse toute autre valeur | `integrateur` (+ `expert-cybersecurite` pour (b)) | (a) avant le commit 7 ; (b) J4 — **Avis `expert-cybersecurite` du 2026-09-28 : aucune valeur secrète.** Ce sont des plafonds de débit de la pile locale, publics par nature. Ils n'ont rien à faire dans un `.env*` ni dans les secrets GitHub, et restent en clair dans le flux de CI, **au niveau de la tâche `check`** (C5-2), jamais du flux entier. (a) retenu si le script ne pose les variables que pour `start`, `stop`, `status`, `db reset` et refuse `config push`, `link`, `db push` et toute option `--linked`, `--project-ref` ou `--db-url` ; à documenter dans la skill `env-secrets` comme variables non secrètes, locales seulement. (b) retenu, avec une préférence pour des valeurs explicites dans `[remotes.<env>.auth.rate_limit]` si la CLI les applique à `config push` (constat `integrateur`, J4 ; couvertes par I-4 après C5-1). Le script reste la seconde barrière |
| **EC-52** | **Sujet et volume des lignes `elevated.*` quand aucun compte n'existe** *(`expert-database`, 2026-09-28, commit 6)*. EC-36 fixe « sujet = compte pour E-1 et E-2 ». Or `identity.request_code` et `identity.verify_code` touchent aussi des adresses **sans compte** (inscription, adresse inconnue, anti-énumération R1), et un sujet ne peut être ni nul ni aléatoire. Et C-7 (« une ligne si la transaction a écrit ») compterait comme écriture la **réservation d'une tentative** (EC-3, EC-47), faite avant GoTrue dans sa propre transaction : chaque essai d'un attaquant ajouterait une ligne au registre, **jamais purgée**, et prendrait le verrou de chaîne, qui sérialise toutes les écritures du registre | Appliqué au plus prudent dans `0011`, **réversible tant qu'aucune ligne réelle n'existe** : sujet des deux motifs membres = **`login_request`**, la référence aléatoire de la ligne `leads.transactional_sends` (EC-3), qui existe toujours, compte ou non ; sujet des trois motifs du backoffice = `account`. **Proposé pour le commit 8** : C-7 précisé — `withElevatedTransaction` n'écrit la ligne que si `fn` rend un sujet (un effet autre que les compteurs : ligne de journal, session, facteur épinglé, code consommé) ; une réservation ou un échec compté seuls n'écrivent que les compteurs et une ligne `pino`. Une tentative de connexion du backoffice sur une adresse inconnue n'a donc pas de ligne `elevated.*` | `expert-cybersecurite` | Commit 8 (première élévation) — **Tranché par `expert-cybersecurite` le 2026-09-28.** (1) `elevated.identity.request_code` : sujet `login_request` **retenu**. C'est le seul objet qui existe pour une adresse connue comme inconnue, sans aléa. (2) `elevated.identity.verify_code` : sujet **`account`** (C6-1, avant le commit 6). Avec la règle (3), une ligne de ce motif ne naît que d'une session créée, donc d'un compte ; le registre permanent relie alors chaque passage par le chemin élevé au compte touché, même après la purge du journal et des sessions. Motifs du backoffice : `account`, retenu. (3) **C-7 précisé, retenu pour le commit 8** : `withElevatedTransaction` écrit la ligne si et seulement si `fn` rend un sujet. **Pas de sujet** : une réservation, un échec compté, l'issue (`sent` ou `failed`) d'une ligne de journal existante. **Un sujet** : l'insertion d'une ligne de journal, la création d'une session, l'épinglage d'un facteur, la consommation d'un code de secours. Une demande de code donne donc **une** ligne de registre, dans la transaction de l'insertion, jamais deux ; sans sujet, une ligne `pino` sans donnée. *Tests (commits 8 à 10), par motif* : chemin à effet ⇒ exactement une ligne, avec le sujet attendu ; réservation seule, échec compté ou issue ⇒ zéro ligne ; vingt réservations parallèles ⇒ zéro ligne. (4) Volume résiduel **accepté** : une ligne par demande de code acceptée, bornée par RG44 et EC-47, sans donnée personnelle (identifiant aléatoire). Le nombre horaire de lignes `elevated.identity.request_code` entre dans les métriques D60 (J9) |
| **EC-53** | **Écarts de forme, tous plus stricts que les arbitrages du J3** *(`expert-database`, 2026-09-28, commit 6)*. (1) **EC-39** : une ligne par **(compte, code accepté)** et non « une ligne par compte » — avec une seule ligne, un code ancien rejoué **après** un code plus récent (même fenêtre de 90 s) serait accepté ; les lignes de plus de 120 s sont effacées par la fonction elle-même. (2) **EC-17 point 2, EC-3, EC-47** : `influx_auth` n'a **aucun droit de table** sur les codes de secours, les jetons d'enrôlement, l'anti-rejeu et les compteurs ; il passe par sept fonctions `SECURITY DEFINER` (propriétaire `influx_identity_definer`) qui écrivent elles-mêmes leurs lignes d'audit — une injection ne peut ni remettre un compteur à zéro, ni lire une empreinte. La génération des codes de secours n'existe **que** dans `identity.pin_mfa_factor()` : aucune régénération libre (EC-17 point 5), en base. (3) **EC-44, G-1** : quatre événements (`agent.break_glass_login`, `agent.unexpected_mfa_factor`, `agent.reauthentication_failed`, `security.backoffice_login_failures`) passent par une **seconde fonction étroite**, `audit.append_auth_event()`, à liste fermée et charge utile vide, puisque `append_elevated()` n'accepte que `elevated.*`. (4) **EC-29 point 1** : à la création, toutes les dates, l'`aal` et la première fraîcheur sont **calculées par un déclencheur** (aucune n'est accordée en colonne). (5) Le type de statut du journal est `leads.email_send_status` (`04` nommait `matching.email_status`, schéma du Lot 4) | Appliqués dans `0011` à `0015`, décrits en tête de chaque migration | `expert-cybersecurite` | Relecture préalable du commit 6 — **Tranché par `expert-cybersecurite` le 2026-09-28 : les cinq écarts sont retenus**, tous plus stricts. (1) Clé par code : retenue. Un code ancien rejoué après un plus récent était précisément le trou de « une ligne par compte ». (2) Fonctions `SECURITY DEFINER` au lieu de droits de table : retenues. `pin_mfa_factor()` fondée sur le seul jeton est conforme à G-1 point 2, puisque la base ne peut vérifier ni le mot de passe ni le TOTP chez GoTrue ; conditions au commit 10 dans « Revue de sécurité des commits 5 et 6 du J3 », point 2.2. (3) `append_auth_event()` : retenue. Son sujet n'est pas vérifié : une injection sur la grappe d'`influx_auth` peut écrire de fausses alertes, sans pouvoir en effacer (S-3, accepté). (4) et (5) : retenus. **Complément exigé : C6-2** (une session backoffice n'est créée que si un facteur est épinglé) |
| **EC-54** | **Liste fermée des résumés de navigateur : emplacement et contenu provisoires** *(`dev-react-node`, 2026-09-28, commit `b151f1a`)*. La décision sur `05` Q14 laisse à `architecte` l'emplacement de la liste, écrite par `apps/api` et affichée par les deux fronts, et à `product-owner` son contenu (sous RG-J3-5). Il fallait une liste pour écrire le module de résumé | *Appliqué au plus prudent, réversible* : **emplacement** `packages/contracts/src/user-agent.ts` (export `@influx/contracts/user-agent`, proposé par `expert-cybersecurite`) ; **contenu minimal** : familles `chrome`, `edge`, `firefox`, `safari`, `samsung_internet`, `opera`, `instagram`, `facebook`, `tiktok` × systèmes `windows`, `macos`, `ios`, `android`, `linux`, `chromeos` (54 valeurs), plus `unidentified.unidentified` quand la famille **ou** le système n'est pas reconnu (aucune valeur partielle « Chrome sur système inconnu ») ; clés au format de la contrainte en base, aucun chiffre (test). `opera` ajouté aux familles exigées par le test : sinon Opera serait résumé « Chrome ». Libellés traduits non écrits (commits 8 et 9) | `architecte` (emplacement) ; `product-owner` (contenu, libellés FR/EN, valeur partielle ou non) | Avant le commit 8 (premier libellé affiché) |
| **EC-55** | **Constat d'EC-50 divergent : la connexion par mot de passe est refusée** *(`dev-react-node`, 2026-09-28, commit 7)*. Avec `[auth.email] enable_signup = false` (fournisseur « Email » coupé, `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`), GoTrue v2.196 **vérifie le code** (`verifyOtp` : `200`) mais **refuse `signInWithPassword`** (`422 email_provider_disabled`) : la connexion du backoffice (commit 10) est impossible. Conséquences annexes : `/otp`, `/magiclink`, `/recover`, `/resend` sont refusés **avant** le crochet « puits » (`email_provider_disabled`), donc l'oracle `/recover` attendu (`403` / `200`) n'existe pas, mais `/otp` distingue un utilisateur existant (`email_provider_disabled`) d'une adresse inconnue (`otp_disabled`). **Expérience locale, non commitée**, avec `enable_signup = true` : inscription publique toujours refusée ; `/otp` avec `create_user: true` ne crée personne ; mot de passe accepté ; `/otp`, `/magiclink`, `/recover` ⇒ `403` constant du crochet ; `/recover` d'une adresse inconnue ⇒ `200` (l'oracle attendu) ; code en cours toujours accepté après un `/otp` refusé ; Mailpit vide. **Observation nouvelle** : une session GoTrue obtenue directement par un **membre sans TOTP** (scénario G-1 (c)) peut **poser un mot de passe GoTrue** (`PUT /user` : `200`) ; fournisseur coupé, il n'ouvre rien ; **après la bascule, il ouvrirait des sessions GoTrue par `/token`** — jamais une session INFLUX (J3-C règle 3), mais un accès durable à `PUT /user` et `/factors` sans nouveau code | Appliquer le plan retenu pour EC-50 : **commit marqué séparé** (I-4, `config.toml`) qui passe `[auth.email] enable_signup` à `true`, avec `[auth] enable_signup = false` inchangé et vérifié par `t8-auth-settings` ; les cas de `t8-gotrue-findings` affirmés « tel que constaté » (EC-41 point 4, oracle, EC-50, G-1 (c)) y basculent vers les valeurs de l'expérience ci-contre. Pour l'observation : proposer de l'accepter comme déni de service et persistance **côté GoTrue seulement**, fermés au J4 par G-1 point 4 (aucune clé *publishable* active) ; sinon, au commit 9, relire à chaque vérification de code que l'utilisateur GoTrue n'a **aucun mot de passe** (`admin.getUserById`, champ à constater) | `expert-cybersecurite` (+ `architecte`) | **Commit 10** (connexion du backoffice) ; la bascule avant le commit 9 si ses constats doivent porter sur la configuration finale. **Non écrit** par `dev-react-node` — **Tranché par `expert-cybersecurite` le 2026-09-28.** (1) **Bascule retenue**, commit marqué séparé `chore(supabase): enable the e-mail provider, sign-up stays closed`, **avant le commit 9** (au plus tard avant le commit 10, les tests du commit 9 relancés sur la configuration finale) ; contenu, conditions et tests : « Arbitrages après le commit 7 », point 1. Marqueur accordé d'avance à ce diff exact ; tout autre changement `[auth*]` dans ce commit l'annule. (2) **Observation « mot de passe GoTrue posé par un membre » : à surveiller, portée de `03` S-11 élargie** — aucune session INFLUX, aucune donnée ; parades au commit 10 (refus uniforme d'une identité GoTrue non interne) et au J4 (G-1 point 4). **Contre-proposition refusée** : relire l'absence de mot de passe au commit 9 (l'objet utilisateur de GoTrue ne l'expose pas ; le lire dans `auth.users` donnerait à un rôle d'exécution un droit sur le schéma `auth`) |
| **EC-56** | **J3-A c6 divergent : une nouvelle inscription TOTP ne supprime pas le facteur non vérifié** *(`dev-react-node`, 2026-09-28, commit 7)*. Constaté (GoTrue v2.196) : le facteur non vérifié reste ; une seconde inscription **du même nom convivial** est refusée (`422 mfa_factor_name_conflict`) ; un autre nom en crée un second, lui aussi non vérifié. Conséquences pour l'enrôlement en deux requêtes du commit 10 (J3-C règle 4) : un enrôlement abandonné puis repris avec le même nom échoue ; avec des noms distincts, les facteurs non vérifiés s'accumulent jusqu'au plafond `GOTRUE_MFA_MAX_ENROLLED_FACTORS=10` (local ; à constater en hébergé), après quoi l'enrôlement est refusé | Au commit 10, première requête de l'enrôlement : **supprimer par l'API d'administration** (`admin.mfa.listFactors`, `deleteFactor`) tout facteur TOTP **non vérifié** du compte avant d'en inscrire un, nom constant ; un facteur **vérifié** inattendu reste un refus uniforme (G-1 point 1). Test : deux premières requêtes de suite ⇒ un seul facteur non vérifié ; onze ⇒ jamais de refus de plafond | `architecte` + `expert-cybersecurite` | Commit 10 — **Tranché par `expert-cybersecurite` le 2026-09-28 : retenu, durci** (ordre des contrôles, identifiant du facteur, tests : « Arbitrages après le commit 7 », point 3) |
| **EC-57** | **J3-A d : plancher et plafond du mot de passe chez GoTrue** *(`dev-react-node`, 2026-09-28, commit 7)*. Constaté : `minimum_password_length = 12` est appliqué par `PUT /user` et par la **modification** d'un utilisateur par l'administration (`422 weak_password` à 11 caractères), **pas par sa création** (`admin.createUser` accepte 11 caractères) ; 72 octets UTF-8 acceptés, **73 octets ⇒ `500 unexpected_failure`** (échec du hachage, pas un refus propre) | Aucune dépendance au plancher de GoTrue : **les règles locales de B-1 passent avant tout appel** (12 caractères au moins, refus explicite au-delà de 72 octets UTF-8, sans troncature), y compris à la création par l'invitation (J8) et par le script de démonstration (J3-C règle 11), qui ne doit **créer aucun mot de passe de moins de 12 caractères** ; tests B-1 du commit 10 : un mot de passe de 73 octets n'atteint jamais GoTrue | `expert-cybersecurite` | Commit 10 ; commit 11 (script) — **Tranché par `expert-cybersecurite` le 2026-09-28 : retenu, durci** — garde doublée dans l'adaptateur (`verifyPassword` et toute opération qui pose un mot de passe) et constat d'oracle dans le commit marqué d'EC-55 (« Arbitrages après le commit 7 », point 4) |

---

## 4. Lot 0 — le socle (J0 à J4)

### J0 — Poste, dépôt et intégration continue (1 jour)

1. Installer **Docker Desktop** (moteur WSL 2) et **GitHub CLI** ; en option la CLI Railway et
   `psql`. *(Révisé le 2026-09-25, J1-A : la **CLI Supabase** n'est plus installée sur le système ;
   elle entre au J2 comme dépendance de développement épinglée à la racine.)*
2. Supprimer les restes de la maquette : `apps/api/node_modules`, `apps/backoffice/` (entier),
   `packages/contracts/node_modules` ; laisser ou supprimer `.env` et `apps/api/.env` (ignorés,
   jamais lus par le produit réel).
3. Créer `.github/workflows/ci.yml` : installation (`corepack enable`, `pnpm install
   --frozen-lockfile`), `pnpm check`. Workflow hebdomadaire vide, prêt pour T12.
4. **Fondateur** : second facteur activé sur GitHub, Supabase et Railway ; nombre de personnes
   ayant accès limité (`03` F-3). F-4 **tranché par le fondateur le 2026-09-25 : dérogation maintenue**, les migrations
   (`supabase/migrations/**`) se commitent directement sur `main`, avec le marqueur
   `security-reviewed: <date>` exigé par la CI (`03` I-4).

**Terminé quand** : la CI tourne sur `main` et reste verte sur l'état actuel.

### J1 — Squelette des applications et des contrats (3 jours)

> **Les décisions de l'architecte du 2026-09-25 (sous-section suivante, J1-A à J1-I) précisent les
> points 1 à 6 ci-dessous et, là où elles divergent, les remplacent**, ainsi que les tests et le
> « terminé quand » de ce jalon.

1. **`packages/contracts`** (`@influx/contracts`) : `errors.ts` (union fermée des codes et
   enveloppe `{ error: { code, message, details, requestId } }`, `02` §9.2) et `system.ts` (réponse
   de `/health` et `/v1/status`). *Révisé le 2026-09-25 (J1-E) : `common.ts` entre au J3 (langue),
   `elevated-operations.ts` au J2 (avec `withElevatedTransaction`), `identity/` au J3 — un module
   naît à son premier usage, comme un paquet (`02` §8).*
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

### J1 — décisions de l'architecte (2026-09-25)

> **Statut : tranché par `architecte`** (D64, `CLAUDE.md` §13). Confirmations attendues :
> `testeur` (couverture de J1-C et J1-H), `integrateur` et `expert-cybersecurite` (J1-F, J1-G et les
> écarts EC-19 à EC-24). Aucun code n'est écrit par ce document ; `dev-react-node` l'applique.

#### J1-A. Versions retenues

Vérifiées sur le registre npm le 2026-09-25 : toutes publiées **depuis plus d'un jour**
(`minimumReleaseAge: 1440`). **Chaque paquet entre dans le commit de son premier usage**, pas avant.

| Paquet | Version exacte | Publiée le | Espace de travail | Entre au | Remarque |
|---|---|---|---|---|---|
| `next`, `eslint-config-next` | **16.3.6** | 2026-09-22 | `apps/web` (montée depuis 16.3.5) et `apps/backoffice` | J1, **premier commit** | Version corrective de **sécurité** (exécution de code à distance dans `next/og`, `GHSA-vcvr-r3jv-pc5j`). `apps/web` n'importe pas `next/og` (vérifié), mais on ne crée pas une application sur une version dont on connaît une faille. Commit à part : `fix(web): bump next to 16.3.6` |
| `react`, `react-dom`, `@types/react`, `@types/react-dom` | 19.3.0 | 2026-09-09 | `apps/backoffice` | J1 | Alignées sur `apps/web` ; dernière version publiée |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | déjà au verrou | `apps/backoffice` (dev) | J1 | Alignées sur `apps/web` |
| `eslint` 9.39.5, `eslint-plugin-jsx-a11y` 6.10.2, `eslint-plugin-better-tailwindcss` 4.7.0 | — | déjà au verrou | `apps/backoffice` (dev) | J1 | Alignées ; ESLint 10 reste exclu (`docs/landing-page/01-architecture.md` §8) |
| `typescript` 6.0.3, `vitest` 4.1.11, `@types/node` 22.20.3 | — | déjà au verrou | tous les nouveaux paquets (dev) | J1 | Alignées. Vitest 5 et `@types/node` 24 : montée groupée de tout le dépôt, commit à part |
| `typescript-eslint` 8.70.0, `@eslint/js` 9.39.5 | — | déjà au verrou (via `eslint-config-next`) | `apps/api`, `packages/contracts`, `packages/test-kit` (dev) | J1 | ESLint des paquets sans Next.js |
| `zod` | 4.6.5 | 2026-09-13 | `packages/contracts`, `apps/api` | J1 | Les fronts n'en ont pas besoin au J1 |
| `fastify` | 5.12.5 | 2026-09-16 | `apps/api` | J1 | La 6.0 n'existe qu'en alpha |
| `pino` | 10.3.1 | 2026-02-09 | `apps/api` | J1 | Dépendance directe, parce que le worker journalise sans Fastify. Fastify 5.12.5 accepte `^9.14.0 \|\| ^10.1.0` : une seule copie |
| `drizzle-orm` | 0.45.3 | 2026-09-21 | `apps/api` | J2 | La 1.0 est en *release candidate* : si la 1.0 stable paraît avant le J2, `architecte` réexamine (commencer en 1.0 évite une migration à court terme) |
| `postgres` | 3.4.9 | 2026-04-05 | `apps/api` ; `packages/test-kit` (harnais de rôles) | J2 | `prepare: false` (`02` §5) |
| `supabase` (CLI) | 2.117.0 | 2026-09-07 | racine (dev) | J2 | Remplace l'installation système : **une seule version, dans le verrou, en local et en CI** (`pnpm exec supabase …`). Binaires livrés par des dépendances optionnelles par plateforme, **sans script d'installation**. La 2.118.0 (2026-09-25) est trop récente aujourd'hui |
| ~~`@supabase/supabase-js`~~ **`@supabase/auth-js`** | ~~2.117.1~~ **2.117.2** | 2026-09-25 | `apps/api` | J3 | *Révisé le 2026-09-27 (J3-B)* : `auth-js` seul, sans `postgrest-js`, `realtime-js`, `functions-js` ni `storage-js` ; unique dépendance `tslib` 2.8.1, déjà au verrou. `@supabase/storage-js` entrera seul au Lot 2 |
| `@fastify/cookie` | 11.1.2 | 2026-07-15 | `apps/api` | J3 | Compatible Fastify 5 (≥ 10.x) |
| `@playwright/test` | 1.63.0 | 2026-09-04 | `apps/web` (dev) ; `apps/backoffice` au J8 | J5 | Chromium seul, installé par commande explicite (`playwright install chromium`), mis en cache en CI |

**Écartés**

| Paquet | Motif | Ce qui le remplace |
|---|---|---|
| `tsup` | Son dépôt l'annonce : « This project is not actively maintained anymore » — éliminatoire sur une chaîne de production | Aucune construction (J1-B) |
| `tsdown` 0.23 | Pré-1.0 ; ajoute un empaqueteur natif (rolldown) pour produire ce que Node sait exécuter | Idem |
| `fastify-type-provider-zod` 7.0.0 | Déclare `@fastify/swagger` et `openapi-types` en dépendances pairs **obligatoires** : pnpm les installerait en production sans aucun usage. Trois versions majeures en douze mois (5.0 en juin 2025, 6.0 en septembre 2025, 7.0 en juin 2026), sur le chemin qui porte la **deuxième ligne de défense de l'anonymisation** | `apps/api/src/platform/schema-compilers.ts` : compilateur de validation (`safeParse`), compilateur de sérialisation (`parse` puis `JSON.stringify` — un `z.object` retire tout champ non déclaré), fournisseur de types Fastify. Une cinquantaine de lignes, **testées** (J1-H) |
| `pino-pretty` | Confort de lecture local ; transport par fil d'exécution | Journaux JSON ; réexaminé si la lecture devient une vraie gêne |
| `drizzle-kit` | Le SQL est écrit et relu à la main (`02` §5, règle 1) ; `push` est interdit de toute façon | — |
| `dotenv`, `tsx`, `server-only` | Node charge le fichier d'environnement (`--env-file-if-exists`) et exécute le TypeScript ; l'isolement du client d'API est vérifié par la garde des importeurs (J1-C) | — |

**`allowBuilds` : aucun ajout.** Aucun paquet retenu n'a besoin d'un script d'installation. Si pnpm
en signale un : `false` par défaut ; `true` seulement si l'outil échoue sans lui, avec un
commentaire (`docs/landing-page/01-architecture.md` §12).

**Installation après le 2026-09-25** (J2, J3, J5) : si une version corrective de la **même ligne
mineure** a paru entre-temps et a plus d'un jour, la prendre et corriger ce tableau dans le même
commit. Tout changement de mineure ou de majeure (Drizzle 1.0, Fastify 6…) repasse par
`architecte`. Exception : la CLI Supabase, qui publie une mineure par semaine — dernière stable de
plus d'un jour.

#### J1-B. `apps/api` s'exécute sans étape de construction

**Contexte.** Le §2.6 proposait `tsup` pour produire `dist/main.js` et `dist/worker.js`. `tsup`
n'est plus maintenu.

| Option | Pour | Contre |
|---|---|---|
| A. `tsup` | Connu, fondé sur esbuild | **Plus maintenu** |
| B. `tsdown` | Successeur désigné de `tsup` | Pré-1.0 ; un empaqueteur natif de plus |
| C. Script `esbuild` d'une trentaine de lignes | esbuild est mûr et déjà autorisé | Un script à entretenir ; cartes de source à activer pour que les piles d'erreurs (D60) désignent le code |
| **D. Aucune construction : Node efface les types** | **Zéro dépendance.** Même mode d'exécution en local, en `staging` et en production. **Numéros de ligne exacts dans les piles** (les types sont remplacés par des espaces), ce qui sert directement le regroupement d'erreurs de D60. Activé par défaut et sans avertissement depuis Node 22.18, **déclaré stable depuis Node 24.12** | Discipline d'écriture (ci-dessous) ; Node ≥ 24.12 exigé en production |

**Décision : D.** Conditions, toutes vérifiées par `tsc` :

1. `erasableSyntaxOnly: true` — ni `enum`, ni `namespace` porteur de code, ni propriété de
   paramètre, ni décorateur. Les unions de littéraux remplacent les `enum` (c'est déjà la forme des
   unions fermées de `packages/contracts`).
2. `verbatimModuleSyntax: true` — tout import de type est écrit `import type`.
3. `module` et `moduleResolution` en `nodenext` ; imports relatifs **avec l'extension `.ts`**
   (`allowImportingTsExtensions`) ; **aucun alias de chemin** (`paths`), que Node ignore.
4. Node ≥ 22.18 en local et en `staging` (le poste a 22.22) ; **Node ≥ 24.12 en production** :
   `.node-version` passe à `24` au plus tard au J9 (montée déjà prévue par `CLAUDE.md` §6).
5. `@influx/contracts` est exécuté en source TypeScript. Node refuse d'effacer les types sous un
   chemin `node_modules`, mais pnpm relie les paquets de l'espace de travail par lien symbolique et
   Node résout le chemin réel (`packages/contracts/src/…`). **À constater au J1** : c'est une
   condition de « terminé » (J1-H).

**Conséquences.**
- **Code** : `apps/api` n'a pas de script `build` (`pnpm build` l'ignore) ; `typecheck` fait le
  contrôle de types.
- **Déploiement** (`integrateur`, J4) : services `api` et `worker` en installation seule
  (`pnpm install --frozen-lockfile`), démarrés par **`node apps/api/src/main.ts`** et
  **`node apps/api/src/worker.ts`** — **`node` directement, jamais au travers de `pnpm start`**, pour
  que `SIGTERM` atteigne le processus et que l'arrêt propre fonctionne (`02` §4, règle 5), à vérifier
  par un redéploiement au J4. `02` §11.2 et §12.1 sont corrigés en ce sens.
- **Sécurité** : l'image contient des sources, qui ne contiennent aucun secret ; T11 porte sur les
  fronts et n'est pas concerné.
- **Coûts** : nuls.

**Si l'on se trompe** : l'option C en une demi-journée, sans toucher au code applicatif (esbuild
accepte les imports en `.ts`). **Réversibilité : élevée.**

#### J1-C. EC-13 — levée de G5 au J1 : confirmée, et élargie

**Ce qu'est G5.** Le bloc `describe("G5: no server endpoint (CA8)")` de
`apps/web/tests/guards.test.ts` (lignes 135 à 142) : il liste tout fichier `route.ts` ou `route.tsx`
sous `src/app` et exige une liste vide. Il traduit CA8 de la landing (« aucun point d'accès
serveur », `docs/landing-page/01-architecture.md` §9.3).

**Décision : G5 tombe au J1, dans le commit du passe-plat, avec son remplaçant.** La proposition
d'EC-13 est confirmée, avec quatre compléments :

1. **La garde annexe réseau tombe dans le même commit.** Le test « uses no network or storage API
   in the source code » (lignes 170 à 175) interdit `fetch(` dans tout `src/` : le passe-plat ne
   peut pas exister sans elle. Elle est **scindée** comme `02` §13.1 le prévoyait pour le Lot 1 :
   `fetch` autorisé dans **le seul** `src/server/api-client.ts` ; stockage navigateur (`localStorage`,
   `sessionStorage`, `indexedDB`, `document.cookie`, `cookieStore`, `sendBeacon`) toujours interdit
   partout. Même exception d'un seul fichier dans les règles ESLint `no-restricted-globals` et
   `no-restricted-properties`.
2. **La garde de remplacement**, écrite une fois dans `packages/test-kit` et appliquée aux deux
   fronts :
   - l'ensemble des fichiers de route sous `src/app` est **exactement**
     `{ src/app/api/[...path]/route.ts }` (liste qu'EC-22 pourra étendre d'une ligne) ;
   - `route.ts`, `src/server/relay.ts` et `src/server/api-client.ts` n'importent ni `@supabase/*`,
     ni `drizzle-orm`, ni `pg`, ni `postgres`, ne lisent pas `process.env` et ne contiennent pas
     `'use server'` ;
   - **garde des importeurs** : `relay.ts` n'est importé que par `route.ts`, `api-client.ts` que par
     `relay.ts`, `src/config/server.ts` que par `api-client.ts` (étendue au J5, quand des composants
     serveur appelleront l'API) — c'est ce qui garantit qu'aucun composant de la landing n'atteint le
     réseau (CA8 reste vrai pour la maquette) ;
   - **empreinte SHA-256** de ces quatre fichiers, épinglée une seule fois dans `packages/test-kit`
     (PP-12) : les fichiers des deux fronts sont donc **identiques octet pour octet**, et toute
     modification exige un geste conscient.
3. **Le `matcher` de `apps/web/src/proxy.ts` exclut `api/`** ; sans cela, next-intl redirige
   `/api/v1/…` vers `/fr/api/v1/…`.
4. **Inchangées jusqu'au J9** : G1, G2, G4, G6, la parité FR/EN, le confinement du module fictif.
   **Conservées et étendues au backoffice** : G3, G7. G2 s'applique donc au passe-plat : aucune URL
   littérale, l'adresse de l'API vient de la configuration.

`02` §13.3 est corrigé. `testeur` confirme la couverture : garde ci-dessus et tests unitaires des
conditions PP au J1, T7 complet au J9.

#### J1-D. Environnements locaux (§2.3) : confirmés, avec amendements

1. **Le J1 ne dépend ni de Docker ni d'une base.** **Réponse à la question posée : non, le schéma de
   configuration n'exige pas `DATABASE_URL` au J1.** Une variable exigée sans être lue pousse à y
   mettre une valeur factice et ne vérifie rien. Chaque variable entre dans le schéma **dans le
   commit qui la lit** : `DATABASE_URL`, `AUTH_DATABASE_URL` et `WORKER_DATABASE_URL` (EC-20
   tranché) au J2 avec `src/db/index.ts` ; `SUPABASE_*`, `SESSION_COOKIE_SECRET` (EC-24), `BREVO_API_KEY` et
   l'expéditeur transactionnel au J3 ; `APOLLO_API_KEY` au J6. Les variables déjà présentes dans
   `apps/api/.env.local` sont ignorées tant qu'aucun code ne les lit.
2. **Deux schémas, un par processus** : `loadApiConfig()` et `loadWorkerConfig()` sur un socle
   commun. Chaque service ne valide que ce qu'il porte (skill `env-secrets` : une variable sur le
   seul service qui en a besoin).
3. **Refus de démarrage dès le J1** (première moitié de T17) :
   - `api` et `worker` : `BREVO_MODE=live` hors production (`16` RG116) ; en production, toute autre
     valeur que `live` (colonne « Où » de RG116 : `disabled` et `redirect` n'existent pas en
     production) ; `redirect` sans `BREVO_TEST_RECIPIENTS` ;
   - `worker` : `SYNC_MODE=dry_run` en production (`02` §12.4) ; `SYNC_MODE=live` hors production
     avec `NON_PRODUCTION_RECIPIENT_ALLOWLIST` vide ;
   - `api` : secret interne absent, de moins de 32 octets, ou **identique pour les deux fronts**
     (J1-G).
   La seconde condition de RG116 (trois sous-domaines authentifiés) exige un appel à Brevo : elle
   vient au J9.
4. **Le code ne lit jamais de fichier d'environnement.** `src/config/` ne lit que `process.env`. Le
   fichier est chargé par Node **dans les seuls scripts de développement**
   (`node --watch --env-file-if-exists=.env.local src/main.ts`). En production, aucun indicateur,
   donc aucun fichier, même égaré dans l'image. Les fronts gardent le chargement natif de Next.js
   (`apps/<front>/.env.local`).
5. **À partir du J2** (Docker et CLI installés) : `apps/api/.env.local` porte la **pile locale**
   (valeurs de `supabase status`, mots de passe des rôles posés par le script local du J2) et, seul,
   les clés des comptes Brevo et Apollo **de test** (D62). `apps/api/.env.staging.local` (déjà ignoré
   par la règle `.env.*`) porte les valeurs de `staging`, lues par un script `dev:staging`
   (`--env-file=.env.staging.local`) ; il reproduit le service Railway `staging` : `BREVO_MODE=disabled`,
   `SYNC_MODE=dry_run`, **aucune clé Brevo ni Apollo**, **jamais `DIRECT_DATABASE_URL`** (CI seule,
   CI-5). L'en-tête de `apps/api/.env.example`, qui dit aujourd'hui « valeurs de `staging` », est
   réécrit au J2.
6. **Démarrer l'API ne dépend pas de la base** (J2 et après) : le pilote se connecte à la première
   requête ; `/health` répond `503` tant que la base est injoignable (D60).

#### J1-E. Structure des paquets

**Règle commune** : `"private": true`, `"type": "module"`, version `0.0.0`, dépendances des autres
paquets par `workspace:*`. Un module de `packages/*` **naît à son premier usage**, comme un paquet.

**`packages/contracts`** — `@influx/contracts`

```
packages/contracts/
├── package.json        dependencies : zod ; exports par sous-chemin, aucun point d'entrée « . »
├── tsconfig.json       comme apps/api, mais "types": [] (ni Node, ni DOM : ni process, ni fetch, ni console)
├── eslint.config.mjs   imports autorisés : zod et fichiers relatifs ; rien d'autre
├── src/
│   ├── errors.ts       ERROR_CODES (union fermée, snake_case) : validation_failed, unauthenticated,
│   │                   forbidden, not_found, conflict, payload_too_large, rate_limited,
│   │                   internal_error, service_unavailable ; schéma et type de l'enveloppe
│   └── system.ts       réponse de /health et de /v1/status : { status: "ok" }
└── tests/              schéma de l'enveloppe
```

`"exports": { "./errors": "./src/errors.ts", "./system": "./src/system.ts" }` — une ligne par
module : **ajouter un contrat se voit dans `package.json`**. `"sideEffects": false`. Aucun
`"main"`. Pas de barillet. `common.ts` entre au J3 et ne valide que le **format** des codes pays
(`^[A-Z]{2}$`) et devise (`^[A-Z]{3}$`) : l'appartenance est vérifiée par la clé étrangère vers
`reference.*` (la base est l'arbitre ; une seconde liste de 249 pays en TypeScript serait une
seconde source de vérité).

**`apps/api`** — `@influx/api` (application : aucun champ `exports`)

```
apps/api/
├── package.json · tsconfig.json · eslint.config.mjs · vitest.config.ts · .env.example
├── src/
│   ├── main.ts               loadApiConfig() → buildServer() → écoute sur "::" et PORT ;
│   │                         SIGTERM et SIGINT → app.close(), puis sortie
│   ├── worker.ts             loadWorkerConfig() → journalise environnement, SYNC_MODE, BREVO_MODE
│   │                         → boucle vide (un tour toutes les 5 s) ; AUCUN port ouvert ;
│   │                         SIGTERM → fin du tour, puis sortie
│   ├── server.ts             buildServer(config, options) : Fastify, identifiant de requête,
│   │                         compilateurs zod, hook onRoute, hook onRequest (secret et surface),
│   │                         gestionnaires d'erreur et de 404 à enveloppe, /health, /v1/status
│   ├── config/
│   │   ├── schema.ts         schémas zod purs (socle, api, worker) et règles croisées de J1-D
│   │   └── index.ts          loadApiConfig(), loadWorkerConfig() : SEULS lecteurs de process.env
│   └── platform/
│       ├── logger.ts         options pino communes : service, environnement, version
│       │                     (RAILWAY_GIT_COMMIT_SHA, sinon "local") ; masquage ; sérialiseurs
│       │                     sans URL brute ni en-tête (modèle de route seulement, 02 §20.8)
│       ├── schema-compilers.ts   validation et sérialisation zod, fournisseur de types (J1-A)
│       ├── errors.ts         code → statut HTTP → enveloppe ; 500 sans aucun détail (T13)
│       └── internal-auth.ts  secret interne à temps constant, surface, liaison au préfixe (J1-G)
└── tests/                    config, server, schema-compilers, logger (J1-H)
```

Arrivent ensuite : `src/db/` (J2), `src/platform/supabase.ts` et `src/domains/identity/` (J3). **Le
worker n'ouvre aucun port au J1** : Railway n'exige pas de contrôle de santé pour un service sans
domaine, et le battement de cœur en base (D60) sera le signal de vie ; `integrateur` réexamine au J4.
**`buildServer` refuse de démarrer si une route n'a pas de schéma de réponse** (hook `onRoute`) : la
règle 1 de `02` §4 devient structurelle au lieu d'être confiée à la revue.

Scripts de `apps/api/package.json` :

| Script | Commande |
|---|---|
| `dev` | `node --watch --env-file-if-exists=.env.local src/main.ts` |
| `dev:worker` | `node --watch --env-file-if-exists=.env.local src/worker.ts` |
| `dev:staging` | *(J2)* `node --watch --env-file=.env.staging.local src/main.ts` |
| `start` · `start:worker` | `node src/main.ts` · `node src/worker.ts` (commodité locale ; Railway lance `node` directement, J1-B) |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint . --max-warnings 0` |
| `test` | `vitest run` |

`apps/api/tsconfig.json` : `extends: "../../tsconfig.base.json"` ; `lib: ["ES2024"]` (pas de DOM) ;
`module` et `moduleResolution` : `nodenext` ; `verbatimModuleSyntax` et `erasableSyntaxOnly` :
`true` ; `types: ["node"]` ; `include: ["src", "tests", "*.config.ts"]`.

ESLint de `apps/api` (en plus de `typescript-eslint` strict et `no-explicit-any`) : `@supabase/*`
importable seulement dans `src/platform/supabase.ts` ; `drizzle-orm` seulement dans `src/db/**` et
les `repository.ts` (`02` §5, règle 6) ; `postgres` seulement dans `src/db/**` ; import du
`repository.ts` d'un autre domaine interdit (un bloc par domaine, généré à partir de la liste des
domaines de `02` §8 et `ops`) ; `process.env` interdit hors `src/config/**` ; `no-console` (le
journal passe par `pino`).

**`apps/backoffice`** — `@influx/backoffice`

```
apps/backoffice/
├── package.json · tsconfig.json · next.config.ts · postcss.config.mjs · eslint.config.mjs
├── vitest.config.ts · .env.example
├── tests/guards.test.ts     G3 et G7 (test-kit), garde du passe-plat, copie des tokens,
│                            absence de next-intl
└── src/
    ├── app/layout.tsx       <html lang="fr">, metadata.robots : noindex, nofollow, noarchive
    ├── app/page.tsx         page de connexion vide (contenu au J3, d'après 17b)
    ├── app/globals.css      même mécanisme que apps/web (Tailwind alimenté par les tokens)
    ├── app/api/[...path]/route.ts   identique à apps/web (J1-C)
    ├── config/server.ts     identique à apps/web
    ├── server/relay.ts · server/api-client.ts   identiques à apps/web
    ├── messages/fr.ts       libellés (D36 : français seul, sans next-intl) ; aucun littéral en
    │                        JSX, pour qu'un passage au bilingue ne coûte qu'un remplacement
    └── styles/tokens.css    copie OCTET POUR OCTET de apps/web/src/styles/tokens.css, vérifiée
                             par un test (la dérive fait échouer la CI) jusqu'à packages/ui
```

- `next.config.ts` : `agentRules: false`, `poweredByHeader: false`, `headers()` qui pose
  `X-Robots-Tag: noindex, nofollow, noarchive` sur `/:path*` ; le passe-plat le pose aussi sur ses
  réponses. La vérification sur les erreurs et les redirections relève de T10 (J9).
- Scripts : ceux de `apps/web`, avec `dev` = `next dev -p 3001` (web 3000, API 3100 en local) et
  `test:artifacts` (J1-H).
- Dépendances : `next`, `react`, `react-dom`, `@influx/contracts` ; développement : les versions de
  J1-A et `@influx/test-kit`. **Ni `next-intl`, ni `lucide-react`** (premier besoin réel).
- **Règles ESLint communes aux deux fronts** (réseau et stockage, imports interdits, `'use server'`,
  attribut `style`, `react/no-danger` en erreur — B10 —, `process.env` hors `src/config/`, classes
  Tailwind restreintes) : écrites **une fois** dans `eslint.front-rules.mjs` à la racine et importées
  par les deux `eslint.config.mjs`, pour qu'une règle de sécurité ne dérive pas entre les deux. Les
  règles propres à la maquette (module fictif, `next/link`, `action`) restent dans `apps/web` ;
  `next-intl` est interdit dans le backoffice.

**`packages/test-kit`** — `@influx/test-kit` (développement seulement)

```
packages/test-kit/
├── package.json     exports : "./guards", "./artifacts" ; "./db" au J2 (dépendance postgres)
├── tsconfig.json    comme apps/api
└── src/
    ├── guards.ts    parcours de fichiers, recherche de motifs, motifs de G3, détecteur de G7
    │                (son auto-contrôle devient un test du paquet), garde du passe-plat et
    │                empreintes de J1-C
    └── artifacts.ts T11 : analyse des artefacts de construction (J1-H)
```

Les gardes de `apps/web` sont **extraites sans changement de comportement** : mêmes portées, mêmes
motifs, mêmes attendus.

**Comment les fronts consomment `@influx/contracts`.** `"@influx/contracts": "workspace:*"` en
`dependencies`, `transpilePackages: ["@influx/contracts"]` dans `next.config.ts`, import par
sous-chemin (`@influx/contracts/errors`). **Au J1, import de types seulement** (`import type`) : le
passe-plat type l'enveloppe de ses trois refus (J1-G) ; aucun schéma zod n'est embarqué côté
navigateur avant le J3. Les fronts ne s'en servent jamais que pour des types et la validation de
confort des formulaires (`02` §9.1).

**`tsconfig.base.json`** : ajout de `"allowImportingTsExtensions": true` (autorisé puisque
`noEmit` y est déjà) ; les sources de `contracts` et `test-kit`, lues aussi par le `tsc` des fronts,
importent avec l'extension `.ts`.

**`package.json` racine** : `engines.node` passe à `>=22.18.0` ; scripts `dev:api`, `dev:worker`,
`dev:backoffice` ; `check` se termine par `&& pnpm -r run test:artifacts` (après `build`) ; la CLI
Supabase y entre au J2.

#### J1-F. Variables d'environnement (EC-18)

| Variable | `.env.example` | Services Railway | Nature | Entre au | Remarque |
|---|---|---|---|---|---|
| `INFLUX_API_INTERNAL_URL` | `apps/web` et `apps/backoffice` (**fichiers créés au J1**) | `web`, `backoffice` | Interne, non secrète | J1 | Local : `http://localhost:3100` ; Railway : adresse privée du service `api`, **port fixé explicitement** (J4). Jamais préfixée `NEXT_PUBLIC_` |
| `INFLUX_API_INTERNAL_SECRET` | `apps/web` et `apps/backoffice` | `web`, `backoffice` | **Secrète** — valeur propre à chaque front | J1 | Égale à `INFLUX_API_INTERNAL_SECRET_WEB` (web) ou `…_BACKOFFICE` (backoffice) |
| `INFLUX_API_INTERNAL_SECRET_WEB` | `apps/api` | `api` | **Secrète** | J1 | ≥ 32 octets aléatoires (même génération que `SESSION_COOKIE_SECRET`) ; rotation : les deux côtés ensemble, brève fenêtre de refus acceptée au MVP |
| `INFLUX_API_INTERNAL_SECRET_BACKOFFICE` | `apps/api` | `api` | **Secrète** | J1 | Différente de la précédente, sinon refus de démarrage |
| `PORT` | `apps/api` (facultative) | fournie par Railway | Technique | J1 | Défaut local : 3100 |
| `RAILWAY_GIT_COMMIT_SHA` | `apps/api` (commentaire seulement) | fournie par Railway | Technique | J1 | Version dans chaque ligne de journal ; `local` si absente |
| `AUTH_THROTTLE_PEPPER` | `apps/api` | `api` | **Secrète** | J3 | Poivre de l'empreinte HMAC-SHA-256 des adresses (et des IP) dans `identity.auth_request_throttle` (`04` §12.10, point 4) ; sa rotation remet les compteurs à zéro |
| `INFLUX_ENV` | `apps/web` et `apps/backoffice` | `web`, `backoffice` | Publique | J4 | Déjà prévue par `02` §12.3 : bandeau d'environnement du backoffice (`16` RG118), non-indexation de `staging` |
| `INFLUX_PUBLIC_SITE_URL` | `apps/web`, `apps/api` | `web`, `api` | Publique | **J3** (`api`), J9 (`web`) | `web` : `robots.txt`, plan du site, URL canonique (`docs/landing-page/01-architecture.md` §13). `api` (déjà prévue par `02` §12.3) : origine publique de la surface `web` pour le contrôle d'origine A4 (`03` §6.4) — *avancée au J3 le 2026-09-25* |
| `INFLUX_PUBLIC_BACKOFFICE_URL` | `apps/api` | `api` | Publique | J3 | Origine publique de la surface `backoffice` pour le contrôle d'origine A4. *Ajoutée le 2026-09-25 ; nom proposé par `architecte`, à confirmer par `integrateur` (skill `env-secrets`) ; absente de `02` §12.3, à y ajouter.* Refus de démarrage si elle égale `INFLUX_PUBLIC_SITE_URL` |
| `OPS_ALERT_FALLBACK_RECIPIENTS` | `apps/api` | `api`, `worker` | Non secrète (adresses internes) | J9 | Destinataires des alertes de disponibilité quand la base est injoignable (`02` §20.5) |

Porteurs des variables Brevo : EC-19. Nommage des connexions élevées : EC-20. Description de
`SESSION_COOKIE_SECRET` : EC-24.

#### J1-G. Passe-plat et surfaces

**Trois fichiers serveur par front, plus la route**, identiques dans les deux fronts :

| Fichier | Conditions de `03` §6.4 portées |
|---|---|
| `src/app/api/[...path]/route.ts` | Délègue à `relay()` ; `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `revalidate = 0` (PP-11). Exporte `GET`, `POST`, `PATCH`, `PUT`, `DELETE` seulement (PP-3) |
| `src/server/relay.ts` | PP-2 (chemin brut, **tout `%` refusé**, aucun décodage — R1, J1-J), PP-5 (liste blanche d'en-têtes **dont `origin` et `sec-fetch-site`** — A4, J1-J —, suppression de tout `x-*` non listé dont `x-middleware-subrequest`), PP-6 (`clientAddress()` : `x-real-ip` seul, forme validée, retransmis sous `x-real-ip` ; `x-forwarded-for` jamais relayé — EC-21 tranché, A5), PP-7 (`x-request-id` généré, celui du client déplacé en `client-request-id`), PP-9 (corps de 1 Mo au plus, compté en flux), PP-10 (`Set-Cookie` relayé verbatim par `getSetCookie()`, nom en `__Host-` sinon rejet), PP-11 (`Cache-Control: no-store`). En-têtes de réponse relayés : `content-type`, `set-cookie`, `retry-after`, `location` |
| `src/server/api-client.ts` | **Seul `fetch` du front.** PP-1 (URL construite sur la base de configuration), PP-4 (`redirect: "manual"`), PP-8 (en-tête `x-influx-internal`), PP-9 (délai de 10 s) |
| `src/config/server.ts` | Lit `INFLUX_API_INTERNAL_URL` et `INFLUX_API_INTERNAL_SECRET` **à la première requête, jamais au chargement du module** (sinon `next build` échoue en CI faute de variables) ; validation écrite à la main (deux valeurs : pas de `zod` dans les fronts au J1) |

**Refus propres au passe-plat**, avec l'enveloppe de `@influx/contracts/errors`, sans détail :
`404 not_found` (chemin ou méthode refusés), `413 payload_too_large`, `502 service_unavailable` (API
injoignable ou délai dépassé).

**Un secret interne par front, et une surface liée au préfixe** (renforce PP-8 et D12, soumis à
`expert-cybersecurite` à sa revue de fin de J2 ; ce n'est pas une dérogation, c'est plus strict) :

- `apps/api` compare `x-influx-internal` **à temps constant** aux deux secrets et en déduit la
  surface appelante, `web` ou `backoffice` ; absent ou inconnu ⇒ `401 unauthenticated`.
- **Préfixes validés** (§5.2) : `/v1/…` pour le public et les membres (surface `web`), `/v1/bo/…`
  pour le backoffice (surface `backoffice`). Une route `/v1/bo/…` appelée par le passe-plat de `web`
  ⇒ `404 not_found`, et inversement — sauf route déclarée commune (`/v1/status` au J1,
  `/v1/ops/client-errors` au J4).
- **Garde au démarrage de la liaison surface ↔ préfixe** *(ajoutée le 2026-09-25, revue de sécurité
  de fin de J1, A2 ; à livrer avant le J3, J1-J)*. Le hook `onRoute` de `apps/api` **refuse de
  démarrer** si :
  1. la surface déclarée par une route diffère de celle que déduit son préfixe (`/v1/bo/…` ⇒
     `backoffice`, tout autre `/v1/…` ⇒ `web`) ;
  2. une route est déclarée `shared` hors d'une **liste constante et fermée** — `/v1/status`,
     `/v1/ops/client-errors` —, ou sous `/v1/bo/` ;
  3. la route est exactement `/v1/bo`, ou son **premier segment après `/v1/` est un paramètre ou un
     joker** (`/v1/:x`, `/v1/*`), qui capterait `bo`.

  Toute nouvelle route commune passe donc par une modification de cette liste constante, geste
  visible en revue.
- Conséquence : un front compromis, ou son secret volé, **n'atteint pas les routes de l'autre
  surface**, même avec un cookie d'agent dérobé. À partir du J3, `apps/api` ne lit que
  `__Host-influx-session` sur la surface `web` et que `__Host-influx-ops-session` sur la surface
  `backoffice` (BO-2 appliqué côté serveur).
- **`/health`** : hors `/v1`, donc injoignable par le passe-plat (PP-2) ; seule route dispensée du
  secret, pour le contrôle de santé de Railway ; répond `{ "status": "ok" }` sans aucun détail.
- **`GET /v1/status`** : route publique minimale, sans base, qui répond `{ "status": "ok" }` ; cible
  des essais du passe-plat au J1 et, plus tard, de la route de santé publique de `web` (EC-22).
- Identifiant de requête : `apps/api` reprend `x-request-id` **s'il a la forme d'un UUID**, sinon en
  génère un ; il figure dans l'enveloppe et dans chaque ligne de journal.

#### J1-H. Tests et « terminé quand » du J1 (remplacent ceux du J1 ci-dessus)

**Tests** — tous sans réseau externe ni base :

- `apps/api` : refus de démarrage de J1-D (première moitié de T17) ; `/health` répond sans secret ;
  toute autre route sans secret ⇒ `401` (T7.9) ; secret de `web` sur `/v1/bo/…` ⇒ `404` ; **un champ
  non déclaré dans le schéma de réponse n'est jamais sérialisé** ; une route sans schéma de réponse
  empêche le démarrage ; `404` et `500` en enveloppe, sans trace ni détail (T13, partiel) ; aucune
  valeur de cookie, d'`authorization` ni de `x-influx-internal` dans le journal (flux de journal
  capturé).
- Fronts : garde de J1-C (liste blanche, contenus, importeurs, empreintes, identité des deux
  fronts) ; tests unitaires de PP-2, PP-3, PP-5, PP-7, PP-9, PP-10 et PP-11 contre un **faux serveur
  HTTP local** (`node:http`), jamais contre l'API réelle ; copie des tokens ; G3 et G7 au backoffice.
- **T11 après construction** : script `test:artifacts` de chaque front, exécuté après `build`. Dans
  `.next/static` (code livré au navigateur) : aucune occurrence de `SUPABASE_`, `BREVO_`, `APOLLO_`,
  `SERVICE_ROLE`, `SESSION_COOKIE_SECRET`, `DATABASE_URL`, `INFLUX_API_INTERNAL_`. Dans tout `.next` :
  aucune chaîne ressemblant à un JWT ni à une chaîne de connexion Postgres.

**Terminé quand** :
- `api` (`node src/main.ts`), `worker`, `web` et `backoffice` démarrent en local, **`apps/api`
  exécutant `@influx/contracts` en source TypeScript** (condition 5 de J1-B) ;
- `GET /api/v1/status` répond `{ "status": "ok" }` **par le passe-plat de `web` et par celui du
  backoffice** ;
- `next build` réussit pour les deux fronts, sans aucune variable d'environnement posée ;
- une règle ESLint violée volontairement fait échouer la CI ;
- `pnpm check` est vert.

#### J1-I. Ce que ces décisions demandent aux autres agents

| Agent | Demande |
|---|---|
| `dev-react-node` | Appliquer J1-A à J1-H, dans cet ordre de commits : montée de `next` dans `apps/web` ; `packages/test-kit` et extraction des gardes ; `packages/contracts` ; `apps/api` ; passe-plat de `apps/web` avec levée de G5 (un seul commit, J1-C) ; `apps/backoffice`. Lire avant usage la documentation de la version installée : TypeScript dans Node (`nodejs.org/docs/latest-v22.x/api/typescript.html`), validation, sérialisation et fournisseurs de types de Fastify 5, gestionnaires de route de Next.js 16.3 (documentation embarquée dans `node_modules/next/dist/docs/`) |
| `testeur` | Confirmer EC-13 (J1-C) et la liste de J1-H ; reporter dans `18` les tests de refus de démarrage de J1-D |
| `integrateur` | Au J4 : démarrage des services `api` et `worker` par `node` directement (J1-B) ; port privé fixé pour `api` ; `.node-version` à `24` avant le J9 ; confirmer J1-F (dont `INFLUX_PUBLIC_BACKOFFICE_URL`, A4) ; EC-19, EC-23 ; **constat A5 et en-têtes R7 au J4** (EC-21 tranché) |
| `expert-cybersecurite` | À la revue de fin de J2 : le secret par front et la liaison surface ↔ préfixe (J1-G) ; EC-19 (clé Brevo sur le service HTTP), EC-20, EC-24 ; **compléter les libellés de J1-J** ; exception éventuelle du webhook Brevo au contrôle d'origine A4 (EC-12, avant le J7) |

#### J1-J. Corrections de fin de J1, à faire avant le J3

> **Revue de sécurité de fin de J1 par `expert-cybersecurite` (2026-09-25) : pas de veto, conditions
> à lever avant le début du J3.** L'exigence est fixée par `expert-cybersecurite` ; ce tableau en
> assure le suivi. Les libellés d'A1, A3 et R2 à R4 sont repris de la revue d'`expert-cybersecurite`
> par `chef-de-projet` (2026-09-25).

| # | Correction | Où | Référence |
|---|---|---|---|
| **A1** | **Journaux** : sérialiseur `err` sur liste blanche (`type`, `code` si chaîne, `statusCode`, pile **sans sa ligne de message** ; message conservé seulement pour `ApiError`, `RequestValidationError`, `ConfigError`, `FST_*` ; `cause` réduit à `{ name, code }` ; aucune propriété énumérable recopiée). Chemins masqués ajoutés : `x-influx-internal`, `set-cookie`, `apiKey`, `api_key`, `accessToken`, `access_token`, `refreshToken`, `refresh_token`, `otp`, `phone`, `ip`, `clientAddress`, `params`. Test de `02` §20.8 : faux e-mail, faux code et faux jeton dans une erreur avec `cause` et dans un objet à trois niveaux, aucun n'apparaît. Motif : `DrizzleQueryError` porte les paramètres SQL dans `message`, `stack` et `params` | `apps/api/src/platform/logger.ts` | `02` §20.8 |
| **A2** | Garde au démarrage de la liaison surface ↔ préfixe : hook `onRoute`, liste constante et fermée des routes `shared`, `/v1/bo` et premier segment paramétré refusés | `apps/api` | J1-G |
| **A3** | `genReqId` ne reprend `x-request-id` que si `identifySurface(x-influx-internal) !== null`, sinon `randomUUID()`. Test : un 401 reçu avec un UUID renvoie un `requestId` différent | `apps/api/src/server.ts` | `03` PP-7 |
| **A4** | **Côté passe-plat** : `origin` et `sec-fetch-site` ajoutés à la liste blanche de PP-5. Le contrôle d'origine lui-même est livré au J3 (point 10) | `relay.ts` des deux fronts | `03` PP-5, §6.4 |
| **R1** | PP-2 : **tout `%` refusé** dans le chemin brut ; plus aucun décodage avant validation | `relay.ts` des deux fronts | `03` PP-2 |
| **R2** | Un GET (ou DELETE) avec corps ne doit plus produire de 502 ni de ligne d'erreur : corps ignoré, ou 404 | `relay.ts` des deux fronts | D60 (bruit d'alertes) |
| **R3** | Journaliser le message de `ServerConfigError` (il nomme des variables, jamais de valeur) ; en option, vérifier la configuration au démarrage par `instrumentation.ts` | `relay.ts`, `config/server.ts` des deux fronts | — |
| **R4** | Refuser explicitement toute valeur de secret interne contenant `CHANGE_ME` (le seuil de 32 octets ne contrôle que la longueur) | `apps/api/src/config/schema.ts`, `config/server.ts` des deux fronts | PP-8 |

**Vérification de `testeur` (2026-09-25), à corriger dans la même passe :**

| # | Correction | Où |
|---|---|---|
| **B1** *(bloquant)* | La règle « pas de réponse sans schéma » se contourne (`response: {}`, `response` sans code 2xx, code envoyé non déclaré) et un champ non déclaré est alors sérialisé. `onRoute` refuse `response` vide ou sans 2xx ; un code sans schéma donne un 500 en enveloppe sans le contenu (sérialiseur de secours). Trois tests | `apps/api/src/server.ts`, `platform/schema-compilers.ts` |
| **T-1** | Test du délai de 10 s sans attente réelle : `vi.spyOn(AbortSignal, "timeout")`, vérifier l'appel avec `10_000`, annuler depuis le faux serveur, attendre le 502 | `apps/web/tests/relay.test.ts` (et backoffice) |
| **T-2** | Test de non-régression de `279d0aa` : chaque ligne de journal de l'API et du worker contient une seule fois chaque clé | `apps/api/tests/` |
| **T-3** | `matcher` de `proxy.ts` : `".*\..*"` devient `.*..*` une fois compilé, next-intl ne s'exécute que sur `/`. Écrire `\\.` et tester le manifeste compilé dans `test:artifacts` (`/api/v1/status` et `/_next/x` exclus, `/xyz` inclus) | `apps/web/src/proxy.ts` |
| **T-4** | Garde des routes : refuser tout dossier `src/pages` | `packages/test-kit/src/guards.ts` |

Issus de la même revue mais hors de cette liste : **A5** (adresse du client : J3, constat au J4) et
**R7** (en-têtes de sécurité exigés avant l'exposition de `staging` : J4 ; CSP à nonce : J9).

**Mise en œuvre.** A4 et R1 modifient `relay.ts`, dont l'empreinte est épinglée (PP-12) : un seul
changement, **identique dans les deux fronts**, empreinte mise à jour dans le même commit, tests de
PP-2 et PP-5 étendus (T7 de `03` §8). *Recommandation de l'architecte* : y inclure la partie
passe-plat d'A5 (`clientAddress()`, `03` PP-6), pour ne ré-épingler le fichier qu'une fois. A2 se
teste par un cas refusé de chaque sorte, qui doit empêcher le démarrage.

**Appliqué le 2026-09-25 par `dev-react-node`** (commits sur `main`, non poussés), à relire par
`testeur` et `expert-cybersecurite` :

| Commit | Points | Choix d'implémentation à relire |
|---|---|---|
| `7248d4c` | **B1** (TM11.4) | Plus strict que demandé : `onRoute` refuse aussi tout schéma de réponse **non 2xx** (une erreur est toujours l'enveloppe, ajoutée comme schéma `default` de chaque route : c'est le sérialiseur de secours) et tout `serializerCompiler` propre à une route ; un corps qui échappe à la sérialisation (chaîne, `Buffer`, flux) est refusé comme un code non déclaré (`500` en enveloppe). Reste EC-27 |
| `457663e` | **A1** (T13.6) | Masquage jusqu'à trois niveaux d'imbrication ; `logger.error(erreur)` ne fait plus du message le `msg` de la ligne ; les deux lignes de Fastify qui le faisaient (`defaultErrorLog`, `writeHeadError`) ont un message fixe. Deux codes `FST_*` sans message : EC-26 |
| `911e910` | **A2** | Liste fermée `SHARED_ROUTES` dans `apps/api/src/platform/internal-auth.ts` |
| `6ef4d16` | **A3** (T7.11) | « Sur `/health` » lu comme la sonde de Railway, sans secret |
| `fe4755a` | **R4** côté `apps/api` | — |
| `f6f23f9` | **T-2** (T13.7) | Détecteur de clés en double sur le texte brut, auto-contrôlé ; ligne du worker lue sur le vrai point d'entrée |
| `4058bf2` | **A4, R1, R2, R3, R4** côté fronts, **partie passe-plat d'A5**, **T-1** — un seul commit, empreintes PP-12 mises à jour | **R2** : corps de `GET` et `DELETE` **ignoré** (ni lu ni relayé), plutôt qu'un `404`. Constaté en local : Next.js retire déjà le corps d'un `GET` ; un `DELETE` envoyé avec un corps et `content-type: application/json` reçoit de `apps/api` un `400 validation_failed` (Fastify 5 analyse le corps d'un `DELETE` dès que `content-type` est présent, et le trouve vide) — ni `502` ni ligne d'erreur. Règle à fixer par `architecte` au J3 : un `DELETE` ne porte ni corps ni `content-type`. **R3** : `ServerConfigError` réexportée par `api-client.ts` (la garde des importeurs tient) ; la vérification au démarrage par `instrumentation.ts` n'est pas faite (elle importerait `config/server.ts` hors de la chaîne autorisée). T-1 aussi au backoffice, dans un test réduit |
| `956e07d` | **T-3** (T7.10) | Comportement de la landing constaté avant et après : seul `/xyz` change (redirection vers `/fr/xyz`, même page 404) |
| `3fc3081` | **T-4** | Garde EC-25 étendue aux dossiers nommés d'après une langue |

**Contre-vérifications du 2026-09-25 : J1 clos.** `testeur` : J1 prêt, B1 levé, T-1 à T-4
conformes, 210 tests stables sur trois exécutions, EC-28 corrigé dans `18`. `expert-cybersecurite` :
A1 à A4 et R1 à R4 levés, pas de veto, B1 plus strict accepté, EC-26 et EC-27 tranchés (§3).
Restent, avec leur échéance :

| # | Reste à faire | Échéance | Source |
|---|---|---|---|
| **N1** | Journaux : toute instance d'`Error` au premier niveau d'un objet journalisé (clés `error`, `cause`…) passe par `serializeError` dans le crochet `logMethod` ; `detail`, `hint`, `where` ajoutés aux clés masquées ; test avec une erreur de forme PostgreSQL sous `error` et `cause` | **J2, avant le premier accès à la base** | `expert-cybersecurite` |
| **N2 / F-1** | Filtre de sortie non contournable : ESLint interdit `reply.serializer`, `setReplySerializer`, `setSerializerCompiler`, `reply.hijack` et `reply.raw` hors de `src/platform/` et `server.ts` ; `onRoute` refuse les crochets `onSend` et `preSerialization` déclarés sur une route ; chaque schéma 2xx est parcouru et `any`, `unknown`, `looseObject`, `catchall`, `record` sont refusés ; un test par vecteur (sept vecteurs constatés par `testeur`) | **J3, avant la première route qui renvoie une donnée personnelle** | `testeur` + `expert-cybersecurite` |
| **N3** | `CHANGE_ME` refusé sans tenir compte de la casse, et aussi pour `SESSION_COOKIE_SECRET` | J3 | `expert-cybersecurite` |
| **C-1** | Chaque test d'authentification du J3 capture le flux de journal et vérifie **par valeur** qu'aucun e-mail, code, code TOTP ni cookie marqueur n'y apparaît | J3 | `expert-cybersecurite` |
| **C-2** | Test du passe-plat contre le faux serveur exécuté en CI sous **Node 24** : `fetch` pose `sec-fetch-mode: cors` et laisse `origin` / `sec-fetch-site` intacts ; le contrôle d'origine ne lit que ces deux en-têtes | J3 (contrôle d'origine), au plus tard J4 | `expert-cybersecurite` |
| **C-3** | Règle « un `DELETE` ne porte ni corps ni `content-type` » — **tranchée le 2026-09-27 (J3-D)** : appliquée dans `apps/api` seul, passe-plat inchangé | J3 | `architecte` |
| **C-4** | `18` T7.12 : un `x-real-ip` forgé ne change le résultat que derrière l'entrée Railway, pas en unitaire | J3 | `testeur` |

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
4. **`apps/api/src/db/index.ts`** : une grappe par rôle de connexion (EC-1 et EC-20 tranchés,
   `03` P7) — `DATABASE_URL` et `AUTH_DATABASE_URL` pour `api`, `WORKER_DATABASE_URL` **seule**
   pour `worker` —, avec les refus de démarrage de la ligne EC-20,
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

> **Exécution du 2026-09-26 (`expert-database`, pile locale, Docker 29.8, PostgreSQL 17.6).**
> `supabase start` puis **trois** `supabase db reset` depuis zéro : `0001` à `0008` passent sans
> correction (les rôles, objets de grappe, survivent à la remise à zéro : le chemin « rôle déjà
> présent » de `0001` a donc aussi été exercé). Pas de `seed.sql` : la CLI n'émet qu'un
> avertissement. Constats par requêtes : les douze rôles de la liste fermée sans `rolsuper`,
> `rolbypassrls`, `rolcreaterole`, `rolcreatedb`, `rolreplication`, `NOINHERIT`, bornes posées
> (EC-33) ; appartenances conformes à `03` P7 (`INHERIT FALSE, SET TRUE`), plus la seule
> attribution `ADMIN` implicite de `postgres` (T4.3, C-9) ; trois fonctions `SECURITY DEFINER`, aux
> propriétaires déclarés, `search_path` vide ; aucune fonction avec `EXECUTE` pour `PUBLIC` ; aucun
> `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` accordé ; aucun droit pour `anon`,
> `authenticated`, `service_role` ; RLS activée **et** forcée, avec politique, sur les dix-huit
> tables ; `public` vide ; PostgREST refuse nos schémas (`PGRST106`, seuls `public` et
> `graphql_public` exposés) ; `billing.commission_rates` vide. Essais sous les vrais rôles de
> connexion (mots de passe de test posés à la main puis retirés) : sans rôle pris, refus `42501`
> (T4.5) ; `resolve_session()` seule autorisée ; `SET ROLE` vers `influx_auth`, un propriétaire ou
> `service_role` refusé ; contexte absent ou `aal1` ⇒ zéro ligne ; `grant_role()` écrit la ligne
> chaînée (acteur `admin`, `request_id`) et refuse l'auto-attribution ; le vérificateur détecte
> `broken_row`, `broken_link` et la suppression de la dernière ligne (`gap` par l'ancre) ; le
> déclencheur bloque aussi le propriétaire. Mécanique des rôles constatée : `04` §3.2.

#### Revue de sécurité des migrations — 2026-09-26

> **`expert-cybersecurite` : pas de veto. Commit autorisé sous conditions** : M1 corrigée dans
> `0006`, puis commit portant `security-reviewed: 2026-09-26` (`03` I-4). Relu : les huit fichiers,
> et en base locale (lecture seule) les ACL de tables, colonnes, schémas, fonctions et types, les
> privilèges par défaut, les appartenances, les publications et les déclencheurs d'événement. Conforme
> à `03` P7 : aucun droit pour `PUBLIC` / `anon` / `authenticated` / `service_role` ; `token_hash`
> lisible par le seul résolveur ; aucune écriture sur `account_roles` hors `grant_role()` ;
> `commission_rates` vide et non inscriptible ; `supabase_realtime` n'est pas `FOR ALL TABLES`.
> Non vérifié par moi (lecture de `pg_authid` réservée) : l'absence de vérificateur de mot de passe
> sur les rôles après les essais manuels — voir R4.

**Exigée avant le commit des migrations :**

| # | Correction | Fichier | Motif |
|---|---|---|---|
| **M1** | Retirer le paramètre `p_occurred_at` d'`audit.append()` : `occurred_at := now()`. Si un appelant en a besoin un jour, le réintroduire borné (`now() - 5 min` ≤ valeur ≤ `now()`) avec sa migration | `0006` | Tout détenteur d'`EXECUTE` (demain `influx_auth`, `influx_worker`) peut antidater ou postdater un fait dans le registre de preuve, et la date fausse est **chaînée pour toujours**. Coût : 10 min maintenant, une nouvelle signature de fonction plus tard |

**Exigées avant le J3** (avant tout `EXECUTE` d'`audit.append()` à `influx_auth` ou `influx_worker`) :

| # | Correction | Où | Motif |
|---|---|---|---|
| **M2** | `actor_type` lié à `session_user`, pas seulement aux réglages : `influx_app` ⇒ déduit d'`influx.role` (un des quatre, sinon refus) ; `influx_auth_login` / `influx_worker_login` ⇒ `service` (ou `system` sans compte), quel que soit `influx.role` ; tout autre ⇒ `system` | `audit.append()` (migration du J3) | Sinon une opération élevée qui pose `influx.role = 'admin'` s'inscrit au registre comme un acte d'administrateur. L'ajout d'`actor_type` à la forme canonique est **approuvé** ; il ne vaut que si la valeur est fiable |
| **M3** | **Résidu N1** : toute `Error` jusqu'à `REDACTED_DEPTH` passe par `serializeError` (pas seulement au premier niveau) ; `parameters`, `query`, `args` ajoutés aux clés masquées ; test avec une erreur du pilote `postgres` portant un e-mail dans `parameters`, sous `error.cause` | `apps/api/src/platform/logger.ts` | **Avant le premier commit de `src/db/` qui exécute une requête.** `PostgresError` porte les valeurs liées ; la première erreur de contrainte sur `accounts.email` les journaliserait |

**Points ouverts tranchés :**

- **`grant_role()` sans 2V ni R en base : accepté au Lot 0, à surveiller**, à trois conditions :
  (a) aucune route d'`apps/api` n'appelle `identity.grant_role` avant `0107` (garde statique, même
  famille que T6) ; (b) `0107` réécrit la fonction pour exiger une `dual_control_requests` approuvée
  par un **autre** compte, non consommée, liée à la cible et au rôle, consommée dans la transaction ;
  (c) la fraîcheur (R) y est lue sur la **ligne de session** (horodatage de la dernière vérification
  TOTP), jamais sur un réglage. Motif : `influx.*` est posé par l'application ; une injection SQL dans
  `influx_app` peut `SET ROLE influx_admin` (l'appartenance s'évalue sur `session_user`) et poser
  `influx.aal = aal2`. Les contrôles en base doivent donc s'ancrer sur des lignes, pas sur des
  réglages. Risque résiduel inhérent à `03` P2, accepté ; parade : requêtes paramétrées seules.
- **`audit.append()` sans contrôle d'`is_active` : accepté, à surveiller.** Aucun code n'est retiré
  au Lot 0 ; la migration qui retirera le premier code accordera `SELECT (code, subject_type,
  is_active)` à `influx_audit_writer` et ajoutera le contrôle.
- **C-3 (T16.2) : confirmée, amendée** : comparer les littérales par **valeur** (`.35`, `0.350`,
  `35e-2` inclus) et ajouter `35/100`, `20/100`, `15/100`, `65/100` aux motifs.
- **C-7 : une ligne par transaction élevée qui écrit** (ou par lot non vide) ; un tour de file vide
  n'écrit rien au registre, il alimente les métriques `ops`.
- **C-8 : exigée** avec le contrôle I-4 (J2 point 7) : le marqueur couvre aussi le fichier
  d'attendus de T2.
- **C-9 : tolérance confirmée** (rôle de migration seul, `ADMIN` vrai, `INHERIT` et `SET` faux,
  constaté en base). Ce `ADMIN` permet au propriétaire du projet de reprendre un rôle : c'est S-7,
  déjà accepté. T4.3 le vérifie aussi en `staging` et en production.

**Recommandations non bloquantes :**

| # | Recommandation | Échéance |
|---|---|---|
| **R1** | Inclure `recorded_at` (et `request_id`) dans la forme canonique tant qu'aucune ligne réelle n'existe ; après, il faudra un `hash_version` 2 | Avant la première ligne réelle (Lot 1) |
| **R2** | `audit.chain_checks` inscriptible uniquement par `verify_chain()` devenue `SECURITY DEFINER` (propriétaire dédié), jamais par un `INSERT` direct du worker : sinon le worker peut forger une ancre « ok » | E-4 (J6) |
| **R3** | `terms_acceptances_member_insert_own` : n'accepter que la version **en vigueur** (`effective_to is null`, `effective_from <= now()`) | J5 |
| **R4** | T4 : sous le rôle de CI qui lit `pg_authid`, aucun vérificateur de mot de passe sur les neuf rôles `NOLOGIN` ; en local, retrait des mots de passe d'essai après chaque session manuelle | J2 (CI) |
| **R5** | `grant_role()` : refuser aussi une cible `suspended` | Avec `0107` |

#### Revue de sécurité de fin de J2 — 2026-09-27

> **`expert-cybersecurite` : pas de veto. Fin de J2 acceptée ; J3 autorisé sous conditions** (S1 et
> S2 avant le premier code de domaine du J3, EC-36 dans `0108`). Relu : `c19bd3a`, `0c187dd`,
> `24991e5` (`apps/api/src/db/`), `128692e` (dont `packages/test-kit/src/rights/expected-rights.ts`),
> le test T2 (`375167b`), les gardes statiques de `48ee6b4`, EC-34 à EC-36. Aucun test intrusif,
> aucun environnement distant touché.

**1. Fichier d'attendus de T2 (`128692e`) : approuvé sans correction.** Contrôlé contre `03` §3 et
P7 : chaque cellule cite sa source ; l'absence vaut `refus_droit`, vérifiée **deux fois** (aucun droit
au catalogue *et* `42501` à l'essai) ; `propre` est éprouvé contre **toutes** les lignes d'autres
comptes en lecture (`is distinct from current_account_id()`), et contre le compte B en écriture ; le
jeu de données place des lignes A et B partout où `propre` s'applique ; T2.5 rejoue sans contexte et
en `aal1` pour agent et admin ; l'instantané exact T2.7 ferme les droits de colonnes (e-mail,
`token_hash`, colonnes non modifiables) qu'une sonde par table ne verrait pas. Aucun attendu n'est
plus large que `03` §3 (lectures internes `autorisé` conformes à « L·J » ; sessions `propre` y compris
pour agent et admin, plus étroit que nécessaire, c'est le bon sens). **`128692e` peut recevoir
`security-reviewed: 2026-09-27`.** À surveiller (non bloquant) : l'écriture `propre` n'est éprouvée
que contre le compte B *du même rôle* (ajouter une cible d'un autre rôle au J3) ; le harnais pose le
contexte par son propre code, parallèle à `withUserTransaction` (un test du J3 doit prouver que les
deux posent les mêmes réglages).

**2. `apps/api/src/db/` et `c19bd3a` : conformes à `03` P7**, règles 2 à 6 : garde
`current_user = session_user = <rôle de connexion>` en première instruction de chaque transaction,
grappe détruite si elle échoue ; rôle tiré d'une table constante (`roles.ts`, recherche en propriété
propre) ; réglages en `set_config(…, true)` ; aucun `SET ROLE` de session ; `rolsuper` /
`rolbypassrls` lus à l'ouverture, refus définitif ; `request_id` accepté du relais seulement avec le
secret interne et au format UUID ; refus de démarrage EC-20 (rôle exact par URL, pas deux URL au même
utilisateur, variable d'un autre service refusée sur Railway, gabarit `CHANGE_ME` refusé) ; union
élevée vérifiée à l'exécution. Logger après M3 : conforme.

**Exigées avant le premier code de domaine du J3 :**

| # | Gravité | Correction | Motif | Effort |
|---|---|---|---|---|
| **S1** | Important | Étendre « `set local role` en un seul endroit » (T6.6) de `src/db/` à **tout `apps/api/src` et `packages/*/src`** (exemption nommée : le harnais de `test-kit`) ; y ajouter l'interdiction de `set_config` dont le 3ᵉ argument n'est pas le littéral `true` | Aujourd'hui, une fonction de domaine qui exécute `set local role influx_admin` dans une transaction annonceur passe toutes les gardes : `influx_app` a `SET` sur les quatre rôles et l'appartenance s'évalue sur `session_user`. Un annonceur lirait alors toutes les identités, sans symptôme | 30 min |
| **S2** | Important | `ConnectionPool.verify()` : refuser aussi si un rôle **atteignable par appartenance** (`pg_auth_members`, récursif) porte `rolsuper` ou `rolbypassrls` | La règle 6 ne lit que le rôle de connexion ; un `BYPASSRLS` posé un jour sur `influx_admin` (rôle pris par `SET LOCAL ROLE`) rendrait la RLS facultative en production sans que l'ouverture ne le voie (T4 ne tourne qu'en CI) | 1 h |

**À surveiller :** (a) en `production`, refuser une URL de base sur hôte de bouclage (TLS désactivé),
10 min, J4 ; (b) logger : une erreur imbriquée au-delà de 6 niveaux, ou dans une instance non simple
(`Map`, classe), échappe au sérialiseur et la censure s'arrête à 3 niveaux — forcer la troncature
même quand aucune erreur n'est trouvée, 15 min, J3.

**3. EC-35 (points de sécurité) :** (1) forme `vide` : **acceptée**, T16.3 prouve la table vide et
non inscriptible ; `18` T2 règle 3 à corriger. (2) `23503` sans contexte : **accepté**, même message
qu'une version inconnue, donc aucun oracle ; la ligne reste refusée. (3) exclusions `_realtime` et
`extensions` : **acceptées**, à condition qu'un test vérifie qu'aucun rôle `influx_*` n'y détient de
droit (J3). (4) exemptions T6.3 : **acceptées**, limitées aux deux fichiers nommés. (5) plancher de
cas exécutés : **Important, J3** — un `it.each` sur une liste vide rendrait une famille muette.
(6) T4.7 élevé : **dans le commit qui introduit E-1**, pas après. (7) CI en connexion directe :
**accepté jusqu'au J4**, où le passage par le multiplexeur est constaté avec EC-34. (8) : hors
sécurité.

**4. EC-36, tranchée (migration `0108`, bloquant pour le commit qui introduit E-1) :**
code = **`elevated.<opération>`**, un par opération, inséré dans `audit.event_types` dans la même
migration que l'opération entre dans l'union ; **sujet = l'objet métier touché** (compte pour E-1 et
E-2, événement de file pour E-3, ancre pour E-4), type de sujet fixé par opération dans une table
constante, identifiant fourni par l'appelant ou rendu par `fn` — **jamais `gen_random_uuid()`**, qui
ne relie la ligne à rien ; charge utile `{operation}` seule, aucune donnée personnelle. **Volume
(C-7 confirmée)** : ligne écrite seulement si la transaction a écrit, testé par
`pg_current_xact_id_if_assigned() is not null` avant l'appel ; sinon une ligne de journal `pino`
sans donnée. **Pas d'`EXECUTE` d'`audit.append()` à `influx_auth` / `influx_worker`** : une fonction
`SECURITY DEFINER` étroite `audit.append_elevated(operation, subject_id)`, propriété
d'`influx_audit_writer`, qui n'accepte qu'un code `elevated.*` du catalogue et applique M2.

**Verdict : livraison du J2 autorisée, sans point bloquant. Conditions avant J3 : S1, S2. Avant E-1 :
EC-36 et EC-35 (6).**

#### Vérification de fin de J2 par `testeur` — 2026-09-27

> **Verdict : J2 terminé sous deux conditions, toutes deux hors code de test** — (C1) marqueur
> `security-reviewed: 2026-09-27` porté par `128692e` ; (C2) première exécution de la CI verte sur
> GitHub, durée relevée. Skill `test-strategy`. Relu : `128692e` à `805644f`, `.github/workflows/ci.yml`,
> `packages/test-kit/scripts/check-security-review.ts`.

**1. Conformité à `18` (révision `03d18bb`).** T2.1 à T2.8, T3.1 à T3.11, T4.1 à T4.8 (T4.6 a-d, g, h
et T4.8 en unitaire ; R4 lu dans `pg_authid`), T6.1, T6.2, T6.3, T6.6 et T16.1 à T16.7 sont
implémentés ; T4.1 tourne en premier (préparation globale) et arrête la suite. Analyseurs statiques
éprouvés sur `test-witnesses/`, T2.8 par création témoin. Aucun test ne passe à vide : T2 exige une
ligne par table vue du rôle de migration, T6.1 compare A à U (vide, conforme), T6.3 exige un graphe
d'imports non trivial.

**2. Contre-épreuves en base, faites par moi sur la pile locale puis annulées :** droit `SELECT`
ajouté à `influx_advertiser` sur `agent_profiles` ⇒ T2.1, T2.5, T2.7 rouges ; table sans RLS dans
`backoffice` ⇒ T2.2 rouge ; colonne `fee_amount double precision` ⇒ T16.5 rouge ; politique
`using (true)` sur `identity.accounts` ⇒ T2.1 et T2.5 rouges (« rows of another account are
visible ») ; `INSERT` accordé à `influx_admin` sur `commission_rates` ⇒ T2, T2.7, T16.4 rouges ;
`BYPASSRLS` sur `influx_worker` ⇒ arrêt de toute la suite par T4.1. Tout est détecté.

**3. Exécutions.** `pnpm test:db` : 87 cas verts, trois fois (avant, pendant et après les
contre-épreuves) ; `pnpm check` vert une fois (api 139 + 87, test-kit 30, web 93, backoffice 22,
contracts 8), aucune instabilité.

**4. EC-35, points de test, tranchés** (`18` corrigé : §3, T2, T3.7, T3.8, T4.7, T6.3, T16.5) :
(1) `vide` acceptée, réservée à `commission_rates` ; (2) `23503` accepté sans contexte seulement, la
politique restant prouvée par l'essai sur le compte B ; (3) exclusions acceptées, liste fermée, avec
la condition J3 d'`expert-cybersecurite` ; (4) exemptions acceptées par chemin exact ; (5) plancher
**exigé au J3**, avant le premier nouveau test en base (rapport JSON de Vitest, zéro saut, plancher par
fichier) ; (6) T4.7 élevé dans le commit d'E-1 ; (7) connexion directe acceptée jusqu'au J4, où T4.5,
T4.6 e et T4.7 sont rejoués par le multiplexeur ; (8) accepté, 50 écrivains, jamais moins de 20 si
EC-33 abaisse la limite.

**5. CI.** Aucun appel externe réel (aucune clé, Brevo et Apollo absents des tests en base) ; budget
de 10 min plausible (image PostgreSQL tirée sans cache, construction des deux fronts), **à mesurer à
la première exécution**, cache d'images si dépassé. Le contrôle des marqueurs fonctionne : sur
`a2e06a7..HEAD`, il signale `128692e`, **ce qui rendrait la CI rouge** (C1).

**Corrections demandées à `dev-react-node` :**

| # | Correction | Échéance |
|---|---|---|
| **C1** | Reformuler le message de `128692e` (non poussé) avec `security-reviewed: 2026-09-27`, approuvé ci-dessus par `expert-cybersecurite` | Avant le push |
| **Q1** | Essai `delete` des formes `propre` filtré par la colonne du compte (A puis B) : aujourd'hui `delete from <table>` rend le contrôle du compte B vide de sens (sans effet au J2, aucune ligne `delete` `propre`) | Avant la première ligne `delete` `propre` |
| **Q2** | Plancher de cas exécutés par fichier (`18` §3, règle 2) | J3, avant le premier nouveau test en base |
| **Q3** | T16.5 : exiger une colonne de devise dans la table de toute colonne de montant | Avant la première colonne de montant |
| **Q4** | Contrôle des marqueurs : un premier envoi de branche ne lit que le dernier commit ; ajouter une épreuve sur commits témoins | Non bloquant |
| **Q5** | La pile locale accumule les lignes validées par T3 (≈ 57 comptes par exécution, 293 constatés) : `supabase db reset` avant la triple exécution d'un jalon | Non bloquant |

#### Dette préalable au J3 — appliquée le 2026-09-27

Ordre fixé par le fondateur : EC-27 et EC-26 en premier commit, puis S1, S2, M2, Q1, Q3. Commits sur
`main`, **non poussés**. `pnpm test` vert après le dernier commit, base reconstruite par
`supabase db reset` (`0001` à `0009`) : api 145 unitaires et 94 en base, test-kit 30, web 93,
backoffice 22, contracts 8.

| Commit | Points | Choix d'implémentation à relire |
|---|---|---|
| `e83efa6` | **EC-27, EC-26** | Option `frameworkErrors` : `401 unauthenticated` en enveloppe sans secret connu, sinon `404 not_found`, pour `FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH` et `FST_ERR_ASYNC_CONSTRAINT` ; identifiant de requête selon A3 ; une ligne de journal au code seul. Le logger ne garde plus le message que d'`ApiError`, `RequestValidationError` et `ConfigError`. Tests : trois codes × quatre en-têtes (aucun, inconnu, web, backoffice), marqueurs du chemin et de la chaîne de requête absents de la réponse et du journal. *Constat :* ces réponses n'écrivent pas la ligne « request completed » (Fastify n'appelle pas `requestCompleted` sur ce chemin) ; à reprendre avec les métriques par route de D60 si elles doivent les compter |
| `290ed41` | **S1** | « `SET LOCAL ROLE` en un seul endroit » couvre tout `apps/api/src` et `packages/*/src`, liste exacte attendue : `apps/api/src/db/roles.ts` et l'exemption nommée `packages/test-kit/src/db/harness.ts`. `set_config` refusé dès que son troisième argument n'est pas le littéral `true` (analyse des arguments équilibrée sur parenthèses, crochets et `${…}`). Deux fichiers témoins ajoutés (`t6-role/`, `t6-session/set-config-bound-local`) |
| `8e34eee` | **S2** | Requête d'identité récursive sur `pg_auth_members` depuis le rôle de connexion, **quelles que soient les options `INHERIT` et `SET`** ; deux motifs de refus : `superuser_reachable`, `bypassrls_reachable`. Épreuve en base : `BYPASSRLS` posé (validé) sur `influx_admin`, grappe `influx_app` refusée, attribut retiré dans un `finally` (T4.1 arrêterait l'exécution suivante sinon) |
| `8ee9fca` | **M2** | Migration **`0009_audit_append_actor_from_session_user`** : seul le corps d'`audit.append()` change (signature, propriétaire, droits et forme canonique inchangés), remplacé par le propriétaire dans la même fenêtre que `0006` §9, avec contrôles de fin. `influx_app` ⇒ acteur tiré d'`influx.role` parmi les quatre rôles métier **avec un compte**, sinon refus `42501` ; `influx_auth_login` / `influx_worker_login` ⇒ `service`, ou `system` sans compte ; tout autre `session_user` ⇒ `system` **et aucun compte attribué** (sinon la contrainte `system ⇔ sans compte` refuserait la ligne). Tests T3 par branche, avec `EXECUTE` (et `USAGE` sur `audit` pour `influx_auth` / `influx_worker`) accordés le temps du fichier puis retirés ; contre-épreuve : les quatre cas échouent sur le corps de `0006`. **Le message du commit ne porte pas encore `security-reviewed:`** : la CI (I-4) sera rouge tant qu'`expert-cybersecurite` n'a pas relu `0009` et que le message n'est pas reformulé, **avant le push** (même procédure que C1) |
| `622e960` | **Q1** | Essai `delete` filtré par la colonne du compte (A puis B), comme `update`. Sans effet au J2 (aucune ligne `delete` `propre`) |
| `b7d07ee` | **Q3** | T16.5 : toute table portant une colonne de montant porte une colonne `currency` ou `<préfixe>_currency` (`04` §2). Éprouvé sur quatre tables témoins créées puis annulées (flottant, montant sans devise, montant `numeric`, table conforme) |

**Restent avant le premier code de domaine du J3** : la relecture de `0009` par
`expert-cybersecurite` (marqueur), puis **Q2** (plancher de cas exécutés par fichier, avant le premier
nouveau test en base du J3) et le test demandé à EC-35 (3) (aucun droit d'un rôle `influx_*` dans
`_realtime` et `extensions`). *Hors de la liste traitée, repéré en écrivant Q3 :* des colonnes prévues
par `04` comme `total_budget_minor` ou `commission_received_total_minor` ne contiennent pas le mot
`amount` et échapperaient à T16.5 ; motif à élargir à `_minor` par `testeur` avant la première d'entre
elles.

#### Revue de sécurité de `0009` — 2026-09-27

> **`expert-cybersecurite` : pas de veto. `3e7af41` (devenu `8ee9fca` une fois le marqueur ajouté) peut recevoir `security-reviewed: 2026-09-27`
> en l'état**, avant le push. Aucune condition avant le push ; trois conditions avant E-1 (dans
> `0108`) et une au J4. Relu : `0009` contre `0006` §6 et §9, le bloc `M2` de
> `apps/api/db-tests/t3-audit-chain.test.ts`, les gardes d'identité d'`apps/api/src/db/`
> (`pool.ts`, `index.ts`), `packages/test-kit/src/db/local-stack.ts`. En base locale (lecture
> seule) : propriétaire, `prosecdef`, `proconfig` et ACL d'`audit.append()`, ACL du schéma `audit`,
> appartenances à `influx_audit_writer`. `pnpm --filter @influx/api exec vitest run --project db` :
> 94 cas verts ; après l'exécution, aucun droit temporaire résiduel. Aucun environnement distant.

**1. Fidélité à M2 : conforme.** Les trois branches sont celles exigées ; `influx.role` n'est plus lu
hors d'`influx_app` ; le refus `42501` intervient **avant** la prise du verrou de chaîne (un refus ne
retient rien et ne laisse aucun trou). « Tout autre ⇒ `system`, compte forcé à null » est le seul
choix compatible avec la contrainte `system ⇔ sans compte` ; ses limites sont en V1.

**2. Seul le corps change : vérifié en base.** Même signature ; propriétaire `influx_audit_writer` ;
`SECURITY DEFINER` ; `search_path=""` ; ACL identique à `0006` (`influx_audit_writer`,
`influx_identity_definer`, rien d'autre : `CREATE OR REPLACE` conserve l'ACL) ; forme canonique et
`hash_version` 1 inchangés — les valeurs d'`actor_type` restent celles de l'énumération, aucune
ligne existante n'est à recalculer.

**3. Fenêtre de propriété : refermée et contrôlée.** `SET` sans `INHERIT` le temps du
`CREATE OR REPLACE` (qui exige `CREATE` sur le schéma, d'où l'octroi temporaire), `reset role`, retrait
de `CREATE` puis de l'appartenance ; il ne reste que l'appartenance `ADMIN` du rôle de migration,
`SET` et `INHERIT` faux (tolérance C-9), constatée. Le `SET ROLE` de session est annulé par le
retour arrière si le fichier échoue.

**4. `session_user` : fiable.** Ni `SECURITY DEFINER` ni `SET ROLE` ne le changent ; seul
`SET SESSION AUTHORIZATION` le ferait, réservé à une session ouverte par un superutilisateur, que S2
refuse. **À travers Supavisor** : le suffixe `.<ref>` sert au multiplexeur à trouver le projet ; il
ouvre la connexion amont sous l'utilisateur sans suffixe, donc `session_user = influx_app`. Je ne l'ai
pas constaté (pas d'environnement distant) : d'où V3. **Même si c'était faux, rien ne s'écrirait mal**
: `apps/api` refuse toute grappe et toute transaction où `session_user` ≠ `influx_app` (`pool.ts`,
garde de transaction de `index.ts`). Défaut visible et fermé, pas une mauvaise attribution.

**5. Tests : l'octroi temporaire est acceptable.** Connexions codées en dur sur le bouclage
(`local-stack.ts`), fichiers en série, retrait dans `afterAll` constaté ; un arrêt brutal laisse les
droits dans la pile locale seulement, et **T2.7 (instantané exact, exécuté avant T3) passe au rouge à
l'exécution suivante**. Couverture de M2 incomplète : V2.

| # | Gravité | Constat | Scénario | Impact | Correctif | Effort | Échéance |
|---|---|---|---|---|---|---|---|
| **V1** | Important | La branche « tout autre `session_user` » est **ouverte par défaut** | (a) Un futur rôle de connexion `influx_*` (outil interne, second worker) atteint `append()` par une fonction définisseuse : ses actes s'inscrivent `system`, sans erreur. (b) Une session de maintenance nominative écrit une ligne `system` : le registre ne dit pas qui | Perte d'attribution dans le registre de preuve, sans symptôme | Dans la branche `else` : refuser (`42501`) tout `session_user` qui commence par `influx_` (couvre aussi une forme suffixée `influx_app.<ref>`) ; y ajouter `session_user` à la charge utile (`p_payload \|\| {"db_session_user": …}`) — la charge utile est déjà dans la forme canonique, **pas de `hash_version` 2** | 30 min + 2 cas | Dans `0108`, avant E-1 et avant toute ligne réelle |
| **V2** | Important | Tests M2 : seule la correspondance `admin` est éprouvée pour `influx_app` | Une inversion `agent` ↔ `admin`, ou `creator` → `agent`, dans le `case` passe tous les tests — précisément la confusion que R1 a rendue détectable dans la chaîne | Acte d'un agent inscrit comme acte d'administrateur, sans alerte | Paramétrer les quatre rôles (`advertiser`, `creator` ⇒ `member` ; `agent` ; `admin`), `influx_worker_login` sans compte ⇒ `system`, et une valeur hors liste de casse différente (`Admin`) ⇒ `42501` | 20 min | Avant E-1 (avec `0108`) |
| **V3** | À surveiller | `session_user` à travers Supavisor non constaté | Voir point 4 | Aucun tant que la garde d'`apps/api` tient | Au J4, avec EC-34 et EC-35 (7) : par le multiplexeur, `select session_user` = `influx_app`, puis une ligne par `grant_role()` inscrite `admin` | 15 min | J4 |
| **V4** | À surveiller | Droits temporaires des tests : le rouge de T2.7 après un arrêt brutal disparaît à l'exécution suivante (l'`afterAll` nettoie) | Pris pour une instabilité et ignoré | Aucun hors pile locale | Au `beforeAll`, vérifier que les droits sont absents avant de les accorder, sinon échec « exécution précédente interrompue : `supabase db reset` » | 10 min | J3 |
| **V5** | À surveiller | Les contrôles de fin de `0009` ne vérifient ni `search_path` ni `PUBLIC` / `anon` / `authenticated` / `service_role` | Une future réécriture qui recréerait la fonction (au lieu de la remplacer) perdrait l'ACL sans que la migration échoue | Couvert aujourd'hui par T2.4 et T2.8 | Ajouter ces deux contrôles au gabarit des migrations `audit` | 10 min | `0108` |
| **V6** | À surveiller | EC-36 : `audit.append_elevated()` doit **appeler** `append()`, pas recopier la déduction de l'acteur | Deux déductions divergent à la première évolution | Acteur incohérent selon le chemin | Une seule déduction, dans `append()` ; `append_elevated()` ne fait que filtrer le code `elevated.*` et le sujet | — | `0108` |

Rappel, sans nouvelle action : dans `influx_app`, `append()` fait toujours confiance à
`influx.role` / `influx.account` (le rédacteur n'a aucun droit sur `identity`, c'est voulu) ; le
contrôle sur lignes reste à la charge de la fonction appelante, comme `grant_role()` le fait (revue du
2026-09-26, points ouverts).

**Verdict : livraison de `3e7af41` autorisée, sans point bloquant.** Le message peut être reformulé
avec `security-reviewed: 2026-09-27` avant le push. *Fait le 2026-09-27 : `3e7af41` est devenu `8ee9fca` ; Q1 et Q3, réécrits par la même opération, sont devenus `622e960` et `b7d07ee`.* Conditions : V1, V2, V5, V6 dans le commit de
`0108` (avant tout `EXECUTE` sur le registre pour `influx_auth` / `influx_worker`) ; V3 au J4 ; V4 au J3.

### J3 — Authentification et sessions (4 à 5 jours)

> **Les décisions de l'architecte du 2026-09-27 (sous-section suivante, J3-A à J3-H) précisent les
> points 1 à 11 du plan initial et, là où elles divergent, les remplacent**, ainsi que l'ordre des
> commits. Écarts nouveaux : **EC-37 à EC-48** (§3).

#### J3 — décisions de l'architecte (2026-09-27)

> **Statut : tranché par `architecte`** pour son périmètre : dépendances, intégration de GoTrue,
> C-3, ordre des commits. Les écarts EC-37 à EC-48 restent à trancher par leurs arbitres **avant le
> commit qui en dépend** (J3-F). Confirmations attendues : `expert-cybersecurite` (J3-C, J3-D, J3-F,
> veto), `expert-database` (J3-F, EC-37, EC-39, EC-40), `integrateur` (J3-E), `testeur` (colonne
> « Test » de J3-A). Aucun code n'est écrit par ce document ; aucune variable réelle n'a été lue et
> aucun service externe réel appelé pour l'établir.

##### J3-A. Faits Supabase Auth (GoTrue) établis

**Méthode.** Lus le 2026-09-27 : la documentation Supabase, le code de `@supabase/auth-js`
**2.117.2** (étiquette `v2.117.2` du dépôt `supabase-js`) et le code du serveur GoTrue
(`supabase/auth`, branche `master`). **La version de GoTrue embarquée par la CLI 2.117.0, et celle
des projets hébergés, ne sont pas épinglées par nous** : tout fait « vérifié (code source) » est donc
**aussi constaté par un test en pile locale au J3** (colonne « Test »), puis sur `staging` au J4. Un
constat qui diverge l'emporte sur ce tableau et le corrige.

**a. Réglages** — tous dans `supabase/config.toml`, reportés sur les projets hébergés par
`supabase config push` (J4, `integrateur`).

| # | Exigence | `supabase/config.toml` | Projet hébergé | Statut | Test |
|---|---|---|---|---|---|
| a1 | Code à 6 chiffres | `[auth.email] otp_length = 6` (bornes 6 à 10) | Authentication › Email, « Email OTP Length » | **Vérifié** (doc CLI) ; code produit par `crypto.GenerateOtp(OtpLength)` (code source `mail.go`) | Le code reçu par la doublure Brevo compte 6 chiffres |
| a2 | Validité 600 s | `[auth.email] otp_expiry = 600` — **3600 aujourd'hui** | « Email OTP Expiration » | **Vérifié** (doc) ; la validité court **depuis la génération** (date d'envoi du jeton + `OtpExp`, `verify.go`) | Test statique du fichier ; **un constat manuel unique** (code refusé après 10 min) en local, refait sur `staging`. Un test automatique qui attend 10 min est écarté |
| a3 | Inscription publique fermée, API d'administration utilisable | `[auth] enable_signup = false` **et** `[auth.email] enable_signup = false` — **`true` aujourd'hui** | « Allow new users to sign up » désactivé | **Vérifié** (code source) : ni la création d'utilisateur par l'administration (`admin.go`) ni `generateLink` (`mail.go`) ne lisent ce réglage | `POST /auth/v1/signup` refusé ; `admin.createUser` réussit |
| a4 | Aucun envoi d'e-mail natif | Ne pas configurer de SMTP **ne suffit pas** (sur un projet hébergé, l'expéditeur intégré de Supabase prend le relais) | idem | **Vérifié** : `generateLink` et `createUser` n'envoient rien (code source ; JSDoc de `createUser`). **Mais `/otp`, `/recover`, `/resend` et `/magiclink` restent joignables** avec une clé d'API et envoient un e-mail à un utilisateur **existant**, inscription fermée ou non (doc des limites de débit) | **EC-41** |
| a5 | TOTP | `[auth.mfa.totp] enroll_enabled = true`, `verify_enabled = true` — **`false` aujourd'hui** | Activé par défaut, **gratuit sur toutes les offres** | **Vérifié** (doc TOTP) ; le commentaire « Pro plan » du fichier est périmé | Inscription puis vérification d'un facteur |
| a6 | Clés de signature asymétriques | `signing_keys_path` + `supabase gen signing-key --algorithm ES256` | JWT Signing Keys en ES256, **clés d'API héritées (`anon`, `service_role`) désactivées**, clé `sb_secret_…` | **Vérifié** (doc) | J4 |
| a7 | Réglages hors fichier | — | Protection des mots de passe compromis (offre Pro), option `Sb-Forwarded-For` (EC-38) : tableau de bord ou API de gestion | **Vérifié** (doc) | `integrateur`, J4 |

**Décision a6.** Obligatoires sur les projets hébergés (J4) : ce qui compte est la **désactivation
des clés héritées**, dont la clé `service_role` est un JWT non révocable. **Sans objet en pile
locale au J3** : aucun composant d'INFLUX ne vérifie un JWT (J3-C, règle 3). Si un jour `apps/api`
en vérifie un, ce sera par JWKS, avec une clé ES256 générée par le script de démarrage local, fichier
ignoré par Git. Hygiène complémentaire : `[auth] jwt_expiry = 300` (le jeton ne vit que le temps d'une
requête ; borne basse acceptée par GoTrue à constater).

**b. Obtenir le code sans envoi, le vérifier, l'invalider**

| # | Question | Réponse | Statut |
|---|---|---|---|
| b1 | Obtenir le code sans que GoTrue l'envoie | `auth.admin.generateLink({ type: "magiclink", email })` → `data.properties.email_otp` (avec `hashed_token`, `action_link`, `verification_type`). **Aucun e-mail ne part**, aucune limite de débit par IP, **aucune fenêtre de 60 s** (réservée à `/otp`) | **Vérifié** (code source `mail.go`, `GoTrueAdminApi.ts`) ; à constater (test) |
| b2 | Pourquoi l'étape 5 de `02` §18.10 reste nécessaire | Pour un utilisateur **inexistant**, `generateLink` bascule en inscription et **crée l'utilisateur lui-même**, sans lire `enable_signup`, sur une autre branche de code (jeton de confirmation). Créer l'utilisateur d'abord garantit que l'étape 6 suit **toujours la même branche** dans GoTrue (jeton de récupération) : R1 tient jusque chez GoTrue | **Vérifié** (code source) |
| b3 | Vérifier | `auth.verifyOtp({ email, token, type: "email" })` : GoTrue compare au jeton de confirmation puis au jeton de récupération, et contrôle l'expiration. Les types `magiclink` et `signup` ne sont pas employés | **Vérifié** (code source `verify.go`) ; à constater |
| b4 | Un nouveau code invalide-t-il le précédent (A-1, RG41) ? | **Oui** : un utilisateur porte **un seul** jeton de récupération, que chaque `generateLink` remplace | **Vérifié** (code source) ; **test T8 obligatoire** |
| b5 | Une vérification réussie invalide-t-elle le code (RG43) ? | **Oui** : le jeton est effacé et tous les jetons à usage unique de l'utilisateur supprimés ; un utilisateur non confirmé est confirmé au passage | **Vérifié** (code source `models/user.go`) ; à constater |
| b6 | GoTrue compte-t-il les échecs (A-2, RG42) ? | **Non.** Aucun compteur, aucune invalidation après N échecs : la borne de cinq tentatives est **entièrement à notre charge** (EC-3). La proposition d'EC-3 est **réalisable** : un second `generateLink` dont le code est jeté invalide le précédent (b4). Elle rend RG42 vraie chez GoTrue ; au travers de notre API, le blocage du parcours (cookie) suffit déjà, car chaque parcours correspond à un seul code | **Vérifié** (code source) ; arbitrage : `expert-cybersecurite` |
| b7 | Création d'une adresse déjà connue | `422`, code `email_exists` : l'erreur à avaler à l'étape 5 | **Vérifié** (code source `admin.go`) — asymétrie de durée : **EC-42** |
| b8 | Sessions GoTrue | `verifyOtp` et `signInWithPassword` **créent une session GoTrue** (jeton d'accès et jeton de rafraîchissement) et la rangent **dans l'instance du client** | **Vérifié** (code source `GoTrueClient.ts`) → J3-C, règles 1 et 2 |
| b9 | Limites de débit | Par IP : `/verify` 30 requêtes / 5 min, `/token` 150 / 5 min, défi et vérification TOTP 15 / min (non réglable). Transmission de l'IP réelle par l'en-tête `Sb-Forwarded-For`, **avec une clé secrète seulement** et une option du projet | **Vérifié** (doc) → **EC-38** |

**c. TOTP**

| # | Question | Réponse | Statut |
|---|---|---|---|
| c1 | API | `auth.mfa.enroll({ factorType: "totp" })` → `id`, `totp.qr_code` (SVG), `totp.secret`, `totp.uri` ; `auth.mfa.challenge({ factorId })` ; `auth.mfa.verify({ factorId, challengeId, code })` ; `challengeAndVerify` ; `listFactors` ; `getAuthenticatorAssuranceLevel` ; `unenroll`. Administration : `auth.admin.mfa.listFactors({ userId })`, `auth.admin.mfa.deleteFactor({ id, userId })`. **Tous les appels non administratifs exigent la session GoTrue de l'utilisateur** : aucune voie d'administration pour inscrire ou vérifier | **Vérifié** (doc TOTP, code source `mfa.go`) |
| c2 | `aal2` | Après vérification, le JWT de GoTrue porte `aal: "aal2"` et `amr`. **INFLUX ne s'en sert pas** : l'`aal` d'une session est celui de `identity.sessions` (`03` §6.2), écrit par `apps/api` | **Vérifié** (doc MFA) |
| c3 | Codes de secours natifs (EC-17) | **Aucun.** L'API n'a pas de notion de code de secours ; Supabase recommande d'inscrire un second facteur TOTP | **Vérifié** (doc, API) → EC-17 : table dédiée (J3-C, règle 9) |
| c4 | Anti-rejeu (B-3) | **Non garanti.** Un défi est à usage unique et **lié à l'adresse IP** qui l'a demandé ; période 30 s, décalage toléré d'un pas. Rien n'empêche de présenter **le même code** avec un nouveau défi dans sa fenêtre | **Vérifié** (code source `mfa.go`) ; à constater → **EC-39** |
| c5 | Défi et vérification | Même adresse IP exigée entre défi et vérification : **les deux dans la même requête d'`apps/api`** | **Vérifié** (code source) |
| c6 | Facteurs non vérifiés | Une nouvelle inscription supprime les facteurs non vérifiés du même type | **Vérifié** (code source) ; **constaté divergent au commit 7** : le facteur non vérifié reste, un même nom est refusé — **EC-56** |

**d. Mots de passe compromis (B-1)**

| Option | Pour | Contre |
|---|---|---|
| A. Protection native de GoTrue (« leaked password protection », HaveIBeenPwned) | Rien à écrire ; s'applique aussi à la création et à la modification par l'administration (code source `password.go`) | **Offre Pro et au-delà** (doc) ; **absente de la configuration de la CLI**, donc ni en pile locale ni en CI : le comportement exigé n'est jamais testé ; échec ouvert ou fermé selon un réglage que nous ne voyons pas |
| B. Vérification par `apps/api`, k-anonymat HIBP (`GET https://api.pwnedpasswords.com/range/<5 caractères>`) | `node:crypto` (SHA-1) et `fetch` suffisent ; testable avec une doublure ; seuls 5 caractères hexadécimaux d'une empreinte quittent le serveur — **aucune donnée personnelle** | Un service externe de plus. **Supportable** : l'appel n'a lieu **que quand un mot de passe est choisi** (amorçage, invitation au J8, changement) — quelques fois par an, jamais à la connexion |
| C. Liste hors ligne | Aucun appel externe | Liste complète de plusieurs dizaines de Go ; une liste tronquée est faible et vieillit |

**Recommandation : B, doublée de A là où elle existe.** `apps/api` porte la règle (12 caractères
minimum ; **72 octets UTF-8 au plus**, limite de hachage de GoTrue à constater ; aucune règle de
composition, aucune expiration) et la consultation HIBP : en-tête `Add-Padding: true`, délai de
2 000 ms, **échec fermé** (« réessayez plus tard ») — acceptable parce que l'opération est rare et
réservée aux comptes internes. En plus : `[auth] minimum_password_length = 12` comme plancher de
GoTrue, et la protection native activée sur les projets en offre Pro (la production le sera pour la
restauration à un instant donné, D57). Avis d'`expert-cybersecurite` requis (B-1 laissait le choix).

**Sources (lues le 2026-09-27)** :
[configuration de la CLI](https://supabase.com/docs/guides/local-development/cli/config) ·
[`generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) ·
[`verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp) ·
[GoTrue `mail.go`](https://github.com/supabase/auth/blob/master/internal/api/mail.go) ·
[`verify.go`](https://github.com/supabase/auth/blob/master/internal/api/verify.go) ·
[`models/user.go`](https://github.com/supabase/auth/blob/master/internal/models/user.go) ·
[`admin.go`](https://github.com/supabase/auth/blob/master/internal/api/admin.go) ·
[`password.go`](https://github.com/supabase/auth/blob/master/internal/api/password.go) ·
[`mfa.go`](https://github.com/supabase/auth/blob/master/internal/api/mfa.go) ·
[`GoTrueAdminApi.ts` 2.117.2](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/auth-js/src/GoTrueAdminApi.ts) ·
[`GoTrueClient.ts` 2.117.2](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/auth-js/src/GoTrueClient.ts) ·
[`SupabaseClient.ts` 2.117.2](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/supabase-js/src/SupabaseClient.ts) ·
[limites de débit](https://supabase.com/docs/guides/auth/rate-limits) ·
[TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) ·
[MFA](https://supabase.com/docs/guides/auth/auth-mfa) ·
[codes de secours demandés, non fournis](https://github.com/orgs/supabase/discussions/16068) ·
[sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security) ·
[clés de signature](https://supabase.com/docs/guides/auth/signing-keys) ·
[`supabase gen signing-key`](https://supabase.com/docs/reference/cli/supabase-gen-keys) ·
[crochet d'envoi d'e-mail](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) ·
[configuration en code, `config push`](https://supabase.com/blog/cli-v2-config-as-code) ·
[migrations et `db push`](https://supabase.com/docs/guides/deployment/database-migrations) ·
registre npm : [`@supabase/auth-js` 2.117.2](https://registry.npmjs.org/@supabase/auth-js/2.117.2),
[`@fastify/cookie` 11.1.2](https://registry.npmjs.org/@fastify/cookie/11.1.2),
[publications de `supabase-js`](https://github.com/supabase/supabase-js/releases).

##### J3-B. Dépendances du J3

Règles de §2.6 et J1-A : version exacte, publiée depuis plus d'un jour, documentation de la version
installée lue. **Deux paquets entrent au J3, pas un de plus.**

| Paquet | Version exacte | Publiée le | Espace | Dépendances transitives | Usage |
|---|---|---|---|---|---|
| **`@supabase/auth-js`** | **2.117.2** | 2026-09-25 | `apps/api` | `tslib` 2.8.1 (**déjà au verrou**) ; aucun script d'installation ; `engines: node >= 22` | Client d'administration et client utilisateur de GoTrue, importés **uniquement** dans `apps/api/src/platform/supabase.ts` |
| **`@fastify/cookie`** | 11.1.2 | 2026-07-15 | `apps/api` | `cookie` ^2, `fastify-plugin` ^6 (organisation Fastify) ; aucun script d'installation | Lecture et écriture des cookies, signature des jetons courts (J3-C, règle 8) |

**`@supabase/auth-js` remplace `@supabase/supabase-js`** (J1-A et §2.6 amendés). Motifs :
`supabase-js` n'est qu'une enveloppe qui installe aussi `postgrest-js`, `realtime-js`,
`functions-js` et `storage-js`. Aucun ne sert au J3 ; et **`postgrest-js` dans `apps/api` est une
tentation permanente** d'écrire `supabase.from(…)`, c'est-à-dire de contourner D5 et les rôles
Postgres. Le coût du choix est connu : poser nous-mêmes les en-têtes que `supabase-js` pose (`apikey`
et `Authorization: Bearer <clé>`, recopiés de `SupabaseClient.ts` 2.117.2) et les options du client
(règle 1). Au Lot 2, `@supabase/storage-js` entrera seul, dans la même ligne de version. Garde
statique à ajouter : `@supabase/supabase-js` et `@supabase/postgrest-js` interdits dans tout
`package.json` du dépôt. **Réversibilité : élevée** (un seul fichier importe le paquet).

La 2.117.2 est prise plutôt que la 2.117.1 fixée au J1-A (règle « correctif de la même mineure,
publié depuis plus d'un jour ») ; son seul changement porte sur `postgrest-js`.

**Écartés**

| Paquet | Motif | Ce qui le remplace |
|---|---|---|
| `@supabase/supabase-js` | Voir ci-dessus | `@supabase/auth-js` |
| `jose` et toute bibliothèque JWT | INFLUX ne vérifie aucun JWT : l'identité vient du corps de la réponse de GoTrue, reçue directement par `apps/api` sur TLS (J3-C, règle 3) | — |
| `otplib`, `speakeasy` | Le TOTP est vérifié par GoTrue | Pour les tests seulement : un générateur RFC 6238 d'une vingtaine de lignes sur `node:crypto` dans `packages/test-kit`, **jamais importable depuis `apps/api/src`** (garde des importeurs) |
| `argon2`, `bcrypt` | Scripts d'installation natifs ; inutiles pour des secrets tirés au hasard | SHA-256 (`node:crypto`) des codes de secours à 80 bits d'entropie, comme l'empreinte de session |
| `qrcode` | GoTrue fournit le QR code en SVG | Règle 5 |
| `@fastify/rate-limit` | La limitation est en base (`identity.auth_request_throttle`, EC-3), commune aux instances | — |
| `@fastify/csrf-protection` | Le contrôle d'origine A4 suffit, sans jeton ni état | A4 |
| `@fastify/helmet` | `apps/api` n'a aucun hôte public et ne sert que du JSON ; les en-têtes navigateur sont posés par les fronts (R7) | — |
| `nodemailer`, `mailpit` | Aucun SMTP : Brevo par HTTP, et une doublure locale (règle 10) | — |
| `ua-parser-js` | Résumé du navigateur par une fonction à liste fermée de familles et de systèmes | `user_agent_summary` |
| `geoip-lite`, `maxmind` | Licence, fichier volumineux, mise à jour mensuelle | EC-43 |
| Bibliothèque HIBP | Un `fetch` et un SHA-1 | Option B de J3-A d |

**Aléa et empreintes : `node:crypto` seul** — `randomBytes(32)` pour l'identifiant de session,
`randomInt` pour la phrase de correspondance (liste d'au moins 256 mots par langue, contenu fourni
par `product-owner` et `expert-ux`) et les codes de secours, `createHash("sha256")`,
`createHmac("sha256")`, `timingSafeEqual`.

##### J3-C. Intégration de GoTrue : règles

1. **Un seul module, `apps/api/src/platform/supabase.ts`.** Il expose un client d'administration
   (sans état, instance unique) et une fabrique `createUserAuthClient(contexte)` **appelée à chaque
   requête** : `persistSession: false`, `autoRefreshToken: false` (sinon un minuteur par instance),
   `detectSessionInUrl: false`, `lock` non fourni (coordination sans verrou, code source 2.117.2),
   `fetch` enveloppé d'un `AbortSignal.timeout` propre à chaque appel, en-têtes `apikey` et
   `Authorization: Bearer` portant la **clé secrète**, plus `Sb-Forwarded-For` quand l'adresse
   d'A5 est valide (EC-38). **Une instance du client utilisateur n'est jamais partagée** entre deux
   requêtes : elle range la session GoTrue en mémoire (J3-A b8), et une instance commune
   mélangerait les sessions de deux utilisateurs. Test : deux connexions concurrentes ne se
   croisent pas.
2. **Aucun jeton GoTrue ne survit à la requête qui l'a obtenu.** Après `verifyOtp`,
   `signInWithPassword` ou la vérification TOTP, `apps/api` lit ce dont il a besoin puis appelle
   `auth.admin.signOut(jeton, "local")`, au mieux (un échec donne une ligne `warn`, jamais une
   erreur montrée). Le jeton n'est ni écrit, ni journalisé, ni renvoyé, ni mis en cookie. Test en
   pile locale : aucune ligne de `auth.sessions` pour l'utilisateur après chaque parcours.
3. **INFLUX n'accepte jamais un jeton GoTrue venu d'un client et ne vérifie aucun JWT.** L'identité
   est l'`id` d'utilisateur **renvoyé par GoTrue dans la réponse** ; le compte est cherché par
   `accounts.auth_user_id`, jamais par l'adresse seule, et l'adresse de la réponse doit être égale à
   celle du compte (sinon refus et ligne `error` sans donnée).
4. **Backoffice : pas de session `aal1`** (proposition, **EC-40**). La connexion tient en **une
   requête** (adresse, mot de passe, code TOTP ou code de secours) : connexion GoTrue, défi et
   vérification dans la même requête (J3-A c5), puis session INFLUX créée **directement en `aal2`**.
   L'inscription du TOTP (MFA-2, B-2) tient en deux requêtes, chacune ré-authentifiée par le mot de
   passe : la première inscrit le facteur et renvoie le QR code et le secret, **sans créer de
   session** ; la seconde vérifie le premier code, crée la session `aal2` et renvoie les dix codes de
   secours **une seule fois** (MFA-3). La ré-authentification R (B-5) = mot de passe + code ; elle
   met à jour la date de dernière vérification sur la ligne de session. Réponse d'échec **unique**,
   quelle que soit l'étape en défaut (adresse, mot de passe, code).
5. **QR code** : `apps/api` renvoie le SVG de GoTrue comme texte ; le backoffice l'affiche par une
   URL `blob:`, **sans modifier la CSP** (`img-src 'self' blob:`, `03` §6.5). Le secret et l'URI
   `otpauth://` sont aussi affichés, pour une saisie manuelle.
6. **Délais** (défauts, en configuration comme G1) : demande de code, ceux de `02` §18.4 ;
   vérification du code, GoTrue 2 000 ms, régénération d'EC-3 2 000 ms, `signOut` 1 000 ms ; connexion
   backoffice, 5 000 ms au total ; HIBP 2 000 ms. Aucun appel externe sous transaction ouverte (G4).
   Au J3 ce sont des constantes d'un module de réglages du domaine `identity` ; elles passent en
   base avec les réglages d'EC-8 (J5, J6) si le besoin « sans redéploiement » de `02` §18.4 se
   confirme.
7. **Journaux** (compléments d'A1, avec C-1) : clés masquées `password`, `code`, `otp`, `token`,
   `email_otp`, `hashed_token`, `action_link`, `secret`, `qr_code`, `uri`, `totp`,
   `recoveryCodes`, `matchingPhrase` ; aucune réponse de GoTrue n'est journalisée telle quelle
   (seuls le code d'erreur de GoTrue et le statut HTTP).
8. **Cookies et jetons.**

   | Cookie | Surface | Contenu | Attributs |
   |---|---|---|---|
   | `__Host-influx-session` | `web` | Identifiant de session : 32 octets aléatoires en base64url ; **seule son empreinte SHA-256 est en base** ; jamais signé (EC-24) | `SameSite=Lax`, `Max-Age` = échéance glissante, reposé à chaque renouvellement |
   | `__Host-influx-ops-session` | `backoffice` | idem | `SameSite=Strict`, `Max-Age` = temps restant jusqu'au plafond de 8 h, posé une fois |
   | `__Host-influx-login` | `web` | Jeton de parcours signé : type, version, échéance (15 min), identifiant de la ligne `transactional_sends`, adresse normalisée, phrase (RG47, RG48) ; **jamais le code** | `SameSite=Lax`, `Max-Age=900` |
   | `__Host-influx-signup` | `web` | Jeton d'inscription signé (EC-4) : type, version, échéance (30 min), `auth_user_id`, adresse, porte | `SameSite=Lax`, `Max-Age=1800` |

   Tous : `Secure`, `HttpOnly`, `Path=/`, sans `Domain`. Signature par le signataire de
   `@fastify/cookie` (HMAC-SHA-256), clé `AUTH_TOKEN_SIGNING_SECRET` (EC-24) ; **l'échéance est
   dans la valeur signée**, jamais dans le seul attribut `Max-Age`, que le client contrôle ; le type
   est vérifié (un jeton de parcours n'est jamais accepté comme jeton d'inscription). `apps/api` ne
   lit que les cookies de la surface identifiée (BO-2) et ignore tout autre nom.
9. **Codes de secours (EC-17)** : dix codes de 16 caractères en base32 de Crockford (80 bits),
   affichés par groupes de quatre, tirés par `node:crypto`, conservés en **SHA-256** ; une nouvelle
   génération invalide la précédente ; consommation dans la transaction de connexion ; génération et
   consommation au registre d'audit, jamais la valeur (MFA-3, MFA-4, EC-44).
10. **Code de connexion en pile locale : doublure Brevo sur la boucle locale.** La doublure HTTP
    des tests (`node:http`, `packages/test-kit`) sert aussi de serveur de développement : elle reçoit
    les envois de `apps/api` et les montre sur une page locale. Même chemin de code qu'en production,
    seule `BREVO_API_BASE_URL` change ; **aucun appel externe** au J3. Garde de démarrage :
    `BREVO_API_BASE_URL` différente de l'adresse officielle de Brevo n'est acceptée que sur un hôte
    de bouclage, et jamais en production. Les comptes de test de D62 restent utilisables par qui le
    souhaite, en mode `redirect`.
11. **Comptes de démonstration** (point 8) : un script TypeScript, lancé après `supabase db reset`
    (local et CI), crée les utilisateurs GoTrue par l'API d'administration puis les lignes
    `identity` sous le rôle de migration ; il **refuse de s'exécuter en production** ; adresses en
    `example.test` ; mots de passe fixes réservés au local et à la CI ; le TOTP des deux comptes
    internes est inscrit à la première connexion (B-2), par le test de bout en bout avec le
    générateur de `test-kit`.
12. **Renouvellement glissant paresseux** (EC-29) : au plus une écriture par heure pour une session
    membre, par minute pour une session backoffice ; échéances bornées en base par les contraintes
    de `0004`. **Révocation à la suspension** : `identity.resolve_session()` refuse déjà un compte
    non actif, donc l'effet est immédiat dès le J3 (test T8) ; la fonction de révocation par un
    tiers arrive avec l'action de suspension (J8).

##### J3-D. C-3 — un `DELETE` ne porte ni corps ni `content-type`

**Règle.** Les paramètres d'un `DELETE` sont dans le chemin. Une suppression qui a besoin d'un corps
(motif, confirmation) est un **`POST` sur une action nommée** — ainsi `POST /v1/auth/logout`.

**Où elle s'applique : dans `apps/api` seulement.**

1. `onRoute` **refuse de démarrer** si une route `DELETE` (ou `GET`) déclare `schema.body`.
2. Un crochet `onRequest`, **après** l'identification de la surface et avant toute analyse :
   un `DELETE` portant `content-type`, `transfer-encoding`, ou un `content-length` non nul reçoit
   `400 validation_failed` en enveloppe, sans analyse du corps ni ligne `error`. Le résultat ne
   dépend plus du comportement de Fastify sur un corps vide (constat de `4058bf2`).

**Le passe-plat ne change pas** : il ignore déjà le corps d'un `DELETE` (R2) et relaie
`content-type`, en-tête de la liste blanche PP-5 ; la réponse `400` vient d'`apps/api`. Ni
`relay.ts` ni `api-client.ts` ne sont ré-épinglés (PP-12). Tests : `DELETE` avec `content-type` et
corps vide, avec un corps `text/plain`, sans rien (atteint la route) — sur une route d'essai, aucun
`DELETE` n'existant au J3 — et refus de démarrage d'un `DELETE` à corps déclaré.

##### J3-E. Variables du J3

Dans le `.env.example` de `apps/api`, **dans le commit qui les lit** (J1-F). Refus de toute valeur
contenant `CHANGE_ME`, quelle que soit la casse (N3).

| Variable | Service | Nature | Commit | Remarque |
|---|---|---|---|---|
| `INFLUX_PUBLIC_SITE_URL`, `INFLUX_PUBLIC_BACKOFFICE_URL` | `api` | Publiques | 4 | Déjà décidées (J1-F) ; contrôle d'origine A4 |
| `AUTH_THROTTLE_PEPPER` | `api` | **Secrète**, ≥ 32 octets | 4 | Déjà décidée (J1-F) |
| `SUPABASE_URL` | `api` | Non secrète, non publiée | 7 | Local : `http://127.0.0.1:54321` |
| `SUPABASE_SECRET_KEY` | `api` ; `worker` au J6 seulement (purge E-4) | **Secrète** | 7 | Clé `sb_secret_…`, **une par service** (EC-46) ; en pile locale, celle de `supabase status` (**à constater** : la CLI 2.117 affiche une clé `sb_secret_`) |
| `AUTH_TOKEN_SIGNING_SECRET` | `api` | **Secrète**, ≥ 32 octets | 7 | Remplace `SESSION_COOKIE_SECRET` (**EC-24 retenue**) ; distincte de tout autre secret du processus ; rotation : les parcours en cours (15 à 30 min) sont perdus, acceptable |
| `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL` | `api` | Clé secrète (**clé propre à `api`**, distincte de celle du `worker`) | 8 | EC-19 tranchée : verrous 2 et 3 de `02` §12.4 dès le premier envoi ; garde de J3-C, règle 10 |
| ~~`SUPABASE_PUBLISHABLE_KEY`~~, ~~`SUPABASE_JWKS_URL`~~ | — | — | — | **Retirées** (EC-46) |

##### J3-F. Ordre des commits

Chaque commit laisse `pnpm check` vert. Le marqueur `security-reviewed: <date>` est exigé par I-4
pour tout commit qui touche une migration contenant un motif de `03` P8 (droit, politique, fonction
`SECURITY DEFINER`, `audit.*`) ou le fichier d'attendus de T2 ; il suppose **une relecture préalable
par `expert-cybersecurite`**. Les autres commits sont relus à la **revue de fin de J3** ; je
recommande que 7 à 10, qui forment le chemin d'authentification, soient relus ensemble **avant le
push**.

| # | Commit | Contenu | Qui | Marqueur I-4 | Préalables levés · écarts à trancher avant |
|---|---|---|---|---|---|
| 1 | `test: floor of executed cases and interrupted-run check` | **Q2** (rapport JSON de Vitest, zéro saut, plancher par fichier), **V4**, **EC-35 (3)** (aucun droit d'un rôle `influx_*` dans `_realtime` ni `extensions`) | `dev-react-node` | Non | Q2, V4, EC-35 (3) : **avant tout nouveau test en base** |
| 2 | `feat(api): make the response filter non-bypassable` | **N2 / F-1** : règles ESLint, refus `onRoute` des crochets de route `onSend` et `preSerialization`, parcours des schémas 2xx, un test par vecteur (sept) | `dev-react-node` | Non | **N2 : avant la première route qui renvoie une donnée personnelle** (commit 9) |
| 3 | `feat(api): redact auth values and assert logs by value` | Clés de J3-C règle 7 ; troncature forcée du journal (revue de fin de J2, point (b) « à surveiller ») ; outil de test **C-1** (capture du flux, recherche par valeur) | `dev-react-node` | Non | C-1 (outil ; chaque test d'authentification l'emploie ensuite) |
| 4 | `feat(api): origin check on writes, client address, bodiless DELETE` | **A4** (point 10), **A5** (point 11), **C-3** (J3-D), **N3** ; variables de J3-E ; tâche de CI sous **Node 24** exécutant le test du passe-plat (**C-2**, `integrateur`) ; `18` T7.12 reformulé (**C-4**, `testeur`, sans code) | `dev-react-node`, `integrateur`, `testeur` | Non | A4, A5, C-2, C-3, C-4, N3 : **avant toute route d'écriture** |
| 5 | `feat(db): refuse native Supabase Auth e-mails` + `chore(supabase): auth settings` | Migration du crochet « puits » (**EC-41**) ; réglages a1 à a5, `minimum_password_length = 12`, `jwt_expiry = 300`, limites locales (EC-38) ; tests a3, a4 ; contrôle I-4 étendu à `config.toml` (**EC-48**) | `expert-database`, `dev-react-node` | **Oui** (fonction, `GRANT`, `REVOKE`) | EC-16 · **EC-37, EC-41, EC-48** |
| 6 | `feat(db): auth journal, throttle, session writes, recovery codes, elevated audit` | Migration(s) ex-`0108`, numérotées selon **EC-37** : `leads.transactional_sends` (EC-6, EC-7), `identity.auth_request_throttle` (EC-3, EC-47), écritures de session (EC-29) et colonnes d'EC-40, codes de secours (EC-17), anti-rejeu (EC-39), `audit.append_elevated()` et codes `elevated.*` (**EC-36**, avec **V1, V5, V6**), droits d'`influx_auth` ; tests **V2** ; fichier d'attendus de T2 | `expert-database` | **Oui** | EC-36, V1, V2, V5, V6 : **avant E-1** · EC-3, EC-17, EC-29, EC-37, EC-39, EC-40, EC-47 |
| 7 | `feat(api): Supabase Auth adapter and auth cookies` | `@supabase/auth-js` 2.117.2, `@fastify/cookie` 11.1.2 ; `platform/supabase.ts` (J3-C règles 1 à 3) ; jetons signés (règle 8) ; garde des paquets interdits (J3-B) ; **tests de constat** de J3-A en pile locale | `dev-react-node` | Non | EC-24, EC-38, EC-46 |
| 8 | `feat(api): request a login code` | `POST /v1/auth/request-code`, **application littérale de `02` §18.10** ; connecteur Brevo unitaire, disjoncteur, plancher ; **E-1 entre dans l'union avec T4.7 élevé** ; doublure Brevo locale et garde (règle 10) ; lead-pipeline T1 et T10 | `dev-react-node` | Non, sauf s'il touche le fichier d'attendus | T4.7 élevé (EC-35 (6)) · EC-19, EC-42 |
| 9 | `feat(api): verify a login code and open a member session` | `POST /v1/auth/verify-code` (EC-3, EC-4, RG66 à RG69), **E-2**, session et cookie, renouvellement (règle 12), `POST /v1/auth/logout`, `GET /v1/me` minimal ; T8 | `dev-react-node` | Non | N2 déjà en place · EC-4, EC-5 |
| 10 | `feat(api): backoffice sign-in with mandatory TOTP` | `/v1/bo/auth/login`, `/v1/bo/auth/enroll`, `/v1/bo/auth/logout`, `GET /v1/bo/me` ; garde `aal2` (route backoffice sans `aal2` ⇒ `403`) ; codes de secours ; anti-rejeu ; compte de secours (ligne d'audit) ; règle B-1 (J3-A d) | `dev-react-node` | Non | B-2, B-3, MFA-2, MFA-3 · EC-39, EC-40, EC-44 |
| 11 | `chore: demo accounts seed` | Script de J3-C règle 11, version de CGU fictive marquée comme telle | `dev-react-node`, `expert-database` | Non, **sauf** s'il ajoute un droit ou touche le fichier d'attendus | EC-45 |
| 12 | `feat(web,backoffice): minimal sign-in screens and empty homes` | Point 9 : écran minimal de connexion membre (adresse, code), connexion et inscription du TOTP au backoffice (codes de secours affichés une fois), accueils vides | `dev-react-node` (+ `expert-ux`) | Non | — |

**Terminé quand** (inchangé, précisé) : les quatre comptes de démonstration se connectent en local
dans leur espace — les membres avec le code reçu par la doublure Brevo, les comptes internes avec
mot de passe et TOTP inscrit à la première connexion — et les tests de constat de J3-A sont verts.

##### J3-G. Ce qui ne change pas

`02` §18.10 (dix étapes, `200` uniforme, plancher), D37, les durées de `03` §6.1, le passe-plat et
son empreinte, la liste fermée des opérations élevées (E-1 et E-2 seulement au J3), et le modèle
économique : **aucune ligne du J3 ne touche un montant ni un taux.**

##### J3-H. Ce que ces décisions demandent aux autres agents

| Agent | Demande |
|---|---|
| `expert-cybersecurite` | Trancher, avant les commits indiqués en J3-F : EC-3 (régénération ou non, J3-A b6), EC-4, EC-5, EC-16 et EC-41, EC-17, EC-19, EC-24, EC-29, EC-38 à EC-40, EC-42 à EC-45, EC-47, EC-48 ; avis sur l'option B de B-1 (J3-A d) et sur J3-C règles 2, 4, 8 et 10 ; relecture préalable des commits 5 et 6 (marqueur) — **rendu le 2026-09-27** : « Arbitrages de sécurité du J3 » ci-dessous |
| `expert-database` | EC-37 (numérotation, clé étrangère différée), colonnes et droits des commits 5 et 6, EC-39, EC-40, EC-47 ; corriger `04` §11.2 selon EC-37 |
| `expert-conformite-rgpd` | EC-38 (transmission de l'adresse IP à Supabase, journal d'audit de GoTrue) ; information : la consultation HIBP n'envoie aucune donnée personnelle — **rendu le 2026-09-27** : « Avis de conformité du J3 » ci-dessous |
| `integrateur` | EC-46 (`02` §12.3, skill `env-secrets`) ; C-2 (tâche Node 24) ; au J4 : `supabase config push`, clés asymétriques et clés héritées désactivées, option `Sb-Forwarded-For`, protection native des mots de passe compromis si offre Pro |
| `testeur` | C-4 ; tests de constat de J3-A (colonne « Test ») ; plancher Q2 ; mesure d'EC-42 |
| `product-owner`, `expert-ux` | Listes de mots de la phrase de correspondance (fr, en) ; ressaisie du mot de passe à l'inscription du TOTP (EC-40) ; EC-43 — **`product-owner` : rendu le 2026-09-27** (mise en forme des écrans : `expert-ux`). **Phrase** : deux mots distincts, langue de la page et jamais du compte, listes fermées de 256 mots FR et EN, critères testables, emplacements (`05` RG128 à RG134). **E-mail du code** FR/EN, sans pays ni lien, heure avec fuseau, navigateur (`05` RG135, `16` RG156, RG158, RG159). **Messages membre** du J3 FR/EN, expiré à 10 min quel que soit le code, cinq tentatives, compte interne sans lien vers le backoffice (`05` RG136 à RG140, `17` §3.7). **Backoffice** en français : connexion en une fois, activation en trois étapes avec mot de passe ressaisi, codes de secours affichés une fois, échec unique, R et B-1 (`17b` §3.14). **EC-43** : signal « navigateur inconnu », dit « nouveau navigateur », 30 jours, e-mail `auth.new_device` et alerte B-7 (`05` RG141 à RG146, `16` RG157, `17b` §3.14.e). **À trancher avant le commit 8** : `user-agent` n'est pas relayé par le passe-plat (`03` PP-5), donc aucun navigateur n'atteint `apps/api` (`05` Q14, `architecte` + `expert-cybersecurite`) ; en attendant, e-mail sans navigateur. Autres questions : `05` Q15 à Q17 |
| `chef-de-projet` | EC-44, EC-45 ; commiter ce document |

#### Arbitrages de sécurité du J3 — `expert-cybersecurite` (2026-09-27)

> **Pas de veto sur le lancement du J3 ; les commits 1 à 4 peuvent commencer.** Tous les écarts qui
> me reviennent sont tranchés ci-dessous. Aucun n'est refusé sur le fond ; EC-29 est retenu sous
> une autre forme pour le renouvellement et la révocation ; un constat nouveau, **G-1**, ajoute trois
> contrôles. Relu : §3, J3-A à J3-H, l'avis de conformité qui suit, `02` §9.3, §12.3, §18.5,
> §18.10, `03` §6.1, §6.2, §6.4, §6.9, P7, `04` §12.10, `05` RG40 à RG69, `supabase/config.toml`,
> `0004`. Aucun environnement distant touché, aucun fichier `.env` lu. Sources externes, **à
> constater en pile locale au commit 7** comme J3-A :
> [enrôlement réservé à `aal2` dès qu'un facteur vérifié existe](https://github.com/supabase/auth/pull/1439),
> [changement d'adresse ou de mot de passe refusé en `aal1` quand le MFA est actif](https://github.com/supabase/auth/issues/2091),
> [clés `sb_` : pas des JWT](https://supabase.com/docs/guides/getting-started/api-keys).

**G-1 — Constat nouveau (Important) : GoTrue reste joignable sans passer par `apps/api`.**

- *Surface* : points d'accès publics de GoTrue (`/verify`, `/token`, `/user`, `/factors`), joignables
  avec la clé *publishable*, qui n'est pas un secret.
- *Scénario* : l'attaquant fait envoyer par INFLUX un code à une adresse (chemin normal, y compris
  pour un compte interne, RG68), puis essaie les codes **directement** sur `/auth/v1/verify` depuis
  de nombreuses adresses IP : le compteur d'EC-3 ne voit rien. À 30 essais par 5 min et par IP
  (défaut de GoTrue) et 10 000 IP de mandataires résidentiels, ≈ 45 % de réussite par code. Il
  obtient une **session GoTrue**, jamais une session INFLUX (J3-C règle 3). Mais avec elle : (a) pour
  un compte interne **dont le TOTP n'est pas encore inscrit**, `PUT /user` change le mot de passe,
  puis notre route d'inscription du TOTP, protégée par le seul mot de passe, lui livre le second
  facteur ; (b) pour un compte interne à TOTP vérifié, GoTrue refuse en `aal1` le changement de mot
  de passe et l'enrôlement (sources ci-dessus) ; (c) pour un membre : code consommé ou adresse
  modifiée côté GoTrue, soit un déni de service, pas une prise de contrôle.
- *Impact* : (a) donne un compte du backoffice — toutes les identités et toutes les conversations ;
  fenêtre = entre la création d'un compte interne et son premier enrôlement.
- *Correctifs, tous exigés* :
  1. **Épinglage du facteur** (commits 6 et 10, 30 min) : INFLUX enregistre l'identifiant du facteur
     TOTP vérifié à l'enrôlement ; la connexion ne défie **que** ce facteur ; tout autre facteur
     vérifié listé par GoTrue ⇒ refus uniforme, audit `agent.unexpected_mfa_factor`, `pino` `error`.
  2. **Jeton d'enrôlement** (B-8, MFA-1 ; 2 h) : toute inscription du TOTP — la première, ou après
     une réinitialisation MFA-6 — exige, en plus du mot de passe, un jeton à usage unique (≥ 128 bits
     aléatoires, SHA-256 en base, 72 h, lié au compte) remis par l'invitation (J8) ou, au J3, par le
     script (valeur fixe du jeu de démonstration, local et CI). Au J3 si l'effort tient dans les
     2 h, sinon au J8 ; **bloquant avant la création de tout compte interne réel**.
  3. **Constats en pile locale** (commit 7), avec une session GoTrue obtenue directement par la clé
     *publishable* locale, dans le code de test seulement : aucune route d'INFLUX ne l'accepte
     (`Authorization: Bearer`, cookies `sb-*` ⇒ `401`) ; pour un utilisateur à TOTP vérifié,
     `PUT /user` (mot de passe, adresse) et `mfa.enroll` refusés en `aal1` ; pour un membre,
     `PUT /user` sur l'adresse la laisse inchangée (crochet « puits »). **Un constat divergent bloque
     le commit 10** et me revient.
  4. **Au J4** (`integrateur`) : si le projet hébergé permet de n'avoir **aucune clé publishable
     active** — INFLUX n'en utilise aucune (EC-46) —, la désactiver : cela ferme d'un coup G-1 et
     EC-41. Sinon, le déni de service résiduel est accepté (`03` §9.3, S-11).

**EC-3 — retenu, durci.**

1. Portée `login_request` d'`identity.auth_request_throttle`, clé = empreinte HMAC d'une **référence
   aléatoire** (uuid v4) de la ligne `transactional_sends`, portée par le cookie de parcours —
   jamais un identifiant séquentiel, qui révélerait le volume de connexions.
2. **Réservation atomique avant tout appel à GoTrue** : si moins de cinq tentatives, incrément dans
   une transaction E-2 validée avant l'appel (G4) ; sinon refus sans appel. On compte des
   *tentatives*, pas des échecs constatés après coup : vingt requêtes parallèles ne doivent pas
   donner vingt essais.
3. Sans cookie de parcours valide (signature, `typ = login`, échéance), refus sans appel à GoTrue
   (RG47). L'adresse vient du cookie, **jamais du corps**.
4. **Au cinquième échec, la régénération est retenue** : `generateLink` pour l'adresse du cookie,
   résultat ignoré sans être lu ni journalisé, cookie de parcours effacé. Motif : G-1 — RG42 doit
   être vraie chez GoTrue, pas seulement sur notre chemin. Échec de la régénération : `warn`,
   réponse inchangée.
5. Par IP : 20 échecs de vérification par heure (RG44), contrôlés avant l'appel. Aucun compteur
   bloquant par adresse (A-4).
6. Surveillance globale (A-3) : au moins 100 échecs en 15 min sur la plateforme, ou plus de 50 %
   d'échecs sur au moins 30 vérifications en 15 min ⇒ `pino` `error` `security.verify_failure_spike`
   au J3, alerte D60 au J9.

*Tests (T8, commit 9)* : sixième essai refusé sans appel ; après le cinquième échec, **l'ancien code
est refusé par GoTrue interrogé directement** ; vingt requêtes parallèles sur un même cookie ⇒ au
plus cinq vérifications chez GoTrue ; cookie absent, altéré, expiré ou de type `signup` ⇒ refus sans
appel ; code absent de toute sortie (C-1).

**EC-4 — retenu, durci.**

1. Émis seulement après une vérification réussie, si aucun compte ne porte cet `auth_user_id` ni
   cette adresse. Contenu signé : `typ = signup`, version, `exp` (≤ 30 min), `verified_at`,
   `auth_user_id`, adresse normalisée, porte proposée. Aucun jeton GoTrue.
2. `SameSite=Strict` (aucun lien entrant n'y mène), autres attributs de J3-C règle 8.
3. La porte n'est qu'une valeur par défaut (RG3) : le rôle vient de l'écran 3, validé
   `advertiser` | `creator` par zod **et** par `identity.provision_account` (EC-30).
4. Consommation (J5, E-2 `identity.complete_signup`) : signature, type et échéance vérifiés **avant**
   toute lecture du contenu ; relecture de l'utilisateur GoTrue (`admin.getUserById`) — il existe et
   son adresse est celle du jeton, sinon refus et `error` sans donnée (G-1 c) ; une seule transaction
   (RG7) ; unicité d'`auth_user_id` et d'`email` ⇒ un rejeu ne crée rien ; cookie effacé ;
   `email_verified_at` = `verified_at` (RG53).
5. Aucune autre route ne l'accepte. Aucun état de révocation : son seul effet est idempotent.

*Tests* : rejeu ⇒ un compte, une acceptation, un consentement ; jeton expiré, altéré d'un octet ou
de type `login` ⇒ refus ; rôle `agent` dans le corps ⇒ `400` sans écriture ; adresse GoTrue
modifiée ⇒ refus. Émission au commit 9, consommation au J5.

**EC-5 — retenu : révision signée de `03` P7, faite ce jour.** Les cinq entrées restent cinq (mêmes
rôles, mêmes grappes) ; chacune se décline en **motifs nommés, un par point d'usage**, chacun dans
l'union fermée de `packages/contracts`, avec son code `elevated.<motif>` (EC-36) et son jeu
d'appelants vérifié par T6. E-1 : `identity.request_code` ; `support.report_delivery_issue` (J5,
canal de secours RG65 : écriture **uniquement** par une fonction `SECURITY DEFINER` étroite, sans
droit de table d'`influx_auth` sur la file, mêmes limitations de débit, aucune lecture, aucune
session). E-2 : `identity.verify_code` ; `identity.complete_signup` (J5) ;
`identity.backoffice_sign_in` ; `identity.backoffice_enroll_totp` ; `identity.backoffice_reauthenticate`
(R). Motif : un rôle par usage coûterait une grappe et une variable pour une séparation illusoire
(même processus) ; des motifs distincts donnent la traçabilité et une liste fermée vérifiable.
Contrepartie : `influx_auth` devient le rôle d'exécution le plus sensible — droits **colonne par
colonne** (commit 6), requêtes paramétrées seules sur sa grappe. Dans
`packages/contracts/src/elevated-operations.ts`, l'ensemble signé P reçoit les cinq nouveaux motifs
au commit 8, chacun lié à la grappe `AUTH_DATABASE_URL` ; l'ensemble U ne reçoit un motif qu'avec son
premier appelant (T6.1).

**EC-16 et EC-41 — retenus, durcis (commit 5).**

1. `enable_signup = false` (`[auth]` et `[auth.email]`) ; connexions anonymes, liaison manuelle,
   fournisseurs externes et SMS désactivés.
2. Crochet « puits » `auth_hooks.refuse_native_email(event jsonb)` : `SECURITY INVOKER`,
   `search_path = ''`, n'écrit rien, **ne lit ni ne recopie la charge utile** (elle porte un code et
   un jeton : ni `RAISE`, ni message dérivé), réponse d'erreur constante ; `EXECUTE` et `USAGE` du
   schéma à `supabase_auth_admin` seul, révoqués à `PUBLIC`, `anon`, `authenticated`,
   `service_role` ; schéma sans table.
3. Hygiène : `[auth.email] max_frequency = "60s"` (sans effet sur `generateLink`, J3-A b1) ;
   `secure_password_change = true`.
4. Constats : `POST /auth/v1/signup` refusé ; `/otp`, `/recover`, `/resend`, `/magiclink` pour un
   utilisateur existant ⇒ aucun envoi (la doublure Brevo ne reçoit rien) ; **après un `/otp` refusé,
   le code en cours du membre reste accepté**. Si ce dernier constat échoue : déni de service borné
   par `max_frequency`, accepté (S-11), signalé pour mémoire.
5. G-1, point 4, au J4.

**EC-17 — retenu, durci (J3-C règle 9 confirmée).**

1. Dix codes de 80 bits en base32 de Crockford ; saisie normalisée (casse, espaces, tirets, `O`→`0`,
   `I` et `L`→`1`) ; SHA-256 suffit à cette entropie.
2. Table dédiée : aucun droit des quatre rôles métier ; `influx_auth` insère et marque la
   consommation, colonnes nommées. Une nouvelle génération marque la précédente révoquée, sans
   suppression.
3. Consommation par un `UPDATE … WHERE consumed_at IS NULL AND revoked_at IS NULL … RETURNING`
   dans la transaction qui crée la session : usage unique sous concurrence.
4. Accepté seulement avec le mot de passe vérifié par GoTrue dans la même requête. La session porte
   `mfa_method = recovery_code` et **ne satisfait jamais R** (B-5) : les actions irréversibles
   attendent la réinitialisation par un autre administrateur (MFA-6) ou passent par le compte de
   secours.
5. Génération à l'enrôlement et après réinitialisation (J8) ; aucune régénération libre au J3.
   Affichage unique : `Cache-Control: no-store`, clé `recoveryCodes` masquée, rien dans le stockage
   du navigateur.

**EC-19 — retenu, durci : la clé Brevo sur `api` est acceptée.** Elle découle de D43, déjà validée ;
et le processus `api` détient déjà `influx_app`, membre d'`influx_admin` : sa compromission est déjà
le pire cas, la clé y ajoute la capacité d'écrire au nom d'INFLUX.

1. **Deux clés Brevo distinctes par environnement**, une pour `api`, une pour `worker` (même nom de
   variable, valeurs et noms de clé différents chez Brevo) : révocation séparée, usage attribuable.
2. `api`, commit 8 : `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`,
   `BREVO_SENDER_TRANSACTIONAL` — **les verrous 2 et 3 de `02` §12.4 s'appliquent dès le premier
   envoi du code** (refus de démarrage en `live` hors production, destinataires de la liste en
   `redirect`) ; au J7, `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN`, `BREVO_IP_ALLOWLIST`,
   **sur `api` seul**. `worker`, J6 : les cinq premières, plus `BREVO_SENDER_MARKETING`,
   `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID` ; jamais les secrets du webhook.
3. Garde statique (commit 8) : le code chargé par le processus HTTP n'appelle que l'envoi
   transactionnel unitaire (`/smtp/email`), avec un modèle d'une liste fermée ; tout autre chemin
   Brevo (contacts, listes, campagnes) n'est importable que depuis le code du worker.
4. À surveiller : la restriction des adresses IP autorisées chez Brevo, à activer dès que la
   production a des adresses de sortie fixes (Railway Pro, point ouvert de D60) ; `integrateur`
   constate au J4 que l'option existe sur l'offre Brevo retenue.

**EC-24 — retenu.** `SESSION_COOKIE_SECRET` disparaît. `AUTH_TOKEN_SIGNING_SECRET` (≥ 32 octets
aléatoires, un par environnement) signe les seuls jetons courts (`login`, `signup`) ; l'identifiant
de session n'est jamais signé. Refus de démarrage si la valeur égale `AUTH_THROTTLE_PEPPER` ou l'un
des deux secrets internes. Signature vérifiée à temps constant (celle de `@fastify/cookie` 11.1.2 à
vérifier dans son code, sinon `timingSafeEqual`), **avant** tout décodage, puis zod. Rotation :
procédure A, parcours en cours perdus, sans seconde clé. Corrigés : `02` §12.3, skill `env-secrets`,
`03` T11, `apps/api/.env.example` ; `packages/test-kit/src/artifacts.ts` (T11.1) à aligner au
commit 7.

**EC-29 — création retenue ; renouvellement et révocation par le titulaire remplacés.** Le droit
`UPDATE (revoked_at, revocation_reason)` proposé aux quatre rôles permettrait de remettre
`revoked_at` à nul : une session révoquée par un administrateur (cookie volé) serait ressuscitée
depuis n'importe quelle autre session du même compte. Et `UPDATE (last_activity_at,
idle_expires_at)` laisserait l'application écrire les dates.

1. **Création** : `INSERT` de colonnes nommées par `influx_auth` (E-2), politique `WITH CHECK` sur un
   compte `active` ; `created_at` et `last_activity_at` par défaut (`now()`), jamais fournis.
2. **Renouvellement** : `identity.touch_session(p_session_id uuid)`, `SECURITY DEFINER`, propriétaire
   `influx_identity_definer`, `EXECUTE` aux quatre rôles métier. Ligne du compte courant, non
   révoquée, non expirée, surface cohérente avec le rôle (backoffice ⇒ `aal2` courant). **Dates
   calculées en base** : `last_activity_at = now()`, `idle_expires_at = least(now() + 720 h ou
   30 min, absolute_expires_at)` ; sans effet si la dernière écriture date de moins d'une heure
   (membre) ou d'une minute (backoffice) — J3-C règle 12 portée par la base.
3. **Révocation par le titulaire** : `identity.revoke_own_session(p_session_id uuid, p_reason)`, même
   propriétaire, motifs `logout` et `revoked_by_holder` seulement, ligne du compte courant.
4. **Irréversibilité** : déclencheur `BEFORE UPDATE` — une ligne révoquée n'est plus modifiable ;
   `token_hash`, `account_id`, `surface`, `aal`, `created_at`, `absolute_expires_at` immuables. Aucun
   droit `UPDATE` ni `DELETE` de table pour les rôles métier.
5. Révocation par un tiers et suspension : fonction journalisée au J8 ; d'ici là,
   `resolve_session()` refuse un compte non actif (J3-C règle 12).

*Tests (commit 6)* : T2, aucun droit d'écriture des rôles métier sur `sessions` ; `touch_session`
sur la session d'un autre compte sans effet ; dates impossibles à fournir ;
`revoke_own_session(…, 'revoked_by_admin')` refusé ; ligne révoquée non modifiable.

**EC-38 (partie sécurité) — en-tête exigé ; valeur pseudonyme retenue, en accord avec l'avis de
conformité (condition (1)).**

1. Sans lui, les limites de GoTrue par IP deviennent un **plafond global** : trente tentatives de
   connexion au backoffice en 5 min, depuis n'importe où, suffisent à le fermer (J3-A b9). L'en-tête
   est donc **exigé** sur chaque appel d'`apps/api` à GoTrue, seulement si l'adresse d'A5 est
   valide, jamais tiré d'un autre en-tête.
2. **Valeur** : adresse IPv6 pseudonyme du bloc `fd00::/8`, dérivée par HMAC-SHA-256 (clé
   `AUTH_THROTTLE_PEPPER`, étiquette de séparation `gotrue-ip:`) de la clé de limitation d'A5 (/32,
   /64). **Faisabilité et innocuité confirmées** : mêmes regroupements et même stabilité par client
   que l'adresse réelle, défi et vérification TOTP cohérents (même valeur dans une requête), aucune
   perte de sécurité. Constat d'acceptation par GoTrue : en pile locale au commit 7 si l'option y est
   activable, sinon sur `staging` au J4. **Repli** si GoTrue la refuse : adresse réelle normalisée,
   IPv6 tronquée à /64 — sécurité équivalente.
3. `auth.audit_log_entries` : **conservé, purgé à 90 jours** (plafond de l'avis de conformité) — c'est
   la seule trace d'une session ouverte directement chez GoTrue (G-1), consultée au seul tableau de
   bord en cas d'incident (S-7). Purge par une tâche créée par le rôle de migration : **aucun droit
   sur le schéma `auth` pour nos rôles d'exécution** ; forme : `expert-database` + `integrateur`.
4. Les limites relevées pour les tests en pile locale passent par `env()` ou une section propre au
   local de `config.toml`, **jamais par une valeur que `supabase config push` porterait vers un projet
   hébergé** ; au J4, `integrateur` relit les limites effectives de `staging` et de `production`.

**EC-39 — retenu, durci (commit 6).** Empreinte HMAC-SHA-256 (clé `AUTH_THROTTLE_PEPPER`, étiquette
`totp-replay:`) du couple (facteur, code) et date d'acceptation, une ligne par compte ; **même code
refusé pendant 120 s** (90 s de validité chez GoTrue, plus une marge de dérive d'horloge). Écriture
par `INSERT … ON CONFLICT … DO UPDATE … WHERE` conditionnel **dans la transaction qui crée la
session** : deux connexions concurrentes avec le même code ⇒ une seule session. S'applique à la
connexion, au premier code de l'enrôlement et à R.

**EC-40 — retenu, durci.**

1. Contrainte : `surface = 'backoffice'` ⇒ `aal = 'aal2'`, `mfa_verified_at` et `mfa_method` non
   nuls ; `surface = 'member'` ⇒ `aal = 'aal1'` et `mfa_*` nuls (jusqu'à la clause de caducité de
   D37).
2. `mfa_verified_at` n'est écrit que par `influx_auth` (E-2 : connexion, enrôlement, R), **jamais
   par un rôle métier** : une injection dans `influx_app` ne peut pas se forger une fraîcheur. R
   n'est satisfaite que par un code TOTP et si `now() - mfa_verified_at ≤ 5 min` au moment de
   l'action, lu sur la ligne, jamais sur un réglage (revue du 2026-09-26, point (c)).
3. Connexion, enrôlement et R : réponse d'échec unique **et plancher de durée constant sur toutes
   les issues** (1 500 ms au départ, mesuré comme EC-42) — sans plancher, la durée révèle que le mot
   de passe est juste quand seul le code est faux.
4. Ressaisie du mot de passe à la seconde requête de l'enrôlement : retenue. Épinglage du facteur et
   jeton d'enrôlement : G-1.
5. Cinq échecs de R en 15 min sur une même session ⇒ session révoquée (nouveau motif
   `reauthentication_failed`), audit, `pino` `error`.

*Tests (commit 10)* : une session backoffice `aal1` ne peut pas être insérée ; mot de passe juste et
code faux indiscernable d'une adresse inconnue (contenu, statut, durée) ; R refusée au-delà de
5 min, après un code de secours, ou sans ligne ; cinq échecs de R ⇒ session révoquée.

**EC-42 — méthode et seuil.**

1. Au J3 (commit 8), en pile locale : 500 demandes par classe (adresse jamais vue, compte existant),
   **entrelacées au hasard**, doublure Brevo sans latence ; relever pour chaque classe la durée de
   l'étape 5 et celle du gestionnaire (médiane, p99, p99,9) et la part des demandes au-dessus du
   plancher. Consigné, non décisif (pas de réseau réel).
2. **Mesure décisive au J4 sur `staging`**, même protocole, Brevo en `redirect`.
3. **Seuil d'action** : si plus de **0,5 %** des demandes d'une classe dépassent le plancher, le
   plancher passe au **p99,9 de la classe la plus lente + 20 %**, arrondi aux 100 ms supérieures. En
   deçà, rien : l'attaquant ne voit que `max(durée, plancher)`, et RG44 limite son échantillonnage à
   dix demandes par heure et par adresse.
4. En production (D60) : part des demandes de code au-dessus du plancher, par minute, **sans
   ventilation par classe** ; alerte au-delà de 1 % sur une heure.

**EC-43 (partie sécurité) — accepté, à surveiller (`03` §9.3, S-12).** `country_code` reste nul au
MVP ; l'e-mail du code (A-8) et la notification de nouvel appareil citent l'heure et le navigateur.
Pour B-7, au J8 : **connexion au backoffice depuis un `user_agent_summary` jamais vu pour ce compte
sur 30 jours ⇒ alerte**, jamais de suspension automatique (condition de l'avis de conformité).
Complément soumis à `expert-conformite-rgpd`, qui ne l'a pas encore instruit : la nouveauté du
**réseau** (empreinte HMAC du /24 ou du /48, conservée avec la ligne de session), qui approche
« l'opérateur inhabituel » sans géolocalisation. Motif d'acceptation : B-7 est un contrôle de
détection derrière le TOTP. À rouvrir si une source de pays est activée.

**EC-46 — retenu, durci.** `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_JWKS_URL` retirées ;
`SUPABASE_URL` et `SUPABASE_SECRET_KEY` sur `api` au J3, `SUPABASE_SECRET_KEY` sur `worker` au J6
seulement. **Une clé secrète Supabase par service** (`influx-api`, `influx-worker`), révocable
séparément ; clés héritées désactivées (J3-A a6). En-têtes sortants (`apikey`, `authorization`,
`sb-forwarded-for`) masqués dans les journaux ; aucune erreur de `fetch` journalisée avec ses
en-têtes. **À constater au J4** : la forme des en-têtes acceptée par un projet hébergé avec une clé
`sb_secret_` (la documentation indique que ces clés ne sont pas des JWT et ne se placent pas dans
`Authorization`) — recopier `SupabaseClient.ts` 2.117.2, puis constater.

**EC-47 — seuils.** Portées nouvelles d'`identity.auth_request_throttle`, **réservées avant tout
appel à GoTrue** (comme EC-3), comptant les tentatives de connexion, d'enrôlement et de code de
secours :

| Portée | Seuil | Effet |
|---|---|---|
| Couple (adresse, IP) | 5 tentatives / 15 min | Refus uniforme pour ce couple jusqu'à la fin de la fenêtre |
| IP (/32, /64) | 20 tentatives / h | Refus uniforme pour cette IP |
| IP absente ou invalide | 10 tentatives / h, toutes adresses confondues | Refus uniforme |
| Adresse | 10 échecs / h | **Aucun blocage** (A-4) ; audit `security.backoffice_login_failures`, `pino` `error` ; e-mail au J6 |
| Compte de secours | 1 échec | Même alerte (MFA-10) |
| Plateforme | 30 échecs / h | `pino` `error` ; alerte au J9 |

Une connexion réussie ne remet aucun compteur à zéro ; réponse et durée (plancher d'EC-40)
identiques quel que soit le motif, seuil compris. L'accès direct à GoTrue (G-1) échappe à ces
seuils : la parade est B-1 et le TOTP.

**EC-48 — retenu, élargi (commit 5).** Le contrôle I-4 couvre toute ligne modifiée des sections
`[auth]` et `[auth.*]` (crochets et limites compris), `[api]` (schémas exposés à PostgREST) et
`[storage*]` de `supabase/config.toml`, ainsi que le motif `auth_hooks` dans les migrations. Témoin :
un commit sans marqueur qui modifie `enable_signup` ou `[api] schemas` ⇒ CI rouge. L'extension entre
dans le commit 5 lui-même, qui s'y trouve ainsi soumis.

**B-1 — option B acceptée, avec quatre corrections.**

1. Refus dès que le suffixe figure avec un compteur **strictement positif** : avec `Add-Padding: true`,
   HIBP renvoie des lignes de remplissage à compteur `0`, qui ne valent pas une présence.
2. Refus aussi d'un mot de passe contenant la partie locale de l'adresse ou `influx` (liste de
   contexte, NIST SP 800-63B) ; au-delà de 72 octets UTF-8, **refus explicite**, jamais de troncature.
3. Ordre : règles locales, puis HIBP, puis seulement GoTrue ; aucun appel sous transaction ; échec
   fermé à 2 000 ms, sur `5xx` et sur réponse mal formée.
4. URL de HIBP constante en production ; doublure admise seulement sur un hôte de bouclage hors
   production (garde de J3-C règle 10) ; `User-Agent` propre ; aucun cookie ni identifiant de compte
   dans la requête, préfixe et résultat jamais journalisés (conditions de RG-J3-3).

*Test sans appel externe* : `platform/hibp.ts` reçoit sa fonction `fetch` en paramètre ; tests
unitaires avec un `fetch` factice ou la doublure `node:http` de `test-kit` : (a) la requête ne porte
que les cinq premiers caractères hexadécimaux, en majuscules, du SHA-1 — ni le mot de passe ni
l'empreinte entière dans l'URL, les en-têtes ou un journal (C-1) ; (b) suffixe présent à compteur
positif ⇒ refus ; (c) suffixe présent à compteur `0` ⇒ accepté ; (d) suffixe absent ⇒ accepté ;
(e) délai dépassé, `503`, corps invalide ⇒ refus « réessayez plus tard » ; (f) garde statique :
aucun autre module n'appelle l'hôte de HIBP. En plus : protection native de GoTrue sur l'offre Pro,
`minimum_password_length = 12`.

**EC-44 — accord, sous conditions.** (1) Codes `agent.break_glass_login` et
`agent.recovery_code_consumed` dans `audit.event_types` (commit 6), sujet = le compte, charge utile
sans code (au plus le nombre de codes restants) ; (2) ligne `pino` `error` à clé de message fixe,
sans adresse ni IP ; (3) test : une ligne d'audit et une ligne `error` par événement, aucun code dans
le flux capturé ; (4) J6 : e-mail `internal.critical_alert` par la file à **tous les administrateurs
actifs et au fondateur** (MFA-4, MFA-10), sous 5 min, testé ; (5) **bloquant avant la création de
tout compte interne réel et avant toute mise en ligne**.

**EC-45 — accord, sous conditions.** (1) Script du J3 : refus de toute `SUPABASE_URL` et de toute
base hors hôte de bouclage ; adresses `example.test` ; mots de passe fixes réservés au local et à la
CI. (2) Variante `staging` (J4) : refus si `INFLUX_ENV = production` ou si la référence du projet est
celle de la production. (3) Premier administrateur de production (J9) : tâche manuelle de
l'environnement GitHub `production`, **approbation du fondateur requise** ; elle crée le compte
**sans mot de passe utilisable** et déclenche l'invitation (jeton d'enrôlement de G-1, 72 h, usage
unique) ; **aucun secret dans son journal** ; refus s'il existe un compte `@example.test` ; ligne
d'audit. Le compte de secours suit le même chemin : TOTP inscrit par le fondateur sur l'appareil
hors ligne, codes imprimés et scellés (MFA-10).

**Avis sur J3-C.** Règle 2 : approuvée. Règle 4 : approuvée, avec EC-40 et G-1. Règle 8 : approuvée,
avec `SameSite=Strict` pour `__Host-influx-login` et `__Host-influx-signup` (parcours entièrement
interne au site) ; à la déconnexion, cookie effacé même si la session est inconnue. Règle 10 :
approuvée, à une condition — la doublure n'écoute que sur `127.0.0.1`, jamais `0.0.0.0` (sa page
montre des codes valides à tout le réseau local), et ne démarre que depuis les scripts de
développement et de test.

**Avis de conformité, points de sécurité.** RG-J3-4 : durées acceptées (90 jours couvrent la fenêtre
de 30 jours du signal « navigateur inconnu » ; 12 mois pour le backoffice suffisent aux enquêtes).
RG-J3-5 et RG-J3-6 : sans objection, aucun contrôle de sécurité ne lit l'adresse en clair du journal
(les compteurs portent des empreintes).

**`04` §12.10, points ouverts par D43.** (1) Périmètre d'`influx_auth` : confirmé, étendu par EC-5,
colonne par colonne, rien d'autre. (2) Purge à 24 h des utilisateurs GoTrue orphelins : confirmée
côté sécurité, par l'API d'administration et rapprochement sur `auth_user_id`. (3) Une panne de
cause (b) ne consomme pas le quota par adresse : accepté, testé en T8. (4) Empreinte HMAC-SHA-256
avec poivre en variable d'environnement : confirmée. (6) Risque résiduel de la cause (a) : confirmé,
accepté.

**Ordre des commits (J3-F) : confirmé, avec ces ajouts.**

| # | Ajout |
|---|---|
| 3 | Clés masquées : `apikey`, `authorization`, `cookie`, `set-cookie`, `sb-forwarded-for`, `enrollmentToken`, `recoveryCode` |
| 5 | EC-16 et EC-41 (points 1 à 4), EC-48 élargi, limites locales par `env()` (EC-38 point 4) |
| 6 | EC-29 (fonctions, déclencheur), EC-40 (contrainte, colonnes, motif `reauthentication_failed`), G-1 (facteur épinglé ; jeton d'enrôlement s'il entre au J3), portées d'EC-3 et d'EC-47, codes d'audit d'EC-44 et de G-1 |
| 7 | Constats de G-1 point 3 et d'EC-38 point 2 ; une clé secrète Supabase par service ; T11.1 aligné (EC-24) |
| 8 | Verrous `BREVO_MODE` et `BREVO_TEST_RECIPIENTS` sur `api` ; garde statique d'EC-19 point 3 ; mesure locale d'EC-42 |
| 10 | Plancher, épinglage, R et révocation après cinq échecs (EC-40) ; seuils d'EC-47 ; B-1 |

**Relectures préalables.** Avant le commit, marqueur I-4 : **5 et 6**, et **11** s'il ajoute un droit
ou touche le fichier d'attendus. Avant le push, ensemble : **7 à 10** (chemin d'authentification).
**Aucun push du J3 avant ma revue de fin de J3**, qui couvre aussi 1 à 4 et 12.

**Remontées au fondateur.** (1) EC-19, pour information : la restriction par IP de la clé Brevo
suppose des adresses de sortie fixes (Railway Pro, déjà ouvert par D60) ; le risque est accepté en
attendant. (2) EC-45 : être l'approbateur de l'environnement GitHub `production`. Aucun autre point
ne demande son arbitrage.

**Verdict : J3 autorisé.** Bloquant avant le **commit 10** : G-1 points 1 et 3 (constats conformes).
Bloquant avant la **création de tout compte interne réel** : G-1 point 2 et EC-44 (e-mail d'alerte).
Bloquant avant la **mise en ligne** : EC-44, B-1, EC-38 réglé sur les projets hébergés.

#### Avis de conformité du J3 — `expert-conformite-rgpd` (2026-09-27)

> **Verdict : conforme sous conditions.** Aucun point **bloquant** pour le code du J3, qui tourne en
> pile locale sur des comptes fictifs. Les conditions ci-dessous sont à lever **avant la mise en
> ligne du Lot 1** (premières données réelles), sauf échéance plus proche indiquée. Ce n'est pas un
> avis d'avocat : les points marqués « juriste » sont à faire valider par un professionnel du droit.
> La partie sécurité des mêmes points reste tranchée par `expert-cybersecurite`.

| # | Gravité | Traitement | Constat (texte applicable) | Correctif | Qui · échéance |
|---|---|---|---|---|---|
| RG-J3-1 | Important | Sécurité de l'authentification | **EC-38** : transmission de l'adresse IP à Supabase | Autorisée sous conditions : voir la ligne EC-38 (§3) — adresse de substitution pseudonyme de préférence, journal d'audit de GoTrue désactivé ou purgé à 90 jours, information, registre | `dev-react-node` (commit 7), `expert-cybersecurite`, `integrateur` (J4) |
| RG-J3-2 | À surveiller | Sécurité de l'authentification | **EC-43** : pays approximatif | Colonne nulle au MVP approuvée ; source future sous conditions et nouvel avis : voir la ligne EC-43 (§3) | `product-owner`, `expert-cybersecurite` |
| RG-J3-3 | Sans enjeu (confirmé) | Accès au backoffice | **B-1**, option B (HIBP par k-anonymat) : seuls 5 caractères hexadécimaux d'une empreinte SHA-1 sortent, partagés par des centaines d'empreintes connues ; la requête part de l'adresse d'`apps/api`, pas de celle de la personne. **Aucune donnée personnelle n'est communiquée** : HIBP n'est ni sous-traitant ni destinataire, aucun contrat, aucun transfert. Même analyse pour l'option A (GoTrue appelle HIBP) | Deux conditions : la requête ne porte **rien d'autre** que le préfixe (ni cookie, ni identifiant de compte, ni en-tête propre à la personne) ; le préfixe et le résultat ne sont **jamais journalisés** avec l'identifiant du compte. Mention au registre comme mesure de sécurité du traitement « accès au backoffice » | `dev-react-node` (commit 10) |
| RG-J3-4 | **Important** | Sessions (`identity.sessions`) | **Aucune durée de conservation** n'est fixée : la table est absente de `04` §9.1 (art. 5.1 e RGPD, limitation de la conservation) | Proposition : **session membre** supprimée **90 jours** après sa fin (révocation ou échéance) — assez pour reconnaître un navigateur déjà vu ; **session backoffice** : **12 mois** après sa fin (traçabilité des accès privilégiés ; la CNIL recommande 6 mois à 1 an pour les journaux d'accès) ; à l'anonymisation d'un compte (`04` §9.2), ses lignes de session sont supprimées. Purge par le worker avec les autres purges. `expert-cybersecurite` peut demander plus, en le justifiant | `expert-database` (ajout à `04` §9.1) · avant le Lot 1 |
| RG-J3-5 | Conforme | Sessions : navigateur résumé | `user_agent_summary` : liste fermée famille + système, jamais la chaîne brute ; lisible par le seul titulaire (politiques de `0004`) | Condition : **ni numéro de version, ni modèle d'appareil** dans la liste fermée (cela rapprocherait le résumé d'une empreinte d'appareil). Mention dans la politique de confidentialité (écran « mes sessions », alerte de nouvel appareil) | `dev-react-node` (commit 9) |
| RG-J3-6 | **Important** | Journal `leads.transactional_sends` | Pour une adresse **sans compte** (premier code d'une inscription), `recipient_email` est gardée **en clair 13 mois**, alors que l'utilisateur GoTrue orphelin de la même adresse est purgé en **24 heures** (`04` §9.1). Une adresse saisie par erreur, ou par un tiers, survivrait un an sans aucune relation (art. 5.1 c et e) | Lignes **sans compte** : adresse en clair **30 jours au plus**, puis ligne purgée ou adresse remplacée par son empreinte HMAC (forme : `expert-database`) ; lignes **avec compte** : 13 mois confirmés (valeur d'attente de `04` §9.1 acceptée). **Base légale de l'envoi du code** : mesures précontractuelles ou exécution du contrat (art. 6.1 b), **indépendante du consentement marketing (D63)** — l'envoi du code n'est jamais conditionné au consentement, et une demande de code ne crée **aucun** contact marketing dans Brevo | `expert-database` (commit 6 : la règle de purge peut attendre le Lot 1, pas la colonne) |
| RG-J3-7 | À surveiller | Cookies | Les quatre cookies de J3-C règle 8 sont **strictement nécessaires** (authentification, sécurité) : **exemptés de consentement** (art. 5.3 directive ePrivacy ; en France, art. 82 de la loi Informatique et Libertés). Le cookie de parcours porte l'adresse e-mail, signée mais non chiffrée : acceptable (navigateur de la personne elle-même, `HttpOnly`, 15 min) | Les lister dans la **politique cookies** (nom, finalité, durée), en français et en anglais | `expert-ux` + moi · Lot 1 |
| RG-J3-8 | **Important** | Accès au backoffice (personnels d'INFLUX) | Adresse professionnelle, mot de passe (haché chez GoTrue), facteur TOTP, codes de secours hachés, sessions, adresse IP, lignes d'audit (dont connexion de secours) : **traitement distinct**, qui vise des salariés ou prestataires | **Information préalable des personnels** (art. 13 RGPD ; droit du travail selon le pays de la société — en France, art. L1222-4 du Code du travail) par une note interne ; ligne au registre | `chef-de-projet` + moi · avant le premier compte interne réel (J9) |
| RG-J3-9 | À surveiller | Comptes de démonstration (`example.test`) | Domaine réservé (RFC 2606 et 6761), aucune donnée réelle, script refusé en production : conforme | Deux conditions pour la suite : aucune synchronisation Brevo ou Apollo de ces comptes (J5, J6) ; la version de CGU fictive et les consentements de ces comptes ne comptent **jamais** comme preuves (exclus des exports et des statistiques de consentement) | `dev-react-node`, `testeur` |
| RG-J3-10 | **Important** | Registre des traitements | Le J3 crée ou précise quatre traitements qui n'y figurent pas | Ajouter : (1) **authentification des membres** (e-mail, code non conservé, empreinte de session, navigateur résumé ; art. 6.1 b ; Supabase, Brevo, Railway) ; (2) **sécurité de l'authentification** (adresse IP transitoire, empreintes HMAC 30 jours, valeur transmise à Supabase, journaux Supabase ; art. 6.1 f) ; (3) **accès au backoffice** (RG-J3-8 ; art. 6.1 f et art. 32) ; (4) **journal des e-mails transactionnels** (diagnostic de délivrabilité et assistance ; art. 6.1 f ; RG-J3-6) | Moi · avant le Lot 1 |

**Points à soumettre à un juriste** : (1) Loi 25 (Québec, art. 8.1) et localisation par pays avant
toute source (EC-43) ; (2) confirmation que l'intérêt légitime de sécurité fonde aussi la
transmission d'EC-38 hors UE (LGPD art. 7 IX et art. 46 ; CCPA, usage « sécurité et intégrité » par
un prestataire de service) ; (3) note d'information des personnels (RG-J3-8), selon le pays de la
société (D25).

#### Commits 1 à 4 du J3 — appliqués le 2026-09-27

Ordre de J3-F, avec les ajouts d'`expert-cybersecurite` pour ces commits. Commits sur `main`, **non
poussés** (revue de fin de J3 avant tout push). Après le dernier commit, base reconstruite par
`supabase db reset` (Q5) : `pnpm check` vert — api 284 unitaires et 96 en base, test-kit 50, web 96,
backoffice 22, contracts 8 — puis `pnpm test:db` vert trois fois de suite (96 cas, plancher atteint).
`relay.ts` et `api-client.ts` inchangés (PP-12). Écart ouvert : **EC-49** (§3).

| Commit | Points | Choix d'implémentation à relire |
|---|---|---|
| `de85a49` | **Q2, V4, EC-35 (3)** | **Q2** : `pnpm test:db` écrit le rapport JSON de Vitest du projet `db` (`apps/api/test-results/db-report.json`, ignoré par Git) puis `apps/api/scripts/check-db-case-floors.ts` le confronte à `apps/api/db-tests/case-floors.ts` ; tout cas qui n'est ni `passed` ni `failed` (saut, `todo`), un fichier sous son plancher, un fichier sans plancher et un plancher sans fichier font échouer ; un fichier au-dessus de son plancher est signalé sans échec (à relever). Contrôle générique dans `@influx/test-kit/case-floors`, éprouvé sur des rapports témoins. Planchers de départ = effectifs de ce commit : t16 14, t2 25, t3 31, t4 26 (96, et non les 87 du J2 : 94 après la dette préalable, plus deux cas ici). **V4** : `apps/api/db-tests/temporary-rights.ts` liste les droits temporaires du bloc M2 (`EXECUTE` sur `audit.append` à `influx_admin`, `influx_auth`, `influx_worker` ; `USAGE` sur `audit` aux deux derniers), vérifiés absents par le `globalSetup` (donc avant T2.7) et au `beforeAll` du bloc M2 ; échec « exécution précédente interrompue : `supabase db reset` » ; un cas l'éprouve en accordant les droits. Le message de T4.1 renvoie aussi à la réinitialisation (attribut `BYPASSRLS` du cas S2). **À tenir à jour au commit 6** : si une migration du J3 accorde `USAGE` sur `audit` à `influx_auth` (pour `append_elevated`), la vérification V4 et la révocation du bloc M2 doivent en tenir compte. **EC-35 (3)** : pour tout rôle `influx_%`, dans `_realtime` et `extensions` : aucun droit de schéma effectif (`has_schema_privilege`, `PUBLIC` compris), aucune entrée d'ACL sur le schéma, une relation, une colonne, une fonction ou un type, aucun privilège par défaut, aucune propriété ; les deux schémas et au moins douze rôles doivent exister (pas de réussite à vide). Contre-épreuves en base, annulées : `USAGE` sur `audit` à `influx_worker` ⇒ arrêt au `globalSetup` ; `USAGE` sur `extensions` à `influx_app` ⇒ cas rouge |
| `414fa1f` | **N2 / F-1** | Les « sept vecteurs » de `testeur` ne sont écrits nulle part ; retenus : 1 `reply.serializer()`, 2 `setReplySerializer()`, 3 `setSerializerCompiler()`, 4 `reply.hijack()`, 5 `reply.raw`, 6 crochets `onSend` / `preSerialization`, 7 schéma 2xx permissif. **1 à 5** : ESLint (`no-restricted-properties`, **sur tout objet**, faute de types : `request.raw` et `String.raw` sont donc aussi refusés hors de `src/platform/` et `src/server.ts`). **Ajoutés à la liste**, parce qu'ils fuient aussi (constaté) : `setNotFoundHandler` et `addHook("onSend" \| "preSerialization")` au niveau d'un greffon, invisibles d'`onRoute`. `setErrorHandler` n'est **pas** restreint : un gestionnaire d'erreurs de greffon passe encore par le schéma d'enveloppe (constaté : `500` sans fuite). Un `setSerializerCompiler` de greffon échappe à `onRoute` (seul le compilateur déclaré sur la route y est visible) : ESLint est sa seule barrière. Contre-épreuve : chaque vecteur gardé par ESLint fuit à l'exécution (test). **6** : `onRoute` refuse un crochet de route (fonction ou liste non vide). **7** : parcours des schémas 2xx sur une **liste blanche** de types zod — refus de `any`, `unknown`, `record`, d'un `catchall` autre que `never` (`looseObject`, `passthrough`, `catchall` ; `strictObject` accepté), et aussi de `transform` (sortie calculée après validation), `custom` (`z.custom`, `z.instanceof`), `map`, `set` ; message avec le chemin (`200.items[].meta`) ; schémas `lazy` récursifs parcourus une fois |
| `0422906` | **J3-C règle 7** et ajouts, **troncature forcée** (revue de fin de J2, point (b)), **C-1**, **EC-49** | Clés ajoutées : `code`, `email_otp`, `hashed_token`, `action_link`, `qr_code`, `uri`, `totp`, `recoveryCodes`, `recoveryCode`, `enrollmentToken`, `matchingPhrase`, `apikey`, `sb-forwarded-for` (les autres existaient) ; chacune éprouvée du premier au quatrième niveau et dans un tableau. **EC-49** : le code d'une erreur s'écrit `errorCode` (`err`, `cause`). **Troncature** : tout objet journalisé est copié (plus seulement s'il contient une erreur) ; un conteneur au quatrième niveau, dont aucune clé ne serait atteinte par un chemin masqué, devient `[truncated]` ; `Map`, `Set`, `Buffer` et instance de classe deviennent `[<classe>]` (jamais leur contenu) ; une date est gardée ; `err`, `req`, `res` restent à leurs sérialiseurs. **C-1** : `@influx/test-kit/logs` — `captureLogStream()` et `valuesFoundIn(texte, valeurs)`, qui cherche chaque valeur telle quelle, échappée par JSON, encodée en pourcentage, en base64 et base64url, sans tenir compte de la casse (sauf base64), et **refuse une valeur de moins de 6 caractères** (trouvée par hasard dans une date ou un identifiant) ; `captureLogs()` des tests de l'API l'emploie |
| `b2a8851` | **A4, A5, C-3, N3**, variables de J3-E, **C-2** | **A4** : contrôle dans le crochet `onRequest`, après le secret, **pour toute méthode sauf `GET` et `HEAD`** (plus strict que `POST`, `PATCH`, `PUT`, `DELETE`) ; `403` avant tout gestionnaire, y compris sur une route inconnue ; ne lit que `sec-fetch-site` et `origin` ; aucun analyseur `formbody` (un corps `x-www-form-urlencoded` reçoit `400` sans être analysé) ; table de T8.13 en unitaire. « Au travers du passe-plat » (T8.13) est couvert par composition : test C-2 du passe-plat (les deux en-têtes arrivent intacts) + table unitaire d'`apps/api` ; le test intégré attend le J9 (T7). **A5** : `trustProxy: false` explicite ; `x-real-ip` lu après le secret, validé par zod, `::ffff:` ramené en IPv4 (forme pointée ou hexadécimale) ; seule l'empreinte HMAC-SHA-256 (étiquette `throttle-ip:`, hexadécimal) du /32 ou du /64 sort de `platform/client-address.ts`, jamais l'adresse. **Ligne `warn` d'adresse inconnue écrite à la première lecture par un consommateur** (`clientAddressOf()`, limitation de débit à partir du commit 6), **pas à chaque requête** : un appel du serveur d'un front (sonde de santé, EC-22) n'a jamais d'adresse et produirait une ligne par minute en production. ESLint interdit `request.ip` et `request.ips` dans tout `src/`. Table unitaire de T7.12 (valeurs forgées ou mal formées). **C-3** : `DELETE` avec `content-type`, `transfer-encoding` ou `content-length` non nul ⇒ `400` avant analyse ; route `GET` ou `DELETE` à corps déclaré ⇒ refus de démarrage (Fastify refusait déjà `GET`). **N3** : `CHANGE_ME` refusé quelle que soit la casse **dans `apps/api`** (secrets internes, URL de base, poivre) ; **le `config/server.ts` des fronts, épinglé (PP-12), n'est pas modifié** : il reçoit la même valeur que l'API, qui la refuse. **Configuration** : `INFLUX_PUBLIC_SITE_URL` et `INFLUX_PUBLIC_BACKOFFICE_URL` exigées, origine seule (schéma, hôte, port), normalisées comme un navigateur les sérialise, différentes l'une de l'autre, `https` en production ; `AUTH_THROTTLE_PEPPER` ≥ 32 octets, différent des secrets internes ; les trois documentées dans `apps/api/.env.example`, un test vérifie que toute variable lue au démarrage y figure (T11.4) ; `AUTH_THROTTLE_PEPPER` ajouté aux noms interdits dans le code livré au navigateur (T11.1, skill `env-secrets` CI-2). **Un `apps/api/.env.local` existant doit recevoir les deux nouvelles variables, sinon l'API refuse de démarrer.** **C-2** : test du passe-plat — `fetch` pose `sec-fetch-mode: cors`, laisse `origin` et `sec-fetch-site` intacts et n'en ajoute aucun ; tâche de CI `relay-node-24` (Node 24, **24.12 au moins exigé**) qui exécute les tests du passe-plat des deux fronts et le contrôle d'origine d'`apps/api`. **Non exécutée localement** (Node 22 sur le poste) : première exécution à surveiller. **C-4** (reformulation de `18` T7.12) laissé à `testeur` |

**À relire.** `expert-cybersecurite`, à la revue de fin de J3 : EC-49 ; A4 étendu à toute méthode
d'écriture ; ligne `warn` d'A5 à la lecture ; N3 limité à `apps/api` ; vecteurs ajoutés ou écartés
de N2 (`setNotFoundHandler` retenu, `setErrorHandler` écarté). `testeur` : les sept vecteurs retenus,
les planchers de départ, la couverture de T8.13 par composition, C-4. `integrateur` : la tâche Node 24
et sa durée.

#### Revue de sécurité des commits 1 à 4 du J3 — `expert-cybersecurite` (2026-09-27)

> **Verdict : conformes sous conditions, pas de veto.** Les commits 5 et suivants peuvent continuer ;
> trois corrections **importantes** sont exigées, chacune avant le commit qui la rend exploitable
> (tableau R). Relu : `git show` de `de85a49`, `414fa1f`, `0422906`, `b2a8851` (sources, ESLint, CI,
> tests du passe-plat), `relay.ts`, `logger.ts`, `server.ts`, `client-address.ts`,
> `write-origin.ts`. Un seul constat exécuté, en local et sans réseau : le sérialiseur d'erreurs
> (R-1). Aucun environnement distant, aucun fichier `.env*` lu.

**Points signalés par `dev-react-node`.**

| Point | Avis | Motif |
|---|---|---|
| **EC-49** (`errorCode`) | **Retenu**, avec R-1 | Voir §3, EC-49 |
| **A4 étendu à toute méthode sauf `GET` et `HEAD`** | **Retenu** (plus strict ; `03` §6.4 aligné ce jour) | Une méthode inattendue ne doit jamais être la porte non gardée. Le passe-plat n'en relaie pas d'autre (PP-3) ; `apps/api` n'a pas d'hôte public. Refus sur route inconnue avant le `404` : sans effet de divulgation |
| **Ligne `warn` d'A5 à la lecture par un consommateur** | **Retenu** | Une ligne par requête du serveur d'un front noierait le signal. Condition : l'alerte du J9 sur l'adresse inconnue compte les **refus et replis des compteurs** (commit 6), pas les lignes ; le constat de `staging` au J4 reste la preuve que l'entrée Railway pose `x-real-ip` |
| **N3 limité à `apps/api`** | **Retenu, à surveiller** | Un front dont le secret contient `change_me` ne peut pas s'accorder avec une API qui démarre (elle refuse la valeur) : tout est refusé en `401`, l'échec est fermé. Ne pas ré-épingler `config/server.ts` pour cela seul ; à reprendre s'il est modifié pour une autre raison |
| **N2 : `setNotFoundHandler` restreint** | **Retenu** | Il écrit une réponse hors du schéma d'une route |
| **N2 : `setErrorHandler` non restreint** | **Retenu, à surveiller** | Constaté : sa réponse repasse par le schéma de la route (2xx) ou par l'enveloppe (`default`), sinon `500`. Le risque résiduel est d'autorisation (un gestionnaire de greffon qui transforme un refus en `200`), pas de filtre : il relève de la revue du code du greffon |
| **N2 : `raw` refusé sur tout objet** (`request.raw`, `String.raw`) | **Retenu, voulu** | `request.raw` donne `socket.remoteAddress` et les en-têtes bruts : c'est aussi une garde d'A5. Les faux positifs (`String.raw`) sont acceptés |
| Liste des sept vecteurs | **Retenue**, avec R-2 | Les chaînes, tampons et flux sont déjà refusés par le crochet `onSend` global (TM11.4 c) |
| Commit 1 (planchers, V4, EC-35 (3)) | **Conforme** | — |

**Corrections exigées (R).** Chacune dans un commit correctif `fix(api): …`, relu à la revue de fin
de J3 avec le reste.

| # | Gravité | Surface, scénario, impact | Correctif | Échéance | Effort |
|---|---|---|---|---|---|
| **R-1** | Important | *Journaux, EC-49.* `serializeError` recopie toute chaîne `err.code` sous `errorCode`, clé non masquée. **Constaté** : `Object.assign(new Error(), { code: "654321" })` donne `"errorCode":"654321"`. Toute erreur (bibliothèque, code futur) qui porterait un code de connexion ou un jeton dans `code` le ferait sortir en clair vers Railway, lisible par quiconque accède aux journaux, pendant la validité du code (10 min) | `errorCode` (et `cause.errorCode`) écrit seulement si la valeur correspond à `^(?:[A-Za-z][A-Za-z0-9_]{1,63}\|[0-9A-Z]{5})$`, sinon `"[unrecognized]"`. Tests : `123456`, `12345678`, une valeur à espace, une à tiret ⇒ absentes **par valeur** (C-1) ; `FST_ERR_CTP_INVALID_MEDIA_TYPE`, `23505`, `P0001`, `otp_expired`, `ECONNRESET` conservés. Résiduel **à surveiller** : un code de secours sans séparateur commençant par une lettre aurait la forme d'un code ; il n'est jamais placé dans une erreur, et les tests C-1 par valeur des commits 6 et 10 le couvrent | Avant le commit 7 (premières erreurs de GoTrue) | 30 min |
| **R-2** | Important | *Filtre de sortie, N2.* `catch` figure parmi les enveloppes admises. `z.strictObject({ id }).catch(({ input }) => input)` renvoie **l'objet brut**, champs non déclarés compris, dès que la validation échoue — précisément quand un champ en trop apparaît. Même sans fonction, `.catch(valeur)` masque l'échec qui devait donner un `500` et une erreur visible | Retirer `catch` de `WRAPPER_TYPES` (refus au démarrage, avec le chemin). Test : le contre-exemple ci-dessus fuit sans la règle et bloque le démarrage avec elle | Avant le commit 9 (`GET /v1/me`, première réponse à donnée personnelle) | 15 min |
| **R-3** | Important | *Adresse du client, A5.* ESLint interdit `ip` et `ips`, mais **`request.socket.remoteAddress`** reste lisible (propriété de la requête Fastify) : l'adresse du proxy de Railway, commune à tous, deviendrait une clé de limitation — soit un plafond global que n'importe qui épuise, soit une adresse d'infrastructure prise pour celle d'un utilisateur | Ajouter `socket` aux propriétés interdites dans `src/` (y compris `src/platform/` et `server.ts`), et un `no-restricted-syntax` sur les littéraux `x-forwarded-for` et `x-real-ip` hors de `src/platform/client-address.ts`. Test ESLint comme pour `ip` | Avant le commit 6 (premier consommateur de la limitation) | 20 min |

**`05` Q14 — `user-agent` : relayé, sous conditions (décision du 2026-09-27).** Écrite aussi dans `05`
Q14 et `03` PP-5.

1. *Passe-plat* (les deux `relay.ts`, octet pour octet) : l'en-tête `user-agent` du navigateur est
   retransmis **sous le nom `client-user-agent`**, comme `client-request-id` (PP-7), seulement s'il
   correspond à `^[\x20-\x7E]{1,512}$` (ASCII visible et espace, 512 caractères au plus) ; sinon
   rien n'est transmis. **Aucune troncature, aucune analyse** dans le passe-plat (PP-12 : contrôle de
   forme seulement, comme PP-6). `user-agent` n'est pas relayé sous son propre nom : l'agent de
   `fetch` du serveur du front ne doit jamais être confondu avec celui d'un navigateur.
2. *`apps/api`* : `client-user-agent` lu **après** le secret interne, une seule valeur (tableau ⇒
   ignorée), re-validé par zod avec le même motif, puis **résumé par un module unique**
   (`src/platform/user-agent.ts`) en une **valeur d'une liste fermée** « famille + système », dont
   une valeur « non identifié » (RG-J3-5 : ni version, ni modèle d'appareil). Aucune bibliothèque
   (`ua-parser-js` écarté), **aucune expression à retour arrière** : correspondances par
   `includes` ou motifs ancrés sans quantificateur imbriqué ; test : une chaîne pathologique de
   512 caractères résumée en moins de 5 ms. Le résumé est calculé à la demande du consommateur
   (e-mail du code, création de session), comme `clientAddressOf()`.
3. *Stocké* : le résumé seul, dans `identity.sessions.user_agent_summary`. **Contrainte en base
   demandée à `expert-database`** : format de clé de la liste (`^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$`),
   pour qu'une chaîne brute ne puisse pas y entrer par erreur — dans la migration de l'écrivain des
   sessions (commit 6), sinon avant le commit 9. Rien dans `leads.transactional_sends`, rien dans
   `ops`, rien dans l'audit.
4. *Journalisé* : **ni la chaîne brute, ni le résumé.** `user-agent`, `userAgent`, `user_agent`,
   `client-user-agent` et `clientUserAgent` rejoignent les clés masquées de `logger.ts`.
5. *Transmis* : jamais à GoTrue (les appels d'`apps/api` portent un `User-Agent` fixe à elle ;
   l'avis de conformité ne couvre que l'adresse IP, EC-38) ; à Brevo, **seulement le libellé
   traduit** de la liste fermée dans `{browser}` ; « non identifié » ⇒ `contextNoBrowser` (`05`
   RG135). Une chaîne brute dans un e-mail serait du texte choisi par l'attaquant dans un message
   signé INFLUX : **bloquant** si un test le trouve.
6. *Usage* : jamais une décision d'autorisation. Le signal « nouveau navigateur » reste une
   détection, contournable en imitant un navigateur courant (**à surveiller**, `05` RG146).
7. *Tests* — passe-plat (les deux fronts) : valeur valide ⇒ `client-user-agent` égal ; 513
   caractères, tabulation, `DEL`, octet non ASCII, valeur vide ⇒ rien ; `client-user-agent` envoyé
   par le navigateur ⇒ remplacé par la valeur contrôlée ou absent ; `user-agent` reçu par l'API ≠
   celui du navigateur. `apps/api` : ignoré sans secret interne valide ; table de résumés (au moins
   Chrome, Edge, Firefox, Safari, Samsung Internet, navigateurs intégrés d'Instagram, Facebook et
   TikTok × Windows, macOS, iOS, Android, Linux, ChromeOS, et inconnu) ; aucun chiffre de version dans
   une valeur de la liste ; **C-1 par valeur** : un marqueur unique placé dans l'agent est absent des
   journaux, des lignes `identity.sessions` et `leads.transactional_sends`, et de la charge reçue par
   la doublure Brevo.
8. *Commit* : un commit dédié **avant le commit 8**, `feat: relay a checked browser user agent
   (05 Q14)` — les deux `relay.ts`, l'empreinte `RELAY_FILE_SHA256` de `@influx/test-kit` **mise à
   jour dans le même commit**, `03` PP-5 et T7, le module de résumé et ses tests. Les usages suivent
   aux commits 8 (e-mail) et 9 (session). Relu à la revue de fin de J3 avant tout push.

**Point de structure pour `architecte`** (je ne le tranche pas) : l'emplacement de la liste fermée des
résumés, écrite par `apps/api` et affichée par les deux fronts (« Mes sessions », `17b` §3.14) —
`packages/contracts` proposé. Le contenu de la liste revient à `product-owner`, sous la condition de
RG-J3-5.

#### Correctifs R-1 à R-3 et `user-agent` — 2026-09-28

`dev-react-node`. Commits sur `main`, **non poussés** (revue de fin de J3). Chacun laisse `pnpm check`
vert, migrations non commitées des commits 5 et 6 comprises : au dernier, api 364 unitaires et 221 en
base, test-kit 66, web 106, backoffice 23, contracts 12. Aucun fichier des commits 5 et 6 touché.

| Commit | Point | Choix d'implémentation à relire |
|---|---|---|
| `81a22dd` | **R-3** | `socket` **et `remoteAddress`** (sur tout objet : `request.raw.connection.remoteAddress` aussi) interdits dans tout `src/`, `src/platform/` et `server.ts` compris ; chaîne contenant `x-real-ip` ou `x-forwarded-for`, **quelle que soit la casse**, en littéral ou en gabarit, interdite dans `src/` hors de `src/platform/client-address.ts`. Tests ESLint sur un fichier de domaine, de `platform/`, `server.ts` et `config/` |
| `8603937` | **R-1** | Motif exigé appliqué à `err.errorCode` et `cause.errorCode`, sinon `"[unrecognized]"` ; un `code` non textuel n'écrit rien. Tests C-1 par valeur (`123456`, `12345678`, valeur à espace, à tiret), au premier niveau et imbriqués ; `FST_ERR_CTP_INVALID_MEDIA_TYPE`, `23505`, `P0001`, `otp_expired`, `ECONNRESET` conservés. Les `errorCode` de premier niveau de `server.ts` (codes de l'enveloppe) ne passent pas par ce filtre : valeurs fermées, écrites par nous |
| `8a395c1` | **R-2** | `catch` retiré des enveloppes admises, refus explicite avec le chemin (`200.id: a catch answers…`), `.catch(valeur)` imbriqué compris. Contre-épreuve : le contre-exemple fait sortir le champ non déclaré par le sérialiseur zod |
| `b151f1a` | **`05` Q14** | Passe-plat : points 1 et 7 de la décision, `relay.ts` identiques, empreinte mise à jour. `apps/api` : `src/platform/user-agent.ts` lit `client-user-agent` après le secret (dans le crochet `onRequest`, à côté d'A5), le garde **hors de l'objet requête** (table faible du module, comme la ligne `warn` d'A5), résumé à la demande par `userAgentSummaryOf()`. Durée : **meilleur de trois essais** sous 5 ms (une expression à retour arrière serait lente à chaque essai, une pause du lanceur à un seul). Clés masquées : les cinq de la décision **plus `userAgentSummary` et `user_agent_summary`** (le résumé n'est pas journalisé non plus). Liste fermée : **EC-54**. **Reportés à leurs consommateurs** : C-1 sur `identity.sessions` et `leads.transactional_sends`, charge de la doublure Brevo, libellé traduit et `contextNoBrowser` (commits 8 et 9) |

**À relire.** `expert-cybersecurite` : `remoteAddress` et la casse ajoutés à R-3 ; la table faible
d'`user-agent.ts` ; les deux clés masquées ajoutées. `architecte` et `product-owner` : EC-54.

#### Commits 5 et 6 du J3 — préparés le 2026-09-28 (à relire avant commit)

> **Commités le 2026-09-28 après la revue d'`expert-cybersecurite`** (sous-section suivante), non poussés : **`fb5bbe5`** (commit 5) et **`21e9fb1`** (commit 6), chacun avec `security-reviewed: 2026-09-28`. Corrections exigées, faites avant le commit : **C5-1** (contrôle I-4 : toute section `remotes.*` sensible, noms de section normalisés, `db.network_restrictions`, `db.ssl_enforcement`, `db.vault`, `edge_runtime.secrets` ; neuf commits témoins de plus, dont huit rouges sur l'ancienne version — `[auth."email"]` y était déjà reconnu), **C5-2** (variables `INFLUX_LOCAL_AUTH_*` dans `jobs.check.env`), **C6-1** (sujet `account` pour `elevated.identity.verify_code`), **C6-2** (`sessions_auth_insert` exige un facteur épinglé pour une session backoffice ; jeu de données : facteur épinglé pour les comptes internes ; un cas de plus). Messages de commit complétés en conséquence. Vérifications : `supabase db reset` puis `pnpm test:db` vert trois fois (**222 cas**, planchers atteints, t8-session 43) ; `pnpm check` vert (api 364 unitaires et 222 en base, test-kit 75, web 106, backoffice 23, contracts 12) ; **le commit 5 seul** (0001 à 0010, reste remisé) : 122 cas en base, types et lint verts ; contrôle I-4 sur `b151f1a..21e9fb1` : `security review markers: ok`. Le texte ci-dessous est l'état préparé avant la revue.

`expert-database`. **Rien n'est commité** : les deux commits portent `security-reviewed:` (I-4) et
attendent la relecture préalable d'`expert-cybersecurite`. Arbre de travail sur `main` ; base
reconstruite deux fois depuis zéro (`supabase db reset`, `0001` à `0015`) ; `pnpm test:db` vert trois
fois de suite (221 cas, planchers relevés) ; `pnpm check` vert (api 284 unitaires et 221 en base, test-kit 66, web 96, backoffice 22, contracts 8). Contre-épreuves en base,
annulées : V1 neutralisé, `agent` ↔ `admin` inversés dans `audit.append()` et garde d'irréversibilité
des sessions retirée ⇒ exactement les cas V1, V2 (`agent`, `admin`) et « session révoquée figée »
rouges ; ancienne version du contrôle I-4 ⇒ les huit cas EC-48 des commits témoins rouges.
**Écarts ouverts : EC-50 à EC-53** (§3). **EC-6, EC-7 et EC-37 tranchés** (§3, `04` §11.2 corrigé).

**Non fait, et pourquoi.** Les constats HTTP contre GoTrue (a3 : `POST /auth/v1/signup` refusé et
`admin.createUser` accepté ; EC-41 point 4 : `/otp`, `/recover`, `/resend`, `/magiclink` n'envoient
rien et, après un `/otp` refusé, le code en cours reste valable) exigent la clé secrète de la pile
locale : **son usage m'a été refusé par le contrôle des permissions de la session**. Ils sont
reportés au commit 7 (`dev-react-node`, adaptateur `platform/supabase.ts`), avec EC-50. Le commit 5
prouve le crochet en base (propriétés, droits, refus constant sous `supabase_auth_admin`) et le
fichier de réglages ; GoTrue démarre avec le crochet déclaré (constaté : conteneur sain,
`GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`, `GOTRUE_MAILER_OTP_EXP=600`, `GOTRUE_DISABLE_SIGNUP=true`).

**Commit 5**

| Fichier | Contenu |
|---|---|
| `supabase/migrations/0010_auth_hooks_refuse_native_email.sql` | Schéma `auth_hooks` sans table, privilèges par défaut de `0001` ; `auth_hooks.refuse_native_email(jsonb)` : `SQL`, `IMMUTABLE`, `SECURITY INVOKER`, `search_path` vide, **ne lit pas son argument**, rend l'erreur constante `{"error": {"http_code": 403, …}}` ; `EXECUTE` et `USAGE` à `supabase_auth_admin` seul ; contrôles de fin (aucune relation, aucun autre bénéficiaire) |
| `supabase/config.toml` | `[auth]` : `enable_signup = false`, `jwt_expiry = 300`, `minimum_password_length = 12` ; `[auth.email]` : `enable_signup = false` (**EC-50**), `otp_length = 6`, `otp_expiry = 600`, `max_frequency = "60s"`, `secure_password_change = true` ; `[auth.hook.send_email]` déclaré ; `[auth.mfa.totp]` activé ; `[auth.rate_limit]` : `sign_in_sign_ups` et `token_verifications` lus par `env()` (**EC-51**) ; commentaires INFLUX sur chaque réglage |
| `.github/workflows/ci.yml` | `INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT` et `INFLUX_LOCAL_AUTH_VERIFY_LIMIT` (`1000`) au niveau du flux : sans elles, aucune commande de la CLI ne lit la configuration (EC-51) |
| `packages/test-kit/scripts/check-security-review.ts` | **EC-48** : toute ligne ajoutée ou retirée de `supabase/config.toml` dans une section `[auth]`, `[auth.*]`, `[api]`, `[api.*]` ou `[storage*]` (y compris `[remotes.<nom>.*]`), la section d'une ligne retirée lue dans l'ancien fichier, un en-tête renommé compté ; motif `auth_hooks` ajouté pour les migrations |
| `packages/test-kit/tests/check-security-review.test.ts` | Seize commits témoins dans un dépôt Git jetable : huit changements de sections sensibles sans marqueur ⇒ rouge ; même changement avec marqueur, `[db]`, `[analytics]`, `project_id` ⇒ vert ; migration `auth_hooks` ou `grant`, fichier d'attendus ⇒ rouge ; seul le commit fautif d'une plage est cité |
| `packages/test-kit/src/rights/expected-rights.ts` | **Seul le bloc `OUR_SCHEMAS`** (`auth_hooks` ajouté) : T2.2, T2.4, T2.8 couvrent le nouveau schéma |
| `apps/api/db-tests/t8-auth-settings.test.ts` | 26 cas : lecture statique de J3-A a1 à a6 et d'EC-16 (fournisseurs externes, SMS, Web3 et tiers désactivés ; aucun SMTP ni notification native ; limites locales par `env()` seulement) ; crochet : propriétés, schéma sans relation, droits exacts, refus constant sous `supabase_auth_admin` quelle que soit la charge (marqueur et code absents de la réponse), `42501` pour `anon`, `authenticated`, `service_role` |
| `apps/api/db-tests/case-floors.ts` | **Seule la ligne** `t8-auth-settings: 26` |

Message proposé :

```
feat(db): refuse native Supabase Auth e-mails and set the auth settings

- 0010: auth_hooks.refuse_native_email(), the sink send-e-mail hook of
  GoTrue (EC-41): SECURITY INVOKER, empty search_path, never reads its
  argument, constant refusal; EXECUTE and USAGE for supabase_auth_admin only.
- supabase/config.toml: public sign-up closed, 6-digit code valid 600 s,
  TOTP enabled, password floor 12, jwt_expiry 300, max_frequency 60s,
  secure_password_change, hook declared (J3-A a1 to a6, EC-16); raised
  local rate limits read through env() only (EC-38 point 4), set in CI.
- The I-4 marker check covers the [auth*], [api*] and [storage*] sections of
  supabase/config.toml and auth_hooks in migrations (EC-48), proven on
  witness commits.
- Tests: static settings and the hook's rights and refusal (26 cases).

security-reviewed: <date>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**Commit 6**

| Fichier | Contenu |
|---|---|
| `supabase/migrations/0011_audit_elevated_and_auth_events.sql` | **V1** : `audit.append()` refuse tout autre `session_user` `influx_%` (`42501`, avant le verrou) et ajoute `db_session_user` à la charge utile d'une ligne `system` (forme canonique inchangée, pas de `hash_version` 2) ; **V6** : `audit.append_elevated(operation, subject_id)` n'accepte qu'un code `elevated.*` actif du catalogue, sujet fourni, charge `{operation}`, et **appelle** `append()` ; `audit.append_auth_event(code, account)` : liste fermée de quatre codes, charge vide (**EC-53** (3)) ; codes : cinq `elevated.identity.*` (**EC-52**), `agent.recovery_codes_generated`, `agent.recovery_code_consumed`, `agent.mfa_enrolled`, `agent.unexpected_mfa_factor`, `agent.reauthentication_failed`, `security.backoffice_login_failures` ; `influx_auth` : `USAGE` sur `audit` et `EXECUTE` sur les deux fonctions, jamais sur `append()` ; **V5** : contrôles de fin sur le propriétaire, `SECURITY DEFINER`, `search_path` vide et l'absence de `PUBLIC`, `anon`, `authenticated`, `service_role` pour les trois fonctions. *Relevé en écrivant :* une fonction créée par `influx_audit_writer` reçoit l'`EXECUTE` par défaut de `PUBLIC` (le retrait global de `0001` ne vaut que pour le rôle de migration) : révocations faites par le propriétaire, dans la fenêtre |
| `supabase/migrations/0012_identity_session_writes.sql` | **EC-29** : création par `influx_auth` (colonnes `token_hash`, `account_id`, `surface`, `mfa_method`, `user_agent_summary`), politique `WITH CHECK` sur un compte actif dont le rôle correspond à la surface ; déclencheur de création qui **calcule** instants, `aal`, échéances et première fraîcheur (EC-53 (4)) ; déclencheur d'irréversibilité (ligne révoquée figée, identité immuable, activité jamais en arrière, instant de révocation = `now()`) ; `identity.touch_session()` et `identity.revoke_own_session()` (`logout`, `revoked_by_holder`) ; **EC-40** : `mfa_verified_at`, `mfa_method`, contrainte surface ⇔ `aal` ⇔ fraîcheur, fraîcheur renouvelée seulement « maintenant, par TOTP », révocation par `influx_auth` avec `reauthentication_failed` seul (valeur ajoutée à l'énumération) ; **`05` Q14** : `user_agent_summary ~ '^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$'` ; **G-1** : `agent_profiles.mfa_factor_id` ; lectures d'`influx_auth` colonne par colonne (`accounts` : `id`, `auth_user_id`, `email`, `status` ; `account_roles` ; `agent_profiles` : actif, secours, facteur épinglé ; `sessions`) |
| `supabase/migrations/0013_identity_backoffice_mfa.sql` | **EC-17** `mfa_recovery_codes`, **G-1** `mfa_enrollment_tokens` (72 h au plus, usage unique, lié au compte), **EC-39** `totp_replay_guards` (clé par code, EC-53 (1)) ; aucun droit pour les rôles d'exécution ; déclencheur « seule la fin s'écrit, une fois » ; `enrollment_token_is_valid`, `pin_mfa_factor` (jeton consommé, facteur épinglé si aucun, lot précédent révoqué, dix empreintes, audit), `consume_recovery_code` (usage unique sous concurrence, audit du nombre restant), `accept_totp_code` (écriture conditionnelle, un seul gagnant) |
| `supabase/migrations/0014_identity_auth_request_throttle.sql` | Compteurs d'**EC-3**, **EC-21**, **EC-40** point 5 et **EC-47** (douze portées, fenêtres `15m` / `1h`, clé = HMAC de 32 octets) ; `reserve_auth_attempt` (verrou de ligne : vingt demandes parallèles ne font jamais vingt essais), `record_auth_failure`, `auth_failure_count` ; aucun droit de table pour `influx_auth` |
| `supabase/migrations/0015_leads_transactional_sends.sql` | Journal (ex-`0108`) : **EC-3** `reference` aléatoire, **EC-6** `template_ref` sans clé étrangère, **EC-7** `outbox_event_id` `bigint` sans clé étrangère et nul pour un `P0`, dates liées au statut, trois `failure_code` d'un `P0`, déclencheur d'ajout seul, **aucun index sur `status`** ; `influx_auth` : lignes `P0` d'un code `auth.*`, lecture de `id`, `reference`, `status` seulement, issue d'une ligne `queued` seulement, aucune suppression ; conservation **RG-J3-6** : ligne sans compte supprimée à 30 jours (purge au J6) |
| `packages/test-kit/src/rights/expected-rights.ts` | Le reste du fichier : lignes d'`influx_auth` sur `accounts`, `account_roles`, `agent_profiles`, `sessions`, `transactional_sends` ; quatre tables à refus total ; instantané T2.7 étendu de chaque nouveau droit, relu contre sa migration ; onze fonctions `SECURITY DEFINER` ajoutées à T4.4 |
| `packages/test-kit/src/db/dataset.ts` | Sessions créées par les seules colonnes d'`influx_auth` (dates calculées), `mfa_method` et `user_agent_summary` ; une ligne dans chaque nouvelle table (T2 règle 3) |
| `apps/api/db-tests/t2-rls-matrix.test.ts` | Un rôle élevé sans contexte agit sur le compte A de l'agent (au lieu d'un identifiant inexistant) |
| `apps/api/db-tests/temporary-rights.ts` | **V4** : `influx_auth` détient désormais `USAGE` sur `audit` : seul `influx_worker` le reçoit encore temporairement |
| `apps/api/db-tests/t3-audit-chain.test.ts` | **V2** : les quatre correspondances de rôle, sept valeurs refusées (casse comprise), `influx_worker_login` sans compte ⇒ `system` ; **V1** : `session_user` `influx_worker` (par le superutilisateur local, transaction annulée) ⇒ `42501` ; ligne du rôle de migration avec `db_session_user` (37 cas) |
| `apps/api/db-tests/t3-elevated-audit.test.ts` | EC-36 et EC-44 : code, type de sujet, charge, acteur `service` / `system`, refus des opérations inconnues, sans sujet ou d'une autre famille, liste fermée des quatre événements, aucun accès direct d'`influx_auth` au registre, chaîne vérifiée (21 cas) |
| `apps/api/db-tests/t8-session-writes.test.ts` | EC-29, EC-40, Q14 : dates calculées, colonnes non fournissables, politiques de création, contraintes, format du résumé (4 acceptés, 8 refusés), renouvellement (une fois, jamais sur la session d'autrui, `aal2` exigé), révocation par le titulaire (motifs), irréversibilité même pour le rôle de migration, fraîcheur de R et révocation par `influx_auth` (42 cas) |
| `apps/api/db-tests/t8-mfa-throttle-journal.test.ts` | G-1, EC-17 : jeton, épinglage unique, codes à usage unique, lot invalide, refus uniforme (jeton expiré, compte suspendu, mauvais jeton), lignes d'audit sans aucun code ; EC-39 : rejeu refusé (y compris le code ancien après un plus récent), un gagnant sur deux transactions concurrentes, acceptation après 120 s ; EC-3, EC-47 : cinq tentatives puis refus, **dix demandes parallèles ⇒ exactement cinq**, fenêtre relancée, échecs comptés ; D43 : ligne `P0`, contraintes, politiques, issue unique, ajout seul même pour le rôle de migration (30 cas) |
| `apps/api/db-tests/case-floors.ts` | Planchers : t3 37, t3-elevated 21, t8-session 42, t8-mfa 30 |
| `docs/mvp/04-modele-de-donnees-mvp.md` | §11.2 renuméroté (EC-37), §9.1 (sessions RG-J3-4, journal RG-J3-6, trois nouvelles tables), §5.8 renvoie à `0014` et `0015` |
| `docs/mvp/21-plan-de-developpement.md` | §3 : EC-6, EC-7, EC-37 tranchés, EC-50 à EC-53 ; cette sous-section |

Message proposé :

```
feat(db): auth journal, throttle, session writes, recovery codes, elevated audit

Migrations of J3 commit 6, numbered in application order (EC-37):
- 0011: audit.append() refuses any other influx_% session_user and keeps
  the session_user of a system line (V1); audit.append_elevated() calls
  append() and accepts elevated.* codes only (EC-36, V6);
  audit.append_auth_event() for four security events, empty payload
  (EC-44, G-1); end checks on search_path and publication (V5).
- 0012: session creation by influx_auth with every date computed in base,
  touch_session() and revoke_own_session(), irreversibility trigger (EC-29);
  second-factor freshness and surface/aal constraint (EC-40); pinned factor
  column (G-1); browser summary format (05 Q14).
- 0013: recovery codes, enrollment tokens and TOTP anti-replay behind four
  SECURITY DEFINER functions (EC-17, EC-39, G-1).
- 0014: rate-limit counters with atomic reservation (EC-3, EC-47).
- 0015: leads.transactional_sends, a journal and never a queue (D43, EC-6,
  EC-7).
Tests: V1, V2, T2 expected rights and snapshot, T3, T4 definers, and the
session, second-factor, throttle and journal cases; case floors raised.

security-reviewed: <date>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**Partage des deux fichiers communs.** `expected-rights.ts` et `case-floors.ts` portent des lignes des
deux commits : au commit 5, seuls le bloc `OUR_SCHEMAS` et la ligne `t8-auth-settings` (`git add -p`) ;
le reste au commit 6. Chaque commit laisse `pnpm check` vert à cette condition.

**À relire en priorité par `expert-cybersecurite`.**

1. **EC-52** : sujet `login_request` des deux motifs membres, et C-7 précisé (aucune ligne de
   registre pour une réservation ou un échec compté seuls) — à trancher avant le commit 8.
2. **EC-53** : `append_auth_event()` (seconde fonction étroite du registre) ; sept fonctions
   `SECURITY DEFINER` d'`influx_identity_definer` à la place de droits de table pour `influx_auth` ;
   clé de l'anti-rejeu par code. `pin_mfa_factor()` ne contrôle ni `aal` ni appelant : l'autorité est
   le jeton d'enrôlement (plus le mot de passe vérifié par `apps/api`) ; elle refuse si un facteur est
   déjà épinglé.
3. **Lectures d'`influx_auth`** : adresse et statut de **tous** les comptes, toutes les sessions
   (colonnes nommées, sans `token_hash`) — nécessaires à la connexion par adresse, mais c'est le rôle
   d'exécution le plus sensible (EC-5).
4. **Déclencheur de session** : la restriction du motif de révocation d'`influx_auth` repose sur
   `current_user` dans un déclencheur `SECURITY INVOKER` (vaut `influx_identity_definer` dans les
   deux fonctions du titulaire).
5. **EC-50** (fournisseur e-mail coupé) et **EC-51** (`env()` obligatoire) : conséquences de réglages
   exigés, constatées, non tranchées.
6. **Crochet « puits »** : refus en `403` constant, non constaté contre GoTrue (voir « Non fait »).

#### Revue de sécurité des commits 5 et 6 du J3 — `expert-cybersecurite` (2026-09-28)

> **Verdict : pas de veto. Le marqueur `security-reviewed: 2026-09-28` est accordé aux deux commits,
> après corrections** : deux pour le commit 5, deux pour le commit 6 (tableau 3). Toutes se font dans
> l'arbre de travail, avant le commit ; aucune n'exige de nouvelle migration. Le marqueur peut être
> posé dès qu'elles sont faites et que `pnpm check` est vert. Je relis leur diff à la revue de fin de
> J3, avant tout push. **Aucun point bloquant.**
> Relu : `0010` à `0015`, `supabase/config.toml`, `ci.yml`, `check-security-review.ts` et son test,
> `expected-rights.ts`, `dataset.ts`, `case-floors.ts`, `temporary-rights.ts`, t2, t3 et les quatre
> nouveaux fichiers de test. En base locale, en transaction `read only` : propriétaire, `prosecdef`,
> `proconfig` et `EXECUTE` des quatorze fonctions `SECURITY DEFINER` de nos schémas et du crochet ;
> droits colonne par colonne d'`influx_auth` et d'`influx_identity_definer` ; politiques et
> `FORCE ROW LEVEL SECURITY` des six tables touchées. Tout est conforme aux migrations.
> `pnpm --filter @influx/api test:db` : 221 cas verts, planchers atteints. Le contrôle I-4 a été
> éprouvé sur un dépôt jetable, dans le répertoire temporaire de la session : trois contournements
> constatés (C5-1). Aucun environnement distant, aucun fichier `.env*` lu, aucun appel à GoTrue.

**1. Conformité aux exigences**

| Exigence | Verdict | Constat |
|---|---|---|
| EC-16 / EC-41 : crochet et réglages (`0010`, `config.toml`) | **Conforme** | `SECURITY INVOKER`, `search_path` vide, argument jamais lu, réponse constante. ACL constatée : `USAGE` sur le schéma et `EXECUTE` pour `supabase_auth_admin` seul, en plus du propriétaire. Propriétaire : le rôle de migration. C'est acceptable pour une fonction invocatrice, puisque P7 règle 5 vise les fonctions définisseuses. Réglages a1 à a5 et EC-41 point 3 appliqués |
| V1 | **Conforme** | Le refus de tout autre `influx_%` intervient avant le verrou (`LIKE` échappé). `db_session_user` est écrit dans la charge utile, `hash_version` reste 1 |
| V2 | **Conforme** | Quatre correspondances, sept valeurs refusées, contre-épreuve d'inversion rouge |
| V5 | **Conforme** | Contrôles de fin sur le propriétaire, `SECURITY DEFINER`, `search_path`, `PUBLIC`, `anon`, `authenticated`, `service_role`, dans `0011`. Même gabarit dans `0012` à `0014` |
| V6 | **Conforme** | `append_elevated()` appelle `append()` : l'acteur n'est déduit qu'à un seul endroit |
| EC-36 | **Conforme, sauf le sujet de `verify_code`** | C6-1 (EC-52) |
| EC-29, EC-40 | **Conformes** | Dates, `aal` et première fraîcheur calculées par déclencheur. Une ligne révoquée est figée. Les colonnes d'identité sont immuables. La fraîcheur est renouvelée à « maintenant, par TOTP » seulement. Contrainte surface ⇔ `aal` ⇔ fraîcheur. Aucun droit d'écriture de table pour les rôles métier (contrôle de fin) |
| EC-17, EC-39, G-1 | **Conformes, plus stricts** (EC-53) | Aucune régénération libre, en base. Usage unique sous concurrence. Un gagnant sur deux. En revanche, G-1 point 1 n'est porté que par l'application : C6-2 |
| EC-3, EC-47 | **Conformes** | Réservation atomique (dix demandes parallèles ⇒ cinq). Clé toujours une empreinte de 32 octets. `influx_auth` ne peut remettre aucun compteur à zéro |
| D43, EC-3, EC-6, EC-7, RG-J3-6 (`0015`) | **Conformes** | Pas d'index sur `status`. `reference`, `status` et les dates ne sont pas insérables par `influx_auth`. Lignes `P0` d'un code `auth.*` seulement. L'issue ne s'écrit qu'une fois, sur une ligne `queued` |
| `05` Q14 : contrainte de `user_agent_summary` | **Conforme** | Motif exigé, immuable après création |
| V4 | **Conforme** | `influx_auth` retiré des droits temporaires, `influx_worker` y reste |
| EC-48 : contrôle I-4 étendu | **Non conforme en l'état** | C5-1 |

**2. Points signalés par `expert-database`**

1. **EC-52 et EC-53** : tranchés dans leurs lignes du §3.
2. **`pin_mfa_factor()` fondée sur le seul jeton** : **retenu**, c'est le modèle de G-1 point 2. La
   base ne peut vérifier ni le mot de passe ni le code TOTP chez GoTrue. Le jeton (au moins 128 bits,
   usage unique, 72 h, lié au compte, refus si un facteur est déjà épinglé) est la barrière qui manque
   à l'attaquant du scénario G-1 (a). *Conditions, au commit 10* :
   - (a) `p_factor_id` vient de la réponse de GoTrue à la vérification du premier code, jamais du
     corps de la requête ;
   - (b) dans une seule transaction E-2 : `accept_totp_code()` vrai, puis `pin_mfa_factor()` ;
   - (c) test : un identifiant de facteur fourni dans le corps est ignoré ; sans premier code
     vérifié, aucun épinglage par la route.
3. **Lectures d'`influx_auth`** (adresse, statut et `auth_user_id` de tous les comptes, drapeau du
   compte de secours, sessions sans `token_hash`) : **acceptées**, c'est la contrepartie inscrite
   dans EC-5. Une injection SQL sur la grappe d'authentification lirait ces colonnes pour tous les
   comptes. Mais une injection sur la grappe de l'application les atteint déjà par
   `SET LOCAL ROLE influx_admin` (revue de fin de J2, point (c)). Une fonction de recherche « une
   adresse, une ligne » déplacerait donc l'exposition sans la réduire. La vraie parade est l'absence
   de SQL dynamique sur ces grappes : `raw` est déjà refusé partout (N2), **`unsafe` de postgres.js ne
   l'est pas** (S-1).
4. **Déclencheur de session et `current_user`** : **retenu**. `current_user` vaut
   `influx_identity_definer` dans les deux fonctions du titulaire et `influx_auth` sous E-2. Il n'est
   falsifiable par aucun rôle d'exécution, car `influx_auth_login` n'est membre que d'`influx_auth`.
   Fragilité à la prochaine évolution : S-4.
5. **Crochet « puits »** : **retenu** tel quel, avec la réponse d'erreur. *Constat ajouté au
   commit 7* : réponses de `/recover` et `/otp` pour un utilisateur GoTrue existant et pour une
   adresse inconnue. Attendu, et accepté : `/recover` rend `403` pour un utilisateur existant et `200`
   pour une adresse inconnue. C'est un oracle d'existence d'**utilisateurs GoTrue**, que la clé
   *publishable* rend accessible, mais qui n'ajoute rien au `422` natif de `/otp` quand l'inscription
   est fermée. Il est accepté (S-11) et fermé au J4 par G-1 point 4. **Ne pas répondre « succès »** :
   GoTrue remplacerait alors le jeton de récupération du membre et invaliderait son code en cours à
   chaque appel, soit le déni de service qu'EC-41 point 4 veut éviter.

**3. Corrections exigées avant le commit** (marqueur accordé une fois faites)

| # | Commit | Gravité | Surface, scénario, impact | Correctif (fichiers) | Effort |
|---|---|---|---|---|---|
| **C5-1** | 5 | Important | *Contrôle I-4 (EC-48).* **Constaté** sur des commits témoins sans marqueur, tous acceptés (code de sortie 0). (a) Sous `[remotes.staging]`, une clé pointée `auth.enable_signup = true` (ou une table en ligne `auth = { … }`) : la section lue est `remotes.staging`, non reconnue. Or c'est précisément la surcharge qui part vers un projet hébergé. (b) Un en-tête entre guillemets, valide en TOML : `["storage"]`, `[auth."email"]`. (c) `[db.network_restrictions]` : adresses autorisées sur la base hébergée. Impact : un réglage de sécurité d'un projet hébergé change sans relecture ; c'est le trou qu'EC-48 devait fermer | `packages/test-kit/scripts/check-security-review.ts` : (a) **toute ligne d'une section `remotes.<nom>` ou `remotes.<nom>.*`** est sensible, en-tête compris ; (b) nom de section normalisé (guillemets simples et doubles retirés, espaces retirés) avant comparaison ; (c) ajouter `db.network_restrictions`, `db.ssl_enforcement`, `db.vault` et `edge_runtime.secrets` aux sections sensibles. `packages/test-kit/tests/check-security-review.test.ts` : un témoin rouge pour chacun des trois cas, un témoin vert (`[db] port`). Mettre à jour le commentaire d'en-tête du script | 30 min |
| **C5-2** | 5 | Important | *CI (EC-51).* `INFLUX_LOCAL_AUTH_*` sont posées au niveau du **flux**. Toute tâche ajoutée à `ci.yml` qui lancerait la CLI contre un projet hébergé (J4) hériterait de `1000` sans rien écrire | `.github/workflows/ci.yml` : déplacer les deux variables dans `jobs.check.env`, avec le même commentaire | 5 min |
| **C6-1** | 6 | Important | *Registre (EC-52).* Avec le sujet `login_request`, la ligne `elevated.identity.verify_code` ne se relie plus au compte une fois le journal purgé (13 mois) et la session purgée (90 jours). Or le registre est permanent : « quels passages par le chemin élevé ont touché ce compte ? » devient sans réponse, alors que c'est la question d'une enquête après prise de contrôle | `supabase/migrations/0011_…sql` : `('elevated.identity.verify_code', 'identity', 'account', 'sensitive')`, commentaire d'en-tête aligné ; `apps/api/db-tests/t3-elevated-audit.test.ts` : type de sujet attendu ; `docs/mvp/04` si le type y figure. `request_code` garde `login_request` | 10 min |
| **C6-2** | 6 | Important | *Sessions, G-1 point 1.* `sessions_auth_insert` accepte une session `backoffice` pour un agent actif **sans facteur épinglé**. Une erreur de logique au commit 10 (session créée avant l'épinglage, ou chemin du code de secours après une réinitialisation MFA-6) rouvrirait la fenêtre du scénario G-1 (a) sans que la base s'y oppose. Ce serait un compte du backoffice, donc toutes les identités | `supabase/migrations/0012_…sql`, politique `sessions_auth_insert`, branche backoffice : `and p.is_active is true and p.mfa_factor_id is not null`. `apps/api/db-tests/t8-session-writes.test.ts` : session backoffice par `influx_auth` pour un agent sans facteur épinglé ⇒ `42501` ; avec facteur épinglé ⇒ acceptée. Jeu de données et planchers ajustés au besoin (`dataset.ts`, `case-floors.ts`) | 20 min |

**4. À surveiller** (risques acceptés, échéance indiquée)

| # | Gravité | Point | Échéance |
|---|---|---|---|
| **S-1** | Important | Garde ESLint : `unsafe` (postgres.js) interdit dans `src/`, sauf `src/db/pool.ts` (requête constante), sur le modèle de R-3. Test ESLint | Avant le commit 8 (premier code élevé) |
| **S-2** | À surveiller | `append_elevated()` accepte tout code `elevated.*` de tout appelant autorisé. Quand `influx_worker` recevra `EXECUTE`, il pourrait écrire un motif `identity.*`. Il faudra lier la famille du motif au `session_user` (`identity.*` ⇒ `influx_auth_login` ; `leads.*`, `maintenance.*` ⇒ `influx_worker_login`), avec un test | Migration qui donne `EXECUTE` au worker (J6) |
| **S-3** | À surveiller | `append_auth_event()` ne vérifie pas que le sujet est un compte interne. Une injection sur la grappe d'`influx_auth` peut écrire de fausses alertes, mais n'en efface aucune (le registre est en ajout seul) | Accepté |
| **S-4** | À surveiller | Motifs de révocation filtrés par `current_user = 'influx_auth'` seulement. À la révocation par un tiers, passer à une table de correspondance « rôle ⇒ motifs permis », avec refus par défaut de tout autre rôle `influx_%` | J8 |
| **S-5** | À surveiller | Réinitialisation MFA-6 : révoquer le lot de codes de secours **dans la même transaction** que l'effacement de `mfa_factor_id`. Avec C6-2, un code ancien n'ouvre déjà plus de session, mais il serait consommé et journalisé | J8 |
| **S-6** | À surveiller | Sessions GoTrue ouvertes directement (G-1) : `[auth.sessions]` `timebox` et `inactivity_timeout` courts si l'offre les permet ; aucune surcharge `[remotes.*.auth*]` sans marqueur (couvert après C5-1) | J4 (`integrateur`) |
| **S-7** | À surveiller | Lignes de `totp_replay_guards` d'un compte qui ne se reconnecte plus : conservées au-delà de 120 s (empreintes HMAC, sans valeur hors poivre). Purge de toute ligne de plus de 120 s avec les autres purges | J6 |
| **S-8** | À surveiller | Portée `login_request` : sa fenêtre doit toujours dépasser la validité du code. Aujourd'hui, 15 min contre 600 s. Si `otp_expiry` augmente, réserver la portée en `1h` | Commit 9 |

**Verdict.** Commit 5 : **marqueur accordé après C5-1 et C5-2.** Commit 6 : **marqueur accordé
après C6-1 et C6-2.** Aucun point bloquant. Rappels inchangés : G-1 points 1 et 3 (constats conformes)
bloquent le commit 10 ; G-1 point 2 et EC-44 (e-mail d'alerte) bloquent la création de tout compte
interne réel ; aucun push du J3 avant ma revue de fin de J3.

#### Commit 7 du J3 et S-1 — 2026-09-28

`dev-react-node`. Commits sur `main`, **non poussés** (revue de fin de J3 ; `expert-cybersecurite`
recommande de relire 7 à 10 ensemble avant le push). Chacun laisse `pnpm check` vert. Après le
dernier : `supabase db reset`, `pnpm db:role-passwords`, puis `pnpm test:db` vert trois fois de
suite (244 cas, planchers atteints) ; `pnpm check` vert (api 449 unitaires et 244 en base,
test-kit 83, web 106, backoffice 23, contracts 12). Aucune migration, aucun fichier d'attendus
touché : pas de marqueur I-4 (contrôle `security review markers: ok` sur `9e9c07a..HEAD`).
**Écarts ouverts : EC-55 à EC-57** (§3).

**Conditions des constats.** Pile locale de la CLI 2.117.0, GoTrue **v2.196.0**, variables d'EC-51
exportées à `1000` comme en CI. Clés lues par le harnais de `@influx/test-kit` (`supabase status`,
refus de toute URL hors boucle locale, refus d'une clé autre que `sb_secret_…` et
`sb_publishable_…`), jamais d'un fichier `.env*` ; la clé secrète locale est bien une
`sb_secret_…` (**J3-E constaté**). Le contrôle des permissions ne m'a pas refusé son usage. Aucun
service externe appelé. Un envoi natif de GoTrue arriverait dans Mailpit : « aucun envoi » y est
lu. Les utilisateurs de test sont en `example.test` et supprimés en fin de fichier.

| Commit | Point | Choix d'implémentation à relire |
|---|---|---|
| `d8089ce` | **S-1** | ESLint refuse `unsafe` sur tout objet (appel, déstructuration, nom calculé) dans tout `src/`, `platform/`, `config/` et `server.ts` compris ; `src/db/pool.ts` seul le garde, pour sa requête d'identité constante, **et garde toutes les autres restrictions de `src/`** (testé). Fichier témoin `test-witnesses/s1/unsafe-outside-pool.ts.txt` (trois signalements), tests ESLint sur neuf fichiers de `src/` |
| `01d8d9d` | **Commit 7** | Voir ci-dessous |

**Commit 7 — ce qui a été écrit.**

1. **Dépendances (J3-B)** : `@supabase/auth-js` 2.117.2 et `@fastify/cookie` 11.1.2, versions
   exactes ; transitives conformes au tableau (`tslib` déjà au verrou ; `cookie` 2.0.1,
   `fastify-plugin` 6.0.0). **Garde** (`packages/test-kit/src/static/forbidden-packages.ts`) :
   `@supabase/supabase-js` et `@supabase/postgrest-js` dans aucun `package.json` (racine, `apps/*`,
   `packages/*`) **ni dans le verrou** (transitives comprises), éprouvée sur
   `test-witnesses/j3b/package.json.txt` ; `src/platform/supabase.ts` seul importeur de
   `@supabase/*` (ESLint existant, plus un test sur l'arbre réel) ; `@influx/test-kit` jamais importé
   par `apps/api/src` (le générateur TOTP compris).
2. **`src/platform/supabase.ts` (règles 1 à 3, 6, 7)** : client d'administration sans état, créé
   une fois ; **client utilisateur créé à chaque appel** (`persistSession`, `autoRefreshToken`,
   `detectSessionInUrl` à `false`, `lock` non fourni, **`skipAutoInitialize: true`** : rien ne
   tourne hors des appels de la requête) ; `fetch` borné par un `AbortSignal.timeout` **neuf à
   chaque appel**, composé avec le signal de la bibliothèque ; en-têtes `apikey` et
   `Authorization: Bearer` portant la clé secrète, **`User-Agent: influx-api` fixe** (celui du
   navigateur ne part jamais chez GoTrue, `05` Q14 point 5), `Sb-Forwarded-For` seulement si
   l'adresse est connue. Après `verifyOtp` ou `signInWithPassword`, identité lue (`id`, adresse)
   puis `admin.signOut(jeton, "local")` ; un échec donne une ligne `warn` à codes seuls. Une
   erreur de GoTrue revient comme `{ reason: rejected | unavailable, errorCode, status }`, jamais
   son message. Opérations exposées au J3 : `createUser` (sans mot de passe, adresse confirmée),
   `getUser`, `generateEmailCode` (`generateLink` `magiclink` → `email_otp`), `verifyEmailCode`,
   `verifyPassword`. Le défi et la vérification TOTP dans la même session (règle 4) viendront au
   commit 10, dans ce module.
3. **`Sb-Forwarded-For` (EC-38 point 2)** : `gotrueForwardedAddressOf()` dans
   `client-address.ts` (le seul module qui manie l'adresse) — HMAC-SHA-256 (poivre, étiquette
   `gotrue-ip:`) **de la clé de limitation d'A5**, premier octet `0xfd`, 120 bits de l'empreinte :
   même regroupement /32 et /64, stable par client, rien de l'adresse ; `null` si l'adresse est
   inconnue.
4. **Jetons courts (règle 8, EC-24)** : `src/platform/auth-tokens.ts`, signataire de
   `@fastify/cookie` (HMAC-SHA-256, clé `AUTH_TOKEN_SIGNING_SECRET`) ; **constaté dans son code** :
   comparaison par `timingSafeEqual`, avant tout décodage. Format : JSON en base64url, signé ;
   `typ`, `v = 1`, `exp` dans la valeur signée et **posés après le contenu** (le contenu ne peut pas
   les remplacer) ; schémas zod stricts par type ; au-delà de 2 048 caractères, refus sans calcul.
   Jeton de parcours : `ref` (uuid v4, EC-3), adresse, phrase ; jeton d'inscription : `verifiedAt`,
   `authUserId`, adresse, porte (`advertiser` | `creator`). Aucun code, aucun jeton GoTrue.
5. **Cookies (règle 8)** : `src/platform/auth-cookies.ts`, seul lecteur et écrivain (ESLint :
   `cookies`, `cookie`, `setCookie`, `clearCookie`, `parseCookie`, `signCookie`, `unsignCookie`
   interdits ailleurs dans `src/`) ; quatre noms, chacun lié à une surface ; `SameSite=Lax` pour la
   session membre, `Strict` pour les trois autres (arbitrage de J3-C) ; `Secure`, `HttpOnly`,
   `Path=/`, sans `Domain` ; écrire le cookie de l'autre surface lève une erreur (`500`, rien
   posé). `@fastify/cookie` est enregistré **sans secret et sans analyse automatique**
   (`hook: false`) : l'en-tête `Cookie` n'est analysé qu'à la demande, après le secret interne
   (surface rangée dans `request.surface`). **ESLint refuse aussi toute lecture d'un en-tête
   `authorization` dans `src/`** (G-1 point 3, règle 3) ; l'en-tête sortant de `supabase.ts` est une
   clé d'objet, non concernée.
6. **Configuration (J3-E)** : `SUPABASE_URL` (origine seule, `https` sauf hôte de bouclage, et
   `https` en production), `SUPABASE_SECRET_KEY` (**préfixe `sb_secret_` exigé** : la clé
   `service_role` héritée est refusée au démarrage), `AUTH_TOKEN_SIGNING_SECRET` (≥ 32 octets,
   `CHANGE_ME` refusé, différent du poivre et des deux secrets internes). `.env.example` précisé.
   T11.1 : `AUTH_TOKEN_SIGNING_SECRET` et le **préfixe de valeur `sb_secret_`** ajoutés aux noms
   interdits dans les artefacts des fronts ; `SESSION_COOKIE_SECRET` gardé (un retour de l'ancien
   nom resterait détecté). **Un `apps/api/.env.local` existant doit recevoir les trois variables**,
   sinon l'API refuse de démarrer.
7. **`@influx/test-kit`** : `localAuthStack()` / `requireLocalAuth()` (GoTrue et Mailpit, jamais
   sautés : message qui dit quoi lancer), compteurs Mailpit, générateur TOTP RFC 6238
   (`@influx/test-kit/totp`, vecteurs des RFC 4226 et 6238).
8. **CI** : `supabase start` lance désormais **GoTrue, Kong et Mailpit** avec la base (retirés de
   `-x`) : les constats tournent en CI comme en local. **Non exécuté en CI** : première exécution à
   surveiller (durée, démarrage de Kong sans les autres services).

**Constats en pile locale** (`apps/api/db-tests/t8-gotrue-findings.test.ts`, 22 cas ; un constat
divergent y est **affirmé tel que constaté**, avec son numéro d'écart : quand le réglage ou la
décision change, le fichier change avec).

| # | Attendu (décision) | Constaté | Verdict |
|---|---|---|---|
| a1, b1 | Code à 6 chiffres, aucun envoi, pas de fenêtre de 60 s pour `generateLink` | Deux `generateLink` de suite : deux codes de 6 chiffres, Mailpit vide | **Conforme** |
| a2 | Code refusé après 10 min (constat manuel unique) | Deux codes générés ensemble : le premier **accepté à 540 s**, le second **refusé à 611 s** (`403 otp_expired`) — script hors dépôt, non automatisé | **Conforme** (à refaire sur `staging`) |
| a3 | `POST /signup` refusé ; `admin.createUser` accepté | `422 signup_disabled` ; création acceptée | **Conforme** |
| b7 | Adresse connue ⇒ `422 email_exists` | Idem, par l'adaptateur | **Conforme** |
| `jwt_expiry` | `300` accepté par GoTrue | Jeton d'accès : `exp − iat = 300`, `ES256` | **Conforme** |
| a4, EC-41 (4) | `/otp`, `/magiclink`, `/recover`, `/resend` pour un utilisateur existant : aucun envoi ; après un `/otp` refusé, le code en cours reste accepté | Refusés (`422`, `422`, `400`, `400`, tous `email_provider_disabled`), Mailpit vide, code en cours accepté | **Conforme sur le résultat**, mais le refus vient du **fournisseur e-mail coupé** (EC-50), pas du crochet : **EC-55** |
| Crochet « puits » | Refus constant, charge jamais recopiée | Atteint par un changement d'adresse (`PUT /user`) : `403`, message constant `Native e-mails are disabled.`, adresse inchangée, aucune adresse en attente, Mailpit vide | **Conforme** |
| Oracle `/recover` | `403` pour un utilisateur existant, `200` pour une adresse inconnue (accepté, S-11) | Fournisseur coupé : **`400` identiques** (pas d'oracle) ; mais **`/otp`** distingue : `422 email_provider_disabled` (existant) contre `422 otp_disabled` (inconnue) | **Divergent de la forme attendue**, à cause d'EC-50 : **EC-55** ; l'oracle par `/otp` était déjà admis (« n'ajoute rien au `422` natif de `/otp` ») |
| **EC-50** | `signInWithPassword` et `verifyOtp` fonctionnent avec `[auth.email] enable_signup = false` | `verifyOtp` **fonctionne** ; `signInWithPassword` **refusé** (`422 email_provider_disabled`) ; `/otp` avec `create_user: true` ne crée personne | **Divergent** : **EC-55** — commit marqué séparé, **non écrit** |
| b3, b5 | Vérification de type `email`, une seule fois | Acceptée, puis `403 otp_expired` au second usage | **Conforme** |
| b4 | Un nouveau code invalide le précédent | Ancien code : `403 otp_expired` ; nouveau accepté | **Conforme** |
| b6 | GoTrue ne compte pas les échecs | Six codes faux, puis le bon accepté | **Conforme** (la borne d'EC-3 est bien à notre charge) |
| Règle 2 | Aucune ligne `auth.sessions` après un parcours de l'adaptateur | 0 ligne | **Conforme** |
| Règle 1 | Deux vérifications concurrentes ne se croisent pas | Chacune rend son utilisateur ; 0 session restante | **Conforme** |
| a5, c1 | Inscription, défi, vérification ⇒ `aal2` ; `id`, `qr_code`, `secret`, `uri` | Conforme ; `qr_code` est **du SVG brut** (`<?xml …><svg …`), pas une URL `data:` | **Conforme** (règle 5 : SVG rendu comme texte) |
| c4 | Anti-rejeu non garanti | Même code accepté avec un nouveau défi | **Conforme** : EC-39 est nécessaire |
| c6 | Une nouvelle inscription supprime les facteurs non vérifiés du même type | **Non** : le facteur non vérifié reste ; une inscription de même nom convivial est refusée (`422 mfa_factor_name_conflict`), un autre nom en crée un second | **Divergent** : **EC-56** (conséquence au commit 10) |
| d | 72 octets UTF-8 au plus (limite de hachage) ; `minimum_password_length = 12` plancher de GoTrue | 72 octets acceptés ; **73 octets ⇒ `500 unexpected_failure`** ; la **création** par l'administration **accepte 11 caractères** (sa modification et `PUT /user` refusent, `422 weak_password` : sonde, non affirmé en test) | **Divergent** (plancher et plafond) : **EC-57** |
| **G-1 point 3** | TOTP vérifié, session `aal1` directe : `PUT /user` (mot de passe, adresse) et `mfa.enroll` refusés | `401 insufficient_aal`, `401 insufficient_aal`, `403 insufficient_aal` | **Conforme** — ne bloque pas le commit 10 |
| G-1 point 3 (membre) | Changement d'adresse sans effet (crochet) | Voir « Crochet » : adresse inchangée | **Conforme** |
| G-1 point 3 (`apps/api`) | Jeton GoTrue en `Authorization` ou en cookie `sb-*` ⇒ `401` | `401` sans secret interne sur `/v1/status`, `/v1/me`, `/v1/bo/me` ; aucun module ne lit `authorization` (ESLint) ni un cookie hors de nos quatre noms (test) | **Conforme au J3.** Le `401` d'une route protégée **avec** secret interne sera éprouvé au commit 9, première route qui exige une session |
| G-1 (c), observation | — | Une session directe d'un **membre sans TOTP** peut poser un **mot de passe GoTrue** (`PUT /user` : `200`) ; fournisseur coupé, ce mot de passe n'ouvre rien (`/token` : `422`) | **À relire** : EC-55, condition ajoutée à la bascule |
| **EC-38 point 2** | Acceptation du pseudonyme `fd00::/8` par GoTrue, en local si l'option y est activable | L'option **n'est pas activable en local** : la CLI 2.117 ne la connaît que comme champ de l'API de gestion (`security_sb_forwarded_for_enabled`), aucun `GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED` dans le conteneur. L'en-tête est **accepté sans erreur et sans effet** : `auth.sessions.ip` garde l'adresse de la passerelle | **Non constatable en local**, reporté au **J4 sur `staging`**, comme la décision le prévoit (repli : adresse réelle, IPv6 tronquée à /64) |
| RG-J3-1, condition (3) | Tables du schéma `auth` qui gardent une adresse après chaque parcours | Parcours code (adaptateur) : `sessions` vide (règle 2), `flow_state` vide ; `audit_log_entries` : lignes de l'utilisateur, **adresse renseignée pour les actions de facteur**, vide pour `login` ; `mfa_challenges` : adresse gardée (exigée par J3-A c5). En local, l'adresse est celle de la passerelle Docker ; hébergée, ce sera celle d'`apps/api` ou le pseudonyme d'EC-38 | **Pour `expert-conformite-rgpd`** (report au `04` §9.1) et `expert-database` (purge à 90 jours d'EC-38 point 3, à étendre à `mfa_challenges` ?) |

**Expérience hors commit (EC-55).** Pour instruire la bascule d'EC-50 sans l'écrire, la pile locale
a été relancée **une fois** avec `[auth.email] enable_signup = true` (fichier restauré puis pile
relancée, `git diff` vide ; rien de commité). Constaté : `POST /signup` toujours `422
signup_disabled` ; `/otp` avec `create_user: true` pour une adresse inconnue ⇒ `422`, **aucun
utilisateur créé** ; connexion par mot de passe ⇒ `200` ; pour un utilisateur existant, `/otp`,
`/magiclink`, `/recover` ⇒ **`403` constant du crochet** (`Native e-mails are disabled.`) et
`/resend` d'un non-confirmé ⇒ `403` ; `/recover` d'une adresse inconnue ⇒ `200` (**l'oracle
attendu**) ; après un `/otp` refusé par le crochet, **le code en cours reste accepté** ; dans la
minute qui suit un `generateLink`, `/otp` est d'abord refusé par `max_frequency` (`429`) ; Mailpit
vide de bout en bout. Les deux constats en pile locale des trois conditions d'EC-50 sont donc
**verts** dans cette configuration ; la troisième relève du J4.

**À relire.**

- `expert-cybersecurite` : **EC-55** (bascule d'EC-50, et l'observation « mot de passe GoTrue posé
  par un membre ») ; **EC-56** et **EC-57** avant le commit 10 ; `User-Agent: influx-api` ;
  `skipAutoInitialize` ; deux instances d'administration (délais de 2 000 et 1 000 ms, règle 6) au
  lieu d'une ; `createUser` avec adresse confirmée (J3-A b2 : même branche de GoTrue ensuite) ; le
  refus de démarrage sur toute clé autre que `sb_secret_` ; les restrictions ESLint des cookies et
  d'`authorization` ; `sb_secret_` dans T11.1.
- `architecte` : l'ajout de GoTrue, Kong et Mailpit au `supabase start` de la CI (budget de
  10 min) ; la place du générateur TOTP dans `@influx/test-kit/totp`.
- `integrateur` : première exécution de la CI avec GoTrue ; au J4, EC-38 point 2 sur `staging`.
- `testeur` : le fichier de constats et ses 22 cas (plancher `22`), le constat manuel a2.
- `expert-conformite-rgpd` et `expert-database` : dernière ligne du tableau des constats.

#### Arbitrages après le commit 7 — `expert-cybersecurite` (2026-09-28)

> **Verdict : pas de veto.** `d8089ce` (S-1) : **conforme**. `01d8d9d` (commit 7) : **conforme, une
> correction avant le commit 10** (C7-1). EC-50, EC-55, EC-56 et EC-57 tranchés ci-dessous et dans
> leurs lignes du §3. Relu : les deux diffs (`supabase.ts`, `auth-cookies.ts`, `auth-tokens.ts`,
> `client-address.ts`, `config/schema.ts`, `server.ts`, `eslint.config.mjs`, `ci.yml`,
> `artifacts.ts`), `supabase/config.toml` et les classes d'erreur d'`@supabase/auth-js` 2.117.2
> installé. Aucun appel à GoTrue, aucune écriture en base, aucun fichier `.env*` lu.

**1. EC-50 / EC-55 : bascule à `true` retenue.** Il n'existe pas d'autre moyen de vérifier un mot de
passe du backoffice chez GoTrue ; l'expérience locale montre que l'inscription reste fermée. Commit
**marqué** (I-4) `chore(supabase): enable the e-mail provider, sign-up stays closed`, **avant le
commit 9** (au plus tard avant le 10, tests du 9 relancés). Contenu exact, rien d'autre :
- `config.toml` : `[auth.email] enable_signup = true`, commentaire INFLUX (« fournisseur Email,
  inscription fermée par `[auth] enable_signup` ») ; `[auth] enable_signup = false` inchangé.
- `t8-auth-settings` : affirme **les deux** valeurs (`[auth]` à `false`, `[auth.email]` à `true`),
  plus `[auth.sms] enable_signup`, connexions anonymes et liaison manuelle à `false`.
- `t8-gotrue-findings`, cas passés aux valeurs de l'expérience, tous verts : (a) `POST /signup` ⇒
  `422 signup_disabled`, aucun utilisateur ; (b) `/otp` `create_user: true`, adresse inconnue ⇒
  refus, aucun utilisateur ; (c) `/otp`, `/magiclink`, `/recover`, `/resend` d'un existant ⇒ `403`
  constant du crochet, Mailpit vide, **code en cours toujours accepté** ; (d) oracle `/recover`
  `403`/`200` affirmé tel que constaté (S-11) ; (e) `verifyPassword` par l'adaptateur ⇒ succès et
  **0 ligne** `auth.sessions` (règle 2) ; (f) G-1 (c) : mot de passe posé par une session directe
  de membre, puis `/token` ⇒ `200`, affirmé tel que constaté ; (g) point 4 ci-dessous.
- **Marqueur `security-reviewed: 2026-09-28` accordé d'avance à ce diff.** Un constat divergent de
  (a) à (e) me revient avant le commit. La condition J4 d'EC-50 (`integrateur`) reste inchangée.

**2. EC-55, observation (à surveiller, `03` S-11 élargi — report dans `03` à ma revue de fin de J3).**
*Scénario* : avec la référence du projet et la clé *publishable* (jamais distribuée par INFLUX,
EC-46), un tiers qui a deviné le code d'un membre (G-1) pose un mot de passe GoTrue et rouvre des
sessions GoTrue sans nouveau code. *Impact* : aucune session INFLUX (J3-C règle 3), aucune table
atteignable (`REVOKE` sur `anon` et `authenticated`), adresse inchangeable (crochet) ; reste un
accès GoTrue durable et des facteurs inscrits sur un compte membre. *Parades* : **commit 10** —
toute identité rendue par `verifyPassword` qui n'est pas un compte interne actif ⇒ refus uniforme,
même corps, même statut, même plancher qu'un mauvais mot de passe (test : membre à mot de passe
GoTrue posé directement) ; `verifyPassword` appelé depuis `/v1/bo/auth/*` seulement (test) ; la
base refuse déjà la session (C6-2). **J4** : G-1 point 4 ; si la clé *publishable* ne peut pas être
désactivée, le point devient **Important** et revient à moi (détection des `user_updated_password`
de comptes membres par une fonction étroite, J6). **V2** (clause de caducité de D37) : tout facteur
préexistant d'un membre est supprimé avant l'activation de son second facteur, épinglage (G-1
point 1) étendu aux membres.

**3. EC-56 : retenu, durci (commit 10).** Première requête de l'enrôlement, dans cet ordre :
contrôles de débit (EC-47), mot de passe, **jeton d'enrôlement** (G-1 point 2) — **aucun appel à
`admin.mfa.listFactors` avant** ; puis tout facteur TOTP vérifié ⇒ refus uniforme,
`agent.unexpected_mfa_factor`, rien de supprimé ; puis suppression de **tous** les facteurs TOTP non
vérifiés (un échec ⇒ refus « réessayez », rien d'inscrit) ; inscription sous un nom constant. À la
seconde requête, l'identifiant du facteur vient de `admin.mfa.listFactors` (exactement un facteur TOTP
non vérifié, sinon refus), **jamais du corps**. Tests : deux premières requêtes ⇒ un facteur non
vérifié ; onze ⇒ aucun refus de plafond ; jeton faux ⇒ aucun appel à `listFactors` ; facteur vérifié
préexistant ⇒ refus, audit, facteur intact ; identifiant fourni dans le corps ignoré.

**4. EC-57 : retenu, durci.** (a) **Commit 10** : règles locales de B-1 avant tout appel, **et garde
doublée dans `platform/supabase.ts`** : `verifyPassword`, et toute opération future qui pose un mot
de passe, refusent sans appel un mot de passe de moins de 12 caractères ou de plus de 72 octets UTF-8
(`rejected`, code local, `status` nul). Motif : le `500` de GoTrue est classé `unavailable` (cause
(b)) — des mots de passe de 73 octets feraient passer la connexion du backoffice pour une panne de
GoTrue (alertes D60, réponse distincte du refus uniforme). Tests : 73 octets et 11 caractères ⇒
aucun appel (`fetch` factice). (b) **Commit 11** : le script ne pose que des mots de passe de 12
caractères à 72 octets, vérifié par un test. (c) **Commit marqué d'EC-55**, constat (g) : `/token` avec
73 octets pour un compte **à mot de passe** et pour une adresse inconnue. Si les réponses diffèrent,
c'est un oracle des comptes internes (seuls porteurs d'un mot de passe) : affirmé tel que constaté,
à surveiller sous S-11 et fermé au J4 par G-1 point 4.

**5. Correction C7-1 (Important, avant le commit 10, 10 min).** `failureOf()` classe `rejected`
seulement un `AuthApiError` ; or `AuthWeakPasswordError` (`422 weak_password`) est un
`CustomAuthError` : un refus de GoTrue serait lu comme une panne dès qu'une opération pose un mot de
passe (commit 10, J8), avec les effets du point 4. Correctif : `rejected` = toute `AuthError` de
statut 400 à 499, quelle que soit sa classe ; sinon `unavailable`. Tests
(`supabase-adapter.test.ts`) : `422 weak_password` ⇒ `rejected` ; `500` et délai dépassé ⇒
`unavailable`.

**6. Points soumis à relecture (commit 7) : conformes.** `User-Agent: influx-api` fixe ;
`skipAutoInitialize` (présent dans 2.117.2) ; deux instances d'administration aux délais distincts ;
`createUser` à adresse confirmée ; refus de toute clé autre que `sb_secret_` ; ESLint des cookies et
d'`authorization` (déstructuration et accès littéral couverts) ; `sb_secret_` dans T11.1 ; jetons
signés (`timingSafeEqual` avant décodage, `typ`/`v`/`exp` posés après le contenu) ; quatre cookies
`__Host-` liés à leur surface. *À surveiller* : un `signOut` en échec laisse une ligne
`auth.sessions` dont le jeton n'a jamais quitté la mémoire d'`apps/api` — inexploitable, purgée à
90 jours (EC-38 point 3).

**Bloquant avant le commit 10** : commit marqué d'EC-55 (constats (a) à (e) verts), C7-1, EC-56 et
EC-57 (a) dans le commit 10 lui-même. Rappels inchangés : G-1 point 2 et EC-44 avant tout compte
interne réel ; aucun push du J3 avant ma revue de fin de J3 (commits 7 à 10 ensemble).

#### Plan initial du J3 (2026-09-25)

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
10. **Contrôle d'origine des écritures (A4, `03` §6.4)**, avant tout gestionnaire et après
    l'identification de la surface : `POST`, `PATCH`, `PUT`, `DELETE` ⇒ `403` sauf
    `sec-fetch-site: same-origin`, ou en-tête absent et `origin` égal à l'origine publique de la
    surface identifiée (`INFLUX_PUBLIC_SITE_URL` pour `web`, `INFLUX_PUBLIC_BACKOFFICE_URL` pour
    `backoffice`, J1-F). **Aucun analyseur `formbody`** dans Fastify.
11. **Adresse du client (A5, EC-21 tranché, `03` PP-6 et §6.4)** : `trustProxy: false`,
    `request.ip` jamais lu ; `x-real-ip` lu après `identifySurface`, validé par zod (IPv4 ou IPv6),
    `::ffff:` ramené en IPv4 ; clé de limitation /32 en IPv4, /64 en IPv6, en empreinte
    HMAC-SHA-256 avec `AUTH_THROTTLE_PEPPER` ; **jamais d'adresse en clair** dans `ops` ni `pino` ;
    adresse absente ou invalide : compteur par adresse e-mail, compteur global « adresse inconnue »
    à plafond strict, ligne `warn` (l'alerte de production vient avec les alertes du J9). Partie
    passe-plat (`clientAddress()`) : J1-J.

**Tests** : T8 (un seul code valide, expiration, cinq tentatives, plafonds par adresse et par IP,
blocage de l'attaquant et non de la victime, chemin d'exécution identique pour une adresse connue
et inconnue — assertion déterministe, `18` C-2 —, session révoquée à la suspension, route
backoffice sans `aal2` ⇒ `403`) ; lead-pipeline T1 (le code n'écrit rien dans `outbox_events`) et
T10 (aucun réessai automatique) ; code absent de tout journal, trace, réponse et cookie ; **A4** :
écriture avec `sec-fetch-site: cross-site` ou `same-site`, ou sans l'en-tête avec un `origin`
étranger à la surface ⇒ `403`, et un corps `application/x-www-form-urlencoded` n'est jamais analysé ;
**A5** : `x-real-ip` absent, invalide ou `::ffff:` traité comme prévu, clés /32 et /64, aucune
adresse en clair dans le flux de journal capturé, `x-real-ip` ignoré sans secret interne valide.
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
5. **En-têtes de sécurité exigés avant l'exposition de `staging` (R7, revue de sécurité de fin de
   J1)**, sur `web` et `backoffice` : `X-Content-Type-Options: nosniff` ; `X-Frame-Options: DENY`
   et `frame-ancestors 'none'` ; `Referrer-Policy` (`strict-origin-when-cross-origin` pour `web`,
   `no-referrer` pour le backoffice) ; `Strict-Transport-Security` — valeurs de `03` §6.5, `preload`
   seulement après confirmation d'`integrateur` une fois les domaines arrêtés. La **CSP à nonce**
   reste au J9 (point 2).
6. **Constat de l'adresse du client (A5, EC-21)** : depuis l'extérieur, requêtes vers `staging`
   avec `X-Real-IP` et `X-Forwarded-For` forgés ; l'adresse retenue par `apps/api` doit être celle
   de la connexion réelle, jamais la valeur forgée. Aucune adresse n'étant journalisée en clair, le
   constat se fait par le comportement — *proposition de l'architecte, méthode à fixer par
   `integrateur` et `expert-cybersecurite`* : une série de demandes portant chacune une valeur forgée
   différente doit déclencher le plafond par IP comme si elles venaient d'une seule adresse.
   **Constat à refaire à chaque changement de l'entrée** ; un CDN placé devant Railway change la
   source de l'adresse (§6, « Domaines et DNS »). Dans le même passage : une écriture réelle depuis
   un navigateur sur `staging` est acceptée (les en-têtes `sec-fetch-site` et `origin` traversent
   l'entrée Railway et le passe-plat, A4).

**Terminé quand** : un commit sur `main` passe la CI, migre `staging` puis y est déployé ; les
quatre comptes de démonstration se connectent sur `staging` ; les en-têtes de R7 sont présents et
le constat A5 est consigné **avant** toute ouverture de `staging` au-delà de l'équipe.

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

Préfixes : `/v1/…` pour les membres et le public, `/v1/bo/…` pour le backoffice *(validés par
`architecte` le 2026-09-25 et liés à la surface appelante par le secret interne de chaque front —
§4, J1-G)*. Chaque route déclare un schéma de requête **et** de réponse
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
2. **En-têtes et CSP** par surface (`03` §6.5, T10) — les en-têtes de base sont posés dès le J4
   (R7), le J9 ajoute la CSP à nonce et le jeu complet ; passe-plat complet (T7) ; erreurs sans détail
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
- [ ] **Placer ou non un CDN devant Railway** : la décision est à inscrire avec celle des DNS. Un
      CDN change la source de l'adresse du client (`03` PP-6, A5) : il impose de revoir
      `clientAddress()` et de refaire le constat du J4 avant sa mise en service.

---

## 7. Après le Lot 1 : la feuille de route

Chaque lot commence par la même séquence : décisions obtenues, spécification relue, migrations et
matrice des droits, tests de droits, puis écrans.

| Lot | Décisions à obtenir avant de coder | Première étape technique | Tests qui portent le lot |
|---|---|---|---|
| **2 — Profils, réseaux, badge** | D34, D61 (`07` Q15 et Q16), D24 instruite, `03` R-4 et R-5 | Migrations `0201` à `0207` : trois objets créateur, compartiments Storage privés ; création de `packages/domain` et `packages/ui` | **T1** (anonymisation sur la charge brute), T9, T14, TM5, TM11 |
| **3 — Campagnes, recherche anonymisée** | D38, facettes de `10` | Migrations `0301` à `0306` ; domaine `search` avec k-anonymat, pagination plafonnée, journal | T1 rejoué, T15, TM12 ; mesure manuelle des 30 secondes |
| **4 — Mise en relation, messagerie à trois** | D30, apartés (`04` §5.7.1 A2), conditions mobiles de D58 | Migrations `0401` à `0406` ; `reveal_identity()` et affaire créée à la révélation | **T18**, T5, T19, TM2, TM3, corpus de détection |
| **5 — Backoffice, pipeline, e-mails** *(mode serré)* | D35, D36, `03` R-7 | Migrations `0501` à `0503` ; interrupteur d'urgence ; traitement unitaire et exports (`00` §9) | TM4, TM6, TM8, TM9 |
| **6 — Recette, audit, ouverture** *(livraison mode serré fin oct.)* | Levée des deux vetos ; test d'intrusion (F-9) | Parcours de bout en bout en douze étapes (`18` §7) | Toutes les familles ; restauration répétée |
| **6bis — Rattrapage du mode normal** *(obligatoire sitôt le mode serré livré)* | Aucune (déjà spécifié dans `10`, `12`, `15`) | Reprise intégrale des 4 écarts entre mode normal et mode serré (`00` §9) : (1) recherche à facettes de campagnes côté créateur, (2) alertes automatiques de coordonnées dans la messagerie, (3) actions de masse au backoffice, (4) tableau de bord complet | Tests des facettes créateur, corpus de détection automatique, actions en lot (2V), indicateurs du tableau de bord |

---

## 8. Risques de réalisation

| Risque | Signal | Parade |
|---|---|---|
| **La pile Supabase locale est lourde sous Windows** | Démarrage lent, mémoire saturée | Moteur WSL 2, 8 Go alloués ; en dernier recours, tests de base en CI seulement — jamais de tests de droits supprimés |
| **Le comportement de GoTrue diffère de ce que suppose `02` §18.7** (code obtenu sans envoi, invalidation du code précédent, durée) | Test J3 rouge | Le constater au J3, pas au J9 ; repli documenté par D37 (« si l'on se trompe ») |
| **Drizzle en version pré-1.0** | Rupture à une montée de version | Version exacte, couche `repository.ts` par domaine (`02` §5) |
| **L'exécution sans construction de `apps/api` bute sur un cas** (paquet de l'espace de travail non résolu, syntaxe non effaçable) | Démarrage en erreur au J1 | Script `esbuild` d'une demi-journée (§4, J1-B, option C), sans toucher au code applicatif |
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
| J1 | **Ce document §4, « J1 — décisions de l'architecte »** ; `02` §2, §4, §8, §9, §12, §13, §15 ; `03` §6.4 (passe-plat) et §7 ; `docs/landing-page/01-architecture.md` §11 |
| J2 | `04` §1 à §4, §5.1, §11 ; `03` §1 à §4 et §8 (T2, T3, T4, T6, T16) ; skill `supabase-schema` |
| J3 | `02` §7 et §18 (en entier) ; `03` §6.1, §6.2, §6.3, §6.9 ; `05` §F et §G ; `04` §5.8 (`transactional_sends`, `auth_request_throttle`) |
| J4 | `02` §11, §12, §19, §20 ; skills `railway-deploy`, `env-secrets` |
| J5 | `05` §A à §E, §H, §L, additif D54/D55 ; `17` §2.5, §2.6, §3 ; skill `design-system-influx` |
| J6 | `02` §6 et §11 ; `05` §I ; `16` §H, §J, §M ; skills `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` ; `18` TM1 et T17 |
| J7 | `05` §F (RG54 à RG58), §J ; `16` §I et §M6 ; `17` §6 |
| J8 | `05` §K ; `15` §C, §F ; `17b` §3.11 et §3.13 ; skill `backoffice-ops` ; `03` §1.3 |
| J9 | `02` §13 et §20 ; `03` §6.5 ; `18` §5 et §10 « Lot 1 » |


---

## Détail du J3 (archivé le 2026-10-05)


#### État des commits du J3 (feuille de route J3-F)

| # | Commit | Contenu | État |
|---|---|---|---|
| **1 à 4** | `de85a49` → `b151f1a` | Plancher Q2, V4 ; filtre de sortie non contournable (N2) ; masquage des secrets d'auth et C-1 ; contrôle d'origine A4, adresse client A5 (`x-real-ip`), `DELETE` sans corps (C-3), relais `user-agent` | ✅ **Terminé & revu** (`fc311a5`) |
| **5** | `fb5bbe5`, `623083b` | Migration `0010` (`auth_hooks.refuse_native_email`), réglages `supabase/config.toml` (code 6 chiffres, 600 s, TOTP, inscription publique fermée, fournisseur e-mail actif EC-55), contrôle I-4 étendu | ✅ **Terminé & signé** (`2026-09-28`) |
| **6** | `21e9fb1` | Migrations `0011` à `0015` : `audit.append_elevated` / `append_auth_event`, écritures de session (`touch_session`, `revoke_own_session`, fraîcheur R, facteur épinglé `mfa_factor_id`), `mfa_recovery_codes`, `mfa_enrollment_tokens`, `totp_replay_guards`, `auth_request_throttle`, `leads.transactional_sends` | ✅ **Terminé & signé** (`2026-09-28`) |
| **7** | `d8089ce`, `01d8d9d`, `eddf8c8` | Garde `unsafe` (S-1) ; adaptateur `platform/supabase.ts` (`@supabase/auth-js` 2.117.2, `Sb-Forwarded-For` pseudonyme `fd00::/8`, `signOut` immédiat, C7-1) ; `auth-tokens.ts` & `auth-cookies.ts` (`@fastify/cookie` 11.1.2) ; constats GoTrue en pile locale | ✅ **Terminé & revu** (`828add4`) |
| **8** | `64efcae` | `POST /v1/auth/request-code` (`02` §18.10 à la lettre, connecteur Brevo unitaire, disjoncteur, plancher 1 000 ms, E-1 `identity.request_code`, doublure Brevo locale, T4.7 élevé) | ✅ **Terminé** |
| **9** | `feat(api): verify a login code and open a member session` | `POST /v1/auth/verify-code` (EC-3 : 5 tentatives réservées avant GoTrue, régénération sans envoi au 5e échec ; EC-4 : jeton d'inscription `__Host-influx-signup` ; routage RG66 à RG69), **E-2** (`identity.verify_code`), session membre `__Host-influx-session`, renouvellement paresseux (1 h), `POST /v1/auth/logout`, `GET /v1/me` minimal ; tests T8 | ✅ **Terminé** (`6223b10`) |
| **10** | `feat(api): backoffice sign-in with mandatory TOTP` | `/v1/bo/auth/login` (mot de passe + TOTP ou code de secours en 1 requête → session `aal2` directe, cookie `__Host-influx-ops-session`), `/v1/bo/auth/enroll` (en 2 requêtes avec mot de passe + jeton d'enrôlement G-1, nettoyage des facteurs non vérifiés EC-56, épinglage `pin_mfa_factor` et 10 codes de secours affichés une fois), `/v1/bo/auth/reauthenticate` (R : mot de passe + TOTP, fraîcheur ≤ 5 min, jamais par code de secours), `/v1/bo/auth/logout`, `GET /v1/bo/me` ; garde `aal2` (`403` sur toute route `/v1/bo/*` sans `aal2`) ; anti-rejeu TOTP 120 s (`accept_totp_code`, EC-39) ; règles mot de passe 12 car. / 72 octets + k-anonymat HIBP (B-1, EC-57) ; refus uniforme si identité GoTrue non interne (EC-55) ; plancher de durée constant (1 500 ms) | ✅ **Terminé** (`111a048`) — garde `aal2` globale (`preHandler`) hors liste fermée `BACKOFFICE_SESSIONLESS_ROUTES` ; QR SVG ≈ 280 Ko (borne 512 Kio) ; HIBP écrit et testé, branché au J8 |
| **11** | `chore: demo accounts seed` | Script TypeScript lancé après `supabase db reset` (local et CI, refusé hors hôte de bouclage et en production) : crée les 4 comptes de démonstration (`advertiser`, `creator`, `agent`, `admin`) sur `example.test` (mots de passe 12–72 octets, EC-57), version de CGU fictive, et jetons d'enrôlement TOTP fixes pour les 2 comptes internes (EC-45) | ✅ **Terminé** (`60486ed`) — `pnpm db:demo-accounts` (aussi en CI), lien d'activation `/activation#<jeton>` (fragment, jamais envoyé au serveur) |
| **12** | `feat(web,backoffice): minimal sign-in screens and empty homes` | `apps/web` : écran minimal de connexion membre (adresse, code à 6 chiffres, phrase de correspondance) et accueil vide. `apps/backoffice` : connexion en une fois, activation du TOTP en 3 étapes (QR code SVG par URL `blob:`, secret, URI, 10 codes de secours affichés une fois avec `Cache-Control: no-store`) et accueil vide (`17b` §3.14) | ✅ **Terminé** (`533f683`) — seul module navigateur à appeler le réseau : `src/browser/relay-client.ts` (même origine `/api/v1/`, identique dans les deux fronts, SHA-256 épinglé) ; pages du backoffice `no-store` ; 4 comptes de démo constatés à travers les deux passe-plats |

**Terminé quand** : les quatre comptes de démonstration se connectent en local dans leur espace (les membres avec le code reçu par la doublure Brevo, les comptes internes avec mot de passe et TOTP inscrit à la première connexion), `pnpm check` et la triple exécution de `pnpm test:db` sont verts, et la revue groupée de fin de J3 (`expert-cybersecurite` + `testeur`) est validée.

#### Revue de sécurité groupée de fin de J3 — 2026-10-05

> `expert-cybersecurite`. Relu : `64efcae`, `6223b10`, `111a048`, `60486ed`, `533f683`, `9722ddd`, et le chemin 7 à 10 de bout en bout. Contrôle I-4 (`check-security-review.ts`) sur `b151f1a..HEAD` et `origin/main..HEAD` : **vert** — aucun de ces commits ne touche migration, droits attendus ou `config.toml` ; les trois commits qui l'exigent (`fb5bbe5`, `21e9fb1`, `623083b`) portent le marqueur. **Aucun message à reformuler.** Base en lecture seule, aucun `.env` local lu, aucun environnement distant.
>
> **Conformes** : EC-3 (réservation avant GoTrue, régénération au 5e échec, 20 requêtes parallèles ⇒ ≤ 5 essais), EC-4 (émission), EC-39, EC-40 (plancher 1 500 ms, issue unique, R jamais par code de secours), EC-47 (connexion et enrôlement), EC-55, EC-56, EC-57, G-1 points 1 et 2, C7-1, EC-44 (audit + `error`). Garde `aal2` en `preHandler` global avec liste fermée de 4 routes sans session (test). Exception `relay-client.ts` : **acceptée** (même origine, chemin sans point, `redirect: "error"`, réponse lue par schéma, empreinte épinglée). Jeton d'activation dans le fragment puis retiré : conforme. QR en `blob:` dans un `<img>` : aucun script exécuté ; borne de 512 Kio acceptée.

| # | Gravité | Constat (scénario) | Correctif | Échéance · effort |
|---|---|---|---|---|
| J3S-1 | Important | **R sans réservation préalable** : les échecs ne sont comptés qu'après GoTrue ; avec un cookie de session volé, N requêtes R parallèles dépassent les 5 essais avant la révocation (EC-40 point 5). Sans effet aujourd'hui : aucune action ne lit encore R | Réserver la tentative (`backoffice_reauth_session`, 5 / 15 min, plus la portée IP d'EC-47) dans la transaction qui lit la session, **avant** GoTrue ; test « 20 R parallèles ⇒ ≤ 5 appels GoTrue » | Avant la 1re action B-5 (J8) · 30 min |
| J3S-2 | Important | **Comptes de démo sur `staging` (J4 « Terminé quand »)** : mots de passe et jetons d'enrôlement fixes, dans le dépôt ; sur un hôte joignable, quiconque lit le dépôt inscrit **son** TOTP sur l'admin de démo avant l'équipe | Variante `staging` d'EC-45 (2) : mot de passe et jeton **tirés au hasard à chaque exécution**, affichés une fois, jamais les valeurs fixes ; refus si `INFLUX_ENV = production` ; script actuel inchangé (bouclage seul) | J4 · 1 h |
| J3S-3 | À surveiller | Facteur vérifié chez GoTrue mais non épinglé si la base tombe entre `challengeAndVerify` et `pin_mfa_factor` : échec **fermé** (enrôlement refusé, `agent.unexpected_mfa_factor`), compte bloqué | Jusqu'à MFA-6 (J8) : suppression du facteur par un administrateur, procédure écrite au J4 ; l'alerte peut être un faux positif | J4 (procédure) |
| J3S-4 | À surveiller | `hasFreshReauthentication` sans appelant, et dans une transaction distincte de l'action | Au J8 : fraîcheur vérifiée **dans la transaction de l'action** (fonction ou politique lisant `mfa_verified_at`) ; test « action B-5 sans R ⇒ refus » | J8 |
| J3S-5 | À surveiller | HIBP écrit, non branché : aucun mot de passe n'est choisi par une route avant J8 | L'invitation et le changement de mot de passe appellent `newPasswordVerdict` avant GoTrue ; test | J8 (bloquant avant mise en ligne, inchangé) |
| J3S-6 | À surveiller | Bandeau `?secours=N` : simple indication, falsifiable par un lien (faux avertissement) ; la règle reste serveur (R refusée) | Dériver le bandeau de `GET /v1/bo/me` (`mfaMethod`, codes restants) | J8 · 20 min |
| J3S-7 | À surveiller | Aucune CSP encore ; le `blob:` SVG ouvert dans un onglet hérite de l'origine du backoffice | CSP du J9 : `img-src 'self' blob:` sur le backoffice seulement, rien d'autre en `blob:` | J9 |
| J3S-8 | À surveiller | Code membre ciblé : 10 codes/h × 5 essais ⇒ ≈ 3,6 % en 30 jours, au prix de ≈ 7 200 e-mails reçus par la victime (RG44) | Alerte D60 : ≥ 25 échecs / 24 h sur une même adresse ⇒ `security.member_code_targeted`, jamais de blocage (A-4) | J9 |
| J3S-9 | À surveiller | I-4 ne couvre ni l'ensemble signé P (`elevated-operations.ts`) ni `relay-client.ts` et les fichiers du passe-plat : l'empreinte force un geste conscient, pas ma relecture | Ajouter ces chemins au contrôle I-4 | J4 · 15 min |

**Verdict : push autorisé.** Aucun point bloquant, aucune correction exigée avant le push. J3S-1 et J3S-2 : tickets ouverts, à fermer avant leur échéance (J8 et J4). Rappels inchangés : G-1 point 4 au J4 ; EC-44 (e-mail d'alerte, J6) et G-1 point 2 par l'invitation (J8) avant tout compte interne réel ; B-1 branché et EC-38 réglé sur les projets hébergés avant la mise en ligne.

#### Vérification de fin de J3 par `testeur` — 2026-10-05

> Relu : `64efcae`, `6223b10`, `111a048`, `60486ed`, `533f683`. Conformité à `18` (T8 complet,
> T4.7, lead-pipeline T1/T10, C-1) vérifiée par lecture ; exécutions reproduites sur la pile locale.

| # | Gravité | Constat | Correction demandée |
|---|---|---|---|
| **T-1** | **Bloquant** | **L'ordre de la CI casse `pnpm check` de façon déterministe (pas une instabilité).** `.github/workflows/ci.yml` (ajouté par `60486ed`) exécute `pnpm db:demo-accounts` **avant** `pnpm check`. `db:demo-accounts` crée la version `terms_of_service`/`fr` (et `en`) « courante » en premier. `loadDataSet()` (`packages/test-kit/src/db/dataset.ts:134-141`), utilisée par 7 des 13 fichiers `db-tests` (t2-rls-matrix, t3-audit-chain, t3-elevated-audit, t4-roles, t16-commission, t8-mfa-throttle-journal, t8-session-writes), insère sa propre version `fr` à **id fixe** `TERMS_VERSION_ID` avec un `on conflict do nothing` **sans cible** : il tombe silencieusement sur l'index partiel `terms_versions_current_idx` déjà occupé par la version du seed démo, donc **la ligne à id fixe n'est jamais créée**. L'insertion suivante dans `terms_acceptances` référence cet id inexistant ⇒ `unknown terms version, or not in force` (`0005_identity_terms_and_consent.sql:254`), et les 7 fichiers échouent en bloc dès leur `beforeAll`. Reproduit 3/3 à l'identique (run complet, puis `t4-roles.test.ts` isolé) avec exactement la séquence de la CI ; **jamais vérifié par une vraie exécution GitHub Actions, rien n'étant poussé**. Les commits 8 à 12 eux-mêmes sont sains : à l'ordre inverse (`test:db` avant `db:demo-accounts`), tout passe, 3 fois de suite, 296/296, et `db:demo-accounts` réussit ensuite sans conflit (il détecte la version courante et la réutilise, lui) | Déplacer l'étape « Create the demonstration accounts » **après** l'étape « Format, typecheck, lint, test…, build » dans `.github/workflows/ci.yml` (une ligne) ; non appliqué ici (lecture seule) |
| **T-2** | Signalé, non bloquant pour J3 | `pnpm check` échoue dès `format:check` (fichiers non formatés de `design-proposals/`, travail du fondateur) : si poussé en l'état, le job CI `check` est rouge **avant même d'atteindre typecheck/lint/test/build**, indépendamment de T-1. Non touché (hors mandat) | À régler par le fondateur/`chef-de-projet` avant tout push sur `main`, séparément du J3 |

**Exécutions.** `supabase db reset` : ok. `pnpm db:role-passwords` puis `pnpm --filter @influx/api test:db -- --reporter=dot` **3 fois de suite, sans reset entre les runs** : **296/296 vert les 3 fois**, déterministe (durées 90–96 s). `pnpm typecheck` : vert (5 paquets). `pnpm lint` : vert, 0 avertissement. `pnpm test -- --reporter=dot` (unitaire + base) : vert, 296/296 + unitaires. `pnpm build` : vert (`apps/web`, `apps/backoffice`). `pnpm format:check` : rouge, uniquement `design-proposals/*` (T-2). Aucun appel externe réel observé (doublure Brevo locale, GoTrue local uniquement).

**Contre-épreuves (2, toutes deux révertées par `git checkout --` et diff vérifié vide après coup) :**
1. Garde `aal2` globale de `server.ts` forcée à ne jamais s'appliquer (`&& false`) → le test T8.8 (« 401 sur `/v1/bo/forgotten-guard` ») devient rouge comme attendu.
2. `isWriteOriginAllowed` forcée à toujours `true` → 14 cas de `request-guards.test.ts` (T8.13) deviennent rouges comme attendu.

**Couverture `18` revue par lecture** : T8.1 à T8.8, T8.10 à T8.13 couverts (T8.9 hors périmètre J3, prévu J7 — correct) ; T4.7 couvert sur le pool normal **et** sur le pool élevé (EC-35 point 6, commit 8) ; lead-pipeline T1 et T10 couverts nommément dans `t8-request-code.test.ts`, renforcés par la contrainte base `check (priority <> 'p0' or outbox_event_id is null)` (`0015`) ; C-1 (lecture des journaux par valeur, `valuesFoundIn`/`watch`) présent dans les trois fichiers d'authentification ; planchers de `case-floors.ts` vérifiés mécaniquement à chaque run (« floor of executed database cases met »).

**Verdict « prêt à livrer » : NON, un point bloquant.** T-1 doit être corrigé (une ligne dans `ci.yml`) et revérifié avant tout push sur `main` : en l'état, la CI GitHub serait rouge au premier push de ce jalon, ce qui contredirait le « `pnpm check` vert en CI » exigé par la définition de « terminé » (§2.3). Le code des commits 8 à 12 lui-même est conforme à `18` et à la définition de « terminé » une fois la bonne séquence suivie (296/296, 3 fois de suite, déterministe). T-2 reste un point séparé, non lié à J3, à régler avant tout push.

---

