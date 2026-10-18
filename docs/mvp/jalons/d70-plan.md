# Plan D70 — `staging` iso-production et autonomie des agents

> **Point d'entrée de toute session du chantier D70.** Décision : `decisions.md` D70 (tranchée par le
> fondateur le 2026-10-18). Ce chantier passe **avant la suite du J9**. Il débloque les critères
> `staging` des J6 à J8, qui bloquent la mise en production, et retire au fondateur les gestes
> d'exploitation de `staging`. Lire ensuite **seulement** les tranches citées : `02` §12.4,
> `03` §6.8 et T17, `16` §J (RG115 à RG120), `05` RG162 et RG164, `18` T17, skills `env-secrets` et
> `railway-deploy`, runbook `staging`.

## Objectif et critère de fin

`staging` fait **tout ce que fera la production** : un inscrit reçoit réellement son code et son
e-mail de bienvenue, devient un contact de la liste Brevo de son rôle et, si les réglages
l'autorisent, un contact Apollo ; une désinscription faite dans Brevo revient par le webhook. Les
seules différences sont celles de la liste fermée de D70 (1). Les agents déploient, configurent et
constatent `staging` **sans le fondateur** ; la production n'est jamais touchée.

**Terminé quand**, sur `staging`, avec une adresse de testeur interne :

- [ ] l'inscription marque **et** l'inscription créateur reçoivent le code par e-mail réel (`api`
      en `live`), puis la bienvenue (`worker` en `live`) ;
- [ ] chaque contact est dans la liste Brevo de son rôle avec les attributs de `16` §M4 ;
- [ ] le contact Apollo est créé (pays autorisé dans les réglages de `staging`) ou écarté pour un
      motif de qualification, jamais `skipped_no_credentials`, `skipped_non_production` ni `dry_run` ;
- [ ] une désinscription dans le compte Brevo de `staging` donne exactement une ligne dans
      `leads.brevo_inbound_events` et le consentement révoqué (source `brevo_webhook`) ;
- [ ] « mes données » (suppression) se propage jusqu'à Brevo et Apollo ;
- [ ] le worker de `staging` refuse de démarrer si on lui retire une variable exigée en production
      (constat sur une copie de configuration en local, jamais en retirant une variable de Railway) ;
- [ ] `pnpm --filter @influx/api staging:check` (commit 3) est vert ;
- [ ] tout a été fait par un agent, et aucune commande n'a visé la production.

Ces constats **soldent les critères `staging` des J6, J7 et J8** (`21` §5) : les cocher dans `21`.

## Préalables du fondateur (hors code, dans cet ordre)

| # | Action | Bloque |
|---|---|---|
| P1 | **Fait (2026-10-18)** : `.env.local` porte les seules valeurs de `staging` ; lecture ouverte aux agents (`.claude/settings.json`) | — |
| P2 | **Fait (2026-10-18).** Domaine d'envoi de `staging` : **`influx.cadaero.ovh`**, authentifié et vérifié dans le **compte Brevo de `staging`** (constat par l'API). Reste à l'agent, au commit 4 : créer l'expéditeur `@influx.cadaero.ovh` par l'API et y basculer `BREVO_SENDER_TRANSACTIONAL` et `BREVO_SENDER_MARKETING`, aujourd'hui en `@cadaero.com` (`.env.local`, Railway). Le sous-domaine de marque `influx` de `cadaero.com` ne sert qu'aux liens de suivi | — |
| P3 | **Fait (2026-10-18).** Jeton de projet Railway limité à l'environnement `staging`, dans `RAILWAY_TOKEN` de `.claude/settings.local.json` › `env` (ignoré par Git, jamais tapé ni affiché par l'agent) ; session OAuth du fondateur retirée du poste (`railway logout`). Constats : `railway status` → `Influx` / `staging` ; `railway deployment list -s api -e staging` répond ; `railway whoami` refusé (jeton de projet, sans identité d'utilisateur) ; aucune session d'utilisateur dans `~/.railway/config.json`. La production n'est plus joignable depuis le poste | — |
| P4 | ~~Jeton Supabase~~ **Sans objet (vérifié le 2026-10-18)** : la CLI est connectée au compte Supabase de `staging`, qui ne voit qu'un projet (`Influx`, `eu-central-1`, lié au dépôt) | — |
| P5 | ~~Accès restreint à `staging`~~ **Refusé par le fondateur le 2026-10-18** (comptes de `staging` distincts de la production) : risque D70 (a) accepté | — |

## Commits prévus

0. **Gouvernance et outillage** (`integrateur`, avis `architecte`) — sans code applicatif.
   - Mécanisme de D70 confirmé par `architecte` (option recommandée au commit 1, sinon variante
     écrite dans D70) ; `02` §12.4 réécrit selon le mécanisme retenu.
   - `.claude/settings.json` : les règles d'écriture `staging` passent du fichier local du fondateur
     au fichier versionné (`railway … -e staging`, `railway api` sur l'environnement `staging`,
     `gh secret set|variable set … --env staging`, `pnpm exec supabase link` et `config push` sur la
     référence de `staging`) ; interdits explicites : `-e production`, `railway up`,
     `--env production`, `supabase db push`. **Élargissement de permissions : confirmation du
     fondateur sur le diff avant le commit.**
   - Jeton P3 en place (fait le 2026-10-18) : les règles de permission restent une seconde
     ceinture.
1. **Configuration iso-production** (`dev-react-node` ; tests `testeur`). Option recommandée :
   - `INFLUX_ENV` prend trois valeurs : **`development`** (pile locale, CI, Playwright, helpers de
     test : verrous 2 et 3, doublure, `redirect`, `dry_run`, liste blanche), **`staging`** et
     **`production`**. Ces deux dernières partagent **un seul prédicat** dans `apps/api/src/config/`
     (« environnement déployé ») qui porte toutes les exigences aujourd'hui réservées à la
     production : `BREVO_MODE=live` et `SYNC_MODE=live` obligatoires ; `BREVO_TEST_RECIPIENTS` et
     `NON_PRODUCTION_RECIPIENT_ALLOWLIST` **refusées** (jamais ignorées) ; secrets du webhook,
     `PRIVACY_DATABASE_URL` et paire de purge GoTrue exigés ; origines `https` ; URL Brevo
     officielle ; bouclage refusé. Seules différences restantes : `noindex` (`next.config.ts`,
     inchangé) et le libellé du bandeau RG118 (« `staging` — envois réels »).
   - `skipped_non_production` n'est plus atteignable qu'en `development`.
   - Tests T17 réécrits en matrice : `development` garde les quatre verrous ; `staging` refuse
     exactement ce que refuse la production ; un test vérifie qu'aucun script `test`, `test:db` ou
     e2e ne charge `.env.local` (`16` RG148).
   - `apps/api/.env.example`, `apps/api/.env.local` (passé au profil `staging` : `live`, sans listes
     de redirection), `playwright.config.ts` et les helpers passés à `development`.
2. **Articulation D67** — [x] faite dans `05` RG162, RG164, CA85 à CA87 et `21` (ligne D67) ; reste le code, dans le commit (b) de D67 prévu au J9 : le contrôle de démarrage de
   `05` RG162 vaut pour tout environnement déployé (`staging` compris) ; la trace `would_send` de
   RG164 ne concerne plus que `development`. Le commit 1 précède donc le commit (b) de D67.
3. **Scripts d'exploitation autonomes** (`dev-react-node`, avis `integrateur`).
   - `db:staging-demo-accounts`, `db:publish-terms` (cible `staging`) et `staging:role-passwords`
     lisent leurs entrées dans `apps/api/.env.local` (`--env-file`) au lieu de variables exportées à
     la main. Les secrets à usage unique (mots de passe, liens d'activation) vont dans un fichier
     ignoré par Git, **jamais dans la sortie**.
   - Nouveau `staging:check` : (i) `.env.local` vise bien `staging` (marqueur `influx_staging`
     présent, `INFLUX_ENV=staging`) ; (ii) les **noms** des variables Railway de chaque service
     égalent la liste fermée du runbook (jamais les valeurs) ; (iii) modes `live`, réglages
     `leads.sync_settings` complets. Lancé par l'agent avant et après chaque changement.
   - `trial:record` : conservé pour `development` ou retiré (`architecte`) ; les échanges réels se
     constatent désormais sur `staging`.
4. **Bascule de `staging`** (agent `integrateur`, sans code ; après le déploiement du commit 1 et
   P2) :
   1. `staging:check` à l'état initial ;
   2. expéditeurs basculés de `@cadaero.com` vers `@influx.cadaero.ovh` (expéditeur créé dans le
      compte Brevo de `staging` par API, puis `.env.local`) ; variables Railway : `api` →
      `BREVO_MODE=live`, retrait de `BREVO_TEST_RECIPIENTS`, expéditeur du domaine P2 ; `worker` → `SYNC_MODE=live`, `BREVO_MODE=live`, `BREVO_API_KEY` du `worker`,
      `APOLLO_API_KEY`, expéditeurs, `BREVO_LIST_ID_*`, retrait de
      `NON_PRODUCTION_RECIPIENT_ALLOWLIST` (valeurs passées par `--stdin` depuis `.env.local`,
      jamais affichées) ;
   3. compte Brevo de `staging` par API : listes des deux rôles, attributs de `16` §M4, webhooks
      transactionnel et marketing (runbook J7 point 4) ;
   4. `leads.sync_settings` de `staging` : les valeurs prévues pour la production ; tant que D33
      n'est pas tranchée, une valeur de travail pour `apollo_prospecting_countries` (pays des
      testeurs), consignée dans `21` ;
   5. comptes de démonstration (script du commit 3) ;
   6. constats du « Terminé quand » ; `staging:check` vert.
   **Retour arrière** : après le commit 1, remettre seulement les variables en `dry_run` /
   `disabled` fait refuser le démarrage ; il faut revenir au commit précédent (procédure du
   runbook), puis aux variables d'avant.
5. **Documentation et revue** — runbook `staging` réécrit en procédure d'agent (les étapes du
   fondateur ne gardent que P2 à P5) ; `18` T17 aligné sur la matrice ; ligne de clôture dans `21`
   (J9) ; `pnpm docs:index`. **Revue groupée `expert-cybersecurite` + `testeur`** en fin de chantier
   (marqueur `security-reviewed:` sur le commit 1).

## Agents et questions posées

| Ordre | Agent | Question |
|---|---|---|
| 1 | `architecte` | Le mécanisme du commit 1 (troisième valeur `development` et prédicat unique) convient-il, ou une variante plus simple existe-t-elle sans affaiblir le verrou 1 ? |
| 2 | `integrateur` | Quelles règles de permission exactes au commit 0 ? |
| 3 | `dev-react-node` | Commits 1, 2 et 3 |
| 4 | `testeur` | Matrice T17 et garde « aucun test ne charge `.env.local` » |
| 5 | `integrateur` | Commit 4, puis les constats J6 à J8 |
| 6 | `expert-cybersecurite` | Revue groupée ; conditions de D70 (dont `staging` ouvert au public, risque accepté) |

## Ce qui ne change pas

- Aucune clé de production hors production ; aucune donnée de production dans `staging`
  (verrous 1 et 4).
- Aucun test automatisé n'appelle Brevo ni Apollo (`16` RG148, `21` §0 règle 4).
- Migrations par le seul job « Migrate staging », jamais `supabase db push` ; aucun `railway up`.
- Toute action sur la production, lecture comprise, attend la demande explicite du fondateur.
- Aucune valeur de secret dans une réponse, un document, un commit ou un journal.

## Risques

| Risque | Parade |
|---|---|
| Une personne réelle s'inscrit sur `staging` et entre dans les comptes Brevo et Apollo de `staging` sans cadre juridique | **Risque accepté par le fondateur (2026-10-18)** ; comptes distincts de la production ; `noindex` ; adresses de `staging` jamais publiées (D56) |
| Le domaine d'envoi de `staging` se dégrade (rebonds, plaintes de tests) | `influx.cadaero.ovh` (P2), jamais `cadaero.com` ni les domaines de la production : les tests n'entament pas la réputation du domaine racine |
| Un agent touche la production par Railway | **Levé le 2026-10-18** : jeton limité à `staging` (P3), session du fondateur retirée du poste ; règles `-e production` interdites en seconde ceinture |
| `pnpm dev:worker` sur le poste traite la file de `staging` en parallèle du worker Railway | Permis pour un diagnostic court seulement (`SKIP LOCKED` et idempotence le rendent sûr, pas lisible) |
| Les deux mondes se mélangent dans la tête des agents | `INFLUX_ENV=development` partout où tournent les tests ; `staging:check` |
