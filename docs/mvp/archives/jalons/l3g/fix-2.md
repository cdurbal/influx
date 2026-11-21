# L3G-fix-2 — `fix(api): a lock timeout answers 429 on every search door`
Grille `dev-react-node`. Skill : `test-strategy`.
**Lire :** `annexe.md` § Revue, constats L3GS-1 et L3GT-2 ; `apps/api/src/platform/errors.ts` (`classifyError`,
l. 126 ; `RetryLaterError`) ; `apps/api/src/domains/search/shortlists/routes.ts` l. 91 et
`selection-requests/routes.ts` l. 70 (la traduction existante) ; `creator-search/routes.ts` l. 70-87,
`creator-search-profile/routes.ts` l. 66-81, `open-campaigns/routes.ts` l. 59-70 ; `0327` en-tête l. 20-22
(sept portes à `lock_timeout` 1 s) ; `decisions-detail.md` `Grep "^## D85 "` (1) ;
`db-tests/search-shortlists.test.ts` l. 1303 (gabarit : seconde connexion qui tient le verrou consultatif).
**Livrer :** un seul endroit pour la traduction : dans `classifyError`, une 55P03 portant le message de délai de
verrou de PostgreSQL (« canceling statement due to lock timeout », pas les 55P03 `no_live_claim` des files, déjà
traduites avant) devient `RetryLaterError("rate_limited", 1)`, soit 429 `rate_limited` avec `Retry-After: 1` ;
supprimer les traductions locales devenues doublons seulement si le test de chaque route les couvre. Aucune
route ne répond plus 500 `internal_error` à un délai de verrou, et `ops.recordServerError` n'est pas appelé pour ce cas.
**Ne pas toucher :** la base (aucune migration), les droits, les routes de L3G (identified-search, files, réglages),
le débit par adresse de `member-rate.ts`, l'anti-énumération (404 identiques).
**Prouver :** un test de route par porte à verrou : recherche de la marque, ouverture de profil, flux des campagnes du
créateur, sélections (`search-shortlists-route.test.ts`), demande à l'équipe (`selection-request-route.test.ts`), chacun avec
une connexion tierce qui tient le verrou du compte dans une transaction ouverte (rendez-vous par verrou, jamais
`sleep`) et l'attente de 429 + `Retry-After: 1` + enveloppe filtrée + aucune ligne d'erreur journalisée ;
un cas unitaire de `classifyError` (55P03 de délai de verrou → 429 ; 55P03 d'une autre cause → inchangé) ;
planchers relevés ; `pnpm check:fast` ; `pnpm --filter @influx/api test:db -- <fichiers des cinq routes>
--reporter=dot` ; toute la suite base si un fichier partagé change. Commit : signaler I-4 (gestion d'erreurs de l'API).
**Arrêt si :** la traduction globale rend un 429 pour une 55P03 qui n'est pas un délai de verrou, ou si une route
a besoin d'une migration.
