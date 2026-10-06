-- =============================================================================
-- 0016_ops_monitoring
-- -----------------------------------------------------------------------------
-- Lot 0 / J4, point 3 (docs/mvp/21 §4). The collection half of the internal
-- monitoring of D60 (docs/mvp/02 §20.4 to §20.8): server and browser errors grouped
-- by fingerprint, their occurrences, and the per-minute request and process
-- metrics. Alerts, probe results, settings and the hourly roll-up arrive at J9
-- with the "Santé technique" screen; the purges with the first periodic task
-- (E-4, worker).
--
-- Roles (03 P7, "Créés plus tard, déjà nommés"; 21 EC-1, EC-20):
--   influx_ops        NOLOGIN, taken by SET LOCAL ROLE from influx_ops_login only;
--   influx_ops_login  LOGIN NOINHERIT, member of influx_ops ONLY, WITH INHERIT FALSE,
--                     SET TRUE; OPS_DATABASE_URL, service `api`.
-- influx_ops WRITES the ops schema and reads nothing of the business schemas. Its
-- only reads are the two columns of ops.error_groups that the upsert of a group
-- needs (fingerprint, occurrence_count). Operation E-6 `ops.record_telemetry` of
-- the closed list (03 P7), to be signed by expert-cybersecurite with this
-- migration (end-of-J4 grouped review).
--
-- *** NEVER IN THESE TABLES (02 §20.8) ***: a code, a token, a cookie, a body, a
-- message text, an e-mail address, a name, a handle, a full URL, an IP address. The
-- api cleans every value with ONE function (src/domains/ops/scrub.ts) before it is
-- written; the columns below are bounded and shaped so that a forgotten value has
-- little room.
--
-- Retention (02 §20.5, §20.8; to be confirmed by expert-conformite-rgpd at Lot 6):
--   error_occurrences  30 days;
--   request_metrics, process_metrics  14 days at the minute, then rolled up by hour
--   and kept 13 months (roll-up table at J9);
--   error_groups  while they are open, then 13 months after last_seen_at.
--
-- ROLLBACK (before any real line): drop schema ops cascade; then, in every database
-- of the cluster, drop owned by influx_ops_login, influx_ops; drop role
-- influx_ops_login; drop role influx_ops.
-- =============================================================================

set createrole_self_grant = '';

-- 1. Roles (same rules as 0001: idempotent, attributes re-imposed) -------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values ('influx_ops_login', true), ('influx_ops', false)) as t(name, can_login)
  loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = r.name) then
      execute format('create role %I with %s noinherit',
                     r.name, case when r.can_login then 'login' else 'nologin' end);
    end if;
    execute format('alter role %I with %s noinherit',
                   r.name, case when r.can_login then 'login' else 'nologin' end);
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolsuper) then
      raise exception 'role % is SUPERUSER: refuse to continue (03 P7)', r.name;
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolbypassrls) then
      execute format('alter role %I with nobypassrls', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolreplication) then
      execute format('alter role %I with noreplication', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreatedb) then
      execute format('alter role %I with nocreatedb', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreaterole) then
      execute format('alter role %I with nocreaterole', r.name);
    end if;
  end loop;
end
$$;

-- Bounds (03 P7 rule 6, EC-33): a small pool (2 connections per api instance), short
-- statements. The recording never waits on the database: a slow write is dropped.
alter role influx_ops_login with connection limit 10;
alter role influx_ops_login set statement_timeout = '2s';
alter role influx_ops_login set idle_in_transaction_session_timeout = '2s';

grant influx_ops to influx_ops_login with inherit false, set true;

-- 2. Schema (same default privileges as the domain schemas of 0001) -------------------

create schema if not exists ops;
comment on schema ops is
  'INFLUX: internal technical monitoring (D60, 02 §20): error groups and occurrences, per-minute '
  'request and process metrics. Written by influx_ops (api, E-6). Never personal data beyond an '
  'account uuid (02 §20.8).';

revoke all on schema ops from public, anon, authenticated, service_role;
revoke all on all tables    in schema ops from public, anon, authenticated, service_role;
revoke all on all sequences in schema ops from public, anon, authenticated, service_role;
revoke all on all functions in schema ops from public, anon, authenticated, service_role;
do $$
begin
  execute format('alter default privileges for role %I in schema ops
                    revoke all on tables    from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema ops
                    revoke all on sequences from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema ops
                    revoke all on functions from public, anon, authenticated, service_role',
                 current_user);
end
$$;

-- 3. Types -----------------------------------------------------------------------------

do $$
begin
  create type ops.service_name as enum ('api', 'worker', 'web', 'backoffice');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type ops.error_source as enum ('server', 'browser');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type ops.error_status as enum ('new', 'acknowledged', 'fixed', 'ignored');
exception when duplicate_object then null;
end
$$;

comment on type ops.error_status is
  'new: never classified, or reopened by a regression; acknowledged: seen, being handled; fixed: '
  'declared fixed (a new occurrence reopens it as a regression); ignored: without effect.';

-- 4. Error groups (02 §20.5, "Erreurs serveur") ----------------------------------------

create table if not exists ops.error_groups (
  id                 uuid        not null default gen_random_uuid() primary key,
  fingerprint        bytea       not null,
  source             ops.error_source not null,
  service            ops.service_name not null,
  error_type         text        not null,
  message            text        not null,
  route              text,
  status             ops.error_status not null default 'new',
  occurrence_count   bigint      not null default 1,
  regression_count   integer     not null default 0,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  last_regressed_at  timestamptz,
  first_version      text        not null,
  last_version       text        not null,

  constraint error_groups_fingerprint_key unique (fingerprint),
  constraint error_groups_fingerprint_sha256 check (octet_length(fingerprint) = 32),
  constraint error_groups_source_service check (
    (source = 'server'  and service in ('api', 'worker'))
    or (source = 'browser' and service in ('web', 'backoffice'))),
  constraint error_groups_error_type_format
    check (error_type ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,79}$'),
  constraint error_groups_message_bounded
    check (length(message) between 1 and 500),
  constraint error_groups_route_model
    check (route ~ '^/[A-Za-z0-9/_:.*\[\]-]{0,199}$'),
  constraint error_groups_counts check (occurrence_count >= 1 and regression_count >= 0),
  constraint error_groups_versions
    check (first_version ~ '^[A-Za-z0-9._-]{1,64}$' and last_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  constraint error_groups_chronology
    check (last_seen_at >= first_seen_at
           and (last_regressed_at is null or last_regressed_at >= first_seen_at))
);

comment on table ops.error_groups is
  'One line per error fingerprint (02 §20.5): type + normalised message + route model + first frames '
  'of OUR code, hashed (SHA-256). Upserted by influx_ops; a fixed group that occurs again becomes a '
  'regression (trigger). Status changes by an administrator at J9 (Santé technique screen).';
comment on column ops.error_groups.message is
  'NORMALISED message: identifiers, numbers, addresses and quoted values removed by the scrubber of '
  'the api before hashing (02 §20.8).';
comment on column ops.error_groups.route is
  'Route model (/v1/auth/verify-code, /[locale]/marque), never a real URL; null outside a request.';

create index if not exists error_groups_open_idx
  on ops.error_groups (last_seen_at desc)
  where status in ('new', 'acknowledged');
comment on index ops.error_groups_open_idx is 'Open groups, most recent first (Santé technique, J9).';

-- The description of a group never changes; its count only grows; its last sighting is the
-- transaction time; a fixed group seen again is reopened as a regression.
create or replace function ops.guard_error_group_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id               is distinct from old.id
     or new.fingerprint      is distinct from old.fingerprint
     or new.source           is distinct from old.source
     or new.service          is distinct from old.service
     or new.error_type       is distinct from old.error_type
     or new.message          is distinct from old.message
     or new.route            is distinct from old.route
     or new.first_seen_at    is distinct from old.first_seen_at
     or new.first_version    is distinct from old.first_version
     or new.regression_count is distinct from old.regression_count
     or new.last_regressed_at is distinct from old.last_regressed_at then
    raise exception 'the description of an error group never changes'
      using errcode = 'insufficient_privilege';
  end if;
  if new.occurrence_count < old.occurrence_count then
    raise exception 'the occurrence count of an error group only grows'
      using errcode = 'insufficient_privilege';
  end if;
  if new.occurrence_count > old.occurrence_count then
    new.last_seen_at := pg_catalog.now();
    if old.status = 'fixed' and new.status = 'fixed' then
      new.status            := 'new';
      new.regression_count  := old.regression_count + 1;
      new.last_regressed_at := pg_catalog.now();
    end if;
  elsif new.last_seen_at is distinct from old.last_seen_at then
    raise exception 'last_seen_at moves with the occurrence count only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function ops.guard_error_group_update() is
  'BEFORE UPDATE on ops.error_groups: description immutable, count growing only, last_seen_at = now() '
  'on a new occurrence, fixed -> new (regression) on a new occurrence. SECURITY INVOKER, reads nothing.';

revoke all on function ops.guard_error_group_update() from public;

drop trigger if exists error_groups_guard on ops.error_groups;
create trigger error_groups_guard
  before update on ops.error_groups
  for each row execute function ops.guard_error_group_update();

-- 5. Error occurrences --------------------------------------------------------------------

create table if not exists ops.error_occurrences (
  id                  bigint      generated always as identity primary key,
  group_fingerprint   bytea       not null references ops.error_groups (fingerprint) on delete cascade,
  occurred_at         timestamptz not null default now(),
  service             ops.service_name not null,
  version             text        not null,
  route               text,
  request_id          uuid,
  account_id          uuid,
  message             text        not null,
  stack               text,
  user_agent_summary  text,

  constraint error_occurrences_version_format check (version ~ '^[A-Za-z0-9._-]{1,64}$'),
  constraint error_occurrences_route_model
    check (route ~ '^/[A-Za-z0-9/_:.*\[\]-]{0,199}$'),
  constraint error_occurrences_message_bounded check (length(message) between 1 and 500),
  constraint error_occurrences_stack_bounded check (length(stack) <= 4000),
  constraint error_occurrences_user_agent_bounded
    check (user_agent_summary ~ '^[\x20-\x7E]{1,120}$'),
  constraint error_occurrences_user_agent_browser_only
    check (user_agent_summary is null or service in ('web', 'backoffice'))
);

comment on table ops.error_occurrences is
  'Kept occurrences of an error group (02 §20.5): at most 10 per fingerprint and minute per instance, '
  'the others counted on the group only. Written by influx_ops, never read by it. Retention 30 days. '
  '*** NEVER a body, a code, a token, an address, a full URL nor an IP (02 §20.8) ***.';
comment on column ops.error_occurrences.account_id is
  'Account of the request, when there is one: the uuid is enough to investigate (02 §20.8). No '
  'foreign key: an occurrence never blocks nor outlives (30 days) the erasure of an account.';
comment on column ops.error_occurrences.stack is
  'Stack cleaned by the scrubber: frames of our code, paths made relative, values removed.';

create index if not exists error_occurrences_by_group_idx
  on ops.error_occurrences (group_fingerprint, occurred_at desc);
create index if not exists error_occurrences_purge_idx
  on ops.error_occurrences (occurred_at);
comment on index ops.error_occurrences_purge_idx is 'Daily purge after 30 days (E-4).';

-- 6. Per-minute request metrics (02 §20.5, "Temps de réponse et volume d'appels") ----------

create table if not exists ops.request_metrics (
  minute               timestamptz not null,
  service              ops.service_name not null,
  instance             text        not null,
  method               text        not null,
  route                text        not null,
  request_count        integer     not null,
  server_error_count   integer     not null,
  throttled_count      integer     not null,
  duration_buckets     integer[]   not null,

  constraint request_metrics_pkey primary key (minute, service, instance, method, route),
  constraint request_metrics_minute_aligned check (minute = date_trunc('minute', minute)),
  constraint request_metrics_server_side check (service in ('api', 'worker')),
  constraint request_metrics_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint request_metrics_method check (method in ('GET', 'POST', 'PATCH', 'PUT', 'DELETE')),
  constraint request_metrics_route_model
    check (route ~ '^/[A-Za-z0-9/_:.*\[\]-]{0,199}$' or route = 'unmatched'),
  constraint request_metrics_counts
    check (request_count >= 1
           and server_error_count between 0 and request_count
           and throttled_count between 0 and request_count),
  -- Fixed buckets (02 §20.5): <= 25, 50, 100, 250, 500 ms, 1, 2.5, 5 s, beyond. Histograms add up
  -- across instances; the p95 is computed at read time.
  constraint request_metrics_buckets
    check (array_ndims(duration_buckets) = 1
           and array_length(duration_buckets, 1) = 9
           and array_lower(duration_buckets, 1) = 1
           and 0 <= all (duration_buckets)
           and duration_buckets[1] + duration_buckets[2] + duration_buckets[3]
             + duration_buckets[4] + duration_buckets[5] + duration_buckets[6]
             + duration_buckets[7] + duration_buckets[8] + duration_buckets[9] = request_count)
);

comment on table ops.request_metrics is
  'One line per (minute, service, instance, method, route model) (02 §20.5): calls, 5xx, 429 and a '
  'histogram of durations in 9 fixed buckets (<= 25, 50, 100, 250, 500 ms, 1, 2.5, 5 s, beyond). '
  'Written once, after the minute ends, by influx_ops; never updated. 14 days, then hourly roll-up.';

create index if not exists request_metrics_purge_idx on ops.request_metrics (minute);

-- 7. Per-minute process health -----------------------------------------------------------

create table if not exists ops.process_metrics (
  minute                    timestamptz not null,
  service                   ops.service_name not null,
  instance                  text        not null,
  event_loop_delay_p99_ms   numeric(10, 2) not null,
  event_loop_delay_max_ms   numeric(10, 2) not null,
  rss_bytes                 bigint      not null,
  heap_used_bytes           bigint      not null,
  cpu_percent               numeric(7, 2) not null,

  constraint process_metrics_pkey primary key (minute, service, instance),
  constraint process_metrics_minute_aligned check (minute = date_trunc('minute', minute)),
  constraint process_metrics_server_side check (service in ('api', 'worker')),
  constraint process_metrics_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint process_metrics_values
    check (event_loop_delay_p99_ms >= 0
           and event_loop_delay_max_ms >= event_loop_delay_p99_ms
           and rss_bytes >= 0 and heap_used_bytes >= 0
           and cpu_percent between 0 and 6400)
);

comment on table ops.process_metrics is
  'Process health per minute (02 §20.5): event loop delay (the most direct slowness signal of a Node '
  'service), memory, processor. Written once by influx_ops; 14 days, then hourly roll-up.';

create index if not exists process_metrics_purge_idx on ops.process_metrics (minute);

-- 8. RLS and rights of influx_ops (E-6) -------------------------------------------------------

alter table ops.error_groups      enable row level security;
alter table ops.error_groups      force  row level security;
alter table ops.error_occurrences enable row level security;
alter table ops.error_occurrences force  row level security;
alter table ops.request_metrics   enable row level security;
alter table ops.request_metrics   force  row level security;
alter table ops.process_metrics   enable row level security;
alter table ops.process_metrics   force  row level security;

revoke all on ops.error_groups, ops.error_occurrences, ops.request_metrics, ops.process_metrics
  from public, anon, authenticated, service_role;

grant usage on schema ops to influx_ops;

-- Groups: the upsert of a fingerprint. INSERT of the description only (status, counts and
-- dates take their defaults); UPDATE of the count and of the last version (the trigger sets
-- last_seen_at and the regression); SELECT of the two columns the upsert reads.
grant insert (fingerprint, source, service, error_type, message, route, first_version, last_version)
   on ops.error_groups to influx_ops;
grant update (occurrence_count, last_version) on ops.error_groups to influx_ops;
grant select (fingerprint, occurrence_count) on ops.error_groups to influx_ops;

drop policy if exists error_groups_ops_insert on ops.error_groups;
create policy error_groups_ops_insert on ops.error_groups
  for insert to influx_ops
  with check (status = 'new' and occurrence_count = 1 and regression_count = 0);

drop policy if exists error_groups_ops_select on ops.error_groups;
create policy error_groups_ops_select on ops.error_groups
  for select to influx_ops
  using (true);

drop policy if exists error_groups_ops_update on ops.error_groups;
create policy error_groups_ops_update on ops.error_groups
  for update to influx_ops
  using (true)
  with check (true);

-- Occurrences: INSERT only, never read back; occurred_at is the transaction time.
grant insert (group_fingerprint, service, version, route, request_id, account_id, message, stack,
              user_agent_summary)
   on ops.error_occurrences to influx_ops;

drop policy if exists error_occurrences_ops_insert on ops.error_occurrences;
create policy error_occurrences_ops_insert on ops.error_occurrences
  for insert to influx_ops
  with check (occurred_at >= now() - interval '1 minute');

-- Metrics: INSERT only, for a minute that has ended within the last hour (a late flush after
-- a restart is accepted, a fabricated history is not).
grant insert on ops.request_metrics to influx_ops;
grant insert on ops.process_metrics to influx_ops;

drop policy if exists request_metrics_ops_insert on ops.request_metrics;
create policy request_metrics_ops_insert on ops.request_metrics
  for insert to influx_ops
  with check (minute + interval '1 minute' <= now() and minute >= now() - interval '1 hour');

drop policy if exists process_metrics_ops_insert on ops.process_metrics;
create policy process_metrics_ops_insert on ops.process_metrics
  for insert to influx_ops
  with check (minute + interval '1 minute' <= now() and minute >= now() - interval '1 hour');

-- 9. End-state assertions --------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the two roles: attributes of 03 P7
  select string_agg(rolname, ', ') into v_bad
    from pg_catalog.pg_roles
   where rolname in ('influx_ops', 'influx_ops_login')
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit
          or rolcanlogin <> (rolname = 'influx_ops_login'));
  if v_bad is not null then
    raise exception 'forbidden attribute on role(s): %', v_bad;
  end if;

  -- influx_ops_login is a member of influx_ops only, INHERIT FALSE, SET TRUE, no ADMIN;
  -- influx_ops is a member of nothing
  select string_agg(format('%s -> %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where mem.rolname in ('influx_ops', 'influx_ops_login')
     and not (mem.rolname = 'influx_ops_login' and grp.rolname = 'influx_ops'
              and not m.inherit_option and m.set_option and not m.admin_option);
  if v_bad is not null then
    raise exception 'unexpected membership(s): %', v_bad;
  end if;

  -- members of influx_ops: its login role, and the ADMIN-only grant to the migration role
  select string_agg(mem.rolname, ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_ops', 'influx_ops_login')
     and not (mem.rolname = 'influx_ops_login' and grp.rolname = 'influx_ops')
     and not (mem.rolname = current_user and not m.inherit_option and not m.set_option);
  if v_bad is not null then
    raise exception 'unexpected member(s) of the ops roles: %', v_bad;
  end if;

  -- no other role of ours holds anything on the ops schema
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_ops'
     and pg_catalog.has_schema_privilege(r.oid, 'ops', 'USAGE');
  if v_bad is not null then
    raise exception 'unexpected usage on schema ops: %', v_bad;
  end if;

  -- influx_ops reaches no business schema
  select string_agg(n.nspname, ', ') into v_bad
    from pg_catalog.pg_namespace n
   where n.nspname in ('identity', 'audit', 'billing', 'backoffice', 'leads', 'reference',
                       'influx', 'profiles', 'verification', 'campaigns', 'search', 'matching',
                       'messaging', 'auth_hooks')
     and pg_catalog.has_schema_privilege('influx_ops', n.oid, 'USAGE');
  if v_bad is not null then
    raise exception 'influx_ops reaches business schema(s): %', v_bad;
  end if;

  -- influx_ops never deletes nor reads an occurrence or a metric
  if pg_catalog.has_table_privilege('influx_ops', 'ops.error_groups', 'DELETE')
     or pg_catalog.has_table_privilege('influx_ops', 'ops.error_occurrences', 'DELETE')
     or pg_catalog.has_any_column_privilege('influx_ops', 'ops.error_occurrences', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_ops', 'ops.request_metrics', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_ops', 'ops.process_metrics', 'SELECT') then
    raise exception 'influx_ops may not delete, nor read an occurrence or a metric';
  end if;
end
$$;

reset createrole_self_grant;
