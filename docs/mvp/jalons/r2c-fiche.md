# Jalon R2C — Retrait de `@supabase/storage-js`, désactivation S3 Supabase (`L2BS-4`), CI et vidage `staging`
> Source : `lot3ter-plan.md` l. 26, `23-migration-cloudflare-r2.md` §2.3 (`C1`, `C3`), §4.2, §7.2–7.5, §8.2–8.4 · 2026-11-26 · Statut : à valider · Annexe : `r2c/annexe.md`

## Objectif et périmètre
Achever le décommissionnement propre de Supabase Storage après validation `F1` sur `staging` : supprimer `@supabase/storage-js` et l'inscrire dans `FORBIDDEN_PACKAGES`, désactiver le protocole S3 de Supabase Storage (`L2BS-4`), exclure le conteneur `storage-api` des jobs CI après preuve locale de `db reset`, vider les objets binaires résiduels de Supabase Storage sur `staging` tout en conservant les gardes SQL sur `storage.buckets`, et poser l'attestation `security-reviewed:` (`I-4`) clôturant le Lot 3ter.
**Prérequis et dépendances :** jalon `R2B` clos et validation `F1` du fondateur obtenue sur `staging` ; constat local préalable de `supabase stop && supabase start -x ...,storage-api && supabase db reset --no-seed` sur l'intégralité des migrations `0001` à `0334+`.
**Ne change pas :** `apps/api/src/**` (adaptateur R2 livré en `R2B` intact), `supabase/migrations/**` (aucune migration SQL créée : les 3 lignes `public = false` de `storage.buckets` et `influx_no_member_access` sont conservées), `packages/contracts/**`, `packages/web-platform/**`, `apps/web/**`, `apps/backoffice/**`.
**Hors périmètre :** ouverture effective de l'environnement `production` (Lot 6, portes `21` §5.8), ouverture éventuelle du compartiment `introduction-documents` (Lot 4, arbitrage `D30`).

## Invariants
1. Aucun commit de `R2C` n'est engagé avant la validation `F1` du fondateur sur `staging` (`r2b/run.md`).
2. **Aucune migration SQL ne supprime les lignes de `storage.buckets`** (`23` §2.3 `C1`) : le trigger interne Supabase `protect_buckets_delete` le refuse et les 4 suites `db-tests` de Catégorie B + `03` P10.6 exigent le maintien des 3 lignes `public = false` et des politiques `influx_no_member_access`.
3. En `01`, la modification de `apps/api/package.json` et `pnpm-lock.yaml` impose l'exécution de la **suite complète** (`pnpm check`, règle D76 sur les dépendances), pas seulement `pnpm check:fast`.
4. `@supabase/storage-js` est ajouté à `FORBIDDEN_PACKAGES` (`packages/test-kit/src/static/forbidden-packages.ts`), retiré de l'exception `apps/api/eslint.config.mjs` et banni dans `supabase-guards.test.ts` (seul `@supabase/auth-js` dans `src/platform/supabase.ts` demeure autorisé).
5. En `02`, `[storage.s3_protocol] enabled = false` dans `supabase/config.toml` est également poussé sur le projet Supabase `staging` (`supabase config push`), soldant effectivement `L2BS-4` (`21` §8 l. 171).
6. En `03`, `storage-api` n'est ajouté à `supabase start -x` dans `.github/workflows/ci.yml` **que si** `supabase db reset --no-seed` passe localement sans `storage-api` sur `0001`..`0334+` ; dans le cas contraire, le repli `EC-R2C-1` s'applique immédiatement sans casser la CI.
7. Le vidage des objets de Supabase Storage sur `staging` (`04`) s'effectue uniquement via l'API REST d'administration Storage (jamais par `DELETE FROM storage.objects` en SQL direct, bloqué par Supabase), jusqu'à constat `select count(*) from storage.objects` = `0`.
8. Les commits `02` (`supabase/config.toml` section `[storage.s3_protocol]`) et `03` (`.github/workflows/ci.yml`) déclenchent `check-security-review.ts` (`03` I-4) : après revue favorable d'`expert-cybersecurite` en `R`, le commit `05` pose le marqueur exact `security-reviewed: <YYYY-MM-DD> covers <sha_02> <sha_03>` (`D71`).
9. En clôture `C` (dernier jalon du Lot 3ter), `lot3ter-plan.md` ainsi que les fiches et dossiers `r2a`, `r2b`, `r2c` sont déplacés dans `docs/mvp/archives/jalons/` et `pnpm docs:index` est régénéré.

## Lectures
Commun : cette fiche et `23-migration-cloudflare-r2.md` §2.3 `C1`/`C3` (`l. 130-132`), §4.2 (`l. 269-286`), §7.2–7.5 (`l. 530-605`), §8.2–8.4 (`l. 650-700`).
| # | Tranches et fichiers exacts à lire |
|---|---|
| 01 | `23` §7.2 `RG12` (`l. 530-533`) ; `apps/api/package.json` ; `apps/api/eslint.config.mjs` `l. 30-50, 255-270` ; `packages/test-kit/src/static/forbidden-packages.ts` ; `packages/test-kit/tests/guards.test.ts` ; `test-witnesses/j3b/package.json.txt` ; `apps/api/tests/supabase-guards.test.ts` |
| 02 | `23` §2.3 `C1` (`l. 130`), §7.3 `RG16` (`l. 552-556`) ; `21-plan-de-developpement.md` §8 `l. 170-175` (`L2BS-4`) ; `supabase/config.toml` `l. 80-125` ; `packages/test-kit/scripts/check-security-review.ts` `l. 1-95` |
| 03 | `23` §2.3 `C3` (`l. 132`), §7.5 `RG25` (`l. 602-605`) ; `.github/workflows/ci.yml` `l. 230-260, 345-395` ; `supabase/migrations/{0204_brand_logo_storage,0213_creator_profile_foundation,0223_verification_evidence_and_expiry,0242_creator_portfolio}.sql` (lignes `storage.buckets` uniquement) |
| 04 | `23` §7.4 `RG21` (`l. 580-583`), §8.2 (`l. 650-667`) ; `docs/mvp/21-plan-de-developpement.md` §5.8 & §8 (`l. 120-195, 230-260`) ; `docs/mvp/runbooks/staging.md` |
| 05 | `03-matrice-des-droits-et-rls.md` I-4 ; `decisions-detail.md` `D71` ; `packages/test-kit/scripts/check-security-review.ts` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `chore(api): remove @supabase/storage-js and forbid it in static guards` | Retrait de `@supabase/storage-js` de `apps/api/package.json` et `pnpm-lock.yaml`, ajout dans `FORBIDDEN_PACKAGES` (et son témoin), retrait de l'exception `eslint.config.mjs` et mise à jour de `supabase-guards.test.ts` (`pnpm check` complet exécuté). |
| 02 | `chore(supabase): disable Supabase Storage S3 protocol (L2BS-4)` | Passage de `[storage.s3_protocol] enabled = false` dans `supabase/config.toml` et push de configuration sur le projet Supabase `staging` (`supabase config push`) — **déclenche `I-4`**. |
| 03 | `ci: exclude storage-api from local Supabase stack in database and browser jobs` | Après constat local positif de `db reset` sans `storage-api`, ajout de `storage-api` à la liste `-x` des 3 occurrences `supabase start` de `.github/workflows/ci.yml` (`l. 238, 351, 383`) — **déclenche `I-4`** (ou application du repli `EC-R2C-1`). |
| 04 | `docs(mvp): record staging Supabase Storage object drain and close L2BS-4` | Vidage via l'API REST Storage des objets restants dans les 3 compartiments Supabase Storage de `staging` (`count(storage.objects) = 0`, `count(storage.buckets) = 3`), mise à jour du journal de reliquat `21` §8 (`L2BS-4`, `L2GT-12`, `L2GT-13` soldés). |
| R | revue | Revue de fin de jalon par `testeur` et `expert-cybersecurite` couvrant notamment `02` et `03` au titre d'`I-4`. |
| 05 | `chore(security): attest the end-of-R2C review` | Commit vide ou documentaire portant la bande-annonce `security-reviewed: <YYYY-MM-DD> covers <sha_02> <sha_03>` vérifiée en mode `production` par `check-security-review.ts`. |

Ordre de fin : `04`, `R` (`testeur` + `expert-cybersecurite`), `05` (attestation `I-4`), `C` (clôture et archivage du Lot 3ter dans `docs/mvp/archives/jalons/`).
