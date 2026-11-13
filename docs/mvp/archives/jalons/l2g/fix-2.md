# L2G-fix-2 — `fix(web): safer portfolio gestures`
Grille `dev-react-node`. Skill : `design-system-influx`. L2GU-4, 5, 6, 17, 18, 19 (validés par le fondateur le 2026-11-12).
**Lire :** `l2g/ux-constats.md` l. 52-64, 118-129 (font foi) ; `PortfolioItemCard.tsx` ; `CreatorPortfolioBlock.tsx` l. 150-195 ; `CreatorTrustBlock.tsx` l. 60-90 ; bloc 3 pour le geste de retrait (`networks.removeConfirm`) ; `creator-portfolio-view.ts` ; `e2e/creator-portfolio.spec.ts`.
**Livrer :**
- L2GU-4 : retrait en deux temps comme le bloc 3 (« Retirer ? » + « Garder ») ; clés `portfolio.removeConfirm` / `removeKeep` FR et EN.
- L2GU-5 : quand la légende ou la case RG83 a changé, « Modification non enregistrée » écrit sous le champ et bouton rendu primaire ; notice « Légende en cours de validation » gardée.
- L2GU-6 : interrupteur de visibilité en `aria-disabled` pendant l'enregistrement (jamais `disabled`), annonce « Enregistré » dans une région `role="status"` déjà présente.
- L2GU-18 : noms accessibles avec la position (« Retirer le visuel 2 », « Remplacer… », « Enregistrer la légende… », champ et case) ; clés `*Named` FR et EN.
- L2GU-19 : `xl:grid-cols-2` (une colonne en dessous).
- L2GU-17 : `portfolio.errors.quota` → « Réessayez plus tard » / EN.
- Clés neuves ajoutées à la liste de relecture de `21` §5.8.
**Ne pas toucher :** API, contrats, base, `tokens.css`, mise en page de l'écran et carte de publication (fix-1), backoffice.
**Prouver :** unitaires de vue (état « non enregistré », noms par position), planchers tenus ; la spec `creator-portfolio.spec.ts` passe par la confirmation de retrait, ≤ + 0,3 s ; `pnpm check:fast`.
**Arrêt si :** fix-1 n'est pas `fait` (mêmes fichiers e2e) ; un éclat CI dépasse 7 min 30 (F0).
