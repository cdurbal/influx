# R2A-fix-1 — `docs(mvp): fix R2AT-1 E2E reference and CI timing proof`
Grille `testeur`. Skill : `test-strategy`. Origine : `r2a/annexe.md` § Revue, `R2AT-1`.
**Lire :** `r2a-fiche.md` (invariants 9, 11) ; `r2a/annexe.md` l. 9, 13, § Revue ; `r2a/03.md` l. 11 ; `r2a/run.md` l. 8 ; `apps/web/e2e/signup-nominal.spec.ts`, `apps/web/e2e/case-floors.ts`, `apps/web/e2e/global-setup.ts` l. 38-45 ; CI `gh run view 45903383037` (`ccd2318`) et `45889493003` (`Browser journeys` 1/3..3/3, `Browser journeys, merged`).
**Livrer :**
- Remplacer `smoke.spec.ts` inexistant dans `r2a/annexe.md:9` (`apps/web/e2e/signup-nominal.spec.ts`) et `r2a/03.md:11` (`e2e/signup-nominal.spec.ts`).
- Relever sur `45903383037` (`ccd2318`, post-`4ccb74f`) la preuve complète `R2A-T3` : éclats `Browser journeys` 1/3..3/3, `Browser journeys, merged` (planchers `e2e/case-floors.ts` + `assertNoNewErrors`), et delta E2E mesuré contre `45889493003` (étapes `Browser journeys (Playwright)` et totaux d'éclats).
- Consigner la preuve et le delta (`≤ +2 s`) dans `r2a/annexe.md` (§ Tests l. 9, 13 et § Revue `R2AT-1`) ainsi que dans la note `fix-1` de `r2a/run.md` (≤ 160 car.).
**Ne pas toucher :** code, specs E2E, `playwright.config.ts`, `e2e/case-floors.ts`, autres constats (`R2AT-2`..`5`, `R2AS-1`..`6`), fichiers `RUB` non indexés.
**Prouver :** `Grep "smoke\.spec\.ts" docs/mvp/jalons/r2a/` vide ; durées exactes issues de `45903383037` vs `45889493003` (et `Browser journeys, merged`) consignées avec delta `≤ +2 s` ; `git diff --cached --name-only` limité aux fichiers `r2a/`.
**Arrêt si :** `45903383037` révèle un échec de plancher ou `assertNoNewErrors`, ou si le delta réel de l'étape Playwright dépasse `+2 s`.
