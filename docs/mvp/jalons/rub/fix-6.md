# RUB-fix-6 — `fix(web): a busy dialog stays open after any number of Escape presses`
Grille `dev-react-node`. RUBT-2 (jalon).
**Lire :** annexe § Revue (RUBT-2) ; fiche, invariants 7, 8, 10 ; `U/use-modal-dialog.ts` (101 l., tout) ; appelants
du crochet : `U/Dialog.tsx` l. 40-62, `FiltersDialog.tsx` l. 57-61, `MediaGallery.tsx` l. 197-202 (ces deux-là
toujours `dismissible: true`) ; `PB/dialog.board.tsx` l. 181-205 (cellule `dialog/busy`) ;
`e2e/state-board.spec.ts` l. 1124-1134 (RUB-T7).
**Constat :** Chromium cesse d'honorer `preventDefault` de `cancel` sans nouvelle activation ; au 3e `Échap`, l'élément se
ferme et `onNativeClose` (l. 83-87) appelle `onClose` pendant la requête ; si l'écran garde `open` vrai, l'élément reste
fermé et l'effet (l. 43-59) ne le rouvre pas.
**Livrer :**
- `dismissible` faux : `Échap` bloqué au `keydown` sur l'élément ; sur `close` natif, `showModal()` refait et focus rendu à
  l'élément qui l'avait (sinon au titre), **sans** appeler `onClose`. `dismissible` lu par la même référence que `open`.
- `dismissible` vrai : comportement inchangé (un `onClose` par geste) pour `Dialog`, `FiltersDialog`, `MediaGallery`.
- Commentaire de tête du crochet à jour (la règle de Chromium, en une phrase).
**Ne pas toucher :** `TermsDialog`, `Dialog.tsx` hors besoin, textes, tokens, `apps/web/e2e/case-floors.ts` et tout
fichier non commité de la session R2B (`git status`) ; `git add` de vos seuls chemins.
**Prouver :** dans le cas RUB-T7 existant (aucun cas neuf, budget RUBT-1) : trois `Échap` de suite sans clic entre eux,
le dialogue occupé reste visible et `open` ; puis « Terminer l'envoi » le ferme et le focus revient à l'ouvreur. Rouge
avant le correctif (2/2 attendu), vert après, trois exécutions. `pnpm check:fast` ;
`pnpm --filter @influx/web exec playwright test state-board --reporter=line`.
**Arrêt si :** le `keydown` ne suffit pas et la réouverture fait clignoter le dialogue (le dire, avec la mesure) ; une
assertion existante devrait changer.
