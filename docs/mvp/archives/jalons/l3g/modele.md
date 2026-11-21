# L3G — vue identifiée, pré-remplissage, file 9, compteurs, réglages (L3G-A)
> `architecte`, grilles `expert-database`, `expert-matching`, `product-owner`, 2026-11-21. **Prime sur `03`, `04`, `10`, `15`, `17b`, `18` et les prompts pour tout nom.** *M.* : motif ; `-n` : `EC-L3G-A-n`. Portes agent : propriétaire neuf `influx_agent_search_definer` (NOLOGIN NOINHERIT, sans membre), P7, `EXECUTE` à `influx_agent`, `influx_admin` seuls.

## 1. Porte identifiée (`0328`)
- `search.search_creators_identified(p_filters jsonb, p_sort text, p_page integer, p_campaign_id uuid, p_prefill_id uuid) → jsonb`, VOLATILE ; `p_prefill_id` non nul : 0A000 jusqu'à `0329`.
- Ordre : appelant (`search.require_identified_searcher()` : agent ou admin, compte et profil interne actifs, `aal2` ; 42501) ; entrées (tri, page ≥ 1, `search.check_identified_search_filters()` : socle par `check_creator_search_filters()`, puis G ; 22023) ; campagne (`is_admitted_campaign(sa marque, id)`, sinon P0002 `campaign`) ; pré-remplissage (§4) ; page > `maxPages` : ligne `page_cap`, 400 après COMMIT ; moteur, compte, ordre, page ; journal (§3). Ni interrupteur, ni k, ni seau, ni verrou (CA61, RG62 ; D85 sans objet).
- Pages : réglage neuf `identified_view` `{pageSize: 20, maxPages: 10}` (CHECK 10–50, 1–20 ; hyp. `staging`), lu à chaque appel.
- `creator_candidates()` à signature égale : `agent_identified` = seconde requête, branche marque inchangée. E1 levée (G2 filtre) ; E2 (RG8), E3, E4 gardées ; E5 affichée, non exclue ; E6 si une marque est connue (celle de la campagne ; sans campagne, ni E5 ni E6). *M.* : RG71, cinq différences seules ; colonnes G jamais accordées au propriétaire de la marque (-1).
- `creator_order()` tel quel (quota froid compris) ; `creator_exposures` non écrite (RG87).
- Ligne : `accountId`, `alias`, `status` (G2), `declaredStatus` (G1), `legalName`, `city`, `residence` `{country, region}` (G9), `ownerAgent` `{accountId, firstName}` (G8), `refusedSectors` (G10), `blocked`, `networks` `[{network, isPrimary, pseudonym, handle, profileUrl, followers, postsLast30Days, avgComments, engagementBp, measuredAt, source, badge}]`, `mainAudience` `{country, sharePercent}`, `reasons`, `vigilance` (ceux de la carte, RG77). Chiffres : règle de la fiche créateur (`account-creator/repository.ts`) reproduite en SQL, égalité prouvée par L3G-T4 (-2). Jamais coordonnées ni adresse (D46), tarif ni budget (D78).
- `blocked` : blocage actif avec la marque de la campagne, ni motif ni auteur ; faux sans campagne. Réponse `{state: results, total, page, nextPage, capReached, rows}` (`total` exact).
- Droits : couches A, I (colonnes servies), `accounts` (+ `declared_status`, `owner_agent_id`), `agent_profiles.first_name`, blocages, secteurs refusés, badges, campagnes ; T1-R : couples agent seuls.
- AL21 recréée à signature égale : `advertiser_anonymous` seul (EC-L3G-5).

## 2. Facettes G
- `G1` (`individual`, `business`), `G2` (cinq états), `G8` (agents), `G9` `{country, regions?}` (résidence), `G10` (en refuse au moins un) ; listes 1 à 20, RG17 ; à la porte marque : 22023.
- Hors `facet_settings`, non versionnées. G3 sans donnée : Lot 4 (EC-L3G-2) ; ville affichée, non filtrée.

## 3. Journal (RG78, CA58)
- Appel servi ou `page_cap` : `search_queries` (`actor_role` `agent`/`admin`, `view_mode = agent_identified`, campagne, filtres, tri, version, compte exact) ; une impression par ligne (rang, raisons en tranches) ; valeurs exactes jamais écrites. Écriture refusée : rien servi.
- Consultation : fiche compte existante (`history.account_read`), aucune porte neuve.
- Ni export ; écran du journal au Lot 5 avec AL21 interne (`03` l. 333) ; créateur effacé : impressions (`0318`) ; ni outbox, `matching.*` ni notification.

## 4. Pré-remplissage (`0329`)
- `search.prefill_campaign_filters(p_campaign_id) → jsonb`, appelant du §1 ; campagne admise de toute marque, sinon P0002 `campaign` (inconnue, effacée, brouillon, refusée).
- F1 thématique du rang 1 ; F3, F11 réseaux et formats des livrables ; F4 tranches visées ; F6 `{country}` pays du rang 1 ; F8 langues. Facette fermée omise ; jamais F17, droits, exclusivité, âges, tranche ni budget (-3).
- `search.campaign_prefills` (`id`, `account_id`, `campaign_id`, `proposed`, `created_at`) : le proposé ; rend `{prefillId, campaign: {id, title}, filters}`.
- `p_prefill_id` : de l'appelant, même campagne, < 24 h, sinon P0002 `prefill` ; `search_queries.prefill_id` (nul hors vue identifiée). Retenus, retirés, ajoutés : `search.prefill_diff(proposed, filters)` (IMMUTABLE, sans droit) ; « Vider » garde le lien.
- RLS forcée, aucun droit d'exécution ; codes seuls, ni export ; 12 mois.

## 5. File 9 (`0330`)
- `selection_requests` + `claimed_by_account_id`, `claimed_at`, `claim_expires_at`, `closed_at`, `closed_by_account_id`, `close_reason_code`, `close_note` ; `closed` ⇔ date, agent, motif ; note 10 à 500 ssi `other`.
- `SELECT` de colonnes aux agents et admins (patron `0307`) ; portes `open_team_selection_request(id)` (prise, durée de `sla_policies` ; `claimed`, `held`, `read_only`, `closed`), `release_team_selection_request(id)`, `extend_team_selection_claim(id)`, `close_team_selection_request(id, reason, note)` (prise vivante, sinon 55P03). Registre `queue.*` (`queue_code`) ; neuf `search.selection_request_closed` {reason_code}, `exported`. Sans reprise forcée (-4).
- Motifs, sous-ensemble de la liste A : `off_brief`, `motive_insufficient`, `contact_details_in_text`, `campaign_closed`, `duplicate`, `other`. *M.* : aucun créateur en cause ; `budget_mismatch` (D78), `suspected_circumvention` (escalade, Lot 5) écartés ; issue positive avec « Proposer » (Lot 4), d'ici là `other` (-5).
- Marque : rien de neuf (e-mail au Lot 5) ; export inchangé.
- AL23 : `etat`, `{agent, admin}`, délai `sla_due_at` ; dérivée par l'API. Message en texte brut, `dir="auto"`, bidi neutralisés (L3FS-7).

## 6. Compteurs et alertes (`0331`)
- Tâche `supply_counters`, quotidienne dès 00:00 UTC (patron `campaign_closure`) : `ops.compute_supply_counters(p_run_id, p_attempt)` (`influx_maintenance_definer`, `EXECUTE` à `influx_worker`) remplace les lignes du jour (rejeu idempotent) : `global`, `topic` (principale), `country` (audience principale) ; `published` = E1, E3, E4 ; `searchable` = + E2. Ni `search_settings` ni couche I ; échec : la veille reste.
- **AL65**, code neuf de CA60 (`15` RG68) : `etat`, `{admin}`, `{"staleAfterHours": 26}` ; causes `thresholds_reached` (fermé, global ≥ `publishedProfiles` et une thématique ≥ `perTopic`), `below_while_open` (`10` l. 969), `counters_stale`. Seuils de `critical_mass_thresholds` seul (D38 Q2). *M.* : thématique sous k inutile (RG58) (-6).
- **AL22** : `etat`, `{admin}` (`chef-de-projet` n'est pas un rôle) ; recherches marque page 1 bloquées par k sur 7 jours, au moins 20 : `{"blockedShareBp": 2000, "windowDays": 7, "minSearches": 20}` (hyp. `staging`, -7).
- Lecteurs `search.critical_mass_alerts()`, `read_supply_counters()` : propriétaire `influx_search_admin_definer`, `EXECUTE` à `influx_admin`.

## 7. Réglages (`0332`)
- Actions `search.change_setting` `{key, value}`, `search.change_facet` `{facet_code, is_open, display_order}` : `canonical_dual_control_payload()` les forme et refuse sans pair (`has_peer_admin`) ; `consume_dual_control_for()` les accepte pour `influx_search_admin_definer`.
- Écrivains, anciennes signatures supprimées : `write_search_setting(p_session_id, p_dual_control_request_id, p_key, p_value, p_reason_code)`, `write_facet_setting(…, p_code, p_is_open, p_display_order, p_reason_code, p_note)` ; `degraded_single_operator` : 42501, pair seul (D38 Q2, fiche inv. 10) ; version et `search.settings_changed` inchangés, plus mode et demande.
- Motifs `critical_mass_reached`, `founder_decision`, `abuse_response`, `configuration_error`. API : `POST /v1/bo/dual-control`, `…/:id/confirm` (exécuteur).
- Écran : interrupteur, `critical_mass_thresholds`, `k_anonymity_threshold` ; le reste lu (facettes au Lot 5, -8) ; compteurs, AL65 ; `search.read_search_settings()`.
- Kits inchangés (rôle de migration, base de test, aucun déclencheur). `staging` fermé.

## 8. Routes, contrats, écrans
- Backoffice seul (membre : 404 de route inconnue), `no-store` : `POST /v1/bo/creator-search` `{filters, sort, page, campaignId?, prefillId?}`, `POST /v1/bo/campaigns/:id/creator-prefill` (60/min par adresse) ; `/v1/bo/team-selection/entries` (+ `/:id/open`, `release`, `extend`, `close`) ; `GET /v1/bo/settings/search` ; alertes et compteurs des files étendus. 404, 400, 409, 503 ; aucun export.
- Contrats : `identified-creator-search.ts` (neuf), `backoffice-queues.ts`, `search-settings.ts`, `dual-control.ts`.
- Rail : « Créateurs » `/createurs/recherche` (`?campagne=`) ; `/files/selections-equipe` (« Faire se rencontrer ») ; `/reglages/recherche` (admin) ; « Créateurs compatibles » sur la fiche campagne.
- `17b` §3.3 : `BoIdentifiedFrame` ; Créateur, `@` ⧉, Audience, Badges, État ; ligne bloquée : la phrase ; ni case ni tarif (Q3, D78) ; libellés G de `10` RG16 (-9) ; aucun résultat : trois facettes de `WIDENING_ORDER` (-10). E2E : annexe.

## 9. Numéros, amendements, à relire
- `0328` : `04` §5.5, §11, `03` l. 329-333, `10` RG71. `0329` : `10` RG73. `0330` : `15` l. 300, 572, `17b` I13. `0331` : `15` RG68, AL22, `10` RG2. `0332` : `03` l. 337, PD4, `04` `dual_control_requests` (liste fermée). 12, 13 : `17b` §1.7, §3.3.
- Attendus changés : L3E-T6, T1-R, `search-journal-settings.test.ts` (08), T2, TM3.
- À relire : -1, -2, pair seul, agent sans seau `expert-cybersecurite` ; -4 à -7 `product-owner` ; -3, -6 `expert-matching` ; EC de 01 `product-owner` ; deux admins pour ouvrir : fondateur.
