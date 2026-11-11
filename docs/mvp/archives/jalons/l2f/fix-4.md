# L2F-fix-4 — `test(e2e): creator verification waits for its page before the agent acts`
Grille `dev-react-node` (tests : grille `testeur`). L2FT-1 (jalon) : fiche § Revue ; `l2f/revue-constats-testeur.md` l. 33-38 (fait foi).
**Lire :** `apps/web/e2e/verification-creator.spec.ts` l. 195-280 (cas FR de la l. 51, `:44` dans les journaux CI), l. 460-465 ; `e2e/support/journey.ts` l. 175-186 (`open`, `reload`) ; `playwright.config.ts` l. 52-55 (`retries: 0`, gardé) ; `gh run view 42816747442 --log-failed | tail -n 60` (lecture seule) pour confirmer la cause ; `21` §8, ligne DS-flaky.
**Livrer :**
- Après le clic « retour » de la l. 244 : attendre la page cible (`toHaveURL` ou titre du profil, comme l. 210-211) avant `requestsOf` et `refuseAsAgent`.
- `page.reload()` des l. 197, 227, 250, 274, 463 remplacés par `reload(page)` de `support/journey.ts` (hydratation attendue).
- `21` §8, ligne DS-flaky seulement : L2F, `verification-creator.spec.ts:44` (runs 42681708083 et 42816747442, L2FT-1), corrigée par `fix-4` ; `relay-integration.artifacts.ts` T7.3, `EPIPE`, deuxième occurrence (run 42583733529, push `344eea5`, sans `rerun`).
**Ne pas toucher :** application, API, base, `retries`, autres specs ; aucun attendu affaibli, aucun plancher baissé.
**Prouver :** `pnpm --filter @influx/web exec playwright test verification-creator.spec.ts --repeat-each=3 --reporter=line` vert trois fois sur trois, médiane du cas FR avant et après notée ; `pnpm check:fast`.
**Arrêt si :** la trace montre une autre cause (régression de l'écran) : la dire, ne rien masquer ; un attendu devrait changer.
