# Jalon RUB — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = cas livrés (`apps/web/tests/case-floors.ts`,
`apps/web/e2e/case-floors.ts`), jamais baissé. Aucun jsdom : rendu par `renderToStaticMarkup` (unitaire) ; clavier,
focus, mouvement et styles calculés sur la planche, en e2e, sans API ni compte.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| RUB-T0 | unitaire | `packages/test-kit/tests`, `apps/web/tests/guards.test.ts` | garde de planche étendue, cas négatifs ; plancher `visual` lu | +4 | X1 |
| RUB-T1 | unitaire | `tests/member-structure.test.ts` | C01 à C03, C29 : un `h1`, niveaux, `aria-labelledby`, une région | 8 | 01 |
| RUB-T2 | unitaire | `tests/member-ui.test.ts` (étendu) | C04, C05, C10 à C12 : variantes, `aria-disabled`, `aria-busy` | +8 | 02 |
| RUB-T3 | unitaire | `tests/member-ui.test.ts` | C13 à C17, C33, C38 : icône et mot, initiales si image absente | +8 | 03 |
| RUB-T4 | unitaire | `tests/member-lists.test.ts` | C06 (variantes de B), C07 (`dl` valide), C08 (6 `kind`), C09 | 16 | 04 |
| RUB-T5 | unitaire | `tests/member-fields.test.ts` | C18 à C21 : `aria-invalid`, `aria-describedby`, résumé, groupe | 14 | 05 |
| RUB-T6 | unitaire | `tests/member-choices.test.ts` | C22 à C26, C47 : aucune action au changement, dates FR et EN | 14 | 06 |
| RUB-T7 | unitaire, e2e | `tests/member-dialogs.test.ts`, `state-board.spec.ts` | C27, C28, C30, C32 : focus rendu, `Échap`, brouillon perdu | 8 ; +2 | 07 |
| RUB-T8 | unitaire, e2e | `tests/member-wizard.test.ts`, `state-board.spec.ts` | C41, C42, C49, C51 : « Continuer » jamais bloquant, un seul `input` | 10 ; +1 | 08 |
| RUB-T9 | unitaire, e2e | `tests/member-cards.test.ts`, `tests/member-reading.test.ts`, `state-board.spec.ts` | cartes et lecture : clavier, cœur, aucun montant | 18 ; +2 | 09a, 09b |
| RUB-T10 | e2e, a11y | `member-shell.spec.ts`, `brand-profile.spec.ts` (E01.0-T01 à T03) | CA01 à CA08, axe à 375, 768, 1 024, 1 440 | +2 | 10 |
| RUB-T11 | visuel (local) | `e2e/visual/app.spec.ts` | coquille contre `proto-accueils.html` : N1, N2, N3 | 4 | 11 |
| RUB-AN2 | e2e | `state-board.spec.ts` | `R04` §3 : durée, courbe, propriété des lignes portées ; AN-1 | 1 par commit porteur | 02 à 09b |
| RUB-AX | e2e | `state-board.spec.ts` | axe 0, aucun débordement de chaque section à 375 et 1 440 | cas existant étendu | 01 à 09b |

**Budget e2e** (mesuré en CI) : 20 s au plus pour le jalon. 01 à 06 : 1 s chacun ; 07 : 3 s ; 08 : 2 s ; 09a : 2 s ;
09b : 3 s ; 10 : 4 s ; total prévu 20 s, aucune marge. 11 : 0 s (local). Base : aucun test.

## Critère de fin
- [ ] F0 répondue, mot pour mot (`run.md`) ; A, B, 00 avant tout code ; D89 écrite ; `06a` à jour (SHA)
- [ ] X1 : RUAT-2 soldé avec cas négatifs (T0)
- [ ] 49 composants : module, `NomProps`, section de planche, tests (table composant → fichier → SHA)
- [ ] `02b` §4 : trois `SaveStatus` et base de `TermsDialog` traités selon A, ou report nommé
- [ ] AN-1 à AN-4 ; AN-2 par ligne portée ; `package.json` et `pnpm-lock.yaml` intacts
- [ ] Planche : axe 0 à 375 et 1 440, validée par `expert-ux` (U, 0 bloquant)
- [ ] Coquille : E01.0-CA01 à CA08 (T10) ; N1 à N3 (T11), écarts corrigés ou inscrits en `06b` §7 avec accord
- [ ] F1 : coquille validée par le fondateur sur `staging`
- [ ] Vitrine inchangée ; planche absente de la production (RUA-T8) ; JavaScript de première visite ≤ +5 % par route
- [ ] R soldée ; `pnpm check`, `pnpm test:e2e` verts ; e2e ≤ +20 s
- [ ] Diff vide sur `apps/api`, `supabase`, `packages/contracts`, `packages/domain`, `apps/backoffice/src`
- [ ] Vélocité mesurée (jours par commit) pour relire la charge du lot (`08` l. 220)

## Écarts, décisions ouvertes, risques
- **EC-RUB-1** : `08` place toute la ligne 09 derrière RU-02, ouverte (juriste D34) : scindée en 09a (cartes, réserve
  RU-02, F0 Q3) et 09b (lecture, sans RU-02).
- **EC-RUB-2** : `08` dit « 10 variantes de `RowList` » ; `02a` et `02c` en listent 8 : tranché par B.
- **EC-RUB-3** : `SHARED_CATALOGUE` exige deux modules par nom, or RUC vient après : forme à trancher par A.
- **EC-RUB-4** : faire évoluer `Notice` (53 fichiers importeurs), `MemberButton` (37), `PageHeader` (26) touche des
  écrans non migrés, contre « jamais un écran à moitié ancien » (`08` §1.4) : A liste les effets, F0 Q4 les accorde.
- **EC-RUB-5** : `COUPLE_ID` (`couples.ts`) refuse `E01.0-S02` ; aucun `app.spec.ts` ; `visual-compare.test.ts:415`
  exige des couples vides : ligne 11, ajoutée au plan.
- **EC-RUB-6** : `18` §12.8 écrit « +20 s pour le lot », `R05` §7 « par jalon » : 00 aligne sur `R05`.
- **EC-RUB-7** : RU-32, RU-34, RU-36 ont une part d'arbitre à venir : B tranche la seule part d'un composant (C41,
  C34) ; les règles d'écran restent à RUF, RUG, RUH.
- **Sécurité (I-4)** : aucun commit prévu sur `audit.*`, politique, `GRANT`, `supabase/config.toml`, ni sur un chemin
  de `SECURITY_PREFIXES`. Si A impose `.github/workflows/`, `check-*` ou `next.config.ts` : marqueur à la revue.
- **Risques** : planche trop longue pour `SERVED_WITHIN_MS` 4 s (RUAT-6, A) ; 08 et 09b lourds ; pile Supabase absente
  en local à RUA : la CI prouve T10, mais **T11 exige une pile locale** (F0 Q5).
- **Non traité, reliquat inchangé** : RUA-J8T8, RUAS-2 à RUAS-4, RUAT-5 à RUAT-7 (hors budget de planche).

## Revue
