# L2F-fix-1 — `fix(web): code of a verification opened by an agent`
Grille `dev-react-node`. Skill : `design-system-influx`. L2FU-1 (bloquant) ; L2FU-2 selon la réponse ci-dessous.
**Lire :** `l2f/ux-constats.md` l. 32-43 (font foi, sauf ici) ; fiche § Invariants 13, 15, 16 ; `recette.md` l. 5 ; `verification-view.ts` l. 350-370, 386-410 ; `OwnershipScreen.tsx` l. 358-421 (`CodeStep`), 491-527 (`ConfirmStep`) ; `VerificationLineState.tsx` l. 118-157 ; `brand-verification-view.ts` l. 151, 186-205 ; `BrandVerificationScreen.tsx` l. 420-460, 616-649. Le code vivant est déjà servi (`verification/repository.ts` l. 222, `brand-service.ts` l. 136).
**Livrer (L2FU-1) :**
- Bloc du code de `CodeStep` (consigne, où, code, Copier, « valable jusqu'au ») extrait et rendu aussi dans `ConfirmStep` si la demande `requested` porte un code vivant ; textes `ownership.confirm.*` gardés, aucun ne dit qui a ouvert.
- `ownershipActionOf` : `see` pour `requested` à code vivant (`line.cta.see`, lien vers le parcours), sinon `null`.
- Marque (repli TXT) : même bloc dans `SentStep` ; `brandBlockOf` : `see` (`brandBlock.cta.see`, « Voir la demande » · "See the request").
- Règles en fonctions pures ; FR et EN en miroir.
**Question au fondateur (L2FU-2) :** aucun rôle membre ne lit `badge_reminder_days` ni `reminder_sent_at` (`0221` l. 1135, `0237`) : l'écran ignore la fenêtre J-15. **A** : migration `0240` (lecture du réglage comme `0237`, I-4), `renewable` sur `OwnBadge`, bouton dès J-15, « Vous pouvez dès maintenant » ; ligne en opus high. **B**, sans migration : « Rafraîchir » sur tout badge `active` à échéance, que la base ouvre déjà (EC-L2E-06-5), contre `modele.md` §3 (« dans la fenêtre de rappel »). **C** : avant production, rien ici. Sans réponse : C.
**Écartés :** origine à l'écran (`openedBy` non servi au membre) ; L2FU-11 (migration, avant production) ; L2FU-7 à 24.
**Ne pas toucher :** API, contrats, base (sauf A), `packages/domain`, `tokens.css`, backoffice.
**Prouver :** unitaires `verification-view` (+2 : `see` à code vivant, `null` sans) et `brand-verification-view` (+1), planchers tenus ; e2e : un cas FR de `verification-lifecycle.spec.ts` étendu (demande `pending` à code amorcée en base : « Voir la demande », code et Copier à l'étape 3), ≤ + 1 s ; `pnpm check:fast` ; `pnpm --filter @influx/web exec playwright test verification-lifecycle.spec.ts --reporter=line`.
**Arrêt si :** route, contrat ou token requis (hors A).
