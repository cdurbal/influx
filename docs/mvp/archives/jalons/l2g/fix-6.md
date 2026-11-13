# L2G-fix-6 — `test(api): the revocation case cancels only its own dual control requests`
Grille `testeur`. Skill : `test-strategy`. L2GT-2 (jalon) : fiche § Revue ; `l2g/revue-constats-testeur.md` l. 52-56 (fait foi). **Échéance :** la suite base rougit sur la base locale dès le 2026-11-13 vers 07:32 UTC.
**Lire :** `apps/api/db-tests/verification-revocation.test.ts` l. 899-960 (`ask`, boucle des motifs créateur, annulation l. 949-952, filtre du registre l. 959) ; `supabase/migrations/0130_backoffice_alerts_and_dual_control.sql` l. 360-400 (garde : `cancelled` refusé après `expires_at`, `expired` admis après) ; `db-tests/stale-fixtures.ts`, `global-setup.ts` (point 6).
**Livrer :**
- L. 949-952 : l'annulation ne touche que les demandes de la transaction (`requested_at >= pg_catalog.transaction_timestamp()`, comme l. 959, ou l'identifiant rendu par `ask()`).
- Prévention, `stale-fixtures.ts` : les demandes 2V `pending` dont `expires_at` est passé passent en `expired` (transition admise par la garde), commentaire à l'appui ; aucune autre ligne touchée.
**Ne pas toucher :** migrations, code applicatif, autres cas ; aucun attendu affaibli, aucun plancher baissé (`case-floors.ts` : 7).
**Prouver :** la reproduction de la revue (l. 55) rouge avant, verte après, base locale rétablie ensuite ; `pnpm --filter @influx/api test:db -- db-tests/verification-revocation.test.ts --reporter=dot` vert ×3 ; toute la suite base une fois ; `pnpm check:fast`.
**Arrêt si :** la garde refuse le passage en `expired` (dire pourquoi) ; un autre fichier annule des demandes 2V sans filtre (le nommer, ne rien corriger ici).
