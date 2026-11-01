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
- Revue sans bloquant (fiche § Revue) : commit d'attestation séparé, texte de § Attestation.
- Constats « avant production » et « plus tard » : au reliquat de `21` §8, lignes de § Reliquat.

**Prouver :** dernières lignes de `pnpm check` et de `pnpm test:e2e` ; CI verte après push.

## Attestation

Commit vide (`git commit --allow-empty -F <fichier>`), texte recopié tel quel, si `fix-1` et `fix-2`
ne touchent aucun fichier I-4 (`check-security-review.ts`, `SECURITY_PREFIXES`, `SECURITY_FILES`) ;
sinon, leurs sha s'ajoutent à la ligne `covers`.

```
chore(security): attest the end-of-PL review

Group review of 2026-10-31 (expert-cybersecurite) over the PL milestone
(48e1b44..ec87b56). PL-09: relay.ts, api-client.ts, config/server.ts and
relay-client.ts differ from their bf1724f copies by comments only; the
route file is identical in both fronts and only swaps its import; PP-12
pins on the bytes where they live; package exports frozen without the API
client nor the configuration; one secret per front process (D64); fetch
and process.env exceptions only in packages/web-platform/eslint.config.mjs
(probed); importer chain, absence and export guards green; I-4 follows the
package. CSP sources untouched; data-hydrated set by a client effect, no
inline script; no server name in .next/static (T11 green on both builds).
PL-08: tokens and fonts moved byte for byte, no new external dependency in
the lockfile. PL-04a: 0151 restates the 0141 CHECK but one predicate. PL-03:
/health keeps an empty body and no-store; browser error text stays inert.
GET /v1/bo/alerts 500: deliberate 42501 of new_browser_sign_ins after a
concurrent admin deactivation, no missing grant. Watched: PLS-1 to PLS-9.

security-reviewed: 2026-10-31
security-reviewed: 2026-10-31 covers b423c80 6fe6e48

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Reliquat

Lignes à ajouter à la table du reliquat de `21` §8 (détail : `archives/jalons/pl/revue-constats.md`).

*Avant production :*

| PLS-1 | `next` ≥ 16.4.1 (16.4.2), `zod` ≥ 4.6.6, épingles de `packages/ui` comprises (`pnpm audit --prod` : deux critiques, deux élevées) ; commit de dépendance, suite complète | Ouverture du Lot 2 (avant production) | `archives/jalons/pl/revue-constats.md` |
| PLS-2 | T12 : audit des dépendances qui échoue sur critique ou élevée (T12.1), hebdomadaire et CI, dérogations datées (T12.3, T12.4) | Avant production | idem |
| PLT-2 | `/v1/bo/alerts` : refus délibéré 42501 `forbidden` en 401 (cookie effacé, PLS-4) au lieu de 500 ; test db qui désactive le profil entre résolution et appel | Avant production | idem |
| PLT-5 | Fonction 2V de `0141` (EC-PL-04a-1) : migration `@.value.type() != "string"`, test db « payload 2V refusé à la création » ; avec PLS-5 et PLS-6 | Avant production | idem |

*Plus tard :*

| PLT-4 | `run-tests.ts` : ne compter comme fichier qu'un argument existant ou en `.ts` ; `shell: true` sous Windows (= PLS-9) | Plus tard | idem |
| PLT-6 | `status-cache.ts` : échéance à la fin de l'appel, `pending` partagé, `try` autour de `load()`, deux cas | Plus tard | idem |
| PLT-7 | `ci.yml:305` : commentaire « About 45 s locally » remplacé par la mesure de PL-12 | Plus tard | idem |
| PLS-3 | `/health` de `apps/web` : ne jamais mettre en cache un 429 (avec PLT-6) | Plus tard | idem |
| PLS-4 | `/v1/bo/alerts` : 42501 `forbidden` → 401, cookie effacé (côté test : `fix-1`) ; avec PLT-2 | Plus tard | idem |
| PLS-5 | `@.value.type() != "string"` dans la prochaine migration de la fonction 2V (= PLT-5) | Plus tard | idem |
| PLS-6 | `0151` : faille lax de `brevo_list_ids` et `brevo_template_ids`, même migration que PLT-5 | Plus tard | idem |
| PLS-7 | « Santé technique » : mention « source navigateur, texte non vérifié » sur la pile et la page | Plus tard | idem |
| PLS-8 | `SECURITY_FILES` : `packages/web-platform/eslint.config.mjs` et `eslint.front-rules.mjs` | Plus tard | idem |
| PLS-9 | = PLT-4 | Plus tard | idem |
