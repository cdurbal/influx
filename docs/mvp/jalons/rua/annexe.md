# Jalon RUA — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au commit (`apps/web/tests/case-floors.ts`,
`apps/web/e2e/case-floors.ts`, `artifact-floors.ts`, `packages/test-kit/tests`), jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| RUA-T1 | unitaire | `apps/web/tests/lot3bis-tokens.test.ts` | table nom → valeur de maquette (`R03` §3, `modele-ux.md`) égale à `tokens.css` et `tokens-backoffice.css`, aucune valeur orpheline | 4 | 01 |
| RUA-T2 | unitaire | `apps/web/tests/guards.test.ts`, `apps/backoffice/tests/guards.test.ts`, `packages/test-kit/tests` | G3c, G3d, G3f, G3i et leurs cas négatifs sur les tokens neufs ; `-bo-` seuls dans `tokens-backoffice.css` | +3 | 01 |
| RUA-T3 | e2e + unitaire | `vitrine-unchanged.spec.ts`, `guards.test.ts` (G3e) | vitrine inchangée, JSON intacts | 0 (existants verts) | 01, 02 |
| RUA-T4 | unitaire, artefact | `apps/backoffice/tests/guards.test.ts`, `keo-tokens.artifacts.ts` (les deux fronts) | `--breakpoint-form`, `bo-wide`, `bo-small` gardée, `--animate-*` nommés, ni `height` ni `all`, lus ou justifiés (G3i b) | +2 | 02 |
| RUA-T5 | e2e | `charter-rendering.spec.ts` | AN-1 : `--animate-*` à 0 s sous mouvement réduit, squelette à `none` | +1 | 02 |
| RUA-T6 | unitaire, e2e | `visual-compare.test.ts`, spec `visual-*` (projet `visual`) | maquette contre elle-même = 0 écart à N1, N2, N3 ; trois écarts volontaires vus ; normalisation des couleurs et familles | 6 ; 4 | 03 |
| RUA-T7 | unitaire, e2e | `recette-data.test.ts`, une spec ≤ 2 cas | jeu synthétique, `NON_RECETTABLE` exact, un chargeur par espace | 5 ; 2 | 04 |
| RUA-T8 | artefact, e2e | `build.artifacts.ts`, une spec ≤ 1 cas | planche absente de la construction de production ; rendue en e2e, axe 0 | +1 ; 1 | 05 |

**Budgets.** e2e : ≤ 20 s pour le jalon (`lot3bis-plan.md` l. 49), mesurés en CI : T5 ≤ 2 s, T6 échantillon ≤ 8 s
(le reste hors CI, B §5), T7 ≤ 5 s, T8 ≤ 4 s (19 s en tout). Base : aucun test base. Éclats ≤ 7 min 30, job ≤ 8 min.

## Critère de fin
- [ ] F0 : accord de démarrage et Q2 à Q6 répondus, mot pour mot dans la note (« oui partout », 2026-11-25)
- [ ] D88 écrite ; chaque RU-01 à RU-20, hors RU-02 et RU-14, « Tranchée » ou « Écart accordé » dans `R06a`
- [ ] `20`, `02`, `04-DIRECTION-ARTISTIQUE`, `18` amendés avant le premier commit de code (00 avant 01)
- [ ] Tokens de `R03` §3 présents, valeurs égales aux maquettes (RUA-T1) ; G3c à G3i vertes (T2)
- [ ] Vitrine inchangée : G3e, `vitrine-unchanged`, JSON intacts (T3)
- [ ] Seuils et `--animate-*` livrés, AN-1, AN-3, AN-4 (T4, T5) ; `package.json` et `pnpm-lock.yaml` intacts
- [ ] Maquette contre elle-même : 0 écart à N1, N2, N3 ; écart volontaire vu à chaque niveau (T6)
- [ ] Jeu de recette par espace, `NON_RECETTABLE` écrit (T7) ; planche hors production (T8)
- [ ] RU-27 : F1 répondue par famille, reportée dans `R06a` et D88 (07)
- [ ] Skill `design-system-influx` à jour, `SKILL.md` ≤ 10 Ko (07)
- [ ] U, R soldées ; `pnpm check` et `pnpm test:e2e` verts ; e2e ≤ +20 s
- [ ] Aucun commit sur `apps/api`, `supabase`, `packages/contracts` ; aucun marqueur I-4 requis (R)

## Écarts, décisions ouvertes, risques
- **EC-RUA-1** (préparation) : RU-02 (juriste) et RU-14 (textes EN, par jalon) ne bloquent aucun commit de RUA ; le
  plan les range dans « bloque RUA ». RU-02 bloque RUB-09 et RUH ; F0 Q6 la pose tôt.
- **EC-RUA-2** : `R03` §3.3 nomme des tokens de seul backoffice sans `-bo-` (`grid-record`, `grid-decision`,
  `grid-check`, `grid-sync`, `size-choice-dense`, `size-alert-code`) alors que G3f exige `-bo-` ; `--grid-record` dépend de
  `--spacing-bo-panel-w` : renommés par A.
- **EC-RUA-3** : la garde `bo-small` compare la liste des fichiers porteurs de `@custom-variant` : `bo-wide` dans le même
  fichier double l'entrée ; dédupliquée, sans autre changement (B §1, 02).
- **EC-RUA-4** : un alias de couleur redéclaré dans le bloc KEO et non lu par une classe échoue en artefact (G3i b) :
  `UNREAD_JUSTIFIED` des deux fronts, retiré au premier emploi (RUB, RUC).
- **EC-RUA-5** : un projet Playwright `visual` est exclu des éclats CI (`--project=chromium`), mais `pnpm test:e2e`
  local l'exécute et le rapport fusionné en CI lui manque : plancher et exécution à régler en B §5.
- **EC-RUA-6** (mesure demandée par `lot3bis-plan`) : skills du domaine : `design-system-influx` 9 625 octets,
  `backoffice-ops` 6 880 ; aucune au-delà de 10 Ko pour RUA.
- **Risque** : RUA-03 (XL) : diff de police ou de date entre deux rendus de la même maquette ; parade : même
  Chromium, locale `fr-FR`, masques de `R05` §3. **Risque** : RU-18 non vérifiable avant RUC-01 (deux implantations).
- **Décisions ouvertes** hors RUA : RU-21 à RU-44 selon `lot3bis-plan` ; RU-35, RU-39, RU-44 ouvertes (fondateur).
- **Question d'organisation** : un ou deux fils de développement (`lot3bis-plan`, Questions) : à trancher avant RUB.

## Revue
(rempli par /jalon-run : RUAT-n, RUAS-n, une ligne chacun)
