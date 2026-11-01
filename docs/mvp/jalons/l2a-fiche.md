# Jalon L2A — Dette d'ouverture, marge e2e, référentiels du Lot 2

> **Source :** `jalons/lot2-plan.md` l. 25 (ligne L2A) et l. 35-47 (reliquat repris) · **Préparé le**
> 2026-11-01 par Claude Code (`/jalon-prepare L2A`) · **Statut :** validé par le fondateur le
> 2026-11-01 (réponses en fin de fiche) · **Exécution :** `/jalon-run l2a`, table `jalons/l2a/run.md`.

## Objectif et périmètre

Solder la dette qui précède les écrans du Lot 2 (RK-fin, PLS-1, PLS-3 et PLT-6, SNT-3, J4S-7),
regagner au moins 10 s d'e2e par l'horloge simulée de `journey-resume` (`21` §2.3 point 3), poser les
référentiels du lot (`0201`). **Ne change pas :** aucun écran, aucune route d'API, aucune règle métier,
aucun libellé, la vitrine (G3e, TD4, TK8.2) ; aucune table hors du schéma `reference` ; aucun montant,
taux, net ni tarif (CLAUDE.md §2, D48, D78).

## Invariants

1. Aucune ligne dans `reference.price_bands` ; colonnes `net_*`, contraintes et `REVOKE` de `04` l. 516-553
   créés tels quels ; aucun rôle d'exécution n'écrit un référentiel (T16).
2. Référentiels = schéma : chargés par `0201`, jamais par `supabase/seed` (`04` §11.1 règle 6) ; aucun
   libellé stocké, `label_key` seul (R8).
3. Droits calqués sur `0003` l. 265-308 : `SELECT` aux quatre rôles métier, membres avec contexte,
   `agent` et `admin` en aal2 ; RLS activée et forcée ; rien d'autre. Chaque table entre dans
   `expected-rights.ts` dans le même commit (T2).
4. Tranches : bornes entières, borne haute incluse, contiguës, sans chevauchement, dernière ouverte ;
   engagement en points de base ; `age_bands.min_age >= 18` (D15) ; genres en tranches, jamais en
   pourcentage. Valeurs : D79 point (10), `07` RG114 et RG115, `04` §4.2.
5. Tests : aucun attendu affaibli ; l'horloge simulée ne remplace que des attentes ; ni `retries`, ni
   `waitForTimeout`, ni délai relevé ; planchers jamais baissés (`case-floors.ts`).
6. e2e : ajout du jalon ≤ 20 s ; cas neufs : un cas par page et par langue, largeurs en boucle dans le
   cas (`21` §2.3 l. 63-67).
7. `/health` de `apps/web` : 200 ou 503, corps vide, `no-store`, état par processus seulement.
8. Dépendances en version exacte (`savePrefix: ""`), `minimumReleaseAge` respecté ;
   `@supabase/supabase-js` et `@supabase/postgrest-js` toujours absents ; suite locale complète (D76).
9. Aucun nom ni pseudo dans un chemin des espaces connectés : le collecteur d'erreurs envoie
   `location.pathname` (`packages/web-platform/src/observability/error-collector.ts` l. 42).

## Lectures

| Ligne | Tranches |
|---|---|
| 01 | `18` §12.7 l. 1801-1891 ; `20` §11.1 à §11.8 l. 393-907 (par tranches) ; `archives/jalons/rk-fiche.md` l. 38-44, 205-210 |
| 02 | `20` §11.7 l. 824-851 ; captures de 01 (`test-results/logo-test/`) |
| 03 | `archives/jalons/pl/revue-constats.md` l. 27 ; `21` §2.4 l. 75-77 ; `pnpm-workspace.yaml` l. 7, 13 ; épingles nommées dans `03.md` |
| 04 | `archives/jalons/pl-fiche.md` l. 228-262 ; `apps/web/e2e/journey-resume.spec.ts` l. 24-48, 187-215 ; `e2e/support/journey.ts` l. 177-205 ; `src/components/auth/AuthFlow.tsx` l. 67 ; `CodeStep.tsx` (compte à rebours) |
| 05 | `revue-constats.md` l. 16, 29 ; `apps/web/src/server/status-cache.ts` (25 l.) ; `src/app/health/route.ts` l. 15-40 ; `tests/status-cache.test.ts` (46 l.) |
| 06 | `git show 40e1559` (menu) et `git show 5e49da1` (liens de marque) ; `components/landing/landing-sections.ts`, `SiteHeader.tsx` l. 25-70, `SiteHeaderMobileMenu.tsx`, `SiteFooter.tsx` ; `e2e/case-floors.ts` |
| 07 | `archives/21-journal-lot1-archive.md` l. 68 ; `error-collector.ts` l. 35-50 ; `apps/web/src/lib/member-paths.ts` l. 1-40 ; arborescences `apps/web/src/app/[locale]/` et `apps/backoffice/src/app/` ; `packages/test-kit/src/guards.ts` l. 239-360 |
| 08 | `06` l. 212, 275-279 ; `07` l. 271-326, RG33 et RG34 l. 424-433, RG37 l. 441-444 ; `08` pièces par réseau (`Grep "par réseau"`) ; `09` l. 366, RG84 l. 657-659 ; `10` l. 208-227 ; skill `matching-spec` |
| 09 | `04` §4.2 l. 469-566, §11.1 l. 6058-6074, l. 6119, §12.12 l. 6345-6360 ; `07` RG113 à RG117 l. 535-594 ; `08` Q10 l. 1264 ; `decisions-detail.md` D79 point (10) ; `supabase/migrations/0003_reference_core.sql` l. 1-50, 265-308 ; `packages/test-kit/src/rights/expected-rights.ts` l. 116-140, 890-905, 971-985 ; `apps/api/db-tests/t2-rls-matrix.test.ts` l. 270-300, 658-760 ; `t16-commission.test.ts` l. 55-160 ; `jalons/l2a/referentiels.md` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `docs(mvp): charter traceability without orphan rule (RK-fin)` | `18` §12.7 : chaque phrase normative de `20` §11 a sa ligne, chaque preuve citée existe ; captures logo masqué pour 02, non commitées | contrôle scripté des identifiants |
| 02 | — (`ux`, sans commit) | Test du logo de `20` §11.7 par `expert-ux` (RK-fin) | — |
| 03 | `chore(deps): next 16.4 and zod 4.6.6 for the audited advisories` | PLS-1 ; **I-4** (`package.json` des fronts) | `pnpm audit --prod --audit-level high` ; suite complète |
| 04 | `test(e2e): simulated clock for the journey-resume waits` | Levier de `21` §2.3 point 3 | `journey-resume` trois fois avant et après |
| 05 | `fix(web): /health cache window from the answer, never a 429` | PLS-3, PLT-6 | 3 cas unitaires au moins |
| 06 | `test(e2e): landing menu scrolling and brand links` | SNT-3 | 4 cas e2e au plus, ≤ 8 s |
| 07 | `test: no name or handle in a connected-space path` | J4S-7, garde avant les routes de profil de L2B | garde + cas négatif |
| 08 | `docs(mvp): Lot 2 starting reference lists (L2A-08 arbitration)` | Arbitrage `expert-matching` : listes de départ absentes des spécifications | — |
| 09 | `feat(db): Lot 2 reference taxonomies (0201)` | `0201` ; **I-4** (`GRANT`, `REVOKE`, politiques) | T2, T16.4, T16.5, contraintes ; suite base complète |
| C | `docs(mvp): close the L2A milestone` | Clôture | `pnpm check` + `pnpm test:e2e` trois fois |

## Tests

Aucune famille nouvelle : les cas portent la règle qu'ils prouvent (`04` §4.2, D15, D79, RG114, RG115,
J4S-7, SNT-3, PLS-3, PLT-6).

- **03** : `pnpm audit --prod --audit-level high` exit 0 ; `pnpm check` puis `pnpm test:e2e` verts.
- **04** : cumul médian de `journey-resume` sur trois invocations avant et après ; gain ≥ 10 s ;
  assertions identiques (diff limité aux attentes et à l'horloge).
- **05** : `tests/status-cache.test.ts` + 3 cas au moins (échéance au règlement, levée synchrone, 429
  jamais gardé), horloge injectée ; plancher web relevé.
- **06** : menu de la landing (fr, en ; 1 440 et 375 px ; pied de page) et liens de marque ; chaque cas
  vu rouge par mutation locale (R4) ; cumul médian des cas ajoutés ≤ 8 s ; plancher e2e relevé.
- **07** : garde test-kit appliquée aux deux fronts, cas négatif sur arbre témoin ; planchers relevés.
- **09** : T2.1 à T2.7 avec les quatorze tables ; T16.4 et T16.5 étendus à `price_bands` ; fichier
  db-tests neuf : âge 17 refusé, contraintes nettes, tranches contiguës, valeurs exactes ; plancher base
  relevé ; suite base complète.
- **Durée e2e du jalon** : ajout ≤ 20 s (06 seul en ajoute) ; gain de 04 ≥ 10 s ; bilan net dans `run.md`.

## Critère de fin

- [ ] `pnpm audit --prod --audit-level high` sans critique ni élevée (03). *Preuve : sortie, exit 0.*
- [ ] e2e allégé : `journey-resume` au moins 10 s de moins (04) ; ajout du jalon ≤ 20 s (somme des
      médianes des cas ajoutés, trois passages de clôture) ; job « Browser journeys » sous 8 min.
      *Preuve : `run.md`, rapport JSON, run CI.*
- [ ] `0201` appliquée sur `staging`. *Preuve : job « Migrate staging » vert, comptes de lignes des
      quatorze tables lus (`runbooks/staging.md`).*
- [ ] T2 et T16 verts avec les quatorze tables ; suite base complète verte (09). *Preuve : sorties.*
- [ ] Reliquat L2A soldé : RK-fin (01, 02), PLS-1 (03), PLS-3 et PLT-6 (05), SNT-3 (06), J4S-7 (07)
      retirés de `21` §8 ; lignes déjà soldées par PL retirées avec leur sha (EC-L2A-1) ; DS-flaky
      relevé sur les trois passages ; RK-e2e mesuré. *Preuve : diff de `21` §8, `run.md`.*
- [ ] `pnpm check` puis `pnpm test:e2e` verts trois fois de suite sans rejeu ; CI verte sur le dernier
      commit. *Preuve : dernières lignes, numéro du run.*
- [ ] Revue `testeur` + `expert-cybersecurite` faite ; attestation `security-reviewed:` couvrant 03 et
      09 (D71). *Preuve : sha du commit d'attestation.*

## Écarts, décisions ouvertes, risques

- **EC-L2A-1** (préparation) : la clôture PL (`78d83b0`) annonce sept lignes retirées de `21` §8 et n'en
  retire aucune. Déjà soldées, vérifiées dans l'arbre le 2026-11-01 : J9S-6 et J9S-7 (`e9da967`,
  `status-cache.ts`), J9S-9, J9T-8, J9T-9 (`0d37fba`, `tm1-apollo-settings-parity`, `artifact-floors.ts`),
  J9T-5 (`92b6263`, `0dcc5ec`, `e2e/support/hydration.ts`), SNT-1 (`0dcc5ec`). Retirées à la clôture.
  J9S-7 est fait ; PLS-7 reste à L2C.
- **Décision absente** : listes de départ de `topics`, `networks`, `formats`, `sectors`, `usage_rights`
  et pays dont les régions sont chargées ; aucune spécification ne les donne → ligne 08 (arbitrage
  `expert-matching`, relu avec la grille `product-owner`, CLAUDE.md §7).
- **`price_bands` sans ligne** (choix prudent, D78) : le budget indicatif de la marque (`06` l. 278,
  obligatoire) en exigera à L2B ; lignes, devises et portée de D78 sur les budgets à trancher à la
  préparation de L2B (`expert-paiement-facturation`, fondateur). `07` Q7 (bornes nettes) reste ouverte,
  sans effet ici.
- `04` §4.2 omet `comment_bands` et les bornes de `publication_frequencies` (§12.12 points 3 et 4) :
  `0201` les crée ; `04` §4.2 mis à jour à la clôture (documentation groupée).
- Drizzle : aucune déclaration sans lecteur ; le premier dépôt qui lit un référentiel (L2B) l'ajoute.
- 03 : `sharp` < 0.35.5 et `source-map-js` < 1.2.2 (élevées, transitives de `next`, relevé du
  2026-11-01) : si la montée de `next` ne les corrige pas, `overrides` exacts et commentés (EC) ;
  `minimumReleaseAge: 1440` peut retarder la dernière version.
- 04 : si le compte à rebours dépend d'une heure serveur, l'horloge simulée changerait une assertion :
  arrêt.
- I-4 : 03 et 09 portent le marqueur à la revue, par attestation (D71).
- Risques : RK-e2e (marge) ; DS-flaky (`t14-backoffice-invitations-route`) relevé à chaque passage ;
  hors L2A : J9S-7 et PLS-7, PLK-1 (L2C) ; PLT-5, PLS-5, PLS-6 (L2F).

## Réponses du fondateur (2026-11-01)

1. Listes de départ des référentiels : fixées par `expert-matching` (ligne 08), validées par le
   fondateur à la relecture de la ligne.
2. `price_bands` sans ligne au L2A ; lignes et devises du budget marque tranchées à la préparation de
   L2B.
3. EC-L2A-1 : les sept lignes déjà soldées par PL sont retirées de `21` §8 à la clôture.

## Revue

(rempli par `/jalon-run` : `L2AT-n`, `L2AS-n`, `L2AU-n` pour le test du logo)
