# Exécution du jalon L2F

| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | testeur | fait | L2D-E2E (levier nommé par le fondateur le 2026-11-08) ; 9 cas répartis en 3 fichiers (4 + 2 + 3), planchers 9 → 4 + 2 + 3 ; amorce par l API (`sendAudienceRequest`) dans le cas agent audience, au lieu du dépôt à l écran ; expects 262 → 261 (retiré : `[data-piece]` du dépôt amorcé ; gardé : texte « envoyée ») ; sommes des médianes (3 passages, 1 worker) 35,1 s avant → 33,8 s après (gain 1,3 s, sous les 10 s visés) ; 2 workers : 40,6 s (contention) ; mur du groupe 60 s → 53 s ; objectif ≥ 10 s non atteint, cas déjà courts (2 à 8 s), reste du temps = démarrage des serveurs |
| 02 | 02.md | commit | opus | high | expert-database | fait | I-4. L2ES-2 soldé (`0228`) : les deux octrois comparent constaté et déclaré par `verification.normalize_handle()` (IMMUTABLE, sans EXECUTE, reprise en ligne 08) ; différent ou déclaré nul : 22023 `observed_handle_mismatch`, rien d'écrit ; signatures et droits inchangés ; L2F-D19 (2 cas, plancher 18 → 20) ; amorces adaptées, attendus inchangés : L2E-D18 (ligne A déclare le handle partagé puis en change), `verification-privacy` (ligne déclarée `TAG_SEEN`, constaté `tag_seen`), T1 (constaté `@pseudo_t1_…`, forme brute jamais servie) ; API : `observed_handle_mismatch` absent de `BODY_FIELD_OF` de `verification-queues/refusals.ts` (répond 500), à mapper vers `observedHandle` en ligne 13 (02.md ; sinon 14, qui lit ces routes) ; décompte `staging` non fait (aucune URL de base dans cet arbre) |
| 03 | 03.md | commit | opus | high | expert-database | à faire | I-4. L2E-US, L2ES-3, EC-L2C-fix-2-2 (élargissement validé par le fondateur le 2026-11-08) |
| D83 | d83.md | fondateur | — | — | — | fait | Tranchée le 2026-11-08 à la validation de la fiche : A + A-bis, Q3 a posteriori, Q4 oui |
| 04 | 04.md | arbitrage | opus | xhigh | architecte | à faire | `l2f/modele.md`, EC-L2F-1 à 16 |
| 05 | 05.md | commit | opus | high | expert-database | à faire | I-4. TM5.3 |
| 06 | 06.md | commit | opus | high | expert-database | à faire | I-4. TM5.4 ; PLT-5, PLS-5, PLS-6 |
| 07 | 07.md | commit | opus | high | expert-database | à faire | I-4. File 5 |
| 08 | 08.md | commit | opus | high | expert-database | à faire | I-4. File 6 |
| 09 | 09.md | commit | opus | high | expert-database | à faire | I-4. D83 A + A-bis |
| 10 | 10.md | commit | opus | high | expert-database | à faire | I-4 |
| 11 | 11.md | commit | sonnet | high | dev-react-node | à faire | |
| 12 | 12.md | commit | sonnet | high | expert-integrations-api | à faire | |
| 13 | 13.md | commit | sonnet | high | dev-react-node | à faire | |
| 14 | 14.md | commit | sonnet | high | dev-react-node | à faire | |
| 15 | 15.md | commit | sonnet | high | dev-react-node | à faire | D83 A + A-bis |
| 16 | 16.md | commit | opus | high | testeur | à faire | TM5.3, TM5.4, T9.6 ×3 |
| 17 | 17.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 6 s |
| 18 | 18.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 5 s |
| 19 | 19.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 5 s |
| 20 | 20.md | commit | sonnet | high | dev-react-node | à faire | D83 A + A-bis ; e2e ≤ 2 s |
| 21 | 21.md | commit | sonnet | high | dev-react-node | à faire | e2e ≤ 1 s |
| U | ux.md | ux | sonnet | high | expert-ux | à faire | |
| F | recette.md | fondateur | — | — | — | à faire | Recette réduite sur `staging` : retrait sous 2V, D83 (décision du 2026-11-08) |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | testeur | à faire | |
