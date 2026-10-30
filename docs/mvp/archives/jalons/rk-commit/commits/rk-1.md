# RK-1 — `test(e2e): rendered-state safety net for the KEO charter`

Grille `testeur`, plus `architecte` pour la sonde de pixels et `integrateur` pour les planchers.
**Aucun code de production** : seuls tests, aides, fixture, auto-tests de gardes.

**Lire :** `18` §12 (TK1 à TK8 et règles R1 à R4, amendés par RK-0) et §5.1 (G3i, TK7) ; puis le code :
`apps/web/e2e/charter-cascade.spec.ts`, `vitrine-unchanged.spec.ts`, `backoffice.spec.ts` (aides de
session semée et de mesure à réutiliser, rien à dupliquer), `apps/web/e2e/case-floors.ts`,
`packages/test-kit/scripts/check-case-floors.ts`, `packages/test-kit/src/guards.ts`,
`packages/test-kit/src/charter-data.ts`.

**Deux questions à trancher d'abord, et noter en EC :**

1. **`check-case-floors` et `test.fail()`** : lis le script ; un cas `test.fail()` attendu en échec
   doit compter comme exécuté. S'il ne compte pas, corrige le script au plus juste, avec son test.
2. **Sonde de pixels TK2.2** : `page.screenshot()` → `createImageBitmap` + canvas dans la page, sans
   dépendance nouvelle. Si c'est impossible, arrête-toi et écris la question pour `architecte`.

**Livrer :**

- Aides partagées (un module sous `apps/web/e2e/`) : attente de fin d'animation
  (`Promise.all(el.getAnimations().map((a) => a.finished))`, jamais d'attente fixe) ; état appuyé
  (`mouse.down()`, lecture, sortie de l'élément, `mouse.up()`, aucun clic) ; ratio
  `getBoundingClientRect().width / offsetWidth` ; sonde de pixels ; relevé des titres `h1`–`h4`.
- `apps/web/e2e/charter-rendering.spec.ts` : TK1 à TK6 côté membres ; cas BO dans `backoffice.spec.ts`.
  Chaque cas qui échoue sur le code actuel est en `test.fail()` annoté `RK-n` (le commit qui le
  corrigera) ; un cas déjà vert reste un test normal. Mesure sur l'élément réel, dans l'état concerné,
  sur la construction de production (R1) ; chaque absence est un cas à part (R2).
- TK3.1 greffé sur les passes axe existantes (`18` §12.2), sans dupliquer la navigation.
- `vitrine-states.json` (TK8.2) **capturée maintenant**, sur ce code : survol, appui, focus des boutons
  d'appel et d'une carte de la landing (`box-shadow`, ratio, `border-color`, `font-weight`,
  `-webkit-font-smoothing`, `transition-*`), plus le cas qui la compare (vert dès ce commit).
- Auto-tests TK7 dans `packages/test-kit` : chaque garde nouvelle a son cas négatif rouge (ex.
  `.shadow-action-glow{--tw-shadow:none}`, minifié et CRLF ; `tracking-wide` sans règle) ; la garde
  elle-même peut rester en `.fails`/`test.fail()` jusqu'à son commit.
- Planchers relevés (`case-floors.ts` web, test-kit).

**Prouver :** sur ce code, chaque `test.fail()` échoue bien pour la raison attendue (vérifie une fois
qu'un cas retourné en test normal est rouge avec le bon message, R4) ; `pnpm test:e2e` vert ; ajout de
durée e2e mesuré (budget du jalon ≤ 60 s) ; palier « code sans base ».

**Réponse finale :** la liste `cas TK → commit RK qui le libère`, pour les sessions suivantes.
