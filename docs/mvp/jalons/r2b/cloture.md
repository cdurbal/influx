# R2B-C — clôture du jalon
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin de `r2b/annexe.md` avec sa preuve exacte (`R2B-T1`..`T6`, SHA, run CI, sorties `05`, réponse `F1`).
2. `pnpm check` puis `pnpm test:e2e` en local (ou le run CI vert du dernier push si la pile Supabase locale n'est pas démarrée) ; delta E2E ≤ `+3 s`, éclats `db` ≤ `7 min 30` ; Railway `staging` `SUCCESS`.
3. Diff vide sur `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/` ; `package.json` et `pnpm-lock.yaml` sans changement de dépendance.
4. `node packages/test-kit/scripts/check-security-review.ts <parent de 01>` : aucune attestation exigée (sinon la poser : `security-reviewed: <date> covers <sha>…`).
5. `docs/mvp/21-plan-de-developpement.md` §8 : ligne de clôture `R2B`, constats `avant production` / `plus tard` de `R`, `L2GT-12`, `L2GT-13`, `R2AS-5` et `R2AT-2` soldés ; `jalons/lot3ter-plan.md` : `R2B ✅`.
6. Proposer au fondateur, sans modifier `CLAUDE.md` : « `R2B ✅` » au §10.
7. Déplacer `jalons/r2b-fiche.md` et `jalons/r2b/` dans `archives/jalons/` ; mettre à jour les références (`Grep "jalons/r2b"` dans `docs/`, `.claude/`, `apps/`, `packages/`) ; `pnpm docs:index`. `lot3ter-plan.md` reste en place (`R2C` à exécuter).
**Arrêt si :** une case sans preuve ; CI ou `staging:check` rouge ; constat bloquant ou jalon non soldé ; `F1` absente.
