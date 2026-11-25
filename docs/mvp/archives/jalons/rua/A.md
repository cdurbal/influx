# RUA-A — arbitrage `expert-ux` : `rua/modele-ux.md`
Grille `expert-ux`. Skill : `design-system-influx` (SKILL.md, `references/identite-et-tokens.md`).
**Lire :** fiche ; Lectures, ligne A ; F0 de `run.md` (note) ; `R03` §3.4 (l. 123-135).
**Livrer :** `docs/mvp/archives/jalons/rua/modele-ux.md`, 10 Ko au plus ; chaque point : choix, *M.* = motif, source ; prime
sur `R03` §3.3 pour tout nom de token.
1. Tokens : table finale nom · valeur (celle de la maquette) · fichier (`TS` ou `BO`) · espace `@theme`/`:root` ·
   emploi. Tout token du seul backoffice prend un nom `-bo-` (G3f) : `grid-record`, `grid-decision`, `grid-check`,
   `grid-sync`, `size-choice-dense`, `size-alert-code`… à trier ; `--container-*` et `--tracking-*` en `:root` ou
   `@theme`.
2. RU-01 : noms et paliers (titre de fiche 26/30/34, héros 28/32/36, chiffre 18/19/20, encadré 20/22/24).
3. RU-06 (échelles, 900 ms, `brightness`), RU-07 (avatar), RU-08 (cases du code), RU-10 (onglets), RU-11, RU-16 :
   choix et phrase exacte à écrire dans `20` §11.x.
4. RU-09, RU-12, RU-15, RU-19 : la part `expert-ux` encore due (phrase de charte, liste), sans revenir sur D87.
5. Noms des `--animate-*` (`R04` §2) et leurs valeurs ; les paires à ajouter à `CONTRAST_MATRIX` (`CD` l. 197-353).
6. Ce que `20` §10, §11.3, §11.5, §11.8 doivent dire, par ligne (RU-04, RU-05, RU-13, RU-17 selon F0).
**Ne pas toucher :** code ; `20` ; `decisions.md` (ligne 00).
**Prouver :** chaque valeur de `R03` §3 a un nom ou « non retenue, M. » ; `wc -c` ≤ 10 240.
**Arrêt si :** une couleur nouvelle (D6), un point de F0 manquant, ou un point qui revient sur D87 : ligne `fondateur` ajoutée à
`run.md` avec la question.
