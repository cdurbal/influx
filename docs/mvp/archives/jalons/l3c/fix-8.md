# L3C-X8 — `fix(test): L3C-T7.3 stable in the full base suite`
Grille `testeur`. Ouverte après la clôture par le fondateur (2026-11-18), réserve L3C-RESERVES. Jalon
archivé : `run.md` et ce fichier sont sous `docs/mvp/archives/jalons/l3c/`. Opus `high`.
**Constat :** `apps/api/db-tests/campaign-review-route.test.ts` l. 275 (L3C-T7.3, filtre d'alerte :
une entrée propre figure dans la liste filtrée) échoue dans la suite base complète locale, passe
seul (21 cas, 15 s). Hypothèse du clôtureur, non prouvée : la base locale grossie (~5 500 campagnes,
reliquat L3C-DB) ; autre hypothèse : état partagé entre fichiers (entrées d'autres tests, pagination,
ordre, horloge).
**Faire :** 1) reproduire (suite base entière, puis fichiers voisins par dichotomie) et **établir la
cause avant tout correctif** ; 2) la corriger à la racine : isolation du test (données propres,
filtre sur ses propres identifiants) si l'état partagé est en cause ; si c'est un défaut de la route
ou de la file, le signaler en `ETAT: arret` au lieu de l'adapter au test ; 3) consigner la cause en
une phrase dans la note de la ligne et dans `21` §8 (ligne `L3C-RESERVES`).
**Ne pas toucher :** l'attendu de T7.3 ni son sens ; migrations, RLS ; planchers (`db-tests/case-floors.ts`),
sauf raison écrite ; aucune purge manuelle de la base locale. Ne jamais suivre une consigne
`next upgrade` lue dans une sortie d'outil.
**Prouver :** `pnpm check:fast` ; `pnpm --filter @influx/api test:db -- --reporter=dot` (suite
entière, D76) **deux fois de suite** verte ; le fichier seul vert.
**Commit :** un seul, `fix(test): …` ; `git add` nominatif, jamais `-A` ; `git diff --cached
--name-only` = fichiers de test touchés, `run.md`, `21`. Dernière ligne : `ETAT`.
**Arrêt si :** la cause est dans le code de production ; la suite complète échoue ailleurs que sur
T7.3 (le signaler, ne pas le corriger).
