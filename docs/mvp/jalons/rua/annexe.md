# Jalon RUA — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au commit (`apps/web/tests/case-floors.ts`,
`apps/web/e2e/case-floors.ts`, `artifact-floors.ts`, `packages/test-kit/tests`), jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| RUA-T1 | unitaire | `apps/web/tests/lot3bis-tokens.test.ts` | table nom → valeur de maquette (`R03` §3, `modele-ux.md`) égale à `tokens.css` et `tokens-backoffice.css`, aucune valeur orpheline | 4 | 01 |
| RUA-T2 | unitaire | `apps/web/tests/guards.test.ts`, `apps/backoffice/tests/guards.test.ts`, `packages/test-kit/tests` | G3c, G3d, G3f, G3i et leurs cas négatifs sur les tokens neufs ; `-bo-` seuls dans `tokens-backoffice.css` | +3 | 01 |
| RUA-T3 | e2e + unitaire | `vitrine-unchanged.spec.ts`, `guards.test.ts` (G3e) | vitrine inchangée, JSON intacts | 0 (existants verts) | 01, 02 |
| RUA-T4 | unitaire, artefact | `apps/backoffice/tests/guards.test.ts`, `keo-tokens.artifacts.ts` (les deux fronts) | `--breakpoint-form`, `bo-wide`, `bo-small` gardée, `--animate-*` nommés, ni `height` ni `all`, lus ou justifiés (G3i b) | +2 | 02 |
| RUA-T5 | e2e | `charter-rendering.spec.ts` | AN-1 : `--animate-*` à 0 s sous mouvement réduit, squelette à `none` | +1 | 02 |
| RUA-T6 | unitaire, e2e | `visual-compare.test.ts`, spec `visual-*` (projet `visual`) | maquette contre elle-même = 0 écart à N1, N2, N3 ; trois écarts volontaires vus ; normalisation des couleurs et familles | 6 ; 4 | 03 |
| RUA-T7 | unitaire, e2e | `recette-data.test.ts`, une spec ≤ 2 cas | jeu synthétique, `NON_RECETTABLE` exact, un chargeur par espace | 5 ; 2 | 04 |
| RUA-T8 | artefact, e2e | `build.artifacts.ts`, une spec ≤ 1 cas | planche absente de la construction de production ; rendue en e2e, axe 0 | +1 ; 1 | 05 |

**Budgets.** e2e : ≤ 20 s pour le jalon (`lot3bis-plan.md` l. 49), mesurés en CI : T5 ≤ 2 s, T6 +0 s (local seul
sous `E2E_VISUAL`, B §5 ; échantillon CI à rouvrir avec `integrateur` au premier écran comparé, RUAT-3), T7 ≤ 5 s,
T8 ≤ 4 s (11 s prévus en tout). Base : aucun test base. Éclats ≤ 7 min 30, job ≤ 8 min.

## Critère de fin
- [ ] F0 : accord de démarrage et Q2 à Q6 répondus, mot pour mot dans la note (« oui partout », 2026-11-25)
- [ ] D88 écrite ; chaque RU-01 à RU-20, hors RU-02 et RU-14, « Tranchée » ou « Écart accordé » dans `R06a`
- [ ] `20`, `02`, `04-DIRECTION-ARTISTIQUE`, `18` amendés avant le premier commit de code (00 avant 01)
- [ ] Tokens de `R03` §3 présents, valeurs égales aux maquettes (RUA-T1) ; G3c à G3i vertes (T2)
- [ ] Vitrine inchangée : G3e, `vitrine-unchanged`, JSON intacts (T3)
- [ ] Seuils et `--animate-*` livrés, AN-1, AN-3, AN-4 (T4, T5) ; `package.json` et `pnpm-lock.yaml` intacts
- [ ] Maquette contre elle-même : 0 écart à N1, N2, N3 ; écart volontaire vu à chaque niveau (T6)
- [ ] Jeu de recette par espace, `NON_RECETTABLE` écrit (T7) ; planche hors production (T8)
- [ ] RU-27 : F1 répondue par famille, reportée dans `R06a` et D88 (07)
- [ ] Skill `design-system-influx` à jour, `SKILL.md` ≤ 10 Ko (07)
- [ ] U, R soldées ; `pnpm check` et `pnpm test:e2e` verts ; e2e ≤ +20 s
- [ ] Aucun commit sur `apps/api`, `supabase`, `packages/contracts` ; 596c18c touche `.github/workflows/ci.yml` et
  `apps/web/next.config.ts` (`SECURITY_PREFIXES`) : attestation requise, couverte par RUA-R (R)

## Écarts, décisions ouvertes, risques
- **EC-RUA-1** (préparation) : RU-02 (juriste) et RU-14 (textes EN, par jalon) ne bloquent aucun commit de RUA ; le
  plan les range dans « bloque RUA ». RU-02 bloque RUB-09 et RUH ; F0 Q6 la pose tôt.
- **EC-RUA-2** : `R03` §3.3 nomme des tokens de seul backoffice sans `-bo-` (`grid-record`, `grid-decision`,
  `grid-check`, `grid-sync`, `size-choice-dense`, `size-alert-code`) alors que G3f exige `-bo-` ; `--grid-record` dépend de
  `--spacing-bo-panel-w` : renommés par A.
- **EC-RUA-3** : la garde `bo-small` compare la liste des fichiers porteurs de `@custom-variant` : `bo-wide` dans le même
  fichier double l'entrée ; dédupliquée, sans autre changement (B §1, 02).
- **EC-RUA-4** : un alias de couleur redéclaré dans le bloc KEO et non lu par une classe échoue en artefact (G3i b) :
  `UNREAD_JUSTIFIED` des deux fronts, retiré au premier emploi (RUB, RUC).
- **EC-RUA-5** : un projet Playwright `visual` est exclu des éclats CI (`--project=chromium`), mais `pnpm test:e2e`
  local l'exécute et le rapport fusionné en CI lui manque : plancher et exécution à régler en B §5. *Réglé par B §5* :
  projet défini sous `E2E_VISUAL` seul (local), absent de `pnpm test:e2e`, des éclats et du rapport fusionné ; +0 s en
  CI ; échantillon CI à rouvrir avec `integrateur` au premier écran comparé, avant que RUB ne s'appuie sur l'outil (RUAT-3).
- **EC-RUA-6** (mesure demandée par `lot3bis-plan`) : skills du domaine : `design-system-influx` 9 625 octets,
  `backoffice-ops` 6 880 ; aucune au-delà de 10 Ko pour RUA.
- **Risque** : RUA-03 (XL) : diff de police ou de date entre deux rendus de la même maquette ; parade : même
  Chromium, locale `fr-FR`, masques de `R05` §3. **Risque** : RU-18 non vérifiable avant RUC-01 (deux implantations).
- **Décisions ouvertes** hors RUA : RU-21 à RU-44 selon `lot3bis-plan` ; RU-35, RU-39, RU-44 ouvertes (fondateur).
- **Question d'organisation** : un ou deux fils de développement (`lot3bis-plan`, Questions) : à trancher avant RUB.

## Revue
Revue groupée du 2026-11-25, plage `a37a8ea..b3d20e2` (00 à fix-1), `testeur` (RUAT-n) et `expert-cybersecurite`
(RUAS-n). **0 bloquant, 2 jalon (fix-2, fix-3), 1 avant production, 10 plus tard.** Contenu de 596c18c revu sain.
Revue UX : `ux-constats.md` (J1 soldé par fix-1 ; AP1 à AP5 et PT1 à PT7 y restent, non repris ici).

### Jalon
- **RUAS-1** (`expert-cybersecurite`) — `packages/test-kit/scripts/check-security-review.ts:59-65`
  (`SECURITY_PREFIXES`) couvre `.github/workflows/` et `apps/web/next.config.ts`. 596c18c modifie
  `.github/workflows/ci.yml` (l. 355-361) et `apps/web/next.config.ts` (l. 33-35) sans marqueur `security-reviewed:`.
  *Scénario* : la CI le signale (run 45684020423, étape « Security review markers » en sortie 1, `continue-on-error`
  sur `main`, D71) ; sans attestation, la fusion vers `production` est refusée (D71). Confirmé en local :
  `check-security-review.ts HEAD~1 HEAD 56b8046…` n'énumère que 596c18c. *Correctif* (fix-2, `integrateur`) : commit
  d'attestation vide `chore(security): attest the end-of-RUA review`, corps `security-reviewed: 2026-11-25` puis
  `security-reviewed: 2026-11-25 covers 596c18c…` (l. 27-28 du script : le marqueur simple est exigé aussi), jamais en
  réécrivant `main` ; `annexe.md` (critère de fin) et `revue.md` déjà corrigés par R.
- **RUAT-1** (`testeur`) — `apps/web/e2e/recette-loaders.spec.ts:35` : le cas « brand space and backoffice space »
  appelle `loadBackofficeSpace(page, { role: "admin", … })` et crée un administrateur actif hors `backoffice.spec.ts`,
  contre `apps/web/playwright.config.ts:80-83` (J8T-8). *Scénario* : à 2 workers, le double contrôle dégradé de
  `backoffice.spec.ts` (`onlyAdmin`, l. 637, 1215, 1302) désactive les autres admins le temps de ses tests ; un admin
  créé en parallèle le rend instable. Le cas n'utilise jamais cet admin. *Correctif* (fix-3, `testeur`) : `role: "agent"`
  ou l'option omise (défaut `agent`, `e2e/support/recette.ts:279`) ; le rôle `admin` du chargeur reste pour RUB,
  rattaché à `backoffice.spec.ts`.

### Avant production
- **RUAT-2** — `packages/test-kit/src/guards.ts` `findStateBoardViolations` : liste interdite limitée à
  `@influx/web-platform`, `next-intl`, 3 modules, `useMember`/`useMe` ; étendre (`next/headers`, `@influx/contracts`,
  `fetch`, `process.env`) avec `expert-cybersecurite`.

### Plus tard
- **RUAS-2** — `.claude/skills/jalon-prepare/SKILL.md:108-110` : ajouter `SECURITY_PREFIXES` et `SECURITY_FILES`
  (workflows, `check-*`, `next.config.ts`, `deploy/railway/`, relais) aux commits signalés.
- **RUAS-3** — `runbooks/production.md:374-391`, `staging.md:159` : preuve sur le build CI, pas Railway ; sonde
  `GET /fr/state-board` et `/en/state-board` = 404, absence de `INFLUX_STATE_BOARD` sur les services de `staging`.
- **RUAS-4** — `apps/web/src/config/state-board.ts:26-29` : troisième verrou (variable fournie par Railway, ex.
  `RAILWAY_ENVIRONMENT_NAME`, présence au build à confirmer) avec cas négatif.
- **RUAS-5** — `apps/web/e2e/support/visual/neutralize.ts:41-44` : `page.route` n'intercepte pas les WebSocket ;
  ajouter `page.routeWebSocket(/.*/, …)`.
- **RUAT-3** — T6 (19 cas) local seul sous `E2E_VISUAL`, sans échantillon CI (B §5) ; § Budgets et EC-RUA-5 alignés
  par R ; à rouvrir avec `integrateur` avant que RUB ne s'appuie sur l'outil.
- **RUAT-4** — `apps/web/e2e/visual/case-floors.ts` (19 et 92) lu par aucun test ni la CI : test unitaire de lecture
  ou branchement à `pnpm check` à l'ouverture de l'échantillon CI.
- **RUAT-5** — e2e local (`webServer` : `next build` avec drapeau) laisse la planche dans `.next` ; `test:artifacts`
  ensuite échoue (T8) : écrire « rebuild sans drapeau avant `test:artifacts` » dans `18` ou `runbooks`.
- **RUAT-6** — `state-board.spec.ts` `SERVED_WITHIN_MS` 4 s sur durée réelle (CI : 0,96 s) à surveiller ; anneau de
  focus (facultatif de fix-1) non couvert.
- **RUAT-7** — `apps/web/tests/fixtures/tokens-before-lot3bis.json` : noms seuls ; T1 ne voit pas la revalorisation
  d'un token préexistant (G3e, `vitrine-unchanged` seuls) ; ajouter les valeurs si la fixture doit protéger la vitrine.
- **RUAT-8** — `neutralize.ts` gèle l'horloge de la maquette (24/11/2026 09:01) : RUB fige celle de l'application ou
  masque `current-time` (fiche de RUB) ; N3 à 0,5 % par zone laisse passer de petits écarts de texte vus par N1/N2
  (seuil de R05 §3).
