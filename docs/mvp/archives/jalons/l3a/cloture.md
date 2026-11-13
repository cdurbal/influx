# L3A-C — clôture du jalon
Grille `testeur`. Aucun code applicatif. **Préalable :** `fix-1` et `fix-2` à `fait` dans `run.md`.
**Faire :**
1. `pnpm check`, puis `pnpm test:e2e` ; mesures dans `run.md` § Mesures de clôture : job base en
   local, éclats et contrôle en CI (dernier run), suite e2e entière (aucun cas ajouté).
2. Annexe § Critère de fin : chaque case cochée avec sa preuve (run CI, fichier, ligne de `run.md`).
   **L3AT-3, fusionné ici (sans fix) :** case « Essai à blanc » prouvée par la sortie de la revue,
   recopiée dans `run.md` § Mesures de clôture : rapport sans `db-tests/t16-commission.test.ts`,
   contrôle rouge sur « shard 2: db-tests/t16-commission.test.ts is assigned to it but did not run »
   et « declared in the floor file, but absent from the report » ; cas complet vert : « every database
   test file ran in exactly one of 2 shards (105 files); floor of executed database cases met ».
3. `21` §8, reliquat : L2D-E2E, L2CS-6, L2DS-3, L2DS-5, L2GT-9 soldés (SHA) ; L2GS-8 réduit à son
   volet recherche (L3E) ; F3 soldé et retiré de « Plus tard » ; ligne de clôture de L3A. Puis :
   - **DS-flaky (L3AT-1)** : ajouter « L3A : `backoffice-queue.spec.ts:82` et `:422` (run
     43426274803, `e886b37`), troisième occurrence de L2ET-6 ; cause : identifiant de run 100 %
     numérique (≈ 2,3 % des runs), 8 chiffres consécutifs dans les noms de marque, alerte RG19
     `phone` ; corrigée par `fix-1` (`<sha>`) » ; colonne Détail : `archives/jalons/l3a/annexe.md` § Revue.
   - Revue de fin de L3A, cinq lignes à coller telles quelles :
     | L3AS-7 | Export « mes données » : `f3.md` déclare dues `queue.entry_opened`, `queue.*_read`, `verification.evidence_viewed`, mais `activity_log` ne sert aucun sujet `queue_entry` ni `verification_request` du membre (`0302:654-658`) : périmètre élargi, ou `f3.md` et notice corrigés | Avant production (Lot 6, `expert-conformite-rgpd` ; condition du verdict S de L3A) | `archives/jalons/l3a/annexe.md` § Revue |
     | L3AS-1, L3AS-2, L3AT-5 | Garde T1-R : lectures indirectes (plpgsql, SQL non atomique, déclencheurs SECURITY DEFINER, L2GS-6) par fermeture récursive des noms qualifiés ; exception portée par le couple (objet, relation créateur), aucune sur la couche I ; `search_path = ''` pour toute fonction SECURITY DEFINER accessible à `influx_advertiser` | Avant L3E | idem |
     | L3AS-6, L3AT-6 | `export_class` dans les tableaux de codes des Lots 3 à 5 de `04` (règle de `f3.md`) ; L3A-T5 épingle la liste nominative (`>= 130`, exclusions exactes) et un témoin `excluded_third_party` | Avant `0303` | idem |
     | L3AS-4, L3AT-8 | `publish_creator_review_entry()` lit `accounts.status` sans verrou (`0301:108-115`) : la porte de suspension verrouille (`for share`) ou dépublie dans sa transaction ; filtre de L3E en seconde barrière | Lot 5 (porte de suspension) | idem |
     | L3AS-3, L3AS-5, L3AT-4, L3AT-7, L3AT-9 | Constats mineurs de la revue de fin de L3A : garde L2DS-5 étendue (`query_to_xml`, `cursor_to_xml`, `table_to_xml`, `ts_stat`, `ts_rewrite`, `dblink*`) ; `md5(prosrc)` de `normalized_brand_name` épinglé, `REINDEX` dans la même migration ; `prosrc` d'`advertiser_duplicate_candidates()` asserté ; tests de `check-db-shards.ts`, de `--shard` et de la structure CI `db`, `db-merge` ; `db-merge` seul après 24 h : relancer les éclats | Plus tard (L3AS-3 : prochaine migration de `influx_identity_definer` ; L3AS-5 : toute redéfinition de `normalized_brand_name`) | idem |
4. Amendements : `04` §11 (EC-L3A-1 : `0301`, `0302` du reliquat ; Lot 3 décalé de deux) ; `21` §2.3
   si les éclats changent la règle du budget base ; `03` P7 si la revue signe une clause.
5. **Attestation I-4**, après `fix-1` et `fix-2`, commit vide (`--allow-empty`), jamais en réécrivant
   `main` : titre `chore(security): attest the end-of-L3A review`, corps exact :
   ```
   security-reviewed: 2026-11-13
   security-reviewed: 2026-11-13 covers 0174f93d698f9091f2f6d282c30e64a13cfa12b2 ba56aae9108d548fa1e7012083507d18980460bc e886b376fed04b28a2ef3daa8398e2b1a61fe004 7c5cd826328ec0e2b303ec30a89795a42ca3fa27
   ```
   puis, en fin de ligne `covers`, le SHA complet de `fix-1` et de `fix-2` (code de test hors I-4,
   couvert comme `e886b37`). Sans marqueur requis : `9c149d1`, `99bf9f2` (skills) ; `7866415`,
   `7a9b916`, `51994ac`, `b3a3363`, constats de la revue (documentation).
6. `git mv docs/mvp/jalons/l3a-fiche.md docs/mvp/jalons/l3a docs/mvp/archives/jalons/` ; renvois mis
   à jour (`21` §8, `jalons/lot3-plan.md`). Pas le dernier jalon du lot : `lot3-plan.md` reste.
**Prouver :** `node packages/test-kit/scripts/check-security-review.ts bf5303f HEAD` ok ; CI verte
sur le dernier push (`gh run watch <id> --exit-status`), « Migrate staging » compris.
**Arrêt si :** une case du critère de fin n'a pas de preuve ; `fix-1` ou `fix-2` n'est pas `fait` ;
la CI est rouge ou bloquée.
