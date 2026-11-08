# L2E-U — Constats `expert-ux` sur C3, dépôt, M2 et décision
Grille `expert-ux`. Skill : `design-system-influx`. Aucune modification de code.
**Lire :** fiche § Invariants 12, 13, 18 ; `17` l. 1396-1470 ; `17b` l. 1177-1236 ; `20` §11 par tranches ; captures 375, 768, 1440, FR et EN (`pnpm --filter @influx/web exec playwright test e2e/verification.spec.ts`, `test-results/`).
**Livrer :** `jalons/l2e/ux-constats.md`, `L2EU-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard), écran, correctif en une phrase :
- le créateur comprend en 10 secondes quoi coller, où, et que l'agent le relit lui-même ;
- il sait quoi cadrer avant de déposer ;
- ce que verra une marque et ce qui reste interne ;
- un badge se lit sans la couleur, date et réseau toujours là ;
- un refus dit quoi faire ;
- l'agent traite une demande sans ouvrir d'onglet inutile, au clavier ;
- 375 sans saut, cible tactile, contraste, focus.
**Ne pas toucher :** tout le reste.
**Prouver :** une capture par constat bloquant.
**Arrêt si :** un constat bloquant : `/jalon-run` ouvre la ligne 24 (`fix(web): verification, ux findings`).
