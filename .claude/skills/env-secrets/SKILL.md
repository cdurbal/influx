---
name: env-secrets
description: Ajouter, faire tourner ou documenter une variable d'environnement ou un secret INFLUX (Supabase, Brevo, Apollo.io, Railway, GitHub) — nommage, cloisonnement par environnement, exposition côté client, procédure de rotation et de fuite. À utiliser dès qu'une nouvelle clé ou configuration externe apparaît.
---

# Variables d'environnement et secrets

Une clé qui fuit, c'est la base de contacts exfiltrée ou des e-mails envoyés au nom d'INFLUX.
Une clé mal cloisonnée, c'est un e-mail de test parti vers de vrais clients.

Agents concernés : `integrateur` (principal), `expert-cybersecurite`, `architecte`.

## Règles absolues

1. **Aucun secret dans Git.** `.env*` est ignoré dès le premier commit.
2. **Aucun secret dans un bundle front.** Seules les clés explicitement publiques (clé anonyme
   Supabase) peuvent atteindre le navigateur. Tout ce qui est préfixé pour le client est
   **public par construction** — le vérifier avant de nommer une variable.
3. **La clé `service_role` Supabase ne quitte jamais le serveur.**
4. **Les clés Brevo et Apollo ne quittent jamais le serveur.**
5. **Clés distinctes par environnement.** Jamais la clé de production en `staging`.
6. **Aucun secret dans les journaux**, les messages d'erreur, les tickets ou les captures d'écran.
7. **Toute variable est documentée** avant d'être utilisée.

## Inventaire attendu (à compléter au fil du projet)

| Variable | Service | Exposition | Environnements |
|---|---|---|---|
| URL du projet Supabase | Supabase | Client (publique) | staging, production |
| Clé anonyme Supabase | Supabase | Client (publique) | staging, production |
| Clé `service_role` Supabase | Supabase | **Serveur uniquement** | staging, production |
| Clé API Brevo | Brevo | **Serveur uniquement** | bac à sable / production |
| Clé API Apollo.io | Apollo.io | **Serveur uniquement** | bac à sable / production |
| URL publique de l'API | INFLUX | Client | staging, production |
| Secret de signature des webhooks | INFLUX | **Serveur uniquement** | staging, production |
| Secrets de session / jetons | INFLUX | **Serveur uniquement** | staging, production |

## Ajouter une variable

1. **Classer** : publique (client) ou secrète (serveur). En cas de doute → secrète.
2. **Nommer** en `SCREAMING_SNAKE_CASE`, explicite, préfixé par le service
   (`BREVO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
3. **Documenter** dans le fichier d'exemple versionné (`.env.example`) : nom, rôle, format
   attendu, **valeur factice** — jamais la vraie valeur.
4. **Renseigner** aux trois endroits utiles :
   - Local : `.env` (ignoré par Git)
   - CI : GitHub Secrets
   - Exécution : variables Railway, **par environnement**
5. **Valider au démarrage de l'application** : si une variable requise manque, l'application
   échoue immédiatement avec un message clair, plutôt que de tomber en panne plus tard.
6. **Vérifier l'absence de fuite** : pas de valeur en clair dans les journaux, pas d'inclusion
   involontaire dans le bundle front.
7. **Signaler au fondateur** toute variable qu'il doit obtenir lui-même (création de compte,
   génération de clé) — cf. §14 de `CLAUDE.md`.

## Faire tourner une clé

Rotation à effectuer : périodiquement, au départ d'un intervenant, et **immédiatement en cas de
suspicion de fuite**.

1. Générer la nouvelle clé côté service (Supabase / Brevo / Apollo).
2. Renseigner la nouvelle valeur en `staging`, vérifier le bon fonctionnement.
3. Renseigner en production, redéployer si nécessaire.
4. **Révoquer l'ancienne clé** — étape la plus souvent oubliée, et la seule qui protège réellement.
5. Vérifier les journaux pour détecter d'éventuels usages résiduels.
6. Consigner la rotation (date, motif, qui).

## En cas de fuite avérée

Traiter comme un incident, dans cet ordre :

1. **Révoquer immédiatement** la clé compromise — avant même de comprendre l'origine.
2. Générer et déployer une clé de remplacement.
3. Évaluer l'exposition : quelles données accessibles, quelles actions possibles, sur quelle période.
4. Examiner les journaux du service concerné pour repérer un usage anormal.
5. Purger la donnée de l'historique Git si elle y a été commitée (réécriture d'historique, avec
   l'accord du fondateur car elle affecte tous les clones).
6. Alerter `expert-cybersecurite` et, si des données personnelles sont concernées,
   `expert-conformite-rgpd` — une violation de données peut exiger une notification à l'autorité
   de contrôle dans un délai contraint.
7. Documenter : cause, impact, correctif, mesure de prévention.

## Checklist

- [ ] Variable classée publique ou secrète, nommée correctement
- [ ] Documentée dans `.env.example` avec une valeur factice
- [ ] Renseignée en local, en CI et dans Railway, **par environnement**
- [ ] Clés distinctes entre `staging` et `production`
- [ ] Validation au démarrage en place
- [ ] Aucune valeur en clair dans les journaux ou le bundle front
- [ ] `.gitignore` couvre bien `.env*`
- [ ] Action requise du fondateur signalée explicitement
