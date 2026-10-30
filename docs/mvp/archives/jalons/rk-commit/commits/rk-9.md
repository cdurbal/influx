# RK-9 — `feat(backoffice): dense table head and row indicator`

Grille `dev-react-node`. Invoque les skills `design-system-influx` et `backoffice-ops`.

**Lire :** fiche, RK-15, arbitrages « En-tête du tableau » et « Filet de la ligne » ; `20` §11.8
(tableau dense). Code : `apps/backoffice/src/styles/tokens-backoffice.css`, `bo-classes.ts`
(`TH_CLASSES`, `rowClasses`), le composant de tableau dense qui les consomme (`Grep rowClasses`).

**Livrer :**

- `--effect-bo-row-indicator` dans `tokens-backoffice.css` (préfixe `-bo-` obligatoire, G3f) :
  `inset var(--border-width-thick) 0 0 var(--color-brand-primary)`.
- `TH_CLASSES` : `bg-surface-hover font-display font-bold text-sm text-text-secondary`.
- Ligne au survol **et** en `focus-within` : `bg-surface-raised` et
  `shadow-(--effect-bo-row-indicator)` sur la **première cellule** seulement (jamais sur `tr` : Safari
  ne la dessine pas ; aucun décalage en `border-collapse`). 4 px reste réservé à la vue identifiée.
- Densité des lignes (RK-16) : hors périmètre, n'y touche pas.

**Prouver :** TK6.1, TK6.2 (survol et focus clavier du lien ; aucune ombre au repos ni sur la ligne
voisine) libérés et verts ; G3f verte ; axe BO vert ; `pnpm test:e2e`. Vérifie qu'il ne reste **aucun**
`test.fail()` annoté RK dans le dépôt ; s'il en reste un, cite-le dans la réponse finale.

**Après le commit :** `/clear`, puis `/rk-commit ux 9`.
