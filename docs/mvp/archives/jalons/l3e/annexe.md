# Jalon L3E — annexe

## Tests
Identifiant dans le titre du `describe` ou du cas ; plancher = nombre de cas livrés, inscrit au
commit dans `apps/api/db-tests/case-floors.ts`, jamais baissé ; fichier neuf déclaré dans `shards.ts`.
| Id | Niveau | Fichier | Prouve | Plancher mini | Ligne |
|---|---|---|---|---|---|
| L3E-T1 | base | `t15-campaign-feed-rate.test.ts` | L3DS-1 : refus répétés, au plus une ligne `rate_limited` par compte et fenêtre ; seau et `Retry-After` inchangés ; comptage par l'index partiel | +3 | 01 |
| L3E-T2 | base | `profiles-creator-identity.test.ts` | L3AS-1 : lecture indirecte (plpgsql, SQL non atomique, vue, assistant non nommé `creator_*`), déclencheur `SECURITY DEFINER` d'une table écrite par l'annonceur : rouges (mutations annulées) ; L3AS-2 : exception par couple, refusée sur la couche I ; L3AT-5 : `search_path = ''` | +5 | 02 |
| L3E-T3 | base | `search-journal-settings.test.ts` | T2 des objets neufs ; ajout seul ; `reason_params` sans nombre ; clés fermées ; écriture `influx_admin` seule, `search.settings_changed` chaîné ; facette modifiée = version ; interrupteur faux ; socle 7 ouvert, F12 fermée | 12 | 03 |
| L3E-T4 | base | `party-blocks.test.ts` | un blocage actif par paire ; levée conservée ; aucun droit membre (42501) ; `visible_campaigns()` exclut dans les deux sens ; T2 | 8 | 04 |
| L3E-T5 | base | `t8-privacy-execution.test.ts` (ou fichier neuf) | export : recherches et sélections de la marque, blocages posés par le membre, jamais ceux posés contre lui ni leur motif ; effacement ; liste nominative de L3A-T5 | +6 | 05 |
| L3E-T6 | base | `creator-search-door.test.ts` | TM12.1, CA34, CA35 ; CA9, CA17 ; E1 à E6 (CA18 à CA21, L2GS-8) silencieux et hors du nombre ; CA13 ; CA36 ; TM12.2, CA41, CA42 ; TM12.4, CA47, CA48 ; T15.2 en base (31e/h, 201e/j) ; CA59 ; RG1 ; campagne d'une autre marque ; CA64 ; T1-R par couple | 26 | 06 |
| L3E-T7 | base | `creator-search-order.test.ts` | CA23 à CA33 ; CA4 (72 % : tranche, jamais 72) ; CA27, CA28 ; aucun score (D11) | 14 | 07 |
| L3E-T8 | intégration | `creator-search-route.test.ts`, `t14-creator-search-route.test.ts`, `t15-creator-search-rate.test.ts` | CA1 (clés exactes, RG48 absentes même nulles), CA65 ; `no-store` ; 400 page 6 ; fermée ; RG1 ; T14.1, T14.3 ; T15.2 à T15.5 ; TM12.3 (aucune route d'export, aucun paramètre de taille) | 12 ; 4 ; 5 | 08 |
| L3E-T9 | intégration | `t1-anonymisation.test.ts` | T1.1, T1.2 avec un créateur servi ; contre-test (alias, tranches) ; 47 312, 72, publications et commentaires exacts, ville (L2DT-5) ; T1.4 sur 400, 429, fermée ; balayage sans session (L2DT-6) | +6 | 09 |
| L3E-T10 | intégration | `backoffice-alerts-route.test.ts` (ou celui d'AL24) | AL21 levée au-delà du seuil de profils distincts servis sur 24 h et à 80 % d'un plafond (RG68, CA44), retombée ; destinataires `admin` | 4 | 10 |

**Aucun e2e.** **Base** : ≈ + 60 à 90 s ; éclat le plus long + contrôle ≤ 8 min ; rééquilibrer
`shards.ts` si un éclat dépasse 4 min 30. **Base partagée** : les profils publiés d'autres fichiers et
des runs antérieurs faussent un décompte ; chaque fichier isole ses créateurs (pays d'audience et
thématique propres au fichier) ou balaie les siens (patron `stale-fixtures.ts`).

## Critère de fin
- [x] Interrupteur ouvert, une marque publiée reçoit une page anonyme triée, raisons sans chiffre exact
      (CA3, CA4) — preuve : CI 44595411008 verte ; L3E-T6 à T8 (lignes 06 à 08 de `run.md`).
- [x] 4 résultats : réponse identique à 0, sans compteur (TM12.1) — preuve : CI 44595411008 ; L3E-T6 (ligne 06).
- [x] Page 6 refusée, taille non modifiable (TM12.2) ; aucun export (TM12.3) — preuve : CI 44595411008 ; L3E-T6, T8 (lignes 06, 08).
- [x] 31e recherche dans l'heure : 429 et `Retry-After`, refus journalisé et borné (T15.2, T15.5) — preuve : CI 44595411008 ; L3E-T6, T8 (lignes 06, 08).
- [x] Chaque recherche journalisée avec tri, version, filtres, nombre, page, blocage, impressions et
      raisons (TM12.4) — preuve : CI 44595411008 ; L3E-T6, T7 (lignes 06, 07).
- [x] T1 rejoué vert avec contre-test ; T1-R avec l'exception par couple — preuve : CI 44595411008 ; L3E-T2, T9 (lignes 02, 09).
- [x] I-9 : AL21 levée au-delà du seuil — preuve : CI 44595411008 ; L3E-T10 (ligne 10, `0321`).
- [x] Reliquat soldé : L3DS-1, L2GS-8 (volet recherche), L3AS-1, L3AS-2, L3AT-5, L2DT-5, L2DT-6, T15.2 — preuve : lignes 01, 02, 06, 08, 09 de `run.md` (`e301c63`, `074cd9a`, `1350127`, `825bfbe`, `5192c98`) ; `21` §8.
- [x] `0315` à `0320` (et la migration de 10, s'il y en a une) sur `staging` ; l'interrupteur y est
      faux — preuve : « Migrate staging » vert (run 44595411008) ; lecture SQL de `staging` du 2026-11-19 : `0315` à `0321` appliquées, `is_open_to_advertisers` faux (`run.md` § Mesures de clôture).
- [x] T2, T4, TM11 verts ; job base ≤ 8 min ; `pnpm check` puis `pnpm test:e2e` verts — preuve : CI 44595411008 (T2, T4, TM11 verts ; éclats base 4:47 et 4:35 + fusion 14 s, limite 8:00) ; `pnpm check` local vert (EXIT 0, ~19 min) ; `pnpm test:e2e` local vert (`run.md` § Mesures de clôture).

## Écarts, décisions ouvertes, risques
- **EC-L3E-1** : `0315` pris par L3DS-1 ; la recherche passe à `0316` et suivants, journal et réglages
  dans une migration (`04` l. 6289-6291 amendé par la ligne 03).
- **EC-L3E-2** : CA4 et l'exemple de RG41 (« plus de 70 % ») ne se tirent pas des tranches de F6
  (`ge_80`, `50_80`, `lt_50`, `0216` l. 133) sans lire le chiffre exact (RG7, RG81) : la raison sert la
  tranche de F6, jamais 72 ; `10` CA4 et RG41 amendés par A ; `product-owner` à la revue (Q2).
- **EC-L3E-3** : alertes RG68 : AL21 au L3E (profils distincts servis, 80 % d'un plafond) ; affinage
  (CA45), aspiration (CA46) au L3F ; AL22 au L3G (Q3).
- **Hypothèses `staging`** (plan, préalables) : k = 5 ; 12 × 5 ; 30/h, 200/j ; quota froid 2 sur 12 ;
  seuil d'AL21 proposé par A ; interrupteur fermé jusqu'à D38 et `10` Q1 (veto RGPD, Lot 6).
- Sélections : tables et RLS au L3E, aucune route (L3F). Vue identifiée (L3G) : un seul moteur (RG4),
  A le prépare sans livrer la porte agent.
- Risques : charge brute (RG80, première vérification de la revue) ; duplication de la projection
  (une seule source, invariant 2) ; temps de la suite base.

### Questions au fondateur (fiche)
1. L3E sans recette `staging` (API seule, interrupteur fermé) : preuve par la CI et une lecture SQL de
   `staging` ? *Recommandé : oui.*
2. EC-L3E-2 : l'explication cite la tranche de F6 (« 50 à 80 % d'audience en France »), jamais « plus
   de 70 % » ? *Recommandé : oui.*
3. EC-L3E-3 : AL21 au L3E, affinage et aspiration au L3F, AL22 au L3G ? *Recommandé : oui.*

**Réponses du fondateur (2026-11-19)** : « oui aux 3 questions » : Q1 à Q3 retenues comme recommandé
(pas de ligne F ; EC-L3E-2 et EC-L3E-3 validés).

## Revue
Revue du 2026-11-19, plage `9f8971d..5c98bb8` : `testeur` 0 bloquant, 0 jalon, 6 constats ; `expert-cybersecurite` 0 bloquant, 0 jalon, 8 constats. CI du dernier push verte (run 44595411008).

**`testeur`**
- **L3ET-1** (avant production) : quota froid, branche « froids déjà en page 1 comptent dans les `slots` » non exercée (`creator-search-order.test.ts:768-818`, `0320:320-323`) ; ajouter 1 froid naturel + 2 slots, et 2 froids naturels.
- **L3ET-2** (avant production) : filtre de sortie non testé en négatif (`creator-search.ts:30-53`, `public-projection.ts`) ; test unitaire avec porte doublée, attendu 500 sans marqueur.
- **L3ET-3** (avant production) : concurrence du seau (`0319:543`, verrou consultatif) non testée à deux connexions réelles, ou « accepté » au reliquat.
- **L3ET-4** (plus tard) : cas `count = page × taille` manquant (`creator-search-door.test.ts:1408`, `0319:993-995`).
- **L3ET-5** (plus tard) : annexe L3E-T1 cite le mauvais fichier (`campaigns-creator-feed.test.ts`, 32 à 35) ; EXPLAIN recopié à la main (`:1545`) ; reconnaissance de politique par `like` (`t9:~1107`).
- **L3ET-6** (plus tard) : journal commité hors nettoyage dans les tests de route, T15 et T1 (AL21 le relève) ; rendu AL21 du backoffice sans test ; pays GL, IS, IE réservés par convention seulement.

**`expert-cybersecurite`**
- **L3ES-1** (avant production, priorité 1) : `0319:752-762` et `0320:554-559`, campagne d'origine en brouillon admise, secteur changeable : sondage des secteurs refusés (RG31, art. 9) ; n'admettre qu'une campagne sortie du brouillon, sinon 404. Arbitrage `product-owner`, avis `expert-conformite-rgpd` (0,5 j).
- **L3ES-2** (avant production) : `0316:822-959`, un seul admin en aal2 ouvre l'interrupteur et relève les plafonds ; exiger `confirm_dual_control()` dans les deux écrivains (D84 Q3) (1 j).
- **L3ES-3** (avant production) : `0321:60`, seuils AL21 `{150, 8000}` hypothétiques, à fixer par le fondateur ; agrégation multi-comptes (CA46) au L3F.
- **L3ES-4** (avant production) : `creator-search-route.test.ts:197-198`, aucune carte avec visuels servie dans les balayages ; servir visuel approuvé, en attente, légende révisée, vérifier `id` opaque, ni `object_key` ni légende non approuvée.
- **L3ES-5** (plus tard) : `t9-evidence-unreachable.test.ts:1092-1105`, épingler toutes les politiques de `influx_creator_search_definer`.
- **L3ES-6** (plus tard) : `0321:77-88`, propriétaire distinct en lecture seule pour AL21 et L3G.
- **L3ES-7** (plus tard) : `actions-alerts-routes.ts:145`, conditionner à `isAdmin && visible("AL21")`.
- **L3ES-8** (plus tard, risque accepté) : sous 60 résultats le nombre exact se déduit des cartes ; blocage devinable entre deux comptes ; CA45 et CA46 au L3F.

**Points relus et acceptés par `expert-cybersecurite`** : T1-R (EC-L3E-A-1), exception T9.6 L2G (six colonnes, jamais `object_key`), `influx_search_admin_definer` (réserves L3ES-2 et -6), EC-L3E-A-1, -6, -7.

**Attestation I-4** (lignes 01, 03 à 07, 10) :
`security-reviewed: 2026-11-19 covers e301c638fc9d20ced0593268fe2daa173b5e1eaa b8f82f5cfa130b251e5fa4c2cec42f139644bf5a 6926e0e919124505da7604a6f6eef3aceb216958 b917cfc26ebe8238fba230f8763cfb01c983f7ed 13501271fcbeaf47410eca2d8052a9596d1b27c4 53f3ca668cfc62a7a7a391ef8ccd897890081e53 5c98bb85a25daffafb39d97cbff39a6ea416a0a2`

**Restes pour la clôture** (`testeur`) : lecture SQL de `staging` (0315 à 0321, interrupteur fermé), « Migrate staging » du run 44595411008, `pnpm check` et `pnpm test:e2e`.
