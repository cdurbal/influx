# L2G-fix-1 — `fix(web): creator profile layout and publication card`
Grille `dev-react-node`. Skill : `design-system-influx`. L2GU-1, 2, 3, 7, 8, 16 (validés par le fondateur le 2026-11-12).
**Lire :** `l2g/ux-constats.md` l. 36-50, 66-74, 113-116 (font foi) ; fiche invariant 17 ; `17` l. 1308-1317, 1392 ; `CreatorProfileScreen.tsx` l. 240-310, 415-475 ; `CreatorPublicationCard.tsx` ; `creator-profile-view.ts` (`refusalViewOf`) ; `e2e/creator-portfolio.spec.ts` l. 150-170.
**Livrer :**
- L2GU-1 : DOM dans l'ordre complétude compacte → sommaire → formulaire → carte d'action ; la colonne de droite par `lg:order-*` / `col-start` ; sur mobile, seul l'avis de refus reste en tête.
- L2GU-2 : `PublicationCard` séparée en « avis » (refus, attente, révisions : bandeau pleine largeur sous le titre) et « action » (état, bouton, manquants : seule dans la colonne collante).
- L2GU-3 : `Notice info` en tête du formulaire en `pending_review` et en `suspended` (textes de `ux-constats.md` l. 50, FR et EN).
- L2GU-7 : clé `status.revisionKept`, paragraphe après le message ; `{reason}` seul dans la première phrase.
- L2GU-16 : ligne d'aide sous « Publier mon profil » (« Un commercial INFLUX relit votre profil avant de le publier. » / EN) ; ligne sous la case RG83 (`07` l. 780-782).
- L2GU-8 : le passage axe `wcag22` de la spec déplacé sur l'état EN le plus chargé (refus ou publié, interrupteur) ; toute violation AA corrigée ici.
- Clés neuves à la relecture de `21` §5.8 (L2GU-11).
**Ne pas toucher :** API, contrats, base, `tokens.css` (jetons existants seuls), backoffice, bloc 6 (fix-2).
**Prouver :** unitaires de vue (ordre des sections, avis gelé, `revisionKept`), planchers tenus ; `pnpm --filter @influx/web exec playwright test creator-portfolio.spec.ts creator-profile.spec.ts member-shell.spec.ts --reporter=line`, axe EN vert, ≤ + 0,3 s ; `pnpm check:fast`.
**Arrêt si :** une violation axe exige un jeton ou une couleur neuve ; un éclat CI dépasse 7 min 30 (F0).
