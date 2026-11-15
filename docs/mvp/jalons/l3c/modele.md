# L3C — modèle de la file 7 et de la vie d'une campagne (L3C-A)
> `architecte`, grille `expert-database`, 2026-11-14. **Prime sur `04`, `09`, `15` et les prompts 02 à 10 pour tout nom.** *M.* : motif ; `-n` : `EC-L3C-A-n`.

## 1. File 7
- **`campaigns.campaign_review_entries`** : colonnes de `0243` §4 (verrou, levée, décision, `sla_breached`), `account_id` → `advertiser_account_id` (FK composite), `kind` retiré, plus `first_reviewed_by_account_id`, `first_reviewed_at`, `first_review_opinion`, `duplicate_of_campaign_id` ; état `campaigns.review_entry_state` (`open`, `published`, `rejected`, `withdrawn`) ; décideur ≠ premier examinateur. Une `open` par campagne ⇔ `pending_review` ; `0307` en ouvre une par `pending_review` existante (-1). *M.* : D81 (1).
- **Délais** : `sla_policies` `campaigns` (240, 480, escalade 960) ; renforcée : réglage `campaign_enhanced_review_minutes` (960), choisi à l'entrée par jointure sur le secteur ; `escalate_at` = `business_deadline(…, created_at, greatest(délai, 480 + 960))` (3 j ouvrés d'âge, RG6). *M.* : une ligne par file (PK) ; une file fictive violerait RG26.
- **Jeton** `campaign_review_token(campaign)` (invoker, sans EXECUTE) : sha256 hex de `campaign_input()`, des autres champs de saisie et listes, de l'empreinte RG85.
- **Verrou** (D81 (3), `claim_expiry_minutes`) : `open_campaign_review_entry(p_entry_id)` → sortie de `0244` plus les trois colonnes d'avis, jeton et avis au seul titulaire ; `release_campaign_review_entry`, `extend_campaign_review_claim`, `force_release_campaign_review_claim(p_entry_id, p_reason_code)` (admin) ; `queue.*`, `queue_code` `campaigns`. 42501 : inconnue, compte propre, `open` d'un compte détenu, premier examinateur en second examen.
- **RG95** : la porte écrit `duplicate_of_campaign_id` (dernière `published` ou `paused` de la marque, `campaigns.normalized_title()` égal — minuscules, non-alphanumériques → espace —, période recouvrante), jamais recalculé (-2). Détection : à la lecture (`detection.ts`).

## 2. Campagne et instantané
- Neuves : `owner_agent_id` (FK interne, patron `0008`), `current_snapshot_id` (FK composite, même campagne), `first_published_at` (RG103), `paused_at`, `pause_origin` (`brand`, `influx`), `closed_at`. Colonnes de décision de `04` → l'entrée et l'instantané ; `internal_note` non créée (sans écrivain avant le Lot 5). *M.* : une décision par examen, historique gardé.
- `campaigns_published_needs_review` : `published`, `paused` ⇒ `current_snapshot_id`.
- **`campaign_published_snapshots`** : `id`, `campaign_id`, `version` (unique par campagne), `payload` (= `campaign_creator_view()`, ≤ 32 000 octets), `content_hash` (sha256 de `payload::text`), `published_at`, `published_by_account_id`, `first_reviewed_by_account_id` (≠ publieur), `review_entry_id` (unique) ; CHECK `…_no_internal_keys` (devise, tranches, budget, référence, déclaration) ; immuable hors effacement. *M.* : TM5.6 doublée en base.

## 3. Revue renforcée
- Sensible = `reference.sectors.is_sensitive` du secteur courant, à chaque décision.
- Temps 1 : `first_review_campaign_entry(p_entry_id, p_review_token, p_opinion)` : verrou, jeton, sensible (sinon 55000 `not_enhanced_review`) ; avis favorable en **texte** de 20 à 1 000 ; verrou rendu. Défavorable = refus. *M.* : `17b` « avis motivé ».
- Temps 2 : une autre personne, admin compris (EC-L3C-4), sinon 55000 `enhanced_review_required` (CA57) ; l'entrée est masquée (liste, 42501) au premier examinateur ; aucune voie dégradée (C8).
- Correction refusée après l'avis (55000 `first_review_given`) : le second examen porte sur la version vue (-3).
- `assert_enhanced_review()` (BEFORE UPDATE, si `current_snapshot_id` change) : sensible ⇒ premier examinateur et déclaration, sinon 23514 `enhanced_review`.

## 4. Décisions
- Propriétaire **neuf `influx_campaign_review_definer`** (NOLOGIN NOINHERIT, sans membre) : file, décisions, interventions, fiche ; EXECUTE agent, admin (`aal2` dedans). *M.* : D81 (5), un propriétaire par domaine ; distinct d'`influx_campaign_definer`, sinon une porte membre atteindrait la publication.
- `publish_campaign_review_entry(p_entry_id, p_review_token, p_owner_agent_id, p_internal_comment)` → `(decided_at, sla_breached, snapshot_version, first_publication)` : verrou vivant (55P03), jeton (55000 `stale_token`), ni propre ni détenu (42501), responsable interne actif (22023 `owner_agent`), marque `published` et compte `active` (55000 `brand_not_publishable`), CA48 `applications_close_on` ≥ jour UTC (55000 `calendar_passed`), RG15 relu ; puis instantané v n+1, état, `current_snapshot_id`, `first_published_at`, `owner_agent_id`, entrée `published`.
- `reject_campaign_review_entry(p_entry_id, p_review_token, p_reason_code, p_member_message, p_internal_comment)` : motif de RG90 ; message 20 à 500 pour `illicit_content`, `other` seuls (22023) ; mêmes contrôles ; → `rejected`.
- `internal_comment`, avis : aucun droit de colonne à l'agent ; ni marque, e-mail, Brevo, registre, export.

## 5. États
| Passage | Marque | Agent (motif) | Système |
|---|---|---|---|
| → `pending_review` | `submit_own_campaign` | — | — |
| `published` → `paused` | `pause_own_campaign` | `pause_campaign` | — |
| `paused` → `published` | `resume_own_campaign` si `pause_origin = 'brand'` | `resume_campaign` | — |
| → `closed` | `close_own_campaign` | `close_campaign` | `ops.close_ended_campaigns` |
- Marque : `(p_campaign_id) → (status, changed)`, sans e-mail ; 55000 `campaign_not_pausable`, `…_resumable` (DETAIL `paused_by_influx`), `…_closable`. Agent : `(p_campaign_id, p_reason_code, p_internal_comment) → (status, intervention_id)`, compte détenu admis.
- **Reprise et invariant 1** : `paused` est déjà visible (RG3), la reprise ne revalide pas (RG8) : ce n'est pas une publication (RG5). Elle exige `current_snapshot_id`, écrit par le seul propriétaire des décisions. L3C-T3 et l'arrêt de 04 se lisent hors reprise.
- `stamp_campaign_cycle()` (BEFORE UPDATE OF status, tout écrivain) pose `paused_at`, `closed_at`, vide la pause en sortie ; CHECK de cohérence après reprise des `closed` effacées. *M.* : l'effacement de `0306` tient sans droit neuf.
- Système (E-4, `influx_maintenance_definer`, EXECUTE `influx_worker`) : `(p_run_id, p_attempt) → integer`, run quotidien `campaign_closure`, 500 par appel, jour UTC ≥ `ends_on` + `campaign_auto_close_days`, sans acteur.
- **Dépublication** (RG93, RG11) : par l'état de la marque, ni état ni colonne : filtre L3D, e-mail au Lot 5.

## 6. Interventions d'agent (RG94)
- **`campaigns.agent_interventions`** (immuable) : `id`, `campaign_id`, `advertiser_account_id`, `kind` (`created`, `corrected`, `paused`, `resumed`, `closed`), `field_code`, `old_value`, `new_value` (jsonb), `reason_code`, `internal_comment`, `agent_account_id`, `review_entry_id`, `created_at`. *M.* : aucun texte au registre (D81 (4)).
- Motifs (CHECK) : `brand_request`, `entry_error`, `non_compliant_content`, `other` (commentaire exigé) ; `created` : `brand_request` (-4).
- `create_campaign_for_brand(p_advertiser_account_id, p_title, p_campaign_type_code)` : annonceur actif, profil en tout état ; brouillon soumis par la marque (Q2).
- `correct_campaign_field(p_campaign_id, p_field_code, p_value jsonb, p_reason_code, p_internal_comment) → (intervention_id, review_token)` : `draft`, `rejected`, ou `pending_review` sous verrou sans avis ; sinon 55000 `campaign_not_correctable` (Q1). Champs : codes de `l3b/modele.md` §5 et champs facultatifs ; jamais statut, déclaration, compte ; listes en bloc ; devise : tranches vidées.
- Fiche : `open_campaign_record(p_campaign_id)` écrit `campaign.record_read`, puis lecture par l'agent.

## 7. Garde et porte
- `guard_campaign_member_write()` recréée : `influx_advertiser` inchangé ; `influx_campaign_definer` : passages marque ; `influx_campaign_review_definer` : passages d'agent, saisie en `draft`, `rejected`, `pending_review` ; `influx_maintenance_definer` : → `closed` ; `influx_privacy_definer`, rôle de migration : libres ; autre `influx_%` : 55000 `campaign_not_editable`. *M.* : L3BS-2.
- `submit_own_campaign()`, même signature : + RG15 sous `pg_advisory_xact_lock` (`published` + `paused` ≥ `campaign_live_cap` : 55000 `live_campaign_cap`, DETAIL leurs identifiants), + entrée.

## 8. Codes, e-mails, leads
- Registre : `campaign.published`, `.rejected` `{entry_id, …, late}`, `.paused`, `.closed` `{origin, reason_code, intervention_id}`. Neufs : `campaign.first_reviewed` (**`excluded_third_party`**, invariant 5), `.resumed`, `.corrected` `{intervention_id, field_code, reason_code}`, `.created_for_brand`, `.record_read` ; file seule `campaign.decision`.
- E-mails : `campaign.decision` → `brevo_transactional`, `{event_id, account_id, campaign_id, email_code, entry_id | intervention_id}`, clé `campaign.decision:<id>` (système : `campaign_id`). `email_code` : `published`, `rejected`, `paused_by_influx`, `resumed_by_influx`, `closed_by_influx`, `closed_automatically`, `corrected`, `created_for_brand`. Ni titre, texte, montant ni lien : type et date (-5).
- Leads (première publication) : `campaign.published` → `brevo_contact`, `apollo_contact`. Brevo : `CAMPAIGNS_PUBLISHED`, `LAST_CAMPAIGN_AT`, `_SECTOR`, `_CURRENCY`, `_COUNTRIES`, `_NETWORKS` (dernière publiée), `FUNNEL_STAGE` `campaign_published`. Apollo : « a publié » et date (-6).

## 9. Réglages, export, répartition
- Réglages : `campaign_enhanced_review_minutes` 960, `campaign_live_cap` 10, `campaign_auto_close_days` 30.
- Droits : agent, admin (`aal2`) lisent tout sauf avis, commentaire, fourchette ; annonceur : ses entrées (état, dates, motif, message) ; `influx_creator` : rien (TM5.6).
- Export : `reviews`, `snapshots`, `interventions`, sans agent ni commentaire ; journal (L3BS-5) : sujet `campaign`, acteur « INFLUX ». Effacement : entrée `withdrawn`, textes vidés.
- **0307** file, garde, porte ; **0308** publication ; **0309** cycle, interventions ; **0310** export, `leads.read_*`. Recherche : `0311`.
- À relire : -4 à -6 ; export, `excluded_third_party` (`expert-conformite-rgpd`, Lot 6).

## Arbitrage A2 — journal de `campaign.decision`
> `architecte`, 2026-11-15. Prime sur §8 et §9 (journal, numéros).

- **Constat** : `0111` copie `payload.email_code` (`published`…) dans `leads.transactional_sends`, dont le CHECK pointé (`0015`) refuse : e-mail parti, journal en échec, ligne reprise à 600 s, doublon évité par la seule idempotence Brevo.
- **Décision** (option 3) : une ligne `campaign.decision` se journalise sous **`campaign.decision`**, code du catalogue (`16` RG85), égal à son `event_type` et à l'étiquette Brevo ; la variante reste dans la charge et les tables de décision. Autres lignes inchangées ; ni contrainte assouplie, ni colonne, ni code émis modifié.
- **Motif** : L2 journalise le code du catalogue, égal au type d'événement, sans l'issue (`profile.decision`, `creator_profile.decision`, `verification.decision`). Option 1 : huit codes hors catalogue fermé, future FK `template_ref` (`0503`) cassée. Option 2 : trois fonctions poussées, la lecture `0310` (`e.state::text = v_code`) et le rendu de 06 à reprendre. Minimisation (D60) : le journal dit qu'un e-mail est parti, pas qu'une campagne est refusée ; conservation et export inchangés.
- **Fichiers** : `supabase/migrations/0311_leads_campaign_decision_journal.sql`, redéfinition de `leads.complete_outbox_attempt` (signature, propriétaire, droits, commentaire, `search_path` identiques ; `o.event_type` lu ; nullité toujours testée sur la charge ; même code pour `email_code` et `template_ref`). Preuve dans `apps/api/db-tests/tm1-outbox-claim.test.ts` (hors arbre de 06) : ligne `succeeded`, journal `campaign.decision`, `profile.decision` inchangé ; suite base entière (D76). Aucune donnée à reprendre.
- **Numéros** : recherche à `0312` et suivants. Écart à consigner à la clôture : fiche l. 11 (`0307` à `0311`), §9, EC-L3C-1, `21` §3, ligne `campaign.decision` de `16` (huit variantes).
- **Ligne 06 ensuite** : codes, rendu et union TS inchangés ; après le commit du fix, rejouer `tm1-brevo-connector` (cas « creation for the brand » : `succeeded`), y vérifier le journal `campaign.decision`, commiter ses seuls fichiers. 07 à 10 : sans effet.
- **`run.md`**, entre 05 et 06 : `| X1 | fix-1.md | fix | opus | high | expert-database | à faire | |` ; prompt `fix-1.md` au gabarit de `jalon-prepare` ; commit `fix(db): 0311 journal campaign decision e-mails under their catalogue code`.
- **Réversibilité** : forte, une migration suivante rétablit l'ancien corps.

## Arbitrage A3 — lecture de la file 7
> `architecte`, 2026-11-15. Prime sur §3 et §9 (lecture, numéros).

- **Constat** (07) : la troisième clause de `campaign_review_entries_internal_select` (`0307` l. 470) vaut NULL sur une `open` sans premier avis : entrée masquée à tous (liste vide, compteurs à 0, `open` en 404). L3C-T2 lit par les fonctions ; le cas l. 837 pose l'avis avant de lire.
- **Décision** : `0312` (I-4) recrée la politique, même nom, `for select to influx_agent, influx_admin` :
  `using ((select influx.has_aal2()) and advertiser_account_id is distinct from (select influx.current_account_id()) and (state <> 'open' or first_reviewed_by_account_id is distinct from (select influx.current_account_id())))`.
  `state` NOT NULL : clause jamais NULL. `open` sans avis : visible ; avec avis : masquée à son seul auteur, admin compris ; `published`, `rejected`, `withdrawn` : visibles, comme l'ouverture (`closed`). Le titulaire lit (l'avis rend le verrou, l'ouverture refuse son auteur). Sans `aal2` : rien. Compte détenu : filtre de route (EC-L3C-02-7). Postcondition par catalogue ; rollback = retour du défaut. Réversible.
- **Autres occurrences** (`0307` à `0311`) : aucune. Politiques internes et définisseuses : `is distinct from` sur `advertiser_account_id`, ou `state`, `a.status` (NOT NULL) ; fonctions : refus sur égalité (NULL n'en déclenche pas, sens voulu).
- **Test** : un cas neuf dans `campaigns-review-queue.test.ts` (L3C-T2, describe du premier examinateur) : soumise, lue par agent et admin `aal2`, pas en `aal1` ; prise, lue par le titulaire ; après l'avis, masquée à son seul auteur ; close, relue par lui. Plancher 29 → 30 (`case-floors.ts`, hunk seul : 07 y écrit). Suite base entière (D76).
- **Numéros** : recherche à `0313`. À la clôture : fiche l. 11, §9, EC-L3C-1, annexe (critère `0307` à `0312`), `21` l. 133 et 241.
- **`run.md`**, entre 06 et 07 : `| X2 | fix-2.md | fix | opus | high | expert-database | à faire | |` ; commit `fix(db): 0312 queue 7 read policy shows an open entry before its first review`.
- **07 ensuite** : attend X2 sans toucher la migration ni contourner la politique ; ses commentaires citent `0312` ; ajoute un cas « entrée fraîche listée, comptée, ouverte » ; rejoue ses deux fichiers ; commite ses seuls hunks.
