# L2B-C — `docs(mvp): close the L2B milestone`
Grille `testeur`.
**Livrer :**
- Cases du critère de fin cochées avec leur preuve (sha, mesure, commande) ; une case non prouvée
  reste ouverte et passe au reliquat de `21` §8.
- `pnpm check`, puis `pnpm test:e2e` trois fois sans rejeu ; dans `run.md` : somme des médianes des
  cas ajoutés (`test-results/e2e-report.json`, ≤ 20 s), durée du job « Browser journeys », DS-flaky.
- `staging` : constats de 14 ; « Migrate staging » vert pour `0202` à `0204`.
- Amendements groupés : `06` RG15 (EC-L2B-2), RG27 et RG58 (réponse 1), l. 968 (EC-L2B-6) ; `17`
  §2.6 (EC-L2B-7) et l. 717-728 (EC-L2B-5) ; `04` l. 1395 (EC-L2B-4), §5.11, §11.2 (EC-L2B-1) ;
  `lot2-plan.md` (numéros) ; L2-amend (`06` RG27, `07` blocs 3 et 5, `08` RG32) ; écarts `EC-L2B-*`
  regroupés en fiche.
- `21` §8 : L2AT-4, L2AS-2, L2-amend et la part soldée de L2AT-5 retirés ; constats de la revue
  ajoutés ; une ligne de clôture L2B.
- Pas de `git mv` (autres sessions) : `docs/mvp/jalons/l2b-fiche.md` et `docs/mvp/jalons/l2b/` vers
  `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés.
- Revue sans bloquant : commit d'attestation séparé (`git commit --allow-empty -F <fichier>`).
**Prouver :** dernières lignes de `pnpm check` et des trois `pnpm test:e2e` ; CI verte après push.
**Arrêt si :** un passage e2e rouge ; ajout > 20 s ou job ≥ 8 min (levier ou arbitrage, `21` §2.3).
