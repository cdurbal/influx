# Landing page INFLUX : tokens de design

> **Portée depuis le 2026-10-28 (D73) : la vitrine seulement.** Les valeurs de ce document ne
> régissent plus que la **vitrine** (page d'accueil publique, pages légales publiques, page 404,
> bandeau cookies), avec sa direction D59. Les **espaces connectés** — espaces marque et créateur,
> parcours d'inscription et de connexion, backoffice — suivent la **charte KEO Emerald** :
> correspondance des tokens, contrastes, typographie et composants dans
> `docs/mvp/20-direction-design.md` §11 ; mécanique (un même `tokens.css`, bloc
> `[data-theme="keo"]`) dans `docs/mvp/02-architecture-3-espaces.md` §21. Les noms de rôle restent
> communs, seules les valeurs diffèrent. L'alignement du vert de la vitrine sur celui des espaces
> (`#1dd68a`) est soumis au fondateur (`20` §11.9, F2).

> **Statut : D6 tranchée (fondateur, 2026-09-17).** Palette **dark theme**, recalibrée par
> `expert-ux` le même jour suite à l'arbitrage du fondateur : le dark devient le thème par défaut
> de toute la plateforme (pas seulement la landing), fond noir profond nuancé (jamais de noir
> pur), vert de marque ajusté pour rester lisible (WCAG AA) et « premium » sur fond sombre. Ce
> document remplace la version claire provisoire du 2026-09-17 matin ; les sections 1 à 3 et 7
> (couleurs, contrastes, ombres) sont réécrites pour le dark, les sections 4 à 6 et 8 à 11
> (typographie, espacements, rayons hors ombres, tailles, animations, z-index) sont inchangées :
> elles ne dépendent pas du thème.
> **Préparé par :** `expert-ux` (skill `design-system-influx`), étape 2 du plan validé le 2026-09-16.
> **Sources :** `CLAUDE.md` §5.1 et §13 (D6), `00-cadrage.md` (CA22, CA25), skill `design-system-influx`.
> **Documents liés :** `02-ux-wireframes.md` (usage des tokens par bloc), `05-images.md`.
> **Implémentation de référence :** `apps/web/src/styles/tokens.css`.

## 1. Règles d'emploi

1. **Un seul fichier de tokens** dans le code, en variables CSS (`apps/web/src/styles/tokens.css`).
   Chaque token ci-dessous devient `--<nom-du-token>` (exemple : `--color-text-primary`).
2. **Aucune valeur littérale ailleurs** (couleur, taille, espacement, rayon, ombre, durée) : les
   composants n'utilisent que les tokens (CA22).
3. **Nommage par rôle, jamais par apparence** : `color-action-primary-bg`, pas `green-600`.
4. **Le vert de marque et le vert « succès » sont deux familles distinctes.** Le succès utilise
   une teinte sarcelle (`color-feedback-success-*`), jamais un token de marque.
5. **Le vert n'est jamais seul porteur d'information** : tout état (sélection, succès, étape
   active, tendance) est doublé d'un texte, d'une icône ou d'une forme.
6. **Dark theme par défaut** (D6, fondateur, 2026-09-17). La base du site est un noir profond
   nuancé ; les tokens `*-inverse` (`surface-inverse`, `text-inverse`, `action-inverse-bg`…)
   désignent les quelques sections volontairement **claires** posées sur cette page sombre
   (pied de page, appel final) — un effet de contraste assumé, pas un thème clair global. Le
   nommage par rôle, choisi dès l'origine, a permis de basculer toute la palette sans modifier un
   seul composant.

## 2. Couleurs

### 2.1 Marque et actions

La proposition repose sur **deux verts complémentaires**, recalibrés pour rester lisibles et
« premium » sur un fond quasi noir :

- **Vert INFLUX** `#22C55E` : vert riche, utilisé comme fond quand un texte **noir** doit se
  poser dessus (segment « part créateur » de la barre de répartition, par exemple).
- **Vert éclat** `#29E075` : vert vif, signature de la marque en dark — c'est la couleur des
  actions principales, du texte de marque sur fond sombre et de la sélection. Toujours avec du
  texte **noir** quand il sert de fond ; il sert de **texte** directement sur les fonds sombres.

| Token | Valeur | Usage | Interdit |
|---|---|---|---|
| `color-brand-primary` | `#22C55E` | Référence secondaire de la couleur de marque ; fond du segment « part créateur » de la barre de répartition | Texte sur fond `color-surface-page` (contraste insuffisant, 8,69:1 valable seulement en fond avec texte noir dessus) |
| `color-brand-accent` | `#29E075` | Bouton principal, texte de marque, bordure de sélection, bandeau chiffre clé | Texte blanc dessus (utiliser du texte noir, `color-text-on-action`/`color-text-on-accent`) |
| `color-action-primary-bg` | `#29E075` | Fond du bouton principal (CTA annonceur, « Continuer ») | Fond d'un bouton secondaire ; indicateur d'état seul |
| `color-action-primary-bg-hover` | `#22C766` | Survol du bouton principal | — |
| `color-action-primary-bg-active` | `#1BB857` | Bouton principal pressé | — |
| `color-action-disabled-bg` | `#2A2A2E` | Fond d'un bouton désactivé (usage rare, voir `02-ux-wireframes.md`) | Bouton « Continuer » du formulaire : il reste actif et affiche les erreurs |
| `color-action-secondary-bg` | `transparent` | Bouton secondaire (CTA créateur, « Retour ») | — |
| `color-action-secondary-bg-hover` | `#1A1A1D` | Survol du bouton secondaire, des entrées de menu, des en-têtes d'accordéon | — |
| `color-action-secondary-bg-active` | `#242428` | Bouton secondaire pressé | — |
| `color-action-secondary-border` | `#74747C` (= `color-border-strong`) | Bordure du bouton secondaire | — |
| `color-action-inverse-bg` | `#0A0A0A` | Bouton secondaire inversé (sections claires « inverse ») : survol, fond noir + texte clair | — |
| `color-brand-subtle-bg` | `#0F2118` | Fond vert profond très sombre : badge « vérifié », carte de choix sélectionnée, ligne « net créateur » | Grand aplat de section (préférer `color-surface-muted`) |
| `color-brand-subtle-border` | `#1F3D2B` | Bordure décorative des encarts vert profond | Seule indication d'un état |

### 2.2 Texte

| Token | Valeur | Usage | Interdit |
|---|---|---|---|
| `color-text-primary` | `#F5F5F7` | Titres, texte courant, libellés de champs (quasi blanc, moins dur qu'un blanc pur sur noir) | — |
| `color-text-secondary` | `#A1A1AA` | Paragraphes d'accompagnement, sous-titres, légendes | Libellés de champs obligatoires |
| `color-text-tertiary` | `#86868F` | Aides de champ, mentions, « Étape 1 sur 3 », notes de source | Texte principal d'un bloc ; texte sur `color-mockup-banner-bg` (contraste insuffisant, réservé au texte noir) |
| `color-text-brand` | `#29E075` | Surtitres, pourcentages, chiffres clés sur fond sombre | Sur `color-surface-inverse` (utiliser `color-text-accent-on-inverse`) |
| `color-text-brand-strong` | `#6FF2A8` | Texte sur `color-brand-subtle-bg` : badge « vérifié », étiquettes de parts de commission | — |
| `color-text-on-action` | `#0A0A0A` | Texte des boutons principaux (fond vert vif : texte noir requis) | — |
| `color-text-on-accent` | `#0A0A0A` | Texte sur vert éclat | Blanc sur vert éclat |
| `color-text-inverse` | `#0A0A0A` | Texte sur les sections claires « inverse » (appel final, pied de page, maquette de téléphone) | — |
| `color-text-inverse-secondary` | `#52525B` | Texte secondaire sur sections claires « inverse » | — |
| `color-text-accent-on-inverse` | `#0B7D45` | Un chiffre ou montant vert mis en avant sur une section claire « inverse » | Texte courant |
| `color-text-disabled` | `#5C5C63` | Libellé d'un contrôle désactivé | — |

### 2.3 Surfaces

| Token | Valeur | Usage |
|---|---|---|
| `color-surface-page` | `#0A0A0A` | Fond de page par défaut : noir profond, pas de noir pur |
| `color-surface-muted` | `#111113` | Sections alternées (rythme vertical), fond des emplacements d'image en chargement |
| `color-surface-card` | `#131315` | Cartes (créateurs, cas d'usage, étapes) |
| `color-surface-raised` | `#1A1A1D` | Éléments flottants : bannière cookies, menu mobile, carte du formulaire (avec ombre) |
| `color-surface-hover` | `#1F1F23` | Survol des éléments neutres |
| `color-surface-brand-subtle` | `#0F2118` | Alias de `color-brand-subtle-bg` pour les surfaces |
| `color-surface-accent` | `#29E075` | Non utilisé par le code depuis le 2026-09-17 (le bandeau chiffre clé, section 2, est passé au fond métallisé `background-image-metal-card` ci-dessous, sur demande du fondateur). Token conservé, palette D6 non remise en cause, disponible pour un futur accent |
| `color-surface-inverse` | `#F5F5F7` | Appel final (section 15), pied de page, cadre de la maquette de téléphone — bloc **clair** posé sur la page sombre, effet de contraste assumé |
| `color-surface-inverse-raised` | `#E8E8EA` | Cartes, bulles et survol sur les sections claires « inverse » |
| `color-overlay-scrim` | `rgba(0, 0, 0, 0.7)` | Voile derrière le menu mobile ouvert |
| `color-overlay-hero-halo` | `rgba(245, 245, 247, 0.1)` | `color-text-primary` à 10 % d'opacité figé en token (pas de modificateur `/10` en dur, CA22) : remplissage du rectangle du halo d'ambiance du Hero (§9 ter), avant flou et rotation |
| `background-image-metal-card` | `linear-gradient(115deg, ...) , radial-gradient(...) , radial-gradient(...), linear-gradient(160deg, #2E2E33, #19191C, #08080A)` | Fond « carte métallisée » premium (fondateur, 2026-09-17, inspiré de wekollab.fr ; intensité relevée le 2026-09-17 pour un rendu façon carte noire Visa Infinite, avec bande de reflet diagonale) : bandeau chiffre clé (section 2), carte de mock messagerie (section 7), panneau de détail de la commission (section 12). Toujours combiné à `border-border-default` et `shadow-metal-card`. Réservé à un élément isolé par section, jamais à une grille de cartes répétées |
| `background-image-halo-ambient` | `linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, 0.02) 38%, rgba(255, 255, 255, 0.05) 52%, rgba(255, 255, 255, 0.09) 63%, rgba(255, 255, 255, 0.04) 76%, transparent 96%)` | Halo lumineux d'ambiance en biais sur toute une section (expert-ux, 2026-09-17, inspiré du halo au-dessus de la section preuves de wekollab.fr, angle confirmé sur une capture de référence du fondateur) : même technique de reflet diagonal que `background-image-metal-card`, étendue à toute la section 6 (`SectionHalo`, `CaseStudiesSection.tsx`) via `z-behind`, sur une section en `relative isolate overflow-hidden`. Décalé vers la droite pour lire comme une lumière ambiante plutôt qu'un reflet posé sur un élément — cette lecture reste réservée à `background-image-metal-card`. Purement décoratif : `aria-hidden`, sans interaction, opacité crête 9 %, sans effet sur le contraste AA du texte posé au-dessus |

### 2.4 Bordures et séparateurs

| Token | Valeur | Usage | Interdit |
|---|---|---|---|
| `color-border-subtle` | `#1C1C1F` | Séparateurs de listes, lignes de tableau, accordéons | Contour d'un contrôle |
| `color-border-default` | `#242428` | Contour décoratif des cartes | Contour d'un champ ou d'un contrôle (décoratif seulement) |
| `color-border-strong` | `#74747C` | Contour des champs, cases à cocher, boutons radio, puces de carrousel inactives | — |
| `color-border-selected` | `#29E075` | Carte de choix sélectionnée (épaisseur 2 px + icône coche) | Seul indicateur de sélection |
| `color-border-error` | `#F87171` | Contour d'un champ en erreur (épaisseur 2 px + message d'erreur avec icône) | Seul indicateur d'erreur |
| `color-border-inverse` | `#D4D4D8` | Séparateurs décoratifs sur les sections claires « inverse » | Contour d'un contrôle |

### 2.5 Sémantique (distincte du vert de marque)

| Famille | `-text` | `-bg` | `-border` | `-icon` | Usage |
|---|---|---|---|---|---|
| `color-feedback-success` | `#2DD4BF` | `#0D2B28` | `#146B62` | `#2DD4BF` | Confirmation d'une action réussie. Teinte sarcelle, distincte du vert INFLUX. Toujours avec icône coche + texte. |
| `color-feedback-warning` | `#FBBF24` | `#2B2008` | `#92650A` | `#FBBF24` | Alerte non bloquante |
| `color-feedback-error` | `#F87171` | `#2B1212` | `#8F2E2E` | `#F87171` | Erreurs de champ et récapitulatif d'erreurs. Toujours avec icône + texte. |
| `color-feedback-info` | `#60A5FA` | `#0F1F33` | `#2F5A99` | `#60A5FA` | Information (pays ouverts aux contrats, message final « maquette, rien n'a été envoyé ») |

Chaque famille donne quatre tokens : par exemple `color-feedback-error-text`,
`color-feedback-error-bg`, `color-feedback-error-border`, `color-feedback-error-icon`.

### 2.6 Focus et maquette

| Token | Valeur | Usage |
|---|---|---|
| `color-focus-ring` | `#F5F5F7` | Anneau de focus par défaut (quasi blanc), visible sur le fond noir de la page |
| `color-focus-ring-inverse` | `#0A0A0A` | Anneau de focus sur `color-surface-inverse` et `color-surface-inverse-raised` (sections claires) |
| `color-mockup-banner-bg` | `#FFD978` | Fond du bandeau « Maquette : contenus fictifs » (jaune franc, distinct de toute couleur de marque, inchangé par le thème) |
| `color-mockup-banner-border` | `#0A0A0A` | Filet inférieur du bandeau Maquette |

**Style du focus** : `outline: var(--focus-ring-width) solid var(--color-focus-ring)` avec
`outline-offset: var(--focus-ring-offset)`, sur `:focus-visible`. Jamais `outline: none` sans
remplacement. Aucun élément interactif ne vit aujourd'hui sur `color-surface-accent` ou
`color-mockup-banner-bg` (vérifié dans le code) : l'anneau clair par défaut n'y est donc jamais
sollicité ; si un futur composant y ajoute un élément focusable, utiliser
`color-focus-ring-inverse` à cet endroit précis.

## 3. Contrastes calculés

**Méthode.** Ratios calculés par la formule WCAG 2.x (luminance relative, sRGB linéarisé,
`(L1 + 0,05) / (L2 + 0,05)`), avec un script Node exécuté le 2026-09-17. Seuils : **4,5:1** pour
le texte courant, **3:1** pour le texte large (≥ 24 px, ou ≥ 18,66 px en gras) et les composants
d'interface. Toutes les combinaisons ci-dessous atteignent le seuil du texte courant, sauf
mention contraire.

**Méthode (mise à jour 2026-09-17)** : mêmes formule et script Node, recalculés pour la palette
dark. Rappel des seuils : **4,5:1** texte courant, **3:1** texte large et composants d'interface.

### 3.1 Texte sur fond (seuil 4,5:1)

| Texte | Fond | Ratio | AA | Usage |
|---|---|---|---|---|
| `color-text-primary` #F5F5F7 | `color-surface-page` #0A0A0A | 18,18:1 | ✅ | Texte courant, titres |
| `color-text-primary` #F5F5F7 | `color-surface-muted` #111113 | 17,32:1 | ✅ | Texte des sections alternées |
| `color-text-primary` #F5F5F7 | `color-surface-card` #131315 | 17,04:1 | ✅ | Texte dans les cartes |
| `color-text-primary` #F5F5F7 | `color-surface-brand-subtle` #0F2118 | 15,42:1 | ✅ | « 65 % » dans la barre de répartition, ligne « net créateur » |
| `color-text-secondary` #A1A1AA | `color-surface-page` #0A0A0A | 7,72:1 | ✅ | Paragraphes secondaires, légendes |
| `color-text-secondary` #A1A1AA | `color-surface-card` #131315 | 7,24:1 | ✅ | Idem, cartes |
| `color-text-tertiary` #86868F | `color-surface-page` #0A0A0A | 5,49:1 | ✅ | Aides de champ, mentions, « Étape 1 sur 3 » |
| `color-text-tertiary` #86868F | `color-surface-card` #131315 | 5,14:1 | ✅ | Idem, cartes |
| `color-text-brand` #29E075 | `color-surface-page` #0A0A0A | 11,33:1 | ✅ | Surtitres, pourcentages, chiffres clés sur fond sombre |
| `color-text-brand` #29E075 | `color-surface-muted` #111113 | 10,79:1 | ✅ | Idem, sections alternées |
| `color-text-brand` #29E075 | `color-surface-card` #131315 | 10,62:1 | ✅ | Idem, cartes |
| `color-text-brand-strong` #6FF2A8 | `color-brand-subtle-bg` #0F2118 | 11,94:1 | ✅ | Badge « vérifié », étiquettes des parts de commission |
| `color-text-on-action` #0A0A0A | `color-action-primary-bg` #29E075 | 11,33:1 | ✅ | Bouton principal ; segment « part créateur » de la barre de répartition |
| `color-text-on-action` #0A0A0A | `color-action-primary-bg-hover` #22C766 | 8,89:1 | ✅ | Bouton principal, survol |
| `color-text-on-action` #0A0A0A | `color-action-primary-bg-active` #1BB857 | 7,58:1 | ✅ | Bouton principal, pressé |
| `color-text-on-accent` #0A0A0A | `color-surface-accent` #29E075 | 11,33:1 | ✅ | Non utilisé actuellement (voir 2.3) ; combinaison conservée si un futur accent réutilise ce token |
| `color-text-inverse` #0A0A0A | `color-surface-inverse` #F5F5F7 | 18,18:1 | ✅ | Appel final, pied de page, maquette de téléphone ; segment « part annonceur » de la barre de répartition |
| `color-text-inverse-secondary` #52525B | `color-surface-inverse` #F5F5F7 | 7,10:1 | ✅ | Textes secondaires sur sections claires « inverse » |
| `color-text-inverse` #0A0A0A | `color-surface-inverse-raised` #E8E8EA | 16,18:1 | ✅ | Cartes et bulles sur sections claires « inverse » |
| `color-text-accent-on-inverse` #0B7D45 | `color-surface-inverse` #F5F5F7 | 4,78:1 | ✅ | Chiffre vert mis en avant sur section claire « inverse » |
| `color-text-primary` #F5F5F7 | `color-mockup-banner-bg` #FFD978 | 1,25:1 | ❌ | Interdit : utiliser `color-text-primary`… sur ce fond, seul le **texte noir** convient (voir 3.3) |
| `color-feedback-success-text` #2DD4BF | `color-surface-page` #0A0A0A | 10,64:1 | ✅ | Message de succès en ligne |
| `color-feedback-success-text` #2DD4BF | `color-feedback-success-bg` #0D2B28 | 8,10:1 | ✅ | Encart de succès |
| `color-feedback-warning-text` #FBBF24 | `color-surface-page` #0A0A0A | 11,86:1 | ✅ | Alerte en ligne |
| `color-feedback-warning-text` #FBBF24 | `color-feedback-warning-bg` #2B2008 | 9,58:1 | ✅ | Encart d'alerte |
| `color-feedback-error-text` #F87171 | `color-surface-page` #0A0A0A | 7,16:1 | ✅ | Message d'erreur de champ |
| `color-feedback-error-text` #F87171 | `color-feedback-error-bg` #2B1212 | 6,34:1 | ✅ | Récapitulatif d'erreurs |
| `color-feedback-info-text` #60A5FA | `color-surface-page` #0A0A0A | 7,79:1 | ✅ | Information en ligne |
| `color-feedback-info-text` #60A5FA | `color-feedback-info-bg` #0F1F33 | 6,53:1 | ✅ | Encart d'information, message final du formulaire |
| `color-text-disabled` #5C5C63 | `color-action-disabled-bg` #2A2A2E | 2,16:1 | — | Contrôle désactivé : exempté par WCAG, contraste volontairement faible pour signaler l'état |

### 3.2 Composants d'interface et graphiques (seuil 3:1)

| Élément | Fond adjacent | Ratio | AA | Usage |
|---|---|---|---|---|
| `color-action-primary-bg` #29E075 | `color-surface-page` #0A0A0A | 11,33:1 | ✅ | Contour perçu du bouton principal |
| `color-action-secondary-border` #74747C | `color-surface-page` #0A0A0A | 4,27:1 | ✅ | Bordure du bouton secondaire |
| `color-action-secondary-border` #74747C | `color-surface-raised` #1A1A1D | 3,75:1 | ✅ | Idem, sur carte surélevée (pire cas) |
| `color-text-inverse` #0A0A0A | `color-surface-inverse` #F5F5F7 | 18,18:1 | ✅ | Bordure du bouton secondaire inversé (section 15) |
| `color-border-strong` #74747C | `color-surface-page` #0A0A0A | 4,27:1 | ✅ | Champs, cases, radios, puces de carrousel inactives |
| `color-border-strong` #74747C | `color-surface-raised` #1A1A1D | 3,75:1 | ✅ | Idem, carte de formulaire (pire cas) |
| `color-border-selected` #29E075 | `color-surface-card` #131315 | 10,62:1 | ✅ | Carte de choix sélectionnée (+ icône coche) |
| `color-border-selected` #29E075 | `color-brand-subtle-bg` #0F2118 | 9,60:1 | ✅ | Idem, une fois la carte sélectionnée (fond vert profond) |
| `color-border-error` #F87171 | `color-surface-page` #0A0A0A | 7,16:1 | ✅ | Bordure d'un champ en erreur (+ message) |
| `color-border-error` #F87171 | `color-surface-card` #131315 | 6,71:1 | ✅ | Idem, sur carte |
| `color-feedback-warning-icon` #FBBF24 | `color-surface-page` #0A0A0A | 11,86:1 | ✅ | Icône d'alerte |
| `color-feedback-success-icon` #2DD4BF | `color-feedback-success-bg` #0D2B28 | 8,10:1 | ✅ | Icône de succès dans son encart |
| `color-focus-ring` #F5F5F7 | `color-surface-page` #0A0A0A | 18,18:1 | ✅ | Anneau de focus |
| `color-focus-ring` #F5F5F7 | `color-surface-muted` #111113 | 17,32:1 | ✅ | Idem, sections alternées |
| `color-focus-ring-inverse` #0A0A0A | `color-surface-inverse` #F5F5F7 | 18,18:1 | ✅ | Anneau de focus sur section claire « inverse » |
| `color-focus-ring-inverse` #0A0A0A | `color-surface-inverse-raised` #E8E8EA | 16,18:1 | ✅ | Idem, surface claire surélevée |

**Barre de répartition du montant du contrat (section 12).** Segments adjacents : blanc cassé
`#F5F5F7` (part annonceur 20 %) contre vert INFLUX `#22C55E` (part créateur 15 %) : **2,09:1**,
séparés par un filet `color-border-strong` (les segments sont décoratifs, jamais seuls porteurs
d'information) ; vert INFLUX `#22C55E` contre vert profond `#0F2118` (net créateur 65 %) :
**7,37:1**. La barre reste décorative : la même information figure en texte dans la légende et
dans le tableau d'exemple.

### 3.3 Combinaisons interdites

| Couleur | Fond | Ratio | Règle |
|---|---|---|---|
| `color-border-default` #242428 | `color-surface-page` #0A0A0A | 1,28:1 | Bordure décorative : jamais seule délimitation d'un contrôle |
| `color-border-subtle` #1C1C1F | `color-surface-page` #0A0A0A | 1,16:1 | Séparateur décoratif : jamais seule délimitation d'un contrôle |
| `color-text-primary` / `color-text-secondary` / `color-text-tertiary` (clairs) | `color-mockup-banner-bg` #FFD978 ou `color-surface-accent` #29E075 | < 2:1 | Texte clair sur ces fonds : interdit. Utiliser `color-text-on-accent` (noir) sur `color-surface-accent`, et du texte noir sur le bandeau Maquette |
| `color-text-brand` #29E075 | `color-surface-inverse` #F5F5F7 | 1,61:1 | Vert éclat en texte sur une section claire « inverse » : interdit (utiliser `color-text-accent-on-inverse` #0B7D45) |
| `color-focus-ring` #F5F5F7 (clair) | `color-surface-accent` #29E075 ou `color-mockup-banner-bg` #FFD978 | < 2:1 | Anneau de focus clair sur ces fonds : insuffisant. Non bloquant aujourd'hui (aucun élément focusable n'y vit, cf. 2.6) ; sinon utiliser `color-focus-ring-inverse` |

## 4. Typographie

### 4.1 Police

**Proposition pour la maquette : pile de polices système**, sans aucun chargement (CA11 : aucune
ressource tierce ; performance ; rendu natif du français et de l'anglais).

| Token | Valeur |
|---|---|
| `font-family-base` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif` |
| `font-family-display` | identique à `font-family-base` |
| `font-family-mono` | `ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace` (non utilisé sur la page, réservé) |
| `font-variant-numeric-amount` | `tabular-nums` (montants, pourcentages, compteurs : chiffres alignés) |

**Option à arbitrer par le fondateur (avec D6)** : une police de titre auto-hébergée sous
licence libre (SIL Open Font License), servie depuis le dépôt, jamais depuis un service tiers.
Elle renforcerait l'identité de marque ; elle n'est pas nécessaire pour la maquette.

### 4.2 Échelle de tailles

Tailles fluides entre 375 px et 1440 px de largeur d'écran. Les valeurs minimales et maximales
sont en `rem` : le zoom du navigateur reste respecté (WCAG 1.4.4).

| Token | Valeur | Mobile → desktop | Usage |
|---|---|---|---|
| `font-size-xs` | `0.75rem` | 12 px | Mentions de source sous un chiffre fictif, copyright. Jamais pour un texte à lire en continu. |
| `font-size-sm` | `0.875rem` | 14 px | Aides de champ, badges, légendes, boutons de la bannière cookies sur mobile |
| `font-size-md` | `1rem` | 16 px | Texte courant, champs de formulaire (16 px minimum : pas de zoom automatique sur iOS) |
| `font-size-lead` | `clamp(1.125rem, 1.081rem + 0.1878vw, 1.25rem)` | 18 → 20 px | Chapeau du hero et des sections |
| `font-size-heading-3` | `clamp(1.25rem, 1.162rem + 0.3756vw, 1.5rem)` | 20 → 24 px | Titres de cartes, questions de FAQ, étapes |
| `font-size-heading-2` | `clamp(1.75rem, 1.3979rem + 1.5023vw, 2.75rem)` | 28 → 44 px | Titres de section |
| `font-size-display` | `clamp(2.25rem, 1.6338rem + 2.6291vw, 4rem)` | 36 → 64 px | Titre H1 du hero |
| `font-size-amount-lg` | `clamp(1.75rem, 1.4859rem + 1.1268vw, 2.5rem)` | 28 → 40 px | « 35 % » et montant net créateur dans la section Tarifs |
| `font-size-figure-lg` | `clamp(2.5rem, 1.7958rem + 3.0047vw, 4.5rem)` | 40 → 72 px | Chiffres des sections 4 et 9 |
| `font-size-figure-xl` | `clamp(3.5rem, 2.2676rem + 5.2582vw, 7rem)` | 56 → 112 px | Chiffre du bandeau clé (section 2) |

### 4.3 Graisses, interlignes, approche

| Token | Valeur | Usage |
|---|---|---|
| `font-weight-regular` | `400` | Texte courant |
| `font-weight-medium` | `500` | Boutons, libellés, entrées de menu |
| `font-weight-semibold` | `600` | Titres de cartes, étiquettes de montants |
| `font-weight-bold` | `700` | Titres de section, montants |
| `font-weight-extrabold` | `800` | H1, chiffres clés |
| `line-height-tight` | `1.05` | Chiffres clés |
| `line-height-heading` | `1.15` | H1 et H2 |
| `line-height-snug` | `1.3` | H3, boutons |
| `line-height-body` | `1.55` | Texte courant |
| `line-height-relaxed` | `1.7` | Réponses de FAQ, textes longs |
| `letter-spacing-display` | `-0.02em` | H1, chiffres clés |
| `letter-spacing-heading` | `-0.01em` | H2 |
| `letter-spacing-normal` | `0` | Texte courant |
| `letter-spacing-overline` | `0.08em` | Surtitres en capitales |
| `measure-text` | `40rem` | Largeur maximale d'un paragraphe (environ 70 caractères) |
| `measure-heading` | `22ch` | Largeur maximale du H1 (retours à la ligne équilibrés) |

**Rôles typographiques** (combinaisons à réutiliser, à exposer comme classes ou composants) :

| Rôle | Taille | Graisse | Interligne | Approche | Couleur par défaut |
|---|---|---|---|---|---|
| Overline (surtitre) | `font-size-sm` | `font-weight-semibold` | `line-height-snug` | `letter-spacing-overline`, capitales | `color-text-brand` |
| Display (H1) | `font-size-display` | `font-weight-extrabold` | `line-height-heading` | `letter-spacing-display` | `color-text-primary` |
| Heading 2 | `font-size-heading-2` | `font-weight-bold` | `line-height-heading` | `letter-spacing-heading` | `color-text-primary` |
| Heading 3 | `font-size-heading-3` | `font-weight-semibold` | `line-height-snug` | normal | `color-text-primary` |
| Lead | `font-size-lead` | `font-weight-regular` | `line-height-body` | normal | `color-text-secondary` |
| Body | `font-size-md` | `font-weight-regular` | `line-height-body` | normal | `color-text-primary` |
| Small | `font-size-sm` | `font-weight-regular` | `line-height-body` | normal | `color-text-tertiary` |
| Figure | `font-size-figure-lg` ou `-xl` | `font-weight-extrabold` | `line-height-tight` | `letter-spacing-display`, `tabular-nums` | `color-text-primary` |
| Amount | `font-size-amount-lg` | `font-weight-bold` | `line-height-tight` | `tabular-nums` | `color-text-primary` |
| Button | `font-size-md` (`font-size-sm` dans la bannière cookies mobile) | `font-weight-medium` | `line-height-snug` | normal | selon le bouton |

## 5. Espacements

Échelle unique sur une base de 4 px.

| Token | Valeur | px |
|---|---|---|
| `space-0` | `0` | 0 |
| `space-1` | `0.25rem` | 4 |
| `space-2` | `0.5rem` | 8 |
| `space-3` | `0.75rem` | 12 |
| `space-4` | `1rem` | 16 |
| `space-5` | `1.5rem` | 24 |
| `space-6` | `2rem` | 32 |
| `space-7` | `2.5rem` | 40 |
| `space-8` | `3rem` | 48 |
| `space-9` | `4rem` | 64 |
| `space-10` | `5rem` | 80 |
| `space-11` | `6rem` | 96 |
| `space-12` | `8rem` | 128 |

**Tokens sémantiques** (à utiliser en priorité dans les composants de section) :

| Token | Valeur | Usage |
|---|---|---|
| `space-section-block` | `clamp(3.5rem, 2.2676rem + 5.2582vw, 7rem)` (56 → 112 px) | Marge verticale haute et basse de chaque section |
| `space-section-header` | `clamp(1.5rem, 0.9718rem + 2.2535vw, 3rem)` (24 → 48 px) | Écart entre l'en-tête de section (surtitre, H2, chapeau) et son contenu |
| `space-page-gutter` | `clamp(1rem, 0.2958rem + 3.0047vw, 3rem)` (16 → 48 px) | Marge latérale de page (16 px à 375 px) |
| `space-grid-gap` | `space-4` mobile, `space-5` dès `breakpoint-md`, `space-6` dès `breakpoint-lg` | Gouttière des grilles de cartes |
| `space-stack-sm` | `space-2` | Entre un libellé et son champ, un titre de carte et son texte |
| `space-stack-md` | `space-4` | Entre paragraphes, entre champs d'un formulaire |
| `space-stack-lg` | `space-6` | Entre groupes de contenu dans une section |
| `space-inset-card` | `space-5` (mobile) → `space-6` (desktop) | Marge intérieure des cartes |
| `space-inset-button` | `space-3` vertical, `space-5` horizontal | Marge intérieure des boutons |

## 6. Mise en page et points de rupture

| Token | Valeur | Usage |
|---|---|---|
| `breakpoint-sm` | `480px` | Grands mobiles : grilles 2 colonnes pour les cartes créateurs |
| `breakpoint-md` | `768px` | Tablette : 2 colonnes, en-tête de section centré → aligné à gauche |
| `breakpoint-lg` | `1024px` | Desktop : menu complet (sous 1024 px : menu mobile), grilles 3 et 4 colonnes |
| `breakpoint-xl` | `1280px` | Desktop large : e-mail de contact affiché dans l'en-tête |
| `breakpoint-2xl` | `1440px` | Largeur de référence des wireframes desktop |
| `container-max` | `75rem` (1200 px) | Largeur maximale du contenu |
| `container-narrow` | `48rem` (768 px) | FAQ sur mobile/tablette, message final du formulaire |
| `grid-columns` | 4 (mobile) · 8 (`md`) · 12 (`lg`) | Grille de référence des wireframes |
| `header-height` | `4rem` (64 px) mobile · `4.5rem` (72 px) dès `lg` | Hauteur de l'en-tête collant ; sert aussi à `scroll-padding-top` |

**Note d'implémentation** : les variables CSS ne fonctionnent pas dans les media queries. Les
points de rupture sont documentés ici et reportés comme constantes dans le même fichier de
tokens (mécanisme exact : `architecte`). La page est **mobile-first** : styles de base à 375 px,
enrichis par `min-width`.

## 7. Rayons, bordures, ombres

| Token | Valeur | Usage |
|---|---|---|
| `radius-sm` | `0.375rem` (6 px) | Badges, puces de tags, cases à cocher |
| `radius-md` | `0.75rem` (12 px) | Champs de formulaire, bulles de conversation, bannière cookies (mobile) |
| `radius-lg` | `1.25rem` (20 px) | Cartes, images, carte du formulaire |
| `radius-xl` | `2rem` (32 px) | Maquette de téléphone, grands encarts (tarifs) |
| `radius-pill` | `999px` | Boutons, sélecteur FR/EN, puces de carrousel actives |
| `radius-round` | `50%` | Pastilles numérotées des étapes, icônes rondes |
| `border-width-thin` | `1px` | Cartes, séparateurs, champs |
| `border-width-thick` | `2px` | Bouton secondaire, carte de choix sélectionnée, champ en erreur |
| `focus-ring-width` | `3px` | Anneau de focus |
| `focus-ring-offset` | `2px` | Décalage de l'anneau de focus |
| `shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04)` | Cartes au repos |
| `shadow-md` | `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)` | Cartes survolées, carte du formulaire |
| `shadow-lg` | `0 24px 56px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)` | Bannière cookies, menu mobile, maquette de téléphone |
| `shadow-metal-card` | `inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.5), 0 24px 56px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)` | Bord biseauté du fond `background-image-metal-card` (bandeau chiffre clé, mock messagerie, détail commission) — filets internes haut clair / bas sombre en plus de l'ombre externe, effet tranche de carte métallique |

**Mise à jour dark theme (2026-09-17).** Une ombre portée noire pure se voit à peine sur un fond
déjà quasi noir : chaque niveau ajoute donc un filet quasi transparent blanc (`rgba(255,255,255,…)`
en `0 0 0 1px`, technique dite du « rim light ») qui dessine le bord de la surface surélevée en
plus de l'assombrissement en dessous — c'est le traitement standard des interfaces sombres
« premium » (Linear, Vercel, Stripe). Les ombres restent **décoratives** : aucune délimitation de
contrôle ne repose sur une ombre seule.

## 8. Tailles de contrôles et icônes

| Token | Valeur | Usage |
|---|---|---|
| `size-touch-target` | `2.75rem` (44 px) | Hauteur et largeur minimales de toute cible cliquable |
| `size-button-md` | `2.75rem` (44 px) | Boutons de l'en-tête, du carrousel, de la bannière cookies |
| `size-button-lg` | `3.25rem` (52 px) | CTA des sections, boutons du formulaire |
| `size-input` | `3rem` (48 px) | Champs texte et listes déroulantes |
| `size-checkbox` | `1.5rem` (24 px) | Cases à cocher et radios (zone cliquable étendue au libellé) |
| `size-icon-sm` | `1rem` (16 px) | Icônes dans badges et messages d'erreur |
| `size-icon-md` | `1.25rem` (20 px) | Icônes de boutons, de listes à coches |
| `size-icon-lg` | `1.5rem` (24 px) | Icônes de cartes, menu mobile |
| `size-phone-mockup` | `20rem` (320 px) de large max | Maquette de téléphone (section 12) |

## 9. Animations

| Token | Valeur | Usage |
|---|---|---|
| `duration-instant` | `0ms` | Valeur appliquée à toutes les durées si `prefers-reduced-motion: reduce` |
| `duration-fast` | `120ms` | Survol, focus, pression de bouton |
| `duration-base` | `200ms` | Ouverture d'accordéon, apparition du menu mobile |
| `duration-slow` | `320ms` | Transition entre diapositives du carrousel d'études de cas |
| `duration-marquee-loop` | `40s` | Un tour complet du défilement des logos (vitesse lente, lisible) |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Transitions d'entrée et de changement d'état |
| `easing-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Fermetures (menu mobile, bannière) |

**Règles de mouvement** :

- Avec `prefers-reduced-motion: reduce` : toutes les durées passent à `duration-instant`, le
  défilement des logos est **arrêté** et remplacé par une grille statique, aucune transition de
  diapositive.
- Aucun mouvement automatique sans bouton pause visible (WCAG 2.2.2). Le défilement des logos
  se met aussi en pause au survol et quand un élément du bloc a le focus.
- Pas de compteur animé, pas de parallaxe, pas d'apparition au défilement : les chiffres sont
  affichés directement.

### 9 bis. Cartes du Hero : format réel et relief 3D

| Token | Valeur | Usage |
|---|---|---|
| `aspect-card-id1` | `53.98 / 85.6` | Ratio réel du format **ID-1** (ISO/IEC 7810 : 85,6 × 53,98 mm), utilisé par les cartes Visa/Mastercard, affiché **en portrait** (partie la plus longue de haut en bas, fondateur 2026-09-17). Posé sur le cadre carte des deux photos du Hero : la carte garde ce ratio même si la photo qu'elle contient est plus étroite et ne couvre pas toute sa largeur/longueur |
| `perspective-hero-card` | `900px` | Posé sur le conteneur de chaque photo du Hero (`perspective`), pour que l'inclinaison de la carte à l'intérieur soit correctement mise en fuite. Valeur resserrée (fondateur, 2026-09-17 : « on ne voit pas assez bien la 3D ») pour un relief plus marqué |
| `rotate-hero-main-x` | `6deg` | Inclinaison axe X de la carte de la photo principale (`rotate-x-hero-main-x`) |
| `rotate-hero-main-y` | `-16deg` | Inclinaison axe Y de la carte de la photo principale (`rotate-y-hero-main-y`) |
| `rotate-hero-secondary-x` | `-8deg` | Inclinaison axe X de la carte de la photo secondaire (`rotate-x-hero-secondary-x`) |
| `rotate-hero-secondary-y` | `18deg` | Inclinaison axe Y de la carte de la photo secondaire (`rotate-y-hero-secondary-y`), opposée à la principale pour un effet « en éventail » |

Chaque cadre carte est un conteneur `flex` au ratio `aspect-card-id1`, centré horizontalement et
aligné en haut verticalement (`items-start justify-center`, fondateur 2026-09-17 : « l'image doit
être centrée en haut de la carte ») : la photo garde son propre ratio (`aspect-square` pour la
secondaire, `aspect-4/3`/`aspect-4/5` pour la principale) et est dimensionnée à `h-4/5` (80 % de
la hauteur intérieure de la carte, fondateur 2026-09-17 : « l'image ne doit pas faire toute la
hauteur de la carte pour pouvoir voir le métal »). Le mat métallique reste donc visible sur les
côtés et en dessous de la photo, ce qui est l'effet recherché (carte au format réel, photo
simplement posée dessus, en haut).

Inclinaison **statique**, sans animation : pas de règle `prefers-reduced-motion` nécessaire. Les
deux photos du Hero sont chacune montées sur leur propre cadre `background-image-metal-card` +
`shadow-metal-card` (voir §2.3 et §7) : un conteneur externe porte `perspective-hero-card`, le
cadre carte interne porte le ratio `aspect-card-id1` et les deux rotations — cohérent avec la
doctrine « un élément isolé », appliquée ici à deux éléments distincts plutôt qu'à une grille
répétée.

### 9 ter. Halo d'ambiance du Hero

| Token | Valeur | Usage |
|---|---|---|
| `rotate-hero-halo` | `14deg` | Rotation du rectangle flouté du halo (expert-ux, 2026-09-17, reproduit d'un élément de référence wekollab.fr fourni par le fondateur) |
| `blur-hero-halo` | `40px` | Flou du rectangle : contrairement à `background-image-halo-ambient` (section 6, §2.3), c'est le flou lui-même qui crée le dégradé, pas des arrêts de couleur |
| `inset-hero-halo-top` | `-10%` | Décalage vertical du halo par rapport à toute la section Hero (déborde légèrement en haut, contenu par `overflow-hidden`) |
| `inset-hero-halo-left` | `56%` | Décalage horizontal du halo dans toute la section Hero |
| `size-hero-halo-width` | `26%` | Largeur du halo, en % de toute la section Hero |
| `size-hero-halo-height` | `130%` | Hauteur du halo, en % de toute la section Hero (déborde en haut et en bas, contenu par `overflow-hidden`) |

Le halo est un simple rectangle `color-overlay-hero-halo` (`color-text-primary` à 7 % d'opacité,
figé en token RGBA — pas de modificateur d'opacité numérique en dur, CA22), pivoté et flouté.
Il est posé dans une couche dédiée `absolute inset-0 overflow-hidden`, **sibling** du contenu de
la section plutôt qu'un ancêtre partagé avec les cartes : ça évite de réduire le halo à un filet
coincé derrière les cartes (premier essai, corrigé par le fondateur, 2026-09-17) tout en laissant
les ombres des cartes intactes (aucun risque de découpe par un `overflow-hidden` commun). Visible
seulement à partir de `lg`, comme le reste du traitement « cartes en éventail ». Purement
décoratif : `aria-hidden`, `z-behind` pour rester sous le contenu de la section, sans interaction,
sans effet sur le contraste AA du texte (dimensionné pour rester du côté photo, jamais superposé
au texte).

## 10. Superposition (z-index)

| Token | Valeur | Usage |
|---|---|---|
| `z-behind` | `-1` | Halo d'ambiance décoratif (`background-image-halo-ambient`), derrière le contenu d'une section en `isolate` |
| `z-base` | `0` | Contenu |
| `z-raised` | `10` | Badges posés sur images, carte flottante du hero |
| `z-header` | `100` | En-tête collant |
| `z-overlay` | `200` | Voile et panneau du menu mobile |
| `z-cookie-banner` | `300` | Bannière cookies |

## 11. Tokens utilisés par la page : synthèse

- **Toutes les sections** : `color-surface-page` ou `color-surface-muted` en alternance,
  `color-text-primary`, `color-text-secondary`, `space-section-block`, `space-page-gutter`,
  `container-max`, rôles typographiques.
- **Actions** : `color-action-primary-*`, `color-action-secondary-*`, `radius-pill`,
  `size-button-*`, `color-focus-ring`.
- **Blocs « inverse »**, volontairement clairs sur la page sombre (section 15, pied de page,
  maquette de téléphone) : `color-surface-inverse`, `color-surface-inverse-raised`,
  `color-text-inverse*`, `color-focus-ring-inverse`.
- **Formulaire** : `color-border-strong`, `color-border-selected`, `color-border-error`, `color-feedback-error-*`,
  `color-feedback-info-*`, `size-input`, `size-checkbox`.
- **Maquette** : `color-mockup-banner-bg`, `color-mockup-banner-border`.

## 12. Décisions D6 (tranchées par le fondateur, 2026-09-17)

1. **Dark theme par défaut** sur toute la plateforme (pas seulement la landing) : fond noir
   profond nuancé `#0A0A0A`, jamais de noir pur `#000000`, surfaces qui s'éclaircissent par
   élévation (`#111113` → `#131315` → `#1A1A1D` → `#1F1F23`).
2. **Les deux verts recalibrés pour le dark** : vert INFLUX `#22C55E` (fonds nécessitant du texte
   noir) et vert éclat `#29E075` (actions principales, texte de marque sur fond sombre, sélection)
   — l'un et l'autre choisis pour rester au-dessus des seuils WCAG AA sur fond quasi noir (§3).
3. **Les sections « inverse »** (footer, appel final) restent volontairement **claires**
   (`#F5F5F7`) pour créer un effet de contraste assumé sur la page sombre, plutôt que de
   disparaître dans un thème uniformément noir.
4. **Le jaune du bandeau Maquette** `#FFD978`, inchangé, volontairement étranger à la marque et
   au thème.
5. **La teinte sarcelle du succès** `#2DD4BF`, choisie pour ne pas se confondre avec la marque,
   recalibrée pour le fond sombre.
6. **Les boutons en pilule** (`radius-pill`) et les cartes à coins arrondis (`radius-lg`) :
   inchangés, le dark theme ne modifie ni les rayons ni les tailles.

**Reste ouvert, hors D6** : la police de titre auto-hébergée sous licence libre (§4.1),
optionnelle et non tranchée par le fondateur à ce stade.
