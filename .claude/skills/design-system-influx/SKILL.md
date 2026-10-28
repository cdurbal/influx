---
name: design-system-influx
description: Concevoir ou modifier un écran INFLUX en respectant le dark theme (noir profond nuancé, vert de marque, D6) et le niveau de finition de wekollab.fr — tokens de design, trois registres visuels (landing, espaces membres, backoffice), références de comportement, hiérarchie visuelle, états d'écran, accessibilité WCAG AA, affichage des montants. À utiliser avant toute création de composant ou d'interface, et pour étendre la palette.
---

# Design system INFLUX

Objectif : garantir qu'un écran produit aujourd'hui ressemble à ceux produits demain, et qu'il
est compréhensible, accessible et cohérent avec la marque.

Agents concernés : `expert-ux` (principal), `dev-react-node`, `expert-marketing`.

Documents de référence :
- `apps/web/src/styles/tokens.css` — **source unique** des valeurs (couleurs, tailles, espacements,
  rayons, ombres, durées). Justification de chaque valeur : `docs/landing-page/03-tokens-provisoires.md`.
- `docs/mvp/20-direction-design.md` — carte des références par surface, principes propres à
  INFLUX, zone de saisie des apartés.
- `docs/mvp/17-parcours-et-ecrans-espaces-membres.md` et `docs/mvp/17b-parcours-et-ecrans-backoffice.md`
  — écrans détaillés et tokens qu'ils ajoutent.

## Identité

| Élément | Règle |
|---|---|
| Nom | **INFLUX**, toujours en capitales |
| Thème | **Dark theme par défaut sur toute la plateforme** (landing, espaces membres, backoffice) — D6, tranchée par le fondateur le 2026-09-17 |
| Fond | **Noir profond nuancé, jamais de noir pur** (`color-surface-page`). **Aucune section claire pleine largeur**, footer et CTA final compris. Les tokens `*-inverse` ne servent qu'à des accents de petite taille (puce, cadre de mockup, pastille derrière un logo) |
| Texte | **Clair sur fond sombre** (`color-text-primary`, jamais de blanc pur), contraste fort |
| Élévation | Une surface plus haute est **plus claire** (`surface-card` → `surface-raised` → `surface-hover`), doublée d'un filet presque transparent : une ombre seule disparaît sur fond noir |
| Couleur de marque | **Vert** — marque et action principale (`color-brand-*`, `color-action-primary-*`) |
| Succès | **Sarcelle**, famille distincte du vert de marque (`color-feedback-success-*`). Un badge « Acceptée » vert ressemblerait à un bouton |
| Référence | https://wekollab.fr/ — niveau de finition à égaler, jamais à copier |

**Les valeurs sont figées (D6).** Toute nouvelle valeur de couleur est proposée, justifiée
(contraste calculé) et validée par le fondateur avant d'entrer dans le code. Une extension qui ne
fait qu'**aliaser** un token existant relève d'`expert-ux`.

## Règle absolue

**Aucune couleur, taille de police, espacement ou rayon en dur dans un composant.** Tout passe
par un token. Un composant contenant une valeur littérale est refusé en revue.

## Emprunter des comportements, jamais des styles

Les références citées (Linear, Stripe, Intercom, Airbnb…) apportent des **comportements** :
une file triable au clavier, une chronologie d'affaire, une zone de saisie qui change d'audience.
**Leur style visuel n'est jamais repris** : le style vient uniquement de `tokens.css`.
Test en revue : *sans le logo, reconnaît-on INFLUX, ou la référence ?*
Carte des références par surface : `docs/mvp/20-direction-design.md` §3.

## Trois registres visuels

| Registre | Application | Utilisateur et contexte | Règles de densité |
|---|---|---|---|
| **Vitrine** | `apps/web`, pages publiques | Visiteur, 10 secondes pour comprendre | Respiration généreuse (`spacing-section-block`), un bouton principal par section |
| **Espaces membres** | `apps/web`, espaces marque et créateur | Créateur **sur mobile, debout, en 4G** ; marque au bureau | Mobile-first (référence 375 px), cibles `size-touch-target` (2,75 rem), **une décision par écran sur mobile** |
| **Backoffice** | `apps/backoffice` | Commercial, huit heures par jour | Dense : tableaux plutôt que cartes, lignes de 36 px, raccourcis clavier. Tokens `*-bo-*` dans `tokens-backoffice.css` (`17b` §6), **interdits dans `apps/web`**. Sur téléphone, **vue limitée à deux gestes** (conversation, file de validation — D58), avec des cibles tactiles de taille membre |

## Structure des tokens attendue

Nommer par rôle, pas par apparence (`color-action-primary-bg`, pas `color-green-500`) :

| Famille | Rôles à couvrir |
|---|---|
| Couleur — marque et action | action principale, survol, actif, désactivé, action secondaire |
| Couleur — texte | principal (clair), secondaire, tertiaire, sur action (sombre), inversé, désactivé |
| Couleur — surface | page, muette, carte, surélevée, survol, bordures (subtile, défaut, forte, sélection) |
| Couleur — sémantique | succès (sarcelle), alerte, erreur, information — chacune en texte, fond, bordure, icône. **Erreur = rouge opaque** : fond du conteneur (`transparent`), bordure pleine, icône et texte rouges, jamais de fond rouge teinté ni de rouge translucide ; action destructive = bouton `action-danger-*` plein (`20` §10, garde G3b) |
| Couleur — backoffice | vue identifiée (violet, **seule teinte réservée au backoffice**), délais, alertes (`17b` §6) |
| Typographie | échelle de tailles, graisses, hauteurs de ligne ; chiffres tabulaires pour les montants |
| Espacement | échelle unique de base 4 px, tokens sémantiques |
| Rayon / élévation | cohérents sur tous les composants |

**Le vert de marque et le « succès » sont deux familles distinctes** : sinon toute évolution de la
marque casse la sémantique des états, et un état ressemble à une action.

## Pièges propres au dark theme

| Piège | Règle |
|---|---|
| **Logos de marques** | Beaucoup sont dessinés pour fond blanc et disparaissent sur fond noir. Tout logo déposé par une marque s'affiche sur une **pastille claire** (`color-surface-inverse`), jamais directement sur une surface sombre |
| **Vert en texte** | Le vert vif est fait pour les boutons et les accents, avec du **texte sombre dessus** (`color-text-on-action`). En texte courant sur fond sombre, un vert saturé vibre et fatigue : réserver `color-text-brand` aux mots-clés et aux liens |
| **Gris trop pâles** | Les références « premium » utilisent des gris secondaires très faibles. Ne jamais descendre sous `color-text-tertiary`, et ne l'utiliser que pour des aides et des mentions, jamais pour une information à lire |
| **E-mails** | Les clients de messagerie inversent les couleurs à leur manière. Un e-mail (dont le **code de connexion**, D43) a son propre gabarit, **testé en clair et en sombre** ; ce n'est pas une copie du dark theme |
| **Lecture en extérieur** | Un fond sombre se lit moins bien en plein soleil. Les écrans créateur se testent **dehors, sur un vrai téléphone**, pas seulement au bureau |
| **Captures d'écran** | Une information portée par un fond teinté disparaît sur une capture recadrée ou une impression. La **forme et le texte** la portent ; la couleur ne fait que renforcer |

## Procédure pour un nouvel écran

1. **Identifier la population, la tâche et le registre** : annonceur · créateur · commercial,
   et vitrine · espace membre · backoffice (tableau ci-dessus).
2. **Choisir la référence de comportement** dans `20-direction-design.md` §3 — et noter ce qu'on
   ne lui prend pas.
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
8. **Lister les tokens utilisés** et les nouveaux tokens proposés.

## Checklist accessibilité (WCAG AA minimum)

- [ ] Contraste texte/fond ≥ 4,5:1 (texte courant), ≥ 3:1 (texte large et composants d'interface),
      **calculé sur la surface réelle** (page, carte, surélevée, survol), pas seulement sur la page.
- [ ] **La couleur n'est jamais la seule porteuse d'information** : toujours doublée d'un texte,
      d'une icône ou d'une forme. Un utilisateur daltonien doit comprendre l'état.
- [ ] Navigation clavier complète, ordre de tabulation logique, focus visible (`color-focus-ring`).
- [ ] Chaque champ de formulaire a un libellé explicite associé (pas de placeholder seul).
- [ ] Messages d'erreur reliés au champ concerné et annoncés aux technologies d'assistance.
- [ ] Sémantique HTML correcte (titres hiérarchisés, listes, boutons vs liens).
- [ ] Cibles tactiles d'au moins `size-touch-target` dans les espaces membres ; au moins 24 px
      au backoffice (`size-bo-control`).
- [ ] Animations désactivées sous `prefers-reduced-motion` (les durées passent à `duration-instant`).

## Checklist INFLUX spécifique

- [ ] **Mobile-first** sur tous les parcours créateur.
- [ ] **Affichage des montants — régime du pilote (D48)** : aucun taux et aucun net créateur
      estimé, ni côté marque ni côté créateur ; la commission est « incluse, précisée par votre
      commercial ». Au backoffice, trois libellés jamais interchangeables — *montant négocié*,
      *commission convenue*, *commission encaissée* — **toujours avec la devise**, jamais de
      pourcentage, jamais de total toutes devises, **jamais un montant déduit d'un autre** : chaque
      montant affiche **qui l'a saisi et quand**. Chiffres tabulaires, montant et devise insécables.
      *(Cible V2 : les trois notions montant du contrat / commission et ses deux parts / net
      créateur, dans un même bloc — `17` §7.3.)*
- [ ] **Chaque zone de saisie annonce qui lira le message** (fil commun, aparté, note interne —
      `20` §5).
- [ ] **Le commercial est une personne nommée** (« Prénom — INFLUX ») avec son rôle écrit, jamais
      un logo seul.
- [ ] **Bilingue** : l'écran existe en français et en anglais, sans texte en dur.
- [ ] **Pas d'incitation à sortir de la plateforme** : aucun écran n'encourage l'échange de
      coordonnées directes, aucun lien cliquable dans un message.
- [ ] **Deux portes d'entrée** : le discours et le vocabulaire diffèrent entre annonceur et
      influenceur.
- [ ] **Complétude du profil visible et désirable**, et factuelle.
- [ ] **Recherche et suggestions explicables** : « Proposé car : … », jamais un score en
      pourcentage (le scoring algorithmique est reporté, D11).
- [ ] **Backoffice** : densité d'information, filtres, actions de masse, raccourcis, marqueur de
      vue identifiée, pas de clic superflu.

## Ajouter un token

1. Vérifier qu'aucun token existant ne couvre le besoin (c'est le cas le plus fréquent) ; un
   **alias** d'un token existant est préférable à une nouvelle valeur.
2. Nommer par rôle.
3. Vérifier les contrastes dans tous les usages prévus, sur chaque surface sombre concernée.
4. Documenter : nom, valeur, rôle, quand l'utiliser et quand ne pas l'utiliser.
5. Faire valider par `expert-ux` ; toute **nouvelle valeur de couleur** par le fondateur (D6).

## Format de sortie

**Population, tâche et registre** → **Référence de comportement (et ce qu'on n'en prend pas)** →
**Structure de l'information** → **Wireframe** → **États** → **Microcopies** →
**Tokens utilisés / proposés** → **Vérifications d'accessibilité** → **À valider par le fondateur**.
