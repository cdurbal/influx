# Demandes « mes données » : procédure manuelle de l'administrateur (J7, EC-14)

> **Public :** l'administrateur INFLUX (`admin`) qui instruit et exécute une demande, et le
> fondateur. **Statut :** procédure du MVP, **à relire par `expert-conformite-rgpd` au Lot 6**
> (formulations, durées, contenu de l'export) et par `expert-cybersecurite` en fin de J7 (remise de
> l'export). Références : `05` RG57, `15` RG72 à RG81 (file 14), `17` §6.3, `04` §5.10 et §9.2,
> décision 6 du J7 (`docs/mvp/jalons/j7-fiche.md`), migration `0120`.
> **Règle d'or :** rien n'est exécuté automatiquement. Le membre **dépose** une demande ; un
> `admin` l'**exécute** à la main, en suivant cette page. Une demande traitée hors de cette
> procédure n'existe pas (`15` RG72).

## 1. Ce que fait le produit au J7, et ce qu'il ne fait pas

| Le produit fait | Le produit ne fait pas encore |
|---|---|
| Dépôt depuis l'espace membre : **export** (`access`) ou **suppression** (`erasure`), chacun après un **code frais** de sa finalité (`data_export`, `account_deletion`) | Aucun export, aucune suppression, aucune anonymisation |
| Une ligne dans `backoffice.data_subject_requests` : `received_at`, `due_at` = réception + **30 jours**, figé | L'écran de la file 14 et l'écriture du statut par un `admin` (`0502`, Lot 5) |
| L'accusé de réception `privacy.request_received` (P1, par la file ; modèle Brevo à configurer, EC-8 : sans modèle, la ligne est `skipped template_not_configured`) | L'événement `account.deleted` vers Brevo et Apollo (Lot 5, `15` RG79) |
| Une seule demande ouverte par membre et par type : un second dépôt renvoie la première | La fonction d'exécution `privacy.execute_request` (E-5, Lot 5) |
| Une ligne du registre d'audit `privacy.request_received` | Les demandes reçues par e-mail ou à l'oral (`0502`) |

**Conséquence :** tant que les outils du Lot 5 n'existent pas, **aucune écriture en base ne se fait
à la main** (ni `UPDATE`, ni `DELETE`, ni script ad hoc). Si une demande **réelle** arrive avant le
Lot 5, l'`admin` l'instruit (étapes 1 à 5 ci-dessous) et **escalade aussitôt au fondateur**, qui fait
trancher l'exécution par `architecte` et `expert-conformite-rgpd` avant l'échéance `due_at`.

## 2. Trouver les demandes ouvertes

Lecture seule, rôle `admin` en `aal2` (politique `data_subject_requests_internal_select`, `0120`) ;
jusqu'à l'écran du Lot 5, par une requête de lecture lancée par le fondateur :

```sql
select id, request_type, requester_account_id, received_at, due_at, status
  from backoffice.data_subject_requests
 where status <> 'closed'
 order by due_at;
```

Objectif interne : **10 jours ouvrés** ; limite légale : `due_at` (`15` RG73). À J-7 de `due_at`,
la demande passe en tête de toute autre tâche.

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

Données détenues au Lot 1, **du seul demandeur** (jamais celles d'un tiers, `15` RG81) :

| Catégorie | Source |
|---|---|
| Compte | `identity.accounts` : adresse, pays, langue, statut déclaré, date de création, source d'acquisition déclarée |
| Profil de marque | `profiles.advertiser_profiles` : raison sociale (annonceur seulement) |
| Consentements | `identity.consent_events` : finalité, accordé ou retiré, date, origine |
| Conditions acceptées | `identity.terms_acceptances` : version, date, canal, langue |
| Sessions | `identity.sessions` : création, dernière activité, navigateur (« famille sur système ») ; **jamais** l'empreinte du jeton |
| E-mails transactionnels | `leads.transactional_sends` : code de l'e-mail, date, langue, statut (jamais le contenu d'un code) |
| Changements d'adresse | `identity.email_change_requests` : anciennes et nouvelles adresses, dates (jamais les empreintes de codes) |
| Demandes « mes données » | `backoffice.data_subject_requests` du demandeur |
| Contact Brevo | Les attributs envoyés (`16` §M4) tels que Brevo les détient |

Format : un fichier lisible (JSON ou CSV), en UTF-8, horodaté en UTC. **Mode de remise : point
ouvert** (`expert-cybersecurite`, fin de J7). D'ici sa décision : jamais en pièce jointe d'un e-mail,
jamais par un lien public ; l'`admin` prépare le fichier et escalade au fondateur.

## 5. Exécuter une suppression (`erasure`)

Ce qui disparaît et ce qui survit est fixé par `17` §6.3 et `15` RG80 ; la réponse au membre le dit
**explicitement**, sans le cacher dans un lien.

1. Vérifier qu'aucune mise en relation n'est ouverte (aucune avant le Lot 4 ; ensuite, prévenir le
   commercial responsable et l'autre partie par le message système prévu).
2. **Exécution en base : outil du Lot 5** (`privacy.execute_request`, E-5) — anonymisation, jamais
   suppression physique (le registre l'interdit, `15` RG80). Avant : escalade (§1).
3. **Propagation (`15` RG79)** : le contact Brevo est supprimé ; Apollo n'est pas alimenté au Lot 1
   (connecteur `skipped`) : le vérifier et le noter. **La demande n'est pas close** tant que Brevo n'a
   pas confirmé.
4. Une nouvelle inscription avec la même adresse crée un compte **entièrement nouveau** (`05` RG70).

## 6. Clore (`15` RG75 étape 7, RG77)

Issue choisie dans la liste fermée : `satisfaite`, `satisfaite_partiellement` (avec ce qui n'est pas
satisfait et son fondement), `refusee` (motif de `15` RG78 et voies de recours), `sans_objet`,
`retiree_par_le_demandeur`. Envoyer la réponse à l'adresse du compte, noter la date d'envoi et
l'identifiant du message chez Brevo. L'écriture du statut `closed` et de l'issue arrive avec `0502`
(Lot 5) ; une demande close est ensuite figée par la base.

## 7. Ce qui ne se fait jamais

- Exécuter sans code frais ou sur la foi d'une simple adresse e-mail (`15` RG74).
- Exporter les messages, notes ou pièces d'un tiers (`15` RG81).
- Écrire à la main dans `backoffice.data_subject_requests` ou dans les tables du compte.
- Recopier une adresse, un nom ou le contenu d'une demande dans un journal, un ticket ou une
  messagerie hors INFLUX (D60).
- Déléguer l'exécution à un `agent` : il instruit, l'`admin` exécute (`15` RG76).
