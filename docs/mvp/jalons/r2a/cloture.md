# R2A-C — clôture du jalon
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin dans `r2a/annexe.md` avec sa preuve exacte (identifiant `R2A-T1`..`T5`, SHA, run CI, sortie `staging:check`, constat protocole `influx-staging-*`).
2. Exécuter `pnpm check` puis `pnpm test:e2e` en local (ou consigner le run CI vert du dernier push si la pile Supabase locale n'est pas démarrée) ; vérifier delta E2E ≤ +2 s et déploiement Railway `staging` `SUCCESS`.
3. Vérifier le diff vide sur `apps/api/src/platform/storage.ts`, `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/` et `.claude/skills/env-secrets/SKILL.md` ≤ 10 Ko.
4. Mettre à jour `docs/mvp/21-plan-de-developpement.md` §8 (ligne de clôture `R2A`, éventuels constats `avant production` / `plus tard` issus de `R`) et `docs/mvp/jalons/lot3ter-plan.md` (`R2A ✅`).
5. Confirmer que `check-security-review.ts` n'exige aucune attestation `security-reviewed:` sur la plage `R2A` (sinon la poser).
6. Proposer au fondateur, sans modifier `CLAUDE.md` : ligne `D90` au §9 et « `R2A ✅` » au §10.
7. Déplacer `docs/mvp/jalons/r2a-fiche.md` et `docs/mvp/jalons/r2a/` dans `docs/mvp/archives/jalons/` ; mettre à jour les références (`Grep "jalons/r2a"` dans `docs/`, `.claude/`, `apps/`, `packages/`) et régénérer `pnpm docs:index`. Laisser `lot3ter-plan.md` en place (`R2B` et `R2C` restent à exécuter).
**Arrêt si :** une case de l'annexe n'a pas sa preuve ; CI ou `staging:check` rouge ; constat bloquant/jalon non soldé ; budget E2E > +2 s.
