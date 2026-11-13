# L3A-fix-2 — `test(db): name L3A-T5 in the title of the export allowlist cases`
Grille `testeur`. L3AT-2 (jalon) : annexe § Revue (fait foi).
**Lire :** annexe § Tests (L3A-T5) et § Revue, L3AT-2 ; `apps/api/db-tests/t8-privacy-execution.test.ts`
l. 1392 ; `apps/api/db-tests/case-floors.ts` l. 61.
**Livrer :** le `describe` de la l. 1392 commence par « L3A-T5: », le reste du titre inchangé (comme
`profiles-creator-decisions.test.ts:1495` pour L3A-T1).
**Ne pas toucher :** cas, attendus, planchers (`t8-privacy-execution.test.ts` : 98), autres fichiers.
**Prouver :** `pnpm --filter @influx/api test:db -- db-tests/t8-privacy-execution.test.ts --reporter=dot`
vert, plancher 98 tenu ; `pnpm check:fast`.
**Arrêt si :** le fichier rougit (instabilité ou base locale à nommer, rien d'autre corrigé). Un autre
identifiant de l'annexe § Tests absent de tout titre se signale dans la note, sans correction.
