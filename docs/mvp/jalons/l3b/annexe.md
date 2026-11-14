# Jalon L3B — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts` ou `apps/web/e2e/case-floors.ts`, jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3B-T1 | base | `t8-privacy-execution.test.ts` (L3A-T5) | exportés ≥ 130, exclusions nommées exactes, témoin `excluded_third_party` | +1 cas | 01 |
| L3B-T2 | base | `campaigns-core.test.ts` | chaque contrainte de `0303` refusée par son nom, acceptée sans elle (patron `reference-taxonomies`, inventaire) ; 7 types, motifs, éléments demandés | 30 | 02 |
| L3B-T3 | base | `t2-rls-matrix.test.ts` (lignes de `@influx/test-kit/rights`, sans titre propre), `campaigns-core.test.ts` (TM5.6 l. 796, TM11 l. 997) ; EC-L3B-R-1 | droits déclarés (T2) ; marque sur ses seules lignes ; créateur : aucun droit sur `campaigns.*` (TM5.6) ; parité Drizzle | +10 | 02 |
| L3B-T4 | base | `reference-taxonomies.test.ts`, `t16-commission.test.ts` | grille exacte par devise, contiguë, une tranche ouverte, nets nuls, absente de `supabase/seed` (L2AT-5, T16.4) | +4 | 03 |
| L3B-T5 | unitaire | `packages/domain` (`campaign/*.test.ts`) | obligatoires et conditionnels, RG70 (paire nommée), RG74, bornes de texte, plafonds, détection CA12 à CA14 et faux positifs | 25 | 04 |
| L3B-T6 | base | `campaigns-submission.test.ts`, `campaign-parity.test.ts` | transitions et gel ; CA2, CA3, CA4, CA45, CA76, devise sans tranche, CA56 (RG85), `campaign.submitted` ; même verdict base et domaine | 20 + parité | 05 |
| L3B-T7 | base | `t8-privacy-execution.test.ts` (section neuve) | campagnes dans l'export et l'effacement, brouillon et soumise, aucune ligne d'autrui | 6 | 06 |
| L3B-T8 | intégration | `campaigns-route.test.ts`, `t14-campaigns-route.test.ts` | routes, autosave des champs modifiés, listes remplacées, refus traduits ; T14.1 à T14.4 | 15 + 8 | 07 |
| L3B-T9 | intégration | `campaigns-creator-view-route.test.ts`, `t1-anonymisation.test.ts` | CA68, CA41, CA75 sur charge brute (marqueurs distinctifs en base) ; T1.2 : routes L3B à l'inventaire ; balayage créateur sans marqueur de campagne | 8 + 2 | 08 |
| L3B-E1 | e2e | `brand-campaign.spec.ts` | liste, création, étapes 1 à 3, reprise après rechargement, livrables compris (CA72), aucun champ fichier (CA16), axe FR 375 et EN 1 440 | 4 | 09 |
| L3B-E2 | e2e | idem | manquants nommés (CA3), dates en conflit, dotation seule sans tranche (CA76), case RG85 (CA56), soumission (CA4), échec d'enregistrement | 4 | 10 |
| L3B-E3 | e2e | idem | aperçu sans tranche, budget total ni référence interne, nature et « À négocier », FR et EN (CA68) | 2 | 11 |

**Budget e2e : 25 s** (09 ≤ 9 s, 10 ≤ 9 s, 11 ≤ 7 s), médiane de trois passages, états préparés
par l'API ; mesure dans `run.md` à chaque ligne. Éclats e2e CI : chacun < 7 min 30 (alerte au-delà
de 7 min : arbitrage `integrateur` d'un quatrième éclat, prévu au plan avant L3F).
**Base** : le lot ajoute 60 à 90 s ; éclat le plus long + contrôle ≤ 8 min (L3A invariant 3).
T16 (CA40) : statique, vert à chaque `pnpm check:fast`, sans exemption ajoutée.

## Critère de fin
- [ ] Sur `staging`, une marque publiée crée une campagne, la reprend après fermeture du navigateur
      (CA72, livrables compris) et la soumet : `pending_review` — preuve : ligne F2, lecture seule
      agent (`status`, `campaign.submitted` et son rang dans `audit`).
- [ ] Tranche absente de toute charge créateur — preuve : L3B-T9 (balayage, vue créateur), L3B-T3.
- [ ] `0303` à `0306` appliquées sur `staging` — preuve : CI, étape « Migrate staging » verte (run).
- [ ] T2, T14, T16, TM11 verts ; parité domaine et base — preuve : run CI, lignes 02 à 08.
- [ ] L2AT-5, L3AS-6, L3AT-6 soldés ; L3AS-3 soldé si la porte appartient à `influx_identity_definer`
      — preuve : SHA des lignes 01, 03, 05.
- [ ] e2e M3 FR/EN ajoutés ≤ 25 s, éclats CI < 7 min 30 — preuve : `run.md` § Mesures de clôture.
- [ ] `pnpm check` puis `pnpm test:e2e` verts — preuve : ligne C.
- [ ] Revue soldée et attestée (`security-reviewed:`) — preuve : SHA du commit d'attestation.

## Écarts, décisions ouvertes, risques
- **EC-L3B-1** : `0303` à `0306` pris par L3B ; `04` §11 (l. 6199-6204 : `0304` publication, `0305`
  à `0308` recherche et réglages) décalé d'autant ; amendé à la clôture.
- **EC-L3B-2** : `17` §4.3 étape 4 et sa maquette (l. 799, 803-842) sont antérieurs à l'extension de
  D78 : M3 suit le bandeau de `09` §F (l. 483-503) ; `17` amendé à la clôture.
- **EC-L3B-3** : motifs de refus, 8 dans `04` l. 1721-1723, 13 dans `09` RG90 (l. 734-755) : tranché
  par A, `04` amendé à la clôture.
- **EC-L3B-4** : chemin de l'aperçu absent de `17` §2.6 : `/campagnes/[id]/apercu` ·
  `/campaigns/[id]/preview` (patron `compte/profil/apercu`), amendé à la clôture.
- **Réponses du fondateur (2026-11-13, « ok pour toutes les questions »)** : (1) création et
  correction par un agent pour le compte d'une marque (RG1, RG94, CA60, CA61) affectées à L3C (fiche
  campagne du backoffice) ; (2) 11 commits, `0306` (export et effacement) compris ; (3) recette
  `staging` par le fondateur (F2).
- **Décisions ouvertes sans effet sur `main`** : `09` Q5, Q6, Q7 (vetos RGPD, Lot 6) ; Q9, Q11 en
  paramètres ; RG15 (plafond de 10) : au L3B ou en L3C, selon A.
- **Risques** : `0303` volumineux (≈ 45 colonnes, 8 tables filles) : arrêt de la ligne 02 au-delà de
  1 600 lignes, scission proposée ; L3AS-3 échoit si la porte de 05 appartient à
  `influx_identity_definer` (D81 (5)) ; grille non validée à F1 : 03 et 10 bloquées, 02, 04 à 09
  possibles ; DS-flaky surveillé à la clôture.

## Revue
Fin de jalon (2026-11-14, `8c1f15b..d084fce`) : **0 bloquant**, 2 jalon, 3 avant production, 10 plus
tard (dont L3BT-5 et L3BT-6, soldés par la ligne C : 8 restent). Rapports rendus sans fichier (les
`l3b/revue-constats-*.md` de `revue.md` n'existent pas) : cette section fait foi, `cloture.md` point 5
compris. Constats U (`L3BU-n`) : `l3b/ux-constats.md`, fix-1 à fix-3 soldés. **Verdict S** : L3B
clôturable ; `main` et `staging`, rien ne bloque (D71) ; entrée de L3B dans `production` autorisée sous
deux conditions : attestation I-4 couvrant les cinq SHA (§ Attestation), L3BS-1 traité ou arbitré par
le fondateur. Dettes soldées : L3AS-6, L3AT-6 (`838168cc`, `t8-privacy-execution.test.ts:1394-1460`) ;
L3AS-3 (`0305:914-922`, `campaigns-submission.test.ts:757-780`). Vérifiés sans constat : invariants 1,
3, 4 ; porte de soumission ; `0306` ; T16 ; aucune dépendance ajoutée. **Non couvert explicitement
(T)** : brouillon concurrent sur deux onglets côté interface ; reprise « après fermeture du navigateur »
prouvée par rechargement seulement ; mutation d'un seuil de parité non rejouée.

### À corriger dans le jalon
- **L3BT-1 — parité base/domaine absente pour les dates et les bornes de longueur (→ fix-4).** La
  fiche (invariant 5) exige que obligatoires et dates (RG70, RG74) soient vérifiés par la base avec le
  verdict de `packages/domain` par test de parité ; L3B-T6 promet « même verdict base et domaine ».
  `apps/api/db-tests/campaign-parity.test.ts:72-250` ne compare que les champs obligatoires. RG70
  (`campaigns_dates_ordered`) et RG74 (`campaigns_publication_window_max_12m`) sont testés à part :
  base `campaigns-core.test.ts:326-366` (seulement 2027-02-01 → 2028-02-01 et 02), domaine
  `packages/domain/tests/campaign-dates.test.ts:75-85` ; `packages/domain/src/campaign/dates.ts:91-95`
  affirme « as the database counts » pour 2028-02-29 → 2029-02-28, jamais comparé à Postgres
  (`date + interval '12 months'`, `0303:313-314`). Scénario : divergence en fin de mois, au 29 février
  ou sur une paire partielle : le formulaire laisse passer ce que la base refuse, ou bloque ce qu'elle
  accepte. Correctif : dans `campaign-parity.test.ts`, des cas de dates (six paires RG70, calendrier
  partiel compris, 29/02, 31/12, +12 mois ± 1 jour) jugés par `campaignDateIssues` et par un UPDATE
  annulé sur `campaigns.campaigns`, et un cas par borne max de longueur (titre, résumé, brief).
- **L3BT-2 — identifiants de l'annexe absents des titres (→ fix-4).** `revue.md` exige « chaque
  identifiant dans un titre ». Absents : L3B-T4 (`reference-taxonomies.test.ts:347`, `:456` ;
  `t16-commission.test.ts:130`) ; L3B-T8 pour T14 (`t14-campaigns-route.test.ts:111`) ; L3B-T9 pour
  T1.2 (`t1-anonymisation.test.ts:1555-1556`) ; L3B-T3 pour T2 et TM11 (`t2-rls-matrix.test.ts`,
  `tm11-drizzle-parity.test.ts`) ; L3B-E1 (`apps/web/e2e/brand-campaign.spec.ts:177, 245, 411, 487`),
  L3B-E2 (`527, 648, 710, 752`), L3B-E3 (`804, 899`), présents seulement dans le commentaire de tête.
  De plus, `apps/web/tests/campaign-view.test.ts:118-867` porte « L3B-E1/E2 » sur des tests
  unitaires : un grep confond les deux niveaux. Scénario : revue et clôture ne retrouvent pas la preuve
  d'un identifiant par son titre, ou la lisent au mauvais niveau. Correctif : préfixer les titres
  concernés par leur identifiant (renommage seul) et retirer l'identifiant e2e des `describe` de
  `campaign-view.test.ts` (convention des tests unitaires web : règles citées, aucun identifiant de
  jalon). **EC-L3B-R-1** (documentaliste, sans enjeu d'invariant) : TM11 de `campaigns.*` est déjà
  titré « L3B-T3 TM11 » (`campaigns-core.test.ts:997-998`) et `tm11-drizzle-parity.test.ts` ne lit pas
  `campaigns` ; T2 est transverse, piloté par `@influx/test-kit/rights`, sans titre propre à un jalon
  (seul J8S-5 en porte un) : colonne Fichier de L3B-T3 corrigée au § Tests, aucun renommage dans ces
  deux fichiers. Même règle appliquée à `t14-campaigns-route.test.ts:237` (second `describe` du
  fichier) et à `campaign-parity.test.ts:252` (L3B-T6 au seul commentaire de tête).

### Avant production et plus tard
| Id | Gravité | Où | Scénario | Correctif | Échéance |
|---|---|---|---|---|---|
| L3BT-3 | avant prod. | `brand-campaign.spec.ts:804` ; `e2e/support/axe.ts:64` | axe `document-title` rouge une fois (aperçu FR 1 440 px, run 43577403102, vert à la relance) : axe passé avant la pose du `<title>` après une navigation douce ; même exposition l. 949 (EN 375 px) ; aucun défaut produit (`generateMetadata` statique non vide) | `await expect(page).toHaveTitle(/.+/)` en tête de `expectNoAxeViolation` | avant `production` |
| L3BT-4 | avant prod. | `0305_campaigns_submission.sql:573` ; `campaigns-submission.test.ts:256` | le verrou `for update of c` de `submit_own_campaign` n'est prouvé que séquentiellement : double soumission, autosave pendant la soumission | deux transactions concurrentes : double soumission → une seule ligne `campaign.submitted` ; autosave contre soumission → état cohérent | avant `production` |
| L3BS-1 | avant prod. | `apps/api/src/domains/campaigns/routes.ts:104-116`, `campaign.ts:504-527` ; `0303:779-781` | aucun plafond de brouillons par compte, aucun débit sur les routes de session (T15 exemptées, L2ES-1 → Lot 6) : un compte annonceur gratuit boucle POST puis PATCH (brief de 4 000 caractères), stockage saturé, liste non paginée gonflée | plafond de brouillons non soumis par compte, paramétré en table, compté en base sous verrou du compte (refus `draft_limit`), plus le débit membre du Lot 6 (0,25 j) | avant `production` : condition S, ou arbitrage du fondateur |
| L3BT-5 | plus tard | `run.md` ligne fix-3 (24,8 s) | budget e2e à 24,8 s pour 25 s, sans marge | remesurer, médiane de 3, `run.md` § Mesures de clôture (créé par C) | ligne C |
| L3BT-6 | plus tard | `21` §8 l. 151 (DS-flaky) | la ligne s'arrête à L3A | ajouter l'occurrence L3B (`brand-campaign.spec.ts:804`, run 43577403102, relance verte, L3BT-3) | ligne C |
| L3BT-7 | plus tard | `t14-campaigns-route.test.ts:305` ; `campaigns-creator-view-route.test.ts:543` | 401 et 403 `terms_acceptance_required` prouvés sur cinq routes, pas sur `creator-view` (401 seul) ; compte annonceur suspendu prouvé en base seulement | étendre le 403 à `creator-view` et prouver le compte suspendu au niveau des routes | plus tard |
| L3BT-8 | plus tard | `apps/web/tests/campaign-view.test.ts:795` | le libellé de fix-2 (« par créateur, commission INFLUX incluse ») n'est épinglé par aucun test ; aucun e2e n'affirme les `<title>` des pages campagne | épingler le libellé FR/EN et les `<title>` (recoupe L3BT-3) | plus tard |
| L3BT-9 | plus tard | `brand-campaign.spec.ts:162-170` ; tests base | dates fixes de 2027 : casseront avec une règle de dates passées | les dériver d'une date relative | L3C (règle des dates passées) |
| L3BS-2 | plus tard | `0303:555-560` | le gel ne vise que `influx_advertiser` et `influx_campaign_definer` : un rôle qui recevra une écriture sur `campaigns.*` en L3C le contournera | liste fermée de rôles exemptés (`influx_privacy_definer`, propriétaire de la porte L3C), gel pour les autres (0,1 j) | L3C |
| L3BS-3 | plus tard | `packages/test-kit/src/rights/expected-rights.ts:366-375` (droit de `0201`) | `influx_creator` peut lire `reference.price_bands` (rempli par `0304`) ; aucune route ne la sert, pas de fuite tant que D78 tient | `REVOKE SELECT` au créateur, T2 en `refus_droit` (0,1 j) | plus tard |
| L3BS-4 | plus tard | `apps/api/src/domains/campaigns/repository.ts:613-617` | la lecture de la vue créateur repose sur la RLS seule | ajouter `and c.advertiser_account_id = (select influx.current_account_id())` (0,05 j) | plus tard |
| L3BS-5 | plus tard | `0303:855-863` ; `0306:791-802` | six codes `campaign.*` `exported`, mais le journal d'activité ne retient que `campaign.submitted` : les décisions d'agent de sujet `campaign` manqueront à l'export (art. 15) | étendre le sujet aux campagnes du compte, acteur affiché INFLUX, sans charge utile | L3C, avec `expert-conformite-rgpd` |
| L3BS-6 | plus tard | `packages/contracts/src/campaign.ts:225-229` ; `repository.ts:491-495` | `totalBudgetMinor` accepté par PATCH alors qu'aucun écran ne l'envoie (EC-L3B-10-1) ; T16 tient | le retirer du contrat d'entrée jusqu'à ce qu'un écran le demande (0,05 j) | plus tard |

Report au reliquat de `21` §8 : `cloture.md` point 3.

### Attestation
Le contrôle I-4 (`node packages/test-kit/scripts/check-security-review.ts 8c1f15b HEAD`, relu le
2026-11-14) signale cinq commits : `6bffecad` (ligne 02, `0303`), `230f79dd` (03, `0304`), `09948786`
(05, `0305`), `bf4b6d4b` (06, `0306`), `91381f07` (09, `next.config.ts`). La ligne C pose le commit
vide `chore(security): attest the end-of-L3B review` (`cloture.md` point 5), corps :

```text
security-reviewed: 2026-11-14
security-reviewed: 2026-11-14 covers 6bffecad6a049df0460c5be46777ea23876e6e42 230f79ddfaa201b3f7e3aae20beca4b85c284032 099487865473fe29ab60dc203e15440f4edc70d7 bf4b6d4bdd9155799bafdc2fa0a81744a069138c 91381f07c4b01b008052e4215bde9507bbe38636
```

Avant le push : le même contrôle, vert. fix-4 ne touche aucun préfixe surveillé, mais le contrôle se
relance à la clôture sur toute la plage.
