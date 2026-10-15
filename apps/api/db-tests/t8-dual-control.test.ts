// T8 (J8, commit 2) — the dual control (2V) and the fresh re-authentication (R) enforced by the
// database (migration 0130; 03 §1.3 PD1 to PD7, §3.1 "attribuer un rôle" J · 2V · R · C(3);
// 15 RG9, RG31; 17b §3.13.c): the constraints of backoffice.dual_control_requests, the three
// functions request / confirm / cancel, and identity.grant_role() rewritten.
//
// Each case runs in ONE rolled-back transaction of the local superuser, which writes the fixtures
// (fresh backoffice sessions, targets, aged requests) and acts as the admins exactly as apps/api
// takes the role (influx_app, then influx_admin with the context; actAsInternal).
import { inRolledBackTransaction, type DataSet } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { REAUTHENTICATION_FRESHNESS_SECONDS } from "../src/domains/identity/settings.ts";
import { actAsInternal, localSuperuser, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
/** The SQL literal of 0130 identity.assert_fresh_second_factor() and the constant of apps/api. */
const FRESHNESS = REAUTHENTICATION_FRESHNESS_SECONDS;
const JUSTIFICATION =
  "Single administrator during the launch phase, action reviewed alone.";

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
  | { outcome: "error"; code: string; message: string; constraint?: string };

/** One statement in a savepoint: its rows, or the SQLSTATE, message and constraint. */
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
    const failure = error as {
      code?: string;
      message?: string;
      constraint_name?: string;
    };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      message: failure.message ?? "",
      ...(failure.constraint_name === undefined
        ? {}
        : { constraint: failure.constraint_name }),
    };
  }
}

/** The refusal of every 2V function and of grant_role(): one code, one message (no oracle). */
const FORBIDDEN = {
  outcome: "error",
  code: INSUFFICIENT_PRIVILEGE,
  message: "forbidden",
} as const;

function asAdmin<T>(
  tx: postgres.TransactionSql,
  account: string,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal },
    fn,
  );
}

/** A fresh backoffice session of an internal account: TOTP proven now (0012 trigger). */
async function freshSession(
  tx: postgres.TransactionSql,
  account: string,
  method: "totp" | "recovery_code" = "totp",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice',
            ${method}::identity.mfa_method, 'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

/** Ages a whole session, its second-factor proof included (the guard refuses it: disabled here). */
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

/** An active account without any role: the target of a grant. */
async function newTarget(tx: postgres.TransactionSql): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, country_code, preferred_language, declared_status)
    values (${id}, ${randomUUID()}, ${`t8-2v-${id}@example.test`}, 'FR', 'en', 'individual')`;
  return id;
}

/** PD7: deactivates every admin but `account` (the degraded mode of a single operator). */
async function onlyAdmin(
  tx: postgres.TransactionSql,
  account: string,
): Promise<void> {
  await tx`
    update identity.agent_profiles p
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${account}
     where p.account_id <> ${account}
       and p.is_active
       and exists (select 1 from identity.account_roles r
                    where r.account_id = p.account_id and r.role = 'admin')`;
}

/** Moves a request back in time (the guard refuses it: disabled here). */
async function ageRequest(
  tx: postgres.TransactionSql,
  request: string,
  seconds: number,
): Promise<void> {
  await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
  await tx`
    update backoffice.dual_control_requests
       set requested_at = requested_at - make_interval(secs => ${seconds}),
           expires_at   = expires_at   - make_interval(secs => ${seconds}),
           created_at   = created_at   - make_interval(secs => ${seconds})
     where id = ${request}`;
  await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
}

function requestGrant(
  tx: postgres.TransactionSql,
  requester: string,
  target: string,
  role = "advertiser",
  reason = "test_j8",
): Promise<string> {
  return asAdmin(tx, requester, async () => {
    const [row] = await tx<{ id: string }[]>`
      select backoffice.request_dual_control('identity.grant_role',
               jsonb_build_object('account_id', ${target}::uuid, 'role', ${role}::text),
               ${reason})::text as id`;
    if (row === undefined) {
      throw new Error("no request");
    }
    return row.id;
  });
}

function confirm(
  tx: postgres.TransactionSql,
  confirmer: string,
  session: string,
  request: string,
  justification: string | null = null,
): Promise<Attempt> {
  return asAdmin(tx, confirmer, () =>
    attempt(
      tx,
      "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode",
      [session, request, justification],
    ),
  );
}

function cancel(
  tx: postgres.TransactionSql,
  admin: string,
  request: string,
): Promise<Attempt> {
  return asAdmin(tx, admin, () =>
    attempt(tx, "select backoffice.cancel_dual_control($1::uuid)", [request]),
  );
}

function grant(
  tx: postgres.TransactionSql,
  admin: string,
  call: {
    session: string;
    request: string;
    target: string;
    role?: string;
    reason?: string;
  },
  aal: "aal1" | "aal2" = "aal2",
): Promise<Attempt> {
  return asAdmin(
    tx,
    admin,
    () =>
      attempt(
        tx,
        "select identity.grant_role($1::uuid, $2::uuid, $3::uuid, $4::identity.account_role, $5)",
        [
          call.session,
          call.request,
          call.target,
          call.role ?? "advertiser",
          call.reason ?? "test_j8",
        ],
      ),
    aal,
  );
}

async function requestRow(tx: postgres.TransactionSql, request: string) {
  const [row] = await tx<
    {
      state: string;
      consumed: boolean;
      consumed_now: boolean;
      confirmed_by: string | null;
      confirmed_now: boolean;
      degraded_now: boolean;
      justification: string | null;
    }[]
  >`
    select state::text as state, consumed_at is not null as consumed,
           consumed_at = now() as consumed_now,
           confirmed_by_account_id::text as confirmed_by, confirmed_at = now() as confirmed_now,
           degraded_confirmed_at = now() as degraded_now,
           degraded_justification as justification
      from backoffice.dual_control_requests where id = ${request}`;
  return row;
}

async function registerLines(
  tx: postgres.TransactionSql,
  eventType: string,
  subject: string,
): Promise<{ actor: string | null; payload: Record<string, unknown> }[]> {
  return tx<{ actor: string | null; payload: Record<string, unknown> }[]>`
    select actor_account_id::text as actor, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_id = ${subject}
     order by seq`;
}

async function rolesOf(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string[]> {
  const rows = await tx<{ role: string }[]>`
    select role::text as role from identity.account_roles where account_id = ${account}`;
  return rows.map((row) => row.role);
}

// ---------------------------------------------------------------------------------------------

describe("backoffice.dual_control_requests: the constraints of 04 §5.10 and of 0130", () => {
  /** A pending request of admin A, written by the migration role's rights (the superuser). */
  async function pendingRow(tx: postgres.TransactionSql): Promise<string> {
    const [row] = await tx<{ id: string }[]>`
      insert into backoffice.dual_control_requests
        (action_code, payload, reason_code, requested_by_account_id)
      values ('identity.grant_role',
              jsonb_build_object('account_id', gen_random_uuid(), 'role', 'advertiser'),
              'test_j8', ${adminA})
      returning id::text`;
    if (row === undefined) {
      throw new Error("no row");
    }
    return row.id;
  }

  it("computes the request instant and the expiry from the queue delay (24 h, 15 RG31)", async () => {
    const row = await scenario(async (tx) => {
      const [inserted] = await tx<
        { now: boolean; delay: number; state: string }[]
      >`
        insert into backoffice.dual_control_requests
          (action_code, payload, reason_code, requested_by_account_id, requested_at, expires_at,
           state, consumed_at)
        values ('identity.grant_role', '{"account_id": "x", "role": "admin"}', 'test_j8', ${adminA},
                now() - interval '3 days', now() + interval '9 days', 'confirmed', now())
        returning requested_at = now() as now,
                  extract(epoch from expires_at - requested_at)::int as delay,
                  state::text as state`;
      return inserted;
    });
    expect(row).toEqual({ now: true, delay: 24 * 3600, state: "pending" });
  });

  it("refuses an expiry that is not after the request (dual_control_expiry_after_request)", async () => {
    const result = await scenario(async (tx) => {
      await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_prepare`;
      return attempt(
        tx,
        `insert into backoffice.dual_control_requests
           (action_code, payload, reason_code, requested_by_account_id, requested_at, expires_at)
         values ('identity.grant_role', '{}', 'test_j8', $1, now(), now())`,
        [adminA],
      );
    });
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_expiry_after_request",
    });
  });

  it("refuses an action outside the closed list (dual_control_action_code_closed)", async () => {
    const result = await scenario((tx) =>
      attempt(
        tx,
        `insert into backoffice.dual_control_requests
           (action_code, payload, reason_code, requested_by_account_id)
         values ('identity.revoke_role', '{}', 'test_j8', $1)`,
        [adminA],
      ),
    );
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_action_code_closed",
    });
  });

  it("never lets the requester be his own second validation (dual_control_second_pair_of_eyes)", async () => {
    const result = await scenario(async (tx) => {
      const request = await pendingRow(tx);
      return attempt(
        tx,
        `update backoffice.dual_control_requests
            set state = 'confirmed', confirmed_by_account_id = $1 where id = $2`,
        [adminA, request],
      );
    });
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_second_pair_of_eyes",
    });
  });

  it("refuses a confirmed request without its confirmer (dual_control_confirmed_is_complete)", async () => {
    const result = await scenario(async (tx) => {
      const request = await pendingRow(tx);
      return attempt(
        tx,
        "update backoffice.dual_control_requests set state = 'confirmed' where id = $1",
        [request],
      );
    });
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_confirmed_is_complete",
    });
  });

  it("refuses a degraded confirmation without 20 characters of justification", async () => {
    const result = await scenario(async (tx) => {
      const request = await pendingRow(tx);
      await ageRequest(tx, request, 120);
      return attempt(
        tx,
        `update backoffice.dual_control_requests
            set state = 'degraded', degraded_justification = $1 where id = $2`,
        ["Nineteen characters", request],
      );
    });
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_degraded_needs_justification",
    });
  });

  it("refuses a degraded confirmation within 60 seconds of the request (PD2)", async () => {
    const result = await scenario(async (tx) => {
      const request = await pendingRow(tx);
      await ageRequest(tx, request, 59);
      return attempt(
        tx,
        `update backoffice.dual_control_requests
            set state = 'degraded', degraded_justification = $1 where id = $2`,
        [JUSTIFICATION, request],
      );
    });
    expect(result).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "dual_control_degraded_delay",
    });
  });

  it("freezes the request itself, a cancelled request, and never deletes one", async () => {
    const results = await scenario(async (tx) => {
      const request = await pendingRow(tx);
      const payload = await attempt(
        tx,
        `update backoffice.dual_control_requests set payload = '{"account_id": "x"}' where id = $1`,
        [request],
      );
      await tx`
        update backoffice.dual_control_requests
           set state = 'cancelled', cancelled_by_account_id = ${adminA} where id = ${request}`;
      const reopened = await attempt(
        tx,
        `update backoffice.dual_control_requests
            set state = 'confirmed', confirmed_by_account_id = $1 where id = $2`,
        [adminB, request],
      );
      const deleted = await attempt(
        tx,
        "delete from backoffice.dual_control_requests where id = $1",
        [request],
      );
      return [payload, reopened, deleted].map((result) =>
        result.outcome === "error" ? result.code : "accepted",
      );
    });
    expect(results).toEqual([
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
    ]);
  });
});

describe("backoffice.request_dual_control() (03 PD4, influx_admin only)", () => {
  it("writes a pending request with a canonical payload and the register line, never the note", async () => {
    const outcome = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await asAdmin(tx, adminA, async () => {
        // keys in another order and an upper-case id: the stored payload is canonical
        const payload = JSON.stringify({
          role: "agent",
          account_id: target.toUpperCase(),
        });
        const [row] = await tx<{ id: string }[]>`
          select backoffice.request_dual_control('identity.grant_role', ${payload}::text::jsonb,
                   'promotion', 'Call with the founder on Monday')::text as id`;
        return row?.id ?? "";
      });
      const [row] = await tx`
        select state::text as state, payload, reason_code, reason_note,
               requested_by_account_id::text as requested_by, requested_at = now() as now,
               extract(epoch from expires_at - requested_at)::int as delay
          from backoffice.dual_control_requests where id = ${request}`;
      return {
        target,
        row,
        lines: await registerLines(tx, "dual_control.requested", request),
      };
    });
    expect(outcome.row).toEqual({
      state: "pending",
      payload: { account_id: outcome.target, role: "agent" },
      reason_code: "promotion",
      reason_note: "Call with the founder on Monday",
      requested_by: adminA,
      now: true,
      delay: 24 * 3600,
    });
    expect(outcome.lines).toEqual([
      {
        actor: adminA,
        payload: {
          action_code: "identity.grant_role",
          reason_code: "promotion",
          action_payload: { account_id: outcome.target, role: "agent" },
        },
      },
    ]);
  });

  it.each([
    [
      "on the requester's own account (C(3))",
      "self",
      "advertiser",
      "promotion",
      "identity.grant_role",
    ],
    [
      "on an unknown account",
      "unknown",
      "advertiser",
      "promotion",
      "identity.grant_role",
    ],
    [
      "for an action outside the closed list",
      "target",
      "advertiser",
      "promotion",
      "identity.revoke_role",
    ],
    [
      "for an unknown role",
      "target",
      "superuser",
      "promotion",
      "identity.grant_role",
    ],
    [
      "with a reason that is not a typed code",
      "target",
      "advertiser",
      "Promotion!",
      "identity.grant_role",
    ],
  ])(
    "refuses a request %s (42501 forbidden)",
    async (_label, who, role, reason, action) => {
      const result = await scenario(async (tx) => {
        const target =
          who === "self"
            ? adminA
            : who === "unknown"
              ? randomUUID()
              : await newTarget(tx);
        return asAdmin(tx, adminA, () =>
          attempt(
            tx,
            `select backoffice.request_dual_control($1,
                    jsonb_build_object('account_id', $2::uuid, 'role', $3::text), $4)`,
            [action, target, role, reason],
          ),
        );
      });
      expect(result).toEqual(FORBIDDEN);
    },
  );

  it("refuses a payload with another member (42501 forbidden)", async () => {
    const result = await scenario(async (tx) => {
      const target = await newTarget(tx);
      return asAdmin(tx, adminA, () =>
        attempt(
          tx,
          `select backoffice.request_dual_control('identity.grant_role',
                    jsonb_build_object('account_id', $1::uuid, 'role', 'admin', 'note', 'x'),
                    'promotion')`,
          [target],
        ),
      );
    });
    expect(result).toEqual(FORBIDDEN);
  });

  it("refuses an admin in aal1, and an agent by privilege", async () => {
    const results = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const statement = `select backoffice.request_dual_control('identity.grant_role',
                           jsonb_build_object('account_id', $1::uuid, 'role', 'admin'), 'promotion')`;
      return [
        await asAdmin(
          tx,
          adminA,
          () => attempt(tx, statement, [target]),
          "aal1",
        ),
        await actAsInternal(
          tx,
          "influx_agent",
          { accountId: agentA, role: "agent", aal: "aal2" },
          () => attempt(tx, statement, [target]),
        ),
      ];
    });
    expect(results[0]).toEqual(FORBIDDEN);
    expect(results[1]).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("backoffice.confirm_dual_control() (03 PD1 to PD7, 17b §3.13.c)", () => {
  it("records the confirmation of a peer admin (state confirmed, dual_control.confirmed)", async () => {
    const outcome = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      const session = await freshSession(tx, adminB);
      const result = await confirm(tx, adminB, session, request);
      return {
        result,
        row: await requestRow(tx, request),
        lines: await registerLines(tx, "dual_control.confirmed", request),
      };
    });
    expect(outcome.result).toEqual({
      outcome: "rows",
      rows: [{ mode: "peer" }],
    });
    expect(outcome.row).toMatchObject({
      state: "confirmed",
      confirmed_by: adminB,
      confirmed_now: true,
      consumed: false,
    });
    expect(outcome.lines).toEqual([
      {
        actor: adminB,
        payload: { action_code: "identity.grant_role", dual_control: "peer" },
      },
    ]);
  });

  it("refuses the requester while another active admin exists, even after 60 s with a justification (PD7)", async () => {
    const result = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      await ageRequest(tx, request, 120);
      const session = await freshSession(tx, adminA);
      return confirm(tx, adminA, session, request, JUSTIFICATION);
    });
    expect(result).toEqual(FORBIDDEN);
  });

  it.each([
    ["one second too old", "stale"],
    ["proven by a recovery code", "recovery"],
    ["of another admin", "foreign"],
    ["revoked", "revoked"],
  ])(
    "refuses a confirmation whose second factor is %s (R, PD3)",
    async (_label, kind) => {
      const result = await scenario(async (tx) => {
        const target = await newTarget(tx);
        const request = await requestGrant(tx, adminA, target);
        const session =
          kind === "recovery"
            ? await freshSession(tx, adminB, "recovery_code")
            : await freshSession(tx, kind === "foreign" ? adminA : adminB);
        if (kind === "stale") {
          await ageSession(tx, session, FRESHNESS + 1);
        }
        if (kind === "revoked") {
          await tx`update identity.sessions set revoked_at = now(), revocation_reason = 'logout'
                  where id = ${session}`;
        }
        return confirm(tx, adminB, session, request);
      });
      expect(result).toEqual(FORBIDDEN);
    },
  );

  it("refuses an expired, a cancelled and an already confirmed request", async () => {
    const results = await scenario(async (tx) => {
      const session = await freshSession(tx, adminB);
      const expired = await requestGrant(tx, adminA, await newTarget(tx));
      await ageRequest(tx, expired, 24 * 3600);
      const cancelled = await requestGrant(tx, adminA, await newTarget(tx));
      await cancel(tx, adminA, cancelled);
      const confirmed = await requestGrant(tx, adminA, await newTarget(tx));
      await confirm(tx, adminB, session, confirmed);
      return [
        await confirm(tx, adminB, session, expired),
        await confirm(tx, adminB, session, cancelled),
        await confirm(tx, adminB, session, confirmed),
      ];
    });
    expect(results).toEqual([FORBIDDEN, FORBIDDEN, FORBIDDEN]);
  });

  it("refuses a peer who is the target of the action (C(3))", async () => {
    const result = await scenario(async (tx) => {
      // a request whose payload names admin B (written around the guard): B may not decide it
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      await tx`
        alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
      await tx`
        update backoffice.dual_control_requests
           set payload = jsonb_build_object('account_id', ${adminB}::uuid, 'role', 'advertiser')
         where id = ${request}`;
      await tx`
        alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
      return confirm(tx, adminB, await freshSession(tx, adminB), request);
    });
    expect(result).toEqual(FORBIDDEN);
  });

  it("refuses the break-glass account as a peer (15 RG103)", async () => {
    const result = await scenario(async (tx) => {
      await tx`update identity.agent_profiles set is_break_glass = true
                where account_id = ${adminB}`;
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      return confirm(tx, adminB, await freshSession(tx, adminB), request);
    });
    expect(result).toEqual(FORBIDDEN);
  });

  describe("the degraded mode of a single operator (PD1 to PD7)", () => {
    it("lets the requester confirm alone at 60 s, with a fresh factor and a justification (PD5)", async () => {
      const outcome = await scenario(async (tx) => {
        await onlyAdmin(tx, adminA);
        const target = await newTarget(tx);
        const request = await requestGrant(tx, adminA, target);
        await ageRequest(tx, request, 60);
        const session = await freshSession(tx, adminA);
        const result = await confirm(
          tx,
          adminA,
          session,
          request,
          `  ${JUSTIFICATION}  `,
        );
        return {
          result,
          row: await requestRow(tx, request),
          lines: await registerLines(
            tx,
            "dual_control.confirmed_degraded",
            request,
          ),
        };
      });
      expect(outcome.result).toEqual({
        outcome: "rows",
        rows: [{ mode: "degraded_single_operator" }],
      });
      expect(outcome.row).toMatchObject({
        state: "degraded",
        confirmed_by: null,
        degraded_now: true,
        justification: JUSTIFICATION,
      });
      expect(outcome.lines).toEqual([
        {
          actor: adminA,
          payload: {
            action_code: "identity.grant_role",
            dual_control: "degraded_single_operator",
          },
        },
      ]);
    });

    it.each([
      ["59 seconds after the request (PD2)", 59, JUSTIFICATION],
      ["without a justification", 120, null],
      ["with a justification of 19 characters", 120, "Nineteen characters"],
    ])("refuses the requester %s", async (_label, age, justification) => {
      const result = await scenario(async (tx) => {
        await onlyAdmin(tx, adminA);
        const target = await newTarget(tx);
        const request = await requestGrant(tx, adminA, target);
        await ageRequest(tx, request, age);
        return confirm(
          tx,
          adminA,
          await freshSession(tx, adminA),
          request,
          justification,
        );
      });
      expect(result).toEqual(FORBIDDEN);
    });

    it("counts neither the break-glass account nor an admin without a pinned factor as a peer", async () => {
      const result = await scenario(async (tx) => {
        await onlyAdmin(tx, adminA);
        // admin B comes back as the break-glass account; a third admin has no pinned factor
        await tx`
          update identity.agent_profiles
             set is_active = true, deactivated_at = null, deactivated_by_account_id = null,
                 is_break_glass = true
           where account_id = ${adminB}`;
        await tx`
          update identity.agent_profiles
             set is_active = true, deactivated_at = null, deactivated_by_account_id = null,
                 mfa_factor_id = null
           where account_id <> ${adminA} and account_id <> ${adminB}
             and account_id in (select account_id from identity.account_roles where role = 'admin')`;
        const target = await newTarget(tx);
        const request = await requestGrant(tx, adminA, target);
        await ageRequest(tx, request, 61);
        return confirm(
          tx,
          adminA,
          await freshSession(tx, adminA),
          request,
          JUSTIFICATION,
        );
      });
      expect(result).toEqual({
        outcome: "rows",
        rows: [{ mode: "degraded_single_operator" }],
      });
    });
  });
});

describe("backoffice.cancel_dual_control() (17b §3.13.c)", () => {
  it("lets the requester abandon and a peer refuse; nothing can be confirmed nor executed after", async () => {
    const outcome = await scenario(async (tx) => {
      const abandonedTarget = await newTarget(tx);
      const abandoned = await requestGrant(tx, adminA, abandonedTarget);
      const refused = await requestGrant(tx, adminA, await newTarget(tx));
      const results = [
        await cancel(tx, adminA, abandoned),
        await cancel(tx, adminB, refused),
      ];
      const session = await freshSession(tx, adminB);
      return {
        results,
        states: [
          (await requestRow(tx, abandoned))?.state,
          (await requestRow(tx, refused))?.state,
        ],
        lines: [
          ...(await registerLines(tx, "dual_control.cancelled", abandoned)),
          ...(await registerLines(tx, "dual_control.cancelled", refused)),
        ],
        afterwards: [
          await confirm(tx, adminB, session, abandoned),
          await grant(tx, adminB, {
            session,
            request: abandoned,
            target: abandonedTarget,
          }),
          await cancel(tx, adminA, abandoned),
        ],
      };
    });
    expect(outcome.results.map((result) => result.outcome)).toEqual([
      "rows",
      "rows",
    ]);
    expect(outcome.states).toEqual(["cancelled", "cancelled"]);
    expect(outcome.lines).toEqual([
      {
        actor: adminA,
        payload: { action_code: "identity.grant_role", by: "requester" },
      },
      {
        actor: adminB,
        payload: { action_code: "identity.grant_role", by: "peer" },
      },
    ]);
    expect(outcome.afterwards).toEqual([FORBIDDEN, FORBIDDEN, FORBIDDEN]);
  });
});

describe("identity.grant_role(): 2V and R enforced in the database (03 §3.1, 0130)", () => {
  it("grants in the nominal mode: one register line, the request consumed (peer)", async () => {
    const outcome = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await requestGrant(
        tx,
        adminA,
        target,
        "agent",
        "new_hire",
      );
      const session = await freshSession(tx, adminB);
      await confirm(tx, adminB, session, request);
      const result = await grant(tx, adminB, {
        session,
        request,
        target,
        role: "agent",
        reason: "new_hire",
      });
      const [granted] = await tx<{ by: string }[]>`
        select granted_by_account_id::text as by from identity.account_roles
         where account_id = ${target}`;
      return {
        result,
        roles: await rolesOf(tx, target),
        grantedBy: granted?.by,
        lines: await registerLines(tx, "account.role_granted", target),
        row: await requestRow(tx, request),
        request,
      };
    });
    expect(outcome.result.outcome).toBe("rows");
    expect(outcome.roles).toEqual(["agent"]);
    expect(outcome.grantedBy).toBe(adminB);
    expect(outcome.lines).toEqual([
      {
        actor: adminB,
        payload: {
          role: "agent",
          reason_code: "new_hire",
          dual_control_request_id: outcome.request,
          dual_control: "peer",
        },
      },
    ]);
    expect(outcome.row).toMatchObject({
      state: "confirmed",
      consumed: true,
      consumed_now: true,
    });
  });

  it("grants in the degraded mode of a single operator, marked degraded_single_operator (PD5)", async () => {
    const outcome = await scenario(async (tx) => {
      await onlyAdmin(tx, adminA);
      const target = await newTarget(tx);
      const request = await requestGrant(
        tx,
        adminA,
        target,
        "admin",
        "second_admin",
      );
      await ageRequest(tx, request, 61);
      const session = await freshSession(tx, adminA);
      await confirm(tx, adminA, session, request, JUSTIFICATION);
      const result = await grant(tx, adminA, {
        session,
        request,
        target,
        role: "admin",
        reason: "second_admin",
      });
      return {
        result,
        roles: await rolesOf(tx, target),
        lines: await registerLines(tx, "account.role_granted", target),
        row: await requestRow(tx, request),
        request,
      };
    });
    expect(outcome.result.outcome).toBe("rows");
    expect(outcome.roles).toEqual(["admin"]);
    expect(outcome.lines).toEqual([
      {
        actor: adminA,
        payload: {
          role: "admin",
          reason_code: "second_admin",
          dual_control_request_id: outcome.request,
          dual_control: "degraded_single_operator",
        },
      },
    ]);
    expect(outcome.row).toMatchObject({ state: "degraded", consumed: true });
  });

  type Case = {
    /** Prepares the case once a request of admin A on `target` exists (not yet confirmed). */
    prepare: (
      tx: postgres.TransactionSql,
      context: { request: string; target: string; sessionB: string },
    ) => Promise<
      Partial<Parameters<typeof grant>[2]> & { by?: string; aal?: "aal1" }
    >;
  };

  async function confirmByB(
    tx: postgres.TransactionSql,
    context: { request: string; sessionB: string },
  ): Promise<void> {
    const result = await confirm(tx, adminB, context.sessionB, context.request);
    if (result.outcome !== "rows") {
      throw new Error(`confirmation refused: ${JSON.stringify(result)}`);
    }
  }

  const REFUSALS: [string, Case][] = [
    [
      "without any dual control (unknown request)",
      { prepare: async () => ({ request: randomUUID() }) },
    ],
    ["with a request still pending", { prepare: async () => ({}) }],
    [
      "with a request confirmed then expired",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
          await tx`
            update backoffice.dual_control_requests
               set requested_at = requested_at - interval '25 hours',
                   expires_at = expires_at - interval '25 hours',
                   confirmed_at = confirmed_at - interval '24 hours 30 minutes'
             where id = ${context.request}`;
          await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
          return {};
        },
      },
    ],
    [
      "with a cancelled request",
      {
        prepare: async (tx, context) => {
          expect((await cancel(tx, adminA, context.request)).outcome).toBe(
            "rows",
          );
          return {};
        },
      },
    ],
    [
      "with a request confirmed for another account",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { target: await newTarget(tx) };
        },
      },
    ],
    [
      "with a request confirmed for another role",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { role: "admin" };
        },
      },
    ],
    [
      "with another reason than the request's",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { reason: "other_reason" };
        },
      },
    ],
    [
      "executed by the requester after the confirmation of a peer",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { by: adminA, session: await freshSession(tx, adminA) };
        },
      },
    ],
    [
      "executed by the requester alone while another active admin exists",
      {
        prepare: async (tx, context) => {
          // degraded while alone, then admin B active again before the execution (PD7 re-read)
          await tx`
            update identity.agent_profiles
               set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${adminA}
             where account_id <> ${adminA} and is_active
               and account_id in (select account_id from identity.account_roles where role = 'admin')`;
          await ageRequest(tx, context.request, 61);
          const session = await freshSession(tx, adminA);
          expect(
            await confirm(tx, adminA, session, context.request, JUSTIFICATION),
          ).toMatchObject({ outcome: "rows" });
          await tx`
            update identity.agent_profiles
               set is_active = true, deactivated_at = null, deactivated_by_account_id = null
             where account_id = ${adminB}`;
          return { by: adminA, session };
        },
      },
    ],
    [
      "without R: the second factor one second too old",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          await ageSession(tx, context.sessionB, FRESHNESS + 1);
          return {};
        },
      },
    ],
    [
      "without R: a session proven by a recovery code",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { session: await freshSession(tx, adminB, "recovery_code") };
        },
      },
    ],
    [
      "without R: the session of another admin",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { session: await freshSession(tx, adminA) };
        },
      },
    ],
    [
      "in aal1",
      {
        prepare: async (tx, context) => {
          await confirmByB(tx, context);
          return { aal: "aal1" };
        },
      },
    ],
  ];

  it.each(REFUSALS)(
    "refuses %s (42501 forbidden, nothing written)",
    async (_label, refusal) => {
      const outcome = await scenario(async (tx) => {
        const target = await newTarget(tx);
        const request = await requestGrant(tx, adminA, target);
        const sessionB = await freshSession(tx, adminB);
        const overrides = await refusal.prepare(tx, {
          request,
          target,
          sessionB,
        });
        const { by, aal, ...call } = overrides;
        const result = await grant(
          tx,
          by ?? adminB,
          { session: sessionB, request, target, ...call },
          aal ?? "aal2",
        );
        return {
          result,
          roles: [
            ...(await rolesOf(tx, target)),
            ...(call.target === undefined
              ? []
              : await rolesOf(tx, call.target)),
          ],
          lines: (await registerLines(tx, "account.role_granted", target))
            .length,
          consumed: (await requestRow(tx, request))?.consumed,
        };
      });
      expect(outcome).toEqual({
        result: FORBIDDEN,
        roles: [],
        lines: 0,
        consumed: false,
      });
    },
  );

  it("refuses a request already consumed: the second execution writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      const session = await freshSession(tx, adminB);
      await confirm(tx, adminB, session, request);
      const first = await grant(tx, adminB, { session, request, target });
      // the role is withdrawn by the migration role's rights, so that only the 2V can refuse
      await tx`delete from identity.account_roles where account_id = ${target}`;
      const second = await grant(tx, adminB, { session, request, target });
      return {
        first: first.outcome,
        second,
        lines: (await registerLines(tx, "account.role_granted", target)).length,
      };
    });
    expect(outcome).toEqual({ first: "rows", second: FORBIDDEN, lines: 1 });
  });

  it("refuses the caller's own account (C(3)) before reading any dual control", async () => {
    const result = await scenario(async (tx) => {
      const session = await freshSession(tx, adminB);
      return grant(tx, adminB, {
        session,
        request: randomUUID(),
        target: adminB,
      });
    });
    expect(result).toEqual(FORBIDDEN);
  });

  it("keeps D41: a second role is refused (23505) and the request stays unconsumed", async () => {
    const outcome = await scenario(async (tx) => {
      const target = dataSet.accounts.creator.b.id;
      const request = await requestGrant(tx, adminA, target, "advertiser");
      const session = await freshSession(tx, adminB);
      await confirm(tx, adminB, session, request);
      return {
        result: await grant(tx, adminB, { session, request, target }),
        consumed: (await requestRow(tx, request))?.consumed,
      };
    });
    expect(outcome.result).toMatchObject({
      outcome: "error",
      code: UNIQUE_VIOLATION,
    });
    expect(outcome.consumed).toBe(false);
  });

  it("accepts R exactly REAUTHENTICATION_FRESHNESS_SECONDS old", async () => {
    const result = await scenario(async (tx) => {
      const target = await newTarget(tx);
      const request = await requestGrant(tx, adminA, target);
      const session = await freshSession(tx, adminB);
      await confirm(tx, adminB, session, request);
      await ageSession(tx, session, FRESHNESS);
      return grant(tx, adminB, { session, request, target });
    });
    expect(result.outcome).toBe("rows");
  });

  it("holds the constant of apps/api as the only bound of R (300 s, J3S-4)", async () => {
    const [row] = await localSuperuser()<{ definition: string }[]>`
      select pg_catalog.pg_get_functiondef(
               'identity.assert_fresh_second_factor(uuid)'::regprocedure) as definition`;
    const bounds = [
      ...(row?.definition ?? "").matchAll(/interval '(\d+) seconds'/g),
    ].map((match) => Number(match[1]));
    expect(bounds).toEqual([FRESHNESS]);
  });
});
