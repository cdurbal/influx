# L3B-fix-3 — `fix(web): a sticky submit on phone, a refused field named with a way to it`
Grille `dev-react-node`. Skill : `design-system-influx`. Constats : L3BU-3, L3BU-4.
**Lire :** `l3b/ux-constats.md` L3BU-3, L3BU-4 ; `17` l. 839-841, 849, 859-861 ; `09` l. 886-890
(RG110) ; code : `CampaignFormScreen.tsx` l. 303-330, `CampaignSubmitPanel.tsx` l. 69-78 et
172-182, `use-campaign.ts` l. 78-82 et 311-338, `campaign-view.ts` l. 116, 652-660 ; patron :
`BrandProfileScreen.tsx` l. 269-281, `brand-profile-classes.ts` l. 62-67, `globals.css` l. 78-87.
**Livrer :**
- sous `lg`, barre `data-action-bar` (`ACTION_BAR_CLASSES` importé, rien recopié) : `SaveStatus`
  et « Soumettre ma campagne », même soumission que le panneau (logique remontée, écrite une fois) ;
  « Étape suivante », le panneau et sa liste restent dans le flux (EC-L3B-10) ; absente si figée ;
- `SubmitOutcome` gagne `{ kind: "invalid"; step; key }` : premier champ de `unsavedInError` dans
  l'ordre de l'écran (fonction pure, étape par `STEP_OF_KEY`) ; panneau et barre appellent `onGoTo` ;
- `publish.invalid` nomme les champs refusés, un lien chacun (patron des manquants) ; FR/EN.
**Ne pas toucher :** `SaveStatus` du poste de travail (L3BU-16), ordre de `missingRequired`, API.
**Prouver :** `tests/campaign-view.test.ts` +2 cas (ordre de l'écran ; aucun refus → `null`),
plancher 57 → 59 ; e2e sans cas neuf (plancher 10) : l. 632 (EN 375), après le clic, bouton de la
barre `toBeInViewport()` à l'étape 1 ; l. 527 (FR 1 440) : barre masquée ; dates en conflit, étape
2, « Soumettre » → `?step=5`, `#campaign-startsOn` focalisé, champ nommé au panneau ; **≤ 0,6 s**
ajoutées, durée du spec (médiane de 3) ≤ 25 s, notée ; `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test e2e/brand-campaign.spec.ts --reporter=line`.
**Arrêt si :** la barre exige une valeur hors tokens ; la durée du spec dépasse 25 s.
