# Exécution du jalon L3C
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | dates des tests dérivées du jour UTC (+10/25/32/60 j), aucun attendu changé ; e2e 24,9/24,5/24,8 s, médiane 24,8 <= 25 |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | rôle neuf influx_campaign_review_definer ; avis en texte ; interventions en table ; reprise d'une paused ≠ publication (RG3, RG8) |
| 02 | 02.md | commit | opus | high | expert-database | fait | 0307 : rôle influx_campaign_review_definer, file 7 (1 j ; 2 j renforcée), RG15 sous verrou consultatif, RG95 alerte, garde en liste fermée (L3BS-2) |
| 03 | 03.md | commit | opus | high | expert-database | fait | 0308 : instantané = vue créateur (CHECK sans clé interne), deux personnes en sensible, verrou vivant et jeton exigés ; e-mail et lead dans la transaction |
| 04 | 04.md | commit | opus | high | expert-database | fait | 0309 : cycle posé par déclencheur (origine = rôle écrivain), reprise ≠ publication, clôture irréversible ; interventions immuables, ancienne et nouvelle valeur |
| 05 | 05.md | commit | opus | high | expert-database | fait | I-4. 0310 : export sans agent, avis ni commentaire ; journal L3BS-5 acteur INFLUX ; effacement vide les textes ; leads : codes seuls, Apollo date |
| X1 | fix-1.md | fix | opus | high | expert-database | fait | I-4. 0311 : campaign.decision journalisé sous son code de catalogue (email_code, template_ref) ; charge sans code : 22023 ; signature et droits inchangés |
| 06 | 06.md | commit | sonnet | high | expert-integrations-api | fait | CA70 sans tranche ni texte ; sans consentement skipped ; clôture auto quotidienne. EC-1 date Apollo en étiquette, EC-2 compteur 0, EC-3 minor_audience à relire PO |
| X2 | fix-2.md | fix | opus | high | expert-database | fait | I-4. 0312 : 3e clause jamais NULL ; open lue avant l'avis, masquée à son seul auteur ; ni GRANT ni fonction. Base : 1 échec, de 07 (T7.3, brief requis) |
| 07 | 07.md | commit | sonnet | high | dev-react-node | fait | /v1/bo/campaigns : avis servi au seul titulaire du verrou ; budget par clé de libellé seule ; compte détenu 403 journalisé, inconnu ou propre 404 |
| 08 | 08.md | commit | sonnet | high | dev-react-node | fait | écran file 7 + fiche : phase single/first/second, responsable exigé, avis 20-1000 ; budget par libellé seul ; marque suspendue lue au refus 409 ; e2e 7,6 s |
| 09 | 09.md | commit | sonnet | high | dev-react-node | fait | fiche, correction d’un champ hors montants, pause/reprise/clôture motivées, brouillon pour marque ; e2e 4,8 s ; EC-1 : pas de liste des campagnes par marque |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | routes pause/reprise/clôture (404 identique, 409 règle nommée) ; motif de refus servi (followUp) ; pause d'INFLUX non reprenable ; e2e 5,0 s |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 0 bloquant, 0 jalon, 12 avant production, 8 plus tard (ux-constats.md) ; L3CU-1 : fiche campagne sans porte d'entrée (EC-L3C-09-1) |
| X3 | fix-3.md | fix | sonnet | high | dev-react-node | fait | anneau + point plein text-secondary ; valeurs 8,7:1 ; e2e médiane 6,5 s (avant 7,6) ; captures apps/web/test-results/x3/ ; EC-1 case en rond, EC-2 sans opacity |
| X4 | fix-4.md | fix | opus | high | expert-database | fait | I-4. 0313 : sensible publié seul (déclaration exigée), avis facultatif lu de tous, repris par son auteur ; review_mode au registre ; recherche à 0314 |
| X5 | fix-5.md | fix | sonnet | high | dev-react-node | fait | D84 : Publier seul même en secteur sensible, second avis facultatif, next exclut l'entrée rendue ; e2e médiane 7,3 s |
| F | recette.md | fondateur | — | — | fondateur | fait | « je valide la recette » (fondateur, 2026-11-17) ; constat 1 (2026-11-16) : radios grisés illisibles → X3 ; constat 2 : D84, pas de double validation obligatoire → X4, X5 |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | revue : 0 bloquant ; 3 jalon (L3CT-1 à 3, L3CT-3 en C) ; sécurité : autorisé sous conditions, L3CS-1 à 3 avant production |
| X6 | fix-6.md | fix | opus | high | dev-react-node | à valider | L3CT-1 : fuite des specs e2e L3C, t14 et file 7 |
| X7 | fix-7.md | fix | sonnet | high | dev-react-node | à valider | L3CT-2 : identifiants L3C-T6 et L3C-T7 dans les titres |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | reprend L3CT-3, L3CS-2 et l'attestation I-4 (à montrer au fondateur avant commit) |
