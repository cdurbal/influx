# Fiche J6 — Déversement vers Brevo et Apollo

> **Point d'entrée de toute session du J6.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives, ni un skill en entier (tranches ci-dessous).
> Les numéros de ligne datent du 2026-10-08 : s'ils ont glissé, `Grep` sur le titre de section.

## Préalable

J5 clos : commit 6 (Playwright) poussé, revue groupée `expert-cybersecurite` + `testeur` rendue,
attestation `security-reviewed: <date> covers <sha>…` posée (5sexies), `21` §J5 condensé, fiche J5
supprimée ou condensée. Les points rouges de cette revue deviennent le commit 1 ci-dessous.

## Objectif et critère de fin

**Premier usage démontrable.** Sur `staging` en `SYNC_MODE=dry_run`, chaque inscription produit ses
trois lignes (EC-10) et le worker les traite avec le bon statut ; l'essai manuel depuis le poste de
développement crée de vrais contacts dans les **comptes Brevo et Apollo de test** (D62) ; une panne
simulée de Brevo ou d'Apollo n'empêche aucune inscription (CA37).

## Commits prévus

1. **Dette J5** : revue de fin de J5 (2026-10-09, `56b8046..ddcaea7`) : **aucun point rouge**
   (`expert-cybersecurite` : E-1 `read_published_terms`, rejeu de `7b33351` et commit 5 et suites signés ;
   `testeur` : planchers 16 / 42 / 41 atteints). Commit 1 sans objet.
2. **Migration `0111` — E-3 `leads.drain_outbox`** (`expert-database`) : fonctions `SECURITY DEFINER`
   du worker sous ce seul motif (entrée dans l'union de `packages/contracts/src/elevated-operations.ts`,
   T6) : **prise** d'un lot (`FOR UPDATE SKIP LOCKED`, 20, `priority, available_at, id`, priorité 0
   RG78) ⇒ `processing` ; **lecture** de l'état utile à la qualification (consentement RG37, statut
   déclaré, pays, réglages) ; **issue** (`succeeded | skipped + motif | pending + available_at |
   failed + cause`, `contact_sync_states`, `transactional_sends`) ; **reprise** des `processing`
   orphelins après arrêt brutal (TM1.10) ; **marqueur `dry_run`** (absent de `0101`). T2, T4, T6
   étendus. `0102` et `0107` restent au J8.
3. **Boucle du worker** (`apps/api/src/worker.ts` + `domains/leads/`) : PRISE / APPEL / ISSUE, trois
   temps courts, **jamais d'appel externe sous transaction** (G4) ; 2 s en activité, 5 s au repos
   (`02` §11.1) ; `SIGTERM` termine le lot ; destinations indépendantes (RG75) ; ordre par compte
   (RG77) ; calendrier `retry_schedule` (RG79, EC-9) ; budgets `rate_limits` **séparés par catégorie**
   (lead-pipeline T5) ; trois verrous de `02` §12.4 (`dry_run` ⇒ `succeeded` + `dry_run`, liste
   blanche ⇒ `skipped_non_production`, sans clé ⇒ `skipped_no_credentials`).
4. **Connecteur Brevo** (`domains/leads/connectors/brevo/`) : opérations 1, 2, 6, 7 de `16` §M1 ;
   mapping typé §M4 + attributs EC-11 ; contrôle de sortie strict (RG137) ; `COMPANY` vide pour un
   créateur (RG142) ; **bienvenue** `account.welcome_advertiser` / `_creator` (P1), clé = compte sans
   identifiant d'événement (`05` RG76, RG86), journal `transactional_sends`. Clé Brevo **du worker**,
   distincte de celle de l'API (EC-19, skill `env-secrets`) ; doublure étendue aux contacts.
5. **Connecteur Apollo** (`connectors/apollo/`) : création / mise à jour idempotente
   (`contact_sync_states`), périmètre, base légale et pays relus **à chaque consommation** (RG81 à
   RG84), qualification complète (RG82), **aucun réimport** (RG85), séquence désactivée. `APOLLO_API_KEY`
   au worker seul ; **doublure Apollo à créer** dans `packages/test-kit` (elle n'existe pas).
6. **EC-44** : alerte `internal.critical_alert` sur `agent.break_glass_login` et
   `agent.recovery_code_consumed`, selon la décision 1 ci-dessous.
7. **Essai manuel et `staging`** : essai D62 / `16` RG115 depuis `apps/api/.env.local`, fixtures
   expurgées enregistrées (RG148) ; variables du service `worker` de `staging` (`integrateur`) ;
   vérification du critère de fin.

## Décisions de démarrage (`architecte`, 2026-10-09)

1. **EC-44 = P0, chemin synchrone de `apps/api`, jamais `outbox_events`** (`16` RG86, D43).
   `internal.critical_alert` ajouté à `API_TRANSACTIONAL_TEMPLATES` ; une ligne
   `leads.transactional_sends` par destinataire (`p0`, `account_id`, `outbox_event_id` nul, cause P0
   en échec). Destinataires lus en base : comptes `admin` actifs, **compte de secours exclu** ; aucun
   ⇒ `pino` `error` `security.critical_alert_no_recipient`. Contenu fixe FR+EN (D36 ouverte) : type,
   heure UTC, référence d'audit (+ codes restants pour MFA-4), **aucune** adresse, IP, agent, nom ni
   code. Idempotence = id de la ligne d'audit + destinataire. Envoi après le commit (G4),
   `Promise.allSettled`, une tentative, Brevo 3 s ; un échec ne change jamais la réponse de connexion
   (trace : audit, `pino` existant, `transactional_sends` `failed`, `pino` `security.critical_alert_failed`
   avec le seul `failureCode`).
   - Commits 2 et 3 : rien. Commit 6 : branchement dans `backoffice-sign-in.ts` après le commit,
     lecture des `admin`, modèle bilingue, tests doublure (connexion réussie Brevo en panne, aucune
     ligne `outbox_events`, contenu sans `@`, compte de secours exclu) ; `GRANT` éventuel sur
     `transactional_sends` pour le rôle de la connexion backoffice **dans le commit 6**, pas dans `0111`.
2. **`dry_run` = colonne `leads.outbox_events.dry_run boolean not null default false`**, avec
   `check (not dry_run or status = 'succeeded')` et `check (not dry_run or (provider_message_id is null
   and provider_contact_id is null))`. En `dry_run` : ni `transactional_sends` ni `contact_sync_states`
   (pas de fausse réussite) ; qualification, mapping et contrôle de sortie s'exécutent comme en `live`
   (rejet ⇒ même `failed`). Forme fine (index) : `expert-database`.
   - Commit 2 : colonne et deux contraintes dans `0111`, `dry_run` paramètre explicite de la fonction
     d'issue, T2/T4 couvrent les contraintes. Commit 3 : `SYNC_MODE=dry_run` ⇒ `succeeded` + `dry_run`,
     doublure à zéro appel, `contact_sync_states` inchangé ; **refus de démarrage** si
     `INFLUX_ENV=production` et `SYNC_MODE=dry_run`. Commit 6 : rien.
3. **« Ce qu'il aurait envoyé » = `pino` seulement, jamais une colonne** : ligne `info`
   `leads.dry_run.would_send` (`outboxEventId`, `eventType`, `destination`, `operation`, `templateCode`,
   `attributeNames` triés, `outputCheck` `pass | reject`, `rejectedAttributeNames`) ; **jamais** de
   valeur, d'adresse, d'`account_id` ni de paramètre de modèle (D60).
   - Commit 2 : rien. Commit 3 : la ligne, et un test qu'elle ne contient ni `@` ni aucune valeur de la
     fixture. Commits 4 et 5 : les connecteurs exposent noms d'attributs et verdict, sans valeurs.
     Commit 6 : rien.

**Restent ouverts (non tranchés) :** le fondateur reçoit l'alerte via son compte `admin` (hypothèse ;
sinon arbitrage `chef-de-projet` + fondateur, aucune variable d'adresse sans lui) ; D36 (corps FR+EN
en attente) ; `16` Q8, expéditeur de secours P0 (Brevo durablement en panne ⇒ audit et `pino` seuls).

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-8 | Clés `leads.sync_settings` lues par le worker : `apollo_scope`, `apollo_legal_basis` (défaut `consentement_requis`), `apollo_prospecting_countries` (**vide**), `retry_schedule`, `rate_limits`, listes et modèles Brevo |
| EC-9 | `retry_schedule` = `05` RG79, 10 tentatives (semé par `0103` : `[0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400]`) |
| EC-11 | Attributs `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `REFERRER_DOMAIN`, `HEARD_FROM` ajoutés au mapping `16` §M4 |
| EC-19 *(archivé)* | Deux clés Brevo distinctes, `api` et `worker` |
| EC-20 *(archivé)* | Le worker ne porte que `WORKER_DATABASE_URL` (`influx_worker_login`) |
| EC-44 | E-mail d'alerte compte de secours / code de secours au J6, P0 synchrone par `apps/api` (décision 1) |

Rappels invariants : charge utile **sans donnée personnelle** (RG74, contrainte `@` de `0101`) ;
consentement relu **à la consommation**, sans consentement ⇒ `skipped`, jamais `failed` (RG37, RG80) ;
la bienvenue part **indépendamment** du consentement (RG86) ; un échec Brevo/Apollo ne bloque jamais
une inscription ; **aucun test automatisé ne touche Brevo ni Apollo** (RG148) ; veto RGPD maintenu sur
Apollo (D33, « contributor network ») et pays de prospection vides ⇒ en `staging`, **toute ligne
`apollo_contact` finit `skipped`** : c'est attendu. L'essai Apollo renseigne un pays dans la base
**locale** seulement. Aucun taux ni montant.

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Flux de bout en bout du Lot 1 | `21-plan-de-developpement.md` · 160 · 19 (§5.1) |
| File de synchronisation (D18) | `02-architecture-3-espaces.md` · 626 · 96 (§6) |
| Worker : familles, déploiement, surveillance | `02` · 1118 · 48 (§11) |
| Garde-fou `staging` (trois verrous) | `02` · 1249 · 20 (§12.4) |
| G4, aucun appel sous transaction | `02` · 1542 · 24 (§18.4) |
| Opération E-3, rôles du worker | `03-matrice-des-droits-et-rls.md` · 811 (§P7, `Grep` « E-3 ») ; · 880 · 2 |
| Pipeline de leads (RG72 à RG88) | `05-spec-inscription-et-leads.md` · 474 · 106 (§I) ; RG37 · 316 |
| Critères CA37 à CA50 | `05` · 992 · 53 |
| Modèle : `outbox_events`, `contact_sync_states` | `04-modele-de-donnees-mvp.md` · 4081 · 102 |
| Modèle : `transactional_sends`, `sync_settings` | `04` · 4183 · 70 ; `04` · 4404 · 32 |
| Catalogue transactionnel, priorités P0/P1/P2 | `16-backoffice-emails-brevo.md` · 783 · 55 (§H, tableau et RG86) |
| Clés par environnement, modes, `redirect` | `16` · 1070 · 40 (§J, RG115 à RG117) |
| Contrôle de sortie | `16` · 1247 · 3 (RG137) |
| Contrat Brevo : opérations, débit, idempotence | `16` · 1265 · 41 (§M1 à §M3) |
| Mapping, erreurs | `16` · 1306 · 48 (§M4, §M5) |
| Doublure et scénarios RG148, variables | `16` · 1385 · 52 (§M7, §M8) |
| Tests TM1.1 à TM1.10 | `18-plan-de-test-mvp.md` · 848 · 14 |
| T17 garde-fou `staging` ; T6 liste fermée | `18` · 792 · 25 ; `18` · 553 · 33 |
| Skill `lead-pipeline` | priorités · 103 · 80 ; tests T1 à T9 · 183 · 26 ; chemin P0 · 256 · 25 |
| Skill `apollo-lead-sync` | D33 · 83 · 13 ; qualification · 96 · 35 ; mapping · 131 · 19 ; erreurs et tests · 167 · 43 |
| Skill `brevo-campaign`, `env-secrets` | `Grep` sur le sujet (440 et 409 lignes) |

**Homonymes :** T5, T6, T9 du plan `21` §J6 sont ceux du **skill `lead-pipeline`** (saturation des
contacts, panne d'Apollo, aucun appel sous verrou), **pas** ceux de `18` (T9 = Storage).

## Code existant à réutiliser

- `apps/api/src/worker.ts` : boucle vide du J1 (arrêt propre, pool `influx_worker_login` seul,
  refus d'un rôle interdit) ; `db/index.ts` (`withElevatedTransaction`, pool `worker`), `db/roles.ts`.
- `apps/api/src/config/schema.ts` · 686 : `workerEnvSchema` porte déjà `SYNC_MODE`,
  `NON_PRODUCTION_RECIPIENT_ALLOWLIST` et le refus de `dry_run` en production ; **manquent** la clé
  Brevo du worker et la clé Apollo.
- `apps/api/src/platform/brevo-transactional.ts` : client P0 de l'API (délai 3 s, disjoncteur) ;
  modèle de forme, pas budget partagé (T5).
- `packages/test-kit/src/brevo-double.ts` : doublure Brevo (transactionnel), à étendre aux contacts.
- `supabase/migrations/` : dernière migration `0110` ; `0101` (contraintes de la file : `attempts ≤ 10`,
  paire `skipped`/motif, `failed` ⇒ cause, `brevo_transactional` jamais `no_consent`), `0103`
  (réglages semés), `0015` (`transactional_sends`).

## Tests du jalon

TM1.1 à TM1.10 ; CA37 à CA50 ; lead-pipeline T5, T6, T9 ; T17 ; scénarios 1 à 6 et 13, 14 de `16`
RG148 ; T2, T4, T6 étendus à E-3. Écarts au plus sûr, à confirmer par `testeur` en fin de jalon :
**TM1.5** (désinscription revenue de Brevo) attend le webhook du J7 ; **CA41, CA43** (rejeu, bascule
du périmètre) passent par écriture directe des réglages en test, les écrans arrivent au J8 ;
**scénario 5** (`401`) arrête la destination avec `pino` `error`, la suspension marketing (RG123)
viendra avec l'interrupteur ; **scénarios 13, 14** déjà couverts pour l'API (`tests/config.test.ts`),
à étendre au worker. Hors J6 : battement de cœur et `/health` du worker (J9).

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche ; ne relire que la tranche
  du commit en cours.
- Pendant le codage : seul le fichier de test en cours, `--reporter=dot`. Suite complète avant
  chaque commit (CLAUDE.md §7).
- Sous-agents : `architecte` une fois au démarrage (trois points groupés) ; `expert-database` au
  commit 2 ; `integrateur` au commit 7 ; revue groupée `expert-cybersecurite` + `testeur` en fin de
  jalon. Pas de `chef-de-projet` (jalon cadré). Les skills suffisent pour Brevo et Apollo :
  pas d'`expert-integrations-api` sauf question de contrat d'interface non couverte par `16` §M.
- Points de revue à reporter ici au fil des commits (section « Issu du commit N »), comme au J5.
- À la clôture : 1 ligne par commit dans `21` §J6, puis supprimer cette fiche ou la condenser.
