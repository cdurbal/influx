# L2C-fix-2 — `fix(db): brand review locks the profile and refuses owned accounts in the database`
Grille `expert-database` (tests : grille `testeur`). Skill : `supabase-schema`. **I-4.** L2CS-1, L2CS-2, L2CS-3, L2CT-2, L2CT-4 : fiche § Revue ; `revue-constats-securite.md`, `revue-constats-testeur.md`.
**Lire :** fiche § Invariants 1, 2, 4, 11, 15 ; `0210` l. 515-620, 844-867, 1091 ; `0213` l. 91 ; `0203` l. 90 ; `0209` l. 708-754 ; `queues-routes.ts` l. 355-375 ; `queues-decision-routes.ts` l. 183-192 ; `queues-logo-routes.ts` l. 75 ; `profiles-brand-decision.test.ts` l. 530-593 ; `t14-backoffice-queue-route.test.ts` l. 1052 ; `03` l. 913.
**Livrer :** migration (suivant `0214`, relire `ls`) :
- L2CS-1 : `open_advertiser_review_entry` verrouille le profil `FOR UPDATE`, puis l'entrée (ordre de `publish`, `reject`).
- L2CS-2 : `open` (hors entrée close), `publish`, `reject`, `extend`, `read_advertiser_review_logo` refusent en 42501 quand `owner_agent_id` est l'appelant ; route : le refus s'écrit au registre par `record_refused_action` (code neuf), 403 `conflict_of_interest` inchangé.
- L2CS-3 : `guard_advertiser_member_write()` refuse (55000) tout `status` écrit sous `influx_advertiser` ou `influx_identity_definer` hors `pending_review`.
- Propriétaires, `search_path`, `EXECUTE` inchangés ; assertions ; `03`, `04`, `expected-rights.ts`.
**Ne pas toucher :** écrans, autres fonctions. Aucun marqueur `security-reviewed:` (le sha rejoint l'attestation de `cloture.md`).
**Prouver :** rouges 5 fois sur 5 : mutant « `SELECT` puis `UPDATE` » (aucun `FOR UPDATE`) pour V1 et t14 ; verrou du profil retiré (écriture membre vue en attente par `pg_stat_activity`, sonde bornée, jamais un `sleep` seul) ; compte détenu refusé en base (CA19 : ligne au registre) ; membre vers `published` refusé ; T2, T3 ; planchers relevés ; **toute la suite base** ; `pnpm check:fast`.
**Arrêt si :** interblocage possible avec une écriture membre ou une décision ; la sonde exige un droit nouveau hors des tests.
