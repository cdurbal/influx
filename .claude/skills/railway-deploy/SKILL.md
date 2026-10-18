---
name: railway-deploy
description: Configurer un service, un environnement ou un déploiement Railway pour INFLUX, et diagnostiquer un déploiement en échec (CLI `railway` liée à staging). À utiliser pour toute mise en ligne, création d'environnement, configuration de variables de déploiement, lecture de journaux Railway ou incident de staging ou de production.
---

# Déploiement Railway

Railway héberge l'API, le worker et les deux fronts d'INFLUX. Objectif : des déploiements
reproductibles, traçables et réversibles.

Agents concernés : `integrateur` (principal), `architecte`, `expert-cybersecurite`.
Procédure de mise en place et variables par service : **`docs/mvp/runbooks/staging.md`**
(étape 5 et section J7), qui fait foi. Ce skill ne la recopie pas.

## État actuel (2026-10-17)

- Projet Railway **`Influx`** (espace « Cyrille's Projects »), environnements **`production`** et
  **`staging`** (`staging` forké de `production`).
- Quatre services, mêmes noms dans les deux environnements, réglages dans `deploy/railway/<service>.json`
  **saisis à la main** dans l'interface (Railway refuse le config-as-code aux services créés depuis
  le 2026-08-28 ; passage à son *Infrastructure as Code* à arbitrer avant le 2026-12-01) :

  | Service | Démarrage | Santé | Domaine public |
  |---|---|---|---|
  | `api` | `node apps/api/src/main.ts` | `/health` | aucun (joint par `api.railway.internal:3100`) |
  | `worker` | `node apps/api/src/worker.ts` | aucune | **aucun attendu** |
  | `web` | `pnpm --filter @influx/web start` | `/fr` | `*.up.railway.app` |
  | `backoffice` | `pnpm --filter @influx/backoffice start` | `/` | `*.up.railway.app`, distinct de `web` |

- Déploiement : push sur `main` → CI → « Wait for CI » → déploiement automatique en `staging`.
  Un déploiement `SKIPPED` = CI rouge ou *Watch Paths* non touchés, pas une panne.
- **CLI `railway` installée**, authentifiée par un **jeton limité à `staging`** (2026-10-18), dépôt **lié à `staging`**
  (aucun service lié par défaut : toujours passer `-s <service>`).

## CLI : ce que l'agent fait seul, et ce qu'il ne fait jamais

**Permis sans demander (lecture seule, `staging` uniquement) :**

```sh
railway status                                  # projet, environnement lié, état des services
railway deployment list -s <service>            # historique (SUCCESS, CRASHED, SKIPPED…)
railway logs -s <service> -n 100                # journal d'exécution du dernier déploiement
railway logs -s <service> -b -n 200             # journal de construction
railway logs -s <service> --http -n 50          # requêtes HTTP (web, backoffice)
railway metrics -s <service>                    # ressources
```

Diagnostic d'une variable **sans en lire la valeur** : n'afficher que les noms, ou une partie non
secrète (rôle d'une URL de base), jamais la valeur elle-même :

```sh
railway variables -s <service> --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Object.keys(JSON.parse(s)).sort().join('\n')))"
```

**Exploitation de `staging` par l'agent, sans demander (D70, 2026-10-18)** : toute commande
portant `-e staging` qui lit ou configure (variables, réglages), `railway redeploy` et
`railway restart` d'un service de `staging`, le retour arrière de `staging` (procédure du runbook),
`railway domain` sur un service de `staging`, et `railway api` avec
`--raw-var e=1e43a0b9-c02a-460b-9d29-41fd2f7fe41b` (réglages sans commande dédiée : *Watch Paths*,
*Restart Policy*, *Draining*). Règles de permission : `.claude/settings.local.json` du poste
aujourd'hui, `.claude/settings.json` après le commit 0 de `jalons/d70-plan.md` ; une commande par
appel, sans pipe, sinon la règle ne s'applique pas. Un secret n'est jamais tapé ni affiché par
l'agent : il passe par `--stdin` depuis `apps/api/.env.local` (valeurs de `staging`) ou depuis un
générateur. **Depuis le 2026-10-18, la CLI tourne sur un jeton de projet limité à `staging`**
(`RAILWAY_TOKEN`, `.claude/settings.local.json`) et le poste n'a plus de session d'utilisateur :
la production est techniquement hors d'atteinte. `railway whoami` échoue, c'est normal. Ne jamais
lancer `railway login` pour contourner ce jeton.

**Interdit à l'agent, même en `staging` (ou seulement sur confirmation explicite du fondateur, pour cette action-là) :**

| Commande | Pourquoi |
|---|---|
| `railway variables` sans filtre, `railway variables --kv` | Affiche les secrets en clair dans le terminal et la conversation |
| `railway run`, `railway shell` | Inutiles (`.env.local` porte déjà `staging`) et risquent d'afficher les secrets |
| `railway up` | Déploie le code local en contournant la CI et « Wait for CI » : le commit déployé n'est plus traçable |
| `railway down`, `railway delete`, `environment new/delete`, `add`, `service` (création), `init` | Crée ou supprime une ressource (`CLAUDE.md` §7 règle 4) |
| `railway link`, `railway environment` (changement de lien) | Pourrait contourner la règle sur la production |
| `railway ssh`, `railway connect` | Accès interactif au conteneur ou à la base |
| `-e production` sur **n'importe quelle** commande, lecture comprise | La production n'est consultée que sur demande du fondateur |
| `railway setup agent`, `railway mcp`, `railway skills` | Installe de l'outillage tiers non arbitré (`architecte`) |

Toujours ajouter `-s <service>` ; ne jamais changer le lien (`railway link`, `environment`) pour
contourner la règle sur la production.

## Règles non négociables

1. **Deux environnements**, strictement cloisonnés : `staging` et `production`. **`staging` se
   comporte exactement comme la production** (D70) : seules diffèrent `INFLUX_ENV`, les comptes et
   clés, le domaine d'envoi, `noindex` et le bandeau. Une autre différence est un défaut.
2. **Clés distinctes par environnement.** Jamais de clé Brevo ou Apollo de production en `staging` ;
   `staging` porte celles de ses propres comptes Brevo et Apollo (D70).
3. **Projets Supabase distincts**, aucune donnée de production en `staging`.
4. **Aucun secret dans le dépôt** ; hors `apps/*/.env.local` (valeurs de `staging`, D70), aucun
   fichier local n'en porte ; aucune valeur recopiée dans la conversation, un journal ou un document
   (skill `env-secrets`). Pas de capture du *Raw Editor*.
5. **Déploiement traçable** : `RAILWAY_GIT_COMMIT_SHA`, date, environnement.
6. **Rollback connu avant déploiement** (procédure « Retour à la version précédente » du runbook ;
   `api` et `worker` partagent le code et reviennent **ensemble**).
7. **Migrations additives**, appliquées par le job CI « Migrate staging », jamais par Railway ni à la main.
8. **La production ne se déploie pas sans validation explicite du fondateur.**

## Déployer

1. [ ] CI verte sur `main` (`gh run list --limit 5`), dont « Migrate staging »
2. [ ] Variables nouvelles du jalon posées en `staging` **par l'agent** (D70 ; valeurs depuis
   `.env.local` ou un générateur, par `--stdin`)
3. [ ] `railway deployment list -s <service>` : les services touchés sont `SUCCESS` sur le même commit
4. [ ] Journaux de démarrage propres (ci-dessous), vérification fonctionnelle en `staging`
5. [ ] Validation explicite du fondateur pour la production, puis déploiement
6. [ ] Consigner le commit déployé dans `21-plan-de-developpement.md`

## Journaux attendus au démarrage

- `api` : `database pool verified` pour `influx_app`, `influx_auth_login`, `influx_ops_login` ;
  aucun `database pool refused`.
- `api` / `worker` : aucun `invalid configuration, refusing to start` (la ligne `issues=[…]` nomme
  la variable fautive, jamais sa valeur).

## Diagnostiquer un déploiement en échec

Méthode : `railway status` → `railway deployment list -s <service>` → `railway logs -s <service>`
(ou `-b` si la construction échoue). Lire **avant** de modifier ; changer **une seule chose à la fois**.

| Symptôme | Pistes |
|---|---|
| `CRASHED`, `invalid configuration, refusing to start` | Variable absente ou fausse : `issues` la nomme ; vérifier noms et rôle des URL avec le filtre ci-dessus |
| `must connect as role X` | URL d'un autre rôle collée ; régénérer avec `staging:role-passwords` (runbook étape 3), l'agent la pose par `--stdin` |
| `SELF_SIGNED_CERT_IN_CHAIN` | `DATABASE_CA_CERT` absent sur `api` ou `worker` (EC-34) |
| `SKIPPED` en série | CI rouge ou *Watch Paths* non touchés (I-4 non attesté ne bloque plus `main`, seulement `production`, D71). Statut GitHub du commit : `gh api repos/cdurbal/influx/commits/<sha>/status --jq '.statuses[]'` |
| « No deployment needed - watched paths not modified » alors que le commit touche le service | *Watch Paths* saisis en **une chaîne séparée par des virgules** : un seul motif qui ne correspond à rien. Un motif **par ligne** (incident du 2026-10-17). Lecture : `railway api 'query{serviceInstance(serviceId:"<id>",environmentId:"<id>"){watchPatterns}}'` |
| Échec au build | `RAILPACK_NODE_VERSION`, dépendances, erreur TypeScript non vue en CI |
| Front en ligne, appels API en échec | `INFLUX_API_INTERNAL_URL` / secret interne du front, service `api` arrêté |
| Leads non synchronisés | Avant la bascule D70, `SYNC_MODE=dry_run` en staging est normal ; après, c'est un défaut (`live` attendu). Sinon clé Brevo ou Apollo, réglage `leads.sync_settings` manquant (D67), file bloquée |

## Rollback

Procédure du runbook (« Retour à la version précédente ») : *Redeploy* du dernier déploiement sain
pour chaque service touché, migrations jamais annulées, consigner heure, commit et cause.
En `staging` : exécuté par l'agent, sans demander (D70), puis signalé au fondateur. En production :
par le fondateur ou sur sa confirmation explicite.
