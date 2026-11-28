# Jalon RUB — Composants membres et coquille
> Source : `lot3bis-plan.md` l. 24, `22-refonte-ux-ui/08-plan-de-developpement.md` l. 52-65 · 2026-11-25 · Statut : ouvert (validé le 2026-11-25) · Annexe : `rub/annexe.md`

## Objectif et périmètre
Livrer une fois, avec planche d'états et tests, les **49 composants membres** de la table des commits, que consomment
RUE à RUI, puis refondre la **coquille des membres** (E01.0, C56), seul écran du jalon, comparé à sa maquette. Les
nouveaux modules n'ont pas d'appelant produit avant RUE, sauf la coquille et les remplacements décidés par A.
**Ne change pas :** API, base, contrats, backoffice, vitrine, contenu des pages membres, textes réglementaires.
**Hors périmètre :** C43 à C46, C50, C52 à C55, C64, C65 (avec leur écran) ; C57 à C63, C67 (RUC) ; migration des
écrans (RUE et suivants) ; textes EN des écrans (RU-14, par jalon).

## Invariants
1. Aucun code avant la réponse F0 (accord de démarrage, D87), mot pour mot dans la note de `run.md`.
2. `apps/api`, `supabase`, `packages/contracts`, `packages/domain`, `apps/backoffice/src` : diff vide. `packages/ui` :
   aucun `.tsx`, aucun token, sauf décision écrite par A ou B.
3. Vitrine : les trois `vitrine-*.json` intacts, `vitrine-unchanged` vert.
4. Un composant du catalogue = un module `Nom.tsx` + `nom-classes.ts` dans `apps/web/src/components/member/ui/`
   (`02a` §0) ; noms et propriétés de `02c`, `export type NomProps` autonome (RU-18) ; aucun équivalent sous un autre nom.
5. Ni logique métier, ni appel réseau, ni i18n, ni `@influx/contracts` dans un composant : textes par propriétés ;
   icônes par `icons.ts` seul.
6. Tokens seuls (G3) ; ni `/NN`, ni opacité numérique, ni `clamp(` ; `effect-photo-*` lus par les modules de
   `PHOTO_EFFECT_READERS` seuls (G8).
7. Faire évoluer (E) un composant employé ne change un écran existant que pour les effets listés par A
   (`rub/modele-archi.md`) ; `data-*`, rôles et noms accessibles lus par une spec : conservés.
8. Aucune assertion retirée ni assouplie, aucun plancher baissé ; garde modifiée = nommée, motivée, cas négatif (TD1).
9. Aucune dépendance (AN-3) ; ni `transition: all`, ni `height` ou `max-height` animés (AN-4) ; mouvement réduit (AN-1) ;
   chaque ligne « À créer » de `04` §3 portée par un composant du jalon a son cas AN-2.
10. axe = 0 sur la planche à 375 et 1 440 ; cible 44 px ; focus visible ; couleur jamais seule ; vert jamais d'état.
11. Ni taux, ni montant côté créateur, ni score (D11, D48, D78) ; données de planche synthétiques (`example.test`).
12. Carte photo : icône « vérifié » avec texte accessible seulement (RU-02, D88), sans appelant avant RUH ; ailleurs,
    badge daté complet.
13. La planche reste absente de la construction de production (RUA-T8), sans session ni appel.
14. Un seul `nav` et un seul `aria-current="page"` dans la coquille ; aucune largeur lue en JavaScript ; aucune entrée
    sans écran (D74).
15. Une image de référence n'est jamais committée ni mise à jour ; masques de `R05` §3 seuls ; un écart est corrigé ou
    inscrit en `R06b` §7 avec l'accord du fondateur.
16. e2e : +20 s au plus pour le jalon, sauf décision (D89, 2026-11-28 : 46,5 s mesurées, annexe § Tests) ; éclats
    ≤ 7 min 30, job ≤ 8 min.

## Lectures
Commun : cette fiche, puis `rub/modele-archi.md` (A) et `rub/modele-ux.md` (B) dès leur ligne faite. `R02a`, `R02b`,
`R02c`, `R04`, `R05`, `R06a`, `R06b` = fichiers de `docs/mvp/22-refonte-ux-ui/` ; `E01a` = `ecrans/E01a-accueils.md` ;
`U` = `apps/web/src/components/member/ui/` ; `PB` = `apps/web/src/app/[locale]/(member)/state-board/` ; maquettes :
`docs/audit-ux-ui/prototypes/`. Règles communes : `R02a` §0 (l. 7-20), `R02c` l. 3-7 et 92-95 ; `20` §11.8 : la seule
ligne du composant (`Grep`). « Planche étendue » : section, `COMPONENTS` de `state-board.spec.ts`, `expectedFiles`
de `guards.test.ts`. Chaque prompt de code : `pnpm check:fast` avant commit, planchers relevés.
| # | Tranches (le prompt complète) |
|---|---|
| A | `archives/jalons/rua/modele-archi.md` §2, §5, §6 ; `02` §21.2 (l. 2346-2356) ; `21` l. 252-255 |
| B | `archives/jalons/rua/ux-constats.md` §5 ; `R06a` l. 30, 36, 40, 58, 60, 62 ; `E01a` l. 198-206 ; `R04` §3 |
| 00 | A, B ; `20` §11.8 ; `18` §12.8 (l. 1916-1980) ; `17` §2.3 (l. 188-262) |
| X1 | `21` l. 252-253 ; `packages/test-kit/src/guards.ts` l. 1664-1729 ; `apps/web/e2e/support/visual/neutralize.ts` |
| 01 à 03 | `R02a` l. 22-64, 108-142 ; `R02c` l. 13-29, 44 |
| 04 à 07 | `R02a` l. 81-123, 144-196 ; `R02c` l. 18-43 ; `R02b` l. 90-91 |
| 08, 09a, 09b | `R02b` l. 6-60, 62-101 ; `R02c` l. 52-70, 76-77 ; `R04` l. 43-74 |
| 10, 11 | `E01a` l. 22-24, 30-48, 83-95, 123-139, 155-179 ; `R05` §1 à §5 |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| F0 | fondateur | Accord de démarrage, fils, RU-02 et 09a, effets sur les écrans actuels, pile locale. |
| A | `docs(mvp): RUB arbitration, architecture` | `rub/modele-archi.md` : composants employés, garde, planche, outil. |
| B | `docs(mvp): RUB arbitration, UX` | `rub/modele-ux.md` : points UX ouverts des composants et de la coquille. |
| 00 | `docs(mvp): specifications amended for RUB (D89)` | `20`, `18`, `17`, `06a`, `06b`, décisions. |
| X1 | `test(kit): the state board guard and the mockup tool tightened` | Dette : RUAT-2, RUAS-5, RUAT-4. |
| 01 | `feat(web): the page frame, the sections and the announcer` | C01, C02, C03, C29. |
| 02 | `feat(web): the surfaces and the actions of the member spaces` | C04, C05, C10, C11, C12. |
| 03 | `feat(web): the badges, the notices and the logo plate` | C13 à C17, C33, C38. |
| 04 | `feat(web): the row list, the property list, the states` | C06 à C09. |
| 05 | `feat(web): the fields and their messages` | C18, C19, C20, C21. |
| 06 | `feat(web): the choices, the disclosure and the save status` | C22 à C26, C47. |
| 07 | `feat(web): the dialogs, the filters and the pager` | C27, C28, C30, C32. |
| 08 | `feat(web): the wizard, the recap and the code field` | C41, C42, C49, C51. |
| 09a | `feat(web): the photo card and the feed card` | C31, C48. |
| 09b | `feat(web): the gallery and the reading components` | C34 à C37, C39, C40, C66, C68. |
| 10 | `feat(web): the member shell of the Lot 3bis` | C56, E01.0-CA01 à CA08. |
| 11 | `test(e2e): the member shell compared with its mockup` | Premiers couples N1 à N3 sous `E2E_VISUAL=app`. |
| F1 | fondateur | Validation de la coquille sur `staging` (`R05` §8). |

Ordre de fin : 11, U (`expert-ux`), F1, R (revue groupée), C (clôture).
