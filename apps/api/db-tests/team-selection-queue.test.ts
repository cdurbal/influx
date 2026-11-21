// L3G commit 06 — queue 9 team_selection: claiming, releasing, extending and closing a request for a
// selection by the team, 0330 (jalons/l3g/06.md; l3g-fiche.md invariants 2, 3, 8, 11, 12, 14; jalons/
// l3g/modele.md §5; 15 RG27, RG35, RG36, AL23; 13 RG83; 17b I13; D45).
//   L3G-T6  the four doors in the catalogue (owner influx_agent_search_definer, EXECUTE for agent and
//           admin alone), the member 42501 and no member right (T2); two agents, one takes; release
//           then take again; an expired claim taken over; the extension; a closure without the claim
//           refused (55P03); the closed list of reasons (22023) and the note iff other; the closed
//           request; AL23 past the deadline, silent before; RG36 and T14 (one answer); nothing to the
//           outbox, matching nor messaging (D45).
// Each case runs in a rolled-back transaction of the local superuser, which writes its fixtures outside
// the guards and acts as apps/api does (support.ts: actAsMember, actAsInternal).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const LOCK_NOT_AVAILABLE = "55P03";

const OWNER = "influx_agent_search_definer";
const UNKNOWN_REQUEST = "00000000-0000-4000-8000-0000000fff09";

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const creatorA = accountIdOf("creator", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");

const OPEN = "select * from search.open_team_selection_request($1::uuid)";
const RELEASE = "select search.release_team_selection_request($1::uuid)";
const EXTEND = "select search.extend_team_selection_claim($1::uuid) as expires";
const CLOSE =
  "select search.close_team_selection_request($1::uuid, $2::text, $3::text) as closed_at";

const DOORS = [
  "search.close_team_selection_request(uuid,text,text)",
  "search.extend_team_selection_claim(uuid)",
  "search.open_team_selection_request(uuid)",
  "search.release_team_selection_request(uuid)",
];

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, detail and message. */
async function run<T = Row>(
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
    const found = error as { code?: string; detail?: string; message?: string };
    if (found.code === undefined) throw error;
    return {
      outcome: "error",
      code: found.code,
      detail: found.detail,
      message: found.message ?? "",
    };
  }
}

function errorOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? `${outcome.code} ${outcome.detail ?? ""}`.trim()
    : "ok";
}

/** An answer as the API would read it, every byte of it (T14). */
function bytesOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? JSON.stringify({
        code: outcome.code,
        detail: outcome.detail,
        message: outcome.message,
      })
    : JSON.stringify(outcome.rows);
}

function rowsOf<T>(outcome: Outcome<T>): T[] {
  if (outcome.outcome === "error") {
    throw new Error(
      `${outcome.code} ${outcome.message} (${outcome.detail ?? ""})`,
    );
  }
  return outcome.rows;
}

type Internal = { account: string; role: "agent" | "admin" };
const AGENT_A: Internal = { account: agentA, role: "agent" };
const AGENT_B: Internal = { account: agentB, role: "agent" };
const ADMIN_A: Internal = { account: adminA, role: "admin" };

function call<T = Row>(
  tx: Tx,
  who: Internal,
  statement: string,
  parameters: readonly Parameter[],
  aal: "aal1" | "aal2" = "aal2",
): Promise<Outcome<T>> {
  return actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal },
    () => run<T>(tx, statement, parameters),
  );
}

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  claimed_at: Date | null;
  claim_expires_at: Date | null;
};

async function open(tx: Tx, who: Internal, request: string): Promise<Opened> {
  const [row] = rowsOf(await call<Opened>(tx, who, OPEN, [request]));
  if (row === undefined) throw new Error("no answer");
  return row;
}

// the fixtures ------------------------------------------------------------------------------------

/** A request of `brand` deposited now, due in one day (the door of the brand is 0325's, tested there). */
async function newRequest(tx: Tx, brand = brandA): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into search.selection_requests
      (advertiser_account_id, filters, language, message, sla_due_at)
    values (${brand}, '{"F1": "pets"}'::jsonb, 'fr', 'Des créateurs comme ceux-ci, merci.',
            now() + interval '1 day')
    returning id::text`;
  if (row === undefined) throw new Error("no request");
  return row.id;
}

type RequestState = {
  state: string;
  claimed_by_account_id: string | null;
  closed_by_account_id: string | null;
  close_reason_code: string | null;
  close_note: string | null;
  closed: boolean;
};

async function stateOf(
  tx: Tx,
  request: string,
): Promise<RequestState | undefined> {
  const [row] = await tx<RequestState[]>`
    select state, claimed_by_account_id::text as claimed_by_account_id,
           closed_by_account_id::text as closed_by_account_id, close_reason_code, close_note,
           closed_at is not null as closed
      from search.selection_requests where id = ${request}`;
  return row;
}

type RegisterLine = {
  event_type: string;
  subject_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

async function registerOf(tx: Tx, request: string): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type, subject_type, actor_account_id::text as actor_account_id, payload
      from audit.audit_events
     where subject_id = ${request}
     order by seq`;
}

// ---------------------------------------------------------------------------------------------
// L3G-T6: the catalogue and the members (TM12.5, T2)
// ---------------------------------------------------------------------------------------------

describe("L3G-T6 the doors of queue 9 in the catalogue (TM12.5; fiche invariants 2, 3)", () => {
  it("L3G-T6 makes the four doors SECURITY DEFINER of influx_agent_search_definer, executable by influx_agent and influx_admin alone, empty search_path, static, naming neither the outbox, matching nor a creator; the gate an invoker helper executed by nobody; AL23 and the closing code loaded", async () => {
    const outcome = await scenario(async (tx) => {
      const functions = await tx<Row[]>`
        select p.oid::regprocedure::text as name, p.prosecdef as definer, p.proconfig as config,
               pg_catalog.pg_get_userbyid(p.proowner) as owner,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* '\\mexecute\\M|leads\\s*\\.|matching\\s*\\.|outbox|notification'
                 as reaches
          from pg_catalog.pg_proc p
         where p.pronamespace = 'search'::regnamespace
           and p.proname in ('open_team_selection_request', 'release_team_selection_request',
                             'extend_team_selection_claim', 'close_team_selection_request',
                             'lock_held_team_selection_request')
         order by p.oid::regprocedure::text collate "C"`;
      const [alert] = await tx<Row[]>`
        select nature::text as nature, threshold_value, recipient_roles
          from backoffice.alert_definitions where code = 'AL23'`;
      const [code] = await tx<Row[]>`
        select domain, subject_type, export_class
          from audit.event_types where code = 'search.selection_request_closed'`;
      return { functions, alert, code };
    });
    const door = (name: string) => ({
      name,
      definer: true,
      config: ['search_path=""'],
      owner: OWNER,
      callers: ["influx_admin", "influx_agent"],
      reaches: false,
    });
    expect(outcome.functions).toEqual([
      door(DOORS[0] as string),
      door(DOORS[1] as string),
      {
        name: "search.lock_held_team_selection_request(uuid,uuid)",
        definer: false,
        config: ['search_path=""'],
        owner: OWNER,
        callers: [],
        reaches: false,
      },
      door(DOORS[2] as string),
      door(DOORS[3] as string),
    ]);
    expect(outcome.alert).toEqual({
      nature: "etat",
      threshold_value: { basis: "selection_requests.sla_due_at" },
      recipient_roles: ["agent", "admin"],
    });
    expect(outcome.code).toEqual({
      domain: "search",
      subject_type: "selection_request",
      export_class: "exported",
    });
  });

  it("L3G-T6 TM12.5, T2: the brand and the creator get 42501 on each door and on the table, hold no right on it; the agent reads every column in aal2, the message as text, and nothing in aal1", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const member = async (
        role: "influx_advertiser" | "influx_creator",
        account: string,
      ) => {
        const codes: string[] = [];
        for (const [statement, parameters] of [
          [OPEN, [request]],
          [RELEASE, [request]],
          [EXTEND, [request]],
          [CLOSE, [request, "off_brief", null]],
          ["select id from search.selection_requests", []],
        ] as const) {
          codes.push(
            errorOf(
              await actAsMember(
                tx,
                role,
                {
                  accountId: account,
                  role: role === "influx_advertiser" ? "advertiser" : "creator",
                  aal: "aal1",
                },
                () => run(tx, statement, parameters),
              ),
            ),
          );
        }
        return codes;
      };
      const [rights] = await tx<{ held: string[] }[]>`
        select coalesce(array_agg(r order by r), '{}') as held
          from unnest(array['influx_advertiser', 'influx_creator']) r
         where pg_catalog.has_any_column_privilege(r, 'search.selection_requests',
                                                   'SELECT, INSERT, UPDATE, REFERENCES')
            or pg_catalog.has_table_privilege(r, 'search.selection_requests',
                                              'DELETE, TRUNCATE, TRIGGER')`;
      const read = (aal: "aal1" | "aal2") =>
        call<Row>(
          tx,
          AGENT_A,
          `select message, language, filters, state, claimed_by_account_id, close_reason_code,
                  close_note, sla_due_at is not null as due
             from search.selection_requests where id = $1::uuid`,
          [request],
          aal,
        );
      const agentWrite = await call(
        tx,
        AGENT_A,
        "update search.selection_requests set state = 'closed' where id = $1::uuid",
        [request],
      );
      return {
        brand: await member("influx_advertiser", brandA),
        creator: await member("influx_creator", creatorA),
        rights: rights?.held,
        aal2: rowsOf(await read("aal2")),
        aal1: rowsOf(await read("aal1")),
        agentWrite: errorOf(agentWrite),
      };
    });
    expect(outcome.brand).toEqual(Array(5).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.creator).toEqual(Array(5).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.rights).toEqual([]);
    expect(outcome.aal2).toEqual([
      {
        message: "Des créateurs comme ceux-ci, merci.",
        language: "fr",
        filters: { F1: "pets" },
        state: "open",
        claimed_by_account_id: null,
        close_reason_code: null,
        close_note: null,
        due: true,
      },
    ]);
    expect(outcome.aal1).toEqual([]);
    expect(outcome.agentWrite).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("L3G-T6 refuses an agent in aal1 on each door (42501) and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const codes = [
        errorOf(await call(tx, AGENT_A, OPEN, [request], "aal1")),
        errorOf(await call(tx, AGENT_A, RELEASE, [request], "aal1")),
        errorOf(await call(tx, AGENT_A, EXTEND, [request], "aal1")),
        errorOf(
          await call(tx, AGENT_A, CLOSE, [request, "off_brief", null], "aal1"),
        ),
      ];
      return {
        codes,
        state: await stateOf(tx, request),
        lines: await registerOf(tx, request),
      };
    });
    expect(outcome.codes).toEqual(Array(4).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.state?.claimed_by_account_id).toBeNull();
    expect(outcome.lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// L3G-T6: the claim (15 RG27 C1 to C3)
// ---------------------------------------------------------------------------------------------

describe("L3G-T6 the claim of a request (15 RG27, RG35)", () => {
  it("L3G-T6 two agents open the same request: one takes it, the other reads it held by the first, never an error; the holder opens it again as held; each opening is registered", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const first = await open(tx, AGENT_A, request);
      const second = await open(tx, AGENT_B, request);
      const again = await open(tx, AGENT_A, request);
      return {
        first,
        second,
        again,
        state: await stateOf(tx, request),
        lines: await registerOf(tx, request),
      };
    });
    expect(outcome.first).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentA,
    });
    const minutes =
      ((outcome.first.claim_expires_at?.getTime() ?? 0) -
        (outcome.first.claimed_at?.getTime() ?? 0)) /
      60_000;
    expect(minutes).toBe(30);
    expect(outcome.second).toEqual({ ...outcome.first, outcome: "read_only" });
    expect(outcome.again).toEqual({ ...outcome.first, outcome: "held" });
    expect(outcome.state?.claimed_by_account_id).toBe(agentA);
    expect(outcome.lines).toEqual(
      ["claimed", "read_only", "held"].map((opened, index) => ({
        event_type: "queue.entry_opened",
        subject_type: "queue_entry",
        actor_account_id: index === 1 ? agentB : agentA,
        payload: { queue_code: "team_selection", outcome: opened },
      })),
    );
  });

  it("L3G-T6 the holder releases the request, another agent takes it; the former holder can no longer release it (55P03, the live holder named)", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, AGENT_A, request);
      const released = errorOf(await call(tx, AGENT_A, RELEASE, [request]));
      const afterRelease = await stateOf(tx, request);
      const taken = await open(tx, AGENT_B, request);
      const late = errorOf(await call(tx, AGENT_A, RELEASE, [request]));
      const lines = (await registerOf(tx, request)).map(
        (line) => line.event_type,
      );
      return { released, afterRelease, taken, late, lines };
    });
    expect(outcome.released).toBe("ok");
    expect(outcome.afterRelease?.claimed_by_account_id).toBeNull();
    expect(outcome.taken).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentB,
    });
    expect(outcome.late).toBe(`${LOCK_NOT_AVAILABLE} ${agentB}`);
    expect(outcome.lines).toEqual([
      "queue.entry_opened",
      "queue.claim_released",
      "queue.entry_opened",
    ]);
  });

  it("L3G-T6 an expired claim is taken over by another agent, its holder and real expiry registered first", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, AGENT_A, request);
      await tx`update search.selection_requests
                  set claimed_at = now() - interval '40 minutes',
                      claim_expires_at = now() - interval '10 minutes'
                where id = ${request}`;
      const taken = await open(tx, AGENT_B, request);
      const lines = await registerOf(tx, request);
      return { taken, expired: lines.at(-2) };
    });
    expect(outcome.taken).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentB,
    });
    expect(outcome.expired).toMatchObject({
      event_type: "queue.claim_expired",
      actor_account_id: agentB,
      payload: expect.objectContaining({
        queue_code: "team_selection",
        holder_account_id: agentA,
      }),
    });
  });

  it("L3G-T6 the holder extends the claim (claim_expiry_minutes from now, registered); another agent cannot (55P03)", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, AGENT_A, request);
      await tx`update search.selection_requests
                  set claimed_at = now() - interval '20 minutes',
                      claim_expires_at = now() + interval '10 minutes'
                where id = ${request}`;
      const [extended] = rowsOf(
        await call<{ expires: Date }>(tx, AGENT_A, EXTEND, [request]),
      );
      const [now] = await tx<{ now: Date }[]>`select now() as now`;
      const other = errorOf(await call(tx, AGENT_B, EXTEND, [request]));
      const [line] = (await registerOf(tx, request)).filter(
        (entry) => entry.event_type === "queue.claim_extended",
      );
      return {
        minutes:
          ((extended?.expires.getTime() ?? 0) - (now?.now.getTime() ?? 0)) /
          60_000,
        other,
        line,
      };
    });
    expect(outcome.minutes).toBe(30);
    expect(outcome.other).toBe(`${LOCK_NOT_AVAILABLE} ${agentA}`);
    expect(outcome.line).toMatchObject({
      actor_account_id: agentA,
      payload: expect.objectContaining({
        queue_code: "team_selection",
        holder_account_id: agentA,
      }),
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3G-T6: the closure (modele §5; 17b I13)
// ---------------------------------------------------------------------------------------------

describe("L3G-T6 the closure with a reason (modele §5; 13 RG83; 17b I13)", () => {
  it("L3G-T6 refuses to close a request nobody holds (55P03 none) or another agent holds (55P03, the holder), and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const free = errorOf(
        await call(tx, AGENT_A, CLOSE, [request, "off_brief", null]),
      );
      await open(tx, AGENT_B, request);
      const held = errorOf(
        await call(tx, AGENT_A, CLOSE, [request, "off_brief", null]),
      );
      return { free, held, state: await stateOf(tx, request) };
    });
    expect(outcome.free).toBe(`${LOCK_NOT_AVAILABLE} none`);
    expect(outcome.held).toBe(`${LOCK_NOT_AVAILABLE} ${agentB}`);
    expect(outcome.state).toMatchObject({ state: "open", closed: false });
  });

  it("L3G-T6 refuses a reason outside the closed list, budget_mismatch and suspected_circumvention included (22023 reason), a note missing, short or with a control character for other, and a note with another reason (22023 note)", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, AGENT_A, request);
      const tried: string[] = [];
      for (const [reason, note] of [
        ["unknown_reason", null],
        ["budget_mismatch", null],
        ["suspected_circumvention", null],
        ["creator_unavailable", null],
        [null, null],
        ["other", null],
        ["other", "   court   "],
        ["other", "Une note\u0007 avec un caractère de contrôle."],
        ["other", "x".repeat(501)],
        ["off_brief", "Une note qui n'a pas lieu d'être ici."],
      ] as const) {
        tried.push(
          errorOf(await call(tx, AGENT_A, CLOSE, [request, reason, note])),
        );
      }
      return { tried, state: await stateOf(tx, request) };
    });
    expect(outcome.tried).toEqual([
      ...Array(5).fill(`${INVALID_PARAMETER} reason`),
      ...Array(5).fill(`${INVALID_PARAMETER} note`),
    ]);
    expect(outcome.state).toMatchObject({
      state: "open",
      claimed_by_account_id: agentA,
    });
  });

  it("L3G-T6 the holder closes with a reason: closed, date, agent and reason, the claim given back, search.selection_request_closed {reason_code} only; then every act answers closed or 55000 entry_closed", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, AGENT_A, request);
      const [closed] = rowsOf(
        await call<{ closed_at: Date }>(tx, AGENT_A, CLOSE, [
          request,
          "off_brief",
          null,
        ]),
      );
      const state = await stateOf(tx, request);
      const reopened = await open(tx, AGENT_B, request);
      const acts = [
        errorOf(await call(tx, AGENT_A, RELEASE, [request])),
        errorOf(await call(tx, AGENT_A, EXTEND, [request])),
        errorOf(await call(tx, AGENT_A, CLOSE, [request, "duplicate", null])),
      ];
      const closing = (await registerOf(tx, request)).filter(
        (line) => line.event_type === "search.selection_request_closed",
      );
      return { closedAt: closed?.closed_at, state, reopened, acts, closing };
    });
    expect(outcome.closedAt).toBeInstanceOf(Date);
    expect(outcome.state).toEqual({
      state: "closed",
      claimed_by_account_id: null,
      closed_by_account_id: agentA,
      close_reason_code: "off_brief",
      close_note: null,
      closed: true,
    });
    expect(outcome.reopened).toEqual({
      outcome: "closed",
      holder_account_id: null,
      claimed_at: null,
      claim_expires_at: null,
    });
    expect(outcome.acts).toEqual(
      Array(3).fill(`${NOT_IN_PREREQUISITE_STATE} entry_closed`),
    );
    expect(outcome.closing).toEqual([
      {
        event_type: "search.selection_request_closed",
        subject_type: "selection_request",
        actor_account_id: agentA,
        payload: { reason_code: "off_brief" },
      },
    ]);
  });

  it("L3G-T6 an admin closes with other and its note, kept trimmed, never written to the register", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      await open(tx, ADMIN_A, request);
      const closed = errorOf(
        await call(tx, ADMIN_A, CLOSE, [
          request,
          "other",
          "  Sélection envoyée par téléphone au commercial.  ",
        ]),
      );
      const register = JSON.stringify(await registerOf(tx, request));
      return { closed, state: await stateOf(tx, request), register };
    });
    expect(outcome.closed).toBe("ok");
    expect(outcome.state).toMatchObject({
      state: "closed",
      closed_by_account_id: adminA,
      close_reason_code: "other",
      close_note: "Sélection envoyée par téléphone au commercial.",
    });
    expect(outcome.register).not.toContain("téléphone");
  });
});

// ---------------------------------------------------------------------------------------------
// L3G-T6: AL23, RG36 and T14, D45
// ---------------------------------------------------------------------------------------------

describe("L3G-T6 AL23, the held brand and the unknown request, nothing outside queue 9", () => {
  it("L3G-T6 AL23: an open request past its deadline is read by the agent as late, silent before it and once closed", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const late = async () =>
        rowsOf(
          await call<{ id: string }>(
            tx,
            AGENT_A,
            `select id::text from search.selection_requests
              where id = $1::uuid and state = 'open' and sla_due_at < now()`,
            [request],
          ),
        ).length;
      const before = await late();
      await tx`update search.selection_requests
                  set created_at = now() - interval '3 days', sla_due_at = now() - interval '1 hour'
                where id = ${request}`;
      const past = await late();
      await open(tx, AGENT_A, request);
      await call(tx, AGENT_A, CLOSE, [request, "campaign_closed", null]);
      return { before, past, closed: await late() };
    });
    expect(outcome).toEqual({ before: 0, past: 1, closed: 0 });
  });

  it("L3G-T6 RG36, T14: an unknown request and an open request of a brand the caller holds get the same 42501 on opening, extension and closure; another agent takes it; the holder of the brand may still give a claim back", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx, brandB);
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${brandB}`;
      const unknown = [
        bytesOf(await call(tx, AGENT_A, OPEN, [UNKNOWN_REQUEST])),
        bytesOf(await call(tx, AGENT_A, EXTEND, [UNKNOWN_REQUEST])),
        bytesOf(
          await call(tx, AGENT_A, CLOSE, [UNKNOWN_REQUEST, "off_brief", null]),
        ),
      ];
      const held = [
        bytesOf(await call(tx, AGENT_A, OPEN, [request])),
        bytesOf(await call(tx, AGENT_A, EXTEND, [request])),
        bytesOf(await call(tx, AGENT_A, CLOSE, [request, "off_brief", null])),
      ];
      const releaseUnknown = errorOf(
        await call(tx, AGENT_A, RELEASE, [UNKNOWN_REQUEST]),
      );
      const other = await open(tx, AGENT_B, request);
      // a claim the holder of the brand took before he held it: he gives it back
      await tx`update search.selection_requests
                  set claimed_by_account_id = ${agentA}, claimed_at = now(),
                      claim_expires_at = now() + interval '30 minutes'
                where id = ${request}`;
      const giveBack = errorOf(await call(tx, AGENT_A, RELEASE, [request]));
      return { unknown, held, releaseUnknown, other: other.outcome, giveBack };
    });
    expect(outcome.held).toEqual(outcome.unknown);
    expect(JSON.parse(outcome.unknown[0] as string)).toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.releaseUnknown).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.other).toBe("claimed");
    expect(outcome.giveBack).toBe("ok");
  });

  it("L3G-T6 D45, RG8: opening, extending, releasing and closing write nothing to leads.outbox_events, matching, messaging nor the brand's account; the register only", async () => {
    const outcome = await scenario(async (tx) => {
      const request = await newRequest(tx);
      const [names] = await tx<{ tables: string[] }[]>`
        select coalesce(array_agg(c.oid::regclass::text order by c.oid), '{}') as tables
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('matching', 'messaging') and c.relkind in ('r', 'p')`;
      const counts = async () => {
        const [row] = await tx<Row[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit,
                 (select md5(a::text) from identity.accounts a where a.id = ${brandA}) as brand`;
        const tables: Record<string, number> = {};
        for (const table of names?.tables ?? []) {
          const [counted] = await tx.unsafe<{ n: number }[]>(
            `select count(*)::int as n from ${table}`,
          );
          tables[table] = counted?.n ?? -1;
        }
        return { ...(row ?? {}), tables } as Row & {
          tables: Record<string, number>;
        };
      };
      const before = await counts();
      await open(tx, AGENT_A, request);
      await call(tx, AGENT_A, EXTEND, [request]);
      await call(tx, AGENT_A, RELEASE, [request]);
      await open(tx, AGENT_A, request);
      await call(tx, AGENT_A, CLOSE, [request, "motive_insufficient", null]);
      return { before, after: await counts(), names: names?.tables };
    });
    expect(outcome.names).toContain("matching.party_blocks");
    expect(outcome.after).toEqual({
      ...outcome.before,
      audit: Number(outcome.before.audit) + 5,
    });
  });
});
