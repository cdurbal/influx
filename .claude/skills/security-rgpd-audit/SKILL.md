---
name: security-rgpd-audit
description: Conduire la revue de sécurité et de conformité RGPD d'INFLUX avant une livraison — autorisation, RLS, secrets, données personnelles, consentement, droits des personnes, transferts vers Brevo et Apollo. À utiliser avant toute mise en production et pour toute fonctionnalité touchant des données personnelles ou financières.
---

# Revue sécurité et conformité RGPD

Deux lectures complémentaires d'une même livraison : la **protection technique**
(`expert-cybersecurite`) et la **légalité du traitement** (`expert-conformite-rgpd`). Un système
parfaitement sécurisé peut être parfaitement illégal.

Les deux agents disposent d'un **droit de veto bloquant**.

## Qualification des constats

| Niveau | Signification |
|---|---|
| **Bloquant** | Ne doit pas être livré en l'état |
| **Important** | À corriger rapidement, ticket ouvert, risque documenté |
| **À surveiller** | Risque accepté et documenté |

Chaque constat doit être **concret** : surface concernée, scénario réel, impact, correctif,
effort. Pas de remarque générique.

---

## Partie A — Sécurité applicative

### Autorisation et accès

- [ ] Autorisation vérifiée **côté serveur** sur chaque route, pour chaque rôle (annonceur,
      influenceur, agent interne, admin)
- [ ] Le masquage d'UI n'est **jamais** utilisé comme contrôle d'accès
- [ ] RLS activée et testée sur toute table touchée
- [ ] Accès au backoffice restreint et journalisé ; 2FA minimum recommandée pour ces comptes
- [ ] Impossible d'accéder à la ressource d'un autre utilisateur en modifiant un identifiant

### Données et entrées

- [ ] Toutes les entrées validées et typées côté serveur ; aucune confiance dans le client
- [ ] **Aucun montant ni taux de commission accepté depuis le client**
- [ ] Fichiers téléversés : types et tailles restreints, stockage privé, URLs signées à durée
      limitée
- [ ] Messages entre utilisateurs assainis (pas d'injection de contenu actif)

### Secrets et configuration

- [ ] Aucun secret dans le code, les journaux, les messages d'erreur ou le bundle front
- [ ] `service_role` Supabase, clés Brevo et Apollo strictement côté serveur
- [ ] Clés distinctes entre `staging` et `production`
- [ ] HTTPS partout, en-têtes de sécurité, CORS restreint aux origines attendues

### Robustesse

- [ ] Limitation de débit sur authentification, inscription et endpoints coûteux
- [ ] Webhooks entrants : signature vérifiée, rejeu impossible, traitement idempotent
- [ ] Erreurs sans fuite d'information technique vers l'utilisateur
- [ ] Dépendances sans vulnérabilité connue critique ou élevée
- [ ] Journalisation des accès aux données sensibles, **sans y écrire les données elles-mêmes**

---

## Partie B — Conformité RGPD et réglementaire

### Collecte et base légale

- [ ] Chaque champ collecté est justifié par une finalité (minimisation)
- [ ] Base légale identifiée pour chaque traitement (contrat, consentement, intérêt légitime,
      obligation légale)
- [ ] Information des personnes accessible au moment de la collecte

### Consentement

- [ ] Consentement marketing recueilli par **case non pré-cochée**, distincte de l'acceptation
      des CGU
- [ ] Preuve du consentement conservée : valeur, date, source
- [ ] **Aucune synchronisation vers Brevo ou Apollo sans consentement vérifié au moment de l'envoi**
- [ ] Désinscription simple, effective, et **propagée** aux outils tiers

### Droits des personnes

- [ ] Accès, rectification, effacement, portabilité, opposition, limitation : procédure existante
      et documentée
- [ ] **La suppression se propage à Brevo et Apollo**
- [ ] Les données contractuelles et comptables sont conservées (obligation légale) et anonymisées
      plutôt que supprimées, avec une règle écrite

### Conservation

- [ ] Durée de conservation définie par catégorie de données
- [ ] Règle de purge ou d'anonymisation associée, et applicable

### Transparence et documents

- [ ] CGU, CGV, politique de confidentialité, mentions légales, politique cookies en ligne
- [ ] **Contrat d'intermédiation** disponible, matérialisant la commission de 35 %
- [ ] **Taux de 35 % énoncé clairement et accessible avant tout engagement** (risque de pratique
      commerciale trompeuse dans le cas contraire)
- [ ] Bandeau cookies conforme : refus aussi simple que l'acceptation, aucun traceur non
      essentiel avant consentement

### Traitement automatisé (matching)

- [ ] Les personnes sont informées de l'existence d'un traitement automatisé de mise en relation
- [ ] Aucun critère fondé sur une caractéristique personnelle protégée
- [ ] Intervention humaine possible et documentée (dispositif hybride d'INFLUX)

### Sous-traitants et transferts

- [ ] Registre des traitements à jour
- [ ] Brevo, Apollo.io, Supabase, Railway identifiés comme destinataires ou sous-traitants
- [ ] Localisation des données connue, UE privilégiée ; transferts hors UE encadrés
- [ ] Contrats de sous-traitance en place

### Cas particulier : influenceurs mineurs

- [ ] Vérification d'âge prévue
- [ ] Régime spécifique traité (législation française sur les enfants influenceurs), **ou**
      exclusion des mineurs assumée et énoncée dans les CGU

---

## Conduire la revue

1. Délimiter le périmètre : quelle fonctionnalité, quelles données, quels rôles.
2. Dérouler la partie A puis la partie B.
3. Qualifier chaque constat (bloquant / important / à surveiller) avec un scénario concret.
4. Proposer un correctif applicable et estimer l'effort.
5. Rendre un **verdict explicite**.

## Format de sortie

Par constat : **Gravité** → **Surface ou traitement** → **Scénario concret** → **Impact** →
**Correctif** → **Qui agit** → **Effort**.

**Verdict final** : livraison autorisée / autorisée sous conditions / **bloquée** — avec la liste
des points bloquants et ce qui doit être validé par un professionnel du droit.

> Rappel : les documents juridiques engageants doivent être validés par un juriste avant mise en
> ligne. Cette revue les prépare, elle ne les valide pas.
