# L2D-fix-1 — `ci(e2e): Playwright browser cached on main, shards within their budget`
Grille `integrateur`. **I-4** (`.github/workflows/`). L2DT-2 : fiche § Revue ; `l2d/revue-constats-testeur.md` l. 12 ; note 01 de `run.md`.
**Lire :** `ci.yml` l. 10-17 (« no cache, on purpose »), 241-300, 331 ; `apps/web/package.json` l. 29 (Playwright 1.64.0) ; journal de l'étape « Install the Chromium of Playwright » des runs 42243018278 et 42228919569 (`gh run view --log`) : part du téléchargement, part d'`apt` (`--with-deps`).
**Livrer :**
- Téléchargement lent : `actions/cache` épinglé par sha complet (comme les autres actions) sur `~/.cache/ms-playwright`, clé = OS + version de Playwright ; navigateur installé sur cache manquant seulement. `apt` lent : `--with-deps` retiré si la coquille sans tête démarre sans (run vert), sinon `install-deps` seul.
- Cache restauré et écrit sur `push` de `main` seulement ; `production` et les PR téléchargent comme aujourd'hui (aucune surface d'empoisonnement là où les vetos bloquent, D71) ; en-tête l. 16-17 réécrit avec cette raison.
- `timeout-minutes` sur l'étape d'installation : une installation figée échoue vite et se rejoue (`gh run rerun --failed`).
**Ne pas toucher :** éclats, filtres, contrôle des marqueurs, permissions, secrets, autres jobs.
**Prouver :** `pnpm check:fast` ; push, run de ce commit (cache froid) : durée de job de chaque éclat et de l'étape d'installation, cache écrit (journal), id noté. Cache chaud : run de `fix-2`. Aucun marqueur `security-reviewed:` : relu en clôture (`cloture.md` point 7).
**Arrêt si :** le cache exige une permission ou un secret nouveau ; la mesure ne sépare pas téléchargement et `apt` (la dire, ne rien changer).
