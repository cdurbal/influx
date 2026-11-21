# L3G-C — clôture du jalon et du Lot 3
Grille `testeur`.
**Faire :**
1. Cocher chaque case du critère de fin (`annexe.md`) avec sa preuve (identifiant, SHA, run CI).
2. `pnpm check` puis `pnpm test:e2e` verts en local ; CI verte du dernier push, « Migrate staging » vert ;
   lecture SQL de `staging` (D70, lecture seule) : `0327` à `0333` appliquées, interrupteur faux, ligne du
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
7. A6 de `ux-constats.md`, tranché le 2026-11-21 (« oui aux deux ») : **confirmé, emplacement prévu**
   (`tokens-backoffice.css`, `02` §21.3 point 6, D73, valeurs validées `17b` V1) ; l'inscrire au `21` §8
   (reliquat : soldé). Ne pas modifier `CLAUDE.md` : proposer au fondateur, dans le compte rendu de
   clôture, d'ajouter à §4 « et `apps/backoffice/src/styles/tokens-backoffice.css` pour les jetons `-bo-` ».
8. Règle D85 « masqué non retirable », tranchée le 2026-11-21 (« oui aux deux ») : **acceptée telle quelle**
   (0327 : un créateur masqué reste dans la sélection, la porte répond `removed` comme pour un absent ou
   un inconnu, la ligne n'est pas supprimée ; la marque la retrouve si l'exclusion est levée ; coût : une place
   masquée sur les 25 de la liste). Faire écrire la règle par `product-owner` dans la spec de la sélection
   (`10` ou `17b`, section que `Grep` désigne), avec la phrase d'avertissement quand une liste atteint son
   plafond avec des places masquées (sans nommer le motif) ; l'homonyme « EC-L3G-1 » de D85 s'appelle
   « EC-D85-1 » dans les documents (`21`, la spec) ; ne pas modifier `0327` (migration poussée, jamais
   réécrite) ni `annexe.md` (son EC-L3G-1 est la proposition du Lot 4) : noter l'homonyme en EC.
9. Recette F, constat du 2026-11-21 (fondateur : camp. 1 = 1 compatible, camp. 2 et 3 = 0, < 15 s) ; diagnostic
   en lecture seule de `staging` : (b) préremplissage en ET de 5 à 6 facettes dont F3 et F11 qui se recoupent,
   (a) donnée synthétique qui ne couvre pas les briefs, pas (c) défaut de la porte ; semis de recette décidé
   (« option A »), recette rejouée. Inscrire au `21` §8, reliquat « avant production », deux points à
   trancher par `product-owner` (spécification, non codés dans L3G) : (i) préremplissage plus souple, par
   exemple ne pas poser F3 quand F11 est posée ; (ii) élargissement guidé par les comptes (les trois retraits
   proposés par `WIDENING_ORDER` ne rendent rien sur les camp. 2 et 3 ; F1, seul retrait utile de la camp. 2,
   n'est jamais proposé), D11 : le commercial élargit à la main, aucun matching au MVP.
**Arrêt si :** une case sans preuve ; mesure des 30 s absente ou au-delà de 30 s ; CI rouge ; D38 non
tranchée.
