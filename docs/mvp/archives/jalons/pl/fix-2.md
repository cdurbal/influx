# PL-fix-2 — `test(e2e): fail the run on any error occurrence recorded during it`

Grille `testeur`. Constat PLT-3 : `jalons/pl/revue-constats.md`. Après `fix-1`.

**Lire :** `apps/web/e2e/global-setup.ts` ; `apps/web/playwright.config.ts` l. 40-55 ;
`supabase/migrations/0016_ops_monitoring.sql` l. 137-150, 243-270 ;
`apps/api/src/domains/ops/recorder.ts` l. 1-45.

**Constat :** aucun test ne compte les erreurs enregistrées pendant un passage e2e : le 500 de PLT-1
(après la fin de DS-10) y est resté invisible, 33 lignes sans alerte.

**Livrer :**
- `globalSetup` relève `max(id)` de `ops.error_occurrences` (rôle de migration) et rend son teardown (ou `globalTeardown`) :
  échec si une ligne au-delà existe, chacune nommée par source, service, type, route, `occurred_at`,
  `request_id` (rien d'autre, D60).
- Exclusions nommées, une par cas volontaire, jamais un motif large. Au relevé : aucune (J8T-4
  bouchonne `/api/v1/bo/ops/errors*`, `backoffice.spec.ts` l. 538-574 ; aucun cas n'appelle le
  collecteur ; seule autre ligne, le jeu `t2` des db-tests) : à revérifier.
- Commentaire : le dernier vidage (≤ 10 s, `recorder.ts` l. 42) reste hors de portée ; aucune attente.

**Ne pas toucher :** aucun cas ni assertion ; aucun fichier I-4 (`packages/test-kit/scripts/check-*`,
`.github/workflows/`) : le garde-fou vit dans `apps/web/e2e/`.

**Prouver :** `pnpm check:fast` ; le garde-fou mord : appelé avec un repère abaissé d'une ligne
(script ponctuel, non commité), il échoue en nommant la dernière ligne `/v1/bo/alerts` ;
`pnpm test:e2e` vert, teardown exécuté et sa durée relevée (< 1 s).

**Arrêt si :** un cas volontaire n'est excluable que par un motif large ; le garde-fou exige une
attente, une route de l'API ou un fichier I-4.
