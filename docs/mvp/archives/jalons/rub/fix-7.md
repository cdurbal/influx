# RUB-fix-7 — `fix(web): the date field keeps its typed text when a bound changes`
Grille `dev-react-node`. RUBT-3 (jalon).
**Lire :** annexe § Revue (RUBT-3) ; fiche, invariants 5, 8 ; `U/DateField.tsx` ; `U/date-field-format.ts` l. 76 et
suivantes (`readDateText`) ; `PB/choice.board.tsx` l. 540-585 (`DateDemo`) ; `e2e/state-board.spec.ts` l. 759-765,
985-1013 (RUB-AN2 06) ; `tests/member-choices.test.ts` (`Grep "date"`).
**Constat (reproduit) :** `min=2027-02-01`, saisie `01/01/2027`, refus ; `min` passe à `2026-12-01` : champ vidé, erreur
disparue, valeur `null`, `onChange` non appelé. Cause l. 74-82 : brouillon réinitialisé dès que sa lecture diffère de `value`.
**Livrer :**
- Brouillon réinitialisé seulement si `value` a changé depuis le rendu précédent **et** diffère de la lecture du
  brouillon (la valeur émise par la frappe ne réécrit jamais le texte tapé ; une remise à zéro par l'écran, si).
- `min` ou `max` change avec un brouillon : relu, valeur émise par `onChange` (ISO ou `null`) dans un effet, refus
  recalculé (levé si la date entre dans les bornes, `range` si elle en sort et que le champ a été quitté).
- Règle de décision en fonction pure dans `date-field-format.ts`.
**Ne pas toucher :** `DateFieldProps`, textes, tokens, autres champs, `apps/web/e2e/case-floors.ts` et tout fichier
non commité de la session R2B (`git status`) ; `git add` de vos seuls chemins.
**Prouver :** unitaires de la fonction pure dans `member-choices.test.ts` (constat, frappe qui émet, remise à zéro,
borne qui fait sortir), plancher relevé dans `apps/web/tests/case-floors.ts`. Planche : cellule `date-field/bounds`
(bouton qui déplace `min`) ; scénario du constat ajouté au cas RUB-AN2 06 (aucun cas neuf), rouge avant, vert après.
`pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test state-board --reporter=line`.
**Arrêt si :** il faut changer `DateFieldProps` ou un appelant produit.
