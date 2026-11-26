# Jalon R2B — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; planchers relevés dans `apps/api/tests/case-floors.ts`, `apps/api/db-tests/case-floors.ts` et `apps/web/e2e/case-floors.ts`.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| R2B-T1 | unitaire | `apps/api/tests/storage-r2.test.ts` | `CA8`, `CA9`, `CA10`, `CA11`, `CA17` (`RG22`) : vecteur officiel AWS SigV4 au caractère près, `PUT`/`GET`/`DELETE` contre `startS3Double()`, `invalid_key` sans appel réseau, `412 PreconditionFailed` sur `If-None-Match: "*"`, annulation immédiate de flux > `1 Mio` / `8 Mio` avec et sans `Content-Length`, timeout `unavailable`, parseur `<Code>` borné à 8 Kio et `valuesFoundIn` = `[]` sur secrets/clés/URL | 14 | 01 |
| R2B-T2 | base + HTTP | `apps/api/db-tests/tm1-storage-purge.test.ts` | `CA7` (`L2GT-13`) : `storage_purge` sur `startS3Double()` couvrant les **3 compartiments** (`brand-logo`, `verification-evidence`, `portfolio`), idempotence sur `404`, rejeu sur `500` (`storage.remove_failed`), conservation des objets actifs | +3 | 02 |
| R2B-T3 | base + HTTP | `apps/api/db-tests/{profiles-brand-logo-route,profiles-portfolio-route,verification-evidence,verification-evidence-route}.test.ts` | `CA1`, `CA2`, `CA3`, `CA4`, `CA5`, `CA6`, `CA17` : dépôt/lecture/remplacement/suppression WebP sans EXIF (`T9.5`), réessai sur `503` (`CA4`), objet R2 manquant → `{ logo: null }` ou `404` sans `500` (`CA5`), `503 decision_blocked` en file 4/5 (`CA6`), `valuesFoundIn` (`D60`) | +6 (cumulé) | 02 |
| R2B-T4 | base + sécu | `apps/api/db-tests/t9-evidence-unreachable.test.ts` | `CA2`, `CA17` (`T9.2`, `T9.6`, `L2GT-12`) : inaccessibilité totale d'une pièce pour les marques, absence de `supabase`, `r2.cloudflarestorage.com`, `r2.dev` et `x-amz-` dans toutes les réponses membre et backoffice ; 5 suites SQL Cat. B intactes | +2 | 02 |
| R2B-T5 | unitaire | `apps/api/tests/staging-dataset-guards.test.ts` | `CA22` (`RG20`) : `stagingR2()` refuse `production`, `.eu.` et tout préfixe ≠ `influx-staging-` ; `--reupload-images` n'émet aucun appel GoTrue/DELETE compte et traite `412` en `skipped` | +5 | 03 |
| R2B-T6 | e2e | `apps/web/e2e/brand-profile.spec.ts` (+ 7 autres specs d'images et `recette-loaders.spec.ts`) | `CA1`–`CA5`, `CA24` (`RG24`) : objets écrits dans `s3-double:4111` sous préfixe `e2e-`, repli propre `LogoPlate` / carte lorsque l'objet est retiré de `s3-double` (`CA5`), zéro hôte R2 dans le DOM/réseau, 3 passes consécutives vertes | +2 | 04 |

**Budget e2e** (mesuré en CI) : **`+3 s` au plus** pour `04` (cumul lot ≤ `+5 s`). **Budget db** : chaque éclat `db` ≤ `7 min 30` (gain attendu sur l'éclat 2 grâce au remplacement des appels réseau Kong/`storage-api` par `startS3Double()` en mémoire).

## Critère de fin
- [ ] `R2B-T1` à `R2B-T6` verts ; aucun plancher `case-floors.ts` abaissé (`CA8`–`CA11`, `CA17`, `CA24`)
- [ ] `package.json` et `pnpm-lock.yaml` intacts (`@supabase/storage-js` encore présent pour rollback, aucun `@aws-sdk/*` ajouté)
- [ ] Déploiement Railway `staging` (`api` et `worker`) vert et `staging:check` 100 % vert
- [ ] Sur `staging`, `db:staging-fake-profiles -- --pool=<dir> --reupload-images` exécuté **2 fois de suite** : 1er passage peuple les logos des 50 marques et visuels des 100 créateurs sans croissance d'`outbox_events` ; 2e passage affiche `100 % skipped` (`412 PreconditionFailed` réel sur R2, `CA22`)
- [ ] Sur `staging`, lecture/écriture/suppression vérifiées sur les 3 compartiments (`brand-logo`, `portfolio`, `verification-evidence` en file 4 avec `verification.evidence_viewed`) + exécution `storage_purge` (`remove_failed = 0`, `CA1`–`CA7`)
- [ ] Objets historiques de Supabase Storage sur `staging` vérifiés intacts (`CA23` : retour arrière vers `R2A` garanti sans perte)
- [ ] Validation `F1` du fondateur consignée dans `r2b/run.md`
- [ ] Diff vide sur `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/`
- [ ] Revue `R` (`testeur` + `expert-cybersecurite`) soldée ; `pnpm check` et `pnpm test:e2e` verts

## Écarts, décisions ouvertes, risques
- **EC-R2B-1 (`supabase-guards.test.ts:92` pendant la fenêtre de réversibilité)** : `supabase-guards.test.ts` assertait simultanément la présence de `@supabase/storage-js` dans `package.json` (`l. 80`) et son import par `src/platform/storage.ts` (`l. 93`). En `R2B-01`, l'assertion d'import passe à `[]` tandis que le paquet reste dans `package.json` jusqu'à `R2C-01`.
- **EC-R2B-2 (Comptes de démo manuels hors `seed-fake-profiles` sur `staging`)** : les éventuelles images déposées à la main avant `R2B` ne sont pas copiées depuis Supabase Storage (`23` §4.3). Grâce à `RG3` (`CA5`), leurs écrans affichent proprement l'état sans image (`LogoPlate` / retrait de carte) sans erreur `500` jusqu'à un nouveau dépôt.
- **Sécurité (`I-4`)** : aucun fichier déclencheur `I-4` n'est touché en `R2B` ; la revue `expert-cybersecurite` en `R` audite spécifiquement le signeur SigV4, le lecteur de flux borné et la réduction d'erreur XML (`D60`).
- **Risques et retour arrière** : en cas d'anomalie R2 découverte sur `staging` en `05` ou lors de `F1`, redéployer ensemble `api` et `worker` sur le commit de clôture de `R2A` restaure instantanément Supabase Storage avec 100 % des anciens objets intacts (`23` §8.3).

## Revue
