# Landing page INFLUX : wireframes et spécification UX

> **Statut :** étape 2 du plan validé par le fondateur le 2026-09-16. Rédigé par `expert-ux` le
> 2026-09-17 (skill `design-system-influx`). Palette et police provisoires : **D6 ouverte**.
> **Sources :** `CLAUDE.md` §2 à §5 (prime en cas d'écart), `00-cadrage.md` (ordre attendu, CA1 à
> CA28), `01-architecture.md` (§4 à §7, §11), `03-tokens-provisoires.md`, `05-images.md`.
> **Destinataires :** `expert-marketing` (étape 3 : écrit les textes dans les emplacements définis
> ici), `expert-paiement-facturation` et `expert-conformite-rgpd` (étape 4), `dev-react-node`
> (étape 5), `testeur` (étape 6).
> **Revues reportées le 2026-09-17 :** `06-revue-paiement.md` #3, #4, #11, #13, #18 (§3.14) ;
> `07-revue-conformite.md` lignes 1 (§3.12), 14 (§2.3, §2.7, §3.7, §3.9), 18 (§3.18).
> **Aucune copie finale ici.** Les mots inscrits dans les schémas indiquent l'intention du texte,
> pas sa formulation.

## 0. Conventions de lecture

| Notation | Sens |
|---|---|
| `landing.x.y` | Clé de `src/locales/{fr,en}/landing.json` ; premier niveau = bloc (01 §5) |
| `ph.x.y` | Champ de `getPlaceholderContent(locale)` dans `src/content/placeholders/index.ts` : contenu **fictif** ou propre à la maquette (01 §6.1). Disparaît avec le module au Lot 1 |
| **{F}** | Élément fictif, donc servi par `ph.*` |
| **Max** | Longueur maximale en caractères, espaces compris, **en FR comme en EN**. Au-delà, on réécrit ; on ne tronque jamais (CA24) |
| ICU | Gabarit de `landing.json` qui reçoit une valeur (souvent fictive) formatée par next-intl selon la langue : `{count, number}`. Jamais de concaténation |
| `[■ Libellé]` / `[□ Libellé]` | Bouton principal / secondaire |
| `[◁]` `[▷]` `[❚❚]` `[≡]` `[v]` | Boutons icônes : précédent, suivant, pause, menu, chevron d'accordéon |
| `[i:nom]` | Icône `lucide-react` via `ui/icons.ts`, décorative (`aria-hidden`) sauf mention |
| `▣ IMG-…` | Image de `05-images.md` |
| `(✓ Vérifié)` | Badge de la carte créateur |
| Colonnes | Desktop : grille de 12 colonnes dans `container-max` ; mobile : 1 colonne, marges `space-page-gutter` |

## 1. Population, tâche et enseignements du benchmark

**Populations.** Annonceur pressé (souvent sur desktop, bouton principal) ; créateur sur mobile
(bouton secondaire) ; fondateur qui relit la maquette en FR et en EN. **Tâche** : comprendre en
10 secondes qui fait quoi, pour qui, et où cliquer ; pour le créateur, voir ce qu'il touche avant
tout engagement.

**wekollab.fr**, consulté le 2026-09-17 uniquement pour la fonction et le type de chaque bloc
(aucun texte, visuel ni code repris) :

| Ce qui fonctionne chez la référence | Ce qu'INFLUX fait autrement ou mieux |
|---|---|
| Hero à deux boutons, preuve chiffrée juste dessous | Chaque bouton est précédé d'une ligne qui nomme son public : les deux portes se lisent sans hésitation |
| Carrousels de logos et d'études de cas | Pause visible, arrêt si l'utilisateur réduit les animations ; études de cas sans défilement automatique ; chaque chiffre porte une mention de source |
| Maquette de conversation marque / créateur | Cadre « messagerie INFLUX » explicite, rôles au lieu de noms, aucune coordonnée : la valeur reste dans le produit |
| Réseau de créateurs avec photos, noms, abonnés et filtres par réseau | Ni nom ni pseudo (D16) ; pas de filtre (interaction non autorisée, et pas de recherche libre au MVP, CA5) ; badge « vérifié » expliqué |
| Section budget | Section **tarifs** complète : 35 % = 20 % + 15 %, incluse, exemple vérifiable, net créateur mis en avant |
| Formulaire en 3 étapes avec téléphone et site web | Les seuls champs de l'inscription du Lot 1 ; consentement marketing distinct des CGU ; majorité côté créateur |
| Liens « en savoir plus » sur les cartes | Supprimés : aucune carte ne promet une page qui n'existe pas |

## 2. Règles communes (valables pour tous les blocs)

### 2.1 Page, repères, titres

- **Ordre du DOM** : `MockupBanner` → `CookieBanner` → `SiteHeader` → `<main>` (sections 1 à 16)
  → `SiteFooter`. La bannière cookies est **tôt dans le DOM** mais **fixée en bas à l'écran** :
  l'ordre visuel reste celui de CA1. Raison : un utilisateur clavier la ferme au premier Tab au
  lieu de traverser toute la page, et elle ne masque pas durablement les éléments focalisés
  (WCAG 2.4.11).
- Un seul `h1` (hero). Chaque section : `<section aria-labelledby="<bloc>-title">` + `h2`
  (masqué visuellement quand indiqué). Titres de cartes, d'étapes et questions : `h3`. Bandeau
  Maquette et bannière cookies : **aucun titre** (ils précèdent le `h1` dans le DOM).
- **En-tête de section standard** : surtitre (rôle Overline, Max 40), `h2` (Heading 2, Max 70),
  chapeau (Lead, Max 180), clés `landing.<bloc>.overline|title|lead`. Centré sur mobile, aligné
  à gauche dès `breakpoint-md` (03 §6). Écart avec le contenu : `space-section-header`.
- **Fonds alternés** : page (1, 3, 5, 7, 9, 11, 13, 16) ; `color-surface-muted` (4, 6, 8, 10, 12,
  14) ; `color-surface-accent` (2) ; `color-surface-inverse` (15, pied de page). Marges verticales
  `space-section-block`, largeur `container-max`, paragraphes limités à `measure-text`.
- `scroll-padding-top` = `header-height`. Métadonnées : `landing.meta.title` (Max 60),
  `landing.meta.description` (Max 155).

### 2.2 Boutons et « deux portes »

| Variante | Tokens | Usage |
|---|---|---|
| Principale | `color-action-primary-bg` (+ `-hover`, `-active`), `color-text-on-action`, `radius-pill`, `space-inset-button`, `size-button-lg` (`size-button-md` dans l'en-tête) | CTA annonceur, « Continuer », « Créer mon compte » |
| Secondaire | `color-action-secondary-bg` (+ `-hover`, `-active`), `border-width-thick` + `color-action-secondary-border`, `color-text-primary` | CTA créateur, « Retour », boutons de la bannière cookies |
| Secondaire inversée | `color-action-secondary-inverse-border` (**nouveau**, §2.9), `color-text-inverse` ; survol `color-action-inverse-bg` + `color-text-primary` | Fond sombre (section 15) |
| Texte | fond transparent, survol `color-action-secondary-bg-hover` (ou `color-surface-inverse-raised` sur fond sombre), hauteur min. `size-touch-target` | Entrées de menu et du pied de page |
| Icône | carré `size-touch-target`, icône `size-icon-md`, `radius-pill`, `border-width-thin` + `color-border-strong` | Carrousels, menu mobile |

- **Sémantique** : `ui/Button.tsx`, toujours `<button type="button">`, aucun `href`, aucun
  `disabled`. Focus `:focus-visible` : `focus-ring-width`, `focus-ring-offset`,
  `color-focus-ring` (`color-focus-ring-inverse` sur fond sombre). Le libellé visible est le nom
  accessible (WCAG 2.5.3) ; seuls les boutons icônes ont un `aria-label` traduit.
- **Sans effet** en dehors des interactions de CA7, détaillées bloc par bloc.
- **Paire « deux portes »** (hero, sections 11 et 15, menu mobile) : annonceur (principal) **puis**
  créateur (secondaire), dans le DOM comme à l'écran. Clés `landing.common.cta.advertiser` et
  `landing.common.cta.creator` (Max 20 chacune, pour tenir dans l'en-tête). Chaque libellé doit
  être compréhensible **seul** (l'en-tête n'a pas de ligne de public) : il nomme une action propre
  à son public. Jamais de bouton unique « S'inscrire » qui fondrait les deux publics.
- Quand une ligne de public précède le bouton (`landing.common.doors.advertiserAudience`,
  `.creatorAudience`, Max 30), le bouton y renvoie par `aria-describedby`.
- Mobile : boutons empilés pleine largeur, `space-stack-sm` ; desktop : côte à côte, `space-3`.

### 2.3 Carte créateur (`ui/CreatorCard.tsx` : sections 3, 9, 15)

```
Mobile (< sm) : horizontale            ≥ sm : verticale
┌─────────┬─────────────────────┐      ┌──────────────────────┐
│▣ IMG-CRE│ Thématique {F}  (h3)│      │ ▣ IMG-CRE-xx  (4:5)  │
│  (4:5)  │ (✓ Vérifié)         │      ├──────────────────────┤
│  w-1/3  │ 10 k – 50 k abonnés │      │ Thématique {F}  (h3) │
│         │ [i:map-pin] Pays {F}│      │ (✓ Vérifié)          │
└─────────┴─────────────────────┘      │ 10 k – 50 k abonnés  │
                                       │ [i:map-pin] Pays {F} │
                                       └──────────────────────┘
```

| Élément | Source | Rôle | Max |
|---|---|---|---|
| Thématique | `ph.<bloc>.cards.<n>.theme` {F} | `h3` (Heading 3) | 24 |
| Tranche d'audience | `ph.…audienceMin`, `.audienceMax` {F} + ICU `landing.common.creatorCard.audienceRange` (`{min, number, ::compact-short} – {max, number, ::compact-short} …`) | Body, `color-text-secondary` | 32 rendu |
| Pays | `ph.…country` {F} ; préfixe masqué `landing.common.creatorCard.countryLabel` | Small, `color-text-tertiary` | 24 / 12 |
| Badge | `ph.…verified` {F} (booléen) ; `landing.common.creatorCard.verifiedBadge` + `[i:badge-check]` | `color-brand-subtle-bg`, `color-text-brand-strong`, `radius-sm`, `font-size-sm`, `font-weight-semibold` | 12 |
| Légende sous la grille | `landing.common.creatorCard.verifiedLegend` + `[i:info]` | Explique « vérifié » et le masquage des pseudos jusqu'à la signature | 140 |
| Mention de fictif, ligne suivante | `ph.creatorCards.sourceNote` {F} | Profils fictifs (§2.7) ; commune aux sections 3, 9 et 15 | 60 |

- **Jamais** (D16, CA17) : pseudo, nom, `@`, lien, icône de réseau, bouton « contacter ». Le type
  `CreatorCard` n'a pas ces champs (01 §6.1). Une thématique ou un pays n'est jamais présenté
  comme un pays ouvert aux contrats.
- Image décorative (`alt=""`, 05 §3). Carte **ni cliquable ni focalisable**. Pas de survol.
- Sémantique : `<ul>` de `<li>` ; ordre du DOM = ordre visuel (titre, badge, audience, pays).
- Tokens : `color-surface-card`, `border-width-thin` + `color-border-default`, `radius-lg`,
  `shadow-sm`, `space-inset-card`, `space-stack-sm`, grille `space-grid-gap`, `size-icon-sm`.
- Grilles : 1 colonne (< `sm`), 2 (`sm`), 3 ou 4 selon la section (`lg`).

### 2.4 Accordéon (`ui/Accordion.tsx` : sections 8 et 14)

- `<h3><button type="button" aria-expanded aria-controls="…-panel"></button></h3>` puis
  `<div id="…-panel" hidden>` (pas de `role="region"`). Panneaux indépendants : plusieurs peuvent
  être ouverts. Entrée et Espace natifs, ordre de tabulation naturel.
- État doublé : chevron `[v]` qui pivote (forme) + `aria-expanded` ; jamais une couleur seule.
- Tokens : séparateurs `color-border-subtle` ; bouton pleine largeur, hauteur min.
  `size-touch-target`, survol `color-action-secondary-bg-hover` ; `duration-base` +
  `easing-standard` (instantané si mouvement réduit) ; icône `size-icon-md`.

### 2.5 Carrousels (`ui/Carousel.tsx` : sections 5 et 6)

| | Section 5 : logos | Section 6 : études de cas |
|---|---|---|
| Mouvement | Défilement continu, `duration-marquee-loop` | **Manuel uniquement** (chiffres et textes à lire) |
| Contrôles | `[❚❚]` : `aria-pressed`, `aria-label` `landing.common.carousel.pause` (Max 40) ; pause aussi au survol et au focus dans le bloc | `[◁]` `[▷]` (`landing.common.carousel.previous`, `.next`, Max 30) + compteur visible ; balayage tactile natif avec points d'accroche |
| Mouvement réduit | Défilement arrêté, grille statique, `[❚❚]` masqué | Défilement non animé (`duration-instant`) |
| Sémantique | `<ul>` de noms en texte ; la copie dupliquée pour la boucle porte `aria-hidden="true"` | Conteneur `role="region"`, `aria-roledescription` (`landing.common.carousel.roleDescription`), `aria-labelledby` du `h2` ; diapositive `role="group"`, `aria-roledescription` (`.slideRoleDescription`), `aria-label` ICU `.slideLabel` (« {current, number} sur {total, number} ») ; Max 20 chacun |
| Annonce | Aucune | Compteur dans une zone `aria-live="polite"`, mise à jour seulement après `[◁]` / `[▷]` |
| Bornes | — | Pas de boucle. Sur la 1re et la 5e diapositive, le bouton sans suite reste focalisable avec `aria-disabled="true"`, icône `color-text-disabled`, bordure `color-border-subtle` |

Tokens communs : bouton Icône (§2.2), `duration-slow` + `easing-standard` (diapositives),
compteur Small + `font-variant-numeric-amount`.

### 2.6 Images

`ui/ResponsiveImage.tsx` uniquement ; ratio et point focal de `05-images.md` ; `radius-lg` ;
fond `color-surface-muted` pendant le chargement. Texte alternatif : `""` si décorative, sinon
`ph.images.<id>.alt` {F}, dans le module fictif (01 §6.1, 05 §3). Les images « desktop uniquement » sont masquées sous
`breakpoint-lg`. Seule IMG-HERO-01 est chargée en priorité.

### 2.7 Chiffres fictifs et montants

- **Chiffre fictif** = valeur `ph.*` {F} + gabarit ICU `landing.*` + **mention de source**
  `ph.<bloc>.sourceNote` {F} (Max 60, Small, `color-text-tertiary`), ex. intention « donnée
  fictive, maquette ». Au Lot 1, le même emplacement porte la source réelle : aucun chiffre sans
  source. Rôle Figure, `font-variant-numeric-amount`, **aucune animation de compteur**.
- **Autres blocs fictifs sans chiffre** (revue conformité, ligne 14) : une mention locale, même
  style (Small, `color-text-tertiary`, Max 60), **sous le bloc**, pour qu'une capture isolée reste
  identifiable : `ph.brandLogos.sourceNote` sous la bande de logos (section 5) ;
  `ph.creatorCards.sourceNote`, **une seule clé** affichée sur la ligne qui suit la légende
  « vérifié » dans les sections 3, 9 et 15 ; `ph.problem.conversation.sourceNote` sous la légende
  de la figure (section 7). Chaque mention est un `<p>` lu dans l'ordre normal, jamais masqué.
- **Aucun montant d'argent dans le contenu fictif** (études de cas, résultat, chiffre clé) :
  uniquement des indicateurs de performance. Les montants n'apparaissent qu'en section 12 et
  dans la FAQ, en texte statique.
- **Tout montant** précise s'il s'agit du *montant du contrat*, de la *commission INFLUX* (ou de
  la *part annonceur* / *part créateur*) ou du *net créateur*, avec la devise (CA21). Formats :
  `2 000,00 €` (U+202F entre milliers, U+00A0 avant `€`) / `€2,000.00` ; `35 %` (U+202F) / `35%`.

### 2.8 États communs

| État | Règle |
|---|---|
| Nominal | Tous les contenus, en FR ou en EN |
| Chargement | Page pré-rendue : texte immédiat. Images : fond `color-surface-muted` au ratio final, `width`/`height` renseignés (aucun décalage). Pas de squelette ni d'indicateur |
| Vide | Un bloc dont le contenu fictif manque **n'est pas rendu** (ni titre ni coque) : sections 2, 4, 5, 6 ; sections 3, 9 et 15 sans cartes rendues sans leur grille ni leur légende. Décision prise dans `page.tsx` |
| Erreur | Image indisponible : le fond reste, aucun pictogramme d'image cassée. JavaScript indisponible : textes lisibles, boutons sans effet, panneaux d'accordéon fermés (limite acceptée pour la maquette) |
| Succès | Seulement le message final du formulaire (§3.18), en style « information » : rien n'a réussi, rien n'est parti |
| Accès refusé | Sans objet : page publique, aucun compte |
| Changement de langue | Tous les textes, textes alternatifs, libellés d'accessibilité et `lang` changent ; défilement conservé ; le formulaire repart de zéro (limite acceptée) |
| Mouvement réduit | Durées `duration-instant` ; logos en grille statique |
| 320 px, zoom 200 % | Aucun défilement horizontal ; libellés de boutons sur deux lignes plutôt que tronqués ; montants insécables |

### 2.9 Tokens : correspondance Tailwind confirmée et nouveaux tokens

**Correspondance (réponse à 01 §4 et §14).** Les noms de rôle de `03-tokens-provisoires.md` sont
conservés **à l'identique** ; seul le préfixe suit Tailwind : `color-*` → `--color-*`
(`text-text-primary` accepté : un seul vocabulaire entre documents, code et revues) ;
`font-size-*` → `--text-*` ; `font-weight-*` → `--font-weight-*` ; `line-height-*` →
`--leading-*` ; `letter-spacing-*` → `--tracking-*` ; `space-*` → `--spacing-*` (dont
`--spacing-section-block`) ; `radius-*`, `shadow-*`, `breakpoint-*`, `container-*` inchangés ;
`easing-*` → `--ease-*` ; `z-*`, `duration-*`, `size-*`, `focus-ring-*`, `header-height`,
`measure-*` → bloc `:root`. `localeDetection: false` et FR par défaut : confirmés.

**Nouveaux tokens proposés** : des alias, **aucune nouvelle valeur de couleur** (sans effet sur
D6, contrastes déjà calculés en 03 §3).

| Token | Valeur | Rôle | Interdit |
|---|---|---|---|
| `color-action-secondary-inverse-border` | = `color-text-inverse` | Bordure du bouton secondaire sur fond sombre | Fond clair |
| `color-data-advertiser-share` | = `color-surface-inverse` | Segment et pastille « part annonceur » (section 12, puis écrans de contrat au Lot 4) | Seul porteur de l'information |
| `color-data-creator-share` | = `color-brand-primary` | Segment et pastille « part créateur » | Idem |
| `color-data-net-creator` | = `color-brand-subtle-bg` | Segment et pastille « net créateur » | Idem |

## 3. Blocs, dans l'ordre attendu

### 3.1 Bandeau « Maquette » : `MockupBanner.tsx`

**Fonction.** Dire dès l'arrivée que chiffres, marques et cas sont inventés et que les boutons ne
mènent nulle part (CA14). Rendu seulement si `IS_MOCKUP` vaut `true`. Non collant.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ [i:triangle-alert] Maquette : │   │ [i:triangle-alert] Maquette : contenus fictifs · Détail  │
│ contenus fictifs              │   │ sur une ligne                  (centré, 1 ou 2 lignes)   │
│ Détail sur 2 lignes           │   └══════════════════════════════════════════════════════════┘
└═══════════════════════════════┘     filet bas color-mockup-banner-border
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `ph.mockupBanner.regionLabel` | `aria-label` de l'`<aside>` | 20 | Maquette |
| `ph.mockupBanner.label` | Affirmation, `font-weight-bold` | 40 | Maquette |
| `ph.mockupBanner.detail` | Ce qui est fictif et inactif | 110 | Maquette |

- **Tokens** : `color-mockup-banner-bg`, `color-text-primary` (jamais `color-text-tertiary`),
  filet `border-width-thick` + `color-mockup-banner-border`, `font-size-sm`, `space-2` vertical,
  `space-page-gutter`, `size-icon-sm`. **Images** : aucune. **Interactions** : aucune.
- **Accessibilité** : `<aside aria-label>` + `<p>` ; pas de zone live (lu dans l'ordre normal,
  premier contenu de la page). **États** : rendu ou absent.

### 3.2 En-tête : `SiteHeader.tsx`, `SiteHeaderMobileMenu.tsx`, `ui/LanguageSwitcher.tsx`

**Fonction.** Identifier INFLUX, donner accès au menu, aux deux portes et au choix de langue.
Collant (`z-header`), hauteur `header-height`.

```
Mobile 375, fermé                    Mobile 375, ouvert
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ INFLUX         [FR|EN]   [≡]  │   │ INFLUX         [FR|EN]   [✕]  │
└───────────────────────────────┘   ├───────────────────────────────┤ panneau
                                    │ Méthode                       │ color-surface-raised
                                    │ Créateurs                     │ shadow-lg, z-overlay
                                    │ Cas d'usage                   │
                                    │ Tarifs                        │
                                    │ FAQ                           │
                                    │ ───────────────────────────── │
                                    │ [■ CTA annonceur            ] │
                                    │ [□ CTA créateur             ] │
                                    │ [i:mail] e-mail de contact {F}│
                                    └───────────────────────────────┘
                                    ░░░ voile color-overlay-scrim ░░░

Desktop 1440 (pleine largeur moins space-page-gutter)
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ INFLUX   Méthode  Créateurs  Cas d'usage  Tarifs  FAQ   [i:mail] e-mail {F}  [FR|EN] │
│                                                      [■ CTA annonceur] [□ CTA créateur]│
└──────────────────────────────────────────────────────────────────────────────────────┘
  (sur une seule ligne à 1440 px ; schéma replié ici pour la lisibilité)
```

| Largeur | Contenu affiché |
|---|---|
| < `breakpoint-lg` | Logo, sélecteur, `[≡]` ; le reste dans le panneau |
| `lg` à `xl` | + 5 entrées de menu + CTA annonceur (place insuffisante pour le second : les deux portes restent visibles dans le hero juste dessous) |
| ≥ `breakpoint-xl` | + CTA créateur |
| ≥ `breakpoint-2xl` | + e-mail de contact |

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.common.brandName` | Logo texte « INFLUX », en `<p>`, non focalisable | 6 | Non |
| `landing.header.navLabel` | `aria-label` du `<nav>` | 30 | Non |
| `landing.header.nav.method` · `.creators` · `.useCases` · `.pricing` · `.faq` | Entrées de menu (boutons Texte) | 14 chacune | Non |
| `landing.header.menuButton` | `aria-label` de `[≡]` (nom constant, l'état passe par `aria-expanded`) | 12 | Non |
| `landing.header.contactLabel` | Préfixe masqué visuellement devant l'e-mail | 30 | Non |
| `ph.contact.email` | E-mail sur un domaine `.example`, en texte sélectionnable | 32 | **Oui** |
| `landing.header.languageSwitcher.label` | `aria-label` du groupe | 20 | Non |
| `landing.header.languageSwitcher.fr` · `.frName` · `.en` · `.enName` | « FR » visible + « Français » masqué visuellement (`lang="fr"`) ; idem EN. Identiques dans les deux fichiers | 3 / 12 | Non |
| `landing.common.cta.advertiser` · `.creator` | §2.2 | 20 | Non |

- **Tokens** : `color-surface-page`, filet bas `border-width-thin` + `color-border-subtle`,
  `header-height`, `z-header` ; logo `font-size-heading-3`, `font-weight-extrabold`,
  `letter-spacing-display` ; entrées : bouton Texte, `font-weight-medium`. Sélecteur : contour
  `border-width-thin` + `color-border-strong`, `radius-pill`, deux boutons `size-touch-target` ;
  langue active `color-surface-inverse` + `color-text-inverse` + `font-weight-bold` (la graisse
  et `aria-pressed` doublent le fond). Panneau : `color-surface-raised`, `shadow-lg`,
  `z-overlay`, `color-overlay-scrim`, `duration-base`, `easing-standard` / `easing-exit`.
- **Images** : aucune.
- **Interactions** : (1) sélecteur : l'autre langue remplace la page par sa version (`router.replace`
  de 01 §5), défilement conservé, focus rendu au bouton de la langue désormais active ; la langue
  active est sans effet. (2) Menu mobile : `[≡]` ouvre et ferme ; Échap, `[✕]` ou clic sur le voile
  ferment ; passage à ≥ `lg` ferme. **Entrées de menu, CTA et e-mail : sans effet.**
- **Sémantique et clavier** : `<header>` ; `<nav aria-label>` + `<ul>` de `<button type="button">`,
  rendu une seule fois selon la largeur (jamais deux `nav` exposés). Sélecteur :
  `<div role="group" aria-label>` + deux boutons `aria-pressed`. `[≡]` : `aria-expanded`,
  `aria-controls`. À l'ouverture : focus sur la première entrée, `<main>` et `<footer>` reçoivent
  `inert`, défilement de la page bloqué ; à la fermeture : focus rendu à `[≡]`. L'e-mail n'est ni
  bouton ni `mailto:`.
- **États** : menu fermé / ouvert ; langue FR / EN. Pas d'état vide ni de chargement.

### 3.3 Section 1 : Hero : `HeroSection.tsx`

**Fonction.** Réussir le test des 10 secondes (CA3) : ce que fait INFLUX, pour quels deux publics,
où cliquer. Le `h1`, le chapeau et les deux portes sont visibles **sans défiler** à 375 × 667 px
(bandeau Maquette compris) et à 1440 × 900 px.

```
Mobile 375
┌───────────────────────────────┐
│ SURTITRE                      │
│ H1 sur 2 à 3 lignes : qui     │
│ fait quoi, pour qui           │
│ Chapeau : comment, en une     │
│ phrase                        │
│ Public annonceur              │
│ [■ CTA annonceur            ] │
│ Public créateur               │
│ [□ CTA créateur             ] │
│ [i:check] Réassurance         │
│ ┌───────────────────────────┐ │
│ │ ▣ IMG-HERO-01 (4:3)       │ │
│ │  ┌─────────────────────┐  │ │
│ │  │ [i:inbox] puce      │  │ │
│ └──┴─────────────────────┴──┘ │
└───────────────────────────────┘

Desktop 1440
┌────────────────────────────────────────┬─────────────────────────────────┐
│ SURTITRE                   (col. 1-6)  │ (col. 7-12)                     │
│ H1 sur 2 lignes (measure-heading)      │ ┌───────┐  ┌──────────────────┐ │
│ Chapeau                                │ │▣ HERO │  │                  │ │
│                                        │ │  -02  │  │  ▣ IMG-HERO-01   │ │
│ Public annonceur    Public créateur    │ │ (1:1) │  │      (4:5)       │ │
│ [■ CTA annonceur]   [□ CTA créateur]   │ └───────┘  │ ┌──────────────┐ │ │
│                                        │            │ │[i:inbox] puce│ │ │
│ [i:check] Réassurance                  │            │ └──────────────┘ │ │
│                                        │            └──────────────────┘ │
└────────────────────────────────────────┴─────────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.hero.overline` | Catégorie du service | 40 | Non |
| `landing.hero.title` | `h1` : INFLUX met en relation marques et créateurs ; aucune promesse d'algorithme ni d'IA (CA5) | 70 | Non |
| `landing.hero.lead` | Comment : sélection par l'équipe, messagerie, contrat et paiement dans INFLUX | 170 | Non |
| `landing.common.doors.advertiserAudience` · `.creatorAudience` | Ligne qui nomme chaque public au-dessus de son bouton | 30 | Non |
| `landing.common.cta.advertiser` · `.creator` | Deux portes (§2.2) | 20 | Non |
| `landing.hero.reassurance` | Inscription gratuite ; commission uniquement sur contrat signé (le détail est en section 12) | 90 | Non |
| `landing.hero.visualChip` | Puce illustrative « nouvelle proposition reçue », `aria-hidden="true"` | 36 | Non |
| `ph.images.hero01.alt` | Texte alternatif de IMG-HERO-01 | 125 | Oui |

- **Tokens** : rôles Overline, Display (`measure-heading`), Lead ; réassurance Small
  `color-text-secondary` + `[i:check]` `color-text-brand` ; puce `color-surface-raised`,
  `shadow-md`, `radius-pill`, `font-size-sm`, `space-inset-button`.
- **Images** : IMG-HERO-01 (informative, prioritaire) et IMG-HERO-02 (décorative, ≥ `lg`) sont
  chacune montées sur son propre cadre « carte métallisée » premium (fondateur, 2026-09-17,
  cohérent avec §3.4/§3.9/§3.12 : `background-image-metal-card`, `border-border-default`,
  `shadow-metal-card`, `radius-xl`, mat de `space-3`), légèrement inclinée en 3D via
  `perspective-hero-card` sur le conteneur et `rotate-x-hero-*`/`rotate-y-hero-*` sur le cadre
  (inclinaisons opposées entre principale et secondaire pour un effet « en éventail »).
  IMG-HERO-02 garde en plus `z-raised`. Inclinaison statique, sans animation ; le mat de la carte
  (0,75 rem par photo) ne modifie ni les ratios d'image ni la position du bloc texte, donc le test
  des 10 secondes (CA3) reste respecté à 375×667 et 1440×900.
- **Interactions** : aucune (CTA sans effet).
- **Accessibilité** : seul `h1` de la page ; chaque bouton `aria-describedby` = sa ligne de
  public ; ordre DOM = ordre visuel (texte avant image).
- **États** : nominal ; image en chargement (§2.8).

### 3.4 Section 2 : Bandeau chiffre clé : `KeyFigureSection.tsx`

**Fonction.** Une preuve chiffrée immédiate, lisible d'un coup d'œil.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│          12 400 {F}           │   │   12 400 {F}          │ Libellé du chiffre sur une ou    │
│      (font-size-figure-xl)    │   │   (figure-xl, col.1-5)│ deux lignes          (col. 6-12) │
│  Libellé du chiffre (ICU)     │   │                       │ Mention de source {F}            │
│  Mention de source {F}        │   └──────────────────────────────────────────────────────────┘
└───────────────────────────────┘     carte fond background-image-metal-card
                                       posée sur fond color-surface-muted
```

**Mise à jour du 2026-09-17 (fondateur) :** le bandeau plein largeur en `color-surface-accent`
(vert) est supprimé. Le contenu est désormais posé dans une carte « métallisée » premium
(`background-image-metal-card` + `border-border-default` + `shadow-lg`, voir 03 §2.3), centrée
dans une section en `color-surface-muted`. Le chiffre reste un accent de marque
(`color-text-brand-strong`), le libellé passe en blanc (`color-text-primary`) et la fin de phrase
(« entre marques et créateurs dans INFLUX ») en gris clair (`color-text-secondary`, tag ICU
`<muted>`) — même convention de titre bicolore (première partie blanche, seconde grise) reprise
sur les titres `h1`/`h2` de toutes les sections de la page (fondateur, 2026-09-17).

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.keyFigure.srTitle` | `h2` masqué visuellement | 30 | Non |
| `ph.keyFigure.value` | Nombre (jamais un montant d'argent, jamais un pays) | — | **Oui** |
| `landing.keyFigure.statement` | ICU : `{value, number}` + libellé (tags `<highlight>` et `<muted>`), dans un seul `<p>` | 90 | Non |
| `ph.keyFigure.sourceNote` | Mention de source (§2.7) | 60 | **Oui** |

- **Tokens** : `background-image-metal-card`, `border-border-default`, `shadow-lg` (carte),
  `color-text-brand-strong` (chiffre), `color-text-primary` (libellé), `color-text-secondary`
  (fin de phrase et source, `font-size-sm`, 4,76:1 sur la carte), rôle Figure
  `font-size-figure-xl`, marges verticales `space-8` (mobile) → `space-10` (desktop).
  **Images** : aucune.
- **Interactions** : aucune. **Accessibilité** : chiffre et libellé dans le même `<p>` (lecture
  « 12 400 … » d'un seul tenant) ; focus éventuel `color-focus-ring` (9,86:1).
- **États** : vide → section non rendue.

### 3.5 Section 3 : Vitrine de créateurs : `CreatorShowcaseSection.tsx`

**Fonction.** Montrer le type de créateurs proposés, sans identité (D16), et expliquer « vérifié ».

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ En-tête de section standard   │   │ SURTITRE + H2 (col. 1-7)          Chapeau (col. 8-12)    │
│ [carte horizontale IMG-CRE-01]│   │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ [carte horizontale IMG-CRE-02]│   │ │▣ IMG-CRE-01    │ │▣ IMG-CRE-02    │ │▣ IMG-CRE-03    │ │
│ [carte horizontale IMG-CRE-03]│   │ │ Thématique {F} │ │ Thématique {F} │ │ Thématique {F} │ │
│ [i:info] Légende « vérifié »  │   │ │ (✓ Vérifié)    │ │ (✓ Vérifié)    │ │ (✓ Vérifié)    │ │
└───────────────────────────────┘   │ │ Audience, pays │ │ Audience, pays │ │ Audience, pays │ │
                                    │ └────────────────┘ └────────────────┘ └────────────────┘ │
                                    │ [i:info] Légende « vérifié » et pseudos masqués          │
                                    └──────────────────────────────────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.creatorShowcase.overline` · `.title` · `.lead` | En-tête standard ; parle de sélection par l'équipe, jamais de recherche libre (CA5) | 40 / 70 / 180 | Non |
| `ph.creatorShowcase.cards` (3) | Cartes §2.3 | §2.3 | **Oui** |
| `landing.common.creatorCard.*` | Libellés communs des cartes | §2.3 | Non |

- **Tokens** : `color-surface-page` ; cartes §2.3 ; grille 1 → 2 (`sm`) → 3 colonnes (`lg`) ;
  légende Small `color-text-tertiary`. **Images** : IMG-CRE-01 à 03 (décoratives).
- **Interactions** : aucune. **Accessibilité** : §2.3. **États** : sans cartes → section non rendue.

### 3.6 Section 4 : Résultat mis en avant : `FeaturedResultSection.tsx`

**Fonction.** Un résultat de campagne, avec sa tendance, pour rendre la promesse concrète.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────┬───────────────────────────┐
│ SURTITRE + H2                 │   │                  (col. 1-6)  │ SURTITRE + H2 (col. 7-12) │
│ ▣ IMG-RESULT-01 (3:2)         │   │  ▣ IMG-RESULT-01 (3:2)       │ 4,8 % {F}   (figure-lg)   │
│ 4,8 % {F}      (figure-lg)    │   │                              │ Nom de l'indicateur {F}   │
│ Nom de l'indicateur {F}       │   │                              │ [i:trending-up] +1,2 pt   │
│ [i:trending-up] +1,2 pt {F}   │   │                              │ en 3 mois {F}             │
│ Contexte en 1 ou 2 phrases {F}│   │                              │ Contexte {F}              │
│ Mention de source {F}         │   │                              │ Mention de source {F}     │
└───────────────────────────────┘   └──────────────────────────────┴───────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.featuredResult.overline` · `.title` | En-tête (sans chapeau) | 40 / 70 | Non |
| `ph.featuredResult.value` + ICU `landing.featuredResult.valueDisplay` | Indicateur de performance, **jamais un montant** | 10 rendu | **Oui** |
| `ph.featuredResult.metricLabel` | Nom de l'indicateur | 60 | **Oui** |
| `ph.featuredResult.trend` + ICU `landing.featuredResult.trendDisplay` | Évolution signée et période | 30 rendu | **Oui** |
| `landing.featuredResult.trendUp` | Mot « en hausse », masqué visuellement | 12 | Non |
| `ph.featuredResult.context` | Secteur, format, durée de la campagne fictive ; aucune marque réelle | 160 | **Oui** |
| `ph.featuredResult.sourceNote` | §2.7 | 60 | **Oui** |

- **Tokens** : `color-surface-muted` ; Figure `font-size-figure-lg` `color-text-primary` ;
  tendance `color-text-brand` (4,84:1) + `font-weight-semibold` + `size-icon-md`. La hausse est
  portée par la **flèche**, le **signe** et le **mot masqué**, pas par le vert.
- **Images** : IMG-RESULT-01 (décorative). **Interactions** : aucune.
- **Accessibilité** : valeur, indicateur et tendance dans un même `<p>`, dans cet ordre.
- **États** : vide → section non rendue.

### 3.7 Section 5 : Carrousel de logos : `BrandLogosSection.tsx`

**Fonction.** Preuve sociale par la variété des marques (toutes fictives, CA16).

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│   H2 court (style surtitre)   │   │               H2 court (style surtitre, centré)          │
│ Marque A · Marque B · Marq ←  │   │  Marque A   Marque B   Marque C   Marque D   Marque E ←  │
│                         [❚❚]  │   │                                                    [❚❚]  │
└───────────────────────────────┘   └──────────────────────────────────────────────────────────┘
Mouvement réduit : grille statique, 3 colonnes (mobile) ou 5 colonnes (desktop), sans [❚❚].
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.brandLogos.title` | `h2` visible, rôle Overline | 50 | Non |
| `ph.brandLogos.brands` (15) | Noms de marques inventés, en texte, sans ressemblance avec une marque connue | 16 chacun | **Oui** |
| `ph.brandLogos.sourceNote` | Mention « marques fictives », Small sous la bande, à gauche du bouton `[❚❚]` sur la même ligne (§2.7) ; reste visible en grille statique | 60 | **Oui** |
| `landing.common.carousel.pause` | `aria-label` de `[❚❚]` | 40 | Non |

- **Tokens** : `color-surface-page` ; noms en `font-size-heading-3`, `color-text-tertiary`
  (5,82:1) ; variété de « logotypes » par **trois variantes typographiques cycliques** définies
  dans le composant (graisses `bold` / `extrabold`, `letter-spacing-overline` /
  `letter-spacing-display`, capitales ou non) : aucune donnée fictive de style ;
  `duration-marquee-loop` ; bouton Icône.
- **Images** : aucune (logos en texte). **Interactions** : pause / lecture (§2.5).
- **Accessibilité** : §2.5 ; les noms ne sont ni boutons ni focalisables.
- **États** : vide → section non rendue ; en pause : `aria-pressed="true"`, icône lecture.

### 3.8 Section 6 : Études de cas : `CaseStudiesSection.tsx`

**Fonction.** Cinq exemples de campagnes par secteur, un à la fois, avec un indicateur clé.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ En-tête de section standard   │   │ SURTITRE + H2 + chapeau (col. 1-8)   [◁]  2 sur 5  [▷]   │
│ ┌──────────────────────────┬─┐│   │ ┌─────────────────────────────────────────────────┐ ┌──┐ │
│ │ ▣ IMG-CASE-01 (4:3)      │▣││   │ │ ▣ IMG-CASE-02  │ SECTEUR {F}                    │ │▣ │ │
│ ├──────────────────────────┤ ││   │ │ (1:1)          │ Marque fictive {F}       (h3)  │ │  │ │
│ │ SECTEUR {F}              │ ││   │ │ col. 1-5       │ +38 % {F}  Indicateur {F}      │ │  │ │
│ │ Marque fictive {F}  (h3) │ ││   │ │                │ Résumé {F}                     │ │  │ │
│ │ +38 % {F}                │ ││   │ │                │ [□ i:play Vidéo]  Source {F}   │ │  │ │
│ │ Indicateur {F}           │ ││   │ └─────────────────────────────────────────────────┘ └──┘ │
│ │ Résumé sur 2 lignes {F}  │ ││   │   diapositive suivante visible en bordure                │
│ │ [□ i:play Vidéo]         │ ││   └──────────────────────────────────────────────────────────┘
│ │ Mention de source {F}    │ ││
│ └──────────────────────────┴─┘│
│ [◁]        2 sur 5        [▷] │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.caseStudies.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `ph.caseStudies.items.case01` à `.case05` : `.sector` | Secteur (rôle Overline) | 24 | **Oui** |
| `… .brandName` | Marque fictive, `h3` | 24 | **Oui** |
| `… .metricValue` + ICU `landing.caseStudies.metricDisplay` | Indicateur de performance, jamais un montant | 10 rendu | **Oui** |
| `… .metricLabel` | Nom de l'indicateur | 50 | **Oui** |
| `… .summary` | Format, durée, nombre de créateurs | 140 | **Oui** |
| `ph.caseStudies.sourceNote` | §2.7, commune aux 5 diapositives | 60 | **Oui** |
| `landing.caseStudies.videoButton` | Bouton secondaire avec `[i:play]` ; aucun lecteur ni fichier vidéo (CA11) | 20 | Non |
| `ph.images.case01.alt` à `.case05.alt` | Textes alternatifs (05 §4.4) | 125 | **Oui** |
| `landing.common.carousel.*` | Contrôles et rôles (§2.5) | §2.5 | Non |

- **Tokens** : `color-surface-muted` ; diapositive `color-surface-card`, `radius-lg`,
  `shadow-sm`, `space-inset-card` ; secteur `color-text-brand` (5,21:1 sur carte) ; indicateur
  Figure `font-size-figure-lg` ; bordure visible de la suivante : `space-7` ; §2.5.
- **Images** : IMG-CASE-01 à 05 (informatives).
- **Interactions** : `[◁]` `[▷]`, balayage. **Bouton vidéo : sans effet.**
- **Accessibilité** : §2.5 ; chaque bouton vidéo a `aria-describedby` = le `h3` de sa diapositive
  (cinq boutons homonymes distingués) ; toutes les diapositives restent dans l'ordre de
  tabulation, le focus fait défiler la diapositive concernée.
- **États** : première diapositive au chargement ; bornes (§2.5) ; vide → section non rendue.

### 3.9 Section 7 : Problème et conversation : `ProblemSection.tsx`

**Fonction.** Nommer le temps perdu en prospection, puis montrer que l'échange se fait dans la
messagerie INFLUX, sans coordonnées (CA18, principe 5).

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌─────────────────────────┬──────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ SURTITRE + H2 + chapeau │ ▣ IMG-PROBLEM-01 (4:5)       │
│ [i:clock] Douleur 1           │   │ (col. 1-5)              │  ┌────────────────────────┐  │
│ [i:repeat] Douleur 2          │   │ [i:…] Douleurs 1 à 3    │  │ [i:lock] Messagerie    │  │
│ [i:file-question] Douleur 3   │   │ [■ CTA annonceur]       │  │ Rôle annonceur         │  │
│ ┌───────────────────────────┐ │   │                         │  │ ┌──────────────┐       │  │
│ │ [i:lock] Messagerie INFLUX│ │   │                         │  │ │ message {F}  │       │  │
│ │ Rôle annonceur            │ │   │                         │  │ └──────────────┘       │  │
│ │ ┌─────────────────┐       │ │   │                         │  │       Rôle créateur    │  │
│ │ │ message 1 {F}   │       │ │   │                         │  │  ┌──────────────┐      │  │
│ │ └─────────────────┘       │ │   │                         │  │  │ message {F}  │      │  │
│ │          Rôle créateur    │ │   │                         │  │  └──────────────┘      │  │
│ │    ┌─────────────────┐    │ │   │                         │  │ ─ [i:file-check] ─     │  │
│ │    │ message 2 {F}   │    │ │   │                         │  │ événement système      │  │
│ │    └─────────────────┘    │ │   │                         │  └────────────────────────┘  │
│ │ ── événement système ──   │ │   │                         │ Légende (col. 7-12)          │
│ └───────────────────────────┘ │   └─────────────────────────┴──────────────────────────────┘
│ Légende de la figure          │     la carte de conversation chevauche l'image (z-raised)
│ [■ CTA annonceur            ] │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.problem.overline` · `.title` · `.lead` | En-tête standard : le problème, pas la solution | 40 / 70 / 180 | Non |
| `landing.problem.painPoints.search` · `.followUp` · `.contract` | Trois douleurs (icône + texte) | 90 chacune | Non |
| `landing.problem.conversation.frameTitle` | En-tête du cadre « messagerie INFLUX » | 30 | Non |
| `landing.problem.conversation.advertiserRole` · `.creatorRole` | Rôles affichés au-dessus des bulles, **jamais un nom ni un pseudo** | 16 | Non |
| `ph.problem.conversation.messages.m1` à `.m4` : `.author` (`advertiser` / `creator`), `.text` | Quatre messages alternés ; aucun e-mail, téléphone, URL, `@` ni pseudo (CA18) | 140 chacun | **Oui** |
| `landing.problem.conversation.systemEvent` | Événement « proposition de contrat envoyée dans INFLUX » | 50 | Non |
| `landing.problem.conversation.caption` | `figcaption` : échanges conservés dans INFLUX, coordonnées inutiles | 120 | Non |
| `ph.problem.conversation.sourceNote` | Mention « conversation fictive », Small sous la légende, hors du cadre (§2.7) | 60 | **Oui** |
| `landing.common.cta.advertiser` | CTA seul (le problème décrit est celui de l'annonceur) | 20 | Non |

- **Tokens** : `color-surface-page` ; douleurs `size-icon-md` `color-text-brand` ; cadre
  `color-surface-card`, `border-width-thin` + `color-border-default`, `radius-xl`, `shadow-lg`,
  `z-raised` ; bulle annonceur `color-surface-muted`, bulle créateur `color-brand-subtle-bg`, toutes
  deux `radius-md` + `color-text-primary` ; rôles et événement Small `color-text-tertiary`,
  séparateurs `color-border-subtle`.
- **Images** : IMG-PROBLEM-01 (décorative, ≥ `lg`). **Interactions** : aucune.
- **Accessibilité** : `<figure>` + `<figcaption>` ; messages en `<ol>`, chaque `<li>` commence
  par le rôle en texte. L'auteur est porté par le **rôle écrit** et l'**alignement**, la teinte
  des bulles ne fait que doubler. Aucune heure (supprimée : sans valeur ici).
- **États** : messages absents → cadre rendu avec le seul événement système.

### 3.10 Section 8 : Méthode en 6 étapes : `MethodSection.tsx`

**Fonction.** Décrire le parcours réel du MVP, du brief au reversement, étape par étape.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌───────────────────────────────────┬──────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ SURTITRE + H2 + chapeau (col.1-7) │ ▣ IMG-METHOD-01      │
│ ▣ IMG-METHOD-01 (16:9)        │   │ (01) Titre étape 1           [^]  │ (4:5, col. 8-12,     │
│ (01) Titre étape 1       [^]  │   │      Texte de l'étape             │  collante sous       │
│      Texte de l'étape         │   │ (02) Titre étape 2           [v]  │  l'en-tête)          │
│ (02) Titre étape 2       [v]  │   │ (03) … (06)                  [v]  │                      │
│ (03) … (06)              [v]  │   └───────────────────────────────────┴──────────────────────┘
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.method.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `landing.method.steps.<id>.title` | Titre de l'étape (bouton d'accordéon) | 32 | Non |
| `landing.method.steps.<id>.body` | Texte de l'étape | 220 | Non |

Identifiants et contenu attendu, dans l'ordre : `brief` (l'annonceur publie son brief, validé par
l'équipe) ; `teamSelection` (l'équipe INFLUX sélectionne les créateurs : ni algorithme ni IA,
CA5) ; `messaging` (échanges dans la messagerie) ; `contract` (contrat signé dans INFLUX, montant
et commission incluse explicites, entre parties de pays ouverts sans en nommer aucun) ;
`securePayment` (paiement via un prestataire agréé, non nommé, D9 ; moment exact non précisé,
D20) ; `publicationPayout` (publication validée, puis reversement du net créateur).

- **Tokens** : `color-surface-muted` ; accordéon §2.4 ; pastille numérotée `radius-round`,
  `size-touch-target` : panneau ouvert `color-action-primary-bg` + `color-text-on-action`, fermé
  `color-surface-card` + `border-width-thin` `color-border-strong` + `color-text-primary` (l'état
  reste porté par le chevron et `aria-expanded`) ; image `top` = `header-height` + `space-6`.
- **Images** : IMG-METHOD-01 (décorative). **Interactions** : accordéon.
- **Accessibilité** : `<ol>` de six `<li>` (le rang est annoncé par la liste) ; pastille
  `aria-hidden` ; §2.4. Tout montant cité suit §2.7.
- **États** : étape 1 ouverte au chargement, les autres fermées.

### 3.11 Section 9 : Réseau de créateurs : `CreatorNetworkSection.tsx`

**Fonction.** Donner la mesure du réseau et inviter les créateurs à le rejoindre.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ SURTITRE + H2 + chapeau (col. 1-7) │ 2 400 {F}           │
│ 2 400 {F} créateurs vérifiés  │   │                                    │ créateurs vérifiés  │
│ Mention de source {F}         │   │                                    │ Source {F} (col.9-12)│
│ [carte horizontale IMG-CRE-04]│   │ [carte CRE-04] [carte CRE-05] [carte CRE-06] [carte CRE-07]│
│ [carte horizontale IMG-CRE-05]│   │ [i:info] Légende « vérifié »            [□ CTA créateur] │
│ [carte horizontale IMG-CRE-06]│   └──────────────────────────────────────────────────────────┘
│ [carte horizontale IMG-CRE-07]│
│ [i:info] Légende « vérifié »  │
│ [□ CTA créateur             ] │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.creatorNetwork.overline` · `.title` · `.lead` | En-tête standard ; aucune promesse de recherche libre (CA5) | 40 / 70 / 180 | Non |
| `ph.creatorNetwork.count` + ICU `landing.creatorNetwork.countLabel` | Compteur avec pluriel (`{count, plural, …}`) | 40 rendu | **Oui** |
| `ph.creatorNetwork.sourceNote` | §2.7 | 60 | **Oui** |
| `ph.creatorNetwork.cards` (4) | Cartes §2.3 | §2.3 | **Oui** |
| `landing.common.cta.creator` | CTA seul, secondaire | 20 | Non |

- **Pas de filtres par réseau** (présents chez la référence) : interaction non autorisée (CA7) et
  recherche libre hors MVP.
- **Tokens** : `color-surface-page` ; compteur rôle Figure `font-size-figure-lg` ; cartes §2.3,
  grille 1 → 2 (`sm`) → 4 colonnes (`lg`). **Images** : IMG-CRE-04 à 07 (décoratives).
- **Interactions** : aucune. **Accessibilité** : compteur et libellé dans un même `<p>` ; §2.3.
- **États** : sans cartes → grille et légende non rendues ; sans compteur → compteur non rendu.

### 3.12 Section 10 : Cas d'usage : `UseCasesSection.tsx`

**Fonction.** Aider l'annonceur à se reconnaître dans un objectif.

```
Mobile 375                          Desktop 1440 (grille 2 × 2, col. 6 + 6)
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ ┌───────────────────────────┐ ┌───────────────────────────┐│
│ ┌───────────────────────────┐ │   │ │ ugc : ▣ IMG-USE-03 (3:2)  │ │ acquisition : ▣ IMG-USE-04││
│ │ ugc : ▣ IMG-USE-03 (3:2)  │ │   │ │ Titre (h3) · Texte        │ │ Titre (h3) · Texte        ││
│ │ Titre (h3)                │ │   │ │ Formats : …               │ │ Formats : …               ││
│ │ Texte                     │ │   │ └───────────────────────────┘ └───────────────────────────┘│
│ │ Formats : …               │ │   │ [productLaunch : IMG-USE-01]  [awareness : IMG-USE-02]    │
│ └───────────────────────────┘ │   └──────────────────────────────────────────────────────────┘
│ (acquisition, productLaunch,  │
│  awareness : IMG-USE-04,01,02)│
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.useCases.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `landing.useCases.items.<id>.title` | `h3` | 36 | Non |
| `landing.useCases.items.<id>.body` | Bénéfice pour l'annonceur | 160 | Non |
| `landing.useCases.items.<id>.formats` | Formats typiques, précédés du libellé `landing.useCases.formatsLabel` (Max 12) | 60 | Non |
| `ph.images.use01.alt` à `.use04.alt` | Textes alternatifs (05 §4.6) | 125 | **Oui** |

**Ordre d'affichage** (revue conformité, ligne 1) : `ugc` (IMG-USE-03), `acquisition` (IMG-USE-04),
`productLaunch` (IMG-USE-01), `awareness` (IMG-USE-02). Les identifiants d'images ne changent pas :
chaque photo reste liée à son cas d'usage. Aucun lien « en savoir plus ».
Aucun montant ; s'il en fallait un, §2.7.

- **Tokens** : `color-surface-muted` ; cartes `color-surface-card`, `radius-lg`, `shadow-sm`,
  `space-inset-card` ; formats Small `color-text-tertiary`, libellé `font-weight-semibold`.
- **Images** : IMG-USE-01 à 04 (informatives). **Interactions** : aucune.
- **Accessibilité** : `<ul>` de cartes non focalisables, titre `h3` en tête de carte.
- **États** : nominal uniquement.

### 3.13 Section 11 : Comment ça marche : `HowItWorksSection.tsx`

**Fonction.** Montrer comment on commence, en 3 étapes, avec un vocabulaire propre à chaque
public, et rendre la complétude du profil désirable (principe 3).

```
Mobile 375                          Desktop 1440 (3 colonnes, col. 4 + 4 + 4)
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ ▣ IMG-STEP-01     ▣ IMG-STEP-02      ▣ IMG-STEP-03       │
│ ▣ IMG-STEP-01 (4:3)           │   │                   ┌──────────────┐                       │
│ (1) Titre étape 1 (h3)        │   │                   │Profil 80 %███░│                      │
│ Annonceurs : texte            │   │                   └──────────────┘                       │
│ Créateurs : texte             │   │ (1) Titre (h3)    (2) Titre (h3)     (3) Titre (h3)      │
│ ▣ IMG-STEP-02 (4:3)           │   │ Annonceurs : …    Annonceurs : …     Annonceurs : …      │
│   ┌ Profil complété 80 % ██░ ┐│   │ Créateurs : …     Créateurs : …      Créateurs : …       │
│ (2) Titre étape 2 (h3) …      │   │          [■ CTA annonceur]  [□ CTA créateur]             │
│ ▣ IMG-STEP-03 · (3) …         │   └──────────────────────────────────────────────────────────┘
│ [■ CTA annonceur            ] │
│ [□ CTA créateur             ] │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.howItWorks.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `landing.howItWorks.steps.<id>.title` | `h3` commun aux deux publics | 36 | Non |
| `landing.howItWorks.steps.<id>.advertiser` · `.creator` | Une phrase par public, précédée du libellé `landing.howItWorks.audience.advertiser` · `.creator` (Max 16, `font-weight-semibold`) | 100 chacune | Non |
| `landing.howItWorks.completenessIllustration` | Surimpression illustrative « profil complété à 80 % », `aria-hidden` (valeur d'exemple, pas une statistique) | 30 | Non |
| `landing.common.cta.*`, `landing.common.doors.*` | Paire « deux portes » (§2.2) | §2.2 | Non |

Identifiants : `createAccount` (gratuit, minimum de champs), `completeProfile` (un profil complet
améliore la sélection par l'équipe), `receiveProposals` (propositions de créateurs côté
annonceur, de campagnes côté créateur).

- **Tokens** : `color-surface-page` ; pastille `radius-round`, `color-surface-inverse` +
  `color-text-inverse`, `font-weight-bold` ; surimpression `color-surface-raised`, `shadow-md`,
  `radius-md`, jauge remplie `color-action-primary-bg` sur piste `color-border-subtle`, texte
  `font-size-sm` `color-text-primary` (le pourcentage écrit porte l'information, pas la jauge).
- **Images** : IMG-STEP-01 à 03 (décoratives). **Interactions** : aucune.
- **Accessibilité** : `<ol>` de trois étapes ; pastilles `aria-hidden`.
- **États** : nominal uniquement.

### 3.14 Section 12 : Tarifs transparents : `PricingSection.tsx`

**Fonction.** Lever toute ambiguïté sur l'argent avant l'inscription (CA19 à CA21) : commission
35 % = part annonceur 20 % + part créateur 15 %, **incluse** dans le montant du contrat ; exemple
de référence vérifiable ; net créateur mis en avant. **Texte statique, aucun calcul, aucun
simulateur.**

```
Mobile 375
┌───────────────────────────────────┐
│ SURTITRE + H2 + chapeau           │
│ ┌───────────────────────────────┐ │
│ │ Commission INFLUX 35 %        │ │
│ │ incluse dans le montant du    │ │
│ │ contrat, jamais ajoutée       │ │
│ │ [ 20 % |15 %|      65 %     ] │ │
│ │ ■ Part annonceur INFLUX  20 % │ │
│ │ ▪ Part créateur INFLUX   15 % │ │
│ │ □ Net créateur           65 % │ │
│ ├───────────────────────────────┤ │
│ │ Exemple : contrat de          │ │
│ │ 2 000,00 €                    │ │
│ │ Montant du contrat (coût      │ │
│ │ total pour l'annonceur)       │ │
│ │                    2 000,00 € │ │
│ │ Commission INFLUX totale      │ │
│ │ (35 %)               700,00 € │ │
│ │   dont part annonceur         │ │
│ │   (20 %)             400,00 € │ │
│ │   dont part créateur          │ │
│ │   (15 %)             300,00 € │ │
│ │ ▒ Net créateur reversé        │ │
│ │ ▒                  1 300,00 € │ │
│ └───────────────────────────────┘ │
│ [i:check] Vérification : 400,00 € │
│ (part annonceur) + 300,00 € (part │
│ créateur) + 1 300,00 € (net       │
│ créateur) = 2 000,00 € (montant   │
│ du contrat)                       │
│ Phrases par public · Notes        │
│ Téléphone : voir desktop          │
│ Légende du téléphone              │
└───────────────────────────────────┘

Desktop 1440
┌───────────────────────────────────────────────────────────────────┬──────────────────────────┐
│ SURTITRE + H2 + chapeau (col. 1-8)                                │ (col. 9-12)              │
│ ┌───────────────────────────────────────────────────────────────┐ │ ┌──────────────────────┐ │
│ │ Commission INFLUX 35 % · incluse dans le montant du           │ │ │ Titre de l'écran     │ │
│ │ contrat, jamais ajoutée                                       │ │ │ Net créateur reversé │ │
│ │ [ 20 %       | 15 %    |                65 %                ] │ │ │ 1 300,00 €           │ │
│ │ ■ Part annonceur INFLUX 20 % ▪ Part créateur INFLUX 15 %      │ │ │ sur un contrat de    │ │
│ │ □ Net créateur 65 %                                           │ │ │ 2 000,00 €           │ │
│ ├───────────────────────────────────────────────────────────────┤ │ │ Commission INFLUX    │ │
│ │ Exemple : contrat de 2 000,00 €                               │ │ │ (35 %) : 700,00 €    │ │
│ │ Montant du contrat (coût total pour l'annonceur)    2 000,00 €│ │ │ dont part annonceur  │ │
│ │ Commission INFLUX totale (35 %)                       700,00 €│ │ │ 400,00 € et part     │ │
│ │   dont part annonceur (20 %)                          400,00 €│ │ │ créateur 300,00 €    │ │
│ │   dont part créateur (15 %)                           300,00 €│ │ │ [bouton factice]     │ │
│ │ ▒ Net créateur reversé                              1 300,00 €│ │ └──────────────────────┘ │
│ │ [i:check] Vérification : 400,00 € (part annonceur) + 300,00 € │ │ Légende du téléphone     │
│ │ (part créateur) + 1 300,00 € (net créateur) = 2 000,00 €      │ │                          │
│ │ (montant du contrat)                                          │ │                          │
│ │ Phrases par public · [i:info] Notes devise et taxes           │ │                          │
│ └───────────────────────────────────────────────────────────────┘ │                          │
└───────────────────────────────────────────────────────────────────┴──────────────────────────┘
Revue paiement #18 : aucun libellé abrégé, à 320, 375 et 1440 px. Les libellés passent sur deux
lignes si nécessaire ; les montants, jamais. Le téléphone reprend les mêmes termes.
```

**Éléments (tous dans `landing.json`, aucun fictif ; valeurs en FR `2 000,00 €`, en EN `€2,000.00`) :**

| Clé | Rôle | Max |
|---|---|---|
| `landing.pricing.overline` · `.title` · `.lead` | En-tête standard : transparence, commission uniquement à la signature | 40 / 70 / 180 |
| `landing.pricing.rate.label` · `.total` · `.included` | « Commission INFLUX », « 35 % », « incluse dans le montant du contrat, jamais ajoutée » | 30 / 6 / 70 |
| `landing.pricing.rate.legend.advertiserShare` · `.creatorShare` · `.netCreator` : `.label`, `.value` | Légende de la barre, seul porteur textuel de la barre : « Part annonceur INFLUX » 20 %, « Part créateur INFLUX » 15 % (le mot INFLUX est **obligatoire** dans les deux libellés : une « part créateur » seule se lirait comme une rémunération, revue paiement #3 et #4), « Net créateur » 65 %. Option des libellés individuels retenue plutôt que le regroupement : chaque pastille reste compréhensible seule | 24 / 6 |
| `landing.pricing.example.caption` | `<caption>` : exemple et devise | 50 |
| `landing.pricing.example.columnItem` · `.columnAmount` | En-têtes de colonnes (masqués visuellement sous `md`) | 20 |
| `landing.pricing.example.contractAmount.label` · `.value` | « Montant du contrat (coût total pour l'annonceur) » · 2 000,00 € | 60 / 12 |
| `landing.pricing.example.commissionTotal.label` · `.value` | « Commission INFLUX totale (35 %) » · 700,00 € | 50 / 12 |
| `landing.pricing.example.advertiserShare.label` · `.value` | « dont part annonceur (20 %) » · 400,00 € | 50 / 12 |
| `landing.pricing.example.creatorShare.label` · `.value` | « dont part créateur (15 %) » · 300,00 € | 50 / 12 |
| `landing.pricing.example.netCreator.label` · `.value` | « Net créateur reversé » · 1 300,00 € | 40 / 12 |
| `landing.pricing.example.check` | Vérification dont **chaque montant est étiqueté** (part annonceur, part créateur, net créateur, montant du contrat), revue paiement #13 ; sur 2 à 3 lignes, coupures seulement entre deux termes | 140 |
| `landing.pricing.audience.advertiser` · `.creator` | Une phrase par public, sans nouveau montant : l'annonceur paie le montant du contrat, commission incluse ; le créateur connaît son net avant de signer | 140 chacune |
| `landing.pricing.notes.currency` | Exemple en euros ; une seule devise par contrat (D27) | 120 |
| `landing.pricing.notes.taxes` | Taxes selon les pays, précisées avant signature ; **ni « aucun frais » ni « hors taxes »** tant que D7 est ouverte | 160 |
| `landing.pricing.phone.caption` | `<figcaption>` visible : ce que voit le créateur avant de signer | 120 |
| `landing.pricing.phone.screenTitle` · `.netLabel` · `.netValue` · `.contractLine` · `.fakeButton` | Écran du téléphone, dans cet ordre : titre, libellé du net créateur (terme défini, pas « vous recevez »), 1 300,00 €, ligne du montant du contrat, bouton factice | 30 / 30 / 12 / 60 / 20 |
| `landing.pricing.phone.commissionLine` · `.sharesLine` | Deux lignes **sous `contractLine`** (revue paiement #11) : commission INFLUX (35 %) et son montant ; « dont » part annonceur et part créateur avec leurs montants. Small `color-text-secondary`, `font-variant-numeric-amount`, passage à la ligne autorisé, montants insécables ; `aria-hidden` comme tout l'écran | 60 chacune |

**Règles de présentation**

- **Ordre de lecture** : taux → barre et légende → tableau → phrases par public → notes →
  téléphone. La commission totale précède ses deux parts ; les parts commencent par « dont »
  (écrit, pas seulement indenté), pour qu'aucun lecteur n'additionne 700 + 400 + 300.
- **Tableau** : `<table>` + `<caption>` ; `<th scope="col">` ; chaque ligne `<th scope="row">` +
  `<td>` aligné à droite, `font-variant-numeric-amount`, insécable. Sous-lignes indentées
  `space-5`. Ligne net créateur : fond `color-data-net-creator`, libellé
  `color-text-brand-strong` `font-weight-semibold`, montant `font-size-amount-lg`
  `font-weight-bold` `color-text-primary`, filet haut `border-width-thick` `color-border-strong`
  (mise en avant par taille, graisse et filet, pas par la couleur seule). Vérification en `<p>`
  après le tableau, Small `color-text-secondary` + `[i:check]`.
- **Barre** `aria-hidden="true"` : segments `color-data-advertiser-share` (texte
  `color-text-inverse`), `color-data-creator-share` (`color-text-on-action`), `color-data-net-creator`
  (`color-text-primary`) ; largeurs statiques `w-1/5`, `w-3/20`, `w-13/20` ; contour
  `border-width-thin` `color-border-strong` (le segment clair ne se distingue pas du blanc) ;
  hauteur `space-8` ; pourcentages internes masqués sous `breakpoint-sm`. La légende (`<ul>`,
  pastilles aux mêmes tokens, dans le même ordre) porte l'information en texte.
- **Téléphone** : `<figure>` ; contenu de l'écran `aria-hidden="true"` (il reprend l'exemple déjà
  lu dans le tableau), `<figcaption>` lue ; bouton factice = `<span>` non focalisable. Tokens :
  cadre `color-surface-inverse`, `radius-xl`, `shadow-lg`, largeur max. `size-phone-mockup` ; écran
  `color-surface-page` `radius-lg` ; net en `font-size-amount-lg` sur pastille
  `color-brand-subtle-bg`.
- **Autres tokens** : `color-surface-muted` ; encart `color-surface-card`, `radius-xl`,
  `shadow-sm`, `space-inset-card` ; « 35 % » `font-size-amount-lg` `color-text-brand` ; notes Small
  `color-text-tertiary` + `[i:info]`.
- **Interdits de contenu** (revue `expert-paiement-facturation`) : un montant sans étiquette ni
  devise ; « frais » ou « commission » sans préciser laquelle ; un autre taux que 35 / 20 / 15 ; le
  nom d'un prestataire (D9) ou d'un pays ouvert (D26).
- **Images** : aucune. **Interactions** : aucune. **États** : nominal uniquement ; à 320 px, les
  libellés passent à la ligne, les montants jamais.

### 3.15 Section 13 : Pourquoi INFLUX : `WhyInfluxSection.tsx`

**Fonction.** Trois raisons de choisir INFLUX, dont la troisième explique pourquoi tout reste dans
la plateforme.

```
Mobile 375                          Desktop 1440 (3 colonnes)
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ SURTITRE + H2 + chapeau                                  │
│ ▣ IMG-WHY-01 (3:2)            │   │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ Titre (h3) · Texte            │   │ │▣ IMG-WHY-01    │ │▣ IMG-WHY-02    │ │▣ IMG-WHY-03    │ │
│ ▣ IMG-WHY-02 · Titre · Texte  │   │ │ Titre (h3)     │ │ Titre (h3)     │ │ Titre (h3)     │ │
│ ▣ IMG-WHY-03 · Titre · Texte  │   │ │ Texte          │ │ Texte          │ │ Texte          │ │
└───────────────────────────────┘   │ └────────────────┘ └────────────────┘ └────────────────┘ │
                                    └──────────────────────────────────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.whyInflux.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `landing.whyInflux.items.qualifiedMatching.title` · `.body` | Sélection qualifiée par l'équipe (ni algorithme ni IA, CA5) | 40 / 180 | Non |
| `landing.whyInflux.items.secureContract.title` · `.body` | Contrat et paiement sécurisés, net reversé après validation | 40 / 180 | Non |
| `landing.whyInflux.items.allInInflux.title` · `.body` | Échanges, contrat et paiement tracés dans INFLUX : protection des deux parties, ton positif et jamais menaçant | 40 / 180 | Non |

- **Tokens** : `color-surface-page` ; cartes comme §3.12. **Images** : IMG-WHY-01 à 03
  (décoratives). **Interactions** : aucune. **Accessibilité** : `<ul>`, `h3` en tête de carte.
- **États** : nominal uniquement.

### 3.16 Section 14 : FAQ : `FaqSection.tsx`

**Fonction.** Répondre aux objections avant l'inscription, en particulier sur l'argent et les pays.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌───────────────────────┬──────────────────────────────────┐
│ SURTITRE + H2 + chapeau       │   │ SURTITRE + H2         │ Question 1                   [v] │
│ Question 1               [v]  │   │ + chapeau (col. 1-4,  │ Question 2                   [^] │
│ Question 2               [^]  │   │ collant)              │   Réponse (measure-text)         │
│   Réponse                     │   │                       │ Questions 3 à 8              [v] │
│ Questions 3 à 8          [v]  │   │ Invite contact        │                     (col. 6-12)  │
│ Invite contact                │   │ [i:mail] e-mail {F}   │                                  │
│ [i:mail] e-mail {F}           │   └───────────────────────┴──────────────────────────────────┘
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.faq.overline` · `.title` · `.lead` | En-tête standard | 40 / 70 / 180 | Non |
| `landing.faq.items.<id>.question` | `h3` + bouton d'accordéon | 90 | Non |
| `landing.faq.items.<id>.answer` | Réponse ; tout montant suit §2.7 | 400 | Non |
| `landing.faq.contactPrompt` | Invite pour une autre question | 60 | Non |
| `ph.contact.email` | E-mail en texte (§3.2) | 32 | **Oui** |

| Ordre | `<id>` | Contenu attendu et limites |
|---|---|---|
| 1 | `signupCost` | Inscription gratuite pour les deux publics ; INFLUX n'est rémunéré qu'à la signature |
| 2 | `commission` | 35 % = 20 % annonceur + 15 % créateur, inclus dans le montant du contrat ; renvoi en texte à l'exemple des tarifs (pas de lien) |
| 3 | `payment` | L'annonceur paie via INFLUX et un prestataire agréé non nommé (D9) ; net créateur reversé après validation de la publication ; moment exact non promis (D20) |
| 4 | `currency` | Une seule devise par contrat, liste fermée (D27) ; plateforme en français et en anglais |
| 5 | `openCountries` | Inscription partout ; contrats ouverts pays par pays ; l'utilisateur est prévenu à l'ouverture du sien ; aucun pays ni date (CA5, D26) |
| 6 | `hiddenHandles` | Pseudos masqués jusqu'à la signature (D16) ; choix sur statistiques vérifiées, portfolio, badge |
| 7 | `messaging` | Pourquoi les échanges restent dans la messagerie INFLUX (traçabilité, contrat, paiement protégé) |
| 8 | `eligibility` | Créateurs majeurs uniquement (D15), particuliers compris (D17) ; vérification d'identité au premier contrat, via le prestataire |

- **Tokens** : `color-surface-muted` ; §2.4 ; réponses `color-text-secondary`,
  `line-height-relaxed`, `measure-text` ; colonne gauche collante `top` = `header-height` +
  `space-6` ; mobile limité à `container-narrow`.
- **Images** : aucune. **Interactions** : accordéon. **Accessibilité** : §2.4.
- **États** : toutes les questions fermées au chargement.

### 3.17 Section 15 : Appel final : `FinalCtaSection.tsx`

**Fonction.** Dernier rappel des deux portes, sur fond sombre, avec la vitrine de créateurs.

```
Mobile 375                          Desktop 1440
┌───────────────────────────────┐   ┌─────────────────────────┬────────────────────────────────┐
│ H2 (texte inverse)            │   │ H2          (col. 1-5)  │ (col. 6-12)                    │
│ Chapeau                       │   │ Chapeau                 │ ┌────────┐┌────────┐┌────────┐ │
│ Public annonceur              │   │ Public annonceur        │ │CRE-08  ││CRE-09  ││CRE-10  │ │
│ [■ CTA annonceur            ] │   │ [■ CTA annonceur]       │ │cartes  ││claires ││§2.3    │ │
│ Public créateur               │   │ Public créateur         │ └────────┘└────────┘└────────┘ │
│ [□ CTA créateur, inversé    ] │   │ [□ CTA créateur]        │ [i:info] Légende « vérifié »   │
│ [carte horizontale CRE-08]    │   └─────────────────────────┴────────────────────────────────┘
│ [carte horizontale CRE-09]    │     fond color-surface-inverse
│ [carte horizontale CRE-10]    │
│ [i:info] Légende « vérifié »  │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.finalCta.title` · `.lead` | `h2` et chapeau (pas de surtitre) | 60 / 140 | Non |
| `landing.common.doors.*`, `landing.common.cta.*` | Paire « deux portes » (§2.2) | §2.2 | Non |
| `ph.finalCta.cards` (3) | Cartes §2.3 | §2.3 | **Oui** |

- **Tokens** : `color-surface-inverse` ; `color-text-inverse`, chapeau et légende
  `color-text-inverse-secondary` ; bouton principal (contour perçu 3,80:1 sur noir) ; bouton
  secondaire inversé (§2.2) ; focus `color-focus-ring-inverse` ; cartes claires inchangées (§2.3),
  grille 1 → 3 colonnes (`lg`).
- **Images** : IMG-CRE-08 à 10 (décoratives). **Interactions** : aucune (CTA sans effet).
- **Accessibilité** : §2.2, §2.3. **États** : sans cartes → texte et CTA seuls, sur toute la
  largeur.

### 3.18 Section 16 : Formulaire en 3 étapes : `StartFormSection.tsx` + `StartFormSteps.tsx`

**Fonction.** Préfigurer l'inscription du Lot 1 avec le minimum de champs, deux vocabulaires et
un consentement propre. **Factice** : rien n'est envoyé ni stocké (CA8).

```
Desktop 1440 : col. 1-5 = H2, chapeau, ▣ IMG-FORM-01 (3:2), 3 réassurances ; col. 7-12 = carte.
Mobile 375 : H2, chapeau, réassurances, carte (image masquée).

Étape 1                             Étape 2 (annonceur)                 Étape 3 (créateur)
┌───────────────────────────────┐   ┌───────────────────────────────┐   ┌───────────────────────────────┐
│ Étape 1 sur 3                 │   │ Étape 2 sur 3                 │   │ Étape 3 sur 3                 │
│ Titre de l'étape (h3)         │   │ Titre de l'étape (h3)         │   │ Titre de l'étape (h3)         │
│ ███████░░░░░░░░░░░░░          │   │ ██████████████░░░░░░░         │   │ █████████████████████         │
│ Légende : vous êtes           │   │ Adresse e-mail *              │   │ [ ] Attestation de majorité * │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │   │ [                           ] │   │     Aide : mineurs exclus     │
│ ┃ (●) [i:briefcase]     [✓] ┃ │   │ Nom de l'entreprise *         │   │ [ ] Acceptation des CGU *     │
│ ┃ Annonceur                 ┃ │   │ [                           ] │   │ [ ] Consentement marketing    │
│ ┃ Description               ┃ │   │ Pays de l'entreprise *        │   │     (facultatif) · Aide       │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │   │ [ Sélectionnez…           v ] │   │ Mention confidentialité       │
│ ┌───────────────────────────┐ │   │ [i:info] Pays ouverts : info  │   │ * champ obligatoire           │
│ │ ( ) [i:camera] Créateur   │ │   │ Langue de communication *     │   │ [□ Retour] [■ Créer le compte]│
│ │ Description               │ │   │ (●) Français  ( ) English     │   └───────────────────────────────┘
│ └───────────────────────────┘ │   │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ [■ Continuer                ] │   │ ┃ nom@exemple   (en erreur) ┃ │   Message final (remplace la carte)
└───────────────────────────────┘   │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │   ┌───────────────────────────────┐
                                    │ [i:circle-alert] Erreur reliée│   │ [i:info] Maquette : rien n'a  │
                                    │ [□ Retour]  [■ Continuer    ] │   │ été envoyé (h3)               │
                                    └───────────────────────────────┘   │ Texte                         │
                                                                        │ [□ Recommencer]               │
                                                                        └───────────────────────────────┘
```

**Champs** (clés sous `landing.startForm.`, sauf mention)

| Étape | Champ | Profil | Contrôle | Requis | Validation | Clés et Max |
|---|---|---|---|---|---|---|
| 1 | Type de profil | Les deux | `fieldset` + `legend`, 2 radios natifs dans des cartes-libellés | Oui | Un choix | `profile.legend` 40 ; `profile.advertiser.title` · `.description` 20 / 70 ; `profile.creator.*` idem ; `profile.errors.required` 80 |
| 2 | E-mail | Les deux | `input type="email"`, `inputMode="email"` | Oui | Non vide ; forme `x@y.z` | `email.label` 30 ; `email.errors.required` · `.format` 80 |
| 2 | Entreprise | Annonceur | `input type="text"`, `maxLength` 120 | Oui | Non vide hors espaces | `company.label` 30 ; `company.errors.required` 80 |
| 2 | Pays | Les deux, libellé propre à chacun | `select` natif, 1re option vide ; **tous** les pays ISO 3166-1, noms dans la langue de la page, ordre alphabétique de cette langue ; aucun pays marqué « ouvert » | Oui | Une valeur | `country.labelAdvertiser` · `.labelCreator` 30 ; `country.emptyOption` 30 ; `country.openCountriesInfo` 160 (inscription partout, contrats pays par pays, prévenu à l'ouverture) ; `country.errors.required` 80 |
| 2 | Langue | Les deux | `fieldset`, 2 radios, présélection = langue de la page | Oui | Toujours satisfait | `language.legend` 40 ; noms repris de `landing.header.languageSwitcher.*` |
| 3 | Majorité | Créateur | Case à cocher | Oui | Cochée | `adult.label` 120 ; `adult.hint` 100 ; `adult.errors.required` 100 |
| 3 | CGU | Les deux | Case à cocher ; noms des documents en texte, sans lien | Oui | Cochée | `terms.label` 120 ; `terms.errors.required` 80 |
| 3 | Consentement marketing | Les deux, **libellé propre à chaque profil** (revue conformité, ligne 18) | Case à cocher **non cochée**, distincte des CGU, marquée facultative ; une seule case, dont le libellé suit le profil choisi à l'étape 1 | Non | — | `marketingConsent.labelAdvertiser` 160 (e-mails commerciaux et contact par l'équipe commerciale) · `marketingConsent.labelCreator` 160 (e-mails ; les propositions de campagnes n'en dépendent pas) ; `marketingConsent.hint` 120 (retrait à tout moment) |
| 3 | Confidentialité | Les deux | Texte | — | — | `privacyNotice` 200 |

**Autres éléments** : `overline` · `title` · `lead` (40 / 70 / 180) ; `reassurance.free` ·
`.progressive` · `.noPayment` (60 chacune, sans promesse de durée) ; ICU `progress` (« Étape
{current, number} sur {total, number} », 20) ; `steps.profile.title` · `.account.title` ·
`.consents.title` (40) ; `requiredLegend` (40) ; `actions.back` · `.continue` (16) ;
`actions.submit` (24). **Fictif / maquette** : `ph.startForm.mockupNotice.title` (50),
`.body` (200 : aucune donnée transmise ni enregistrée), `.restart` (20) ; `ph.images` sans objet
(IMG-FORM-01 décorative).

**Champs volontairement absents** : mot de passe (un champ mot de passe déclenche
l'enregistrement par le gestionnaire du navigateur, contraire à CA8 ; il revient au Lot 1),
téléphone, nom, site web (au-delà du minimum ; le téléphone invite aux échanges hors plateforme).

**Comportement**

- Validation **au clic** sur « Continuer » ou « Créer le compte » seulement ; toutes les erreurs de
  l'étape s'affichent, le focus va au premier champ invalide ; ensuite, chaque erreur se met à
  jour à la modification du champ. Pas de validation pendant la première saisie.
- « Retour » : sans validation, saisie conservée. Changer de profil à l'étape 1 conserve en mémoire
  les champs devenus inutiles, qui sont masqués et ignorés, **sauf la case de consentement
  marketing, qui est décochée** : son libellé change avec le profil, un accord donné à l'autre
  libellé ne vaut pas.
- Tous les boutons sont `type="button"` ; `<form noValidate autoComplete="off">` avec `onSubmit`
  (`preventDefault`) qui déclenche l'action du bouton principal de l'étape : Entrée dans un champ
  se comporte comme « Continuer ».
- Étape valide : étape suivante, focus sur son `h3` (`tabindex="-1"`), qui contient « Étape 2 sur 3 »
  et le titre. **Pas de zone `aria-live` en plus** : le déplacement du focus annonce déjà (évite la
  double annonce ; précise 01 §11 règle 5).
- Envoi final : **aucun indicateur de chargement** (il suggérerait un envoi) ; la carte est
  remplacée par le message final, focus sur son `h3`. « Recommencer » vide tout et remet le focus
  sur l'étape 1. Rechargement ou changement de langue : tout est perdu (CA10).

**Tokens** : section `color-surface-page` ; carte `color-surface-raised`, `shadow-md`, `radius-lg`,
`space-inset-card` ; champs `size-input`, `radius-md`, `border-width-thin` + `color-border-strong`,
Body 16 px, `space-stack-sm` libellé-champ, `space-stack-md` entre champs ; aides Small
`color-text-tertiary` ; cases et radios `size-checkbox`, `radius-sm`, libellé cliquable (cible ≥
`size-touch-target`). Carte de choix sélectionnée : `border-width-thick` + `color-border-selected`
+ `color-brand-subtle-bg` + `[i:check]` `color-text-brand-strong` + radio coché (trois indices).
Progression `aria-hidden` : segments `color-action-primary-bg` / `color-border-subtle`. Erreur :
`border-width-thick` + `color-border-error`, message `color-feedback-error-text` Small +
`[i:circle-alert]` `color-feedback-error-icon`. Info pays et message final :
`color-feedback-info-bg`, `-border`, `-text`, `-icon`. Actions `size-button-lg` ; mobile : « Retour »
(1/3) et bouton principal (2/3) sur la même ligne, ordre DOM = ordre visuel.

**Accessibilité** : `<form aria-labelledby>` (le `h2`) ; chaque champ a un `<label>` visible (jamais
de placeholder seul) ; `required` sur les champs obligatoires + astérisque expliqué par
`requiredLegend` ; en erreur : `aria-invalid="true"` et `aria-describedby` = aide + message ; pas de
limite de temps. **Images** : IMG-FORM-01 (décorative, ≥ `lg`). **Interactions** : étapes, retour,
envoi factice, recommencer.

**États** : étape 1 vide ; étapes 2 et 3 selon le profil ; erreurs par champ ; message final
(information, pas succès) ; aucun état de chargement ni d'erreur réseau (il n'y a pas de réseau).

### 3.19 Pied de page : `SiteFooter.tsx`

**Fonction.** Marque, navigation, informations légales, contact ; aucune identité juridique
inventée (CA12, D25).

```
Mobile 375                          Desktop 1440 (4 colonnes : 1-4 · 5-6 · 7-9 · 10-12)
┌───────────────────────────────┐   ┌──────────────────────────────────────────────────────────┐
│ INFLUX                        │   │ INFLUX          Navigation   Légal            Contact     │
│ Signature                     │   │ Signature       Méthode      CGU              [i:mail]    │
│ Navigation (h2)               │   │                 Créateurs    CGV              e-mail {F}  │
│ Méthode · … · FAQ (boutons)   │   │                 Cas d'usage  Confidentialité              │
│ Légal (h2)                    │   │                 Tarifs       Mentions légales             │
│ CGU · … · Cookies (boutons)   │   │                 FAQ          Cookies                      │
│ Contact (h2)                  │   │ ──────────────────────────────────────────────────────── │
│ [i:mail] e-mail {F}           │   │ © année INFLUX        [i:lock] Mention 1  [i:…] Mention 2 │
│ ───────────────────────────── │   └──────────────────────────────────────────────────────────┘
│ © année INFLUX                │     fond color-surface-inverse
│ Mention 1 · Mention 2         │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.common.brandName` · `landing.footer.tagline` | Logo texte et signature | 6 / 90 | Non |
| `landing.footer.navTitle` · `landing.footer.navLabel` | `h2` de colonne ; `aria-label` du `<nav>` (distinct de l'en-tête) | 20 / 30 | Non |
| `landing.header.nav.*` | Mêmes entrées que le menu (boutons Texte) | 14 | Non |
| `landing.footer.legalTitle` · `landing.footer.legal.terms` · `.salesTerms` · `.privacy` · `.legalNotice` · `.cookies` | `h2` et documents du Lot 1 (boutons Texte) | 30 chacun | Non |
| `landing.footer.contactTitle` · `ph.contact.email` | `h2` et e-mail en texte | 20 / 32 | E-mail : **oui** |
| `landing.footer.copyright` | « © année INFLUX » : ni raison sociale, forme juridique, adresse ni immatriculation (CA12) | 40 | Non |
| `landing.footer.trust.contract` · `.payment` | Emplacement des « logos » de la structure de référence : deux mentions en icône + texte, faits du MVP uniquement ; aucun label, certification ni nom de prestataire (D9) | 50 chacune | Non |

- **Tokens** : `color-surface-inverse` ; `color-text-inverse` (titres, entrées),
  `color-text-inverse-secondary` (signature, mentions) ; boutons Texte avec survol
  `color-surface-inverse-raised` (pas de soulignement, qui ferait croire à un lien) ; focus
  `color-focus-ring-inverse` ; séparateur `color-border-inverse` ; copyright `font-size-xs`.
- **Images** : aucune. **Interactions** : aucune (« Cookies » ne rouvre pas la bannière).
- **Accessibilité** : `<footer>` ; un seul `<nav aria-label>` (navigation) ; documents légaux en
  `<ul>` simple ; e-mail ni bouton ni `mailto:`.
- **États** : nominal uniquement.

### 3.20 Bannière cookies : `CookieBanner.tsx`

**Fonction.** Préfigurer le recueil du choix cookies du Lot 1, sans rien déposer ni mémoriser
(CA11). Non bloquante.

```
Mobile 375 (fixée en bas, pleine largeur)   Desktop 1440 (carte flottante en bas, container-max)
┌───────────────────────────────┐           ┌──────────────────────────────────────────────────────────┐
│ Cookies (texte fort)          │           │ Cookies · Texte court (col. 1-7)   [□ Accepter] [□ Refuser]│
│ Texte court                   │           │ Note maquette {F}                  [□ Personnaliser]     │
│ Note maquette {F}             │           └──────────────────────────────────────────────────────────┘
│ [□ Accepter ]  [□ Refuser   ] │
│ [□ Personnaliser            ] │
└───────────────────────────────┘
```

| Clé | Rôle | Max | Fictif |
|---|---|---|---|
| `landing.cookieBanner.regionLabel` | Nom de la région (`aria-labelledby` possible sur le titre) | 30 | Non |
| `landing.cookieBanner.title` | Titre en `<p>` fort, **pas un `hN`** (§2.1) | 20 | Non |
| `landing.cookieBanner.body` | Usage des cookies, choix possible à tout moment | 180 | Non |
| `landing.cookieBanner.accept` · `.reject` · `.customize` | Trois boutons de **même style** (secondaire), même taille, même poids | 16 chacun | Non |
| `ph.cookieBanner.mockupNote` | Maquette : aucun cookie déposé, aucun choix enregistré | 80 | Maquette |

- **Tokens** : `color-surface-raised`, `shadow-lg`, `z-cookie-banner`, filet haut
  `border-width-thin` + `color-border-default`, `radius-md` (coins hauts sur mobile, carte
  `radius-lg` sur desktop), `space-inset-card` ; boutons Secondaire `size-button-md`,
  `font-size-sm` sur mobile ; note Small `color-text-tertiary`.
- **Images** : aucune.
- **Interactions** : « Accepter » et « Refuser » ferment la bannière (fermeture autorisée), sans
  cookie ni stockage ; « Personnaliser » **sans effet** (aucun panneau de préférences avant le Lot
  1). Rechargement : la bannière revient.
- **Accessibilité** : `<section role="region" aria-labelledby>` non modale (pas de piège de focus,
  pas de voile) ; tôt dans le DOM (§2.1). Tant qu'elle est visible, `scroll-padding-bottom` égal à
  sa hauteur, pour qu'un élément focalisé ne passe pas dessous (WCAG 2.4.11). À la fermeture, le
  focus va au premier élément focalisable de l'en-tête. Hauteur sur mobile limitée par les Max
  (texte court) : la page reste lisible au-dessus.
- **États** : visible au chargement ; fermée ; menu mobile ouvert : la bannière reste au-dessus
  et utilisable.

## 4. Points à aligner avec les autres agents

| # | Point | Qui |
|---|---|---|
| 1 | Changement d'étape du formulaire annoncé par le déplacement du focus, sans zone `aria-live` (précise 01 §11 règle 5) | `architecte`, `testeur` |
| 2 | Bannière cookies placée tôt dans le DOM ; CA1 s'entend comme l'ordre visuel | `testeur` |
| 3 | Quatre tokens alias à ajouter dans `tokens.css` (§2.9) | `dev-react-node` |
| 4 | Source des noms de pays du formulaire (API `Intl` du navigateur ou fichier de traduction), parité FR/EN obligatoire | `architecte` |
| 5 | Mot de passe absent de la maquette ; retour au Lot 1 avec le mode d'authentification | `expert-cybersecurite`, `product-owner` |
| 6 | Notes « devise » et « taxes » de la section 12 et réponses 2 à 4 de la FAQ | `expert-paiement-facturation` |
| 7 | Libellé du consentement marketing (portée Brevo et prospection Apollo côté annonceur), CGU nommées sans lien, « Personnaliser » sans effet, mentions de confiance du pied de page | `expert-conformite-rgpd` |
| 8 | Liste des contenus fictifs de `04-contenus.md` : inclure chaque `ph.*` de ce document, dont les mentions de source et les textes alternatifs `ph.images.<id>.alt` | `expert-marketing` |

## 5. Ce qui reste à valider par le fondateur

1. **Deux portes** : une ligne qui nomme le public au-dessus de chaque bouton (hero, section 15) ;
   entre 1024 et 1279 px, l'en-tête n'affiche que le bouton annonceur, faute de place (le bouton
   créateur apparaît dès 1280 px, et les deux sont dans le hero) ; l'e-mail de contact n'est dans
   l'en-tête qu'à partir de 1440 px.
2. **Section tarifs** : barre + tableau « dont » + téléphone côté créateur ; notes sur la devise
   et les taxes tant que D7 et D27 sont ouvertes.
3. **Formulaire** : ni mot de passe, ni téléphone, ni nom, ni site web ; pays et langue pour tous,
   entreprise côté annonceur, majorité côté créateur ; consentement marketing facultatif.
4. **Mention « donnée fictive »** sous chaque chiffre inventé, en plus du bandeau Maquette.
5. **Écarts assumés avec la structure de référence** : pas de filtres par réseau (section 9), pas
   de liens « en savoir plus », études de cas sans défilement automatique, bouton vidéo inactif,
   « logos » du pied de page remplacés par deux mentions texte.
6. **Section 11** avec l'illustration « profil complété à 80 % » (valeur d'exemple).
7. **Rappel D6** (03 §12) : les deux verts, le noir, le jaune du bandeau, la police et les formes
   (pilules, coins arrondis) se valident sur le rendu local, à l'étape 7.
