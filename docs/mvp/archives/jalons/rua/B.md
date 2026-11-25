# RUA-B — arbitrage `architecte` : `rua/modele-archi.md`
Grilles `architecte`, `integrateur` (CI), `expert-cybersecurite` (§6).
**Lire :** fiche ; Lectures, ligne B ; `20` §11.5 (l. 740-756, halo) ; `GK` l. 1186-1230, 1861-1960.
**Livrer :** `docs/mvp/archives/jalons/rua/modele-archi.md`, 10 Ko au plus ; par point : choix, *M.* = motif.
1. RU-03 : `--breakpoint-form` 640 (`@theme`, G3e permet l'ajout) et `bo-wide` 1536 (`@custom-variant` dans `BO`) ;
   ordre des variantes ; garde backoffice l. 515-538 (deux variantes dans un fichier).
2. RU-18 : deux implantations, mêmes noms et props (`02a` §0) ; rien dans `packages/ui`.
3. RU-20 : seul module autorisé à lire la taille, page montée gardée, exception écrite de la garde ; texte pour
   `20` §11.8 et `17b` §1.7 (appliqué en RUC-08).
4. RU-04 : forme des tokens `--effect-photo-*` : littéral `rgb(… / N%)` dans `TS` (G3i intacte) ou `color-mix`
   avec extension de G3i ; où ils sont déclarés ; qui les lit.
5. RUA-03 : projet Playwright `visual` (`testIgnore` de `chromium`), fichiers, échantillon en CI ou exécution locale
   seule, planchers (`check-case-floors` : spec sans plancher ou plancher sans spec = échec, rapport fusionné
   compris), démarrage sans serveur pour la maquette seule (modèle `E2E_HEADINGS_FROM`), référence écrite dans
   `test-results/` sans dépendance (`toHaveScreenshot`, `snapshotPathTemplate`), jamais committée.
6. RUA-05 : planche d'états hors production : mécanisme (`pageExtensions` selon un environnement lu dans
   `src/config`, rendu statique par Vitest…), G8 (`data-theme` hors des seules mises en page), règle `process.env`
   d'ESLint, preuve sur l'artefact ; extension au backoffice (RUC).
**Ne pas toucher :** code ; `02` ; `decisions.md`.
**Prouver :** aucune dépendance nouvelle ; chaque choix cite sa garde ; `wc -c` ≤ 10 240.
**Arrêt si :** dépendance, D70, I-4, ou un point qui change un invariant de la fiche.
