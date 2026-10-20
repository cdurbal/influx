# Index des spécifications du MVP

> Fichier généré par `pnpm docs:index` : ne pas modifier à la main, régénérer après toute
> modification d'une spécification.
>
> **Ne jamais lire une spécification en entier.** Repérer ici la section utile, puis la lire avec
> `Read` (`offset` = ligne de départ, `limit` = nombre de lignes), ou chercher une règle précise
> avec `Grep` (exemple : `RG113` dans le fichier concerné).
>
> **Session de jalon : lire d'abord sa fiche**, qui cite déjà les tranches utiles :
> `jalons/j6-fiche.md`, `jalons/j9-fiche.md`.

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

## 02-architecture-3-espaces.md (~55k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 44 | 27 | 0. Synthèse |  |
| 71 | 20 | 1. Ce que le métier impose à l'architecture |  |
| 91 | 150 | 2. La règle architecturale centrale |  |
| 241 | 99 | 3. D12 — Place du backoffice |  |
| 340 | 117 | 4. D2 — Framework backend Node |  |
| 457 | 169 | 5. D5 — Accès aux données |  |
| 626 | 96 | 6. D18 — File de synchronisation des leads |  |
| 722 | 107 | 7. D37 — Méthode d'authentification *(décision nouvelle)* |  |
| 829 | 105 | 8. Structure du dépôt cible |  |
| 934 | 124 | 9. Le contrat entre l'API et les fronts |  |
| 1058 | 60 | 10. Où s'applique la RLS, et où elle ne suffit pas |  |
| 1118 | 51 | 11. Le worker |  |
| 1169 | 197 | 12. Conséquences sur Railway et Supabase | RG9–RG164 |
| 1366 | 58 | 13. Sortie du mode maquette de `apps/web` |  |
| 1424 | 60 | 14. Ce qui reste ouvert |  |
| 1484 | 46 | 15. Conventions pour `dev-react-node` |  |
| 1530 | 14 | 16. Points à faire valider par le fondateur |  |
| 1544 | 12 | 17. Mises à jour des autres documents |  |
| 1556 | 15 | Sources (vérifiées le 2026-09-18) |  |
| 1571 | 370 | 18. Addendum du 2026-09-19 — D43 : chemin d'envoi des e-mails transactionnels critiques (code de connexion) | RG39–RG122 |
| 1592 | 17 | ↳ 18.1 Contexte | RG59–RG86 |
| 1609 | 7 | ↳ 18.2 Les deux questions posées |  |
| 1616 | 21 | ↳ 18.3 Question (a) — options | RG41–RG87 |
| 1637 | 24 | ↳ 18.4 Décision (a) : **(i) — appel synchrone dans la requête, avec cinq garde-fous** | RG46–RG64 |
| 1661 | 61 | ↳ 18.5 L'énumération de comptes — le point que l'envoi synchrone oblige à trancher | RG44–RG60 |
| 1722 | 11 | ↳ 18.6 Panne du fournisseur : ce qui se passe, et ce que personne ne doit croire | RG64–RG122 |
| 1733 | 43 | ↳ 18.7 Conséquence non évidente : **c'est `apps/api` qui envoie l'e-mail, pas Supabase Auth** | RG40–RG100 |
| 1776 | 32 | ↳ 18.8 Décision (b) : `leads.transactional_sends` est **un journal, et rien d'autre** | RG60 |
| 1808 | 27 | ↳ 18.9 La famine, et pourquoi elle est écartée par construction |  |
| 1835 | 34 | ↳ 18.10 Contrat d'implémentation — `POST /v1/auth/request-code` | RG44–RG91 |
| 1869 | 16 | ↳ 18.11 Conséquences | RG122 |
| 1885 | 9 | ↳ 18.12 Si l'on se trompe | RG46–RG98 |
| 1894 | 7 | ↳ 18.13 Réversibilité |  |
| 1901 | 30 | ↳ 18.14 Ce que cet addendum demande aux autres agents | RG60 |
| 1931 | 10 | ↳ Sources (vérifiées le 2026-09-19) |  |
| 1941 | 24 | 19. Addendum du 2026-09-24 — D57 : sauvegarde et restauration |  |
| 1965 | 326 | 20. Addendum du 2026-09-24 — D60 : surveillance de production, entièrement interne | RG98–RG160 |
| 1982 | 11 | ↳ 20.1 Le besoin, en deux questions |  |
| 1993 | 19 | ↳ 20.2 Ce qui existe déjà, et ce qui manque | RG98–RG126 |
| 2012 | 17 | ↳ 20.3 Options |  |
| 2029 | 14 | ↳ 20.4 Décision : six pièces, toutes internes |  |
| 2043 | 95 | ↳ 20.5 Comment chaque pièce fonctionne |  |
| 2138 | 35 | ↳ 20.6 Signaux et seuils d'alerte | RG160 |
| 2173 | 22 | ↳ 20.7 La période de rodage — « surtout au début » |  |
| 2195 | 26 | ↳ 20.8 Ce qui n'entre jamais dans un journal ni dans le schéma `ops` |  |
| 2221 | 12 | ↳ 20.9 Ce que la décision ne couvre pas — risque accepté par le fondateur |  |
| 2233 | 31 | ↳ 20.10 Conséquences |  |
| 2264 | 9 | ↳ 20.11 Points à faire valider par le fondateur |  |
| 2273 | 13 | ↳ 20.12 Ce que cet addendum demande aux autres agents |  |
| 2286 | 5 | ↳ Sources (vérifiées le 2026-09-24) |  |

## 03-matrice-des-droits-et-rls.md (~50k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 51 | 27 | 0. Ce qu'il faut retenir si l'on ne lit qu'une page |  |
| 78 | 74 | 1. Les cinq rôles |  |
| 152 | 24 | 2. Conventions de lecture de la matrice |  |
| 176 | 468 | 3. La matrice des droits | RG1–RG146 |
| 178 | 54 | ↳ 3.1 Domaine `identity` — comptes, rôles, CGU, sessions | RG5 |
| 232 | 79 | ↳ 3.2 Domaine `profiles` — profils marque, profils créateur, pièces de vérification, badge |  |
| 311 | 27 | ↳ 3.3 Domaine `campaigns` et `search` |  |
| 338 | 200 | ↳ 3.4 Domaine `matching` et `messaging` | RG5–RG146 |
| 538 | 76 | ↳ 3.5 Domaines `billing` (pipeline commercial), `leads` et `backoffice` | RG1–RG39 |
| 614 | 30 | ↳ 3.6 Domaine `audit` — le registre |  |
| 644 | 436 | 4. Les principes de Row Level Security | RG5–RG65 |
| 649 | 15 | ↳ P1 — Refus par défaut, sur toutes les tables, sans exception |  |
| 664 | 53 | ↳ P2 — L'API se connecte avec le rôle de l'utilisateur, jamais avec un rôle qui contourne la RLS |  |
| 717 | 22 | ↳ P3 — Le rôle métier est lu en base, jamais dans le jeton |  |
| 739 | 16 | ↳ P4 — Toute condition d'accès est **positive** et échoue en refus |  |
| 755 | 34 | ↳ P5 — L'anonymisation est une séparation d'objets, doublée d'une absence de droit |  |
| 789 | 22 | ↳ P6 — Aucune table métier dans le schéma `public` |  |
| 811 | 180 | ↳ P7 — La liste **nommée et fermée** des opérations autorisées à s'élever | RG5–RG65 |
| 991 | 52 | ↳ P8 — L'append-only est réel, pas conventionnel |  |
| 1043 | 11 | ↳ P9 — Ce que la RLS ne sait pas faire, et qui le fait à sa place |  |
| 1054 | 26 | ↳ P10 — Les politiques du Storage |  |
| 1080 | 140 | 5. La lecture d'une conversation par un agent non participant | RG132–RG134 |
| 1220 | 418 | 6. Réponse aux neuf points du §14.1 de `02-architecture-3-espaces.md` | RG57 |
| 1222 | 83 | ↳ 6.1 — Point 1 : D37 dans son ensemble | RG57 |
| 1305 | 35 | ↳ 6.2 — Point 2 : `aal2` vérifié dans les politiques RLS |  |
| 1340 | 20 | ↳ 6.3 — Point 3 : le rôle métier lu en base plutôt que dans le jeton |  |
| 1360 | 76 | ↳ 6.4 — Point 4 : le passe-plat |  |
| 1436 | 74 | ↳ 6.5 — Point 5 : les trois CSP et les en-têtes de sécurité |  |
| 1510 | 21 | ↳ 6.6 — Point 6 : l'exception E1, téléversement direct vers le Storage |  |
| 1531 | 27 | ↳ 6.7 — Point 7 : la liste des opérations autorisées à utiliser `service_role` |  |
| 1558 | 37 | ↳ 6.8 — Point 8 : les trois verrous du garde-fou `staging` |  |
| 1595 | 43 | ↳ 6.9 — Point 9 : inscription et récupération du second facteur du backoffice |  |
| 1638 | 32 | 7. L'isolement du backoffice |  |
| 1670 | 39 | 8. Les tests de sécurité exigés |  |
| 1709 | 62 | 9. Verdict d'étape | RG49–RG55 |
| 1771 | 41 | 10. Ce qui sort de mon périmètre |  |
| 1812 | 17 | 11. Mises à jour attendues dans les autres documents |  |

## 04-modele-de-donnees-mvp.md (~142k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 174 | 38 | 0. Résumé pour le fondateur |  |
| 212 | 17 | 1. Les dix règles qui gouvernent ce modèle |  |
| 229 | 57 | 2. Vue d'ensemble |  |
| 286 | 116 | 3. Conventions communes |  |
| 402 | 363 | 4. Le socle transverse — `influx`, `reference`, `audit` | RG1–RG109 |
| 404 | 65 | ↳ 4.1 `influx` — fonctions de contexte |  |
| 469 | 98 | ↳ 4.2 `reference` — les listes fermées partagées | RG18–RG72 |
| 567 | 198 | ↳ 4.3 `audit` — le registre chaîné | RG1–RG109 |
| 765 | 4477 | 5. Le schéma, domaine par domaine | RG2–RG163 |
| 767 | 448 | ↳ 5.1 `identity` — comptes, rôles, CGU, consentement, santé de l'adresse (Lots 0 et 1) | RG18–RG106 |
| 1215 | 273 | ↳ 5.2 `profiles` — le profil marque et le profil créateur en trois objets (Lot 2) | RG7–RG73 |
| 1488 | 160 | ↳ 5.3 `verification` — preuves, badge, péremption (Lot 2) | RG34–RG78 |
| 1648 | 394 | ↳ 5.4 `campaigns` — campagnes et blocs (Lot 3) | RG3–RG85 |
| 2042 | 126 | ↳ 5.5 `search` — journal de recherche et sélections (Lot 3) | RG2–RG88 |
| 2168 | 912 | ↳ 5.6 `matching` — l'objet pivot (Lot 4) | RG28–RG119 |
| 3080 | 999 | ↳ 5.7 `messaging` — la conversation à trois (Lot 4) | RG13–RG146 |
| 4079 | 365 | ↳ 5.8 `leads` — la file de synchronisation (Lot 1) | RG35–RG163 |
| 4444 | 381 | ↳ 5.9 `billing` — les taux (vides) et les affaires | RG33–RG95 |
| 4825 | 394 | ↳ 5.10 `backoffice` — pilotage interne | RG6–RG131 |
| 5219 | 23 | ↳ 5.11 Le stockage de fichiers (Supabase Storage) |  |
| 5242 | 207 | 6. Les politiques RLS — principes et exemples | RG122 |
| 5449 | 280 | 7. Réponse aux six points du §14.2 du document `02` |  |
| 5729 | 38 | 8. Les règles argent, même sans calcul au MVP |  |
| 5767 | 112 | 9. Conservation, suppression, anonymisation | RG44–RG112 |
| 5879 | 165 | 10. Les index, et la requête qui justifie chacun | RG8–RG134 |
| 6044 | 131 | 11. Plan de migrations | RG15–RG122 |
| 6175 | 175 | 12. Ce qui reste ouvert | RG22–RG123 |
| 6350 | 36 | 13. Impacts sur le code existant | RG11–RG72 |
| 6386 | 44 | 14. Checklist de la skill `supabase-schema` | RG106 |

## 05-spec-inscription-et-leads.md (~41k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 29 | 19 | Besoin |  |
| 48 | 19 | Acteurs |  |
| 67 | 58 | User stories |  |
| 125 | 650 | Règles de gestion | RG1–RG162 |
| 127 | 43 | ↳ A — Parcours général et portes d'entrée | RG1–RG10 |
| 170 | 39 | ↳ B — Champs de l'inscription annonceur | RG11–RG16 |
| 209 | 37 | ↳ C — Champs de l'inscription créateur | RG11–RG81 |
| 246 | 30 | ↳ D — Conditions générales et versions | RG23–RG29 |
| 276 | 46 | ↳ E — Consentement marketing | RG30–RG94 |
| 322 | 95 | ↳ F — Connexion par code à 6 chiffres | RG39–RG157 |
| 417 | 39 | ↳ G — L'e-mail qui n'arrive pas | RG59–RG65 |
| 456 | 29 | ↳ H — Routage et rôles après vérification | RG66–RG71 |
| 485 | 117 | ↳ I — Pipeline de leads | RG37–RG162 |
| 602 | 33 | ↳ J — Désinscriptions dans les deux sens | RG78–RG96 |
| 635 | 80 | ↳ K — Backoffice v0 | RG63–RG162 |
| 715 | 60 | ↳ L — États d'écran, messages et accessibilité | RG109–RG115 |
| 775 | 101 | Cas limites | RG1–RG113 |
| 876 | 279 | Critères d'acceptation | RG79–RG112 |
| 1155 | 70 | Impacts | RG6–RG108 |
| 1225 | 20 | Hors périmètre | RG12–RG85 |
| 1245 | 25 | Questions ouvertes | RG6–RG108 |
| 1270 | 55 | Additif du 2026-09-24 — Invitation par un commercial (D54) et source d'acquisition (D55) | RG88–RG123 |
| 1325 | 43 | Additif du 2026-09-25 — Consentement obligatoire à l'inscription (D63) | RG11–RG127 |
| 1368 | 330 | Additif du 2026-09-27 — Précisions du J3 : phrase de correspondance, e-mail du code, messages, signal « navigateur inconnu » *(J3, 2026-09-27)* | RG9–RG159 |
| 1377 | 130 | ↳ Phrase de correspondance — précise RG48 | RG46–RG156 |
| 1507 | 17 | ↳ E-mail du code — précise RG49 | RG102–RG158 |
| 1524 | 69 | ↳ Messages de l'écran minimal du J3 — précise RG112 et RG113 | RG44–RG140 |
| 1593 | 35 | ↳ Signal « navigateur inconnu » — remplace « pays inhabituel » au MVP (EC-43) | RG55–RG157 |
| 1628 | 16 | ↳ Cas limites du J3 | RG41–RG141 |
| 1644 | 43 | ↳ Critères d'acceptation du J3 | RG133 |
| 1687 | 11 | ↳ Questions ouvertes du J3 | RG48–RG158 |
| 1698 | 204 | Additif du 2026-10-17 — Une configuration de synchronisation manquante est un incident, jamais un cas normal (D67) | RG37–RG164 |

## 06-criteres-profil-marque.md (~22k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 37 | 20 | Besoin |  |
| 57 | 17 | Acteurs |  |
| 74 | 48 | User stories |  |
| 122 | 499 | Règles de gestion | RG1–RG85 |
| 124 | 80 | ↳ A — Portée, états et publication | RG1–RG73 |
| 204 | 65 | ↳ B — Bloc 1 : identité publique | RG15–RG70 |
| 269 | 45 | ↳ C — Bloc 2 : attentes de collaboration | RG5–RG34 |
| 314 | 71 | ↳ D — Bloc 3 : interlocuteur, et masquage symétrique (D40) | RG29–RG80 |
| 385 | 55 | ↳ E — Bloc 4 : champs internes et badge « Marque vérifiée » | RG46–RG56 |
| 440 | 36 | ↳ F — Indicateur de complétude | RG5–RG62 |
| 476 | 52 | ↳ G — Backoffice : validation, correction, supervision | RG63–RG72 |
| 528 | 38 | ↳ H — Ce qu'un créateur voit d'une marque, avant et après | RG73–RG77 |
| 566 | 55 | ↳ I — Leads, messages et accessibilité | RG78–RG85 |
| 621 | 102 | Cas limites | RG4–RG83 |
| 723 | 186 | Critères d'acceptation | RG42–RG84 |
| 909 | 71 | Impacts | RG7–RG79 |
| 980 | 20 | Hors périmètre | RG4–RG44 |
| 1000 | 15 | Questions ouvertes | RG8–RG80 |

## 07-criteres-profil-createur-reseaux-audience.md (~36k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 50 | 21 | Besoin |  |
| 71 | 18 | Acteurs |  |
| 89 | 63 | User stories |  |
| 152 | 838 | Règles de gestion | RG1–RG119 |
| 154 | 85 | ↳ A — Portée, états et publication | RG1–RG96 |
| 239 | 136 | ↳ B — Les trois couches, et le tableau central des champs | RG8–RG115 |
| 375 | 47 | ↳ C — Bloc 1 : alias, titre court, bio | RG23–RG96 |
| 422 | 39 | ↳ D — Bloc 2 : thématiques, ton, langues, résidence | RG27–RG40 |
| 461 | 67 | ↳ E — Bloc 3 : réseaux sociaux, une ligne par réseau | RG22–RG54 |
| 528 | 81 | ↳ E bis — Les trois métriques prioritaires (D61, additif du 2026-09-25) | RG4–RG119 |
| 609 | 42 | ↳ F — Bloc 4 : audience | RG48–RG63 |
| 651 | 84 | ↳ G — Bloc 5 : offre, tarifs indicatifs et net créateur estimé | RG4–RG76 |
| 735 | 49 | ↳ H — Bloc 6 : portfolio | RG27–RG85 |
| 784 | 40 | ↳ I — Bloc 7 : complétude | RG4–RG91 |
| 824 | 63 | ↳ J — Backoffice : validation, modération, badges, correction | RG61–RG101 |
| 887 | 42 | ↳ K — Ce qu'une marque voit d'un créateur, avant et après | RG37–RG119 |
| 929 | 61 | ↳ L — Leads, messages, états d'écran et accessibilité | RG106–RG119 |
| 990 | 134 | Cas limites | RG4–RG119 |
| 1124 | 287 | Critères d'acceptation | RG4–RG119 |
| 1411 | 100 | Impacts | RG3–RG119 |
| 1511 | 22 | Hors périmètre | RG31–RG103 |
| 1533 | 23 | Questions ouvertes | RG4–RG119 |

## 08-verification-et-badge.md (~30k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 47 | 20 | Besoin |  |
| 67 | 19 | Acteurs |  |
| 86 | 52 | User stories |  |
| 138 | 624 | Règles de gestion | RG1–RG115 |
| 140 | 70 | ↳ A — Ce que le badge affirme, et ce qu'il n'affirme pas | RG1–RG50 |
| 210 | 58 | ↳ B — Les trois niveaux, et ce que chacun débloque | RG11–RG113 |
| 268 | 44 | ↳ C — Prouver la propriété d'un compte | RG21–RG78 |
| 312 | 71 | ↳ D — Prouver l'audience : pièces acceptées et fraîcheur | RG31–RG115 |
| 383 | 77 | ↳ E — La procédure de l'agent, pas à pas | RG12–RG88 |
| 460 | 41 | ↳ F — Motifs de refus : liste fermée et messages | RG56–RG66 |
| 501 | 41 | ↳ G — La file de vérification : entrée, tri, verrou, SLA | RG22–RG68 |
| 542 | 76 | ↳ H — Péremption, rafraîchissement, retrait, contestation | RG2–RG80 |
| 618 | 75 | ↳ I — Stockage des pièces, données de tiers, publication | RG57–RG92 |
| 693 | 69 | ↳ J — Messages, notifications, états d'écran, accessibilité | RG89–RG101 |
| 762 | 130 | Cas limites | RG5–RG101 |
| 892 | 247 | Critères d'acceptation | RG27–RG93 |
| 1139 | 89 | Impacts | RG4–RG101 |
| 1228 | 23 | Hors périmètre | RG9–RG80 |
| 1251 | 16 | Questions ouvertes | RG10–RG100 |

## 09-criteres-campagne.md (~31k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 46 | 24 | Besoin |  |
| 70 | 17 | Acteurs |  |
| 87 | 56 | User stories |  |
| 143 | 694 | Règles de gestion | RG1–RG110 |
| 145 | 88 | ↳ A — Portée, états, publication | RG1–RG90 |
| 233 | 61 | ↳ B — Bloc 1 : identification | RG16–RG90 |
| 294 | 53 | ↳ C — Bloc 2 : produit, dotation et divulgation | RG15–RG86 |
| 347 | 66 | ↳ D — Bloc 3 : livrables, droits d'usage et exclusivité | RG20–RG78 |
| 413 | 50 | ↳ E — Bloc 4 : audience visée | RG23–RG60 |
| 463 | 92 | ↳ F — Bloc 5 : budget | RG24–RG109 |
| 555 | 38 | ↳ G — Bloc 6 : calendrier | RG5–RG75 |
| 593 | 45 | ↳ H — Bloc 7 : candidature | RG9–RG82 |
| 638 | 98 | ↳ I — Bloc 8 : interne, secteurs sensibles et backoffice | RG6–RG97 |
| 736 | 39 | ↳ J — Ce qu'un créateur voit d'une campagne | RG7–RG102 |
| 775 | 62 | ↳ K — Leads, messages, états d'écran et accessibilité | RG103–RG110 |
| 837 | 115 | Cas limites | RG4–RG108 |
| 952 | 273 | Critères d'acceptation | RG104–RG109 |
| 1225 | 101 | Impacts | RG6–RG105 |
| 1326 | 24 | Hors périmètre | RG22–RG82 |
| 1350 | 20 | Questions ouvertes | RG6–RG84 |

## 10-recherche-createurs-anonymisee.md (~30k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 47 | 23 | Besoin |  |
| 70 | 17 | Acteurs | RG105 |
| 87 | 54 | User stories |  |
| 141 | 694 | Règles de gestion | RG1–RG117 |
| 143 | 49 | ↳ A — Périmètre, ouverture de la recherche et principes | RG1–RG105 |
| 192 | 142 | ↳ B — Les facettes | RG6–RG117 |
| 334 | 52 | ↳ C — Exclusions automatiques | RG3–RG84 |
| 386 | 93 | ↳ D — Tri par défaut, explication et cas froid | RG14–RG73 |
| 479 | 93 | ↳ E — La carte anonyme et les deux actions | RG15–RG113 |
| 572 | 36 | ↳ F — Seuil de k-anonymat et porte de sortie commerciale | RG57–RG78 |
| 608 | 61 | ↳ G — Garde-fous anti-ré-identification et anti-aspiration | RG6–RG79 |
| 669 | 46 | ↳ H — La vue commerciale identifiée | RG16–RG78 |
| 715 | 36 | ↳ I — La règle d'implémentation, écrite noir sur blanc | RG22–RG82 |
| 751 | 51 | ↳ J — Intervention humaine, mesure et évolution | RG11–RG88 |
| 802 | 33 | ↳ K — Messages affichés (français et anglais) | RG41–RG89 |
| 835 | 115 | Cas limites | RG1–RG92 |
| 950 | 254 | Critères d'acceptation | RG12–RG117 |
| 1204 | 62 | Impacts | RG2–RG89 |
| 1266 | 19 | Hors périmètre | RG6–RG105 |
| 1285 | 18 | Questions ouvertes | RG1–RG86 |

## 11-recherche-campagnes-et-candidature.md (~29k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 50 | 24 | Besoin |  |
| 74 | 18 | Acteurs |  |
| 92 | 55 | User stories |  |
| 147 | 676 | Règles de gestion | RG1–RG116 |
| 149 | 58 | ↳ A — Portée, vocabulaire et principes | RG1–RG72 |
| 207 | 87 | ↳ B — Le fil des campagnes ouvertes | RG7–RG80 |
| 294 | 55 | ↳ C — Filtres, tri et pagination | RG15–RG36 |
| 349 | 47 | ↳ D — Ce qu'un créateur ne voit jamais | RG18–RG104 |
| 396 | 100 | ↳ E — Le contenu d'une candidature | RG3–RG103 |
| 496 | 49 | ↳ F — Plafonds de candidature | RG26–RG92 |
| 545 | 71 | ↳ G — Les états d'une candidature | RG11–RG82 |
| 616 | 25 | ↳ H — La restriction « réservée aux profils dont l'audience est vérifiée » | RG11–RG87 |
| 641 | 79 | ↳ I — La file de validation, et ce qui distingue une candidature d'une demande de contact | RG75–RG99 |
| 720 | 45 | ↳ J — Notifications | RG40–RG108 |
| 765 | 58 | ↳ K — Leads, messages, états d'écran et accessibilité | RG9–RG116 |
| 823 | 111 | Cas limites | RG2–RG110 |
| 934 | 236 | Critères d'acceptation | RG15–RG113 |
| 1170 | 76 | Impacts | RG15–RG98 |
| 1246 | 19 | Hors périmètre | RG17 |
| 1265 | 19 | Questions ouvertes | RG15–RG110 |

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

## 15-backoffice-files-et-supervision.md (~39k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 29 | 21 | Besoin |  |
| 50 | 16 | Acteurs |  |
| 66 | 49 | User stories |  |
| 115 | 850 | Règles de gestion | RG1–RG161 |
| 117 | 71 | ↳ A — Portée, principes et vocabulaire | RG1–RG13 |
| 188 | 68 | ↳ B — Le tableau de bord | RG5–RG108 |
| 256 | 102 | ↳ C — Le catalogue unique des files | RG6–RG104 |
| 358 | 71 | ↳ D — La fiche de compte | RG38–RG108 |
| 429 | 78 | ↳ E — Suspension, réactivation, réattribution | RG26–RG95 |
| 507 | 83 | ↳ F — Le catalogue central des alertes | RG8–RG161 |
| 590 | 95 | ↳ G — Les demandes relatives aux données personnelles | RG71–RG85 |
| 685 | 49 | ↳ H — Les actions de masse | RG2–RG102 |
| 734 | 40 | ↳ I — Les exports | RG81–RG106 |
| 774 | 66 | ↳ J — La gestion des comptes internes | RG60–RG108 |
| 840 | 41 | ↳ K — Ce qu'un rôle interne ne peut jamais faire | RG7–RG111 |
| 881 | 84 | ↳ L — Densité, accessibilité et langue | RG11–RG124 |
| 965 | 44 | Cas limites | RG4–RG116 |
| 1009 | 304 | Critères d'acceptation | RG16–RG109 |
| 1011 | 33 | ↳ Tableau de bord | RG16–RG18 |
| 1044 | 43 | ↳ Catalogue et règles communes des files | RG29 |
| 1087 | 35 | ↳ Fiche de compte | RG48 |
| 1122 | 39 | ↳ Suspension, réactivation, réattribution |  |
| 1161 | 24 | ↳ Alertes |  |
| 1185 | 41 | ↳ Demandes relatives aux données personnelles | RG81 |
| 1226 | 33 | ↳ Actions de masse et exports |  |
| 1259 | 22 | ↳ Comptes internes | RG107 |
| 1281 | 32 | ↳ Interdits, densité et accessibilité | RG43–RG109 |
| 1313 | 102 | Impacts | RG8–RG125 |
| 1415 | 21 | Hors périmètre | RG10–RG100 |
| 1436 | 29 | Questions ouvertes | RG19–RG111 |
| 1465 | 160 | Additif du document 16 (2026-09-19) | RG9–RG131 |

## 16-backoffice-emails-brevo.md (~51k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 48 | 32 | Besoin | RG9–RG78 |
| 80 | 20 | Acteurs | RG90 |
| 100 | 57 | User stories | RG35 |
| 157 | 1450 | Règles de gestion | RG1–RG162 |
| 159 | 94 | ↳ A — Portée, vocabulaire et principes | RG1–RG93 |
| 253 | 154 | ↳ B — Le parcours d'envoi de masse, écran par écran | RG4–RG102 |
| 407 | 52 | ↳ C — Source 1 : les contacts de la plateforme | RG22–RG93 |
| 459 | 62 | ↳ D — Source 2 : un segment Brevo | RG9–RG50 |
| 521 | 120 | ↳ E — Source 3 : la saisie libre, unitaire | RG9–RG123 |
| 641 | 82 | ↳ F — La bibliothèque de modèles | RG14–RG78 |
| 723 | 48 | ↳ G — La cadence maximale par contact | RG3–RG84 |
| 771 | 181 | ↳ H — Les e-mails transactionnels | RG3–RG162 |
| 952 | 71 | ↳ H bis — Textes des deux e-mails de sécurité *(J3, 2026-09-27)* | RG9–RG159 |
| 1023 | 89 | ↳ H ter — Texte de l'accusé de réception d'une demande « mes données » *(J7, 2026-10-14)* | RG57–RG160 |
| 1112 | 56 | ↳ I — Ce qui remonte de Brevo, et sous quelle forme | RG55–RG146 |
| 1168 | 96 | ↳ J — Le garde-fou d'environnement et l'interrupteur d'urgence | RG9–RG148 |
| 1264 | 65 | ↳ K — La supervision | RG15–RG134 |
| 1329 | 36 | ↳ L — Ce qui ne doit jamais partir dans un e-mail | RG3–RG137 |
| 1365 | 197 | ↳ M — Le contrat d'interface avec Brevo | RG9–RG161 |
| 1562 | 45 | ↳ N — Messages, langue et accessibilité | RG11–RG155 |
| 1607 | 51 | Cas limites | RG7–RG146 |
| 1658 | 435 | Critères d'acceptation | RG85–RG160 |
| 1660 | 68 | ↳ Le parcours d'envoi de masse |  |
| 1728 | 36 | ↳ Source 1 — contacts de la plateforme |  |
| 1764 | 29 | ↳ Source 2 — segment Brevo |  |
| 1793 | 51 | ↳ Source 3 — saisie libre |  |
| 1844 | 26 | ↳ Les modèles |  |
| 1870 | 22 | ↳ La cadence |  |
| 1892 | 69 | ↳ Les e-mails transactionnels | RG85–RG160 |
| 1961 | 23 | ↳ Le suivi des résultats |  |
| 1984 | 29 | ↳ Environnement et interrupteur d'urgence |  |
| 2013 | 25 | ↳ La supervision |  |
| 2038 | 39 | ↳ Les interdits et le contrat d'interface | RG135 |
| 2077 | 16 | ↳ Langue et accessibilité | RG155 |
| 2093 | 88 | Impacts | RG6–RG146 |
| 2181 | 19 | Hors périmètre | RG44–RG107 |
| 2200 | 27 | Questions ouvertes | RG9–RG160 |

## 17-parcours-et-ecrans-espaces-membres.md (~56k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 38 | 28 | 0. Conventions de lecture | RG16–RG73 |
| 66 | 54 | 1. Cadrage : populations, tâches, enseignements du benchmark | RG2–RG117 |
| 120 | 157 | 2. Architecture de l'information des deux espaces | RG1–RG140 |
| 277 | 289 | 3. Le parcours d'inscription et de connexion | RG2–RG140 |
| 566 | 597 | 4. Espace marque | RG1–RG116 |
| 573 | 44 | ↳ 4.1 M1 — Accueil marque | RG57–RG101 |
| 617 | 108 | ↳ 4.2 M2 — Profil marque : complétion progressive et couches visibles | RG2–RG102 |
| 725 | 80 | ↳ 4.3 M3 — Créer une campagne : 8 blocs, 5 étapes, un brouillon permanent | RG4–RG79 |
| 805 | 105 | ↳ 4.4 M4 — Recherche de créateurs anonymisée | RG1–RG64 |
| 910 | 57 | ↳ 4.5 M5 — Demander une mise en relation | RG15–RG116 |
| 967 | 54 | ↳ 4.6 M6 — Suivi des demandes et des mises en relation | RG73–RG111 |
| 1021 | 95 | ↳ 4.7 M7 — La conversation à trois (spécification commune, vocabulaire par rôle) | RG7–RG104 |
| 1116 | 34 | ↳ 4.8 M8 — Le canal de documents | RG65–RG74 |
| 1150 | 13 | ↳ 4.9 Les autres écrans de l'espace marque | RG3–RG102 |
| 1163 | 537 | 5. Espace créateur | RG1–RG117 |
| 1174 | 50 | ↳ 5.1 C1 — Accueil créateur | RG13–RG99 |
| 1224 | 105 | ↳ 5.2 C2 — Profil créateur : sept blocs, trois couches, une complétude honnête | RG8–RG112 |
| 1329 | 76 | ↳ 5.3 C3 — Réseaux, preuves et badges | RG1–RG117 |
| 1405 | 65 | ↳ 5.4 C4 — Mon offre et mes tarifs : l'écran de la transparence financière | RG22–RG73 |
| 1470 | 55 | ↳ 5.5 C5 — Le fil des campagnes | RG15–RG60 |
| 1525 | 96 | ↳ 5.6 C6 et C7 — Fiche de campagne et candidature | RG16–RG81 |
| 1621 | 56 | ↳ 5.7 C8 — Mes candidatures : les huit états | RG67–RG78 |
| 1677 | 23 | ↳ 5.8 C9 — Conversation, et les autres écrans créateur | RG5–RG102 |
| 1700 | 167 | 6. Écrans transverses | RG14–RG143 |
| 1867 | 271 | 7. Les deux écrans qui portent la valeur et le risque | RG4–RG113 |
| 2138 | 103 | 8. Tokens |  |
| 2241 | 36 | 9. Écarts et manques constatés | RG2–RG112 |
| 2277 | 46 | 10. Ce qui reste à valider | RG6–RG109 |
| 2323 | 51 | 11. Récapitulatif des écrans spécifiés |  |

## 17b-parcours-et-ecrans-backoffice.md (~56k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 30 | 31 | 0. Conventions de lecture | RG1–RG124 |
| 61 | 196 | 1. Architecture de l'information | RG12–RG127 |
| 257 | 190 | 2. Anatomie standard d'une file | RG7–RG130 |
| 447 | 1251 | 3. Écrans clés en détail | RG2–RG145 |
| 449 | 123 | ↳ 3.1 Décision sur une demande de contact ou une candidature | RG32–RG115 |
| 572 | 136 | ↳ 3.2 La proposition INFLUX — l'écran le plus important du backoffice | RG52–RG116 |
| 708 | 94 | ↳ 3.3 La recherche de créateurs en vue identifiée | RG2–RG119 |
| 802 | 136 | ↳ 3.4 La conversation à trois, vue backoffice | RG13–RG124 |
| 938 | 79 | ↳ 3.5 Fiche de compte marque | RG4–RG123 |
| 1017 | 52 | ↳ 3.6 Fiche de compte créateur | RG42–RG119 |
| 1069 | 62 | ↳ 3.7 Vérification d'un profil et attribution du badge | RG27–RG70 |
| 1131 | 53 | ↳ 3.8 Validation d'une campagne, et revue renforcée | RG36–RG85 |
| 1184 | 89 | ↳ 3.9 L'affaire — pipeline commercial | RG4–RG109 |
| 1273 | 79 | ↳ 3.10 Le parcours d'envoi d'e-mails — sept écrans | RG15–RG127 |
| 1352 | 38 | ↳ 3.11 Supervision des leads et adresses injoignables | RG23–RG106 |
| 1390 | 48 | ↳ 3.12 Demandes relatives aux données personnelles | RG75–RG95 |
| 1438 | 95 | ↳ 3.13 Comptes internes, compte de secours, double validation | RG9–RG118 |
| 1533 | 165 | ↳ 3.14 Connexion, activation du second facteur et codes de secours *(J3, 2026-09-27)* | RG68–RG145 |
| 1698 | 194 | 4. Composants transverses | RG4–RG129 |
| 1892 | 46 | 5. Vérification du chronométrage | RG27–RG73 |
| 1938 | 94 | 6. Extensions de tokens proposées | RG64–RG120 |
| 2032 | 82 | 7. Incohérences relevées, écarts d'implémentation, points à valider | RG4–RG126 |
| 2114 | 61 | 8. Récapitulatif — les écrans spécifiés |  |

## 18-plan-de-test-mvp.md (~43k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 30 | 23 | 0. Ce qu'il faut retenir si l'on ne lit qu'une page |  |
| 53 | 41 | 1. En-tête : portée, public, limites |  |
| 94 | 136 | 2. Les zones critiques, par gravité décroissante |  |
| 230 | 619 | 3. Les tests exigés par `expert-cybersecurite`, traduits en cas exécutables | RG116–RG148 |
| 282 | 47 | ↳ T1 — Anonymisation de bout en bout, sur la charge utile brute |  |
| 329 | 89 | ↳ T2 — RLS par rôle et par table, et échec de la CI sur toute table non déclarée |  |
| 418 | 56 | ↳ T3 — Inviolabilité du registre et détection d'altération de chaîne |  |
| 474 | 51 | ↳ T4 — Aucun rôle d'exécution ne porte `BYPASSRLS` |  |
| 525 | 28 | ↳ T5 — Journalisation des lectures de conversation (A10) |  |
| 553 | 33 | ↳ T6 — Opérations élevées : la liste fermée est réellement fermée |  |
| 586 | 26 | ↳ T7 — Le passe-plat |  |
| 612 | 27 | ↳ T8 — Authentification |  |
| 639 | 24 | ↳ T9 — Storage |  |
| 663 | 20 | ↳ T10 — En-têtes et politique de sécurité de contenu |  |
| 683 | 14 | ↳ T11 — Secrets |  |
| 697 | 13 | ↳ T12 — Dépendances |  |
| 710 | 17 | ↳ T13 — Messages d'erreur et journaux |  |
| 727 | 14 | ↳ T14 — Références directes non contrôlées (IDOR) |  |
| 741 | 14 | ↳ T15 — Limitation de débit |  |
| 755 | 37 | ↳ T16 — Aucun calcul de commission |  |
| 792 | 46 | ↳ T17 — Garde-fou `staging` | RG116–RG148 |
| 838 | 11 | ↳ 3.1 Récapitulatif des contrôles X1 à X4 |  |
| 849 | 188 | 4. Les tests métier, en complément des 17 | RG160–RG164 |
| 1037 | 37 | 5. Le sort des gardes existantes de `apps/web` |  |
| 1074 | 149 | 6. Le corpus de test de la détection de coordonnées |  |
| 1223 | 43 | 7. Le parcours de bout en bout du Lot 6 |  |
| 1266 | 23 | 8. Ce qui n'est pas couvert, et pourquoi |  |
| 1289 | 57 | 9. Ce qui remonte |  |
| 1346 | 153 | 10. La définition du « prêt à livrer », lot par lot | RG162 |
| 1499 | 25 | 11. Verdict |  |

## 19-revue-de-coherence-2026-09-24.md (~5k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 15 | 19 | 0. Préalable : le statut du code (D44) |  |
| 34 | 17 | 1. Corrections factuelles appliquées le 2026-09-24 | RG8–RG9 |
| 51 | 142 | 2. Contradictions tranchées par le fondateur | RG2–RG122 |
| 193 | 21 | 3. Oublis : tranchés par le fondateur le 2026-09-24 | RG2–RG123 |
| 214 | 24 | 4. Questions ouvertes des spécifications |  |
| 238 | 24 | 5. Suites | RG113–RG146 |

## 20-direction-design.md (~9k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 26 | 20 | 1. La règle de méthode : emprunter des comportements, jamais des styles |  |
| 46 | 13 | 2. Trois registres visuels |  |
| 59 | 30 | 3. Carte des références par surface | RG7–RG90 |
| 89 | 16 | 4. Sept principes propres à INFLUX | RG5–RG73 |
| 105 | 16 | 5. Trois niveaux de confirmation | RG115 |
| 121 | 30 | 6. Montants : la règle de provenance | RG4–RG73 |
| 151 | 166 | 7. Les apartés (D47) : conception de l'interface | RG46–RG146 |
| 317 | 13 | 8. Angles morts du dark theme |  |
| 330 | 13 | 9. Questions ouvertes | RG116–RG130 |
| 343 | 11 | 10. Tokens proposés |  |

## 21-plan-de-developpement.md (~16k tokens)

| Ligne | Lignes | Section | RG citées |
|---|---|---|---|
| 10 | 36 | 0. L'essentiel | RG72–RG148 |
| 46 | 7 | 1. Point de départ & conventions d'environnement |  |
| 53 | 39 | 2. Stratégie de développement | RG44–RG148 |
| 92 | 23 | 3. Écarts actifs pour les jalons restants (J5 à J9) | RG23–RG146 |
| 115 | 43 | 4. Lot 0 — le socle (J0 à J4) |  |
| 158 | 177 | 5. Lot 1 — le premier usage (J5 à J9) | RG5–RG164 |
| 335 | 9 | 6. Configuration des services externes |  |
| 344 | 17 | 7. Après le Lot 1 : la feuille de route (Lots 2 à 6bis) |  |
| 361 | 11 | 8. Guide de lecture par jalon | RG54–RG58 |
