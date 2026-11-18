# L3D-X2 — `fix(web): the usage rights texts fit the creator and follow the catalogue`
Grille `dev-react-node`. Constats L3DU-2 et L3DU-3 (`l3d/ux-constats.md` l. 24-41), mêmes fichiers.
**Préalable :** la note de X2 porte l'accord du fondateur ; sinon `ETAT: arret decision`.
**Textes, mot pour mot, rien d'autre :**
- `usage_right.media_buy` (l. 503) : FR « Achat média : le contenu est diffusé comme publicité de la
  marque » · EN « Media buy: the content runs as the brand's own advertising » ;
- `usageRights.warning` (l. 62) : FR « Ce que devient votre contenu : cette campagne demande un achat
  média illimité et mondial. Votre contenu pourra être diffusé sans limite de durée ni de pays.
  Vérifiez ces conditions avant de vous engager. » · EN « What becomes of your content: this campaign
  requires unlimited worldwide paid media rights. Your content may be used with no time or country
  limit. Check these conditions before you commit. »
**Lire :** `09` l. 400, 406-410, 877 ; `locales/{fr,en}/campaign.json` l. 61-63, 499-504 ;
`campaign-preview-view.ts` l. 250-275, 363-380 ; `e2e/creator-campaigns.spec.ts` l. 420-457.
**Livrer :** les deux clés en FR et en EN ; `09` l. 877 : ses deux cellules reçoivent le texte de
l'encart (le catalogue fait foi). Ton `warning`, icône, condition RG40, noms de clés inchangés.
**Ne pas toucher :** `organic_repost`, `paid_whitelisting` (l. 501-502, même « vous », hors constat :
`EC` signalé, pas réécrit) ; `brand-profile.json` ; tout composant.
**Prouver :** cas l. 420 (EN 1 440) : `[data-field="usageRights"]` contient
`en.usage_right.media_buy` ; l. 449-451 inchangées ; aucun cas neuf ni attendu changé ;
`brand-campaign.spec.ts` vert. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test e2e/creator-campaigns.spec.ts
e2e/brand-campaign.spec.ts --reporter=line`.
**Commit :** `git add` nominatif, jamais `-A`, ses seuls hunks ; `run.md` ligne X2.
**Arrêt si :** un autre texte serait nécessaire ; un attendu existant change.
