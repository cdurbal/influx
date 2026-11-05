# L2C-fix-1 — `test(api): queue fixtures isolated from earlier runs and other files`
Grille `testeur`. Constats L2CT-1, L2CT-6, L2CT-7 : fiche § Revue, `l2c/revue-constats-testeur.md`.
**Lire :** `apps/api/db-tests/t14-backoffice-queue-route.test.ts` l. 53-60, 155-170, 453-556 ;
`profiles-brand-route.test.ts` l. 206-271 ; `profiles-brand-logo-route.test.ts` l. 222-262 ;
`tm1-member-account-route.test.ts` l. 186-227 ; `0210` l. 395-452 (RG25 : nom normalisé, toute la base).
**Livrer :**
- L2CT-1 : noms de fixture à alphabet large (chaque caractère hexadécimal mappé sur `g`-`v`, aucune
  suite de chiffres, RG19), `newBrand` et `uniqueName` (l. 163, 491) ; en `afterAll`, profils publiés
  de la fixture renommés (nom et domaine inertes, uniques) ou sortis de `published`.
- L2CT-6 : `base` décalé d'un nombre aléatoire de secondes, fenêtre ramenée à ± 1 s (l. 56-60, 473).
- L2CT-7 : `afterAll` des trois autres fichiers : entrées `open` des comptes créés passées en
  `withdrawn` (`closed_at`), profils publiés traités comme en L2CT-1.
**Ne pas toucher :** code, migrations, attendus, planchers ; « two simultaneous openings » (l. 1052,
`fix-2`).
**Prouver :** t14 vert 9 fois de suite, puis 2 exécutions superposées vertes ; après une exécution de
chacun des quatre fichiers, aucune entrée `open` ni profil `published` de leurs comptes (requête et
compte dans la réponse) ; `pnpm --filter @influx/api test:db -- <les quatre fichiers> --reporter=dot` ;
`pnpm check:fast`.
**Arrêt si :** un rouge subsiste sans lien avec la pile ; le 401 des exécutions superposées vient du
code (cause nommée, rien corrigé).
