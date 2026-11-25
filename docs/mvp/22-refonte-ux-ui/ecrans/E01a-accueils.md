# E01 — Coquille des membres et accueil marque (marque ; coquille commune marque et créateur)
> Maquette : `proto-accueils.html` (états `marque-neuve`, `marque`) · page de comparaison `ecran-1-accueils.html` · validée le 2026-11-23 (07) · Constats : U08, U09, U45, U46, U59, U60, U61, U05. L'accueil créateur est dans `E01b-accueils.md`. `E01.0` désigne la coquille.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E01.0 | Coquille des membres | toutes les pages de `(member)/(space)` | idem | `apps/web/src/components/member/MemberShell.tsx`, `MemberNav.tsx`, `shell-classes.ts` | tous | M | C56, tokens `size-measure`, `logo-plate` |
| E01.1 | Accueil marque | `/fr/marque` | `/en/brand` | `auth/MemberHome.tsx:32` → `brand-profile/BrandHome.tsx:37` | `marque-neuve`, `marque` | L | E10 (profil), E12 et E18 (campagnes), E09 (sélections), E02 (recherche), D86 |

Routes : `app/[locale]/(member)/(space)/marque/page.tsx` et `brand/page.tsx`. Rôle créateur sur `/marque` : redirigé vers son espace (`MemberShell.tsx:140`).

Fonctionnalités existantes à préserver :
- Session relue au montage et à chaque chemin (`MemberShell.tsx:153`) ; 401 → `/connexion` (`:130`) ; CGU bloquantes (`:214`) ; page autonome « déconnecté » et « compte supprimé » (`:533`, `:554`).
- Lien d'évitement premier focalisable (`:370`) ; focus porté au `h1` après une navigation, pas au premier chargement (`:194`).
- Un seul `<nav>` « Navigation principale », un seul `aria-current="page"` (`MemberNav.tsx:76-104`) ; entrée sans écran absente (`lib/member-nav.ts`, « relations », « candidatures »).
- Langue : lien client `hreflang` vers la même page (`MemberShell.tsx:449`).
- État du profil lu par la coquille et rafraîchi à chaque page (`member/use-profile-summary.ts:32`).
- Aucun montant, taux ni net (D48, D78).

API appelée aujourd'hui : GET `/v1/me`, GET `/v1/me/brand-profile`, POST `/v1/auth/logout`. À appeler en plus : GET et POST `/v1/me/campaigns` (`campaign/campaign-api.ts:27,32`), GET `/v1/me/shortlists` (`creator-search/shortlists-api.ts:28`), GET `/v1/me/brand-verification` (`verification/verification-api.ts:126`).

## 2. Structure
**Coquille ≥ 1 024 px** : grille `--grid-member-shell` = 256 px + `minmax(0,1fr)`. Colonne collante `top 0`, hauteur `100dvh`, défilement propre, `surface-page`, filet droit `border-default`. Ordre : en-tête (0 → 123,7 px ; padding `spacing-5 spacing-4 spacing-4`), navigation (padding latéral `spacing-2`, entrées de 44 px, écart `spacing-1`), bloc d'état (marge haute `spacing-4`, padding `spacing-4`, filet haut), pied (poussé en bas, 194 px, padding `spacing-4`, gap `spacing-3`, filet haut).
**Coquille < 1 024 px** : en-tête collant 64 px (`header-height`, filet bas, gouttière) ; barre du bas fixe 56 px (`size-nav-bottom-height`), cellules `flex 1`, 96 px max (`spacing-11`), centrées ; bloc d'état, sous-menu et pied masqués.
**Cadre de page** (`.m-page`) : largeur max `container-max` (1 200 px), **aligné à gauche** ; padding vertical `section-header` (48 à 1440 ; 44,4 à 1280 ; 32,8 à 768 ; 24 à 375), horizontal `page-gutter` (48 ; 43,2 ; 27,8 ; 16) ; `min-height size-header-glow` ; halo `header-glow`. Contenu utile : 1 088 px à 1440, 937,6 à 1280, 712,4 à 768, 343 à 375.
**E01.1 `marque-neuve`** : pile `container-narrow` (768 px), écart 48 px (≥ 1 024) ou 32 px : `h1` → section de bienvenue → carte « Bien démarrer ».
**E01.1 `marque`** : pile pleine largeur, même écart : `h1` → « À traiter » (768 px max) → `home-grid`. `home-grid` ≥ 1 280 px : `minmax(0,2fr) minmax(0,1fr)`, gap `spacing-8` (693,3 + 346,7 px à 1440 ; 593,1 + 296,5 à 1280), alignée en haut. < 1 280 px : une colonne, gap `spacing-6`, 768 px max. Colonne droite : deux sections, écart 48 px (32 sous 1 024). Rien de collant dans le contenu.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E01.0-S01 | Coquille | C56 | Lien d'évitement « Aller au contenu », premier focalisable | Toujours, visible au focus | non montré (existant) | E01.0-CA05 | E01.0-T02 |
| E01.0-S02 | Coquille | C56 | Grille colonne 256 px + contenu | ≥ 1 024 px | tous, `.m-shell` | E01.0-CA01 | E01.0-T01 |
| E01.0-S03 | En-tête | C56 | INFLUX, `font-display` 700 16 px, cible 44 px, vers l'accueil du rôle | Toujours | tous, `.m-brand` | E01.0-CA01 | E01.0-T01 |
| E01.0-S04 | En-tête | C15 | Pastille neutre « Espace marque » (point `color-role-advertiser` 12 px) ou « Espace créateur », 31,7 px de haut ; sous INFLUX dans la colonne, à sa droite sous 1 024 px | Compte lu | tous, `.role` | E01.0-CA01 | E01.0-T01 |
| E01.0-S05 | En-tête | C10 | « English » / « Français » : pilule secondaire `md` 105,7 × 46,8 px | < 1 024 px | tous, `.m-head .btn` | E01.0-CA06 | E01.0-T02 |
| E01.0-S06 | Navigation | C56 | Entrée : icône `size-icon-md` + libellé, 44 px, `radius-md`, padding `spacing-3`, gap `spacing-3`, `text-md`, `text-secondary` ; survol `nav-item-hover-bg` | ≥ 1 024 px | tous, `.m-nav__link` | E01.0-CA02 | E01.0-T01 |
| E01.0-S07 | Navigation | C56 | Entrée courante : fond `nav-item-active-bg`, 600, `text-primary`, filet gauche 2 px (`border-width-thick`) inséré de `spacing-2` en haut et en bas, `aria-current` | Page de l'entrée | tous, `.is-current` | E01.0-CA02 | E01.0-T01 |
| E01.0-S08 | Navigation | C56 | Entrée ancêtre : 600, `text-primary`, sans fond ni filet dans la colonne ; aspect de l'entrée courante dans la barre du bas | Sous-page d'une rubrique | `proto-compte`, `.is-ancestor` | E01.0-CA02 | E01.0-T01 |
| E01.0-S09 | Navigation | C56 | Sous-entrées : sans icône, retrait `spacing-nav-sub-indent`, `text-sm`, 44 px, écart `spacing-1`, marge haute `spacing-1` ; courante : fond, filet gauche 2 px, 600 | ≥ 1 024 px, rubrique active | `proto-compte`, `.m-sub a` | E01.0-CA02 | E01.0-T01 |
| E01.0-S10 | Barre du bas | C56 | Cellule : icône 20 px sur libellé `text-xs`, gap `spacing-1` ; courante : fond et filet haut 2 px inséré de `spacing-3` ; anneau de focus intérieur | < 1 024 px | tous à 375, `.m-nav` | E01.0-CA03 | E01.0-T01 |
| E01.0-S11 | Bloc d'état | C56 | Ligne 1 « Profil : {état} » `text-sm` 700 (`b`) | ≥ 1 024 px, profil lu | tous, `.m-state b` | E01.0-CA04 | E01.0-T03 |
| E01.0-S12 | Bloc d'état | C56 | Ligne 2 « {n} informations manquantes » `text-sm` `text-secondary` | Au moins un manque | `marque-neuve`, `.m-state .c2` | E01.0-CA04 | E01.0-T03 |
| E01.0-S13 | Bloc d'état | C11 | Lien « Compléter mon profil › » `text-sm`, 44 px, chevron 16 px | Au moins un manque (marque neuve, créateur neuf) ; absent une fois publié | `marque-neuve`, `.m-state .go` | E01.0-CA04 | E01.0-T03 |
| E01.0-S14 | Pied | C10 | Langue (comme S05), aligné à gauche | ≥ 1 024 px | tous, `.m-foot .btn` | E01.0-CA06 | E01.0-T02 |
| E01.0-S15 | Pied | C56 | « Connecté avec {e-mail} » `text-sm` `text-secondary`, retour à la ligne libre | ≥ 1 024 px | tous, `.m-foot p` | E01.0-CA04 | E01.0-T03 |
| E01.0-S16 | Pied | C10 | « Se déconnecter », secondaire, icône `log-out`, largeur du contenu (199,2 px) | ≥ 1 024 px | tous, `.m-foot .btn` (2) | E01.0-CA07 | E01.0-T02 |
| E01.0-S17 | Contenu | C01 | `main` + cadre `container-max` aligné à gauche, gouttières et halo du §2 | Toujours | tous, `.m-page` | E01.0-CA08 | E01.0-T01 |
| E01.1-S01 | En-tête | C02 | `h1` « Accueil » `title-page` (28 px ≥ 1 024, 24 px dessous), 800 | Toujours | tous, `.t-page` | E01.1-CA01 | E01.1-T01 |
| E01.1-S02 | Bienvenue | C03 | `h2` `title-section` 20 px 700 | Première visite | `marque-neuve`, `#mn-w` | E01.1-CA02 | E01.1-T01 |
| E01.1-S03 | Bienvenue | C03 | Phrase de valeur `text-md` `text-secondary`, 640 px max (`size-measure`), à 8 px du titre | Première visite | `marque-neuve`, `.measure` | E01.1-CA02 | E01.1-T01 |
| E01.1-S04 | Bien démarrer | C04 | Carte unique de la page, 768 px, padding `inset-card` (32 ≥ 1 024, 24 dessous), gap `spacing-4` | Première visite | `marque-neuve`, `.card` | E01.1-CA03 | E01.1-T01 |
| E01.1-S05 | Bien démarrer | C43 | `h2` `t-card` à gauche, « {n} sur 5 » à droite (`text-sm`, chiffre `font-display` 700) | Première visite | `.sect__bar` | E01.1-CA03 | E01.1-T02 |
| E01.1-S06 | Bien démarrer | C43 | Jauge 6 px, fond `surface-active`, remplissage `brand-primary`, largeur n/5, `aria-hidden` | Première visite | `.bar` | E01.1-CA03 | E01.1-T02 |
| E01.1-S07 | Tâche 1 | C43 | `circle-check` 24 px `feedback-success-icon`, libellé, « Fait » | Toujours faite | `.todo .is-done` | E01.1-CA04 | E01.1-T02 |
| E01.1-S08 | Tâche 2 | C43 | `circle` 24 px `text-tertiary`, libellé `font-display` 700, « {n} informations : {3 premières} et {n-3} autres. » | Profil incomplet | `.todo > li:nth-child(2)` | E01.1-CA05 | E01.1-T02 |
| E01.1-S09 | Tâche 2 | C10 | « Compléter mon profil », principal `md` 212,4 × 44,8 px ; à droite et centré ≥ 768 px, sous le texte au bord gauche de la carte dessous | Profil incomplet ; seule pilule verte | `.t-act .btn--primary` | E01.1-CA05 | E01.1-T02 |
| E01.1-S10 | Tâche 3 | C43 | `lock` 24 px, libellé `text-secondary`, condition et délai | Profil incomplet | `.is-locked` (1) | E01.1-CA06 | E01.1-T02 |
| E01.1-S11 | Tâche 4 | C43 | `circle`, libellé, texte D86 | Toujours ouverte | `.todo > li:nth-child(4)` | E01.1-CA07 | E01.1-T03 |
| E01.1-S12 | Tâche 4 | C11 | « Créer un brouillon › » `.go` 44 px | Toujours | `.t-act .go` | E01.1-CA07 | E01.1-T03 |
| E01.1-S13 | Tâche 5 | C43 | `lock`, libellé `text-secondary`, « Après la validation de votre profil. » | Profil non publié | `.is-locked` (2) | E01.1-CA06 | E01.1-T02 |
| E01.1-S14 | Liste | C43 | Filets `border-subtle` entre tâches (pas avant la première), padding vertical `spacing-4`, colonnes 24 px + texte + action, gap `spacing-3` | Première visite | `.todo > li` | E01.1-CA03 | E01.1-T01 |
| E01.1-S15 | À traiter | C03 | `h2` surtitre `overline` (12 px, capitales, `text-secondary`) | Au moins une campagne à corriger, sinon bloc absent | `marque`, `#ma-todo` | E01.1-CA08 | E01.1-T04 |
| E01.1-S16 | À traiter | C17 | Notice `warning`, icône `triangle-alert`, gras « « {titre} » est à corriger. » puis le motif ; 768 px max, centrée verticalement, passe à la ligne | Une par campagne `rejected` | `marque`, `.notice--warning` | E01.1-CA08 | E01.1-T04 |
| E01.1-S17 | À traiter | C10 | « Corriger » principal 112,8 × 44,8 px, vers la campagne | Comme S16 | `.notice .btn--primary` | E01.1-CA08 | E01.1-T04 |
| E01.1-S18 | Mes campagnes | C03 | `h2` `t-section`, barre à deux bouts | Profil publié | `#ma-camp` | E01.1-CA09 | E01.1-T04 |
| E01.1-S19 | Mes campagnes | C10 | « Créer une campagne » secondaire, icône `plus`, 236,7 × 46,8 ; à la ligne sous le titre à 375 | Toujours | `.sect__bar .btn` | E01.1-CA07 | E01.1-T03 |
| E01.1-S20 | Mes campagnes | C06 | 3 lignes max (variante `camp`), filets `border-subtle`, 60 px min, padding `spacing-3 spacing-2` ; toute la ligne est la cible, survol `surface-raised` | Au moins une campagne | `.rows--camp` | E01.1-CA09 | E01.1-T04 |
| E01.1-S21 | Mes campagnes | C06 | Titre `font-display` 700 (lien étiré) | Par ligne | `.r-title` | E01.1-CA09 | E01.1-T04 |
| E01.1-S22 | Mes campagnes | C13 | Badge d'état avec icône 16 px : À corriger `warning` `triangle-alert` ; Publiée `success` `circle-check` ; En cours de validation `info` `hourglass` | Par ligne | `.badge` | E01.1-CA10 | E01.1-T04 |
| E01.1-S23 | Mes campagnes | C06 | « Modifiée le {date} » `text-sm` `text-secondary` ; chevron 20 px `text-secondary` à droite | Par ligne | `.r-meta`, `.r-chev` | E01.1-CA09 | E01.1-T04 |
| E01.1-S24 | Mes campagnes | C11 | « Voir les {n} campagnes › » vers `/campagnes` | Plus de 3 campagnes | `.sect > .go` | E01.1-CA09 | E01.1-T04 |
| E01.1-S25 | Trouver | C03 | `h2` + phrase `text-sm` `text-secondary` | Profil publié | `#ma-find` | E01.1-CA11 | E01.1-T01 |
| E01.1-S26 | Trouver | C10 | « Rechercher » secondaire, icône `search`, vers `/createurs` | Profil publié | `.actions .btn` | E01.1-CA11 | E01.1-T01 |
| E01.1-S27 | Trouver | C11 | « Demander une sélection » lien souligné `text-sm`, vers `/createurs/demande-de-selection` | Profil publié | `.actions .link` | E01.1-CA11 | E01.1-T01 |
| E01.1-S28 | Mes sélections | C06 | `h3` surtitre ; lignes : nom, « {n} créateurs · rattachée à « {campagne} » », chevron | Au moins une sélection | `h3.overline + .rows` | E01.1-CA12 | E01.1-T04 |
| E01.1-S29 | Mon profil | C03 | Filet haut `border-default`, padding haut `spacing-5`, `h2` `t-card` | Profil publié | `#ma-prof` | E01.1-CA13 | E01.1-T04 |
| E01.1-S30 | Mon profil | C13 | Badge `success` « Publié » (`circle-check`) et badge `verified` « Marque vérifiée » (`badge-check`) | Second badge : badge actif servi | `.profile-line` | E01.1-CA13 | E01.1-T04 |
| E01.1-S31 | Mon profil | C11 | « Modifier mon profil › » vers `/compte/profil` | Profil publié | `.go` | E01.1-CA13 | E01.1-T04 |
| E01.1-S32 | Chargement | C09 | Squelette des zones, hauteur stable (non montré) | Lecture en cours | non montré | E01.1-CA14 | E01.1-T05 |
| E01.1-S33 | Erreur | C08 | Message et « Réessayer » par zone, navigation utilisable (non montré) | Lecture en échec | non montré | E01.1-CA14 | E01.1-T05 |

## 4. Textes
EN « à écrire » = à écrire (expert-marketing). Locales : `apps/web/src/locales/{fr,en}/`.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E01.0-S04 | Espace marque · Espace créateur | Brand space · Creator space | `member.json` `shell.space.*` |
| E01.0-S05 | English | Français (sur la page anglaise) | `auth.json` `language.*` |
| E01.0-S06 | Accueil · Campagnes · Créateurs · Compte | Home · Campaigns · Creators · Account (valeurs de la clé) | `member.json` `shell.nav.entries.*` |
| E01.0-S11 | Profil : {Brouillon} | valeur de la clé | `member.json` `shell.accountState.state` + `brand-profile.json` `state.*` |
| E01.0-S12 | {10} informations manquantes | {10} details missing (valeur de la clé) | `shell.accountState.missing` |
| E01.0-S13 | Compléter mon profil | Complete my profile | `shell.accountState.complete` |
| E01.0-S15 | Connecté avec {claire.morel@example.test} | Signed in as {email} | `auth.json` `home.signedInAs` |
| E01.0-S16 | Se déconnecter | Sign out | `shell.footer.signOut` |
| E01.1-S01 | Accueil | à écrire | nouvelle (aujourd'hui `auth.home.advertiser.title` = « Espace marque ») |
| E01.1-S02 | Bienvenue sur INFLUX | à écrire | nouvelle |
| E01.1-S03 | Trouvez des créateurs crédibles pour vos campagnes : vous les découvrez sous forme de profils anonymes, et votre commercial INFLUX organise la mise en relation. | à écrire | nouvelle |
| E01.1-S05 | Bien démarrer · {1} sur 5 | à écrire | nouvelles |
| E01.1-S07 | Créer votre compte · Fait | à écrire | nouvelles |
| E01.1-S08 | Compléter votre profil de marque · {10} informations : {secteur principal, taille d'entreprise, marchés visés} et {7} autres. | à écrire | nouvelles (libellés : `brand-profile.json` `fields.*.label`) |
| E01.1-S09 | Compléter mon profil | Complete my profile | `member.json` `shell.accountState.complete` |
| E01.1-S10 | Faire valider votre profil · Après le profil complet. Examen par l'équipe INFLUX sous {8 heures ouvrées}. | à écrire | nouvelles |
| E01.1-S11 | Préparer votre première campagne · Possible dès maintenant. Le brouillon s'enregistre au fur et à mesure ; il part en validation une fois votre profil publié. | à écrire | nouvelles |
| E01.1-S12 | Créer un brouillon | à écrire | nouvelle |
| E01.1-S13 | Rechercher des créateurs · Après la validation de votre profil. | Search for creators · à écrire | `brand-profile.json` `home.locked.search.title` · nouvelle |
| E01.1-S15 | À traiter | à écrire | nouvelle |
| E01.1-S16 | « {Coffret de fêtes} » est à corriger. {motif} | à écrire · motif : valeur de la clé | nouvelle · `campaign.json` `rejection.*` ou `memberMessage` |
| E01.1-S17 | Corriger | à écrire | nouvelle |
| E01.1-S18 | Mes campagnes | My campaigns | `campaign.json` `list.title` |
| E01.1-S19 | Créer une campagne | Create a campaign | `campaign.json` `list.create` |
| E01.1-S22 | À corriger · Publiée · En cours de validation | To correct · Published · Being reviewed | `campaign.json` `status.label.*` |
| E01.1-S23 | Modifiée le {22 nov.} | Changed on {date} | `campaign.json` `list.updatedOn` |
| E01.1-S24 | Voir les {5} campagnes | à écrire | nouvelle (pluriel ICU) |
| E01.1-S25 | Trouver des créateurs · Recherche par critères, sur des profils anonymes. | à écrire | nouvelles |
| E01.1-S26 | Rechercher | à écrire | nouvelle |
| E01.1-S27 | Demander une sélection | Request a selection | `creator-search.json` `meta.request` |
| E01.1-S28 | Mes sélections · {4} créateurs · rattachée à « {Routine éclat d'hiver} » · {2} créateurs | My selections · à écrire | `creator-search.json` `meta.shortlists` · nouvelle |
| E01.1-S29 | Mon profil de marque | My brand profile | `brand-profile.json` `page.title` |
| E01.1-S30 | Publié · Marque vérifiée | Published · à écrire (E01-Q20) | `brand-profile.json` `state.published` |
| E01.1-S31 | Modifier mon profil | à écrire | nouvelle |

## 5. Interactions, états, responsive, clavier
- **Interactions** : entrée de navigation → page, focus au `h1`. « English » → même page dans l'autre langue. « Se déconnecter » → POST logout → page autonome « Vous êtes déconnecté » (existant). Tâche 2 et bloc d'état → `/compte/profil`, focus sur le premier champ manquant (`ecran-1` §4). « Créer un brouillon » et « Créer une campagne » → POST `/v1/me/campaigns` → `/campagnes/{id}` ; échec : `campaign.list.createFailed` (C17 + annonce). « Corriger » → `/campagnes/{id}`. Ligne de campagne ou de sélection → sa page. Aucune confirmation.
- **États** : chargement, erreur, hors ligne, campagne vide, sélection vide, profil `pending_review`, `rejected`, `suspended` : non montrés. Actuel préservé : chargement `BrandHome.tsx:57`, illisible + « Réessayer » `:86`, état écrit `ProfileStateNotice` `:106`. Représentation proposée : C09 par zone ; C08 par zone ; liste vide = `campaign.list.empty.*` dans la section ; voir E01-Q1 pour les autres états de profil. Permission : autre rôle → redirection.
- **Responsive** : 1440 et 1280 : colonne + `home-grid` deux colonnes. 1 024 à 1 279 : colonne + contenu une colonne de 768 px max. 768 et 375 : en-tête + barre du bas ; bloc d'état et pied masqués (déconnexion : E20.1). À 375 : badge et date de campagne sous le titre (grille `"t c" "m c"` sous 768 px) ; actions des tâches sous le texte, sur toute la largeur de la ligne (`grid-column: 1 / -1`, même position que la maquette) ; notice « À traiter » : « Corriger » à la ligne.
- **Clavier** : lien d'évitement → INFLUX → langue (< 1 024) → entrées → état → pied → contenu. Lignes `cover` : anneau dessiné sur toute la ligne, intérieur (`-focus-ring-width`).
- **Annonces** : échec de création et de chargement seulement.
- **Animations** : ligne et entrée `background-color` `duration-fast` `ease-standard` ; chevron `.go` `translate 2px` au survol, `duration-fast`, absent sous mouvement réduit ; pilules `scale` hover/press (existant) ; jauge `width` `duration-slow` `ease-standard`.

## 6. Critères d'acceptation
- **E01.0-CA01** À 1440 et 1024 px : colonne de 256 px, en-tête INFLUX puis pastille de rôle en dessous ; à 375 px : en-tête de 64 px, INFLUX, pastille, langue sur une ligne, sans débordement à 320 px.
- **E01.0-CA02** Entrée courante : fond, filet gauche 2 px et graisse 600 ; entrée ancêtre sans fond ni filet ; un seul `aria-current="page"` par page.
- **E01.0-CA03** Barre du bas : 56 px hors zone iOS, 3 cellules (créateur) ou 4 (marque) aujourd'hui, jamais plus de 5 ; aucune sous-entrée.
- **E01.0-CA04** Bloc d'état : texte seul et lien « › », aucune pilule ; absent sous 1 024 px ; rien après « Publié ».
- **E01.0-CA05** Le premier Tab atteint le lien d'évitement ; après une navigation, le focus est sur le `h1`.
- **E01.0-CA06** La langue est un lien `hreflang` avec `lang`, cible ≥ 44 px, dans l'en-tête sous 1 024 px et dans le pied dès 1 024 px.
- **E01.0-CA07** « Se déconnecter » a la largeur de son contenu, libellé « Déconnexion… » pendant l'appel, sans double envoi.
- **E01.0-CA08** Le bord gauche du `h1` est le même sur toutes les pages de l'espace (304 px à 1440).
- **E01.1-CA01** Un seul `h1`, « Accueil » ; « Espace marque » n'apparaît plus que dans la pastille.
- **E01.1-CA02** Première visite : titre et phrase de bienvenue, 640 px max.
- **E01.1-CA03** Première visite : une seule carte, cinq tâches, compteur et jauge cohérents (texte porteur, jauge `aria-hidden`).
- **E01.1-CA04** Tâche faite : coche et mot « Fait », jamais la couleur seule.
- **E01.1-CA05** Une seule pilule verte, sur la tâche suivante ; les manques nommés viennent de `missingRequired`.
- **E01.1-CA06** Tâches verrouillées : cadenas, condition écrite, aucun lien.
- **E01.1-CA07** Profil non publié : la création d'un brouillon aboutit et ouvre le formulaire (D86) ; double clic sans effet.
- **E01.1-CA08** Sans campagne `rejected`, « À traiter » est absent ; sinon une notice par campagne, « Corriger » est la seule pilule verte.
- **E01.1-CA09** Trois campagnes au plus, triées comme l'API ; « Voir les {n} campagnes » au-delà de 3.
- **E01.1-CA10** Chaque badge d'état porte icône et mot ; écart icône-mot 8 px.
- **E01.1-CA11** « Rechercher » et « Demander une sélection » mènent aux pages existantes ; sans pilule verte.
- **E01.1-CA12** Une sélection sans campagne n'affiche pas « rattachée à ».
- **E01.1-CA13** « Marque vérifiée » seulement si le badge servi est actif (libellé : E01-Q20).
- **E01.1-CA14** Chargement et erreur ne masquent jamais la navigation ; axe sans défaut à 375, 768, 1024, 1440 ; FR et EN.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E01.0-T01 | e2e, visuel | `e2e/member-shell.spec.ts` (adapter TD5.2, TN6, L2AU-2) | Gabarit, entrées, sous-menu, largeurs |
| E01.0-T02 | e2e, a11y | `e2e/member-shell.spec.ts` TD5.1, TD5.3 à TD5.7 (garder) | Repères, focus, langue, déconnexion |
| E01.0-T03 | e2e | `e2e/brand-profile.spec.ts` (accueil et colonne), `e2e/member-shell.spec.ts` (accueil créateur) à adapter | Bloc d'état en texte |
| E01.1-T01 | visuel, a11y | `e2e/account-screens.spec.ts` (accueil), `e2e/charter-rendering.spec.ts`, `tests/guards.test.ts` (TK7.3) | Rendu, axe, tailles fixes |
| E01.1-T02 | unitaire | nouveau `tests/member-home-view.test.ts` | Tâches, compteur, manques, verrous |
| E01.1-T03 | e2e | `e2e/brand-campaign.spec.ts` à adapter | Brouillon avant publication (D86) |
| E01.1-T04 | e2e | `e2e/brand-profile.spec.ts` : titre, cartes verrouillées et nombre de lignes (`2 + 3`) à réécrire ; `e2e/brand-creator-shortlists.spec.ts` | Accueil actif |
| E01.1-T05 | e2e | `e2e/member-shell.spec.ts` | Chargement, erreur |

Attributs à conserver : `data-member-nav`, `data-member-main`, `#main`, `data-theme="keo"`. Planchers : `e2e/case-floors.ts`. `auth.home.advertiser.title` comme `h1` : à remplacer dans `brand-profile`, `member-shell`, `signup-nominal`.

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Cadre | `auth-classes.ts:28` : `mx-auto`, `container-narrow` | `container-max` à gauche | faire évoluer (C01) |
| Navigation, colonne, barre | `shell-classes.ts` | identique à la maquette | réutiliser |
| Langue | `LANGUAGE_LINK_CLASSES` : `text-sm`, 44 px | pilule secondaire `md` | faire évoluer |
| Bloc d'état | `AccountStateBlock.tsx:30` : pilule pleine largeur, gap 8 | lien texte, gap 4 ; rien une fois publié | faire évoluer |
| Pied | `MemberShell.tsx:422` : `w-full` | largeur du contenu | faire évoluer |
| Bas du contenu | `globals.css:59` : barre + 24 px + zone iOS | garder (maquette : barre seule) | réutiliser |
| `h1` « Espace marque », « Comment ça marche », cartes verrouillées, « Gérer mon compte » | `BrandHome.tsx:48-80`, `:150` | retirés | supprimer |
| Carte d'action | `BrandHome.tsx:103` | liste « Bien démarrer » | créer (C43) |
| Campagnes, sélections, profil | `BrandHome.tsx:192-227` (cartes) | sections et lignes | créer (C03, C06) |
| Icônes | `components/ui/icons.ts` | ajouter `circle`, `hourglass`, `search` | créer |

Données requises :

| Donnée affichée | Servie aujourd'hui ? | Écart |
|---|---|---|
| État, manques | oui, GET `/v1/me/brand-profile` (`brand-profile-view.ts:539`) | aucun |
| Campagnes, état, motif, date | oui, GET `/v1/me/campaigns` (`packages/contracts/src/campaign.ts:463`) | aucun ; `title` peut être null (`list.untitled`) |
| Sélections, nombre, campagne | partiel : `campaignId` sans titre (`shortlists.ts:74`) | titre joint côté front avec la liste des campagnes |
| Badge « Marque vérifiée » | oui, GET `/v1/me/brand-verification` | un appel de plus, seulement si publié |
| Délai d'examen « 8 heures ouvrées » | non (file interne) | voir E01-Q2 |

Hors lot : compteurs de messages et de mises en relation, « ce qui attend votre réponse » hors campagne (Lot 4).

## 9. Contradictions, manques et décisions
| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E01-Q1 | La maquette montre « première visite » et « active » sans règle de bascule ; profil complet non soumis, `pending_review`, `rejected`, `suspended` et « publié sans campagne » non dessinés (`06` RG84, 17 §2.4) | Composition de l'accueil indéterminée entre l'inscription et la publication | Liste affichée tant que les 5 tâches ne sont pas faites ; tâche 3 : « Envoyer… » quand complet, « En cours d'examen » quand soumis, motif quand refusé ; vue active dès la publication, « Bien démarrer » retirée | product-owner | oui |
| E01-Q2 | « sous 8 heures ouvrées » (marque) contre « 1 jour ouvré » (`06` RG7) et « 1 jour ouvré » chez le créateur ; `ecran-1` §6 veut le délai « lu dans la configuration », aucun contrat membre ne le sert | Texte impossible à tenir | Servir le délai de la file à l'espace membre, ou texte sans chiffre | product-owner, architecte | oui |
| E01-Q3 | 17 §4.1 impose « Bonjour, {nom} », un bloc de complétude et « Créer une campagne » principal ; la maquette validée dit « Accueil », un badge et un bouton secondaire ; 17 §2.3 veut la zone « centrée » | Spec à amender | La maquette prime ; amender 17 §2.3, §2.4, §4.1 | product-owner | non |
| E01-Q4 | « Compléter mon profil » : le code affiche « Soumettre mon profil » quand il ne manque rien (`brand-profile-view.ts:562`) ; libellé cible non montré (U63) | Libellé du bloc d'état et de la tâche | Reprendre le libellé de E10 (« Envoyer à INFLUX pour validation ») | product-owner | non |
| E01-Q5 | Dates « 22 nov. » ; `formatDate` du code : `dateStyle long` | Rendu | `Intl` jour + mois abrégé, année si différente, dans la langue | expert-ux | non |
| E01-Q6 | Quand les tâches 4 et 5 sont-elles faites ? Non défini | Compteur | Tâche 4 : dès qu'une campagne existe ; tâche 5 : dès la publication (la première recherche n'est pas tracée) | product-owner | non |
| E01-Q7 | Nombre de sélections affichées et absence de « Voir toutes » non définis | Longueur de la colonne droite | 3 au plus, lien vers « Mes sélections » | expert-ux | non |
| E01-Q8 | La langue est un `button` dans la maquette ; axe : `.m-state` hors repère (X11) | Accessibilité | Garder le lien ; placer le bloc dans le `header` de colonne ou un `aside` nommé | expert-ux | non |
| E01-Q9 | Jauge sur `surface-active` (X7) ; textes sans EN (X13) | — | Voir X7, X13 | expert-marketing | non |
