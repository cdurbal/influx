---
name: lead-pipeline
description: Concevoir ou faire évoluer le pipeline événementiel de capture et de distribution des leads INFLUX vers Brevo et Apollo.io — émission d'événements, file d'attente, réessais, idempotence, journalisation et supervision au backoffice. À utiliser dès qu'une fonctionnalité capte un lead ou modifie la synchronisation CRM.
---

# Pipeline de capture et distribution des leads

Chaque inscription vaut de l'argent : elle doit arriver dans Brevo et, si elle est qualifiée,
dans Apollo.io. Ce pipeline est le système nerveux commercial d'INFLUX.

Agents concernés : `architecte` (principal), `expert-integrations-api`, `expert-database`,
`expert-marketing`.

## Principe directeur

> **Une inscription ne doit JAMAIS échouer parce qu'un service externe est indisponible.**

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
