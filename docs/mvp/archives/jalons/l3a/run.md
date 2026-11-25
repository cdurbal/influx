# Exécution du jalon L3A
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | medium | expert-cybersecurite | fait | attestation L2G posée ; CI verte sur da4109f (run 43394059337) lève L2GT-9 |
| 02 | 02.md | commit | sonnet | high | expert-ux | fait | SKILL.md 9,6 Ko + 3 references ; liens de section alignés sur D74, effets sur D75, vert unique #1dd68a |
| 03 | 03.md | commit | sonnet | high | product-owner | fait | SKILL.md 6,9 Ko + 3 references ; 46 règles conservées ; files alignées sur 15 RG29 et 17b §1.3 ; D39, D49, D50, D72 renvoyées |
| 04 | 04.md | commit | sonnet | high | integrateur | fait | CI 43422240661 verte : éclats 3 min 46 et 4 min 33, contrôle 21 s ; garde-fou db-merge |
| 05 | 05.md | commit | opus | high | expert-database | fait | 55000 account_not_active ; index partiels non employés sous RLS (non LEAKPROOF) ; EXECUTE normalized_brand_name aux 4 écrivains (I-4) |
| 06 | 06.md | commit | opus | high | testeur | fait | T1-R par pg_depend/pg_rewrite récursif et prosrc, tous schémas : aucun constat réel ; témoins T4 vue et fonction ; T3 sans execute ; plancher 86 |
| A | A.md | arbitrage | opus | xhigh | expert-cybersecurite | fait | export_class not null sans défaut ; 5 exclus (sécurité), 130 exportés = 135 en base ; aucune ligne servie ne change ; GRANT au privacy_definer (I-4) |
| 07 | 07.md | commit | opus | high | expert-database | fait | export_class not null sans défaut, 5/130 asserté ; activity_log filtré sur exported, reste du corps = 0245 ; GRANT (code, export_class) privacy_definer (I-4) |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | `bf5303f..7c5cd82` : 0 bloquant ; jalon L3AT-1 → fix-1, L3AT-2 → fix-2, L3AT-3 → C ; avant prod. L3AS-7 ; 12 plus tard ; annexe § Revue |
| fix-1 | fix-1.md | fix | sonnet | medium | testeur | fait | runTag à lettre médiane : 12345678 rouge L2C-16/17 avant, 87654321 vert après, sans variable vert ; check:fast vert ; fondateur : valider tout |
| fix-2 | fix-2.md | fix | sonnet | low | testeur | fait | L3AT-2 : describe l.1392 préfixé « L3A-T5: » ; 98 cas verts, plancher 98 inchangé ; check:fast vert |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | critère de fin coché avec preuves ; reliquat soldé dans 21 §8 ; attestation I-4 en commit vide ; jalon archivé ; check et e2e verts |

## Mesures de clôture
- **`pnpm check`** (2026-11-13, local) : vert au second passage ; premier passage rouge sur `apps/web` `relay-integration.artifacts.ts` T7.3 (`ECONNRESET`, EPIPE intermittent connu de `21` §8, sans lien avec le diff), vert à la relance seule puis sur `pnpm check` entier. Base : 105 fichiers, 3 046 cas, 559 s (suite entière locale).
- **`pnpm test:e2e`** : 260 cas verts en 5,2 min, plancher tenu ; aucun cas ajouté par L3A.
- **CI, dernier run mesuré** 43430194053 (`7c5cd82`) : éclats base 229 s et 249 s, contrôle 15 s (4 min 24 s) ; « Migrate staging » vert (`0301`, `0302`). Les push de `5d17f21`, `50fd37a`, `d42086a` et de la clôture restent à faire par l'orchestrateur.
- **Essai à blanc (L3AT-3, sortie de la revue)** : rapport sans `db-tests/t16-commission.test.ts`, contrôle rouge sur « shard 2: db-tests/t16-commission.test.ts is assigned to it but did not run » et « declared in the floor file, but absent from the report » ; cas complet vert : « every database test file ran in exactly one of 2 shards (105 files); floor of executed database cases met ».
