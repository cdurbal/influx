# Garde-fou, contrôles de CI, mise en service (lire pour : un garde-fou, un contrôle CI, un nouvel environnement)

Exploitation courante de `staging` : `docs/mvp/runbooks/staging.md`. Ce fichier ne la recopie pas.

## Garde-fou d'environnement : quatre verrous (D70)

Indépendants et cumulatifs (un seul finit toujours par sauter), chacun testé (T17, `03` §8). **D70
(2026-10-18, fondateur, contre `03` §6.8)** : `staging` se comporte comme la production. Un envoi réel
depuis `staging` n'est plus un incident ; en sont un : un envoi réel depuis la CI, un test ou la pile
locale, et toute clé de production hors production.

| Verrou | Pile locale, CI, tests | `staging` | Production |
|---|---|---|---|
| **1. Clés distinctes** | Clés des comptes de `staging` dans `.env.local` (D62 amendée) ; aucune clé en CI | Clés des comptes Brevo et Apollo **de `staging`** | Clés de production, **nulle part ailleurs** |
| **2. Mode explicite** | `SYNC_MODE=dry_run`, `BREVO_MODE=disabled` ou `redirect` : rien n'est appelé, la ligne est marquée traitée, ce qui aurait été envoyé est journalisé | **Levé** : `live` | `live` ; refus de démarrer en `dry_run` (une production muette est aussi grave qu'un envoi de test réel) |
| **3. Liste blanche de destinataires** | Condition **positive** (« l'adresse figure dans `NON_PRODUCTION_RECIPIENT_ALLOWLIST` / `BREVO_TEST_RECIPIENTS` »), évaluée **au connecteur, après tout le mappage**, juste avant l'appel sortant | **Levé** (variables refusées) | Sans objet |
| **4. Aucune donnée de production dans `staging`** (le plus important) | — | Données **synthétiques** (`supabase/seed`) et testeurs internes. Toute restauration de sauvegarde de production vers un autre environnement : **autorisation écrite du fondateur et anonymisation préalable** | — |

Compléments : `staging` inaccessible au public ou `noindex` (`X-Robots-Tag` sur toutes les réponses) ;
bandeau d'environnement permanent au backoffice non productif, en toutes lettres (`16` RG118). **Tout
envoi réel constaté depuis un environnement de test se déclare comme incident** (`16` RG120) : coupure
de la clé, recensement des destinataires atteints, information des personnes si nécessaire,
consignation.

## Contrôles de CI obligatoires : le build échoue, il n'avertit pas

| # | Contrôle | Ce qu'il empêche |
|---|---|---|
| **CI-1** | Aucune variable `SUPABASE_*` exposée au client : échec si nom préfixé `NEXT_PUBLIC_`, référencée hors de `apps/api`, ou lue hors de `src/config/` dans un front | La reclassification silencieuse de la clé `anon` en « valeur publique inoffensive » |
| **CI-2** | Analyse des artefacts de construction de `apps/web` et `apps/backoffice` : aucune occurrence de `SUPABASE_` (URL de projet comprise), `BREVO_`, `APOLLO_`, `SERVICE_ROLE`, `AUTH_TOKEN_SIGNING_SECRET`, `AUTH_THROTTLE_PEPPER`, `DATABASE_URL`, ni chaîne ressemblant à un JWT ou à une chaîne de connexion Postgres | La fuite par empaquetage (`03` §8, T11, étendu à tout préfixe `SUPABASE_`) |
| **CI-3** | Analyse de secrets sur le dépôt **et son historique**, `.env*` ignoré vérifié | Le secret commité puis « retiré » |
| **CI-4** | Aucun rôle d'exécution avec `rolbypassrls` ni `rolsuper` (T4) | La RLS annulée en silence |
| **CI-5** | `DIRECT_DATABASE_URL` absente de toute configuration de service Railway | Le rôle propriétaire joignable depuis un processus qui sert des requêtes |
| **CI-6** | Les verrous du garde-fou, chacun testé séparément (T17) : la pile locale et les tests gardent les verrous 2 et 3, `staging` refuse exactement ce que refuse la production ; aucun script de test ne charge `.env.local` | L'e-mail réel parti de la CI ou d'un test ; un `staging` qui diverge de la production |

## Mise en service d'un environnement

À dérouler une fois par environnement, **avant le premier envoi réel**. Pour `staging`, le déroulé
exploité par les agents est celui du runbook.

- [ ] Projet Supabase **dédié** (un par environnement)
- [ ] Rôles Postgres selon la liste fermée de `03` §4 P7 : `influx_app`, les quatre rôles métier,
      `influx_auth` + `_login`, `influx_worker` + `_login`, `influx_ops` + `_login`, `influx_privacy` +
      `_login`, les propriétaires de fonctions sans membre (`influx_audit_writer`,
      `influx_session_resolver`, `influx_identity_definer`) ; **aucun `BYPASSRLS` ni `SUPERUSER`** ; le
      rôle `service_role` n'est utilisé nulle part, `influx_service` n'existe pas
- [ ] Variables de base sur le seul service porteur ; `DIRECT_DATABASE_URL` **uniquement** dans les
      GitHub Secrets
- [ ] Quatre services Railway (`web`, `backoffice`, `api`, `worker`) ; **`api` sans hôte public**
- [ ] **Domaines d'envoi, bloquant.** Les trois sous-domaines de `16` RG9 (`tx.` transactionnel,
      `news.` marketing, `pro.` prospection) créés et **authentifiés séparément (SPF, DKIM, DMARC)** ;
      politique DMARC décidée avec `expert-marketing` ; **aucun envoi avant que les trois le soient**,
      le service **refuse de démarrer** en `live` sans cela (RG116). Depuis D37 le code de connexion
      arrive par e-mail : **la délivrabilité est la disponibilité du produit** (`prerequis.md` §14.3)
- [ ] Variables Brevo renseignées, `BREVO_MODE` cohérent avec l'environnement ; webhook configuré
      (chemin à jeton non devinable, en-tête personnalisé, plages d'IP à jour et surveillées)
- [ ] Quatre verrous actifs et testés (T17) ; `staging` non indexé, base alimentée par `supabase/seed`
- [ ] Traçabilité de déploiement (quel commit, qui, quand, vers quel environnement) ; procédure de
      rollback écrite et essayée une fois

## Ce qui reste à confirmer

| # | Sujet | Qui tranche |
|---|---|---|
| 1 | Noms des trois sous-domaines d'envoi (`tx.`, `news.`, `pro.`), à confirmer avec le domaine retenu (`16` Q13) | `integrateur` + **Fondateur** |
| 2 | Absence de signature des webhooks Brevo (`16` RG146, Q3) : jeton, chemin et plages d'IP suffisent-ils ? | **`expert-cybersecurite` (veto)** |
| 3 | Politique DMARC de chaque sous-domaine (`none` puis durcissement, ou `quarantine` d'emblée) | `integrateur` + `expert-marketing` |
| 4 | Stockage des secrets au-delà de GitHub Secrets et Railway (coffre dédié) quand plusieurs personnes y accèdent | `expert-cybersecurite` + **Fondateur** |

(Ancien point « `BREVO_API_KEY` hors production » : tranché par D70.)
