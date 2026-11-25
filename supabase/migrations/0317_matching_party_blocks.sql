-- =============================================================================
-- 0317_matching_party_blocks
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 04 (jalons/l3e/04.md; l3e-fiche.md invariants 1, 4, 15, 16;
-- jalons/l3e/modele.md §9, which PREVAILS for every name; 04 §5.6 « matching.party_blocks »; 10 RG28
-- to RG31, Q11; lot3-plan.md, answer 3 of 2026-11-13: the table and the exclusion at Lot 3, the
-- gesture at Lot 4 from the conversation). The block between a brand and a creator, without any
-- gesture: two tables of the schema matching (born empty, its other tables come with Lot 4) and the
-- exclusion of a blocked pair from the creator's read of the open campaigns. The creator search
-- (0319) excludes the pair through its own owner. Signalled I-4 (03): GRANTs, policies, a helper of
-- a SECURITY DEFINER door recreated by its owner; audit.* is read only (the two codes exist since
-- 0303, asserted here).
--
-- 1. matching.block_reasons (04 §5.6): code, label_key (R8: no label in base), available_to_side
--    (advertiser, creator, influx, any), requires_comment, is_active. EMPTY (modele §9: the reasons
--    come with the gesture, Q11).
-- 2. matching.party_blocks (04 §5.6): the pair named by role (advertiser_account_id,
--    creator_account_id, never blocker / blocked), who blocked and from which side, a typed reason,
--    a comment of at most 1 000 characters, its instants; ONE active block per pair whoever posed it
--    (party_blocks_active_idx, unique partial), the reverse index by creator (04 §10.3). A lift is
--    kept (lifted_at, lifted_by_account_id, lift_reason_code), never deleted: a new block after a
--    lift is a new row.
-- 3. Two invoker triggers: matching.check_party_block() (born active; the reason active, of the
--    side that blocks or of any side, its comment when it requires one; the advertiser column holds
--    an advertiser, the creator column a creator, an INFLUX block an agent or an admin) and
--    matching.guard_party_block_write() (for every influx_% role: the lift once, nothing else
--    changed; the delete of the erasure, influx_privacy_definer, 0318; 55000 otherwise).
-- 4. Rights: RLS enabled and forced on both tables, nothing to anon, authenticated, service_role
--    nor any execution role (modele §9: no member, agent nor admin right at Lot 3); a RESTRICTIVE
--    policy refuses every row to influx_advertiser and influx_creator on each (pattern 0316).
--    influx_campaign_feed_definer reads THREE columns of party_blocks (the pair and lifted_at),
--    bounded to the caller's active blocks: never the reason, the comment nor who blocked (RG30).
-- 5. search.visible_campaigns(creator) recreated at the same signature by its owner: a campaign
--    whose brand and the creator hold an active block, in either direction, is absent, silently
--    (RG28, RG29; 11 CA8): out of the total of the feed, a record refused with the body of an unknown
--    one, the logo not visible. The three doors of 0314 and 0315 are unchanged and call it as before.
--
-- RIGHTS (03 I-4, signalled): USAGE on matching and SELECT (advertiser_account_id,
-- creator_account_id, lifted_at) on matching.party_blocks to influx_campaign_feed_definer, with its
-- policy; nothing else to any role. visible_campaigns() keeps its owner, its mode, its empty
-- search_path and no EXECUTE but its owner's (CREATE OR REPLACE keeps the ACL).
--
-- Not here: the gesture of a member or of an agent and its doors (Lot 4, with block.created and
-- block.lifted written), the creator search door (0319), the export and the erasure (0318),
-- matching.open_introduction() (Lot 4), the purge (Lot 6).
--
-- EC-L3E-04 (micro-gaps, the safest choice):
--   EC-L3E-04-1  a block is born active (lifted_at NULL at insertion); its lift is the only update,
--                once, and a lift_reason_code (a code, no foreign key: the reasons of a lift are not
--                listed yet) is NULL while the block is active.
--   EC-L3E-04-2  blocked_by_account_id agrees with blocked_by_side (CHECK): the advertiser column
--                for advertiser, the creator column for creator, neither for influx; the roles of
--                the three accounts are checked by the trigger (an inversion would block nothing).
--   EC-L3E-04-3  the policy of the owner of the feed reads the caller's ACTIVE blocks only (the
--                creator column = the account of the context, lifted_at NULL): the one row
--                visible_campaigns() needs, never a lifted block nor another creator's.
--   EC-L3E-04-4  label_key = 'block.reason.' || code (R8); a comment required is a non-blank text.
--
-- ROLLBACK (before any block is posed): recreate search.visible_campaigns() as in 0314 §6.3 (as
-- influx_campaign_feed_definer); drop policy party_blocks_campaign_feed_definer_select and revoke
-- the grants of §4; drop tables matching.party_blocks, matching.block_reasons; drop functions
-- matching.check_party_block(), matching.guard_party_block_write().
-- =============================================================================

-- 1. The reasons of a block (04 §5.6; modele §9: empty until the gesture) --------------------------

create table if not exists matching.block_reasons (
  code               text     not null primary key,
  label_key          text     not null unique,
  available_to_side  text     not null,
  requires_comment   boolean  not null default false,
  is_active          boolean  not null default true,

  constraint block_reasons_code check (code ~ '^[a-z][a-z_]{1,62}$'),
  constraint block_reasons_label_key check (label_key = 'block.reason.' || code),
  constraint block_reasons_side
    check (available_to_side in ('advertiser', 'creator', 'influx', 'any'))
);

comment on table matching.block_reasons is
  'The typed reasons of a block between parties (04 §5.6, 10 RG28): one list per side (a brand does '
  'not invoke the reasons of a creator), any for both; requires_comment makes the comment mandatory. '
  'No label in base (04 R8). EMPTY at Lot 3 (l3e/modele.md §9, 0317): the reasons come with the '
  'gesture (Lot 4, 10 Q11). Never served to the blocked party (RG30).';

-- 2. The blocks (04 §5.6, §10.3; 10 RG28 to RG31) -----------------------------------------------------

create table if not exists matching.party_blocks (
  id                     uuid         not null default gen_random_uuid() primary key,
  advertiser_account_id  uuid         not null references identity.accounts (id),
  creator_account_id     uuid         not null references identity.accounts (id),
  blocked_by_account_id  uuid         not null references identity.accounts (id),
  blocked_by_side        text         not null,
  reason_code            text         not null references matching.block_reasons (code),
  comment                text,
  created_at             timestamptz  not null default now(),
  lifted_at              timestamptz,
  lifted_by_account_id   uuid         references identity.accounts (id),
  lift_reason_code       text,

  constraint party_blocks_two_parties check (creator_account_id <> advertiser_account_id),
  constraint party_blocks_side check (blocked_by_side in ('advertiser', 'creator', 'influx')),
  -- EC-L3E-04-2: who blocked agrees with the side
  constraint party_blocks_blocked_by_side check (
    case blocked_by_side
      when 'advertiser' then blocked_by_account_id = advertiser_account_id
      when 'creator'    then blocked_by_account_id = creator_account_id
      else blocked_by_account_id <> advertiser_account_id
           and blocked_by_account_id <> creator_account_id
    end),
  constraint party_blocks_comment_length check (pg_catalog.char_length(comment) <= 1000),
  constraint party_blocks_lift check ((lifted_at is null) = (lifted_by_account_id is null)),
  -- EC-L3E-04-1: no lift reason on an active block
  constraint party_blocks_lift_reason check (lifted_at is not null or lift_reason_code is null),
  constraint party_blocks_lift_reason_code check (lift_reason_code ~ '^[a-z][a-z_]{1,62}$'),
  constraint party_blocks_lift_after check (lifted_at is null or lifted_at >= created_at)
);

comment on table matching.party_blocks is
  'Block declared between a brand and a creator (04 §5.6, 10 RG28; 0317). SYMMETRIC IN ITS EFFECT: '
  'when either blocks the other, NEITHER appears in the results of the other, whatever the '
  'direction (the pair is named by role, so an inversion of blocker and blocked has no '
  'consequence). The exclusion is SILENT (RG29): absent, out of the count, no message, no greyed '
  'slot. The reason is NEVER exposed to the blocked party nor journaled at its level (RG30). One '
  'active block per pair (party_blocks_active_idx); a lift is kept, never deleted. No gesture at '
  'Lot 3: posed and lifted from the member space or by an internal role at Lot 4, journaled '
  '(block.created, block.lifted, excluded_third_party).';
comment on column matching.party_blocks.blocked_by_side is
  'advertiser, creator or influx: the side of blocked_by_account_id (CHECK party_blocks_blocked_by_side).';
comment on column matching.party_blocks.comment is
  'At most 1 000 characters, mandatory when block_reasons.requires_comment. Never served to the '
  'blocked party (RG30).';

-- one active block per pair, whoever posed it (04 §5.6, §10.3)
create unique index if not exists party_blocks_active_idx
  on matching.party_blocks (advertiser_account_id, creator_account_id)
  where lifted_at is null;

-- the reverse direction: « is this creator blocked by someone? » (04 §10.3)
create index if not exists party_blocks_creator_active_idx
  on matching.party_blocks (creator_account_id)
  where lifted_at is null;

-- 3. The two triggers (EC-L3E-04-1, -2, -4) ----------------------------------------------------------

create or replace function matching.check_party_block()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reason  record;
begin
  if new.lifted_at is not null then
    raise exception 'party_block_born_active'
      using errcode = 'check_violation', detail = 'party_block_born_active';
  end if;
  select r.available_to_side, r.requires_comment, r.is_active into v_reason
    from matching.block_reasons r where r.code = new.reason_code;
  -- an unknown code is refused by the foreign key (23503)
  if found and (not v_reason.is_active
                or v_reason.available_to_side not in (new.blocked_by_side, 'any')) then
    raise exception 'party_block_reason_not_available'
      using errcode = 'check_violation', detail = 'party_block_reason_not_available';
  end if;
  if found and v_reason.requires_comment
     and pg_catalog.btrim(coalesce(new.comment, '')) = '' then
    raise exception 'party_block_comment_required'
      using errcode = 'check_violation', detail = 'party_block_comment_required';
  end if;
  -- the pair named by role: an inversion would block nothing (04 §5.6)
  if not exists (select 1 from identity.account_roles r
                  where r.account_id = new.advertiser_account_id and r.role = 'advertiser')
     or not exists (select 1 from identity.account_roles r
                     where r.account_id = new.creator_account_id and r.role = 'creator')
     or (new.blocked_by_side = 'influx'
         and not exists (select 1 from identity.account_roles r
                          where r.account_id = new.blocked_by_account_id
                            and r.role in ('agent', 'admin'))) then
    raise exception 'party_block_roles'
      using errcode = 'check_violation', detail = 'party_block_roles';
  end if;
  return new;
end
$$;

comment on function matching.check_party_block() is
  '0317 (04 §5.6, EC-L3E-04-1, -2, -4): BEFORE INSERT on matching.party_blocks. 23514 when the block '
  'is born lifted, its reason inactive or of another side, its comment missing while the reason '
  'requires one, or the accounts not in their roles (advertiser, creator; agent or admin for an '
  'INFLUX block). SECURITY INVOKER: its writer reads block_reasons and account_roles.';

revoke all on function matching.check_party_block() from public, anon, authenticated, service_role;

drop trigger if exists party_blocks_check on matching.party_blocks;
create trigger party_blocks_check
  before insert on matching.party_blocks
  for each row execute function matching.check_party_block();

create or replace function matching.guard_party_block_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- free: the migration role and every role outside influx_%
  if current_user not like 'influx\_%' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  -- the erasure (0318) deletes the blocks of an erased account
  if tg_op = 'DELETE' and current_user = 'influx_privacy_definer' then
    return old;
  end if;
  -- the lift, once, nothing else changed (a new block is a new row)
  if tg_op = 'UPDATE' and old.lifted_at is null and new.lifted_at is not null
     and new.id = old.id
     and new.advertiser_account_id = old.advertiser_account_id
     and new.creator_account_id = old.creator_account_id
     and new.blocked_by_account_id = old.blocked_by_account_id
     and new.blocked_by_side = old.blocked_by_side
     and new.reason_code = old.reason_code
     and new.comment is not distinct from old.comment
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'party_block_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'party_block_immutable';
end
$$;

comment on function matching.guard_party_block_write() is
  '0317 (04 §5.6: a lifted block is kept, never deleted): BEFORE UPDATE OR DELETE on '
  'matching.party_blocks; 55000 party_block_immutable for every influx_% role but the lift once '
  '(lifted_at NULL -> set, nothing else changed) and the DELETE of influx_privacy_definer (the '
  'erasure, 0318). SECURITY INVOKER, reads nothing.';

revoke all on function matching.guard_party_block_write()
  from public, anon, authenticated, service_role;

drop trigger if exists party_blocks_immutable on matching.party_blocks;
create trigger party_blocks_immutable
  before update or delete on matching.party_blocks
  for each row execute function matching.guard_party_block_write();

-- 4. Rights: RLS forced, nothing by default, nothing to a member, an agent nor an admin -------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['block_reasons', 'party_blocks'] loop
    execute format('alter table matching.%I enable row level security', v_table);
    execute format('alter table matching.%I force row level security', v_table);
    execute format('revoke all on matching.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', v_table);
    -- the second line of « no member right »: even a grant written by mistake sees no row
    execute format('drop policy if exists %I on matching.%I', v_table || '_no_member_access', v_table);
    execute format('create policy %I on matching.%I as restrictive for all '
                   'to influx_advertiser, influx_creator using (false) with check (false)',
                   v_table || '_no_member_access', v_table);
  end loop;
end
$$;

-- 4.1 The owner of the creator's doors: the pair and lifted_at of the caller's active blocks only
grant usage on schema matching to influx_campaign_feed_definer;
grant select (advertiser_account_id, creator_account_id, lifted_at) on matching.party_blocks
   to influx_campaign_feed_definer;

drop policy if exists party_blocks_campaign_feed_definer_select on matching.party_blocks;
create policy party_blocks_campaign_feed_definer_select on matching.party_blocks
  for select to influx_campaign_feed_definer
  using (creator_account_id = (select influx.current_account_id()) and lifted_at is null);

-- 5. The predicate of the feed, the record and the logo, recreated by its owner ---------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_feed_definer', current_user);
end
$$;
grant create on schema search to influx_campaign_feed_definer;
set role influx_campaign_feed_definer;

-- l3d/modele.md §2 + 0317 (11 RG14, RG26, RG42, CA8; 09 RG100; 10 RG28, RG29)
create or replace function search.visible_campaigns(p_creator_account_id uuid)
returns table (
  campaign_id            uuid,
  advertiser_account_id  uuid,
  snapshot_id            uuid,
  first_published_at     timestamptz,
  applications_close_on  date,
  applications_closed    boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.advertiser_account_id, c.current_snapshot_id, c.first_published_at,
         c.applications_close_on, c.applications_close_on < d.today
    from campaigns.campaigns c
    -- RG11, RG14 point 2, CA2: the brand profile published, its account active
    join profiles.advertiser_profiles p
      on p.account_id = c.advertiser_account_id and p.status = 'published'
    join identity.accounts a
      on a.id = c.advertiser_account_id and a.status = 'active'
    cross join (select pg_catalog.timezone('UTC', pg_catalog.now())::date as today,
                       (select (s.value)::integer
                          from backoffice.operational_settings s
                         where s.key = 'campaign_feed_closed_days') as closed_days) d
   -- RG14 point 1, RG100: published by INFLUX, its snapshot served
   where c.status = 'published'
     and c.current_snapshot_id is not null
     -- RG14 point 4: the period not over (the UTC day)
     and c.ends_on >= d.today
     -- RG14 point 3, RG26, CA9: open, or greyed for campaign_feed_closed_days, absent beyond
     and c.applications_close_on >= d.today - d.closed_days
     -- RG42, CA8: a sector the creator refuses, silently
     and not exists (select 1 from profiles.creator_refused_sectors r
                       where r.account_id = p_creator_account_id
                         and r.sector_code = c.sector_code)
     -- 10 RG28, RG29, 0317: an active block of the pair, whoever posed it, silently
     and not exists (select 1 from matching.party_blocks b
                       where b.advertiser_account_id = c.advertiser_account_id
                         and b.creator_account_id = p_creator_account_id
                         and b.lifted_at is null)
$$;

comment on function search.visible_campaigns(uuid) is
  'l3d/modele.md §2 (0314, 0317), THE predicate of the three doors: the campaigns the creator '
  'p_creator_account_id may see, read on their live columns (state, dates, sector): published with a '
  'current snapshot, brand profile published, brand account active (RG11, RG14, CA2), ends_on >= '
  'the UTC day, a sector the creator does not refuse (RG42, CA8: no trace, no count), no active '
  'block between the brand and the creator in either direction (10 RG28, RG29, 0317: no trace, no '
  'count, the reason never read), applications_close_on >= the UTC day (open) or within '
  'campaign_feed_closed_days before it (applications_closed: greyed, RG26, CA9). RG14 point 5 waits '
  'for Lot 4. SECURITY INVOKER owned by influx_campaign_feed_definer, executed by its owner only.';

reset role;
revoke create on schema search from influx_campaign_feed_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_feed_definer', current_user);
end
$$;

-- 6. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  c_owner  constant text := 'influx_campaign_feed_definer';
  c_tables constant text[] := array['matching.block_reasons', 'matching.party_blocks'];
  v_bad    text;
begin
  -- RLS enabled and forced, the restrictive member policy on each table
  select string_agg(t, ', ') into v_bad
    from pg_catalog.unnest(c_tables) t
   where not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
               where oid = t::regclass)
      or not exists (select 1 from pg_catalog.pg_policy po
                      where po.polrelid = t::regclass and not po.polpermissive
                        and po.polname = split_part(t, '.', 2) || '_no_member_access');
  if v_bad is not null then
    raise exception 'RLS not forced, or no restrictive member policy, on: %', v_bad;
  end if;

  -- fiche invariant 1, modele §9: no execution role nor Data API role holds a right on matching
  select string_agg(ro.rolname || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
         pg_catalog.pg_roles ro
   where n.nspname = 'matching' and c.relkind in ('r', 'p', 'v', 'm')
     and ro.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                        'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                        'influx_privacy', 'anon', 'authenticated', 'service_role')
     and (pg_catalog.has_table_privilege(ro.oid, c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege(ro.oid, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'an execution role holds a right on a table of matching: %', v_bad;
  end if;

  -- RG30: the owner of the feed reads the pair and lifted_at, never the reason, the comment nor who
  -- blocked; it reads nothing else of matching and writes nothing there
  select string_agg(at.attname, ', ' order by at.attname) into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid = 'matching.party_blocks'::regclass and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT');
  if v_bad is distinct from 'advertiser_account_id, creator_account_id, lifted_at'
     or pg_catalog.has_table_privilege(c_owner, 'matching.party_blocks',
                                       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege(c_owner, 'matching.party_blocks', 'INSERT, UPDATE')
     or pg_catalog.has_table_privilege(c_owner, 'matching.block_reasons',
                                       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege(c_owner, 'matching.block_reasons',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'influx_campaign_feed_definer reaches beyond the pair of its active blocks: %',
      v_bad;
  end if;

  -- the predicate recreated: its owner, invoker, empty search_path, EXECUTE for nobody but its owner
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'search.visible_campaigns(uuid)'::regprocedure) <> c_owner
     or (select prosecdef from pg_catalog.pg_proc
          where oid = 'search.visible_campaigns(uuid)'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'search.visible_campaigns(uuid)'::regprocedure)
          is distinct from array['search_path=""']
     or exists (select 1
                  from pg_catalog.pg_proc p,
                       pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                 where p.oid = 'search.visible_campaigns(uuid)'::regprocedure
                   and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) then
    raise exception 'search.visible_campaigns(uuid) must stay owned by %, SECURITY INVOKER, empty '
                    'search_path, executed by its owner only', c_owner;
  end if;

  -- the two triggers: migration role, invoker, empty search_path, executed by nobody
  if exists (select 1
               from pg_catalog.pg_proc p
              where p.oid in ('matching.check_party_block()'::regprocedure,
                              'matching.guard_party_block_write()'::regprocedure)
                and (pg_catalog.pg_get_userbyid(p.proowner) like 'influx\_%' or p.prosecdef
                     or p.proconfig is distinct from array['search_path=""']
                     or exists (select 1 from pg_catalog.aclexplode(
                                  coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                                 where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner))) then
    raise exception 'a trigger function of 0317 is not invoker, owned by the migration role, '
                    'executed by nobody';
  end if;

  -- F3, RG30: the two codes of the gesture, loaded by 0303, excluded from the export
  if (select array_agg(code || '=' || domain || '/' || subject_type || '/' || severity || '/'
                       || export_class order by code)
        from audit.event_types where code in ('block.created', 'block.lifted'))
     is distinct from array[
       'block.created=matching/party_block/sensitive/excluded_third_party',
       'block.lifted=matching/party_block/sensitive/excluded_third_party'] then
    raise exception 'block.created and block.lifted are not those of 04 §4.3';
  end if;

  -- the schema matching holds the two tables of 0317 alone (its others come with Lot 4)
  if (select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'matching' and c.relkind in ('r', 'p')) <> 2 then
    raise exception 'the schema matching holds exactly the two tables of 0317';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_campaign_feed_definer left with a member or CREATE by 0317';
  end if;
end
$$;
