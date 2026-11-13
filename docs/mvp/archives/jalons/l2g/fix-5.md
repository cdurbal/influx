# L2G-fix-5 — décision du fondateur : durée du job base (L2GT-1)
Type `fondateur` : arrêt jusqu'à la réponse. `l2g/revue-constats-testeur.md` l. 46-50 (fait foi).
**Constat :** job « Database tests » (`ci.yml:180-244`) à 494 s au dernier run CI (436 s à la clôture de L2F), 474 à 481 s en local le 2026-11-12, pour un plafond de 8 min (F0, L2FT-11) : marge de 0 à 8 s, que le Lot 3 consommera.
**Question :** choisir A ou B.
- **A — deux éclats** : le job base coupé en deux, chacun sur sa pile propre (comme les éclats e2e) ; ajoute la ligne `fix-5a` ci-dessous.
- **B — plafond relevé par écrit** : la valeur nouvelle du job base, écrite dans `21` §2.3 à la ligne C (la CI entière garde 10 min, `21` §2.3, `18` A-4).
**Écrire :** la réponse mot pour mot dans la note de la ligne fix-5 de `run.md`.
**Si A, ligne `fix-5a`** (`fix`, sonnet, high, `integrateur`) — `ci(db): database tests in two shards` :
- job `db` en matrice de deux éclats (`fail-fast: false`), étapes de pile inchangées ; fichiers répartis par durée mesurée (les plus lents : revue l. 49) ;
- planchers : un sous-ensemble saute le contrôle (`apps/api/scripts/run-tests.ts` l. 7-9) : rapport JSON par éclat, `check-case-floors.ts` sur leur union, aucun plancher baissé ; en local, `test:db` inchangé ;
- **Prouver :** run CI, durée de chaque éclat et du contrôle ; `pnpm check:fast`. **Arrêt si :** la CI reste bloquée par la facturation (aucune preuve sans run).
