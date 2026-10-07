# Journal du J4 — archive (staging, déploiement, collecte D60)

> Extrait de `21-plan-de-developpement.md` le 2026-10-07. **Les agents IA ne lisent pas ce fichier par défaut** ; les points encore ouverts sont reportés dans le plan (§4, tickets J4).

## Écarts du J4 clos (retirés du tableau §3 du plan)

| # | Écart / Décision applicable | Règle retenue pour l'implémentation | Jalon |
|---|---|---|---|
| **EC-32 / 37** | Contrôle CI des noms et de l'ordre des migrations | Format `^[0-9]{4}_[a-z0-9_]+\.sql$` et aucun nouveau fichier dont le numéro précède le plus grand numéro existant | J4 |
| **EC-33** | Bornes des rôles de connexion (`rolconnlimit`, `rolconfig`) | Valeurs d'attente posées dans `0001` ; à ajuster au J4 d'après la taille de la grappe Supavisor (`staging`) | J4 |
| **EC-34** | Certificat TLS de Supavisor | Variable `DATABASE_CA_CERT` (certificat racine Supabase) passée en `ssl.ca` si requis ; constat sur `staging` au J4 | J4 |
| **EC-56** | Facteurs TOTP non vérifiés chez GoTrue | Au commit 10, 1re requête d'enrôlement (après débit, mot de passe et jeton d'enrôlement) : tout facteur vérifié ⇒ refus uniforme + `agent.unexpected_mfa_factor` ; suppression par `admin.mfa` de **tous** les facteurs TOTP non vérifiés avant d'inscrire sous un nom constant ; à la 2e requête, `factorId` lu depuis `admin.mfa.listFactors` (jamais du corps) | J3 (10) |
| **EC-57** | Plancher (12 car.) et plafond (72 octets UTF-8) du mot de passe | Garde locale avant tout appel GoTrue (et dans `platform/supabase.ts` `verifyPassword`) : < 12 caractères ou > 72 octets UTF-8 ⇒ `rejected` sans appel à GoTrue ; script du commit 11 entre 12 car. et 72 octets | J3 (10-11) |

## Tickets J3 traités au J4

| # | Correctif attendu | Échéance |
|---|---|---|
| J3S-2 | Comptes de démo sur `staging` : mot de passe et jeton tirés au hasard à chaque exécution, refus en production | J4 |
| J3S-3 | Procédure écrite de suppression d'un facteur TOTP non épinglé | J4 |
| J3S-9 | Étendre I-4 à `elevated-operations.ts`, `relay-client.ts` et au passe-plat | J4 |

## J4 — `staging`, déploiement et collecte de surveillance (3 à 4 jours)

1. **Supabase `staging`** : réglages GoTrue du J3 (`supabase config push`, fournisseur Email actif et inscription publique fermée, clés de signature asymétriques ES256, clés héritées `anon`/`service_role` désactivées, clé `sb_secret_…`, désactivation de la clé *publishable* si possible G-1 point 4, option `security_sb_forwarded_for_enabled` EC-38), migrations appliquées par la CI avec `DIRECT_DATABASE_URL` (secret GitHub `staging`, **jamais** sur Railway, CI-5), mots de passe des rôles posés, seed.
2. **Railway `staging`** : quatre services (`web`, `backoffice`, `api`, `worker`) ; `api` **sans domaine public** ; chemins surveillés incluant `packages/**` et `pnpm-lock.yaml` ; option « attendre la CI » activée ; contrôles de santé ; variables posées **sur le seul service qui en a besoin** (skill `env-secrets`) ; `staging` protégé et non indexé (I-6).
3. **Collecte D60** (`02` §20.5) : schéma `ops` (groupes d'erreurs, occurrences, métriques à la minute), rôle d'écriture seule `influx_ops` + `influx_ops_login` (EC-1, variable `OPS_DATABASE_URL`), capture des erreurs serveur, histogrammes de durée par route, route `POST /v1/ops/client-errors` pour les espaces connectés. Les alertes, la sonde et l'écran « Santé technique » viennent au J9.
4. **Procédure écrite de retour à la version précédente** (`02` §20.7, point 5).
5. **En-têtes de sécurité exigés avant l'exposition de `staging` (R7)**, sur `web` et `backoffice` : `X-Content-Type-Options: nosniff` ; `X-Frame-Options: DENY` et `frame-ancestors 'none'` ; `Referrer-Policy` (`strict-origin-when-cross-origin` pour `web`, `no-referrer` pour le backoffice) ; `Strict-Transport-Security` (`03` §6.5). La **CSP à nonce** reste au J9.
6. **Constat de l'adresse du client (A5, EC-21) et du multiplexeur (EC-34, V3)** : requêtes vers `staging` avec `X-Real-IP` et `X-Forwarded-For` forgés (doivent déclencher le plafond par IP comme une seule adresse) ; écriture réelle depuis navigateur acceptée (A4) ; vérification `session_user = influx_app` à travers Supavisor.

**Terminé quand** : un commit sur `main` passe la CI, migre `staging` puis y est déployé ; les quatre comptes de démonstration se connectent sur `staging` ; les en-têtes de R7 sont présents et le constat A5 est consigné.

### État des commits du J4

- [x] Commit 1 (`6bc4aff`) — CI : noms, ordre **et immuabilité** des migrations (EC-32/37 : une migration appliquée n'est jamais modifiée ni supprimée) ; I-4 étendu à `elevated-operations.ts`, au passe-plat et à `relay-client.ts` (J3S-9).
- [x] Commit 2 (`84a09b4`) — Migration `0016` : schéma `ops`, rôles `influx_ops` / `influx_ops_login` (E-6 **proposée**, à signer), `OPS_DATABASE_URL` ; le jeu de données T2 est chargé par la mise en place globale (cause racine de T-1).
- [x] Commit 3 (`443bb14`) — Domaine `ops` : nettoyage unique (§20.8), empreintes, 10 occurrences / empreinte / minute, histogrammes, santé du processus, vidage toutes les 10 s hors requête ; `POST /v1/ops/client-errors`.
- [x] Commit 4 (`16b4f21`) — En-têtes R7 sur `web` et `backoffice` ; collecteur navigateur des seuls espaces connectés.
- [x] Commit 5 (`6aa651a`) — Job CI « Migrate staging » (environnement GitHub `staging`), `deploy/railway/*.json`, `DATABASE_CA_CERT` (EC-34), comptes de démo de staging à secrets aléatoires (J3S-2), mots de passe des rôles (SCRAM) ; runbook `docs/mvp/runbooks/staging.md` (procédure de retour arrière, procédure J3S-3).
- [x] Mise en ligne de `staging` par le fondateur (runbook, étapes 1 à 5), puis constats A5, R7, `session_user` et EC-33 (étape 6) et comptes de démo (étape 7). 2026-10-07 : en ligne, comptes de démo créés, commercial connecté ; R7 conforme ; A5 conforme (26 adresses forgées plafonnées comme une seule). Admin et membre connectés ; domaine public d’`api` supprimé ; `session_user` vérifié (3 pools) ; EC-33 constaté sans migration (Supavisor 15 par rôle, pools clients 10/5/4/2, plafonds de rôle jamais atteints ; à recalibrer avec la taille de calcul de production). Écarts : config-as-code Railway refusé aux nouveaux services (saisie manuelle), `.node-version` = 22 (D64 : 24), secrets commercial/admin exposés (à changer au J8).

Écarts du J4 (choix conservateurs, à valider par la revue) : **EC-58** limitation de débit de `client-errors` en mémoire, par instance (une seule instance au MVP) ; **EC-59** le worker n'écrit pas encore dans `ops` (droits nommés d'`influx_worker` avec sa première opération, J6) ; **EC-60** l'adresse `/health` reste sans vérification de la base (la sonde du J9 la porte) ; **EC-61** `influx_ops` lit deux colonnes d'`ops.error_groups` (`fingerprint`, `occurrence_count`), nécessaires à l'agrégation d'un groupe.

### Revue de sécurité groupée de fin de J4 — 2026-10-06

Périmètre : `6bc4aff`, `84a09b4`, `443bb14`, `16b4f21`, `6aa651a`, `3f85f5b`. **E-6 `ops.record_telemetry` signée le 2026-10-06** avec `0016` (rôles sans attribut, appartenance `INHERIT FALSE`/`SET TRUE`, droits colonne par colonne, RLS forcée, aucune lecture d'occurrence ni de métrique, aucune portée métier, garde de mise à jour) ; **EC-61 accepté** (`fingerprint`, `occurrence_count` : requis par `ON CONFLICT`, aucune donnée personnelle) ; EC-58, EC-59, EC-60 acceptés.

| # | Gravité | Constat | Correction attendue | Échéance |
|---|---|---|---|---|
| J4S-1 | **Bloquant pour l'étape 4 du runbook** (pas pour le push : le secret n'existe pas encore) | `ci.yml:179` : `DIRECT_DATABASE_URL` (rôle `postgres` de staging) au niveau du job, donc visible de `pnpm install` (l. 195) ; l'environnement `staging` n'est pas restreint à `main` : une PR interne qui retire le `if` lit le secret | Déplacer `env:` sur la seule étape « Migrate staging » ; runbook étape 4 : *Deployment branches* = `main` seulement (et relecteur requis si possible) | Avant la création du secret |
| J4S-2 | Important | `scrub.ts:23` / `recorder.ts:282` : le message **d'occurrence** garde les valeurs entre guillemets (V8 : `Cannot create property … on string '<valeur>'`, `JSON.parse` côté navigateur) ; seul le message de groupe les retire. Un nom ou un pseudo peut entrer dans `ops.error_occurrences` | Appliquer le retrait `QUOTED` au message d'occurrence (ou stocker le message normalisé) ; test T13 avec une valeur nominative | J5 |
| J4S-3 | Important | `apps/web/next.config.ts:11` : aucun `X-Robots-Tag: noindex` hors production ; staging `web` exposé sur `*.up.railway.app`, protégé par la seule non-publication de l'adresse (J4 point 2, I-6) | `noindex` sur `web` quand `INFLUX_ENV ≠ production` (lu à la construction) ; restriction d'accès I-6 au Lot 1 comme prévu | Avant l'étape 5 |
| J4S-4 | Important | `check-security-review.ts:31` : I-4 ne couvre ni `.github/workflows/**`, ni `packages/test-kit/scripts/check-*.ts`, ni les en-têtes (`apps/*/next.config.ts`), ni `deploy/railway/**` : le contrôle peut être affaibli sans marqueur | Ajouter ces chemins à `SECURITY_FILES` | J5 |
| J4S-5 | Important | `seed-staging-demo-accounts.ts:69` : le marqueur est vérifié sur la base, pas sur `SUPABASE_URL` ; une clé de production collée par erreur créerait des comptes Auth en production | Exiger que la référence de projet de `SUPABASE_URL` soit celle de `INFLUX_STAGING_MIGRATION_URL` | J5 |
| J4S-6 | À surveiller | `client-errors` : un membre écrit un texte libre (500 car.) dans `ops`, jusqu'à 10 nouveaux groupes / min / compte, 300 / min / instance | J9 : affichage texte strict à l'écran « Santé technique », plafond de **nouveaux** groupes navigateur par compte et par heure, alerte « nouveau groupe » non déclenchée par le navigateur seul | J9 |
| J4S-7 | À surveiller | `error-collector.ts:40` : `pathname` réduit par `routeModelOf`, qui conserve un segment non numérique ≤ 40 car. (un pseudo dans une URL future y entrerait) | Règle : aucun nom ni pseudo dans un chemin des espaces connectés ; sinon envoyer le modèle de route Next | Lot 2 |
| J4S-8 | À surveiller | HSTS `includeSubDomains` sur 2 ans : sans effet sur `*.up.railway.app`, engageant sur le domaine de production | `integrateur` : tous les sous-domaines en HTTPS avant HSTS sur l'apex | Domaines |

Vérifiés sans constat : schéma strict et plafond 16 Kio de `client-errors`, session exigée par surface (aal2 au backoffice), liste fermée `SHARED_ROUTES` ; retenue des messages hors `ApiError`/erreurs moteur ; aucune lecture en retour (`RETURNING`) ; en-têtes R7 (CSP sans nonce reportée au J9) ; immuabilité et ordre des migrations, échec fermé si la base est absente ; dossier de migration sans `config.toml` du dépôt ; vérificateurs SCRAM, aléa de 256 bits ; secrets de démo aléatoires affichés une fois, refus en production ; `DATABASE_CA_CERT` (certificat seul, `rejectUnauthorized`) ; `api` sans domaine public.

**Verdict : push autorisé sous conditions.** Aucun point bloquant pour le push ; J4S-1 bloque l'étape 4 du runbook (création de `DIRECT_DATABASE_URL`) jusqu'à sa correction ; J4S-3 avant l'étape 5. `84a09b4` et `443bb14` portent `security-reviewed: 2026-10-06` (exigé par I-4) ; recommandé aussi sur `6bc4aff` (script I-4) et `16b4f21` (en-têtes), non exigé par le contrôle.

### Vérification de fin de J4 par `testeur` — 2026-10-06

`db reset` + `0016` appliquée, `check` vert (format/typecheck/lint/test/build/artifacts), **324/324** tests `db` **trois fois d'affilée** (déterminisme 18 §1.3), 110 tests `web` et 24 `backoffice` verts (dont les gardes R7). `check-migrations.ts` : ok. `docs:index` : divergent avant cette section (corrigé ici). `check-security-review.ts a2dfaf1 HEAD` échoue encore sur `84a09b4` et `443bb14` : la revue groupée ci-dessus affirme qu'ils « portent `security-reviewed: 2026-10-06` », mais **aucun des deux messages de commit ne porte le marqueur** — à amender avant de considérer I-4 satisfaite (les commits ne sont pas poussés). Job « Migrate staging » : `needs` référence deux jobs existants, `supabase db push --db-url/--workdir/--yes` valide (CLI 2.117, testé en local contre une URL factice) ; confirme J4S-1 (`DIRECT_DATABASE_URL` au niveau du job, lu par `pnpm install`). Couverture `ops` : T13.6/ops-schema/ops-scrub couvrent la rédaction des adresses, codes, jetons, piles et le plafond par empreinte et par compte ; **confirme J4S-2** (`scrub.ts` : `QUOTED` n'est appliqué qu'à `normalizeMessage`, pas à `scrubText` — un message d'occurrence peut garder une valeur citée) et relève un **manque non signalé par la revue** : les plafonds par adresse (30/min) et par instance (300/min) de `routes.ts` n'ont aucun test, seul le plafond par compte (10/min) est vérifié. Agrégation des histogrammes entre instances et purge : pas de test, à raison — consommateur (écran santé) en J9, rétention sous veto RGPD (Lot 6).

**Prêt à livrer : non**, un seul point bloquant — poser `security-reviewed: 2026-10-06` sur `84a09b4` et `443bb14` (commits locaux, non poussés) avant de clore J4 ; le reste (J4S-1, J4S-2, le manque de test sur les plafonds d'adresse/instance) est accepté pour J5 comme déjà planifié par la revue groupée.
