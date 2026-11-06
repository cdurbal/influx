# Clôture du jalon L2E

Grille `testeur`. **Prérequis :** lignes U, F, R à `fait`, correctifs soldés, CI verte.

1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt.
2. Lancer `pnpm check`, puis `pnpm test:e2e` trois fois : somme par `packages/test-kit/scripts/sum-e2e-durations.ts`, notée dans `run.md` ; T9.6, T1, TM11 trois fois ; durées CI de chaque éclat et de « Database tests » notées.
3. Amendements groupés, code d'abord dit ici : `04` §5.3, §5.11, §11.2 (`0220` à `0226`), l. 1524, 1564 ; `03` C(12), §6.6, P7, P10, PP-9 ; `08` RG34, RG81, RG94, écarts levés ; `06` RG66, écarts 1 et 3 ; `16` l. 796-801, 1487 ; `17b` l. 516, 1216 ; `18` T9.2, T9.7 ; `20` §11.3 ; D82 reportée en `decisions.md`.
4. `03` P7 : signatures des propriétaires neufs, mot pour mot de `revue-constats-securite.md` § Signatures.
5. `21` §8 : L2DS-1, L2DS-2, L2CT-8, L2CS-8, L2D-E2E retirés ; constats et écarts restants ajoutés ; une ligne de clôture : « **L2E** (propriété, pièces, constat, file 4, T9.6, migrations `0220` à `0226`) : ouvert le ..., **clos le ...** ; `archives/jalons/l2e-fiche.md`, `archives/jalons/l2e/run.md` ».
6. `CLAUDE.md` §9 si D82 l'exige. `lot2-plan.md` : rien d'autre.
7. Revue soldée : commit d'attestation séparé, `git commit --allow-empty -F <fichier>`, texte de `revue-constats-securite.md` § Attestation mot pour mot, sans réécrire `main`.
8. Fiche et dossier vers `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés (jamais `git mv` : autres sessions). Commit `docs(mvp): close the L2E milestone`. Push, suivi de CI.
