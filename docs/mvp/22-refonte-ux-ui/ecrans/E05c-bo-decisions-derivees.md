# E05 — Décisions de file dérivées, sans maquette (agent, administrateur)
> Maquette : **aucune** pour E05.2 à E05.9 ; cadre de `proto-bo-decision.html` (E05.1) imposé aux neuf files par `ecran-5-bo-decision.html` §2 et §5 · validation du cadre : 2026-11-24 (`07` l. 45) · Constats : U35, U36, U37, U06, U42.
> Suite de `E05-bo-decision.md` (mesures, états, animations, clavier : ses §2 et §5). Tout ce qui est marqué « à valider » attend un accord du fondateur ou de `expert-ux` avant d'être codé. D'ici là : contenu et texte actuels, dans le cadre.

## 1. Écrans et routes

| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E05.2 | Profil créateur | `/files/profils-createur/[id]` | aucune (D36) | `CreatorReviewEntryScreen`, `CreatorReviewBlocks`, `CreatorReviewDecision` | aucun | L | C59, C60, C62, C35, C34 |
| E05.3 | Campagne | `/files/campagnes/[id]` | aucune | `CampaignReviewEntryScreen`, `CampaignReviewBlocks`, `CampaignReviewDecision` | aucun | L | C59, C07, C24 |
| E05.4 | Visuel de portfolio | `/files/visuels/[id]` | aucune | `PortfolioReviewEntryScreen`, `PortfolioReviewBlocks`, `PortfolioReviewDecision` | aucun | M | C59, C60, C34 |
| E05.5 | Vérification créateur | `/files/verifications-createurs/[id]` | aucune | `VerificationEntryScreen`, `VerificationDossierBlocks`, `VerificationEvidenceBlocks`, `VerificationRecordBlock`, `VerificationDecision` | aucun | XL | C59, C62, C65, C64 |
| E05.6 | Vérification marque | `/files/verifications-marques/[id]` | aucune | `VerificationEntryScreen` (`view="brands"`), `VerificationBrandBlocks` | aucun | XL | C59, C65 ; sources de registre |
| E05.7 | Contestation | `/files/contestations/[id]` | aucune | `DisputeEntryScreen`, `DisputeDossierBlocks` | aucun | L | C59, C62, C64 |
| E05.8 | Identifiant modifié | `/files/identifiants-modifies/[id]` | aucune | `IdentifierChangeEntryScreen` | aucun | M | C59, C62, C54 |
| E05.9 | Sélection par l'équipe | `/files/selections-equipe/[id]` | aucune | `TeamSelectionEntryScreen`, `TeamSelectionBlocks`, `TeamSelectionDecision` | aucun | M | C59, C38 |

**API** (toutes : `…/open`, `…/release`, `…/extend` ; contrats inchangés)

| Écran | Base | Décisions | Levée de verrou |
|---|---|---|---|
| E05.2 | `/v1/bo/queues/profiles-creator/entries/:id` | `publish`, `reject` ; lecture `portfolio/:itemId/image` | `force-release` |
| E05.3 | `/v1/bo/campaigns/entries/:id` | `publish`, `reject`, `first-review` | `force-release` |
| E05.4 | `/v1/bo/queues/portfolio-moderation/entries/:id` | `approve`, `reject` ; lecture `image` | `force-release` |
| E05.5 | `/v1/bo/queues/verification-creators/entries/:id` | `grant-account`, `grant-audience`, `reject`, `reexamine`, `compare` ; lecture `evidence/:evidenceId` | `force-release` |
| E05.6 | `/v1/bo/queues/verification-brands/entries/:id` | `grant`, `grant-by-login`, `reject`, `reexamine` | `force-release` |
| E05.7 | `/v1/bo/queues/verification-disputes/entries/:id` | `uphold`, `overturn` ; lecture `evidence/:evidenceId` | `force-release` |
| E05.8 | `/v1/bo/queues/identifier-changes/entries/:id` | `confirm`, `require-proof` | `force-release` |
| E05.9 | `/v1/bo/team-selection/entries/:id` | `close` | **aucune route** (Q09) |

**Commun à préserver** : verrou nominatif, échéance figée, jeton de version, journal `queue.*` (D81) ; `useClaimedEntry` (`use-claimed-entry.ts`) et `use-verification-entry.ts` ; lecture seule d'un collègue ; levée ; brouillon gardé ; `v`, `r`, `l`, Échap, `?`, et `i` pour les visuels (files 2 et 3, `queue-review-view.ts:478-494`).

## 2. Structure

Ce que C59 impose aux huit écrans, sans nouvelle décision :
1. En-tête E05.1-S01 à S06 (fil d'Ariane à la bonne file, h1, « Rendre la main », « Fiche du compte », ligne de faits, « Aller à la décision »).
2. Dossier à gauche, sans carte : chaque bloc actuel devient une section C03 séparée par un filet, dans l'ordre ci-dessous ; les listes libellé / valeur deviennent C07 (13 rem).
3. Colonne 22 rem collante : commentaire interne, issues, volets C05, rappel des touches, lecture seule, verrou.
4. Confirmer puis annuler ; confirmations dans la colonne, jamais en modale.
5. Décidé : notice, entrée suivante, retour à la file (E05-Q02, Q03).
6. À savoir en premier : alertes et bandeaux propres à la file.

| Écran | Ordre actuel des blocs | Ordre proposé (à valider) |
|---|---|---|
| E05.2 | Profil, Réseaux et chiffres, Ce qui a changé, Portfolio, Alertes | À savoir (alertes, changement), À contrôler, Portfolio, Réseaux et chiffres (C62), Profil |
| E05.3 | Revue renforcée, Second avis, Marque, Campagne, Brief, Alertes | À savoir (alertes, revue, second avis), Brief, Campagne, Marque |
| E05.4 | Visuel et grille, Légende, Profil, Alertes | À savoir, Visuel, Grille, Légende, Profil |
| E05.5 | Demande, Pièces, Ce qu'il faut constater, Ce que je constate, Écarts | inchangé (l'ordre est la procédure, `08` RG43) |
| E05.6 | Demande, Ce qu'il faut constater, Ce que je constate | inchangé |
| E05.7 | Contestation, Décision contestée, Pièces du refus | inchangé |
| E05.8 | Changement, Badges en cours | inchangé |
| E05.9 | Demande, Critères, Message | inchangé |

Saisies longues (E05.5, E05.6 « Ce que je constate ») : la colonne de 352 px ne loge pas ces champs ; ils restent dans le dossier, la colonne ne porte que les issues (à valider, Q02).

## 3. Éléments et matrice

| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E05.2-S01 | Cadre | C59 | Les règles 1 à 6 de §2 | toujours | aucune (cadre E05.1) | E05.2-CA01 | E05.2-T01 |
| E05.2-S02 | À savoir | C03, C13 | Alertes de la file, phrase de première soumission ou de modification | toujours | aucune | E05.2-CA02 | E05.2-T02 |
| E05.2-S03 | Profil | C07 | Faits publics du profil (`ProfileBlock`), vides regroupés | toujours | aucune | E05.2-CA02 | E05.2-T02 |
| E05.2-S04 | Réseaux | C62, C35 | Réseaux et chiffres exacts, marqués, dans le cadre de vue identifiée (Q03) | toujours | aucune | E05.2-CA03 | E05.2-T01 |
| E05.2-S05 | Changement | C60 | Valeur proposée, badge « Modifié », ancienne valeur barrée | modification | aucune (forme E05.1-S19, S20) | E05.2-CA02 | E05.2-T02 |
| E05.2-S06 | Portfolio | C34 | Visuels lus un à un à la demande (clic ou `i`), lecture journalisée, titulaire seul | mode décision | aucune | E05.2-CA04 | E05.2-T01 |
| E05.2-S07 | Décision | C59, C21 | Publier ; Refuser avec motif (10 motifs), message pour « Autre » | mode décision | aucune | E05.2-CA05 | E05.2-T01 |
| E05.3-S01 | Cadre | C59 | Règles 1 à 6 | toujours | aucune | E05.3-CA01 | E05.3-T01 |
| E05.3-S02 | À savoir | C17 | Bandeau revue renforcée et déclaration de la marque ; marque suspendue | secteur sensible ; `brand_not_publishable` | aucune | E05.3-CA02 | E05.3-T02 |
| E05.3-S03 | Second avis | C03 | Avis demandé, auteur, texte (`data-first-opinion`) | avis présent | aucune | E05.3-CA02 | E05.3-T02 |
| E05.3-S04 | Marque | C07 | Faits de la marque, lien vers la fiche | toujours | aucune | E05.3-CA01 | E05.3-T01 |
| E05.3-S05 | Campagne | C07, C24 | Faits de la campagne ; budget et référence en bloc interne (D78) | toujours | aucune | E05.3-CA03 | E05.3-T01 |
| E05.3-S06 | Brief | C03 | Texte lu des créateurs, sauts de ligne gardés (`data-campaign-brief`) | toujours | aucune | E05.3-CA01 | E05.3-T01 |
| E05.3-S07 | Alertes | C13 | Contrôles automatiques et doublons en phrases | toujours | aucune | E05.3-CA02 | E05.3-T02 |
| E05.3-S08 | Décision | C59, C18 | Responsable (obligatoire pour publier), Publier, Demander un second avis, Refuser (14 motifs) | mode décision ; second avis si sensible et non demandé | aucune | E05.3-CA04 | E05.3-T01 |
| E05.4-S01 | Cadre | C59 | Règles 1 à 6 | toujours | aucune | E05.4-CA01 | E05.4-T01 |
| E05.4-S02 | Visuel | C34 | Image affichée une fois à la demande (clic ou `i`), lecture journalisée | titulaire du verrou | aucune | E05.4-CA02 | E05.4-T01 |
| E05.4-S03 | Grille | C60, C58 | Neuf contrôles écrits, plus visage et métadonnées (`data-control`) | toujours | aucune | E05.4-CA03 | E05.4-T02 |
| E05.4-S04 | Légende | C03 | Légende soumise | toujours | aucune | E05.4-CA03 | E05.4-T01 |
| E05.4-S05 | Profil | C07 | Faits du profil et nombre de visuels | toujours | aucune | E05.4-CA01 | E05.4-T01 |
| E05.4-S06 | Décision | C59, C21 | Approuver ; Refuser, grille numérotée, sans message libre | mode décision | aucune | E05.4-CA04 | E05.4-T01 |
| E05.5-S01 | Cadre | C59 | Règles 1 à 6 ; cadre propre de `VerificationEntryScreen` supprimé | toujours | aucune | E05.5-CA01 | E05.5-T01 |
| E05.5-S02 | Demande | C07, C62 | Créateur, pays, langue, responsable, réseau, niveau, identifiant, profil public ; code jamais montré | toujours | aucune | E05.5-CA02 | E05.5-T01 |
| E05.5-S03 | Pièces | C64 | Ouverture pièce par pièce, journalisée ; fermeture ; lecture bloquée expliquée | audience, mode décision | aucune | E05.5-CA03 | E05.5-T01 |
| E05.5-S04 | Procédure | C65 | Ce qu'il faut constater | mode décision | aucune | E05.5-CA02 | E05.5-T02 |
| E05.5-S05 | Constat | C18, C47 | Champs vides, jamais pré-remplis ; comparaison après saisie (`data-comparison`) | mode décision | aucune | E05.5-CA04 | E05.5-T01 |
| E05.5-S06 | Décision | C59, C21 | Accorder (échéance annoncée, ce que le badge n'affirme pas), Refuser (liste fermée), À réexaminer (4 motifs) | mode décision | aucune | E05.5-CA05 | E05.5-T01 |
| E05.6-S01 | Cadre | C59 | Règles 1 à 6 | toujours | aucune | E05.6-CA01 | E05.6-T01 |
| E05.6-S02 | Demande | C07 | Faits de la marque, domaine, immatriculation | toujours | aucune | E05.6-CA01 | E05.6-T01 |
| E05.6-S03 | Procédure | C65 | Constats de domaine et de registre, sources de registre | mode décision | aucune | E05.6-CA02 | E05.6-T02 |
| E05.6-S04 | Constat | C18, C21 | Choix de la preuve (`data-proof-choice`), champs vides | mode décision | aucune | E05.6-CA02 | E05.6-T01 |
| E05.6-S05 | Décision | C59, C21 | Accorder, Refuser (6 motifs), À réexaminer | mode décision | aucune | E05.6-CA03 | E05.6-T01 |
| E05.7-S01 | Cadre | C59 | Règles 1 à 6 ; aucun dossier si l'agent est le décideur d'origine | toujours | aucune | E05.7-CA01 | E05.7-T01 |
| E05.7-S02 | Contestation | C07 | Réseau, niveau, motif et texte du membre, décideurs, identifiant, profil public | dossier servi | aucune | E05.7-CA01 | E05.7-T01 |
| E05.7-S03 | Décision contestée | C03 | Refus ou retrait, motif, message envoyé, échéance d'origine, cascade | dossier servi | aucune | E05.7-CA02 | E05.7-T02 |
| E05.7-S04 | Pièces | C64 | Pièces du refus, ouverture journalisée | refus d'audience, mode décision | aucune | E05.7-CA03 | E05.7-T01 |
| E05.7-S05 | Décision | C59, C21, C18 | Confirmer (3 motifs, message) ; Infirmer (retaper ce qui est lu) ; mode indépendant ou différé écrit | mode décision | aucune | E05.7-CA04 | E05.7-T01 |
| E05.8-S01 | Cadre | C59 | Règles 1 à 6 | toujours | aucune | E05.8-CA01 | E05.8-T01 |
| E05.8-S02 | Changement | C62, C07 | Ancien et nouvel identifiant, nombre de modifications, dernière date ; phrase « internes » | titulaire du verrou | aucune | E05.8-CA02 | E05.8-T01 |
| E05.8-S03 | Badges | C03 | Badges en cours, état, échéance | toujours | aucune | E05.8-CA01 | E05.8-T02 |
| E05.8-S04 | Décision | C59, C18 | Constater (identifiant retapé) ; Exiger une nouvelle preuve | mode décision | aucune | E05.8-CA03 | E05.8-T01 |
| E05.9-S01 | Cadre | C59 | Règles 1 à 6, sans levée de verrou | toujours | aucune | E05.9-CA01 | E05.9-T01 |
| E05.9-S02 | Demande | C07 | Marque, campagne d'origine, langue, sélection jointe | toujours | aucune | E05.9-CA01 | E05.9-T01 |
| E05.9-S03 | Critères | C38 | Critères saisis par la marque (`data-selection-criteria`) | toujours | aucune | E05.9-CA02 | E05.9-T01 |
| E05.9-S04 | Message | C03 | Texte brut, `dir="auto"` (`data-selection-message`) | toujours | aucune | E05.9-CA02 | E05.9-T01 |
| E05.9-S05 | Décision | C59, C21 | Une issue : clore (6 motifs, commentaire 10 à 500 pour « Autre ») ; phrase sur la proposition absente | mode décision | aucune | E05.9-CA03 | E05.9-T01 |

## 4. Textes

Aucune maquette, donc aucun texte nouveau validé. Tout libellé reste celui de `apps/backoffice/src/messages/fr.ts` : `creatorReview`, `campaignReview`, `portfolioReview`, `verificationReview`, `disputeReview`, `identifierReview`, `teamSelectionReview`, `claimedReview`. EN : aucun (D36).

| Élément | FR exact | EN | Clé existante ou « nouvelle » |
|---|---|---|---|
| Cadre commun | Rendre la main ; Fiche du compte ; Aller à la décision ; À savoir ; Entrée suivante : {nom} ; Revenir à la file | aucun | celles de E05.1 (E05d) |
| h1 | {alias}, {titre de campagne}, {nom} : à valider (E05.1 retire le préfixe « Profil marque — ») | aucun | `*.title` actuels, avec préfixe |
| Confirmation de sortie | Rendre la main et revenir à la file ? | aucun | à unifier avec `verificationReview.release` |

## 5. Interactions, états, responsive, clavier

- Mêmes règles que E05.1 §5. Propres : `i` affiche le visuel (E05.2, E05.4) ; comparaison à la demande (E05.5) ; ouverture d'une pièce (E05.5, E05.7) ; choix du responsable (E05.3) ; second avis (E05.3, issue non finale : l'entrée reste en file et l'écran propose la suivante).
- « Refuser » sans motif, champ requis vide, version périmée, verrou perdu : existants, messages conservés.
- Un brouillon (commentaire, motif, champs du constat) déclenche la confirmation de sortie ; la file 1 l'acquiert aussi (E2).
- États non montrés : tous. Représentation : celle de E05.1 §5.
- Responsive : celui de E05.1. Sous 768 px ou 500 px de haut : E19.1, aucune ouverture.
- Sur téléphone, cible du Lot 4 : files 1, 2 et campagnes (E19).

## 6. Critères d'acceptation

- **E05.2-CA01** Le cadre est celui de E05.1 : grille, colonne, en-tête, sans copie de code.
- **E05.2-CA02** Chaque fait servi aujourd'hui apparaît ; un champ vide n'a pas de ligne propre ; un champ modifié montre l'ancienne valeur.
- **E05.2-CA03** Les chiffres et identifiants des réseaux ne sont visibles que dans le cadre de vue identifiée.
- **E05.2-CA04** Afficher un visuel écrit une ligne de journal, une seule par geste, jamais au montage.
- **E05.2-CA05** Les dix motifs servis et le message servi, sans réécriture.
- **E05.3-CA01** Tout le contenu lu par un créateur est lisible sans quitter l'écran ; aucune somme hors du bloc interne.
- **E05.3-CA02** Revue renforcée, second avis et alertes en tête, jamais bloquants (D84) sauf marque non publiable.
- **E05.3-CA03** Budget en tranche, interne, jamais calculé ni converti (D78).
- **E05.3-CA04** Publier exige un responsable ; « Demander un second avis » est secondaire.
- **E05.4-CA01** Cadre de E05.1.
- **E05.4-CA02** Image lisible du seul titulaire, à sa demande.
- **E05.4-CA03** Grille entière lisible à côté de l'image à 1440.
- **E05.4-CA04** Approuver est possible après affichage seulement, comme aujourd'hui (`shown`).
- **E05.5-CA01** Cadre de E05.1 ; attributs `data-*` conservés.
- **E05.5-CA02** Aucun code, aucun chiffre pré-rempli.
- **E05.5-CA03** Chaque ouverture de pièce est journalisée ; l'échec d'une pièce ne bloque pas les autres.
- **E05.5-CA04** L'écart n'apparaît qu'après saisie et demande.
- **E05.5-CA05** Trois gestes, aucun seul au clavier ; l'échéance est dite au moment d'accorder.
- **E05.6-CA01** Cadre de E05.1.
- **E05.6-CA02** Preuve choisie explicitement ; la base compare le code.
- **E05.6-CA03** Six motifs de refus, quatre de réexamen.
- **E05.7-CA01** Le décideur d'origine ne lit pas le dossier ; la raison est écrite.
- **E05.7-CA02** Message d'origine affiché tel qu'envoyé.
- **E05.7-CA03** Pièces réservées au refus d'audience et au titulaire.
- **E05.7-CA04** Infirmer exige de retaper ; aucun champ pré-rempli (CA25).
- **E05.8-CA01** Cadre de E05.1.
- **E05.8-CA02** Identifiants servis au seul titulaire ; jamais dans le titre, la liste ou l'adresse.
- **E05.8-CA03** Constater exige l'identifiant retapé.
- **E05.9-CA01** Cadre de E05.1 sans levée de verrou.
- **E05.9-CA02** Message en texte brut, sans lien actif.
- **E05.9-CA03** Une seule issue ; aucun bouton « Proposer ».

## 7. Tests

| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E05.2-T01 | e2e | `apps/web/e2e/creator-queue.spec.ts` | ouverture, visuels, décision, axe |
| E05.2-T02 | unitaire | `apps/backoffice/tests/creator-review-view.test.ts` | faits, alertes, révisions |
| E05.3-T01 | e2e | `apps/web/e2e/campaign-review.spec.ts` | publier, refuser, second avis, axe |
| E05.3-T02 | unitaire | `apps/backoffice/tests/campaign-review-view.test.ts` | bandeaux, alertes, responsable |
| E05.4-T01 | e2e | `apps/web/e2e/portfolio-queue.spec.ts` | lecture à la demande, décision, axe |
| E05.4-T02 | unitaire | `apps/backoffice/tests/portfolio-review-view.test.ts` | grille et motifs |
| E05.5-T01 | e2e | `apps/web/e2e/verification-backoffice.spec.ts` (demande d'audience) | pièces, constat, écart, badge |
| E05.5-T02 | unitaire | `verification-decision-view.test.ts` | contrôles et motifs |
| E05.6-T01 | e2e | `verification-backoffice.spec.ts` (demande de marque) | preuve, registre, octroi |
| E05.6-T02 | unitaire | `verification-brand-view.test.ts` | faits et procédure |
| E05.7-T01 | e2e | `apps/web/e2e/verification-queues-contest.spec.ts` | conflit, issues, axe |
| E05.7-T02 | unitaire | `dispute-decision-view.test.ts` | modes et motifs |
| E05.8-T01 | e2e | `apps/web/e2e/verification-queues-contest.spec.ts` | identifiants, issues, axe |
| E05.8-T02 | unitaire | `claimed-entry-view.test.ts` | modes, verrou, raccourcis |
| E05.9-T01 | e2e | `apps/web/e2e/backoffice-team-selection.spec.ts` (L3G-E2) | lecture, clôture ; sélecteurs `data-selection-*` |

## 8. Écart avec l'existant

| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature |
|---|---|---|---|
| `ClaimedEntryFrame.tsx` (6 files) | une colonne, bandeaux empilés | base du cadre C59 partagé | faire évoluer |
| `VerificationEntryScreen.tsx` (2 files) | copie du cadre | rejoint C59 | supprimer la copie |
| `SECTION_CLASSES` par bloc | une carte par bloc | sections C03 | faire évoluer |
| `DecisionPanel` | Annuler puis Confirmer (`ClaimedDecisionParts.tsx`) | Confirmer puis Annuler | faire évoluer |
| `DenseTableRegion` encadré (grille, versions) | carte | sans cadre | faire évoluer |
| `VerificationReleasePanel` | « Garder » vert, premier et focalisé | volet E05.1-S38, focus sur « Rendre la main » | faire évoluer (Q07) |

**Données requises** : toutes servies par les `…/open` actuels, sauf le nom de l'entrée suivante (E05-Q03) et l'historique (E05-Q08). L'identifiant de compte pour « Fiche du compte » est servi (`campaign-review.ts:272, 627`, `creator-queues.ts:491, 549`, `verification.ts:1253, 1671, 1896`, `backoffice-queues.ts:672, 706`).

Hors lot : action de masse des visuels (`17b` M4), file 8 (Lot 4), bloc de proposition de E05.9 (Lot 4).

## 9. Contradictions, manques et décisions

| ID | Constat | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E05c-Q01 | Aucune maquette pour 8 écrans ; l'ordre des blocs de E05.2, E05.3, E05.4 n'est pas validé | ordre de §2 | capture de chaque écran dans le cadre, validée avant fusion | fondateur | oui |
| E05c-Q02 | Saisies de constat (E05.5, E05.6) : dans le dossier ou la colonne ? Elles alimentent l'octroi | mise en page, focus | dossier ; colonne pour les issues | expert-ux | oui |
| E05c-Q03 | Cadre C62 : E05.1 l'applique à l'interlocuteur ; les données identifiées de E05.2 (réseaux), E05.5, E05.7, E05.8 ne sont pas dessinées | étendue du cadre | cadre sur les blocs qui portent identifiant ou chiffre exact (`17b` §4.9) | expert-conformite-rgpd | oui |
| E05c-Q04 | « À contrôler » avec motifs en questions : modèle propre à la file 1 | E05.2 au moins | réservé à E05.1 tant que la table champ → motifs n'est pas écrite | product-owner | non |
| E05c-Q05 | « Fiche du compte » sur E05.7 et E05.8 : expose des identifiants réservés au titulaire ? | lien | lien gardé : la fiche a ses propres droits et son journal | expert-conformite-rgpd | non |
| E05c-Q06 | Un décideur en conflit (E05.7) ne reçoit pas de dossier : colonne sans issue | état de la colonne | texte actuel de conflit, « Lever le verrou » absent | product-owner | non |
| E05c-Q07 | Confirmation de sortie : action sûre en tête et focalisée aujourd'hui, inversée dans E05.1 | perte de saisie par Entrée | garder « Garder la main » focalisé, ordre visuel de la maquette | expert-ux | non |
| E05c-Q08 | Second avis (E05.3) et réexamen (E05.5, E05.6) ne sont pas des décisions finales : volet « décidé » non dessiné | S40 de E05.1 | même volet, phrase propre | expert-ux | oui |
| E05c-Q09 | Aucune `force-release` pour E05.9 : un verrou n'y est levable que par expiration | levée | laisser, documenter | architecte | non |
| E05c-Q10 | E05.1 masque la couleur de retard ; sur les files 4 à 6 le libellé est « SLA », pas « Échéance » | libellé unique | « échéance » partout | product-owner | non |
