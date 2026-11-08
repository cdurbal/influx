# L2E-04 — Sources de registre pour l'immatriculation des marques

Relevé du 2026-11-07 (`expert-integrations-api`), pour `06` RG52 et D79 (12) ; amorçage de la table des sources (ligne 05, écran admin ligne 23). Pages lues en texte seul : une application à script (Sunbiz, bizfile CA, IROS) ne rend rien et ne prouve rien.

**Statuts.** `admise` : page ouverte et gratuité dite par une page officielle. `à confirmer` : page ouverte, gratuité attestée seulement par des guides tiers ou par la page sans mention de prix ; **inactive à l'amorçage**, activée par un administrateur après contrôle à la main de la gratuité (RG101). `exclue` : payante à l'acte, ou n'établit pas l'immatriculation. Le champ « type » est `e-justice`, `national` ou `gleif`.

## Sources retenues

| Pays ISO | Source | URL | Type | Gratuit | Statut |
|---|---|---|---|---|---|
| AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE (27), plus IS, LI, NO | Portail e-Justice, « Find a company » (BRIS) | https://e-justice.europa.eu/489/EN/business_registers__search_for_a_company_in_the_eu | e-justice | oui : « without any fees for companies », seuls les documents gratuits des registres sont servis | admise |
| tout pays | GLEIF, recherche LEI | https://search.gleif.org/ ; conditions : https://www.gleif.org/en/lei-data/access-and-use-lei-data | gleif | oui : « free of charge and without the need to register » | admise (repli) |
| AU | ABN Lookup (Australian Business Register) | https://abr.business.gov.au/ | national | oui : « free access », « No login is needed » | admise |
| GB | Companies House, Find and update company information | https://find-and-update.company-information.service.gov.uk/ | national | page ouverte sans prix ; gov.uk dit « some details for free » ; guides tiers : données publiques gratuites en numérique | à confirmer |
| CH | Zefix | https://www.zefix.admin.ch/en/search/entity/welcome | national | page sans texte ; guides : gratuit sans compte | à confirmer |
| NO | Enhetsregisteret (Brønnøysund) | https://www.brreg.no/en/about-us-2/our-registers/about-the-central-coordinating-register-for-legal-entities-ccr/ | national | « All information in the CCR is public domain » ; gratuité de la recherche non écrite | à confirmer (NO déjà couvert par e-Justice) |
| CA | Corporations Canada (fédéral) | https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?locale=en_CA | national | page sans prix ; guides : gratuit | à confirmer ; fédéral seul, provinces non relevées |
| NZ | Companies Office, registre des sociétés | https://companies-register.companiesoffice.govt.nz/ | national | page sans prix pour la recherche ; guides : gratuit | à confirmer |
| JP | Corporate Number Publication Site (administration fiscale) | https://www.houjin-bangou.nta.go.jp/en/ | national | page sans prix ; guides : gratuit | à confirmer ; numéro, nom, siège seulement |
| SG | ACRA Bizfile, recherche gratuite | https://www.acra.gov.sg/how-to-guides/buying-information/overview | national | oui : recherche sans connexion (statut, adresse) ; Business Profile 5,50 S$ exclu | admise, recherche gratuite seule |
| BR | Receita Federal, comprovante CNPJ | https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp | national | page réduite à son titre ; guides : gratuit sans connexion | à confirmer |
| IN | MCA, master data des sociétés | https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html | national | **page non ouverte (403)** ; guides : gratuit, connexion contestée | à confirmer, non relevée |

## États-Unis : conduite retenue

Aucun registre fédéral des sociétés privées. **GLEIF d'abord**, puis une **liste d'États tenue par l'administrateur**, vide à l'amorçage : aucune page d'État n'a pu être lue (Sunbiz 403, bizfile CA vide, New York coupé). Candidats d'après les guides tiers, à ouvrir à la main : Californie (gratuit), Floride (gratuit), New York (non établi). Exclus : Texas SOSDirect (payant par recherche), Delaware (nom seul gratuit, détail payant). Sans LEI ni État listé : refus motivé de RG52, nouvelle demande dès qu'un État est ajouté.

## Pays sans source admise (GLEIF seul)

| Pays | Raison |
|---|---|
| KR | Registre IROS payant à la pièce (700 à 1 000 KRW, guides) ; page non lisible. Le contrôle fiscal d'activité ne prouve pas l'immatriculation : exclu |
| MX | Registro Público (SIGER) soumis à droits (manuel officiel) ; PSM ouvert mais ne couvre que les publications récentes, aucun registre : exclu |
| AE | Aucune source nationale gratuite établie (connexion UAE PASS signalée) ; DIFC gratuit selon guides, non ouvert |
| MA | Registre central (OMPIC) : gratuité de la consultation non établie, extraits payants |
| ZA | CIPC : page ouverte, aucun prix de recherche ; BizPortal sous connexion selon guides ; recherche par numéro payante selon guides |

## Écarts par source non admise

- **Agrégateurs privés** : exclus (D79), pistes seulement.
- **IROS (KR)**, **SIGER (MX)**, **Business Profile ACRA**, **SOSDirect (TX)**, **détail Delaware** : payants à l'acte.
- **Handelsregister (DE)**, **Annuaire des entreprises (FR)** : prix non lu, page vide ; ces pays passent par e-Justice.

## Limites à connaître (pour la ligne 15 et le refus motivé)

1. **e-Justice** ne couvre que les sociétés à responsabilité limitée, leurs succursales et les SE : entrepreneur individuel, association, fondation : hors source, refus motivé sauf LEI.
2. **GLEIF** ne contient que les entités qui ont un LEI : peu de marques de petite taille.

## À dire au fondateur

Pas d'arrêt : un socle gratuit existe pour l'Union (27 pays), l'Australie et Singapour (recherche gratuite). **États-Unis, Royaume-Uni, Suisse, Canada, Japon, Brésil, Inde, Nouvelle-Zélande** : gratuité à confirmer à la main avant activation ; **Corée, Mexique, Émirats, Maroc, Afrique du Sud** : GLEIF seul, donc refus motivé pour la plupart des marques de ces pays.
