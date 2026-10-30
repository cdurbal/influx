# RK-5b — `feat(backoffice): Manrope titles at fixed sizes, overline, tracking and smoothing`

Grille `dev-react-node`. Invoque le skill `design-system-influx`. RK-5a (membres) est fait : calque ses
choix, ne les rediscute pas.

**Lire :** fiche, lignes RK-5, RK-6, RK-7 ; le diff de RK-5a (`git show --stat HEAD` puis le seul
`heading-classes.ts`). Code : `apps/backoffice/src/components/bo-classes.ts`, `shell-classes.ts`,
`auth-classes.ts`, `apps/backoffice/src/app/layout.tsx` ; puis
`Grep "text-lead|text-heading-|tracking-wide|SECTION_TITLE_CLASSES" apps/backoffice/src`.

**Livrer :** dans `bo-classes.ts`, `SECTION_TITLE` identique aux membres et
`BLOCK_TITLE` = `font-display text-sm font-bold` ; `h3` de `HealthProcesses`, `HealthStatus`,
`HomeScreen` → `BLOCK_TITLE` ; `TITLE_CLASSES` en approche serrée ; `ENV_NAME_CLASSES` :
`tracking-wide` → `tracking-overline` ; `antialiased` sur `<html data-theme="keo">` du backoffice.

**Prouver :** TK3 côté BO, TK3.4 (`html` du BO), TK7.2 sur les fichiers de classes du BO, libérés et
verts ; axe BO vert ; `pnpm test:e2e`.
