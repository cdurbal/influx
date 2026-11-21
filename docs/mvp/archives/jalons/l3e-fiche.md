# Jalon L3E — L'API de recherche anonymisée des créateurs
> Source : `archives/jalons/lot3-plan.md` l. 35 (validé le 2026-11-13) · 2026-11-19 · Statut : validé par le fondateur le 2026-11-19 (« oui aux 3 questions » : Q1 à Q3 de l'annexe comme recommandé) · Annexe : `l3e/annexe.md`

## Objectif et périmètre
Une marque au profil publié interroge l'API de recherche de créateurs en vue anonymisée (`10` §A à
§D, §F, §G, §I, §J) : facettes du socle au pilote (7, F12 suspendue, D78), filtres et exclusions en SQL
avant tout comptage, k-anonymat, nombre en tranche, pagination plafonnée, tri explicable à huit paliers,
quota froid, raisons « Proposé car », débit par compte et par adresse, journal (recherches, impressions,
raisons). Réglages, versions de facettes et compteurs de masse critique en table ; interrupteur D38
**fermé** par défaut. Blocage entre parties : table et exclusion des deux recherches, sans geste (Lot 4).
AL21 (I-9). En tête, la dette L3DS-1 puis L3AS-1, L3AS-2, L3AT-5.
**Hors périmètre :** écran M4, ouverture de profil, portfolio servi à la marque, sélections et demande de
sélection (L3F) ; vue identifiée, file 9, réglages par écran, calcul quotidien D38 et AL22 (L3G) ;
affinage (CA45) et aspiration (CA46) (L3F) ; mise en relation, « déjà en relation », geste de blocage
(Lot 4) ; purge à 12 mois (Lot 6, avec L3DS-2) ; tarif, devise, net (D78, D48). **Aucun e2e.**

## Invariants
1. RG79, `03` P5, C(11) : `influx_advertiser` n'a aucun droit sur la couche I (`creator_identities`,
   `creator_social_accounts`, audience exacte, historique), ni sur `creator_refused_sectors` ni
   `matching.party_blocks` ; toute exception T1-R est un couple (objet, relation créateur) déclaré dans
   `ADVERTISER_EXCEPTIONS`, aucune sur la couche I (L3AS-2).
2. RG48, CA1, CA3, CA65 : la charge brute d'une réponse ne porte aucun champ de RG48 (pseudo, `@`, URL,
   chiffre ou pourcentage exact, complétude, état, secteur refusé, identifiant de compte, `public_ref`),
   pas même vide ; contrat zod strict ; la carte sort de la seule projection publique (`public-projection.ts`).
3. D48, D78 : aucune tranche tarifaire, devise, tri par tarif ni montant ; F12 fermée en table.
4. Exclusions E1 à E6 en SQL avant comptage et pagination (RG26, RG27) : `published`, `is_searchable`,
   compte `active` (L2GS-8, L3AS-4), majorité, blocage symétrique, secteur de la marque refusé ;
   silencieuses : hors du nombre, motif ni servi ni journalisé (RG29 à RG31).
5. k-anonymat (RG57, RG58, CA34, CA35) : seuil en table compté après exclusions ; dessous, réponse
   identique pour 0 et 4, sans compteur ; dessus, nombre en tranche (RG59) ; élargissements tirés d'un
   ordre statique, jamais d'une requête (RG60, CA37).
6. RG63, CA41, CA42 : taille de page et nombre de pages lus en table ; aucun paramètre de taille du
   client ; page au-delà refusée ; tentative journalisée.
7. D11, RG35 à RG46 : paliers déterministes, aucun score calculé, stocké ni servi ; même ordre le même
   jour UTC pour deux comptes, seul le palier 8 change le lendemain ; quota froid en table, jamais un
   résultat fabriqué ; tri par défaut et trois alternatifs au pilote.
8. RG41, RG42 : 2 à 4 raisons par carte, codes et tranches seuls (`reason_params` sans nombre), aucun
   libellé FR ni EN en base ni dans l'API ; chaque raison vérifiable sur la carte.
9. RG66, CA47, CA48 : la transaction qui sert écrit la recherche (tri, version des facettes, filtres,
   nombre, page, blocage k) et une impression par profil servi avec son rang ; écriture refusée, rien
   servi ; journal en ajout seul.
10. RG63, RG64, T15.2 à T15.5 : débit du compte en base (30/h, 200/j, en table), de l'adresse en mémoire
    avant la session ; 429 `rate_limited` et `Retry-After` ; refus journalisé avec le compte, sans
    croissance sans borne (leçon L3DS-1).
11. D38, RG2, RG3, CA59, CA62 : `is_open_to_advertisers` faux par défaut, fermé = aucune liste ; seul
    `influx_admin` écrit les réglages, par une fonction qui écrit `search.settings_changed` ; toute
    modification de facette insère une version.
12. RG8, CA64 : aucune notification au créateur, aucun `leads.outbox_events`, rien vers Brevo ni Apollo.
13. RG65, CA49 : aucun identifiant séquentiel ni de compte servi ; carte référencée par l'alias ou un
    identifiant opaque (`l3e/modele.md`).
14. T14 : rôle autre que marque, route inconnue ; marque non publiée ou suspendue, réponse de RG1 sans
    liste ; campagne d'origine d'une autre marque, même réponse qu'une inconnue.
15. `03` P7 : porte `SECURITY DEFINER`, `search_path = ''`, `REVOKE … FROM PUBLIC`, `EXECUTE` nominatif,
    aucun `execute` dynamique, propriétaire propre (jamais `influx_creator_profile_definer`, L2GS-5) ;
    commit touchant `audit.*`, une politique ou un `GRANT` signalé I-4.
16. Aucun plancher baissé ; tout fichier de test neuf déclaré dans `db-tests/shards.ts` et `case-floors.ts`.

## Lectures
Commun : cette fiche ; `l3e/modele.md` dès A ; `archives/jalons/l3d/modele.md` §1, §5, §6 (patron de
porte). Chemins de `docs/mvp/` abrégés ; `0314` = `supabase/migrations/0314_search_open_campaigns.sql`.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01 | `21` l. 151 ; `archives/jalons/l3d/annexe.md` l. 114-124 ; `0314` l. 211-257, 441-456, 493-572, 738-746, 828-836 |
| 02 | `21` l. 219 ; `archives/jalons/l3a/annexe.md` l. 87-88, 94 ; `profiles-creator-identity.test.ts` l. 44-66, 194-400 ; `04` l. 6312-6321 |
| A | `10` l. 152-494, 497-551, 588-816, 969-1225, 1309-1325 ; `04` l. 2119-2237, 3096-3140, 5480-5492, 6040-6056, 6286-6291 ; `03` l. 271-293, 316-342, 832-1027, 1788 ; `18` l. 286-332, 745-758, 1019-1028, 1564-1573 ; `15` l. 437, 570-572 ; `17` l. 876-980 |
| 03 | `04` l. 2119-2237 ; `0103` (patron des réglages) ; `0302`, `0303` (codes et `export_class`) |
| 04 | `04` l. 3096-3140, 6049-6050 ; `0314` l. 574-621 |
| 05 | `04` l. 5876-6001 ; `0314` l. 71-105, 1013 et suivantes |
| 06 | `10` l. 347-398, 588-683 ; `0314` l. 114-147, 458-572, 704-878 ; `0216`, `0217` l. 372-390, `0301` l. 100-120 |
| 07 | `10` l. 399-494 ; `04` l. 2157-2188 |
| 08 | `search/open-campaigns/*.ts` ; `packages/contracts/src/open-campaigns.ts`, `creator-projection.ts` ; `public-projection.ts` ; `platform/member-rate.ts` ; `server.ts` l. 283, 615 |
| 09 | `t1-anonymisation.test.ts` ; `21` l. 206-207 ; `18` l. 286-332 |
| 10 | `backoffice/alerts.ts`, `actions-alerts-routes.ts`, `alerts/repository.ts` ; `0130` l. 97-200 ; `10` l. 662-673 |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `fix(db): 0315 the creator's read bucket stays bounded under refusals` | Dette L3DS-1 : index partiel hors `rate_limited`, une ligne `rate_limited` par compte et fenêtre au plus. |
| 02 | `test(db): T1-R follows indirect reads and triggers, exceptions by couple` | Dette L3AS-1, L3AS-2, L3AT-5 avant la première exception. |
| A | arbitrage `architecte` (grilles `expert-database`, `expert-matching`) | `l3e/modele.md` : porte, droits, carte, filtres, k, tri, raisons, débit, journal, réglages, routes, AL21. |
| 03 | `feat(db): 0316 search journal, settings and facet versions` | Journal, impressions, raisons, sélections, réglages, facettes et versions, compteurs ; écriture `influx_admin`. |
| 04 | `feat(db): 0317 party blocks, excluded from both searches` | `block_reasons`, `party_blocks`, sans geste membre ; `visible_campaigns()` les exclut. |
| 05 | `feat(db): 0318 searches and blocks in the export and the erasure` | `privacy.*` recréées : recherches, sélections, blocages posés par le membre. |
| 06 | `feat(db): 0319 the anonymous creator search door` | Porte : filtres, exclusions, k, tranche, pages, débit, journal ; exception T1-R par couple. |
| 07 | `feat(db): 0320 the explainable order, cold quota and reasons` | Paliers 1 à 8, tris du pilote, quota froid, raisons écrites à l'impression. |
| 08 | `feat(api): the brand's anonymous creator search route` | Contrat strict, route marque, débit par adresse, T14, T15.2, TM12.2 à TM12.4. |
| 09 | `test: T1 replayed on the creator search, L2DT-5 and L2DT-6` | Balayage avec un créateur servi, contre-test, marqueurs exacts, erreurs, routeur sans session. |
| 10 | `feat(backoffice): AL21, abnormal volume of creator profiles served (I-9)` | Alerte d'état tirée du journal, seuil en table. |

Puis R (revue groupée), C (clôture). Aucune ligne U ni F (questions Q1 à Q3 de l'annexe).
