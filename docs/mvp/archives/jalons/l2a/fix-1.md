# L2A-fix-1 — `fix(web): mediation line, role chip and underlined links (logo test)`
Grille `dev-react-node`. Skill : `design-system-influx`. Constats L2AU-1 à 3 : fiche § Revue, « Test
du logo » (L2AU-4 exclu). Hors périmètre de la fiche (écrans, libellés) : demande du fondateur.
**Lire :** `20` l. 542-547, 838-850, 886-891 ; `17` l. 176, 227, 392-411 ; `EmailStep.tsx` l. 107-168 ;
`connexion/page.tsx` l. 24 ; `MemberShell.tsx` l. 325-329, 476-496 ; `shell-classes.ts` l. 31-43 ;
`RoleBadge.tsx` ; `button-classes.ts` l. 12-45 ; `MemberHome.tsx` l. 68-73 ; `{fr,en}/auth.json`.
**Livrer :** `17` et `20` d'abord, même commit, source L2AU-n ; clés FR/EN ; tokens existants seuls.
- L2AU-1 : `auth.step1.mediation` sous le `h1` de l'écran 1, `text-secondary` : texte du constat,
  aucun délai, « salesperson » (`en/auth.json` l. 239) ; alignement `expert-marketing` signalé
  `EC-L2A-fix-1-1`, sans bloquer. Porte connue (jamais `connexion`) : `RoleBadge` « Marque » /
  « Créateur » au-dessus du `h1`, usage (2) de §11.3 étendu.
- L2AU-2 : badge de l'en-tête en pastille neutre, point `spacing-3`, visible aussi sous `lg`.
- L2AU-3 : les quatre liens en `TEXT_BUTTON_CLASSES` soulignés, alignés à gauche ; 600 gardé (TK1.3).
**Ne pas toucher :** `packages/ui`, vitrine, `apps/backoffice` ; halo, ombre, zoom, couleurs (F6) ;
L2AU-4 ; aucun attendu affaibli.
**Prouver :** `pnpm check:fast` ; cas neufs `L2AU-n`, un par page et par langue (connexion, accueil),
375 et 1 440 px en boucle, vus rouges par mutation (R4), ≤ 6 s ; planchers relevés ;
`pnpm --filter @influx/web exec playwright test journey-screens member-shell charter-rendering
member-primitives account --reporter=line` (axe, WCAG AA, G3g, TD5.8), puis `pnpm test:e2e`.
**Arrêt si :** un renfort retire ou atténue un effet ou une couleur de F6 ; l'en-tête déborde ou
tronque à 320 px ; une paire de couleurs absente de §11.4 ; une couleur de rôle hors de `RoleBadge`.
