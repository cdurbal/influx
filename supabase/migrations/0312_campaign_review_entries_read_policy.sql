-- =============================================================================
-- 0312_campaign_review_entries_read_policy
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, fix X2 (jalons/l3c/fix-2.md; l3c/modele.md "Arbitrage A3", architecte,
-- 2026-11-15, which prevails over §3 and §9 for the reads; fiche invariants 2 and 10).
-- Signalled I-4: a row level security policy is recreated.
--
-- The defect: the third clause of campaign_review_entries_internal_select (0307 §5)
--     not (state = 'open' and first_reviewed_by_account_id = (select influx.current_account_id()))
-- is NULL on an open entry without a first review (state = 'open' is true, the equality with a NULL
-- first reviewer is NULL, and NOT NULL is NULL): the row is filtered out for EVERY agent and admin.
-- Queue 7 then lists nothing, counts 0 and a direct read of a fresh entry finds nothing; the
-- SECURITY DEFINER doors of 0307 to 0309 are not affected (their owners read under their own
-- policies), which is why the claim and the decisions kept working.
--
-- The fix (A3): the same policy, same name, same table, same command, same roles; the first two
-- clauses of 0307 unchanged; the third written so that it is never NULL (state is NOT NULL):
--     (state <> 'open' or first_reviewed_by_account_id is distinct from (select influx.current_account_id()))
--   - open without a first review: visible to every internal in aal2;
--   - open with a first review: hidden from its author only, admin included (RG85, CA56, CA57);
--   - published, rejected, withdrawn: visible, as the opening answers closed to anybody;
--   - without aal2: nothing; an entry of the caller's own account: nothing (0307, unchanged); an
--     entry of a held brand: filtered by the route (EC-L3C-02-7, unchanged).
--
-- Unchanged: no GRANT, no other policy, no function, no column. The searches move to 0313.
--
-- Rollback (back to the defect of 0307, reversible):
--   drop policy if exists campaign_review_entries_internal_select on campaigns.campaign_review_entries;
--   create policy campaign_review_entries_internal_select on campaigns.campaign_review_entries
--     for select to influx_agent, influx_admin
--     using ((select influx.has_aal2())
--            and advertiser_account_id is distinct from (select influx.current_account_id())
--            and not (state = 'open'
--                     and first_reviewed_by_account_id = (select influx.current_account_id())));
-- =============================================================================

-- 1. The policy, recreated ------------------------------------------------------------------------

drop policy if exists campaign_review_entries_internal_select on campaigns.campaign_review_entries;
create policy campaign_review_entries_internal_select on campaigns.campaign_review_entries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and advertiser_account_id is distinct from (select influx.current_account_id())
         and (state <> 'open'
              or first_reviewed_by_account_id is distinct from (select influx.current_account_id())));

-- 2. Postconditions (catalogue) -------------------------------------------------------------------

do $$
declare
  v_count  int;
  v_cmd    text;
  v_perm   text;
  v_roles  text[];
  v_qual   text;
begin
  select count(*) into v_count
    from pg_catalog.pg_policies
   where schemaname = 'campaigns'
     and tablename = 'campaign_review_entries'
     and policyname = 'campaign_review_entries_internal_select';
  if v_count <> 1 then
    raise exception 'campaign_review_entries_internal_select: % policies of that name', v_count;
  end if;

  select cmd, permissive, roles::text[], qual
    into v_cmd, v_perm, v_roles, v_qual
    from pg_catalog.pg_policies
   where schemaname = 'campaigns'
     and tablename = 'campaign_review_entries'
     and policyname = 'campaign_review_entries_internal_select';
  if v_cmd <> 'SELECT' then
    raise exception 'campaign_review_entries_internal_select is for %, not SELECT', v_cmd;
  end if;
  if v_perm <> 'PERMISSIVE' then
    raise exception 'campaign_review_entries_internal_select is %, not PERMISSIVE', v_perm;
  end if;
  if (select array_agg(r order by r) from unnest(v_roles) r)
       is distinct from array['influx_admin', 'influx_agent']::text[] then
    raise exception 'campaign_review_entries_internal_select is for %', v_roles;
  end if;
  -- the new third clause, never NULL; the first two kept; the defective form gone
  if pg_catalog.strpos(v_qual, 'has_aal2()') = 0
     or v_qual !~ 'advertiser_account_id IS DISTINCT FROM'
     or v_qual !~ 'state <> ''open''::'
     or v_qual !~ 'first_reviewed_by_account_id IS DISTINCT FROM'
     or v_qual ~ 'first_reviewed_by_account_id = ' then
    raise exception 'campaign_review_entries_internal_select does not read: %', v_qual;
  end if;
end
$$;
