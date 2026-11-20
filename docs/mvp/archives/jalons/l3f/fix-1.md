# L3F-fix-1 — `fix(brand): the creator search on a phone, the focus after an action, the private selection`
Grille `dev-react-node`. Skill : `design-system-influx`. Constats L3FU-1 à L3FU-5 (`l3f/ux-constats.md` l. 20-43).
**Lire :** `ux-constats.md` l. 5-43 ; `17` l. 910-936, 944-945, 952 ; `CreatorSearchScreen.tsx` l. 145-379 ;
`SearchFiltersForm.tsx` l. 273-284 ; `SelectionPanel.tsx` l. 101-218 ; `SelectionRequestScreen.tsx` l. 122-146 ;
`AnonymousProfileScreen.tsx` l. 127-141 ; `creator-search-classes.ts` ; les deux specs e2e.
**Livrer (scénario → correctif) :**
- **L3FU-1** (`CreatorSearchScreen.tsx` l. 174-258, `Controls` l. 295-379) : à 375 × 800, la première carte
  est sous la flottaison → sous `lg`, « Filtres » et « Tri » sur une ligne, « Recherche liée à » en tête du
  bloc repliable, `page.explain` réduit à la ligne de `17` l. 930 (FR « La recherche se fait par critères,
  pour protéger l'anonymat des créateurs. », EN « Search works by criteria, to protect creators'
  anonymity. ») ; à toute largeur, `sort.explain` derrière un `[i]` (`<details>`, `InfoIcon`, 44 px,
  `aria-describedby` gardé, nom `sort.explainToggle` FR « Comment fonctionne le tri », EN « How sorting
  works ») ; dès `lg`, disposition de `17` l. 884-891 inchangée.
- **L3FU-2** (l. 153-158, 197-200 ; `SearchFiltersForm.tsx` l. 273-276) : le bloc se masque, le focus tombe
  sur `<body>`, le défilement reste en bas → toute application qui ferme le bloc ouvert (condition
  `filtersOpen`, aucune largeur lue en JS) donne le focus à la tranche (`tabIndex={-1}`), ou, non rendue, à
  la tête de la colonne des résultats (`tabIndex={-1}`, `data-results-start`).
- **L3FU-3** (`shell-classes.ts` l. 110, `member-nav.ts` l. 72-76) : sous `lg`, « Mes sélections » n'a
  d'entrée que dans la barre ouverte → lien `lg:hidden`, `data-shortlists-link`, libellé `panel.all`, sous
  le titre de la recherche (tous états, fermée comprise) et du profil.
- **L3FU-4** (`SelectionPanel.tsx` l. 108-111) : « privée » ne se lit qu'en ouvrant la barre → `panel.title`
  FR « Ma sélection privée ({count}) », EN « My private selection ({count}) ».
- **L3FU-5** (`SelectionRequestScreen.tsx` l. 126-145) : la confirmation remplace le formulaire, rien n'est
  annoncé → focus sur le titre `data-request-sent` (`tabIndex={-1}`) à l'affichage.
- `17` : l. 944-945, « (à revoir par `expert-ux`, ligne U) » devient la disposition livrée ; l. 952 aligné.
**Ne pas toucher :** L3FU-6 à 22 (lien de demande en double : E1 l. 55 en attend 2) ; API ; `member-nav.ts`,
`shell-classes.ts` ; `21` ; autres clés. Un seul exemplaire de chaque contrôle dans le DOM ; jetons seuls.
**Prouver :** aucun cas neuf ni attendu changé ; planchers (`e2e/case-floors.ts` l. 17-18 : 4 et 3) jamais
baissés. E2 l. 148 (FR 375) : haut de la 1re carte au-dessus de `[data-selection-panel="ready"]`, lien
visible, titre replié contenant « privée », bloc ouvert puis « Voir les résultats » → tranche
`toBeFocused()` ; E1 l. 39 (fermée) : lien visible ; E2 l. 257 : `[data-request-sent]` `toBeFocused()` ; axe
vert. `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test e2e/brand-creator-search.spec.ts
e2e/brand-creator-shortlists.spec.ts --reporter=line` ; note : médianes de 3, E1 ≤ 12 s, E2 ≤ 13 s, total ≤ 25 s
(annexe l. 20-24).
**Commit :** `git add` nominatif, jamais `-A`, ses seuls hunks ; `run.md` ligne fix-1.
**Arrêt si :** « Recherche liée à » ne change de place sous `lg` qu'en doublant le contrôle ou en lisant la
largeur en JS ; un autre texte serait nécessaire ; un budget e2e est dépassé.
