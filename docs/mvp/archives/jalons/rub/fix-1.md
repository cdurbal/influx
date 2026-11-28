# RUB-fix-1 — `fix(web): no text under a button in the pager and the read-only panel`
Grille `dev-react-node`. Skill : `design-system-influx`. U-1, U-2 (même cause : boîte de texte réduite sous un bouton incompressible).
**Lire :** `rub/ux-constats.md` l. 9-10 (fait foi) ; fiche, invariants ; `U/pager-classes.ts`, `Pager.tsx` ;
`U/inner-panel-classes.ts`, `InnerPanel.tsx` ; `PB/dialog.board.tsx` l. 555-669, `PB/surface.board.tsx` l. 70-90 ;
`e2e/state-board.spec.ts` : `Grep "pager|inner-panel"`.
**Livrer :**
- U-1 : sous `form`, la position sur sa propre ligne ; au-delà, un côté n'est jamais plus étroit que son bouton ;
  ordre du DOM, rôles, noms, `data-*` et côté absent à sa place conservés ; commentaire de tête à jour.
- U-2 : `readonly`, largeur de base de la valeur `basis-(--size-note-min)` et `wrap-anywhere` ; l'action passe à la ligne.
**Ne pas toucher :** `Button`, tokens, textes, autres variantes de C05, `apps/web/e2e/case-floors.ts`.
**Prouver :** assertions ajoutées aux cas existants de `state-board.spec.ts` (RUB-T7, RUB-AN2 02 ; aucun cas ni parcours
neuf, invariant 16) : à 375, toutes les cellules `pager` sans intersection position / boutons et sans débordement de
côté ; à 1 440, plafond et curseur de même ; `inner-panel-readonly` à 375 : texte de la valeur contenu dans sa boîte,
sans intersection avec « Modifier ». Rouge avant, vert après. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test state-board --reporter=line`.
**Arrêt si :** une assertion existante devrait être retirée ou assouplie.
