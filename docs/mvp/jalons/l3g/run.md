# Exécution du jalon L3G
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | opus | high | expert-database | fait | 0327 : moteur lancé alias connu ou non, masqué non retiré, verrou par compte attendu 1 s (55P03), moteur avant le verrou |
| 02 | 02.md | commit | sonnet | high | testeur | fait | 5 courses à 2 connexions committées, verrou tenu jusqu'à 2 attentes vues : une servie, une refusée, lignes exactes ; plancher 5 |
| 03 | 03.md | commit | sonnet | medium | dev-react-node | fait | 30 écritures/min par adresse sur 6 routes, 429 avant session ; 55P03 devient 429 rate_limited Retry-After 1 ; plancher 22 |
| D38 | annexe.md | fondateur | — | — | fondateur | fait | « oui aux 4 questions » (2026-11-20) : Q2 de l'annexe, ouverture globale, seuils 30 et 5 en table, alerte seule, admin + pair, interrupteur fermé |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | modele.md : propriétaire agent neuf, E5 affichée, E6 gardée ; prefill_diff ; file 9 à 6 motifs de la liste A ; AL65 neuf ; réglages en 2V, pair seul |
| 04 | 04.md | commit | opus | xhigh | expert-database | fait | 0328 : porte agent, admin seuls ; moteur 2e requête sous son propriétaire, ni G ni couche I au propriétaire marque ; nombre exact, journal nominatif |
| 05 | 05.md | commit | opus | high | expert-database | fait | 0329 : F1, F3, F4, F6 pays, F8, F11 du brief admis, codes seuls ; proposé journalisé, prefill_id appelant < 24 h ; prefill_diff ; ni tranche ni budget |
| 06 | 06.md | commit | opus | high | expert-database | fait | 0330 : prise atomique 30 min, relâche, prolongation, clôture 6 motifs (note ssi other), 55P03 sans prise ; RG36 42501 ; AL23 ; ni outbox ni matching |
| 07 | 07.md | commit | opus | high | expert-database | fait | 0331 : jour UTC remplacé (publiés E1,E3,E4 ; cherchables +E2), ni search_settings ni couche I ; AL65 sur cherchables, AL22 > 20 % de 20 sur 7 j ; veille gardée |
| 08 | 08.md | commit | opus | high | expert-database | fait | 0332 : 2 écrivains consomment une 2V search.* confirmée par un autre admin avec R ; sans pair, ni demande ni mode dégradé (42501) ; kits inchangés |
| 08b | 08b.md | commit | opus | high | expert-database | fait | 0333 : read_search_settings() (key, value) des dix clés, admin aal2 seul (42501 sinon) ; aucun droit de table ni de colonne, rien écrit |
| 09 | 09.md | commit | sonnet | high | dev-react-node | fait | 2 routes /v1/bo, agents et admin seuls ; campagne ou prefill inconnus 404 (EC-1) ; page_cap 400 après COMMIT ; réglage absent 503 ; planchers 15 et 7 |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | file 9 : 6 routes, 42501 → 404, 55P03 → 409 claim ; AL22/23/65 ; 2V search.* pair seul (409 no_peer_admin) ; GET réglages admin ; planchers 13 et 9 |
| 11 | 11.md | commit | sonnet | high | testeur | fait | tm12-identified-view : 13 portes, 9 routes 404 membre/401, aucun export, T14 ; T1 +4 (inventaire, membres, sans session, contre-test) ; planchers 4 et 36 |
| 12 | 12.md | commit | sonnet | high | dev-react-node | à faire | |
| 13 | 13.md | commit | sonnet | high | dev-react-node | à faire | |
| U | ux.md | ux | sonnet | high | expert-ux | à faire | |
| F | recette.md | fondateur | — | — | fondateur | à faire | 30 s sur trois campagnes de `staging` ; Q4 : oui, semis si moins de trois |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | dernier jalon du lot |
