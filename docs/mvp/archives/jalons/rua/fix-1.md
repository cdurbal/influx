# RUA-fix-1 — `test(e2e): the state board axe check at 375 and 1440 (RUAU-J1)`
Grille `testeur`. Skill : `test-strategy`. Origine : `ux-constats.md` J1 (constat de jalon, non bloquant) ; accord du fondateur le 2026-11-25 (`valider fix-1`).
**Lire :** `ux-constats.md` J1 ; `docs/mvp/22-refonte-ux-ui/05-recette-visuelle.md` §6 ; `apps/web/e2e/state-board.spec.ts` ; fiche, invariant 13.
**Livrer :** dans `apps/web/e2e/state-board.spec.ts`, boucler sur 375 × 812 et 1 440 × 900 avec `expectNoAxeViolation` ; à 375, ajouter `scrollWidth <= clientWidth` sur `[data-state-board]` ; facultatif seulement si le budget le permet : `Tab` jusqu'à un bouton puis assertion de l'anneau de focus (solid, 3 px, décalage 2 px, couleur `--color-focus-ring`). Plancher de `apps/web/e2e/case-floors.ts` relevé si des cas s'ajoutent, jamais baissé.
**Ne pas toucher :** la planche (`*.board.tsx`), les gardes, `ci.yml`, les tokens ; aucune dépendance.
**Prouver :** `pnpm check:fast` ; le spec en local si la pile démarre (sinon la CI le rejoue) ; budget e2e du jalon : +20 s au plus au total (invariant 13).
**Arrêt si :** une violation axe réelle à 375 px (la corriger relève d'une autre ligne : la rapporter, ne pas toucher la planche).
