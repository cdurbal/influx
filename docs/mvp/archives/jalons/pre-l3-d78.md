# PRE-L3-D78 — `docs(mvp): extend D78 to Lot 3 specs and matching skills`
Préalable du Lot 3, avant `/lot-decoupe 3`. **Opus 5.5 · xhigh**, session neuve. Grille
`product-owner` ; skill `feature-spec` (format des RG) seulement si une RG est réécrite.

**Lire :** `decisions-detail.md` § D78 (`Grep "^## D78 "`, extension du 2026-11-13, option A) ;
`07` §G l. 656 à 746 (modèle du bandeau de suspension) ; dans `09`, `10` et `11`,
`Grep -n -i "tarif|F12|rémunération|budget|price_band"` (12, 28 et 41 occurrences), puis les seules
tranches bornées autour ; `04` : même `Grep`, pour constater, sans modifier ;
`.claude/skills/matching-spec/SKILL.md` (44 Ko, par tranches de 300 lignes),
`.claude/skills/messaging-spec/SKILL.md` l. 95 à 105, `.claude/agents/expert-matching.md` l. 55 à 75.

**Livrer :**
- `09` §F : budget déclaré en tranche, vu du seul commercial ; le créateur voit le type de
  contrepartie et « à négocier avec votre commercial » ; fourchette de rémunération par créateur
  suspendue (bandeau D78 comme `07` §G) ; RG marquées « suspendue (D78) », jamais supprimées.
- `10` : F12 et RG18 suspendues ; tri par tarif et critère « tarif compatible » retirés du tri
  explicable ; exemples d'explication sans montant.
- `11` : tarif proposé suspendu (US6, champ, RG54, Q4) ; la candidature garde motivation, concept,
  formats ; questions ouvertes et critères d'acceptation touchés mis à jour.
- `matching-spec` : `SKILL.md` de 10 Ko au plus (règles, check-list, renvois à `10`), le reste dans
  `references/` lu à la demande, sans tarif ; `messaging-spec` l. 101 et `expert-matching` (critère
  économique, exclusion « tarif hors budget ») renvoyés en V2.
- Ligne D78 de `decisions.md` : « alignement des specs fait le <date> » (250 caractères au plus).

**Ne pas toucher :** code, migrations, `04` (colonnes gardées : seuls saisie et affichage sont
suspendus), `07`, les autres skills.

**Prouver :** chaque occurrence restante de `tarif` dans `09`, `10` et `11` est suspendue (D78) ou
renvoyée en V2 (liste dans la réponse) ; `wc -c` du skill ; index régénéré par le hook.

**Arrêt si :** une règle d'anonymisation (D45, D46) dépend d'un champ tarifaire ; `04` impose un
tarif non nul qui exige une migration (question à `expert-database`) ; une RG sans lien avec un
montant devrait changer.

Un seul commit, au titre ci-dessus ; réponse de 15 lignes au plus.
