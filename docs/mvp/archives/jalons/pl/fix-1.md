# PL-fix-1 — `test(e2e): DS-10 waits for the admin home reads before handing over`

Grille `testeur`. Constat PLT-1 (et PLS-4, côté test) : `jalons/pl/revue-constats.md`.

**Lire :** `apps/web/e2e/backoffice.spec.ts` l. 1157-1233 (DS-10, DS-12b) ;
`e2e/support/backoffice.ts` l. 111-143 (`onlyAdmin`) ; `apps/backoffice/src/components/HomeScreen.tsx`
l. 256-334.

**Constat :** DS-10 rend la main après axe ; `readAlerts` (l. 276) tourne encore côté serveur quand
`onlyAdmin` de DS-12b désactive Inès : `new_browser_sign_ins` refuse (42501 voulu), 500 (33 lignes
`/v1/bo/alerts` dans `ops.error_occurrences` de la pile locale).

**Livrer :**
- DS-10, avant axe : région « Alertes » (`getByRole("region", { name: m.home.alertsTitle })`) sans
  `m.common.loading` ni `m.home.alertsError` ; plus aucun `m.common.loading` sur la page.
- Même examen du cas qui précède les deux autres `onlyAdmin` (l. 616 après J8T-4, l. 1113 après
  TN8) : attente ajoutée seulement s'il quitte un écran d'admin pendant une lecture.

**Ne pas toucher :** aucune autre assertion ; `HomeScreen.tsx`, `actions-routes.ts` (PLT-2, avant
production) ; aucun `retries`, `timeout`, `waitForTimeout` ; aucun fichier I-4.

**Prouver :** `pnpm check:fast` ; trois `pnpm test:e2e` de suite verts sans rejeu, aucune ligne
`route = '/v1/bo/alerts'` gagnée dans `ops.error_occurrences` (compte avant et après dans la
réponse) ; durée de DS-10 avant et après (`test-results/e2e-report.json`).

**Arrêt si :** l'attente ajoute plus de 2 s à DS-10 (lecture lente hors course : la tracer, ne pas
l'optimiser) ; une ligne `/v1/bo/alerts` apparaît encore.
