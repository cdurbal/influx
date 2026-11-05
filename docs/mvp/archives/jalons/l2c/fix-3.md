# L2C-fix-3 — `test(e2e): sum of a milestone's case durations from the JSON report`
Grille `testeur`. Constat L2CT-3 : fiche § Revue, `l2c/revue-constats-testeur.md`.
**Lire :** `21` l. 63-66 (§2.3, points 1, 2) ; `apps/web/playwright.config.ts` l. 62-67 ;
`apps/web/package.json` l. 14 ; `packages/test-kit/scripts/check-case-floors.ts` (forme) ;
`run.md` notes 15 à 18c ; `git diff e177d7d..HEAD --stat -- apps/web/e2e/`.
**Livrer :**
- `packages/test-kit/scripts/sum-e2e-durations.ts` (jamais `check-*` : I-4) : trois rapports JSON et
  une liste de cas (fichier, titre) ; médiane par cas, somme ; cas absent = échec ; sortie courte.
- Cas ajoutés ou allongés par L2C, tirés du diff (`backoffice-queue.spec.ts`, deux cas neufs de
  `brand-profile.spec.ts`, cas admin de `backoffice.spec.ts`) ; un cas antérieur allongé compte pour
  son allongement, dit.
- Trois `pnpm test:e2e` sans rejeu, rapports hors dépôt ; la somme dans la note de `fix-3`, en somme.
- ≤ 20 s : rien d'autre. Au-delà : réduire sans plancher baissé ni assertion affaiblie (attente
  superflue, préparation par l'API), remesurer ; encore au-delà : ligne `B` de type `fondateur` après
  `fix-3` dans `run.md`, question exacte (« constater N s, ou fusionner X et Y, plancher baissé, gain
  G s »), rien décidé.
**Ne pas toucher :** `.github/workflows/`, `check-*`, planchers, attendus, autres specs.
**Prouver :** `pnpm check:fast` ; script en échec sur un cas absent ; trois sommes dans la réponse.
**Arrêt si :** un passage rouge ; un levier exige un fichier I-4 ou un plancher baissé.
