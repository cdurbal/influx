# Jalon L3A — Reliquat avant le Lot 3, skills allégés, job base en deux éclats
> Source : `jalons/lot3-plan.md` l. 31 (validé le 2026-11-13) · 2026-11-13 · Statut : à valider · Annexe : `l3a/annexe.md`

## Objectif et périmètre
Solder ce que `21` §8 fait échoir « avant le Lot 3 » : L2D-E2E (job base, `fix-5a` choix A), L2CS-6,
L2GS-8 (volet publication), L2DS-3, L2DS-5. Poser l'attestation de L2G, différée faute de CI (L2GT-9).
Affecter F3, retrouvé (J8, revue du commit 8 : « liste d'autorisation des codes du journal exporté »,
`git show 7d7fd240:docs/mvp/jalons/j8-fiche.md` l. 44) : l'`activity_log` de l'export « mes données »
sert tous les codes d'audit, sans filtre. Ramener `design-system-influx` et `backoffice-ops`
(20 Ko chacun) à un `SKILL.md` de 10 Ko au plus.
**Hors périmètre :** écrans, routes et e2e (budget e2e : 0 s) ; tables du Lot 3 ; bornes de tranches
(L2DS-6 sans objet) ; filtre SQL de la recherche (L2GS-8, volet recherche : L3E) ; `price_bands` (L3B).

## Invariants
1. Aucun plancher de cas baissé ; l'union des éclats base couvre chaque fichier du projet `db` une
   fois et une seule, sinon le job de contrôle échoue.
2. En local, `pnpm --filter @influx/api test:db` reste la suite entière, inchangée.
3. CI : chaque éclat base ≤ 7 min 30, job entier ; éclat le plus long + contrôle ≤ 8 min (F0).
4. `profiles.publish_creator_review_entry()` refuse en 55000 un compte `suspended` ou `deleted` ; le
   rejet, la libération et la prolongation de la prise en charge restent possibles.
5. `profiles.advertiser_duplicate_candidates()` rend les mêmes lignes, dans le même ordre ; ses deux
   index sont partiels (`where status = 'published'`).
6. Une fonction remplacée garde son propriétaire, `search_path = ''`, `REVOKE … FROM PUBLIC` et ses
   `GRANT` nominatifs (`03` P7) ; tout `GRANT` neuf et tout objet `audit.*` touché sont signalés (I-4).
7. Aucune fonction possédée par `influx_identity_definer` ne contient d'`execute` dynamique
   (assertion de fin de `0301` et test).
8. T1-R : aucune relation ni fonction accessible à `influx_advertiser`, quel que soit son schéma, ne
   dépend d'une table `profiles.creator_%` hors `ADVERTISER_EXCEPTIONS` (vide à ce jour).
9. F3 : chaque code de `audit.event_types` porte une classification explicite, sans valeur par
   défaut ; l'`activity_log` ne sert que les codes exportables ; les autres sections de l'export
   sont inchangées.
10. Skills : frontmatter inchangé, aucune règle perdue (liste avant et après), `SKILL.md` ≤ 10 Ko,
    chaque référence lisible d'un seul `Read` (≤ 16 Ko, comme `matching-spec`).
11. L'attestation de L2G couvre exactement les SHA de `l2g/revue-constats-securite.md` l. 98-101.

## Lectures
Chemins `archives/jalons/` abrégés en `arch/`.
| # | Tranches |
|---|---|
| 01 | `arch/l2g/revue-constats-securite.md` l. 96-115 ; `arch/l2g/cloture.md` l. 10-12 ; `git show c07e0b0` ; `gh run view 43394059337` |
| 02 | `.claude/skills/design-system-influx/SKILL.md` (par tranches) ; patron : `.claude/skills/matching-spec/SKILL.md`, `git show --stat 3285b2e` |
| 03 | `.claude/skills/backoffice-ops/SKILL.md` (par tranches) ; même patron |
| 04 | `arch/l2g/fix-5a.md` ; `arch/l2g/revue-constats-testeur.md` l. 46-50 ; `.github/workflows/ci.yml` l. 180-245, 246-362, 473-560 ; `apps/api/scripts/run-tests.ts`, `check-case-floors.ts` ; `apps/api/vitest.config.ts` ; `apps/api/db-tests/case-floors.ts` |
| 05 | `arch/l2c/revue-constats-securite.md` l. 15 ; `arch/l2g/revue-constats-securite.md` l. 20 ; `arch/l2d/revue-constats-securite.md` l. 15 ; `0210` l. 395-465 ; `0244` l. 485-550, 915-1112, 1780-1800 ; `03` l. 818-835, 900 |
| 06 | `arch/l2d/revue-constats-securite.md` l. 13, 15 ; `apps/api/db-tests/profiles-creator-identity.test.ts` l. 60-70, 190-225 ; `0217` l. 598-630 |
| A | `0245` l. 729-739 ; `0006` l. 53-79 ; `04` l. 573-600 ; `runbooks/demandes-rgpd.md` l. 75-95 ; `16` l. 1137 ; `0137` l. 2836-2845 |
| 07 | `l3a/f3.md` (arbitrage) ; `0245` l. 168-818 ; `apps/api/db-tests/t8-privacy-execution.test.ts` (cas de l'`activity_log`) |

Migrations : `supabase/migrations/NNNN_*.sql`, désignées par leur numéro.

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `chore(security): attest the end-of-L2G review` | Commit vide d'attestation de la revue de L2G, CI verte sur `da4109f` (run 43394059337) : L2GT-9 soldé. |
| 02 | `chore(claude): split the design-system-influx skill` | `SKILL.md` ≤ 10 Ko (règles, check-lists, renvois) ; le reste dans `references/`. |
| 03 | `chore(claude): split the backoffice-ops skill` | Même découpe pour `backoffice-ops`. |
| 04 | `ci(db): database tests in two shards` | Job base en deux éclats à pile propre, job de contrôle des planchers sur l'union ; push de 01 à 04 et mesure. |
| 05 | `fix(db): 0301 refuse publishing a non-active creator and index duplicate lookups` | L2GS-8 (55000 à la publication), L2CS-6 (deux index partiels), assertion de fin L2DS-5. |
| 06 | `test(db): T1-R across every schema by dependency, no dynamic SQL in identity definer` | T1-R par `pg_depend`/`pg_rewrite` et `prosrc`, tous schémas (L2DS-3) ; test L2DS-5. |
| A | arbitrage `expert-cybersecurite` (sans commit de code) | F3 : règle d'exclusion, stockage de la classification, liste des codes ; écrit `l3a/f3.md`. |
| 07 | `feat(db): 0302 allowlist of audit codes in the personal data export (F3)` | Classification sur `audit.event_types`, `activity_log` filtré, cas en base ; push de 05 à 07. |
