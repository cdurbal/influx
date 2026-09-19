---
name: lead-pipeline
description: Concevoir ou faire évoluer le pipeline événementiel de capture et de distribution des leads INFLUX vers Brevo et Apollo.io — émission d'événements, file d'attente, réessais, idempotence, journalisation et supervision au backoffice. À utiliser dès qu'une fonctionnalité capte un lead ou modifie la synchronisation CRM.
---

# Pipeline de capture et distribution des leads

Chaque inscription vaut de l'argent : elle doit arriver dans Brevo et, si elle est qualifiée,
dans Apollo.io. Ce pipeline est le système nerveux commercial d'INFLUX.

Agents concernés : `architecte` (principal), `expert-integrations-api`, `expert-database`,
`expert-marketing`.

> **Mise à jour du 2026-09-19** (`expert-integrations-api`, à la suite de
> `docs/mvp/16-backoffice-emails-brevo.md`). Cette skill ne parlait que de **leads**. Or la même
> file transporte désormais **des e-mails dont dépend l'accès au produit** : depuis **D37**, un
> membre se connecte avec un code à six chiffres reçu par e-mail. Un pipeline qui traite ce code
> comme une synchronisation de contact est un pipeline qui enferme les gens dehors.
> Trois ajouts datés : la section **« Les trois priorités d'envoi »**, les **règles 10 à 12**, et
> la mise à jour de **« Choix techniques »** (D18 est tranchée depuis le 2026-09-18).

## Principe directeur

> **Une inscription ne doit JAMAIS échouer parce qu'un service externe est indisponible.**

Et son corollaire, ajouté le 2026-09-19 :

> **Un e-mail dont dépend l'accès au produit ne doit JAMAIS attendre derrière une synchronisation
> de contact.**

La capture (écriture en base) et la distribution (envoi vers les outils tiers) sont deux
opérations découplées.

```
  Inscription / action utilisateur
            │
            ▼
   ┌────────────────────┐
   │  Écriture en base  │◄── source de vérité, transaction courte
   │  (Supabase)        │    Réponse immédiate à l'utilisateur
   └─────────┬──────────┘
             │  émission d'un événement (lead.created, lead.updated,
             │  profile.completed, contract.signed, consent.revoked…)
             ▼
   ┌────────────────────┐
   │   File d'attente   │  persistée, rejouable, ordonnée par lead
   └───┬────────────┬───┘
       │            │
       ▼            ▼
  ┌─────────┐  ┌──────────┐
  │  Brevo  │  │ Apollo.io│   (consommateurs indépendants :
  └────┬────┘  └────┬─────┘    l'échec de l'un n'affecte pas l'autre)
       │            │
       ▼            ▼
   ┌────────────────────────────────┐
   │  Journal de synchronisation    │ → supervision + rejeu au backoffice
   └────────────────────────────────┘
```

## Événements à prévoir

| Événement | Déclencheur | Destinations |
|---|---|---|
| `lead.created` | Inscription annonceur ou influenceur | Brevo ; Apollo si qualifié |
| `lead.updated` | Modification des coordonnées ou du profil | Brevo, Apollo |
| `profile.completed` | Profil passé complet | Brevo (changement d'étape de funnel) |
| `campaign.published` | Annonceur publie une campagne | Brevo, Apollo (signal de maturité) |
| `match.proposed` | Mise en relation proposée | Brevo (notification, relance) |
| `contract.signed` | Contrat signé | Brevo ; **sortie des séquences Apollo** |
| `consent.revoked` | Retrait du consentement | Brevo, Apollo (désinscription, retrait des séquences) |
| `account.deleted` | Demande de suppression RGPD | Brevo, Apollo (propagation de la suppression) |

## Règles non négociables

1. **Découplage strict.** La transaction métier se termine avant toute tentative d'appel externe.
2. **Consentement vérifié au moment de la consommation**, pas seulement à l'émission : il peut
   avoir été retiré entre-temps. Pas de consentement = pas d'envoi, journalisé comme tel.
3. **Idempotence de bout en bout.** Chaque événement porte un identifiant unique ; chaque
   consommateur utilise une clé d'idempotence stable. Rejouer est toujours sûr.
4. **Consommateurs indépendants.** Un échec Brevo ne bloque pas Apollo, et réciproquement.
5. **Réessai avec temporisation exponentielle plafonnée**, nombre maximal de tentatives défini,
   puis mise en échec définitif avec remontée au backoffice.
6. **Ordre respecté par lead.** Les événements d'un même lead sont traités dans l'ordre : une
   création avant une mise à jour, une révocation de consentement jamais doublée par un envoi.
7. **Les événements de suppression et de révocation sont prioritaires** : ils passent devant la
   file normale. Un retard sur une désinscription est un manquement légal.
8. **Journalisation exhaustive** : événement, destination, tentative, statut, réponse,
   horodatage. Aucune donnée personnelle superflue dans les journaux.
9. **Rien n'est perdu.** Un événement en échec définitif reste consultable et rejouable
   manuellement depuis le backoffice.
10. **Toute sortie d'e-mail porte une priorité explicite** *(ajouté le 2026-09-19)* :
    `leads.transactional_sends.priority`, **`not null` et sans valeur par défaut**, dans une liste
    fermée `P0` · `P1` · `P2`. Voir la section « Les trois priorités d'envoi ».
11. **Le code de connexion n'est jamais coupé, jamais mis en attente, jamais rejoué tout seul**
    *(ajouté le 2026-09-19)*. C'est une règle de **worker**, pas une contrainte de base — aucune
    contrainte SQL ne peut l'exprimer. La base garantit seulement qu'un envoi `P0` est **toujours
    reconnaissable** ; le worker tient la règle ; **un test la prouve**.
12. **Indépendance jusqu'aux budgets de débit** *(ajouté le 2026-09-19)*. La règle 4 dit que Brevo
    et Apollo sont indépendants. Elle s'étend : **la synchronisation de contacts et les e-mails
    transactionnels sont eux aussi des consommateurs indépendants**, y compris lorsqu'ils
    s'adressent au même fournisseur.

## Les trois priorités d'envoi *(section ajoutée le 2026-09-19)*

Tout ce qui sort du pipeline sous forme d'e-mail porte **une priorité, explicite et choisie** :

| Priorité | Contenu | Chemin | Traitement |
|---|---|---|---|
| **`P0`** | **Code de connexion** (**D37**), alertes critiques internes (connexion au compte de secours, rupture de chaîne du registre) | **Chemin dédié.** N'entre **jamais** dans la file partagée avec les synchronisations de contacts (`05` RG59) | Tentative **immédiate**, dans la requête. **Aucun réessai automatique** : l'échec s'affiche à la personne avec sa cause, et c'est elle qui redemande (`05` RG60, RG64) |
| **`P1`** | Preuves, décisions, confirmations : e-mail de révélation d'identité, refus motivé, badge, décision de campagne, demandes RGPD | `outbox_events` (**D18**) | Devant les `P2` et devant les synchronisations ordinaires. Réessais du calendrier de `05` RG79, échec définitif alerté |
| **`P2`** | Notifications et récapitulatifs : nouveau message, rappel, récapitulatif quotidien d'un agent | `outbox_events` | Tolérance au retard assumée |

### La colonne de priorité, et ce qu'elle garantit vraiment

**`leads.transactional_sends.priority`, `not null`, sans valeur par défaut**, liste fermée.

- **Sans défaut, délibérément.** Une valeur par défaut ferait hériter tout nouveau point d'appel
  d'une priorité que personne n'a choisie. Le jour où quelqu'un ajoute un chemin d'envoi du code de
  connexion, celui-ci deviendrait **silencieusement `P2`** — et personne ne le verrait avant qu'un
  membre n'appelle pour dire qu'il ne peut plus se connecter. Forcer la décision à chaque point
  d'appel **est** l'objet de cette colonne.
- **Ce que la base garantit : la reconnaissance, pas le comportement.** Il faut le dire sans
  détour, parce que l'inverse est la fausse sécurité la plus courante. Aucune contrainte SQL ne
  peut exprimer « un envoi `P0` part toujours, même interrupteur d'urgence actionné » : c'est une
  propriété du **worker**, pas d'une ligne. La base garantit seulement qu'un envoi `P0` est
  **toujours identifiable sans ambiguïté**. Ce sont donc **trois mécanismes distincts** :

| Qui | Ce qu'il tient |
|---|---|
| **La base** | Un envoi `P0` est reconnaissable : colonne obligatoire, liste fermée, aucun défaut |
| **Le worker et l'API** | `P0` emprunte le chemin dédié, passe devant tout, et **n'est jamais coupé par l'interrupteur d'urgence** (`16` RG122) |
| **Le test** | Il prouve que les deux précédents font ce qu'ils annoncent, sinon la règle n'est qu'une intention |

### Ordre entre `P0` et les révocations prioritaires (règle 7)

La règle 7 fait passer `consent.revoked` et `account.deleted` devant toute la file — priorité 0
dans `outbox_events` (`05` RG78). La question se pose donc : **qui passe en premier ?**

> **`P0` passe devant les révocations. Et les deux ne se croisent presque jamais.**

Deux raisons, dans cet ordre :

1. **Ils ne sont pas dans la même file.** `P0` a un chemin dédié ; les révocations vivent dans
   `outbox_events`. Ils ne se disputent ni les mêmes lignes, ni le même verrou. La seule ressource
   réellement partagée est le **budget de débit du fournisseur** — et encore : chez Brevo, l'envoi
   transactionnel et la mise à jour de contact relèvent de **deux catégories de limites
   distinctes** (`16` §M2). L'arbitrage est donc **rare**, et c'est déjà une réponse.
2. **Quand il a lieu, les horizons départagent.** Un code de connexion se compte en **secondes** :
   quelqu'un attend devant son écran, et le retard est une **indisponibilité constatée**. Une
   révocation se compte en **minutes** : l'objectif est une prise en charge **sous 5 minutes**
   (`05` RG92). Laisser passer un code de connexion devant une révocation coûte à celle-ci quelques
   secondes sur un budget de cinq minutes — sans effet. L'inverse enferme quelqu'un dehors. Et
   faire attendre le code ne rendrait la révocation **ni plus rapide, ni plus conforme**.

**Ordre complet, à respecter par les consommateurs :**
`P0` → révocations et suppressions (priorité 0) → `P1` → `P2` → synchronisations de contact
ordinaires.

### Indépendance des consommateurs, jusqu'au budget de débit

La règle 4 (« un échec Brevo ne bloque pas Apollo ») ne suffit plus : **les deux consommateurs les
plus susceptibles de se gêner s'adressent au même fournisseur.**

- **Une panne ou une saturation de la synchronisation de contacts ne doit jamais retarder un
  e-mail transactionnel**, même chez le même fournisseur. Chez Brevo, la catégorie « contacts »
  plafonne autour de **10 requêtes par seconde** quand la catégorie « transactionnel » en supporte
  environ **mille** (`16` §M2, vérifié le 2026-09-19) : les confondre dans un même compteur de
  débit ferait attendre un code de connexion derrière une file de mises à jour de contact, **sans
  la moindre nécessité technique**.
- Conséquence de conception : **un budget de débit et une temporisation par catégorie
  d'appel**, jamais un compteur global. Un `429` sur les contacts ne ralentit pas les envois.
- **Une panne totale d'Apollo n'a aucun effet sur les e-mails**, ni sur Brevo. C'est la règle 4,
  rappelée ici parce qu'elle est régulièrement perdue au moment d'écrire le worker.
- **Aucun appel externe n'est jamais effectué en tenant un verrou de transaction** (**D18**) :
  c'est ce qui empêche un fournisseur lent de bloquer la file entière.

### Ce que voit le backoffice

Les envois `P0` ont leur propre suivi, distinct de celui des leads : **six indicateurs de
délivrabilité du code de connexion** avec leurs seuils, et une alerte immédiate au dépassement
(`16` RG98, RG99, alerte **AL48** de `15`). Un `P0` lent ne se découvre pas par une réclamation.

## Supervision au backoffice (exigence produit)

L'agent interne doit pouvoir :

- [ ] Voir les leads du jour et leur état de synchronisation (Brevo / Apollo).
- [ ] Filtrer les échecs et en comprendre la cause en clair (pas de trace technique brute).
- [ ] **Rejouer** une synchronisation en échec, à l'unité ou en lot.
- [ ] Voir les leads non synchronisés **par absence de consentement** (cas normal, pas une erreur).
- [ ] Voir les leads non éligibles à Apollo et la raison de la non-qualification.
- [ ] Être alerté en cas de panne durable d'un service externe ou de quota dépassé.

## Concevoir une nouvelle étape du pipeline

1. **Nommer l'événement** au passé, dans le domaine métier (`contract.signed`, pas `sendEmail`).
2. **Définir la charge utile** : identifiants stables uniquement, jamais de donnée sensible
   inutile. Le consommateur relit la base pour l'état à jour.
3. **Lister les consommateurs** et, pour chacun, l'action attendue et la clé d'idempotence.
4. **Définir la politique d'erreur** par consommateur (cf. skills `brevo-campaign` et
   `apollo-lead-sync`).
5. **Définir ce que voit le backoffice.**
6. **Écrire les tests** : service indisponible, rejeu, consentement retiré entre émission et
   consommation, ordre des événements, quota dépassé.

## Choix techniques

Le mécanisme exact de file (table Postgres traitée en tâche de fond, service de file dédié…)
est une **décision ouverte** relevant de `architecte`. Critère de tranchage : la solution la plus
simple qui garantisse persistance, ordre par lead, réessai et rejeu manuel — sans ajouter
d'infrastructure difficile à exploiter sur Railway.

## Checklist

- [ ] La transaction métier se termine sans dépendre d'un appel externe
- [ ] Événement nommé au passé, charge utile minimale
- [ ] Consentement revérifié à la consommation
- [ ] Idempotence garantie pour chaque consommateur
- [ ] Réessais bornés, échec définitif visible au backoffice
- [ ] Événements de révocation et de suppression prioritaires
- [ ] Rejeu manuel disponible
- [ ] Tests de panne externe et de rejeu écrits
- [ ] Aucune donnée personnelle superflue dans les journaux
