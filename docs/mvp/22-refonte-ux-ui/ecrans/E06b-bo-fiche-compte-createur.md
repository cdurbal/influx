# E06 — Fiche de compte, créateur (commercial, administrateur)
> Maquette : `proto-bo-fiche-compte.html` (état createur) · page de comparaison `ecran-6-bo-fiche-compte.html` · validée le 2026-11-24 (07) · Constats : U07, U06, U42. Partie b ; structure commune, éléments partagés et questions Q01 à Q03, Q05 à Q11, Q14 à Q18 : `E06a-bo-fiche-compte-marque.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E06.2 | Fiche d'un créateur | `/inscrits/[id]` | aucune (D36) | idem, `AccountCreatorBlocks.tsx` | createur | L | E06.1, nom légal et alias servis (E06-Q04) |

Fonctionnalités à préserver : lecture journalisée une fois (`AccountScreen.tsx:632-655`) ; réseaux, chiffres exacts, date, source, ligne en attente (`AccountCreatorBlocks.tsx:49-107`, `account-creator-view.ts`) ; « aucun tarif » (`:109-114`, D78) ; comptes du portfolio et lien filtré `profileFilterHref` (`:115-126`) ; badges, retrait, lancement par réseau (`AccountBadgesBlock`, `AccountOpeningBlock`) ; changement de rôle (admin, créateur actif, `AccountScreen.tsx:333-410`).

API appelée : celle de E06.1 ; `GET /v1/bo/accounts/:id` (`creator`), `POST /v1/bo/dual-control` (`identity.change_member_role`).

## 2. Structure
Identique à E06.1 (en-tête, grille 704 + 352 px à 1440, 553,6 + 352 à 1280, une colonne sous 1 280 px). Différences :
- pas de pastille de logo : l'identité commence au bord gauche (x = 288 px à 1440) ;
- en-tête 211,8 px de haut : `h1` 32 px, alias 22 px, `meta` 22 px, actions 44 px, bandeau 18,6 px ;
- sections dans l'ordre : À traiter, Profil, Réseaux et audience, Portfolio, Badges, Activité (pas de Campagnes) ;
- cadre de vue identifiée (C62) : `padding` 12 px 20 px, barre gauche 4 px, fond `bo-identified-bg`, tableau intérieur de 668 px à 1440 (colonnes 150, 103, 105, 131, 86, 91), lignes 52,4 px ; à 1280 le tableau (544 px) défile dans 517,6 px ; à 768 dans 436 px ;
- vignettes : grille `repeat(auto-fill, minmax(7rem, 1fr))`, écart `spacing-2`, 134,4 × 100,8 px à 1440 ;
- propriétés : Compte, Synchronisation, Gestes rares (pas d'Interlocuteur).

Éléments repris tels quels de E06.1 : S01, S05, S06, S07, S11, S12, S13, S16, S22 à S26, S28 à S33.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E06.2-S01 | En-tête | C02 | `h1` nom légal suivi du symbole ▮ (8 × 14 px, `bo-identified-accent`), rôle, état du compte | Créateur ; nom à servir (E06-Q04) ; sans nom : alias seul | createur, `h1` | E06.2-CA01 | E06.2-T01 |
| E06.2-S02 | En-tête | C15 | Badge « Créatrice » ou « Créateur », point `color-role-creator` | Créateur ; accord non décidable (E06-Q12) | createur, `.role--creator` | E06.2-CA01 | E06.2-T01 |
| E06.2-S03 | En-tête | C07 | « Alias public : {alias} · {thématique} », `text-sm` secondaire, alias gras | Créateur | createur, `p.alias` | E06.2-CA01 | E06.2-T01 |
| E06.2-S04 | En-tête | C11 | « Voir le profil anonyme », nouvel onglet | Créateur publié ; voir E06-Q05 | createur, `.h-actions .go` | E06.2-CA02 | E06.2-T01 |
| E06.2-S05 | En-tête | C62 | Bandeau capitales, barre gauche 4 px : « Vue identifiée · nom légal et chiffres exacts · consultation enregistrée à {heure} » | Créateur | createur, `.journal--idv` | E06.2-CA02 | E06.2-T01 |
| E06.2-S06 | Profil | C07 | Faits : État, Complétude en badge « Complet », Modifié depuis la validation, Tarifs « aucun : négociés avec le commercial » | Créateur | createur, `.facts` | E06.2-CA03 | E06.2-T02 |
| E06.2-S07 | Réseaux | C62 | Cadre de vue identifiée, chapeau, tableau 6 colonnes : Réseau (nom, étoile du principal, pseudo), Abonnés, Publ. 30 j, Comm. moy., Engag. à droite, Mesure (date et source) ; « constatés » en `verified-text` | Créateur ; pseudo non servi (E06-Q04) ; `awaitingValidation` et « Aucun réseau » conservés | createur, `#h-net .idv` | E06.2-CA04 | E06.2-T02 |
| E06.2-S08 | Réseaux | C07 | Phrase d'audience et « Chaque chiffre porte sa date et sa source. » | Créateur ; parts non servies (E06-Q04) | createur, `.idv p.xs` | E06.2-CA04 | E06.2-T02 |
| E06.2-S09 | Portfolio | C45 | Titre et « {n} visuels · {n} en attente » ; vignettes 4:3 de 134 × 101 px (grille `minmax(7rem,1fr)`, écart 8 px), légende d'état | Créateur ; vignettes en contradiction (E06-Q13) | createur, `.thumbs` | E06.2-CA05 | E06.2-T02 |
| E06.2-S10 | Portfolio | C11 | « Voir les {n} visuels » vers `/files/visuels?account={id}` | Créateur avec visuel | createur, `#h-port` lien | E06.2-CA05 | E06.2-T02 |
| E06.2-S11 | Badges | C58 | Une ligne par badge et par demande ouverte (« Demandée », warning), échéance « — » pour Compte vérifié | Créateur | createur, `#h-badge` | E06.2-CA06 | E06.2-T03 |
| E06.2-S12 | Gestes rares | C26 | Repli « Changer le rôle : créateur vers marque » : phrase, bouton désactivé « Réservé aux administrateurs » ; formulaire actuel dans le repli pour un admin | Créateur actif | createur, 3e `details` | E06.2-CA07 | E06.2-T04 |
| E06.2-S13 | Compte | C07 | Adresse e-mail et délivrabilité, Statut déclaré, Consentement, Source (invitation, invitant, date), Responsable « (vous) » et depuis | Créateur ; invitant non servi | createur, `#h-acc` | E06.2-CA08 | E06.2-T01 |
| E06.2-S14 | À traiter | C06 | Lignes « Vérification d'audience {réseau} » et « 1 visuel de portfolio à valider » : file, date, échéance, « libre » | Entrées ouvertes du créateur (E06-Q01) | createur, `.todo-rows` | E06.2-CA08 | E06.2-T02 |
| E06.2-S15 | Activité | C53 | Phrases par jour, auteur en gras | Créateur (E06-Q03) | createur, `#h-act` | E06.2-CA08 | E06.2-T02 |
| E06.2-S16 | Profil | C53 | Décisions en phrases | Non servies pour un créateur (E06-Q04) | createur, `.lines` | E06.2-CA03 | E06.2-T02 |

## 4. Textes
Backoffice en français seul : `apps/backoffice/src/messages/fr.ts` (D36 ouverte) ; EN vaut « D36 ». Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E06.2-S05 | Vue identifiée · nom légal et chiffres exacts · consultation enregistrée à {heure} | D36 | nouvelle |
| E06.2-S03, S06 | Alias public : {alias} · Complet · Tarifs · aucun : négociés avec le commercial | D36 | `accountCreator.rates` à raccourcir |
| E06.2-S07, S08 | Réseaux et audience · Vue identifiée · chiffres exacts, jamais une tranche · Réseau · Abonnés · Publ. 30 j · Comm. moy. · Engag. · Mesure · constatés · déclarés · Audience : {pays} {part}. Chaque chiffre porte sa date et sa source. | D36 | `accountCreator.columns` à abréger (nom long en `aria-label` ou `abbr`) |
| E06.2-S09, S10 | Portfolio · {n} visuels · {n} en attente · Publié · En attente de validation · Voir les {n} visuels | D36 | `accountCreator.portfolio*`, `openQueue` |
| E06.2-S12 | Changer le rôle : créateur vers marque · Irréversible. Contrôle par un autre administrateur (D84). · Réservé aux administrateurs | D36 | `account.roleChange`, `roleChangeLead` |
| E06.2-S04 | Voir le profil anonyme | D36 | nouvelle |
| E06.2-S13 | Statut déclaré · invitation d'un commercial · {prénom}, le {date} · {prénom} (vous) | D36 | `account.declaredStatus`, `account.sourceInvitation` ; invitant nouveau |
| E06.2-S14 | Vérification d'audience {réseau} · Vérifications créateurs · demandée le {date} à {heure} · 1 visuel de portfolio à valider · Visuels de portfolio · déposé aujourd'hui à {heure} | D36 | nouvelle |
| E06.2-S15, S16 | La créatrice a ajouté un visuel au portfolio. · La créatrice a demandé la vérification de l'audience {réseau}. · {agent} a constaté les chiffres {réseau} et attribué « Audience vérifiée ». · {agent} a publié le profil. | D36 | nouvelle |
| E06.2-S11 | Compte vérifié · {réseau} · Audience vérifiée · {réseau} · Valide · Demandée · — | D36 | `verificationQueue.levels` ; états nouveaux |

## 5. Interactions, états, responsive, clavier
- Interactions : S04 nouvel onglet ; S10 vers `/files/visuels?account={id}` ; S12 : admin, formulaire `RoleChangeForm` (raison sociale 2 à 120, motif) dans le repli, puis `/double-validation/{id}` ; agent, bouton désactivé. Autres : E06.1 §5.
- États : chargement, erreur, introuvable, hors ligne, permission : E06.1 §5. Aucun réseau : `accountCreator.noNetwork` (non montré, préservé, `AccountCreatorBlocks.tsx:59-60`). Aucun visuel : `portfolioNone`. Chiffre absent : « non renseigné ». Rien à traiter : S13 de E06.1 (état calme montré pour la marque seule).
- Responsive : 1440, 1280, 768 comme §2 ; 375 : C67 seul, aucune lecture.
- Clavier : tableau des réseaux dans une région focalisable (`DenseTableRegion`, X8) ; étoile du réseau principal avec l'équivalent « réseau principal » ; annonces et animations : E06.1 §5.

## 6. Critères d'acceptation
- **E06.2-CA01** Nom légal marqué ▮ avec équivalent textuel, alias public visible, rôle écrit.
- **E06.2-CA02** Le bandeau de vue identifiée précède toute donnée exacte et dit que la consultation est enregistrée.
- **E06.2-CA03** « Tarifs » dit qu'aucun n'est saisi ; aucun prix, aucune commission (D48, D78).
- **E06.2-CA04** Chaque chiffre porte date et source, `null` s'écrit « non renseigné », jamais zéro ni tranche ; le réseau en attente de validation est dit.
- **E06.2-CA05** Le portfolio donne les deux comptes et mène à la file filtrée ; aucune lecture d'image non journalisée.
- **E06.2-CA06** « Compte vérifié » n'a pas d'échéance ; une demande ouverte se distingue d'un badge tenu.
- **E06.2-CA07** Le changement de rôle n'est possible qu'à un admin, sur un créateur actif, et mène à la double validation.
- **E06.2-CA08** Les entrées à traiter, l'activité et les propriétés ne montrent ni tarif, ni message, ni donnée d'un autre compte ; « (vous) » n'apparaît que pour l'agent connecté.
- **E06.2-CA09** axe sans violation à 768, 1 024, 1 280 et 1 440 px ; le symbole ▮ et l'étoile ont un équivalent textuel ; à 375 px, C67 seul.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E06.2-T01 | e2e | `account-creator.spec.ts`, à adapter | En-tête identifié, bandeau |
| E06.2-T02 | e2e | `account-creator.spec.ts` ; attribut `data-creator-network` à garder | Chiffres, dates, portfolio |
| E06.2-T03 | unitaire | `account-badges-view.test.ts`, `account-creator-view.test.ts`, `account-opening-view.test.ts` | États et mots |
| E06.2-T04 | e2e | `backoffice.spec.ts:625-730` (PD1 à PD7) | Changement de rôle |
| E06.2-T05 | a11y, visuel | `account-creator.spec.ts` et captures 768, 1 280, 1 440 nouvelles | CA09 et fidélité |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Réseaux, tarifs, portfolio | 3 sections, `AccountCreatorBlocks.tsx:49-126` | 2 sections, tarifs dans Profil | faire évoluer |
| Titre | « Fiche d'inscrit », `AccountScreen.tsx:705` | S01 à S05 | faire évoluer |
| Vue identifiée | symbole ▮ dans un titre, `AccountCreatorBlocks.tsx:50-57` | cadre C62 et bandeau | créer |
| Changement de rôle | section, `AccountScreen.tsx:333-410` | repli S12 | réutiliser la logique |

Blocs sans place dans la maquette : note « L'évolution datée des chiffres n'est pas encore consultable ici. » (`historyNote`), phrase sur le chiffre sans date (`networksLead`), ligne en attente de validation, pièces de vérification (`15` RG42, jamais codées sur la fiche).

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Nom légal, alias, thématique, pseudos, parts d'audience du créateur | Non ; contrat explicite « No handle » | à servir |
| État, complétude, champs modifiés, décisions du profil créateur | Non (`accountCreatorSchema`) | à servir |
| Vignettes du portfolio | Non, comptes seuls (L2G) | décision |
| Invitant et date d'invitation | Non, booléen `viaInvitation` | à servir |
| Auteur d'un badge | Non, `grantedAt` seul | à servir |
| Abonnés, publications, commentaires, engagement, date, source | Oui, `accountCreatorNetworkSchema` | aucun |
| Demande ouverte dans le tableau des badges | Oui, `GET …/verification-requests`, à joindre à l'écran ; « Audience vérifiée » n'y figure pas | lecture à compléter |

Hors lot (Lot 4 ou 5) : candidatures, mises en relation, affaires, conversations, notes.

## 9. Contradictions, manques et décisions
Transverses : X8, X10, X12, X13. Questions communes : E06a §9.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E06-Q04 | Nom légal, alias, thématique, pseudos, parts d'audience, état du profil créateur non servis ; `backoffice-accounts.ts` écrit « No handle » ; `15` RG42 et `17b` §3.6 les veulent | En-tête créateur impossible | Servir nom légal et pseudos, déjà lus par la recherche identifiée ; journalisation couverte par RG40 | architecte, expert-cybersecurite | oui |
| E06-Q12 | « Créatrice », « inscrite », « indépendante » : genre inconnu du système ; statut déclaré vaut Particulier ou Professionnel | Texte faux | Forme non genrée « Créateur », « Inscription le », « Professionnel » | product-owner | non |
| E06-Q13 | Vignettes : le code et L2G (« Aucune vignette ici », `accountCreator.portfolioMasked`) exigent une lecture à la demande journalisée | Contradiction avec D82 (7) | Garder les comptes et le lien, ou vignettes avec lecture journalisée | product-owner, expert-cybersecurite | oui |
