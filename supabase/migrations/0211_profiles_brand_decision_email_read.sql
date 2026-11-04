-- =============================================================================
-- 0211_profiles_brand_decision_email_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 09a (jalons/l2c/09a.md; fiche invariants 8, 10, 15; 06 RG66, RG69; 16 l. 794,
-- D69). Inserted before 09 (the founder's decision): the queue line of the brand decision e-mail
-- names its code, and the worker gets its own read of the decision. No rendering, no connector, no
-- TypeScript of the worker (09).
--
--   profiles.publish_advertiser_review_entry(), reject_advertiser_review_entry()   recreated by their
--         owner influx_moderation_definer from their 0210 version, ONE change: the payload of
--         profile.decision is {event_id, account_id, entry_id, email_code = 'profile.decision'}.
--         0111 (complete_outbox_attempt §3) refuses the success of a transactional line that names
--         no e-mail code; the key profile.decision:<entry> is unchanged; complete_outbox_attempt is
--         not touched. Signatures, owner, EXECUTE (agent, admin) and every other line kept.
--   leads.read_brevo_profile_decision(outbox, worker)   E-3, modelled on read_brevo_subject() (0112)
--         and privacy.read_erasure_notification_subject() (0150): on a profile.decision line of
--         brevo_transactional in processing for THIS worker only, the decision of the entry named
--         by the payload (published | rejected), its reason code, the agent's message to the brand
--         (06 RG66, `other` only) and the account's language. Never the internal comment, the
--         agent, the claim nor the forced release. No row when the account is erased (status
--         deleted, the texts emptied by 0207), when the entry is not the line's account's or not
--         decided. SECURITY DEFINER owned by influx_leads_definer, EXECUTE for influx_worker ONLY.
--   influx_leads_definer   SELECT (id, account_id, state, rejection_reason_code, member_message) on
--         profiles.advertiser_review_entries, its policy limited to the decided entries of an
--         account not erased; no other table of profiles (the account's language:
--         identity.accounts.preferred_language, granted since 0111).
--
-- EC-L2C-09a (micro-gaps, the safest choice):
--   EC-L2C-09a-1  0211 is the next free number (ls supabase/migrations).
--   EC-L2C-09a-2  a line of another event type, or of another destination, is 22023 (the read
--                 serves the decision e-mail only); a payload without a well-formed entry_id gives
--                 no row, as an unknown subject does in read_brevo_subject().
--   EC-L2C-09a-3  the erased account is tested twice: by the function (status <> 'deleted') and by
--                 the policy of the owner (a second line, 03 P7 rule 3).
--   EC-L2C-09a-4  tm1-outbox-claim.test.ts lists the functions influx_worker may execute: the new
--                 read is added to that inventory (the list is exhaustive by construction).
--
-- ROLLBACK (before any profile.decision line is processed): drop function
-- leads.read_brevo_profile_decision(bigint, text); drop policy
-- advertiser_review_entries_leads_definer_select on profiles.advertiser_review_entries; revoke
-- select (id, account_id, state, rejection_reason_code, member_message) on
-- profiles.advertiser_review_entries from influx_leads_definer; recreate the two decision functions
-- as in 0210 (as influx_moderation_definer).
-- =============================================================================

-- 1. The two decisions, recreated by their owner (03 P7 rule 5) ------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

-- 1.1 Publish (0210 §7.6; 06 RG6, RG9, RG65, RG69, RG78) -------------------------------------------
create or replace function profiles.publish_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_internal_comment  text
)
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
  v_account   uuid;
  v_status    text;
  v_first     boolean;
  v_entry     record;
  v_rev       record;
  v_logo      uuid;
  v_text      text;
  v_fields    text[] := '{}';
  v_values    jsonb;
  v_missing   text[];
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row FIRST, as every member door of the account (0209), then the entry: a member
  -- write waits for this decision, or this decision reads it (file.md A3).
  select p.status::text, p.first_published_at is null
    into v_status, v_first
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 06 CA18: no decision without a live claim of the caller
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  -- file.md A3, L2BS-1: the version examined
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2C-07-6
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  -- RG9: every pending value applied, its revision approved, in this transaction; the constraints of
  -- the column apply now (file.md A4)
  for v_rev in
    select r.id, r.field_code, r.proposed_value
      from profiles.profile_field_revisions r
     where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review'
     order by r.field_code
  loop
    if v_rev.field_code = 'advertiser.logo' then
      v_logo := (v_rev.proposed_value ->> 'logo_object_id')::uuid;
      if v_logo is not null then
        perform 1 from profiles.brand_logo_objects l
         where l.id = v_logo and l.account_id = v_account and l.state = 'in_review';
        if not found then
          raise exception 'the proposed logo is no longer under review'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      end if;
      -- one active logo per brand: the previous one leaves first
      update profiles.brand_logo_objects l
         set state = 'purging', purge_requested_at = pg_catalog.now()
       where l.account_id = v_account and l.state = 'active';
      if v_logo is not null then
        update profiles.brand_logo_objects l
           set state = 'active', activated_at = pg_catalog.now()
         where l.id = v_logo;
      end if;
    else
      v_text := v_rev.proposed_value #>> '{}';
      case v_rev.field_code
        when 'advertiser.brand_name' then
          update profiles.advertiser_profiles p set legal_name = v_text where p.account_id = v_account;
        when 'advertiser.presentation' then
          update profiles.advertiser_profiles p set presentation = v_text where p.account_id = v_account;
        when 'advertiser.website_domain' then
          update profiles.advertiser_profiles p set website_domain = v_text where p.account_id = v_account;
        when 'advertiser.contact_role' then
          update profiles.advertiser_profiles p set contact_role = v_text where p.account_id = v_account;
        when 'advertiser.primary_sector' then
          update profiles.advertiser_profiles p set primary_sector_code = v_text
           where p.account_id = v_account;
        else
          raise exception 'no application for the field %', v_rev.field_code
            using errcode = 'invalid_parameter_value';
      end case;
    end if;
    update profiles.profile_field_revisions r
       set status = 'approved', closed_at = pg_catalog.now()
     where r.id = v_rev.id;
    v_fields := v_fields || v_rev.field_code;
  end loop;

  -- 06 RG5, L2BS-1: the required fields of the version published (0203)
  select pg_catalog.jsonb_build_object(
           'legal_name',         p.legal_name,
           'primary_sector',     p.primary_sector_code,
           'company_size',       p.company_size_band,
           'country',            a.country_code,
           'target_markets',     (select pg_catalog.jsonb_agg(m.country_code)
                                    from profiles.advertiser_target_markets m
                                   where m.account_id = p.account_id),
           'working_languages',  (select pg_catalog.jsonb_agg(w.language_code)
                                    from profiles.advertiser_working_languages w
                                   where w.account_id = p.account_id),
           'presentation',       p.presentation,
           'topics',             (select pg_catalog.jsonb_agg(t.topic_code)
                                    from profiles.advertiser_topics t
                                   where t.account_id = p.account_id),
           'networks',           (select pg_catalog.jsonb_agg(n.network_code)
                                    from profiles.advertiser_networks n
                                   where n.account_id = p.account_id),
           'formats',            (select pg_catalog.jsonb_agg(f.format_code)
                                    from profiles.advertiser_formats f
                                   where f.account_id = p.account_id),
           'audience_countries', (select pg_catalog.jsonb_agg(c.country_code)
                                    from profiles.advertiser_audience_countries c
                                   where c.account_id = p.account_id),
           'contact_role',       p.contact_role)
    into v_values
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = v_account;
  v_missing := profiles.advertiser_missing_required_fields(v_values);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required field missing: %', v_missing[1]
      using errcode = 'check_violation', detail = v_missing[1];
  end if;

  update profiles.advertiser_profiles p
     set status = 'published',
         first_published_at = coalesce(p.first_published_at, pg_catalog.now())
   where p.account_id = v_account;

  update profiles.advertiser_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- 06 RG69: the decision e-mail, in the brand's language, rendered by the worker (09, D69); its
  -- code in the payload, without which 0111 refuses any success of a transactional line (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id,
                                        'email_code', 'profile.decision'),
          'profile.decision:' || p_entry_id::text);
  -- 06 RG78: profile.completed once per account, lead.updated afterwards; ids only (05 RG74)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_lead, case when v_first then 'profile.completed' else 'lead.updated' end, d.destination,
         'account:' || v_account::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_account),
         case when v_first then 'profile.completed:' || v_account::text
              else 'lead.updated:' || v_lead::text end
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- The register, in the transaction of the fact; last (04 §7.2)
  perform audit.append('profile.published', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'fields', pg_catalog.to_jsonb(v_fields),
                                                     'late', v_late));
  return query select v_decided, v_late, v_first;
end
$$;

comment on function profiles.publish_advertiser_review_entry(uuid, text, text) is
  '06 RG6, RG9, RG65, RG69, RG78; 15 C6, C8; file.md A2, A3: the holder of a live claim publishes an '
  'entry of queue 1. The profile row locked first, then the entry; the version token recomputed and '
  'compared; in ONE transaction: each pending revision applied to its column (logo: the in_review '
  'object active, the previous active one purging) and approved, the required fields recontrolled, '
  'status published, first_published_at written once, the entry published (decider, instant, '
  'internal comment), profile.decision to brevo_transactional (key profile.decision:<entry>, '
  'payload {event_id, account_id, entry_id, email_code = profile.decision}, 0211), '
  'profile.completed to brevo_contact and apollo_contact at the first publication (key '
  'profile.completed:<account>), lead.updated otherwise, the line profile.published {entry_id, kind, '
  'fields, late}. Returns (decided_at, sla_breached, first_publication). 55P03 no live claim of the '
  'caller (DETAIL holder or none), 55000 entry_closed, stale_token or profile_state, 23514 a required '
  'field missing (DETAIL its code) or a column constraint, 22023 internal_comment, 42501 as the '
  'opening. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and '
  'influx_admin.';

-- 1.2 Reject (0210 §7.7; 06 RG10, RG65, RG66, RG68, RG69) ------------------------------------------
create or replace function profiles.reject_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text
)
returns table (
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_requires  boolean;
  v_account   uuid;
  v_status    text;
  v_entry     record;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
begin
  -- RG65, RG66: a typed reason of the closed list, never a refusal without one
  select r.requires_member_message into v_requires
    from profiles.advertiser_rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'a typed reason of profiles.advertiser_rejection_reasons is required'
      using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- file.md A6: the message to the brand for `other` only, 20 to 500 printable characters
  if v_requires then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'this reason requires a message of 20 to 500 printable characters'
        using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'this reason takes no message' using errcode = 'invalid_parameter_value',
      detail = 'member_message';
  end if;
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row first, then the entry (same order as the publication and the member doors)
  select p.status::text into v_status
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  update profiles.profile_field_revisions r
     set status = 'rejected', closed_at = pg_catalog.now()
   where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review';
  -- the logo proposed goes to purge, the active one stays served
  update profiles.brand_logo_objects l
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where l.account_id = v_account and l.state = 'in_review';
  -- RG10: a refused submission goes back to the brand; a refused revision leaves it published (A2)
  if v_entry.kind = 'submission' then
    update profiles.advertiser_profiles p set status = 'rejected' where p.account_id = v_account;
  end if;

  update profiles.advertiser_review_entries e
     set state = 'rejected', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         rejection_reason_code = p_reason_code, member_message = p_member_message,
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- 06 RG69: the decision e-mail, its code in the payload (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id,
                                        'email_code', 'profile.decision'),
          'profile.decision:' || p_entry_id::text);

  perform audit.append('profile.rejected', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.reject_advertiser_review_entry(uuid, text, text, text, text) is
  '06 RG10, RG65, RG66, RG68, RG69; 15 C6, C8; file.md A2, A3, A6: the holder of a live claim refuses '
  'an entry of queue 1 with a typed reason of profiles.advertiser_rejection_reasons; the message to '
  'the brand (20 to 500 characters) for a reason that requires it only (other); an internal comment '
  'of 1 000 characters at most, never sent. Same locks and token as the publication; in ONE '
  'transaction: the pending revisions rejected, the in_review logo purging, a submission back to '
  'rejected (a revision leaves the profile published), the entry rejected, profile.decision to '
  'brevo_transactional (email_code = profile.decision, 0211), the line profile.rejected {entry_id, '
  'kind, reason_code, late}. Returns '
  '(decided_at, sla_breached). 22023 reason, member_message or internal_comment, then the refusals '
  'of the publication. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent '
  'and influx_admin.';

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 2. What the read reads (03 P7: column by column, with its policy) --------------------------------
-- profiles.advertiser_review_entries is FORCE ROW LEVEL SECURITY (0207): the right comes with its
-- policy TO the owner. identity.accounts (id, status, preferred_language) and its policy
-- accounts_leads_definer_select exist since 0111; USAGE on profiles since 0113.

grant select (id, account_id, state, rejection_reason_code, member_message)
   on profiles.advertiser_review_entries to influx_leads_definer;

drop policy if exists advertiser_review_entries_leads_definer_select
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_leads_definer_select
  on profiles.advertiser_review_entries
  for select to influx_leads_definer
  using (state in ('published', 'rejected')
         and exists (select 1 from identity.accounts a
                      where a.id = advertiser_review_entries.account_id
                        and a.status <> 'deleted'));

-- 3. The read of the decision e-mail (E-3) ----------------------------------------------------------

create or replace function leads.read_brevo_profile_decision(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  decision            text,
  reason_code         text,
  member_message      text,
  preferred_language  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  v_entry    uuid;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the decision is read for the e-mail about to be
  -- sent, never for a line of another instance or one taken back.
  select o.destination, o.event_type, o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination <> 'brevo_transactional' or v_line.event_type <> 'profile.decision' then
    raise exception 'a profile.decision line of brevo_transactional only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, the entry from its payload, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or (v_line.payload ->> 'entry_id') is null
     or (v_line.payload ->> 'entry_id') !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;
  v_entry := (v_line.payload ->> 'entry_id')::uuid;

  return query
  select e.state::text,
         e.rejection_reason_code,
         e.member_message,
         a.preferred_language::text
    from profiles.advertiser_review_entries e
    join identity.accounts a on a.id = e.account_id
   where e.id = v_entry
     and e.account_id = v_account
     and e.state in ('published', 'rejected')
     and a.status <> 'deleted';
end
$$;

comment on function leads.read_brevo_profile_decision(bigint, text) is
  'E-3 read of the brand decision e-mail (06 RG66, RG69; 16 l. 794; D69; 0211), on a '
  'profile.decision line of brevo_transactional in processing for p_worker only (55000 otherwise; '
  '22023 for another event type or destination): the decision of the entry named by the payload '
  '(published | rejected), its reason code, the message of the agent to the brand (other only) and '
  'the account''s UI language. Never the internal comment, the agent, the claim nor the forced '
  'release. No row for an entry that is not the line''s account''s, not decided, or of an erased '
  'account. SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

revoke all on function leads.read_brevo_profile_decision(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_profile_decision(bigint, text) to influx_worker;

-- Hand the function to influx_leads_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_brevo_profile_decision(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 4. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('profiles.publish_advertiser_review_entry(uuid, text, text)', 'influx_moderation_definer',
        array['influx_agent', 'influx_admin']),
      ('profiles.reject_advertiser_review_entry(uuid, text, text, text, text)',
        'influx_moderation_definer', array['influx_agent', 'influx_admin']),
      ('leads.read_brevo_profile_decision(bigint, text)', 'influx_leads_definer',
        array['influx_worker'])
    ) as t (fn, owner, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> v_def.owner
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by %, empty search_path', v_fn, v_def.owner;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- the read reads the decision, never the internal comment, the agent, the claim nor the release
  select string_agg(c.attname, ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid = 'profiles.advertiser_review_entries'::regclass
     and c.attnum > 0 and not c.attisdropped
     and c.attname not in ('id', 'account_id', 'state', 'rejection_reason_code', 'member_message')
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches advertiser_review_entries.%', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_review_entries',
                                         'INSERT, UPDATE') then
    raise exception 'influx_leads_definer writes profiles.advertiser_review_entries';
  end if;

  -- influx_worker still holds no right on the entries: the read goes through the function (03 P7)
  if pg_catalog.has_any_column_privilege('influx_worker', 'profiles.advertiser_review_entries',
                                         'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_worker holds a right on profiles.advertiser_review_entries';
  end if;

  -- no usable member left on the owners (C-9: the ADMIN-only migration role), no CREATE kept
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_leads_definer', 'influx_moderation_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE') then
    raise exception 'a function owner left with CREATE on its schema';
  end if;
end
$$;
