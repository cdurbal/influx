# Mise en production et exploitation de `production` — procédure du fondateur (J9 commit 11)

> **Public :** le fondateur, et `integrateur` qui prépare chaque commande. **Ce document est le
> miroir de `staging.md`** : mêmes noms (projet `Influx`, services `api`, `worker`, `web`,
> `backoffice`, variables, clés `influx_api` et `influx_worker`, D70), valeurs de production. Il
> **prépare**, il n'exécute rien : le J9 livre ce runbook, les configurations et un job CI inerte
> (EC-J9-6, EC-J9-8). Plan : `21` §5.8 ; mécanisme : `02` §12 ; sauvegarde : `02` §19 ; rodage : `02`
> §20.7.
>
> **Règle d'exécution : chaque étape ci-dessous est exécutée par le fondateur, ou par un agent sur
> sa confirmation explicite, étape par étape** (`CLAUDE.md` §7 règle 4, skill `railway-deploy`).
> Les agents n'ont **aucun accès** à `production` (jeton Railway limité à `staging`, D70) : toute
> lecture de `production`, par un agent, passe par une demande écrite du fondateur.
>
> **Règles.** Aucun secret dans un fichier du dépôt, une conversation, un document ou un journal.
> Les valeurs de production n'existent **que** dans Railway, Supabase, GitHub (environnement
> `production`) et le gestionnaire de mots de passe du fondateur ; **`apps/api/.env.local` ne porte
> jamais une valeur de production** (D70). Pas de capture du *Raw Editor* Railway. Aucun test
> automatisé ne charge de valeur de production (`16` RG148).
>
> **Branche `production` (D71, EC-J9-6).** Elle n'avance que par `git merge --no-ff main`, **sur
> l'accord explicite du fondateur**, jamais par un commit direct ni un `push --force`. Elle n'a pas
> de protection GitHub : la discipline est la règle. Sur cette branche seule, la CI rend bloquants
> le contrôle I-4 (`security-reviewed:`) ; les vetos de `expert-cybersecurite` et
> `expert-conformite-rgpd` s'appliquent avant la fusion.
>
> **Interdits permanents.** `railway up` (le commit déployé ne serait plus traçable) ;
> `supabase db push` à la main ; une clé Brevo, Apollo ou Supabase de `staging` en production, et
> l'inverse ; une restauration de production vers `staging` (`18` B9, `02` §19 point 6) ; une
> donnée de test écrite en production.

## Étapes du fondateur, dans l'ordre

| # | Étape | État |
|---|---|---|
| 0 | Portes de `21` §5.8 franchies (section 0) | À faire |
| 1 | Projet Supabase de production, région UE, PITR (section 1) | À faire |
| 2 | Mots de passe des cinq rôles de connexion (section 2) | À faire |
| 3 | Environnement GitHub `production` et variable d'activation (section 3) | À faire |
| 4 | Brevo et Apollo : comptes de la société, trois sous-domaines d'envoi (section 4) | À faire |
| 5 | Railway : quatre services sur la branche `production`, variables **toutes régénérées**, comparaison à `staging` sans valeur héritée (section 5, J9S-1) | À faire |
| 6 | Première fusion `main` vers `production`, migration, déploiement (section 6) | À faire |
| 7 | Constats d'ouverture (section 7) | À faire |
| 8 | Rodage de 30 jours (section 9) | À faire |

## 0. Portes de la mise en production (`21` §5.8)

Aucune fusion vers `production` avant que **toutes** les lignes soient cochées. Une porte non
cochée mais explicitement acceptée et datée par le fondateur vaut cochée (`18` §10).

- [ ] Société créée, mentions légales possibles (D25) — fondateur + avocat fiscaliste.
- [ ] Périmètre et base légale Apollo validés par un juriste, pays de prospection renseignés
      (D33, `05` Q1 à Q3) — fondateur + `expert-conformite-rgpd` (veto).
- [ ] CGU FR et EN (non-contournement, supervision, conservation probatoire), politique de
      confidentialité nommant Brevo et Apollo, validées par le juriste (D29, A5, A10, R-1) ;
      marqueurs `[…]` remplacés (section 12).
- [ ] Trois sous-domaines d'envoi authentifiés (SPF, DKIM, DMARC) sur le compte Brevo de production
      (`16` RG9).
- [ ] Comptes Brevo et Apollo au nom de la société, contrats de sous-traitance signés.
- [ ] **Identifiants de listes et réglages Brevo / Apollo de production** renseignés dans
      `leads.sync_settings` (D67, `05` RG160 à RG164) : listes annonceurs et créateurs (variables
      `BREVO_LIST_ID_*` du `worker`, D68, ou SQL), `retry_schedule`, `rate_limits`, trois réglages
      Apollo ; **premier démarrage du `worker` accepté** par le contrôle de `05` RG162 ; aucune ligne
      en échec de configuration au backoffice.
- [ ] Textes de la landing relus (`expert-marketing`, `expert-conformite-rgpd`, verdict L9) ; revue
      du budget d'effets (`expert-ux`) — D48, D59.
- [ ] Exécution des demandes « mes données » livrée (E-5 minimale, `15` RG79, RG80).
- [x] **Revue groupée de fin de J9** par `expert-cybersecurite` et `testeur` (2026-10-27) : droits
      signés (`expected-rights.ts`, `0142` à `0149`, E-4 et E-6 de `03` P7), 14 commits couverts par
      le commit d'attestation de clôture du J9 ; reports listés dans `archives/jalons/j9-fiche.md`.
- [ ] **Aucune valeur héritée de `staging`** dans les variables Railway de production (J9S-1,
      section 5, script de comparaison sans valeur affichée).
- [ ] **Constats `staging` de fin de J9** (fiche J9) : API, sonde, battement, T10 du backoffice et
      J9S-5 constatés le 2026-10-27 ; restent l'arrêt du worker (AL50), la coupure de l'API
      (`/health` `503`, AL49) et une inscription réelle, avec l'accord du fondateur.
- [ ] `expert-conformite-rgpd` (Lot 6) : verdict L9, exemption de consentement du collecteur
      navigateur, RG118, RG121 (veto), retrait propagé à Apollo, notice art. 15, F8, contreparties
      du risque D70 (a).
- [ ] Aucune objection ouverte de `expert-cybersecurite` ni de `expert-conformite-rgpd`.
- [ ] Décisions du fondateur prises : destinataires et astreinte des alertes (`02` §20.11 point 2),
      offre Railway (point 3), rodage de 30 jours (point 4), D33 (pays exclus), D35, D36.
- [ ] Compte `admin` distinct de l'`agent` quotidien (PD7), compte « bris de glace » créé, codes
      scellés (`03` MFA-10, B7), par `prod:bootstrap-admins` (section 0 bis).
- [ ] **Accord explicite du fondateur** pour la mise en production, noté avec sa date.

## 0 bis. Amorçage du premier `admin` et du compte de bris de glace

**Action du fondateur**, une seule fois, base de production migrée, avec son accord écrit
(`CLAUDE.md` §7 règle 4). Jamais par un agent ni par la CI (le script refuse `CI`). Les autres
comptes internes viennent ensuite d'une invitation de cet `admin` (`15` RG99).

1. Exporter dans le shell, pour cette seule exécution (jamais dans un fichier, jamais
   `.env.local`) : `INFLUX_PRODUCTION_MIGRATION_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `INFLUX_PUBLIC_BACKOFFICE_URL` de production, et au besoin `INFLUX_PRODUCTION_DB_CA_FILE`.
2. `pnpm --filter @influx/api prod:bootstrap-admins -- --admin=<adresse> --admin-first-name=<prénom>
   --break-glass=<autre adresse> --country=GB --confirm=<ref du projet>`. Refusé : `--confirm`
   différent de la référence du projet de `SUPABASE_URL`, clé et base de deux projets, témoin
   `influx_production` absent (section 1) ou table
   témoin de `staging` présente, un compte `agent` ou `admin` déjà existant, adresse de bris de
   glace alias de celle de l'`admin` (`+étiquette`, points Gmail).
3. Ouvrir le fichier indiqué de `.operator-secrets/` : mots de passe et liens d'activation (72 h).
   Inscrire le TOTP de l'`admin` ; celui du bris de glace **sur un appareil hors ligne**, codes de
   secours imprimés et scellés, rangés à part (`03` MFA-10). Puis supprimer le fichier.
4. Noter l'amorçage au registre d'incidents (le rôle de migration n'écrit pas l'audit).
5. Désactiver les variables du shell (`unset`).

## 1. Projet Supabase de production

Création et réglages **par le fondateur** (création d'un projet = confirmation, `CLAUDE.md` §7).

1. Projet `influx` distinct de celui de `staging`, **région UE** (D25), même organisation ou non
   selon la société. Aucune donnée de `staging` ne le touche.
2. **Restauration à un instant donné (PITR) activée avant la première fusion** (D57, `02` §19
   point 1) : la perte acceptable est de quelques minutes. Le coût du PITR et de l'option de calcul
   qu'il suppose est à valider par le fondateur ; **durée de rétention choisie et notée ici :**
   `[à renseigner : … jours]`.
3. Deux clés secrètes `sb_secret_…` nommées `influx_api` et `influx_worker` (EC-46) ; clés héritées
   `anon` et `service_role` désactivées ; clé *publishable* désactivée si la plateforme le permet.
4. Fournisseur Email actif, inscription publique fermée, clés JWT asymétriques ES256. Aucun de nos
   schémas exposé à l'API de données (`18` T2.4, case non automatisable du Lot 0).
5. Réglages Auth du dépôt, depuis le poste du fondateur avec **son** accès Supabase (le jeton du
   poste ne voit que `staging`) :

   ```sh
   pnpm exec supabase link --project-ref <ref-production>
   INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT=30 INFLUX_LOCAL_AUTH_VERIFY_LIMIT=30 pnpm exec supabase config push
   ```

   Relire l'écran `security_sb_forwarded_for_enabled` (EC-38) : à activer s'il est proposé, sinon
   noter l'écart.
6. **Marqueur de production** (J9T-2), créé à la main comme celui de `staging`, **avant** toute
   activation du job (section 3) : le job exige ce marqueur **et** l'absence de celui de `staging`
   (`influx_staging.environment_marker`), sinon il refuse de migrer.

   ```sql
   create schema influx_production;
   revoke all on schema influx_production from public;
   create table influx_production.environment_marker (
     environment text primary key check (environment = 'production')
   );
   insert into influx_production.environment_marker values ('production');
   ```

   Le schéma `influx_production` n'est **jamais** exposé à l'API de données (même règle qu'au point 4).
7. **Test de restauration, chronométré et consigné** (`02` §19 point 3) : avant la première mise en
   ligne, sur une restauration vers un projet jetable (jamais vers `staging`), puis régulièrement ;
   fréquence proposée : une fois avant l'ouverture, puis chaque mois pendant le rodage
   (`[à confirmer par le fondateur]`). Après toute restauration, avant remise en service : **rejouer
   les purges et anonymisations postérieures** à l'instant restauré (`04` §9.3), **vérifier la chaîne
   du registre** (`04` `chain_checks`) et la comparer à l'empreinte de tête mensuelle transmise au
   fondateur (`02` §19 points 4 et 5).

Les migrations passent **uniquement** par le job « Migrate production » : jamais `supabase db push`
à la main.

## 2. Mots de passe des rôles de connexion

Après la première exécution de « Migrate production » (les cinq rôles sont créés par les migrations
`0001`, `0016`, `0136`). Le script `staging:role-passwords` lit `.env.local` (valeurs de `staging`)
et **ne doit pas servir à la production** : les cinq mots de passe de production sont tirés **par le
fondateur** (32 octets aléatoires chacun, **tous différents**, gestionnaire de mots de passe) et
appliqués par SQL à la base de production (`alter role influx_app password '…'`, etc.), sous forme
d'empreinte `SCRAM-SHA-256$…` si possible. Les cinq URL de connexion (multiplexeur, format
`<rôle>.<référence du projet>`, `02` §12.3) vont **dans Railway uniquement** (section 5), chacune
sur son service : `DATABASE_URL` (`influx_app`), `AUTH_DATABASE_URL` (`influx_auth_login`),
`OPS_DATABASE_URL` (`influx_ops_login`) sur `api` ; `WORKER_DATABASE_URL`
(`influx_worker_login`) et `PRIVACY_DATABASE_URL` (`influx_privacy_login`) sur `worker`.

> **Point laissé ouvert :** un équivalent de production du script de rotation des mots de passe
> (qui n'afficherait rien) n'existe pas ; le fondateur peut demander à `integrateur` de le
> préparer, ce qui est un commit à part.

## 3. GitHub : environnement `production` et job inerte (EC-J9-8)

Le job « Migrate production » de `.github/workflows/ci.yml` est le miroir de « Migrate staging » :
déclenché par un **push sur la seule branche `production`**, après les mêmes jobs requis
(`pnpm check`, relais sur Node 24), I-4 bloquant dans `pnpm check` (D71). Il **ne publie pas** les
documents publics (section 12) et ne lance **jamais** `railway up`.

**Il est inerte tant que la variable de dépôt `PRODUCTION_MIGRATION_ENABLED` n'est pas `true`.** La
condition est sur le job et non sur une étape : un job qui nomme `environment: production` **crée**
cet environnement sur GitHub s'il n'existe pas (sans protection) ; un job sauté ne le résout jamais.
Une seconde garde, dans le job : sans secret `DIRECT_DATABASE_URL`, il se termine en vert sans rien
migrer ; avec un secret qui pointe une base sans le marqueur de production (section 1 point 6) ou
portant celui de `staging`, il échoue. Ces gardes sont prouvées par `packages/test-kit/tests/ci-production-job.test.ts`.

Étapes **du fondateur** (écritures GitHub = confirmation explicite, `CLAUDE.md` §7 règle 4) :

1. Créer l'environnement `production` (Settings › Environments), limité à la branche
   **`production`** (*Deployment branches*), avec **un relecteur requis obligatoire** : le fondateur
   (J9S-3 : les agents utilisent `gh` sous son compte, l'approbation manuelle reste son geste). Puis un
   *ruleset* sur la branche `production` : ni force push, ni suppression, contrôles `check` et
   `relay-node-24` requis.
2. Y poser le secret `DIRECT_DATABASE_URL` : rôle `postgres` de la base de production, *Session
   pooler* (hôte `…pooler.supabase.com`, port 5432 ; la connexion directe est IPv6 seulement). Il ne
   va **nulle part ailleurs** (CI-5). Depuis le poste du fondateur, valeur lue sur l'entrée standard,
   jamais affichée :

   ```sh
   gh secret set DIRECT_DATABASE_URL --env production --repo cdurbal/influx
   ```
3. **En dernier**, activer le job : `gh variable set PRODUCTION_MIGRATION_ENABLED --body true --repo
   cdurbal/influx` (variable de dépôt : seule disponible dans la condition d'un job).
4. Désactivation d'urgence : `gh variable set PRODUCTION_MIGRATION_ENABLED --body false --repo
   cdurbal/influx` ; aucun autre effet.

Vérification : au premier push sur `production`, `gh run list --limit 5` puis `gh run watch <id>
--exit-status` ; l'étape « Migrate production (supabase db push) » liste d'abord les migrations en
attente (`--dry-run`, noms seulement), puis les applique.

## 4. Brevo et Apollo de production

1. **Trois sous-domaines d'envoi** (transactionnel, marketing, prospection ; jamais le même, `16`
   RG9) authentifiés dans le compte Brevo de production : SPF, DKIM, DMARC, à cadrer avec
   `expert-marketing`. Noms retenus : `[sous-domaine transactionnel]`, `[sous-domaine marketing]`,
   `[sous-domaine prospection]`. Aucun n'est le domaine d'envoi de `staging`
   (`influx.cadaero.ovh`). Changement DNS = fondateur.
2. `BREVO_API_KEY` : **une clé pour `api`, une autre pour `worker`** (`02` §12.3) ; `APOLLO_API_KEY`
   sur `worker` seul. Comptes au nom de la société.
3. Webhooks Brevo (un transactionnel, un marketing), mêmes règles que `staging.md` §8 points 1 à 3,
   avec l'hôte du service `web` **de production** (jamais celui de `staging`, incident du
   2026-10-20) et les événements de `BREVO_WEBHOOK_SUBSCRIPTION`
   (`packages/contracts/src/brevo-webhook.ts`). Sonde de contrôle sans écriture : `POST` avec `{}`
   doit répondre `404` et le journal de `api` porter `webhook.brevo.rejected`.
4. Listes, attributs et modèles : `staging.md` §8 points 4 et 5 (listes des deux rôles, modèles de
   bienvenue, avis de changement d'adresse, accusé « mes données »). Réglages Apollo : `leads.sync_settings`
   de production ; `apollo_excluded_countries` vide par défaut, sauf décision D33.
5. **La preuve du webhook** (`staging.md` §8 point 7) n'est faite qu'avec un contact réel du
   fondateur, jamais un contact de test fabriqué.

## 5. Railway : quatre services, branche `production`

Environnement `production` du projet `Influx` (existe, forké avec `staging`). Création ou
suppression d'un service ou d'un environnement : confirmation du fondateur. Pour chacun des quatre
services dans **l'environnement `production`** :

- Source : le dépôt `cdurbal/influx`, **branche `production`** (et non `main`) ; *Root Directory*
  vide ; « Wait for CI » activé.
- Réglages **saisis à la main** (Railway refuse le config-as-code aux services créés depuis le
  2026-08-28) depuis le fichier de production du service : *Custom Build Command*, *Watch Paths*
  (**un motif par ligne**, jamais séparés par des virgules), *Custom Start Command*, *Healthcheck
  Path* et *Timeout*, *Restart Policy*, *Draining*. `RAILPACK_NODE_VERSION=24`.
- Fichiers de référence : mêmes valeurs que `staging`, seule la dernière ligne des *Watch Paths*
  change (le fichier lui-même). La branche n'est pas dans le fichier : c'est un réglage du service.

| Service | Fichier de production | Fichier de `staging` | Domaine public |
|---|---|---|---|
| `api` | `deploy/railway/api.production.json` | `api.json` | aucun |
| `worker` | `deploy/railway/worker.production.json` | `worker.json` | aucun |
| `web` | `deploy/railway/web.production.json` | `web.json` | oui, domaine du produit |
| `backoffice` | `deploy/railway/backoffice.production.json` | `backoffice.json` | oui, distinct de `web`, `noindex` |

**Valeurs de production** (noms identiques à `staging.md` §5, seules les valeurs changent) :

- `INFLUX_ENV=production` partout. **Pas de `noindex` pour `web`** (seule la production est
  indexable, `02` §12.4) ; le backoffice reste `noindex` ; **pas de bandeau d'environnement**.
- `PORT=3100` sur `api` seulement. `BREVO_MODE=live` sur `api` et `worker`, `SYNC_MODE=live` sur
  `worker`, **sans** `BREVO_TEST_RECIPIENTS` ni `NON_PRODUCTION_RECIPIENT_ALLOWLIST` (le code les
  refuse). `BREVO_API_BASE_URL=https://api.brevo.com/v3`. `BREVO_SENDER_TRANSACTIONAL` sur le
  sous-domaine transactionnel de production.
- `INFLUX_API_INTERNAL_URL=http://api.railway.internal:3100` sur `web`, `backoffice` et `worker` ;
  `INFLUX_API_INTERNAL_SECRET` propre à chaque front, dont la valeur égale
  `INFLUX_API_INTERNAL_SECRET_WEB` ou `…_BACKOFFICE` de `api`.
- `INFLUX_PUBLIC_SITE_URL` et `INFLUX_PUBLIC_BACKOFFICE_URL` : domaines `https` définitifs, mêmes
  valeurs sur `api` et `worker` (cibles de la sonde).
- `DATABASE_CA_CERT` sur `api` et `worker` ; `SUPABASE_URL` et `SUPABASE_SECRET_KEY` (clé
  `influx_api` sur `api`, clé `influx_worker` sur `worker`, jamais la même).
- **`OPS_ALERT_RECIPIENTS`** sur `api` et `worker` : adresses d'astreinte **décidées par le
  fondateur** (`02` §20.11 point 2), séparées par des virgules, jamais recopiées dans un document.
  « Site injoignable » prévient le fondateur et le développeur 24 h/24 (proposition).
- `BREVO_WEBHOOK_PATH_TOKEN_CURRENT` (43 caractères base64url) et `BREVO_WEBHOOK_SECRET_CURRENT`
  (43 à 128) sur `api` seul.
- Secrets de 32 octets, **une valeur différente pour chacun** :
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
- Aucune clé Brevo, Apollo ni Supabase de `staging` ; aucun jeton de `staging`.

**Valeurs héritées du fork : toutes remplacées (J9S-1, bloquant, revue de fin de J9).** L'environnement
`production` a été forké avec `staging` : il en porte les **valeurs**, lisibles par tous les agents
(`.env.local`, D70). Avant le premier déploiement, le fondateur **régénère ou remplace chaque valeur**
de chaque service (secrets, `…_DATABASE_URL`, clés Supabase, Brevo et Apollo, jetons du webhook), puis
vérifie, depuis son poste, qu'**aucune** valeur de production n'égale celle de `staging` hors d'une
liste blanche de valeurs non secrètes. Le script compare en mémoire et n'affiche **que des noms** :

```sh
node -e "const {execFileSync:x}=require('node:child_process');const ok=new Set(['PORT','RAILPACK_NODE_VERSION','BREVO_API_BASE_URL','BREVO_MODE','SYNC_MODE','INFLUX_API_INTERNAL_URL','DATABASE_CA_CERT','OPS_ALERT_RECIPIENTS','BREVO_LIST_ID_ADVERTISERS','BREVO_LIST_ID_CREATORS','BREVO_SUPPRESSION_LIST_ID']);let n=0;for(const s of ['api','worker','web','backoffice']){const r=e=>JSON.parse(x('railway',['variables','-s',s,'-e',e,'--json'],{encoding:'utf8',shell:process.platform==='win32'}));const a=r('staging'),b=r('production');for(const k of Object.keys(b))if(!ok.has(k)&&!k.startsWith('RAILWAY_')&&k in a&&a[k]===b[k]){console.log(s+' '+k);n++}}console.log(n?n+' valeur(s) héritée(s) de staging':'aucune valeur héritée');process.exit(n?1:0)"
```

Sortie non nulle = **bloquant** : remplacer chaque valeur nommée, puis relancer jusqu'à « aucune valeur
héritée ». Le script se relance après toute modification des variables de production.

**Liste fermée :** celle de `staging.md` §5 (table entre les repères `staging-check`) fait foi, par
service ; elle n'est pas recopiée ici pour ne pas diverger. Toute variable ajoutée par un jalon entre
dans cette table dans le commit qui la lit (EC-J9-7).

**Contrôle des noms en production** : `staging:check` refuse `production` et n'est pas utilisable
(jeton limité à `staging`). Le fondateur compare les **noms** (jamais les valeurs) à la liste fermée,
service par service :

```sh
railway variables -s <service> -e production --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s)).sort().join('\n')))"
```

Vérifier en outre, sans les afficher en entier : `INFLUX_ENV=production` partout, `BREVO_MODE=live`
(`api`, `worker`), `SYNC_MODE=live` (`worker`). Un équivalent automatisé pour la production est un
commit à part, à demander à `integrateur`.

## 6. Première fusion et déploiement

Préalable : sections 0 à 5 terminées, retour à la version précédente relu (section 8).

1. Le fondateur donne son accord (date notée en section 0).
2. Fusion, depuis un poste propre, **sans `--force`** :

   ```sh
   git switch production
   git merge --no-ff main
   git push origin production
   ```

   `production` n'avance que par cette commande. Les premières fusions sont lourdes : la CI y rejoue
   I-4 sur toute la plage depuis l'ancre `56b8046` ; un commit non attesté laisse la CI rouge.
3. Suivre : `gh run list --limit 5`, `gh run watch <id> --exit-status`. Enchaînement attendu : CI verte
   → « Migrate production » vert → déploiement des quatre services (« Wait for CI »), même
   `RAILWAY_GIT_COMMIT_SHA`.
4. Mots de passe des rôles (section 2) à la première migration, puis redéploiement si les services
   avaient démarré sans eux.
5. Consigner le commit déployé, la date et l'auteur dans `21` §J9.

Ordre des migrations : toujours **avant** le code qui les lit, et additives (jamais de migration
destructive simultanée à un déploiement applicatif, règle 7). Un renommage ou une suppression se fait
en deux déploiements.

## 7. Constats d'ouverture (miroir de `staging.md` §6 et §9, sans donnée de test)

Faits par le fondateur, ou par un agent sur sa demande écrite. **Aucune écriture de données de test
en production** : pas de compte de démonstration (aucun script ne s'exécute en production), pas de
constat A5 qui enverrait des codes, pas d'inscription fictive.

1. CI verte → « Migrate production » vert → quatre services déployés sur le même commit.
2. Journal de démarrage de `api` : `database pool verified` pour `influx_app`, `influx_auth_login`,
   `influx_ops_login` ; aucun `database pool refused` ni `invalid configuration, refusing to start`
   (le journal nomme la variable, jamais la valeur). `worker` : démarrage accepté par le contrôle de
   `05` RG162 ; aucun `fatal` nommant un réglage.
3. `curl -s -o /dev/null -w "%{http_code}\n" https://<web>/health` répond `200` (EC-22) ; `/health`
   de `api` (interne) vérifie la base.
4. En-têtes R7 et CSP : `curl -sI https://<web>/fr` et `curl -sI https://<backoffice>/` montrent
   `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`,
   `strict-transport-security`, `content-security-policy` à nonce. **`web` sans `noindex`** ;
   **`backoffice` avec `noindex`**.
5. Sonde : `ops.probe_results` et `ops.worker_heartbeats` se remplissent (écran « Santé technique »
   du backoffice, `admin` seul) ; aucune alerte inattendue.
6. Webhook Brevo : sonde `POST {}` en `404` (section 4 point 3).
7. SPF, DKIM, DMARC des trois sous-domaines vérifiés dans Brevo (`18` Lot 1, case non automatisable).
8. Alerte de bout en bout : le fondateur déclenche, **avec accord de chacun des destinataires**,
   l'arrêt volontaire du `worker` de production pendant plus de 60 s (`railway` ou interface) et
   constate AL50 par l'API puis le « rétabli » ; à défaut, cette preuve est reportée au premier
   incident réel et notée.
9. Première inscription réelle du fondateur (hors constat, décision de sa part) : code reçu, contact
   dans la liste Brevo du rôle, contact Apollo créé ou écarté pour un motif de qualification (jamais
   `skipped_no_credentials`, `skipped_non_production` ni `dry_run`).

## 8. Retour à la version précédente (`02` §20.7 point 5, miroir de `staging.md` §10)

Écrite **avant** la mise en ligne. Exécutée par le fondateur ou sur sa confirmation.

1. Railway › environnement `production` › service › Deployments : *Redeploy* du dernier déploiement
   sain. `api` et `worker` partagent le même code : les revenir **ensemble**. Attention :
   *Redeploy* rejoue le commit du **dernier** déploiement choisi, même `SKIPPED`.
2. Le retour de code **ne touche pas la branche** : pour que Railway ne redéploie pas le mauvais
   commit au prochain push, ne rien fusionner d'autre vers `production` tant que la cause n'est pas
   corrigée sur `main`. Pas de `git reset` ni de `push --force` sur `production`.
3. Une migration n'est **jamais** annulée par un retour de code (migrations additives). Sinon,
   migration corrective suivante, jamais la modification d'une migration appliquée (EC-37).
4. Remettre `BREVO_MODE` / `SYNC_MODE` en `dry_run` ou `disabled` fait **refuser le démarrage**
   (D70) : revenir d'abord au commit précédent, puis aux variables d'avant.
5. Donnée perdue ou corrompue : restauration à un instant donné (section 1 point 7 : purges à
   rejouer, chaîne à vérifier, avant remise en service). Vers un projet jetable d'abord.
6. Noter l'heure, la version revenue (`RAILWAY_GIT_COMMIT_SHA`) et la cause dans le bilan de rodage ;
   corriger sur `main`, puis refusionner sur accord.

## 9. Surveillance et rodage de 30 jours (`02` §20.7)

**Pages d'état à suivre** (abonnement par e-mail ou RSS par le fondateur ; adresses à vérifier à
l'abonnement) : Railway `https://status.railway.com` ; Supabase `https://status.supabase.com` ;
Brevo `https://status.brevo.com`. Lecture d'un ralentissement : tableau de `02` §20.6, état des
services en cas de chute brutale.

Pendant **30 jours après chaque mise en ligne** (Lot 1 d'abord, puis chaque lot, et après toute mise
en production jugée risquée), prolongés tant qu'une erreur bloquante reste ouverte :

- [ ] Toute nouvelle erreur alerte immédiatement (pas seulement un dépassement de seuil).
- [ ] Plafond d'occurrences conservées par empreinte relevé.
- [ ] Revue quotidienne des erreurs (10 à 15 minutes), chaque groupe classé : corrigé, planifié ou
      sans effet.
- [ ] Bilan hebdomadaire d'une page au fondateur : erreurs nouvelles et corrigées, temps de réponse,
      pics et leur origine, disponibilité mesurée par la sonde.
- [ ] Chaque version est étiquetée par `RAILWAY_GIT_COMMIT_SHA` ; la section 8 est relue.
- [ ] Journaux au niveau `info` ; **`debug` jamais activé en production** ; rien de `02` §20.8 dans
      `ops` ni dans un journal.
- [ ] Offre Railway Pro (30 jours de journaux bruts au lieu de 7) : décision du fondateur,
      `02` §20.11 point 3.

Ce que le réglage de rodage active dans le code (relèvement du plafond, alerte sur toute nouvelle
erreur) n'est pas livré par le J9 : à confirmer avec `architecte` avant le Lot 1 en production.

## 10. Admin indisponible (J8S-9)

Situation : un `admin` ne peut plus agir (absent, départ, téléphone perdu) alors qu'**au moins deux
`admin` actifs** existent, de sorte que la double validation (2V) attend l'autre et que ses demandes
restent bloquées.

**Ce qui existe, et ce qui n'existe pas encore (Lot 5).**

- Pas d'écran ni de route de désactivation d'un compte interne (EC-J8-60, Lot 5). Aujourd'hui la
  désactivation est **un `UPDATE` SQL sur `identity.agent_profiles`**, fait par le fondateur avec le
  rôle de migration (éditeur SQL Supabase), `COMMIT` aussitôt. **Aucune ligne d'audit n'est écrite
  par la base pour cet `UPDATE`** (le rôle n'exécute pas `audit.append`) : l'intervention se
  **journalise à la main** dans le registre d'incidents (date, administrateur désigné, motif, par qui),
  comme `staging.md` §11.
- Les responsabilités d'un agent (portefeuille de membres) se réattribuent **avant** (`15` RG60,
  RG105) : elles se lisent par `GET /v1/bo/internal-accounts` (écran « équipe », `admin`). Le
  contrôle n'est pas automatique tant que le Lot 5 n'est pas livré.
- Écrivain de l'état `expired` des 2V et information du demandeur (`15` RG31) : **non livrés, Lot 5**.
  Une demande 2V périmée reste à l'état `pending` ; elle ne se confirme plus, elle se redemande.
- Réinitialisation du second facteur (RG102, MFA-6) : **Lot 5**. Le script
  `staging:reset-internal-account` refuse la production ; il n'existe aucune procédure d'agent pour un
  TOTP perdu en production en dehors du bris de glace.

**Procédure.**

1. Un `admin` restant vérifie l'identité de la personne par un autre canal (téléphone) et constate
   l'indisponibilité.
2. Réattribuer ses responsabilités (point ci-dessus), et noter les 2V en attente qu'elle avait
   demandées ou qu'elle devait approuver.
3. Fondateur : désactiver le profil (sessions refusées : `identity.resolve_session()` refuse un compte
   interne sans profil actif) :

   ```sql
   begin;
   update identity.agent_profiles
      set is_active = false, deactivated_at = now(),
          deactivated_by_account_id = '<identifiant du compte de l'administrateur qui agit>'
    where account_id = '<identifiant du compte désactivé>';
   commit;
   ```

   Les deux colonnes de désactivation vont ensemble (contraintes de la table) ; le compte n'est
   **jamais supprimé** : ses actions passées gardent son nom (RG105).
4. **Ce que cela rouvre (PD7, `03` §1.3).** La règle cible « demandée par un agent, approuvée par un
   `admin` **distinct** » dépend du nombre d'`admin` **actifs** distincts du demandeur. Si, après
   désactivation, il ne reste **aucun** autre `admin` actif que le demandeur, la **procédure dégradée**
   (PD1 à PD7) s'applique à nouveau sans changement de code : récapitulatif intégral, confirmation
   différée d'au moins 60 s, TOTP frais, journal marqué `degraded_single_operator`, revue
   hebdomadaire de l'accueil, bandeau permanent RG107. Elle protège contre l'erreur, pas contre la
   malveillance : c'est un risque accepté et écrit. Restreindre cette bascule à un compte distinct de
   l'`agent` quotidien est la raison d'être de PD7.
5. **Bris de glace** (`03` MFA-10, `15` RG103) : seulement si plus aucun `admin` ne peut se connecter.
   Compte unique, adresse distincte, TOTP sur un appareil hors ligne, codes scellés ; **chaque
   connexion alerte immédiatement le fondateur (AL33) et s'inscrit au journal
   (`agent.break_glass_login`)**, justification écrite sous 24 heures. Jamais pour le travail courant.
6. Réactivation, si la personne revient : l'`UPDATE` inverse (`is_active = true`, deux colonnes de
   désactivation à `null`), à journaliser de la même façon.

## 11. Invitation interne : lien hors e-mail, révocation

Une invitation interne est créée **par un `admin`** (`POST /v1/bo/internal-invitations`, écran
d'équipe du backoffice, `15` RG99, D54). **Aucun e-mail d'INFLUX n'est envoyé** (EC-J8-3, D35) :

1. Le lien d'activation (`https://<backoffice>/activation#<jeton>`) n'est affiché **qu'à la création**
   ; seul son SHA-256 est conservé, il est à usage unique et sa validité est de 72 h. Le jeton est
   dans le fragment du lien, que ni serveur ni journal ne reçoit.
2. **Le fondateur choisit le canal de transmission, hors e-mail** : en main propre, ou par une
   messagerie chiffrée de bout en bout ; canal retenu : `[à renseigner]`. Jamais le même fil que
   l'adresse de l'invité, jamais un ticket, jamais le dépôt. Une invitation proposant `admin` exige
   en plus sa 2V (`identity.invite_admin`, EC-J8-12).
3. L'invité active son compte, enrôle son TOTP (obligatoire) ; le lien est alors consommé.
4. **Révocation** d'une invitation non consommée, par un `admin` (écran des invitations ou `POST
   /v1/bo/internal-invitations/<id>/revoke`) avec un motif de la liste fermée :
   `sent_to_wrong_address`, `no_longer_needed`, **`suspected_compromise`**, `replaced_by_new_invitation`.
   Lien transmis sur un mauvais canal, perdu ou vu par un tiers : choisir `suspected_compromise`, puis
   recréer une invitation (nouveau jeton). Une invitation déjà acceptée, déjà révoquée ou inconnue
   répond `404` ; un compte activé par erreur se désactive (section 10).
5. Journaliser dans le registre d'incidents toute invitation révoquée pour `suspected_compromise`.

Pour les invitations de membres (agent et `admin`), le lien est copié par l'agent de la même façon
(D54) ; la révocation se fait par l'auteur ou un `admin`.

## 12. Publication des CGU sous libellé définitif (EC-62)

**Action du fondateur** (avec le juriste), après les portes de la section 0. `draft-*` est **toujours
refusé en production** ; le script `db:publish-terms` refuse la production sans exception (EC-45) et
le job « Migrate production » ne publie rien.

1. Remplacer, dans `apps/api/legal/<document>/<fr|en>/`, **les marqueurs de la société (D25)** :
   `[COMPANY NAME]`, `[COMPANY NUMBER]`, `[REGISTERED OFFICE ADDRESS]`, `[CONTACT EMAIL]`,
   `[VAT NUMBER]`, `[ICO REGISTRATION NUMBER]`, `[EU REPRESENTATIVE]`, `[PRIVACY LEAD NAME AND TITLE]`,
   `[HOSTING REGION]`, `[RETENTION SCHEDULE]`, `[LIABILITY CAP]`, `[NON-CIRCUMVENTION PERIOD]`, et
   l'avertissement « projet de travail » de chaque brouillon ; texte validé par le juriste.
2. Créer la version **non `draft-*`** (par exemple `1.0`, libellé de 1 à 40 caractères
   `[0-9A-Za-z._-]`), pour les trois documents et les deux langues, ajoutée à
   `apps/api/legal/published.json` (empreintes, ajout seul), commitée sur `main`
   (octets exacts, UTF-8 strict, `-text`).
3. Publier dans la base de production. **Écart connu : `db:publish-terms` n'a pas de cible
   `production` (cibles : `local`, `staging`)** ; la publication de production demande un commit
   dédié (cible `production` gardée par une confirmation, mêmes contrôles de manifeste, jamais de
   `draft-*`), à décider avec `architecte`. Tant qu'elle n'existe pas, aucune publication de
   production n'est possible, donc aucune inscription (une version en vigueur est exigée à
   l'inscription, `05` RG23 à RG29).
4. Vérifier : `GET /v1/terms/current?document=terms_of_service&locale=fr` (et `en`, et les deux
   autres documents) renvoie le libellé définitif, `requiresAcceptance` attendu, empreinte égale à celle
   du manifeste ; pages `/fr/cgu`, `/en/terms`, `/fr/confidentialite`, `/en/privacy`, `/fr/cookies`,
   `/en/cookies` rendues sans `noindex` en production.

## 13. Relectures humaines du Lot 1 (`18` §10, l. 1401 à 1417)

Reprise de la définition du « prêt à livrer » du Lot 1 : les cases **non automatisables** relèvent
du fondateur ou de ses relecteurs ; les autres sont constatées par la suite de tests (`18` l. 1403 à
1412). Toute case non cochée doit être **acceptée et datée par le fondateur** (`18` l. 1348).

- [ ] **Aucune garde n'est levée sans son remplaçant dans le même commit** (G2 → CSP testée + garde
      resserrée ; G4 et G6 → gardes d'absence) — `18` §5. G5, levée au J1, est complétée par T7 en
      entier, en intégration.
- [ ] Le module fictif, `IS_MOCKUP` et le bandeau « Maquette » n'existent plus dans le dépôt.
- [ ] Une inscription réelle crée un compte et quatre lignes de file, et aucun appel sortant n'est
      possible depuis `staging` *(texte historique de `18` ; depuis D70, `staging` envoie comme la
      production : à reformuler à la clôture du J9)* (T17).
- [ ] *(D67)* Une inscription de `staging` finit `succeeded` avec `dry_run` sur `brevo_contact` et la
      bienvenue *(historique ; depuis D70, envois réels)* ; aucune ligne en échec de configuration
      (TM1.11 à TM1.16).
- [ ] **Non automatisable** *(D67)* : identifiants de listes et de modèles Brevo **de production**
      renseignés dans `leads.sync_settings` de production, puis premier démarrage du `worker` de
      production **accepté** par le contrôle de `05` RG162 (`21` §5.8).
- [ ] La version de CGU acceptée est enregistrée par partie (TM10.4).
- [ ] **Non automatisable** : relecture humaine des textes FR et EN des pages publiques et des
      e-mails transactionnels.
- [ ] **Non automatisable** : `expert-conformite-rgpd` a rendu son avis sur A7 / D33, et le juriste a
      validé — sans quoi la mise en ligne n'a pas lieu (R4 du cadrage).
- [ ] **Non automatisable** : documents légaux relus par un juriste, incluant la clause de
      non-contournement (A5), la supervision des conversations (A10) et la conservation probatoire
      (R-1).
- [ ] **Non automatisable** : SPF, DKIM, DMARC en place et vérifiés sur le domaine d'envoi.
- [ ] **Non automatisable** : `staging` non accessible publiquement et non indexé (I-6).

Cases communes à tous les lots (`18` l. 1352 à 1361) : `pnpm check` vert ; critères d'acceptation de
`product-owner` vérifiés ; aucun test instable (trois exécutions identiques) ; non-régression ;
`expert-cybersecurite` sans objection ; `expert-conformite-rgpd` sans objection ; cas limites couverts
ou acceptés ; contrôle visuel (dark theme, tokens, contrastes, mobile).

## 14. Documentation tenue à jour

- `21` §J9 : ligne du commit 11 ; commit déployé, date et auteur à chaque fusion.
- `staging.md` §5 reste la liste fermée de référence : toute variable nouvelle y entre.
- Ce runbook : renseigner les `[à renseigner]` au fur et à mesure (rétention PITR, sous-domaines,
  canal d'invitation, fréquence du test de restauration).
- `decisions.md` : D33, D35, D36, et la décision sur l'amorçage du premier `admin` de production.
