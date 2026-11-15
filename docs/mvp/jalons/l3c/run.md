# Exécution du jalon L3C
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | dates des tests dérivées du jour UTC (+10/25/32/60 j), aucun attendu changé ; e2e 24,9/24,5/24,8 s, médiane 24,8 <= 25 |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | rôle neuf influx_campaign_review_definer ; avis en texte ; interventions en table ; reprise d'une paused ≠ publication (RG3, RG8) |
| 02 | 02.md | commit | opus | high | expert-database | fait | 0307 : rôle influx_campaign_review_definer, file 7 (1 j ; 2 j renforcée), RG15 sous verrou consultatif, RG95 alerte, garde en liste fermée (L3BS-2) |
| 03 | 03.md | commit | opus | high | expert-database | fait | 0308 : instantané = vue créateur (CHECK sans clé interne), deux personnes en sensible, verrou vivant et jeton exigés ; e-mail et lead dans la transaction |
| 04 | 04.md | commit | opus | high | expert-database | fait | 0309 : cycle posé par déclencheur (origine = rôle écrivain), reprise ≠ publication, clôture irréversible ; interventions immuables, ancienne et nouvelle valeur |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. 0310 : export sans agent, avis ni commentaire ; journal L3BS-5 acteur INFLUX ; effacement vide les textes ; leads : codes seuls, Apollo date |
| X1 | fix-1.md | fix | opus | high | expert-database | à valider | arbitrage A2 : journal sous le code du catalogue |
| 06 | 06.md | commit | sonnet | high | expert-integrations-api | à faire | |
| 07 | 07.md | commit | sonnet | high | dev-react-node | à faire | |
| 08 | 08.md | commit | sonnet | high | dev-react-node | à faire | |
| 09 | 09.md | commit | sonnet | high | dev-react-node | à faire | |
| 10 | 10.md | commit | sonnet | high | dev-react-node | à faire | |
| U | ux.md | ux | sonnet | high | expert-ux | à faire | |
| F | recette.md | fondateur | — | — | fondateur | à faire | |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
