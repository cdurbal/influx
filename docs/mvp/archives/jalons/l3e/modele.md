# L3E — recherche anonymisée des créateurs (L3E-A)
> `architecte`, grilles `expert-database`, `expert-matching`, 2026-11-19. **Prime sur `03`, `04`, `10` et les prompts pour tout nom.** *M.* : motif ; `-n` : `EC-L3E-A-n`. Socle : F1, F3, F4, F6, F8, F11, F17.

## 1. Porte et moteur (`0319`)
- Propriétaire **neuf `influx_creator_search_definer`** (NOLOGIN NOINHERIT, sans membre). *M.* : D81 (5) ; la porte agent (L3G) aura le sien.
- `search.search_creators(p_filters jsonb, p_sort text, p_page integer, p_campaign_id uuid) → jsonb`, VOLATILE, patron P7, `EXECUTE` à `influx_advertiser` seul, verrou par compte ; rôle `advertiser`, compte `active`, sinon 42501.
- Moteur unique (RG4), aides invoker : `search.creator_candidates(p_mode, p_advertiser_account_id, p_filters, p_campaign_id)` (06), `search.creator_order(…, p_day date)` (07) ; `agent_identified` : 0A000 jusqu'au L3G.
- Droits par colonne, politiques bornées : couche A (§2) des profils `published` cherchables ; `accounts` (status, is_adult_attested), rôles ; statut et secteurs de la marque ; `creator_refused_sectors` ; `party_blocks` ; ses campagnes, livrables, pays ; `search.*` (§9). **Jamais** couche I, `leads.*`, tranche, budget, coordonnées ni bloc interne.
- T1-R : couples `(search.search_creators, r)` par relation de couche A atteinte, plus `creator_refused_sectors` (E6) et `party_blocks` (E5), prédicats jamais servis ; `NEVER_EXCEPTED` réduit à la couche I (identités, lignes, audience exacte, historique) : **attendu de L3E-T2 changé ici** (06). *M.* : invariant 4 (E5, E6 dans la porte) ; l'invariant 1 refuse un droit de la marque et la couche I (-1).

## 2. Carte
- **Une source SQL** : la requête de `readProjectionLayerA()` passe dans `profiles.creator_layer_a(p_account_id uuid) → jsonb` (invoker, STABLE, `EXECUTE` à `influx_creator` et au §1), appelée par le dépôt, aperçu inchangé (06) ; la porte la sert sans `status` ni `lineKey` ; l'API la valide (zod strict) et la met en forme comme `readLayerA()` (08). *M.* : invariant 2, aucun droit de la marque sur `profiles.*`.
- Carte `{creator, reasons, vigilance}` : `CreatorProjectionBefore` entière, référencée par l'**alias** (RG65, CA49), sans rang ni autre identifiant ; visuels `id`, `order`, `caption`, image au L3F.
- Région **absente** (RG37) ; le L3F l'ajoute avec son décompte (RG15), qui lit d'autres profils (-2).

## 3. Filtres et exclusions
- `p_filters` (contrat et journal) : clé = code ; `F1` code ; `F3`, `F4`, `F8`, `F11`, `F17` listes (1 à 20, sans doublon) ; `F6` `{country, shareBands?}`. Code inconnu, facette fermée ou hors socle : 22023, rien écrit (400).
- RG17 : OU dedans, ET entre ; F3 et F4 sur une même ligne listée ; F6 pays et part ensemble ; F1 = thématique principale ; F17 = badge `active` ou `to_refresh` d'une ligne listée.
- E1 à E6 avant tout comptage, silencieuses : `published`, `is_searchable`, compte `active`, `is_adult_attested`, aucun blocage actif de la paire, aucun secteur refusé parmi le principal, les secondaires et celui de la campagne (-3).
- F24, F25 affichés, non filtrables (Q13). Pas de fermeture par thématique (RG3, Q9 ouverte).

## 4. Contrôles et réponses
Dans l'ordre : marque non `published` : `brand_not_published` ; interrupteur faux : `closed` (rien écrit ni décompté) ; débit (§8) ; entrées, campagne inconnue, d'autrui ou effacée (P0002, 404) ; page (§5) ; compte après exclusions : sous `k_anonymity_threshold` (CHECK 5 à 50), `too_narrow` **sans autre champ** ; sinon `results` : `countBand` (`search.result_count_band()`, `0316` : `5_9`, `10_24`, `25_49`, `50_plus`), `page`, `nextPage`, `capReached`, `cards`. Tout s'écrit dans la transaction qui sert (CA47).
- Élargissements : l'écran (L3F) les tire de `WIDENING_ORDER` (contrats : F17, F4, F6, F11, F8, F3, F1). *M.* : sous le seuil, réponse constante (CA35, CA37).

## 5. Pages
`page_size` 12, `max_pages` 5, lus à chaque appel ; rang, pas de curseur (L3D §4) ; aucun paramètre de taille (clé inconnue : 400). Page > `max_pages` : ligne `page_cap`, 400 `validation_failed` après COMMIT, tentative de CA42 (-4). Au-delà des résultats, `cards: []`.

## 6. Ordre (`0320`)
Clés de l'`ORDER BY`, jamais agrégées, écrites ni servies (D11) ; `jour` UTC.
1. Valeurs OU satisfaites au-delà de la première (F3 sur les lignes de F4, F8, F11, F17) ; principale avant secondaire : neutre (F2 fermée). 2. Campagne : livrables satisfaits (réseau listé, format proposé) + pays principal visé ; neutre sans (RG37). 3. `audience_verified` > `account_verified` > aucun. 4. Frais avant périmé (ligne principale de plus de 90 jours, badge d'audience `to_refresh`). 5. **Neutre** : complétude en couche I (-5). 6. `< 2 semaines` > `< 1 mois` > complet. 7. Neutre. 8. `md5(jour || ':' || creator_account_id)`, puis `creator_account_id`.
- Tris : `default` ; `audience` (meilleure tranche des lignes de F3, F4, sinon de toutes, puis 3 à 8) ; `verified_first` (3, 1, 2, 4 à 8) ; `new_profiles` (moins de `recentDays` jours, puis 1 à 8).
- Quota froid (`default`, page 1) : froid = publié depuis moins de `recentDays` jours ou absent de `search.creator_exposures` avant `jour` ; sous `slots`, les froids les mieux classés prennent les dernières places ; impression `cold_quota`. *M.* : stable dans la journée (RG45) ; un tri nommé tient sa promesse (RG44). `0320` insère une version (RG88).

## 7. Raisons et vigilance (`0320`)
- Par palier puis facette : 1 `topic_match` {topic}, `network_match` {network, audienceBand}, `audience_country_match` {country, shareBand}, `language_match` {language}, `format_match` {format} (filtre appliqué) ; 2 `campaign_format` {network, format}, `campaign_audience_country` {country, shareBand} ; 3 `audience_verified` ou `account_verified` {network} ; 4 `figures_fresh` {network} ; 6 `available` {availability}. Quatre au plus ; sous deux, `primary_topic` {topic} puis `main_audience` {country, shareBand} (exigés pour publier).
- `reason_params` : **chaînes seules** (CHECK jsonpath), clés ci-dessus, ≤ 500 o ; F6 en tranche (`50_80`), jamais 72 (EC-L3E-2) ; une date se lit sur la carte.
- Vigilance, une au plus (RG42) : `stale_figures`, `recent_profile`, `audience_badge_to_renew`, `declared_full`.
- `explanation_reasons` (`04`) + `kind` (`reason`, `vigilance`), semées par `0316`.

## 8. Débit
- Compte, en base : `served`, `page_cap` sur 1 h et 24 h glissantes ; **une page = une recherche** ; au-delà, `retryAfterSeconds` (`0314`), rien servi, ligne `rate_limited` si aucune n'est dans la fenêtre qui refuse (`0315`). *M.* : le plafond borne les profils servis (-6).
- Adresse, en mémoire, avant la session : `"POST /v1/creator-search": 60`.

## 9. Données (`0316` sauf mention)
- `search_queries` : `id` uuid, **`outcome`** (`served`, `page_cap`, `rate_limited` ; hors `served` nombre 0 ; `rate_limited` : `{}`), `filters` ≤ 2 000 o, `sort_code` (4), `result_count` exact jamais servi ni exporté, `request_id` ; `(account_id, created_at desc)` complet et partiel hors `rate_limited`.
- `search_impressions` : rang, **`cold_quota`**, **`vigilance_code`**, `was_opened` vrai une fois (L3F) ; `impression_reasons` ; **`search.creator_exposures`** (`creator_account_id` PK, `first_page_at`), à chaque page 1. Ajout seul hors effacement, RLS forcée, aucun droit membre.
- `search_settings` (CHECK par clé, zod) : `is_open_to_advertisers` false, `k_anonymity_threshold` 5, `page_size` 12, `max_pages` 5, `rate_limits` {perHour 30, perDay 200, profileOpensPerDay 60}, `cold_profile_quota` {slots 2, recentDays 30}, `critical_mass_thresholds` {publishedProfiles 30, perTopic 5}, `region_display_threshold` 5 ; **sans `alert_thresholds`** (§10).
- `facet_settings` : 24 codes (RG12 à RG14), socle ouvert, F12 fermée, **CHECK : ouverte ⇒ socle**. `facet_config_versions` v1 ; instantané : facettes, k, quota.
- `search.write_search_setting(key, value)`, `write_facet_setting(code, is_open, display_order, note)` : propriétaire **neuf `influx_search_admin_definer`**, `EXECUTE` à `influx_admin` (`aal2`), `search.settings_changed` (`exported`), version si facette, k ou quota ; contrôle d'un pair (D84) avec la route du L3G (-7).
- `supply_counters` : table seule. Sélections : RLS forcée, aucun droit membre (la marque ne tient jamais un `creator_account_id`), portes par alias au L3F.
- `0317` : `party_blocks` (`04` §5.6), `block_reasons` **vide** (motifs avec le geste, Q11 ; L3E-T4 sème les siens) ; aucun droit membre, agent ni admin ; `block.created`, `block.lifted` en `excluded_third_party` (RG30).
- Export (`0318`) : `advertiser_profile.creator_searches` (instant, filtres, tri, page, issue, `countBand` ou nul, blocage k, campagne), `.shortlists` (nom, campagne, alias, date, note), `*.blocks` posés par le membre (alias ou marque, motif, commentaire, dates) ; jamais impression, raison, exposition, nombre exact, blocage subi. Effacement, suppression : marque — recherches et impressions, sélections, blocages ; créateur — impressions, éléments de sélection, blocages, exposition. 12 mois, purge au Lot 6.

## 10. Route, contrat, AL21
- `POST /v1/creator-search` (`search/creator-search/`), corps strict `{filters, sort, page (1 à 50), campaignId?}`, marque seule (sinon 404 de route inconnue), `no-store` ; 200 `{state}` ou `results`, 429 et 400 après COMMIT ; contrat `creator-search.ts`.
- AL21 (`0321`) : `alert_definitions` `etat` (dérivée jusqu'à `0406`), `{admin}`, `{"distinct_profiles_served_24h": 150, "rate_cap_share_bp": 8000}` (hyp. `staging`) ; `search.creator_search_volume_alerts()` STABLE `SECURITY DEFINER` (propriétaire du §9, `EXECUTE` à `influx_admin`) : compte et cause (`distinct_profiles_served`, `rate_cap_share` sur 1 h ou 24 h, `rate_limited`). Internes : Lot 5.

## 11. Numéros, amendements, à relire
- `0316` (03) à `0320` (07), `0321` (10) ; chaque ligne amende `04` §11 et : 03 `04` §5.5, `03` §3.3 ; 04 `04` §5.6, l. 5493, `03` §3.4 ; 05 `04` §9 ; 06 `03` §3.3, P7, `04` l. 5486 ; 07 `10` CA4, RG41 ; 10 `15` AL21.
- À relire : -1, -6, -7 `expert-cybersecurite` ; -2 à -5 `product-owner`, `expert-matching` ; export créateur sans impression (RG8, RGPD, Lot 6).
