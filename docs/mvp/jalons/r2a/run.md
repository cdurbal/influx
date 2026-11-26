# Exécution du jalon R2A
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| F0 | F0.md | fondateur | — | — | fondateur | fait | « 1.autorisation de démarrer 2. touche pas aux textes 3.différer tout test à l'ouverture production 4.pas de réplication secondaire R2 au MVP 5.oui 6.ok pour ta recommendation » (2026-11-26) : R2-01..05 oui, 00..03 d'abord |
| 00 | 00.md | commit | pro | high | architecte | fait | D90 (F0 R2-01..05 verbatim), D80/D82, 02/03/04/18/21 amendées (zéro prod-branch, eu prod, R2-04/05), INDEX.md régénéré |
| 01 | 01.md | commit | flash | medium | integrateur | fait | env-secrets (SKILL.md ≤ 10 Ko, R2_* + rotation A/B sortante), prerequis (6 buckets, Abort 1 j), staging.md hors bloc borné, production.md (eu, RU-30, J9S-1) |
| 02 | 02.md | commit | flash | high | dev-react-node | à faire | s3-double SigV4 + If-None-Match 412, dev:s3-double :4011, R2_ dans BROWSER_FORBIDDEN_NAMES |
| 03 | 03.md | commit | flash | high | testeur | à faire | Playwright webServer s3-double :4111 + R2_* loopback vers start-api.ts, budget e2e ≤ +2 s |
| 04 | 04.md | commit | pro | high | dev-react-node | à faire | schema.ts + .env.example + bloc staging.md + staging:check ; R2_* requises sur Railway avant push |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | Plage <parent 00>..HEAD ; testeur (flash·high) + expert-cybersecurite (pro·high) ; zéro I-4 attendu |
| C | cloture.md | cloture | flash | medium | testeur | à faire | Critères annexe, pnpm check + e2e, 21 §8, archivage r2a/ (lot3ter-plan reste) |
