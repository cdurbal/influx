# RUB-fix-10a — `test(e2e): the state board split by family, within the e2e budget`
Grille `testeur`. RUBT-1 (jalon), **voie A**. Après fix-6 à fix-9 (la mesure les inclut). fix-10b la remplace, ou la
suit pour le seul reste mesuré (choix du fondateur).
**Lire :** annexe § Tests (budget), § Revue ; `rub/modele-archi.md` l. 40-44 ; `e2e/state-board.spec.ts` l. 1-126,
puis par cas ; `PB/page.board.tsx` ; `tests/guards.test.ts` l. 657-688 ; `tests/state-board.test.ts` ;
`tests/build.artifacts.ts` l. 75-95 ; `packages/test-kit/src/guards.ts` l. 1702.
**Constat :** run 46062007755 : nouveaux cas 66 s, RUA-T8 de 1,3 à 15,4 s, ≈ 80 s pour 20 ; service non relevé.
**Livrer :**
1. RUA-T8 consigne son temps de service par annotation (`test.info()`), aucune assertion changée.
2. Scission de A §4 : `state-board/<famille>/page.board.tsx` ; racine = index, sans section ; `next.config.ts` intact.
3. Chaque cas n'ouvre que sa famille ; axe et débordement (375, 1 440) une fois par page de famille, dans le cas qui
   l'ouvre déjà ; RUA-T8 : 4 s et règle du `h1` par page, chaque entrée de `COMPONENTS` dans une seule page. Chaque
   section reste couverte par axe aux deux largeurs.
4. Gardes suivies, nommées, un cas négatif chacune (TD1) : `expectedFiles`, sous-dossiers, page de famille dans
   l'artefact de production détectée.
**Ne pas toucher :** composants, textes ; aucun cas fusionné ni sorti de `state-board.spec.ts` (plancher 14) ;
`apps/web/e2e/case-floors.ts` et tout fichier non commité de R2B (`git status`) ; `git add` de vos seuls chemins.
**Prouver :** `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test state-board --reporter=line`,
secondes par cas avant, après (message) ; au push suivant, secondes par cas en CI et service relevé (note de
`run.md`) : RUB (nouveaux cas + écart de RUA-T8) ≤ 20 s.
**Arrêt si :** total au-delà de 20 s (chiffres par cas ; suite : fix-10b) ; assertion retirée ou assouplie ; `next.config.ts`, `ci.yml` ou un `check-*` à toucher (marqueur I-4).
