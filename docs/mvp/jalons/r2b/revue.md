# R2B-R — revue groupée de fin de jalon
Plage : `<parent de 01>..HEAD`. Deux rapports de **10 Ko au plus** : détail complet (fichier, ligne, scénario, correctif) pour « bloquant » et « jalon » ; **une ligne** pour « avant production » et « plus tard ». Synthèse reportée dans `r2b/annexe.md` § Revue ; une ligne `fix-n` ajoutée dans `r2b/run.md` par constat bloquant ou jalon. Aucun fichier modifié.

## Pour `testeur` (`carbon` · `high`) — constats `R2BT-n`
- Invariants 1, 7, 9 : preuves `R2B-T1` à `R2B-T6` au bon niveau ; planchers relevés dans les 4 `case-floors.ts` ; aucune assertion retirée ni affaiblie dans le diff.
- `storage-r2.test.ts` : vecteur AWS officiel comparé au caractère, flux borné avec **et** sans `Content-Length`, `invalid_key` sans requête (compteur de requêtes de la doublure).
- `db-tests` : `CA4`–`CA7`, `CA10` réellement provoqués par `queue()` (pas simulés côté code) ; purge sur les 3 compartiments ; 5 suites SQL Cat. B intactes ; durée des éclats `db` ≤ `7 min 30`.
- E2E : 3 passes vertes, delta ≤ `+3 s`, `/_double/reset` jamais appelé en parallèle, `DS-flaky`.
- Seed : `--reupload-images` sans appel GoTrue ni suppression, `412` → `skipped`, `--dry-run` sans écriture.
- Constats `05` présents, horodatés, sans secret ; diff vide sur `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/`, `package.json`, `pnpm-lock.yaml`.

## Pour `expert-cybersecurite` (`neon` · `xhigh`) — constats `R2BS-n`
- Invariants 2–6, 8 : signeur SigV4 (chaîne canonique, en-têtes signés, `UNSIGNED-PAYLOAD` absent, horodatage), `isObjectKey` avant toute URL (anti-SSRF, `T9.3`, `T9.9`), hôte = origine de `config.r2.endpoint` seule.
- `D60` : corps d'erreur lu ≤ 8 192 o, `<Code>` seul ; ni `<Key>`, `<Message>`, URL, `Authorization`, `R2_*` dans retours, `pino` ou `ops`.
- `T9.2`, `T9.6`, `T9.7` : zéro présignature, zéro `ListObjectsV2` dans `apps/api/src/` ; témoins `r2.cloudflarestorage.com`, `r2.dev`, `x-amz-` effectifs.
- Mémoire : annulation du flux au premier octet excédentaire (`RG9`).
- `stagingR2()` : refus `production`, `.eu.`, préfixe ; aucune valeur affichée.
- **Marqueur I-4** : aucun fichier déclencheur attendu ; rejouer `node packages/test-kit/scripts/check-security-review.ts <parent de 01>`.
