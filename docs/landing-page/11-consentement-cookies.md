# Popin de consentement cookies — spécification de design

> **Ajout du 2026-09-24 (D55).** La source d'acquisition d'un inscrit (paramètres UTM, domaine
> d'origine, code d'invitation) est enregistrée **sans traceur** : seuls les paramètres de la session
> d'inscription sont retenus, transmis dans le parcours ou conservés côté serveur
> (`docs/mvp/05-spec-inscription-et-leads.md` RG120 à RG122). Si un stockage dans le navigateur ou
> une attribution sur plusieurs visites était un jour ajouté, il entrerait dans l'inventaire des
> traceurs de ce document et dans le consentement.

> **Statut :** spécification de design, rédigée par `expert-ux` le 2026-09-17
> (skill `design-system-influx`). **Remplace `02-ux-wireframes.md` §3.20** pour le composant
> `CookieBanner.tsx` : deux boutons au lieu de trois (« Personnaliser » supprimé, cf. §8).
> **Sources :** `CLAUDE.md` §5 (dark theme, WCAG AA, bilingue), `apps/web/src/styles/tokens.css`
> (seule source de valeurs), `01-architecture.md` §5 et §11 (next-intl, D28),
> `07-revue-conformite.md` §2.5 et ligne L9.
> **Destinataires :** `dev-react-node` (implémentation), `expert-conformite-rgpd` (validation du
> texte et du modèle « tout ou rien », §8), `testeur`.
> **Portée :** pages publiques de `apps/web` (landing et pages légales). L'app membres et le
> backoffice réutiliseront le composant tel quel.

---

## 1. Population, tâche, contexte

| | |
|---|---|
| Population | Visiteur non identifié : annonceur pressé (desktop), créateur (mobile), toutes langues |
| Tâche réelle | **Lire la landing.** Le consentement est une tâche imposée, pas désirée : elle doit se régler en un clic, sans lire un paragraphe |
| Moment | Premier rendu de la première page vue, avant toute interaction |
| Contrainte métier | Un visiteur bloqué par une popin est un lead perdu (§3 du CLAUDE.md : les leads sont le second pilier) |

**Décision directrice :** la popin **n'est pas modale**. Elle n'empêche ni la lecture, ni le
défilement, ni le clic sur un CTA. Elle ne pose aucun voile sombre sur la page.

## 2. Enseignements du benchmark

| Observé ailleurs | Décision INFLUX |
|---|---|
| wekollab.fr et la plupart des sites FR : bandeau bas pleine largeur, voile, 3 boutons | Pas de voile, pas de « Personnaliser » : deux choix, un clic |
| Bandeau pleine largeur sur desktop | **Carte flottante en bas à gauche** sur desktop : elle n'écrase pas la section suivante et laisse le hero entier |
| « Accepter » vert et proéminent, « Refuser » en lien gris | **Interdit** : refuser doit être aussi simple qu'accepter (CNIL / EDPB). Les deux boutons ont le **même style, la même taille, le même poids** |
| Croix de fermeture en haut à droite | **Supprimée** : fermer sans choisir est ambigu juridiquement et laisse la popin revenir à chaque page |
| Popin qui réapparaît à chaque navigation interne | Le choix est mémorisé, la popin ne revient pas (§7) |

## 3. Structure de l'information

Ordre de lecture imposé, du plus utile au moins utile :

1. **Titre court** — de quoi on parle (« Cookies »).
2. **Une phrase** — ce qu'on dépose, pourquoi, et qu'on peut changer d'avis.
3. **Deux boutons** de même niveau — l'action.
4. **Lien** vers la politique de confidentialité — pour les 2 % qui veulent le détail.

Jamais présent : liste de finalités, compteur de partenaires, logos, illustration, second
paragraphe.

## 4. Wireframe

### 4.1 Mobile (< 768 px) — feuille basse, pleine largeur

```
 ┌──────────────────────────────────────────┐
 │                                          │  ← coins hauts arrondis (radius-lg),
 │  Cookies                          (fort) │    collée aux bords gauche/droite/bas
 │  Nous utilisons des cookies pour         │
 │  mesurer l'audience du site. Vous        │    (texte : text-sm, 2 à 3 lignes max)
 │  pouvez changer d'avis à tout moment.    │
 │                                          │
 │  ┌───────────────┐ ┌───────────────────┐ │  ← 2 colonnes égales, gap spacing-3
 │  │ Tout accepter │ │  Tout refuser     │ │    hauteur size-button-md (44 px)
 │  └───────────────┘ └───────────────────┘ │
 │                                          │
 │  Politique de confidentialité →          │  ← lien, text-xs
 └──────────────────────────────────────────┘
 ▲ filet haut : border-width-thin / color-border-default
```

Contenu de la page visible au-dessus, défilement libre.

### 4.2 Desktop (≥ 768 px) — carte flottante, bas gauche

```
  ┌──────────────────────────────────────────────┐
  │  Cookies                                     │   largeur : min(26rem, calc(100vw - 2×gutter))
  │  Nous utilisons des cookies pour mesurer     │   ancrage : bottom / left = spacing-5
  │  l'audience du site. Vous pouvez changer     │   radius-lg sur les 4 coins
  │  d'avis à tout moment.                       │   shadow-lg
  │                                              │
  │  [ Tout accepter ]  [ Tout refuser ]         │   boutons côte à côte, largeur au contenu
  │                                              │
  │  Politique de confidentialité →              │
  └──────────────────────────────────────────────┘
       reste de la page entièrement lisible et cliquable
```

**Position DOM** : tôt dans le document, avant `SiteHeader` (règle conservée de `02` §2.1) — un
utilisateur clavier la traite au premier `Tab` au lieu de traverser la page. Rendu visuel : fixé
en bas via `position: fixed`.

## 5. Style visuel — tokens exclusivement

Aucune valeur littérale : tout vient de `apps/web/src/styles/tokens.css`.

| Élément | Token(s) |
|---|---|
| Fond du conteneur | `color-surface-raised` |
| Bordure | `border-width-thin` + `color-border-default` (mobile : filet haut seul ; desktop : bordure complète) |
| Ombre | `shadow-lg` |
| Rayon | `radius-lg` (mobile : coins **hauts** uniquement ; desktop : 4 coins) |
| Empilement | `z-cookie-banner` (300) |
| Padding interne | `spacing-inset-card` |
| Marge d'ancrage desktop | `spacing-5` (bas et gauche) |
| Largeur desktop | `26rem` max → **nouveau token demandé** `--size-cookie-banner` (§5.1) |
| Écart titre → texte | `spacing-stack-sm` |
| Écart texte → boutons | `spacing-stack-md` |
| Écart boutons → lien | `spacing-stack-md` |
| Écart entre les deux boutons | `spacing-3` |
| Titre | `text-sm`, `font-weight-semibold`, `color-text-primary`, `tracking-normal`, balise `<p>` (pas de `hN`) |
| Corps | `text-sm`, `font-weight-regular`, `color-text-secondary`, `leading-body` |
| Lien | `text-xs`, `color-text-brand`, souligné en permanence (le vert n'est jamais seul porteur d'information) |
| Boutons (les deux) | style **Secondaire** de `02` §2.2 : `color-action-secondary-bg` (transparent), `border-width-thick` + `color-action-secondary-border`, `color-text-primary`, `radius-sm`, hauteur `size-button-md`, padding X `spacing-inset-button-x`, `text-sm`, `font-weight-medium` |
| Transition | `duration-base` / `ease-standard` (entrée), `duration-fast` / `ease-exit` (sortie) |

**Pourquoi deux boutons secondaires et non un bouton vert.** Le vert de marque
(`color-action-primary-bg`) signifie « action que nous recommandons ». L'appliquer à
« Tout accepter » crée un déséquilibre visuel non conforme et abîme la confiance. Le vert reste
disponible sur le lien et sur le halo de focus — jamais sur un seul des deux choix.

### 5.1 Nouveaux tokens proposés (à ajouter dans `tokens.css`, aucune couleur nouvelle)

| Token | Valeur | Justification |
|---|---|---|
| `--size-cookie-banner` | `26rem` | Largeur maximale de la carte desktop. Sans lui, le développeur écrirait une valeur arbitraire, interdite par CA22 |

`--z-cookie-banner` existe déjà : aucun ajout d'empilement.

## 6. États, apparition, accessibilité

### 6.1 Apparition et disparition

| Moment | Comportement |
|---|---|
| Premier rendu | Visible **immédiatement**, sans délai ni animation d'attente. Aucun traceur non essentiel n'est déposé avant le choix |
| Animation d'entrée | Translation verticale courte (de sa propre hauteur vers 0) + opacité, `duration-base`, `ease-standard` |
| Animation de sortie | Inverse, `duration-fast`, `ease-exit`, puis retrait du DOM |
| Mouvement réduit | `prefers-reduced-motion` est déjà géré par les tokens (toutes les durées passent à `duration-instant`) : apparition/disparition sèches, aucune règle supplémentaire |
| Menu mobile ouvert | La popin reste au-dessus et utilisable (`z-cookie-banner` > `z-header`) |

### 6.2 États des contrôles

| État | Rendu |
|---|---|
| Par défaut | Bouton secondaire, fond transparent, bordure `color-action-secondary-border` |
| Survol | Fond `color-action-secondary-bg-hover`, même bordure, même texte. Curseur pointeur |
| Pressé | Fond `color-action-secondary-bg-active` |
| Focus clavier | Halo `focus-ring-width` (3 px) en `color-focus-ring` avec `focus-ring-offset` (2 px), **visible sur les deux boutons et sur le lien**. Jamais supprimé, jamais remplacé par une simple couleur de fond |
| Lien survolé / focus | Même halo ; couleur `color-text-brand-strong` au survol |
| Désactivé | **N'existe pas** : aucun des deux boutons n'est jamais désactivé |

### 6.3 États de l'écran

| État | Comportement |
|---|---|
| **Par défaut** (aucun choix connu) | Popin visible |
| **Choix déjà exprimé** | Popin **jamais montée** — pas de flash, pas d'apparition puis disparition |
| **Chargement** | Aucun : le composant ne dépend d'aucune requête réseau. S'il existe une micro-latence de lecture du choix, on ne rend rien du tout plutôt qu'une popin qui clignote |
| **Erreur** (choix impossible à mémoriser : stockage indisponible, mode privé restrictif) | Le choix est **appliqué pour la session en cours** et la popin se ferme. Aucun message d'erreur : le visiteur n'a rien fait de mal. Elle pourra réapparaître à la visite suivante, ce qui est le comportement sûr |
| **Succès** | Fermeture immédiate, sans toast ni confirmation. Le choix effectué se vérifie via le lien « Cookies » du pied de page |
| **Permission refusée** | Sans objet (aucune authentification) |

### 6.4 Accessibilité (WCAG AA)

- **Rôle** : `<section role="region" aria-label="…">` — région **non modale**. Ni `role="dialog"`,
  ni `aria-modal`, ni piège de focus, ni voile : le contenu de la page reste accessible au lecteur
  d'écran et à la souris.
- **Pas d'`aria-live`** : la popin est présente dès le rendu initial, elle n'est pas une
  notification.
- **Ordre de tabulation** : titre non focalisable → `Tout accepter` → `Tout refuser` → lien. La
  popin étant tôt dans le DOM, ces trois arrêts précèdent l'en-tête.
- **Échap** : ne ferme pas (fermer sans choisir serait un choix implicite). Comportement
  volontaire, à documenter pour le testeur.
- **Après choix** : le focus est déplacé vers le premier élément focalisable de l'en-tête (lien
  d'évitement ou logo), jamais perdu sur `<body>`.
- **Masquage de contenu (WCAG 2.4.11 « Focus non masqué »)** : tant que la popin est visible, la
  page applique un `scroll-padding-bottom` égal à sa hauteur mesurée, pour qu'un élément focalisé
  ne se retrouve pas sous elle.
- **Contrastes** (vérifiés sur `color-surface-raised` `#1a1a1d`) :

  | Couple | Ratio | Verdict |
  |---|---|---|
  | `color-text-primary` `#f5f5f7` | ≈ 15,8:1 | AAA |
  | `color-text-secondary` `#a1a1aa` | ≈ 7,5:1 | AAA |
  | `color-text-brand` `#29e075` (lien) | ≈ 9,7:1 | AAA |
  | `color-action-secondary-border` `#74747c` (bordure de bouton) | ≈ 3,4:1 | AA composants (≥ 3:1) |
  | `color-focus-ring` `#f5f5f7` sur la popin | ≈ 15,8:1 | AA |

- **Cible tactile** : `size-touch-target` (44 px) minimum en hauteur pour les deux boutons ; le
  lien dispose d'une zone cliquable d'au moins 44 px de haut sur mobile (padding vertical).
- **Le vert n'est jamais seul porteur d'information** : le lien est souligné, et aucun des deux
  boutons n'utilise la couleur pour signifier son sens.
- **Zoom 200 % et texte agrandi 200 %** : la popin reste entièrement lisible, les boutons passent
  en pile verticale si nécessaire (§9).

## 7. Persistance du choix

Décrit en comportement observable ; le mécanisme est à la main de `dev-react-node`
(en cohérence avec `01-architecture.md` §6.4, qui interdit tout stockage pendant la phase maquette
— cette spec s'applique à la version réelle du Lot 1).

| Règle | Comportement attendu |
|---|---|
| Après un clic sur l'un des deux boutons | La popin disparaît et **ne réapparaît plus**, ni lors d'une navigation interne, ni au rechargement, ni sur une autre page publique, ni au retour du visiteur les jours suivants |
| Durée de validité | **6 mois** à compter du choix. Au-delà, la popin est de nouveau proposée (recommandation CNIL). Acceptation et refus ont **exactement la même durée** — un refus mémorisé moins longtemps qu'une acceptation est un dark pattern |
| Ce qui est mémorisé | La **décision** (acceptée / refusée), la **date** du choix et la **version** du texte de consentement. Un changement de version (nouvelle finalité, nouveau traceur) redéclenche la popin, même avant 6 mois |
| Changement de langue ou de page | Sans effet sur le choix : il est valable pour tout le site, dans les deux langues |
| Portée technique | Le choix est lié au navigateur, pas au compte. Un nouvel appareil redemande |
| Révocation | Le lien **« Cookies »** du pied de page (déjà présent, `02` §3.19) **rouvre la popin** au même endroit, pré-informée du choix courant. C'est le seul point de révocation — sa présence est obligatoire dans le pied de page de chaque page publique |
| Si la mémorisation échoue | §6.3, ligne « Erreur » : choix valable pour la session, aucune alerte |
| Avant le choix | **Aucun traceur non essentiel n'est déposé.** L'absence de choix ne vaut pas acceptation ; continuer à naviguer ou faire défiler la page ne vaut pas acceptation |

## 8. Contenu textuel FR / EN

Clés `landing.cookieBanner.*` dans `apps/web/src/locales/{fr,en}/landing.json` (next-intl, D28).
Parité des clés FR/EN vérifiée à la compilation. Aucune concaténation : le lien est un élément
séparé, pas une portion de phrase interpolée.

| Clé | FR | EN | Max |
|---|---|---|---|
| `regionLabel` | `Consentement aux cookies` | `Cookie consent` | 30 |
| `title` | `Cookies` | `Cookies` | 20 |
| `body` | `Nous utilisons des cookies pour mesurer l'audience du site. Vous pouvez changer d'avis à tout moment.` | `We use cookies to measure site traffic. You can change your mind at any time.` | 160 |
| `accept` | `Tout accepter` | `Accept all` | 18 |
| `reject` | `Tout refuser` | `Reject all` | 18 |
| `privacyLink` | `Politique de confidentialité` | `Privacy policy` | 32 |

**Règles de ton.** Phrase active, sujet « nous », pas de « votre expérience », pas de
« partenaires de confiance », pas de « nous et nos 214 partenaires ». Le texte doit rester vrai :
si l'inventaire des traceurs du Lot 1 ajoute une finalité (ex. mesure de conversion publicitaire),
**`body` est réécrit et la version de consentement est incrémentée** (§7).

**Cas « aucun traceur non essentiel ».** Si l'inventaire L9 de `07-revue-conformite.md` conclut
que le site ne dépose que des traceurs exemptés, **la popin ne doit pas s'afficher du tout**.
Afficher une demande de consentement inutile est une friction gratuite. Le composant doit donc
pouvoir être désactivé globalement sans supprimer le lien « Cookies » du pied de page.

### 8.1 Point ouvert — validation `expert-conformite-rgpd`

Le modèle retenu est **« tout ou rien »**, sans choix par catégorie (arbitrage du fondateur
pour ce lot). Il est acceptable **uniquement si les finalités non essentielles sont homogènes**
(une seule finalité, typiquement la mesure d'audience). Dès qu'une seconde finalité de nature
différente apparaît (publicité, réseaux sociaux, personnalisation), un niveau de choix par
catégorie devient nécessaire. Ce point est à confirmer par `expert-conformite-rgpd` avant la mise
en ligne du Lot 1 ; il ne modifie pas le présent design tant que le verdict n'a pas changé.

## 9. Responsive, mobile-first

| Largeur | Rendu |
|---|---|
| < 480 px | Feuille basse pleine largeur. Boutons **côte à côte, 50 / 50**, gap `spacing-3`. Si le libellé traduit ne tient pas sur une ligne à taille de texte 200 %, les boutons passent **en pile verticale, pleine largeur**, « Tout accepter » au-dessus |
| 480 – 767 px | Identique, padding `spacing-inset-card` |
| ≥ 768 px | Carte flottante bas gauche, largeur `min(--size-cookie-banner, 100vw - 2 × spacing-page-gutter)`, boutons côte à côte dimensionnés au contenu |
| ≥ 1024 px | Identique ; `spacing-inset-card` passe à `spacing-6` via les tokens responsive existants |
| Zones sûres iOS | Le padding bas intègre `env(safe-area-inset-bottom)` pour ne pas passer sous la barre de geste |
| Paysage mobile (hauteur < 480 px) | La popin n'occupe jamais plus de 40 % de la hauteur d'écran ; le texte respecte les Max, donc aucun défilement interne n'est nécessaire |

## 10. Ce qui reste à valider

| # | Point | Qui |
|---|---|---|
| 1 | Modèle « tout ou rien » sans catégories, et formulation exacte de `body` au regard de l'inventaire réel des traceurs (§8.1) | `expert-conformite-rgpd` (veto) |
| 2 | Durée de validité de 6 mois, identique pour acceptation et refus | `expert-conformite-rgpd` |
| 3 | Suppression du bouton « Personnaliser » prévu par `02` §3.20 (mise à jour de `02` à faire après validation) | `chef-de-projet` |
| 4 | Ajout du token `--size-cookie-banner` dans `tokens.css` (§5.1) | `dev-react-node` + `expert-ux` |
| 5 | URL des pages « Politique de confidentialité » et comportement du lien « Cookies » du pied de page (rouverture de la popin) | `product-owner` |
| 6 | Position desktop bas **gauche** (et non bas droite, où se logent souvent les widgets de support) | Fondateur, au moment de la revue visuelle |
