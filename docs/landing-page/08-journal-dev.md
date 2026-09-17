# Landing page INFLUX : journal de développement (étape 5)

> Tenu par `dev-react-node`. Mis à jour à la fin de chaque phase. Une reprise repart d'ici.
> Commandes pnpm lancées sous la forme `corepack pnpm <commande>` (pnpm non activé sur le poste).
> Aucun commit, aucun push, aucun déploiement.

## Contexte de départ (2026-09-17, 07:03 UTC)

- Node v22.22.2, npm 10.9.7, corepack 0.34.6, branche `feat/landing-page`.
- `corepack pnpm --version` sans `packageManager` télécharge pnpm 12.4.2 : le champ
  `packageManager` du `package.json` racine épingle donc pnpm 11 (01 §3).
- Documents lus : CLAUDE.md, plan validé, 00 à 05, skills `design-system-influx` et `test-strategy`.
- Coordination : pour un texte présent dans 04 et 05 (ex. texte alternatif EN du hero), **04 fait foi**.

## Versions vérifiées au registre (07:03 UTC)

`minimumReleaseAge: 1440` (1 jour) : une version publiée depuis moins de 24 h est refusée.

| Paquet | Demandé (01 §8) | Retenu | Remarque |
|---|---|---|---|
| pnpm | 11 | 11.27.0 | 12.4.2 existe, hors décision D3 |
| next, eslint-config-next | 16.3.x | 16.3.5 | |
| react, react-dom | exigée par next | 19.3.0 | |
| next-intl | 4.x | 4.14.5 | |
| lucide-react | dernière stable | 1.46.0 | |
| typescript | 6.0.x | 6.0.3 | |
| @types/node | 22.x | 22.20.3 | |
| @types/react, @types/react-dom | alignées React | 19.3.0 | |
| tailwindcss, @tailwindcss/postcss | 4.3.x | 4.3.3 | |
| eslint | 9.x | 9.39.5 | |
| eslint-plugin-jsx-a11y | 6.x | 6.10.2 | |
| eslint-plugin-better-tailwindcss | dernière stable | 4.7.0 | |
| vitest | 4.1.x | 4.1.11 | 5.0 hors décision |
| prettier | 3.x | 3.9.6 | 3.9.7 publié il y a moins de 24 h |

## Phase 1 : socle monorepo (terminée)

**Fait**

- Racine : `.gitattributes` (`* text=auto eol=lf` + binaires), `.gitignore` (+ `next-env.d.ts`),
  `.node-version` (22), `.prettierignore`, `package.json` (scripts de 01 §9.1,
  `packageManager: pnpm@11.27.0`, `engines.node >=22.13.0`), `pnpm-workspace.yaml` (réglages de
  sécurité 01 §9.1), `tsconfig.base.json` (options strictes 01 §9.1).
- `apps/web` : `package.json` (versions exactes), `tsconfig.json` (`types: ["node"]`,
  `resolveJsonModule`, alias `@/*`), `next.config.ts` (`agentRules: false`,
  `poweredByHeader: false`), `postcss.config.mjs`, `vitest.config.ts`, `eslint.config.mjs` (§9.2),
  page minimale provisoire, test provisoire.

**Commandes et résultats**

| Commande | Résultat |
|---|---|
| `corepack pnpm install` | OK. pnpm a bloqué 3 scripts d'installation (`@parcel/watcher`, `@swc/core` via next-intl, `unrs-resolver`) : inscrits à `false` dans `allowBuilds` (01 §12) ; le build fonctionne sans eux |
| `corepack pnpm -r run typecheck` | OK |
| `corepack pnpm -r run lint` | OK |
| `corepack pnpm -r run build` | OK (Next.js 16.3.5, Turbopack) ; aucun `AGENTS.md` ni `CLAUDE.md` créé dans `apps/web` |
| `corepack pnpm -r run test` | OK |
| `corepack pnpm exec prettier --check .` | OK après `--write` sur 2 fichiers |
| Sonde ESLint (fichier temporaire supprimé) | 21 erreurs attendues : `next/link`, import du module fictif, `any`, `fetch`, `localStorage`, `document.cookie`, valeur arbitraire, `z-10`, opacité `/80`, `border` implicite, texte en dur, `<a>`, `href`, `alt` et `aria-label` littéraux, `style` |

**Écarts et frictions**

- Les scripts racine (`pnpm typecheck`, `pnpm check`…) appellent `pnpm`, absent du PATH tant que
  `corepack enable` n'est pas autorisé : dans cette session, j'appelle `corepack pnpm -r run <script>`
  (équivalent strict). Scripts de 01 §9.1 conservés sans modification.
- `react/jsx-no-literals` 7.37.5 ne sait pas cibler des attributs précis : les littéraux dans
  `alt`, `aria-label`, `aria-roledescription`, `title`, `placeholder` sont interdits par
  `no-restricted-syntax` (un `alt=""` vide reste permis pour les images décoratives).
- `no-restricted-classes` interdit aussi `border`, `outline`, `ring` implicites ou numériques
  (largeur de 1 px codée en dur par Tailwind) : les largeurs passent par
  `border-(length:--border-width-thin)`.
- `jsx-a11y` : jeu `recommended` appliqué par ses seules règles (le plugin est déjà enregistré par
  `eslint-config-next`, le réenregistrer provoquerait un conflit).

## Phase 2 : tokens, i18n, layout, bandeau, module fictif (terminée)

**Fait**

- `src/styles/tokens.css` : en-tête « PROVISOIRE (D6) » ; `@theme static` commençant par
  `--*: initial` ; toutes les valeurs de 03 et les 4 alias de 02 §2.9 ; bloc `:root` (z-index,
  durées, tailles, largeurs de bordure, focus, `header-height`, `measure-*`, `container-*`, points
  focaux d'images) ; surcharges responsives (`spacing-grid-gap`, `spacing-inset-card`,
  `header-height`) et `prefers-reduced-motion` (durées à `duration-instant`).
- `src/app/globals.css` : import Tailwind + tokens ; styles de base en `var(--…)` uniquement
  (focus visible, anneau inversé sur `[data-surface="inverse"]`, `scroll-padding`).
- i18n : `routing.ts` (`localeCookie: false`, `localeDetection: false`, FR par défaut),
  `navigation.ts` (seul `useRouter` exposé, pas de `Link`), `request.ts`, `messages.ts` (parité
  FR/EN par affectation croisée), `next-intl.d.ts` (clés typées), `src/proxy.ts`.
- `src/app/[locale]/layout.tsx` : `<html lang>`, métadonnées traduites, `robots` noindex/nofollow si
  `IS_MOCKUP`, `MockupBanner` premier élément du `<body>`, `NextIntlClientProvider messages={null}`
  (aucun message envoyé au navigateur ; le fournisseur sert au seul `useRouter` localisé).
- `src/content/landing-content.ts` (types, dont `CreatorCard` sans champ d'identité) ;
  `src/content/placeholders/index.ts` (`IS_MOCKUP`, `getPlaceholderContent(locale)`, textes FR/EN
  sous un même type, imports statiques des photos) ; `src/components/ui/icons.ts`.
- `landing.json` FR/EN, partie 1 (meta, common, header, hero à caseStudies).

**Commandes et résultats**

| Commande | Résultat |
|---|---|
| `corepack pnpm -r run typecheck` | OK |
| Sonde de parité (clé ajoutée au seul FR, puis restaurée) | `tsc` échoue (TS2719, clé nommée) : garde effective |
| `corepack pnpm -r run lint` | OK |
| `corepack pnpm -r run build` | OK : `/fr` et `/en` pré-rendues (SSG), proxy actif |
| Inspection du HTML pré-rendu | `<html lang="fr">` / `lang="en"`, `<meta name="robots" content="noindex, nofollow"/>` dans les deux langues, titre traduit, bandeau présent |

**Écarts et décisions**

- Espaces insécables FR (04 §0) : vrais caractères U+00A0 et U+202F dans les JSON et le module
  fictif (l’outil d’écriture convertit les séquences `\u00a0` en caractères). Contrôle par script
  Node (comptage des caractères) plutôt qu’à l’œil.
- Messages next-intl regroupés sous l'espace de noms `landing` (`t` de `landing.hero`…), pour
  accueillir d'autres fichiers au Lot 1.
- `container-max` et `container-narrow` placés dans `:root` et non dans `@theme` : la classe
  `max-w-max` existe déjà dans Tailwind (`max-content`) et aurait été ambiguë. Usage :
  `max-w-(--container-max)`.
- `space-inset-button` de 03 découpé en `--spacing-inset-button-y` et `--spacing-inset-button-x`.
- Largeurs de bordure (`border-width-*`) dans `:root` (Tailwind n'a pas d'espace de noms dédié).
- Points focaux d'images de 05 §4 (`center 35%`…) déclarés comme tokens `--image-focus-*` dans
  `tokens.css` : sinon il aurait fallu des valeurs arbitraires interdites.
- Texte alternatif EN de IMG-HERO-01 repris de 04 (fait foi), pas de 05.

## Phase 3 : photos et crédits (terminée, faite avant la fin de la phase 2)

Faite avant le module fictif, qui importe les photos statiquement.

- 31 photos téléchargées par `curl` (URL vérifiées de 05 §4, `w=1600`) dans
  `apps/web/src/content/placeholders/images/`, noms `img-<id>.jpg` : **31 réponses HTTP 200,
  `image/jpeg`, aucun échec**, 5,9 Mo au total. Rien dans `public/` (dossier inexistant).
- `CREDITS.md` : fichier, identifiant, auteur (profil), page source, licence Pexels, pour chaque
  photo. Auteur de IMG-CASE-01 repris tel quel de 05 (« Polina, profil polina-kovaleva »).
- Contrôle visuel rapide d'IMG-HERO-01 : aucun visage. Le contrôle complet des cadrages reste au
  `testeur` (05 §6).

## Phase 4 : en-tête et sections 1 à 8 (terminée)

**Fait**

- Primitives `src/components/ui/` : `class-names.ts` (`cn`), `Button.tsx` (toujours
  `type="button"`, variantes principale, secondaire, secondaire inversée, texte, texte inversé,
  icône), `SectionHeader.tsx`, `ResponsiveImage.tsx` (seule enveloppe de `next/image`, cadre au
  ratio final, `loading="eager"` + `fetchPriority="high"` pour IMG-HERO-01 seulement),
  `CreatorCard.tsx`, `CreatorCardGrid.tsx` (légende « vérifié » + mention fictive),
  `LanguageSwitcher.tsx`, `MarqueeCarousel.tsx`, `Carousel.tsx`, `Accordion.tsx`, `icons.ts`.
- `src/styles/image-sizes.ts` (valeurs `sizes`, exception G3 documentée).
- Blocs : `MockupBanner`, `SiteHeader` + `SiteHeaderMobileMenu`, `HeroSection`,
  `KeyFigureSection`, `CreatorShowcaseSection`, `FeaturedResultSection`, `BrandLogosSection`,
  `CaseStudiesSection`, `ProblemSection`, `MethodSection` ; `page.tsx` assemble dans l'ordre et
  n'affiche pas un bloc dont le contenu fictif manque (02 §2.8).
- `landing.json` FR/EN, partie 2 (problem à howItWorks).

**Commandes et résultats** : `typecheck`, `lint`, `build` OK. Contrôle du HTML pré-rendu :
« 1,240 contracts signed », « 10 k – 50 k abonnés » / « 10K–50K followers », « 3,6 % » / « 3.6% »,
« +0,9 pt en 3 mois » / « +0.9 pts in 3 months », « +38 % » / « +38% », « 1 sur 5 » / « 1 of 5 ».

**Écarts et décisions**

- `next/image` 16 : `priority` est déprécié ; `loading="eager"` + `fetchPriority="high"` (doc
  embarquée) pour l'image du hero.
- Gabarits `keyFigure.statement` et `creatorNetwork.countLabel` : balise de mise en forme
  `<highlight>#</highlight>` ajoutée autour du nombre (rendu `t.rich`) pour l'afficher en grand dans
  le même `<p>` ; **texte rendu identique à 04**.
- `Carousel.tsx` (section 6) et `MarqueeCarousel.tsx` (section 5) : deux fichiers au lieu d'un seul
  `Carousel.tsx` (01 §7), comportements trop différents pour un composant unique.
- Primitives ajoutées hors tableau 01 §7 : `class-names.ts`, `SectionHeader.tsx`,
  `CreatorCardGrid.tsx`, `MarqueeCarousel.tsx`.
- Pause du défilement des logos (survol, focus, bouton) : règle CSS de base dans `globals.css` sur
  des attributs `data-*` (`animation-play-state` n'a pas d'utilitaire Tailwind).
- Nouveaux tokens dérivés, sans nouvelle valeur visuelle : `--size-mobile-menu-max-height`
  (`100dvh - header-height`) et `--sticky-top-offset` (`header-height + space-6`).
- Sélecteur de langue : la langue choisie est mémorisée en mémoire vive (variable de module, jamais
  de cookie ni de stockage) pour rendre le focus au bouton après le changement de page.
- Carrousel : contrôles placés avant la piste dans le DOM (au-dessus à droite en desktop, sous la
  piste en mobile via `order`) ; compteur visible `aria-hidden` + zone `aria-live` mise à jour
  seulement après un clic sur précédent/suivant.

## Phase 5 : sections 9 à 16, pied de page, bannière cookies (terminée)

**Fait**

- Blocs : `CreatorNetworkSection`, `UseCasesSection` (ordre ugc, acquisition, productLaunch,
  awareness), `HowItWorksSection` (illustration 80 % `aria-hidden`), `PricingSection` (texte
  statique uniquement, barre décorative `aria-hidden`, légende, tableau `<caption>` / `th scope`,
  vérification étiquetée, notes, téléphone `aria-hidden` + `figcaption`), `WhyInfluxSection`,
  `FaqSection` (8 questions fermées au chargement), `FinalCtaSection` (fond sombre,
  `data-surface="inverse"`), `StartFormSection` + `StartFormSteps`, `SiteFooter`, `CookieBanner`.
- `src/components/ui/AudienceDoors.tsx` : paire « deux portes » partagée (hero, sections 11 et 15).
- `src/components/landing/start-form-validation.ts` : validation pure (étapes, premier champ
  invalide, changement de profil qui décoche le consentement marketing).
- `src/content/country-codes.ts` : 249 codes ISO 3166-1 alpha-2 ; noms produits côté serveur par
  `Intl.DisplayNames` dans la langue de la page, triés par `Intl.Collator` (parité FR/EN par
  construction, aucun pays marqué « ouvert »).
- `landing.json` FR/EN, parties 3 et 4 : **241 clés de chaque côté** ; script de contrôle de la
  typographie FR (aucune espace ordinaire avant `? ; ! % : € »`, ni entre milliers, ni apostrophe
  droite).
- `page.tsx` : ordre DOM bannière cookies, en-tête, `main` (sections 1 à 16), pied de page ; le
  bandeau Maquette vient du layout, avant tout.

**Commandes et résultats** : `typecheck`, `lint`, `build` OK (`/fr` et `/en` pré-rendues).

**Écarts et décisions**

- Clé ajoutée `landing.startForm.requiredMark` (« * ») : l'astérisque est ajouté par le composant
  (04 §0), il lui faut un texte traduit (règle « aucun littéral »).
- Liste des pays : source tranchée ici de façon conservatrice (codes ISO en dur + `Intl` côté
  serveur), 02 §4 point 4 la renvoyait à `architecte` : **à valider**.
- `aria-invalid` retiré des boutons radio du choix de profil (non pris en charge par le rôle
  `radio`, règle jsx-a11y) : l'erreur reste reliée par `aria-describedby` et signalée par bordure,
  icône et texte.
- Entrée dans un champ texte ou la liste des pays déclenche « Continuer » (gestionnaire `keydown`,
  aucun bouton `submit` dans le formulaire).
- Bannière cookies : hauteur mesurée à l'exécution (`ResizeObserver`) et exposée en variable CSS
  pour `scroll-padding-bottom` ; ni cookie ni stockage ; « Personnaliser » sans effet ; à la
  fermeture, focus sur le premier bouton visible de l'en-tête.
- FAQ : l'invite de contact est rendue deux fois (colonne gauche collante en desktop, après les
  questions en mobile), une seule est affichée et exposée à la fois (`display: none`).

## Phase 6 : tests de garde, contrôles finaux, audit (terminée)

**Fait**

- `apps/web/tests/guards.test.ts` : G1 (aucun `href=`, `mailto:`, `tel:`), G2 (aucune URL
  `http(s)://`), G3 (aucune couleur ni longueur littérale hors `tokens.css` et `image-sizes.ts` ;
  deux fichiers CSS seulement ; en-tête « PROVISOIRE (D6) » ; aucun `--color-*` dans
  `globals.css`), G4 (31 photos = 31 lignes de `CREDITS.md`, auteur, page Pexels, licence ; aucune
  photo dans `public/`), G5 (aucun `route.ts(x)`), G6 (`IS_MOCKUP` vaut `true`). Gardes ajoutées :
  parité des clés FR/EN, aucune API réseau ou de stockage, valeurs fictives (marques, e-mail,
  textes Maquette, conversation, mentions) absentes hors du module fictif, type `CreatorCard` sans
  champ d'identité, module fictif importé seulement par `layout.tsx` et `page.tsx`.
- `apps/web/tests/start-form-validation.test.ts` : 17 cas (profil requis, e-mail requis et mal
  formé, entreprise pour l'annonceur seulement, pays requis, majorité pour le créateur seulement,
  CGU requises et distinctes du consentement, consentement jamais pré-coché et décoché au
  changement de profil, ordre du premier champ invalide).
- Sonde de mutation (fichiers temporaires supprimés) : couleur, longueur, URL, `href=`,
  `localStorage`, marque fictive et `route.ts` font échouer 7 gardes.
- Prettier appliqué à tout le monorepo (hors `docs/`, `.claude/`, `CLAUDE.md`, verrou).

**Commandes et résultats (état final, 2026-09-17)**

| Commande | Résultat |
|---|---|
| `corepack pnpm exec prettier --check .` | OK |
| `corepack pnpm -r run typecheck` | OK |
| `corepack pnpm -r run lint` (`--max-warnings 0`) | OK, 0 erreur, 0 avertissement |
| `corepack pnpm -r run test` | OK, 2 fichiers, 33 tests |
| `corepack pnpm -r run build` | OK, `/fr` et `/en` pré-rendues (SSG), proxy de langue |
| `corepack pnpm audit --audit-level high` | « No known vulnerabilities found » |
| Inspection du HTML pré-rendu (FR et EN) | bandeau `aside` > bannière cookies > `header` > `main` (16 sections dans l'ordre de CA1) > `footer` ; 1 seul `h1` ; 0 `<a>`, 0 `href=` dans le corps ; `form` sans `action` ; tous les boutons `type="button"` ; robots `noindex, nofollow` ; 31 images dont 21 à `alt=""` ; aucune référence ARIA orpheline ; aucun id dupliqué ; seule URL : l'espace de noms `http://www.w3.org/2000/svg` des icônes |
| CSS généré | aucun token Tailwind par défaut (`--color-red-500`, `--spacing`, `--font-sans` absents) ; keyframes `marquee`, règles `prefers-reduced-motion` et pause présentes |

**Remarque git (lecture seule)** : `.gitattributes` (`eol=lf`) signale que
`.claude/agents/expert-ux.md`, modifié hors de cette étape, sera normalisé en LF au prochain
commit. Aucun commit, push ni déploiement effectué.

## Bilan et reste à faire

**Non couvert par cette étape (vérifications du `testeur`, étape 6)** : captures 375 et 1440 px en
FR et EN, test des 10 secondes, navigation clavier complète, contrôles axe ou Lighthouse, onglet
réseau et stockage pendant le parcours du formulaire, absence de défilement horizontal de 320 à
1440 px, contrôle visuel des cadrages d'images (05 §6), recomptage automatique des longueurs Max.
Aucun serveur n'a été lancé (consigne) : le comportement client (menu mobile, carrousels,
accordéons, formulaire, bannière, changement de langue) n'a été vérifié que par typecheck, lint
et build.

**Points à faire valider**

| Point | Par qui |
|---|---|
| Source des noms de pays (codes ISO en dur + `Intl.DisplayNames` côté serveur) | `architecte` |
| Primitives et fichiers ajoutés hors 01 §7 (`class-names.ts`, `SectionHeader`, `CreatorCardGrid`, `AudienceDoors`, `MarqueeCarousel`, `country-codes.ts`, `start-form-validation.ts`) | `architecte` |
| Tokens ajoutés ou adaptés : `--spacing-inset-button-x/-y`, `--image-focus-*`, `--size-mobile-menu-max-height`, `--sticky-top-offset`, `container-*` et `border-width-*` dans `:root` | `expert-ux` |
| Balise `<highlight>` dans deux gabarits ICU et clé `startForm.requiredMark` | `expert-marketing` (texte rendu inchangé) |
| Absence d'`aria-invalid` sur les radios du profil ; invite de contact FAQ rendue deux fois | `expert-ux`, `testeur` |
| Scripts racine qui appellent `pnpm` : fonctionnent seulement après `corepack enable pnpm` | Fondateur |

## Corrections après 09 et 10 (2026-09-17)

**Cause racine (09 A1, A3 ; 10 #1 à #3, #10).** `cn()` joint les classes sans résoudre les
conflits. Choix : **aucune nouvelle dépendance** (pas de `tailwind-merge`) ; règle d'usage « une
primitive n'impose ni largeur ni `white-space` que l'appelant peut surcharger », appliquée et
couverte par la garde G7.

| Anomalie | Correction | Fichiers |
|---|---|---|
| 09 A1/A3, 10 #1 | `w-full` retiré de la base de `ResponsiveImage` ; chaque appelant fixe sa largeur (`w-full`, `w-1/3 sm:w-full`, `w-9/12`). Carte 375 px : image 114 px, texte visible. `sizes` inchangé (`33vw` sous `sm` correspond désormais à la largeur réelle, image 256 px chargée) | `ui/ResponsiveImage.tsx`, 9 sections, `ui/CreatorCard.tsx` inchangé |
| 09 A2 | Règle de pause sortie de `@layer base` (styles hors calque, prioritaires sur `utilities`). Bouton, survol et focus figent la piste ; reprise ensuite. `motion-reduce:animate-none` ajouté sur la piste | `app/globals.css`, `ui/MarqueeCarousel.tsx` |
| 10 #2 | Corrigé par #1 (image à 9/12, carte de conversation qui chevauche, capture 1440 px) | — |
| 10 #3 | `whitespace-nowrap` et taille de texte retirés de la classe commune ; grille en mouvement réduit : 2 colonnes sous `sm` (3 ensuite, 5 dès `lg`), `text-md` sous `sm`, `wrap-break-word` en sécurité. Plus de défilement à 320/375 px | `ui/MarqueeCarousel.tsx` |
| 10 #4 | Voile en `-z-(--z-raised)` dans le contexte d'empilement de l'en-tête (sous la barre, au-dessus de la page) ; rangée de la barre en `bg-surface-page`. FR/EN et `[✕]` cliquables menu ouvert (vérifié par `elementFromPoint` et clic EN) | `landing/SiteHeaderMobileMenu.tsx`, `landing/SiteHeader.tsx` |
| 10 #5, #6 | CTA `w-full sm:w-auto` | `landing/ProblemSection.tsx`, `landing/CreatorNetworkSection.tsx` |
| 10 #7 | Carte desktop : `lg:inset-x-page-gutter lg:mx-auto lg:max-w-(--container-max)` (marges 38 px à 1100 px) | `landing/CookieBanner.tsx` |
| 10 #8 | `gap-stack-sm sm:gap-3` | `ui/AudienceDoors.tsx` |
| 10 #9 | Nouveau token dérivé `--size-carousel-slide: calc(100% - var(--spacing-7))`, à toutes les largeurs | `styles/tokens.css`, `ui/Carousel.tsx` |
| 09 A5 | Région du carrousel nommée par `aria-label={roleDescription}` (prop `labelledBy` supprimée) ; axe : 0 violation à 375 et 1440 px | `ui/Carousel.tsx`, `landing/CaseStudiesSection.tsx` |
| 09 A6 | Bannière mobile compactée (titre `text-sm`, `py-3`, espacements réduits) : 242 px de haut à 375×667. Refuser reste au même niveau qu'Accepter. Un essai à 3 boutons sur une ligne a été abandonné (« Personnaliser » déborde à 320 px). **Non résolu** : à 1440×900 et 375×667 la bannière couvre encore les deux portes du hero | `landing/CookieBanner.tsx` |
| 09 A9 | Exemples neutres dans les commentaires | `content/landing-content.ts` |
| 10 #10 | Garde G7 : pas deux largeurs ou deux `white-space` à la même variante dans une liste de classes ; pas de largeur ni `white-space` dans la base d'une primitive `ui/` qui accepte `className` (sauf classe optionnelle `x && "w-full"`) ; auto-test du détecteur. Limite : ne voit pas les conflits passant par une fonction (ex. `logoClassName`) ni les autres groupes (taille de texte) | `tests/guards.test.ts` |

Non traités (hors périmètre ou en attente) : A4 (photos IMG-CASE-03/05, conformité), A7 (menu
non refermé au clic d'une entrée, `expert-ux`), A8 (« Voir la vidéo »).

**Vérifications** : prettier, typecheck, lint, 36 tests (3 nouveaux), build : verts. Serveur de
production relancé puis arrêté (port 3000 libre). Scripts du testeur : `screens.mjs` (0 défilement
horizontal de 320 à 1440 px en FR/EN, ordre OK, axe vide), `mq.mjs`, `card.mjs`, `interact.mjs`,
`keyboard.mjs` ; ajoutés : `verify-fix.mjs`, `hover.mjs`, `over.mjs`. Captures `fix-*.png`.

**Points à valider** : absence de `tailwind-merge` et garde G7 (`architecte`) ; token
`--size-carousel-slide`, grille réduite à 2 colonnes et `text-md` sur mobile, bannière compactée
et recouvrement du hero restant (`expert-ux`).
