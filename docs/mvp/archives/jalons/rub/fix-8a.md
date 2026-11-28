# RUB-fix-8a — `fix(web): the member components pass data, id and aria attributes on`
Grille `dev-react-node`. RUBT-4 (jalon), **voie A**. **Exclusive de fix-8b** : seulement si le fondateur choisit
« transmettre » ; l'autre ligne passe alors à `ignoré`.
**Lire :** annexe § Revue (RUBT-4) ; fiche, invariants 4, 7 ; `R02c` l. 3-7 (`R` = `docs/mvp/22-refonte-ux-ui`) ;
modèles : `U/PageFrame.tsx` l. 10-38, `U/Button.tsx` l. 51, 165-192 ; `tests/catalogue-data.ts` l. 15-70
(`CATALOGUE_MODULES`, 54) ; `Notice.tsx` l. 30, 46 ; `RowList.tsx` l. 46, 101.
**Livrer :**
- Chaque module de `CATALOGUE_MODULES` accepte et pose sur sa racine `id`, `data-*`, `aria-*`, rien d'autre (ni `style`,
  ni gestionnaire, ni `dangerouslySetInnerHTML`). Champs (C18 à C21, C47, C49, `DomainField`, `TagPicker`) : `id` et
  `aria-*` au contrôle, `data-*` à la racine. Les `aria-*` du module l'emportent, `aria-describedby` reçu s'ajoute aux
  siens ; règle écrite une fois, en commentaire du type commun.
- `NomProps` exporté et autonome (RU-18) ; rendu identique sans attribut passé ; `data-*` lus par une spec conservés.
**Ne pas toucher :** `R02c`, `packages/ui`, tokens, textes, `apps/web/e2e/case-floors.ts` et tout fichier non commité
de la session R2B (`git status`) ; `git add` de vos seuls chemins.
**Prouver :** `tests/member-pass-through.test.ts` (RUB-T12) : `it.each` sur `CATALOGUE_MODULES` lu tel quel (module sans
rendu = échec), `renderToStaticMarkup` avec `id`, `data-probe`, `aria-describedby`, présents sur la racine (ou le
contrôle) ; cas négatif : un module qui les perd est détecté. Plancher dans `apps/web/tests/case-floors.ts`, RUB-T12 à
l'annexe § Tests. `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test state-board member-shell
--reporter=line`.
**Arrêt si :** un module ne peut transmettre sans changer son rendu ou son API (le nommer) ; la garde de catalogue
refuse le type commun.
