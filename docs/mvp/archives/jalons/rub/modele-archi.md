# RUB-A — Modèle d'architecture du jalon RUB
> `architecte` (grille `integrateur`), 2026-11-25 · F0 « oui a toutes les questions » (un fil, Supabase local) · *M.* motif, *G.* garde, *N.* cas négatifs.

## 1. Composants employés (EC-RUB-4)
Dans `U`, un nom par composant, celui de `02c`, sans préfixe de front (RU-18). Un module E au nom différent est renommé ou fondu par sa ligne : importeurs déplacés dans le commit (import et JSX seuls), ancien fichier supprimé. Hors `U`, une copie d'écran attend sa migration (§2). Un appel existant garde son rendu, sauf ces effets, seuls accordés (F0 Q4, revus en F1) :
- **mesure** d'un composant E ou R employé ramenée à `02a` (taille, écart, rembourrage, rayon, graisse), sans toucher structure, texte, rôle ni comportement ; chaque cas dans le corps du commit ;
- **messages de champ** : `Field` rend C19 (`error`, `warning`) au lieu des encadrés (U27) ; « À vérifier : » seulement s'il est passé ;
- **coquille et cadres** (ligne 10, §5).
Le reste passe par une prop facultative absente des appels actuels (« variante »), ou attend la migration ; sinon `ETAT: arret decision`.

| C | Module RUB (aujourd'hui) | Importeurs | Effet sur un écran non migré | Régime |
|---|---|---|---|---|
| 02 | `PageHeader` | 26 | aucun ; `above` (2 appelants, E11) part à RUE | variante |
| 04 | `Card` | 17 (+28 par classes) | aucun | variante (`compact`, `box`, `link`) |
| 10 | `Button` (← `MemberButton`), types `ButtonVariant`, `ButtonSize` | 36 (+21) | aucun | variante (`sm`, `bar`, `busy`, `added`, `disabledReason`) |
| 13, 14 | `StatusBadge`, `LayerBadge` | 3, 6 | écart icône-mot 4 → 8 (U65) | tout de suite |
| 15 | `RoleBadge` (R) | 2 | mesure seule | tout de suite |
| 16 | `CounterBadge` | 0 | — | libre |
| 17 | `Notice` (R) | 51 | écart 8 → 12, icône 20 → 16 | tout de suite |
| 18 | `Field` (← `FieldFrame`) ; ses quatre contrôles gardés (`02a` C18) | 5 (+4) | messages de champ | tout de suite ; `size`, `width`, `counter`, `FieldGrid` en variante |
| 21 | `ChoiceGroup` (← `MultiChoiceField` + `YesNoField`) | 4 + 3 | aucun ; compteur `role="status"` gardé | variante |
| 23 | `TagPicker` (← `PickListField`) | 4 | aucun ; compteur gardé | variante |
| 25, 26, 32, 48 | `SaveStatus`, `Disclosure`, `Pager`, `FeedCard` neufs | 0 | — | à sa migration |
| 56 | `MemberShell`, ses trois fichiers de `member/` (`02a`) | 1 | E01.0 entier | ligne 10, F1 |

- **SaveStatus** : les trois copies d'écran restent ; C25 n'annonce que l'échec et offre « Réessayer », à câbler par l'écran : RUF (E03, E10), RUG (E07). **TermsDialog** : base C27 à RUE (E11) ; consentement (D63), `Échap` et voile changent le comportement. **ErrorNotice sous un champ** : `Field` dès 05 ; 11 autres dans 6 fichiers d'écran, à leur migration (RUE, RUG, RUI) ; `ErrorNotice` reste pour l'erreur d'une action (`02b` §4). `CampaignFeedCard` : RUG.
- Hors catalogue dans `U`, datés : `VerifiedBadge` (phrase RG10, RG93, D34 ; aspect `StatusBadge` `tone="verified"` dès 03 ; RUI), `ScoreGauge` (RUF). Plusieurs exports si `02c` leur donne des props : `FieldGrid`, `MissingList`, `MobileActionBar`, `ShortcutsDialog`. Nom double : le premier (`EmptyState`, `Pager`, `LogoPlate`, `OtpField`). C01 rend un `div`, `main#main` reste à la coquille (`E01a` §7 contre `#contenu` de `02a`, EC-RUB-A-1).
- *M.* un écran non migré ne change que de mesures ; renommer maintenant évite deux noms aux jumeaux BO (RUC). *G.* cas `RUB-E` : balisage statique d'un appel existant par variante employée, égal au littéral relevé avant la ligne, effets listés exceptés. *N.* une classe changée hors liste.
- *G.* `findCatalogueProblems` (test-kit, ligne 01) : ensemble exact des `.tsx` de `U` (catalogue, contrôles de C18, exceptions datées) ; aucun `index.ts`. *N.* `MemberButton.tsx` rétabli, module hors liste, baril.

## 2. Copies d'écran en sursis
- *G.* `findTransitionalCopies(root, rules)` (ligne 01, commentaires ôtés) : une règle = motif + fichiers permis ; signale un fichier hors liste qui l'emploie et une entrée périmée (le jalon qui migre l'écran la retire). Règles : `role="status"|aria-live` (38 fichiers + `Announcer.tsx`, renommages de 05 et 06 suivis) ; `function SaveStatus` (3 + `SaveStatus.tsx`) ; `<ErrorNotice … announce={false}` (6) ; `<details` (5 + `Disclosure.tsx`) ; `<dialog` (`TermsDialog.tsx` + C27, C28). *N.* 40ᵉ fichier, entrée périmée.
- **Announcer** (01) : `AnnouncerProvider` (une région `role="status"` hors écran, `data-announcer`, vidée puis écrite) et `useAnnouncer()`, qui lève hors fournisseur (*M.* une annonce perdue se tait, l'erreur sort au premier e2e). Montée par la coquille (10) et la planche ; pages autonomes : avec C50 (RUE). Aucun composant de RUB n'écrit sa région, sauf les compteurs visibles de C21 et C23 (lus par des specs).

## 3. `SHARED_CATALOGUE` avant RUC (EC-RUB-3)
- `{ name, backoffice: "pending" | "delivered" }[]` (`charter-data.ts`, ligne 01 ; chaque ligne ajoute ses entrées) : les 38 du jalon dont `07a` cite un écran BO (E04, E05, E05b.2, E06, E13, E16, E17, E19, E21) ; C04, C20, C25, C37, C39, C41, C42, C48, C51, C56, C68 restent membres.
- Toujours : `U/<name>.tsx` exporte `export type <name>Props`, autonome (types de `react`, du module ou de son `-classes.ts`) ; `packages/ui` : `exports` = `./tokens.css`, `./fonts`, aucun `.tsx`. `pending` : `apps/backoffice/src/components/ui/<name>.tsx` absent. `delivered` : présent, même texte normalisé (commentaires ôtés, blancs réduits).
- *M.* le côté web tient déjà la forme commune ; un jumeau n'arrive qu'en basculant l'entrée, donc avec l'égalité. Échéance : clôture de RUC, aucune `pending` sauf report nommé au reliquat. *N.* prop d'un seul côté, jumeau présent en `pending`, module absent, prop typée de `@influx/contracts`, `.tsx` dans `packages/ui`.

## 4. Planche
- Une page (`page.board.tsx`, serveur), une section par composant, `data-board-component` = nom en kebab (`badge` scindé en `status-badge`, `layer-badge`, `role-badge`, `counter-badge` en 03). Section à état : son fichier `"use client"` (`useState` seul) ; premier rendu sans hydratation. Ensemble final (`.board.tsx`) : `page`, `board-section`, `structure` (01 : C01-C03), `announcer` (01), `button` (02 : C10, C11), `surface` (02 : C04, C05, C12), `badge`, `notice` (03), `list` (04), `field` (05), `choice` (06), `dialog` (07), `wizard` (08), `card` (09a), `reading` (09b) ; chaque ligne étend `expectedFiles` et `COMPONENTS`.
- C02 rend un `h1` par cellule : RUA-T8 compte exactement 1 `h1` hors des cellules `page-header` et 1 par cellule (garde nommée, exacte). Fixes ou collants (C39, pied de C41) : cellule `contain: layout`, jamais sur la planche.
- 4 s inchangées ; au-delà de 2 s mesurées en CI, la ligne suivante scinde par famille (`state-board/<famille>/page.board.tsx`).
- e2e dans `state-board.spec.ts` seul : RUA-T8 étendu (RUB-AX : sections, débordement, axe à 375 et 1 440, une passe par largeur) ; `RUB-AN2 <ligne>` (1 440 : styles calculés des lignes « À créer » de `04` §3, puis AN-1 sous `reducedMotion`) ; clavier et anneau de focus (RUAT-6) dans T7, T8, T9. Balisage et ARIA : unitaire.

## 5. Coquille et cadres (CA08, ligne 10)
- `pageFrameClasses(variant)` (`page-frame-classes.ts`, 01) porte C01 ; en 10, `SPACE_SCREEN_CLASSES` = `narrow`, `PROFILE_PAGE_CLASSES` (et alias) = `wide` : bord du `h1` à 304 px à 1 440 sur toute page de l'espace, sans migrer d'écran. `SCREEN_CLASSES` (parcours, erreurs, pages légales) garde sa chaîne, détachée.
- Effets : pages étroites alignées à gauche, largeur utile 672 → 768 px dès 1 280 ; pages larges à gauche au-delà de 1 456 px ; E01.0 (langue en pilule, bloc d'état en texte, pied à la largeur du contenu). *G.* unitaire : ces égalités, aucun `mx-auto` dans `pageFrameClasses`, `SCREEN_CLASSES` littéral ; T10 : même bord sur une page étroite et une large, à 1 024 et 1 440. *N.* cadre recentré.
- Appelants avant RUE : C01 (classes), C11 (bloc d'état), C19 (par `Field`), C29 (coquille) ; les E gardent les leurs.

## 6. Outil de comparaison (EC-RUB-5, RUAT-3, RUAT-8)
- Couple = écran × état de maquette : `id` `E01.0:marque-neuve` (`/^E\d{2}[a-z]?(?:\.\d)?:[a-z0-9-]+$/`, état = `mockup.state`) ; `matrix[].name` = ligne `E01.0-S07` du même écran. *M.* `S` est une ligne de matrice (`E01a` §3), pas un état. *N.* `E01.0-S02` en id, état différent, ligne d'un autre écran.
- `app.spec.ts` sous `E2E_VISUAL=app` seul ; `mockup` l'ignore. `app: { front, path, load }`, `load` = options d'un chargeur de `support/recette.ts` (`05` §4) ; connexion en temps réel, puis `clock.install(MOCKUP_INSTANT)`, `pauseAt`, navigation, `runFor(SETTLE_DELAY_MS)` ; dates écrites par le chargeur : `current-time` ; e-mail : `account-email`. Zones N3 en 11 : colonne, en-tête, barre du bas ; contenu (E01.1) exclu avant RUE.
- `visual-compare.test.ts:415` : l'ensemble exact des couples de 11 remplace « vide ». Plancher `app` (4) dans un module à part, lu par le test de X1 (RUAT-4).
- Échantillon CI (grille `integrateur`) : aucun en RUB, `app` exige la pile des éclats et les 20 s sont sans marge ; `mockup` rejoué en local à 11 et à C ; en CI : comparateurs, `coupleProblems`, planchers, aucune image. Rouvert à RUE (job de fusion, budget chiffré). `ci.yml`, `next.config.ts` intacts : aucun marqueur I-4 imposé par A.

## 7. Aucun octet dans les routes
- Une route n'embarque que ce qu'elle importe. *G.* `findCatalogueProblems`, règle `uncalled` (modules de RUB sans appelant avant RUE) : un module produit (hors `U` et `*.board.*`) qui en importe un est signalé ; RUE retire l'entrée qu'il câble. *N.* import depuis un écran.
- La feuille grossit (Tailwind lit les sources) : qui lit `--color-logo-plate` (03), `--color-skeleton-*` (04), `--effect-photo-*` (09a ; `photo-card-classes.ts` entre dans `PHOTO_EFFECT_READERS`) retire son entrée de `UNREAD_JUSTIFIED`.
- Mesure en C : JavaScript de première visite par route (`next build`), `5ced42b` contre la tête, +5 % au plus.

Aucune dépendance nouvelle ; aucune garde assouplie.
