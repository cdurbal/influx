-- =============================================================================
-- 0006_audit_chain
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. The hash-chained, append-only audit register (01 M2 and M4,
-- 03 P8, 04 §4.3 and §7.2), its closed list of event types, the record of its
-- verifications, and:
--   audit.append()        SECURITY DEFINER, owner influx_audit_writer (no login,
--                         no member, SELECT + INSERT on audit_events and nothing
--                         else, 03 P7 / P8). The ONLY way to write the register.
--   audit.payload_hash()  the canonical form and its SHA-256, owned by the same
--                         role, shared by append() and the verifier so that both
--                         can never diverge.
--   audit.verify_chain()  SECURITY INVOKER verifier. Recomputes every payload hash
--                         from the canonical form (18 D-1, T3.5), anchors on the
--                         last successful check to detect deleted trailing rows
--                         (18 D-2, T3.11), records the anomaly kind next to the
--                         status (18 D-3).
--
-- Four layers (03 P8): (1) no UPDATE/DELETE/TRUNCATE right for anybody; (2) a
-- trigger that stops even the owner; (3) the chain itself, serialised by a
-- TRANSACTION advisory lock, plus unique (chain_key, prev_hash) against forks;
-- (4) the nightly verification (worker, E-4, granted with its first caller).
--
-- Canonical form, hash_version 1 (04 §7.2, completed on 2026-09-26 with the
-- actor type, so that swapping "agent" and "admin" is detectable, and with
-- recorded_at and request_id, security review R1):
--   chain_key|seq|occurred_at|recorded_at (both UTC ISO 8601 microseconds)|
--   event_type|actor_type|actor_account_id or '-'|subject_type:subject_id|
--   request_id or '-'|payload::text
-- payload_hash = sha256(canonical form, UTF-8); row_hash = sha256(prev_hash || payload_hash).
-- `payload::text` of a jsonb is deterministic within a PostgreSQL major version
-- only: a change of form is an explicit new hash_version.
--
-- ROLLBACK: technically `drop schema audit cascade` before the first REAL line.
-- FORBIDDEN by decision once real lines exist: cancelling destroys the proof
-- (04 §11.3). Never without the founder's written confirmation (04 §11.4).
-- =============================================================================

-- 1. Types and the closed list of event types -------------------------------------

do $$
begin
  create type audit.actor_type as enum ('member', 'agent', 'admin', 'system', 'service');
exception when duplicate_object then null;
end
$$;

comment on type audit.actor_type is
  'Who acted: member (advertiser or creator), agent, admin, system (no account), service (an '
  'elevated operation acting for an account). Derived by audit.append() from the transaction '
  'context, never received as a parameter.';

create table if not exists audit.event_types (
  code          text        not null primary key,
  domain        text        not null,
  subject_type  text        not null,
  severity      text        not null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint event_types_code_format    check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
                                               and length(code) <= 80),
  constraint event_types_domain_format  check (domain ~ '^[a-z][a-z0-9_]{0,31}$'),
  constraint event_types_subject_format check (subject_type ~ '^[a-z][a-z0-9_]{0,62}$'),
  constraint event_types_severity       check (severity in ('info', 'sensitive', 'critical')),
  -- target of the composite key from audit_events: the subject type of an event
  -- is checked by the database at write time, not by convention
  constraint event_types_subject_key unique (code, subject_type)
);

comment on table audit.event_types is
  'Closed list of journalable events (04 §4.3). Data, loaded by migrations lot by lot: adding a code '
  'needs no schema change. The composite key from audit.audit_events makes an unknown code, or a '
  'code used with the wrong subject type, impossible to write.';
comment on column audit.event_types.is_active is
  'Informative: a retired code stays referenced by past lines. The set of codes the application may '
  'emit is also a closed union in packages/contracts.';

drop trigger if exists event_types_touch_updated_at on audit.event_types;
create trigger event_types_touch_updated_at
  before update on audit.event_types
  for each row execute function influx.touch_updated_at();

-- Lot 0 codes: the chain itself, the role grants of identity.grant_role() (04 §5.1),
-- and the life cycle of internal accounts, break-glass included (04 §4.3, loaded
-- at Lot 0 because those acts exist from the first day, 15 RG103).
insert into audit.event_types (code, domain, subject_type, severity) values
  ('chain.genesis',           'audit',    'chain',   'critical'),
  ('account.role_granted',    'identity', 'account', 'critical'),
  ('account.role_revoked',    'identity', 'account', 'critical'),
  ('agent.invited',           'identity', 'account', 'critical'),
  ('agent.role_changed',      'identity', 'account', 'critical'),
  ('agent.deactivated',       'identity', 'account', 'critical'),
  ('agent.mfa_reset',         'identity', 'account', 'critical'),
  ('agent.break_glass_login', 'identity', 'account', 'critical')
on conflict (code) do nothing;

-- 2. audit.audit_events -------------------------------------------------------------

create table if not exists audit.audit_events (
  chain_key         text        not null default 'global',
  seq               bigint      not null,
  id                uuid        not null default gen_random_uuid(),
  occurred_at       timestamptz not null,
  recorded_at       timestamptz not null default clock_timestamp(),
  event_type        text        not null,
  actor_type        audit.actor_type not null,
  actor_account_id  uuid        references identity.accounts (id) on delete restrict,
  subject_type      text        not null,
  subject_id        uuid        not null,
  payload           jsonb       not null default '{}'::jsonb,
  request_id        text,
  hash_algo         text        not null default 'sha256',
  hash_version      smallint    not null default 1,
  payload_hash      bytea       not null,
  prev_hash         bytea       not null,
  row_hash          bytea       not null,

  constraint audit_events_pkey primary key (chain_key, seq),
  constraint audit_events_id_key       unique (id),
  constraint audit_events_row_hash_key unique (row_hash),
  -- two lines can never share a predecessor: a fork fails instead of passing
  constraint audit_events_no_fork      unique (chain_key, prev_hash),
  constraint audit_events_event_type_fk
    foreign key (event_type, subject_type)
    references audit.event_types (code, subject_type),
  constraint audit_events_actor_consistency
    check ((actor_type = 'system') = (actor_account_id is null)),
  constraint audit_events_chain_key_format check (chain_key ~ '^[a-z][a-z0-9_]{0,31}$'),
  constraint audit_events_seq_positive     check (seq >= 1),
  -- the genesis line, and only it, opens the chain, with an all-zero predecessor
  constraint audit_events_genesis_first    check ((seq = 1) = (event_type = 'chain.genesis')),
  constraint audit_events_genesis_prev
    check (seq <> 1 or prev_hash = decode(repeat('00', 32), 'hex')),
  constraint audit_events_payload_object   check (jsonb_typeof(payload) = 'object'),
  constraint audit_events_payload_size     check (pg_column_size(payload) <= 8000),
  constraint audit_events_request_id_length check (length(request_id) <= 100),
  constraint audit_events_hash_algo        check (hash_algo = 'sha256'),
  constraint audit_events_hash_version     check (hash_version = 1),
  constraint audit_events_hash_lengths
    check (octet_length(payload_hash) = 32 and octet_length(prev_hash) = 32
           and octet_length(row_hash) = 32)
);

comment on table audit.audit_events is
  'THE register of proof (01 M2, M4). Append-only for real (03 P8): no UPDATE/DELETE/TRUNCATE right '
  'for any role, a trigger that stops even the owner, a hash chain verified every night. Pseudonymous '
  'by construction: identifiers and codes only, never a name, an e-mail address or a message body, '
  'so that it survives an account deletion. Written ONLY by audit.append(). What it does not protect '
  'against: the owner of the Supabase project (04 §7.2, 03 S-7).';
comment on column audit.audit_events.seq is
  'Gap-free sequence, allocated under the chain''s transaction advisory lock (not a PostgreSQL '
  'sequence: a rolled-back transaction leaves no hole, 18 T3.9).';
comment on column audit.audit_events.recorded_at is
  'Write instant (clock_timestamp()), part of the hashed canonical form. occurred_at is the transaction '
  'time, never supplied by a caller (security review M1).';
comment on column audit.audit_events.actor_account_id is
  'NULL for system. The RESTRICT foreign key makes the physical deletion of an account impossible: '
  'a feature, not a side effect (04 §9.2).';
comment on column audit.audit_events.subject_id is
  'No foreign key on purpose: a register must not depend on the current existence of its subject.';
comment on column audit.audit_events.payload is
  'Identifiers and codes ONLY. Never a message body, never an e-mail address (03 R-2).';
comment on column audit.audit_events.request_id is
  'Correlation with the pino logs of apps/api (influx.request_id setting), truncated to 100 characters.';
comment on column audit.audit_events.payload_hash is
  'sha256 of the canonical form, hash_version 1 (see audit.payload_hash()).';
comment on column audit.audit_events.row_hash is
  'sha256(prev_hash || payload_hash): the link.';

create index if not exists audit_events_subject_idx
  on audit.audit_events (subject_type, subject_id, occurred_at desc);
comment on index audit.audit_events_subject_idx is
  'History of one object, the most used backoffice screen after the queues (04 §10.2).';

drop trigger if exists audit_events_no_update_delete on audit.audit_events;
create trigger audit_events_no_update_delete
  before update or delete on audit.audit_events
  for each row execute function influx.assert_append_only();

drop trigger if exists audit_events_no_truncate on audit.audit_events;
create trigger audit_events_no_truncate
  before truncate on audit.audit_events
  for each statement execute function influx.assert_append_only();

-- 3. audit.chain_checks ------------------------------------------------------------------

create table if not exists audit.chain_checks (
  id             bigint      generated always as identity primary key,
  chain_key      text        not null,
  checked_at     timestamptz not null default now(),
  is_full        boolean     not null,
  from_seq       bigint      not null,
  to_seq         bigint      not null,
  status         text        not null,
  anomaly        text,
  broken_at_seq  bigint,
  duration_ms    integer     not null,
  head_row_hash  bytea       not null,

  constraint chain_checks_status   check (status in ('ok', 'broken', 'gap')),
  constraint chain_checks_anomaly  check (anomaly in ('broken_row', 'broken_link', 'gap')),
  -- 18 D-3: broken_row and broken_link are recorded as status broken; gap as gap
  constraint chain_checks_status_matches_anomaly check (
       (status = 'ok'     and anomaly is null)
    or (status = 'broken' and anomaly in ('broken_row', 'broken_link'))
    or (status = 'gap'    and anomaly = 'gap')),
  constraint chain_checks_broken_at check ((status = 'ok') = (broken_at_seq is null)),
  constraint chain_checks_range     check (from_seq >= 1 and to_seq >= from_seq),
  constraint chain_checks_duration  check (duration_ms >= 0),
  constraint chain_checks_head_hash check (octet_length(head_row_hash) = 32)
);

comment on table audit.chain_checks is
  'Proof that the chain is verified ("a chain nobody verifies is not a chain", 01 M4). Append-only. '
  'The last ok line is the ANCHOR of the next verification: if its to_seq line has disappeared or '
  'changed, deleted or rewritten trailing lines are detected (18 T3.11).';
comment on column audit.chain_checks.anomaly is
  'Kind of the FIRST anomaly found: broken_row (content changed), broken_link (prev_hash rewritten), '
  'gap (missing line). NULL when status = ok.';
comment on column audit.chain_checks.head_row_hash is
  'Row hash of the last line of the chain at check time. To be published outside the database '
  '(03 I-3): a rewrite of the whole chain after an altered line stays undetectable otherwise.';

drop trigger if exists chain_checks_no_update_delete on audit.chain_checks;
create trigger chain_checks_no_update_delete
  before update or delete on audit.chain_checks
  for each row execute function influx.assert_append_only();

drop trigger if exists chain_checks_no_truncate on audit.chain_checks;
create trigger chain_checks_no_truncate
  before truncate on audit.chain_checks
  for each statement execute function influx.assert_append_only();

-- 4. Canonical form and hash ------------------------------------------------------------------

create or replace function audit.payload_hash(
  p_chain_key         text,
  p_seq               bigint,
  p_occurred_at       timestamptz,
  p_recorded_at       timestamptz,
  p_event_type        text,
  p_actor_type        audit.actor_type,
  p_actor_account_id  uuid,
  p_subject_type      text,
  p_subject_id        uuid,
  p_payload           jsonb,
  p_request_id        text
)
returns bytea
language sql
stable
security invoker
set search_path = ''
as $$
  -- `||` on purpose (not concat_ws): any NULL makes the whole hash NULL, and the
  -- NOT NULL constraint then refuses the line instead of hashing a shorter form.
  select pg_catalog.sha256(pg_catalog.convert_to(
             p_chain_key
    || '|' || p_seq::text
    || '|' || pg_catalog.to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    || '|' || pg_catalog.to_char(p_recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    || '|' || p_event_type
    || '|' || p_actor_type::text
    || '|' || coalesce(p_actor_account_id::text, '-')
    || '|' || p_subject_type || ':' || p_subject_id::text
    || '|' || coalesce(p_request_id, '-')
    || '|' || p_payload::text,
    'UTF8'))
$$;

comment on function audit.payload_hash(text, bigint, timestamptz, timestamptz, text, audit.actor_type, uuid, text, uuid, jsonb, text) is
  'sha256 of the canonical form, hash_version 1 (04 §7.2): chain_key|seq|occurred_at|recorded_at (UTC, '
  'ISO 8601, microseconds)|event_type|actor_type|actor_account_id or -|subject_type:subject_id|'
  'request_id or -|payload::text. '
  'Shared by audit.append() and audit.verify_chain(): one definition, no divergence.';

revoke all on function audit.payload_hash(text, bigint, timestamptz, timestamptz, text, audit.actor_type, uuid, text, uuid, jsonb, text)
  from public;

-- 5. The genesis line (written by the migration role, before the functions change owner) --

insert into audit.audit_events
  (chain_key, seq, occurred_at, recorded_at, event_type, actor_type, actor_account_id,
   subject_type, subject_id, payload, request_id, payload_hash, prev_hash, row_hash)
select g.chain_key, 1, g.occurred_at, g.occurred_at, 'chain.genesis', 'system', null,
       'chain', g.subject_id, g.payload, null,
       audit.payload_hash(g.chain_key, 1, g.occurred_at, g.occurred_at, 'chain.genesis', 'system',
                          null, 'chain', g.subject_id, g.payload, null),
       decode(repeat('00', 32), 'hex'),
       pg_catalog.sha256(decode(repeat('00', 32), 'hex')
                         || audit.payload_hash(g.chain_key, 1, g.occurred_at, g.occurred_at,
                                               'chain.genesis', 'system', null, 'chain',
                                               g.subject_id, g.payload, null))
  from (select 'global'::text as chain_key,
               date_trunc('milliseconds', now()) as occurred_at,
               '00000000-0000-0000-0000-000000000000'::uuid as subject_id,
               jsonb_build_object('chain_key', 'global', 'hash_version', 1) as payload) g
 where not exists (select 1 from audit.audit_events where chain_key = 'global');

-- 6. audit.append() -------------------------------------------------------------------------------

create or replace function audit.append(
  p_event_type    text,
  p_subject_type  text,
  p_subject_id    uuid,
  p_payload       jsonb       default '{}'::jsonb
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_chain    constant text := 'global';
  -- the actor comes from the transaction context, never from a parameter
  v_account  uuid := nullif(pg_catalog.current_setting('influx.account', true), '')::uuid;
  v_role     text := nullif(pg_catalog.current_setting('influx.role', true), '');
  v_actor    audit.actor_type;
  -- security review M1: no caller chooses the date of a fact; the transaction
  -- time is the fact time, clock_timestamp() the write time
  v_occurred timestamptz := pg_catalog.now();
  v_recorded timestamptz := pg_catalog.clock_timestamp();
  v_request  text := left(nullif(pg_catalog.current_setting('influx.request_id', true), ''), 100);
  v_prev_seq  bigint;
  v_prev_hash bytea;
  v_seq       bigint;
  v_hash      bytea;
begin
  if p_event_type is null or p_subject_type is null or p_subject_id is null then
    raise exception 'event type, subject type and subject id are required'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  v_actor := case
               when v_account is null                 then 'system'
               when v_role in ('advertiser', 'creator') then 'member'
               when v_role = 'agent'                  then 'agent'
               when v_role = 'admin'                  then 'admin'
               else 'service'
             end;

  -- Serialise the chain: TRANSACTION lock (session locks do not survive the
  -- transaction-mode pooler, 02 §5). Take it LAST in the business transaction
  -- (04 §7.2, rules 1 and 3). A waiting writer reads the link its predecessor
  -- has just committed; a rolled-back writer leaves no hole.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('audit.chain:' || c_chain, 0));

  select e.seq, e.row_hash
    into v_prev_seq, v_prev_hash
    from audit.audit_events e
   where e.chain_key = c_chain
   order by e.seq desc
   limit 1;
  if not found then
    raise exception 'audit chain % has no genesis line', c_chain
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  v_seq  := v_prev_seq + 1;
  v_hash := audit.payload_hash(c_chain, v_seq, v_occurred, v_recorded, p_event_type, v_actor,
                               v_account, p_subject_type, p_subject_id, p_payload, v_request);

  -- Unknown event type, or wrong subject type for it: refused by the composite key.
  insert into audit.audit_events
    (chain_key, seq, occurred_at, recorded_at, event_type, actor_type, actor_account_id,
     subject_type, subject_id, payload, request_id, payload_hash, prev_hash, row_hash)
  values
    (c_chain, v_seq, v_occurred, v_recorded, p_event_type, v_actor, v_account,
     p_subject_type, p_subject_id, p_payload, v_request,
     v_hash, v_prev_hash, pg_catalog.sha256(v_prev_hash || v_hash));

  return v_seq;
end
$$;

comment on function audit.append(text, text, uuid, jsonb) is
  'The ONLY way to write the register (03 C(37)). SECURITY DEFINER owned by influx_audit_writer '
  '(no login, no member, SELECT + INSERT on audit_events only). Called from the business functions '
  'and elevated operations, in the same transaction as the fact it records, as LATE as possible '
  '(the chain lock is held until COMMIT). The actor is derived from the transaction context. Never '
  'call it with a network call pending in the same transaction (04 §7.2 rule 2). Returns the seq.';

revoke all on function audit.append(text, text, uuid, jsonb) from public;
-- Lot 0 caller: identity.grant_role(). influx_auth and influx_worker receive EXECUTE
-- with their first elevated operation (J3, J6: 18 T6.1). Never the four business
-- roles nor influx_app (C(37), 18 T2.7).
grant execute on function audit.append(text, text, uuid, jsonb)
   to influx_identity_definer;

-- 7. audit.verify_chain() ---------------------------------------------------------------------------

create or replace function audit.verify_chain(
  p_chain_key text    default 'global',
  p_full      boolean default false,
  p_record    boolean default true
)
returns table (
  check_id       bigint,
  status         text,
  anomaly        text,
  broken_at_seq  bigint,
  from_seq       bigint,
  to_seq         bigint,
  head_row_hash  bytea
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  c_zero      constant bytea := pg_catalog.decode(pg_catalog.repeat('00', 32), 'hex');
  v_started   timestamptz := pg_catalog.clock_timestamp();
  v_anchor    record;
  v_has_anchor boolean := false;
  v_anchor_hash bytea;
  v_prev_seq  bigint;
  v_prev_hash bytea;
  v_from      bigint;
  v_anomaly   text;
  v_broken_at bigint;
  v_last_seq  bigint;
  v_last_hash bytea;
  v_status    text;
  v_check_id  bigint;
  r           record;
  v_expected  bytea;
begin
  select c.* into v_anchor
    from audit.chain_checks c
   where c.chain_key = p_chain_key and c.status = 'ok'
   order by c.id desc
   limit 1;
  v_has_anchor := found;

  select e.seq, e.row_hash into v_last_seq, v_last_hash
    from audit.audit_events e
   where e.chain_key = p_chain_key
   order by e.seq desc
   limit 1;
  if not found then
    raise exception 'audit chain % is empty: genesis line missing', p_chain_key
      using errcode = 'data_corrupted';
  end if;

  -- 1. The anchor: the last line proven ok must still be there, unchanged (T3.11).
  if v_has_anchor then
    select e.row_hash into v_anchor_hash
      from audit.audit_events e
     where e.chain_key = p_chain_key and e.seq = v_anchor.to_seq;
    if not found then
      v_anomaly := 'gap';        v_broken_at := v_anchor.to_seq;
    elsif v_anchor_hash <> v_anchor.head_row_hash then
      v_anomaly := 'broken_row'; v_broken_at := v_anchor.to_seq;
    end if;
  end if;

  -- 2. The scan: full from the genesis, or incremental from the anchor.
  if p_full or not v_has_anchor then
    v_from := 1;  v_prev_seq := 0;  v_prev_hash := c_zero;
  else
    v_from := v_anchor.to_seq;  v_prev_seq := v_anchor.to_seq;  v_prev_hash := v_anchor.head_row_hash;
  end if;

  -- An anchor anomaly found in incremental mode is the first one: the scan would
  -- start from an untrusted link. In full mode the scan runs and the lowest wins.
  if v_anomaly is null or p_full or not v_has_anchor then
    for r in
      select e.*
        from audit.audit_events e
       where e.chain_key = p_chain_key
         and e.seq > v_prev_seq
       order by e.seq
    loop
      if r.seq <> v_prev_seq + 1 then
        -- broken_at_seq names the first MISSING line
        if v_broken_at is null or v_prev_seq + 1 < v_broken_at then
          v_anomaly := 'gap'; v_broken_at := v_prev_seq + 1;
        end if;
        exit;
      end if;
      if r.prev_hash <> v_prev_hash then
        if v_broken_at is null or r.seq < v_broken_at then
          v_anomaly := 'broken_link'; v_broken_at := r.seq;
        end if;
        exit;
      end if;
      -- 18 D-1: recompute from the CONTENT, never trust the stored payload_hash
      v_expected := audit.payload_hash(r.chain_key, r.seq, r.occurred_at, r.recorded_at,
                                       r.event_type, r.actor_type, r.actor_account_id,
                                       r.subject_type, r.subject_id, r.payload, r.request_id);
      if r.payload_hash <> v_expected
         or r.row_hash <> pg_catalog.sha256(r.prev_hash || v_expected) then
        if v_broken_at is null or r.seq < v_broken_at then
          v_anomaly := 'broken_row'; v_broken_at := r.seq;
        end if;
        exit;
      end if;
      v_prev_seq := r.seq;
      v_prev_hash := r.row_hash;
    end loop;

    -- the genesis itself is missing in a full scan
    if v_prev_seq = 0 and v_broken_at is null then
      v_anomaly := 'gap'; v_broken_at := 1;
    end if;
  end if;

  v_status := case
                when v_anomaly is null  then 'ok'
                when v_anomaly = 'gap'  then 'gap'
                else 'broken'
              end;

  if p_record then
    insert into audit.chain_checks
      (chain_key, is_full, from_seq, to_seq, status, anomaly, broken_at_seq, duration_ms,
       head_row_hash)
    values
      (p_chain_key, p_full or not v_has_anchor, least(v_from, v_last_seq), v_last_seq,
       v_status, v_anomaly, v_broken_at,
       (extract(epoch from pg_catalog.clock_timestamp() - v_started) * 1000)::integer,
       v_last_hash)
    returning id into v_check_id;
  end if;

  return query
    select v_check_id, v_status, v_anomaly, v_broken_at, least(v_from, v_last_seq), v_last_seq,
           v_last_hash;
end
$$;

comment on function audit.verify_chain(text, boolean, boolean) is
  'Verifies a chain (04 §7.2 corrected, 18 T3): gap-free seq, each prev_hash equal to the previous '
  'row_hash, each payload_hash RECOMPUTED from the canonical form, each row_hash recomputed; and the '
  'anchor (last ok check) still present and unchanged, so that deleted or rewritten trailing lines are '
  'seen. Incremental by default, full with p_full. Records a chain_checks line unless p_record is '
  'false. SECURITY INVOKER: runs with the caller''s rights (the worker at E-4, granted with its first '
  'caller; the migration role in the T3 tests, on a supplied transaction).';

revoke all on function audit.verify_chain(text, boolean, boolean) from public;

-- 8. Row level security and privileges ---------------------------------------------------------------

alter table audit.event_types  enable row level security;
alter table audit.event_types  force  row level security;
alter table audit.audit_events enable row level security;
alter table audit.audit_events force  row level security;
alter table audit.chain_checks enable row level security;
alter table audit.chain_checks force  row level security;

revoke all on audit.event_types, audit.audit_events, audit.chain_checks
  from public, anon, authenticated, service_role;
-- layer 1 of 03 P8, written out even though nothing was granted: the right does not exist
revoke update, delete, truncate on audit.audit_events, audit.chain_checks
  from influx_app, influx_auth_login, influx_worker_login,
       influx_advertiser, influx_creator, influx_agent, influx_admin,
       influx_auth, influx_worker,
       influx_audit_writer, influx_session_resolver, influx_identity_definer;

grant usage on schema audit to influx_audit_writer, influx_identity_definer, influx_agent, influx_admin;

-- The writer: SELECT + INSERT on audit_events, nothing else (03 P7, P8; 18 T2.7).
grant select, insert on audit.audit_events to influx_audit_writer;

drop policy if exists audit_events_writer_select on audit.audit_events;
create policy audit_events_writer_select on audit.audit_events
  for select to influx_audit_writer
  using (true);

drop policy if exists audit_events_writer_insert on audit.audit_events;
create policy audit_events_writer_insert on audit.audit_events
  for insert to influx_audit_writer
  with check (true);

-- Readers (03 §3.6): admin reads the register and the verifications, aal2.
-- Agent: reading "limited to his operating perimeter" (C(38)) has no definition
-- yet, so no right at Lot 0 (open point, 21 §3 EC-31). Both read the event types.
grant select on audit.audit_events, audit.chain_checks to influx_admin;
grant select on audit.event_types to influx_agent, influx_admin;

drop policy if exists audit_events_admin_select on audit.audit_events;
create policy audit_events_admin_select on audit.audit_events
  for select to influx_admin
  using ((select influx.has_aal2()));

drop policy if exists chain_checks_admin_select on audit.chain_checks;
create policy chain_checks_admin_select on audit.chain_checks
  for select to influx_admin
  using ((select influx.has_aal2()));

drop policy if exists event_types_internal_select on audit.event_types;
create policy event_types_internal_select on audit.event_types
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 9. Hand append() and payload_hash() to influx_audit_writer (03 P7 rule 5) ---------------------------
-- payload_hash() is SECURITY INVOKER; owning it lets append() run it without any
-- EXECUTE grant to the writer. The migration role keeps EXECUTE on it (the T3
-- tests and the verifier run under it): an owner's right leaves with the
-- ownership, so the new owner grants it back, during the transfer window.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
grant create on schema audit to influx_audit_writer;

alter function audit.payload_hash(text, bigint, timestamptz, timestamptz, text, audit.actor_type, uuid, text, uuid, jsonb, text)
  owner to influx_audit_writer;
alter function audit.append(text, text, uuid, jsonb)
  owner to influx_audit_writer;

set role influx_audit_writer;
grant execute on function audit.payload_hash(text, bigint, timestamptz, timestamptz, text, audit.actor_type, uuid, text, uuid, jsonb, text)
   to session_user;
reset role;

revoke create on schema audit from influx_audit_writer;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

do $$
declare
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'audit.append(text, text, uuid, jsonb)'::regprocedure)
       <> 'influx_audit_writer' then
    raise exception 'audit.append() must belong to influx_audit_writer';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_audit_writer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_audit_writer left with a usable member: %', v_bad;
  end if;

  if pg_catalog.has_schema_privilege('influx_audit_writer', 'audit', 'CREATE') then
    raise exception 'influx_audit_writer left with CREATE on schema audit';
  end if;

  if (select count(*) from audit.audit_events where chain_key = 'global' and seq = 1) <> 1 then
    raise exception 'genesis line missing';
  end if;
end
$$;
