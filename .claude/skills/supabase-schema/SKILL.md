---
name: supabase-schema
description: Modéliser une entité, écrire une migration ou définir des politiques Row Level Security sur la base Supabase/PostgreSQL d'INFLUX. À utiliser avant toute création ou modification de table, et pour toute question de rétention, d'index ou d'accès aux données.
---

# Modéliser et faire évoluer la base INFLUX

Objectif : une base qui dit la vérité métier, protège les données par défaut et supporte les
obligations comptables et légales.

Agents concernés : `expert-database` (principal), `architecte`, `dev-react-node`.

## Avant de modéliser

1. Lire les règles de gestion produites par `product-owner` (skill `feature-spec`).
2. Identifier le domaine concerné : `identity` · `profiles` · `campaigns` · `matching` ·
   `messaging` · `contracts` · `billing` · `leads` · `backoffice`.
3. Identifier les rôles qui liront et écriront : annonceur, influenceur, agent interne, admin,
   service serveur.
4. Vérifier si la donnée est **personnelle** (→ `expert-conformite-rgpd`) ou **financière**
   (→ `expert-paiement-facturation`).

## Règles de modélisation

### Générales

- Tables au **pluriel**, `snake_case` anglais. Clé primaire `id`. Clés étrangères `<entite>_id`.
- Horodatages `created_at` / `updated_at` sur toute table.
- **Intégrité déclarative** : clés étrangères, `NOT NULL`, `CHECK`, contraintes d'unicité.
  Une contrainte en base vaut mieux qu'une convention en code.
- Commenter toute table et toute colonne non évidente.
- Pas de dénormalisation sans mesure la justifiant.

### Argent — critique

- **Jamais de `float` / `double`.** Entiers en plus petite unité monétaire, ou `numeric` exact.
- **Devise explicite** (code ISO 4217) sur tout montant ; une devise unique par contrat, parmi
  les devises autorisées (D27).
- **Les taux de commission sont des colonnes, pas des constantes.** Deux taux : **part
  annonceur** (défaut 20 %) et **part créateur** (défaut 15 %), soit 35 % au total ; paramétrables,
  avec possibilité de taux dérogatoires.
- **Les deux taux appliqués sont historisés sur le contrat** au moment de la signature. Une
  évolution des taux plateforme ne modifie jamais un contrat déjà signé.
- Conserver les composantes du calcul (montant du contrat, devise, taux des deux parts, part
  annonceur, part créateur, net créateur) et pas seulement le résultat. Contrainte `CHECK` :
  `part annonceur + part créateur + net créateur = montant du contrat`.
- Conserver les références du prestataire de paiement (paiement, reversement, remboursement)
  pour le rapprochement comptable. Aucune donnée de carte en base.

### International

- **Pays** (code ISO 3166-1 alpha-2) et **langue** explicites sur les comptes ; pays des parties
  historisé sur le contrat.
- **Horodatages en `timestamptz`**, jamais sans fuseau.
- **La liste des pays ouverts aux contrats est une table**, administrable depuis le backoffice,
  pas une constante (D26).

### Sécurité et accès

- **RLS activée sur toute table** contenant des données personnelles ou financières. Une table
  sans politique explicite est traitée comme une faille.
- Politiques écrites **par rôle** : annonceur, influenceur, agent interne, admin.
- Les opérations serveur privilégiées passent par la `service_role key`, **jamais exposée au
  client**.
- Storage : politiques d'accès alignées sur les RLS des tables correspondantes (portfolios,
  livrables, contrats sont privés par défaut).

### Conformité et conservation

- **Consentement marketing stocké explicitement** : valeur, date, source. Il conditionne toute
  synchronisation vers Brevo et Apollo.
- **Pas de suppression physique** des données liées à un contrat (obligations comptables).
  Suppression logique + procédure d'anonymisation compatible avec le droit à l'effacement.
- **Durée de conservation définie** pour chaque catégorie de données, avec sa règle de purge.
- **Journal d'audit append-only** sur : mises en relation, changements de statut de contrat,
  calculs de commission, tentatives de synchronisation externe. Horodatage + acteur.

## Écrire une migration

1. **Une migration = un changement cohérent**, versionnée dans Git, jamais appliquée à la main
   en production via l'interface Supabase.
2. **Incrémentale et idempotente** autant que possible.
3. **Décrire le rollback**, ou expliquer pourquoi il est impossible.
4. **Compatibilité avec le code déployé** : sur un changement destructif, procéder en étapes
   (ajouter → migrer les données → basculer le code → supprimer l'ancien).
5. **Une migration destructive nécessite une confirmation explicite du fondateur.**
6. Vérifier l'impact sur les politiques RLS existantes : une nouvelle colonne sensible peut
   exiger une nouvelle politique.

## Index

- Créer un index **en réponse à une requête réelle**, jamais par précaution.
- Zones à surveiller en priorité : requêtes de scoring du matching, listes du backoffice,
  recherche de campagnes, journal de synchronisation des leads.
- Documenter la requête qui justifie chaque index.

## Checklist avant livraison

- [ ] RLS activée et politiques écrites pour chaque rôle sur chaque table touchée
- [ ] Aucun montant en flottant, devise présente
- [ ] Taux des deux parts de commission historisés au contrat, pas recalculés
- [ ] Pays, langue et fuseau horaire explicites là où ils s'appliquent
- [ ] Consentement marketing modélisé si la table alimente Brevo ou Apollo
- [ ] Durée de conservation définie pour toute donnée personnelle
- [ ] Journal d'audit alimenté sur les entités sensibles
- [ ] Migration réversible, ou impossibilité documentée
- [ ] Tests d'intégration RLS demandés à `testeur`
- [ ] Revue `expert-cybersecurite` si données sensibles ; revue `expert-conformite-rgpd` si
      données personnelles

## Format de sortie

**Entités** → **Modèle** (tables, colonnes, types, contraintes, relations) → **Politiques RLS par
rôle** → **Index et requêtes justificatives** → **Migration** (étapes + rollback) → **Impacts
code** → **Questions ouvertes** pour `product-owner`.
