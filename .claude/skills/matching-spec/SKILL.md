---
name: matching-spec
description: Définir ou faire évoluer les règles du moteur de mise en relation INFLUX — critères, pondérations, règles d'exclusion, explicabilité des suggestions, articulation avec les agents humains du backoffice et mesure de la pertinence. À utiliser pour toute évolution du matching.
---

# Spécifier le moteur de mise en relation

La mise en relation déclenche les contrats, donc la commission de 35 %. Une règle de matching
n'est bonne que si elle augmente le nombre de contrats signés.

Agents concernés : `expert-matching` (principal), `product-owner` (valide), `expert-database`,
`expert-ux`.

## Principe fondateur : dispositif hybride

> **L'algorithme propose et priorise. L'agent humain décide.**

Toute spécification de matching décrit **les deux voies** :
1. Ce que l'algorithme calcule et propose automatiquement.
2. Ce que l'agent interne peut faire depuis le backoffice : forcer, écarter, annoter, réordonner.

Toute intervention humaine est **tracée** et constitue un signal d'amélioration.

## Étape 1 — Définir l'objectif de la règle

- Quel problème de pertinence est traité ?
- Quel comportement observé le motive ? (suggestions ignorées, agents qui surchargent toujours
  au même endroit, campagnes sans proposition…)
- Quel indicateur doit bouger, et de combien ?

## Étape 2 — Séparer exclusions et pondérations

**Les règles d'exclusion priment sur le score.** Elles éliminent, elles ne se pondèrent pas :

- [ ] Conflit d'intérêt (marque concurrente d'un engagement en cours)
- [ ] Budget de campagne incompatible avec les tarifs de l'influenceur
- [ ] Profil non vérifié ou suspendu
- [ ] Blocage explicite entre les deux parties
- [ ] Indisponibilité sur la période de la campagne
- [ ] Format demandé non proposé par l'influenceur

**Les critères de pondération** classent ce qui reste :

| Famille | Exemples | Poids proposé |
|---|---|---|
| Pertinence thématique | Secteur annonceur vs thématiques influenceur | à définir |
| Audience | Volume, démographie, zone géographique, réseaux | à définir |
| Compatibilité économique | Budget vs tarifs indicatifs | à définir |
| Format | Formats demandés vs formats proposés | à définir |
| Disponibilité | Période, charge en cours | à définir |
| Qualité du profil | Complétude, vérification, historique de réussite, respect des délais | à définir |
| Signal comportemental | Taux de réponse, taux d'acceptation, rapidité | à définir |

Chaque poids doit être **justifié par un lien plausible avec la signature d'un contrat**.

## Étape 3 — Rédiger l'explication affichée

Toute suggestion affiche **pourquoi** elle est faite, en français, compréhensible par un
non-technicien. Exemple de forme attendue :

> « Proposé car : thématique beauté correspondante · audience à 70 % en France · tarif compatible
> avec votre budget · répond généralement sous 48 h. »

**Un score numérique seul est interdit** : inutilisable par un agent commercial, opaque pour
l'utilisateur, et non conforme aux exigences d'information sur les traitements automatisés.

## Étape 4 — Traiter le cas froid

Un nouvel influenceur sans historique et une nouvelle campagne doivent **quand même** recevoir
des propositions, sinon la marketplace ne démarre pas. Spécifier :

- Quelle valeur par défaut pour les critères comportementaux absents ?
- Quel mécanisme de mise en avant des nouveaux profils ?
- À partir de quand les signaux comportementaux prennent-ils le pas ?

## Étape 5 — Définir les points d'intervention humaine

- [ ] Où l'agent voit-il les suggestions et leur explication ?
- [ ] Comment force-t-il une mise en relation hors suggestion ?
- [ ] Comment écarte-t-il une suggestion, et avec quel motif ?
- [ ] Comment son action est-elle tracée et réexploitée ?
- [ ] Quels seuils déclenchent une alerte à l'équipe (campagne sans aucune proposition, profil
      jamais proposé…) ?

## Étape 6 — Définir la mesure

| Indicateur | Ce qu'il mesure |
|---|---|
| Taux de réponse à une suggestion | Pertinence perçue immédiate |
| Taux de mise en relation acceptée | Pertinence confirmée |
| **Taux de transformation en contrat signé** | **Indicateur de référence** |
| Délai jusqu'au premier contact | Fluidité |
| Taux de surcharge humaine | Contre-indicateur : signal d'un critère mal pondéré |
| Part des campagnes sans aucune proposition | Couverture du moteur |

Toute modification de pondération est traitée comme un **changement de version** : mesure avant,
mesure après, sur une période définie à l'avance.

## Étape 7 — Vérifier la conformité

- [ ] Aucun critère fondé sur une caractéristique personnelle protégée. Uniquement des éléments
      professionnels (audience, thématique, formats, tarifs, performances).
- [ ] Information des personnes sur l'existence d'un traitement automatisé.
- [ ] Possibilité d'intervention humaine documentée.
- [ ] Validation par `expert-conformite-rgpd`.

## Étape 8 — Fournir les cas de test

Livrer à `testeur` un jeu de cas attendus : profils d'entrée, campagne, suggestions attendues
dans l'ordre, et exclusions qui doivent s'appliquer. Une règle de matching sans cas de test
n'est pas livrable.

## Format de sortie

**Objectif** → **Règles d'exclusion** → **Critères et pondérations proposées** (avec
justification) → **Explication affichée** → **Comportement en cas froid** → **Points
d'intervention humaine** → **Indicateurs et seuils** → **Données manquantes à collecter** →
**Cas de test** → **Validation `product-owner` et `expert-conformite-rgpd`**.
