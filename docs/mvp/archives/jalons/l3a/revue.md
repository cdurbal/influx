# L3A-R — revue groupée de fin de jalon (D71, `CLAUDE.md` §7 règle 5)
Plage : du commit d'ouverture de L3A à HEAD (`git log --oneline`) ; migrations `0301` et `0302`.
Rapport de 10 Ko au plus par revue : détail complet (fichier:ligne, scénario, correctif) pour les
seuls constats « bloquant » et « jalon » ; une ligne pour « avant production » et « plus tard ».

## Pour `testeur` (sonnet high)
- Annexe § Tests : chaque identifiant présent dans un titre, au plancher, vert ; aucun attendu
  affaibli (`git diff` des tests existants) ; aucun plancher baissé dans `db-tests/case-floors.ts`.
- Éclats : répartition déclarée en un seul fichier ; union = fichiers du projet `db` (preuve par
  l'essai à blanc) ; durées CI des deux éclats et du contrôle contre l'invariant 3 ; suite locale
  inchangée (`pnpm --filter @influx/api test:db` lance tous les fichiers).
- L3A-T4 : le témoin échoue bien sans la garde étendue (retrait local, sortie citée).
- DS-flaky noté.
- Sortie : `l3a/revue-constats-testeur.md`, constats `L3AT-n`.

## Pour `expert-cybersecurite` (opus xhigh)
- Invariants 4 à 9 : 55000 à la publication seulement ; propriétaire et droits de la fonction
  remplacée, `GRANT` de colonne au plus juste ; index sans effet de bord ; assertion L2DS-5 et garde
  T1-R sans exception ajoutée ; F3 : liste d'exclusion de `l3a/f3.md` motivée, `activity_log` seul
  modifié, classification obligatoire pour tout code futur.
- Commit 01 : SHA couverts égaux à `archives/jalons/l2g/revue-constats-securite.md` l. 98-101.
- Marqueur I-4 de L3A à apposer par le commit d'attestation (`security-reviewed: <date> covers
  <sha>…`), jamais en réécrivant `main` ; SHA prêts en fin de rapport.
- Sortie : `l3a/revue-constats-securite.md`, constats `L3AS-n`.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
