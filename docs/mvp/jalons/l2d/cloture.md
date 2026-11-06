# Clôture du jalon L2D

Grille `testeur`. **Prérequis :** lignes U, F, R, `fix-F1` à `fait`, `fix-1` et `fix-2` soldées (et `B`, si `fix-2` l'a ajoutée, tranchée par le fondateur), CI verte.

1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt. Éclats sous 7 min 30 : ids des runs de `fix-1` (cache froid) et `fix-2` (cache chaud), ou réponse de `B`. Invariant 17 : un seul attendu assoupli, accepté par `testeur` à la revue : `member-shell.spec.ts:193`, `toBe(0)` devenu `toBeCloseTo(0, 0)` (EC-L2D-15-1, colonne collante à 1/64 px), dit dans la case et dans la ligne de clôture.
2. Lancer `pnpm check`, puis `pnpm test:e2e` trois fois : ajout selon `21` §2.3 point 1, somme par `packages/test-kit/scripts/sum-e2e-durations.ts` sur `test-results/e2e-report.json`, notée dans `run.md` ; T1 et TM11 trois fois ; durées CI de chaque éclat et de « Database tests » notées.
3. Amendements groupés, code d'abord dit ici : `07` RG76, RG87, cas limite l. 1010, CA68, table de `07` l. 317 ; `04` §5.2, §6.2 (vitrine au Lot 3), §11.2 (numéros réels `0216` à `0219`), §12.12, §9.2 ; `03` l. 240 (droit au Lot 3) ; `17` §5.4 si besoin ; `18` T1 (emplacement réel du test) ; **`18` T14.3 (l. 737 ; L2DT-4, EC-L2D-10-1)** : un corps refusé par le schéma répond 400 avant la session, pour tout rôle et toute route ; « code identique à l'inconnu » vaut pour l'objet visé, que le schéma ne lit pas (invariant 10 lu ainsi ; T1 : rien ne sort, seule l'existence de la route se devine).
4. `03` P7, signatures du 2026-11-06, mot pour mot de `revue-constats-securite.md` § Signatures : l. 896 `influx_identity_definer` (clause L2D, `0216` à `0218`, sous L2DS-5) ; l. 912 `influx_privacy_definer` (clause L2D, `0219`).
5. `21` §8 : L2CT-5, L2C-E2E retirés (éclats de `fix-1`, `fix-2`) ; **L2C-fix2 retirée** (`0215` relue à la revue L2D, conforme : `-S` § Relecture de `0215`) ; DS-flaky : occurrence `brand-profile.spec.ts:169` (run 42243018278, L2DT-1), corrigée par `fix-2` ; L2AT-5 « au chargement » ; L2C-HARNAIS tranché par le fondateur ou « plus tard » ; CGU (`apps/api/legal/`, « pseudonymisé ») en « avant production » ; lignes de fiche § Écarts restantes et de § Reliquat ci-dessous ; une ligne de clôture : « **L2D** (profil créateur, blocs 1 à 5, T1, TM11, migrations `0216` à `0219`) : ouvert le ..., **clos le ...** ; un attendu assoupli (`member-shell.spec.ts:193`, EC-L2D-15-1) ; `archives/jalons/l2d-fiche.md`, `archives/jalons/l2d/run.md` ».
6. `CLAUDE.md` §9 et §10 si une décision a été prise (D82). `lot2-plan.md` : rien d'autre.
7. Revue soldée : commit d'attestation séparé, `git commit --allow-empty -F <fichier>`, texte de `revue-constats-securite.md` § Attestation mot pour mot, sans réécrire `main`. `fix-1` (`ci.yml`, I-4) n'y est pas : avant ce commit, relecture courte de son diff par `expert-cybersecurite` (constats seuls ; clé du cache, restriction à `main`, épinglage par sha, permissions) ; son sha complet ajouté à la ligne `covers` et une phrase au corps, de sa main. Sans relecture : ligne « avant production » en `21` §8, comme L2C-fix2.
8. Fiche et dossier vers `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés (jamais `git mv` : autres sessions). Commit `docs(mvp): close the L2D milestone`. Push, suivi de CI.

## Reliquat

Lignes à ajouter à `21` §8 (`| # | Correctif attendu | Échéance | Détail |`) : correctif de la fiche § Revue ; détail `archives/jalons/l2d/` (`-T` = `revue-constats-testeur.md`, `-S` = `revue-constats-securite.md`). Soldés dans le jalon : L2DT-2 (`fix-1`), L2DT-1 (`fix-2`), L2DT-3 (ligne `fix-F1` et F-1 de `recette.md`, revue), L2DT-4 (point 3).

| Id | Échéance | Détail |
|---|---|---|
| L2DS-1 | Avant production, au plus tard avant tout rendu cliquable de `profile_url` (L2E, Lot 4) | `-S` |
| L2DT-5, L2DT-6 | Avant production | `-T` |
| L2DS-2 | L2E (migration qui ouvre `agent_observed`) | `-S` |
| L2DS-3, L2DS-5 | Avant le Lot 3 | `-S` |
| L2DS-4 | L2G | `-S` |
| L2DS-6 | À toute migration de bornes de tranches ; `change_member_role()` au L2G | `-S` |
| L2DS-7 | Lot 6 | `-S` |
| L2DT-7 à L2DT-10 | Plus tard | `-T` |
