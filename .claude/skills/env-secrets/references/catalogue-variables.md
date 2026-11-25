# Catalogue des variables (lire pour : nommer, placer ou valider une variable)

Colonnes : services Railway porteurs (`web`, `backoffice`, `api`, `worker`), exposition, différence
`staging` / `production`. Sources : `02` §12.3 (plateforme), `16` §M8 (Brevo).

**Liste fermée de `staging`, par service, contrôlée par `staging:check`** : `docs/mvp/runbooks/staging.md`
§5 (« Liste fermée (D70) »). Elle fait foi pour les **noms** exigés ; ce catalogue donne le **sens** de
chaque variable. En cas d'écart, le runbook et `apps/api/src/config/schema.ts` l'emportent : corriger ici.

## Plateforme INFLUX

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `INFLUX_ENV` (`staging` \| `production`) | web · backoffice · api · worker | Publique | La valeur **est** la distinction. Lue au démarrage, immuable, journalisée |
| `INFLUX_PUBLIC_SITE_URL`, `INFLUX_PUBLIC_BACKOFFICE_URL` | api · worker (site : aussi web) | Publique | Hôtes distincts |
| `INFLUX_API_INTERNAL_URL` | web · backoffice · worker | **Interne** (réseau privé Railway) | `apps/api` **n'a aucun hôte public** : pas d'« URL publique de l'API » |
| `INFLUX_API_INTERNAL_SECRET_WEB`, `INFLUX_API_INTERNAL_SECRET_BACKOFFICE` (D64) | api | **Secrètes** | Un secret interne par front, liant `/v1/bo/…` au backoffice ; valeurs distinctes entre elles et des autres secrets |
| `INFLUX_API_INTERNAL_SECRET` (D64) | web · backoffice | **Secrète**, **seule** valeur sensible d'un front : prouve l'appel interne, ne donne accès à aucun service tiers | Valeur de `_WEB` sur `web`, de `_BACKOFFICE` sur `backoffice` |
| `AUTH_TOKEN_SIGNING_SECRET` (ex-`SESSION_COOKIE_SECRET`, EC-24) | api | **Secrète**, ≥ 32 octets | Valeurs distinctes. Signe les seuls jetons courts (cookie de parcours, jeton d'inscription), **jamais l'identifiant de session**. Refus de démarrage si égale à un autre secret du processus. Rotation = parcours de connexion en cours perdus (15 à 30 min), sessions intactes |
| `AUTH_THROTTLE_PEPPER` | api | **Secrète**, ≥ 32 octets | Valeurs distinctes. Clé HMAC des empreintes de limitation de débit, de l'adresse pseudonyme transmise à GoTrue et de l'anti-rejeu TOTP (étiquettes distinctes). Rotation = compteurs remis à zéro |

## Supabase — aucune de ces variables n'atteint le navigateur

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `SUPABASE_URL` | api · worker (purge E-4) | **Serveur uniquement** | **Deux projets Supabase distincts**, jamais deux schémas d'un même projet (`02` §12.2) |
| `SUPABASE_SECRET_KEY` : clé d'API HTTP (ex-`SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_…`), à ne pas confondre avec le rôle Postgres `service_role`, **utilisé nulle part** | api · worker (purge E-4) | **Secrète, jamais dans un bundle.** Usage limité à **GoTrue (Auth)** et aux **URL signées du Storage**, **jamais pour atteindre une table** | **Une clé par projet et par service** (`influx-api`, `influx-worker`), révocable séparément (EC-46) ; clés héritées `anon` / `service_role` désactivées |

`SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_JWKS_URL` sont **retirées** (EC-46) : INFLUX ne vérifie aucun
JWT, tout appel à GoTrue porte la clé secrète. Sur les projets hébergés, la clé *publishable* est
désactivée si la plateforme le permet (`21` G-1).

## Base de données

**Un rôle de connexion par rôle élevé, une variable par rôle de connexion, un service par variable**
(EC-1, EC-20). Chaque rôle de connexion est `LOGIN NOINHERIT`, membre de son seul rôle cible
`WITH INHERIT FALSE, SET TRUE` : hors d'une transaction qui a pris ce rôle par `SET LOCAL ROLE`, il n'a
aucun droit. Aucun ne porte `BYPASSRLS` ni `SUPERUSER`.

| Variable | Porteurs | Rôle de connexion → rôle cible |
|---|---|---|
| `DATABASE_URL` | **api seul** | `influx_app`, membre des **quatre rôles métier seuls** ; ni propriétaire, ni `BYPASSRLS`, ni `SUPERUSER`, **ni membre d'un rôle élevé**. Unique droit propre : `identity.resolve_session()` |
| `AUTH_DATABASE_URL` | **api seul** | `influx_auth_login` → `influx_auth` seul : E-1, E-2 (code de connexion) |
| `WORKER_DATABASE_URL` | **worker seul** | `influx_worker_login` → `influx_worker` seul : E-3, E-4. Ni `DATABASE_URL` ni `AUTH_DATABASE_URL` sur le worker |
| `OPS_DATABASE_URL` | **api seul** | `influx_ops_login` → `influx_ops`, écriture seule du schéma `ops` (D60, E-6) |
| `PRIVACY_DATABASE_URL` | **worker seul** | `influx_privacy_login` → `influx_privacy` seul : E-5 (demandes « mes données » approuvées par un `admin`). **Jamais** ajouté à `influx_worker_login`. Obligatoire en production (`21` §5.8) |
| `DIRECT_DATABASE_URL` | **aucun service d'exécution** | Rôle de migration, **propriétaire des objets**. **GitHub Secrets de l'environnement seulement**, jamais une variable Railway (CI-5) |

Format des URL d'exécution : utilisateur `<rôle>.<référence du projet>`, port **6543** (multiplexeur,
mode transaction), **TLS obligatoire** avec vérification du certificat (`DATABASE_CA_CERT`). En pile
locale : connexion directe, sans suffixe.

**Refus de démarrage** (EC-20, `expert-cybersecurite`) :
1. l'utilisateur de chaque URL (avant le `.`) est **exactement** le rôle de connexion attendu ;
2. deux URL d'un même processus ne partagent jamais le même utilisateur ;
3. à l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont
   vérifiés **en base** ;
4. sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent), une variable de base réservée à un autre service
   fait échouer le démarrage (`DATABASE_URL` ou `AUTH_DATABASE_URL` sur `worker`,
   `WORKER_DATABASE_URL` sur `api`). En local, `apps/api/.env.local` porte les trois.

> **Non négociable.** Un rôle propriétaire ou `BYPASSRLS` dans `DATABASE_URL` annulerait toute la RLS
> en silence. Vérifié par le test T4 (`03` §8).

## Brevo — variables de `16` §M8

Toutes **serveur uniquement** (`apps/api`, services `api` et `worker`) ; aucune clé Brevo ne quitte le
serveur (`16` RG8). Le service `api` envoie le code de connexion (D43) et reçoit le webhook (EC-12).

| Service | Variables |
|---|---|
| `api` | `BREVO_API_KEY` (**clé propre à `api`**), `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL` ; `BREVO_WEBHOOK_SECRET_CURRENT`/`_PREVIOUS`, `BREVO_WEBHOOK_PATH_TOKEN_CURRENT`/`_PREVIOUS` (**`api` seul**, refusées au démarrage du `worker` sur Railway) |
| `worker` | `BREVO_API_KEY` (**clé propre au `worker`**), `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_SENDER_MARKETING`, `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID` ; `BREVO_LIST_ID_*` (D68 ; `BREVO_TEMPLATE_ID_*` retirées et refusées, D69) ; **jamais** les secrets du webhook |

Deux clés Brevo distinctes par environnement (révocation séparée, usage attribuable). Les verrous du
garde-fou s'appliquent **aux deux services**. Le processus HTTP n'appelle que l'envoi transactionnel
unitaire (garde statique).

| Variable | Rôle | `staging` vs `production` |
|---|---|---|
| `BREVO_API_KEY` | Clé d'accès | Production : clé de production, **en production seule**. `staging` : clé du **compte Brevo de `staging`** (D70), aussi dans `.env.local`. Tests et CI : aucune (doublure). Rotation : `rotation-et-fuite.md` |
| `BREVO_API_BASE_URL` | Adresse de base | Permet de pointer la **doublure de test** hors environnement déployé (`16` RG148) |
| `BREVO_MODE` (`disabled` \| `redirect` \| `live`) | Mode d'envoi | `live` en `staging` et en production (D70) ; `disabled`/`redirect` réservés à la pile locale et aux tests |
| `BREVO_TEST_RECIPIENTS` | Liste **fermée** d'adresses internes | **Obligatoire si `redirect`** ; substitution au dernier moment, journalisée (RG117) ; pile locale et tests ; refusée en `staging` |
| `BREVO_WEBHOOK_SECRET_CURRENT` / `_PREVIOUS` | Jeton de l'en-tête `brevo-webhook-token` (43 à 128 car. base64url) | `api` seul ; **requis en production** et en `staging` (D70, mêmes exigences). `_PREVIOUS` **seulement pendant la rotation** (RG146-1). Comparaison en temps constant ; valeurs toutes distinctes entre elles et des autres secrets |
| `BREVO_WEBHOOK_PATH_TOKEN_CURRENT` / `_PREVIOUS` | Segment non devinable du chemin (43 car. base64url) | `api` seul, roté **avec** le jeton d'en-tête. Routage seulement (Railway journalise les chemins), jamais publié |
| ~~`BREVO_IP_ALLOWLIST`~~ | — | **Supprimée** : plages `1.179.112.0/20` et `172.246.240.0/20` en constante datée de `apps/api/src/domains/leads/brevo-webhook.ts` ; dérive surveillée par `webhook.brevo.ip_drift` |
| `BREVO_SENDER_TRANSACTIONAL` / `_MARKETING` / `_PROSPECTING` | Expéditeurs des trois flux | Sous-domaines dédiés `tx.` / `news.` / `pro.` (RG9) ; `PROSPECTING` : **production uniquement** |
| `BREVO_SUPPRESSION_LIST_ID` | Liste d'exclusion jointe à tout envoi de source 2 | RG45 |
| `BREVO_LIST_ID_ADVERTISERS`, `BREVO_LIST_ID_CREATORS` | Listes écrites dans `leads.sync_settings` au démarrage du `worker` (non secrets) | D68/D69 : une variable renseignée l'emporte sur une valeur posée par SQL ; absente, la base reste inchangée ; refus de démarrage si la base refuse. Identifiants **du compte Brevo de l'environnement** |

> **Brevo ne signe pas ses webhooks** (`16` RG146). Trois protections cumulatives (jeton d'en-tête,
> jeton de chemin, plages d'IP) remplacent une signature : **en retirer une est un affaiblissement**,
> soumis au veto d'`expert-cybersecurite`.

## Apollo.io et pipeline de leads

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `APOLLO_API_KEY` | worker | **Secrète** | `staging` : clé du **compte Apollo de `staging`** (D70, contre `03` §6.8), aussi dans `.env.local` ; production : clé de production, après D33. Tests et CI : aucune (doublure). Une clé de production hors production est un incident |
| `SYNC_MODE` (`live` \| `dry_run`) | worker | Garde-fou | `live` en `staging` et en production (D70) ; `dry_run` réservé à la pile locale et aux tests. Lu au démarrage, **immuable à l'exécution**, journalisé |
| `NON_PRODUCTION_RECIPIENT_ALLOWLIST` | worker | Garde-fou | Condition **positive** évaluée au connecteur, après tout le mappage. Pile locale et tests seulement, refusée en `staging` |
