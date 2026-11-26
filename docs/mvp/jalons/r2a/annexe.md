# Jalon R2A — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = cas livrés (`packages/test-kit/tests/case-floors.ts`, `apps/api/tests/case-floors.ts`), jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| R2A-T1 | unitaire | `packages/test-kit/tests/s3-double.test.ts` | `CA12` : écoute loopback seule, vérification réelle `AWS4-HMAC-SHA256` et `x-amz-content-sha256` (`403 SignatureDoesNotMatch` si altérés), `PUT` + `If-None-Match: "*"` (`200` puis `412 PreconditionFailed`), `GET` (`200` / `404 NoSuchKey`), `DELETE` (`204`), `/_double/state`, `/_double/reset` et injection `queue()` | 10 | 02 |
| R2A-T2 | unitaire, garde | `packages/test-kit/tests/artifacts.test.ts` | `CA16` (`T11.1`) : détection de toute chaîne `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ou `R2_BUCKET_PREFIX` dans un témoin `.next/static` ; `pnpm -r run test:artifacts` vert | +2 | 02 |
| R2A-T3 | e2e | `apps/web/e2e/signup-nominal.spec.ts` (et suite complète) | `CA13` : démarrage sans `.env.local` de `s3-double` sur `127.0.0.1:4111/_double/state` et de `start-api.ts` avec `R2_*` loopback ; `assertNoNewErrors` vert (CI `ccd2318`, run `45903383037` : `Browser journeys` 1/3..3/3 + `merged` 100 % verts) | existant maintenu | 03 |
| R2A-T4 | unitaire, garde | `apps/api/tests/config.test.ts`, `apps/api/tests/database-variables.test.ts`, `apps/api/tests/env-local-guard.test.ts` | `CA15` (`T11.4`, `T17`, `RG148`) : rejet d'hôte cloud en `development`, symétrie exacte `staging`/`production` sur `R2_*`, tout-ou-rien sur `worker` en `development`, secret ≥ 32 o distinct des autres secrets et de `R2_ACCESS_KEY_ID`, parité `.env.example`, absence d'`INFLUX_ENV === "production"` dans `schema.ts` | +12 | 04 |
| R2A-T5 | unitaire, ops | `apps/api/tests/staging-check.test.ts` | `CA16`, `CA21` : parité exacte `namesNotRead` avec `staging.md`, rejet si `R2_BUCKET_PREFIX !== "influx-staging-"`, si `R2_ENDPOINT` porte `.eu.` sur `staging`, ou si `api` et `worker` partagent le même `R2_ACCESS_KEY_ID` | +6 | 04 |

**Budget e2e** (mesuré en CI, `45903383037` sur `ccd2318` vs `45889493003` sur `a3825d6`) : **`+2 s` au plus** pour le jalon (démarrage du serveur `node:http` en mémoire `s3-double:4111` en parallèle des autres `webServer`). Mesure réelle : étapes `Browser journeys (Playwright)` `76 s + 87 s + 72 s = 235 s` (`3m55s`) vs `111 s + 75 s + 87 s = 273 s` (`4m33s`), soit **delta `-38 s`** (`≤ +2 s`) ; totaux d'éclats `206 s (3m26s) + 237 s (3m57s) + 199 s (3m19s) = 642 s` (`10m42s`) vs `282 s (4m42s) + 209 s (3m29s) + 233 s (3m53s) = 724 s` (`12m04s`), soit **delta `-82 s`**, et `Browser journeys, merged` `17 s` (vérification des planchers `1 s`) vs `26 s` (`-9 s`). **Budget db** : `0 s` (aucun `db-test` touché).

## Critère de fin
- [ ] `F0` répondue mot pour mot dans `r2a/run.md` (`R2-01` à `R2-05`) avant `00` ; `D90` inscrite dans `decisions.md` et `decisions-detail.md` ; `INDEX.md` à jour (`pnpm docs:index`)
- [ ] Constat protocole réel exécuté sur `influx-staging-*` (`PUT` + `If-None-Match: "*"` → `200` puis `412`, `GET` absent → `404 NoSuchKey`, `DELETE` → `204`, clé de test supprimée)
- [ ] Portes d'ouverture `production` (`21` §5.8 et `runbooks/production.md`) mises à jour avec DPA Cloudflare, registre RGPD, texte juriste (`RU-30`), juridiction `eu` et contrôle `J9S-1` (`CA20`)
- [ ] `.claude/skills/env-secrets/SKILL.md` ≤ `10 Ko`
- [ ] `R2A-T1` à `R2A-T5` verts, planchers `case-floors.ts` relevés (`CA12`, `CA13`, `CA15`, `CA16`)
- [ ] Variables `R2_*` posées sur Railway `staging` (`api` et `worker`, 2 jetons distincts) avant push ; déploiement Railway `SUCCESS` sans redémarrage en boucle et `pnpm --filter @influx/api staging:check` 100 % vert (`CA21`)
- [ ] Diff vide sur `apps/api/src/platform/storage.ts`, `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/`
- [ ] Revue `R` (`testeur` + `expert-cybersecurite`) soldée ; `pnpm check` et `pnpm test:e2e` verts (ajout e2e ≤ `+2 s`)

## Écarts, décisions ouvertes, risques
- **EC-R2A-1 (Symétrie D70 vs juridiction `eu` D25)** : `02` §12.4 et `T17` interdisent de distinguer `staging` et `production` dans `apps/api/src/config/schema.ts`. `schema.ts` accepte donc `(?:eu\.)?r2.cloudflarestorage.com` et `^influx-(?:staging|production)-$` sous `isDeployedEnvironment`, tandis que `staging:check` impose non-`eu` + `influx-staging-` sur `staging` et que `production.md` / `J9S-1` imposent `.eu.` + `influx-production-` en `production` (`23` §3.3 A3).
- **EC-R2A-2 (`VALID_WORKER_ENV` dans les tests existants)** : `worker` est instancié sans variable de stockage dans plusieurs tests unitaires en `development` (comme pour `SUPABASE_*`). La règle tout-ou-rien en `development` sur `worker` évite de casser ces suites tout en exigeant les 4 variables sur `staging` et `production`.
- **EC-R2A-3 (Synchronisation `staging.md` ↔ `schema.ts`)** : modifier `staging.md` en `01` avant `schema.ts` en `04` ferait échouer `staging-check.test.ts:141-157` (`namesNotRead`) sur les commits `01` à `03`. `01` ne modifie donc que les sections narratives hors bornes `<!-- staging-check:begin/end -->`, et `04` met à jour la table bornée en même temps que `schema.ts`.
- **Sécurité (`I-4`)** : aucun fichier surveillé par `check-security-review.ts` n'est touché en `R2A`.
- **Risques et retour arrière** : risque unique de crash Railway si `04` est poussé avant la pose des variables `R2_*` sur `api` et `worker` (prévenu par l'invariant 7). `storage.ts` n'étant pas modifié en `R2A`, un `git revert` suffit sans aucun impact sur les images existantes.

## Revue
Revue groupée `R2A-R` (`testeur` + `expert-cybersecurite`, plage `66137d0..4ccb74f`, `00` à `04`). **0 `bloquant`, 1 `à corriger dans le jalon` (`R2AT-1` → `fix-1`), 2 `avant production` (`R2AS-1`, `R2AS-2`), 10 `plus tard` (`R2AT-2`..`5`, `R2AS-3`..`6`).** Contrôle `I-4` vert (`security review markers: ok`).
Entre-temps, le run CI `45901673136` avait échoué sur `apps/web/tests/visual-compare.test.ts:512` (attendait 4 `webServer` au lieu de 5) ; ce défaut CI a été corrigé par `ccd2318` (`fix(web): expect 5 playwright webServers after s3-double addition`) et le run CI `45903383037` sur `ccd2318` est **100 % vert** (`Static checks, unit tests, build` 4m14s, `Browser journeys` 1/3 3m26s, 2/3 3m57s, 3/3 3m19s, `Browser journeys, merged` 17s, `Database tests` 1/2 4m09s & 2/2 4m41s, `Relay` 21s, `Migrate staging` 27s).

### À corriger dans le jalon (→ `fix-1`)
- **R2AT-1** (`testeur`) — `docs/mvp/jalons/r2a/run.md:8`, `docs/mvp/jalons/r2a/annexe.md:9`, `docs/mvp/jalons/r2a/03.md:11` : preuve E2E `R2A-T3` incomplète après `R2A-04` (`run.md:8` consignait un passage partiel sur `ecb71ad` avant `4ccb74f`), delta de durée `≤ +2 s` non consigné, et `annexe.md:9` / `03.md:11` citent `apps/web/e2e/smoke.spec.ts` inexistant dans le dépôt. *Scénario* : la référence `smoke.spec.ts` pointe vers un fichier absent et l'exécution E2E complète post-`4ccb74f` (avec mesure du budget `≤ +2 s`) manque à la clôture. *Correctif* (`fix-1`) : corriger la référence `smoke.spec.ts` dans `annexe.md` et `03.md`, relever le run CI vert `45903383037` sur `ccd2318` (45 planchers + `assertNoNewErrors`) et consigner le delta E2E mesuré (`≤ +2 s`). **Soldé (`fix-1`)** : référence remplacée par `signup-nominal.spec.ts` dans `annexe.md:9` et `03.md:11` ; preuve CI `45903383037` (`ccd2318`) relevée : `Browser journeys` `1/3` `3m26s` (`110 passed`, step Playwright `76 s`), `2/3` `3m57s` (`101 passed`, `87 s`), `3/3` `3m19s` (`95 passed`, `72 s`), `merged` `17 s` (`44` planchers `e2e/case-floors.ts` vérifiés + `assertNoNewErrors` vert), soit `-38 s` sur les étapes Playwright (`235 s` vs `273 s`) et `-82 s` sur les éclats (`642 s` vs `724 s`) vs `45889493003` (`a3825d6`).

### Avant production (une ligne chacun)
- **R2AS-1** (`expert-cybersecurite`) — `docs/mvp/21-plan-de-developpement.md:106,115` : l. 115 nomme `constat d'écriture/suppression J9S-1` le test `R2-03` (distinct du script `J9S-1` de `docs/mvp/runbooks/production.md:308-318`) et l. 106 ne cite pas Cloudflare R2.
- **R2AS-2** (`expert-cybersecurite`) — `docs/mvp/runbooks/production.md:327-339` : livrer le script automatisé `production:check` (`.eu.`, `influx-production-`, `api` ≠ `worker`, sans valeur affichée) avant ouverture `production`.

### Plus tard (une ligne chacun)
- **R2AT-2** (`testeur`) — `packages/test-kit/src/s3-double.ts:449` : `void (async () => ...)` sans `try/catch` autour de `await readRawBody(request)`.
- **R2AT-3** (`testeur`) — `packages/test-kit/tests/s3-double.test.ts:102-424` : `setDefaultDelay()`, `canonicalQueryOf()`, `400 InvalidRequest` et `405 MethodNotAllowed` sans cas unitaire dédié.
- **R2AT-4** (`testeur`) — `apps/api/scripts/staging-check-rules.ts:403-408` et `apps/api/tests/env-local-guard.test.ts:57-69` : `envLocalR2Issues` ne vérifie pas longueur/placeholder de `R2_SECRET_ACCESS_KEY` et `HARNESS_FILES` omet `s3-double.ts`.
- **R2AT-5** (`testeur`) — `apps/web/playwright.config.ts:7` : commentaire `Four servers` à passer à `Five servers`.
- **R2AS-3** (`expert-cybersecurite`) — `apps/api/src/config/schema.ts:913-927` : exclure espaces/retours à la ligne sur `R2_ACCESS_KEY_ID`.
- **R2AS-4** (`expert-cybersecurite`) — `apps/api/scripts/staging-check-rules.ts:165-187,391-414` : rejeter `CHANGE_ME` / `< 32 o` dans `envLocalR2Issues` et comparer le condensat SHA-256 de `R2_ENDPOINT` entre `api` et `worker`.
- **R2AS-5** (`expert-cybersecurite`) — `packages/test-kit/src/s3-double.ts:343-354,475` : borner la taille dans `readRawBody` et ajouter `try/catch`.
- **R2AS-6** (`expert-cybersecurite`) — `packages/test-kit/src/artifacts.ts:9-27` : ajouter `"r2.cloudflarestorage.com"` et `".r2.dev"` à `BROWSER_FORBIDDEN_NAMES`.
