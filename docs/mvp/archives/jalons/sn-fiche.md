# Fiche SN — Sous-navigation dans la colonne (jalon extra du MVP)

> **Point d'entrée de toute session du jalon SN.** Décision : `decisions.md` **D74** (fondateur,
> 2026-10-29). Jalon **extra**, placé **avant le Lot 2** : les écrans des Lots 2 à 5 se construiront
> directement avec cette règle, sans reprise. Lire ensuite **seulement** les tranches citées :
> `17` §2.2, §2.3 et §6.0 (membres), `17b` §1.7 (backoffice), `20` §11.8 (composants), `02` §21.5
> points 3 et 8 (mécanique), skill `design-system-influx`.

## Besoin reformulé

Les pilules vertes en tête de contenu (« Mes informations · Mes préférences · Mes sessions · Mes
données », et au backoffice « Inscrits · Invitations » et les quatre écrans d'administration)
disparaissent. **Sur poste de travail, les pages d'une rubrique deviennent un sous-menu de la
colonne de gauche**, sous leur rubrique. **Sur téléphone et tablette, la rubrique ouvre une
page-menu** (comme les Réglages d'un téléphone), et chaque page porte un lien « ‹ Mon compte » au-dessus
de son titre.

| Population | Ce qui change pour elle | Valeur business |
|---|---|---|
| Marque (au bureau) | Sous-menu de « Compte » dans la colonne, contenu qui commence par son titre | Écran plus calme et plus lisible : une seule navigation, au même endroit |
| Créateur (téléphone) | « Compte » ouvre une page-menu ; plus de rangée de pilules au-dessus du contenu | Gestes familiers ; la place gagnée en haut d'écran sert le contenu |
| Commercial INFLUX | Sous-menus de « Comptes » et « Administration » dans le rail | Même modèle que les outils de travail du marché (Linear, Intercom) ; prépare les 16 files |
| Équipe produit | Une seule règle de navigation, membres et backoffice | Les Lots 2 à 5 ne redessinent aucune navigation de second niveau |

Aucun effet sur la commission, la traçabilité ni les leads : **aucune règle métier, aucune route
d'API, aucune donnée, aucune migration** ne bouge.

## Arbitrages du fondateur (2026-10-29)

| # | Question | Décision |
|---|---|---|
| SN-A | Sur téléphone et tablette (< 1 024 px), comment rejoindre les pages d'une rubrique ? | **Page-menu** de la rubrique ; lien « ‹ ⟨rubrique⟩ » au-dessus du `h1` de chaque page |
| SN-B | Sur poste de travail, quand le sous-menu s'affiche-t-il ? | **Ouvert sur la rubrique active seulement** ; les autres rubriques restent fermées ; rien à mémoriser (D37) |
| SN-C | Périmètre | **Espaces membres et backoffice** |
| SN-D | Les onglets internes d'un écran (Lot 4 : *demandes · conversations*) passent-ils aussi en sous-menu ? | **Oui** : tout ce qui relève d'une rubrique devient sous-page et sous-menu, **sauf** les canaux d'une conversation (« À trois · Vous et INFLUX · Documents », `20` §7), qui restent dans la conversation |
| SN-E | Rubrique de travail quotidien sur téléphone (« Relations », Lot 4) | **Page-menu aussi**, qui affiche le nombre d'éléments en attente par sous-page (« Demandes 3 · Conversations 2 ») ; à réexaminer avec l'usage réel au Lot 4 |

## La règle (D74), telle qu'elle s'applique

### Poste de travail (≥ 1 024 px), membres et backoffice

```
Espace marque, page « Mes données » — colonne size-member-rail (16 rem)
┌────────────────────────────────────┬──────────────────────────────────────────────┐
│ INFLUX                    [i:bell]³│ ‹ Mon compte                                 │
│ ● Espace marque                    │ Mes données                       [■ Action] │
│                                    │ ──────────────────────────────────────────── │
│  [i:home]      Accueil             │ contenu                                      │
│  [i:megaphone] Campagnes         4 │                                              │
│  [i:search]    Créateurs           │                                              │
│  [i:handshake] Relations         2 │                                              │
│  [i:user]      Compte              │  ← rubrique ancêtre : text-primary 600,      │
│                Mes informations    │    sans surface ni filet, sans aria-current  │
│                Mes préférences     │                                              │
│                Mes sessions        │                                              │
│              ▎ Mes données         │  ← sous-entrée courante : surface active,    │
│                                    │    filet 2 px, aria-current="page"           │
│ ────────────────────────────────── │                                              │
│ [i:languages] FR · EN              │                                              │
│ [i:log-out] Se déconnecter         │                                              │
└────────────────────────────────────┴──────────────────────────────────────────────┘
```

| Règle | Détail |
|---|---|
| Où | Les sous-entrées d'une rubrique sont une `<ul>` **imbriquée dans le `<li>` de la rubrique**, à l'intérieur de l'unique `<nav>` « Navigation principale ». Aucun second `<nav>`, aucune `<nav aria-label="Mon compte">` |
| Quand | Rendues **seulement pour la rubrique active** (SN-B) : les autres rubriques n'en affichent aucune. Pas de chevron, pas d'état ouvert ou fermé à mémoriser |
| Seuil | Une rubrique à **une seule** page n'a pas de sous-menu (Tableau de bord, Accueil) |
| Forme | Sans icône ; libellé aligné sur celui de la rubrique (retrait = icône + écart) ; `text-sm` (membres) ; hauteur ≥ `size-touch-target` (membres), `spacing-bo-row-h` (backoffice) ; `radius-md`. Composant « Sous-entrée de navigation », `20` §11.8 |
| Rubrique sur sa page-menu | La rubrique est l'item courant : état actif complet (surface, filet, `aria-current="page"`), sous-menu ouvert, aucune sous-entrée courante |
| Rubrique sur une sous-page | La rubrique passe à l'état **ancêtre** : `text-primary` semi-gras, sans surface, sans filet, sans `aria-current` ; la sous-entrée porte surface, filet et `aria-current="page"`. **Un seul `aria-current` par page** (inchangé depuis DS) |
| Lien de la rubrique | **Membres** : mène à la **page-menu** de la rubrique (une seule adresse par lien : le même `<nav>` sert la colonne et la barre du bas). **Backoffice** : ouvre le premier écran de l'entrée, comme aujourd'hui (pas de page-menu, faute de vue téléphone, F7) ; pour Files, le catalogue de `17b` §1.3 |
| Fiche sous une sous-page | Une page de détail (`/inscrits/⟨id⟩`) rend sa sous-entrée courante (« Inscrits »), comme aujourd'hui |
| Libellés | Ceux des pages (« Mes informations », « Mes préférences »…) ; la limite de 11 caractères ne vaut que pour la barre du bas, que les sous-entrées n'occupent jamais |
| Retour | **Membres** : au-dessus du `h1`, un lien « ‹ ⟨rubrique⟩ » vers la page-menu ; il remplace le fil d'Ariane du niveau 2 (`17` §2.3) et **« Retour à mon espace » disparaît** (la colonne et la barre mènent à l'accueil). **Backoffice** : le fil d'Ariane « ⟨entrée⟩ › ⟨écran⟩ » reste |
| Clavier | Ordre : lien d'évitement → tête de colonne → rubriques, chaque sous-menu juste après sa rubrique → bloc d'état → pied → contenu. Au backoffice, `g` puis n inchangé (va à la page-menu ou au premier écran de l'entrée) |

### Téléphone et tablette (< 1 024 px), membres

```
Page-menu « Mon compte » (/fr/compte)       Une sous-page (/fr/compte/donnees)
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ INFLUX                  FR|EN │           │ INFLUX                  FR|EN │
├───────────────────────────────┤           ├───────────────────────────────┤
│ Mon compte               (h1) │           │ ‹ Mon compte                  │
│                               │           │ Mes données              (h1) │
│ [i] Mes informations        › │           │                               │
│     Adresse, pays, langue     │           │ contenu                       │
│ ───────────────────────────── │           │                               │
│ [i] Mes préférences         › │           │                               │
│     Les e-mails que vous      │           │                               │
│     recevez                   │           │                               │
│ ───────────────────────────── │           │                               │
│ [i] Mes sessions            › │           │                               │
│     Les appareils connectés   │           │                               │
│ ───────────────────────────── │           │                               │
│ [i] Mes données             › │           │                               │
│     Export, suppression       │           │                               │
├───────────────────────────────┤           ├───────────────────────────────┤
│ [i] Accueil       [i] ▔Compte▔│           │ [i] Accueil       [i] ▔Compte▔│
└───────────────────────────────┘           └───────────────────────────────┘
```

| Règle | Détail |
|---|---|
| Barre du bas | Inchangée : cinq cellules au plus, **jamais de sous-entrée** ; les `<ul>` imbriquées sont masquées par le CSS sous `lg` (`max-lg:hidden` sur la `<ul>` imbriquée : `display: none`, donc hors de l'arbre d'accessibilité ; retenu par `architecte`, SN-0). « Compte » reste actif sur toute page `/compte/*` |
| Page-menu | Une page à part entière, son adresse propre, son `h1` (« Mon compte »). Une liste de liens en **lignes pleine largeur** : icône décorative, libellé `text-md` semi-gras, une phrase `text-sm` `text-secondary`, chevron décoratif ; ligne entière cliquable (lien étiré), hauteur ≥ `size-touch-target`, séparateur `border-subtle`. Une `<ul>` dans `<main>`, **pas un `<nav>`** (un seul repère de navigation) |
| Compteurs (SN-E) | Une sous-page qui a des éléments en attente affiche sa pastille de compteur (`20` §11.8) à droite de son libellé, sur la page-menu et dans le sous-menu de la colonne. « Mon compte » n'en a aucune aujourd'hui |
| Poste de travail | La page-menu existe aussi à ≥ 1 024 px (même adresse, même contenu, en `container-narrow`) : c'est la page du lien de la rubrique ; le sous-menu de la colonne est ouvert à côté |
| Sous-page | Lien « ‹ Mon compte » au-dessus du `h1` (règle « Retour » ci-dessus), à toutes les largeurs ; rien d'autre au-dessus du titre |
| Focus | Après une navigation, focus au `h1` de la page d'arrivée (inchangé) |

### Backoffice de 768 à 1 023 px

Le même `<nav>` reste une liste horizontale compacte sous la bande de tête (`17b` §1.7) ; **l'entrée
active et ses sous-entrées occupent leur propre ligne**, pleine largeur, à sa place dans l'ordre des
entrées, qui passe à la ligne sans cacher d'entrée, sans défilement horizontal. Réalisation retenue
(`architecte`, SN-0, 2026-10-29) : liste en `flex flex-wrap` ; `<li>` actif en `max-lg:flex
max-lg:basis-full max-lg:flex-wrap max-lg:items-center max-lg:gap-1` (son lien, puis sa `<ul>` en `flex
flex-wrap gap-1` ; `lg:block`, `lg:flex-col` dans le rail). Ni `display: contents` (rôle d'élément de
liste incertain sous WebKit), ni `order` : l'ordre visuel suit celui du DOM et du clavier. Sous 768 px
ou 500 px de haut : écran « poste de travail », inchangé (F7).

### Ce que la règle couvre, aujourd'hui et plus tard

| Rubrique | Sous-pages | Arrive |
|---|---|---|
| Membres · Compte | Mes informations · Mes préférences · Mes sessions · Mes données (+ Mon profil au Lot 2, en tête) | **SN** |
| Backoffice · Comptes | Inscrits · Invitations | **SN** |
| Backoffice · Administration (`admin`) | Double validation · Comptes internes · Réglages Apollo · Santé technique | **SN** |
| Marque · Mises en relation | Demandes · Conversations (anciens onglets de `17` §4.6) | Lot 4 |
| Créateur · Mes relations | Invitations · Conversations | Lot 4 |
| Backoffice · Files | Page-menu = le catalogue de `17b` §1.3 ; sous-menu = les files, groupées sous les cinq intitulés de groupe (non cliquables) ; la file 4 devient **deux sous-entrées**, « Vérifications créateurs » et « Vérifications marques » (`08` RG61, jamais un écran mixte) | Lots 2 à 5 |
| **Exception unique** | Les canaux d'une conversation (« À trois · Vous et INFLUX · Documents », `20` §7) restent des onglets **dans** la conversation | — |

Plus aucune pilule de section ni aucun onglet de rubrique en tête de contenu, membres et backoffice.
Une liste de filtres (puces de filtre d'une file) n'est pas de la navigation et reste dans la page.

### Pages exemptées des CGU

La page-menu « Mon compte » rejoint `TERMS_EXEMPT_PAGES` (`member-paths.ts`) : elle ne montre que des
liens et ne lit rien de plus que `GET /v1/me`, déjà lisible. Sur téléphone, elle permet d'aller de
« Mes préférences » à « Mes données » quand une version des CGU attend (`05` RG28, J7 A3) ; un lien vers
une page non exemptée mène, comme aujourd'hui, à l'écran bloquant. Côté `apps/api`, rien ne change.

### Adresses

| Page | Avant | Après |
|---|---|---|
| Page-menu « Mon compte » | — | `/fr/compte` · `/en/account` |
| Mes informations | `/fr/compte` · `/en/account` | `/fr/compte/informations` · `/en/account/details` |
| Préférences, sessions, données | inchangées | inchangées |

Aucun e-mail ni aucun texte ne porte l'adresse de « Mes informations » (constat du 2026-10-29 : les
e-mails nomment « Mes sessions », sans lien) ; aucune redirection n'est donc due. Le lien « Gérer mon
compte » des accueils mène à la page-menu.

### Microcopies

| Clé | Français | English |
|---|---|---|
| `account.hub.title` | Mon compte | My account |
| `account.hub.back` | Mon compte | My account |
| `account.hub.items.accountDetails` | Adresse e-mail, pays, langue | Email address, country, language |
| `account.hub.items.accountPreferences` | Les e-mails que vous recevez | The emails you receive |
| `account.hub.items.accountSessions` | Les appareils connectés à votre compte | The devices signed in to your account |
| `account.hub.items.accountData` | Exporter ou supprimer vos données | Export or delete your data |
| `meta.accountHub` | Mon compte — INFLUX | My account — INFLUX |

Supprimées : `account.nav.label` et `account.nav.home` (« Retour à mon espace »). Les libellés
`account.nav.account*` restent, utilisés par le sous-menu et la page-menu. Pour le lecteur d'écran,
le lien de retour est précédé d'un texte masqué visuellement, `account.hub.backPrefix` (« Retour à » /
« Back to »). Phrases à relire par `expert-marketing` (non bloquant).

## Critère de fin

Terminé quand :

- [ ] `pnpm check` puis `pnpm test:e2e` verts ; planchers en hausse depuis le parent de SN-1 ;
- [ ] **un seul repère `navigation`** par page, membres et backoffice, à 375, 768, 1 024 et 1 440 px ;
      **aucun** `<nav aria-label="Mon compte">`, « Comptes » ni « Administration » ; un seul
      `aria-current` ;
- [ ] à 1 440 px : sur `/fr/compte/donnees`, les quatre sous-entrées sous « Compte », « Mes données »
      courante ; sur `/fr/marque`, aucune sous-entrée affichée ; au backoffice, sous-menu de « Comptes »
      sur `/inscrits` et `/inscrits/⟨id⟩` (« Inscrits » courante), de « Administration » pour un
      `admin`, entrée absente pour un `agent` (CA63) ;
- [ ] à 375 et 768 px (membres) : barre du bas sans sous-entrée ; « Compte » → page-menu à quatre
      lignes ; chaque sous-page porte « ‹ Mon compte » et y revient ; focus au `h1` ;
- [ ] backoffice à 900 px : seconde ligne des sous-entrées, aucun défilement horizontal ; à 375 px,
      écran « poste de travail » inchangé ;
- [ ] CGU en attente : page-menu atteignable, « Mes préférences » et « Mes données » aussi, « Mes
      informations » mène à l'écran bloquant ;
- [ ] axe WCAG 2.1 AA + 2.2 AA sans violation sur la page-menu, une sous-page et deux écrans du
      backoffice, à 320, 375, 768, 1 024 et 1 440 px ; aucun défilement horizontal à 320 px ;
- [ ] parité FR/EN ; la page-menu et « Mes informations » ont leurs deux adresses et leur lien de
      langue ; e2e existants verts, **attendus modifiés seulement** pour les adresses, la disparition
      des pilules et de « Retour à mon espace » (liste nommée dans le commit) ;
- [ ] relecture visuelle `expert-ux` ; **accord du fondateur** sur la colonne et la page-menu, sur un
      vrai téléphone ;
- [ ] revue groupée `testeur` + `expert-cybersecurite` (non bloquante sur `main`, exigée avant
      `production`, D71) ; `21` § Jalon SN à jour, une ligne par commit.

## Tests (famille TN)

| # | Niveau | Cas |
|---|---|---|
| TN1 | Unitaire, `member-nav.ts` | Sous-entrées de « Compte » dans l'ordre de `ACCOUNT_PAGES` ; aucune pour « Accueil » ; `activePlaceOf` rend `{ entry, sub }` : page-menu → `{ account, null }`, sous-page → `{ account, accountData }`, accueil → `{ home, null }`, chemin inconnu → `null` |
| TN2 | Unitaire, `member-paths.ts` | `accountHub` et `accountDetails` ont leurs slugs FR et EN, uniques ; `memberPageOfPath` les distingue ; `accountHub` exemptée des CGU, `accountDetails` non |
| TN3 | Unitaire, `bo-nav.ts` | Tests existants verts ; une entrée à un écran n'expose pas de sous-menu ; `/inscrits/⟨id⟩` → `Inscrits` |
| TN4 | Composant, `MemberShell` | Sous-menu rendu dans le `<li>` actif seulement ; un seul `aria-current` ; rubrique ancêtre sans `aria-current` |
| TN5 | Composant, `Shell` (backoffice) | Plus aucun `SectionLinks` ; sous-menu dans le rail ; `agent` sans Administration |
| TN6 | e2e membres | Critère de fin, lignes 2 à 4 et 6 ; lien de langue de la page-menu et de « Mes informations » |
| TN7 | e2e backoffice | Critère de fin, lignes 2, 3 et 5 |
| TN8 | e2e axe | Matrice du critère de fin, ligne 7 |
| TN9 | Garde | Le code ne contient plus `sectionLinkClasses` ni de `<nav>` hors des coquilles (`MemberShell`, `Shell`) : un second repère ne peut pas revenir |

## Commits prévus

Petits commits sur `main`, Conventional Commits, vérification par paliers avant chaque commit
(`CLAUDE.md` §7 règle 5 : code sans base) plus `pnpm test:e2e` pour tout commit qui touche un écran.
Une ligne par commit dans `21` § Jalon SN. Exécution : `dev-react-node` ; tests : `testeur` ; relecture
visuelle : `expert-ux`.

| # | Commit | Livre | Prouve |
|---|---|---|---|
| SN-1 | `feat(web): account hub page` | Page `accountHub` (`/fr/compte`, `/en/account`), « Mes informations » sous `/compte/informations` · `/account/details` ; écran page-menu ; exemption CGU ; « Gérer mon compte » repointé ; microcopies FR/EN | TN2 ; e2e `account` et `account-data` aux nouvelles adresses |
| SN-2 | `feat(web): account sub-entries in the member column` | `member-nav.ts` (sous-entrées, `activePlaceOf`) ; `<ul>` imbriquée dans `MemberShell`, masquée sous `lg` ; états ancêtre et courant ; retrait du `<nav>` d'`AccountShell`, des pilules et de « Retour à mon espace » ; lien « ‹ Mon compte » | TN1, TN4, TN6, TN8 (membres) |
| SN-3 | `feat(backoffice): sub-entries in the rail` | Sous-entrées dans le `<li>` actif du rail ; seconde ligne de 768 à 1 023 px ; retrait de `SectionLinks` | TN3, TN5, TN7, TN8 (backoffice) |
| SN-4 | `refactor(ui): drop the section-link pills` | Retrait de `sectionLinkClasses` et des classes de pilules de section des deux fronts ; garde TN9 | TN9 ; e2e verts |
| SN-5 | `docs(mvp): close the SN milestone` | `21` (une ligne), écarts `EC-SN-*` regroupés ; revue groupée | Revue `testeur` + `expert-cybersecurite` |

Charge estimée : 1,5 à 2 jours.

## Agents et questions posées

| Ordre | Agent | Question |
|---|---|---|
| 1 | `architecte` | Confirmer la seconde ligne du backoffice (768–1 023 px) en CSS seul et la sous-liste masquée sous `lg` (aucune détection en JavaScript, un seul `<nav>`) ; avant SN-2 — **tranchée en SN-0** (2026-10-29) |
| 2 | `dev-react-node` | SN-1 à SN-4 |
| 3 | `testeur` | TN1 à TN9, liste nommée des attendus e2e modifiés |
| 4 | `expert-ux` | Relecture visuelle à SN-2 et SN-3 (état ancêtre, retrait, contraste des sous-entrées) |
| 5 | `expert-marketing` | Relecture des quatre phrases de la page-menu (non bloquant) |
| 6 | `testeur` + `expert-cybersecurite` | Revue groupée de fin de jalon |

`expert-conformite-rgpd` n'intervient pas : aucune donnée personnelle ni aucun texte juridique ne
change. L'exemption CGU de la page-menu n'ouvre aucune donnée (`CLAUDE.md` §7 règle 5).

## Ce qui ne change pas

- Aucune règle de gestion, aucune route d'API, aucune migration ; D48 inchangé.
- Un seul `<nav>` « Navigation principale », restylé par le CSS ; aucune détection de largeur en
  JavaScript ; aucun stockage (D37) ; aucun repli de colonne.
- Barre du bas : cinq entrées au plus, libellés de 11 caractères au plus ; entrées sans écran masquées.
- Backoffice : écran « poste de travail » sous 768 px ou 500 px de haut (F7) ; raccourcis `g` puis n.
- Les canaux d'une conversation restent des onglets dans la conversation (`20` §7).

## Décisions ouvertes

| Sujet | Arbitre | Échéance |
|---|---|---|
| Page-menu pour une rubrique quotidienne (« Relations ») : garder, ou ouvrir directement la première sous-page, selon l'usage constaté | `chef-de-projet` puis fondateur | Lot 4, après deux semaines d'usage réel |
| Rail du backoffice avec les 16 files ouvertes : longueur acceptable à 1 024 × 768 ? Sinon, groupes en intitulés repliés par défaut sauf celui de la file courante | `expert-ux` | Lot 5, première file livrée |

## Risques

| Risque | Parade |
|---|---|
| Un toucher de plus sur téléphone pour chaque page de rubrique | Page-menu porteuse d'information (phrase, compteurs) ; décision ouverte au Lot 4 |
| Le sous-menu des 16 files allonge le rail du backoffice | Ouvert sur l'entrée active seulement (SN-B) ; groupes en intitulés ; décision ouverte au Lot 5 |
| Un second `<nav>` réapparaît dans un écran futur | Garde TN9 ; règle écrite dans `02` §21.5 point 3 |
| Confusion entre rubrique ancêtre et sous-entrée courante | Un seul `aria-current`, surface et filet sur la seule sous-entrée ; relecture `expert-ux` |
| Régression des e2e sur les adresses de « Mon compte » | Attendus modifiés listés nommément dans SN-1 ; aucun autre attendu ne bouge |

## Écarts constatés

- EC-SN-1 (SN-1) : trois parcours e2e gagnent une étape ou un titre au-delà de l'adresse, « Compte » ouvrant la page-menu (exemptée) et non « Mes informations ».
- EC-SN-2 (SN-1) : clé de méta nommée `account.meta.hub` (à côté de `account.meta.details`) au lieu de `meta.accountHub`.
- EC-SN-3 (SN-2) : les bandeaux hors ligne et CGU en attente restent au-dessus de l'en-tête de page, donc de « ‹ Mon compte ».
- EC-SN-4 (SN-2) : sur téléphone, sur une sous-page, « Compte » dans la barre garde l'aspect de la cellule courante sans `aria-current` (le seul est sur la sous-entrée masquée sous `lg`).
- EC-SN-5 (SN-2) : `PAGE_TITLE_CLASSES` passe dans `ui/page-header-classes.ts` pour que `PageHeader` devienne un module client sans que les composants serveur perdent la chaîne de classes.
- EC-SN-6 (SN-2) : jeton dérivé `--spacing-nav-sub-indent` (retrait + icône + écart), dans les `tokens.css` des deux fronts, qui restent identiques.
- EC-SN-7 (SN-3) : le backoffice n'a encore ni fil d'Ariane ni raccourci `g` ; rien à conserver.
- EC-SN-8 (SN-3) : sous 768 px l'écran « poste de travail » n'a pas de navigation ; TN7 vérifie un repère de navigation dès 768 px et aucun à 375 px.
- EC-SN-9 (SN-3) : dans la bande, le `<nav>` prend la place laissée par la déconnexion (`max-lg:flex-1`) pour que la ligne de l'entrée active l'occupe.
