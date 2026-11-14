# L3B-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** toutes les lignes `fix` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : suite base
   locale, éclats base et e2e et contrôles en CI (dernier run), cas e2e ajoutés et leur durée.
2. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
3. `21` §8 : L2AT-5, L3AS-6, L3AT-6 soldés (SHA) ; L3AS-3 soldé si échu ; constats « avant
   production » et « plus tard » de la revue et de U reportés au reliquat (une ligne par groupe,
   détail `archives/jalons/l3b/annexe.md` § Revue) ; DS-flaky mis à jour ; ligne de clôture de L3B.
4. Amendements : `04` §11 (EC-L3B-1, numéros décalés), `04` §5.4 selon `modele.md` (EC-L3B-3, Q16,
   colonnes ajoutées), `17` §4.3 étape 4 sous D78 (EC-L3B-2) et §2.6 (EC-L3B-4), `09` Q16 « tranchée
   (`archives/jalons/l3b/modele.md`) », `03` P7 si la porte ou les droits l'exigent.
5. **Attestation I-4**, commit vide (`--allow-empty`), jamais en réécrivant `main` : titre
   `chore(security): attest the end-of-L3B review`, corps `security-reviewed: <date>` puis
   `security-reviewed: <date> covers <SHA complets>` fournis par l'annexe § Revue, « Attestation ».
6. `git mv docs/mvp/jalons/l3b-fiche.md docs/mvp/jalons/l3b docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts <commit d'ouverture>^ HEAD` ok ;
CI verte sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; une ligne `fix` n'est pas `fait` ; la
CI est rouge ou bloquée (facturation : main rendue au fondateur).
