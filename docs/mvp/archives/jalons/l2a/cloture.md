# L2A-C — `docs(mvp): close the L2A milestone`
Grille `testeur`.
**Livrer :**
- Cases du critère de fin cochées avec leur preuve (sha, mesure, commande) ; une case non prouvée reste
  ouverte et passe au reliquat de `21` §8.
- `pnpm check`, puis `pnpm test:e2e` trois fois de suite sans rejeu. Dans `run.md` : somme des
  médianes des cas ajoutés ou allongés (`test-results/e2e-report.json`, ≤ 20 s), gain de 04, bilan net
  (RK-e2e), occurrences de DS-flaky ; durée du job « Browser journeys ».
- `0201` sur `staging` : job « Migrate staging » vert ; comptes de lignes des quatorze tables lus en
  lecture seule (`runbooks/staging.md`).
- `21` §8 : retirées les lignes RK-fin, PLS-1, PLS-3, PLT-6, SNT-3, J4S-7, RK-e2e si la marge tient,
  et, après vérification, J9S-6, J9S-7, J9S-9, J9T-5, J9T-8, J9T-9, SNT-1 (EC-L2A-1, sha de PL) ;
  constats « avant production » et « plus tard » de la revue ajoutés ; une ligne de clôture L2A.
- `04` §4.2 : lignes `comment_bands` et bornes de `publication_frequencies` ; amendements listés par
  08 ; écarts `EC-L2A-*` regroupés en fiche (documentation groupée).
- Pas de `git mv` (autres sessions) : `docs/mvp/jalons/l2a-fiche.md` et `docs/mvp/jalons/l2a/` vers
  `docs/mvp/archives/jalons/` par `mv`, puis `git add` des seuls chemins concernés dans la commande du
  commit.
- Revue sans bloquant : commit d'attestation séparé (`git commit --allow-empty -F <fichier>`), texte
  produit par la revue, `covers` des sha de 03 et 09 et de tout `fix` touchant un fichier I-4.
**Prouver :** dernières lignes de `pnpm check` et des trois `pnpm test:e2e` ; CI verte après push.
**Arrêt si :** un passage e2e rouge ; ajout e2e > 20 s ou job ≥ 8 min (levier ou arbitrage, `21` §2.3).
