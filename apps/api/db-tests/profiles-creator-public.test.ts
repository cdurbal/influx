// L2D commit 03 — the creator storefront of 0216 (jalons/l2d/03.md, l2d/modele.md §0216; 07 RG16,
// RG23; fiche invariants 1 to 3, 7): L2D-D1 the row created at sign-up, L2D-D2 the reprise of the
// existing creator accounts, L2D-D3 alias, reference and status written by no member, TM12.6 the
// alias is random (I-2), plus the shapes and caps the base holds. Rights per table and role are
// probed by T2 (t2-rls-matrix). Each case runs in a rolled-back transaction.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";

const ALIAS_SHAPE = /^[2-9BCDFGHJKLMNPQRSTVWXZ]{6}$/;
const ALPHABET = "23456789BCDFGHJKLMNPQRSTVWXZ";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");

/** The six tables of 0216. */
const CREATOR_TABLES = [
  "profiles.creator_public_profiles",
  "profiles.creator_topics",
  "profiles.creator_publication_languages",
  "profiles.creator_tones",
  "profiles.creator_formats",
  "profiles.creator_usage_rights",
] as const;

/** The reprise of 0216 §7, replayed as written (between its two markers). */
const REPRISE_SQL = (() => {
  const file = readFileSync(
    fileURLToPath(
      new URL(
        "../../../supabase/migrations/0216_profiles_creator_public.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const start = file.indexOf("-- <reprise>");
  const end = file.indexOf("-- </reprise>");
  if (start < 0 || end < start) {
    throw new Error("the reprise markers of 0216 are missing");
  }
  return file.slice(start, end);
})();

let migration: postgres.Sql;
let termsInForce: string;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
  const [terms] = await migration<{ id: string }[]>`
    select id from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  if (terms === undefined) {
    throw new Error("no terms of service in force in French WITH its text");
  }
  termsInForce = terms.id;
});

type Outcome =
  | { outcome: "rows"; count: number }
  | { outcome: "error"; code: string; constraint: string | undefined };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE and constraint. */
async function run(tx: Tx, statement: string): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(statement),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const found = error as { code?: string; constraint_name?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      constraint: found.constraint_name,
    };
  }
}

/** One statement of the superuser (the constraints alone can refuse), rolled back. */
function attempt(statement: string): Promise<Outcome> {
  return inRolledBackTransaction(localSuperuser(), (tx) => run(tx, statement));
}

function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : { outcome: "error", code, constraint };
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };

function asCreator<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

type Storefront = {
  account_id: string;
  public_ref: string;
  alias: string;
  status: string;
  is_searchable: boolean;
  residence_country_code: string;
  headline: string | null;
  published_at: Date | null;
  main_audience_share_band: string | null;
};

async function storefrontOf(
  tx: Tx,
  account: string,
): Promise<Storefront | undefined> {
  const [row] = await tx<Storefront[]>`
    select account_id::text, public_ref::text, alias, status::text, is_searchable,
           residence_country_code, headline, published_at, main_audience_share_band
      from profiles.creator_public_profiles where account_id = ${account}`;
  return row;
}

/** A sign-up through identity.provision_account(), taken as influx_auth (its only caller). */
async function signUp(
  tx: Tx,
  role: "creator" | "advertiser",
  authUserId: string = randomUUID(),
  country = "BE",
): Promise<{ id: string | null; outcome: string }> {
  await tx.unsafe("set local role influx_auth");
  const [row] = await tx<{ id: string | null; outcome: string }[]>`
    select provisioned_account_id::text as id, outcome
      from identity.provision_account(
        ${authUserId}::uuid, ${`l2d-${authUserId}@example.test`}, ${role}::identity.account_role,
        ${country}, 'fr',
        ${role === "creator" ? "individual" : null}::identity.declared_status,
        ${role === "creator"}, ${role === "creator" ? null : "Maison L2D"},
        ${termsInForce}::uuid, true, 'signup.consent.marketing',
        'I agree to receive news from INFLUX.', 'fr')`;
  await tx.unsafe("reset role");
  if (row === undefined) {
    throw new Error("provision_account returned no row");
  }
  return row;
}

/** A creator (or advertiser) account inserted directly, as before 0216, without a storefront. */
async function insertBareAccount(
  tx: Tx,
  id: string,
  role: "creator" | "advertiser",
  status: "active" | "suspended" | "deleted",
  country = "FR",
): Promise<void> {
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       declared_status, is_adult_attested, adult_attested_at, status, suspended_at, deleted_at)
    values (${id}, gen_random_uuid(), ${`l2d-${id}@example.test`}, now(), ${country}, 'fr',
            ${role === "creator" ? "individual" : "business"}::identity.declared_status,
            ${role === "creator"}::boolean,
            case when ${role === "creator"}::boolean then now() end,
            ${status}::identity.account_status,
            case when ${status}::text = 'suspended' then now() end,
            case when ${status}::text = 'deleted' then now() end)`;
  await tx`
    insert into identity.account_roles (account_id, role)
    values (${id}, ${role}::identity.account_role)`;
}

// ---------------------------------------------------------------------------------------------
// L2D-D1: the storefront is created at sign-up
// ---------------------------------------------------------------------------------------------

describe("L2D-D1: identity.provision_account() creates the storefront of a creator", () => {
  it("creates one draft row with a fresh alias, an opaque reference and the country of the account", async () => {
    const found = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const result = await signUp(tx, "creator");
        const lists = await tx<{ count: number }[]>`
        select ((select count(*) from profiles.creator_topics where account_id = ${result.id}::uuid)
              + (select count(*) from profiles.creator_publication_languages where account_id = ${result.id}::uuid)
              + (select count(*) from profiles.creator_tones where account_id = ${result.id}::uuid)
              + (select count(*) from profiles.creator_formats where account_id = ${result.id}::uuid)
              + (select count(*) from profiles.creator_usage_rights where account_id = ${result.id}::uuid))::int
               as count`;
        return {
          result,
          row: await storefrontOf(tx, result.id ?? ""),
          lists: lists[0]?.count,
        };
      },
    );
    expect(found.result.outcome).toBe("created");
    expect(found.row).toMatchObject({
      account_id: found.result.id,
      status: "draft",
      is_searchable: true,
      residence_country_code: "BE",
      headline: null,
      published_at: null,
      main_audience_share_band: null,
    });
    expect(found.row?.alias).toMatch(ALIAS_SHAPE);
    expect(found.row?.public_ref).not.toBe(found.result.id);
    expect(found.lists).toBe(0);
  });

  it("creates no storefront for an advertiser", async () => {
    const found = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const result = await signUp(tx, "advertiser");
        return { result, row: await storefrontOf(tx, result.id ?? "") };
      },
    );
    expect(found.result.outcome).toBe("created");
    expect(found.row).toBeUndefined();
  });

  it("writes no second row on a second submission (RG110), the alias unchanged", async () => {
    const found = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const authUserId = randomUUID();
        const first = await signUp(tx, "creator", authUserId);
        const before = await storefrontOf(tx, first.id ?? "");
        const second = await signUp(tx, "creator", authUserId);
        const [count] = await tx<{ count: number }[]>`
        select count(*)::int as count from profiles.creator_public_profiles
         where account_id = ${first.id}::uuid`;
        return {
          second,
          before,
          after: await storefrontOf(tx, first.id ?? ""),
          count: count?.count,
        };
      },
    );
    expect(found.second.outcome).toBe("existing");
    expect(found.count).toBe(1);
    expect(found.after).toEqual(found.before);
  });

  it("refuses influx_identity_definer a storefront for an account that is not a creator", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe("set local role influx_identity_definer");
        return run(
          tx,
          `insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
         values ('${brandA}', 'ZZZZZZ', 'FR')`,
        );
      },
    );
    expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("refuses influx_identity_definer a country of residence other than the account's", async () => {
    const id = randomUUID();
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await insertBareAccount(tx, id, "creator", "active", "FR");
        await tx.unsafe("set local role influx_identity_definer");
        return run(
          tx,
          `insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
         values ('${id}', 'ZZZZZZ', 'BE')`,
        );
      },
    );
    expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D2: the reprise of the existing creator accounts
// ---------------------------------------------------------------------------------------------

describe("L2D-D2: the reprise gives every existing creator account its storefront, deleted ones aside", () => {
  it("covers an active and a suspended creator, never a deleted one nor an advertiser", async () => {
    const ids = {
      active: randomUUID(),
      suspended: randomUUID(),
      deleted: randomUUID(),
      advertiser: randomUUID(),
    };
    const found = await inRolledBackTransaction(migration, async (tx) => {
      await insertBareAccount(tx, ids.active, "creator", "active", "BE");
      await insertBareAccount(tx, ids.suspended, "creator", "suspended");
      await insertBareAccount(tx, ids.deleted, "creator", "deleted");
      await insertBareAccount(tx, ids.advertiser, "advertiser", "active");
      await tx.unsafe(REPRISE_SQL);
      return {
        active: await storefrontOf(tx, ids.active),
        suspended: await storefrontOf(tx, ids.suspended),
        deleted: await storefrontOf(tx, ids.deleted),
        advertiser: await storefrontOf(tx, ids.advertiser),
      };
    });
    expect(found.active).toMatchObject({
      status: "draft",
      residence_country_code: "BE",
    });
    expect(found.active?.alias).toMatch(ALIAS_SHAPE);
    expect(found.suspended).toMatchObject({
      status: "draft",
      residence_country_code: "FR",
    });
    expect(found.deleted).toBeUndefined();
    expect(found.advertiser).toBeUndefined();
  });

  it("is idempotent and leaves an existing storefront untouched", async () => {
    const id = randomUUID();
    const found = await inRolledBackTransaction(migration, async (tx) => {
      const before = await storefrontOf(tx, creatorA);
      await insertBareAccount(tx, id, "creator", "active");
      await tx.unsafe(REPRISE_SQL);
      const first = await storefrontOf(tx, id);
      await tx.unsafe(REPRISE_SQL);
      return {
        before,
        after: await storefrontOf(tx, creatorA),
        first,
        second: await storefrontOf(tx, id),
      };
    });
    expect(found.before).toBeDefined();
    expect(found.after).toEqual(found.before);
    expect(found.second).toEqual(found.first);
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D3: alias, reference and status written by no member, read by the owner alone
// ---------------------------------------------------------------------------------------------

describe("L2D-D3: no member writes the alias, the reference, the status nor a derived band", () => {
  it.each([
    ["status", "status = 'published'"],
    ["alias", "alias = 'ZZZZZZ'"],
    ["public_ref", "public_ref = gen_random_uuid()"],
    ["published_at", "published_at = now()"],
    ["is_searchable", "is_searchable = false"],
    ["residence_country_code", "residence_country_code = 'BE'"],
    ["main_audience_share_band", "main_audience_share_band = 'ge_80'"],
    ["audience_gender_band", "audience_gender_band = 'mixed'"],
    ["availability_declared_at", "availability_declared_at = now()"],
  ])(
    "refuses the creator an update of %s on his own storefront (42501)",
    async (_column, assignment) => {
      const outcome = await inRolledBackTransaction(localSuperuser(), (tx) =>
        asCreator(tx, creatorA, () =>
          run(
            tx,
            `update profiles.creator_public_profiles set ${assignment}
                  where account_id = '${creatorA}'`,
          ),
        ),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );

  it("lets the creator write an entered column of his own row, never of another's", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        own: await run(
          tx,
          `update profiles.creator_public_profiles set headline = 'Recettes du dimanche'
                              where account_id = '${creatorA}'`,
        ),
        other: await run(
          tx,
          `update profiles.creator_public_profiles set headline = 'Autre'
                                where account_id = '${creatorB}'`,
        ),
      })),
    );
    expect(outcomes).toEqual({
      own: ACCEPTED_ONE,
      other: { outcome: "rows", count: 0 },
    });
  });

  it("refuses the creator to insert or delete a storefront (42501)", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        insert: await run(
          tx,
          `insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
                                 values ('${creatorA}', 'ZZZZZZ', 'FR')`,
        ),
        delete: await run(
          tx,
          `delete from profiles.creator_public_profiles where account_id = '${creatorA}'`,
        ),
      })),
    );
    expect(outcomes).toEqual({
      insert: refusedBy(INSUFFICIENT_PRIVILEGE),
      delete: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("lets the creator read his own storefront only, alias and reference included", async () => {
    const rows = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(
        tx,
        creatorA,
        () =>
          tx<{ account_id: string; alias: string; public_ref: string }[]>`
          select account_id::text, alias, public_ref::text from profiles.creator_public_profiles`,
      ),
    );
    expect(rows.map((row) => row.account_id)).toEqual([creatorA]);
    expect(rows[0]?.alias).toMatch(ALIAS_SHAPE);
  });

  it.each(["influx_agent", "influx_admin"] as const)(
    "refuses %s any write on the alias, the status or the reference (42501)",
    async (role) => {
      const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
        actAsInternal(
          tx,
          role,
          {
            accountId: accountIdOf(
              role === "influx_agent" ? "agent" : "admin",
              "a",
            ),
            role: role === "influx_agent" ? "agent" : "admin",
            aal: "aal2",
          },
          async () => [
            await run(
              tx,
              `update profiles.creator_public_profiles set alias = 'ZZZZZZ'`,
            ),
            await run(
              tx,
              `update profiles.creator_public_profiles set status = 'published'`,
            ),
            await run(
              tx,
              `update profiles.creator_public_profiles set public_ref = gen_random_uuid()`,
            ),
          ],
        ),
      );
      expect(outcomes).toEqual(
        Array(3).fill(refusedBy(INSUFFICIENT_PRIVILEGE)),
      );
    },
  );

  it.each(CREATOR_TABLES)(
    "refuses influx_advertiser any read of %s (EC-L2D-1)",
    async (table) => {
      const outcome = await inRolledBackTransaction(localSuperuser(), (tx) =>
        actAsMember(
          tx,
          "influx_advertiser",
          { accountId: brandA, role: "advertiser", aal: "aal1" },
          () => run(tx, `select * from ${table}`),
        ),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );

  it("gives influx_advertiser no privilege at all on any creator object of profiles", async () => {
    const rows = await migration<{ name: string }[]>`
      select c.oid::regclass::text as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'profiles' and c.relname like 'creator\\_%'
         and c.relkind in ('r', 'p', 'v', 'm')
         and (has_table_privilege('influx_advertiser', c.oid,
                                  'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
              or has_any_column_privilege('influx_advertiser', c.oid,
                                          'SELECT, INSERT, UPDATE, REFERENCES'))`;
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// TM12.6: the alias is random, not sequential, derived from nothing (I-2)
// ---------------------------------------------------------------------------------------------

describe("TM12.6: 1 000 aliases drawn for 1 000 consecutive accounts", () => {
  /** 1 000 creator accounts with consecutive identifiers, then the reprise draws their aliases. */
  async function drawThousand(): Promise<
    { account_id: string; alias: string }[]
  > {
    const prefix = randomUUID().slice(0, 8);
    return inRolledBackTransaction(migration, async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           declared_status, is_adult_attested, adult_attested_at)
        select (${prefix}::text || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
               gen_random_uuid(), ${`tm126-${prefix}-`}::text || n::text || '@example.test',
               now(), 'FR', 'fr', 'individual', true, now()
          from generate_series(1, 1000) n`;
      await tx`
        insert into identity.account_roles (account_id, role)
        select (${prefix}::text || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid, 'creator'
          from generate_series(1, 1000) n`;
      await tx.unsafe(REPRISE_SQL);
      return tx<{ account_id: string; alias: string }[]>`
        select p.account_id::text, p.alias
          from profiles.creator_public_profiles p
         where p.account_id::text like ${`${prefix}-%`}
         order by p.account_id`;
    });
  }

  let drawn: { account_id: string; alias: string }[];

  beforeAll(async () => {
    drawn = await drawThousand();
  });

  it("draws 1 000 distinct aliases of six signs of the alphabet", () => {
    expect(drawn).toHaveLength(1000);
    expect(drawn.every((row) => ALIAS_SHAPE.test(row.alias))).toBe(true);
    expect(new Set(drawn.map((row) => row.alias)).size).toBe(1000);
  });

  it("uses every sign about as often (chi-square over 28 signs, 27 degrees, p < 1e-6 fails)", () => {
    const counts = new Map<string, number>(
      [...ALPHABET].map((sign) => [sign, 0]),
    );
    for (const row of drawn) {
      for (const sign of row.alias) {
        counts.set(sign, (counts.get(sign) ?? 0) + 1);
      }
    }
    const expected = (1000 * 6) / ALPHABET.length;
    const chiSquare = [...counts.values()].reduce(
      (sum, count) => sum + (count - expected) ** 2 / expected,
      0,
    );
    expect(chiSquare).toBeLessThan(78);
  });

  it("follows no order of the accounts (ascending neighbours and rank correlation)", () => {
    const aliases = drawn.map((row) => row.alias);
    let ascending = 0;
    for (let i = 1; i < aliases.length; i += 1) {
      if ((aliases[i] ?? "") > (aliases[i - 1] ?? "")) {
        ascending += 1;
      }
    }
    // 999 neighbours: about 500 ascending, standard deviation about 9
    expect(ascending).toBeGreaterThan(420);
    expect(ascending).toBeLessThan(580);

    const sorted = [...aliases].sort();
    const rankOf = new Map(sorted.map((alias, rank) => [alias, rank]));
    const n = aliases.length;
    const sumSquares = aliases.reduce((sum, alias, index) => {
      const difference = index - (rankOf.get(alias) ?? 0);
      return sum + difference * difference;
    }, 0);
    const spearman = 1 - (6 * sumSquares) / (n * (n * n - 1));
    // standard deviation about 0.032
    expect(Math.abs(spearman)).toBeLessThan(0.2);
  });

  it("holds nothing of its account: no alias is a piece of its account identifier", () => {
    const linked = drawn.filter((row) =>
      row.account_id.replaceAll("-", "").toUpperCase().includes(row.alias),
    );
    expect(linked).toEqual([]);
  });

  it("is drawn from no input: profiles.new_creator_alias() takes no argument", async () => {
    const [row] = await migration<{ args: number; definer: boolean }[]>`
      select pronargs::int as args, prosecdef as definer from pg_catalog.pg_proc
       where oid = 'profiles.new_creator_alias()'::regprocedure`;
    expect(row).toEqual({ args: 0, definer: false });
  });
});

// ---------------------------------------------------------------------------------------------
// The shapes and the caps held by the base
// ---------------------------------------------------------------------------------------------

describe("0216: the shapes and the caps of the storefront, held by the base", () => {
  function storefrontUpdate(assignment: string): string {
    return `update profiles.creator_public_profiles set ${assignment} where account_id = '${creatorA}'`;
  }

  it.each([
    [
      "an alias out of the alphabet",
      "alias = 'AAAAAA'",
      "creator_public_profiles_alias_shape",
    ],
    [
      "a reference equal to the account",
      `public_ref = '${creatorA}'`,
      "creator_public_profiles_public_ref_not_account",
    ],
    [
      "a headline of 121 characters",
      "headline = repeat('a', 121)",
      "creator_public_profiles_headline_length",
    ],
    [
      "a headline with a line feed",
      "headline = E'Une ligne\\nDeux'",
      "creator_public_profiles_headline_printable",
    ],
    [
      "a blank headline",
      "headline = '   '",
      "creator_public_profiles_headline_not_blank",
    ],
    [
      "a bio of 801 characters",
      "bio = repeat('a', 801)",
      "creator_public_profiles_bio_length",
    ],
    [
      "a bio with a tab",
      "bio = E'Une\\tbio'",
      "creator_public_profiles_bio_printable",
    ],
    [
      "a travel scope out of the list",
      "travel_scope = 'world'",
      "creator_public_profiles_travel_scope",
    ],
    [
      "an experience out of the bands",
      "collaboration_experience_band = '21_plus'",
      "creator_public_profiles_collaboration_experience_band",
    ],
    [
      "an exclusivity out of the bands",
      "max_exclusivity_band = 'le_6m'",
      "creator_public_profiles_max_exclusivity_band",
    ],
    [
      "an availability out of the bands",
      "availability_band = 'never'",
      "creator_public_profiles_availability_band",
    ],
    [
      "a delivery lead out of the bands",
      "delivery_lead_band = 'lt_1d'",
      "creator_public_profiles_delivery_lead_band",
    ],
  ])("refuses %s (23514)", async (_label, assignment, constraint) => {
    expect(await attempt(storefrontUpdate(assignment))).toEqual(
      refusedBy(CHECK_VIOLATION, constraint),
    );
  });

  it("accepts a bio over several lines and a region of the country of residence", async () => {
    expect(
      await attempt(
        storefrontUpdate(
          "bio = E'Ligne une\\nLigne deux', residence_region_code = 'FR-BRE'",
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });

  it("refuses a region of another country (23503)", async () => {
    expect(
      await attempt(storefrontUpdate("residence_region_code = 'GB-ENG'")),
    ).toEqual(
      refusedBy(FOREIGN_KEY_VIOLATION, "creator_public_profiles_region_fk"),
    );
  });

  it.each([
    [
      "a fourth secondary topic",
      "creator_topics",
      "slot, topic_code",
      "4, 'travel'",
      "creator_topics_slot",
    ],
    [
      "a sixth language",
      "creator_publication_languages",
      "slot, language_code",
      "6, 'de'",
      "creator_publication_languages_slot",
    ],
    [
      "a third tone",
      "creator_tones",
      "slot, tone_code",
      "3, 'expert'",
      "creator_tones_slot",
    ],
    [
      "the usage right none",
      "creator_usage_rights",
      "usage_right_code, inclusion",
      "'none', 'included'",
      "creator_usage_rights_not_none",
    ],
    [
      "an inclusion out of the list",
      "creator_usage_rights",
      "usage_right_code, inclusion",
      "'media_buy', 'maybe'",
      "creator_usage_rights_inclusion",
    ],
  ])(
    "refuses %s (23514)",
    async (_label, table, columns, values, constraint) => {
      expect(
        await attempt(
          `insert into profiles.${table} (account_id, ${columns}) values ('${creatorB}', ${values})`,
        ),
      ).toEqual(refusedBy(CHECK_VIOLATION, constraint));
    },
  );

  it("refuses a list row for an account without a storefront (23503)", async () => {
    expect(
      await attempt(
        `insert into profiles.creator_formats (account_id, format_code) values ('${brandA}', 'ugc_video')`,
      ),
    ).toEqual(refusedBy(FOREIGN_KEY_VIOLATION));
  });

  it("lets the creator add and remove his own choices, never another's", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        add: await run(
          tx,
          `insert into profiles.creator_formats (account_id, format_code)
                              values ('${creatorA}', 'ugc_video')`,
        ),
        addOther: await run(
          tx,
          `insert into profiles.creator_formats (account_id, format_code)
                                   values ('${creatorB}', 'ugc_video')`,
        ),
        remove: await run(
          tx,
          `delete from profiles.creator_formats where account_id = '${creatorA}' and format_code = 'ugc_video'`,
        ),
        removeOther: await run(
          tx,
          `delete from profiles.creator_formats where account_id = '${creatorB}'`,
        ),
      })),
    );
    expect(outcomes).toEqual({
      add: ACCEPTED_ONE,
      addOther: refusedBy(INSUFFICIENT_PRIVILEGE),
      remove: ACCEPTED_ONE,
      removeOther: { outcome: "rows", count: 0 },
    });
  });
});
