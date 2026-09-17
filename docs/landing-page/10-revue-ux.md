# Landing page INFLUX : revue UX du rendu implémenté (étape 6)

> **Rédigé par :** `expert-ux` (skill `design-system-influx`), le 2026-09-17.
> **Référentiel :** `02-ux-wireframes.md`, `03-tokens-provisoires.md`, `05-images.md`,
> `08-journal-dev.md`. **Périmètre :** code de `apps/web/src/` et CSS compilé
> (`apps/web/.next/static/chunks/*.css`) ; aucune modification de code (corrections : `dev-react-node`).
> Palette et police toujours **provisoires (D6)**.

## 1. Verdict

**Écarts à corriger.** Structure, ordre des blocs, sémantique, tokens et transparence financière
sont conformes dans l'ensemble, et le soin porté à l'accessibilité est réel. Mais la revue du CSS
compilé montre un défaut transversal : `cn()` concatène les classes **sans résoudre les conflits**.
Quand un composant ajoute une classe qui entre en conflit avec une classe de base d'une primitive,
c'est l'ordre du CSS généré qui l'emporte, pas l'intention. Trois rendus en sont cassés ou
dégradés, dont la **carte créateur mobile** (sections 3, 9, 15) : **bloquant**. S'y ajoute le voile
du menu mobile, qui passe au-dessus de la barre d'en-tête.

Après correction des lignes 1 à 4 du §3, la page peut passer à la validation du fondateur (étape 7).

## 2. Réponses aux quatre questions du développeur

### 2.1 Tokens dérivés ou déplacés dans `:root`

**Validés, aucune nouvelle couleur ni valeur visuelle.** Ils seront reportés dans `03` à sa
prochaine révision par `expert-ux` (je ne modifie pas `03` dans cette étape).

| Token | Décision |
|---|---|
| `--container-max`, `--container-narrow` dans `:root` (conflit avec `max-w-max` de Tailwind) | Validé. Mêmes noms et valeurs que 03 §6 |
| `--border-width-thin`, `--border-width-thick`, `--focus-ring-*` dans `:root` | Validé. Déjà prévu par 02 §2.9 |
| `--spacing-inset-button-x` / `-y` (découpage de `space-inset-button`) | Validé. Valeurs de 03 §5 |
| `--sticky-top-offset` = `header-height` + `space-6` | Validé. C'est exactement la règle de 02 §3.10 et §3.16, désormais nommée |
| `--size-mobile-menu-max-height` = `100dvh` − `header-height` | Validé (dérivé fonctionnel, pas une valeur de design) |
| `--image-focus-*` (points focaux de 05 §4) | Validé **par exception** : nommés d'après leur valeur et non d'après un rôle, parce que ce sont des données d'image (05) et non des choix de charte. Ils ne doivent servir qu'à `ResponsiveImage` |

Remarque : `--duration-marquee-loop` n'est pas ramené à `duration-instant` en mouvement réduit.
C'est sans effet, puisque la piste est masquée (`motion-reduce:hidden`). À laisser tel quel.

### 2.2 Invite de contact de la FAQ rendue deux fois

**Acceptable.** Les deux copies sont masquées par `display: none` selon la largeur
(`hidden lg:block` / `lg:hidden`) : une seule est dans l'arbre d'accessibilité à un instant donné,
aucune n'est focalisable et aucun `id` n'est dupliqué. Un lecteur d'écran la lit donc une seule
fois, à la bonne place (après le chapeau en desktop, après les questions en mobile). La seule
limite, un affichage sans CSS, est hors cible. À ne pas généraliser aux contenus interactifs ou
porteurs d'un `id`.

### 2.3 Disposition des contrôles du carrousel (section 6)

**Acceptée, avec un écart mineur documenté.**

- Desktop : contrôles au-dessus de la piste, alignés à droite, sur une ligne à part et non sur la
  ligne de l'en-tête de section comme dans 02 §3.8. L'effet est équivalent (contrôles visibles avant
  les diapositives) : accepté.
- Mobile : contrôles placés **avant** la piste dans le DOM, mais affichés **après** (`order-last`).
  L'ordre du focus diffère donc de l'ordre visuel (WCAG 2.4.3). J'accepte cet écart : il permet à un
  utilisateur clavier d'atteindre précédent/suivant sans traverser les cinq boutons « Vidéo », et
  un utilisateur de lecteur d'écran entend le compteur avant les diapositives. Le compteur visible
  est `aria-hidden` ; la zone `aria-live` n'est mise à jour qu'après un clic : conforme à 02 §2.5.
- Bornes : `aria-disabled`, bouton toujours focalisable, bordure `color-border-subtle` et icône
  `color-text-disabled` : conforme.
- Écart mineur : la bordure visible de la diapositive suivante vaut environ 8 % de la largeur
  (`w-11/12`) au lieu de `space-7` (ligne 9 du §3).

### 2.4 Composants hors 01 §7 : `AudienceDoors` et `MarqueeCarousel`

**Validés côté UX** (la validation de la structure du code reste à `architecte`).

- `AudienceDoors` rend service à l'invariant « deux portes » : une seule implémentation pour le
  hero et les sections 11 et 15. L'ordre est bon (annonceur principal puis créateur secondaire),
  la ligne de public est reliée au bouton par `aria-describedby`, la variante inversée est
  correcte. Écart mineur d'espacement (ligne 8).
- `MarqueeCarousel` séparé de `Carousel` : pertinent, les deux comportements n'ont rien en commun
  (défilement continu et pause d'un côté, navigation manuelle et annonces de l'autre). La copie de
  la boucle est `aria-hidden`, la pause est visible et reprend au survol ou au focus, et la grille
  statique remplace la piste en mouvement réduit. Un défaut en mouvement réduit, lié au problème de
  conflit de classes (ligne 3).

## 3. Écarts

**Cause commune des lignes 1 à 3.** `components/ui/class-names.ts` joint les classes sans fusion.
Dans le CSS compilé, `.w-1\/3` et `.w-9\/12` précèdent `.w-full`, et `.whitespace-normal` précède
`.whitespace-nowrap` : la classe de base de la primitive gagne sur la surcharge de l'appelant.
Vérifié dans `apps/web/.next/static/chunks/3qmikrxc62ty5.css`. Les autres surcharges relevées
(`justify-start`, `text-left`, variantes `sm:`/`lg:`/`aria-disabled:`/`motion-reduce:`) tombent
du bon côté, mais par chance.

| # | Gravité | Bloc | Fichier | Écart | Correction attendue |
|---|---|---|---|---|---|
| 1 | **Bloquant** | Cartes créateurs (sections 3, 9, 15), sous `breakpoint-sm` | `ui/ResponsiveImage.tsx` (base `w-full`), `ui/CreatorCard.tsx` (`w-1/3 … sm:w-full`) | `w-full` l'emporte sur `w-1/3` : en carte horizontale, l'image prend toute la largeur (`shrink-0`) et la colonne texte (thématique, badge, audience, pays) est écrasée ou coupée par `overflow-hidden`. La carte de 02 §2.3 n'est plus lisible sur mobile, la cible principale des créateurs | Retirer `w-full` de la base de `ResponsiveImage` : c'est l'appelant qui fixe la largeur (ou `w-full` par défaut uniquement quand `className` ne précise pas de largeur). Ajouter un contrôle (capture 375 px ou test du HTML) sur la carte horizontale |
| 2 | Majeur | Section 7, desktop | `ui/ResponsiveImage.tsx`, `landing/ProblemSection.tsx` | Même cause : `w-9/12` est ignoré, IMG-PROBLEM-01 occupe toute la colonne et la carte de conversation (`w-8/12`, centrée verticalement) masque la majeure partie de l'image. La composition « image à droite, cadre qui chevauche » de 02 §3.9 est perdue | Corrigé par la ligne 1 ; vérifier ensuite le chevauchement à 1024, 1280 et 1440 px |
| 3 | Majeur | Section 5, mouvement réduit | `ui/MarqueeCarousel.tsx` | Dans la grille statique, `whitespace-normal` est battu par `whitespace-nowrap` de `logoClassName` : à 320 et 375 px, trois colonnes de noms en `text-heading-3` jusqu'à 16 caractères débordent (défilement horizontal, contraire à 02 §2.8) | Ne pas mettre `whitespace-nowrap` dans la classe commune : l'appliquer seulement aux `li` de la piste animée. Vérifier à 320 px avec `prefers-reduced-motion: reduce` |
| 4 | Majeur | En-tête, menu mobile ouvert | `landing/SiteHeaderMobileMenu.tsx` | Le voile (`fixed inset-0`, `z-(--z-base)`) est dans le contexte d'empilement de l'en-tête et vient **après** la barre dans le DOM : il est peint par-dessus le logo, le sélecteur FR/EN et le bouton `[✕]`. La barre est assombrie, un clic sur FR/EN tombe sur le voile et ferme le menu au lieu de changer de langue. 02 §3.2 montre la barre au-dessus du voile | Faire commencer le voile sous l'en-tête (`top-full` sur un conteneur `fixed` ou décalage `header-height`), ou placer la barre au-dessus du voile (`relative` + `z-(--z-raised)` sur la rangée, voile et panneau au-dessus du contenu seulement). Vérifier : `[✕]` et FR/EN utilisables menu ouvert |
| 5 | Mineur | Section 7, mobile | `landing/ProblemSection.tsx` | CTA annonceur de largeur naturelle ; 02 §3.9 le veut pleine largeur sur mobile | `fullWidth` sous `sm` (par exemple conteneur `flex-col` ou `w-full sm:w-auto`) |
| 6 | Mineur | Section 9, mobile | `landing/CreatorNetworkSection.tsx` | CTA créateur de largeur naturelle ; 02 §3.11 le veut pleine largeur sur mobile | Idem ligne 5 |
| 7 | Mineur | Bannière cookies, 1024 à ~1250 px | `landing/CookieBanner.tsx` | En desktop, `w-full max-w-(--container-max)` centré : entre 1024 px et la largeur du conteneur plus les marges, la carte touche les bords de l'écran (aucune marge `space-page-gutter`) | Ajouter les marges de page à la carte flottante (par exemple `inset-x` égal à `space-page-gutter` avec `mx-auto` et `max-w-(--container-max)`) |
| 8 | Mineur | Paire « deux portes » (hero, 11, 15) | `ui/AudienceDoors.tsx` | Écarts d'espacement : `gap-4` entre les deux portes, au lieu de `space-stack-sm` sur mobile et `space-3` en desktop (02 §2.2) | `gap-stack-sm sm:gap-3` (la ligne de public reste à `gap-1` de son bouton) |
| 9 | Mineur | Section 6 | `ui/Carousel.tsx` | Diapositive suivante visible sur environ 8 % de la largeur (`w-11/12`, `lg:w-10/12`) au lieu de `space-7` (02 §3.8) ; sur 375 px, l'amorce est à peine perceptible | Largeur de diapositive égale à 100 % moins `space-7` (dérivé de token, sans valeur arbitraire), ou accepter l'écart après avis du fondateur sur capture |
| 10 | Mineur | Garde-fous | `components/ui/class-names.ts`, `tests/guards.test.ts` | Aucune garde ne détecte une surcharge de classe qui perd contre la base d'une primitive (cause des lignes 1 à 3) | Soit `cn` avec résolution des conflits compatible avec le thème de tokens, soit règle d'usage : une primitive n'impose jamais de largeur, d'affichage ni de `white-space` que l'appelant pourrait surcharger. Couvrir par une capture de régression |

**Points vérifiés conformes** (sans écart) :

- **Ordre et structure** : bandeau Maquette (layout) → bannière cookies → en-tête → `main` avec les
  16 sections dans l'ordre de CA1 → pied de page ; un seul `h1` ; chaque section
  `aria-labelledby` + `h2` (masqué pour la section 2) ; `h3` pour cartes, étapes, questions et
  diapositives ; bandeau et bannière sans titre. Blocs vides non rendus depuis `page.tsx` (02 §2.8).
- **En-tête** : entrées de menu dès `lg`, CTA annonceur dès `lg`, CTA créateur dès `xl`, e-mail dès
  `2xl` (02 §3.2) ; un seul `nav` exposé selon la largeur ; `[≡]` avec `aria-expanded` et
  `aria-controls`, focus sur la première entrée, `inert` sur `main` et `footer`, Échap et retour du
  focus ; sélecteur `role="group"`, `aria-pressed`, nom de langue avec `lang`.
- **Sémantique** : tous les boutons passent par `Button` (`type="button"` imposé par le type) ou
  déclarent `type="button"` (accordéon, sélecteur) ; aucun lien ni `href` ; listes `ul`/`ol` là où
  02 les demande (cartes, étapes, messages, légende, notes, pied de page).
- **Tokens** : aucune valeur arbitraire `[…]`, aucun `style=` dans les composants ; toutes les
  couleurs, tailles et espacements passent par le thème (valeurs par défaut de Tailwind supprimées
  par `--*: initial`) ; seule valeur calculée à l'exécution : la hauteur de la bannière cookies,
  légitime.
- **Accessibilité** : focus visible global (`:focus-visible`, anneau inversé sur
  `data-surface="inverse"`) ; `prefers-reduced-motion` (durées, piste de logos, défilement du
  carrousel en `auto`) ; cibles `size-touch-target` pour boutons icônes, pastilles, sélecteur,
  entrées de menu, radios de langue ; icônes décoratives `aria-hidden` ; tendance portée par la
  flèche, le signe et le mot masqué, pas par le vert.
- **Formulaire** : validation au clic, focus sur le premier champ invalide puis sur le `h3`
  d'étape ; `aria-invalid` et `aria-describedby` (erreur, aide, info pays) ; erreur signalée par
  bordure épaisse, icône et texte ; carte de profil sélectionnée à trois indices (bordure, fond,
  coche) ; consentement marketing non coché, distinct des CGU, libellé propre au profil et marqué
  « facultatif » ; message final en style information, focus sur son titre, sans indicateur de
  chargement. L'absence d'`aria-invalid` sur les radios de profil est acceptée : l'erreur reste
  reliée par `aria-describedby` et visible par bordure, icône et texte.
- **Cartes créateurs (D16)** : ni pseudo, nom, `@`, lien, icône de réseau ni bouton ; carte non
  focalisable ; légende « vérifié » puis mention `ph.creatorCards.sourceNote` sur la ligne
  suivante, dans les trois sections.
- **Tarifs (section 12)** : texte statique uniquement, aucun calcul ; libellés complets à toutes les
  largeurs (« Part annonceur INFLUX », « Part créateur INFLUX », « dont part annonceur (20 %) »…),
  sans abréviation ; montants insécables (`whitespace-nowrap`) ; `caption`, `th scope="col"` et
  `scope="row"` ; en-têtes de colonnes masqués sous `md` ; parts introduites par « dont » ; ligne
  net créateur mise en avant par taille, graisse et filet ; vérification avec chaque montant
  étiqueté ; notes devise et taxes ; téléphone `aria-hidden` avec `figcaption` lue et bouton factice
  non focalisable. Pourcentages de la barre masqués sous `sm`, la légende portant l'information.
- **Mentions de source** : présentes sous le chiffre clé, le résultat, la bande de logos (à gauche
  de la pause, visible aussi en grille statique), chaque diapositive, la conversation (hors cadre,
  après la légende), le compteur du réseau et les grilles de cartes. Chaque mention est un `<p>`
  lu dans l'ordre.

## 4. Captures

**Aucune capture examinée.** Le dossier
`C:\Users\cdurb\AppData\Local\Temp\claude\c--Users-cdurb-Documents-Workspaces-influx\7ebd0b4c-de37-4395-a7c7-a645fa4b73c8\scratchpad\landing-screens\`
était vide au moment de la revue. Les lignes 1 à 4 sont déduites du code et de l'ordre des
règles du CSS compilé ; elles sont à confirmer visuellement, en priorité :

1. Cartes créateurs à 375 px (sections 3, 9, 15), FR et EN.
2. Section 7 à 1440 px.
3. Menu mobile ouvert à 375 px (barre d'en-tête et `[✕]` au-dessus du voile).
4. Section 5 à 320 px avec `prefers-reduced-motion: reduce`.
5. Hero à 375 × 667 et 1440 × 900 (`h1`, chapeau et deux portes sans défiler, CA3), et section 12
   à 320 px (libellés complets, montants sur une ligne).

## 5. Ce qui reste à valider par le fondateur

1. **Palette D6, sur le rendu local** (étape 7), une fois les lignes 1 à 4 corrigées pour ne pas
   juger une mise en page cassée : vert INFLUX `#0B7D45` pour les actions, vert éclat `#1FD17A`
   pour le bandeau chiffre clé, quasi-noir `#0A0A0A`, jaune du bandeau Maquette `#FFD978`. Points
   d'attention : le bandeau vert éclat juste sous le hero est-il trop vif ? Le bouton principal vert
   profond se distingue-t-il assez du bouton secondaire noir sur la section sombre (contour perçu
   3,80:1) ?
2. **Police** : pile système (rendu différent selon Windows, macOS, Android) ou police de titre
   auto-hébergée.
3. **Formes** : boutons en pilule, cartes à coins arrondis.
4. **Amorce de la diapositive suivante** dans les études de cas (ligne 9) : écart accepté ou non.
5. Les points ouverts de 02 §5, inchangés (deux portes dans l'en-tête selon la largeur, section
   tarifs, champs du formulaire, mentions « donnée fictive », écarts avec la référence).
