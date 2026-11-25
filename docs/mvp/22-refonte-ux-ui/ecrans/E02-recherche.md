# E02 — Recherche de créateurs (marque)
> Maquette : `proto-recherche.html` (états `resultats`, `chargement`, `vide` ; dialogue « Filtres », sans relevé : CSS du proto) · page de comparaison `ecran-2-recherche.html` · validée le 2026-11-23, version 2 (07) · Constats : U10, U11, U12, U18, U20, U55, U64

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E02.1 | Recherche de créateurs | `/fr/createurs` | `/en/creators` | `creator-search/CreatorSearchScreen.tsx` | resultats, chargement, vide, dialogue Filtres | XL | C28, C30, C31, C32, C56 ; E02b (cible du lien), E09 (compteur, sélection) |

Fichiers sous `apps/web/src/components/creator-search/` (chemin omis ensuite).

Fonctionnalités à préserver :
- Garde de rôle : tout autre rôle que `advertiser` reçoit `notFound()` (`CreatorSearchScreen.tsx:106-118`).
- Les critères vivent dans l'adresse : `F1 F3 F4 F6 F6s F8 F11 F17 sort campaign list page` ; valeur illisible ignorée (`creator-search-view.ts:74-189`).
- Une recherche par application ; une page déjà lue ne se redemande pas (`use-creator-search.ts`, `searchReducer` `:607`).
- Neuf états d'écran : `loading`, `closed`, `brand_not_published`, `too_narrow`, `results`, `rate_limited`, `page_cap`, `forbidden`, `failed` (`creator-search-view.ts:678-691`).
- Résultats gardés lisibles sous `rate_limited` et `failed`, sans pagination (`CreatorSearchScreen.tsx:544-624`).
- Élargissements statiques `WIDENING_ORDER`, sans décompte (`creator-search-view.ts:504-528`).
- Focus rendu à la tranche, à défaut à la tête des résultats (`use-results-focus.ts`).
- Campagnes proposées : `pending_review`, `published`, `paused`, `closed` (`use-search-sources.ts:62-68`).
- Première sélection créée à l'ajout sous le nom « Ma sélection » (`use-shortlists.ts`, `add`).
- Hors ligne : `Notice` `account.offline` en tête de page.

API appelée (relais `callRelay`) : `POST /v1/creator-search` ; `GET /v1/creator-search/profiles/:alias/visuals/:visualId` ; `GET /v1/me/brand-profile` (références) ; `GET /v1/me/campaigns` ; `GET /v1/me/shortlists`, `GET /v1/me/shortlists/:id`, `POST /v1/me/shortlists`, `PUT` et `DELETE /v1/me/shortlists/:id/items/:alias`. Contrats : `packages/contracts/src/creator-search.ts`, `shortlists.ts`.

## 2. Structure

Cadre : coquille C56 (spécifiée ailleurs), sous-entrée courante « Recherche ». Contenu C01 : `container-max`, gouttière `spacing-page-gutter`, écart entre zones `spacing-6` (32 px).

| Zone, dans l'ordre | 1440 | 1280 | 768 | 375 |
|---|---|---|---|---|
| Contenu (x, largeur) | 304, 1088 | 299,2, 937,6 | 27,8, 712,4 | 16, 343 |
| 1. En-tête (haut du contenu) | y 48, h 44 | y 44,4, h 44 | y 96,8, h 27,6 | y 88, h 27,6 |
| 2. Ligne de filtres | y 124, h 44 (pastilles 40 + 4) | y 120,4 | y 156,4 | y 147,6 |
| 3. Bandeau du résultat | y 200, h 54,5 | y 196,4, h 54,5 | y 232,4, h 54,5 | y 223,6, h 113 |
| 4. Grille | y 278,5 ; 3 col. de 346,7 | y 274,9 ; 3 col. de 296,5 | y 310,9 ; 2 col. de 344,2 | y 360,6 ; 1 col. de 343 |
| 5. Pied de liste | h 46,8 | h 46,8 | h 46,8 | h 46,8 |
| 6. Barre « Ma sélection » | absente | absente | fixe, y 915, h 53 | fixe, y 703, h 53 |

- Zones 3 à 5 : une `section`, écart `spacing-5` (24 px).
- Grille : `repeat(auto-fill, minmax(18rem, 1fr))`, écart `spacing-6` (rangées 32 px) et `spacing-5` (colonnes 24 px).
- Carte : 346,7 × 394,5 (1440), 296,5 × 356,9 (1280), 344,2 × 392,6 (768), 343 × 391,7 (375). Photo 4:3 (346,7 × 260), puis `spacing-3` (12 px), puis corps de 122,5 px.
- Ligne de filtres : une seule ligne, défilement horizontal, barre masquée, écart `spacing-2`. À 1280 elle déborde (dernière pastille à x 1103,9 + 158 pour une limite à 1236,8).
- Barre « Ma sélection » (< 1024 px) : fixe au-dessus de la barre du bas (`bottom: size-nav-bottom-height`), `surface-raised`, filet haut `border-default` ; `main` gagne 3,75 rem de marge basse en plus de la barre du bas.
- Dialogue « Filtres » : largeur `min(42rem, 100vw - 2 gouttières)`, hauteur max `85dvh`, tête et pied fixes, corps défilant ; sous 768 px, plein écran (`100vw` × `100dvh`, rayon 0).

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E02.1-S01 | En-tête | C02 | `h1` « Créateurs », `text-title-page` (28 px dès 1024, 24 px en dessous), Manrope 800, `tabindex=-1` | toujours | resultats `.t-page` | E02.1-CA01 | E02.1-T10 |
| E02.1-S02 | En-tête | C11 | Lien « Demander une sélection à l'équipe INFLUX », icône `sparkles` 16 px, à droite, hauteur 44 | dès 1024 px, tous les états (RG61) | resultats `.go.lg-only` | E02.1-CA02 | E02.1-T01 |
| E02.1-S03 | Filtres | C30 | Groupe `role=group` « Critères de recherche » | toujours | `.fbar` | E02.1-CA03 | E02.1-T10 |
| E02.1-S04 | Filtres | C30 | Pastille « Filtres » : icône `sliders-horizontal`, pastille de compte 20 px (`counter-bg`) ; 122,2 × 40 | toujours ; compte masqué à 0 | `.pill` `.count-dot` | E02.1-CA04 | E02.1-T02 |
| E02.1-S05 | Filtres | C30 | Séparateur 1 × 24 px, `border-default`, masqué aux lecteurs | toujours | `.fbar__sep` | E02.1-CA03 | E02.1-T10 |
| E02.1-S06 | Filtres | C30 | Pastille de critère actif : libellé, bouton « x » ; contour `text-primary`, fond `surface-active`, 600 | un critère appliqué | `.pill.is-active` | E02.1-CA05 | E02.1-T02 |
| E02.1-S07 | Filtres | C30 | Bouton « x » 24 px, nom « Retirer le critère : {critère} » | dans S06 | `.pill .x` | E02.1-CA05 | E02.1-T02 |
| E02.1-S08 | Filtres | C30 | Pastille « Thématique », chevron bas ; 129,1 × 40 | toujours | `.pill` 2 | E02.1-CA06 | E02.1-T02 |
| E02.1-S09 | Filtres | C30 | Pastille « Réseaux », chevron bas ; 106,3 × 40 | toujours | `.pill` 3 | E02.1-CA06 | E02.1-T02 |
| E02.1-S10 | Filtres | C30 | Pastille « Tranche d'audience », chevron bas ; 172,6 × 40 | toujours | `.pill` 4 | E02.1-CA06 | E02.1-T02 |
| E02.1-S11 | Filtres | C30 | Pastille à bascule « Audience vérifiée », icône `badge-check`, `aria-pressed` ; active = même apparence que S06 | toujours | `.pill[data-toggle]` | E02.1-CA07 | E02.1-T02 |
| E02.1-S12 | Bandeau | C02 | Tranche du nombre, `text-md` Manrope 700 | états avec résultats ; absente en `vide` | `#r-band` | E02.1-CA08 | E02.1-T03 |
| E02.1-S13 | Bandeau | C30 | « Liée à » + liste compacte sans cadre (161 px), valeur 600, chevron | toujours | `.inline-select` 1 | E02.1-CA09 | E02.1-T02 |
| E02.1-S14 | Bandeau | C30 | « Tri » + liste compacte (138 px), quatre choix | toujours | `.inline-select` 2 | E02.1-CA10 | E02.1-T03 |
| E02.1-S15 | Bandeau | C30 | Icône `info` 16 px et « Ce n'est pas un score », `text-sm` secondaire | toujours | `.rhead__ctx > span` | E02.1-CA10 | E02.1-T11 |
| E02.1-S16 | Bandeau | C16 | Lien « Ma sélection privée », cœur, compteur | dès 1024 px | `.selmini` | E02.1-CA11 | E02.1-T04 |
| E02.1-S17 | Grille | C31 | Liste de cartes, nom « Résultats de la recherche » ; carte sans cadre | `resultats` | `#grid .pc` | E02.1-CA12 | E02.1-T03 |
| E02.1-S18 | Carte | C31 | Photo 4:3, `radius-card` 16 px, fond `surface-raised`, carrousel horizontal `scroll-snap` | au moins un visuel | `.ph` `.ph__track` | E02.1-CA13 | E02.1-T05 |
| E02.1-S19 | Carte | C31 | Un badge au plus, 12 px du coin haut gauche, pilule `surface-inverse` (variante sombre : « Nouveau profil ») ; h 26,6 | voir E02-Q6 | `.ph__badge` | E02.1-CA14 | E02.1-T03 |
| E02.1-S20 | Carte | C31 | Cœur 44 × 44, icône 26 px, coin haut droit ; plein blanc si retenu, `aria-pressed` | sélections lisibles | `.heart` | E02.1-CA15 | E02.1-T04 |
| E02.1-S21 | Carte | C31 | Flèches 32 px, fondu 120 ms au survol et au focus ; première et dernière masquées aux bornes | pointeur fin, plusieurs visuels | `.ph__nav` | E02.1-CA13 | E02.1-T05 |
| E02.1-S22 | Carte | C31 | Points 6 px, actif 16 px, 12 px du bas, décoratifs | plusieurs visuels | `.ph__dots` | E02.1-CA13 | E02.1-T05 |
| E02.1-S23 | Carte | C31 | Alias « Profil {alias} », Manrope 700 16 px, lien étiré vers E02b.1 | toujours | `.pc__l1 a` | E02.1-CA16 | E02.1-T03 |
| E02.1-S24 | Carte | C31 | Icône `badge-check` 20 px bleue à droite, « Profil vérifié » | voir X2 | `.vf` | E02.1-CA17 | E02.1-T11 |
| E02.1-S25 | Carte | C31 | Titre court, `text-sm`, une ligne coupée | titre servi | `.clamp2` | E02.1-CA16 | E02.1-T10 |
| E02.1-S26 | Carte | C31 | Thématiques et pays, séparés par « · », `text-sm` secondaire | valeurs servies | `.sm.c2` | E02.1-CA16 | E02.1-T03 |
| E02.1-S27 | Carte | C31 | « {réseau principal} · {tranche} abonnés », tranche Manrope | réseau principal listé | `.pc__aud` | E02.1-CA18 | E02.1-T03 |
| E02.1-S28 | Carte | C31 | « Proposé car {raisons} », `text-xs` tertiaire, une ligne coupée, préfixe secondaire 600 | toujours (2 à 4 raisons) | `.pc__why` | E02.1-CA19 | E02.1-T03 |
| E02.1-S29 | Pied | C32 | Rang de page à gauche, « Page suivante » + chevron à droite, `role=group` « Pages de résultats » | une page voisine existe | `.pager` | E02.1-CA20 | E02.1-T03 |
| E02.1-S30 | Chargement | C09 | Cartes squelettes : bloc 4:3 puis lignes de 14 px à 55, 85 et 65 % ; `aria-busy` | `chargement` | `.sk .skel` | E02.1-CA21 | E02.1-T06 |
| E02.1-S31 | Chargement | C29 | « Recherche en cours… », masqué visuellement | `chargement` | `.sr-only` | E02.1-CA21 | E02.1-T06 |
| E02.1-S32 | Vide | C08 | Sans cadre, max 40 rem : icône `search` 24 px, `h2` 20 px, phrase, actions | `too_narrow` | vide `.empty-state` | E02.1-CA22 | E02.1-T07 |
| E02.1-S33 | Vide | C10 | Bouton secondaire « Retirer la part d'audience » | un par élargissement | vide `.btn--secondary` | E02.1-CA22 | E02.1-T07 |
| E02.1-S34 | Vide | C11 | Lien « Demander une sélection », `text-sm` | `too_narrow` | vide `.link` | E02.1-CA02 | E02.1-T07 |
| E02.1-S35 | Téléphone | C39 | Barre fixe : cœur, « Ma sélection », compteur, lien « Demander une sélection », bouton secondaire « Voir » (79,3 × 36) | moins de 1024 px | `.selbar` | E02.1-CA23 | E02.1-T04 |
| E02.1-S36 | Dialogue | C28 | Tête : fermer (`x`, 44 px) à gauche, titre centré « Filtres », filet bas | dialogue ouvert | `.fdlg__head` | E02.1-CA24 | E02.1-T08 |
| E02.1-S37 | Dialogue | C28 | Phrase d'anonymat, `text-sm` secondaire | dialogue ouvert | `.fdlg__body > p` | E02.1-CA24 | E02.1-T08 |
| E02.1-S38 | Dialogue | C18 | F1 « Thématique principale », une liste, max 22 rem, premier choix « Toutes » | dialogue ouvert | `.fgroup` 1 | E02.1-CA25 | E02.1-T08 |
| E02.1-S39 | Dialogue | C21 | F3 « Réseaux », cases en ligne | dialogue ouvert | `.fgroup` 2 | E02.1-CA25 | E02.1-T08 |
| E02.1-S40 | Dialogue | C21 | F4 « Tranche d'audience », cases en ligne | dialogue ouvert | `.fgroup` 3 | E02.1-CA25 | E02.1-T08 |
| E02.1-S41 | Dialogue | C18 | F6 « Pays d'audience » : liste du pays et liste de la part, côte à côte, max 18 rem chacune | dialogue ouvert | `.fgroup` 4 | E02.1-CA25 | E02.1-T08 |
| E02.1-S42 | Dialogue | C21 | F8 « Langues de publication », cases | dialogue ouvert | `.fgroup` 5 | E02.1-CA25 | E02.1-T08 |
| E02.1-S43 | Dialogue | C21 | F11 « Formats », cases | dialogue ouvert | `.fgroup` 6 | E02.1-CA25 | E02.1-T08 |
| E02.1-S44 | Dialogue | C21 | F17 « Badges », deux cases | dialogue ouvert | `.fgroup` 7 | E02.1-CA25 | E02.1-T08 |
| E02.1-S45 | Dialogue | C10 | Pied : bouton texte « Tout effacer » à gauche, principal « Voir les résultats » à droite, filet haut | dialogue ouvert | `.fdlg__foot` | E02.1-CA26 | E02.1-T08 |
| E02.1-S46 | Annonces | C29 | Région `role=status` polie unique | toujours | `#announcer` | E02.1-CA27 | E02.1-T04 |

## 4. Textes

Table complète : `E02-recherche-textes.md`.

## 5. Interactions, états, responsive, clavier

Interactions :
- S04, S08, S09, S10 : ouvrent le dialogue ; le focus revient au déclencheur à la fermeture (`proto.js`). La maquette ouvre le même dialogue entier, sans cibler le groupe (E02-Q11).
- S45 « Voir les résultats » : ferme le dialogue → `router.replace` avec les critères, page 1 → `chargement` → annonce de la tranche. Focus : règle `use-results-focus.ts`.
- S45 « Tout effacer » : la maquette n'a pas de comportement ; actuel préservé : vide et applique (`CreatorSearchScreen.tsx:235`).
- Fermeture sans valider (croix, Échap, clic sur le voile) : brouillon abandonné, aucune recherche.
- S07 : `withoutCriterion` puis une recherche (existant).
- S11 : bascule `F17: audience_verified` et lance une recherche (E02-Q2).
- S13, S14 : changement = nouvelle recherche, page 1 (existant).
- S20 : `add` ou `drop` sur la sélection active ; rien n'est montré avant la réponse ; puis remplissage, compteurs, éclair du fond (320 ms) et annonce. Refus : `shortlist.refusal.*` par C29 et message visible ; le cœur ne change pas. Aucune notification au créateur (RG51, CA52).
- S23 : `profileHref(alias, place)` : l'adresse garde critères, page et `list`.
- S16, S35 « Voir » : destination non montrée (E02-Q10).
- S29 : « Page précédente » dès la page 2 (absente de la maquette, existante) ; « Page suivante » si `nextPage`.

États :

| État | Maquette | Représentation |
|---|---|---|
| Chargement | `chargement` | Squelettes ; nombre : E02-Q13 |
| Sous le seuil (0 à 4, même écran, RG58) | `vide` | Aucune tranche, aucun décompte ; un bouton par élargissement servi (`wideningsOf`) |
| Fermé (D38, CA59) | non montré | Actuel `:469-478`. Proposé : zones 1 à 3 gardées (critères saisissables), sans tranche ; C08 avec `closed.title`, `closed.notice` et le bouton principal `request.link` ; ni grille ni pied |
| Marque non publiée | non montré | Actuel `:479-495`. Proposé : C08, `brandProfile.search.blockedUntilPublished`, lien `notPublished.action` |
| Plafond 429 | non montré | Actuel `:544-574`. Proposé : C17 alerte (`rateLimited.*`) au-dessus de la grille gardée, sans pied ; bouton principal `request.link` |
| Page au-delà du plafond | non montré | Actuel `:575-585`. Proposé : C17 info et C10 `results.backToFirst` |
| Plafond de résultats atteint | non montré | Actuel `:680-682`. Proposé : C17 info `results.capReached` avant le pied |
| Plus de profils sur la page | non montré | Actuel `:652-664`. Proposé : C08 `results.endOfResults` |
| Campagne refusée | non montré | Actuel `:586-599`. Proposé : C17 erreur et `forbidden.action` |
| Erreur | non montré | Actuel `:600-624`. Proposé : C17 erreur, `failed.retry`, grille gardée |
| Hors ligne | non montré | Actuel `:202`, préservé |
| Références non chargées | non montré | Actuel `SearchFiltersForm.tsx:205-212`. Proposé : C17 en tête du corps du dialogue |
| Campagnes non chargées | non montré | Actuel `CampaignControl` : aide `campaign.failed` sous la liste |
| Sélections non lues | non montré | Actuel : cœur absent (`AddToSelectionButton.tsx:27`) ; `panel.failed` + `panel.retry` à placer dans S16/S35 |
| Carte sans visuel | non montré | Actuel : pas d'image (RG84). Proposé : photo `surface-raised` vide, sans texte |
| Point de vigilance (RG42) | non montré | Obligatoire quand servi (E02-Q5) |

Responsive : 1440 et 1280, trois colonnes, colonne de navigation ; 768, deux colonnes, barre fixe, S02 et S16 masqués ; 375, une colonne, bandeau sur trois lignes, dialogue plein écran.

Clavier et focus : ordre S01, S02, S04 à S11, S13 à S16, cartes (flèches, cœur, lien), pied. Dialogue natif modal : focus piégé, Échap ferme. Anneau sur la carte entière quand l'alias a le focus (`.pc:has(...)`). Carrousel : X8.

Animations propres : cœur `scale` 1,2 puis 1, `duration-base` (200 ms), `ease-standard` ; remplissage `duration-fast` (120 ms) ; pression `scale` 0,9 ; flèches `opacity` 120 ms ; points `width`, `opacity` 120 ms ; pastille `border-color`, fond 120 ms ; dialogue 200 ms à l'ouverture, 120 ms à la fermeture. Rien sous mouvement réduit ; carrousel instantané.

## 6. Critères d'acceptation

- **E02.1-CA01** Le `h1` mesure 28 px dès 1024 px, 24 px en dessous ; il commence à x 304 à 1440 px.
- **E02.1-CA02** Un lien vers la demande de sélection est présent dans chacun des neuf états et à chaque largeur (RG61).
- **E02.1-CA03** La ligne de filtres tient sur une ligne de 44 px à toute largeur ; la page ne défile pas horizontalement à 375, 768, 1280, 1440.
- **E02.1-CA04** Le compte de « Filtres » égale `criteriaCountOf` ; aucun compte à zéro.
- **E02.1-CA05** Chaque critère appliqué a une pastille retirable, atteignable au clavier, et son retrait relance la recherche à la page 1.
- **E02.1-CA06** Les trois pastilles à liste ouvrent le dialogue ; la fermeture rend le focus à la pastille.
- **E02.1-CA07** « Audience vérifiée » expose `aria-pressed` conforme à l'adresse.
- **E02.1-CA08** Le nombre n'apparaît qu'en tranche, jamais en valeur exacte ni en nombre de pages (RG59).
- **E02.1-CA09** « Liée à » propose seulement les campagnes admises et garde une campagne inconnue de la liste.
- **E02.1-CA10** Le tri actif est nommé ; son explication complète est lisible sans souris et décrit la liste (`aria-describedby`).
- **E02.1-CA11** Le compteur de sélection égale `active.count` et change après la réponse de l'API.
- **E02.1-CA12** Trois colonnes à 1440 et 1280, deux à 768, une à 375 ; écarts 32 et 24 px.
- **E02.1-CA13** Photo 4:3, rayon 16 px ; le carrousel est atteignable au clavier ; aucun visuel hors de la projection n'est demandé.
- **E02.1-CA14** Une carte porte zéro ou un badge de photo.
- **E02.1-CA15** Le cœur fait au moins 44 × 44, porte l'alias dans son nom et se remplit de blanc, jamais de vert.
- **E02.1-CA16** Toute la carte hors photo mène au profil ; le focus se voit autour de la carte.
- **E02.1-CA17** Aucun badge n'est porté par une icône seule sans texte accessible et sans la décision de X2.
- **E02.1-CA18** La tranche d'abonnés vient de `audienceBand` ; aucun chiffre exact, pseudo, URL, montant ni score dans le DOM ni la réponse.
- **E02.1-CA19** Le texte complet de « Proposé car » reste dans l'arbre d'accessibilité quand il est coupé.
- **E02.1-CA20** Le pied offre page précédente et suivante, sans total, et n'est pas un second `nav` (U55).
- **E02.1-CA21** Les squelettes ont la taille des cartes : aucun saut de mise en page à l'arrivée des résultats.
- **E02.1-CA22** L'écran sous le seuil est identique pour 0 et 4 résultats, sans tranche ni carte ; les élargissements suivent `WIDENING_ORDER`.
- **E02.1-CA23** À 375 px, aucun texte de la barre fixe n'en recouvre un autre, en FR et en EN.
- **E02.1-CA24** Le dialogue est modal, nommé « Filtres », plein écran sous 768 px, et Échap le ferme sans recherche.
- **E02.1-CA25** Les choix de chaque facette sont exactement les codes actifs de l'API : F4 cinq tranches, F6s trois tranches, F17 deux badges.
- **E02.1-CA26** Une seule recherche part par validation du dialogue.
- **E02.1-CA27** Ajout, retrait, refus et nouvelle tranche sont annoncés une fois par la région unique.
- **E02.1-CA28** Chaque texte existe en FR et en EN, aucun en dur ; mêmes clés dans les deux fichiers.
- **E02.1-CA29** Fermé (CA59) : critères utilisables, aucune carte, aucune tranche.
- **E02.1-CA30** Les attributs `data-*` listés en §7 existent toujours.

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E02.1-T01 | e2e | `apps/web/e2e/brand-creator-search.spec.ts` (à adapter, ligne 39) | Fermé : critères et demande gardés, 375 px FR |
| E02.1-T02 | e2e | même fichier (ligne 114) | Dialogue, pastilles, campagne, adresse |
| E02.1-T03 | e2e | même fichier (ligne 114) | Cartes, raisons, tri, pages, rien d'identifiant, EN 1440 |
| E02.1-T04 | e2e | `apps/web/e2e/brand-creator-shortlists.spec.ts` (lignes 148 et suivantes) | Cœur, compteur, barre fixe, annonce |
| E02.1-T05 | e2e | `brand-creator-search.spec.ts` (nouveau cas) | Carrousel clavier et tactile |
| E02.1-T06 | visuel | nouveau `brand-creator-search.visual.spec.ts` | Squelettes sans décalage |
| E02.1-T07 | e2e | `brand-creator-search.spec.ts` (ligne 73) | 0 et 4 identiques, élargissements |
| E02.1-T08 | e2e | `brand-creator-search.spec.ts` (nouveau cas) | Facettes du dialogue contre le contrat |
| E02.1-T09 | unitaire | `apps/web/tests/creator-search-view.test.ts` (à adapter) | Adresse, critères, états, libellés FR/EN, mots interdits |
| E02.1-T10 | visuel | nouveau `brand-creator-search.visual.spec.ts` | Mesures à 375, 768, 1280, 1440 |
| E02.1-T11 | a11y | `brand-creator-search.spec.ts` (`expectNoAxeViolation`) | Aucune violation axe, dont X8 et X11 |

Sélecteurs attendus : `data-search-card`, `data-count-band`, `data-criterion`, `data-state`, `data-widen`, `data-reasons`, `data-vigilance`, `data-open-profile`, `data-add-to-selection`, `data-held`, `data-selection-panel`, `data-selection-member`, `data-selection-toggle`, `data-selection-failure`, `data-shortlists-link`, `data-page`, `data-results-start`, `data-sort-explain`, `data-action-bar`, `data-visual`. Les tests de `data-selection-member` et `data-selection-toggle` visent un panneau supprimé : à réécrire.

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Adresse, requête, états, élargissements | `creator-search-view.ts` | inchangé | réutiliser |
| Colonne de filtres, bouton « Filtres » | `SearchFiltersForm.tsx:195-283`, `creator-search-classes.ts:23-29` | C30 + C28 | faire évoluer (le brouillon passe dans le dialogue) |
| Critères actifs | `CreatorSearchScreen.tsx:254-278` | pastilles S06 | faire évoluer |
| Carte de résultat | `ResultCard`, `CreatorCardView.tsx` | C31 | créer (`CreatorCardView` reste pour E15 et l'aperçu tant que non remplacé) |
| Visuels de carte | `CARD_VISUALS_SHOWN = 1` (`creator-search-view.ts:50`) | carrousel | faire évoluer (E02-Q7) |
| Ajout | `AddToSelectionButton.tsx` | cœur S20 | faire évoluer |
| Panneau « Ma sélection » | `SelectionPanel.tsx` | S16, S35 | supprimer ; choix de liste et création : E02-Q10 |
| Explication du tri | `details` (`CreatorSearchScreen.tsx:397-407`) | S15 | faire évoluer |
| Pagination `nav` | `CreatorSearchScreen.tsx:685-711` | C32 | faire évoluer |
| États en carte | `Card` | C08, C17 | faire évoluer |
| Squelettes 6 × 16 rem | `SEARCH_SKELETON_CLASSES` | C09 | faire évoluer |
| Lien « Mes sélections » sous `lg` | `ShortlistsLink.tsx` | S35 « Voir » | supprimer, attribut reporté |

Données requises :

| Donnée affichée par la maquette | Servie aujourd'hui ? | Écart |
|---|---|---|
| Alias, titre, thématiques, pays | oui, `creatorProjectionBeforeSchema` (`creator-projection.ts:73-97`) | aucun |
| Tranche du réseau principal | oui, `networks[].audienceBand`, `isPrimary` | libellé court absent (E02-Q4) |
| Badge de photo « Audience vérifiée », « Disponible » | oui, `networks[].badges`, `availability` | priorité non définie |
| « Nouveau profil » | en partie : `vigilance = recent_profile`, une seule note par carte | E02-Q6 |
| Jusqu'à 3 visuels | oui (8 au plus servis) ; image par `GET …/visuals/:visualId`, 240 par minute et adresse (`member-rate.ts:34`) | 36 lectures par page au lieu de 12 |
| Facettes | F1, F3, F4, F6 + part, F8, F11, F17 : toutes dans `creatorSearchFiltersSchema` | part d'audience fausse (E02-Q3) |
| Nombre de pages | non, jamais (RG59) | E02-Q1 |
| Nombre de la sélection | oui, `shortlistSummary.count` | aucun |

Hors lot : « Demander une mise en relation » (Lot 4).

## 9. Contradictions, manques et décisions

Transverses : X1 à X4, X7, X8, X10, X11, X13. X11 vise ici `.selbar` et `.m-state`.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E02-Q1 | Maquette « Page 1 sur 2 » ; `17` §4.4 (EC-L3F-10) et RG59 : le total de pages dit le nombre ; l'API n'en sert pas | Texte non réalisable | « Page {page} » | product-owner | non |
| E02-Q2 | Pastille à bascule appliquée au clic ; `17` §4.4 : « aucun critère ne lance la sienne » (seau de 30 recherches par heure) | Comportement de S11 | Appliquer au clic : un retrait de critère le fait déjà | product-owner | oui |
| E02-Q3 | Part d'audience : « 10 % et plus », « 30 % et plus », une liste à choix unique ; API : `ge_80`, `50_80`, `lt_50`, choix multiple (`packages/contracts/src/creator-search.ts:59`) ; raisons « 30 à 50 % », « 10 à 30 % » inexistantes | Filtre et raisons irréalisables tels quels | Trois tranches de F6 en cases, visibles si un pays est choisi ; libellés `preview.share.*` ; « Tous » ajouté au pays | expert-matching | oui |
| E02-Q4 | « 1–10 k », « 10–50 k », « 50–500 k abonnés » : aucune clé courte ; « nano » = moins de 10 000, sans plancher ; macro et méga non montrées | Libellés de S27 | Clés courtes par tranche : moins de 10 k, 10–50 k, 50–500 k, 500 k–1 M, 1 M et plus | expert-matching | oui |
| E02-Q5 | Le point de vigilance (RG42, `17` §7.1 règle 8, « affiché quand il est vrai ») n'a pas de place dans la carte | Perte d'une règle | Une ligne sous « Proposé car », icône `circle-alert` et texte | expert-ux | oui |
| E02-Q6 | Badge de photo : sources et priorité non définies ; « Nouveau profil » contre RG45.2 « Profil récent » ; `recent_profile` peut être masqué par une autre note | S19 | Priorité : audience vérifiée du réseau principal, puis `lt_2w`, puis `recent_profile` | expert-matching | oui |
| E02-Q7 | Carrousel de 3 visuels ; `10` RG50 et `17` §7.1 règle 6 : un visuel sur la carte, trois sur le profil | Règle à amender ; triple des lectures d'images | Amender RG50 (3 sur la carte), charger le 2e et le 3e au premier geste | product-owner | oui |
| E02-Q8 | RG47 et `17` §7.1 règles 3 et 9 : date et source de chaque chiffre, trois métriques D61, badges datés ; la carte ne montre que la tranche d'abonnés, sans date | Carte moins riche que RG47 | Amender RG47 : carte résumée, tout sur E02b.1 ; date en texte accessible | product-owner | oui |
| E02-Q9 | Visuels nommés (« Visuel 1 sur 3… ») contre `17` l. 2066 : `alt=""`, légende adjacente | Nom accessible | Garder `alt=""` quand l'alias est lu par la carte ; nommer seulement la région du carrousel | expert-ux | non |
| E02-Q10 | Choix de la sélection active et création retirés ; destination de « Ma sélection privée » et de « Voir » non montrée ; état à zéro sélection non montré | Plusieurs listes : où va le cœur ? | Lien vers la sélection active (E09.2), vers « Mes sélections » sans liste ; la liste active se choisit sur E02b.1 | expert-ux | oui |
| E02-Q11 | Les trois pastilles ouvrent le dialogue entier ; une fois le critère actif, la pastille rapide reste-t-elle ? | Doublon possible | Focus sur le groupe visé ; la pastille reste | expert-ux | non |
| E02-Q12 | `filters.noFreeText` disparaît ; `page.explain` passe dans le dialogue | Clé orpheline ; `17` §4.4 demande la phrase à l'écran | Accepter (dialogue) | product-owner | non |
| E02-Q13 | Quatre squelettes ; `17` §4.4 : six | Détail | Six | expert-ux | non |
| E02-Q14 | À 375 px le compteur (x 121) est recouvert par le lien (x 121,9) : capture `vide-375` | Défaut de la maquette | Lien raccourci ou sur deux lignes, hauteur gardée | expert-ux | oui |
| E02-Q15 | « Ce n'est pas un score » porte son explication dans un `title` : ni tactile ni clavier ; `17` §4.4 veut un `[i]` | Accessibilité | Bouton C26 au même endroit, texte `sort.explain` | expert-ux | non |
| E02-Q16 | Retrait d'un critère : cible de 24 × 24 px, sous `size-touch-target` (44) | Cible tactile | Zone de frappe élargie à toute la hauteur de la pastille | expert-ux | non |
