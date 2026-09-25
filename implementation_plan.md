# Plan d'implémentation découpé pour Agents IA : MVP INFLUX (Mode Mocké)

> [!NOTE]
> **Branche `demo` (2026-09-25).** Ce plan et la maquette qu'il décrit vivent désormais **uniquement
> sur la branche `demo`**. La branche `main` ne contient plus que la landing page et les
> spécifications : le produit réel y repart du Lot 0 de `docs/mvp/00-cadrage-mvp-v2.md`.
> **Ne jamais fusionner `demo` dans `main`.**

> **Principe de conception de ce plan :** Chaque phase ci-dessous est un **Ordre de Mission autonome pour agent IA**.
> Elle est calibrée pour limiter le contexte au strict minimum : l'agent ne charge que les 1 à 3 fichiers nécessaires, produit un ensemble restreint de modifications (1 à 3 fichiers), et valide son travail par une commande de test unitaire ou de typage dédiée avant de passer la main.

> [!WARNING]
> **Nature du projet — Maquette temporaire de démonstration (Proof of Concept) :**
> Cette implémentation est une **maquette temporaire** destinée à être présentée aux partenaires commerciaux et investisseurs. Elle ne constitue **en aucun cas le produit final**.
>
> **Vocations exclusives de cette maquette :**
>
> 1. **Démonstration de compétences** : Présenter une preuve tangible de savoir-faire technique et de conception de produit.
> 2. **Démonstration de valeur pour des non-techniciens** : Illustrer concrètement comment la plateforme booste les ventes en automatisant un maximum d'actions (qualification automatique, outbox de leads, mise en relation courtée, alertes SLA, pipeline commercial).
> 3. **Validation fonctionnelle préalable** : Valider les parcours utilisateurs et les flux métiers avant d'engager les développements d'infrastructure lourds.
>
> **Code jetable (décision du fondateur du 2026-09-24, D44 — `CLAUDE.md` §16) :**
> Tout ce code, **à l'exception de la landing page**, est **jetable**. Il ne sera **ni mis en production, ni repris, ni « branché »** sur Supabase, Brevo ou Apollo.io. Le produit réel sera écrit **à partir des spécifications de `docs/mvp/`**, en repartant du Lot 0 de `docs/mvp/00-cadrage-mvp-v2.md`. Les lots de ce plan sont ceux **de la maquette** : ils ne mesurent pas l'avancement du MVP.
>
> **Conséquence pour les agents :** en cas d'écart entre la maquette et une spécification, la spécification fait foi. Un écart ne se corrige dans la maquette que s'il fausse la vision présentée aux partenaires (voir la section « Écarts connus » en fin de document). La maquette ne contient **aucun secret réel** et **aucune donnée personnelle réelle**.

> [!IMPORTANT]
> **Règle absolue de mise à jour (Agents IA & Développeurs) :**
> Ce document est la feuille de route vivante du projet INFLUX.
> Tout agent IA ou contributeur travaillant sur le projet **DOIT obligatoirement mettre à jour ce fichier** lors de :
>
> 1. L'accomplissement d'une tâche (cocher `[x]`, passer le statut à `✅ Terminé` dans la fiche et dans le tableau).
> 2. Toute modification, ajout ou réorganisation de phase décidée avec le fondateur.
> 3. Tout arbitrage technique impactant les fichiers ou commandes de validation d'une mission.

> **État d'avancement de la maquette au 24/09/2026 :** **37 missions terminées sur 40** (Lots 0 à 5 terminés ✅) ; Lot 6 : 6.1, 6.2 et **6.4** à faire, **6.3 annulée** (code jetable, D44).
> ⚠️ **Avant toute démonstration hors du poste local, la mission 6.4 est obligatoire (D56).**
> Prochaine étape prioritaire : **Mission 6.1 (Suite de tests d'intégration E2E automatisée)**.

---

## Vue d'ensemble du séquençage (Micro-Phases)

**Progression globale :** Lots 0 à 5 terminés ✅

| Lot                          | Phase | Intitulé                                              | Cible principale          | Statut     |
| ---------------------------- | ----- | ----------------------------------------------------- | ------------------------- | ---------- |
| **0. Socle & Mocks**         | `0.1` | Contrats partagés & Schémas Zod fondamentaux          | `packages/contracts`      | ✅ Terminé |
|                              | `0.2` | Store en mémoire singleton & persistance mock         | `apps/api`                | ✅ Terminé |
|                              | `0.3` | Serveur Fastify 5 & Routes de contrôle dev            | `apps/api`                | ✅ Terminé |
|                              | `0.4` | Jeu de données initial réaliste (Seed Data)           | `apps/api`                | ✅ Terminé |
|                              | `0.5` | DevToolbar & Sélecteur rapide de persona              | `apps/web`                | ✅ Terminé |
| **1. Auth & Leads**          | `1.1` | Auth OTP membre (code 6 chiffres e-mail)              | `apps/api`                | ✅ Terminé |
|                              | `1.2` | Auth Backoffice TOTP (mot de passe + TOTP)            | `apps/api`                | ✅ Terminé |
|                              | `1.3` | Outbox événementielle & workers mock Brevo/Apollo     | `apps/api`                | ✅ Terminé |
|                              | `1.4` | Écrans inscription & login membres bilingues          | `apps/web`                | ✅ Terminé |
|                              | `1.5` | Écran login Backoffice & supervision leads            | `apps/backoffice`         | ✅ Terminé |
| **2. Profils & Badge**       | `2.1` | Contrats & Service profil Marque                      | `apps/api`                | ✅ Terminé |
|                              | `2.2` | Écran de profil Marque                                | `apps/web`                | ✅ Terminé |
|                              | `2.3` | Contrats & Service profil Créateur (3 couches)        | `apps/api`                | ✅ Terminé |
|                              | `2.4` | Mock Storage Service (téléversement de preuves)       | `apps/api`                | ✅ Terminé |
|                              | `2.5` | Écran d'édition profil Créateur (Anonyme vs Privé)    | `apps/web`                | ✅ Terminé |
|                              | `2.6` | Service d'attribution et péremption de badge          | `apps/api`                | ✅ Terminé |
|                              | `2.7` | Écran Backoffice : file d'attribution des badges      | `apps/backoffice`         | ✅ Terminé |
| **3. Campagnes & Recherche** | `3.1` | Contrats & Service Campagnes Marque                   | `apps/api`                | ✅ Terminé |
|                              | `3.2` | File de modération commerciale des campagnes          | `apps/api` & `backoffice` | ✅ Terminé |
|                              | `3.3` | Écran Marque : création et suivi de campagne          | `apps/web`                | ✅ Terminé |
|                              | `3.4` | Moteur de recherche créateurs anonymisé (k-anonymat)  | `apps/api`                | ✅ Terminé |
|                              | `3.5` | Écran Marque : recherche créateurs & cartes anonymes  | `apps/web`                | ✅ Terminé |
|                              | `3.6` | Écran Backoffice : recherche créateurs identifiée     | `apps/backoffice`         | ✅ Terminé |
|                              | `3.7` | Écran Créateur : consultation des campagnes           | `apps/web`                | ✅ Terminé |
|                              | `3.8` | Écran Créateur : formulaire & modale de candidature   | `apps/web`                | ✅ Terminé |
| **4. Intermédiation & Chat** | `4.1` | Service des 3 Déclencheurs de mise en relation        | `apps/api`                | ✅ Terminé |
|                              | `4.2` | File de validation commerciale & verrou d'agent       | `apps/api` & `backoffice` | ✅ Terminé |
|                              | `4.3` | Transaction atomique de révélation d'identité         | `apps/api`                | ✅ Terminé |
|                              | `4.4` | Service messagerie à trois & détection de coordonnées | `apps/api`                | ✅ Terminé |
|                              | `4.5` | Journalisation des lectures agents externes           | `apps/api`                | ✅ Terminé |
|                              | `4.6` | Écran Membre : messagerie à trois (Marque/Créateur)   | `apps/web`                | ✅ Terminé |
|                              | `4.7` | Écran Backoffice : messagerie & proposition INFLUX    | `apps/backoffice`         | ✅ Terminé |
| **5. Pipeline & Backoffice** | `5.1` | Service pipeline commercial & encaissements           | `apps/api`                | ✅ Terminé |
|                              | `5.2` | Écran Backoffice : pipeline Kanban des affaires       | `apps/backoffice`         | ✅ Terminé |
|                              | `5.3` | Tableau de bord de pilotage & métriques SLA           | `apps/backoffice`         | ✅ Terminé |
|                              | `5.4` | Gabarit unifié des 16 files d'attente                 | `apps/backoffice`         | ✅ Terminé |
|                              | `5.5` | Outil d'envoi d'e-mails Brevo depuis backoffice       | `apps/api` & `backoffice` | ✅ Terminé |
| **6. Recette & Démo**        | `6.1` | Suite de tests d'intégration E2E automatisée          | `apps/api/tests`          | ⏳ À faire |
|                              | `6.2` | Scénarios de démonstration pré-configurés DevToolbar  | `apps/web`                | ⏳ À faire |
|                              | `6.3` | ~~Guide de transition vers Supabase / APIs réelles~~  | `docs`                    | ❌ Annulée (D44) |
|                              | `6.4` | Protection de l'URL de démonstration (D56)            | `apps/web` & `backoffice` | ⏳ À faire |

---

## Invariants & Règles absolues rappelés pour les agents

> [!IMPORTANT]
>
> 1. **Aucun calcul de commission automatique dans le code (A1 & A8)** : Le commercial saisit manuellement `negotiated_amount_minor` et `agreed_commission_minor`. Le code ne fait jamais de multiplication par 0.35 ou 0.20/0.15.
> 2. **Anonymisation stricte (A2 & D16)** : Les charges JSON renvoyées aux marques ne doivent JAMAIS contenir les noms réels, liens réseaux, `@` ou pseudos des créateurs tant que `identity_revealed_at` n'est pas posé.
> 3. **Intermédiation obligatoire (A3 & A9)** : Aucun membre ne peut contacter directement un autre membre. Tout passe par la file de validation ou la proposition INFLUX du commercial. La messagerie compte toujours 3 intervenants.

---

# Fiches de Mission détaillées par Phase

---

### LOT 0 : SOCLE & MOCKS `[✅ TERMINÉ]`

#### [x] Mission 0.1 : Contrats partagés & Schémas Zod fondamentaux `[✅ TERMINÉ]`

- **Rôle IA :** `backend-architect`
- **Contexte minimal à lire :** [CLAUDE.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/CLAUDE.md) §6, [pnpm-workspace.yaml](file:///c:/Users/cdurb/Documents/Workspaces/influx/pnpm-workspace.yaml)
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `pnpm-workspace.yaml` (ajouter `packages/*`)
  - `[NEW]` `packages/contracts/package.json`
  - `[NEW]` `packages/contracts/tsconfig.json`
  - `[NEW]` `packages/contracts/src/index.ts`
  - `[NEW]` `packages/contracts/src/account.ts` (Schémas `AccountRole`: `advertiser`, `creator`, `agent`, `admin`, et `Account`)
  - `[NEW]` `packages/contracts/src/common.ts` (Devises ISO 4217, montants en centimes `minor`, langues FR/EN)
- **Spécification :** Créer le package `@influx/contracts` avec les schémas Zod de base. Exporter les types inférés TypeScript.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/contracts build || pnpm --filter @influx/contracts typecheck
  ```

---

#### [x] Mission 0.2 : Store en mémoire singleton & persistance mock `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** `packages/contracts/src/index.ts`
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/package.json`
  - `[NEW]` `apps/api/tsconfig.json`
  - `[NEW]` `apps/api/src/mocks/mock-store.ts`
- **Spécification :**
  - Créer la classe `MockStore` qui stocke en mémoire des maps typées pour chaque entité : `accounts`, `profiles`, `campaigns`, `introductions`, `conversations`, `messages`, `deals`, `audit_events`.
  - Fournir des méthodes utilitaires : `reset()`, `dump()`, `load(data)`.
  - Ajouter un test unitaire vérifiant l'insertion, la lecture et la réinitialisation.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/mock-store.test.ts
  ```

---

#### [x] Mission 0.3 : Serveur Fastify 5 & Routes de contrôle dev `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** `apps/api/src/mocks/mock-store.ts`
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/server.ts`
  - `[NEW]` `apps/api/src/routes/dev-routes.ts`
  - `[NEW]` `apps/api/tests/dev-routes.test.ts`
- **Spécification :**
  - Configurer Fastify 5 avec `fastify-cors` (autoriser localhost:3000 et 3001) et `fastify-cookie`.
  - Exposer `GET /api/dev/state` (renvoie l'état complet du mock store) et `POST /api/dev/reset` (réinitialise le store).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/dev-routes.test.ts
  ```

---

#### [x] Mission 0.4 : Jeu de données initial réaliste (Seed Data) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** `apps/api/src/mocks/mock-store.ts`
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/mocks/seed-data.ts`
- **Spécification :**
  - Générer un jeu de données initial cohérent :
    - 2 marques : _Maison Solène_ (`advertiser-1`), _TechGear France_ (`advertiser-2`)
    - 3 créateurs : _Lucas Tech_ (anonyme: `creator-1`, badge Niveau 1 vérifié), _Sophie Mode_ (`creator-2`, non vérifié), _Maxime Voyage_ (`creator-3`)
    - 1 commercial : _Alexandre INFLUX_ (`agent-1`)
    - 1 admin : _Sarah Admin_ (`admin-1`)
  - La méthode `MockStore.reset()` charge automatiquement ce seed au démarrage.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/seed-data.test.ts
  ```

---

#### [x] Mission 0.5 : DevToolbar & Sélecteur rapide de persona `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [apps/web/src/styles/tokens.css](file:///c:/Users/cdurb/Documents/Workspaces/influx/apps/web/src/styles/tokens.css)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/components/dev/DevToolbar.tsx`
  - `[MODIFY]` `apps/web/src/app/[locale]/layout.tsx` (inclure `DevToolbar` en environnement non-production)
- **Spécification :**
  - Barre discrète flottante en bas de l'écran affichant :
    - Le rôle et nom de l'utilisateur actif actuel (ou "Visiteur anonyme").
    - Un menu déroulant pour basculer instantanément entre les comptes du seed (`advertiser-1`, `creator-1`, `agent-1`, etc.) en mettant à jour le cookie/state de session.
    - Un bouton `[Reset Mock Data]` appelant `POST /api/dev/reset`.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

### LOT 1 : AUTHENTIFICATION SANS MOT DE PASSE & LEADS OUTBOX `[✅ TERMINÉ]`

#### [x] Mission 1.1 : Auth OTP membre (code 6 chiffres e-mail) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** `packages/contracts/src/account.ts`, [docs/mvp/02-architecture-3-espaces.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/02-architecture-3-espaces.md) §D37
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/auth.ts`
  - `[NEW]` `apps/api/src/services/auth-service.ts`
  - `[NEW]` `apps/api/src/routes/auth-routes.ts`
  - `[NEW]` `apps/api/tests/auth-otp.test.ts`
- **Spécification :**
  - `POST /api/auth/otp/send` : Reçoit email + rôle (`advertiser` | `creator`). Génère un code à 6 chiffres (par défaut `123456` en mock) et le stocke avec expiration à 10 min.
  - `POST /api/auth/otp/verify` : Vérifie le code. Si valide, renvoie le token de session et pose le cookie `influx_session`. Enregistre la version de CGU acceptée.
  - `GET /api/auth/me` : Renvoie l'utilisateur connecté depuis le cookie de session.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/auth-otp.test.ts
  ```

---

#### [x] Mission 1.2 : Auth Backoffice TOTP (mot de passe + TOTP) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** `apps/api/src/routes/auth-routes.ts`
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/api/src/services/auth-service.ts`
  - `[MODIFY]` `apps/api/src/routes/auth-routes.ts`
  - `[NEW]` `apps/api/tests/auth-backoffice.test.ts`
- **Spécification :**
  - `POST /api/auth/backoffice/login` : Reçoit email, mot de passe et code TOTP (code mocké statique `000000` ou `123456`).
  - Vérifie que le compte possède le rôle `agent` ou `admin`.
  - Émet une session avec privilège backoffice.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/auth-backoffice.test.ts
  ```

---

#### [x] Mission 1.3 : Outbox événementielle & workers mock Brevo/Apollo `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [CLAUDE.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/CLAUDE.md) §8, [docs/mvp/00-cadrage-mvp-v2.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/00-cadrage-mvp-v2.md) §A7
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/services/lead-outbox-service.ts`
  - `[NEW]` `apps/api/src/routes/lead-routes.ts`
  - `[NEW]` `apps/api/tests/lead-outbox.test.ts`
- **Spécification :**
  - À chaque inscription, création d'une entrée `outbox_events` (`lead.created`).
  - Un worker simulé traite la file :
    - Brevo : crée le contact mocké avec liste de segmentation (langue, rôle).
    - Apollo : pour les annonceurs, simule l'enrichissement B2B.
  - Exposer `GET /api/backoffice/leads` et `POST /api/backoffice/leads/:id/replay`.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/lead-outbox.test.ts
  ```

---

#### [x] Mission 1.4 : Écrans inscription & login membres bilingues `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [apps/web/src/app/[locale]/login/page.tsx](file:///c:/Users/cdurb/Documents/Workspaces/influx/apps/web/src/app/[locale]/login/page.tsx), [apps/web/src/app/[locale]/signup/advertiser/page.tsx](file:///c:/Users/cdurb/Documents/Workspaces/influx/apps/web/src/app/[locale]/signup/advertiser/page.tsx)
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/web/src/app/[locale]/login/page.tsx`
  - `[MODIFY]` `apps/web/src/app/[locale]/signup/advertiser/page.tsx`
  - `[MODIFY]` `apps/web/src/app/[locale]/signup/creator/page.tsx`
  - `[NEW]` `apps/web/src/components/auth/OtpCodeInput.tsx`
- **Spécification :**
  - Brancher le formulaire sur `POST /api/auth/otp/send`.
  - Afficher l'écran de saisie du code à 6 chiffres avec bouton dev "Auto-remplir le code mock (123456)".
  - À la validation (`POST /api/auth/otp/verify`), rediriger vers le bon espace (`/advertiser/profile` ou `/creator/profile`).
  - Case à cocher d'acceptation des CGU (non pré-cochée) obligatoire.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 1.5 : Écran login Backoffice & supervision leads `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [CLAUDE.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/CLAUDE.md) §4.3
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/backoffice/package.json`
  - `[NEW]` `apps/backoffice/tsconfig.json`
  - `[NEW]` `apps/backoffice/src/app/login/page.tsx`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/leads/page.tsx`
- **Spécification :**
  - Formulaire de connexion sécurisée (Email, Password, Code TOTP).
  - Écran de supervision des leads (`/leads`) : tableau affichant les inscrits récents, les statuts de synchro Brevo et Apollo (`synced`, `failed`, `pending`), et un bouton pour relancer un échec.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice build || pnpm --filter @influx/backoffice typecheck
  ```

---

### LOT 2 : PROFILS, PREUVES & BADGE VÉRIFIÉ `[✅ TERMINÉ]`

#### [x] Mission 2.1 : Contrats & Service profil Marque `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/06-criteres-profil-marque.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/06-criteres-profil-marque.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/brand-profile.ts`
  - `[NEW]` `apps/api/src/services/brand-profile-service.ts`
  - `[NEW]` `apps/api/src/routes/brand-profile-routes.ts`
  - `[NEW]` `apps/api/tests/brand-profile.test.ts`
- **Spécification :**
  - Schéma du profil marque : nom d'entreprise, secteur d'activité, site web, budget indicatif, nom et email de contact (qui seront masqués pour les créateurs).
  - Endpoints `GET /api/profiles/brand/me` et `PUT /api/profiles/brand/me`.
  - Calcul automatique du pourcentage de complétude du profil.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/brand-profile.test.ts
  ```

---

#### [x] Mission 2.2 : Écran de profil Marque `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [apps/web/src/styles/tokens.css](file:///c:/Users/cdurb/Documents/Workspaces/influx/apps/web/src/styles/tokens.css)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/advertiser/profile/page.tsx`
  - `[NEW]` `apps/web/src/components/brand/BrandProfileForm.tsx`
- **Spécification :**
  - Formulaire d'édition du profil entreprise avec jauge de complétude visuelle (0-100%).
  - Mention explicite à côté des champs de contact : "Ces coordonnées resteront masquées jusqu'à la mise en relation validée par un commercial".
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 2.3 : Contrats & Service profil Créateur (3 couches) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/07-criteres-profil-createur-reseaux-audience.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/07-criteres-profil-createur-reseaux-audience.md) §RG16 à RG20
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/creator-profile.ts`
  - `[NEW]` `apps/api/src/services/creator-profile-service.ts`
  - `[NEW]` `apps/api/src/routes/creator-profile-routes.ts`
  - `[NEW]` `apps/api/tests/creator-profile.test.ts`
- **Spécification :**
  - Séparation stricte des schémas :
    - `CreatorPublicProfile` (Anonyme) : Thématiques, formats, réseaux (sans lien), tranches d'audience (`10k-50k`, etc.), tranches de prix par format, portfolio d'images anonymisées.
    - `CreatorIdentifiedProfile` (Privé) : `@`, liens de profils sociaux, nom/prénom légal.
  - Endpoints `GET /api/profiles/creator/me` et `PUT /api/profiles/creator/me`.
  - Endpoint public `GET /api/creators/:id/anonymous` qui filtre impérativement tous les champs identifiants.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/creator-profile.test.ts
  ```

---

#### [x] Mission 2.4 : Mock Storage Service (téléversement de preuves) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/02-architecture-3-espaces.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/02-architecture-3-espaces.md) §2.4 (E1)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/services/storage-service.ts`
  - `[NEW]` `apps/api/src/routes/storage-routes.ts`
  - `[NEW]` `apps/api/tests/storage.test.ts`
- **Spécification :**
  - `POST /api/storage/signed-upload-url` : Reçoit le nom de fichier, le compartiment (`portfolio` ou `verification`), génère une URL signée simulée.
  - `PUT /api/storage/upload/:fileId` : Simule l'upload de fichier en mémoire/data URL et renvoie l'URL publique de consultation.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/storage.test.ts
  ```

---

#### [x] Mission 2.5 : Écran d'édition profil Créateur (Anonyme vs Privé) `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17-parcours-et-ecrans-espaces-membres.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17-parcours-et-ecrans-espaces-membres.md) §1.1
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/creator/profile/page.tsx`
  - `[NEW]` `apps/web/src/components/creator/CreatorProfileEditor.tsx`
  - `[NEW]` `apps/web/src/components/creator/RateCardEditor.tsx`
- **Spécification :**
  - Formulaire mobile-friendly à onglets :
    - Onglet 1 : "Vue Publique Anonyme" (Thématiques, Formats, Tranches d'audience, Tarifs indicatifs, Portfolio).
    - Onglet 2 : "Coordonnées Privées" (Liens de réseaux, Pseudos, Contacts).
  - Prévisualisation de la "Carte Anonyme" telle qu'elle sera vue par les marques.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 2.6 : Service d'attribution et péremption de badge `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/08-verification-et-badge.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/08-verification-et-badge.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/verification.ts`
  - `[NEW]` `apps/api/src/services/verification-service.ts`
  - `[NEW]` `apps/api/src/routes/verification-routes.ts`
  - `[NEW]` `apps/api/tests/verification.test.ts`
- **Spécification :**
  - `POST /api/verification/request` : Créateur soumet ses justificatifs de statistiques.
  - `GET /api/backoffice/queues/verification` : File des demandes pour l'agent.
  - `POST /api/backoffice/verification/:id/decide` : Décision agent (Badge Niveau 1 ou 2, calcul de `expires_at = now() + 90 jours`, ou motif de rejet typé).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/verification.test.ts
  ```

---

#### [x] Mission 2.7 : Écran Backoffice : file d'attribution des badges `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17b-parcours-et-ecrans-backoffice.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17b-parcours-et-ecrans-backoffice.md) §1.3
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/queues/verification/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/verification/VerificationDecisionDrawer.tsx`
- **Spécification :**
  - Tableau des demandes de badges avec indicateur d'ancienneté.
  - Tiroir latéral de décision affichant la capture d'écran de preuve, avec boutons : `[Valider Badge Niveau 1 (90j)]`, `[Valider Badge Niveau 2 (90j)]` et `[Refuser]` avec sélecteur de motif de rejet.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice typecheck
  ```

---

### LOT 3 : CAMPAGNES & RECHERCHE ANONYMISÉE `[✅ TERMINÉ]`

#### [x] Mission 3.1 : Contrats & Service Campagnes Marque `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/09-criteres-campagne.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/09-criteres-campagne.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/campaign.ts`
  - `[NEW]` `apps/api/src/services/campaign-service.ts`
  - `[NEW]` `apps/api/src/routes/campaign-routes.ts`
  - `[NEW]` `apps/api/tests/campaign.test.ts`
- **Spécification :**
  - Schéma campagne : titre, description du brief, livrables attendus, tranches de budget (`budget_band`), dates de début/fin, ciblage démographique. Statut initial `submitted`.
  - Endpoints `POST /api/campaigns` et `GET /api/campaigns/my`.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/campaign.test.ts
  ```

---

#### [x] Mission 3.2 : File de modération commerciale des campagnes `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev` & `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/09-criteres-campagne.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/09-criteres-campagne.md) §RG60 à RG70
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/api/src/routes/campaign-routes.ts`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/queues/campaigns/page.tsx`
- **Spécification :**
  - `POST /api/backoffice/campaigns/:id/moderate` : Statut `published` ou `rejected` avec motif typé.
  - Écran backoffice de modération des campagnes avec aperçu du brief et panneau de décision.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/campaign.test.ts && pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 3.3 : Écran Marque : création et suivi de campagne `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17-parcours-et-ecrans-espaces-membres.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17-parcours-et-ecrans-espaces-membres.md) §1.1 (Marque)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/advertiser/campaigns/page.tsx`
  - `[NEW]` `apps/web/src/app/[locale]/advertiser/campaigns/new/page.tsx`
  - `[NEW]` `apps/web/src/components/campaign/CampaignForm.tsx`
- **Spécification :**
  - Formulaire de création de brief avec sélection de livrables et tranches budgétaires.
  - Liste des campagnes créées avec badge de statut (`En attente de validation commerciale`, `Publiée`).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 3.4 : Moteur de recherche créateurs anonymisé (k-anonymat) `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/10-recherche-createurs-anonymisee.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/10-recherche-createurs-anonymisee.md) §RG40 à RG60
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/search.ts`
  - `[NEW]` `apps/api/src/services/search-service.ts`
  - `[NEW]` `apps/api/src/routes/search-routes.ts`
  - `[NEW]` `apps/api/tests/search-anonymized.test.ts`
- **Spécification :**
  - `GET /api/search/creators` :
    - Filtres : thématiques, tranches d'audience, formats, tranche de prix, badge vérifié.
    - Anonymisation : les profils renvoyés ont pour titre `Créateur Tech #ID`, aucune URL ni pseudo.
    - k-anonymat : l'API renvoie une tranche approximative de résultats si le volume est faible.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/search-anonymized.test.ts
  ```

---

#### [x] Mission 3.5 : Écran Marque : recherche créateurs & cartes anonymes `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/10-recherche-createurs-anonymisee.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/10-recherche-createurs-anonymisee.md) §H
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/advertiser/creators/page.tsx`
  - `[NEW]` `apps/web/src/components/search/AnonymizedCreatorCard.tsx`
  - `[NEW]` `apps/web/src/components/search/SearchFacetSidebar.tsx`
- **Spécification :**
  - Page de recherche avec barre latérale de facettes (tranches d'abonnés, budget, plateformes).
  - Cartes de profil anonymisées avec badge "Vérifié 90j" daté et portfolio modéré.
  - Bouton `[Demander une mise en relation]` ouvrant la modale de contact (avec mention SLA 1 jour ouvré).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 3.6 : Écran Backoffice : recherche créateurs identifiée `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17b-parcours-et-ecrans-backoffice.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17b-parcours-et-ecrans-backoffice.md) §1.2 (Rail 4)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/creators/search/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/creators/IdentifiedCreatorTable.tsx`
- **Spécification :**
  - Recherche en **vue identifiée** (vrais noms, `@`, liens, téléphones visibles pour le commercial).
  - Case à cocher sur chaque ligne pour sélection multiple de créateurs.
  - Barre d'action supérieure avec bouton `[Faire une Proposition INFLUX]` (activé dès qu'au moins 1 créateur est coché).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 3.7 : Écran Créateur : consultation des campagnes `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/11-recherche-campagnes-et-candidature.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/11-recherche-campagnes-et-candidature.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/creator/campaigns/page.tsx`
  - `[NEW]` `apps/web/src/app/[locale]/creator/campaigns/[id]/page.tsx`
  - `[NEW]` `apps/web/src/components/creator-campaigns/CampaignFeed.tsx`
  - `[NEW]` `apps/web/src/components/creator-campaigns/CampaignFeedCard.tsx`
  - `[NEW]` `apps/web/src/components/creator-campaigns/CampaignDetailView.tsx`
- **Spécification :**
  - Fil des campagnes ouvertes compatibles avec les thématiques et critères du créateur.
  - Page détaillée de consultation du brief complet, avec livrables, calendrier et avertissements.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 3.8 : Écran Créateur : formulaire & modale de candidature `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/11-recherche-campagnes-et-candidature.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/11-recherche-campagnes-et-candidature.md) §E, §RG45 à RG58, et [docs/mvp/01-intermediation-courtee.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/01-intermediation-courtee.md) §4 (Déclencheur 2)
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/web/src/components/creator-campaigns/creator-campaign-labels.ts`
  - `[NEW]` `apps/web/src/components/creator-campaigns/ApplicationModal.tsx`
  - `[MODIFY]` `apps/web/src/components/creator-campaigns/CampaignDetailView.tsx`
- **Spécification :**
  - Modale interactive de candidature créateur accessible depuis la vue détaillée d'une campagne.
  - Sélection des formats proposés (cases à cocher issues de `campaign.deliverables`).
  - Saisie de la note de motivation & proposition éditoriale (10 à 2 000 caractères, compteur en direct).
  - Avertissement d'intermédiation & anti-contournement (Arbitrage A9).
  - Case à cocher obligatoire d'acceptation des conditions d'intermédiation (`termsAccepted = true`).
  - Soumission vers `POST /api/introductions/creator-apply` avec gestion du chargement, des erreurs et écran de confirmation avec référence `MER-2026-XXXXXX` et rappel SLA 1 jour ouvré.
  - Détection automatique au montage de la campagne si le créateur a déjà postulé (`GET /api/introductions/my`) et bascule de l'interface en mode « Candidature déjà déposée ».
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

### LOT 4 : INTERMÉDIATION COURTÉE & MESSAGERIE À TROIS `[✅ TERMINÉ]`

#### [x] Mission 4.1 : Service des 3 Déclencheurs de mise en relation `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/01-intermediation-courtee.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/01-intermediation-courtee.md) §4
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/introduction.ts`
  - `[NEW]` `apps/api/src/services/introduction-service.ts`
  - `[NEW]` `apps/api/src/routes/introduction-routes.ts`
  - `[NEW]` `apps/api/tests/introduction-triggers.test.ts`
- **Spécification :**
  - Déclencheur 1 (Marque) : `POST /api/introductions/brand-request` -> entre en file `pending_review`.
  - Déclencheur 2 (Créateur) : `POST /api/introductions/creator-apply` -> entre en file `pending_review`.
  - Déclencheur 3 (Commercial) : `POST /api/backoffice/introductions/propose` -> court-circuite la file et passe directement en proposition active.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/introduction-triggers.test.ts
  ```

---

#### [x] Mission 4.2 : File de validation commerciale & verrou d'agent `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev` & `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/13-file-de-validation-et-mise-en-relation.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/13-file-de-validation-et-mise-en-relation.md)
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/api/src/services/introduction-service.ts`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/queues/introductions/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/introductions/IntroductionDecisionDrawer.tsx`
- **Spécification :**
  - Gestion du verrou : `POST /api/backoffice/introductions/:id/claim` (attribue `claimed_by_agent_id` pour empêcher le double-traitement).
  - Décision : `POST /api/backoffice/introductions/:id/decide` (`approved` ou `rejected` avec motif obligatoire).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/introduction-triggers.test.ts && pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 4.3 : Transaction atomique de révélation d'identité `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/01-intermediation-courtee.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/01-intermediation-courtee.md) §3 étape 5, [docs/mvp/02-architecture-3-espaces.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/02-architecture-3-espaces.md) §2.2
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/services/reveal-service.ts`
  - `[MODIFY]` `apps/api/src/services/introduction-service.ts`
  - `[MODIFY]` `apps/api/src/routes/introduction-routes.ts`
  - `[NEW]` `apps/api/tests/reveal-identity.test.ts`
- **Spécification :**
  - Méthode atomique `revealIdentity(introductionId)` exécutée dès l'approbation et le consentement bilatéral :
    1. Fige `identity_revealed_at = now()` (contrainte write-once absolue).
    2. Crée la conversation avec les 3 participants (Marque, Créateur, Commercial responsable) et le message d'ouverture.
    3. Crée automatiquement le deal commercial associé à l'état initial `open` (montants à `null` pour saisie manuelle sans commission auto A1/A8).
    4. Enregistre l'événement d'audit chaîné `identity_revealed`.
    5. Émet les 2 e-mails transactionnels aux deux parties via l'outbox avec conservation du `messageId`.
  - Endpoints `POST /api/introductions/:id/accept` et `POST /api/introductions/:id/decline`.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/reveal-identity.test.ts
  ```

---

#### [x] Mission 4.4 : Service messagerie à trois & détection de coordonnées `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/12-messagerie-a-trois.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/12-messagerie-a-trois.md) §RG40 à RG50
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/messaging.ts`
  - `[MODIFY]` `packages/contracts/src/index.ts`
  - `[MODIFY]` `apps/api/src/mocks/mock-store.ts`
  - `[NEW]` `apps/api/src/services/messaging-service.ts`
  - `[NEW]` `apps/api/src/routes/messaging-routes.ts`
  - `[MODIFY]` `apps/api/src/server.ts`
  - `[NEW]` `apps/api/tests/messaging.test.ts`
- **Spécification :**
  - `POST /api/conversations/:id/messages` : Envoi de message texte uniquement (1 à 10 000 caractères, pas de pièces jointes libres RG35, RG36).
  - Transition automatique `ouverte -> active` au premier message (RG16).
  - Avancement du curseur de lecture (`lastReadMessageId`, `lastReadAt`) lors de l'envoi et de la consultation (RG51, RG52).
  - Pré-contrôle non bloquant avant envoi (`POST /api/conversations/:id/messages/check`) sans stockage en base (RG42, RG43, RG44).
  - Analyse regex anti-contournement (e-mail, téléphone, messageries tierces, réseaux sociaux, IBAN, URL). Si détecté, crée un enregistrement d'alerte `contact_detections` sans bloquer ni altérer l'envoi (RG45, RG46, RG48).
  - Contrôle d'état : blocage de l'écriture en pause pour les membres avec maintien de l'écriture pour le commercial (RG18), blocage complet si clos ou archivé (RG20, RG39).
  - Consultation des détections pour le commercial (`GET /api/backoffice/conversations/:id/detections`) (RG50).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/messaging.test.ts
  ```

---

#### [x] Mission 4.5 : Journalisation des lectures agents externes `[✅ TERMINÉ]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/12-messagerie-a-trois.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/12-messagerie-a-trois.md) §RG55 à RG60
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `packages/contracts/src/messaging.ts`
  - `[MODIFY]` `apps/api/src/mocks/mock-store.ts`
  - `[MODIFY]` `apps/api/src/services/messaging-service.ts`
  - `[MODIFY]` `apps/api/src/routes/messaging-routes.ts`
  - `[NEW]` `apps/api/tests/conversation-audit.test.ts`
- **Spécification :**
  - Toute lecture d'une conversation par un rôle `agent` ou `admin` est obligatoirement journalisée dans `conversation_access_logs` (RG55).
  - Pour l'agent participant assigné, le motif `suivi_de_l_affaire` est retenu automatiquement sans friction (RG56).
  - Pour un agent externe (non assigné), la requête exige un motif typé préalable (`continuite_de_service`, `reprise_de_dossier`, `instruction_signalement`, `litige_ou_contestation`, `controle_qualite`, `demande_rgpd`, `autre`) avant de renvoyer le moindre message (rejet 400 `REASON_REQUIRED` sinon) (RG57).
  - Si motif `autre`, commentaire explicatif obligatoire d'au moins 5 caractères (RG56).
  - Le journal enregistre `who`, `when`, `conversationId`, `reason`, `sourceScreen`, `messagesCount` et **ne stocke JAMAIS le contenu des messages** (RG58).
  - Endpoints de consultation du registre (`GET /api/backoffice/conversations/access-logs`) : un agent ne voit que ses propres lectures, l'administrateur voit tout, accès refusé aux membres (403) (RG59).
  - Alerte d'accès anormal enregistrée dans l'audit si un agent dépasse 40 conversations distinctes en 24h (RG61).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/conversation-audit.test.ts
  ```

---

#### [x] Mission 4.6 : Écran Membre : messagerie à trois (Marque/Créateur) `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17-parcours-et-ecrans-espaces-membres.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17-parcours-et-ecrans-espaces-membres.md) §4
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/web/src/app/[locale]/advertiser/messages/page.tsx`
  - `[NEW]` `apps/web/src/app/[locale]/creator/messages/page.tsx`
  - `[NEW]` `apps/web/src/components/chat/ThreeWayChatWindow.tsx`
- **Spécification :**
  - Fenêtre de messagerie avec en-tête mentionnant les 3 participants, notamment le badge du commercial nommé (`Alexandre - Commercial INFLUX`).
  - Fil de discussion avec messages différenciés par expéditeur et avertissement de supervision.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [x] Mission 4.7 : Écran Backoffice : messagerie & proposition INFLUX `[✅ TERMINÉ]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17b-parcours-et-ecrans-backoffice.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17b-parcours-et-ecrans-backoffice.md) §3
- **Fichiers modifiés / créés :**
  - `[MODIFY]` `apps/api/src/services/messaging-service.ts` (actions backoffice pause, reprise, clôture, qualification détection)
  - `[MODIFY]` `apps/api/src/routes/messaging-routes.ts` (routes backoffice conversations & détections)
  - `[NEW]` `apps/backoffice/src/components/introductions/InfluxProposalModal.tsx`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/messages/page.tsx`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/messages/[id]/page.tsx`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/messages/[id]/BackofficeConversationClient.tsx`
  - `[MODIFY]` `apps/backoffice/src/components/introductions/IntroductionDecisionDrawer.tsx`
  - `[MODIFY]` `apps/backoffice/src/app/(dashboard)/layout.tsx`
- **Spécification :**
  - Interface de réponse directe pour le commercial depuis son backoffice (`/messages/[id]`).
  - Passerelle réglementaire (Gate) de justification obligatoire pour les agents non-assignés (RG56, RG57).
  - Fil à trois interlocuteurs conforme à 17b §3.4.b (Marque à gauche, Créateur à droite, Agent INFLUX au centre avec badge `⬥ visible des deux parties`).
  - Contrôles du cycle de vie de la conversation : Mise en pause (RG17, RG18), Reprise (RG19), Clôture définitive avec motifs typés (RG20).
  - Détection et qualification d'alertes de coordonnées (RG50).
  - Modale "Proposition INFLUX" accessible en backoffice (`InfluxProposalModal.tsx`).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice typecheck && pnpm --filter @influx/api test
  ```

---

### LOT 5 : PIPELINE COMMERCIAL & GESTION BACKOFFICE `[✅ TERMINÉ]`

#### [x] Mission 5.1 : Service pipeline commercial & encaissements `[✅ Terminé]`

- **Rôle IA :** `backend-dev`
- **Contexte minimal à lire :** [docs/mvp/14-pipeline-commercial.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/14-pipeline-commercial.md) §E1 à E11
- **Fichiers à modifier / créer :**
  - `[NEW]` `packages/contracts/src/deal.ts`
  - `[NEW]` `apps/api/src/services/deal-service.ts`
  - `[NEW]` `apps/api/src/routes/deal-routes.ts`
  - `[NEW]` `apps/api/tests/deal-pipeline.test.ts`
- **Spécification :**
  - Modèle `Deal` : `status` (`open`, `negotiating`, `contract_sent`, `signed`, `paid`, `lost`, `cancelled`).
  - Saisie commerciale manuelle (aucun calcul automatique !) :
    - `negotiated_amount_minor`, `agreed_commission_minor`, `currency`.
    - Mode d'envoi du contrat (`email`, `docusign`, `in_person`).
  - `POST /api/backoffice/deals/:id/receipts` : Enregistrement des encaissements (`commission_receipts` : montant, payeur `advertiser` ou `creator`, date de réception).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/deal-pipeline.test.ts
  ```

---

#### [x] Mission 5.2 : Écran Backoffice : pipeline Kanban des affaires `[✅ Terminé]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17b-parcours-et-ecrans-backoffice.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17b-parcours-et-ecrans-backoffice.md) §1.2 (Rail 5)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/deals/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/deals/DealKanbanBoard.tsx`
  - `[NEW]` `apps/backoffice/src/components/deals/DealDetailDrawer.tsx`
- **Spécification :**
  - Tableau Kanban par statut avec totaux par colonne.
  - Tiroir latéral d'édition de l'affaire : champs de saisie des montants négociés/commission convenue, et formulaire d'enregistrement des encaissements réels.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 5.3 : Tableau de bord de pilotage & métriques SLA `[✅ Terminé]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/15-backoffice-files-et-supervision.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/15-backoffice-files-et-supervision.md) §Tableau de bord
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/services/dashboard-service.ts`
  - `[NEW]` `apps/api/src/routes/dashboard-routes.ts`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/dashboard/KpiCards.tsx`
- **Spécification :**
  - API & Écran d'accueil du backoffice :
    - Montant total des commissions encaissées (par devise, ex. `3 200,00 EUR`).
    - Nombre d'affaires actives par commercial.
    - Alertes de délais SLA de validation (demandes en attente depuis > 1 jour ouvré).
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/dashboard.test.ts && pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 5.4 : Gabarit unifié des 16 files d'attente `[✅ Terminé]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/17b-parcours-et-ecrans-backoffice.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/17b-parcours-et-ecrans-backoffice.md) §1.3
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/queues/page.tsx`
  - `[NEW]` `apps/backoffice/src/components/queues/UnifiedQueueTemplate.tsx`
- **Spécification :**
  - Page regroupant les 16 files en 5 groupes fonctionnels (Entrées, Validations, Modération, etc.).
  - Composant réutilisable affichant le nombre en attente, l'ancienneté de la plus vieille demande, et l'alerte visuelle si hors délai SLA.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/backoffice typecheck
  ```

---

#### [x] Mission 5.5 : Outil d'envoi d'e-mails Brevo depuis backoffice `[✅ Terminé]`

- **Rôle IA :** `backend-dev` & `frontend-dev`
- **Contexte minimal à lire :** [docs/mvp/16-backoffice-emails-brevo.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/16-backoffice-emails-brevo.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/src/services/brevo-campaign-service.ts`
  - `[NEW]` `apps/api/src/routes/brevo-campaign-routes.ts`
  - `[NEW]` `apps/backoffice/src/app/(dashboard)/emails/page.tsx`
- **Spécification :**
  - Sélecteur de template d'e-mail validé.
  - Choix de l'audience parmi 3 sources encadrées (Contacts plateforme consentants, Segments Brevo prédéfinis, Saisie unitaire libre).
  - Déclenchement de l'envoi simulé avec délai de grâce d'annulation de 15 minutes.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/brevo-campaign.test.ts && pnpm --filter @influx/backoffice typecheck
  ```

---

### LOT 6 : RECETTE & DÉMONSTRATION `[⏳ À FAIRE]`

#### [ ] Mission 6.1 : Suite de tests d'intégration E2E automatisée `[⏳ À FAIRE]`

- **Rôle IA :** `qa-engineer`
- **Contexte minimal à lire :** [docs/mvp/18-plan-de-test-mvp.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/docs/mvp/18-plan-de-test-mvp.md)
- **Fichiers à modifier / créer :**
  - `[NEW]` `apps/api/tests/e2e-mvp-journey.test.ts`
- **Spécification :**
  - Écrire un test automatisé d'intégration exécutant en séquence pure :
    1. Inscription d'une marque -> Outbox lead créée.
    2. Inscription d'un créateur -> Demande de badge -> Approbation badge à 90j.
    3. Création d'une campagne par la marque -> Validation backoffice.
    4. Recherche anonymisée par la marque -> Demande de mise en relation.
    5. Approbation par le commercial -> Révélation d'identité atomique -> Vérification de la création de la conversation à 3 et du deal.
    6. Échange de messages dans la conversation.
    7. Clôture de l'affaire dans le pipeline -> Saisie du montant négocié et commission -> Enregistrement de l'encaissement -> Vérification du tableau de bord.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/api test tests/e2e-mvp-journey.test.ts
  ```

---

#### [ ] Mission 6.2 : Scénarios de démonstration pré-configurés DevToolbar `[⏳ À FAIRE]`

- **Rôle IA :** `frontend-dev`
- **Contexte minimal à lire :** `apps/web/src/components/dev/DevToolbar.tsx`
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/web/src/components/dev/DevToolbar.tsx`
  - `[NEW]` `apps/api/src/mocks/demo-scenarios.ts`
  - `[MODIFY]` `apps/api/src/routes/dev-routes.ts`
- **Spécification :**
  - Ajouter à la `DevToolbar` 3 boutons de chargement rapide de scénarios :
    - `[Scénario 1 : Nouveau Lead & Profils à valider]`
    - `[Scénario 2 : Négociation en cours dans le Chat]`
    - `[Scénario 3 : Affaire à signer et commission à encaisser]`
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck
  ```

---

#### [ ] ~~Mission 6.3 : Guide de transition vers Supabase / APIs réelles~~ `[❌ ANNULÉE le 2026-09-24]`

> **Annulée (D44).** Le code de la maquette est jetable : aucun service simulé ne sera remplacé par un
> service réel, et le produit réel repart des spécifications de `docs/mvp/`. Un guide de transition
> encouragerait exactement ce que D44 interdit. Fiche conservée pour mémoire.

- **Rôle IA :** `tech-lead`
- **Contexte minimal à lire :** [CLAUDE.md](file:///c:/Users/cdurb/Documents/Workspaces/influx/CLAUDE.md) §6
- **Fichiers à modifier / créer :**
  - `[NEW]` `docs/guide-developpement-mock.md`
- **Spécification :**
  - Rédiger le guide expliquant :
    - Comment démarrer le projet en mode mocké (`pnpm dev`).
    - Comment chaque dépôt de mock (`MockStore`) mappe directement avec le futur schéma PostgreSQL de Supabase.
    - La procédure pour remplacer unitairement un mock service par le client Drizzle ou Brevo réel sans impacter le frontend.
- **Commande de validation (DoD) :**
  - Vérification de la complétude du document et des liens fichiers.

---

#### [ ] Mission 6.4 : Protection de l'URL de démonstration `[⏳ À FAIRE]`

- **Rôle IA :** `frontend-dev` + `devops`
- **Décision :** D56, arbitrage du fondateur du 2026-09-24 (`CLAUDE.md` §13 et §16.2).
- **Contexte minimal à lire :** `apps/web/src/proxy.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/backoffice/src/app/(dashboard)/layout.tsx`
- **Fichiers à modifier / créer :**
  - `[MODIFY]` `apps/web/src/proxy.ts` (contrôle d'accès de démonstration)
  - `[NEW]` équivalent dans `apps/backoffice` (proxy ou middleware Next.js)
  - `[MODIFY]` les deux layouts (bandeau)
  - `[MODIFY]` `.env.example` (variables `DEMO_MODE`, `DEMO_ACCESS_PASSWORD`, valeurs factices)
- **Spécification :**
  - Si `DEMO_MODE` est actif, **toute page** des deux fronts exige le mot de passe de démonstration (authentification HTTP de base ou écran de mot de passe), lu en variable d'environnement, **jamais écrit dans le code**.
  - **Bandeau permanent** « Démonstration — données fictives » (FR/EN) sur toutes les pages.
  - **Non indexé** : balise `robots` `noindex, nofollow` et en-tête `X-Robots-Tag` sur toutes les réponses.
  - `apps/api`, y compris ses routes `/api/dev/*`, est soumise au **même contrôle d'accès** que les fronts, ou n'est joignable qu'à travers eux.
  - Le déploiement de démonstration n'utilise **jamais** le nom de domaine de production.
- **Commande de validation (DoD) :**
  ```bash
  pnpm --filter @influx/web typecheck && pnpm --filter @influx/backoffice typecheck
  ```
  Puis vérification manuelle : sans mot de passe, aucune page ni aucune route `/api/dev/*` n'est accessible.

---

## Écarts connus entre la maquette et les spécifications

> Relevés le 2026-09-24 (`docs/mvp/19-revue-de-coherence-2026-09-24.md`). **La spécification fait
> foi.** Ces écarts ne sont pas à corriger pour la production (le code est jetable), mais **à
> connaître avant une démonstration** : ils ne doivent pas être présentés comme la vision du MVP.
> Ceux marqués ⚠️ faussent le discours et méritent une correction dans la maquette.

| # | Ce que montre la maquette | Ce que dit la spécification |
|---|---|---|
| ⚠️ E1 | La marque ou le créateur ne voient **aucun écran d'acceptation** de la mise en relation (l'API l'a) | **D45 (tranchée le 2026-09-24)** : révélation à la seconde acceptation ; `13` §F, « l'écran le plus sensible du produit » |
| ⚠️ E2 | **Apartés privés** commercial ↔ marque et commercial ↔ créateur, sans aucune mention aux parties | **D47 (tranchée le 2026-09-24)** : conservés **et annoncés** aux deux parties ; cadre en additif de `12`. La maquette doit afficher cette information |
| ⚠️ E3 | Badge global « Niveau 1 / Niveau 2 », 90 jours pour les deux, libellé « Vérifié 90j » | `08` : trois badges **par réseau** (« Compte vérifié » sans péremption, « Audience vérifiée » 90 jours, « Marque vérifiée » 12 mois), libellés soumis à D34 |
| E4 | Affaire en 7 états avec `paid` ; payeur `advertiser` / `creator` ; mode d'envoi sans `autre` ; vue Kanban | `14` RG9 : 8 états (`commission_invoiced`, `commission_received`) ; payeur `les_deux` / `autre` avec parts saisies ; « le pipeline se lit d'abord comme une liste » (RG65) |
| E5 | Annulation d'un envoi d'e-mails pendant **15 minutes** | **5 minutes** (`16` RG28, `15`, `17b`, `04`) |
| E6 | Apollo reçoit **les annonceurs seulement** | A7 : tous les inscrits, périmètre lu en configuration (`05` RG81, D33) |
| E7 | Palette « Dark Obsidian » propre au backoffice, couleurs WhatsApp dans la messagerie, environ 580 couleurs en dur | Tokens de `apps/web/src/styles/tokens.css` (D4, D6) ; toute nouvelle palette passe par le fondateur |
| ⚠️ E8 | « 35 % » et un net créateur estimé affichés (libellés, éditeur de tarifs, recherche) | **D48 (tranchée le 2026-09-24)** : aucun taux ni net estimé affiché pendant le pilote — « commission INFLUX incluse, précisée par votre commercial » |
| E9 | Seules 3 files sur 16 ont un écran de traitement (campagnes, mises en relation, vérification) ; ni signalement, ni blocage, ni espace « mes données » | `15` (16 files), `12` §G, `17` §6.3 |
| ⚠️ E10 | Codes de connexion fixes (`123456`, `000000`), sélecteur de persona, routes `/api/dev/*`, secret de session avec valeur de repli | Acceptable en local ; **D56 (tranchée le 2026-09-24)** : hors du poste, uniquement sur une URL protégée par mot de passe — mission 6.4 |

---

## Protocole de démarrage pour un Agent IA

Pour démarrer n'importe quelle micro-phase ci-dessus, l'instruction à donner à l'agent est simplement :

> « Exécute la **Mission X.Y** du document `implementation_plan.md`. Ne lis que les fichiers indiqués dans "Contexte minimal à lire", crée ou modifie uniquement les fichiers listés, et termine en exécutant la commande de validation de la mission. »
