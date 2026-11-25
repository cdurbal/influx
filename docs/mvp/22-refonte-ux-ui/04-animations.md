# 04 — Animations et micro-interactions du Lot 3bis

> Sources : `prototypes/interactions.html` (catalogue validé), `keo.css`, styles et scripts des
> `proto-*.html`, `docs/audit-ux-ui/04` §12. **Aucune bibliothèque** : CSS `transition`,
> `@keyframes`, `@starting-style`, `transition-behavior: allow-discrete`, `position: sticky`.

## 1. Règles

1. Propriétés animées : `opacity`, `translate`, `scale`, `rotate`, couleurs, `box-shadow`, `fill`.
   Jamais une hauteur. La largeur n'est animée que sur la jauge (`.bar > span`) et le point de
   carrousel actif (`.ph__dots span`), comme dans les maquettes.
2. Durées et courbes par tokens : `duration-fast` 120 ms, `duration-base` 200 ms,
   `duration-slow` 320 ms ; entrée `ease-standard` `cubic-bezier(0.2, 0, 0, 1)`, sortie `ease-exit`
   `cubic-bezier(0.4, 0, 1, 1)`. Propriétés nommées, jamais `transition: all`.
3. Transformations sous `motion-safe:` seulement. Sous `prefers-reduced-motion: reduce`, les trois
   durées valent 0 ms (déjà câblé dans `tokens.css`) et aucune transformation n'a lieu ; l'état final
   est complet et lisible.
4. Un mouvement ne retarde jamais une action : rien n'attend la fin d'une animation, sauf le retrait
   d'une carte de sélection (ligne 22).
5. Navigation entre pages : aucune animation, focus sur le `h1` (existant, inchangé).
6. Exclus : apparition au défilement, animation liée au défilement, défilement simulé, rebond,
   chiffres qui défilent, pile de notifications.

## 2. Images clés (tokens `--animate-*` à déclarer)

| Token | Image clé | Durée · courbe · répétition |
|---|---|---|
| `--animate-fade-in` | `opacity` 0 → 1 | `duration-fast` · standard · 1 |
| `--animate-rise-in` | `opacity` 0 → 1, `translate` 0 −0,25 rem → 0 | `duration-base` · standard · 1 |
| `--animate-flash` | fond `surface-raised` → transparent | `duration-slow` · standard · 1 |
| `--animate-flash-strong` | fond `surface-active` → transparent | `duration-slow` · standard · 1 |
| `--animate-pop` | `scale` 1 → 1,2 (50 %) → 1 | `duration-base` · standard · 1 |
| `--animate-pop-in` | `scale` 0,6 et `opacity` 0 → 1,15 et 1 (60 %) → 1 | `duration-slow` · standard · 1 |
| `--animate-done-flash` | fond `feedback-success-bg` → transparent | 900 ms · standard · 1 (**RU-06** : durée hors tokens) |
| `--animate-spin` | `rotate` 0 → 360° | 1 s · linéaire · infini, le temps de l'envoi |
| `--animate-skeleton` | `translate` −100 % → 100 % d'un dégradé `skeleton-sheen` | 1,2 s · linéaire · infini |

## 3. Catalogue

| # | Élément (composant) | Déclencheur | Propriété | Durée · courbe | Téléphone | Mouvement réduit | Écrans | État |
|---|---|---|---|---|---|---|---|---|
| 1 | Bouton principal, secondaire (C10) | Survol, appui | Couleurs, ombre, `scale` 1,03 / 0,98 | 120 · standard | Appui seul | Couleurs seules | Tous (pas les petits boutons BO, RK-4) | Existant |
| 2 | Carte cliquable (C04), carte du fil (C48) | Survol | Contour, fond, `translate` −2 px | 120 · standard | Sans effet | Couleurs seules | 1, 8 | Existant (C04), à étendre (C48) |
| 3 | Lien « › » (C11) | Survol | Chevron `translate` 2 px | 120 · standard | Sans effet | Aucun | Tous | À créer |
| 4 | Ligne (C06) | Survol, focus | Fond `surface-raised` | 120 · standard | Sans effet | Couleur seule | 1, 3, 9, 10, 12, 14, 20 | À créer |
| 5 | Ligne de tableau (C58) | Survol, focus | Fond + filet intérieur de 2 px (`effect-bo-row-indicator`) | 120 · standard | — | Identique | 4, 6, 16, 21 | Existant |
| 6 | Pastille de filtre (C30), segment (C22) | Survol, choix | Contour, fond, couleur | 120 · standard | Choix | Identique | 2, 3, 7 à 11, 13, 15, 16, 20, 21 | À créer |
| 7 | Dialogue (C27) et dialogue « Filtres » (C28) | Ouverture | `opacity`, `scale` 0,98 → 1, voile | 200 · standard | C28 plein écran sous 768 px | Fondu instantané | 2, 4, 5, 13, 16 | À créer |
| 8 | idem | Fermeture | `opacity`, `scale`, voile | 120 · sortie | idem | Instantané | idem | À créer |
| 9 | Galerie (C34) | Ouverture | Dialogue sans échelle propre | 200 · standard | Carrousel dans la page | Instantané | 2b, 15 | À créer |
| 10 | Visuel de la mosaïque (C34) | Survol | `filter: brightness(0.85)` | 120 · standard | Sans effet | Identique | 2b, 15 | À créer (**RU-06** : littéral) |
| 11 | Piste de photos (C31) | Flèche | Défilement `smooth`, aimanté | Navigateur | Balayage | Défilement direct | 2, 13 | À créer |
| 12 | Flèches de photo (C31) | Survol, focus | `opacity` 0 → 1 | 120 · standard | Masquées (`hover: none`) | Identique | 2, 13 | À créer |
| 13 | Point de photo actif (C31) | Défilement | `opacity`, `width` 0,375 → 1 rem | 120 · standard | Identique | Instantané | 2, 13 | À créer |
| 14 | Cœur (C31) | Survol, appui | `scale` 1,03 / 0,9 | 120 · standard | Appui | Aucun | 2, 9 | À créer (**RU-06**) |
| 15 | Cœur | Ajout | `--animate-pop` + `fill` | 200 · standard | Identique | `fill` seul | 2 | À créer |
| 16 | Bouton « Ajouté » (C10) | Ajout | Icône en fondu, contour apaisé | 120 · standard | Identique | Instantané | 2b | À créer |
| 17 | Compteur (C16) | Valeur changée | `--animate-flash-strong` sur son conteneur | 320 · standard | Identique | Aucun fond, annonce seule | 2, 4 (rail) | À créer |
| 18 | Ligne nouvelle, entrée suivante (C58) | Arrivée | `--animate-flash-strong` | 320 · standard | — | Aucun | 4, 5, 16 | À créer |
| 19 | Accordéon, `details` (C26) | Ouverture | Contenu `--animate-rise-in` | 200 · standard | Identique | Fondu instantané | 3, 4, 6, 7, 10, 11, 12, 14, 17, 18, 20, 21 | À créer |
| 20 | Chevron (C26) | Ouverture | `rotate` 90° (chevron droit) ou 180° (chevron bas) | 200 · standard ; panneau des gestes rares : 120 | Identique | Instantané | idem | Existant, à généraliser |
| 21 | Champ conditionnel, aperçu, aide (C18, C05) | Apparition | `--animate-rise-in` | 200 · standard | Identique | Fondu instantané | 7, 10, 11, 14, 19 | À créer |
| 22 | Carte retirée d'une sélection (C31) | Retrait | `opacity` → 0, `scale` → 0,96, puis retrait | 200 · standard | Identique | Retrait immédiat | 9 | À créer (**RU-06**) |
| 23 | Étape de l'assistant (C41) | Changement | `--animate-fade-in`, focus sur le `h2` | 120 · standard | Identique | Instantané | 3, 7, 10 | À créer |
| 24 | Segments de progression (C41) | Étape faite | Fond | 320 · standard | Identique | Instantané | 3, 7, 10 | À créer |
| 25 | Jauge (C43) | Tâche faite | `width` | 320 · standard | Identique | Instantané | 1 | À créer |
| 26 | Réseau complet (C44) | Passage à « Complet » | Badge `--animate-pop-in` ; en-tête `--animate-done-flash` | 320 ; 900 ms | Identique | Aucun, badge présent | 3 | À créer |
| 27 | Étoile (C44) | Choix du compte principal | `--animate-pop-in`, `fill` | 320 ; 120 | Identique | `fill` seul | 3 | À créer |
| 28 | Réseau ouvert (C44) | Ouverture | Fond `surface-raised` ; contenu `--animate-rise-in` | 200 · standard | Identique | Instantané | 3 | À créer |
| 29 | Statut d'enregistrement (C25) | Envoi | Icône `--animate-spin` | 1 s linéaire | Dans la barre collante | Icône fixe | 3, 7, 10, 20 | À créer |
| 30 | Champ en erreur (C18) | Validation | Contour 1 → 2 px (couleur) ; message sans animation | 120 · standard | Identique | Instantané | Formulaires | Existant |
| 31 | Case du code (C49) | Saisie | Contour | 120 · standard | Identique | Identique | 11 | À créer |
| 32 | Squelette (C09) | Chargement | `--animate-skeleton` | 1,2 s linéaire | Identique | Statique | 2, 13 | À créer |
| 33 | Colonnes de contexte (C39, C59) | Défilement | `position: sticky` (aucune animation) | — | Sous le contenu | — | 2b, 5, 5b, 8, 15, 18 | À créer |

Panneau du bas (`.sheet`) : décrit dans `interactions.html`, **employé par aucune maquette d'écran**
(la recherche utilise le dialogue « Filtres »). Il n'est pas développé dans ce lot.

## 4. Annonces et focus liés au mouvement

| Moment | Focus | Annonce (C29) |
|---|---|---|
| Ouverture d'un dialogue | Élément `autofocus`, sinon titre | Nom accessible du dialogue |
| Fermeture | Rendu au déclencheur | — |
| Changement d'étape | `h2` de l'étape, sans anneau (D75 RK-13) | — |
| Ajout ou retrait d'un créateur | Reste sur le bouton | « ⟨alias⟩ ajouté à « ⟨liste⟩ » (n créateurs). » |
| Réseau complet | Inchangé | « ⟨réseau⟩ : complet » (texte exact dans E03) |
| Enregistrement | Inchangé | Seulement en cas d'échec, une fois |
| Contenu chargé | Inchangé, `aria-busy` à `false` | Nombre de résultats |

## 5. Critères

- **AN-1** : sous mouvement réduit, aucune propriété `scale`, `translate` ou `rotate` calculée ne
  change et chaque durée calculée vaut 0 s (hors squelette : `animation-name: none`).
- **AN-2** : chaque ligne du catalogue « À créer » a un cas dans une spec Playwright qui lit durée,
  courbe et propriété calculées.
- **AN-3** : aucune dépendance ajoutée ; `package.json` inchangé.
- **AN-4** : aucune transition ne porte sur `all`, `height` ou `max-height`.
