# E21 — Invitations, comptes internes, réglages Apollo, santé technique (commercial, administrateur)
> Maquette : `proto-bo-admin.html` (états invitations, invitation-creee, comptes, desactiver, apollo, sante) · page de comparaison `ecran-21-bo-admin.html` · validée le 2026-11-24 (07) · Constats : U37, U41, U57. Partie b ; files de synchronisation et double validation : `E21a-bo-admin-synchro-dv.md` (questions Q01 à Q13).

## 1. Écrans et routes
| Écran | Nom | Route FR | Route EN | Composant actuel | États de maquette | Complexité (S/M/L/XL) | Dépendances |
|---|---|---|---|---|---|---|---|
| E21.4 | Invitations de membres | `/invitations` | aucune (D36) | `MemberInvitationsScreen.tsx`, `InvitationParts.tsx` | invitations, invitation-creee | M | C57, C52, E06 |
| E21.5 | Comptes internes | `/comptes-internes` (admin) | aucune (D36) | `InternalAccountsScreen.tsx` | comptes, desactiver | L | E21.3, invitations internes |
| E21.6 | Réglages Apollo | `/reglages/apollo` (admin) | aucune (D36) | `ApolloSettingsScreen.tsx` | apollo | M | E21.3 |
| E21.7 | Santé technique | `/sante-technique` (admin) | aucune (D36) | `HealthScreen.tsx`, `HealthStatus.tsx`, `HealthErrors.tsx`, `HealthTraffic.tsx`, `HealthProcesses.tsx` | sante | L | C58 |

Fonctionnalités à préserver :
- Invitations de membres : liste (les siennes, toutes pour l'admin), création (adresse, rôle proposé, langue), lien une fois, copie, révocation avec motif : `MemberInvitationsScreen.tsx:82-258`, `InvitationParts.tsx:25-117`.
- Comptes internes : liste avec compte de secours et son encadré, état (secours, désactivé, absence), invitation interne (adresse, rôle, motif), lien une fois, invitation d'admin soumise à la double validation, liste des invitations internes et révocation : `InternalAccountsScreen.tsx:56-66`, `:68-198`, `:237-371`.
- Apollo : trois réglages, valeur en force et date, formulaires de demande (périmètre, pays, base légale et exceptions), motif fermé, contrôles, vers la double validation : `ApolloSettingsScreen.tsx:77-268`.
- Santé : admin seul, refus tracé, quatre sections indépendantes, relecture toutes les 60 s onglet visible, filtres et détail des erreurs, trafic avec courbes, processus et base : `HealthScreen.tsx:26-91`, `HealthStatus.tsx:353-374`, `HealthErrors.tsx:282-417`, `HealthTraffic.tsx:249-302`, `HealthProcesses.tsx:138-187`.

API appelée : `GET|POST /v1/bo/member-invitations`, `POST …/:id/revoke` ; `GET /v1/bo/internal-accounts`, `GET|POST /v1/bo/internal-invitations`, `POST …/:id/revoke` ; `GET /v1/bo/settings/apollo`, `POST /v1/bo/dual-control` ; `GET /v1/bo/ops/status`, `/ops/errors`, `/ops/errors/:id`, `/ops/traffic`, `/ops/processes`.

## 2. Structure
Cadre C57. Zone C01, écart 24 px. Rail : Comptes (Inscrits, Invitations) ; Administration (Comptes internes, Réglages Apollo, Santé technique ; Réglages de recherche et Sources de registre manquent, §10).

- `lhead` : fil, ligne titre à gauche et action à droite (bouton 28 px, 196 px pour « Inviter une personne » à 1440), phrase `text-sm` secondaire. Hauteur 91,6 px, 113 px si la phrase tient sur deux lignes.
- E21.4 : formulaire `inner` (C05, 832 px au plus, `surface-raised`, `padding: spacing-4`) ou bloc lien, puis « Invitations récentes » et tableau 1 104 px (292, 182, 172, 172, 155, reste), lignes 36 px, en-tête 30,2 ; phrase `text-xs`.
- E21.5 : notice warning 69,4 px, tableau 1 104 px (933 px défilant à 768), ligne de secours sur fond warning à 50 %, panneau `desactiver` C05 832 px.
- E21.6 : notice info, sections `sec2` de 960 px au plus (60 rem), filet haut, `padding-top: spacing-5` : Périmètre (139,5 px), Pays exclus (180 px), Base légale (113 px). Replis `chg` : résumé 44 px, chevron tourné de 90°.
- E21.7 : `lhead` avec heure et bouton, sections `sec2` 960 px : Disponibilité, Worker et tâches, Groupes d'erreurs.
- 1280 : mêmes zones, 953,6 px ; 768 : tableaux défilants dans leur région (686, 933, 603 px), première colonne collante, page sans débordement ; 375 : C67 seul (le prototype déborde).

## 3. Éléments et matrice
| ID | Section | Composant (C..) | Contenu, apparence, dimensions | Visibilité / condition | Maquette (état, sélecteur) | Critère | Test |
|---|---|---|---|---|---|---|---|
| E21.4-S01 | En-tête | C02 | Fil Comptes, « Invitations » ; `h1` ; phrase et lien vers Comptes internes (admin) | Toujours | invitations, `.lhead` | E21.4-CA01 | E21.4-T01 |
| E21.4-S02 | En-tête | C10 | « Inviter un membre », primaire, icône plus, `aria-expanded` | Toujours | invitations, `#inv-open` | E21.4-CA02 | E21.4-T01 |
| E21.4-S03 | Formulaire | C05 | Titre « Nouvelle invitation de membre », Adresse (grandit), Rôle proposé, Langue de la page, aide | Ouvert par S02 | invitations, `#inv-form` | E21.4-CA02 | E21.4-T01 |
| E21.4-S04 | Formulaire | C19 | Erreur de format, focus, `aria-invalid` ; message de conflit « a déjà un compte ou une invitation » conservé | Contrôle ou 409 | invitations, `#iv-err` | E21.4-CA02 | E21.4-T01 |
| E21.4-S05 | Formulaire | C10 | « Créer l'invitation » primaire, « Annuler » texte | Formulaire | invitations, `.actions` | E21.4-CA02 | E21.4-T01 |
| E21.4-S06 | Lien | C52 | Titre « Invitation créée pour {adresse} », phrase, code du lien, « Copier » 36 px, « Copié » et annonce | Après création, une fois | invitation-creee, `.linkbox` | E21.4-CA03 | E21.4-T01 |
| E21.4-S07 | Lien | C17 | Cadenas, « Lien affiché une seule fois… Expire le {date} à {heure}. » | Avec S06 | invitation-creee, `p.xs` | E21.4-CA03 | E21.4-T01 |
| E21.4-S08 | Liste | C58 | Adresse (masquée dans la maquette), Rôle proposé, Créée le, Expire le, État, action ; nouvelle ligne en tête | Invitations (200 au plus) | invitations, `#inv-rows` | E21.4-CA04 | E21.4-T01 |
| E21.4-S09 | Liste | C13 | États : utilisable ; acceptée (coche succès) ; expirée (tertiaire) ; révoquée non montrée | Selon l'état | invitations, `.ok-t` | E21.4-CA04 | E21.4-T01 |
| E21.4-S10 | Liste | C11 | « Révoquer » (utilisable), « Fiche » (acceptée), « Réinviter » (expirée) ; motif de révocation à garder (E21-Q16) | Selon l'état | invitations, `.link` | E21.4-CA05 | E21.4-T01 |
| E21.4-S11 | Liste | C17 | Phrase sur les adresses masquées ; vide, erreur, chargement non montrés | Avec liste | invitations, `p.xs` | E21.4-CA04 | E21.4-T01 |
| E21.5-S01 | En-tête | C02 | Fil Administration, `h1`, « Inviter une personne » primaire, phrase | Admin | comptes, `.lhead` | E21.5-CA01 | E21.5-T01 |
| E21.5-S02 | Secours | C17 | Notice warning « Compte de secours. » gras puis règle | Permanente si un compte de secours existe | comptes, `.notice` | E21.5-CA02 | E21.5-T01 |
| E21.5-S03 | Liste | C58 | Personne (prénom gras, « (vous) »), Rôle, Second facteur (coche), Dernière connexion, Responsable de, État, action | Admin ; 200 au plus | comptes, `.tbl` | E21.5-CA01 | E21.5-T01 |
| E21.5-S04 | Liste | C13 | États : actif, absence (drapeau, warning), bris de glace (triangle, ligne teintée), désactivé non montré | Selon le compte | comptes, `.late`, `tr.secours` | E21.5-CA02 | E21.5-T01 |
| E21.5-S05 | Liste | C11 | « Désactiver… » | Autres comptes actifs ; jamais soi ni le secours ; action non servie (E21-Q17) | comptes, `.link` | E21.5-CA03 | E21.5-T03 |
| E21.5-S06 | Désactiver | C05 | Titre focalisable, notice « Désactivation impossible » avec ce qui reste, « Transférer le portefeuille… » secondaire, lien des objets, note | Hors API (E21-Q17) | desactiver, `.inner` | E21.5-CA03 | E21.5-T03 |
| E21.5-S07 | Invitation interne | C05 | Formulaire adresse, rôle, motif ; lien une fois ; « attend la double validation » | Ouvert par S01 ; non montré, préservé (E21-Q18) | non montré | E21.5-CA04 | E21.5-T02 |
| E21.5-S08 | Invitations internes | C58 | Liste : adresse, rôle, dates, état, révocation avec motif, lien de double validation | Non montrée, préservée (E21-Q18) | non montré | E21.5-CA04 | E21.5-T02 |
| E21.6-S01 | En-tête | C02 | Fil Administration, `h1`, phrase | Admin | apollo, `.lhead` | E21.6-CA01 | E21.6-T01 |
| E21.6-S02 | Attente | C17 | Notice info, sablier, demande en attente et lien | Une demande Apollo est ouverte ; non servie par cet écran (E21-Q19) | apollo, `.notice` | E21.6-CA02 | E21.6-T01 |
| E21.6-S03 | Périmètre | C03 | Valeur semi-gras, « modifié le {date} », repli « Changer le périmètre » : choix radio, Motif, « Demander ce changement » | Toujours | apollo, `#h-scope` | E21.6-CA01 | E21.6-T01 |
| E21.6-S04 | Pays exclus | C23 | Étiquettes 32 px « {pays} ({code}) », phrase ; repli : pays, « Ajouter », « Demander ce changement » ; motif et retrait à ajouter (E21-Q20) | Toujours ; vide : « Aucun pays exclu… » | apollo, `#h-ctry` | E21.6-CA03 | E21.6-T01 |
| E21.6-S05 | Base légale | C07 | Par défaut, Exceptions par pays ; formulaire de changement absent (E21-Q20) | Toujours | apollo, `#h-lb` | E21.6-CA03 | E21.6-T01 |
| E21.7-S01 | En-tête | C02 | Fil, `h1`, « Arrêté à {heure} », « Actualiser » secondaire, phrase | Admin | sante, `.lhead` | E21.7-CA01 | E21.7-T01 |
| E21.7-S02 | Disponibilité | C58 | Cible, Dernier relevé (coche et heure), 24 h, 7 j, 30 j ; échec, ancien, sans relevé non montrés, préservés | Quatre cibles servies (E21-Q21) | sante, `#h-av` | E21.7-CA02 | E21.7-T01 |
| E21.7-S03 | Worker | C07 | Worker (état, battement), tâche de badges, alertes ouvertes ; tableaux complets à garder (E21-Q22) | Toujours | sante, `#h-wk` | E21.7-CA02 | E21.7-T01 |
| E21.7-S04 | Erreurs | C58 | Erreur, Route (code), État, Occurrences, Dernière ; filtres, source, détail, versions à garder (E21-Q22) | Groupes | sante, `#h-err` | E21.7-CA03 | E21.7-T01 |
| E21.7-S05 | Trafic, processus | C58 | Tableaux, courbes, période, tri, base | Non montrés, préservés (E21-Q22) | non montré | E21.7-CA03 | E21.7-T01 |

## 4. Textes
Backoffice en français seul : `messages/fr.ts` (D36 ouverte) ; EN vaut « D36 ». Apostrophe typographique conservée.

| Élément | FR exact | EN | Clé existante (locales/fr/…json) ou « nouvelle » |
|---|---|---|---|
| E21.4-S01 | Invitations · Une invitation nominative crée un lien d'inscription : vous serez le commercial responsable du compte créé. Pour inviter une personne dans l'équipe, voyez Comptes internes. | D36 | remplace `invitations.memberTitle`, `memberLead` |
| E21.4-S02, S03 | Inviter un membre · Nouvelle invitation de membre · Adresse e-mail · Rôle proposé · Marque · Créateur · Langue de la page · La personne choisit son rôle à l'inscription ; le rôle proposé ne fait que pré-remplir la page. | D36 | `invitations.email`, `proposedRole`, `language`, reste nouveau |
| E21.4-S04 | Cette adresse n'a pas un format valide (exemple : nom@exemple.com). | D36 | `invitations.emailInvalid` différent |
| E21.4-S05 | Créer l'invitation · Annuler | D36 | `invitations.create`, `common.cancel` |
| E21.4-S06, S07 | Invitation créée pour {adresse} · INFLUX n'envoie pas encore l'e-mail d'invitation : copiez le lien et transmettez-le vous-même. · Copier · Copié · Lien copié. · Lien affiché une seule fois. Il n'est conservé nulle part en clair : copiez-le maintenant. Expire le {date} à {heure}. | D36 | `invitations.linkOnce`, `memberLead`, `common.copied` |
| E21.4-S08, S09 | Invitations récentes · Adresse · Créée le · Expire le · État · utilisable · acceptée · expirée · Révoquer · Fiche · Réinviter | D36 | `invitations.columns`, `memberStates` (« utilisée : compte créé ») |
| E21.4-S11 | Les adresses sont masquées dans la liste ; elles se lisent en entier sur la fiche du compte, une fois l'invitation acceptée. | D36 | nouvelle (contredit l'adresse servie, E21-Q15) |
| E21.5-S01 | Comptes internes · Inviter une personne · Un compte interne, une personne nommée : aucun compte partagé, jamais. Il n'existe aucune inscription : un compte se crée par invitation, et une invitation d'administrateur passe par la double validation. | D36 | `internalAccounts.namedPerson`, `byInvitation`, `invitations.internalTitle` |
| E21.5-S02 | Compte de secours. Adresse distincte, second facteur hors ligne, codes de secours imprimés et scellés. Toute connexion alerte immédiatement le fondateur et exige une justification écrite sous 24 heures. Il n'est jamais utilisé pour le travail quotidien. | D36 | `internalAccounts.breakGlass` (« TOTP » devient « second facteur ») |
| E21.5-S03, S04 | Personne · Rôle · Second facteur · Dernière connexion · Responsable de · État · (vous) · actif · aujourd'hui · {heure} · jamais · {n} comptes · {n} campagnes · absence jusqu'au {date} · bris de glace | D36 | `internalAccounts.columns` ; dernière connexion et campagnes nouvelles |
| E21.5-S05, S06 | Désactiver… · Désactiver le compte de {nom} · Désactivation impossible : cette personne est encore responsable de {n} comptes et {n} campagnes. Réattribuez-les d'abord. · Transférer le portefeuille vers un autre agent · Voir le détail des {n} objets · Le transfert est une action de masse (200 au plus), sous double validation, avec un aperçu chiffré. Il se défait par une nouvelle réattribution. | D36 | nouvelle ; hors API |
| E21.6-S01, S02 | Réglages Apollo · Chaque changement passe par une double validation, sur un écran distinct. Un changement réévalue les inscrits écartés. · Un changement attend sa seconde validation : {objet}. · Ouvrir la double validation | D36 | `apollo.title`, `lead` ; notice nouvelle |
| E21.6-S03 | Périmètre · Marques seulement · Marques et créateurs professionnels · Tous les inscrits · modifié le {date} · Changer le périmètre · Motif · Décision du fondateur · Validation juridique · Restriction juridique · Erreur de configuration · Demander ce changement | D36 | `apollo.scopes`, `reasons`, `change`, `updated` |
| E21.6-S04 | Pays exclus de la prospection · Tous les pays sont prospectés sauf ceux de la liste. · Ajouter ou retirer un pays · Choisir un pays… · Ajouter | D36 | `apollo.countries`, reste nouveau |
| E21.6-S05 | Base légale · Par défaut · Consentement requis · Exceptions par pays · Aucune exception. | D36 | `apollo.legalBasis*`, `byCountryNone` |
| E21.7-S01 | Santé technique · Arrêté à {heure} · Actualiser · Lecture seule, administrateurs seulement. Aucune personne n'apparaît ici. | D36 | `health.title`, `refresh`, `refreshedAt`, `lead` à raccourcir |
| E21.7-S02 | Disponibilité · Cible · Dernier relevé · 24 h · 7 j · 30 j · API · Espace membres · Backoffice · répond · {heure} | D36 | `health.availability.*` ; noms de cibles différents |
| E21.7-S03 | Worker et tâches périodiques · Worker · actif · dernier battement il y a {durée} · Cycle des badges · passé {date} à {heure} · Alertes techniques ouvertes · {n} · erreur nouvelle sur une route | D36 | `health.worker.*`, `alerts.*` |
| E21.7-S04 | Groupes d'erreurs · Erreur · Route · État · Occurrences · Dernière · nouvelle · {message} | D36 | `health.errors.*` |

## 5. Interactions, états, responsive, clavier
- E21.4 : S02 ouvre et place le focus sur l'adresse, ferme et rend le focus ; erreur à la soumission, effacée à la saisie ; création : appel, S06 remplace le formulaire, focus sur le titre, annonce, liste relue. « Copier » : presse-papiers, « Copié », annonce ; refus du presse-papiers : message. « Révoquer » ouvre le motif (préservé) puis confirme. « Réinviter » : non servi (E21-Q16), ouvre S03 prérempli.
- E21.5 : S01 ouvre S07. S05, S06 : sans API, non rendus tant que E21-Q17 n'est pas tranché. Absence lue seulement.
- E21.6 : replis ; « Demander ce changement » contrôle (motif, code inconnu) puis `POST /v1/bo/dual-control` et mène à E21.3. Le formulaire garde la valeur en force préremplie ; l'état « en attente » est relu depuis la double validation.
- E21.7 : « Actualiser » relit tout, heure mise à jour ; relecture automatique à 60 s onglet visible, non annoncée ; section en échec seule avec « Réessayer ».
- États : chargement, vide, erreur, refus non montrés : préservés (`MemberInvitationsScreen.tsx:186-194`, `InternalAccountsScreen.tsx:245-250`, `ApolloSettingsScreen.tsx:301-306`, `HealthScreen.tsx:29-40`, `LoadGate`). Agent sur une page d'admin : refus, tentative journalisée (CA63). Hors ligne : phrase commune.
- Responsive : §2 ; tableau interne défilant avec région focalisable (`DenseTableRegion` ; axe signale `#h-av` et `#h-err` à 375).
- Clavier et focus : `details` natifs ; ordre DOM ; chevron `rotate` `duration-base` ; entrée `is-entering` du formulaire ; aucune en mouvement réduit.

## 6. Critères d'acceptation
- **E21.4-CA01** Un agent ne voit que ses invitations, un admin toutes ; le lien « Comptes internes » n'est rendu qu'à l'admin.
- **E21.4-CA02** Le formulaire s'ouvre dans la page ; une adresse mal formée n'envoie rien ; un conflit est dit sans révéler le type de compte.
- **E21.4-CA03** Le lien n'est montré qu'une fois, jamais rechargé ; « Copier » annonce le résultat.
- **E21.4-CA04** Chaque invitation a un état en mots ; vide, chargement et erreur ont leur phrase.
- **E21.4-CA05** La révocation exige un motif fermé et n'est offerte qu'à une invitation utilisable.
- **E21.5-CA01** Une ligne par personne nommée, second facteur et état en mots ; aucun compte n'est créé par cet écran hors invitation.
- **E21.5-CA02** L'encadré de secours est permanent, la ligne visible et repérable sans la couleur seule.
- **E21.5-CA03** Aucun bouton « Désactiver » sans action serveur ; le refus nomme ce qui reste.
- **E21.5-CA04** Invitation interne, sa liste et sa révocation restent possibles ; une invitation d'admin reste inutilisable jusqu'à sa double validation.
- **E21.6-CA01** Aucun réglage ne change depuis cet écran : chaque changement devient une demande.
- **E21.6-CA02** La notice d'attente n'apparaît que si une demande est réellement ouverte et mène à elle.
- **E21.6-CA03** Pays, base légale et exceptions restent modifiables avec motif ; une liste vide dit qu'elle n'exclut aucun pays.
- **E21.7-CA01** Admin seul, lecture seule ; heure de lecture affichée ; aucune donnée personnelle.
- **E21.7-CA02** Un état est un mot et un symbole ; sans relevé, l'état est « inconnu », jamais zéro.
- **E21.7-CA03** Toutes les sections actuelles (alertes, worker, tâches, erreurs et détail, trafic, processus, base) restent atteignables.
- **E21.7-CA04** axe sans violation sur les quatre écrans à 768, 1 024, 1 280, 1 440 ; C67 sous 768 px.

## 7. Tests
| ID | Niveau (unitaire, e2e, visuel, a11y) | Fichier (existant à adapter / nouveau) | Ce qu'il prouve |
|---|---|---|---|
| E21.4-T01 | e2e, a11y | `backoffice-ops-screens.spec.ts:83-108` (titre `memberTitle`), `backoffice.spec.ts:517-560` | Formulaire, lien, liste, axe |
| E21.5-T01 | e2e | `backoffice.spec.ts:457-560` | Liste, secours, refus agent |
| E21.5-T02 | e2e | `backoffice.spec.ts:520-560` (invitation interne) | Invitation, révocation, double validation |
| E21.5-T03 | e2e | nouveau, si E21-Q17 tranché | Désactivation refusée |
| E21.6-T01 | e2e | `backoffice.spec.ts:457-515` (`form` `apollo.countries`, `apollo.change`) | Demandes, valeur en force |
| E21.7-T01 | e2e, unitaire | `backoffice.spec.ts:598-620`, `health-errors-ui.test.ts`, `ops-view-model.test.ts` | Sections, états, détail |
| E21.7-T02 | visuel | nouveau, captures 768, 1 280, 1 440 des six états | Fidélité |

## 8. Écart avec l'existant
| Élément | Aujourd'hui (fichier:ligne) | Cible | Nature (réutiliser / faire évoluer / créer / supprimer) |
|---|---|---|---|
| Formulaire d'invitation toujours ouvert | `MemberInvitationsScreen.tsx:110-181` | repli S03 | faire évoluer |
| Révocation en ligne | `InvitationParts.tsx:65-117` | lien puis motif | faire évoluer |
| Comptes internes, dernière connexion absente | `InternalAccountsScreen.tsx:253-294`, `messages/fr.ts` `lastSignInLater` | S03 | faire évoluer |
| Apollo, trois formulaires ouverts | `ApolloSettingsScreen.tsx:169-268` | sections repliées | faire évoluer |
| Santé, six sections | `HealthScreen.tsx:61-85` | trois sections de la maquette, les autres conservées | faire évoluer |

Données requises :
| Donnée affichée par la maquette | Servie aujourd'hui ? (route API, fichier:ligne) | Écart |
|---|---|---|
| Adresse masquée | Non, adresse entière (`memberInvitationsResponseSchema`) | masquage à l'écran ou à l'API |
| Réinviter, lien vers la fiche | `accountId` servi ; aucune réinvitation | fiche : oui ; réinviter : nouvelle création |
| Dernière connexion d'un compte interne | Non (une session n'est lisible que de son titulaire) | à servir ou retirer |
| Campagnes et autres responsabilités | `ownedAccounts` seul | à servir ou retirer |
| Désactivation, transfert | Aucune route | hors API |
| Réglages Apollo, dates | Oui, `/v1/bo/settings/apollo` | aucun |
| Demande Apollo en attente | Oui, via `GET /v1/bo/dual-control` | à joindre à l'écran |
| Sondes, worker, tâches, alertes, erreurs | Oui, `/v1/bo/ops/*` | libellés à conserver (quatre cibles) |
| Cible « API », « Espace membres » | Cibles servies : accueil FR, accueil EN, connexion backoffice, API | noms à décider |

Hors lot (Lot 4 ou 5) : réattribution, transfert de portefeuille (`15` RG60, RG61, M5), absence déclarée par l'écran.

## 9. Contradictions, manques et décisions
Transverses : X8, X11, X13.

| ID | Constat (maquette / code / spec, références exactes) | Effet sur le développement | Proposition | Arbitre | Bloquant ? |
|---|---|---|---|---|---|
| E21-Q15 | Adresse masquée dans la liste ; l'API sert l'adresse entière ; l'agent qui invite doit reconnaître son invitation | Masquer l'adresse tout en la servant est un faux masquage | Masquer à l'API pour l'admin, entière pour l'auteur ; ou retirer la phrase S11 | expert-conformite-rgpd | oui |
| E21-Q16 | Révocation en un clic, « Réinviter » sans règle ; l'API exige un motif et ne réinvite pas | Geste impossible à l'identique | Motif dans un petit repli ; « Réinviter » préremplit S03 | product-owner | non |
| E21-Q17 | Désactivation, transfert de portefeuille, détail des objets : aucune route ; `15` RG60 les vise | Écran « desactiver » irréalisable | Ne pas rendre S05 et S06 au Lot 3bis ; spécifier au Lot 5 | product-owner | oui |
| E21-Q18 | Invitation interne (rôle, motif, lien, liste, révocation) sans maquette ; le bouton « Inviter une personne » n'ouvre rien | Perte de fonction critique | Formulaire et liste au gabarit de E21.4 | expert-ux | oui |
| E21-Q19 | Notice d'attente : objet et lien ; l'écran Apollo ne lit pas la double validation | Appel supplémentaire | Lire `GET /v1/bo/dual-control`, filtrer `leads.change_apollo_setting` | architecte | non |
| E21-Q20 | Maquette : ni retrait de pays, ni motif dans « Ajouter ou retirer un pays », ni formulaire de base légale et exceptions | Perte de fonction (`05` RG83, RG84) | Croix sur l'étiquette, motif dans chaque repli, 3e repli base légale | product-owner | oui |
| E21-Q21 | Trois cibles « API, Espace membres, Backoffice » ; quatre servies (`OPS_PROBE_TARGETS`), durée et nombre d'échecs en plus | Écran réduit | Quatre lignes, libellés existants, colonne Durée gardée | architecte | non |
| E21-Q22 | Maquette : 3 sections ; code : alertes en détail, tâches, erreurs filtrées et détaillées, trafic, processus et base (`17b` §3.15 les exige) | Perte de fonction | Garder toutes les sections, forme `sec2` et C58 | product-owner | oui |
| E21-Q23 | « Aucune personne n'apparaît ici » : le détail d'une erreur porte un compte (`health.errors.columns` « Compte ») | Phrase fausse | Reformuler « aucune donnée personnelle affichée hors identifiant de compte » ou retirer le compte | expert-conformite-rgpd | oui |
| E21-Q24 | Rail Administration sans Double validation (déplacée, E21-Q01), Réglages de recherche, Sources de registre | Entrées perdues | Garder les deux entrées manquantes | product-owner | oui |
| E21-Q25 | Rôles en code (`agent`, `admin`) dans le tableau ; `messages.roles` les nomme | Vocabulaire | Mots de `messages.roles` | expert-ux | non |
| E21-Q26 | Encadré de secours : « second facteur hors ligne » contre « TOTP hors ligne » (`fr.ts` `internalAccounts.breakGlass`, `17b` §3.13.b) | Mineur | Texte de la maquette | expert-cybersecurite | non |

## 10. Écrans du périmètre sans maquette
| Écran existant | Route et composants (fichier) | Constat | Représentation proposée |
|---|---|---|---|
| Réglages de la recherche | `/reglages/recherche`, `SearchSettingsScreen.tsx` (577 lignes), `search-settings-view.ts` | Ouverture, masse critique et courbes, seuils, k, alertes, facettes ; chaque changement en double validation, 409 `no_peer_admin` | Gabarit E21.6 : `sec2`, replis, motif, notice d'attente (annoncé par `ecran-21`) |
| Sources de registre | `/reglages/sources-registre`, `RegistrySourcesScreen.tsx`, `RegistrySourceEditor.tsx`, `RegistrySourceAdder.tsx` | Listes active et à confirmer, ajout, édition ; lecture agent, écriture admin | Tableau C58 et formulaire C05 au gabarit E21.4 |
| Invitations internes | dans `/comptes-internes` | E21-Q18 | Gabarit E21.4 |
| Double validation : demandes de rôle, invitation d'admin, demande « mes données », réglages de recherche, facette | `/double-validation/[id]`, `ActionTarget` | La maquette ne montre que badge et Apollo | Gabarit E21.3, propriétés par action (E21-Q06) |
| Confirmation d'identité (mot de passe et code) | `ActionFeedback.tsx` | Formulaire d'un geste, sans maquette, U41 | E21-Q07 ; hors E21.3 : panneau C05 sous le geste |
| Retrait de badge et lancement de vérification | fiche de compte | E06-Q09 | E06a |
| Revue hebdomadaire des confirmations différées | `/accueil`, `HomeScreen.tsx` | Dans le périmètre de E04 | Vérifier dans E04 |
| Vérification, contestations, identifiants modifiés, visuels, sélections d'équipe : listes et décisions | `/files/*` | 07 dit « les huit autres files prennent le même gabarit » ; périmètre de E05, E16 | E05, E16 |
| Connexion, activation du second facteur, codes de secours | `/`, `/activation`, `LoginForm.tsx`, `Activation.tsx` (`17b` §3.14) | Aucune maquette (E11 vise les membres) | Garder l'existant, jetons KEO |
| Coquille backoffice : bande, rail, écran de poste de travail, erreurs | `Shell.tsx`, `(app)/layout.tsx` | Maquette partielle (C57, C67) | E04, E19 |
