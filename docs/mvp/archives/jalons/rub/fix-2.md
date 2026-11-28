# RUB-fix-2 — `fix(web): the current entry of the shell under forced colours`
Grille `dev-react-node`. Skill : `design-system-influx`. U-3.
**Lire :** `rub/ux-constats.md` l. 11 (fait foi) ; `rub/modele-ux.md` l. 24 (AP1) ; `components/member/shell-classes.ts`
l. 85-140 ; un porteur conforme (`Grep "outline-transparent"` dans `U/`) ; `e2e/member-shell.spec.ts` : TD5.4
(l. 275-298) et les deux cas RUB-T10 (l. 855 à la fin).
**Livrer :**
- Entrée, sous-entrée et cellule courantes : contour `transparent`, `border-width-thick`, décalé vers l'intérieur ;
  l'ancêtre le porte dans la barre seule (`max-lg:`), jamais dans la colonne.
- Au focus, l'anneau le remplace : couleur, épaisseur et décalages actuels (barre, colonne) intacts.
- Hors couleurs forcées, aucun rendu ne change ; ni `forced-color-adjust` ni mot-clé système.
**Ne pas toucher :** structure de la coquille, tokens, `U/`, `apps/web/e2e/case-floors.ts`.
**Prouver :** `emulateMedia({ forcedColors: "active" })` dans les cas RUB-T10 existants (aucun compte ni cas neuf,
invariant 16), puis `none` : à 1 440 et 375, courant `outline-style` ≠ `none`, inactif `none` ; ancêtre : contour à
375, aucun à 1 440 ; au focus d'un courant, anneau visible. Plus un cas unitaire de classes (`tests/member-nav-ui.test.ts`,
plancher relevé). Rouge avant, vert après. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test member-shell --reporter=line` (pile locale, F0 Q5) ;
`E2E_VISUAL=app` : aucun écart hors D1 à D4.
**Arrêt si :** pile locale absente ; TD5.4 rouge sans correctif qui garde l'anneau ; un écart visuel nouveau.
