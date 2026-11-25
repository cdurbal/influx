---
name: env-secrets
description: Ajouter, faire tourner ou documenter une variable d'environnement ou un secret INFLUX (Supabase, base de données, Brevo, Apollo.io, Railway, GitHub) — nommage, cloisonnement par environnement, exposition côté client, garde-fou d'environnement, procédure de rotation et de fuite. À utiliser dès qu'une nouvelle clé ou configuration externe apparaît.
---

# Variables d'environnement et secrets

Une clé qui fuit, c'est la base de contacts exfiltrée ou des e-mails envoyés au nom d'INFLUX. Une clé
mal cloisonnée, c'est un e-mail de test parti vers de vrais clients.

Agents : `integrateur` (principal), `expert-cybersecurite` (**veto sur `production`**, D71),
`architecte`. Architecture : `CLAUDE.md` §5 et §8. Exploitation de `staging` (D70) :
`docs/mvp/runbooks/staging.md`.

## Règles non négociables

1. **Aucun secret dans Git.** `.env*` est ignoré, sauf `.env.example` (valeurs **factices**).
2. **Aucune variable `SUPABASE_*` n'atteint un navigateur**, jamais préfixée `NEXT_PUBLIC_`
   (`CLAUDE.md` §5 règle 1 : le front ne porte aucune clé Supabase, pas même `anon`). La clé `anon`
   n'est pas inoffensive : elle ouvre PostgREST au navigateur, et l'anonymisation repose sur le fait
   que **le navigateur n'écrit jamais la requête**.
3. **Aucun secret dans un bundle front.** Tout ce qui est préfixé pour le client est public par
   construction ; seules valeurs autorisées côté navigateur : `INFLUX_ENV`, `INFLUX_PUBLIC_SITE_URL`.
4. **Les fronts ne détiennent aucun secret de service** (Supabase, base, Brevo, Apollo) : seulement
   le secret interne d'appel à `apps/api` (D64). Ils ne lisent `process.env` que dans `src/config/`
   (règle ESLint) et n'importent pas `@supabase/*`, `drizzle-orm`, `pg`, `postgres` (`02` §13.2).
5. **Les clés de service (Supabase, Brevo, Apollo) ne quittent jamais `apps/api`** (services
   Railway `api` et `worker`).
6. **Clés distinctes par environnement, sans exception.** La clé de production n'existe **nulle part
   ailleurs qu'en production** : ni `staging`, ni fichier local, ni variable de compilation, ni
   journal, ni ticket (`16` RG115). **`.env.local` = `staging`, et uniquement `staging`** (D70, amende
   D62) : tout agent peut le lire et passer ses valeurs à une commande (`--stdin`, `--env-file`),
   **jamais les afficher ni les recopier** (réponse, document, commit, journal, ticket), jamais y
   écrire une valeur de production, jamais le charger dans un test automatisé (CI et tests : pile
   locale et doublure, `16` RG148). Local = `.env.local`, jamais `.env`, que la maquette de `demo`
   charge automatiquement.
7. **Aucune donnée de production dans `staging`** (verrou 4, `03` §6.8, B9) : `supabase/seed` et
   testeurs internes, jamais une copie de la production.
8. **Aucun secret dans les journaux**, messages d'erreur, tickets ou captures ; pas d'adresse e-mail
   complète ni de corps de message.
9. **Validation au démarrage** (schéma zod) : variable requise manquante ou incohérente = **échec du
   démarrage** avec message clair, jamais un avertissement.
10. **Toute variable est documentée** dans `.env.example` **avant** d'être utilisée.

## Nouvelle variable ou nouveau secret : check-list

1. **Classer** : publique ou secrète (doute = secrète). `SUPABASE_*`, `*DATABASE_URL`, `BREVO_*`,
   `APOLLO_*` : serveur, sans discussion.
2. **Nommer** en `SCREAMING_SNAKE_CASE`, explicite, préfixé par le service. `NEXT_PUBLIC_` seulement
   pour une valeur qu'on accepterait de publier sur la page d'accueil.
3. **Documenter** dans `.env.example` : nom, rôle, format, service porteur, **valeur factice**.
4. **Renseigner par environnement et sur le seul service qui en a besoin** (une variable posée « au
   cas où » sur les quatre services est une fuite en attente) :
   - local : `apps/api/.env.local` (valeurs de `staging`, **jamais `DIRECT_DATABASE_URL`**, lu par
     `pnpm dev` et `pnpm dev:worker`, qui agissent donc **sur `staging`**, jamais par un test) ;
     `apps/<front>/.env.local` (aucun secret de service, règle 4). Le code ne lit jamais de fichier :
     `src/config/` ne lit que `process.env` ;
   - CI : GitHub Secrets (seul endroit de `DIRECT_DATABASE_URL`) ;
   - exécution : variables Railway du service porteur ; **ajouter le nom à la liste fermée du
     runbook §5** (contrôlée par `staging:check`).
5. **Valider au démarrage** (zod, `apps/api/src/config/schema.ts` ou `src/config/` du front).
6. **Brancher les contrôles CI-1 à CI-6** (`references/garde-fou-et-mise-en-service.md`).
7. **Rotation** identifiée (A ou B, `references/rotation-et-fuite.md`) et écrite.
8. **Signaler au fondateur** toute action qui lui revient (compte, clé, DNS : `prerequis.md` §14.3).
9. Aucune valeur en clair dans journaux ou bundle ; `.gitignore` couvre `.env*`.

## Environnements

| | Pile locale / CI / tests | `staging` | `production` |
|---|---|---|---|
| Clés Brevo, Apollo, Supabase | Doublure en CI et tests ; `.env.local` = `staging` | Comptes et projet **de `staging`** | Propres à la production, **jamais ailleurs** |
| `INFLUX_ENV` | — | `staging`, partout | `production` |
| `BREVO_MODE` / `SYNC_MODE` | `disabled` ou `redirect` / `dry_run` | `live` / `live` (D70) | `live` / `live` ; `dry_run` refusé |
| Liste blanche de destinataires | Oui | Non (variables refusées) | Sans objet |
| Données | Synthétiques | `supabase/seed` + testeurs | Réelles |
| Accès à `production`, lecture comprise | — | Agents (D70) | **Confirmation du fondateur** (`CLAUDE.md` §7 règle 4) |

## Où lire la suite

| Fichier | Quand le lire |
|---|---|
| `references/catalogue-variables.md` | Nommer ou placer une variable ; savoir quel service porte quoi ; rôles et URL de base, refus de démarrage ; variables Brevo, Apollo, secrets internes |
| `references/rotation-et-fuite.md` | Faire tourner une clé (procédures A et B) ; toute suspicion de fuite |
| `references/garde-fou-et-mise-en-service.md` | Toucher à un verrou ou à un contrôle CI ; ouvrir un nouvel environnement ; points restant à confirmer |
