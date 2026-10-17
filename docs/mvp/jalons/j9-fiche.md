# Fiche J9 — Durcissement, landing branchée, mise en ligne

> **Point d'entrée de toute session du J9.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives, ni les fiches J5 à J8. Les numéros de ligne
> datent du 2026-10-17 : s'ils ont glissé, `Grep` sur le titre de section. Le reliquat du J8 est
> repris ici en entier (`git show 7d7fd24:docs/mvp/jalons/j8-fiche.md` pour son texte).

## Objectif et critère de fin

La landing n'est plus une maquette : ses portes mènent à la vraie inscription, le module fictif,
`IS_MOCKUP` et le bandeau n'existent plus, chaque garde levée a son remplaçant dans le même commit
(`18` §5). Les trois surfaces servent leur CSP à nonce (T10) ; T7, T13 et T15 passent en entier.
La surveillance est active : sonde, battement du worker, alertes e-mail, écran « Santé technique »,
`/health` public. Les tickets « avant Lot 1 » et « avant production » sont soldés ; `production` est
**préparée** (runbooks, configurations), **jamais créée ni déployée sans l'accord du fondateur**
(`CLAUDE.md` §7 règle 4, `21` §5.8).

Sur `staging` : la landing FR et EN mène à `/fr/inscription/marque` et `/en/signup/brand` (et
créateur) ; les en-têtes de `18` T10 sont constatés ; arrêter le worker déclenche l'alerte envoyée
par l'API ; `/health` répond `200`, puis `503` quand l'API est coupée.

En parallèle, hors code (fondateur) : critères de fin J6 à J8 sur `staging` (`runbooks/staging.md`,
fiche J8 : `0129`–`0138` déployées, `PRIVACY_DATABASE_URL` sur le worker, J4R-1, invitation ⇒
attribution, rejeu sans doublon, suppression jusqu'à Brevo) ; J7S-4 à J7S-6, J6S-5 ; Watch Paths
Railway (commit 0). Ils ne bloquent pas les commits J9, mais **bloquent la mise en production**.

## Commits prévus

0. ✅ `eec21bb` — J6S-3 (pool `worker` sans audit en `debug`), `staging` remis en marche.
1. **Base : dette J8 avant Lot 1** (`expert-database`) — `0139` : J8S-3 (R liée à la session :
   `request.jwt.claims` → `session_id`, posé par `db/index.ts`), J8S-5 (RLS `member_invitations` :
   `admin` ou auteur, T2), lecture 7 j de `account.role_granted` pour J8S-4 (comme
   `new_browser_sign_ins()`), F4 (index `audit_events.actor_account_id`). Planchers relevés.
2. **Backoffice : dette J8** (skill `backoffice-ops`) — J8S-1 (`GET /v1/bo/dual-control/degraded`,
   `admin`, bloc d'accueil hebdomadaire), J8S-2 (portée exacte à la confirmation 2V,
   `DualControlScreens.tsx` ~l. 114 : compte de `invite_admin`, compte de `approve_data_request`),
   J8S-4 (alerte d'accueil « rôle `admin` attribué »), J8S-6 (seau `backoffice_reauth_ip` 60 / h
   dans `throttle-keys.ts`), J8S-7 (recherches exacte et partielle en `POST`, terme dans le corps,
   EC-J8-58) + J8T-7 (e2e de la recherche et des filtres de période).
3. **Identité : avant Lot 1 et avant production** — C5.c (orphelin GoTrue de la nouvelle adresse
   supprimé puis nouvel essai), A2 (code de la nouvelle adresse compté sur RG44), J7S-1
   (`withMemberSession` pose `influx.session` ; `consume_member_reauthentication` l'exige), J7S-2
   (disjoncteur de la purge GoTrue : `55000` si `identity.accounts` paraît vide, abandon > 50 %
   d'une page de plus de 20), J7S-3 (webhook Brevo `404` hors surface `web`, test, puis `03` A4).
4. **En-têtes et CSP à nonce** (`03` §6.5, T10) — nonce par requête posé par `src/proxy.ts` de
   `apps/web` et un `proxy.ts` à créer dans `apps/backoffice` ; valeurs exactes de `03` §6.5 (aucun
   `'unsafe-inline'` en `script-src`) ; J3S-7 (`img-src 'self' blob:` au backoffice, sans hôte
   Supabase) ; **G2 levée dans ce commit** (EC-J9-1) et remplacée par la garde resserrée (aucune URL
   littérale hors `src/config/` et `src/locales/`) ; tests T10 sur le build de production.
5. **Sortie du mode maquette** (`02` §13.3 point 2, `18` §5) — un seul commit : suppression de
   `src/content/placeholders/` (procédure `landing-page/01` l. 372), d'`IS_MOCKUP` et de
   `MockupBanner.tsx` ; G4 ⇒ garde d'absence d'image hors manifeste de marque ; G6 et annexe 3 ⇒
   garde d'absence (module, constante, bandeau) ; G1 resserrée (liste blanche de fichiers nommés) ;
   `action`/`formAction` levés ; portes et boutons branchés (EC-15, EC-J9-2) ; la section formulaire
   devient un renvoi vers les deux portes ; pied de page légal actif ; non-indexation par
   environnement seulement (`securityHeadersFor`, déjà fait au J4).
6. **Cookies** (commit séparé, arbitrage `chef-de-projet` 2026-10-09) — EC-J9-3 : aucun traceur non
   essentiel ⇒ bandeau désactivé globalement, lien « Cookies » du pied conservé
   (`landing-page/11` §8) ; garde D37 « aucune API de stockage » inchangée.
7. **Durcissement transverse** — T7 complet en intégration (passe-plat, empreinte des quatre
   fichiers), T13 (erreurs sans détail, `apps/api` et fronts), T15 (débit sur chaque route publique,
   `429` homogène), T11 (artefacts des trois builds), J4S-6 (`client-errors` : texte strict, plafond
   de nouveaux groupes navigateur par compte et par heure, aucune alerte « nouveau groupe » du seul
   navigateur).
8. **Surveillance active** (`02` §20.5, §20.6 ; `expert-database` pour `0140`) — battement du
   worker (`02` §11.3) ; sonde du worker chaque minute (accueils FR et EN par l'adresse publique,
   connexion du backoffice, `/health` de l'API en réseau privé) ; l'API surveille le battement (60 s,
   une instance sous verrou consultatif) ; alertes de disponibilité **directes vers Brevo, jamais par
   `outbox_events`** (réutiliser `critical-alert.ts`), destinataires en base **et** en variable
   d'environnement ; déduplication 30 min + e-mail « rétabli » ; nouvelle erreur / régression, `5xx`
   > 1 % sur 5 min, p95 > 1 s hors `request-code`, `429` en hausse ; J3S-8
   (`security.member_code_targeted`, ≥ 25 échecs / 24 h, sans blocage) ; J7S-8
   (`gotrue_realign_failed`, taux de `webhook.brevo.ignored`, `ip_drift`) ; seuils AL48 (RG126) ;
   F4 (alerte « exécutée, non close depuis 24 h ») ; EC-22 (`apps/web` `src/app/health/route.ts`,
   corps vide, hors `matcher` du proxy, ajouté à la liste blanche G5). Codes AL : EC-J9-4.
9. **Écran « Santé technique »** (`admin` seul, poste de travail ; skills `backoffice-ops`,
   `design-system-influx`) — EC-J9-5 : disponibilité mesurée par la sonde, groupes d'erreurs (états
   `new` / `acknowledged` / `fixed` / `ignored`, régression), appels par minute, p95 et taux d'erreur
   par route (histogrammes agrégés à la lecture), santé des processus, connexions, état du worker ;
   lien « état des services » des files.
10. **Tests de fin** — Playwright : landing ⇒ vraie inscription FR et EN, en-têtes T10 sur
    `next start`, J8T-4 (axe sur liste, fiche, Apollo, 2V, invitations, santé technique) ; base :
    J8T-2 (CA62, requête AL25 `destination_down` / `quota_exceeded`, `repository.ts` ~l. 1310),
    J8T-3 (CA58 : rejeu → worker → doublure, un seul contact ; relire `tm1-brevo-connector` et
    `tm1-apollo-connector` d'abord) ; J8T-5 (message `overCap` du `ReplayPanel`) ; `02` §20.12
    `testeur` (avalanche d'erreurs sans saturation, histogrammes entre instances, worker arrêté ⇒
    alerte par l'API, alerte sans la base) ; J8T-6 (planchers figés de tous les paquets).
11. **Préparation de `production`** (`integrateur`, documentation et configuration seulement) —
    `runbooks/production.md` : projet Supabase UE avec PITR (D57, `02` §19), quatre services,
    variables, trois sous-domaines DNS, retour à la version précédente (`runbooks/staging.md`
    l. 171), pages d'état Railway / Supabase / Brevo, rodage de 30 jours (`02` §20.7) ; runbook
    « admin indisponible » (J8S-9 : désactiver son profil, journalisé, rouvre PD7) ; lien
    d'invitation interne transmis hors e-mail et révocation `suspected_compromise` ; publication des
    CGU sous libellé définitif (EC-62, action du fondateur) ; liste des relectures humaines de `18`
    §10 « Lot 1 ».

## Tickets à solder au J9

| Ticket | Contenu (texte complet : `git show 7d7fd24:docs/mvp/jalons/j8-fiche.md`) | Commit |
|---|---|---|
| J8S-3 | R liée à la session de la requête (`0139` + test) — **avant Lot 1** | 1 |
| J8S-5 | RLS `member_invitations` : `admin` ou auteur (aujourd'hui EC-J8-31 en API seulement) + T2 | 1 |
| F4 | Index `audit_events.actor_account_id` ; alerte « exécutée, non close depuis 24 h » | 1, 8 |
| J8S-1 | Revue hebdomadaire des 2V dégradées (`degradedConfirmationsByWeek`) : route + bloc — **avant Lot 1** | 2 |
| J8S-2 | Portée exacte à la confirmation 2V (PD1) — **avant Lot 1** | 2 |
| J8S-4 | Attribution du rôle `admin` alertée à l'accueil (e-mail au Lot 5) — **avant Lot 1** | 1, 2 |
| J8S-6 | Seau propre `backoffice_reauth_ip` (60 / h), distinct de la connexion (20 / h) | 2 |
| J8S-7 · J8T-7 | Recherches hors URL (`POST`) ; e2e recherche exacte et filtres de période | 2 |
| C5.c · A2 | Orphelin GoTrue de la nouvelle adresse ; code de la nouvelle adresse sur RG44 — **avant Lot 1** | 3 |
| J7S-1 · J7S-2 · J7S-3 | Session membre posée ; disjoncteur de purge GoTrue ; webhook `404` hors `web` — **avant production** | 3 |
| J3S-7 | CSP backoffice `img-src 'self' blob:` | 4 |
| J4S-6 | Durcissement de `client-errors` | 7 |
| J3S-8 · J7S-8 | Alertes `member_code_targeted` ; `gotrue_realign_failed`, `webhook.brevo.ignored`, `ip_drift`, seuils AL48 | 8 |
| J8T-2 · J8T-3 · J8T-4 · J8T-5 · J8T-6 | CA62 en base ; CA58 sans doublon ; axe backoffice ; `overCap` ; planchers figés | 10 |
| J8S-9 | Runbook « admin indisponible » (l'écrivain de `expired` et RG102 restent au Lot 5) | 11 |
| J8T-1 | Clos : CI verte sur `c3402af` (2026-10-17) ; revérifier au premier push J9 | — |
| J8T-8 | Info CI : l'e2e de 2V dégradée désactive les autres `admin` de la base partagée, jamais en parallèle | — |

Hors J9 : J8S-8 (Lot 5), J4S-7 (Lot 2), J4S-8 (domaines), F3 (Lot 3), F8 et J7T-6 (Lot 6) ;
fondateur J7S-4 à J7S-6, J6S-5, J4R-1.

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-15 | Chemins localisés de `17` §3 : `/fr/inscription/marque` · `/en/signup/brand`, créateur idem ; la section formulaire de la landing devient un renvoi vers les deux portes |
| EC-22 | `apps/web` `src/app/health/route.ts` : `200` ou `503` à corps vide d'après `GET /v1/status`, exclue du `matcher` du proxy |
| EC-62 | Production : `draft-*` toujours refusé ; publication des CGU = action du fondateur sous libellé définitif (marqueurs D25 de `apps/api/legal/` d'abord) |
| EC-J9-1 | **G2 levée dans le commit de la CSP** (4), pas dans celui de la sortie de maquette : `18` §5 exige le remplaçant dans le même commit |
| EC-J9-2 | `AudienceDoors.tsx` vise `/signup/advertiser` et `/signup/creator`, qui n'existent pas : brancher sur les chemins EC-15 par le lien localisé de next-intl (`CLAUDE.md` §12) |
| EC-J9-3 | Inventaire du 2026-10-17 : aucun traceur tiers dans `apps/web/src` ⇒ bandeau désactivé ; `cookie-consent.ts` reste en mémoire ; verdict L9 par `expert-conformite-rgpd` au Lot 6 |
| EC-J9-4 | Les alertes techniques entrent au catalogue de `15` §F (aucune liste parallèle) : `product-owner` leur attribue les numéros **AL49 et suivants** dans un additif court de `15`, en début de commit 8 ; lignes dans `alert_definitions` par `0140` |
| EC-J9-5 | Écran « Santé technique » écrit d'après `02` §20.5 seul ; accès `admin` en lecture (confirmation `expert-cybersecurite` à la revue groupée) ; additifs `15` et `17b` regroupés à la clôture |
| EC-J9-6 | `production` : le J9 livre runbook et configurations ; création des projets et déploiement = fondateur, après les portes de `21` §5.8 |

Rappels invariants : une garde n'est levée que dans le commit de son remplaçant (`18` §5) ; le
bandeau disparaît dans le commit qui branche la landing sur la vraie inscription, jamais avant ;
`localStorage` & co. interdits définitivement (D37) ; aucune alerte de disponibilité par la file ;
jamais de `debug` en production, rien du `02` §20.8 dans `ops` ni dans un journal ; aucun taux ni
montant ; libellés FR/EN externalisés (backoffice FR seul, D36).

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Sortie du mode maquette, gardes, ESLint | `02-architecture-3-espaces.md` · 1272 · 58 (§13) |
| Sort des gardes et contreparties | `18-plan-de-test-mvp.md` · 1010 · 37 (§5) |
| CSP et en-têtes des trois surfaces, cookies | `03-matrice-des-droits-et-rls.md` · 1432 · 74 (§6.5) |
| Passe-plat ; isolement du backoffice | `03` · 1360 · 72 (§6.4) ; · 1627 · 32 (§7) |
| Tests T7, T10, T11, T13, T15, T17 | `18` · 586 · 26 ; · 663 · 20 ; · 683 · 14 ; · 710 · 17 ; · 741 · 14 ; · 792 · 25 |
| « Prêt à livrer » Lot 1 | `18` · 1374 · 20 |
| Surveillance : pièces, fonctionnement, seuils, rodage | `02` · 1935 · 14 ; · 1949 · 95 ; · 2044 · 34 ; · 2078 · 22 |
| Ce qui n'entre jamais dans `ops` ; points ouverts ; demandes aux agents | `02` · 2100 · 26 ; · 2169 · 22 |
| Worker, battement ; Railway, variables, garde-fou `staging` | `02` · 1154 (§11.3) ; · 1169 · 103 (§12) |
| Sauvegarde et restauration (D57) | `02` · 1847 · 24 (§19) |
| Catalogue des alertes ; AL42 à AL48 | `15-backoffice-files-et-supervision.md` · 507 · 83 (§F) ; · 1505 · 40 (RG126) |
| Bandeau cookies : persistance, textes | `docs/landing-page/11-consentement-cookies.md` · 204 · 17 (§7) ; · 221 · 34 (§8) |
| Avant mise en ligne de la landing (L9) | `docs/landing-page/07-revue-conformite.md` · 284 · 35 (§5) |
| Retrait du fictif | `docs/landing-page/01-architecture.md` · 343 · 40 (§6.1, §6.2) |
| Portes de la mise en production | `21-plan-de-developpement.md` · 307 · 16 (§5.8) |
| Retour à la version précédente | `runbooks/staging.md` · 171 · 14 |

## Code existant à réutiliser

- `apps/web` : `next.config.ts` (`BASE_SECURITY_HEADERS`, `securityHeadersFor`, `NOINDEX` ; CSP sans
  nonce du J4), `src/proxy.ts`, `tests/guards.test.ts` (G1 à G7, bloc R7), `eslint.config.mjs`,
  `src/content/placeholders/`, `components/landing/MockupBanner.tsx`, usages d'`IS_MOCKUP`
  (`[locale]/layout.tsx`, `[locale]/page.tsx`, `HeroSection`, `StartFormSection`, `StartFormSteps`,
  `start-form-validation.ts`, `AudienceDoors`, `Button`, `LinkButton`, `landing-content.ts`,
  `i18n/routing.ts`), `components/landing/cookie-consent.ts`.
- `apps/backoffice` : `next.config.ts` (CSP sans nonce), `src/app/accueil/` (blocs J8S-1, J8S-4),
  `components/DualControlScreens.tsx` (J8S-2), `src/messages/fr.ts`.
- `apps/api/src/domains/ops/` : `recorder.ts`, `repository.ts`, `routes.ts` (`client-errors`),
  `scrub.ts` ; tables `ops.error_groups`, `error_occurrences`, `request_metrics`,
  `process_metrics`, `periodic_runs` (`0016`). Aucun battement ni sonde : à créer.
- `apps/api/src/` : `worker.ts`, `domains/maintenance/periodic.ts`, `domains/identity/critical-alert.ts`
  (P0 synchrone, à réutiliser), `platform/brevo-transactional.ts`, `domains/identity/throttle-keys.ts`
  (J8S-6), `server.ts` (`/v1/status`), `platform/internal-auth.ts`.
- `supabase/migrations/` : dernière `0138` ; `0130` (`alert_definitions`, AL du Lot 1), `0134`
  (AL25). `packages/test-kit` : harnais des gardes partagées (G5). `deploy/railway/*.json`.

## Décisions encore ouvertes

- Fondateur : `02` §20.11 points 2 à 4 (destinataires des alertes et astreinte, offre Railway Pro,
  rodage de 30 jours) ; D35 ; D36 ; un compte `admin` distinct de l'`agent` (PD7) ; accord de mise en
  production (`21` §5.8).
- `integrateur` : HSTS `preload` une fois les domaines arrêtés (J4S-8).
- `expert-cybersecurite` (revue groupée) : seuil des `429`, seuil propre de `request-code`, accès à
  l'écran « Santé technique ».
- `product-owner` : numéros des alertes techniques (EC-J9-4) ; seuil d'AL25 ; `15` Q2 à Q4.
- `expert-conformite-rgpd` (Lot 6) : verdict L9, exemption de consentement du collecteur
  navigateur, RG118, RG121 (veto), retrait propagé à Apollo, notice art. 15, F8.

## Planchers de départ (`testeur`, 2026-10-16, sur `a2ff7bc`)

Base 1 038 cas (48 fichiers) ; unitaire `apps/api` 1 017 (51) ; contracts 80 ; test-kit 116 ;
web 205 ; backoffice 30 ; e2e 24 ; `pnpm test` = 2 486. Seul `apps/api` est figé (J8T-6) ; relever
au commit 1. Tout nouveau fichier `db-tests` entre dans `case-floors.ts`.

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche ; ne lire que les
  tranches du commit en cours, et le code par `Grep` avant `Read`.
- Pendant le codage : seul le fichier de test en cours, `--reporter=dot`. Suite complète avant
  chaque commit (`CLAUDE.md` §7).
- Sous-agents : `expert-database` aux commits 1 et 8 ; `product-owner` en début de commit 8
  (EC-J9-4, additif court) ; `integrateur` au commit 11 ; sinon revue groupée `expert-cybersecurite`
  + `testeur` en fin de jalon. Skill `backoffice-ops` aux commits 2 et 9 ; `design-system-influx` aux
  commits 5 et 9 ; `railway-deploy` au commit 11. Pas de `chef-de-projet`.
- Arbitrages en cours de jalon : ajouter une section « Issu du commit N » ici (5 lignes au plus),
  jamais de récit dans `21`.
- À la clôture : 1 ligne par commit dans `21` §J9, additifs `15` / `17b` (EC-J9-4, EC-J9-5), `18`
  §10 « Lot 1 » coché, `pnpm docs:index`, puis réduire cette fiche au reliquat du Lot 2.
