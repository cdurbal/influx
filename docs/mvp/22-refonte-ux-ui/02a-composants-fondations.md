# 02a — Composants partagés : fondations (C01 à C30, C56, C57)

> Suite : `02b-composants-metier.md` ; propriétés et états : `02c-proprietes-et-etats.md`. Valeurs mesurées dans un navigateur sur les 147 états des
> maquettes (px à 1 440 ; « tél. » = 375). Tokens : `03-design-system-et-tokens.md`. Écrans
> utilisateurs : `07a-matrice-composants.md` (produite par script).

## 0. Règles communes

- **Emplacement** : membres dans `apps/web/src/components/member/ui/` ; backoffice dans
  `apps/backoffice/src/components/ui/` (à créer). `packages/ui` ne porte que tokens et polices
  (`02` §21.2) : partager du React entre les deux fronts est une décision d'`architecte` (**RU-18**).
  Proposition : deux implantations, mêmes noms, mêmes props.
- **Un composant du catalogue = un module** `nom.tsx` + `nom-classes.ts`. Aucun équivalent sous un
  autre nom : si un écran diffère, c'est une variante (prop), listée ici.
- **Nature** : R réutiliser · E faire évoluer (fichier existant) · N nouveau.
- Aucune logique métier ni appel réseau dans ces composants. Tous les libellés arrivent par props
  (i18n chez l'appelant). Icônes par `icons.ts` seulement.
- Focus : anneau `focus-ring` 3 px, décalé de 2 px ; ligne et tableau : intérieur (−3 px). Cible de
  toucher : 44 px (membres) ; 24 px au moins (backoffice, WCAG 2.5.8).
- Les attributs `data-*`, rôles et noms accessibles lus par les specs existantes sont conservés.

## 1. Page et structure

**C01 PageFrame** · N (remplace les cadres par écran, U09)
- Rôle : cadre unique de page. Variantes : `wide` (max `container-max`), `narrow`
  (`container-narrow` 768, aligné à gauche), `bo`.
- Dimensions : membres 1 184 px à 1 440 ; rembourrage `spacing-section-header` (48 ; tél. 24) et
  `spacing-page-gutter` (48 ; tél. 16) ; écart vertical `spacing-6` 32 (lecture : `spacing-5` 24) ;
  page empilée : 48 dès 1 024, 32 sinon. BO : 32 × 48, écart 24.
- Halo `header-glow`, hauteur minimale `size-header-glow`, un seul par page (TK2.1).
- Réserve basse si barre collante : `--size-mobile-action-space`.
- Props : `variant`, `stickyBar?: boolean`, `children`.
- A11y : contenu dans `main#contenu` ; un seul `h1`.

**C02 PageHeader** · E `member/ui/PageHeader.tsx`
- Titre `t-page` (28 px, 24 tél., Manrope 800) ou **`title="section"`** (20 px, 800 pour compte et
  vérifications ; 700 pour l'assistant). Chapeau `text-secondary`. Actions à droite dès 768 px, dessous sinon.
- Props : `title`, `titleSize: "page" | "section"`, `lead?`, `back?`, `crumbs?`, `actions?`, `badges?`.
- États : action en chargement (`aria-busy`). A11y : `h1 tabindex=-1`, focus après navigation, sans anneau.

**C03 Section** · N
- `h2` + intro + barre d'actions + contenu, **sans conteneur**. Filet `border-default` au-dessus sauf
  la première. Variantes : `page` (titre 20 px, écart 24), `reading` (20 px, rembourrage vertical 32,
  écart 16), `account` (16 px 700, écart 16, `pt` 24), `bo` (16 px 700, écart 12, 24 au-dessus),
  `overline` (surtitre 12 px capitales, écart 12).
- Props : `title`, `as: h2 | h3`, `variant`, `count?`, `actions?`, `description?`. A11y : `aria-labelledby`.

**C04 Card** · E `card-classes.ts`
- `default` : `surface-card`, contour `border-default` 1 px, rayon 16, rembourrage 32 (tél. 24), écart 16.
  `compact` : 16. `box` : 24, encadré collant (C39). `link` : contour `border-strong`, survol
  `surface-raised` + `border-hover` + −2 px ; lien étiré, **aucun bouton vers la même cible**.
- Jamais dans une autre carte ; jamais pour une seule ligne de texte.

**C05 InnerPanel** · N
- `surface-raised`, rayon 12, sans contour, rembourrage 16 (panneau de décision : 12), écart 8 à 12.
  Variantes : `readonly` (ligne libellé / valeur / action, 12 × 16), `preview` (chapeau 12 px + icône),
  `form` (BO, max 52 rem). Contour en tirets réservé à C24.

**C12 CardActions** · N (U45) : `flex-wrap`, écart 12 ; pleine largeur sous 480 px seulement
(`stretch`). Une seule principale, en premier.

**C29 Announcer** · N (membres et BO) : une région `role="status"` par page, hors écran ; `announce()`
vide puis écrit. Remplace les régions locales lors de la migration d'un écran ; les régions `data-*`
lues par une spec restent.

**C56 MemberShell** · E `member/MemberShell.tsx`, `MemberNav.tsx`, `shell-classes.ts`
- ≥ 1 024 : colonne 256 px collante ; entrées 44 px, rayon 12, icône 20, écart 12 ; courante
  `nav-item-active-bg` + filet gauche 2 px ; sous-entrées 14 px (D74) ; bloc d'état ; pied (langue,
  identité, « Se déconnecter »). Sinon : en-tête collant 64 px + barre du bas 56 px.
- Entrées réelles : D74 fait foi, aucune entrée sans écran. Détail et écarts : `E01` §2.
- A11y : un `aside` nommé « Votre compte » / « Your account » (`shell.accountState.label`) après la `nav`, qui porte le bloc d'état puis le pied, absent sans compte lu, masqué sous 1 024 px (RUB-B §1) ; un seul `nav`. Langue : lien (jamais un `button`) dessiné en pilule secondaire `md`, dans l'en-tête sous 1 024 px, dans le pied dès 1 024 px.

**C57 BoShell** · E `Shell.tsx`, `BoNav.tsx`, `bo-nav.ts`
- Rail 240 px, lignes 36, 14 px ; surtitres de groupe non cliquables ; nombre à droite en chiffres
  tabulaires, « hors délai » en alerte avec drapeau ; bande d'environnement 36 px au moins ; fil d'Ariane.
- Compteurs : données à servir (`06b` §5). 768 à 1 023 px : liste horizontale de `17b` §1.7, **non
  dessinée** (les maquettes gardent le rail) : **RU-19**.

## 2. Listes, lecture, états

**C06 RowList** · N (U13, U17)
- `ul` ; filet haut et entre lignes `border-subtle` ; ligne 60 px au moins (`size-touch-target` + 16),
  rembourrage 12 × 8, écart 4 × 16 ; titre 16 px Manrope 700 (BO 14) ; fin de ligne `text-secondary` + chevron.
- Variantes et colonnes : `campaign` (titre · état · date · chevron ; pile sous 768), `feed` (logo ·
  texte · chevron), `lists` (vignettes · texte · chevron ; vignettes masquées < 640), `tasks` (titre ·
  statut ; filets `border-default`), `hub` (titre, phrase, chevron), `sessions` (icône · texte · action ;
  pile < 480), `todo` (BO, hauteur libre, 14 px / 12 px), `mini` (36 px, filet de survol).
- Props : `items[{ href?, title, meta?, sub?, end?, action?, tone? }]`, `variant`. Huit variantes (EC-RUB-2), sans en ajouter : les « 10 » formes de la maquette se rendent par les champs présents (`campaign` avec `meta` et `end`, sans `end`, avec `sub` seul ; `mini` avec `media` et `sub`) ; une forme qu'aucun champ ne rend : décision d'`architecte` (RUB-B §4). Ligne `current` : contour transparent (AP1, `20` §11.8).
- Survol `surface-raised` ; focus : anneau intérieur sur la ligne ; lien étiré (`cover`) ; une action
  dans la ligne passe au-dessus (`z-raised`).

**C07 PropertyList** · N
- `dl` à deux colonnes, libellé `--size-property-label` (paliers de `03` §3.3), écart 8 × 24 ; 14 px
  (fiche de lecture 16, colonne BO 12 avec 8 × 12). Libellé `text-secondary` 600 ; vide en
  `text-tertiary`, regroupé sur une ligne (`emptyline`) dans le dossier BO.
- Props : `items[{ label, value, empty?, sub? }]`, `size`, `labelWidth`, `columns?`.

**C08 EmptyState / StateMessage** · N (U18) : sans cadre ; icône 24 `text-tertiary`, titre
`t-section`, phrase, **une action au plus** ; rembourrage vertical 32, max 40 rem, écart 12. Variantes
`empty`, `filtered` (« Réinitialiser » secondaire, EC-RUA-06-3 ; jamais « Créer »), `error` (« Réessayer »), `closed`,
`sent`, `inline` (une ligne : coche sarcelle + phrase). « Mes campagnes » vide est **en carte** dans la
maquette 12 (**RU-15**). Titre : un `p` de style `t-section`, jamais un niveau de titre (la hiérarchie reste à C01 à C03, RU-12 ; RUB-B PT5).

**C09 Skeleton** · N (U20) : `skeleton-base`, rayon 6, ligne 14 px, formes à la hauteur finale
(photo 4/3 + trois lignes), conteneur `aria-busy`, texte « Chargement… » hors écran, rien avant 1 s
(`interactions.html`). Dessiné pour 2 et 13 ; ailleurs : composition de C09 à valider écran par écran. Formes `aria-hidden`, conteneur `aria-busy`, `label` hors écran ; mouvement réduit : formes fixes ; nombre chargé annoncé par C29 (RUB-B PT6).

**C13 StatusBadge** · E `status-badge-classes.ts` : pilule 28,6 px, 12 px 700, 4 × 12, **écart 8** (4
aujourd'hui, U65), contour 1 px, fond opaque. Tons neutre, succès, alerte, erreur, info, vérifié.
Variante `text` (sans pilule : `late`, `ok`, `sync`, `st`) : icône 16 + mot, écart 4.

**C14 LayerBadge** · E : mêmes mesures, 600 ; une fois par groupe ou par étape (C4 validé avec 3, 7,
10) ; `wrap` sur deux lignes : rayon 12.

**C15 RoleBadge** · R : 31,7 px, point 12 px. Dans la fiche BO (6) il hérite de 800 : **RU-15**.

**C16 CounterBadge** · E : 18,6 px, min 24, 12 px 700, 0 × 8. Variante `dot` (20 px) dans une pastille. Contour fin transparent (AP1, `20` §11.8).

**C17 Notice** · R : 14 px, 12 × 16, rayon 12, icône 16, écart 12 (8 aujourd'hui). Action à droite
possible (1, 12). Jamais pour un état durable (U46).

**C32 Pager / pied de liste** · E : « Précédent / Suivant », position écrite ; BO : total au pied,
résumé `lsum` sur une ligne (14 px, écart 4 × 16, chiffres tabulaires).

**C33 LogoPlate / Avatar** · N : pastille `logo-plate` claire, rayon 12, rembourrage 4 ; 32, 40, 48,
56 (fiche BO), 64 (téléversement), 120 (héros, rayon 16) ; sans logo : initiales 800. Avatar rond 48
(2b, 15) ou 40 (18) ; dégradé : **RU-07**. Logo absent en file : carré 48 en tirets.

## 3. Actions

**C10 Button** · E `button-classes.ts`
- Membres `md` : 44,8 px (principal), 46,8 (secondaire, contour compris), 12 × 24, 16 px ; principal
  700 + ombre lumineuse ; secondaire 600 ; `lg` 52 ; `sm` 36 (0 × 24 : barre de sélection de 2, compte) ; `bar` 40 (barre mobile de 2b, 5b). BO : 28 px,
  0 × 16, 14 px, sans transformation ; `sm` 36 (rejeu de 21).
- `text` : 44 px, rayon 12, 0 × 12 (BO : 28 px, 0 × 8). `danger` : plein rouge D72.
- États : repos, survol, appui, focus, désactivé (`aria-disabled`, expliqué à côté), chargement
  (libellé en cours, `aria-busy`, largeur figée), « ajouté ». Opacité 0,45 de la maquette 21 remplacée
  par l'état désactivé de la charte (**RU-09**).
- Libellé long au téléphone : deux lignes permises (65,6 px mesurés).
- `sm` (36) et `bar` (40) : dessin gardé, zone de toucher étendue à `size-touch-target` en hauteur par un pseudo-élément transparent (RUB-B §3).
- Module `Button.tsx` (ancien `MemberButton`), types `ButtonVariant` et `ButtonSize` (RUB-A §1).

**C11 ActionLink** · N : `link` (souligné, 600) ; `go` (Manrope 600, 16 px, 14 en dense, chevron 16 ou
20 à 4 px, 44 px de haut, souligné au survol) ; `save` (cœur + libellé souligné, `aria-pressed`). Seul sur sa ligne (liens de tête et de retour, méta de C41), zone de 44 × 44 px par pseudo-élément, anneau sur l'élément dessiné ; pas pour un lien dans une phrase (RUB-B §3).

## 4. Formulaires

**C18 Field** · E `FieldFrame`, `TextField`, `TextAreaField`, `SingleChoiceField`, `DomainField`
- Libellé 16 px 600 (BO 14, colonne BO 12) + « (obligatoire) » 14 px 400 ; aide 14 px `text-secondary`
  sous le libellé ; contrôle 48 px (BO 28), rayon 12, 0 × 16, `surface-page`, contour `border-strong` ;
  liste : chevron à droite, rembourrage droit 48 ; zone de texte 120 px au moins (**BO** : contrôle 0 × 8, zone de
  texte 48 px au moins, rembourrage 8) ; nombre court 128 px
  + unité. Écarts 8 (libellé-champ), 4 (libellé-aide).
- Grille de champs `fgrid` : 1 colonne, puis 2, 3 ou 4 dès 640 (**RU-03**), écart 24.
- Erreur : contour 2 px `border-error` sans décalage (rembourrage horizontal compensé de l'écart de contour, hauteur fixe, seule la couleur transitionne : RUB-B PT1), message C19, `aria-invalid`, `aria-describedby`. `Field` rend C19 (`error`, `warning`) au lieu de l'encadré (RUB-A §1) ; « À vérifier : » seulement pour un `warning` passé par l'appelant.
- Valider après soumission, puis au départ du champ signalé ; corriger efface (U25).

**C19 FieldMessage** · N (remplace l'`ErrorNotice` encadrée sous un champ, U27) : icône 16 + texte 14 px,
écart 8 ; erreur 600 ; avertissement préfixé « À vérifier : » ; `seen` = ce que voit une marque.

**C20 ErrorSummary / MissingList** · N (U26) : contour `feedback-error-border`, rayon 12, 16, titre
Manrope 700 + icône 20, liens 14 px. Focus sur le résumé après un refus ; chaque lien ouvre l'étape ou
la section (`flushSync`) puis focalise le champ. `missing` : ligne d'alerte, icône 16, lien « Compléter ».

**C21 ChoiceGroup** · E `MultiChoiceField`, `YesNoField` : case 24 px (dense 18), ligne 44 px, écart
12 ; `fieldset` + `legend` ; jamais d'action au changement ni de décochage silencieux (U32).

**C22 SegmentedControl** · N : piste `surface-raised`, pilule, 4 px, écart 4, segments 36 px (BO 32),
14 px 600 ; actif `surface-active` + `text-primary`. Variantes : `radio` (choix), `tabs` (15, `tablist`,
flèches ; deux colonnes < 640, rayon 12), `views` (BO, liens `aria-current`). Compteur inactif
`text-secondary` (X7). Hors conversation : **RU-10**. Clavier (RUB-B §6) : `radio` = `fieldset` + `legend` et `input type="radio"` natifs, `Tab` au coché, flèches pour choisir ; `tabs` = `tablist` nommé, tabulation itinérante, `←` `→` bouclent et activent, `Début`, `Fin` ; `views` = liste de liens sans `nav`, courante `aria-current="true"`, jamais `"page"`. Actif : contour transparent (AP1).

**C23 TagPicker** · E `PickListField` (U03) : liste déroulante + « Ajouter » secondaire ; étiquette 36 px
(BO 32) avec ×, 14 px ; choix 13 à 20 rem. Retrait annoncé ; focus à l'étiquette suivante, sinon à la liste. « × » : zone de 44 × 44 px (RUB-B §3).

**C24 InternalZone** · N (U30) : `surface-page`, tirets `border-strong`, rayon 12, 16, écart 24 ; titre
14 px 700 avec icône `eye-off` et texte.

**C25 SaveStatus** · E (3 copies, U31) : icône 16 + texte 14 px ; « Enregistrement… », « Enregistré à
14 h 07 », « Non enregistré… » + « Réessayer ». Assistant : au centre du pied dès 768, dans la ligne
méta dessous. Annonce seulement l'échec.

**C26 Disclosure** · E (`details` natif) : sommaire 44 px, chevron 20. Variantes `optional`
(« Facultatif, à compléter plus tard »), `fold`, `danger` (texte d'erreur), `rare` (pile de gestes,
chevron bas), `group` (compteur), `change` (BO). Une erreur dans un bloc replié l'ouvre.

**C27 Dialog** · N (`<dialog>` natif, remplace la base de `TermsDialog` et d'`ActionFeedback`) : 30 rem,
`surface-raised`, rayon 16, 32 (tél. 24), `shadow-lg`, voile `overlay-scrim` ; `Échap` annule sans perdre ;
clic sur le voile ferme ; focus rendu. Réservé aux confirmations, à l'identité, à l'aide `?`. `<kbd>` 22 px.

**C28 FiltersDialog** · N : 42 rem, max 85 dvh, en-tête et pied fixes (12 × 24), corps 24 défilant,
groupes séparés par un filet ; plein écran sous 768. Rien ne s'applique avant « Voir les … » ; « Tout
effacer » à gauche. BO : encadré interne violet.

**C30 FilterBar** · N : pastilles 40 px (BO 36), 14 px, 16 (BO 12), contour `border-default` ; active :
contour `text-primary` + `surface-active` 600, × pour retirer ; filet vertical 24 ; membres : une ligne
défilante ; BO : à la ligne ; recherche BO 15 rem ; `inline-select` sans contour. Compteur de filtres.
A11y : groupe nommé, défilement au clavier (X8) ; pastille bascule : `aria-pressed`, sans chevron ; pastille à menu (`onOpen`) : `aria-expanded` et `aria-haspopup`, chevron pivoté de 180° à l'ouverture, au repos sans chevron (écart à F8 non appliqué, question au fondateur à l'ouverture de RUC ; RUB-B PT4).
