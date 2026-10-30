# RK-2 — `fix(ui): read the button glow through var() under KEO`

Grille `dev-react-node`. Invoque le skill `design-system-influx`.

**Lire :** fiche, lignes RK-1 et RK-A de « Valeurs et classes » et l'arbitrage « Correctif de C1 » ;
`02` §21.3 point 3. Code : les deux `src/styles/tokens.css`, `apps/web/src/components/member/ui/button-classes.ts`,
`apps/backoffice/src/components/auth-classes.ts`, `packages/test-kit/src/charter-data.ts`,
`apps/web/tests/member-ui.test.ts`.

**Livrer :**

- `--shadow-action-glow` supprimé de `@theme` **et** du bloc KEO ; `:root` : `--effect-action-glow` et
  `--effect-action-glow-hover` = `0 0 transparent` (jamais `none`) ; bloc KEO : les deux valeurs
  `color-mix` de la fiche (25 % et 40 %).
- Bouton principal membres et `PRIMARY_BUTTON_CLASSES` du BO :
  `shadow-(--effect-action-glow) not-aria-disabled:hover:shadow-(--effect-action-glow-hover)` (BO :
  `not-aria-disabled:not-disabled:hover:`) ; `aria-disabled:shadow-none disabled:shadow-none` gardés.
- G3i (a) sur les sources (espaces de noms interdits sous KEO, `@theme inline` interdit, liste blanche
  `color-mix` de RK-A dans `charter-data.ts`) ; `member-ui.test.ts` mis à jour sur les nouvelles classes.
- `tokens.css` recopié à l'identique dans l'autre front (diff octet pour octet nul).

**Prouver :** TK1.1 libéré (`test.fail()` retiré) et vert dans les deux fronts ; G3i (a) avec son
négatif ; TK8 vert ; `pnpm test:e2e`. Ne touche ni au `scale` ni aux graisses (RK-4).
