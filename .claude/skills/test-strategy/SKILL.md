---
name: test-strategy
description: Définir le plan de test d'une fonctionnalité INFLUX — choix du niveau de test, zones critiques à couvrir (commission, RLS, synchronisation des leads), cas limites et définition du « prêt à livrer ». À utiliser avant d'implémenter une fonctionnalité et avant toute livraison.
---

# Stratégie de test INFLUX

Objectif : attraper les défauts avant le fondateur et avant les utilisateurs — en particulier
ceux qui coûtent de l'argent ou exposent des données.

Agents concernés : `testeur` (principal), `dev-react-node`, `integrateur`.

## Choisir le bon niveau

| Niveau | Pour quoi | Quand |
|---|---|---|
| **Unitaire** | Règles de gestion pures : calcul de commission, net créateur, scoring de matching, validations, transitions de statut | Systématique. Rapide, sans dépendance externe |
| **Intégration** | API + base Supabase (**politiques RLS incluses**), pipeline de leads, appels Brevo/Apollo avec doublures | Sur tout chemin critique |
| **End-to-end** | Parcours complets à valeur business | Sur les parcours clés uniquement, pas partout |

Règle de choix : **si la logique peut être testée unitairement, elle doit l'être**. L'E2E est
coûteux et fragile : on le réserve aux parcours qui font gagner de l'argent.

## Zones critiques — couverture obligatoire

### 1. Commission 35 % — la plus testée du projet

- [ ] Calcul nominal, avec vérification de l'identité `contrat = commission + net`
- [ ] Tous les cas d'arrondi, attribution du reliquat
- [ ] Taux dérogatoire
- [ ] **Immuabilité du taux après signature** (modifier le taux plateforme ne change pas un
      contrat existant)
- [ ] Montant nul ou négatif refusé
- [ ] Montant ou taux venant du client refusé
- [ ] Cohérence entre le montant affiché, le montant du contrat et le montant facturé

### 2. Row Level Security

Tester **au niveau base**, pas seulement au niveau API :

- [ ] Un annonceur ne lit pas les données d'un autre annonceur
- [ ] Un influenceur ne lit pas les contrats ni les messages d'autrui
- [ ] Un utilisateur non authentifié n'accède à rien
- [ ] Seuls les rôles autorisés accèdent au backoffice
- [ ] Les fichiers stockés (portfolios, livrables, contrats) ne sont pas accessibles publiquement

### 3. Synchronisation des leads

- [ ] Un échec Brevo ou Apollo **ne fait pas échouer** l'inscription
- [ ] Le rejeu est idempotent : rejouer ne crée pas de doublon ni de second e-mail
- [ ] Aucune synchronisation sans consentement enregistré
- [ ] Une désinscription ou une suppression se propage aux outils tiers
- [ ] Le quota dépassé met en file d'attente sans perdre de lead
- [ ] Les événements d'un même lead sont traités dans l'ordre

### 4. Matching

- [ ] Les règles d'exclusion éliminent bien (elles ne se pondèrent pas)
- [ ] L'ordre des suggestions correspond aux pondérations spécifiées
- [ ] Le cas froid (nouveau profil, nouvelle campagne) produit quand même des suggestions
- [ ] La surcharge humaine est tracée

### 5. Transitions de statut

- [ ] Aucune transition illégale possible sur une campagne ou un contrat
- [ ] Les actions concurrentes ne produisent pas d'état incohérent

## Règles non négociables

1. **Aucune règle financière ou de matching n'est livrable sans test unitaire.**
2. **Aucun test ne touche un service externe réel.** Brevo et Apollo sont doublés.
   Un e-mail réellement envoyé depuis la CI est un incident.
3. **Un bug corrigé donne lieu à un test de non-régression**, qui échoue avant le correctif et
   passe après.
4. **Les tests sont déterministes.** Un test instable est traité comme un test cassé, pas comme
   une gêne à ignorer.
5. **Aucune donnée personnelle réelle** dans les jeux de test.
6. **La CI bloque le merge** si typecheck, lint ou tests échouent.

## Écrire un plan de test

1. **Lister les risques** de la fonctionnalité, par gravité (perte d'argent > fuite de données >
   perte de lead > gêne utilisateur).
2. **Associer un niveau de test à chaque risque.**
3. **Dériver les cas des critères d'acceptation** de `product-owner`.
4. **Ajouter les cas limites** : donnée absente, valeur nulle ou négative, doublon, concurrence,
   droit insuffisant, service externe indisponible, abandon en cours de parcours.
5. **Écrire ce qui n'est pas couvert et pourquoi** — un trou connu vaut mieux qu'un faux
   sentiment de sécurité.

## Définition du « prêt à livrer »

- [ ] Tous les critères d'acceptation vérifiés
- [ ] Règles financières ou de matching couvertes par des tests unitaires
- [ ] Politiques RLS concernées couvertes par des tests d'intégration
- [ ] Parcours business affectés couverts en E2E
- [ ] `expert-cybersecurite` sans objection ouverte
- [ ] `expert-conformite-rgpd` sans objection ouverte si données personnelles touchées
- [ ] Cas limites couverts, ou explicitement acceptés et documentés
- [ ] CI verte

## Format de sortie

**Fonctionnalité** → **Risques par gravité** → **Plan par niveau** (unitaire / intégration / E2E)
→ **Cas limites** → **Non couvert et pourquoi** → **Verdict « prêt à livrer »** : oui / non, avec
les points bloquants.
