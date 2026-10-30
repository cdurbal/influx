# RK-3 — `test(guards): built CSS reads every KEO token through var()`

Grille `testeur`. Aucun code de production.

**Lire :** fiche, TK7.1 (b) ; `18` §5.1 (G3i) ; code : `packages/test-kit/src/guards.ts`, la garde
G3i (a) livrée à RK-2, l'auto-test négatif posé à RK-1, et la façon dont les gardes existantes lisent
les feuilles construites (cherche « .next/static » ou « build » dans `packages/test-kit` et `apps/*/tests`).

**Livrer :** G3i (b), une spec par front, sur les feuilles réellement servies par la construction de
production : pour chaque token redéfini dans le bloc KEO, tout utilitaire qui le consomme lit
`var(--nom)`, jamais la valeur vitrine inscrite en dur. Analyse tolérante au CSS minifié et aux fins de
ligne CRLF (Windows). Un token redéfini sous KEO sans aucun consommateur = échec, sauf entrée de liste
justifiée (commentaire d'une ligne par entrée).

**Prouver :** l'auto-test de RK-1 (`.shadow-action-glow{--tw-shadow:none}`) passe de `fails` à négatif
vérifié ; la garde est verte sur la construction actuelle ; planchers relevés ; palier « code sans
base » plus `pnpm build`.
