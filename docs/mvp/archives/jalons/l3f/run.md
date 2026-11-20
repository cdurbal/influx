# Exécution du jalon L3F
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | medium | testeur | fait | sums 380.7/380.8 s, gap 0.1 s (local, 129 files); shard 1 rerun once (DS-flaky timeout); CI shard times: at first push |
| A | A.md | arbitrage | opus | xhigh | architecte | fait | one owner; origin campaign out of draft, rejected; opening origin derived; visuals relayed, no URL; region on profile; queue 9 at L3F; CA45, CA46 in AL21 |
| 02 | 02.md | commit | opus | high | expert-database | fait | origin admitted by search.is_admitted_campaign() only (pending_review..closed); draft, rejected = unknown P0002; owner reads status |
| 03 | 03.md | commit | opus | xhigh | expert-database | fait | open_creator_profile: alias in engine else one P0002; card+region; opening journaled, origin opened once; 60/day; visual key read, never served |
| 04 | 04.md | commit | opus | high | expert-database | fait | 8 doors by alias; add needs engine + already served, else one P0002; other list P0002 shortlist; masked untraced; 54000 bounds; no outbox/matching |
| 05 | 05.md | commit | opus | high | expert-database | fait | request_team_selection: switch ignored, 5/day, filters+admitted campaign+language; queue 9 deadline; no matching/outbox; export, erasure |
| 06 | 06.md | commit | opus | high | expert-database | fait | CA45, CA46, openings: causes of AL21, thresholds added in table; admin reads account, cause, count, date only; owner reads, writes nothing |
| 07 | 07.md | commit | opus | high | dev-react-node | fait | profile = card via searchCardProjectionOf + region; visual JSON relay, no URL; 404 one body (CA49); 429 after COMMIT; address 60, 240/min; T7 13+4+4 |
| 08 | 08.md | commit | sonnet | high | dev-react-node | fait | shortlists + request routes over 0324, 0325; door refusals 404/400/409, 429 after COMMIT; reads 60, request 10/min per address; T8 16+9; no export route |
| 09 | 09.md | commit | sonnet | high | testeur | fait | T1 +6, T9 +2: visual cards, no URL, Storage read for approved only, 08 routes swept; no marker out; t1 about +25 s local |
| 10 | 10.md | commit | sonnet | high | dev-react-node | fait | M4 at /createurs: 7 facets, address = query, pages kept, widenings from WIDENING_ORDER; card shared (CreatorCardView); E1 4 cases, median of 3: 6.5 s |
| 11 | 11.md | commit | sonnet | high | dev-react-node | fait | profile = card + 3 visuals + region code; panel, lists, request (delay, no promise); list= in address; E2 3 cases 11.1 s, E1+E2 20.9 s (medians of 3) |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 22 constats : 0 bloquant, 5 jalon → fix-1, 9 avant production, 8 plus tard |
| fix-1 | fix-1.md | fix | sonnet | high | dev-react-node | fait | L3FU-1 to 5: one grid, one copy of each control, CSS only; focus to count band/results head; E1 4, E2 3, floors kept; budgets unmeasurable under load |
| F | recette.md | fondateur | — | — | fondateur | fait | « recette terminée, rien à signaler » ; interrupteur refermé (SQL, seq 3107) ; point 5 non confirmé ; données gardées |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | testeur 0/0/1 avant prod/2 plus tard ; sécurité 0/0/3 avant prod/5 plus tard ; attestation I-4 : 5 SHA des lignes 02 à 06, annexe § Revue |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | `pnpm check` + `test:e2e` verts (291) ; `staging` 0322-0326, interrupteur faux ; CI 44746519403 ; 21 §8, 18 §10 amendés ; attestation I-4 |

## Mesures de clôture
Mesures du run CI 44746519403 (sur `d3940fb`, verte, « Migrate staging » vert ; le run 44771720093 de `9cb8f46`, documentation seule, ne rejoue que les contrôles légers) :
- Éclats base : 6:34 et 5:34 (job entier, pile et reconstruction comprises) + fusion 14 s ; limite 8:00 tenue ; **au-dessus du seuil de 4:30** de L3E (EC-L3F-3 : inatteignable, ≈ 2 min de pile par éclat) ; sommes locales égalisées à 0,1 s près (ligne 01).
- Éclats e2e : 3:56, 4:14, 3:10 (fusion 20 s). Job statique : 3:57.
- Lecture SQL de `staging` (D70, lecture seule, 2026-11-20) : migrations `0322` à `0326` appliquées (dernière `0326`) ; `search.search_settings` `is_open_to_advertisers` = faux (mis à jour le 2026-11-20 à 16:07 UTC, refermeture de la ligne F).
- Passage local de clôture (2026-11-20, sur `e147d16`, seule de la documentation a changé depuis `d3940fb`) : `pnpm check` vert (typecheck, lint, unitaires, build, artefacts ; suite base 138 fichiers) ; première passe : 12 fichiers base rouges (`fetch failed`, Kong local mort après environ 3 h, `UND_ERR_SOCKET`), vert (168 cas) après `docker restart supabase_kong_influx`, sans changement de code ; `pnpm test:e2e` 291 cas verts (6,1 min, plancher e2e tenu).
- L3F-E1 et L3F-E2 par spec, local sous pleine charge parallèle : 8,1 s (≤ 12 s) et 9,1 s (≤ 13 s) ; budget e2e du jalon (≤ 25 s) : 17,2 s mesurées au cumul, tenu.
- Temps ajouté à la base par le jalon : éclats CI 6:34 et 5:34 contre 4:47 et 4:35 à la clôture de L3E (+ 1:47 et + 0:59) ; dans la fourchette annoncée (+ 90 à 120 s) ; job base ≤ 8 min tenu.
Fondateur : seuils d'AL21, de CA45 et de CA46 à fixer avant production (L3F-AL21, `21` §8).
