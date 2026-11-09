-- =============================================================================
-- 0234_verification_agent_opening
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 09 (jalons/l2f/09.md; l2f/modele.md §1 point 14, §2 "verification_requests",
-- "consumer_email_domains", §3 "0234", §4, §6, which prevails for every name; l2f/textes.md
-- « Messageries grand public », « Ouverture », « verification.agent_opened_notice »; l2f-fiche.md
-- invariants 9, 10, 12; decisions-detail.md D83, A + A-bis, tranchée le 2026-11-08; 06 RG51, RG52;
-- 08 RG9, RG53). A salesperson starts the verification of a member he already knows: same request,
-- same queue 4, same uniqueness, same decisions, no badge without a finding. A brand signed in with an
-- address of its own domain has nothing to do (A-bis): the base reads the domain of the login address,
-- never shows it, and the agent records the finding `login_address`; the registration stays checked.
--
-- 1. verification.opening_reasons, the closed list of the agent's reason (textes.md « Ouverture »:
--    invited_by_agent, existing_client, past_collaboration, other with a comment required).
-- 2. verification.verification_requests + opened_by (member, agent), opened_by_account_id,
--    opening_reason_code, opening_comment (1 to 1 000, the only free text, internal); reason <=>
--    author; agent => reason; reason => level other than the audience. Frozen once written by the
--    trigger verification_requests_freeze_opening (EC-L2F-09-2).
-- 3. verification.consumer_email_domains, the consumer mailboxes (textes.md list), written by the
--    migrations only; read by influx_verification_definer alone.
-- 4. verification.ownership_codes.observed_channel + login_address (a domain code only, by the shape
--    constraints of 0221).
-- 5. identity.login_domain_of(account) (influx_identity_definer, EXECUTE influx_verification_definer
--    ONLY): the domain of the VERIFIED login address, else NULL; never the address.
-- 6. The functions (influx_verification_definer, EXECUTE influx_agent and influx_admin):
--      open_request_for_member(...)      D83 A: the agent opens (or takes over) the request of an
--                                        active member, « Compte vérifié » of a line or « Marque
--                                        vérifiée », pending at once, its code issued, the brand's
--                                        internal block written if missing, one e-mail;
--      grant_brand_verified_by_login(...) A-bis: « Marque vérifiée » on the login address, the
--                                        register still consulted;
--      read_request_dossier()            recreated: + opened_by, opening_reason_code,
--                                        opening_comment, login_address_eligible;
--      lock_held_request(), open_request() recreated (D83 Q4): an account the caller holds is his
--                                        to decide on a request OPENED BY AN AGENT only;
--      login_address_ineligibility()     helper (SECURITY INVOKER, no EXECUTE).
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden   outside an active agent/admin in aal2; the caller's own account, an unknown
--                     one, another population (a creator for the brand badge and conversely, a line
--                     not of the account).
--   55000 account_unavailable; already_verified, retry_after, rejection_cap, duplicate_request (the
--         refusals of verification.open_request_of(), 0222); login_address_ineligible (DETAIL
--         unverified, consumer_domain, other_domain).
--   23514 website_domain_required, internal_details_required.
--   22023 level (the audience), reason, opening_comment, internal_details_invalid (DETAIL the field,
--         or internal_details_present); code_mismatch (no live domain code at the A-bis grant).
--
-- Rights (fiche invariant 10): the two tables RLS forced; nothing for influx_advertiser nor any
-- member; the reasons read by agent and admin in aal2; the consumer domains by the owner only.
--
-- Not here: the routes (L2F commit 15) and the screens (20); the e-mail body (12); the export and the
-- erasure of the opening (0235); the indicator of the second look (Q3, Lot 6bis); the amendments of
-- 06 RG51, 08 RG9, 15 RG36, 03 P7 (closure of the jalon).
--
-- EC-L2F-09 (micro-gaps, the safest choice):
--   EC-L2F-09-1  D83 Q4, read as the caller says (« ne vaut que pour les demandes ouvertes par un
--                agent »): the refusal of an account the caller holds (owner_agent_id) falls on a
--                request whose opened_by is agent; a member's request taken over keeps opened_by
--                member and the refusal (modele « files 4 d'origine membre inchangés »). The opening
--                itself refuses no held account (modele §6 lists own, unknown, population).
--   EC-L2F-09-2  opened_by is written at the creation only (member -> agent in the transaction that
--                created the draft, through verification.open_request_of(), the one copy of RG14 and
--                RG60); author, reason and comment once written are frozen, the comment may only be
--                emptied (the erasure, 0235). A second agent on the same open request writes nothing
--                on it, sends nothing, leaves a register line (taken_over).
--   EC-L2F-09-3  the code of an agent-opened request is drawn as RG23 says (new_ownership_code(), the
--                live one revoked) but WITHOUT verification.code_issued: one e-mail,
--                verification.agent_opened_notice (textes.md: the creator finds the code in his
--                space; the brand has nothing to do, A-bis). A taken-over draft keeps a live code, an
--                expired one is renewed; a pending request keeps its code (EC-L2E-08-4).
--   EC-L2F-09-4  the internal block given while one exists, or given for a creator: 22023
--                internal_details_invalid DETAIL internal_details_present (« sinon nuls »); the
--                message of the brand door (0222) is reused rather than modele's shorthand
--                `internal_details`, which apps/api already maps.
--   EC-L2F-09-5  A-bis writes the finding on the live domain code of the request (non revoked, even
--                past expires_at, EC-L2E-08-4) with observed_domain = the website domain of the
--                profile (the domain the badge attests), never the domain of the login address; no
--                live code: 22023 code_mismatch, nothing written.
--   EC-L2F-09-6  a consumer domain is refused with its subdomains; the login domain must be the
--                website domain or one of its subdomains (other_domain). Order of the DETAIL:
--                unverified, consumer_domain, other_domain.
--   EC-L2F-09-7  the dossier says login_address_eligible (NULL for a creator) and the opening (who,
--                why); the comment is internal, as internal_comment.
--
-- ROLLBACK (before any agent-opened request): drop the functions
-- verification.open_request_for_member(...), grant_brand_verified_by_login(...),
-- login_address_ineligibility(uuid, text), identity.login_domain_of(uuid); restore
-- verification.lock_held_request(), open_request() and read_request_dossier() from 0224 (as
-- influx_verification_definer, rights unchanged); drop trigger verification_requests_freeze_opening
-- and function verification.freeze_request_opening(); drop the four columns and their constraints;
-- drop tables verification.consumer_email_domains, verification.opening_reasons; restore the channel
-- constraint of 0221; recreate the policies outbox_events_verification_definer_insert (0233) and
-- operational_settings_verification_definer_select (0232); drop the policies and revoke the grants
-- of §5; delete the event types of §4.
-- =============================================================================

-- 1. The closed list of the agent's reason (modele §2; textes.md « Ouverture ») ---------------------------

create table if not exists verification.opening_reasons (
  code              text     not null primary key,
  label_key         text     not null,
  requires_comment  boolean  not null default false,
  position          smallint not null,
  is_active         boolean  not null default true,

  constraint opening_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint opening_reasons_label_key check (label_key = 'reason.verification_opening.' || code),
  constraint opening_reasons_position check (position > 0),
  constraint opening_reasons_position_unique unique (position)
);

comment on table verification.opening_reasons is
  'The closed list of the reason why an agent opens the verification of a member (0234; D83 (5); '
  'l2f/textes.md « Ouverture »): invited_by_agent (D54), existing_client, past_collaboration, other '
  '(a comment required). Read by agent and admin in aal2; written by the migrations.';
comment on column verification.opening_reasons.requires_comment is
  'The opening requires the agent''s internal comment (1 to 1 000 characters): other only.';

insert into verification.opening_reasons (code, label_key, requires_comment, position) values
  ('invited_by_agent',   'reason.verification_opening.invited_by_agent',   false, 1),
  ('existing_client',    'reason.verification_opening.existing_client',    false, 2),
  ('past_collaboration', 'reason.verification_opening.past_collaboration', false, 3),
  ('other',              'reason.verification_opening.other',              true,  4)
on conflict (code) do nothing;

-- 2. The origin of a request (modele §2 "verification_requests") ------------------------------------------

alter table verification.verification_requests
  add column if not exists opened_by            text not null default 'member',
  add column if not exists opened_by_account_id uuid references identity.accounts (id),
  add column if not exists opening_reason_code  text references verification.opening_reasons (code),
  add column if not exists opening_comment      text;

alter table verification.verification_requests
  drop constraint if exists verification_requests_opened_by,
  drop constraint if exists verification_requests_opening_author,
  drop constraint if exists verification_requests_opening_agent,
  drop constraint if exists verification_requests_opening_level,
  drop constraint if exists verification_requests_opening_comment;
alter table verification.verification_requests
  add constraint verification_requests_opened_by check (opened_by in ('member', 'agent')),
  -- modele §2: motif <=> auteur
  add constraint verification_requests_opening_author
    check ((opening_reason_code is null) = (opened_by_account_id is null)),
  -- agent => motif
  add constraint verification_requests_opening_agent
    check (opened_by <> 'agent' or opening_reason_code is not null),
  -- D83 (3): « Audience vérifiée » is never opened by an agent
  add constraint verification_requests_opening_level
    check (opening_reason_code is null or level <> 'audience_verified'),
  -- the internal comment of the opening, with its reason, 1 000 printable characters at most
  add constraint verification_requests_opening_comment
    check (opening_comment is null
           or (opening_reason_code is not null
               and char_length(opening_comment) between 1 and 1000
               and opening_comment ~ '[^[:space:]]'
               and opening_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'));

comment on column verification.verification_requests.opened_by is
  'D83 A (0234): who opened the request, member (his door, 0222) or agent '
  '(verification.open_request_for_member()); written at the creation, never changed (EC-L2F-09-2). '
  'An agent-opened request lifts the refusal of an account the caller holds (D83 Q4, EC-L2F-09-1).';
comment on column verification.verification_requests.opened_by_account_id is
  'D83 (5): the agent who opened the request, or took over the member''s open one; frozen once '
  'written. NULL <=> no reason.';
comment on column verification.verification_requests.opening_reason_code is
  'D83 (5): the agent''s reason, of verification.opening_reasons; never the audience level.';
comment on column verification.verification_requests.opening_comment is
  'D83 (5): the agent''s internal comment at the opening, 1 000 characters at most, NEVER shown to '
  'the member, sent by e-mail, written to the register nor exported; a decision writes its own '
  'internal_comment (modele point 14). Emptied by the erasure.';

-- 2.1 Written at the creation, frozen afterwards (EC-L2F-09-2)
create or replace function verification.freeze_request_opening()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- opened_by: member -> agent only on the draft created by THIS transaction, never written since
  if new.opened_by is distinct from old.opened_by
     and not (old.opened_by = 'member' and new.opened_by = 'agent' and old.status = 'draft'
              and old.opening_reason_code is null and old.created_at = pg_catalog.now()) then
    raise exception 'verification request: the origin is written at the creation only'
      using errcode = 'object_not_in_prerequisite_state', detail = 'request_opening';
  end if;
  -- author, reason and comment: written once; the comment may only be emptied (the erasure)
  if old.opening_reason_code is not null
     and (new.opening_reason_code is distinct from old.opening_reason_code
          or new.opened_by_account_id is distinct from old.opened_by_account_id
          or (new.opening_comment is distinct from old.opening_comment
              and new.opening_comment is not null)) then
    raise exception 'verification request: the opening is frozen once written'
      using errcode = 'object_not_in_prerequisite_state', detail = 'request_opening';
  end if;
  return new;
end
$$;

comment on function verification.freeze_request_opening() is
  'BEFORE UPDATE on verification.verification_requests (0234, EC-L2F-09-2): opened_by changes only '
  'from member to agent on a draft created in the same transaction and never opened by an agent; '
  'author, reason and comment of the opening are frozen once written, the comment may only be '
  'emptied (the erasure). 55000 DETAIL request_opening otherwise. SECURITY INVOKER.';

revoke all on function verification.freeze_request_opening()
  from public, anon, authenticated, service_role;

drop trigger if exists verification_requests_freeze_opening on verification.verification_requests;
create trigger verification_requests_freeze_opening
  before update on verification.verification_requests
  for each row execute function verification.freeze_request_opening();

-- 3. The consumer mailboxes (modele §2; textes.md « Messageries grand public ») ---------------------------

create table if not exists verification.consumer_email_domains (
  domain      text        not null primary key,
  created_at  timestamptz not null default now(),

  -- the shape of website_domain (0202) and of an observed domain (0221), lower case
  constraint consumer_email_domains_shape
    check (char_length(domain) <= 100 and domain = lower(domain)
           and domain ~ '^([[:alnum:]]([[:alnum:]-]{0,61}[[:alnum:]])?\.)+[[:alnum:]][[:alnum:]-]{0,61}[[:alnum:]]$')
);

comment on table verification.consumer_email_domains is
  'D83 A-bis (0234; l2f/textes.md): the consumer mailboxes; a login address on one of them, or on '
  'one of its subdomains, never proves the domain of a brand (06 RG51 amended). Written by the '
  'migrations only (an addition is a migration); read by influx_verification_definer alone.';

insert into verification.consumer_email_domains (domain) values
  ('gmail.com'), ('googlemail.com'), ('outlook.com'), ('outlook.fr'), ('hotmail.com'),
  ('hotmail.fr'), ('live.com'), ('live.fr'), ('msn.com'), ('yahoo.com'), ('yahoo.fr'),
  ('ymail.com'), ('icloud.com'), ('me.com'), ('mac.com'), ('aol.com'), ('proton.me'),
  ('protonmail.com'), ('pm.me'), ('gmx.com'), ('gmx.de'), ('gmx.fr'), ('gmx.net'), ('web.de'),
  ('t-online.de'), ('mail.com'), ('zoho.com'), ('yandex.com'), ('yandex.ru'), ('mail.ru'),
  ('orange.fr'), ('wanadoo.fr'), ('free.fr'), ('sfr.fr'), ('laposte.net'), ('libero.it'),
  ('qq.com'), ('163.com'), ('naver.com'), ('fastmail.com'), ('tutanota.com'), ('hey.com'),
  ('seznam.cz'), ('btinternet.com'), ('comcast.net')
on conflict (domain) do nothing;

-- 3.1 A-bis: the channel of the finding (a domain code, 0221 shape constraints)
alter table verification.ownership_codes drop constraint if exists ownership_codes_channel;
alter table verification.ownership_codes
  add constraint ownership_codes_channel
    check (observed_channel in ('dns_txt', 'web_page', 'login_address'));

comment on column verification.ownership_codes.observed_channel is
  'Where the domain code was found: dns_txt, web_page (06 RG51), or login_address (D83 A-bis, '
  '0234: the verified login address of the account is on the website domain; observed_domain is '
  'then the website domain, never the domain of the address).';

-- 4. Row level security, the rights of the business roles, the register (fiche invariant 10) --------------

alter table verification.opening_reasons enable row level security;
alter table verification.opening_reasons force row level security;
alter table verification.consumer_email_domains enable row level security;
alter table verification.consumer_email_domains force row level security;
revoke all on verification.opening_reasons, verification.consumer_email_domains
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

grant select on verification.opening_reasons to influx_agent, influx_admin;
drop policy if exists opening_reasons_internal_select on verification.opening_reasons;
create policy opening_reasons_internal_select on verification.opening_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

insert into audit.event_types (code, domain, subject_type, severity) values
  -- D83 (5): who, why, taken over or not, the responsible agent (codes and ids, never a text)
  ('verification.opened_by_agent',      'verification', 'verification_request', 'sensitive'),
  -- the queue only (never a register line): the e-mail « votre commercial a lancé la vérification »
  ('verification.agent_opened_notice',  'verification', 'verification_request', 'info')
on conflict (code) do nothing;

-- 5. What influx_verification_definer reads and writes for an opening -------------------------------------

-- 5.1 The request: created as a draft by verification.open_request_of() (0222), then made pending
-- with its origin; the origin read by the gates (D83 Q4)
grant select (opened_by, opened_by_account_id, opening_reason_code, opening_comment)
   on verification.verification_requests to influx_verification_definer;
grant insert (account_id, social_account_id, network_code, level)
   on verification.verification_requests to influx_verification_definer;
grant update (opened_by, opened_by_account_id, opening_reason_code, opening_comment)
   on verification.verification_requests to influx_verification_definer;

drop policy if exists verification_requests_verification_definer_insert
  on verification.verification_requests;
create policy verification_requests_verification_definer_insert
  on verification.verification_requests
  for insert to influx_verification_definer
  with check (account_id is distinct from (select influx.current_account_id())
              and status = 'draft' and opened_by = 'member' and opening_reason_code is null
              and claimed_by_account_id is null and decided_by_account_id is null);

-- 5.2 The code: drawn (RG21 to RG23), the live one revoked
grant insert (request_id, account_id, kind, code, expires_at)
   on verification.ownership_codes to influx_verification_definer;
grant update (revoked_at) on verification.ownership_codes to influx_verification_definer;

drop policy if exists ownership_codes_verification_definer_insert on verification.ownership_codes;
create policy ownership_codes_verification_definer_insert on verification.ownership_codes
  for insert to influx_verification_definer
  with check (account_id is distinct from (select influx.current_account_id())
              and revoked_at is null and observed_at is null);
drop policy if exists ownership_codes_verification_definer_revoke on verification.ownership_codes;
create policy ownership_codes_verification_definer_revoke on verification.ownership_codes
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id())
         and revoked_at is null and observed_at is null)
  with check (account_id is distinct from (select influx.current_account_id())
              and revoked_at is not null and observed_at is null);

-- 5.3 The internal block of a brand, written when it is missing (06 RG46, RG47; D83 (2) A)
grant insert (account_id, legal_name, registration_country_code, registration_number)
   on profiles.advertiser_internal_details to influx_verification_definer;
drop policy if exists advertiser_internal_details_verification_definer_insert
  on profiles.advertiser_internal_details;
create policy advertiser_internal_details_verification_definer_insert
  on profiles.advertiser_internal_details
  for insert to influx_verification_definer
  with check (account_id is distinct from (select influx.current_account_id()));

-- 5.4 The parameters of RG22 and RG60 join those of 0224 and 0232; the delay of queue 4 (the trigger
-- of 0221, invoker, computes the deadlines at the passage to pending)
drop policy if exists operational_settings_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_verification_definer_select on backoffice.operational_settings
  for select to influx_verification_definer
  using (key in ('claim_expiry_minutes', 'evidence_freshness_days', 'audience_badge_validity_days',
                 'brand_badge_validity_months', 'figures_gap_alert_percent',
                 'rejection_cap_window_days', 'dispute_reflection_hours',
                 'verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count'));

grant select (queue_code, is_active, target_decision_minutes, escalate_after_minutes, business_hours)
   on backoffice.sla_policies to influx_verification_definer;
grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_verification_definer;
drop policy if exists sla_policies_verification_definer_select on backoffice.sla_policies;
create policy sla_policies_verification_definer_select on backoffice.sla_policies
  for select to influx_verification_definer
  using (queue_code = 'verification');

-- 5.5 The consumer mailboxes (A-bis), read by the owner of the decisions only
grant select (domain) on verification.consumer_email_domains to influx_verification_definer;
drop policy if exists consumer_email_domains_verification_definer_select
  on verification.consumer_email_domains;
create policy consumer_email_domains_verification_definer_select
  on verification.consumer_email_domains
  for select to influx_verification_definer
  using (true);

-- 5.6 The reasons of an opening
grant select (code, requires_comment, is_active)
   on verification.opening_reasons to influx_verification_definer;
drop policy if exists opening_reasons_verification_definer_select on verification.opening_reasons;
create policy opening_reasons_verification_definer_select on verification.opening_reasons
  for select to influx_verification_definer
  using (true);

-- 5.7 The queue: the e-mail of an agent's opening, besides those of 0233
drop policy if exists outbox_events_verification_definer_insert on leads.outbox_events;
create policy outbox_events_verification_definer_insert on leads.outbox_events
  for insert to influx_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type in ('verification.decision', 'verification.revoked_notice',
                                   'verification.dispute_outcome',
                                   'verification.reconfirm_required',
                                   'verification.agent_opened_notice')
                    and destination = 'brevo_transactional')
                   or (event_type = 'lead.updated' and destination = 'brevo_contact')));

-- 5.8 The login address: its verification instant, read by the owner of the identity function
grant select (email_verified_at) on identity.accounts to influx_identity_definer;

-- 5.9 The helpers of the member doors (0222), executed by the opening (granted by their owner)
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
end
$$;
set role influx_creator_verification_definer;
grant execute on function verification.open_request_of(uuid, uuid, text, verification.badge_level)
   to influx_verification_definer;
grant execute on function verification.new_ownership_code() to influx_verification_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
end
$$;

-- 6. The domain of the login address (A-bis; influx_identity_definer) -------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;
set role influx_identity_definer;

create or replace function identity.login_domain_of(p_account_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- the part after the last @ of a VERIFIED login address (the code at 6 digits proved it), lower
  -- case, without a trailing dot; never the address itself
  select nullif(pg_catalog.lower(pg_catalog.rtrim(
           pg_catalog.substring(a.email, '@([^@]+)$'), '.')), '')
    from identity.accounts a
   where a.id = p_account_id and a.email_verified_at is not null
$$;

comment on function identity.login_domain_of(uuid) is
  'D83 A-bis (0234): the domain of the verified login address of the account (email_verified_at '
  'set), lower case, else NULL; NEVER the address. Read by the verification functions only, which '
  'never return it. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE '
  'for influx_verification_definer ONLY.';

revoke all on function identity.login_domain_of(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.login_domain_of(uuid) to influx_verification_definer;

reset role;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. The functions (influx_verification_definer) ----------------------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
set role influx_verification_definer;

-- the dossier changes its columns: dropped by its owner, recreated below (§7.4)
drop function if exists verification.read_request_dossier(uuid);

-- 7.1 The gates of queue 4 (D83 Q4, EC-L2F-09-1): 0224 restated but for the held account, which is the
-- caller's to examine and decide on a request opened by an agent
create or replace function verification.lock_held_request(p_request_id uuid, p_caller uuid)
returns table (
  account_id         uuid,
  social_account_id  uuid,
  network_code       text,
  level              verification.badge_level,
  population         text,
  claimed_at         timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry  record;
begin
  -- the request row first, locked: every act on an entry is serial on it
  select r.account_id, r.social_account_id, r.network_code, r.level, r.population,
         r.status::text as status, r.claimed_by_account_id, r.claimed_at, r.claim_expires_at,
         r.opened_by
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  -- unknown, a draft (no entry of the queue), the caller's own account (the policy hides it), an
  -- account he holds (08 RG53) unless an agent opened the request (D83 Q4): one answer
  if not found or v_entry.account_id = p_caller or v_entry.status = 'draft'
     or (v_entry.opened_by <> 'agent'
         and exists (select 1 from identity.accounts a
                      where a.id = v_entry.account_id and a.owner_agent_id = p_caller)) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.status <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- RG64, invariant 5: no examination nor decision without the caller's live claim
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_entry.account_id, v_entry.social_account_id, v_entry.network_code,
                      v_entry.level, v_entry.population, v_entry.claimed_at;
end
$$;

comment on function verification.lock_held_request(uuid, uuid) is
  'The gate of the acts on a held entry of queue 4 (0224, 0234): locks the request FOR UPDATE; 42501 '
  'for an unknown or draft request, one of the caller''s own account, or of an account he holds (08 '
  'RG53) unless the request was opened by an agent (D83 Q4, EC-L2F-09-1); 55000 entry_closed once it '
  'left pending; 55P03 no_live_claim (DETAIL the live holder or none) without the caller''s live claim '
  '(RG64). Returns its account, line, network, level, population and claim instant. SECURITY INVOKER '
  'owned by influx_verification_definer, no EXECUTE for anyone.';

create or replace function verification.open_request(p_request_id uuid)
returns table (
  outcome            text,
  holder_account_id  uuid,
  claimed_at         timestamptz,
  claim_expires_at   timestamptz,
  review_token       text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid := verification.require_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_outcome  text;
  v_holder   uuid;
  v_claimed  timestamptz;
  v_expires  timestamptz;
  v_token    text;
begin
  select r.account_id, r.status::text as status, r.claimed_by_account_id, r.claimed_at,
         r.claim_expires_at, r.opened_by
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  -- unknown, a draft, the caller's own account: one answer (EC-L2E-08-10)
  if not found or v_entry.account_id = v_caller or v_entry.status = 'draft' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 08 RG53, CA31: an open entry of an account the caller HOLDS is not his to examine, unless an
  -- agent opened it (D83 Q4); a closed one answers `closed` as to anybody (0215)
  if v_entry.status = 'pending' and v_entry.opened_by <> 'agent'
     and exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.status <> 'pending' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_entry.claimed_at;
    v_expires := v_entry.claim_expires_at;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;

    -- 04 l. 2465-2480: the condition IS the lock, the row count the answer
    update verification.verification_requests r
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where r.id = p_request_id
       and r.status = 'pending'
       and (r.claimed_by_account_id is null or r.claim_expires_at <= pg_catalog.now())
    returning r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      -- file.md A9: an expired claim taken over is written first, its holder and its real expiry
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_request_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'verification',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- RG64, 15 C2: « En cours — {prénom} », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := verification.request_review_token(p_request_id);
  end if;

  perform audit.append('queue.entry_opened', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function verification.open_request(uuid) is
  '08 RG43, RG53, RG64; 15 RG27 C1 to C3, RG35; file.md A9 (0224, 0234): an agent or an admin opens an '
  'entry of queue 4. Free, or its claim expired: claimed by an atomic conditional UPDATE, '
  'claim_expires_at = now() + claim_expiry_minutes (an expired claim taken over writes '
  'queue.claim_expired first). Returns (outcome, holder, claimed_at, claim_expires_at, review_token): '
  'claimed or held with the version token, read_only with the live holder, closed with nothing. Every '
  'opening writes queue.entry_opened {queue_code: verification, outcome}. 42501 for an unknown or '
  'draft request, the caller''s own account, a pending request of an account he holds unless an agent '
  'opened it (D83 Q4), outside an active agent or admin in aal2. SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 7.2 A-bis: why the login address does not prove the website domain, NULL when it does
create or replace function verification.login_address_ineligibility(
  p_account_id      uuid,
  p_website_domain  text)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- read by the base, never returned (A-bis): only the reason it does not fit leaves this function
  v_domain  text := identity.login_domain_of(p_account_id);
begin
  if v_domain is null then
    return 'unverified';
  end if;
  -- EC-L2F-09-6: a consumer mailbox, or one of its subdomains
  if exists (select 1 from verification.consumer_email_domains c
              where c.domain = v_domain
                 or pg_catalog.right(v_domain, pg_catalog.char_length(c.domain) + 1) = '.' || c.domain) then
    return 'consumer_domain';
  end if;
  -- the website domain itself, or one of its subdomains (as EC-L2E-08-9 for a code)
  if p_website_domain is null
     or (v_domain <> p_website_domain
         and pg_catalog.right(v_domain, pg_catalog.char_length(p_website_domain) + 1)
             <> '.' || p_website_domain) then
    return 'other_domain';
  end if;
  return null;
end
$$;

comment on function verification.login_address_ineligibility(uuid, text) is
  'D83 A-bis (0234, EC-L2F-09-6): NULL when the verified login address of the account is on the '
  'website domain or one of its subdomains, and on no consumer mailbox (nor a subdomain of one, '
  'verification.consumer_email_domains); otherwise unverified, consumer_domain or other_domain, in '
  'that order. The domain of the address never leaves it. SECURITY INVOKER owned by '
  'influx_verification_definer, no EXECUTE for anyone.';

-- 7.3 D83 A: the agent opens the verification of a member he knows (modele §6)
create or replace function verification.open_request_for_member(
  p_account_id                 uuid,
  p_social_account_id          uuid,
  p_level                      verification.badge_level,
  p_opening_reason_code        text,
  p_opening_comment            text,
  p_legal_name                 text,
  p_registration_country_code  text,
  p_registration_number        text)
returns table (
  request_id  uuid,
  status      text,
  created     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_nil        constant uuid := '00000000-0000-0000-0000-000000000000';
  v_caller     uuid := verification.require_agent(false);
  v_name       text := pg_catalog.btrim(p_legal_name);
  v_country    text := pg_catalog.upper(pg_catalog.btrim(p_registration_country_code));
  v_number     text := pg_catalog.btrim(p_registration_number);
  v_given      integer := pg_catalog.num_nonnulls(p_legal_name, p_registration_country_code,
                                                  p_registration_number);
  v_requires   boolean;
  v_target     record;
  v_network    text;
  v_domain     text;
  v_kind       text;
  v_has_block  boolean := true;
  v_open       record;
  v_created    boolean := false;
  v_opened     uuid;
  v_first      boolean;
  v_days       integer;
  v_code_id    uuid;
  v_event      uuid := pg_catalog.gen_random_uuid();
begin
  -- D83 (3): « Audience vérifiée » stays the finding on an evidence the creator deposits
  if p_level is null or p_level not in ('account_verified', 'brand_verified') then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  -- D83 (5): a reason of the closed list, the comment in complement (required for other)
  select r.requires_comment into v_requires
    from verification.opening_reasons r
   where r.code = p_opening_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  if (p_opening_comment is null and v_requires)
     or (p_opening_comment is not null
         and (pg_catalog.char_length(p_opening_comment) not between 1 and 1000
              or p_opening_comment !~ '[^[:space:]]'
              or p_opening_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')) then
    raise exception 'opening_comment' using errcode = 'invalid_parameter_value', detail = 'opening_comment';
  end if;

  -- the target: another account, of the population of the level (one answer for all, T14)
  select a.status::text as status, a.owner_agent_id into v_target
    from identity.accounts a
   where a.id = p_account_id;
  if not found or p_account_id = v_caller
     or not exists (select 1 from identity.account_roles r
                     where r.account_id = p_account_id
                       and r.role::text = case p_level when 'brand_verified' then 'advertiser'
                                                       else 'creator' end) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_level = 'account_verified' then
    select l.network_code into v_network
      from profiles.creator_social_accounts l
     where l.id = p_social_account_id and l.account_id = p_account_id;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_kind := 'network';
  else
    if p_social_account_id is not null then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    select p.website_domain into v_domain
      from profiles.advertiser_profiles p where p.account_id = p_account_id;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_kind := 'domain';
  end if;
  -- RG44 point 1, EC-L2E-06-6: never a suspended or deleted account
  if v_target.status <> 'active' then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;

  -- the brand: its domain (CA26), its internal block written by the agent when missing (RG47)
  if p_level = 'brand_verified' then
    if v_domain is null then
      raise exception 'website_domain_required'
        using errcode = 'check_violation', detail = 'website_domain_required';
    end if;
    v_has_block := exists (select 1 from profiles.advertiser_internal_details d
                            where d.account_id = p_account_id);
  end if;
  -- EC-L2F-09-4: « s'il manque, trois champs exigés, sinon nuls »
  if v_has_block and v_given > 0 then
    raise exception 'internal_details_invalid'
      using errcode = 'invalid_parameter_value', detail = 'internal_details_present';
  end if;
  if not v_has_block then
    if v_given = 0 then
      raise exception 'internal_details_required'
        using errcode = 'check_violation', detail = 'internal_details_required';
    end if;
    -- RG46, as the brand door (0222)
    if v_name is null or pg_catalog.char_length(v_name) not between 1 and 160
       or v_name ~ '[[:cntrl:]]' then
      raise exception 'internal_details_invalid'
        using errcode = 'invalid_parameter_value', detail = 'legal_name';
    end if;
    if v_country is null or v_country !~ '^[A-Z]{2}$' then
      raise exception 'internal_details_invalid'
        using errcode = 'invalid_parameter_value', detail = 'registration_country_code';
    end if;
    if v_number is null or pg_catalog.char_length(v_number) not between 1 and 40
       or v_number ~ '[[:cntrl:]]' then
      raise exception 'internal_details_invalid'
        using errcode = 'invalid_parameter_value', detail = 'registration_number';
    end if;
  end if;

  -- D83 (7): the member's open request is taken over, never doubled; otherwise opened by the one
  -- copy of RG14 and RG60 (0222)
  select r.id, r.status::text as status, r.opening_reason_code into v_open
    from verification.verification_requests r
   where r.account_id = p_account_id
     and coalesce(r.social_account_id, v_nil) = coalesce(p_social_account_id, v_nil)
     and r.level = p_level and r.status in ('draft', 'pending')
     for update;
  if not found then
    select o.request_id, o.created into v_opened, v_created
      from verification.open_request_of(p_account_id, p_social_account_id, v_network, p_level) o;
    select r.id, r.status::text as status, r.opening_reason_code into v_open
      from verification.verification_requests r
     where r.id = v_opened
       for update;
  end if;
  v_first := v_open.opening_reason_code is null;

  if not v_has_block then
    begin
      insert into profiles.advertiser_internal_details
        (account_id, legal_name, registration_country_code, registration_number)
      values (p_account_id, v_name, v_country, v_number);
    exception when foreign_key_violation then
      raise exception 'internal_details_invalid'
        using errcode = 'invalid_parameter_value', detail = 'registration_country_code';
    end;
  end if;

  -- EC-L2F-09-3: a draft goes to the queue with a live code, drawn as RG23 says, without the
  -- e-mail « code généré » (the agent's notice is the one e-mail)
  if v_open.status = 'draft'
     and not exists (select 1 from verification.ownership_codes c
                      where c.request_id = v_open.id and c.revoked_at is null
                        and c.expires_at > pg_catalog.now()) then
    select (s.value)::integer into v_days
      from backoffice.operational_settings s where s.key = 'verification_code_validity_days';
    if v_days is null then
      raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
    end if;
    update verification.ownership_codes c
       set revoked_at = pg_catalog.now()
     where c.request_id = v_open.id and c.revoked_at is null;
    for attempt in 1 .. 5 loop
      begin
        insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
        values (v_open.id, p_account_id, v_kind, verification.new_ownership_code(),
                pg_catalog.now() + pg_catalog.make_interval(days => v_days))
        returning id into v_code_id;
        exit;
      exception when unique_violation then
        -- the request row is locked: only a collision of codes lands here
        if attempt = 5 then
          raise;
        end if;
      end;
    end loop;
    perform audit.append('verification.code_generated', 'verification_request', v_open.id,
                         pg_catalog.jsonb_build_object('code_id', v_code_id, 'kind', v_kind));
  end if;

  -- pending at once (the deadlines frozen by the trigger of 0221); the origin written once
  update verification.verification_requests r
     set status               = 'pending',
         opened_by            = case when v_created then 'agent' else r.opened_by end,
         opened_by_account_id = case when v_first then v_caller else r.opened_by_account_id end,
         opening_reason_code  = case when v_first then p_opening_reason_code
                                     else r.opening_reason_code end,
         opening_comment      = case when v_first then p_opening_comment else r.opening_comment end
   where r.id = v_open.id;

  if v_open.status = 'draft' then
    perform audit.append('verification.submitted', 'verification_request', v_open.id,
                         pg_catalog.jsonb_build_object('level', p_level));
  end if;
  perform audit.append('verification.opened_by_agent', 'verification_request', v_open.id,
                       pg_catalog.jsonb_build_object(
                         'level', p_level,
                         'reason_code', p_opening_reason_code,
                         'taken_over', not v_created,
                         'responsible_agent', coalesce(v_target.owner_agent_id = v_caller, false)));

  -- D83 (6): the member is told, in his language, by the worker (email.json, D69); ids only
  if v_first then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_event, 'verification.agent_opened_notice', 'brevo_transactional',
            'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                          'request_id', v_open.id,
                                          'email_code', 'verification.agent_opened_notice'),
            'verification.agent_opened_notice:' || v_open.id::text);
  end if;

  return query select v_open.id, 'pending'::text, v_created;
end
$$;

comment on function verification.open_request_for_member(uuid, uuid, verification.badge_level, text, text, text, text, text) is
  'D83 A (0234; modele §6): an active agent or admin in aal2 opens the verification of an active '
  'member, « Compte vérifié » of one of his lines (p_social_account_id) or « Marque vérifiée » (line '
  'NULL), with a reason of verification.opening_reasons and an internal comment (required for '
  'other). The member''s draft or pending request of the triplet is taken over, never doubled '
  '(opened_by unchanged); otherwise verification.open_request_of() opens it (RG14, RG60) and '
  'opened_by is agent. Pending at once, a live code ensured (no code e-mail, EC-L2F-09-3), the '
  'brand''s internal block written when missing (three fields, else NULL), author, reason and comment '
  'written once; verification.agent_opened_notice queued once; register lines verification.requested '
  '(created), verification.code_generated, verification.submitted (a draft), '
  'verification.opened_by_agent {level, reason_code, taken_over, responsible_agent}. Returns '
  '(request_id, pending, created). 42501 own, unknown or other population; 55000 account_unavailable '
  'and those of open_request_of(); 23514 website_domain_required, internal_details_required; 22023 '
  'level, reason, opening_comment, internal_details_invalid. SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 7.4 The dossier: 0224 restated, plus the opening and the eligibility of the login address
create function verification.read_request_dossier(p_request_id uuid)
returns table (
  request_id                 uuid,
  account_id                 uuid,
  population                 text,
  level                      text,
  network_code               text,
  submitted_at               timestamptz,
  sla_due_at                 timestamptz,
  escalate_at                timestamptz,
  reexamine_reason_code      text,
  reexamined_at              timestamptz,
  escalated_at               timestamptz,
  social_account_id          uuid,
  handle                     text,
  pseudonym                  text,
  profile_url                text,
  code_expires_at            timestamptz,
  trade_name                 text,
  website_domain             text,
  legal_name                 text,
  registration_country_code  text,
  registration_number        text,
  evidence                   jsonb,
  history                    jsonb,
  badges                     jsonb,
  recent_rejections          integer,
  same_handle_accounts       integer,
  handle_verified_elsewhere  boolean,
  review_token               text,
  opened_by                  text,
  opening_reason_code        text,
  opening_comment            text,
  login_address_eligible     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
  v_window  integer;
  v_nil     constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  select (s.value)::integer into v_window
    from backoffice.operational_settings s where s.key = 'rejection_cap_window_days';

  -- one query, one snapshot: the token is the token of the view shown (EC-L2E-08-13)
  return query
    select r.id, r.account_id, r.population, r.level::text, r.network_code, r.submitted_at,
           r.sla_due_at, r.escalate_at, r.reexamine_reason_code, r.reexamined_at, r.escalated_at,
           r.social_account_id, l.handle, l.pseudonym, l.profile_url,
           -- EC-L2E-08-3: the expiry of the live code, never the code itself
           (select c.expires_at from verification.ownership_codes c
             where c.request_id = r.id and c.revoked_at is null),
           p.legal_name, p.website_domain, d.legal_name, d.registration_country_code::text,
           d.registration_number,
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', e.id, 'byte_size', e.byte_size, 'width', e.width,
                              'height', e.height, 'activated_at', e.activated_at)
                              order by e.activated_at, e.id)
                       from verification.evidence_files e
                      where e.request_id = r.id and e.state = 'active'), '[]'::jsonb),
           -- RG55, RG60: the history of the triplet, refusals included
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', h.id, 'level', h.level, 'status', h.status,
                              'submitted_at', h.submitted_at, 'decided_at', h.decided_at,
                              'rejection_reason_code', h.rejection_reason_code)
                              order by h.created_at desc, h.id)
                       from verification.verification_requests h
                      where h.account_id = r.account_id and h.id <> r.id
                        and coalesce(h.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)),
                    '[]'::jsonb),
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', b.id, 'level', b.level, 'state', b.state,
                              'granted_at', b.granted_at, 'expires_at', b.expires_at)
                              order by b.granted_at desc, b.id)
                       from verification.badges b
                      where b.account_id = r.account_id
                        and coalesce(b.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)),
                    '[]'::jsonb),
           (select pg_catalog.count(*)::integer
              from verification.verification_requests x
             where x.account_id = r.account_id
               and coalesce(x.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)
               and x.level = r.level and x.status = 'rejected'
               and x.decided_at > pg_catalog.now() - pg_catalog.make_interval(days => coalesce(v_window, 30))),
           -- edge case l. 800: other accounts declaring the same handle on the same network
           (select pg_catalog.count(distinct o.account_id)::integer
              from profiles.creator_social_accounts o
             where l.handle is not null and o.account_id <> r.account_id
               and o.network_code = r.network_code
               and pg_catalog.lower(pg_catalog.ltrim(o.handle, '@'))
                   = pg_catalog.lower(pg_catalog.ltrim(l.handle, '@'))),
           exists (select 1 from verification.badges w
                    where l.handle is not null and w.account_id <> r.account_id
                      and w.network_code = r.network_code and w.level = 'account_verified'
                      and w.state in ('active', 'to_refresh', 'to_reconfirm')
                      and pg_catalog.lower(pg_catalog.ltrim(w.observed_handle_at_decision, '@'))
                          = pg_catalog.lower(pg_catalog.ltrim(l.handle, '@'))),
           verification.request_review_token(r.id),
           -- D83 (5): who opened the request and why (EC-L2F-09-7)
           r.opened_by, r.opening_reason_code, r.opening_comment,
           -- A-bis: the login address proves the domain, without saying which (NULL: a creator)
           case when r.population = 'brand'
                then verification.login_address_ineligibility(r.account_id, p.website_domain) is null
           end
      from verification.verification_requests r
      left join profiles.creator_social_accounts l
             on l.id = r.social_account_id and l.account_id = r.account_id
      left join profiles.advertiser_profiles p
             on p.account_id = r.account_id and r.population = 'brand'
      left join profiles.advertiser_internal_details d
             on d.account_id = r.account_id and r.population = 'brand'
     where r.id = p_request_id;
end
$$;

comment on function verification.read_request_dossier(uuid) is
  '08 RG55, RG63 (0224, 0234): the holder of a live claim reads the dossier of the entry, one row: the '
  'request and its deadlines, the line (handle, pseudonym, URL; NEVER a declared figure, -19), the '
  'expiry of the live code (never the code, EC-L2E-08-3), for a brand its trade name, domain and '
  'internal block; the active evidence (metadata, never the key), the history of the triplet and its '
  'badges; the alerts: refusals of the triplet in rejection_cap_window_days, other accounts '
  'declaring the same handle, a holding account badge of another account on that handle (edge case '
  'l. 800); the review token of this snapshot; the opening (opened_by, reason, internal comment, D83); '
  'for a brand login_address_eligible (A-bis, never the address nor its domain). The refusals of '
  'verification.lock_held_request(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 7.5 A-bis: « Marque vérifiée » on the login address, the register still consulted (06 RG51, RG52)
create or replace function verification.grant_brand_verified_by_login(
  p_request_id          uuid,
  p_review_token        text,
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
  v_caller      uuid := verification.require_agent(false);
  v_entry       record;
  v_brand       record;
  v_ineligible  text;
  v_code        uuid;
  v_months      integer;
  v_badge       uuid;
  v_decided     timestamptz;
  v_late        boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'brand_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select p.website_domain, d.registration_country_code, d.account_id is not null as has_details,
         a.status::text as account_status, a.owner_agent_id, r.opened_by,
         verification.request_review_token(p_request_id) as token
    into v_brand
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
    join verification.verification_requests r on r.id = p_request_id
    left join profiles.advertiser_internal_details d on d.account_id = p.account_id
   where p.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_brand.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if v_brand.account_status <> 'active' then
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
  -- A-bis: the verified login address on the website domain, no consumer mailbox (EC-L2F-09-6)
  v_ineligible := verification.login_address_ineligibility(v_entry.account_id, v_brand.website_domain);
  if v_ineligible is not null then
    raise exception 'login_address_ineligible'
      using errcode = 'object_not_in_prerequisite_state', detail = v_ineligible;
  end if;
  -- RG52, D79 (12): the registration is still the agent's finding, in an active free register of
  -- the country of registration, or GLEIF
  if not exists (select 1 from verification.registry_sources s
                  where s.id = p_registry_source_id and s.is_active
                    and (s.source_type = 'gleif'
                         or s.country_code = v_brand.registration_country_code)) then
    raise exception 'no_registry_source'
      using errcode = 'object_not_in_prerequisite_state', detail = 'no_registry_source';
  end if;

  -- EC-L2F-09-5: the finding on the live domain code, the website domain it attests
  select c.id into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'domain' and c.revoked_at is null;
  if not found then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;
  update verification.ownership_codes c
     set observed_by_account_id = v_caller,
         observed_at            = pg_catalog.now(),
         observed_domain        = v_brand.website_domain,
         observed_channel       = 'login_address'
   where c.id = v_code;

  select (s.value)::integer into v_months
    from backoffice.operational_settings s where s.key = 'brand_badge_validity_months';
  if v_months is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

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
                       pg_catalog.jsonb_build_object(
                         'level', v_entry.level, 'badge_id', v_badge, 'late', v_late,
                         'channel', 'login_address',
                         'agent_opened', v_brand.opened_by = 'agent',
                         'responsible_agent', coalesce(v_brand.owner_agent_id = v_caller, false)));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_brand_verified_by_login(uuid, text, uuid, text) is
  'D83 A-bis; 06 RG51 amended, RG52; D79 (12) (0234): the holder of a live claim grants « Marque '
  'vérifiée » on any brand request without a code read: the verified login address of the account is '
  'on the website domain or one of its subdomains, on no consumer mailbox (the base reads it, never '
  'shows it), and the register is consulted (an active source of the country of registration, or '
  'GLEIF). The finding on the live domain code (channel login_address, the website domain); the '
  'request approved; a badge active for brand_badge_validity_months (a holding one replaced); '
  'verification.decision and lead.updated queued; verification.granted {level, badge_id, late, '
  'channel, agent_opened, responsible_agent}. Returns (granted, badge_id, decided_at, sla_breached). '
  '22023 internal_comment, level or code_mismatch (no live code); 23514 website_domain_required or '
  'internal_details_required; 55000 stale_token, account_unavailable, login_address_ineligible '
  '(DETAIL unverified, consumer_domain, other_domain) or no_registry_source; then the refusals of '
  'verification.lock_held_request(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 7.6 The rights on the functions (as their owner)
revoke all on function verification.login_address_ineligibility(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function verification.open_request_for_member(uuid, uuid, verification.badge_level, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function verification.read_request_dossier(uuid)
  from public, anon, authenticated, service_role;
revoke all on function verification.grant_brand_verified_by_login(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  verification.open_request_for_member(uuid, uuid, verification.badge_level, text, text, text, text, text),
  verification.read_request_dossier(uuid),
  verification.grant_brand_verified_by_login(uuid, text, uuid, text)
  to influx_agent, influx_admin;

reset role;
revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 8. End-state assertions ---------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- the functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('identity.login_domain_of(uuid)', 'influx_identity_definer', true,
       array['influx_verification_definer']),
      ('verification.login_address_ineligibility(uuid,text)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.lock_held_request(uuid,uuid)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.open_request(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.open_request_for_member(uuid,uuid,verification.badge_level,text,text,text,text,text)',
       'influx_verification_definer', true, array['influx_agent', 'influx_admin']),
      ('verification.read_request_dossier(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.grant_brand_verified_by_login(uuid,text,uuid,text)',
       'influx_verification_definer', true, array['influx_agent', 'influx_admin']),
      -- the helpers of the member doors, executed by the opening as well (granted by their owner)
      ('verification.open_request_of(uuid,uuid,text,verification.badge_level)',
       'influx_creator_verification_definer', false,
       array['influx_identity_definer', 'influx_verification_definer']),
      ('verification.new_ownership_code()', 'influx_creator_verification_definer', false,
       array['influx_identity_definer', 'influx_verification_definer'])
    ) as f (sig, owner, definer, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or p.prosecdef is distinct from f.definer
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- RLS enabled, forced and policed on the two new tables
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'verification'::regnamespace
     and c.relname in ('opening_reasons', 'consumer_email_domains')
     and not (c.relrowsecurity and c.relforcerowsecurity
              and exists (select 1 from pg_catalog.pg_policies p
                           where p.schemaname = 'verification' and p.tablename = c.relname));
  if v_bad is not null then
    raise exception 'row level security not enabled, forced and policed on: %', v_bad;
  end if;

  -- 09.md « Arrêt si »: the login address never leaves the base. No execution role reads the e-mail
  -- through a verification function: the only function that reads it returns its domain, to the
  -- owner of the decisions alone, whose functions return a boolean or a code
  if exists (select 1 from pg_catalog.pg_proc p
              where p.pronamespace = 'verification'::regnamespace
                and p.prosrc ilike '%a.email%') then
    raise exception 'a verification function reads the login address itself';
  end if;
  if pg_catalog.has_column_privilege('influx_verification_definer', 'identity.accounts', 'email',
                                     'SELECT') then
    raise exception 'influx_verification_definer reads the login address';
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace in ('verification'::regnamespace, 'identity'::regnamespace)
     and p.proname in ('open_request_for_member', 'grant_brand_verified_by_login',
                       'login_address_ineligibility', 'login_domain_of', 'read_request_dossier')
     and (pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_creator', p.oid, 'EXECUTE'));
  if v_bad is not null then
    raise exception 'a member role may execute: %', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_creator', 'verification.consumer_email_domains',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_creator', 'verification.opening_reasons',
                                            'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_column_privilege('influx_creator', 'verification.verification_requests',
                                        'opening_comment', 'SELECT') then
    raise exception 'influx_creator reads the opening or the consumer mailboxes';
  end if;

  -- still no execution role writing the schema verification
  select string_agg(r.rolname || ' ' || c.relname, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relnamespace = 'verification'::regnamespace and c.relkind in ('r', 'p')
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification table: %', v_bad;
  end if;

  -- the closed lists
  if (select pg_catalog.array_agg(code order by position) from verification.opening_reasons
       where is_active) is distinct from
       array['invited_by_agent', 'existing_client', 'past_collaboration', 'other']
     or (select pg_catalog.array_agg(code) from verification.opening_reasons where requires_comment)
        is distinct from array['other'] then
    raise exception 'the opening reasons are not those of l2f/textes.md';
  end if;
  if (select count(*) from verification.consumer_email_domains) < 45 then
    raise exception 'the consumer mailboxes of l2f/textes.md are not all there';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_verification_definer', 'influx_creator_verification_definer',
                         'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
