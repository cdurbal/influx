# L3F — profil anonyme, visuels, sélections, demande (L3F-A)
> `architecte`, grilles `expert-database`, `expert-matching`, `product-owner`, 2026-11-19. **Prime sur `03`, `04`, `10`, `15`, `17`, `18` et les prompts pour tout nom.** *M.* : motif ; `-n` : `EC-L3F-A-n`. Portes marque : propriétaire `influx_creator_search_definer`, patron P7, `EXECUTE` à `influx_advertiser` seul. *M.* : même vue (couche A, E1 à E6, un moteur), aucun rôle neuf.

## 1. Campagne d'origine (`0322`, L3ES-1)
- Admise : de la marque, `erased_at` nul, `pending_review`, `published`, `paused` ou `closed` ; `draft`, `rejected` : inconnue (P0002, 404), rien écrit ni décompté. *M.* : les deux états où la marque écrit (garde de `0307`) ; ailleurs le secteur est figé (RG31).
- Une source, `search.is_admitted_campaign(p_advertiser_account_id, p_campaign_id)` (invoker) : porte, moteur (E6 : secteur d'une campagne admise seule), profil, sélections, demande ; `status` lu par le propriétaire ; `search_creators()`, `creator_candidates()` recréées à signature égale.
- Liste dont la campagne passe `rejected` : rattachement gardé, secteur ignoré (résidu : geste d'agent).
- Écran : « Recherche liée à » liste ces états (`CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES`, contrats, 08).

## 2. Profil (`0323`)
- `search.open_creator_profile(p_alias text) → jsonb`. Ordre : appelant (42501) ; `brand_not_published` ; `closed` (rien écrit) ; seau ; alias membre de `creator_candidates('advertiser_anonymous', appelant, '{}', campagne d'origine)` (RG4), sinon P0002 `creator` : même code, même corps (inconnu, exclu, mal formé), rien écrit ni compté (CA49).
- Origine (-3) : l'impression la plus récente du créateur dans une recherche servie de l'appelant, de moins de 24 h. Aucun identifiant de recherche servi.
- Même transaction : une ligne `search.profile_openings` ; l'impression d'origine `was_opened`, `opened_at`, une fois (CA48). Écriture refusée, rien servi.
- `{state: profile, creator, residenceRegion, reasons, vigilance}` : `creator` = la carte (`creator_layer_a()` sans `status` ni `lineKey`) ; raisons et note de `creator_order()` sur ce créateur, filtres et campagne d'origine, sinon `'{}'`. CA6 : clés de la carte plus la région (fiche, invariant 1).
- Seau `search.creator_open_retry_after(account)` : verrou par compte, lignes `served` sur 24 h contre `profileOpensPerDay`, réouverture comprise ; au-delà `{state: rate_limited, retryAfterSeconds}`, une ligne `rate_limited` par fenêtre (L3DS-1). Adresse 60/min.
- `profile_openings` : `id`, `account_id`, `outcome` (`served`, `rate_limited`), `creator_account_id` (nul ssi `rate_limited`), `search_query_id` (nul permis, cascade), `request_id`, `created_at` ; index du seau, de la date, du créateur ; ajout seul, RLS forcée, aucun droit membre ; non exportée comme les impressions (-7), effacée par `0325`.

## 3. Visuels (EC-L3F-1 : relais)
- `search.read_creator_visual(p_alias, p_visual_id) → (object_key, width, height)`, STABLE : aucune ligne si appelant refusé, non publiée, fermé, alias non visible (sans campagne), visuel inconnu, non `approved` ou d'un autre.
- Le propriétaire lit ces colonnes des visuels `approved` visibles (-1 : T9.6 élargie, patron du logo L3D), jamais servies.
- `apps/api` relit l'objet (`portfolio`, borne de `storage.ts`) : `portfolioImageResponseSchema`, `nosniff` ; Storage indisponible 503 ; objet absent 404.
- Ni journal ni seau de compte ; adresse 240/min (-4). *M.* : couche A (`07` RG85) ; identifiants appris des seules réponses journalisées et plafonnées.
- `18` (09) : T1.5, T9.2 « aucune URL émise » ; T9.7 « lecture par `apps/api` ».

## 4. Région (EC-L3F-6)
- `search.displayed_region(p_creator_account_id) → text` (invoker) : la région si au moins `region_display_threshold` vitrines E1 à E4 partagent pays et région, sinon nul. *M.* : même réponse pour toute marque (ni E5 ni E6), plus strict que « publiés » (-9).
- Profil seul ; **carte inchangée**, `0319`, `0320` non recréées pour elle (-2). *M.* : fiche, contrat L3E et aperçu intacts, aucun décompte par carte.

## 5. Sélections (`0324`)
- `create_shortlist(p_name, p_campaign_id)`, `update_shortlist(id, p_name, p_campaign_id)` (remplacement, nul = sans campagne), `delete_shortlist(id)`, `add_to_shortlist(id, p_alias)` (idempotent), `set_shortlist_note(id, p_alias, p_note)` (nul efface), `remove_from_shortlist(id, p_alias)`, `list_shortlists()`, `read_shortlist(id)`.
- D'autrui ou inconnue : P0002 `shortlist`. Fermé, RG1 : `closed`, `brand_not_published` partout, rien écrit ni servi (-8).
- Ajout : alias visible avec la campagne de la liste et **déjà servi à l'appelant** (impression ou ouverture, -5), sinon P0002 `creator`. Retrait idempotent, même réponse en tout cas. Note d'un masqué : P0002.
- Lecture : visibles seuls (moteur, campagne admise), masqués sans trace ni compte ; `{creator, note, addedAt}`, récents d'abord ; ni journal ni seau, adresse 60/min.
- Bornes `listsPerAccount`, `itemsPerList` (toutes lignes) : 54000, 409 `conflict` (`shortlist_limit`, `shortlist_full`). Nom 1 à 80, une ligne ; note 1 à 500 ; sinon 22023, 400.
- Réglage neuf `selection_limits` `{listsPerAccount: 10, itemsPerList: 25, requestsPerDay: 5}` (CHECK 1–100, 1–100, 1–50, zod, hyp. `staging`) ; politique du propriétaire : + `selection_limits`, `region_display_threshold`.
- Rien au créateur, à l'outbox ni à `matching.*` (CA52, D45).

## 6. Demande (`0325`, RG61, CA39)
- `search.selection_requests` : `id`, `advertiser_account_id`, `campaign_id` (nul permis), `filters` (forme `p_filters`), `language` (`preferred_language` au dépôt), `message` (nul ou 1 à 1 000), `state` (`open` ; `closed` au L3G), `sla_due_at`, `created_at` ; RLS forcée.
- `search.request_team_selection(p_filters, p_campaign_id, p_message)` : appelant ; `brand_not_published` (-10) ; **interrupteur ignoré**, sous le seuil acceptée ; `requestsPerDay` sur 24 h : `rate_limited`, rien écrit ; filtres (`check_creator_search_filters()`), campagne admise, message ; ligne et `audit.append('search.selection_requested')` (identifiants, `exported`) ; `{state: requested, answerBy}` (= `sla_due_at`).
- File 9 déclarée ici (EC-L3F-4, patron `0206`) : `team_selection` (agent, admin, verrou), délai provisoire 480 min ouvrées, prise 240 (`15` Q3), `sla_due_at` par `business_deadline()`. Prise, clôture, écran, AL23 : L3G. *M.* : née avec son délai, lu de la table.
- Ni créateur, `matching.*`, outbox ni e-mail (D45, CA64) ; texte lu des agents seuls (D46).
- Export `advertiser_profile.selection_requests` (instant, filtres, titre de campagne, langue, message, état) ; effacement : demandes et ouvertures ; 12 mois après clôture (`04` §9).

## 7. Alertes (`0326`)
- CA45, CA46 : **causes d'AL21** (-11), `creator_search_volume_alerts()` recréée à signature égale, seuils ajoutés sans écraser.
- `distinct_profiles_served` : impressions et ouvertures, 24 h ; `rate_limited` : refus de recherche et d'ouverture ; `open_cap_share_day` : ouvertures 24 h ≥ `rate_cap_share_bp` de `profileOpensPerDay`.
- `refinement` : les `refinement_searches` (6) dernières recherches neuves (`served`, page 1, 24 h), chaque paire successive différant d'une seule facette (tri, campagne ignorés), dont `refinement_blocked` (2) sous k ; nombre 6, date de la première.
- `aspiration` (agrégation multi-comptes, L3ES-3) : si les créateurs ouverts distincts des comptes sans ajout ni demande sur 24 h dépassent `aspiration_profiles_24h` (150), une ligne par tel compte. *M.* : un compte plafonne à 60, `open_cap_share_day` le couvre (-6).
- Seuil absent : cause muette ; ni filtre, alias ni créateur ; lecteur `influx_search_admin_definer`.

## 8. Routes (marque seule, sinon 404 de route inconnue ; `no-store`)
- `GET /v1/creator-search/profiles/:alias` (§2), `GET …/:alias/visuals/:visualId` (§3) ; `GET`, `POST /v1/me/shortlists`, `GET`, `PUT`, `DELETE …/:id`, `PUT`, `DELETE …/:id/items/:alias`, `PUT …/items/:alias/note` (résumé `{id, name, campaignId, count, createdAt}`) ; `POST /v1/me/selection-requests` (adresse 10/min).
- 404 (inconnu, exclu, d'autrui, campagne non admise) ; 400 ; 409 ; 429 + `Retry-After` après COMMIT ; 503 ; 42501 `forbidden` = `brand_not_published`.
- Opaques seuls : alias, uuid de visuel et de liste. Contrats et modules `creator-search-profile`, `shortlists`, `selection-requests` ; ni export, ni « tout ajouter », ni taille de page.

## 9. Écrans
- `advertiserCreators` `createurs`/`creators` (M4) ; `advertiserShortlists` `…/selections` (sous-menu D74 au 11) ; enfants `advertiserCreatorProfile` `createurs/profil/[id]`/`creators/profile/[id]` (alias), `advertiserShortlist` `…/selections/[id]`, `advertiserSelectionRequest` `createurs/demande-de-selection`/`creators/selection-request`.
- Adresse de M4 : `F1` à `F17` (codes, virgules), `F6s`, `sort`, `page`, `campaign`, `list` ; valeur illisible ignorée ; reprise par la demande.
- E2E : créateurs SQL à pays d'audience et thématique propres, 3 visuels avec objet (kit `creator-portfolio.spec.ts`), plafond par lignes du compte ; interrupteur sous verrou consultatif, exclusif pour le cas fermé.

## 10. Numéros, amendements, à relire
- `0322` (02) à `0326` (06), chacune `04` §11 et : 02 `10` RG31, CA33 ; 03 `03` §3.3, P7, `04` §5.5, `10` RG15, RG50, RG66, CA6, `07` RG37 ; 04 `03` §3.3, `04` §5.5, `10` RG51 ; 05 `04` §5.5, §9, l. 5258, `15` file 9, `10` RG61 ; 06 `15` RG68, AL21 ; 07 `18` T15.2 ; 09 `18` T1.5, T9.2, T9.7 ; 10 `17` §4.4 ; 11 `17` §4.9, §7.1.
- Attendus changés ici : T9 L2G (+ 3 colonnes, 03), T1-R (03, 04), fonctions épinglées de la marque (03 à 05), L3E-T3 (neuf clés, 04), T2 (tables neuves).
- À relire : -1, -4, -5, -6 `expert-cybersecurite` ; -2, -3, -8, -10, -11 `product-owner` ; -3, -9 `expert-matching` ; -7, demande `expert-conformite-rgpd` (Lot 6). Seuils : fondateur avant `production`.
