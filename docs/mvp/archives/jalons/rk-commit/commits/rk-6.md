# RK-6 — `feat(ui): soft header glow on the screen container`

Grille `dev-react-node`. Invoque le skill `design-system-influx`.

**Lire :** fiche, ligne RK-9 et RK-A de « Valeurs et classes », arbitrage « Halo d'en-tête », paires
interdites ; `20` §11.4 (valeurs `--size-header-glow` et seuil TK2.2 fixées à RK-0) et §11.5 ; `02`
§21.5 point 7. Code : `apps/web/src/components/member/shell-classes.ts` (`SPACE_SCREEN_CLASSES`,
`SCREEN_CLASSES`), `apps/web/src/components/auth/auth-classes.ts` (`AUTH_GLOW_CLASSES`),
`member/ui/PageHeader.tsx`, `apps/backoffice/src/components/shell-classes.ts`, `tokens.css`.

**Livrer :**

- `--background-image-header-glow` KEO : `radial-gradient(ellipse 50% var(--size-header-glow) at 50% 0%,
  color-mix(in srgb, var(--color-brand-primary) 15%, transparent), transparent)` ;
  `--size-header-glow` dans `:root`, valeur de RK-0.
- `bg-header-glow bg-no-repeat` sur les conteneurs d'écran (web : `SPACE_SCREEN_CLASSES`, donc
  `SCREEN_CLASSES` ; BO : `SCREEN_CLASSES`) ; le `div` décoratif de `PageHeader` et `AUTH_GLOW_CLASSES`
  supprimés. Un seul halo par page.
- G3d : contrastes au pic du halo (`#0d291d` environ) ajoutés à la matrice.

**Prouver :** TK2.1 à TK2.3 libérés et verts (sonde de pixels de RK-1, seuil de RK-0) ; aucun défilement
horizontal à 320, 375, 768 px ; `color-mix` toujours dans la liste de G3i ; TK8 vert ; `pnpm test:e2e`.

**Après le commit :** `/clear`, puis `/rk-commit ux 6`.
