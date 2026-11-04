# Exécution du jalon L2C

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | arbitrage | opus | xhigh | architecte | fait | `l2c/file.md` (noms définitifs), D81 ; RG6 tenu : seules les fonctions de `influx_moderation_definer` publient ; escalade 960 |
| 02 | 02.md | commit | sonnet | high | dev-react-node | fait | PLK-1 : 5 fichiers de routes + `action-guards.ts` (≤ 303 l.), `actions-routes.ts` reste le point d’enregistrement et ré-exporte les gardes ; comportement constant, aucun test modifié |
| 03 | 03.md | commit | sonnet | medium | dev-react-node | fait | PLS-7 : `UnverifiedNote` sur pile, page de l’occurrence et du groupe (navigateur seul, route non nulle), jamais cliquable ; J9S-7 soldé (L2A) ; plancher 5 à 8 |
| 04 | 04.md | commit | opus | high | expert-database | fait | I-4. `0206` : file 1 (480, 240, escalade 960), `operational_settings` (`claim_expiry_minutes` = 30, lecture `aal2`, aucune écriture), `business_deadline()` déterministe, sans jours fériés, EXECUTE à personne (05 l'accorde à son appelant) ; plancher tm3 17 à 37 |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. `0207` : `moderated_fields` (6), motifs (8), `advertiser_review_entries` (une `open` par compte, échéances figées par déclencheur), `profile_field_revisions`, jeton `advertiser_review_token()` jamais stocké ; la soumission ouvre l'entrée ; `business_deadline()` à `influx_identity_definer` seul ; export et effacement étendus (E-5) |
| 06 | 06.md | commit | opus | high | expert-database | à faire | I-4 |
| 07 | 07.md | commit | opus | high | expert-database | à faire | I-4 |
| 08 | — | commit | — | — | — | ignoré | RG71 reporté au Lot 5 (réponse 1 du fondateur, 2026-11-03) ; CA22 en `21` §8 à la clôture |
| 09 | 09.md | commit | sonnet | high | expert-integrations-api | à faire | |
| 10 | 10.md | commit | sonnet | high | expert-integrations-api | à faire | |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | |
| 12 | 12.md | commit | sonnet | high | dev-react-node | à faire | |
| 13 | 13.md | commit | sonnet | high | dev-react-node | à faire | |
| 14 | 14.md | arbitrage | opus | xhigh | architecte | à faire | Sur recommandation `testeur` ; éclats autorisés, borne de 8 min inchangée (réponse 2) |
| 15 | 15.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 4 s |
| 16 | 16.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 6 s |
| 17 | 17.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 8 s |
| 18 | 18.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 2 s |
| 19 | recette.md | fondateur | — | — | fondateur | à faire | |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
