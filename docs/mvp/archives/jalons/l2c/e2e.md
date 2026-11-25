# L2C-14 — Éclats e2e (`architecte`, sur recommandation `testeur`)
2026-11-04 · borne de 8 min (`21` §2.3) inchangée (réponse 2).

**Mesures**, job « Browser journeys » (pas Playwright), s : 423 (241) run 41902520733 · 476 (280)
41856654250 · 440 (254) 41845063830 · 420 (234) 41730172589 · 481 (249) 41701996682 ; job vert d'un
passage rouge : 483 (282) 41898055764. Moyenne 448, dispersion 61, marge +60 à −3 ; pas : 282 s pour
un garde-fou de 300. Avant Playwright 179 à 230 ; pile par éclat : attente 0 à 8 (cachée par le build),
base et graines 41 à 44.

**Piège** (`--list`) : `--shard=1/2` seul donne 228/0 cas (`chromium`, dépendance de
`charter-headings`, n'est jamais partagé). Il faut `--project=chromium`.

**Testeur** : cas des éclats, durées par fichier de 41902520733 / 41898055764 : 1/2 = 131 cas,
283/338 s (`backoffice.spec.ts`, en série : 115/137) ; 2/2 = 94 cas, 152/179. Recommande 2 éclats,
TK3.1 et plancher des cas sur l'ensemble réuni, attendus inchangés.

| Option | Plus lent (estimé, s) | Machine par passage | Verdict |
|---|---|---|---|
| Aucun éclat | 423/483 mesuré | 1 026 à 1 224 s | borne franchie |
| 2 éclats + fusion | 342/390 | +240 à 270 s (+22 %) | **retenu** |
| 3 éclats + fusion | 313/356 | +460 à 500 s | +30 s, plancher série |

**Architecte** : 2 éclats `--project=chromium --shard=n/2`, pile, build et graines propres à chaque
éclat ; fusion sans pile (≈ 50 s, estimé) : TK3.1 `--no-deps` sur les relevés réunis, `merge-reports`,
plancher des 228 cas ; `migrate-*` l'attendent. Gain réel 81 à 93 s ; borne par éclat. Réversible en
un commit ; 3 éclats si un éclat passe 7 min 30.
