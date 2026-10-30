# RK-4 — `feat(ui): press, zoom and weights of the KEO buttons`

Grille `dev-react-node`. Invoque le skill `design-system-influx`.

**Lire :** fiche, lignes RK-2, RK-3, RK-4 de « Valeurs et classes », arbitrage « Durée et courbe » et
« Bouton texte » ; `20` §11.5 (mouvement) et §11.8 (boutons). Code : `button-classes.ts` (membres),
`apps/backoffice/src/components/auth-classes.ts`, `bo-classes.ts` (`SMALL_PRIMARY_CLASSES`,
`SMALL_SECONDARY_CLASSES`), `tokens.css`.

**Livrer :**

- Tokens : `--scale-hover` KEO 1.02 → 1.03 ; `--scale-press` nouveau dans `@theme` (1, vitrine), 0.98
  sous KEO ; `--font-weight-action-secondary` nouveau (500 → 600 sous KEO). Durées et courbes
  inchangées.
- Base des deux fichiers de boutons : `motion-safe:not-aria-disabled:active:scale-(--scale-press)`
  (BO : `not-disabled:` en plus).
- `font-action` quitte la base pour les seules variantes `primary` et `danger` ; `secondary` (membres,
  `SECONDARY_BUTTON_CLASSES`, `SMALL_SECONDARY_CLASSES`) lit la graisse secondaire ; bouton texte en 600,
  sans `scale`.
- Petits boutons du BO sobres : ni ombre ni `scale`, dans les trois états.
- G8 étendue (TK7.4) : `motion-safe:…active:scale-(--scale-press)` accepté, `active:scale-…` et
  `hover:scale-…` hors `motion-safe:` refusés, avec négatifs.

**Prouver :** TK1.2, TK1.3, TK1.4, TK7.4 libérés et verts ; aucun défilement horizontal à 320 px avec un
bouton pleine largeur survolé à 103 % (cas à ajouter s'il manque) ; TK8 vert ; `pnpm test:e2e`.

**Après le commit :** `/clear`, puis `/rk-commit ux 4`.
