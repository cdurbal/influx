# L2D-U — Constats `expert-ux` sur C2 et C4
Grille `expert-ux`. Skill : `design-system-influx`. Aucune modification de code.
**Lire :** fiche § Invariants 14, 15 ; `17` l. 1281-1384, 1462-1467 ; `20` §11 par tranches ; captures 375, 768, 1440, FR et EN (`pnpm --filter @influx/web exec playwright test e2e/creator-profile.spec.ts`, `test-results/`).
**Livrer :** `jalons/l2d/ux-constats.md`, `L2DU-n`, gravité (bloquant · à corriger dans le jalon · avant production · plus tard), écran, correctif en une phrase :
- l'alias compris avant la saisie, en 10 secondes ;
- les trois métriques lues en premier, dans l'ordre ;
- le lecteur sait ce que voit une marque sur chaque champ ;
- `Confirmer mes chiffres` compris, sans culpabiliser ;
- C2 tient à 375 sans saut, largeur de saisie, cible tactile ;
- contraste, focus, vert jamais seul.
**Ne pas toucher :** tout le reste.
**Prouver :** une capture par constat bloquant.
**Arrêt si :** un constat bloquant : `/jalon-run` ouvre la ligne 16 (`fix(web): creator profile, ux findings`).
