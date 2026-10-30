# DS-9 — `feat(backoffice): KEO theme, fonts and density tokens`

**Lire :** `17b@263+100` (§1.7), `17b@2057+104` (§6, tokens `-bo-` seulement), `02@2326+48` (§21.3),
`18@1077+29` (G3, G3f, G4f).

**Livrer :**

- `<html data-theme="keo">` et polices (`fonts.ts` du backoffice) dans la mise en page racine.
- `tokens-backoffice.css` (rail, ligne de 36 px, cellules, contrôle) : uniquement des `--*-bo-*`,
  contrastés contre KEO.
- G3 côté backoffice, G3f complète, G4f côté backoffice (copies identiques à `apps/web`), TD3.2 et TD3.4
  côté backoffice.

**Attention :** aucun écran modifié.

**Gelés :** `backoffice.spec`, `security-headers` (T10.2, T10.4, 404 du backoffice).
