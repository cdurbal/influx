# E21 — Files « Échecs de synchronisation » et « Actions à valider » (commercial, administrateur)
> Maquette : `proto-bo-admin.html` (états synchro, synchro-normaux, dv-liste, dv, dv-degrade) · page de comparaison `ecran-21-bo-admin.html` · validée le 2026-11-24 (07) · Constats : U37, U41, U57. Partie a ; comptes, invitations, Apollo, santé : `E21b-bo-admin-comptes.md`.

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E21.1 | Échecs de synchronisation | aucune ; nouvelle (proposée `/files/echecs-synchronisation`) | aucune (D36) | partie de `AccountsScreen.tsx` (vues « À traiter » et « Cas normaux »), `ReplayPanel.tsx` | synchro, synchro-normaux | L | C57 (rail), E16 (perd sa vue), lecture nouvelle (E21-Q01) |
| E21.2 | Actions en attente de validation (liste) | `/double-validation` (rang de file à décider) | aucune (D36) | `DualControlListScreen` (`DualControlScreens.tsx:277-363`) | dv-liste | S | C57 |
| E21.3 | Une action | `/double-validation/[id]` | aucune (D36) | `DualControlScreen` (`DualControlScreens.tsx:391-621`) | dv, dv-degrade | M | `ActionFeedback.tsx` (confirmation d'identité) |

Fonctionnalités à préserver :
- Échecs et cas normaux : deux vues, jamais un total (`05` RG100) ; cause en clair, réglage nommé (`RG160`) ; aucune case ni bouton sur un cas normal, une phrase (`RG103`) ; aucun export (`RG106`) ; lien « état des services » : `AccountsScreen.tsx:293-300`, `:506-520`.
- Rejeu : aperçu, plafond 200, motif fermé, réversibilité dite, confirmation distincte, compte rendu par ligne (`ReplayPanel.tsx:31-136`, `05` RG101 à RG103).
- Double validation : liste admin (`:277-363`) ; écran distinct (PD2) ; quatre gestes selon l'API : pair, seul après 60 s avec justification écrite, attendre, aucun (PD7) ; objet nommé par `target`, jamais par identifiant (PD1) ; refus, abandon ; décompte calé sur l'API (`:369-389`) ; conflit « déjà confirmée à {heure} par {nom} ».
- Retrait de badge, réglages Apollo et de recherche, changement de rôle, invitation d'admin, demande « mes données » : huit actions nommées (`ActionTarget`, `:185-234`).

API appelée : `POST /v1/bo/accounts/search` (`syncState`, `syncDestination`), `GET /v1/bo/accounts/counters`, `POST /v1/bo/leads/replays` ; `GET /v1/bo/dual-control`, `GET /v1/bo/dual-control/:id`, `POST …/confirm`, `POST …/cancel`, `GET /v1/bo/settings/search`, `GET /v1/bo/internal-accounts` (prénoms).

## 2. Structure
Cadre C57. Rail : « Files » ancêtre, sous-groupes en surtitre : Profils et visuels, Vérifications, Campagnes et sélections, Fonctionnement, Obligations et contrôles. « Échecs de synchronisation » et « Actions à valider » en sous-entrées avec leur nombre. Zone C01, écart 24 px, gouttière 48 px à 1440.

- E21.1, ordre : `lhead` (fil, `h1` 28 px (hauteur 32,2 px), résumé 22 px ; 91,6 px) ; `fbar` 40 px (vues 224,6 px, séparateur, deux pastilles 36 px) ; contenu. À 768 : `fbar` 84 px.
  - À traiter : barre de lot C63 (52 px, `surface-raised`, `radius-md`) puis tableau pleine largeur (1 104 px à 1440, 718 px défilant à 768), lignes 43,7 px (case de 24 px), en-tête 30,2 px, colonne de sélection 55 px à 1440 (40 px déclarés). Colonnes : Compte 264, Destination 165, Cause 337, Tentatives, Dernière à droite.
  - Cas normaux : phrase, tableau à 3 colonnes (294, 237, 573), phrase de bas.
- E21.2 : `lhead` 91,6 px, tableau à 4 colonnes (522, 141, 239, 202).
- E21.3 : colonne `dvp` de 832 px au plus (52 rem), écart `spacing-4` ; ordre : fil (3 niveaux), `h1`, résumé, notice (affaibli seulement), propriétés (étiquette 160 px, filet haut), second facteur (256 px), décompte, actions, note.
- Sous 1 280 px, la première colonne des tableaux est collante (`.tbl th:first-child`) ; 768 à 1 023 px : rail en liste (`17b` §1.7) ; 375 : C67 seul.

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E21.1-S01 | Rail | C57 | « Files » ancêtre ; sous-entrée courante fond `nav-item-active`, filet gauche ; nombre à droite | Agent et admin ; « Actions à valider » : admin | synchro, `.bo-nav` | E21.1-CA01 | E21.1-T01 |
| E21.1-S02 | En-tête | C02 | Fil Files, titre ; `h1` ; résumé « {n} à traiter · plus ancien {durée} · aucun verrou : le rejeu est sans doublon » | Toujours ; durée non servie (E21-Q02) | synchro, `.lhead` | E21.1-CA02 | E21.1-T01 |
| E21.1-S03 | Vues | C22 | Deux vues en pilule, nombre par vue, `aria-current` ; fond `surface-active` si courante | Toujours ; compte des cas normaux non servi (E21-Q02) | synchro, `.views` | E21.1-CA03 | E21.1-T01 |
| E21.1-S04 | Filtres | C30 | Pastilles « Destination : toutes », « Cause : toutes » | Vue À traiter ; filtre par cause non servi (E21-Q02) | synchro, `.pill` | E21.1-CA04 | E21.1-T02 |
| E21.1-S05 | Lot | C63 | « {n} sélectionnés · 200 au plus par lot » ; « Rejouer la sélection ({n}) » secondaire 36 px | Vue À traiter ; bouton désactivé à 0 | synchro, `.batch` | E21.1-CA05 | E21.1-T02 |
| E21.1-S06 | Tableau | C58 | Case 24 px par ligne avec nom « Sélectionner {compte} » ; ligne = compte et destination | Échec seul ; case de tête non montrée (E21-Q03) | synchro, `.sel` | E21.1-CA05 | E21.1-T02 |
| E21.1-S07 | Tableau | C58 | Compte (lien gras vers la fiche), Destination, Cause en clair, Tentatives, Dernière tentative | Échec ; nom et tentatives non servis (E21-Q02) | synchro, `#sy` | E21.1-CA04 | E21.1-T01 |
| E21.1-S08 | Lot | C27 | Aperçu, plafond, motif, confirmation, réversibilité | Non montré ; `ReplayPanel` préservé (E21-Q04) | non montré | E21.1-CA05 | E21.1-T02 |
| E21.1-S09 | Compte rendu | C17 | Notice succès « {n} envois remis en file, {n} ignoré, {n} refusé. Aucun doublon, aucun e-mail renvoyé. » et annonce | Après rejeu ; lignes nommées conservées | synchro, `#sy-done` | E21.1-CA06 | E21.1-T02 |
| E21.1-S10 | Cas normaux | C17 | Phrase « Ces inscrits ne sont pas envoyés, et c'est voulu… » | Vue Cas normaux | synchro-normaux, `p.sm` | E21.1-CA03 | E21.1-T01 |
| E21.1-S11 | Cas normaux | C58 | Tableau Compte, Destination, Raison | Vue Cas normaux | synchro-normaux, `.tbl` | E21.1-CA03 | E21.1-T01 |
| E21.1-S12 | Cas normaux | C17 | « Aucun bouton de rejeu ici : ces lignes ne se rejouent pas. » | Vue Cas normaux | synchro-normaux, `p.xs` | E21.1-CA03 | E21.1-T01 |
| E21.1-S13 | Aide | C17 | Lien « état des services » (admin) | Non montré ; `ServicesHint` préservé | non montré | E21.1-CA04 | E21.1-T01 |
| E21.2-S01 | En-tête | C02 | Fil Files, `h1`, phrase sur 24 heures | Toujours | dv-liste, `.lhead` | E21.2-CA01 | E21.2-T01 |
| E21.2-S02 | Tableau | C58 | Action (lien gras étiré, phrase avec objet), Demandeur (« Vous »), Expire le et « (dans {n} h) » tertiaire, Votre geste (gras si « à confirmer ») | Demandes ouvertes ; objet dans la liste (E21-Q05) | dv-liste, `.tbl` | E21.2-CA01 | E21.2-T01 |
| E21.2-S03 | Tableau | C08 | Vide, chargement, refus, erreur | Non montrés ; textes préservés | non montré | E21.2-CA02 | E21.2-T01 |
| E21.3-S01 | En-tête | C02 | Fil Files, Actions en attente, « Une action » ; `h1` | Toujours | dv, `.crumbs` | E21.3-CA01 | E21.3-T01 |
| E21.3-S02 | En-tête | C07 | « Demandée par {nom} le {date} · expire le {date} (dans {n} h) » | Toujours ; « vous » si moi | dv, `.lsum` | E21.3-CA01 | E21.3-T01 |
| E21.3-S03 | Contrôle | C17 | Notice warning « CONTRÔLE AFFAIBLI. … » gras puis phrase | `confirm_degraded` | dv-degrade, `.notice` | E21.3-CA02 | E21.3-T02 |
| E21.3-S04 | Objet | C07 | Action, Motif, Message au membre, Conséquences, Réversible ; étiquette 160 px | Selon l'action ; portée, fiche, commentaire conservés (E21-Q06) | dv, `.dvprops` | E21.3-CA03 | E21.3-T01 |
| E21.3-S05 | Second facteur | C49 | Champ « Second facteur (code à 6 chiffres) », 256 px, numérique | Maquette : toujours ; code : mot de passe et code à la demande (E21-Q07) | dv, `#dv-code` | E21.3-CA04 | E21.3-T03 |
| E21.3-S06 | Décompte | C29 | « Confirmation possible dans {n} s. » puis « Vous pouvez confirmer. » ; annoncé à 30 et 10 | `confirm_degraded` | dv-degrade, `#dv-cd` | E21.3-CA02 | E21.3-T02 |
| E21.3-S07 | Actions | C10 | « Confirmer l'action » primaire ; désactivé (opacité) pendant le décompte | `confirm_as_peer` ou `confirm_degraded` | dv, `#dv-ok` | E21.3-CA04 | E21.3-T02 |
| E21.3-S08 | Actions | C10 | « Refuser la demande » (pair, secondaire) ou « Abandonner la demande » (demandeur, texte) | Selon l'API ; même route | dv, dv-degrade | E21.3-CA05 | E21.3-T01 |
| E21.3-S09 | Actions | C17 | Note sur l'écran distinct et le délai de 60 s | Toujours | dv, `.dvp > p.xs` | E21.3-CA02 | E21.3-T01 |
| E21.3-S10 | Justification | C18 | Zone « Justification écrite (min à max) » et son erreur | Non montrée ; exigée par l'API en mode seul (E21-Q08) | non montré | E21.3-CA02 | E21.3-T02 |
| E21.3-S11 | États | C17 | Attend un pair, aucun geste, déjà confirmée, expirée, abandonnée, faite, objet introuvable | Non montrés ; textes préservés | non montré | E21.3-CA06 | E21.3-T01 |

## 4. Textes
Backoffice en français seul : `messages/fr.ts` (D36 ouverte) ; EN vaut « D36 ». Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E21.1-S01 | Profils et visuels · Vérifications · Campagnes et sélections · Fonctionnement · Obligations et contrôles · Échecs de synchronisation · Actions à valider | D36 | nouvelle ; `17b` §1.3 nomme autrement les groupes (E21-Q09) |
| E21.1-S02 | Échecs de synchronisation · {n} à traiter · plus ancien {durée} · aucun verrou : le rejeu est sans doublon | D36 | nouvelle |
| E21.1-S03 | À traiter · Cas normaux | D36 | `accounts.viewFailed`, `viewNormal` |
| E21.1-S04 | Destination : toutes · Cause : toutes | D36 | nouvelle |
| E21.1-S05 | {n} sélectionnés · 200 au plus par lot · {n} sélectionné · Rejouer la sélection ({n}) | D36 | `replay.selection`, `replay.open` |
| E21.1-S06, S07 | Compte · Destination · Cause · Tentatives · Dernière · Sélectionner {compte} | D36 | `accounts.selectRow` à changer |
| E21.1-S07 | Clé d'accès refusée par Apollo · Adresse refusée : format invalide · Quota journalier dépassé | D36 | `syncCause.*` (mots fixes existants font foi) |
| E21.1-S09 | {n} envois remis en file, {n} ignoré, {n} refusé. Aucun doublon, aucun e-mail renvoyé. | D36 | `replay.report` |
| E21.1-S10 à S12 | Ces inscrits ne sont pas envoyés, et c'est voulu : ce ne sont pas des échecs. · Raison · Pays exclu de la prospection Apollo · Ignoré pour absence de consentement · Hors du périmètre : créateur particulier · Aucun bouton de rejeu ici : ces lignes ne se rejouent pas. | D36 | `syncCause.*` ; phrases nouvelles |
| E21.2-S01, E21.3-S01 | Files · Actions en attente de validation · Actions en attente d'une seconde validation. Une demande expire au bout de 24 heures : rien n'est alors exécuté. · Une action · Action en attente de seconde validation | D36 | `dualControl.title`, `lead`, `requestTitle` |
| E21.2-S02 | Action · Demandeur · Expire le · Votre geste · (dans {n} h) · à confirmer · confirmation différée · Vous | D36 | `dualControl.columns`, `next` |
| E21.3-S02 | Demandée par {nom} le {date} à {heure} · expire le {date} à {heure} (dans {n} h) | D36 | `dualControl.requestedBy` |
| E21.3-S03 | CONTRÔLE AFFAIBLI. Vous confirmez une action que vous avez vous-même demandée. Ce contrôle protège contre l'erreur et la précipitation, pas contre la malveillance. Il redeviendra un vrai contrôle dès la deuxième personne dans l'équipe. | D36 | `dualControl.degraded` |
| E21.3-S04 | Action · Motif · Message au membre · Conséquences · Réversible · Retirer le badge « Audience vérifiée » · Réglages Apollo : exclure {pays} de la prospection | D36 | `dualControl.actions`, `target`, `consequences` |
| E21.3-S05 | Second facteur (code à 6 chiffres) | D36 | `reauth.codeLabel` |
| E21.3-S06 | Confirmation possible dans {n} s. · Vous pouvez confirmer. | D36 | `dualControl.countdown` (fin « Confirmation possible. ») |
| E21.3-S07, S08 | Confirmer l'action · Refuser la demande · Abandonner la demande | D36 | `dualControl.confirm` ; `refuse` vaut « Abandonner » pour tous |
| E21.3-S09 | Écran distinct de la demande, jamais dans le même enchaînement de clics. Le délai de 60 secondes est le seul délai artificiel du backoffice. | D36 | nouvelle |
| E21.3 annonces | Saisissez le code à 6 chiffres de votre second facteur. · Action confirmée et journalisée (simulé) | D36 | `reauth.generic`, `dualControl.done` |

## 5. Interactions, états, responsive, clavier
- E21.1 : vues par adresse (`?vue=normaux`), filtres par adresse, sélection en mémoire, remise à zéro au changement de vue ou de filtre. Le clic « Rejouer » ouvre `ReplayPanel` (aperçu, motif, confirmation), puis S09 annonce ; la liste est relue au choix de l'agent (`replay.close`). 200 atteints : surplus refusé et listé.
- E21.2 : la ligne est un lien étiré (une seule cible) ; `j`, `k`, Entrée conservés par C58.
- E21.3 : décompte calé sur `secondsLeft` et l'instant de réponse, jamais sur l'horloge locale ; à zéro, bouton actif, annonce. Échec de second facteur : message, compteur inchangé. Après confirmation : message final sur l'écran (`dualControl.done`), puis retour liste par lien. La maquette renvoie seule vers la liste : préserver le message.
- États : chargement, vide, refus (403), erreur de E21.1 non montrés, préservés (`AccountsScreen.tsx`, `failure.*`) ; E21.2 : `empty`, `common.loading`, `failure.forbidden` (`DualControlScreens.tsx:308-316`) ; E21.3 : `:435-452`. Hors ligne : phrase commune. Permission : agent sur E21.2 ou E21.3, refus journalisé.
- Responsive : §2 ; largeurs minimales de tableau 718 px (E21.1), défilement interne, page sans débordement (constat axe : régions sans focus, corrigées par `DenseTableRegion`).
- Clavier et focus : ordre DOM ; `details` absent ; focus sur S05 après erreur ; annonce C29 du décompte à 30 et 10 s et à zéro, jamais chaque seconde ; animations : fond de ligne et bord de pastille `duration-fast`, aucune en mouvement réduit.

## 6. Critères d'acceptation
- **E21.1-CA01** Les deux files figurent dans « Files », groupes nommés, nombre exact, entrée courante marquée ; un agent ne voit pas « Actions à valider ».
- **E21.1-CA02** Le résumé ne montre aucun chiffre inventé : une valeur non servie est omise, jamais estimée.
- **E21.1-CA03** « À traiter » et « Cas normaux » ne sont jamais additionnés ; aucun bouton de rejeu, même grisé, sur un cas normal.
- **E21.1-CA04** La cause est en français courant, sans code, adresse ni message technique ; le compte mène à sa fiche journalisée.
- **E21.1-CA05** Rejeu par lot de 200 au plus, avec aperçu, motif et confirmation distincte ; ni un échec ni un refus n'est rejoué deux fois.
- **E21.1-CA06** Le compte rendu nomme remis en file, ignorés et refusés, ligne par ligne.
- **E21.2-CA01** La liste dit l'action, l'objet, le demandeur, l'échéance et le geste ; la ligne ouvre l'action.
- **E21.2-CA02** Vide, refus et erreur ont leur phrase ; aucun écran blanc.
- **E21.3-CA01** L'écran de confirmation est distinct de la demande (PD2) et dit demandeur et échéance.
- **E21.3-CA02** En mode seul : bandeau « affaibli » écrit, 60 s comptées et annoncées, justification écrite obligatoire ; la base refuse une confirmation anticipée.
- **E21.3-CA03** Objet, motif, commentaire, portée, conséquences et réversibilité sont affichés ; un objet introuvable est dit et empêche la confirmation.
- **E21.3-CA04** La confirmation exige le second facteur frais (PD3) ; aucun code n'est gardé après l'essai.
- **E21.3-CA05** Refus par un pair et abandon par le demandeur journalisent leur auteur et n'exécutent rien.
- **E21.3-CA06** Une demande déjà confirmée, expirée ou abandonnée n'offre aucun geste et dit pourquoi.
- **E21.3-CA07** axe sans violation à 768, 1 024, 1 280, 1 440 sur les trois écrans (contraste 4,13:1 du nombre « Cas normaux » corrigé) ; C67 sous 768 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E21.1-T01 | e2e | nouveau `sync-failures.spec.ts` ; déplacer CA57 à CA60 de `backoffice.spec.ts:210-299` | Vues, causes, cas normaux, absence d'export |
| E21.1-T02 | e2e, unitaire | `backoffice.spec.ts:278-343` (panneau `replay.title`), `view-model.test.ts` (`replayPairs`, `replayPreviewOf`) | Sélection, rejeu, compte rendu |
| E21.1-T03 | unitaire | `bo-nav.test.ts`, `bo-nav-ui.test.ts` à adapter | Entrées, groupes, rôles, `g` puis n |
| E21.2-T01 | e2e | `backoffice.spec.ts:457-530` (h1, `dualControl.refuse`) | Liste et gestes |
| E21.3-T01 | e2e | `verification-revocation.spec.ts`, `backoffice.spec.ts:505-515` | Objet, refus, abandon |
| E21.3-T02 | e2e | `backoffice.spec.ts:625-728` (PD1 à PD7) | Affaibli, décompte, justification |
| E21.3-T03 | e2e | même spec, confirmation d'identité (`ActionFeedback`) | Second facteur |
| E21.3-T04 | a11y, visuel | nouveau, captures 768, 1 280, 1 440 des cinq états | CA07 et fidélité |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Vues d'échec dans « Inscrits » | `AccountsScreen.tsx:293-320` | liste E16 sans ces vues ; file E21.1 | supprimer, créer |
| Rejeu par lot | `AccountsScreen.tsx:500-520`, `ReplayPanel.tsx` | file E21.1 | réutiliser |
| Entrée de rail | `bo-nav.ts` (Administration) | Files, groupe Obligations | faire évoluer |
| Écran 60 s | `DualControlScreens.tsx:391-621` | E21.3 | faire évoluer |
| Confirmation d'identité sous le formulaire | `ActionFeedback.tsx` | écran distinct, champ sur place | faire évoluer |

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Nombre d'échecs par destination | Oui, `unhandledFailures` (`/v1/bo/accounts/counters`) | aucun ; compte par compte et destination à dériver |
| Liste (compte, destination, cause) | Partiel, `POST /v1/bo/accounts/search` `syncState=failed`, une ligne par compte, sans nom (`accountRowSchema`) | nom, alias, destination : lecture dédiée |
| Tentatives | Lues en SQL (`accounts/repository.ts:95`), non servies | à servir |
| Filtre par cause, plus ancien, total des cas normaux | Non | à servir ou retirer |
| Nombre dans le rail pour ces deux files | `queueCodeSchema` ne contient aucune des deux (`backoffice-queues.ts:46`) | à servir |
| Objet d'une action dans la liste | Oui, `target` et `action` dans `GET /v1/bo/dual-control` | aucun, mots à composer |
| Alias « Profil 7K3MQA » dans l'objet | Non, niveau et réseau seuls (`dualControlTargetSchema`, jamais un identifiant) | décision E21-Q05 |
| Heure de confirmation, nom du pair | Oui | aucun |

Hors lot (Lot 4 ou 5) : files « Adresses injoignables », « Échecs d'envoi d'e-mails », demandes de données personnelles (`17b` §1.3).

## 9. Contradictions, manques et décisions
Transverses : X6 (vues en pilules), X7 (surface active, 4,13:1 sur « Cas normaux 25 », axe), X8 (tableaux sans focus, corrigés), X11, X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E21-Q01 | Route nouvelle pour les échecs (décision du 2026-11-24, `17b` §1.3) ; aucune adresse fixée ; « Actions à valider » vit sous `/double-validation` (liens des notices, e-mail, `bo-nav.ts`) | Navigation, redirections, tests | `/files/echecs-synchronisation` créée ; `/double-validation` gardée, rangée dans Files ; `/inscrits?vue=` redirigée | architecte | oui |
| E21-Q02 | Nom du compte, tentatives, filtre par cause, « plus ancien », total des cas normaux non servis | Colonnes et résumé incomplets | Lecture dédiée par ligne (compte, destination), bornée à 20 par page | architecte | oui |
| E21-Q03 | Aucune case « tout » ni pagination, sélection de 200 sur plusieurs pages | Sélection limitée à 20 | Case de tête pour la page seule ; pagination C32 | product-owner | oui |
| E21-Q04 | Rejeu en un clic ; l'API exige un motif et `05` RG101 un aperçu | Appel refusé | `ReplayPanel` sous la barre de lot | product-owner | oui |
| E21-Q05 | Objet en phrase avec alias ; l'API ne sert jamais d'identifiant (PD1, J8S-2) | Phrase irréalisable | « Retirer le badge « Audience vérifiée » · {réseau} · {rôle}, {pays} » | expert-cybersecurite | non |
| E21-Q06 | La maquette omet portée, commentaire de la demande, lien « Ouvrir la fiche », valeur actuelle et demandée, nombre de badges emportés | Perte d'information (PD1) | Garder ces lignes dans S04 | product-owner | oui |
| E21-Q07 | Champ « Second facteur » seul, sans mot de passe ; l'API `reauthenticate` exige mot de passe et code (B-5) ; `17b` §3.13.c montre le code seul | Confirmation impossible à l'identique | Deux champs sur place, ou code seul si la règle change | expert-cybersecurite | oui |
| E21-Q08 | Justification écrite absente de la maquette dégradée ; l'API l'exige (`dualControlConfirmSchema`, PD2 à PD5) | Confirmation refusée | Zone C18 entre décompte et actions | product-owner | oui |
| E21-Q09 | Groupes du rail : maquette « Fonctionnement », « Obligations et contrôles » ; `17b` §1.3 cinq groupes ; `17b` §1.3 range 12 et 15 autrement nommés | Libellés à fixer | Noms de la maquette | product-owner | non |
| E21-Q10 | Exemple « Retirer un badge » sous double validation ; D84 (Q2) : un agent retire seul, jalon DV non réalisé (`21`) | Exemple caduc après DV | Garder tant que `0231` est en service | product-owner | non |
| E21-Q11 | « Refuser » du pair et « Abandonner » du demandeur : même route, deux libellés | Aucun | Libellé selon `requestedBy` | product-owner | non |
| E21-Q12 | « 46 » et « 4 hors délai » au rail : total des files, formule non dite | Compteur faux possible | Somme des files visibles du rôle | architecte | non |
| E21-Q13 | Rail d'un agent : « Actions à valider » visible dans la maquette pour l'admin seul, non montré pour l'agent | Aucun écran pour l'agent | Masquer (adminOnly) | product-owner | non |
