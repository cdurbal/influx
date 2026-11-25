# 02b — Composants partagés : métier (C31 à C55, C58 à C68)

> Règles communes, nature (R, E, N) et emplacements : `02a-composants-fondations.md` §0. Le détail du
> contenu (textes, champs) est dans la fiche de chaque écran (`ecrans/`).

## 1. Cartes et lecture côté membres

**C31 PhotoCard** · N (remplace `CreatorCardView` en résultat, U10)
- Photo 4/3, rayon 16, sur `surface-raised` ; piste aimantée ; points 6 px (actif 16) ; flèches 32 px au
  survol ou au focus, absentes sans survol ; badge haut gauche `surface-inverse` 12 px 700 ; cœur 44 px
  haut droit (icône 26), rempli `text-primary` si ajouté, **jamais vert**.
- Sous la photo (écart 12, lignes à 2) : alias Manrope 700 (lien étiré) + état vérifié (X2) ; titre ;
  thématiques et pays ; réseau principal et tranche ; « Proposé car » sur une ligne, 12 px.
- Dimensions : 343 à 347 px de large à 1 440 (3 colonnes), hauteur 390 à 442 ; grille
  `--grid-photo-cards`, écart 32 × 24.
- Variantes : `search` (2), `shortlist` (9 : sans carrousel, note sous la carte, retrait), `identified`
  (13 : nom réel ▮, handle, état, valeurs exactes ; paire bloquée). `pick` (case ronde) = Lot 4.
- Props : `href`, `media[]`, `badge?`, `name`, `verified?`, `lines[]`, `why?`, `saved`, `onToggleSave`, `note?`.
- États : sans visuel, chargement (C09), ajout en cours, ajouté, plafond atteint, masqué.
- Tout glyphe posé sur la photo sans fond propre porte `effect-photo-shadow` ; cœur, flèches et « Voir les n visuels » : anneau double, `focus-ring` sur un halo `surface-page` (AP2, `20` §11.8). Cœur `saved` : contour transparent (AP1).
- A11y : `article` nommé ; cœur `aria-pressed` et nom « Ajouter ⟨alias⟩ à ⟨liste⟩ » ; piste atteignable au
  clavier (X8) ; cible du cœur 44 px ; texte de l'image : nature du visuel, jamais l'identité.

**C34 MediaGallery** · N : mosaïque 2/1 (1 + 4, écart 8, rayon 16, 1 088 × 544) dès 768 ; carrousel 4/3 pleine
largeur dessous, compteur « 1/5 » ; « Voir les n visuels » ; dialogue plein écran, grille 2 colonnes
dès 768, max 56 rem. A11y : X8, retour du focus, `Échap`. Moins de 5 visuels (RUB-B §4, part composant de RU-34) : 1 à 4 = cadre 2/1 sans case vide (le premier à gauche sur deux rangs ; à droite 2 = un sur deux rangs, 3 = un par rang, 4 = un en haut et deux en bas ; 1 = tout le cadre) ; 5 et plus = 1 + 4. Sous 768 : carrousel, sans compteur, points ni piste pour un seul visuel. « Voir les n visuels » dès 2 ; chaque visuel est un bouton nommé par son `alt`. Aucun visuel : `emptyLabel` en phrase. Un seul rendu par largeur, en CSS. Compteur et flèches : AP2.

**C35 KeyFigures** · N : `figures` (4 colonnes séparées par des filets, 16 × 8, chiffre **18 à 20 px** 800 —
taille fixe à fixer, RU-01, 2 colonnes < 640) ; `essentials` (2 × 2, icône 24, 16) avec `dl` valide (X9) ;
`network` (3 colonnes). Tranches seulement avant révélation (D61).

**C36 ReasonList** · N : icône 24 + titre 600 + texte, écart 16 entre icône et texte ; 24 entre lignes (2b,
5b, 15) ou 16 (8, 18). Faits vérifiables, jamais un score (D11, RG41).

**C37 RangeBar** · N : libellé 9 rem · barre 8 px · valeur 6,5 rem (< 480 : 6,5 · 5,5) ; `data-2` sur
`surface-active` ; la valeur écrite porte l'information.

**C38 ChipList** · N : 32 px, contour `border-default`, 0 × 12, 14 px, écart 8. Non interactif.

**C39 StickyAside + MobileActionBar** · N : encadré 372 px, 24, rayon 16, collant à `spacing-6` dès
1 024 ; sinon barre fixe au-dessus de la barre du bas, 8 × gouttière, filet haut, texte court + action.
Une seule action verte. Absente : 15 (aperçu), et 18 clos ou en validation. Repère nommé (X11).

**C40 ReadingLayout** · N : `--grid-reading` (7 / 4, min 19 rem), écart 64 ; texte max 40 rem ; « Lire la
suite » (4 ou 5 lignes) ; encadré après le contenu sous 1 024 (remplacé par la barre).

**C48 FeedCard** · E `CampaignFeedCard` (U14) : 16, rayon 16, écart 8, contour `border-default`, survol
`border-hover` et −2 px, 352 × 184 à 205 ; marque + logo 32, titre 700, échéance en délai avec icône
(alerte si proche), méta 14 px. **Aucun bouton, aucun montant** (D78). Grille min 18 rem, écart 16.

**C54 ComparisonTable** · N (9) : défilement horizontal dans un cadre rayon 16, en-tête `surface-hover`,
cellules 12 × 16, vignette 64, note 12 à 16 rem ; masqué sous 768 (cartes seules). Région focalisable (X8).

**C55 InlineEdit / note** · N : texte + crayon 36 px ; champ 28 rem, « Enregistrer », « Annuler » ; `Échap`
annule, `Entrée` enregistre (champ d'une ligne) ; note : compteur de caractères, état privé écrit.

**C66 PreviewFrame** · N : chapeau 12 px capitales « Aperçu », filet ; ou bandeau en tirets
information (5b « version soumise »). Contenu réel, actions inactives expliquées (`aria-disabled`, RU-09).

**C68 BrandHero** · N (5b) : carte 32 (tél. 24), logo 120 (tél. 72), titre (RU-01), badge, secteur et pays ;
une colonne < 640.

## 2. Formulaires longs

**C41 Wizard** · N (3, 7, 10)
- Boîte 768 px, rayon 16, 32 dès 768 ; sans boîte au téléphone. Tête : `h1` 20 px, « Étape n sur N »,
  segments 6 px (écart 4, zone de toucher + 10 px), méta (temps restant, « Enregistrer et reprendre plus
  tard »). Étape : `h2` 20 px, intro, badge de couche, champs (écart 24). Pied : « Précédent », statut,
  « Continuer : ⟨étape⟩ » ; **fixe** au-dessus de la barre du bas sous 768.
- Props : `title`, `steps[{ id, label, state: todo | current | done | gap }]`, `current`, `onStep`, `save`,
  `back`, `next`.
- Règles : « Continuer » **n'est jamais bloquant** ; segment fait ou manquant (alerte) cliquable ; focus
  au `h2` ; l'étape est dans l'URL ou l'état selon l'existant (`E03`, `E07`, `E10`) ; enregistrement
  automatique existant préservé (verrous de version, reprise).
- A11y (RUB-B §2) : segments = `ol` de liens, tous suivis quel que soit l'état (navigation libre, RU-32), nommés « Étape {n} sur {N} : {nom}, {état} » (à faire, en cours, faite, à compléter), `aria-current="step"` ; `Tab` de segment en segment, aucune flèche ; zone de 26 px (exception aux 44 px, 2.5.8 tenue, chaque étape ayant un équivalent de 44 px) ; contour transparent sur tous, épais sur fait et courant (AP1). Pied sous 480 px : « Précédent » = chevron 16 seul de largeur `size-touch-target`, libellé conservé hors écran (RU-36).

**C42 Recap** · N : sections par étape, filet, `h3` 16 px 700, « Modifier », propriétés 11 rem, manques en alerte.

**C43 ActivationChecklist** · N (1, U60, U61) : lignes 24 px d'icône · texte · action ; 16 ; « n sur N »
écrit + barre 6 px ; états à faire, fait (« Fait »), en attente (délai), verrouillée (condition).

**C44 NetworkAccordion** · N (3, U28) : un réseau par ligne de 60 px, bouton étiré, étoile du compte
principal 36 px (`aria-pressed`), badge « Complet », chevron ; ouvert : `surface-raised`, rayon 12.

**C45 PortfolioGrid / MediaThumbs** · E : 3 colonnes, 4/3, écart 12, case d'ajout en tirets ; vignettes BO
min 7 rem ; pile de 3 (9) 56 px, chevauchement 24.

**C46 DeliverablesPicker / formats par réseau** · E `DeliverablesField` : réseau, formats, quantité
(− / +, 36 px, `output`), zéro en `text-tertiary`. Boutons nommés, `aria-live` sur la quantité.

**C47 DateField** · N (7, U52) : 12 rem, format de la langue, ordre des dates vérifié et dit sous le champ.
Saisie (RUB-B §3) : champ texte `size-date`, `inputmode="numeric"`, sans sélecteur natif ; ordre jour, mois, année pour `fr` et `en` (D25), mois puis jour pour `en-US` seul ; séparateurs `/`, `.`, `-` ou huit chiffres ; année à 4 chiffres ; mise en forme au départ du champ ; date impossible = format refusé ; valeur émise ISO civile ou `null` ; gabarit et exemple par les textes du champ ; `orderNote` en C19 sous la date la plus tardive, `kind` par l'appelant (une valeur non enregistrée est une erreur).

**C49 OtpField / CodeField** · N (11, 20) : six cases 5/6 (352 px, écart 8), **un seul `input`**,
`inputmode=numeric`, `autocomplete=one-time-code`, collage accepté ; erreur 2 px sur les six ; focus sur
la case courante. `code` (20) : champ 12 rem espacé.

**C50 AuthLayout** · E `AuthScreen` : en-tête, colonne 28 rem (36 pour les informations), carte 32 dès 640,
portes en 2 colonnes. Page autonome, sans navigation.

**C51 NumberedSteps** · N : pastille 28 px, 14 px ; fait = ✓ sarcelle ; courant = `surface-active` 600 (contour transparent, AP1).

**C52 CodeBox / LinkBox** · E `CodeBox` : `surface-raised` 16, valeur 20 px 700 ; lien : contour fort,
`surface-page`, « Copier » annoncé ; lien affiché **une seule fois** (21).

**C64 FileUploadList** · E (14) : un fichier par ligne, icône, nom, état, action ; un échec n'efface pas
les autres ; ajout annoncé.

**C65 CheckLists** · N : affirme / n'affirme pas, à montrer / à masquer, conservé ; deux colonnes dès 640 ;
icône et titre, jamais la couleur seule.

## 3. Backoffice

**C53 Timeline** · E : date 7,5 rem · phrase ; groupée par jour ; lectures repliées ; marque : 8 rem, pile < 640.

**C58 DenseTable** · E `DenseTableRegion`, `QueueTemplate`, `bo-classes.ts` (U38)
- Ligne 36 px (**43,7 px** quand une ligne porte une case de 24 px, 21), en-tête 30,2 px, cellules 4 × 12, 14 px, une ligne par cellule, en-tête collant `surface-hover` Manrope 700,
  **première colonne = lien étiré**, pas de colonne « Ouvrir », nombres à droite tabulaires, total au pied.
- Sous 1 280 : défilement horizontal, première colonne fixe. Cadre seulement hors surface (6, 17).
- Raccourcis `j`, `k`, `Entrée` ; région nommée et focalisable (X8). États : chargement, vide, filtré, erreur.

**C59 DecisionLayout + DecisionPanel** · E, fusionne trois cadres (`ClaimedEntryFrame`,
`BrandReviewEntryScreen`, `VerificationEntryScreen`, U36) : dossier sans cadre + colonne 352 px collante
(rayon 16, 24) dès 1 024 ; sinon après le dossier, lien « Aller à la décision ». Contient verrou,
échéance, actions, motifs, confirmation, raccourcis. Verrou, échéance figée (D81) et journal inchangés.

**C60 ReviewChecks** · N : libellé 9,5 rem · valeur · question 12 rem ; une colonne < 1 280 ; modifié : badge
et ancienne valeur barrée (`<s>` + texte).

**C61 RecordLayout** · N (6, 17) : en-tête (logo 56, `h1`, méta, actions) ; colonne principale ; colonne de
propriétés 352 px **non collante** (demande du fondateur, 07) dès 1 280 ; dessous sinon.

**C62 IdentifiedView** · E `BoIdentifiedFrame` : barre gauche 4 px violette, chapeau écrit, fond
`bo-identified-bg`, symbole ▮ doublé d'un texte hors écran (X10). `zone` (13) = toute la zone de travail ;
`block` (6, 5) ; `mark` sur un lien qui ouvre une lecture journalisée.

**C63 BatchBar** · N (21) : `surface-raised`, 8 × 16, sélection comptée, action, compte rendu annoncé.

**C67 SmallScreenGuard** · E (`bo-small`, 19) : message seul sous 768 px ou 500 px de haut, **aucune page
montée derrière** (validé) ; page déjà montée avec verrou, et garde sans `matchMedia` : **RU-20**.

## 4. Correspondance des doublons actuels

| Aujourd'hui | Devient |
|---|---|
| `MEMBER_CARD_CLASSES` posées comme conteneur de section, `SECTION_CLASSES` (BO) | C03 |
| Trois `SaveStatus` | C25 |
| `ErrorNotice` sous un champ | C19 ; `ErrorNotice` reste pour l'erreur d'une action |
| Quatre listes de manques (`SignupDetailsStep`, profils, campagne) | C20 |
| `CreatorHomeCard`, `CreatorPublicationCard`, `CreatorTrustBlock`, `AccountStateBlock` | C06 `tasks`, C43, C13 |
| `QueueTemplate` + `QueueFilterBar` + `QueueSummary` | C58 + C30 + C32 |
| `DL_CLASSES`, `DT_CLASSES`, `DD_CLASSES`, `ReviewBlocks` | C07 |
| `TermsDialog`, confirmation d'`ActionFeedback` | C27 |
| `AccountHub` (page-menu) | C06 `hub` |

**Compte** : 68 composants ; la répartition R / E / N est relevée dans chaque fiche et dans la matrice.
