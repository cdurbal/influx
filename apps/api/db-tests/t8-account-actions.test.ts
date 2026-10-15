// T8 (J8, commit 3) — the actions of the backoffice v0 (migration 0132): the corrections of 05 RG108
// (identity.correct_member_account, identity.set_declared_status with a closed list of reasons), the
// member role change under 2V + R (identity.change_member_role, EC-J8-17), identity.correct_email()
// with R in the database (EC-J8-18), the replay of the queue (leads.replay_outbox_lines: 05 RG101 to
// RG103, CA60, CA61, EC-J8-4) and the history read of EC-31 (backoffice.read_subject_history).
//
// Each case runs in ONE rolled-back transaction of the local superuser, which writes the fixtures
// and acts as apps/api does (influx_app, then the business role with its context). The concurrency
// case of the replay commits its queue line, then deletes it (the worker files run later).
import {
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  type DataSet,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const CHECK_VIOLATION = "23514";

let dataSet: DataSet;
let adminA: string;
let adminB: string;
let agentA: string;

beforeAll(async () => {
  dataSet = await testDataSet();
  adminA = dataSet.accounts.admin.a.id;
  adminB = dataSet.accounts.admin.b.id;
  agentA = dataSet.accounts.agent.a.id;
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Record<string, unknown>[] }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as Record<string, unknown>[] };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      message: failure.message ?? "",
    };
  }
}

const FORBIDDEN = {
  outcome: "error",
  code: INSUFFICIENT_PRIVILEGE,
  message: "forbidden",
} as const;

function codeOf(result: Attempt): string {
  return result.outcome === "error" ? result.code : "rows";
}

function asInternal<T>(
  tx: postgres.TransactionSql,
  role: "agent" | "admin",
  account: string,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: account, role, aal },
    fn,
  );
}

function asCreator<T>(
  tx: postgres.TransactionSql,
  fn: () => Promise<T>,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: dataSet.accounts.creator.a.id, role: "creator", aal: "aal1" },
    fn,
  );
}

async function freshSession(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

async function ageSession(
  tx: postgres.TransactionSql,
  session: string,
  seconds: number,
): Promise<void> {
  await tx`alter table identity.sessions disable trigger sessions_guard_update`;
  await tx`
    update identity.sessions
       set created_at          = created_at          - make_interval(secs => ${seconds}),
           last_activity_at    = last_activity_at    - make_interval(secs => ${seconds}),
           idle_expires_at     = idle_expires_at     - make_interval(secs => ${seconds}),
           absolute_expires_at = absolute_expires_at - make_interval(secs => ${seconds}),
           mfa_verified_at     = mfa_verified_at     - make_interval(secs => ${seconds})
     where id = ${session}`;
  await tx`alter table identity.sessions enable trigger sessions_guard_update`;
}

/** An active member account of its own (never a data set account: the cases change it). */
async function newMember(
  tx: postgres.TransactionSql,
  role: "advertiser" | "creator" = "creator",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, country_code, preferred_language, declared_status,
       is_adult_attested, adult_attested_at)
    values (${id}, ${randomUUID()}, ${`t8-act-${id}@example.test`}, 'FR', 'fr',
            ${role === "advertiser" ? "business" : "individual"}::identity.declared_status,
            ${role === "creator"}, ${role === "creator" ? new Date() : null})`;
  await tx`insert into identity.account_roles (account_id, role)
           values (${id}, ${role}::identity.account_role)`;
  if (role === "advertiser") {
    await tx`insert into profiles.advertiser_profiles (account_id, legal_name)
             values (${id}, 'T8 Brand')`;
  }
  return id;
}

async function registerLines(
  tx: postgres.TransactionSql,
  eventType: string,
  subject: string,
): Promise<{ actor_type: string; payload: Record<string, unknown> }[]> {
  return tx<{ actor_type: string; payload: Record<string, unknown> }[]>`
    select actor_type::text as actor_type, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_id = ${subject}
     order by seq`;
}

async function leadUpdates(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string[]> {
  const rows = await tx<{ destination: string }[]>`
    select destination::text as destination from leads.outbox_events
     where subject_key = ${`account:${account}`} and event_type = 'lead.updated'
     order by destination`;
  return rows.map((row) => row.destination);
}

// ---------------------------------------------------------------------------------------------

const CORRECT =
  "select identity.correct_member_account($1::uuid, $2, $3::identity.declared_status, $4, $5, $6) as changed";

describe("identity.correct_member_account() (05 RG108, 15 RG44)", () => {
  it("lets an agent correct the country and the language: old and new value, ONE lead.updated", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const result = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, CORRECT, [
          member,
          "signup_error",
          null,
          "BE",
          "en",
          "Asked on the phone",
        ]),
      );
      const [account] = await tx<{ country: string; language: string }[]>`
        select country_code as country, preferred_language as language
          from identity.accounts where id = ${member}`;
      return {
        result,
        account,
        lines: await registerLines(tx, "account.corrected", member),
        queue: await leadUpdates(tx, member),
      };
    });
    expect(outcome.result).toEqual({
      outcome: "rows",
      rows: [{ changed: true }],
    });
    expect(outcome.account).toEqual({ country: "BE", language: "en" });
    expect(outcome.lines).toEqual([
      {
        actor_type: "agent",
        payload: {
          field: "country_code",
          from: "FR",
          to: "BE",
          reason_code: "signup_error",
          comment: "Asked on the phone",
        },
      },
      {
        actor_type: "agent",
        payload: {
          field: "preferred_language",
          from: "fr",
          to: "en",
          reason_code: "signup_error",
          comment: "Asked on the phone",
        },
      },
    ]);
    expect(outcome.queue).toEqual(["apollo_contact", "brevo_contact"]);
  });

  it("corrects the declared status through set_declared_status: still ONE lead.updated (Apollo scope)", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      await tx`update identity.accounts set declared_status = 'business' where id = ${member}`;
      const result = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, CORRECT, [
          member,
          "document_check",
          "individual",
          "DE",
          null,
          null,
        ]),
      );
      return {
        result: codeOf(result),
        status: await registerLines(
          tx,
          "account.declared_status_changed",
          member,
        ),
        corrected: (await registerLines(tx, "account.corrected", member))
          .length,
        queue: await leadUpdates(tx, member),
      };
    });
    expect(outcome.result).toBe("rows");
    expect(outcome.status).toEqual([
      {
        actor_type: "admin",
        payload: {
          from: "business",
          to: "individual",
          reason_code: "document_check",
        },
      },
    ]);
    expect(outcome.corrected).toBe(1);
    // business -> individual: the Apollo contact line lets the worker take it out of scope (RG81)
    expect(outcome.queue).toEqual(["apollo_contact", "brevo_contact"]);
  });

  it("returns false and writes nothing when nothing changes", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const result = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, CORRECT, [
          member,
          "member_request",
          "individual",
          "FR",
          "fr",
          null,
        ]),
      );
      return { result, queue: await leadUpdates(tx, member) };
    });
    expect(outcome.result).toEqual({
      outcome: "rows",
      rows: [{ changed: false }],
    });
    expect(outcome.queue).toEqual([]);
  });

  it("requires a reason of the closed list and something to correct (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      return asInternal(tx, "agent", agentA, async () => [
        codeOf(
          await attempt(tx, CORRECT, [
            member,
            "because",
            null,
            "BE",
            null,
            null,
          ]),
        ),
        codeOf(
          await attempt(tx, CORRECT, [member, null, null, "BE", null, null]),
        ),
        codeOf(
          await attempt(tx, CORRECT, [
            member,
            "member_request",
            null,
            null,
            null,
            null,
          ]),
        ),
      ]);
    });
    expect(outcome).toEqual([
      INVALID_PARAMETER,
      INVALID_PARAMETER,
      INVALID_PARAMETER,
    ]);
  });

  it("refuses a blocked country (23514) and individual for an advertiser (RG22)", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`update leads.sync_settings set value = '["AQ"]' where key = 'signup_blocked_countries'`;
      const member = await newMember(tx);
      const advertiser = await newMember(tx, "advertiser");
      return asInternal(tx, "agent", agentA, async () => [
        codeOf(
          await attempt(tx, CORRECT, [
            member,
            "member_request",
            null,
            "AQ",
            null,
            null,
          ]),
        ),
        codeOf(
          await attempt(tx, CORRECT, [
            advertiser,
            "member_request",
            "individual",
            null,
            null,
            null,
          ]),
        ),
      ]);
    });
    expect(outcome).toEqual([CHECK_VIOLATION, CHECK_VIOLATION]);
  });

  it("never acts on one's own account nor on an internal account; members and aal1 refused", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const self = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, CORRECT, [
          agentA,
          "member_request",
          null,
          "BE",
          null,
          null,
        ]),
      );
      const internal = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, CORRECT, [
          adminB,
          "member_request",
          null,
          "BE",
          null,
          null,
        ]),
      );
      const aal1 = await asInternal(
        tx,
        "agent",
        agentA,
        () =>
          attempt(tx, CORRECT, [
            member,
            "member_request",
            null,
            "BE",
            null,
            null,
          ]),
        "aal1",
      );
      const creator = await asCreator(tx, () =>
        attempt(tx, CORRECT, [
          member,
          "member_request",
          null,
          "BE",
          null,
          null,
        ]),
      );
      return { self, internal, aal1, creator: codeOf(creator) };
    });
    expect(outcome).toEqual({
      self: FORBIDDEN,
      internal: FORBIDDEN,
      aal1: FORBIDDEN,
      creator: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("refuses to an internal caller of set_declared_status a reason outside the closed list", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const SET =
        "select identity.set_declared_status($1::uuid, 'business', $2) as changed";
      return asInternal(tx, "agent", agentA, async () => [
        codeOf(await attempt(tx, SET, [member, "free_text_reason"])),
        codeOf(await attempt(tx, SET, [member, "data_quality"])),
      ]);
    });
    expect(outcome).toEqual([INVALID_PARAMETER, "rows"]);
  });
});

// ---------------------------------------------------------------------------------------------

const CHANGE_ROLE =
  "select identity.change_member_role($1::uuid, $2::uuid, $3::uuid, $4::identity.account_role, $5, $6)";

async function requestRoleChange(
  tx: postgres.TransactionSql,
  target: string,
  role = "advertiser",
  reason = "signup_error",
): Promise<Attempt> {
  return asInternal(tx, "admin", adminA, () =>
    attempt(
      tx,
      "select backoffice.request_dual_control('identity.change_member_role', jsonb_build_object('account_id', $1::uuid, 'role', $2::text), $3)::text as id",
      [target, role, reason],
    ),
  );
}

describe("identity.change_member_role() (05 RG108, 03 §3.1 J · 2V · R · C(3), EC-J8-17)", () => {
  it("turns a creator into an advertiser under a confirmed 2V and R: role, profile, status, sessions", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "creator");
      const memberSession = await tx<{ id: string }[]>`
        insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
        values (sha256(gen_random_uuid()::text::bytea), ${member}, 'member', 'firefox.linux')
        returning id::text`;
      const requested = await requestRoleChange(tx, member);
      const request = String(
        requested.outcome === "rows" ? requested.rows[0]?.id : "",
      );
      const sessionB = await freshSession(tx, adminB);
      await asInternal(tx, "admin", adminB, () =>
        attempt(
          tx,
          "select backoffice.confirm_dual_control($1::uuid, $2::uuid)",
          [sessionB, request],
        ),
      );
      const changed = await asInternal(tx, "admin", adminB, () =>
        attempt(tx, CHANGE_ROLE, [
          sessionB,
          request,
          member,
          "advertiser",
          "signup_error",
          "Acme SAS",
        ]),
      );
      const [state] = await tx<
        {
          roles: string[];
          granted_by: string;
          legal_name: string;
          status: string;
          revoked: string;
          consumed: boolean;
        }[]
      >`
        select array(select role::text from identity.account_roles where account_id = a.id) as roles,
               (select granted_by_account_id::text from identity.account_roles
                 where account_id = a.id) as granted_by,
               (select legal_name from profiles.advertiser_profiles where account_id = a.id) as legal_name,
               a.declared_status::text as status,
               (select revocation_reason::text from identity.sessions
                 where id = ${memberSession[0]?.id ?? ""}) as revoked,
               (select consumed_at is not null from backoffice.dual_control_requests
                 where id = ${request}) as consumed
          from identity.accounts a where a.id = ${member}`;
      return {
        changed: changed.outcome,
        state,
        revokedLine: await registerLines(tx, "account.role_revoked", member),
        grantedLine: await registerLines(tx, "account.role_granted", member),
        queue: await leadUpdates(tx, member),
        request,
      };
    });
    expect(outcome.changed).toBe("rows");
    expect(outcome.state).toEqual({
      roles: ["advertiser"],
      granted_by: adminB,
      legal_name: "Acme SAS",
      status: "business",
      revoked: "role_changed",
      consumed: true,
    });
    const control = {
      reason_code: "signup_error",
      dual_control_request_id: outcome.request,
      dual_control: "peer",
    };
    expect(outcome.revokedLine).toEqual([
      { actor_type: "admin", payload: { role: "creator", ...control } },
    ]);
    expect(outcome.grantedLine).toEqual([
      { actor_type: "admin", payload: { role: "advertiser", ...control } },
    ]);
    expect(outcome.queue).toEqual(["apollo_contact", "brevo_contact"]);
  });

  it("refuses advertiser -> creator at the request (D15, Q9), and a creator target for a creator role", async () => {
    const outcome = await scenario(async (tx) => {
      const advertiser = await newMember(tx, "advertiser");
      const creator = await newMember(tx, "creator");
      return [
        await requestRoleChange(tx, advertiser, "creator"),
        await requestRoleChange(tx, creator, "creator"),
        await requestRoleChange(tx, advertiser, "advertiser"),
      ];
    });
    expect(outcome).toEqual([FORBIDDEN, FORBIDDEN, FORBIDDEN]);
  });

  it("refuses without a confirmed 2V, without R, by the requester while a peer exists, and to an agent", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "creator");
      const requested = await requestRoleChange(tx, member);
      const request = String(
        requested.outcome === "rows" ? requested.rows[0]?.id : "",
      );
      const sessionB = await freshSession(tx, adminB);
      const params = (session: string) => [
        session,
        request,
        member,
        "advertiser",
        "signup_error",
        "Acme SAS",
      ];
      const unconfirmed = await asInternal(tx, "admin", adminB, () =>
        attempt(tx, CHANGE_ROLE, params(sessionB)),
      );
      await asInternal(tx, "admin", adminB, () =>
        attempt(
          tx,
          "select backoffice.confirm_dual_control($1::uuid, $2::uuid)",
          [sessionB, request],
        ),
      );
      const sessionA = await freshSession(tx, adminA);
      const byRequester = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, CHANGE_ROLE, params(sessionA)),
      );
      await ageSession(tx, sessionB, 301);
      const stale = await asInternal(tx, "admin", adminB, () =>
        attempt(tx, CHANGE_ROLE, params(sessionB)),
      );
      const freshB = await freshSession(tx, adminB);
      // the request was confirmed for signup_error: another reason does not consume it
      const wrongReason = await asInternal(tx, "admin", adminB, () =>
        attempt(tx, CHANGE_ROLE, [
          freshB,
          request,
          member,
          "advertiser",
          "member_request",
          "Acme SAS",
        ]),
      );
      const agentSession = await freshSession(tx, agentA);
      const agent = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, CHANGE_ROLE, params(agentSession)),
      );
      return {
        unconfirmed,
        byRequester,
        stale,
        wrongReason,
        agent: codeOf(agent),
        roles: await tx<{ role: string }[]>`
          select role::text as role from identity.account_roles where account_id = ${member}`,
      };
    });
    expect(outcome.unconfirmed).toEqual(FORBIDDEN);
    expect(outcome.byRequester).toEqual(FORBIDDEN);
    expect(outcome.stale).toEqual(FORBIDDEN);
    expect(outcome.wrongReason).toEqual(FORBIDDEN);
    expect(outcome.agent).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.roles).toEqual([{ role: "creator" }]);
  });
});

// ---------------------------------------------------------------------------------------------

describe("identity.correct_email(): R in the database (05 RG62, EC-J8-18)", () => {
  const CALL = "select identity.correct_email($1::uuid, $2::uuid, $3, $4)";

  it("refuses a stale second factor, a session of another admin, and a reason outside the list", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const stale = await freshSession(tx, adminA);
      await ageSession(tx, stale, 301);
      const sessionB = await freshSession(tx, adminB);
      const sessionA = await freshSession(tx, adminA);
      return asInternal(tx, "admin", adminA, async () => ({
        stale: await attempt(tx, CALL, [
          stale,
          member,
          "x@example.test",
          "identity_checked_by_phone",
        ]),
        other: await attempt(tx, CALL, [
          sessionB,
          member,
          "x@example.test",
          "identity_checked_by_phone",
        ]),
        reason: codeOf(
          await attempt(tx, CALL, [
            sessionA,
            member,
            "x@example.test",
            "member_request",
          ]),
        ),
        self: await attempt(tx, CALL, [
          sessionA,
          adminA,
          "x@example.test",
          "identity_checked_by_phone",
        ]),
        ok: codeOf(
          await attempt(tx, CALL, [
            sessionA,
            member,
            "x@example.test",
            "identity_checked_by_video",
          ]),
        ),
      }));
    });
    expect(outcome).toEqual({
      stale: FORBIDDEN,
      other: FORBIDDEN,
      reason: INVALID_PARAMETER,
      self: FORBIDDEN,
      ok: "rows",
    });
  });
});

// ---------------------------------------------------------------------------------------------

type Line = {
  destination?: string;
  status: "pending" | "processing" | "succeeded" | "skipped" | "failed";
  skipReason?: string;
};

/** One queue line of the creator A, in the given state (constraints of 0101 and 0111). */
async function queueLine(
  tx: postgres.TransactionSql,
  line: Line,
): Promise<string> {
  const event = randomUUID();
  const closed = ["succeeded", "skipped", "failed"].includes(line.status);
  const [row] = await tx<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status, attempts,
       skip_reason, last_error_code, last_error_message, locked_by, locked_at, completed_at)
    values (${event}, 'lead.updated', ${line.destination ?? "brevo_contact"}::leads.outbox_destination,
            ${`account:${dataSet.accounts.creator.a.id}`},
            jsonb_build_object('event_id', ${event}::uuid), ${`lead.updated:${event}`},
            ${line.status}::leads.outbox_status, ${line.status === "failed" ? 10 : 0},
            ${line.status === "skipped" ? (line.skipReason ?? "no_consent") : null},
            ${line.status === "failed" ? "brevo.unavailable" : null},
            ${line.status === "failed" ? "Brevo unavailable" : null},
            ${line.status === "processing" ? "t8-worker" : null},
            case when ${line.status === "processing"} then now() end,
            case when ${closed} then now() end)
    returning id::text`;
  if (row === undefined) {
    throw new Error("no line");
  }
  return row.id;
}

const REPLAY = "select * from leads.replay_outbox_lines($1::bigint[], $2)";

function replay(
  tx: postgres.TransactionSql,
  ids: readonly (string | number | null)[],
  reason = "provider_recovered",
  as: { role: "agent" | "admin"; id: string; aal?: "aal1" | "aal2" } = {
    role: "agent",
    id: agentA,
  },
): Promise<Attempt> {
  return asInternal(
    tx,
    as.role,
    as.id,
    () => attempt(tx, REPLAY, [ids as never, reason]),
    as.aal ?? "aal2",
  );
}

describe("leads.replay_outbox_lines() (05 RG101 to RG103, CA60, CA61, 15 RG30)", () => {
  it("puts the SAME failed line back in the queue: same key, no new line, a new series, journaled", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await queueLine(tx, { status: "failed" });
      const [before] = await tx<{ key: string; lines: number }[]>`
        select idempotency_key as key,
               (select count(*)::int from leads.outbox_events) as lines
          from leads.outbox_events where id = ${id}`;
      const result = await replay(tx, [id]);
      const [after] = await tx<
        {
          status: string;
          attempts: number;
          key: string;
          available_now: boolean;
          completed: boolean;
          lines: number;
        }[]
      >`
        select status::text as status, attempts, idempotency_key as key,
               available_at = now() as available_now, completed_at is not null as completed,
               (select count(*)::int from leads.outbox_events) as lines
          from leads.outbox_events where id = ${id}`;
      const rows = result.outcome === "rows" ? result.rows : [];
      const replayId = String(rows[0]?.replay_id);
      return {
        rows: rows.map((row) => ({ ...row, replay_id: undefined })),
        before,
        after,
        lines: await registerLines(tx, "leads.replay_requested", replayId),
        id,
      };
    });
    expect(outcome.rows).toEqual([
      {
        replay_id: undefined,
        outbox_id: outcome.id,
        outcome: "requeued",
        detail: null,
      },
    ]);
    expect(outcome.after).toEqual({
      status: "pending",
      attempts: 0,
      key: outcome.before?.key,
      available_now: true,
      completed: false,
      lines: outcome.before?.lines,
    });
    expect(outcome.lines).toEqual([
      {
        actor_type: "agent",
        payload: {
          reason_code: "provider_recovered",
          requested: 1,
          requeued: 1,
          requeued_ids: [Number(outcome.id)],
          ignored: {},
          refused: {},
        },
      },
    ]);
  });

  it("reports each line of a batch: requeued, ignored and refused (no consent never replayed)", async () => {
    const outcome = await scenario(async (tx) => {
      const failed = await queueLine(tx, { status: "failed" });
      const noConsent = await queueLine(tx, {
        status: "skipped",
        skipReason: "no_consent",
      });
      const outOfScope = await queueLine(tx, {
        destination: "apollo_contact",
        status: "skipped",
        skipReason: "out_of_apollo_scope_individual",
      });
      const succeeded = await queueLine(tx, { status: "succeeded" });
      const pending = await queueLine(tx, { status: "pending" });
      const transactional = await queueLine(tx, {
        destination: "brevo_transactional",
        status: "failed",
      });
      const ids = [
        failed,
        noConsent,
        outOfScope,
        succeeded,
        pending,
        transactional,
        failed,
      ];
      const result = await replay(
        tx,
        [...ids, "9000000000000"],
        "configuration_fixed",
        {
          role: "admin",
          id: adminA,
        },
      );
      const rows = result.outcome === "rows" ? result.rows : [];
      const [consent] = await tx<{ status: string }[]>`
        select status::text as status from leads.outbox_events where id = ${noConsent}`;
      const [mail] = await tx<{ status: string }[]>`
        select status::text as status from leads.outbox_events where id = ${transactional}`;
      return {
        outcomes: Object.fromEntries(
          rows.map((row) => [
            String(row.outbox_id),
            `${String(row.outcome)}:${String(row.detail)}`,
          ]),
        ),
        count: rows.length,
        lines: await registerLines(
          tx,
          "leads.replay_requested",
          String(rows[0]?.replay_id),
        ),
        consent,
        mail,
        ids: {
          failed,
          noConsent,
          outOfScope,
          succeeded,
          pending,
          transactional,
        },
      };
    });
    const { ids } = outcome;
    expect(outcome.count).toBe(7);
    expect(outcome.outcomes).toEqual({
      [ids.failed]: "requeued:null",
      [ids.noConsent]: "refused:no_consent",
      [ids.outOfScope]: "refused:normal_case",
      [ids.succeeded]: "ignored:already_succeeded",
      [ids.pending]: "ignored:already_queued",
      [ids.transactional]: "refused:not_a_contact_line",
      "9000000000000": "refused:unknown_line",
    });
    expect(outcome.consent).toEqual({ status: "skipped" });
    expect(outcome.mail).toEqual({ status: "failed" });
    expect(outcome.lines[0]?.payload).toEqual({
      reason_code: "configuration_fixed",
      requested: 7,
      requeued: 1,
      requeued_ids: [Number(ids.failed)],
      ignored: { already_succeeded: 1, already_queued: 1 },
      refused: {
        no_consent: 1,
        normal_case: 1,
        not_a_contact_line: 1,
        unknown_line: 1,
      },
    });
  });

  it("accepts 200 lines and refuses 201, none, a null and a reason outside the list (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const many = (count: number) =>
        Array.from({ length: count }, (_, index) =>
          String(8_000_000_000_000 + index),
        );
      const ok = await replay(tx, many(200));
      return {
        ok: ok.outcome === "rows" ? ok.rows.length : codeOf(ok),
        over: codeOf(await replay(tx, many(201))),
        none: codeOf(await replay(tx, [])),
        nullLine: codeOf(await replay(tx, ["8000000000000", null])),
        reason: codeOf(await replay(tx, ["8000000000000"], "because")),
      };
    });
    expect(outcome).toEqual({
      ok: 200,
      over: INVALID_PARAMETER,
      none: INVALID_PARAMETER,
      nullLine: INVALID_PARAMETER,
      reason: INVALID_PARAMETER,
    });
  });

  it("refuses a member by privilege and an agent in aal1; nobody writes a failed line otherwise", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await queueLine(tx, { status: "failed" });
      const creator = codeOf(
        await asCreator(tx, () =>
          attempt(tx, REPLAY, [[id] as never, "provider_recovered"]),
        ),
      );
      const aal1 = await replay(tx, [id], "provider_recovered", {
        role: "agent",
        id: agentA,
        aal: "aal1",
      });
      // the guard of 0132: a failed line leaves failed only as a replay, whoever writes
      const direct = codeOf(
        await attempt(
          tx,
          "update leads.outbox_events set status = 'succeeded' where id = $1",
          [id],
        ),
      );
      return { creator, aal1, direct };
    });
    expect(outcome).toEqual({
      creator: INSUFFICIENT_PRIVILEGE,
      aal1: FORBIDDEN,
      direct: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("gives one winner to two concurrent replays of the same line (CA61, committed fixture)", async () => {
    const pool = connectAsLocalSuperuser({ max: 2 });
    let id = "";
    try {
      id = await pool.begin((tx) => queueLine(tx, { status: "failed" }));
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstDone: (value: Attempt) => void = () => undefined;
      const firstResult = new Promise<Attempt>((resolve) => {
        firstDone = resolve;
      });
      const first = pool.begin(async (tx) => {
        firstDone(await replay(tx, [id]));
        await hold;
      });
      expect(await firstResult).toMatchObject({
        outcome: "rows",
        rows: [{ outcome: "requeued" }],
      });
      const second = inRolledBackTransaction(pool, (tx) => replay(tx, [id]));
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await first;
      expect(await second).toMatchObject({
        outcome: "rows",
        rows: [{ outcome: "ignored", detail: "already_queued" }],
      });
    } finally {
      if (id !== "") {
        // the worker files must not find this line pending
        await pool`delete from leads.outbox_events where id = ${id}`;
      }
      await pool.end({ timeout: 1 });
    }
  });
});

// ---------------------------------------------------------------------------------------------

const HISTORY =
  "select * from backoffice.read_subject_history($1, $2::uuid, $3, $4)";

describe("backoffice.read_subject_history() (EC-31, 03 C(38))", () => {
  async function history(
    tx: postgres.TransactionSql,
    as: { role: "agent" | "admin"; id: string },
    subject: [string, string],
    limit: number | null = 50,
    before: number | null = null,
  ): Promise<Attempt> {
    return asInternal(tx, as.role, as.id, () =>
      attempt(tx, HISTORY, [subject[0], subject[1], limit, before]),
    );
  }

  it("lets an admin read one object, newest first, and journals the consultation", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const other = await newMember(tx);
      await tx`select audit.append('lead.updated', 'account', ${member}, '{"n": 1}')`;
      await tx`select audit.append('lead.updated', 'account', ${other}, '{"n": 9}')`;
      await tx`select audit.append('lead.created', 'account', ${member}, '{"n": 2}')`;
      const result = await history(tx, { role: "admin", id: adminA }, [
        "account",
        member,
      ]);
      return {
        rows:
          result.outcome === "rows"
            ? result.rows.map((row) => ({
                event: row.event_type,
                payload: row.payload,
              }))
            : codeOf(result),
        read: await registerLines(tx, "history.account_read", member),
      };
    });
    // written by the superuser here: audit.append() adds db_session_user (0009)
    expect(outcome.rows).toMatchObject([
      { event: "lead.created", payload: { n: 2 } },
      { event: "lead.updated", payload: { n: 1 } },
    ]);
    expect(Array.isArray(outcome.rows) ? outcome.rows.length : 0).toBe(2);
    expect(outcome.read).toEqual([
      { actor_type: "admin", payload: { limit: 50, before_seq: null } },
    ]);
  });

  it("pages with a limit and a sequence bound", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      for (const n of [1, 2, 3]) {
        await tx`select audit.append('lead.updated', 'account', ${member}, jsonb_build_object('n', ${n}::int))`;
      }
      const first = await history(
        tx,
        { role: "admin", id: adminA },
        ["account", member],
        2,
      );
      const rows = first.outcome === "rows" ? first.rows : [];
      const next = await history(
        tx,
        { role: "admin", id: adminA },
        ["account", member],
        2,
        Number(rows[1]?.seq),
      );
      return [rows, next.outcome === "rows" ? next.rows : []].map((page) =>
        page.map((row) => (row.payload as { n: number }).n),
      );
    });
    expect(outcome).toEqual([[3, 2], [1]]);
  });

  it("gives an agent the member accounts without previous_email; never the internal objects", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      await tx`
        select audit.append('account.email_corrected', 'account', ${member},
                            '{"previous_email": "old@example.test", "reason_code": "identity_checked_by_phone"}')`;
      const agent = await history(tx, { role: "agent", id: agentA }, [
        "account",
        member,
      ]);
      const admin = await history(tx, { role: "admin", id: adminA }, [
        "account",
        member,
      ]);
      // the admin's page also holds the agent's consultation line, newest first
      const corrected = (result: Attempt) =>
        result.outcome === "rows"
          ? result.rows.find(
              (row) => row.event_type === "account.email_corrected",
            )?.payload
          : codeOf(result);
      return {
        agent: corrected(agent),
        admin: corrected(admin),
        adminSeesTheRead:
          admin.outcome === "rows" ? admin.rows[0]?.event_type : codeOf(admin),
        internalAccount: await history(tx, { role: "agent", id: agentA }, [
          "account",
          adminB,
        ]),
        internalInvitation: await history(tx, { role: "agent", id: agentA }, [
          "internal_invitation",
          randomUUID(),
        ]),
        dualControl: await history(tx, { role: "agent", id: agentA }, [
          "dual_control_request",
          randomUUID(),
        ]),
        memberInvitation: codeOf(
          await history(tx, { role: "agent", id: agentA }, [
            "member_invitation",
            randomUUID(),
          ]),
        ),
      };
    });
    expect(outcome.agent).toMatchObject({
      reason_code: "identity_checked_by_phone",
    });
    expect(outcome.agent).not.toHaveProperty("previous_email");
    expect(outcome.admin).toMatchObject({
      previous_email: "old@example.test",
      reason_code: "identity_checked_by_phone",
    });
    expect(outcome.adminSeesTheRead).toBe("history.account_read");
    expect(outcome.internalAccount).toEqual(FORBIDDEN);
    expect(outcome.internalInvitation).toEqual(FORBIDDEN);
    expect(outcome.dualControl).toEqual(FORBIDDEN);
    expect(outcome.memberInvitation).toBe("rows");
  });

  it("refuses an unknown subject type and a limit outside 1 to 200 (22023), members and aal1", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const admin = { role: "admin", id: adminA } as const;
      return {
        type: codeOf(await history(tx, admin, ["conversation", member])),
        zero: codeOf(await history(tx, admin, ["account", member], 0)),
        over: codeOf(await history(tx, admin, ["account", member], 201)),
        creator: codeOf(
          await asCreator(tx, () =>
            attempt(tx, HISTORY, ["account", member, 50, null]),
          ),
        ),
        aal1: await asInternal(
          tx,
          "admin",
          adminA,
          () => attempt(tx, HISTORY, ["account", member, 50, null]),
          "aal1",
        ),
      };
    });
    expect(outcome).toEqual({
      type: INVALID_PARAMETER,
      zero: INVALID_PARAMETER,
      over: INVALID_PARAMETER,
      creator: INSUFFICIENT_PRIVILEGE,
      aal1: FORBIDDEN,
    });
  });
});
