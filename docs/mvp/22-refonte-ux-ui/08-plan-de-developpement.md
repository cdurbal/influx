# 08 — Plan de développement du Lot 3bis

> Découpage au format de la chaîne D77 : `../jalons/lot3bis-plan.md`. Ici : les tâches. Une tâche = un commit
> (parfois deux) ; `W` = `apps/web/src/components`, `B` = `apps/backoffice/src/components`. Aucun code n'est
> commencé avant la validation du fondateur.

## 1. Principes

1. **Décisions → spécifications → socle → composants → lectures d'API → écrans → recette.** Un écran ne
   commence pas si une de ses questions bloquantes est ouverte (`06a`).
2. Un jalon livre des écrans **démontrables sur `staging`** et validés un par un par le fondateur (`05` §8).
3. Un composant est livré une fois, avec sa planche d'états et ses tests, avant le premier écran qui l'emploie.
4. Migration par écran entier : jamais un écran à moitié ancien. Les anciens composants sont supprimés dans le
   commit qui retire leur dernier appelant.
5. FR et EN dans le même commit ; specs e2e modifiées dans le même commit que la structure.
6. Critères communs à toute tâche d'écran : `CA` de sa fiche, N1 à N3, axe 0, clavier, `05` §5 et §7.
7. Complexité : S < 1 j, M 1 à 2, L 2 à 3, XL > 3, tests compris.

## 2. Ordre et dépendances

```
RUA ─► RUB ─► RUE entrée, accueils, compte ─► RUI vérifications, page de marque ─► RUF profils ─► RUG campagnes
 │      ├────────────────────────────► RUH recherche, profil anonyme, sélections, aperçu créateur
 │      └─► RUC-07 (cartes et filtres identifiés)
 ├──► RUC composants et coquille BO ─► RUJ files et décisions ─► RUK fiches, recherche, admin
 │                                      ▲ RUI-05 (version soumise, RUJ-05)
 └──► RUD lectures d'API (si RU-21 = B) ─► avant chaque écran qui les lit
Tous ─► RUL recette intégrale ─► Lot 4
```

Un seul fil : A, B, D, E, I, F, G, H, C, J, K, L. Deux fils possibles, avec deux points de rencontre : le fil
backoffice avance seul sur RUC-00 à RUC-06, RUC-08 et RUJ-01 à RUJ-04 ; RUC-07 attend RUB-07 et RUB-09, RUJ-05 attend
RUI-05. Un lien vers un écran pas encore refondu mène à l'écran actuel ; vers une route pas encore créée, il
n'est pas rendu.

**Tâche de tête de jalon** (`-00`, ou `-01` quand elle porte les textes EN) : amender les spécifications du jalon
(`06b` §4, `06a`), obtenir la réponse à chaque question des écrans du jalon, l'écrire, inscrire les écarts accordés.

## 3. RUA — Socle (8 commits)

| ID | Objectif | Écrans | Composants | Prérequis | Zones de code | Critères | Tests | Cx |
|---|---|---|---|---|---|---|---|---|
| RUA-00 | Amender la charte et l'architecture, inscrire les décisions transverses | tous | — | RU-00 à RU-20 tranchées | `docs/mvp/20`, `02`, `04-DIRECTION-ARTISTIQUE`, `decisions*.md` | Charte et architecture amendées ; les spécifications de domaine le sont en tête de chaque jalon | — | L |
| RUA-01 | Tokens de `03` §3 et gardes | tous | — | RUA-00 | `packages/ui/src/styles/tokens.css`, `tokens-backoffice.css`, `packages/test-kit/src/charter-data.ts` | Valeurs égales aux maquettes ; vitrine inchangée | `guards`, `keo-tokens.artifacts`, `vitrine-unchanged`, contrastes | M |
| RUA-02 | Points de rupture, images clés et tokens `--animate-*` | tous | — | RU-03, RU-06 | idem, `globals.css` des deux fronts | AN-1, AN-3, AN-4 | `charter-rendering` | M |
| RUA-03 | Outillage de comparaison (maquette rendue et application : N1, N2, N3) | tous | — | RUA-01 | `apps/web/e2e/support/`, nouvelles specs `visual-*` | Maquette contre elle-même : 0 écart ; écart volontaire détecté | spec de l'outillage | XL |
| RUA-04 | Jeu de données de recette | tous | — | RUA-03 | `apps/web/e2e/fixtures/` | Mêmes données que les maquettes, synthétiques | — | L |
| RUA-05 | Planche d'états : page interne de test des composants (hors production) | — | tous | RUA-01 | `apps/web/e2e/`, aucune route de production | Inaccessible en production | garde de build | M |
| RUA-06 | Planche des états non dessinés, sur laquelle RU-27 est tranchée | tous | C08, C09, C17, C20 | RUA-01 | documentation | Accord du fondateur par famille | — | M |
| RUA-07 | Skill `design-system-influx` et `references/` | — | — | RUA-00 | `.claude/skills/design-system-influx/` | `SKILL.md` ≤ 10 Ko | — | S |

## 4. RUB — Composants membres (10 commits)

| ID | Objectif | Composants | Prérequis | Zones de code | Critères | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUB-01 | Page et sections | C01, C02, C03, C29 | RUA-01 | `W/member/ui/` | `02a` §1 ; un `h1` ; halo entier | `charter-*`, `member-ui` | M |
| RUB-02 | Surfaces et actions | C04, C05, C10, C11, C12 | RUB-01 | idem, `button-classes`, `card-classes` | Trois niveaux de surface au plus | `member-primitives` | M |
| RUB-03 | Badges, notices, logos | C13 à C17, C33, C38 | RUB-01 | `status-badge-classes`, `LayerBadge`, `Notice` | 8 px icône-texte | `charter-rendering` TK4.2 | M |
| RUB-04 | Listes et lecture | C06, C07, C08, C09 | RUB-01 | nouveaux modules | 10 variantes de `RowList` | unitaires, visuel | L |
| RUB-05 | Champs et messages | C18, C19, C20, C21 | RUB-02 | `FieldFrame`, `TextField`… | Erreur sans décalage ; résumé focalisé | `member-primitives`, unitaires | L |
| RUB-06 | Choix et divulgation | C22 à C26, C47 | RUB-05 | `PickListField`, `SaveStatus` ×3 | Aucune action au changement | unitaires | L |
| RUB-07 | Dialogues et filtres | C27, C28, C30, C32 | RUB-02 | remplace la base de `TermsDialog` | Focus rendu ; `Échap` | e2e, axe | L |
| RUB-08 | Assistant | C41, C42, C49, C51 | RUB-06 | nouveaux modules | « Continuer » jamais bloquant | unitaires, e2e | L |
| RUB-09 | Cartes et lecture riche | C31, C34 à C37, C39, C40, C48, C66, C68 | RUB-02, RU-02, RU-04 | nouveaux modules | Clavier sur carrousel et galerie | visuel, axe | XL |
| RUB-10 | Coquille des membres | C56 (E01.0) | RUB-01, RUB-03 | `W/member/MemberShell.tsx`, `MemberNav.tsx` | `E01.0-CA01` à `CA08` | `member-shell`, `member-nav*` | M |

Restent livrés avec leur écran : C43, C50 (RUE), C44 à C46 (RUF, RUG), C52, C64, C65 (RUI), C54, C55 (RUH).

## 5. RUC — Composants et coquille du backoffice (9 commits)

| ID | Objectif | Composants | Prérequis | Zones de code | Critères | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUC-00 | Spécifications du jalon | — | RU-18 à RU-20, RU-39 | `17b`, `02` | Réponses écrites | — | S |
| RUC-01 | Primitives BO aux noms et props des membres | C01 à C05, C07, C08, C10 à C13 | RUA-01, RU-18 | `B/ui/` (nouveau), `bo-classes.ts` | Densité 14 px, 28 px, 36 px | `guards`, `charter-*` | L |
| RUC-02 | Formulaires, choix, dialogue, divulgation | C18 à C23, C26, C27 | RUC-01 | `ActionFeedback`, `*ReasonPicker` | Motifs typés ; identité hors formulaire (U41) | `backoffice.spec` | L |
| RUC-03 | Tableau, filtres, pied | C30, C32, C58, C63 | RUC-01 | `QueueTemplate`, `QueueFilterBar`, `DenseTableRegion` | Lien étiré ; `j`, `k`, `Entrée` | `queue-view-model`, `backoffice-queue` | L |
| RUC-04 | Coquille : rail, bande, fil d'Ariane, raccourcis | C57 | RUC-01, RU-19, RU-39 | `Shell`, `BoNav`, `bo-nav` | `E04` (coquille) | `bo-nav*` | L |
| RUC-05 | Décision : cadre unique | C59, C60 | RUC-02, RU-39 | `ClaimedEntryFrame`, `BrandReviewEntryScreen`, `VerificationEntryScreen` | Verrou, échéance figée (D81), journal inchangés | `claimed-entry-view`, `backoffice-queue` | XL |
| RUC-06 | Fiche et vue identifiée | C53, C61, C62 | RUC-01 | `BoIdentifiedFrame` | Lecture journalisée une fois | `account-*-view` | M |
| RUC-07 | Cartes et filtres identifiés | C28, C31 (`identified`) | RUB-07, RUB-09, RUC-06 | `Identified*` | Violet réservé | `identified-search-view` | M |
| RUC-08 | Fenêtre trop petite | C67 (E19.1) | RU-20 | `Shell`, `tokens-backoffice.css`, garde l. 520 | Aucune page montée à l'arrivée ; page déjà montée selon RU-20 ; aucune lecture ni prise en charge | `guards`, e2e | M |

## 6. RUD — Lectures d'API additives (9 commits, si RU-21 = B)

| ID | Objectif | Écrans servis | Prérequis | Zones de code | Critères | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUD-00 | Contrats et droits écrits avant le code | tous | RU-21 à RU-25 | `02`, `03`, `04` | Relus `architecte`, `expert-database`, `expert-cybersecurite` | — | M |
| RUD-01 | Compteurs, retards et prises en charge transverses, nom de l'agent | E04, E16 | RU-21 | `apps/api` (files), `packages/contracts` | Droits de chaque file ; aucune lecture identifiée sans journal | T2, T14, base | L |
| RUD-02 | Par compte : entrées à traiter, campagnes, activité | E06 | RU-21 | idem | Journal, sans montant | T2, T14 | XL |
| RUD-03 | Identité et profil créateur dans la fiche ; libellé de `next` ; motif et historique | E05, E06 | RU-21, avis RGPD | idem | RG42, journal | T1, T2 | L |
| RUD-04 | Recherche identifiée : visuels, titre, campagnes, responsables | E13 | RU-21, RU-42 | idem | D82, RG77, RG78 | T1.5, T9, TM12 | L |
| RUD-05 | Campagne BO : échéance, verrou, logo ; manques d'une campagne | E12, E17, E18 | RU-21 | idem | Additif, D78 | T14, T16 | M |
| RUD-06 | Sélections : date et vignettes ; audience par réseau ; constaté face au déclaré | E02b, E09, E14, E15 | RU-21, RU-34 | idem | k-anonymat, tranches | T1, TM12 | L |
| RUD-07 | Page de marque, aperçu par la marque elle-même (E10-Q17), faits comparés | E05b, E08, E10 | RU-23 à RU-25 | idem, RLS | Campagnes visibles seulement ; aucun contact | T1, T2, TM11 | XL |
| RUD-08 | Échecs de synchronisation par ligne ; sélection jointe si RU-22 | E21, E09.3 | RU-22, RU-40 | idem, migration éventuelle `0335` | RG101, RG61.x | suite base | L |

## 7. RUE — Entrée, accueils, compte (9 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUE-01 | Spécifications et textes EN du jalon | tous ceux du jalon | — | RU-14, RU-30 | `apps/web/src/locales` | parité | M |
| RUE-02 | Porte, e-mail, connexion | E11.1 à E11.3 | C50 | RUB-05 | `W/auth/DoorStep`, `EmailStep`, `AuthScreen` | `signup-nominal`, `journey-*`, `landing-signup` | L |
| RUE-03 | Code et aide | E11.4 | C49, C51 | RUE-02, RUB-08 | `CodeStep`, `CodeNotReceived` | `journey-screens` | M |
| RUE-04 | Informations, autre rôle, arrivée directe | E11.5 à E11.7 | C20, C21 | RUE-03, RU-30 | `SignupDetailsStep`, `AuthFlow` | `signup-form`, `auth-steps` | L |
| RUE-05 | Accueil marque | E01.1 | C43, C06 | RUB-04, RUD-05, RUD-06 | `MemberHome`, `BrandHome` | `brand-profile`, unitaires | L |
| RUE-06 | Accueil créateur | E01.2 | C43, C06 | RUE-05 | `CreatorHomeCard` | `creator-profile` | L |
| RUE-07 | Compte : page-menu, informations, préférences, sessions | E20.1, .2, .4, .5 | C06, C25 | RUB-04, RU-38 | `W/account/*` | `account*`, `account-view` | L |
| RUE-08 | Changement d'adresse | E20.3 | C49, C51 | RUE-07, RUB-08 | `EmailChange`, `FreshCode` | `account-screens` | M |
| RUE-09 | Données, suppression ; écrans hors maquette du périmètre | E20.6, E20.7, E11 §10, E20 §10 | C26, C65 | RUE-07, RU-30 | `DataScreen`, `TermsGate` | `account-data` | L |

## 8. RUF — Profils créateur et marque (9 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUF-01 | Spécifications et textes EN du jalon | — | — | RU-14 | `locales` | parité | M |
| RUF-02 | Cadre d'assistant créateur, reprise, étape 1 | E03.1 | C41 | RUB-08, RU-32 | `CreatorProfileScreen` | `creator-profile`, `creator-*-view` | XL |
| RUF-03 | Étape 2 | E03.2 | C23 | RUF-02 | `EditorialFields` | idem | M |
| RUF-04 | Étape 3, réseaux | E03.3 | C44 | RUF-02, RU-33 | `CreatorNetworksFields` | idem, `verification-creator` | XL |
| RUF-05 | Étape 4, audience | E03.4 | C18 | RUF-02 | `CreatorAudienceFields` | `creator-audience-view` | L |
| RUF-06 | Étape 5, offre et portfolio | E03.5 | C45, C21 | RUF-02, RU-26 | `CreatorOfferFields`, `CreatorPortfolioBlock` | `creator-portfolio` | XL |
| RUF-07 | Vérifier et publier, Mon profil, modifier | E03.6 à E03.8 | C42, C20, C06 | RUF-02 à RUF-06, RUI-02, RU-27 | `CreatorPublicationCard`, `CreatorTrustBlock` | `creator-profile`, `verification-lifecycle` | L |
| RUF-08 | Profil de marque, étapes 1 à 3 | E10.1 à E10.3 | C41, C46, C24 | RUB-08, RU-23, RU-31 | `BrandProfileScreen`, `ProfileFields`, `LogoField` | `brand-profile*` | XL |
| RUF-09 | Vérifier, envoyé, Mon profil, modifier | E10.4 à E10.7 | C42, C08, C06 | RUF-08, RUD-07, RUI-05, RU-27 | `ProfileStateNotice` | `brand-profile-view` | L |

## 9. RUG — Campagnes (9 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUG-01 | Spécifications et textes EN du jalon | — | — | RU-14 | `locales` | parité | M |
| RUG-02 | Assistant, étape 1 | E07.1 | C41 | RUF-02, RU-32 | `CampaignFormScreen`, `CampaignOfferFields` | `brand-campaign` | XL |
| RUG-03 | Étapes 2 et 3 | E07.2, E07.3 | C46, C23 | RUG-02 | `CampaignWorkFields`, `CampaignAudienceFields` | idem | L |
| RUG-04 | Étapes 4 et 5 | E07.4, E07.5 | C24, C47 | RUG-02, RU-31 | `CampaignBudgetFields`, `CampaignCalendarFields` | idem | L |
| RUG-05 | Vérifier et envoyer, envoyée | E07.6, E07.7 | C20, C42, C48 | RUG-02 à RUG-04, RUB-09, RU-29 | `CampaignSubmitPanel` | `brand-campaign`, `campaign-view` | L |
| RUG-06 | Mes campagnes, D86 | E12.1 | C06 | RUB-04, RUD-05 | `CampaignListScreen` | `brand-campaign-states`, test base CA2-bis | M |
| RUG-07 | Fiche côté marque | E18.1 | C39, C40, C53 | RUB-09, RUD-05, RU-37 | `CampaignReadBody`, `CampaignLifecyclePanel` | `brand-campaign-states` | L |
| RUG-08 | Fil et fiche créateur | E08.1, E08.2 | C48, C40, C36 | RUG-07, RUD-07, RUI-05, RU-25, RU-35 | `CampaignFeedScreen`, `CampaignRecordScreen` | `creator-campaigns`, T16 | L |
| RUG-09 | Aperçu de campagne (sans maquette) sur la composition de E08.2 | E18 §10 | C66 | RUG-08 | `CampaignPreviewScreen` | `campaign-preview-view` | M |

## 10. RUH — Recherche, profil anonyme, sélections, aperçu créateur (9 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUH-01 | Spécifications et textes EN du jalon | — | — | RU-14 | `locales` | parité | S |
| RUH-02 | Filtres : pastilles et dialogue | E02.1 | C28, C30 | RUB-07, RU-34 | `SearchFiltersForm`, `CreatorSearchScreen` | `brand-creator-search`, TM12 | L |
| RUH-03 | Cartes, cœur, barre de sélection, états | E02.1 | C31, C09, C39 | RUH-02, RU-02 | `AddToSelectionButton`, `SelectionPanel` | idem, T1.5 | XL |
| RUH-04 | Profil anonyme : tête, galerie, chiffres | E02b.1 | C34, C35 | RUH-03, RUD-06 | `AnonymousProfileScreen` | T1, T9 | L |
| RUH-05 | Profil anonyme : détail, encadré, téléphone | E02b.1 | C36 à C40 | RUH-04, RU-26 | idem | idem | L |
| RUH-06 | Mes sélections | E09.1 | C06, C45 | RUB-04, RUD-06 | `ShortlistsScreen` | `brand-creator-shortlists` | M |
| RUH-07 | Ma sélection, cartes, tableau, notes | E09.2 | C31, C54, C55 | RUH-03 | `ShortlistScreen` | idem, `shortlists-view` | XL |
| RUH-08 | Demande à l'équipe, page existante | E09.3 | C05, C18 | RUH-07, RUD-08, RU-22 | `SelectionRequestScreen` | idem | L |
| RUH-09 | Aperçu du créateur | E15.1 | C66, C22 | RUH-05, RUD-06, RU-43 | `CreatorPreviewScreen` | `creator-preview` | L |

## 11. RUI — Vérifications, page de marque (6 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUI-01 | Spécifications et textes EN du jalon (D34) | — | — | RU-14, juriste | `locales` | parité | S |
| RUI-02 | Mes vérifications, propriété | E14.1, E14.2 | C52, C65 | RUB-04, RUD-06, RU-40 | `W/verification/*`, routes `compte/verifications` | `verification-creator` | L |
| RUI-03 | Audience | E14.3 | C64, C65 | RUI-02, RUD-06 | `AudienceScreen` | idem, T9.9 | L |
| RUI-04 | Contestation | E14.4 | C21 | RUI-02 | `AppealScreen` | `verification-lifecycle`, `dispute-view` | M |
| RUI-05 | Page de marque (lien depuis E08.2 posé en RUG-08) | E05b.1 | C68, C35, C36 | RUB-09, RUD-07, RU-24 | routes nouvelles | T1, TM11 | L |
| RUI-06 | Marque vérifiée (sans maquette) au gabarit E14 | E18 §10 | C05, C65 | RUI-02, D34 | `BrandVerification*` | `verification-brand` | M |

## 12. RUJ — Backoffice, travail quotidien (11 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUJ-00 | Spécifications du jalon | — | — | RU-28, RU-30, RU-39 | `15`, `17b` | — | M |
| RUJ-01 | Tableau de bord | E04.1 | C58, C26 | RUC-04, RUD-01 | `HomeScreen`, `QueueSummary` | `backoffice-ops-screens` | XL |
| RUJ-02 | Listes : profils marque (gabarit) | E16.1 | C58, C30 | RUC-03, RUD-01 | `BrandReviewQueueScreen` | `backoffice-queue` | L |
| RUJ-03 | Listes : huit autres files | E16.1 | idem | RUJ-02, RU-28 | `*QueueScreen(s)` | specs de file | L |
| RUJ-04 | Inscrits | E16.2 | C58 | RUC-03, RU-30 | `AccountsScreen` | `backoffice-ops-screens` | L |
| RUJ-05 | Décision : profil marque ; version soumise de la page | E05.1, E05b.2 | C59, C60, C62, C66, C68 | RUC-05, RUI-05, RUD-03, RUD-07, RU-24, RU-39 | `BrandReview*`, `Review*` | `backoffice-queue` | XL |
| RUJ-06 | Décisions : profil créateur, visuel | E05.2, E05.4 | idem | RUJ-05, RU-28 | `CreatorReview*`, `PortfolioReview*` | `creator-queue`, `portfolio-queue` | L |
| RUJ-07 | Décisions : campagne, sélection d'équipe | E05.3, E05.9 | idem | RUJ-05 | `CampaignReview*`, `TeamSelection*` | `campaign-review`, `backoffice-team-selection` | L |
| RUJ-08 | Décisions : vérifications | E05.5, E05.6 | C64, C65 | RUJ-05 | `Verification*` | `verification-backoffice`, `verification-brand` | XL |
| RUJ-09 | Décisions : contestation, identifiant | E05.7, E05.8 | C62 | RUJ-05 | `Dispute*`, `IdentifierChange*` | `verification-queues-contest` | L |
| RUJ-10 | Fenêtre trop petite ; connexion, activation, erreurs (jetons seuls) | E19.1, E04 §10 | C67 | RUC-08 | `Shell`, `LoginForm`, `Activation` | `backoffice-auth-screens` | M |

## 13. RUK — Backoffice, fiches et administration (11 commits)

| ID | Objectif | Écrans | Composants | Dépend de | Zones de code | Tests | Cx |
|---|---|---|---|---|---|---|---|
| RUK-00 | Spécifications du jalon | — | — | RU-26, RU-41, RU-42 | `15`, `17b` | — | M |
| RUK-01 | Fiche marque : en-tête, à traiter, colonne | E06.1 | C61, C62 | RUC-06, RUD-02 | `AccountScreen`, `Account*Block(s)` | `account-*-view`, `account.spec` | XL |
| RUK-02 | Fiche marque : gestes repliés | E06.1 | C26, C18 | RUK-01, RU-26 | `account-record-forms` | idem | L |
| RUK-03 | Fiche créateur | E06.2 | C62, C45 | RUK-01, RUD-03, RU-42 | `AccountCreatorBlocks` | `account-creator` | L |
| RUK-04 | Fiche campagne | E17.1 | C61, C53 | RUK-01, RUD-05 | `CampaignRecord*` | `campaign-record` | L |
| RUK-05 | Recherche identifiée | E13.1 | C28, C30, C31 | RUC-07, RUD-04 | `Identified*` | `backoffice-identified-search` | XL |
| RUK-06 | Échecs de synchronisation | E21.1 | C63, C58 | RUC-03, RU-40, RUD-08 | `AccountsScreen`, `ReplayPanel` | `backoffice-ops-screens` | L |
| RUK-07 | Double validation | E21.2, E21.3 | C07, C27 | RUC-02, RU-41 | `DualControlScreens` | `backoffice.spec` (série) | L |
| RUK-08 | Invitations, comptes internes | E21.4, E21.5 | C52, C58 | RUC-03, RU-22, RU-41 | `MemberInvitationsScreen`, `InternalAccountsScreen` | idem | L |
| RUK-09 | Apollo, réglages de recherche, sources de registre | E21.6, E21 §10 | C26, C23 | RUK-07 | `ApolloSettingsScreen`, `SearchSettingsScreen`, `RegistrySources*` | idem | L |
| RUK-10 | Santé technique | E21.7 | C58 | RUC-03, RU-26 | `Health*` | `health-errors-ui` | M |

## 14. RUL — Recette et clôture (5 commits)

| ID | Objectif | Prérequis | Critères | Tests | Cx |
|---|---|---|---|---|---|
| RUL-01 | Suppression des composants et clés orphelins, garde anti-doublon | RUE à RUK | `02b` §4 soldé | `guards` | M |
| RUL-02 | Recette visuelle intégrale, 147 états | RUL-01 | Écarts = 0 ou inscrits (`06b` §7) | N1 à N3 | XL |
| RUL-03 | Recette accessibilité et mouvement | RUL-01 | `05` §6 | axe, AN-1, AN-2 | L |
| RUL-04 | Revue groupée `testeur`, `expert-cybersecurite` ; correctifs | RUL-02, RUL-03 | Constats soldés | `pnpm check`, `pnpm test:e2e` | L |
| RUL-05 | Recette du fondateur, clôture, guide des composants pour le Lot 4 | RUL-04 | Dix critères de `05` §9 | — | M |

## 15. Ce que les lots suivants réutilisent

| Lot | Besoin | Fondation livrée ici |
|---|---|---|
| 4 | Encadré de mise en relation, candidature, conversation à trois, documents, apartés | C39, C40, C41, C05, C06, C22 (canaux), C53, C64 ; emplacement prévu dans E02b, E08, E13 |
| 4 | File 8, backoffice sur téléphone (D58) | C58, C59, C67 ; maquettes E19.2 à E19.4 |
| 5 | Pipeline, files 10 à 16, e-mails, supervision | C57, C58, C59, C61, C63, C30 |
| 6, 6bis | Recherche à facettes créateur, actions de masse, tableau de bord | C28, C30, C63, E04 |

## 16. Estimation

105 commits, 12 jalons. Addition des complexités d'écran (78 : S 9, M 25, L 31, XL 13) : **130 à 170 jours** de
développement si chaque écran était isolé ; les composants partagés ramènent l'ordre de grandeur vers **90 à
120 jours**, hors arbitrages et hors `RUD` (15 à 20 jours). C'est plus que l'estimation de l'audit (36 à 54 jours,
65 constats) : le périmètre validé depuis couvre presque tous les écrans. À relire avec la vélocité réelle de `RUB`.
