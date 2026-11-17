# L3C-X6 — `test: L3C specs remove their campaigns, queue 7 cases read their own`
Grille `dev-react-node`. L3CT-1 : annexe § Revue (fait foi). Tests seulement. Opus `high` : six
fichiers de test, ordre de retrait contraint (clés étrangères, lignes immuables), risque de toucher
les lignes d'autres runs.
**Lire :** `apps/api/db-tests/campaign-routes-kit.ts` l. 194-238 et `campaign-review-kit.ts`
l. 316-326 (ordre de retrait, fait foi) ; `apps/web/e2e/support/backoffice.ts` l. 24-60, 118-133 ;
`support/campaign-review.ts` l. 60-146, 212-250 ; `support/campaign-states.ts` l. 20-121 ; en-tête et
`afterAll` des quatre specs ; `t14-campaign-review-route.test.ts` l. 116-150, 317-343 ;
`campaigns-review-queue.test.ts` l. 40-60, 221-250, 435-445.
**Livrer :**
- un seul assistant de retrait dans `apps/web/e2e/support/`, calqué sur le kit base : lignes filles,
  pointeur d'instantané, instantanés, interventions, entrées de file 7, campagnes, puis
  `leads.outbox_events` de sujet `account:<id>` ; une transaction, rôle de migration ; aucun
  déclencheur désactivé ; registre (`audit.*`) intact ;
- périmètre : les seuls comptes annonceurs créés par la spec dans ce run (identifiants recueillis à
  la création) ou les campagnes au titre portant le `runTag` du run ; aucun `delete` sans liste
  d'identifiants, aucun motif qui attrape un autre run ;
- appelé dans le `test.afterAll` de `campaign-review`, `campaign-record`, `brand-campaign-states` (à
  côté de `retireInternals`) et d'un `afterAll` neuf de `brand-campaign.spec.ts` ; corps des cas
  inchangés hormis le recueil d'un identifiant ;
- t14 l. 327 : `${BO_ENTRIES}?owner=${holder.accountId}&limit=50` ; l. 330 et attendus inchangés ;
- `campaigns-review-queue.test.ts` l. 435 : même titre, même attendu, borné aux campagnes du jeu de
  données (`CAMPAIGN_IDS`, annonceurs de `testDataSet`), après `submittedA` dans le même scénario
  (au moins une `pending_review` lue : le cas cesse d'être vacuous).
**Ne pas toucher :** produit, `supabase/**`, nombre de cas et planchers, comptes membres et agents.
**Prouver :** `pnpm check:fast` ; `pnpm --filter @influx/api test:db -- --reporter=dot` (suite
entière, D76) sur la base locale telle quelle, avant toute purge : t14 l. 318 et cas l. 435 verts ;
`pnpm --filter @influx/web exec playwright test e2e/campaign-review.spec.ts e2e/campaign-record.spec.ts e2e/brand-campaign-states.spec.ts e2e/brand-campaign.spec.ts --reporter=line`,
trois fois : nombre de campagnes et d'entrées `open` de file 7 identique avant et après ; durée des
cas (médiane de trois) E1 ≤ 7,6 s, E2 ≤ 5 s, E3 ≤ 5 s, `brand-campaign.spec.ts` ≤ 25 s, L3C ≤ 18 s ;
durée des `afterAll` notée à part.
**Commit :** un seul ; `git add` nominatif, jamais `-A` ; `--cached --name-only` = l'assistant, les
quatre specs, les deux tests base, `run.md`. Purge de la base locale : hors commit, à la main, après
le commit. Note : médianes e2e. Dernière ligne : `ETAT`.
**Arrêt si :** un retrait exige un déclencheur désactivé, un droit ou une migration ; une ligne hors
périmètre serait touchée ; un attendu change ; une spec dépasse son plafond.
