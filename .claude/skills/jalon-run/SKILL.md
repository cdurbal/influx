---
name: jalon-run
description: Orchestre un jalon INFLUX préparé (D77) — chaque ligne de run.md dans un sous-agent neuf au modèle et à l'effort prévus, push et CI selon D76, revue de fin de jalon, arrêts obligatoires (prompts à valider, revue qui demande un correctif, échec répété, décision manquante, CI rouge, recette). Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<id> [jusqu-a <n>] [valider <n,…|tout>] [escalade <n>]"
---

# `/jalon-run` — orchestrer un jalon (D77)

Arguments reçus : `$ARGUMENTS`

Tu es l'orchestrateur : tu ne codes pas et ne lis ni spécification ni code. Ton contexte ne garde
que `run.md`, la ligne `ETAT` de chaque compte rendu et ses notes pour la suite.

## 0. Ouverture

1. `docs/mvp/jalons/<id>/run.md` et `docs/mvp/jalons/<id>-fiche.md` existent, sinon :
   « `/jalon-prepare <id>` d'abord », arrêt.
2. `valider <lignes|tout>` : les lignes citées passent de `à valider` à `à faire` ; c'est l'accord du
   fondateur, reporté tel quel dans la note.
3. `escalade <n>` : la ligne monte d'un cran (sonnet vers opus à même effort ; opus `high` vers
   `xhigh` ; opus `xhigh` vers fable `high`) et repasse à `à faire`.
4. Fiche, dossier ou plan de lot non commités (`git status --short docs/mvp/jalons/`) : commit
   d'ouverture `docs(mvp): open jalon <ID>`, avec une ligne d'ouverture dans `21` §8 (le hook
   régénère l'index).
5. Note les commits non poussés (`git log origin/main..HEAD --oneline`).

## 1. Boucle

Première ligne `à faire`, dans l'ordre, jusqu'à `jusqu-a <n>` ou la fin :

- **`commit`, `arbitrage`, `fix`, `cloture`** : un sous-agent neuf,
  `Agent(subagent_type: "general-purpose", model: <Modèle>, effort: <Effort>, description: "<ID>-<n>")`,
  avec ce seul prompt : « Applique `.claude/skills/jalon-commit/SKILL.md` (lis-le d'abord) avec les
  arguments `<id> <n> run`. Notes du commit précédent : <au plus 3 lignes>. Termine par la ligne
  ETAT. »
  - `ETAT: livre <sha>` : vérifie `git log -1 --format=%h` et `fait` dans `run.md` ; continue.
  - `ETAT: arret …` : **arrêt**.
- **`ux`** : un sous-agent `expert-ux` avec le fichier de la ligne ; aucun commit ; un changement
  demandé : **arrêt**.
- **`fondateur`** : **arrêt**, avec la question exacte.
- **`revue`** : push d'abord (§2), puis **en parallèle** deux sous-agents, `testeur`
  (`model: sonnet`, `effort: high`) et `expert-cybersecurite` (`model: opus`, `effort: xhigh`),
  chacun avec sa section de `revue.md` et la plage du parent du premier commit du jalon à `HEAD`.
  Consigne : aucun fichier modifié ; constats `<ID>T-n` et `<ID>S-n`, gravité (bloquant, à corriger
  dans le jalon, avant production, plus tard), fichier et ligne, correctif en une phrase.
  - Rien de bloquant ni à corriger dans le jalon : ligne `fait` (constats reportés dans la note).
  - Sinon : un sous-agent neuf (`opus`, `xhigh`) écrit les constats dans la fiche § Revue et un
    prompt `fix-<k>.md` par correctif (gabarit de `jalon-prepare`), ajoutés à `run.md` avant la
    clôture, type `fix`, état `à valider` ; commit `docs(mvp): <ID> review findings` ; **arrêt** :
    le fondateur valide par `/jalon-run <id> valider …`.

## 2. Push et CI (D76)

- Push (`git push origin main`) quand 3 commits au moins attendent, avant la revue, après la
  clôture ou à la demande du fondateur. Avant : aucun de tes fichiers en attente, et
  `git log origin/main..HEAD` sans commit d'une autre session visiblement inachevé (sinon, le
  signaler et demander).
- Après chaque push : `gh run list --limit 1`, puis `gh run watch <id> --exit-status` **en
  arrière-plan** ; la boucle continue. Échec notifié : pause avant la ligne suivante ;
  `gh run view <id> --log-failed | tail -n 60`. Intermittent avéré (le test rouge n'a aucun lien avec
  le diff) : `gh run rerun <id> --failed`, une fois. Sinon, un sous-agent (`sonnet`, `high`) corrige
  la CI avec l'extrait du journal. Toujours rouge : **arrêt** `ci`.

## 3. Arrêts (rien ne continue sans le fondateur)

Lignes `à valider` · revue qui demande un correctif · `ETAT: arret` · CI rouge non rétablie · `ux`
qui demande un changement · `fondateur` · toute action de `CLAUDE.md` §7 règle 4. À l'arrêt, 10 lignes
au plus : la ligne, le motif, ce qui est fait, la commande de reprise exacte (`/jalon-run <id>`,
`… valider <lignes>`, `… escalade <n>`).

## 4. Fin

Toutes les lignes `fait` ou `ignoré` : résumé (commits, planchers, durée e2e, `EC` remontés, CI) et
cases de recette humaine encore ouvertes.
