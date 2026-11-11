# L2F-fix-2 — `fix(backoffice): registry sources and dispute messages, ux findings`
Grille `dev-react-node`. Skill : `backoffice-ops`. L2FU-3 à L2FU-6 (jalon).
**Lire :** `l2f/ux-constats.md` l. 45-59 (font foi, sauf ici) ; fiche § Invariant 16 ; `RegistrySourceAdder.tsx` l. 150-300, 340-360 ; `RegistrySourceEditor.tsx` l. 95-110, 150-250 ; `RegistrySourcesScreen.tsx` l. 75-85, 280-300 ; `DisputeEntryScreen.tsx` l. 244-260 (erreur liée, le modèle), 290-331 ; `claimed-entry-view.ts` l. 195-240 ; `fr.ts` l. 2665-2690, 2796-2800.
**Livrer :**
- 3 : chaque `ErrorNotice` de champ a un `id`, joint à l'`aria-describedby` du champ avec celui de l'aide (ajout ×5, modification ×3), comme `DisputeEntryScreen.tsx` l. 247-259.
- 4 : panneau de relecture affiché : focus sur son titre (`tabIndex={-1}`) ; retour « Corriger » : premier champ en erreur, sinon « Voir la source à ajouter » ; de même dans l'éditeur.
- 5 : `claimedRefusalOf` (`claimed-entry-view.ts` l. 216) reçoit la file et choisit `handleMismatch` : la file 6 garde « exigez une nouvelle preuve », la file 5 dit « confirmez la décision avec le motif « Sans suite en l'état : nouvelle demande à déposer » » ; l. 2672, 2680, 2682 citent cet intitulé exact, repris de `outcomeLabels.new_request_needed`.
- 6 : `setAdding(false)` dans l'`onEdit` des sources actives (l. 296-299, comme l. 285-290) ; texte d'état vide passé à leur tableau (clé FR neuve, D36).
**Ne pas toucher :** API, contrats, base, web, `tokens.css` ; raccourcis (L2FU-17) ; L2FU-7 à 24.
**Prouver :** unitaires `claimed-entry-view` (message de la file 5 et de la file 6) et `registry-sources-view` si une règle y passe, planchers tenus, aucun attendu affaibli ; e2e : cas des sources de `verification-backoffice.spec.ts` étendu (focus sur le titre de la relecture, erreur jointe au champ par `aria-describedby`), ≤ + 0,5 s ; `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test verification-backoffice.spec.ts --reporter=line`.
**Arrêt si :** un message ne peut se choisir par file sans contrat ; un test existant devrait être affaibli.
