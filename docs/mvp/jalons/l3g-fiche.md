# Jalon L3G — Le commercial trouve en vue identifiée les créateurs compatibles d'une campagne ; le Lot 3 est prêt à livrer
> Source : `jalons/lot3-plan.md` l. 37 (validé le 2026-11-13) · 2026-11-20 · Statut : ouvert (validé le 2026-11-20) · Annexe : `l3g/annexe.md`

## Objectif et périmètre
Un agent INFLUX (commercial, admin) cherche en vue identifiée (`10` §H, `17b` §3.3) sur le moteur unique
de L3E en mode `agent_identified` : identités, compte exact, profils non publiés étiquetés, blocage de la
paire avec avertissement, facettes G disponibles, explications et valeurs exactes, sans k ni interrupteur
(CA61). « Créateurs compatibles » pré-remplit les facettes depuis le brief d'une campagne ; pré-remplissage
et corrections journalisés (CA56). La file 9 se prend et se clôt avec motif (AL23). Le worker calcule
chaque jour les compteurs de masse critique (CA60, AL22). Les réglages de la recherche s'écrivent sous
contrôle d'un pair (D84, L3ES-2). En tête : L3FS-1 à -3, L3FT-1. Clôture du lot : TM12.5, D38, 30 s.
**Hors périmètre :** « Proposer à une campagne » et mise en relation (CA57, RG74 : Lot 4), sélection
multiple (Lot 4, avec « Proposer »), G4 à G7 (Lot 4) ; AL21 des comptes internes (Lot 5, `l3e/modele.md` §10) ; ouverture
de la recherche aux marques (décision humaine, interrupteur fermé en fin de jalon) ; export (C(17)) ;
e-mail à la marque à la clôture d'une demande ; purge à 12 mois (Lot 6) ; seuils d'AL21, CA45, CA46.

## Invariants
1. RG4, RG71 : un seul moteur (`search.creator_candidates()`, `creator_order()`) ; le mode change champs,
   exclusions et garde-fous, jamais les facettes du socle ni les bornes de tranches.
2. TM12.5, `03` l. 330 : toute porte de la vue identifiée a `EXECUTE` à `influx_agent` et `influx_admin`
   seuls ; `influx_advertiser`, `influx_creator` : 42501 en base ; route membre : 404 de route inconnue ;
   propriétaire neuf, jamais celui de la marque ni `influx_creator_profile_definer` (L2GS-5).
3. T1, T1-R : aucune route ni porte membre ne change de charge ; aucun droit neuf d'un rôle membre ; couche
   I lue par le seul propriétaire agent (`03` P7 : `search_path = ''`, `REVOKE … FROM PUBLIC`, aucun
   `execute` dynamique) ; commit touchant `audit.*`, une politique, un `GRANT` ou la double validation
   signalé I-4.
4. RG78, CA58 : recherche et consultation identifiées journalisées nominativement (agent, mode, filtres,
   profils affichés) dans la transaction qui sert ; écriture refusée, rien servi.
5. RG73, CA56 : pré-remplissage tiré du seul brief d'une campagne admise ; filtres proposés, retenus et
   retirés journalisés ; aucune tranche ni budget (D78).
6. RG71, `17b` l. 869 : blocage affiché « Vous ne pouvez pas proposer ce créateur à cette marque. »,
   jamais le motif ni l'auteur ; G10 jamais exposé, compté ni motivé à une marque (RG31).
7. RG76, TM12.3 : aucun export, aucune taille de page du client, pagination plafonnée en base.
8. D45, RG8 : recherche, consultation, prise ou clôture de la file 9 n'écrivent ni `leads.outbox_events`,
   ni `matching.*`, ni notification au créateur.
9. RG2, CA60 : le calcul quotidien écrit `search.supply_counters` et propose, sans jamais toucher
   `is_open_to_advertisers` ; échec : valeur de la veille gardée, alerte.
10. D84, L3ES-2 : `search.write_search_setting()` et `write_facet_setting()` n'écrivent qu'une double
    validation confirmée par un second admin (`aal2`).
11. File 9 (`15` l. 300) : prise sous verrou, clôture motivée par liste fermée (`17b` l. 2191), délai figé
    au dépôt, AL23 au-delà ; message de la marque en texte brut, bidi neutralisés (L3FS-7).
12. D48, D78 : aucun montant ni tarif dans la vue, le pré-remplissage, la file 9 ou les réglages.
13. RG89, `CLAUDE.md` §4 : FR et EN sans clé visible ; KEO et tokens seuls ; `BoIdentifiedFrame`
    (`17b` l. 1960-1968) ; WCAG AA ; aucune logique métier dans les composants.
14. T14 : rôle non interne, campagne, demande ou réglage inconnus ou d'autrui : réponse de l'inexistant.
15. Aucun plancher baissé ; tout fichier de test neuf déclaré (`db-tests/shards.ts`, `case-floors.ts`,
    `e2e/case-floors.ts`).

## Lectures
Commun : cette fiche ; `l3g/modele.md` dès A ; `archives/jalons/l3e/modele.md` §1, §9, §10 ;
`archives/jalons/l3f/modele.md` §6, §7. Chemins de `docs/mvp/` abrégés ; `03xx` = `supabase/migrations/03xx_*.sql`.
| # | Tranches principales (le prompt complète) |
|---|---|
| 01-03 | `archives/jalons/l3f/annexe.md` l. 85-110 ; `0323` l. 315-500 ; `0324` l. 336-340, 592-730 ; `platform/member-rate.ts` |
| A | `10` l. 160-172, 276-290, 726-771, 810-823, 946, 972, 992, 1220-1250, 1367 ; `17b` l. 84-110, 145, 816-907, 1960-1968, 2191 ; `15` l. 300, 543, 569-572, 1471 ; `13` l. 691-711 ; `03` l. 318-340, 360 ; `04` l. 2120-2240 ; `18` l. 1019-1028, 1564-1575 ; `0316` l. 655-680, 822-960 ; `0319` l. 694-830 ; `0322` l. 62-225 ; `0325` l. 1-80 ; `0307` l. 665-1120 ; `0309` l. 1578 ; `0130` l. 523-780 |
| 04-08 | A ; `modele.md` § de la ligne ; migrations citées par le prompt |
| 09-10 | `domains/search/creator-search/*.ts` ; `domains/backoffice/campaign-queue-routes.ts`, `campaign-queue-decision-routes.ts`, `actions-apollo-routes.ts`, `dual-control.ts` ; contrats `creator-search.ts`, `search-settings.ts`, `backoffice-queues.ts` |
| 11 | `18` l. 286-332, 731-744, 1019-1028 ; `t1-anonymisation.test.ts` |
| 12-13 | `17b` l. 264-364, 365-555, 816-907, 1551-1647, 1960-1968 ; `components/bo-nav.ts`, `CampaignQueueScreen.tsx`, `ApolloSettingsScreen.tsx`, `DualControlScreens.tsx` |

## Commits
| # | Titre imposé | Contenu |
|---|---|---|
| 01 | `fix(db): 0327 the profile, visual and shortlist doors hide an exclusion` | L3FS-1, L3FS-2, volet SQL de L3FS-3 (moteur avant le verrou, `lock_timeout`). |
| 02 | `test(db): the advisory-locked caps under two committed connections` | L3FT-1 : ouvertures, listes, éléments, demandes, seau de L3E. |
| 03 | `fix(api): an address rate on the shortlist writes` | L3FS-3 : débit par adresse sur les six routes d'écriture des sélections. |
| A | arbitrage `architecte` (grilles `expert-database`, `expert-matching`, `product-owner`) | `l3g/modele.md` : porte, champs, G, journal, pré-remplissage, file 9, compteurs, alertes, réglages, routes, écrans. |
| 04 | `feat(db): 0328 the identified creator search door for agents` | Mode `agent_identified` : identités, états, blocage, G, compte exact, journal nominatif, TM12.5. |
| 05 | `feat(db): 0329 the campaign brief prefill and its journal` | RG73, CA56 : facettes tirées du brief ; proposé, retenu, retiré. |
| 06 | `feat(db): 0330 queue 9, claiming and closing a team selection request` | Prise, relâche, clôture motivée, AL23. |
| 07 | `feat(db): 0331 the daily supply counters and the critical mass alerts` | Tâche quotidienne du worker, alerte de CA60, AL22, échec gardé. |
| 08 | `feat(db): 0332 the search settings under a peer's control` | D84, L3ES-2 : les deux écrivains derrière la double validation. |
| 09 | `feat(api): the identified creator search and the brief prefill` | Routes du backoffice, contrats stricts, T14. |
| 10 | `feat(api): queue 9 and the search settings routes` | File 9, alertes, réglages en double validation. |
| 11 | `test: TM12.5, T1 and T14 around the identified view` | Base et routes ; T1 rejoué sur les routes membres. |
| 12 | `feat(backoffice): the identified creator search and a campaign's compatible creators` | Écran `17b` §3.3, marqueur, e2e L3G-E1. |
| 13 | `feat(backoffice): queue 9 and the search settings screens` | File 9, réglages admin, e2e L3G-E2. |

D38 tranchée le 2026-11-20 (annexe, Q2). Après 13 : U (`expert-ux`), F (recette `staging`, 30 s, Q4), R (revue groupée),
C (clôture du jalon et du lot).
