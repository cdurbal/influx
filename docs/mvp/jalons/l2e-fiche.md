# Jalon L2E — Propriété, pièces, constat : premiers badges datés

> **Source :** `jalons/lot2-plan.md` l. 29 (ligne L2E), l. 14, 15, 20 (préalables R-5, D34, `06` Q7), l. 64-67 (risques) ; `21` §8 (L2DS-1, L2DS-2, L2CT-8, L2CS-8, L2D-E2E) ; D80 « reste ouvert avant L2E » · **Préparé le** 2026-11-06 par Claude Code (`/jalon-prepare l2e`) · **Statut :** à valider · **Exécution :** `/jalon-run l2e`, table `jalons/l2e/run.md`.

## Objectif et périmètre

Un créateur fait constater, réseau par réseau, la propriété de son compte (code en bio, relevé par l'agent) puis son audience (captures du tableau de bord natif, trois chiffres saisis par l'agent). Une marque fait constater son domaine et son immatriculation. Un commercial traite ces demandes dans la file 4 (deux vues, verrou, SLA, motifs typés) : il accorde ou refuse à la main. Le badge obtenu est daté, par réseau, visible dans C2, C3 et M2 ; les tranches publiques passent en « constaté ». T9.6 prouve qu'aucune pièce n'atteint un annonceur.

**Ne change pas :** péremption, rappels, retrait 2V, contestation, changement d'identifiant, files 5 et 6 (L2F : `expires_at` et les états sont posés ici, aucune transition) ; condition RG16 à la publication (L2G) ; portfolio (L2G) ; affichage à un annonceur (aucune route annonceur ne lit un créateur avant le Lot 3 : CA2, CA8, CA9, CA59, CA60 au Lot 3) ; OAuth (D65) ; tableau de bord RG68 et alerte `other` RG58 (Lot 6bis) ; aucun montant, taux, net ni tarif.

## Invariants

1. **Pièce jamais à un annonceur (C(13), RG82, T9.6).** Ni droit (`verification.*` sans `GRANT` à `influx_advertiser`, privilèges par défaut compris, `04` l. 5708-5709), ni route, ni champ de réponse. Un créateur ne lit de ses pièces que les métadonnées, jamais les octets (EC-L2E-7).
2. **Lecture d'une pièce (RG83, RG84, C(14), T9.7).** Par `apps/api` seul, jamais d'URL signée, chaque ouverture journalisée `verification.evidence_viewed` (agent, demande, pièce) par la base, dans la transaction qui rend la clé. Storage indisponible : décision d'audience bloquée (`17b` l. 1235).
3. **Dépôt (RG34, RG35, RG85, E1-4, E1-5, E1-9, E1-10).** Selon D82. Quel que soit le choix : type lu dans les octets, PDF refusé, image ré-encodée sans aucune métadonnée avant tout examen, nom d'origine jamais reçu ni stocké, clé calculée (ligne écrite avant l'objet, D80), quotas par compte en table, compartiment privé.
4. **Rétention (RG86, RG88, CA57, CA58, D79).** `retention_due_at` obligatoire à l'insertion, recalculé à décision + 45 j (paramètre) ; objet retiré par la tâche `storage_purge`, chiffres et empreinte gardés 3 ans ; `evidence_too_wide` : objet purgé tout de suite, jamais une ligne `active` retirée par la tâche avant son échéance.
5. **Attribution à la main (RG9, RG47, RG49, CA25).** Aucune attribution sans agent nommé, verrou tenu et `aal2` ; aucune pré-saisie, aucun bouton de reprise ; ni lot, ni connecteur ; deux issues plus « à réexaminer », qui laisse l'entrée en file et l'ancienneté courir (RG50, CA29).
6. **Constat (RG25, RG37, RG38, RG38bis, CA13, CA27).** Propriété : `observed_handle` tapé par l'agent, obligatoire avec `observed_at` (`04` l. 1558), code comparé, jamais d'une capture (CA14). Audience : abonnés, période, publications sur 30 jours, commentaires moyens obligatoires (CHECK, `04` l. 6391) ; facultatif non lisible non saisi ; période cohérente, fin non future, fin à moins de 30 j (paramètre) refusées côté serveur (cas limite 2) ; négatif et engagement hors 0-100 % refusés.
7. **Prérequis et doublons (RG12, RG14, RG21 à RG23, RG60, CA7, CA12, CA37, CA38).** Audience sans « Compte vérifié » sur la même ligne : `ownership_prerequisite` ; une seule demande active par triplet (index) ; code `INFLUX-` + 8 caractères sans ambiguïté, aléatoire, sans coordonnée, un seul valide, 7 j en table ; 24 h et 3 refus par 30 j en table.
8. **Déclaré et constaté (RG19, RG20, RG39 à RG41, CA10, CA26, L2DS-2).** Le déclaré n'est jamais écrasé ; tranche, rythme, commentaires et engagement publics dérivés par le système du constaté tant que le badge d'audience tient, sinon du déclaré ; l'agent ne saisit jamais une tranche ; écriture du créateur sans effet sur une valeur source `agent_observed`. `engagement_band` non nul seulement avec un constat (RG48).
9. **Écart interne (RG41, RG42, RG48, CA28).** Calculé à la lecture par soustraction, affiché à l'agent **après sa saisie**, alerte au-delà de 30 % (table), jamais de refus automatique, jamais publié ni envoyé.
10. **File (RG61 à RG67, RG53, D81, CA31, CA39 à CA44).** Une table, deux vues, jamais un écran mixte ; prise atomique, 30 min, expiration lue, levée forcée admin ; jeton de version ; `sla_due_at` et `escalate_at` figés à l'entrée ; hors délai décidable et marqué ; aucun traitement de son propre compte ni d'un compte détenu (refus 42501 journalisé `queue.conflict_of_interest`, `0215`) ; RG67 : aucune sortie sans décision.
11. **Motifs (RG56, RG57, RG59, RG54, `06` RG52).** Listes fermées, distinctes créateur et marque ; refus impossible sans motif ; commentaire interne jamais au membre ni au registre ; `minor` arrête tout, sans badge, escalade à un administrateur ; `other` exige un message ; compte suspendu : clôture `account_unavailable`.
12. **Affirmation (RG1 à RG7, RG10, RG13, RG93, CA1, CA3 à CA5, CA65).** Libellés de RG10 et RG93 mot pour mot (hypothèse D34 de `staging`, relecture juriste en porte `production`) ; date et réseau partout, source et période pour l'audience, aucun badge global ni superlatif (contrôle par `Grep` sur les locales) ; « INFLUX ne se prononce pas sur l'authenticité des abonnés » à côté du badge. Libellé écrit, jamais la seule couleur (RG97). Date complète (EC-L2E-9).
13. **Aucun identifiant dans le badge (RG89, RG90).** Réseau seul ; `@`, URL, nom d'agent, écart, motifs absents de toute charge publique. Le créateur voit ce qui sera public **avant** tout dépôt (RG96, CA66), et les instructions de capture avant le dépôt (RG87, CA24).
14. **Sorties (RG91, RG92, RG94, `06` RG48, RG80, CA61 à CA63).** Brevo : `VERIFIED_LEVEL` et sa date seulement, sous consentement ; Apollo : rien ; raison sociale et immatriculation jamais. Notifications transactionnelles écrites par le worker depuis `email.json` (D69, aucun modèle Brevo), sans lien, sans chiffre, sans identifiant de réseau.
15. **IDOR (T14).** Compte toujours celui de la session ; demande d'autrui, pièce d'autrui, autre rôle : même code, même corps qu'une adresse inconnue. Le membre ne lit ni verrou, ni agent, ni commentaire interne.
16. **Droits des personnes (`04` §9, `08` l. 861).** Toute donnée neuve dans `privacy.export_document()` et `execute_request()` : pièces purgées, codes supprimés, handles observés vidés, décisions gardées sous forme pseudonyme. Export sans pièce, sans agent, sans écart.
17. **Journaux (D60, RG99).** Handle, code, chiffres, raison sociale, immatriculation absents de pino, `ops.*`, du registre et des charges `outbox` ; registre : codes et identifiants. Aucun export de demande ou de pièce.
18. **Écran.** Tokens seuls, KEO ; FR et EN sans résidu ; WCAG AA ; quatre états (RG95), une pièce en échec ne perd rien (CA67) ; raccourcis clavier au backoffice (RG98) ; aucun stockage navigateur ; `profile_url` cliquable seulement après L2DS-1.
19. **Tests.** Aucun attendu affaibli, planchers jamais baissés ; e2e ajouté ≤ 20 s, un cas par page et par langue ; suite base complète pour chaque migration (D76, une seule à la fois, L2C-HARNAIS) ; chaque migration porte ses lignes de `expected-rights.ts` (T2) et son marqueur I-4 à la revue.

## Lectures

| Ligne | Tranches |
|---|---|
| 01 | `archives/jalons/l2d/revue-constats-securite.md` (L2DS-1) ; `packages/domain/src/creator-profile/network-line.ts` l. 57, 75 ; `0217` l. 205, 269, 277 |
| 02 | `21` §2.3 l. 63-67 ; `archives/jalons/l2d/run.md` ligne C ; `test-results/e2e-report.json` (durées) ; `packages/test-kit/scripts/sum-e2e-durations.ts` |
| 03 | Cette fiche ; `decisions-detail.md` D80, D81 (`Grep`) ; `archives/jalons/l2b/stockage.md` ; `archives/jalons/l2c/file.md` ; `04` l. 1500-1656, 5233-5253, 6385-6393 ; `03` l. 244-250, 295-305, 843, 896, 913, 1068-1090, 1526-1545 ; `08` l. 618-691 ; `06` l. 387-445, 950-958 ; `0218` l. 167-179, 506-550 ; `packages/web-platform/src/server/relay.ts` l. 36, 181-196 ; `platform/images.ts`, `platform/storage.ts` |
| 04 | `06` l. 419-427 ; D79 (12) |
| 05, 06 | `l2e/modele.md` ; `04` l. 1500-1656, 5693-5709 ; `08` l. 270-310, 466-499 ; `06` l. 389-427 ; `0206` l. 50-85 ; `expected-rights.ts` l. 1585-1600 |
| 07 | `l2e/modele.md` ; `08` l. 618-661 ; `0204` (compartiment, quotas) ; `0205` ; `domains/maintenance/storage-purge.ts`, `periodic.ts` |
| 08 | `l2e/modele.md` ; `l2c/file.md` A1 à A9 ; `0210`, `0213`, `0215` (`Grep` des noms) ; `08` l. 388-458, 501-534 |
| 09 | `l2e/modele.md` ; `07` l. 579-608 ; `0217` l. 516-518 ; `0218` l. 167-179, 506-550, 689-707 ; `archives/jalons/l2d/revue-constats-securite.md` (L2DS-2, L2DS-6) |
| 10 | `l2e/modele.md` ; `04` l. 5793-5794 ; `08` l. 861 ; `0219` |
| 11 | `08` l. 262-266, 346-381, 780-791, 695-720 ; `packages/domain/src/creator-profile/*`, `brand-profile/completeness.ts` l. 68, 175 ; `creator-profile/completeness.ts` l. 100, 215 |
| 12, 13 | `domains/profiles/creator/routes.ts`, `brand-logo.ts` ; `platform/images.ts`, `platform/storage.ts` ; `18` l. 654-663 ; `tests/images.test.ts` |
| 14 | `domains/backoffice/queues-routes.ts`, `queues-decision-routes.ts`, `queues-logo-routes.ts`, `queues/repository.ts`, `queues/entry-alerts.ts` ; `08` l. 383-458 |
| 15 | `06` l. 389-427, 836-867 ; `archives/jalons/l2c-fiche.md` l. 179, 221 ; `17b` l. 516 |
| 16 | `domains/profiles/brand-decision-email.ts` ; `0211` ; `domains/leads/connectors/brevo/mapping.ts` l. 31, 132 ; `apollo/mapping.ts` l. 75-77 ; `16` l. 796-797, 1487 ; `08` l. 722-726 ; `tests/brevo-connector.test.ts` l. 2244-2261 |
| 17 | `18` l. 654-663 ; `db-tests/t1-anonymisation.test.ts` ; `tests/tm11-identifying-fields.test.ts` ; `archives/jalons/l2d/revue-constats-securite.md` (L2DS-3) |
| 18, 19 | `17` l. 1396-1470 ; `08` l. 693-739 ; `components/creator-profile/CreatorNetworksFields.tsx` ; `member/ui/VerifiedBadge.tsx` ; `e2e/creator-profile.spec.ts` ; `20` §11.3 ; skill `design-system-influx` |
| 20 | `06` l. 389-427, 619-620 ; `components/brand-profile/*` ; `e2e/brand-profile.spec.ts` |
| 21 à 23 | `17b` l. 111-148, 365-555 (par tranches), 1177-1236 ; `components/BrandReview*`, `QueueTemplate.tsx`, `ReviewDecision.tsx`, `bo-nav.ts` l. 45-53 ; `e2e/backoffice-queue.spec.ts` ; skill `backoffice-ops` |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| 01 | `fix(db): network profile URL authority` | L2DS-1 : autorité stricte au domaine et en base (`0220`, I-4) | Témoins `\`, `%5C` |
| 02 | `test(e2e): suite lightened before the verification journeys` | L2D-E2E : levier mesuré, ≥ 20 s regagnées sans perte de couverture | 3 passages |
| 03 | *(arbitrage `architecte`, sans code)* | `l2e/modele.md`, D82 : dépôt, objet, états, propriétaires, adresses | — |
| 04 | *(arbitrage, sans code)* | `l2e/registres.md` : socle de sources vérifiées | URL relevées |
| 05 | `feat(db): verification core with closed reasons and settings` | `0221` : tables, motifs, sources, file 4, codes, paramètres, RLS (I-4) | T2, L2E-D1 à D4 |
| 06 | `feat(db): member verification requests and ownership codes` | `0222` : portes membre, bloc interne marque (I-4) | L2E-D5 à D9 |
| 07 | `feat(db): evidence bucket, quotas and retention` | `0223` : compartiment, cycle de la ligne, purge, expiration des codes (I-4) | T9.1, T9.3, T9.8, L2E-D10 à D12 |
| 08 | `feat(db): verification claim and decisions` | `0224` : prise, relâche, accorder, refuser, réexaminer, lecture journalisée (I-4) | L2E-D13 à D18 |
| 09 | `feat(db): observed figures feed the public bands` | `0225` : dérivations, engagement, historique, L2DS-2 (I-4) | L2E-D19 à D22 |
| 10 | `feat(db): verification data in the export and the erasure` | `0226` (I-4) | L2E-D23, D24 |
| 11 | `feat(domain): verification rules and contracts` | `packages/domain/src/verification/`, `contracts/verification.ts`, complétude `badgeRequested` | L2E-U1 à U5, T16 |
| 12 | `feat(api): creator verification requests` | Lecture, demande, renouvellement, annulation | T14, CA12, CA37, CA38 |
| 13 | `feat(api): evidence deposit with re-encoding` | Dépôt, ré-encodage, passe-plat (I-4) | T9.2 à T9.5, T9.8, T9.9, CA67 |
| 14 | `feat(api): verification queue and decisions` | Liste, ouverture, décisions, relais de la pièce | T9.7, T14, CA27 à CA33, CA39, CA42 |
| 15 | `feat(api): brand verified request and registry sources` | Bloc interne, demande, sources (admin), EC-L2C-3 | T14, `06` CA26 à CA29, CA32 |
| 16 | `feat(api): verification e-mails and badge attributes` | Worker, `email.json`, `VERIFIED_LEVEL`, L2CT-8, L2CS-8 | CA34, CA61 à CA63, RG80 |
| 17 | `test(api): evidence unreachable by the advertiser role` | T9.6, T1 rejoué, TM11 étendu | T9.6 ×3 |
| 18 | `feat(web): creator account ownership journey` | État par réseau, trois écrans, code, RG96 (≤ 5 s) | Unitaires, e2e |
| 19 | `feat(web): creator audience evidence upload` | Consignes, dépôt, suivi, motif de refus (≤ 4 s) | Unitaires, e2e |
| 20 | `feat(web): brand verified request and dated badges` | M2, bloc interne, code de domaine, badges sur C2 et M2, complétude (≤ 3 s) | Unitaires, e2e |
| 21 | `feat(backoffice): verification queue with its two views` | Sous-entrées du rail, tableaux, compteurs (≤ 2 s) | e2e |
| 22 | `feat(backoffice): creator verification decision` | Écran de décision, relais de la pièce, écarts après saisie (≤ 4 s) | e2e parcours complet |
| 23 | `feat(backoffice): brand verification decision and registry sources` | Décision marque, écran admin des sources (≤ 2 s) | e2e |
| U | *(constats `expert-ux`, sans commit)* | C3, dépôt, décision, 375, 768, 1440, FR, EN | `ux-constats.md` |
| 24 | `fix(web): verification, ux findings` | L2EU-1 à 8, hors parts écartées (§ Revue) | Unitaires, e2e existants |
| F | *(recette du fondateur)* | Premier badge d'audience daté sur `staging` | `recette.md` |

## Tests

| Identifiant | Niveau | Ce qu'il prouve | Plancher |
|---|---|---|---|
| **T9.6** | Base + routeur (`db-tests/t9-evidence-unreachable.test.ts`) | `has_table_privilege` faux et 42501 sur tout `verification.*` et le compartiment ; toute fonction exécutable par l'annonceur, tous schémas, ne nomme aucune table `verification.` (`prosrc`, `pg_depend`) *(note L2E-03, EC-L2E-18 de `l2e/modele.md` : ni `verification.evidence_files` ni `storage.`, propriétaire sans droit sur `evidence_files`, aucun droit de l'annonceur sur le schéma `verification`, `USAGE` compris ; les portes marque nomment demandes, codes et badges, RG61)* ; identifiant réel de pièce deviné sur chaque route de l'inventaire : rien ; témoin rouge | Bloquant, vert ×3 |
| **T9.7** | Base + routeur | Lecture par l'API, aucune réponse ne porte d'hôte Supabase ni de jeton ; journal `verification.evidence_viewed` à chaque ouverture | 2 |
| **T9.1, T9.3, T9.4, T9.5, T9.8, T9.9** | Base, unitaire | Compartiment privé et ses limites ; traversée ; PDF et faux en-tête ; GPS relu dans les octets ; quota à la frontière ; clé sans nom d'origine | 1 par identifiant |
| **T9.2** | Selon D82 | Aucune URL émise, ou ≤ durée arbitrée, journalisée | 1 |
| **T1 rejoué** | `t1-anonymisation.test.ts` | Routes neuves vues ; marqueurs : handle observé, chiffres constatés, raison sociale, immatriculation, code | 5 marqueurs de plus |
| **TM11** | Statique | Champs de `verification.*` absents des schémas hors modules de vérification | Dérivé de Drizzle |
| **T14** | Base + routeur | Annonceur, créateur, marque, agent sur une route d'un autre rôle ; demande et pièce d'autrui | Chaque route neuve |
| **T2, T16** | Base, statique | Lignes neuves ; aucun montant ni clé de prix | Une par objet et rôle |
| **L2E-D1 à D4** | Base | D1 : pièce sans `retention_due_at` refusée ; D2 : rejet sans motif ; D3 : audience sans ses quatre valeurs ; D4 : unicité de badge | 4 |
| **L2E-D5 à D9** | Base | D5 : code (1 000 tirages : alphabet, unicité, aucun lien) ; D6 : ancien code invalidé ; D7 : triplet ; D8 : 24 h et 3 refus ; D9 : réseau d'autrui | 5 |
| **L2E-D10 à D12** | Base + Storage | D10 : purge à 45 j, chiffres gardés ; D11 : `too_wide` purgé aussitôt ; D12 : code expiré, demande expirée, e-mail | 3 |
| **L2E-D13 à D18** | Base | D13 : double prise ; D14 : décision sans verrou ; D15 : jeton périmé ; D16 : compte détenu ; D17 : `minor` ; D18 : deux comptes sur un même identifiant, le second refusé, alerte | 6 |
| **L2E-D19 à D22** | Base | D19 : tranche du constaté, 47 300 → micro (CA10) ; D20 : autosave après constat sans effet public (L2DS-2) ; D21 : engagement nul sans constat ; D22 : historique `agent_observed` | 4 |
| **L2E-D23, D24** | Base | Export ; effacement sans résidu (balayage) | 2 |
| **L2E-U1 à U5** | Unitaire | Période, fraîcheur, écart, libellé de chaque état, score | Chaque RG citée |
| **Marque** | Base + routeur | `06` CA26 à CA29, CA32 ; RG80 sur raison sociale réelle | 5 |
| **e2e** | Navigateur | `verification.spec.ts` : FR et EN, créateur → agent → badge daté ; M2 ; file 4 | ≤ 20 s au total |

`verification.spec.ts` entre dans `e2e/case-floors.ts`.

## Critère de fin

- [ ] Premier badge « Audience vérifiée » daté sur `staging` (valeur de `00` §7). *Preuve : ligne F, identifiant de la décision.*
- [ ] T9.6 vert trois fois de suite. *Preuve : ligne 17, passages de clôture.*
- [ ] T9.7, T9.1 à T9.5, T9.8, T9.9, T14, T1 rejoué, TM11, T2, T16 verts ; suite base verte. *Preuve : `pnpm check` à la clôture.*
- [ ] Un créateur et une marque voient leur refus, son message, et ce qu'ils peuvent faire. *Preuve : e2e, ligne F.*
- [ ] D82 écrite ; `03` §6.6 et PP-9 alignés. *Preuve : `decisions.md`.*
- [ ] L2DS-1, L2DS-2, L2CT-8, L2CS-8, EC-L2C-3, L2D-E2E soldés. *Preuve : lignes 01, 02, 09, 15, 16.*
- [ ] e2e ajouté ≤ 20 s ; chaque éclat sous 7 min 30 en CI. *Preuve : `sum-e2e-durations.ts`, durées de run.*
- [ ] `pnpm check` et `pnpm test:e2e` verts ; CI verte. *Preuve : run.*
- [ ] Revue soldée, attestation `security-reviewed:`. *Preuve : ligne R, commit séparé.*

## Écarts, décisions ouvertes, risques

Choix prudents, à signer par `architecte` en ligne 03 ou par le fondateur à la validation :

- **EC-L2E-1 : `expires_at` compté depuis la décision** (`08` RG69), contre « date de mesure » de `17b` l. 1216, amendé en clôture.
- **EC-L2E-2 : `verification.disputes` créée au L2F**, avec son motif, son issue et ses délais (`08` écart 4) ; `revocation_reasons` créée ici (clé étrangère de `badges`).
- **EC-L2E-3 : cinq notifications au L2E sur les onze de RG94** (reçue ou code généré, accordée, refusée, expirée) ; `16` l. 796-801 n'en liste que six, table amendée en clôture ; D69 lève le risque `brevo_template_ids` du plan (l. 66). Relance à J+3 d'un dépôt abandonné (`08` l. 845) : Lot 5.
- **EC-L2E-4 : paramètres de RG100 en table, journalisés, sans écran** (Lot 5, `17b` réglages) ; seules les sources de registre ont leur écran d'administrateur (D79 (12)).
- **EC-L2E-5 : indicateurs RG68, RG58 au Lot 6bis** (`00` §9) ; au L2E, compteurs de file et alertes d'entrée calculées à la lecture (RG42, RG63, cas limite « même identifiant », `entry-alerts.ts`).
- **EC-L2E-6 : aucune date de naissance** (D79 (4), EC-L2D-7) : le doute mène à `minor` ou à l'escalade, sans colonne.
- **EC-L2E-7 : `03` l. 245 (`S`) lu au plus étroit :** le créateur voit la liste de ses pièces, jamais leurs octets, qu'il possède déjà ; moins d'une route de lecture.
- **EC-L2E-8 : compartiment `verification-evidence`** (`04` l. 5239), contre `verification` de `08` RG81 et `03` P10 ; format stocké selon D82, contre `04` l. 1564.
- **EC-L2E-9 : date complète sur `VerifiedBadge`** (`08` RG4, RG10), contre « mois et année » du commentaire du composant et `20` §11.3 à relire.
- **EC-L2E-10 : la marque ne dépose aucune pièce** (`06` RG51, RG52 : code de domaine et registre constatés en ligne) ; `06` RG56 reste vrai sans objet stocké.
- **EC-L2E-11 : motifs de la marque.** `08` RG57 renvoie à `06` RG66, qui ne porte que le refus du profil. Liste proposée pour l'arbitrage : `domain_code_not_found`, `registration_not_found`, `registration_unverifiable_country` (RG52), `name_mismatch`, `account_unavailable`, `other`, avec textes tirés de `06` RG51 et RG52.

À trancher en ligne 03 (`architecte`), avec recommandation :

1. **Dépôt (D80, D82).** Recommandation : relais généralisé, jamais E1 (URL de 2 h, E1-3 intenable) ; plafond du passe-plat **par préfixe de chemin** (2 Mio partout, 8 Mio sur la route de dépôt de pièce, L2BS-6 en vue), un fichier par requête ; sortie WebP sans perte de lisibilité ; lecture en octets (`Content-Type`, `nosniff`) ou JSON base64 borné ; `STORAGE_READ_MAX_BYTES` et `OBJECT_KEY_PATTERN` à étendre. Dire aussi le volet portfolio (L2G), que D80 lie à cette décision.
2. **Objet et états.** `verification_requests` porte l'entrée selon D81. États proposés : `draft`, `pending`, `approved`, `rejected`, `cancelled`, `expired`, `closed` ; verrou = colonnes de prise, pas d'état `in_review` ni l'index trompeur de `04` l. 1524. « À réexaminer » = motif interne, `pending` conservé.
3. **Propriétaires (A5, L2DS-5).** Recommandation : `influx_verification_definer` neuf pour les décisions (il écrit badges et tranches d'autrui) ; portes membre chez `influx_identity_definer`, bornées à l'appelant, sans `execute` dynamique. Signature `expert-cybersecurite` à la revue.
4. **Source des chiffres (L2DS-2).** Recommandation : `creator_social_accounts` reste le déclaré, `figures_source` n'y prend plus `agent_observed` ; `creator_public_networks.figures_source` porte l'origine, valeurs lues du badge tenant ; révélation du Lot 4 notée.
5. **Bloc interne marque.** Table `profiles.advertiser_internal_details` (raison sociale, pays, numéro ; aucun droit aux créateurs ni à Brevo). `legal_name` : renommer (fonctions à recréer) ou garder en commentant « nom commercial » (recommandé) ; `organization_name` d'Apollo reste le nom commercial.
6. **Paramètres.** `backoffice.operational_settings` étendue (liste fermée l. 77, journal) ou table `verification.settings` : recommandation : la première.
7. **Attributs Brevo.** `VERIFIED_LEVEL` : `n1` compte, `n2` audience, marque `n1` ; date : `VERIFIED_AT`, attribut neuf sur `staging` (D70), `16` l. 1487 amendé.
8. **Adresses.** C3 : route enfant de `compte/profil` par ligne de réseau, ou panneau ; `/files/verifications-createurs`, `/files/verifications-marques` ; `/v1/me/verification/*`, `/v1/bo/queues/verification/*`.

**Écarts de spécification à corriger à la clôture** (code d'abord) : `04` §5.3, §5.11, §11.2 (numéros réels `0220` à `0226`) ; `03` C(12), §6.6, P7, P10, PP-9 ; `08` RG81, RG34 si D82 change le format, RG94 ; `06` RG66, écarts 1 et 3 ; `16` l. 796-801, 1487 ; `17b` l. 1216, 516 ; `18` T9.2, T9.7.

**Risques.** **Volume : 21 commits contre 10 estimés au plan**, le double parcours créateur et marque pèse le plus (`06` et `08` n'ont aucun écran commun, RG61). **e2e :** L2C et L2D ont dépassé, d'où la ligne 02 ; parcours complet à trois acteurs, spec unique, session injectée hors du parcours testé. **Mémoire :** 8 Mio en relais et `sharp` (deux traitements par processus, L2BS-5) ; à mesurer ligne 13. **Fuite :** l'écran de décision lit le handle et une pièce par agent, journal et T9.7 ; `profile_url` ouvert après L2DS-1 seulement. **D34 :** libellés en hypothèse, porte `production`. **Registres :** URL qui changent, table tenue par un administrateur. **Autres sessions :** `git add` des seuls fichiers du commit.

## Revue

*(rempli par `/jalon-run` : L2ET-n, L2ES-n)*

**Ligne U** (2026-11-08, `l2e/ux-constats.md` fait foi) : L2EU-1 à 8 → ligne 24. Reportés :

- **avant production** : L2EU-9 « Exemple » porté par le badge d'aperçu (D34) · 10 récapitulatif marque sans les problèmes de champ · 11 « Ouvrir et prendre en charge » · 12 « (nouvel onglet) » au lien des sources · 13 pièce en colonne collante dès 1024 px · 14 « Annuler la demande » confirmé · 15 marque d'un pays sans source prévenue ou non (`product-owner`) ; écartés de 24 : L2EU-4 (date de nouvelle demande : contrat et route), date de levée du plafond de 5 (migration), page de 6 (`06` RG51, `product-owner`) ;
- **plus tard** : L2EU-16 backoffice en anglais (D36) · 17 aide dans l'espace membre · 18 sources : filtre par pays, confirmation près de la ligne, listes fusionnées.

**États américains** (colonne de subdivision et porte d'insertion de `verification.registry_sources`, EC-L2E-23-1) : reportés à L2F, décision du fondateur.
