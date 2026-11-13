# L3A-fix-1 — `test(e2e): no telephone-like digit run in the run tag`
Grille `testeur`. L3AT-1 (jalon) : annexe § Revue (fait foi) ; DS-flaky de `21` §8 (L2ET-6).
**Lire :** annexe § Revue, L3AT-1 ; `apps/web/e2e/support/backoffice.ts` l. 35-38 (`runTag`) ;
`apps/web/playwright.config.ts` l. 33-36 ; `packages/domain/src/shared/contact-detection.ts` l. 20-21,
34, 75 (`PHONE_RUN`, `PHONE_MIN_DIGITS`) ; `apps/web/e2e/backoffice-queue.spec.ts` l. 82-90, 422-428.
**Livrer :**
- `runTag` : une lettre au milieu de l'identifiant de run (`id.slice(0, 4) + "x" + id.slice(4)`),
  commentaire citant RG19 (`PHONE_MIN_DIGITS = 8`) : aucun nom tiré de `runTag` ne porte 8 chiffres
  consécutifs, quel que soit l'identifiant de 8 caractères de `playwright.config.ts:36`.
**Ne pas toucher :** RG19 et `packages/domain` ; `playwright.config.ts` et `mailboxes.ts` (adresses
de boîte inchangées) ; attendus des specs ; planchers ; `21` §8 (la ligne C y porte cause et run).
**Prouver :** chaque passage avec un identifiant neuf, 100 % numérique (adresses neuves) :
`INFLUX_E2E_RUN=12345678 pnpm --filter @influx/web exec playwright test backoffice-queue --reporter=line`
avant le correctif (L2C-16 et L2C-17 rouges : cause confirmée) ; le même avec `87654321` après (vert) ;
puis sans la variable (vert) ; `pnpm check:fast`. Les trois issues dans la note de `run.md`.
**Arrêt si :** la reproduction reste verte avant le correctif (cause non confirmée : dire ce qui est
vu) ; un nom d'e2e contrôlé par RG19 naît de l'identifiant hors de `runTag` (le nommer).
