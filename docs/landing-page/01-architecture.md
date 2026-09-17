# Landing page INFLUX : architecture et socle technique

> **Statut :** étape 2 du plan validé par le fondateur le 2026-09-16. Décisions D1, D3, D4 et D28
> tranchées par `architecte` (D4 conjointement avec `expert-ux`, qui confirme la correspondance des
> tokens à l'étape 6).
> **Portée :** socle **définitif** du front public, réutilisé au Lot 1. Les choix sont faits pour tout
> le MVP (app membres, API, backoffice), pas pour la seule page.
> **Sources :** `CLAUDE.md` (prime en cas d'écart), `docs/cadrage-mvp.md`, `00-cadrage.md` (CA1 à
> CA28). Versions des outils vérifiées le 2026-09-16 (liens en fin de document).
> **Destinataires :** `dev-react-node` (étape 5), `testeur` et `expert-ux` (étape 6), `integrateur`
> (CI et Railway au Lot 0).

---

## 0. Synthèse

| Sujet | Décision | Réversibilité |
|---|---|---|
| **D1** Framework React | **Next.js 16.3** (App Router), pages publiques pré-rendues par langue, servies par Node.js | Moyenne |
| **D3** Dépôt | **Monorepo pnpm 11** (activé par corepack) : `apps/*`, `packages/*`, sans outil d'orchestration | Élevée |
| **D4** UI et styles | **Tailwind CSS 4.3** alimenté **uniquement** par `apps/web/src/styles/tokens.css` ; aucune bibliothèque de composants ; primitives « headless » choisies au premier besoin réel (Lot 1) | Moyenne |
| **D28** Traduction | **next-intl 4** ; messages JSON ICU dans `apps/web/src/locales/{fr,en}/landing.json` ; parité des clés FR/EN vérifiée à la compilation | Moyenne |
| Contenu fictif (CA15) | Un seul module `apps/web/src/content/placeholders/` (données, textes FR/EN, photos, crédits), importable seulement par le layout et la page | Élevée |
| Maquette (CA13, CA14) | Constante unique `IS_MOCKUP` dans ce module : bandeau + `<meta name="robots" content="noindex, nofollow">` | Élevée |
| Ressources tierces (CA11) | Aucune : police système ou auto-hébergée (`next/font/local`), images locales, aucun script externe | Élevée |
| Qualité | TypeScript 6.0 strict, ESLint 9, Prettier, Vitest 4 ; contrôles automatiques pour CA6, CA8, CA11, CA13, CA15, CA17, CA22, CA23, CA26, CA27 | Élevée |
| Variables d'environnement | **Aucune** introduite (skill `env-secrets` consultée) : pas de `.env.example` | — |

---

## 1. Contraintes qui pilotent les choix

1. **Référencement bilingue au Lot 1** : chaque langue doit recevoir un HTML complet dès la première
   réponse (titre, description, `lang`, liens de langue alternatifs, aperçus de partage).
2. **Même socle pour la suite** : app membres (Lots 2 à 4), API Node (D2), backoffice (D12 reste
   ouverte), migrations Supabase.
3. **Stack imposée** (React/TS, Node/TS, Railway) : critère éliminatoire.
4. **Tout le style par tokens**, contrôlable par recherche textuelle (CA22).
5. **Aucun texte en dur**, clés FR/EN identiques et vérifiables (CA23) ; **fictif isolé et
   supprimable** (CA15).
6. **Maquette sans effet réel** : aucun lien, aucune requête, aucun stockage, aucune ressource tierce
   (CA6, CA8, CA11).
7. **Petite équipe, agents IA, poste Windows** : peu de pièces, outils standard, mêmes commandes sur
   le poste et en CI.
8. **Commission** : le calcul n'existe que dans le domaine `billing` de la future API. La page
   n'affiche que du texte.

---

## 2. D1 : framework React

### Contexte

La page d'accueil est la porte d'entrée des leads du Lot 1, en français et en anglais, pour toutes
les zones visées. Un moteur de recherche ou un aperçu de partage (LinkedIn, WhatsApp) doit recevoir
une page complète dans la bonne langue sans exécuter de JavaScript. Le même framework portera
ensuite l'app membres.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| A. Vite + React (SPA) | Modèle simple, build rapide, hébergement statique, aucune surface serveur | HTML vide avant exécution du JavaScript : référencement et aperçus de partage dégradés ; pré-rendu par langue à assembler avec des extensions non standard |
| B. Next.js (App Router) | Pré-rendu statique par langue ; API de métadonnées (robots, langues alternatives, Open Graph) ; polices et images optimisées sans service tiers ; next-intl mûr ; exécution Node standard sur Railway ; documentation embarquée par version | Plus complexe (composants serveur et client) ; versions majeures fréquentes ; failles sérieuses passées (contournement du middleware CVE-2025-29927 en mars 2025, exécution de code à distance via React Server Components CVE-2025-55182 en décembre 2025) qui imposent une discipline de mise à jour ; tentation d'y loger de la logique serveur |
| C. React Router 7, mode framework (Vite) | Rendu serveur et pré-rendu, plus léger que Next.js | Écosystème de traduction plus mince ; l'équipe Remix a annoncé que Remix 3 ne reposerait plus sur React : incertitude stratégique |
| D. Astro + îlots React | Excellent pour des pages marketing statiques | Pages écrites en `.astro`, pas en React (écart avec la stack imposée) ; deux frameworks dès l'app membres |

### Grille

| Critère (poids) | A. Vite SPA | B. Next.js | C. React Router 7 | D. Astro |
|---|---|---|---|---|
| Stack imposée et Railway (éliminatoire) | Oui | Oui | Oui | Discutable |
| Coût de sortie (fort) | Faible | Moyen | Moyen | Élevé pour l'app membres |
| Simplicité pour une petite équipe (fort) | Élevée | Moyenne | Moyenne | Moyenne (deux modèles) |
| Sécurité (fort) | Aucune surface serveur | Surface serveur à tenir à jour | Surface serveur | Faible surface |
| Référencement bilingue (exigence du Lot 1) | Insuffisant | Très bon | Bon | Très bon |
| Maturité (moyen) | Élevée | Élevée | Moyenne | Élevée |

### Décision

**B. Next.js 16.3, App Router.** Les pages publiques sont pré-rendues au build pour chaque langue
(`/fr`, `/en`) et servies par `next start`.

Garde-fous qui font partie de la décision :

- `apps/web` **rend des pages** ; il ne contient **ni logique métier ni secret**. Pas de Server
  Actions ni de Route Handlers dans `apps/web` à ce stade. La logique serveur (dont `billing` et
  `leads`) vivra dans l'API Node (D2). Toute exception au Lot 1 (par exemple la gestion de session
  Supabase) passe par `architecte` et `expert-cybersecurite`.
- Le `proxy` Next.js (ancien middleware) ne sert **jamais** à autoriser un accès : il ne gère que la
  langue.
- Aucun drapeau expérimental (`cacheComponents`, compilateur React, etc.).
- Version de `next` épinglée ; correctifs de sécurité appliqués dès leur publication (veille
  automatisée mise en place par `integrateur` au Lot 0).

### Conséquences

- **Code** : conventions Next confinées à `src/app/`, `src/proxy.ts`, `src/i18n/`, `src/app/fonts.ts`
  et `src/components/ui/ResponsiveImage.tsx`. Les sections sont des composants React ordinaires.
- **Déploiement** : un service Node sur Railway (`next build` puis `next start`), configuré par
  `integrateur` avec l'accord du fondateur.
- **Coûts** : aucune licence ; un service Railway léger.
- **Sécurité** : surface serveur à maintenir à jour ; en-têtes de sécurité et CSP définis avec
  `expert-cybersecurite` avant toute mise en ligne.

### Si l'on se trompe

Si Next.js s'avère trop lourd pour l'app membres ou le backoffice, ceux-ci peuvent devenir une autre
application du monorepo (Vite par exemple) sans toucher aux pages publiques.

### Réversibilité

**Moyenne.** Porter la landing vers un autre framework React coûte quelques jours (routes, traduction,
images) ; le coût augmente avec les Lots 2 à 4.

---

## 3. D3 : structure du dépôt et gestionnaire de paquets

### Contexte

Viendront l'API Node (D2), l'app membres, le backoffice (D12 : application séparée ou espace
protégé), des types partagés entre API et fronts (contrats d'API, statuts), les migrations Supabase.
Une équipe, une CI, des revues par Pull Request.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| A. Monorepo, espaces de travail pnpm, sans orchestrateur | Une PR pour un changement transverse ; types partagés sans publication ; une CI ; Railway détecte les monorepos pnpm | Frontières entre applications à faire respecter en revue |
| B. Monorepo + Turborepo ou Nx | Cache et graphe de tâches | Inutile avec une ou deux applications ; ajoutable plus tard sans restructurer |
| C. Multi-repo (web, api, backoffice) | Isolation forte | Contrats d'API à versionner et publier, CI et secrets dupliqués, PR multiples : coûteux pour une petite équipe |

### Décision

**A. Monorepo `apps/*` + `packages/*`, géré par pnpm 11, activé par corepack** (fourni avec Node 22).

| Emplacement | Rôle | État |
|---|---|---|
| `apps/web` | Pages publiques ; l'app membres y est **proposée** par défaut au Lot 2 (à confirmer alors) | Créé à l'étape 5 |
| `apps/api` | API Node (D2) : domaines `identity`, `billing`, `leads`, etc. | Réservé, non créé |
| `apps/backoffice` **ou** un espace de `apps/web` | Backoffice : la structure accepte les deux, **D12 reste ouverte** (l'isolement d'une surface privilégiée sera un critère) | Réservé, non créé |
| `packages/*` | Code réellement partagé (probablement les contrats d'API au Lot 1) | Créé au premier besoin réel |
| `supabase/` | Migrations versionnées (`expert-database`, D5) | Réservé, non créé |

**Pourquoi pnpm plutôt que npm.** npm est déjà installé, mais pnpm 11 protège par défaut contre les
paquets compromis (vagues d'attaques de 2025) :

- délai minimal d'un jour avant d'installer une version fraîchement publiée (`minimumReleaseAge`) ;
- scripts d'installation des dépendances bloqués sauf autorisation explicite (`strictDepBuilds`,
  `allowBuilds`) ;
- sous-dépendances de source exotique refusées (`blockExoticSubdeps`) ;
- impossible d'utiliser une dépendance non déclarée.

npm 10.9.7 (poste actuel) n'a pas de délai minimal (il faut npm 11.10 ou plus, donc une installation
aussi). `pnpm audit` fonctionne en version 11 ; les versions 10 sont cassées depuis que le registre
npm a retiré ses anciens points d'accès d'audit.

### Conséquences

- **Fichiers racine** : `package.json` (privé, scripts, `packageManager`, `engines`),
  `pnpm-workspace.yaml` (paquets et réglages de sécurité), `pnpm-lock.yaml`, `tsconfig.base.json`.
- **Poste** : `corepack enable pnpm` une fois (§10). Cette commande modifie l'installation Node de la
  machine : **accord du fondateur requis**.
- **Railway (plus tard)** : service `web` construit depuis la racine avec
  `pnpm --filter @influx/web build` et `pnpm --filter @influx/web start` ; chemins surveillés
  `apps/web/**`, `packages/**`, `pnpm-lock.yaml`.
- **CA27** cite `npm audit` : l'équivalent est `pnpm audit --audit-level high` (il n'y aura pas de
  `package-lock.json`).
- **Node** : `engines.node` à `>=22.13.0` et `.node-version` à `22` (poste actuel). Passage à Node 24
  LTS à planifier par `integrateur` avant la première mise en ligne (fin de support de Node 22 :
  30 avril 2027).

### Si l'on se trompe

Retour à npm en quelques heures : supprimer `pnpm-workspace.yaml`, déclarer `workspaces` dans
`package.json`, régénérer le verrou. Une scission en plusieurs dépôts reste possible plus tard.

### Réversibilité

**Élevée.**

---

## 4. D4 : styles, UI et tokens (avec `expert-ux`)

### Contexte

La charte noir/vert est provisoire (D6). Tout le style passe par des tokens nommés par rôle, avec
contrôle par recherche (CA22). La page contient accordéons, carrousels, menu mobile, formulaire en
étapes et bannière. Plus tard viendront l'app membres et un backoffice dense (tableaux, filtres,
sélecteur de pays).

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| A. Bibliothèque de composants thémée (MUI, Mantine, Chakra) | Beaucoup de composants prêts | Système de tokens propre à la bibliothèque, valeurs internes hors de notre contrôle, rendu générique difficile à amener au niveau de wekollab, dépendance lourde et difficile à retirer |
| B. Tailwind CSS v4 alimenté uniquement par nos tokens, sans bibliothèque de composants | Tokens déclarés dans **un seul fichier CSS** ; le thème par défaut effacé, **seules nos valeurs existent** ; points de rupture, focus, `prefers-reduced-motion` et états ARIA exprimés avec les tokens ; pas de fichier CSS par composant ; classes inconnues et valeurs arbitraires détectées automatiquement | Classes dans le JSX (sortie coûteuse) ; préfixes de nommage imposés par Tailwind ; discipline contre les valeurs arbitraires |
| C. CSS Modules + variables CSS | Zéro dépendance, CSS standard, sortie quasi gratuite | Une variable CSS ne peut pas servir dans une media query : points de rupture écrits en dur dans chaque fichier, ou extensions PostCSS en plus ; un fichier CSS par composant ; contrôle des valeurs en dur à outiller (Stylelint et une extension) |
| D. shadcn/ui (Radix + Tailwind copiés dans le dépôt) | Composants accessibles prêts pour le backoffice | Prématuré pour la landing ; apporte Radix et une esthétique par défaut ; compatible avec B, donc adoptable plus tard |

### Décision

**B. Tailwind CSS 4.3, aucune bibliothèque de composants.** Les primitives accessibles « headless »
(candidats : React Aria Components, Radix) seront choisies au premier composant qui le justifie
(probablement le sélecteur de pays de l'inscription au Lot 1). La landing n'en a pas besoin :
accordéons, carrousels, menu et formulaire s'écrivent avec des éléments HTML natifs.

### Mécanisme de tokens

- **Fichier unique** `apps/web/src/styles/tokens.css`, qui commence par le commentaire
  `PROVISOIRE (D6)`. Il contient :
  1. un bloc `@theme` qui commence par `--*: initial;` (efface tout le thème par défaut de Tailwind),
     puis nos tokens ; chaque token devient une variable CSS **et** des classes utilitaires ;
  2. si nécessaire, un bloc `@theme inline` pour une police chargée par `next/font/local` ;
  3. si nécessaire, un bloc `:root` pour les tokens sans espace de noms Tailwind (z-index, durées
     particulières), utilisés avec la syntaxe `z-(--z-header)`.
- `apps/web/src/app/globals.css` importe Tailwind puis `../styles/tokens.css`, et ne contient que des
  styles de base écrits avec `var(--…)`.
- Les composants se stylent **uniquement** par classes utilitaires issues des tokens.
  - **Interdits** : attribut `style` ; valeurs arbitraires entre crochets (`p-[13px]`,
    `bg-[#00ff00]`) ; valeurs numériques nues pour les longueurs, couleurs, opacités, durées et
    z-index (`z-10`, `duration-300`, `opacity-50`, `bg-action-primary/80`).
  - **Autorisés** : comptes et fractions de mise en page (`grid-cols-3`, `col-span-2`, `w-1/2`),
    variables de tokens entre parenthèses (`z-(--z-header)`).

### Correspondance des familles d'`expert-ux` vers Tailwind

Le **nom de rôle** choisi par `expert-ux` est conservé ; seul le **préfixe** suit l'espace de noms
Tailwind.

| Famille (`03-tokens-provisoires.md`) | Variable dans `tokens.css` | Exemple de classe |
|---|---|---|
| Couleur (marque, texte, surface, bordure, sémantique) | `--color-<rôle>` | `bg-action-primary`, `text-text-primary`, `border-border-default` |
| Famille de police | `--font-<rôle>` | `font-body` |
| Taille de texte et interligne associé | `--text-<rôle>`, `--text-<rôle>--line-height` | `text-heading-1` |
| Graisse | `--font-weight-<rôle>` | `font-strong` |
| Interligne seul, approche | `--leading-<rôle>`, `--tracking-<rôle>` | `leading-relaxed` |
| Espacement | `--spacing-<pas>` (ne **pas** déclarer la base `--spacing`) | `p-md`, `gap-lg` |
| Rayon | `--radius-<rôle>` | `rounded-card` |
| Élévation | `--shadow-<rôle>` | `shadow-raised` |
| Point de rupture | `--breakpoint-<nom>` | `md:` |
| Largeur de contenu | `--container-<nom>` | `max-w-content` |
| Mouvement | `--ease-<nom>`, `--animate-<nom>`, `--default-transition-duration` | `ease-standard` |
| Hors espaces de noms (z-index, anneau de focus…) | `:root { --<rôle>: … }` | `z-(--z-header)` |

Si les pas d'espacement sont numérotés (`--spacing-4`), seuls les pas déclarés existent. Les
couleurs de texte donnent des classes doublées (`text-text-primary`) : `expert-ux` peut préférer
`--color-fg-<rôle>` ; ce choix de nom n'a aucun impact d'architecture.

### Conséquences

- **Code** : une évolution de la palette (D6) ne touche que `tokens.css`.
- **Déploiement et coûts** : CSS généré au build, rien à l'exécution.
- **Sécurité** : aucun impact.
- **UX** : `expert-ux` confirme que ses noms entrent dans cette correspondance (§14).

### Si l'on se trompe

Les tokens restent des variables CSS standards : de nouveaux écrans peuvent être stylés en CSS
Modules avec les mêmes variables, et les anciens migrés progressivement.

### Réversibilité

**Moyenne**, et elle baisse avec le nombre de composants. Les tokens eux-mêmes sont entièrement
portables.

---

## 5. D28 : librairie de traduction

### Contexte

Tous les textes du produit (pages, app membres, e-mails côté front) passeront par cette librairie,
en français et en anglais dès le lancement, puis en portugais. Elle doit gérer le routage par langue,
le rendu statique, les formats de nombres et montants selon la langue, et permettre de vérifier que
les clés FR et EN sont identiques.

### Options

| Option | Avantages | Inconvénients |
|---|---|---|
| A. next-intl | Conçue pour l'App Router (composants serveur, rendu statique, routage `/fr` `/en`, liens de langue alternatifs) ; messages ICU (pluriels, nombres) ; clés typées ; formats via `Intl` | Liée à Next.js |
| B. i18next + react-i18next | Indépendante du framework, très répandue | Intégration serveur et routage à assembler soi-même, plus de paquets |
| C. Lingui | Extraction des textes à la compilation | Extension de compilation dont la compatibilité avec Turbopack est à surveiller |
| D. Solution maison (JSON + `Intl`) | Aucune dépendance | Routage, typage, pluriels et formats à réinventer : sur-ingénierie à l'envers |

### Décision

**A. next-intl 4.**

| Fichier | Rôle |
|---|---|
| `src/i18n/routing.ts` | `locales: ['fr', 'en']` ; `defaultLocale: 'fr'` (hypothèse du cadrage) ; `localePrefix: 'always'` ; **`localeCookie: false`** (aucun cookie écrit, CA8 et CA11) ; `localeDetection: false` (pas de redirection selon la langue du navigateur pendant la maquette, à réexaminer au Lot 1 avec `expert-ux`) |
| `src/proxy.ts` | Proxy next-intl : redirige `/` vers `/fr` et ajoute les liens de langue alternatifs |
| `src/i18n/request.ts` | Fournit à next-intl les messages de la langue demandée |
| `src/i18n/messages.ts` | Importe les deux fichiers JSON, les expose par langue et **vérifie à la compilation que FR et EN ont exactement les mêmes clés** (affectation croisée des deux types : une clé manquante ou en trop d'un côté fait échouer `pnpm typecheck`) |
| `src/i18n/next-intl.d.ts` | Typage des messages : une clé inexistante dans `t('…')` est une erreur de compilation |
| `src/i18n/navigation.ts` | `useRouter` localisé pour le sélecteur FR/EN (`router.replace` vers la même page dans l'autre langue, sans lien) |
| `src/locales/fr/landing.json`, `src/locales/en/landing.json` | Messages de la page, une clé de premier niveau par section (`header`, `hero`, …, `footer`, `cookieBanner`, `meta`) |

Règles :

- `<html lang={locale}>` dans `src/app/[locale]/layout.tsx` : changer de langue change l'attribut
  (CA23).
- **Pas de tableaux dans les messages** : une liste est un objet à clés
  (`faq.items.commission.question`), l'ordre d'affichage est fixé dans le composant.
- Nombres et montants **dynamiques** (chiffres fictifs) : formatés par next-intl selon la langue
  (`{count, number}`), jamais par concaténation. Montants des tarifs : **texte statique** (§6.5).
- Français : apostrophe typographique `’` (évite les pièges d'échappement ICU) ; espaces
  insécables dans les montants (U+202F entre les milliers, U+00A0 avant `€`), ce qui empêche une
  coupure de ligne au milieu d'un montant (CA24).

### Conséquences

- **Code** : les composants serveur utilisent `getTranslations`, les composants client reçoivent
  leurs libellés par props (le bloc complet des messages n'est pas envoyé au navigateur).
- **Déploiement** : le proxy s'exécute sur le serveur Node ; pages toujours pré-rendues.
- **Sécurité** : aucun cookie ; le proxy ne porte aucune autorisation.

### Si l'on se trompe

Les messages JSON au format ICU sont portables (FormatJS, i18next avec ICU). Le remplacement des
appels `t()` est mécanique.

### Réversibilité

**Moyenne.**

---

## 6. Mécanismes propres à la maquette

### 6.1 Contenu fictif isolé (CA15, CA17)

**Règle de tri** : un contenu va dans le module fictif s'il est **inventé**, ou s'il **n'existe que
parce que la page est une maquette**. Tout le reste va dans les fichiers de traduction.

| `src/content/placeholders/` | `src/locales/<langue>/landing.json` |
|---|---|
| Chiffres inventés et tendances ; marques fictives ; études de cas ; témoignages ; messages de la maquette de conversation ; e-mail de contact fictif ; texte du bandeau « Maquette » ; message « maquette, rien n'a été envoyé » du formulaire ; **toutes les photos** et leurs textes alternatifs FR/EN ; crédits des photos | Menu, CTA, titres et textes des sections ; méthode ; cas d'usage ; tarifs et exemple de référence ; FAQ ; libellés du formulaire ; bannière cookies ; pied de page ; libellés d'accessibilité ; métadonnées ; gabarits ICU qui reçoivent un chiffre fictif (`"{count, number} créateurs vérifiés"`) |

**Contenu du module**

| Fichier | Rôle |
|---|---|
| `src/content/placeholders/index.ts` | `export const IS_MOCKUP: boolean = true;` et `getPlaceholderContent(locale)` ; données FR et EN déclarées avec le même type (TypeScript garantit des clés identiques) ; photos importées statiquement depuis `./images/` |
| `src/content/placeholders/images/` | Photos Unsplash ou Pexels téléchargées (noms en `kebab-case`) |
| `src/content/placeholders/CREDITS.md` | Une ligne par photo : fichier, auteur, URL source, licence |

Les **types** (`CreatorCard`, `CaseStudy`, `KeyFigure`, `LandingImage`, etc.) vivent **hors** du
module, dans `src/content/landing-content.ts`, pour survivre à sa suppression. Le type
`CreatorCard` **ne comporte aucun champ** pseudo, nom, `@`, lien ou réseau : D16 et CA17 sont
garantis par construction.

**Frontière**

- Seuls `src/app/[locale]/layout.tsx` (bandeau, robots) et `src/app/[locale]/page.tsx` (données
  passées aux sections par props) importent le module. Partout ailleurs, l'import est refusé par
  ESLint.
- Les composants de section reçoivent le contenu par props typées et ignorent s'il est fictif.

**Procédure de retrait (Lot 1)**

1. Supprimer `src/content/placeholders/`.
2. `pnpm typecheck` signale les deux points d'usage (layout et page).
3. Fournir le contenu réel ou retirer la section concernée.
4. Retirer l'exception ESLint et le test G6 (§9.3).
5. Définir la politique d'indexation par environnement.

### 6.2 Bandeau et non-indexation (CA13, CA14)

- `IS_MOCKUP` est la **seule** constante. Dans `src/app/[locale]/layout.tsx`, si elle est vraie :
  - `MockupBanner` est le premier élément du `<body>` (visible sans défiler) ;
  - `generateMetadata` renvoie `robots: { index: false, follow: false }`, soit
    `<meta name="robots" content="noindex, nofollow">` dans les deux langues.
- **Pas** de `robots.txt` ni de sitemap pendant la maquette : un `Disallow` empêcherait les moteurs de
  lire la consigne `noindex`.
- Test G6 : tant que le module fictif existe, `IS_MOCKUP` doit valoir `true` (impossible de masquer
  le bandeau en gardant du fictif).
- Au déploiement (hors périmètre), `integrateur` ajoute une non-indexation propre à `staging`,
  indépendante de cette constante.

### 6.3 Aucune ressource tierce (CA11)

- **Police** : pile système par défaut. Si `expert-ux` retient une police : fichiers `woff2` sous
  licence libre (OFL) dans `src/assets/fonts/` avec leur fichier de licence, chargés par
  `next/font/local` dans `src/app/fonts.ts`. `next/font/google` est **interdit** (téléchargement
  depuis Google au build).
- **Images** : fichiers locaux uniquement. Pas de `images.remotePatterns` dans `next.config.ts` :
  Next.js refuse alors toute image distante. L'optimisation d'images passe par le serveur local
  (`/_next/image`), même origine.
- **Aucun** `next/script`, `<script>`, `<iframe>`, `<video>`, `<audio>`, `<embed>`, `<object>`, outil
  de mesure ou carte.
- Au Lot 1, une CSP `default-src 'self'` rendra la règle vérifiable en production
  (`expert-cybersecurite`).

### 6.4 Aucun lien, aucune requête, aucun stockage (CA6, CA7, CA8)

- Menu et CTA : `<button type="button">`. Aucun `href`, aucun `<a>`, aucun `next/link`, aucun
  `mailto:` ni `tel:`.
- Formulaire : `<form noValidate autoComplete="off" onSubmit={…}>` avec `preventDefault`, état React
  en mémoire uniquement. Pas d'attribut `action`, pas de `next/form`, pas de Server Action.
  `autoComplete="off"` évite que le navigateur mémorise la saisie pendant la maquette ; le Lot 1
  remettra les jetons `autocomplete` adaptés.
- Interdits dans `apps/web/src` : `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `navigator.sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`,
  `cookieStore`.
- next-intl : `localeCookie: false`.

### 6.5 Montants (CA19 à CA21)

- Les montants sont du **texte statique** dans `landing.json`, déjà formaté selon la langue
  (`2 000,00 €` / `€2,000.00`). Aucun calcul, aucun simulateur, aucun taux dans le code. Seul
  `billing` (future API) calcule.
- Au Lot 4, le texte public des taux par défaut devra rester aligné avec les taux stockés en base :
  point de contrôle de `expert-paiement-facturation` à chaque changement de taux par défaut.

---

## 7. Arborescence cible

```
influx/                                   racine du dépôt
├── .gitattributes                        * text=auto eol=lf (fins de ligne identiques sous Windows)
├── .gitignore                            existant ; ajouter next-env.d.ts
├── .node-version                         22
├── .prettierignore                       docs/, .claude/, CLAUDE.md, pnpm-lock.yaml, **/.next/
├── package.json                          privé ; scripts racine ; packageManager ; engines
├── pnpm-workspace.yaml                   packages apps/* et packages/* ; réglages de sécurité pnpm
├── pnpm-lock.yaml                        généré, versionné
├── tsconfig.base.json                    options TypeScript strictes communes
├── CLAUDE.md, docs/, .claude/            existants
└── apps/
    └── web/                              paquet @influx/web (Next.js)
        ├── package.json
        ├── next.config.ts                plugin next-intl ; agentRules: false ; poweredByHeader: false
        ├── tsconfig.json                 étend ../../tsconfig.base.json ; alias @/* -> src/*
        ├── eslint.config.mjs             règles du §9.2
        ├── postcss.config.mjs            @tailwindcss/postcss
        ├── vitest.config.ts              environnement node ; alias @ -> src
        ├── tests/
        │   └── guards.test.ts            tests de garde G1 à G6 (§9.3)
        └── src/
            ├── proxy.ts                  proxy next-intl (langue uniquement)
            ├── app/
            │   ├── globals.css           import Tailwind + tokens ; styles de base en var(--…)
            │   ├── fonts.ts              uniquement si police auto-hébergée
            │   └── [locale]/
            │       ├── layout.tsx        <html lang>, métadonnées, robots, MockupBanner
            │       └── page.tsx          assemble en-tête, sections 1 à 16, pied de page, bannière
            ├── i18n/
            │   ├── routing.ts
            │   ├── navigation.ts
            │   ├── request.ts
            │   ├── messages.ts           chargement + parité FR/EN vérifiée à la compilation
            │   └── next-intl.d.ts        typage des clés
            ├── locales/
            │   ├── fr/landing.json
            │   └── en/landing.json
            ├── styles/
            │   ├── tokens.css            FICHIER DE TOKENS UNIQUE, « PROVISOIRE (D6) »
            │   └── image-sizes.ts        valeurs de l'attribut sizes des images (§11, règle 6)
            ├── assets/
            │   └── fonts/                uniquement si police auto-hébergée (+ licence)
            ├── content/
            │   ├── landing-content.ts    types du contenu (aucune valeur)
            │   └── placeholders/         MODULE FICTIF UNIQUE (CA15)
            │       ├── index.ts          IS_MOCKUP + données et textes fictifs FR/EN + imports d'images
            │       ├── CREDITS.md        auteur, URL source, licence de chaque photo
            │       └── images/           photos Unsplash / Pexels
            └── components/
                ├── landing/              un composant par bloc (tableau ci-dessous)
                └── ui/                   primitives partagées (tableau ci-dessous)
```

Pas de `packages/`, `apps/api`, `supabase/` ni `.env.example` à ce stade. Les fichiers
supplémentaires exigés par la documentation de next-intl pour la version installée (page 404 par
langue, par exemple) sont autorisés dans `src/app/`.

### Composants de `src/components/landing/`

| Ordre (cadrage) | Bloc | Fichier | Client |
|---|---|---|---|
| — | Bandeau « Maquette » | `MockupBanner.tsx` | Non |
| — | En-tête | `SiteHeader.tsx` + `SiteHeaderMobileMenu.tsx` | Menu : oui |
| 1 | Hero | `HeroSection.tsx` | Non |
| 2 | Bandeau chiffre clé | `KeyFigureSection.tsx` | Non |
| 3 | Vitrine de créateurs | `CreatorShowcaseSection.tsx` | Non |
| 4 | Résultat mis en avant | `FeaturedResultSection.tsx` | Non |
| 5 | Carrousel de logos | `BrandLogosSection.tsx` | Via `ui/Carousel` |
| 6 | Études de cas | `CaseStudiesSection.tsx` | Via `ui/Carousel` |
| 7 | Problème et conversation | `ProblemSection.tsx` | Non |
| 8 | Méthode en 6 étapes | `MethodSection.tsx` | Via `ui/Accordion` |
| 9 | Réseau de créateurs | `CreatorNetworkSection.tsx` | Non |
| 10 | Cas d'usage | `UseCasesSection.tsx` | Non |
| 11 | Comment ça marche | `HowItWorksSection.tsx` | Non |
| 12 | Tarifs transparents | `PricingSection.tsx` | Non |
| 13 | Pourquoi INFLUX | `WhyInfluxSection.tsx` | Non |
| 14 | FAQ | `FaqSection.tsx` | Via `ui/Accordion` |
| 15 | Appel final | `FinalCtaSection.tsx` | Non |
| 16 | Formulaire en 3 étapes | `StartFormSection.tsx` + `StartFormSteps.tsx` | Étapes : oui |
| — | Pied de page | `SiteFooter.tsx` | Non |
| — | Bannière cookies | `CookieBanner.tsx` | Oui |

### Primitives de `src/components/ui/`

| Fichier | Rôle |
|---|---|
| `Button.tsx` | Bouton `type="button"` par défaut, variantes (principale, secondaire) exprimées en tokens |
| `Accordion.tsx` | Accordéon accessible (client) |
| `Carousel.tsx` | Carrousel accessible : défilement natif avec points d'accroche CSS, précédent/suivant, pause (client) |
| `CreatorCard.tsx` | Seule carte créateur (sections 3, 9, 15), sans pseudo par construction |
| `ResponsiveImage.tsx` | Enveloppe unique de `next/image` |
| `LanguageSwitcher.tsx` | Sélecteur FR/EN (client) |
| `icons.ts` | Seul point d'import des icônes `lucide-react` |

---

## 8. Dépendances

Versions **exactes** dans `package.json` (réglage `savePrefix: ''`), verrou versionné. Toute
nouvelle dépendance passe par `architecte`.

| Paquet | Où | Version au 2026-09-16 | Justification | Coût de retrait |
|---|---|---|---|---|
| `next` | web, exécution | 16.3.x | D1 | Moyen |
| `react`, `react-dom` | web, exécution | Version exigée par `next` | Imposé par la stack | — |
| `next-intl` | web, exécution | 4.x (4.14) | D28 | Moyen |
| `lucide-react` | web, exécution | Dernière stable | Icônes nécessaires dès la landing (menu, chevrons, pause, badge « vérifié ») ; licence ISC ; aucune sous-dépendance ; importées via `ui/icons.ts` | Faible (un fichier) |
| `typescript` | web, dev | **6.0.x** | TypeScript 7 (juillet 2026) n'expose pas encore d'API de programmation : `typescript-eslint` ne le prend pas en charge | Faible |
| `@types/node` (22.x), `@types/react`, `@types/react-dom` | web, dev | Alignées sur Node 22 et React | Typage | — |
| `tailwindcss`, `@tailwindcss/postcss` | web, dev | 4.3.x | D4 | Moyen |
| `eslint` | web, dev | **9.x** | ESLint 10 incompatible avec `eslint-plugin-react` embarqué par `eslint-config-next` | Faible |
| `eslint-config-next` | web, dev | Même version que `next` | Règles React, Hooks, Next, TypeScript (`next lint` supprimé en Next 16) | Faible |
| `eslint-plugin-jsx-a11y` | web, dev | 6.x | Déjà présent via `eslint-config-next` ; importé pour activer tout le jeu recommandé d'accessibilité (CA25) | Faible |
| `eslint-plugin-better-tailwindcss` | web, dev | Dernière stable | Détecte les classes qui ne correspondent à aucun token (sinon elles ne produisent silencieusement aucun style) et interdit les valeurs arbitraires (CA22) | Faible |
| `vitest` | web, dev | **4.1.x** | Outil de test du monorepo (TypeScript natif, API compatible Jest, servira l'API et les composants) ; 5.0 vient de sortir : montée de version au Lot 1 | Faible |
| `prettier` | racine, dev | 3.x | Formatage identique entre agents : diffs lisibles en revue | Faible |

**Refusées pour la landing** (et quand les reconsidérer) : bibliothèques de composants et CSS-in-JS
(D4) ; carrousel (`embla`), animation (`motion`), formulaires (`react-hook-form`) : le HTML natif
suffit ; `zod` : au Lot 1 pour les contrats d'API ; `clsx`, `tailwind-merge` : au premier besoin
réel ; Playwright : au Lot 1 pour le parcours d'inscription ; Storybook, Turborepo, outils de
mesure, `next-sitemap`, `cross-env`, `husky`, `lint-staged` : non nécessaires (la CI du Lot 0
remplace les crochets Git).

---

## 9. Outillage et contrôles automatiques

### 9.1 Scripts

`package.json` racine :

| Script | Commande |
|---|---|
| `dev` | `pnpm --filter @influx/web dev` |
| `start` | `pnpm --filter @influx/web start` |
| `build` | `pnpm -r run build` |
| `typecheck` | `pnpm -r run typecheck` |
| `lint` | `pnpm -r run lint` |
| `test` | `pnpm -r run test` |
| `format` | `prettier --write .` |
| `format:check` | `prettier --check .` |
| `check` | `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` |

`apps/web/package.json` :

| Script | Commande |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `typecheck` | `next typegen && tsc --noEmit` |
| `lint` | `eslint . --max-warnings 0` |
| `test` | `vitest run` |

**TypeScript** (`tsconfig.base.json`) : `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `isolatedModules`,
`skipLibCheck`. Dans `apps/web/tsconfig.json` : `resolveJsonModule` et `"types": ["node"]`
(TypeScript 6 ne charge plus les types globaux par défaut).

**pnpm** (`pnpm-workspace.yaml`) : `minimumReleaseAge: 1440` (écrit explicitement),
`strictDepBuilds: true`, `blockExoticSubdeps: true`, `savePrefix: ''`, `allowBuilds` (§12).

### 9.2 Règles ESLint de `apps/web/eslint.config.mjs`

Base : `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, jeu recommandé de
`jsx-a11y`, règles de correction de `better-tailwindcss` (point d'entrée `src/app/globals.css`),
`linterOptions.reportUnusedDisableDirectives: 'error'`.

| Règle | Contenu | CA |
|---|---|---|
| `no-restricted-syntax` | Attribut JSX `href` ; éléments `a`, `iframe`, `script`, `video`, `audio`, `embed`, `object` | CA6, CA11 |
| `no-restricted-syntax` | Attributs JSX `style`, `action`, `formAction` ; directive `'use server'` | CA22, CA8 |
| `no-restricted-imports` | `next/link`, `next/form`, `next/script`, `next/font/google` | CA6, CA8, CA11 |
| `no-restricted-imports` | `@/content/placeholders` et chemins relatifs vers ce dossier, sauf dans `src/app/\[locale\]/layout.tsx` et `src/app/\[locale\]/page.tsx` (crochets échappés dans le motif) | CA15 |
| `no-restricted-globals`, `no-restricted-properties` | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `localStorage`, `sessionStorage`, `indexedDB`, `cookieStore`, `document.cookie`, `navigator.sendBeacon` | CA8, CA11 |
| `react/jsx-no-literals` | Aucune chaîne littérale en enfant JSX ni dans `alt`, `aria-label`, `title`, `placeholder` | CA23 |
| `@typescript-eslint/no-explicit-any` | `error` ; exception seulement par commentaire `eslint-disable-next-line … -- raison` | CA27 |
| `better-tailwindcss/no-unknown-classes` | Toute classe sans token correspondant | CA22 |
| `better-tailwindcss/no-restricted-classes` | Valeurs arbitraires `[...]` ; `z-`, `duration-`, `delay-`, `opacity-` suivis d'un nombre ; modificateur d'opacité numérique `/nn` | CA22 |

Les règles d'interdiction liées à la maquette (`href`, `next/link`, module fictif) seront levées au
Lot 1 ; les autres restent.

### 9.3 Tests de garde (`apps/web/tests/guards.test.ts`)

Lecture de fichiers, déterministe, sans navigateur ni réseau. Portée : `apps/web/src/**/*.{ts,tsx,json,css}`
et `apps/web/next.config.ts`.

| Test | Vérifie | CA |
|---|---|---|
| G1 | Aucune occurrence de `href=`, `mailto:`, `tel:` | CA6 |
| G2 | Aucune URL `http://` ou `https://` (seul `CREDITS.md`, hors portée, en contient) | CA11 |
| G3 | Hors `src/styles/tokens.css` et `src/styles/image-sizes.ts` : aucune couleur hexadécimale, aucun `rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `oklab(`, `color-mix(`, aucune longueur littérale (`px`, `rem`, `em`, `vh`, `vw`, `ch`) | CA22 |
| G4 | Chaque fichier de `src/content/placeholders/images/` figure dans `CREDITS.md`, et inversement | CA26 |
| G5 | Aucun fichier `route.ts` ou `route.tsx` sous `src/app/` (pas de point d'accès serveur) | CA8 |
| G6 | Tant que le module fictif existe, `IS_MOCKUP` vaut `true` | CA13, CA14 |

### 9.4 Correspondance des critères et des contrôles

| CA | Mécanisme | Contrôle automatique | Contrôle du testeur |
|---|---|---|---|
| CA6 | Boutons sans lien | ESLint, G1 | Recherche `href=` |
| CA8 | Formulaire en mémoire, aucune API réseau ou stockage, aucun point d'accès serveur | ESLint, G5 | Onglet réseau et stockage du navigateur |
| CA11 | Police et images locales, aucun script tiers, pas de cookie de langue | ESLint, G2 | Onglet réseau : une seule origine |
| CA13, CA14 | `IS_MOCKUP` : bandeau + robots | G6 | Inspection de `<meta name="robots">` en FR et EN |
| CA15 | Module fictif unique, import restreint, types hors module | ESLint | Recherche de chaque valeur de la liste de `04-contenus.md` |
| CA17 | Type `CreatorCard` sans champ d'identité | `typecheck` | Lecture des cartes |
| CA20 | Montants en texte statique | — | Relecture de `PricingSection.tsx` (aucune opération) |
| CA22 | Tokens uniques, Tailwind sans thème par défaut | ESLint, G3 | Recherche `#`, `rgb(`, `hsl(` |
| CA23 | next-intl typé, parité FR/EN, `lang` | ESLint, `typecheck` | Bascule de langue |
| CA26 | `CREDITS.md` | G4 | Licences |
| CA27 | Scripts du §9.1 | `pnpm check`, `pnpm audit --audit-level high` | — |

Les contrôles axe ou Lighthouse (CA25) et les captures (CA1, CA2, CA24) restent manuels, avec les
outils intégrés au navigateur : aucun outil E2E n'est ajouté pour la maquette.

---

## 10. Commandes (Windows 11, PowerShell, à la racine du dépôt)

```powershell
# Une seule fois par poste, avec l'accord du fondateur (modifie l'installation de Node)
corepack enable pnpm
# En cas d'erreur EPERM (Node installé dans Program Files) : lancer PowerShell en administrateur
# pour cette seule commande, ou préfixer chaque commande par corepack (ex. : corepack pnpm install).

pnpm install                     # installe selon pnpm-lock.yaml
pnpm dev                         # http://localhost:3000/fr et http://localhost:3000/en
pnpm typecheck                   # next typegen + tsc --noEmit
pnpm lint                        # ESLint, zéro avertissement toléré
pnpm test                        # Vitest (tests de garde)
pnpm build                       # build de production (pages FR et EN pré-rendues)
pnpm start                       # sert le build de production en local
pnpm format:check                # Prettier
pnpm audit --audit-level high    # équivalent de « npm audit » pour CA27
pnpm check                       # format:check + typecheck + lint + test + build
```

En CI (Lot 0, `integrateur`) : `pnpm install --frozen-lockfile` puis `pnpm check` et
`pnpm audit --audit-level high`.

Facultatif, au choix du fondateur : `pnpm --filter @influx/web exec next telemetry disable` coupe
l'envoi de statistiques d'usage anonymes de l'outil Next.js vers Vercel (réglage du poste, rien dans
le dépôt).

---

## 11. Conventions pour `dev-react-node`

1. **Un composant par bloc** (§7), fichier `PascalCase.tsx`, export nommé. `page.tsx` ne fait
   qu'assembler les blocs dans l'ordre du cadrage et leur passer le contenu.
2. **Composants serveur par défaut.** `'use client'` seulement pour les interactions autorisées par
   CA7 (sélecteur FR/EN, menu mobile, accordéons, carrousels, étapes du formulaire, bannière), dans des
   composants feuilles qui reçoivent leurs libellés par props.
3. **Textes** : uniquement `getTranslations` / `useTranslations` avec des clés typées, ou les props
   issues du module fictif. Clés en `camelCase`, groupées par bloc (`hero.title`,
   `pricing.example.contractAmount`). Aucun littéral, y compris dans `alt`, `aria-label`, `title`,
   `placeholder`. Le nom « INFLUX » est lui aussi un message.
4. **Boutons sans lien** : `ui/Button.tsx` (type `button` par défaut). Pas d'attribut `disabled`
   (la maquette doit ressembler au rendu final), sauf indication contraire des wireframes. Aucun
   `onClick` en dehors des interactions de CA7. E-mail de contact, logos et entrées du pied de page :
   texte ou bouton, selon les wireframes d'`expert-ux`.
5. **Sémantique et clavier** :
   - repères `header`, `nav`, `main`, `footer` : ils satisfont le critère WCAG 2.4.1 sans lien
     d'évitement (qui sera ajouté au Lot 1, quand les liens seront permis) ;
   - un seul `h1` (hero) ; chaque bloc est une `<section aria-labelledby>` avec son `h2` ;
   - accordéon : bouton avec `aria-expanded` et `aria-controls` ;
   - carrousel : boutons précédent et suivant ; tout défilement automatique a un bouton pause,
     s'arrête au survol et au focus, et est figé avec la variante `motion-reduce:` ;
   - menu mobile : `aria-expanded`, fermeture par Échap, retour du focus sur le bouton ;
   - formulaire : `label` associé à chaque champ, erreurs reliées par `aria-describedby` et
     `aria-invalid`, annonce du changement d'étape et du message final dans une zone `aria-live` ;
   - bannière cookies : région nommée, trois boutons de même niveau visuel.
6. **Images** : uniquement via `ui/ResponsiveImage.tsx`. Texte alternatif fourni par le contenu
   (chaîne vide si décorative). L'attribut `sizes` prend ses valeurs dans `src/styles/image-sizes.ts`,
   seule exception documentée à G3 : un attribut HTML ne peut pas lire une variable CSS. Ces valeurs
   reprennent les points de rupture de `tokens.css`.
7. **Icônes** : importées depuis `ui/icons.ts` uniquement ; `aria-hidden` si décoratives ; taille et
   couleur par classes de tokens.
8. **Cartes créateurs** : uniquement `ui/CreatorCard.tsx` et le type `CreatorCard` (D16).
9. **Aucune logique métier** : ni calcul de montant, ni appel réseau, ni stockage.
10. **TypeScript** : aucun `any` ; toute désactivation ESLint porte sa raison après `--`.
11. **Documentation** : avant d'utiliser une API Next.js, lire la documentation embarquée de la
    version installée (`apps/web/node_modules/next/dist/docs/`) ; pour next-intl, la documentation de
    la version installée.
12. **Git** : Conventional Commits en anglais sur `feat/landing-page`, commit après accord du
    fondateur (CA28).

---

## 12. Frictions connues et parades

| Friction | Parade |
|---|---|
| `corepack enable pnpm` échoue en `EPERM` | PowerShell administrateur pour cette commande, ou `corepack pnpm <commande>` |
| pnpm 11 refuse d'installer tant que les scripts de build de certaines dépendances ne sont pas arbitrés (`strictDepBuilds`) | Déclarer chaque paquet signalé dans `allowBuilds` (`pnpm-workspace.yaml`) à `false` par défaut ; `true` uniquement si `pnpm build` ou `pnpm dev` échoue sans lui, avec un commentaire qui le justifie. Les paquets à binaires précompilés (`sharp`, `esbuild`…) fonctionnent en général sans leur script |
| `next dev` (16.3) crée `AGENTS.md` et `CLAUDE.md` dans `apps/web` quand il détecte un agent IA | `agentRules: false` dans `next.config.ts` : le `CLAUDE.md` racine reste la seule source d'instructions ; la documentation embarquée reste utilisée (§11, règle 11) |
| `create-next-app` génère un dépôt Git, des fichiers d'agents et une configuration hors monorepo | Ne pas l'utiliser : créer les fichiers de l'arborescence du §7 |
| Fins de ligne CRLF sous Windows qui font échouer `prettier --check` | `.gitattributes` avec `* text=auto eol=lf` |
| TypeScript 6 : `types` vaut `[]` par défaut | `"types": ["node"]` dans `apps/web/tsconfig.json` |
| Les crochets de `[locale]` sont lus comme un motif dans les chemins ESLint | Les échapper : `src/app/\[locale\]/page.tsx` |
| `output: 'standalone'` avec pnpm sous Windows : erreurs de liens symboliques au build | Ne pas l'activer ; le mode d'empaquetage Railway sera décidé au Lot 0 par `integrateur` |
| Fichier `next-env.d.ts` régénéré par Next.js | L'ajouter à `.gitignore` |

---

## 13. Hors périmètre maintenant

- Supabase, API, authentification, `.env`, Server Actions, Route Handlers.
- `robots.txt`, sitemap, liens de langue dans les métadonnées, URL canonique : au Lot 1 (ils
  exigeront une variable publique d'URL du site, à documenter avec la skill `env-secrets`).
- En-têtes de sécurité et CSP : avant toute mise en ligne, avec `expert-cybersecurite`.
- CI GitHub Actions, mises à jour automatiques de dépendances, Railway : `integrateur`, Lot 0, avec
  l'accord du fondateur.
- Tests de bout en bout (Playwright) : au Lot 1, pour le parcours d'inscription.
- Primitives headless, gestion d'état, validation de schémas : au premier besoin réel.
- **D2, D5, D12, D18 restent ouvertes.**

---

## 14. Points à faire valider

| Point | Par qui |
|---|---|
| Activation de pnpm via corepack sur le poste (modifie l'installation de Node) | Fondateur |
| Correspondance des familles de tokens vers Tailwind (§4), dont le nom des couleurs de texte | `expert-ux` |
| CA27 : `pnpm audit --audit-level high` remplace `npm audit` | `chef-de-projet`, `testeur` |
| Tri du fictif (§6.1) appliqué à la liste de `04-contenus.md`, notamment photos et texte du bandeau dans le module fictif | `expert-marketing`, `expert-conformite-rgpd` |
| Pas de redirection selon la langue du navigateur pendant la maquette (`localeDetection: false`) | `expert-ux` |
| Next.js et sa surface serveur : discipline de mise à jour, en-têtes et CSP avant la première mise en ligne | `expert-cybersecurite` |
| Passage à Node 24 LTS avant la première mise en ligne | `integrateur` |
| App membres dans `apps/web` par défaut, à confirmer au Lot 2 ; D12 inchangée | `chef-de-projet`, `product-owner` |

---

## 15. Mise à jour de `CLAUDE.md`

Faite (décisions datées du 2026-09-16) : §6 (nouvelle sous-section « Choix techniques tranchés » :
choix, emplacements réservés, décisions restant ouvertes) et §13 (D1, D3, D4 passées à « Tranchée
(2026-09-16) » ; ajout de la ligne D28, librairie de traduction). Aucune autre section modifiée.

---

## Sources (vérifiées le 2026-09-16)

- [Next.js 16.3 (annonce)](https://nextjs.org/blog/next-16-3)
- [Next.js : configuration ESLint](https://nextjs.org/docs/app/api-reference/config/eslint)
- [Next.js : agents IA et `agentRules`](https://nextjs.org/docs/app/guides/ai-agents)
- [Next.js : `next typegen`](https://nextjs.org/docs/app/api-reference/cli/next)
- [`eslint-config-next`, dépendances](https://github.com/vercel/next.js/blob/canary/packages/eslint-config-next/package.json)
- [next-intl : configuration du routage](https://next-intl.dev/docs/routing/configuration)
- [next-intl : mise en place](https://next-intl.dev/docs/routing/setup)
- [next-intl : proxy et usage sans proxy](https://next-intl.dev/docs/routing/middleware)
- [Tailwind CSS : variables de thème](https://tailwindcss.com/docs/theme)
- [Tailwind CSS 4.2 (InfoQ)](https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/)
- [eslint-plugin-better-tailwindcss](https://github.com/schoero/eslint-plugin-better-tailwindcss)
- [pnpm 11.0](https://pnpm.io/blog/releases/11.0)
- [`pnpm audit` cassé en v10 (410)](https://github.com/pnpm/pnpm/issues/11265)
- [npm 11.10 : `min-release-age`](https://www.brandonpugh.com/til/node/package-version-cooldown/)
- [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [TypeScript 7.0 (InfoQ)](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [typescript-eslint : versions de TypeScript prises en charge](https://typescript-eslint.io/users/dependency-versions/)
- [Vitest 4.1](https://vitest.dev/blog/vitest-4-1.html)
- [Railway : déploiement d'un monorepo](https://docs.railway.com/deployments/monorepo)
- [CVE-2025-55182 (Vercel)](https://vercel.com/changelog/cve-2025-55182)
- [eslint-plugin-react : `jsx-no-literals`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md)
