// T8 (J8, commit 9) — the reads of the backoffice screens, the database half (migration 0138; 05
// RG141, RG145; 03 B-7; 17b §3.14.a, §3.14.e; 21 J3S-6, EC-43):
//   identity.backoffice_session_state()      the caller's own session only;
//   identity.signal_new_backoffice_browser() influx_auth only, the session of its transaction only;
//   backoffice.new_browser_sign_ins()        an active admin in aal2 only.
// The route half (a real sign-in, GET /v1/bo/me, GET /v1/bo/alerts) is in t8-backoffice-sign-in and
// t14-backoffice-actions-route. Each case runs in ONE rolled-back transaction of the local superuser.
import { inRolledBackTransaction, type DataSet } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  localSuperuser,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
const STATE = "select * from identity.backoffice_session_state($1::uuid)";
const SIGNAL = "select identity.signal_new_backoffice_browser($1::uuid) as s";
const SIGN_INS = "select * from backoffice.new_browser_sign_ins($1::int)";

let dataSet: DataSet;
let admin: string;
let agent: string;

beforeAll(async () => {
  dataSet = await testDataSet();
  admin = dataSet.accounts.admin.a.id;
  agent = dataSet.accounts.agent.a.id;
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Record<string, unknown>[] }
  | { outcome: "error"; code: string };

async function attempt(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[],
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
    return { outcome: "error", code: (error as { code?: string }).code ?? "" };
  }
}

/** A backoffice session of an internal account, opened now (0012 trigger sets the dates). */
async function session(
  tx: postgres.TransactionSql,
  account: string,
  method: "totp" | "recovery_code",
  summary = "firefox.linux",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice',
            ${method}::identity.mfa_method, ${summary})
    returning id::text`;
  return row?.id ?? "";
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
    role === "admin" ? "influx_admin" : "influx_agent",
    { accountId: account, role, aal },
    fn,
  );
}

describe("J3S-6: identity.backoffice_session_state()", () => {
  it("says the factor of the caller's own session, and the codes left after a recovery code", async () => {
    const result = await scenario(async (tx) => {
      await tx`
        insert into identity.mfa_recovery_codes (account_id, batch_id, code_hash)
        select ${agent}::uuid, gen_random_uuid(), sha256(gen_random_uuid()::text::bytea)
          from generate_series(1, 4)`;
      const totp = await session(tx, agent, "totp");
      const recovery = await session(tx, agent, "recovery_code");
      return asInternal(tx, "agent", agent, async () => [
        await attempt(tx, STATE, [totp]),
        await attempt(tx, STATE, [recovery]),
      ]);
    });
    expect(result[0]).toMatchObject({
      outcome: "rows",
      rows: [{ mfa_method: "totp", recovery_codes_left: null }],
    });
    const left = result[1];
    expect(left?.outcome === "rows" && left.rows[0]?.mfa_method).toBe(
      "recovery_code",
    );
    expect(
      left?.outcome === "rows" &&
        Number(left.rows[0]?.recovery_codes_left) >= 4,
    ).toBe(true);
  });

  it("refuses another account's session, an unknown one and a caller below aal2 (one answer)", async () => {
    const result = await scenario(async (tx) => {
      const other = await session(tx, admin, "totp");
      const own = await session(tx, agent, "totp");
      return [
        await asInternal(tx, "agent", agent, () => attempt(tx, STATE, [other])),
        await asInternal(tx, "agent", agent, () =>
          attempt(tx, STATE, ["00000000-0000-4000-8000-000000000000"]),
        ),
        await asInternal(
          tx,
          "agent",
          agent,
          () => attempt(tx, STATE, [own]),
          "aal1",
        ),
      ];
    });
    expect(result).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });
});

describe("B-7: identity.signal_new_backoffice_browser() and backoffice.new_browser_sign_ins()", () => {
  it("signals a browser unseen on the account, once listed for the admins; a known one is silent", async () => {
    const result = await scenario(async (tx) => {
      await session(tx, agent, "totp", "safari.macos");
      const known = await session(tx, agent, "totp", "safari.macos");
      const unseen = await session(tx, agent, "totp", "edge.windows");
      const signals = await actAs(tx, "auth", async () => [
        await attempt(tx, SIGNAL, [known]),
        await attempt(tx, SIGNAL, [unseen]),
      ]);
      const listed = await asInternal(tx, "admin", admin, () =>
        attempt(tx, SIGN_INS, [7]),
      );
      return { signals, listed };
    });
    expect(result.signals).toEqual([
      { outcome: "rows", rows: [{ s: false }] },
      { outcome: "rows", rows: [{ s: true }] },
    ]);
    expect(
      result.listed.outcome === "rows" &&
        result.listed.rows.filter(
          (row) => row.account_id === agent && row.browser === "edge.windows",
        ).length,
    ).toBe(1);
  });

  it("refuses a session of another transaction or a member session (55000), and any caller but influx_auth (42501)", async () => {
    const result = await scenario(async (tx) => {
      const opened = await session(tx, agent, "totp");
      return [
        await actAs(tx, "auth", () =>
          attempt(tx, SIGNAL, ["00000000-0000-4000-8000-000000000000"]),
        ),
        await asInternal(tx, "admin", admin, () =>
          attempt(tx, SIGNAL, [opened]),
        ),
        await actAs(tx, "worker", () => attempt(tx, SIGNAL, [opened])),
      ];
    });
    expect(result).toEqual([
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });

  it("the list is an admin's, in aal2, over 1 to 30 days", async () => {
    const result = await scenario(async (tx) => [
      await asInternal(tx, "agent", agent, () => attempt(tx, SIGN_INS, [7])),
      await asInternal(
        tx,
        "admin",
        admin,
        () => attempt(tx, SIGN_INS, [7]),
        "aal1",
      ),
      await asInternal(tx, "admin", admin, () => attempt(tx, SIGN_INS, [31])),
    ]);
    expect(result).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INVALID_PARAMETER_VALUE },
    ]);
  });
});

describe("J8S-4 (0142): backoffice.admin_role_grants(), the admin role grants of the last days", () => {
  const GRANTS = "select * from backoffice.admin_role_grants($1::int)";

  /**
   * One account.role_granted line on `subject`, written through audit.append() by the superuser
   * (a system line), then given an actor and an age (the append-only guard is lifted for the
   * rolled-back fixture only).
   */
  async function grantLine(
    tx: postgres.TransactionSql,
    subject: string,
    payload: Record<string, string>,
    options: { actor?: string; ageDays?: number } = {},
  ): Promise<void> {
    const [row] = await tx<{ seq: string }[]>`
      select audit.append('account.role_granted', 'account', ${subject}::uuid,
                          ${JSON.stringify(payload)}::text::jsonb)::text as seq`;
    await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
    await tx`
      update audit.audit_events
         set actor_type       = case when ${options.actor ?? null}::uuid is null
                                     then actor_type else 'admin' end,
             actor_account_id = coalesce(${options.actor ?? null}::uuid, actor_account_id),
             occurred_at      = occurred_at - make_interval(days => ${options.ageDays ?? 0})
       where chain_key = 'global' and seq = ${row?.seq ?? "0"}::bigint`;
    await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
  }

  it("lists the admin grants of the window, newest first: who, by whom, when; nothing else", async () => {
    const adminB = dataSet.accounts.admin.b.id;
    const agentB = dataSet.accounts.agent.b.id;
    const result = await scenario(async (tx) => {
      const byInvitation = randomUUID();
      const old = randomUUID();
      const notAdmin = randomUUID();
      // grant_role (0130): the actor is the confirming admin
      await grantLine(
        tx,
        agentB,
        { role: "admin", reason_code: "test_j9", dual_control: "peer" },
        { actor: adminB, ageDays: 1 },
      );
      // accept_internal_invitation (0131): the author is in the payload, the line has no actor
      await grantLine(tx, byInvitation, {
        role: "admin",
        reason_code: "internal_invitation",
        granted_by_account_id: admin,
      });
      await grantLine(
        tx,
        old,
        { role: "admin" },
        { actor: adminB, ageDays: 8 },
      );
      await grantLine(tx, notAdmin, { role: "agent" }, { actor: adminB });
      const names = await tx<{ account_id: string; first_name: string }[]>`
        select account_id::text, first_name from identity.agent_profiles
         where account_id in (${admin}, ${adminB}, ${agentB})`;
      const listed = await asInternal(tx, "admin", admin, () =>
        attempt(tx, GRANTS, [7]),
      );
      const month = await asInternal(tx, "admin", admin, () =>
        attempt(tx, GRANTS, [30]),
      );
      return { byInvitation, old, notAdmin, names, listed, month };
    });
    const nameOf = (id: string) =>
      result.names.find((row) => row.account_id === id)?.first_name ?? null;
    const ours = (attempted: Attempt) =>
      attempted.outcome === "rows"
        ? attempted.rows
            .filter((row) =>
              [
                agentB,
                result.byInvitation,
                result.old,
                result.notAdmin,
              ].includes(String(row.account_id)),
            )
            .map((row) => ({
              ...row,
              occurred_at: row.occurred_at instanceof Date,
            }))
        : attempted;
    expect(ours(result.listed)).toEqual([
      {
        account_id: result.byInvitation,
        first_name: null,
        granted_by_account_id: admin,
        granted_by_first_name: nameOf(admin),
        occurred_at: true,
      },
      {
        account_id: agentB,
        first_name: nameOf(agentB),
        granted_by_account_id: adminB,
        granted_by_first_name: nameOf(adminB),
        occurred_at: true,
      },
    ]);
    // eight days old: outside 7 days, inside 30; a grant of another role never
    expect(
      (ours(result.month) as Record<string, unknown>[]).map(
        (row) => row.account_id,
      ),
    ).toEqual([result.byInvitation, agentB, result.old]);
  });

  it("is an active admin's read in aal2, over 1 to 30 days", async () => {
    const result = await scenario(async (tx) => [
      await asInternal(tx, "agent", agent, () => attempt(tx, GRANTS, [7])),
      await asInternal(
        tx,
        "admin",
        admin,
        () => attempt(tx, GRANTS, [7]),
        "aal1",
      ),
      await asInternal(tx, "admin", admin, () => attempt(tx, GRANTS, [0])),
      await asInternal(tx, "admin", admin, () => attempt(tx, GRANTS, [31])),
      await asInternal(tx, "admin", admin, () => attempt(tx, GRANTS, [null])),
    ]);
    expect(result).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INVALID_PARAMETER_VALUE },
      { outcome: "error", code: INVALID_PARAMETER_VALUE },
      { outcome: "error", code: INVALID_PARAMETER_VALUE },
    ]);
  });
});
