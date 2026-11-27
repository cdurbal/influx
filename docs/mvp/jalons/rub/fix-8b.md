# RUB-fix-8b — `docs(mvp): the common contract of 02c amended for the passed attributes`
Grille `architecte`. RUBT-4 (jalon), **voie B**. **Exclusive de fix-8a** : ne s'exécute que si le fondateur choisit
« amender » ; l'autre ligne passe alors à `ignoré`. Aucun code.
**Lire :** annexe § Revue (RUBT-4) ; fiche, invariant 4 ; `R02c` l. 1-7 (`R` = `docs/mvp/22-refonte-ux-ui`) ; `R06a`
`Grep "RU-18"` ; `docs/mvp/decisions-detail.md` `Grep "^## D89 "` ; état du code : `Grep -l "\.\.\.rest" U/*.tsx`,
`Grep "id?: string" U/*.tsx` (aujourd'hui : `Button`, `PageFrame` tout ; `Notice`, `RowList` `id` seul).
**Livrer :**
- `R02c` l. 5-7 réécrit : ce que chaque composant transmet (`id`, `data-*`, `aria-*`), par famille ou par composant, au
  plus près de l'existant ; ce qui manque s'ajoute à la demande d'un écran, dans le jalon qui le câble, aux deux fronts.
- Effet sur RUC (jumeaux du backoffice, mêmes props) et sur l'invariant 7 (spec qui lit un `data-*`), en une phrase
  chacun ; dire si une garde ou un test tient le contrat amendé, sinon pourquoi.
- D89 amendée (`decisions.md`, une ligne ; `decisions-detail.md`, le texte) ; note RUBT-4 à l'annexe § Revue : « amendé ».
**Ne pas toucher :** code, `R02a`, `R02b`, autres lignes de `R02c`, tout fichier non commité de la session R2B
(`git status`) ; `git add` de vos seuls chemins. Documentation seule : aucun test (D76), le hook régénère `INDEX.md`.
**Prouver :** la phrase amendée est vraie du code au commit (chaque composant cité vérifié par `Grep`).
**Arrêt si :** l'amendement exige de retirer un attribut qu'un composant transmet aujourd'hui ou qu'une spec lit ; il
touche `CLAUDE.md` ou une décision du fondateur.
