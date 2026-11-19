# L3E-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** toutes les lignes `fix` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : suite base
   locale, éclats base et e2e et contrôles en CI (dernier run), temps ajouté à la base par le jalon.
2. Lecture SQL de `staging` (D70, sans écriture) : migrations `0315` à `0320` (`0321`) appliquées,
   `search.search_settings.is_open_to_advertisers` faux ; résultat dans `run.md`.
3. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
4. `21` §8 : L3DS-1, L2GS-8 (volet recherche), L3AS-1, L3AS-2, L3AT-5, L2DT-5, L2DT-6 soldés (SHA) ;
   T15.2 retiré de « Plus tard » ; constats « avant production » et « plus tard » de R au reliquat
   (une ligne par groupe, détail `archives/jalons/l3e/annexe.md` § Revue) ; DS-flaky mis à jour ;
   ligne de clôture de L3E.
5. Amendements : `18` §10 Lot 3 (TM12.1 à TM12.4, I-9 cochés avec leur preuve ; T15.2) ; `21` §7 ;
   `10` (EC-L3E-2, EC-L3E-3, réponses Q1 à Q3) ; `04` et `03` si les lignes 03 à 07 en ont laissé.
6. **Attestation I-4**, commit vide (`--allow-empty`), jamais en réécrivant `main` : titre
   `chore(security): attest the end-of-L3E review`, corps `security-reviewed: <date>` puis
   `security-reviewed: <date> covers <SHA complets>` fournis par l'annexe § Revue.
7. `git mv docs/mvp/jalons/l3e-fiche.md docs/mvp/jalons/l3e docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts <commit d'ouverture>^ HEAD` ok ;
CI verte sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; une ligne `fix` n'est pas `fait` ; la
CI est rouge ou bloquée (facturation : main rendue au fondateur).
