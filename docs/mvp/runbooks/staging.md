# Mise en place de `staging` et procédures d'exploitation (jalon J4)

> **Public :** le fondateur (actions sur les comptes) et le développeur (vérifications).
> **Règle :** aucun secret n'est écrit dans un fichier du dépôt ni dans un fichier local. Les
> valeurs vont directement dans Supabase, GitHub ou Railway, ou sont exportées dans le terminal le
> temps d'une commande. Références : `docs/mvp/21-plan-de-developpement.md` §4 J4, `02` §12 et §20,
> skills `railway-deploy` et `env-secrets`.
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

> **Après l'étape 4** : les quatre rôles sont créés par les migrations (`0001`, `0016`) ; la
> partie 1 échoue tant que « Migrate staging » n'a pas tourné une fois.

Sur le poste (rien n'est écrit sur le disque) :

```sh
pnpm --filter @influx/test-kit staging:role-passwords -- --ref=<ref-staging> --host=<région>.pooler.supabase.com
```

- Coller la partie **1** (des `alter role … password 'SCRAM-SHA-256$…'`) dans l'éditeur SQL de
  staging : la base ne reçoit que des empreintes, jamais un mot de passe en clair.
- Garder la partie **2** (quatre URL) pour l'étape 5. Relancer le script fait tourner les quatre
  mots de passe : recoller les deux parties.

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

## Étape 5 — Railway : projet et quatre services

Créer le projet relié au dépôt GitHub, environnement **`staging`**, branche `main`, puis quatre
services (noms exacts : `web` et `backoffice` joignent `api.railway.internal`). Pour chacun :
*Root Directory* vide, **« Wait for CI » activé**, les réglages de build et de déploiement du fichier
indiqué **saisis à la main** (*Custom Build Command*, *Watch Paths*, *Custom Start Command*,
*Healthcheck Path* et *Timeout*, *Restart Policy*, *Draining*) : Railway refuse le config-as-code aux
services créés depuis le 2026-08-28 (abandonné le 2026-12-01 ; passage à son *Infrastructure as Code*
à arbitrer, `integrateur`), variable `RAILPACK_NODE_VERSION=24` (Node ≥ 24.12 en production, D64 ; vérifier la
version dans le journal de construction).

| Service | Fichier | Domaine public | Variables (et rien d'autre) |
|---|---|---|---|
| `api` | `deploy/railway/api.json` | **aucun** | `INFLUX_ENV=staging`, `PORT=3100`, `INFLUX_PUBLIC_SITE_URL`, `INFLUX_PUBLIC_BACKOFFICE_URL`, `INFLUX_API_INTERNAL_SECRET_WEB`, `INFLUX_API_INTERNAL_SECRET_BACKOFFICE`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (clé `influx_api` du projet de staging), `DATABASE_URL`, `AUTH_DATABASE_URL`, `OPS_DATABASE_URL`, `BREVO_MODE=redirect`, `BREVO_API_KEY` (compte Brevo **de staging**), `BREVO_API_BASE_URL=https://api.brevo.com/v3`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_TEST_RECIPIENTS` (vos adresses internes) |
| `worker` | `deploy/railway/worker.json` | **aucun** | `INFLUX_ENV=staging`, `WORKER_DATABASE_URL`, `SYNC_MODE=dry_run`, `BREVO_MODE=disabled` |
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
- Aucune clé Apollo en staging (`skipped_no_credentials`), aucune clé Brevo de production (D62).

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
  --agent=<adresse interne 3> --admin=<adresse interne 4>
unset INFLUX_STAGING_MIGRATION_URL SUPABASE_SECRET_KEY
```

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
3. L'administrateur remet un jeton d'enrôlement (au J8 : invitation ; d'ici là, script des comptes de
   démonstration en staging seulement). L'agent recommence l'activation.
4. Journaliser l'intervention (date, administrateur, agent) dans le registre d'incidents. Cette
   procédure disparaît avec MFA-6 (J8).
