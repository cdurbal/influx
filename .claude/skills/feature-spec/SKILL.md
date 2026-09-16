---
name: feature-spec
description: Transformer un besoin exprimé en langage courant en spécification fonctionnelle INFLUX exploitable — user stories, règles de gestion numérotées, cas limites, critères d'acceptation. À utiliser avant tout développement d'une nouvelle fonctionnalité, et chaque fois qu'une demande est trop vague pour être implémentée sans supposer.
---

# Spécifier une fonctionnalité INFLUX

Objectif : produire un document qu'un développeur implémente sans deviner, qu'un testeur vérifie
sans interpréter, et que le fondateur relit sans formation technique.

Agents concernés : `product-owner` (principal), `chef-de-projet`, `expert-ux`.

## Étape 1 — Cadrer

Réponds à ces questions **avant** d'écrire quoi que ce soit. Si une réponse manque, pose la
question ou formule une hypothèse explicite.

- **Quel acteur ?** Annonceur · Influenceur · Agent interne (backoffice) · Système (automatisme).
- **Quel moment du parcours ?** (cf. §4 de `CLAUDE.md`)
- **Quel problème résolu ?** En une phrase, du point de vue de l'acteur.
- **Quel lien avec le business ?** Contribue-t-il à un contrat signé (commission 35 %), à la
  capture de leads, ou à la réduction d'un risque ?

## Étape 2 — Écrire les user stories

```
En tant que <acteur>, je veux <action>, afin de <bénéfice>.
```

Une story = une valeur observable. Si elle ne tient pas dans un lot livrable, fractionne-la.

## Étape 3 — Numéroter les règles de gestion

Format : `RG<n> : <règle affirmative et vérifiable>`.

Une règle est correcte si l'on peut écrire un test qui l'échoue. « Le système gère correctement
les erreurs » n'est pas une règle.

## Étape 4 — Passer la checklist des cas limites

Parcours systématiquement :

- [ ] Donnée absente ou profil incomplet
- [ ] Valeur nulle, négative ou aberrante (en particulier sur les montants)
- [ ] Doublon (même utilisateur, même campagne, même candidature)
- [ ] Action concurrente (deux agents internes sur la même mise en relation)
- [ ] Droit insuffisant (mauvais rôle, ressource d'un autre utilisateur)
- [ ] Service externe indisponible (Brevo, Apollo, Supabase)
- [ ] Utilisateur qui abandonne en cours de parcours
- [ ] Annulation ou retour en arrière après validation

## Étape 5 — Passer la checklist INFLUX

Contrôles spécifiques au projet, à faire à chaque spécification :

- [ ] **Montants** : est-il précisé partout s'il s'agit du montant du contrat, de la commission
      INFLUX (35 %) ou du net créateur ?
- [ ] **Traçabilité** : la fonctionnalité permet-elle aux parties de se retrouver hors
      plateforme ? Si oui, c'est un risque business à signaler.
- [ ] **Leads** : y a-t-il collecte de coordonnées ? Que part-il vers Brevo et Apollo, avec quel
      consentement ?
- [ ] **Backoffice** : quelle est la contrepartie interne (supervision, correction, relance) ?
- [ ] **Matching hybride** : si le matching est touché, le comportement algorithmique et la
      surcharge humaine sont-ils tous deux spécifiés ?
- [ ] **Deux populations** : la story mélange-t-elle annonceurs et influenceurs dans un même
      écran ? Si oui, elle est probablement mal découpée.
- [ ] **Données personnelles** : faut-il l'avis de `expert-conformite-rgpd` ?

## Étape 6 — Écrire les critères d'acceptation

```
Étant donné <contexte initial>
Quand <action réalisée>
Alors <résultat observable>
```

Un critère par comportement attendu, cas limites compris. C'est ce que `testeur` transformera
en plan de test.

## Étape 7 — Conclure

- **Impacts** : écrans, données, intégrations, indicateurs à suivre.
- **Hors périmètre** : ce qui est explicitement exclu, pour éviter les malentendus.
- **Questions ouvertes** : chacune avec son arbitre désigné (agent ou fondateur). Si la question
  est structurante, l'ajouter au tableau §13 de `CLAUDE.md`.

## Format du document produit

```
# <Nom de la fonctionnalité>

## Besoin
## Acteurs
## User stories
## Règles de gestion (RG1…RGn)
## Cas limites
## Critères d'acceptation
## Impacts
## Hors périmètre
## Questions ouvertes
```

Rédaction **en français**, sans jargon technique : le fondateur doit pouvoir corriger lui-même.
