# E07 — Formulaire de campagne, étapes 4 et 5 (marque)
> Maquette : `proto-campagne.html` (états etape-4, etape-5) · page de comparaison `ecran-7-campagne.html` · validée le 2026-11-24 (07, « Écran 7 ») · Constats : U27, U30, U52
> Assistant, en-tête, pied, statut, aperçu, étapes 1 à 3 : `E07a-campagne-etapes.md`. Vérifier et envoyer : `E07b-campagne-envoi.md`.
## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E07.4 | Étape 4, Le budget | idem `?step=4` | idem | `CampaignBudgetFields` | etape-4 | L | C24, D78 |
| E07.5 | Étape 5, Calendrier et candidature | idem `?step=5` | idem | `CampaignCalendarFields` | etape-5 | L | C47 |

À préserver : devise unique de la campagne (produit et budget, `CampaignOfferFields.tsx:175-188`, `CampaignBudgetFields.tsx:105-118`) ; tranches de la grille de la devise, désactivées sans devise (`:128-130`) ; produit seul : aucune tranche (`:119`, RG63) ; ordre des dates et 12 mois contrôlés avec les règles du domaine (`campaign-domain.ts`, RG70, RG74) ; dates civiles sans heure (RG73) ; nombre de créateurs 1 à 50, plafond 1 à 200. API : `GET`, `PATCH /v1/me/campaigns/:id`.

## 2. Structure
- Cadre, tête, pied : E07a §2. Étape 4 : en-tête (sans badge) → `stack g4` (badge public, question, `.cond`) → `zone-int` → pied ; écarts de 24 (`spacing-5`), 16 dans le `stack`. Étape 5 : en-tête avec badge → `.order` → grille des dates → message → `details.opt` → pied.
- 1440 : `.cond` x 337, filet 2 px, contenu x 355, 3 colonnes de 212 ; `zone-int` 702 × 307, contenu 668, 3 colonnes de 206,7 ; dates : 2 colonnes de 339, contrôle 192 × 48 ; champs de date `gap: spacing-1`.
- 1280 : identiques. 768 : 3 colonnes gardées (644,4 et 628,4 de large). 375 : une colonne ; `.cond` 343 × 290 ; `zone-int` 343 × 648 ; dates sur 482 px de haut.
- Hauteur de l'étape à 1440 : 637 (étape 4), 518,6 (étape 5 avec message). Pied de l'étape 4 : le statut passe sur 2 lignes (188 × 43,4).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E07.4-S01 | Produit | C14 | Badge « Public : visible des créateurs » sous l'en-tête | toujours | `.stack > .layer` | E07.4-CA01 | E07.4-T01 |
| E07.4-S02 | Produit | C21 | « Un produit est-il envoyé au créateur ? » Oui, Non | toujours | `#sent` | E07.4-CA02 | E07.4-T01 |
| E07.4-S03 | Produit | C18 | Valeur du produit : tranche (E07-Q1) | produit envoyé | `#f-pv` | E07.4-CA03 | E07.4-T01 |
| E07.4-S04 | Produit | C18 | Le créateur le conserve ? : liste | produit envoyé | `#f-keep` | E07.4-CA02 | E07.4-T01 |
| E07.4-S05 | Produit | C18 | Frais d'envoi à la charge : liste | produit envoyé | `#f-ship` | E07.4-CA02 | E07.4-T01 |
| E07.4-S06 | Interne | C24 | Encadré, tête œil barré 14 px 700 | toujours | `.zone-int` | E07.4-CA04 | E07.4-T01 |
| E07.4-S07 | Interne | C21 | Nature de la rémunération : radios | toujours (E07-Q2) | `#rem` | E07.4-CA05 | E07.4-T01 |
| E07.4-S08 | Interne | C18 | Devise : liste | toujours | `#f-cur` | E07.4-CA04 | E07.4-T01 |
| E07.4-S09 | Interne | C18 | Budget par créateur : tranche de la devise | masqué si produit seul | `#band-f` | E07.4-CA05 | E07.4-T01 |
| E07.4-S10 | Interne | C18 | Créateurs recherchés : nombre 128 | toujours (E07-Q2) | `#f-nb` | E07.4-CA04 | E07.4-T01 |
| E07.4-S11 | Interne | C24 | Phrase « Commission incluse… » 14 px secondaire | toujours | `.zone-int > p.sm` | E07.4-CA04 | E07.4-T01 |
| E07.5-S01 | Dates | C51 | Ordre : trois mots 12 px tertiaires séparés par des flèches | toujours | `.order` | E07.5-CA01 | E07.5-T02 |
| E07.5-S02 | Dates | C47 | Date limite de candidature, « jj/mm/aaaa », 192 | toujours | `#d1` | E07.5-CA02 | E07.5-T01 |
| E07.5-S03 | Dates | C47 | Livraison des contenus (facultatif) | toujours | `#d2` | E07.5-CA02 | E07.5-T01 |
| E07.5-S04 | Dates | C47 | Début de la publication | toujours | `#d3` | E07.5-CA02 | E07.5-T01 |
| E07.5-S05 | Dates | C47 | Fin de la publication | toujours | `#d4` | E07.5-CA02 | E07.5-T01 |
| E07.5-S06 | Dates | C19 | Message unique, triangle, ambre ; champ fautif bordé de rouge (`aria-invalid`) | format ou ordre fautif, au départ du champ | etape-5 `#d-msg` | E07.5-CA03 | E07.5-T01 |
| E07.5-S07 | Facultatif | C26, C18 | « Facultatif, à compléter plus tard (2) » : éléments attendus (E07-Q4) | replié | `#f-req` | E07.5-CA04 | E07.5-T02 |
| E07.5-S08 | Facultatif | C18 | Plafond de candidatures, aide, nombre 128 | replié | `#f-max` | E07.5-CA04 | E07.5-T02 |

## 4. Textes
| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| E07.4 produit | Un produit est-il envoyé au créateur ? · Oui · Non · Valeur du produit · Le créateur le conserve ? · Frais d'envoi à la charge | `fields.productIsSent.label`, `field.yes`, `field.no` = ; le reste à écrire | nouvelle pour le reste |
| E07.4 interne | Visible uniquement par vous et l'équipe INFLUX, jamais par un créateur · Nature de la rémunération · Devise · Budget par créateur · Créateurs recherchés · Commission incluse, précisée par votre commercial. Les montants se négocient avec lui. | `fields.remunerationKind.label` = ; le reste à écrire | nouvelle pour le reste |
| E07.5-S01 | Candidatures · livraison des contenus · période de publication | à écrire | nouvelle |
| E07.5-S02 à S05 | Date limite de candidature · Livraison des contenus (facultatif) · Début de la publication · Fin de la publication · jj/mm/aaaa | `fields.applicationsCloseOn.label` = ; le reste à écrire | nouvelle |
| E07.5-S06 | À vérifier : écrivez la date sous la forme jj/mm/aaaa, par exemple 15/01/2027. · À vérifier : la publication commence avant la date limite de candidature. · À vérifier : la publication commence avant la livraison des contenus. · À vérifier : la fin de la publication précède son début. | à écrire | nouvelle (existante : `errors.datesOrder`) |
| E07.5-S07, S08 | Éléments que vous aimeriez trouver dans une candidature ; Une idée de contenu, des exemples de collaborations… ; Plafond de candidatures ; Au-delà, la campagne n'accepte plus de candidature. | labels = ; aides à écrire | `fields.requestedItems.label`, `fields.maxApplications.label` |

Titres et phrases d'étape : E07a §4 (S16). Options : E07a §4 et E07-Q3. Valeurs : {tranche} de `price_band.*`, {devise} de `Intl.DisplayNames`.

## 5. Interactions, états, responsive, clavier
- Produit envoyé : Oui affiche `.cond` (`rise-in` 200 ms), Non le masque et n'envoie aucune des trois précisions. Nature « Produit seul » : la tranche disparaît. Devise changée : tranches remplacées, valeur hors grille effacée (règle actuelle).
- Dates : contrôle au départ du champ (`blur`), message et annonce C29 ; tant qu'un message est affiché, contrôle à chaque frappe, sans annonce. Un seul message à la fois : format, puis ordre (candidature, livraison, début, fin). `aria-invalid` sur le champ fautif, effacé dès que tout est bon.
- États. Budget sans devise : non montré : comportement préservé (`CampaignBudgetFields.tsx:136-139`, `budget.chooseCurrency`) ; représentation proposée : liste désactivée et aide C18. Dotation seule : `budget.giftOnly` non montré : C17 information à la place de la tranche, texte à corriger (il cite l'étape 1). `giftRequiresProduct`, `notApplicable`, `windowTooLong`, `dateOrder` : non montrés : C19 sous le champ. Chargement, hors ligne, refus : E07a §5.
- Clavier : groupes de radios natifs ; `inputmode=numeric` sur dates et nombres ; ordre du DOM. Animations : E07a §5.

## 6. Critères d'acceptation
- **E07.4-CA01** La valeur du produit ne figure jamais sous un badge « Public » (D78).
- **E07.4-CA02** Produit envoyé = non masque ses trois précisions et n'en envoie aucune.
- **E07.4-CA03** La valeur est une tranche de la grille de la devise, choisie après la devise.
- **E07.4-CA04** Aucun pourcentage, montant libre, net ni taux ; tranche de budget dans l'encadré interne seulement.
- **E07.4-CA05** Produit seul masque la tranche ; quatre natures proposées, affiliation comprise.
- **E07.5-CA01** Quatre champs texte au format de la langue, sans sélecteur du système.
- **E07.5-CA02** La valeur envoyée est une date civile ISO ; l'affichage suit la langue (FR jj/mm/aaaa).
- **E07.5-CA03** Un ordre fautif est dit en nommant les deux dates et relié au champ fautif ; il n'est jamais enregistré (RG70).
- **E07.5-CA04** Éléments attendus : liste fermée de quatre (RG77) ; plafond 1 à 200.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E07.4-T01 | e2e | idem (« a gift only asks no band ») | conditionnels, encadré interne, aucun chiffre public |
| E07.5-T01 | unitaire | `apps/web/tests/campaign-view.test.ts` | lecture jj/mm/aaaa et format EN, ordre, 12 mois |
| E07.5-T02 | e2e | `apps/web/e2e/brand-campaign.spec.ts` | message d'ordre, focus, éléments attendus |

Attendus à conserver : `data-internal-box` (encadré), noms `copy.fields.currency`, `.budgetBand`, `.creatorsWanted`, dates `copy.fields.*On`. Disparaît : `data-creator-box` (brand-campaign L3B-E2, à réécrire). Visuel et axe : E07.1-T01, E07.1-T02.

## 8. Écart avec l'existant
Voir E07a §8 (produit envoyé, dates, bloc créateur, RG80). Données requises : `references.currencies[].bands`, `references.requestedItems`, dates et tranches : servies (`packages/contracts/src/campaign.ts:407-459`). Aucun écart d'API. Le domaine doit déplacer quatre champs de l'étape 1 à l'étape 4 (`packages/domain/src/campaign/required.ts`) ; le miroir SQL de 0305 ne porte pas l'étape (à confirmer). `totalBudgetMinor` reste non saisi (EC-L3B-10-1). Hors lot : aucun élément.

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E07-Q1 | Valeur du produit sous « Public : visible des créateurs » (etape-4) ; D78, `09` RG30-31, `CampaignOfferFields.tsx:189-203` : interne ; elle demande la devise, saisie plus bas | Violation de D78 si copiée | Devise et valeur dans l'encadré interne ; badge « Public » pour le reste | fondateur | oui |
| E07-Q2 | Nature et nombre de créateurs sous « jamais par un créateur » ; `09` RG55, RG66, RG98 les publient | Texte faux pour la marque | Les sortir de l'encadré (bloc public de l'étape 4) | fondateur | oui |
| E07-Q4 | Éléments attendus en texte libre ; RG77 : liste fermée sans texte libre, PATCH `requestedItems` | Champ impossible à enregistrer | C21 à quatre cases dans le repli | product-owner | non |
| E07-Q9 | RG80 (« candidater n'ouvre aucune conversation ») et « Ce que voit un créateur » (`17` §4.3 : « jamais replié ») retirés | Mentions perdues | Suivre la maquette ; amender `17` ; RG80 reste sur la fiche créateur | product-owner | non |
| E07-Q11 | Ordre des dates : avertissement ambre ; RG70 refuse, contrainte `campaigns_dates_ordered` ; 12 mois (RG74) et passé (RG71) non montrés ; message non lié au champ ; format EN non défini | Enregistrement refusé | Message d'erreur C19 lié, `errors.datesOrder` ; EN : dd/mm/yyyy à confirmer | product-owner, expert-ux | non |
| E07-Q13 | Étape 5 à 375 : « Vérifier ma campagne » 156 → 395,9 px, rogné de 21 px | Bouton coupé | « Précédent » réduit à son chevron nommé sous 480 px | expert-ux | oui |
