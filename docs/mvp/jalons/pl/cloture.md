# PL-C — `docs(mvp): close the PL milestone`

Grille `testeur`.

**Livrer :**
- Cases du critère de fin de la fiche cochées, chacune avec sa preuve (sha, mesure, commande) ;
  case non prouvée laissée ouverte et reportée dans `21` §8.
- `pnpm check` puis `pnpm test:e2e` verts (fin de jalon, D76) ; durée relevée.
- `21` §8 : lignes du reliquat soldées retirées ; budget e2e de PL-13 écrit dans `21` §2.3 ; une
  ligne de clôture du jalon PL.
- Pas de `git mv` (autres sessions) : `docs/mvp/jalons/pl-fiche.md` et `docs/mvp/jalons/pl/` vers
  `docs/mvp/archives/jalons/` par `mv`, puis `git add` des chemins dans la commande du commit ;
  `docs/mvp/revue-pre-lot2-2026-10-31.md` vers `docs/mvp/archives/` de même, renvois mis à jour.
- Si la revue n'a rien laissé de bloquant : commit d'attestation séparé, au texte de la revue.

**Prouver :** dernières lignes de `pnpm check` et de `pnpm test:e2e` ; CI verte après push.
