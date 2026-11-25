# RUB-C — clôture du jalon
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin (`annexe.md`) avec sa preuve (identifiant, SHA, run CI) ; table des 49 composants.
2. `pnpm check` puis `pnpm test:e2e` en local ; CI verte du dernier push. Sans pile locale : le dire, preuve = run CI
   nommé ; T11 : exécution locale de la ligne 11 consignée.
3. `run.md` § Mesures de clôture : éclats e2e, secondes ajoutées (≤ 20), poids JavaScript par route, vélocité.
4. `21` §8 : ligne de clôture RUB, reliquat (avant production, plus tard) ; retirer ce qui est prouvé soldé parmi RUAT-2
   à RUAT-4, RUAT-8, RUAS-5, L2AT-2, RUAU-AP et PT ; `lot3bis-plan.md` : RUB ✅, charge relue ; `06a` à jour.
5. Attestation `security-reviewed: <date> covers <sha>…` si la revue est soldée et qu'un commit signalé l'exige.
6. Proposer au fondateur, sans modifier `CLAUDE.md` : ligne D89 au §9, « RUB ✅ » au §10.
7. Fiche et `rub/` déplacés dans `archives/jalons/` ; références mises à jour (`Grep "jalons/rub"` dans `docs/`,
   `.claude/`, `apps/`, `packages/`). `lot3bis-plan.md` reste (pas le dernier jalon).
**Arrêt si :** une case sans preuve ; CI rouge ; F1 sans réponse ; budget e2e dépassé.
