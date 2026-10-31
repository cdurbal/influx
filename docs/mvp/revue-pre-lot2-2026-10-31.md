# Revue pré-Lot 2 — qualité du code, respect des spécifications, économie de tokens

> **Date :** 2026-10-31 · **Demandée par :** le fondateur · **Réalisée par :** Claude Code (Opus 5.5)
> **Périmètre :** `main` à `2e2f12d` : `apps/*`, `packages/*`, `supabase/`, CI, `.claude/`, `docs/mvp/`.
> **Méthode (sobre en tokens) :** contrôles d'invariants par `git grep` sur tout le code, carte des
> fichiers par taille, comparaison des deux fronts, dernière CI, lecture des seules tranches utiles
> du plan, des fiches archivées et du registre. Aucune spécification lue en entier, aucun sous-agent.
> **Statut :** archivage et synthèse de la documentation **appliqués** (§2). Corrections de code et de
> spécification **proposées, à valider** (§3) ; les prompts suivront la validation. Mécanisme
> d'automatisation **proposé** (§4, D77 ouverte). Ce fichier s'archive quand §3 est soldé.

---

## 1. Constats, du plus grave au moins grave

Légende : 🔴 bloquant avant le premier commit du Lot 2 · 🟠 majeur, à traiter au début du Lot 2 ·
🟡 mineur, à traiter quand le fichier est touché · ✅ vérifié conforme.

### 1.1 Bloquants

| # | Constat | Preuve |
|---|---|---|
| B1 | ✅ *Résolu pendant la revue.* **CI rouge sur `main`** : le job « Browser journeys » de `2e2f12d` échoue sur `DS-11: the focus ring is visible…` (`toBeFocused` reçoit `inactive` après `Tab`). Le commit ne touche que `cursor` en CSS : course à l'hydratation (`goto` puis `Tab` sans attendre), même famille que J9T-5. Rejeu vert (intermittent confirmé) ; **corrigé pendant la revue par une autre session** (`64bcb6e` : attente du focus du `h1` avant `Tab`), non poussé ; la cause commune reste à traiter (K1) | Run `41140836942`, `apps/web/e2e/backoffice-auth-screens.spec.ts:61-67` ; 1 échec, 210 réussis |
| B2 | **Décisions d'entrée du Lot 2 encore ouvertes** : D34 (libellé du badge), D61 (`07` Q15, Q16), D24 (instruite), `03` R-4 et R-5. `21` §7 les exige « avant de coder » | `21` §7 et §8, `decisions.md` |
| B3 | ✅ *En grande partie résolu : passages et recette attestés par le fondateur le 2026-10-31 (K2) ; restent R3 et le test du logo (`21` §8).* **Critère de fin du jalon RK non prouvé** alors que le jalon est déclaré clos : trois passages `pnpm check` + `pnpm test:e2e` jamais renseignés (« [RÉSULTAT À RENSEIGNER] »), sept cases ouvertes (e2e, axe, vitrine, G3i, traçabilité R3, recette du fondateur à 1 440 et 375 px et sur Mac, logo). Le Lot 2 construirait sur une base non constatée | `archives/jalons/rk-fiche.md` l. 194 à 206 ; `21` §8 « RK-fin » |

### 1.2 Majeurs

| # | Constat | Preuve |
|---|---|---|
| M1 | **Budget de durée e2e presque épuisé** : environ 2 s de marge sur les 60 s permis à l'issue de RK ; le Lot 2 ajoute ses écrans (profils, réseaux, badge) et le dépassera dès le premier jalon | Ligne RK de `archives/21-journal-lot1-archive.md` §5 |
| M2 | **Dix fichiers identiques dans les deux fronts**, tenus égaux par empreinte dans `test-kit` : `server/relay.ts`, `server/api-client.ts`, `browser/relay-client.ts`, `app/api/[...path]/route.ts`, `config/server.ts`, `observability/error-collector.ts`, `styles/fonts.ts` et les polices, `styles/tokens.css`. Chaque évolution se fait deux fois et coûte deux lectures. `21` §7 prévoit `packages/ui` et `packages/domain` au Lot 2 | Comparaison `apps/web/src` / `apps/backoffice/src` ; `02` §21.3 |
| M3 | **Fichiers trop gros pour être édités sobrement** : `api/domains/backoffice/repository.ts` (1 981 l., 46 fonctions exportées, 73 requêtes), `identity/repository.ts` (1 518), `config/schema.ts` (1 448), `identity/backoffice-sign-in.ts` (1 147). Un agent qui corrige une fonction relit des milliers de lignes ; le Lot 2 ajoutera le domaine des profils sur le même modèle | `wc -l` des sources |
| M4 | **Renvois `CLAUDE.md §N` périmés** : CLAUDE.md a été renuméroté le 2026-10-05 (`5d232af`). Les agents, trois skills et le plan citaient l'ancienne numérotation (§3 commission → §2, §6 stack → §5, §9 conformité → §6, §13 décisions → `decisions.md`, §14.x → `prerequis.md`). **Corrigés** dans `.claude/` et `21`. **Restent** environ 60 renvois dans les spécifications `00` à `20` et les runbooks ; ceux écrits après le 2026-10-05 sont déjà justes, d'où un tri au cas par cas | `git grep "CLAUDE.md\` §"` |
| M5 | **Tests intermittents connus, non traités** : `t14-backoffice-invitations-route` (DS), TD3.6 en run complet (SNT-1), `journey-resume` (J9T-5), DS-11 (B1). Chaque intermittent coûte un rejeu de CI et une session de diagnostic | `21` §8 |

### 1.3 Mineurs

| # | Constat | Preuve |
|---|---|---|
| m1 | `engines.node` de la racine à `>=22.18.0`, alors que `CLAUDE.md` §5 exige Node ≥ 24.12 en production et que `.node-version` vaut 24 | `package.json` |
| m2 | Quatre `eslint-disable-next-line jsx-a11y/*` sans justification (`-- motif`), contrairement aux deux autres du dépôt | `AccountsScreen.tsx` l. 468 et 473, `DenseTableRegion.tsx` l. 20, `MemberInvitationsScreen.tsx` l. 199 |
| m3 | Le backoffice construit ses charges et valide ses formulaires dans les composants (ex. `AccountScreen.tsx` l. 180 à 202), quand `apps/web` les range dans `*-form.ts` et `view-model.ts`. Peu grave aujourd'hui, mais le modèle sera recopié par les écrans du Lot 2 (`CLAUDE.md` §5 : aucune logique métier dans les composants) | `apps/backoffice/src/components/` |
| m4 | `decisions.md` : les lignes D66 à D76 font 2 à 8 Ko chacune (D70 : 8,4 Ko). Un `Grep D70` renvoie 8 Ko. Proposition : énoncé de deux lignes dans le tableau, détail verbatim dans `archives/decisions-detail.md` (le registre fait foi : accord du fondateur requis) | `decisions.md` |
| m5 | Les critères de fin ne sont pas cochés à la clôture (SN : dix cases ouvertes alors que `21` les dit constatés) : la clôture d'un jalon doit cocher chaque case avec sa preuve | `archives/jalons/sn-fiche.md` l. 179 à 200 |
| m6 | 12 agents sur 14 épinglés sur Opus. Inutile de les changer : sous D77, la table d'exécution fixe le modèle par tâche, et les agents ne servent qu'aux revues et arbitrages | `.claude/agents/*.md` |

### 1.4 Vérifié conforme (aucune action)

✅ Aucun calcul ni taux de commission : seul le schéma vide `billing.commission_rates` existe, garde T16
avec témoin · ✅ aucun appel à Supabase ni aucune clé dans les fronts · ✅ `@supabase/auth-js` dans
`platform/supabase.ts` seulement, paquets interdits absents (témoin `j3b`) · ✅ aucun rôle
`BYPASSRLS` (contrôles en migration) · ✅ zéro `any`, zéro `@ts-ignore`, zéro `console.log`, zéro
`TODO` · ✅ syntaxe effaçable seule dans `apps/api` (ni `enum` ni `namespace`) · ✅ CI parallèle verte
sur les commits précédents (6 à 7 min).

---

## 2. Archivage et synthèse appliqués

| Action | Avant | Après |
|---|---|---|
| `21-plan-de-developpement.md` : écarts `EC-*`, J5 à J9, DS, SN, RK et guide de lecture par jalon déplacés vers `archives/21-journal-lot1-archive.md` (numéros de section conservés : les ≈ 70 renvois « `21` §3 / §4 / §5.8 » restent résolubles) ; §0 réduit à l'état des lots ; §2.4 renvoie aux `package.json` (versions périmées : `supabase`, `zod`, `drizzle-orm`, `pino`, `postgres`) ; **§8 nouveau : reliquat unique à l'entrée du Lot 2** (12 tickets, au lieu de cinq listes « Reportés » dispersées) | 65,7 Ko (≈ 18 k tokens) lus à chaque session de commit | 17,6 Ko (≈ 5 k) |
| `CLAUDE.md` : §9 réduit aux décisions ouvertes et aux tranchées qui cadrent le travail ; §10 avec l'état des lots ; §12 et §8 sans historique ; lecture de l'index par `Grep` ; archives fermées par défaut | 23,2 Ko, chargé dans **chaque** session et sous-agent | 21,3 Ko |
| 14 agents : « Lis `CLAUDE.md` (§…) » remplacé par « déjà dans ton contexte, ne le relis pas » et les bons numéros de section | une relecture de ≈ 6 k tokens par sous-agent, sur de mauvaises sections | 0 |
| Skills `ds-commit` et `rk-commit` (jalons clos) → `archives/jalons/` ; renvois périmés de `env-secrets`, `intermediation-tracking`, `profile-verification` corrigés | 2 skills jetables, 40 Ko | modèles du mécanisme D77 |
| `19-revue-de-coherence-2026-09-24.md` → `archives/` (sept renvois mis à jour) ; sort de l'index | dans `INDEX.md` | archivé |
| D77 inscrite en décision ouverte | — | `decisions.md` |

---

## 3. Corrections proposées (à valider ; prompts après validation)

| # | Correction | Type | Traite | Modèle · effort |
|---|---|---|---|---|
| K1 | Barrière d'hydratation partagée dans le support e2e (`page.goto` puis attente d'un marqueur d'hydratation), reprise par DS-11 (`64bcb6e` en est le cas particulier), `journey.ts` `open()`/`reload()` ; commentaire périmé de `security-headers.spec.ts` | test | B1, J9T-5, SNT-1, M5 | Sonnet 5.5 · high |
| K2 | Preuve de fin de RK : trois passages `pnpm check` + `pnpm test:e2e`, durées relevées, cases cochées avec leur preuve ; recette du fondateur | test + doc | B3, m5 | Sonnet 5.5 · medium (puis fondateur) |
| K3 | Plan de durée e2e avant les écrans du Lot 2 (`testeur`) : mesure par spec, session réutilisée (`storageState`) plutôt qu'une connexion par test, répartition des workers ; nouveau budget proposé au fondateur | test | M1 | Opus 5.5 · high |
| K4 | `packages/web-platform` (passe-plat, client d'API, collecteur d'erreurs, configuration serveur) et `packages/ui` (tokens, polices) ; gardes d'empreinte remplacées par l'import ; arbitrage `architecte` d'abord (`02` §21.3) | code | M2 | Opus 5.5 · high |
| K5 | Découpage de `domains/backoffice/repository.ts` par sous-domaine (comptes, synchronisation, invitations, double validation, santé) à comportement constant ; les autres gros fichiers quand ils sont touchés | refactor | M3 | Sonnet 5.5 · high |
| K6 | Dette J9 reportée au Lot 2 : J9S-6 (cache 5 s de `/health`), J9S-7 (message navigateur non vérifié), J9S-9 (test de parité `0141`), J9T-8 (identifiants dans neuf titres), J9T-9 (planchers de `test:artifacts`) | code + test | `21` §8 | Sonnet 5.5 · high |
| K7 | `engines.node` à `>=24.12.0` ; justification des quatre `eslint-disable` | config | m1, m2 | Sonnet 5.5 · low |
| K8 | Logique des formulaires du backoffice vers des modules de vue (`AccountScreen` d'abord), comme dans `apps/web` | refactor | m3 | Sonnet 5.5 · medium |
| K9 | Renvois `CLAUDE.md §N` des spécifications et runbooks : table de correspondance ancienne → nouvelle numérotation, tri par date d'écriture (`git blame`), correction des seuls renvois antérieurs au 2026-10-05 | doc | M4 | Sonnet 5.5 · medium |
| K10 | Registre `decisions.md` compacté (énoncé en deux lignes, détail verbatim archivé) | doc | m4 | Sonnet 5.5 · medium (accord du fondateur) |

Ordre conseillé : K1 (rétablit la CI), K2, K7, puis K3 avec les arbitrages B2 ; K4 à K6 et K8 forment
naturellement le premier jalon du Lot 2 (« socle du Lot 2 »), sur le modèle des commits « dette »
de début de J5, J7 et J8.

---

## 4. Mécanisme proposé : la chaîne lot → jalons → commits (D77)

### 4.1 Ce qui change pour le fondateur

| Aujourd'hui (à la main) | Avec D77 |
|---|---|
| Demander le découpage du lot en jalons | `/lot-decoupe 2` écrit `jalons/lot2-plan.md` et **s'arrête pour validation** |
| Demander le découpage d'un jalon en commits, puis un prompt par commit | `/jalon-prepare L2A` écrit la fiche, un prompt par commit et la table d'exécution, puis **s'arrête pour validation** |
| `/clear`, `/model`, coller le prompt, attendre, recommencer | `/jalon-run L2A` enchaîne les commits, **chacun dans un sous-agent neuf** au modèle et à l'effort de la table ; la session principale ne garde que des comptes rendus de 15 lignes |
| Repérer qu'une revue demande des correctifs et s'arrêter | Arrêt automatique (§4.3), constats et prompts de correction déjà écrits, reprise par `/jalon-run L2A` après accord |

### 4.2 Les pièces

- **Quatre skills génériques** dans `.claude/skills/`, à invocation manuelle seule
  (`disable-model-invocation: true` : aucun coût de description dans les sessions) :
  - `lot-decoupe <lot>` : lit `00` §7 (le lot), `21` §7 et §8, le registre et les seules sections
    de l'index ; écrit `docs/mvp/jalons/lot<N>-plan.md` (jalons, objectif, specs citées par
    tranche, décisions préalables, critère de fin, nombre de commits estimé). Opus 5.5, high.
  - `jalon-prepare <id>` : écrit `jalons/<id>-fiche.md` (le contrat : commits aux titres imposés,
    invariants, tests, tranches à lire avec leurs lignes, critère de fin), `jalons/<id>/NN.md`
    (un prompt de 2 Ko au plus par commit, sur le gabarit éprouvé de `rk-commit`) et
    `jalons/<id>/run.md` (ordre, fichier, modèle, effort, type `commit | revue | ux | recette`,
    état). Opus 5.5, high.
  - `jalon-commit <id> <n>` : version générique de `rk-commit` (règles de session sobres, un seul
    commit, ligne de `21` §8, cadence de push et de CI de `CLAUDE.md` §7 règle 5) ; finit par une
    ligne lisible par machine : `ETAT: livre <sha>` ou `ETAT: arret <motif>`.
  - `jalon-run <id>` : l'orchestrateur. Pour chaque ligne en attente de `run.md`, lance un
    sous-agent neuf avec le modèle et l'effort de la table et la consigne d'appliquer
    `jalon-commit` ; lit le compte rendu, met `run.md` à jour, suit la CI en arrière-plan après un
    push, passe à la suivante.
- **La revue de fin de jalon** est une ligne `revue` de `run.md` : `testeur` et
  `expert-cybersecurite` en parallèle, constats consolidés dans la fiche (`<id>T-n`, `<id>S-n`),
  puis un prompt `fix-NN.md` par correctif ajouté à `run.md` à l'état « à valider ».
- **Un crochet `PreToolUse`** (`.claude/settings.json`, script `node` de quelques lignes) refuse
  `Read` sans `limit` sur `docs/mvp/[0-9]*.md` et `docs/mvp/INDEX.md`, avec le rappel « index par
  Grep, puis offset/limit » : la règle d'économie devient mécanique au lieu d'être un rappel.
- **`CLAUDE.md` §7 règle 5** se réduit à un renvoi vers `jalon-commit`, qui porte le détail des
  tests et du push : environ 3 Ko de moins dans chaque session.

### 4.3 Points d'arrêt (rien ne continue sans le fondateur)

1. Découpage du lot et prompts d'un jalon : validation explicite.
2. **Revue de fin de jalon qui demande un correctif** : arrêt, constats et prompts écrits, exécution
   après accord, puis attestation `security-reviewed:` et clôture.
3. `ETAT: arret` d'un commit : même échec deux fois (escalade d'un cran de modèle proposée), valeur
   visuelle ou décision manquante, invariant touché, `EC` structurant.
4. CI rouge qu'un correctif automatique n'a pas rétablie.
5. Ligne `ux` ou `recette` : action humaine.
6. Toute action réservée par `CLAUDE.md` §7 règle 4 (production, création de ressource, DNS).

### 4.4 Politique de modèle par défaut (surchargeable ligne par ligne dans `run.md`)

| Tâche | Modèle · effort |
|---|---|
| Découpage, fiche, arbitrage, revue de sécurité | Opus 5.5 · high |
| Migration, RLS, fonction `SECURITY DEFINER`, anonymisation | Opus 5.5 · high (xhigh si invariant D45/D46) |
| Route, écran, test, refactor à comportement constant | Sonnet 5.5 · high |
| Documentation, clôture, correctif simple | Sonnet 5.5 · medium |
| Escalade après deux échecs de même cause | un cran au-dessus (Sonnet → Opus 5.5 ; Opus xhigh → Fable 5.1) |

### 4.5 Ce qu'il faut trancher (D77)

1. La chaîne et ses points d'arrêt (§4.3).
2. L'exécution par sous-agents neufs dans une seule session (recommandé : visible dans VS Code,
   aucun processus à installer), plutôt qu'un script `claude -p` en ligne de commande.
3. Le crochet de lecture.
4. La politique de modèle (§4.4).

Après accord : un commit `chore(claude)` par pièce (skills, crochet, `CLAUDE.md` §7), D77 passée
à « tranchée », puis `/lot-decoupe 2` comme premier usage.
