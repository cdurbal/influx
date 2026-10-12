# Fiche J7 — Retours de Brevo et espace membre minimal

> **Point d'entrée de toute session du J7.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives, ni la fiche J6, ni un skill en entier.
> Les numéros de ligne datent du 2026-10-09 : s'ils ont glissé, `Grep` sur le titre de section.

## Objectif et critère de fin

**Les désinscriptions circulent dans les deux sens et le membre gère son compte.** `21` §J7 ne fixe
aucun « Terminé quand » ; proposé, **à confirmer par le fondateur** : sur `staging`, un membre consulte
et modifie ses informations, ses préférences, ses sessions et accepte une nouvelle version des CGU ; un
retrait de consentement écrit une ligne de priorité 0 prise sous 5 minutes ; un événement Brevo
`unsubscribed` enregistré, rejoué contre le webhook de `staging`, retire le consentement (source
`brevo_webhook`) et son doublon est ignoré ; rapprochement et purge tournent une fois sans erreur.

## Commits prévus

1. **Dette J6** : fait (`4aef89a`), voir « Issu du commit 1 ».
2. **Migrations du J7** (`expert-database`, numérotation à partir de `0115`, `0102`/`0107` restent au
   J8) : `leads.brevo_inbound_events` + `brevo_inbound_outcomes`, `record_brevo_event()` (E-1) et E-3
   de traitement (décision 2) ; `ops.periodic_runs` et fonctions E-4 (décision 3) ; marqueur de
   re-authentification (4) ; `identity.email_change_requests` (5) ; `data_subject_requests` minimale et
   `code_delivery_reports` (6) ; codes `consent.granted`, `consent.revoked`, `email.changed`,
   `retention.purged` et les `elevated.*` des décisions (EC-10, CA47). T2, T4, T6 étendus.
3. **Webhook Brevo, réception** (décision 1) : exception A4 unique, deux jetons en temps constant,
   plages IP en constante, refus en `404`, fenêtre ±15 min, idempotence, écriture brute puis `200`
   (RG147), journal sans URL. Scénarios 8, 9, quatre refus en `404`, exception unique.
4. **Webhook Brevo, traitement par le worker** (décisions 1, 2, 5) : trois familles RG106 (seule
   « retire un droit » a un effet), Brevo fait foi (RG90), plainte ⇒ suppression définitive (RG93),
   rebond dur transactionnel ⇒ incident + `undeliverable`, inconnu journalisé et ignoré (RG105) ;
   variante `email.changed` du connecteur (`PUT` par `contact_id`). TM1.5, CA52, CA54, CA55, scénario 7.
5. **Tâches périodiques E-4** (décision 3) : rapprochement quotidien des 48 h (RG91, RG113, CA53),
   purge GoTrue horaire (orphelins > 24 h, `04` §9), table brute à 30 j ; opérations 9, 10 en `16` §M1.
6. **API « mon compte » (1)** : `PATCH /v1/me` (RG15, `lead.updated` RG73), `GET`·`PUT /v1/me/consent`
   (RG34, RG92, RG95 ; `consent.revoked` priorité 0, RG78), `GET`·`DELETE /v1/me/sessions[/:id]`
   (RG56, RG143), `POST /v1/me/terms/accept` et blocage (RG28). CA33, CA35, CA36, CA70, CA47 avec le
   vrai code, lead-pipeline T7, T8, T14.
7. **API « mon compte » (2a)** (décisions 4, 5) : re-authentification par code frais (RG57) ; adresse
   à double code (RG58, A-11, contact Brevo **mis à jour, jamais dupliqué**). CA32, CA34.
8. **API « mon compte » (2b)** (décision 6) : « navigateur inconnu » (RG141, RG142, `auth.new_device`
   P1) ; modèles P1 du J7 ; « mes données » (EC-14) et `docs/runbooks/demandes-rgpd.md` ; secours
   `POST /v1/support/code-not-received` (RG65, T15). CA26, CA80, CA81.
9. **Écrans « Mon compte »** (`17` §6.1 à §6.4, CGU bloquante §6.7) sous `/compte/*`, `account.json`,
   étape « code frais », états, accessibilité ; Playwright : préférences, sessions, CGU, adresse en attente.
10. **Essai et `staging`** : webhook du compte Brevo **de test** vers `staging` (geste du fondateur,
   `CLAUDE.md` §7 règle 4) ou rejeu enregistré ; variables (`integrateur`) ; critère de fin.

## Décisions de démarrage (`expert-cybersecurite` 1, `architecte` 2 à 6, 2026-10-09)

1. **L'exception A4 couvre la seule route `POST /v1/webhooks/brevo/:pathToken` de la surface `web` :
   deux secrets, une IP Brevo et un JSON valide, aucun autre chemin ni méthode** (`03` A4, A5, PP-2,
   PP-5, PP-12 ; `16` RG146, RG147 ; EC-12 ; D60). Constante d'une seule entrée dans `write-origin.ts`
   (test : une seule) ; ni cookie ni session ; `application/json`, 64 Ko, lots Brevo désactivés. Jeton
   de chemin 43 car. base64url = routage seul (Railway journalise les chemins) ; authentification par
   l'en-tête **`brevo-webhook-token`** (liste blanche PP-5) ; temps constant, deux valeurs chacun
   (`…_CURRENT`/`…_PREVIOUS`). Ordre : PP-8, `x-real-ip` (absent ⇒ refus), IP dans `1.179.112.0/20` ou
   `172.246.240.0/20` (constante datée, URL source en commentaire), jetons, zod, ±15 min sur `ts_event`,
   idempotence. IP ou jeton refusé ⇒ **`404` identique à une route inconnue** ; authentifié mais
   invalide, hors fenêtre ou doublon ⇒ `200` compté ; écriture échouée ⇒ `503` ; sinon `200`
   `{received:true}`. `pino` `warn` `webhook.brevo.rejected` (motif fermé, sans IP, chemin ni jeton) ;
   jeton valide hors plage ⇒ `error` `webhook.brevo.ip_drift` + compteur `ops`. `elevated.*` : une
   ligne **par changement d'état effectif**, aucune sans effet ; compteur agrégé par lot.
   - Commit 3 : tout ce qui précède, PP-12 renouvelée consciemment, aucun appel Brevo (RG148).
     Commit 4 : effet sur « retire un droit » seul, lignes `elevated.*`. Autres : rien.
2. **La route écrit une ligne brute minimale et sans état ; le worker traite par E-3, rattachement par
   `message-id` puis par l'adresse exacte du compte** (RG105 à RG108, RG147, EC-12, M6-6, D60).
   `leads.brevo_inbound_events` en ajout seul : `id`, `received_at`, `origin` (`webhook` ·
   `reconciliation`), `dedup_key bytea unique` (SHA-256 message-id, event, ts, adresse), `event`
   borné, `occurred_at`, `provider_message_id`, `email` minuscule, `campaign_id`, `template_id`,
   `reason` (200 car.) ; ni corps, en-têtes, IP, sujet ni lien. Issue dans `leads.brevo_inbound_outcomes`
   (`event_id` PK, `account_id`, `outcome` fermé, `processed_at`). **Arbitrage au plus sûr (veto
   décision 1)** : `email` mis à nul à l'écriture de l'issue (seule mise à jour admise) ; purge E-4 à
   30 j après l'issue (provisoire), jamais une ligne non traitée. Écriture : motif E-1
   `leads.receive_brevo_event`, `influx_auth` exécute seul `leads.record_brevo_event()` (`SECURITY
   DEFINER`, propriétaire `influx_leads_definer`), code `elevated.leads.receive_brevo_event`. Canal
   transactionnel si `provider_message_id` ∈ `transactional_sends`, sinon marketing. « Retire un
   droit » ⇒ `consent_events` (`marketing_email`, `brevo_webhook`) si consentement, `consent.revoked`
   P0, `contact_sync_states` ; `spam` ⇒ `suppressed_reason` ; `hard_bounce` transactionnel ⇒ incident
   + `undeliverable` seulement sur l'adresse courante. `pino` : code d'issue seul, URL remplacée par le
   motif de route.
   - Commit 2 : tables, fonctions, motif, code, T2/T4/T6. Commit 3 : liste blanche, `dedup_key`.
     Commit 4 : règles, abonnement aux seuls événements « retire un droit ». Commit 5 : purge 30 j.
3. **E-4 dans la boucle du worker, gardé par une ligne unique par période ; le rapprochement réinjecte
   ses trouvailles dans la table brute** (RG91, RG113, RG150, `04` §9). `ops.periodic_runs`
   (`task_code`, `period_key` uniques ensemble, `started_at`, `finished_at`, `outcome`, `counts jsonb`)
   via `claim_periodic_run`/`finish_periodic_run` ; reprise d'une exécution non finie après 1 h.
   Rapprochement une fois par jour UTC après 03:00 : `GET /v3/contacts?modifiedSince=<−48 h>&limit=1000`
   (paginé, `emailBlacklisted=true`, rattachement par `INFLUX_ACCOUNT_ID`) et
   `GET /v3/smtp/statistics/events?event=spam&startDate=J−2&endDate=J` (vérifiés le 2026-10-09) ⇒
   lignes `origin='reconciliation'`, même voie que le webhook ; écart dans `counts`. Purge GoTrue
   horaire : `admin.listUsers` paginé ; orphelin = absent de `identity.accounts.auth_user_id` et
   `created_at`, `updated_at`, `last_sign_in_at` tous > 24 h ; compte revérifié avant chaque
   `admin.deleteUser` ; clé `SUPABASE_SECRET_KEY` du worker ; `retention.purged` (`auth_orphan_users`,
   nombre).
   - Commit 2 : table, fonctions, codes `retention.purged`, `elevated.maintenance.run_periodic`.
     Commit 5 : ordonnanceur, opérations 9 et 10 de `16` §M1, purge, doublures. Commit 10 : variable.
4. **Re-authentification = moteur du code de connexion par deux routes membres ; adresse lue dans la
   session ; preuve = marqueur lié à une finalité, à usage unique, valable 5 min** (RG57, RG41, `03`
   A-10). `POST /v1/me/reauthenticate/request-code` et `…/verify-code`, corps `{purpose:
   email_change | data_export | account_deletion}` : `generateLink`, P0 `auth.login_code`, plafonds
   RG44/RG47. Motif E-2 `identity.member_reauthenticate`. `identity.sessions.reauthenticated_at` +
   `reauth_purpose` (membre seulement, `now()` en base, `influx_auth` seul) ; l'action sensible les
   vérifie puis les remet à `NULL` dans sa transaction. Durée : `REAUTHENTICATION_FRESHNESS_SECONDS`
   (300, valeur R du backoffice dans `identity/settings.ts`), provisoire.
   - Commit 2 : colonnes, contrainte, E-2, code d'audit. Commit 7 : routes, garde partagée.
     Commit 9 : étape « code frais ». Autres : rien.
5. **Demande de changement d'adresse en table `identity` de 24 h, confirmée par deux codes à 6 chiffres
   saisis dans l'espace (envoi synchrone `apps/api`), jamais un lien ; contact Brevo modifié par son
   identifiant, jamais recréé** (RG58, A-11, RG74). `identity.email_change_requests` : `id`,
   `account_id`, `old_email`, `new_email`, `expires_at` (+24 h), `old_code_hash`/`new_code_hash` (HMAC
   poivré), 5 essais par côté, `old_confirmed_at`, `new_confirmed_at`, `completed_at`, `cancelled_at` +
   motif ; une demande ouverte par compte. `auth.email_change_confirm_old/new` synchrones (clé :
   demande + côté) ; modèle non configuré ⇒ `503` `email_change_unavailable`, jamais `skipped`. Fin :
   `admin.updateUserById` (`email_confirm`) puis une transaction (`accounts.email`, `email_verified_at`,
   révocation des autres sessions, `email.changed` Brevo + Apollo, `auth.email_changed_notice` ×2,
   charge utile = id de la demande) ; échec GoTrue ⇒ ancienne adresse, nouvel essai possible ; adresse
   prise ⇒ réponse neutre identique. Brevo : `PUT /v3/contacts/{external_contact_id}
   ?identifierType=contact_id` (sinon ancienne adresse, `email_id`), `{attributes:{EMAIL}}` ; puis
   opérations 2 et 7 réappliquées si sans consentement ou supprimé (Brevo lève la liste noire).
   - Commit 2 : table, fonctions, code. Commit 4 : variante du connecteur (`client.ts`). Commit 7 :
     routes et envois. Commit 9 : écrans. Autres : rien.
6. **`backoffice.data_subject_requests` minimale dès maintenant (`0502` la complète) ; accusé = nouveau
   modèle P1 en file ; le canal de secours écrit dans `backoffice.code_delivery_reports` par sa fonction
   E-1 étroite, sans e-mail** (EC-14, RG65, RG57). Demandes : `id`, `request_type` (six valeurs, seuls
   `access`/`erasure` exposés), `requester_account_id`, `channel='self_service'`, `received_at`,
   `due_at` généré (+30 j), `status`, `completed_at`, `outcome_code` (liste de `15` RG77) ; dépôt par
   une fonction `SECURITY DEFINER` des rôles membres exigeant le marqueur de la décision 4. Accusé
   `privacy.request_received` P1 (charge utile = id, clé EC-8, `NULL` ⇒ `skipped`). Procédure
   `docs/runbooks/demandes-rgpd.md`, exécutée par un `admin` ; suppression = demande. Secours : `id`,
   `received_at`, `login_email`, `contact_email`, `message` (500 car.), `locale`, `status`,
   `handled_at` ; réponse identique, plancher 1 000 ms, débit limité, motif
   `support.report_delivery_issue`, code `elevated.support.report_delivery_issue`.
   - Commit 2 : tables, fonctions, codes. Commit 8 : routes, modèle, procédure. Commit 9 : écrans.

**Restent ouverts :** critère de fin ; retrait propagé à Apollo et conservations 30 j, abonnement
minimal (`expert-conformite-rgpd`, Lot 6) ; D36 ; textes `account.*` (D48) ; `privacy.request_received`
à ajouter à `16` §H (`product-owner`) ; 5 min, usage unique, remise de l'export (`expert-cybersecurite`,
fin de jalon) ; webhook du compte Brevo de production (fondateur, `prerequis.md`).

## Règles d'écart applicables

| # | Règle |
|---|---|
| EC-8 | Identifiants des nouveaux modèles Brevo dans `leads.sync_settings` ; `NULL` ⇒ `skipped` `template_not_configured` (en `staging` jusqu'au J8) |
| EC-10 | `consent.granted` / `consent.revoked` pour les changements après l'inscription |
| EC-12 | Webhook `/api/v1/webhooks/brevo/<jeton>` relayé par `apps/web` (exception fermée d'en-tête et d'A4), IP sur `x-real-ip`, table entrante en ajout seul consommée par le worker |
| EC-14 | « Mes données » : dépôt depuis l'espace, accusé de réception, exécution manuelle par un `admin` selon procédure écrite |
| EC-43 | Signal « navigateur inconnu » sur `user_agent_summary` (30 jours), `country_code` nul, e-mail `auth.new_device` |

Rappels invariants : retrait **en un geste**, immédiat dans INFLUX, enregistré même si la propagation
échoue (RG92), sans effet sur les transactionnels ni sur le code (RG35, CA36), sans effet sur le compte
(RG94) ; webhook non signé ⇒ **rien d'irréversible ni aucune preuve sur son seul contenu** (M6-6) ;
ouvertures et clics jamais nominatifs (RG107) ni assimilés à un consentement (RG114) ; aucune donnée
personnelle en charge utile (RG74) ni en journal (D60) ; `auth.new_device` **sans lien** (RG158) ;
purge GoTrue par l'API d'administration seulement, rapprochement sur `auth_user_id`, jamais sur
l'adresse ; le canal de secours ne donne jamais de code ni de session (RG65) ; suppression de compte =
**demande** au J7 ; aucun test automatisé ne touche Brevo (RG148) ; Apollo inchangé (`skipped`) ;
aucun taux ni montant.

## Où lire (fichier · ligne de départ · nombre de lignes)

| Sujet | Tranche |
|---|---|
| Plan du J7, contrat d'API, écarts | `21-plan-de-developpement.md` · 247 · 8 ; · 184 · 16 (§5.2) ; · 102 · 7 |
| Sessions, nouvel appareil, re-auth, changement d'adresse | `05-spec-inscription-et-leads.md` · 385 · 20 (RG54 à RG58) |
| Navigateur inconnu, « mes sessions » | `05` · 1560 · 35 (RG141 à RG146) |
| CGU (ré-acceptation) ; retrait du consentement | `05` · 267 · 5 (RG28) ; · 303 · 8 (RG34, RG35) |
| Canal de secours ; contenu de l'espace | `05` · 440 · 5 (RG65) ; · 469 · 5 (RG71) |
| Émission, priorité, charge utile | `05` · 481 (RG73) ; · 496 (RG74) ; · 513 (RG78) |
| Désinscriptions dans les deux sens | `05` · 580 · 33 (§J, RG89 à RG96) |
| Cas limites ; critères | `05` · 820 · 11 ; CA26 · 947 ; CA32–CA36 · 971 · 20 ; CA52–CA55 · 1049 · 17 ; CA70 · 1117 · 5 ; CA80, CA81 · 1646 · 8 |
| Modèles P1 du J7 (`auth.new_device`, `auth.email_change_*`) | `16-backoffice-emails-brevo.md` · 783 · 10 ; texte `auth.new_device` · 970 · 30 (RG157, RG158) |
| Ce qui remonte de Brevo | `16` · 1008 · 54 (§I, RG105 à RG114) |
| Opérations, mapping | `16` · 1265 · 13 (§M1) ; · 1306 · 34 (§M4) |
| Webhook non signé, six compensations | `16` · 1354 · 31 (§M6, RG146, RG147) ; scénarios 7 à 9 · 1400 · 3 |
| Écrans « Mon compte » ; routes | `17-parcours-et-ecrans-espaces-membres.md` · 1705 · 124 (§6.1 à §6.4) ; · 1851 · 14 (§6.7) ; · 263 · 14 (§2.6) |
| A4 et point ouvert du webhook ; A5 ; passe-plat | `03-matrice-des-droits-et-rls.md` · 1395 · 13 ; · 1409 · 8 ; · 1380 · 12 (PP-2 à PP-12) |
| E-1 à E-5 ; A-11 ; droits `identity` | `03` · 836 · 6 ; · 1259 · 2 ; · 178 · 54 |
| Modèle : comptes, incidents, sessions, consentement | `04-modele-de-donnees-mvp.md` · 769 · 30 ; · 838 · 37 ; · 1028 · 20 ; · 1157 · 58 |
| Modèle : `contact_sync_states` (retour Brevo) ; demandes RGPD | `04` · 4133 · 50 ; · 4840 · 1 |
| Purge GoTrue ; énumération | `04` · 5839 · 30 ; `02-architecture-3-espaces.md` · 1566 · 61 (§18.5) |
| Worker ; variables par service | `02` · 1118 · 50 (§11) ; · 1205 · 20 |
| Tests TM1 (TM1.5) ; T7, T8, T14, T15 | `18-plan-de-test-mvp.md` · 848 · 14 ; · 586 · 26 ; · 612 · 27 ; · 727 · 28 |
| Skill `lead-pipeline` T7, T8 ; skill `brevo-campaign` webhooks | `lead-pipeline` · 198 · 12 ; `brevo-campaign` · 309 · 34 |

**Homonymes :** T7, T8 de `21` §J7 = **skill `lead-pipeline`** (P0 ⇒ révocation ⇒ P1 ⇒ P2, sous
5 min), **pas** `18` (T7 passe-plat, T8 authentification), qui s'appliquent aussi (commits 3, 7, 8).

## Code existant à réutiliser

- `apps/api/src/domains/identity/` : `routes.ts` · 439 (`GET /v1/me` minimal du J3, `POST
  /v1/auth/logout`) ; `member-session.ts` (`withMemberSession`) ; `verify-code.ts` (E-2, point
  d'insertion du signal navigateur) ; `login-code.ts` (base de la re-authentification) ; `repository.ts`.
- `apps/api/src/platform/` : `user-agent.ts` + `packages/contracts/src/user-agent.ts` (résumé fermé
  famille + système, Q14) ; `client-address.ts` (`x-real-ip`, A5) ; `brevo-transactional.ts` (P0).
- `apps/web/src/app/api/[...path]/route.ts` : passe-plat épinglé (test d'empreinte PP-12) ;
  `apps/web/src/lib/member-paths.ts` ; accueils `[locale]/marque`, `brand`, `createur`, `creator`.
- `apps/api/src/domains/leads/` : `drain.ts`, `queue.ts`, `settings.ts`, `connectors/brevo/`
  (`index.ts` · 43 : modèles admis = bienvenue seule ; sans consentement, tout événement autre que
  `lead.created` ⇒ désinscription, déjà en place). `apps/api/src/worker.ts` : aucune tâche E-4.
- `packages/test-kit/src/brevo-double.ts`, `brevo-exchanges.ts` (à étendre aux événements entrants et
  au rapprochement) ; `apps/api/scripts/record-provider-exchanges.ts` (enregistrement expurgé, `d4625ec`).
- `supabase/migrations/` : dernière `0114` ; `0005` (`consent_source` porte déjà `account_settings`,
  `brevo_webhook`) ; `0012` (`identity.revoke_own_session()`, motifs `logout`, `revoked_by_holder`) ;
  `0104` (`email_status`, `correct_email()`) ; `0105` (`email_delivery_incidents`, unicité de
  `provider_event_id`) ; `0011` (motif `support.report_delivery_issue` déclaré, aucune fonction) ;
  `0015` (`auth.new_device` admis au journal).

## Reports du J6

TM1.5 attend le webhook (commit 4) ; CA47 : `consent.revoked` entre avec son émetteur (commits 2 et 6,
remplacer la ligne `lead.updated` P0 du test) ; `email.changed` sans doublon Brevo : décision 5 ;
`account.email_corrected` reste `template_not_supported` jusqu'au J8 ; suspension marketing sur `401`
(scénario 5, RG123) avec l'interrupteur (J8 / Lot 5). Nouvelles variables (jetons du webhook, clé
GoTrue du worker) : skill `env-secrets` ; le fondateur les documente dans `apps/api/.env.example`.

## Issu du commit 1 (`4aef89a`)

- **I-4 (J6S-1)** : ancre fixe `I4_ANCHOR` = `56b8046` dans `ci.yml` (base de la revue de fin de J5) ; une attestation malformée après l'ancre rougit chaque push. **Constat** : `4eb8ff1 83ba6d1 662ec3d 7b33351` (J5, revue sans point rouge) ne sont couverts par aucune attestation. Au plus sûr, l'agent ne les atteste pas : **l'attestation de fin de J7 doit les nommer**.
- **Conséquence** : I-4 rouge pendant tout le J7, donc ni « Migrate staging » ni déploiement ; le commit 10 (`staging`) exige d'abord la revue `expert-cybersecurite` et son attestation.
- **J6S-2** n'est pas retenue au commit 1 (fonction `audit` = migration) : à proposer à `expert-database` au commit 2 (`0115`+), sinon Lot 6.
- **Cas instables** : RG47 (l.537), le cookie « altéré » restait intact quand l'avant-dernier caractère valait déjà `A` (≈ 1/64) ; J6T-8, la fenêtre fixe à la minute laissait passer 12 rapports à cheval sur deux minutes ⇒ horloge figée.
- `testeur` (fin de jalon) : 3 témoins I-4 (ancre, attestation malformée, ancre hors historique), `check-security-review` à 46 cas.
- Tickets J6 du J7 restants : J6T-1, J6T-2 (commit 4), J6T-3 (commit 6), J6S-5 (fondateur).

## Clôture d'un commit (« clôture standard »)

1. Suite complète : `pnpm typecheck`, `pnpm lint`, `pnpm test -- --reporter=dot`,
   `pnpm --filter @influx/api test:db -- --reporter=dot`.
2. Commit Conventional Commits en anglais (`feat(api): J7 …`), **sans** marqueur `security-reviewed:`.
3. Push sur `main`, puis `gh run list` et `gh run watch <id> --exit-status` : un échec limité à l'étape
   I-4 est attendu (attestation en fin de jalon) ; tout autre échec se corrige (`gh run view <id>
   --log-failed`).
4. Commit `docs(j7): record commit N …` : 1 ligne dans `21` §J7 (`- [x] Commit N (\`sha\`) — …`),
   section « Issu du commit N » ici (≤ 10 lignes : choix au plus sûr, points pour `expert-cybersecurite`
   et `testeur` en fin de jalon, suites des commits suivants), `pnpm docs:index`, push.

## Discipline de session (économie de tokens)

- Une session par commit (`/clear` entre deux), reprise depuis cette fiche ; ne relire que les tranches
  du commit en cours ; `Grep` sur le symbole plutôt que la lecture d'un fichier de code entier.
- Pendant le codage, un seul fichier de test : depuis `apps/api`, `pnpm exec vitest run --project db
  db-tests/<fichier> --reporter=dot` (`pnpm --filter @influx/api test:db -- <fichier>` lance toute la
  suite). Suite complète avant chaque commit (CLAUDE.md §7).
- Sous-agents restants : `expert-database` au commit 2 ; `integrateur` au commit 10 ; revue groupée
  `expert-cybersecurite` + `testeur` en fin de jalon. Ni `chef-de-projet`, ni `Explore` sur un chemin cité.
- « Issu du commit N » : **10 lignes au plus** ; condenser les points soldés : fiche sous 250 lignes.
- À la clôture : 1 ligne par commit dans `21` §J7, puis supprimer cette fiche ou la condenser.
