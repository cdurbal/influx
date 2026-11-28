# RUB-fix-5 — `fix(web): the header glow of the narrow pages on the whole frame`
Grille `dev-react-node`. Skill : `design-system-influx`. U-7. **Conditionnel : seulement si le fondateur choisit de
corriger.** Choix à rendre avec la validation des lignes (F1) : soit accorder l'écart **D5** (halo qui suit le cadre
étroit ; ligne `ignoré`, D5 inscrit en `06b` §7 avec son accord, mot pour mot), soit corriger (ce prompt). Ne pas
valider cette ligne par un « valider tout » qui ne dit pas « corriger U-7 ».
**Lire :** `rub/ux-constats.md` l. 15 (fait foi) ; `R/ecrans/E01a-accueils.md` l. 25, 48, 139 (`R` =
`docs/mvp/22-refonte-ux-ui`) ; `rub/modele-archi.md` §5 ; `U/page-frame-classes.ts`, `PageFrame.tsx` ;
`components/auth/auth-classes.ts` l. 20-31 ; appelants de `SPACE_SCREEN_CLASSES` et `NARROW_PAGE_FRAME_CLASSES`
(`Grep`) ; cas des cadres : `Grep "NARROW_PAGE_FRAME" apps/web/tests`, second cas RUB-T10.
**Livrer :**
- Pages étroites : cadre à `container-max` (halo, gouttières) aligné à gauche, pile étroite dedans, 768 px utiles.
- Bord gauche du `h1` inchangé (CA08) ; `SCREEN_CLASSES` (pages autonomes) identique.
**Ne pas toucher :** contenu des pages, `tokens.css`, textes, vitrine, backoffice, `apps/web/e2e/case-floors.ts`.
**Prouver :** unitaires du cadre à jour, aucune assertion assouplie ; dans le second cas RUB-T10 (aucun cas neuf) : à
1 440, cadre d'une page étroite et d'une page large de même largeur, contenu étroit de 768 px au plus. `pnpm check:fast` ;
`playwright test member-shell state-board --reporter=line` ; `E2E_VISUAL=app` : aucun écart hors D1 à D4.
**Arrêt si :** il faut modifier chaque écran appelant (le dire, avec leur liste) ; un effet hors de la liste de A §1.
