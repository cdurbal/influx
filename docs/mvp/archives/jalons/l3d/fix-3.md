# L3D-X3 — `fix(web): neutral page titles for the campaign pages shared by role`
Grille `dev-react-node`. Constat L3DU-4 (`l3d/ux-constats.md` l. 43-49), point tranché 1.
**Préalable :** la note de X3 porte l'accord du fondateur sur les titres ; sinon
`ETAT: arret decision`.
**Titres, mot pour mot, rien d'autre :** `campaign.meta.list` = « Campagnes » · « Campaigns » ;
`campaign.meta.form` = « Campagne » · « Campaign ».
**Lire :** `l3d/modele.md` l. 43 (le serveur ignore le rôle) ; `components/auth/AuthPage.tsx`
l. 20-56 ; `locales/{fr,en}/campaign.json` l. 2-8 ; `app/[locale]/(member)/(space)/campagnes/page.tsx`
et `[id]/page.tsx` ; `e2e/creator-campaigns.spec.ts` l. 112-125, 362-378 ;
`e2e/brand-campaign.spec.ts` l. 199-238.
**Livrer :** les deux valeurs en FR et en EN ; clés et `PAGE_TITLES` inchangés : un titre partagé par
les deux rôles, le `h1` reste propre à l'écran (« Mes campagnes », « Ma campagne » pour la marque).
**Ne pas toucher :** `meta.preview` ; `list.title`, `home.title`, `form.back` ; `AuthPage.tsx` ; tout
composant.
**Prouver :** aucun test ne lit le `<title>` (`toHaveTitle` absent de `apps/web` le 2026-11-18) :
`expect(page).toHaveTitle(…)` ajouté dans des cas existants : créateur, fil FR (l. 112,
`fr.meta.list`) et fiche FR (l. 362, `fr.meta.form`) ; marque, l. 201 (`copy.meta.list`) et l. 238
(`copy.meta.form`), `title(page)` (`h1`) inchangés ; aucun cas neuf, planchers inchangés.
`pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test e2e/creator-campaigns.spec.ts
e2e/brand-campaign.spec.ts --reporter=line`.
**Commit :** `git add` nominatif, jamais `-A`, ses seuls hunks ; `run.md` ligne X3.
**Arrêt si :** un titre dépend du rôle ; un attendu existant change.
