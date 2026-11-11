# Clôture du jalon L2F

Grille `testeur`. **Prérequis :** lignes U, F, R à `fait`, correctifs soldés, CI verte (`gh run list --json conclusion`).

1. Cocher chaque case de la fiche § Critère de fin, preuve à côté. Une case sans preuve : arrêt.
2. `pnpm check`, puis `pnpm test:e2e` trois fois : somme par `packages/test-kit/scripts/sum-e2e-durations.ts` dans `run.md` § Mesures ; TM5.3, TM5.4, T9.6 trois fois ; durées CI de chaque éclat.
3. Amendements groupés, liste de `modele.md` § Amendements, au moins : `04` §5.3, §11.2 (`0228` à `0235`) ; `08` RG9, RG70, RG73, RG77, RG78, RG94, écart 4 ; `06` RG51 (A-bis), RG55 ; `15` RG29 (files 5, 6) ; `03` §3.2, P7 (signatures mot pour mot de `revue-constats-securite.md`) ; `17` l. 1768 ; `17b` §3.6, §3.13 ; `18` TM5, §10.
4. D83 tranchée le 2026-11-08 (registre et `CLAUDE.md` §9 déjà à jour) : noter sa réalisation dans `decisions-detail.md` § D83.
5. `21` §8 : L2ES-2, L2E-US, D83, PLT-5, PLS-5, PLS-6, L2ES-3, EC-L2C-fix-2-2 retirés ; L2D-E2E mis à jour ou retiré ; constats restants ajoutés ; ligne de clôture « **L2F** (péremption, retrait 2V, files 5 et 6, D83, migrations `0228` à `0235`) : ouvert le …, **clos le …** ; `archives/jalons/l2f-fiche.md`, `archives/jalons/l2f/run.md` » ; `21` §0 : L2G suivant.
6. Fiche et dossier vers `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés. Commit `docs(mvp): close the L2F milestone`. Push, suivi de CI.
7. Revue soldée : commit d'attestation séparé, `git commit --allow-empty -F <fichier>`, texte de § Attestation mot pour mot, sans réécrire `main`.
