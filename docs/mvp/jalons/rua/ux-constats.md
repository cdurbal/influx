# RUA-U — constats `expert-ux` (2026-11-25), sans commit
Sources : fiche, `modele-ux.md` (A), `20` §11, `tokens.css`, `tokens-backoffice.css`, `charter-data.ts`, planche `state-board`, `planche-etats.html`, `proto-*.html` et leurs `assets/`. F1 : « oui à toutes les questions ».

**Limite de la preuve.** Session sans shell ni navigateur : ni Next, ni Chromium, aucune capture. La « valeur rendue » est remplacée par la confrontation des littéraux de la maquette (Grep des `proto-*.html`, `keo.css`, `assets/tokens.css`) et un calcul de contraste à la main. À refaire avec un navigateur : `getComputedStyle` de la planche 05 à 375 et 1 440, anneau de focus rendu, captures de la planche 06.

## 1. Tokens confrontés à la maquette
- **Couleurs** : le bloc KEO du code égale `assets/tokens.css` (l. 284-347) valeur par valeur ; `logo-plate` et `skeleton-*` redéclarés (G3c) ; `network-primary` = `data-3` `#ffae2b`. Conforme.
- **Longueurs, grilles, ratios** : chaque valeur de `A` §1 existe dans la maquette (7fr/4fr ; 18 et 17 rem ; `grid-range` 9/6,5 rem et 6,5/5,5 sous 480 ; `grid-campaign-row` ; `grid-bo-check` 9,5/12 ; `-timeline` 7,5 et 8 ; `-sync` 4 ; 4/3, 2/1, 5/6 ; largeurs 12 à 60 rem ; 0,375, 0,875, 1,125, 1,375, 3,25 rem). **Aucune valeur de maquette fausse.**
- **Mouvement** : `pop`, `pop-in`, `done-flash` 900 ms, `spin` 1 s, `skeleton` 1,2 s, `rise-in` −0,25 rem, échelles 0,9 et 0,96, `brightness(0.85)` identiques ; durées à 0 et squelette `none` sous mouvement réduit (AN-1).
- **Paliers de titres (RU-01)** : maquette en `clamp`, code en trois pas. Écart rendu : `title-detail` +0,8 px à 768 et +1,9 px à 1 024 ; `title-hero` +0,4 px à 768 ; `key-figure`, `aside-figure` ≤ 0,6 px à 768 et 1 280 ; 0 à 375 et 1 440. Accepté par RU-01 ; N1 doit tolérer 1 px à 768.
- **RU-17** : `h1` de 20 et 14 en `text-title-section` 800, assistants et 11 en 700 : conforme à la maquette.

## 2. Contrastes recalculés : aucun sous AA
`network-primary` × carte, surélevée, survol : 9,99 · 9,18 · 8,17 ; `text-inverse` × `surface-inverse` 17,46, × vert d'action 9,97 ; voiles 82 % et 75 % sur blanc 11,1 et 8,6 ; `border-strong` × page 4,97, × surélevée 4,28 ; `border-error` × surélevée 4,34 ; bouton danger 5,59 (survol 4,76) ; `text-tertiary` × surélevée 5,38, × survol 4,79, × **active 4,13** (la règle RU-11 est fondée) ; `text-secondary` × active 6,67. Texte désactivé 2,51 : exempté (1.4.3), état dit par une phrase (RU-09). `CONTRAST_MATRIX.keo` porte les trois ajouts de A.

## 3. Planche d'états (05)
- Quatre sections, 22 cellules : bouton, notice, badge, champ. Chaque état se dit par texte et icône ; `aria-disabled`, jamais `disabled`, aucune opacité : conforme.
- Anneau de focus : global 3 px, décalage 2 px, `focus-ring` `#f4f6f5`, 17:1 sur la page. La planche ne fige ni focus, ni survol, ni appui : pas de preuve rendue.
- `logo-plate`, `skeleton-*`, `network-primary`, `effect-photo-*`, `aspect-otp`, `animate-*` n'ont aucun consommateur : leur rendu n'est confrontable qu'avec RUB.

## 4. RU-27, planche 06
Les 21 identifiants `E..-Q..` sont présents, en huit familles, sans composant ni couleur nouvelle ; écarts en `06b` §7. **Aucune famille ouverte.** Deux libellés restent ambigus (AP3, AP4), sans changer de composant : à lever à l'ouverture des écrans, sans nouvelle réponse F1.

## 5. Constats
### Bloquant
Aucun (pas de ligne `fix-1`).

### Jalon
**J1. Planche contrôlée par axe à 1 440 px seulement.** Valeur : `R05` §6 exige axe = 0 par état à 375 **et** 1 440 ; `RUA-T8` ne teste que 1 440. Fichier : `apps/web/e2e/state-board.spec.ts` l. 14-34. Correctif : boucler sur 375 × 812 et 1 440 × 900 avec `expectNoAxeViolation`, et à 375 `scrollWidth <= clientWidth` sur `[data-state-board]` ; budget +20 s tenu. Facultatif : `Tab` jusqu'à un bouton et assertion de l'anneau (solid, 3 px, décalage 2 px, couleur de `--color-focus-ring`), seule preuve rendue.

### Avant production
- AP1. Contraste élevé Windows (`R05` §6) : aucune règle `forced-colors` ; l'état actif d'un segment, onglet, vue, pastille (RU-10, RU-11) ne tient que par `surface-active` : contour transparent (`forced-colors:border-current`) par primitive de RUB, une phrase en `20` §11.8.
- AP2. Cœur et case ronde sur photo claire : voile de 45 % à 2,90, bord tenu par `effect-photo-shadow` seul ; flèches de carrousel : anneau clair sur photo claire. Capture sur photo blanche avant les cartes photo.
- AP3. F4, ligne de réseau « à écrire » : « Compte vérifié » + « le 3 septembre » sans année contredit le badge daté complet (`20` §11.8, EC-L2E-9) ; libellé soumis au juriste (D34) : reprendre le composant badge tel quel.
- AP4. F1 et F2 : le profil refusé se dit « À corriger » (avertissement) à l'accueil, « Refusé » (erreur) sur la page profil : un mot par état, à arbitrer par `product-owner` en tête de RUF.
- AP5. `#ffae2b` (étoile) et `#ffb020` (avertissement) sont presque la même teinte : seul « compte principal » (RU-13) évite la lecture d'alerte ; à vérifier en recette (3, 2b, 15).

### Plus tard
- PT1. Champ en erreur : bordure 2 px sans compensation (`field-classes.ts` l. 59-67), texte décalé de 1 px ; la maquette retire 1 px de `padding-left` (`keo.css` l. 164).
- PT2. Planche 06 : cadres F7 et F8 sans classe `.bo` (boutons 44 px, champs 48 px) alors que la fiche dit « densité bo » (`planche-etats.html` l. 455).
- PT3. Planche 06, cadre 375 : les requêtes de média suivent la fenêtre ; le « pleine largeur sous 480 » de F3 n'y est pas visible. Captures à 375 réel en RUB.
- PT4. F8, pastille ouverte : chevron seulement à l'ouverture, `aria-expanded` non dit ; chevron au repos sur toute pastille à menu.
- PT5. `EmptyState` : `h4` sous `h2` dans la planche (RU-12) ; niveau en propriété, comme C03.
- PT6. Squelette à 1,09:1 sur carte : décor, état dit par `aria-busy` et texte ; visibilité à vérifier en RUB (C09).
- PT7. La planche 05 gagne une section par primitive à chaque lot, avant l'écran qui la consomme.

ETAT: changement demandé (J1, jalon)
