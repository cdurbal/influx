# Exécution du jalon RUA
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| F0 | F0.md | fondateur | — | — | fondateur | fait | « oui partout » (2026-11-25) : Q1 à Q6 ; code de RUA seul autorisé ; RU-02 : part du fondateur, juriste (D34) à venir |
| A | A.md | arbitrage | opus | xhigh | expert-ux | fait | modele-ux.md 10 188 o : R03 §3 couvert, -bo- triés, aucune couleur nouvelle (D6) ; EC-RUA-A-1 : ligne de secours (21) opaque |
| B | B.md | arbitrage | opus | xhigh | architecte | fait | modele-archi.md 10 216 o : G3i base + percent exact (4 effect-photo), projet visual sous E2E_VISUAL (local seul), planche pageExtensions à double verrou |
| 00 | 00.md | commit | sonnet | high | expert-ux | fait | 20 §11, 02 §21, 18 §12.8, D88 écrits ; RU-01, 03-13, 15-20 tranchées ; RU-02 juriste ouverte ; RU-20 : 17b §1.7 à RUC-08 ; 06b §7 : 4 écarts |
| 01 | 01.md | commit | sonnet | high | dev-react-node | fait | G3i : base+percent exacts, withMixOver, PHOTO_EFFECT_READERS vide ; EC-RUA-01-1 : marqueur « hero » de G8 vs text-title-hero (RUB) ; e2e local KO (pas de Supabase) |
| 02 | 02.md | commit | sonnet | high | dev-react-node | fait | form 640, bo-wide avant bo-small, garde dédupliquée ; 9 animate-*, spin = keyframes turn (doublon Tailwind), skeleton none ; e2e T5 non lancé (pas de Supabase) |
| 03 | 03.md | commit | opus | high | testeur | fait | maquette c. elle-même : 0 écart N1-N3 sur 588 captures (local, sans pile) ; projet visual sous E2E_VISUAL seul ; couples vides ; RU-19 refusé ; aucune image |
| 04 | 04.md | commit | sonnet | high | testeur | fait | 147 états = 134 créables + 13 NON_RECETTABLE (5 entrées) ; chargeurs sans SQL ni route propres ; e-mails example.test ; e2e T7 écrit, non lancé (pas de Supabase) |
| 05 | 05.md | commit | sonnet | high | dev-react-node | fait | board = page.board.tsx sous pageExtensions (dev+flag), G8+artefact verts, axe 0 en local ; EC-RUA-05-1 : ci.yml e2e build pose le drapeau ; e2e non lancé |
| 06 | 06.md | commit | sonnet | high | expert-ux | fait | 21 questions en 8 familles, aucun composant ni couleur nouvelle ; C17 sans ton erreur (warning), U46 et C08 « Effacer » en écarts ; BO sans rendu à 375 |
| F1 | F1.md | fondateur | — | — | fondateur | fait | « oui à toutes les questions » (2026-11-25) : les 8 familles de la planche, RU-27 tranchée |
| 07 | 07.md | commit | sonnet | medium | expert-ux | fait | SKILL.md 10 064 o, references/tokens-lot3bis.md ; RU-27 tranchée (06a, D88, 06b §7 : 4 écarts) par F1 « oui à toutes les questions » ; aucune famille ouverte |
| U | ux.md | ux | sonnet | high | expert-ux | fait | 0 bloquant ; J1 (axe de la planche à 375 px) → fix-1 ; AP1-5, PT1-7 au reliquat ; sans preuve rendue (pas de navigateur) |
| fix-1 | fix-1.md | fix | sonnet | high | testeur | fait | J1 : axe + scrollWidth de la planche à 375 et 1 440, un seul cas (plancher 1) ; focus facultatif non fait ; e2e non lancé (pas de Supabase) |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | fait | 0 bloquant, 2 jalon (RUAS-1 → fix-2, RUAT-1 → fix-3), 1 avant production, 10 plus tard ; 596c18c revu sain ; annexe § Revue |
| fix-2 | fix-2.md | fix | sonnet | high | integrateur | fait | RUAS-1 : 5d7b6df, commit vide, security-reviewed: 2026-11-25 covers 596c18c ; check-security-review 1 puis 0 ; `valider` du fondateur (2026-11-25) |
| fix-3 | fix-3.md | fix | sonnet | high | testeur | fait | RUAT-1 : recette-loaders.spec.ts sans role admin (défaut agent) ; commentaire J8T-8 ; check:fast vert ; e2e non lancé (pas de Supabase), la CI rejoue |
| C | cloture.md | cloture | sonnet | medium | testeur | fait | 12 cases cochées avec preuve ; base et e2e non rejoués en local (pas de Supabase), preuve = CI 45696366452 ; archivé ; RU-02 ouverte |

## Mesures de clôture
- Local (2026-11-25, sans Supabase) : `pnpm check` : format, typecheck, lint, tests unitaires verts (contracts 190, domain 217, test-kit 273, backoffice 458, web 859, api unitaires 2 012) ; la suite base échoue (ECONNREFUSED 54322, pas de Supabase local). `pnpm build` puis `pnpm -r run test:artifacts` verts (planche absente de la construction de production, RUA-T8). `pnpm test:e2e` non lancé (pile indisponible) : la preuve est la CI.
- CI : `5e204fc` run 45696366452 vert ; `b3d20e2` run 45691224419 vert. Éclats e2e 4 min 32 à 4 min 55 (budget 7 min 30). Projet `visual` : absent de la CI par construction (B §5, `E2E_VISUAL` local seul) ; temps ajouté 0 s.
- Budgets e2e (revue `testeur`, CI) : T5 0,37 s (≤ 2 s), T7 2,1 s (≤ 5 s), T8 0,96 s (≤ 4 s) ; total ≈ 3,4 s pour 20 s.
- Outil complet (147 états, maquette contre elle-même) : 111/111 en 9 min 48 s en local, 588 captures, 0 écart, 3 écarts volontaires vus (mesuré par la revue `testeur`, non rejoué en clôture, pas de pile).
- Écarts mineurs (EC) remontés : EC-RUA-A-1 ; EC-RUA-00-1, -2 ; EC-RUA-01-1, -2 ; EC-RUA-02-1 ; EC-RUA-03-1 à -3 ; EC-RUA-04-1 à -4 ; EC-RUA-05-1 (`ci.yml`, attesté) ; EC-RUA-06-1 à -5.
