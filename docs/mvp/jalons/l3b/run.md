# Exécution du jalon L3B
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | opus | high | expert-cybersecurite | fait | 04 : export_class aux codes des Lots 3-5 (tiers : block.*, report.* ; sécurité : detection.reviewed, alert.*) ; L3A-T5 nominatif, >= 130, témoin tiers |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | Q16 : tranche en colonne, FK (devise, code), sans campaign_price_bands ; gel hors draft/rejected ; porte influx_campaign_definer ; projection SQL |
| B | B.md | arbitrage | opus | xhigh | expert-paiement-facturation | fait | EUR GBP USD CAD CHF × 10 tranches mêmes seuils (0 à 50 000+, min incluse, max exclue) ; nets nuls ; budget et dotation ; libellés traduits {currency} |
| F1 | F1.md | fondateur | — | — | fondateur | fait | Fondateur, 2026-11-13 : « Grille validée » (telle quelle ; ligne 03 la recopie) |
| 02 | 02.md | commit | opus | high | expert-database | fait | 0303 : 12 tables campaigns.*, RLS forcée, marque seule (jamais état, cycle, déclaration, fourchette) ; gel 55000 ; créateur rien ; 9 codes avec export_class |
| 03 | 03.md | commit | opus | high | expert-database | fait | 0304 : grille de tranches.md mot pour mot (5 × 10), min incluse, max exclue, seule la dernière ouverte, nets nuls ; contiguïté + témoin ; T2 autorisé |
| 04 | 04.md | commit | sonnet | high | dev-react-node | fait | 27 codes camelCase de modele §5 par étape ; dates RG70 six paires, RG74 ; détection contact/lien/montant en positions seules ; 69 cas T5 |
| 05 | 05.md | commit | opus | high | expert-database | fait | 0305 : porte influx_campaign_definer (pending_review seul), 27 manquants en parité, RG85 empreinte/langue/auteur, vue créateur 32 clés sans devise ni tranche |
| 06 | 06.md | commit | opus | high | expert-database | fait | 0306 : campagnes sous advertiser_profile ; effacement : closed, erased_at, textes/réf./budget vidés, puces supprimées, ligne vidée seule ; aucun registre |
| 07 | 07.md | commit | sonnet | high | dev-react-node | fait | 5 routes /v1/me/campaigns ; refus base en codes de champ camelCase ; autre marque ou créateur = 404 identique ; gel 409 ; locale RG85 seulement si cochée |
| 08 | 08.md | commit | opus | high | dev-react-node | fait | creator-view : 32 clés de 0305 telles quelles (zod strict), profil marque publié vivant (fonction, badge, logo drapeau) ; ni devise, tranche, budget, réf. |
| 09 | 09.md | commit | sonnet | high | dev-react-node | fait | campagnes marque : liste, étapes 1-3, autosave des seuls champs modifiés, dépendants vidés, domain par campaign-domain.ts ; e2e 14,0 s (médiane de 3) > 9 s |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | étapes 4-5 : tranche interne, nature, dates nommées, soumission (manquants par étape, case RG85) ; pas de budget total saisi (EC-10-1) ; e2e 10,4 s > 9 s |
| 11 | 11.md | commit | sonnet | high | dev-react-node | fait | aperçu : réponse de 08 seule ; ni tranche, budget, réf. (texte+DOM) ; aucun lien ; logo via route profil ; e2e 2,3 s, total 09-11 24,1 s <= 25 |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 20 constats : 0 bloquant, 4 jalon (fix-1 à fix-3 ; L3BU-15 pris par fix-1), 12 avant production, 4 plus tard |
| fix-1 | fix-1.md | fix | sonnet | high | dev-react-node | fait | L3BU-1, 15 : lien ?from=4 ou ?from=list, retour à l’étape ou à la liste, nom sans doublon ; floor 11 à 14 ; e2e 24,4 s <= 25 |
| fix-2 | fix-2.md | fix | sonnet | medium | dev-react-node | fait | L3BU-2 : étape 4 « par créateur, commission INFLUX incluse » FR et EN (validation du fondateur) ; aucun chiffre ni taux ; planchers inchangés
| fix-3 | fix-3.md | fix | sonnet | high | dev-react-node | fait | L3BU-3, 4 : barre sous lg, soumission écrite une fois ; invalid = premier refus de l'écran, un lien chacun ; plancher 57 à 59 ; e2e 24,8 s <= 25 |
| F2 | recette.md | fondateur | — | — | fondateur | fait | Fondateur, 2026-11-14 : « J ai fait la recette. Je valide » ; staging lecture seule : 1 pending_review, campaign.submitted rang 2373, rien dans ops |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | Revue : 0 bloquant ; jalon : L3BT-1, L3BT-2 (fix-4) ; avant prod : L3BT-3, L3BT-4, L3BS-1 ; plus tard : 8 |
| fix-4 | fix-4.md | fix | sonnet | high | dev-react-node | à valider | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
