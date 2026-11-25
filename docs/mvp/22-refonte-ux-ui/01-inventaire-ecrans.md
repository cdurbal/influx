# 01 — Inventaire des écrans

> Produit par script depuis le §1 de chaque fiche `ecrans/E…`, qui porte les routes, les fonctionnalités à
> préserver (fichier et ligne) et les appels d'API. `E01.0` est la coquille des membres, décrite une fois.

**78 écrans dans le lot** : 70 dessinés et 8 décisions de file sans maquette (E05.2 à E05.9, même cadre). Plus les deux coquilles (membres E01.0, backoffice dans E04). **3 écrans dessinés hors lot** (E19.2 à E19.4, cible du Lot 4).

| Zone | Écrans |
|---|---|
| Membres | 16 |
| Marque | 21 |
| Créateur | 17 |
| Backoffice | 24 |

Complexité : L 31, M 25, S 9, XL 13. XL : plus de 3 jours ; L : 2 à 3 ; M : 1 à 2 ; S : moins d'un jour (front seul, hors API).

## E01 — proto-accueils

Maquette : `proto-accueils.html` · comparaison : `ecran-1-accueils.html` · profil : marque, créateur · fiche : `E01a-accueils.md`, `E01b-accueils.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E01.0 (coquille) | Coquille des membres | toutes les pages de `(member)/(space)` | idem | `apps/web/src/components/member/MemberShell.tsx`, `MemberNav.tsx`, `shell-classes.ts` | tous | 375, 768, 1 280, 1 440 | C01 C10 C11 C15 C56 | M | C56, tokens `size-measure`, `logo-plate` |
| E01.1 | Accueil marque | `/fr/marque` | `/en/brand` | `auth/MemberHome.tsx:32` → `brand-profile/BrandHome.tsx:37` | `marque-neuve`, `marque` | 375, 768, 1 280, 1 440 | C02 C03 C04 C06 C08 C09 C10 C11 C13 C17 C43 | L | E10 (profil), E12 et E18 (campagnes), E09 (sélections), E02 (recherche), D86 |
| E01.2 | Accueil créateur | `/fr/createur` | `/en/creator` | `auth/MemberHome.tsx:37` + `creator-profile/CreatorHomeCard.tsx:33` | `createur-neuf`, `createur` | 375, 768, 1 280, 1 440 | C02 C03 C04 C06 C08 C09 C10 C11 C13 C33 C38 C43 C48 | L | E01.0, E03 (profil), E08 (fil), E14 (vérifications), E15 (aperçu) |

## E02 — proto-recherche

Maquette : `proto-recherche.html` · comparaison : `ecran-2-recherche.html` · profil : annonceur · fiche : `E02-recherche.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E02.1 | Recherche de créateurs | `/fr/createurs` | `/en/creators` | `creator-search/CreatorSearchScreen.tsx` | resultats, chargement, vide, dialogue Filtres | 375, 768, 1 280, 1 440 | C02 C08 C09 C10 C11 C16 C18 C21 C28 C29 C30 C31 C32 C39 | XL | C28, C30, C31, C32, C56 ; E02b (cible du lien), E09 (compteur, sélection) |

## E02b — proto-profil-anonyme

Maquette : `proto-profil-anonyme.html` · comparaison : `ecran-2b-profil-anonyme.html` · profil : annonceur · fiche : `E02b-profil-anonyme.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E02b.1 | Profil anonyme d'un créateur | `/fr/createurs/profil/[alias]` | `/en/creators/profile/[alias]` | `creator-search/AnonymousProfileScreen.tsx`, `creator-profile/CreatorCardView.tsx` | profil, ajoute, galerie | 375, 768, 1 280, 1 440 | C02 C03 C04 C07 C10 C11 C18 C19 C22 C26 C29 C33 C34 C35 C36 C37 C38 C39 C44 | XL | E02 (retour, sélection active), E15 (même page côté créateur), C34 à C40 |

## E03 — proto-profil

Maquette : `proto-profil.html` · comparaison : `ecran-3-profil-createur.html` · profil : créateur · fiche : `E03a-profil-createur-etapes.md`, `E03b-profil-createur-recap.md`, `E03c-profil-createur-etapes-4-5.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E03.1 | Étape 1, Vous présenter | `/fr/compte/profil` | `/en/account/profile` | `CreatorProfileFields.tsx` `PresentationFields` | `etape-1` | 375, 768, 1 280, 1 440 | C02 C05 C10 C11 C17 C18 C21 C24 C25 C26 C41 | L | C41, E03-Q1, Q2 |
| E03.2 | Étape 2, Votre ligne éditoriale | idem | idem | `EditorialFields` | `#etape-2` | 375, 768, 1 280, 1 440 | C18 C23 C26 | M | C23, E03-Q3 |
| E03.3 | Étape 3, Vos réseaux et vos chiffres | idem | idem | `CreatorNetworksFields.tsx` | `etape-3`, `etape-3-tout` | 375, 768, 1 280, 1 440 | C05 C13 C18 C19 C23 C26 C44 | XL | C44, E14, E03-Q4 à Q6 |
| E03.4 | Étape 4, Votre audience | idem | idem | `CreatorAudienceFields.tsx` | `#etape-4` | 375, 768, 1 280, 1 440 | C18 C19 C22 | L | C18, E03-Q3, Q7 |
| E03.5 | Étape 5, Votre offre et votre travail | idem | idem | `CreatorOfferFields.tsx`, `CreatorPortfolioBlock.tsx` | `etape-5` | 375, 768, 1 280, 1 440 | C05 C18 C21 C26 C45 C46 | XL | C45, E03-Q3, Q8 |
| E03.6 | Vérifier et publier | `/fr/compte/profil` | `/en/account/profile` | `CreatorPublicationCard.tsx`, `ProfileProgress` | `verifier` (+ clic « Publier ») | 375, 768, 1 280, 1 440 | C02 C10 C11 C20 C41 C42 | L | E03.1 à E03.5, C20, C42 |
| E03.7 | Mon profil (après publication) | idem | idem | `CreatorProfileScreen.tsx` `Summary` | `profil` (+ envoi) | 375, 768, 1 280, 1 440 | C02 C05 C06 C10 C13 C17 | M | E15, E14, E01 (accueil) |
| E03.8 | Modifier une étape | idem | idem | sections de `CreatorProfileScreen.tsx` | `modif-3` | 375, 768, 1 280, 1 440 | C10 C11 C41 | M | E03.1 à E03.5 |

## E04 — proto-bo-accueil

Maquette : `proto-bo-accueil.html` · comparaison : `ecran-4-bo-tableau-de-bord.html` · profil : commercial, admin · fiche : `E04-bo-accueil.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E04.1 | Tableau de bord (et coquille) | `/accueil` | aucune (D36) | `HomeScreen.tsx`, `QueueSummary.tsx`, `Shell.tsx`, `BoNav.tsx`, `bo-nav.ts` | `matin`, `calme`, dialogue `#keys` | 1 280, 1 440 | C01 C02 C03 C06 C07 C08 C09 C10 C11 C13 C16 C17 C26 C27 C29 C57 C58 | XL | C57, C58, C26, C27, C29 ; API compteurs (Q01, Q02) ; E16 (listes) ; E21 (échecs, actions) |

## E05 — proto-bo-decision

Maquette : `proto-bo-decision.html` · comparaison : `ecran-5-bo-decision.html` · profil : commercial, admin · fiche : `E05-bo-decision.md`, `E05c-bo-decisions-derivees.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E05.1 | Décision d'un profil marque | `/files/profils-marque/[id]` | aucune (D36) | `BrandReviewEntryScreen.tsx`, `ReviewBlocks.tsx`, `ReviewDecision.tsx`, `ReviewBanners.tsx`, `BoReasonPicker.tsx`, `use-review-entry.ts` | `decision`, `modification`, `refus`, `publie` | 1 280, 1 440 | C02 C03 C05 C07 C10 C11 C12 C13 C14 C17 C18 C19 C21 C26 C27 C53 C57 C59 C60 C62 | XL | C57, C59, C60, C62, C07, C27 ; E05b ; E06 (fiche) ; E16 (liste) |
| E05.2 | Profil créateur | `/files/profils-createur/[id]` | aucune (D36) | `CreatorReviewEntryScreen`, `CreatorReviewBlocks`, `CreatorReviewDecision` | aucun | aucune | C03 C07 C13 C21 C34 C35 C59 C60 C62 | L | C59, C60, C62, C35, C34 |
| E05.3 | Campagne | `/files/campagnes/[id]` | aucune | `CampaignReviewEntryScreen`, `CampaignReviewBlocks`, `CampaignReviewDecision` | aucun | aucune | C03 C07 C13 C17 C18 C24 C59 | L | C59, C07, C24 |
| E05.4 | Visuel de portfolio | `/files/visuels/[id]` | aucune | `PortfolioReviewEntryScreen`, `PortfolioReviewBlocks`, `PortfolioReviewDecision` | aucun | aucune | C03 C07 C21 C34 C58 C59 C60 | M | C59, C60, C34 |
| E05.5 | Vérification créateur | `/files/verifications-createurs/[id]` | aucune | `VerificationEntryScreen`, `VerificationDossierBlocks`, `VerificationEvidenceBlocks`, `VerificationRecordBlock`, `VerificationDecision` | aucun | aucune | C07 C18 C21 C47 C59 C62 C64 C65 | XL | C59, C62, C65, C64 |
| E05.6 | Vérification marque | `/files/verifications-marques/[id]` | aucune | `VerificationEntryScreen` (`view="brands"`), `VerificationBrandBlocks` | aucun | aucune | C07 C18 C21 C59 C65 | XL | C59, C65 ; sources de registre |
| E05.7 | Contestation | `/files/contestations/[id]` | aucune | `DisputeEntryScreen`, `DisputeDossierBlocks` | aucun | aucune | C03 C07 C18 C21 C59 C64 | L | C59, C62, C64 |
| E05.8 | Identifiant modifié | `/files/identifiants-modifies/[id]` | aucune | `IdentifierChangeEntryScreen` | aucun | aucune | C03 C07 C18 C59 C62 | M | C59, C62, C54 |
| E05.9 | Sélection par l'équipe | `/files/selections-equipe/[id]` | aucune | `TeamSelectionEntryScreen`, `TeamSelectionBlocks`, `TeamSelectionDecision` | aucun | aucune | C03 C07 C21 C38 C59 | M | C59, C38 |

## E05b — proto-marque

Maquette : `proto-marque.html` · comparaison : `ecran-5b-marque.html` · profil : créateur ; agent (version soumise) · fiche : `E05b-page-marque.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E05b.1 | Page de la marque, vue d'un créateur | à créer (proposition E05b-Q1 : `/fr/campagnes/[id]/marque`) | à créer (`/en/campaigns/[id]/brand`) | aucun | createur | 375, 768, 1 280, 1 440 | C03 C06 C07 C10 C11 C13 C26 C33 C35 C36 C38 C39 C68 | L | E08 (fiche de campagne, point d'entrée), C35, C36, C39, C40, C68 ; contrat `open-campaigns` |
| E05b.2 | Page de la marque, version soumise | à créer dans `apps/backoffice` (`/files/profils-marque/[id]/…`) | aucune (D36) | aucun | soumise | 375, 768, 1 280, 1 440 | C07 C14 C40 C66 | L | E05.1 (S11, E05-Q05), E05b.1 |

## E06 — proto-bo-fiche-compte

Maquette : `proto-bo-fiche-compte.html` · comparaison : `ecran-6-bo-fiche-compte.html` · profil : commercial, admin · fiche : `E06a-bo-fiche-compte-marque.md`, `E06b-bo-fiche-compte-createur.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E06.1 | Fiche d'une marque | `/inscrits/[id]` | aucune (backoffice en français seul, D36) | `AccountScreen.tsx` et blocs `Account*.tsx` | marque, corriger, calme | 1 280, 1 440 | C02 C03 C05 C06 C07 C08 C10 C11 C13 C15 C17 C19 C26 C33 C53 C57 C58 C62 | XL | C57, C61, C62, 3 lectures d'API nouvelles (E06-Q01 à Q03) |
| E06.2 | Fiche d'un créateur | `/inscrits/[id]` | aucune (D36) | idem, `AccountCreatorBlocks.tsx` | createur | 1 280, 1 440 | C02 C06 C07 C11 C15 C26 C45 C53 C58 C62 | L | E06.1, nom légal et alias servis (E06-Q04) |

## E07 — proto-campagne

Maquette : `proto-campagne.html` · comparaison : `ecran-7-campagne.html` · profil : annonceur · fiche : `E07a-campagne-etapes.md`, `E07b-campagne-envoi.md`, `E07c-campagne-budget-dates.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E07.1 | Étape 1, L'offre | `/fr/campagnes/[id]?step=1` | `/en/campaigns/[id]?step=1` | `CampaignFormScreen`, `CampaignOfferFields`, `KeyMessagesField` | etape-1 | 375, 768, 1 280, 1 440 | C01 C02 C05 C10 C11 C13 C14 C17 C18 C24 C25 C26 C29 C41 C48 | XL | C41, C56 |
| E07.2 | Étape 2, Le travail attendu | idem `?step=2` | idem | `CampaignWorkFields`, `DeliverablesField` | etape-2 | 375, 768, 1 280, 1 440 | C18 C21 C22 C23 C46 | L | C46, C22 |
| E07.3 | Étape 3, Pour qui | idem `?step=3` | idem | `CampaignAudienceFields` | etape-3 | 375, 768, 1 280, 1 440 | C21 C23 C26 | M | C23 |
| E07.4 | Étape 4, Le budget | idem `?step=4` | idem | `CampaignBudgetFields` | etape-4 | 375, 768, 1 280, 1 440 | C14 C18 C21 C24 | L | C24, D78 |
| E07.5 | Étape 5, Calendrier et candidature | idem `?step=5` | idem | `CampaignCalendarFields` | etape-5 | 375, 768, 1 280, 1 440 | C18 C19 C26 C47 C51 | L | C47 |
| E07.6 | Vérifier et envoyer | `/fr/campagnes/[id]?step=verifier` (à créer) | `/en/campaigns/[id]?step=review` (à créer) | `CampaignSubmitPanel` (dans chaque étape) | verifier, verifier-complet, profil-attente | 375, 768, 1 280, 1 440 | C02 C07 C10 C11 C14 C17 C18 C20 C21 C41 C42 C48 | L | C20, C42, C48, D86, E08 (carte du fil) |
| E07.7 | Campagne envoyée | `/fr/campagnes/[id]` après envoi | `/en/campaigns/[id]` | `Submitted` (`CampaignFormScreen.tsx:384-407`) | envoyee | 375, 768, 1 280, 1 440 | C02 C10 C11 C13 C17 C29 C51 | S | C08, C51, E18 |

## E08 — proto-campagnes-createur

Maquette : `proto-campagnes-createur.html` · comparaison : `ecran-8-campagnes-createur.html` · profil : créateur · fiche : `E08-campagnes-createur.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E08.1 | Fil des campagnes | `/fr/campagnes` | `/en/campaigns` | `CampaignFeedScreen.tsx`, `CampaignFeedCard.tsx` | `fil`, `vide` | 375, 768, 1 280, 1 440 | C02 C08 C30 C32 C33 C48 | M | C48, C30, E08-Q1, Q2 |
| E08.2 | Fiche de campagne | `/fr/campagnes/[id]` | `/en/campaigns/[id]` | `CampaignRecordScreen.tsx`, `CampaignReadBody.tsx` | `fiche`, `fiche-close` | 375, 768, 1 280, 1 440 | C02 C03 C07 C11 C13 C33 C35 C36 C39 C65 | L | C40, C39, E05b, E08-Q3 à Q6 |

## E09 — proto-selections

Maquette : `proto-selections.html` · comparaison : `ecran-9-selections.html` · profil : annonceur · fiche : `E09-selections.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E09.1 | Mes sélections | `/fr/createurs/selections` | `/en/creators/selections` | `creator-search/ShortlistsScreen.tsx`, `ShortlistForm.tsx` | liste, liste-vide (cible-equipe : hors lot) | 375, 768, 1 280, 1 440 | C02 C05 C06 C08 C10 C12 C13 C18 C19 C45 | M | C06, C45, C56 |
| E09.2 | Ma sélection | `/fr/createurs/selections/[id]` | `/en/creators/selections/[id]` | `creator-search/ShortlistScreen.tsx`, `ShortlistForm.tsx` | selection, tableau | 375, 768, 1 280, 1 440 | C02 C05 C11 C22 C26 C31 C54 C55 | XL | C31 (E02), C54, C55, E02b (cible) |
| E09.3 | Demande à l'équipe, dans la sélection | même page que E09.2 | même page que E09.2 | `creator-search/SelectionRequestScreen.tsx` (page distincte) | demande, demande-envoyee | 375, 768, 1 280, 1 440 | C04 C05 C12 C17 C18 C21 C29 | L | API `shortlistId`, écran BO file 9 |

## E10 — proto-profil-marque

Maquette : `proto-profil-marque.html` · comparaison : `ecran-10-profil-marque.html` · profil : annonceur · fiche : `E10a-profil-marque-etapes.md`, `E10b-profil-marque-suite.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E10.1 | Étape 1, Votre marque | `/fr/compte/profil` (`?step=1` à créer) | `/en/account/profile` | `BrandProfileScreen`, `IdentityFields`, `LogoField` | etape-1 | 375, 768, 1 280, 1 440 | C01 C02 C05 C10 C11 C13 C14 C17 C18 C19 C23 C25 C26 C33 C41 | XL | C41, E07a |
| E10.2 | Étape 2, Ce que vous cherchez | idem (`?step=2`) | idem | `ExpectationFields` | etape-2, etape-2-vide | 375, 768, 1 280, 1 440 | C08 C18 C21 C22 C23 C26 C46 | L | C23, C46 |
| E10.3 | Étape 3, Votre interlocuteur | idem (`?step=3`) | idem | `ContactFields` | etape-3 | 375, 768, 1 280, 1 440 | C18 C24 C26 | M | C24 |
| E10.4 | Vérifier et envoyer | `/fr/compte/profil?step=verifier` (à créer) | `/en/account/profile?step=review` | `ProfileProgress`, `SubmitFeedback` (`BrandProfileScreen.tsx:288-384`) | verifier, verifier-complet | 375, 768, 1 280, 1 440 | C02 C04 C07 C10 C11 C14 C17 C18 C20 C33 C38 C41 C42 | M | C20, C42, E05b |
| E10.5 | Profil envoyé | `/fr/compte/profil` après envoi | `/en/account/profile` | `ProfileStateNotice` (en attente) | envoye | 375, 768, 1 280, 1 440 | C02 C10 C11 C13 C17 C51 | S | C08, C51 |
| E10.6 | Mon profil de marque | `/fr/compte/profil` (profil publié) | `/en/account/profile` | `BrandProfileScreen` (publié) | profil | 375, 768, 1 280, 1 440 | C02 C06 C10 C13 C17 C18 C33 | M | C06, badge |
| E10.7 | Modifier une étape | `/fr/compte/profil?step=1..3` (publié) | `/en/account/profile?step=1..3` | `BrandProfileScreen` (publié) | modif-2 | 375, 768, 1 280, 1 440 | C10 C13 C19 C41 | M | C41 |

## E11 — proto-entree

Maquette : `proto-entree.html` · comparaison : `ecran-11-entree.html` · profil : visiteur (marque, créateur) · fiche : `E11a-entree.md`, `E11b-entree.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E11.1 | Porte | `/fr/inscription` | `/en/signup` | `auth/DoorStep.tsx:13` dans `AuthFlow.tsx:269` | `porte` | 375, 768, 1 280, 1 440 | C02 C04 C10 C11 C50 | S | C50 |
| E11.2 | E-mail, inscription | `/fr/inscription/marque`, `/createur` | `/en/signup/brand`, `/creator` | `auth/EmailStep.tsx:33` | `email`, `email-erreur` (et `email-createur`, non relevé) | 375, 768, 1 280, 1 440 | C02 C10 C11 C18 C19 C26 C50 | M | C50 |
| E11.3 | E-mail, connexion | `/fr/connexion` | `/en/sign-in` | `auth/EmailStep.tsx:33` (`door` nul) | `connexion` | 375, 768, 1 280, 1 440 | C02 C11 C18 | S | E11.2 |
| E11.4 | Code | même adresse que l'étape e-mail | idem | `auth/CodeStep.tsx:41`, `CodeNotReceived.tsx:29` | `code`, `code-connexion`, `code-erreur`, `code-aide` | 375, 768, 1 280, 1 440 | C02 C05 C10 C11 C18 C19 C26 C49 C50 C51 | M | C49 |
| E11.5 | Informations marque | `/fr/inscription/marque` (étape 3) | `/en/signup/brand` | `auth/SignupDetailsStep.tsx:79` (`door = advertiser`) | `infos-marque` | 375, 768, 1 280, 1 440 | C02 C10 C18 C19 C20 C21 C22 C50 | L | E01.1, C20 |
| E11.6 | Informations créateur | `/fr/inscription/createur` (étape 3) | `/en/signup/creator` | `auth/SignupDetailsStep.tsx:79` (`door = creator`) | `infos-createur` (3 manques) | 375, 768, 1 280, 1 440 | C18 C19 C21 C22 C50 | L | E01.2, C20 |
| E11.7 | Compte existant, autre rôle | même adresse | idem | `auth/AuthFlow.tsx:327` (`roleMismatch`) | `autre-role` | 375, 768, 1 280, 1 440 | C02 C10 C17 C50 | S | E01 |

## E12 — proto-mes-campagnes

Maquette : `proto-mes-campagnes.html` · comparaison : `ecran-12-mes-campagnes.html` · profil : annonceur · fiche : `E12-mes-campagnes.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E12.1 | Mes campagnes | `/fr/campagnes` | `/en/campaigns` | `CampaignsScreen` → `CampaignListScreen` | liste, pause, un-brouillon, neuve | 375, 768, 1 280, 1 440 | C01 C02 C03 C04 C06 C08 C10 C11 C13 C16 C17 C18 C19 C26 C56 | M | C06, D86, E07, E18 |

## E13 — proto-bo-recherche

Maquette : `proto-bo-recherche.html` · comparaison : `ecran-13-bo-recherche.html` · profil : commercial, admin · fiche : `E13-bo-recherche.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E13.1 | Recherche identifiée | `/createurs/recherche` (`?campagne={id}`) | aucune (D36) | `IdentifiedSearchScreen.tsx`, `IdentifiedFacets.tsx`, `IdentifiedResults.tsx`, `BoIdentifiedFrame.tsx` | prerempli, libre, vide, chargement | 1 280, 1 440 | C02 C08 C09 C10 C11 C13 C17 C28 C30 C31 C32 C36 C57 C62 | XL | C57, C62, C31 et C28 de E02 ; lectures nouvelles (E13-Q01, Q02) ; E06.2, E17 |

## E14 — proto-verifications

Maquette : `proto-verifications.html` · comparaison : `ecran-14-verifications.html` · profil : créateur · fiche : `E14-verifications.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E14.1 | Mes vérifications | **nouvelle** (proposée `/fr/compte/verifications`) | **nouvelle** (`/en/account/verifications`) | aucun ; matière : `VerificationLineState.tsx`, `DisputeNotice.tsx`, `BadgeLine.tsx` | `hub`, `hub-vide` | 375, 768, 1 280, 1 440 | C02 C03 C05 C10 C11 C13 C17 C56 | L | E14-Q1, C56, E03.3 |
| E14.2 | Faire vérifier mon compte | `/fr/compte/profil/verification/propriete?network=` | `/en/account/profile/verification/ownership?network=` | `OwnershipScreen.tsx`, `CodeBox.tsx` | `propriete`, `propriete-envoyee` | 375, 768, 1 280, 1 440 | C05 C10 C17 C26 C41 C51 C52 C65 | M | E14-Q2, Q3 |
| E14.3 | Faire vérifier mon audience | `/fr/compte/profil/verification/audience?network=` | `/en/account/profile/verification/audience?network=` | `AudienceScreen.tsx` | 4 états | 375, 768, 1 280, 1 440 | C05 C07 C10 C13 C17 C26 C64 C65 | L | E14-Q4, Q5 |
| E14.4 | Contester une décision | `/fr/compte/profil/verification/contestation?request=` ou `?badge=` | `/en/account/profile/verification/appeal` | `AppealScreen.tsx` | 4 états | 375, 768, 1 280, 1 440 | C05 C07 C12 C17 C18 C21 | M | — |

## E15 — proto-apercu

Maquette : `proto-apercu.html` · comparaison : `ecran-15-apercu.html` · profil : créateur · fiche : `E15-apercu.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E15.1 | Ce que voit une marque | `/fr/compte/profil/apercu` | `/en/account/profile/preview` | `CreatorPreviewScreen.tsx`, `CreatorCardView.tsx` | `avant`, `apres`, `non-publie`, `sans-visuel` | 375, 768, 1 280, 1 440 | C02 C05 C11 C17 C22 C26 C34 C35 C36 C37 C38 C39 C44 C66 | L | **E02b livré d'abord** (composants partagés), E03.7 |

## E16 — proto-bo-listes

Maquette : `proto-bo-listes.html` · comparaison : `ecran-16-bo-listes.html` · profil : commercial, admin · fiche : `E16-bo-listes.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E16.1 | Liste d'une file (9 routes `/files/*`) | `/files/profils-marque` et 8 autres (§2) | aucune (D36) | `QueueTemplate.tsx`, `QueueFilterBar.tsx`, `QueueCells.tsx`, 8 `*QueueScreen(s).tsx`, `DenseTableRegion.tsx` | `file`, `file-retard`, `file-vide` | 1 280, 1 440 | C02 C08 C09 C10 C13 C17 C27 C30 C32 C47 C57 C58 | L | C58, C30, C32, C27, E04 (rail), E05 |
| E16.2 | Inscrits | `/inscrits` | aucune | `AccountsScreen.tsx`, `ReplayPanel.tsx` | `inscrits`, `inscrits-recherche` | 1 280, 1 440 | C02 C08 C09 C10 C13 C17 C18 C30 C32 C57 C58 | L | C58, C30, C32 ; F3 (Q06) ; E21 (échecs) ; E06 (fiche) |

## E17 — proto-bo-campagne

Maquette : `proto-bo-campagne.html` · comparaison : `ecran-17-bo-campagne.html` · profil : commercial, admin · fiche : `E17-bo-campagne.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E17.1 | Fiche d'une campagne | `/inscrits/campagnes/[id]` | aucune (D36) | `CampaignRecordScreen.tsx`, `CampaignRecordBlocks.tsx`, `CampaignRecordActions.tsx`, `CampaignRecordPanels.tsx`, `CampaignActReason.tsx` | ouverte, validation, pause, close, corriger ; brouillon et refusée sans maquette | 1 280, 1 440 | C02 C06 C07 C08 C10 C11 C13 C17 C19 C24 C26 C33 C53 C57 C60 C62 | L | E06a (gabarit C61), E13 (créateurs compatibles), E05 (entrée de file) |

## E18 — proto-campagne-marque

Maquette : `proto-campagne-marque.html` · comparaison : `ecran-18-campagne-marque.html` · profil : annonceur · fiche : `E18-campagne-marque.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E18.1 | Fiche de campagne (marque) | `/fr/campagnes/[id]` (état hors brouillon) | `/en/campaigns/[id]` | `CampaignFormScreen` (champs figés), `CampaignLifecyclePanel`, `CampaignStatusText` | publiee, pause, close, validation, corriger | 375, 768, 1 280, 1 440 | C01 C02 C03 C07 C10 C11 C13 C17 C18 C21 C24 C26 C29 C33 C35 C39 C40 C53 C65 | L | C40, C39, E08 (même composition de lecture), E07, E12 |

## E19 — proto-bo-mobile

Maquette : `proto-bo-mobile.html` · comparaison : `ecran-19-bo-mobile.html` · profil : commercial, admin · fiche : `E19-bo-mobile.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E19.1 | Fenêtre trop petite | tout chemin de `(app)` | aucune (D36) | `Shell.tsx` (`SmallWindow`, l. 330-350), `shell-classes.ts:11-14, 157-164`, `tokens-backoffice.css:50-59` | `provisoire` | téléphone et fenêtre basse | C02 C10 C57 C67 | M | C67, C57 ; décision 0.9 (E6) |
| E19.2 (hors lot) | Geste 1 : entrées à traiter, entrée, décision | Lot 4 | Lot 4 | n'existe pas | `files`, `entree`, `prise`, `refuser`, `decide` | 1 280, 1 440 | — | hors lot | D58, C06, C39 |
| E19.3 (hors lot) | Geste 2 : conversations | Lot 4 | Lot 4 | n'existe pas | `convs` | 1 280, 1 440 | — | hors lot | D58, messagerie |
| E19.4 (hors lot) | Une conversation | Lot 4 | Lot 4 | n'existe pas | `conv` | 1 280, 1 440 | — | hors lot | D30, D47 |

## E20 — proto-compte

Maquette : `proto-compte.html` · comparaison : `ecran-20-compte.html` · profil : marque, créateur · fiche : `E20a-compte.md`, `E20b-compte.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E20.1 | Page-menu | `/fr/compte` | `/en/account` | `account/AccountHub.tsx:45` | `hub` | 375, 768, 1 280, 1 440 | C02 C06 C10 | S | E01.0 |
| E20.2 | Mes informations | `/fr/compte/informations` | `/en/account/details` | `account/DetailsScreen.tsx:43` | `infos` | 375, 768, 1 280, 1 440 | C02 C03 C05 C10 C11 C18 C21 C22 C25 | M | C25, E10 |
| E20.3 | Changement d'adresse | même adresse que E20.2 | idem | `account/EmailChange.tsx:61`, `FreshCode.tsx:38` | `email`, `email-codes`, `email-fait` | 375, 768, 1 280, 1 440 | C10 C11 C17 C18 C19 C49 C51 | L | C49, C51 |
| E20.4 | Mes préférences | `/fr/compte/preferences` | `/en/account/preferences` | `account/PreferencesScreen.tsx:32` | `preferences` | 375, 768, 1 280, 1 440 | C02 C03 C05 C10 C17 C18 C65 | S | C05 |
| E20.5 | Mes sessions | `/fr/compte/sessions` | `/en/account/sessions` | `account/SessionsScreen.tsx:36` | `sessions` | 375, 768, 1 280, 1 440 | C02 C03 C06 C10 C13 C18 C26 | S | C06, C26 |
| E20.6 | Mes données | `/fr/compte/donnees` | `/en/account/data` | `account/DataScreen.tsx:81` | `donnees` | 375, 768, 1 280, 1 440 | C02 C03 C06 C10 C18 C26 | M | E20.7 |
| E20.7 | Supprimer mon compte | même adresse que E20.6 | idem | `DataScreen.tsx:424` (`ConfirmDeletion`), `FreshCode.tsx:38` | `supprimer` | 375, 768, 1 280, 1 440 | C10 C18 C19 C26 C49 C65 | M | C49 |

## E21 — proto-bo-admin

Maquette : `proto-bo-admin.html` · comparaison : `ecran-21-bo-admin.html` · profil : commercial, admin · fiche : `E21a-bo-admin-synchro-dv.md`, `E21b-bo-admin-comptes.md`

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Variantes | Composants cibles | Complexité | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| E21.1 | Échecs de synchronisation | aucune ; nouvelle (proposée `/files/echecs-synchronisation`) | aucune (D36) | partie de `AccountsScreen.tsx` (vues « À traiter » et « Cas normaux »), `ReplayPanel.tsx` | synchro, synchro-normaux | 1 280, 1 440 | C02 C17 C22 C27 C30 C57 C58 C63 | L | C57 (rail), E16 (perd sa vue), lecture nouvelle (E21-Q01) |
| E21.2 | Actions en attente de validation (liste) | `/double-validation` (rang de file à décider) | aucune (D36) | `DualControlListScreen` (`DualControlScreens.tsx:277-363`) | dv-liste | 1 280, 1 440 | C02 C08 C58 | S | C57 |
| E21.3 | Une action | `/double-validation/[id]` | aucune (D36) | `DualControlScreen` (`DualControlScreens.tsx:391-621`) | dv, dv-degrade | 1 280, 1 440 | C02 C07 C10 C17 C18 C29 C49 | M | `ActionFeedback.tsx` (confirmation d'identité) |
| E21.4 | Invitations de membres | `/invitations` | aucune (D36) | `MemberInvitationsScreen.tsx`, `InvitationParts.tsx` | invitations, invitation-creee | 1 280, 1 440 | C02 C05 C10 C11 C13 C17 C19 C52 C58 | M | C57, C52, E06 |
| E21.5 | Comptes internes | `/comptes-internes` (admin) | aucune (D36) | `InternalAccountsScreen.tsx` | comptes, desactiver | 1 280, 1 440 | C02 C05 C11 C13 C17 C58 | L | E21.3, invitations internes |
| E21.6 | Réglages Apollo | `/reglages/apollo` (admin) | aucune (D36) | `ApolloSettingsScreen.tsx` | apollo | 1 280, 1 440 | C02 C03 C07 C17 C23 | M | E21.3 |
| E21.7 | Santé technique | `/sante-technique` (admin) | aucune (D36) | `HealthScreen.tsx`, `HealthStatus.tsx`, `HealthErrors.tsx`, `HealthTraffic.tsx`, `HealthProcesses.tsx` | sante | 1 280, 1 440 | C02 C07 C58 | L | C58 |
