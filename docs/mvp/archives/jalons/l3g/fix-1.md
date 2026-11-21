# L3G-fix-1 — `fix(backoffice): ux findings J1 to J8 of the identified search and queue 9`
Grille `dev-react-node`. Skill : `design-system-influx`.
**Lire :** `ux-constats.md` § Jalon (J1 à J8, avec fichier, ligne, scénario et correctif) ;
`apps/backoffice/src/components/` : `IdentifiedSearchScreen.tsx`, `IdentifiedResults.tsx`,
`identified-search-view.ts`, `team-selection-view.ts`, `SearchSettingsScreen.tsx`, `DualControlScreens.tsx`,
`queue-review-facts.ts` ; `apps/backoffice/src/messages/fr.ts`.
**Livrer :** les huit correctifs de `ux-constats.md` § Jalon, dans cet ordre, sans changer ce qui n'est pas
cité. Libellés FR dans `messages/fr.ts` (backoffice FR seul, D36) ; tokens seulement ; un test unitaire
par constat quand il porte une logique (J1 : facettes internes seules → message ; J3 : état « vidé » ; J5 :
table de libellés couvre tous les codes ; J6 : libellé court du motif ; J8 : valeur actuelle → demandée).
**Ne pas toucher :** les routes de l'API, la base, les invariants (marqueur de vue identifiée, blocage en phrase
seule, message en texte brut `dir="auto"`, aucun montant ni tarif), les « avant production » et « plus tard ».
**Prouver :** `pnpm check:fast` ; planchers du backoffice relevés ; specs `backoffice-identified-search.spec.ts`
(L3G-E1) et `backoffice-team-selection.spec.ts` (L3G-E2) toujours vertes, sans dépasser leurs budgets ;
`bo-nav.test.ts` inchangé.
**Arrêt si :** un correctif exige une route, une migration ou un droit neuf ; J4 demande un sélecteur de
campagne qui n'existe pas (alors : retirer le lien et le dire en EC).
