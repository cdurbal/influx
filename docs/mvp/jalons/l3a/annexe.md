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
- [ ] `design-system-influx` et `backoffice-ops` : `SKILL.md` ≤ 10 Ko, références ≤ 16 Ko — `wc -c`.
- [ ] Chaque éclat base ≤ 7 min 30, éclat le plus long + contrôle ≤ 8 min — identifiant du run et
      durées des jobs dans `run.md`.
- [ ] Essai à blanc : un fichier retiré de la répartition fait échouer le contrôle — sortie citée.
- [ ] `0301` et `0302` sur `staging` — job « Migrate staging » vert, identifiant du run.
- [ ] Reliquat soldé dans `21` §8 : L2D-E2E, L2CS-6, L2GS-8 (volet publication ; volet recherche
      repris par L3E), L2DS-3, L2DS-5, F3, L2GT-9 — SHA par ligne.
- [ ] `pnpm check` puis `pnpm test:e2e` verts — sorties à la ligne C.
- [ ] Revue groupée soldée et attestée (`security-reviewed:`).

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
