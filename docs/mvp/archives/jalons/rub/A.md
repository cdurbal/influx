# RUB-A — `docs(mvp): RUB arbitration, architecture`
Grille `architecte`. Type `arbitrage`.
**Lire :** fiche ; Lectures, ligne A ; F0 (note) ; `annexe.md` § Écarts ; code : `U` (`ls`),
`packages/test-kit/src/charter-data.ts` l. 110-140, `apps/web/tests/guards.test.ts` l. 640-661,
`apps/web/tests/keo-tokens.artifacts.ts` l. 20-75, `apps/web/playwright.config.ts` l. 44-130.
**Livrer :** `archives/jalons/rub/modele-archi.md`, 10 Ko au plus :
- table des composants E : importeurs, changement visible sur un écran non migré, « tout de suite » ou « variante
  facultative » (EC-RUB-4) ; sort des trois `SaveStatus`, de `TermsDialog`, d'`ErrorNotice` sous un champ ;
- `SHARED_CATALOGUE` avant RUC : forme qui accepte un seul front sans s'affaiblir, échéance, ligne qui la code ;
- planche : une page ou plusieurs, 4 s tenues, sections clientes, ensemble exact des `*.board.tsx` ;
- où vivent AN-2, clavier et axe ; `Announcer` et les 38 fichiers à `role="status"` ;
- CA08 (bord du `h1` commun) : ce que 10 change aux cadres sans migrer d'écran ;
- outil : `app.spec.ts`, `E01.0-S..`, page avec session, horloge (RUAT-8), échantillon CI (RUAT-3, grille `integrateur`) ;
- modules sans appelant avant RUE : aucun octet dans les routes.
**Ne pas toucher :** code ; spécifications (ligne 00).
**Prouver :** chaque choix a motif, garde et cas négatif ; EC-RUB-3, 4, 5 répondus.
**Arrêt si :** une dépendance est nécessaire ; une garde doit s'assouplir ; F0 sans réponse.
