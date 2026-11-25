# L3B-fix-4 — `test: date and length parity of base and domain, L3B identifiers in titles`
Grille `dev-react-node`. L3BT-1, L3BT-2, EC-L3B-R-1 : annexe § Revue (fait foi). Tests seulement.
**Lire :** fiche invariant 5 ; `campaign-parity.test.ts` l. 1-71, 252-295 ; `campaigns-core.test.ts`
l. 48-145 (`attempt`, `draftUpdate`), 326-370 ; `dates.ts` l. 55-128 ; `limits.ts` l. 9-15, 66-80 ;
`0303` l. 286-288, 304-314.
**Livrer :**
- L3BT-1, `campaign-parity.test.ts` : un `describe` « L3B-T6 … » ; chaque cas juge une entrée par
  `campaignDateIssues` (ou `is…LengthAllowed`) et par un UPDATE annulé de la campagne A
  (`testDataSet`, `inRolledBackTransaction`), même verdict attendu (accepté, ou refus nommé) ; une
  règle en jeu par cas : six paires RG70 seules (calendrier partiel), inversées puis égales ; 29/02,
  31/12, fin de mois, +12 mois ± 1 jour (RG74) ; titre, résumé, brief à max et max + 1 code points ;
- L3BT-2, préfixe « <id>: », reste du titre intact : L3B-T4 `reference-taxonomies` l. 347, 456,
  `t16-commission` l. 130 ; L3B-T8 `t14-campaigns-route` l. 111, 237 ; L3B-T9 `t1-anonymisation`
  l. 1555 ; L3B-T6 `campaign-parity` l. 252 ; `brand-campaign.spec.ts` : L3B-E1 l. 177, 245, 411,
  487, E2 l. 527, 648, 710, 752, E3 l. 804, 899 ; `campaign-view.test.ts` : « L3B-E1 », « L3B-E2 »
  retirés des `describe` (unitaires).
**Ne pas toucher :** produit, migrations, cas et attendus existants, corps des tests renommés,
`t2-rls-matrix`, `tm11-drizzle-parity`.
**Prouver :** plancher `campaign-parity` (83) relevé du nombre exact de cas ajoutés, aucun autre
changé (e2e 10, `campaign-view` 59) ; `pnpm check:fast` ; `pnpm --filter @influx/api test:db --`
les cinq fichiers base cités `--reporter=dot` ; `pnpm --filter @influx/web exec playwright test
e2e/brand-campaign.spec.ts --reporter=line` : mêmes 10 cas verts, médiane de 3 ≤ 25 s, notée.
**Arrêt si :** divergence base/domaine (cas rouge consigné, rien corrigé) ; un renommage change un
résultat ; spec > 25 s.
