# Jalon R2C — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; planchers maintenus ou relevés dans `packages/test-kit/tests/case-floors.ts` et `apps/api/tests/case-floors.ts`.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| R2C-T1 | unitaire, garde | `apps/api/tests/supabase-guards.test.ts`, `packages/test-kit/tests/guards.test.ts` | `CA14` (`RG12`) : `@supabase/storage-js` absent de tous les `package.json` et de `pnpm-lock.yaml`, rejeté par `forbiddenPackagesIn` et `forbiddenPackagesInLockfile` sur témoin, seul `@supabase/auth-js` autorisé dans `src/platform/supabase.ts` | +2 | 01 |
| R2C-T2 | base (SQL) | `apps/api/db-tests/{profiles-brand-logo,profiles-portfolio,verification-evidence,t9-evidence-unreachable,creator-profile-door}.test.ts` | `CA18` (`RG16`) : maintien intégral des 3 compartiments `public = false` dans `storage.buckets` et des politiques `influx_no_member_access` après désactivation `[storage.s3_protocol]` (`L2BS-4`) | existant maintenu | 02 |
| R2C-T3 | CI (`db` + `e2e`) | `.github/workflows/ci.yml` | `CA25` (`RG25`) : `supabase start -x ...,storage-api && supabase db reset --no-seed` applique sans erreur `0001`..`0334+` en local puis sur les 2 éclats `db` et les 3 éclats `e2e` en CI | 5 jobs CI verts | 03 |
| R2C-T4 | garde sécu | `packages/test-kit/scripts/check-security-review.ts` | `CA19` (`RG17`, `03` I-4) : exécuté avec simulation `INFLUX_ENV=production` / vérification stricte des marqueurs, confirme que les SHA de `02` et `03` sont couverts par `security-reviewed:` en `05` | 0 commit non couvert | 05 |

**Budget e2e** (mesuré en CI) : **`0 s`** d'ajout (gain de temps d'amorçage CI sur les 3 éclats `e2e` et les 2 éclats `db` par non-téléchargement et non-démarrage de `storage-api`).

## Critère de fin
- [ ] `R2C-T1` vert et `pnpm check` complet exécuté dès `01` (règle D76 dépendances) (`CA14`)
- [ ] `[storage.s3_protocol] enabled = false` commité dans `supabase/config.toml` et appliqué sur `staging` (`L2BS-4` soldé dans `21` §8, `CA18`)
- [ ] Constat local `supabase start -x ...,storage-api && supabase db reset --no-seed` consigné et CI GitHub Actions (`check`, 2 éclats `db`, 3 éclats `e2e`) 100 % verte (`CA25`)
- [ ] Sur `staging`, objets Supabase Storage vidés via l'API REST Storage : `select count(*) from storage.objects` = `0` et `select count(*) from storage.buckets where public = false` = `3` (`CA23`)
- [ ] `staging:check` et parcours de fumée R2 sur `staging` toujours 100 % verts après vidage Supabase Storage
- [ ] Portes d'ouverture de `production` (`21` §5.8 et `runbooks/production.md`) relues et complètes (`CA20`)
- [ ] Revue `R` (`testeur` + `expert-cybersecurite`) soldée, suivie du commit `05` portant `security-reviewed:` vérifié par `R2C-T4` (`CA19`)
- [ ] En clôture `C`, archivage de `lot3ter-plan.md`, `r2a*`, `r2b*`, `r2c*` dans `docs/mvp/archives/jalons/`, ligne de clôture du Lot 3ter dans `21` §8 et `INDEX.md` régénéré

## Écarts, décisions ouvertes, risques
- **EC-R2C-1 (Repli si `supabase db reset` échoue sans `storage-api`)** : les migrations immuables `0204`, `0213`, `0223` et `0242` insèrent dans `storage.buckets (id, name, public, file_size_limit, allowed_mime_types)`. Si l'image `supabase/postgres` de la CLI Supabase ne possède ces colonnes qu'après exécution des migrations internes de `storage-api`, le test local préalable échouera proprement. **Repli prévu et sans risque :** conserver `storage-api` dans `ci.yml` (inutilisé par `apps/api` qui parle exclusivement à `s3-double`) et transformer `03` en commit documentaire consignant le motif technique dans cette annexe.
- **EC-R2C-2 (Interdiction du `DELETE` SQL direct sur `storage.objects` et `storage.buckets`)** : Supabase protège ces tables par triggers (`protect_objects_delete`, `protect_buckets_delete`). Le vidage de `04` passe donc exclusivement par `DELETE /storage/v1/object/<bucket>` (API REST d'administration avec la clé secrète `staging`, hors `apps/api/src/`), en laissant les 3 compartiments vides et privés en place.
- **Sécurité (`I-4`)** : **ACTIVE sur ce jalon.** `02` (`supabase/config.toml` section `[storage.s3_protocol]`) et `03` (`.github/workflows/ci.yml`) figurent dans le périmètre de `packages/test-kit/scripts/check-security-review.ts` (`l. 39-57`). L'attestation `05` est obligatoire avant clôture.
- **Risques et retour arrière** : après le vidage `04` sur `staging`, revenir à Supabase Storage imposerait de révoquer `R2C` et `R2B` puis de relancer `seed-staging-fake-profiles.ts` vers Supabase ; ce risque est maîtrisé car `R2C` ne démarre qu'après validation complète sur `staging` et accord `F1` du fondateur en fin de `R2B`.

## Revue
