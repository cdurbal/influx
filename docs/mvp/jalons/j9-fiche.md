# Fiche J9 — Durcissement, landing branchée, mise en ligne

> **Point d'entrée de toute session du J9.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md` (sauf la ligne d'une décision citée, par `Grep`), ni les
> archives, ni les fiches J5 à J8. Numéros de ligne revus le 2026-10-20 (sur `d850bce`) : s'ils ont
> glissé, `Grep` sur le titre de section. Reliquat du J8 : `git show 7d7fd24:docs/mvp/jalons/j8-fiche.md`.

## Ce qui a changé depuis la première version (2026-10-17)

- **D68, D69** : identifiants de listes Brevo pris des variables du `worker` (`0139`) ; tous les
  e-mails de la file rédigés par INFLUX, **plus aucun identifiant de modèle Brevo** (`0140`).
- **D70** : `staging` = production (envois réels, aucune liste de destinataires, `INFLUX_ENV`,
  prédicat unique `isDeployedEnvironment`) et **exploité par les agents** (`runbooks/staging.md`).
  `staging:check` compare les noms des variables Railway à une **liste fermée** (runbook §5) : toute
  variable nouvelle y entre dans le commit qui la crée, et l'agent la pose sur Railway `staging`.
- **D71** : revues sécurité / RGPD et I-4 bloquantes sur la **seule branche `production`** (créée le
  2026-10-19, avancée par `git merge --no-ff main` sur accord du fondateur) ; non bloquantes sur `main`.
- **Apollo** (`0141`) : tous les pays par défaut, sauf `apollo_excluded_countries`.
- **D67 n'était pas dans la fiche** : trois commits « avant production » ajoutés (D67-a à D67-c).
- Migrations : `0139`–`0141` prises ⇒ le J9 numérote à partir de **`0142`** (prochaine libre).

## Objectif et critère de fin

La landing n'est plus une maquette : ses portes mènent à la vraie inscription, le module fictif,
`IS_MOCKUP` et le bandeau n'existent plus, chaque garde levée a son remplaçant dans le même commit
(`18` §5). Les trois surfaces servent leur CSP à nonce (T10) ; T7, T13 et T15 passent en entier.
Une configuration de synchronisation manquante est un incident alerté et rattrapé (D67). La
surveillance est active : sonde, battement du worker, alertes e-mail, écran « Santé technique »,
`/health` public. Les tickets « avant Lot 1 » et « avant production » sont soldés ; la production
est **préparée** (runbook, configurations, CI de la branche `production`), **jamais créée ni
déployée sans l'accord du fondateur** (`CLAUDE.md` §7 règle 4, `21` §5.8).

Constaté **par l'agent sur `staging`** (D70) : la landing FR et EN mène à `/fr/inscription/marque`
et `/en/signup/brand` (et créateur) ; les en-têtes de `18` T10 sont présents ; arrêter le worker
déclenche l'alerte envoyée par l'API ; `/health` répond `200`, puis `503` quand l'API est coupée
(remise en marche aussitôt, procédure du runbook).

Restent au fondateur, sans bloquer les commits J9 mais **bloquant la mise en production** :
confirmation que `/.env` et `apps/api/.env` ne portent aucune valeur de production, portes de `21`
§5.8 (testeur interne et Watch Paths soldés au commit S).

## Commits prévus

0. ✅ `eec21bb` — J6S-3 (pool `worker` sans audit en `debug`), `staging` remis en marche.
S. ✅ `d844219` — **Constats `staging` (sans code ou presque)** — « Terminé quand » de D70
   (`runbooks/staging.md` §9) avec l'adresse du testeur interne, ce qui **solde les critères
   `staging` des J6 à J8** (les cocher dans `21`) ; J4R-1 (`staging:reset-internal-account`, secrets
   dans `.operator-secrets/`) ; J7S-4 (A5.6 : `X-Real-IP` forgé ⇒ `404`, aucune ligne brute) ; J7S-6
   (supprimer `apps/api/.provider-recordings/raw.jsonl`, toujours présent) ; J6S-5 (`.env.example`
   aligné sur la liste fermée) ; J7S-5 requalifié par D70 (`.env.local` lisible ; vérifier le refus
   de `.env.trial*` dans `.claude/settings.json`) ; Watch Paths (runbook §5, un motif par ligne).
1. **Base : dette J8 avant Lot 1** (`expert-database`) — `0142` : J8S-3 (R liée à la session :
   `request.jwt.claims` → `session_id`, posé par `db/index.ts`), J8S-5 (RLS `member_invitations` :
   `admin` ou auteur, T2), lecture 7 j de `account.role_granted` pour J8S-4 (comme
   `new_browser_sign_ins()`), F4 (index `audit_events.actor_account_id`). Planchers recomptés.
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
- **D67-a. Base** (`expert-database`) — migration suivante : déclencheur « jamais `NULL` » sur les
  identifiants Brevo de `leads.sync_settings` (RG163) et déclencheur de journal `settings.changed`
  daté, quel que soit le chemin ; `leads.apply_brevo_ids_from_environment` (`0139`) cesse alors
  d'écrire le journal lui-même (une ligne par changement, D67 (v)). Clés modèles : sans objet (D69).
- **D67-b. Worker** — `list_not_configured` et toute configuration manquante passent de `skipped` à
  **échec de nature incident** (RG160), ordre d'évaluation RG164, `credentials_missing` (Apollo, en
  environnement déployé), rattrapage RG161 dans la boucle E-3 (au démarrage puis 1 / min, même clé
  d'idempotence), contrôle de démarrage RG162 sur `isDeployedEnvironment` (listes des deux rôles,
  `retry_schedule`, `rate_limits`, Apollo lisible si clé ; aucun modèle, D69), `would_send` en
  `development` seulement. TM1.11 à TM1.16.
- **D67-c. Backoffice** — causes (`sync-causes.ts` : `configuration_missing` = incident), rejouabilité,
  compteurs RG79 / RG105, motif d'AL25 (`15` AL25). CA82 à CA88.
4. **En-têtes et CSP à nonce** (`03` §6.5, T10) — nonce par requête posé par `src/proxy.ts` de
   `apps/web` et un `proxy.ts` à créer dans `apps/backoffice` ; valeurs exactes de `03` §6.5 (aucun
   `'unsafe-inline'` en `script-src`) ; J3S-7 (`img-src 'self' blob:` au backoffice, sans hôte
   Supabase) ; **G2 levée dans ce commit** (EC-J9-1) et remplacée par la garde resserrée (aucune URL
   littérale hors `src/config/` et `src/locales/`) ; tests T10 sur le build de production.
5. **Sortie du mode maquette** (`02` §13.3 point 2, `18` §5) — un seul commit : suppression de
   `src/content/placeholders/` (procédure `landing-page/01` §6.1), d'`IS_MOCKUP` et de
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
8. **Surveillance active** (`02` §20.5, §20.6 ; `expert-database` pour la migration) — battement du
   worker (`02` §11.3) ; sonde du worker chaque minute (accueils FR et EN par l'adresse publique,
   connexion du backoffice, `/health` de l'API en réseau privé) ; l'API surveille le battement (60 s,
   une instance sous verrou consultatif) ; alertes de disponibilité **directes vers Brevo, jamais par
   `outbox_events`** (réutiliser `critical-alert.ts`, texte rédigé par INFLUX, D69), destinataires en
   base **et** en variable d'environnement ; déduplication 30 min + e-mail « rétabli » ; nouvelle
   erreur / régression, `5xx` > 1 % sur 5 min, p95 > 1 s hors `request-code`, `429` en hausse ; J3S-8
   (`security.member_code_targeted`, ≥ 25 échecs / 24 h, sans blocage) ; J7S-8
   (`gotrue_realign_failed`, taux de `webhook.brevo.ignored`, `ip_drift`) ; seuils AL48 (RG126) ;
   F4 (alerte « exécutée, non close depuis 24 h ») ; EC-22 (`apps/web` `src/app/health/route.ts`,
   corps vide, hors `matcher` du proxy, ajouté à la liste blanche G5). Codes AL : EC-J9-4. **Variables
   nouvelles** (destinataires, adresses sondées par le worker) : `02` §12.3, `config/schema.ts`, liste
   fermée du runbook §5 et `staging-check-rules.ts`, puis posées sur Railway `staging` (EC-J9-7).
9. **Écran « Santé technique »** (`admin` seul, poste de travail ; skills `backoffice-ops`,
   `design-system-influx`) — EC-J9-5 : disponibilité mesurée par la sonde, groupes d'erreurs (états
   `new` / `acknowledged` / `fixed` / `ignored`, régression), appels par minute, p95 et taux d'erreur
   par route (histogrammes agrégés à la lecture), santé des processus, connexions, état du worker ;
   lien « état des services » des files.
10. **Tests de fin** — Playwright : landing ⇒ vraie inscription FR et EN, en-têtes T10 sur
    `next start`, J8T-4 (axe sur liste, fiche, Apollo — exclusions de `0141` comprises —, 2V,
    invitations, santé technique) ; base : J8T-2 (CA62, requête AL25 `destination_down` /
    `quota_exceeded`, `repository.ts`, `Grep` sur AL25), J8T-3 (CA58 : rejeu → worker → doublure, un
    seul contact ; relire `tm1-brevo-connector` et `tm1-apollo-connector`, modifiés par D68 / D69)
    ; J8T-5 (message `overCap` du `ReplayPanel`) ; `02` §20.12 `testeur` (avalanche d'erreurs sans
    saturation, histogrammes entre instances, worker arrêté ⇒ alerte par l'API, alerte sans la base) ;
    J8T-6 (planchers figés de tous les paquets). Puis constats de fin sur `staging` (critère de fin).
11. **Préparation de la production** (`integrateur`, documentation et configuration seulement) —
    `runbooks/production.md` **en miroir de `runbooks/staging.md`** (mêmes noms, D70) mais exécuté
    sur confirmation du fondateur : projet Supabase UE avec PITR (D57, `02` §19), quatre services
    déployés depuis la **branche `production`** (D71), variables par service (liste fermée du runbook
    `staging` §5, valeurs de production), trois sous-domaines DNS, retour à la version précédente
    (runbook `staging` §10), pages d'état Railway / Supabase / Brevo, rodage de 30 jours (`02`
    §20.7) ; job CI « Migrate production » sur la branche `production`, inerte tant que
    l'environnement GitHub `production` n'existe pas (EC-J9-8) ; runbook « admin indisponible »
    (J8S-9 : désactiver son profil, journalisé, rouvre PD7) ; lien d'invitation interne transmis hors
    e-mail et révocation `suspected_compromise` ; publication des CGU sous libellé définitif (EC-62,
    action du fondateur) ; liste des relectures humaines de `18` §10 « Lot 1 ».

## Fin de chaque commit

Suite complète (`pnpm typecheck`, `pnpm lint`, `pnpm test -- --reporter=dot`,
`pnpm --filter @influx/api test:db -- --reporter=dot`) ; commit Conventional en anglais ; puis
commit `docs(j9): record commit N (…)` : 1 ligne `[x] Commit N (\`sha\`) — …` dans `21` §J9 (la
ligne D67 de `21` est cochée par D67-c), section « Issu du commit N » ci-dessous (5 lignes au plus)
si un arbitrage a eu lieu, planchers relevés ; push sur `main` ; suivre la CI
(`gh run watch <id> --exit-status`) jusqu'au vert, puis « Migrate staging » et le déploiement des
quatre services ; `pnpm --filter @influx/api staging:check` vert. Aucune commande vers `production`.

## Tickets à solder au J9

| Ticket | Contenu (texte complet : `git show 7d7fd24:docs/mvp/jalons/j8-fiche.md`) | Commit |
|---|---|---|
| Critères `staging` J6–J8 | « Terminé quand » de D70 (`archives/jalons/d70-plan.md` l. 18) | S |
| J4R-1 · J7S-4 · J7S-6 · J6S-5 · J7S-5 | Secrets internes ; A5.6 ; `raw.jsonl` ; `.env.example` ; refus `.env.trial*` (texte : `git show 1c85756:docs/mvp/jalons/j7-fiche.md`, l. 27 à 40) | S |
| J8S-3 | R liée à la session de la requête (`0142` + test) — **avant Lot 1** | 1 |
| J8S-5 | RLS `member_invitations` : `admin` ou auteur (aujourd'hui EC-J8-31 en API seulement) + T2 | 1 |
| F4 | Index `audit_events.actor_account_id` ; alerte « exécutée, non close depuis 24 h » | 1, 8 |
| J8S-1 | Revue hebdomadaire des 2V dégradées (`degradedConfirmationsByWeek`) : route + bloc — **avant Lot 1** | 2 |
| J8S-2 | Portée exacte à la confirmation 2V (PD1) — **avant Lot 1** | 2 |
| J8S-4 | Attribution du rôle `admin` alertée à l'accueil (e-mail au Lot 5) — **avant Lot 1** | 1, 2 |
| J8S-6 | Seau propre `backoffice_reauth_ip` (60 / h), distinct de la connexion (20 / h) | 2 |
| J8S-7 · J8T-7 | Recherches hors URL (`POST`) ; e2e recherche exacte et filtres de période | 2 |
| C5.c · A2 | Orphelin GoTrue de la nouvelle adresse ; code de la nouvelle adresse sur RG44 — **avant Lot 1** | 3 |
| J7S-1 · J7S-2 · J7S-3 | Session membre posée ; disjoncteur de purge GoTrue ; webhook `404` hors `web` — **avant production** | 3 |
| D67 (a, b, c) | Configuration manquante = incident (`05` RG160 à RG164, CA82 à CA88, TM1.11 à TM1.16) — **avant production** ; T17.1 `credentials_missing` | D67-a à c |
| J3S-7 | CSP backoffice `img-src 'self' blob:` | 4 |
| J4S-6 | Durcissement de `client-errors` | 7 |
| J3S-8 · J7S-8 | Alertes `member_code_targeted` ; `gotrue_realign_failed`, `webhook.brevo.ignored`, `ip_drift`, seuils AL48 | 8 |
| J8T-2 · J8T-3 · J8T-4 · J8T-5 · J8T-6 | CA62 en base ; CA58 sans doublon ; axe backoffice ; `overCap` ; planchers figés | 10 |
| J8S-9 | Runbook « admin indisponible » (l'écrivain de `expired` et RG102 restent au Lot 5) | 11 |
| J8T-8 | Info CI : l'e2e de 2V dégradée désactive les autres `admin` de la base partagée, jamais en parallèle | — |

Hors J9 : J8S-8 (Lot 5), J4S-7 (Lot 2), J4S-8 (domaines), F3 (Lot 3), F8 et J7T-6 (Lot 6) ;
reports D70 au Lot 6bis (`archives/jalons/d70-plan.md` l. 125 à 130) ; écran des identifiants Brevo
(option Lot 5).

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-15 | Chemins localisés de `17` §3 : `/fr/inscription/marque` · `/en/signup/brand`, créateur idem ; la section formulaire de la landing devient un renvoi vers les deux portes |
| EC-22 | `apps/web` `src/app/health/route.ts` : `200` ou `503` à corps vide d'après `GET /v1/status`, exclue du `matcher` du proxy |
| EC-62 | Production : `draft-*` toujours refusé ; publication des CGU = action du fondateur sous libellé définitif (marqueurs D25 de `apps/api/legal/` d'abord) |
| EC-J9-1 | **G2 levée dans le commit de la CSP** (4), pas dans celui de la sortie de maquette : `18` §5 exige le remplaçant dans le même commit |
| EC-J9-2 | `AudienceDoors.tsx` vise `/signup/advertiser` et `/signup/creator`, qui n'existent pas : brancher sur les chemins EC-15 par le lien localisé de next-intl (`CLAUDE.md` §12) |
| EC-J9-3 | Inventaire du 2026-10-17 : aucun traceur tiers dans `apps/web/src` ⇒ bandeau désactivé ; `cookie-consent.ts` reste en mémoire ; verdict L9 par `expert-conformite-rgpd` au Lot 6 |
| EC-J9-4 | Les alertes techniques entrent au catalogue de `15` §F (aucune liste parallèle) : `product-owner` leur attribue les numéros **AL49 et suivants** dans un additif court de `15`, en début de commit 8 ; lignes dans `alert_definitions` par la migration du commit 8 |
| EC-J9-5 | Écran « Santé technique » écrit d'après `02` §20.5 seul ; accès `admin` en lecture (confirmation `expert-cybersecurite` à la revue groupée) ; additifs `15` et `17b` regroupés à la clôture |
| EC-J9-6 | Production : le J9 livre runbook, configurations et job CI inerte ; création des projets, des environnements et déploiement = fondateur, après les portes de `21` §5.8 ; fusion vers la branche `production` sur son accord seulement (D71) |
| EC-J9-7 | `staging` sans liste de destinataires (D70) : les alertes y partent vraiment, vers les destinataires de `staging` ; toute variable nouvelle entre dans la liste fermée (runbook §5, `staging-check-rules.ts`) dans le commit qui la lit |
| EC-J9-8 | Job « Migrate production » : écrit au commit 11, déclenché par la seule branche `production` et l'environnement GitHub `production` (absent : le job ne tourne pas) ; jamais de `railway up` |

Rappels invariants : une garde n'est levée que dans le commit de son remplaçant (`18` §5) ; le
bandeau disparaît dans le commit qui branche la landing sur la vraie inscription, jamais avant ;
`localStorage` & co. interdits définitivement (D37) ; aucune alerte de disponibilité par la file ;
jamais de `debug` en production, rien du `02` §20.8 dans `ops` ni dans un journal ; aucun taux ni
montant ; libellés FR/EN externalisés (backoffice FR seul, D36) ; aucune valeur de `.env.local`
recopiée nulle part (D70).

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Sortie du mode maquette, gardes, ESLint | `02-architecture-3-espaces.md` · 1366 · 58 (§13) |
| Sort des gardes et contreparties | `18-plan-de-test-mvp.md` · 1037 · 37 (§5) |
| CSP et en-têtes des trois surfaces, cookies | `03-matrice-des-droits-et-rls.md` · 1432 · 74 (§6.5) |
| Passe-plat ; isolement du backoffice | `03` · 1360 · 72 (§6.4) ; · 1634 · 32 (§7) |
| Tests T7, T10, T11, T13, T15, T17 | `18` · 586 · 26 ; · 663 · 20 ; · 683 · 14 ; · 710 · 17 ; · 741 · 14 ; · 792 · 30 |
| « Prêt à livrer » Lot 1 | `18` · 1401 · 20 |
| D67 : règles, critères, points de revue | `05-spec-inscription-et-leads.md` · 1694 · 153 (additif) ; · 1847 · 35 (CA) ; · 1882 · 15 ; `18` `Grep` TM1.11 |
| Surveillance : pièces, fonctionnement, seuils, rodage | `02` · 2029 · 14 ; · 2043 · 95 ; · 2138 · 35 ; · 2173 · 22 |
| Ce qui n'entre jamais dans `ops` ; points ouverts ; demandes aux agents | `02` · 2195 · 26 ; · 2264 · 9 ; · 2273 · 17 |
| Worker, battement ; variables ; garde-fou D70 ; pendant en base | `02` · 1154 · 15 (§11.3) ; · 1201 · 49 (§12.3) ; · 1250 · 84 (§12.4) ; · 1334 · 32 (§12.5) |
| Sauvegarde et restauration (D57) | `02` · 1941 · 24 (§19) |
| Catalogue des alertes ; AL42 à AL48 | `15-backoffice-files-et-supervision.md` · 507 · 83 (§F) ; · 1505 · 29 (RG126) |
| Bandeau cookies : persistance, textes | `docs/landing-page/11-consentement-cookies.md` · 204 · 17 (§7) ; · 221 · 34 (§8) |
| Avant mise en ligne de la landing (L9) | `docs/landing-page/07-revue-conformite.md` · 284 · 35 (§5) |
| Retrait du fictif | `docs/landing-page/01-architecture.md` · 341 · 40 (§6.1, §6.2) |
| Portes de la mise en production | `21-plan-de-developpement.md` · 314 · 14 (§5.8) |
| `staging` : règles, liste fermée, constats D70, retour arrière | `runbooks/staging.md` · 1 · 32 ; · 144 · 18 (§5) ; · 250 · 17 (§9) ; · 267 · 13 (§10) |

## Code existant à réutiliser

- `apps/web` : `next.config.ts` (`BASE_SECURITY_HEADERS`, `securityHeadersFor`, `NOINDEX` ; CSP sans
  nonce du J4), `src/proxy.ts`, `tests/guards.test.ts` (G1 à G7, bloc R7), `eslint.config.mjs`,
  `src/content/placeholders/`, `components/landing/MockupBanner.tsx`, usages du fictif
  (`[locale]/layout.tsx`, `[locale]/page.tsx`, `HeroSection`, `StartFormSection`, `StartFormSteps`,
  `start-form-validation.ts`, `AudienceDoors`, `Button`, `LinkButton`, `landing-content.ts`,
  `i18n/routing.ts`, `styles/tokens.css`), `components/landing/cookie-consent.ts`.
- `apps/backoffice` : `next.config.ts` (CSP sans nonce ; aucun `proxy.ts`), `src/app/accueil/`
  (blocs J8S-1, J8S-4), `components/DualControlScreens.tsx` (J8S-2), `src/messages/fr.ts`.
- `apps/api/src/domains/ops/` : `recorder.ts`, `repository.ts`, `routes.ts` (`client-errors`),
  `scrub.ts` ; tables `ops.error_groups`, `error_occurrences`, `request_metrics`,
  `process_metrics`, `periodic_runs` (`0016`). Aucun battement ni sonde : à créer.
- `apps/api/src/` : `worker.ts`, `config/schema.ts` (`isDeployedEnvironment`, D70),
  `domains/maintenance/periodic.ts`, `domains/identity/critical-alert.ts` (P0 synchrone, à
  réutiliser), `platform/brevo-transactional.ts`, `domains/identity/throttle-keys.ts` (J8S-6),
  `server.ts` (`/v1/status`), `platform/internal-auth.ts`.
- D67 : `domains/leads/connectors/brevo/index.ts` (`list_not_configured`, ~l. 559),
  `connectors/apollo/`, `domains/leads/drain.ts` (`would_send`), `domains/leads/queue.ts`,
  `domains/backoffice/sync-causes.ts` ; `0139` (`apply_brevo_ids_from_environment`), `0140`, `0141`.
- Exploitation : `apps/api/scripts/staging-check.ts`, `staging-check-rules.ts`,
  `reset-staging-internal-account.ts`, `script-guards.ts` ; `deploy/railway/*.json` ;
  `.github/workflows/ci.yml` (`main` et `production`, I-4 bloquant sur `production` seule).
- `supabase/migrations/` : dernière `0141` ; `0130` (`alert_definitions`, AL du Lot 1), `0134`
  (AL25). `packages/test-kit` : harnais des gardes partagées (G5), `operator-secrets.ts`.

## Décisions encore ouvertes

- Fondateur : `02` §20.11 points 2 à 4 (destinataires des alertes et astreinte, offre Railway Pro,
  rodage de 30 jours) ; D33 (pays exclus et juriste) ; D35 ; D36 ; un compte `admin` distinct de
  l'`agent` (PD7) ; accord de mise en production et de fusion vers `production` (`21` §5.8, D71).
- `integrateur` : HSTS `preload` une fois les domaines arrêtés (J4S-8).
- `expert-cybersecurite` (revue groupée) : seuil des `429`, seuil propre de `request-code`, accès à
  l'écran « Santé technique », points « À relire » de D67 (`05` l. 1882) ; C5.c sans ligne de
  registre (`04` §9.3 « Exception ») : l'admettre ou créer un type d'événement.
- `product-owner` : numéros des alertes techniques (EC-J9-4) ; seuil d'AL25 ; `15` Q2 à Q4.
- `expert-conformite-rgpd` (Lot 6, condition d'entrée dans `production`, D71) : verdict L9,
  exemption de consentement du collecteur navigateur, RG118, RG121 (veto), retrait propagé à Apollo,
  notice art. 15, F8, contreparties du risque D70 (a).

## Planchers

Recomptés au commit 3 (2026-10-21) : `pnpm test` = **2 655** (contracts 87, test-kit 119,
backoffice 34, web 205, `apps/api` unitaire 1 134 en 55 fichiers, base 1 076 en 49 fichiers) ;
`test:db` = **1 076** (49 fichiers ; planchers relevés : `t8-reauth-email-change` 33,
`tm1-email-change-route` 22, `tm1-periodic-runs` 33, `tm1-periodic-tasks` 16 ; unitaires
`brevo-webhook` 53, `periodic-scheduler` 26). Seul `apps/api` est figé (J8T-6 généralise au
commit 10) ; tout nouveau fichier `db-tests` entre dans `case-floors.ts`.

## Issu du commit S

- Webhooks Brevo de `staging` : visaient `web-production-*`, repointés sur `web` de `staging` ; une
  *Blacklist* manuelle n'émet rien, la preuve passe par une campagne réelle (runbook §8).
- D70 §9 vert sauf l'effacement Apollo (`erasure_not_propagated`, Lot 5) ; `BREVO_LIST_ID_*` et
  `APOLLO_API_KEY` absentes ne bloquent le `worker` qu'à D67-b (RG162).
- J4R-1 : agent et `admin` de `staging` réinitialisés (mot de passe et TOTP). Watch Paths déjà conformes.

## Issu du commit 1

- J8S-3 : claim absent ou malformé ⇒ `influx.current_session_id()` `NULL` ⇒ R refuse en `42501` seul ;
  fonction exécutable par `influx_identity_definer` seul. API inchangée (`session_id` déjà posé).
- J8S-5 : deux politiques (une par rôle) ; T2 : `member_invitations` « propres lignes » pour l'agent.
- J8S-4 : `admin_role_grants(p_days)` (1 à 30, défaut 7) ; « accordé par » = `granted_by_account_id`
  du payload, sinon l'acteur. F4 : index partiel (`actor_account_id is not null`).
- `test:db -- <fichier>` lance toute la suite : un fichier seul par `npx vitest run --project db <fichier>` (`apps/api`).

## Issu du commit 2

- J8S-2 : cible de la 2V = compte membre par rôle, pays, date d'inscription, raison sociale et lien vers la fiche, **jamais l'adresse** (lue sur la fiche journalisée, RG40) ; invitation `admin` par adresse invitée et rôle (EC-J8-62).
- J8S-7 : `POST /v1/bo/accounts/search` = filtres + **au plus un** terme dans le corps ; l'écran liste par lui seul (un instant de période n'est pas un caractère simple du relais, EC-62) ; `email`/`q` en URL ⇒ `400` ; EC-J8-58 levée (`@`, `.` admis) ; terme en mémoire de l'écran, jamais dans la barre d'adresse.
- J8S-1 : revue `?weeks=` 1 à 53, **4 par défaut**, `admin` seul (agent refusé et journalisé `backoffice.dual_control`) ; bloc d'accueil `admin` seul. J8S-4 : `adminRoleGrants` dans `GET /v1/bo/alerts` (7 j, `admin`).
- J8S-6 : `0143` ajoute `backoffice_reauth_ip` (60 / h ; IP inconnue : clé globale propre à R) ; prochaine migration libre **`0144`**.

## Issu du commit 3

- J7S-1 : pas de réglage `influx.session` nouveau ; la session de la requête est la claim `session_id` déjà posée (`influx.current_session_id()`, `0142`), exigée par `consume_member_reauthentication` (`0144`, 55000 inchangé).
- A2 : `reserveCodeRequest` (IP puis adresse, compteurs de la connexion) **avant** la transaction membre ⇒ `429 rate_limited`, code frais intact ; message web `rateLimited`.
- C5.c : détenteur lu par `generateLink`, `identity.email_change_holder_is_orphan()` (`0144` : demande propre, deux côtés confirmés, ouverte ; sur l'id), suppression puis un essai ; GoTrue indisponible ⇒ `503`, demande ouverte ; aucune ligne de registre (la purge horaire reste le chemin compté).
- J7S-2 : `breaker.orphan_ratio` / `breaker.filter_refused` dans `maintenance.periodic.failed`, run `failed`, rien supprimé (alerte : J7S-8, commit 8). J7S-3 : l'exception A4 n'existe que pour sa surface ⇒ `404` avant le contrôle d'origine. Prochaine migration libre **`0145`**.

## Issu du commit D67-a

- Journal : déclencheur AFTER, `SECURITY DEFINER` (`influx_leads_definer`), seul écrivain de `settings.changed` ; le contexte (`reason_code`, 2V, `reevaluated`) passe par `influx.sync_setting_change` (fermé, lié à la session, effacé à l'usage, sinon `22023`) ; acteur = `session_user` (opérateur et migration : système + `db_session_user`, EC-J9-D67a-1, 4).
- Garde `23001` (EC-J9-D67a-5) ; `updated_at := clock_timestamp()` au seul changement de valeur (EC-J9-D67a-2) ; Apollo : réévaluation avant l'`UPDATE`, valeur inchangée ⇒ rien écrit, 2V consommée (EC-J9-D67a-3).
- Pour D67-b : `GRANT SELECT (updated_at)` à `influx_leads_definer` ; marge pour une correction validée après le début d'une tentative ; TM1.11 / CA82 ne remettent plus une liste à `NULL` (sous-clé nouvelle à `NULL`, ou garde levée dans une transaction annulée) ; runbook : `COMMIT` aussitôt en `psql` (verrou de chaîne).
- `05` / `04` ne décrivent pas encore `influx.sync_setting_change` : additif regroupé à la clôture. Prochaine migration libre **`0146`**.

## Issu du commit D67-b

- RG161 dans la reprise `leads.recover_stale_outbox_lines(integer)` (même signature, même `GRANT`, résultat + motif et code ; EC-J9-D67b-1) : ≤ 200 lignes de contact `failed`, réglage modifié après le **début** de la tentative à 60 s près, attente jusqu'à date + 60 s (une modification ⇒ au plus un nouvel échec, EC-J9-D67b-3) ; `credentials_missing` par l'instant de démarrage du processus (`influx.worker_started_at`, local à la transaction, EC-J9-D67b-2) ; jamais `template_not_configured` (D69 ; file transactionnelle au Lot 5).
- Démarrage : `apply_brevo_ids_from_environment(jsonb)` devient l'étape de démarrage (réglages en vigueur + instant, `0146`) ; verdict RG162 commun au worker et à `staging:check` (`brevo_list_ids.creators`, `rate_limits.<destination>_per_minute`) ; base injoignable : attente de 5 s (les 5 redémarrages Railway préservés) ; refus de la base : sortie 1.
- TM1.13 au niveau du processus impossible (un environnement déployé refuse la base locale, D70 S1) : prouvé sur le verdict (`leads-start-check`) et l'étape de démarrage en base. À aligner à la clôture : `18` TM1.13 (contre-test « `staging` » ⇒ `development`, CA85) et `05` RG162 (plus de modèle, D69).
- `0146` reclasse en `failed` les `skipped` `list_not_configured` / `apollo_settings_invalid` (EC-J9-D67b-4 ; 5 sur `staging`) ; `template_not_configured` inchangés. Jusqu'à D67-c, `sync-causes.ts` affiche ces échecs en `other_failure`. Prochaine migration libre **`0147`**.
- `staging` : jeton Railway refusé (`Invalid RAILWAY_TOKEN`, P3, fondateur) : `staging:check` KO sur les variables Railway, réglages en base verts (RG162 Apollo compris).

## Issu du commit D67-c

- Contrat : `syncStatus.setting` et `alert.setting` (liste fermée `SYNC_SETTINGS`, noms seuls) ; le réglage d'une liste Brevo vient du rôle du compte (`list_not_configured` ⇒ annonceurs / créateurs). AL25 `configuration_missing` : une alerte par réglage, calculée à la lecture, tombe seule après le rattrapage RG161.
- Rejeu : aucune migration, `leads.replay_outbox_lines` remet déjà tout `failed` en file ; motif `configuration_fixed`. Les `skipped` de configuration d'avant `0146` s'affichent aussi en incident, jamais en cas normal.
- Libellés `template_not_configured` conservés pour d'éventuelles lignes anciennes (D69). Local : 556 lignes `pending` résiduelles des tests supprimées (saturaient le lot de 50 de TM1.11) ; `t8-gotrue-findings` b4 intermittent, vert seul.

## Issu du commit 4

- Hôte Supabase absent de `img-src` / `connect-src` de `apps/web` : il ne sert qu'à E1 (téléversement direct, Lot 2), qui l'ajoutera depuis `src/config/`. HSTS toujours sans `preload` (J4S-8).
- Pages de `apps/web` rendues à la requête (`force-dynamic`) : un nonce ne se pré-rend pas. CSP du proxy sur les pages ; ailleurs (relais, fichiers, `_next`), celle de `next.config.ts`, sans nonce ni élément en ligne.
- La redirection « barre oblique finale » du routeur Next partait **sans aucun en-tête** : `skipTrailingSlashRedirect` + redirection `308` dans les proxys (T10.4).
- Sans `'unsafe-inline'` nulle part : `ResponsiveImage` retire le `style` de `next/image` (classes équivalentes) ; `@influx/contracts` prend zod de `src/zod.ts` (`jitless` au navigateur : la sonde `new Function` levait une violation). `next dev` seul : `'unsafe-eval'` et styles en ligne.
- Reste : les pages 404 par défaut de Next (styles en ligne refusés, fond clair) ⇒ pages d'erreur aux jetons au commit 7 (T13). T10.5 reste couvert par `apps/api` (`auth-cookies.test.ts`).

## Issu du commit 5

- Photos **définitives** (fondateur, 2026-10-21) : sorties du module fictif vers `src/content/images/` ; `CREDITS.md` = manifeste de la garde G4 (crédits toujours vérifiés), `camera.png` déclaré dans la garde ; textes alternatifs dans `landing.images`. Les 16 photos des blocs fictifs (cartes, études de cas, résultat) restent au dépôt, non affichées.
- Non rendus faute de contenu réel (`02` §2.8) : chiffre clé, vitrine, résultat, logos, études de cas, cartes créateurs, conversation fictive, adresse de contact ; « Conditions de vente » et « Mentions légales » absentes du pied (D25). Section 15 fondue dans le renvoi final (mêmes deux portes) ; liens de navigation de l'en-tête et du pied encore inertes.
- À relire par `expert-ux` (antérieur au commit) : le badge de `ShortVideoOverlay` ressemble au logo YouTube ; la photo principale du héros ne correspond pas à son texte alternatif.
- Planchers : `pnpm test` = **2 722** (contracts 89, test-kit 119, backoffice 36, web 188, `apps/api` unitaire 1 155, base 1 135). `test:db` local rouge sur un cas intermittent (436 lignes `pending` résiduelles des e2e saturant le lot de TM1.11, comme à D67-c) ; commit accepté par le fondateur.

## Issu du commit 7

- T15 : `PUBLIC_ROUTE_RATES` (`src/platform/public-rate.ts`, 14 routes sans session, par adresse et par instance, à la minute, avant le corps, adresse inconnue = un seul seau), toujours au-dessus des plafonds horaires en base (RG44 répond le premier) ; webhook Brevo seul exempté ; tout `429` porte `Retry-After` (60 s pour les compteurs en base). Valeurs à confirmer à la revue groupée `expert-cybersecurite`.
- T7 sur `next start` : Next répond **avant** le relais à `//` et `\` (308 même origine, sans nos en-têtes ni `no-store`), à un encodage cassé (500 brut) et résout `.` / `..` ; jamais d’appel à `apps/api`. Cible absolue (`https://x@evil.tld/…`) ⇒ 308 vers cette autorité, inatteignable d’un navigateur : **constat de l’entrée Railway sur `staging` à faire** (revue groupée).
- T13 fronts : 404 et écrans d’erreur aux jetons (`[locale]/[...rest]` ⇒ 404 localisée, rendue au client par Next, coquille `__next_error__`). T11 : 3e artefact = fichiers exécutés de `apps/api` (`API_RUNTIME_DIRECTORIES`).
- J4S-6 : texte strict (ni contrôle, ni format, ni usage privé, ni demi-paire) au contrat, au collecteur et dans `scrub.ts` ; 5 empreintes navigateur par compte et par heure (en mémoire). « Aucune alerte nouveau groupe du seul navigateur » ⇒ commit 8 (filtre `source = 'server'`).
- Planchers : `pnpm test` = **2 835** (contracts 116, test-kit 122, backoffice 36, web 188, `apps/api` unitaire 1 237, base 1 136). Local : `t14` « internal-accounts » rouge par 1 779 profils internes accumulés (plafond 200), vert au premier passage ; 1 025 lignes `pending` résiduelles supprimées (TM1.11).

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche ; ne lire que les
  tranches du commit en cours, et le code par `Grep` avant `Read`.
- Pendant le codage : seul le fichier de test en cours, `--reporter=dot`. Suite complète avant
  chaque commit (`CLAUDE.md` §7).
- Sous-agents : `expert-database` aux commits 1, D67-a et 8 ; `product-owner` en début de commit 8
  (EC-J9-4, additif court) ; `integrateur` aux commits S et 11 ; sinon revue groupée
  `expert-cybersecurite` + `testeur` en fin de jalon (non bloquante sur `main`, exigée avant
  `production`, D71). Skill `backoffice-ops` aux commits 2, D67-c et 9 ; `design-system-influx` aux
  commits 5 et 9 ; `railway-deploy` aux commits S, 8 et 11 ; `env-secrets` au commit 8 ;
  `lead-pipeline` à D67-b. Pas de `chef-de-projet`.
- Arbitrages en cours de jalon : ajouter une section « Issu du commit N » ici (5 lignes au plus),
  jamais de récit dans `21`.
- À la clôture : 1 ligne par commit dans `21` §J9, additifs `15` / `17b` (EC-J9-4, EC-J9-5), `18`
  §10 « Lot 1 » coché, `pnpm docs:index`, puis réduire cette fiche au reliquat du Lot 2.
