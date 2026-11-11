# L2G-R — revue groupée de fin de jalon (D71, `21` §0 règle 5)
Plage : du commit d'ouverture de L2G à HEAD (`git log --oneline` ; `0242` à la dernière migration du jalon).

## Pour `testeur` (sonnet high)
- Fiche § Tests : chaque identifiant existe, au plancher, vert ×3 ; aucun attendu affaibli (`git diff` des tests existants).
- TM5.5, T9.5 (octets), T9.10, T1 (T1.5) contre `18` l. 286-330, 643-664, 950 ; `18` §10 Lot 2 l. 1548-1560 : chaque case a sa preuve.
- e2e : somme des médianes des cas ajoutés, éclats CI, selon F0 ; DS-flaky noté.
- Sortie : `l2g/revue-constats-testeur.md`, constats `L2GT-n` (gravité bloquant, jalon, avant production, plus tard ; fichier:ligne ; preuve ; correctif proposé).

## Pour `expert-cybersecurite` (opus xhigh)
- Invariants 1, 2, 3, 8, 9, 10, 13, 14, 16 : droits annonceur (aucun, `USAGE` compris), `storage`, passe-plat (8 Mio sur la seule route), ré-encodage, clé d'objet, verrou et jeton, conflit d'intérêt, porte de soumission, gel des champs modérés, `change_member_role()`, lectures du worker (RG108), journaux (D60).
- Migrations `0242` à la dernière : marqueur I-4 à apposer (`security-reviewed: <date> covers <sha>…`, commit d'attestation, jamais de réécriture de `main`).
- Sortie : `l2g/revue-constats-securite.md`, constats `L2GS-n`, même format.

Un constat « jalon » ouvre une ligne `fix` dans `run.md` (arrêt pour validation du fondateur).
