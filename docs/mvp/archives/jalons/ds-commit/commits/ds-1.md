# DS-1 — `test(guards): theme-aware token readers and a frozen vitrine`

Aucun code de production. Tout se pose sur le code actuel et doit être vert **avant** le moindre
changement, sinon le filet est faux.

**Lire :** `18@1077+29` (§5.1), `18@1602+22` (§12.1), `18@1647+30` (§12.3 et attendus existants),
`18@1355+14` (§9.3, A-7), `02@2326+48` (§21.3, sémantique bloc KEO / `@theme` / `:root`).

**Livrer :**

1. `packages/test-kit` guards : `effectiveTokens(css, charte)` (bloc KEO, sinon `@theme`, sinon
   `:root` ; alias suivis ; cycle ou cible absente = erreur), fermeture des alias, écart de teinte
   avec seuil en paramètre (aucun 20 en dur). Auto-tests TD1.1 à TD1.8, valeurs de TD1.7 exactes. Pars
   de l'existant (`tokenValue`) sans le casser.
2. G3e et l'instantané `apps/web/tests/fixtures/vitrine-tokens-d59.json` (`@theme`, `:root`, `@media` ;
   ajouts permis).
3. `e2e/vitrine-unchanged.spec.ts` : TD4.2 (empreinte de styles calculés, `/fr` et `/en`, 375 et
   1440 px, fixture `e2e/fixtures/vitrine-computed-styles.json` produite par un script relançable) et
   TD4.3.
4. Filet global A-7 (TD8.1) : fixture Playwright automatique ; une requête hors origine des fronts ou
   une violation de CSP fait échouer l'e2e (option explicite de T10.6 conservée).
5. Planchers relevés aux effectifs mesurés.

**Attention :** tout détecteur a son cas négatif (G7) ; TD1.8 prouve que le lecteur lit le bon bloc.
