// L2D commit 04 — the identifying objects of the creator profile, 0217 (jalons/l2d/04.md,
// l2d/modele.md §0217; 07 RG16, RG41 to RG47, RG56 to RG61, RG75, RG119; fiche invariants 1, 2, 7,
// 8): T1-R influx_advertiser reaches no creator object, examined BY NAME (04 §11.3, non reversible)
// and, since L3A-06 (L2DS-3), by dependency in every schema; L3A-T3 no dynamic SQL in a function
// owned by influx_identity_definer (L2DS-5),
// L2D-D4 a handle once per (creator, network), L2D-D5 one primary line, L2D-D6 neither city nor
// identity outside layer N, plus the identity row of every storefront, the guard of the URL, the
// exact audience, the history and the shapes the base holds. Rights per table and role are probed
// by T2 (t2-rls-matrix). Each case runs in a rolled-back transaction.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
  takeRole,
} from "@influx/test-kit/db";
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
type Sql = postgres.Sql | Tx;

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;

/** The thirteen creator tables of 0216 and 0217: the guard by name must find them all. */
const KNOWN_CREATOR_TABLES = [
  "profiles.creator_audience_ages",
  "profiles.creator_audience_countries",
  "profiles.creator_audience_genders",
  "profiles.creator_formats",
  "profiles.creator_identities",
  "profiles.creator_network_metrics_history",
  "profiles.creator_public_profiles",
  "profiles.creator_publication_languages",
  "profiles.creator_refused_sectors",
  "profiles.creator_social_accounts",
  "profiles.creator_tones",
  "profiles.creator_topics",
  "profiles.creator_usage_rights",
] as const;

/**
 * The creator objects influx_advertiser may reach, declared here and nowhere else. EMPTY at Lot 2
 * (EC-L2D-1): the Lot 3 declares the storefront with the guards of C(10); creator_identities, the
 * exact audience, the refused sectors and the history never enter this list (04 §11.3).
 */
const ADVERTISER_EXCEPTIONS: readonly string[] = [];

/** The reprise of 0217 §9, replayed as written (between its two markers). */
const REPRISE_SQL = (() => {
  const file = readFileSync(
    fileURLToPath(
      new URL(
        "../../../supabase/migrations/0217_profiles_creator_identity.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const start = file.indexOf("-- <reprise>");
  const end = file.indexOf("-- </reprise>");
  if (start < 0 || end < start) {
    throw new Error("the reprise markers of 0217 are missing");
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
  | {
      outcome: "error";
      code: string;
      constraint: string | undefined;
      message: string;
    };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE, constraint and message. */
async function run(tx: Tx, statement: string): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(statement),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const found = error as {
      code?: string;
      constraint_name?: string;
      message?: string;
    };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      constraint: found.constraint_name,
      message: found.message ?? "",
    };
  }
}

/** One statement of the superuser (the constraints and the guards alone can refuse), rolled back. */
function attempt(statement: string): Promise<Outcome> {
  return inRolledBackTransaction(localSuperuser(), (tx) => run(tx, statement));
}

function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : expect.objectContaining({ outcome: "error", code, constraint });
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };
const NONE = { outcome: "rows", count: 0 };

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

function asAgent<T>(
  tx: Tx,
  aal: "aal1" | "aal2",
  fn: () => Promise<T>,
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal },
    fn,
  );
}

/** A sign-up through identity.provision_account(), taken as influx_auth (its only caller). */
async function signUp(tx: Tx, role: "creator" | "advertiser"): Promise<string> {
  const authUserId = randomUUID();
  await tx.unsafe("set local role influx_auth");
  const [row] = await tx<{ id: string | null }[]>`
    select provisioned_account_id::text as id
      from identity.provision_account(
        ${authUserId}::uuid, ${`l2d04-${authUserId}@example.test`}, ${role}::identity.account_role,
        'BE', 'fr',
        ${role === "creator" ? "individual" : null}::identity.declared_status,
        ${role === "creator"}, ${role === "creator" ? null : "Maison L2D"},
        ${termsInForce}::uuid, true, 'signup.consent.marketing',
        'I agree to receive news from INFLUX.', 'fr')`;
  await tx.unsafe("reset role");
  if (row?.id === null || row?.id === undefined) {
    throw new Error("provision_account created no account");
  }
  return row.id;
}

/**
 * T1-R findings: every right of influx_advertiser on a profiles object named creator_% (tables,
 * views, sequences), every creator function of profiles it may execute, every policy of a creator
 * object naming it or PUBLIC (the guard BY NAME). Then, in EVERY schema (L2DS-3): every view or
 * materialized view it may touch that depends, through pg_depend on pg_rewrite and recursively, on
 * a profiles.creator_% relation; every function it may execute whose body names profiles.creator_
 * (prosrc) or that depends on such a relation (pg_depend, SQL-standard bodies). A relation or a
 * function keeps one name whichever branch finds it, so one exception covers it. The exceptions of
 * the Lot 3 are taken out here, nowhere else.
 */
async function advertiserFindings(sql: Sql): Promise<string[]> {
  const rows = await sql<{ finding: string }[]>`
    with recursive creator_reach (oid) as (
      select c.oid
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'profiles' and c.relname like 'creator\\_%'
         and c.relkind in ('r', 'p', 'v', 'm', 'f')
      union
      select r.ev_class
        from creator_reach cr
        join pg_catalog.pg_depend d
          on d.refclassid = 'pg_catalog.pg_class'::regclass and d.refobjid = cr.oid
        join pg_catalog.pg_rewrite r
          on d.classid = 'pg_catalog.pg_rewrite'::regclass and r.oid = d.objid
       where r.ev_class <> cr.oid
    )
    select c.oid::regclass::text as finding
      from pg_catalog.pg_class c
      join creator_reach cr on cr.oid = c.oid
     where c.relkind in ('v', 'm')
       and (has_table_privilege('influx_advertiser', c.oid,
                                'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
            or has_any_column_privilege('influx_advertiser', c.oid,
                                        'SELECT, INSERT, UPDATE, REFERENCES'))
    union
    select p.oid::regprocedure::text
      from pg_catalog.pg_proc p
     where has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
       and (p.prosrc ~* '\\mprofiles"?\\s*\\.\\s*"?creator_'
            or exists (select 1
                         from pg_catalog.pg_depend d
                         join creator_reach cr on cr.oid = d.refobjid
                        where d.classid = 'pg_catalog.pg_proc'::regclass
                          and d.objid = p.oid
                          and d.refclassid = 'pg_catalog.pg_class'::regclass))
    union
    select c.oid::regclass::text
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'profiles' and c.relname like 'creator\\_%'
       and ((c.relkind in ('r', 'p', 'v', 'm')
             and (has_table_privilege('influx_advertiser', c.oid,
                                      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                  or has_any_column_privilege('influx_advertiser', c.oid,
                                              'SELECT, INSERT, UPDATE, REFERENCES')))
            or (c.relkind = 'S'
                and has_sequence_privilege('influx_advertiser', c.oid, 'USAGE, SELECT, UPDATE')))
    union
    select p.oid::regprocedure::text
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'profiles' and p.proname like '%creator%'
       and has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
    union
    select 'policy ' || schemaname || '.' || tablename || '.' || policyname
      from pg_catalog.pg_policies
     where schemaname = 'profiles' and tablename like 'creator\\_%'
       and roles && array['influx_advertiser', 'public']::name[]
     order by 1`;
  return rows
    .map((row) => row.finding)
    .filter((finding) => !ADVERTISER_EXCEPTIONS.includes(finding));
}

/** Every relation of profiles named creator_%, found by name in the catalogue. */
async function creatorRelations(): Promise<string[]> {
  const rows = await migration<{ name: string }[]>`
    select c.oid::regclass::text as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'profiles' and c.relname like 'creator\\_%'
       and c.relkind in ('r', 'p', 'v', 'm')
     order by 1`;
  return rows.map((row) => row.name);
}

// ---------------------------------------------------------------------------------------------
// T1-R: the advertiser role never reaches a creator object (04 §11.3, non reversible)
// ---------------------------------------------------------------------------------------------

describe("T1-R: influx_advertiser reaches no creator object, examined by name (04 §11.3, non reversible)", () => {
  it("finds every profiles.creator_% relation by name, the thirteen tables of 0216 and 0217 among them", async () => {
    expect(await creatorRelations()).toEqual(
      expect.arrayContaining([...KNOWN_CREATOR_TABLES]),
    );
  });

  it("gives influx_advertiser no right on any of them (table, column, sequence, function, policy)", async () => {
    expect(await advertiserFindings(migration)).toEqual([]);
  });

  it("answers 42501 to every SELECT of influx_advertiser on each relation found by name", async () => {
    const relations = await creatorRelations();
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        async () => {
          const found: [string, Outcome][] = [];
          for (const relation of relations) {
            found.push([relation, await run(tx, `select * from ${relation}`)]);
          }
          return found;
        },
      ),
    );
    expect(relations.length).toBeGreaterThanOrEqual(
      KNOWN_CREATOR_TABLES.length,
    );
    expect(
      outcomes.filter(
        ([, outcome]) =>
          outcome.outcome !== "error" ||
          outcome.code !== INSUFFICIENT_PRIVILEGE,
      ),
    ).toEqual([]);
  });

  it("sees red when a right is granted, even on a creator table nobody listed (mutation, rolled back)", async () => {
    const findings = await inRolledBackTransaction(migration, async (tx) => {
      await tx`create table profiles.creator_t1r_witness (id integer)`;
      await tx`grant select on profiles.creator_t1r_witness to influx_advertiser`;
      await tx`grant select (city) on profiles.creator_identities to influx_advertiser`;
      await tx`create policy t1r_witness on profiles.creator_refused_sectors
                 for select to public using (true)`;
      return advertiserFindings(tx);
    });
    expect(findings).toEqual(
      expect.arrayContaining([
        "profiles.creator_identities",
        "profiles.creator_t1r_witness",
        "policy profiles.creator_refused_sectors.t1r_witness",
      ]),
    );
  });

  // L3A-T4 (L2DS-3): the guard by dependency, in any schema, whatever the name of the object
  it("sees red on a view of another schema reading creator_identities, directly or through a view (L3A-T4, rolled back)", async () => {
    const [before, after] = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const found = await advertiserFindings(tx);
        await tx`create schema l3a_t4`;
        await tx`create view l3a_t4.storefront_direct as
                   select account_id from profiles.creator_identities`;
        await tx`create view l3a_t4.storefront_inner as
                   select account_id from profiles.creator_identities`;
        await tx`create view l3a_t4.storefront_outer as
                   select account_id from l3a_t4.storefront_inner`;
        await tx`grant usage on schema l3a_t4 to influx_advertiser`;
        await tx`grant select on l3a_t4.storefront_direct, l3a_t4.storefront_outer
                   to influx_advertiser`;
        return [found, await advertiserFindings(tx)];
      },
    );
    expect(before).toEqual([]);
    expect(after).toEqual([
      "l3a_t4.storefront_direct",
      "l3a_t4.storefront_outer",
    ]);
  });

  it("sees red on a SECURITY DEFINER function of another schema reading creator_identities (L3A-T4, rolled back)", async () => {
    const [before, after] = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const found = await advertiserFindings(tx);
        await tx`create schema l3a_t4`;
        await tx.unsafe(`
          create function l3a_t4.lookup(p_account uuid) returns text
            language plpgsql stable security definer set search_path = ''
          as $fn$
          begin
            return (select i.city from profiles.creator_identities i
                     where i.account_id = p_account);
          end
          $fn$`);
        await tx.unsafe(`
          create function l3a_t4.lookup_atomic(p_account uuid) returns bigint
            language sql stable security definer set search_path = ''
          begin atomic
            select count(*) from profiles.creator_identities i where i.account_id = p_account;
          end`);
        await tx`revoke all on function l3a_t4.lookup(uuid), l3a_t4.lookup_atomic(uuid)
                   from public`;
        await tx`grant usage on schema l3a_t4 to influx_advertiser`;
        await tx`grant execute on function l3a_t4.lookup(uuid), l3a_t4.lookup_atomic(uuid)
                   to influx_advertiser`;
        return [found, await advertiserFindings(tx)];
      },
    );
    expect(before).toEqual([]);
    expect(after).toEqual([
      "l3a_t4.lookup(uuid)",
      "l3a_t4.lookup_atomic(uuid)",
    ]);
  });

  it("keeps the advertiser off the identity, the lines, the audience and the history even in aal2 (42501)", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal2" },
        async () => [
          await run(
            tx,
            `update profiles.creator_identities set city = 'Lyon' where account_id = '${creatorA}'`,
          ),
          await run(
            tx,
            `insert into profiles.creator_social_accounts (account_id, network_code)
             values ('${brandA}', 'instagram')`,
          ),
          await run(
            tx,
            `delete from profiles.creator_audience_countries where account_id = '${creatorA}'`,
          ),
          await run(
            tx,
            "select count(*) from profiles.creator_network_metrics_history",
          ),
        ],
      ),
    );
    expect(outcomes).toEqual(Array(4).fill(refusedBy(INSUFFICIENT_PRIVILEGE)));
  });
});

// ---------------------------------------------------------------------------------------------
// L3A-T3 (L2DS-5): no dynamic SQL in a function owned by influx_identity_definer
// ---------------------------------------------------------------------------------------------

/**
 * The functions owned by influx_identity_definer whose body names `execute`, the rule of the end
 * assertion of 0301 (its list of excluded signatures, empty, EC-L3A-05-3, is replayed here).
 */
async function identityDefinerDynamicSql(sql: Sql): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select p.oid::regprocedure::text as name
      from pg_catalog.pg_proc p
     where p.proowner = 'influx_identity_definer'::regrole
       and p.prosrc ~* '\\mexecute\\M'
       and p.oid::regprocedure::text <> all (array[]::text[])
     order by 1`;
  return rows.map((row) => row.name);
}

describe("L3A-T3: no function owned by influx_identity_definer carries a dynamic execute (L2DS-5)", () => {
  it("finds none among the functions it owns, and sees red on a witness given to it (rolled back)", async () => {
    const [owned] = await migration<{ count: number }[]>`
      select count(*)::int as count from pg_catalog.pg_proc
       where proowner = 'influx_identity_definer'::regrole`;
    expect(owned?.count ?? 0).toBeGreaterThan(0);
    expect(await identityDefinerDynamicSql(migration)).toEqual([]);

    const witness = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx`create schema l3a_t3`;
        await tx.unsafe(`
        create function l3a_t3.dynamic_read(p_table text) returns bigint
          language plpgsql security definer set search_path = ''
        as $fn$
        declare v_count bigint;
        begin
          EXECUTE format('select count(*) from %s', p_table) into v_count;
          return v_count;
        end
        $fn$`);
        await tx`alter function l3a_t3.dynamic_read(text) owner to influx_identity_definer`;
        return identityDefinerDynamicSql(tx);
      },
    );
    expect(witness).toEqual(["l3a_t3.dynamic_read(text)"]);
  });
});

// ---------------------------------------------------------------------------------------------
// The identity row (N) of every storefront
// ---------------------------------------------------------------------------------------------

type IdentityRow = {
  legal_first_name: string | null;
  legal_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  completeness_percent: number;
};

async function identityOf(
  tx: Tx,
  account: string,
): Promise<IdentityRow | undefined> {
  const [row] = await tx<IdentityRow[]>`
    select legal_first_name, legal_last_name, contact_email, contact_phone, address_line,
           postal_code, city, country_code, completeness_percent
      from profiles.creator_identities where account_id = ${account}`;
  return row;
}

const EMPTY_IDENTITY: IdentityRow = {
  legal_first_name: null,
  legal_last_name: null,
  contact_email: null,
  contact_phone: null,
  address_line: null,
  postal_code: null,
  city: null,
  country_code: null,
  completeness_percent: 0,
};

describe("0217: every storefront holds its identity row, empty", () => {
  it("creates it at the sign-up of a creator, never of an advertiser", async () => {
    const found = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const creator = await signUp(tx, "creator");
        const advertiser = await signUp(tx, "advertiser");
        return {
          creator: await identityOf(tx, creator),
          advertiser: await identityOf(tx, advertiser),
        };
      },
    );
    expect(found.creator).toEqual(EMPTY_IDENTITY);
    expect(found.advertiser).toBeUndefined();
  });

  it("is given back by the reprise to a storefront without one, idempotently", async () => {
    const id = randomUUID();
    const found = await inRolledBackTransaction(migration, async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           declared_status, is_adult_attested, adult_attested_at)
        values (${id}, gen_random_uuid(), ${`l2d04-${id}@example.test`}, now(), 'FR', 'fr',
                'individual', true, now())`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${id}, 'creator')`;
      await tx`
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (${id}, profiles.new_creator_alias(), 'FR')`;
      const created = await identityOf(tx, id);
      await tx`delete from profiles.creator_identities where account_id = ${id}`;
      const removed = await identityOf(tx, id);
      await tx.unsafe(REPRISE_SQL);
      const first = await identityOf(tx, id);
      await tx.unsafe(REPRISE_SQL);
      const [count] = await tx<{ count: number }[]>`
        select count(*)::int as count from profiles.creator_identities where account_id = ${id}`;
      return { created, removed, first, count: count?.count };
    });
    expect(found.created).toEqual(EMPTY_IDENTITY);
    expect(found.removed).toBeUndefined();
    expect(found.first).toEqual(EMPTY_IDENTITY);
    expect(found.count).toBe(1);
  });

  it("refuses influx_identity_definer an identity row for an account that is not a creator", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe("set local role influx_identity_definer");
        return run(
          tx,
          `insert into profiles.creator_identities (account_id) values ('${brandA}')`,
        );
      },
    );
    expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("lets the creator read and write his own identity only, never insert, delete nor rekey it", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        read: await tx<{ account_id: string }[]>`
          select account_id::text from profiles.creator_identities`,
        own: await run(
          tx,
          `update profiles.creator_identities
              set legal_first_name = 'Camille', legal_last_name = 'Martin', city = 'Lyon',
                  postal_code = '69001', country_code = 'FR', contact_phone = '+33612345678',
                  contact_email = 'camille@example.test', address_line = '1 rue de la Paix'
            where account_id = '${creatorA}'`,
        ),
        // 0243 (L2DS-4, l2g/modele point 7): the score is the database's, no member writes it
        score: await run(
          tx,
          `update profiles.creator_identities set completeness_percent = 40
            where account_id = '${creatorA}'`,
        ),
        other: await run(
          tx,
          `update profiles.creator_identities set city = 'Paris' where account_id = '${creatorB}'`,
        ),
        rekey: await run(
          tx,
          `update profiles.creator_identities set account_id = '${creatorB}'
            where account_id = '${creatorA}'`,
        ),
        insert: await run(
          tx,
          `insert into profiles.creator_identities (account_id) values ('${creatorA}')`,
        ),
        delete: await run(
          tx,
          `delete from profiles.creator_identities where account_id = '${creatorA}'`,
        ),
      })),
    );
    expect(outcomes.read.map((row) => row.account_id)).toEqual([creatorA]);
    expect(outcomes.own).toEqual(ACCEPTED_ONE);
    expect(outcomes.score).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.other).toEqual(NONE);
    expect(outcomes.rekey).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.insert).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.delete).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("lets an agent read every identity in aal2, none in aal1, and write none", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => ({
        aal2: await asAgent(
          tx,
          "aal2",
          () =>
            tx<{ account_id: string }[]>`
            select account_id::text from profiles.creator_identities
             where account_id in (${creatorA}, ${creatorB}) order by account_id`,
        ),
        aal1: await asAgent(
          tx,
          "aal1",
          () =>
            tx<{ account_id: string }[]>`
            select account_id::text from profiles.creator_identities`,
        ),
        write: await asAgent(tx, "aal2", () =>
          run(
            tx,
            `update profiles.creator_identities set city = 'Lyon' where account_id = '${creatorA}'`,
          ),
        ),
      }),
    );
    expect(outcomes.aal2.map((row) => row.account_id)).toEqual([
      creatorA,
      creatorB,
    ]);
    expect(outcomes.aal1).toEqual([]);
    expect(outcomes.write).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  function identityUpdate(assignment: string): string {
    return `update profiles.creator_identities set ${assignment} where account_id = '${creatorB}'`;
  }

  it.each([
    [
      "a phone without its country prefix",
      "contact_phone = '0612345678'",
      "creator_identities_contact_phone_shape",
    ],
    [
      "an address in capitals",
      "contact_email = 'Camille@Example.test'",
      "creator_identities_contact_email_lower",
    ],
    [
      "an address without domain",
      "contact_email = 'camille'",
      "creator_identities_contact_email_shape",
    ],
    [
      "a city of 101 characters",
      "city = repeat('a', 101)",
      "creator_identities_city_length",
    ],
    ["a blank city", "city = '   '", "creator_identities_city_not_blank"],
    [
      "a legal name with a tab",
      "legal_last_name = E'Mar\\ttin'",
      "creator_identities_legal_last_name_printable",
    ],
    [
      "a postal code with a sign",
      "postal_code = '75001!'",
      "creator_identities_postal_code_shape",
    ],
    [
      "a completeness over 100",
      "completeness_percent = 101",
      "creator_identities_completeness_percent",
    ],
  ])("refuses %s (23514)", async (_label, assignment, constraint) => {
    expect(await attempt(identityUpdate(assignment))).toEqual(
      refusedBy(CHECK_VIOLATION, constraint),
    );
  });

  it("accepts the postal codes of FR, GB and US", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => [
        await run(tx, identityUpdate("postal_code = '75001'")),
        await run(tx, identityUpdate("postal_code = 'SW1A 1AA'")),
        await run(tx, identityUpdate("postal_code = '12345-6789'")),
      ],
    );
    expect(outcomes).toEqual(Array(3).fill(ACCEPTED_ONE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D4, L2D-D5: the network lines
// ---------------------------------------------------------------------------------------------

function lineInsert(
  account: string,
  network: string,
  handle: string,
  extra = "",
): string {
  const [columns, values] = extra === "" ? ["", ""] : extra.split("|");
  return `insert into profiles.creator_social_accounts (account_id, network_code, handle${columns ?? ""})
          values ('${account}', '${network}', '${handle}'${values ?? ""})`;
}

describe("L2D-D4: a handle once per creator and network, whatever its case (RG42)", () => {
  it("refuses the same handle twice on one network for one creator (23505)", async () => {
    expect(
      await attempt(lineInsert(creatorB, "tiktok", "T2_Creator_B")),
    ).toEqual(
      refusedBy(UNIQUE_VIOLATION, "creator_social_accounts_handle_unique"),
    );
  });

  it("accepts the handle on another network, a second account on the network, and another creator's", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => ({
        otherNetwork: await run(
          tx,
          lineInsert(creatorB, "instagram", "t2_creator_b"),
        ),
        secondAccount: await run(
          tx,
          lineInsert(creatorB, "tiktok", "t2_creator_b_second"),
        ),
        otherCreator: await run(
          tx,
          lineInsert(creatorA, "tiktok", "t2_creator_b"),
        ),
      }),
    );
    expect(outcomes).toEqual({
      otherNetwork: ACCEPTED_ONE,
      secondAccount: ACCEPTED_ONE,
      otherCreator: ACCEPTED_ONE,
    });
  });
});

describe("L2D-D5: one primary line per creator at most (RG41)", () => {
  it("refuses a second primary line (23505)", async () => {
    expect(
      await attempt(
        lineInsert(creatorB, "youtube", "b_channel", ", is_primary|, true"),
      ),
    ).toEqual(
      refusedBy(UNIQUE_VIOLATION, "creator_social_accounts_one_primary"),
    );
  });

  it("accepts several secondary lines beside the primary one", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => [
        await run(tx, lineInsert(creatorB, "youtube", "b_channel")),
        await run(tx, lineInsert(creatorB, "twitch", "b_stream")),
      ],
    );
    expect(outcomes).toEqual([ACCEPTED_ONE, ACCEPTED_ONE]);
  });
});

describe("0217: the creator declares his own lines, never their source, date nor network", () => {
  it("lets him declare, correct and remove his own line, never another's", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        declare: await run(
          tx,
          `insert into profiles.creator_social_accounts
             (account_id, network_code, handle, pseudonym, profile_url, followers_count,
              posts_last_30_days, avg_comments_per_post, avg_reach_per_post, engagement_rate_bp)
           values ('${creatorA}', 'youtube', 'cuisine_du_dimanche', 'Cuisine du dimanche',
                   'https://www.youtube.com/@cuisine_du_dimanche', 12000, 9, 40, 3000, 350)`,
        ),
        declareOther: await run(
          tx,
          lineInsert(creatorB, "youtube", "not_mine"),
        ),
        correct: await run(
          tx,
          `update profiles.creator_social_accounts set followers_count = 47400, pseudonym = 'Cam'
            where id = '${lineA}'`,
        ),
        correctOther: await run(
          tx,
          `update profiles.creator_social_accounts set followers_count = 1 where id = '${lineB}'`,
        ),
        remove: await run(
          tx,
          `delete from profiles.creator_social_accounts
            where account_id = '${creatorA}' and network_code = 'youtube'`,
        ),
        removeOther: await run(
          tx,
          `delete from profiles.creator_social_accounts where id = '${lineB}'`,
        ),
      })),
    );
    expect(outcomes).toEqual({
      declare: ACCEPTED_ONE,
      declareOther: refusedBy(INSUFFICIENT_PRIVILEGE),
      correct: ACCEPTED_ONE,
      correctOther: NONE,
      remove: ACCEPTED_ONE,
      removeOther: NONE,
    });
  });

  it.each([
    ["figures_source", "figures_source = 'agent_observed'"],
    ["figures_measured_at", "figures_measured_at = now()"],
    ["network_code (EC-L2D-04-1)", "network_code = 'tiktok'"],
    ["id", "id = gen_random_uuid()"],
    ["account_id", `account_id = '${creatorB}'`],
  ])(
    "refuses the creator an update of %s on his own line (42501)",
    async (_column, assignment) => {
      const outcome = await inRolledBackTransaction(localSuperuser(), (tx) =>
        asCreator(tx, creatorA, () =>
          run(
            tx,
            `update profiles.creator_social_accounts set ${assignment} where id = '${lineA}'`,
          ),
        ),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );

  it("refuses the creator a line declared with its source or its date (42501)", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => [
        await run(
          tx,
          lineInsert(
            creatorA,
            "youtube",
            "a_channel",
            ", figures_source|, 'agent_observed'",
          ),
        ),
        await run(
          tx,
          lineInsert(
            creatorA,
            "youtube",
            "a_channel",
            ", figures_measured_at|, now()",
          ),
        ),
      ]),
    );
    expect(outcomes).toEqual(Array(2).fill(refusedBy(INSUFFICIENT_PRIVILEGE)));
  });

  it("lets an agent read every line in aal2, none in aal1, and write none", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => ({
        aal2: await asAgent(
          tx,
          "aal2",
          () =>
            tx<{ id: string }[]>`
            select id::text from profiles.creator_social_accounts
             where id in (${lineA}, ${lineB}) order by id`,
        ),
        aal1: await asAgent(
          tx,
          "aal1",
          () =>
            tx<
              { id: string }[]
            >`select id::text from profiles.creator_social_accounts`,
        ),
        write: await asAgent(tx, "aal2", () =>
          run(
            tx,
            `update profiles.creator_social_accounts set figures_source = 'agent_observed'
              where id = '${lineA}'`,
          ),
        ),
      }),
    );
    expect(outcomes.aal2.map((row) => row.id)).toEqual([lineA, lineB]);
    expect(outcomes.aal1).toEqual([]);
    expect(outcomes.write).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  function lineUpdate(assignment: string): string {
    return `update profiles.creator_social_accounts set ${assignment} where id = '${lineB}'`;
  }

  it.each([
    [
      "a handle of 101 characters",
      "handle = repeat('h', 101)",
      "creator_social_accounts_handle_length",
    ],
    [
      "a blank handle",
      "handle = '  '",
      "creator_social_accounts_handle_not_blank",
    ],
    [
      "a pseudonym of 61 characters",
      "pseudonym = repeat('p', 61)",
      "creator_social_accounts_pseudonym_length",
    ],
    [
      "a pseudonym with a line feed",
      "pseudonym = E'Cam\\nille'",
      "creator_social_accounts_pseudonym_printable",
    ],
    [
      "a negative follower count",
      "followers_count = -1",
      "creator_social_accounts_followers_count",
    ],
    [
      "a negative count of publications",
      "posts_last_30_days = -1",
      "creator_social_accounts_posts_last_30_days",
    ],
    [
      "a negative comment average",
      "avg_comments_per_post = -1",
      "creator_social_accounts_avg_comments_per_post",
    ],
    [
      "a negative reach",
      "avg_reach_per_post = -1",
      "creator_social_accounts_avg_reach_per_post",
    ],
    [
      "an engagement over 100 % (10001 bp)",
      "engagement_rate_bp = 10001",
      "creator_social_accounts_engagement_rate_bp",
    ],
    [
      "a source out of the list",
      "figures_source = 'guessed'",
      "creator_social_accounts_figures_source",
    ],
    [
      "a URL in http",
      "profile_url = 'http://tiktok.com/@t2_creator_b'",
      "creator_social_accounts_profile_url_shape",
    ],
    [
      "a URL with a space",
      "profile_url = 'https://tiktok.com/@t2 creator'",
      "creator_social_accounts_profile_url_shape",
    ],
  ])("refuses %s (23514)", async (_label, assignment, constraint) => {
    expect(await attempt(lineUpdate(assignment))).toEqual(
      refusedBy(CHECK_VIOLATION, constraint),
    );
  });

  it("accepts zero figures and an engagement of 100 % (RG46)", async () => {
    expect(
      await attempt(
        lineUpdate(
          "followers_count = 0, posts_last_30_days = 0, avg_comments_per_post = 0, " +
            "avg_reach_per_post = 0, engagement_rate_bp = 10000",
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });
});

// ---------------------------------------------------------------------------------------------
// RG43: the URL points to the declared network (reference.network_url_hosts)
// ---------------------------------------------------------------------------------------------

describe("RG43: the guard holds the host of the URL to the network of the line", () => {
  function urlOnLineA(url: string): string {
    return `update profiles.creator_social_accounts set profile_url = '${url}' where id = '${lineA}'`;
  }

  it.each([
    "https://instagram.com/t2_creator_a",
    "https://www.instagram.com/t2_creator_a/",
    "https://WWW.Instagram.com:443/t2_creator_a?hl=fr",
  ])("accepts %s on an instagram line", async (url) => {
    expect(await attempt(urlOnLineA(url))).toEqual(ACCEPTED_ONE);
  });

  it.each([
    ["the host of another network", "https://tiktok.com/@t2_creator_a"],
    ["a look-alike host", "https://evilinstagram.com/t2_creator_a"],
    ["a host merely starting like it", "https://instagram.com.example.test/x"],
    ["credentials before the host", "https://user:secret@instagram.com/x"],
    ["no host", "https:///t2_creator_a"],
  ])("refuses %s (23514)", async (_label, url) => {
    expect(await attempt(urlOnLineA(url))).toEqual(
      refusedBy(CHECK_VIOLATION, "creator_social_accounts_profile_url_host"),
    );
  });

  it.each([
    ["a backslash in the authority", "https://evil.example\\.instagram.com/x"],
    ["a percent-encoded backslash", "https://evil.example%5C.instagram.com/x"],
    ["brackets in the authority", "https://[::1]/x"],
    ["an empty port", "https://instagram.com:/x"],
  ])(
    "refuses %s as a shape before any host comparison (L2DS-1, 0220, 23514)",
    async (_label, url) => {
      expect(await attempt(urlOnLineA(url))).toEqual(
        refusedBy(CHECK_VIOLATION, "creator_social_accounts_profile_url_shape"),
      );
    },
  );

  it("still accepts a legitimate host with a port after 0220 (L2DS-1)", async () => {
    expect(
      await attempt(urlOnLineA("https://www.instagram.com:8443/t2_creator_a")),
    ).toEqual(ACCEPTED_ONE);
  });

  it("accepts the second host of a network (fb.com, twitter.com)", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => [
        await run(
          tx,
          lineInsert(
            creatorB,
            "facebook",
            "b_page",
            ", profile_url|, 'https://m.fb.com/b_page'",
          ),
        ),
        await run(
          tx,
          lineInsert(
            creatorB,
            "x",
            "b_posts",
            ", profile_url|, 'https://twitter.com/b_posts'",
          ),
        ),
      ],
    );
    expect(outcomes).toEqual([ACCEPTED_ONE, ACCEPTED_ONE]);
  });

  it("holds the URL when the network of a line changes", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe(urlOnLineA("https://www.instagram.com/t2_creator_a"));
        return run(
          tx,
          `update profiles.creator_social_accounts set network_code = 'tiktok' where id = '${lineA}'`,
        );
      },
    );
    expect(outcome).toEqual(
      refusedBy(CHECK_VIOLATION, "creator_social_accounts_profile_url_host"),
    );
  });

  it("leaves a network without listed host free", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx`
          insert into reference.networks (code, label_key, supports_ownership_proof)
          values ('l2d_witness', 'network.l2d_witness', false)`;
        return run(
          tx,
          lineInsert(
            creatorB,
            "l2d_witness",
            "b_elsewhere",
            ", profile_url|, 'https://social.example.test/@b'",
          ),
        );
      },
    );
    expect(outcome).toEqual(ACCEPTED_ONE);
  });

  it("is applied to the creator himself, who reads the hosts with his context", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => [
        await run(tx, urlOnLineA("https://www.instagram.com/t2_creator_a")),
        await run(tx, urlOnLineA("https://www.tiktok.com/@t2_creator_a")),
      ]),
    );
    expect(outcomes).toEqual([
      ACCEPTED_ONE,
      refusedBy(CHECK_VIOLATION, "creator_social_accounts_profile_url_host"),
    ]);
  });

  it("refuses a URL from a writer who cannot read the network (EC-L2D-04-6, 23503)", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe("set local session authorization influx_app");
        await takeRole(tx, "influx_creator");
        return run(
          tx,
          lineInsert(
            creatorA,
            "youtube",
            "a_channel",
            ", profile_url|, 'https://evil.example.test/a'",
          ),
        );
      },
    );
    expect(outcome).toEqual(refusedBy(FOREIGN_KEY_VIOLATION));
  });

  it("lists the fourteen hosts of the ten networks, read by a member with his context", async () => {
    const found = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        hosts: await tx<{ network_code: string; host: string }[]>`
          select network_code, host from reference.network_url_hosts order by network_code, host`,
        write: await run(
          tx,
          "insert into reference.network_url_hosts (network_code, host) values ('youtube', 'youtu.be')",
        ),
      })),
    );
    expect(found.hosts).toHaveLength(14);
    expect(new Set(found.hosts.map((row) => row.network_code)).size).toBe(10);
    expect(found.hosts).toEqual(
      expect.arrayContaining([
        { network_code: "facebook", host: "fb.com" },
        { network_code: "threads", host: "threads.com" },
        { network_code: "twitch", host: "twitch.tv" },
        { network_code: "x", host: "twitter.com" },
      ]),
    );
    expect(found.write).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// The exact audience of a line (RG56 to RG61) and the refused sectors (RG75)
// ---------------------------------------------------------------------------------------------

describe("0217: the exact audience belongs to a line of its own account", () => {
  it("lets the creator add to his own line only: another's line fails the key, another's account the policy", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        own: await run(
          tx,
          `insert into profiles.creator_audience_countries
             (social_account_id, account_id, slot, country_code, share_percent)
           values ('${lineA}', '${creatorA}', 1, 'BE', 15)`,
        ),
        otherLine: await run(
          tx,
          `insert into profiles.creator_audience_ages
             (social_account_id, account_id, age_band_code, share_percent)
           values ('${lineB}', '${creatorA}', '35_44', 20)`,
        ),
        otherAccount: await run(
          tx,
          `insert into profiles.creator_audience_genders
             (social_account_id, account_id, gender_code, share_percent)
           values ('${lineB}', '${creatorB}', 'other', 5)`,
        ),
      })),
    );
    expect(outcomes).toEqual({
      own: ACCEPTED_ONE,
      otherLine: refusedBy(
        FOREIGN_KEY_VIOLATION,
        "creator_audience_ages_line_fk",
      ),
      otherAccount: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("goes with its line when the creator removes it", async () => {
    const found = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const removed = await asCreator(tx, creatorA, () =>
          run(
            tx,
            `delete from profiles.creator_social_accounts where id = '${lineA}'`,
          ),
        );
        const [left] = await tx<{ count: number }[]>`
          select ((select count(*) from profiles.creator_audience_countries
                    where social_account_id = ${lineA})
                + (select count(*) from profiles.creator_audience_ages
                    where social_account_id = ${lineA})
                + (select count(*) from profiles.creator_audience_genders
                    where social_account_id = ${lineA}))::int as count`;
        const [history] = await tx<{ count: number }[]>`
          select count(*)::int as count from profiles.creator_network_metrics_history
           where social_account_id = ${lineA}`;
        return { removed, left: left?.count, history: history?.count };
      },
    );
    expect(found.removed).toEqual(ACCEPTED_ONE);
    expect(found.left).toBe(0);
    // RG119: the history outlives the line
    expect(found.history).toBeGreaterThanOrEqual(1);
  });

  it.each([
    [
      "a sixth country",
      "creator_audience_countries",
      "slot, country_code, share_percent",
      "5, 'DE', 10",
      CHECK_VIOLATION,
      "creator_audience_countries_slot",
    ],
    [
      "another country under 10 %",
      "creator_audience_countries",
      "slot, country_code, share_percent",
      "1, 'DE', 9",
      CHECK_VIOLATION,
      "creator_audience_countries_other_share",
    ],
    [
      "another country without its share",
      "creator_audience_countries",
      "slot, country_code, share_percent",
      "1, 'DE', null",
      CHECK_VIOLATION,
      "creator_audience_countries_other_share",
    ],
    [
      "the same country twice on a line",
      "creator_audience_countries",
      "slot, country_code, share_percent",
      "1, 'GB', 15",
      UNIQUE_VIOLATION,
      "creator_audience_countries_once",
    ],
    [
      "an age share over 100",
      "creator_audience_ages",
      "age_band_code, share_percent",
      "'35_44', 101",
      CHECK_VIOLATION,
      "creator_audience_ages_share_percent",
    ],
    [
      "an age band under 18",
      "creator_audience_ages",
      "age_band_code, share_percent",
      "'13_17', 10",
      FOREIGN_KEY_VIOLATION,
      undefined,
    ],
    [
      "a gender out of the three",
      "creator_audience_genders",
      "gender_code, share_percent",
      "'unknown', 10",
      CHECK_VIOLATION,
      "creator_audience_genders_gender_code",
    ],
    [
      "a negative gender share",
      "creator_audience_genders",
      "gender_code, share_percent",
      "'other', -1",
      CHECK_VIOLATION,
      "creator_audience_genders_share_percent",
    ],
  ])("refuses %s", async (_label, table, columns, values, code, constraint) => {
    expect(
      await attempt(
        `insert into profiles.${table} (social_account_id, account_id, ${columns})
           values ('${lineB}', '${creatorB}', ${values})`,
      ),
    ).toEqual(refusedBy(code, constraint));
  });

  it("accepts a main country waiting for its share (EC-L2D-04-4) and a whole 100 %", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const [line] = await tx<{ id: string }[]>`
          insert into profiles.creator_social_accounts (account_id, network_code, handle)
          values (${creatorB}, 'youtube', 'b_channel') returning id::text`;
        return [
          await run(
            tx,
            `insert into profiles.creator_audience_countries
               (social_account_id, account_id, slot, country_code, share_percent)
             values ('${line?.id}', '${creatorB}', 0, 'US', null)`,
          ),
          await run(
            tx,
            `insert into profiles.creator_audience_ages
               (social_account_id, account_id, age_band_code, share_percent)
             values ('${line?.id}', '${creatorB}', '45_plus', 100)`,
          ),
        ];
      },
    );
    expect(outcomes).toEqual([ACCEPTED_ONE, ACCEPTED_ONE]);
  });

  it("lets the creator add and remove his own refused sectors, never another's", async () => {
    const outcomes = await inRolledBackTransaction(localSuperuser(), (tx) =>
      asCreator(tx, creatorA, async () => ({
        add: await run(
          tx,
          `insert into profiles.creator_refused_sectors (account_id, sector_code)
           values ('${creatorA}', 'crypto')`,
        ),
        addOther: await run(
          tx,
          `insert into profiles.creator_refused_sectors (account_id, sector_code)
           values ('${creatorB}', 'crypto')`,
        ),
        read: await tx<{ account_id: string }[]>`
          select distinct account_id::text from profiles.creator_refused_sectors`,
        removeOther: await run(
          tx,
          `delete from profiles.creator_refused_sectors where account_id = '${creatorB}'`,
        ),
      })),
    );
    expect(outcomes.add).toEqual(ACCEPTED_ONE);
    expect(outcomes.addOther).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.read.map((row) => row.account_id)).toEqual([creatorA]);
    expect(outcomes.removeOther).toEqual(NONE);
  });
});

// ---------------------------------------------------------------------------------------------
// RG119: the history, append-only, read by agent and admin only
// ---------------------------------------------------------------------------------------------

describe("RG119: the history of the metrics is append-only and internal", () => {
  it("is neither read nor written by the creator, read by an agent in aal2 only", async () => {
    const outcomes = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => ({
        creatorRead: await asCreator(tx, creatorA, () =>
          run(
            tx,
            "select account_id from profiles.creator_network_metrics_history",
          ),
        ),
        creatorWrite: await asCreator(tx, creatorA, () =>
          run(
            tx,
            `insert into profiles.creator_network_metrics_history
               (account_id, social_account_id, network_code, figures_source,
                recorded_by_account_id)
             values ('${creatorA}', '${lineA}', 'instagram', 'declared', '${creatorA}')`,
          ),
        ),
        agentRead: await asAgent(
          tx,
          "aal2",
          () =>
            tx<{ account_id: string }[]>`
            select distinct account_id::text from profiles.creator_network_metrics_history
             where account_id in (${creatorA}, ${creatorB}) order by 1`,
        ),
        agentAal1: await asAgent(
          tx,
          "aal1",
          () =>
            tx<{ account_id: string }[]>`
            select account_id::text from profiles.creator_network_metrics_history`,
        ),
        agentWrite: await asAgent(tx, "aal2", () =>
          run(
            tx,
            `delete from profiles.creator_network_metrics_history where account_id = '${creatorA}'`,
          ),
        ),
      }),
    );
    expect(outcomes.creatorRead).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.creatorWrite).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(outcomes.agentRead.map((row) => row.account_id)).toEqual([
      creatorA,
      creatorB,
    ]);
    expect(outcomes.agentAal1).toEqual([]);
    expect(outcomes.agentWrite).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("stops even its owner: UPDATE and DELETE raise the append-only exception", async () => {
    const outcomes = await inRolledBackTransaction(migration, async (tx) => [
      await run(
        tx,
        `update profiles.creator_network_metrics_history set followers_count = 1
          where account_id = '${creatorA}'`,
      ),
      await run(
        tx,
        `delete from profiles.creator_network_metrics_history where account_id = '${creatorA}'`,
      ),
    ]);
    for (const outcome of outcomes) {
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
      expect(outcome.outcome === "error" && outcome.message).toContain(
        "append-only",
      );
    }
  });

  it("lets through the delete of influx_privacy_definer alone, the erasure of 0219 (Q18)", async () => {
    const rows = await migration<{ definition: string }[]>`
      select pg_get_triggerdef(t.oid) as definition
        from pg_catalog.pg_trigger t
       where t.tgrelid = 'profiles.creator_network_metrics_history'::regclass
         and not t.tgisinternal
       order by t.tgname`;
    const definitions = rows.map((row) => row.definition);
    expect(definitions).toHaveLength(3);
    expect(
      definitions.find((definition) => definition.includes("BEFORE DELETE")),
    ).toContain("CURRENT_USER <> 'influx_privacy_definer'::name");
    expect(
      definitions.filter((definition) =>
        definition.includes("influx_privacy_definer"),
      ),
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D6, T16.5: the layers by column, no price
// ---------------------------------------------------------------------------------------------

/** Layer N columns of 07 RG16 (blocks 1 and 2): creator_identities alone carries them. */
const N_COLUMNS = [
  "legal_first_name",
  "legal_last_name",
  "contact_email",
  "contact_phone",
  "address_line",
  "postal_code",
  "city",
];
/** Layer I columns (blocks 3 and 4): never on the storefront nor its lists. */
const I_COLUMNS = [
  "handle",
  "pseudonym",
  "profile_url",
  "followers_count",
  "posts_last_30_days",
  "avg_comments_per_post",
  "avg_reach_per_post",
  "engagement_rate_bp",
  "share_percent",
];
const LAYER_A_TABLES = [
  "creator_public_profiles",
  "creator_topics",
  "creator_publication_languages",
  "creator_tones",
  "creator_formats",
  "creator_usage_rights",
];

async function creatorColumns(): Promise<
  { table_name: string; column_name: string; data_type: string }[]
> {
  return migration<
    { table_name: string; column_name: string; data_type: string }[]
  >`
    select table_name::text, column_name::text, data_type::text
      from information_schema.columns
     where table_schema = 'profiles' and table_name like 'creator\\_%'
     order by table_name, ordinal_position`;
}

describe("L2D-D6: neither the city nor an identity outside layer N, no exact figure in layer A", () => {
  it("carries the layer N columns in creator_identities and nowhere else", async () => {
    const columns = await creatorColumns();
    expect(
      columns
        .filter((row) => row.table_name === "creator_identities")
        .map((row) => row.column_name),
    ).toEqual(expect.arrayContaining(N_COLUMNS));
    expect(
      columns.filter(
        (row) =>
          N_COLUMNS.includes(row.column_name) &&
          row.table_name !== "creator_identities",
      ),
    ).toEqual([]);
  });

  it("puts no column of layer I or N on the storefront nor on its lists", async () => {
    const columns = await creatorColumns();
    expect(
      columns.filter((row) => LAYER_A_TABLES.includes(row.table_name)),
    ).not.toEqual([]);
    expect(
      columns.filter(
        (row) =>
          LAYER_A_TABLES.includes(row.table_name) &&
          (I_COLUMNS.includes(row.column_name) ||
            N_COLUMNS.includes(row.column_name)),
      ),
    ).toEqual([]);
  });

  it("collects neither photo, avatar, birth, age, gender of the creator nor company (RG29, RG40, EC-L2D-7)", async () => {
    const columns = await creatorColumns();
    expect(
      columns.filter(
        (row) =>
          /(photo|avatar|birth|company|nationality)/.test(row.column_name) ||
          ["age", "gender", "creator_gender", "sex"].includes(row.column_name),
      ),
    ).toEqual([]);
  });
});

describe("T16.5, D78: no amount, price nor float on any creator object", () => {
  it("stores no float, money nor numeric, and no amount, price or currency column", async () => {
    const columns = await creatorColumns();
    expect(
      columns.filter(
        (row) =>
          ["real", "double precision", "money", "numeric"].includes(
            row.data_type,
          ) ||
          /(^|_)(amount|montant|price|currency|net|tariff|fee)(_|$)/.test(
            row.column_name,
          ),
      ),
    ).toEqual([]);
  });

  it("has neither creator_rate_cards nor creator_public_rates (EC-L2D-2)", async () => {
    const [row] = await migration<
      { cards: string | null; rates: string | null }[]
    >`
      select to_regclass('profiles.creator_rate_cards')::text as cards,
             to_regclass('profiles.creator_public_rates')::text as rates`;
    expect(row).toEqual({ cards: null, rates: null });
  });
});
