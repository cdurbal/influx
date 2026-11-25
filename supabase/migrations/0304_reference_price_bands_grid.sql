-- =============================================================================
-- 0304_reference_price_bands_grid
-- -----------------------------------------------------------------------------
-- Lot 3 / L3B, commit 03 (jalons/l3b/03.md; fiche invariants 2 and 6). Loads the grid of
-- reference.price_bands validated by the founder (F1, 2026-11-13, « Grille validée »):
-- jalons/l3b/tranches.md §5 PREVAILS for every value, and its block is copied here word for word.
--
-- Five currencies (CAD, CHF, EUR, GBP, USD) × ten bands with the same nominal thresholds:
-- under 100, 100-250, 250-500, 500-1 000, 1 000-2 500, 2 500-5 000, 5 000-10 000, 10 000-25 000,
-- 25 000-50 000, 50 000 and more. Bounds in the minor unit, WRITTEN LITERALLY, never computed
-- (T16.1): lower bound INCLUDED, upper bound EXCLUDED (tranches.md §2; not the "upper bound
-- included" of the Lot 2 audience bands), the next band starts where the previous one ends, the
-- first starts at 0, the last (and only it) is open (null).
--
-- No net: net_min_amount_minor, net_max_amount_minor, net_basis_label, net_computed_at stay null
-- on every row (D48, D78; no rate, no computation, CLAUDE.md §2). introduced_at by default,
-- retired_at null. Reference data is SCHEMA, loaded here, never by supabase/seed (04 §11.1 rule 6).
-- Labels `price_band.<code>` live in the translation files (tranches.md §4), not here.
--
-- Not changed: the structure of reference.price_bands, its rights (0201: SELECT to the four
-- business roles, no writer), billing.*. No GRANT, no policy, no function, no audit.* object.
--
-- ROLLBACK (before any campaign references a band, 0303 foreign keys):
--   delete from reference.price_bands
--    where currency in ('CAD', 'CHF', 'EUR', 'GBP', 'USD')
--      and code in ('under_100', '100_250', '250_500', '500_1000', '1000_2500', '2500_5000',
--                   '5000_10000', '10000_25000', '25000_50000', '50000_plus');
--   comment on table reference.price_bands is <the text of 0201>;
-- =============================================================================

-- 1. Precondition: the five currencies are active with a minor unit of 2 (tranches.md §1) --------

do $$
begin
  if (select count(*) from reference.currencies
       where code in ('CAD', 'CHF', 'EUR', 'GBP', 'USD') and is_active and minor_unit = 2) <> 5 then
    raise exception 'CAD, CHF, EUR, GBP and USD must be active with a minor unit of 2 (0003)';
  end if;
end
$$;

-- 2. The grid (tranches.md §5, word for word) ----------------------------------------------------

insert into reference.price_bands (currency, code, label_key, min_amount_minor, max_amount_minor)
select c.currency, b.code, 'price_band.' || b.code, b.min_amount_minor, b.max_amount_minor
from (values ('CAD'), ('CHF'), ('EUR'), ('GBP'), ('USD')) as c (currency)
cross join (values
  ('under_100',   0::bigint, 10000::bigint),
  ('100_250',       10000,    25000),
  ('250_500',       25000,    50000),
  ('500_1000',      50000,   100000),
  ('1000_2500',    100000,   250000),
  ('2500_5000',    250000,   500000),
  ('5000_10000',   500000,  1000000),
  ('10000_25000', 1000000,  2500000),
  ('25000_50000', 2500000,  5000000),
  ('50000_plus',  5000000,     null)
) as b (code, min_amount_minor, max_amount_minor);

comment on table reference.price_bands is
  'Price bands, each tied to a currency (04 §4.2). Loaded by 0304 (L3B, grid of '
  'jalons/l3b/tranches.md validated by the founder): CAD, CHF, EUR, GBP, USD × ten bands, lower '
  'bound included, upper bound excluded, the last one open; no net (D48, D78). Written by a '
  'reviewed migration only.';

-- 3. Validation (tranches.md §5: ten rows per currency, contiguity, one open band, no net) -------

do $$
begin
  if (select count(*) from reference.price_bands) <> 50
     or (select array_agg(currency order by currency)
           from (select currency from reference.price_bands
                  group by currency having count(*) = 10) as per_currency)
          is distinct from array['CAD', 'CHF', 'EUR', 'GBP', 'USD']::bpchar[] then
    raise exception 'reference.price_bands must hold ten bands in each of CAD, CHF, EUR, GBP, USD';
  end if;
  if exists (
    with ordered as (
      select currency, min_amount_minor, max_amount_minor,
             lag(max_amount_minor) over w as previous_max,
             row_number() over w as rank,
             count(*) over (partition by currency) as total
        from reference.price_bands
       where retired_at is null
      window w as (partition by currency order by min_amount_minor, code)
    )
    select 1 from ordered
     where (rank = 1 and min_amount_minor <> 0)
        or (rank > 1 and min_amount_minor is distinct from previous_max)
        or ((max_amount_minor is null) <> (rank = total))
        or max_amount_minor <= min_amount_minor
  ) then
    raise exception 'reference.price_bands: each currency starts at 0, its bands are contiguous '
                    '(lower bound included, upper bound excluded) and only the last one is open';
  end if;
  if exists (select 1 from reference.price_bands
              where net_min_amount_minor is not null or net_max_amount_minor is not null
                 or net_basis_label is not null or net_computed_at is not null) then
    raise exception 'reference.price_bands holds no net (D48, D78)';
  end if;
end
$$;
