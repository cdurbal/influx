# Jalon R2A — Décision D90, doublure S3 locale, câblage Playwright et validation R2
> Source : `lot3ter-plan.md` l. 24, `23-migration-cloudflare-r2.md` §3, §5.1, §7.2–7.4, §8.1, §9 · 2026-11-26 · Statut : à valider · Annexe : `r2a/annexe.md`

## Objectif et périmètre
Inscrire la décision **`D90`** dans les spécifications de référence et les runbooks, livrer la doublure HTTP S3 SigV4 locale (`@influx/test-kit/s3-double`) ainsi que le garde d'artefacts navigateur `"R2_"`, câbler Playwright E2E sur `127.0.0.1:4111`, et imposer la validation des 4 variables `R2_*` au démarrage (`api` et `worker`) et dans `staging:check`, **sans modifier l'adaptateur `apps/api/src/platform/storage.ts`**.
**Prérequis et dépendances :** réponses `F0` du fondateur (`R2-01` à `R2-05`) ; constat protocole sur `influx-staging-*` (`412`, `404 NoSuchKey`, `204`) ; création des 2 jetons `influx-staging-api` et `influx-staging-worker` et pose des 4 variables `R2_*` sur Railway `staging` (`api` et `worker`) + `apps/api/.env.local` **avant tout push sur `main`**.
**Ne change pas :** `apps/api/src/platform/storage.ts` (reste sur `@supabase/storage-js` pendant tout `R2A`), `apps/api/src/{server,worker}.ts`, les 15 routes d'images, `supabase/**`, `packages/contracts/**`, `packages/web-platform/**`, `apps/web/src/**`, `apps/backoffice/src/**`.
**Hors périmètre :** bascule du trafic d'images vers R2 (`R2B`), `--reupload-images` (`R2B`), retrait de `@supabase/storage-js` et `L2BS-4` (`R2C`).

## Invariants
1. Aucun code ni amendement de spécification avant la réponse `F0` du fondateur (`R2-01` à `R2-05`), consignée dans `r2a/run.md`.
2. Zéro branchement `INFLUX_ENV === "production"` dans `apps/api/src/config/schema.ts` (`02` §12.4, `18` `T17`) : `staging` et `production` partagent exclusivement `isDeployedEnvironment(INFLUX_ENV)`.
3. En `development`, `R2_ENDPOINT` n'accepte qu'une origine `http://` sur `LOOPBACK_HOSTS` (`127.0.0.1`, `localhost`, `[::1]`) et refuse tout hôte `*.r2.cloudflarestorage.com` (`16` RG148 : aucun test n'atteint le cloud).
4. Sur `worker`, les 4 variables `R2_*` suivent la règle du tout-ou-rien en `development` (`config.r2 = null` si les 4 sont absentes, préservant `VALID_WORKER_ENV`) et sont toutes exigées sous `isDeployedEnvironment`.
5. `R2_SECRET_ACCESS_KEY` mesure au moins 32 octets, refuse `CHANGE_ME`, et participe au contrôle d'unicité deux à deux des secrets du processus (`schema.ts:988`), en étant également distinct de `R2_ACCESS_KEY_ID`.
6. `apps/api/src/config/schema.ts`, `apps/api/.env.example` et le bloc `<!-- staging-check:begin -->`…`<!-- staging-check:end -->` de `docs/mvp/runbooks/staging.md` sont mis à jour **dans le même commit `04`** (`T11.4` et `namesNotRead` de `staging-check.test.ts`).
7. Les 4 variables `R2_*` sont présentes sur Railway `staging` (`api` et `worker`, avec `R2_ACCESS_KEY_ID` distincts) **avant** le push de `04` sur `main` afin d'éviter tout déploiement `CRASHED`.
8. `startS3Double()` écoute exclusivement sur `127.0.0.1`, recalcule et vérifie `AWS4-HMAC-SHA256` ainsi que `x-amz-content-sha256`, et refuse `If-None-Match: "*"` sur clé existante en `412 PreconditionFailed`.
9. Playwright (`03`) démarre `s3-double` sur `127.0.0.1:4111` et injecte `R2_*` dans `apiServerEnv()` **avant** que `04` ne les rende obligatoires dans `schema.ts`, gardant chaque commit bissectable.
10. `.claude/skills/env-secrets/SKILL.md` reste ≤ `10 Ko` (`6,1 Ko` actuellement) ; le détail des variables et de leur rotation va dans `references/`.
11. Aucun fichier déclencheur `I-4` (`supabase/config.toml`, `.github/workflows/`, `next.config.ts`, `migrations/`) n'est modifié en `R2A` ; aucun plancher `case-floors.ts` n'est abaissé ; budget e2e ≤ `+2 s`.

## Lectures
Commun : cette fiche et `23-migration-cloudflare-r2.md` §3.3 (`l. 209-245`), §5.1 (`l. 309-332`), §8.1 (`l. 640-649`), §9 (`l. 703-717`). Chaque commit de code exécute `pnpm check:fast` avant commit et relève ses planchers.
| # | Tranches et fichiers exacts à lire |
|---|---|
| 00 | `decisions.md` (fin de fichier, `D80`, `D82`, `D89`) ; `decisions-detail.md` `l. 655-760, 930-975` ; `02-architecture-3-espaces.md` §12.3–12.4 (`l. 1220-1340`) ; `03-matrice-des-droits-et-rls.md` P10 & §6.7 (`l. 95-115, 650-715`) ; `04-modele-de-donnees-mvp.md` §5.11 & §9.1 (`l. 2860-2960, 6240-6320`) ; `18-plan-de-test-mvp.md` T9, T11, T17 (`l. 900-1060, 1140-1210, 1520-1590`) ; `21-plan-de-developpement.md` `l. 1-45, 70-195, 225-260` |
| 01 | `.claude/skills/env-secrets/SKILL.md` ; `.claude/skills/env-secrets/references/{catalogue-variables,rotation-et-fuite,garde-fou-et-mise-en-service}.md` ; `docs/mvp/runbooks/staging.md` §2, §5, §10 (`l. 1-95, 190-340`) ; `docs/mvp/runbooks/production.md` §0, §2, §5, §8 (`l. 1-140, 210-330`) ; `docs/mvp/prerequis.md` `l. 1-120` |
| 02 | `23` §7.2 `RG10` (`l. 520-525`) ; `packages/test-kit/package.json` ; `packages/test-kit/src/artifacts.ts` `l. 1-95` ; `packages/test-kit/tests/{artifacts,case-floors}.ts` ; `package.json` (scripts `dev:*`) |
| 03 | `23` §7.2 `RG11` (`l. 525-530`) ; `apps/web/e2e/support/servers.ts` `l. 1-120` ; `apps/web/e2e/start-api.ts` `l. 1-30` ; `apps/web/playwright.config.ts` `l. 120-175` |
| 04 | `23` §3.3 A2–A3 (`l. 209-245`), §7.3–7.4 `RG13`–`RG14`, `RG19` (`l. 537-573`) ; `apps/api/src/config/schema.ts` `l. 1-140, 560-720, 860-1020` ; `apps/api/.env.example` ; `docs/mvp/runbooks/staging.md` `l. 95-190` (`<!-- staging-check:begin/end -->`) ; `apps/api/scripts/{staging-check-rules,staging-check}.ts` ; `apps/api/tests/{helpers,config.test,staging-check.test,database-variables.test,env-local-guard.test,case-floors}.ts` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| F0 | fondateur | Accord de démarrage, réponses `R2-01` à `R2-05`, constat protocole sur `influx-staging-*` et pose des 4 variables `R2_*` sur Railway `staging` (`api` et `worker`). |
| 00 | `docs(mvp): specifications amended for the Lot 3ter (D90)` | Inscription de `D90` (`decisions.md`, `decisions-detail.md`), amendement ciblé de `02` §12.3–12.4, `03` P10 & §6.7, `04` §5.11 & §9.1, `18` T9/T11/T17 et `21` §0/§2/§5.8/§6/§7/§8 (`pnpm docs:index` régénéré). |
| 01 | `docs(skill): env-secrets and runbooks updated for Cloudflare R2` | Mise à jour de `.claude/skills/env-secrets/references/{catalogue-variables,rotation-et-fuite}.md`, `docs/mvp/prerequis.md`, sections narratives de `runbooks/staging.md` (hors bloc auto-vérifié) et portes `eu` / RGPD / `J9S-1` de `runbooks/production.md`. |
| 02 | `feat(test-kit): add local S3 SigV4 double and forbid R2_ in browser artefacts` | Création de `packages/test-kit/src/s3-double.ts` et `scripts/s3-double.ts`, export `./s3-double` dans `packages/test-kit/package.json`, script `dev:s3-double` (`:4011`) dans `package.json`, ajout de `"R2_"` à `BROWSER_FORBIDDEN_NAMES` (`artifacts.ts`) et tests unitaires dédiés. |
| 03 | `test(e2e): start local S3 double in Playwright and pass loopback R2 env` | Ajout de `S3_DOUBLE_PORT = 4111` et des 4 variables `R2_*` loopback (`R2_BUCKET_PREFIX = "e2e-"`) dans `apps/web/e2e/support/servers.ts` (`apiServerEnv`) et démarrage de `s3-double` dans `apps/web/playwright.config.ts` (`webServer`). |
| 04 | `feat(api): validate R2 environment configuration across api, worker and staging:check` | Validation de `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` et `R2_BUCKET_PREFIX` dans `apps/api/src/config/schema.ts`, parité `apps/api/.env.example`, mise à jour simultanée de la table fermée `staging.md` et des règles `staging-check-rules.ts` / `staging-check.ts`, et suites `config.test.ts` / `staging-check.test.ts`. |

Ordre de fin : `04` (push et constat Railway `staging` + `staging:check`), `R` (revue groupée `testeur` + `expert-cybersecurite`), `C` (clôture).
