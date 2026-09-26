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
| Auth et Storage | `@supabase/supabase-js`, importé **uniquement** dans `apps/api/src/platform/supabase.ts`, au J3 | D5, règle 2 |
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
| **EC-3** | **Cinq tentatives par code** (`05` RG42, A-2) sans support : `identity.auth_request_throttle` ne connaît que les portées `email` et `ip` | Portée supplémentaire `login_request`, dont la clé est l'identifiant de la ligne `leads.transactional_sends` porté par le cookie de parcours. Au cinquième échec, régénérer un code **sans l'envoyer** pour invalider le précédent — comportement GoTrue à vérifier | `expert-cybersecurite` | J3 |
| **EC-4** | **L'état « code vérifié, compte non créé »** (`05` RG5) n'a pas d'objet | Jeton d'inscription signé (cookie `__Host-`, `httpOnly`, 30 min) portant `auth_user_id`, adresse et porte. Le compte n'existe qu'à la validation de l'écran 3. Le brouillon de l'écran 3 reste en mémoire : le stockage navigateur est interdit par ESLint (`02` §13.2) | `expert-cybersecurite` | J3 |
| **EC-5** | **Opérations de pré-authentification non nommées.** `03` P7 définit E-2 comme « vérification du code, création du compte au premier passage », or le compte naît à l'écran 3 ; le canal de secours (`05` RG65) et la connexion du backoffice écrivent aussi sans session | Rattacher explicitement la finalisation de l'inscription et la connexion du backoffice à **E-2**, le canal de secours à **E-1** (même rôle `influx_auth`), par une révision signée de `03` P7 plutôt que par une nouvelle opération | `expert-cybersecurite` (liste fermée signée) | J3, J5 |
| **EC-6** | `leads.transactional_sends.template_ref` référence `backoffice.email_templates`, table du **Lot 5**, alors que le journal naît au Lot 1 (migration `0108`) | Colonne texte sans clé étrangère jusqu'à `0503` ; codes de modèles en union fermée dans `packages/contracts` (`16` RG85) | `expert-database` | J3 |
| **EC-7** | `transactional_sends.outbox_event_id` est un `uuid` qui référence `outbox_events(id)`, un `bigint` | Type `bigint` | `expert-database` | J3 |
| **EC-8** | **Clés de `leads.sync_settings`** (`04` §5.8) incomplètes et contradictoires avec `05` : pas de liste de pays bloqués à l'inscription (RG8) ; `apollo_blocked_countries` est une liste de **blocage** alors que RG84 exige une liste d'**autorisation**, vide par défaut | Clés : `apollo_scope`, `apollo_legal_basis` (valeur par défaut `consentement_requis`, surcharge par pays), `apollo_prospecting_countries` (autorisation, **vide**), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, et les identifiants de listes et de modèles Brevo | `expert-database` + `expert-integrations-api` | J5, J6 |
| **EC-9** | **Calendrier de réessais** : 6 tentatives dans `02` §6, 10 dans `05` RG79 (et `attempts <= 10` dans `04`) | Valeur de départ de `retry_schedule` = `05` RG79 | `architecte` | J6 |
| **EC-10** | **Événements émis à l'inscription** : `05` RG73 prévoit `consent.granted` « à l'inscription » en plus de `lead.created` ; `18` §10 attend « quatre lignes de file » | À l'inscription, `lead.created` seul : trois lignes (`brevo_contact`, `apollo_contact`, `brevo_transactional` pour la bienvenue) — le consommateur relit le consentement (RG37) ; `consent.granted` et `consent.revoked` pour les changements ultérieurs. Corriger `18` en conséquence | `product-owner` + `testeur` | J5 |
| **EC-11** | **D54 et D55 non modélisées** : ni table des invitations, ni colonnes de source d'acquisition (`04` §12.11, points 9 et 10) ; le mapping Brevo `16` §M4 n'a pas les attributs UTM exigés par `05` RG122 | Colonnes figées sur `identity.accounts` (J5), table des invitations (J8), attributs `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `REFERRER_DOMAIN`, `HEARD_FROM` ajoutés à `16` §M4 | `expert-database` + `expert-conformite-rgpd` (veto) | J5, J8 |
| **EC-12** | **Aucun chemin pour le webhook Brevo.** `apps/api` n'a pas d'hôte public (`02` §12) ; le passe-plat ne relaie qu'une liste blanche d'en-têtes (PP-5) qui exclut l'en-tête du jeton (`16` RG146) ; la table qui stocke l'événement brut avant traitement (RG147) n'existe pas | Chemin borné `/api/v1/webhooks/brevo/<jeton>` relayé par le passe-plat de `apps/web`, avec l'en-tête du jeton ajouté à la liste blanche **pour ce seul chemin** ; contrôle des plages d'adresses IP dans `apps/api` sur l'adresse relayée `x-real-ip` (PP-6, A5 ; *corrigé le 2026-09-25 : jamais `x-forwarded-for`*) ; table d'événements entrants en ajout seul, consommée par le worker | `architecte` + `expert-cybersecurite` (veto) | J7 — *conflit signalé le 2026-09-25 (revue de fin de J1)* : le contrôle d'origine A4 (`03` §6.4) **refuserait ce `POST` de serveur à serveur**, sans `origin` ni `sec-fetch-site` ; une exception nommée et fermée est à trancher par `expert-cybersecurite` avant le J7. Le jeton de chemin s'écrit dans `[A-Za-z0-9_-]` (PP-2, R1) |
| **EC-13** | Le Lot 0 promet « un compte de démonstration par rôle se connecte réellement dans les trois espaces » (`00` §7), mais `02` §13.3 et `18` §10 interdisent de lever une garde de `apps/web` au Lot 0 — or la connexion membre passe par le passe-plat, donc par la levée de G5 | Lever G5 au J1, **dans le commit qui introduit le passe-plat et sa garde de liste blanche** (la règle « une garde ne tombe qu'avec son remplaçant » est tenue). G1, G2, G4 et G6 attendent le J9 | `architecte` + `testeur` | J1 — **tranché par `architecte` le 2026-09-25, élargi** (§4, J1-C) : la garde annexe « aucune API réseau » est scindée dans le même commit. `02` §13.3 corrigé. **Couverture confirmée par `testeur` le 2026-09-25** (commit 9ef4b0a ; G1, G2, G4, G6 toujours actives, aucune perte à l'extraction) |
| **EC-14** | « Mes données » (export, suppression) figure dans l'espace du Lot 1 (`05` RG57, RG71), mais l'exécution des demandes RGPD est au Lot 5 (E-5, `backoffice.data_subject_requests`) | Au Lot 1 : dépôt de la demande depuis l'espace membre, accusé de réception, exécution manuelle par un administrateur selon une procédure écrite ; table avancée au Lot 1 si nécessaire | `chef-de-projet` + `expert-conformite-rgpd` (veto) | J7 |
| **EC-15** | `02` §7 et `04` §13 renvoient à `AccountForm.tsx`, qui n'existe plus sur `main` ; le formulaire en trois étapes de la landing ne correspond pas au parcours réel ; les boutons pointent vers `/signup`, `/login`, `/signup/advertiser`, `/signup/creator` alors que `17` §2.6 fixe des chemins localisés | Écrans écrits d'après `17` §3. Chemins des portes à fixer (par exemple `/fr/inscription/marque` · `/en/signup/brand`) ; « Me connecter » ouvre l'écran 1 précédé du choix de porte ; la section formulaire de la landing devient un renvoi vers les deux portes (tests `TM10` adaptés) | `expert-ux` + `product-owner` | J5, J9 |
| **EC-16** | Les points d'accès publics de Supabase Auth restent joignables avec la clé *publishable*, qui n'est pas un secret : inscription publique, envoi natif d'un code par GoTrue | Désactiver l'inscription publique (l'API d'administration reste utilisable), ne configurer aucun envoi d'e-mail natif de GoTrue, et **vérifier par un test** qu'aucun envoi ni aucune création d'utilisateur n'est déclenchable sans `apps/api` | `expert-cybersecurite` | J3 |
| **EC-17** | **Codes de secours du second facteur** (MFA-3) : à vérifier si Supabase Auth les fournit | S'ils n'existent pas nativement : table dédiée, codes hachés, usage unique, génération journalisée, consommation alertée (MFA-4) | `expert-cybersecurite` + `expert-database` | J3 |
| **EC-18** | **Variables absentes de `.env.example`** : secret interne du passe-plat (`x-influx-internal`, PP-8), poivre des empreintes de débit (`04` §12.10, point 4), destinataires de secours des alertes de disponibilité (D60) ; aucun `.env.example` pour `apps/web` et `apps/backoffice` (`INFLUX_API_INTERNAL_URL`) | Les ajouter, avec valeurs factices, dans le commit qui les utilise | `integrateur` + `expert-cybersecurite` | J1, J3 — **noms et fichiers arrêtés par `architecte` le 2026-09-25** (§4, J1-F) ; reste la confirmation `integrateur` + `expert-cybersecurite` |
| **EC-19** | **Porteurs des variables Brevo.** `02` §12.3 réserve `BREVO_API_KEY` au worker, alors que `apps/api` envoie lui-même le code de connexion (D43, `02` §18.10) et les alertes de disponibilité (D60, `02` §20.5), et reçoit le webhook (EC-12) ; `apps/api/.env.example` n'indique aucun service pour les variables Brevo | `api` : `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN`, `BREVO_IP_ALLOWLIST`. `worker` : les cinq premières, plus `BREVO_SENDER_MARKETING`, `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID`. Corriger `02` §12.3, la skill `env-secrets` et `.env.example` | `integrateur` + `expert-cybersecurite` (clé Brevo sur le service HTTP) | J3 |
| **EC-20** | **Une variable pour deux rôles de connexion.** Si EC-1 retient un rôle de connexion élevé par service, `ELEVATED_DATABASE_URL` prend deux valeurs différentes (`api`, `worker`) : impossible dans le seul `apps/api/.env.local` où tournent les deux processus, et une valeur posée sur le mauvais service Railway ne se voit pas | Deux noms qui disent le rôle : `AUTH_DATABASE_URL` (`api`, rôle de connexion membre d'`influx_auth` seul) et `WORKER_DATABASE_URL` (`worker`) ; `ELEVATED_DATABASE_URL` disparaît | `expert-cybersecurite` + `expert-database` (avec EC-1), `integrateur` | J2 — **Tranché par `expert-cybersecurite` le 2026-09-26** : proposition retenue. **`api`** : `DATABASE_URL` (`influx_app`) et `AUTH_DATABASE_URL` (`influx_auth_login`), plus `OPS_DATABASE_URL` au J4. **`worker`** : `WORKER_DATABASE_URL` (`influx_worker_login`) **seule** — ni `DATABASE_URL` ni `AUTH_DATABASE_URL` —, plus `PRIVACY_DATABASE_URL` au Lot 5. `DIRECT_DATABASE_URL` : CI seule (CI-5), inchangée. **`ELEVATED_DATABASE_URL` disparaît** partout (`02` §12.3, J1-D, J2 point 4, T4.6, skill `env-secrets`). Refus de démarrage : l'utilisateur de chaque URL (avant le `.` du multiplexeur) doit être **exactement** le rôle attendu ; deux URL d'un même processus ne partagent jamais le même utilisateur ; à l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont vérifiés en base ; sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent), la présence d'une variable de base réservée à un autre service fait échouer le démarrage. **`apps/api/.env.example`**, dans le commit du J2 qui les lit : trois lignes `DATABASE_URL=postgresql://influx_app.your-project-ref:CHANGE_ME@HOST:6543/postgres`, `AUTH_DATABASE_URL=postgresql://influx_auth_login.your-project-ref:CHANGE_ME@HOST:6543/postgres`, `WORKER_DATABASE_URL=postgresql://influx_worker_login.your-project-ref:CHANGE_ME@HOST:6543/postgres`, chacune commentée avec son rôle, ses appartenances, ses opérations et son **seul** service ; un commentaire rappelle le format `<rôle>.<référence du projet>`, le port 6543 (mode transaction), TLS obligatoire, et qu'en pile locale la connexion est directe, sans suffixe |
| **EC-21** | **PP-6 : d'où vient l'adresse IP du client ?** Un gestionnaire de route Next.js n'a pas accès à la connexion (la propriété `ip` de la requête a disparu en Next.js 15) : l'adresse ne peut venir que d'un en-tête posé par l'entrée de Railway, dont on ignore s'il écrase une valeur fournie par le client. La limitation de débit par IP (T8, T15) en dépend | Une fonction unique `clientAddress()` dans `src/server/relay.ts`, qui lit l'en-tête documenté par Railway (l'entrée ajoutée par Railway, jamais celle du client) ; `apps/api` ne lit l'adresse relayée qu'après validation du secret interne ; **constat sur `staging` au J4** avec un en-tête forgé | `expert-cybersecurite` + `integrateur` | J3 (usage), J4 (constat) — **tranché par `expert-cybersecurite` le 2026-09-25** (revue de fin de J1, A5 ; `03` PP-6 et §6.4) : source unique **`x-real-ip`** écrit par l'entrée Railway, **jamais `x-forwarded-for`** ; `clientAddress()` ne garde que la forme `^[0-9A-Fa-f:.]{2,45}$` et retransmet sous `x-real-ip` ; `apps/api` en `trustProxy: false`, `request.ip` jamais lu, `x-real-ip` lu après `identifySurface`, validé par zod, `::ffff:` ramené en IPv4, clé /32 ou /64 en empreinte HMAC-SHA-256 (`AUTH_THROTTLE_PEPPER`), jamais en clair dans `ops` ni `pino` ; adresse absente ou invalide : compteur par e-mail + compteur global à plafond strict + `warn`, alerte en production ; constat J4 refait à chaque changement d'entrée (un CDN change la source) |
| **EC-22** | **La route de santé publique de `apps/web`** (D60, `02` §20.10) n'entre pas dans la liste blanche de G5 (`02` §13.1 : « le seul fichier de route autorisé »), et le `proxy.ts` de next-intl la redirigerait vers `/fr/…` | Liste blanche à deux entrées : `src/app/health/route.ts`, réponse `200` ou `503` **à corps vide**, fondée sur `GET /v1/status` par le client d'API, mêmes contraintes de contenu que le passe-plat, exclue du `matcher` du proxy | `architecte` + `expert-cybersecurite` (`02` §20.12) | J9 (sonde) |
| **EC-23** | **La skill `env-secrets` indique « Local : `.env` »** (§ Ajouter une variable, étape 4), alors que D62 impose `apps/api/.env.local` (le `.env` est chargé par la maquette) ; elle ne dit rien des fichiers des fronts ni du fichier `staging` | Étape 4 : `apps/api/.env.local` (pile locale et clés de test D62), `apps/api/.env.staging.local` (sans clé Brevo ni Apollo, sans `DIRECT_DATABASE_URL`), `apps/<front>/.env.local` (chargé nativement par Next.js) | `integrateur` | J1 (documentation) — **Fait le 2026-09-26** par `integrateur` : étape 4 de la skill `env-secrets` réécrite selon la proposition (avec l'alignement d'EC-20) |
| **EC-24** | **`SESSION_COOKIE_SECRET` est décrit comme « secret de signature du cookie de session »**, alors que la session est un identifiant opaque dont seule l'empreinte est en base (EC-2) : il n'y a rien à signer. Son usage réel serait la signature des jetons courts (cookie de parcours, jeton d'inscription d'EC-4) | Nommer la variable d'après son usage réel (`AUTH_TOKEN_SIGNING_SECRET`), ou corriger sa description ; ne pas signer l'identifiant de session | `expert-cybersecurite` | J3 |
| **EC-25** | **Libellés du backoffice : « aucun fichier de traduction » ou un module de libellés ?** `18` §5, annexe 1, dit que tant que D36 est ouverte, la garde vérifie que `apps/backoffice` n'a **aucun** fichier de traduction ; J1-E (§4) crée `src/messages/fr.ts`, module unique de libellés français, pour qu'aucun littéral ne soit écrit en JSX | *Appliquée au J1, sans risque (relevé par `dev-react-node` le 2026-09-25)* : la garde du backoffice vérifie un **seul** module de libellés, `src/messages/fr.ts`, l'absence de tout dossier `locales/` et de tout fichier JSON sous `src/`, et l'absence de `next-intl` (dépendance et imports). La décision D36 reste ainsi visible. Reformuler `18` §5, annexe 1, en ce sens | `testeur` + `architecte` | — (J1 livré avec la proposition) |
| **EC-26** | **Messages `FST_*` conservés dans le journal (A1) : deux d'entre eux citent des valeurs.** A1 conserve le message des erreurs `FST_*`. Or le gabarit de `FST_ERR_REP_ALREADY_SENT` cite **l'URL brute de la requête, chaîne de requête comprise** (`02` §20.8 l'interdit), et celui de `FST_ERR_FAILED_ERROR_SERIALIZATION` cite **le message d'une autre erreur** (qui peut porter des paramètres SQL). D'autres gabarits de Fastify 5.12.5 interpolent une valeur (`FST_ERR_BAD_URL`, `FST_ERR_MAX_PARAM_LENGTH`), mais ne passent pas par le journal dans notre configuration | *Appliqué au plus prudent par `dev-react-node` le 2026-09-25 (457663e)* : le message de ces **deux** codes est écarté comme celui de toute autre erreur (le code suffit au diagnostic), liste fermée dans `apps/api/src/platform/logger.ts`. À confirmer, ou à remplacer par « aucun message `FST_*` » (plus simple, plus sûr, un peu moins lisible). **Tranché par `expert-cybersecurite` (2026-09-25) : aucun message `FST_*`.** Le message n'est conservé que pour `ApiError`, `RequestValidationError` et `ConfigError` ; la liste `FASTIFY_CODES_QUOTING_VALUES` disparaît, le code et le statut suffisent. Motifs : une liste d'exclusions est une liste noire, contraire au principe de liste blanche d'A1 ; les greffons `@fastify/*` attendus au J3 utilisent aussi le préfixe `FST_` ; et le correctif d'EC-27 fait passer par notre code `FST_ERR_BAD_URL` et `FST_ERR_MAX_PARAM_LENGTH`, dont le message recopie l'URL. Test : une erreur `FST_*` portant un marqueur dans son message ne le laisse dans aucune ligne. **Même commit qu'EC-27** | `expert-cybersecurite` | J3 (avec EC-27) |
| **EC-27** | **La réponse de Fastify à une URL mal encodée contourne l'enveloppe, le secret interne et le filtre de sortie.** `GET /v1/%zz?email=…` reçoit un `400` au format propre de Fastify — `{"error":"Bad Request","code":"FST_ERR_BAD_URL","message":"'/v1/%zz?email=…' is not a valid url component","statusCode":400}` —, **avant** le contrôle du secret (le routeur répond seul, sans crochet ni journal) : un appelant sans secret obtient une réponse hors enveloppe (T7.9, T13.4) qui **recopie l'URL**. Constaté le 2026-09-25 par `dev-react-node`. Injoignable par le passe-plat depuis R1 (tout `%` refusé), donc seulement si le réseau privé devient joignable (le cas que PP-8 couvre) | Option `frameworkErrors` de Fastify : répondre `401` en enveloppe si le secret est absent ou inconnu, sinon `404 not_found` en enveloppe, sans rien recopier ; un test par code `FST_ERR_BAD_URL` et `FST_ERR_ASYNC_CONSTRAINT`. Non appliqué dans la passe J1-J (hors de la liste). **Tranché par `expert-cybersecurite` (2026-09-25) : correctif `frameworkErrors` au J3, en premier commit du J3, et au plus tard avant toute route `/v1/` à paramètre.** Périmètre élargi à **`FST_ERR_MAX_PARAM_LENGTH`, joignable par le passe-plat** dès qu'une route à paramètre existe : le passe-plat admet 200 caractères, Fastify limite un paramètre à 100 ; constaté le 2026-09-25 (route d'essai `/v1/creators/:id`) : `GET /v1/creators/<150 caractères>` reçoit un `414` hors enveloppe, avant le secret, qui recopie le chemin. Réponse : `401` en enveloppe si le secret est absent ou inconnu, sinon `404 not_found` en enveloppe, pour les **trois** codes ; rien de la requête n'est recopié ; ligne de journal sans message (EC-26) ; identifiant de requête selon A3. Tests : les trois codes, avec et sans secret, marqueur dans le chemin et dans la chaîne de requête absent de la réponse et du journal | `expert-cybersecurite` + `architecte` | J3 (premier commit, avant toute route à paramètre) |
| **EC-28** | **`18` T7.1 et T7.2 contredisent `03` PP-2 et PP-6 révisés.** T7.1 attend des refus « **après décodage** » (R1 : plus aucun décodage, tout `%` refusé) ; T7.2 attend que `x-forwarded-for` et `x-real-ip` soient « **réécrits** » (A5 : `x-forwarded-for` ni lu ni relayé, `x-real-ip` retransmis seulement s'il a la forme d'une adresse) | Reformuler T7.1 et T7.2 d'après PP-2 et PP-6 ; les tests unitaires du passe-plat suivent déjà `03` (4058bf2) | `testeur` | **Fait le 2026-09-25** (T7.1 et T7.2 reformulés dans `18`) |
| **EC-29** | **Qui écrit une session ?** *(relevé par `expert-database` au J2, 2026-09-26.)* `0004` crée `identity.sessions` (EC-2) et `identity.resolve_session()`, **en lecture seule** (`03` P7). Restent sans chemin d'écriture : la **création** à la vérification du code (membre) ou à la connexion du backoffice, le **renouvellement glissant** (`last_activity_at`, `idle_expires_at`) à chaque requête, et la **révocation** (déconnexion, suspension, changement de rôle, réinitialisation du second facteur, A-9) | Création : `influx_auth` (E-2, rattachement d'EC-5), `INSERT` de colonnes nommées dans `0108`. Renouvellement : `UPDATE (last_activity_at, idle_expires_at)` accordé aux quatre rôles métier **sur leur seule session**, borné en base par les contraintes de durée déjà posées (30 j / 180 j membres, 30 min / 8 h backoffice). Révocation par le titulaire : `UPDATE (revoked_at, revocation_reason)` sur sa ligne, motifs `logout` et `revoked_by_holder` seulement ; révocation d'un tiers, suspension : fonction `SECURITY DEFINER` journalisée (propriétaire `influx_identity_definer`) | `expert-cybersecurite` (veto) + `expert-database` | J3 |
| **EC-30** | **Création du compte à l'inscription** *(J2, 2026-09-26).* `04` §5.1 interdit toute écriture directe de `identity.account_roles` par un rôle d'exécution, et `identity.grant_role()` est réservée à `influx_admin` ; or l'inscription (E-2, sans session) doit créer **dans une transaction** le compte, **son rôle**, l'acceptation des CGU (`channel = 'signup'`), le consentement (D63) et, en cas d'invitation, le commercial responsable (D54) | Une fonction `SECURITY DEFINER` nommée `identity.provision_account(...)`, propriétaire `influx_identity_definer`, `EXECUTE` à `influx_auth` seul : rôle **limité à `advertiser` ou `creator`**, identité GoTrue et adresse issues de la vérification du code, écriture du registre. Pas de `GRANT INSERT` direct sur `account_roles` à `influx_auth` | `expert-cybersecurite` (liste fermée signée) + `expert-database` | J5 (J3 pour les comptes de démonstration, créés par script sous le rôle de migration) |
| **EC-31** | **Lecture du registre par un agent : « limitée à son périmètre d'exploitation » (`03` C(38))** — le périmètre n'est pas défini, donc pas exprimable en politique | `0006` n'accorde **aucune** lecture de `audit.audit_events` à `influx_agent` (l'administrateur lit, en `aal2`). Proposition : au J8, lecture par l'agent de l'**historique d'un objet** qu'il consulte (fiche de compte), par une fonction qui filtre sur `subject_type` et `subject_id` et journalise la consultation, plutôt qu'un `GRANT SELECT` sur la table | `expert-cybersecurite` | J8 |
| **EC-32** | **Noms de migrations incompatibles avec la CLI Supabase.** La CLI n'applique que les fichiers `<chiffres>_<nom>.sql` ; `04` §11.2 prévoit `0402a`, `0402b`, `0402c` (Lot 4), qui seraient **ignorés sans erreur**, et un ordre d'application (`0402a` avant `0402`) que le tri ne donnerait pas | Renuméroter au Lot 4 en entiers dans l'ordre d'application (par exemple `0402` → `0405`, décalage des suivants), et ajouter à la CI un contrôle qui échoue sur tout fichier de `supabase/migrations/` ne respectant pas `^[0-9]{4}_[a-z0-9_]+\.sql$` | `expert-database` + `integrateur` | Lot 4 (contrôle CI : J4) |
| **EC-33** | **Bornes des rôles de connexion** (`03` P7, règle 6 : « valeurs : `architecte` »). `0001` les pose avec des **valeurs d'attente** pour que T4.2 trouve `rolconnlimit` et `rolconfig` renseignés : `influx_app` 60 connexions, `statement_timeout` et `idle_in_transaction_session_timeout` 15 s ; `influx_auth_login` 20, 5 s ; `influx_worker_login` 10, 60 s | Valeurs à fixer par `architecte` d'après la taille de la grappe Supavisor (`[db.pooler]`), le plancher de 1 s de la demande de code (`02` §18.10) et la durée des purges du worker ; toute correction passe par une nouvelle migration | `architecte` | J4 (avant `staging`) |

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
| `@supabase/supabase-js` | 2.117.1 | 2026-09-23 | `apps/api` | J3 | **Pas la 2.117.2**, publiée le 2026-09-25. Le pair `@opentelemetry/api` est facultatif : non installé |
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
| **C-3** | Règle « un `DELETE` ne porte ni corps ni `content-type` » | J3 | `architecte` |
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
| **5 — Backoffice, pipeline, e-mails** | D35, D36, `03` R-7 | Migrations `0501` à `0503` ; interrupteur d'urgence | TM4, TM6, TM8, TM9 |
| **6 — Recette, audit, ouverture** | Levée des deux vetos ; test d'intrusion (F-9) | Parcours de bout en bout en douze étapes (`18` §7) | Toutes les familles ; restauration répétée |

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
