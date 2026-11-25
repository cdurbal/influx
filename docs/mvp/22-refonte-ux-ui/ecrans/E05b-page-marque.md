# E05b — Page de la marque (créateur ; aperçu backoffice)
> Maquette : `proto-marque.html` (états `createur`, `soumise`) · page de comparaison `ecran-5b-marque.html` · validée le 2026-11-24 (07) · Constats : aucun (page ajoutée à la demande du fondateur)

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E05b.1 | Page de la marque, vue d'un créateur | à créer (proposition E05b-Q1 : `/fr/campagnes/[id]/marque`) | à créer (`/en/campaigns/[id]/brand`) | aucun | createur | L | E08 (fiche de campagne, point d'entrée), C35, C36, C39, C40, C68 ; contrat `open-campaigns` |
| E05b.2 | Page de la marque, version soumise | à créer dans `apps/backoffice` (`/files/profils-marque/[id]/…`) | aucune (D36) | aucun | soumise | L | E05.1 (S11, E05-Q05), E05b.1 |

Aucune page de marque n'existe : un créateur lit la marque dans la fiche de campagne (`apps/web/src/components/campaign/CampaignRecordScreen.tsx`, lignes de `campaign-preview-view.ts:395-475`).

À préserver :
- Garde de rôle créateur ; campagne invisible, en pause, close ou inconnue : même réponse (`record.gone.*`).
- Une seule construction de la vue publique : `brandPublicViewOf()` (`apps/api/src/domains/profiles/brand-public-view.ts:60`), liste fermée ; jamais prénom, e-mail, téléphone, page de contact, raison sociale, numéro, complétude, identifiant de compte (D46, `06` RG38, RG74).
- Lecture en direct du profil **publié** (RG2, RG9) : une modification en attente n'apparaît pas à un créateur.
- Un profil de marque n'est lu que dans les contextes de `06` RG73 ; identifiant opaque (RG75) ; aucune notification à la marque (RG77).

API existantes : `GET /v1/open-campaigns/:id` (marque entière dans `brand`) ; `GET /v1/open-campaigns/:id/brand-logo` ; `GET /v1/open-campaigns` (fil, sans filtre par marque). Backoffice : `POST /v1/bo/queues/profiles-advertiser/entries/:id/open` (ouvrir = prendre en charge et journaliser), `GET …/entries/:id/logo`. **Aucune route ne sert une marque seule, ni la liste de ses campagnes à un créateur.**

## 2. Structure

Écart vertical `spacing-5` (24 px). Sous-entrée courante : « Campagnes » (E05b.1).

| Zone, dans l'ordre | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| 1. Bandeau d'aperçu (E05b.2) | y 48, 1088 × 48 | idem, 937,6 | idem | y 88, 343 × 91,1 |
| 2. Retour | y 48 | y 44,4 | y 96,8 | y 88 |
| 3. En-tête de marque | y 93,7, 1088 × 186 | y 90,1, 937,6 × 186 | y 142,5, 712,4 × 193,4 | y 133,7, 343 × 294,4 |
| 4. Corps | y 303,7 ; 651,6 et 372,4 | y 300,1 ; 555,9 et 317,7 | y 359,9 ; 712,4 | y 452,1 ; 343 |
| 5. Barre fixe (sous 1024 px) | absente | absente | y 911, h 57 | y 699, h 57 |

- En-tête C68 : `auto minmax(0,1fr)`, écart `spacing-6`, rembourrage `spacing-6`, `radius-card`, contour `border-default`, fond `halo-ambient` sur `surface-card` ; logo 120 × 120. Sous 640 px : une colonne, rembourrage `spacing-5`, écart `spacing-4`, logo 72 × 72.
- Corps C40 dès 1024 px : `minmax(0,7fr) minmax(19rem,4fr)`, gouttière 64 px. Sections : filet `border-default`, rembourrage vertical 32 px, écart interne 16 px.
- Encadré collant `top: spacing-6` dès 1024 px ; 372,4 × 309,4 (1440), 317,7 × 330,2 (1280) ; masqué sous 1024 px.
- `main` sous 1024 px : marge basse = barre du bas + 4,25rem.

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E05b.1-S01 | Retour | C11 | Chevron gauche 16 px, « Campagne « {titre} » », `text-sm` | toujours | createur `.go` 1 | E05b.1-CA01 | E05b.1-T01 |
| E05b.1-S02 | En-tête | C33 | Logo sur pastille claire `logo-plate`, 120 px, `radius-card` | logo servi ; sinon E05b-Q8 | `.hero .logo-plate` | E05b.1-CA02 | E05b.1-T01 |
| E05b.1-S03 | En-tête | C68 | `h1` nom commercial, Manrope 800, 36 px max, `tabindex=-1` (hauteur 37,8 à 1440, 29,4 à 375) | toujours | `.hero h1` | E05b.1-CA02 | E05b.1-T01 |
| E05b.1-S04 | En-tête | C13 | Badge rempli « Marque vérifiée », icône `badge-check`, 141 × 28,6 | `badge` servi | `.hero .badge` | E05b.1-CA03 | E05b.1-T01 |
| E05b.1-S05 | En-tête | C68 | « {secteur} · {pays} », secondaire, à droite du badge ou dessous | secteur servi | `.hero__meta span` | E05b.1-CA02 | E05b.1-T01 |
| E05b.1-S06 | En-tête | C68 | Accroche d'une phrase, secondaire | non servie (E05b-Q4) | `.hero__id > .c2` | E05b.1-CA02 | E05b.1-T01 |
| E05b.1-S07 | En bref | C35 | `h2` masqué, encadré 4 cases (651,6 × 103,2) ; 2 × 2 sous 640 px | toujours | `.keyfig` | E05b.1-CA04 | E05b.1-T04 |
| E05b.1-S08 | En bref | C35 | Case 1 : `badge-check` 28 px, « Marque vérifiée par INFLUX » | badge servi | `.keyfig .ver` | E05b.1-CA03 | E05b.1-T04 |
| E05b.1-S09 | En bref | C35 | Case 2 : nombre, « campagnes ouvertes » | E05b-Q2 | `.keyfig > div` 2 | E05b.1-CA05 | E05b.1-T04 |
| E05b.1-S10 | En bref | C35 | Case 3 : tranche, « personnes » | `companySize` servi | `.keyfig > div` 3 | E05b.1-CA04 | E05b.1-T04 |
| E05b.1-S11 | En bref | C35 | Case 4 : année, « sur INFLUX depuis » | non servie (E05b-Q4) | `.keyfig > div` 4 | E05b.1-CA04 | E05b.1-T04 |
| E05b.1-S12 | Ce qui vous concerne | C36 | `h2` masqué, une ligne par fait : icône 24 px, texte 600, précision `text-sm` secondaire ; écart 24 px | un fait servi (E05b-Q3) | `.reasons li` | E05b.1-CA06 | E05b.1-T02 |
| E05b.1-S13 | Ce qui vous concerne | C36 | Icône `info` et phrase « ce n'est pas un score », `text-xs` | avec S12 | `.reasons + p` | E05b.1-CA06 | E05b.1-T02 |
| E05b.1-S14 | Présentation | C26 | `h2`, texte max 40rem, quatre lignes | présentation servie | `#bio` | E05b.1-CA07 | E05b.1-T03 |
| E05b.1-S15 | Présentation | C10 | Bouton secondaire « Lire la suite » / « Réduire », `aria-expanded` | texte coupé | `#more` | E05b.1-CA07 | E05b.1-T03 |
| E05b.1-S16 | Campagnes | C03 | `h2` « Campagnes ouvertes », `id` cible de S26 et S28 | E05b-Q2 | `#h-camp` | E05b.1-CA05 | E05b.1-T01 |
| E05b.1-S17 | Campagnes | C06 | Lignes (variante camp) : titre lien étiré, échéance (`clock`, 600), « {réseau} · {format} · {pays} », chevron ; 97 px par ligne | E05b-Q2 | `.camps li` | E05b.1-CA05 | E05b.1-T01 |
| E05b.1-S18 | Ce qu'elle recherche | C03 | `h2`, deux colonnes dès 640 px, écart `spacing-5` | toujours | `#h-look`, `.two` | E05b.1-CA08 | E05b.1-T04 |
| E05b.1-S19 | Ce qu'elle recherche | C38 | « Thématiques » | `topics` servis | `.chips` 1 | E05b.1-CA08 | E05b.1-T04 |
| E05b.1-S20 | Ce qu'elle recherche | C38 | « Réseaux et formats », paires | E05b-Q5 | `.chips` 2 | E05b.1-CA08 | E05b.1-T04 |
| E05b.1-S21 | Ce qu'elle recherche | C38 | « Audience visée » : pays | `audienceCountries` servis | `.chips` 3 | E05b.1-CA08 | E05b.1-T04 |
| E05b.1-S22 | Ce qu'elle recherche | C38 | « Langues de travail » | `workingLanguages` servies | `.chips` 4 | E05b.1-CA08 | E05b.1-T04 |
| E05b.1-S23 | Façon de travailler | C07 | Rythme, droits d'usage, exclusivité, contreparties ; libellé 12rem (192 px) | valeurs servies | `.props` | E05b.1-CA09 | E05b.1-T04 |
| E05b.1-S24 | Façon de travailler | C03 | Phrase des conditions financières, `text-sm` secondaire | toujours | `.props + p` | E05b.1-CA10 | E05b.1-T01 |
| E05b.1-S25 | Encadré | C39 | « 2 campagnes ouvertes » (Manrope 800, 24 px max), échéance la plus proche | dès 1024 px ; E05b-Q2 | `.box .fig-big` | E05b.1-CA11 | E05b.1-T01 |
| E05b.1-S26 | Encadré | C10 | Lien bouton principal pleine largeur « Voir ses campagnes » vers S16 | dès 1024 px | `.box .btn--primary` | E05b.1-CA11 | E05b.1-T01 |
| E05b.1-S27 | Encadré | C39 | Filet, phrase de non-contact, lien « Compléter mon profil » (`user-round`) | dès 1024 px | `.box` fin | E05b.1-CA10 | E05b.1-T01 |
| E05b.1-S28 | Téléphone | C39 | Barre fixe : « 2 campagnes ouvertes », échéance, bouton principal « Voir » (40 px) vers S16 | sous 1024 px | `.mbar` | E05b.1-CA12 | E05b.1-T05 |
| E05b.2-S01 | Aperçu | C66 | Bandeau : icône `eye`, texte 600 puis phrase, contour tireté `info`, fond `info`, `radius-md`, rembourrage 12 × 16 | version soumise | soumise `.preview` | E05b.2-CA01 | E05b.2-T01 |
| E05b.2-S02 | Façon de travailler | C07 | Ligne « Site web » : domaine en texte | agents seulement | soumise `dt` Site web | E05b.2-CA02 | E05b.2-T02 |
| E05b.2-S03 | Façon de travailler | C14 | Badge interne `eye-off`, « visible des agents INFLUX seulement » | avec S02 | soumise `.layer--internal` | E05b.2-CA02 | E05b.2-T02 |
| E05b.2-S04 | Page | C40 | Toutes les zones de E05b.1 sur les valeurs soumises | hors S01 de E05b.1, S12, S25 à S28 : E05b-Q7 | soumise, page entière | E05b.2-CA03 | E05b.2-T01 |

## 4. Textes

Clés dans `apps/web/src/locales/{fr,en}/campaign.json` (espace `campaign`) et `brand-profile.json` (espace `brandProfile`) ; la page prend un nouvel espace ou prolonge `campaign.record` (choix : architecte).

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S01 | Campagne « {titre} » | à écrire (expert-marketing) | nouvelle |
| S02 | Logo de {nom} | Logo of {name} | `campaign.feed.card.logoAlt` |
| S04, S12 | Marque vérifiée | à écrire (expert-marketing) | `brandProfile.badge.label` porte la date (E05b-Q6) |
| S05 | {secteur} · {pays} | — | `reference.sector`, pays |
| S06 | {accroche} | — | aucune donnée |
| S07 | En bref ; La marque en bref | à écrire (expert-marketing) | nouvelles |
| S08 | Marque vérifiée par INFLUX | à écrire (expert-marketing) | nouvelle |
| S09 | {n} ; campagnes ouvertes | à écrire (expert-marketing) | nouvelle (ICU) |
| S10 | 11–50 ; personnes | à écrire (expert-marketing) | existante `brandProfile.companySize.11_50` « 11 à 50 personnes » |
| S11 | {année} ; sur INFLUX depuis | à écrire (expert-marketing) | nouvelle, donnée absente |
| S12 | Ce qui vous concerne | à écrire (expert-marketing) | nouvelle |
| S12 | Elle recherche votre thématique : {thème} ; Parmi les thèmes qu'elle recherche. | à écrire (expert-marketing) | nouvelles |
| S12 | Elle vise une audience en {pays} ; Le pays principal de votre audience. | à écrire (expert-marketing) | nouvelles |
| S12 | INFLUX a constaté son immatriculation et son site. | à écrire (expert-marketing) | nouvelle (E05b-Q6) |
| S13 | Ces points comparent la marque à votre profil ; ce n'est pas un score. | à écrire (expert-marketing) | nouvelle |
| S14 | Présentation | Presentation | `brandProfile.fields.presentation.label` |
| S15 | Lire la suite ; Réduire | à écrire (expert-marketing) | nouvelles (communes à E02b) |
| S16 | Campagnes ouvertes | à écrire (expert-marketing) | nouvelle |
| S17 | Candidatures avant le {date} | Apply before {date} | `campaign.feed.card.deadline` |
| S18 | Ce qu'elle recherche | à écrire (expert-marketing) | nouvelle |
| S19 à S21 | Thématiques ; Réseaux et formats ; Audience visée | à écrire (expert-marketing) | nouvelles (proches : `brandProfile.fields.*.label`) |
| S22 | Langues de travail | Working languages | `brandProfile.fields.workingLanguages.label` |
| S23 | Façon de travailler | à écrire (expert-marketing) | nouvelle |
| S23 | Rythme de collaboration | Collaboration rhythm | `brandProfile.fields.collaborationRhythm.label` ; valeurs `brandProfile.rhythm.*` |
| S23 | Droits d'usage ; Exclusivité ; Contreparties non monétaires | à écrire (expert-marketing) | nouvelles ; valeurs `campaign.usage_right.*`, `brandProfile.exclusivity.*` |
| S23 | Campagnes saisonnières, 3 à 4 par an ; Aucune demandée ; Produits offerts, visite des jardins ; Republication sur ses réseaux | — | valeurs fictives hors des listes fermées (E05b-Q5) |
| S24 | Les conditions financières se négocient avec votre commercial INFLUX, qui organise la mise en relation. | à écrire (expert-marketing) | nouvelle |
| S25 | {n} campagnes ouvertes ; La plus proche : candidatures avant le {date}. | à écrire (expert-marketing) | nouvelles |
| S26 ; S28 | Voir ses campagnes ; Voir ; La plus proche : avant le {date} | à écrire (expert-marketing) | nouvelles |
| S27 | Vous ne contactez pas la marque directement : votre commercial INFLUX vous propose aux campagnes qui vous correspondent. | à écrire (expert-marketing) | nouvelle (E05b-Q9) |
| S27 | Compléter mon profil | à écrire (expert-marketing) | nouvelle (proche : `campaign.feed.empty.profileLink`) |
| Encadré, nom de région | Campagnes de la marque | à écrire (expert-marketing) | nouvelle |
| E05b.2-S01 | Version soumise, non publiée. Aperçu ouvert depuis le backoffice : c'est ce que les créateurs verront si le profil est publié. | sans objet (D36) | nouvelle, backoffice |
| E05b.2-S02, S03 | Site web ; visible des agents INFLUX seulement | sans objet (D36) | nouvelle, backoffice |

## 5. Interactions, états, responsive, clavier

Interactions :
- S01 : retour à la fiche de campagne d'origine.
- S15 : déplie la présentation, sans animation de hauteur.
- S17 : ligne entière cliquable vers la fiche de campagne (E08).
- S26, S28 : défilement vers S16 ; le focus va au titre S16 (`tabindex=-1`).
- S27 « Compléter mon profil » : `accountProfile`.
- Aucun autre geste : ni contact, ni candidature (Lot 4).

États :

| État | Maquette | Représentation |
|---|---|---|
| Vue d'un créateur | `createur` | §3 |
| Version soumise | `soumise` | §3, E05b.2 |
| Chargement | non montré | proposé : C09 aux formes de S02, S07, S25 ; phrase `record.loading` masquée |
| Campagne d'origine indisponible | non montré | actuel de la fiche : `record.gone.*` ; proposé : C08 identique |
| Erreur, 403, 429 | non montré | actuel : `record.unavailable`, `.forbidden`, `.rateLimited`, `.retry` |
| Hors ligne | non montré | `Notice` `account.offline` (`CampaignRecordScreen.tsx`) |
| Sans badge | non montré | S04, S08 et le fait « Marque vérifiée » absents ; l'encadré S07 passe à trois cases : largeur à fixer (E05b-Q8) |
| Sans logo | non montré | proposé : pastille avec initiales du nom public ; la maquette n'a que l'exemple « T&T » (E05b-Q8) |
| Une seule campagne | non montré | textes au singulier (ICU) |
| Aucune autre campagne | impossible en vue créateur : la page dépend d'une campagne visible | — |
| Aucun fait en commun | non montré | proposé : section S12, S13 absente |

Responsive : 1440 et 1280, deux colonnes ; 768, une colonne et barre fixe ; 375, en-tête en une colonne, encadré S07 en 2 × 2, barre fixe de 57 px. La phrase de non-contact S27 et « Compléter mon profil » disparaissent sous 1024 px (E05b-Q10).

Clavier et focus : S01, S15, S17, S26 ou S28, S27. Aucune animation propre hors survol C10 et C06 ; mouvement réduit : défilement instantané vers S16.

## 6. Critères d'acceptation

- **E05b.1-CA01** Le retour nomme la campagne d'origine et y mène.
- **E05b.1-CA02** L'en-tête montre nom commercial, secteur et pays servis ; aucun champ inventé quand une donnée manque.
- **E05b.1-CA03** Un badge de marque porte sa date (`08` RG4) et n'apparaît que si `badge` est servi.
- **E05b.1-CA04** L'encadré n'affiche que des données servies ; quatre cases dès 640 px, deux par ligne dessous.
- **E05b.1-CA05** Le nombre et la liste des campagnes viennent de l'API, sont identiques entre eux et ne comptent que les campagnes visibles de ce créateur.
- **E05b.1-CA06** Chaque fait est vérifiable sur la page, calculé hors du composant React, sans score, pourcentage ni classement.
- **E05b.1-CA07** La présentation est coupée à quatre lignes ; pas de bouton si elle tient.
- **E05b.1-CA08** Les pastilles reprennent les codes servis, libellés FR et EN.
- **E05b.1-CA09** Exclusivité, rythme et contreparties reprennent les listes fermées.
- **E05b.1-CA10** Aucun montant, commission, tarif, contact ni lien externe (D46, D48, D78).
- **E05b.1-CA11** L'encadré colle à 32 px du haut dès 1024 px et n'a qu'une action principale.
- **E05b.1-CA12** À 375 px la barre fixe mesure 57 px et ne masque pas la fin de la page.
- **E05b.1-CA13** La réponse d'API lue par un créateur ne contient pas `website` (décision du 2026-11-24), pas même nul.
- **E05b.1-CA14** Une campagne invisible, inconnue ou d'une marque dépubliée donne la même réponse (404) et rien n'est écrit.
- **E05b.1-CA15** Aucune route ne permet de lister ou deviner une marque hors d'une campagne visible (`06` RG75).
- **E05b.1-CA16** Textes FR et EN, aucun en dur.
- **E05b.2-CA01** Le bandeau est le premier contenu de la page et nomme l'état « non publiée ».
- **E05b.2-CA02** Le site web n'est servi qu'à un agent ; il est marqué interne.
- **E05b.2-CA03** Les valeurs affichées sont celles soumises (révisions comprises), jamais celles de la version publiée.
- **E05b.2-CA04** L'ouverture de la page ne prend, ne prolonge ni ne libère le verrou de l'entrée et n'appelle pas `open` une seconde fois (E05-Q05).
- **E05b.2-CA05** La page du backoffice ne sert ni coordonnée de contact ni numéro d'immatriculation.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E05b.1-T01 | e2e | `apps/web/e2e/creator-campaigns.spec.ts` (ligne 364, nouveau cas) | Fiche, page marque, retour, sans contact, FR 375 |
| E05b.1-T02 | unitaire | nouveau (fonction de comparaison, hors composant) | Faits, absence de score |
| E05b.1-T03 | e2e | même spec | Lire la suite |
| E05b.1-T04 | unitaire | nouveau `brand-page-view.test.ts` | Chaque champ servi, rien d'autre |
| E05b.1-T05 | visuel | nouveau `brand-page.visual.spec.ts` | Mesures aux quatre largeurs |
| E05b.1-T06 | a11y | spec du cas T01 | axe, dont X10, X11 |
| E05b.1-T07 | unitaire | `apps/api/db-tests/open-campaigns*`, `t15-*` (à adapter) | `website` absent de la réponse, 404 unique, aucun identifiant |
| E05b.2-T01 | e2e | nouveau `apps/web/e2e/backoffice-brand-page.spec.ts` | Bandeau, valeurs soumises |
| E05b.2-T02 | unitaire | nouveau, projection backoffice | Site web présent, contact absent |

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Vue publique de la marque | `brand-public-view.ts:60` | sans `website` pour un créateur | faire évoluer |
| Lignes « La marque » de la fiche | `campaign-preview-view.ts:395-475` | E08 garde son bloc ; E05b lit la même vue | réutiliser |
| Lecture de la fiche, états | `use-open-campaign-record.ts`, `open-campaigns-api.ts` | idem | réutiliser |
| Page, en-tête, encadré | aucun | C68, C35, C36, C40, C39 | créer |
| Page de l'agent | aucune | E05b.2 | créer |

Données requises :

| Donnée affichée par la maquette | Servie aujourd'hui ? | Écart |
|---|---|---|
| Nom, secteur, pays, taille, présentation, thèmes, réseaux, formats, pays d'audience, droits, exclusivité, rythme, langues, badge et date | oui, `campaignBrandViewSchema` (`campaign-creator-view.ts:90-119`) | aucun |
| Logo | oui, `…/brand-logo` | aucun |
| Accroche | non, champ inexistant | E05b-Q4 |
| Ancienneté | non | E05b-Q4 |
| Campagnes ouvertes de la marque | non ; `GET /v1/open-campaigns` n'a ni filtre ni identifiant de marque | E05b-Q2 |
| Thème et pays du créateur | oui côté créateur, jamais comparés | E05b-Q3 |
| Contreparties décrites | booléen `offersNonMonetary` | E05b-Q5 |
| Site web | servi au créateur (`website`) | à retirer du créateur, à servir à l'agent |
| Fonction de l'interlocuteur | servie (`contactRole`) | absente de la maquette (E05b-Q11) |
| Version soumise | `reviewedProfileSchema` + `revisions` (`backoffice-queues.ts:284-323`, `:417-436`) | sans route de lecture seule, contact inclus |

Hors lot : mise en relation et interlocuteur révélé (Lot 4).

## 9. Contradictions, manques et décisions

Transverses : X1 (clamp du titre, `text-lead`, `text-heading-3`), X2, X3 (640 px), X5, X10, X11, X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E05b-Q1 | Aucune route de page de marque ; `06` RG73 et RG75 limitent la lecture à une campagne visible, sans adresse devinable | Route à créer | `/campagnes/[id]/marque` (id de campagne), alimentée par `GET /v1/open-campaigns/:id`, garde du créateur | architecte | oui |
| E05b-Q2 | « Campagnes ouvertes », nombre, échéance : aucune donnée ; lister les campagnes d'une marque crée un mini-annuaire de marques (`06` RG4) et change la RLS | S09, S16, S17, S25 | Route dédiée, limitée aux campagnes que ce créateur voit, sans identifiant de marque ; RLS et journal à définir | architecte | oui |
| E05b-Q3 | « Ce qui vous concerne » compare la marque au créateur : jamais servi ; logique interdite dans React (CLAUDE §5) ; D11 | S12 | Calcul dans `apps/api`, deux faits fermés (thème, pays d'audience), validés | expert-matching | oui |
| E05b-Q4 | Accroche et ancienneté : champs inexistants | S06, S11 | Retirer les deux ; l'année d'inscription est une donnée à exposer ou à abandonner | product-owner | oui |
| E05b-Q5 | Valeurs hors listes fermées (« 3 à 4 par an », « Produits offerts, visite des jardins ») ; réseaux et formats sans paire | S20, S23 | Valeurs de `rhythm.*`, `exclusivity.*`, oui ou non ; réseaux et formats en deux groupes | product-owner | non |
| E05b-Q6 | « Marque vérifiée » sans date (`08` RG4) ; « a constaté son immatriculation et son site » diffère de « domaine et immatriculation contrôlés » (`08` RG10, D34, juriste) | S04, S08, S12 | Reprendre `brandProfile.badge.label` | product-owner | oui |
| E05b-Q7 | E05b.2 garde coque créateur, retour campagne, faits et encadré « Voir ses campagnes » : l'agent n'a pas de session créateur, hôte distinct, campagnes inconnues | E05b.2 | Page interne du backoffice (E05-Q05) : zones 2 à 4 seulement, sans S01, S12, S25 à S28 | architecte | oui |
| E05b-Q8 | Pastille sans logo et encadré à trois cases non montrés | S02, S07 | Initiales du nom public ; cases restantes à largeur égale | expert-ux | non |
| E05b-Q9 | « votre commercial vous propose aux campagnes » contredit D45 et la candidature du créateur (Lot 4) | S27 | « Vous candidatez depuis la campagne ; votre commercial organise la mise en relation. » | product-owner | oui |
| E05b-Q10 | Sous 1024 px, phrase de non-contact et lien de profil perdus | S27 | Reporter en fin de page | expert-ux | non |
| E05b-Q11 | `contactRole` et marchés visés, secteurs secondaires servis mais absents ; `06` RG73 : visibles | CA02 | Les ajouter à « Façon de travailler » ou les retirer de la vue | product-owner | non |
| E05b-Q12 | Site web : `06` RG17 et RG74 le disent visible ; le fondateur l'a retiré du créateur (07, 2026-11-24) ; `campaignBrandViewSchema.website` le sert encore, et `campaign.errors.linkInText` annonce qu'il « figure déjà sur votre profil » | API, RLS, E07, E08, E10, E18 | Amender `06` ; retirer `website` de la réponse créateur (pas du masque d'écran) ; réécrire le texte | architecte | oui |
| E05b-Q13 | Publication du profil révisé : une révision en cours n'est jamais vue d'un créateur ; E05b.2 doit montrer les révisions proposées, l'API les sépare (`validated`, `proposed`) | E05b.2 | Fusion de lecture seule dans `apps/api`, sans contact | architecte | oui |
