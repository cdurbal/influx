# RUB-fix-3 — `fix(web): the chevron of a campaign row with a sentence alone`
Grille `dev-react-node`. U-4.
**Lire :** `rub/ux-constats.md` l. 12 (fait foi) ; `rub/modele-ux.md` l. 21 (`1fr auto`) ; `U/row-list-classes.ts`
l. 80-108, 200-246 ; `tests/member-lists.test.ts` l. 41, 130-160 ; `PB/list.board.tsx` l. 65-95 ;
`e2e/state-board.spec.ts` l. 430-556.
**Livrer :**
- `md:contents` (corps et fin de ligne) seulement quand `campaignOf` rend une grille ; avec `sub` seul, la ligne reste
  souple : texte à gauche sur la largeur libre, chevron au bord droit à toute largeur.
- Formes avec date et avec état seul : classes identiques à celles d'aujourd'hui.
**Ne pas toucher :** `RowList.tsx` sauf nécessité, les sept autres variantes, tokens, `apps/web/e2e/case-floors.ts`.
**Prouver :** unitaire RUB-T4 : les deux assertions `md:contents` des lignes 156 et 159 lisent `SHAPE` (aucun champ,
donc sans grille) : les porter sur une forme à grille, même force, et ajouter le cas négatif (`sub` seul et aucun
champ : pas de `md:contents`) ; le nommer et le motiver au message de commit (invariant 8, TD1). e2e, dans le cas
RUB-AN2 04 existant (aucun cas neuf) : à 1 440, cellule `campaign-sub`, bord droit du chevron au bord droit de la
ligne moins son rembourrage (2 px de tolérance). Rouge avant, vert après. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test state-board --reporter=line`.
**Arrêt si :** une autre assertion devrait changer.
