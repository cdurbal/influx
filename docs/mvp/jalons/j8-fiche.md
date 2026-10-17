# Fiche J8 — Reliquat pour la fiche J9

> **J8 clos le 2026-10-16** (revue groupée `expert-cybersecurite` + `testeur` sans point bloquant,
> attestation `262e626`). Cette fiche ne garde que ce qui **passe dans la fiche J9** : à reprendre
> à sa rédaction, puis à supprimer. Le récit des commits est dans `21` §J8, les décisions dans les
> specs et les en-têtes de `0129` à `0138` ; la fiche complète reste lisible par
> `git show a2ff7bc:docs/mvp/jalons/j8-fiche.md`.

## Critère de fin du J8 sur `staging` (fondateur, `runbooks/staging.md`)

Après les critères J6 et J7 (`runbooks/staging.md` §J7, J7S-4, J7S-5, J7S-6, J6S-5) : déploiement de
`0129`–`0138` ; `PRIVACY_DATABASE_URL` et mot de passe d'`influx_privacy_login` sur le worker ;
J4R-1 (secrets commercial/admin changés). Puis : une inscription par une invitation membre attribue
le commercial ; un rejeu ne crée aucun doublon chez Brevo ; une suppression va jusqu'à Brevo
(`account.deleted`, demande close après confirmation). Vérifié en local avec la doublure seulement.

## Tickets reportés

| Ticket | Contenu | Échéance |
|---|---|---|
| J8S-1 | PD6 : revue hebdomadaire des 2V dégradées sans route ni écran (`degradedConfirmationsByWeek`) ; `GET /v1/bo/dual-control/degraded` (admin) + bloc d'accueil | **Avant Lot 1** |
| J8S-2 | PD1 : portée exacte à la confirmation 2V (`DualControlScreens.tsx` l. 114) — `invite_admin` montre un UUID, `approve_data_request` le type sans le compte | **Avant Lot 1** |
| J8S-3 | `0130` `assert_fresh_second_factor` : lier R à la session de la requête (`request.jwt.claims` → `session_id`, posé par `db/index.ts`) ; `0139` + test | **Avant Lot 1** |
| J8S-4 | RG101 : attribution du rôle `admin` alertée (`account.role_granted` lu 7 j, comme `new_browser_sign_ins()`, à l'accueil) ; e-mail au Lot 5 | **Avant Lot 1** |
| J8S-5 | `0131` RLS de `member_invitations` : un agent lit toutes les invitations (EC-J8-31 en API seulement) ; politique `admin` ou auteur + T2 | J9 |
| J8S-6 | R partage le seau IP de la connexion (20 / h) : seau propre `backoffice_reauth_ip` (60 / h) | J9 |
| J8S-7 | Recherches exacte et partielle hors URL (journaux, historique) : `POST` avec le terme dans le corps ; règle EC-J8-58 | J9 |
| J8S-8 | `correct_email()` sous R sans 2V : aucune route ne l'expose sans 2V | Lot 5 |
| J8S-9 | Écrivain de `expired` des 2V et information du demandeur (`15` RG31) ; runbook « admin indisponible » (désactiver son profil, journalisé, rouvre PD7) en J9, réinitialisation de facteur RG102 au Lot 5 | J9 (runbook), Lot 5 |
| J8T-1 | CI rouge à I-4 depuis le commit 2 : attestation faite à la clôture (`262e626`) ; le rouge local de `format:check` sur `t14-backoffice-route-inventory` était une fin de ligne CRLF de la copie de travail, le dépôt est en LF . Premier push (`7d7fd24`) : T11 rouge sur le backoffice (noms d'export `APOLLO_*` du contrat dans le JavaScript du navigateur, depuis le commit 9), corrigé par le renommage `PROSPECTING_*` ; vérifier Playwright et la migration `staging` au push du correctif | Push du correctif |
| J8T-2 | CA62 « panne 15 min » : requête AL25 `destination_down` / `quota_exceeded` (`repository.ts` ~l. 1310) sans test en base | J9 |
| J8T-3 | CA58 « aucun doublon » : rejeu → worker → doublure avec un seul contact ; relire `tm1-brevo-connector`, `tm1-apollo-connector`, sinon ajouter | J9 |
| J8T-4 | Aucun contrôle axe sur les écrans du backoffice (`backoffice.spec.ts`) : liste, fiche, Apollo, 2V, invitations | J9 |
| J8T-5 | CA59 à l'écran : message `overCap` du `ReplayPanel` non testé (view-model) | J9 |
| J8T-6 | Planchers figés pour web 205, backoffice 30, e2e 24, contracts 80, test-kit 116 | J9 |
| J8T-7 | Recherche exacte et filtres de période en e2e une fois J8S-7 fait | Avec J8S-7 |
| J8T-8 | La 2V dégradée de l'e2e désactive les autres admins de la base partagée : jamais en parallèle d'un autre job | Info CI |
| J7S-1 | `withMemberSession` pose `influx.session` ; `consume_member_reauthentication` exige cette session | Avant production |
| J7S-2 | Disjoncteur de la purge GoTrue (55000 si `identity.accounts` paraît vide ; abandon > 50 % d'une page de plus de 20) | **Avant production** |
| J7S-3 | Webhook Brevo : `404` hors surface `web` ; test ; puis `03` A4 | Avant production |
| J7S-4 · J7S-5 · J7S-6 · J6S-5 | A5.6 sur `staging` ; `.claude/settings.json` ; `raw.jsonl` ; `.env.example` (texte : `git show 1c85756:docs/mvp/jalons/j7-fiche.md`) | Fondateur |
| J7S-8 | Alertes `gotrue_realign_failed`, taux de `webhook.brevo.ignored` et `ip_drift` ; AL48 et seuils RG63 | J9 |
| J7T-6 | Relecture des textes `account.*` (D48, D36) | Lot 6 |
| F3 · F4 · F8 | (revue du commit 8) liste d'autorisation des codes du journal exporté ; index `audit_events.actor_account_id` + alerte « exécutée, non close depuis 24 h » ; `legal_name` d'une charge 2V et notes de 2V non anonymisées | Lot 3 · J9 · Lot 6 |

## Suites déjà décidées

- Avant la mise en ligne du Lot 1 : C5.c (orphelin GoTrue de la nouvelle adresse supprimé puis
  nouvel essai), A2 (code de la nouvelle adresse compté sur RG44).
- EC-J8-19 tranché : rejeu en lot sans 2V (`03` §3.5, `15` RG86 réalignés). EC-J8-62 : lectures
  `new_browser_sign_ins()` et `GET /v1/bo/internal-accounts` non journalisées (données d'équipe,
  aucune donnée membre), à surveiller. Résiduel accepté : `email_exists` bloque une nouvelle
  acceptation d'invitation interne à la même adresse jusqu'à la purge des orphelins.
- Runbook J9 : lien d'invitation interne transmis hors e-mail ; révocation `suspected_compromise`
  si l'invité échoue.
- Lot 5 : notification RG44 d'une correction (EC-J8-22), `account.email_corrected` et suspension
  marketing sur `401` (RG123), désactivation et transfert de portefeuille (EC-J8-60), export agrégé
  (CA64, `15` §I), contact reçu par Apollo ⇒ suivi manuel des demandes.
- `architecte` : échelon P1 < P2 de `outbox_events.priority` avant le premier émetteur P2 (EC-J8-29).

## Décisions encore ouvertes

- Fondateur : D35 (e-mail d'invitation membre) ; D36 (langue du backoffice, libellés FR seuls
  EC-J8-59) ; un compte `admin` distinct de l'`agent` quotidien (rend PD7 effective).
- `product-owner` : seuil d'AL25 (écrit d'après CA62, `05` RG104 muet) ; seuil d'AL21 (Lot 3 / 5) ;
  `15` Q2 à Q4 (délais `is_provisional`).
- `expert-conformite-rgpd` (Lot 6) : RG118, RG121 (veto), retrait propagé à Apollo, formulation de
  l'export « mes données » et notice art. 15 (juriste avant la première demande, runbook §8), F8.

## Planchers à la fin du J8 (`testeur`, 2026-10-16, sur `a2ff7bc`)

Base 1 038 cas (48 fichiers) ; unitaire `apps/api` 1 017 (51) ; contracts 80 ; test-kit 116 ;
web 205 ; backoffice 30 ; e2e 24 ; `pnpm test` = 2 486. Figés : `apps/api` seul (J8T-6).
