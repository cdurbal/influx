# RUB-fix-10b — `docs(mvp): the e2e budget of RUB rewritten`
Grille `architecte`, validation `chef-de-projet`. RUBT-1 (jalon), **voie B**. Seule, ou après fix-10a pour le reste
mesuré (choix du fondateur). Aucun code. Après fix-6 à fix-9 (et fix-10a s'il est fait) : le chiffre les inclut.
**Lire :** annexe § Tests (budget), § Revue ; fiche, invariant 16 ; `rub/modele-archi.md` l. 40-44 ; `R05` l. 77-85
(`R` = `docs/mvp/22-refonte-ux-ui`) ; `docs/mvp/18-plan-de-test-mvp.md` l. 1920-1925, 1995-2000 ;
`docs/mvp/decisions-detail.md` `Grep "^## D89 "` ; `rub/cloture.md` ; secondes par cas : run 46062007755 (ou le dernier
run vert, `gh run view <id> --log`).
**Livrer :**
- Budget de RUB écrit au chiffre mesuré (par cas et total), avec sa cause (planche de 648 000 caractères, passes axe et
  hydratation à chaque ouverture) ; plafonds d'éclats (7 min 30) et de job (8 min) inchangés et vérifiés au même run.
- Règle de A §4 (scission au-delà de 2 s de service en CI, jamais relevé) : maintenue avec un relevé daté, ou levée ;
  la planche ne grossit plus sans elle. Dire si « +20 s par jalon » (`R05` §7, `18` §12.8) reste la règle des écrans.
- Mis à jour : annexe (budget, critère), invariant 16 de la fiche (« sauf décision »), D89 amendée (`decisions.md` une
  ligne, `decisions-detail.md` le texte) ; `chef-de-projet` valide dans le même commit (mention dans le texte de D89).
**Ne pas toucher :** code, specs e2e, planchers ; tout fichier non commité de la session R2B (`git status`) ; `git add` de
vos seuls chemins. Documentation seule : aucun test (D76).
**Prouver :** chaque chiffre cité renvoie au run nommé ; la condition d'arrêt « budget e2e dépassé » de `cloture.md` lit
le nouveau budget sans autre retouche.
**Arrêt si :** un plafond d'éclats ou de job est dépassé ; un relevé montre plus de 2 s de service (A §4 impose alors
fix-10a) ; la décision relève du fondateur (invariant d'un lot).
