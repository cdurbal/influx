-- =============================================================================
-- 0105_identity_email_health
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 2. The delivery incidents of an address (04 §5.1): since D37
-- the address IS the authentication factor, so a bounce does not degrade the
-- marketing, it CLOSES the account. This state belongs to identity, not to leads.
--
--   identity.email_delivery_incidents  APPEND-ONLY (03 P8: no UPDATE / DELETE /
--                                      TRUNCATE right, plus the trigger that stops even
--                                      the owner); idempotence of the Brevo webhooks by
--                                      a unique constraint on provider_event_id (04 §12.1
--                                      point 3: the webhooks are not signed).
--
-- Writer: the worker, from the Brevo webhook events (J7, EC-12), with its grant then;
-- it also sets accounts.email_status = 'undeliverable' on a hard bounce of the
-- TRANSACTIONAL channel only. Readers now: agent and admin in aal2 (the account page,
-- "why is this address unreachable?", 04 §10.1; the queue "unreachable addresses").
-- Retention (04 §8): 24 months after occurred_at, purge by 0601 (Lot 6).
--
-- ROLLBACK (before any real line): drop table identity.email_delivery_incidents; drop
-- type identity.email_incident, identity.email_channel.
-- =============================================================================

do $$
begin
  create type identity.email_channel as enum ('transactional', 'marketing');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.email_incident as enum ('hard_bounce', 'soft_bounce', 'spam_complaint', 'blocked');
exception when duplicate_object then null;
end
$$;

comment on type identity.email_channel is
  'transactional: the flow that carries the sign-in code and the service e-mails; marketing: the '
  'commercial flow. Only a transactional hard bounce closes an account (04 §5.1).';
comment on type identity.email_incident is
  'Incident kinds reported by the provider (16 RG106): hard_bounce, soft_bounce, spam_complaint, blocked.';

create table if not exists identity.email_delivery_incidents (
  id                 bigint      generated always as identity primary key,
  account_id         uuid        not null references identity.accounts (id),
  email_address      text        not null,
  channel            identity.email_channel  not null,
  incident_type      identity.email_incident not null,
  provider           text        not null,
  provider_event_id  text        not null,
  occurred_at        timestamptz not null,
  payload            jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),

  -- 04 §12.1 point 3: a bounce notified twice counts once (unsigned webhooks)
  constraint email_delivery_incidents_provider_event_key unique (provider_event_id),
  constraint email_delivery_incidents_provider check (provider in ('brevo')),
  constraint email_delivery_incidents_provider_event_length
    check (length(provider_event_id) between 1 and 200),
  constraint email_delivery_incidents_address_normalized
    check (email_address = lower(email_address) and position('@' in email_address) > 1
           and length(email_address) <= 320),
  constraint email_delivery_incidents_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint email_delivery_incidents_payload_size   check (pg_column_size(payload) <= 2000),
  constraint email_delivery_incidents_not_future
    check (occurred_at <= created_at + interval '5 minutes')
);

comment on table identity.email_delivery_incidents is
  'Delivery incidents of the address of an account (04 §5.1). APPEND-ONLY. A hard bounce of the '
  'transactional channel makes the account unreachable (accounts.email_status, D37); a marketing '
  'incident feeds leads.contact_sync_states and never closes an account. Personal data (the address): '
  'retention 24 months after occurred_at (04 §8).';
comment on column identity.email_delivery_incidents.email_address is
  'The address AT THE TIME OF THE INCIDENT, never the current one (04 R7): a later correction does '
  'not rewrite what bounced.';
comment on column identity.email_delivery_incidents.provider_event_id is
  'Event id of the provider: idempotence of the webhooks, a bounce notified twice counts once.';
comment on column identity.email_delivery_incidents.occurred_at is
  'Time of the incident at the provider (not the reception time, which is created_at).';
comment on column identity.email_delivery_incidents.payload is
  'SMTP code and reason returned by the provider: codes and short texts only, never a message body.';

create index if not exists email_delivery_incidents_account_idx
  on identity.email_delivery_incidents (account_id, occurred_at desc);
comment on index identity.email_delivery_incidents_account_idx is
  'Account page of the backoffice: "why is this address unreachable?" (04 §10.4).';

drop trigger if exists email_delivery_incidents_append_only on identity.email_delivery_incidents;
create trigger email_delivery_incidents_append_only
  before update or delete on identity.email_delivery_incidents
  for each row execute function influx.assert_append_only();

drop trigger if exists email_delivery_incidents_no_truncate on identity.email_delivery_incidents;
create trigger email_delivery_incidents_no_truncate
  before truncate on identity.email_delivery_incidents
  for each statement execute function influx.assert_append_only();

alter table identity.email_delivery_incidents enable row level security;
alter table identity.email_delivery_incidents force  row level security;
revoke all on identity.email_delivery_incidents from public, anon, authenticated, service_role;

-- 03 §3.1 "Compte — lister et consulter (tous)" L·J: agent and admin in aal2. Never a member.
grant select on identity.email_delivery_incidents to influx_agent, influx_admin;

drop policy if exists email_delivery_incidents_internal_select on identity.email_delivery_incidents;
create policy email_delivery_incidents_internal_select on identity.email_delivery_incidents
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

do $$
declare
  v_bad text;
begin
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, 'identity.email_delivery_incidents', 'UPDATE')
          or pg_catalog.has_any_column_privilege(r.oid, 'identity.email_delivery_incidents', 'INSERT')
          or pg_catalog.has_table_privilege(r.oid, 'identity.email_delivery_incidents', 'DELETE')
          or pg_catalog.has_table_privilege(r.oid, 'identity.email_delivery_incidents', 'TRUNCATE')
          or (pg_catalog.has_any_column_privilege(r.oid, 'identity.email_delivery_incidents', 'SELECT')
              and r.rolname not in ('influx_agent', 'influx_admin')));
  if v_bad is not null then
    raise exception 'unexpected right(s) on identity.email_delivery_incidents: %', v_bad;
  end if;
end
$$;
