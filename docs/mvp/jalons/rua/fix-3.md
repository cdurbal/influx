# RUA-fix-3 — `test(e2e): the acceptance loaders seed an agent, not an admin (RUAT-1)`
Grille `testeur`. Skill : `test-strategy`. Origine : `annexe.md` § Revue, RUAT-1 (constat de jalon, non bloquant).
**Lire :** `annexe.md` § Revue (RUAT-1) ; `apps/web/e2e/recette-loaders.spec.ts` l. 25-45 ;
`apps/web/e2e/support/recette.ts` l. 224-298 (`loadBackofficeSpace`, défaut `agent` l. 279) ;
`apps/web/playwright.config.ts` l. 80-83 (J8T-8) ; `apps/web/e2e/backoffice.spec.ts` l. 29, 637 (`onlyAdmin`).
**Livrer :**
- `recette-loaders.spec.ts` l. 35 : `role: "admin"` remplacé par `role: "agent"`, ou l'option retirée (défaut) ;
  aucune autre assertion changée (`agentId` ≠ `ownerAgentId` reste).
- `loadBackofficeSpace` garde son option `role` (`admin` pour RUB) : une phrase de son commentaire (l. 224-228)
  rappelle J8T-8 (un appel `admin` vit dans `backoffice.spec.ts` seul).
**Ne pas toucher :** `backoffice.spec.ts`, `playwright.config.ts`, les planchers (`e2e/case-floors.ts` : nombre de cas
inchangé), le jeu de recette, aucune dépendance ; `verification-backoffice.spec.ts:497` et
`verification-revocation.spec.ts:146` (admins antérieurs à RUA, hors plage de la revue).
**Prouver :** `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test e2e/recette-loaders.spec.ts --reporter=line` si la pile démarre
(sinon la CI le rejoue) ; `Grep '"admin"' apps/web/e2e/recette-loaders.spec.ts` : vide.
**Arrêt si :** le cas échoue avec `agent` parce qu'un droit propre à l'admin est requis (le rapporter, ne pas
déplacer le cas sans accord).
