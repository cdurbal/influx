# Plan et stratégie de développement — du socle au premier usage

> **Date :** 2026-09-25 (allégé le 2026-09-29) · **Rédigé par :** Claude Code, à la demande du fondateur
> **Public :** le développeur (ou l'agent `dev-react-node`) qui construit le produit réel sur `main`.
> **Statut :** feuille de route active. **Les journaux d'exécution, revues de sécurité et écarts clos des jalons J0 à J3 sont archivés dans `docs/mvp/archives/21-journal-j0-j3-archive.md`, ceux du J4 dans `docs/mvp/archives/21-journal-j4-archive.md` — les agents IA ne doivent PAS lire ces archives par défaut.**
> **Ce document ne remplace aucune spécification.** En cas d'écart, `CLAUDE.md` puis `docs/mvp/00` à `20` font foi.

---

## 0. L'essentiel

**Premier usage à livrer.** Une marque et un créateur créent chacun un compte INFLUX réel (e-mail → code à 6 chiffres → informations complémentaires), et chaque inscription devient un **contact Brevo** (sous 1 h — le consentement étant obligatoire pour créer un compte, D63) et, quand la configuration l'autorise, un **contact Apollo** (sous 24 h). Une panne de Brevo ou d'Apollo n'empêche jamais une inscription (`05` RG72).

**Deux niveaux de « prêt », à ne pas confondre :**

| Niveau | Ce qui est vrai | Dépend de |
|---|---|---|
| **Prêt en `staging` (démontrable)** | Les deux inscriptions fonctionnent sur `staging` avec des testeurs internes ; *depuis D70 (2026-10-18)*, `staging` se comporte comme la production : codes et bienvenue réellement envoyés, contacts réels dans les **comptes Brevo et Apollo de `staging`** (plan `archives/jalons/d70-plan.md`) | Le développement seul, exploité par les agents |
| **Prêt en production (ouvert au public)** | Idem en production, avec désinscriptions dans les deux sens, backoffice de supervision, surveillance active, documents légaux | J7 à J9 **et** des portes non techniques : société créée (D25), validation du juriste sur Apollo (D33), CGU (D29), domaines d'envoi authentifiés (§5.8) |

**Le chemin : dix jalons.**

| Jalon | Lot | Contenu | État au 2026-09-29 | Durée théorique |
|---|---|---|---|---|
| **J0** | 0 | Poste, dépôt, intégration continue | ✅ **Terminé** (`e3eadf4`) | 1 j |
| **J1** | 0 | Squelette `apps/api`, `apps/backoffice`, `packages/contracts`, passe-plat | ✅ **Terminé & revu** (`655b857`) | 3 j |
| **J2** | 0 | Base socle : schémas, rôles, RLS, registre, tests T2 T3 T4 T6 T16 | ✅ **Terminé & revu** (`8e6bbfb`) | 4-5 j |
| **J3** | 0 | Authentification : code membre (D43), sessions opaques, backoffice mot de passe + TOTP | ✅ **Terminé** (revue groupée 2026-10-05 : push autorisé ; T-1 corrigé ; push en attente du formatage de `design-proposals/`) | 4-5 j |
| **J4** | 0 | `staging` sur Railway + Supabase, migrations par la CI, collecte d'erreurs (D60) | ✅ Terminé (2026-10-07) | 3-4 j |
| **J5** | 1 | Inscription marque et créateur, transaction unique, file alimentée | ✅ Terminé (2026-10-09, revue groupée sans point rouge) | 4-5 j |
| **J6** | 1 | Worker, connecteurs Brevo et Apollo, qualification, garde-fous | ✅ Revue close (2026-10-12) ; critère `staging` constaté le 2026-10-20 (J9 commit S) | 4-5 j |
| **J7** | 1 | Retours Brevo (désinscriptions, rebonds), espace membre minimal | ✅ Revue close (2026-10-14) ; critère `staging` constaté le 2026-10-20 (J9 commit S) | 3-4 j |
| **J8** | 1 | Backoffice v0 : inscrits, états de synchronisation, rejeu, réglages Apollo | ✅ Revue close (2026-10-16) ; critère `staging` constaté le 2026-10-20 (J9 commit S) | 4-5 j |
| **J9** | 1 | Sortie du mode maquette de la landing, en-têtes, surveillance active, production | ✅ Revue close (2026-10-27) ; critère `staging` constaté en partie (arrêts à faire), production préparée, non créée — reliquat `archives/jalons/j9-fiche.md` | 4-5 j |
| **DS** | extra | Charte KEO Emerald des espaces connectés (D73) : tokens, polices, gabarits mobile et poste de travail, rhabillage de l'existant | ✅ Clos (2026-10-29, `archives/jalons/ds-fiche.md`) | 6-8 j |
| **SN** | extra | Sous-navigation dans la colonne (D74) : sous-menus de la colonne et du rail à la place des pilules de section, page-menu « Mon compte » sur téléphone | ✅ Clos (2026-10-30, `archives/jalons/sn-fiche.md`) | 1,5-2 j |

**Cinq règles qu'aucune urgence ne suspend :**

1. **Aucune donnée réelle avant que le socle de sécurité soit en place** (B1 à B10, `03` §9.1). On construit la tranche verticale *sur* le socle, jamais à côté.
2. **Le code de connexion suit le contrat de `02` §18.10 à la lettre** : envoi synchrone, une seule tentative, plancher de 1 000 ms, aucun appel externe sous transaction, jamais dans `outbox_events`.
3. **Tout ce qu'un juriste ou le fondateur peut encore changer est une configuration, jamais une constante** : périmètre et base légale Apollo, pays de prospection, pays bloqués, calendrier de réessais, plafonds de débit (`05` Q1 à Q4).
4. **Aucun test automatisé n'appelle un service externe réel** (`18` §1.3, `16` RG148). Les vrais appels ne se font que depuis `staging` (D70, comptes de `staging`) ou à la main avec les valeurs de `staging` ; jamais depuis la CI ni la pile locale.
5. **Seul un écart structurant arrête le code (révisé le 2026-09-29 — directive de vélocité du fondateur)** : un micro-écart technique ou de librairie (`EC-*`) qui ne touche aucun invariant métier est tranché sur-le-champ de la manière la plus sûre/conservatrice par l'agent qui code, **sans arrêter le développement et sans créer de commit `docs(mvp):` intermédiaire**. Les ajustements documentaires et la **revue de sécurité (`expert-cybersecurite`) sont groupés en une seule passe à la fin de chaque jalon**. De même, les exigences RGPD étant déjà traduites dans les specs (`03`, `04`, `14`, `16`), **`expert-conformite-rgpd` n'intervient pas sur les Lots 0 à 5** et réalise **une seule revue globale d'homologation au Lot 6 (fin du Fast MVP)**. Enfin, aucun journal narratif de commit n'est ajouté dans ce fichier (1 seule ligne d'état/invariant par commit du jalon actif).

---

## 1. Point de départ & conventions d'environnement

- **`main`** : produit réel construit de zéro (D44). **Ne jamais copier un fichier de la branche `demo`.**
- **Fichiers d'environnement** *(révisé le 2026-10-18, D70)* : `apps/api/.env.local` porte les **valeurs de `staging`, et uniquement `staging`** (Supabase, Brevo et Apollo de `staging`, jamais `DIRECT_DATABASE_URL`) ; lisible par tous les agents, jamais recopié, jamais chargé par un test (les tests et la CI tournent sur la pile locale et la doublure). `apps/api/.env.staging.local` n'existe plus. `apps/web/.env.local` et `apps/backoffice/.env.local` portent `INFLUX_API_INTERNAL_URL` et leur `INFLUX_API_INTERNAL_SECRET`.

---

## 2. Stratégie de développement

### 2.1 Principes

1. **Les spécifications font foi, la maquette jamais.** Chaque tâche cite la règle qu'elle implémente (`05` RG44, `03` A-9…). Face à un micro-écart technique, appliquer la solution la plus conservatrice sans bloquer le jalon (§0, règle 5).
2. **Socle sécurisé d'abord, puis tranche verticale fine, puis élargissement.** Le premier usage est rendu démontrable le plus tôt possible (J6), puis durci (J7 à J9). On ne soigne pas les écrans avant que le flux complet passe.
3. **La base est l'arbitre.** Contrainte, clé étrangère, déclencheur et politique RLS avant tout contrôle applicatif (`04` §1, R1).
4. **Chaque migration contient sa table, ses droits, ses politiques et son test** (`04` §11.1). Une table sans ligne dans la matrice de `03` (`expected-rights.ts`) fait échouer la CI (T2) : on déclare avant de créer.
5. **Configuration en table, lue au moment de l'usage** (`leads.sync_settings`, `backoffice.sla_policies`) : une décision juridique se bascule sans redéploiement.
6. **`staging` d'abord, production sur accord explicite du fondateur**, toujours.
7. **Petits commits, fréquents, sur `main`** (dérogation du 2026-09-17), en *Conventional Commits*, en anglais.

### 2.2 Les quatre environnements

| | Poste local | Intégration continue | `staging` | `production` |
|---|---|---|---|---|
| **Base** | Pile Supabase locale (`supabase start`, Docker) : Postgres + GoTrue | Pile Supabase locale jetable | Projet Supabase `staging` (UE) | Projet Supabase `production` (D25, PITR D57) |
| **Données** | `supabase/seed` + saisies synthétiques | `supabase/seed` | `supabase/seed` **seul** (B9) | Réelles |
| **Brevo** | Doublure (tests) ; `.env.local` = valeurs de `staging` (D70) | Doublure (`16` RG148) | **`live`, compte de `staging`**, domaine d'envoi propre (D70, après le commit 1 de `archives/jalons/d70-plan.md`) | `live`, compte de production, 3 sous-domaines authentifiés |
| **Apollo** | Doublure (tests) | Doublure | **`live`, compte de `staging`** (D70) | `live` après validation du juriste (D33) |

### 2.3 Stratégie de test & discipline de dépôt

- **Budget de durée de la CI : 10 minutes** (`18` A-4). GoTrue n'est pas doublé (fourni par la pile locale).
- **Définition de « terminé » pour un jalon :**
  - [ ] `pnpm check` vert en local et en CI (format, types, lint, tests, build) ;
  - [ ] les tests exigés par le jalon passent trois fois de suite (`18` §1.3) ;
  - [ ] **directive de vélocité (2026-09-29)** : aucun commit `docs(mvp):` intermédiaire entre deux sous-commits d'un jalon ; **une seule revue groupée (`expert-cybersecurite` + `testeur`) à la fin du jalon** ;
  - [ ] toute migration touchant `audit.*`, une politique, un `GRANT`, un `REVOKE`, une fonction `SECURITY DEFINER`, un attribut de rôle ou `supabase/config.toml` (`[auth*]`, `[api*]`, `[storage*]`, `remotes.*`) porte le marqueur `security-reviewed: <date>` dans son message de commit (`03` I-4) ;
  - [ ] toute variable nouvelle est documentée dans le `.env.example` concerné (skill `env-secrets`).

### 2.4 Dépendances épinglées (versions exactes, `savePrefix: ""`)

- **Racine** : `supabase` `2.117.0` (CLI en devDependency).
- **`packages/contracts`** : `zod` `4.0.8`.
- **`apps/api`** : `fastify` `5.12.5`, `@fastify/cookie` `11.1.2`, `@supabase/auth-js` `2.117.2` (importé **uniquement** dans `src/platform/supabase.ts` ; `@supabase/supabase-js` et `@supabase/postgrest-js` interdits), `drizzle-orm` `0.45.1`, `postgres` `3.4.8` (`prepare: false`), `pino` `10.1.0`, `zod` `4.0.8`. Exécution directe par Node (effacement des types, D64).

---

## 3. Écarts actifs pour les jalons restants (J5 à J9)

> Les écarts déjà tranchés et implémentés figurent dans les archives `archives/21-journal-j0-j3-archive.md` (EC-1 à EC-7, EC-13, EC-16 à EC-29, EC-35 à EC-42, EC-46 à EC-57) et `archives/21-journal-j4-archive.md` (EC-32 à EC-34, EC-58 à EC-61). Le tableau ci-dessous ne conserve que ceux qui restent à appliquer.

| # | Écart / Décision applicable | Règle retenue pour l'implémentation | Jalon |
|---|---|---|---|
| **EC-8** | Clés de `leads.sync_settings` (`04` §5.8) | Clés : `apollo_scope`, `apollo_legal_basis` (défaut `consentement_requis`, surcharge par pays), `apollo_excluded_countries` (exclusion, **vide** : tous les pays, 0141), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, identifiants de listes et modèles Brevo | J5, J6 |
| **EC-9** | Calendrier de réessais | Valeur de départ de `retry_schedule` = `05` RG79 (10 tentatives) | J6 |
| **EC-10** | Événements émis à l'inscription | À l'inscription, `lead.created` seul : 3 lignes (`brevo_contact`, `apollo_contact`, `brevo_transactional` bienvenue) ; `consent.granted` / `consent.revoked` pour les changements ultérieurs | J5 |
| **EC-11** | D54 (invitations) et D55 (UTM / source d'acquisition) | Colonnes figées sur `identity.accounts` (J5), table des invitations (J8), attributs `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `REFERRER_DOMAIN`, `HEARD_FROM` ajoutés au mapping Brevo `16` §M4 | J5, J8 |
| **EC-12** | Webhook Brevo sans hôte public sur `apps/api` | Chemin `/api/v1/webhooks/brevo/<jeton>` relayé par le passe-plat de `apps/web` (exception fermée d'en-tête et du contrôle A4 pour ce seul chemin) ; contrôle IP sur `x-real-ip` ; table d'événements entrants en ajout seul consommée par le worker | J7 |
| **EC-14** | « Mes données » (export, suppression) au Lot 1 | Au Lot 1 : dépôt de la demande depuis l'espace membre, accusé de réception, exécution manuelle par un administrateur selon procédure écrite | J7 |
| **EC-15** | Écrans et chemins d'inscription/connexion | Écrans écrits d'après `17` §3 ; chemins localisés (`/fr/inscription/marque` · `/en/signup/brand`…) ; la section formulaire de la landing devient un renvoi vers les deux portes au J9 | J5, J9 |
| **EC-22** | Route de santé publique de `apps/web` (D60) | `src/app/health/route.ts`, réponse `200` ou `503` à corps vide fondée sur `GET /v1/status`, exclue du `matcher` du proxy | J9 |
| **EC-30** | Création du compte à l'inscription | Fonction `SECURITY DEFINER` `identity.provision_account(...)` (propriétaire `influx_identity_definer`, `EXECUTE` à `influx_auth` seul, rôle limité à `advertiser` ou `creator`). Au J3 (commit 11), les comptes de démo sont créés par script sous le rôle de migration | J3 (11), J5 |
| **EC-31** | Lecture du registre par un agent (`03` C(38)) | Au J8, lecture par l'agent de l'historique d'un objet consulté par une fonction filtrant sur `subject_type` et `subject_id` et journalisant la consultation | J8 |
| **EC-43** | Signal « nouveau navigateur » (remplace le pays au MVP) | `country_code` nul au MVP ; signal « navigateur inconnu » (30 jours) sur `user_agent_summary` (`05` RG141 à RG146), e-mail `auth.new_device` (J7) et alerte B-7 (J8) | J7, J8 |
| **EC-44** | Alertes compte de secours (MFA-10) et code de secours (MFA-4) | Au J3 (commit 10) : ligne d'audit (`agent.break_glass_login` / `agent.recovery_code_consumed`) et `pino` `error` sans donnée ; au J6 : e-mail `internal.critical_alert` **P0 par le chemin synchrone de `apps/api`, jamais par la file** (`16` RG86, D43), après le commit, une tentative, Brevo 3 s, échec sans effet sur la connexion (`transactional_sends` `failed` + `pino` `security.critical_alert_failed`) ; destinataires = comptes `admin` actifs lus en base, compte de secours exclu ; contenu bilingue sans donnée personnelle (type, heure UTC, référence d'audit) | J3 (10), J6 |
| **EC-45** | Amorçage des comptes internes et jeton d'enrôlement (G-1) | Au J3 (commit 11) : script local uniquement (`example.test`), refusé hors hôte de bouclage, pose un jeton d'enrôlement fixe de démo (`mfa_enrollment_tokens`). Table d'invitations au J8 | J3 (10-11), J8 |
| **EC-62** | Documents publics (CGU, confidentialité, cookies) : lecture sans compte, texte, empreinte, publication (RG23 à RG29) | **Chemin** : aucun 3e chemin ; motif `identity.read_published_terms` ajouté à **E-1** (`influx_auth`, union `packages/contracts`, T6 ; signature `expert-cybersecurite` à la revue de fin de J5) via la seule fonction `identity.terms_in_force(p_document identity.document_kind, p_locale text)` de **`0108_identity_terms_public_read`** (`SECURITY DEFINER`, propriétaire `influx_identity_definer`, `search_path = ''`, `STABLE`, `EXECUTE` à `influx_auth` seul ; refuse `supervision_notice` ; version en vigueur dans `p_locale`, sinon `en` ; 0 ou 1 ligne ; `SELECT (version_label, content_uri, requires_acceptance)` ajouté au définisseur, aucun droit direct d'`influx_auth` sur la table ; assertions de fin comme `0106`). **Texte** : `apps/api/legal/<document_kind>/<locale>/<version_label>.md`, octets exacts (`-text` dans `.gitattributes`, exclu de Prettier) ; `content_uri` = ce chemin relatif ; l'API reconstruit le chemin depuis (document, langue, libellé), exige l'égalité avec `content_uri`, recalcule le SHA-256 et **échoue fermé** (`500`, `pino` `error`) si absent ou différent ; cache mémoire par `id` après vérification. Manifeste `apps/api/legal/published.json` (document, langue, libellé, SHA-256) : test CI, tout fichier listé existe et garde son empreinte. **Publication J5** : `pnpm --filter @influx/api db:publish-terms -- --document= --locale= --label=` sous le rôle de migration (local, ou staging avec les gardes de `seed-staging-demo-accounts.ts`), une transaction : `effective_to = now()` sur la version en vigueur puis insertion (`published_at = effective_from = now()`), puis manifeste ; refuse un fichier non commité ou modifié, un libellé déjà publié, un `draft-*` hors local/staging ; production = action du fondateur (J9) ; outil admin `2V` au J8+. Seed local par le script ; `test:db` insère ses lignes. Brouillons : libellé `draft-N`, texte ouvert par « Projet non contractuel / Draft, not contractual ». **Format** : Markdown restreint (`#` à `###`, paragraphes, listes `-`, `**gras**`, ni lien ni HTML) rendu par `apps/web` en éléments React, sans `dangerouslySetInnerHTML`, tout autre motif en texte. **`GET /v1/terms/current?document=terms_of_service\|privacy_policy\|cookie_policy&locale=fr\|en`** → `{ id, document, locale (servie, RG25), isFallback, versionLabel, effectiveFrom, requiresAcceptance, contentSha256, content }` ; `400` hors liste, `404` `terms_not_published`, `Cache-Control: no-cache` + `ETag` = `id` ; débit limité par IP. Le front transmet `id` à `POST /v1/signup` ; version périmée refusée, panneau rechargé (`17` l.506, l.2091). **Pages** : `/fr/cgu` · `/en/terms`, `/fr/confidentialite` · `/en/privacy`, `/fr/cookies` · `/en/cookies`, rendu serveur sans connexion, `noindex` tant que le libellé est `draft-*` ; mentions légales et CGV hors J5 (D25), pied de page de la landing inactif jusqu'au J9. **Amendement du 2026-10-08 (fondateur : aucun `500` sur cette route, brouillons affichés)** : **(A)** le texte exact est stocké en base à la publication, dans `identity.terms_versions.content` (**`0109_identity_terms_content`**) : contrainte d'empreinte `sha256(convert_to(content, 'UTF8')) = content_hash`, contrainte `NOT VALID` `content is not null or effective_to is not null` (toute nouvelle version en vigueur porte son texte ; une ligne héritée peut être close), `content` ajouté au déclencheur d'immuabilité avec une seule exception, le remplissage unique `NULL` → texte (empreinte déjà figée) ; `terms_in_force()` renvoie `content` et **ignore les lignes sans texte**. L'API sert le texte de la base, revérifie l'empreinte et **ne lit plus aucun fichier** : les fichiers `legal/` et `published.json` restent la source de la publication et le contrôle CI d'immuabilité. Le script refuse un fichier qui n'est pas en UTF-8 valide. **(B)** Une ligne héritée sans texte n'est pas servie (`404` `terms_not_published`, `pino` `warn`), **sans repli sur le fichier** (pas de second chemin de lecture, et le fichier est justement ce qui dépend du déploiement) ; `db:publish-terms` sur un libellé déjà publié sans texte **remplit** `content` au lieu de refuser (cas de `draft-2` en local). **(C)** Étape idempotente `publishUnlessPublished` après `db push` dans `migrate-staging` : pour chaque (document, langue), la dernière entrée de `published.json` (ordre du fichier, en ajout seul) est publiée, ou son texte rempli si elle l'est déjà, et ferme ainsi `demo-fictive-1` ; mêmes gardes que le script (marqueur staging) ; **`draft-*` toujours refusé en production**, où la publication reste une action du fondateur (J9, sous un libellé définitif). **(D)** Toute défaillance de la route autre que `400` et `404` (empreinte divergente, base injoignable) répond **`503` `terms_unavailable`** avec `Retry-After`, `pino` `error`, et jamais `500` | J5 (3), J8, J9 |

---

## 4. Lot 0 — le socle (J0 à J4)

### J0, J1, J2 — Socle CI, applications, passe-plat et base de données (✅ Terminés)

- **J0 (`e3eadf4`)** : CI GitHub Actions, nettoyage de la maquette, dérogation F-4 avec contrôle `security-reviewed:` (`03` I-4).
- **J1 (`655b857`)** : `@influx/contracts`, `@influx/test-kit`, `apps/api` (Fastify 5 + worker, enveloppe stricte, filtre de sortie), `apps/backoffice`, passe-plat de `apps/web` et `apps/backoffice` à secret interne par surface.
- **J2 (`8e6bbfb`, dette pré-J3 `b7d07ee`)** : migrations `0001` à `0009` (12 rôles fermés sans `BYPASSRLS`, `identity.sessions`, `audit.append()` lié à `session_user`), grappes `DATABASE_URL` (`influx_app`), `AUTH_DATABASE_URL` (`influx_auth_login`) et `WORKER_DATABASE_URL` (`influx_worker_login`), matrice T2 et tests T3, T4, T6, T16 verts.

---

### J3 — Authentification et sessions (✅ Terminé le 2026-10-05)

- **J3 (`de85a49` → `533f683`, CI `f2157a0`)** : code membre (D43, E-1/E-2), sessions opaques `__Host-`, backoffice mot de passe + TOTP `aal2` (garde globale), migrations `0010` à `0015`, comptes de démo (`pnpm db:demo-accounts`), écrans minimaux. Revue groupée faite, T-1 corrigé. Détail des commits et des revues : `archives/21-journal-j0-j3-archive.md`.

**Tickets reportés de la revue J3** (constat complet dans l'archive) :

| # | Correctif attendu | Échéance |
|---|---|---|
| J3S-1 | R : réserver la tentative avant GoTrue (5 / 15 min + portée IP EC-47) ; test « 20 R parallèles ⇒ ≤ 5 appels » | Avant la 1re action B-5 (J8) |
| J3S-4 | Fraîcheur R vérifiée dans la transaction de l'action ; test « B-5 sans R ⇒ refus » | J8 |
| J3S-5 | Brancher HIBP (`newPasswordVerdict`) sur invitation et changement de mot de passe (bloquant avant mise en ligne) | J8 |
| J3S-6 | Bandeau `?secours=N` dérivé de `GET /v1/bo/me` | J8 |
| J3S-7 | CSP backoffice `img-src 'self' blob:` | J9 |
| J3S-8 | Alerte `security.member_code_targeted` (≥ 25 échecs / 24 h), sans blocage | J9 |

Rappels : G-1 point 4 au J4 ; EC-44 (e-mail d'alerte) au J6 ; G-1 point 2 par l'invitation au J8 ; B-1 branché et EC-38 réglé sur les projets hébergés avant la mise en ligne.

### J4 — `staging`, déploiement et collecte de surveillance (✅ Terminé le 2026-10-07)

- **J4 (`6bc4aff` → `6aa651a`)** : contrôle CI des migrations (immuabilité, EC-32/37), schéma `ops` et collecte D60 (`0016`, E-6 signée), en-têtes R7, job « Migrate staging », `deploy/railway/*.json`, runbook `runbooks/staging.md`. `staging` en ligne le 2026-10-07, constats A5, R7, `session_user` et EC-33 conformes. EC-58 à EC-61 acceptés. Détail des commits, de la revue et de la vérification `testeur` : `archives/21-journal-j4-archive.md`.

**Tickets reportés de la revue J4** :

| # | Correctif attendu | Échéance |
|---|---|---|
| J4S-6 | `client-errors` : affichage texte strict, plafond de nouveaux groupes navigateur par compte et par heure, alerte « nouveau groupe » non déclenchée par le navigateur seul | J9 |
| J4S-7 | Aucun nom ni pseudo dans un chemin des espaces connectés (sinon modèle de route Next dans le collecteur) | Lot 2 |
| J4S-8 | Tous les sous-domaines en HTTPS avant HSTS `includeSubDomains` sur l'apex | Domaines |
| J4R-1 | Secrets commercial/admin de staging exposés (à changer) | J8 |


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

Préfixes : `/v1/…` pour les membres et le public (`web`), `/v1/bo/…` pour le backoffice (`backoffice`). Chaque route déclare un schéma de requête **et** de réponse (`packages/contracts`).

| Route | Accès | Chemin base | Règles |
|---|---|---|---|
| `POST /v1/auth/request-code` | Public | E-1 | `02` §18.10 ; `05` RG39 à RG52 |
| `POST /v1/auth/verify-code` | Cookie de parcours | E-2 | RG42 à RG47, RG53, RG66 à RG69 |
| `GET /v1/auth/journey` · `POST /v1/auth/journey/reset` | Cookies de parcours | Aucun (jetons signés, `no-store`) | RG111, RG130 (D66) |
| `GET /v1/terms/current` | Public | E-1 (EC-62) | RG25, RG27 |
| `POST /v1/signup` | Jeton d'inscription | E-2 (EC-5) | RG5, RG7, RG8, RG11 à RG38, RG73, RG120 |
| `POST /v1/auth/logout` | Membre | Utilisateur | — |
| `GET` · `PATCH /v1/me` | Membre | Utilisateur | RG15, RG71 |
| `GET` · `PUT /v1/me/consent` | Membre | Utilisateur | RG34, RG92, RG95 |
| `GET` · `DELETE /v1/me/sessions[/:id]` | Membre | Utilisateur | RG56 |
| `POST /v1/me/reauthenticate/request-code` · `…/verify-code` | Membre | E-1 · E-2 (`identity.member_reauthenticate`) | RG57, RG44, RG47 |
| `GET` · `POST /v1/me/email-change`, `POST …/confirm`, `DELETE …/:id` | Membre, code frais (`POST`) | Utilisateur ; E-1 `identity.member_email_change` (journal des codes) | RG57, RG58 (A-11) |
| `POST /v1/me/terms/accept` | Membre | Utilisateur | RG28 |
| `POST /v1/support/code-not-received` | Public, débit limité | E-1 (EC-5) | RG65 |
| `POST /v1/webhooks/brevo/:token` | Brevo | Écriture brute (EC-12) | `16` RG146, RG147 |
| `/v1/bo/accounts`, `/v1/bo/sync/*`, `/v1/bo/settings/apollo`, `/v1/bo/invitations`… | `agent` · `admin` en `aal2` | Utilisateur | `05` RG97 à RG108, RG116 à RG119 |

### J5 — Inscription marque et créateur (✅ Terminé le 2026-10-09)

1. **Migrations du Lot 1** (`04` §11.2, renumérotées EC-37) : `0101` (file `outbox_events` et `contact_sync_states`, contrainte RG35, clé étrangère `transactional_sends.outbox_event_id`), `0103` (réglages `leads.sync_settings`, clés d'EC-8), `0104` (statut déclaré non nul, santé de l'adresse, `set_declared_status()`, `correct_email()`), `0105` (incidents de délivrance), `0106` (`profiles.advertiser_profiles` minimal), colonnes de source d'acquisition (EC-11), `identity.provision_account` (EC-30). `0102` et `0107` attendent le J8.
2. **Versions de CGU** : pages publiques de lecture en FR et EN sans connexion (RG27). Empreinte calculée à la publication, immuable ensuite.
3. **`POST /v1/signup`**, variante discriminée par rôle, **une transaction** : compte, rôle, acceptation (version, empreinte copiée, langue affichée — RG24, RG25), **deux** événements de consentement avec le libellé exact présenté (RG32, RG33), attestation de majorité datée pour un créateur (RG20), statut déclaré (`business` imposé pour une marque, RG22), entreprise, source d'acquisition figée (RG120), événements du registre, trois lignes de file (EC-10) ; refus si pays bloqué (RG8) ou aucune CGU publiée. Idempotent sur `auth_user_id` (RG110).
4. **Écrans** d'après `17` §3 : les deux portes, écran 1 (mention RG6), écran 2 (six cases, phrase de correspondance, compte à rebours, panneau « je ne reçois pas le code »), écran 3 en **deux variantes jamais fondues** ; états de `17` §3.5 ; accessibilité de `17` §3.6 ; clés dans `locales/<langue>/auth.json`.
5. **Espaces après inscription** : accueil minimal de chaque rôle (RG71), `noindex`.

**Tests** : CA1 à CA10, CA22, CA65 à CA69 ; TM10 ; T2 étendu aux tables du Lot 1 ; Playwright : une inscription nominale par porte, avec la doublure Brevo.
**Terminé quand** : sur `staging`, une marque et un créateur s'inscrivent de bout en bout, et les lignes de file attendues existent.

- [x] Commit 1 (`0404465`) — dette J4 : J4S-2, J4S-4, J4S-5, J4T-1 déjà soldés par `0d5872d` (vérifiés) ; `.node-version` → 24 (J4R-1, D64).
- [x] Commit 2 (`4eb8ff1`) — migrations `0101`, `0103` à `0106` (`provision_account` dans `0106`, car elle écrit le profil marque) ; T2/T3/T4 étendus, `tm10-signup-provisioning` (40 cas) ; EC-57 remesuré sur GoTrue v2.197.0 (version de `staging`).
- [x] Commit 3 (`83ba6d1`) — CGU (EC-62) : `0108` `identity.terms_in_force` (E-1 `identity.read_published_terms`), textes `apps/api/legal/` + manifeste d'empreintes, `db:publish-terms`, `GET /v1/terms/current` (échec fermé sur empreinte), pages `/fr/cgu` · `/en/terms`, confidentialité, cookies ; brouillons `draft-1` à faire relire.
- [x] Commit 3bis (`89cf836`) — D25 tranchée (Angleterre) : textes `draft-2` sous droit anglais (UK GDPR, PECR, CRA/UCTA, restraint of trade), marqueurs `[…]` d'identité, seed local sur `draft-2`.
- [x] Commit 3ter (`662ec3d`) — EC-62 amendé : texte en base (`0109`, `provision_account` exige un texte), route sans 500 (404 / 503 `terms_unavailable`), publication `--latest` par la CI de `staging`.
- [x] Commit 4 (`7b33351`) — `POST /v1/signup` : contrat `packages/contracts/src/signup.ts` (variantes par rôle, clés de libellé par porte, liste de pays partagée), E-2 `identity.complete_signup` autour de `provision_account` (savepoint, motifs en 200 : `country_blocked`, `terms_outdated`, `terms_not_published`, `account_unavailable`), session ouverte, `tm10-signup-route` (16 cas).
- [x] Commit 5 (`43eb292`) — écrans : un seul parcours `AuthFlow` (porte, e-mail + mention RG6, code six cases, écran 3 en deux variantes), chemins EC-15 (`/fr/inscription/marque` · `/en/signup/brand`, `/en/sign-in`, `/en/brand`), refus en 200 rendus un par un, règles dans `auth-steps.ts` / `signup-form.ts` (37 cas), accueils RG71 `noindex`.
 - [x] Commit 5bis (`0a8a87e`) — référent : littéral IP écarté (dernier libellé numérique) dans `normalizeReferrerDomain` et par la contrainte jumelle `0110`.
 - [x] Commit 5ter (`0d7f720`) — D66 : `GET /v1/auth/journey` (cookies signés seuls, `no-store`) et `/reset` ; langue par navigation client + variable de module `journey-memory.ts`.
 - [x] Commit 5quater (`e4e136b`) — D15 précisée : « 18 ans ou plus » partout (écrans, landing, RG19, `17`) ; CGU `draft-2` à réaligner.
 - [x] Commit 5quinquies (`c56e4b8`) — CGU `draft-3` (fr, en) = `draft-2` + clause d'âge seule, publiée et ajoutée au manifeste ; `draft-2` immuable ; relecture juriste de la clause.
 - [x] Commit 5sexies (`b136505`) — I-4 : attestation ultérieure `security-reviewed: <date> covers <sha>…` (fondateur, 2026-10-08), sans réécriture de `main` ; les quatre commits J5 restent rouges jusqu'à la revue de fin de J5.
- [x] Commit 6 (`cff1adf`) — Playwright (`apps/web/e2e`, `pnpm test:e2e`, en CI après `pnpm check`) : deux inscriptions nominales avec la doublure Brevo et relecture en base (CGU, libellé RG32, 3 lignes EC-10), plus les 7 cas D66 du commit 5 (9 parcours).

### J6 — Déversement vers Brevo et Apollo (critère de fin constaté sur `staging` en `live` le 2026-10-20, J9 commit S)

1. **La boucle du worker**, en trois temps courts — jamais d'appel externe sous transaction (`02` §18.4 G4, lead-pipeline T9) :
   - `(1) PRISE` : `SELECT … WHERE status='pending' AND available_at<=now() ORDER BY priority, available_at, id LIMIT 20 FOR UPDATE SKIP LOCKED` (en respectant l'ordre RG77 sauf priorité `0` révocations/suppressions) → `status='processing'`.
   - `(2) APPEL` : hors transaction, relire l'état, qualifier, appeler le connecteur.
   - `(3) ISSUE` : `succeeded | skipped + motif | pending + available_at (réessai RG79) | failed + cause en clair` ; `contact_sync_states`.
2. **Relecture et qualification** à la consommation (RG37, RG80) : consentement `marketing_email` pour Brevo, qualification complète RG82 pour Apollo, garde-fous `02` §12.4 (`SYNC_MODE=dry_run`, `skipped_non_production`, `skipped_no_credentials`).
3. **Module Brevo** (`apps/api/src/domains/leads/connectors/brevo/`) : opérations 1, 2, 6 et 7 de `16` §M1 ; mapping typé `16` §M4 + EC-11 ; contrôle de sortie strict (RG137) ; limiteur de débit par catégorie ; `COMPANY` vide pour un créateur (RG142).
4. **Bienvenue** (`account.welcome_advertiser` et `account.welcome_creator`, P1) : clé d'idempotence sans identifiant d'événement (RG76) ; journalisé dans `transactional_sends`.
5. **Module Apollo** (`connectors/apollo/`) : création/mise à jour idempotente (`contact_sync_states`), aucun réimport de donnée enrichie (RG85), séquence désactivée par défaut.
6. **Essai manuel sur le poste de développement** (D62, `16` RG115) et enregistrement des fixtures expurgées (RG148).

**Tests** : TM1.1 à TM1.10 ; CA37 à CA50 ; lead-pipeline T5, T6, T9 ; T17 ; scénarios 1 à 6 et 13 à 14 de `16` RG148.
**Terminé quand — premier usage démontrable** : sur `staging` en `dry_run`, chaque inscription produit ses lignes et le worker les traite avec le bon statut ; l'essai manuel passe ; une panne simulée de Brevo/Apollo n'empêche aucune inscription (CA37).

- [x] Commit 1 — sans objet : revue de fin de J5 (2026-10-09, `56b8046..ddcaea7`) sans point rouge ; arbitrages `architecte` du démarrage (`28d8510`, EC-44 amendé).
- [x] Commit 2 (`d066228`) — `0111` E-3 : `influx_leads_definer`, quatre fonctions `SECURITY DEFINER` à `influx_worker` seul (prise RG77 sauf priorité 0, début avec relecture RG37, issue avec `dry_run`, reprise TM1.10), code `elevated.leads.drain_outbox` (EC-52 (3)) ; U + `domains/leads/queue.ts` ; `tm1-outbox-claim` (69 cas), T2/T3/T4/T6 étendus.
- [x] Commit 3 (`c00f9f2`) — boucle du worker (`domains/leads/drain.ts`) : une voie par destination, verrous `02` §12.4, calendrier RG79, budget par catégorie, interface `Connector` (aucun branché), `SIGTERM` ; `leads-drain` (22 cas unitaires), `tm1-worker-loop` (4 cas : CA47, CA48, CA50, T9).
- [x] Commit 4 (`8798ec2`) — connecteurs Brevo (`connectors/brevo/`, opérations 1, 2, 6, 7, mapping §M4 + EC-11, RG137, RG142, bienvenue une fois par compte) ; `0112` `read_brevo_subject` + index unique RG90 ; clé Brevo du worker (EC-19) ; doublure étendue aux contacts ; `brevo-connector` (28 cas), `tm1-brevo-connector` (9 cas).
- [x] Commit 5 (`2136515`) — connecteur Apollo (`connectors/apollo/`, création `run_dedupe` ou mise à jour par l'id connu, qualification RG81 à RG84 relue à chaque consommation, aucun réimport RG85, aucune séquence) ; `0113` `read_apollo_subject` ; `APOLLO_API_KEY` au worker seul ; doublure Apollo ; `apollo-connector` (26 cas), `apollo-guard`, `tm1-apollo-connector` (14 cas).
- [x] Commit 6 (`f4f9ebc`) — EC-44 : `internal.critical_alert` P0 synchrone après le commit de la connexion (jamais `outbox_events`), une ligne et une tentative par `admin` actif (compte de secours exclu), clé = seq d'audit + compte destinataire, contenu FR+EN fixe sans `@` ; `0114` (`consume_recovery_code` rend le seq, politique d'insertion de `influx_auth`) ; `critical-alert-email` (3 cas), `t8-backoffice-sign-in` (15 cas).
- [x] Commit 7 (`d4625ec`, `9eb1662`, `3fa1d69`, `86120e8`) — essai D62 réussi (Brevo contact + bienvenue, Apollo contact) ; sondes : Apollo `PUT`, id inconnu = 422 ⇒ client corrigé ; fixtures alignées ; revue de fin de J6 sans point rouge (R1, R2, I-2 soldés ; tickets J6S/J6T dans la fiche) ; reste la vérification du critère sur `staging` (fondateur).

### J7 — Retours de Brevo et espace membre minimal (revue close le 2026-10-14 ; critère de fin constaté sur `staging` le 2026-10-20, J9 commit S)

1. **Webhook Brevo** selon EC-12 (`16` RG146, RG147) : jeton en temps constant, chemin à jeton, plages IP, fenêtre 15 min, idempotence, traitement par le worker.
2. **Traitements** (`16` RG106) : désinscription, plainte, rebond dur, adresse invalide, blocage ⇒ `consent_events` (`brevo_webhook`), `contact_sync_states` ; rebond dur transactionnel ⇒ `email_delivery_incidents` et `accounts.email_status = 'undeliverable'`.
3. **Rapprochement quotidien** des 48 dernières heures (RG91) et **purge des utilisateurs GoTrue orphelins** après 24 h (`02` §18.5, E-4).
4. **Espace membre** (RG71) : mes informations, préférences de communication (retrait en un geste ⇒ `consent.revoked` prioritaire), mes sessions (« fermer toutes les sessions »), mes données (EC-14), déconnexion, changement d'adresse à double confirmation (RG58), notification de nouvel appareil (RG55, EC-43), ré-acceptation des CGU (RG28), canal de secours (RG65).

**Tests** : CA32 à CA36, CA52 à CA55, CA70 ; lead-pipeline T7 et T8 ; scénarios 7 à 9 de `16` RG148.

- [x] Commit 1 (`4aef89a`) — dette J6 : I-4 depuis l'ancre fixe `56b8046`, RG47 et J6T-8 stabilisés.
- [x] Commit 2 (`679263a`) — `0115` à `0117` : table brute Brevo et E-3, `ops.periodic_runs` et E-4, codes du J7.
- [x] Commit 2bis (`2f3fdf4`) — `0118` à `0120` : re-authentification, changement d'adresse, consentement, demandes RGPD, secours.
- [x] Commit 3 (`93d1eba`) — réception du webhook Brevo : exception A4 unique, plages IP, deux jetons, ±15 min, ligne brute.
- [x] Commit 4 (`40023cf`) — retours Brevo traités par le worker (« retire un droit », RG93, `email.changed`, `0121`).
- [x] Commit 5 (`af88ad5`) — E-4 : rapprochement quotidien des 48 h, purge GoTrue horaire, purge brute à 30 j.
- [x] Commit 6 (`cc00b72`, `9c6bbe0`) — API « mon compte » : informations, consentement en un geste, sessions, CGU ; J6T-3.
- [x] Commit 7 (`65a11fc`) — re-authentification par code frais et changement d'adresse à deux codes (`0123`).
- [x] Commit 7bis (`1507ccf`) — arbitrages du commit 7 : `not_sent`, motif signé, A1, réalignement GoTrue (`0124`, `0125`).
- [x] Commit 8 (`c971d54`) — navigateur inconnu (`auth.new_device`), « mes données », canal de secours (`0126`).
- [x] Commit 8bis (`d81bb5d`, attestation `a7bad99`) — arbitrages du commit 8 : accusé rendu par INFLUX, `due_at`, E-5 au J8 (`0127`, `0128`).
- [x] Commit 9 (`4c7c546`) — écrans `/fr/compte/*` · `/en/account/*`, écran CGU bloquant, Playwright à 375 px.
- [x] Commit 10 (`33acb6c`) — outil `trial:record` et runbook `staging` J7 ; webhook réel et critère de fin constatés par l'agent au J9 commit S (D70).
- [x] Clôture (`5b977f7`, `c8379f6`) — revue de fin de J7 sans point rouge (`expert-cybersecurite`, `testeur`) ; 18 commits attestés, dont 4 du J5 ; test CGU révélé par la CI corrigé ; specs alignées.
- **Reportés** (détail : `archives/jalons/j9-fiche.md`, et `git show 5b977f7:docs/mvp/jalons/j7-fiche.md`) : avant production J7S-1 à J7S-3 ; avant le webhook de test J7S-4, J7S-6 ; fondateur J7S-5, J6S-5 ; J8 J7S-7, J7T-1 à J7T-6, J6T-1, J6T-2 ; J9 J7S-8.

### J8 — Backoffice v0 (revue close le 2026-10-16 ; critère de fin constaté sur `staging` le 2026-10-20, J9 commit S ; effacement Apollo au Lot 5)

1. Migrations `0129` (ex-`0102`, catalogue des files, délais) et `0130` (ex-`0107`, alertes, double validation, réécriture de `grant_role()` avec 2V et fraîcheur R), table des invitations (EC-11).
2. **Liste des inscrits** (RG97, RG98, aucun export nominatif RG106) et **fiche d'un inscrit** (état par destination avec cause en clair RG99, compteurs du jour RG105).
3. **Rejeu** unitaire et en lot plafonné à 200 (RG101, sans 2V : EC-J8-19).
4. **Réglages Apollo** réservés à `admin` (périmètre, base légale, pays de prospection, réévaluation RG81).
5. **Corrections** (RG108) par fonctions `SECURITY DEFINER`, files d'incidents et **invitations nominatives** (D54, RG116 à RG119).
6. **Exécution minimale des demandes « mes données »** (avancée du Lot 5, arbitrage `chef-de-projet` 2026-10-14, porte de production), après `0107` : `influx_privacy` + `PRIVACY_DATABASE_URL` (worker seul) ; `privacy.execute_request` (E-5) restreinte aux tables du Lot 1 selon `04` §9.2 (compte `deleted`, sessions révoquées, `deleted+<id>@invalid`, raison sociale et adresses en clair vidées, y compris `email_delivery_incidents`, `email_change_requests`, `code_delivery_reports` et `brevo_inbound_events` absentes de `04` §9.2, utilisateur GoTrue supprimé, `account.anonymized` au registre, `account.deleted` P0) ; connecteur Brevo opération 2 (suppression du contact), Apollo `skipped` noté ; clôture typée `completed_at` + `outcome_code` (`15` RG77) après confirmation Brevo (RG79) ; déclenchement `admin` 2V + R depuis la fiche d'un inscrit ; `access` : export JSON produit par la base et **téléchargé dans l'espace membre** après un code frais `data_export` à chaque fois, 3 fois / 7 jours au plus, purge E-4, e-mail `privacy.export_ready` sans lien (`expert-cybersecurite` 2026-10-14, runbook §4), même clôture. File 14, autres types et tables des Lots 2 à 4 : Lot 5.

**Tests** : CA56 à CA63 (CA64 réécrit, EC-J8-1) ; T14 sur les routes du backoffice ; parcours de double validation dégradée.

- [x] Commit 1 (`73cdc5c`) — dette J7 hors base : J7S-7, J7T-1 à J7T-3, J6T-1, J6T-2 ; `all_paused` ⇒ `503`.
- [x] Commit 2 (`1314e9e`) — `0129` files et délais, `0130` alertes, 2V (PD2 à PD7), `grant_role()` sous 2V + R.
- [x] Commit 3 (`1a41e1b`) — `0131` invitations interne et membre, `0132` corrections RG108, rejeu ≤ 200, historique EC-31.
- [x] Commit 4 (`748fcd9`) — garde B-5 : J3S-1, J3S-4, J3S-5 (HIBP), service 2V dégradé PD1 à PD7.
- [x] Commit 5 (`8017799`) — API de lecture : liste RG97, recherche partielle limitée et journalisée (`0133`), fiche, RG105.
- [x] Commit 6 (`68d6928`) — API d'action : rejeu, corrections, routes 2V, réglages Apollo et levée Brevo (`0134`), alertes.
- [x] Commit 7 (`a7328a9`) — invitations interne (remplace EC-45) et membre en lien copié, source `invitation` (`0135`).
- [x] Commit 8 (`6e33ef3`) — E-5 minimale (`0136`, `0137`) : export dans l'espace membre, anonymisation du Lot 1, `account.deleted`.
- [x] Commit 9 (`c1e6fe3`) — écrans du backoffice v0, `0138` (J3S-6, B-7), canal de secours RG65.
- [x] Commit 10 (`b8f17fb`) — Playwright backoffice (CA56 à CA63, 2V dégradée), J7T-4, J7T-5, T14 sur l'inventaire `/v1/bo/*`.
- [x] Clôture (`262e626`) — revue de fin de J8 sans point bloquant (`expert-cybersecurite`, `testeur`) ; 6 commits attestés ; EC-J8-19 tranché (rejeu en lot sans 2V) ; `04` §11.2, CA64, `03`, `15`, `18` alignés.
- [x] Commit 12 (`7560b24`) — `prod:bootstrap-admins` : premier `admin` et bris de glace de production (MFA-10, B7), cœur `scripts/internal-bootstrap.ts`, témoin `influx_production` exigé, confirmation par la référence du projet, refus de la CI et de tout compte interne existant, secrets dans `.operator-secrets/` ; `runbooks/production.md` §0 bis ; planchers +3 db.
- **Reportés** (détail : `archives/jalons/j9-fiche.md`) : avant Lot 1 J8S-1 à J8S-4, C5.c, A2 ; J9 J8S-5 à J8S-7, J8T-2 à J8T-7, J7S-8 ; avant production J7S-1 à J7S-3 ; Lot 5 J8S-8, J8S-9 ; fondateur `staging`, J4R-1, J7S-4 à J7S-6, J6S-5.

### J9 — Durcissement, landing branchée, mise en ligne (revue close le 2026-10-27 ; critère de fin `staging` constaté en partie le 2026-10-27, arrêts du worker et de l'API à faire)

1. **Sortie du mode maquette de `apps/web`** (`02` §13.3) : retrait du module fictif, d'`IS_MOCKUP` et du bandeau ; gardes resserrées ; boutons et portes de la landing branchés sur les vrais chemins (EC-15). **Bandeau cookies (arbitrage `chef-de-projet` 2026-10-09)**, commit séparé : si l'inventaire des traceurs (`landing-page/07` L9) ne relève aucun traceur non essentiel, bandeau désactivé globalement, lien « Cookies » du pied conservé (`landing-page/11` §8) ; sinon cookie `influx_cookie_consent` (`11` §7, `readStoredConsent`/`writeStoredConsent`) et garde « aucune API de stockage » (D37) ouverte pour ce seul module. Exécution `dev-react-node` ; inventaire et verdict L9 : `expert-conformite-rgpd` (revue Lot 6, avant production) ; cookie : revue groupée `expert-cybersecurite` du J9.
2. **En-têtes et CSP à nonce** par surface (`03` §6.5, T10) ; passe-plat complet (T7) ; erreurs sans détail (T13) ; limitation de débit (T15) ; analyse des artefacts (T11).
3. **Surveillance active** (`02` §20.5 à §20.7) : alertes par e-mail, sonde du worker, écran « Santé technique », route `/health` publique (EC-22) ; préparation de `production` ; relectures humaines de `18` §10 « Lot 1 ».

- [x] **Chantier D70** (fondateur, 2026-10-18) : `staging` iso-production et exploité par les agents, commits D70-0 (`464b7b8`) à D70-5 de `archives/jalons/d70-plan.md` (`INFLUX_ENV`, `isDeployedEnvironment`, scripts sur `.env.local`, `staging:check`, runbook en procédure d'agent), revue groupée du 2026-10-19 sans bloquant restant (correctifs S1 à S3 et T1, migration URL acceptée sous conditions dans D70, reports au Lot 6bis listés au point 5).
- [x] Commit 0 (`eec21bb`) — J6S-3 : ligne « without effect to audit » du pool `worker` en `debug` (≈ 35 k lignes/jour en `staging`) ; `staging` remis en marche (worker, région du backoffice) ; Watch Paths à corriger (fondateur).
- [x] Commit S (`d844219`) — constats D70 §9 sur `staging` (critères J6 à J8 ; effacement Apollo au Lot 5), webhooks Brevo repointés sur `staging`, J4R-1, J7S-4, J7S-5, J7S-6, J6S-5 ; Watch Paths conformes ; planchers 2 617 / 1 051.
- [x] Commit 1 (`bc95f3a`) — `0142` : J8S-3 (R liée à `session_id` des claims), J8S-5 (RLS `member_invitations` `admin` ou auteur, T2), `backoffice.admin_role_grants()` (J8S-4), F4 (index) ; planchers 2 624 / 1 058.
- [x] Commit 2 (`9740dd8`) — J8S-1 (`GET /v1/bo/dual-control/degraded`, revue d'accueil), J8S-2 (cible nommée de la 2V), J8S-4 (`admin` attribué à l'accueil), J8S-6 (`0143`, `backoffice_reauth_ip` 60 / h), J8S-7 (`POST /v1/bo/accounts/search`) + J8T-7 (e2e) ; planchers 2 642 / 1 065.
- [x] Commit 3 (`cd16b90`) — `0144` : C5.c (orphelin GoTrue de la nouvelle adresse supprimé, nouvel essai), A2 (nouvelle adresse sur RG44, `429`), J7S-1 (marqueur lié à la session de la requête), J7S-2 (disjoncteur de purge, base et worker), J7S-3 (webhook `404` hors `web`, `03` A4) ; planchers 2 655 / 1 076.
- [x] Commit D67-a (`93e9084`) — `0145` : garde RG163 (identifiant Brevo jamais `NULL`, `23001`), `updated_at` tenu par la base (RG161), journal `settings.changed` par déclencheur seul écrivain (D67 (v)) ; planchers 2 696 / 1 117.
- [x] Commit D67-b (`37d8b74`) — `0146` : configuration manquante = échec incident sans réessai (RG160, ordre RG164, `credentials_missing` en environnement déployé), rattrapage RG161 dans la reprise E-3 (même signature et `GRANT`, marge 60 s), refus de démarrage RG162 partagé avec `staging:check`, `skipped` de configuration reclassés ; planchers 2 730 / 1 132.
- [x] Commit D67-c (`483eea2`) — backoffice : `configuration_missing` = incident nommant le réglage (`sync-causes.ts`, jamais la valeur), AL25 `configuration_missing` dès la 1re ligne, rejeu d'un échec de configuration (`configuration_fixed`), compteurs RG79 / RG105 ; planchers 2 734 / 1 134.
- [x] D67 (tranchée par `architecte` le 2026-10-17) — soldée par D67-a à D67-c ; écran des identifiants Brevo hors J9 (option Lot 5).
- [x] Commit 4 (`103590d`) — CSP à nonce par requête (`src/proxy.ts` des deux fronts, `03` §6.5, aucun `'unsafe-inline'`), J3S-7, redirection de la barre oblique finale dans les proxys, zod `jitless` au navigateur, G2 levée et resserrée (EC-J9-1), T10 sur `next start` (`e2e/security-headers.spec.ts`) ; planchers 2 739 / 1 135.
- [x] Commit 5 (`dafb876`) — sortie du mode maquette : module fictif, `IS_MOCKUP` et bandeau supprimés ; photos conservées comme actifs de marque (`src/content/images/CREDITS.md`, manifeste de la garde G4) ; G6 et annexe 3 en garde d'absence ; G1 en liste blanche nommée (et backoffice) ; `action`/`formAction` levés ; portes, boutons et en-tête sur les chemins EC-15 ; formulaire devenu renvoi vers les deux portes ; pied légal actif ; planchers 2 722 / 1 135.
- [x] Commit 6 (`0bd927a`, fondateur) — cookies (EC-J9-3) : aucun traceur non essentiel ⇒ bandeau désactivé (`COOKIE_BANNER_ENABLED = false`, `[locale]/layout.tsx`), lien « Cookies » du pied conservé, e2e du bandeau retiré ; garde D37 inchangée.
- [x] Commit 7 (`854f492`) — T7 en intégration sur le build des deux fronts (suite partagée, `test:artifacts`), T13 (API balayée, pages 404 et d’erreur aux jetons), T15 (`PUBLIC_ROUTE_RATES`, `429` homogène avec `Retry-After`), T11 (trois artefacts, valeurs Supabase / Brevo), J4S-6 ; planchers 2 835 / 1 136.
- [x] Commit 8 (`2444461`) — surveillance active : `15` RG165 (AL49 à AL63), `0147` (battement, sonde, relevés de la base, signaux, états d'alerte sous verrou, agrégation horaire et purges `ops_retention`, AL59 par empreinte), alertes techniques directes vers Brevo (worker ; AL50 par l'API), `/health` de l'API vérifiant la base, EC-22, variables `OPS_ALERT_RECIPIENTS` et cibles de la sonde ; planchers 2 995 / 1 204.
- [x] Commit 9 (`6b1f62a`) — écran « Santé technique » (admin seul, lecture seule) : `0148` (cinq lectures `backoffice.ops_*`, `influx_admin` seul), `/v1/bo/ops/*` (état, erreurs, occurrences, trafic, processus), p95 calculé à la lecture sur les histogrammes additionnés, écran `/sante-technique`, lien « état des services » ; planchers 3 060 / 1 228.
- [x] Commit 10 (`acb36ae`) — tests de fin : landing ⇒ vraie inscription FR et EN, axe sur six écrans du backoffice (J8T-4), CA62 par la route (J8T-2), CA58 de bout en bout (J8T-3), `overCap` (J8T-5), avalanche et histogrammes entre instances (`02` §20.12), planchers figés de tous les paquets et de l'e2e (J8T-6), `0149` (pays lisibles du définisseur : 2V Apollo par pays) ; planchers 3 073 / 1 236, e2e 56.
- [x] Commit 11 (`aa7f62e`) — préparation de la production (doc et configuration seules, EC-J9-6) : `runbooks/production.md` (miroir de `staging`, portes §5.8, Supabase UE + PITR, quatre services sur `production`, DNS, retour arrière, rodage 30 j, J8S-9, invitation hors e-mail, CGU EC-62, relectures `18` §10), `deploy/railway/*.production.json`, job « Migrate production » inerte (EC-J9-8) ; planchers 3 073 / 1 236.
- [x] Clôture (`61ac4bd`, attestation `d695165`) — revue de fin de J9 (`expert-cybersecurite`, `testeur`, 2026-10-27) : droits signés (`0142` à `0149`, E-4, E-6, `expected-rights.ts`), 14 commits attestés ; bloquants J9S-1 (valeurs héritées du fork, runbook) et J9T-2 (marqueur de production exigé, `ci-production-job.test.ts`) corrigés, avec J9S-3, J9S-8, J9S-10, J9T-4, J9T-6 ; `03`, `04`, `05`, `15` (seuils AL53, AL56, AL61, écran), `17b` §3.15, `18` (§10 « Lot 1 » : 6 cases sur 11, TM1.13, E3) alignés ; planchers 3 082 / 1 236, e2e 56.
- [x] Constats `staging` (sans code, 2026-10-27, sur `5dbf608`) — CI et « Migrate staging » verts, `staging:check` vert ; `/health` et relais `200`, sonde (4 cibles `up`) et battement du worker en marche, T10 du backoffice, J9S-5 conforme ; J9T-1 infirmée ; arrêts du worker et de l'API non faits (accord du fondateur).
- **Reportés** (détail : `archives/jalons/j9-fiche.md`) : avant production J9T-1 (arrêt du worker, coupure de l'API, inscription réelle sur `staging`), J9S-2, J9S-4, AL53, manques du commit 11, points `expert-ux` du commit 5 ; Lot 2 J9S-6, J9S-7, J9S-9, J9T-5, J9T-8, J9T-9, J4S-7 ; Lot 3 T15.2, F3 ; Lot 5 classement des groupes d'erreurs, J9T-3, J9T-10, J8S-8, J8S-9 ; Lot 6 F8, J7T-6 ; fondateur portes §5.8, cases 5 et 7 à 10 de `18` §10 « Lot 1 ».

### Jalon DS — Charte KEO Emerald des espaces connectés (extra, avant le Lot 2)

Décision D73 (fondateur, 2026-10-28). Les espaces membres (inscription et connexion comprises) et le backoffice passent en charte KEO Emerald, en responsive, colonne de navigation à gauche sur poste de travail ; la vitrine ne change pas, sauf son vert de marque aligné sur `#1dd68a` (F2, DS-14). Les écrans des Lots 2 à 5 se construisent ensuite directement dans la charte. Point d'entrée : **`archives/jalons/ds-fiche.md`** (commits DS-1 à DS-14, critère de fin, décisions ouvertes) ; mécanique `02` §21 ; charte `20` §11.

- [x] Jalon DS clos (DS-1 `e966209` à DS-12b `ee9ed76`, DS-14 `398ff9f`, DS-13 clôture) — charte KEO Emerald en place sur les espaces membres et le backoffice, vitrine figée (G3e, TD4) hors du vert de marque unique `#1dd68a` (F2) ; `pnpm check` + `pnpm test:e2e` verts trois fois de suite (e2e local 120, 120 et 126 s ; en CI 74 s au parent de DS-1 contre 154 s, soit +80 s pour 90 s permis) ; planchers web 203→252, backoffice 62→90, test-kit 134→188, e2e 56→133 ; polices `latin` préchargées 53 708 octets (plafond 120 000), `latin-ext` versionné mais non câblé (EC-DS-3-1) ; écarts EC-DS-3-1, EC-DS-5-1 à -3 et EC-DS-6-1 à -4 (détail dans les réponses de session, non repris ici) ; un test de base intermittent vu une fois (`t14-backoffice-invitations-route`, « a retry of the same link after the account exists goes straight to the factor » : `unavailable` au lieu de `factor_created`), vert au rejeu : à surveiller ; recette humaine faite (`18` §12.4, 2026-10-29) ; **reste** : revue groupée `testeur` + `expert-cybersecurite` (`/ds-commit revue`).

### Jalon SN — Sous-navigation dans la colonne (extra, avant le Lot 2)

Décision D74 (fondateur, 2026-10-29). Les pilules de section disparaissent : sous-menu de la rubrique active dans la colonne (membres) et le rail (backoffice), page-menu « Mon compte » sous 1 024 px, « Mes informations » à `/compte/informations`. Point d'entrée : **`archives/jalons/sn-fiche.md`** (commits SN-1 à SN-5, critère de fin, tests TN1 à TN9).

- [x] Jalon SN clos (SN-1 `202933f` à SN-4 `fc54686`, avec `40e1559` et `5e49da1`, SN-5 clôture) — sous-navigation D74 en place : page-menu « Mon compte » (`/compte`, exemptée des CGU), « Mes informations » à `/compte/informations`, sous-entrées dans la colonne membres et le rail du backoffice, pilules de section retirées, garde TN9 ; TN1 à TN9 présents et raised-only (planchers jamais baissés), axe sur la page-menu (FR à quatre largeurs, EN à deux), seuls des attendus e2e d'adresse modifiés ; `pnpm check` et `pnpm test:e2e` verts aux commits du jalon ; accord du fondateur sur un vrai téléphone le 2026-10-30 ; revue groupée `testeur` + `expert-cybersecurite` faite (2026-10-30, attestation `dff4de2`, aucun changement sous `apps/api` ni `supabase`) ; **reste** : SNT-1 (TD3.6 intermittent en run complet), SNT-2 (`21` omet SN-4 et deux commits hors plan), SNT-3 (pas de test du défilement des entrées du menu de la landing ni des liens de marque) ; aucun SNS ; écarts EC-SN-1 à -9 et décisions ouvertes dans `archives/jalons/sn-fiche.md`.

### Jalon RK — Réalignement sur la référence KEO Emerald (extra, avant le Lot 2)

Décision D75 (fondateur, 2026-10-30). Dix-sept écarts entre la proposition 4 et le rendu réel, tranchés un par un ; quatre défauts corrigés (ombre lumineuse du bouton principal jamais affichée, halo d'en-tête à bords nets, sous-titres hors Manrope, filet de ligne du tableau dense absent), effets et primitives réalignés, vitrine inchangée. Point d'entrée : **`jalons/rk-fiche.md`** (commits RK-0 à RK-10, tests TK1 à TK8, garde G3i, critère de fin).

- [x] RK-0 (`8c62c28`) — charte amendée avant tout code ; `badge-error-bg` `#2e1213`, halo 16 rem, seuil TK2.2 de 16 à 25/255
- [x] RK-1 (`78fb02a`) — filet du rendu sans code de production : 31 cas e2e et 5 gardes rouges sur le parent, annotés RK-n ; `vitrine-states.json` prise ici
- [x] RK-2 (`f1b27c2`) — `--effect-action-glow*` hors de l'espace `--shadow-*`, lu par `var()` : l'ombre du bouton principal s'affiche ; G3i (a) verte
- [x] RK-3 (`69eaa1f`) — G3i (b) : la CSS construite de chaque front lit tout token redéfini sous KEO par `var()`, négatif vérifié sur la construction réelle (`test:artifacts`)
- [x] RK-4 (`3e46a59`) — réduction à 98 % à l'appui et agrandissement à 103 % sous `motion-safe:` (hors bouton texte et petits boutons du BO), graisse 600 du secondaire et du bouton texte
- [x] RK-4 · UX-1 (`5832dd2`) — typefaces KEO chargées au backoffice, prouvées par la FontFace
- [x] RK-4 · UX-2 (`a1e430f`) — état désactivé des boutons BO, aria-disabled compris
- [x] RK-5a (`39179b6`) — titres des membres en Manrope à tailles fixes (`heading-classes.ts`, `LegalMarkdown` en variante KEO), `--tracking-heading` −0,025 em, lissage sur le conteneur KEO ; G8 étendue et TK7.2 vertes (BO : RK-5b)
- [x] RK-5b (`9c709b8`) — titres du backoffice en Manrope à tailles fixes (`SECTION_TITLE`, `BLOCK_TITLE`, titre de carte des pages d'auth), `tracking-overline`, `antialiased` sur `<html>` ; TK3 BO, TK3.4 et G8 BO libérés
- [x] RK-6 (`418442f`) — halo d'en-tête en fond du conteneur d'écran (`bg-header-glow bg-no-repeat`, 15 % sur 16 rem, sans calque ni bord) ; TK2 libérés dans les deux fronts, pic `#0d291d` dans G3d
- [x] RK-7 (`fe45da8`) — aucun anneau sur un titre ni sur `main` pris par l'application (`:where(h1, h2, h3, h4, main)[tabindex="-1"]:focus-visible`, jamais un `[tabindex]` générique) ; TK5.1 libérés, libellé « Étape N sur 3 » repris sur `OVERLINE`
- [x] RK-8 — contour de la carte cliquable éclairci au survol (`border-hover`) ; badges remplis en Manrope gras, `badge-error-bg` `#2e1213` confiné au badge d'erreur (TK7.5), paires dans G3d

### Hors jalon

- [x] Commits D72-1a à D72-3 (`bfb2dd0`, `bb8500e`, puis rouge opaque, zone de danger, `ErrorNotice`) — suppression de compte en libre-service sans approbation `admin` (D72, migration `0150`, `identity.submit_member_erasure()`, e-mail `privacy.erasure_completed`), zone de danger et rouge opaque web/backoffice ; DZ-8 : Apollo sans suppression de contact, `erasure_not_propagated` demeure ; DZ-1, 2, 4, 5, 6, 7 ouverts dans `decisions.md`. Fiche supprimée.

### 5.8 Portes de la mise en production

| Porte | Qui | Référence |
|---|---|---|
| Société créée ; mentions légales possibles | Fondateur + avocat fiscaliste | D25 |
| Périmètre et base légale Apollo validés par un juriste ; pays de prospection renseignés | Fondateur + `expert-conformite-rgpd` (veto) | D33, `05` Q1 à Q3 |
| CGU FR et EN avec clause de non-contournement, supervision des conversations, conservation probatoire ; politique de confidentialité nommant Brevo et Apollo | Fondateur + juriste — *`draft-2` validés le 2026-10-08 ; marqueurs `[…]` en attente de la société* | D29, A5, A10, R-1 |
| Trois sous-domaines d'envoi authentifiés (SPF, DKIM, DMARC) sur le compte Brevo de production | Fondateur + `integrateur` | `16` RG9, `CLAUDE.md` §14.3 |
| Comptes Brevo et Apollo au nom de la société ; contrats de sous-traitance signés | Fondateur | `CLAUDE.md` §14.3 |
| *(2026-10-17, D67)* **Identifiants de listes et de modèles Brevo de production renseignés** dans `leads.sync_settings` de production (listes annonceurs et créateurs ; **tous** les modèles de `brevo_template_ids`, bienvenue comprise), par les variables du `worker` (D68) ou par SQL selon le runbook ; premier démarrage du worker de production accepté par le contrôle de `05` RG162 ; aucune ligne en échec de configuration au backoffice | Fondateur (confirmation) + `integrateur` | `05` RG160 à RG164, `02` §12.5 |
| Textes de la landing relus ; revue visuelle du budget d'effets | `expert-marketing` + `expert-conformite-rgpd` ; `expert-ux` | D48, D59 |
| Exécution des demandes « mes données » (E-5 minimale, `account.deleted`) livrée | `dev-react-node` + `expert-cybersecurite` | Arbitrage `chef-de-projet` 2026-10-14, `15` RG79, RG80 |
| Aucune objection ouverte de `expert-cybersecurite` ni de `expert-conformite-rgpd` | Les deux experts | `CLAUDE.md` §10.3 |
| **Accord explicite du fondateur** pour la mise en production | Fondateur | `CLAUDE.md` §10.3, règle 6 |

---

## 6. Configuration des services externes

- **Supabase** : projets `staging` (UE) et `production` (après D25, avec PITR D57) ; clés JWT ES256, réglages GoTrue du J3, aucun schéma métier exposé, mots de passe posés hors migration, `DIRECT_DATABASE_URL` dans GitHub Secrets uniquement.
- **Brevo** : attributs `16` §M4 + EC-11 ; listes par rôle et langue ; modèles transactionnels FR/EN (`auth.login_code`, `account.welcome_*`, `auth.new_device`, `auth.email_change_*`, `internal.critical_alert`) ; webhook (J7) ; deux clés API distinctes (`api` et `worker`, EC-19).
- **Apollo** : champs personnalisés du contexte INFLUX ; séquences activées uniquement après validation du juriste (D33).
- **Railway & GitHub** : 4 services (`web`, `backoffice`, `api` sans domaine public, `worker`), variables par service, secrets dans les environnements GitHub `staging` et `production`, trois sous-domaines DNS (`tx.`, `news.`, `pro.`).

---

## 7. Après le Lot 1 : la feuille de route (Lots 2 à 6bis)

Chaque lot commence par la même séquence : décisions obtenues, spécification relue, migrations et matrice des droits, tests de droits, puis écrans.

| Lot | Décisions à obtenir avant de coder | Première étape technique | Tests qui portent le lot |
|---|---|---|---|
| **2 — Profils, réseaux, badge** | D34, D61 (`07` Q15 et Q16), D24 instruite, `03` R-4 et R-5 | Migrations `0201` à `0207` : trois objets créateur, compartiments Storage privés ; création de `packages/domain` et `packages/ui` (le jalon DS ne le crée pas : tokens et polices en copies gardées, `02` §21.3) ; écrans construits dans la charte KEO (D73) | **T1** (anonymisation sur la charge brute), T9, T14, TM5, TM11 |
| **3 — Campagnes, recherche anonymisée** *(mode serré `00` §9)* | D38, facettes de `10` | Migrations `0301` à `0306` ; domaine `search` avec k-anonymat, pagination plafonnée, journal ; fil chronologique côté créateur | T1 rejoué, T15, TM12 ; mesure manuelle des 30 secondes |
| **4 — Mise en relation, messagerie à trois** | D30, apartés (`04` §5.7.1 A2), conditions mobiles de D58 | Migrations `0401` à `0406` ; `reveal_identity()` et affaire créée à la révélation | **T18**, T5, T19, TM2, TM3 |
| **5 — Backoffice, pipeline, e-mails** *(mode serré `00` §9)* | D35, D36, `03` R-7 | Migrations `0501` à `0503` ; interrupteur d'urgence ; traitement unitaire et exports (`00` §9) | TM4, TM6, TM8, TM9 |
| **6 — Recette, audit, ouverture** *(livraison mode serré fin oct.)* | Levée des deux vetos ; test d'intrusion (F-9) | Parcours de bout en bout en douze étapes (`18` §7) | Toutes les familles ; restauration répétée |
| **6bis — Rattrapage du mode normal** *(obligatoire sitôt le mode serré livré)* | Aucune (déjà spécifié dans `10`, `12`, `15`) | Reprise intégrale des 4 écarts entre mode normal et mode serré (`00` §9) : (1) recherche à facettes de campagnes côté créateur, (2) alertes automatiques de coordonnées dans la messagerie, (3) actions de masse au backoffice, (4) tableau de bord complet | Tests des facettes créateur, corpus de détection automatique, actions en lot (2V), indicateurs du tableau de bord |

> **✳️ Évolution en fin de MVP — D65 (arbitrage du fondateur du 2026-09-30) :** Intégration de la **connexion OAuth pour YouTube** (vérification directe de la chaîne et relevé automatique des métriques). Pour les autres réseaux (Instagram, TikTok), le challenge de code temporaire en bio reste la méthode de départ au lancement, avec pour trajectoire d'être progressivement remplacé par du OAuth au fur et à mesure des agréments API.

---

## 8. Guide de lecture par jalon

| Avant | Lire uniquement |
|---|---|
| **J5** | **`archives/jalons/j5-fiche.md` d'abord** (sections et lignes exactes) ; `05` §A à §E, §H, §L ; `17` §2.5, §2.6, §3 ; skill `design-system-influx` |
| **J6** | **`archives/jalons/j6-fiche.md` d'abord** (sections et lignes exactes) ; `02` §6 et §11 ; `05` §I ; `16` §H, §J, §M ; skills `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` |
| **J7** | `05` §F (RG54 à RG58), §J ; `16` §I et §M6 ; `17` §6 ; skills `lead-pipeline`, `brevo-campaign` |
| **J8** | `git show a2ff7bc:docs/mvp/jalons/j8-fiche.md` (fiche archivée) ; `05` §K ; `15` §C, §F ; `17b` §3.11 et §3.13 ; skill `backoffice-ops` |
| **D70** | **`archives/jalons/d70-plan.md` d'abord** ; `02` §12.4 ; `03` §6.8 et T17 ; `16` §J ; skills `env-secrets`, `railway-deploy` |
| **J9** | `archives/jalons/j9-fiche.md` (reliquat) ; fiche complète : `git show 8323aeb:docs/mvp/jalons/j9-fiche.md` ; `runbooks/production.md` |
| **SN** | **`archives/jalons/sn-fiche.md` d'abord** ; `17` §2.2, §2.3, §6.0 ; `17b` §1.7 ; `20` §11.8 ; `02` §21.5 points 3 et 8 |
| **DS** | **`archives/jalons/ds-fiche.md` d'abord** ; `02` §21 ; `20` §11 ; `17` §2.2, §2.3, §8 ; `17b` §1.4, §1.7, §6 ; `18` §5 (gardes G3 à G8) ; skill `design-system-influx` |
