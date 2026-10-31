---
name: design-system-influx
description: Concevoir ou modifier un écran INFLUX en respectant le dark theme et la charte de son registre — vitrine (D6, D59) ou espaces connectés en charte KEO Emerald (D73 : espaces marque et créateur, inscription, connexion, backoffice ; pages légales publiques en vitrine) — tokens de design par rôle, trois registres visuels, gabarits (colonne à gauche façon Railway, barre du bas sur mobile), références de comportement, hiérarchie visuelle, états d'écran, accessibilité WCAG AA, affichage des montants. À utiliser avant toute création de composant ou d'interface, et pour étendre la palette.
---

# Design system INFLUX

Objectif : garantir qu'un écran produit aujourd'hui ressemble à ceux produits demain, et qu'il
est compréhensible, accessible et cohérent avec la marque.

Agents concernés : `expert-ux` (principal), `dev-react-node`, `expert-marketing`.

Documents de référence :
- `packages/ui/src/styles/tokens.css` (importé par les deux fronts) — **seule source des
  valeurs dans le code** (couleurs, tailles, espacements, rayons, ombres, durées), plus
  `tokens-backoffice.css` (`17b` §6).
- `docs/mvp/20-direction-design.md` — **§11 : charte KEO Emerald des espaces connectés (D73)**
  (correspondance des tokens, contrastes, typographie, ce qu'on ne prend pas de la maquette, test du
  logo, inventaire des composants) ; §3 références de comportement par surface ; §4 principes propres
  à INFLUX ; §7 apartés.
- `docs/landing-page/03-tokens-provisoires.md` — justification des valeurs de la **vitrine** seulement.
- `docs/mvp/17-parcours-et-ecrans-espaces-membres.md` (gabarits §2.2 et §2.3) et
  `docs/mvp/17b-parcours-et-ecrans-backoffice.md` (gabarit §1.7) — écrans détaillés et tokens qu'ils
  ajoutent.
- `design-proposals/keo-emerald.css` — valeurs brutes de la maquette retenue. **Jamais importé tel
  quel** : noms par apparence, fonds `rgba`, valeurs écartées (`20` §11.6).

## Identité

| Élément | Règle |
|---|---|
| Nom | **INFLUX**, toujours en capitales |
| Thème | **Dark theme par défaut sur toute la plateforme** (vitrine, espaces membres, backoffice) — D6, tranchée par le fondateur le 2026-09-17 |
| Charte par registre | **Vitrine** (landing, pages légales publiques, 404, bandeau cookies) : valeurs D6, direction D59 (carte métallisée, un seul effet spectaculaire par écran). **Espaces connectés** (espaces marque et créateur, inscription, connexion, texte des CGU affiché dans le parcours, backoffice) : **KEO Emerald**, D73 (`20` §11). Un seul `tokens.css` par front : `@theme` porte la vitrine, le bloc `[data-theme="keo"]` re-valorise les mêmes noms ; attribut posé par `app/[locale]/(member)/layout.tsx` (web) et sur `<html>` (backoffice) (`02` §21.3) |
| Fond | **Noir profond nuancé, jamais de noir pur** (`color-surface-page`, `#0a0b0a` en KEO). **Aucune section claire pleine largeur**. Les tokens `*-inverse` ne servent qu'à des accents de petite taille (pastille de compteur, pastille derrière un logo) |
| Texte | **Clair sur fond sombre** (`color-text-primary`, jamais de blanc pur), contraste fort |
| Élévation | Une surface plus haute est **plus claire** (`surface-card` → `surface-raised` → `surface-hover`), toujours doublée d'un filet `border-default` : la surface seule ne se voit pas (1,07 à 1,30:1). Cartes plates ; `shadow-lg` pour les dialogues et menus seulement |
| Couleur de marque | **Vert** — marque et action principale (`color-brand-*`, `color-action-primary-*`) : `#1dd68a` dans les espaces connectés ; `#29e075` dans la vitrine tant que le fondateur n'a pas tranché l'alignement (`20` §11.1). Le vert reste **rare** : action principale, item actif, sélection |
| Succès | **Sarcelle**, famille distincte du vert de marque (`color-feedback-success-*`) : `#3ccfcf` sous KEO, `#2dd4bf` en vitrine. Teinte du texte et de l'icône de succès **à au moins 20°** de l'action principale (repos, survol, appui) et de l'information, dans chaque charte (garde G3d, `20` §11.3). Le plein reste réservé à l'action : un succès n'est jamais plein |
| Erreur | **Rouge opaque** (D72, garde G3b), jamais translucide ni teinté en fond |
| Polices | Espaces connectés : **Manrope** (titres, chiffres clés, boutons, surtitres) et **Source Sans 3** (corps, champs, navigation, tableaux), par `next/font/local` et fichiers versionnés (`02` §21.4) ; graisses Manrope 700 et 800, Source Sans 3 400 et 600. Vitrine : police système |
| Formes | Pilule pour les boutons, badges et pastilles ; carte à 16 px (`radius-card`) dans les espaces connectés |
| Références | Finition : https://wekollab.fr/, à égaler, jamais à copier. Navigation des espaces connectés : Railway, en comportement seulement (`20` §3) |

**Les valeurs sont figées (D6, D73).** Le choix de la maquette KEO par le fondateur vaut validation de
ses valeurs ; toute **autre** valeur de couleur (y compris une valeur KEO écartée qu'on voudrait
reprendre) est proposée, justifiée (contraste calculé) et validée par le fondateur avant d'entrer
dans le code. Une extension qui ne fait qu'**aliaser** un token existant relève d'`expert-ux`.

## Règle absolue

**Aucune couleur, taille de police, espacement ou rayon en dur dans un composant.** Tout passe
par un token. Un composant contenant une valeur littérale est refusé en revue.

## Emprunter des comportements, jamais des styles

Les références citées (Linear, Stripe, Intercom, Airbnb, Railway…) apportent des **comportements** :
une file triable au clavier, une chronologie d'affaire, une colonne de navigation fixe à gauche.
**Leur style visuel n'est jamais repris** : le style vient uniquement des tokens.
Test en revue : *sans le logo, reconnaît-on INFLUX, ou la référence ?* La maquette KEO se dit
inspirée de Spotify : sa palette est retenue, ainsi que le halo d'en-tête, l'agrandissement au
survol, le soulèvement des cartes (F6, sous `motion-safe:`), l'ombre lumineuse du bouton principal,
et les panneaux flottants là où ils sont pertinents (`20` §11.7).
Carte des références par surface : `docs/mvp/20-direction-design.md` §3.

## Trois registres visuels

| Registre | Application et pages | Charte | Utilisateur et contexte | Règles de densité |
|---|---|---|---|---|
| **Vitrine** | `apps/web` : page d'accueil publique, pages légales publiques, 404 et erreurs de niveau `[locale]`, bandeau cookies | D6, D59 | Visiteur, 10 secondes pour comprendre | Respiration généreuse (`spacing-section-block`), un bouton principal par section |
| **Espaces membres** | `apps/web`, groupe de routes `(member)` : espaces marque et créateur, inscription, connexion | KEO Emerald | Créateur **sur mobile, debout, en 4G** ; marque au bureau | Mobile-first (référence 375 px), cibles `size-touch-target` (2,75 rem), **une décision par écran sur mobile** |
| **Backoffice** | `apps/backoffice` | KEO Emerald | Commercial, huit heures par jour | Dense : tableaux plutôt que cartes, lignes de 36 px, raccourcis clavier. Tokens `*-bo-*` dans `tokens-backoffice.css` (`17b` §6), **interdits dans `apps/web`**. De 768 à 1 023 px, backoffice complet, navigation en liste horizontale. Sur téléphone, **vue limitée à deux gestes** (D58) ; tant qu'elle n'existe pas, aucun contenu métier sous 768 px (`17b` §1.7) |

## Gabarits des espaces connectés

| Gabarit | Règle | Source |
|---|---|---|
| Espaces membres < 1 024 px | En-tête (INFLUX, cloche, langue) + **barre du bas de 5 items**, libellés toujours visibles, zone de sécurité de l'appareil ; tablette : même gabarit, cellules plafonnées ; **pas de hamburger** | `17` §2.2 |
| Espaces membres ≥ 1 024 px | **Colonne à gauche** de 16 rem, collante, pleine hauteur, à filet : en-tête (INFLUX, espace et point de rôle), items icône + libellé, bloc d'état du compte, pied (aide, langue, identité, se déconnecter) | `17` §2.3 |
| Backoffice ≥ 1 024 px | **Rail à gauche** de 15 rem (sept entrées de `17b` §1.2), bande de tête au-dessus du contenu, lignes de 36 px | `17b` §1.7 |
| Backoffice 768–1 023 px | Backoffice complet ; le même `<nav>` en liste horizontale compacte sous la bande | `17b` §1.7 |
| Backoffice < 768 px | Écran « poste de travail », aucun contenu métier, jusqu'aux vues D58 | `17b` §1.7 |
| Page autonome KEO | Inscription, connexion, déconnecté, compte supprimé, CGU à ré-accepter : INFLUX et langue, une colonne, aucune navigation (les pages légales publiques gardent le gabarit de la vitrine) | `20` §11.8 |

Règles communes : **un seul `<nav>` « Navigation principale », rendu une fois et restylé par le
CSS** selon la largeur (`02` §21.5), sans détection de largeur en JavaScript ni second `<nav>` masqué,
avec un libellé par entrée identique aux deux largeurs (≤ 11 caractères) ; pages sœurs d'une rubrique en **liens de section** en tête
de contenu ; entrées dont l'écran n'existe pas **masquées**, et une entrée apparue ne disparaît plus ;
**aucun repli de colonne** (le front n'a aucun stockage pour le mémoriser, D37) ; lien d'évitement en
premier ; focus au `h1` après navigation.

## Structure des tokens attendue

Nommer par rôle, pas par apparence (`color-action-primary-bg`, pas `color-green-500`), **ni par
registre ou par maquette** (jamais `keo-*`, `spotify-*`, `surface-3`). Les mêmes noms valent dans les
trois registres ; **la valeur dépend du registre** (`20` §11.1).

| Famille | Rôles à couvrir |
|---|---|
| Couleur — marque et action | action principale, survol, appui, désactivé, action secondaire (fond, contour ≥ 3:1, survol), danger |
| Couleur — texte | principal (clair), secondaire, tertiaire (jamais sur `surface-active`), sur action (sombre), inversé, désactivé |
| Couleur — surface | page, muette, carte, surélevée, survol, active, bordures (subtile, défaut, forte ≥ 3:1, sélection, erreur), focus |
| Couleur — sémantique | succès (sarcelle), alerte, erreur, information — chacune en texte, fond, bordure, icône. **Erreur = rouge opaque** : fond du conteneur (`transparent`), bordure pleine, icône et texte rouges, jamais de fond rouge teinté ni de rouge translucide ; action destructive = bouton `action-danger-*` plein (`20` §10, garde G3b). Succès, alerte et information gardent un fond teinté **opaque** (DZ-6) |
| Couleur — rôles et vérifié | `role-advertiser` (sable), `role-creator` (rose) : **marque visuelle seulement**, point suivi du rôle écrit, liste fermée d'usages (`20` §11.3) ; `verified-text` (bleu) : badge « Vérifié · réseau · date », jamais une coche seule |
| Couleur — navigation | survol, item actif, indicateur, pastille de compteur |
| Couleur — données | trois couleurs de série, graphiques seulement, jamais pour un état ou un rôle |
| Couleur — backoffice | vue identifiée (violet, **seule teinte réservée au backoffice**), délais, alertes, environnement (`17b` §6) |
| Typographie | familles par registre (`font-display`, `font-base`), échelle fixe dans les espaces connectés (`text-title-page`, `text-title-section`, plancher `text-xs`), graisses, interlignes ; chiffres tabulaires pour les montants |
| Espacement | échelle unique de base 4 px, tokens sémantiques |
| Rayon / élévation | `radius-card`, `radius-md`, `radius-sm`, `radius-pill`, cohérents sur tous les composants ; cartes plates |

**Le vert de marque et le « succès » sont deux familles distinctes** : sinon toute évolution de la
marque casse la sémantique des états, et un état ressemble à une action.

## Pièges propres au dark theme

| Piège | Règle |
|---|---|
| **Logos de marques** | Beaucoup sont dessinés pour fond blanc et disparaissent sur fond noir. Tout logo déposé par une marque s'affiche sur une **pastille claire** (`color-logo-plate`), jamais directement sur une surface sombre |
| **Vert en texte** | Le vert vif est fait pour les boutons et les accents, avec du **texte sombre dessus** (`color-text-on-action`). En texte courant, un vert saturé vibre et fatigue : réserver `color-text-brand` aux mots-clés et aux liens survolés ; jamais sur un montant ni sur un état |
| **Gris trop pâles** | Ne jamais descendre sous `color-text-tertiary`, et ne l'utiliser que pour des aides, des dates et des provenances. Il tombe à 4,13:1 sur `surface-active` : interdit là |
| **Rouge sur surface claire** | Le texte d'erreur tient 4,53:1 sur `surface-hover`, 3,91:1 sur `surface-active` : jamais au-delà de `surface-hover` |
| **Translucide** | Pas de fond en `rgba` pour une couleur d'état : sa valeur change selon la surface et son contraste devient invérifiable. Interdit pour le rouge (G3b), évité partout ailleurs |
| **Émeraude et sarcelle** | La sarcelle de la vitrine `#2dd4bf` n'est qu'à 17° du vert KEO : sous KEO, le succès est `#3ccfcf` (25°). Toute nouvelle teinte de succès ou d'action se vérifie contre le seuil de 20° (G3d) ; la forme reste un second séparateur (plein = action ; succès en contour + icône + mot) |
| **Ressemblance avec Spotify** | Vert vif sur noir, pilules, halo, ombre lumineuse du bouton, agrandissement, soulèvement et panneaux flottants (gardés, F6) : les signatures INFLUX doivent se voir sur chaque gabarit ; panneau flottant seulement s'il sert l'écran (`20` §11.7) |
| **Polices** | `next/font/local`, fichiers variables versionnés, sous-ensembles latins, métriques de repli ajustées ; **aucun appel à Google Fonts** (`next/font/google` interdit) ; chargées par les deux seules mises en page KEO, jamais par la vitrine |
| **E-mails** | Les clients de messagerie inversent les couleurs à leur manière. Un e-mail (dont le **code de connexion**, D43) a son propre gabarit, **testé en clair et en sombre** ; ce n'est pas une copie du dark theme |
| **Lecture en extérieur** | Un fond sombre se lit moins bien en plein soleil. Les écrans créateur se testent **dehors, sur un vrai téléphone**, pas seulement au bureau |
| **Captures d'écran** | Une information portée par un fond teinté disparaît sur une capture recadrée ou une impression. La **forme et le texte** la portent ; la couleur ne fait que renforcer |

## Procédure pour un nouvel écran

1. **Identifier la population, la tâche et le registre** : annonceur · créateur · commercial,
   et vitrine · espace membre · backoffice (tableau ci-dessus) — le registre décide de la charte.
2. **Choisir le gabarit** (tableau « Gabarits ») et **la référence de comportement** dans
   `20-direction-design.md` §3 — en notant ce qu'on ne lui prend pas.
3. **Structurer l'information** avant de dessiner : quoi d'abord, quoi ensuite, quoi jamais.
4. **Wireframer** en texte structuré ou schéma ASCII.
5. **Définir tous les états** — un écran sans état vide est incomplet :
   - [ ] Chargement
   - [ ] Vide (première utilisation, avec une action claire pour démarrer)
   - [ ] Nominal
   - [ ] Erreur (message actionnable, pas de trace technique)
   - [ ] Accès refusé
   - [ ] Succès / confirmation
6. **Écrire les microcopies** en **français et en anglais**, ton direct, sans jargon, orienté
   bénéfice. Aucun texte en dur : tout passe par les fichiers de traduction. Prévoir des libellés
   de longueur variable selon la langue, et des formulations neutres en genre.
7. **Vérifier l'accessibilité** (ci-dessous).
8. **Lister les tokens utilisés** et les nouveaux tokens proposés, en reprenant les composants de
   `20` §11.8 avant d'en créer un.

## Checklist accessibilité (WCAG AA minimum)

- [ ] Contraste texte/fond ≥ 4,5:1 (texte courant), ≥ 3:1 (texte large et composants d'interface),
      **calculé sur la surface réelle** (page, carte, surélevée, survol, active), pas seulement sur la
      page — matrice de `20` §11.4.
- [ ] **La couleur n'est jamais la seule porteuse d'information** : toujours doublée d'un texte,
      d'une icône ou d'une forme. Un utilisateur daltonien doit comprendre l'état.
- [ ] Navigation clavier complète, ordre de tabulation logique, lien d'évitement, focus visible
      (`color-focus-ring`), **jamais supprimé** (`outline: none` interdit sans remplacement).
- [ ] Chaque champ de formulaire a un libellé explicite associé (pas de placeholder seul).
- [ ] Messages d'erreur reliés au champ concerné et annoncés aux technologies d'assistance.
- [ ] Sémantique HTML correcte (titres hiérarchisés, listes, boutons vs liens, une seule navigation
      principale exposée).
- [ ] Texte de 12 px au moins (`text-xs`).
- [ ] Cibles tactiles d'au moins `size-touch-target` dans les espaces membres ; au moins 24 px
      au backoffice (`size-bo-control`).
- [ ] Transformation au survol sous `motion-safe:` seulement, jamais `transition-all` ; animations désactivées sous `prefers-reduced-motion` (les
      durées passent à `duration-instant`, les animations en boucle à `none`).

## Checklist INFLUX spécifique

- [ ] **Mobile-first** sur tous les parcours créateur.
- [ ] **Affichage des montants — régime du pilote (D48)** : aucun taux et aucun net créateur
      estimé, ni côté marque ni côté créateur ; la commission est « incluse, précisée par votre
      commercial ». Au backoffice, trois libellés jamais interchangeables — *montant négocié*,
      *commission convenue*, *commission encaissée* — **toujours avec la devise**, jamais de
      pourcentage, jamais de total toutes devises, **jamais un montant déduit d'un autre** : chaque
      montant affiche **qui l'a saisi et quand**. Chiffres tabulaires, montant et devise insécables,
      montants en `text-primary` (jamais en vert).
      *(Cible V2 : les trois notions montant du contrat / commission et ses deux parts / net
      créateur, dans un même bloc — `17` §7.3.)*
- [ ] **Chaque zone de saisie annonce qui lira le message** (fil commun, aparté, note interne —
      `20` §7).
- [ ] **Le commercial est une personne nommée** (« Prénom — INFLUX ») avec son rôle écrit, jamais
      un logo seul.
- [ ] **Bilingue** : l'écran existe en français et en anglais, sans texte en dur.
- [ ] **Pas d'incitation à sortir de la plateforme** : aucun écran n'encourage l'échange de
      coordonnées directes, aucun lien cliquable dans un message.
- [ ] **Deux portes d'entrée** : le discours et le vocabulaire diffèrent entre annonceur et
      influenceur.
- [ ] **Couleurs de rôle** : marque visuelle seulement, à côté du rôle écrit, dans la liste fermée
      d'usages (`20` §11.3) ; jamais sur un nom, un fond ou un bouton.
- [ ] **Effets des espaces connectés limités à F6** : halo d'en-tête par token de rôle,
      ombre lumineuse du bouton principal par token, agrandissement au survol et soulèvement des
      cartes sous `motion-safe:`, panneaux flottants seulement s'ils sont pertinents ; ni réduction
      à l'appui, ni token de la vitrine (D59) (`20` §11.5).
- [ ] **Complétude du profil visible et désirable**, et factuelle.
- [ ] **Recherche et suggestions explicables** : « Proposé car : … », jamais un score en
      pourcentage (le scoring algorithmique est reporté, D11).
- [ ] **Backoffice** : densité d'information, filtres, actions de masse, raccourcis, marqueur de
      vue identifiée, pas de clic superflu.

## Ajouter un token

1. Vérifier qu'aucun token existant ne couvre le besoin (c'est le cas le plus fréquent) ; un
   **alias** d'un token existant est préférable à une nouvelle valeur.
2. Nommer par rôle ; dire dans quel(s) registre(s) il vaut et, s'il diffère, sa valeur dans chacun.
3. Vérifier les contrastes dans tous les usages prévus, sur chaque surface sombre concernée.
4. Documenter : nom, valeur, rôle, quand l'utiliser et quand ne pas l'utiliser (`20` §11 pour les
   espaces connectés).
5. Faire valider par `expert-ux` ; toute **nouvelle valeur de couleur** par le fondateur (D6) — une
   valeur de la maquette KEO écartée en `20` §11.6 compte comme une nouvelle valeur.

## Format de sortie

**Population, tâche et registre** → **Référence de comportement (et ce qu'on n'en prend pas)** →
**Structure de l'information** → **Wireframe** → **États** → **Microcopies** →
**Tokens utilisés / proposés** → **Vérifications d'accessibilité** → **À valider par le fondateur**.
