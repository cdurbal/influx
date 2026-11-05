# Clôture du jalon L2D

Grille `testeur`. **Prérequis :** lignes U, F et R à `fait`, lignes `fix-n` soldées, CI verte.

1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt.
2. Lancer `pnpm check`, puis `pnpm test:e2e` trois fois : ajout selon `21` §2.3 point 1, somme par `packages/test-kit/scripts/sum-e2e-durations.ts` sur `test-results/e2e-report.json`, notée dans `run.md` ; T1 et TM11 trois fois ; durées CI de chaque éclat et de « Database tests » notées.
3. Amendements groupés, code d'abord dit ici : `07` RG76, RG87, cas limite l. 1010, CA68, table de `07` l. 317 ; `04` §5.2, §6.2 (vitrine au Lot 3), §11.2 (numéros réels `0216` à `0219`), §12.12, §9.2 ; `03` l. 240 (droit au Lot 3), P7 ; `17` §5.4 si besoin ; `18` T1 (emplacement réel du test).
4. `21` §8 : L2CT-5, L2C-E2E retirés ; L2AT-5 « au chargement » ; L2C-HARNAIS tranché par le fondateur ou « plus tard » ; CGU (`apps/api/legal/`, « pseudonymisé ») en « avant production » ; lignes de § Écarts et de § Revue restantes ; une ligne de clôture : « **L2D** (profil créateur, blocs 1 à 5, T1, TM11, migrations `0216` à `0219`) : ouvert le ..., **clos le ...** ; `archives/jalons/l2d-fiche.md`, `archives/jalons/l2d/run.md` ».
5. `CLAUDE.md` §9 et §10 si une décision a été prise (D82). `lot2-plan.md` : rien d'autre.
6. Revue soldée : commit d'attestation séparé, `git commit --allow-empty -F <fichier>`, texte de `expert-cybersecurite`, `security-reviewed: <date> covers <sha>…`, sans réécrire `main`.
7. Fiche et dossier vers `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés (jamais `git mv` : autres sessions). Commit `docs(mvp): close the L2D milestone`. Push, suivi de CI.
