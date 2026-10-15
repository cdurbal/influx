# Fiche J8 — Backoffice v0

> **Point d'entrée de toute session du J8.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives, ni les fiches J5 à J7. Les numéros de ligne
> datent du 2026-10-15 : s'ils ont glissé, `Grep` sur le titre de section.

## Objectif et critère de fin

Un commercial voit les inscrits et l'état de chaque destination, rejoue un échec, corrige un
compte ; un `admin` règle Apollo, invite un compte interne et un membre, et exécute une demande
« mes données » (porte de production). Sur `staging` : l'inscription par une invitation attribue le
commercial ; un rejeu ne crée aucun doublon ; une suppression va jusqu'à Brevo (`account.deleted`).

En parallèle, hors code (fondateur) : critères de fin J6 et J7 sur `staging` (`runbooks/staging.md`
§J7), J7S-4, J7S-5, J7S-6, J6S-5. Ils ne bloquent pas les commits J8.

## Commits prévus

1. **Dette J7 hors base** : J7S-7 (constante de ré-authentification membre + test liant le 300 du
   SQL), J7T-1 (délai du projet `unit`), J7T-3 (planchers unitaires figés), J6T-1, J6T-2, J7T-2.
2. **Migrations du socle backoffice** (`expert-database`) : contenu de `04` `0102` et `0107`
   **renuméroté `0129`, `0130`** (EC-37, `db push` refuse un numéro inférieur au dernier appliqué) :
   `queues` + `sla_policies` (D39, `is_provisional`), `alert_definitions` (**AL du Lot 1 seulement**),
   `dual_control_requests` (PD4), codes `dual_control.*`, `settings.changed`, `ownership.reassigned`,
   `grant_role()` réécrite avec 2V et fraîcheur R. T2/T3/T4/T6 étendus.
3. **Migrations des actions** : `0131` invitations (deux objets, voir EC-J8-2), `0132` corrections
   RG108 et rejeu (`SECURITY DEFINER`, motif typé, `lead.updated`), lecture du registre EC-31.
4. **Garde des actions B-5** (avant toute action sensible) : J3S-1 (R réservée avant GoTrue, test
   « 20 R parallèles ⇒ ≤ 5 appels »), J3S-4 (fraîcheur R dans la transaction de l'action), J3S-5
   (HIBP `newPasswordVerdict`), service 2V dégradé PD1 à PD7 (bascule PD7 sans code).
5. **API de lecture** : `GET /v1/bo/accounts` (RG97, filtres, pagination plafonnée `15` RG34,
   recherche exacte libre et partielle limitée + journalisée RG98), `GET /v1/bo/accounts/:id` (état
   par destination, cause en clair RG99/RG100, jamais RG107), compteurs du jour RG105.
6. **API d'action** : rejeu unitaire et en lot ≤ 200 (RG101 à RG103, même clé d'idempotence, un seul
   gagnant CA61), réglages Apollo `admin` (2V + R, réévaluation RG81, CA63), corrections RG108,
   alertes RG104 (CA62), levée de suppression Brevo `admin` (RG93), AL27 lu dans `ops.periodic_runs.counts`.
7. **Invitations** : compte interne (`15` RG99 : `admin`, 72 h, liée à l'adresse, remplace le jeton
   fixe EC-45, G-1 point 2) ; membre (D54, RG116 à RG119, attribution `ownership_assignments` et
   source `invitation` à l'inscription). Puis J4R-1 (secrets internes de `staging` changés).
8. **E-5 minimale** (`21` §J8 point 6, après `0130`) : `influx_privacy` + `PRIVACY_DATABASE_URL`
   (worker seul, jamais `influx_worker_login`), `privacy.execute_request`, Brevo opération 2, Apollo
   `skipped` noté, clôture `completed_at` + `outcome_code` après confirmation Brevo ; export JSON
   téléchargé dans l'espace membre (code frais `data_export`, 3 / 7 j, purge E-4,
   `privacy.export_ready` sans lien). `expert-database` + `expert-cybersecurite` sur ce commit.
9. **Écrans backoffice** (`17b` §3.11, §3.12 minimal, §3.13, §3.14.e) : liste, fiche, rejeu,
   réglages Apollo, comptes internes et invitations, 2V dégradée, bandeau RG107 (moins de deux
   `admin`), J3S-6 (bandeau `?secours=N` depuis `GET /v1/bo/me`), alerte B-7 « nouveau navigateur ».
   Côté membre : écran du canal de secours sur la connexion (RG65, API faite au J7).
10. **Tests de fin** : Playwright backoffice (CA56 à CA63, 2V dégradée, invitation ⇒ attribution),
    T14 sur chaque route `/v1/bo/*`, J7T-4 (axe à 375 px), J7T-5 (« mes données » en e2e).

## Tickets à solder au J8 (texte d'origine : `21` §J3, §J4 ; J6/J7 : `git show 5b977f7:docs/mvp/jalons/j7-fiche.md`)

| Ticket | Contenu | Commit |
|---|---|---|
| J7S-7 | Constante propre à la ré-authentification membre (aujourd'hui la valeur R du backoffice) + test liant le 300 du SQL | 1 |
| J7T-1 | Délai du projet Vitest `unit` (5 s) : 20 s, ou sur les seuls témoins ESLint et `check-security-review` | 1 |
| J7T-2 | Concurrence : deux POST identiques au webhook (une ligne), double acceptation CGU (un `409`), deux consommations du marqueur (une gagne) | 1 |
| J7T-3 | Planchers de cas unitaires (aujourd'hui la base seule) | 1 |
| J6T-1 | TM1.1 en propre : Brevo seul en 500 sur la vraie file (plancher `tm1-brevo-connector`) | 1 |
| J6T-2 | EC-44 : cas `security.critical_alert_no_recipient` et `journal_unavailable` | 1 |
| J3S-1 | R : réserver la tentative avant GoTrue (5 / 15 min + portée IP EC-47) ; test « 20 R parallèles ⇒ ≤ 5 appels » | 4 |
| J3S-4 | Fraîcheur R vérifiée dans la transaction de l'action ; test « B-5 sans R ⇒ refus » | 4 |
| J3S-5 | HIBP (`newPasswordVerdict`) sur invitation et changement de mot de passe (bloquant avant mise en ligne) | 4 |
| J3S-6 | Bandeau `?secours=N` dérivé de `GET /v1/bo/me` | 9 |
| J4R-1 | Secrets commercial/admin de `staging` exposés (à changer) | 7 |
| J7T-4 | Contrôle axe des écrans « mon compte » à 375 px (WCAG AA) | 10 |
| J7T-5 | « Mes données » en e2e (demande d'export et de suppression, mot `SUPPRIMER`) | 10 |

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-11 | Invitation membre (table au J8) ; attributs Brevo de source déjà mappés (J6) |
| EC-31 | Historique d'un objet lu par une fonction filtrant sur `subject_type` + `subject_id`, qui journalise la consultation |
| EC-37 | Migrations numérotées dans l'ordre d'application : `0102` ⇒ `0129`, `0107` ⇒ `0130` ; `04` §11.2 à réaligner à la clôture |
| EC-43 | Alerte B-7 sur « navigateur inconnu » (30 j, `user_agent_summary`), jamais sur un pays |
| EC-45 | Jeton d'enrôlement fixe de démo remplacé par l'invitation `admin` ; script local conservé pour `example.test` |
| EC-J8-1 | **CA64 contredit RG106** (abrogée le 2026-09-19) : aucun export au J8 ; l'export agrégé (R + motif) relève du Lot 5 (`15` §I). CA64 à réécrire à la clôture |
| EC-J8-2 | Invitation interne et invitation membre = **deux objets jamais fusionnés** (durée, surface, droits et effet différents) |
| EC-J8-3 | **D35 ouverte** : au J8, l'invitation membre est un **lien copié** par le commercial (RG118 l'admet) ; aucun e-mail d'invitation envoyé par INFLUX avant le Lot 5 |
| EC-J8-4 | Ligne « sans consentement » : aucune action de rejeu, ni bouton ni route (RG103, CA60) ; `lead_sync_failures` sans verrou nominatif (`15` RG30) |

Rappels invariants : aucun export nominatif, `admin` compris (RG106) ; jamais de code, mot de passe,
contenu d'e-mail ni donnée Apollo à l'écran (RG107) ; un rôle interne ne traite jamais son propre
compte (`15` RG36, `03` C(3)) ; toute lecture privilégiée et toute action journalisées ; aucun taux
ni montant ; libellés du backoffice FR/EN externalisés (D36 ouverte).

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Backoffice v0, CA56–CA64 | `05-spec-inscription-et-leads.md` · 620 · 72 (§K) ; · 1075 · 30 |
| Invitation membre, source (D54, D55) | `05` · 1244 · 55 |
| Catalogue des files, délais | `15-backoffice-files-et-supervision.md` · 256 · 102 (§C) |
| Fiche de compte | `15` · 358 · 71 (§D) |
| Alertes | `15` · 507 · 83 (§F) |
| Demandes « mes données » (RG77, RG79, RG80) | `15` · 590 · 95 (§G) |
| Comptes internes, invitation, rôles | `15` · 774 · 66 (§J) ; interdits · 840 · 41 (§K) |
| Écrans : leads, données, comptes internes, 2V | `17b-parcours-et-ecrans-backoffice.md` · 1352 · 38 / 1390 · 48 / 1438 · 95 |
| R, mot de passe, B-7 | `17b` · 1667 · 19 (§3.14.d) ; · 1686 · 12 (§3.14.e) |
| Anatomie d'une file, composants | `17b` · 257 · 190 (§2) ; · 1698 · 194 (§4, à la demande) |
| 2V dégradée PD1–PD7 | `03-matrice-des-droits-et-rls.md` · 113 · 39 (§1.3) |
| Droits `leads` et `backoffice` | `03` · 538 · 76 (§3.5) |
| Opérations élevées (E-5, `influx_privacy`) | `03` · 811 · 179 (P7, `Grep` « E-5 ») |
| B-5, B-7, `aal2` | `03` · 1289 · 3 ; · 1304 · 35 (§6.2) ; isolement · 1626 · 32 (§7) |
| Tables `queues`, alertes, 2V, exports | `04-modele-de-donnees-mvp.md` · 4817 · 40 ; · 5057 · 60 ; · 5117 · 32 ; · 5149 · 30 |
| Suppression d'un compte | `04` · 5795 · 37 (§9.2) ; purge GoTrue · 5839 · 31 |
| Index backoffice, plan de migrations | `04` · 5995 · 19 (§10.7bis) ; · 6054 · 65 (§11.2) |
| Invitations (point ouvert 9) | `04` · 6308 · 2 |
| Tests T14, TM9 | `18-plan-de-test-mvp.md` · 727 · 14 ; · 953 · 10 |
| « Prêt à livrer » Lot 1 | `18` · 1372 (`Grep` « Lot 1 — Inscription ») |
| Procédure « mes données » | `runbooks/demandes-rgpd.md` (§4 export, §5 suppression, §6 clôture, §8 juriste) |

## Code existant à réutiliser

- `apps/api/src/domains/identity/` : `backoffice-routes.ts` (`/v1/bo/me`, `/v1/bo/auth/reauthenticate`),
  `backoffice-session.ts` (garde `aal2`), `password-policy.ts` (`newPasswordVerdict`, HIBP),
  `critical-alert.ts` (P0 synchrone), `repository.ts`. Nouveau domaine `apps/api/src/domains/backoffice/`.
- `apps/api/src/domains/leads/` : `queue.ts`, `settings.ts` (`sync_settings`), `connectors/brevo/`
  (opération 2) ; `domains/maintenance/` (E-4, `periodic.ts`, rapprochement pour AL27).
- `supabase/migrations/` : dernière `0128` ; `0008` `ownership_assignments`, `0013`
  `mfa_enrollment_tokens`, `0120` `data_subject_requests`.
- `apps/backoffice/src/` : `server/relay.ts`, `server/api-client.ts`, `components/BackofficeHome.tsx`.
- `apps/api/db-tests/` : `support.ts`, `temporary-rights.ts`, `case-floors.ts` (planchers à relever).
- `packages/contracts` : schémas zod de requête **et** de réponse pour chaque route `/v1/bo/*`.

## Reliquat du J7 à placer

| Sujet | Commit |
|---|---|
| Interrupteur `all_paused` ⇒ `503` avant la demande de changement d'adresse ; mise en attente lue sur la classe | 1 |
| `account.email_corrected` reste `template_not_supported` ; suspension marketing sur `401` (RG123) | 6, ou Lot 5 |
| Modèles Brevo EC-8 en `staging` (`NULL` ⇒ `skipped`) | Fondateur |
| `architecte` : échelon P1 < P2 de `outbox_events.priority` avant le premier émetteur P2 | 6 ou 8, si un émetteur P2 apparaît |
| Avant production : J7S-1 (session posée par `withMemberSession`), J7S-2 (disjoncteur de la purge GoTrue), J7S-3 (webhook `404` hors `web`) | J8 si le temps le permet, sinon J9 |
| Avant la mise en ligne du Lot 1 : C5.c, A2 (`21` J7) | J9 |
| J7S-8 (alertes `gotrue_realign_failed`, `webhook.brevo.ignored`, `ip_drift`) ; J7T-6 (Lot 6) | J9, Lot 6 |

## Décisions encore ouvertes

- Fondateur : D35 (e-mail d'invitation membre, Lot 5) ; D36 (langue du backoffice) ; un compte
  `admin` distinct du compte `agent` quotidien (`03` §1.3, recommandation, rend PD7 effective).
- `expert-conformite-rgpd` (Lot 6) : RG118 et RG121 (veto), retrait propagé à Apollo, formulation
  de l'export « mes données ».
- `15` Q2 à Q4 : les quatre délais `is_provisional`.

## Planchers de départ (`testeur`, 2026-10-14, sur `bd513d4`)

Base 754 cas (36 fichiers) ; unitaire `apps/api` 946 ; contracts 63 ; test-kit 116 ; web 203 ;
e2e 16 ; `pnpm test` = 2 106. Tout nouveau fichier `db-tests` entre dans `case-floors.ts`.

## Issu du commit 1 (`73cdc5c`)

- Interrupteur : `src/platform/email-switch.ts`, mise en attente lue sur `leads.send_priority` ; non stocké avant le Lot 5 (`0503`), lu `off` ; injectable (`identity.emailSwitch`).
- Planchers : unitaire `apps/api` figé dans `tests/case-floors.ts` (953, 46 fichiers), contrôle `scripts/check-case-floors.ts unit|db` ; base 760 ; `pnpm test` = 2 119.

## Issu du commit 2 (`1314e9e`)

- Contrat `apps/api` (commit 4) : `request_dual_control()`, `confirm_dual_control(session, demande, justification)` → `peer` | `degraded_single_operator`, puis `grant_role(session, demande, compte, rôle, motif)` par le **confirmateur** ; R (TOTP ≤ 300 s) à la confirmation et à l'exécution ; tout refus `42501`.
- EC-J8-5 à EC-J8-11 (`0129`, `0130`) : clé `queues.code` + FK différée inverse ; `business_hours` UTC en attente ; `degraded_confirmed_at`, `consumed_at` ; PD7 sans compte de secours ni admin sans facteur ; liste d'actions 2V = `identity.grant_role` seule, **`0131`/`0132` l'étendent**.
- Revue groupée `expert-cybersecurite` : `p_session_id` non liée à la session de la requête ; blocage possible du secours (RG102) ; aucun écrivain de `expired` ; `correct_email()` sans 2V/R en base (`0132`) ; pas d'AL pour l'attribution `admin`.
- `product-owner` : seuil d'AL25 (`05` RG104 muet), escalade des files, fuseau ouvré ; sujet `uuid` de `settings.changed` (commit 6). `test:db -- <fichier>` ne filtre pas : `pnpm --filter @influx/api exec vitest run --project db <fichier>`.

## Issu du commit 3 (`1a41e1b`)

- `0131` : `create_internal_invitation` (admin, R ; admin ⇒ `approve_admin_invitation` 2V `identity.invite_admin`), `internal_invitation_is_valid` avant GoTrue, `accept_internal_invitation` (compte + jeton TOTP de même empreinte) ; `create_member_invitation` (agent/admin), `redeem_member_invitation` après `provision_account` = `created` (ne lève jamais), `accounts.signup_invitation_id`.
- `0132` : `correct_member_account` (motifs fermés, un `lead.updated`), `change_member_role` créateur → annonceur (2V + R), `correct_email(session, …)` sous R, `leads.replay_outbox_lines` (1 à 200, `requeued`/`ignored`/`refused`), `backoffice.read_subject_history` (EC-31). Contrat détaillé : en-têtes des deux migrations.
- 2V : `grant_role`, `invite_admin`, `change_member_role` (charges dans `canonical_dual_control_payload()`). Tout refus interne `42501`.
- EC-J8-12 à EC-J8-22 (en-têtes des migrations, message de `1a41e1b`) ; **EC-J8-19 à arbitrer à la revue cyber** (rejeu en lot sans 2V, `03` l. 562 contre `05` RG101) ; EC-J8-22 notification RG44 au commit 6 ou au Lot 5.
- Planchers : base 878 (40 fichiers), unitaire `apps/api` 957.

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche ; ne lire que les
  tranches du commit en cours.
- Pendant le codage : seul le fichier de test en cours, `--reporter=dot`. Suite complète avant
  chaque commit (CLAUDE.md §7).
- Sous-agents : `expert-database` aux commits 2, 3 et 8 ; `expert-cybersecurite` sur le commit 8
  (porte de production), sinon revue groupée `expert-cybersecurite` + `testeur` en fin de jalon. Skill
  `backoffice-ops` aux commits 5, 6 et 9 ; `design-system-influx` au commit 9. Pas de `chef-de-projet`.
- Arbitrages en cours de jalon : ajouter une section « Issu du commit N » ici (5 lignes au plus),
  jamais de récit dans `21`.
- À la clôture : 1 ligne par commit dans `21` §J8, `04` §11.2 et CA64 réalignés, `pnpm docs:index`,
  puis réduire cette fiche au reliquat du J9.
