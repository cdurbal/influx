# Jalon L3C — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts` ou `apps/web/e2e/case-floors.ts`, jamais baissé.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3C-T1 | base, e2e | tests de campagnes existants | dates dérivées du jour ; mêmes cas, mêmes attendus | inchangé | 01 |
| L3C-T2 | base | `campaigns-review-queue.test.ts` | entrée à la soumission (1 j ; 2 j sensible), une seule ouverte ; RG15 (CA10, campagnes nommées) ; RG95 (CA62, aucun refus) ; verrou (CA58 : titulaire nommé, expiration 30 min, levée admin) ; conflit d'intérêts ; garde L3BS-2 | 22 | 02 |
| L3C-T3 | base | `campaigns-publication.test.ts` | TM5.1, CA5 (aucune autre écriture de `published`) ; instantané = vue créateur, version, empreinte ; TM5.6 ; responsable exigé ; CA48 ; marque non publiée, compte inactif ; CA56, CA57 (même personne refusée, admin compris) ; CA59 ; jeton périmé ; `campaign.published` et événement de leads dans la transaction | 25 | 03 |
| L3C-T4 | base | `campaigns-lifecycle.test.ts` | RG8, CA8 ; RG9, CA9 (irréversible) ; pause et clôture d'agent ; clôture système à fin + N j, pas avant, acteur système ; RG1, CA60, CA61 (ancienne et nouvelle valeur, motif) ; correction refusée hors des états de `modele.md` | 20 | 04 |
| L3C-T5 | base | `t8-privacy-execution.test.ts` ; `leads-campaign-reads.test.ts` | instantanés et entrées dans l'export et l'effacement ; décisions d'agent au journal d'activité sans agent nommé (L3BS-5) ; lectures `leads.*` sans texte, tranche, budget ni note | +6 ; 6 | 05 |
| L3C-T6 | intégration | `campaign-leads.test.ts`, `campaign-decision-email.test.ts`, test de `periodic.ts` | RG104 (codes, dates, compteurs), RG105, CA70 sur la charge brute envoyée, CA71 (`skipped`, hors compteur d'échecs) ; un e-mail par décision, FR et EN, sans lien ni montant ; tâche réclamée une fois par période | 15 | 06 |
| L3C-T7 | intégration | `campaign-review-route.test.ts`, `t14-campaign-review-route.test.ts` | file, décisions, fiche (lecture journalisée), correction, création ; membre refusé ; T14.1 à T14.4 | 15 ; 8 | 07 |
| L3C-T8 | intégration | `campaigns-route.test.ts`, `t14-campaigns-route.test.ts` | pause, reprise, clôture ; état interdit 409 ; autre marque = inconnu | +6 ; +3 | 10 |
| L3C-E1 | e2e | `campaign-review.spec.ts` | prise, « déjà prise en charge par … », publication, deux temps en secteur sensible, refus avec motif ; axe FR et EN 1 440 | 4 | 08 |
| L3C-E2 | e2e | `campaign-record.spec.ts` | correction motivée, brouillon créé pour une marque | 2 | 09 |
| L3C-E3 | e2e | `brand-campaign-states.spec.ts` | six états écrits (CA74), motif de refus (CA59), pause, reprise, clôture confirmée ; axe FR 375, EN 1 440 | 3 | 10 |

**Budget e2e : 18 s** (08 ≤ 8 s, 09 ≤ 5 s, 10 ≤ 5 s), médiane de trois, états préparés par l'API,
specs neuves (`brand-campaign.spec.ts` reste à 24,5 s, L3BT-5) ; mesure dans `run.md` à chaque ligne.
Éclats e2e CI < 7 min 30 (4 min 01 au plus à L3B) ; quatrième éclat : arbitrage `integrateur` avant
L3F (plan l. 58-60). **Base** : éclat le plus long + contrôle ≤ 8 min.

## Critère de fin
- [ ] Sur `staging`, une campagne soumise est prise en charge, publiée (instantané v1, responsable
      nommé), mise en pause, reprise, clôturée ; une campagne « alcool » n'est publiée que par une
      seconde personne — preuve : ligne F de `run.md` (états, rangs `campaign.*` du registre).
- [ ] Clôture automatique à la fin de période + 30 j par le seul worker — preuve : L3C-T4, L3C-T6.
- [ ] Brevo et Apollo sans texte, tranche, budget ni note (CA70) ; sans consentement ignoré (CA71)
      — preuve : L3C-T6 ; `staging` : ligne `leads.outbox_events` de la recette, aucun texte en `ops`.
- [ ] `0307` à `0310` sur `staging` — preuve : run CI, « Migrate staging » vert.
- [ ] TM5.1, TM5.6 (base), T2, T14, T16 verts — preuve : L3C-T2 à T8, suite base (ligne C).
- [ ] L3BT-9, L3BS-2, L3BS-5 soldés — preuve : SHA des lignes 01, 02, 05 ; `21` §8.
- [ ] e2e ajoutés ≤ 18 s, éclats CI < 7 min 30 — preuve : `run.md` § Mesures de clôture.
- [ ] `pnpm check` puis `pnpm test:e2e` verts — preuve : ligne C.
- [ ] Revue soldée et attestée (`security-reviewed:`) — preuve : commit d'attestation, contrôle I-4 vert.

## Écarts, décisions ouvertes, risques
- **EC-L3C-1** : `04` §11 l. 6240-6245 (`0307` publication, `0308` à `0310` recherche, `0311`
  réglages) : L3C prend `0307` à `0310` et les réglages des campagnes (RG6, RG9, RG15) ; la recherche
  est décalée à `0311` et suivants ; amendé à la clôture.
- **EC-L3C-2** : plan l. 33 « clôture à date limite par le worker » : RG9 fait foi (fin de période
  + 30 j, paramètre) ; la date limite ne ferme que les candidatures (CA49, Lot 4), sans écriture.
- **EC-L3C-3** : plan l. 33 « `campaign_price_bands` » : table non créée tant que D78 tient
  (`archives/jalons/l3b/modele.md` §1).
- **EC-L3C-4** : RG85 (« un admin, ou un agent approuvé par un second rôle ») et plan (« deux
  agents ») : lecture la plus sûre, deux personnes distinctes toujours, admin compris (`17b` §3.8).
- **EC-L3C-5** : CA63 : responsable exigé à la publication (`17b` l. 1273) ; l'alerte d'une campagne
  publiée sans responsable suit le tableau de bord (Lot 6bis).
- **EC-L3C-6** : RG11 : la publication refuse une marque non publiée ou un compte non `active`
  (`17b` l. 1290) ; dépublication à la suspension avec la porte du Lot 5 (L3AS-4).
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
*(rempli par `/jalon-run` : `L3CT-n`, `L3CS-n`, une ligne chacun)*
