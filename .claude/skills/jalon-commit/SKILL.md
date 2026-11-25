---
name: jalon-commit
description: Exécute une ligne d'un jalon INFLUX préparé par /jalon-prepare (D77) — règles de session sobres en tokens, un seul commit, ligne ETAT finale. Lancé par /jalon-run dans un sous-agent neuf, ou à la main. Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<id> <n> [force] [run]"
---

# `/jalon-commit` — une ligne de jalon (D77)

Arguments reçus : `$ARGUMENTS` (`run` : lancé par `/jalon-run`, dans un sous-agent neuf).

## 1. La tâche

Lis `docs/mvp/jalons/<id>/run.md`, ligne `<n>` : fichier, type, modèle, effort, agent. Ligne absente :
liste les lignes `à faire`, puis `ETAT: arret argument`.

Hors `run` seulement :

1. **Modèle** : le tien (ton prompt système le nomme) diffère de la ligne et `force` manque : une
   ligne « <ID>-<n> : <modèle> · <effort>. `/model`, puis `/jalon-commit <id> <n>` (ou `force`). »,
   puis `ETAT: arret modele`.
2. **Effort** : non vérifiable ; écris « Effort recommandé : <effort> ».
3. **Session** : la conversation porte déjà un autre commit : recommande `/clear`, arrêt sauf `force`.

Toujours : **ordre** — chaque ligne au-dessus est `fait` ou `ignoré`, sinon `ETAT: arret ordre <ligne>`
sauf `force`.

## 2. Lire

1. `docs/mvp/jalons/<id>-fiche.md` en entier : le contrat. `<id>/annexe.md` : seulement pour les
   types `revue`, `fix` et `cloture`, ou si le prompt la cite (section citée seulement).
2. `docs/mvp/jalons/<id>/<fichier>`, et les « Notes du commit précédent » si le prompt en porte.
3. Les seules tranches citées : l'index par `Grep`, puis `Read` borné (le crochet D77 refuse la
   lecture entière d'un gros document). `docs/mvp/archives/` : seulement pour un identifiant cité.
4. Code : les fichiers nommés, puis `Grep` ciblé ; au-delà de 800 lignes, lecture par tranches.
5. La grille de l'agent nommé (`.claude/agents/<agent>.md`), si le prompt la cite ; sa règle de
   branche ne s'applique pas (commit direct sur `main`, `CLAUDE.md` §5).

## 3. Règles de session

- Travaille toi-même, sans sous-agent.
- Invariants : ceux de la fiche, plus `CLAUDE.md` §2 (aucun taux ni calcul de commission) et §5
  (règles non négociables). Invariant qui ne tient pas, décision absente, valeur visuelle sans
  token : `ETAT: arret decision <question>`. Rien ne s'invente.
- Pendant le travail, le seul fichier de test en cours, sortie filtrée (`| tail -n 40`) :
  `pnpm --filter <paquet> test -- <fichier> --reporter=dot` ;
  base : `pnpm --filter @influx/api test:db -- <fichier> --reporter=dot` ;
  e2e : `pnpm --filter @influx/web exec playwright test <spec> --reporter=line`.
- Même test rouge après deux corrections : `ETAT: arret echec-repete <cause probable>`.
- Micro-écart sans invariant : le choix le plus sûr, noté `EC-<ID>-<n>-<k>` dans la réponse.
- Planchers (`packages/test-kit/src/case-floors.ts`) relevés quand des tests s'ajoutent, jamais
  baissés ; attendus des tests existants inchangés, sauf si le prompt le demande.

## 4. Avant le commit (`CLAUDE.md` §7 règle 5, D76)

Selon `git diff --cached --name-only` : documentation seule, rien ; code, `pnpm check:fast` ; base
touchée, en plus les `db-tests/` du domaine (toute la suite base pour une migration ou une RLS) ;
écran, sa spec Playwright ; dépendance, suite complète.

## 5. Le commit

- Un seul, au titre imposé par la fiche ; corps en anglais de 2 à 4 lignes ; ligne d'attribution
  donnée par le système.
- Dans le même commit, la ligne `<n>` de `run.md` passe à `fait`, avec l'invariant clé en note
  (**160 caractères au plus** ; le détail va dans le corps du commit).
- **Autres sessions sur le même arbre** : `git add <tes fichiers>` et `git commit` dans la même
  commande, après `git diff --cached --name-only` vide ou limité à tes fichiers ; jamais
  `git add -A`, `git mv`, `reset`, ni `--amend` d'un commit qui n'est pas le tien et `HEAD`.
- Push : en mode `run`, jamais (l'orchestrateur pousse). À la main : par lot de 3 à 4 commits, en fin
  de jalon ou à la demande, puis `gh run watch <id> --exit-status` en arrière-plan.

Types sans code : `ux` ne commite rien ; `arbitrage` commite son écrit (fiche ou `decisions.md`) ;
`fondateur` : écris la question exacte, `ETAT: arret fondateur`.

## 6. Réponse finale (15 lignes au plus)

Livré, tests et planchers, `EC`, ce que la ligne suivante doit savoir (3 lignes au plus, sous
« Notes pour la suite »). **Dernière ligne, seule :** `ETAT: livre <sha court>` (ou
`ETAT: livre aucun-commit`) ou `ETAT: arret <motif> — <détail en une phrase>`. Motifs : `argument`,
`modele`, `ordre`, `decision`, `invariant`, `echec-repete`, `fondateur`.
