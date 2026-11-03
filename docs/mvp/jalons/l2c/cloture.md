# Clôture du jalon L2C

Grille `testeur`. **Prérequis :** ligne 19 et ligne R à `fait`, lignes `fix` soldées, CI verte.
1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt.
2. Lancer `pnpm check`, puis `pnpm test:e2e` trois fois : ajout mesuré selon `21` §2.3 point 1 (`test-results/e2e-report.json`), noté
   dans `run.md` ; durées CI des jobs « Browser journeys » et « Database tests » notées, décision de `e2e.md` tenue.
3. Amendements groupés (EC-L2C-1 à EC-L2C-7, `file.md`) : `04`, `06`, `15`, `16`, `03` à jour, code d'abord dit ici ; `06` Q11 reste à
   `product-owner`.
4. `21` §8 : reliquat soldé retiré (PLK-1, PLS-7, L2BS-1, L2BS-7 ; L2BS-8, L2BT-3, L2BT-7 si traités), constats de revue reportés, CA22 (RG71, Lot 5) ajouté en « avant production » ; une ligne
   de clôture : « **L2C** (file 1, modération du profil marque, migrations ...) : ouvert le ..., **clos le ...** ; `archives/jalons/l2c-fiche.md`,
   `archives/jalons/l2c/run.md` ».
5. `CLAUDE.md` §9 et §10 si une décision a été prise. `lot2-plan.md` : rien d'autre.
6. Si la revue est soldée : commit d'attestation `security-reviewed: <date> covers <sha...>` (texte de la revue), sans réécrire `main`.
7. Fiche et dossier déplacés dans `docs/mvp/archives/jalons/` (`git mv`). Commit `docs(mvp): close the L2C milestone`. Push, suivi de CI.
