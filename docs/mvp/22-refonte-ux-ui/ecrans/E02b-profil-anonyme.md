# E02b — Profil anonyme (marque)
> Maquette : `proto-profil-anonyme.html` (états `profil`, `ajoute`, `galerie`) · page de comparaison `ecran-2b-profil-anonyme.html` · validée le 2026-11-24 (07) · Constats : U09, U10, U12

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E02b.1 | Profil anonyme d'un créateur | `/fr/createurs/profil/[alias]` | `/en/creators/profile/[alias]` | `creator-search/AnonymousProfileScreen.tsx`, `creator-profile/CreatorCardView.tsx` | profil, ajoute, galerie | XL | E02 (retour, sélection active), E15 (même page côté créateur), C34 à C40 |

Fonctionnalités à préserver (`AnonymousProfileScreen.tsx`, chemin omis) :
- Garde de rôle `notFound()` (`:57-73`) ; l'alias est le seul segment dynamique (RG65).
- Une ouverture = un décompte et un journal : une lecture par alias, jamais rejouée par un re-rendu, un onglet, un visuel (`:79-105`, RG66, 60 par jour).
- États `loading`, `closed`, `brand_not_published`, `profile`, `gone`, `rate_limited`, `failed` (`:168-257`, `shortlists-view.ts:375-400`).
- Réponse unique pour alias inconnu, exclu ou mal formé : `gone` (CA49).
- Retour vers la recherche avec critères, page, `list` (`:121-127`, `searchHref`).
- Deux actions seulement : ajouter à ma sélection, demander une sélection (RG55).
- Visuels : 3 premiers, chacun lu une fois ; un visuel en échec disparaît (`:278-294`).
- Région affichée seulement si servie, en code brut (`shortlists-view.ts:276`, EC-L3F-11-1).
- `CreatorCardView` est la source unique de la carte (RG50, CA6) : aperçu créateur, recherche, profil, sélections.

API : `GET /v1/creator-search/profiles/:alias` ; `GET …/visuals/:visualId` ; `GET /v1/me/shortlists`, `GET /v1/me/shortlists/:id`, `POST /v1/me/shortlists`, `PUT` et `DELETE /v1/me/shortlists/:id/items/:alias`. Contrats : `creator-search-profile.ts`, `creator-projection.ts`, `shortlists.ts`.

## 2. Structure

Contenu C01 `container-max` ; écart vertical `spacing-5` (24 px). Sous-entrée courante : « Recherche ».

| Zone, dans l'ordre | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| 1. Retour | x 304, y 48, h 21,7 | x 299,2 | x 27,8 | x 16, y 88 |
| 2. Carrousel (sous 768 px) | masqué | masqué | masqué | x 0, y 133,7, 375 × 281,3 (pleine largeur) |
| 3. Titre | x 304, y 93,7, `h1` max 46rem (736) | y 90,1, 736 | y 142,5, 712,4 | y 438,9, 343 |
| 4. Mosaïque (dès 768 px) | y 241,4, 1088 × 544 | y 289,8, 937,6 × 468,8 | y 333,1, 712,4 × 356,2 | masquée |
| 5. Corps | y 809,4 ; 651,6 et 372,4 | y 782,6 ; 555,9 et 317,7 | y 713,3 ; 712,4 | y 626,8 ; 343 |
| 6. Barre fixe (sous 1024 px) | absente | absente | y 911, h 57 | y 699, h 57 |

- Corps C40 dès 1024 px : `minmax(0,7fr) minmax(19rem,4fr)`, gouttière `spacing-9` (64 px) ; sous 1024 px une colonne, écart `spacing-6`.
- Colonne principale : sections séparées d'un filet `border-default`, rembourrage vertical `spacing-6`, écart interne `spacing-4` ; première sans filet.
- Colonne droite : collante, `top: spacing-6` (32 px), écart `spacing-4` ; hauteur 428,7 px (profil), 377,8 px (ajoute). Masquée sous 1024 px (`.avail`, `.box`).
- Mosaïque : `2fr 1fr 1fr`, deux rangées, écart 8 px, ratio 2:1, `radius-card` ; grand visuel 536 × 544, petits 268 × 268 à 1440.
- Galerie plein écran : tête 69 px, corps défilant (`spacing-6`, gouttière) ; grille max 56rem (896), deux colonnes dès 768 px, une sinon, écart `spacing-5`.
- `main` sous 1024 px : marge basse = barre du bas + 4,25rem.

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E02b.1-S01 | Retour | C11 | Chevron gauche 16 px, « Résultats de la recherche », `text-sm` | toujours | profil `.go` | E02b.1-CA01 | E02b.1-T01 |
| E02b.1-S02 | Titre | C02 | `h1` = titre court, 28 px dès 1024, 24 px en dessous, `tabindex=-1` | profil servi | `.t-page` | E02b.1-CA02 | E02b.1-T01 |
| E02b.1-S03 | Titre | C02 | « Profil {alias} » 14 px Manrope + icône `badge-check` 16 px bleue | icône : voir X2 | `.pa-top .row` 1 | E02b.1-CA03 | E02b.1-T01 |
| E02b.1-S04 | Titre | C02 | Icône `eye-off` et phrase d'anonymat, `text-sm` secondaire | toujours | `.row--top` | E02b.1-CA04 | E02b.1-T01 |
| E02b.1-S05 | Titre | C39 | Bouton souligné cœur + « Ajouter à ma sélection », 204,4 × 44, `aria-pressed` ; à 768 sous le titre, x 27,8 | dès 768 px | `.savelink` | E02b.1-CA05 | E02b.1-T02 |
| E02b.1-S06 | Visuels | C34 | Mosaïque de cinq visuels, curseur zoom, survol assombri 0,85 | dès 768 px ; moins de cinq : E02b-Q3 | `.mosaic .visual` | E02b.1-CA06 | E02b.1-T03 |
| E02b.1-S07 | Visuels | C34 | Bouton « Afficher les 6 visuels », icône `grid-2x2`, 168,5 × 36, à 16 px du coin bas droit, `surface-inverse` | dès 768 px | `.mosaic__all` | E02b.1-CA06 | E02b.1-T03 |
| E02b.1-S08 | Visuels | C34 | Carrousel 4:3 bord à bord, `scroll-snap` | sous 768 px | `.carousel__track` | E02b.1-CA07 | E02b.1-T03 |
| E02b.1-S09 | Visuels | C34 | Compteur « 1 / 6 », 12 px du coin bas droit, `text-xs` 600 | sous 768 px | `.carousel__count` | E02b.1-CA07 | E02b.1-T03 |
| E02b.1-S10 | Résumé | C03 | `h2` 20 px « Créateur · {thématique} · {région}, {pays} » | région si servie (RG15) | `#h-sum` | E02b.1-CA08 | E02b.1-T01 |
| E02b.1-S11 | Résumé | C03 | « {langues} · {n} réseaux · {expérience} », secondaire | valeurs servies | `#h-sum + p` | E02b.1-CA08 | E02b.1-T01 |
| E02b.1-S12 | Résumé | C35 | Encadré 4 cases (651,6 × 103,2), filets verticaux, `radius-card` ; 2 × 2 sous 640 px | réseau principal listé | `.keyfig` | E02b.1-CA09 | E02b.1-T04 |
| E02b.1-S13 | Résumé | C35 | Case 1 : `badge-check` 28 px, « Audience vérifiée », réseau | badge servi | `.keyfig .ver` | E02b.1-CA09 | E02b.1-T04 |
| E02b.1-S14 | Résumé | C35 | Case 2 : tranche d'abonnés, « abonnés · {niveau} » | tranche servie | `.keyfig > div` 2 | E02b.1-CA10 | E02b.1-T04 |
| E02b.1-S15 | Résumé | C35 | Case 3 : rythme, « publications par semaine » | fréquence servie | `.keyfig > div` 3 | E02b.1-CA10 | E02b.1-T04 |
| E02b.1-S16 | Résumé | C35 | Case 4 : tranche de commentaires, « commentaires par publication » | tranche servie | `.keyfig > div` 4 | E02b.1-CA10 | E02b.1-T04 |
| E02b.1-S17 | Résumé | C33 | Pastille 48 px « 93 », alias, « Sur INFLUX depuis … · chiffres mis à jour le … » | date servie ; pastille : E02b-Q5 | `.who` | E02b.1-CA11 | E02b.1-T01 |
| E02b.1-S18 | Proposé car | C36 | `h2` masqué, une ligne par raison : icône 24 px, texte 600, précision `text-sm` secondaire ; écart 24 px | 2 à 4 raisons servies | `.reasons li` | E02b.1-CA12 | E02b.1-T01 |
| E02b.1-S19 | Proposé car | C36 | Icône `info` et « Proposé car : ce n'est pas un score… », `text-xs` | toujours | `.reasons + p` | E02b.1-CA12 | E02b.1-T01 |
| E02b.1-S20 | Présentation | C26 | `h2` masqué, bio max 40rem, 4 lignes coupées | bio servie | `#bio` | E02b.1-CA13 | E02b.1-T05 |
| E02b.1-S21 | Présentation | C10 | Bouton secondaire « Lire la suite » / « Réduire », `aria-expanded` | bio de plus de 4 lignes | `#more` | E02b.1-CA13 | E02b.1-T05 |
| E02b.1-S22 | Réseaux | C03 | `h2` « Réseaux », phrase de portée `text-sm` secondaire | au moins une ligne | `#h-net` | E02b.1-CA14 | E02b.1-T04 |
| E02b.1-S23 | Réseaux | C44 | Une ligne par réseau : `h3`, étoile si principal, badges de vérification ; filet `border-subtle` | ligne listée | `.net__h` | E02b.1-CA14 | E02b.1-T04 |
| E02b.1-S24 | Réseaux | C35 | Trois chiffres en colonnes : Abonnés, Rythme, Commentaires, sous-lignes | dans cet ordre (D61, RG113) | `.figs` | E02b.1-CA10 | E02b.1-T04 |
| E02b.1-S25 | Audience | C03 | `h2` « Audience » | audience servie | `#h-aud` | E02b.1-CA15 | E02b.1-T06 |
| E02b.1-S26 | Audience | C22 | Sélecteur segmenté des réseaux (263,7 × 44) | voir E02b-Q2 | `.seg` | E02b.1-CA15 | E02b.1-T06 |
| E02b.1-S27 | Audience | C37 | « Pays » puis barres : libellé 144 px, barre, valeur 104 px ; h 21,7 | tranches servies | `.ranges` 1 | E02b.1-CA16 | E02b.1-T06 |
| E02b.1-S28 | Audience | C37 | « Âges » puis barres | tranches servies | `.ranges` 2 | E02b.1-CA16 | E02b.1-T06 |
| E02b.1-S29 | Audience | C37 | Phrase genre et provenance, `text-sm` secondaire | `audienceGenderBand` servi | `.ranges` puis `p` | E02b.1-CA16 | E02b.1-T06 |
| E02b.1-S30 | Offre | C03 | `h2` « Ligne éditoriale et offre », grille 2 colonnes dès 640 px, écart `spacing-5` | toujours | `#h-off`, `.two` | E02b.1-CA17 | E02b.1-T04 |
| E02b.1-S31 | Offre | C38 | « Thématiques » : pastilles 32 px | servies | `.chips` 1 | E02b.1-CA17 | E02b.1-T04 |
| E02b.1-S32 | Offre | C38 | « Ton » : pastilles | servies | `.chips` 2 | E02b.1-CA17 | E02b.1-T04 |
| E02b.1-S33 | Offre | C38 | « Formats » : pastilles | servis | `.chips` 3 | E02b.1-CA17 | E02b.1-T04 |
| E02b.1-S34 | Offre | C07 | « Conditions » : délai, droits d'usage, déplacements ; libellé 9rem (144 px) | valeurs servies | `.props` | E02b.1-CA17 | E02b.1-T04 |
| E02b.1-S35 | Encadré | C39 | Disponibilité : pilule large 372,4 × 47,7, icône `calendar-check` succès | `availability` servi | `.avail` | E02b.1-CA18 | E02b.1-T02 |
| E02b.1-S36 | Encadré | C04 | Carte 372,4 × 365 : « Ma sélection privée », « Ajouter ce profil ne prévient aucun créateur. » | dès 1024 px | `.box` | E02b.1-CA18 | E02b.1-T02 |
| E02b.1-S37 | Encadré | C18 | Liste « Sélection » : listes de la marque avec leur nombre, puis « Nouvelle sélection… » | non ajouté | profil `#sel-pick` | E02b.1-CA19 | E02b.1-T02 |
| E02b.1-S38 | Encadré | C10 | Bouton principal pleine largeur « Ajouter à ma sélection », cœur ; devient secondaire « Retirer de ma sélection » | toujours | `#box-add` | E02b.1-CA05 | E02b.1-T02 |
| E02b.1-S39 | Encadré | C19 | Icône `circle-check`, « Dans « Ma sélection » · 3 créateurs », texte succès 600 | ajouté | ajoute `#added` | E02b.1-CA05 | E02b.1-T02 |
| E02b.1-S40 | Encadré | C03 | Filet, phrase des coûts, `text-sm` secondaire | toujours | `.rule + p` | E02b.1-CA20 | E02b.1-T01 |
| E02b.1-S41 | Encadré | C11 | Lien « Demander une sélection à l'équipe INFLUX », `sparkles` | toujours ; sous 1024 px : E02b-Q8 | `.box .go` | E02b.1-CA21 | E02b.1-T01 |
| E02b.1-S42 | Téléphone | C39 | Barre fixe : disponibilité, « Privé : aucun créateur prévenu », bouton « Ajouter » / « Ajouté » (40 px) | sous 1024 px | `.mbar` | E02b.1-CA22 | E02b.1-T02 |
| E02b.1-S43 | Galerie | C34 | Plein écran : fermer (chevron gauche, focus initial), titre « Portfolio · Profil {alias} », figures 4:3 légendées | ouverte | galerie `#gal` | E02b.1-CA23 | E02b.1-T03 |
| E02b.1-S44 | Annonces | C29 | Région polie unique | toujours | `#announcer` | E02b.1-CA24 | E02b.1-T02 |

## 4. Textes

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| S01 | Résultats de la recherche | Search results | `creatorSearch.profile.back` |
| S02, S20 | {titre}, {bio} | — | saisie du créateur |
| S03, S17 | Profil {alias} | Profile {alias} | `creatorProfile.alias.name` |
| S03 | Profil vérifié | à écrire (expert-marketing) | nouvelle (X2) |
| S04 | Profil anonyme : aucune identité visible avant la mise en relation. | à écrire (expert-marketing) | nouvelle (proche : `profile.explain`) |
| S05, S38 | Ajouter à ma sélection ; Retirer de ma sélection | Add to my selection ; Remove from my selection | `shortlist.add`, `shortlist.remove` |
| S06, S08 | Visuel {n} : {légende} ; Visuels du portfolio | à écrire (expert-marketing) | nouvelles |
| S07 | Afficher les {n} visuels | à écrire (expert-marketing) | nouvelle (ICU) |
| S10 | Créateur · {thématique} · {région}, {pays} | à écrire (expert-marketing) | nouvelle |
| S11 | {langues} · {n} réseaux · {fourchette} collaborations avec des marques | à écrire (expert-marketing) | nouvelle ; tranche `experience.*` |
| S12 | Chiffres clés du réseau principal, {réseau} | à écrire (expert-marketing) | nouvelle (X10) |
| S13 | Audience vérifiée {réseau} | à écrire (expert-marketing) | `filters.badge.audience_verified` + réseau ; date exigée (E02b-Q4) |
| S14 | {tranche} ; abonnés · {niveau} | à écrire (expert-marketing) | nouvelle |
| S15 | Plusieurs ; publications par semaine | à écrire (expert-marketing) | nouvelle ; existante `reference.publication_frequency.*` |
| S16 | commentaires par publication | à écrire (expert-marketing) | nouvelle ; tranche `reference.comment_band.*` |
| S17 | Sur INFLUX depuis {mois} · chiffres mis à jour le {date} | à écrire (expert-marketing) | nouvelle, moitié interdite (E02b-Q5) |
| S18 | Proposé car ; {raison} | Suggested because | `reasons.title`, `reason.*` ; précisions : nouvelles |
| S18 | Elle correspond à votre critère « Thématique ». ; Le pays d'audience de votre recherche. ; Chiffres constatés par INFLUX le {date}, sur le tableau de bord du réseau. | à écrire (expert-marketing) | nouvelles |
| S19 | Proposé car : ce n'est pas un score. Le tri « Pertinence » compte les critères satisfaits. | à écrire (expert-marketing) | nouvelle |
| S20 | Présentation | Presentation | `brandProfile.fields.presentation.label` (autre espace) : nouvelle |
| S21 | Lire la suite ; Réduire | à écrire (expert-marketing) | nouvelles |
| S22 | Réseaux ; Les marques voient des tranches. Pseudo, liens et chiffres exacts : après la mise en relation. | Networks | `preview.sections.networks` ; phrase nouvelle |
| S23 | Compte principal ; Compte vérifié ; Audience vérifiée | Main account ; Verified account ; Verified audience | `networks.primary.label`, `filters.badge.*` |
| S24 | Abonnés ; Rythme ; Commentaires ; par publication | à écrire (expert-marketing) | nouvelles |
| S25 | Audience | Audience | `preview.sections.audience` |
| S26 | Réseau | à écrire (expert-marketing) | nouvelle |
| S27, S28 | Pays ; Âges | à écrire (expert-marketing) | nouvelles |
| S29 | Audience majoritairement féminine (plus de 50 %). Tranches déclarées par le créateur ; chiffres d'audience vérifiés par INFLUX sur {réseau}. | à écrire (expert-marketing) | nouvelle ; `preview.gender.*` |
| S30 à S33 | Ligne éditoriale et offre ; Thématiques ; Ton ; Formats | à écrire (expert-marketing) | nouvelles |
| S34 | Conditions ; Délai habituel ; Droits d'usage ; Déplacements | à écrire (expert-marketing) | nouvelles ; valeurs `offer.delivery.*`, `travel.*` |
| S35, S42 | Disponible sous 2 semaines | à écrire (expert-marketing) | nouvelle ; existante `offer.availability.lt_2w` |
| S36 | Ma sélection privée ; Ajouter ce profil ne prévient aucun créateur. | à écrire (expert-marketing) | nouvelles (proche : `panel.private`) |
| S37 | Sélection ; {nom} ({n} créateurs) ; Nouvelle sélection… | à écrire (expert-marketing) | nouvelles |
| S39 | Dans « {nom} » · {n} créateurs | à écrire (expert-marketing) | nouvelle (proche : `shortlist.inList`) |
| S40 | Les coûts se négocient avec votre commercial INFLUX, qui organise la mise en relation. | à écrire (expert-marketing) | nouvelle |
| S41 | Demander une sélection à l'équipe INFLUX | Ask the INFLUX team for a selection | `request.link` |
| S42 | Privé : aucun créateur prévenu ; Ajouter ; Ajouté | à écrire (expert-marketing) | nouvelles |
| S43 | Fermer la galerie ; Portfolio · Profil {alias} | à écrire (expert-marketing) | nouvelles |
| S44 | Profil {alias} ajouté à « {nom} » ({n} créateurs). ; Profil {alias} retiré de « {nom} » ({n} créateurs). | à écrire (expert-marketing) | nouvelles (communes à E02) |

## 5. Interactions, états, responsive, clavier

Interactions :
- S05, S38, S42 : même geste, état partagé ; réponse de l'API d'abord, puis cœur rempli 120 ms, S39 en fondu 200 ms, annonce C29. Refus : `shortlist.refusal.*` sous le bouton.
- S37 « Nouvelle sélection… » : sans comportement dans la maquette (E02b-Q6). Choisir une liste change la sélection active (`list` de l'adresse) sans rouvrir le profil.
- S06, S07, S08 : ouvrent la galerie ; Échap, chevron ou fond ferment ; focus rendu au déclencheur.
- S21 : bascule sans animation de hauteur.
- S26 : change les tranches affichées, sans requête (une requête = une ouverture décomptée).
- S01 : retour à la page de résultats quittée.

États :

| État | Maquette | Représentation |
|---|---|---|
| Profil | `profil`, `ajoute`, `galerie` | §3 |
| Chargement | non montré | Actuel `:169-174` (phrase). Proposé : C09 aux formes de S02, S06, S12, S36, annonce `profile.loading` |
| Fermé | non montré | Actuel `:175-184`. Proposé : C08 `closed.*` et bouton `request.link` |
| Marque non publiée | non montré | Actuel `:185-201`, en C08 |
| Indisponible (`gone`) | non montré | Actuel `:202-215`, en C08 avec retour ; aucun indice du motif (CA49) |
| Plafond 429 | non montré | Actuel `:216-233` : C17 alerte, délai, lien `request.link` |
| Erreur | non montré | Actuel `:234-247` ; proposé : ajouter « Réessayer » |
| Hors ligne | non montré | Actuel `:131` |
| Sans visuel | non montré | Actuel : aucune image (RG84) ; proposé : ni mosaïque ni carrousel, titre puis corps |
| Point de vigilance | non montré | Obligatoire (E02b-Q7) |
| Sélections fermées ou en échec | non montré | Actuel : bouton absent ; encadré gardé avec `panel.failed`, `panel.retry` |
| Liste pleine, limite de listes | non montré | `shortlist.refusal.full`, `.limit` sous S38 |

Responsive : dès 1024 px, deux colonnes ; à 768, mosaïque gardée, encadré remplacé par la barre ; à 375, carrousel en tête avant le titre, S05 et S40, S41, S37 masqués. L'ordre du DOM met le carrousel avant le titre : à toute largeur, un seul des deux est rendu pour l'accessibilité.

Clavier et focus : S01, S05, visuels (boutons, pas des `div`), S07, S21, S26, S37, S38, S41. Galerie : focus piégé, focus initial sur le chevron, corps défilant atteignable (X8). Après navigation, focus au `h1`.

Animations propres : cœur `fill` 120 ms ; S39 entrée 200 ms ; survol d'un visuel `filter` 120 ms ; galerie 200 ms / 120 ms ; `ease-standard` ; rien sous mouvement réduit.

## 6. Critères d'acceptation

- **E02b.1-CA01** Le retour mène aux critères, à la page et à la sélection d'origine.
- **E02b.1-CA02** Le `h1` est le titre court, max 736 px de large, 28 px dès 1024 px.
- **E02b.1-CA03** L'alias est le seul identifiant affiché.
- **E02b.1-CA04** La phrase d'anonymat est visible à toute largeur.
- **E02b.1-CA05** Les trois boutons d'ajout montrent le même état ; l'état change seulement après la réponse ; l'annonce nomme la sélection et son nombre.
- **E02b.1-CA06** Dès 768 px la mosaïque a le ratio 2:1 et ses visuels sont des boutons nommés.
- **E02b.1-CA07** Sous 768 px le carrousel occupe la largeur de l'écran et son compteur suit le défilement.
- **E02b.1-CA08** Aucune ville ; la région n'apparaît que si `residenceRegion` n'est pas nul.
- **E02b.1-CA09** L'encadré a quatre cases dès 640 px, deux par ligne en dessous.
- **E02b.1-CA10** Les trois métriques sont dans l'ordre communauté, rythme, commentaires ; aucun nombre exact.
- **E02b.1-CA11** Chaque chiffre porte sa date et sa source quelque part sur la page (`figuresMeasuredAt`, `figuresSource`).
- **E02b.1-CA12** Les raisons viennent de `reasons`, dans leur ordre, sans score ni pourcentage exact ; une seule mention « ce n'est pas un score ».
- **E02b.1-CA13** La bio est coupée à 4 lignes ; le bouton n'existe pas si elle tient.
- **E02b.1-CA14** Seules les lignes servies apparaissent ; l'étoile a un nom accessible.
- **E02b.1-CA15** Changer de réseau n'émet aucune requête.
- **E02b.1-CA16** Chaque barre occupe l'intervalle de sa tranche servie et la valeur est écrite ; aucune tranche non servie n'est dessinée.
- **E02b.1-CA17** Chaque champ servi par `creatorProjectionBeforeSchema` apparaît une fois, aucun autre (RG50, CA6).
- **E02b.1-CA18** L'encadré reste visible au défilement dès 1024 px.
- **E02b.1-CA19** La liste propose toutes les sélections de la marque avec leur nombre.
- **E02b.1-CA20** Aucun montant, tarif, devise ni pourcentage de commission (D48, D78).
- **E02b.1-CA21** La demande de sélection est atteignable à toute largeur (RG61) ; aucune autre action de mise en relation (RG55).
- **E02b.1-CA22** À 375 px la barre fixe mesure 57 px et ne masque pas la fin de la page.
- **E02b.1-CA23** La galerie est modale, fermable au clavier, rend le focus et se recharge zéro fois.
- **E02b.1-CA24** Ajout, retrait, refus sont annoncés une fois ; textes FR et EN, aucun en dur.
- **E02b.1-CA25** Une ouverture de page = un seul appel de profil, y compris en mode strict de React.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E02b.1-T01 | e2e | `apps/web/e2e/brand-creator-shortlists.spec.ts` (ligne 44, à adapter) | Profil entier, rien d'identifiant, région, deux actions, EN 1440 |
| E02b.1-T02 | e2e | même fichier (lignes 90 à 148) | Ajout, retrait, encadré, barre, annonce |
| E02b.1-T03 | e2e | même fichier (nouveau cas) | Mosaïque, carrousel, galerie, focus |
| E02b.1-T04 | unitaire | `apps/web/tests/shortlists-view.test.ts` (lignes 538 à 600), `creator-preview-view.test.ts` | Champs servis seulement, D61, sans RG48 |
| E02b.1-T05 | e2e | nouveau cas | Lire la suite |
| E02b.1-T06 | unitaire | nouveau, barres | Intervalle par code de tranche |
| E02b.1-T07 | visuel | nouveau `brand-creator-profile.visual.spec.ts` | Mesures aux quatre largeurs |
| E02b.1-T08 | a11y | `brand-creator-shortlists.spec.ts` | axe, dont X8, X9, X10, X11 |
| E02b.1-T09 | unitaire | `shortlists-view.test.ts` (ligne 506) | États et refus |

Sélecteurs attendus : `data-profile`, `data-visual` (avec `img`), `data-field="residenceRegion"`, `data-reasons`, `data-vigilance`, `data-add-to-selection`, `data-held`, `data-profile-request`, `data-selection-failure`, `data-state`, `data-shortlists-link`. Dans l'aperçu créateur : `data-preview-card`, `data-network`, `data-badge`, `data-field` (`creator-preview.spec.ts:71-133`).

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Lecture du profil, états, retour | `AnonymousProfileScreen.tsx:79-258` | inchangé | réutiliser |
| Corps en carte étroite | `:295-345`, `CreatorCardView.tsx:175-253` | C40 | créer |
| Visuels | `CreatorCardView.tsx:70-99` | C34 | créer |
| Valeurs (lignes libellées) | `creator-preview-view.ts` (`profileRowsOf`, `networkOf`, `audienceRowsOf`, `offerRowsOf`) | S10 à S34 | faire évoluer : mêmes données, découpage par section |
| Raisons | `SEARCH_REASONS_CLASSES` | C36 | faire évoluer |
| Ajout | `AddToSelectionButton.tsx` | S05, S38, S42 | faire évoluer |
| Choix de liste | `SelectionPanel.tsx` (choix de la liste, recherche) | S37 | déplacer |
| `profile.explain`, `profile.title` | `:132-134` | remplacés par S02, S04 | supprimer |

Données requises :

| Donnée affichée par la maquette | Servie aujourd'hui ? | Écart |
|---|---|---|
| Titre, bio, thématiques, ton, langues, formats, droits, délai, déplacements, expérience | oui (`creator-projection.ts:73-97`) | exclusivité et non monétaire servis, absents de la maquette |
| Région | oui, code brut (`residenceRegion`) | nom de région absent |
| Audience par réseau | non : audience du seul réseau principal | E02b-Q2 |
| Tranches de part | `preview.share.*` : 10–25, 25–50, plus de 50 ; sous 10 % jamais servi ; pays principal : moins de 50, 50–80, 80 et plus | E02b-Q1 |
| Genre | `female_majority`, `male_majority`, `mixed` | « plus de 50 % » à retirer |
| Visuels | oui, 8 au plus | E02b-Q3 |
| Date des chiffres, source | oui (`figuresMeasuredAt`, `figuresSource`) | aucun |
| Ancienneté sur INFLUX | non | E02b-Q5 |
| Listes et nombres | oui (`GET /v1/me/shortlists`) | aucun |
| Précisions des raisons (critère satisfait, date du constat) | code et paramètres seulement | texte à composer par code |

Hors lot : l'action de mise en relation, sous S38 (Lot 4).

## 9. Contradictions, manques et décisions

Transverses : X1 (`text-lead` des chiffres clés), X2, X3 (640 px), X5, X6 (S26), X7 (pastille 93), X8, X9, X10, X11, X12, X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E02b-Q1 | Barres « 30 à 50 % », « 10 à 30 % », « moins de 10 % » ; projection : 10–25, 25–50, plus de 50, et autre jeu pour le pays principal | Barres fausses | Dessiner les tranches servies ; ne jamais montrer un pays sous 10 % | expert-matching | oui |
| E02b-Q2 | Sélecteur de réseau sur l'audience : données du seul réseau principal (`creator-projection.ts:55-64`) | Deux choix sans données | Retirer S26 et nommer le réseau principal, ou étendre la projection (RG50, RLS) | architecte | oui |
| E02b-Q3 | Six visuels, mosaïque de cinq ; RG50 et `17` §7.1 : trois ; code `PROFILE_VISUALS_SHOWN = 3` ; formes à 1, 2, 3, 4 visuels non montrées | Galerie et mosaïque | Amender RG50 (tous les visuels approuvés, 8 au plus) et dessiner les formes réduites | product-owner | oui |
| E02b-Q4 | Badges sans date (S13, S23) ; `08` RG4 : défaut bloquant ; mention « INFLUX ne se prononce pas sur l'authenticité » non déplaçable (`08` RG10) absente | Libellés | « {badge} · {réseau}, le {date} » et la mention sous S22 | product-owner | oui |
| E02b-Q5 | Pastille « 93 » (deux premiers caractères de l'alias) contre `17` §7.1 règle 2 (aucun avatar, aucune initiale, aucune pastille stable) ; « Sur INFLUX depuis novembre 2026 » : non servi, date d'inscription exclue (`10` l. 344) | S17 | Garder alias et date des chiffres ; retirer pastille et ancienneté | product-owner | oui |
| E02b-Q6 | « Nouvelle sélection… » dans une liste déroulante, sans formulaire ; changer de liste quand le profil est déjà dans une autre | S37 | Choix = champ nom et « Créer la sélection » dans l'encadré ; l'état suit la liste choisie | expert-ux | oui |
| E02b-Q7 | Point de vigilance (RG42) absent de la maquette | Règle perdue | Ligne après S18, icône `circle-alert` | expert-ux | oui |
| E02b-Q8 | Sous 1024 px, l'encadré est masqué : choix de liste, phrase des coûts et demande de sélection disparaissent ; RG61 : permanente | Fonctions perdues sur téléphone | Reporter S37, S40, S41 en fin de page sous 1024 px | expert-ux | oui |
| E02b-Q9 | Région en nom (« Bruxelles-Capitale ») ; aucune liste de noms (EC-L3F-11-1, L3FU-6) | S10 | Liste de noms FR/EN, ou pays seul en attendant | architecte | non |
| E02b-Q10 | Exclusivité et contrepartie non monétaire servies, absentes de la maquette ; CA6 : mêmes champs que la carte | S34 | Deux lignes ajoutées à « Conditions » | expert-ux | oui |
| E02b-Q11 | Portée et engagement vérifié servis, absents de S24 (`07` RG48, RG113) | S24 | Les ajouter après les trois métriques | expert-matching | oui |
| E02b-Q12 | « Chiffres constatés par INFLUX le 22 novembre 2026 » : date du badge, pas du constat des chiffres ; date exacte dans une raison (RG41 règle 2 : vérifiable sur la page) | Texte S18 | Utiliser `figuresMeasuredAt` de la ligne | expert-matching | non |
