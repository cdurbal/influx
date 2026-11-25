# 03 — Design system et tokens du Lot 3bis

> Source : comparaison automatique de `prototypes/assets/tokens.css` avec
> `packages/ui/src/styles/tokens.css` et `apps/backoffice/src/styles/tokens-backoffice.css`
> (2026-11-24). Les noms et valeurs proposés ci-dessous sont à valider par `expert-ux` (longueurs,
> alias) et, pour toute **couleur**, par le fondateur (D6). Décisions : `06a-decisions.md`.

## 1. Résultat de la comparaison

- **Aucune dérive** : chaque token présent des deux côtés a la même valeur (les deux polices ne
  diffèrent que par leur mode de chargement).
- **8 tokens n'existent que dans les maquettes** (§3.1).
- **Environ 90 longueurs, proportions et opacités littérales** sont écrites en dur dans le CSS des
  maquettes et dans leurs attributs `style=` (§3.2 à §3.4). Le code de production les refuse :
  - `RESTRICTED_CLASSES` (`eslint.front-rules.mjs`) interdit toute valeur arbitraire `[…]`, toute
    opacité numérique, tout modificateur `/NN` et toute largeur de bordure implicite ;
  - `HARD_CODED_LENGTH_PATTERN` et le motif de couleur (`packages/test-kit/src/guards.ts`, l. 60 à 64)
    refusent les littéraux dans les composants ;
  - `KEO_COLOR_MIX` n'admet `color-mix` que dans les halos ;
  - TK7.3 (`guards.ts`, l. 2203 à 2240) refuse `clamp(` et `vw` dans les tailles sous KEO ;
  - `apps/backoffice/tests/guards.test.ts` (l. 520) refuse `matchMedia` et `@custom-variant` hors de
    `tokens-backoffice.css`.

  Le rendu est donc atteignable à l'identique **seulement** si chaque littéral devient un token ou
  se rattache à un token existant. C'est la première tâche du lot (`RUA-01`, `RUA-02`).

## 2. Tokens existants conservés et réutilisés

Aucun token existant ne change de valeur ni de nom. Emplois imposés par les maquettes :

| Famille | Tokens | Emploi dans les maquettes |
|---|---|---|
| Surfaces | `surface-page`, `-card`, `-raised`, `-hover`, `-active`, `-inverse` | Page et champs ; carte et encadré ; bloc intérieur, ligne survolée, réseau ouvert ; en-tête de tableau ; segment ou pastille actifs (X7) ; badge posé sur une photo |
| Filets | `border-subtle` / `-default` / `-strong` / `-hover` | Lignes ; sections, cartes, pastilles ; champs, zone interne en tirets ; survol |
| Texte | `text-primary`, `-secondary`, `-tertiary`, `-inverse` | Jamais `text-tertiary` sur `surface-active` (4,13:1) |
| Retours | `feedback-{success,warning,error,info}-*`, `badge-error-bg`, `verified-*` | Badges, notices, messages, manques |
| Espacement | `spacing-1` à `spacing-9`, `spacing-page-gutter`, `spacing-section-header`, `spacing-grid-gap`, `spacing-inset-card`, `spacing-bo-*` | Rythme de `04` §3, mesuré dans chaque fiche |
| Formes | `radius-sm` 6 px, `radius-md` 12 px, `radius-card` 16 px, `radius-pill`, `radius-round` | Cases, vignettes ; champs et blocs ; cartes, photos, dialogues ; boutons et pastilles |
| Typographie | `text-title-page` (24 px, 28 px dès 1 024), `text-title-section` 20 px, `text-md` 16, `text-sm` 14, `text-xs` 12 | Titres d'assistant, de compte et de vérification : **`text-title-section`**, pas `text-title-page` (maquettes 3, 7, 10, 11, 14, 20) |
| Mesures | `size-touch-target` 44, `size-button-md` 44, `size-input` 48, `size-checkbox` 24, `size-icon-sm/md/lg` 16/20/24, `container-max` 1 200, `container-narrow` 768, `size-nav-bottom-height` 56, `spacing-bo-row-h` 36, `size-bo-control` 28 | Toutes maquettes |
| Mouvement | `duration-fast` 120, `-base` 200, `-slow` 320 ms ; `ease-standard`, `ease-exit` ; `scale-hover` 1,03 ; `scale-press` 0,98 ; `translate-lift` −2 px | `04-animations.md` |

## 3. Tokens à ajouter

### 3.1 Les huit tokens des maquettes (valeurs déterminées)

| Token | Valeur | Fichier cible | Garde à mettre à jour | Validation |
|---|---|---|---|---|
| `--color-logo-plate` | `var(--color-surface-inverse)` | `tokens.css` (`@theme` + bloc KEO) | G3c, matrice G3d | Alias prévu (`20` §10) : `expert-ux` |
| `--color-skeleton-base` | `var(--color-surface-raised)` | idem | idem | Alias prévu (`20` §11.8) |
| `--color-skeleton-sheen` | `var(--color-surface-hover)` | idem | idem | idem |
| `--color-network-primary` | `var(--color-data-3)` | idem | idem ; `20` §11.3 à amender (X12) | Validé avec l'écran 3 (07) ; amendement à écrire |
| `--size-measure` | 40 rem | `tokens.css` (`:root`) | — | `expert-ux` |
| `--size-property-label` | 13 rem | idem | — | `expert-ux` |
| `--size-input-number` | 8 rem | idem | — | `expert-ux` |
| `--spacing-bo-panel-w` | 22 rem | `tokens-backoffice.css` | G3f (`-bo-`) | Nom déjà donné par `17b` §1.7 |

S'y ajoutent les animations (`04-animations.md` §2) : `--animate-skeleton`, `--animate-rise-in`,
`--animate-fade-in`, `--animate-flash`, `--animate-flash-strong`, `--animate-pop`,
`--animate-pop-in`, `--animate-done-flash`, `--animate-spin`.

### 3.2 Littéraux rattachés à un token existant (aucun ajout)

| Littéral | Token | Où |
|---|---|---|
| 0,25 · 0,5 · 0,75 · 1 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8 rem | `spacing-1` · `2` · `3` · `4` · `5` · `6` · `7` · `8` · `9` · `10` · `11` · `12` | Barre de tranche, point « non lu », pastilles, flèches de photo, logos 32/40/48/64, avatar, historique |
| 1,25 rem | `size-icon-md` | Point de compteur (`count-dot`), colonne du chevron |
| 1,75 rem (28 px) | `size-bo-control` au backoffice ; **membres : voir `--size-step-marker`** | Pastille d'étape numérotée |
| 2,25 rem (36 px) au backoffice | `spacing-bo-row-h` | Pastilles de filtre et recherche |
| 1 rem (`.otp input`) | `text-md` | Champ du code |
| 40 rem (`rhead h1`) | `size-measure` | Titre de fiche |
| 2 px (`outline-offset`), 1 px | `focus-ring-offset`, `border-width-thin` | Focus, sélection |
| −2 px (`.cc:hover`) | `translate-lift` | Carte du fil |

### 3.3 Longueurs sans équivalent : tokens proposés

Noms par rôle ; valeur **égale** à celle de la maquette (fidélité). Aucune n'est une couleur.

| Token proposé | Valeur | Emploi (maquettes) |
|---|---|---|
| `--size-pill` | 2,5 rem (= `spacing-7`) | Pastille de filtre, membres (2, 8). Alias de `spacing-7` |
| `--size-chip` | 2 rem (= `spacing-6`) | Puce, onglet de vue BO, étiquette BO. Alias |
| `--size-tag` | 2,25 rem | Étiquette retirable, bouton de quantité, crayon, « Voir les visuels », étoile (3, 7, 9, 10, 2b) |
| `--size-step-marker` | 1,75 rem | Numéro d'étape, case ronde, icône du chiffre clé « vérifié » |
| `--size-segment-bar` | 0,375 rem | Segments de l'assistant, jauge, points du carrousel |
| `--size-segment-hit` | −0,625 rem (inset) | Zone de toucher des segments |
| `--size-icon-xs` | 0,75 rem | Icône d'un lien externe ou d'un état fin (13, 15) |
| `--size-icon-alert` | 0,875 rem | Icône d'alerte en cellule, hauteur d'une ligne de squelette, marque ▮ |
| `--size-icon-star` | 1,375 rem | Étoile, touche clavier |
| `--size-icon-heart` | 1,625 rem | Cœur de la carte photo |
| `--size-choice-dense` | 1,125 rem | Case et radio de la colonne de décision |
| `--size-nudge` | 0,125 rem ; `--size-nudge-icon` 0,1875 rem | Alignement optique icône / première ligne ; écart interne des lignes denses |
| `--size-textarea` | 7,5 rem | Hauteur minimale d'une zone de texte ; logo du héros (5b) |
| `--grid-reading` | `minmax(0, 7fr) minmax(19rem, 4fr)` | Lecture à deux colonnes (2b, 5b, 8, 15, 18) |
| `--grid-record` · `--grid-decision` | `minmax(0, 1fr) var(--spacing-bo-panel-w)` | Fiche BO (1 280) ; décision (1 024) |
| `--grid-home` | `minmax(0, 2fr) minmax(0, 1fr)` | Accueils (1 280) |
| `--grid-mosaic` | `2fr 1fr 1fr` | Mosaïque du portfolio |
| `--grid-photo-cards` | `repeat(auto-fill, minmax(18rem, 1fr))` | Grilles 2, 8, 13 (la grille 9 : 17 rem, voir RU-15) |
| `--grid-check` | `9.5rem minmax(0, 1fr) 12rem` | « À contrôler » (5) |
| `--grid-range` | `9rem minmax(0, 1fr) 6.5rem` ; sous 480 px `6.5rem minmax(0, 1fr) 5.5rem` | Barres de tranches |
| `--grid-campaign-row` | `minmax(0, 1fr) 15rem 5.5rem 1.25rem` | « Mes campagnes » |
| `--grid-timeline` | `7.5rem minmax(0, 1fr)` ; marque : `8rem` | Journal BO (6, 17) ; historique (18) |
| `--grid-verification-row` | `7rem minmax(0, 1fr)` | Vérifications (14) |
| `--grid-sync` | `4rem minmax(0, 1fr)` | Synchronisation (6, 17) |
| `--size-property-label-6` · `-7` · `-7h` · `-8` · `-8h` · `-9` · `-10` · `-11` · `-12` | 6 · 7 · 7,5 · 8 · 8,5 · 9 · 10 · 11 · 12 rem | `props` : 6 (identité BO 6, 17) · 7 (4, 16) · 7,5 (colonne 6, 17) · 8 (5) · 8,5 (18 < 640) · 9 (2b, 15) · 10 (21) · 11 (récapitulatifs 3, 7, 10 ; 17) · 12 (8, 14, 18) ; 13 = `--size-property-label` (RU-16) |
| `--container-form` · `--container-form-wide` | 28 rem · 36 rem | Entrée (11) |
| `--container-dialog` · `--container-filters` · `--container-confirm` | 30 · 42 · 34 rem | Dialogues |
| `--container-gallery` · `--container-title` | 56 rem · 46 rem | Galerie ; titre du profil anonyme, propriétés |
| `--container-bo-form` · `--container-bo-page` | 52 rem · 60 rem | Administration (21) |
| `--container-feed-card` · `--container-brand-card` · `--container-danger` | 26 · 34 · 32 rem | Aperçu de carte (7) ; carte marque (10) ; suppression (9) |
| `--size-select-add` · `--size-select-add-max` · `--size-sort` · `--size-search` · `--size-date` · `--size-otp` | 13 · 20 · 14 · 15 · 12 · 22 rem | Ajout, tri, recherche, date et code, cases |
| `--size-note-min` · `--size-note-max` | 12 · 16 rem | Note du tableau (9) |
| `--container-field-xs` · `-sm` · `-md` · `-lg` · `-xl` | 16 · 18 · 20 · 22 · 26 rem | Largeurs **en ligne** (`style=`) de champs et listes : 16 (7, 20, 21) · 18 (2, 13, 21) · 20 (4 cas) · 22 (2, 3, 7, 13) · 26 (20) |
| `--size-alert-code` | 3,25 rem | Code d'une alerte (4) |
| `--offset-link` · `--offset-icon-baseline` | 0,2 em · −0,15 et −0,2 em | Soulignement ; icône dans une ligne de texte |
| `--size-nudge-hair` | 0,0625 rem | Icône de tâche, marque ▮ |
| `--size-thumb` · `--size-thumb-min` | 3,5 rem · 7 rem | Vignettes (9) ; vignettes de fiche (6, 17) |
| `--size-mobile-space-search` · `-reading` · `-wizard` | 3,75 · 4,25 · 4,5 rem | Réserve sous la barre collante : 2 · 2b, 5b, 8, 18 · 3, 7, 10 (RU-15) |
| `--ratio-photo` · `--ratio-mosaic` · `--ratio-otp` | 4/3 · 2/1 · 5/6 | Photos, mosaïque, cases du code |
| `--size-overlay-max` | 85 dvh | Dialogue « Filtres » |
| `--tracking-code` · `--tracking-phrase` | 0,06 em (14) et 0,3 em (20) · 0,02 em (11) | Codes ; phrase de correspondance |

### 3.4 Littéraux à arbitrer (aucune valeur arrêtée ici)

| Littéral | Problème | Décision |
|---|---|---|
| `clamp(1,625rem…2,125rem)`, `clamp(1,75rem…2,25rem)`, `text-lead`, `text-heading-3` | Interdits sous KEO (TK7.3) | **RU-01** (X1) |
| Ombre portée `rgba(0,0,0,.5)` (cœur, case ronde) ; voiles `color-mix` à 45, 75, 82 % | Couleur translucide hors tokens ; `color-mix` borné aux halos | **RU-04** (X4) |
| Opacités 0,45 · 0,5 · 0,55 | Contraste cassé (axe : 3,66:1, 3,72:1, 1,52:1 et 4,17:1) | **RU-04**, **RU-09** |
| `shadow-md` de `.box` | `20` §11.5 : cartes plates au repos | **RU-05** (X5) |
| Seuils 640 et 1 536 px | Absents des points de rupture | **RU-03** (X3) |
| `scale` 0,9 (appui du cœur), 0,96 (carte qui sort) | Hors `scale-press` 0,98 | **RU-06** |
| Dégradés de `.visual` et de `.avatar` | Visuel de démonstration : remplacé par l'image réelle ; l'avatar garde-t-il un dégradé ? | **RU-07** |
| `--color-action-primary-text`, `--color-surface-input` | Noms inexistants ; la maquette rend leur repli : `text-inverse`, `surface-raised` | Prendre le repli rendu ; **RU-08** pour les cases du code (les champs KEO sont en `surface-page`) |

## 4. Règles de composition à appliquer

1. **Un seul cadre de page** : `container-max` (1 200 px), aligné à gauche, gouttière
   `spacing-page-gutter`, haut `spacing-section-header`, halo d'en-tête unique, hauteur minimale
   `size-header-glow`. Pages de lecture et de formulaire : `container-narrow` (768 px).
2. **Trois niveaux de surface au plus** (page, carte, bloc intérieur). Une section n'a pas de carte :
   filet `border-default`, espacement du niveau.
3. **Espacement décroissant** : section (48 px ≥ 1 024, 32 px sinon) > titre-contenu (24) > champs
   (24) > carte compacte (16) > icône-libellé (8 minimum).
4. **Une seule action principale** par zone de vue.
5. **État durable = badge** ; notice réservée à un événement ou à un avertissement.
6. **Liens** : `link` souligné dans une phrase ; `go` (chevron) pour « voir plus ». Jamais un bouton
   qui mène au même endroit que la carte ou la ligne.
7. **Couleur jamais seule** : icône, mot ou forme.
8. **Backoffice** : une surface par écran ; tableaux sans cadre quand ils sont dans une surface ;
   première colonne = identité et lien de ligne.
9. Aucune classe utilitaire propre à un écran quand un composant du catalogue existe.

## 5. Mises à jour de spécification attendues (avant le code, règle d'or)

| Document | Amendement | Arbitre |
|---|---|---|
| `20` §10, §11.3 | 8 tokens de §3.1 ; étoile du compte principal (X12) ; règle du badge vérifié si X2 est acceptée | fondateur, `expert-ux` |
| `20` §11.5 | Tailles de titre de fiche (X1), ombre de l'encadré (X5), voiles sur photo (X4), animations de `04-animations.md` | fondateur, `expert-ux` |
| `20` §11.8 | Composants `Section`, `InnerPanel`, `RowList`, `PropertyList`, `ErrorSummary`, `Wizard`, `PhotoCard`, `FiltersDialog`, galerie ; onglets segmentés (X6) | `expert-ux` |
| `04-DIRECTION-ARTISTIQUE` §9 | Exceptions validées : dialogue « Filtres » et galerie plein écran (07) | `expert-ux` |
| `17`, `17b`, specs de domaine | Liste par écran dans `06b-ecarts-et-anomalies.md` §4 | `product-owner` |
| Skill `design-system-influx` (`references/`) | Nouveaux tokens et gabarits | `expert-ux` |
