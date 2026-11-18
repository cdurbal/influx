# Exécution du jalon L3D
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | fixtures: real creator view + SHA-256 in snapshots; published/paused swept to closed (102 -> 0); no expectation changed |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | doors in search.*, owner influx_campaign_feed_definer; creator holds nothing on campaigns.*; read journal a table, not the register; account rate in base |
| 02 | 02.md | commit | opus | xhigh | expert-database | fait | 3 doors search.* EXECUTE creator only, owner campaign_feed_definer; visibility in SQL; reads journaled; no right on campaigns.* |
| 03 | 03.md | commit | opus | high | dev-react-node | fait | card = .pick() of creator view + brandPublicViewOf(); door row zod-strict; refusals after COMMIT; T1.6 serves title+brief only |
| 04 | 04.md | commit | sonnet | high | dev-react-node | fait | feed page shared by role (no space); card = RG15 pick, greyed has no link; no amount; reducer ignores late pages; e2e median 2.7/1.3/1.6 s |
| 05 | 05.md | commit | sonnet | high | dev-react-node | fait | record by role at /campagnes/[id] (FR+EN pages); one body shared with the preview; RG32+RG40 notices; no apply, no contact; gone = n'est plus ouverte |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 0 bloquant, 4 jalon (L3DU-1 à 4 → X1 à X3, textes à valider), 9 avant production, 6 plus tard ; détail : ux-constats.md |
| X1 | fix-1.md | fix | sonnet | high | dev-react-node | fait | notice on the record only, not the feed; text verbatim of fix-1; no button, link or date; brand preview untouched; e2e 15 passed in 1.3 min |
| X2 | fix-2.md | fix | sonnet | high | dev-react-node | fait | media_buy label has no pronoun; RG40 notice back to the catalogue text + closing instruction; 09 l. 877 aligned; organic_repost/paid_whitelisting untouched |
| X3 | fix-3.md | fix | sonnet | high | dev-react-node | fait | shared titles Campagnes/Campaign (FR, EN); keys and PAGE_TITLES untouched; brand h1 unchanged; toHaveTitle added to 4 existing cases; e2e 15 passed in 1.1 min |
| F | recette.md | fondateur | — | — | fondateur | fait | fondateur 2026-11-18 : « je valide la recette » ; staging non préparé par l'agent, aucune donnée écrite, rien à remettre en état |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | T : 0 bloquant, 0 jalon, 5 avant prod, 6 plus tard ; S : 0 bloquant, 0 jalon, 2 avant prod, 6 plus tard ; détail : annexe § Revue |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |

## Mesures de clôture
Mesures e2e du run CI 44403125344 :
- E1 : 3 cas, 1,7 + 1,2 + 1,5 = 4,4 s (budget 8 s).
- E2 : 2 cas, 1,3 + 2,5 = 3,8 s (budget 7 s).
- creator-campaigns : total 8,2 s (budget 15 s).
- Éclats e2e : 4:12, 4:36, 3:27 (limite 7:30).
- Éclats base : 4:04, 3:59 + fusion 14 s (limite 8:00).
