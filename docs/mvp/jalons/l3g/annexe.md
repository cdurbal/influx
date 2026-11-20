# Jalon L3G — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au commit
(`apps/api/db-tests/case-floors.ts`, `apps/web/e2e/case-floors.ts`), jamais baissé ; fichier base neuf
déclaré dans `shards.ts`, dans l'éclat le plus court.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3G-T1 | base | `creator-profile-door.test.ts`, `search-shortlists.test.ts` | L3FS-1 : moteur exécuté alias trouvé ou non ; L3FS-2 : retrait et borne sans oracle d'exclusion (EC-L3F-04-4 inversé) | +4 | 01 |
| L3G-T2 | base | `search-caps-concurrency.test.ts` | L3FT-1 : deux connexions committées, une servie, une refusée (60e ouverture, 5e demande, 10e liste, 25e élément, seau de L3E) | 5 | 02 |
| L3G-T3 | intégration | `search-shortlists-route.test.ts` | L3FS-3 : 429 et `Retry-After` par adresse sur les six écritures, avant la base | +6 | 03 |
| L3G-T4 | base | `creator-identified-search-door.test.ts` | TM12.5 (42501 marque, créateur) ; identités ; états G2 ; blocage sans motif ; G ; compte exact sans k ; interrupteur fermé (CA61) ; plafond de pages ; journal nominatif (CA58) ; ni outbox ni `matching.*` ; T1-R | 20 | 04 |
| L3G-T5 | base | `campaign-brief-prefill.test.ts` | RG73 ; campagne non admise = inconnue ; proposé, retenu, retiré (CA56) ; ni tranche ni budget | 8 | 05 |
| L3G-T6 | base | `team-selection-queue.test.ts` | prise exclusive, relâche, clôture motivée, motif inconnu, AL23, D45, T2 | 12 | 06 |
| L3G-T7 | base | `search-supply-counters.test.ts` | comptes exacts, rejeu du jour, interrupteur intact, seuils → alerte, échec → veille gardée, AL22 | 10 | 07 |
| L3G-T8 | base | `search-settings-dual-control.test.ts` | sans demande, même admin, demande consommée, `aal1`, agent : refus ; pair : écrit et versionne | 8 | 08 |
| L3G-T9 | intégration | `creator-identified-search-route.test.ts`, `campaign-prefill-route.test.ts` | contrat strict, `no-store`, T14.1 à T14.4, membre → 404 | 10 ; 4 | 09 |
| L3G-T10 | intégration | `team-selection-queue-route.test.ts`, `search-settings-route.test.ts` | 409 de prise, alertes listées, réglage en double validation, T14 | 8 ; 6 | 10 |
| L3G-T11 | base + intégration | `tm12-identified-view.test.ts`, `t1-anonymisation.test.ts` | TM12.5 sur chaque porte et route neuve ; T1 des routes membres inchangé ; TM12.3 | 4 ; +4 | 11 |
| L3G-T12 | unitaire | vues de la recherche identifiée, de la file 9, des réglages ; `bo-nav` | états, libellés, marqueur, entrées du rail | ≥ 8 | 12, 13 |
| L3G-E1 | e2e | `e2e/backoffice-identified-search.spec.ts` | marqueur et identités ; brouillon et blocage ; pré-remplissage puis facette retirée ; axe FR 1 440, EN 1 280 | 3, ≤ 9 s | 12 |
| L3G-E2 | e2e | `e2e/backoffice-team-selection.spec.ts` | prise et clôture d'une demande ; réglage proposé puis confirmé par un pair | 2, ≤ 6 s | 13 |

**Budgets.** e2e : ≤ 15 s pour le jalon (`lot3-plan.md` l. 59), mesurés en CI par spec, médiane locale
indicative ; états préparés par SQL de test ou l'API, jamais par l'interface. Base : ≈ + 60 à 90 s ;
chaque éclat ≤ 7 min 30, job ≤ 8 min ; dernier éclat CI à 6:34 (L3F) : un éclat au-delà de 7:15 en CI
arrête le jalon (arbitrage `integrateur` : troisième éclat base). **Base partagée** : chaque fichier isole
ses créateurs (pays d'audience et thématique propres) ou balaie les siens (`stale-fixtures.ts`).

## Critère de fin
- [ ] Vue identifiée : identités, brouillons étiquetés, blocage avec avertissement, compte exact (CA55 ; sélection multiple au Lot 4, Q3) — L3G-T4, T9, E1.
- [ ] Pré-remplissage depuis une campagne, corrections journalisées (CA56) — L3G-T5, E1.
- [ ] Recherches et consultations identifiées journalisées nominativement (CA58) — L3G-T4, T11.
- [ ] TM12.5 en base et en route ; interrupteur fermé sans effet sur la vue identifiée (CA61) — L3G-T4, T11.
- [ ] Compteurs quotidiens, alerte de masse critique sans ouverture (CA60), AL22 — L3G-T7 ; ligne du jour lue sur `staging`.
- [ ] File 9 : prise, clôture motivée, AL23 — L3G-T6, T10, E2.
- [ ] Réglages sous contrôle d'un pair, L3ES-2 soldé — L3G-T8, T10, E2.
- [ ] Reliquat (Q1) : L3FS-1 à -3, L3FT-1 — lignes 01 à 03.
- [ ] `0327` à `0332` sur `staging`, interrupteur faux — « Migrate staging » vert, lecture SQL.
- [ ] D38 tranchée le 2026-11-20 (`18` l. 1574, Q2) — ligne D38 ; reportée dans `decisions*.md` et `CLAUDE.md` §9 à la clôture.
- [ ] 30 s sur trois campagnes de `staging` (`18` l. 1575) — ligne F, trois durées dans `run.md`.
- [ ] T1, T2, T14, TM12 verts ; job base ≤ 8 min ; e2e ≤ 15 s ; `pnpm check` puis `pnpm test:e2e` verts ; revue attestée (I-4).

## Écarts, décisions ouvertes, risques
- **EC-L3G-1** : CA57, RG74 (« Proposer », une mise en relation par destinataire) créent `matching.introductions`
  (`0401`) : Lot 4 (frontière, réponse 1 du 2026-11-13) ; sélection multiple (≤ 20) au Lot 4 avec
  « Proposer », aucune case à cocher au L3G (Q3).
- **EC-L3G-2** : G4 à G7 sans objet avant le Lot 4 (`10` l. 283-286) ; G3, G8 livrées si la donnée existe (A).
- **EC-L3G-3** : l'alerte de CA60 n'a pas de code au catalogue (`15` RG68) : code neuf par A, `15` amendé
  (`chef-de-projet`, `17b` l. 1816).
- **EC-L3G-4** : file 9 sans motifs (`17b` I13) : sous-ensemble de la liste A (`13` RG83) par A, grille
  `product-owner` ; ce que voit la marque après clôture : A (aucun e-mail au Lot 3).
- **EC-L3G-5** : AL21 des comptes internes au Lot 5 (`l3e/modele.md` §10), malgré `17b` l. 886-887.
- **EC-L3G-6** : fermeture par thématique (RG3) absente du moteur (`l3e/modele.md` §3) : sans objet,
  D38 tranche une ouverture globale (Q2).
- **Hypothèses `staging`** : 20 par page en vue identifiée ; AL22 à 20 %. Seuils de masse critique 30 et 5 :
  D38 (Q2), valeurs de départ en table.
- **Risques** : porte identifiée atteignable par un membre (TM12.5) ; identité dans une charge membre (T1) ;
  double validation qui casse les kits de test ouvrant l'interrupteur (L3E, L3F) ; temps de la suite
  base ; mesure des 30 s dépendante des données de `staging` (100 créateurs fictifs publiés, campagnes ?).

### Questions au fondateur (fiche) — réponse du 2026-11-20 : « oui aux 4 questions »
1. **Reliquat L3F en tête** (lignes 01 à 03 : L3FS-1 à -3, L3FT-1, environ 1,5 j) plutôt qu'au Lot 6 ?
   Mêmes portes que la vue identifiée ; le lot se clôt sans dette « avant production » sur la recherche.
   *Recommandé : oui.*
2. **D38** : ouverture globale (pas par thématique) ; seuils de départ 30 profils publiés et 5 par
   thématique principale, en table ; leur atteinte lève une alerte, l'ouverture reste la décision d'un
   admin sous contrôle d'un pair ; interrupteur fermé sur `staging` et en production d'ici là ?
   *Recommandé : oui.*
3. **Sélection multiple** (≤ 20) livrée avec « Proposer à une campagne » au Lot 4, la vue du L3G sans case
   à cocher (aucun bouton sans suite, invariant 12 de L3F) ? *Recommandé : oui.*
4. **Recette** : vous mesurez les 30 s en vue identifiée sur trois campagnes de `staging` ; s'il en manque,
   l'agent sème trois campagnes publiées de marques fictives (rôle de migration, marqueur, sans outbox ni
   Brevo, comme les profils fictifs du 2026-11-14) ? *Recommandé : oui.*

## Revue
