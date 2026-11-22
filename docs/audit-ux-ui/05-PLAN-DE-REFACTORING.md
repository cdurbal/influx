# 05 — Plan de refactoring progressif

> Ordre de réalisation des propositions de `03`, à partir des règles de `04`. **Rien n'est lancé
> sans validation du fondateur.** Ce plan n'est pas un lot. S'il est retenu, `chef-de-projet` le
> découpe en jalons par la chaîne habituelle (`/lot-decoupe` → `/jalon-prepare` → `/jalon-run`,
> D77), avec la cadence de tests D76. Efforts en jours de développement, tests compris : ordres de
> grandeur.

## Vue d'ensemble

| Phase | Contenu | Effort | Prérequis | Quand |
|---|---|---|---|---|
| 0 | Décisions et mises à jour des spécifications | Pas de code | — | Tout de suite |
| 1 | Corrections rapides à fort impact, dont l'accueil de première visite | 6 à 8 j | Phase 0 pour 4 points | Avant le Lot 4 |
| 2 | Primitives de composition et tokens | 6 à 9 j | `04` validé | Avant les écrans du Lot 4 |
| 3 | Écrans quotidiens des membres et checklist d'activation | 10 à 14 j | Phase 2 | Pendant le Lot 4 |
| 4 | Formulaires longs | 5 à 7 j | Phase 2, arbitrages RG4 et C4 | Pendant le Lot 4 |
| 5 | Backoffice, poste de travail | 10 à 15 j | Phase 2, appels API | Avant ou au début du Lot 5 |
| 6 | Micro-interactions et finitions | 3 à 5 j | Phases 2 à 5 | Avant la recette du Lot 6 |

**Pourquoi cet ordre.** Le Lot 4 va créer les écrans les plus riches du produit : mises en
relation, conversation à trois, documents. S'ils naissent avec les primitives (sections, panneaux,
propriétés, dialogue), ils n'auront pas à être repris. Le Lot 5 étendra les files et la fiche de
compte : le cadre de décision unique et les tableaux denses doivent exister avant.

## Phase 0 — Décisions (aucun code)

| # | Décision | Qui | Bloque |
|---|---|---|---|
| 0.1 | Valider la direction artistique (`04`) et l'intégrer à `20` §11 (règle d'or : la spécification d'abord) | Fondateur, puis `expert-ux` | Phases 2 à 6 |
| 0.2 | Règle des étiquettes de couche : une fois par groupe, exception par champ (C4, écart à la décision du 2026-11-06) | Fondateur | C4 |
| 0.3 | Accueils : `h1` « Accueil », blocs « À traiter » et « Dernières campagnes ouvertes », accueil de première visite, tâches de la checklist d'activation, libellés d'action ; microcopies FR et EN (B1, B2, B5, B6, C13, D6) | Fondateur, `expert-marketing` pour les textes | B1, B2, B5, B6, C13 |
| 0.4 | Carte du fil sans bouton, carte de résultat compacte (D1, D5 ; `17` §7.1) | `product-owner` avec `expert-matching` | D1, D5 |
| 0.5 | « Soumettre » toujours visible (RG4) contre une seule action principale sur mobile (C6) | `product-owner` | C6 |
| 0.6 | Ordre des blocs de décision (`17b` §2.5) et de la fiche (`15` RG41) ; lien vers la fiche depuis une entrée (E1, F1, F2) | `product-owner` | E1, F1 |
| 0.7 | Colonne d'identité avec adresse masquée dans « Inscrits » (F3) | `product-owner`, `expert-conformite-rgpd` | F3 |
| 0.8 | Appels `apps/api` : compteurs des 9 files, campagnes d'un compte, nom et adresse masquée (B3, B4, F1, F2, F3) | `architecte` | Phase 5 |
| 0.9 | Exception `matchMedia` pour la fenêtre étroite du backoffice (E6) | `architecte` | E6 |
| 0.10 | Longueurs nouvelles (`04` §1) | `expert-ux` | Phase 2 |
| 0.11 | **Test e2e de la confirmation d'identité** (levée de désinscription), pour confirmer ou écarter le double envoi (U41) | `testeur` | F4, à faire en premier |
| 0.12 | Retirer « Enregistrer et quitter » de `17` §4.3 (rendu inutile par l'enregistrement automatique) | `product-owner` | — |
| 0.13 | Autoriser le brouillon de campagne avant la publication du profil de la marque, la soumission restant conditionnée (critère CA2 ; principe « pas de prérequis secondaire sur le chemin du but » du guide d'onboarding) | **Tranchée le 2026-11-22 (D86) : oui** | B7, volet règle |

## Phase 1 — Corrections rapides (6 à 8 jours)

| Proposition | Constats | Écrans | Composants | Difficulté |
|---|---|---|---|---|
| C1 Publier dans la barre mobile | U02 | Profil créateur | `CreatorProfileScreen`, `creator-publication-view` | Faible |
| C2 Choisir puis ajouter | U03 | Profils, campagne | `CreatorNetworksFields`, `PickListField` | Faible |
| G1 Déconnexion dans la page-menu | U04 | Compte | `AccountHub` | Faible |
| B1, variante minimale | U01 | Accueil créateur | `MemberHome`, `CreatorHomeCard`, locales | Faible |
| G2 Un seul cadre de page | U09 | Toutes les pages membres | `auth-classes`, `brand-profile-classes`, `AnonymousProfileScreen` | Faible, beaucoup d'écrans touchés |
| Alias `logo-plate` | U16 | Fil, fiche, aperçu, profil | `campaign-classes`, `LogoField`, `tokens.css` | Faible |
| C7, partie 1 : erreurs effacées, `FieldMessage` | U25, U27 | Entrée, profils | `EmailStep`, `SignupDetailsStep`, `FieldFrame`, `ErrorNotice` | Faible |
| C10 : tri, `SaveStatus`, droits d'usage | U29, U31, U32 | Profils, campagne | `brand-profile-options`, 3 copies de `SaveStatus`, `CreatorOfferFields` | Faible |
| D2, D3 Recherche mobile, annonces | U11, U12 | Recherche, fil | `CreatorSearchScreen`, `AddToSelectionButton`, `CampaignFeedScreen` | Faible |
| E2 Rendre la main en revenant | U35 | Décisions | `ClaimedEntryFrame`, `BrandReviewEntryScreen`, `use-claimed-entry` | Faible |
| E4, partie 1 : nom en lien, `nowrap`, chiffres à droite | U38 | Files, inscrits | `QueueTemplate`, `bo-classes`, `AccountsScreen` | Moyenne (sélecteurs e2e) |
| F4 Confirmation d'identité hors du formulaire | U41 | Fiche, invitations, réglages | `ActionFeedback` et ses appelants | Faible |
| F5 Vue identifiée et finitions du backoffice | U42, U57 | Fiche créateur, double validation | `AccountCreatorBlocks`, `BoIdentifiedFrame`, `DualControlScreens`, `Shell` | Faible |
| C5 Formats groupés par réseau | U23 | Profil marque | `ProfileFields`, `creator-profile-options` (`splitFormatGroups`) | Faible |
| B5 Accueil de première visite (après 0.3) | U60, U47 | Fin d'inscription, accueils | `AuthFlow`, `MemberHome`, `BrandHome`, locales | Faible |
| B7, règles actuelles : message juste, délai annoncé | U59 | Accueil, campagnes de la marque neuve | `CampaignListScreen`, `BrandHome`, locales | Faible |
| C12 Écran 3 groupé par sujet | U62 | Inscription | `SignupDetailsStep` | Faible |
| C13 Libellés d'action (après 0.3) | U63 | Entrée, compte, profils, campagne | Locales FR et EN | Faible (sélecteurs e2e par nom de bouton) |
| E5, parties 1 et 2 : fil d'Ariane, « `g` puis n » | U44 | Coquille du backoffice | `Shell`, `bo-nav`, `activePlaceOf` | Faible |
| D9, C11, G3 Finitions | U34, U47, U48, U53, U55, U58 | Aperçu, entrée, recherche | `CreatorPreviewScreen`, `AuthFlow`, `EmailStep`, `CodeStep` | Faible |

- **Risques** :
  - les specs e2e qui ciblent des libellés ou des structures (`brand-profile.spec.ts` attend la
    déconnexion masquée à 375 px ; les specs de file attendent la colonne « Ouvrir ») ;
  - le cadre de page touche le halo d'en-tête (`charter-rendering`).
- **Tests** : `pnpm check:fast`, puis les specs de chaque écran (liste en fin de document).

## Phase 2 — Primitives de composition (6 à 9 jours)

| Livrable | Constats traités à la migration | Composants touchés |
|---|---|---|
| Tokens de `04` §1 (alias et longueurs) | U16, U20, U50 | `packages/ui/src/styles/tokens.css`, `tokens-backoffice.css` |
| `Section`, `InnerPanel` (membres et backoffice) | U28, U37, U46 | `member/ui/`, `bo-classes`, cartes des profils, panneaux de décision, `SyncBlock`, `ReplayPanel` |
| `EmptyState`, `StateMessage` | U18 | Une vingtaine d'états (`01` U18) |
| `CardActions` | U45 | Accueils, sélections, états |
| `Skeleton` | U20 | Coquille, listes, profils, campagne |
| `ErrorSummary` | U26 | Inscription, profils, campagne |
| `PropertyList` | U36, U07 (préparation) | `ReviewBlocks`, blocs des fiches |
| `RowList` | U13, U17 (préparation) | — (utilisé en phase 3) |
| `Dialog`, `Announcer` | U41, U12 | `ActionFeedback`, recherche |
| `ActivationChecklist` | U61 (préparation) | — (utilisé en phase 3, `04` §13) |
| G4 Espacement décroissant : variante compacte de `Card`, écart icône → libellé à 8 px | U64, U65 | `card-classes`, `status-badge-classes`, `layer-badge-classes`, `VerifiedBadge`, `PickListField` |
| C8, C9 | U28, U30, U49 | `CreatorNetworksFields`, `CreatorAudienceFields`, `CreatorProfileFields`, `CampaignBudgetFields` |

- **Dépendances** : `04` validé (0.1) ; longueurs validées (0.10).
- **Risques** :
  - les tests de charte (`packages/test-kit/src/charter-data.ts` : alias hérités, paires de
    classes interdites ; `keo-tokens.artifacts.ts`) doivent connaître les nouveaux alias ;
  - la règle « aucun `[tabindex]` générique » s'applique aux dialogues.
- **Tests** : `member-primitives.spec.ts`, `charter-rendering`, `charter-cascade`,
  `charter-headings`, `member-ui.test.ts`, `guards.test.ts`, `pnpm -r run test:artifacts`, passes
  axe des specs touchées.

## Phase 3 — Écrans quotidiens des membres (10 à 14 jours)

| Proposition | Constats | Écrans | Dépend de |
|---|---|---|---|
| B6 Checklist d'activation | U61 | Accueils marque et créateur | 0.3, `ActivationChecklist` (phase 2) |
| B7, volet règle (D86, CA2-bis) | U59 | Campagnes de la marque neuve | Front seul : l'API ne conditionne que la soumission ; test base à ajouter |
| B1 complet | U01 | Accueil créateur | 0.3, `RowList` |
| B2 | U08, U46 | Accueil marque | 0.3, `RowList`, `CardActions` |
| D4 | U13 | Mes campagnes | `RowList` |
| D5 | U14 | Fil créateur | 0.4 |
| D1 | U10 | Recherche, sélection, profil anonyme | 0.4 |
| D7 | U17 | Sélections | `RowList`, D1 |
| D6 | U15 | Fiche et aperçu de campagne | À faire **avec la candidature C7 du Lot 4**, qui touche la même fiche |
| D8 | U19 | Campagne publiée | `CampaignReadBody` existant |

- **Risques** :
  - `data-*` attendus par `brand-campaign*.spec.ts`, `brand-creator-search.spec.ts`,
    `brand-creator-shortlists.spec.ts`, `creator-campaigns.spec.ts` et `campaign-record.spec.ts`
    (ils sont à conserver sur les nouveaux éléments) ;
  - D1 change la carte spécifiée de `17` §7.1 : spec à amender d'abord ;
  - aucun montant ne doit apparaître côté créateur (D78) : relire chaque carte.

## Phase 4 — Formulaires longs (5 à 7 jours)

| Proposition | Constats | Écrans | Dépend de |
|---|---|---|---|
| C3 Accordéon mobile | U21 | Profil créateur | Mécanisme du profil marque |
| C4 Étiquettes de couche | U22 | Profils, campagne | 0.2 |
| C6 Barre de campagne | U24 | Campagne | 0.5 |
| C7, partie 2 : `ErrorSummary` partout | U26 | Entrée, profils, campagne | Phase 2 |
| C10, reste | U33, U50, U51, U52, U54 | Compte, profils, campagne | Token `--size-input-number` |

- **Risques** :
  - le focus vers un champ manquant doit d'abord ouvrir sa section (`flushSync`, comme côté
    marque) ;
  - la reprise après rechargement (`creator-profile.spec.ts`) ;
  - le libellé et la position de « Soumettre » (`brand-campaign.spec.ts`, l. 680 à 720).

## Phase 5 — Backoffice, poste de travail (10 à 15 jours)

| Proposition | Constats | Écrans | Dépend de | Difficulté |
|---|---|---|---|---|
| E1 Cadre de décision unique en deux colonnes | U36 | 9 décisions | 0.6, `PropertyList`, `--spacing-bo-panel-w` | Élevée (3 cadres à fusionner) |
| E3 Une surface par écran | U37 | Décisions, fiche, réglages | `InnerPanel` | Moyenne |
| E4, partie 2 : colonnes fusionnées, pagination, filtres | U38, U56 | Files, inscrits | — | Moyenne |
| B3, B4 Accueil et rail avec compteurs | U05, U40 | Accueil, rail | 0.8 (appel des compteurs) | Moyenne |
| F2 Liens et campagnes d'un compte | U06 | Décisions, recherche, fiche | 0.8 | Moyenne |
| F1 Fiche en trois zones | U07 | Fiche de compte | 0.6, F2, `PropertyList` | Élevée |
| F3 Inscrits identifiables | U39 | Inscrits | 0.7, 0.8 | Moyenne |
| E5, parties 3 et 4 : dialogue `?`, puis `⌘K` | U44 | Coquille | Parties 1 et 2 (phase 1) | Moyenne (`?`) à élevée (`⌘K`) |
| E6 Fenêtre étroite | U43 | Coquille | 0.9 | Moyenne |

- **Risques** :
  - le verrou et l'échéance figée (D81) ne doivent pas changer de comportement ;
  - chaque nouveau lien vers une fiche est une lecture journalisée, annoncée par ▮ ;
  - les files 8 et 10 à 16 et le pipeline (Lot 5) s'appuieront sur le cadre unique : le livrer
    avant ;
  - la double validation d'administration (D84) reste sous contrôle d'un pair.
- **Tests** : `backoffice*.spec.ts` (dont `backoffice-queue`, `backoffice-ops-screens`,
  `backoffice-team-selection`, `backoffice-identified-search`), `verification-*.spec.ts`,
  `campaign-review.spec.ts`, `portfolio-queue.spec.ts`, `creator-queue.spec.ts`, tests de
  `apps/backoffice/tests` (`*-view.test.ts`, `bo-nav*.test.ts`) ; suite base pour tout nouvel
  appel API.

## Phase 6 — Micro-interactions et finitions (3 à 5 jours)

- Catalogue de `04` §12 : accordéons, dialogues, panneaux mobiles, état « Ajouté », compteurs,
  lignes nouvelles, changement d'étape, balayage des squelettes.
- Recette dédiée :
  - `prefers-reduced-motion` activé (aucune transformation, état final lisible) ;
  - téléphone réel (barres collantes, zone de geste iOS) ;
  - clavier seul sur un parcours par espace ;
  - lissage des polices sur Mac (RK-7).
- **Tests** : `charter-*`, passes axe, `member-shell.spec.ts`, puis `pnpm check` et
  `pnpm test:e2e` complets avant la revue groupée.

## Risques transverses

| Risque | Prévention |
|---|---|
| Specs e2e couplées à la structure du DOM | Conserver les attributs `data-*` et les rôles ; quand une structure change (carte devenue ligne), modifier la spec dans le même commit |
| Dérive de la charte | Toute valeur passe par un token ; nouveaux alias déclarés dans `charter-data.ts` ; aucune couleur nouvelle |
| Vitrine touchée par erreur | Rien dans `components/landing` ni `ui/` de la vitrine ; `vitrine-unchanged.spec.ts` en garde-fou |
| Régression d'invariant métier | Relire chaque écran pour le régime transitoire : aucun taux, aucun montant côté créateur, anonymat, aucune coordonnée de l'autre partie |
| Traductions | FR et EN dans le même commit, à chaque microcopie |
| Sessions concurrentes sur le même arbre | Un jalon par zone (membres, backoffice) ; diff relu avant `git add` |
| Écrans du Lot 4 bâtis sur l'ancien modèle | Phase 2 terminée avant le premier écran du Lot 4 |

## Specs de non-régression par zone

| Zone | Specs Playwright (`apps/web/e2e/`) | Tests unitaires |
|---|---|---|
| Entrée | `signup-nominal`, `journey-screens`, `journey-resume`, `landing-signup` | `auth-steps`, `signup-form`, `journey-memory` |
| Coquille et compte | `member-shell`, `account`, `account-screens`, `account-data`, `account-creator` | `member-nav`, `member-nav-ui`, `account-view` |
| Profil marque | `brand-profile`, `verification-brand` | `brand-profile-form`, `brand-profile-view` |
| Profil créateur | `creator-profile`, `creator-portfolio`, `creator-preview`, `verification-creator`, `verification-lifecycle` | `creator-*-view` |
| Campagnes | `brand-campaign`, `brand-campaign-states`, `campaign-record`, `campaign-review`, `creator-campaigns` | `campaign-view`, `campaign-preview-view`, `open-campaigns-view` |
| Recherche et sélections | `brand-creator-search`, `brand-creator-shortlists` | `creator-search-view`, `shortlists-view` |
| Charte et primitives | `member-primitives`, `charter-rendering`, `charter-cascade`, `charter-headings`, `vitrine-unchanged`, `global-net` | `member-ui`, `guards`, `keo-tokens.artifacts` |
| Backoffice | `backoffice`, `backoffice-queue`, `backoffice-ops-screens`, `backoffice-auth-screens`, `backoffice-team-selection`, `backoffice-identified-search`, `portfolio-queue`, `creator-queue`, `verification-*` | `apps/backoffice/tests` |
