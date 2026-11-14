# L3B-fix-1 — `fix(web): the way back from the preview returns where it was opened`
Grille `dev-react-node`. Skill : `design-system-influx`. Constats : L3BU-1, L3BU-15 (même lien).
**Lire :** `l3b/ux-constats.md` L3BU-1, L3BU-15 ; `17` l. 848 ; code : `CampaignPreviewScreen.tsx`
l. 80-89, liens de `CampaignBudgetFields.tsx` l. 158-167 et `CampaignListScreen.tsx` l. 193-205,
pages `campagnes/[id]/apercu` et `campaigns/[id]/preview`, `campaign-view.ts` (`stepOfParameter`).
**Livrer :**
- le lien vers l'aperçu porte son origine : `?from=4` (étape 4), `?from=list` (liste) ;
- une fonction pure lit `from` : étape → la campagne à `?step=n` ; `list` → « Mes campagnes » ;
  absent ou inconnu → la campagne, comme aujourd'hui ;
- le retour suit cette destination, libellé `preview.back` ou `form.back` ; nom accessible sans
  « Retour à » doublé (L3BU-15) ; libellés FR/EN.
**Ne pas toucher :** contenu de l'aperçu, appel `creator-view`, formulaire hors lien, API.
**Prouver :** `tests/campaign-preview-view.test.ts` +3 cas (étape, liste, inconnu), plancher de
`tests/case-floors.ts` 11 → 14 ; e2e sans cas neuf (plancher 10 inchangé) : `brand-campaign.spec.ts`
l. 867-869, retour → `?step=4$` et `h2` de l'étape 4 ; l. 872 (EN 375, depuis la liste), retour →
`/en/campaigns$` ; **≤ 0,3 s** ajoutées, durée du spec (médiane de 3) ≤ 25 s, notée ;
`pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test e2e/brand-campaign.spec.ts --reporter=line`.
**Arrêt si :** la durée du spec dépasse 25 s.
