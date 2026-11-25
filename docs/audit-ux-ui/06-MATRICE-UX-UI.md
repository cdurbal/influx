# 06 — Matrice des améliorations UX/UI

> Les 65 constats de `01`, dont 7 issus du guide interne `docs/good-practice-ux/` (U59 à U65),
> classés par rapport impact / effort. Propositions : `03` ; phases : `05`.

## Méthode de notation

| Critère | Échelle |
|---|---|
| **Gravité** | Critique = 3 · Important = 2 · Cosmétique = 1 |
| **Fréquence** de l'écran | Quotidien = 3 · Hebdomadaire **ou** passage obligé de chaque nouvel inscrit (onboarding) = 2 · Ponctuel = 1 |
| **Impact** | Gravité × fréquence (de 1 à 9) |
| **Effort** | S (< 1 j) = 1 · M (1 à 3 j) = 2 · L (> 3 j) = 3 |
| **Ratio** | Impact ÷ effort |
| **Priorité** | **P1** si ratio ≥ 4 · **P2** si 2 ≤ ratio < 4 · **P3** si ratio < 2 · ↑ = relevée d'un cran, raison donnée |

La **phase** tient compte des prérequis : un P1 peut attendre une décision (phase 0) ou une
primitive (phase 2). Les fréquences sont estimées d'après les parcours (`17`, `17b`), faute de
mesures d'usage.

## Les quatre quadrants

| Quadrant | Constats |
|---|---|
| **Gains rapides** (impact ≥ 6, effort S) | U02, U03, U09, U16, U18, U35, U38, U44, U64 · U01 en variante minimale |
| **Chantiers structurants** (impact ≥ 6, effort M ou L) | U01, U05, U07, U08, U13, U14, U15, U20, U36, U37, U39, U40 |
| **Améliorations ciblées** (impact 4) | Effort S : U11, U12, U22, U23, U25, U27, U28, U29, U30, U31, U32, U42, U59, U60, U62 · Effort M : U10, U17, U19, U21, U24, U26, U61 |
| **Finitions et cas rares** (impact ≤ 3) | U04 (relevé), U33, U34, U41 (relevé), U43 (relevé), U45 à U58, U63, U65 |

## Matrice complète

| Rang | ID | Problème | Écran | Fréq. | Grav. | Impact | Effort | Ratio | Priorité | Phase |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | U02 | « Publier mon profil » hors de portée sur mobile | Profil créateur | 2 | 3 | 6 | S | 6 | P1 | 1 |
| 2 | U03 | Listes déroulantes qui agissent au changement | Profils, campagne | 2 | 3 | 6 | S | 6 | P1 | 1 |
| 3 | U35 | Verrou gardé au retour à la file, brouillon perdu | Décisions BO | 3 | 2 | 6 | S | 6 | P1 | 1 |
| 4 | U38 | Tableaux : ligne faussement cliquable, cellules sur 3 à 4 lignes, chiffres à gauche | Files, inscrits | 3 | 2 | 6 | S | 6 | P1 | 1 puis 5 |
| 5 | U09 | Cadre de page instable | Toutes les pages membres | 3 | 2 | 6 | S | 6 | P1 | 1 |
| 6 | U18 | États vides et messages en cartes | Toutes les listes | 3 | 2 | 6 | S | 6 | P1 | 2 |
| 7 | U16 | Logos sans pastille claire | Fil, fiche, profil | 3 | 2 | 6 | S | 6 | P1 | 1 |
| 8 | U44 | Ni fil d'Ariane, ni raccourcis de navigation | Coquille BO | 3 | 2 | 6 | S | 6 | P1 | 1 (fil d'Ariane, « `g` puis n ») puis 5 |
| 9 | U64 | Espacement croissant vers l'intérieur : rembourrage des cartes (24 à 32 px) supérieur à l'écart entre cartes (16 px) | Listes de cartes | 3 | 2 | 6 | S | 6 | P1 | 2 |
| 10 | U01 | Accueil créateur qui contredit le produit | Accueil créateur | 3 | 3 | 9 | M (S en variante) | 4,5 (9) | P1 | 1 puis 3 |
| 11 | U05 | Aucune vue d'ensemble des 9 files | Rail, accueil BO | 3 | 3 | 9 | M | 4,5 | P1 | 5 |
| 12 | U59 | Marque neuve : prérequis découverts au clic, délai inconnu, message faux | Accueil, campagnes, recherche | 2 | 2 | 4 | S | 4 | P1 | 1 (volet règle : 0.13 puis 3) |
| 13 | U60 | Première arrivée sans accueil ni valeur réaffirmée | Fin d'inscription, accueils | 2 | 2 | 4 | S | 4 | P1 | 1 (après 0.3) |
| 14 | U62 | Écran 3 de l'inscription : trois sujets mêlés | Inscription | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 15 | U11 | Recherche mobile : premier résultat invisible | Recherche | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 16 | U12 | Ajout à la sélection non annoncé, focus perdu | Recherche, fil | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 17 | U25 | Erreurs d'entrée non effacées à la correction | Entrée | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 18 | U27 | Erreur et avertissement par la seule couleur | Primitives de champ | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 19 | U29 | Listes triées par code anglais | Profils, campagne | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 20 | U31 | Enregistrement annoncé à chaque pause | Profils, campagne | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 21 | U32 | Droits d'usage qui se décochent en silence | Profil créateur | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 22 | U42 | Vue identifiée absente de la fiche créateur | Fiche BO | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 23 | U23 | 24 formats à plat, sans lien avec les réseaux choisis | Profil marque | 2 | 2 | 4 | S | 4 | P1 | 1 |
| 24 | U28 | Cartes dans des cartes (4 niveaux) | Profil créateur | 2 | 2 | 4 | S | 4 | P1 | 2 |
| 25 | U30 | Zones internes non distinguées, identité légale intercalée | Profil créateur, campagne | 2 | 2 | 4 | S | 4 | P1 | 2 |
| 26 | U22 | Étiquette de couche sur chaque champ | Profils, campagne | 2 | 2 | 4 | S | 4 | P1 | 4 (après décision 0.2) |
| 27 | U04 | Déconnexion introuvable sous 1 024 px | Compte (marque) | 1 | 3 | 3 | S | 3 | P2 ↑ **P1** : sécurité, effort minime | 1 |
| 28 | U41 | Confirmation d'identité : formulaire dans un formulaire | Fiche, réglages BO | 1 | 2 | 2 | S | 2 | P2 ↑ **P1** : double envoi possible, à tester d'abord (0.11) | 1 |
| 29 | U07 | Fiche de compte sans identité ni hiérarchie | Fiche BO | 3 | 3 | 9 | L | 3 | P2 (en-tête d'identité seul : S, P1) | 5 |
| 30 | U06 | Impasses de navigation au backoffice | Décisions, recherche | 2 | 3 | 6 | M | 3 | P2 (liens seuls : S, ratio 6) | 5 |
| 31 | U36 | Décision en bas d'une colonne, libellés loin des valeurs | Décisions BO | 3 | 2 | 6 | M | 3 | P2 | 5 |
| 32 | U37 | Cartes dans des cartes (12 cas, 3 niveaux) | BO | 3 | 2 | 6 | M | 3 | P2 | 2 puis 5 |
| 33 | U40 | Accueil BO : phrases, alertes répétées | Accueil BO | 3 | 2 | 6 | M | 3 | P2 | 5 |
| 34 | U39 | Inscrits sans colonne d'identité | Inscrits BO | 3 | 2 | 6 | M | 3 | P2 | 5 |
| 35 | U08 | Accueil marque figé sur l'installation | Accueil marque | 3 | 2 | 6 | M | 3 | P2 | 3 |
| 36 | U13 | « Mes campagnes » en cartes hautes | Campagnes (marque) | 3 | 2 | 6 | M | 3 | P2 | 3 |
| 37 | U14 | Fil créateur : un bouton vert par carte | Fil créateur | 3 | 2 | 6 | M | 3 | P2 | 3 |
| 38 | U15 | Fiche de campagne peu lisible, impasse | Fiche de campagne | 3 | 2 | 6 | M | 3 | P2 | 3 (avec C7 du Lot 4) |
| 39 | U20 | Chargements sans squelette | Toutes | 3 | 2 | 6 | M | 3 | P2 | 2 |
| 40 | U45 | Pilules étirées pleine largeur | Accueils, états | 3 | 1 | 3 | S | 3 | P2 | 2 |
| 41 | U46 | Notices pour des états durables | Accueils, fiche | 3 | 1 | 3 | S | 3 | P2 | 3 |
| 42 | U56 | Filtres de deux hauteurs | Files, inscrits | 3 | 1 | 3 | S | 3 | P2 | 5 |
| 43 | U57 | Accessibilité fine et vocabulaire du BO | Divers BO | 3 | 1 | 3 | S | 3 | P2 | 1 |
| 44 | U65 | Icône à 4 px de son libellé dans les badges | Badges, pastilles | 3 | 1 | 3 | S | 3 | P2 | 2 |
| 45 | U10 | Carte de résultat de plus de 1 400 px | Recherche, sélections | 2 | 2 | 4 | M | 2 | P2 | 3 |
| 46 | U17 | Sélection ouverte sur son formulaire | Sélections | 2 | 2 | 4 | M | 2 | P2 | 3 |
| 47 | U19 | Campagne publiée relue en formulaire inerte | Campagne (marque) | 2 | 2 | 4 | M | 2 | P2 | 3 |
| 48 | U21 | Sept sections dépliées sur mobile | Profil créateur | 2 | 2 | 4 | M | 2 | P2 | 4 |
| 49 | U24 | Trois boutons principaux sur mobile | Campagne | 2 | 2 | 4 | M | 2 | P2 | 4 (après décision 0.5) |
| 50 | U26 | Quatre façons de dire « ce qui manque » | Entrée, profils, campagne | 2 | 2 | 4 | M | 2 | P2 | 2 puis 4 |
| 51 | U61 | Pas de checklist d'activation côté marque | Accueils | 2 | 2 | 4 | M | 2 | P2 | 3 |
| 52 | U33 | Changement d'adresse sans contrôle local | Compte | 1 | 2 | 2 | S | 2 | P2 | 4 |
| 53 | U34 | Onglet actif en bouton vert | Aperçu créateur | 1 | 2 | 2 | S | 2 | P2 | 1 |
| 54 | U47 | Compteur d'étapes inexact, écran de succès superflu | Entrée | 2 | 1 | 2 | S | 2 | P2 | 1 (avec U60) |
| 55 | U48 | Écrans e-mail et code redondants | Entrée | 2 | 1 | 2 | S | 2 | P2 | 1 |
| 56 | U49 | Hiérarchie typographique écrasée | Formulaires | 2 | 1 | 2 | S | 2 | P2 | 2 |
| 57 | U52 | Dates au format du système | Campagne | 2 | 1 | 2 | S | 2 | P2 | 4 |
| 58 | U53 | Boutons texte dans les phrases | Entrée | 2 | 1 | 2 | S | 2 | P2 | 1 |
| 59 | U55 | Second `<nav>` | Recherche | 2 | 1 | 2 | S | 2 | P2 | 1 |
| 60 | U58 | Bouton coupé sur trois lignes | Profil créateur | 2 | 1 | 2 | S | 2 | P2 | 1 |
| 61 | U63 | Libellés « Valider », « Soumettre » | Entrée, compte, profils, campagne | 2 | 1 | 2 | S | 2 | P2 | 1 (après 0.3) |
| 62 | U43 | Page masquée qui prend en charge et journalise | BO < 768 px | 1 | 2 | 2 | M | 1 | P3 ↑ **P2** : verrous et lectures fantômes dans le journal | 5 |
| 63 | U50 | Nombres pleine largeur, sans total | Audience, campagne | 1 | 1 | 1 | S | 1 | P3 | 4 |
| 64 | U51 | Nom de l'entreprise modifiable à deux endroits | Compte, profil | 1 | 1 | 1 | S | 1 | P3 | 4 |
| 65 | U54 | Microcopies et placeholders | Profils, contestation | 1 | 1 | 1 | S | 1 | P3 | 4 |

## Lecture

- **Les 26 P1, plus les 2 relevés**, tiennent pour l'essentiel en phase 1 (6 à 8 jours). Ils
  règlent tous les constats critiques à effort faible, la moitié des constats importants, et les
  trois écarts au guide d'onboarding les moins coûteux : accueil (U60), prérequis annoncés (U59),
  écran 3 groupé (U62).
- **Les constats critiques coûteux** (U05, U07, U06) gagnent à être découpés :
  - l'en-tête d'identité de la fiche et les liens vers les fiches sont des gains rapides ;
  - la refonte en trois zones et les compteurs, qui demandent `apps/api`, viennent en phase 5.
- **Les cartes imbriquées** (U28, U37), les **états** (U18) et la **checklist d'activation** (U61)
  se règlent à moindre coût une fois les primitives de la phase 2 en place. C'est pourquoi la
  phase 2 précède les écrans.
