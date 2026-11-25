# RUA-C — clôture du jalon
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin (`annexe.md`) avec sa preuve (identifiant, SHA, run CI).
2. `pnpm check` puis `pnpm test:e2e` verts en local ; CI verte du dernier push ; commande complète de l'outil (147
   états, maquette contre elle-même, 0 écart) exécutée une fois en local, durée consignée.
3. `run.md` § Mesures de clôture : éclats base et e2e, durée CI du projet `visual` (ou sa preuve d'exclusion), temps ajouté
   (≤ 20 s), artefact de production sans la planche.
4. `21` §8 : ligne de clôture RUA, reliquat du jalon (avant production, plus tard) ; `lot3bis-plan.md` : ligne RUA
   ✅ et sa date ; `22-refonte-ux-ui/07` : aucune modification ; `06a` : « État » des RU tranchés à jour, RU-02
   laissée ouverte si Q6 n'a pas répondu.
5. Proposer au fondateur, sans modifier `CLAUDE.md` : ligne D88 au §9, « Lot 3bis : RUA ✅ » au §10.
6. Fiche et `rua/` déplacés dans `archives/jalons/` ; références mises à jour (`Grep "jalons/rua"` dans `docs/`, `.claude/`).
   `lot3bis-plan.md` reste (pas le dernier jalon).
**Arrêt si :** une case sans preuve ; CI rouge ; RU-27 sans réponse F1 ; écart non nul de l'outil sans explication.
