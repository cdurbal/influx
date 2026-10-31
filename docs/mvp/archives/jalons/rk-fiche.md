# Fiche RK — Réalignement des espaces connectés sur la référence KEO Emerald (jalon extra du MVP)

> **Point d'entrée de toute session du jalon RK.** Décision : `decisions.md` **D75** (fondateur,
> 2026-10-30). Jalon **extra**, placé **avant le Lot 2**, après DS et SN : les écrans du Lot 2 se
> construisent sur des primitives réalignées. Lire ensuite **seulement** les tranches citées : `20`
> §11.3 à §11.8 (charte), `02` §21.3 et §21.5 (mécanique), `18` §5.1 et §12 (gardes, TD1 à TD8),
> `archives/jalons/ds-fiche.md` (arbitrages F1 à F7), skill `design-system-influx`. La maquette
> `design-proposals/proposition-4-keo-emerald.html` reste une **référence visuelle**, jamais une source
> de code.

## Besoin reformulé

Le fondateur a comparé, écart par écart, la référence KEO 4 au rendu réel des espaces connectés
(captures et banc de comparaison interactif, 2026-10-30). Le rendu s'en écarte sur 17 points, dont
**quatre défauts** : des décisions déjà prises qui ne s'affichent pas. Le jalon corrige les défauts et
applique les choix du fondateur, sans toucher à la vitrine ni à aucune règle métier.

| Population | Ce qui change pour elle | Valeur business |
|---|---|---|
| Marque | Bouton principal lumineux et vivant, titres homogènes, badges lisibles | Premier écran après l'inscription conforme à la promesse visuelle de la landing : crédibilité auprès de celui qui paie la commission |
| Créateur (téléphone) | Sensation d'appui sur les boutons (seul mouvement sans survol), plus de cadre blanc parasite | Qualité perçue sur le support principal du créateur |
| Commercial INFLUX | En-tête de tableau lisible, ligne survolée repérée, sous-titres homogènes | Repérage plus rapide dans les listes, huit heures par jour |
| Équipe produit | Primitives justes et gardes qui prouvent le rendu | Le Lot 2 hérite de composants vérifiés à l'écran, pas seulement dans le code |

Aucun effet sur la commission, la traçabilité ni les leads : **aucune règle métier, aucune donnée,
aucune migration, aucune route d'API**. D48 reste appliqué tel quel.

## Constats (2026-10-30, captures et CSS compilé)

| # | Défaut | Cause |
|---|---|---|
| C1 | L'ombre lumineuse du bouton principal (F6) **ne s'affiche jamais**, membres et backoffice | Tailwind v4 inscrit en dur la valeur `@theme` d'un token de l'espace `--shadow-*` : `.shadow-action-glow{--tw-shadow:none}` (valeur vitrine) ; la redéfinition du bloc KEO n'est jamais lue. Seul cas réel de l'audit des deux constructions (`architecte`) |
| C2 | Le halo d'en-tête forme un **rectangle vert très sombre à bords nets** | Calque `absolute inset-0` limité à la boîte du `header`, dégradé non nul sur ses bords, intensité `#0f2118` (1,17:1 contre la page) |
| C3 | Une trentaine de sous-titres **en Source Sans**, certains en **taille fluide de la vitrine** | `SECTION_TITLE_CLASSES` du backoffice (`text-lead font-semibold`), `h2` stylés en libellé côté membres, `text-heading-3` dans `CodeStep` et `FreshCode`, portes de `DoorStep` en `text-lead` ; `tracking-wide` (`ENV_NAME_CLASSES`) ne produit aucune règle (aucun token) |
| C4 | Cadre blanc autour du `h1` à l'arrivée sur une page | L'anneau `:focus-visible` s'applique aussi au titre focalisé par programme (`tabIndex={-1}`) |
| C5 | Filet de 2 px de la ligne survolée du tableau dense **spécifié mais absent** | Phrase de `20` §11.8 sans cas de test |

**Pourquoi DS ne l'a pas vu** (`testeur`) : les gardes et e2e de DS prouvent la structure (jetons,
cascade, classes, ordre du focus), pas l'effet rendu dans l'état concerné. D'où les règles du jalon :
**R1** toute décision visuelle se prouve par un style calculé sur l'élément réel, dans l'état concerné
(repos, survol, appui, focus, désactivé, mouvement réduit), sur la construction de production ; **R2**
toute exigence d'absence (anneau, effet, défilement) est un cas à part ; **R3** chaque phrase normative
de `20` §11 porte un identifiant de test ou figure en recette humaine ; **R4** chaque cas est vu rouge
sur le parent.

## Décisions du fondateur (2026-10-30)

| # | Écart | Décision |
|---|---|---|
| RK-1 | Ombre lumineuse du bouton principal | **Celle de la référence** : diffuse tout autour, plus forte au survol, absente sur un bouton désactivé (corrige C1) |
| RK-2 | Appui et survol | **Réduction à 98 % à l'appui**, **agrandissement à 103 %** au survol, sous `motion-safe:` (amende F6 « réduction à l'appui écartée ») |
| RK-3 | Bouton secondaire | **Texte en 600** ; contour `#78827d` gardé (F5) |
| RK-4 | Petits boutons des écrans du backoffice | **Sobres**, ni ombre ni agrandissement ; les boutons de connexion du backoffice gardent les effets |
| RK-5 | Familles des titres | **Tous les titres en Manrope**, à tailles fixes ; **surtitre créé** (corrige C3) |
| RK-6 | Graisse et approche | Titres **plus serrés**, **chiffres clés en 800**, sous-titres en 700, titre de page 800 inchangé |
| RK-7 | Rendu des polices | **Lissage** (`antialiased`) sous KEO seulement |
| RK-8 | Taille du texte | **Inchangée** : 16 px membres, 14 px backoffice, plancher 12 px |
| RK-9 | Halo d'en-tête | **Doux, sans bord, intensité de la référence**, un seul par page (corrige C2) |
| RK-10 | Cartes au survol | **Cartes cliquables seulement**, dont **le contour s'éclaircit** au survol |
| RK-11 | Badges | **Remplis** de teintes opaques, en Manrope gras ; texte du badge vérifié (F3) inchangé |
| RK-12 | Couleurs de rôle | **F4 maintenu** : point de rôle et rôle écrit, nom en `text-primary` |
| RK-13 | Cadre de focus | **Retiré sur un élément non interactif focalisé par programme** (titres, `main` cible du lien d'évitement) ; gardé sur tout bouton, lien, champ, onglet, région défilante (corrige C4) |
| RK-14 | Champs et focus | **Inchangés** : contour `border-strong`, anneau blanc (K18) |
| RK-15 | Tableau dense | **En-tête plus clair en Manrope 700** et **filet de 2 px `brand-primary`** sur la ligne survolée ou focalisée (corrige C5) |
| RK-16 | Lignes du tableau des inscrits sur 3 ou 4 lignes de texte | **Reporté au Lot 5** (décision ouverte ci-dessous) |
| RK-17 | Composants à venir (onglets de canaux, aparté, commission, vue identifiée) | **Spécification maintenue** (K6, K7, K15, K16, K17) |
| RK-A | Vert mélangé à de la transparence | **Autorisé, limité aux halos** : `color-mix(in srgb, var(--color-brand-primary) N%, transparent)` dans les seuls `--effect-action-glow*` et `--background-image-header-glow` du bloc KEO ; jamais un `--color-*`, un texte, un fond de carte ni un contour ; halo d'en-tête à 15 % au plus |
| RK-B | Fond du badge d'erreur | **Un fond rouge sombre opaque est créé** (seule valeur nouvelle du jalon) |
| RK-C | Cadre autour de `main` après « Aller au contenu » | **Retiré**, même règle que les titres |

## Arbitrages appliqués

| Sujet | Décision | Par |
|---|---|---|
| Correctif de C1 | Le token d'ombre **sort de l'espace `--shadow-*`** : `--effect-action-glow` et `--effect-action-glow-hover` dans `:root` (neutres, `0 0 transparent`, jamais `none`, qui invaliderait la liste de `box-shadow`), valorisés dans le bloc KEO, lus par `shadow-(--effect-…)`. `@utility` (collision de nom) et `@theme inline` (tout en dur, `02` §21.3 point 3) écartés | `architecte` |
| Halo d'en-tête | **Fond du conteneur d'écran**, plus de calque : `bg-header-glow` passe sur `SPACE_SCREEN_CLASSES` (web, donc aussi `SCREEN_CLASSES`) et `SCREEN_CLASSES` (backoffice) ; le `div` décoratif de `PageHeader` et `AUTH_GLOW_CLASSES` disparaissent. Un fond ne crée aucun défilement, ne recouvre rien et s'arrête avant la barre du bas ; dégradé transparent sur les côtés et en bas | `architecte`, préféré au calque débordant (`expert-ux`) |
| Halo des pages de travail du BO (ajout du fondateur, 2026-10-30, relecture « ux 6 ») | `bg-header-glow bg-no-repeat` et `min-h-(--size-header-glow)` aussi sur `MAIN_CLASSES` (le `<main>` du cadre, dont le `h1` n'est pas dans un `<header>`), livré avec RK-9 ; jamais sur `SMALL_SCREEN_CLASSES` (cadre masqué sous `bo-small:`) ni en double avec `SCREEN_CLASSES` ; TK2.1 à TK2.3 rejoués sur `/accueil` ; aucune valeur nouvelle, `tokens.css` inchangé | fondateur |
| Durée et courbe des boutons | **Inchangées** (120 ms, `ease-standard`) : 30 ms d'écart imperceptibles, et une durée redéfinie sur le conteneur KEO masquerait la mise à zéro de `prefers-reduced-motion` portée par `:root` | `chef-de-projet`, sur l'avis d'`expert-ux` |
| Approche serrée | Réservée aux titres d'au moins 20 px (`h1`, `h2`) : à 16 et 14 px en 700, −0,025 em colle les lettres | `expert-ux` |
| En-tête du tableau | `surface-hover` (`#232725`, `surface-3` de la référence) au lieu de `surface-raised` (1,09:1 contre les lignes, invisible) ; `text-sm` gardé (RK-8). Ligne survolée : `surface-raised` inchangé, plus le filet, pour rester distincte de l'en-tête | `expert-ux` ; survol : `chef-de-projet` |
| Filet de la ligne | Ombre intérieure de largeur constante sur la première cellule (`inset 2px 0 0`) : aucun décalage en `border-collapse`, et Safari ne dessine pas d'ombre sur un `tr` | `architecte`, `expert-ux` |
| Filet de sécurité « tous les titres en Manrope » | **Aucune règle CSS globale** : une règle `[data-theme="keo"]` hors du bloc de `tokens.css` tombe sous `findKeoBlocksOutside`. La preuve est le relevé TK3.1 sur chaque écran | `architecte` |
| Bouton texte | Graisse 600, sans agrandissement (cohérence avec RK-3) | `expert-ux` (micro-écart) |
| Anneau retiré | Sélecteur fermé `:where(h1, h2, h3, h4, main)[tabindex="-1"]:focus-visible`, **jamais** un `[tabindex="-1"]` générique (le tabindex itinérant des onglets de canaux garde son anneau). WCAG 2.4.7 vise les composants opérables au clavier ; l'annonce du lecteur d'écran reste | `architecte` |

## Valeurs et classes

Aucune autre valeur de couleur que RK-B. Tous les noms sont déclarés dans `@theme` ou `:root`
(gardes G3c), `tokens.css` reste **identique octet pour octet** dans les deux fronts.

| RK | Token (vitrine → KEO) | Classes, fichiers |
|---|---|---|
| 1 | `--shadow-action-glow` **supprimé** (`@theme` et bloc KEO). `:root` : `--effect-action-glow` et `--effect-action-glow-hover` = `0 0 transparent`. KEO : `0 0.25rem 0.875rem color-mix(in srgb, var(--color-brand-primary) 25%, transparent)` et `0 0.375rem 1.25rem color-mix(… 40%, transparent)` | Principal de `member/ui/button-classes.ts` et `PRIMARY_BUTTON_CLASSES` (BO `auth-classes.ts`) : `shadow-(--effect-action-glow) not-aria-disabled:hover:shadow-(--effect-action-glow-hover)` (BO : `not-aria-disabled:not-disabled:hover:`), `aria-disabled:shadow-none disabled:shadow-none` gardés |
| 2 | `--scale-hover` KEO 1.02 → **1.03** ; `--scale-press` *(nouveau, `@theme`)* 1 → **0.98** | Base des deux fichiers de boutons : `motion-safe:not-aria-disabled:active:scale-(--scale-press)` (BO : `not-disabled:` en plus) |
| 3 | `--font-weight-action-secondary` *(nouveau)* 500 → **600** ; `font-action` quitte la base pour les variantes `primary` et `danger` (sinon deux graisses sur une variante) | Variante `secondary` des membres, BO `SECONDARY_BUTTON_CLASSES` et `SMALL_SECONDARY_CLASSES` ; bouton texte en 600, sans `scale` |
| 4 | — | `SMALL_PRIMARY_CLASSES`, `SMALL_SECONDARY_CLASSES` sans ombre ni `scale`, figés par TK1.4 |
| 5 | Aucun token fluide sous KEO (G8 étendue, TK7.3) | Nouveau `member/ui/heading-classes.ts` : `SECTION_TITLE` = `font-display text-title-section font-bold tracking-heading` ; `CARD_TITLE` = `font-display text-md font-bold leading-snug` ; `OVERLINE` = `font-display text-xs font-bold uppercase tracking-overline text-text-secondary`, jamais vert. `bo-classes.ts` : `SECTION_TITLE` identique, `BLOCK_TITLE` = `font-display text-sm font-bold`. Remplacements : `h2` de `CodeNotReceived`, `CodeStep`, `EmailStep`, `MemberHome`, `PreferencesScreen` → `CARD_TITLE` ; titre de porte de `DoorStep` → `font-display text-title-section font-bold` ; phrase de `CodeStep` et `FreshCode` → `font-display text-title-section font-extrabold` ; `h3` de `HealthProcesses`, `HealthStatus`, `HomeScreen` → `BLOCK_TITLE` ; `tracking-wide` → `tracking-overline` ; `LegalMarkdown` rendu sous KEO sans token fluide |
| 6 | `--tracking-heading` KEO −0.01em → **−0.025em** | `PAGE_TITLE_CLASSES`, BO `TITLE_CLASSES`, `SECTION_TITLE` (h1, h2 seulement) ; chiffres clés en `font-extrabold` |
| 7 | — | Utilitaire `antialiased` sur `<div data-theme="keo">` de `app/[locale]/(member)/layout.tsx` et sur `<html data-theme="keo">` du backoffice ; propriété héritée, `html` et `body` de la vitrine inchangés |
| 9 | `--background-image-header-glow` KEO : `radial-gradient(ellipse 50% var(--size-header-glow) at 50% 0%, color-mix(in srgb, var(--color-brand-primary) 15%, transparent), transparent)`, `--size-header-glow` dans `:root` = **16 rem** (hauteur, tranchée par `expert-ux` au RK-0, bornée de 12 à 20 rem : sans bord dès 12 rem, nul avant la barre du bas à 375 px jusqu'à 20 rem ; calcul `20` §11.5) | `bg-header-glow bg-no-repeat` sur les conteneurs d'écran (voir Arbitrages) ; pic ≈ `#0d291d` sur `surface-page` |
| 10 | `--color-border-hover` *(nouveau, alias `text-secondary`, redéclaré sous KEO)* | `MEMBER_CLICKABLE_CARD_CLASSES` : `hover:border-border-hover`, contour au repos `border-strong` gardé (seul indice sur téléphone) |
| 11 | `--color-verified-bg` *(nouveau, alias `feedback-info-bg`, `KEO_INHERITS`)* ; `--color-badge-error-bg` *(nouveau, RK-B)* : **`#2e1213` confirmé** par `expert-ux` au RK-0 (teinte 358°, clarté 12,5 %, de la famille des fonds teintés ; `#ec5d5e` dessus : 0,3147 / 0,0606 = 5,19 ; absent de la liste des rouges D72), `KEO_INHERITS`, liste des rouges D72 identiques dans les deux fronts (G3b) | `status-badge-classes.ts` : succès, alerte, information `bg-feedback-*-bg` ; erreur `bg-badge-error-bg` ; neutre `bg-surface-raised` ; tous `font-display font-bold`. `VerifiedBadge.tsx` : `bg-verified-bg font-display font-bold`. `badge-error-bg` **confiné au badge** (garde de confinement, comme G3g) : jamais le fond d'une notice (D72, DZ-6) |
| 13 | — | Les deux `globals.css` : `:where(h1, h2, h3, h4, main)[tabindex="-1"]:focus-visible { outline: none; }` |
| 15 | `--effect-bo-row-indicator` *(nouveau, `tokens-backoffice.css`, `-bo-` obligatoire, G3f)* : `inset var(--border-width-thick) 0 0 var(--color-brand-primary)` | `TH_CLASSES` : `bg-surface-hover font-display font-bold text-sm text-text-secondary` ; `rowClasses` : au survol et en `focus-within`, `bg-surface-raised` et `shadow-(--effect-bo-row-indicator)` sur la première cellule ; 4 px reste réservé à la vue identifiée |

**Contrastes calculés** (`expert-ux`) : badges sur leur fond 7,91 (succès), 8,75 (alerte), 6,33
(information et vérifié), 8,69 (neutre), 5,19 (erreur sur `#2e1213`) ; intitulés d'en-tête de tableau
7,73 ; filet sur `surface-hover` 7,95 ; surtitre 10,08 / 9,45 / 8,69 (page, carte, surélevée) ;
contour de carte cliquable 4,66 au repos, 8,69 au survol ; au pic du halo : texte primaire 14,31,
secondaire 7,94, tertiaire 4,91, erreur 4,66, `border-strong` 3,91. **Paires interdites à ajouter à
`20` §11.4** : halo sur `surface-card` ou plus clair ; texte tertiaire ou d'erreur à moins de
`spacing-5` d'un bouton principal survolé ; surtitre ou badge en vert ; halo d'en-tête au-delà de 15 %.

## Amendements de spécification (commit RK-0, avant tout code)

- **`20` §11** (`expert-ux`) : §11.3 (`action-primary-bg-active` « réduction reprise à 98 % » ; nouveaux
  rôles `border-hover`, `verified-bg`, `badge-error-bg`) ; §11.4 (tableau des contrastes ci-dessus,
  paires interdites, halo sur la page seulement) ; §11.5 (« tous les titres, h1 à h4 » ; approche
  −0,025 em pour h1 et h2 ; ligne « titre de bloc dense BO » ; ligne « surtitre » ; montant de carte et
  chiffre clé en 800 ; graisse du secondaire 600 ; aucun token fluide sous KEO ; lissage ; valeurs des
  ombres et du halo et borne de `color-mix` ; mouvement `scale-hover` 1,03 et `scale-press` 0,98, jamais
  sur un bouton désactivé ni un petit bouton du BO) ; §11.6 (K8 intensités de la référence, K9 réduction
  reprise, `transition: all` toujours écarté, K10 surtitre `text-secondary`, K18 confirmé) ; §11.7
  (réduction reprise, parades ci-dessous) ; §11.8 (règle du focus « sur tout élément interactif, pas sur
  un élément non interactif focalisé par programme » ; bouton principal, secondaire, bouton texte,
  carte, badges, tableau dense, en-tête de page, nouvelle ligne « Surtitre »).
- **`02` §21** (`architecte`) : §21.3 point 3 (piège de l'espace `--shadow-*` et des modificateurs `/NN`,
  tokens `--effect-*`, borne de `color-mix`) ; §21.5 point 7 (réduction à l'appui reprise, lissage par
  utilitaire sur le conteneur, halo en fond du conteneur d'écran, règle du focus).
- **`18`** (`testeur`) : §5.1 (G3i et gardes TK7) ; §10 « Jalon RK » (critère de fin ci-dessous) ;
  §12 (familles TK1 à TK8) ; table de traçabilité `20` §11 → TK ou recette (R3).
- **`decisions.md`** : D75 (fait avec cette fiche). `pnpm docs:index` après chaque spécification modifiée.

## Tests (`testeur`)

E2e web dans un nouveau `apps/web/e2e/charter-rendering.spec.ts` (session semée, construction de
production) ; cas du backoffice dans `backoffice.spec.ts`. Lecture après la fin des animations
(`Promise.all(el.getAnimations().map((a) => a.finished))`) ; état appuyé par `mouse.down()`, lecture,
sortie de l'élément, `mouse.up()` (aucun clic).

| Famille | Cas | Mesure |
|---|---|---|
| TK1 Boutons | TK1.1 (RK-1) | `box-shadow` ≠ `none` au repos et porte la valeur calculée du vert ; différent et plus large au survol ; `none` sur `aria-disabled` et `disabled`, au repos et au survol |
| | TK1.2 (RK-2) | Ratio `getBoundingClientRect().width / offsetWidth` : 0,98 ± 0,01 à l'appui, 1,03 ± 0,01 au survol sous `no-preference` ; 1 sous `reducedMotion: reduce` et sur un bouton désactivé |
| | TK1.3 (RK-3) | `font-weight` 700 (principal) et 600 (secondaire, texte), membres et BO |
| | TK1.4 (RK-4) | Petits boutons du BO : `box-shadow: none`, ratio 1 dans les trois états (liste en données, entrée introuvable = échec) ; bouton standard du BO soumis à TK1.1 et TK1.2 |
| | TK1.5 | `border-radius` calculé d'une carte = 16 px sous KEO |
| TK2 Halo (RK-9) | TK2.1 | Le fond du conteneur porte le dégradé ; aucun ancêtre ne le tronque |
| | TK2.2 | Sonde de pixels (capture décodée par `createImageBitmap` et un canvas, sans nouvelle dépendance ; sinon `architecte` tranche) : écart de luminance ≤ 2/255 entre lignes à ± 4 px du bas de l'en-tête ; pixel sous le centre plus clair que la page d'un seuil posé par `expert-ux` : **de 16/255 à 25/255** de luma, au centre du conteneur à 4 px de son bord haut (attendu 23,4 ; `18` §12.6) ; négatif : le rectangle du parent dépasse le seuil |
| | TK2.3 | `scrollWidth ≤ innerWidth` à 320, 375 et 768 px (membres), 375 et 768 (BO), halo présent |
| TK3 Typographie | TK3.1 (RK-5) | Greffé sur les passes axe de `18` §12.2 : chaque `h1`–`h4` visible a pour première famille celle de `--font-display`, une taille de l'ensemble des `--text-*` KEO, identique à 375 et 1 440 px ; au moins un titre par écran |
| | TK3.2 | Surtitre : Manrope, 700, capitales, ≥ 12 px |
| | TK3.3 (RK-6) | `letter-spacing` d'un `h1`/`h2` = token, négatif ; chiffre clé 800 ; `h3`/`h4` 700 |
| | TK3.4 (RK-7) | `-webkit-font-smoothing: antialiased` sur le conteneur KEO, le `html` du BO et le dialogue des CGU ; `auto` sur le `body` de `/fr` et `/en` (assertion à part dans `vitrine-unchanged`) |
| TK4 Cartes, badges | TK4.1 (RK-10) | Luminance du contour d'une carte cliquable plus haute au survol, valeur = token ; carte non cliquable immobile |
| | TK4.2 (RK-11) | Fond du badge opaque et égal à un token ; Manrope ≥ 700 ; contraste ≥ 4,5 ; paires dans la matrice G3d ; texte présent (P7) |
| TK5 Focus (RK-13) | TK5.1 | Après navigation par clic, par `Entrée` et après le lien d'évitement : `activeElement` est le `h1` ou `main`, `outline-style: none` ; même cas au BO |
| | TK5.2 | Au `Tab`, lien, bouton, champ et région défilante gardent un anneau ≥ 2 px non masqué (TD5.4, jamais relâché) |
| TK6 Tableau (RK-15) | TK6.1 | Fond de `thead th` plus clair que les lignes ; Manrope 700 |
| | TK6.2 | Au survol et au focus clavier du lien d'une ligne : une ombre de 2 px de la couleur de `--color-brand-primary` sur la première cellule ; aucune au repos ni sur la ligne voisine |
| TK7 Gardes statiques | TK7.1 = **G3i** | (a) sur les sources : échec si le bloc KEO redéfinit un nom des espaces `--shadow-`, `--inset-shadow-`, `--drop-shadow-`, `--text-shadow-`, `--breakpoint-`, `--container-`, si `tokens.css` contient `@theme inline`, ou si un `color-mix` sort de la liste de RK-A ; (b) sur la construction (spec par front, feuilles servies) : tout utilitaire d'un token redéfini sous KEO lit `var(--nom)`, jamais la valeur vitrine. Auto-test : `.shadow-action-glow{--tw-shadow:none}` échoue, CSS minifié et CRLF compris ; token redéfini sans consommateur = échec sauf entrée justifiée |
| | TK7.2 | Toute classe littérale des fichiers de classes a une règle compilée (liste blanche justifiée) ; négatif : `tracking-wide` |
| | TK7.3 | Aucun `clamp(` ni `vw` dans les `--text-*` et `--tracking-*` effectifs sous KEO ; G8 refuse `text-display`, `text-heading-*`, `text-lead`, `text-figure-*` sous KEO |
| | TK7.4 | G8 : `motion-safe:…active:scale-(--scale-press)` accepté ; `active:scale-…` et `hover:scale-…` hors `motion-safe:` refusés |
| | TK7.5 | `badge-error-bg` consommé par le seul badge d'erreur ; aucune propriété de lissage déclarée dans `:root`, `html` ou `body` |
| TK8 Vitrine | TK8.1 | Fixture TD4 inchangée, G3e verte |
| | TK8.2 | Nouvelle fixture `vitrine-states.json`, prise **sur le parent de RK-1** : survol, appui et focus des boutons d'appel et d'une carte de la landing (`box-shadow`, ratio, `border-color`, `font-weight`, `-webkit-font-smoothing`, `transition-*`) ; prouve qu'aucun effet RK ne fuit par un composant partagé |

## Commits prévus

Petits commits sur `main`, Conventional Commits, vérification avant chaque commit (`CLAUDE.md` §7
règle 5, D76) avec les specs Playwright des écrans touchés, `pnpm test:e2e` complet au dernier commit,
push par lot. Une ligne par commit
dans `21` § Jalon RK. Exécution : `dev-react-node` ; gardes et filet : `testeur` ; relecture visuelle :
`expert-ux`. **Ordre : filet d'abord** ; chaque commit de correction retire le `test.fail()` de ses cas
(la CI rougit si on l'oublie) et relève les planchers.

| # | Commit | Livre | Prouve |
|---|---|---|---|
| RK-0 | `docs(mvp): amend the KEO charter for the RK milestone (D75)` | Amendements de `20` §11, `02` §21, `18` ; valeur de `badge-error-bg` confirmée | `pnpm format:check`, `pnpm docs:index` |
| RK-1 | `test(e2e): rendered-state safety net for the KEO charter` | Aides (attente des animations, sonde de pixels, relevé des titres), `vitrine-states.json` prise ici, cas TK1 à TK6 en `test.fail()` annotés « RK-n », auto-tests des gardes TK7 | Cas rouges sur le code actuel ; aucun code de production |
| RK-2 | `fix(ui): read the button glow through var() under KEO` | RK-1 et RK-A : tokens `--effect-action-glow*`, `--shadow-action-glow` supprimé, G3i (a), liste `color-mix` dans `charter-data.ts`, `member-ui.test.ts` mis à jour | TK1.1 vert dans les deux fronts ; TK8 vert |
| RK-3 | `test(guards): built CSS reads every KEO token through var()` | G3i (b), une spec par front | Négatif sur la règle fautive d'origine |
| RK-4 | `feat(ui): press, zoom and weights of the KEO buttons` | RK-2, RK-3, RK-4, bouton texte en 600 | TK1.2 à TK1.4, TK7.4 ; aucun défilement à 320 px avec un bouton pleine largeur à 103 % |
| RK-5 | `feat(ui): Manrope titles at fixed sizes, overline, tracking and smoothing` (scindable 5a membres / 5b BO) | RK-5, RK-6, RK-7 ; `heading-classes.ts`, remplacements, `LegalMarkdown`, G8 étendue | TK3, TK7.2, TK7.3, TK7.5 (lissage) ; axe |
| RK-6 | `feat(ui): soft header glow on the screen container` | RK-9, RK-A | TK2 ; contrastes au pic dans G3d |
| RK-7 | `fix(ui): no focus ring on titles and main focused by the app` | RK-13, RK-C | TK5.1, TK5.2 |
| RK-8 | `feat(ui): clickable card border and filled badges` | RK-10, RK-11, RK-B | TK4, TK7.5 (confinement) |
| RK-9 | `feat(backoffice): dense table head and row indicator` | RK-15 | TK6 |
| RK-10 | `docs(mvp): close the RK milestone` | `21` (une ligne), écarts `EC-RK-*`, traçabilité R3 sans ligne orpheline ; revue groupée | Revue `testeur` + `expert-cybersecurite` (non bloquante sur `main`, exigée avant `production`, D71) ; test du logo et recette |

## Critère de fin

- [x] `pnpm check` puis `pnpm test:e2e` verts trois fois de suite ; ajout de durée e2e ≤ 60 s ;
      planchers relevés à chaque commit qui ajoute des tests, aucun ne baisse (`check-case-floors` doit
      compter un `test.fail()` comme exécuté : à vérifier par `integrateur` au RK-1). *Attesté par le fondateur le 2026-10-31 (trois passages verts ; durées non relevées).*
- [x] e2e existants (`signup-nominal`, `journey-resume`, `landing-signup`, `account`, `account-data`,
      `backoffice.spec`, `security-headers`, `member-shell`, `charter-cascade`) verts **sans modifier
      leurs attendus**.
- [x] axe WCAG 2.1 AA + 2.2 AA sans violation aux largeurs de `18` §12.2 ; aucun défilement horizontal à
      320, 375 et 768 px.
- [x] **Vitrine inchangée** : G3e, TD4 et TK8.2 verts ; aucune requête tierce ni violation de CSP.
- [x] G3i (a) et (b) vertes avec leur cas négatif ; G1 à G9 jamais assouplies, sauf G8 étendue (TK7.3,
      TK7.4).
- [ ] Table de traçabilité `20` §11 → TK ou recette sans ligne orpheline (R3).
- [x] **Recette humaine** (fondateur, à 1 440 et 375 px) : bouton principal (repos, survol, appui,
      désactivé), halo d'en-tête sans bord, titres en Manrope, carte cliquable survolée, badges, ligne de
      tableau survolée, plus de cadre sur le titre ; **sur Mac** (RK-7), Safari et Chrome, avant/après de
      l'espace connecté et landing identique ; **test du logo** (`20` §11.7) refait par `expert-ux`.
      *Recette du fondateur attestée le 2026-10-31 ; test du logo (`expert-ux`) non attesté : reliquat `21` §8.*
- [x] Revue groupée `testeur` + `expert-cybersecurite` faite (attestation `bfb4b17`, 2026-10-30) ; `21` § Jalon RK à jour.

Non couvert, accepté : le rendu perçu (intensité, beauté), Safari et Firefox en automatique (e2e
Chromium seul), le survol tactile, un `p` stylé en titre hors `h1`–`h4`.

## Périmètre

| Dans le jalon | Hors du jalon |
|---|---|
| `tokens.css` des deux fronts, `tokens-backoffice.css`, les deux `globals.css`, les mises en page KEO | La **landing** et les **pages légales publiques** (G3e, TD4, TK8) |
| Primitives membres (`member/ui/*`), classes d'auth et de compte, classes du backoffice (`auth-`, `bo-`, `shell-classes.ts`) | Densité du tableau des inscrits (RK-16, Lot 5) |
| Écrans existants où un titre, un badge, une carte ou un bouton change de classe | Composants des Lots 3 à 5 (RK-17 : leur spécification ne bouge pas) |
| Gardes `packages/test-kit` (G3i, G8 étendue, confinement de `badge-error-bg`), e2e `charter-rendering`, fixture `vitrine-states.json` | Tailles du texte (RK-8), champs et anneau de focus (RK-14), couleurs de rôle (RK-12), durées et courbes |

## Agents et questions posées

| Ordre | Agent | Question |
|---|---|---|
| 1 | `expert-ux` | RK-0 : amendements de `20` §11, valeur de `badge-error-bg`, hauteur du halo (`--size-header-glow`) et seuil de TK2.2 |
| 2 | `architecte` | RK-0 : amendements de `02` §21 ; RK-1 : sonde de pixels sans dépendance nouvelle (sinon arbitrage) |
| 3 | `testeur` | RK-0 : `18` ; RK-1 : filet ; puis gardes au fil des commits |
| 4 | `integrateur` | RK-1 : `check-case-floors` et `test.fail()` |
| 5 | `dev-react-node` | RK-2 à RK-9 |
| 6 | `expert-ux` | Relecture visuelle à RK-4, RK-6 et RK-9, test du logo en fin de jalon |
| 7 | `testeur` + `expert-cybersecurite` | Revue groupée de fin de jalon (CSP inchangée, aucune requête tierce) |

`expert-conformite-rgpd` n'intervient pas : aucune donnée personnelle ni aucun texte juridique ne
change (`CLAUDE.md` §7 règle 5).

## Ce qui ne change pas

- Aucune règle de gestion, aucune route d'API, aucune migration, aucun texte métier ni aucune clé de
  traduction.
- D48 ; rouge « danger » opaque et identique entre les fronts (D72, G3b), notices d'erreur sans fond
  teinté ; violet réservé au backoffice ; succès `#3ccfcf` distinct de l'action ; la couleur ne porte
  jamais seule une information (`20` P7).
- Le vert reste rare : action principale, indicateur d'élément actif, sélection, filet de la ligne
  survolée ; jamais un texte courant, un montant, un état, un surtitre ni un badge.
- Le focus est toujours visible sur tout élément interactif ; le titre reçoit toujours le focus après
  une navigation (TD5.5), seul son cadre disparaît.
- Aucune API de stockage, aucun appel réseau hors du client d'API, CSP à nonce inchangée, polices
  servies par l'origine.

## Décisions ouvertes

| Sujet | Arbitre | Échéance |
|---|---|---|
| **RK-16** : lignes du tableau des inscrits sur 3 ou 4 lignes de texte (la cause sous chaque état de synchronisation, `05` RG99) ; une ligne par inscrit, cause seulement quand elle demande une action ? | `product-owner` + `expert-ux`, puis fondateur | Lot 5 |
| Sonde de pixels de TK2.2 sans dépendance nouvelle | `architecte` | RK-1 |
| `test.fail()` compté par `check-case-floors` | `integrateur` | RK-1 |

## Risques

| Risque | Parade |
|---|---|
| On reconnaît Spotify (zoom et réduction sur une pilule verte lumineuse = geste du bouton de lecture) | Jamais de bouton vert rond à icône seule, toujours verbe + objet ; halo au vert de marque, sous l'en-tête seulement, jamais sur une carte ; surtitre jamais vert ; commercial nommé et statuts datés visibles au premier écran de chaque espace ; test du logo en fin de jalon (`20` §11.7) |
| Contraste dégradé près du bouton survolé ou sous le halo | Paires interdites de `20` §11.4 ; halo ≤ 15 % ; pic composé dans G3d |
| Un autre token tombe dans le piège de l'inscription en dur | G3i (a) sur les sources et (b) sur la construction ; jamais de modificateur `/NN` sur une couleur |
| Un effet RK fuit vers la vitrine par un composant partagé | TK8.2 pris sur le parent de RK-1, TD4 et G3e |
| Bouton pleine largeur à 103 % sur un écran de 320 px | TK2.3 et la mesure de défilement de RK-4 |
| Mesures sensibles au moment (transitions) | Lecture après la fin des animations ; aucune attente fixe |

## Cas d'absence déclarés R2 (session RKT-2, revue de clôture)

Finding RKT-2 (`testeur`) : R4 (« chaque cas est vu rouge sur le parent ») ne peut pas s'appliquer à une
exigence d'absence que le parent tenait déjà. Ces cas sont des tests simples depuis RK-1 (`78fb02a`) ou
depuis leur commit ; ils sont déclarés R2, et la preuve que leur mesure voit le défaut vient d'un cas
positif rouge sur le parent qui lit la même propriété avec la même aide (`e2e/support/rendering.ts`), ou
d'un auto-test négatif. Le relevé de la session n'avait pas été écrit : tableau reconstitué le 2026-10-30
depuis `charter-rendering.spec.ts`, `backoffice.spec.ts`, `vitrine-unchanged.spec.ts` et le test-kit, à
RK-1 et à `43afefe`, chaque cas vérifié présent.

| Cas (spec) | Raison de l'absence de rouge sur le parent | Test de remplacement |
|---|---|---|
| TK1.1 « no glow on an unavailable primary button » (membres, `aria-disabled`) ; TK1.1 BO « no glow on a disabled or unavailable button » (`disabled` et `aria-disabled`) | Sur le parent, l'ombre ne s'affichait sur aucun bouton (C1, `--tw-shadow:none`) | TK1.1 « glows in the brand green » membres et BO (`test.fail` RK-2) : même `visibleShadows` du `box-shadow` calculé |
| TK1.2 « neither zoom nor press under reduced motion » (membres, BO) | Le zoom de F6 (1,02) était déjà sous `motion-safe:` | TK1.2 « grows to 1.03… shrinks to 0.98 » membres et BO (`test.fail` RK-4) : même `drawnRatio` ; TD5.7 |
| TK1.2 « neither zoom nor press on an unavailable button » (membres, `aria-disabled`) ; TK1.2 BO « on a disabled button » (`disabled`) | Le zoom du parent était déjà coupé par `not-aria-disabled:` (membres) et `not-aria-disabled:not-disabled:` (BO) | Même cas positif TK1.2 (RK-4) ; au BO, UX-2 lit aussi le ratio 1 des cinq classes désactivées |
| TK1.4 « the small buttons of the screens stay sober » (BO) | `SMALL_PRIMARY_CLASSES` et `SMALL_SECONDARY_CLASSES` n'avaient ni ombre ni `scale` : RK-4 confirme l'existant | TK1.1 et TK1.2 BO sur le bouton de connexion (RK-2, RK-4) : mêmes `expectNoGlow` / `expectGreenGlow`, `expectStill` / `expectZoomAndPress` |
| TK2.3 « no sideways scroll at 320, 375 and 768 px, the glow drawn » (membres) ; TK2.3 BO à 375 et 768 px (connexion, puis page de travail depuis RK-9) | Le calque du parent restait dans la boîte du `header` : aucun débordement | Condition « halo dessiné » du même cas (le cas n'est pas vide) ; aucun négatif de la mesure de défilement (donnée manquante 3) |
| TK1.2 « a full-width button hovered at 103 % does not scroll sideways at 320 px » (membres, ajouté par RK-4 `3e46a59`) | Écrit dans le commit qui pose le 103 % : pas de parent à 103 % | Le cas positif TK1.2 prouve que le 103 % est appliqué ; `boundingBox ≤ 320` dans le même cas |
| TK4.1 « a card that is not clickable stays still on hover » (membres) | La carte non cliquable n'avait déjà aucun effet au survol (seule `card-classes.ts` cliquable en portait) | TK4.1 « a clickable card lights its border up » (`test.fail` RK-8) : même lecture calculée de `border-top-color` |
| TK5.1 « after a click in the navigation / in the rail, the h1 focused without a ring » (membres, BO) | Chromium ne retient pas `:focus-visible` sur le `h1` après un pointeur (commentaire du spec) | TK5.1 à l'arrivée, après `Entrée` et après le lien d'évitement, membres et BO (`test.fail` RK-7) : même `outlineStyle` de `focusedElement` |
| TK5.2 BO « at Tab, a link, a button, a field and the region of a table keep a ring of 2 px » | L'anneau existait (C4 est un anneau de trop) : le cas garde que RK-7 ne l'enlève pas (jamais un `[tabindex]` générique) | TK5.1 BO rouges sur le parent (RK-7) : la même lecture d'`outline-style` y voyait l'anneau. Membres : TK5.2 = TD5.4 (`member-shell.spec`, `member-primitives.spec`), non doublé |
| TK6.2 « no row marked at rest, nor the neighbour of the hovered one » (BO) | Aucun filet sur le parent (C5) | TK6.2 au survol et au focus clavier (`test.fail` RK-9) : même `rowIndicators` |
| TK3.4 « /fr and /en keep the body unsmoothed (auto) » (`vitrine-unchanged`) | La vitrine n'a jamais été lissée | TK3.4 du conteneur KEO, du dialogue des CGU et du `html` du BO (`test.fail` RK-5a, RK-5b) : même propriété |
| TK8.2 « the states of the landing's calls to action and of a card are those of the parent of RK-1 » | Attendu pris sur le parent lui-même : vert par construction | Aucun requis : comparaison stricte au parent ; `vitrine-states.json` inchangé depuis `78fb02a` |
| Gardes TK7.3 (aucun `clamp(` ni `vw` dans les tokens sous KEO) et TK7.5 (aucun lissage sur `:root`, `html`, `body` ; `badge-error-bg` confiné), sur les sources des deux fronts | Sources déjà conformes au parent (`it` simples à RK-1 ; G3i a et G8 étendue étaient des `it.fails`) | Auto-tests négatifs de `packages/test-kit/tests/rendering-guards.test.ts` (« detects a clamp( or a vw… », « detects a smoothing… minified and with CRLF », « confines a token to its files… ») |

Hors tableau : membres, TK1.1 et TK1.2 sans `disabled` : aucun bouton membre ne porte `disabled`
(`Button.tsx`, `17` : « jamais un `disabled` muet ») ; le BO couvre les deux attributs.

**Données manquantes** (à trancher par `testeur`, aucune n'est corrigée ici) :

1. **Bouton texte sans agrandissement** (`20` §11.5) : ni cas rendu ni ligne en `18` §12.7. Membres : le
   seul test de classes `member-ui.test.ts` (« the text button still ») ; le parent zoomait pourtant le
   bouton texte (zoom dans la base des classes), le cas aurait donc été rouge. BO (`TEXT_BUTTON_CLASSES`) :
   aucun test.
2. **Absences portées par un cas positif**, pas par un cas à part : TK2.1 (un seul halo par page, aucun
   ancêtre qui le tronque, dans `expectWholeGlow`) ; TK2.3 BO page de travail (aucun halo à 375 px sur
   l'écran poste de travail) ; TK3.2 (surtitre jamais vert) ; badge jamais vert (`20` §11.4 (6)),
   seulement indirect par TK4.2 (fond égal à un token de la matrice).
3. **Mesure de défilement** (`scrollWidth − innerWidth`) : jamais vue rouge dans RK, sans auto-test négatif.
4. **Cas positifs verts sur le parent**, hors R2, R4 non tenue et non déclarée : TK1.3 « primary button in
   700 » (membres, BO), TK1.5 « rounded at 16 px » (membres, BO), TK3.3 « h1 tightened by
   --tracking-heading » (membres, BO), TK3.3 « a block title (h3) in 700 » (membres).
