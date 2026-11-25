# 04 — Direction artistique : principes de composition

> Comment composer les écrans des espaces connectés (charte KEO Emerald, D73 à D75) pour qu'ils
> soient aérés, structurés et calmes, **sans changer l'identité**. Ce document complète
> `docs/mvp/20-direction-design.md` §11, qui reste la référence des tokens et des composants : il
> fixe **quand** employer chaque élément. Une fois validé, il a vocation à rejoindre `20` §11
> (règle d'or de `CLAUDE.md` : la spécification d'abord, le code ensuite).

## 0. Ce qui ne change pas

- La palette, les deux polices (Manrope pour les titres et les chiffres, Source Sans 3 pour le
  corps), les pilules, les cartes à 16 px et leur filet, les lignes de 36 px du backoffice.
- Le halo d'en-tête (un par page), l'ombre lumineuse du bouton principal, le zoom au survol et le
  soulèvement des cartes cliquables (F6, choix du fondateur), sous `motion-safe:`.
- La navigation : colonne à gauche, sous-menus D74, barre du bas sur téléphone, page-menu.
- Le responsive actuel. Les règles ci-dessous le précisent, elles ne le refondent pas.

## 1. Tokens à ajouter (aucune couleur nouvelle)

| Token | Valeur proposée | Nature | Emploi |
|---|---|---|---|
| `--color-logo-plate` | `var(--color-surface-inverse)` | Alias déjà prévu (`20` §10) | Pastille claire derrière un logo de marque |
| `--color-skeleton-base` · `--color-skeleton-sheen` | `surface-raised` · `surface-hover` | Alias déjà prévus (`20` §11.8) | Squelettes |
| `--animate-skeleton` | balayage de 1,2 s, linéaire, infini | Animation | Squelettes, supprimée sous mouvement réduit |
| `--size-measure` | 40 rem (environ 75 caractères en Source Sans 3 16 px) | Longueur | Largeur maximale d'un texte de lecture |
| `--size-property-label` | 13 rem | Longueur | Colonne des libellés d'une liste de propriétés |
| `--size-input-number` | 8 rem | Longueur | Champ numérique court |
| `--spacing-bo-panel-w` | 22 rem | Longueur `-bo-`, nom déjà donné par `17b` §1.7 | Colonne de décision et de propriétés du backoffice |

Les longueurs sont à valider par `expert-ux` ; aucune ne demande l'avis du fondateur (D6).

## 2. Hiérarchie

1. **Un écran = un `h1` + des sections.** Le `h1` dit où l'on est (« Accueil », « Mes campagnes »,
   le nom de la campagne ou du compte), jamais le nom de l'espace déjà donné par la pastille de
   rôle.
2. **Trois niveaux de surface au plus** : la page, puis une carte, puis un bloc intérieur. Au-delà,
   on restructure.
3. **L'information se hiérarchise par la typographie et l'espace avant le cadre.** Un cadre
   s'ajoute seulement quand l'objet est autonome (§4).
4. **Une seule action principale par zone de vue** : en-tête de page, barre collante ou carte.
   Jamais deux pilules vertes visibles en même temps sur téléphone.
5. **Ordre de lecture d'un écran de travail** : ce qui demande une action (à traiter, alertes),
   puis l'objet principal, puis le contexte, puis l'historique. Les gestes rares (corriger,
   administrer) sont repliés.
6. **Un état durable n'est pas une notice.** « Publié » est un badge suivi d'une phrase ; la
   notice est réservée à un événement (« Votre campagne a été refusée ») ou à un avertissement.

## 3. Espacements

Échelle existante : `1` = 4 px, `2` = 8, `3` = 12, `4` = 16, `5` = 24, `6` = 32, `7` = 40,
`8` = 48, `9` = 64.

**Règle d'ordre** (guide `02.md`, méthode « de l'extérieur vers l'intérieur ») : l'espacement
**diminue** à chaque niveau d'emboîtement. Un rembourrage de carte ne dépasse jamais l'écart qui
sépare cette carte de ses voisines.

| Niveau · relation | Espaces membres | Backoffice |
|---|---|---|
| 1 · Gouttière de page | `spacing-page-gutter` (16 px sur téléphone, écart volontaire aux 24 px du guide, jusqu'à 48 px) | idem |
| 2 · `h1` → première section | `spacing-6` (32) | `spacing-5` (24) |
| 2 · Section → section | `spacing-8` (48, ordinateur), `spacing-6` (32, téléphone) ; filet `border-default` si les deux sections se ressemblent | `spacing-5` + filet + `pt-4` |
| 2 · Titre de section → contenu | `spacing-5` (24) | `spacing-3` (12) |
| 3 · Cartes d'une liste ou d'une grille | `spacing-grid-gap` (16 → 24 → 32) | `spacing-grid-gap` |
| 3 · Champ → champ | `spacing-5` (24) | `spacing-4` (16) |
| 4 · Rembourrage d'une carte **compacte** (résultat, ligne, état, carte du fil) | `p-4` (16) | `p-3` (12) |
| 4 · Rembourrage d'une carte **unique et large** (section de formulaire, panneau) | `spacing-inset-card` (24, 32 dès `lg`) | `spacing-inset-card` |
| 4 · Rembourrage d'un bloc intérieur | `p-4` (16) | `p-3` (12) |
| 5 · Libellé → champ ; aide → champ | `spacing-2` (8) ; `spacing-1` (4) | idem |
| 5 · Boutons ou étiquettes côte à côte | `spacing-2` à `spacing-3` (8 à 12) | `spacing-2` |
| 5 · Icône → libellé, logo → nom, badge → texte | **8 px au moins** (`gap-2`), jamais sous 6 px | idem |

**Cadre de page.** Un seul cadre partout (`container-max`) ; pages courtes et pages de lecture
limitées à 8 colonnes, **alignées à gauche** sur le même bord que les pages larges. Un texte de
lecture ne dépasse pas `--size-measure`.

## 4. Cartes et conteneurs

Arbre de décision, à appliquer avant tout `Card` ou `SECTION_CLASSES` :

| Question | Si oui | Exemples INFLUX |
|---|---|---|
| L'élément est-il un **objet autonome**, répété dans une collection ou sur lequel on agit en bloc ? | **Carte** | Résultat de recherche, campagne du fil, ligne réseau, visuel de portfolio, entrée de file sur téléphone |
| Est-ce un **regroupement de contenus** dans la page ? | **Section** sans conteneur : `h2` + filet + espacement | Blocs d'un profil sur ordinateur, sections d'une fiche, réglages |
| Est-ce un **sous-groupe dans une carte** (panneau ouvert, récapitulatif, preuve) ? | **Bloc intérieur** `surface-raised` + `radius-md`, sans bordure ; ou sous-section (surtitre + filet) | Panneau de motif, « Vos trois chiffres clés », « Proposé car » |
| Est-ce un **état** (vide, erreur, fermé) ? | `EmptyState`, `StateMessage` ou notice, **sans carte** | « Aucune sélection. », « Recherche fermée » |
| Est-ce une **collection à comparer ou à gérer** ? | **Liste de lignes** ou **tableau** | Mes campagnes, mes sélections, files, inscrits |

**Règles.**
- Jamais une carte dans une carte de même apparence. Jamais un contour intérieur plus fort que
  celui du conteneur. Jamais un fond intérieur plus sombre que la carte (`surface-page` dans
  `surface-card` inverse l'élévation), sauf pour la **zone interne** en tirets (§6), qui est
  volontairement « en creux ».
- Une carte ne contient pas une seule ligne de texte ; une ligne n'a pas besoin de cadre.
- Une **carte cliquable** a un contour `border-strong`, se soulève au survol, a un lien étiré sur
  son titre et **aucun bouton qui mène au même endroit**.
- Au backoffice : **une surface par écran**, découpée en sections ; les tableaux n'ont pas de
  cadre propre quand ils sont déjà dans une surface.
- Sur téléphone, une section peut devenir un accordéon (profils), jamais une carte de plus.

## 5. Typographie

| Rôle | Token (existant) | Règle d'emploi |
|---|---|---|
| `h1` de page | `text-title-page`, Manrope 800 | Un par écran |
| `h2` de section | `text-title-section` (20 px), Manrope 700 | Jamais à l'intérieur d'une carte |
| `h3` de carte ou de groupe | `CARD_TITLE` (16 px), Manrope 700 | Nom d'un réseau, titre d'une carte, légende d'un `fieldset` |
| Bloc dense du backoffice | `text-sm` Manrope 700 | `h3` et `h4` des fiches |
| Surtitre | `OVERLINE` | Pour nommer un groupe sans le cadrer (« À TRAITER », « VÉRIFICATION ») |
| Libellé de champ | Source Sans 3 600 | Doit se distinguer d'un titre de carte par l'espacement qui le précède (`gap-6` avant le premier champ) |
| Corps | 16 px (membres), 14 px (backoffice) | Longueur de ligne ≤ `--size-measure` |
| Chiffre clé | `font-display` 700 à 800, chiffres tabulaires | Métriques D61, compteurs |
| Nombre en tableau | `text-sm`, tabulaire, **aligné à droite** | Files, inscrits, badges |

Une seule taille de titre par niveau dans tout le produit : un titre de carte ne vaut pas 20 px
dans le compte et 16 px dans la campagne.

## 6. Formulaires

- **Format** : multi-étapes court pour l'entrée, collecte progressive par blocs pour les profils
  (accordéon sur téléphone), multi-étapes libre pour la campagne, formulaire classique pour le
  compte (`03` §C).
- **Champ** : libellé au-dessus, « (obligatoire) » écrit, aide en `text-secondary` sous le
  libellé, exemple en `text-tertiary`, jamais seul porteur du sens. Largeur selon le contenu : texte
  sur la colonne du formulaire, nombre court sur `--size-input-number` avec son unité collée
  (« % »), date bornée.
- **Couche de visibilité** : badge complet en tête de groupe ; sur un champ, seulement si sa couche
  diffère ; icône seule dans un groupe homogène (à valider par le fondateur, `03` C4).
- **Zone interne** (identité légale, coordonnées, budget) : encart `surface-page`, contour en
  tirets `border-strong`, `radius-md`, en-tête avec l'icône `EyeOff` et le texte « Visible
  uniquement par vous et l'équipe INFLUX ».
- **Validation** : pas d'erreur avant la première soumission ; au départ d'un champ déjà signalé,
  revalidation ; correction = l'erreur disparaît. Message sous le champ, sans boîte : icône +
  texte, relié par `aria-describedby`. Avertissement non bloquant préfixé « À vérifier : ».
- **Résumé d'erreurs** : un seul composant, en tête du formulaire ou de la barre d'action, liens
  qui ouvrent la section puis focalisent le champ, focus sur le résumé après une soumission
  refusée.
- **Enregistrement** : automatique, statut discret près de l'action (« Enregistré à 14 h 07 ») ;
  seule une erreur est annoncée vocalement, avec une action « Réessayer ».
- **Barre d'action collante (téléphone)** : statut d'enregistrement + **une** pilule verte. Pour
  les étapes : `Précédent` à gauche, `Continuer : ⟨étape⟩` à droite. Elle ne masque jamais un
  champ focalisé (`scroll-padding` existant).
- **Choix** : au-delà de 7 options, liste déroulante ; une liste qui ajoute un élément est suivie
  d'un bouton « Ajouter » (jamais d'action au changement) ; options triées dans la langue de la
  page.

## 7. Tableaux (backoffice)

Ce que `20` §11.8 fixe déjà reste valable : en-tête collant, lignes de 36 px, filet de survol,
squelettes, deux états vides. On y ajoute les règles suivantes.
- **La première colonne identifie** (nom de la marque, alias, titre) et porte le lien de la ligne.
  Pas de colonne « Ouvrir ».
- **Une cellule tient sur une ligne** (`whitespace-nowrap` pour les valeurs courtes) ; une
  précision secondaire va en `text-secondary` dans la même cellule, ou dans une info-bulle
  accessible, jamais sur trois lignes.
- **Au plus 8 colonnes visibles à 1 280 px** ; les colonnes moins utiles se replient (filtre
  « Colonnes ») ou fusionnent (« Synchro » : Brevo et Apollo).
- **Nombres et durées alignés à droite**, chiffres tabulaires ; pagination « 1/3 ».
- **Une note d'alerte** reste dans la cellule de l'identité, pas dans une ligne orpheline.
- **Pas de cadre** autour d'un tableau déjà posé dans une surface.

## 8. Listes

- **Liste de lignes** (`RowList`) pour gérer et naviguer : une ligne = un objet, lien étiré,
  séparateur `border-subtle`, colonnes dès `md` (titre · état · date · chevron), action principale
  unique au-dessus de la liste. Exemples : mes campagnes, mes sélections, la page-menu.
- **Cartes** pour parcourir des objets visuels et hétérogènes : résultats de recherche, fil de
  campagnes. Elles restent **compactes** : une carte de résultat tient dans un écran de téléphone.
- **Propriétés** (`PropertyList`) pour lire un objet : libellés sur `--size-property-label`,
  valeurs juste à côté ; 2 colonnes de propriétés dès `xl` si la liste dépasse 10 lignes. Jamais
  de grille 50/50 qui éloigne la valeur de son libellé.

## 9. Modales

- `<dialog>` natif : `surface-raised`, `border-default`, `radius-card`, `shadow-lg`, voile
  `overlay-scrim`, focus piégé, `Échap` qui annule sans perdre la saisie, focus rendu au
  déclencheur.
- **Réservées** à une confirmation courte ou à une vérification d'identité (confirmation d'identité
  au backoffice, suppression), et à l'aide des raccourcis `?`.
- **Jamais** pour un formulaire long, une lecture (les CGU s'accommodent d'une page avec retour) ni
  une décision de file : celle-ci se prend dans la colonne de décision.
- **Deux exceptions validées** (maquettes du 2026-11-23 et du 2026-11-24, D87, D88) : le dialogue « Filtres »
  de la recherche (`container-filters`, `size-overlay-max`, en-tête et pied fixes, plein écran sous 768 px,
  rien ne s'applique avant « Voir les … ») et la **galerie** de visuels d'un profil (dialogue plein écran,
  `container-gallery`). Ce sont des vues de choix et de lecture, jamais de saisie longue ; elles gardent focus
  piégé, `Échap` sans perte de saisie et retour du focus au déclencheur. Toute autre modale reste soumise aux
  règles ci-dessus. Composants : `20` §11.8.

## 10. Panneaux latéraux

| Panneau | Où | Comportement |
|---|---|---|
| Colonne de décision | Entrée de file (BO) | Collante dès `lg`, `--spacing-bo-panel-w` ; sous `lg`, après le dossier avec un lien d'évitement « Aller à la décision » |
| Colonne de propriétés | Fiche de compte (BO) | Collante dès `xl`, gestes rares repliés dedans |
| Contexte de conversation | Messagerie à trois (Lot 4) | Même patron ; replié par défaut côté membre sur téléphone |
| Colonne « La marque » | Fiche de campagne | 4 colonnes collantes dès `lg` ; en tête sous `lg` |
| Ma sélection | Recherche (membres) | Existant : panneau dès `lg`, barre collante dessous |
| Filtres | Recherche (membres) | Existant : colonne dès `lg`, panneau ouvrable sur téléphone |

Un panneau ne fait pas quitter l'écran et ne recouvre pas le contenu principal sur ordinateur. Les
panneaux flottants autorisés par F6 sont réservés à ce qui suit le défilement (barre de sélection).

## 11. États interactifs

`20` §11.8 fixe les états repos, survol, appui, focus, désactivé, chargement et erreur. On y
ajoute les états suivants, avec les tokens existants.

| État | Rendu | Composants |
|---|---|---|
| Courant | Fond `nav-item-active-bg` + filet de 2 px `brand-primary` à gauche + `aria-current` | Ligne de file ouverte, entrée de navigation |
| Ajouté | Icône `check` + libellé « Ajouté », contour `border-default`, annonce vocale | « Ajouter à ma sélection » |
| En cours | Libellé d'action en cours (« Enregistrement… »), `aria-busy`, largeur figée, pas d'icône tournante seule | Boutons, sections qui se rechargent |
| Nouveau | Fond `surface-raised` qui s'estompe en 320 ms | Ligne ajoutée, entrée suivante d'une file |
| Verrouillé par un autre | Icône cadenas + nom du détenteur écrit, ligne lisible mais sans lien d'action | Lignes de file |
| Hors délai | Icône drapeau + « Hors délai depuis 49 min » écrit, une seule fois par écran | Files, décisions |

La couleur ne porte jamais seule un état : icône, mot ou forme l'accompagnent toujours.

## 12. Animations et micro-interactions

**Principes.**
- Un mouvement a un seul rôle : retour, continuité ou hiérarchie. Il n'est jamais décoratif et
  jamais permanent, hors du squelette pendant un chargement.
- Seulement `opacity` et `transform` (et les couleurs pour les états). On n'anime ni hauteur ni
  largeur.
- Les durées viennent des tokens : `duration-fast` 120 ms pour les états et les sorties,
  `duration-base` 200 ms pour les entrées, `duration-slow` 320 ms pour l'estompe d'un fond. Les
  courbes aussi : `ease-standard` à l'entrée, `ease-exit` à la sortie.
- Sous `prefers-reduced-motion`, durées à zéro (déjà câblé) et aucune transformation ; l'état final
  reste lisible.
- **Aucune bibliothèque** : CSS `transition`, `@starting-style` (variante `starting:` de Tailwind
  v4), `transition-behavior: allow-discrete` pour `<dialog>` et `details`.

| Interaction | Propriétés | Durée · courbe | Statut |
|---|---|---|---|
| Survol et appui des boutons | couleurs, `scale` 1,03 / 0,98 | 120 ms · standard | Existant (F6, RK-2) |
| Soulèvement d'une carte cliquable | couleurs, `translate` −2 px | 120 ms · standard | Existant |
| Survol d'un item de navigation, d'une ligne | couleurs | 120 ms · standard | Existant |
| Chevron d'accordéon | `rotate` | 200 ms · standard | Existant |
| Contenu d'accordéon ou de `details` qui s'ouvre | `opacity` 0 → 1, `translate` −4 px → 0 | 200 ms · standard | À ajouter |
| Ouverture d'un dialogue | `opacity`, `scale` 0,98 → 1, voile en fondu | 200 ms · standard | À ajouter |
| Fermeture d'un dialogue | `opacity` | 120 ms · sortie | À ajouter |
| Panneau de filtres ou de sélection sur téléphone | `translate` 100 % → 0 vers le haut | 200 ms · standard | À ajouter |
| Bouton qui passe à « Ajouté » | icône en fondu, couleurs | 120 ms · standard | À ajouter |
| Compteur qui change (sélection, files) | fond bref, pas de défilement des chiffres | 320 ms · standard | À ajouter |
| Ligne nouvelle ou entrée suivante | fond `surface-raised` qui s'estompe | 320 ms · standard | À ajouter |
| Changement d'étape de campagne | contenu en fondu, focus sur le `h2` (existant) | 120 ms · standard | À ajouter |
| Squelette | balayage `--animate-skeleton` | 1,2 s · linéaire | À ajouter, supprimé sous mouvement réduit |
| Navigation entre pages | aucune : focus sur le `h1` | — | Existant, à garder |
| Colonnes de contexte (décision BO, « La marque », jauge de la checklist) | `position: sticky`, aucune animation | — | À ajouter (guide `03.md`) |

**Techniques exclues des espaces connectés** (guide `03.md`, `01` §11.2) : apparition d'éléments
à l'entrée dans l'écran, animation liée au défilement, défilement simulé (Lenis, Locomotive),
découpage du texte, rebond, shaders. Elles ne sont envisageables que sur la vitrine, dans la limite
d'un effet spectaculaire par écran (D59).

**Retours d'action.** Au MVP, pas de pile de toasts flottants : le retour se fait **à l'endroit de
l'action** (bouton, ligne, statut d'enregistrement) et dans la région d'annonce de la page. Une
bannière persistante est réservée à ce qui demande une action.

## 13. Onboarding et premières arrivées

Principes tirés du guide `docs/good-practice-ux/01.md` et adaptés aux deux portes d'INFLUX.

1. **Accueillir, puis orienter.** La première arrivée dans un espace salue la personne et redit en
   une phrase pourquoi elle est venue. Le message est adapté à sa porte, sans montant ni promesse
   de rémunération (D48, D78). Pas d'écran intermédiaire : on arrive dans l'espace.
2. **Une checklist d'activation, pas un mode d'emploi.** 3 à 5 tâches, chacune une action qui
   existe déjà, avec une progression écrite (« 1 sur 4 ») doublée d'une barre. La checklist
   remplace « Comment ça marche », puis disparaît une fois terminée au profit de « À traiter ».
3. **La visite guidée se fait dans le flux.** Une tâche ouvre l'écran et place le focus sur le
   champ concerné. Jamais de calque superposé, de fenêtre surgissante à l'ouverture, de vidéo
   d'introduction ni d'info-bulle au survol (invisible au toucher, fragile au clavier).
4. **Les prérequis s'annoncent avant de bloquer.** Tout verrou dit ce qui le lève et combien de
   temps cela prend (délai lu dans la configuration). Il apparaît dès l'accueil, pas au moment où
   l'utilisateur clique. Dans les règles en vigueur, laisser préparer tout ce qui peut l'être.
5. **N'afficher que ce qui sert.** Les options dépendent des réponses déjà données (formats selon
   les réseaux, par exemple). Le filtrage repose sur les choix de l'utilisateur, jamais sur un
   score (D11).
6. **Un sujet par écran.** Sur un écran court, un sujet par groupe titré (`fieldset` +
   `legend`). Les engagements juridiques restent ensemble. Une question facultative vient en
   dernier, marquée « (facultatif) ».
7. **L'utilisateur garde le contrôle.** Aucune action au simple changement d'un champ, aucune case
   qui en modifie une autre en silence. L'enregistrement automatique est toujours visible. Quand
   un parcours s'écarte d'une habitude (connexion sans mot de passe, D37), une phrase l'explique au
   moment où l'on s'y attend.
8. **Des verbes qui disent ce qui se passe.** « Créer mon compte », « Me connecter », « Faire
   valider ma campagne ». Jamais « Valider », « Soumettre » ou « Envoyer » seuls.
9. **Les noms longs passent.** Aucune limite de saisie sous 40 caractères pour un nom ou un
   prénom, 120 pour une raison sociale (déjà le cas) ; les libellés et les cartes se testent avec
   des noms longs.

**Composant `ActivationChecklist`.**

| État d'une tâche | Rendu |
|---|---|
| À faire | Cercle vide, libellé en `text-primary`, précision en `text-secondary`, lien étiré vers l'écran |
| Faite | Icône `check` en `feedback-success-icon`, libellé laissé lisible (non barré), mot « Fait » écrit |
| En attente (examen INFLUX) | Icône horloge, « en cours d'examen · réponse sous ⟨délai⟩ », sans lien |
| Verrouillée | Icône cadenas, « après ⟨condition⟩ » écrit, sans lien |

La jauge est un texte (« 1 sur 4 ») suivi d'une barre décorative. La progression ne dépend jamais
de la couleur seule.
