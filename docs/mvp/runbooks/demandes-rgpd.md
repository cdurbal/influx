# Demandes « mes données » : procédure de l'administrateur (J7, EC-14 ; outil du J8)

> **Public :** l'administrateur INFLUX (`admin`) qui instruit et exécute une demande, et le
> fondateur. **Statut :** procédure du MVP. Contenu de l'export, délai et clôture **validés avec
> corrections par `expert-conformite-rgpd` le 2026-10-14** (intégrées ici, bloquantes à
> l'homologation du Lot 6) ; remise de l'export **tranchée par `expert-cybersecurite` le 2026-10-14**
> (§4) ; outil d'exécution livré au J8, commit 8 (`chef-de-projet`, §1). **La notice et les modèles de
> réponse sont à valider par un juriste avant la première demande réelle** (§8). Références : `05` RG57,
> `15` RG72 à RG81 (file 14), `17` §6.3, `04` §5.10 et §9.2, décision 6 du J7 (`git show 5b977f7:docs/mvp/jalons/j7-fiche.md`),
> migrations `0120`, `0127`, `0128`, `0136`, `0137`.
> **Règle d'or :** rien n'est exécuté sans un `admin`. Le membre **dépose** une demande ; un
> `admin` l'**instruit** puis **approuve son exécution** sous double validation (2V) et
> ré-authentification (R), depuis la fiche du compte ; le worker l'exécute (E-5). Une demande
> traitée hors de cette procédure n'existe pas (`15` RG72).

## 1. Ce que fait le produit depuis le J8, et ce qu'il ne fait pas

| Le produit fait | Le produit ne fait pas encore |
|---|---|
| Dépôt depuis l'espace membre : **export** (`access`) ou **suppression** (`erasure`), chacun après un **code frais** de sa finalité (`data_export`, `account_deletion`) | Les autres types (rectification, opposition, limitation, portabilité seule) et les demandes reçues par e-mail ou à l'oral (`0502`, Lot 5) |
| Une ligne dans `backoffice.data_subject_requests` : `received_at`, `due_at` = la plus proche de réception + **30 jours** et réception + **un mois** (UTC, `0127`), figé | L'écran de la file 14 (Lot 5) ; la clôture à la main d'une issue autre que `satisfaite` (refus, sans objet : `0502`) |
| L'accusé de réception `privacy.request_received` (P1, par la file), **écrit par INFLUX** (`16` RG160, `0128`), sans lien | La suppression chez Apollo (Lot 5) : une demande dont Apollo a reçu le contact reste ouverte (§5) |
| **Approbation** de l'exécution par un `admin`, 2V + R, depuis la fiche du compte (`POST /v1/bo/dual-control`, action `privacy.approve_data_request`, motif `request_instructed` ; `0137`) | Les tables des Lots 2 à 4 (profils, messagerie, affaires) |
| **Exécution** par le worker, sur son pool `PRIVACY_DATABASE_URL` (E-5) : export produit par la base ou anonymisation, `account.deleted` vers Brevo (suppression du contact) et Apollo (noté `skipped`), utilisateur Supabase Auth supprimé | L'écran de la fiche (commit 9 du J8) : d'ici là, par l'API |
| **Clôture** automatique `satisfaite`, `completed_at`, après confirmation de Brevo (`15` RG79) ; registre `privacy.*` à chaque étape | |

**Conséquence :** **aucune écriture en base ne se fait jamais à la main** (ni `UPDATE`, ni `DELETE`,
ni script ad hoc). L'outil conditionne l'ouverture de la production (arbitrage `chef-de-projet`
2026-10-14, `21` §5.8) : le worker de production refuse de démarrer sans `PRIVACY_DATABASE_URL`.
Une demande d'un type que l'outil ne couvre pas s'instruit (étapes 1 à 5) et **s'escalade aussitôt au
fondateur**, qui fait trancher l'exécution par `architecte` et `expert-conformite-rgpd` avant
l'échéance `due_at`.

## 2. Trouver les demandes ouvertes

Lecture seule, rôle `admin` en `aal2` (politique `data_subject_requests_internal_select`, `0120`) ;
jusqu'à l'écran du Lot 5, par une requête de lecture lancée par le fondateur :

```sql
select id, request_type, requester_account_id, received_at, due_at, status
  from backoffice.data_subject_requests
 where status <> 'closed'
 order by due_at;
```

Objectif interne : **10 jours ouvrés**. Limite légale : **un mois calendaire** après la réception
(art. 12(3)), prorogeable de deux mois si la demande est complexe ou si les demandes sont
nombreuses ; la personne est informée de la prorogation et de ses motifs **avant la fin du premier
mois**. `due_at` (`15` RG73, `0127`) ne dépasse jamais ce mois. À J-7 de `due_at`, la demande passe
en tête de toute autre tâche.

## 3. Instruire (`15` RG75, étapes 1 à 5)

1. **Qualifier.** Le type vient du dépôt (`access` ou `erasure`). Une demande ambiguë se clarifie
   auprès du membre, jamais par supposition.
2. **Identité.** Déjà établie : le dépôt exige un code frais envoyé à l'adresse du compte (`05` RG57,
   `15` RG74). Noter « code frais, espace membre » et la date de `received_at`. **Ne jamais**
   répondre à une autre adresse que celle du compte.
3. **Périmètre.** Écrire la liste des catégories détenues (§4) et, pour chaque exclusion, son
   fondement (`15` RG80, RG81).
4. **Affaire en cours.** Aucune avant le Lot 4 ; ensuite, prévenir le commercial responsable avant
   d'exécuter.
5. **Réponse.** Rédiger en langage clair, dans la langue du compte (`preferred_language`), sans les
   mots « preuve légale », « valeur probante », « horodatage certifié » (`17` §6.3).

## 4. Exécuter un export (`access`)

Données détenues au Lot 1, **du seul demandeur** (jamais celles d'un tiers, `15` RG81) ; liste
complétée par `expert-conformite-rgpd` le 2026-10-14 (un accès incomplet manque à l'art. 15) :

| Catégorie | Source |
|---|---|
| Compte | `identity.accounts`, `identity.account_roles` : rôle, adresse, vérification et état de délivrabilité de l'adresse, pays, langue, fuseau, nom affiché, statut du compte, attestation 18+ et sa date, statut déclaré, source d'acquisition déclarée, dates de création et de dernière activité, commercial référent (prénom) |
| Profil de marque | `profiles.advertiser_profiles` : raison sociale (annonceur seulement) |
| Profil créateur | `profiles.creator_*` (L2D, `0219`) : vitrine saisie et dérivée, listes, identité (couche N), lignes de réseau avec chiffres exacts, tranches et audience détaillée, secteurs refusés, historique des chiffres (un agent apparaît comme « INFLUX ») ; jamais `public_ref` ni l'identifiant d'une ligne. À l'effacement : vitrine gardée (alias, pays) `suspended`, le reste vidé ou supprimé |
| Consentements | `identity.consent_events` : finalité, accordé ou retiré, date, origine, éléments de preuve (`evidence`) |
| Conditions acceptées | `identity.terms_acceptances` : version, date, nature, canal, langue, **adresse IP et navigateur enregistrés** |
| Sessions | `identity.sessions` : création, dernière activité, navigateur (« famille sur système ») ; **jamais** l'empreinte du jeton |
| E-mails transactionnels | `leads.transactional_sends` : code de l'e-mail, date, langue, statut (jamais le contenu d'un code) |
| Changements d'adresse | `identity.email_change_requests` : anciennes et nouvelles adresses, dates (jamais les empreintes de codes) |
| Incidents de délivrance | `identity.email_delivery_incidents` : type, date, adresse concernée |
| Signalements de secours | `backoffice.code_delivery_reports` dont `login_email` ou `contact_email` est une adresse, actuelle ou ancienne, du compte : adresses, message, date, statut |
| Événements reçus de Brevo | `leads.brevo_inbound_outcomes` du compte (désinscription, plainte, rebond), dans la fenêtre de 30 jours |
| Journal d'activité | `audit.audit_events` dont le compte est l'acteur ou le sujet : code et date ; un agent apparaît comme « INFLUX » ; aucun hachage de chaîne |
| Rapports d'erreur | `ops.error_occurrences` du compte : date, page, message, navigateur résumé |
| Demandes « mes données » | `backoffice.data_subject_requests` du demandeur |
| Destinataires | `leads.contact_sync_states` (Brevo, Apollo) : identifiant externe, dernier état, désinscription. Brevo : attributs (`16` §M4), listes, liste noire, envois et événements rattachés au contact. Apollo : « aucune donnée transmise » tant que le connecteur est `skipped` |
| Authentification | Supabase Auth (`auth.users`) : adresse, dates de création et de dernière connexion ; journal d'audit GoTrue (adresses IP) s'il est actif, **à vérifier par `expert-database`** |

**Exclusions** : empreintes de jetons, de codes et de débit (`auth_request_throttle`), hachages du
registre, données de tiers (RG81). Leur existence est décrite dans la notice, sans restituer les
valeurs ; cette exclusion ne fait pas passer l'issue en `satisfaite_partiellement`.

**Informations jointes à l'export** (art. 15(1) a-h et 15(2)) : chaque export est accompagné d'une
notice dans la langue du compte (FR ou EN). Elle indique : les finalités et la base légale de chaque
catégorie ; les destinataires (Brevo, Supabase, Railway, Apollo.io avec la mention « non alimenté à
ce jour » ; aucun prestataire de paiement au MVP) ; les transferts hors du Royaume-Uni et de l'UE avec
leurs garanties (adéquation UE↔RU, puis DPF et extension RU, CCT ou IDTA selon le prestataire) ; la
durée de conservation de chaque catégorie (`04` §9.1) ; la source des données (vous-même ; Brevo pour
les désinscriptions et les rebonds) ; vos droits (rectification, effacement, limitation, opposition,
portabilité, retrait du consentement) et la manière de les exercer ; le droit de réclamation auprès
de l'ICO ou de l'autorité de votre pays de résidence dans l'UE, avec les coordonnées du représentant
UE (art. 27) ; l'absence de toute décision exclusivement automatisée (art. 22 : pas de matching au
MVP, D11 ; le signal « nouveau navigateur » est une alerte sans effet sur le compte). Format : JSON
UTF-8 avec des clés documentées (portabilité), plus un récapitulatif lisible ; dates en ISO 8601 UTC,
rappelées dans le fuseau du compte. Gratuit.

**Production et remise (`expert-cybersecurite`, 2026-10-14) : téléchargement dans l'espace membre, et
rien d'autre.** Le fichier est produit depuis la base par l'outil E-5 du J8, jamais assemblé à la
main. L'`admin` (aal2) approuve l'exécution sous 2V + R depuis la fiche du compte ; le worker
produit l'export (E-5, avec la notice dans la langue du compte) ; il est conservé en base dans
`privacy.data_exports`, sans droit pour aucun rôle membre, lu par une fonction `SECURITY DEFINER` qui
vérifie que le compte de la session est le demandeur. Le membre le télécharge par `apps/api`
(`POST /v1/me/data-export/:id/download` : `no-store`, `nosniff`, `Content-Disposition: attachment` ;
le relais de `web` ne transmet pas ce dernier en-tête, le fichier voyage donc comme texte exact dans
une enveloppe JSON et le navigateur l'enregistre tel quel, EC-J8 du commit 8), après un **code frais
`data_export` consommé à chaque téléchargement** ; **3 téléchargements au plus, pendant 7 jours au plus** (écart à `16` RG95 « lien à
usage unique », pour tolérer un téléchargement interrompu). À la première échéance, E-4 efface le
contenu et garde l'empreinte (tâche horaire `data_export_purge`). Un e-mail P1 (`privacy.export_ready`), à la seule adresse du compte,
annonce « export disponible dans Mon compte › Mes données jusqu'au … » : aucune pièce jointe, aucun
lien vers le fichier, aucun jeton. Le registre trace l'approbation (`admin`, 2V, `privacy.execution_approved`),
la publication (demande, empreinte SHA-256, taille, catégories : `privacy.export_published`) et chaque téléchargement (compte, demande, session), jamais le contenu.
Pas de chiffrement applicatif au MVP (copie de données déjà présentes dans la même base, effacée sous
7 jours). La demande est close `satisfaite` dès que Brevo a confirmé l'envoi de `privacy.export_ready`
(son `messageId` est gardé, `15` RG85), téléchargé ou non : à valider par `expert-conformite-rgpd`.

## 5. Exécuter une suppression (`erasure`)

Ce qui disparaît et ce qui survit est fixé par `17` §6.3 et `15` RG80 ; la réponse au membre le dit
**explicitement**, sans le cacher dans un lien.

1. Vérifier qu'aucune mise en relation n'est ouverte (aucune avant le Lot 4 ; ensuite, prévenir le
   commercial responsable et l'autre partie par le message système prévu).
2. **Approuver l'exécution** depuis la fiche du compte (2V + R) ; le worker exécute
   `privacy.execute_request` (E-5 restreinte au Lot 1) : anonymisation, jamais suppression physique
   (le registre l'interdit, `15` RG80) ; sessions supprimées (`04` §9.1) ; utilisateur Supabase Auth
   supprimé après coup (une erreur se rejoue à la minute suivante).
3. **Propagation (`15` RG79)** : `account.deleted` (P0) supprime le contact Brevo (par son
   identifiant, sinon par l'adresse, gardée par la demande jusqu'à la clôture seulement) ; Apollo
   n'est pas alimenté au Lot 1 : la ligne est `skipped` (`erasure_not_propagated`) et la clôture
   vérifie qu'Apollo n'a jamais reçu le contact. **La demande n'est pas close** tant que Brevo n'a
   pas confirmé ; si Apollo avait reçu le contact, elle reste ouverte et s'escalade au fondateur.
4. Une nouvelle inscription avec la même adresse crée un compte **entièrement nouveau** (`05` RG70).
5. **La réponse énonce ce qui survit au Lot 1** (`expert-conformite-rgpd`, 2026-10-14) : preuves
   d'acceptation des CGU et du consentement, y compris l'adresse IP (5 ans, défense des droits) ;
   registre d'audit (pseudonyme, sans purge) ; la demande elle-même (preuve de traitement) ; journal
   transactionnel (13 mois) ; e-mails déjà envoyés ; sauvegardes, écrasées au bout de N jours (durée à
   fixer avec Supabase).
6. **E-5 anonymise aussi** les adresses en clair de `identity.email_delivery_incidents`,
   `identity.email_change_requests`, `backoffice.code_delivery_reports` (et leur message),
   `leads.brevo_inbound_events`, `leads.transactional_sends` et `backoffice.member_invitations`,
   absentes de `04` §9.2 (`0137`, EC-J8-39, EC-J8-40) ; la raison sociale devient `[deleted]`.
7. **Adresse réutilisée par un autre compte** (revue `expert-cybersecurite` du commit 8, F1) : une
   ancienne adresse du demandeur devenue celle d'un autre compte n'est ni exportée ni anonymisée par
   l'outil (les lignes rattachées à un autre compte ne sont jamais touchées). L'`admin` vérifie ces
   lignes à la main avant de répondre ; ce qu'on en restitue relève d'`expert-conformite-rgpd`.

## 6. Clore (`15` RG75 étape 7, RG77)

Issue choisie dans la liste fermée : `satisfaite`, `satisfaite_partiellement` (avec ce qui n'est pas
satisfait et son fondement), `refusee` (motif de `15` RG78 et voies de recours), `sans_objet`,
`retiree_par_le_demandeur`. Tout refus et toute issue `satisfaite_partiellement` mentionnent la
réclamation possible auprès de l'ICO ou de l'autorité de contrôle de l'UE, et le recours
juridictionnel (art. 12(4)). Envoyer la réponse à l'adresse du compte, noter la date d'envoi et
l'identifiant du message chez Brevo. Depuis le J8, l'outil clôt seul une demande exécutée, issue
`satisfaite`, après confirmation de Brevo (`privacy.complete_request`, registre
`privacy.request_completed`) ; les autres issues s'écrivent avec `0502` (Lot 5). Une demande close est
figée par la base.

## 7. Ce qui ne se fait jamais

- Exécuter sans code frais ou sur la foi d'une simple adresse e-mail (`15` RG74).
- Exporter les messages, notes ou pièces d'un tiers (`15` RG81).
- Écrire à la main dans `backoffice.data_subject_requests` ou dans les tables du compte.
- Recopier une adresse, un nom ou le contenu d'une demande dans un journal, un ticket ou une
  messagerie hors INFLUX (D60).
- Déléguer l'exécution à un `agent` : il instruit, l'`admin` exécute (`15` RG76).

## 8. Points ouverts pour un juriste (droit anglais et UE)

1. Exclure les empreintes sans issue « partielle ».
2. Data (Use and Access) Act 2025 : suspension du délai pendant une clarification, recherche
   « raisonnable et proportionnée », procédure de réclamation obligatoire.
3. Durées au regard de la prescription anglaise (6 ans en matière contractuelle) : 5 ans pour les
   preuves ; proposées par `expert-conformite-rgpd`, non encore fixées : `email_change_requests`
   13 mois, `code_delivery_reports` 90 jours, `data_subject_requests` 3 ans après la clôture.
4. Conserver l'adresse IP dans la preuve d'acceptation.
5. Le changement d'adresse bloqué par la porte de ré-acceptation des CGU.
6. `05` Q7 (messages de l'autre partie, Lot 4).
