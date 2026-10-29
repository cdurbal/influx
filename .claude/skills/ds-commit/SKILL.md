---
name: ds-commit
description: Lance un commit du jalon DS (charte KEO Emerald, D73) dans une session neuve — règles de session sobres en tokens, lectures par tranches, modèle et effort recommandés. Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<1-14 | 12a | 12b | revue | ux N> [force]"
---

# `/ds-commit` — un commit du jalon DS par session

Arguments reçus : `$ARGUMENTS`

## 1. La tâche

Normalise l'argument (`4`, `DS-4`, `ds4` → `4` ; `12A` → `12a`). Lis **le seul** fichier de sa ligne,
dans le dossier de cette skill ; aucun autre fichier de `commits/`. Argument absent ou inconnu (`12`
seul compris) : réponds par la liste des arguments valides et arrête-toi.

| Argument | Fichier | Modèle | Effort | Préalable du fondateur |
|---|---|---|---|---|
| `1` | `commits/ds-1.md` | Opus 5.5 | high | — |
| `2` | `commits/ds-2.md` | Sonnet 5.5 | high | F4, F5 |
| `3` | `commits/ds-3.md` | Sonnet 5.5 | medium | — |
| `4` | `commits/ds-4.md` | Opus 5.5 | high | F1, F2 |
| `5` | `commits/ds-5.md` | Sonnet 5.5 | high | F3, F6 |
| `6` | `commits/ds-6.md` | Opus 5.5 | high (xhigh si TD5 résiste) | — |
| `7` | `commits/ds-7.md` | Sonnet 5.5 | medium | — |
| `8` | `commits/ds-8.md` | Sonnet 5.5 | medium | — |
| `9` | `commits/ds-9.md` | Sonnet 5.5 | medium | — |
| `10` | `commits/ds-10.md` | Opus 5.5 | medium | F7 |
| `11` | `commits/ds-11.md` | Sonnet 5.5 | medium | — |
| `12a` | `commits/ds-12a.md` | Sonnet 5.5 | medium | — |
| `12b` | `commits/ds-12b.md` | Sonnet 5.5 | medium | — |
| `14` | `commits/ds-14.md` | Sonnet 5.5 | medium | F2 accepté |
| `13` | `commits/ds-13.md` | Sonnet 5.5 | medium | — |
| `revue` | `commits/revue.md` | Opus 5.5 | high | — |
| `ux N` | `commits/ux.md` | Opus 5.5 | medium | — |

Ordre : `1` à `12b`, puis `14` si F2 est accepté, puis `13`, puis `revue`. `ux 6`, `ux 8`, `ux 10` et
`ux 12` suivent les commits de même numéro.

## 2. Avant de commencer (sans rien lire d'autre)

1. **Modèle.** Compare ton modèle (ton prompt système le nomme) à celui de la table. S'il diffère et que
   `force` manque : réponds en une ligne « DS-<id> : <modèle> · effort <effort>. `/model`, puis
   `/ds-commit <id>` (ou ajoute `force`). » et arrête-toi.
2. **Effort.** Tu ne peux pas le vérifier : écris « Effort recommandé : <effort> » et continue.
3. **Session.** Si la conversation contient déjà le travail d'un autre commit DS : recommande `/clear` et
   arrête-toi, sauf `force`.
4. **Préalable.** Point F requis : vérifie par `Grep` dans `docs/mvp/decisions.md` (D73) qu'il est
   tranché. Sinon, arrête-toi en le citant ; avec `force`, applique la recommandation de la fiche
   (§ Préalables du fondateur) et note-le en EC.

## 3. Règles de session

- Point d'entrée : `docs/mvp/jalons/ds-fiche.md`, lu en entier. Ensuite, seulement les tranches citées
  par le fichier de la tâche : `NN@L+n` = `docs/mvp/NN-*.md`, `Read` offset=L limit=n (lignes au
  2026-10-28 ; si le texte a bougé, `docs/mvp/INDEX.md` fait foi). Jamais une spec entière ;
  `design-proposals/` fermé, sauf mention contraire.
- Travaille toi-même, sans sous-agent (`dev-react-node`, `expert-ux` et `expert-cybersecurite` sont
  épinglés sur Opus et repartent à froid). Applique `.claude/agents/dev-react-node.md`, sauf sa règle
  de branche : commit direct sur `main` (`CLAUDE.md` §7).
- Attendus des e2e existants et tests de logique : jamais modifiés. G1 à G7 jamais assouplies. Un échec
  d'axe se corrige dans les jetons, sans valeur de couleur nouvelle ; s'il en faut une, arrête-toi et
  liste la paire pour `expert-ux`.
- Pendant le travail : le seul fichier de test en cours (vitest `--reporter=dot` ; e2e :
  `pnpm --filter @influx/web exec playwright test <spec> --reporter=line`), sorties filtrées
  (`| tail -n 40`). Même test en échec après deux corrections : arrête-toi et résume la cause probable
  et la piste (l'utilisateur relancera avec plus d'effort).
- Micro-écart sans invariant : choix le plus sûr, noté `EC-DS-<id>-<n>` dans la réponse finale, aucun
  commit docs.
- Avant le commit : vérification par paliers de `CLAUDE.md` §7 règle 5 selon les fichiers indexés
  (`test:db` seulement si la base est touchée), plus `pnpm test:e2e` si un écran change. Tout
  nouveau fichier de test reçoit son plancher (`case-floors.ts`).
- Un seul commit, au titre imposé (Conventional Commits). Dans ce commit,
  `docs/mvp/21-plan-de-developpement.md` § Jalon DS : complète le sha de la ligne DS précédente s'il
  manque, ajoute `- [x] DS-<id> — <invariant clé>`. `git add` des seuls fichiers du commit. Push, puis
  `gh run watch <id> --exit-status` (`gh run view <id> --log-failed` seulement en cas d'échec).
- Réponse finale en 15 lignes au plus : ce qui est livré, les EC, ce que le commit suivant doit savoir.

`revue` et `ux` ne commitent rien : les deux derniers points de commit ne s'y appliquent pas.
