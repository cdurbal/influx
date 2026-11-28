# Lot 3bis — Refonte UX/UI des écrans existants : découpage en jalons
> 2026-11-25 · Claude Code (mission du fondateur, format D77) · Statut : **lot et premiers arbitrages validés par le fondateur le 2026-11-25 (D87)** ; aucun code sans accord distinct

Sources : `../22-refonte-ux-ui.md` et son dossier (fiches d'écran, composants, tokens, matrice, décisions).
Détail des 105 tâches : `../22-refonte-ux-ui/08-plan-de-developpement.md` (une tâche = une ligne de jalon).
Identifiants `RUA` à `RUL` (lot hors numérotation entière, comme DS, SN, RK) ; fiches `archives/jalons/rua-fiche.md`, `archives/jalons/rub-fiche.md`…
**Avancement** : RUA ✅ clos le 2026-11-25 (archivé : `archives/jalons/rua-fiche.md`) ; RUB ✅ clos le 2026-11-28 (archivé : `archives/jalons/rub-fiche.md`) ; RUC suivant.
**Charge relue (RUB)** : 35 commits pour 10 estimés : 13 de lignes de code (X1 à 11), 13 de correction (11 `fix` et 2 correctifs de test), 9 de documents, en 4 jours calendaires (2026-11-25 à 2026-11-28), soit ≈ 0,11 jour par commit ; les arrêts du fondateur (F0, F1, validation des `fix`) bornent la durée. L'estimation en jours de `08` §16 reste à relire avec un premier jalon d'écran (RUE).

## Préalables
| Décision ou question | Arbitre | Bloque quel jalon | État |
|---|---|---|---|
| RU-00 numéro, code et place du lot | Fondateur | Tous | ✅ 2026-11-25 (D87) |
| RU-01 à RU-20 : charte, tokens, mouvements, accessibilité, EN, partage React, fenêtres étroites | Fondateur, `expert-ux`, `architecte`, `expert-marketing` | RUA (RU-14 : chaque jalon membres) | Ouvertes |
| RU-21, RU-22 : lectures d'API additives, écritures | Fondateur, `architecte` | RUD et les écrans servis | RU-21 ✅ option B (D87) ; RU-22 ouverte |
| RU-23 à RU-25 : site web, page de marque, faits comparés | Fondateur, `architecte`, `expert-matching` | RUD, RUF, RUG, RUI | RU-23, RU-24 ✅ (D87) ; RU-25 ouverte |
| RU-26 à RU-29 : contenus absents, états et décisions sans maquette, délais | Fondateur, `expert-ux`, `product-owner` | Chaque jalon d'écran (RU-27 se tranche à la sortie de RUA-06) | RU-26 (principe), RU-28 ✅ (D87) ; RU-27, RU-29 ouvertes |
| RU-30 : textes réglementaires | `expert-conformite-rgpd`, juriste (D34) | RUE, RUI, RUJ, RUK | Principe ✅ (D87) : textes actuels ; avis à venir |
| RU-31 à RU-38 : règles membres | Fondateur, `product-owner`, `expert-matching` | RUE à RUI | RU-31, RU-37 ✅ (D87) ; autres ouvertes |
| RU-39 à RU-44 : gestes des agents, administration, aperçu, questions du fondateur | Fondateur, `product-owner`, `expert-cybersecurite` | RUC, RUH, RUJ, RUK | Ouvertes |

## Jalons
| ID | Objectif (une phrase) | Spécifications (tranches) | Migrations | Écrans | Tests porteurs | Dépend de | Commits estimés | Critère de fin |
|---|---|---|---|---|---|---|---|---|
| **RUA** | Spécifications amendées, tokens, gardes, outillage de comparaison et jeu de recette | `22` `03`, `04`, `05`, `06b` §4 | — | — | `guards`, `keo-tokens`, `vitrine-unchanged` ; N1 à N3 sur la maquette elle-même | RU-00 à RU-20 | 8 | Maquette contre maquette : 0 écart ; vitrine inchangée |
| **RUB** ✅ | Composants membres et coquille | `22` `02a`, `02b` ; E01.0 | — | Coquille membres | `member-primitives`, `member-shell`, `charter-*`, AN-2 | RUA | 10 | Planche d'états validée par `expert-ux` ; axe 0 |
| **RUC** | Composants, coquille et cadres du backoffice | `02a`, `02b` ; E04 (coquille) ; `17b` §1.7, §2 | — | Coquille BO, E19.1 | `bo-nav*`, `claimed-entry-view`, `backoffice-queue` | RUA ; RUB-07, RUB-09 pour RUC-07 | 9 | Cadre unique de décision sans changement de verrou ni de journal |
| **RUD** | Lectures d'API additives que les maquettes affichent (si RU-21 = B) | `06b` §5 ; §8 des fiches | `0335`… si RU-22 | — | T1, T2, T9, T14, TM11, TM12, suite base | RUA ; RU-21 à RU-25 | 9 | Aucun champ retiré ; droits et journal prouvés |
| **RUE** | Entrée, accueils, compte | E11, E01, E20 | — | 16 | `signup-*`, `journey-*`, `account*` | RUB ; RU-29, RU-30, RU-38 | 9 | Inscription à l'accueil, FR et EN, validée sur `staging` |
| **RUF** | Profils créateur et marque en assistants | E03, E10 | — | 15 | `creator-profile`, `creator-portfolio`, `brand-profile*` | RUB, RUI ; RU-31 à RU-33 | 9 | Aucun champ perdu ; publication et envoi inchangés côté serveur |
| **RUG** | Campagnes : assistant, liste, fiches, fil | E07, E12, E18, E08 | — | 11 | `brand-campaign*`, `creator-campaigns`, T16, test base CA2-bis | RUF-02, RUI, RUD ; RU-25, RU-35, RU-37 | 9 | Brouillon avant publication (D86) ; aucun montant créateur |
| **RUH** | Recherche, profil anonyme, sélections, aperçu créateur | E02, E02b, E09, E15 | — | 6 | T1, T9, TM12, `brand-creator-*`, `creator-preview` | RUB-09, RUD ; RU-02, RU-34, RU-43 | 9 | Anonymat rejoué ; parcours recherche à sélection au clavier |
| **RUI** | Vérifications, page de marque | E14, E05b.1, E18 §10 | — | 5 | `verification-*`, TM11 | RUE, RUD ; RU-24, RU-40 | 6 | « Mes vérifications » et page de marque sur `staging` |
| **RUJ** | Backoffice : tableau de bord, files, décisions | E04, E16, E05, E05b.2, E19.1 | — | 14 | specs de file, `verification-backoffice` | RUC, RUI-05, RUD ; RU-28, RU-39 | 11 | Neuf files traitées de bout en bout dans le cadre unique |
| **RUK** | Backoffice : fiches, recherche identifiée, administration | E06, E17, E13, E21 | — | 11 | `account-*`, `campaign-record`, `backoffice-identified-search`, `backoffice.spec` | RUJ, RUD ; RU-26, RU-41, RU-42 | 11 | Aucun geste d'exploitation perdu ; double validation intacte |
| **RUL** | Recette intégrale, revue, clôture | `22` `05` | — | 78 | `pnpm check`, `pnpm test:e2e`, N1 à N3, axe, AN | Tous | 5 | Dix critères de `05` §9 |

Total : 12 jalons, 105 commits. Ordre : A, B, D, E, I, F, G, H, C, J, K, L ; deux fils possibles, avec deux points de
rencontre (`08` §2 : RUC-07 et RUJ-05). Quand un écran sert deux jalons (E05b.2, E19.1), la dernière ligne le livre.

## Reliquat repris (`21` §8)
| # | Jalon qui le traite |
|---|---|
| L2AT-2, L2AT-3 (liens soulignés, retours d'erreur) | RUB-02, RUE-09 |
| L2BT-4, L2BT-5 (échec d'enregistrement et largeurs de M2) | RUF-08, RUF-09 |
| EC-L2C-15-1 (libellés membres à relire) | RUF-01 |
| D86 (non réalisée) | RUG-06, RUE-05 |
| Autres | Inchangés, à leur échéance |

## Risques et budget
- E2e : +20 s par jalon au plus, soit 3 min 20 sur dix jalons d'écran : les comparaisons N1 à N3 vont dans un
  projet Playwright **séparé**, hors éclats CI courants (à trancher en RUA-03 avec `integrateur`).
- Invariants exposés : anonymisation (RUH, RUI), montants (RUG), journal des lectures (RUC, RUK), consentement
  (RUE), RLS (RUD).
- Marqueur `security-reviewed:` : RUD (routes, droits), RUK (double validation), RUE (code, effacement).
- Skills de plus de 10 Ko du domaine : à mesurer par `/jalon-prepare rua` (`design-system-influx`, `backoffice-ops`
  allégés en L3A).

## Questions au fondateur
1 à 5 : **oui** le 2026-11-25 (D87). 6 : **oui**, écarts signalés dans `06a` compris ;
filtres du fil laissés de côté (RU-35). Restent : RU-22, RU-35 (tri, carte, fiche close), RU-39 (couleur des retards),
RU-44, les décisions ouvertes de `06a`, un ou deux fils de développement, et l'accord de démarrage.
