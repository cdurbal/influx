# Lot 2 — Profils, réseaux, audience, badge : découpage en jalons
> 2026-11-01 · Claude Code (`/lot-decoupe`, D77) · Statut : **validé par le fondateur le 2026-11-01** (réponses en fin de document)

Sources : `00` §7 (Lot 2), `21` §7 et §8, `18` §10 (Lot 2 : T1, T9, T14, TM5 partiel, TM11), questions
ouvertes de `06`, `07` et `08`, `04` §11.2 (`0201` à `0207`). I-10 (sessions actives) est déjà livré.

## Préalables
| Décision ou question | Arbitre | Bloque quel jalon | État |
|---|---|---|---|
| D61 · `07` Q15 : trois métriques obligatoires sur chaque ligne de réseau | Fondateur + `chef-de-projet` | L2D (contraintes `0203`) | ✅ Tranchée 2026-11-01 : seuls les abonnés du compte principal obligatoires (RG113 amendée) |
| D61 · `07` Q16 : définitions, bornes, référentiel global | Fondateur (D61) | L2A (`0201`) | ✅ Tranchée 2026-11-01 : valeurs de départ de RG114, RG115 ; tranches d'audience et d'engagement de `08` Q10 (D79) |
| `07` Q1 : tarif indicatif du créateur | Fondateur | L2D (bloc 5, C4) | ✅ **D78** (2026-11-01) : aucun tarif saisi ni annoncé, coûts négociés avec le commercial ; `price_bands.net_*` nuls (D48) |
| `03` R-4 : vocabulaire « anonymisé » (donnée personnelle) | `expert-conformite-rgpd` | L2D (libellés de couche, landing) | ✅ D79 : « identité masquée » / *identity hidden* ; « pseudonymisé » dans les documents légaux ; revue au Lot 6 |
| `03` R-5 · `08` Q2 · `07` Q5 : pièces avec données de tiers | `expert-conformite-rgpd` (veto `production`) | L2E (`0206`) | ✅ D79 : pièces supprimées 45 j après décision, chiffres et empreinte 3 ans ; revue au Lot 6 |
| D34 · `08` Q1 · `07` Q12 · `06` Q5, Q10 : libellés, niveaux, péremptions | Fondateur + `product-owner` + `expert-conformite-rgpd` + juriste | L2E (affichage), L2F (péremption) | Hypothèse de `staging` validée 2026-11-01 : `08` RG10 ; 90 j / aucune / 12 mois en table ; relecture juriste = porte `production` |
| D24 : créateurs particuliers (instruite) | `expert-conformite-rgpd` + `expert-paiement-facturation` + expert-comptable | Aucun (pas d'effet de schéma relevé dans `04`, `07`, `08`) ; porte `production` | Ouverte ; `00` §12, prérequis 10 |
| Ré-encodage d'images (E1-6, I-1), `@supabase/storage-js`, Storage en CI (`storage-api` exclu, `ci.yml` l. 220 et 271) | `architecte` + `integrateur` | L2B | À arbitrer ; dépendance nouvelle = suite complète |
| Points à veto RGPD : `06` Q2 à Q4, `07` Q2, Q3, Q8, Q9, Q18 | Fondateur ; `expert-conformite-rgpd` au Lot 6 (D71) | Aucun sur `main` | ✅ D79 : ville jamais révélée, pas de date de naissance, visages admis, visuel refusé supprimé à 30 j |
| Paramètres et cadrages : `06` Q1, Q6, Q8 ; `07` Q11, Q14, Q17 ; `08` Q5, Q6, Q8 | Fondateur | Aucun (valeurs en table) | ✅ D79 : valeurs de départ ; 3 visuels minimum ; « Compte vérifié » requis ; trois chiffres constatés |
| `06` Q7 : pays dont le registre d'immatriculation est consulté | Fondateur | L2E (« Marque vérifiée ») | ✅ D79 : aucun pays exclu ; registres officiels gratuits ou LEI ; table par pays, socle puis à la demande |

## Jalons
| ID | Objectif (une phrase) | Spécifications (tranches) | Migrations | Écrans | Tests porteurs | Dépend de | Commits estimés | Critère de fin |
|---|---|---|---|---|---|---|---|---|
| **L2A** | Solder la dette d'ouverture, regagner de la marge e2e, poser les référentiels du lot | `21` §2.3, §8 ; `04` §4.2, §11.2 ; `07` RG113 à RG115 | `0201` | — | T2 ; `pnpm audit --prod` ; `journey-resume` sous `page.clock` | `07` Q16 (valeurs de départ) | 8 | Audit sans critique ni élevée ; e2e allégé d'au moins 10 s (`run.md`) ; `0201` sur `staging` ; reliquat L2A soldé |
| **L2B** | Une marque remplit, enregistre et soumet son profil, logo compris, chaque champ portant sa couche | `06` §A à §D, §F ; `17` §4.2 ; `03` §6.6 (E1-1 à E1-11), P10 ; `04` §5.2 (marque), §5.11 | `0202` ; compartiment du logo | M2 (KEO, D74) | T9.1 à T9.5, T9.8, T9.9 ; T14 ; T2 ; e2e M2 FR/EN | L2A ; arbitrage `architecte` | 9 | Sur `staging`, profil marque soumis ; EXIF absent du logo (octets lus) ; Storage actif en CI ; `packages/domain` créé (complétude) |
| **L2C** | Un commercial prend en charge, valide ou refuse (motif typé) un profil marque ; publié, il part enrichi vers Brevo | `06` §G, §I ; `15` (files, SLA, verrou) ; `17b` §2, §3.5 ; skill `backoffice-ops` | `0207` ; file 1, SLA, codes `profile.*` | Anatomie de file, file 1, fiche marque | T2 ; T14 ; verrou en base (double prise en charge) ; e2e file 1 | L2B | 9 | Soumis → pris en charge → publié ou refusé sur `staging` ; révision d'un champ modéré repasse en file ; RG108 tenu |
| **L2D** | Un créateur remplit ses blocs 1 à 5 en trois couches ; rien d'identifiant n'atteint un annonceur | `07` §A à §G (§G sous D78), §I, §E bis ; `17` §5.2, §5.4 ; `04` §5.2 (créateur) ; `03` P5 | `0203`, `0204` (non réversible) | C2 blocs 1 à 5, C4 « Mon offre » sans tarif ; libellés « anonyme » de la landing remplacés (R-4) | **T1** (inventaire du routeur, charge brute, erreurs), **TM11.1, TM11.2**, TM12.6, T14, T16, T2 | L2A ; R-4 (D79) | 10 | T1 et TM11 verts trois fois ; ni tarif, ni net, ni taux saisi ou affiché ; blocs 1 à 5 enregistrés sur `staging` |
| **L2E** | Propriété d'un compte par code en bio, captures déposées, trois chiffres constatés : premiers badges datés | `08` §A à §G, §I, §J ; `06` §E ; `07` RG116 à RG118 ; `17` §5.3 ; `17b` §3.7 ; skill `profile-verification` | `0206` ; file 4, codes `verification.*` ; table des sources de registre (socle) | C3 ; file 4 et vérification ; badges sur M2, C2 | **T9.6**, T9.7 ; T14 ; T2 ; e2e C3 et vérification | L2C, L2D ; D34, R-5 | 10 | Premier badge « Audience vérifiée » daté sur `staging` (valeur de `00` §7) ; T9.6 vert trois fois |
| **L2F** | Le badge périme à 90 j, se rafraîchit, se retire sous 2V (D51), se conteste, se remet en question si l'identifiant change | `08` §H ; `03` §3.2 ; `15` (files 5, 6) ; `17b` §3.6, §3.13 | Action 2V `badge.revoke` ; files 5, 6 ; tâche de péremption | Files 5 et 6 ; retrait ; contestation dans C3 | **TM5.3, TM5.4** (horloge simulée) ; T14 ; T2 ; e2e retrait | L2E ; D34 | 8 | Péremption prouvée et journalisée comme événement système ; retrait refusé sans 2V |
| **L2G** | Au moins trois visuels modérés, profil créateur validé et publié, `profile.completed` émis : le lot est prêt à livrer | `07` §H, §J à §L ; `17` §5.2 (bloc 6) ; `17b` §3.6 ; `18` §10 (Lot 2) | `0205` ; files 2, 3 ; alertes du lot | C2 bloc 6 et publication ; files 2, 3 ; fiche créateur ; aperçu « ce qu'une marque voit » | **T9.5, T9.10, TM5.5**, T1 rejoué (T1.5), T14 ; e2e du parcours du lot | L2C, L2E | 10 | Un créateur `published` sur `staging` ; `18` §10 Lot 2 coché ; revue de dix visuels modérés (fondateur) |

Total : 7 jalons, environ 64 commits. Dépendances réelles : L2D peut suivre L2A en parallèle de L2B et L2C.

## Reliquat repris (`21` §8)
| # | Jalon qui le traite |
|---|---|
| RK-fin, PLS-1 | L2A, commits de tête (dépendances : suite complète) |
| J9T-5, SNT-1, SNT-3, J9T-8, J9T-9, DS-flaky | L2A (avec le levier `page.clock`) ; DS-flaky surveillé à chaque clôture |
| J9S-6 (+ PLS-3, PLT-6, même fichier), J9S-9 | L2A |
| J4S-7 | L2A, garde posée avant les routes de profil de L2B |
| RK-e2e | Chaque jalon (mesure de clôture dans `run.md`) |
| J9S-7 (+ PLS-7), PLK-1 | L2C (première retouche des routes et écrans du backoffice) |
| PLT-5, PLS-5, PLS-6 (avant production) | L2F (même migration que la fonction 2V) |

Non repris (avant production ou plus tard, sans lien avec un jalon) : PLS-2, PLT-2, PLS-4, PLT-4, PLS-9,
PLT-7, PLS-8.

## Risques et budget
- **e2e** : au plus 20 s ajoutées par jalon (`21` §2.3), soit jusqu'à 140 s sur le lot pour 10 à 13 s
  regagnées en L2A. Le levier structurel (éclats) sera vraisemblablement nécessaire : arbitrage
  `architecte` sur recommandation `testeur` à la clôture de L2C au plus tard, ou dès 7 min 30.
- **CI** : Storage démarré en CI dès L2B (temps de démarrage à mesurer, jobs base et parcours) ; suite
  base complète à chaque migration (D76), sept migrations au moins.
- **Anonymisation** : `0204` (`REVOKE` annonceur jamais annulé, `04` §11.3), T1 sur charge brute, TM11.
  T1.3 et le « après » de T1.6 exigent une mise en relation révélée (Lot 4) : au Lot 2, contre-test sur
  la vue identifiée de l'agent ; écart à consigner dans la fiche L2D.
- **RLS** : chaque migration porte sa ligne dans `expected-rights.ts` (T2) et, si politique ou `GRANT`,
  le marqueur I-4 à la revue de fin de jalon.
- **D45, D46** : aucune route de contact au Lot 2 ; `advertiser_contact_details` jamais servi à un membre.
- **D48, D78, T16** : ni taux, ni net, ni tarif créateur ; aucun montant servi au Lot 2. Sort de
  `creator_rate_cards` et `creator_public_rates` tranché en fiche L2D (choix prudent).
- **RG108** : aucun champ identifiant ni chiffre exact vers Brevo ou Apollo (L2C, L2G).
- **Écart** : `04` §5.11 ne prévoit aucun compartiment pour le logo de marque ; choix prudent en fiche
  L2B (compartiment privé dédié, règles du portfolio).
- **Brevo** : si les notifications de `06` §I et `08` §J sont des e-mails, chaque modèle neuf entre
  dans `brevo_template_ids` de `staging` dans le même jalon (D67, RG162) et dans les portes de `21` §5.8.

## Réponses du fondateur (2026-11-01)
1. Oui : chaque décision ne bloque que son jalon (`21` §8 mis à jour).
2. Non : les trois métriques ne sont jamais obligatoires — *remplacée par la deuxième passe ci-dessous*.
3. Dans un premier temps, aucun coût annoncé : ils se négocient avec le commercial (**D78** ; `07`
   §G, `17` §5.4). Portée sur les budgets de campagne (`09` §F) et la facette tarifaire (`10`) à
   confirmer avant le Lot 3.
4. On avance sur les hypothèses écrites ; revue `expert-conformite-rgpd` au Lot 6 (D71).
5. Oui : hypothèse D34 pour `staging`, relecture du juriste avant `production`.
6. Oui : sept jalons. Suivant : `/jalon-prepare L2A`.

Deuxième passe, même jour (« OK pour tout ») : toutes les recommandations retenues, **D79** et D61.
La réponse 2 devient : seuls les abonnés du compte principal sont obligatoires. `06` Q7 : aucun pays
exclu, registres officiels gratuits ou LEI, socle puis ajout à la demande. Aucun préalable ne reste
ouvert pour le fondateur.
