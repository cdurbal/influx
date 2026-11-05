# L2C-fix-2 — `fix(db): brand profile locked before the entry when a review entry opens`
Grille `expert-database` (tests : grille `testeur`). Skill : `supabase-schema`. **I-4.** Constats
L2CS-1, L2CT-2 : fiche § Revue ; `l2c/revue-constats-securite.md`, `l2c/revue-constats-testeur.md`.
**Lire :** fiche § Invariants 2, 4, 15 ; `0210` l. 515-620, 844-867 (ordre de `publish`) ; `0209`
l. 708-754 ; `queues-routes.ts` l. 355-375 ; `profiles-brand-decision.test.ts` l. 530-593 ;
`t14-backoffice-queue-route.test.ts` l. 1052-1067 ; `03` l. 913.
**Livrer :**
- Migration (suivant `0214`, relire `ls`) : `open_advertiser_review_entry` lit le compte de l'entrée,
  verrouille le profil `FOR UPDATE`, puis l'entrée (ordre de `publish`, `reject`), quelle que soit
  l'issue ; propriétaire, `search_path`, `EXECUTE` inchangés, assertion de fin ; `03` l. 913 si un
  droit change.
- L2CS-1, test db : ouverture tenue ouverte ; écriture membre (colonne, liste, logo) vue en attente
  (`pg_stat_activity`, `wait_event_type = 'Lock'`, sonde bornée) jusqu'au `commit`, puis jeton changé.
- L2CT-2 : V1 et « two simultaneous openings » déterministes : un tiers tient la ligne de l'entrée
  `FOR UPDATE`, les deux prises vues en attente (même sonde), puis il valide ; jamais un `sleep` seul.
**Ne pas toucher :** routes, écrans, autres fonctions ; L2CS-2, L2CS-3 (`21` §8) ; aucun marqueur
`security-reviewed:` (le sha rejoint l'attestation de `cloture.md`).
**Prouver :** rouges 5 fois sur 5 : mutant « `SELECT` puis `UPDATE` » (aucun `FOR UPDATE`, ni profil
ni entrée, `UPDATE` sur la seule lecture) pour V1 et t14 ; verrou du profil retiré pour L2CS-1 ; T2,
T3 ; planchers relevés ; **toute la suite base** ; `pnpm check:fast`.
**Arrêt si :** interblocage possible avec une écriture membre ou une décision ; la sonde exige un droit
nouveau hors des tests.
