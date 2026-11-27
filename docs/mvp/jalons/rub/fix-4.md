# RUB-fix-4 — `fix(web): no icon left alone in the save status and the strip notice`
Grille `dev-react-node`. Skill : `design-system-influx`. U-5, U-6 (même défaut : icône seule sur sa ligne).
**Lire :** `rub/ux-constats.md` l. 13-14 (fait foi) ; `R02a` : C17 (l. 119), C25 (l. 179) ; `U/save-status-classes.ts`,
`SaveStatus.tsx`, `U/notice-classes.ts`, `Notice.tsx` ; `e2e/state-board.spec.ts` l. 401-427, 810-840.
**Livrer :**
- U-5 : icône et texte du `SaveStatus` insécables, le texte rétrécissable ; seuls le délai et « Réessayer » passent à la
  ligne ; placements `foot` et `meta` gardés ; `data-save-state` et l'annonce du seul échec intacts.
- U-6 : `strip`, base du corps `basis-(--size-note-min)` : icône et corps sur la même ligne, l'action passe dessous
  quand la place manque. Préférer cette base à un groupe (la spec lit les trois enfants).
**Ne pas toucher :** taille `md`, `noticeClasses` (appelants de l'authentification et du compte), textes, tokens,
`apps/web/e2e/case-floors.ts`.
**Prouver :** assertions ajoutées aux cas existants de `state-board.spec.ts` (RUB-AX des notices, RUB-AN2 06 ; aucun
cas neuf, invariant 16) : à 375, les deux cellules `strip`, et à 1 440 `strip-long`, haut du corps à hauteur de
l'icône ; l'assertion « action dessous à 375 » reste ; `save-status` en échec à 375 et au pied de l'assistant (C41) à
1 440 : icône à gauche du texte, sur sa première ligne. Rouge avant, vert après. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test state-board --reporter=line`.
**Arrêt si :** une assertion existante devrait être retirée ou assouplie.
