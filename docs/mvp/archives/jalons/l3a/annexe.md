# Jalon L3A — annexe

## Tests
| Identifiant | Commit | Niveau, fichier | Ce qu'il prouve | Plancher |
|---|---|---|---|---|
| L3A-T1 | 05 | base, `profiles-creator-decisions.test.ts` | Publication refusée 55000 pour un compte `suspended`, puis `deleted` ; rejet et libération acceptés sur le compte suspendu | 21 → 24 |
| L3A-T2 | 05 | base, `profiles-brand-decision.test.ts` | Deux index partiels présents (`pg_indexes`) ; plan sous `enable_seqscan = off` qui les emploie ; résultat de `advertiser_duplicate_candidates()` inchangé | 62 → 63 |
| L3A-T3 | 06 | base, `profiles-creator-identity.test.ts` | Aucune fonction de `influx_identity_definer` avec `execute` dynamique (L2DS-5) | 83 → 84 |
| L3A-T4 | 06 | base, idem | T1-R par dépendances, tous schémas ; témoin : vue et fonction d'un autre schéma lisant `profiles.creator_identities`, accordées à `influx_advertiser` dans une transaction annulée, détectées | 84 → 86 |
| L3A-T5 | 07 | base, `t8-privacy-execution.test.ts` | Code non exportable absent de l'`activity_log`, code exportable présent ; insertion d'un code sans classification refusée ; aucun code non classé | 95 → 98 |
| T2 | 05, 07 | base, `t2-rls-matrix.test.ts` | Matrice RLS inchangée | 29 |
| CI | 04 | run GitHub | Deux éclats verts, contrôle vert, durées ; essai à blanc du contrôle | — |

Budget : e2e 0 s (aucun parcours) ; base ≈ + 11 cas, moins de 10 s. Suite base entière (pas
seulement le domaine) pour 05 et 07 (migration, D76).

## Critère de fin
- [x] `design-system-influx` et `backoffice-ops` : `SKILL.md` ≤ 10 Ko, références ≤ 16 Ko — `wc -c` : 9 625 et 6 880 octets ; références 3 622 à 9 535 octets (`9c149d1`, `99bf9f2`).
- [x] Chaque éclat base ≤ 7 min 30, éclat le plus long + contrôle ≤ 8 min — identifiant du run et
      durées des jobs dans `run.md` : run 43430194053, 229 s et 249 s, contrôle 15 s (4 min 24 s).
- [x] Essai à blanc : un fichier retiré de la répartition fait échouer le contrôle — sortie citée (L3AT-3) : `run.md` § Mesures de clôture.
- [x] `0301` et `0302` sur `staging` — job « Migrate staging » vert, identifiant du run : 43430194053 (`7c5cd82`, 26 s).
- [x] Reliquat soldé dans `21` §8 : L2D-E2E, L2CS-6, L2GS-8 (volet publication ; volet recherche
      repris par L3E), L2DS-3, L2DS-5, F3, L2GT-9 — SHA par ligne (`0174f93`, `ba56aae`, `e886b37`, `7c5cd82`, `7a9b916`).
- [x] `pnpm check` puis `pnpm test:e2e` verts — sorties à la ligne C : `run.md` § Mesures de clôture.
- [x] Revue groupée soldée et attestée (`security-reviewed:`) : § Revue, 0 bloquant ; attestation `chore(security): attest the end-of-L3A review` (commit de clôture).

## Écarts, décisions ouvertes, risques
- **EC-L3A-1** : `04` §11 numérote `0301` à `0306` pour le Lot 3 (indicatif) ; L3A prend `0301` et
  `0302`, les migrations du Lot 3 se décalent de deux (`campaigns_core` devient `0303`). `04` §11
  amendé à la ligne C.
- **Mesure de départ** : job base de 405 s en CI sur `da4109f` (run 43394059337, 2026-11-13), contre
  494 s à la revue de L2G : variance des machines. Le lot ajoute 60 à 90 s : les éclats restent le
  choix A du fondateur (2026-11-12).
- **L2GT-9** : run 43394059337, vert sur tous ses jobs (« Migrate staging » compris), porte sur
  `da4109f`, descendant de `de69db7` et `6f1aeed` : condition de `l2g/cloture.md` point 6 remplie.
- **F3** : affecté à L3A (question 1 au fondateur) pour classer les quelque 170 codes actuels avant
  que le Lot 3 n'en ajoute. Hypothèse de l'arbitrage : en cas de doute, un code est exporté (art. 15) ;
  exclusion seulement pour une mesure de sécurité interne ou la donnée d'un tiers. Veto RGPD sur la
  liste au Lot 6 (D71).
- **L2C-HARNAIS** : en CI, chaque éclat a sa pile, sans objet ; en local, une suite base à la fois.
- **L2GS-5** : aucune porte neuve de `influx_creator_profile_definer` dans L3A.
- **DS-flaky** : surveillé à la ligne C.

## Revue
Fin de jalon (2026-11-13, `bf5303f..7c5cd82`) : **0 bloquant**, 3 jalon, 1 avant production, 12 plus
tard. Rapports rendus sans fichier (les `l3a/revue-constats-*.md` de `revue.md` n'existent pas) :
cette section fait foi. **Verdict S** : `main` et `staging`, rien ne bloque (D71) ; entrée de L3A dans
`production` autorisée sous conditions : L3AS-7 traité ou arbitré par `expert-conformite-rgpd`,
attestation I-4 posée (`cloture.md` point 5), L2GS-1 à L2GS-4 toujours dues. GRANT I-4 examinés et
tenus : `0301` EXECUTE de `normalized_brand_name` aux quatre écrivains d'`advertiser_profiles` ;
`0302` `select (code, export_class)` à `influx_privacy_definer`, politique
`event_types_privacy_definer_select`. Aucun constat S n'ouvre de ligne fix.
**Mesures T** : run 43430194053 (`7c5cd82`) éclats 229 s et 249 s, contrôle 15 s ; run 43422240661
(`0174f93`) 226 s, 273 s, 21 s ; invariant 3 tenu (4 min 24 s pour 8 min). L'échec intermittent
L2C-16/L2C-17 est une instabilité à cause déterministe, pas une régression de L3A.

### À corriger dans le jalon
- **L3AT-1 — e2e instable (→ fix-1).** `apps/web/playwright.config.ts:36` fixe
  `INFLUX_E2E_RUN ??= randomUUID().slice(0, 8)` ; `runTag` (`apps/web/e2e/support/backoffice.ts:36-38`)
  en tire les noms de marque (`Maison e2e<8 car. hex>q1A`) ; RG19
  (`packages/domain/src/shared/contact-detection.ts:21, 34, 75`, `PHONE_MIN_DIGITS = 8`) signale un
  téléphone dès 8 chiffres consécutifs. Identifiant 100 % numérique ((10/16)^8 ≈ 2,3 % par run) : les
  trois marques reçoivent l'alerte `direct_contact` ; L2C-16 (`backoffice-queue.spec.ts:82`, « strict
  mode violation », 3 éléments au lieu d'1) et L2C-17 (`:422`, « Aucune alerte sur cette entrée. »
  introuvable) échouent. Run 43426274803 (`e886b37`, éclat 1/3), vert à la relance ; troisième
  occurrence du couple de DS-flaky (`21` §8 : L2E, run 42318390996, L2ET-6 ; clôture de L2F).
  Vérifié : `detectDirectContact("Maison e2e12345678q1A")` rend `['phone']`. Correctif : une lettre au
  milieu de l'identifiant (`id.slice(0, 4) + "x" + id.slice(4, 8)`), aucun nom à 8 chiffres
  consécutifs ; sa spec seule à relancer, aucun plancher e2e touché. Cause et run portés à la ligne
  DS-flaky de `21` §8 par la ligne C (`cloture.md` point 3).
- **L3AT-2 — L3A-T5 absent de tout titre (→ fix-2).** `apps/api/db-tests/t8-privacy-execution.test.ts:1392` :
  le `describe` s'intitule « the allowlist of audit codes in the export (F3, 0302, …) ». Correctif :
  préfixer par « L3A-T5 » ; planchers inchangés.
- **L3AT-3 — essai à blanc des éclats non consigné (→ ligne C, sans fix).** `run.md` ligne 04 ne cite
  que les durées ; `04.md` et le critère de fin exigent la sortie citée. Sortie de la revue : un
  rapport sans `db-tests/t16-commission.test.ts` fait échouer le contrôle sur « shard 2:
  db-tests/t16-commission.test.ts is assigned to it but did not run » et « declared in the floor file,
  but absent from the report » ; le cas complet passe : « every database test file ran in exactly one
  of 2 shards (105 files); floor of executed database cases met » (`check-db-shards.ts:122`).
  Fusionné dans C, le plus simple : C coche déjà la case avec sa preuve (`cloture.md` point 2).

### Avant production et plus tard
| Id | Gravité | Où | Correctif | Échéance |
|---|---|---|---|---|
| L3AS-7 | avant prod. | `l3a/f3.md:7-8` ; `0302:654-658` | `f3.md` déclare dues `queue.entry_opened`, `queue.*_read`, `verification.evidence_viewed`, mais `activity_log` (acteur, sujet `account`, demandes du membre) ne sert aucun sujet `queue_entry` ni `verification_request` du membre : élargir le périmètre (filtre en place) ou corriger `f3.md` et la notice (0,5 j) | Lot 6, `expert-conformite-rgpd` |
| L3AS-1 | plus tard | `profiles-creator-identity.test.ts:204-245` | T1-R aveugle aux lectures indirectes (plpgsql, SQL non atomique lisant une vue ou une fonction branchée sur `profiles.creator_%`, sans `pg_depend`) et au déclencheur SECURITY DEFINER d'une table que l'annonceur écrit (L2GS-6) : fermeture récursive des noms qualifiés, suivi des déclencheurs (0,5 j) | avant L3E |
| L3AS-2 | plus tard | idem l. 64-66, 266 | une exception porte sur l'objet, toutes branches confondues : constat sur le couple (objet, relation créateur atteinte), aucune exception sur la couche I (0,25 j) | avant la première exception (L3E) |
| L3AS-3 | plus tard | `0301:375-379` ; `profiles-creator-identity.test.ts:448` | garde L2DS-5 limitée au mot `execute` : `query_to_xml`, `cursor_to_xml`, `table_to_xml`, `ts_stat`, `ts_rewrite`, `dblink*` dans l'expression, l'assertion de migration et le test (0,1 j) | prochaine migration touchant `influx_identity_definer` |
| L3AS-4 | plus tard | `0301:108-113` | `accounts.status` lu sans verrou, suspension absente de la base : la porte de suspension verrouille ou dépublie `creator_public_profiles` dans sa transaction ; filtre de L3E en seconde barrière (0,1 j) ; recoupe L3AT-8 | Lot 5 (porte de suspension) |
| L3AS-5 | plus tard | `0301:50-52` ; `0210:395-418` | index sur une fonction IMMUTABLE (`lower()`, classes d'expression régulière), périmé sans bruit par une redéfinition ou une collation : commentaire de fonction, test épinglant `md5(prosrc)`, `REINDEX` dans la même migration (0,1 j) | toute redéfinition de `normalized_brand_name` |
| L3AS-6 | plus tard | `04` l. 597-605 ; `t8-privacy-execution.test.ts:1441` | codes prévus aux Lots 3 à 5 (`block.*`, `introduction.reviewed`…) sans `export_class` dans `04` ; L3A-T5 épingle le nombre (130), non les noms : colonne selon `f3.md`, liste nominative (0,25 j) ; recoupe L3AT-6 | avant `0303` |
| L3AT-4 | plus tard | `profiles-brand-decision.test.ts` (≈ l. 1713) | branches d'`advertiser_duplicate_candidates()` rejouées en SQL recopié, dérive du corps non vue : `prosrc` contient `normalized_brand_name(p.legal_name)` et `lower(p.website_domain)` | plus tard |
| L3AT-5 | plus tard | `profiles-creator-identity.test.ts` (`advertiserFindings`) | T1-R aveugle : chaîne vers un assistant non nommé `creator_*`, référence non qualifiée sous `search_path = profiles`, SQL dynamique hors `influx_identity_definer` : toute fonction SECURITY DEFINER accessible à `influx_advertiser` a `search_path = ''` ; recoupe L3AS-1 | avant L3E (avec L3AS-1) |
| L3AT-6 | plus tard | `t8-privacy-execution.test.ts:1441` | `exported = 130` figé (le premier code du Lot 3 le casse) : `>= 130` et liste d'exclusions exacte ; `excluded_third_party` jamais exercée : témoin par `update` d'un code en transaction annulée | avant `0303` (avec L3AS-6) |
| L3AT-7 | plus tard | `check-db-shards.ts` ; `run-tests.ts` (`--shard`) | sans test : fixtures de rapports ; structure CI de `db` et `db-merge` (matrice = clés de `DB_SHARDS`, `needs: [db]`, sans `supabase`) comme `ci-production-job.test.ts` pour l'e2e | plus tard |
| L3AT-8 | plus tard | `0301` l. 115 | `publish_creator_review_entry()` lit `identity.accounts.status` sans verrou, suspension concurrente non couverte : `for share` ou accepter et documenter ; = L3AS-4 | Lot 5 (avec L3AS-4) |
| L3AT-9 | plus tard | `ci.yml:266` | `retention-days: 1` : `db-merge` relancé seul après 24 h échoue (« no readable report ») ; relancer les éclats | plus tard |

Échéances de L3AT-5, 6, 8 alignées sur le constat S qu'ils recoupent. Report au reliquat de `21` §8 :
`cloture.md` point 3.
