# L3F-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** toutes les lignes `fix` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : éclats base et e2e
   et contrôles en CI (dernier run), L3F-E1 et E2 par spec, temps ajouté à la base par le jalon.
2. Lecture SQL de `staging` (D70, sans écriture) : `0322` à `0326` appliquées,
   `search.search_settings.is_open_to_advertisers` faux ; résultat dans `run.md`.
3. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
4. `21` §8 : L3E-DB, L3ES-1 (selon Q1), L3ES-4, EC-L2G-16 (volet lecture annonceur) soldés (SHA) ;
   constats « avant production » et « plus tard » de U et R au reliquat (une ligne par groupe, détail
   `archives/jalons/l3f/annexe.md` § Revue) ; DS-flaky mis à jour ; ligne de clôture de L3F.
5. Amendements : `18` §10 Lot 3 (T1.5, T9 côté annonceur, T15.2 détail, CA45, CA46 avec leur preuve) ;
   `17` §4.4, §7.1 (EC-L3F-5) ; `10` (EC-L3F-1, -6, réponses Q1, Q2) ; `03`, `04`, `15` si les lignes 02
   à 06 en ont laissé.
6. **Attestation I-4**, commit vide (`--allow-empty`), jamais en réécrivant `main` : titre
   `chore(security): attest the end-of-L3F review`, corps `security-reviewed: <date>` puis
   `security-reviewed: <date> covers <SHA complets>` fournis par l'annexe § Revue.
7. `git mv docs/mvp/jalons/l3f-fiche.md docs/mvp/jalons/l3f docs/mvp/archives/jalons/` ; renvois mis à
   jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts <commit d'ouverture>^ HEAD` ok ;
CI verte sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; une ligne `fix` n'est pas `fait` ;
l'interrupteur de `staging` est vrai ; la CI est rouge ou bloquée (facturation : main rendue au fondateur).
