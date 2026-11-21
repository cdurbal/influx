# L3G-fix-3 — `test(e2e): the identified search spec removes the block reason it inserts`
Grille `testeur`. Skill : `test-strategy`.
**Lire :** `annexe.md` § Revue, constat L3GT-1 ; `apps/web/e2e/backoffice-identified-search.spec.ts` l. 42-63
(`afterAll`) et l. 218-220 (insertion de `lg_search_block`) ; `apps/api/db-tests/matching-party-blocks.test.ts`
l. 787-808 (L3E-T4 : attend `["dataset_probe"]`) ; `apps/api/db-tests/creator-identified-search-route.test.ts`
(le `finally` qui supprime déjà `lg_nine_block`, patron).
**Livrer :** dans l'`afterAll` du spec, après la suppression de `party_blocks`, la suppression de
`matching.block_reasons` pour `code = 'lg_search_block'` ; la ligne est supprimée même si un test du fichier a échoué.
**Ne pas toucher :** L3E-T4, les autres specs, le code applicatif, la base, les planchers (aucun cas ajouté ni retiré).
**Prouver :** le spec seul (`pnpm --filter @influx/web exec playwright test e2e/backoffice-identified-search.spec.ts
--reporter=line`) vert ; puis `pnpm --filter @influx/api test:db -- db-tests/matching-party-blocks.test.ts
--reporter=dot` vert sur la même base locale, sans nettoyage manuel avant ; `pnpm check:fast`.
**Arrêt si :** le motif est référencé par une ligne que le spec ne crée pas, ou si un autre motif fuit : le dire en EC
et ne supprimer que ce que le spec insère.
