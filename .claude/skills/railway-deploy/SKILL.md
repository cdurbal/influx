---
name: railway-deploy
description: Configurer un service, un environnement ou un déploiement Railway pour INFLUX, et diagnostiquer un déploiement en échec. À utiliser pour toute mise en ligne, création d'environnement, configuration de variables de déploiement ou incident de production.
---

# Déploiement Railway

Railway héberge l'API et les applications front d'INFLUX. Objectif : des déploiements
reproductibles, traçables et réversibles.

Agents concernés : `integrateur` (principal), `architecte`, `expert-cybersecurite`.

## ⚠️ Avant toute action

- **Le compte Railway n'est pas encore créé** (cf. §14 de `CLAUDE.md`).
- **Aucune ressource externe n'est créée, ni aucun déploiement en production lancé, sans
  confirmation explicite du fondateur.**
- Ce document prépare et documente ; il n'autorise pas l'exécution autonome.

## Topologie cible

```
  GitHub (main)
       │
       ▼
  ┌──────────────────────────────┐
  │  Railway — environnement     │
  │  STAGING                     │  déploiement automatique depuis main
  │  · API Node.js               │  clés de bac à sable Brevo / Apollo
  │  · Front(s) React            │  projet Supabase de test
  └──────────────┬───────────────┘
                 │  validation fonctionnelle
                 ▼  promotion manuelle
  ┌──────────────────────────────┐
  │  Railway — environnement     │
  │  PRODUCTION                  │  déploiement sur validation du fondateur
  │  · API Node.js               │  clés réelles Brevo / Apollo
  │  · Front(s) React            │  projet Supabase de production
  └──────────────────────────────┘
```

Le nombre exact de services dépend des décisions **D3** (monorepo vs multi-repo) et **D12**
(backoffice séparé ou intégré) — à trancher par `architecte` avant configuration définitive.

## Règles non négociables

1. **Deux environnements minimum**, strictement cloisonnés : `staging` et `production`.
2. **Clés API distinctes par environnement.** Jamais la clé Brevo ou Apollo de production en
   `staging` : un e-mail ou une séquence commerciale partie vers de vrais contacts depuis un
   environnement de test est un **incident business**.
3. **Projets Supabase distincts** par environnement. Aucune donnée personnelle réelle en
   `staging` (exigence RGPD).
4. **Aucun secret dans le dépôt.** Les variables vivent dans Railway (exécution) et GitHub
   Secrets (CI). Cf. skill `env-secrets`.
5. **Déploiement traçable** : quel commit, par qui, quand, vers quel environnement.
6. **Rollback connu avant déploiement.** On ne met rien en ligne sans savoir le défaire.
7. **Les migrations de base sont ordonnées avec le déploiement applicatif** : jamais de migration
   destructive simultanée à une bascule de code (procéder en étapes).
8. **La production ne se déploie pas sans validation explicite du fondateur.**

## Configurer un nouveau service

1. Déterminer avec `architecte` s'il s'agit d'un service distinct ou d'une application existante.
2. Définir la commande de build et la commande de démarrage.
3. Lister **toutes** les variables d'environnement nécessaires, par environnement
   (skill `env-secrets`).
4. Définir un point de contrôle de santé (endpoint de *health check*) et le brancher.
5. Configurer le domaine et le HTTPS le cas échéant.
6. Vérifier les journaux au premier démarrage.
7. **Documenter** la configuration dans le dépôt : un réglage qui n'existe que dans l'interface
   Railway est perdu à la première rotation d'équipe.

## Déployer

1. [ ] CI verte sur `main` (typecheck, lint, tests, build)
2. [ ] Migrations de base préparées, ordonnées et réversibles si possible
3. [ ] Variables d'environnement à jour dans l'environnement cible
4. [ ] Déploiement en `staging` d'abord, systématiquement
5. [ ] Vérification fonctionnelle en `staging` sur les parcours critiques
6. [ ] Validation explicite du fondateur pour la production
7. [ ] Déploiement en production
8. [ ] Vérification post-déploiement : santé du service, journaux, parcours d'inscription,
      synchronisation des leads
9. [ ] Consigner : commit déployé, date, contenu du lot

## Vérifications post-déploiement propres à INFLUX

- [ ] L'inscription fonctionne pour les deux profils
- [ ] La synchronisation vers Brevo et Apollo repart (file d'attente vidée, pas d'accumulation)
- [ ] Le backoffice est accessible aux seuls comptes autorisés
- [ ] Les montants et la commission s'affichent correctement sur un contrat témoin
- [ ] Aucun secret dans les journaux

## Diagnostiquer un déploiement en échec

| Symptôme | Pistes |
|---|---|
| Échec au build | Version de Node, dépendances manquantes, erreur TypeScript non détectée en CI |
| Démarrage puis arrêt immédiat | Variable d'environnement manquante, port non lu depuis l'environnement, échec de connexion Supabase |
| Service accessible mais erreurs 500 | Clés API invalides, migration non appliquée, permissions Supabase |
| Front déployé mais appels API en échec | URL d'API erronée par environnement, CORS trop restrictif ou mal configuré |
| Leads non synchronisés | Clé Brevo/Apollo absente ou invalide, file bloquée, quota dépassé |

Méthode : lire les journaux **avant** de modifier quoi que ce soit ; comparer avec
l'environnement qui fonctionne ; changer **une seule chose à la fois**.

## Rollback

1. Identifier le dernier déploiement sain.
2. Vérifier la compatibilité des migrations déjà appliquées avec le code cible — une migration
   destructive peut rendre le rollback applicatif impossible : c'est pourquoi on les évite dans
   la même bascule.
3. Redéployer la version saine.
4. Vérifier les parcours critiques.
5. Documenter l'incident : cause, impact, correctif, prévention.

## Checklist de mise en place initiale (à valider par le fondateur)

- [ ] Compte Railway créé
- [ ] Projet INFLUX créé, environnements `staging` et `production`
- [ ] Dépôt GitHub connecté, déploiement automatique sur `staging` depuis `main`
- [ ] Variables d'environnement renseignées par environnement
- [ ] Domaines et HTTPS configurés
- [ ] Contrôles de santé actifs
- [ ] Procédure de rollback testée au moins une fois
