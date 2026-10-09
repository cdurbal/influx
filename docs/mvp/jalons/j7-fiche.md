# Fiche J7 — Retours de Brevo et espace membre minimal

> **Point d'entrée de toute session du J7.** Lire cette fiche, puis **seulement** les tranches
> citées (`Read` avec `offset`/`limit`, ou `Grep` sur la RG). Ne pas lire le plan `21` en entier,
> ni `INDEX.md`, ni `decisions.md`, ni les archives, ni la fiche J6, ni un skill en entier.
> Les numéros de ligne datent du 2026-10-09 : s'ils ont glissé, `Grep` sur le titre de section.

## Préalable

J6 clos : commit 7 (essai manuel D62, fixtures expurgées, variables du `worker` de `staging`) poussé ;
revue groupée `expert-cybersecurite` + `testeur` rendue ; attestation `security-reviewed: <date> covers
d066228 c00f9f2 8798ec2 2136515 f4f9ebc …` posée (I-4 vert) ; `21` §J6 condensé ; fiche J6 supprimée
ou condensée. Les points rouges de cette revue deviennent le commit 1 ci-dessous.

## Objectif et critère de fin

**Les désinscriptions circulent dans les deux sens et le membre gère son compte.** `21` §J7 ne fixe
aucun « Terminé quand » ; proposé, **à confirmer par le fondateur** : sur `staging`, un membre consulte
et modifie ses informations, ses préférences, ses sessions et accepte une nouvelle version des CGU ; un
retrait de consentement écrit une ligne de priorité 0 prise sous 5 minutes ; un événement Brevo
`unsubscribed` enregistré, rejoué contre le webhook de `staging`, retire le consentement (source
`brevo_webhook`) et son doublon est ignoré ; rapprochement et purge tournent une fois sans erreur.

## Commits prévus

1. **Dette J6** : points rouges de la revue de fin de J6 ; I-4 comparé à la dernière attestation et non
   au seul push (si non soldé au J6) ; liaison famille de motif ⇒ rôle de connexion dans
   `audit.append_elevated()` (si retenue) ; cas instables `t8-verify-code` RG47 (l.537, J7 touche
   `verify-code`) et `t13-ops-recording` (fenêtre à la minute).
2. **Migrations du J7** (`expert-database`, numérotation à partir de `0115`, `0102`/`0107` restent au
   J8) : table brute des événements Brevo entrants en ajout seul (EC-12) et fonctions E-3 de leur
   traitement ; codes `consent.granted`, `consent.revoked`, `email.changed` dans `audit.event_types`
   (EC-10, CA47) ; objets de l'espace membre selon les décisions 4 à 6 ; fonctions E-4 (purge,
   rapprochement). T2, T4, T6 étendus.
3. **Webhook Brevo, réception** : `POST /v1/webhooks/brevo/:token` (contrat zod requête **et**
   réponse), exception A4 nommée et fermée, passe-plat (PP-5, empreinte PP-12), jeton comparé en temps
   constant avec rotation à deux valeurs, plages IP sur `x-real-ip` (A5), fenêtre 15 min, idempotence
   (`message-id`, `event`, horodatage), écriture brute puis réponse immédiate (RG147). Scénarios 8, 9.
4. **Webhook Brevo, traitement par le worker** : trois familles RG106 (seule « retire un droit » a un
   effet au J7), Brevo fait foi (RG90), plainte ⇒ liste de suppression définitive (RG93), rebond dur
   transactionnel ⇒ `email_delivery_incidents` + `email_status = 'undeliverable'`, événement inconnu
   journalisé et ignoré (RG105). TM1.5, CA52, CA54, CA55, scénario 7.
5. **Tâches périodiques E-4** : rapprochement quotidien des 48 h (RG91, RG113, CA53) et purge des
   utilisateurs GoTrue orphelins après 24 h (`04` §9), ordonnancées dans le worker.
6. **API « mon compte » (1)** : `PATCH /v1/me` (RG15, `lead.updated` RG73), `GET`·`PUT /v1/me/consent`
   (RG34, RG92, RG95 ; `consent.revoked` priorité 0, RG78), `GET`·`DELETE /v1/me/sessions[/:id]`
   (RG56, RG143), `POST /v1/me/terms/accept` et blocage (RG28). CA33, CA35, CA36, CA70, CA47 avec le
   vrai code, lead-pipeline T7, T8, T14.
7. **API « mon compte » (2), sécurité** : re-authentification par code frais (RG57) ; changement
   d'adresse à double confirmation (RG58, A-11, `email.changed` ⇒ contact Brevo **mis à jour, jamais
   dupliqué**) ; signal « navigateur inconnu » à la vérification (RG141, RG142, `auth.new_device` P1) ;
   modèles P1 du J7 ajoutés au connecteur Brevo ; « mes données » (EC-14) ; canal de secours
   `POST /v1/support/code-not-received` (RG65, T15). CA26, CA32, CA34, CA80, CA81.
8. **Écrans « Mon compte »** (`17` §6.1 à §6.4, écran bloquant CGU de §6.7) sous `/compte/*`,
   `locales/<langue>/account.json`, états et accessibilité ; Playwright : préférences, sessions, CGU
   bloquante, changement d'adresse jusqu'à l'état d'attente.
9. **Essai et `staging`** : webhook du compte Brevo **de test** vers `staging` (configuration Brevo =
   action du fondateur, `CLAUDE.md` §7 règle 4) ou rejeu d'un événement enregistré ; variables des
   services (`integrateur`) ; vérification du critère de fin.

## Décisions de démarrage (à obtenir, un appel groupé par agent)

`expert-cybersecurite` **avant le commit 3** (`03` l.1404 l'exige « avant le J7 ») :

1. **Exception A4 du webhook** : forme nommée et fermée (chemin exact, méthode, surface) ; jeton dans
   le chemin (EC-12) **et/ou** en en-tête personnalisé (`16` M6-1) ; source et rafraîchissement des
   plages IP Brevo ; codes de réponse sur jeton ou IP refusés (sans provoquer de réessais en boucle) ;
   volume des lignes `elevated.*` du traitement (D60, déjà ouvert au J6).

`architecte` (puis `expert-database` pour la forme fine, au commit 2) :

2. **Table brute et traitement** : nom et schéma, colonnes conservées (l'événement porte l'adresse :
   durée de conservation, aucune ligne `pino` du contenu), rôle qui écrit depuis la route (nouveau motif
   E-1 ? T6), rattachement au compte (`provider_message_id` de `transactional_sends`, sinon adresse).
3. **E-4** : ordonnancement dans le worker (verrou ou ligne de dernière exécution), opération Brevo du
   rapprochement **absente de `16` §M1** (relire la documentation officielle, RG150), purge par l'API
   d'administration GoTrue (clé `SUPABASE_SECRET_KEY` du worker, `02` l.1220), trace `retention.purged`.
4. **Re-authentification (RG57)** : réemploi de `request-code`/`verify-code` avec une finalité,
   marqueur sur la session et durée de validité (aucune valeur dans les specs : ne pas l'inventer).
5. **Changement d'adresse (RG58)** : stockage de la demande (24 h), mode de confirmation (code saisi
   dans l'espace ou lien ; aucun secret dans une charge utile de file, RG74), mise à jour GoTrue,
   identifiant du contact Brevo (opération 1 de §M1 sur `email.changed`).
6. **« Mes données » (EC-14) et canal de secours (RG65)** : `backoffice.data_subject_requests` est
   prévue en `0502` (Lot 5) : table minimale anticipée ou table propre au Lot 1 ; e-mail d'accusé de
   réception **absent du catalogue `16` §H** ; procédure écrite d'exécution manuelle (runbook) ; table
   du canal de secours sous la fonction étroite du motif `support.report_delivery_issue` (déjà déclaré).

**Restent ouverts (non tranchés) :** critère de fin ci-dessus ; propagation du retrait à Apollo (veto
RGPD, Lot 6) ; D36 (corps FR+EN) ; textes `account.*` à faire relire (D48).

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

**Homonymes :** T7 et T8 du plan `21` §J7 sont ceux du **skill `lead-pipeline`** (ordre P0 ⇒
révocation ⇒ P1 ⇒ P2 ; révocation sous 5 min), **pas** ceux de `18` (T7 = passe-plat, T8 =
authentification), qui s'appliquent aussi (commits 3 et 7).

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

TM1.5 attend le webhook (commit 4) ; CA47 : le code `consent.revoked` entre avec son émetteur
(commits 2 et 6, remplacer la ligne `lead.updated` de priorité 0 du test) ; `email.changed` créerait un
second contact Brevo par adresse (commit 7) ; `account.email_corrected` reste `template_not_supported`
jusqu'au J8 ; suspension marketing sur `401` (scénario 5, RG123) avec l'interrupteur (J8 / Lot 5).
Nouvelles variables (webhook, clé GoTrue du worker) : skill `env-secrets` ; `apps/api/.env.example`
est illisible pour l'agent, le fondateur les y documente.

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
- Sous-agents : `expert-cybersecurite` une fois au démarrage (décision 1) ; `architecte` une fois
  (décisions 2 à 6, groupées) ; `expert-database` au commit 2 ; `integrateur` au commit 9 ; revue
  groupée `expert-cybersecurite` + `testeur` en fin de jalon. Pas de `chef-de-projet`, pas
  d'`Explore` sur un chemin cité ici.
- Points de revue au fil des commits en section « Issu du commit N », **10 lignes au plus chacune** ;
  à chaque commit, condenser les points soldés : la fiche reste sous 250 lignes (la fiche J6 a atteint
  340 lignes, relues à chaque session).
- À la clôture : 1 ligne par commit dans `21` §J7, puis supprimer cette fiche ou la condenser.
