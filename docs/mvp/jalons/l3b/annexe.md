# Jalon L3B — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts` ou `apps/web/e2e/case-floors.ts`, jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3B-T1 | base | `t8-privacy-execution.test.ts` (L3A-T5) | exportés ≥ 130, exclusions nommées exactes, témoin `excluded_third_party` | +1 cas | 01 |
| L3B-T2 | base | `campaigns-core.test.ts` | chaque contrainte de `0303` refusée par son nom, acceptée sans elle (patron `reference-taxonomies`, inventaire) ; 7 types, motifs, éléments demandés | 30 | 02 |
| L3B-T3 | base | `t2-rls-matrix.test.ts`, `campaigns-core.test.ts`, `tm11-drizzle-parity.test.ts` | droits déclarés (T2) ; marque sur ses seules lignes ; créateur : aucun droit sur `campaigns.*` (TM5.6) ; parité Drizzle | +10 | 02 |
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
*(rempli par `/jalon-run` : `L3BT-n`, `L3BS-n`, `L3BU-n`, une ligne chacun)*
