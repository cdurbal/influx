---
name: lot-decoupe
description: Découpe un lot du MVP INFLUX en jalons (D77) — écrit docs/mvp/jalons/lot<N>-plan.md à partir du cadrage, du plan et de l'index, puis s'arrête pour la validation du fondateur. Invocation manuelle seulement.
disable-model-invocation: true
argument-hint: "<numéro du lot> [force]"
---

# `/lot-decoupe` — un lot en jalons (D77)

Arguments reçus : `$ARGUMENTS`

## 0. Avant de commencer

- **Modèle attendu : Opus 5.5, effort xhigh** (D77, politique de modèle). Ton prompt système nomme ton
  modèle ; s'il diffère et que `force` manque, réponds en une ligne « lot-decoupe : Opus 5.5 · xhigh.
  `/model`, puis relance (ou ajoute `force`). » et arrête-toi. L'effort n'est pas vérifiable : écris
  « Effort recommandé : xhigh ».
- `docs/mvp/jalons/lot<N>-plan.md` existe déjà : n'écrase rien, propose la révision sous forme de
  différences et arrête-toi.

## 1. Lire (et rien d'autre)

1. `docs/mvp/00-cadrage-mvp-v2.md` §7, la seule partie du lot : lignes par `Grep "^## 00-" -A 70` dans
   `docs/mvp/INDEX.md`, puis `Read` borné.
2. `docs/mvp/21-plan-de-developpement.md` §7 (ligne du lot) et §8 (reliquat à échéance du lot).
3. `docs/mvp/decisions.md` : `Grep` des seules décisions citées (jamais le fichier entier).
4. Chaque spécification du lot : sa table dans l'index (`Grep "^## <nn>-" -A 70`) ; puis, bornées,
   ses sections « Questions ouvertes » et « Critères d'acceptation », et dans `04` les migrations et
   tables du lot.
5. `docs/mvp/18-plan-de-test-mvp.md` : les familles de tests que `21` §7 associe au lot (`Grep`).

Aucun sous-agent. Pas de lecture de code, sauf `ls` ou `Grep` pour vérifier qu'un module existe.

## 2. Écrire `docs/mvp/jalons/lot<N>-plan.md` (12 Ko au plus)

```markdown
# Lot <N> — <titre> : découpage en jalons
> <date> · Claude Code (`/lot-decoupe`, D77) · Statut : **à valider par le fondateur**

## Préalables
| Décision ou question | Arbitre | Bloque quel jalon | État |

## Jalons
| ID | Objectif (une phrase) | Spécifications (tranches) | Migrations | Écrans | Tests porteurs | Dépend de | Commits estimés | Critère de fin |

## Reliquat repris (`21` §8)
| # | Jalon qui le traite |

## Risques et budget
Durée e2e et CI ajoutées par jalon ; invariants exposés (anonymisation, RLS, D45, D46, D48).

## Questions au fondateur
```

Règles de découpage :

- un jalon = 4 à 10 commits, un livrable démontrable sur `staging`, un critère de fin constatable ;
- ordre de `21` §7 : décisions, migrations avec droits et tests de droits (T2), API, écrans, e2e ;
- identifiants `L<N><lettre>` (L2A, L2B…) ; fiche future `jalons/l<n><lettre>-fiche.md` ;
- chaque reliquat de `21` §8 à échéance du lot reçoit un jalon (souvent un commit « dette » en tête
  du premier) ;
- chaque skill du domaine du lot de plus de 10 Ko (`wc -c .claude/skills/*/SKILL.md`) reçoit un
  commit « dette skill » en tête du premier jalon (`sonnet` · `high`) : `SKILL.md` de 10 Ko au plus
  (règles, check-list, pointeurs), le reste dans `references/` lu à la demande, renvois aux
  spécifications plutôt que recopies, contradictions avec `decisions.md` corrigées (amendement D77
  du 2026-11-13) ;
- une décision non tranchée ne s'invente pas : elle va dans « Préalables » avec son arbitre
  (`CLAUDE.md`, règle d'or).

## 3. Arrêt

Ne commite rien : le plan est commité avec la première fiche (`/jalon-run`, ouverture). Réponse
finale de 20 lignes au plus : jalons en une ligne chacun, préalables bloquants, questions. Dernière
ligne, seule : `ETAT: arret validation-fondateur`. Après accord : `/jalon-prepare <ID>` du premier
jalon.
