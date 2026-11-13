-- =============================================================================
-- 0301_profiles_lot2_carry_over
-- -----------------------------------------------------------------------------
-- Lot 3 / L3A, commit 05 (jalons/l3a/05.md; fiche invariants 4 to 7). Three findings of the Lot 2
-- reviews due « avant le Lot 3 », no new table, no new role:
--
--   L2GS-8  profiles.publish_creator_review_entry() refuses an account that is not `active`
--         (suspended or deleted): 55000, MESSAGE account_not_active, DETAIL profile_state (the
--         refusal apps/api already answers 409 on `entry`, creator-queues/refusals.ts: route and
--         screens unchanged). Checked right after the locks of lock_held_creator_review_entry();
--         that gate is untouched (the refusal, the release and the extension share it and stay
--         possible on such an account). influx_moderation_definer already reads
--         identity.accounts.status (0210 §5.1, policy accounts_moderation_definer_select): no grant.
--   L2CS-6  Two partial indexes `where status = 'published'` on profiles.advertiser_profiles, on the
--         two expressions profiles.advertiser_duplicate_candidates() compares:
--         profiles.normalized_brand_name(legal_name) and lower(website_domain). The function is
--         unchanged: same rows, same order.
--   L2DS-5  End-state assertion: no function owned by influx_identity_definer carries a dynamic
--         `execute` in its body (that owner holds the brand doors and the creator derivations, 03
--         P7: a future flaw in a brand door must never become a read of layer I).
--
-- RIGHTS (03 I-4, signalled): one function recreated SECURITY DEFINER (owner, search_path, REVOKE and
-- GRANT of 0244 restated and checked again); EXECUTE on profiles.normalized_brand_name(text) granted
-- to the four roles that write profiles.advertiser_profiles (EC-L3A-05-1). No audit.* object touched.
--
-- EC-L3A-05 (micro-gaps, the safest choice):
--   EC-L3A-05-1  Postgres evaluates the expression of an index with the rights of the WRITER
--                (EXECUTE checked when a row enters the partial index, i.e. a published row is
--                inserted or updated outside HOT). normalized_brand_name() is IMMUTABLE, SECURITY
--                INVOKER, reads no table: EXECUTE goes to the four roles holding INSERT or UPDATE on
--                advertiser_profiles (influx_advertiser, influx_identity_definer,
--                influx_moderation_definer, influx_privacy_definer), never PUBLIC. A role that later
--                receives a write on the table needs it too (assertion below).
--   EC-L3A-05-2  The non-active account is checked after the version token's locks and BEFORE the
--                token and the profile state: the account prevails over the version examined.
--   EC-L3A-05-3  No function owned by influx_identity_definer mentions `execute` today; the list of
--                excluded names (false positives: the word in a comment or a string) is empty.
--
-- ROLLBACK (no data written by this file): recreate publish_creator_review_entry() as in 0244; drop
-- the two indexes; revoke EXECUTE on profiles.normalized_brand_name(text) from the four writers.
-- =============================================================================

-- 1. The rights the indexes need (EC-L3A-05-1) -----------------------------------------------------

grant execute on function profiles.normalized_brand_name(text)
   to influx_advertiser, influx_identity_definer, influx_moderation_definer, influx_privacy_definer;

-- 2. L2CS-6: the duplicate lookups of RG25, RG70 by index ------------------------------------------

create index if not exists advertiser_profiles_published_brand_name_idx
  on profiles.advertiser_profiles (profiles.normalized_brand_name(legal_name))
  where status = 'published';

create index if not exists advertiser_profiles_published_domain_idx
  on profiles.advertiser_profiles (pg_catalog.lower(website_domain))
  where status = 'published';

comment on index profiles.advertiser_profiles_published_brand_name_idx is
  'L2CS-6 (0301): the brand_name branch of profiles.advertiser_duplicate_candidates(), published '
  'profiles only.';
comment on index profiles.advertiser_profiles_published_domain_idx is
  'L2CS-6 (0301): the domain branch of profiles.advertiser_duplicate_candidates(), published '
  'profiles only.';

-- 3. L2GS-8: publish_creator_review_entry(), as influx_moderation_definer (03 P7 rule 5) ------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

-- Queue 2: publish (07 RG5, RG9, RG99, RG106; modele §3 "0244"), recreated from its 0244 version
create or replace function profiles.publish_creator_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_internal_comment  text)
returns table (
  decided_at         timestamptz,
  sla_breached       boolean,
  first_publication  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_entry     record;
  v_first     boolean;
  v_rev       record;
  v_row       uuid;
  v_fields    text[] := '{}';
  v_missing   text[];
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  perform profiles.check_review_internal_comment(p_internal_comment);
  -- the storefront and the entry locked, the caller's live claim (07 RG94; fiche « Arrêt si »)
  select * into v_entry from profiles.lock_held_creator_review_entry(p_entry_id, v_caller);

  -- L2GS-8 (0301): never a publication of a suspended or deleted account (EC-L3A-05-2)
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_not_active'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  -- file.md A3: the version examined
  if p_review_token is null
     or p_review_token is distinct from profiles.creator_review_token(v_entry.account_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2C-07-6: a submission on a pending_review profile, a revision on a published one
  if not ((v_entry.kind = 'submission' and v_entry.profile_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_entry.profile_status = 'published')) then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  select p.published_at is null into v_first
    from profiles.creator_public_profiles p
   where p.account_id = v_entry.account_id;

  -- 07 RG9: every pending value applied, its revision approved, in this transaction; the constraints
  -- of the column and the guard of the URL apply now (modele §3)
  for v_rev in
    select r.id, r.field_code, r.row_key, r.proposed_value
      from profiles.creator_field_revisions r
     where r.creator_review_entry_id = p_entry_id and r.status = 'pending_review'
     order by r.field_code, r.row_key
  loop
    v_row := case when v_rev.row_key is null then null else v_rev.row_key::uuid end;
    case v_rev.field_code
      when 'creator.headline' then
        update profiles.creator_public_profiles p
           set headline = v_rev.proposed_value #>> '{}'
         where p.account_id = v_entry.account_id;
      when 'creator.bio' then
        update profiles.creator_public_profiles p
           set bio = v_rev.proposed_value #>> '{}'
         where p.account_id = v_entry.account_id;
      when 'creator.network_line' then
        -- modele point 6: the line added to a published profile is listed
        update profiles.creator_public_networks c
           set listed_at = coalesce(c.listed_at, pg_catalog.now())
         where c.social_account_id = v_row and c.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.network_handle' then
        -- EC-L2G-04-5: a handle under an active « Compte vérifié » belongs to queue 6
        if exists (select 1 from verification.badges b
                    where b.account_id = v_entry.account_id and b.social_account_id = v_row
                      and b.level = 'account_verified' and b.state = 'active') then
          raise exception 'verified_handle'
            using errcode = 'object_not_in_prerequisite_state', detail = 'creator.network_handle';
        end if;
        update profiles.creator_social_accounts n
           set handle = v_rev.proposed_value #>> '{}'
         where n.id = v_row and n.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.network_url' then
        update profiles.creator_social_accounts n
           set profile_url = v_rev.proposed_value #>> '{}'
         where n.id = v_row and n.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.portfolio_caption' then
        update profiles.portfolio_items i
           set caption              = v_rev.proposed_value ->> 'caption',
               brand_declaration_id = (v_rev.proposed_value ->> 'brand_declaration_id')::uuid
         where i.id = v_row and i.account_id = v_entry.account_id and i.state = 'approved';
        if not found then
          -- EC-L2G-04-4: the visual left meanwhile, nothing to approve
          update profiles.creator_field_revisions r
             set status = 'withdrawn', closed_at = pg_catalog.now()
           where r.id = v_rev.id;
          continue;
        end if;
      else
        raise exception 'no application for the field %', v_rev.field_code
          using errcode = 'invalid_parameter_value';
    end case;
    update profiles.creator_field_revisions r
       set status = 'approved', closed_at = pg_catalog.now()
     where r.id = v_rev.id;
    v_fields := v_fields || v_rev.field_code;
  end loop;

  if v_entry.kind = 'submission' then
    -- 07 RG4, RG16, 08 RG16 (EC-L2G-04-3): the required fields of the version published;
    -- portfolio_insufficient covers a portfolio fallen under 3 (modele §3)
    v_missing := profiles.creator_missing_required_fields(
                   profiles.creator_profile_input(v_entry.account_id));
    if pg_catalog.cardinality(v_missing) > 0 then
      raise exception 'required field missing: %', v_missing[1]
        using errcode = 'check_violation', detail = v_missing[1];
    end if;
    -- modele point 6: the lines of the profile published are listed (layer A)
    update profiles.creator_public_networks c
       set listed_at = pg_catalog.now()
     where c.account_id = v_entry.account_id and c.listed_at is null;
  end if;

  update profiles.creator_public_profiles p
     set status = 'published',
         published_at = coalesce(p.published_at, pg_catalog.now())
   where p.account_id = v_entry.account_id;

  update profiles.creator_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- RG86: the score of the version published
  perform profiles.store_creator_completeness(v_entry.account_id);

  -- 07 RG99: the decision e-mail, written by the worker (D69); its code in the payload (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'creator_profile.decision', 'brevo_transactional',
          'account:' || v_entry.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_entry.account_id,
                                        'entry_id', p_entry_id,
                                        'email_code', 'creator_profile.decision'),
          'creator_profile.decision:' || p_entry_id::text);
  -- 07 RG106: profile.completed once per account, lead.updated afterwards; ids only (05 RG74)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_lead, case when v_first then 'profile.completed' else 'lead.updated' end, d.destination,
         'account:' || v_entry.account_id::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_entry.account_id),
         case when v_first then 'profile.completed:' || v_entry.account_id::text
              else 'lead.updated:' || v_lead::text end
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- The register, in the transaction of the fact; last (04 §7.2). Codes and ids only (D60)
  perform audit.append('creator_profile.published', 'creator_profile', v_entry.account_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'fields', pg_catalog.to_jsonb(v_fields),
                                                     'late', v_late));
  return query select v_decided, v_late, v_first;
end
$$;

comment on function profiles.publish_creator_review_entry(uuid, text, text) is
  '07 RG4, RG5, RG9, RG95, RG99, RG106; 15 C6, C8; file.md A2, A3; modele §3 "0244" (0244, 0301): the '
  'holder of a live claim publishes an entry of queue 2. The storefront locked first, then the '
  'entry; an account not active refused (L2GS-8); the version token recomputed and compared; in ONE '
  'transaction: each pending revision applied (headline, bio, the handle and the URL of a line with '
  'their constraints and the guard of the URL, a line listed, the caption of an approved visual) and '
  'approved; for a submission the required fields recontrolled (23514, DETAIL the first code '
  'missing) and every line listed; status published, published_at written once; the entry published '
  '(decider, instant, internal comment); the score stored; creator_profile.decision to '
  'brevo_transactional (key creator_profile.decision:<entry>, payload {event_id, account_id, '
  'entry_id, email_code}); profile.completed to brevo_contact and apollo_contact at the first '
  'publication (key profile.completed:<account>), lead.updated otherwise; the line '
  'creator_profile.published {entry_id, kind, fields, late}. Returns (decided_at, sla_breached, '
  'first_publication). 22023 internal_comment; 55000 account_not_active (DETAIL profile_state), '
  'stale_token, profile_state, verified_handle (EC-L2G-04-5); then the refusals of '
  'lock_held_creator_review_entry(). SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 03 P7 rule 5: the rights of 0244, restated by their owner (create or replace keeps them)
revoke all on function profiles.publish_creator_review_entry(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function profiles.publish_creator_review_entry(uuid, text, text)
   to influx_agent, influx_admin;

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 4. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_fn   regprocedure := 'profiles.publish_creator_review_entry(uuid, text, text)'::regprocedure;
  v_bad  text;
begin
  -- the assertion of 0244 for the recreated function: its owner, SECURITY DEFINER, an empty
  -- search_path, EXECUTE for influx_agent and influx_admin only
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = v_fn)
       <> 'influx_moderation_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn)
     or (select proconfig from pg_catalog.pg_proc where oid = v_fn)
          is distinct from array['search_path=""'] then
    raise exception '% must be owned by influx_moderation_definer, SECURITY DEFINER, empty search_path',
      v_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = v_fn
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;
  -- NON REVERSIBLE (0244): neither the advertiser nor the owner of the brand doors executes it
  if pg_catalog.has_function_privilege('influx_advertiser', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_identity_definer', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator_profile_definer', v_fn, 'EXECUTE') then
    raise exception 'EXECUTE on % by a member role or a member door owner', v_fn;
  end if;
  -- the owner reads the state of the account and only reads identity.accounts
  if not pg_catalog.has_column_privilege('influx_moderation_definer', 'identity.accounts', 'status',
                                         'SELECT')
     or pg_catalog.has_any_column_privilege('influx_moderation_definer', 'identity.accounts',
                                            'UPDATE') then
    raise exception 'influx_moderation_definer must read identity.accounts.status, and only read it';
  end if;
  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_moderation_definer'::regrole
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE') then
    raise exception 'influx_moderation_definer left with a member or CREATE on profiles';
  end if;

  -- L2CS-6: the two indexes, partial on published
  if (select pg_catalog.count(*) from pg_catalog.pg_indexes i
       where i.schemaname = 'profiles' and i.tablename = 'advertiser_profiles'
         and i.indexname in ('advertiser_profiles_published_brand_name_idx',
                             'advertiser_profiles_published_domain_idx')
         and i.indexdef like '%WHERE (status = ''published''::%') <> 2 then
    raise exception 'L2CS-6: the two partial indexes of advertiser_profiles are missing';
  end if;
  -- EC-L3A-05-1: every role writing advertiser_profiles evaluates normalized_brand_name(), never PUBLIC
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, 'profiles.advertiser_profiles', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'profiles.advertiser_profiles', 'UPDATE'))
     and not pg_catalog.has_function_privilege(r.oid, 'profiles.normalized_brand_name(text)',
                                               'EXECUTE');
  if v_bad is not null then
    raise exception 'writers of advertiser_profiles without EXECUTE on normalized_brand_name: %', v_bad;
  end if;
  if exists (select 1
               from pg_catalog.pg_proc p,
                    pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
              where p.oid = 'profiles.normalized_brand_name(text)'::regprocedure
                and a.privilege_type = 'EXECUTE' and a.grantee = 0) then
    raise exception 'profiles.normalized_brand_name(text) executable by PUBLIC';
  end if;

  -- L2DS-5: no dynamic SQL in a function owned by influx_identity_definer. A false positive (the
  -- word in a comment or a string) is excluded by its signature below, with its reason; none today
  -- (EC-L3A-05-3)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = 'influx_identity_definer'::regrole
     and p.prosrc ~* '\mexecute\M'
     and p.oid::regprocedure::text <> all (array[]::text[]);
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic execute in a function owned by influx_identity_definer: %', v_bad;
  end if;
end
$$;
