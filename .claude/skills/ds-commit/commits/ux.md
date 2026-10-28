# Relecture visuelle `expert-ux` après DS-N

N est le nombre qui suit `ux` dans les arguments. Aucun fichier du dépôt modifié, aucun commit. Applique
`.claude/agents/expert-ux.md`, sans le lancer en sous-agent.

| N | Écrans à capturer |
|---|---|
| 6 | Coquille membre : accueil créateur (compte neuf), une page de « Mon compte » |
| 8 | Accueils marque et créateur ; « Mon compte » : informations, préférences, sessions, Mes données, zone de danger |
| 10 | Coquille backoffice : accueil à 1440 px, navigation compacte à 768 px, poste de travail à 375 px |
| 12 | Liste des inscrits, fiche, invitations, double validation, réglages Apollo, comptes internes, santé technique |
| 14 | Landing `/fr` et `/en`, puis le choix de porte (passage d'une charte à l'autre) |

**Captures :** une spec jetable `apps/web/e2e/zz-ux-captures.spec.ts` qui réutilise les aides existantes
(`seedMember`, sessions semées), lancée seule
(`pnpm --filter @influx/web exec playwright test e2e/zz-ux-captures.spec.ts --reporter=line`), images
écrites dans le scratchpad, à 375 et 1440 px sauf indication contraire. Supprime la spec ensuite ; elle
n'est jamais commitée.

**Grille :** `20@727+21` (§11.7, test du logo), `20@694+33` (§11.6). Exception à la règle de session :
tu peux ouvrir `design-proposals/proposition-4-keo-emerald.html` pour comparer (écarts K1 à K23).

**Sortie :** écarts classés (bloquant / à corriger au commit suivant / accepté).
