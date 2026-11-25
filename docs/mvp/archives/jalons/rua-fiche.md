# Jalon RUA — Socle de la refonte : charte amendée, tokens, gardes, outillage de comparaison, jeu de recette
> Source : `lot3bis-plan.md` l. 23, `22-refonte-ux-ui/08-plan-de-developpement.md` l. 39-50, D87 · 2026-11-25 · Statut : ouvert (validé le 2026-11-25) · Annexe : `rua/annexe.md`

## Objectif et périmètre
Poser ce dont dépendent tous les écrans du Lot 3bis : décisions transverses écrites (D88), charte `20` et
architecture `02` amendées, tokens des maquettes et gardes, points de rupture et animations, outillage qui
compare une maquette à l'application (N1 à N3, `22-refonte-ux-ui/05` §3), jeu de recette synthétique, planche d'états hors
production, planche des états non dessinés (RU-27). **Aucun écran ne change** : ni API, ni base, ni contrat,
ni libellé produit, ni donnée de `staging`. Écrans : `RUB` et suivants.
**Hors périmètre :** composants (RUB, RUC), AN-2, specs de domaine (tête de chaque jalon), RU-14 (textes EN, par
jalon), part juriste de RU-02 (ne bloque que RUB-09 et RUH), N1 à N3 sur l'application.

## Invariants
1. Aucun code avant la réponse F0 « accord de démarrage » (D87), mot pour mot dans la note de `run.md`.
2. Produit inchangé : hors `docs/`, `.claude/skills/`, tests, `packages/test-kit`, `packages/ui`,
   `tokens-backoffice.css`, `globals.css`, configuration Playwright et point d'entrée de la planche (B §6), le
   diff du jalon est vide ; `packages/contracts`, `apps/api`, `supabase` intacts ; aucune clé i18n ajoutée.
3. Vitrine : les trois JSON `vitrine-*.json` intacts ; G3e et `vitrine-unchanged` verts ; aucun token de `@theme` renommé ni revalué.
4. Une valeur de maquette = un token de même valeur, nommé par `A` (`modele-ux.md`) ; aucune couleur ni longueur
   en dur hors `tokens.css` et `tokens-backoffice.css` (G3), aucun `/NN`, aucune opacité numérique ; bloc KEO opaque
   et fermé (G3c) ; `color-mix` selon `B` §4 seulement (G3i).
5. Tokens du seul backoffice : nom `-bo-`, dans `tokens-backoffice.css` seul, aucun dans `apps/web` (G3f).
6. Sous KEO, aucun `clamp(` ni `vw` dans un `--text-*` ou `--tracking-*` (TK7.3) ; trois paliers fixes (RU-01).
7. Une garde ne s'assouplit pas : tout changement de garde est nommé, motivé et prouvé par son cas négatif (TD1).
8. Aucune dépendance (`package.json`, `pnpm-lock.yaml` intacts) ; mouvement réduit : durées à 0, aucune
   transformation (AN-1) ; ni `transition: all`, ni `height`, ni `max-height` animés (AN-4).
9. Outil : la maquette figée (commit `954e009`) contre elle-même rend 0 écart à N1, N2, N3 ; un écart volontaire
   est vu à chaque niveau ; aucune image committée ni mise à jour pour passer ; masques de `R05` §3 seulement.
10. Jeu de recette synthétique (domaine `example.test`), jamais sur `staging` ni `production` ; aucun montant
    côté créateur (D48, D78) ; ni e-mail ni téléphone de l'autre partie (D46).
11. Planche d'états absente de la construction de production (preuve sur l'artefact), sans session ni secret.
12. RU-27 : aucun état non dessiné n'est « accepté » sans la réponse F1 par famille ; RU-27 inscrite avant RUB.
13. e2e : +20 s au plus pour le jalon ; éclats ≤ 7 min 30, job ≤ 8 min ; planchers jamais baissés.

## Lectures
Commun : cette fiche. `R03`, `R04`, `R05`, `R06a`, `R06b`, `R02a`, `R02c`, `R01` = fichiers de
`docs/mvp/22-refonte-ux-ui/` ; `02`, `18`, `20` = spécifications de `docs/mvp/` ; `A`, `B` = `rua/modele-ux.md`,
`rua/modele-archi.md`. Code :
`TS` = `packages/ui/src/styles/tokens.css`, `BO` = `apps/backoffice/src/styles/tokens-backoffice.css`,
`GK` = `packages/test-kit/src/guards.ts`, `CD` = `packages/test-kit/src/charter-data.ts`.
| # | Tranches principales (le prompt complète) |
|---|---|
| A | `R06a` l. 23, 28-34, 37, 38, 41 ; `R03` §3.1 à §3.3 (l. 45-122) ; `R04` §2 (l. 24-37) ; `20` §11.3 (l. 447-609), §11.5 (l. 679-794) |
| B | `R06a` l. 25, 26, 40, 42 ; `02` §21.3 (l. 2348-2439), §21.5 (l. 2484-2574), §21.6 (l. 2575-2597) ; `R05` §3 à §4 ; `apps/web/playwright.config.ts` ; `ci.yml` l. 304-480 |
| 00 | `A`, `B`, F0 ; `20` §10 (l. 356-379), §11.3, §11.5, §11.8 (l. 860-916) ; `02` §21.2, §21.3 ; `04-DIRECTION-ARTISTIQUE` l. 173-182 ; `18` l. 1077-1117, 1758-1804 ; `R06b` §7 (l. 134-163) ; D87 de `decisions-detail.md` |
| 01 | `A`, `B` §4 ; `R03` §3 ; `TS` l. 338-470, 592-701 ; `GK` l. 1022-1060, 1186-1230, 1861-1960 ; `CD` l. 1-130, 197-353 |
| 02 | `A`, `B` §1 ; `R04` §2, §5 ; `TS` l. 415-443, 582-588 ; `BO` entier ; `apps/backoffice/tests/guards.test.ts` l. 515-538 |
| 03 | `R05` §1 à §3, §6 ; `B` §5 ; `R01` ; `apps/web/e2e/support/rendering.ts` l. 133-260, 280-345 |
| 04 | `R05` §4, §5 ; `R06b` §5 (l. 64-121) ; `apps/web/e2e/support/{account,creator-search,campaign-states,verification-cycle,database}.ts` |
| 05 | `B` §6 ; `R05` §6 ; `apps/web/next.config.ts` ; `packages/test-kit/src/artifacts.ts` ; `guards.ts` G8 (l. 1467-1560) |
| 06 | `R06a` l. 49 (21 questions) ; §5 des fiches citées ; `R02a` §2, §4 (C08, C09, C17, C20), `R02c` |
| 07 | `20` §11 amendé (00) ; `.claude/skills/design-system-influx/` (SKILL.md ≤ 10 Ko) |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| F0 | fondateur | Accord de démarrage ; RU-02 (part), RU-04, RU-05, RU-13, RU-17. |
| A | `docs(mvp): RUA arbitration, UX (RU-01, RU-06 to RU-12, RU-15, RU-16, RU-19)` | `rua/modele-ux.md` : noms et valeurs des tokens, choix UX, contrastes. |
| B | `docs(mvp): RUA arbitration, architecture (RU-03, RU-18, RU-20)` | `rua/modele-archi.md` : seuils, partage, G3i, projet Playwright, planche. |
| 00 | `docs(mvp): charter and architecture amended for the Lot 3bis (D88)` | `20`, `02`, `04-DIRECTION-ARTISTIQUE`, `18`, `R06a`, `R06b` §7, D88. |
| 01 | `feat(ui): the Lot 3bis tokens and their guards` | Tokens de `R03` §3 (couleurs, longueurs, effets), gardes G3c, G3d, G3f, G3i. |
| 02 | `feat(ui): the Lot 3bis breakpoints, keyframes and animation tokens` | `--breakpoint-form`, `bo-wide`, `--animate-*`, AN-1, AN-3, AN-4. |
| 03 | `test(e2e): the mockup comparison tool (N1, N2, N3)` | Outil, relevé des 147 états, projet Playwright `visual`. |
| 04 | `test(e2e): the synthetic acceptance data set` | Données de recette par espace, chargeurs existants. |
| 05 | `test(web): the component state board, out of production` | Planche d'états, garde de construction. |
| 06 | `docs(mvp): the board of undrawn states (RU-27)` | `docs/audit-ux-ui/prototypes/planche-etats.html`. |
| F1 | fondateur | Réponse par famille sur la planche de 06. |
| 07 | `docs(skill): design-system-influx for the Lot 3bis` | Skill et `references/`, RU-27 inscrite (06a, D88). |

Après 07 : U (`expert-ux`), R (revue groupée), C (clôture).
