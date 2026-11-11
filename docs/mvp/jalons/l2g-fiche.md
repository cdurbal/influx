# Jalon L2G — Portfolio modéré, profil créateur publié, Lot 2 prêt à livrer

> **Source :** `jalons/lot2-plan.md` l. 31 (ligne L2G), l. 63 (RG108) ; `21` §8 l. 169 (L2D-E2E : arbitrage du fondateur avant L2G), l. 200 (L2DS-4), l. 201 (L2DS-6), l. 178 (L2DU-15) ; `decisions-detail.md` D82 point (7) (l. 815-823) · **Préparé le** 2026-11-11 par Claude Code (`/jalon-prepare L2G`) · **Statut :** validé par le fondateur le 2026-11-11 (F0 : option A, budget révisé ; L2DU-15 : « En cours de saisie » ; exclusions EC-L2G-16 et lecture annonceur au Lot 3 confirmées) · **Exécution :** `/jalon-run L2G`, table `jalons/l2g/run.md`.

## Objectif et périmètre

Un créateur dépose de 3 à 8 visuels (ré-encodés sans métadonnée au dépôt, chacun modéré seul en file 3), soumet son profil quand la liste nominative des obligatoires est vide, et un agent le publie ou le refuse avec un motif typé (file 2). La première publication émet `profile.completed` ; une modification d'un champ modéré d'un profil publié repasse en file, la version validée restant servie. Le créateur voit « ce que voit une marque » depuis la projection même que servira la recherche du Lot 3. La fiche de compte créateur du backoffice montre réseaux, chiffres exacts sourcés et portfolio. Reliquat : L2DS-4, L2DS-6 ; L2D-E2E arbitré avant le premier commit. La clôture coche `18` §10 Lot 2 et clôt le Lot 2.

**Ne change pas :** aucune route annonceur vers un créateur (recherche et lecture annonceur du portfolio : Lot 3, D82 (7), E1-8) ; aucune action de masse en file 3 (Lot 6bis, `00` §9) ; ni correction d'un champ par un agent (`07` RG100) ni suspension d'un profil créateur (Lot 5, comme CA22) ; ni tarif, ni net, ni taux (D48, D78, T16) ; badges, files 4 à 6 et péremption (L2E, L2F) ; libellés D34 en hypothèse de `staging`.

## Invariants

1. **Aucun visuel non approuvé visible hors de son créateur et des agents (`07` RG78, `03` C(16), TM5.5).** Au Lot 2 l'annonceur n'a aucun droit sur `portfolio_items`, sur le compartiment `portfolio` ni sur `storage`, `USAGE` compris ; aucune route ne lui sert un visuel.
2. **Métadonnées (RG79 contrôle 8, RG80, D82 (7), T9.5, T9.10).** Chaque visuel est ré-encodé par `apps/api` au dépôt, aucun original stocké ; `check (moderation_status <> 'approved' or exif_stripped)` ; T9.5 lit les octets.
3. **Remplacement (RG81, `04` l. 1290-1292, 1493-1495, CA44).** Un fichier remplacé repasse en `pending` ; l'ancien visuel approuvé reste servi jusqu'à l'approbation du nouveau ; aucun visuel ne devient publiable par un remplacement.
4. **Bornes (RG77, RG4, RG88).** 3 à 8 visuels ; la soumission exige 3 visuels déposés ; la complétude compte les dépôts, jamais les approbations.
5. **Un élément = une décision (RG78, RG95, RG97, CA42, CA43).** Approuver, ou refuser avec un motif de la grille fermée de RG79 ; aucune troisième voie ; visuel refusé supprimé du Storage à 30 j (D79).
6. **Légende et marque citée (RG82, RG83, CA45).** Légende modérée de 200 caractères au plus ; case d'autorisation non pré-cochée, texte de RG83 mot pour mot, déclaration horodatée et conservée.
7. **Publication humaine (RG4, RG5, RG10, CA7, CA9).** Soumission par le créateur si la liste nominative des obligatoires est vide ; publication par `agent` ou `admin`, jamais par un délai ; profil publiable sans visuel approuvé (RG5, carte sans image, RG84) ; refus = motif de RG96, profil modifiable et resoumis sans délai.
8. **L2DS-4 : régime de RG9 en base.** Statut écrit par les seules portes (garde comme L2CS-3) ; champs modérés gelés une fois publié, révision en file, dernière version validée servie (CA48) ; effet immédiat pour les autres (CA49) ; jeton de version comparé à la décision (`l2c/file.md` A3) ; complétude recalculée dans la porte de soumission, colonne non écrivable par `influx_creator`.
9. **L2DS-6.** `identity.change_member_role()` refuse un compte dont le profil créateur n'est pas `draft` (55000).
10. **Files 2 et 3 (`15` RG27 C1 à C8, RG29, RG36, `07` RG93, RG94, RG6).** Prise atomique, verrou de 30 min, prolongation, levée forcée admin, `sla_due_at` figé (1 j ouvré), escalade à 3 j ouvrés, hors délai décidable et marqué, compte propre ou détenu refusé (`queue.conflict_of_interest`), aucune sortie sans décision ; une ligne `backoffice.sla_policies` par file (RG26).
11. **Sorties (RG106 à RG110, CA62 à CA64, CA74).** `profile.completed` à la première publication, `lead.updated` ensuite, dans la transaction ; Brevo : les seuls attributs de RG107 (tranches, codes, dates), consentement relu à la consommation ; RG108 : jamais handle, pseudo, URL, chiffre exact, légende, nom de fichier ; Apollo : rien de plus qu'au Lot 1 (RG109) ; absent = vide (RG110).
12. **Aperçu (RG104, `17` §9 S1).** Exactement la réponse de la projection publique unique (couche A, visuels approuvés seuls), réutilisée par la recherche du Lot 3 ; jamais reconstituée dans le navigateur.
13. **Journaux (D60, RG99).** Légende, nom de fichier d'origine, textes du profil et chiffres absents de pino, `ops.*`, du registre et des charges `outbox` ; registre : codes et identifiants ; toute décision journalisée nominativement.
14. **IDOR (T14).** Visuel, entrée, révision d'autrui : même réponse qu'un identifiant inconnu ; le membre ne lit ni verrou, ni agent, ni commentaire interne.
15. **Droits des personnes (`04` §9).** Visuels, déclarations RG83, entrées des files 2 et 3 et révisions dans `privacy.export_document()` et l'effacement ; objets purgés du Storage.
16. **T9.6 et T1 tenus.** Aucune table neuve lisible par `influx_advertiser` ; T1 (T1.5) : aucune URL émise, aucun marqueur dans une clé d'objet ni dans une réponse.
17. **Écran.** Tokens, KEO ; FR et EN (backoffice FR, D36) ; WCAG AA, vert jamais seul porteur ; quatre états (RG111) ; mention `creatorProfile.portfolio.notice` au-dessus de la zone de dépôt (`17` l. 1382-1384) ; aucun stockage navigateur.
18. **Tests.** Aucun attendu affaibli, aucun plancher baissé ; e2e selon la décision F0 ; suite base complète par migration, une à la fois (L2C-HARNAIS) ; ligne `expected-rights.ts` et marqueur I-4 par migration.

## Lectures

| Ligne | Tranches |
|---|---|
| F0 | `21` l. 63-67, l. 169 ; `archives/jalons/l2f/run.md` § Mesures de clôture |
| 01 | Fiche entière ; `07` l. 154-238, 743-791, 832-936, 937-995, CA l. 1286-1325, 1355-1372, 1414 ; `17` l. 1289-1395 ; `17b` l. 509-531, 1125-1175 ; `15` l. 268-362 ; `04` l. 1286-1297, 1487-1495, 5240-5260 ; `03` l. 253, 312 ; D82 (7) ; `archives/jalons/l2c/file.md` A1 à A10 ; `archives/jalons/l2d/revue-constats-securite.md` l. 14, 16 |
| 02 à 05 | `l2g/modele.md` ; `0207` (entrées, révisions, `row_key`) ; `0210`, `0215` (décisions, conflit) ; `0216` l. 300-330 ; `0204`, `0205`, `0223` (compartiment, purge) ; `0129` l. 275-320 ; `0132` l. 76-140 ; `0211`, `0212` (lectures leads) ; `0219`, `0235` (export, effacement) |
| 06 | `packages/domain/src/creator-profile/{required,completeness}.ts` ; `packages/contracts/src/creator-profile.ts` |
| 07 | `platform/images.ts`, `platform/storage.ts` ; `packages/web-platform/src/server/relay.ts` ; `domains/profiles/brand-logo.ts` ; `verification/evidence.ts` |
| 08, 09 | `domains/profiles/creator/{routes,profile,repository}.ts` ; `domains/profiles/routes.ts` l. 100-140 |
| 10 | `domains/profiles/brand-decision-email.ts` ; `verification/verification-email.ts` ; `16` RG162 (`Grep`) |
| 11 | `backoffice/queues-routes.ts`, `queues-decision-routes.ts`, `queues-logo-routes.ts`, `queues/{repository,entry-alerts}.ts` |
| 12 | `db-tests/t1-anonymisation.test.ts`, `t9-evidence-unreachable.test.ts`, `tm3-backoffice-catalogue.test.ts` ; `tests/tm11-identifying-fields.test.ts` ; `18` l. 286-330, 643-664, 942-951 |
| 13, 14 | `components/creator-profile/*` ; `e2e/creator-profile.spec.ts` ; `17` l. 1380-1395 |
| 15 à 17 | `QueueTemplate.tsx`, `BrandReviewQueueScreen.tsx`, `BrandReviewEntryScreen.tsx`, `ReviewLogo.tsx`, `AccountScreen.tsx`, `bo-nav.ts` ; `e2e/backoffice-queue.spec.ts` ; `17b` l. 365-555, 1125-1175 |

## Commits

| # | Titre imposé | Contenu | Tests |
|---|---|---|---|
| F0 | *(décision du fondateur)* | L2D-E2E : nouveau levier ou budget révisé, avant tout commit | — |
| 01 | *(arbitrage `architecte`, sans code)* | `l2g/modele.md` : EC-L2G-1 à 16 ci-dessous | — |
| 02 | `feat(db): portfolio items, their bucket and the two creator queues` | `0242` (I-4) : visuels, compartiment, purge, files 2 et 3 au catalogue | T9.10, L2G-D1 à D3 |
| 03 | `feat(db): creator profile submission and moderated fields` | `0243` (I-4) : entrées de file 2, révisions, porte de soumission, gel, visibilité, L2DS-4, L2DS-6 | L2G-D4 à D7 |
| 04 | `feat(db): claim and decisions on creator profiles and visuals` | `0244` (I-4) : prise, décisions, sorties leads et e-mails | TM5.5, L2G-D8 à D11 |
| 05 | `feat(db): L2G data in the export, the erasure and the lead reads` | `0245` (I-4) : export, effacement, lectures du worker | L2G-D12, D13 |
| 06 | `feat(domain): creator submission and portfolio rules` | Obligatoires avec portfolio, complétude atteignable 100, bornes, contrats | L2G-U1 à U3 |
| 07 | `feat(api): portfolio upload, caption and order` | Passe-plat 8 Mio, ré-encodage, quotas, lecture propre | T9.2 à T9.5, T9.8, T9.9, T14 |
| 08 | `feat(api): creator profile submission and revisions` | Soumission, régime RG9, visibilité | T14, CA48, CA49 |
| 09 | `feat(api): what a brand sees, from the public projection` | Projection unique, aperçu avant / après | T1 (T1.5), CA5, CA47 |
| 10 | `feat(worker): creator decisions and attributes` | E-mails de décision, attributs Brevo RG107 | `tm1-brevo-connector`, RG108 |
| 11 | `feat(api): creator profile and portfolio queues` | Listes, ouverture, décisions, lecture d'un visuel journalisée, alertes | T14 |
| 12 | `test(api): moderation and anonymisation proven` | TM5.5, T9.5, T9.10, T1, T9.6, TM11, T2, T16 ×3 | ×3 |
| 13 | `feat(web): portfolio block and profile submission` | C2 bloc 6, publier, états, bloc 7 (≤ 6 s) | e2e |
| 14 | `feat(web): what a brand sees` | Aperçu deux onglets (≤ 2 s) | e2e |
| 15 | `feat(backoffice): creator profile queue and decision` | File 2 (≤ 5 s) | e2e |
| 16 | `feat(backoffice): portfolio moderation queue` | File 3, grille RG79 (≤ 4 s) | e2e |
| 17 | `feat(backoffice): creator blocks on the account record` | `17b` §3.6 ②, ③ (D78), ④ (≤ 2 s) | e2e |
| U | *(constats `expert-ux`, sans commit)* | 13 à 17 ; 375, 768, 1440 ; FR, EN | `ux-constats.md` |
| F | *(recette du fondateur)* | `staging` : un créateur `published` ; revue de dix visuels modérés | `recette.md` |

## Tests

| Identifiant | Niveau | Ce qu'il prouve | Plancher |
|---|---|---|---|
| **TM5.5** | Base + route | Profil `published` seulement par une décision d'agent ou d'admin ; aucun visuel non approuvé dans la projection publique ni dans l'aperçu | Bloquant, vert ×3 |
| **T9.5** | Route (octets) | Image portant une géolocalisation connue : après ré-encodage, la donnée a disparu (lecture des octets stockés) | Bloquant |
| **T9.10** | Base | `approved` refusé sans `exif_stripped` ; changement de `storage_path` : `pending` | Bloquant |
| **T1 (T1.5)** | Base + routeur | Rejoué sur l'inventaire complet ; marqueurs neufs : légende, nom de fichier d'origine, texte de révision ; aucune URL émise ; clé d'objet sans marqueur | ×3 ; 3 marqueurs de plus |
| **L2G-D1 à D3** | Base | D1 bornes 3 à 8, quota ; D2 remplacement : ancien servi, nouveau `pending` (CA44) ; D3 refusé purgé à 30 j, approuvé remplacé purgé | 3 |
| **L2G-D4 à D7** | Base | D4 soumission : liste nominative, 3 visuels déposés, complétude recalculée ; D5 champ modéré publié : révision, version validée servie ; D6 effet immédiat ; D7 `change_member_role()` hors `draft` refusé | 4 |
| **L2G-D8 à D11** | Base | D8 verrou, jeton, conflit d'intérêt (files 2, 3) ; D9 publier : `profile.completed` une fois, puis `lead.updated` ; D10 refus : motif fermé, message, resoumission ; D11 visuel : une décision, motif RG79, RG83 tenu | 4 |
| **L2G-D12, D13** | Base | D12 export ; effacement sans résidu (balayage, objets en purge) ; D13 lectures du worker : RG107 seuls, RG108 jamais | 2 |
| **L2G-U1 à U3** | Unitaire | Obligatoires et message de RG90 ; complétude 100 atteignable ; bornes et légende | Chaque RG citée |
| **T9.6, TM11, T14, T2, T16** | Base, routeur, statique | Tables neuves sans droit annonceur ; chaque route neuve, rôle croisé, objet d'autrui ; lignes neuves ; aucun montant | Chaque route, objet, rôle |
| **e2e** | Navigateur | Lignes 13 à 17 : 19 s annoncés | Selon F0 |

Fichiers neufs dans `e2e/case-floors.ts` et `db-tests/case-floors.ts` dans le commit qui les crée.

## Critère de fin

- [ ] Un créateur `published` sur `staging`, trois visuels modérés. *Preuve : ligne F.*
- [ ] TM5.5, T9.5, T9.10 verts trois fois ; T1 rejoué intégralement (T1.5). *Preuve : ligne 12, CI réelle.*
- [ ] `profile.completed` émis à la première publication, `lead.updated` ensuite, RG108 tenu. *Preuve : L2G-D9, D13, ligne 10.*
- [ ] L2DS-4 et L2DS-6 soldés ; L2D-E2E tranché (F0) et tenu. *Preuve : lignes F0, 03, `run.md` § Mesures.*
- [ ] Revue de dix visuels modérés par le fondateur. *Preuve : `recette.md`.*
- [ ] `18` §10 Lot 2 coché, case par case, avec preuve. *Preuve : ligne C.*
- [ ] T9.6, TM11, T14, T2, T16 verts ; suite base verte. *Preuve : CI réelle.*
- [ ] `pnpm check` et `pnpm test:e2e` verts ; CI verte. *Preuve : `gh run list --json conclusion`.*
- [ ] Revue soldée, attestation `security-reviewed:`. *Preuve : ligne R.*

## Écarts, décisions ouvertes, risques

**Avant le premier commit (fondateur, F0) :** L2D-E2E (`21` l. 169) : la suite entière fait 475,6 s, les éclats CI 309 à 351 s, le levier d'amorce est épuisé. Recommandation : **budget révisé** — la mesure qui fait foi devient le temps de chaque éclat CI (≤ 7 min 30) et du job (≤ 8 min), la somme des médianes restant indicative ; les 20 s par jalon restent la cible annoncée (19 s ici). Alternative : quatrième éclat CI (`integrateur`, un commit `ci(e2e)` en tête).

**À trancher en ligne 01 (`architecte`), avec recommandation :**

- **EC-L2G-1 Entrées de file 2.** Recommandé : `profiles.creator_review_entries` sur le modèle de `advertiser_review_entries` (`kind` `submission`, `revision` ; états ; verrou ; échéances figées ; `member_message`, `internal_comment`) ; motifs de `07` RG96 en table `profiles.creator_rejection_reasons`.
- **EC-L2G-2 Entrée de file 3 = un visuel.** Recommandé : verrou par visuel (RG78, C1), filtre « Profil » ; aucune action de masse (Lot 6bis), `allows_bulk_action` laissé à la valeur du catalogue.
- **EC-L2G-3 États d'un visuel.** Recommandé : `pending`, `approved`, `rejected`, `purging`, `purged` ; remplacement = ligne neuve `replaces_item_id`, l'ancienne `approved` servie jusqu'à l'approbation, puis `purging` ; déclencheur de `04` l. 1291 gardé en défense (T9.10).
- **EC-L2G-4 Plafond et quotas.** Recommandé : 8 Mio sur la seule route de dépôt (D82 (7), table d'exceptions de `relay.ts`) ; quotas en table, 16 dépôts et 64 Mio par compte et jour UTC ; clé `portfolio/<account_id>/<item_id>.webp`.
- **EC-L2G-5 « Déposés » (RG4, RG88).** Recommandé : visuels `pending` ou `approved`, hors remplacements en attente ; un refusé ne compte pas.
- **EC-L2G-6 Champs modérés du créateur (RG9).** Recommandé : `headline`, `bio`, légende (`row_key` = visuel) dans `profiles.moderated_fields` ; ajout d'un réseau, handle, URL : à arbitrer face à la file 6 (L2F) — recommandé : handle et URL d'un compte vérifié en file 6 seule, sinon révision en file 2.
- **EC-L2G-7 Porte de soumission.** Recommandé : `profiles.submit_own_creator_profile()` → liste des manquants (codes) ou `pending_review` ; complétude recalculée en base, `UPDATE` de la colonne retiré à `influx_creator`.
- **EC-L2G-8 E-mails (RG99).** Recommandé : une décision = un e-mail, profil et visuel ; modèles neufs dans `brevo_template_ids` de `staging` dans le jalon (D67, RG162) et dans les portes de `21` §5.8.
- **EC-L2G-9 Projection publique (RG104).** Recommandé : un seul module `apps/api` qui lit `creator_public_*` et les visuels approuvés, servi au créateur sur son compte (avant) et, onglet « après », complété de sa couche I ; la recherche du Lot 3 l'appelle tel quel.
- **EC-L2G-10 Lecture des visuels.** Recommandé : le créateur relit ses visuels (tous états) et l'agent ceux de son entrée, en JSON base64 comme D82 (5) ; lecture d'agent journalisée (`queue.portfolio_read`) ; aucune URL.
- **EC-L2G-11 Visibilité (RG8).** Recommandé : `is_searchable` écrivable par le créateur sur un profil publié, sans effet lisible avant le Lot 3.
- **EC-L2G-12 Alertes d'entrée (RG93).** Recommandé : détection d'un `@`, d'un lien ou d'un nom de réseau dans titre, bio, légende (motif de `errors.identifierInText`), signal non bloquant.
- **EC-L2G-13 Fiche créateur (`17b` §3.6).** Recommandé : blocs ② (chiffres exacts, source, date) et ④ (compte, en attente, lien vers la file) ; ③ « aucun tarif (D78) » ; historique (RG119) si la lecture existe, sinon reliquat.
- **EC-L2G-14 Effacement.** Recommandé : visuels `purging` à l'effacement, déclarations RG83 supprimées, entrées pseudonymisées comme `0207`.
- **EC-L2G-15 Profil publié puis compte rôle changé** : couvert par L2DS-6 (refus) ; aucun autre chemin.
- **EC-L2G-16 Hors périmètre écrit.** RG100 (correction par un agent), suspension d'un profil créateur, action de masse de la file 3 : reliquat `21` §8.

**Réponses du fondateur (2026-11-11) :** F0 : option A (budget révisé). L2DU-15 : l'état `draft` s'affiche « En cours de saisie » / *In progress* (ligne 13). Exclusions (EC-L2G-16, lecture annonceur au Lot 3) : confirmées.

**Risques :** volume de L2G (17 commits pour 10 estimés) ; Storage et mémoire du service `api` (D82, deux traitements à la fois) ; modèles Brevo à créer sur `staging` ; T1.3 (contre-test après révélation) reste au Lot 4, contre-test sur la vue identifiée de l'agent ; DS-flaky (`backoffice-queue.spec.ts:82`, `:422`) touché par les lignes 15 et 16.

## Revue

*(rempli par `/jalon-run` : L2GT-n, L2GS-n)*
