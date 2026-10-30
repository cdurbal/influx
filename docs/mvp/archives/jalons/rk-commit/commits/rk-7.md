# RK-7 — `fix(ui): no focus ring on titles and main focused by the app`

Grille `dev-react-node`.

**Lire :** fiche, RK-13, RK-C, arbitrage « Anneau retiré » ; `20` §11.8 (règle du focus). Code : les
deux `src/app/globals.css`.

**Livrer :** dans les deux `globals.css`, et nulle part ailleurs :
`:where(h1, h2, h3, h4, main)[tabindex="-1"]:focus-visible { outline: none; }`. Jamais un
`[tabindex="-1"]` générique (le tabindex itinérant des onglets de canaux garde son anneau). Le titre
reçoit toujours le focus après navigation (TD5.5) : ne touche à aucune gestion du focus.

**Prouver :** TK5.1 (clic, `Entrée`, lien d'évitement ; membres et BO) libéré et vert ; TK5.2 et TD5.4
verts sans relâchement ; axe vert ; `pnpm test:e2e`.
