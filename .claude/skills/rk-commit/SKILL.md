---
name: rk-commit
description: Lance un commit du jalon RK (réalignement sur la référence KEO Emerald, D75) dans une session neuve — règles de session sobres en tokens, lectures par tranches, modèle et effort recommandés. Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<0-10 | 5a | 5b | revue | ux 4|6|9|fin> [force]"
---

# `/rk-commit` — un commit du jalon RK par session

Arguments reçus : `$ARGUMENTS`

## 1. La tâche

Normalise l'argument (`4`, `RK-4`, `rk4` → `4` ; `5A` → `5a`). Lis **le seul** fichier de sa ligne,
dans le dossier de cette skill ; aucun autre fichier de `commits/`. Argument absent ou inconnu (`5`
seul compris) : réponds par la liste des arguments valides et arrête-toi.

| Argument | Fichier | Modèle | Effort |
|---|---|---|---|
| `0` | `commits/rk-0.md` | Opus 5.5 | high |
| `1` | `commits/rk-1.md` | Opus 5.5 | xhigh |
| `2` | `commits/rk-2.md` | Sonnet 5.5 | high |
| `3` | `commits/rk-3.md` | Sonnet 5.5 | high |
| `4` | `commits/rk-4.md` | Sonnet 5.5 | high |
| `5a` | `commits/rk-5a.md` | Sonnet 5.5 | high |
| `5b` | `commits/rk-5b.md` | Sonnet 5.5 | medium |
| `6` | `commits/rk-6.md` | Sonnet 5.5 | high |
| `7` | `commits/rk-7.md` | Sonnet 5.5 | medium |
| `8` | `commits/rk-8.md` | Sonnet 5.5 | high |
| `9` | `commits/rk-9.md` | Sonnet 5.5 | medium |
| `revue` | `commits/revue.md` | Opus 5.5 | high |
| `10` | `commits/rk-10.md` | Sonnet 5.5 | medium |
| `ux N` | `commits/ux.md` | Opus 5.5 | medium |

Ordre : `0`, `1`, `2`, `3`, `4`, `ux 4`, `5a`, `5b`, `6`, `ux 6`, `7`, `8`, `9`, `ux 9`, `revue`, `10`,
`ux fin`. Escalade : un commit qui bute deux fois sur la même cause se relance un cran plus haut
(Sonnet → Opus 5.5 high ; Opus xhigh → Fable 5.1 high, réservé à RK-1).

## 2. Avant de commencer (sans rien lire d'autre)

1. **Modèle.** Compare ton modèle (ton prompt système le nomme) à celui de la table. S'il diffère et que
   `force` manque : réponds en une ligne « RK-<id> : <modèle> · effort <effort>. `/model`, puis
   `/rk-commit <id>` (ou ajoute `force`). » et arrête-toi.
2. **Effort.** Tu ne peux pas le vérifier : écris « Effort recommandé : <effort> » et continue.
3. **Session.** Si la conversation contient déjà le travail d'un autre commit RK : recommande `/clear` et
   arrête-toi, sauf `force`.
4. **Ordre.** `git log --oneline -15` : le commit précédent de l'ordre doit être présent (titres imposés
   de la fiche). Sinon, arrête-toi en le citant, sauf `force`.

## 3. Règles de session

- Point d'entrée : `docs/mvp/jalons/rk-fiche.md`, lu en entier ; c'est le contrat. Ensuite, seulement
  les tranches citées par le fichier de la tâche : localise la section dans `docs/mvp/INDEX.md` (ou par
  `Grep` sur son titre), puis `Read` avec `offset`/`limit`. Jamais une spec entière ;
  `design-proposals/` fermé, sauf mention contraire.
- Travaille toi-même, sans sous-agent (les agents du projet sont épinglés sur Opus et repartent à
  froid). Applique la grille de l'agent nommé par la tâche (`.claude/agents/<nom>.md`), sauf sa règle
  de branche : commit direct sur `main` (`CLAUDE.md` §7).
- Invariants du jalon : aucune règle métier, donnée, migration, route d'API, clé de traduction ; vitrine
  intacte (G3e, TD4, TK8) ; `tokens.css` identique octet pour octet dans les deux fronts ; aucune valeur
  de couleur nouvelle hors RK-B ; `color-mix` limité à la liste de RK-A ; jamais de modificateur `/NN`
  sur une couleur ; attendus des e2e existants jamais modifiés ; G1 à G9 jamais assouplies (seule G8
  s'étend, TK7.3 et TK7.4).
- Filet (à partir de RK-2) : chaque commit retire le `test.fail()` de **ses** cas TK, vérifie qu'ils
  passent, et relève les planchers (`case-floors.ts`) ; aucun plancher ne baisse.
- Une valeur visuelle ou un contraste qui ne tient pas : arrête-toi et liste la paire pour `expert-ux` ;
  ne crée aucune valeur.
- Pendant le travail : le seul fichier de test en cours (vitest `--reporter=dot` ; e2e :
  `pnpm --filter @influx/web exec playwright test <spec> --reporter=line`), sorties filtrées
  (`| tail -n 40`). Même test en échec après deux corrections : arrête-toi et résume la cause probable
  et la piste (l'utilisateur relancera un cran plus haut).
- Micro-écart sans invariant : choix le plus sûr, noté `EC-RK-<id>-<n>` dans la réponse finale, aucun
  commit docs.
- Avant le commit : vérification de `CLAUDE.md` §7 règle 5 (D76) selon les fichiers indexés
  (`pnpm check:fast` ; `test:db` jamais nécessaire dans ce jalon, sauf dépendance touchée), plus les
  specs Playwright du ou des écrans touchés ; `pnpm test:e2e` complet au dernier commit du jalon.
- Un seul commit, au titre imposé par la fiche (Conventional Commits). Dans ce commit,
  `docs/mvp/21-plan-de-developpement.md` § Jalon RK : complète le sha de la ligne RK précédente s'il
  manque, ajoute `- [x] RK-<id> — <invariant clé>` (une ligne, aucun récit). `git add` des seuls
  fichiers du commit. Push par lot (D76) : seulement si 3 commits au moins attendent, au dernier
  commit du jalon ou à la demande du fondateur ; sinon, le dire dans la réponse finale (« non
  poussé, N commits en attente »). Après un push, `gh run watch <id> --exit-status` en arrière-plan
  (`gh run view <id> --log-failed` seulement en cas d'échec, corrigé avant tout nouveau commit).
- Réponse finale en 15 lignes au plus : ce qui est livré, les EC, ce que le commit suivant doit savoir.

`revue` et `ux` ne commitent rien : les deux derniers points de commit ne s'y appliquent pas.
