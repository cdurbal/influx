# L3C-X7 — `test: L3C-T6 and L3C-T7 identifiers in the titles`
Grille `dev-react-node`. L3CT-2 : annexe § Revue (fait foi). Renommage seul. Sonnet `high`. Dépend
de X6 (`t14-campaign-review-route.test.ts` touché par les deux) : lignes à relire après X6.
**Lire :** annexe § Tests (L3C-T6, L3C-T7) ; convention : `campaign-review-route.test.ts` l. 203
(« L3C-T7: … »).
**Livrer :** préfixe « L3C-T6: » ou « L3C-T7: » au titre du `describe`, reste du titre intact :
- L3C-T6 : `apps/api/tests/campaign-leads.test.ts` l. 246, 387, 413, 480 ;
  `campaign-decision-email.test.ts` l. 178, 230, 289, 414, 632 (« L3C commit 06, » devient
  « L3C-T6: ») ; `periodic-scheduler.test.ts` l. 957 (`campaign_closure`, seul `describe` concerné) ;
- L3C-T7 : `apps/api/db-tests/t14-campaign-review-route.test.ts` l. 185, 221, 317, 415.
**Ne pas toucher :** corps des tests, titres des `it`, autres `describe`, nombre de cas, planchers
(`apps/api/tests/case-floors.ts` l. 23, 24, 55 ; `db-tests/case-floors.ts` l. 50).
**Prouver :** `git diff` limité aux lignes `describe(` ; `pnpm check:fast` (tests unitaires et
planchers) ; `pnpm --filter @influx/api test:db -- --reporter=dot` (suite entière : fichier de
`db-tests/`, D76) ; mêmes nombres de cas qu'avant dans les quatre fichiers.
**Commit :** un seul ; `git add` nominatif, jamais `-A` ; `git diff --cached --name-only` = les
quatre fichiers de test, `run.md`. Dernière ligne : `ETAT`.
**Arrêt si :** X6 pas `fait` ; un renommage change un résultat ou un nombre de cas ; un autre
identifiant de l'annexe manque à un titre (le signaler, ne pas l'ajouter).
