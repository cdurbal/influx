# E13 — Recherche identifiée de créateurs (commercial, administrateur)
> Maquette : `proto-bo-recherche.html` (états prerempli, libre, vide, chargement ; lot4 hors lot) · page de comparaison `ecran-13-bo-recherche.html` · validée le 2026-11-24 (07) · Constats : U06, U42.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E13.1 | Recherche identifiée | `/createurs/recherche` (`?campagne={id}`) | aucune (D36) | `IdentifiedSearchScreen.tsx`, `IdentifiedFacets.tsx`, `IdentifiedResults.tsx`, `BoIdentifiedFrame.tsx` | prerempli, libre, vide, chargement | XL | C57, C62, C31 et C28 de E02 ; lectures nouvelles (E13-Q01, Q02) ; E06.2, E17 |

Fonctionnalités à préserver :
- Campagne d'origine dans l'adresse, pré-remplissage lu une fois, lien gardé après « Vider » (CA56) : `IdentifiedSearchScreen.tsx:60-176`, `identified-search-view.ts:391`, `:520`.
- Une requête par état (filtres, tri, page) ; réponse périmée ignorée ; focus sur le nombre après un geste : `:122-171`, `IdentifiedResults.tsx:301-307`.
- Facettes F1, F3, F4, F6 (un pays et ses parts), F8, F11, F17, G1, G2, G9 (pays), G10 : `IdentifiedFacets.tsx:153-212`. Puces retirables : `IdentifiedResults.tsx:51-81`.
- Trois facettes à élargir, sinon « retirez une facette », sinon « aucune facette » : `identified-search-view.ts:482-520`.
- Nom légal, alias, tous les réseaux et pseudos, lien externe filtré (`safeProfileUrl`), badges et « à renouveler », état en mots, responsable, raisons, vigilance, valeurs exactes : `rowViewOf`, `:742`.
- Paire bloquée : une phrase, jamais le motif ni l'auteur (RG71) : `IdentifiedResults.tsx:179-183`. Compte exact, plafond de pages, pages : `:310-433`. Erreurs en clair : `failureWords`, `:801`.
- Ni export, ni case, ni défilement infini, ni tarif (RG76, D78).

API appelée : `POST /v1/bo/creator-search` (journalise chaque recherche, RG78), `POST /v1/bo/campaigns/:id/creator-prefill` (journalise la proposition).

## 2. Structure
Cadre C57, rail : Créateurs en ancêtre, « Recherche » courante. Zone `bo-main` C01 (gouttière 48 px à 1440, 43 à 1280, 28 à 768), écart 24 px.

Ordre exact :
1. Fil d'Ariane (21,7 px), hors du cadre identifié.
2. `.idz` (C62) jusqu'au bas de la page : barre gauche 4 px `bo-identified-accent`, `padding-left: spacing-5` (24 px), écart `spacing-5`. Contient tout le reste.
3. Chapeau `.idz__hat` : `radius-md`, fond `bo-identified-bg`, `padding: spacing-3 spacing-4`, 45,7 px à 1440 (67 à 1280, 89 à 768).
4. `h1` « Créateurs » et symbole ▮ (32 px de ligne).
5. Ligne de filtres C30 : pastilles de 36 px, écart 8 px, séparateurs 1 × 24 px, retour à la ligne (80 px sur deux lignes à 1440, 168 à 768).
6. Bloc de résultats, écart 24 px : tête (nombre `t-card`, puis contexte : Liée à, Vider, Tri, note) ; notice éventuelle ; grille ; pied ; phrase.

Grille : `repeat(auto-fill, minmax(18rem, 1fr))`, écart `spacing-6` vertical (32 px), `spacing-5` horizontal (24 px). 1440 : 3 × 342,7 px ; 1280 : 3 × 292,5 ; 768 : 1 × 444,4. Photo 4:3 (257 px à 1440), `radius-card`. Corps de carte : écart 2 px, 12 px sous la photo. Aucune zone collante ni fixe (la barre collante est du Lot 4).

La maquette n'a pas la classe `bo` : tailles 16 px et boutons de 46,8 px, au lieu de 14 px et 28 px ailleurs (E13-Q11).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E13.1-S01 | En-tête | C57 | Fil d'Ariane : Créateurs, Recherche (`aria-current`) | Toujours | prerempli, `.crumbs` | E13.1-CA01 | E13.1-T01 |
| E13.1-S02 | Cadre | C62 | Barre 4 px sur toute la zone, `data-identified-bar`, `data-identified-frame` conservés | Toujours, tous états | prerempli, `.idz` | E13.1-CA01 | E13.1-T01 |
| E13.1-S03 | Cadre | C62 | Chapeau : œil, « Vue identifiée » capitales accent, phrase `text-sm` | Toujours | prerempli, `.idz__hat` | E13.1-CA01 | E13.1-T01 |
| E13.1-S04 | En-tête | C02 | `h1` « Créateurs » et ▮ décoratif ; équivalent dans le chapeau | Toujours | prerempli, `h1` | E13.1-CA01 | E13.1-T01 |
| E13.1-S05 | Filtres | C30 | Pastille « Filtres », icône curseurs, compteur rond 20 px (nombre de critères) ; ouvre S24 | Toujours ; compteur masqué à 0 | prerempli, `.pill` 1 | E13.1-CA02 | E13.1-T02 |
| E13.1-S06 | Filtres | C30 | Critères actifs : pastille remplie, bord `text-primary`, texte « Facette : valeurs », croix 24 × 24 px | Un par facette appliquée | prerempli, `.pill.is-active` | E13.1-CA02 | E13.1-T02 |
| E13.1-S07 | Filtres | C30 | Pastilles vides « Thématique », « Réseaux », « Tranche d'audience » | Aucun critère actif | libre, `.pill` | E13.1-CA02 | E13.1-T02 |
| E13.1-S08 | Filtres | C30 | Libellé « Internes », capitales `text-xs` tertiaire | Toujours | prerempli, `.fbar__lbl` | E13.1-CA03 | E13.1-T02 |
| E13.1-S09 | Filtres | C30 | Pastille « État du profil : {valeurs} » | Toujours ; « tous » si vide | prerempli, `.fbar` | E13.1-CA03 | E13.1-T02 |
| E13.1-S10 | Filtres | C30 | Pastille « Responsable : {valeurs} » | Toujours ; G8 à ajouter à l'écran (E13-Q03) | prerempli, `.fbar` | E13.1-CA03 | E13.1-T02 |
| E13.1-S11 | Tête | C32 | Nombre exact `t-card` ; garde `data-result-count`, focalisable | Selon l'état | prerempli, `#r-count` | E13.1-CA04 | E13.1-T01 |
| E13.1-S12 | Tête | C30 | Liste en ligne « Liée à » : campagnes, « aucune campagne » ; 254 px | Toujours ; liste non servie (E13-Q02) | prerempli, `#camp` | E13.1-CA05 | E13.1-T03 |
| E13.1-S13 | Tête | C11 | « Vider le pré-remplissage », lien souligné | Campagne liée et pré-remplissage non vidé | prerempli, `#unfill` | E13.1-CA05 | E13.1-T03 |
| E13.1-S14 | Tête | C30 | Liste en ligne « Tri », quatre choix | Toujours | prerempli, `select` | E13.1-CA04 | E13.1-T01 |
| E13.1-S15 | Tête | C11 | « Ce n'est pas un score », icône info | Toujours | prerempli, `.rhead__ctx` | E13.1-CA04 | E13.1-T01 |
| E13.1-S16 | Résultats | C17 | Notice warning « Aucune campagne sélectionnée… » | Aucune campagne liée | libre, `.notice` | E13.1-CA05 | E13.1-T03 |
| E13.1-S17 | Carte | C31 | Photo 4:3, trois visuels, flèches rondes 32 px au survol ou au focus, points 6 px (actif 16) | Chaque créateur ; visuels non servis (E13-Q01) | prerempli, `.ph` | E13.1-CA06 | E13.1-T04 |
| E13.1-S18 | Carte | C13 | Badge sur photo : « Audience vérifiée » clair ; « Brouillon », « En attente » warning ; « Suspendu » erreur ; icône et mot | Badge d'audience tenu, ou profil non publié (priorité à l'état) ; « Refusé » non montré, même forme erreur | prerempli, `.ph__badge` | E13.1-CA07 | E13.1-T04 |
| E13.1-S19 | Carte | C31 | Nom légal gras, ▮, lien étiré vers la fiche E06.2, « (consultation journalisée) » lu ; coche « vérifié » 20 px à droite | Toujours ; sans nom : « Nom non renseigné » | prerempli, `.pc__l1` | E13.1-CA07 | E13.1-T01 |
| E13.1-S20 | Carte | C31 | Ligne `text-xs` : pseudo du réseau principal souligné, icône externe, nouvel onglet ; état du profil ; responsable | Toujours ; autres réseaux et alias (E13-Q05) | prerempli, `.pc__l2` | E13.1-CA07 | E13.1-T01 |
| E13.1-S21 | Carte | C31 | Titre (1 ligne), puis thématiques et pays | Toujours ; non servis (E13-Q01) | prerempli, `.sm.clamp2`, `.sm.c2` | E13.1-CA06 | E13.1-T04 |
| E13.1-S22 | Carte | C31 | « {réseau} · {abonnés exacts} abonnés · {pays} {part} % », nombre gras | Chiffres connus ; sinon « Audience non renseignée » | prerempli, `.pc__aud` | E13.1-CA06 | E13.1-T01 |
| E13.1-S23 | Carte | C36 | « Ce que voit la marque » (raisons) puis « Valeurs exactes », 1 ligne chacune, `text-xs` | Non bloqué ; profil non publié : « profil non publié : la marque ne le voit pas » | prerempli, `.pc__why` | E13.1-CA08 | E13.1-T01 |
| E13.1-S24 | Filtres | C28 | Dialogue 672 px au plus, 85 dvh : tête avec fermer, groupes par facette, encadré interne, pied | Sur S05, S07, S09, S10 | prerempli, `#filters` | E13.1-CA09 | E13.1-T02 |
| E13.1-S25 | Filtres | C28 | Groupes communs : Thématique (liste), Réseaux, Pays d'audience, Langues de publication, Tranche d'audience ; compléter Part du pays, Formats, Badges (E13-Q04) | Dialogue | prerempli, `.fgroup` | E13.1-CA09 | E13.1-T02 |
| E13.1-S26 | Filtres | C28 | Encadré interne : barre 4 px, fond identifié, œil barré, titre ; État du profil, Responsable, Statut déclaré, Ville ou région, Secteurs refusés | Dialogue ; forme de G9, G10 (E13-Q04) | prerempli, `.fint` | E13.1-CA09 | E13.1-T02 |
| E13.1-S27 | Filtres | C10 | Pied : « Tout effacer » texte, « Voir les {n} créateurs » primaire | Dialogue ; nombre avant application (E13-Q06) | prerempli, `.fdlg__foot` | E13.1-CA09 | E13.1-T02 |
| E13.1-S28 | Carte | C31 | Paire bloquée : photo à 45 % d'opacité, croix et phrase erreur seule, ni raisons ni valeurs | `blocked` vrai (campagne liée) | prerempli, `.pc.is-blocked` | E13.1-CA10 | E13.1-T05 |
| E13.1-S29 | Pied | C32 | « Page {p} sur {n} · 20 par page », « Page suivante » | Résultats ; « Page précédente » non montrée (E13-Q07) | prerempli, `.pager` | E13.1-CA11 | E13.1-T01 |
| E13.1-S30 | Pied | C17 | « Ni export ni sélection avant le Lot 4… », `text-xs` tertiaire, sans cadre | Sauf chargement | prerempli, `p.xs.c3` | E13.1-CA12 | E13.1-T01 |
| E13.1-S31 | Résultats | C08 | État vide 640 px : loupe, titre, phrase, trois critères avec « Retirer » 36 px | 0 résultat | vide, `.empty-state` | E13.1-CA13 | E13.1-T02 |
| E13.1-S32 | Résultats | C09 | Quatre squelettes de carte (photo et trois lignes 55, 85, 65 %), `aria-busy`, « Recherche en cours… » | Réponse attendue | chargement, `.sk` | E13.1-CA14 | E13.1-T06 |

## 4. Textes
Backoffice en français seul : `messages/fr.ts`, `identifiedSearch.*` (D36 ouverte) ; EN vaut « D36 ». Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| S01 | Créateurs · Recherche | D36 | `nav.creatorSearch` ; « Recherche » nouveau |
| S03 | Vue identifiée — vous voyez les noms, pseudos, liens et chiffres exacts. La marque ne voit rien de tout cela. Vos recherches et consultations sont journalisées. | D36 | `frame.mark`, `lead`, `warning` |
| S04 | Créateurs | D36 | remplace `title` (« Recherche de créateurs ») |
| S05 | Filtres · Critères de recherche (nom du groupe) | D36 | remplace `facets.title` |
| S06 | Thématique : {valeur} · Réseaux : {valeurs} · Pays d'audience : {valeurs} · Langue : {valeur} · Retirer le critère : {critère} | D36 | `criteria.*` (« facette » devient « critère ») |
| S07 | Thématique · Réseaux · Tranche d'audience | D36 | `facets.*` |
| S08 à S10 | Internes · État du profil : tous · Responsable : tous | D36 | nouvelle ; `facets.profileState` |
| S11 | {n} créateurs correspondent à votre recherche · {n} créateurs (libre) · Aucun créateur · Recherche en cours… | D36 | `results.count` à étendre ; `results.loading` |
| S12 | Liée à · Recherche liée à · aucune campagne · {titre} · {marque} | D36 | nouvelle |
| S13 | Vider le pré-remplissage · annonce : Pré-remplissage vidé. La campagne reste liée. | D36 | `origin.clear` ; annonce nouvelle (`origin.cleared` proche) |
| S14 | Tri · Pertinence · Audience · Vérifiés d'abord · Nouveaux profils | D36 | `sortLabel` (« Trier par »), `sorts` (« profils récents ») à changer |
| S15 | Ce n'est pas un score | D36 | nouvelle |
| S16 | Aucune campagne sélectionnée : la proposition sera indisponible. Choisissez une campagne dans « Liée à ». | D36 | `origin.none` à changer |
| S17 | Visuel précédent · Visuel suivant | D36 | nouvelle |
| S18 | Audience vérifiée · Brouillon · En attente · Suspendu | D36 | `badges`, `states` (« En attente de validation ») |
| S19 | (consultation journalisée) | D36 | nouvelle |
| S20 | (ouvre {réseau} hors INFLUX) · Publié · sans responsable | D36 | `row.opensOutside` à paramétrer ; `row.noOwner` |
| S22 | {réseau} · {n} abonnés · {pays} {part} % | D36 | `row.audienceLine` à étendre |
| S23 | Ce que voit la marque · Valeurs exactes · profil non publié : la marque ne le voit pas · profil suspendu : la marque ne le voit pas | D36 | `row.exactValues` ; le reste nouveau ; raisons : `reasons.*` |
| S24 | Filtres · Fermer · Les mêmes filtres que la marque, aux mêmes tranches, puis les filtres internes. | D36 | nouvelle |
| S25 | Toutes · Pays d'audience · Langues de publication · Nano · Micro · Intermédiaire | D36 | `facets.*`, `audienceBands.mid` vaut « Moyenne » |
| S26 | Filtres internes · jamais côté marque · Tous · Moi ({prénom}) · Sans responsable · Statut déclaré · Particulier · Professionnel · Ville ou région · Secteurs refusés par le créateur · Pour comprendre pourquoi un profil n'apparaît pas. Jamais exposé à une marque. | D36 | `declaredStatuses.business` vaut « Entreprise » ; reste nouveau |
| S27 | Tout effacer · Voir les {n} créateurs | D36 | `facets.reset` à remplacer |
| S28 | Vous ne pouvez pas proposer ce créateur à cette marque. | D36 | `row.blockedPhrase` |
| S29 | Page {p} sur {n} · 20 par page · Page suivante | D36 | `results.page`, `results.next` |
| S30 | Ni export ni sélection avant le Lot 4 : la proposition à une campagne arrive avec la mise en relation. | D36 | remplace `results.noSelection` |
| S31 | Aucun créateur ne correspond. · Les trois critères les plus restrictifs : · Retirer | D36 | `empty.*` (« facettes » devient « critères ») |

Texte du dialogue « Au Lot 4 : dernier contact INFLUX, charge en cours… » : hors lot, non rendu (aucun code de lot à l'écran, E13-Q12).

## 5. Interactions, états, responsive, clavier
- Interactions : S05, S07, S09, S10 ouvrent le dialogue, focus sur le groupe visé. Le brouillon du dialogue ne lance aucune recherche ; S27 primaire applique, ferme, page 1, focus sur S11. Échap et la croix ferment sans appliquer. S06 retire et relance. « Tout effacer » vide le brouillon.
  - S12 : change `?campagne=` ; nouvelle campagne, nouvel écran (aucun report, `IdentifiedSearchScreen.tsx:60-64`) et pré-remplissage lu ; « aucune campagne » retire le paramètre.
  - S13 : vide les filtres, garde `campaignId` et `prefillId`, annonce C29. Le bouton reste ou disparaît : E13-Q08.
  - S19 ouvre `/inscrits/{accountId}` ; S20 ouvre le réseau (`noopener noreferrer`), au-dessus du lien étiré.
- États :
  - Chargement : montré. Vide : montré, trois facettes ; les deux autres cas (aucune facette, internes seules) non montrés : textes `empty.none`, `empty.removeApplied` préservés.
  - Erreur, refus, débit, campagne inconnue : non montrés ; préservés (`IdentifiedResults.tsx:250-265`, `IdentifiedSearchScreen.tsx:246-250`), C17 erreur à la place de la grille, filtres gardés, « Relancer la recherche ».
  - Lecture du brief : non montrée ; chargement S32 et `origin.loading`. Plafond de pages : non montré ; C17 warning avant S29, `results.capReached`.
  - Hors ligne : erreur commune. Permission : contrôle serveur ; un membre reçoit 404.
- Responsive : 1440 et 1280, trois colonnes ; 768, une colonne, filtres sur quatre lignes, tête sur 122 px (E13-Q09) ; 768 à 1 023 px : rail en liste (`17b` §1.7) ; 375 : C67 seul, aucune recherche journalisée (le prototype déborde de 197 px).
- Clavier : ordre DOM ; lien étiré de la carte avec anneau sur la carte ; carrousel focalisable ou piloté par ses flèches (X8) ; dialogue natif avec piège et retour du focus ; `j` et `k` entre cartes (`17b` §3.3) non montrés : préservés s'ils existent, sinon E13-Q10.
- Animations : flèches de carrousel `opacity` `duration-fast` ; défilement doux du carrousel sauf mouvement réduit ; bord de pastille au survol ; dialogue commun.

## 6. Critères d'acceptation
- **E13.1-CA01** La barre de 4 px, le chapeau écrit et ▮ entourent toute donnée identifiée dans tous les états, chargement compris.
- **E13.1-CA02** Chaque facette appliquée est une pastille retirable nommée ; le compteur « Filtres » égale le nombre de facettes communes et internes appliquées.
- **E13.1-CA03** Les filtres internes sont séparés, nommés « Internes », absents de toute réponse à une marque.
- **E13.1-CA04** Le nombre est exact (RG62), le tri sélectionné est celui envoyé, aucun score ni rang n'est affiché.
- **E13.1-CA05** Pré-remplissage, retrait et ajout sont journalisés avec `prefillId` (CA56) ; vider garde le lien ; sans campagne, la notice S16 s'affiche.
- **E13.1-CA06** Photo 4:3, chiffres exacts avec date et source atteignables ; aucun prix, budget ni e-mail dans la réponse ni à l'écran.
- **E13.1-CA07** Un profil non publié porte son état en mots et icône, jamais la couleur seule ; un pseudo s'ouvre hors INFLUX avec l'avertissement lu.
- **E13.1-CA08** Les raisons sont celles que la marque voit (RG77), les valeurs exactes sont lisibles en entier (déplier ou fiche), jamais coupées sans recours.
- **E13.1-CA09** Le dialogue contient toutes les facettes servies aujourd'hui (F1, F3, F4, F6 et parts, F8, F11, F17, G1, G2, G8, G9, G10) et applique en une fois.
- **E13.1-CA10** Une paire bloquée n'affiche que sa phrase : ni motif, ni auteur, ni raison, ni valeur exacte.
- **E13.1-CA11** 20 cartes par page, pages précédente et suivante, plafond dit ; aucun défilement infini.
- **E13.1-CA12** Ni export, ni case, ni sélection avant le Lot 4.
- **E13.1-CA13** L'état vide nomme jusqu'à trois facettes retirables ; aucune page blanche dans les deux autres cas.
- **E13.1-CA14** axe sans violation à 768, 1 024, 1 280, 1 440 (cibles ≥ 24 px, carrousel, contraste des badges atténués ≥ 4,5:1) ; page sans débordement horizontal ; C67 sous 768 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E13.1-T01 | e2e | `backoffice-identified-search.spec.ts:112-198` (adapter `form` `facets.title`, lignes de tableau, `details`) ; garder `data-identified-frame`, `data-identified-bar`, `data-result-count`, `data-creator-row` | Cadre, identités, chiffres, absence d'export et de case |
| E13.1-T02 | e2e, unitaire | même spec ; `identified-search-view.test.ts` | Filtres, puces, vide, G8 |
| E13.1-T03 | e2e | `backoffice-identified-search.spec.ts:260-330` ; garder `data-prefill-line` (déplacé sur le contexte) | Pont campagne, journal, vider |
| E13.1-T04 | visuel | nouveau, captures 768, 1 280, 1 440 des quatre états | Fidélité de la grille et des cartes |
| E13.1-T05 | e2e | `backoffice-identified-search.spec.ts:199-259` | Non publié en mots, paire bloquée |
| E13.1-T06 | a11y | même spec, axe WCAG 2.2 AA par état et largeur | CA14 |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Colonne de facettes | `IdentifiedFacets.tsx:130-236` | ligne C30 et dialogue C28 | faire évoluer |
| Tableau et ligne dépliée | `IdentifiedResults.tsx:142-200`, `:375-400` | grille C31 | supprimer, créer |
| Cadre | `BoIdentifiedFrame.tsx` (losange) | chapeau à une phrase, œil | faire évoluer |
| Ligne d'origine | `IdentifiedSearchScreen.tsx:210-258` | S12, S13, S16 | faire évoluer |
| « Trouver une campagne par sa marque » | `:252` | remplacé par S12 | supprimer |
| Puces, vide, erreurs, pages | `IdentifiedResults.tsx:51-81`, `:250-433` | mêmes règles | réutiliser |

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Visuels, titre, thématiques, pays du profil | Non (`identifiedCreatorRowSchema`) | à servir |
| Liste des campagnes liables, avec marque | Non | lecture nouvelle |
| Liste des agents pour « Responsable » | Comptes internes réservés à l'admin (`/v1/bo/internal-accounts`) | lecture limitée aux prénoms |
| Filtre G8, « sans responsable » | G8 accepte des identifiants (`identified-creator-search.ts`) ; « sans responsable » non | à étendre |
| Pays d'audience multiples | Non, F6 = un pays | décision |
| Ville en texte libre | Non, G9 = pays et régions | décision |
| Nom, pseudo, état, responsable, blocage, chiffres, raisons, total | Oui | aucun |
| Dernière publication | Non | retirer de l'exemple |

Hors lot (Lot 4 ou 5) : état lot4 (case ronde, 20 au plus, barre « Proposer à la campagne », dialogue de motif, écartés nommés, RG74), G3 à G7.

## 9. Contradictions, manques et décisions
Transverses : X2, X3, X4, X8, X11, X13 ; E02-Q1, Q5 à Q9, Q11, Q15, Q16 valent ici. axe : `#unfill` et `select` Tri en lot4 à 375, pseudo de carte 18,6 px de haut, badge de photo atténuée 1,52:1 et 4,17:1 ; `label.row` sans texte associé correct (le `select` a son propre `aria-label`).

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E13-Q01 | Visuels, titre, thématiques, pays absents de la réponse ; D82 (7) et L2G font lire un visuel à la demande, journalisé | Cartes photo impossibles | Servir les visuels publiés déjà publics pour la marque ; non publié : photo neutre | architecte, expert-cybersecurite | oui |
| E13-Q02 | « Liée à » propose une liste de campagnes ; aucune route | Choix impossible hors `?campagne=` | Lecture des campagnes admises, recherche par marque, plafonnée | architecte | oui |
| E13-Q03 | Filtre Responsable : G8 dans l'API, absent de l'écran ; la liste d'agents n'est lisible que de l'admin | Filtre vide pour un agent | Lecture prénoms et identifiants pour agents | architecte | oui |
| E13-Q04 | Le dialogue omet Part du pays, Formats, Badges, macro et méga ; G10 sans contrôle ; G9 en texte libre ; Pays d'audience à choix multiple ; `10` RG71 exige les mêmes facettes que la marque | Perte de filtres ou requêtes refusées | Garder toutes les facettes, choix unique pour F6, pays et régions pour G9, cases pour G10 | expert-matching | oui |
| E13-Q05 | La carte ne montre ni l'alias, ni les autres réseaux, ni `to_refresh`, ni la vigilance, ni secteurs refusés, ni résidence, ni date et source ; `17b` §3.3 veut nom et alias sur deux lignes | Perte d'information (RG41, RG77) | Alias sur la ligne 2, « Valeurs exactes » dépliable (C26) avec tout le contenu actuel | product-owner | oui |
| E13-Q06 | « Voir les 38 créateurs » suppose un compte avant application ; chaque recherche est journalisée et débitée | Appel supplémentaire | « Voir les résultats » | product-owner | non |
| E13-Q07 | « Page précédente » absente ; « Page 1 sur 2 » calculable du total exact, plafonné à 50 | Navigation perdue | Rendre les deux boutons, total borné au plafond | product-owner | non |
| E13-Q08 | Après « Vider », la campagne reste dans « Liée à » : la maquette bascule sur « aucune campagne » tout en annonçant « reste liée » (script `#unfill`) | Incohérence | Garder la campagne sélectionnée, masquer S13 et S16 | product-owner | non |
| E13-Q09 | Chapeau, filtres et tête occupent 500 px avant la première carte à 768 | Confort | Accepter (D58) | expert-ux | non |
| E13-Q10 | `j`/`k`, `Entrée` (`17b` §3.3) sans équivalent dans une grille | Raccourcis | Carte suivante, précédente, ouvrir | expert-ux | non |
| E13-Q11 | Prototype sans classe `bo` : corps 16 px et boutons 46,8 px, rail et bande plus hauts | Densité différente des autres écrans | Densité `bo` (14 px, 28 px) pour rail, bande, pied et boutons ; cartes à leurs tailles mesurées | expert-ux | oui |
| E13-Q12 | « Lot 4 » écrit à l'écran (S30, dialogue) | Vocabulaire interne | Garder la phrase sans numéro de lot | expert-marketing | non |
| E13-Q13 | Raison « dernière publication il y a 2 jours » et « thématique secondaire » inexistantes dans `reasons` | Textes irréalisables | S'en tenir aux codes servis (4 au plus) | expert-matching | non |
| E13-Q14 | « Professionnel » et « Intermédiaire » contre « Entreprise » et « Moyenne » dans `fr.ts` ; l'inscription dit « Professionnel » | Vocabulaire double | Un mot par code, celui de l'espace membre | expert-marketing | non |
| E13-Q15 | `17b` §3.3 décrit un tableau et une colonne de facettes | Spécification à amender | Amender `17b` §3.3 | product-owner | non |
