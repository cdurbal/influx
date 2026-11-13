# Index des spécifications du MVP

> Fichier généré par `pnpm docs:index` : ne pas modifier à la main, régénérer après toute
> modification d'une spécification.
>
> **Ne jamais lire une spécification en entier.** Repérer ici la section utile, puis la lire avec
> `Read` (`offset` = ligne de départ, `limit` = nombre de lignes), ou chercher une règle précise
> avec `Grep` (exemple : `RG113` dans le fichier concerné).
>
> **Session de jalon : lire d'abord sa fiche**, qui cite déjà les tranches utiles :
> `jalons/l3b-fiche.md`.

## 00-cadrage-mvp-v2.md (~16k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 25 | 9 | 1. Le besoin en une phrase |  |
| 34 | 48 | 2. Ce qui change par rapport au cadrage du 2026-09-16 |  |
| 82 | 18 | 3. Les onze arbitrages du fondateur (2026-09-18) |  |
| 100 | 102 | 4. Le cœur du produit : la mise en relation courtée |  |
| 202 | 28 | 5. Objectif et indicateurs | RG112 |
| 230 | 102 | 6. Périmètre par persona | RG105–RG119 |
| 332 | 146 | 7. Découpage en sept lots — 18 à 25 semaines |  |
| 478 | 19 | 8. Ce qui sort du périmètre, et pourquoi |  |
| 497 | 34 | 9. Mode serré (objectif fin octobre) et reprise du mode normal |  |
| 531 | 29 | 10. Risques |  |
| 560 | 41 | 11. Décisions ouvertes |  |
| 601 | 21 | 12. Prérequis externes | RG9 |
| 622 | 27 | 13. Prochaines étapes |  |

## 01-intermediation-courtee.md (~12k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 22 | 43 | 1. Le problème, posé sans détour |  |
| 65 | 23 | 2. Ce qui protège réellement, par ordre d'efficacité décroissante |  |
| 88 | 54 | 3. Le processus complet, du déclencheur à la commission encaissée |  |
| 142 | 53 | 4. Les trois déclencheurs |  |
| 195 | 126 | 5. Les mécanismes M1 à M7, recalibrés |  |
| 321 | 79 | 6. Le pipeline commercial |  |
| 400 | 24 | 7. La règle absolue : aucun calcul de commission |  |
| 424 | 61 | 8. La matière de la clause de non-contournement, pour le juriste |  |
| 485 | 26 | 9. Les données à créer en base dès maintenant |  |
| 511 | 28 | 10. Les limites assumées par écrit |  |
| 539 | 13 | 11. Indicateurs |  |
| 552 | 14 | 12. Décisions ouvertes |  |
| 566 | 20 | 13. Ce qui change en V2 |  |

## 02-architecture-3-espaces.md (~64k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 44 | 27 | 0. Synthèse |  |
| 71 | 20 | 1. Ce que le métier impose à l'architecture |  |
| 91 | 152 | 2. La règle architecturale centrale |  |
| 243 | 99 | 3. D12 — Place du backoffice |  |
| 342 | 117 | 4. D2 — Framework backend Node |  |
| 459 | 169 | 5. D5 — Accès aux données |  |
| 628 | 96 | 6. D18 — File de synchronisation des leads |  |
| 724 | 107 | 7. D37 — Méthode d'authentification *(décision nouvelle)* |  |
| 831 | 124 | 8. Structure du dépôt cible |  |
| 955 | 124 | 9. Le contrat entre l'API et les fronts |  |
| 1079 | 60 | 10. Où s'applique la RLS, et où elle ne suffit pas |  |
| 1139 | 51 | 11. Le worker |  |
| 1190 | 198 | 12. Conséquences sur Railway et Supabase | RG9–RG165 |
| 1388 | 58 | 13. Sortie du mode maquette de `apps/web` |  |
| 1446 | 60 | 14. Ce qui reste ouvert |  |
| 1506 | 47 | 15. Conventions pour `dev-react-node` |  |
| 1553 | 14 | 16. Points à faire valider par le fondateur |  |
| 1567 | 12 | 17. Mises à jour des autres documents |  |
| 1579 | 15 | Sources (vérifiées le 2026-09-18) |  |
| 1594 | 370 | 18. Addendum du 2026-09-19 — D43 : chemin d'envoi des e-mails transactionnels critiques (code de connexion) | RG39–RG122 |
| 1615 | 17 | ↳ 18.1 Contexte | RG59–RG86 |
| 1632 | 7 | ↳ 18.2 Les deux questions posées |  |
| 1639 | 21 | ↳ 18.3 Question (a) — options | RG41–RG87 |
| 1660 | 24 | ↳ 18.4 Décision (a) : **(i) — appel synchrone dans la requête, avec cinq garde-fous** | RG46–RG64 |
| 1684 | 61 | ↳ 18.5 L'énumération de comptes — le point que l'envoi synchrone oblige à trancher | RG44–RG60 |
| 1745 | 11 | ↳ 18.6 Panne du fournisseur : ce qui se passe, et ce que personne ne doit croire | RG64–RG122 |
| 1756 | 43 | ↳ 18.7 Conséquence non évidente : **c'est `apps/api` qui envoie l'e-mail, pas Supabase Auth** | RG40–RG100 |
| 1799 | 32 | ↳ 18.8 Décision (b) : `leads.transactional_sends` est **un journal, et rien d'autre** | RG60 |
| 1831 | 27 | ↳ 18.9 La famine, et pourquoi elle est écartée par construction |  |
| 1858 | 34 | ↳ 18.10 Contrat d'implémentation — `POST /v1/auth/request-code` | RG44–RG91 |
| 1892 | 16 | ↳ 18.11 Conséquences | RG122 |
| 1908 | 9 | ↳ 18.12 Si l'on se trompe | RG46–RG98 |
| 1917 | 7 | ↳ 18.13 Réversibilité |  |
| 1924 | 30 | ↳ 18.14 Ce que cet addendum demande aux autres agents | RG60 |
| 1954 | 10 | ↳ Sources (vérifiées le 2026-09-19) |  |
| 1964 | 24 | 19. Addendum du 2026-09-24 — D57 : sauvegarde et restauration |  |
| 1988 | 328 | 20. Addendum du 2026-09-24 — D60 : surveillance de production, entièrement interne | RG98–RG160 |
| 2005 | 11 | ↳ 20.1 Le besoin, en deux questions |  |
| 2016 | 19 | ↳ 20.2 Ce qui existe déjà, et ce qui manque | RG98–RG126 |
| 2035 | 17 | ↳ 20.3 Options |  |
| 2052 | 14 | ↳ 20.4 Décision : six pièces, toutes internes |  |
| 2066 | 95 | ↳ 20.5 Comment chaque pièce fonctionne |  |
| 2161 | 35 | ↳ 20.6 Signaux et seuils d'alerte | RG160 |
| 2196 | 22 | ↳ 20.7 La période de rodage — « surtout au début » |  |
| 2218 | 26 | ↳ 20.8 Ce qui n'entre jamais dans un journal ni dans le schéma `ops` |  |
| 2244 | 12 | ↳ 20.9 Ce que la décision ne couvre pas — risque accepté par le fondateur |  |
| 2256 | 31 | ↳ 20.10 Conséquences |  |
| 2287 | 9 | ↳ 20.11 Points à faire valider par le fondateur |  |
| 2296 | 13 | ↳ 20.12 Ce que cet addendum demande aux autres agents |  |
| 2309 | 7 | ↳ Sources (vérifiées le 2026-09-24) |  |
| 2316 | 326 | 21. Addendum du 2026-10-28 — D73 : charte KEO, mécanique technique (tokens, polices, gabarits) | RG7–RG107 |
| 2329 | 7 | ↳ 21.1 Vocabulaire |  |
| 2336 | 12 | ↳ 21.2 Frontière |  |
| 2348 | 92 | ↳ 21.3 Tokens : un fichier, deux chartes, un attribut |  |
| 2440 | 44 | ↳ 21.4 Polices |  |
| 2484 | 91 | ↳ 21.5 Gabarits de page | RG28–RG107 |
| 2575 | 23 | ↳ 21.6 Gardes et tests |  |
| 2598 | 7 | ↳ 21.7 Découpage |  |
| 2605 | 20 | ↳ 21.8 Risques et réversibilité | RG7 |
| 2625 | 11 | ↳ 21.9 Ce que cet addendum demande aux autres agents |  |
| 2636 | 6 | ↳ Sources (vérifiées le 2026-10-28) |  |

## 03-matrice-des-droits-et-rls.md (~57k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 51 | 27 | 0. Ce qu'il faut retenir si l'on ne lit qu'une page |  |
| 78 | 74 | 1. Les cinq rôles |  |
| 152 | 24 | 2. Conventions de lecture de la matrice |  |
| 176 | 475 | 3. La matrice des droits | RG1–RG146 |
| 178 | 55 | ↳ 3.1 Domaine `identity` — comptes, rôles, CGU, sessions | RG5 |
| 233 | 83 | ↳ 3.2 Domaine `profiles` — profils marque, profils créateur, pièces de vérification, badge | RG77–RG78 |
| 316 | 27 | ↳ 3.3 Domaine `campaigns` et `search` |  |
| 343 | 202 | ↳ 3.4 Domaine `matching` et `messaging` | RG5–RG146 |
| 545 | 76 | ↳ 3.5 Domaines `billing` (pipeline commercial), `leads` et `backoffice` | RG1–RG39 |
| 621 | 30 | ↳ 3.6 Domaine `audit` — le registre |  |
| 651 | 449 | 4. Les principes de Row Level Security | RG5–RG165 |
| 656 | 15 | ↳ P1 — Refus par défaut, sur toutes les tables, sans exception |  |
| 671 | 53 | ↳ P2 — L'API se connecte avec le rôle de l'utilisateur, jamais avec un rôle qui contourne la RLS |  |
| 724 | 22 | ↳ P3 — Le rôle métier est lu en base, jamais dans le jeton |  |
| 746 | 16 | ↳ P4 — Toute condition d'accès est **positive** et échoue en refus |  |
| 762 | 34 | ↳ P5 — L'anonymisation est une séparation d'objets, doublée d'une absence de droit |  |
| 796 | 22 | ↳ P6 — Aucune table métier dans le schéma `public` |  |
| 818 | 193 | ↳ P7 — La liste **nommée et fermée** des opérations autorisées à s'élever | RG5–RG165 |
| 1011 | 52 | ↳ P8 — L'append-only est réel, pas conventionnel |  |
| 1063 | 11 | ↳ P9 — Ce que la RLS ne sait pas faire, et qui le fait à sa place |  |
| 1074 | 26 | ↳ P10 — Les politiques du Storage |  |
| 1100 | 140 | 5. La lecture d'une conversation par un agent non participant | RG132–RG134 |
| 1240 | 422 | 6. Réponse aux neuf points du §14.1 de `02-architecture-3-espaces.md` | RG57 |
| 1242 | 83 | ↳ 6.1 — Point 1 : D37 dans son ensemble | RG57 |
| 1325 | 35 | ↳ 6.2 — Point 2 : `aal2` vérifié dans les politiques RLS |  |
| 1360 | 20 | ↳ 6.3 — Point 3 : le rôle métier lu en base plutôt que dans le jeton |  |
| 1380 | 76 | ↳ 6.4 — Point 4 : le passe-plat |  |
| 1456 | 74 | ↳ 6.5 — Point 5 : les trois CSP et les en-têtes de sécurité |  |
| 1530 | 25 | ↳ 6.6 — Point 6 : l'exception E1, téléversement direct vers le Storage |  |
| 1555 | 27 | ↳ 6.7 — Point 7 : la liste des opérations autorisées à utiliser `service_role` |  |
| 1582 | 37 | ↳ 6.8 — Point 8 : les trois verrous du garde-fou `staging` |  |
| 1619 | 43 | ↳ 6.9 — Point 9 : inscription et récupération du second facteur du backoffice |  |
| 1662 | 32 | 7. L'isolement du backoffice |  |
| 1694 | 39 | 8. Les tests de sécurité exigés |  |
| 1733 | 62 | 9. Verdict d'étape | RG49–RG55 |
| 1795 | 41 | 10. Ce qui sort de mon périmètre |  |
| 1836 | 17 | 11. Mises à jour attendues dans les autres documents |  |

## 04-modele-de-donnees-mvp.md (~151k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 174 | 38 | 0. Résumé pour le fondateur |  |
| 212 | 17 | 1. Les dix règles qui gouvernent ce modèle |  |
| 229 | 57 | 2. Vue d'ensemble |  |
| 286 | 116 | 3. Conventions communes |  |
| 402 | 402 | 4. Le socle transverse — `influx`, `reference`, `audit` | RG1–RG115 |
| 404 | 65 | ↳ 4.1 `influx` — fonctions de contexte |  |
| 469 | 99 | ↳ 4.2 `reference` — les listes fermées partagées | RG18–RG115 |
| 568 | 236 | ↳ 4.3 `audit` — le registre chaîné | RG1–RG109 |
| 804 | 4494 | 5. Le schéma, domaine par domaine | RG2–RG163 |
| 806 | 448 | ↳ 5.1 `identity` — comptes, rôles, CGU, consentement, santé de l'adresse (Lots 0 et 1) | RG18–RG106 |
| 1254 | 281 | ↳ 5.2 `profiles` — le profil marque et le profil créateur en trois objets (Lot 2) | RG7–RG86 |
| 1535 | 167 | ↳ 5.3 `verification` — preuves, badge, péremption (Lot 2) | RG34–RG78 |
| 1702 | 394 | ↳ 5.4 `campaigns` — campagnes et blocs (Lot 3) | RG3–RG85 |
| 2096 | 126 | ↳ 5.5 `search` — journal de recherche et sélections (Lot 3) | RG2–RG88 |
| 2222 | 914 | ↳ 5.6 `matching` — l'objet pivot (Lot 4) | RG28–RG119 |
| 3136 | 999 | ↳ 5.7 `messaging` — la conversation à trois (Lot 4) | RG13–RG146 |
| 4135 | 365 | ↳ 5.8 `leads` — la file de synchronisation (Lot 1) | RG35–RG163 |
| 4500 | 381 | ↳ 5.9 `billing` — les taux (vides) et les affaires | RG33–RG95 |
| 4881 | 394 | ↳ 5.10 `backoffice` — pilotage interne | RG6–RG131 |
| 5275 | 23 | ↳ 5.11 Le stockage de fichiers (Supabase Storage) |  |
| 5298 | 207 | 6. Les politiques RLS — principes et exemples | RG122 |
| 5505 | 282 | 7. Réponse aux six points du §14.2 du document `02` |  |
| 5787 | 38 | 8. Les règles argent, même sans calcul au MVP |  |
| 5825 | 125 | 9. Conservation, suppression, anonymisation | RG6–RG112 |
| 5950 | 165 | 10. Les index, et la requête qui justifie chacun | RG8–RG134 |
| 6115 | 172 | 11. Plan de migrations | RG9–RG163 |
| 6287 | 177 | 12. Ce qui reste ouvert | RG22–RG123 |
| 6464 | 36 | 13. Impacts sur le code existant | RG11–RG72 |
| 6500 | 44 | 14. Checklist de la skill `supabase-schema` | RG106 |

## 05-spec-inscription-et-leads.md (~42k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 29 | 19 | Besoin |  |
| 48 | 19 | Acteurs |  |
| 67 | 58 | User stories |  |
| 125 | 651 | Règles de gestion | RG1–RG162 |
| 127 | 43 | ↳ A — Parcours général et portes d'entrée | RG1–RG10 |
| 170 | 39 | ↳ B — Champs de l'inscription annonceur | RG11–RG16 |
| 209 | 37 | ↳ C — Champs de l'inscription créateur | RG11–RG81 |
| 246 | 30 | ↳ D — Conditions générales et versions | RG23–RG29 |
| 276 | 46 | ↳ E — Consentement marketing | RG30–RG94 |
| 322 | 95 | ↳ F — Connexion par code à 6 chiffres | RG39–RG157 |
| 417 | 39 | ↳ G — L'e-mail qui n'arrive pas | RG59–RG65 |
| 456 | 29 | ↳ H — Routage et rôles après vérification | RG66–RG71 |
| 485 | 118 | ↳ I — Pipeline de leads | RG37–RG162 |
| 603 | 33 | ↳ J — Désinscriptions dans les deux sens | RG78–RG96 |
| 636 | 80 | ↳ K — Backoffice v0 | RG63–RG162 |
| 716 | 60 | ↳ L — États d'écran, messages et accessibilité | RG109–RG115 |
| 776 | 101 | Cas limites | RG1–RG113 |
| 877 | 279 | Critères d'acceptation | RG79–RG112 |
| 1156 | 70 | Impacts | RG6–RG108 |
| 1226 | 20 | Hors périmètre | RG12–RG85 |
| 1246 | 25 | Questions ouvertes | RG6–RG108 |
| 1271 | 55 | Additif du 2026-09-24 — Invitation par un commercial (D54) et source d'acquisition (D55) | RG88–RG123 |
| 1326 | 43 | Additif du 2026-09-25 — Consentement obligatoire à l'inscription (D63) | RG11–RG127 |
| 1369 | 330 | Additif du 2026-09-27 — Précisions du J3 : phrase de correspondance, e-mail du code, messages, signal « navigateur inconnu » *(J3, 2026-09-27)* | RG9–RG159 |
| 1378 | 130 | ↳ Phrase de correspondance — précise RG48 | RG46–RG156 |
| 1508 | 17 | ↳ E-mail du code — précise RG49 | RG102–RG158 |
| 1525 | 69 | ↳ Messages de l'écran minimal du J3 — précise RG112 et RG113 | RG44–RG140 |
| 1594 | 35 | ↳ Signal « navigateur inconnu » — remplace « pays inhabituel » au MVP (EC-43) | RG55–RG157 |
| 1629 | 16 | ↳ Cas limites du J3 | RG41–RG141 |
| 1645 | 43 | ↳ Critères d'acceptation du J3 | RG133 |
| 1688 | 11 | ↳ Questions ouvertes du J3 | RG48–RG158 |
| 1699 | 209 | Additif du 2026-10-17 — Une configuration de synchronisation manquante est un incident, jamais un cas normal (D67) | RG37–RG164 |

## 06-criteres-profil-marque.md (~23k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 37 | 20 | Besoin |  |
| 57 | 17 | Acteurs |  |
| 74 | 48 | User stories |  |
| 122 | 516 | Règles de gestion | RG1–RG101 |
| 124 | 82 | ↳ A — Portée, états et publication | RG1–RG73 |
| 206 | 65 | ↳ B — Bloc 1 : identité publique | RG13–RG70 |
| 271 | 45 | ↳ C — Bloc 2 : attentes de collaboration | RG5–RG34 |
| 316 | 71 | ↳ D — Bloc 3 : interlocuteur, et masquage symétrique (D40) | RG29–RG80 |
| 387 | 64 | ↳ E — Bloc 4 : champs internes et badge « Marque vérifiée » | RG46–RG101 |
| 451 | 36 | ↳ F — Indicateur de complétude | RG5–RG62 |
| 487 | 58 | ↳ G — Backoffice : validation, correction, supervision | RG52–RG72 |
| 545 | 38 | ↳ H — Ce qu'un créateur voit d'une marque, avant et après | RG73–RG77 |
| 583 | 55 | ↳ I — Leads, messages et accessibilité | RG78–RG85 |
| 638 | 102 | Cas limites | RG4–RG83 |
| 740 | 186 | Critères d'acceptation | RG42–RG84 |
| 926 | 71 | Impacts | RG7–RG79 |
| 997 | 20 | Hors périmètre | RG4–RG44 |
| 1017 | 16 | Questions ouvertes | RG8–RG100 |

## 07-criteres-profil-createur-reseaux-audience.md (~37k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 50 | 21 | Besoin |  |
| 71 | 18 | Acteurs |  |
| 89 | 63 | User stories |  |
| 152 | 852 | Règles de gestion | RG1–RG119 |
| 154 | 89 | ↳ A — Portée, états et publication | RG1–RG96 |
| 243 | 136 | ↳ B — Les trois couches, et le tableau central des champs | RG8–RG115 |
| 379 | 47 | ↳ C — Bloc 1 : alias, titre court, bio | RG23–RG96 |
| 426 | 39 | ↳ D — Bloc 2 : thématiques, ton, langues, résidence | RG27–RG40 |
| 465 | 67 | ↳ E — Bloc 3 : réseaux sociaux, une ligne par réseau | RG22–RG54 |
| 532 | 82 | ↳ E bis — Les trois métriques prioritaires (D61, additif du 2026-09-25) | RG4–RG119 |
| 614 | 42 | ↳ F — Bloc 4 : audience | RG48–RG63 |
| 656 | 91 | ↳ G — Bloc 5 : offre, tarifs indicatifs et net créateur estimé | RG4–RG76 |
| 747 | 49 | ↳ H — Bloc 6 : portfolio | RG27–RG85 |
| 796 | 40 | ↳ I — Bloc 7 : complétude | RG4–RG91 |
| 836 | 63 | ↳ J — Backoffice : validation, modération, badges, correction | RG61–RG101 |
| 899 | 44 | ↳ K — Ce qu'une marque voit d'un créateur, avant et après | RG37–RG119 |
| 943 | 61 | ↳ L — Leads, messages, états d'écran et accessibilité | RG106–RG119 |
| 1004 | 134 | Cas limites | RG4–RG119 |
| 1138 | 288 | Critères d'acceptation | RG4–RG119 |
| 1426 | 100 | Impacts | RG3–RG119 |
| 1526 | 22 | Hors périmètre | RG31–RG103 |
| 1548 | 23 | Questions ouvertes | RG4–RG119 |

## 08-verification-et-badge.md (~32k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 47 | 20 | Besoin |  |
| 67 | 19 | Acteurs |  |
| 86 | 52 | User stories |  |
| 138 | 640 | Règles de gestion | RG1–RG115 |
| 140 | 72 | ↳ A — Ce que le badge affirme, et ce qu'il n'affirme pas | RG1–RG50 |
| 212 | 58 | ↳ B — Les trois niveaux, et ce que chacun débloque | RG11–RG113 |
| 270 | 44 | ↳ C — Prouver la propriété d'un compte | RG21–RG78 |
| 314 | 72 | ↳ D — Prouver l'audience : pièces acceptées et fraîcheur | RG31–RG115 |
| 386 | 77 | ↳ E — La procédure de l'agent, pas à pas | RG12–RG88 |
| 463 | 43 | ↳ F — Motifs de refus : liste fermée et messages | RG12–RG66 |
| 506 | 41 | ↳ G — La file de vérification : entrée, tri, verrou, SLA | RG22–RG68 |
| 547 | 86 | ↳ H — Péremption, rafraîchissement, retrait, contestation | RG2–RG80 |
| 633 | 76 | ↳ I — Stockage des pièces, données de tiers, publication | RG57–RG92 |
| 709 | 69 | ↳ J — Messages, notifications, états d'écran, accessibilité | RG78–RG101 |
| 778 | 130 | Cas limites | RG5–RG101 |
| 908 | 247 | Critères d'acceptation | RG27–RG93 |
| 1155 | 93 | Impacts | RG4–RG101 |
| 1248 | 23 | Hors périmètre | RG9–RG80 |
| 1271 | 16 | Questions ouvertes | RG10–RG100 |

## 09-criteres-campagne.md (~34k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 48 | 24 | Besoin |  |
| 72 | 17 | Acteurs |  |
| 89 | 59 | User stories |  |
| 148 | 746 | Règles de gestion | RG1–RG110 |
| 150 | 93 | ↳ A — Portée, états, publication | RG1–RG90 |
| 243 | 61 | ↳ B — Bloc 1 : identification | RG16–RG90 |
| 304 | 58 | ↳ C — Bloc 2 : produit, dotation et divulgation | RG15–RG86 |
| 362 | 66 | ↳ D — Bloc 3 : livrables, droits d'usage et exclusivité | RG18–RG78 |
| 428 | 50 | ↳ E — Bloc 4 : audience visée | RG23–RG60 |
| 478 | 121 | ↳ F — Bloc 5 : budget | RG24–RG109 |
| 599 | 38 | ↳ G — Bloc 6 : calendrier | RG5–RG75 |
| 637 | 46 | ↳ H — Bloc 7 : candidature | RG9–RG82 |
| 683 | 101 | ↳ I — Bloc 8 : interne, secteurs sensibles et backoffice | RG6–RG97 |
| 784 | 41 | ↳ J — Ce qu'un créateur voit d'une campagne | RG7–RG102 |
| 825 | 69 | ↳ K — Leads, messages, états d'écran et accessibilité | RG103–RG110 |
| 894 | 115 | Cas limites | RG4–RG108 |
| 1009 | 289 | Critères d'acceptation | RG104–RG109 |
| 1298 | 112 | Impacts | RG6–RG105 |
| 1410 | 24 | Hors périmètre | RG22–RG82 |
| 1434 | 21 | Questions ouvertes | RG6–RG84 |

## 10-recherche-createurs-anonymisee.md (~31k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 56 | 23 | Besoin |  |
| 79 | 17 | Acteurs | RG105 |
| 96 | 54 | User stories |  |
| 150 | 704 | Règles de gestion | RG1–RG117 |
| 152 | 49 | ↳ A — Périmètre, ouverture de la recherche et principes | RG1–RG105 |
| 201 | 146 | ↳ B — Les facettes | RG6–RG117 |
| 347 | 52 | ↳ C — Exclusions automatiques | RG3–RG84 |
| 399 | 96 | ↳ D — Tri par défaut, explication et cas froid | RG14–RG73 |
| 495 | 93 | ↳ E — La carte anonyme et les deux actions | RG15–RG113 |
| 588 | 36 | ↳ F — Seuil de k-anonymat et porte de sortie commerciale | RG57–RG78 |
| 624 | 61 | ↳ G — Garde-fous anti-ré-identification et anti-aspiration | RG6–RG79 |
| 685 | 46 | ↳ H — La vue commerciale identifiée | RG16–RG78 |
| 731 | 36 | ↳ I — La règle d'implémentation, écrite noir sur blanc | RG22–RG82 |
| 767 | 51 | ↳ J — Intervention humaine, mesure et évolution | RG11–RG88 |
| 818 | 36 | ↳ K — Messages affichés (français et anglais) | RG41–RG89 |
| 854 | 115 | Cas limites | RG1–RG92 |
| 969 | 259 | Critères d'acceptation | RG12–RG117 |
| 1228 | 62 | Impacts | RG2–RG89 |
| 1290 | 19 | Hors périmètre | RG6–RG105 |
| 1309 | 18 | Questions ouvertes | RG1–RG86 |

## 11-recherche-campagnes-et-candidature.md (~30k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 54 | 24 | Besoin |  |
| 78 | 18 | Acteurs |  |
| 96 | 56 | User stories |  |
| 152 | 685 | Règles de gestion | RG1–RG116 |
| 154 | 59 | ↳ A — Portée, vocabulaire et principes | RG1–RG72 |
| 213 | 89 | ↳ B — Le fil des campagnes ouvertes | RG7–RG80 |
| 302 | 55 | ↳ C — Filtres, tri et pagination | RG15–RG36 |
| 357 | 47 | ↳ D — Ce qu'un créateur ne voit jamais | RG18–RG104 |
| 404 | 100 | ↳ E — Le contenu d'une candidature | RG3–RG103 |
| 504 | 49 | ↳ F — Plafonds de candidature | RG26–RG92 |
| 553 | 71 | ↳ G — Les états d'une candidature | RG11–RG82 |
| 624 | 25 | ↳ H — La restriction « réservée aux profils dont l'audience est vérifiée » | RG11–RG87 |
| 649 | 80 | ↳ I — La file de validation, et ce qui distingue une candidature d'une demande de contact | RG75–RG99 |
| 729 | 45 | ↳ J — Notifications | RG40–RG108 |
| 774 | 63 | ↳ K — Leads, messages, états d'écran et accessibilité | RG9–RG116 |
| 837 | 111 | Cas limites | RG2–RG110 |
| 948 | 240 | Critères d'acceptation | RG15–RG113 |
| 1188 | 76 | Impacts | RG15–RG98 |
| 1264 | 19 | Hors périmètre | RG17 |
| 1283 | 19 | Questions ouvertes | RG15–RG110 |

## 12-messagerie-a-trois.md (~32k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 66 | 20 | Besoin |  |
| 86 | 19 | Acteurs |  |
| 105 | 50 | User stories |  |
| 155 | 584 | Règles de gestion | RG1–RG112 |
| 157 | 77 | ↳ A. Le fil, ses participants et leur affichage | RG1–RG73 |
| 234 | 67 | ↳ B. Le cycle de vie du fil | RG15–RG26 |
| 301 | 40 | ↳ C. Ce que chacun voit une fois la conversation ouverte | RG27–RG34 |
| 341 | 82 | ↳ D. Écrire un message | RG35–RG50 |
| 423 | 76 | ↳ E. Lire un fil | RG51–RG64 |
| 499 | 69 | ↳ F. Le canal de documents | RG65–RG78 |
| 568 | 49 | ↳ G. Signalement et blocage | RG28–RG89 |
| 617 | 54 | ↳ H. Les notifications | RG5–RG100 |
| 671 | 43 | ↳ I. Le statut juridique des échanges | RG101–RG107 |
| 714 | 25 | ↳ J. Conservation et suppression | RG103–RG112 |
| 739 | 36 | Cas limites | RG8–RG109 |
| 775 | 231 | Critères d'acceptation | RG103 |
| 1006 | 78 | Impacts | RG17–RG104 |
| 1084 | 24 | Hors périmètre | RG28–RG32 |
| 1108 | 23 | Questions ouvertes | RG22–RG103 |
| 1131 | 449 | Additif du 2026-09-24 — Les apartés (D47) | RG2–RG146 |
| 1184 | 225 | ↳ K. Les apartés | RG2–RG146 |
| 1409 | 22 | ↳ Cas limites des apartés | RG9–RG144 |
| 1431 | 96 | ↳ Critères d'acceptation des apartés | RG43–RG141 |
| 1527 | 44 | ↳ Impacts des apartés | RG114–RG146 |
| 1571 | 9 | ↳ Questions ouvertes des apartés | RG37–RG143 |

## 13-file-de-validation-et-mise-en-relation.md (~36k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 53 | 28 | Besoin |  |
| 81 | 18 | Acteurs |  |
| 99 | 56 | User stories |  |
| 155 | 850 | Règles de gestion | RG1–RG119 |
| 157 | 69 | ↳ A — Périmètre, vocabulaire et principes | RG1–RG71 |
| 226 | 78 | ↳ B — L'entrée dans la file | RG9–RG88 |
| 304 | 66 | ↳ C — L'écran de décision et la prise en charge | RG27–RG92 |
| 370 | 72 | ↳ D — Les trois actions du commercial | RG5–RG97 |
| 442 | 101 | ↳ E — La proposition INFLUX | RG2–RG73 |
| 543 | 132 | ↳ F — L'écran d'acceptation et la révélation d'identité | RG13–RG81 |
| 675 | 78 | ↳ G — Les deux refus, qu'il ne faut jamais confondre | RG42–RG94 |
| 753 | 58 | ↳ H — Relances, délais et expiration | RG26–RG99 |
| 811 | 63 | ↳ I — Le cycle de vie complet d'une mise en relation | RG33–RG104 |
| 874 | 53 | ↳ J — Alertes et supervision du commercial | RG8–RG110 |
| 927 | 78 | ↳ K — Notifications, e-mails, leads et accessibilité | RG78–RG119 |
| 1005 | 108 | Cas limites | RG1–RG114 |
| 1113 | 280 | Critères d'acceptation | RG100–RG119 |
| 1393 | 21 | Frontière avec le document `12` (messagerie à trois) | RG33–RG75 |
| 1414 | 40 | La checklist CGU, pour le juriste | RG5–RG87 |
| 1454 | 104 | Impacts | RG2–RG114 |
| 1558 | 19 | Hors périmètre | RG11–RG61 |
| 1577 | 23 | Questions ouvertes | RG26–RG103 |

## 14-pipeline-commercial.md (~28k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 53 | 27 | Besoin |  |
| 80 | 16 | Acteurs |  |
| 96 | 36 | User stories |  |
| 132 | 663 | Règles de gestion | RG1–RG112 |
| 134 | 74 | ↳ A. Naissance de l'affaire | RG1–RG112 |
| 208 | 108 | ↳ B. Les états et leurs transitions | RG9–RG89 |
| 316 | 152 | ↳ C. Les champs saisis | RG4–RG69 |
| 468 | 35 | ↳ D. Ce que l'application refuse de faire | RG32–RG52 |
| 503 | 76 | ↳ E. Encaissements, écart et relances | RG8–RG79 |
| 579 | 48 | ↳ F. Suivi, listes et totaux | RG37–RG74 |
| 627 | 43 | ↳ G. Corrections, audit et écriture inverse | RG75–RG83 |
| 670 | 26 | ↳ H. Indicateurs | RG47–RG89 |
| 696 | 35 | ↳ I. Export | RG90–RG94 |
| 731 | 36 | ↳ J. Contournement et manque à gagner | RG18–RG100 |
| 767 | 28 | ↳ K. Réouverture d'une conversation close `affaire_signee` | RG3–RG104 |
| 795 | 96 | Exemple chiffré de référence | RG38 |
| 891 | 36 | Cas limites | RG1–RG81 |
| 927 | 249 | Critères d'acceptation | RG2–RG66 |
| 1176 | 83 | Impacts | RG1–RG74 |
| 1259 | 20 | Hors périmètre | RG25–RG90 |
| 1279 | 20 | Questions ouvertes | RG3–RG104 |
| 1299 | 24 | Ce qui change en V2 |  |
| 1323 | 55 | Additif du 2026-09-24 — Suivi de livraison (D52) et relations préexistantes (D53) | RG2–RG112 |

## 15-backoffice-files-et-supervision.md (~43k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 29 | 21 | Besoin |  |
| 50 | 16 | Acteurs |  |
| 66 | 49 | User stories |  |
| 115 | 877 | Règles de gestion | RG1–RG161 |
| 117 | 71 | ↳ A — Portée, principes et vocabulaire | RG1–RG13 |
| 188 | 68 | ↳ B — Le tableau de bord | RG5–RG108 |
| 256 | 112 | ↳ C — Le catalogue unique des files | RG6–RG104 |
| 368 | 71 | ↳ D — La fiche de compte | RG38–RG108 |
| 439 | 78 | ↳ E — Suspension, réactivation, réattribution | RG26–RG95 |
| 517 | 83 | ↳ F — Le catalogue central des alertes | RG8–RG161 |
| 600 | 112 | ↳ G — Les demandes relatives aux données personnelles | RG57–RG160 |
| 712 | 49 | ↳ H — Les actions de masse | RG2–RG102 |
| 761 | 40 | ↳ I — Les exports | RG81–RG106 |
| 801 | 66 | ↳ J — La gestion des comptes internes | RG60–RG108 |
| 867 | 41 | ↳ K — Ce qu'un rôle interne ne peut jamais faire | RG7–RG111 |
| 908 | 84 | ↳ L — Densité, accessibilité et langue | RG11–RG124 |
| 992 | 44 | Cas limites | RG4–RG116 |
| 1036 | 304 | Critères d'acceptation | RG16–RG109 |
| 1038 | 33 | ↳ Tableau de bord | RG16–RG18 |
| 1071 | 43 | ↳ Catalogue et règles communes des files | RG29 |
| 1114 | 35 | ↳ Fiche de compte | RG48 |
| 1149 | 39 | ↳ Suspension, réactivation, réattribution |  |
| 1188 | 24 | ↳ Alertes |  |
| 1212 | 41 | ↳ Demandes relatives aux données personnelles | RG81 |
| 1253 | 33 | ↳ Actions de masse et exports |  |
| 1286 | 22 | ↳ Comptes internes | RG107 |
| 1308 | 32 | ↳ Interdits, densité et accessibilité | RG43–RG109 |
| 1340 | 102 | Impacts | RG8–RG125 |
| 1442 | 21 | Hors périmètre | RG10–RG100 |
| 1463 | 29 | Questions ouvertes | RG19–RG111 |
| 1492 | 162 | Additif du document 16 (2026-09-19) | RG9–RG131 |
| 1654 | 46 | Additif du J9 (2026-10-21) — alertes techniques de D60 | RG46–RG165 |

## 16-backoffice-emails-brevo.md (~53k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 48 | 32 | Besoin | RG9–RG78 |
| 80 | 20 | Acteurs | RG90 |
| 100 | 57 | User stories | RG35 |
| 157 | 1506 | Règles de gestion | RG1–RG162 |
| 159 | 94 | ↳ A — Portée, vocabulaire et principes | RG1–RG93 |
| 253 | 154 | ↳ B — Le parcours d'envoi de masse, écran par écran | RG4–RG102 |
| 407 | 52 | ↳ C — Source 1 : les contacts de la plateforme | RG22–RG93 |
| 459 | 62 | ↳ D — Source 2 : un segment Brevo | RG9–RG50 |
| 521 | 120 | ↳ E — Source 3 : la saisie libre, unitaire | RG9–RG123 |
| 641 | 82 | ↳ F — La bibliothèque de modèles | RG14–RG78 |
| 723 | 48 | ↳ G — La cadence maximale par contact | RG3–RG84 |
| 771 | 183 | ↳ H — Les e-mails transactionnels | RG3–RG162 |
| 954 | 71 | ↳ H bis — Textes des deux e-mails de sécurité *(J3, 2026-09-27)* | RG9–RG159 |
| 1025 | 133 | ↳ H ter — Texte de l'accusé de réception d'une demande d'export, et réponse à un effacement *(J7, 2026-10-14 ; D72, 2026-10-27)* | RG57–RG160 |
| 1158 | 56 | ↳ I — Ce qui remonte de Brevo, et sous quelle forme | RG55–RG146 |
| 1214 | 96 | ↳ J — Le garde-fou d'environnement et l'interrupteur d'urgence | RG9–RG148 |
| 1310 | 65 | ↳ K — La supervision | RG15–RG134 |
| 1375 | 36 | ↳ L — Ce qui ne doit jamais partir dans un e-mail | RG3–RG137 |
| 1411 | 207 | ↳ M — Le contrat d'interface avec Brevo | RG9–RG161 |
| 1618 | 45 | ↳ N — Messages, langue et accessibilité | RG11–RG155 |
| 1663 | 51 | Cas limites | RG7–RG146 |
| 1714 | 435 | Critères d'acceptation | RG85–RG160 |
| 1716 | 68 | ↳ Le parcours d'envoi de masse |  |
| 1784 | 36 | ↳ Source 1 — contacts de la plateforme |  |
| 1820 | 29 | ↳ Source 2 — segment Brevo |  |
| 1849 | 51 | ↳ Source 3 — saisie libre |  |
| 1900 | 26 | ↳ Les modèles |  |
| 1926 | 22 | ↳ La cadence |  |
| 1948 | 69 | ↳ Les e-mails transactionnels | RG85–RG160 |
| 2017 | 23 | ↳ Le suivi des résultats |  |
| 2040 | 29 | ↳ Environnement et interrupteur d'urgence |  |
| 2069 | 25 | ↳ La supervision |  |
| 2094 | 39 | ↳ Les interdits et le contrat d'interface | RG135 |
| 2133 | 16 | ↳ Langue et accessibilité | RG155 |
| 2149 | 88 | Impacts | RG6–RG146 |
| 2237 | 19 | Hors périmètre | RG44–RG107 |
| 2256 | 27 | Questions ouvertes | RG9–RG160 |

## 17-parcours-et-ecrans-espaces-membres.md (~60k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 39 | 28 | 0. Conventions de lecture | RG16–RG73 |
| 67 | 54 | 1. Cadrage : populations, tâches, enseignements du benchmark | RG2–RG117 |
| 121 | 208 | 2. Architecture de l'information des deux espaces | RG1–RG140 |
| 329 | 292 | 3. Le parcours d'inscription et de connexion | RG2–RG140 |
| 621 | 607 | 4. Espace marque | RG1–RG116 |
| 628 | 44 | ↳ 4.1 M1 — Accueil marque | RG57–RG101 |
| 672 | 116 | ↳ 4.2 M2 — Profil marque : complétion progressive et couches visibles | RG2–RG102 |
| 788 | 80 | ↳ 4.3 M3 — Créer une campagne : 8 blocs, 5 étapes, un brouillon permanent | RG4–RG79 |
| 868 | 105 | ↳ 4.4 M4 — Recherche de créateurs anonymisée | RG1–RG64 |
| 973 | 57 | ↳ 4.5 M5 — Demander une mise en relation | RG15–RG116 |
| 1030 | 56 | ↳ 4.6 M6 — Suivi des demandes et des mises en relation | RG73–RG111 |
| 1086 | 95 | ↳ 4.7 M7 — La conversation à trois (spécification commune, vocabulaire par rôle) | RG7–RG104 |
| 1181 | 34 | ↳ 4.8 M8 — Le canal de documents | RG65–RG74 |
| 1215 | 13 | ↳ 4.9 Les autres écrans de l'espace marque | RG3–RG102 |
| 1228 | 544 | 5. Espace créateur | RG1–RG117 |
| 1239 | 50 | ↳ 5.1 C1 — Accueil créateur | RG13–RG99 |
| 1289 | 107 | ↳ 5.2 C2 — Profil créateur : sept blocs, trois couches, une complétude honnête | RG8–RG112 |
| 1396 | 76 | ↳ 5.3 C3 — Réseaux, preuves et badges | RG1–RG117 |
| 1472 | 70 | ↳ 5.4 C4 — Mon offre et mes tarifs : l'écran de la transparence financière | RG22–RG73 |
| 1542 | 55 | ↳ 5.5 C5 — Le fil des campagnes | RG15–RG60 |
| 1597 | 96 | ↳ 5.6 C6 et C7 — Fiche de campagne et candidature | RG16–RG81 |
| 1693 | 56 | ↳ 5.7 C8 — Mes candidatures : les huit états | RG67–RG78 |
| 1749 | 23 | ↳ 5.8 C9 — Conversation, et les autres écrans créateur | RG5–RG102 |
| 1772 | 172 | 6. Écrans transverses | RG14–RG143 |
| 1944 | 271 | 7. Les deux écrans qui portent la valeur et le risque | RG4–RG113 |
| 2215 | 105 | 8. Tokens |  |
| 2320 | 36 | 9. Écarts et manques constatés | RG2–RG112 |
| 2356 | 46 | 10. Ce qui reste à valider | RG6–RG109 |
| 2402 | 51 | 11. Récapitulatif des écrans spécifiés |  |

## 17b-parcours-et-ecrans-backoffice.md (~62k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 31 | 31 | 0. Conventions de lecture | RG1–RG124 |
| 62 | 303 | 1. Architecture de l'information | RG12–RG127 |
| 64 | 20 | ↳ 1.1 Le problème à résoudre | RG116 |
| 84 | 27 | ↳ 1.2 Le rail de navigation | RG18–RG93 |
| 111 | 43 | ↳ 1.3 Regroupement des 16 files | RG26–RG125 |
| 154 | 35 | ↳ 1.4 Ce qui est visible en permanence | RG28–RG127 |
| 189 | 31 | ↳ 1.5 La recherche globale | RG34–RG121 |
| 220 | 44 | ↳ 1.6 Tableau de bord, par rôle | RG12–RG32 |
| 264 | 101 | ↳ 1.7 Gabarit de page : rail à gauche, bande de tête, vue téléphone *(D73, 2026-10-28)* |  |
| 365 | 190 | 2. Anatomie standard d'une file | RG7–RG130 |
| 555 | 1269 | 3. Écrans clés en détail | RG2–RG165 |
| 557 | 123 | ↳ 3.1 Décision sur une demande de contact ou une candidature | RG32–RG115 |
| 680 | 136 | ↳ 3.2 La proposition INFLUX — l'écran le plus important du backoffice | RG52–RG116 |
| 816 | 94 | ↳ 3.3 La recherche de créateurs en vue identifiée | RG2–RG119 |
| 910 | 136 | ↳ 3.4 La conversation à trois, vue backoffice | RG13–RG124 |
| 1046 | 79 | ↳ 3.5 Fiche de compte marque | RG4–RG123 |
| 1125 | 55 | ↳ 3.6 Fiche de compte créateur | RG42–RG119 |
| 1180 | 63 | ↳ 3.7 Vérification d'un profil et attribution du badge | RG27–RG70 |
| 1243 | 53 | ↳ 3.8 Validation d'une campagne, et revue renforcée | RG36–RG85 |
| 1296 | 89 | ↳ 3.9 L'affaire — pipeline commercial | RG4–RG109 |
| 1385 | 79 | ↳ 3.10 Le parcours d'envoi d'e-mails — sept écrans | RG15–RG127 |
| 1464 | 38 | ↳ 3.11 Supervision des leads et adresses injoignables | RG23–RG106 |
| 1502 | 48 | ↳ 3.12 Demandes relatives aux données personnelles | RG75–RG95 |
| 1550 | 97 | ↳ 3.13 Comptes internes, compte de secours, double validation | RG9–RG118 |
| 1647 | 153 | ↳ 3.14 Connexion, activation du second facteur et codes de secours *(J3, 2026-09-27)* |  |
| 1800 | 24 | ↳ 3.15 Santé technique *(additif du J9, 2026-10-27, EC-J9-5)* | RG68–RG165 |
| 1824 | 195 | 4. Composants transverses | RG4–RG129 |
| 2019 | 46 | 5. Vérification du chronométrage | RG27–RG73 |
| 2065 | 104 | 6. Extensions de tokens proposées | RG64–RG120 |
| 2169 | 82 | 7. Incohérences relevées, écarts d'implémentation, points à valider | RG4–RG126 |
| 2251 | 62 | 8. Récapitulatif — les écrans spécifiés |  |

## 18-plan-de-test-mvp.md (~62k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 34 | 23 | 0. Ce qu'il faut retenir si l'on ne lit qu'une page |  |
| 57 | 41 | 1. En-tête : portée, public, limites |  |
| 98 | 136 | 2. Les zones critiques, par gravité décroissante |  |
| 234 | 619 | 3. Les tests exigés par `expert-cybersecurite`, traduits en cas exécutables | RG116–RG148 |
| 286 | 47 | ↳ T1 — Anonymisation de bout en bout, sur la charge utile brute |  |
| 333 | 89 | ↳ T2 — RLS par rôle et par table, et échec de la CI sur toute table non déclarée |  |
| 422 | 56 | ↳ T3 — Inviolabilité du registre et détection d'altération de chaîne |  |
| 478 | 51 | ↳ T4 — Aucun rôle d'exécution ne porte `BYPASSRLS` |  |
| 529 | 28 | ↳ T5 — Journalisation des lectures de conversation (A10) |  |
| 557 | 33 | ↳ T6 — Opérations élevées : la liste fermée est réellement fermée |  |
| 590 | 26 | ↳ T7 — Le passe-plat |  |
| 616 | 27 | ↳ T8 — Authentification |  |
| 643 | 24 | ↳ T9 — Storage |  |
| 667 | 20 | ↳ T10 — En-têtes et politique de sécurité de contenu |  |
| 687 | 14 | ↳ T11 — Secrets |  |
| 701 | 13 | ↳ T12 — Dépendances |  |
| 714 | 17 | ↳ T13 — Messages d'erreur et journaux |  |
| 731 | 14 | ↳ T14 — Références directes non contrôlées (IDOR) |  |
| 745 | 14 | ↳ T15 — Limitation de débit |  |
| 759 | 37 | ↳ T16 — Aucun calcul de commission |  |
| 796 | 46 | ↳ T17 — Garde-fou `staging` | RG116–RG148 |
| 842 | 11 | ↳ 3.1 Récapitulatif des contrôles X1 à X4 |  |
| 853 | 189 | 4. Les tests métier, en complément des 17 | RG160–RG164 |
| 1042 | 76 | 5. Le sort des gardes existantes de `apps/web` | RG7 |
| 1118 | 149 | 6. Le corpus de test de la détection de coordonnées |  |
| 1267 | 43 | 7. Le parcours de bout en bout du Lot 6 |  |
| 1310 | 31 | 8. Ce qui n'est pas couvert, et pourquoi |  |
| 1341 | 60 | 9. Ce qui remonte |  |
| 1401 | 226 | 10. La définition du « prêt à livrer », lot par lot | RG148–RG162 |
| 1627 | 21 | 11. Verdict |  |
| 1648 | 271 | 12. Les tests du jalon DS, charte KEO Emerald (D73) *(ajouté le 2026-10-28)* | RG66 |

## 20-direction-design.md (~27k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 31 | 21 | 1. La règle de méthode : emprunter des comportements, jamais des styles |  |
| 52 | 13 | 2. Trois registres visuels |  |
| 65 | 32 | 3. Carte des références par surface | RG7–RG90 |
| 97 | 16 | 4. Sept principes propres à INFLUX | RG5–RG73 |
| 113 | 16 | 5. Trois niveaux de confirmation | RG115 |
| 129 | 30 | 6. Montants : la règle de provenance | RG4–RG73 |
| 159 | 167 | 7. Les apartés (D47) : conception de l'interface | RG46–RG146 |
| 326 | 17 | 8. Angles morts du dark theme |  |
| 343 | 13 | 9. Questions ouvertes | RG116–RG130 |
| 356 | 24 | 10. Tokens proposés |  |
| 380 | 548 | 11. Charte KEO Emerald des espaces connectés (D73) | RG1–RG65 |
| 393 | 40 | ↳ 11.1 Périmètre et frontière |  |
| 433 | 14 | ↳ 11.2 Ce qui ne change pas |  |
| 447 | 163 | ↳ 11.3 Correspondance KEO → tokens INFLUX | RG1–RG10 |
| 610 | 69 | ↳ 11.4 Contrastes calculés |  |
| 679 | 116 | ↳ 11.5 Typographie, formes, élévation, mouvement |  |
| 795 | 33 | ↳ 11.6 Ce qu'on ne prend pas de la maquette | RG4–RG65 |
| 828 | 32 | ↳ 11.7 Test du logo : INFLUX, pas Spotify |  |
| 860 | 56 | ↳ 11.8 Gabarits et composants |  |
| 916 | 12 | ↳ 11.9 Points soumis au fondateur |  |

## 21-plan-de-developpement.md (~13k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 10 | 22 | 0. L'essentiel | RG148 |
| 32 | 7 | 1. Point de départ & conventions d'environnement |  |
| 39 | 42 | 2. Stratégie de développement | RG44–RG148 |
| 81 | 6 | 3. Écarts (`EC-*`) des Lots 0 et 1 |  |
| 87 | 6 | 4. Lot 0 — le socle (J0 à J4) |  |
| 93 | 24 | 5. Lot 1 — le premier usage (J5 à J9) | RG9–RG164 |
| 117 | 9 | 6. Configuration des services externes |  |
| 126 | 17 | 7. Après le Lot 1 : la feuille de route (Lots 2 à 6bis) |  |
| 143 | 99 | 8. Lot 2 — entrée et jalon actif | RG9–RG158 |
