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
Revue de fin de jalon du 2026-11-21, plage `6c05803..0fc5eef` (CI verte sur `0fc5eef`) : `testeur` (L3GT) et
`expert-cybersecurite` (L3GS). **0 bloquant.** Sur `main` et `staging` rien ne bloque ; `production` : autorisée
sous conditions (L3GS-2, L3GS-3, attestation I-4, D24/D33/D34/D63).

### À corriger dans le jalon (→ `fix-2`, `fix-3`, `cloture.md`)
- **L3GS-1** (`expert-cybersecurite`, `fix-2`) : D85 (1) appliqué en partie. `0327` met `lock_timeout` 1 s sur sept
  portes à verrou par compte, mais la traduction 55P03 → 429 `rate_limited` `Retry-After: 1` n'existe que dans
  `search/shortlists/routes.ts:91` et `search/selection-requests/routes.ts:70`. Elle manque dans `classifyError`
  (`platform/errors.ts:126`) et dans `creator-search/routes.ts:70-87`, `creator-search-profile/routes.ts:66-81`,
  `open-campaigns/routes.ts:59-70`. Scénario : deux recherches simultanées d'une marque ou deux ouvertures de profil,
  la seconde attend plus de 1 s, 500 `internal_error`, `ops.recordServerError` appelé (D60) ; aucune fuite, mais un
  membre peut provoquer des 500 à volonté. Correctif : dans `classifyError`, traduire une 55P03 portant le message de
  délai de verrou de PostgreSQL en `RetryLaterError("rate_limited", 1)` (les 55P03 `no_live_claim` des files sont
  traduites avant) ; un test d'intégration par route avec une seconde connexion qui tient le verrou. 1 à 2 h.
- **L3GT-2** (`testeur`, `fix-2`) : la même traduction HTTP n'a aucun test de route (le volet SQL l'est,
  `search-shortlists.test.ts` l. 1303). Correctif : deux cas dans `search-shortlists-route.test.ts` et
  `selection-request-route.test.ts` (gabarit de l. 1303), en plus des trois routes de L3GS-1.
- **L3GT-1** (`testeur`, `fix-3`) : `apps/web/e2e/backoffice-identified-search.spec.ts` l. 218-220 insère le motif
  `lg_search_block` dans `matching.block_reasons`, l'`afterAll` (l. 42-63) supprime `party_blocks` mais pas ce
  motif ; L3E-T4 (`matching-party-blocks.test.ts` l. 787-808) lit toute la table et attend `["dataset_probe"]` : il
  échoue sur toute base locale où l'e2e est passé (la CI, à piles séparées, ne le voit pas). Même fuite que
  `lg_nine_block`, déjà corrigée. Correctif : `delete from matching.block_reasons where code = 'lg_search_block'`
  après la suppression de `party_blocks`.
- **L3GT-3** (`testeur`, `cloture.md` point 10, pas de `fix`) : preuve des 30 s. La note de F dit « 1re passe < 15 s
  ×3 ; durées de la rejouée et file 9 non données » ; 2 campagnes sur 3 ne rendaient aucun créateur à la première
  passe, et la rejouée porte sur des campagnes de marques fictives semées (option A). Ne pas écrire « trois durées » :
  citer mot pour mot « je valide la recette » (2026-11-21), demander au fondateur les trois durées de la rejouée ou
  inscrire l'écart en reliquat « avant production ».

### Avant production (une ligne chacun)
- **L3GS-2** `POST /v1/bo/creator-search` sans débit (`platform/member-rate.ts:41-43`, seul le préremplissage y est), et AL21 ne
  compte que la vue marque (`0328` l. 48-50) : une session agent volée peut aspirer la base cherchable en
  découpant les filtres ; seul le journal nominatif en garde la trace. → 60/min par adresse et par compte, et
  seuils d'AL21 des comptes internes (Lot 5) avant l'ouverture.
- **L3GS-3** nom légal, ville, `@` et pseudonyme ne passent pas par `plainText` (`identified-search-view.ts:756`,
  `771-781`) ; les contraintes de `0217` laissent passer les contrôles bidi U+202A–202E et U+2066–2069 (pas de XSS,
  React échappe). → `plainText` sur ces champs, refus des bidi à l'écriture (contrats et CHECK), tous écrans backoffice.
- **L3GT-4** prise de la file 9 non prouvée à deux connexions committées (`team-selection-queue.test.ts` l. 384
  séquentiel) ; conception saine (`FOR UPDATE` puis `UPDATE` conditionnel, `0330` l. 297-336). → un cas dans
  `search-caps-concurrency.test.ts` : deux `open_team_selection_request` simultanés, un seul `claimed`.
- **L3GT-5** `verification-backoffice.spec.ts` l. 497 et `verification-revocation.spec.ts` l. 146 créent des admins hors du
  fichier sérialisé alors que `onlyAdmin` (`support/backoffice.ts` l. 138-151) désactive les autres ; commentaire
  de `playwright.config.ts` l. 56-60 faux. → déplacer ces parcours dans `backoffice.spec.ts` ou borner `onlyAdmin`.
- **L3GT-6** aucune borne de débit ni alerte sur les recherches identifiées d'un agent (= L3GS-2), à garder pour AL21 du Lot 5.
- **L3GT-7** la liaison TS `computeSupplyCounters` (`maintenance/repository.ts`) n'est exercée contre la base par aucun
  test ; la ligne du jour lue sur `staging` sert de preuve (à garder au `cloture.md`).
- Décisions de spécification (`product-owner`, `cloture.md` points 8 et 9) : règle D85 « masqué non retirable »
  (= L3GS-7), préremplissage plus souple, élargissement guidé par les comptes.

### Plus tard (une ligne chacun)
- **L3GS-4** le filtre des demandes d'une marque tenue n'est qu'en route (`team-selection-queue/repository.ts:131-133`) ;
  la politique `0330:162-165` laisse un agent lire en base toutes les demandes (aal2) ; une demande close d'une
  marque tenue s'ouvre. → exclusion dans la politique, via une aide en lecture seule.
- **L3GS-5** lecture des réglages par un agent : 403 sans trace au registre (`record_refused_action`, pas de code) → Lot 5 (CA63).
- **L3GS-6** `consume_dual_control_for()` accepte les actions de ses deux propriétaires (`0332:345-353`), non exploitable → contrôle de catalogue.
- **L3GS-7** règle D85 : signal d'une liste au plafond avec des places masquées → `product-owner` (`cloture.md` point 8).
- **L3GT-8** liste `DOORS` de `tm12-identified-view.test.ts` en dur (`toHaveLength(13)`, l. 261) alors que l'en-tête promet un inventaire.
- **L3GT-9** « L3G-T9 » désigne deux fichiers : renommer `search-settings-reader.test.ts` en « L3G-T8b » (l. 1, 66-67 ; `case-floors.ts` l. 65).
- **L3GT-10** équilibre des éclats base (écart de 12 s au dernier passage, 30 s franchis une fois à `5900fc2`) ; rafraîchir l'en-tête de `shards.ts`.
- **L3GT-11** planchers transférés (2→1, 55→56) : soldé, rien n'a disparu. **L3GT-12** mesure de `0334` : soldée (6,4 → 2,2 s) ; ajouter un cas de base sur la présence de `accounts_owner_agent_any_idx`.
- **L3GT-13** `team-selection-queue.test.ts` l. 645 (AL23) recalcule le prédicat en SQL : circulaire, reformuler ou supprimer.
- **L3GT-14** `plain-text.ts` l. 19-31 laisse U+2028, U+2029, U+200B à U+200D, U+2060, U+FEFF et les balises : épingler par un cas, signaler à `expert-cybersecurite`.
- **L3GT-15** bornes de 900 à 5 000 ms sur le verrou (`creator-profile-door.test.ts` l. 1527-1528, `search-shortlists.test.ts` l. 1338) : marge faible.
- **L3GT-16** processus : une entrée de rail change `backoffice.spec.ts` (palier supérieur de D76 pour toute modification de `bo-nav.ts`).
- **L3GT-17** documents : `annexe.md` annonce « EN 1 280 » (livré FR 1 440 et 1 280, D36) ; `cloture.md`, le critère de fin et `21` §7 l. 133 doivent dire `0327` à `0334`.
- Non couvert, explicite : double consommation concurrente d'une 2V de réglage ; demande de la file 9 d'une marque suspendue ou effacée ; EN du backoffice (D36) ; bascule de minuit UTC du calcul quotidien ; focus (J2) par e2e seulement.

### Attestation I-4 (à commiter à la clôture, une fois `fix-2` livré)
Neuf SHA vérifiés par `expert-cybersecurite` (lignes 01, 04 à 08, 08b, 10, 14) :
`security-reviewed: 2026-11-21 covers 768d4cc5ec52 35c474eed79a 5acb9a79055d 0c48fa23a101 781dd1cff5cb 18c20f74be54 72bfbc87d1cd 1457e28a68c5 2b5cd3252366`
Le correctif de L3GS-1 (`fix-2`, qui touche la gestion d'erreurs de l'API) ajoute son SHA à cette ligne.
`.operator-secrets/` : règle d'exclusion présente (`.gitignore:55`), aucun fichier jamais suivi ; `git check-ignore -v
.operator-secrets/x` à lancer par le fondateur (refusé au sous-agent et à l'orchestrateur) ; effacer le mot de passe et le lien après usage.
