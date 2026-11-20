# Jalon L3F — La marque cherche, ouvre un profil anonyme et construit ses sélections
> Source : `jalons/lot3-plan.md` l. 36 (validé le 2026-11-13) · 2026-11-19 · Statut : validé par le fondateur le 2026-11-19 (« oui aux 2 questions » : Q1 et Q2 de l'annexe comme recommandé) · Annexe : `l3f/annexe.md`

## Objectif et périmètre
Une marque au profil publié utilise M4 (`17` §4.4) sur l'API de L3E : facettes ouvertes du socle (7, F12
suspendue), tri nommé, nombre en tranche, pages explicites, états sous le seuil, fermé (CA59), plafond,
profil non publié. Elle ouvre un profil anonyme (champs de la carte, 3 visuels, région RG15), lit les
visuels relayés par l'API (D82 (7), EC-L2G-16), construit ses sélections privées par alias, rattachables
à une campagne (RG51), et demande une sélection à l'équipe INFLUX (RG61). Alertes d'affinage (CA45) et
d'aspiration (CA46), ouvertures comptées dans AL21. En tête : L3E-DB ; L3ES-1 après A (Q1).
**Hors périmètre :** « Demander une mise en relation », « déjà en relation », conversation (RG53, RG55 :
Lot 4) ; écran et prise en charge de la file 9, AL23, vue identifiée, réglages par écran, AL22, D38
(L3G) ; tarif, devise, tri par tarif (D78) ; troisième action (`10` Q4) ; L3ET-1 à -3, L3ES-2, seuils
de L3ES-3 (reliquat) ; purge à 12 mois (Lot 6).

## Invariants
1. RG48, RG50, CA6 : un profil ouvert porte exactement les clés de la carte (plus 3 visuels et la
   région RG15), sorties de la seule projection (`profiles.creator_layer_a()`, `public-projection.ts`),
   contrat zod strict ; aucun champ de RG48, pas même nul.
2. RG65, CA49, T14.3, T14.4 : profil, visuel, sélection et demande référencés par alias ou identifiant
   opaque ; alias inconnu et alias exclu (E1 à E6) : même code, même corps, sur toute route.
3. D82, E1-7 : aucune URL signée ni publique, aucun hôte Supabase, jeton ni `object_key` dans une
   réponse ; seul un visuel `approved` d'un profil visible est servi (CA50) ; octets relus par `apps/api`.
4. RG79, T1-R : `influx_advertiser` n'a aucun droit sur la couche I, `creator_refused_sectors`,
   `party_blocks`, `shortlists`, `shortlist_items` ni la table des demandes ; tout passe par des portes
   `SECURITY DEFINER` (`03` P7 : `search_path = ''`, `REVOKE … FROM PUBLIC`, `EXECUTE` nominatif,
   aucun `execute` dynamique, jamais `influx_creator_profile_definer`, L2GS-5) ; exception T1-R par
   couple, aucune sur la couche I ; commit touchant `audit.*`, une politique ou un `GRANT` signalé I-4.
5. RG15, CA14, CA15 : région affichée si au moins `region_display_threshold` profils publiés partagent
   (pays, région) ; dessous, pays seul, sans message ni compteur ; jamais filtrable ; ville jamais.
6. D45, RG51, RG8, CA52, CA64 : ajouter à une sélection ou demander une sélection n'envoie rien au
   créateur, n'écrit aucun `leads.outbox_events`, ne crée ni `matching.introductions` ni conversation.
7. RG63, TM12.3 : aucun export, aucun « tout sélectionner », aucune taille de page du client ; sélections
   bornées en table.
8. T15.2, RG63, RG64 : ouverture de profil plafonnée par compte en base (`profileOpensPerDay`) et par
   adresse en mémoire ; 429 `rate_limited` et `Retry-After` ; refus journalisé et borné (leçon L3DS-1).
9. RG66, CA48 : une ouverture depuis une recherche marque `was_opened` de son impression une fois ;
   toute ouverture est journalisée dans la transaction qui sert ; écriture refusée, rien servi.
10. D38, CA59 : interrupteur fermé, aucune carte, aucun profil ni visuel servi par aucune route ; la
    demande de sélection reste possible (RG61, permanente).
11. D48, D78 : aucun montant, tarif, devise ni tri par tarif dans M4, le profil, les sélections, la demande.
12. RG55, CA51 au pilote : la carte et le profil n'offrent que « Ajouter à ma sélection » et « Demander
    une sélection à l'équipe INFLUX » ; aucun bouton dont la suite n'existe pas.
13. RG58, RG60, CA35, CA37 : écran sous le seuil identique pour 0 et 4 ; élargissements tirés de
    `WIDENING_ORDER`, sans requête ; nombre en tranche seul.
14. RG89, CA63, `CLAUDE.md` §4 : FR et EN sans clé visible ; KEO et tokens seuls ; D74 (entrée
    « Créateurs », sous-menu) ; WCAG AA ; 375 d'abord ; aucune logique métier dans les composants.
15. T14 : rôle autre que marque, route inconnue ; sélection, demande ou campagne d'une autre marque :
    réponse de l'inexistant.
16. Aucun plancher baissé ; tout fichier de test neuf déclaré (`db-tests/shards.ts` et `case-floors.ts`,
    ou `e2e/case-floors.ts`).

## Lectures
Commun : cette fiche ; `l3f/modele.md` dès A ; `archives/jalons/l3e/modele.md` §1, §2, §9, §10.
Chemins de `docs/mvp/` abrégés ; `03xx` = `supabase/migrations/03xx_*.sql`.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01 | `21` l. 240 ; `archives/jalons/l3e/run.md` § Mesures ; `apps/api/db-tests/shards.ts` l. 1-16 |
| A | `10` l. 255-262, 499-688, 785-786, 822-855, 994-998, 1030-1034, 1098-1199, 1315-1341 ; `17` l. 132, 876-979, 1223-1232, 1954-2052 ; `decisions-detail.md` l. 825 ; `03` l. 1603-1623 ; `04` l. 2185-2193, 5250-5262 ; `15` l. 300, 570-572 ; `18` l. 324-329, 650-663, 735-753 ; `0316` l. 200-290, 621-645, 790-870 ; `0319` l. 151-257, 694-830 |
| 02 | `archives/jalons/l3e/annexe.md` l. 76 ; `0319` l. 694-830 ; `0320` l. 554-559 |
| 03 | `10` l. 499-555, 628-688 ; `0319` ; `0316` l. 200-290 ; `profiles/creator/portfolio/repository.ts` |
| 04 | `0316` l. 621-645 ; `0318` (sélections) ; `0323` |
| 05 | `10` l. 618-623, 785-786 ; `17` l. 1231 ; `04` l. 5250-5262 ; `0129` l. 262-290 |
| 06 | `10` l. 662-677, 1140-1148 ; `15` l. 570 ; `0321` ; `backoffice/alerts.ts`, `actions-alerts-routes.ts` |
| 07 | `search/creator-search/*.ts` ; `search/open-campaigns/routes.ts` l. 170-225 ; `profiles/brand-logo.ts` ; `platform/storage.ts`, `member-rate.ts` ; contrats `creator-search.ts`, `creator-projection.ts`, `creator-portfolio.ts` l. 210-225 |
| 08 | 07 ; `0324`, `0325` |
| 09 | `t1-anonymisation.test.ts`, `t9-evidence-unreachable.test.ts` ; `18` l. 324-329, 650-663 |
| 10 | `17` l. 876-979 ; `apps/web/src/lib/member-nav.ts` l. 25-73 ; `components/creator-profile/creator-preview-view.ts`, `CreatorPreviewScreen.tsx` ; `components/campaign/CampaignFeedScreen.tsx` |
| 11 | `17` l. 1954-2052, 1223-1232 ; 10 |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `test(db): rebalance the database shards from measured durations` | L3E-DB : `shards.ts` réparti depuis une suite locale complète mesurée. |
| A | arbitrage `architecte` (grilles `expert-database`, `expert-matching`, `product-owner`) | `l3f/modele.md` : L3ES-1, profil, visuels, région, sélections, demande, alertes, routes, écrans. |
| 02 | `fix(db): 0322 only a campaign out of draft anchors a creator search` | L3ES-1 : campagne d'origine hors des états admis = campagne inconnue. |
| 03 | `feat(db): 0323 the anonymous profile door and its portfolio visuals` | Profil par alias (CA6, RG15, CA49), clé d'un visuel approuvé, ouverture journalisée et plafonnée. |
| 04 | `feat(db): 0324 the brand's shortlists through the alias` | Portes des sélections par alias, bornées, sans notification. |
| 05 | `feat(db): 0325 the request for a selection by the INFLUX team` | Table et porte de RG61 (critères, campagne, langue), sans mise en relation ; export, effacement. |
| 06 | `feat(db): 0326 refinement and scraping alerts (CA45, CA46)` | Affinage, aspiration, ouvertures dans AL21 ; seuils en table. |
| 07 | `feat(api): the anonymous profile and its visuals, relayed as JSON` | Routes du profil et du visuel, contrat strict, débit, T14, T15.2. |
| 08 | `feat(api): the brand's shortlists and its request to the INFLUX team` | Routes des sélections et de la demande, contrats stricts, T14. |
| 09 | `test: T1 and T9 replayed on the profile, its visuals and the shortlists` | Balayage avec cartes à visuels (L3ES-4), T1.5, T9.6, T9.7 côté annonceur. |
| 10 | `feat(brand): M4, the anonymous creator search` | Entrée « Créateurs », M4 et ses états, e2e L3F-E1. |
| 11 | `feat(brand): the anonymous profile, the shortlists and the request to the team` | Profil ouvert, sélections, demande, e2e L3F-E2. |

Puis U (`expert-ux`), F (recette `staging`, Q2), R (revue groupée), C (clôture).
