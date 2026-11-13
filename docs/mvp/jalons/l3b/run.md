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
| 07 | 07.md | commit | sonnet | high | dev-react-node | à faire | |
| 08 | 08.md | commit | opus | high | dev-react-node | à faire | |
| 09 | 09.md | commit | sonnet | high | dev-react-node | à faire | |
| 10 | 10.md | commit | sonnet | high | dev-react-node | à faire | |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | |
| U | ux.md | ux | sonnet | high | expert-ux | à faire | |
| F2 | recette.md | fondateur | — | — | fondateur | à faire | |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
