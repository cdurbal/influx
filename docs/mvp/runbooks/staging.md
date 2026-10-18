# Mise en place de `staging` et procédures d'exploitation (jalon J4)

> **D70 (2026-10-18) — à lire d'abord.** `staging` se comporte **exactement comme la production**
> (envois réels, listes Brevo, contacts Apollo, mêmes exigences de démarrage) et **les agents IA
> l'exploitent eux-mêmes** : variables, réglages et redéploiements Railway, Supabase, environnement
> GitHub `staging`, comptes Brevo et Apollo de `staging`. Les étapes ci-dessous marquées « fondateur »
> sont exécutées par l'agent (`integrateur`), sauf : création ou suppression d'un projet, d'un
> environnement ou d'un service ; DNS et domaines d'envoi ; remise à zéro de la base. **Jamais la
> production.** Les valeurs de `staging` sont dans `apps/api/.env.local` (et ceux des fronts) : un
> agent les passe aux commandes par `--stdin` ou `--env-file`, sans jamais les afficher ni les
> recopier. Bascule et réécriture complète de ce runbook : `jalons/d70-plan.md` (commits 4 et 5).
> **Tant que le commit 1 de ce plan n'est pas déployé, le code refuse `live` hors production :
> les variables d'envoi de l'étape 5 restent celles d'aujourd'hui.**
>
> **Public :** les agents (exploitation de `staging`) et le fondateur (comptes, DNS, production).
> **Règle :** aucun secret dans un fichier du dépôt. Hors `apps/*/.env.local` (valeurs de
> `staging`, D70), aucun fichier local ne porte de secret ; aucune valeur n'est recopiée dans une
> réponse, un document, un commit ou un journal. Références : `docs/mvp/21-plan-de-developpement.md`
> §4 J4, `02` §12 et §20, skills `railway-deploy` et `env-secrets`.
> **Nommage :** staging et production portent **les mêmes noms** (projet `influx`, clés `influx_api`
> et `influx_worker`, services, variables). Ils se distinguent par le **compte** (Supabase, Brevo,
> Apollo dédiés à staging) et les **valeurs** des clés ; seule `INFLUX_ENV` change de valeur.

## Étape 1 — Projet Supabase (compte de staging)

1. Dans le **compte Supabase de staging**, créer le projet **`influx`**, **région UE** (Paris ou Francfort). *La région ne se change
   plus après création.*
2. *Project Settings › API Keys* : créer **deux clés secrètes** `sb_secret_…`, nommées
   `influx_api` et `influx_worker` (EC-46). Désactiver les clés héritées `anon` et
   `service_role`, et la clé *publishable* si l'écran le permet (G-1 point 4).
3. *Authentication › Sign In / Providers* : fournisseur **Email** actif, **inscription publique
   fermée** (« Allow new users to sign up » désactivé). *JWT Keys* : passer aux clés asymétriques
   **ES256**.
4. Réglages Auth du dépôt (code à 6 chiffres, 600 s, TOTP…) — depuis le poste, une seule fois puis à
   chaque changement de `supabase/config.toml` (section `[auth]`) :

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-staging>
   INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT=30 INFLUX_LOCAL_AUTH_VERIFY_LIMIT=30 pnpm exec supabase config push
   ```

   Les deux variables valent **30**, la valeur d'un projet hébergé (EC-51) : jamais les valeurs
   relevées de la pile locale.
5. Option `security_sb_forwarded_for_enabled` (EC-38) : à activer dans les réglages Auth si
   l'écran la propose ; sinon, la noter comme écart pour la mise en production.

## Étape 2 — Marqueur d'environnement

Dans l'éditeur SQL de **staging uniquement** (Supabase refuse les paramètres personnalisés
`alter database|role … set`, d'où une table créée à la main, hors de toute migration) :

```sql
create schema influx_staging;
revoke all on schema influx_staging from public;
create table influx_staging.environment_marker (
  environment text primary key check (environment = 'staging')
);
insert into influx_staging.environment_marker values ('staging');
```

Ce marqueur autorise le script des comptes de démonstration (étape 7). Il n'est **jamais** posé sur
la base de production.

## Étape 3 — Mots de passe des quatre rôles de connexion

> **Après l'étape 4** : les cinq rôles sont créés par les migrations (`0001`, `0016`, `0136` au J8) ; la
> partie 1 échoue tant que « Migrate staging » n'a pas tourné une fois.

Sur le poste (rien n'est écrit sur le disque) :

```sh
pnpm --filter @influx/test-kit staging:role-passwords -- --ref=<ref-staging> --host=<région>.pooler.supabase.com
```

- Coller la partie **1** (des `alter role … password 'SCRAM-SHA-256$…'`) dans l'éditeur SQL de
  staging : la base ne reçoit que des empreintes, jamais un mot de passe en clair.
- Garder la partie **2** (cinq URL, dont `PRIVACY_DATABASE_URL` depuis le J8) pour l'étape 5. Relancer
  le script fait tourner les cinq mots de passe : recoller les deux parties.

## Étape 4 — GitHub : environnement `staging`

*Settings › Environments › New environment* `staging`, puis le secret **`DIRECT_DATABASE_URL`** :
la chaîne du rôle `postgres` de staging en **Session pooler** (*Connect › Session pooler*,
hôte `…pooler.supabase.com`, port 5432) : la *Direct connection* n'est joignable qu'en IPv6, que
les exécuteurs GitHub n'ont pas. Elle ne va **nulle part ailleurs** : ni Railway, ni fichier local (CI-5).

Dans le même écran, **Deployment branches and tags** : limiter l'environnement à la seule branche
**`main`** (et, si l'offre le permet, exiger un relecteur) : une branche ou une Pull Request ne
peut alors jamais lire ce secret (J4S-1).

Au prochain push sur `main`, le job **« Migrate staging »** applique les migrations après les
contrôles. Tant que le secret est absent, le job affiche un avis et ne fait rien.

Puis il publie les documents publics (`21` EC-62 (C)) : pour chaque document et langue, la dernière
entrée de `apps/api/legal/published.json` (texte rempli si elle a été publiée sans). Déclarer dans
l'environnement la **variable** (pas un secret) `STAGING_DATABASE_CA_CERT`, le PEM public de l'étape 5.

## Étape 5 — Railway : projet et quatre services

Créer le projet relié au dépôt GitHub, environnement **`staging`**, branche `main`, puis quatre
services (noms exacts : `web` et `backoffice` joignent `api.railway.internal`). Pour chacun :
*Root Directory* vide, **« Wait for CI » activé**, les réglages de build et de déploiement du fichier
indiqué **saisis à la main** (*Custom Build Command*, *Watch Paths*, *Custom Start Command*,
*Healthcheck Path* et *Timeout*, *Restart Policy*, *Draining*) : Railway refuse le config-as-code aux
services créés depuis le 2026-08-28 (abandonné le 2026-12-01 ; passage à son *Infrastructure as Code*
à arbitrer, `integrateur`) ; les *Watch Paths* se saisissent **un motif par ligne**, jamais en
une chaîne séparée par des virgules (sinon tout déploiement est `SKIPPED`), variable `RAILPACK_NODE_VERSION=24` (Node ≥ 24.12 en production, D64 ; vérifier la
version dans le journal de construction).

| Service | Fichier | Domaine public | Variables (et rien d'autre) |
|---|---|---|---|
| `api` | `deploy/railway/api.json` | **aucun** | `INFLUX_ENV=staging`, `PORT=3100`, `INFLUX_PUBLIC_SITE_URL`, `INFLUX_PUBLIC_BACKOFFICE_URL`, `INFLUX_API_INTERNAL_SECRET_WEB`, `INFLUX_API_INTERNAL_SECRET_BACKOFFICE`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (clé `influx_api` du projet de staging), `DATABASE_URL`, `AUTH_DATABASE_URL`, `OPS_DATABASE_URL`, `BREVO_MODE=redirect`, `BREVO_API_KEY` (compte Brevo **de staging**), `BREVO_API_BASE_URL=https://api.brevo.com/v3`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_TEST_RECIPIENTS` (vos adresses internes) |
| `worker` | `deploy/railway/worker.json` | **aucun** | `INFLUX_ENV=staging`, `WORKER_DATABASE_URL`, `PRIVACY_DATABASE_URL` (J8 : exécution des demandes « mes données », rôle `influx_privacy_login` du script ci-dessus), `SYNC_MODE=dry_run`, `BREVO_MODE=disabled` |
| `web` | `deploy/railway/web.json` | oui (`*.up.railway.app` en attendant les domaines) | `INFLUX_ENV=staging` (lu à la construction : `noindex` hors production, J4S-3), `INFLUX_API_INTERNAL_URL=http://api.railway.internal:3100`, `INFLUX_API_INTERNAL_SECRET` (= la valeur web) |
| `backoffice` | `deploy/railway/backoffice.json` | oui, distinct de `web` | `INFLUX_ENV=staging`, `INFLUX_API_INTERNAL_URL` (idem), `INFLUX_API_INTERNAL_SECRET` (= la valeur backoffice) |

- Les secrets de 32 octets se génèrent avec
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` : **une
  valeur différente pour chacun**, sinon l'API refuse de démarrer.
- `DATABASE_CA_CERT` (EC-34) : **nécessaire** sur `api` et `worker` (sinon `SELF_SIGNED_CERT_IN_CHAIN`) ;
  y coller le contenu PEM du certificat racine de *Database › SSL configuration*, qui est public.
- `staging` n'est jamais indexé : `noindex` sur toutes les réponses du backoffice, et sur celles de
  `web` hors production ; ne pas publier les adresses (le domaine de production n'est jamais
  utilisé, D56).
- Aucune variable `PORT` hors `api` : Railway fournit la sienne à `web` et `backoffice`.
- Ne jamais faire de capture du *Raw Editor* : il affiche les secrets en clair.
- Aucune clé Brevo ni Apollo de production en staging (verrou 1). *Cible D70, après le commit 1
  de `jalons/d70-plan.md`* : `api` en `BREVO_MODE=live` sans `BREVO_TEST_RECIPIENTS` ; `worker` en
  `SYNC_MODE=live` et `BREVO_MODE=live`, avec sa propre `BREVO_API_KEY`, `APOLLO_API_KEY` (compte
  Apollo de `staging`), les expéditeurs du domaine d'envoi de `staging`, `BREVO_LIST_ID_*`,
  `BREVO_WEBHOOK_*` sur `api`, sans `NON_PRODUCTION_RECIPIENT_ALLOWLIST` ni `BREVO_TEST_RECIPIENTS`.
  Les colonnes ci-dessus (`redirect`, `dry_run`, `disabled`) décrivent l'état d'avant la bascule.

## Étape 6 — Vérifications du développeur (« Terminé quand » du J4)

1. Un commit sur `main` : CI verte → « Migrate staging » vert → déploiement des quatre services.
2. `session_user` à travers Supavisor (V3) : dans le journal de démarrage de `api`, la ligne
   `database pool verified` pour `influx_app`, `influx_auth_login` et `influx_ops_login` ; aucune
   ligne `database pool refused`.
3. **Constat A5 (EC-21)** : depuis un poste extérieur,

   ```sh
   for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     -H "content-type: application/json" -H "X-Real-IP: 198.51.100.$i" \
     -H "X-Forwarded-For: 203.0.113.$i" -H "origin: https://<web-staging>" \
     --data '{"email":"constat-a5@example.test","locale":"fr"}' \
     https://<web-staging>/api/v1/auth/request-code; done
   ```

   Chaque réponse est un `200` uniforme : lire le champ `outcome` (`rate_limited` attendu).
   Les requêtes doivent être limitées **comme une seule adresse** (celle du poste) : les en-têtes
   forgés sont ignorés. Consigner le résultat dans `21` (ligne du J4).
4. En-têtes R7 : `curl -sI https://<web-staging>/fr` et `curl -sI https://<backoffice-staging>/`
   montrent `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`,
   `strict-transport-security`, `content-security-policy: frame-ancestors 'none'…`.
5. Écriture depuis le navigateur (A4) : se connecter sur `web` avec un compte de démonstration.

## Étape 7 — Comptes de démonstration de staging (J3S-2)

Variables **exportées dans le terminal**, jamais écrites dans un fichier :

```sh
export INFLUX_STAGING_MIGRATION_URL='<chaîne Session pooler de l’étape 4>'
export INFLUX_STAGING_DB_CA_FILE="$HOME/Downloads/prod-ca-2021.crt"  # certificat racine (EC-34)
export SUPABASE_URL='https://<ref-staging>.supabase.co'
export SUPABASE_SECRET_KEY='<une clé sb_secret_ de staging>'
export STAGING_PUBLIC_BACKOFFICE_URL='https://<backoffice-staging>'
pnpm --filter @influx/api db:staging-demo-accounts -- \
  --advertiser=<adresse interne 1> --creator=<adresse interne 2> \
  --admin=<adresse interne 3>
unset INFLUX_STAGING_MIGRATION_URL SUPABASE_SECRET_KEY
```

- **Depuis le J8 (EC-45)** : le script ne crée plus que les deux membres et le **premier `admin`**
  (amorçage). Tout autre compte interne (commercial, second `admin`) est créé par **invitation** de
  cet `admin` depuis le backoffice (`15` RG99 : 72 h, liée à l'adresse ; un `admin` invité exige la
  double validation). Le lien d'activation s'affiche une seule fois : le transmettre à la personne
  par un canal direct.

- Les adresses des deux membres doivent figurer dans `BREVO_TEST_RECIPIENTS` du service `api`
  (les codes y sont envoyés).
- Mots de passe et liens d'activation (72 h) sont **tirés au hasard et affichés une seule fois** :
  les ranger aussitôt dans le gestionnaire de mots de passe. Le script refuse la production et toute
  base sans le marqueur de l'étape 2.
- Ne transmettre à personne que la première ligne de la sortie : la suite contient des secrets.

## Procédure — Retour à la version précédente (02 §20.7 point 5)

À décider dès qu'une mise en ligne provoque une régression (alerte, erreurs nouvelles, parcours
cassé) :

1. **Railway › service concerné › Deployments** : sur le dernier déploiement sain, *Redeploy*.
   Faire de même pour chaque service touché par le commit fautif (`api` et `worker` partagent le
   même code : les revenir **ensemble**).
2. **Base de données** : une migration n'est **jamais** annulée par un retour de code. Les
   migrations sont additives : l'ancien code fonctionne avec le nouveau schéma. Si ce n'est pas le
   cas, écrire une migration corrective (jamais modifier une migration appliquée, contrôle EC-37).
3. Noter l'heure, la version revenue (`RAILWAY_GIT_COMMIT_SHA`) et la cause dans le bilan de rodage.
4. Corriger sur `main` ; le déploiement suivant repart normalement de la CI.

## Procédure — Facteur TOTP vérifié mais non épinglé (J3S-3)

Symptôme : un agent ne peut plus s'enrôler, le journal porte `agent.unexpected_mfa_factor`
(la base est tombée entre la vérification chez GoTrue et l'épinglage ; échec fermé, voulu).

1. Un **administrateur** vérifie l'identité de l'agent par un autre canal (téléphone).
2. *Supabase › Authentication › Users* : ouvrir l'utilisateur, supprimer son facteur **TOTP**.
3. Le compte existe déjà : son jeton d'enrôlement ne se remet pas par invitation (adresse déjà
   tenue, 0131). Jusqu'à MFA-6 (réinitialisation du second facteur, Lot 5), reprendre le jeton par
   le script local en local seulement ; en `staging`, inviter une **nouvelle** adresse.
4. Journaliser l'intervention (date, administrateur, agent) dans le registre d'incidents. Cette
   procédure disparaît avec MFA-6 (J8).

## J7 — Configuration de `staging` du commit 10 (webhook Brevo, purge GoTrue, avis de changement d'adresse)

> *Révisé le 2026-10-18 (D70)* : les actions de cette section sont **faites par l'agent** sur
> `staging`, sans confirmation, avec les comptes de `staging` ; seule la production attend le
> fondateur. Aucune valeur de secret n'est écrite ici : elle va dans Railway ou dans Brevo depuis
> `apps/api/.env.local` ou un générateur, sans être affichée (pas de capture du *Raw Editor*). Le
> point 6 (`trial:record`) est rendu caduc par la bascule de `staging` en `live` (`jalons/d70-plan.md`
> commit 3).

### Variables introduites ou rendues obligatoires par le J7

| Variable | Service | Secrète | Production | Génération / source | Absente |
|---|---|---|---|---|---|
| `BREVO_WEBHOOK_PATH_TOKEN_CURRENT` | `api` seul (refusée au démarrage du `worker` sur Railway) | oui (routage) | **requise** | 43 car. base64url exactement : `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` | Webhook fermé (toute requête = route inconnue) ; refus de démarrage en production |
| `BREVO_WEBHOOK_SECRET_CURRENT` | `api` seul | oui (authentification de l'en-tête) | **requise** | 43 à 128 car. base64url, même commande, **valeur différente** | idem ; un seul des deux `_CURRENT` présent = refus de démarrage |
| `…_PATH_TOKEN_PREVIOUS`, `…_SECRET_PREVIOUS` | `api` seul | oui | non | **Rotation seulement** (procédure B de la skill `env-secrets`) ; exige le `_CURRENT`, diffère de lui | rien (cas normal) |
| `SUPABASE_URL` | `worker` (déjà sur `api`) | non | **requise** (https) | Origine du projet Supabase de staging, celle de `api` | Avec la clé seule : refus de démarrage. Les deux absentes en staging : la purge des utilisateurs GoTrue orphelins ne tourne jamais, sans bruit |
| `SUPABASE_SECRET_KEY` | `worker` (déjà sur `api`) | **oui** | **requise** | Clé `sb_secret_…` **`influx_worker`** (étape 1), jamais celle de `api` | idem ; une clé héritée (JWT) est refusée |

Constats : le relais `web` ne demande **aucune variable nouvelle** (l'en-tête `brevo-webhook-token` est
dans la liste blanche, `x-real-ip` est écrit par Railway) ; `REAUTHENTICATION_FRESHNESS_SECONDS` n'est
**pas** une variable d'environnement (constante de 300 s) ; `BREVO_IP_ALLOWLIST` n'existe plus (plages en
constante datée). Les quatre valeurs du webhook diffèrent entre elles et de tous les autres secrets de `api`.
Après le J7 : `api` reçoit les deux `_CURRENT` ; `worker` reçoit `SUPABASE_URL` + `SUPABASE_SECRET_KEY` ;
`web` et `backoffice` ne changent pas.

Pour que l'avis de changement d'adresse **parte réellement** en staging, le `worker` doit sortir du mode
actuel (`SYNC_MODE=dry_run` n'appelle jamais Brevo) : `SYNC_MODE=live` avec
`NON_PRODUCTION_RECIPIENT_ALLOWLIST` (domaines), `BREVO_MODE=redirect`, `BREVO_TEST_RECIPIENTS`, une
`BREVO_API_KEY` **propre au worker** (compte Brevo de test) et `BREVO_SENDER_TRANSACTIONAL`. Décision du
fondateur : sans elle, on constate seulement `leads.dry_run.would_send`.

### Actions du fondateur, dans l'ordre (toutes distantes, confirmation du fondateur)

1. **Précondition : mettre `staging` à jour.** I-4 est rouge sur `main` (commits J7 non attestés, plus
   ceux du J5 nommés dans la fiche) : « Migrate staging » ne tourne pas et Railway (« Wait for CI »)
   n'a pas déployé le J7. `staging` exécute le code d'avant le J7, sans les migrations `0115` à `0128`.
   Ordre : revue groupée de fin de jalon (`expert-cybersecurite` + `testeur`) → commit d'attestation →
   CI verte (`gh run list --limit 5`) → « Migrate staging » vert → les quatre services redéployés
   (Railway › Deployments, même `RAILWAY_GIT_COMMIT_SHA`). **Aucune variable ci-dessous avant.**
2. **Variables Railway de `staging`** : `api` (les deux `_CURRENT`, valeurs distinctes, rangées dans le
   gestionnaire de mots de passe) ; `worker` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY` de la clé
   `influx_worker`, puis, si décidé, les variables d'envoi ci-dessus). Après redémarrage, aucun
   `Invalid api configuration` / `Invalid worker configuration` dans le journal (il nomme la variable,
   jamais la valeur).
3. **Vérifier l'hôte `web` de staging et `x-real-ip`** avant de brancher Brevo :
   `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" -H "origin: https://<web-staging>" --data '{}' https://<web-staging>/api/v1/webhooks/brevo/<jeton de chemin>`
   doit répondre `404` (adresse hors plage Brevo) et le journal de `api` porte `webhook.brevo.rejected`
   (motif fermé) : la route est atteinte. La preuve finale est l'étape 4 : un événement de Brevo accepté
   (`200`) montre que l'adresse vue par `api` est bien celle de Brevo (`1.179.112.0/20` ou
   `172.246.240.0/20`). Si le journal montre `webhook.brevo.ip_drift` (jeton valide, IP hors plage) :
   plages changées ou en-tête réécrit par un intermédiaire ; ne pas élargir la constante sans `architecte`.
4. **Webhook dans le compte Brevo de TEST (D62, jamais celui de production)** : un webhook
   *transactionnel* et un webhook *marketing* (Brevo les sépare). URL
   `https://<web-staging>/api/v1/webhooks/brevo/<jeton de chemin>` ; en-tête personnalisé
   `brevo-webhook-token: <valeur _SECRET_CURRENT>` saisi directement dans Brevo ; **traitement par lots
   désactivé**. Événements = `BREVO_WEBHOOK_SUBSCRIPTION` (`packages/contracts/src/brevo-webhook.ts`) :
   transactionnel `hardBounce`, `invalid`, `blocked`, `spam`, `unsubscribed` ; marketing `hardBounce`,
   `spam`, `unsubscribed` ; rien d'autre. Les libellés exacts des écrans Brevo ne sont pas vérifiables
   depuis le dépôt : noter tout écart. Envoyer l'événement de test de Brevo, puis lire
   `leads.brevo_inbound_events` (lecture seule, éditeur SQL de staging).
5. **Modèle Brevo de l'avis (EC-8, commit 10)** : créer dans le compte de test le modèle transactionnel
   de `auth.email_changed_notice` (paramètre `LANGUAGE` seul, FR/EN, sans lien ni contenu promotionnel,
   RG86), noter son identifiant numérique, puis, dans l'éditeur SQL de **staging** (rôle `postgres`) :
   `update leads.sync_settings set value = jsonb_set(value, '{auth.email_changed_notice}', '<id>') where key = 'brevo_template_ids';`
   Tant que l'id est nul, la ligne est `skipped` (`template_not_configured`), sans erreur. Faire de même
   pour les deux modèles de bienvenue s'ils ne le sont pas (J6). La forme est contrôlée en base (`0103`).
   *Ajouté le 2026-10-17 (D67, tranchée) :* poser aussi les **identifiants des listes du compte de
   test** et ceux de **tous** les modèles de `brevo_template_ids` (bienvenue annonceur et créateur,
   avis, accusé « mes données »). Voie privilégiée (D68) : les variables du service `worker`
   `BREVO_LIST_ID_ADVERTISERS`, `BREVO_LIST_ID_CREATORS`, `BREVO_TEMPLATE_ID_WELCOME_ADVERTISER`,
   `BREVO_TEMPLATE_ID_WELCOME_CREATOR`, `BREVO_TEMPLATE_ID_EMAIL_CHANGED_NOTICE`, recopiées en base au
   démarrage. Les identifiants sans variable se posent par SQL
   (`update leads.sync_settings set value = '{"advertisers": <id>, "creators": <id>}' where key = 'brevo_list_ids';`). Dès la livraison de D67, un identifiant nul ne donne plus un `skipped` mais
   un **échec de configuration**, alerté (`05` RG160), y compris en `staging` : la trace
   `leads.dry_run.would_send` reste écrite, puis la ligne échoue (`05` RG164). Une inscription de
   test correcte finit `succeeded` avec `dry_run`. Aucun appel n'en découle (`SYNC_MODE=dry_run`,
   `BREVO_MODE=disabled`, `02` §12.4 inchangé). Un identifiant posé ne pourra plus être remis à nul
   (`05` RG163) : seulement remplacé.
6. **Enregistrer les échanges réels** (`pnpm --filter @influx/api trial:record <mode>`), **sur le
   poste**, jamais sur Railway ni en CI (refus) : comptes de TEST dans le fichier local d'environnement,
   `BREVO_MODE=redirect`, base locale (refus sinon). Les modes `probes` et `worker` (Ctrl+C pour finir)
   restent ceux du J6. Puis, dans l'ordre :
   - [ ] `… reconciliation` : les deux lectures du rapprochement (E-4), une fois chacune, 10 lignes au
         plus, 24 dernières heures ; aucune connexion à la base.
   - [ ] `… inbound [--port=N] [--minutes=30] [--max-bodies=20]` (écoute `127.0.0.1` seul ; affiche une
         seule fois le jeton de chemin et le jeton d'en-tête, ne les recopier nulle part), puis dans un
         second terminal `cloudflared tunnel --url http://127.0.0.1:<port>` (*quick tunnel* seulement :
         ni ngrok, ni tunnel lié à un compte).
   - [ ] Compte Brevo de **TEST** : créer un **second webhook temporaire** (un par famille si l'on
         déclenche transactionnel et marketing), URL `<tunnel>/<jeton de chemin>`, en-tête
         `brevo-webhook-token: <jeton d'en-tête>`, lots désactivés.
   - [ ] Déclencher sur des contacts de test : désinscription, *hard bounce*, plainte (spam) si possible.
   - [ ] **Supprimer ce webhook temporaire**, arrêter le tunnel (Ctrl+C) ; le récepteur s'arrête seul
         (durée, nombre de corps) ou par Ctrl+C.
   - [ ] `… redact` : refuse d'écrire `redacted.json` s'il reste une adresse hors `example.test`, une URL,
         une IP ou une chaîne brute de 6 caractères ou plus (hors valeurs d'énumération connues).
   - [ ] Remettre `redacted.json` à Claude pour les fixtures (`INBOUND_EXEMPLARS`, `CONTACTS_LISTED`,
         `SMTP_EVENTS_LISTED` de `packages/test-kit/src/brevo-exchanges.ts`).
   - [ ] Fixtures écrites : **supprimer `apps/api/.provider-recordings/raw.jsonl`** (rappelé par `redact`).

   Le `worker` de staging reste en `dry_run` sans clé Brevo (D62) : l'avis de changement d'adresse est
   constaté dans l'essai du poste (`trial:record worker`), pas en staging.
   Preuve du webhook en staging : une vraie désinscription Brevo d'un contact de TEST, webhook de staging
   en place, donne exactement une ligne dans `leads.brevo_inbound_events`, le consentement révoqué avec
   la source `brevo_webhook`, et aucun `webhook.brevo.ip_drift`. Le doublon et la fenêtre de ±15 min sont
   prouvés par `test:db` : aucun rejeu manuel (veto `expert-cybersecurite`).

### Retour arrière

Retirer les variables ajoutées (staging revient à « webhook fermé », purge GoTrue inactive) et supprimer
les webhooks du compte Brevo de test. Le code n'est pas à revenir : les migrations sont additives
(procédure « Retour à la version précédente »). Rotation d'un jeton : procédure B de la skill
`env-secrets` (`_PREVIOUS` = ancienne valeur, nouvelle valeur saisie dans Brevo, puis retrait).
