# Revue de fin du jalon PL — constats (2026-10-31)

Plage `48e1b44..ec87b56`. Revue groupée `testeur` + `expert-cybersecurite` (D71, D77) ; table courte
dans la fiche § Revue. Gravités : bloquant · dans le jalon · avant production · plus tard. Aucun
bloquant. Attestation de sécurité : `cloture.md` § Attestation.

## `testeur`

| Id | Gravité | Fichier:ligne | Constat | Correctif · traité par |
|---|---|---|---|---|
| PLT-1 | dans le jalon | `apps/web/e2e/backoffice.spec.ts:1157-1172` (DS-10), `:1174-1232` (DS-12b) | Le 500 de `GET /v1/bo/alerts` est une course entre deux tests, antérieure à PL-05 (22 occurrences dans `ops.error_occurrences` depuis le 2026-10-29, 33 au 2026-10-31 19:01 UTC ; SQL de `newBrowserSignIns` identique avant et après PL-05) : DS-10 rend la main dès le `h1` et ferme la page pendant que `readAlerts` (lancé au montage, `HomeScreen.tsx:276`) tourne encore côté serveur ; `onlyAdmin()` (`e2e/support/backoffice.ts:115`) de DS-12b désactive l'admin de DS-10 entre `resolve_session` et `new_browser_sign_ins`, qui refuse (42501 « forbidden », voulu). Reproduit 4 fois sur 7 passages complets, jamais en DS seuls ; durée inexpliquée de la requête (≈ 4 s contre 78-175 ms) | DS-10 attend la fin du chargement de l'accueil (région « Alertes » sans « Chargement… ») avant de rendre la main · `fix-1` |
| PLT-2 | avant production | `apps/api/src/domains/backoffice/actions-routes.ts:479-481`, `:824-833` ; `apps/api/src/domains/identity/backoffice-session.ts:73-107` | Un refus délibéré de la base (42501 « forbidden ») sort en 500 sur `/v1/bo/alerts`, alors que `runSensitiveAction` (`:126-155`) sait le distinguer (`isDeliberateRefusal`) | 401 ou 403 pour ce refus (PLS-4 : 401, cookie effacé) ; test db qui désactive le profil entre résolution et appel · reliquat `21` §8 |
| PLT-3 | dans le jalon | `apps/web/e2e/backoffice.spec.ts:83-87` (`afterAll`) ; `apps/api/db-tests/t14-backoffice-actions-route.test.ts:1380-1405` | Aucun test ne voit le 500 : il survient après la fin du test, le test db n'exerce que le chemin nominal, et rien ne compte les erreurs enregistrées pendant un passage e2e (22 occurrences sans alerte) | Garde-fou de fin de passage : échec si `ops.error_occurrences` a gagné une ligne depuis `globalSetup`, cas volontaires exclus nommément (aucun au relevé), sans durée notable (budget PL-13) · `fix-2` |
| PLT-4 | plus tard | `apps/api/scripts/run-tests.ts:20-21` | Un drapeau à valeur séparée (`-t motif`, `--reporter dot`) compte pour un fichier : suite entière sans contrôle des planchers (une ligne l'annonce) ; `spawnSync` `shell: true` sous Windows casse `-t "a b"` ; scripts `test` des fronts, `contracts`, `test-kit` au défaut d'origine (hors chemin prescrit, échec visible) | Ne compter comme fichier qu'un argument existant ou finissant par `.ts` (= PLS-9) · reliquat |
| PLT-5 | avant production | `supabase/migrations/0141_leads_apollo_excluded_countries.sql:379-382` (EC-PL-04a-1) | La fonction de vérification 2V garde la faille lax | Migration qui ajoute `@.value.type() != "string"` au prédicat ; test db « payload 2V refusé à la création » (avec PLS-5, PLS-6) · reliquat |
| PLT-6 | plus tard | `apps/web/src/server/status-cache.ts:16-21` | `expiresAt` posé au début de l'appel (un amont > 5 s laisse partir un second appel) ; un `load` qui lève de façon synchrone n'est pas rattrapé | Échéance à la fin de l'appel, `pending` partagé jusqu'à résolution, `try` autour de `load()`, deux cas (avec PLS-3) · reliquat |
| PLT-7 | plus tard | `.github/workflows/ci.yml:305` | Commentaire « About 45 s locally » périmé | Mesure de PL-12 (fiche § Mesure PL-12) · reliquat |

**Non couvert, noté :** `packages/ui` et `packages/web-platform` n'ont pas de tests propres (choix de
PL-07 point 3 : les fronts prouvent le paquet qu'ils servent) ; `HydrationMarker` n'est exercé que par
l'e2e.

## `expert-cybersecurite`

| Id | Gravité | Fichier:ligne | Constat | Correctif · traité par |
|---|---|---|---|---|
| PLS-1 | avant production | `apps/web/package.json:22`, `apps/backoffice/package.json:20`, `packages/ui/package.json:15,21`, `apps/api/package.json:33`, `packages/contracts/package.json:34` | `pnpm audit --prod` : `next` 16.3.6 (deux critiques GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr ; deux élevées), `zod` 4.6.5 (GHSA-mrhx-c7xc-m3w5), `sharp` 0.35.4 ; conditions d'exploitation a priori absentes (ni SVG, ni `use cache`, ni `remotePatterns`, ni Server Actions) | `next` ≥ 16.4.1 (16.4.2), `zod` ≥ 4.6.6, épingles de `packages/ui` comprises ; commit de dépendance avec suite complète dès l'ouverture du Lot 2 · reliquat |
| PLS-2 | avant production | `.github/workflows/weekly.yml:2,44` | T12 non implémenté : aucun audit de dépendances en CI | Audit qui échoue sur critique ou élevée (T12.1), hebdomadaire et CI, dérogations datées (T12.3, T12.4) · reliquat |
| PLS-3 | plus tard | `apps/web/src/app/health/route.ts:24-34`, `status-cache.ts:20` | Un 429 de portée adresse mis en cache devient un 503 pour tous pendant 5 s (impact nul aujourd'hui : Railway sonde `/fr` et `/`) | Ne jamais mettre en cache un 429 (avec PLT-6) · reliquat |
| PLS-4 | plus tard | `actions-routes.ts:828` ; `supabase/migrations/0138_backoffice_screen_reads.sql:192-200` | Aucun défaut de droits (EXECUTE au seul `influx_admin`, pas de `BYPASSRLS`, PL-05 écarté) ; même cause que PLT-1 | Route : 42501 `forbidden` → 401, cookie effacé (avec PLT-2) ; test : DS-10 attend la lecture des alertes (`fix-1`) · reliquat |
| PLS-5 | plus tard | `0141_leads_apollo_excluded_countries.sql:378-381` | EC-PL-04a-1 confirmé, non exploitable (contrat zod en amont, CHECK de `0151` en dernier) | `@.value.type() != "string"` dans la prochaine migration qui touche la fonction, cas db-test (= PLT-5) · reliquat |
| PLS-6 | plus tard | `supabase/migrations/0151_leads_apollo_basis_string_values.sql:61-72` | Même faille lax dans `brevo_list_ids` et `brevo_template_ids` (`{"x": []}`, `{"x": [null]}`), sans effet (écrivain validé par `jsonb_typeof`, `0145:349-352` ; lecteur qui échoue fermé) | Même migration que PLS-5 et PLT-5 · reliquat |
| PLS-7 | plus tard | `apps/backoffice/src/components/HealthErrors.tsx:98,128-138,237` | Pile et page d'une erreur navigateur affichées sans la mention « source navigateur, texte non vérifié » | Reprendre la mention (≈ 15 min) · reliquat |
| PLS-8 | plus tard | `packages/test-kit/scripts/check-security-review.ts:69` ; `packages/web-platform/eslint.config.mjs:57,67` | Les exceptions `fetch` et `process.env` du paquet et `eslint.front-rules.mjs` échappent à I-4 | Les ajouter à `SECURITY_FILES` · reliquat |
| PLS-9 | plus tard | `apps/api/scripts/run-tests.ts:21` | Même constat que PLT-4 | = PLT-4 · reliquat |

**Relevé de la pile locale** (rédaction des correctifs, 2026-10-31) : 34 lignes dans
`ops.error_occurrences`, 33 `server · api · DrizzleQueryError · /v1/bo/alerts` (trois groupes,
2026-10-29 16:04 à 2026-10-31 19:01 UTC), 1 `TypeError · /v1/status` (« t2 data set », jeu des
db-tests). Aucun cas e2e n'en écrit volontairement : J8T-4 bouchonne `/api/v1/bo/ops/errors*`
(`backoffice.spec.ts:538-574`), aucun cas n'appelle le collecteur d'erreurs navigateur.
