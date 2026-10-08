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
| **Prêt en `staging` (démontrable)** | Les deux inscriptions fonctionnent sur `staging` avec des données synthétiques ; le worker traite la file en `dry_run` ; un essai manuel depuis le poste de développement crée de vrais contacts dans les **comptes Brevo et Apollo de test** (D62) | Le développement seul (fin du jalon J6) |
| **Prêt en production (ouvert au public)** | Idem en production, avec désinscriptions dans les deux sens, backoffice de supervision, surveillance active, documents légaux | J7 à J9 **et** des portes non techniques : société créée (D25), validation du juriste sur Apollo (D33), CGU (D29), domaines d'envoi authentifiés (§5.8) |

**Le chemin : dix jalons.**

| Jalon | Lot | Contenu | État au 2026-09-29 | Durée théorique |
|---|---|---|---|---|
| **J0** | 0 | Poste, dépôt, intégration continue | ✅ **Terminé** (`e3eadf4`) | 1 j |
| **J1** | 0 | Squelette `apps/api`, `apps/backoffice`, `packages/contracts`, passe-plat | ✅ **Terminé & revu** (`655b857`) | 3 j |
| **J2** | 0 | Base socle : schémas, rôles, RLS, registre, tests T2 T3 T4 T6 T16 | ✅ **Terminé & revu** (`8e6bbfb`) | 4-5 j |
| **J3** | 0 | Authentification : code membre (D43), sessions opaques, backoffice mot de passe + TOTP | ✅ **Terminé** (revue groupée 2026-10-05 : push autorisé ; T-1 corrigé ; push en attente du formatage de `design-proposals/`) | 4-5 j |
| **J4** | 0 | `staging` sur Railway + Supabase, migrations par la CI, collecte d'erreurs (D60) | ✅ Terminé (2026-10-07) | 3-4 j |
| **J5** | 1 | Inscription marque et créateur, transaction unique, file alimentée | ▶️ En cours — fiche `jalons/j5-fiche.md` | 4-5 j |
| **J6** | 1 | Worker, connecteurs Brevo et Apollo, qualification, garde-fous | ⏳ À faire (**1er usage démontrable**) | 4-5 j |
| **J7** | 1 | Retours Brevo (désinscriptions, rebonds), espace membre minimal | ⏳ À faire | 3-4 j |
| **J8** | 1 | Backoffice v0 : inscrits, états de synchronisation, rejeu, réglages Apollo | ⏳ À faire | 4-5 j |
| **J9** | 1 | Sortie du mode maquette de la landing, en-têtes, surveillance active, production | ⏳ À faire | 4-5 j |

**Cinq règles qu'aucune urgence ne suspend :**

1. **Aucune donnée réelle avant que le socle de sécurité soit en place** (B1 à B10, `03` §9.1). On construit la tranche verticale *sur* le socle, jamais à côté.
2. **Le code de connexion suit le contrat de `02` §18.10 à la lettre** : envoi synchrone, une seule tentative, plancher de 1 000 ms, aucun appel externe sous transaction, jamais dans `outbox_events`.
3. **Tout ce qu'un juriste ou le fondateur peut encore changer est une configuration, jamais une constante** : périmètre et base légale Apollo, pays de prospection, pays bloqués, calendrier de réessais, plafonds de débit (`05` Q1 à Q4).
4. **Aucun test automatisé n'appelle un service externe réel** (`18` §1.3, `16` RG148). Les vrais appels ne se font qu'à la main, depuis le poste de développement, vers les comptes de test (D62).
5. **Seul un écart structurant arrête le code (révisé le 2026-09-29 — directive de vélocité du fondateur)** : un micro-écart technique ou de librairie (`EC-*`) qui ne touche aucun invariant métier est tranché sur-le-champ de la manière la plus sûre/conservatrice par l'agent qui code, **sans arrêter le développement et sans créer de commit `docs(mvp):` intermédiaire**. Les ajustements documentaires et la **revue de sécurité (`expert-cybersecurite`) sont groupés en une seule passe à la fin de chaque jalon**. De même, les exigences RGPD étant déjà traduites dans les specs (`03`, `04`, `14`, `16`), **`expert-conformite-rgpd` n'intervient pas sur les Lots 0 à 5** et réalise **une seule revue globale d'homologation au Lot 6 (fin du Fast MVP)**. Enfin, aucun journal narratif de commit n'est ajouté dans ce fichier (1 seule ligne d'état/invariant par commit du jalon actif).

---

## 1. Point de départ & conventions d'environnement

- **`main`** : produit réel construit de zéro (D44). **Ne jamais copier un fichier de la branche `demo`.**
- **Fichiers d'environnement** : le chargeur de `apps/api` ne lit que `apps/api/.env.local` (pointant vers la **pile locale** `supabase start` et les clés de test D62). Les valeurs de `staging` vont dans `apps/api/.env.staging.local` (sans clé Brevo ni Apollo, sans `DIRECT_DATABASE_URL`). `apps/web/.env.local` et `apps/backoffice/.env.local` portent `INFLUX_API_INTERNAL_URL` et leur `INFLUX_INTERNAL_SECRET`.

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
| **Brevo** | Doublure locale par défaut ; essai manuel en `BREVO_MODE=redirect` (D62) | Doublure (`16` RG148) | `disabled` ou `redirect`, compte de test | `live`, compte de production, 3 sous-domaines authentifiés |
| **Apollo** | Doublure ; essai manuel en `SYNC_MODE=live` avec compte de test et liste blanche | Doublure | **Aucune clé** (`skipped_no_credentials`) | `live` après validation du juriste (D33) |

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
| **EC-8** | Clés de `leads.sync_settings` (`04` §5.8) | Clés : `apollo_scope`, `apollo_legal_basis` (défaut `consentement_requis`, surcharge par pays), `apollo_prospecting_countries` (autorisation, **vide**), `signup_blocked_countries` (vide), `retry_schedule`, `rate_limits`, identifiants de listes et modèles Brevo | J5, J6 |
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
| **EC-44** | Alertes compte de secours (MFA-10) et code de secours (MFA-4) | Au J3 (commit 10) : ligne d'audit (`agent.break_glass_login` / `agent.recovery_code_consumed`) et `pino` `error` sans donnée ; e-mail d'alerte par la file au J6 | J3 (10), J6 |
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
| `POST /v1/me/email-change` et confirmations | Membre, code frais | Utilisateur | RG57, RG58 (A-11) |
| `POST /v1/me/terms/accept` | Membre | Utilisateur | RG28 |
| `POST /v1/support/code-not-received` | Public, débit limité | E-1 (EC-5) | RG65 |
| `POST /v1/webhooks/brevo/:token` | Brevo | Écriture brute (EC-12) | `16` RG146, RG147 |
| `/v1/bo/accounts`, `/v1/bo/sync/*`, `/v1/bo/settings/apollo`, `/v1/bo/invitations`… | `agent` · `admin` en `aal2` | Utilisateur | `05` RG97 à RG108, RG116 à RG119 |

### J5 — Inscription marque et créateur (4 à 5 jours)

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

### J6 — Déversement vers Brevo et Apollo (4 à 5 jours)

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

### J7 — Retours de Brevo et espace membre minimal (3 à 4 jours)

1. **Webhook Brevo** selon EC-12 (`16` RG146, RG147) : jeton en temps constant, chemin à jeton, plages IP, fenêtre 15 min, idempotence, traitement par le worker.
2. **Traitements** (`16` RG106) : désinscription, plainte, rebond dur, adresse invalide, blocage ⇒ `consent_events` (`brevo_webhook`), `contact_sync_states` ; rebond dur transactionnel ⇒ `email_delivery_incidents` et `accounts.email_status = 'undeliverable'`.
3. **Rapprochement quotidien** des 48 dernières heures (RG91) et **purge des utilisateurs GoTrue orphelins** après 24 h (`02` §18.5, E-4).
4. **Espace membre** (RG71) : mes informations, préférences de communication (retrait en un geste ⇒ `consent.revoked` prioritaire), mes sessions (« fermer toutes les sessions »), mes données (EC-14), déconnexion, changement d'adresse à double confirmation (RG58), notification de nouvel appareil (RG55, EC-43), ré-acceptation des CGU (RG28), canal de secours (RG65).

**Tests** : CA32 à CA36, CA52 à CA55, CA70 ; lead-pipeline T7 et T8 ; scénarios 7 à 9 de `16` RG148.

### J8 — Backoffice v0 (4 à 5 jours)

1. Migrations `0102` (catalogue des files, délais) et `0107` (alertes, double validation, réécriture de `grant_role()` avec 2V et fraîcheur R), table des invitations (EC-11).
2. **Liste des inscrits** (RG97, RG98, aucun export nominatif RG106) et **fiche d'un inscrit** (état par destination avec cause en clair RG99, compteurs du jour RG105).
3. **Rejeu** unitaire et en lot plafonné à 200 (RG101, double validation dégradée PD1 à PD7).
4. **Réglages Apollo** réservés à `admin` (périmètre, base légale, pays de prospection, réévaluation RG81).
5. **Corrections** (RG108) par fonctions `SECURITY DEFINER`, files d'incidents et **invitations nominatives** (D54, RG116 à RG119).

**Tests** : CA56 à CA64 ; T14 sur les routes du backoffice ; parcours de double validation dégradée.

### J9 — Durcissement, landing branchée, mise en ligne (4 à 5 jours)

1. **Sortie du mode maquette de `apps/web`** (`02` §13.3) : retrait du module fictif, d'`IS_MOCKUP` et du bandeau ; gardes resserrées ; boutons et portes de la landing branchés sur les vrais chemins (EC-15).
2. **En-têtes et CSP à nonce** par surface (`03` §6.5, T10) ; passe-plat complet (T7) ; erreurs sans détail (T13) ; limitation de débit (T15) ; analyse des artefacts (T11).
3. **Surveillance active** (`02` §20.5 à §20.7) : alertes par e-mail, sonde du worker, écran « Santé technique », route `/health` publique (EC-22) ; préparation de `production` ; relectures humaines de `18` §10 « Lot 1 ».

### 5.8 Portes de la mise en production

| Porte | Qui | Référence |
|---|---|---|
| Société créée ; mentions légales possibles | Fondateur + avocat fiscaliste | D25 |
| Périmètre et base légale Apollo validés par un juriste ; pays de prospection renseignés | Fondateur + `expert-conformite-rgpd` (veto) | D33, `05` Q1 à Q3 |
| CGU FR et EN avec clause de non-contournement, supervision des conversations, conservation probatoire ; politique de confidentialité nommant Brevo et Apollo | Fondateur + juriste — *`draft-2` validés le 2026-10-08 ; marqueurs `[…]` en attente de la société* | D29, A5, A10, R-1 |
| Trois sous-domaines d'envoi authentifiés (SPF, DKIM, DMARC) sur le compte Brevo de production | Fondateur + `integrateur` | `16` RG9, `CLAUDE.md` §14.3 |
| Comptes Brevo et Apollo au nom de la société ; contrats de sous-traitance signés | Fondateur | `CLAUDE.md` §14.3 |
| Textes de la landing relus ; revue visuelle du budget d'effets | `expert-marketing` + `expert-conformite-rgpd` ; `expert-ux` | D48, D59 |
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
| **2 — Profils, réseaux, badge** | D34, D61 (`07` Q15 et Q16), D24 instruite, `03` R-4 et R-5 | Migrations `0201` à `0207` : trois objets créateur, compartiments Storage privés ; création de `packages/domain` et `packages/ui` | **T1** (anonymisation sur la charge brute), T9, T14, TM5, TM11 |
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
| **J5** | **`jalons/j5-fiche.md` d'abord** (sections et lignes exactes) ; `05` §A à §E, §H, §L ; `17` §2.5, §2.6, §3 ; skill `design-system-influx` |
| **J6** | `02` §6 et §11 ; `05` §I ; `16` §H, §J, §M ; skills `lead-pipeline`, `brevo-campaign`, `apollo-lead-sync` |
| **J7** | `05` §F (RG54 à RG58), §J ; `16` §I et §M6 ; `17` §6 |
| **J8** | `05` §K ; `15` §C, §F ; `17b` §3.11 et §3.13 ; skill `backoffice-ops` |
| **J9** | `02` §13 et §20 ; `03` §6.5 ; `18` §5 et §10 « Lot 1 » |
