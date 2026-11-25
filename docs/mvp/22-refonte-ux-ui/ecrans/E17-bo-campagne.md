# E17 — Fiche campagne, backoffice (commercial, administrateur)
> Maquette : `proto-bo-campagne.html` (états ouverte, validation, pause, close, corriger) · page de comparaison `ecran-17-bo-campagne.html` · validée le 2026-11-24 (07) · Constats : U06, U37.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E17.1 | Fiche d'une campagne | `/inscrits/campagnes/[id]` | aucune (D36) | `CampaignRecordScreen.tsx`, `CampaignRecordBlocks.tsx`, `CampaignRecordActions.tsx`, `CampaignRecordPanels.tsx`, `CampaignActReason.tsx` | ouverte, validation, pause, close, corriger ; brouillon et refusée sans maquette | L | E06a (gabarit C61), E13 (créateurs compatibles), E05 (entrée de file) |

Fonctionnalités à préserver :
- Lecture journalisée, heure de lecture dite (`asOf`) ; introuvable et indisponible distincts : `CampaignRecordScreen.tsx:69-118`.
- Marque : nom, pays, langue, compte vérifié, campagnes publiées, responsable, doublon (RG95) : `BrandBlock` (`CampaignReviewBlocks.tsx:57`), appelé en `CampaignRecordScreen.tsx:119`.
- Cycle (état, dates, origine de la pause, responsable, version lue) : `campaign-record-view.ts:64-117`.
- Bloc interne sans somme (D78) : `:123-153`. Champs publics dans l'ordre du formulaire : `:159-174`, `campaignFacts`.
- Brief entier, jamais tronqué ni interprété : `BriefBlock`. Alertes de texte : `AlertsBlock`.
- Historique décisions, seconds avis, interventions, valeurs avant et après, valeurs non servies (montants, tranches, devise) : `:271-368`.
- Actes par état : brouillon, refusée, en validation : corriger ; publiée : pause, clôture ; en pause : reprise, clôture ; close : rien (`actionsOf`, `:375-388`). Version publiée figée (`actionsNote`, `:391`).
- Correction d'un seul champ parmi 21, éditeur selon le type, valeur actuelle montrée, motif fermé, commentaire (obligatoire pour « Autre ») : `:483-557`, `CampaignRecordPanels.tsx:177-359`. Passages avec motif : `:362-…`.
- Créateurs compatibles si l'état l'admet (`isCompatibleOffered`, `identified-search-view.ts:51`).

API appelée : `GET /v1/bo/campaigns/:id`, `POST /v1/bo/campaigns/:id/corrections`, `POST /v1/bo/campaigns/:id/pause`, `/resume`, `/close`.

## 2. Structure
Gabarit de E06a : `f-head`, `f-grid` (704 + 352 px à 1440, écart `spacing-8` ; 553,6 + 352 à 1280 ; une colonne sous 1 280 px, propriétés dessous). Colonne de propriétés en carte à partir de 1 280 px, non collante.

- En-tête à 1440 : 126,2 px ; identité et actions sur la même ligne (actions 424,5 × 44 px à droite) ; à 1280 et 768, actions sous l'identité (182 et 236 px). `h1` 32 px de ligne ; à 768, deux lignes.
- Colonne principale, sections C03 (filet, `padding: spacing-5 0`) dans l'ordre : À traiter, L'offre, Le travail attendu, Pour qui, Calendrier, Historique.
- Listes de propriétés `cprops` : étiquette 176 px (11 rem), écart `spacing-5` (24 px), valeur 504 px à 1440 ; lignes 21,7 px, écart 8 px.
- Propriétés : État et cycle de vie, Bloc interne, Gestes ; étiquette 120 px, `text-xs`.
- 375 : C67 seul (le prototype déborde de 92 px).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E17.1-S01 | En-tête | C57 | Fil : Inscrits (`/inscrits`), marque (fiche E06.1), titre courant | Toujours | ouverte, `.crumbs` | E17.1-CA01 | E17.1-T01 |
| E17.1-S02 | En-tête | C33 | Pastille 56 × 56 px, logo ou initiales de la marque, décorative | Toujours ; logo non servi (E17-Q02) | ouverte, `.logo-plate` | E17.1-CA01 | E17.1-T05 |
| E17.1-S03 | En-tête | C02 | `h1` titre seul, « sans titre » sinon | Toujours | ouverte, `h1` | E17.1-CA01 | E17.1-T01 |
| E17.1-S04 | En-tête | C13 | Badge d'état avec icône : Ouverte (succès, coche), En validation (info, sablier), En pause (warning, horloge), Close (neutre, sans icône) | Selon l'état ; brouillon et refusée non montrés (E17-Q07) | ouverte, validation, pause, close, `.badge` | E17.1-CA02 | E17.1-T02 |
| E17.1-S05 | En-tête | C07 | `meta` : marque en lien, référence, type, langue, responsable | Toujours ; référence et langue non servies (E17-Q02) | ouverte, `.meta` | E17.1-CA01 | E17.1-T01 |
| E17.1-S06 | En-tête | C10 | « Créateurs compatibles », primaire 28 px, loupe ; lien `/createurs/recherche?campagne={id}` | Maquette : sauf close ; code : sauf brouillon et refusée (E17-Q05) | ouverte, `.btn--primary` | E17.1-CA03 | E17.1-T03 |
| E17.1-S07 | En-tête | C11 | « Voir ce que voit un créateur », nouvel onglet | Toujours dans la maquette ; cible à décider (E17-Q03) | ouverte, `.h-actions .go` | E17.1-CA04 | E17.1-T05 |
| E17.1-S08 | En-tête | C62 | « Consultation enregistrée à votre nom, à {heure}. » | Toujours | ouverte, `.journal` | E17.1-CA05 | E17.1-T01 |
| E17.1-S09 | À traiter | C06 | Ligne « Campagne à valider » : file, soumission, échéance, « libre » ; nombre dans le titre | En validation ; échéance et verrou non servis (E17-Q02) | validation, `.todo-rows` | E17.1-CA06 | E17.1-T02 |
| E17.1-S10 | À traiter | C08 | Phrase d'état avec icône : ouverte (coche succès), en pause (horloge warning), close (coche) | Ouverte, en pause, close | ouverte, pause, close, `.allclear` | E17.1-CA06 | E17.1-T02 |
| E17.1-S11 | L'offre | C07 | Mention « version {n} lue des créateurs » à droite du titre, `text-xs` tertiaire | Version connue ; la maquette la laisse en validation (E17-Q11) | ouverte, `#h-offer` | E17.1-CA07 | E17.1-T02 |
| E17.1-S12 | L'offre | C07 | Titre, Résumé public, Brief (deux lignes dans la maquette), Produit et secteur | Toujours ; brief entier (E17-Q06) ; restrictions, messages clés, envoi du produit ajoutés (E17-Q04) | ouverte, `.cprops` | E17.1-CA08 | E17.1-T01 |
| E17.1-S13 | Travail | C07 | Livrables, Droits d'usage (nature, durée, territoire), Exclusivité, Délai de relecture | Toujours | ouverte, `#h-work` | E17.1-CA08 | E17.1-T01 |
| E17.1-S14 | Pour qui | C07 | Pays de l'audience, Langues, Thèmes, Tranches d'audience ; âges et répartition ajoutés (E17-Q04) | Toujours | ouverte, `#h-who` | E17.1-CA08 | E17.1-T01 |
| E17.1-S15 | Calendrier | C07 | Candidatures jusqu'au, Contenu à remettre le, Publication du au, Plafond (« aucun ») | Toujours ; non renseigné écrit | ouverte, `#h-cal` | E17.1-CA08 | E17.1-T01 |
| E17.1-S16 | Historique | C53 | Aide, puis lignes : date 120 px, auteur gras, acte, champ, ancienne et nouvelle valeur, motif | Toujours ; vide : `history.empty` ; lien d'entrée ouverte conservé | ouverte, `#hist` | E17.1-CA09 | E17.1-T01 |
| E17.1-S17 | Cycle | C07 | État, Créée le, Soumise le, Première publication, En pause depuis et origine, Close le, Version lue, Responsable | Selon l'état ; « pas encore », « aucune pour l'instant » en tertiaire | ouverte, pause, close, `#h-cyc` | E17.1-CA02 | E17.1-T02 |
| E17.1-S18 | Bloc interne | C24 | Titre avec œil barré, aide ; Contrepartie, Budget par créateur (tranche), Créateurs recherchés, Budget total « non communiqué », Référence de la marque | Toujours ; devise non servie (E17-Q08) | ouverte, `#h-int` | E17.1-CA10 | E17.1-T01 |
| E17.1-S19 | Gestes | C26 | Repli « Corriger un champ », 44 px : aide, Champ, valeur actuelle, Nouvelle valeur typée, Motif, commentaire, « Enregistrer la correction » | Maquette : ouverte et en pause ; code : brouillon, refusée, en validation (E17-Q01) | corriger, `#d-fix` | E17.1-CA11 | E17.1-T01 |
| E17.1-S20 | Gestes | C19 | Erreurs dans l'ordre : champ, valeur, motif ; focus et annonce ; effacée à la saisie | Contrôle en échec | corriger, `#fx-err` | E17.1-CA11 | E17.1-T04 |
| E17.1-S21 | Gestes | C26 | Repli « Mettre en pause » : phrase, Motif, « Mettre en pause » secondaire | Ouverte | ouverte, 2e `details` | E17.1-CA12 | E17.1-T02 |
| E17.1-S22 | Gestes | C26 | Repli « Reprendre » : phrase, « Reprendre la campagne » ; motif à ajouter (E17-Q09) | En pause | pause, `details` | E17.1-CA12 | E17.1-T02 |
| E17.1-S23 | Gestes | C26 | Repli « Clore la campagne » : phrase, case « Je confirme la clôture définitive », « Clore définitivement » danger désactivé sans la case ; motif à ajouter | Ouverte, en pause | ouverte, 3e `details` | E17.1-CA13 | E17.1-T02 |
| E17.1-S24 | Gestes | C17 | Phrase « La campagne se décide dans sa file… » `text-xs` | En validation | validation, `.pgroup p` | E17.1-CA11 | E17.1-T02 |
| E17.1-S25 | Gestes | C17 | « Aucun geste sur une campagne close. » | Close | close, `.pgroup p` | E17.1-CA13 | E17.1-T02 |
| E17.1-S26 | Alertes | C60 | Contrôles et alertes de texte, doublon de campagne (RG95) | Non montré ; bloc actuel préservé (E17-Q04) | non montré | E17.1-CA14 | E17.1-T04 |
| E17.1-S27 | Marque | C07 | Compte vérifié, pays, langue du compte, campagnes déjà publiées | Non montré ; préservé (E17-Q04) | non montré | E17.1-CA14 | E17.1-T01 |

## 4. Textes
Backoffice en français seul : `messages/fr.ts` (D36 ouverte) ; EN vaut « D36 ». Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| S01 | Inscrits · {marque} · {titre} | D36 | `nav.signups` ; remplace `campaignRecord.back` |
| S03 | {titre} | D36 | remplace `campaignRecord.title` (« Fiche de la campagne… ») |
| S04, S17 | Ouverte · En validation · En pause · Close | D36 | `campaignReview.statuses` (« publiée », « en cours de validation ») à aligner |
| S05 | {marque} · {référence} · {type} · en {langue} · responsable : {prénom} | D36 | nouvelle |
| S06 | Créateurs compatibles | D36 | `identifiedSearch.compatible.title` |
| S07 | Voir ce que voit un créateur | D36 | nouvelle |
| S08 | Consultation enregistrée à votre nom, à {heure}. | D36 | `campaignRecord.journaled` (avec la date) |
| S09 | À traiter · Campagne à valider · Campagnes à valider · soumise le {date} · échéance le {date} · libre | D36 | `queue.campaigns` ; reste nouveau |
| S10 | Rien à traiter : la campagne est ouverte aux créateurs, candidatures jusqu'au {date}. · En pause depuis le {date} à {heure}, à la demande de la marque : aucune candidature n'est acceptée ; les échanges déjà ouverts ne sont pas touchés. · Close le {date} : elle ne se rouvre pas. Aucune donnée n'est effacée. | D36 | nouvelle ; variante « INFLUX » à écrire |
| S11 | version {n} lue des créateurs | D36 | `cycle.snapshotValue` |
| S12 à S15 | L'offre · Titre · Résumé public · Brief · Produit · Le travail attendu · Livrables · Droits d'usage · Exclusivité · Délai de relecture · Pour qui · Pays de l'audience · Langues · Thèmes · Tranches d'audience · Calendrier · Candidatures jusqu'au · Contenu à remettre le · Publication · du {date} au {date} · Plafond de candidatures · aucun | D36 | `campaignReview.facts.*`, `periodRange` |
| S16 | Historique des décisions et des interventions · Du plus récent au plus ancien. Les commentaires internes et les avis ne sont pas repris ici. · {qui} a corrigé un champ — {champ} : {avant}, puis {après} — motif : {motif}. · {qui} a publié la campagne. · La marque a soumis la campagne : en attente de décision. · {qui} a créé la campagne pour la marque. · {qui} a mis la campagne en pause — motif : {motif}. · {qui} a clos la campagne — motif : {motif}. | D36 | `campaignRecord.history.*` à reformuler |
| S17 | État et cycle de vie · État · Créée le · Soumise le · Première publication · En pause depuis · demandée par la marque · Close le · Version lue des créateurs · version {n} · pas encore · aucune pour l'instant · Responsable | D36 | `campaignRecord.cycle.*` |
| S18 | Bloc interne · Jamais lu d'un créateur, jamais publié. La marque voit ce qu'elle a saisi. · Contrepartie · Budget par créateur · tranche {tranche} · Créateurs recherchés · Budget total · non communiqué · aucune somme lue, enregistrée ni calculée ici · Référence de la marque | D36 | `campaignRecord.internal.*` |
| S19, S20 | Gestes · Corriger un champ · Un seul champ à la fois, avec un motif. La correction est enregistrée à votre nom et figure à l'historique. · Champ · Nouvelle valeur · Motif · Choisir… · Enregistrer la correction · Choisissez le champ à corriger. · Saisissez la nouvelle valeur. · Choisissez un motif. · annonce : Correction enregistrée, ajoutée à l'historique. | D36 | `campaignRecord.correct.*`, `actions.*` |
| S21 | Mettre en pause · Plus aucune candidature n'est acceptée ; les échanges déjà ouverts ne sont pas touchés. La reprise se fait sans nouvelle validation. · Demande de la marque · Contenu à revoir | D36 | `passage.pause` ; « Contenu à revoir » n'existe pas (E17-Q09) |
| S22 | Reprendre · La campagne accepte de nouveau les candidatures, sans nouvelle validation. · Reprendre la campagne | D36 | `passage.resume` |
| S23 | Clore la campagne · Clore est définitif : la campagne ne pourra plus être rouverte, la marque pourra seulement en créer une nouvelle. Aucune donnée n'est effacée et les échanges déjà ouverts ne sont pas touchés. · Je confirme la clôture définitive · Clore définitivement | D36 | `passage.close` |
| S24, S25 | La campagne se décide dans sa file : publication ou refus depuis l'entrée « Campagne à valider ». · Aucun geste sur une campagne close. | D36 | `correct.pending`, `actions.closedNote` |

## 5. Interactions, états, responsive, clavier
- Interactions : S19 : choix du champ, valeur actuelle préremplie, contrôle (champ, valeur, inchangée, motif, commentaire), `POST corrections` ; succès : message de `correctedNotice`, fiche relue, ligne en tête de l'historique avec éclair, annonce. Conflit : message de `CONFLICT_TEXT` et relecture. S21 à S23 : contrôle du motif, appel, fiche relue, notice de `passage.*.done`. S09 ouvre l'entrée (prise en charge). S06 ouvre E13. « La marque est informée par e-mail, en {langue} » reste dit dans chaque panneau.
- États : chargement et erreur non montrés, préservés (`CampaignRecordScreen.tsx:91-106`) ; proposé : C09 au gabarit, puis C17 erreur avec lien Inscrits. Vide (historique) : `history.empty`. Refus : par panneau, saisie gardée. Hors ligne : phrase commune. Permission : agents et admins ; conflit d'intérêts `claimedReview.errors.conflictOfInterest`.
- Brouillon et refusée : non montrés ; comportement actuel préservé ; représentation proposée : badge neutre « Brouillon », badge erreur « Refusée », À traiter « Brouillon de la marque : elle le complète et le soumet. » ou le motif de refus, sans S06, geste « Corriger un champ » seul.
- Responsive : §2 ; de 768 à 1 023 px rail en liste horizontale (`17b` §1.7).
- Clavier et focus : `details` natifs ; à l'ouverture, focus sur le premier contrôle, Échap referme et rend le focus au résumé (`usePanelFocus`) ; anneau des lignes étirées ; annonces C29. Animations : chevron `rotate` `duration-fast`, éclair de ligne, aucune en mouvement réduit.

## 6. Critères d'acceptation
- **E17.1-CA01** Le `h1` est le titre seul ; la marque mène à sa fiche ; aucun texte « Fiche de la campagne ».
- **E17.1-CA02** Badge et bloc de cycle disent le même état, en mots ; dates et origine de pause affichées quand elles existent.
- **E17.1-CA03** « Créateurs compatibles » n'est offert que si la base admet la campagne ; il porte l'identifiant dans l'adresse et journalise le pré-remplissage.
- **E17.1-CA04** Aucun lien mort vers l'espace créateur.
- **E17.1-CA05** Une ouverture écrit une lecture journalisée ; l'heure affichée est celle du serveur (`asOf`).
- **E17.1-CA06** En validation, l'entrée est listée et ouvrable ; sinon la phrase exacte de l'état est affichée.
- **E17.1-CA07** La version lue n'est citée que si elle existe.
- **E17.1-CA08** Tous les champs servis sont lisibles, le brief en entier, « non renseigné » pour un vide.
- **E17.1-CA09** L'historique garde décisions, seconds avis, interventions, motifs, valeurs avant et après hors montants, tranches et devise, retards dits.
- **E17.1-CA10** Aucune somme, devise, total ou commission ; le budget est le seul libellé de tranche (D48, D78).
- **E17.1-CA11** Une correction n'est possible que dans les états admis par la base ; un seul champ, valeur actuelle montrée, motif obligatoire, commentaire pour « Autre ».
- **E17.1-CA12** Pause et reprise exigent un motif et informent la marque ; une pause d'INFLUX n'est reprise que par un agent.
- **E17.1-CA13** La clôture exige la case, un motif, et n'offre plus aucun geste ensuite.
- **E17.1-CA14** Alertes, doublon, compte vérifié, campagnes publiées restent lisibles.
- **E17.1-CA15** axe sans violation à 768, 1 024, 1 280, 1 440 ; page sans débordement ; C67 sous 768 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E17.1-T01 | e2e | `campaign-record.spec.ts:43-146` ; régions `cycle`, `internal`, `history`, formulaire « Corriger un champ », `data-current-value` à garder | Lecture, correction, historique, absence de somme |
| E17.1-T02 | e2e | `campaign-record.spec.ts:147-210`, à adapter (replis au lieu de boutons, case de clôture) | Pause, reprise, clôture, phrases figées |
| E17.1-T03 | e2e | `backoffice-identified-search.spec.ts:260-330` (région `compatible` à remplacer) | Pont vers la recherche |
| E17.1-T04 | unitaire | `campaign-record-view.test.ts` | Contrôles, refus, mots, alertes |
| E17.1-T05 | visuel | nouveau, captures des cinq états et du brouillon, 768, 1 280, 1 440 | Fidélité |
| E17.1-T06 | a11y | `campaign-record.spec.ts`, axe par état | CA15 |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Retour, titre | `CampaignRecordScreen.tsx:112-118` | S01 à S08 | faire évoluer |
| Marque | `:119` | `meta` et S27 | faire évoluer |
| Cycle, bloc interne | `CampaignRecordBlocks.tsx:27-50` | propriétés | faire évoluer |
| Campagne, brief | `:53-71`, `BriefBlock` | quatre sections | faire évoluer |
| Créateurs compatibles | `CampaignRecordScreen.tsx:48-62` | bouton d'en-tête | faire évoluer |
| Alertes | `AlertsBlock` | S26 | réutiliser |
| Historique | `CampaignRecordBlocks.tsx:74-106` | S16 | faire évoluer |
| Actions | `CampaignRecordActions.tsx:124-179` (boutons, panneau) | replis | faire évoluer |

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Référence `CMP-2026-…` | Non (`campaignRecordResponseSchema`, `campaign-review.ts:422`) | décision ; `17b` la cite |
| Langue de la campagne | Non ; langue du compte (`brand.preferredLanguage`) | décision |
| Logo de la marque | Non | à servir |
| Échéance, verrou de l'entrée | Non, `entries` sans SLA ni détenteur | à servir |
| Soumissions passées | Non affichées, `createdAt` de l'entrée présent | calculable |
| Vue créateur de la campagne | Non au backoffice | décision |
| Budget : libellé de tranche | Oui, `budgetBandLabelKey` | aucun ; devise non servie |
| Tous les autres champs | Oui | aucun |

Hors lot (Lot 4 ou 5) : candidatures, proposition INFLUX, alerte « 7 jours sans candidature ».

## 9. Contradictions, manques et décisions
Transverses : X11 (`bo-band`), X13. Reprendre E06-Q10, Q14, Q18 par analogie.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E17-Q01 | Maquette : « Corriger un champ » sur une campagne ouverte ou en pause, absent en validation ; historique d'une correction après publication. Code et base : publiée et en pause figées, correction en brouillon, refusée, validation sous prise en charge (`campaign-record-view.ts:375-396`, `campaignRecord.actions.frozen`) | État « corriger » irréalisable tel quel | Garder la règle du code ; repli rendu en brouillon, refusée, validation ; S24 complété | product-owner | oui |
| E17-Q02 | Référence, langue, logo, échéance et verrou de l'entrée non servis | `meta`, pastille, S09 incomplets | Servir échéance, verrou, logo ; retirer référence et langue sinon | architecte | oui |
| E17-Q03 | « Voir ce que voit un créateur » mène à `apps/web`, session créateur requise | Lien mort | Aperçu au backoffice (C66) ou lien retiré ; même décision que E06-Q05 | architecte | oui |
| E17-Q04 | Absents : alertes, doublon, compte vérifié, campagnes publiées, restrictions, messages clés, produit envoyé, conservé, frais d'envoi, âges, répartition, éléments demandés, territoire | Perte d'information | Lignes ajoutées dans les sections, alertes en section C60 après À traiter | expert-ux | oui |
| E17-Q05 | Créateurs compatibles : maquette sauf close ; code sauf brouillon et refusée, close incluse | Condition à fixer | Union : publiée, en pause, en validation seules | expert-matching | non |
| E17-Q06 | Brief coupé à deux lignes ; `brief.lead` « jamais tronqué » (`09` RG, `17b` §3.8) | Perte de lecture | Texte entier, ou « Tout lire » (C26) | product-owner | oui |
| E17-Q07 | Brouillon et refusée sans maquette (07 l'écrit pour le brouillon) | Deux états à inventer | Représentation de §5 | expert-ux | oui |
| E17-Q08 | « EUR » sous la tranche ; le contrat ne sert pas la devise (D78) | Donnée absente | Retirer la devise | product-owner | non |
| E17-Q09 | Motifs : maquette sans commentaire, sans « Autre », « Contenu à revoir » inventé, reprise et clôture sans motif ; API : motif obligatoire partout, 4 codes | Appel refusé | `CampaignActReason` en liste déroulante C18 dans chaque repli | product-owner | oui |
| E17-Q10 | Champ de valeur en texte libre, 5 champs proposés ; code : 21 champs et éditeur par type | Valeurs refusées | Garder les 21 champs et les éditeurs | product-owner | non |
| E17-Q11 | Mention « version 2 lue des créateurs » en validation, quand le cycle dit « aucune » | Incohérence | Masquer sans version | expert-ux | non |
| E17-Q12 | Délai « 3 jours ouvrés », exclusivité « Non », tranche « 500 à 1 500 » hors listes (`48h`, `5bd`, `10bd` ; « aucune » ; bandes) | Données fictives | Mots de `campaignReview` | product-owner | non |
| E17-Q13 | Badge « Ouverte » contre « publiée » (`fr.ts`) ; E06 l'emploie aussi | Vocabulaire | Un mot unique sur marque, créateur, backoffice | expert-marketing | non |
