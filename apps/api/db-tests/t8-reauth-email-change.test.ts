// T8 (J7, commit 2bis) — the re-authentication of a member and the change of address, the
// database half (migration 0118; decisions 4 and 5 of the J7 start; 05 RG57, RG58; 03 A-10,
// A-11): identity.mark_member_reauthenticated() (E-2, influx_auth), the single-use marker checked
// by identity.consume_member_reauthentication(), and the four member functions of the address
// change. The routes, the codes and GoTrue are commit 7.
//
// The marker is written by influx_auth and consumed by the member in the same flow: each case runs
// in ONE rolled-back transaction of the local superuser, which writes the fixtures, then acts as
// influx_auth (actAs) and as the member (actAsMember), exactly as apps/api takes these roles.
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type DataSetAccount,
  type ProbeResult,
  type UserContext,
} from "@influx/test-kit/db";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS } from "../src/domains/identity/settings.ts";
import {
  actAs,
  actAsMember,
  localSuperuser,
  loginRole,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";
/** J7S-7: the SQL literal of 0118 and the constant of apps/api are one value. */
const FRESHNESS = MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS;

type Purpose = "email_change" | "data_export" | "account_deletion";
type MemberRole = "influx_advertiser" | "influx_creator";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

type Member = {
  account: DataSetAccount;
  role: MemberRole;
  context: UserContext;
};

function member(role: "advertiser" | "creator", side: "a" | "b"): Member {
  const account = dataSet.accounts[role][side];
  return {
    account,
    role: role === "advertiser" ? "influx_advertiser" : "influx_creator",
    context: { accountId: account.id, role, aal: "aal1" },
  };
}

/** The data set session of the account (fresh at each load of the data set). */
async function sessionOf(
  tx: postgres.TransactionSql,
  account: DataSetAccount,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from identity.sessions where token_hash = ${account.sessionTokenHash}`;
  if (row === undefined) {
    throw new Error("no data set session");
  }
  return row.id;
}

/** E-2 as influx_auth: the account, or null when the session does not qualify. */
async function markReauthenticated(
  tx: postgres.TransactionSql,
  session: string,
  purpose: Purpose,
): Promise<string | null> {
  return actAs(tx, "auth", async () => {
    const [row] = await tx<{ account: string | null }[]>`
      select identity.mark_member_reauthenticated(${session}::uuid,
               ${purpose}::identity.reauth_purpose)::text as account`;
    return row?.account ?? null;
  });
}

async function markerOf(tx: postgres.TransactionSql, session: string) {
  const [row] = await tx<{ purpose: string | null; fresh: boolean | null }[]>`
    select reauth_purpose::text as purpose, reauthenticated_at = now() as fresh
      from identity.sessions where id = ${session}`;
  return row;
}

/** Ages the marker of a session (the guard refuses a back-dated marker: disabled here only). */
async function ageMarker(
  tx: postgres.TransactionSql,
  session: string,
  seconds: number,
): Promise<void> {
  await tx`alter table identity.sessions disable trigger sessions_guard_update`;
  // the session is older than its marker (sessions_reauth_marker), its bounds shifted with it
  // (sessions_member_bounds)
  await tx`
    update identity.sessions
       set created_at = created_at - interval '10 minutes',
           absolute_expires_at = absolute_expires_at - interval '10 minutes',
           reauthenticated_at = now() - make_interval(secs => ${seconds})
     where id = ${session}`;
  await tx`alter table identity.sessions enable trigger sessions_guard_update`;
}

function requestChange(
  tx: postgres.TransactionSql,
  who: Member,
  session: string,
  newEmail: string,
  request: string = randomUUID(),
): Promise<ProbeResult> {
  return actAsMember(tx, who.role, who.context, () =>
    probe(
      tx,
      "select identity.request_email_change($1::uuid, $2::uuid, $3, $4::bytea, $5::bytea)",
      [
        session,
        request,
        newEmail,
        digest(`old:${request}`),
        digest(`new:${request}`),
      ],
    ),
  );
}

/** A fresh marker, then the request; returns the request id. */
async function openRequest(
  tx: postgres.TransactionSql,
  who: Member,
  newEmail = `changed-${randomUUID().slice(0, 8)}@example.test`,
): Promise<{ request: string; session: string; newEmail: string }> {
  const session = await sessionOf(tx, who.account);
  await markReauthenticated(tx, session, "email_change");
  const request = randomUUID();
  const result = await requestChange(tx, who, session, newEmail, request);
  if (result.outcome !== "rows") {
    throw new Error(`request refused: ${JSON.stringify(result)}`);
  }
  return { request, session, newEmail };
}

type Confirmation = {
  outcome: string;
  ready: boolean;
  auth_user_id: string | null;
};

function confirm(
  tx: postgres.TransactionSql,
  who: Member,
  request: string,
  side: "old" | "new",
  code: Buffer,
): Promise<Confirmation | undefined> {
  return actAsMember(tx, who.role, who.context, async () => {
    const [row] = await tx<Confirmation[]>`
      select outcome, ready, auth_user_id::text
        from identity.confirm_email_change(${request}::uuid, ${side}::identity.email_change_side,
                                           ${code}::bytea)`;
    return row;
  });
}

function complete(
  tx: postgres.TransactionSql,
  who: Member,
  request: string,
  session: string,
): Promise<string | undefined> {
  return actAsMember(tx, who.role, who.context, async () => {
    const [row] = await tx<{ result: string }[]>`
      select identity.complete_email_change(${request}::uuid, ${session}::uuid) as result`;
    return row?.result;
  });
}

async function requestRow(tx: postgres.TransactionSql, request: string) {
  const [row] = await tx<
    {
      account_id: string;
      old_email: string;
      new_email: string;
      lifetime_hours: number;
      old_attempts: number;
      new_attempts: number;
      completed: boolean;
      cancel_reason: string | null;
      digests: boolean;
    }[]
  >`
    select account_id::text, old_email, new_email,
           extract(epoch from expires_at - created_at)::int / 3600 as lifetime_hours,
           old_attempts, new_attempts, completed_at is not null as completed,
           cancel_reason::text, old_code_hash is not null as digests
      from identity.email_change_requests where id = ${request}`;
  return row;
}

// ---------------------------------------------------------------------------------------------

describe("identity.mark_member_reauthenticated() (E-2, influx_auth only)", () => {
  it("sets the marker now, with its purpose, on an open member session, and returns the account", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const session = await sessionOf(tx, who.account);
      const account = await markReauthenticated(tx, session, "data_export");
      return { account, marker: await markerOf(tx, session) };
    });
    expect(result).toEqual({
      account: who.account.id,
      marker: { purpose: "data_export", fresh: true },
    });
  });

  it("returns NULL and writes nothing for a backoffice session, a revoked one or an unknown id", async () => {
    const results = await scenario(async (tx) => {
      const backoffice = await sessionOf(tx, dataSet.accounts.agent.a);
      const revoked = await sessionOf(tx, dataSet.accounts.advertiser.b);
      await tx`
        update identity.sessions set revoked_at = now(), revocation_reason = 'logout'
         where id = ${revoked}`;
      return [
        await markReauthenticated(tx, backoffice, "email_change"),
        await markReauthenticated(tx, revoked, "email_change"),
        await markReauthenticated(tx, randomUUID(), "email_change"),
        (await markerOf(tx, backoffice))?.purpose,
      ];
    });
    expect(results).toEqual([null, null, null, null]);
  });

  it.each([
    ["influx_worker_login", "influx_worker"],
    ["influx_app", "influx_creator"],
  ] as const)("is refused to %s (42501)", async (login, role) => {
    const result = await inRolledBackTransaction(
      loginRole(login),
      async (tx) => {
        if (role === "influx_creator") {
          await takeRole(tx, role, member("creator", "a").context);
        } else {
          await takeRole(tx, role);
        }
        return probe(
          tx,
          "select identity.mark_member_reauthenticated(gen_random_uuid(), 'email_change')",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("is never back-dated nor set on a backoffice session, even by the owner of the table (guard)", async () => {
    const results = await scenario(async (tx) => {
      const own = await sessionOf(tx, dataSet.accounts.creator.a);
      const backoffice = await sessionOf(tx, dataSet.accounts.agent.a);
      return [
        await probe(
          tx,
          `update identity.sessions set reauthenticated_at = now() - interval '1 minute',
                  reauth_purpose = 'email_change' where id = '${own}'`,
        ),
        await probe(
          tx,
          `update identity.sessions set reauthenticated_at = now(),
                  reauth_purpose = 'email_change' where id = '${backoffice}'`,
        ),
      ];
    });
    // the guard (42501), then the constraint of a member session (23514)
    expect(results[0]).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(results[1]).toMatchObject({ outcome: "error" });
  });
});

describe("the marker is single use, for one purpose, for MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS (consume_member_reauthentication)", () => {
  it("holds the constant of apps/api as its only bound (J7S-7)", async () => {
    const [row] = await localSuperuser()<{ definition: string }[]>`
      select pg_catalog.pg_get_functiondef(
               'identity.consume_member_reauthentication(uuid, identity.reauth_purpose)'::regprocedure)
               as definition`;
    const bounds = [
      ...(row?.definition ?? "").matchAll(/interval '(\d+) seconds'/g),
    ].map((match) => Number(match[1]));
    expect(bounds).toEqual([FRESHNESS]);
  });

  it.each([
    ["without a marker", null, 0],
    ["with the marker of another purpose", "data_export", 0],
    ["with a marker one second too old", "email_change", FRESHNESS + 1],
  ] as const)(
    "refuses the request %s (55000)",
    async (_label, purpose, age) => {
      const who = member("advertiser", "a");
      const result = await scenario(async (tx) => {
        const session = await sessionOf(tx, who.account);
        if (purpose !== null) {
          await markReauthenticated(tx, session, purpose);
          if (age > 0) {
            await ageMarker(tx, session, age);
          }
        }
        return requestChange(tx, who, session, "fresh@example.test");
      });
      expect(result).toEqual({
        outcome: "error",
        code: NOT_IN_PREREQUISITE_STATE,
      });
    },
  );

  it("accepts a marker one second short of the bound once, then refuses the second use", async () => {
    const who = member("advertiser", "a");
    const results = await scenario(async (tx) => {
      const session = await sessionOf(tx, who.account);
      await markReauthenticated(tx, session, "email_change");
      await ageMarker(tx, session, FRESHNESS - 1);
      return [
        await requestChange(tx, who, session, "first@example.test"),
        await requestChange(tx, who, session, "second@example.test"),
        (await markerOf(tx, session))?.purpose,
      ];
    });
    expect(results).toEqual([
      { outcome: "rows", count: 1 },
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
      null,
    ]);
  });

  it("refuses the marker of another account's session", async () => {
    const who = member("advertiser", "a");
    const result = await scenario(async (tx) => {
      const foreign = await sessionOf(tx, dataSet.accounts.advertiser.b);
      await markReauthenticated(tx, foreign, "email_change");
      return requestChange(tx, who, foreign, "steal@example.test");
    });
    expect(result).toEqual({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
  });
});

describe("identity.request_email_change()", () => {
  it("opens a 24-hour request from the current address, normalised, and supersedes the open one", async () => {
    const who = member("creator", "b");
    const result = await scenario(async (tx) => {
      // an open request left by an earlier run may be past its 24 hours: then it closes "expired"
      const [previous] = await tx<{ id: string; lapsed: boolean }[]>`
        select id::text, expires_at <= now() as lapsed from identity.email_change_requests
         where account_id = ${who.account.id} and completed_at is null and cancelled_at is null`;
      const [current] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${who.account.id}`;
      const { request } = await openRequest(
        tx,
        who,
        "  New.Address@Example.TEST ",
      );
      return {
        current: current?.email,
        row: await requestRow(tx, request),
        previous:
          previous === undefined
            ? undefined
            : await requestRow(tx, previous.id),
        lapsed: previous?.lapsed === true,
      };
    });
    expect(result.row).toMatchObject({
      account_id: who.account.id,
      old_email: result.current,
      new_email: "new.address@example.test",
      lifetime_hours: 24,
      old_attempts: 0,
      new_attempts: 0,
      completed: false,
      cancel_reason: null,
      digests: true,
    });
    expect(result.previous).toMatchObject({
      cancel_reason: result.lapsed ? "expired" : "superseded",
      digests: false,
    });
  });

  it.each([
    ["the same address", "current"],
    ["a malformed address", "no-at-sign"],
  ])("refuses %s (22023)", async (_label, address) => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const session = await sessionOf(tx, who.account);
      await markReauthenticated(tx, session, "email_change");
      const [current] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${who.account.id}`;
      return requestChange(
        tx,
        who,
        session,
        address === "current" ? (current?.email ?? "") : address,
      );
    });
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("never looks at whether the new address is taken (same answer, decision 5)", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const [taken] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${dataSet.accounts.advertiser.a.id}`;
      return requestChange(
        tx,
        who,
        await (async () => {
          const session = await sessionOf(tx, who.account);
          await markReauthenticated(tx, session, "email_change");
          return session;
        })(),
        taken?.email ?? "",
      );
    });
    expect(result).toEqual({ outcome: "rows", count: 1 });
  });
});

describe("identity.confirm_email_change()", () => {
  it("confirms both sides, then gives the GoTrue user id; a confirmed side answers already_confirmed to its code only (A1, 0124)", async () => {
    const who = member("advertiser", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const old = await confirm(
        tx,
        who,
        request,
        "old",
        digest(`old:${request}`),
      );
      const fresh = await confirm(
        tx,
        who,
        request,
        "new",
        digest(`new:${request}`),
      );
      // A1: a retry of the completion needs the code again, a wrong one is counted
      const guessed = await confirm(
        tx,
        who,
        request,
        "old",
        digest("anything"),
      );
      const again = await confirm(
        tx,
        who,
        request,
        "old",
        digest(`old:${request}`),
      );
      const [user] = await tx<{ id: string }[]>`
        select auth_user_id::text as id from identity.accounts where id = ${who.account.id}`;
      return {
        old,
        fresh,
        guessed,
        again,
        user: user?.id,
        row: await requestRow(tx, request),
      };
    });
    expect(result.old).toEqual({
      outcome: "confirmed",
      ready: false,
      auth_user_id: null,
    });
    expect(result.fresh).toEqual({
      outcome: "confirmed",
      ready: true,
      auth_user_id: result.user,
    });
    expect(result.guessed).toEqual({
      outcome: "invalid_code",
      ready: false,
      auth_user_id: null,
    });
    expect(result.again).toEqual({
      outcome: "already_confirmed",
      ready: true,
      auth_user_id: result.user,
    });
    expect(result.row).toMatchObject({ old_attempts: 1, new_attempts: 0 });
  });

  it("counts a wrong code, and closes the request at the fifth of a side (too_many_attempts)", async () => {
    const who = member("advertiser", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const outcomes: string[] = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        outcomes.push(
          (await confirm(tx, who, request, "new", digest("wrong")))?.outcome ??
            "",
        );
      }
      const after = await confirm(
        tx,
        who,
        request,
        "new",
        digest(`new:${request}`),
      );
      return {
        outcomes,
        after: after?.outcome,
        row: await requestRow(tx, request),
      };
    });
    expect(result.outcomes).toEqual([
      "invalid_code",
      "invalid_code",
      "invalid_code",
      "invalid_code",
      "attempts_exhausted",
    ]);
    expect(result.after).toBe("not_found");
    expect(result.row).toMatchObject({
      new_attempts: 5,
      old_attempts: 0,
      cancel_reason: "too_many_attempts",
      digests: false,
    });
  });

  it("closes an expired request (expired), and does not see another account's (not_found)", async () => {
    const who = member("advertiser", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const foreign = await confirm(
        tx,
        member("advertiser", "b"),
        request,
        "old",
        digest(`old:${request}`),
      );
      await tx`alter table identity.email_change_requests disable trigger email_change_requests_guard_update`;
      await tx`
        update identity.email_change_requests
           set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
         where id = ${request}`;
      await tx`alter table identity.email_change_requests enable trigger email_change_requests_guard_update`;
      const expired = await confirm(
        tx,
        who,
        request,
        "old",
        digest(`old:${request}`),
      );
      return {
        foreign: foreign?.outcome,
        expired: expired?.outcome,
        row: await requestRow(tx, request),
      };
    });
    expect(result).toMatchObject({
      foreign: "not_found",
      expired: "expired",
      row: { cancel_reason: "expired", digests: false },
    });
  });
});

describe("identity.complete_email_change()", () => {
  it("changes the address, revokes the other sessions, queues email.changed and the two notices, writes the register line", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const { request, session, newEmail } = await openRequest(tx, who);
      // another open session of the same account, to be revoked
      const [other] = await tx<{ id: string }[]>`
        insert into identity.sessions
          (account_id, token_hash, surface, aal, idle_expires_at, absolute_expires_at)
        values (${who.account.id}, ${digest(randomUUID())}, 'member', 'aal1',
                now() + interval '1 hour', now() + interval '1 day')
        returning id::text`;
      await confirm(tx, who, request, "old", digest(`old:${request}`));
      await confirm(tx, who, request, "new", digest(`new:${request}`));
      const outcome = await complete(tx, who, request, session);
      const [account] = await tx<
        { email: string; verified_now: boolean; email_status: string }[]
      >`
        select email, email_verified_at = now() as verified_now, email_status::text
          from identity.accounts where id = ${who.account.id}`;
      const sessions = await tx<{ id: string; reason: string | null }[]>`
        select id::text, revocation_reason::text as reason from identity.sessions
         where id in (${session}, ${other?.id ?? session})`;
      const queue = await tx<
        {
          event_type: string;
          destination: string;
          priority: number;
          payload: Record<string, unknown>;
        }[]
      >`
        select event_type, destination::text, priority, payload from leads.outbox_events
         where event_type = 'email.changed' and payload ->> 'request_id' = ${request}
         order by destination, priority, payload ->> 'recipient'`;
      const [line] = await tx<
        { subject_id: string; payload: Record<string, unknown> }[]
      >`
        select subject_id::text, payload from audit.audit_events
         where event_type = 'email.changed' and payload ->> 'request_id' = ${request}`;
      return {
        outcome,
        newEmail,
        account,
        kept: sessions.find((row) => row.id === session)?.reason,
        revoked: sessions.find((row) => row.id === other?.id)?.reason,
        queue,
        line,
        row: await requestRow(tx, request),
      };
    });
    expect(result.outcome).toBe("completed");
    expect(result.account).toEqual({
      email: result.newEmail,
      verified_now: true,
      email_status: "unknown",
    });
    expect(result.kept).toBeNull();
    expect(result.revoked).toBe("email_changed");
    expect(
      result.queue.map((row) => [
        row.destination,
        row.priority,
        row.payload.recipient ?? null,
      ]),
    ).toEqual([
      ["apollo_contact", 100, null],
      ["brevo_contact", 100, null],
      ["brevo_transactional", 0, "current"],
      ["brevo_transactional", 0, "previous"],
    ]);
    // RG74: identifiers and codes only, never an address
    for (const row of result.queue) {
      expect(JSON.stringify(row.payload)).not.toContain("@");
    }
    expect(result.line).toMatchObject({ subject_id: who.account.id });
    expect(result.line?.payload).toMatchObject({
      request_id: expect.any(String),
    });
    expect(result.row).toMatchObject({ completed: true, digests: false });
  });

  it("answers not_ready before both confirmations, and changes nothing", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const { request, session } = await openRequest(tx, who);
      await confirm(tx, who, request, "old", digest(`old:${request}`));
      return {
        outcome: await complete(tx, who, request, session),
        row: await requestRow(tx, request),
      };
    });
    expect(result.outcome).toBe("not_ready");
    expect(result.row).toMatchObject({ completed: false, cancel_reason: null });
  });

  it("closes the request as address_unavailable when another account took the address", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const [taken] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${dataSet.accounts.advertiser.b.id}`;
      const { request, session } = await openRequest(tx, who, taken?.email);
      await confirm(tx, who, request, "old", digest(`old:${request}`));
      await confirm(tx, who, request, "new", digest(`new:${request}`));
      const outcome = await complete(tx, who, request, session);
      const [account] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${who.account.id}`;
      return {
        outcome,
        changed: account?.email === taken?.email,
        row: await requestRow(tx, request),
      };
    });
    expect(result).toMatchObject({
      outcome: "address_unavailable",
      changed: false,
      row: { cancel_reason: "address_unavailable", digests: false },
    });
  });

  it("refuses a session that is not the caller's (42501)", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const foreign = await sessionOf(tx, dataSet.accounts.creator.b);
      return actAsMember(tx, who.role, who.context, () =>
        probe(tx, "select identity.complete_email_change($1::uuid, $2::uuid)", [
          request,
          foreign,
        ]),
      );
    });
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("identity.cancel_email_change()", () => {
  it("cancels the holder's open request only", async () => {
    const who = member("advertiser", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const cancel = (by: Member) =>
        actAsMember(tx, by.role, by.context, async () => {
          const [row] = await tx<{ done: boolean }[]>`
            select identity.cancel_email_change(${request}::uuid) as done`;
          return row?.done;
        });
      return {
        foreign: await cancel(member("advertiser", "b")),
        own: await cancel(who),
        again: await cancel(who),
        row: await requestRow(tx, request),
      };
    });
    expect(result).toMatchObject({
      foreign: false,
      own: true,
      again: false,
      row: { cancel_reason: "cancelled_by_holder", digests: false },
    });
  });

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(
          tx,
          "select identity.cancel_email_change(gen_random_uuid())",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

// --- 0123 (J7 commit 7) ---------------------------------------------------------------------------

describe("identity.refuse_email_change_address() (0123: GoTrue refused the new address as taken)", () => {
  it("closes the holder's fully confirmed request as address_unavailable, and nothing else", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const { request } = await openRequest(tx, who);
      const refuse = (by: Member) =>
        actAsMember(tx, by.role, by.context, async () => {
          const [row] = await tx<{ done: boolean }[]>`
            select identity.refuse_email_change_address(${request}::uuid) as done`;
          return row?.done;
        });
      const early = await refuse(who);
      await confirm(tx, who, request, "old", digest(`old:${request}`));
      await confirm(tx, who, request, "new", digest(`new:${request}`));
      const [before] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${who.account.id}`;
      const foreign = await refuse(member("creator", "b"));
      const own = await refuse(who);
      const again = await refuse(who);
      const [after] = await tx<{ email: string }[]>`
        select email from identity.accounts where id = ${who.account.id}`;
      return {
        early,
        foreign,
        own,
        again,
        unchanged: before?.email === after?.email,
        row: await requestRow(tx, request),
      };
    });
    expect(result).toMatchObject({
      early: false,
      foreign: false,
      own: true,
      again: false,
      unchanged: true,
      row: {
        completed: false,
        cancel_reason: "address_unavailable",
        digests: false,
      },
    });
  });

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(
          tx,
          "select identity.refuse_email_change_address(gen_random_uuid())",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("the journal of the two codes (0123: P1, influx_auth, never through the queue)", () => {
  it("lets influx_auth write, read back and close the P1 line of each side: the old one with its account, the new one with its address", async () => {
    const who = member("advertiser", "a");
    const result = await scenario((tx) =>
      actAs(tx, "auth", async () => {
        const insert = (
          code: string,
          accountId: string | null,
          address: string | null,
        ) =>
          probe(
            tx,
            "insert into leads.transactional_sends " +
              "(email_code, priority, account_id, recipient_email, locale) " +
              "values ($1, 'p1', $2::uuid, $3, 'fr') returning reference::text",
            [code, accountId, address],
          );
        const written = await tx<{ reference: string }[]>`
          insert into leads.transactional_sends
            (email_code, priority, account_id, recipient_email, locale)
          values ('auth.email_change_confirm_old', 'p1', ${who.account.id}::uuid, null, 'fr'),
                 ('auth.email_change_confirm_new', 'p1', null, 'changed-0123@example.test', 'fr')
          returning reference::text as reference`;
        const closed = await tx<{ status: string }[]>`
          update leads.transactional_sends
             set status = 'failed', failure_code = 'provider_unavailable'
           where reference = any (${written.map((line) => line.reference)}::uuid[])
             and status = 'queued'
          returning status::text as status`;
        return {
          written: written.length,
          closed: closed.map((line) => line.status),
          // refused: the old side without its account, the new side without its address
          oldWithoutAccount: await insert(
            "auth.email_change_confirm_old",
            null,
            "x-0123@example.test",
          ),
          newWithAccount: await insert(
            "auth.email_change_confirm_new",
            who.account.id,
            null,
          ),
          // refused: any other P1 code (the queue's), the sign-in code at P1
          welcome: await insert(
            "account.welcome_creator",
            who.account.id,
            null,
          ),
          loginCode: await insert("auth.login_code", who.account.id, null),
        };
      }),
    );
    expect(result).toEqual({
      written: 2,
      closed: ["failed", "failed"],
      oldWithoutAccount: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      newWithAccount: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      welcome: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      loginCode: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });
});

describe("identity.close_unsent_email_change() (0124: a code of the request did not leave)", () => {
  it("closes the holder's open, not fully confirmed request as not_sent, and nothing else", async () => {
    const who = member("creator", "a");
    const result = await scenario(async (tx) => {
      const close = (by: Member, request: string) =>
        actAsMember(tx, by.role, by.context, async () => {
          const [row] = await tx<{ done: boolean }[]>`
            select identity.close_unsent_email_change(${request}::uuid) as done`;
          return row?.done;
        });
      const { request } = await openRequest(tx, who);
      const foreign = await close(member("creator", "b"), request);
      await confirm(tx, who, request, "old", digest(`old:${request}`));
      const own = await close(who, request);
      const again = await close(who, request);
      const unsent = await requestRow(tx, request);
      // a request with both sides typed is never "not sent"
      const ready = await openRequest(tx, who);
      await confirm(
        tx,
        who,
        ready.request,
        "old",
        digest(`old:${ready.request}`),
      );
      await confirm(
        tx,
        who,
        ready.request,
        "new",
        digest(`new:${ready.request}`),
      );
      const confirmed = await close(who, ready.request);
      return {
        foreign,
        own,
        again,
        unsent,
        confirmed,
        readyRow: await requestRow(tx, ready.request),
      };
    });
    expect(result).toMatchObject({
      foreign: false,
      own: true,
      again: false,
      unsent: { completed: false, cancel_reason: "not_sent", digests: false },
      confirmed: false,
      readyRow: { cancel_reason: null, digests: true },
    });
  });

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(
          tx,
          "select identity.close_unsent_email_change(gen_random_uuid())",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});
