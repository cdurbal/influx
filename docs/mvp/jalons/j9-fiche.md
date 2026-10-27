# Fiche J9 — Reliquat pour la fiche du Lot 2

> **J9 clos le 2026-10-27** (revue groupée `expert-cybersecurite` + `testeur`, correctifs `61ac4bd`,
> attestation `d695165`). Cette fiche ne garde que ce qui **passe dans la fiche du premier jalon du
> Lot 2** et ce qui reste **avant la production** : à reprendre à sa rédaction, puis à supprimer. Le
> récit des commits est dans `21` §J9, les décisions dans les specs et les en-têtes de `0139` à `0149` ;
> la fiche complète reste lisible par `git show 8323aeb:docs/mvp/jalons/j9-fiche.md`.

## Critère de fin du J9 sur `staging` : non constaté

Constaté le 2026-10-27 : landing FR / EN ⇒ les quatre portes EC-15, en-têtes T10 et CSP à nonce sur
`web`. **Non constaté** : `/health` répond `503` et le relais `502` (aucun relevé de `apps/api` depuis
le 2026-10-26 19:40 UTC), jeton Railway refusé (`Unauthorized`, encore le 2026-10-27). Hypothèse
J9T-1, à confirmer par les journaux : `OPS_ALERT_RECIPIENTS` (api, worker) et les trois adresses de la
sonde (worker), exigées au démarrage depuis le commit 8, jamais posées sur Railway. Ordre, avec le
nouveau jeton du fondateur :

1. Journaux de `api` et `worker` en lecture (« Invalid api/worker configuration »).
2. `staging:check` (KO attendu sur les noms), puis variables du commit 8 selon `runbooks/staging.md`
   §5 ; redéployer `api` et `worker` ensemble.
3. `/health` `200` ; `ops.worker_heartbeats` et `ops.probe_results` non vides ; `staging:check` vert.
4. Arrêt du worker ⇒ AL50 par l'API (e-mail réel), remise en marche ⇒ « rétabli », aucun doublon sous
   30 min. API coupée ⇒ `/health` `503`, AL49 au 2e échec, puis « rétabli ».
5. En-têtes T10 du backoffice ; A5.6 / T7.12 (`X-Real-IP` forgé) ; J9S-5 :
   `curl --request-target 'https://x@evil.tld/fr'` sur `web` ⇒ `400` ou redirection vers l'hôte de
   `staging`. Une inscription réelle de `staging` finit `succeeded` (`18` §10 « Lot 1 », case D67).
6. Consigner dans `21` §J9 (ligne « Constats `staging` »).

Règle tirée de J9T-1 : une variable exigée au démarrage se pose sur Railway `staging` **avant** de
pousser le commit qui l'exige.

## Tickets reportés

| Ticket | Contenu | Échéance |
|---|---|---|
| J9T-1 · J9S-5 | Constats `staging` ci-dessus | **Avant production** (jeton : fondateur) |
| J9S-2 | `api` et `worker` en `INFLUX_ENV=production` démarrent sur une base de `staging` (seul le job CI teste les marqueurs) : au démarrage, base sans `influx_production.environment_marker` ou avec celui de `staging` ⇒ sortie 1, ligne `fatal` sans valeur, test | **Avant production** |
| J9S-4 | `PUBLIC_ROUTE_RATES` par adresse : `request-code` 10 / min (au lieu de 30), `verify-code` 20 (40), `bo/auth/*` connexion, enrôlement, invitation 10 (30) ; signal « refus de portée `instance` » alerté aussitôt (`15` AL56). Vérifier d'abord que `t8-backoffice-sign-in` et `tm1-email-change-route` restent sous 10 appels / min par adresse (sinon une adresse par cas) | **Avant production** |
| AL53 | Seuil propre de `request-code` fixé (p95 > 3 s sur 10 min, ≥ 20 appels, `15` RG165) : évaluation et ligne `alert_definitions` à écrire | **Avant production** |
| Commit 11 | Manques à arbitrer (`architecte`) : cible `production` de `db:publish-terms` (EC-62, aucune inscription sans CGU publiées), amorçage du premier `admin` et du bris de glace (EC-45), équivalents production de `staging:check` et `staging:role-passwords` | **Avant production** |
| UX commit 5 | `expert-ux` : badge de `ShortVideoOverlay` proche du logo YouTube ; photo principale du héros sans rapport avec son texte alternatif | Avant production (porte « textes relus », `21` §5.8) |
| J9S-6 | `/health` de `apps/web` : un flot épuise le seau d'instance de `/v1/status` (6 000 / min) ⇒ `503` trompeur ; garder le résultat 5 s en mémoire | Lot 2 |
| J9S-7 | Écran « Santé technique » : message d'erreur navigateur = texte libre d'un membre ; l'afficher « source navigateur, texte non vérifié », jamais cliquable | Lot 2 |
| J9S-9 | Test de parité : toute valeur acceptée par le `CHECK` `sync_settings_value_shape` (`0141`) passe `unreadableApolloKeys` (`qualification.ts`) | Lot 2 |
| J9T-5 | `apps/web/e2e/support/journey.ts` `open()` / `reload()` sans barrière d'hydratation depuis le retrait du bandeau (`0bd927a`) : attente explicite ; commentaire périmé `security-headers.spec.ts` ~l. 216 ; piste de l'intermittent `journey-resume` « change of language » | Lot 2 |
| J9T-8 | Identifiants absents des titres : T8.2 `t8-verify-code` ~l. 569 ; T8.9 `t8-reauth-email-change` ~l. 502, 728 ; T13.2 `t13-error-responses` ; T17.2, T17.3 `leads-drain` ~l. 769, 864 ; T17.6, T17.7 `config.test.ts` ; TM10.1, TM10.2 `signup-form.test.ts` | Lot 2 |
| J9T-9 | `test:artifacts` sans plancher (web 47, backoffice 36) | Lot 2 |
| Classement | Aucun écrivain de l'état d'un groupe d'erreurs (`acknowledged`, `fixed`, `ignored`) : la régression d'AL51 ne se lève jamais, AL62 n'est jamais classée (`15` RG165, `17b` §3.15) | Lot 5 (avant la fin du rodage) |
| J9T-3 | Boucle de surveillance réelle prouvée pour AL49 et AL50 seulement : un cas « groupe serveur + `5xx` > 1 % ⇒ un e-mail, filigrane avancé, 2e tour muet » | Lot 5 |
| J9T-10 | Cas de `02` §20.12 (avalanche, histogrammes, arrêt du worker, alerte sans base) à inscrire au plan `18` en « TM13 — Surveillance (D60) » (`tm9-*` entre en collision avec TM9) | Lot 5 |
| T15.2 | Débit des routes de recherche et de profil (inexistantes) | Lot 3 |
| Hérités | J4S-7 (Lot 2) ; J4S-8 HSTS `preload` (domaines) ; F3 (Lot 3) ; J8S-8, J8S-9 (écrivain d'`expired`, RG102), écran des identifiants Brevo en option (Lot 5) ; F8, J7T-6 (Lot 6) ; reports D70 au Lot 6bis (`archives/jalons/d70-plan.md` l. 125 à 130) | Voir la ligne |
| J8T-8 | Info CI : `backoffice.spec.ts`, en série, reste le seul fichier e2e qui crée un `admin` | — |

Local, sans ticket : `t14` « internal-accounts » rouge par profils internes accumulés (vert sur pile
neuve) ; lignes `pending` résiduelles des e2e qui saturent le lot de TM1.11 ; `t8-backoffice-sign-in`
intermittent au passage groupé, vert seul.

## Suites déjà décidées (revue du 2026-10-27)

- Droits signés : `0142` à `0149`, E-4 et E-6 étendus, `expected-rights.ts` (`03` P7). C5.c sans
  ligne de registre admis (la ligne `info` suffit). Écran « Santé technique » : accès `admin`,
  élargissement en colonnes de `ops.error_occurrences` au propriétaire et lectures non journalisées
  acceptés. AL56 et AL61 confirmés.
- Production (`runbooks/production.md`) : valeurs héritées du fork toutes régénérées puis comparées
  sans affichage (J9S-1) ; relecteur requis obligatoire et *ruleset* sur `production` (J9S-3) ;
  marqueur de production exigé par « Migrate production », prouvé par `ci-production-job.test.ts`
  (J9T-2).
- Cookies : un seul drapeau, `IS_COOKIE_BANNER_ENABLED = false` (EC-J9-3, J9S-10), prouvé par la
  garde « aucun traceur » ; verdict L9 au Lot 6.

## Décisions encore ouvertes

- Fondateur : nouveau jeton Railway (P3) ; `02` §20.11 points 2 à 4 (astreinte, Railway Pro, rodage) ;
  `[à renseigner]` de `runbooks/production.md` ; D33 ; D35 ; D36 ; un compte `admin` distinct de
  l'`agent` (PD7) ; accord de fusion vers `production` et de mise en production (`21` §5.8, D71).
- `integrateur` : HSTS `preload` (J4S-8) ; limite mémoire d'AL57. `expert-database` : requête
  fréquente d'AL58. `product-owner` : seuil d'AL25 ; `15` Q2 à Q4.
- `expert-conformite-rgpd` (Lot 6, condition d'entrée dans `production`, D71) : verdict L9, exemption
  de consentement du collecteur navigateur, élargissement de `ops.error_occurrences` (EC-J9-5),
  RG118, RG121 (veto), retrait propagé à Apollo, notice art. 15, F8, contreparties du risque D70 (a).

## Planchers à la fin du J9

Sur `61ac4bd` (2026-10-27) : `pnpm test` = **3 082** (contracts 121, test-kit 134, backoffice 55, web 196,
`apps/api` unitaire 1 340 en 64 fichiers, base 1 236 en 55 fichiers) ; `test:db` = **1 236** ; e2e **56** (7
fichiers, sur `8323aeb`) ; `test:artifacts` 83 sans plancher (J9T-9). Tous les paquets et l'e2e sont figés (J8T-6).
