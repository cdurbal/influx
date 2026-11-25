# E06 — Fiche de compte, marque (commercial, administrateur)
> Maquette : `proto-bo-fiche-compte.html` (états marque, corriger, calme) · page de comparaison `ecran-6-bo-fiche-compte.html` · validée le 2026-11-24 (07) · Constats : U07, U06, U42. Partie a ; la fiche créateur (E06.2) est dans `E06b-bo-fiche-compte-createur.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E06.1 | Fiche d'une marque | `/inscrits/[id]` | aucune (backoffice en français seul, D36) | `AccountScreen.tsx` et blocs `Account*.tsx` | marque, corriger, calme | XL | C57, C61, C62, 3 lectures d'API nouvelles (E06-Q01 à Q03) |

Fonctionnalités à préserver :
- Lecture journalisée de la fiche, une fois par ouverture (`history.account_read`, `15` RG40) : `AccountScreen.tsx:632-655`. Rôle inconnu ou compte interne : 404, message `failure.notFound`.
- Synchronisation, cause en clair, rejeu unitaire avec motif, phrase « pas de rejeu » d'un cas normal : `AccountScreen.tsx:100-166`, `ReplayPanel.tsx`.
- Correction statut, pays, langue avec motif et commentaire : `AccountScreen.tsx:168-331`, `account-record-forms.ts` (`correctionOutcome`).
- Changement de rôle (admin, créateur actif) vers la double validation : `AccountScreen.tsx:333-410`.
- Levée d'une désinscription Brevo (admin) : `AccountScreen.tsx:412-478`. Demandes « mes données » et approbation (admin) : `:480-576`.
- Historique paginé par 50 : `:578-621`, `:657-671`. Historique des responsables : `:775-792`.
- Interlocuteur, profil, décisions (20 au plus) : `AccountBrandBlocks.tsx:37-82`.
- Badges, demande de retrait, demande vivante, contestation : `AccountBadgesBlock.tsx:67-370`.
- Lancer la vérification par cible, formulaire (motif, commentaire, bloc interne de la marque) : `AccountOpeningBlock.tsx:104-455`.
- Brouillon pour une marque (titre et type) : `AccountCampaignsBlock.tsx:36-156`.

API appelée : `GET /v1/bo/accounts/:id` (`historyBefore`), `GET /v1/bo/accounts/:id/badges`, `POST …/badges/:badgeId/revocation`, `GET|POST …/verification-requests` (deux méthodes), `POST …/corrections`, `POST …/brevo-suppression/lift`, `POST /v1/bo/leads/replays`, `POST /v1/bo/dual-control`, `POST /v1/bo/campaigns`.

## 2. Structure
Cadre C57. Zone `bo-main` (C01) : marge haute 32 px (`spacing-6`), gouttière `spacing-page-gutter` (48 px à 1440, 43 à 1280, 28 à 768), écart entre zones `spacing-5` (24 px), halo d'en-tête conservé.

Ordre exact :
1. `header.f-head` (écart 12 px) : fil d'Ariane ; `f-id` (identité à gauche, actions à droite, retour à la ligne) ; ligne de journal.
2. `f-grid`.
   - ≥ 1 280 px : deux colonnes `minmax(0,1fr)` + `spacing-bo-panel-w` (352 px), écart `spacing-8` (48 px), alignées en haut. 1440 : 704 + 352 ; 1280 : 553,6 + 352.
   - < 1 280 px : une colonne, propriétés sous la colonne principale, filet haut `border-default`, `padding-top: spacing-5`, pas de carte.
3. Colonne principale `f-main`, sections C03 séparées par un filet `border-default`, `padding: spacing-5 0` (24 px), écart interne 12 px ; première sans filet. Marque : À traiter, Profil, Campagnes, Badges, Activité.
4. Colonne de propriétés `aside.f-side` (C61) : carte `surface-card`, filet `border-default`, `radius-card`, `padding: spacing-5` (≥ 1 280). Groupes : Compte, Synchronisation, Interlocuteur (marque), Gestes rares ; filet `border-subtle` entre groupes. Elle défile avec la page : ni collante ni défilante (demande du fondateur).

Titre de page `text-title-page` 32 px de ligne ; titres de section `text-md` gras ; titres de groupe `text-sm` gras. Pastille de logo 56 × 56 px. Colonne des dates de `lines` : 120 px (7,5 rem). Étiquettes des propriétés : 120 px (96 px dans la vue identifiée).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E06.1-S01 | En-tête | C57 | Fil d'Ariane : Comptes, Inscrits, nom du compte (`aria-current=page`) ; `text-sm`, chevrons 16 px | Toujours ; Comptes et Inscrits mènent à `/inscrits` | marque, `nav.crumbs` | E06.1-CA01 | E06.1-T01 |
| E06.1-S02 | En-tête | C33 | Pastille claire 56 × 56 px : logo, ou initiales si aucun logo ; décorative | Marque | marque, `.logo-plate` | E06.1-CA01 | E06.1-T05 |
| E06.1-S03 | En-tête | C02 | `h1` nom public de la marque, focalisable à l'arrivée | Marque | marque, `h1.t-page` | E06.1-CA01 | E06.1-T01 |
| E06.1-S04 | En-tête | C15 | Badge de rôle « Marque », point `color-role-advertiser` 12 px | Marque | marque, `.role--brand` | E06.1-CA01 | E06.1-T01 |
| E06.1-S05 | En-tête | C13 | Badge d'état du compte, vert succès si actif | Toujours ; suspendu et supprimé non montrés (E06-Q10) | marque, `.badge--success` | E06.1-CA01 | E06.1-T01 |
| E06.1-S06 | En-tête | C07 | Ligne `meta` `text-sm` secondaire : pays, langue du compte, inscription, dernière activité, responsable (« (vous) » si moi) | Toujours ; valeurs absentes omises | marque, `p.meta` | E06.1-CA02 | E06.1-T01 |
| E06.1-S07 | En-tête | C10 | « Lancer la vérification », primaire, 28 px de haut ; ouvre le panneau de S32 | Une cible lançable au moins ; sinon absent | marque, `#b-verify` | E06.1-CA03 | E06.1-T04 |
| E06.1-S08 | En-tête | C10 | « Créer un brouillon de campagne », secondaire, icône plus ; `aria-expanded` | Marque | marque, `#b-draft` | E06.1-CA04 | E06.1-T03 |
| E06.1-S09 | En-tête | C11 | « Voir la page publique », nouvel onglet, icône externe 16 px | Marque ; cible non accessible aujourd'hui (E06-Q05) | marque, `.h-actions .go` | E06.1-CA14 | E06.1-T05 |
| E06.1-S10 | En-tête | C62 | « Consultation enregistrée à votre nom, à {heure}. », œil, `text-xs` tertiaire ; `role=status` conservé | Toujours | marque, `p.journal` | E06.1-CA05 | E06.1-T01 |
| E06.1-S11 | À traiter | C03 | Titre et nombre d'entrées | Toujours ; nombre masqué si 0 | marque, `#h-todo` | E06.1-CA06 | E06.1-T02 |
| E06.1-S12 | À traiter | C06 | Lignes liens étirés, 66 px environ : titre `text-sm` gras ; file, date, « Hors délai » (drapeau, warning), échéance, détenteur ou « libre » ; chevron à droite | Entrées de file ouvertes du compte | marque, `.todo-rows` | E06.1-CA06 | E06.1-T02 |
| E06.1-S13 | À traiter | C08 | Phrase « Rien à traiter », icône succès | Aucune entrée et aucun badge à renouveler sous 30 jours | calme, `.allclear` | E06.1-CA06 | E06.1-T02 |
| E06.1-S14 | Profil | C11 | « Page publique » à droite du titre | Marque ; voir E06-Q05 | marque, `#h-prof + a` | E06.1-CA14 | E06.1-T05 |
| E06.1-S15 | Profil | C07 | Faits en ligne : État, Complétude, Modifié depuis la validation ; libellé `text-xs` tertiaire, valeur semi-gras | Marque avec profil ; « non renseigné » sinon | marque, `dl.facts` | E06.1-CA07 | E06.1-T01 |
| E06.1-S16 | Profil | C53 | Surtitre « Décisions » ; une phrase par décision : date, auteur en gras, verbe, motif ; « (décision après l'échéance) » conservé | 20 au plus ; phrase de reste conservée ; vide : `decisionsEmpty` | marque, `.lines` | E06.1-CA07 | E06.1-T01 |
| E06.1-S17 | Campagnes | C03 | Titre, nombre, bouton texte « Créer un brouillon » | Marque | marque, `#h-camp`, `#b-draft2` | E06.1-CA04 | E06.1-T03 |
| E06.1-S18 | Campagnes | C05 | Bloc intérieur du brouillon : titre `t-block`, aide, Titre (max 120 dans la maquette), Langue, « Créer le brouillon », « Annuler » ; animation d'entrée commune | Ouvert par S08 ou S17 ; champs à arbitrer (E06-Q06) | marque (fermé), `#draft` | E06.1-CA04 | E06.1-T03 |
| E06.1-S19 | Campagnes | C19 | Erreur du titre, `aria-invalid`, focus sur le champ | Titre refusé | script `#d-err` | E06.1-CA04 | E06.1-T03 |
| E06.1-S20 | Campagnes | C58 | Tableau : Campagne (lien `id`), État (badge), Langue, Modifiée le ; lignes 37,6 px, en-tête 30 px | Marque ayant des campagnes ; vide non montré | marque, `.tbl` | E06.1-CA08 | E06.1-T02 |
| E06.1-S21 | Badges | C58 | Tableau : Badge (coche `verified-text`), État (badge), Attribué (date par auteur), Échéance | Toujours ; vide : phrase existante | marque, `#h-badge` | E06.1-CA09 | E06.1-T04 |
| E06.1-S22 | Activité | C53 | Titre, « Tout l'historique » ; jours en surtitre, phrases : heure, auteur, acte | Toujours ; vide : `historyEmpty` | marque, `#h-act` | E06.1-CA10 | E06.1-T02 |
| E06.1-S23 | Activité | C26 | « Consultations de la fiche : {n} cette semaine, par {n} agents », repli, lignes par jour | Toujours | marque, `details.reads` | E06.1-CA10 | E06.1-T02 |
| E06.1-S24 | Compte | C07 | Propriétés `text-xs` : Adresse e-mail et délivrabilité, Raison sociale, Consentement et sa source, Source et UTM, Responsable et depuis ; sous-ligne tertiaire | Marque ; site d'origine et « a connu INFLUX par » ajoutés en sous-lignes (E06-Q11) | marque, `#h-acc` | E06.1-CA11 | E06.1-T01 |
| E06.1-S25 | Synchronisation | C13 | Brevo et Apollo : état avec icône, cause en clair, date, prochaine tentative ; succès `feedback-success-text`, échec `feedback-warning-text` | Toujours | marque, `ul.sync` | E06.1-CA12 | E06.1-T06 |
| E06.1-S26 | Synchronisation | C10 | « Rejouer maintenant », bouton texte, icône ; en cours « Envoi en cours… » | État `failed` seul | marque, `#ap-retry` | E06.1-CA12 | E06.1-T06 |
| E06.1-S27 | Interlocuteur | C62 | Cadre de vue identifiée : barre 4 px, fond `bo-identified-bg`, chapeau en capitales ; Prénom, Fonction, E-mail, Téléphone ; phrase D46 ; la page de contact servie est ajoutée | Marque | marque, `#h-contact .idv` | E06.1-CA13 | E06.1-T01 |
| E06.1-S28 | Gestes rares | C26 | Repli « Corriger statut, pays ou langue » : en-tête 44 px, chevron tourné de 180° ; aide, Pays, Langue du compte, Motif, « Enregistrer la correction » ; ajouter Statut et Commentaire (E06-Q07) | Toujours | corriger, `#d-fix` | E06.1-CA15 | E06.1-T07 |
| E06.1-S29 | Gestes rares | C19 | Erreur : « Aucune valeur n'a changé… » puis « Choisissez un motif. », focus sur Motif | Échec de contrôle | script `#fx-err` | E06.1-CA15 | E06.1-T07 |
| E06.1-S30 | Gestes rares | C17 | Notice succès à la place des actions | Correction enregistrée | script `.notice--success` | E06.1-CA15 | E06.1-T07 |
| E06.1-S31 | Gestes rares | C26 | Repli « Données personnelles » : demandes et désinscription ; gestes admin dans le repli (E06-Q08) | Toujours ; gestes : `admin` | marque, 2e `details` | E06.1-CA16 | E06.1-T07 |
| E06.1-S32 | Vérification | C05 | Panneau « Lancer la vérification » : cibles, demande en cours, motif, commentaire, bloc interne, récapitulatif | Non montré : comportement de `AccountOpeningBlock` préservé (E06-Q09) | non montré | E06.1-CA03 | E06.1-T04 |
| E06.1-S33 | Badges | C05 | Retrait : geste par badge, formulaire motif et message, demande vivante, contestation | Non montré : comportement de `AccountBadgesBlock` préservé (E06-Q09) | non montré | E06.1-CA09 | E06.1-T04 |

## 4. Textes
Backoffice en français seul : `apps/backoffice/src/messages/fr.ts`, sans fichier EN (D36 ouverte). La colonne EN vaut donc « D36 » partout. Apostrophe typographique ’ des clés existantes conservée (la maquette écrit l'apostrophe droite).

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| S04, S05 | Marque · Compte actif | D36 | `roles`, `accountStatus` (texte « Compte actif » nouveau) |
| S06 | {pays} · compte en {langue} · inscrite le {date} · dernière activité le {date} à {heure} · responsable : {prénom} (vous) | D36 | nouvelle |
| S07 | Lancer la vérification | D36 | `accountOpening.launch` |
| S08, S17 | Créer un brouillon de campagne · Créer un brouillon | D36 | nouvelle |
| S09, S14 | Voir la page publique · Page publique | D36 | nouvelle |
| S10 | Consultation enregistrée à votre nom, à {heure}. | D36 | `account.journaled` à compléter de l'heure |
| S11 | À traiter | D36 | nouvelle |
| S12 | Modification du profil à valider · Campagne « {titre} » à valider · déposée le · déposé · échéance le · Hors délai · prise en charge par {prénom} · libre | D36 | nouvelle |
| S13 | Rien à traiter pour ce compte : aucune entrée de file ouverte, aucun badge à renouveler dans les 30 jours. | D36 | nouvelle |
| S15 | Profil · État · Complétude · Modifié depuis la validation · Publié · modification en attente · aucun champ | D36 | `accountBrand.*` proche, libellés nouveaux |
| S16 | Décisions · {qui} a publié le profil. · {qui} a refusé le profil : {motif}. | D36 | `accountBrand.decision.*` à reformuler |
| S17, S20 | Campagnes · Campagne · Langue · Modifiée le · En validation · Ouverte · Brouillon | D36 | nouvelle (états : `campaignReview.statuses`, mots différents) |
| S18 | Nouveau brouillon de campagne · Créé au nom de {marque}, qui le complétera et le soumettra. Possible avant la publication de son profil (D86). · Titre de la campagne · Langue · Créer le brouillon · Annuler | D36 | `campaignRecord.create.*` en partie ; référence « D86 » à ôter du texte (E06-Q14) |
| S19 | Saisissez un titre de 3 à 120 caractères. | D36 | contredit `titleRequired`, `titleTooLong` (1 à 140) (E06-Q06) |
| S18 annonce | Brouillon « {titre} » créé. La marque le verra dans ses campagnes. | D36 | `campaignRecord.create.done` différent |
| S21 | Badges · Badge · État · Attribué · Échéance · Marque vérifiée · Valide · Demandée · {date} par {prénom} | D36 | `accountBadges.columns` et `state` : « actif » devient « Valide » |
| S22, S23 | Activité · Tout l'historique · Aujourd'hui · Consultations de la fiche : {n} cette semaine, par {n} agents · Vous ({n}) | D36 | nouvelle |
| S24 | Compte · Adresse e-mail · délivrable · Raison sociale · Consentement · accordé le {date} · à l'inscription · Source · inscription directe · UTM : {a} / {b} / {c} · Responsable · depuis le {date} | D36 | `account.*` |
| S25, S26 | Synchronisation · À jour · Échec : {cause} · Nouvelle tentative prévue à {heure} · Rejouer maintenant · Envoi en cours… · Contact envoyé à Apollo. | D36 | `account.sync`, `syncCause`, `account.retryAt` ; « Rejouer maintenant » nouveau |
| S27 | Interlocuteur · Vue identifiée · Prénom · Fonction · E-mail · Téléphone · Jamais montrés à un créateur (D46) : seuls le prénom et la fonction le sont, à la mise en relation. | D36 | `accountBrand.contact*` à raccourcir |
| S28 à S30 | Gestes rares · Corriger statut, pays ou langue · Avec un motif. La correction est enregistrée et transmise à Brevo et Apollo. · Pays · Langue du compte · Motif · Choisir… · Enregistrer la correction · Aucune valeur n'a changé : rien n'a été enregistré. · Choisissez un motif. · Correction enregistrée, transmise à Brevo et Apollo. | D36 | `account.corrections*`, `nothingChanged`, `common.reasonPlaceholder` |
| S31 | Données personnelles · Demandes « mes données » : aucune. · Désinscription Brevo : aucune à lever. | D36 | `account.dataRequests`, `noDataRequest` ; 2e phrase nouvelle |

## 5. Interactions, états, responsive, clavier
- Interactions :
  - S08 ou S17 : bascule S18, `aria-expanded` sur les deux boutons, défilement centré (instantané en mouvement réduit), focus sur le titre. « Annuler » : ferme, focus sur S17. Succès : ferme, ligne en tête du tableau avec éclair, nombre mis à jour, annonce C29, focus sur le lien de la ligne. Échec : message `campaignRecord.failures`.
  - S26 : envoi de `POST /v1/bo/leads/replays`. La maquette rejoue en un clic ; l'API exige un motif et `ReplayPanel` montre un aperçu : panneau préservé, ouvert sous la ligne (E06-Q15). Succès : état relu, annonce.
  - S28 : contrôle, erreur annoncée et focus, puis `POST …/corrections` ; succès : S30, fiche relue.
  - S12 : ouvre l'entrée de file (prise en charge à l'ouverture). S20 : ouvre E17.
- États :
  - Chargement : non montré ; aujourd'hui titre et `common.loading` (`AccountScreen.tsx:679-688`) ; proposé : C09 de l'en-tête, des sections et de la colonne, `aria-busy`, aucune donnée.
  - Erreur, introuvable : non montré ; préservé (`:690-698`), `h1` générique « Fiche d'inscrit » et C17.
  - Badges ou vérifications en échec seul : préservé, message dans la section (`AccountBadgesBlock.tsx:252-254`).
  - Sans responsable : `accounts.unowned`. Profil jamais soumis : « non renseigné ». Compte suspendu ou supprimé : E06-Q10.
  - Hors ligne : non montré ; message `failure` commun, saisie gardée.
  - Permission : gestes admin absents pour un agent (S31, E06.2-S12 montre un bouton désactivé) ; refus 403 : `failure.forbidden`.
- Responsive : 1440 : 704 + 352. 1280 : 553,6 + 352, actions de l'en-tête sous l'identité (bloc `f-id` 147 px de haut), tableau des réseaux 544 px défilant dans sa région. 768 : une colonne 472 px, tableaux 474 à 544 px défilants, page 2 843 px sans débordement ; entre 768 et 1 023 px, le rail devient une liste horizontale (`17b` §1.7), non montré par la maquette. 375 : C67, jamais la fiche (la maquette déborde de 79 px) ; aucune lecture journalisée derrière C67.
- Clavier et focus : ordre DOM = ordre visuel ; liens étirés focalisables avec anneau sur la ligne ; `details` natifs ; régions de tableau `tabIndex=0` (`DenseTableRegion`) ; raccourcis `g` conservés.
- Animations : `is-entering` (S18, durée de base commune) ; éclair de ligne ; chevrons `rotate` `duration-fast` `ease-standard` ; fond de ligne `duration-fast`. Aucune en mouvement réduit.

## 6. Critères d'acceptation
- **E06.1-CA01** Le `h1` porte le nom public de la marque, jamais « Fiche d'inscrit » ; rôle et état écrits à côté ; fil d'Ariane à trois niveaux ; logo 56 × 56 px.
- **E06.1-CA02** La ligne `meta` montre pays, langue, inscription, dernière activité, responsable ; aucun champ absent n'affiche « null » ou une date vide.
- **E06.1-CA03** « Lancer la vérification » n'accorde rien : il ouvre le formulaire actuel avec motif, commentaire et récapitulatif ; une marque sans domaine garde la phrase de refus.
- **E06.1-CA04** Le brouillon se crée depuis l'en-tête ou la section, dans la page, pour un compte actif ; le refus de l'API est affiché et rien n'est perdu.
- **E06.1-CA05** La mention de consultation est affichée avec l'heure, et une seule ligne `history.account_read` est écrite par ouverture.
- **E06.1-CA06** « À traiter » liste toutes les entrées ouvertes du compte, hors délai écrit, et ouvre l'entrée ; vide : la phrase exacte de S13.
- **E06.1-CA07** État, complétude, champs modifiés et décisions (auteur, date, motif en mots, retard) restent lisibles, 20 décisions au plus avec la phrase de reste.
- **E06.1-CA08** Chaque campagne mène à sa fiche E17 ; aucun montant, tranche ni devise dans le tableau.
- **E06.1-CA09** Tous les états de badge (actif, à rafraîchir, à reconfirmer, expiré, retiré, remplacé), la demande vivante, la contestation et le geste de retrait restent présents.
- **E06.1-CA10** L'activité est en phrases, sans code technique ; l'historique complet reste atteignable et paginé ; aucune donnée de `15` RG43.
- **E06.1-CA11** E-mail, délivrabilité, consentement et source, UTM, site d'origine, « a connu INFLUX par » et historique des responsables sont tous lisibles.
- **E06.1-CA12** Rejeu offert au seul état `failed`, jamais pour un cas normal, dont la phrase « Pas de rejeu… » est affichée.
- **E06.1-CA13** E-mail, téléphone et lien de l'interlocuteur n'apparaissent que dans le cadre de vue identifiée, avec la phrase D46 ; le symbole ▮ a un équivalent textuel.
- **E06.1-CA14** Aucun lien mort : « page publique » n'est rendu que si sa cible existe pour un agent.
- **E06.1-CA15** Une correction exige un motif et au moins un changement, accepte le statut et un commentaire, annonce le résultat.
- **E06.1-CA16** Demandes « mes données », échéances, exécution, export et levée Brevo restent accessibles à l'admin, en lecture pour l'agent.
- **E06.1-CA17** axe sans violation à 768, 1 024, 1 280 et 1 440 px ; pas de défilement horizontal de la page ; à 375 px, C67 seul.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E06.1-T01 | e2e | `backoffice-queue.spec.ts` (L2C-17, L2C-18), `backoffice.spec.ts`, à adapter (`region` `identity`, `h1`) | En-tête, propriétés, interlocuteur, décisions, journal |
| E06.1-T02 | e2e | nouveau `account-record.spec.ts` | À traiter, campagnes, activité, vide |
| E06.1-T03 | e2e | `campaign-record.spec.ts:43-72`, à adapter (région, libellés, lien « Ouvrir la fiche ») | Brouillon pour une marque |
| E06.1-T04 | e2e | `verification-revocation.spec.ts`, `verification-backoffice.spec.ts` ; attributs à garder : `data-badge-row`, `data-opening-row`, `data-member-sentence` | Badges, retrait, lancement |
| E06.1-T05 | visuel | nouveau, captures 768, 1 280, 1 440 des quatre états | Fidélité, liens |
| E06.1-T06 | e2e | `backoffice.spec.ts:210-345` (CA57 à CA61), région « Synchronisation » et bouton de rejeu | Rejeu unitaire et idempotence |
| E06.1-T07 | unitaire | `account-record-forms.test.ts`, `account-brand-view.test.ts` | Corrections, motifs, mots |
| E06.1-T08 | a11y | `backoffice-ops-screens.spec.ts:83-108`, à adapter (largeurs) | axe et C67 |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Titre et identité | `AccountScreen.tsx:703-795` | S01 à S10, S24 | faire évoluer |
| À traiter | absent | S11 à S13 | créer |
| Campagnes | formulaire seul, `AccountCampaignsBlock.tsx:72-155` | liste et brouillon | faire évoluer |
| Badges et vérification | 2 sections, `AccountBadgesBlock`, `AccountOpeningBlock` | 1 tableau et 2 panneaux | faire évoluer |
| Synchronisation | section, `AccountScreen.tsx:100-166` | groupe de propriétés | réutiliser la logique |
| Corriger, rôle, Brevo, données | 4 sections, `:168-576` | replis de « Gestes rares » | réutiliser la logique |
| Historique | codes, `:578-621` | phrases par jour | faire évoluer |

Bloc actuel sans place dans la maquette (à rendre quand même, E06-Q08 à Q11) : colonne « Retrait », demande de retrait vivante, contestation ; cibles et demandes de vérification ; levée Brevo ; détail, échéance, exécution, export des demandes « mes données » ; commentaire et statut de la correction ; raison sociale de la nouvelle marque ; page de contact ; site d'origine et « a connu INFLUX par » ; responsables successifs ; historique de plus de 50 lignes ; compte suspendu ou supprimé ; « décision après l'échéance » ; « Réseau ajouté, en attente de validation » ; phrases de masquage (`accountBrand.masked`, `portfolioMasked`, `15` RG123).

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Entrées « À traiter » | Non ; seule la file des visuels accepte `account` (`creator-queues.ts:200`) | lecture nouvelle par compte |
| Campagnes d'un compte | Non ; aucune route de liste (`campaign-record-routes.ts`) | lecture nouvelle |
| Activité en phrases, auteur nommé, regroupement des consultations | Codes et identifiants, sans nom ni comptage (`backoffice-accounts.ts:332-342`) | lecture ou enrichissement |
| Nom public, logo, secteur de la marque | Non (`companyName` seul, `accounts/repository.ts:225`) | à servir |
| Auteur d'un badge | Non, `grantedAt` seul (`accountBadgeRowSchema`) | à servir |
| Responsable du compte, historique | Oui, `ownership` | aucun |
| Nombre de badges à renouveler sous 30 jours | Calculable depuis `GET …/badges` | aucun |

Hors lot (Lot 4 ou 5) : mises en relation, affaires, conversations, candidatures, notes internes, suspension, réattribution (`15` RG41 blocs 5 à 9, RG51).

## 9. Contradictions, manques et décisions
Transverses : X3 sans objet ; X8 (régions `#h-badge` et `.idv` sans focus à 375, corrigé par `DenseTableRegion`) ; X10 (`aria-label` sur `span.mark`, 3 cas) ; X11 (`bo-band`) ; X12 (étoile du réseau principal) ; X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E06-Q01 | « À traiter » n'est servi par aucune route (07 le signale) | Section vide | Lecture par compte des entrées de toutes les files, droits de chaque file respectés | architecte | oui |
| E06-Q02 | Liste des campagnes d'un compte non servie | Tableau impossible, E17 inatteignable | Lecture paginée titre, état, langue, date, sans montant | architecte | oui |
| E06-Q03 | Activité : codes sans auteur nommé ; « Consultations : 12 cette semaine, par 3 agents » non calculable | Section impossible à l'identique | Enrichir `history` (auteur, objet) et un agrégat de consultations ; à défaut phrases par table de codes fermée | architecte | oui |
| E06-Q05 | « Voir la page publique » et « profil anonyme » pointent vers `apps/web`, réservé à une session membre (07 : écrans 5 bis et 2 bis) ; aucun écran équivalent au backoffice | Lien mort | Décider : aperçu au backoffice (C66) ou lien retiré | architecte | oui |
| E06-Q06 | Brouillon : maquette titre (3 à 120) et langue ; API titre (1 à 140) et `campaignType` obligatoire, sans langue (`campaign-review.ts:626`, `09` RG94) | Formulaire refusé par l'API | Garder le type, ajouter la langue seulement si le champ existe en base ; bornes 1 à 140 | product-owner | oui |
| E06-Q07 | Le repli s'appelle « Corriger statut, pays ou langue » mais n'a pas de champ Statut ni commentaire ; pays préremplis au lieu de « inchangé » | Perte de fonction | Ajouter Statut et Commentaire ; préremplir et n'envoyer que ce qui change | product-owner | oui |
| E06-Q08 | « Données personnelles » ne montre qu'une phrase ; le code gère liste, échéance, exécution, export, levée Brevo | Perte de fonction RGPD | Mettre ces contenus dans le repli, forme C06 et C18 | product-owner | oui |
| E06-Q09 | Retrait de badge et lancement de vérification sans représentation ; colonne Action absente du tableau | Gestes perdus | Action en fin de ligne (bouton texte) et panneau C05 sous le tableau ; S07 ouvre le choix de cible | expert-ux | oui |
| E06-Q10 | Compte suspendu ou supprimé non montré (`17b` §3.6 : bandeau ; RG80 : lecture seule) | État indéfini | Badge warning ou neutre, bandeau C17, gestes absents | product-owner | non |
| E06-Q11 | Site d'origine, « a connu INFLUX par », responsables successifs (`15` RG49) absents | Perte d'information | Sous-lignes de Source et de Responsable, repli « Historique » | product-owner | non |
| E06-Q14 | Identifiants internes (D84, D86, D46) écrits à l'écran | Jargon | Retirer les identifiants, garder la phrase | expert-marketing | non |
| E06-Q15 | Rejeu en un clic ; l'API exige `reasonCode` (`backoffice-actions.ts`) et `05` RG101 un aperçu | Appel refusé | Panneau `ReplayPanel` compact sous la ligne | product-owner | non |
| E06-Q16 | Ordre des blocs différent de `15` RG41 « ordre imposé » ; 07 le déclare à arbitrer | Spécification à amender | Amender `15` RG41 et `17b` §3.5 | product-owner | non |
| E06-Q17 | Actions : `17b` §3.5 prévoit Suspendre et Réattribuer, non codés | Rien à perdre | Hors lot | product-owner | non |
| E06-Q18 | Dates « 22/11 à 00 h 53 » ; le code écrit `dateStyle: short` (`view-model.ts:22-26`) | Format à l'identique ou existant | Un format unique, posé dans `view-model.ts` | expert-ux | non |
