# RK-5a — `feat(ui): Manrope titles at fixed sizes, overline, tracking and smoothing (members)`

Grille `dev-react-node`. Invoque le skill `design-system-influx`. Côté **membres seulement** (web) ; le
backoffice est RK-5b.

**Lire :** fiche, lignes RK-5, RK-6, RK-7 et arbitrages « Approche serrée » et « Filet de sécurité » ;
`20` §11.5. Code : commence par
`Grep "text-heading-|text-lead|text-display|text-figure-|tracking-wide|font-semibold" apps/web/src/components apps/web/src/app` pour
dresser la liste, puis n'ouvre que ces fichiers.

**Livrer :**

- `--tracking-heading` KEO −0.01em → −0.025em (h1, h2 seulement).
- Nouveau `apps/web/src/components/member/ui/heading-classes.ts` : `SECTION_TITLE`, `CARD_TITLE`,
  `OVERLINE` exactement comme la fiche (surtitre jamais vert).
- Remplacements de la fiche : `h2` de `CodeNotReceived`, `CodeStep`, `EmailStep`, `MemberHome`,
  `PreferencesScreen` → `CARD_TITLE` ; porte de `DoorStep` → `font-display text-title-section font-bold` ;
  phrase de `CodeStep` et `FreshCode` → `font-display text-title-section font-extrabold` ; chiffres clés
  en `font-extrabold` ; `tracking-wide` → `tracking-overline` ; `LegalMarkdown` rendu sous KEO sans
  token fluide (la version vitrine des pages légales publiques ne bouge pas).
- `antialiased` sur le `<div data-theme="keo">` de `app/[locale]/(member)/layout.tsx` (et le dialogue
  des CGU s'il est rendu hors de ce conteneur) ; `html` et `body` de la vitrine intacts.
- G8 étendue (TK7.3) : refuse `text-display`, `text-heading-*`, `text-lead`, `text-figure-*` sous KEO ;
  aucun `clamp(` ni `vw` dans les `--text-*`/`--tracking-*` effectifs sous KEO ; TK7.2 (classe
  littérale sans règle compilée, négatif `tracking-wide`) ; TK7.5 volet lissage.

**Prouver :** TK3 (membres), TK7.2, TK7.3, TK7.5 (lissage) libérés et verts ; axe vert ; TK3.4 volet
vitrine (`auto` sur `/fr` et `/en`) vert ; TK8 vert ; `pnpm test:e2e`.
