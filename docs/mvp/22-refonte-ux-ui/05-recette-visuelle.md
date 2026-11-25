# 05 — Recette visuelle, accessibilité et non-régression

> Une validation « globalement similaire » ne vaut rien ici. La maquette est un HTML du dépôt : elle se
> rend dans le **même navigateur** que l'application, ce qui permet de comparer des mesures, des styles
> calculés et des captures. Toute la procédure est reproductible ; l'outillage est livré par `RUA-03`.

## 1. Référence

- **Source** : `docs/audit-ux-ui/prototypes/proto-*.html`, état choisi par l'ancre (`#etat`), figée au
  commit `954e009`. Toute retouche d'une maquette après ce commit se signale au fondateur.
- **Neutralisation** (mêmes réglages que le relevé du 2026-11-24) : bandeau `.demo` retiré, hauteur des
  colonnes rétablie à 100 dvh, `prefers-reduced-motion: reduce`, locale `fr-FR`, Chromium de Playwright.
- **Relevé de départ** : 23 maquettes, **147 états** (138 du sélecteur, 9 atteints par l'ancre : `proto-profil` `etape-2`, `etape-4`, `modif-1`, `-2`, `-4`, `-5` ; `proto-profil-marque` `modif-1`, `-3` ; `proto-entree` `email-createur`), 4 largeurs, **588 captures**, aucune erreur de
  script. Débordement horizontal : aucun côté membres, sauf `proto-marque#soumise` à 375 px (477 px) ;
  backoffice à 375 px hors périmètre (écran 19).

## 2. Largeurs et hauteurs

| Espace | Largeurs × hauteurs | Contrôle supplémentaire |
|---|---|---|
| Membres | 375 × 812, 768 × 1 024, 1 280 × 800, 1 440 × 900 | 320 et 1 024 : aucun défilement horizontal, aucun élément coupé |
| Backoffice | 1 280 × 800, 1 440 × 900 | 1 024 × 768 ; 768 (RU-19) ; 375 et 1 280 × 480 : écran 19 |

Tablette : 768 pour les membres. Les états sans relevé à 1 024 se contrôlent aux bords (1 023 / 1 024).

## 3. Trois niveaux de comparaison (tous exigés)

**N1 — Structure et textes** (automatique). Pour chaque état : même ordre des zones, mêmes titres, mêmes
libellés FR (valeurs `{variable}` exclues), mêmes icônes, mêmes rôles et noms accessibles. Écart = échec.

**N2 — Styles calculés et géométrie** (automatique). Pour chaque ligne de la matrice (§3 de chaque fiche) :

| Propriété | Tolérance |
|---|---|
| Couleurs (texte, fond, contour), famille, graisse, taille, rayon, épaisseur | **0** |
| Interligne, espacements internes, écarts | **0** (valeur du token) |
| Position et largeur d'une zone (contenu de même longueur) | **1 px** (arrondi de sous-pixel) |
| Hauteur d'un bloc à texte | Multiple exact de l'interligne ; sinon 1 px |
| Ordre de superposition, position collante ou fixe | identique |

**N3 — Captures** (automatique puis humaine). Application et maquette avec **les mêmes données** (jeu de
données du §4) ; `toHaveScreenshot` sur la capture de la maquette rendue dans la même exécution :
- `maxDiffPixelRatio` ≤ 0,5 % par zone, `threshold` 0,1 ; anticrénelage exclu ;
- **masques permis**, et seulement eux : photos et logos réels, dates et heures courantes, adresse du
  compte connecté, bandeau d'environnement ;
- toute zone au-delà du seuil est regardée côte à côte et classée : corrigée, ou **écart justifié** inscrit
  dans `06b-ecarts-et-anomalies.md` §7 avec l'accord du fondateur. Pas de troisième issue.

Une image de référence n'est **jamais** mise à jour pour faire passer un test.

## 4. Jeu de données de recette

Les textes d'exemple des maquettes (Maison Azur, « Routine éclat d'hiver », profil 93JMS4…) deviennent des
données synthétiques de test, par espace, chargées par les fixtures e2e existantes
(`apps/web/e2e/fixtures`, `support`). Jamais sur `production`. Là où l'API ne sert pas la donnée
(`06b` §5), l'état concerné reste **non recettable** tant que la décision n'est pas prise.

## 5. États à couvrir sur chaque écran

Montrés par la maquette : tous. Non montrés (voir §5 de chaque fiche) : chargement, vide, vide filtré,
erreur serveur, refus (403, 404), limitation (429), conflit de version, hors ligne, session expirée,
lecture seule, textes longs (nom de 40 caractères, raison sociale de 120, 3 thématiques longues), **EN**.

## 6. Accessibilité

| Contrôle | Seuil |
|---|---|
| axe 4.13 (`wcag2a/aa`, `21`, `22`, bonnes pratiques) | **0** sur chaque état, 375 et 1 440. Les maquettes en comptent : 9 règles, voir `06b` §3 ; l'application n'en hérite pas |
| Clavier | Parcours complet de chaque écran, ordre visuel, aucun piège, focus visible et jamais couvert par une barre (TD5.4) |
| Focus | `h1` après navigation, `h2` après étape, déclencheur après dialogue, résumé après refus |
| Lecteur d'écran | NVDA + Chrome : un parcours par espace (inscription ; campagne ; profil créateur ; décision) |
| Zoom 200 %, texte agrandi, 320 px | Rien de perdu, aucun défilement horizontal de page |
| Mouvement réduit | AN-1 (`04-animations.md`) |
| Contraste | Paires de `20` §11.4 ; nouvelles paires ajoutées à `CONTRAST_MATRIX` |
| Contraste élevé Windows | Contours et état courant lisibles |

## 7. Non-régression

1. Contrats d'API : aucun schéma de `packages/contracts` modifié, sauf décision écrite de `06b` §5.
2. Autorisations : T1, T2, T9, T14, T15, TM5, TM11, TM12 rejoués en fin de jalon.
3. Aucun montant, taux, net ni score (T16, D11, D48, D78) ; aucune coordonnée de l'autre partie (D46).
4. Vitrine : `vitrine-unchanged.spec.ts` inchangé et vert.
5. Specs e2e : attributs `data-*`, rôles et noms accessibles conservés ; quand une structure change, la
   spec change **dans le même commit**, sans perdre une assertion (planchers `case-floors.ts` jamais baissés).
6. Budget e2e : +20 s au plus par jalon ; éclats ≤ 7 min 30, job ≤ 8 min (`21` §8, L2D-E2E).
7. Poids : aucune dépendance ajoutée ; JavaScript de première visite de chaque route à +5 % au plus.
8. i18n : parité FR/EN des clés, aucune chaîne en dur.

## 8. Procédure par écran

1. Fiche `ecrans/E…` lue ; décisions bloquantes de l'écran soldées (`06a`).
2. N1 et N2 verts à chaque largeur, N3 sous le seuil ; états du §5 ; axe 0 ; clavier.
3. Planche **avant / maquette / application** jointe au compte rendu du jalon (375 et 1 440).
4. `expert-ux` : constats ligne à ligne, avec l'identifiant `E..-S..` ; `testeur` : critères `CA`.
5. Le fondateur valide l'écran sur `staging`, planche en main. L'écran n'est « fait » qu'ensuite.

## 9. Critères de fin du lot

Les dix critères de la mission, plus la preuve attendue :

| # | Critère | Preuve |
|---|---|---|
| 1 | Tous les écrans inclus développés | `07-matrice-tracabilite.md` : aucune ligne sans état « fait » |
| 2 | Fidélité à la maquette | N1, N2, N3 par écran et par état |
| 3 | Variantes responsive | §2, 320 et 1 024 compris |
| 4 | Composants cohérents | Un module par composant, aucun doublon (garde `RUL-01`), `02b` §4 soldé |
| 5 | Interactions et états | Tests `E..-T..` et AN-2 |
| 6 | Fonctions métier préservées | §7, suite complète |
| 7 | Tests automatisés | `pnpm check`, `pnpm test:e2e`, suite base |
| 8 | Accessibilité | §6 |
| 9 | Écarts visuels corrigés | Journal des écarts vide ou justifié |
| 10 | Aucun écart non justifié | Validation du fondateur, écran par écran |
