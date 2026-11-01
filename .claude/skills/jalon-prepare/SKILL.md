---
name: jalon-prepare
description: Prépare un jalon INFLUX (D77) — fiche contrat, un prompt par commit et la table d'exécution run.md (ordre, modèle, effort, état), à partir du plan du lot ou d'une source citée, puis s'arrête pour la validation du fondateur. Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<id> [source : chemin et section] [force]"
---

# `/jalon-prepare` — fiche, prompts et table d'exécution (D77)

Arguments reçus : `$ARGUMENTS`

## 0. Avant de commencer

- **Modèle attendu : Opus 5.5, effort xhigh.** S'il diffère et que `force` manque : une ligne
  « jalon-prepare : Opus 5.5 · xhigh. `/model`, puis relance (ou `force`). » et arrêt. Écris
  « Effort recommandé : xhigh ».
- Source : la ligne du jalon dans `docs/mvp/jalons/lot<N>-plan.md`, ou la source donnée en argument
  (par exemple `docs/mvp/revue-pre-lot2-2026-10-31.md §3`). Aucune source : arrêt.
- `jalons/<id>-fiche.md` existe : n'écrase rien, propose les différences, arrêt.

## 1. Lire

La source ; pour chaque commit, les seules tranches utiles (index par `Grep`, puis `Read` borné ; le
crochet D77 refuse le reste) ; dans le code, `ls`, `Grep` et `wc -l` pour nommer les fichiers exacts
et leur taille. Aucun sous-agent. But : que chaque prompt cite des lignes, pas des documents.

## 2. Écrire

`docs/mvp/jalons/<id>-fiche.md` — le contrat, **25 Ko au plus** (lu en entier à chaque commit) :

```markdown
# Jalon <ID> — <titre>
> Source · date · Statut : à valider | ouvert | clos
## Objectif et périmètre            (10 lignes au plus ; ce qui ne change pas)
## Invariants                       (liste numérotée, chacun vérifiable)
## Lectures                         (fichier, section, lignes ; par commit si elles diffèrent)
## Commits                          | # | Titre imposé (Conventional Commits) | Contenu | Tests |
## Tests                            (identifiants, niveau, ce qu'ils prouvent ; planchers)
## Critère de fin                   (cases, chacune avec la preuve attendue)
## Écarts, décisions ouvertes, risques
## Revue                            (rempli par /jalon-run : <ID>T-n, <ID>S-n)
```

`docs/mvp/jalons/<id>/NN.md` — un prompt par ligne, **2 Ko au plus**, sur ce gabarit :

```markdown
# <ID>-<NN> — `<titre imposé>`
Grille `<agent>`. Skill : `<skill>` (seulement si utile).
**Lire :** fiche §… ; `<spec>` §… (l. a à b) ; code : fichiers nommés.
**Livrer :** puces vérifiables.
**Ne pas toucher :** …
**Prouver :** tests par identifiant, planchers, commandes exactes.
**Arrêt si :** conditions propres à ce commit.
```

Plus `revue.md` (une section « Pour `testeur` », une section « Pour `expert-cybersecurite` » :
plage, invariants à vérifier, format des constats) et `cloture.md` (cases du critère cochées avec
leur preuve, `pnpm check` puis `pnpm test:e2e`, ligne de clôture dans `21` §8, attestation
`security-reviewed: <date> covers <sha>…` si la revue est soldée, fiche et dossier déplacés dans
`archives/jalons/`).

`docs/mvp/jalons/<id>/run.md` — la table d'exécution, seul état du jalon :

```markdown
# Exécution du jalon <ID>
| # | Fichier | Type | Modèle | Effort | Agent | État | Note |
|---|---|---|---|---|---|---|---|
| 01 | 01.md | commit | sonnet | high | dev-react-node | à faire | |
| R | revue.md | revue | — | — | testeur + expert-cybersecurite | à faire | |
| C | cloture.md | cloture | sonnet | medium | — | à faire | |
```

Types : `commit`, `arbitrage` (un agent tranche et l'écrit), `fondateur` (décision ou recette
humaine : arrêt), `ux` (constats `expert-ux`, sans commit), `revue`, `fix` (ajouté par la revue),
`cloture`. États : `à faire`, `fait`, `arrêt`, `à valider`, `ignoré`. Modèles : `opus`, `sonnet`,
`haiku`, `fable` ; efforts : `low` à `max`.

## 3. Politique de modèle (D77, surchargeable ligne par ligne)

| Tâche | Modèle · effort |
|---|---|
| Découpage, fiche, arbitrage, revue de sécurité | opus · xhigh |
| Migration, RLS, `SECURITY DEFINER`, anonymisation, passe-plat | opus · high (xhigh si D45 ou D46) |
| Route, écran, test, refactor à comportement constant | sonnet · high |
| Documentation, clôture, correctif simple | sonnet · medium |
| Revue `testeur` | sonnet · high |

## 4. Règles de découpage

Un commit = un prompt = un titre imposé ; ordre de `21` §7 ; un commit « dette » en tête si le
reliquat en porte ; budget de durée e2e chiffré par commit qui ajoute des parcours ; commit touchant
`audit.*`, une politique, un `GRANT` ou `supabase/config.toml` signalé (marqueur `security-reviewed:`
à la revue, `03` I-4) ; une décision absente devient une ligne `fondateur` ou `arbitrage`, jamais
une hypothèse.

## 5. Arrêt

Ne commite rien (`/jalon-run` commite l'ouverture). Réponse de 20 lignes au plus : table des lignes
(type, modèle, effort), arrêts prévus, questions. Dernière ligne : `ETAT: arret validation-fondateur`.
Après accord : `/jalon-run <id>`.
