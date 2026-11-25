# L2G-fix-5a — `ci(db): database tests in two shards`
Grille `integrateur`. L2GT-1, choix A du fondateur (2026-11-12). `l2g/revue-constats-testeur.md` l. 46-50 (fait foi).
**Lire :** `.github/workflows/ci.yml` l. 180-244 (job `db`) et la matrice e2e voisine (`fail-fast: false`, éclats) ; `apps/api/scripts/run-tests.ts` l. 1-40 ; `apps/api/scripts/check-case-floors.ts` ; `apps/api/vitest.config.ts` (projet `db`).
**Livrer :**
- Job `db` en matrice de deux éclats (`fail-fast: false`), chacun sur sa pile propre, étapes de pile inchangées. Répartition par durée mesurée : `t1-anonymisation`, `t9-evidence-unreachable` et `t2-rls-matrix` d'un côté, le reste de l'autre, à équilibrer à ± 30 s (revue l. 49).
- Planchers : un sous-ensemble saute le contrôle (`run-tests.ts` l. 7-9). Un rapport JSON par éclat, déposé en artefact, et un job de contrôle qui lance `check-case-floors.ts` sur leur union ; aucun plancher baissé, aucun fichier oublié ni compté deux fois (échec si l'union ne couvre pas tous les fichiers du projet).
- En local, `pnpm --filter @influx/api test:db` reste la suite entière et inchangée.
- Le job de contrôle remplace « Database tests » dans les dépendances de `Migrate staging` et des portes de `production`.
**Ne pas toucher :** tests, planchers, migrations, jobs e2e.
**Prouver :** run CI vert, durée de chaque éclat (≤ 7 min 30 chacun) et du contrôle ; un essai à blanc où un fichier retiré de la répartition fait échouer le contrôle ; `pnpm check:fast`.
**Arrêt si :** la CI reste bloquée par la facturation (aucune preuve sans run) ; ligne à valider par le fondateur une fois la CI rétablie.
