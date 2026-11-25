# Tokens, seuils, animations et planche du Lot 3bis (D88)

À lire pour **nommer ou employer un token issu des maquettes**, un seuil, une animation ou une taille de titre.
Sources : `docs/mvp/20-direction-design.md` §11 (amendé en RUA-00), `02` §21.3, D88 ; valeurs : `tokens.css` et
`tokens-backoffice.css`. Une valeur de maquette = un token de même valeur, nommé par rôle ; aucune couleur nouvelle (D6).

## Seuils et gardes

- `--breakpoint-form` 640 px (`tokens.css`) ; variante `bo-wide` 1 536 px (`tokens-backoffice.css`, avant `bo-small`).
- Sous KEO, aucun `clamp(` ni `vw` dans un `--text-*` ou `--tracking-*` : trois paliers fixes (< 768, 768 à 1 023, ≥ 1 024).
- Tokens `-bo-` : `tokens-backoffice.css` seul, jamais dans `apps/web` (G3f). `color-mix` : forme de G3i seulement
  (`base` et `percent` exacts). Aucun `/NN`, aucune opacité numérique, bloc KEO opaque (G3c).

## Couleurs et effets

`color-logo-plate` (logo, initiales `text-inverse`) · `color-skeleton-base`, `color-skeleton-sheen` ·
`color-network-primary` = `data-3` (étoile du compte principal, seule couleur `data-*` hors graphique, toujours
avec « compte principal » lu ou écrit) · `effect-photo-scrim-strong`, `effect-photo-scrim`, `effect-photo-scrim-soft`,
`effect-photo-shadow` (bornés aux éléments posés sur une photo) · `effect-media-hover` · `scale-heart-press` ·
`scale-leave` · `duration-celebrate` · `duration-spin` · `duration-skeleton` (réduit : `celebrate` et `spin` à
`duration-instant`, squelette `animation: none`).

## Animations (`--animate-*`, `<nom> <durée> ease-standard`)

`fade-in` (`duration-fast`) · `rise-in`, `pop` (`duration-base`) · `flash`, `flash-strong`, `pop-in`
(`duration-slow`) · `done-flash` (`duration-celebrate`) · `spin`, `skeleton` (`linear infinite`). Mouvement réduit :
durées à 0, aucune transformation. Jamais `transition: all`, ni `height`, ni `max-height` animés.

## Tailles de titre (RU-01) et libellés (RU-16)

| Token | rem (< 768 · 768 à 1 023 · ≥ 1 024) | Emploi |
|---|---|---|
| `text-title-detail` | 1,625 · 1,875 · 2,125 | Titre de fiche |
| `text-title-hero` | 1,75 · 2 · 2,25 | Héros |
| `text-key-figure` | 1,125 · 1,1875 · 1,25 | Chiffre clé |
| `text-aside-figure` | 1,25 · 1,375 · 1,5 | Chiffre d'encadré |

`h1` : compte et vérifications en `text-title-section` 800 ; assistants et entrée en 700 (RU-17).
Largeurs de libellé par rôle : `size-property-label` (défaut) · `size-property-label-summary` · `-reading` ·
`-reading-compact` · `-terms` ; backoffice : `size-bo-label-identified` · `-compact` · `-side` · `-decision` · `-dual-control`.

## Typographie, ratios, tailles, décalages

- `tracking-code`, `tracking-code-entry`, `tracking-phrase` ; `aspect-photo`, `aspect-mosaic`, `aspect-otp`.
- `size-pill`, `size-chip`, `size-tag`, `size-step-marker`, `size-segment-bar`, `size-icon-xs`, `size-icon-star`,
  `size-icon-heart`, `size-icon-dense`, `size-nudge`, `size-nudge-icon`, `size-nudge-hair`, `size-textarea`,
  `size-input-number`, `size-thumb`, `size-skeleton-line`, `size-logo-hero`, `size-select-add`, `size-select-add-max`,
  `size-sort`, `size-search`, `size-date`, `size-otp`, `size-note-min`, `size-note-max`, `size-mobile-space-search`,
  `size-mobile-space-reading`, `size-mobile-space-wizard`, `size-overlay-max` (noms exacts : `tokens.css`).
- `inset-segment-hit` · `offset-link`, `offset-icon-baseline`, `offset-icon-baseline-xs` · `measure-wide`,
  `measure-text` (40 rem).
- `container-form`, `container-form-wide`, `container-dialog`, `container-filters`, `container-confirm`,
  `container-gallery`, `container-feed-card`, `container-brand-card`, `container-danger`, `container-field-xs`,
  `-sm`, `-md`, `-lg`, `-xl`.
- Grilles : `grid-reading`, `grid-home`, `grid-mosaic`, `grid-photo-cards`, `grid-photo-cards-narrow`,
  `grid-campaign-row`, `grid-timeline`, `grid-verification-row`, `grid-range` (jeton réactif, 480 px).
- Backoffice (`-bo-`, G3f) : `spacing-bo-panel-w`, `grid-bo-panel`, `grid-bo-check`, `grid-bo-timeline`,
  `grid-bo-sync`, `size-bo-choice-dense`, `size-bo-alert-code`, `size-bo-kbd`, `size-bo-thumb-min`,
  `container-bo-form`, `container-bo-page`.

## Règles de composants (`20` §11.8)

- **Chevron** : décoratif, en fin de ligne (liste de lignes, page-menu), jamais seul porteur d'information.
- **Onglets segmentés** (RU-10) : (1) choix exclusif de formulaire en `radio` ; (2) deux vues d'un même contenu en
  `tablist`, ou liens `aria-current` si chaque vue a son adresse ; (3) canaux d'une conversation. **Jamais une
  rubrique ni une page** (D74).
- **Désactivé** (RU-09) : jamais d'opacité (`action-disabled-bg`, `text-disabled`), une phrase dit pourquoi, jamais
  `aria-hidden` sur un bouton. **Avatar** (RU-07) : disque `surface-active` uni. **Cases du code** (RU-08) :
  `surface-raised`, `radius-md`, `aspect-otp`. **`surface-active`** (RU-11) : dessus `text-primary` ou
  `text-secondary`, jamais `text-tertiary`. **Encadré collant** (RU-05) : `shadow-md` au repos, lui seul.
- **Accessibilité sans effet visuel** (RU-12) : région défilante `tabindex="0"` et nom, `dl` en `dt`/`dd`, un `h1`.
- **Badge « vérifié »** (RU-02) : icône bleue avec texte accessible sur la carte photo, badge daté complet sur la
  fiche ; sous réserve du juriste (D34).

## Planche d'états (RU-27, F1)

Les huit familles de `docs/audit-ux-ui/prototypes/planche-etats.html` valent (F1 : « oui à toutes les questions ») :
F1 première visite et bascule de l'accueil · F2 état durable du profil · F3 campagne à corriger, pause, clôture ·
F4 vérification de compte et d'audience · F5 sélections (zéro liste, choix, création) · F6 note qui s'enregistre
(échec, hors ligne, limite) · F7 backoffice : verrou, alertes, lecture seule, second avis · F8 backoffice : pastille
ouverte, filtre actif, pages. Écarts acceptés : C17 à trois tons (alerte en warning, neutre en info), notice sous un
badge d'état durable (U46), « Réinitialiser » (C08), aucun rendu du backoffice à 375 px. Planche de composants
(`pageExtensions`, `INFLUX_ENV` et `INFLUX_STATE_BOARD`) : hors production, jamais une page du produit.
