# L2D-fix-2 — `test(e2e): brand profile reloads once its draft is stored`
Grille `testeur`. L2DT-1 : fiche § Revue ; `l2d/revue-constats-testeur.md` l. 11. Ferme aussi la mesure de L2DT-2 (cache chaud).
**Lire :** `apps/web/e2e/brand-profile.spec.ts` l. 24-41 (`savedLine`, `profileStatus`), 134-182 ; `creator-profile.spec.ts` l. 31-60, 376-389 (`storedOf`, `expect.poll`) ; `components/brand-profile/use-brand-profile.ts` l. 41, 322-350 (`SAVE_DELAY_MS`, minuterie) ; `0202` l. 192-202 (`advertiser_topics`).
**Livrer :**
- Avant le `reload` de l. 170 : `expect.poll` sur l'état stocké (secteur, site, thématiques `beauty` et `fashion`, fonction), rôle de migration, connexion fermée, forme de `storedOf`.
- Autres suites `savedLine` puis `reload` du fichier (`Grep`) : même attente si l'état rechargé dépend d'une saisie différée ; sinon rien, dit.
- `savedLine` reste asserté (RG83) ; aucune assertion retirée ni affaiblie.
**Ne pas toucher :** code de production, `SAVE_DELAY_MS`, autres specs, planchers, `ci.yml`.
**Prouver :** course reproduite avant le correctif (copie locale jetable, jamais commitée : pauses de 700 ms entre les saisies, ou `PATCH` retardé), rouge, puis verte avec le correctif ; sinon le dire ; `pnpm --filter @influx/web exec playwright test brand-profile.spec.ts --repeat-each=5 --reporter=line` vert ; durée du fichier avant et après (≤ + 1 s) ; `pnpm check:fast`. Push, run de ce commit : « Browser journeys » vert au premier essai, cache chaud (journal), chaque éclat ≤ 450 s de job, ids notés.
**Arrêt si :** l'état ne se lit pas sans droit neuf ; une autre cause apparaît (la dire, rien d'autre) ; un éclat > 450 s à cache chaud : ligne `B` de type `fondateur` après `fix-2`, question exacte (« constater N s, ou levier L, gain G s »), rien décidé.
