# L3D-X1 — `fix(creator): the campaign record says why it offers no way to apply`
Grille `dev-react-node`. Skill : `design-system-influx`. Constat L3DU-1 (`l3d/ux-constats.md` l. 14-22).
**Préalable :** la note de X1 porte l'accord du fondateur et de `product-owner` (hors catalogue
`09`) ; sinon `ETAT: arret decision`.
**Texte, mot pour mot, rien d'autre :** FR « Vous ne pouvez pas encore candidater depuis INFLUX : cette
page sert à découvrir la campagne. » · EN « You cannot apply through INFLUX yet: this page lets you read
the campaign. »
**Lire :** annexe EC-L3D-3 ; `17` l. 1605-1617 ; `09` l. 879 ; `CampaignRecordScreen.tsx` l. 114-170 ;
`CampaignFeedScreen.tsx` l. 129-207 ; `e2e/creator-campaigns.spec.ts` l. 362-477.
**Livrer :**
- clé `campaign.record.noApplication` (FR, EN) ; `Notice` `tone="info"`, `announce={false}`,
  `data-campaign-notice="noApplication"`, sous le `PageHeader` d'une fiche lue (ni chargement, ni
  refus, ni « n'est plus ouverte »), hors `CampaignReadBody` ;
- fil : le constat la pose aussi au-dessus de la liste, même texte (« la campagne » au singulier) ;
  seulement si la note dit « fiche et fil », sinon fiche seule (EC) ;
- `09` : ligne de catalogue après l. 879 (clé, deux textes, « Lot 3 seul, retirée au Lot 4 ») ;
  annexe EC-L3D-3 : une phrase qui la cite.
**Ne pas toucher :** `CampaignFeedCard.tsx` (L3DU-5, -6), `CampaignReadBody.tsx`, autres clés, API.
**Prouver :** cas l. 362 (FR 375) : notice `toHaveText(fr.record.noApplication)` ; cas l. 420
(EN 1 440) : en EN, absente en pause ; axe vert ; aucun cas neuf ni attendu changé ;
`brand-campaign.spec.ts` vert. `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test
e2e/creator-campaigns.spec.ts e2e/brand-campaign.spec.ts --reporter=line` ; durée dans la note.
**Commit :** `git add` nominatif, jamais `-A`, ses seuls hunks ; `run.md` ligne X1.
**Arrêt si :** un autre texte serait nécessaire ; l'aperçu de la marque change ; un bouton, un lien ou
une date apparaît.
