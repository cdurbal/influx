-- =============================================================================
-- 0203_profiles_advertiser_submission
-- -----------------------------------------------------------------------------
-- Lot 2 / L2B, commit 06. The submission of a brand profile, guarded by the database (06 RG3 to
-- RG6, edge cases 3 and 5; 04 §4.3; fiche L2B invariant 4).
--
-- 1. profiles.advertiser_profile_status: the five states of 06 RG3 (draft, pending_review,
--    published, rejected, suspended), added after the draft of 0106; submitted_at, the instant of
--    the latest submission (NULL while never submitted).
-- 2. profiles.advertiser_missing_required_fields(jsonb): the database copy of the required fields
--    of 06 RG15, RG27 and RG35, the twelve codes of packages/domain (brand-profile/required.ts) in
--    snake_case, in the order of the form, with the same thresholds (a trading name of two
--    characters, a presentation of 120, outside the margins JavaScript's trim() removes; a list
--    holds one choice at least). Pure (IMMUTABLE, SECURITY INVOKER): the parity test gives both
--    copies the same inputs and compares their answers, no third copy of the rule.
-- 3. profiles.submit_own_advertiser_profile(): the ONLY member transition. The owner, active
--    advertiser, moves his profile from draft or rejected to pending_review, if no required field
--    is missing (23514, the code of the first missing field in DETAIL and in the message);
--    pending_review asked again: nothing written, returned as it is (edge case 3); from published
--    or suspended: refused (55000, edge case 5). In ONE transaction: the row locked, the state, the
--    instant, the register line profile.submitted {from_status}. No member, agent nor admin holds
--    any right on status: published, rejected and suspended are written by the decisions of L2C
--    (06 RG6).
--    SECURITY DEFINER is unavoidable: no business role executes audit.append() (03 C(37)). Owner
--    influx_identity_definer, which already writes this table (provision_account() 0106,
--    update_own_account() 0122) and owns the other member doors (EC-L2B-06-1); EXECUTE for
--    influx_advertiser only.
-- 4. audit.event_types + profile.submitted (domain profiles, subject advertiser_profile, info: the
--    brand's own act, like campaign.submitted of 04 §4.3).
--
-- EC-L2B-06 (micro-gaps, the safest choice):
--   EC-L2B-06-1  owner of the submission: influx_identity_definer rather than a new definer role
--                (the closed list of 03 P7 is unchanged); its new rights are column by column, on
--                the caller's own rows only (RLS on influx.current_account_id()). Recorded in 03
--                P7, row influx_identity_definer.
--   EC-L2B-06-2  refusals: 23514 check_violation for a missing field (the code in DETAIL), 55000
--                object_not_in_prerequisite_state for a state that cannot be submitted, 42501
--                outside an active advertiser account with a profile.
--   EC-L2B-06-3  submitted_at is kept through later decisions (the date of the latest submission,
--                L2C reads it for the queue); it is not entered by the brand and is not exported
--                (the export carries the status, 0202); the erasure leaves it (no person in it).
--   EC-L2B-06-4  whitespace: the margins are those of String.prototype.trim() (tab, line feed,
--                vertical tab, form feed, carriage return, space, U+00A0, U+1680, U+2000 to
--                U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF), listed explicitly so the
--                answer does not depend on the locale of the cluster.
--
-- ROLLBACK (before any profile left draft): drop function profiles.submit_own_advertiser_profile()
-- and profiles.advertiser_missing_required_fields(jsonb); drop the policies *_identity_definer_select
-- of the six list tables; revoke the column grants of section 4 from influx_identity_definer; delete
-- profile.submitted from audit.event_types (possible only while no line references it); alter table
-- profiles.advertiser_profiles drop column submitted_at. The four enum values cannot be removed
-- (PostgreSQL): harmless while unused.
-- =============================================================================

-- 1. The five states of 06 RG3, and the instant of the submission ------------------------------------

alter type profiles.advertiser_profile_status add value if not exists 'pending_review' after 'draft';
alter type profiles.advertiser_profile_status add value if not exists 'published' after 'pending_review';
alter type profiles.advertiser_profile_status add value if not exists 'rejected' after 'published';
alter type profiles.advertiser_profile_status add value if not exists 'suspended' after 'rejected';

comment on type profiles.advertiser_profile_status is
  'Life cycle of a brand profile (06 RG3): draft (initial), pending_review (submitted by the brand, '
  '0203), published (decided by an agent or an admin), rejected (idem, with a typed reason), '
  'suspended (an admin only). The member writes pending_review through '
  'profiles.submit_own_advertiser_profile() only; the decisions belong to L2C.';

alter table profiles.advertiser_profiles
  add column if not exists submitted_at timestamptz;

comment on column profiles.advertiser_profiles.status is
  'State of 06 RG3. No role writes it directly: the brand submits through '
  'profiles.submit_own_advertiser_profile() (0203), the decisions of an agent or an admin come with '
  'L2C (RG6). Never published without a human decision.';
comment on column profiles.advertiser_profiles.submitted_at is
  'Instant of the latest submission (06 RG5), written with the status by '
  'profiles.submit_own_advertiser_profile(); NULL while never submitted (EC-L2B-06-3).';

-- 2. The code of the register (04 §4.3) ----------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 06 RG5: the brand submits its profile for review (from draft or rejected)
  ('profile.submitted', 'profiles', 'advertiser_profile', 'info')
on conflict (code) do nothing;

-- 3. What the owner of the submission reads and writes, on the caller's rows only ---------------------

grant select (status, submitted_at, primary_sector_code, company_size_band, presentation, contact_role)
   on profiles.advertiser_profiles to influx_identity_definer;
grant update (status, submitted_at) on profiles.advertiser_profiles to influx_identity_definer;
-- the policies advertiser_profiles_identity_definer_select and _update of 0122 already bound it to
-- the row of influx.current_account_id()

do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('advertiser_target_markets',     'country_code'),
      ('advertiser_working_languages',  'language_code'),
      ('advertiser_topics',             'topic_code'),
      ('advertiser_networks',           'network_code'),
      ('advertiser_formats',            'format_code'),
      ('advertiser_audience_countries', 'country_code')
    ) as v (name, code_column)
  loop
    execute format('grant select (account_id, %I) on profiles.%I to influx_identity_definer',
                   l.code_column, l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_identity_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_identity_definer '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_identity_definer_select', l.name);
  end loop;
end
$$;

-- 4. The two functions, as influx_identity_definer (03 P7 rule 5) --------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;
set role influx_identity_definer;

create or replace function profiles.advertiser_missing_required_fields(p_values jsonb)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(f.code order by f.position), '{}'::text[])
    from (values
           -- block 1, identity (RG15)
           (1,  'legal_name',         'text', 2),
           (2,  'primary_sector',     'text', 1),
           (3,  'company_size',       'text', 1),
           (4,  'country',            'text', 1),
           (5,  'target_markets',     'list', 1),
           (6,  'working_languages',  'list', 1),
           (7,  'presentation',       'text', 120),
           -- block 2, expectations (RG27; the budget is suspended, D48, D78)
           (8,  'topics',             'list', 1),
           (9,  'networks',           'list', 1),
           (10, 'formats',            'list', 1),
           (11, 'audience_countries', 'list', 1),
           -- block 3, contact person (RG35)
           (12, 'contact_role',       'text', 1)
         ) as f (position, code, kind, minimum)
   where case
           when f.kind = 'text' and pg_catalog.jsonb_typeof(p_values -> f.code) = 'string' then
             pg_catalog.char_length(pg_catalog.regexp_replace(
               p_values ->> f.code,
               '^[\t\n\v\f\r    -     　﻿]+|[\t\n\v\f\r    -     　﻿]+$',
               '', 'g'))
           when f.kind = 'list' and pg_catalog.jsonb_typeof(p_values -> f.code) = 'array' then
             pg_catalog.jsonb_array_length(p_values -> f.code)
           else 0
         end < f.minimum
$$;

comment on function profiles.advertiser_missing_required_fields(jsonb) is
  '06 RG5, RG15, RG27, RG35, RG61: the required fields of a brand profile still missing, in the '
  'order of the form, as snake_case codes (legal_name, primary_sector, company_size, country, '
  'target_markets, working_languages, presentation, topics, networks, formats, audience_countries, '
  'contact_role). Input: an object with those keys, a text or an array each, as stored; a text '
  'counts once trimmed as String.prototype.trim() does (EC-L2B-06-4), two characters for the name, '
  '120 for the presentation, one otherwise; an array counts its elements. The database copy of '
  'packages/domain BRAND_PROFILE_REQUIRED_FIELDS and missingRequiredFields(), held equal by the '
  'parity test (profiles-brand-submission). IMMUTABLE, SECURITY INVOKER, owned by '
  'influx_identity_definer; no grant.';

revoke all on function profiles.advertiser_missing_required_fields(jsonb)
  from public, anon, authenticated, service_role;

create or replace function profiles.submit_own_advertiser_profile()
returns table (
  status        text,
  submitted_at  timestamptz,
  changed       boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account  uuid := influx.current_account_id();
  v_status   text;
  v_at       timestamptz;
  v_values   jsonb;
  v_missing  text[];
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The row lock serialises two submissions (double click, second tab): the second one reads the
  -- state the first one committed.
  select p.status::text, p.submitted_at,
         pg_catalog.jsonb_build_object(
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
    into v_status, v_at, v_values
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id and a.status = 'active'
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- Edge case 3: submitted again while waiting, nothing is written.
  if v_status = 'pending_review' then
    return query select v_status, v_at, false;
    return;
  end if;
  -- Edge case 5, RG6: published and suspended are left by a decision of INFLUX only.
  if v_status not in ('draft', 'rejected') then
    raise exception 'a % brand profile cannot be submitted', v_status
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- RG5: every required field, the first missing one named (RG61: the order of the form).
  v_missing := profiles.advertiser_missing_required_fields(v_values);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required field missing: %', v_missing[1]
      using errcode = 'check_violation', detail = v_missing[1];
  end if;

  update profiles.advertiser_profiles p
     set status = 'pending_review', submitted_at = pg_catalog.now()
   where p.account_id = v_account
  returning p.submitted_at into v_at;

  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT
  -- (04 §7.2).
  perform audit.append('profile.submitted', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('from_status', v_status));
  return query select 'pending_review'::text, v_at, true;
end
$$;

comment on function profiles.submit_own_advertiser_profile() is
  '06 RG5, RG6, edge cases 3 and 5: an active advertiser submits his own brand profile. From draft '
  'or rejected, with no required field missing (profiles.advertiser_missing_required_fields()): in '
  'ONE transaction, status pending_review, submitted_at now(), the register line profile.submitted '
  '{from_status}; returns (pending_review, instant, true). Already pending_review: nothing written, '
  'returns (pending_review, instant of the submission, false). 23514 with the code of the first '
  'missing field (message and DETAIL), 55000 from published or suspended, 42501 outside an active '
  'advertiser account holding a profile. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_advertiser only.';

revoke all on function profiles.submit_own_advertiser_profile()
  from public, anon, authenticated, service_role;
grant execute on function profiles.submit_own_advertiser_profile() to influx_advertiser;

reset role;
revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;
