# RK-8 — `feat(ui): clickable card border and filled badges`

Grille `dev-react-node`. Invoque le skill `design-system-influx`.

**Lire :** fiche, RK-10, RK-11, RK-B et la ligne « Contrastes calculés » ; `20` §11.3 (rôles
`border-hover`, `verified-bg`, `badge-error-bg`, valeur confirmée à RK-0) et §11.8 (cartes, badges).
Code : `tokens.css`, `apps/web/src/components/member/ui/status-badge-classes.ts`, `VerifiedBadge.tsx`,
la définition de `MEMBER_CLICKABLE_CARD_CLASSES` (`Grep`), `packages/test-kit/src/charter-data.ts`
(liste des rouges D72, G3b, G3d) et la garde G3g (modèle de la garde de confinement).

**Livrer :**

- Tokens : `--color-border-hover` (alias `text-secondary`, redéclaré sous KEO) ; `--color-verified-bg`
  (alias `feedback-info-bg`, dans `KEO_INHERITS`) ; `--color-badge-error-bg` (seule valeur nouvelle du
  jalon), identique dans les deux fronts et inscrit dans la liste G3b.
- `MEMBER_CLICKABLE_CARD_CLASSES` : `hover:border-border-hover`, repos `border-strong` gardé ; cartes non
  cliquables intactes.
- Badges remplis : succès, alerte, information `bg-feedback-*-bg` ; erreur `bg-badge-error-bg` ; neutre
  `bg-surface-raised` ; tous `font-display font-bold` ; `VerifiedBadge` : `bg-verified-bg font-display
  font-bold`, texte F3 inchangé. Aucun badge vert.
- Garde de confinement (TK7.5) : `badge-error-bg` consommé par le seul badge d'erreur, jamais le fond
  d'une notice (D72, DZ-6), avec négatif. Paires des badges dans la matrice G3d.

**Prouver :** TK4.1, TK4.2, TK7.5 (confinement) libérés et verts ; contrastes ≥ 4,5 ; axe vert ; TK8
vert ; `pnpm test:e2e`.
