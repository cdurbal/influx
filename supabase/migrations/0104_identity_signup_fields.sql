-- =============================================================================
-- 0104_identity_signup_fields
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 2. What the sign-up adds to the account (04 §5.1):
--
--   declared_status          individual | business, NOT NULL (05 RG18, RG22); conditions
--                            the Apollo scope (D33, RG81). Written by NOBODY directly:
--                            identity.provision_account() (0106) at sign-up, then
--                            identity.set_declared_status() (here) only;
--   email_status,            the health of the address, which IS the authentication
--   email_undeliverable_at   factor (D37, 05 RG61, RG62): undeliverable = account closed;
--   signup_* columns         the acquisition source, written once at sign-up and never
--                            changed (EC-11, 05 RG120, D55). The invitation code comes
--                            with the invitations table (J8);
--   set_declared_status()    the only door to declared_status: register line
--                            account.declared_status_changed and lead.updated queued to
--                            Brevo AND Apollo, in the same transaction (04 §5.1, RG108);
--   correct_email()          the correction of an address by an administrator, a
--                            take-over primitive (04 §5.1, §12.1 point 9): typed reason,
--                            critical register line keeping the previous address,
--                            notice to both addresses through the queue, email_status
--                            and the proof of address reset.
--
-- Existing rows (the demo accounts of staging, J3 commit 11) receive a declared status
-- before NOT NULL: business for an advertiser (RG22), individual otherwise — the
-- conservative value for Apollo (RG81: an individual creator is never prospected).
--
-- Both functions are SECURITY DEFINER, owned by influx_identity_definer (04 §12.1
-- point 7), empty search_path. EXECUTE: set_declared_status() to influx_creator (his own
-- account, 05 RG71 "mes informations"), influx_agent and influx_admin (05 RG108);
-- correct_email() to influx_admin only. The dual control (2V) and the fresh
-- re-authentication (R) of correct_email() are enforced by apps/api until 0107 (J8),
-- exactly like identity.grant_role() (0004 §8): open point for expert-cybersecurite.
--
-- ROLLBACK (only while no real account exists; declared_status becomes non-removable
-- afterwards, 04 §11.2): drop the two functions and the trigger function
-- identity.guard_account_signup_source(); revoke the grants below; alter table
-- identity.accounts drop the constraints and the columns declared_status, email_status,
-- email_undeliverable_at, signup_utm_source, signup_utm_medium, signup_utm_campaign,
-- signup_referrer_domain, signup_heard_from; drop type identity.heard_from,
-- identity.email_status, identity.declared_status; delete the four codes inserted here
-- from audit.event_types (possible only while no line references them).
-- =============================================================================

-- 1. Types and event codes --------------------------------------------------------------

do $$
begin
  create type identity.declared_status as enum ('individual', 'business');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.email_status as enum ('unknown', 'deliverable', 'undeliverable');
exception when duplicate_object then null;
end
$$;

do $$
begin
  -- 05 RG120: the closed list of "How did you hear about INFLUX?"
  create type identity.heard_from as enum (
    'online_search', 'social_media', 'word_of_mouth', 'influx_salesperson', 'event', 'other');
exception when duplicate_object then null;
end
$$;

comment on type identity.declared_status is
  'individual (particulier) or business (professionnel: company, sole trader, agency), declared at '
  'sign-up (05 RG18), never verified at Lot 1. An advertiser is business by construction (RG22).';
comment on type identity.email_status is
  'unknown (no signal yet, or reset by a correction), deliverable, undeliverable. undeliverable '
  'means ACCOUNT CLOSED, not "marketing nuisance": the address is the authentication factor (D37).';
comment on type identity.heard_from is
  'Closed list of the optional sign-up question "How did you hear about INFLUX?" (05 RG120).';

insert into audit.event_types (code, domain, subject_type, severity) values
  ('account.declared_status_changed',   'identity', 'account', 'sensitive'),
  ('account.email_corrected',           'identity', 'account', 'critical'),
  -- EC-36: the elevated operation of the sign-up (03 C(1), E-2), written by
  -- audit.append_elevated() at the end of the elevated transaction of apps/api
  ('elevated.identity.complete_signup', 'identity', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. Columns and constraints ---------------------------------------------------------------

alter table identity.accounts add column if not exists declared_status identity.declared_status;

update identity.accounts a
   set declared_status = case
         when exists (select 1 from identity.account_roles r
                       where r.account_id = a.id and r.role = 'advertiser')
         then 'business'::identity.declared_status
         else 'individual'::identity.declared_status
       end
 where a.declared_status is null;

alter table identity.accounts alter column declared_status set not null;

alter table identity.accounts add column if not exists email_status identity.email_status
  not null default 'unknown';
alter table identity.accounts add column if not exists email_undeliverable_at timestamptz;

alter table identity.accounts add column if not exists signup_utm_source      text;
alter table identity.accounts add column if not exists signup_utm_medium      text;
alter table identity.accounts add column if not exists signup_utm_campaign    text;
alter table identity.accounts add column if not exists signup_referrer_domain text;
alter table identity.accounts add column if not exists signup_heard_from      identity.heard_from;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'accounts_undeliverable_pair'
                    and conrelid = 'identity.accounts'::regclass) then
    alter table identity.accounts add constraint accounts_undeliverable_pair
      check ((email_status = 'undeliverable') = (email_undeliverable_at is not null));
  end if;
  -- EC-11: bounded formats. apps/api normalises (lower case, trimmed, spaces replaced);
  -- the database refuses anything else, so that no free text reaches Brevo (RG122).
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'accounts_signup_utm_format'
                    and conrelid = 'identity.accounts'::regclass) then
    alter table identity.accounts add constraint accounts_signup_utm_format check (
          signup_utm_source   ~ '^[a-z0-9][a-z0-9._~+-]{0,99}$'
      and signup_utm_medium   ~ '^[a-z0-9][a-z0-9._~+-]{0,99}$'
      and signup_utm_campaign ~ '^[a-z0-9][a-z0-9._~+-]{0,99}$');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'accounts_signup_referrer_domain_format'
                    and conrelid = 'identity.accounts'::regclass) then
    -- a host name only (05 RG120: the domain, never the full address); IDN in punycode
    alter table identity.accounts add constraint accounts_signup_referrer_domain_format check (
          length(signup_referrer_domain) <= 253
      and signup_referrer_domain
          ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$');
  end if;
end
$$;

comment on column identity.accounts.declared_status is
  'individual or business, MANDATORY from sign-up (05 RG18), business for an advertiser (RG22, held '
  'by identity.provision_account() and set_declared_status(): a CHECK cannot read account_roles). '
  'Commands the Apollo scope (D33, RG81). No role writes it directly: the only doors are '
  'identity.provision_account() and identity.set_declared_status(), which leaves the history in the '
  'register (account.declared_status_changed) and queues lead.updated (04 §5.1).';
comment on column identity.accounts.email_status is
  'Health of the address that IS the authentication factor (D37, 05 RG61, RG62). Set to undeliverable '
  'by the worker on a hard bounce of the TRANSACTIONAL channel only (J7); a marketing incident never '
  'closes an account. Reset to unknown by identity.correct_email().';
comment on column identity.accounts.email_undeliverable_at is
  'Set with email_status = undeliverable, and only then. Feeds the backoffice queue "unreachable '
  'addresses".';
comment on column identity.accounts.signup_utm_source is
  'Acquisition source (EC-11, 05 RG120, D55): utm_source of the sign-up session only, never a cross-visit '
  'tracker (RG121). Written once at sign-up, never changed (trigger). Sent to Brevo, NEVER to Apollo '
  '(RG122).';
comment on column identity.accounts.signup_utm_medium is
  'utm_medium of the sign-up session (EC-11, RG120). Immutable.';
comment on column identity.accounts.signup_utm_campaign is
  'utm_campaign of the sign-up session (EC-11, RG120). Immutable.';
comment on column identity.accounts.signup_referrer_domain is
  'Referring site, HOST NAME ONLY, never the full address (05 RG120). Immutable.';
comment on column identity.accounts.signup_heard_from is
  'Answer to the optional question "How did you hear about INFLUX?" (05 RG120). Immutable.';

-- RG120: "these values are never changed afterwards", whoever writes.
create or replace function identity.guard_account_signup_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.signup_utm_source      is distinct from old.signup_utm_source
     or new.signup_utm_medium      is distinct from old.signup_utm_medium
     or new.signup_utm_campaign    is distinct from old.signup_utm_campaign
     or new.signup_referrer_domain is distinct from old.signup_referrer_domain
     or new.signup_heard_from      is distinct from old.signup_heard_from then
    raise exception 'the acquisition source of an account is written once' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function identity.guard_account_signup_source() is
  'BEFORE UPDATE on identity.accounts: the five acquisition columns never change after the sign-up '
  '(05 RG120, EC-11). SECURITY INVOKER, reads nothing.';

revoke all on function identity.guard_account_signup_source() from public;

drop trigger if exists accounts_signup_source_immutable on identity.accounts;
create trigger accounts_signup_source_immutable
  before update of signup_utm_source, signup_utm_medium, signup_utm_campaign,
                   signup_referrer_domain, signup_heard_from on identity.accounts
  for each row execute function identity.guard_account_signup_source();

-- 3. identity.set_declared_status() ----------------------------------------------------------
-- 04 §5.1, 05 RG108: the creator for his own account (RG71, "mes informations"), an
-- agent or an administrator for a member account, with a typed reason. Never on an
-- internal account, never on one's own account for an internal role (03 C(3)), never
-- individual for an advertiser (RG22).

create or replace function identity.set_declared_status(
  p_account_id  uuid,
  p_status      identity.declared_status,
  p_reason_code text,
  p_comment     text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := influx.current_account_id();
  v_role     identity.account_role := influx.current_account_role();
  v_target   identity.account_role;
  v_previous identity.declared_status;
  v_event    uuid := pg_catalog.gen_random_uuid();
  v_payload  jsonb;
begin
  if v_caller is null or v_role is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_role in ('agent', 'admin') then
    if not influx.has_aal2()
       or not exists (
            select 1
              from identity.accounts a
              join identity.account_roles r  on r.account_id = a.id and r.role = v_role
              join identity.agent_profiles p on p.account_id = a.id and p.is_active
             where a.id = v_caller and a.status = 'active')
       or p_account_id is not distinct from v_caller then              -- C(3)
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
  elsif v_role = 'creator' then
    if p_account_id is distinct from v_caller then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
  else
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_status is null then
    raise exception 'a declared status is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'a typed reason code is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;

  -- The target: an active MEMBER account. Same error as an unknown target (03 T14).
  select a.declared_status, r.role
    into v_previous, v_target
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id
   where a.id = p_account_id
     and a.status = 'active'
     and r.role in ('advertiser', 'creator')
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_target = 'advertiser' and p_status <> 'business' then
    raise exception 'an advertiser account is business by construction (RG22)'
      using errcode = 'check_violation';
  end if;
  if p_status = v_previous then
    return false;
  end if;

  update identity.accounts set declared_status = p_status where id = p_account_id;

  -- A change of declared status is a change of prospection scope (04 §5.1): both
  -- destinations are updated, in the same transaction as the fact.
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, 'lead.updated', d.destination, 'account:' || p_account_id::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
         'lead.updated:' || v_event::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  v_payload := pg_catalog.jsonb_build_object('from', v_previous, 'to', p_status,
                                             'reason_code', p_reason_code);
  if p_comment is not null then
    v_payload := v_payload || pg_catalog.jsonb_build_object('comment', p_comment);
  end if;
  -- last: the chain lock is held until COMMIT (04 §7.2)
  perform audit.append('account.declared_status_changed', 'account', p_account_id, v_payload);
  return true;
end
$$;

comment on function identity.set_declared_status(uuid, identity.declared_status, text, text) is
  'The only door to identity.accounts.declared_status after sign-up (04 §5.1). Callers: a creator '
  'for his own account; an active agent or administrator in aal2 for a member account other than his '
  'own (05 RG108, 03 C(3)). Refuses individual for an advertiser (RG22). In the same transaction: '
  'the column, lead.updated queued to Brevo and Apollo, and the chained register line '
  'account.declared_status_changed {from, to, reason_code[, comment]}. Returns false (nothing '
  'written) when the status does not change. SECURITY DEFINER owned by influx_identity_definer.';

-- 4. identity.correct_email() -------------------------------------------------------------------
-- 04 §5.1 and §12.1 point 9: a take-over primitive since D37. The prior identity
-- check (05 Q8) belongs to expert-cybersecurite; the database gives the trace.

create or replace function identity.correct_email(
  p_account_id  uuid,
  p_new_email   text,
  p_reason_code text,
  p_comment     text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := influx.current_account_id();
  v_new      text := pg_catalog.lower(pg_catalog.btrim(p_new_email));
  v_previous text;
  v_event    uuid := pg_catalog.gen_random_uuid();
  v_seq      bigint;
  v_payload  jsonb;
begin
  if v_caller is null
     or not influx.has_aal2()
     or influx.current_account_role() is distinct from 'admin'
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller
             and a.status = 'active')
     or p_account_id is not distinct from v_caller then                 -- C(3)
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'a typed reason code is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;
  if v_new is null or v_new = '' then
    raise exception 'the new address is required' using errcode = 'invalid_parameter_value';
  end if;

  -- The target: an active member account (an internal address changes with the agent
  -- life cycle, J8). Same error as an unknown target (03 T14).
  select a.email
    into v_previous
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id
   where a.id = p_account_id
     and a.status = 'active'
     and r.role in ('advertiser', 'creator')
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_new = v_previous then
    raise exception 'the new address equals the current one' using errcode = 'invalid_parameter_value';
  end if;

  -- RG62 held in base: the next successful sign-in is the new proof of address. An address
  -- already used by another account fails on accounts_email_key (23505).
  update identity.accounts
     set email                  = v_new,
         email_status           = 'unknown',
         email_undeliverable_at = null,
         email_verified_at      = null
   where id = p_account_id;

  v_payload := pg_catalog.jsonb_build_object('previous_email', v_previous, 'reason_code', p_reason_code);
  if p_comment is not null then
    v_payload := v_payload || pg_catalog.jsonb_build_object('comment', p_comment);
  end if;
  v_seq := audit.append('account.email_corrected', 'account', p_account_id, v_payload);

  -- The notice to BOTH addresses (04 §5.1), urgent, through the queue; the payload holds
  -- identifiers only (RG74): the previous address is read back by the consumer from the
  -- register line (audit_seq). The contacts at Brevo and Apollo follow (lead.updated).
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, n.event_type, n.destination, 'account:' || p_account_id::text, n.priority,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id) || n.extra,
         n.event_type || ':' || v_event::text || n.suffix
    from (values
      ('account.email_corrected', 'brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'account.email_corrected', 'recipient', 'previous',
                                     'audit_seq', v_seq), ':previous'),
      ('account.email_corrected', 'brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'account.email_corrected', 'recipient', 'current',
                                     'audit_seq', v_seq), ':current'),
      ('lead.updated', 'brevo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb, ''),
      ('lead.updated', 'apollo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb, '')
    ) n (event_type, destination, priority, extra, suffix);
end
$$;

comment on function identity.correct_email(uuid, text, text, text) is
  'Correction of the address of a MEMBER account by an administrator (04 §5.1, RG62): a take-over '
  'primitive since D37. Caller: active admin, active profile, aal2, never on his own account (C(3)). '
  'In the same transaction: the address (normalised; 23505 if used by another account), email_status '
  'reset to unknown and email_verified_at cleared (the next sign-in is the new proof), the critical '
  'register line account.email_corrected keeping the PREVIOUS address, two urgent notices '
  '(brevo_transactional, previous and current address) and lead.updated to Brevo and Apollo. The '
  'GoTrue user is updated by apps/api. 2V and R: apps/api until 0107. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin only.';

revoke all on function identity.set_declared_status(uuid, identity.declared_status, text, text) from public;
revoke all on function identity.correct_email(uuid, text, text, text) from public;
grant execute on function identity.set_declared_status(uuid, identity.declared_status, text, text)
   to influx_creator, influx_agent, influx_admin;
grant execute on function identity.correct_email(uuid, text, text, text) to influx_admin;

-- 5. Rights ----------------------------------------------------------------------------------------

-- Members read their declared status ("mes informations", RG71); agent and admin read
-- every column through their table grant of 0004. Nobody writes the new columns directly.
grant select (declared_status) on identity.accounts to influx_advertiser, influx_creator;

-- The owner of the two functions: what they read and write, nothing more.
grant select (email, declared_status) on identity.accounts to influx_identity_definer;
grant update (declared_status, email, email_status, email_undeliverable_at, email_verified_at)
   on identity.accounts to influx_identity_definer;

drop policy if exists accounts_identity_definer_update on identity.accounts;
create policy accounts_identity_definer_update on identity.accounts
  for update to influx_identity_definer
  using (true)
  with check (true);

-- The identity functions emit their facts in the queue (04 §5.1): named columns; the
-- processing columns keep their defaults (pending, no attempt).
grant usage on schema leads to influx_identity_definer;
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_identity_definer;

drop policy if exists outbox_events_identity_definer_insert on leads.outbox_events;
create policy outbox_events_identity_definer_insert on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0
              and event_type in ('lead.created', 'lead.updated', 'account.email_corrected'));

-- 6. Hand both functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) -------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.set_declared_status(uuid, identity.declared_status, text, text)
  owner to influx_identity_definer;
alter function identity.correct_email(uuid, text, text, text) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_bad text;
  v_fn  text;
  v_callers text[];
begin
  foreach v_fn in array array[
    'identity.set_declared_status(uuid, identity.declared_status, text, text)',
    'identity.correct_email(uuid, text, text, text)'] loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_identity_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', v_fn;
    end if;
    v_callers := case when v_fn like 'identity.correct_email%'
                      then array['influx_admin']
                      else array['influx_creator', 'influx_agent', 'influx_admin'] end;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- 04 §5.1: nobody but the owner of the identity functions writes declared_status
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'declared_status', 'UPDATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'declared_status', 'INSERT')
          or pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'email', 'UPDATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'email_status', 'UPDATE'));
  if v_bad is not null then
    raise exception 'role(s) may write declared_status or the address directly: %', v_bad;
  end if;

  if exists (select 1 from identity.accounts where declared_status is null) then
    raise exception 'an account has no declared status';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_identity_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity';
  end if;
end
$$;
