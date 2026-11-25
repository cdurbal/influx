# L3D-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** toutes les lignes `fix` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : suite base
   locale, éclats base et e2e et contrôles en CI (dernier run), cas e2e ajoutés et leur durée.
2. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
3. `21` §8 : L3C-DB (part soldée par la ligne 01, SHA ; reste) ; L3C-E2E selon Q2 ; constats « avant
   production » et « plus tard » de R et U reportés au reliquat (une ligne par groupe, détail
   `archives/jalons/l3d/annexe.md` § Revue) ; DS-flaky mis à jour ; ligne de clôture de L3D.
4. Amendements : `21` §7 et `18` §10 Lot 3 (EC-L3D-1 ; TM5.2 tenu, TM5.6 côté créateur) ; `11`
   (EC-L3D-2 à -4, réponse Q1) et `09` RG3, RG8 (réponse Q1) ; `04` et `03` si la ligne 02 en a laissé.
5. **Attestation I-4**, commit vide (`--allow-empty`), jamais en réécrivant `main` : titre
   `chore(security): attest the end-of-L3D review`, corps `security-reviewed: <date>` puis
   `security-reviewed: <date> covers <SHA complets>` fournis par l'annexe § Revue.
6. `git mv docs/mvp/jalons/l3d-fiche.md docs/mvp/jalons/l3d docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `archives/jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts <commit d'ouverture>^ HEAD` ok ;
CI verte sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; une ligne `fix` n'est pas `fait` ; la
CI est rouge ou bloquée (facturation : main rendue au fondateur).
