---
name: env-secrets
description: Ajouter, faire tourner ou documenter une variable d'environnement ou un secret INFLUX (Supabase, base de données, Brevo, Apollo.io, Railway, GitHub) — nommage, cloisonnement par environnement, exposition côté client, garde-fou d'environnement, procédure de rotation et de fuite. À utiliser dès qu'une nouvelle clé ou configuration externe apparaît.
---

# Variables d'environnement et secrets

Une clé qui fuit, c'est la base de contacts exfiltrée ou des e-mails envoyés au nom d'INFLUX.
Une clé mal cloisonnée, c'est un e-mail de test parti vers de vrais clients.

Agents concernés : `integrateur` (principal), `expert-cybersecurite` (**veto**), `architecte`.

> **Révision du 2026-09-19.** Cette skill est alignée sur les décisions D5, D12, D18 et D37
> (`docs/mvp/02-architecture-3-espaces.md` §2, §5, §12), sur l'avis de `expert-cybersecurite`
> (`docs/mvp/03-matrice-des-droits-et-rls.md` §6.8 et §8) et sur le contrat d'interface Brevo
> (`docs/mvp/16-backoffice-emails-brevo.md` §J et §M).
>
> **Trois corrections de fond par rapport à la version précédente :**
>
> | # | Ce qui était écrit | Ce qui est corrigé |
> |---|---|---|
> | **1** | L'URL du projet Supabase et la **clé anonyme** étaient classées « Client (publique) » | **Faux depuis D5/D12.** Le front ne parle jamais à Supabase et **ne porte aucune clé Supabase, pas même `anon`**. Les deux sont **serveur uniquement**, détenues par `apps/api` |
> | **2** | Une seule « clé API Brevo » | **Onze variables** Brevo (`16` §M8), dont le mode d'envoi, la liste de redirection, les trois expéditeurs et les secrets du webhook |
> | **3** | La rotation se vérifiait « en `staging` » | **Impossible pour Brevo et Apollo** : cela reviendrait à poser une clé de production en `staging`, ce que la règle 6 interdit et que `16` RG115/RG120 traitent comme un **incident**. Deux procédures de rotation distinctes, §« Faire tourner une clé » |
>
> **Révision du 2026-09-26** (`docs/mvp/21-plan-de-developpement.md` §3, EC-1, EC-20 et EC-23 ;
> `03` §4 P7, « Les rôles Postgres — liste fermée », fait foi). **`ELEVATED_DATABASE_URL`
> disparaît** : une variable par rôle de connexion, un service par variable (`DATABASE_URL` et
> `AUTH_DATABASE_URL` sur `api`, `WORKER_DATABASE_URL` seule sur `worker`), avec leurs refus de
> démarrage. `influx_service` n'existe pas. Fichiers locaux précisés (étape 4 de « Ajouter une
> variable »).
>
> **Révision du 2026-09-27** (`21` §3, EC-19, EC-24 et EC-46, tranchés par `expert-cybersecurite`).
> `SESSION_COOKIE_SECRET` devient **`AUTH_TOKEN_SIGNING_SECRET`** (l'identifiant de session, opaque,
> n'est jamais signé) ; `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_JWKS_URL` **disparaissent** ;
> **une clé secrète Supabase et une clé Brevo distinctes par service** (`api`, `worker`) ; porteurs
> des variables Brevo précisés (le service `api` envoie le code de connexion et reçoit le webhook).

---

## Règles absolues

1. **Aucun secret dans Git.** `.env*` est ignoré dès le premier commit, sauf `.env.example`, qui ne
   contient que des **valeurs factices**.
2. **Aucune variable `SUPABASE_*` n'atteint jamais un navigateur.** Ni `SUPABASE_URL`, ni
   `SUPABASE_PUBLISHABLE_KEY`, ni a fortiori `SUPABASE_SECRET_KEY`. **Aucune d'elles n'est jamais
   préfixée `NEXT_PUBLIC_`.** C'est la traduction en variables de la règle d'architecture n° 1
   (`CLAUDE.md` §6, `02` §2.1) : *le front ne parle jamais à Supabase pour de la donnée métier et ne
   porte aucune clé Supabase, pas même `anon`.*
   **Pourquoi la clé `anon` n'est pas « inoffensive » ici :** elle ouvre PostgREST au navigateur, et
   la seule chose qui empêche alors de lire des données est la RLS table par table — or tout notre
   dispositif d'anonymisation (A2, D16) repose précisément sur le fait que **le navigateur n'écrit
   jamais la requête**, garantie que la présence de cette clé côté client annulerait le jour où
   quelqu'un placerait par mégarde une table métier dans un schéma exposé.
3. **Aucun secret dans un bundle front.** Tout ce qui est préfixé pour le client est **public par
   construction** — le vérifier *avant* de nommer une variable. Les seules valeurs autorisées côté
   navigateur sont des valeurs publiques d'affichage (`INFLUX_ENV`, `INFLUX_PUBLIC_SITE_URL`).
4. **Les deux fronts ne détiennent aucun secret, et ne lisent `process.env` que dans
   `src/config/`** — règle ESLint, plus l'interdiction d'importer `@supabase/*`, `drizzle-orm`, `pg`
   et `postgres` dans `apps/web` et `apps/backoffice` (`02` §13.2).
5. **Les clés de service (Supabase `service_role`, Brevo, Apollo) ne quittent jamais le serveur**,
   c'est-à-dire le paquet `apps/api` (services Railway `api` et `worker`).
6. **Clés distinctes par environnement, sans exception.** La clé de production **n'existe nulle part
   ailleurs qu'en production** : ni en `staging`, ni dans un fichier local, ni dans une variable de
   compilation, ni dans un journal, ni dans un ticket (`16` RG115).
   **Poste de développement (D62, 2026-09-25)** : il peut porter les clés de **comptes Brevo et
   Apollo de test**, ouverts spécialement à cet effet et distincts des comptes de production, dans
   `apps/api/.env.local` (ignoré par Git), jamais en CI ni dans un service Railway. Conditions :
   `16` RG115 pour Brevo, ligne `APOLLO_API_KEY` ci-dessous pour Apollo. Local = `.env.local` et non
   `.env`, que la maquette de la branche `demo` charge automatiquement.
7. **Aucune donnée de production dans `staging`** (verrou 4, `03` §6.8, B9). `staging` est alimenté
   **exclusivement** par `supabase/seed`.
8. **Aucun secret dans les journaux**, les messages d'erreur, les tickets ou les captures d'écran.
   Pas non plus d'adresse e-mail complète ni de corps de message dans les journaux.
9. **Validation au démarrage.** Une variable requise manquante ou incohérente fait **échouer le
   démarrage** avec un message clair (schéma zod), jamais un avertissement.
10. **Toute variable est documentée** dans `.env.example` **avant** d'être utilisée.

---

## Inventaire des variables

Colonnes : quels services Railway la portent (`web`, `backoffice`, `api`, `worker`), son exposition,
et ce qui la distingue entre `staging` et `production`.
Source de vérité : `02` §12.3 pour la plateforme, `16` §M8 pour Brevo.

### Plateforme INFLUX

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `INFLUX_ENV` (`staging` \| `production`) | web · backoffice · api · worker | Publique | La valeur **est** la distinction. Lue au démarrage, immuable, journalisée |
| `INFLUX_PUBLIC_SITE_URL` | web · api · worker | Publique | Hôtes distincts |
| `INFLUX_API_INTERNAL_URL` | web · backoffice | **Interne** — réseau privé Railway | `apps/api` **n'a aucun hôte public** : il n'existe pas d'« URL publique de l'API » |
| `AUTH_TOKEN_SIGNING_SECRET` (*remplace `SESSION_COOKIE_SECRET`, EC-24*) | api | **Secrète**, ≥ 32 octets | Valeurs distinctes. Signe les seuls jetons courts (cookie de parcours, jeton d'inscription) ; **jamais l'identifiant de session**. Refus de démarrage si elle égale un autre secret du processus. Rotation = parcours de connexion en cours perdus (15 à 30 min), sessions intactes |
| `AUTH_THROTTLE_PEPPER` | api | **Secrète**, ≥ 32 octets | Valeurs distinctes. Clé HMAC des empreintes de limitation de débit, de l'adresse pseudonyme transmise à GoTrue et de l'anti-rejeu TOTP (étiquettes de séparation distinctes). Rotation = compteurs remis à zéro |

### Supabase — **aucune de ces variables n'atteint le navigateur**

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `SUPABASE_URL` | api · worker (J7, purge E-4 seulement ; requise en production avec `SUPABASE_SECRET_KEY`) | **Serveur uniquement** | **Deux projets Supabase distincts**, jamais deux schémas d'un même projet (`02` §12.2) |
| ~~`SUPABASE_PUBLISHABLE_KEY`~~, ~~`SUPABASE_JWKS_URL`~~ | — | **Retirées le 2026-09-27** (EC-46) : tout appel à GoTrue porte la clé secrète, INFLUX ne vérifie aucun JWT | Sur les projets hébergés, la clé *publishable* est **désactivée** si la plateforme le permet (`21` G-1) : aucun composant d'INFLUX ne l'utilise |
| `SUPABASE_SECRET_KEY` — **clé d'API HTTP** (ex-`SUPABASE_SERVICE_ROLE_KEY`, renommée le 2026-09-25 pour suivre les « secret keys » `sb_secret_…` de Supabase), à ne pas confondre avec le rôle Postgres `service_role`, **qui n'est utilisé nulle part** | api (J3) · worker (J6, purge E-4 seulement) | **Secrète, jamais dans un bundle.** Usage limité à **GoTrue (Auth)** et aux **URL signées du Storage**. **Jamais pour atteindre une table** | **Une clé par projet et par service** (`influx-api`, `influx-worker`), révocable séparément (EC-46) ; clés héritées `anon` / `service_role` désactivées |

### Base de données

| Variable | Porteurs | Exposition | Remarque |
|---|---|---|---|
**Un rôle de connexion par rôle élevé, une variable par rôle de connexion, un service par
variable** (EC-1, EC-20, 2026-09-26). Chaque rôle de connexion est `LOGIN NOINHERIT`, membre de son
seul rôle cible `WITH INHERIT FALSE, SET TRUE` : hors d'une transaction qui a pris ce rôle par
`SET LOCAL ROLE`, il n'a aucun droit. Aucun ne porte `BYPASSRLS` ni `SUPERUSER`. Les rôles cibles ont
des `GRANT` et des politiques nommés table par table.

| Variable | Porteurs | Exposition | Remarque |
|---|---|---|---|
| `DATABASE_URL` | **api uniquement** | **Secrète** | Multiplexeur, rôle de connexion **`influx_app`**, membre des **quatre rôles métier seuls** ; ni propriétaire, ni `BYPASSRLS`, ni `SUPERUSER`, **ni membre d'un rôle élevé**. Unique droit propre : `identity.resolve_session()` |
| `AUTH_DATABASE_URL` | **api uniquement** | **Secrète** | Multiplexeur, rôle de connexion **`influx_auth_login`**, membre d'`influx_auth` **seul** : opérations E-1 et E-2 (code de connexion) |
| `WORKER_DATABASE_URL` | **worker uniquement** | **Secrète** | Multiplexeur, rôle de connexion **`influx_worker_login`**, membre d'`influx_worker` **seul** : opérations E-3 et E-4. **Seule variable de base du worker** : ni `DATABASE_URL` ni `AUTH_DATABASE_URL` |
| `OPS_DATABASE_URL` — *au J4* | **api uniquement** | **Secrète** | Rôle de connexion **`influx_ops_login`** → `influx_ops`, écriture seule du schéma `ops` (D60 ; entrée E-6 à signer avec sa migration) |
| `PRIVACY_DATABASE_URL` — *au Lot 5* | **worker uniquement** | **Secrète** | Rôle de connexion **`influx_privacy_login`** → `influx_privacy` : opération E-5. **Jamais** ajouté au rôle de connexion du worker |
| `DIRECT_DATABASE_URL` | **aucun service d'exécution** | **Secrète — CI uniquement** | Rôle de migration, **propriétaire des objets**. Vit dans les GitHub Secrets de l'environnement concerné et **jamais** dans une variable Railway (CI-5) |

Format commun des URL d'exécution : utilisateur `<rôle>.<référence du projet>`, port **6543**
(multiplexeur en mode transaction), **TLS obligatoire** avec vérification du certificat. En pile
locale, la connexion est directe, sans suffixe.

**Refus de démarrage** (ligne EC-20 de `21` §3, tranchée par `expert-cybersecurite`) :

1. l'utilisateur de chaque URL (avant le `.` du multiplexeur) doit être **exactement** le rôle de
   connexion attendu pour cette variable ;
2. deux URL d'un même processus ne partagent jamais le même utilisateur ;
3. à l'ouverture de chaque grappe, `current_user` et l'absence de `rolsuper` / `rolbypassrls` sont
   vérifiés **en base** ;
4. sur Railway (`RAILWAY_ENVIRONMENT_NAME` présent), la présence d'une variable de base réservée à
   un autre service fait échouer le démarrage — par exemple `DATABASE_URL` ou `AUTH_DATABASE_URL`
   sur `worker`, `WORKER_DATABASE_URL` sur `api`. En local, `apps/api/.env.local` porte les trois
   variables, puisque les deux processus lisent le même fichier.

> **Règle non négociable.** Un rôle propriétaire ou `BYPASSRLS` placé dans `DATABASE_URL`
> **annulerait toute la RLS en silence**, sans le moindre symptôme. Vérifié par le test T4 de
> `03` §8 : aucun rôle d'exécution ne porte `rolbypassrls` ni `rolsuper`.

### Brevo — les onze variables de `16` §M8

Toutes sont **serveur uniquement**, dans le paquet `apps/api` (services `api` et `worker`).
**Aucune clé Brevo ne quitte le serveur** (`16` RG8).

**Porteurs** (*EC-19, tranché le 2026-09-27*) — le service `api` envoie lui-même le code de connexion
(D43) et reçoit le webhook (EC-12) :

| Service | Variables |
|---|---|
| `api` | `BREVO_API_KEY` (**clé propre à `api`**), `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL` (J3) ; `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN`, `BREVO_IP_ALLOWLIST` (J7, **`api` seul**) |
| `worker` | `BREVO_API_KEY` (**clé propre au `worker`**), `BREVO_API_BASE_URL`, `BREVO_MODE`, `BREVO_TEST_RECIPIENTS`, `BREVO_SENDER_TRANSACTIONAL`, `BREVO_SENDER_MARKETING`, `BREVO_SENDER_PROSPECTING`, `BREVO_SUPPRESSION_LIST_ID` (J6) ; **jamais** les secrets du webhook |

Deux clés Brevo distinctes par environnement : révocation séparée, usage attribuable dans les
journaux de Brevo. Les verrous du garde-fou s'appliquent **aux deux services**. Le code servi par le
processus HTTP n'appelle que l'envoi transactionnel unitaire (garde statique).

| Variable | Rôle | Portée | `staging` vs `production` |
|---|---|---|---|
| `BREVO_API_KEY` | Clé d'accès | **Production uniquement** pour la clé de production | Rotation planifiée, **deux clés acceptées pendant la bascule**. Hors production : au plus la clé d'un **compte Brevo de test distinct**, et rien du tout si `BREVO_MODE=disabled`. **Poste de développement : clé du compte de test admise** (D62), aux conditions de `16` RG115 — sans donnée réelle, jamais en `live`, sans aucun des sous-domaines de production |
| `BREVO_API_BASE_URL` | Adresse de base | Tous | Permet de pointer la **doublure de test** hors production (`16` RG148) |
| `BREVO_MODE` (`disabled` \| `redirect` \| `live`) | Mode d'envoi | Tous | **`live` refusé hors production** — refus de démarrage, pas un avertissement (RG116). `disabled` est la valeur par défaut partout ailleurs |
| `BREVO_TEST_RECIPIENTS` | Liste **fermée** d'adresses internes | Hors production | **Obligatoire si `redirect`** ; substitution au dernier moment, journalisée (RG117) |
| `BREVO_WEBHOOK_SECRET` | Jeton de l'en-tête personnalisé | Tous | **Deux valeurs acceptées pendant la rotation** (RG146-1). Comparaison en temps constant |
| `BREVO_WEBHOOK_PATH_TOKEN` | Segment non devinable du chemin | Tous | Roté **avec** le jeton. Jamais publié, chemin `noindex` |
| `BREVO_IP_ALLOWLIST` | Plages d'adresses autorisées | Tous | **Surveillée** : une évolution des plages Brevo non répercutée coupe les retours (désinscriptions perdues) |
| `BREVO_SENDER_TRANSACTIONAL` | Expéditeur du flux transactionnel | Tous | Sous-domaine dédié `tx.` (RG9) |
| `BREVO_SENDER_MARKETING` | Expéditeur du flux marketing | Tous | Sous-domaine dédié `news.` |
| `BREVO_SENDER_PROSPECTING` | Expéditeur du flux prospection | **Production uniquement** | Sous-domaine dédié `pro.` |
| `BREVO_SUPPRESSION_LIST_ID` | Liste d'exclusion jointe à tout envoi de source 2 | Tous | RG45 |

> **Brevo ne signe pas ses webhooks** (constat vérifié le 2026-09-19, `16` RG146). C'est pourquoi
> trois variables — jeton d'en-tête, jeton de chemin, liste d'adresses IP — remplacent une
> signature. **Elles sont cumulatives : en retirer une n'est pas une simplification, c'est un
> affaiblissement**, et l'écart est soumis au veto d'`expert-cybersecurite`.

### Apollo.io et pipeline de leads

| Variable | Porteurs | Exposition | `staging` vs `production` |
|---|---|---|---|
| `APOLLO_API_KEY` | worker | **Secrète** | **Aucune clé Apollo en `staging`** — recommandation d'`expert-cybersecurite` (`03` §6.8) : le connecteur passe alors en `skipped_no_credentials`. Une clé absente ne peut pas être confondue avec une autre. **Poste de développement : clé d'un compte Apollo de test distinct admise** (D62), à conditions cumulatives : aucune donnée de personne réelle, ni importée ni obtenue par enrichissement ; aucune boîte d'envoi connectée ni séquence active sur le compte de test ; `SYNC_MODE=dry_run` par défaut, `live` seulement avec `NON_PRODUCTION_RECIPIENT_ALLOWLIST` (verrou 3) ; jamais en CI ni dans un service Railway |
| `SYNC_MODE` (`live` \| `dry_run`) | worker | Garde-fou | `dry_run` en `staging`, `live` en production. Lu au démarrage, **immuable à l'exécution**, journalisé |
| `NON_PRODUCTION_RECIPIENT_ALLOWLIST` | worker | Garde-fou | Condition **positive** évaluée au connecteur, après tout le mappage |

---

## Ajouter une variable

1. **Classer** : publique (client) ou secrète (serveur). En cas de doute → secrète.
   **Toute variable `SUPABASE_*`, `*DATABASE_URL`, `BREVO_*`, `APOLLO_*` est serveur, sans
   discussion.**
2. **Nommer** en `SCREAMING_SNAKE_CASE`, explicite, préfixé par le service
   (`BREVO_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`). **N'utiliser `NEXT_PUBLIC_` que pour une
   valeur qu'on accepterait de publier sur la page d'accueil.**
3. **Documenter** dans `.env.example` : nom, rôle, format attendu, service porteur, **valeur
   factice** — jamais la vraie valeur.
4. **Renseigner** aux trois endroits utiles, **par environnement** :
   - Local (*révisé le 2026-09-26, EC-23* ; fichiers ignorés par Git, **jamais `.env`**, que la
     maquette de la branche `demo` charge automatiquement) :
     - `apps/api/.env.local` — **pile locale** (valeurs de `supabase status`, mots de passe des
       rôles posés par le script local) et, seul, les clés des comptes Brevo et Apollo **de test**
       (D62) ; lu par `pnpm dev` et `pnpm dev:worker` ;
     - `apps/api/.env.staging.local` — valeurs de `staging`, pour les vérifications ponctuelles
       (script `dev:staging`) ; il reproduit le service Railway `staging` : **aucune clé Brevo ni
       Apollo**, **jamais `DIRECT_DATABASE_URL`** (CI seule, CI-5) ;
     - `apps/<front>/.env.local` — chargé nativement par Next.js ; **aucun secret** (règle 4) ;
     - le code ne lit jamais de fichier : `src/config/` ne lit que `process.env`, le fichier est
       chargé par Node dans les seuls scripts de développement ;
   - CI : GitHub Secrets — **c'est le seul endroit de `DIRECT_DATABASE_URL`** ;
   - Exécution : variables Railway, **du seul service qui en a besoin**. Une variable posée « au cas
     où » sur les quatre services est une fuite en attente.
5. **Valider au démarrage** (zod) : variable manquante → échec immédiat, message clair.
6. **Brancher les contrôles de CI** ci-dessous.
7. **Signaler au fondateur** toute variable qu'il doit obtenir lui-même (création de compte,
   génération de clé, enregistrement DNS) — cf. `CLAUDE.md` §14.3.

### Contrôles de CI obligatoires — le build échoue, il n'avertit pas

| # | Contrôle | Ce qu'il empêche |
|---|---|---|
| **CI-1** | **Aucune variable `SUPABASE_*` exposée au client.** Échec du build si une variable dont le nom commence par `SUPABASE_` est préfixée `NEXT_PUBLIC_`, référencée hors de `apps/api`, ou lue hors de `src/config/` dans un front | La reclassification silencieuse de la clé `anon` en « valeur publique inoffensive » |
| **CI-2** | **Analyse des artefacts de construction** de `apps/web` et `apps/backoffice` : aucune occurrence de `SUPABASE_` (URL de projet comprise), `BREVO_`, `APOLLO_`, `SERVICE_ROLE`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER`, `DATABASE_URL`, ni d'aucune chaîne ressemblant à un JWT ou à une chaîne de connexion Postgres | La fuite par empaquetage : la variable lue au mauvais endroit se retrouve dans le bundle (`03` §8, T11, **étendu ici à tout préfixe `SUPABASE_`**) |
| **CI-3** | **Analyse de secrets** sur le dépôt **et son historique**, `.env*` ignoré vérifié | Le secret commité puis « retiré » au commit suivant |
| **CI-4** | **Aucun rôle d'exécution avec `rolbypassrls` ni `rolsuper`** (`03` §8, T4) | La RLS annulée en silence par une chaîne de connexion trop puissante |
| **CI-5** | **`DIRECT_DATABASE_URL` absente de toute configuration de service Railway** | Le rôle propriétaire du schéma joignable depuis un processus qui sert des requêtes |
| **CI-6** | **Les quatre verrous du garde-fou `staging`**, chacun testé séparément, plus le refus de démarrage en production avec `dry_run` / hors production avec `live` (`03` §8, T17) | L'e-mail réel parti d'un environnement de test |

---

## Faire tourner une clé

Rotation à effectuer : périodiquement, au départ d'un intervenant, et **immédiatement en cas de
suspicion de fuite**.

**Il y a deux procédures, et prendre la mauvaise est une faute.** Le critère est simple :

> **La clé a-t-elle un effet de bord observable par un tiers ?**
> Si l'utiliser peut envoyer un e-mail, écrire dans un CRM ou contacter une personne réelle,
> **elle ne se teste jamais en `staging`** : poser la clé de production en `staging` viole la règle
> absolue 6 et constitue un **incident** au sens de `16` RG115/RG120.

| Service / clé | Effet de bord tiers | Procédure |
|---|---|---|
| `BREVO_API_KEY`, `BREVO_SENDER_*` | **Oui** — e-mail réel | **B** |
| `APOLLO_API_KEY` | **Oui** — écriture CRM, séquence commerciale | **B** |
| `BREVO_WEBHOOK_SECRET`, `BREVO_WEBHOOK_PATH_TOKEN` | Oui, en flux entrant : une valeur mal basculée **perd des désinscriptions** | **B** |
| `SUPABASE_SECRET_KEY` (une par service) | Non | **A** |
| `DATABASE_URL`, `AUTH_DATABASE_URL`, `WORKER_DATABASE_URL` (puis `OPS_DATABASE_URL`, `PRIVACY_DATABASE_URL`), `DIRECT_DATABASE_URL` (mots de passe de rôles, distincts par rôle et par environnement) | Non | **A** |
| `AUTH_TOKEN_SIGNING_SECRET` | Non, mais **perd les parcours de connexion en cours** (15 à 30 min) | **A**, en fenêtre creuse |
| `AUTH_THROTTLE_PEPPER` | Non, mais **remet les compteurs de débit à zéro** | **A** |

### Procédure A — clé sans effet de bord observable

1. Générer la nouvelle valeur côté service.
2. **Renseigner en `staging`, vérifier le bon fonctionnement** de bout en bout.
3. Renseigner en production, redéployer si nécessaire.
4. **Révoquer l'ancienne valeur** — étape la plus souvent oubliée, et la seule qui protège réellement.
5. Vérifier les journaux pour détecter d'éventuels usages résiduels.
6. Consigner la rotation : date, motif, qui, quelles variables.

### Procédure B — clé à effet de bord réel (Brevo, Apollo, webhooks entrants)

**La vérification se fait en production, jamais en `staging`. Ce qui rend l'opération sûre n'est
pas un environnement de test, c'est la fenêtre à deux clés.**

1. **Créer la nouvelle clé sur le compte de production**, sans révoquer l'ancienne. Chez Brevo comme
   chez Apollo, plusieurs clés coexistent : c'est ce qui rend la bascule non destructive.
2. **Vérifier que le service accepte les deux valeurs** pendant la fenêtre de bascule :
   - clés sortantes (Brevo, Apollo) : la nouvelle clé est renseignée, l'ancienne reste valide côté
     fournisseur le temps que tous les processus aient redémarré ;
   - secrets de webhook entrants : **deux valeurs acceptées simultanément** en comparaison à temps
     constant (`16` RG146-1), sinon chaque retour reçu pendant la bascule est perdu — et une
     désinscription perdue est un manquement.
3. **Renseigner la nouvelle valeur en production** et redéployer les services concernés (`api`,
   `worker`).
4. **Vérifier sur un volume minimal et maîtrisé** : un envoi transactionnel réel vers une adresse
   interne, ou un unique appel de lecture côté Apollo. **Jamais un envoi de masse comme test de
   rotation.**
5. **Révoquer l'ancienne clé** et **fermer la fenêtre à deux valeurs** (retirer la seconde valeur
   acceptée du webhook). Tant que ce n'est pas fait, la rotation n'a rien protégé.
6. Vérifier les journaux du fournisseur : plus aucun appel avec l'ancienne clé.
7. Consigner : date, motif, qui, durée de la fenêtre, date effective de révocation.

> **Ce qui reste testable en `staging` pour ces services :** le **code** du connecteur, contre la
> **doublure de test** (`16` RG148) et avec `BREVO_MODE=disabled` ou `redirect` — jamais la clé de
> production.

---

## Le garde-fou d'environnement — quatre verrous

Trois verrous protègent **l'envoi** (`02` §12.4), un quatrième protège **les données**
(`03` §6.8, ajouté par `expert-cybersecurite`, **bloquant B9**). Ils sont **indépendants et
cumulatifs**, parce qu'un seul finit toujours par sauter. Chacun fait l'objet d'un test (T17).

1. **Verrou 1 — Clés distinctes.** `staging` utilise un compte Brevo de test ; **aucune clé Apollo
   en `staging`**. Les clés de production ne sont jamais saisies dans `staging`, elles ne se
   ressemblent pas et ne sont pas interchangeables. Un poste de développement peut porter les clés
   des comptes Brevo et Apollo **de test** (D62), jamais celles de production.
2. **Verrou 2 — Mode explicite.** `SYNC_MODE=dry_run` et `BREVO_MODE=disabled` hors production : le
   connecteur n'appelle rien, marque la ligne traitée et journalise ce qu'il aurait envoyé. Le
   pipeline est testé de bout en bout, sans aucun appel sortant. **Le service refuse de démarrer**
   si `BREVO_MODE=live` hors production, ou si `SYNC_MODE=dry_run` en production — une production
   silencieusement muette est aussi grave qu'un envoi de test réel.
3. **Verrou 3 — Liste blanche de destinataires.** Si `INFLUX_ENV !== 'production'` et qu'un envoi
   réel est volontairement demandé (`redirect` / `live`), tout destinataire absent de
   `NON_PRODUCTION_RECIPIENT_ALLOWLIST` ou de `BREVO_TEST_RECIPIENTS` est écarté. Condition
   **positive** (« l'adresse figure dans la liste »), **jamais** négative, évaluée **au connecteur,
   après tout le mappage**, juste avant l'appel sortant.
4. **Verrou 4 — Aucune donnée de production dans `staging`** *(le plus important)*. `staging` est
   alimenté **exclusivement** par des données synthétiques (`supabase/seed`). **Toute restauration
   d'une sauvegarde de production vers un autre environnement exige une autorisation écrite du
   fondateur *et* une anonymisation préalable.** « Pour reproduire le bogue » est la phrase la plus
   dangereuse du métier : les trois premiers verrous protègent l'envoi, aucun ne protège les
   données.

**Compléments :** `staging` est **inaccessible au public** (restriction d'accès ou liste d'IP) et
sert `X-Robots-Tag: noindex` sur toutes les réponses. Le backoffice non productif porte un **bandeau
d'environnement permanent** indiquant l'environnement et le mode d'envoi, en toutes lettres et pas
seulement par une couleur (`16` RG118). **Tout envoi réel constaté depuis un environnement de test
se déclare comme incident** (`16` RG120) : coupure de la clé, recensement des destinataires atteints,
information des personnes si nécessaire, consignation écrite.

---

## Checklist de mise en service d'un environnement

À dérouler une fois par environnement, **avant le premier envoi réel**.

- [ ] Projet Supabase **dédié** créé (un par environnement, jamais deux schémas d'un même projet)
- [ ] Rôles Postgres créés selon la liste fermée de `03` §4 P7 : `influx_app`, les quatre rôles
      métier, `influx_auth` + `influx_auth_login`, `influx_worker` + `influx_worker_login`, les
      propriétaires de fonctions sans membre (`influx_audit_writer`, `influx_session_resolver`,
      `influx_identity_definer`) — **aucun avec `BYPASSRLS` ni `SUPERUSER`** ; le rôle Postgres
      `service_role` n'est utilisé nulle part, `influx_service` n'existe pas
- [ ] `DATABASE_URL` et `AUTH_DATABASE_URL` sur `api` seul, `WORKER_DATABASE_URL` sur `worker`
      seul (refus de démarrage sinon) ; `DIRECT_DATABASE_URL` **uniquement dans les GitHub Secrets**
- [ ] Les quatre services Railway créés (`web`, `backoffice`, `api`, `worker`) ; **`api` sans hôte
      public**, joint par le réseau privé
- [ ] **Domaines d'envoi — bloquant.** Les **trois sous-domaines** de `16` RG9 sont créés et
      **authentifiés séparément (SPF, DKIM, DMARC)** :
  - [ ] `tx.<domaine>` — transactionnel (code de connexion, décisions, preuves)
  - [ ] `news.<domaine>` — marketing (sources 1 et 2)
  - [ ] `pro.<domaine>` — prospection (source 3 uniquement)
  - [ ] Enregistrement **DMARC** publié pour chacun, politique décidée avec `expert-marketing`
  - [ ] **Aucun envoi n'est autorisé avant que les trois soient authentifiés**, et le service
        **refuse de démarrer** en `live` sans cela (RG116)
- [ ] **L'authentification du domaine est bloquante pour le Lot 1** (`CLAUDE.md` §14.3) : depuis
      **D37**, les membres se connectent par un **code à 6 chiffres reçu par e-mail**. Un e-mail qui
      n'arrive pas n'est plus une gêne marketing, c'est **une impossibilité de se connecter** :
      **la délivrabilité est la disponibilité du produit**
- [ ] Les onze variables Brevo renseignées, avec `BREVO_MODE` cohérent avec l'environnement
- [ ] Webhook Brevo configuré : chemin à jeton non devinable, en-tête personnalisé, plages d'adresses
      IP à jour et **surveillées**
- [ ] Les quatre verrous du garde-fou actifs et testés (T17)
- [ ] `staging` non indexé et non accessible publiquement ; base alimentée par `supabase/seed` seul
- [ ] Traçabilité de déploiement en place : quel commit, par qui, quand, vers quel environnement
- [ ] Procédure de rollback écrite et essayée au moins une fois

---

## En cas de fuite avérée

Traiter comme un incident, dans cet ordre :

1. **Révoquer immédiatement** la clé compromise — avant même de comprendre l'origine.
2. Générer et déployer une clé de remplacement (procédure A ou B selon l'effet de bord).
3. Évaluer l'exposition : quelles données accessibles, quelles actions possibles, sur quelle période.
   Pour une clé Brevo ou Apollo, la question n'est pas seulement « qu'a-t-on pu lire » mais
   **« qu'a-t-on pu envoyer, et à qui »**.
4. Examiner les journaux du service concerné pour repérer un usage anormal.
5. Purger la donnée de l'historique Git si elle y a été commitée (réécriture d'historique, avec
   l'accord du fondateur car elle affecte tous les clones).
6. Alerter `expert-cybersecurite` et, si des données personnelles sont concernées,
   `expert-conformite-rgpd` — une violation de données peut exiger une notification à l'autorité de
   contrôle dans un délai contraint.
7. Documenter : cause, impact, correctif, mesure de prévention.

---

## Checklist d'ajout de variable

- [ ] Variable classée publique ou secrète, nommée correctement
- [ ] **Aucune variable `SUPABASE_*` exposée au client, jamais de préfixe `NEXT_PUBLIC_` dessus**
- [ ] Documentée dans `.env.example` avec une valeur factice
- [ ] Renseignée en local, en CI et dans Railway, **par environnement** et **sur le seul service qui
      en a besoin**
- [ ] Clés distinctes entre `staging` et `production` ; clé de production **absente** de `staging`
- [ ] Procédure de rotation identifiée (A ou B) et écrite
- [ ] Validation zod au démarrage en place
- [ ] Contrôles CI-1 à CI-6 passants
- [ ] Aucune valeur en clair dans les journaux ou le bundle front
- [ ] `.gitignore` couvre bien `.env*`
- [ ] Action requise du fondateur signalée explicitement (`CLAUDE.md` §14.3)

---

## Ce qui reste à confirmer

| # | Sujet | Qui tranche |
|---|---|---|
| 1 | **Noms des trois sous-domaines d'envoi** (`tx.`, `news.`, `pro.`) — propositions de `16` RG9, à confirmer avec le nom de domaine retenu (`16` Q13) | `integrateur` + **Fondateur** |
| 2 | **`BREVO_API_KEY` hors production** : `16` §M8 la donne « production uniquement », `02` §12.4 prévoit un **compte Brevo de test** en `staging`. Lecture retenue ici : la *clé de production* n'existe qu'en production, et `staging` peut porter la clé d'un **compte de test distinct** — à confirmer. **Tranchée pour le poste de développement** (D62, 2026-09-25 : comptes Brevo et Apollo de test admis) ; reste ouverte pour `staging` | `expert-integrations-api` + `expert-cybersecurite` |
| 3 | **Absence de signature des webhooks Brevo** (`16` RG146, Q3) : les compensations par jeton, chemin et plages d'IP suffisent-elles ? | **`expert-cybersecurite` (veto)** |
| 4 | **Politique DMARC** de chaque sous-domaine (`none` puis durcissement, ou `quarantine` d'emblée) | `integrateur` + `expert-marketing` |
| 5 | **Périmètre et hébergement du stockage des secrets** au-delà de GitHub Secrets et Railway (coffre dédié) le jour où plusieurs personnes y accèdent | `expert-cybersecurite` + **Fondateur** |
