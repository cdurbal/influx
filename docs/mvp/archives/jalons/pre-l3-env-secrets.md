# PRE-L3-ENV — `chore(claude): split the env-secrets skill`
Amendement D77 du 2026-11-13 (skills de 10 Ko au plus). **Sonnet 5.5 · high**, session neuve.

**Lire :** `.claude/skills/env-secrets/SKILL.md` (35 Ko, par tranches de 300 lignes) ;
`CLAUDE.md` §5 et §8 ; `docs/mvp/runbooks/staging.md` (titres seulement, `Grep "^#"`) ;
`decisions.md` : `Grep` de D62, D64, D70.

**Livrer :**
- `SKILL.md` de 10 Ko au plus : frontmatter inchangé, règles non négociables, check-list
  « nouvelle variable ou nouveau secret », tableau des environnements, pointeurs.
- Le reste dans `references/` (par exemple `catalogue-variables.md`, `rotation-et-fuite.md`),
  chaque fichier cité depuis `SKILL.md` avec le moment où le lire.
- Ce qui recopie `CLAUDE.md` ou le runbook devient un renvoi ; ce qui contredit une décision est
  aligné (D62 amendée par D70 : `.env.local` = `staging`).

**Ne pas toucher :** code, fichiers `.env*`, autres skills.

**Prouver :** `wc -c` de chaque fichier ; liste des règles avant et après (aucune perdue, 15 lignes
au plus dans la réponse) ; aucune valeur de secret recopiée.

**Arrêt si :** une contradiction entre le skill et `CLAUDE.md` n'est tranchée par aucune décision.

Un seul commit, au titre ci-dessus ; réponse de 10 lignes au plus.
