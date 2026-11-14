# L3C-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** toutes les lignes `fix` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : suite base
   locale, éclats base et e2e et contrôles en CI (dernier run), cas e2e ajoutés et leur durée.
2. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
3. `21` §8 : L3BT-9, L3BS-2, L3BS-5 soldés (SHA) ; constats « avant production » et « plus tard » de
   R et U reportés au reliquat (une ligne par groupe, détail `archives/jalons/l3c/annexe.md`
   § Revue) ; DS-flaky mis à jour ; ligne de clôture de L3C.
4. Amendements : `04` §11 (EC-L3C-1) et §5.4 selon `modele.md` ; `09` (EC-L3C-2, EC-L3C-4, réponses
   Q1 et Q2) ; `15` l. 298 (file 7 en service, comme les files 2 et 3) ; `03` P7 si la porte ou les
   droits l'exigent ; `18` §10 Lot 3 (TM5.1, TM5.6 au niveau base).
5. **Attestation I-4**, commit vide (`--allow-empty`), jamais en réécrivant `main` : titre
   `chore(security): attest the end-of-L3C review`, corps `security-reviewed: <date>` puis
   `security-reviewed: <date> covers <SHA complets>` fournis par l'annexe § Revue.
6. `git mv docs/mvp/jalons/l3c-fiche.md docs/mvp/jalons/l3c docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts <commit d'ouverture>^ HEAD` ok ;
CI verte sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; une ligne `fix` n'est pas `fait` ; la
CI est rouge ou bloquée (facturation : main rendue au fondateur).
