# Jalon L3C — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts` ou `apps/web/e2e/case-floors.ts`, jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3C-T1 | base, e2e | tests de campagnes existants | dates dérivées du jour ; mêmes cas, mêmes attendus | inchangé | 01 |
| L3C-T2 | base | `campaigns-review-queue.test.ts` | entrée à la soumission (1 j ; 2 j sensible), une seule ouverte ; RG15 (CA10, campagnes nommées) ; RG95 (CA62, aucun refus) ; verrou (CA58 : titulaire nommé, expiration 30 min, levée admin) ; conflit d'intérêts ; garde L3BS-2 | 22 | 02 |
| L3C-T3 | base | `campaigns-publication.test.ts` | TM5.1, CA5 (aucune autre écriture de `published`) ; instantané = vue créateur, version, empreinte ; TM5.6 ; responsable exigé ; CA48 ; marque non publiée, compte inactif ; CA56, CA57 (le second avis est facultatif et ne bloque jamais, D84) ; CA59 ; jeton périmé ; `campaign.published` et événement de leads dans la transaction | 25 | 03 |
| L3C-T4 | base | `campaigns-lifecycle.test.ts` | RG8, CA8 ; RG9, CA9 (irréversible) ; pause et clôture d'agent ; clôture système à fin + N j, pas avant, acteur système ; RG1, CA60, CA61 (ancienne et nouvelle valeur, motif) ; correction refusée hors des états de `modele.md` | 20 | 04 |
| L3C-T5 | base | `t8-privacy-execution.test.ts` ; `leads-campaign-reads.test.ts` | instantanés et entrées dans l'export et l'effacement ; décisions d'agent au journal d'activité sans agent nommé (L3BS-5) ; lectures `leads.*` sans texte, tranche, budget ni note | +6 ; 6 | 05 |
| L3C-T6 | intégration | `campaign-leads.test.ts`, `campaign-decision-email.test.ts`, test de `periodic.ts` | RG104 (codes, dates, compteurs), RG105, CA70 sur la charge brute envoyée, CA71 (`skipped`, hors compteur d'échecs) ; un e-mail par décision, FR et EN, sans lien ni montant ; tâche réclamée une fois par période | 15 | 06 |
| L3C-T7 | intégration | `campaign-review-route.test.ts`, `t14-campaign-review-route.test.ts` | file, décisions, fiche (lecture journalisée), correction, création ; membre refusé ; T14.1 à T14.4 | 15 ; 8 | 07 |
| L3C-T8 | intégration | `campaigns-route.test.ts`, `t14-campaigns-route.test.ts` | pause, reprise, clôture ; état interdit 409 ; autre marque = inconnu | +6 ; +3 | 10 |
| L3C-E1 | e2e | `campaign-review.spec.ts` | prise, « déjà prise en charge par … », publication, deux temps en secteur sensible, refus avec motif ; axe FR 1 440 (backoffice en français seul, D36) | 4 | 08 |
| L3C-E2 | e2e | `campaign-record.spec.ts` | correction motivée, brouillon créé pour une marque | 2 | 09 |
| L3C-E3 | e2e | `brand-campaign-states.spec.ts` | six états écrits (CA74), motif de refus (CA59), pause, reprise, clôture confirmée ; axe FR 375, EN 1 440 | 3 | 10 |

**Budget e2e : 18 s** (08 ≤ 8 s, 09 ≤ 5 s, 10 ≤ 5 s), médiane de trois, états préparés par l'API,
specs neuves (`brand-campaign.spec.ts` reste à 24,5 s, L3BT-5) ; mesure dans `run.md` à chaque ligne.
Éclats e2e CI < 7 min 30 (4 min 01 au plus à L3B) ; quatrième éclat : arbitrage `integrateur` avant
L3F (plan l. 58-60). **Base** : éclat le plus long + contrôle ≤ 8 min.

## Critère de fin
- [ ] *(non coché : la recette est validée par le fondateur, ligne F, mais les états, l'instantané v1 et les rangs `campaign.*` du registre lus sur `staging` ne sont consignés nulle part ; lecture seule à faire, D70)* Sur `staging`, une campagne soumise est prise en charge, publiée (instantané v1, responsable
      nommé), mise en pause, reprise, clôturée ; une campagne « alcool » est publiée par une seule
      personne, déclaration exigée, second avis respecté s'il est demandé (D84) — preuve : ligne F
      de `run.md` (états, rangs `campaign.*` du registre).
- [x] Clôture automatique à la fin de période + 30 j par le seul worker — preuve : L3C-T4, L3C-T6, verts au run CI 44157039696 (`campaigns-lifecycle.test.ts`, `periodic-scheduler.test.ts`).
- [ ] *(non coché pour la part `staging` : aucune ligne `leads.outbox_events` ni lecture de `ops` consignée ; la part test, L3C-T6, est verte au run CI 44157039696)* Brevo et Apollo sans texte, tranche, budget ni note (CA70) ; sans consentement ignoré (CA71)
      — preuve : L3C-T6 ; `staging` : ligne `leads.outbox_events` de la recette, aucun texte en `ops`.
- [x] `0307` à `0313` sur `staging` — preuve : run CI 44157039696, « Migrate staging » vert (29 s).
- [x] TM5.1, TM5.6 (base), T2, T14, T16 verts — preuve : L3C-T2 à T8, suite base verte en CI (run 44157039696, deux éclats et contrôle). Local : un cas rouge en suite complète, vert seul (`run.md` § Mesures de clôture).
- [x] L3BT-9, L3BS-2, L3BS-5 soldés — preuve : `fe5186a` (01), `19576dc` (02), `fa9fad5` (05) ; `21` §8.
- [ ] *(non coché : éclats CI tenus, 4 min 08 s au plus ; plafonds e2e non tenus en local sur ce poste, décision du fondateur, `21` §8 L3C-E2E)* e2e ajoutés ≤ 18 s, éclats CI < 7 min 30 — preuve : `run.md` § Mesures de clôture.
- [x] `pnpm check` puis `pnpm test:e2e` verts — preuve : CI, run 44157039696 (contrôles statiques, tests unitaires, build, base, parcours navigateur). *Local, 2026-11-17 : `pnpm check` rouge sur un cas (`campaign-review-route.test.ts:275`, vert seul), `pnpm test:e2e` non démarré (build refusé par l'avis de sécurité de Next.js).*
- [ ] *(non coché : attestation en attente de la décision du fondateur)* Revue soldée et attestée (`security-reviewed:`) — preuve : commit d'attestation, contrôle I-4 vert.

## Écarts, décisions ouvertes, risques
- **EC-L3C-1** : `04` §11 l. 6240-6245 (`0307` publication, `0308` à `0310` recherche, `0311`
  réglages) : L3C prend `0307` à `0313` (`0311` à `0313` par les fix X1, X2, X4) et les réglages des
  campagnes (RG6, RG9, RG15) ; la recherche est décalée à `0314` et suivants ; amendé à la clôture
  (`04` §11, fiche, `modele.md` §9, `21`, `16`).
- **EC-L3C-2** : plan l. 33 « clôture à date limite par le worker » : RG9 fait foi (fin de période
  + 30 j, paramètre) ; la date limite ne ferme que les candidatures (CA49, Lot 4), sans écriture.
- **EC-L3C-3** : plan l. 33 « `campaign_price_bands` » : table non créée tant que D78 tient
  (`archives/jalons/l3b/modele.md` §1).
- **EC-L3C-4** : RG85 (« un admin, ou un agent approuvé par un second rôle ») et plan (« deux
  agents ») : lecture la plus sûre, deux personnes distinctes toujours, admin compris (`17b` §3.8).
  *Caduc le 2026-11-16 : remplacé par D84 (une personne publie, second avis facultatif).*
- **EC-L3C-5** : CA63 : responsable exigé à la publication (`17b` l. 1273) ; l'alerte d'une campagne
  publiée sans responsable suit le tableau de bord (Lot 6bis).
- **EC-L3C-6** : RG11 : la publication refuse une marque non publiée ou un compte non `active`
  (`17b` l. 1290) ; dépublication à la suspension avec la porte du Lot 5 (L3AS-4).
- **EC-L3C-08-4** *(décrit seulement au compte rendu de la ligne 08)* : le sélecteur de responsable
  n'apparaît qu'aux phases qui publient ; par défaut l'appelant s'il figure dans `responsibles`, sinon
  l'agent choisit.
- **EC-L3C-08-6** *(idem)* : la réponse d'ouverture ne porte pas l'état de la marque ; le bandeau
  « marque suspendue » n'apparaît qu'après le 409 `brand_not_publishable` (voir L3CU-12).
- **EC-L3C-06-3** : le texte `minor_audience` est rédigé par l'agent ; à relire par `product-owner`
  (reliquat `21` §8, L3C-TXT).
- **Questions au fondateur (validation de la fiche)** : **Q1** RG7 (modifier une campagne publiée) au
  Lot 4 avec `09` Q12, campagne publiée ou en pause figée pour la marque et pour la correction
  d'agent au L3C ? *Recommandé : oui.* **Q2** Création pour une marque : brouillon ouvert par l'agent
  (titre, type), complété par « Corriger un champ », soumis par la marque elle-même (déclaration RG85
  comprise) ; aucun formulaire de huit blocs au backoffice ? *Recommandé : oui.* **Q3** Budget e2e de
  18 s (plan : 15 s, plus RG94), specs neuves, aucun éclat de plus avant L3F (L3BT-5) ? *Recommandé : oui.*
- **Réponses du fondateur (2026-11-14, mot pour mot)** : « oui à toutes les questions » : (1) RG7,
  CA6, CA7 au Lot 4 avec `09` Q12, campagne publiée ou en pause figée pour la marque et pour la
  correction d'agent au L3C ; (2) création pour une marque par brouillon et « Corriger un champ »,
  soumise par la marque ; (3) budget e2e de 18 s, aucun éclat de plus avant L3F.
- **Décisions ouvertes sans effet sur `main`** : `09` Q6 (secteurs sensibles, veto RGPD, Lot 6), Q9
  et Q11 (valeurs en table) ; D36 (langue du backoffice, Lot 5) : convention des écrans existants.
- **Risques** : `0307` ou `0308` au-delà de 1 600 lignes : arrêt, scission proposée ; attributs Brevo
  neufs à créer sur le compte `staging` (D70) avant 06 ; L3BS-5 touche l'export (art. 15) : avis
  `expert-conformite-rgpd` au Lot 6 ; DS-flaky surveillé à la clôture.

## Revue
Fin de jalon (2026-11-17, `f6e1bc4..c67907e`, 26 commits, `0307` à `0313`), après la recette du
fondateur (ligne F) : **0 bloquant**, 3 jalon (L3CT-1 à 3), 8 avant production (L3CT-4 à 8, L3CS-1
à 3), 9 plus tard (L3CT-9 à 12, L3CS-4 à 8). **Verdict T** : prêt à livrer pour `main` et `staging`.
**Verdict S** : livraison autorisée sous conditions, aucun bloquant ni jalon ; entrée de L3C dans
`production` sous L3CS-1 (a) et (b), L3CS-2 (ligne C), L3CS-3 et l'attestation I-4 (§ Attestation).
Constats U (`L3CU-n`) : `l3c/ux-constats.md`. **Relevés par T, vérifiés par S sans constat** : droit
`USAGE` sur `campaigns` passé de 4 à 8 rôles (dont `influx_leads_definer`,
`influx_maintenance_definer`) ; exemption `campaign-review` de `tm11-identifying-fields.test.ts`.

### À corriger dans le jalon
- **L3CT-1 — les specs e2e de L3C laissent leurs campagnes dans la base (→ fix-6).**
  `apps/web/e2e/campaign-review.spec.ts:29-31` : l'`afterAll` (`retireInternals()`) ne retire que les
  agents ; chaque exécution laisse 4 campagnes et leurs entrées de file 7 ; `campaign-record.spec.ts`,
  `brand-campaign-states.spec.ts` et `brand-campaign.spec.ts` laissent aussi des campagnes. Base locale
  mesurée : 34 campagnes « Soins… » en `pending_review`, 44 entrées de file 7 ouvertes, 4 991
  campagnes (4 410 brouillons à titre vide), plus de 40 000 comptes e2e/example. Scénarios : (1)
  `apps/api/db-tests/t14-campaign-review-route.test.ts:327-330` liste sans `?owner=`, `limit=50`, et
  attend `toContain(submitted.entryId)` : au-delà de 50 entrées ouvertes, échec déterministe ; (2)
  `campaigns-review-queue.test.ts:435-445` (« chaque campagne `pending_review` a exactement une entrée
  ouverte ») lit toute la pile : vacuous en CI, fragile en local (déjà rouge sur 117 puis 133
  campagnes résiduelles) ; (3) les balayages T1 et T9.6-A gonflent (49,4 s pour 60 s de
  `testTimeout`) : hypothèse cohérente avec l'intermittence connue, non reproduite. Correctif : un
  `afterAll` retire les campagnes du run et leurs entrées dans les quatre specs (ordre de
  `campaign-routes-kit.ts` l. 194-238), hors durée des cas ; `?owner=${holder.accountId}` au t14
  l. 327 ; cas l. 435 borné à ses propres campagnes, sans être retiré. La purge de la base locale se
  fait à la main, hors dépôt.
- **L3CT-2 — identifiants L3C-T6 et L3C-T7 absents des titres (→ fix-7).** `revue.md` exige chaque
  identifiant de l'annexe dans un titre. `L3C-T6` manque dans `apps/api/tests/campaign-leads.test.ts`
  (l. 246, 387, 413, 480), `campaign-decision-email.test.ts` (l. 178, 230, 289, 414, 632) et le
  `describe("campaign_closure …")` de `periodic-scheduler.test.ts:957` ; `L3C-T7` manque dans
  `apps/api/db-tests/t14-campaign-review-route.test.ts` (l. 185, 221, 317, 415). Scénario : la clôture
  ne retrouve pas la preuve d'un identifiant par son titre. Correctif : préfixer les titres de
  `describe` (« L3C-T6: », « L3C-T7: »), sans changer le nombre de cas ni les planchers.
- **L3CT-3 — § Tests de cette annexe en retard sur D84 et D36 (ligne C, documentaire).** Ligne
  L3C-T3 : « CA57 (même personne refusée, admin compris) », faux depuis D84 (une personne publie,
  second avis facultatif) ; ligne L3C-E1 : « axe FR et EN 1 440 », alors que le backoffice est en
  français seul (D36) et que `campaign-review.spec.ts` n'appelle axe que deux fois, en FR. Correctif :
  amender les deux lignes à la clôture (`cloture.md` point 4).

### Avant production et plus tard
| Id | Gravité | Où | Correctif |
|---|---|---|---|
| L3CT-4 | avant prod. | `0307:399` (`pg_advisory_xact_lock`) ; `0309:1616` | tester le verrou en vraie concurrence (`Promise.all`, lignes committées) : open/open, publication contre levée forcée, deux publications au plafond RG15, clôture automatique contre pause de la marque |
| L3CT-5 | avant prod. | `campaigns-publication.test.ts:449` ; `0313:483`, `0309:558`, `0309:1060` | TM5.1 sans mutation exécutée : un cas énumère `pg_proc` et exige les seuls écrivains de `published` (`publish_campaign_review_entry`, `resume_own_campaign`, `resume_campaign`) ; mutations rejouées en CI : contrôle du verrou vivant retiré, `pause_origin is distinct from 'brand'` retiré |
| L3CT-6 | avant prod. | `run.md` lignes 08 à 10, X3, X5 | marges e2e minces (E1 7,3 s, E2 4,8 s, E3 5,0 s au plafond et non remesurée après X3, `brand-campaign.spec.ts` 24,2 s pour 25 s) : remesurer, médiane de trois, `run.md` § Mesures de clôture |
| L3CT-7 | avant prod. | `campaign-review.spec.ts` (après X5) | plus d'e2e de publication d'une campagne de secteur ordinaire par l'écran : risque accepté (T7.9, `campaign-review-view.test.ts`), à consigner au reliquat ou à rétablir si le budget le permet |
| L3CT-8 | avant prod. | `campaign-review.spec.ts` | axe au seul premier écran de décision : l'étendre aux autres états de l'entrée |
| L3CS-1 | avant prod. | `0313:433` ; `0309:1321` | D84 (veto de `04` §12 point 10) : un seul compte interne publie un secteur réglementé, ou passe `product_sector` à non sensible sous son verrou puis publie (registre `enhanced_review=false`) ; levée du veto avisée favorablement sous deux conditions : (a) contrôle a posteriori (requête de runbook ou filtre backoffice sur les `campaign.published` de secteur sensible en `review_mode='single'` et les `campaign.corrected` de `product_sector` d'une campagne `pending_review`), revu chaque semaine par un admin (PD6, 0,25 j) ; (b) levée écrite par le fondateur dans D84 (6). Q3 (PD7) approuvée ; l'expert ne lève pas le veto lui-même |
| L3CS-2 | avant prod. (ligne C) | `03` l. 920-921 ; `04` l. 2009-2013, l. 6375 | `03` : clause `0313` ajoutée, clauses L3C « À signer » de `influx_campaign_review_definer`, `influx_campaign_definer` (`0309`), `influx_maintenance_definer` (`0309`), `influx_leads_definer` (`0310`, `0311`), `influx_privacy_definer` (`0310`) signées « signé par expert-cybersecurite le 2026-11-17, revue de fin de L3C » ; `04` amendé selon D84 (5), sans second validateur |
| L3CS-3 | avant prod. | `packages/contracts/src/campaign-review.ts:132` ; `0309:1357` | `total_budget` corrigible par l'API alors que l'écran l'exclut (ligne 09) et que l'agent ne lit jamais ce montant (ni calcul, T16 tenu ; CHECK > 0, marque notifiée) : le retirer des champs corrigibles (contrat et fonction, migration hors jalon) ou inscrire l'exception dans `modele.md` §6 |
| L3CT-9 | plus tard | `apps/api/tests/case-floors.ts:60` ; `apps/web/tests/case-floors.ts:19` | planchers relevés au réel (`public-rate` 203 pour 206, `creator-preview-view` 18 pour 21) |
| L3CT-10 | plus tard | `packages/contracts/src/campaign-review.ts` (692 lignes) | un test dédié du contrat (entrées strictes, champs servis) |
| L3CT-11 | plus tard | D76 (`decisions-detail.md`) ; `b4083b1` poussé rouge | D76 dit « une route neuve rejoue t1 et l'inventaire t14 » |
| L3CT-12 | plus tard | `apps/api/db-tests/campaign-dates-kit.ts` ; `apps/web/e2e/support/campaign-calendar.ts` | `civilDateIn` dupliquée : une seule source dans `@influx/test-kit` |
| L3CS-4 | plus tard | `0310:66` | EC-L3C-05-3 (`content_hash` conservé à l'effacement) tranché au Lot 6 avec `expert-conformite-rgpd` |
| L3CS-5 | plus tard | `0309:350`, `0309:290`, `0308:222`, `stamp_campaign_cycle` | gardes libres pour tout rôle hors `influx_%` (sans effet aujourd'hui) : dispense restreinte au seul rôle de migration nommé |
| L3CS-6 | plus tard | `apps/api/src/domains/leads/connectors/apollo/mapping.ts:103` | si le `PUT` Apollo ajoute les étiquettes, un contact cumule une étiquette `_on_<date>` par publication : sémantique réelle vérifiée avec D33 |
| L3CS-7 | plus tard | `0309:1034` | `resume_campaign` reprend sans condition une pause de la marque : `product-owner` dit si `brand_request` est exigé |
| L3CS-8 | plus tard | `apps/api/src/domains/backoffice/campaign-queue/acts/repository.ts:27` | commentaire périmé (« premier examen » refusé, caduc depuis D84) corrigé |

Report au reliquat de `21` §8 : `cloture.md` point 3.

### Attestation
Le contrôle I-4 (`node packages/test-kit/scripts/check-security-review.ts f6e1bc4 HEAD`, relu le
2026-11-17) signale sept commits : ligne 02 (`0307`), 03 (`0308`), 04 (`0309`), 05 (`0310`), X1
(`0311`), X2 (`0312`), X4 (`0313`) ; SHA complets, dans cet ordre :

```text
19576dc447496654af06e7b2179827f8490d3a3c 7ea27bb0ae060925925ccc32a98561d3aa8ca97f
7d834a0134891c8b44b1225fb3b5bb77015d1682 fa9fad5e341726b317deb5a4886388bc466a0b27
45532e42b5a3275ff1e9c338183935d2c67b6d7d e36cf82ff4d69b226778b25e5fb82f945ac5aa13
d868f358e0d2b21cf9b2ea921b55d0098ba63406
```

Non signalés, relus sur leur seule surface de sécurité : 06 (`58981d97`), 07 (`f7cd3fd0`), 10
(`88b4227f`), X5 (`9e4cb622`). **Portée** : `0307` à `0313` par leur état final au catalogue local.
**Hors portée** : écrans 08 à 10 et X3, tests et planchers, `staging`, sémantique réelle d'Apollo,
relecture ligne à ligne des corps de `0307` à `0310`. Le commit d'attestation est préparé par
l'orchestrateur avec la ligne C et montré au fondateur avant commit ; fix-6 et fix-7 ne touchent
aucun préfixe surveillé, le contrôle se relance à la clôture sur toute la plage.
