# Jalon R2A — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = cas livrés (`packages/test-kit/tests/case-floors.ts`, `apps/api/tests/case-floors.ts`), jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| R2A-T1 | unitaire | `packages/test-kit/tests/s3-double.test.ts` | `CA12` : écoute loopback seule, vérification réelle `AWS4-HMAC-SHA256` et `x-amz-content-sha256` (`403 SignatureDoesNotMatch` si altérés), `PUT` + `If-None-Match: "*"` (`200` puis `412 PreconditionFailed`), `GET` (`200` / `404 NoSuchKey`), `DELETE` (`204`), `/_double/state`, `/_double/reset` et injection `queue()` | 10 | 02 |
| R2A-T2 | unitaire, garde | `packages/test-kit/tests/artifacts.test.ts` | `CA16` (`T11.1`) : détection de toute chaîne `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ou `R2_BUCKET_PREFIX` dans un témoin `.next/static` ; `pnpm -r run test:artifacts` vert | +2 | 02 |
| R2A-T3 | e2e | `apps/web/e2e/smoke.spec.ts` (et suite complète) | `CA13` : démarrage sans `.env.local` de `s3-double` sur `127.0.0.1:4111/_double/state` et de `start-api.ts` avec `R2_*` loopback ; `assertNoNewErrors` vert | existant maintenu | 03 |
| R2A-T4 | unitaire, garde | `apps/api/tests/config.test.ts`, `apps/api/tests/database-variables.test.ts`, `apps/api/tests/env-local-guard.test.ts` | `CA15` (`T11.4`, `T17`, `RG148`) : rejet d'hôte cloud en `development`, symétrie exacte `staging`/`production` sur `R2_*`, tout-ou-rien sur `worker` en `development`, secret ≥ 32 o distinct des autres secrets et de `R2_ACCESS_KEY_ID`, parité `.env.example`, absence d'`INFLUX_ENV === "production"` dans `schema.ts` | +12 | 04 |
| R2A-T5 | unitaire, ops | `apps/api/tests/staging-check.test.ts` | `CA16`, `CA21` : parité exacte `namesNotRead` avec `staging.md`, rejet si `R2_BUCKET_PREFIX !== "influx-staging-"`, si `R2_ENDPOINT` porte `.eu.` sur `staging`, ou si `api` et `worker` partagent le même `R2_ACCESS_KEY_ID` | +6 | 04 |

**Budget e2e** (mesuré en CI) : **`+2 s` au plus** pour le jalon (démarrage du serveur `node:http` en mémoire `s3-double:4111` en parallèle des autres `webServer`). **Budget db** : `0 s` (aucun `db-test` touché).

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
