# R2A-R — revue groupée de fin de jalon
Plage : `<parent de 00>..HEAD`. Deux rapports de **10 Ko au plus** : détail complet (fichier, ligne, scénario, correctif) pour « bloquant » et « jalon » ; **une ligne** pour « avant production » et « plus tard ». Synthèse reportée dans `r2a/annexe.md` § Revue ; une ligne `fix-n` ajoutée dans `r2a/run.md` par constat bloquant ou jalon.

## Pour `testeur` (`flash` · `high`) — constats `R2AT-n`
- Invariants 6, 8, 9, 11 : chaque preuve `R2A-T1` à `R2A-T5` au bon niveau, planchers relevés dans `packages/test-kit/tests/case-floors.ts` et `apps/api/tests/case-floors.ts` ; aucune assertion retirée dans le diff.
- `s3-double` (`R2A-T1`) : vérification effective SigV4 + `x-amz-content-sha256` (pas un stub qui accepte tout), `412 PreconditionFailed` sur `If-None-Match: "*"`, `404 NoSuchKey` XML, `204` sur `DELETE`, isolation loopback.
- `schema.ts` & `staging:check` (`R2A-T4`, `R2A-T5`) : tout-ou-rien `worker` en `development`, parité `.env.example` et `staging.md` (`namesNotRead` vide), cas négatifs sur préfixe, `.eu.` en `staging` et jetons `api` = `worker`.
- Playwright E2E (`R2A-T3`) : budget ≤ +2 s mesuré, `assertNoNewErrors` vert, aucun flocon introduit (`DS-flaky`).
- Diff strictement vide sur `apps/api/src/platform/storage.ts`, `supabase/`, `packages/contracts/`, `packages/web-platform/`, `apps/web/src/`, `apps/backoffice/src/`.

## Pour `expert-cybersecurite` (`pro` · `high`) — constats `R2AS-n`
- Invariants 2, 3, 5, 10, 11 : zéro `INFLUX_ENV === "production"` dans `schema.ts` (`T17`) ; refus absolu de tout hôte `*.r2.cloudflarestorage.com` en `development` (`RG148`) ; `R2_SECRET_ACCESS_KEY` ≥ 32 o, sans `CHANGE_ME`, distinct de `R2_ACCESS_KEY_ID` et de tous les secrets du processus.
- Étanchéité des secrets (`env-secrets`, `T11.1`) : `"R2_"` dans `BROWSER_FORBIDDEN_NAMES`, `pnpm -r run test:artifacts` vert ; `staging-check` n'imprime jamais aucune valeur `R2_*` ; aucune vraie clé dans le dépôt ni `playwright.config.ts`.
- Sécurité `s3-double` : écoute `127.0.0.1` uniquement, aucune fuite réseau.
- Portes RGPD et `eu` (`CA20`) : DPA Cloudflare, registre, `RU-30`, juridiction `eu` et contrôle `J9S-1` présents dans `21` §5.8 et `runbooks/production.md`.
- **Marqueur I-4** : vérifier diff vide sur `supabase/config.toml`, `.github/workflows/`, `next.config.ts`, `migrations/` ; rejouer `node packages/test-kit/scripts/check-security-review.ts` sur la plage (aucune attestation requise en `R2A`).
