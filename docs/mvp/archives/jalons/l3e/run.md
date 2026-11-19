# Exécution du jalon L3E
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | opus | high | expert-database | fait | 0315 index partiel, 1 ligne rate_limited par fenêtre ; attendus L3D-T2 CA18 et T5 T15.5 changés (EC-L3E-01-1), fondateur OK 2026-11-19 |
| 02 | 02.md | commit | opus | high | testeur | fait | T1-R : fermeture pg_depend + noms qualifiés, déclencheurs definer, exceptions par couple (vides, couche I refusée), search_path '' ; L3E-T2 +5 |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | modele.md : creator_layer_a() source unique, NEVER_EXCEPTED = couche I (E5, E6 en couples), palier 5 neutre, région au L3F, page = recherche, AL21 en 0321 |
| 03 | 03.md | commit | opus | high | expert-database | fait | 0316 : aucun droit membre (politique restrictive), écrivains admin seuls + settings_changed, F12 fermée, recherche fermée ; L3E-T3 16 |
| 04 | 04.md | commit | opus | high | expert-database | fait | 0317 : aucun droit membre/agent/admin, feed_definer lit paire+lifted_at des blocages actifs ; visible_campaigns exclut la paire, 2 sens ; L3E-T4 10 |
| 05 | 05.md | commit | opus | high | expert-database | fait | 0318 : export recherches, sélections (alias), blocages posés seuls, jamais subis ni impression ; effacement supprime journal et blocages de la paire ; L3E-T5 6 |
| 06 | 06.md | commit | opus | xhigh | expert-database | fait | 0319 : porte marque seule, E1-E6 en SQL avant compte, k identique 0/4, tranche, seau 30/h 200/j ; couche A unique ; T1-R 10 couples ; L3E-T2, T3, T9 L2G changés |
| 07 | 07.md | commit | opus | high | expert-database | fait | 0320 : creator_order() invoker, paliers en ORDER BY sans score, quota froid page 1 jamais fabriqué, raisons codes/tranches (F6 50_80) ; L3E-T7 18, T6 suit |
| 08 | 08.md | commit | opus | high | dev-react-node | fait | POST /v1/creator-search marque seule, zod strict, carte = projectionOf() unique, 429/400 après COMMIT, 60/min par adresse ; L3E-T8 13+4+6 |
| 09 | 09.md | commit | sonnet | high | testeur | fait | T1 balaie POST /v1/creator-search (5 servis, témoin onSend), L2DT-5/6, search.* lisible par la marque sans marqueur ; T1 20 à 26 ; aucun marqueur servi |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | 0321 AL21 : seuils en table, fonction definer pour l'admin seul, compte+cause+nombre sans filtre ni profil, état dérivé ; L3E-T10 13 ; I-4 signalé |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | 0 bloquant, 0 jalon ; 6 T (3 avant prod) + 8 S (4 avant prod, L3ES-1 prioritaire) ; détail annexe § Revue ; attestation I-4 accordée |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | critère de fin coché avec preuves ; staging 0315-0321 lu, interrupteur faux ; amendements 03, 04, 10, 18, 21 ; éclats base > 4:30 (L3E-DB) ; attestation I-4 |

## Mesures de clôture
Mesures du run CI 44595411008 (sur `5c98bb8`, verte, « Migrate staging » vert) :
- Éclats base : 4:47 et 4:35 + fusion 14 s (limite 8:00) ; **au-dessus du seuil de 4:30 de la fiche** : rééquilibrage de `apps/api/db-tests/shards.ts` au reliquat (L3E-DB, `21` §8).
- Éclats e2e : 3:25, 3:40, 4:01 (fusion 28 s). Job statique : 3:10. Aucun e2e ajouté par le jalon.
Lecture SQL de `staging` (D70, lecture seule, 2026-11-19) : migrations `0315` à `0321` appliquées ; `search.search_settings.is_open_to_advertisers` = faux.
Passage local de clôture (2026-11-19, sur `cc2350d`, seule de la documentation a changé depuis) : `pnpm check` vert (EXIT 0, ~19 min) ; `pnpm test:e2e` 284 cas verts (5,6 min, plancher e2e tenu). Suite base locale complète non rejouée (couverte par les éclats CI) ; temps ajouté à la base par le jalon : non mesuré isolément, éclats CI 4:47 et 4:35 contre 4:04 et 3:59 à la clôture de L3D (≈ + 40 à 45 s).
Fondateur : EC-L3E-01-1 accepté le 2026-11-19.
