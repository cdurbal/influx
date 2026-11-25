# RUA-fix-2 — `chore(security): attest the end-of-RUA review`
Grille `integrateur`. Origine : `annexe.md` § Revue, RUAS-1 (constat de jalon, non bloquant) ; revue du 2026-11-25.
**Lire :** `annexe.md` § Revue (RUAS-1) ; `packages/test-kit/scripts/check-security-review.ts` l. 24-34 (attestation),
59-65 (`SECURITY_PREFIXES`) ; `.github/workflows/ci.yml` l. 127-142 (`I4_ANCHOR`) ; `git show 7ca8c35` (gabarit).
**Livrer :**
- Un commit vide (`git commit --allow-empty`) au titre imposé ; corps de 8 lignes au plus : revue groupée RUA du
  2026-11-25 sur `a37a8ea..b3d20e2`, 0 bloquant ; 596c18c revu sain (planche hors production, drapeau posé au seul
  build e2e de `ci.yml`, `stateBoardConfig` dans `next.config.ts`) ; RUAS-2 à 5 au reliquat.
- Puis les deux lignes, dans cet ordre : `security-reviewed: 2026-11-25` (marqueur simple, exigé de toute
  attestation, l. 27-28) et `security-reviewed: 2026-11-25 covers 596c18c8adb47cca28799aad3a422cd828dc2fed`
  (SHA complet, `git rev-parse 596c18c`) ; ligne `Co-Authored-By` habituelle.
**Ne pas toucher :** aucun fichier (`annexe.md` et `revue.md` déjà corrigés par R) ; jamais de réécriture de `main`
(ni `--amend` d'un commit poussé, ni `rebase`) ; les commits `fix(ops)` d'une autre session.
**Prouver :** avant le commit,
`node packages/test-kit/scripts/check-security-review.ts HEAD~1 HEAD 56b8046083f809ac82399e994f0415d12afc2188`
sort en 1 et n'énumère que 596c18c ; après, la même commande sort en 0 ; `git show --stat HEAD` : aucun fichier.
**Arrêt si :** la commande énumère un autre SHA que 596c18c (le rapporter, ne rien attester sans revue) ;
596c18c n'est pas ancêtre de `HEAD`.
