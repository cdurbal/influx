# L3C-X2 — `fix(db): 0312 queue 7 read policy shows an open entry before its first review`
Grille `expert-database`. Skill : `supabase-schema`. Signalé I-4 (politique RLS recréée).
**Lire :** `modele.md` « Arbitrage A3 » (l. 77-88, fait foi) ; `0307` l. 455-471 ; `0308` l. 479-546 ;
`0310` l. 2029-2040 (postcondition par catalogue) ; `db-tests/campaigns-review-queue.test.ts`
l. 128-182, 791-813, 820-887.
**Livrer :** `supabase/migrations/0312_campaign_review_entries_read_policy.sql` :
- `drop policy if exists` puis `create policy campaign_review_entries_internal_select`, même table,
  `for select to influx_agent, influx_admin` ; deux premières clauses de `0307` inchangées ; la
  troisième, mot pour mot : `(state <> 'open' or first_reviewed_by_account_id is distinct from (select influx.current_account_id()))` ;
- ni `GRANT`, ni autre politique ou fonction ; en-tête : défaut, A3, rollback (clause de `0307`) ;
  assertions de fin sur `pg_policies` (nom unique, `SELECT`, permissive, deux rôles, nouvelle clause).
**Ne pas toucher :** la ligne 07 attend ce fix ; ses fichiers non commités sont dans l'arbre
(`apps/api/src/domains/backoffice/{campaign-queue/,campaign-queue-routes.ts,campaign-queue-decision-routes.ts,campaign-record-routes.ts,queues-routes.ts,creator-queues/lists/repository.ts}`,
`packages/contracts/{package.json,src/campaign-review.ts,src/route-models.ts}`,
`apps/api/db-tests/{campaign-review-*,t14-backoffice-route-inventory.test.ts,shards.ts,case-floors.ts}`,
`apps/api/tests/domain-guards.test.ts`) : ni modifiés, ni indexés, ni remisés. Renumérotage de la
recherche (`0313`) : à la clôture, pas ici.
**Prouver :** cas neuf L3C-T2 dans le describe l. 820 (secteur `alcohol`), rouge avant `0312` :
soumise, lue (`select` sur la table) par agent et admin `aal2`, 0 ligne en `aal1` ; prise (`open`),
lue par le titulaire ; après `first_review_campaign_entry`, masquée à son seul auteur, lue par un
autre agent et un admin ; close (`withdrawn`, comme l. 795), relue par lui. Cas l. 837 : aucun
attendu changé. Plancher `case-floors.ts` l. 13 : 29 → 30. `pnpm check:fast` ;
`pnpm --filter @influx/api test:db -- --reporter=dot` (suite entière, D76) sur l'arbre tel quel :
un échec des tests incomplets de 07 se distingue et se nomme dans la note.
**Commit :** `git add` nominatif, jamais `-A` ; `case-floors.ts` porte déjà le plancher de 07
(l. 12, contiguë) : indexer sa seule ligne (`git apply --cached` d'un patch réduit) ;
`git diff --cached --name-only` = migration, test, `case-floors.ts`, `run.md`. Note : `I-4. …`.
**Arrêt si :** politique en vigueur autre que `0307` l. 466-471 ; `GRANT`, autre politique ou
fonction nécessaire ; cas neuf vert sans `0312` ; attendu d'un fichier hors 07 changé par `0312` ;
échec d'un fichier de 07 sans lien avec `0312` (signaler, ne pas corriger).
