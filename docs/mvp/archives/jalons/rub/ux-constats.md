# RUB-U — constats `expert-ux` (2026-11-27)
> HEAD mesuré : `ee7e206` (`apps/web/src` identique à `dd603b20`). Chromium, pile locale, `/fr/state-board` à 375 et 1 440, coquille à 320-1 440 FR/EN. Specs temporaires retirés.
> Captures `<S>` = `C:\Users\cdurb\AppData\Local\Temp\claude\debaf0d8a42fe0b4\2c4a9107-1c2a-4b7f-a721-d9cfb01c1155\scratchpad\rub-ux` (`board`, `forced`, `long`, `spot`, `shell`, `screens`).
> `U` = `apps/web/src/components/member/ui` ; `M` = son parent.

**Décompte : bloquant 0 · jalon 7 · avant production 4 · plus tard 9.**

## Jalon
- **U-1 C32, texte sur les boutons.** `U/pager-classes.ts:7-18`. À 375, même avec « Précédent / Suivant », la position recouvre les boutons : 20 à 42 px (groupe 293), 19 px à 338, 132 px au plafond, 56 à 103 px en curseur ; illisible (`spot/pager-short-labels-375.png`). Cause : côtés `flex-1 min-w-0`, boutons incompressibles. Correctif : sous `form`, position sur sa propre ligne ; au-delà, côtés jamais plus étroits que leur bouton ; cas sans recouvrement à 375.
- **U-2 C05 `readonly`, valeur sous le bouton.** `U/inner-panel-classes.ts:45-46`. À 375, « contact@example.test » : boîte 6 px pour 149 px de texte, 127 px passent sous « Modifier » (`board/375-surface.png`). Correctif : largeur de base à la valeur (`basis-(--size-note-min)`) et `wrap-anywhere`, l'action passant à la ligne.
- **U-3 C56, AP1 absent de la coquille** (`20` §11.8, RUB-B §5). `M/shell-classes.ts:93-107, 127-132`. En couleurs forcées, entrée, sous-entrée et cellule courantes perdent fond et filet : aucun contour, seule la graisse reste (`shell/brand-forced-1440.png`, `-375`). RUB-AX ne couvre que la planche. Correctif : contour `transparent` `border-width-thick` intérieur sur le courant (et l'ancêtre de la barre), remplacé par l'anneau au focus ; cas `forcedColors` dans `member-shell.spec.ts`.
- **U-4 C06 `campaign` avec `sub` seul.** `U/row-list-classes.ts:104-105`. Dès 768, `md:contents` s'applique sans grille : le chevron colle au texte (432 px libres à droite sur 606), contre `1fr auto` (RUB-B §4). Correctif : `md:contents` seulement quand `campaignOf` rend une grille.
- **U-5 C25, icône orpheline à l'échec.** `U/save-status-classes.ts:14`. À 375 (et au pied de C41 à 1 440), l'icône est seule au-dessus du texte ; la maquette (`.save`) et `02a` C25 la veulent à côté. Correctif : icône et texte insécables (texte rétrécissable), seuls délai et « Réessayer » passent à la ligne.
- **U-6 C17 `strip`, icône orpheline.** `U/notice-classes.ts:23-27`. Icône seule sur sa ligne aux deux cellules à 375 et à `strip-long` à 1 440, contre « passent à la ligne ensemble » : la base du corps est son texte entier. Correctif : `basis-(--size-note-min)` sur le corps, ou icône et corps groupés.
- **U-7 S17, halo des pages étroites : écart non soumis** (invariant 15). `U/page-frame-classes.ts:20-21`, `components/auth/auth-classes.ts:31`. Le halo suit le cadre étroit (864 px à 1 440) au lieu de `.m-page` (1 184) : centre à x = 688 contre 848, rayon 432 contre 592 ; à 1 280, 683 contre 768. Identique à 375 et 768 ; gouttières, écart et bord du `h1` conformes (`shell/s17-*.png`). Correctif : le soumettre en F1 comme D5 (`06b` §7 si accordé), sinon cadre à `container-max` et pile étroite dedans.

## Avant production
- **U-8** C31 (EC-RUB-09a-2) : au centre de la photo, aucun lien ; la plus grande cible n'ouvre rien. À fermer à RUH (diapositive cliquable hors tabulation).
- **U-9** C30 : anneau rogné d'un côté au bord de la ligne défilante (5 pastilles à 375, 2 à 1 440) ; `scroll-px` (`U/filter-bar-classes.ts:16`).
- **U-10** Cible 44 px (invariant 10) : segments C22 à 36 px sans zone (E02, E15) ; liens du résumé et « Compléter » de C20 à 22 px (`U/error-summary-classes.ts:24-40`). 2.5.8 tenu.
- **U-11** « Lire la suite » (C40, RUH) et halo de C68 (RUI) non faits : à porter au reliquat.

## Plus tard
- P1 C07 : libellé standard 13 rem, 60 à 90 px de valeur à 375, adresses coupées (même CSS que la maquette) ; RUE, RUI choisissent `labelWidth`.
- P2 C30, chevron au repos (PT4) : conforme à B ; question maintenue pour RUC.
- P3 `Wizard`, échec « annoncé deux fois » : par lecture du code, une seule écriture (`Announcer` annule le minuteur) ; sans lecteur d'écran. Revers : de deux messages du même rendu, le premier est perdu.
- P4 C22 `radio`/`views` sur deux lignes : piste en pilule mal ajustée.
- P5 C31 sur blanc : points à peine visibles ; cœur et badge lisibles (AP2 conforme).
- P6 Couleurs forcées : bouton principal sans contour (antérieur) ; C41 « à compléter » égal à « à faire » (RUF).
- P7 Libellés très longs : actions de C17 et C39 `shrink-0`, elles débordent.
- P8 Lien d'évitement haut de 40 px (antérieur).
- P9 Planche : cellule `us` de C47 avec l'aide « jj/mm/aaaa ».

## Composants de la planche
États : les cellules couvrent `02c`, sauf C03 « occupée », C06 « nouvelle », C08 « nouvelle tentative », C28 « appliqué, en cours » (une seule ouverture), C31 « bloquée »/`identified`, C41 « lecture seule » (survol et focus non figés).

| C | Rendu mesuré contre `02a`/`02b` | Verdict |
|---|---|---|
| 01-03 | `h1` 28/800 et 20/800, `h2` 20/700 | halo : U-7 |
| 04, 05 | rayons 16/12, marges 32/16/24, panneau 16 | U-2 |
| 06-09 | ligne 60, `dt` 208, squelette r6 ligne 14 | U-4, P1 |
| 10-12 | 36, 40, 44,8, 46,8, 52 ; zones 44 | conforme |
| 13-16, 33, 38 | 28,6 ; 31,7 ; 18,6 ; logos 32-120 ; pastille 32 | conforme |
| 17, 19 | rayon 12, 12 × 16, icône 16, écart 12 | U-6 |
| 18, 20, 21, 23, 24 | 48, r12, erreur 15 px sans saut ; nombre 128 ; case 24 ; étiquette 36 ; choix 320 | U-10, P7 |
| 22, 26 | segments 36, piste 44 ; sommaire 44 | U-10, P4 |
| 25 | icône 16, texte 14 | U-5 |
| 27, 28, 30, 32 | dialogue 480 r16 ; filtres 672, plein écran à 375, focus au titre ; pastille 40 | U-1, U-9 |
| 31, 48 | cœur 44, flèches 32 ; fil r16, 328 × 212-245 | U-8, P5 |
| 34-37, 39, 40, 66, 68 | mosaïque 1 à 6 sans case vide ; chiffre 20/800 ; icône 24 ; logo 120 ; encadré r16 p24 | U-11 |
| 41, 42, 49, 51 | boîte 768 r16, segments 6, libellé 11 rem, cases 52 × 62,4, pastille 28 | P3, P6, U-5 |
| 47 | champ 192 | P9 |

- **Focus** : 262 arrêts à 375, 261 à 1 440, tous avec anneau 3 px (décalé 2 ou intérieur −3) ; seul rognage : U-9.
- **Mouvement réduit** : aucune transition ni animation restante (planche aux deux largeurs, coquille).
- **Couleurs forcées** : captures regardées pour C16, C22, C30, C41, C51 (porteurs conformes) ; coquille : U-3.
- **Textes longs** (+ 90 signes par texte) : retours à la ligne ou défilement prévu, sauf P7 et badges sans `wrap`.

## Coquille `E01.0`
| Ligne | Constat |
|---|---|
| S01-S05 | évitement premier (P8) ; colonne 256 ; INFLUX 44 ; rôle en place ; en-tête 64, sans débordement à 320, 359, 360 FR/EN, marque et créateur ; langue 47 |
| S06-S10 | entrées 44, ordre clavier = ordre visuel, anneau intérieur sur la barre, rien de masqué au focus ; courant conforme hors U-3 ; ancêtre et sous-entrée vus à 1 440 sur « Mon profil » |
| S11-S16 | `aside` à y 312 (marque) et 264 (créateur) ; cibles ≥ 44 ; adresse longue repliée ; à 1 024 × 500 la colonne défile |
| S17 | `h1` à x 304 (1 440), 299 (1 280), 16 (375) sur les pages à cadre visitées ; halo : U-7 |

D1 à D4 : sans objection UX ; décision au fondateur (F1). Comparaison N1-N3 non rejouée.

## Écrans non migrés (liste de A §1)
Diff des appelants lu ; accueils, profils, campagne, recherche, sélections, compte, séances, aperçu, fil capturés à 375 et 1 440 (une partie regardée) : aucun débordement horizontal, **aucun effet hors liste relevé**. Cadres à gauche, étroit 768 utile ; `SCREEN_CLASSES` identique à l'ancien. Bloc d'état en texte, sans lien une fois publié (CA04). Second `nav` du profil créateur : antérieur.
**`TagPicker`** : étiquettes 36, croix 24 en zone 44 sans chevauchement calculé (écarts 8), choix de 643 à 320 px à 1 440 (profil marque), 293 à 375 : acceptable comme « mesure » ; à citer en F1, question 3.

## Non vérifié
Vérifications (URL tapées en 404 ; deux pages de compte non capturées) ; erreurs C19 sur les formulaires existants (aucune provoquée) ; contraste : ni axe rejoué (RUB-T8, RUB-AX) ni paires de B §8 recalculées ; lecteur d'écran, téléphone réel, zoom 200 % ; en pleine largeur (planche limitée à 672) : C34 1 088 × 544, C39 372, C40 deux colonnes ; C27 `wide`.
