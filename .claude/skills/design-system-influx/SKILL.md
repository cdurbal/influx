---
name: design-system-influx
description: Concevoir ou modifier un écran INFLUX en respectant le dark theme et la charte de son registre — vitrine (D6, D59) ou espaces connectés en charte KEO Emerald (D73 : espaces marque et créateur, inscription, connexion, backoffice ; pages légales publiques en vitrine) — tokens de design par rôle, trois registres visuels, gabarits (colonne à gauche façon Railway, barre du bas sur mobile), références de comportement, hiérarchie visuelle, états d'écran, accessibilité WCAG AA, affichage des montants. À utiliser avant toute création de composant ou d'interface, et pour étendre la palette.
---

# Design system INFLUX

Objectif : garantir qu'un écran produit aujourd'hui ressemble à ceux produits demain, et qu'il
est compréhensible, accessible et cohérent avec la marque.

Agents concernés : `expert-ux` (principal), `dev-react-node`, `expert-marketing`.

**Ce qui fait foi :** `packages/ui/src/styles/tokens.css` (importé par les deux fronts ; **seule
source des valeurs dans le code**) et `tokens-backoffice.css` (`17b` §6) ; `CLAUDE.md` §4 ;
`docs/mvp/20-direction-design.md` §11 (charte KEO Emerald, D73 : correspondance des tokens,
contrastes, typographie, ce qu'on ne prend pas de la maquette, test du logo, composants), §3
(références de comportement par surface), §4, §7 (apartés) ; `17` §2.2 et §2.3, `17b` §1.7 (gabarits).
`docs/landing-page/03-tokens-provisoires.md` ne justifie que la **vitrine**.
`design-proposals/keo-emerald.css` : valeurs brutes de la maquette, **jamais importé tel quel** (noms
par apparence, fonds `rgba`, valeurs écartées, `20` §11.6). Ce fichier donne les règles ; le détail est
dans `references/`, à lire à la demande.

## Références (à lire quand)

| Fichier | Moment |
|---|---|
| `references/identite-et-tokens.md` | Nommer, valoriser ou ajouter un token ; teinte, contraste, police, logo, e-mail ; tableau d'identité par registre |
| `references/gabarits-et-navigation.md` | Choisir le gabarit d'un écran, toucher à la navigation, aux sous-menus ou aux effets de survol |
| `references/procedure-ecran.md` | Début de conception d'un écran (étapes, états) ; fin de travail (format de sortie, montants au backoffice) |

## Règle absolue

**Aucune couleur, taille de police, espacement ou rayon en dur dans un composant.** Tout passe
par un token. Un composant contenant une valeur littérale est refusé en revue.

## Principes d'identité (détail : `references/identite-et-tokens.md`)

- **INFLUX** en capitales ; **dark theme partout** (D6) ; fond noir nuancé, **jamais de noir pur** ; aucune
  section claire pleine largeur ; texte clair, jamais de blanc pur.
- **Vert** = marque et action, rare ; **succès en sarcelle**, famille distincte, à 20° au moins de
  l'action, jamais plein ; **erreur en rouge opaque** (D72, G3b), jamais translucide ni en fond teinté
  (seule exception : le badge d'erreur, D75 RK-B).
- Surface plus haute = plus claire, doublée d'un filet ; cartes plates ; pilule pour boutons et badges,
  carte à 16 px ; Manrope et Source Sans 3 par `next/font/local`, vitrine en police système.
- **Valeurs figées** (D6, D73) : toute autre valeur de couleur est proposée, justifiée (contraste
  calculé) et validée par le fondateur ; un simple alias relève d'`expert-ux`.
- **Nommer par rôle**, jamais par apparence, registre ou maquette ; mêmes noms dans les trois
  registres, valeur selon le registre.

## Emprunter des comportements, jamais des styles

Les références citées (Linear, Stripe, Intercom, Airbnb, Railway…) apportent des **comportements** :
une file triable au clavier, une chronologie d'affaire, une colonne de navigation fixe à gauche.
**Leur style visuel n'est jamais repris** : le style vient uniquement des tokens.
Test en revue : *sans le logo, reconnaît-on INFLUX, ou la référence ?* La maquette KEO se dit
inspirée de Spotify : sa palette est retenue, ainsi que les effets gardés par F6 et D75 (`20` §11.7,
`references/gabarits-et-navigation.md`). Carte des références par surface : `20` §3.

## Trois registres visuels

| Registre | Application et pages | Charte | Utilisateur et contexte | Règles de densité |
|---|---|---|---|---|
| **Vitrine** | `apps/web` : page d'accueil publique, pages légales publiques, 404 et erreurs de niveau `[locale]`, bandeau cookies | D6, D59 | Visiteur, 10 secondes pour comprendre | Respiration généreuse (`spacing-section-block`), un bouton principal par section |
| **Espaces membres** | `apps/web`, groupe de routes `(member)` : espaces marque et créateur, inscription, connexion | KEO Emerald | Créateur **sur mobile, debout, en 4G** ; marque au bureau | Mobile-first (référence 375 px), cibles `size-touch-target` (2,75 rem), **une décision par écran sur mobile** |
| **Backoffice** | `apps/backoffice` | KEO Emerald | Commercial, huit heures par jour | Dense : tableaux plutôt que cartes, lignes de 36 px, raccourcis clavier. Tokens `*-bo-*` dans `tokens-backoffice.css` (`17b` §6), **interdits dans `apps/web`**. De 768 à 1 023 px, backoffice complet, navigation en liste horizontale. Sur téléphone, **vue limitée à deux gestes** (D58) ; tant qu'elle n'existe pas, aucun contenu métier sous 768 px (`17b` §1.7) |

## Gabarits des espaces connectés (résumé ; tableau complet : `references/gabarits-et-navigation.md`)

- Membres < 1 024 px : en-tête + **barre du bas de 5 entrées**, pas de hamburger, **page-menu** par
  rubrique (D74). Membres ≥ 1 024 px : **colonne à gauche** de 16 rem, sous-menu dans l'entrée active.
- Backoffice : **rail** de 15 rem dès 1 024 px, liste horizontale de 768 à 1 023 px, écran « poste de
  travail » en dessous. Pages autonomes KEO : une colonne, aucune navigation.
- **Un seul `<nav>` « Navigation principale »**, restylé par le CSS (`02` §21.5) ; **ni pilules de
  section ni onglets de rubrique en tête de contenu** (D74) ; entrées sans écran masquées ; aucun repli
  de colonne (D37) ; lien d'évitement en premier ; focus au `h1` après navigation.

## Checklist accessibilité (WCAG AA minimum)

- [ ] Contraste texte/fond ≥ 4,5:1 (texte courant), ≥ 3:1 (texte large et composants d'interface),
      **calculé sur la surface réelle** (page, carte, surélevée, survol, active) — matrice `20` §11.4.
- [ ] **La couleur n'est jamais la seule porteuse d'information** : toujours doublée d'un texte,
      d'une icône ou d'une forme. Un utilisateur daltonien doit comprendre l'état.
- [ ] Navigation clavier complète, ordre de tabulation logique, lien d'évitement, focus visible
      (`color-focus-ring`), **jamais supprimé** (`outline: none` interdit sans remplacement ; seul un
      élément non interactif focalisé par programme n'a pas d'anneau, D75 RK-13).
- [ ] Chaque champ de formulaire a un libellé explicite associé (pas de placeholder seul).
- [ ] Messages d'erreur reliés au champ concerné et annoncés aux technologies d'assistance.
- [ ] Sémantique HTML correcte (titres hiérarchisés, listes, boutons vs liens, une seule navigation
      principale exposée).
- [ ] Texte de 12 px au moins (`text-xs`).
- [ ] Cibles tactiles d'au moins `size-touch-target` dans les espaces membres ; au moins 24 px
      au backoffice (`size-bo-control`).
- [ ] Transformation au survol sous `motion-safe:` seulement, jamais `transition-all` ; animations
      désactivées sous `prefers-reduced-motion` (durées à `duration-instant`, boucles à `none`).

## Checklist INFLUX spécifique

- [ ] **Mobile-first** sur tous les parcours créateur.
- [ ] **Montants, régime du pilote (D48)** : aucun taux, aucun net créateur estimé, ni côté marque ni
      côté créateur ; la commission est « incluse, précisée par votre commercial ». Au backoffice,
      *montant négocié*, *commission convenue* et *commission encaissée* jamais interchangeables,
      toujours avec la devise et l'auteur de la saisie (détail : `references/procedure-ecran.md`).
- [ ] **Chaque zone de saisie annonce qui lira le message** (fil commun, aparté, note interne — `20` §7).
- [ ] **Le commercial est une personne nommée** (« Prénom — INFLUX ») avec son rôle écrit, jamais
      un logo seul.
- [ ] **Bilingue** : l'écran existe en français et en anglais, sans texte en dur.
- [ ] **Pas d'incitation à sortir de la plateforme** : aucun écran n'encourage l'échange de
      coordonnées directes, aucun lien cliquable dans un message.
- [ ] **Deux portes d'entrée** : le discours et le vocabulaire diffèrent entre annonceur et influenceur.
- [ ] **Couleurs de rôle** : marque visuelle seulement, à côté du rôle écrit, dans la liste fermée
      d'usages (`20` §11.3) ; jamais sur un nom, un fond ou un bouton.
- [ ] **Effets des espaces connectés limités à F6 et D75** (halo, ombre du bouton, survol, appui,
      cartes cliquables, panneaux pertinents), par tokens et sous `motion-safe:`, aucun token de la
      vitrine (D59) ; liste : `references/gabarits-et-navigation.md`.
- [ ] **Complétude du profil visible et désirable**, et factuelle.
- [ ] **Recherche et suggestions explicables** : « Proposé car : … », jamais un score en
      pourcentage (le scoring algorithmique est reporté, D11).
- [ ] **Backoffice** : densité d'information, filtres, actions de masse, raccourcis, marqueur de
      vue identifiée, pas de clic superflu.
- [ ] **Logo de marque** sur une pastille claire (`color-logo-plate`) ; **e-mail** à gabarit propre,
      testé en clair et en sombre ; écrans créateur testés dehors sur un vrai téléphone.
