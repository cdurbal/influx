# RUA-A — Modèle UX : tokens et choix de charte du Lot 3bis
> `expert-ux`, 2026-11-25 · prime sur `R03` §3.3 pour tout nom · F0 « oui partout » (Q1 à Q6) · aucune couleur nouvelle (D6) · *M.* = motif.

## 1. Tokens (valeur = maquette)
Sauf mention : `TS`, `:root`, nom et valeur de `R03` §3. `-bo-` : `BO`, `@theme static` (convention du fichier). `--container-*` : `:root` des deux fichiers (comme `container-max`, G3i). `--text-*`, `--tracking-*`, `--aspect-*`, `--animate-*` en `@theme` (espaces Tailwind). Rien n'est redéfini sous KEO sauf mention.

| Token = valeur | Où | Emploi |
|---|---|---|
| `color-logo-plate` = `surface-inverse` · `color-skeleton-base` = `surface-raised` · `-sheen` = `surface-hover` | `@theme` + bloc KEO (cible redéfinie, G3c) | Logo (initiales `text-inverse`) ; C09 |
| `color-network-primary` = `data-3` | `@theme`, `KEO_INHERITS` | Étoile du compte principal (3, 2b, 15 ; BO 6, 17), F0 Q4 |
| `effect-photo-scrim-strong` · `-scrim` · `-scrim-soft` = `surface-page` à 82 · 75 · 45 % ; `effect-photo-shadow` = `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))` | `@theme` neutre, bloc KEO ; forme : B §4 | Badge sombre (2, 13) · compteur (2b, 15) · cœur, case ronde (2, 13) ; ombre (2, 9, 13). F0 Q2 |
| `effect-media-hover` = `brightness(0.85)` · `scale-heart-press` 0.9 · `scale-leave` 0.96 | | RU-06 (§3) |
| `duration-celebrate` 900ms · `-spin` 1s · `-skeleton` 1.2s | réduit : `celebrate`, `spin` → `duration-instant` | §4 |
| `tracking-code` 0.06em · `-code-entry` 0.3em · `-phrase` 0.02em | `@theme` | 14 · 20 · 11 |
| `aspect-photo` 4 / 3 · `-mosaic` 2 / 1 · `-otp` 5 / 6 | `@theme` | *M.* espace `aspect-*` (`aspect-card-id1`), pas `--ratio-*` |
| `size-pill` = `spacing-7` · `size-chip` = `spacing-6` · `size-tag` 2.25rem · `size-step-marker` 1.75rem · `size-segment-bar` 0.375rem · `size-icon-xs` 0.75rem · `size-icon-star` 1.375rem · `size-icon-heart` 1.625rem · `size-nudge` 0.125rem · `-nudge-icon` 0.1875rem · `-nudge-hair` 0.0625rem · `size-textarea` 7.5rem · `size-input-number` 8rem · `size-thumb` 3.5rem | | |
| `inset-segment-hit` −0.625rem | | *M.* un décalage (`inset-hero-halo-*`) ; zone de 26 px |
| `size-icon-dense` 0.875rem · `size-skeleton-line` = `text-sm` · `size-logo-hero` 7.5rem (5b) | | *M.* `size-icon-alert` portait trois rôles ; un logo n'est pas un champ |
| `size-select-add` 13 · `-select-add-max` 20 · `size-sort` 14 · `size-search` 15 · `size-date` 12 · `size-otp` 22 · `size-note-min` 12 · `-note-max` 16rem | | `size-feed-sort` (18) intact (G3e) |
| `size-mobile-space-search` 3.75 · `-reading` 4.25 · `-wizard` 4.5rem · `size-overlay-max` 85dvh | | RU-15 |
| `offset-link` 0.2em · `offset-icon-baseline` −0.15em · `-baseline-xs` −0.2em | | `-xs` : icône dans une ligne `text-xs` |
| `measure-wide` 46rem | | *M.* famille `measure-*` (titre du profil anonyme, propriétés de 8, 18), au lieu de `container-title` |
| `container-form` 28 · `-form-wide` 36 · `-dialog` 30 · `-filters` 42 · `-confirm` 34 · `-gallery` 56 · `-feed-card` 26 · `-brand-card` 34 · `-danger` 32 · `-field-xs/-sm/-md/-lg/-xl` 16/18/20/22/26rem | | |
| `grid-reading` · `grid-home` · `grid-mosaic` · `grid-photo-cards` (18rem) · `grid-photo-cards-narrow` (17rem, 9) · `grid-campaign-row` (fin `size-icon-md`) · `grid-timeline` 8rem (18) · `grid-verification-row` | | |
| `grid-range` = `6.5rem minmax(0, 1fr) 5.5rem`, dès 480 px `9rem minmax(0, 1fr) 6.5rem` | media `:root` | *M.* jeton réactif mobile-first (`spacing-grid-gap`) |
| `spacing-bo-panel-w` 22rem · `grid-bo-panel` = `minmax(0, 1fr) var(--spacing-bo-panel-w)` | `BO` | Fiche (6, 17) et décision (5). *M.* `grid-record` et `grid-decision` : même valeur, même rôle |
| `grid-bo-check` (5) · `grid-bo-timeline` 7.5rem (6, 17) · `grid-bo-sync` (6, 17) · `size-bo-choice-dense` 1.125 · `size-bo-alert-code` 3.25 · `size-bo-kbd` 1.375 (`.kbd`) · `size-bo-thumb-min` 7rem · `container-bo-form` 52 · `-bo-page` 60rem | `BO` | Seul backoffice (G3f) |

**Non retenus :** `size-measure` → `measure-text` (40 rem, même rôle) ; noms chiffrés → §2 ; `.visual` (décor) → l'image réelle. `R03` §3.2 accepté (40 rem → `measure-text`). Hors `R03` : ligne de secours (21, avertissement à 50 %) → `feedback-warning-bg` opaque, l'icône et le mot portent l'état (EC-RUA-A-1) ; logo de fiche BO 3,5 rem (6, 17) → `size-thumb`.

## 2. RU-01 et RU-16
Paliers < 768 · 768 à 1 023 · ≥ 1 024 : `@theme` puis `:root` aux deux seuils, forme de `text-title-page` ; Manrope 800.
| Rôle (maquette) | Token | Tailles (rem) | Interligne |
|---|---|---|---|
| Titre de fiche (8, 18) | `text-title-detail` | 1.625 · 1.875 · 2.125 | `leading-heading`, `tracking-heading` |
| Héros (5b) | `text-title-hero` | 1.75 · 2 · 2.25 | idem |
| Chiffre clé, `text-lead` (2b, 5b, 15) | `text-key-figure` | 1.125 · 1.1875 · 1.25 | `leading-tight`, tabulaire |
| Chiffre d'encadré, `text-heading-3` (5b, 8, 18 ; initiales du logo de 5b) | `text-aside-figure` | 1.25 · 1.375 · 1.5 | idem |

RU-16, largeur de libellé par rôle : `size-property-label` 13 (défaut) · `-summary` 11 (récapitulatifs 3, 7, 10 ; BO 17) · `-reading` 12 (5b, 8, 14, 18) · `-reading-compact` 8.5 (18 sous 640) · `-terms` 9 (« Conditions », 2b, 15) ; `BO` : `size-bo-label-identified` 6 (6, 17) · `-compact` 7 (4, 16) · `-side` 7.5 (6, 17) · `-decision` 8 (5) · `-dual-control` 10 (21). *M.* rôle, pas valeur.

## 3. Phrases de charte (`20`)
- **RU-06** (§11.5 Mouvement) : « Sous `motion-safe:` : appui du cœur `scale-heart-press`, carte retirée `scale-leave`. Survol d'un visuel de mosaïque : `effect-media-hover`, sans transformation, gardé sous mouvement réduit. Réseau complet : `duration-celebrate`. »
- **RU-07** (§11.8, Avatar) : « Disque `surface-active` uni, initiales `text-primary` Manrope 700 ; ni dégradé ni `data-*`. » *M.* `data-*` : graphiques seuls ; écart de 2b, 15 en `06b` §7 ; contenu : RU-34.
- **RU-08** (§11.8, C49) : « Cases `surface-raised`, contour `border-strong` 1 px, `radius-md`, `aspect-otp` ; courante `focus-ring` 2 px ; erreur `border-error` 2 px. Seule exception au champ en `surface-page`. » §11.5 Formes : « cases du code » passe de `radius-sm` à `radius-md` (maquette).
- **RU-09** (§11.8) : « Désactivé ou inerte : jamais d'opacité. Bouton `action-disabled-bg` + `text-disabled` ; case ronde : contour `text-disabled` (case à cocher : règle L3C-X3) ; une phrase adjacente dit pourquoi ; jamais `aria-hidden` sur un bouton. » Liste : 15 (`.inert`, RU-43), 21 (`.dvp`), 13 (case ronde ; photo d'une carte bloquée rendue entière, état dit par `.blk`) ; points de carrousel inactifs `text-secondary`, l'actif `text-primary` et plus large (2, 13) ; écarts en `06b` §7.
- **RU-10** (§11.8, onglets segmentés) : « Permis (1) pour un choix exclusif de formulaire, en `radio` (droits d'usage, langue, oui / non, réseau) ; (2) pour deux vues d'un même contenu (cartes / tableau, avant / après, à traiter / normaux), en `tablist`, ou en liens `aria-current` si chaque vue a son adresse ; (3) pour les canaux (§7). Jamais pour une rubrique ni une page (D74). »
- **RU-11** (§11.3, `surface-active`) : « Appui du bouton secondaire ; segment, onglet, vue et pastille de filtre actifs ; pistes de jauge, de segments et de tranche ; avatar. Dessus : `text-primary`, `text-secondary` (compteur d'onglet actif) ; jamais `text-tertiary` ni texte d'erreur. »
- **RU-12** (§11.8) : « Région défilante : `tabindex="0"` et nom ; `dl` en paires `dt`/`dd` ; pas d'`aria-label` sur un élément sans rôle ; repères nommés ; titres sans saut ; cible ≥ 24 px (liens de 13) ; un `h1` par page. »
- **RU-15** : chaque écran selon sa maquette (grilles 18 et 17 rem, réserves du §1, vide de 12 en carte), sauf la densité `bo` de 13 et le badge de rôle (C15), dont la graisse ne s'hérite jamais (6).
- **RU-19** (§11.8, gabarit 768 à 1 023) : « La bande existante reste, compteurs compris ; ces largeurs du backoffice sont hors comparaison (N1 à N3). »

## 4. Animations et contrastes
Noms de `R04` §2 ; `--animate-<nom>` = `<nom> <durée> ease-standard`, images clés de `R04` §2 (`rise-in` part de −`spacing-1`) : `fade-in` `duration-fast` · `rise-in`, `pop` `duration-base` · `flash`, `flash-strong`, `pop-in` `duration-slow` · `done-flash` `duration-celebrate` ; `spin`, `skeleton` : `duration-spin`, `duration-skeleton`, `linear infinite` ; squelette `animation: none` sous mouvement réduit (AN-1).

`CONTRAST_MATRIX.keo`, à ajouter : `network-primary` × `CARD`, `RAISED`, `HOVER` à 3:1 (9,99 · 9,18 · 8,17) ; `text-inverse` × `logo-plate`, `surface-inverse` à 4,5:1 (17,46) ; `text-inverse` × `action-primary-bg` à 3:1 (case cochée, 9,96). Dérivées (forme : B, comme `GLOW_PEAK`) : `text-primary` sur voile 82 % et 75 % posé sur blanc, pire cas, 4,5:1 (11,02 · 8,45) ; voile 45 % : décor (2,90), le bord tient par `effect-photo-shadow`. Déjà là : `text-*` × `ACTIVE`, `border-strong` × `RAISED`.

## 5. Ce que `20` doit dire (ligne 00)
- §10 : `color-logo-plate` entre dans `tokens.css` (RUA-01), initiales `text-inverse`.
- §11.3 : `logo-plate`, `skeleton-*` ; RU-11 ; **RU-13** : `network-primary`, seule couleur `data-*` hors graphique, toujours avec « compte principal » écrit ou lu ; RU-02 : F3 amendé pour la seule carte photo (F0 Q6, juriste D34 à venir) ; bloc KEO : nouveaux rôles.
- §11.5 : RU-01 ; **RU-17** : `h1` de compte (20) et de vérifications (14) en `text-title-section` 800, des assistants (3, 7, 10) et de l'entrée (11, `R03` §2) en 700 ; **RU-05** : `shadow-md` au repos sur le seul encadré collant (C39 : 2b, 5b, 8, 15, 18) ; **RU-04** : `effect-photo-*` sur un élément posé sur une photo seulement, `color-mix` selon B §4 ; RU-06 ; Formes (RU-08).
- §11.8 : RU-07 à RU-10, RU-12, RU-19 ; Squelette : `animate-skeleton` ; badge vérifié : date complète (EC-L2E-9) ; en-tête : RU-17.

Couverture `R03` §3 : §3.1 8/8 (une non retenue) ; §3.2 accepté ; §3.3 nommé (§1, §2) ; §3.4 tranché (§1 à §4), seuils 640 et 1 536 : B (RU-03).
