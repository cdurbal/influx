# Exécution du jalon R2A
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| F0 | F0.md | fondateur | — | — | fondateur | fait | « 1.autorisation de démarrer 2. touche pas aux textes 3.différer tout test à l'ouverture production 4.pas de réplication secondaire R2 au MVP 5.oui 6.ok pour ta recommendation » (2026-11-26) : R2-01..05 oui, 00..03 d'abord |
| 00 | 00.md | commit | pro | high | architecte | fait | D90 (F0 R2-01..05 verbatim), D80/D82, 02/03/04/18/21 amendées (zéro prod-branch, eu prod, R2-04/05), INDEX.md régénéré |
| 01 | 01.md | commit | flash | medium | integrateur | fait | env-secrets (SKILL.md ≤ 10 Ko, R2_* + rotation A/B sortante), prerequis (6 buckets, Abort 1 j), staging.md hors bloc borné, production.md (eu, RU-30, J9S-1) |
| 02 | 02.md | commit | flash | high | dev-react-node | fait | startS3Double() 127.0.0.1 + SigV4/SHA-256 stricts + If-None-Match 412 + /_double/*, dev:s3-double :4011, R2_ dans BROWSER_FORBIDDEN_NAMES (T1=12, T2=14) |
| 03 | 03.md | commit | flash | high | testeur | fait | S3_DOUBLE_PORT=4111 + S3_DOUBLE_ORIGIN, webServer s3-double (/_double/state) + R2_* loopback (e2e-) vers start-api.ts; 14/14 E2E + assertNoNewErrors verts |
| 04 | 04.md | commit | pro | high | dev-react-node | à faire | schema.ts + .env.example + bloc staging.md + staging:check ; R2_* requises sur Railway avant push |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | Plage <parent 00>..HEAD ; testeur (flash·high) + expert-cybersecurite (pro·high) ; zéro I-4 attendu |
| C | cloture.md | cloture | flash | medium | testeur | à faire | Critères annexe, pnpm check + e2e, 21 §8, archivage r2a/ (lot3ter-plan reste) |
