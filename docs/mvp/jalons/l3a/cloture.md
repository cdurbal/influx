# L3A-C — clôture du jalon
Grille `testeur`. Aucun code applicatif.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : job base en
   local, éclats et contrôle en CI (dernier run), suite e2e entière (aucun cas ajouté).
2. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
3. `21` §8, reliquat : L2D-E2E, L2CS-6, L2DS-3, L2DS-5, L2GT-9 soldés (SHA) ; L2GS-8 réduit à son
   volet recherche (L3E) ; F3 soldé et retiré de « Plus tard » ; ligne de clôture de L3A.
4. Amendements : `04` §11 (EC-L3A-1 : `0301`, `0302` du reliquat ; Lot 3 décalé de deux) ; `21` §2.3
   si les éclats changent la règle du budget base ; `03` P7 si la revue signe une clause.
5. Attestation `security-reviewed: <date> covers <sha>…` si la revue est soldée (SHA de
   `l3a/revue-constats-securite.md`), commit vide, jamais en réécrivant `main`.
6. `git mv docs/mvp/jalons/l3a-fiche.md docs/mvp/jalons/l3a docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `check-security-review.ts` ok ; CI verte sur le dernier push (`gh run watch <id>
--exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; la CI est rouge ou bloquée.
