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

1. à 8bis. **Faits** (dette J6, migrations, webhook, E-4, « mon compte » 1, 2a et 2b, arbitrages) : voir « Issu du commit N ».
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
   - Commits 2 à 5 : faits (abonnement Brevo appliqué au commit 10).
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
   - Commits 2 et 5 : faits. Commit 10 : variables `SUPABASE_*` du worker en `staging`.
4. **Re-authentification = moteur du code de connexion par deux routes membres ; adresse lue dans la
   session ; preuve = marqueur lié à une finalité, à usage unique, valable 5 min** (RG57, RG41, `03`
   A-10). `POST /v1/me/reauthenticate/request-code` et `…/verify-code`, corps `{purpose:
   email_change | data_export | account_deletion}` : `generateLink`, P0 `auth.login_code`, plafonds
   RG44/RG47. Motif E-2 `identity.member_reauthenticate`. `identity.sessions.reauthenticated_at` +
   `reauth_purpose` (membre seulement, `now()` en base, `influx_auth` seul) ; l'action sensible les
   vérifie puis les remet à `NULL` dans sa transaction. Durée : `REAUTHENTICATION_FRESHNESS_SECONDS`
   (300, valeur R du backoffice dans `identity/settings.ts`), provisoire.
   - Commits 2 et 7 : faits. Commit 9 : étape « code frais ».
5. **Demande de changement d'adresse en table `identity` de 24 h, confirmée par deux codes à 6 chiffres
   saisis dans l'espace (envoi synchrone `apps/api`), jamais un lien ; contact Brevo modifié par son
   identifiant, jamais recréé** (RG58, A-11, RG74). `identity.email_change_requests` : `id`,
   `account_id`, `old_email`, `new_email`, `expires_at` (+24 h), `old_code_hash`/`new_code_hash` (HMAC
   poivré), 5 essais par côté, `old_confirmed_at`, `new_confirmed_at`, `completed_at`, `cancelled_at` +
   motif ; une demande ouverte par compte. `auth.email_change_confirm_old/new` synchrones (clé :
   demande + côté), textes dans le dépôt (RG67) ; code non parti ⇒ demande close `not_sent`, `503`
   `email_change_unavailable` ; nouvelle adresse refusée par Brevo ⇒ `400 undeliverable`. Fin :
   `admin.updateUserById` (`email_confirm`) puis une transaction (`accounts.email`, `email_verified_at`,
   révocation des autres sessions, `email.changed` Brevo + Apollo, `auth.email_changed_notice` ×2,
   charge utile = id de la demande) ; échec GoTrue ⇒ ancienne adresse, nouvel essai possible ; adresse
   prise (compte ou utilisateur GoTrue orphelin) ⇒ demande close, issue explicite `address_unavailable`
   connue seulement après le code de la nouvelle adresse ; GoTrue toujours réaligné sur la base
   (révision du 2026-10-14, `architecte` et `expert-cybersecurite`). Brevo : `PUT /v3/contacts/{external_contact_id}
   ?identifierType=contact_id` (sinon ancienne adresse, `email_id`), `{attributes:{EMAIL}}` ; puis
   opérations 2 et 7 réappliquées si sans consentement ou supprimé (Brevo lève la liste noire).
   - Commits 2, 4 et 7 : faits. Commit 9 : écrans. Autres : rien.
6. **`backoffice.data_subject_requests` minimale dès maintenant (`0502` la complète) ; accusé = nouveau
   modèle P1 en file ; le canal de secours écrit dans `backoffice.code_delivery_reports` par sa fonction
   E-1 étroite, sans e-mail** (EC-14, RG65, RG57). Demandes : `id`, `request_type` (six valeurs, seuls
   `access`/`erasure` exposés), `requester_account_id`, `channel='self_service'`, `received_at`,
   `due_at` (plus proche de +30 j et +1 mois, `0127`), `status`, `completed_at`, `outcome_code` (liste de `15` RG77) ; dépôt par
   une fonction `SECURITY DEFINER` des rôles membres exigeant le marqueur de la décision 4. Accusé
   `privacy.request_received` P1 (charge utile = id ; rendu par INFLUX, `16` RG160, `0128`). Procédure
   `docs/mvp/runbooks/demandes-rgpd.md`, exécutée par un `admin` ; suppression = demande. Secours : `id`,
   `received_at`, `login_email`, `contact_email`, `message` (500 car.), `locale`, `status`,
   `handled_at` ; réponse identique, plancher 1 000 ms, débit limité, motif
   `support.report_delivery_issue`, code `elevated.support.report_delivery_issue`.
   - Commits 2, 8 et 8bis : faits. Commit 9 : écrans.

**Restent ouverts :** critère de fin ; retrait propagé à Apollo et conservations 30 j, abonnement
minimal (`expert-conformite-rgpd`, Lot 6) ; D36 ; textes `account.*` (D48) ; 5 min, usage unique
(`expert-cybersecurite`, fin de jalon) ; webhook du compte Brevo de production (fondateur, `prerequis.md`) ; avant la mise en
ligne du Lot 1 : C5.c (orphelin GoTrue sur la nouvelle adresse supprimé puis un nouvel essai) et A2
(code de la nouvelle adresse compté sur RG44) ; avis `auth.email_changed_notice` rendu par INFLUX
(RG67) ou modèle Brevo (EC-8) : fondateur.

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
| Cas limites ; critères | `05` · 820 · 11 ; CA26 · 947 ; CA32–CA36 · 971 · 20 ; CA52–CA55 · 1049 · 17 ; CA70 · 1117 · 5 ; CA80, CA81 · 1646 · 8 |
| Modèles P1 du J7 (`auth.new_device`, `auth.email_change_*`) | `16-backoffice-emails-brevo.md` · 783 · 10 ; texte `auth.new_device` · 970 · 30 (RG157, RG158) |
| Webhook non signé, six compensations | `16` · 1354 · 31 (§M6, RG146, RG147) ; scénarios 7 à 9 · 1400 · 3 |
| Écrans « Mon compte » ; routes | `17-parcours-et-ecrans-espaces-membres.md` · 1705 · 124 (§6.1 à §6.4) ; · 1851 · 14 (§6.7) ; · 263 · 14 (§2.6) |
| A4 et point ouvert du webhook ; A5 ; passe-plat | `03-matrice-des-droits-et-rls.md` · 1395 · 13 ; · 1409 · 8 ; · 1380 · 12 (PP-2 à PP-12) |
| E-1 à E-5 ; A-11 ; droits `identity` | `03` · 836 · 6 ; · 1259 · 2 ; · 178 · 54 |
| Modèle : comptes, incidents, sessions, consentement | `04-modele-de-donnees-mvp.md` · 769 · 30 ; · 838 · 37 ; · 1028 · 20 ; · 1157 · 58 |
| Modèle : `contact_sync_states` (retour Brevo) ; demandes RGPD | `04` · 4133 · 50 ; · 4840 · 1 |
| Worker ; variables par service | `02` · 1118 · 50 (§11) ; · 1205 · 20 |
| Tests TM1 (TM1.5) ; T7, T8, T14, T15 | `18-plan-de-test-mvp.md` · 848 · 14 ; · 586 · 26 ; · 612 · 27 ; · 727 · 28 |
| Skill `lead-pipeline` T7, T8 ; skill `brevo-campaign` webhooks | `lead-pipeline` · 198 · 12 ; `brevo-campaign` · 309 · 34 |

**Homonymes :** T7, T8 de `21` §J7 = **skill `lead-pipeline`** (P0 ⇒ révocation ⇒ P1 ⇒ P2, sous
5 min), **pas** `18` (T7 passe-plat, T8 authentification), qui s'appliquent aussi (commits 3, 7, 8).

## Code existant à réutiliser

- `apps/api/src/domains/identity/` : `account-routes.ts` (« mon compte », commits 6 et 7) ;
  `member-session.ts` (`withMemberSession`) ; `reauthentication.ts` (`requireFreshCode`, garde des actions
  du commit 8) ; `verify-code.ts` (point d'insertion du signal navigateur) ; `repository.ts`.
- `apps/api/src/platform/` : `user-agent.ts` + `packages/contracts/src/user-agent.ts` (résumé fermé
  famille + système, Q14) ; `client-address.ts` (`x-real-ip`, A5) ; `brevo-transactional.ts` (liste fermée).
- `apps/web/src/app/api/[...path]/route.ts` : passe-plat épinglé (test d'empreinte PP-12) ;
  `apps/web/src/lib/member-paths.ts` ; accueils `[locale]/marque`, `brand`, `createur`, `creator`.
- `apps/api/src/domains/leads/` : `drain.ts`, `queue.ts`, `connectors/brevo/` (bienvenue, avis d'adresse).
  `packages/test-kit/src/brevo-double.ts`, `gotrue-double.ts` ; `apps/api/scripts/record-provider-exchanges.ts`.
- `supabase/migrations/` : dernière `0126` ; `0012` (`revoke_own_session()`) ; `0104` (`email_status`,
  `correct_email()`) ; `0105` (`email_delivery_incidents`) ; `0015` (`auth.new_device` admis au journal).

## Issu du commit 1 (`4aef89a`) et reports du J6

- Reports du J6 : `account.email_corrected` reste `template_not_supported` jusqu'au J8 ; suspension marketing sur `401` (RG123) au J8 / Lot 5. **I-4** : ancre fixe `56b8046` ; `4eb8ff1 83ba6d1 662ec3d 7b33351` (J5) non attestés : **l'attestation de fin de J7 doit les nommer**. I-4 rouge tout le J7 ⇒ ni staging ni déploiement avant la revue ; le commit 10 l'exige d'abord.
- RG47 et J6T-8 stabilisés. `testeur` (fin de jalon) : 3 témoins I-4, `check-security-review` à 46 cas. Tickets restants : J6T-1, J6T-2 (commit 4), J6S-5 (fondateur) ; J6T-3 soldé au commit 6.

## Issu des commits 2 (`679263a`) et 2bis (`2f3fdf4`)

- **Au plus sûr (`expert-database`)** : tout effet exige l'adresse courante (`address_mismatch`) ; seul `hard_bounce` transactionnel ferme l'adresse ; `unsubscribe` = `unsubscribed` ; `dedup_key` calculée en base ; base ±20 min (route ±15) ; colonnes ajoutées `account_ref` (rapprochement) et `attempt` (jeton de clôture E-4) ; 03:00 UTC laissé à l'ordonnanceur. 2bis : INSERT direct des membres sur `consent_events` retiré (`0119`, RG73 ; aucun code ne s'en servait) ; les membres lisent la colonne propriétaire de leurs demandes (`account_id`, `requester_account_id`), requise par les sondes T2. Tests : fixtures puis `actAs()` / `actAsMember()` (superutilisateur local, `support.ts`) dans une transaction annulée ; T2.6 : homonyme nommé `brevo_inbound_events.origin` ; paramètres `jsonb` passés en `$n::text::jsonb` (postgres.js encode sinon une chaîne JSON).
- `expert-cybersecurite` (fin de jalon) : signer les 2 motifs de P, le rôle `influx_maintenance_definer`, la lecture élargie de `transactional_sends` par `influx_leads_definer` ; le marqueur est vérifié sur un `p_session_id` fourni par l'appelant (un membre peut citer une autre de ses sessions marquée). **I-4 rouge masque les étapes suivantes de la CI** (migrations, format, build, Playwright) : vérifiées en local. `testeur` : `actAs()`, exemption T2.6. Rétention des 3 tables du 2bis : Lot 6.

## Issu du commit 3 (`93d1eba`)

- **Au plus sûr** : `ts_event` exigé (les événements « contact » n'en ont pas, hors abonnement du commit 4) ; `camp_id`/`template_id` à 0 ⇒ nul ; corps illisible ou autre type ⇒ `200` `invalid_payload` ; 22023 de la base ⇒ idem ; > 64 Ko ⇒ `413` ; secrets requis en production, refusés sur le `worker` Railway ; `BREVO_IP_ALLOWLIST` de la skill remplacée par la constante (skill `env-secrets` à aligner). Suites : commit 4, abonnement Brevo aux seuls événements « retire un droit » (lots désactivés) ; `staging`, variables au commit 10.
- `expert-cybersecurite` : le `404` n'est identique à une route inconnue qu'avec `same-origin` (sans origine, une route inconnue répond `403` A4 : l'existence de la route se voit, pas les secrets) ; « compté » = `ops.request_metrics` + `pino` `webhook.brevo.ignored` (pas de compteur dédié) ; dérive IP = groupe d'erreurs `BrevoWebhookAddressDriftError`. `testeur` : `sqlStateOf` déplacé dans `src/db/sql-state.ts` ; `tm1-brevo-webhook-route` engage ses lignes puis les vide par E-3 (avant et après) ; « process start » de `config.test` et T11 des artefacts (`.next` périmé) instables en local, verts au second passage.

## Issu du commit 4 (`40023cf`)

- **Au plus sûr** : lignes brutes en tête de chaque tour (50 au plus, un échec n'arrête pas la file) ; contact supprimé ⇒ toujours désinscrit, même consentement redonné (CA55) ; `email.changed` : `404` ⇒ succès sans rien créer (le rejeu de `lead.created` lit l'adresse courante), adresse prise ⇒ `brevo.rejected`, sans demande terminée ⇒ `email_change_not_found`, `redirect` exige les deux adresses. `0121` recrée `read_brevo_subject` (+ `previous_email`, `external_contact_id`, `suppressed`).
- Abonnement Brevo : constante `BREVO_WEBHOOK_SUBSCRIPTION` (`contracts`), appliquée au commit 10 ; corps entrants de la doublure **rédigés**, à enregistrer au commit 10.
- `expert-cybersecurite` (fin de jalon) : `influx_leads_definer` lit `id`, `account_id`, `old_email`, `completed_at` des demandes **terminées** (politique) ; `unknown_event` journalisé par id de ligne seul (le nom reste 30 j sur la ligne brute).
- `testeur` : `tm1-brevo-inbound-worker` (15 cas, lignes engagées, vidées avant et après) ; `format:check` local signale 4 fichiers non touchés (fins de ligne du poste), CI masquée par I-4 : build vérifié en local.
- Suites : commit 5 (rapprochement par `record_brevo_reconciliation_event`, doublure à étendre aux `GET`) ; J8 : levée de suppression par un `admin` (RG93).

## Issu du commit 5 (`af88ad5`)

- **Au plus sûr** : E-4 entre deux tours du drain, une fois par minute au plus (jamais en parallèle d'un tour) ; échec ⇒ exécution close `failed`, la fenêtre de 48 h couvre un jour manqué ; arrêt demandé ⇒ exécution laissée ouverte (reprise à 1 h). `GET /v3/contacts` n'a **pas** de filtre `emailBlacklisted` (doc relue le 2026-10-13) : filtrage local ; instant coupé à la seconde pour retrouver la clé du webhook ; `gap` = lignes nouvelles (majorant). Plainte marketing relue comme désinscription (la suppression RG93 attend le webhook ou un `admin`). Purge : relecture de l'utilisateur puis du compte juste avant `deleteUser`, 500 suppressions et 100 pages par heure au plus ; `nextPage` d'`auth-js` 2.117.2 ignoré (premier chiffre seulement).
- `SUPABASE_URL` + `SUPABASE_SECRET_KEY` du worker : les deux ou aucune, **requises en production** ; skill `env-secrets` aligné ; `.env.example` à documenter par le fondateur, valeurs `staging` au commit 10. Domaine `maintenance` ajouté à ESLint ; `maintenance.run_periodic` entre dans U.
- `expert-cybersecurite` (fin de jalon) : nettoyage des exécutions courantes en test par le superutilisateur local (`session_replication_role`) ; `filter_auth_orphans` sans ligne de registre (lecture) ; `elevated.maintenance.run_periodic` par transaction à effet (réservation, lignes brutes, purges).
- `testeur` : `tm1-periodic-tasks` (9 cas, plancher déclaré), `periodic-scheduler` (23), adaptateur GoTrue (+5) ; doublures `gotrue-double`, lectures de `brevo-double` (corps rédigés d'après la doc, à enregistrer au commit 10). Suite : écart visible au backoffice (AL27) depuis `ops.periodic_runs.counts`, J8/Lot 5.

## Issu du commit 6 (`cc00b72`, `9c6bbe0`)

- **Au plus sûr** : une « version » de CGU = son `version_label` (acceptée dans une langue, acceptée dans toutes) ; garde CGU active par défaut sur toute route membre, exemptions nommées (`GET /v1/me`, consentement RG34, sessions RG56, acceptation, erreurs navigateur) ; une case, deux finalités (RG33) : `PUT` change les deux, l'affichage est « accordé » si les deux le sont, sinon date et origine du dernier retrait ; `UPDATE` direct de la langue retiré aux membres (`0122`) ; pays bloqué (RG8) refusé aussi après l'inscription ; « fermer toutes » = `revoked_by_holder`, session courante comprise ; autre version ou double clic concurrent ⇒ `409`. **T7** : au Lot 1, P1 (bienvenue) et P2 partagent la priorité 100 (aucun P2 avant le Lot 4), ordre d'émission entre eux ; échelon P1 < P2 à fixer par `architecte` avant le premier émetteur P2. `outbox_events.priority` = ordre dans la voie (0 urgent : `consent.revoked` RG78, `auth.email_changed_notice` ; 100 ordinaire), distinct de la classe du catalogue `16` §H ; une ligne de file n'est jamais P0 (`architecte`, 2026-10-14).
- **J6T-3** (`9c6bbe0`) : `consent.granted` encore en vigueur à la consommation ⇒ opération 1 avec `emailBlacklisted: false` (Brevo garde sinon la liste noire) ; jamais sur un autre événement ni un contact supprimé ; une opération 1 qui mettrait en liste noire est refusée (RG137).
- `expert-cybersecurite` (fin de jalon) : `update_own_account` appelle `set_declared_status` depuis le définisseur (motif `member_settings`) ; politiques du définisseur sur `advertiser_profiles` (son compte seul) ; instantané des droits modifié (I-4) ; `terms_acceptance_required` révèle seulement qu'une acceptation manque.
- `testeur` : `tm1-member-account-route` (16), CA36 dans `t8-request-code`, CA47/T7/T8 dans `tm1-worker-loop` (6), contrat `account` (6), `consentView` (4) ; tests ESLint témoins en dépassement de délai sous `pnpm -r` en local, verts seuls (846). Suites : commit 9 : écran bloquant sur `termsToAccept` et le `403`, textes RG95 des origines (`signup_form`, `account_settings`, `brevo_webhook`).

## Issu du commit 7 (`65a11fc`) et de sa reprise 7bis (`1507ccf`)

- **Tranché le 2026-10-14** (`architecte`, `expert-cybersecurite` sans veto) : textes des codes dans le dépôt (RG67) ; code non parti ⇒ `not_sent` (`0124`, `close_unsent_email_change`) ⇒ `503`, `400 undeliverable` ; motif E-1 `identity.member_email_change` **signé** (exception « membre authentifié » de `03` P7, appelant unique vérifié par T6, C3.1, C3.2) ; jeton `reauth` dans le corps gardé (`reauthToken` masqué dans pino, `no-store`, C4.a, C4.b) ; adresse prise ⇒ `address_unavailable` explicite (C5.a) ; avis en priorité de file `0`, classe P1 inchangée.
- **Durcissements 7bis** : A1, le code d'un côté déjà confirmé est revérifié (`0124` recrée `confirm_email_change`) ; C5.b, la passe GoTrue horaire d'E-4 réaligne GoTrue sur `accounts.email` (`0125`, `ops.gotrue_realignment_candidates` : changement confirmé il y a 15 min à 72 h, 200 au plus, relu avant chaque écriture ; orphelin détenteur de l'adresse supprimé s'il n'a aucun compte ; compteurs `gotrue_realigned`, `gotrue_realign_failed`, `realign_orphans_deleted`). Code frais : compteurs RG44 de la connexion ; `checkEmailCode` partagé avec la connexion.
- `expert-cybersecurite` (fin de jalon) : attester `65a11fc`, `17c0f9f` et 7bis (conditions C3.1, C3.2, C4.a, C4.b, C5.a, C5.b remplies) ; signer `leads.receive_brevo_event` et `identity.member_reauthenticate` (ajoutés à `03` P7) ; C3.3 : plus d'élargissement des droits d'`influx_auth` sur `transactional_sends` sans signature ; alerte J9 si `gotrue_realign_failed` persiste.
- `testeur` : `tm1-email-change-route` (17), `t8-reauth-email-change` (+5, dont `not_sent` et A1), `tm1-periodic-tasks` (+4, réalignement avec doublure GoTrue étendue : `PUT`, `generate_link`), `tm1-brevo-connector` (+1) ; unitaires : e-mails, connecteur, jetons, adaptateur (+5), T6 (motif ⇒ fichiers), journal.
- Suites : commit 8 (CA32 ; export et suppression derrière `requireFreshCode`, garde CGU à lever pour eux : A3, `expert-conformite-rgpd` ; effacement des lignes de journal « nouvelle adresse » : A4) ; commit 9 (C4.c : jeton en mémoire seulement, oublié après succès ou `session_lost` ; après `503` ou `400`, retour au code frais ; textes de `address_unavailable`) ; J8 : interrupteur à `all_paused` ⇒ `503` avant la demande, mise en attente lue sur la classe ; commit 10 : modèle Brevo de l'avis en `staging`.

## Issu du commit 8 (`c971d54`) et de sa reprise 8bis (`d81bb5d`, 2026-10-14)

- Commit 8 : signal dans la transaction qui ouvre la session, « connue » = même résumé actif < 30 j ; `auth.new_device` rendu par INFLUX sans lien ; « mes données » et code frais hors garde CGU (A3). **Signé par `expert-cybersecurite`** (attestation `security-reviewed … covers c971d54`) ; plafonds du secours définitifs (5/h réseau, 10/h IP inconnue, 3/h adresse).
- 8bis : `chef-de-projet` avance l'E-5 minimale au J8 (porte de production, `21` §J8 6 et §5.8) ; `expert-cybersecurite` : remise par téléchargement dans l'espace membre (runbook §4, EC : 3 téléchargements / 7 j contre RG95), purposes exemptés en liste d'autorisation ; `expert-conformite-rgpd` : A3 validé + `PATCH /v1/me` exempté (art. 16), export complété, échéance au plus tôt de 30 j et 1 mois (`0127`), runbook §2 à §8 ; `product-owner` : RG160, CA117, CA118 ; `architecte` : accusé rendu par INFLUX (`0128`, lecture de la demande et du fuseau, `auth.new_device` dans le fuseau du compte, contrôle « aucun lien » étendu à `@` et aux domaines). Au plus sûr : `kept.erasure` sans « mises en relation » (absentes au Lot 1) ; `17` §6.3 « les données que nous détenons sur vous ».
- `expert-cybersecurite` (non bloquant) : repère persistant de première session avant la purge des sessions (≈ 0,5 j) ; Lot 5 : file des signalements sans action sur la foi d'un signalement, Q8 tranchée avant, alerte > 30/h. `testeur` : T3.11 de `t3-audit-chain` instable ; `data-request-received-email` (8), connecteur (+6), `tm1-brevo-connector` (+2).
- Suites : commit 9 (écrans `/compte/*`, écran bloquant CGU avec canal de contact, liens « Mes données » et « Préférences », refus ≠ suppression ; secours sur l'écran de connexion) ; J8 : E-5 minimale + export téléchargeable + `privacy.export_ready` ; juriste : runbook §8 ; RG69 et `auth.email_changed_notice` rendu par INFLUX : à arbitrer.

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
