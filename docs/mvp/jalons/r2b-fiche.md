# Jalon R2B — Adaptateur S3 SigV4 Cloudflare R2, bascule des 3 flux d'images et seed `--reupload-images`
> Source : `lot3ter-plan.md` l. 25, `23-migration-cloudflare-r2.md` §3.1–3.3, §4, §5.2, §6, §7.1–7.5, §8.2–8.3 · 2026-11-26 · Statut : ouvert (validé le 2026-11-27) · Annexe : `r2b/annexe.md`

## Objectif et périmètre
Remplacer l'implémentation interne de `apps/api/src/platform/storage.ts` par le client S3 path-style signé `AWS4-HMAC-SHA256` (`node:crypto` + `boundedFetch`) ciblant Cloudflare R2, brancher `server.ts`, `worker.ts` et les 5 suites `db-tests` HTTP sur `config.r2` / `startS3Double()`, migrer `seed-staging-fake-profiles.ts` avec l'option idempotente `--reupload-images`, et valider sur `staging` l'ensemble des 15 routes d'images et la purge horaire E-4 `storage_purge` jusqu'à l'accord `F1` du fondateur.
**Prérequis et dépendances :** jalon `R2A` clos, `staging:check` vert sur `staging` (`R2_*` actives sur `api` et `worker`), pool photo local disponible pour `--reupload-images`.
**Ne change pas :** signature publique `ObjectStore` (`write`, `read`, `remove`), `platform/images.ts` (`sharp`), les 15 routes HTTP et `storage-purge.ts`, `@influx/contracts`, `packages/web-platform`, `apps/web/src/**`, `apps/backoffice/src/**`, `supabase/**`, et la présence de `@supabase/storage-js` dans `package.json` ainsi que des anciens objets dans Supabase Storage (conservés intacts jusqu'à `R2C` pour garantir un retour arrière immédiat).
**Hors périmètre :** retrait de `@supabase/storage-js` de `package.json`, désactivation `[storage.s3_protocol]`, retrait de `storage-api` en CI et vidage des objets Supabase Storage de `staging` (`R2C`).

## Invariants
1. `ObjectStore`, `STORAGE_BUCKETS`, `STORAGE_READ_MAX_BYTES`, `OBJECT_KEY_PATTERNS` et `isObjectKey` dans `apps/api/src/platform/storage.ts` gardent exactement leurs types et comportements ; aucune méthode d'URL présignée ni `ListObjectsV2` n'est ajoutée (`T9.2`, `T9.6`, `T9.7`).
2. Aucune dépendance externe (`@aws-sdk/*` ou autre) n'est ajoutée à `package.json` ni `pnpm-lock.yaml` (`23` §3.3 A1).
3. `isObjectKey(bucket, key)` est évalué **avant** toute construction d'URL ou signature ; toute clé hors motif renvoie `{ ok: false, reason: "rejected", status: null, errorCode: "invalid_key" }` sans appel réseau (`T9.3`, `T9.9`).
4. Tout `PUT` vers R2 est adressé en path-style `${endpoint}/${bucketPrefix}${bucket}/${key}` avec `Content-Type: image/webp`, `x-amz-content-sha256` égal au SHA-256 hexadécimal réel du corps (`UNSIGNED-PAYLOAD` interdit) et `If-None-Match: "*"` (`412` → `{ ok: false, reason: "rejected", status: 412, errorCode: "PreconditionFailed" }`).
5. `read()` annule immédiatement le flux (`body.cancel()` / `reader.cancel()`) dès que `Content-Length` ou le cumul d'octets reçus dépasse `STORAGE_READ_MAX_BYTES[bucket]` (`1 Mio` logo, `8 Mio` pièce/visuel), même sans `Content-Length` (`RG9`).
6. Sur erreur HTTP ≥ 400, `storage.ts` lit au plus `8 192` octets et n'extrait que `<Code>([A-Za-z0-9_]{1,64})</Code>` ; ni `<Message>`, ni `<Key>`, ni l'URL, ni `Authorization`, ni `R2_*` n'entrent dans une valeur retournée ou un journal (`D60`).
7. Un objet absent dans R2 (`404` ou `NoSuchKey`) produit `{ ok: true, value: null }` sur `read()` et `{ ok: true, value: null }` sur `remove()` (idempotence de `storage_purge` et `removeAtBest`).
8. `seed-staging-fake-profiles.ts` vérifie `stagingR2()` (`script-guards.ts` : refuse `production`, tout endpoint `.eu.` et tout préfixe hors `influx-staging-`), ne supprime aucun compte existant et n'émet aucun événement dans `outbox_events`.
9. Aucun objet de Supabase Storage sur `staging` n'est supprimé pendant `R2B` (`RG21`) ; aucun plancher `case-floors.ts` n'est abaissé ; éclats `db` ≤ `7 min 30` et ajout e2e ≤ `+3 s`.

## Lectures
Commun : cette fiche et `23-migration-cloudflare-r2.md` §4 (`l. 257-304`), §5.2 (`l. 333-361`), §6 (`l. 380-463`), §7.1–7.5 (`l. 472-602`). Chaque commit de code exécute `pnpm check:fast` avant commit.
| # | Tranches et fichiers exacts à lire |
|---|---|
| 01 | `23` §3.3 A1 (`l. 193-208`), §4.1 (`l. 259-268`), §5.2 (`l. 333-361`), §7.2 `RG6`–`RG9` (`l. 500-519`), §7.5 `RG22` (`l. 587-592`) ; `apps/api/src/platform/{storage,supabase}.ts` (`supabase.ts` `l. 204-245`) ; `apps/api/src/{server,worker}.ts` (`server.ts` `l. 590-615`, `worker.ts` `l. 395-425`) ; `apps/api/tests/{supabase-guards.test,helpers,case-floors}.ts` ; `apps/api/db-tests/support.ts` |
| 02 | `23` §6 (`l. 380-463`), §7.1 `RG1`–`RG5` (`l. 472-496`), §7.5 `RG23` (`l. 593-597`) ; `apps/api/db-tests/{tm1-storage-purge,profiles-brand-logo-route,profiles-portfolio-route,verification-evidence,verification-evidence-route,t9-evidence-unreachable}.test.ts` ; `apps/api/db-tests/case-floors.ts` |
| 03 | `23` §2.3 `C4` (`l. 133`), §4.3 (`l. 288-304`), §7.4 `RG20` (`l. 574-579`) ; `apps/api/scripts/{script-guards,seed-staging-fake-profiles}.ts` ; `apps/api/tests/{staging-dataset-guards.test,case-floors}.ts` |
| 04 | `23` §2.3 `C2` (`l. 131`), §6.6–6.8 (`l. 433-463`), §7.5 `RG24` (`l. 598-601`) ; `packages/test-kit/src/s3-double.ts` (`l. 343-354`, `l. 441-475`) ; `apps/web/e2e/{brand-profile,creator-portfolio,brand-creator-search,verification-creator,verification-backoffice,backoffice-queue,creator-queue,portfolio-queue,recette-loaders}.spec.ts` ; `apps/web/e2e/case-floors.ts` |
| 05 | `23` §8.2–8.3 (`l. 650-680`) ; `docs/mvp/runbooks/staging.md` §5, §6, §10 |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `feat(api): replace ObjectStore implementation with native S3 SigV4 client for R2` | Réécriture S3 SigV4 (`node:crypto` + `boundedFetch`, flux borné, parseur `<Code>` borné à 8 Kio) dans `apps/api/src/platform/storage.ts`, branchement `config.r2` dans `server.ts` et `worker.ts`, ajustement de `importersOf(@supabase/storage-js)` à `[]` dans `supabase-guards.test.ts`, migration des 6 appels `createObjectStore` des 5 suites HTTP via un helper `s3-double` dans `db-tests/support.ts`, et suite unitaire `apps/api/tests/storage-r2.test.ts`. |
| 02 | `test(api): prove R2 failure modes, 3-bucket purge and T9 host guards in db-tests` | Enrichissement des 5 `db-tests` sur `startS3Double()` (`queue()` : `503`, `404` objet manquant `CA5`, `decision_blocked` `CA6`, `412` `CA10`, purge E-4 des 3 compartiments dont `portfolio` `L2GT-13`) et extension de `t9-evidence-unreachable.test.ts` / lectures agent (`L2GT-12`) contre tout hôte `r2.cloudflarestorage.com`, `r2.dev` ou `x-amz-`. |
| 03 | `feat(api): migrate staging fake profiles seed to R2 and add --reupload-images` | Ajout de `stagingR2()` dans `apps/api/scripts/script-guards.ts`, remplacement des appels REST Supabase Storage par `createObjectStore` dans `seed-staging-fake-profiles.ts`, mode idempotent `--reupload-images` (`412` → `skipped`, `--dry-run` supporté) et tests unitaires `staging-dataset-guards.test.ts`. |
| 04 | `test(e2e): verify end-to-end image flows, missing-object fallback and R2 isolation` | Vérification sur `s3-double:4111` des 8 specs E2E d'images + `recette-loaders.spec.ts`, ajout de `POST /_double/delete` et durcissement `readRawBody` borné + `try/catch` (`R2AS-5`, `R2AT-2`) dans `s3-double.ts`, et cas E2E prouvant la présence des WebP sous préfixe `e2e-`, la tenue de l'UI sur objet absent (`CA5`) et l'absence d'hôte R2 dans le DOM/réseau. |
| 05 | `docs(mvp): record staging R2 cutover, --reupload-images and E-4 purge verification` | Après push de `01`–`04` et déploiement Railway `staging`, exécution documentée (sans secret) dans `r2b/annexe.md` de `staging:check`, des 2 passages `--reupload-images` (`CA22`) et des contrôles réels `PUT`/`GET`/`DELETE`/`storage_purge` sur les 3 compartiments R2 de `staging`. |
| F1 | fondateur | Validation par le fondateur du fonctionnement réel sur `staging` avant retrait définitif de Supabase Storage en `R2C`. |

Ordre de fin : `04`, push + `05` (`integrateur` sur `staging`), `F1` (arrêt validation fondateur), `R` (revue groupée `testeur` + `expert-cybersecurite`), `C` (clôture).
