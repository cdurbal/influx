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
- [ ] Interrupteur ouvert, une marque publiée reçoit une page anonyme triée, raisons sans chiffre exact
      (CA3, CA4) — preuve : L3E-T6 à T8 verts en CI.
- [ ] 4 résultats : réponse identique à 0, sans compteur (TM12.1) — preuve : L3E-T6.
- [ ] Page 6 refusée, taille non modifiable (TM12.2) ; aucun export (TM12.3) — preuve : L3E-T6, T8.
- [ ] 31e recherche dans l'heure : 429 et `Retry-After`, refus journalisé et borné (T15.2, T15.5) —
      preuve : L3E-T6, T8.
- [ ] Chaque recherche journalisée avec tri, version, filtres, nombre, page, blocage, impressions et
      raisons (TM12.4) — preuve : L3E-T6, T7.
- [ ] T1 rejoué vert avec contre-test ; T1-R avec l'exception par couple — preuve : L3E-T2, T9.
- [ ] I-9 : AL21 levée au-delà du seuil — preuve : L3E-T10.
- [ ] Reliquat soldé : L3DS-1, L2GS-8 (volet recherche), L3AS-1, L3AS-2, L3AT-5, L2DT-5, L2DT-6, T15.2 —
      preuve : lignes 01, 02, 06, 08, 09 de `run.md`.
- [ ] `0315` à `0320` (et la migration de 10, s'il y en a une) sur `staging` ; l'interrupteur y est
      faux — preuve : « Migrate staging » vert, lecture SQL de `staging` (D70) dans `run.md`.
- [ ] T2, T4, TM11 verts ; job base ≤ 8 min ; `pnpm check` puis `pnpm test:e2e` verts — preuve : CI.

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
*(rempli par `/jalon-run` : L3ET-n, L3ES-n, une ligne chacun)*
