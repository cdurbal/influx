# Relecture visuelle `expert-ux` après RK-N

N est ce qui suit `ux` dans les arguments. Aucun fichier du dépôt modifié, aucun commit. Applique
`.claude/agents/expert-ux.md`, sans le lancer en sous-agent.

| N | États à capturer (375 et 1 440 px) |
|---|---|
| 4 | Bouton principal (repos, survol, appui, désactivé), secondaire, bouton texte, petits boutons du BO ; écran de 320 px avec un bouton pleine largeur survolé |
| 6 | Halo d'en-tête : accueil créateur, une page de « Mon compte », connexion membre, accueil BO ; bas de l'en-tête zoomé (aucun bord) ; barre du bas à 375 px |
| 9 | Titres et surtitres (accueils, « Mon compte », parcours de code), carte cliquable survolée, chaque badge, en-tête et ligne survolée du tableau des inscrits, titre focalisé après navigation |
| fin | Test du logo (`20` §11.7) sur l'ensemble : accueils marque et créateur, connexion, BO ; plus la landing `/fr` (inchangée) |

**Captures :** spec jetable `apps/web/e2e/zz-ux-captures.spec.ts` qui réutilise les aides de
`charter-rendering.spec.ts` (sessions semées, état appuyé, attente des animations), lancée seule
(`pnpm --filter @influx/web exec playwright test e2e/zz-ux-captures.spec.ts --reporter=line`), images
dans le scratchpad. Supprime la spec ensuite ; elle n'est jamais commitée. Regarde les images toi-même.

**Grille :** `20` §11.4 (paires interdites), §11.5, §11.6, §11.7 (test du logo, parades Spotify),
§11.8. Exception : tu peux ouvrir `design-proposals/proposition-4-keo-emerald.html` pour comparer.

**Sortie :** écarts classés (bloquant / à corriger au commit suivant / accepté), chacun avec le
fichier de classes concerné ; pour `fin`, verdict du test du logo en une phrase.
