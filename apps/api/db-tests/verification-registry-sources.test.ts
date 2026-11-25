// L2F commit 03 — the registry sources by subdivision, 0229 (jalons/l2f/03.md; l2f-fiche.md invariants
// 10, 17; 21 §8 L2E-US, L2ES-3, EC-L2C-fix-2-2; 06 RG52, RG101; 15 RG36, RG110, CA19). L2F-D20: the
// register of a State beside the register of its country, one active per (country, subdivision), added
// by an administrator and journalled; the brand grant accepts a State of the country of registration
// only; the refused write of an agent and the RG36 refusal of an administrator leave their trace. Each
// case runs in a rolled-back transaction of the local superuser, the functions called as apps/api
// calls them.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { actAsInternal, localSuperuser, testDataSet } from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const UNIQUE_VIOLATION = "23505";

const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      message: string;
      detail: string | undefined;
      constraint: string | undefined;
    };
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message, detail and constraint. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as {
      code?: string;
      message?: string;
      detail?: string;
      constraint_name?: string;
    };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      message: found.message ?? "",
      detail: found.detail,
      constraint: found.constraint_name,
    };
  }
}

function refused(code: string, message: string, detail?: string): unknown {
  return expect.objectContaining(
    detail === undefined
      ? { outcome: "error", code, message }
      : { outcome: "error", code, message, detail },
  );
}

function asInternal<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  role: "agent" | "admin" = "agent",
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: account, role, aal },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

const ADD =
  "select verification.add_registry_source($1::text, $2::text, $3::text, $4::text, $5::date, $6::boolean) as id";
const SET =
  "select verification.set_registry_source($1::uuid, $2::text, $3::text, $4::date, $5::boolean) as at";
const REFUSED = "select backoffice.record_refused_action($1::text) as done";
const OPEN = "select * from verification.open_request($1::uuid)";
const GRANT_BRAND =
  "select * from verification.grant_brand_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::uuid, $7::text)";

/** The UTC date `days` days from today, as the administrator types it. */
function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** add_registry_source as admin A: the source of `subdivision` (or of the whole country). */
function add(
  tx: Tx,
  country: string | null,
  subdivision: string | null,
  options: {
    active?: boolean;
    checkedOn?: string;
    who?: "agent" | "admin";
  } = {},
) {
  const who = options.who ?? "admin";
  return asInternal(
    tx,
    who === "admin" ? adminA : agentA,
    () =>
      run<{ id: string }>(tx, ADD, [
        country,
        subdivision,
        `Register of ${subdivision ?? country ?? "nowhere"}`,
        `https://registry.example.test/${(subdivision ?? country ?? "x").toLowerCase()}`,
        options.checkedOn ?? day(0),
        options.active ?? true,
      ]),
    who,
  );
}

function idOf(outcome: Outcome<{ id: string }>): string {
  if (outcome.outcome !== "rows" || outcome.rows[0] === undefined) {
    throw new Error(`no source: ${JSON.stringify(outcome)}`);
  }
  return outcome.rows[0].id;
}

/** A code of the shape of 08 RG21 (the generator is the doors' own). */
function freshCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = Buffer.from(randomUUID().replace(/-/g, ""), "hex");
  let signs = "";
  for (let index = 0; index < 8; index += 1) {
    signs += alphabet[(bytes[index] ?? 0) % alphabet.length];
  }
  return `INFLUX-${signs}`;
}

/** A pending brand request of brand A, registered in `country`, claimed by agent A. */
async function claimedBrandRequest(
  tx: Tx,
  country: string,
): Promise<{ request: string; code: string; token: string }> {
  await tx`
    update profiles.advertiser_profiles set website_domain = 't2-brand-a.example'
     where account_id = ${brandA}`;
  await tx`
    update profiles.advertiser_internal_details set registration_country_code = ${country}
     where account_id = ${brandA}`;
  const code = freshCode();
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests (account_id, level, status)
    values (${brandA}, 'brand_verified', 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  await tx`
    insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
    values (${row.id}, ${brandA}, 'domain', ${code}, now() + interval '7 days')`;
  const opened = await asInternal(tx, agentA, () =>
    run<{ review_token: string | null }>(tx, OPEN, [row.id]),
  );
  const token =
    opened.outcome === "rows" ? opened.rows[0]?.review_token : undefined;
  if (token == null) throw new Error("not claimed");
  return { request: row.id, code, token };
}

type RefusalLine = { payload: Record<string, unknown> };

/** The refused attempts journalled on `account`, oldest first. */
function refusalsOf(tx: Tx, account: string): Promise<RefusalLine[]> {
  return tx<RefusalLine[]>`
    select payload from audit.audit_events
     where event_type = 'backoffice.action_refused' and subject_id = ${account}
     order by seq`;
}

beforeAll(async () => {
  await testDataSet();
});

describe("L2F-D20 the registers of a State beside the register of its country (L2E-US; 06 RG52, RG101)", () => {
  it("an administrator adds the national source and the sources of two States, one active per (country, subdivision), each journalled with the value added", async () => {
    const found = await scenario(async (tx) => {
      const national = idOf(await add(tx, "US", null));
      const california = idOf(await add(tx, " us ", "us-ca"));
      const florida = idOf(await add(tx, "US", "US-FL"));
      const secondCalifornia = await add(tx, "US", "US-CA");
      const inactiveCalifornia = await add(tx, "US", "US-CA", {
        active: false,
      });
      const secondNational = await add(tx, "US", null);
      // a State of a country whose register is already active (GB: activated by its door)
      const [gb] = await tx<{ id: string; name: string; url: string }[]>`
        select id::text as id, name, url from verification.registry_sources
         where country_code = 'GB' and source_type = 'national'`;
      await asInternal(
        tx,
        adminA,
        () => run(tx, SET, [gb?.id, gb?.name, gb?.url, day(0), true]),
        "admin",
      );
      const scotland = await add(tx, "GB", "GB-SCT");
      // the agent reads the column (agent and admin read the sources, 0221)
      const read = await asInternal(tx, agentA, () =>
        run<{ subdivision: string | null; type: string; by: string }>(
          tx,
          `select subdivision_code as subdivision, source_type as type,
                  updated_by_account_id::text as by
             from verification.registry_sources
            where country_code = 'US' and is_active
            order by subdivision_code nulls first`,
        ),
      );
      const [trace] = await tx<
        { actor: string; payload: Record<string, unknown> }[]
      >`
        select actor_account_id::text as actor, payload from audit.audit_events
         where subject_id = ${california}
           and event_type = 'verification.registry_source_changed'`;
      return {
        ids: [national, california, florida],
        secondCalifornia,
        inactiveCalifornia,
        secondNational,
        scotland,
        read,
        trace,
      };
    });
    expect(new Set(found.ids).size).toBe(3);
    expect(found.secondCalifornia).toEqual(
      expect.objectContaining({
        outcome: "error",
        code: UNIQUE_VIOLATION,
        constraint: "registry_sources_one_active",
      }),
    );
    expect(found.inactiveCalifornia).toMatchObject({ outcome: "rows" });
    expect(found.secondNational).toEqual(
      expect.objectContaining({
        code: UNIQUE_VIOLATION,
        constraint: "registry_sources_one_active",
      }),
    );
    expect(found.scotland).toMatchObject({ outcome: "rows" });
    expect(found.read).toEqual({
      outcome: "rows",
      rows: [
        { subdivision: null, type: "national", by: adminA },
        { subdivision: "US-CA", type: "national", by: adminA },
        { subdivision: "US-FL", type: "national", by: adminA },
      ],
    });
    expect(found.trace).toEqual({
      actor: adminA,
      payload: {
        before: null,
        after: {
          country_code: "US",
          subdivision_code: "US-CA",
          source_type: "national",
          name: "Register of us-ca",
          url: "https://registry.example.test/us-ca",
          checked_on: day(0),
          is_active: true,
        },
      },
    });
  });

  it("refuses a subdivision of another country, an unknown one, an unknown country, a day in the future, a page that is not https, and a State on a source that is not national; the sources of 0221 keep their shape", async () => {
    const found = await scenario(async (tx) => {
      const before = await tx<{ n: string }[]>`
        select count(*)::text as n from verification.registry_sources`;
      const result = {
        otherCountry: await add(tx, "US", "CA-ON"),
        unknownSubdivision: await add(tx, "US", "US-ZZ"),
        unknownCountry: await add(tx, "ZZ", null),
        noCountry: await add(tx, null, "US-CA"),
        future: await add(tx, "US", "US-CA", { checkedOn: day(2) }),
        notHttps: await asInternal(
          tx,
          adminA,
          () =>
            run(tx, ADD, [
              "US",
              "US-NY",
              "New York",
              "http://example.test/",
              day(0),
              false,
            ]),
          "admin",
        ),
        eJustice: await run(
          tx,
          `insert into verification.registry_sources
             (country_code, subdivision_code, source_type, name, url, checked_on)
           values ('FR', 'FR-IDF', 'e_justice', 'T2 register', 'https://example.test/', current_date)`,
        ),
      };
      const after = await tx<{ n: string; subdivisions: string }[]>`
        select count(*)::text as n,
               count(*) filter (where subdivision_code is not null)::text as subdivisions
          from verification.registry_sources`;
      return { ...result, before: before[0]?.n, after: after[0] };
    });
    expect(found.otherCountry).toEqual(
      refused(INVALID_PARAMETER, "subdivision_code", "subdivision_code"),
    );
    expect(found.unknownSubdivision).toEqual(
      refused(INVALID_PARAMETER, "subdivision_code", "subdivision_code"),
    );
    expect(found.unknownCountry).toEqual(
      refused(INVALID_PARAMETER, "country_code", "country_code"),
    );
    expect(found.noCountry).toEqual(
      refused(INVALID_PARAMETER, "country_code", "country_code"),
    );
    expect(found.future).toEqual(
      refused(INVALID_PARAMETER, "checked_on", "checked_on"),
    );
    expect(found.notHttps).toEqual(
      expect.objectContaining({
        code: CHECK_VIOLATION,
        constraint: "registry_sources_url",
      }),
    );
    expect(found.eJustice).toEqual(
      expect.objectContaining({
        code: CHECK_VIOLATION,
        constraint: "registry_sources_subdivision_type",
      }),
    );
    expect(found.after).toEqual({ n: found.before, subdivisions: "0" });
  });

  it("the brand dossier: a State source of the country of registration is accepted at the grant, a State of another country refused (RG52)", async () => {
    const found = await scenario(async (tx) => {
      const ontario = idOf(await add(tx, "CA", "CA-ON"));
      const california = idOf(await add(tx, "US", "US-CA"));
      const { request, code, token } = await claimedBrandRequest(tx, "US");
      const grant = (source: string) =>
        asInternal(tx, agentA, () =>
          run<{ outcome: string }>(tx, GRANT_BRAND, [
            request,
            token,
            code,
            "t2-brand-a.example",
            "dns_txt",
            source,
            null,
          ]),
        );
      const otherCountry = await grant(ontario);
      const granted = await grant(california);
      const [badge] = await tx<{ source: string | null }[]>`
        select registry_source_id::text as source
          from verification.badges where request_id = ${request}`;
      return { otherCountry, granted, badge, california };
    });
    expect(found.otherCountry).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "no_registry_source",
        "no_registry_source",
      ),
    );
    expect(found.granted).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "granted" }],
    });
    expect(found.badge).toEqual({ source: found.california });
  });
});

describe("the refusals that leave their trace (L2ES-3, EC-L2C-fix-2-2; 15 RG36, RG110, CA19)", () => {
  it("L2ES-3: an agent is refused both writes (42501), and his attempts are journalled under their codes, required role admin", async () => {
    const found = await scenario(async (tx) => {
      const [gb] = await tx<{ id: string }[]>`
        select id::text as id from verification.registry_sources
         where country_code = 'GB' and source_type = 'national'`;
      const addByAgent = await add(tx, "US", "US-CA", { who: "agent" });
      const setByAgent = await asInternal(tx, agentA, () =>
        run(tx, SET, [
          gb?.id,
          "Companies House",
          "https://example.test/",
          day(0),
          true,
        ]),
      );
      const journalled = await asInternal(tx, agentA, async () => [
        await run(tx, REFUSED, ["verification.add_registry_source"]),
        await run(tx, REFUSED, ["verification.set_registry_source"]),
      ]);
      const lines = await refusalsOf(tx, agentA);
      const [states] = await tx<{ n: string }[]>`
        select count(*)::text as n from verification.registry_sources
         where subdivision_code is not null`;
      return { addByAgent, setByAgent, journalled, lines, states: states?.n };
    });
    expect(found.addByAgent).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(found.setByAgent).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(found.journalled.map((one) => one.outcome)).toEqual([
      "rows",
      "rows",
    ]);
    expect(found.lines.slice(-2).map((line) => line.payload)).toEqual([
      {
        action_code: "verification.add_registry_source",
        required_role: "admin",
      },
      {
        action_code: "verification.set_registry_source",
        required_role: "admin",
      },
    ]);
    expect(found.states).toBe("0");
  });

  it("EC-L2C-fix-2-2: an administrator journals his refusal on an account he holds, and no other code; a member, an unknown code and aal1 stay refused", async () => {
    const found = await scenario(async (tx) => {
      const before = (await refusalsOf(tx, adminA)).length;
      const conflict = await asInternal(
        tx,
        adminA,
        () => run(tx, REFUSED, ["queue.conflict_of_interest"]),
        "admin",
      );
      const adminAction = await asInternal(
        tx,
        adminA,
        () => run(tx, REFUSED, ["verification.add_registry_source"]),
        "admin",
      );
      const unknown = await asInternal(
        tx,
        adminA,
        () => run(tx, REFUSED, ["queue.everything"]),
        "admin",
      );
      const aal1 = await asInternal(
        tx,
        adminA,
        () => run(tx, REFUSED, ["queue.conflict_of_interest"]),
        "admin",
        "aal1",
      );
      const member = await run(
        tx,
        `select has_function_privilege('influx_creator', 'backoffice.record_refused_action(text)', 'EXECUTE')
             or has_function_privilege('influx_advertiser', 'backoffice.record_refused_action(text)', 'EXECUTE')
             or has_function_privilege('influx_advertiser', 'verification.add_registry_source(text,text,text,text,date,boolean)', 'EXECUTE')
             or has_function_privilege('influx_creator', 'verification.add_registry_source(text,text,text,text,date,boolean)', 'EXECUTE')
             as any`,
      );
      const lines = await refusalsOf(tx, adminA);
      return { before, conflict, adminAction, unknown, aal1, member, lines };
    });
    expect(found.conflict).toMatchObject({ outcome: "rows" });
    expect(found.adminAction).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(found.unknown).toEqual(
      expect.objectContaining({ code: INVALID_PARAMETER }),
    );
    expect(found.aal1).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.member).toEqual({ outcome: "rows", rows: [{ any: false }] });
    // one line, the conflict of interest, on the administrator's own account
    expect(found.lines).toHaveLength(found.before + 1);
    expect(found.lines.at(-1)?.payload).toEqual({
      action_code: "queue.conflict_of_interest",
      reason: "conflict_of_interest",
    });
  });
});
