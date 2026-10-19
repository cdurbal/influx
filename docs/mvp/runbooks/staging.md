# Exploitation de `staging` — procédure d'agent (D70)

> **Public :** les agents (`integrateur` en tête). **`staging` se comporte exactement comme la
> production** (envois réels, listes Brevo, contacts Apollo, mêmes exigences de démarrage) et **les
> agents l'exploitent eux-mêmes** : variables, réglages et redéploiements Railway, Supabase,
> environnement GitHub `staging`, comptes Brevo et Apollo de `staging`. Décision : `decisions.md`
> D70 ; mécanisme : `02` §12.4 ; plan : `jalons/d70-plan.md`.
>
> **Hors de la portée de l'agent (confirmation du fondateur)** : toute action sur la production,
> lecture comprise ; création ou suppression d'un projet, d'un environnement ou d'un service ;
> remise à zéro de la base de `staging` ; DNS et domaines d'envoi.
>
> **Règles.** Aucun secret dans un fichier du dépôt. Les valeurs de `staging` sont dans
> `apps/api/.env.local` (et ceux des fronts) : passées aux commandes par `--stdin` ou `--env-file`,
> **jamais affichées, recopiées dans une réponse, un document, un commit ou un journal**. Pas de
> capture du *Raw Editor* Railway. Aucun test automatisé ne charge `.env.local` (`16` RG148).
> **Nommage :** `staging` et production portent les mêmes noms (projet `influx`, clés `influx_api` et
> `influx_worker`, services, variables) ; ils se distinguent par le compte et les valeurs, et par
> `INFLUX_ENV`.

## Étapes du fondateur (seules restantes)

| # | Étape | État |
|---|---|---|
| P2 | Domaine d'envoi `influx.cadaero.ovh` authentifié dans le compte Brevo de `staging` (DNS) | Fait le 2026-10-18 |
| P3 | Jeton de projet Railway limité à `staging` dans `RAILWAY_TOKEN` (`.claude/settings.local.json`), session OAuth retirée du poste | Fait le 2026-10-18 |
| P4 | Jeton Supabase | Sans objet : la CLI ne voit que le projet de `staging` |
| P5 | Accès restreint à `staging` | Refusé le 2026-10-18 ; risque D70 (a) accepté |

Toute reprise d'une étape P1 à P5 (jeton expiré, domaine à refaire) revient au fondateur ; le reste
de ce document est exécuté par l'agent.

## 0. Constat avant et après tout changement

```sh
pnpm --filter @influx/api staging:check
```

Il vérifie : `.env.local` vise `staging` (marqueur `influx_staging`, `INFLUX_ENV=staging`) ; les
**noms** des variables Railway de chaque service égalent la liste fermée du §5 ; modes `live` ;
`leads.sync_settings` complets (`05` RG162). Il n'affiche jamais une valeur. Entrée :
`apps/api/.env.local`, dont `INFLUX_STAGING_MIGRATION_URL` (rôle de migration de `staging`, lecture
seule). À lancer avant et après chaque changement ; un KO se traite avant d'aller plus loin.

## 1. Projet Supabase de `staging`

Le projet existe (`influx`, région UE, lié au dépôt). Réglages à retrouver, jamais à recréer :

1. Deux clés secrètes `sb_secret_…` nommées `influx_api` et `influx_worker` (EC-46) ; clés héritées
   `anon` et `service_role` désactivées.
2. Fournisseur Email actif, inscription publique fermée, clés JWT asymétriques ES256.
3. Réglages Auth du dépôt (code à 6 chiffres, 600 s, TOTP…) à chaque changement de
   `supabase/config.toml` (section `[auth]`) :

   ```sh
   pnpm exec supabase link --project-ref <ref-staging>
   INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT=30 INFLUX_LOCAL_AUTH_VERIFY_LIMIT=30 pnpm exec supabase config push
   ```

   Les deux variables valent **30**, la valeur d'un projet hébergé (EC-51).
4. `security_sb_forwarded_for_enabled` (EC-38) : à activer si l'écran la propose, sinon noter
   l'écart pour la production.

**Marqueur d'environnement** (table créée à la main, hors migration, car Supabase refuse
`alter database|role … set`) ; contrôlé par `staging:check`, jamais posé en production :

```sql
create schema influx_staging;
revoke all on schema influx_staging from public;
create table influx_staging.environment_marker (
  environment text primary key check (environment = 'staging')
);
insert into influx_staging.environment_marker values ('staging');
```

Les migrations passent **uniquement** par le job « Migrate staging » : jamais `supabase db push`.

## 2. Mots de passe des rôles de connexion

Après une première exécution de « Migrate staging » (les cinq rôles sont créés par les migrations
`0001`, `0016`, `0136`) :

```sh
pnpm --filter @influx/test-kit staging:role-passwords
```

L'entrée est lue dans `apps/api/.env.local` ; la sortie va dans `.operator-secrets/` (ignoré par
Git, **jamais affichée**, supprimée une fois appliquée). Partie **1** (`alter role … password
'SCRAM-SHA-256$…'`, empreintes seulement) : appliquée à la base de `staging`. Partie **2** (cinq
URL, dont `PRIVACY_DATABASE_URL`) : posée dans Railway à l'étape 5. Relancer le script fait tourner
les cinq mots de passe : réappliquer les deux parties.

## 3. GitHub : environnement `staging`

Environnement `staging` limité à la branche **`main`** (J4S-1), portant le secret
`DIRECT_DATABASE_URL` (rôle `postgres` de `staging`, *Session pooler*, hôte
`…pooler.supabase.com`, port 5432 : la connexion directe est IPv6 seulement) et la **variable**
`STAGING_DATABASE_CA_CERT` (PEM public). Posés par `gh secret set|variable set … --env staging`
depuis `.env.local`, par `--body` lu sur l'entrée standard. `DIRECT_DATABASE_URL` ne va **nulle part
ailleurs** (CI-5). Au push sur `main`, après les contrôles, « Migrate staging » applique les
migrations puis publie les documents publics (`21` EC-62 (C)).

## 4. Suivi d'un push

Après chaque push : `gh run list --limit 5`, `gh run watch <id> --exit-status`, `gh run view <id>
--log-failed`. Un échec se corrige sans attendre ; `gh run rerun --failed` est permis. Enchaînement
attendu : CI verte → « Migrate staging » vert → déploiement des quatre services (« Wait for CI »).

## 5. Railway : quatre services

Services (noms exacts : `web` et `backoffice` joignent `api.railway.internal`) : `api`, `worker`,
`web`, `backoffice`, environnement `staging`, branche `main`. Chaque service : *Root Directory*
vide, « Wait for CI » activé, réglages de build et de déploiement du fichier indiqué saisis à la main
(Railway refuse le config-as-code aux services créés depuis le 2026-08-28) : *Custom Build Command*,
*Watch Paths* (**un motif par ligne**, jamais séparés par des virgules, sinon tout déploiement est
`SKIPPED`), *Custom Start Command*, *Healthcheck Path* et *Timeout*, *Restart Policy*, *Draining*.
`RAILPACK_NODE_VERSION=24` (Node ≥ 24.12, D64).

| Service | Fichier | Domaine public |
|---|---|---|
| `api` | `deploy/railway/api.json` | aucun |
| `worker` | `deploy/railway/worker.json` | aucun |
| `web` | `deploy/railway/web.json` | oui (`*.up.railway.app`) |
| `backoffice` | `deploy/railway/backoffice.json` | oui, distinct de `web` |

**Valeurs de référence.** `INFLUX_ENV=staging` partout (lu à la construction par `web` : `noindex`,
J4S-3). `PORT=3100` sur `api` seulement. `BREVO_MODE=live` sur `api` et `worker`, `SYNC_MODE=live`
sur `worker`, **sans** `BREVO_TEST_RECIPIENTS` ni `NON_PRODUCTION_RECIPIENT_ALLOWLIST` (le code les
refuse). `BREVO_API_BASE_URL=https://api.brevo.com/v3`. Expéditeurs sur `@influx.cadaero.ovh`.
`INFLUX_API_INTERNAL_URL=http://api.railway.internal:3100` sur `web` et `backoffice`, avec la valeur
du secret de leur front. `worker` : sa propre `BREVO_API_KEY` et `APOLLO_API_KEY` (comptes de
`staging`), `PRIVACY_DATABASE_URL` (rôle `influx_privacy_login`). `DATABASE_CA_CERT` (EC-34) sur
`api` et `worker`.

- Secrets de 32 octets : `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`,
  **une valeur différente pour chacun**, sinon `api` refuse de démarrer.
- Poser une variable : `railway variable set NOM --stdin -s <service> -e staging`, valeur lue depuis
  `.env.local` sans affichage. Jamais d'option qui cible `production` (interdite aussi par
  `.claude/settings.json`).
- Les adresses de `staging` ne sont jamais publiées (D56) ; `noindex` sur toutes les réponses du
  backoffice et sur celles de `web` hors production.
- Aucune clé Brevo ni Apollo de production, aucune donnée de production (verrous 1 et 4).

### Liste fermée (D70), contrôlée par `staging:check`

`staging:check` compare les **noms** des variables Railway de chaque service (`-e staging`, variables
`RAILWAY_*` exclues) à ce tableau : une exigée absente ou un nom hors des deux colonnes est un KO. Il
vérifie en outre `INFLUX_ENV=staging` partout, `BREVO_MODE=live` (`api`, `worker`) et
`SYNC_MODE=live` (`worker`). Liste tirée de ce que lit le code (`apps/api/src/config/schema.ts`,
`apps/*/src/config/`) : `BREVO_SENDER_MARKETING` et `BREVO_SENDER_PROSPECTING` n'y sont pas, aucun
code ne les lisant encore.

<!-- staging-check:begin -->
| Service | Exigées | Facultatives |
|---|---|---|
| `api` | `INFLUX_ENV`, `PORT`, `INFLUX_PUBLIC_SITE_URL`, `INFLUX_PUBLIC_BACKOFFICE_URL`, `INFLUX_API_INTERNAL_SECRET_WEB`, `INFLUX_API_INTERNAL_SECRET_BACKOFFICE`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `AUTH_DATABASE_URL`, `OPS_DATABASE_URL`, `DATABASE_CA_CERT`, `BREVO_MODE`, `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_WEBHOOK_PATH_TOKEN_CURRENT`, `BREVO_WEBHOOK_SECRET_CURRENT`, `RAILPACK_NODE_VERSION` | `BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS`, `BREVO_WEBHOOK_SECRET_PREVIOUS` (rotation seulement) |
| `worker` | `INFLUX_ENV`, `WORKER_DATABASE_URL`, `PRIVACY_DATABASE_URL`, `DATABASE_CA_CERT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SYNC_MODE`, `BREVO_MODE`, `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_LIST_ID_ADVERTISERS`, `BREVO_LIST_ID_CREATORS`, `APOLLO_API_KEY`, `RAILPACK_NODE_VERSION` | `BREVO_SUPPRESSION_LIST_ID` |
| `web` | `INFLUX_ENV`, `INFLUX_API_INTERNAL_URL`, `INFLUX_API_INTERNAL_SECRET`, `RAILPACK_NODE_VERSION` | — |
| `backoffice` | `INFLUX_ENV`, `INFLUX_API_INTERNAL_URL`, `INFLUX_API_INTERNAL_SECRET`, `RAILPACK_NODE_VERSION` | — |
<!-- staging-check:end -->

## 6. Constats après déploiement (« Terminé quand » du J4)

1. CI verte → « Migrate staging » vert → quatre services déployés (même `RAILWAY_GIT_COMMIT_SHA`).
2. Journal de démarrage de `api` : la ligne `database pool verified` pour `influx_app`,
   `influx_auth_login` et `influx_ops_login` ; aucune ligne `database pool refused`, aucun
   `Invalid api configuration` / `Invalid worker configuration` (le journal nomme la variable,
   jamais la valeur).
3. **Constat A5 (EC-21)**, depuis le poste :

   ```sh
   for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     -H "content-type: application/json" -H "X-Real-IP: 198.51.100.$i" \
     -H "X-Forwarded-For: 203.0.113.$i" -H "origin: https://<web-staging>" \
     --data '{"email":"constat-a5@example.test","locale":"fr"}' \
     https://<web-staging>/api/v1/auth/request-code; done
   ```

   Chaque réponse est un `200` uniforme ; lire `outcome` (`rate_limited` attendu) : les requêtes
   sont limitées comme une seule adresse, les en-têtes forgés étant ignorés. Consigner dans `21`
   (ligne du J4).
4. En-têtes R7 : `curl -sI https://<web-staging>/fr` et `curl -sI https://<backoffice-staging>/`
   montrent `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`,
   `strict-transport-security`, `content-security-policy: frame-ancestors 'none'…`.
5. Connexion sur `web` avec un compte de démonstration (A4).

## 7. Comptes de démonstration (J3S-2)

Entrées lues dans `apps/api/.env.local` (`--env-file`) : `INFLUX_STAGING_MIGRATION_URL`,
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `INFLUX_PUBLIC_BACKOFFICE_URL` et, si le magasin du système
ne connaît pas le certificat racine (EC-34), `INFLUX_STAGING_DB_CA_FILE` ou `DATABASE_CA_CERT` :

```sh
pnpm --filter @influx/api db:staging-demo-accounts -- \
  --advertiser=<adresse interne 1> --creator=<adresse interne 2> --admin=<adresse interne 3>
pnpm --filter @influx/api db:publish-terms:staging -- --latest
```

Mots de passe et liens d'activation (72 h) sont tirés au hasard et écrits **une seule fois** dans
`.operator-secrets/` (jamais dans la sortie). Le script refuse la production et toute base sans le
marqueur du §1. Il ne crée que les deux membres et le premier `admin` (EC-45) ; tout autre compte
interne passe par l'invitation de cet `admin` au backoffice (`15` RG99). Les codes partent réellement
aux adresses saisies : n'utiliser que des adresses de testeurs internes.

## 8. Compte Brevo de `staging` : webhooks, listes, modèles (J7)

Tout se fait par API, avec les clés de `staging` lues dans `.env.local`, sans affichage.

1. **Variables de `api`** : `BREVO_WEBHOOK_PATH_TOKEN_CURRENT` (43 caractères base64url exactement)
   et `BREVO_WEBHOOK_SECRET_CURRENT` (43 à 128 caractères), générés par la commande du §5, **deux
   valeurs différentes** entre elles et de tous les autres secrets. Un seul des deux présent, ou
   absents, = refus de démarrage. Rotation : procédure B de la skill `env-secrets` (`_PREVIOUS`).
   `worker` : `SUPABASE_URL` et la clé `influx_worker` (jamais celle de `api`). Ces variables ne
   vont pas sur `web` ni `backoffice`.
2. **Webhooks** : un transactionnel et un marketing (Brevo les sépare). URL
   `https://<web-staging>/api/v1/webhooks/brevo/<jeton de chemin>` ; en-tête
   `brevo-webhook-token: <valeur _SECRET_CURRENT>` ; traitement par lots désactivé. Événements =
   `BREVO_WEBHOOK_SUBSCRIPTION` (`packages/contracts/src/brevo-webhook.ts`) : transactionnel
   `hardBounce`, `invalid`, `blocked`, `spam`, `unsubscribed` ; marketing `hardBounce`, `spam`,
   `unsubscribed` ; rien d'autre. Noter tout écart de libellé.
3. **Hôte et IP** avant de brancher : `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H
   "content-type: application/json" -H "origin: https://<web-staging>" --data '{}'
   https://<web-staging>/api/v1/webhooks/brevo/<jeton de chemin>` doit répondre `404` et le journal
   de `api` porter `webhook.brevo.rejected`. Un `webhook.brevo.ip_drift` (jeton valide, IP hors
   plage `1.179.112.0/20` ou `172.246.240.0/20`) : ne pas élargir la constante sans `architecte`.
4. **Listes et attributs** : listes des deux rôles et attributs de `16` §M4, identifiants posés par
   les variables du `worker` `BREVO_LIST_ID_ADVERTISERS` et `BREVO_LIST_ID_CREATORS` (D68, recopiées
   en base au démarrage).
5. **Modèles transactionnels** : bienvenue annonceur et créateur, avis de changement d'adresse
   (`auth.email_changed_notice`, paramètre `LANGUAGE` seul, FR/EN, sans lien ni contenu promotionnel,
   RG86), accusé « mes données ». Identifiants par les variables `BREVO_TEMPLATE_ID_*` du `worker` ;
   à défaut, par SQL sur `leads.sync_settings` (`brevo_template_ids`, `brevo_list_ids`). Un
   identifiant posé ne se remet plus à nul (`05` RG163), seulement se remplace ; un identifiant nul
   donne un échec de configuration alerté (`05` RG160).
6. **Réglages Apollo** : `leads.sync_settings` de `staging` aux valeurs prévues pour la production ;
   tant que D33 n'est pas tranchée, `apollo_prospecting_countries` prend une valeur de travail (pays
   des testeurs), consignée dans `21`.
7. **Preuve du webhook** : une vraie désinscription d'un contact de test donne **exactement une
   ligne** dans `leads.brevo_inbound_events`, le consentement révoqué (source `brevo_webhook`) et
   aucun `webhook.brevo.ip_drift`. Le doublon et la fenêtre de ±15 min sont prouvés par `test:db` :
   aucun rejeu manuel.

`trial:record` ne sert plus à `staging` (les échanges réels s'y constatent) ; il reste pour
`development`, sans `.env.local`.

## 9. Constats de fin de chantier D70

Avec une adresse de testeur interne : inscription marque et inscription créateur reçoivent le code
puis la bienvenue réels ; contact dans la liste Brevo de son rôle ; contact Apollo créé ou écarté
pour un motif de qualification (jamais `skipped_no_credentials`, `skipped_non_production` ni
`dry_run`) ; désinscription Brevo revenue par le webhook ; « mes données » propagée à Brevo et
Apollo ; le `worker` refuse de démarrer quand on retire une variable exigée (constat sur une copie
de configuration locale, **jamais en retirant une variable de Railway**) ; `staging:check` vert.

## 10. Retour à la version précédente (02 §20.7 point 5)

1. Railway › service › Deployments : *Redeploy* du dernier déploiement sain. Attention :
   `railway redeploy -s <service> -e staging` rejoue le commit du **dernier** déploiement, même
   `SKIPPED` ; pour déployer le dernier `main`, `railway redeploy --from-source`. `api` et `worker` partagent le même code : les revenir
   **ensemble**.
2. Une migration n'est **jamais** annulée par un retour de code (migrations additives). Sinon,
   migration corrective, jamais la modification d'une migration appliquée (EC-37).
3. Remettre seulement `BREVO_MODE` / `SYNC_MODE` en `dry_run` ou `disabled` fait **refuser le
   démarrage** (D70) : revenir d'abord au commit précédent, puis aux variables d'avant.
4. Noter l'heure, la version revenue (`RAILWAY_GIT_COMMIT_SHA`) et la cause dans le bilan de rodage ;
   corriger sur `main`.

## 11. Facteur TOTP vérifié mais non épinglé (J3S-3)

Symptôme : un agent ne peut plus s'enrôler, le journal porte `agent.unexpected_mfa_factor` (échec
fermé, voulu).

1. Un **administrateur** vérifie l'identité de l'agent par un autre canal (téléphone).
2. Supabase › Authentication › Users : supprimer le facteur **TOTP** de l'utilisateur.
3. Le jeton d'enrôlement ne se remet pas par invitation (adresse déjà tenue, 0131) : en `staging`,
   inviter une **nouvelle** adresse (reprise par script local en local seulement, jusqu'à MFA-6).
4. Journaliser l'intervention (date, administrateur, agent) dans le registre d'incidents. Cette
   procédure disparaît avec MFA-6.
