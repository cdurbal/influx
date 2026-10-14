# Fiche J7 — Reliquat pour la fiche J8

> **J7 clos le 2026-10-14** (revue groupée `expert-cybersecurite` + `testeur` sans point rouge,
> attestation `5b977f7`). Cette fiche ne garde que ce qui **passe dans la fiche J8** : à reprendre
> à sa rédaction, puis à supprimer. Le récit des commits est dans `21` §J7, les décisions dans les
> specs ; la fiche complète reste lisible par `git show 5b977f7:docs/mvp/jalons/j7-fiche.md`.

## Critère de fin du J7 sur `staging` (fondateur, `runbooks/staging.md` §J7)

Ordre : déploiement du code J7 et de `0115`–`0128` ⇒ variables (`BREVO_WEBHOOK_*`, `SUPABASE_*` du
worker, worker en `dry_run` sans clé Brevo, D62) ⇒ J7S-4, J7S-5, J7S-6 ⇒ webhook du compte Brevo
**de test** ⇒ une vraie désinscription d'un contact de test : une ligne brute, consentement retiré
(`brevo_webhook`), aucun `ip_drift` ⇒ `trial:record` et fixtures rédigées remplacées. Puis : un
membre consulte et modifie informations, préférences, sessions et accepte une nouvelle version des
CGU ; un retrait écrit une ligne de priorité 0 prise sous 5 min ; rapprochement et purge tournent une
fois sans erreur. Rejeu manuel contre `staging` interdit (veto `expert-cybersecurite`). Non prouvé,
à ne pas présenter comme testé : propagation du retrait à Apollo (`skipped`), forme réelle des corps
Brevo.

## Tickets reportés

| Ticket | Contenu | Échéance |
|---|---|---|
| J7S-1 | `withMemberSession` pose `influx.session` ; `consume_member_reauthentication` exige cette session (aujourd'hui `p_session_id` fourni par l'appelant, limité au compte) | Avant production |
| J7S-2 | Disjoncteur de la purge GoTrue : `filter_auth_orphans` lève 55000 si `identity.accounts` paraît vide ; le worker abandonne si les orphelins dépassent 50 % d'une page de plus de 20 ; test | **Avant production** |
| J7S-3 | Webhook Brevo : `404` hors surface `web` ; test ; puis `03` A4 « surface `web` seule » | Avant production |
| J7S-4 | Refaire A5.6 sur `staging` : `X-Real-IP: 1.179.112.1` forgé ⇒ `404`, aucune ligne brute (runbook, étape 3) | Avant le webhook de test |
| J7S-5 | `.claude/settings.json` (`d532023`, non attesté) : rétablir le refus de lecture de `.env.*.local` et `.env.trial*` | Fondateur, immédiat |
| J7S-6 | Supprimer `apps/api/.provider-recordings/raw.jsonl` (J6) ; `trial:record inbound` refuse de démarrer s'il existe | Avant le webhook de test |
| J7S-7 | Constante propre à la ré-authentification membre (aujourd'hui la valeur R du backoffice) + test liant le 300 du SQL | J8 |
| J7S-8 | Alertes : `gotrue_realign_failed` persistant, taux de `webhook.brevo.ignored` et `ip_drift` | J9 |
| J7T-1 | Délai du projet Vitest `unit` (5 s) : 20 s, ou sur les seuls témoins ESLint et `check-security-review` | J8 |
| J7T-2 | Concurrence : deux POST identiques au webhook (une ligne), double acceptation CGU (un `409`), deux consommations du marqueur (une gagne) | J8 |
| J7T-3 | Planchers de cas unitaires (aujourd'hui la base seule) | J8 |
| J7T-4 | Contrôle axe des écrans « mon compte » à 375 px (WCAG AA) | J8 |
| J7T-5 | « Mes données » en e2e (demande d'export et de suppression, mot `SUPPRIMER`) | J8 |
| J7T-6 | Relecture des textes `account.*` et des listes « disparaît / conservé » (D48, D36 ; conformité Lot 6) | Lot 6 |
| J6T-1 | TM1.1 en propre : Brevo seul en 500 sur la vraie file (plancher `tm1-brevo-connector`) | J8 |
| J6T-2 | EC-44 : cas `security.critical_alert_no_recipient` et `journal_unavailable` | J8 |
| J6S-5 | `apps/api/.env.example` : clé Brevo du worker, `BREVO_SUPPRESSION_LIST_ID`, `APOLLO_API_KEY` à confirmer | Fondateur |

## Suites déjà décidées pour le J8

- `21` §J8 point 6 : E-5 minimale, export téléchargeable (code frais `data_export`, 3 / 7 j),
  `privacy.export_ready` sans lien ; porte de production.
- Canal de secours **sur l'écran de connexion** (`POST /v1/support/code-not-received`, RG65) : API
  faite au commit 8, écran non branché.
- Levée de suppression Brevo par un `admin` (RG93) ; écart du rapprochement visible au backoffice
  (AL27) depuis `ops.periodic_runs.counts` (J8 ou Lot 5).
- Interrupteur à `all_paused` ⇒ `503` avant la demande de changement d'adresse ; mise en attente lue
  sur la classe.
- `account.email_corrected` reste `template_not_supported` ; suspension marketing sur `401` (RG123),
  J8 ou Lot 5 ; modèles Brevo EC-8 en `staging` (`NULL` ⇒ `skipped`).
- `architecte` : échelon P1 < P2 de `outbox_events.priority` avant le premier émetteur P2.
- Lot 5 : file des signalements (Q8 tranchée avant, aucune action sur la foi d'un signalement,
  alerte > 30/h) ; repère persistant de première session avant la purge des sessions.

## Décisions encore ouvertes

- `expert-conformite-rgpd` (Lot 6) : retrait propagé à Apollo, conservations 30 j, abonnement
  minimal, rétention des tables du 2bis, formulation des listes de « mes données » ; juriste :
  runbook `demandes-rgpd.md` §8.
- Fondateur : webhook du compte Brevo de production (`prerequis.md`) ; avis
  `auth.email_changed_notice` rendu par INFLUX (RG67) ou modèle Brevo (EC-8) ; RG69 ; D36, D48.
- Avant la mise en ligne du Lot 1 : C5.c (orphelin GoTrue de la nouvelle adresse supprimé puis
  nouvel essai) et A2 (code de la nouvelle adresse compté sur RG44).

## Planchers de tests à la fin du J7 (`testeur`, 2026-10-14, sur `bd513d4`)

- Base : `apps/api/db-tests/case-floors.ts` = constaté (754 cas, 36 fichiers).
- Unitaire `apps/api` (946 au total, à figer par J7T-3) : `inbound-recording` 31,
  `provider-recording` 17, `reconciliation-reads` 2, `trial-record-guards` 4, `periodic-scheduler` 23,
  `account-consent-view` 4, `data-request-received-email` 8, `new-device-email` 6,
  `email-change-email` 6, `brevo-webhook` 52, `brevo-connector` 60, `supabase-adapter` 38,
  `client-address` 38, `config` 112.
- Autres : contracts 63 (`account` 11), test-kit 116 (`check-security-review` 46), web 203
  (`account-view` 15, `relay` 68, `guards` 27), e2e 16 (`account.spec.ts` 5) ; `pnpm test` = 2 106.
