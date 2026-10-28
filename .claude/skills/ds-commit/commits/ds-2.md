# DS-2 — `feat(tokens): KEO theme block in tokens.css (D73)`

Rien ne s'active : aucun rendu ne change (G3e et TD4 verts sans toucher leurs fixtures).

**Lire :** `02@2326+48` (§21.3), `02@2508+20` (§21.8), `20@444+152` (§11.3, table), `20@596+42`
(§11.4), `18@1077+29` (G3, G3b, G3c, G3d, G3f), `18@1693+15` (§12.5, points 1 et 2).

**Livrer :**

- Bloc `[data-theme="keo"]` dans `apps/web/src/styles/tokens.css` : table §11.3, aucune valeur
  nouvelle, alias redéclarés, `KEO_INHERITS` et `VITRINE_ONLY` commentés entrée par entrée ; rôles
  nouveaux déclarés dans `@theme` ; tokens de gabarit (colonne, barre du bas, `z-nav-bottom`) ; copie
  octet pour octet dans `apps/backoffice`.
- Gardes : G3 amendée ; G3b par charte, avec un cas négatif KEO ; G3c ; G3d (un seul module de données :
  `SUCCESS_MIN_HUE_GAP = 20`, paires de §11.4, succès KEO `#3ccfcf` ; la garde calcule, elle ne décide
  pas) ; squelette de G3f.

**Attention :** tout contrôle par charte passe par `effectiveTokens`, jamais par `tokenValue`.
