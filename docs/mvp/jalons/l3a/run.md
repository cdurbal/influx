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
| fix-2 | fix-2.md | fix | sonnet | low | testeur | à faire | L3AT-2 : « L3A-T5: » en tête du describe de `t8-privacy-execution.test.ts:1392` ; planchers inchangés ; validé par le fondateur (valider tout) |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | après fix-1 et fix-2 ; L3AT-3 fusionné (point 2) ; attestation I-4 (point 5) |
