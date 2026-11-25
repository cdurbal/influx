# 06b — Écarts, anomalies, données et spécifications

> Constats de l'analyse du 2026-11-24 et du 2026-11-25. **Rien n'est corrigé dans cette mission.**
> Décisions associées : `06a-decisions.md`. Journal des écarts accordés pendant le lot : §7.

## 1. Contradictions transverses

| ID | Constat | Décision |
|---|---|---|
| X1 | Tailles fluides interdites sous KEO, employées par 2b, 5b, 8, 15, 18 | RU-01 |
| X2 | Coche « vérifié » seule, badges sans date (`20` §11.3, `08` RG4, RG10) | RU-02 |
| X3 | Seuils 640 et 1 536 px hors points de rupture | RU-03 |
| X4 | `rgba` et opacités littérales, voiles sur photo | RU-04, RU-09 |
| X5 | Ombre au repos sur l'encadré collant | RU-05 |
| X6 | Onglets segmentés hors conversation (D74) | RU-10 |
| X7 | `surface-active` étendu, texte tertiaire dessus | RU-11 |
| X8 à X11 | Défauts d'accessibilité des maquettes (§3) | RU-12 |
| X12 | Étoile `data-3` réservée aux graphiques | RU-13 |
| X13 | Textes en français seulement | RU-14 |

## 2. Anomalies des maquettes elles-mêmes

| # | Anomalie | Où | Traitement |
|---|---|---|---|
| M1 | Étapes 2 et 4 du profil créateur et 7 autres états absents du sélecteur (atteints par l'ancre) | `proto-profil`, `-profil-marque`, `-entree` | Ajoutés au relevé (`05` §1) |
| M2 | Pied d'assistant à 395,9 et 396,3 px pour 375 px ; compteur de recherche recouvert | 3, 7, 2 | RU-36 |
| M3 | Densité `bo` oubliée (corps 16 px) | `proto-bo-recherche` | RU-15 |
| M4 | `color-action-primary-text` et `color-surface-input` inexistants | 13, 11 | RU-08, `03` §3.4 |
| M5 | Débordement horizontal à 375 px : `proto-marque#soumise` (477 px) | 5b | Page du backoffice : sans objet si RU-24 |
| M6 | Liens et boutons morts (« Voir la page publique », « Inviter une personne », « Ce n'était pas moi ») | 5, 6, 10, 17, 21, 4 | RU-24, RU-39, RU-41 |
| M7 | 6 motifs de refus montrés sur 8 servis ; entrées d'administrateur montrées à un commercial ; retards en orange (le code et `17b` §6.3 : rouge) | 4, 5 | RU-39 ; fiches E04, E05 |
| M8 | Écrans hors sujet dans un état (« version soumise » dans la coque créateur) | 5b | RU-24 |
| M9 | « Vues en onglets gris » validées (07) puis retirées le 2026-11-24 : règles CSS restées | 16 | E16-Q12 |

## 3. Accessibilité des maquettes (axe 4.13, 138 états, 375 et 1 440)

| Règle | Gravité | Occurrences | Où | Correction (sans effet visuel sauf mention) |
|---|---|---|---|---|
| `region` | modérée | 35 | `m-state`, pied, `mbar`, `selbar`, `bo-band` | Repères nommés |
| `scrollable-region-focusable` | sérieuse | 21 | Carrousels, galerie, tableaux | `tabindex="0"`, nom |
| `dlitem`, `definition-list` | sérieuse | 19 et 2 | `.ess` (8, 18) | `dl` valide |
| `target-size` | sérieuse | 8 | Liens de 18,6 px (13), « Vider » et tri | 24 px (effet visuel minime) |
| `color-contrast` | sérieuse | 6 | Opacités (15, 13), compteur d'onglet (21) | RU-09, RU-11 |
| `aria-prohibited-attr` | sérieuse | 6 | Marque ▮, « non lue » | Texte hors écran |
| `heading-order` | modérée | 1 | 14 propriété | Niveau `h3` sous `h2` |
| `page-has-heading-one` | modérée | 1 | 19 décidé (Lot 4) | Hors lot |

## 4. Spécifications à amender avant le code (règle d'or)

| Document | Objet | Décision |
|---|---|---|
| `20` §11.3, §11.5, §11.8 | Tokens, tailles, ombre, mouvements, composants, onglets, étoile | RU-01 à RU-13, RU-17 |
| `04-DIRECTION-ARTISTIQUE` §9, `03-PROPOSITIONS` §C | Exceptions « Filtres » et galerie ; assistant au lieu de collecte progressive | validées (07) |
| `17` §2.2, §2.5, §3.1, §4.1 à §4.4, §4.9, §5.1 à §5.3, §5.6, §6.2 à §6.7, §7.1 | Accueils, entrée, profils, campagne, recherche, compte | RU-26 à RU-38 |
| `17b` §1.2 à §1.7, §2.5, §2.6, §3.3, §3.5 à §3.15, §4.9, §4.11 | Rail, files, décision, fiches, administration | RU-19, RU-20, RU-28, RU-39 à RU-41 |
| `05` RG6, RG59, RG97, RG101 ; `15` RG41, RG60 | Mention, inscrits, rejeu, ordre de la fiche | RU-30, RU-28, RU-41 |
| `06` RG15, RG17, RG73 à RG75 | Site web, page publique | RU-23, RU-24 |
| `07` RG21, RG104, RG112 | Étiquettes de couche, aperçu | RU-30, RU-43 |
| `08` RG4, RG10, RG66 | Badge daté, file hors délai | RU-02, RU-28 |
| `09` CA2-bis, RG4, RG55, RG66 | Brouillon (D86), étapes, public ou interne | D86, RU-31 |
| `10` RG47, RG50, RG61.1 à RG61.6 ; `11` RG15, RG27, RG33 | Carte, visuels, sélection jointe, fil | RU-34, RU-22, RU-35 |
| `18` | Familles `E..-T..`, N1 à N3, AN-1 à AN-4 | `05` |

## 5. Données affichées et non servies

| Écran | Donnée | Aujourd'hui | Suite |
|---|---|---|---|
| E01 | Sélections, nombre, campagne | partiel : `campaignId` sans titre (`shortlists.ts:74`) | titre joint côté front avec la liste des campagnes |
| E01 | Délai d'examen « 8 heures ouvrées » | non (file interne) | voir E01-Q2 |
| E02 | « Nouveau profil » | en partie : `vigilance = recent_profile`, une seule note par carte | E02-Q6 |
| E02 | Nombre de pages | non, jamais (RG59) | E02-Q1 |
| E02b | Audience par réseau | non : audience du seul réseau principal | E02b-Q2 |
| E02b | Ancienneté sur INFLUX | non | E02b-Q5 |
| E04b | Prénom et initiale de l'agent | non : `me` = `email`, `role` (`backoffice-auth.ts:266-277`) | Q07 |
| E04b | Noms des comptes d'une alerte AL21 | non : `accountId` seul (`backoffice-actions.ts:673`) | Q10 |
| E04b | Regroupement par code | non : une alerte par compte | calcul d'affichage, aucune règle métier |
| E05 | Nom de l'entrée suivante | non : `next.entryId` seul (`:541`) | Q03 |
| E05 | Historique complet | non : dépôt, prise actuelle, dernière levée, décision seulement | Q08 |
| E05 | Réseaux et formats liés | non : deux listes sans lien (`lists.networks`, `lists.formats`) | Q10 |
| E05 | Libellés des codes (secteurs, thèmes, rythmes) | non : `humanCode` (`queue-review-facts.ts:60`) | Q10 |
| E05 | Page publique, version soumise | aucune route | Q05 |
| E05b | Accroche | non, champ inexistant | E05b-Q4 |
| E05b | Ancienneté | non | E05b-Q4 |
| E05b | Campagnes ouvertes de la marque | non ; `GET /v1/open-campaigns` n'a ni filtre ni identifiant de marque | E05b-Q2 |
| E06 | Entrées « À traiter » | Non ; seule la file des visuels accepte `account` (`creator-queues.ts:200`) | lecture nouvelle par compte |
| E06 | Campagnes d'un compte | Non ; aucune route de liste (`campaign-record-routes.ts`) | lecture nouvelle |
| E06 | Nom public, logo, secteur de la marque | Non (`companyName` seul, `accounts/repository.ts:225`) | à servir |
| E06 | Auteur d'un badge | Non, `grantedAt` seul (`accountBadgeRowSchema`) | à servir |
| E06b | Nom légal, alias, thématique, pseudos, parts d'audience du créateur | Non ; contrat explicite « No handle » | à servir |
| E06b | État, complétude, champs modifiés, décisions du profil créateur | Non (`accountCreatorSchema`) | à servir |
| E06b | Vignettes du portfolio | Non, comptes seuls (L2G) | décision |
| E06b | Invitant et date d'invitation | Non, booléen `viaInvitation` | à servir |
| E06b | Auteur d'un badge | Non, `grantedAt` seul | à servir |
| E09 | Date de modification, « hier » | non : `createdAt` seul | E09-Q2 |
| E09 | Vignettes de la liste | non : lire chaque liste, puis les images | E09-Q2 |
| E09 | Sélection jointe à la demande | non : `selectionRequestBodySchema` n'a pas `shortlistId` ; `0325` et `0330` l'excluent (`0330:55`) | E09-Q1 |
| E09 | Sélection jointe côté agent | non : `selections-equipe` ne la montre pas | E09-Q1 |
| E13 | Visuels, titre, thématiques, pays du profil | Non (`identifiedCreatorRowSchema`) | à servir |
| E13 | Liste des campagnes liables, avec marque | Non | lecture nouvelle |
| E13 | Pays d'audience multiples | Non, F6 = un pays | décision |
| E13 | Ville en texte libre | Non, G9 = pays et régions | décision |
| E13 | Dernière publication | Non | retirer de l'exemple |
| E16 | Total des inscrits, rang de page | non : `nextCursor` seul (`backoffice-accounts.ts:299-306`) | Q10 |
| E16 | Nom ou alias, adresse masquée | non, exclus par contrat : « NO address and NO name » (`backoffice-accounts.ts:6-7, 176`) | Q06 |
| E17 | Référence `CMP-2026-…` | Non (`campaignRecordResponseSchema`, `campaign-review.ts:422`) | décision ; `17b` la cite |
| E17 | Langue de la campagne | Non ; langue du compte (`brand.preferredLanguage`) | décision |
| E17 | Logo de la marque | Non | à servir |
| E17 | Échéance, verrou de l'entrée | Non, `entries` sans SLA ni détenteur | à servir |
| E17 | Soumissions passées | Non affichées, `createdAt` de l'entrée présent | calculable |
| E17 | Vue créateur de la campagne | Non au backoffice | décision |
| E21 | Liste (compte, destination, cause) | Partiel, `POST /v1/bo/accounts/search` `syncState=failed`, une ligne par compte, sans nom (`accountRowSchema`) | nom, alias, destination : lecture dédiée |
| E21 | Filtre par cause, plus ancien, total des cas normaux | Non | à servir ou retirer |
| E21 | Alias « Profil 7K3MQA » dans l'objet | Non, niveau et réseau seuls (`dualControlTargetSchema`, jamais un identifiant) | décision E21-Q05 |
| E21b | Adresse masquée | Non, adresse entière (`memberInvitationsResponseSchema`) | masquage à l'écran ou à l'API |
| E21b | Dernière connexion d'un compte interne | Non (une session n'est lisible que de son titulaire) | à servir ou retirer |
| E21b | Désactivation, transfert | Aucune route | hors API |

Détail et autres écarts (compteurs par file, manques d'une campagne, constaté face au déclaré, audience par
réseau) : §8 de chaque fiche. Écritures ou migrations : sélection jointe et désactivation (RU-22). Retrait de
champ : site web (RU-23).

## 6. Anomalies de l'existant relevées au passage (non corrigées)

| # | Constat | Référence |
|---|---|---|
| A1 | Sélection jointe à une demande (RG61.1 à RG61.6) décidée pour L3G, absente du contrat et de la file 9 | `0330` l. 55, E09-Q1 |
| A2 | `GET /v1/bo/queues/counters` ne couvre pas les 9 files ; l'accueil compose plusieurs chemins | E04-Q01 |
| A3 | « Session expirée » (`17` §6.7) et destination mémorisée non réalisées | `MemberShell.tsx:130`, E11b §10 |
| A4 | Texte de 404 membre différent de `17` §6.7 | E11b §10 |
| A5 | Site web de la marque servi au créateur malgré la décision du 2026-11-24 | `campaign-creator-view.ts:101` |
| A6 | Brouillon de campagne masqué avant publication (D86, tranchée, non réalisée) | E12, E01 |
| A7 | Libellés et structures du compte, de la recherche BO et des fiches lus par des specs e2e : sélecteurs à migrer dans le même commit | §7 des fiches |

## 7. Journal des écarts accordés

Un écart à une maquette n'existe qu'inscrit ici, avec l'accord du fondateur.

| Date | Écran, élément | Écart | Motif | Accord |
|---|---|---|---|---|
| 2026-11-25 | 7 (étape 4), 18 : encadré interne | Valeur du produit dans l'encadré interne ; nature et nombre de créateurs hors de l'encadré | D78, `09` RG30, RG55, RG66, RG98 | Fondateur, D87 (RU-31) |
| 2026-11-25 | 10 (étape 3) : fonction | Liste fermée, publique, hors de l'encadré | `06` RG35, RG36 | Fondateur, D87 (RU-31) |
| 2026-11-25 | 18 : commercial ; 5b : phrase | « Votre commercial INFLUX » sans nom ; phrase corrigée | D45, D47 | Fondateur, D87 (RU-37) |
| 2026-11-25 | 19 : fenêtre rétrécie | Page déjà montée avec verrou ou saisie gardée, masquée | Perte de saisie | Fondateur, D87 (RU-20) |
| 2026-11-25 | 3, 11, 14, 16, 20, 21 : textes réglementaires | Textes en vigueur gardés mot pour mot et visibles | RU-30, jusqu'à avis écrit | Fondateur, D87 (principe) |
| 2026-11-25 | 2, 2b, 3, 4, 5, 6, 9, 13, 16, 17, 21 : contenus ajoutés | Contenus obligatoires ou opérationnels absents des maquettes, ajoutés | RU-26, place validée sur capture | Fondateur, D87 (principe) |
| 2026-11-25 | 5, 6, 10, 17 : « Voir la page publique » | Aperçu interne au backoffice, pas d'onglet vers `apps/web` | `17b` §2.5, RU-24 | Fondateur, D87 (principe) |
| 2026-11-25 | 8 : ligne de filtres du fil | Non rendue dans ce lot | API, EC-L3D-2, Lot 6bis | Fondateur, D87 (RU-35) |
| 2026-11-25 | 2b, 5b, 8, 15, 18 : tailles de titre et de chiffre | Trois paliers fixes, 3,6 px d'écart au plus | `20` §11.5, TK7.3 | Fondateur, D87 (RU-01) |
| 2026-11-25 | 15, 21 : éléments inertes | État désactivé de la charte, sans opacité | Contraste AA | Fondateur, D87 (RU-09) |
| 2026-11-25 | 13 : liens ; divers : repères, listes, noms | Liens de 24 px ; corrections sans effet visuel | axe | Fondateur, D87 (RU-12) |
| 2026-11-25 | 13 : densité ; 6 : badge de rôle | Densité `bo` ; graisse du badge | Divergence entre maquettes | Fondateur, D87 (RU-15) |
| 2026-11-25 | BO, 768 à 1 023 px | Bande horizontale gardée | `02` §21.5, `17b` §1.7 | Fondateur, D87 (RU-19) |
| 2026-11-25 | 5b, 8 : « Ce qui vous concerne » | Section absente tant que non servie | D11, donnée non servie | Fondateur, D87 (RU-25) |
| 2026-11-25 | 1, 7 : délais | Lus dans la configuration, sinon sans chiffre | `EC-L3B-10-2` | Fondateur, D87 (RU-29) |
| 2026-11-25 | 3, 7, 10 : segments et mémoire d'étape | Navigation libre, étape dans l'adresse | `17` §4.3 | Fondateur, D87 (RU-32) |
| 2026-11-25 | 3 : « Complet », champs indispensables, tranches | Selon `missingRequired` ; compte principal seul | `07` RG4, RG22, RG56 | Fondateur, D87 (RU-33) |
| 2026-11-25 | 2, 2b, 9 : tranches, pastille, ancienneté | Tranches servies ; pastille et ancienneté retirées | Anonymat, `17` §7.1 | Fondateur, D87 (RU-34) |
| 2026-11-25 | 2, 3, 7 : pied et barre à 375 px | « Précédent » réduit à son chevron nommé ; lien raccourci | Débordement de la maquette | Fondateur, D87 (RU-36) |
| 2026-11-25 | 10, 11, 20 : règles du compte et de l'entrée | Selon `06a` RU-38 et les fiches | `05`, `17`, D72 | Fondateur, D87 (RU-38) |
| 2026-11-25 | 4, 5, 6, 17 : règles des gestes d'agent | Motif obligatoire, états figés, brief entier | `15`, `17b`, API | Fondateur, D87 (RU-39) |
| 2026-11-25 | 21 : rejeu, confirmation, invitations internes | Motif, aperçu, mot de passe et code ; formulaire interne ajouté | RG101, B-5, D84 | Fondateur, D87 (RU-41) |
| 2026-11-25 | 6 : vignettes du portfolio | Au geste seulement | D82, L2G | Fondateur, D87 (RU-42) |
| 2026-11-25 | 15 : aperçu | Décor annoncé, aucune donnée reconstituée | `07` RG104 | Fondateur, D87 (RU-43) |
| 2026-11-25 | C17 (notices) | Trois tons seulement : « alerte » rendu en warning, « neutre » en info (EC-RUA-06-1) | Pas de ton d'erreur ni de couleur nouvelle (D6) | Fondateur, D88 (RU-27, F1) |
| 2026-11-25 | U46 : notice sous un badge d'état durable | Notice posée sous le badge, malgré « jamais pour un état durable » (EC-RUA-06-2, F2) | Fiches de domaine, `06a` RU-27 | Fondateur, D88 (RU-27, F1) |
| 2026-11-25 | C08 : filtre actif | « Réinitialiser » et non « Effacer » (EC-RUA-06-3, F8) | Fiche et `17b` §4.2 | Fondateur, D88 (RU-27, F1) |
| 2026-11-25 | Backoffice à 375 px : F7, F8 | Aucun rendu à cette largeur (EC-RUA-06-4) | Sous 768 px aucune page montée (RU-20) | Fondateur, D88 (RU-27, F1) |
| 2026-11-25 | 2b, 15 : avatar | Disque `surface-active` uni, initiales `text-primary` ; ni dégradé `data-1` ni pastille chiffrée | `20` §11.3 (`data-*` : graphiques seuls), `17` §7.1 | `expert-ux`, D88 (RU-07, RUA-A) ; confirmation du fondateur à la validation de l'écran (`05` §8) |
| 2026-11-25 | 2, 13 : points de carrousel inactifs | `text-secondary`, l'actif en `text-primary` et plus large (opacité de la maquette retirée) | Contraste AA, `20` §11.8 (désactivé sans opacité) | Fondateur, D87 (RU-09) ; détail `expert-ux`, D88 |
| 2026-11-25 | 13 : photo d'une carte bloquée | Rendue entière, non assombrie ; l'état est dit par `.blk` et la case ronde (contour `text-disabled`) | Contraste AA, `20` §11.8 (désactivé sans opacité) | Fondateur, D87 (RU-09) ; détail `expert-ux`, D88 |
| 2026-11-25 | Écrans membres actuels : composants partagés qui évoluent (RUB) | Seuls effets listés par `jalons/rub/modele-archi.md` §1 : mesures ramenées à `02a`, messages de champ en C19 (`Field`), coquille et cadres (E01.0, pages étroites alignées à gauche, 672 → 768 px dès 1 280) ; revus en F1 | EC-RUB-4, `08` §1.4 | Fondateur, D89 (F0 Q4 « oui a toutes les questions ») |
| 2026-11-25 | 21 : ligne de secours (avertissement à 50 %) | Fond `feedback-warning-bg` opaque ; l'icône et le mot portent l'état (EC-RUA-A-1) | Aucun fond translucide (D72, K3), contraste AA | `expert-ux`, D88 (RUA-A) ; confirmation du fondateur à la validation de l'écran (`05` §8) |
