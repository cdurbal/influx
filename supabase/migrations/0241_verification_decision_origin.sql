-- =============================================================================
-- 0241_verification_decision_origin
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, fix-3 (jalons/l2f/fix-3.md; L2FS-1 of l2f/revue-constats-securite.md l. 11, which
-- prevails; l2f/modele.md §4 « Repris : granted (+ channel, agent_opened, responsible_agent) »;
-- l2f-fiche.md invariants 9, 12, 17; decisions-detail.md D83 Q3, Q4). D83 Q4 (the responsible agent
-- may validate his own client) is accepted under a second look a posteriori (Q3), which reads the
-- register. 0234 wrote the origin of the decision on the A-bis grant only; the two other grants and
-- the refusals now write it too, read at the decision, so that the second look finds every decision
-- given on a request opened by an agent or by the agent who holds the account.
--
-- 1. verification.grant_account_verified() replaced as in 0228 §2, plus: the origin read once the
--    request is locked; verification.granted {level, badge_id, late, channel 'network',
--    agent_opened, responsible_agent}; the refusal handle_already_verified writes
--    verification.rejected {level, reason_code, late, channel 'network', agent_opened,
--    responsible_agent}.
-- 2. verification.grant_brand_verified() replaced as in 0224 §6.4, plus: verification.granted
--    {level, badge_id, late, channel (p_observed_channel: dns_txt or web_page), agent_opened,
--    responsible_agent}.
-- 3. verification.reject_request() replaced as in 0224 §6.5, plus: verification.rejected and
--    verification.closed {level, reason_code, late, agent_opened, responsible_agent}.
--
-- agent_opened      = the request's opened_by is 'agent' (0234, frozen once written).
-- responsible_agent = the account's owner_agent_id is the caller, read at the decision;
--                     coalesce(…, false) (an account nobody holds).
-- Only codes and booleans: no handle, domain, address nor comment enters the register (D60, RG99;
-- fiche invariant 12).
--
-- Owners, search_path, signatures, callers and rights unchanged (influx_verification_definer,
-- EXECUTE influx_agent and influx_admin); no new right: the owner already reads
-- identity.accounts.owner_agent_id and verification_requests.opened_by (0234 §7.5).
--
-- Not here: grant_audience_verified() and grant_brand_verified_by_login() (unchanged), the routes,
-- the screens, the indicator of the second look (L2FS-2, before production; Q3, Lot 6bis).
--
-- ROLLBACK (no data is changed; the register lines already written keep their keys): restore the
-- bodies and comments of verification.grant_account_verified() from 0228 §2, and of
-- verification.grant_brand_verified() and verification.reject_request() from 0224 §6.4, §6.5 (as
-- influx_verification_definer, rights unchanged).
-- =============================================================================

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
set role influx_verification_definer;

-- 1. Grant « Compte vérifié » (0228 §2, plus the origin of the decision) -----------------------------

create or replace function verification.grant_account_verified(
  p_request_id                     uuid,
  p_review_token                   text,
  p_observed_code                  text,
  p_observed_handle                text,
  p_observed_platform_account_ref  text,
  p_internal_comment               text)
returns table (
  outcome       text,
  badge_id      uuid,
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
  v_caller   uuid := verification.require_agent(false);
  v_handle   text := pg_catalog.btrim(p_observed_handle);
  v_ref      text := nullif(pg_catalog.btrim(p_observed_platform_account_ref), '');
  v_entry    record;
  v_code     record;
  v_declared text;
  v_origin   record;
  v_winner   record;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  if v_ref is not null and (pg_catalog.char_length(v_ref) > 100 or v_ref ~ '[[:cntrl:]]') then
    raise exception 'observed_platform_account_ref'
      using errcode = 'invalid_parameter_value', detail = 'observed_platform_account_ref';
  end if;

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'account_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  if p_review_token is null
     or p_review_token is distinct from verification.request_review_token(p_request_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2E-08-5, edge case l. 811: a suspended account is closed by the agent, never granted
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;

  -- RG25, CA13: the code typed by the agent, compared with the live code (EC-L2E-08-4)
  select c.id, c.code into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'network' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;

  -- L2ES-2 (0228): the handle read on line is the handle the creator declared on the line
  select l.handle into v_declared
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if verification.normalize_handle(v_declared) is null
     or verification.normalize_handle(v_declared) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;

  update verification.ownership_codes c
     set observed_by_account_id        = v_caller,
         observed_at                   = pg_catalog.now(),
         observed_handle               = v_handle,
         observed_platform_account_ref = v_ref
   where c.id = v_code.id;

  -- L2FS-1 (0241): the origin of the request and the caller's holding of the account, at the decision
  select r.opened_by = 'agent' as agent_opened,
         coalesce(a.owner_agent_id = v_caller, false) as responsible_agent
    into v_origin
    from verification.verification_requests r
    join identity.accounts a on a.id = r.account_id
   where r.id = p_request_id;

  -- edge case l. 800 (EC-L2E-08-2, -16): the first finding wins; the second is refused, both escalated
  select b.request_id, b.account_id into v_winner
    from verification.badges b
   where b.account_id <> v_entry.account_id
     and b.network_code = v_entry.network_code
     and b.level = 'account_verified'
     and b.state in ('active', 'to_refresh', 'to_reconfirm')
     and (verification.normalize_handle(b.observed_handle_at_decision)
            = verification.normalize_handle(v_handle)
          or (v_ref is not null and b.observed_platform_account_ref = v_ref))
   order by b.granted_at, b.id
   limit 1;
  if found then
    update verification.verification_requests r
       set status                = 'rejected',
           decided_by_account_id = v_caller,
           decided_at            = pg_catalog.now(),
           closed_at             = pg_catalog.now(),
           rejection_reason_code = 'ownership_not_proven',
           internal_comment      = p_internal_comment,
           escalated_at          = pg_catalog.now()
     where r.id = p_request_id
    returning r.decided_at, r.sla_breached into v_decided, v_late;
    update verification.verification_requests r
       set escalated_at = coalesce(r.escalated_at, pg_catalog.now())
     where r.id = v_winner.request_id;

    perform verification.queue_decision(p_request_id, v_entry.account_id, false);
    perform audit.append('verification.rejected', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'late', v_late,
                                                       'channel', 'network',
                                                       'agent_opened', v_origin.agent_opened,
                                                       'responsible_agent', v_origin.responsible_agent));
    perform audit.append('verification.escalated', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'cause', 'handle_already_verified'));
    perform audit.append('verification.escalated', 'verification_request', v_winner.request_id,
                         pg_catalog.jsonb_build_object('level', 'account_verified',
                                                       'cause', 'handle_already_verified'));
    return query select 'handle_already_verified'::text, null::uuid, v_decided, v_late;
    return;
  end if;

  -- EC-L2E-14: a holding badge of the line (to_reconfirm) is replaced, never doubled
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'account_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- RG30, EC-L2E-05-8: the ownership of an account has no expiry
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_handle_at_decision, observed_platform_account_ref)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_request_id,
          'account_verified', v_caller, v_decided, 'public_profile', v_handle, v_ref)
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late,
                                                     'channel', 'network',
                                                     'agent_opened', v_origin.agent_opened,
                                                     'responsible_agent', v_origin.responsible_agent));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_account_verified(uuid, text, text, text, text, text) is
  '08 RG25, RG30, RG45, RG47, RG51, CA13, CA14, edge case l. 800 (0224, 0228, 0241): the holder of a '
  'live claim grants « Compte vérifié »: the code he read on line compared with the live code of the '
  'request (case and spaces ignored), the handle he typed compared with the handle DECLARED on the '
  'line through verification.normalize_handle() (L2ES-2), then recorded (with the stable reference '
  'when shown) with his identity and the instant on the code. A holding account badge of ANOTHER '
  'account on that handle: the request rejected ownership_not_proven, both requests escalated, '
  'outcome handle_already_verified (EC-L2E-08-2), verification.rejected {level, reason_code, late, '
  'channel, agent_opened, responsible_agent}. Otherwise the request approved, a badge active without '
  'expiry (a holding one replaced), verification.decision and lead.updated queued, '
  'verification.granted {level, badge_id, late, channel (network), agent_opened (the request opened '
  'by an agent), responsible_agent (the caller holds the account, at the decision)} (L2FS-1, 0241). '
  'Returns (outcome, badge_id, decided_at, sla_breached). 22023 observed_handle, '
  'observed_platform_account_ref, internal_comment, level, code_mismatch or observed_handle_mismatch '
  '(another handle, or a line without one: nothing written); 55000 stale_token or '
  'account_unavailable; then the refusals of verification.lock_held_request(). SECURITY DEFINER owned '
  'by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 2. Grant « Marque vérifiée » (0224 §6.4, plus the origin of the decision) --------------------------

create or replace function verification.grant_brand_verified(
  p_request_id          uuid,
  p_review_token        text,
  p_observed_code       text,
  p_observed_domain     text,
  p_observed_channel    text,
  p_registry_source_id  uuid,
  p_internal_comment    text)
returns table (
  outcome       text,
  badge_id      uuid,
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
  v_caller   uuid := verification.require_agent(false);
  v_domain   text := pg_catalog.lower(pg_catalog.rtrim(pg_catalog.btrim(p_observed_domain), '.'));
  v_entry    record;
  v_brand    record;
  v_code     record;
  v_origin   record;
  v_months   integer;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if p_observed_channel is null or p_observed_channel not in ('dns_txt', 'web_page') then
    raise exception 'observed_channel' using errcode = 'invalid_parameter_value', detail = 'observed_channel';
  end if;
  if v_domain is null or pg_catalog.char_length(v_domain) > 100
     or v_domain !~ '^([[:alnum:]]([[:alnum:]-]{0,61}[[:alnum:]])?\.)+[[:alnum:]][[:alnum:]-]{0,61}[[:alnum:]]$' then
    raise exception 'observed_domain' using errcode = 'invalid_parameter_value', detail = 'observed_domain';
  end if;

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'brand_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select p.website_domain, d.registration_country_code, d.account_id is not null as has_details,
         verification.request_review_token(p_request_id) as token
    into v_brand
    from profiles.advertiser_profiles p
    left join profiles.advertiser_internal_details d on d.account_id = p.account_id
   where p.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_brand.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  if v_brand.website_domain is null then
    raise exception 'website_domain_required'
      using errcode = 'check_violation', detail = 'website_domain_required';
  end if;
  if not v_brand.has_details then
    raise exception 'internal_details_required'
      using errcode = 'check_violation', detail = 'internal_details_required';
  end if;
  -- EC-L2E-08-9: the code is found on the brand's own domain, or one of its subdomains
  if v_domain <> v_brand.website_domain
     and pg_catalog.right(v_domain, pg_catalog.char_length(v_brand.website_domain) + 1)
         <> '.' || v_brand.website_domain then
    raise exception 'observed_domain' using errcode = 'invalid_parameter_value', detail = 'observed_domain';
  end if;
  -- RG52, D79 (12): an active free register of the country of registration, or GLEIF
  if not exists (select 1 from verification.registry_sources s
                  where s.id = p_registry_source_id and s.is_active
                    and (s.source_type = 'gleif'
                         or s.country_code = v_brand.registration_country_code)) then
    raise exception 'no_registry_source'
      using errcode = 'object_not_in_prerequisite_state', detail = 'no_registry_source';
  end if;

  select c.id, c.code into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'domain' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;
  update verification.ownership_codes c
     set observed_by_account_id = v_caller,
         observed_at            = pg_catalog.now(),
         observed_domain        = v_domain,
         observed_channel       = p_observed_channel
   where c.id = v_code.id;

  select (s.value)::integer into v_months
    from backoffice.operational_settings s where s.key = 'brand_badge_validity_months';
  if v_months is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- L2FS-1 (0241): the origin of the request and the caller's holding of the account, at the decision
  select r.opened_by = 'agent' as agent_opened,
         coalesce(a.owner_agent_id = v_caller, false) as responsible_agent
    into v_origin
    from verification.verification_requests r
    join identity.accounts a on a.id = r.account_id
   where r.id = p_request_id;

  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id is null
     and b.level = 'brand_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  insert into verification.badges
    (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
     registry_source_id, expires_at)
  values (v_entry.account_id, p_request_id, 'brand_verified', v_caller, v_decided,
          'domain_and_registry', p_registry_source_id,
          v_decided + pg_catalog.make_interval(months => v_months))
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late,
                                                     'channel', p_observed_channel,
                                                     'agent_opened', v_origin.agent_opened,
                                                     'responsible_agent', v_origin.responsible_agent));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_brand_verified(uuid, text, text, text, text, uuid, text) is
  '06 RG51, RG52; D79 (12) (0224, 0241): the holder of a live claim grants « Marque vérifiée »: the '
  'domain code he read (DNS TXT or web page) compared with the live code, on the website domain of '
  'the profile or one of its subdomains, and the register consulted (an active source of the country '
  'of registration, or GLEIF). The finding on the code; the request approved; a badge active for '
  'brand_badge_validity_months (a holding one replaced); verification.decision and lead.updated '
  'queued; verification.granted {level, badge_id, late, channel (dns_txt or web_page), agent_opened '
  '(the request opened by an agent), responsible_agent (the caller holds the account, at the '
  'decision)} (L2FS-1, 0241). Returns (granted, badge_id, decided_at, sla_breached). 22023 '
  'observed_channel, observed_domain, internal_comment, level or code_mismatch; 23514 '
  'website_domain_required or internal_details_required; 55000 stale_token, account_unavailable or '
  'no_registry_source; then the refusals of verification.lock_held_request(). SECURITY DEFINER owned '
  'by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 3. Refuse, or close (0224 §6.5, plus the origin of the decision) -----------------------------------

create or replace function verification.reject_request(
  p_request_id        uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text)
returns table (
  status        text,
  decided_at    timestamptz,
  sla_breached  boolean,
  escalated     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := verification.require_agent(false);
  v_entry     record;
  v_reason    record;
  v_origin    record;
  v_status    text;
  v_decided   timestamptz;
  v_late      boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);

  -- RG56, CA33: a typed reason of the closed list of THIS population (RG57, EC-L2E-11)
  select r.requires_member_message, r.escalates_to_admin into v_reason
    from verification.rejection_reasons r
   where r.population = v_entry.population and r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- EC-L2E-08-7: the message to the member for a reason that requires it only (other, terms_breach)
  if v_reason.requires_member_message then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;
  -- RG54, EC-L2E-08-6: `minor` stops everything at any step, whatever the version examined
  if p_reason_code <> 'minor'
     and (p_review_token is null
          or p_review_token is distinct from verification.request_review_token(p_request_id)) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- L2FS-1 (0241): the origin of the request and the caller's holding of the account, at the decision
  select r.opened_by = 'agent' as agent_opened,
         coalesce(a.owner_agent_id = v_caller, false) as responsible_agent
    into v_origin
    from verification.verification_requests r
    join identity.accounts a on a.id = r.account_id
   where r.id = p_request_id;

  -- RG57: account_unavailable closes (closed), every other reason refuses (rejected)
  v_status := case when p_reason_code = 'account_unavailable' then 'closed' else 'rejected' end;
  update verification.verification_requests r
     set status                = v_status::verification.request_status,
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         rejection_reason_code = p_reason_code,
         member_message        = p_member_message,
         internal_comment      = p_internal_comment,
         escalated_at          = case when v_reason.escalates_to_admin then pg_catalog.now()
                                      else r.escalated_at end
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  perform verification.queue_decision(p_request_id, v_entry.account_id, false);
  perform audit.append(case when v_status = 'closed' then 'verification.closed'
                            else 'verification.rejected' end,
                       'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late,
                                                     'agent_opened', v_origin.agent_opened,
                                                     'responsible_agent', v_origin.responsible_agent));
  -- RG59, CA32, -17: a signal on the account, escalated to an administrator
  if v_reason.escalates_to_admin then
    perform audit.append('verification.escalated', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', p_reason_code));
  end if;
  return query select v_status, v_decided, v_late, v_reason.escalates_to_admin;
end
$$;

comment on function verification.reject_request(uuid, text, text, text, text) is
  '08 RG49, RG54, RG56, RG57, RG59, CA29, CA32, CA33; 06 RG51, RG52 (0224, 0241): the holder of a '
  'live claim refuses a request with a typed reason of verification.rejection_reasons of its '
  'population; the message to the member (20 to 500 printable characters) for a reason that requires '
  'it only; an internal comment of 1 000 characters at most, never sent. account_unavailable closes '
  '(closed), any other reason refuses (rejected); a reason that escalates (RG59, minor included) sets '
  'escalated_at and writes verification.escalated; evidence_too_wide purges the evidence at once '
  '(trigger of 0223). verification.decision queued; verification.rejected or verification.closed '
  '{level, reason_code, late, agent_opened (the request opened by an agent), responsible_agent (the '
  'caller holds the account, at the decision)} (L2FS-1, 0241). `minor` needs no review token (RG54). '
  'Returns (status, decided_at, sla_breached, escalated). 22023 reason, member_message or '
  'internal_comment, 55000 stale_token, then the refusals of verification.lock_held_request(). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

reset role;
revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 4. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the three functions: owner, security, volatility, empty search_path, callers (unchanged)
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.grant_account_verified(uuid,text,text,text,text,text)'),
      ('verification.grant_brand_verified(uuid,text,text,text,text,uuid,text)'),
      ('verification.reject_request(uuid,text,text,text,text)')
    ) as f (sig)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_verification_definer'
      or not p.prosecdef
      or p.provolatile <> 'v'
      or p.proconfig is distinct from array['search_path=""']
      or not pg_catalog.has_function_privilege('influx_agent', p.oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('influx_admin', p.oid, 'EXECUTE')
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0
                         or a.grantee::regrole::text not in ('influx_agent', 'influx_admin')));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, volatility, search_path or callers: %',
      v_bad;
  end if;

  -- L2FS-1: every decision of the three writes its origin
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('verification.grant_account_verified(uuid,text,text,text,text,text)'::regprocedure,
                   'verification.grant_brand_verified(uuid,text,text,text,text,uuid,text)'::regprocedure,
                   'verification.reject_request(uuid,text,text,text,text)'::regprocedure)
     and (p.prosrc not like '%''agent_opened''%' or p.prosrc not like '%''responsible_agent''%');
  if v_bad is not null then
    raise exception 'decision(s) without their origin in the register: %', v_bad;
  end if;

  -- 0234 « Arrêt si »: still no verification function reading the login address
  if exists (select 1 from pg_catalog.pg_proc p
              where p.pronamespace = 'verification'::regnamespace
                and p.prosrc ilike '%a.email%') then
    raise exception 'a verification function reads the login address itself';
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_verification_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'influx_verification_definer left with CREATE on the schema verification';
  end if;
end
$$;
