# Lot 3ter — Migration du stockage des images vers Cloudflare R2 : découpage en jalons
> 2026-11-26 · Claude Code (`/lot-decoupe`, format D77) · Statut : **à valider par le fondateur** ; aucun code sans accord distinct

Sources : `../23-migration-cloudflare-r2.md` (exigences `RG1` à `RG25`, critères `CA1` à `CA25`, décisions `D90` / `R2-01` à `R2-05`) et audit confronté `../audit-stockage-images-cloudflare.md`.
Identifiants `R2A` à `R2C` (lot technique hors numérotation entière, comme `RU`, `DS`, `SN`, `RK`) ; fiches `jalons/r2a-fiche.md`, `jalons/r2b-fiche.md`, `jalons/r2c-fiche.md` et annexes `jalons/r2*/annexe.md`.
**Orthogonalité avec le Lot 3bis (`RUB` en cours) :** zéro fichier de `apps/web/src/`, `apps/backoffice/src/`, `packages/ui/`, `packages/contracts/` ou `packages/web-platform/` modifié.

## Préalables
| Décision ou question | Arbitre | Bloque quel jalon | État |
|---|---|---|---|
| `R2-01` : numéro (`23`), code (`R2`), 3 jalons (`R2A`–`R2C`) et cadencement vis-à-vis de `RUB` | Fondateur, `chef-de-projet` | Tous | Ouverte (`F0`) |
| `R2-02` : sous-traitance RGPD Cloudflare, juridiction `default` en `staging` (Verrou 4 `B9`) et portes `21` §5.8 (`RU-30`) | Fondateur, `expert-conformite-rgpd`, juriste (`D29`) | `R2A-00`, ouverture `production` | Ouverte (`F0`) |
| `R2-03` : deux jetons R2 `Object Read & Write` distincts par environnement (`api` ≠ `worker`) et constat `eu` | Fondateur, `expert-cybersecurite` | `R2A` | Ouverte (`F0`) |
| `R2-04` : politique de sauvegarde R2 face au PITR PostgreSQL (`D57`, pas de réplication secondaire au MVP) | Fondateur, `architecte` | `R2A-00`, ouverture `production` | Ouverte (`F0`) |
| `R2-05` : règle `AbortIncompleteMultipartUpload = 1 j` sur les 6 compartiments et absence de `ListObjectsV2` dans `src/` | `architecte`, Fondateur | `R2A` | Ouverte (`F0`) |
| Constat protocole réel sur `influx-staging-*` (`PUT` + `If-None-Match: "*"` → `412`, `GET` absent → `404 NoSuchKey`, `DELETE` → `204`) | Fondateur / `integrateur` | `R2A-04`, `R2B-01` | À exécuter avant `R2A-04` |
| Pose préalable des 4 variables `R2_*` sur Railway `staging` (`api` et `worker`, jetons distincts) et dans `apps/api/.env.local` | Fondateur / `integrateur` | Push de `R2A` sur `main` | À exécuter avant push `R2A` |
| Validation `F1` sur `staging` après bascule R2 et `--reupload-images` (anciens objets Supabase encore intacts) | Fondateur | `R2C` (irréversible sans re-seed) | À obtenir en fin de `R2B` |
| Preuve locale `supabase stop && supabase start -x ...,storage-api && supabase db reset --no-seed` sur `0001`..`0334+` | `integrateur`, `expert-database` | `R2C-03` | À exécuter en entrée de `R2C` |

## Jalons
| ID | Objectif (une phrase) | Spécifications (tranches) | Migrations | Écrans | Tests porteurs | Dépend de | Commits estimés | Critère de fin |
|---|---|---|---|---|---|---|---|---|
| **R2A** | Amender les spécifications (`D90`), livrer la doublure locale `s3-double`, câbler Playwright `:4111` et valider `R2_*` au démarrage ainsi que dans `staging:check` sans basculer `storage.ts` | `23` §3 (`l. 139-254`), §5.1 (`l. 309-332`), §7.2–7.4 (`l. 520-573`), §8.1 (`l. 640-649`), §9 (`l. 703-717`) | — | — | `s3-double.test`, `artifacts.test` (`T11.1`), `config.test` (`T17`), `staging-check.test`, `database-variables.test` (`T11.4`), `pnpm test:e2e` | `F0` (`R2-01` à `R2-05`) ; `R2_*` posées sur Railway `staging` | 5 | `pnpm check` et `pnpm test:e2e` verts ; Railway `staging` redéployé sans crash ; `staging:check` 100 % vert (`CA12`, `CA13`, `CA15`, `CA16`, `CA20`, `CA21`) |
| **R2B** | Basculer `ObjectStore` sur le signeur S3 SigV4 natif vers Cloudflare R2, migrer les 5 `db-tests` HTTP et le seed `--reupload-images`, et valider de bout en bout les 3 flux d'images et `storage_purge` sur `staging` | `23` §3.1–3.3 (`l. 141-208`), §4 (`l. 257-304`), §5.2 (`l. 333-361`), §6 (`l. 380-463`), §7.1–7.5 (`l. 472-602`), §8.2–8.3 (`l. 650-680`) | — | — | `storage-r2.test`, 5 `db-tests` S3 + `t9-evidence-unreachable` (`T9`, `D60`), `staging-dataset-guards.test`, 8 specs E2E d'images + `recette-loaders` | `R2A` | 5 | 15 routes + `storage_purge` + `--reupload-images` (2 passages) prouvés sur `staging` ; `F1` validée par le fondateur (`CA1`–`CA11`, `CA17`, `CA22`–`CA24`) |
| **R2C** | Retirer `@supabase/storage-js`, verrouiller les gardes statiques, désactiver le protocole S3 Supabase (`L2BS-4`), exclure `storage-api` en CI, vider les objets Supabase de `staging` et attester la revue `I-4` | `23` §2.3 `C1`/`C3` (`l. 130-132`), §4.2 (`l. 269-286`), §7.2–7.5 (`l. 530-605`), §8.2–8.4 (`l. 650-700`) | — (`config.toml` seul) | — | `supabase-guards.test`, `guards.test` (`FORBIDDEN_PACKAGES`), suite `db-tests` Cat. B (`storage.buckets`), `check-security-review.ts` (`I-4`) | `R2B` + `F1` | 5 | `@supabase/storage-js` banni ; `L2BS-4` soldé ; `storage.objects` à `0` sur `staging` ; CI verte ; attestation `security-reviewed:` posée (`CA14`, `CA18`, `CA19`, `CA23`, `CA25`) |

Total : **3 jalons, 15 commits** (hors lignes `F0`, `F1`, `R`, `C`). Ordre séquentiel strict : `R2A` → `R2B` (`+ F1`) → `R2C`. Aucune migration SQL n'est créée (`0001` à `0334` inchangées).

## Couverture des exigences et critères de `23`
| Jalon | Exigences `RGn` livrées | Critères d'acceptation `CAn` vérifiés |
|---|---|---|
| **R2A** | `RG10`, `RG11`, `RG13`, `RG14`, `RG18` (spec), `RG19`, `RG24` (socle `:4111`) | `CA12`, `CA13`, `CA15`, `CA16`, `CA20`, `CA21` |
| **R2B** | `RG1` à `RG9`, `RG15`, `RG20`, `RG21` (réversibilité), `RG22`, `RG23`, `RG24` (complet) | `CA1` à `CA11`, `CA17`, `CA22`, `CA23` (avant vidage), `CA24` |
| **R2C** | `RG12`, `RG16`, `RG17`, `RG18` (portes finales), `RG21` (vidage), `RG25` | `CA14`, `CA18`, `CA19`, `CA23` (après vidage), `CA25` |

## Reliquat repris (`21` §8)
| # | Jalon qui le traite |
|---|---|
| **`L2BS-4`** (désactiver `[storage.s3_protocol]` dans `supabase/config.toml` et sur Supabase hébergé) | **`R2C-02`** (soldé intégralement et poussé sur `staging`) |
| **`L2GT-12`** (absence d'hôte de stockage dans les lectures agent et membre) | **`R2B-02`** (couvert sur les routes de lecture et `t9-evidence-unreachable.test.ts` pour `supabase`, `r2.cloudflarestorage.com`, `r2.dev`, `x-amz-`) |
| **`L2GT-13`** (couverture du compartiment `portfolio` dans la purge E-4) | **`R2B-02`** (`tm1-storage-purge.test.ts` étendu aux 3 compartiments R2 sur `s3-double`) |
| **`DS-flaky`** (`brand-profile.spec.ts` / `verification-creator.spec.ts` sous charge) | Surveillé en `R2A-03` et `R2B-04` (budget e2e ≤ +5 s, 3 passes consécutives) |
| Autres entrées de `21` §8 | Inchangées, à leur échéance propre (Lot 3bis / Lot 4 / Lot 6) |

## Risques et budget
- **Durée CI et E2E :** budget E2E total du lot ≤ **`+5 s`** (`R2A` ≤ `+2 s` pour le démarrage de `s3-double:4111` en mémoire, `R2B` ≤ `+3 s`, `R2C` ≤ `0 s`), très en deçà du plafond D77 de `+20 s` par jalon. Sur les 2 éclats CI `db` (éclat 2 à `6 min 24` pour un plafond dur de `7 min 30`), le remplacement des appels HTTP vers Kong/`storage-api` par `startS3Double()` in-process et l'exclusion de `storage-api` en `R2C-03` **réduisent** la durée de l'éclat 2 et économisent ~1,3 Go de tirage Docker sur 5 jobs CI.
- **Invariants critiques exposés :** étanchéité d'adresse R2 (`D80`, `D82`, `T9.2`, `T9.6`, `T9.7` : zéro URL présignée, zéro `ListObjectsV2`, zéro hôte R2), confidentialité des journaux (`D60` : code `<Code>` XML seul, jamais `<Key>`, `<Message>` ni `Authorization`), non-écrasement (`If-None-Match: "*"`), plafonds mémoire en flux (`1 Mio` / `8 Mio` même sans `Content-Length`), symétrie `staging` = `production` (`D70`, `T17` : zéro `INFLUX_ENV === "production"` dans `schema.ts`), isolation cloud des tests (`16` RG148), maintien des 3 lignes `public = false` et de `influx_no_member_access` dans `storage.buckets` (`03` P10.6, trigger `protect_buckets_delete`).
- **Marqueur `security-reviewed:` (`03` I-4, `check-security-review.ts`) :** déclenché uniquement en **`R2C`** par `R2C-02` (`supabase/config.toml` section `[storage.s3_protocol]`) et `R2C-03` (`.github/workflows/ci.yml`), couverts par l'attestation `R2C-05` après revue de `expert-cybersecurite`. Aucun fichier déclencheur `I-4` n'est touché en `R2A` ni en `R2B`.
- **Taille des skills du domaine (`wc -c .claude/skills/*/SKILL.md` ≤ 10 Ko, amendement D77) :** vérifiées — `env-secrets` (`6,1 Ko`), `railway-deploy` (`9,8 Ko`), `security-rgpd-audit` (`7,5 Ko`), `supabase-schema` (`6,3 Ko`), `test-strategy` (`5,8 Ko`). Aucun commit « dette skill » préalable n'est requis ; `R2A-01` enrichit uniquement `env-secrets/references/` afin de maintenir `SKILL.md` sous `10 Ko`.

## Questions au fondateur
1. **`R2-01` (Lot & cadencement) :** validez-vous la numérotation `23-migration-cloudflare-r2.md`, le code `R2` (`R2A`, `R2B`, `R2C`, 15 commits) et son exécution juste après la clôture de `RUB` (un seul fil, D89 Q2) ?
2. **`R2-02` (RGPD & juridictions) :** validez-vous la juridiction `eu` en `production`, `default` en `staging` (sous Verrou 4 `B9` données synthétiques seules) et l'inscription du DPA Cloudflare + mise à jour de la politique de confidentialité aux portes d'ouverture `production` (`21` §5.8, validation juriste `RU-30`) ?
3. **`R2-03` (Jetons R2 & constat `eu`) :** validez-vous la création de **2 jetons `Object Read & Write` distincts** par environnement (`influx-<env>-api` ≠ `influx-<env>-worker`, bornés aux 3 compartiments) et préférez-vous différer tout test sur `influx-production-*` (`eu`) à l'ouverture `production` (option `a`, recommandée) ?
4. **`R2-04` (Sauvegarde R2 vs PITR) :** validez-vous l'absence de réplication vers un second bucket R2 au MVP (durabilité native `11×9`, effacement RGPD immédiat, dégradation gracieuse `RG3` en cas de restauration PITR antérieure à une purge) ?
5. **`R2-05` (Hygiène S3 & orphelins) :** validez-vous la règle `AbortIncompleteMultipartUpload = 1 jour` sur les 6 compartiments R2 et l'interdiction de `ListObjectsV2` dans `apps/api/src/` ?
