# L3G-C — clôture du jalon et du Lot 3
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin (`annexe.md`) avec sa preuve (identifiant, SHA, run CI).
2. `pnpm check` puis `pnpm test:e2e` verts en local ; CI verte du dernier push, « Migrate staging » vert ;
   lecture SQL de `staging` (D70, lecture seule) : `0327` à `0332` appliquées, interrupteur faux, ligne du
   jour de `search.supply_counters`.
3. `run.md` § Mesures de clôture : éclats base et e2e, L3G-E1 et E2, temps ajouté à la base, trois
   durées de la ligne F.
4. `18` §10 Lot 3 : l. 1571 (TM12.5), 1574 (D38), 1575 (30 s) cochées avec preuve ; `21` §8 : ligne de
   clôture de L3G, reliquat du jalon (avant production, plus tard), L3FT-1, L3FS-1 à -3 et L3ES-2 soldés
   s'ils le sont ; `21` §7 l. 133 (migrations du lot) ; D38 dans `decisions.md`, `decisions-detail.md`
   (`Grep "^## D38 "`) et `CLAUDE.md` §9 ; `CLAUDE.md` §10 : Lot 3 ✅ et sa date.
5. Attestation `security-reviewed: <date> covers <sha>…` de l'annexe § Revue, si la revue est soldée.
6. Dernier jalon du lot : `l3g-fiche.md`, `l3g/` et `jalons/lot3-plan.md` déplacés dans
   `archives/jalons/` ; références mises à jour (`Grep "jalons/l3g\|jalons/lot3-plan"` dans `docs/`,
   `CLAUDE.md`, `.claude/`).
**Arrêt si :** une case sans preuve ; mesure des 30 s absente ou au-delà de 30 s ; CI rouge ; D38 non
tranchée.
