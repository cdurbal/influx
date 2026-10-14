// T3 continued — the narrow register functions of influx_auth (0011): audit.append_elevated()
// (EC-36, V6) and audit.append_auth_event() (EC-44, G-1). Lines are committed through the real
// connection role, then read back by the migration role, like the M2 cases of
// t3-audit-chain.test.ts; they stay in the local chain (18 Q5: reset before a triple run).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

type Line = {
  event_type: string;
  subject_type: string;
  subject_id: string;
  actor_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

/** Runs `statement` (returning a seq) as influx_auth, commits, and reads the line back. */
async function writeAsAuth(
  statement: string,
  parameters: string[],
  settings: { account?: string; role?: string } = {},
): Promise<Line> {
  const seq = await loginRole("influx_auth_login").begin(async (tx) => {
    await takeRole(tx, "influx_auth");
    await tx`select
      pg_catalog.set_config('influx.account', ${settings.account ?? ""}, true),
      pg_catalog.set_config('influx.role', ${settings.role ?? ""}, true)`;
    const [row] = await tx.unsafe<{ seq: string }[]>(
      `select (${statement})::text as seq`,
      parameters,
    );
    return row?.seq;
  });
  const [line] = await migration<Line[]>`
    select event_type, subject_type, subject_id::text, actor_type::text,
           actor_account_id::text, payload
      from audit.audit_events where chain_key = 'global' and seq = ${seq ?? "0"}`;
  if (line === undefined) {
    throw new Error("the line was not found");
  }
  return line;
}

function asAuth(
  statement: string,
  parameters: string[] = [],
): Promise<ProbeResult> {
  return inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
    await takeRole(tx, "influx_auth");
    return probe(tx, statement, parameters);
  });
}

function asWorker(
  statement: string,
  parameters: string[] = [],
): Promise<ProbeResult> {
  return inRolledBackTransaction(
    loginRole("influx_worker_login"),
    async (tx) => {
      await takeRole(tx, "influx_worker");
      return probe(tx, statement, parameters);
    },
  );
}

describe("EC-36: audit.append_elevated()", () => {
  it("writes elevated.<operation> with the subject type of the catalogue and {operation} only", async () => {
    const reference = randomUUID();
    expect(
      await writeAsAuth("audit.append_elevated($1, $2::uuid)", [
        "identity.request_code",
        reference,
      ]),
    ).toEqual({
      event_type: "elevated.identity.request_code",
      subject_type: "login_request",
      subject_id: reference,
      actor_type: "system",
      actor_account_id: null,
      payload: { operation: "identity.request_code" },
    });
  });

  it("derives the actor from session_user through append() (V6): service, whatever influx.role says", async () => {
    const account = dataSet.accounts.agent.a.id;
    expect(
      await writeAsAuth(
        "audit.append_elevated($1, $2::uuid)",
        ["identity.backoffice_sign_in", account],
        { account, role: "admin" },
      ),
    ).toMatchObject({
      event_type: "elevated.identity.backoffice_sign_in",
      subject_type: "account",
      subject_id: account,
      actor_type: "service",
      actor_account_id: account,
    });
  });

  it.each([
    ["an unknown operation", "identity.unknown_motif"],
    ["a malformed operation", "Identity.Request_Code"],
    ["a code of another family", "agent.break_glass_login"],
    ["an empty operation", ""],
  ])("refuses %s (22023)", async (_label, operation) => {
    expect(
      await asAuth("select audit.append_elevated($1, gen_random_uuid())", [
        operation,
      ]),
    ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("refuses a line without a subject: never a random id", async () => {
    expect(
      await asAuth("select audit.append_elevated($1, null)", [
        "identity.verify_code",
      ]),
    ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("knows the motifs of E-1 and E-2 (five at J3, the sign-up at J5), E-3 (J6), the five of J7, and no other", async () => {
    const codes = await migration<{ code: string; subject_type: string }[]>`
      select code, subject_type from audit.event_types
       where code like 'elevated.%' order by code`;
    expect(codes).toEqual([
      {
        code: "elevated.identity.backoffice_enroll_totp",
        subject_type: "account",
      },
      {
        code: "elevated.identity.backoffice_reauthenticate",
        subject_type: "account",
      },
      { code: "elevated.identity.backoffice_sign_in", subject_type: "account" },
      // 0104 (J5, EC-30): the elevated transaction of the sign-up, on the created account
      {
        code: "elevated.identity.complete_signup",
        subject_type: "account",
      },
      // 0123 (J7 decision 5): the journal of the two codes of an address change, on the account
      {
        code: "elevated.identity.member_email_change",
        subject_type: "account",
      },
      // 0115 (J7 decision 4): the member's fresh code, on the account
      {
        code: "elevated.identity.member_reauthenticate",
        subject_type: "account",
      },
      { code: "elevated.identity.request_code", subject_type: "login_request" },
      // C6-1 (EC-52 settled): the verification is traced on the account
      { code: "elevated.identity.verify_code", subject_type: "account" },
      // 0111 (J6, EC-52 (3)): the queue line journaled for an account (the welcome e-mail)
      { code: "elevated.leads.drain_outbox", subject_type: "account" },
      // 0115 (J7 decision 2): the raw line written by the Brevo webhook
      {
        code: "elevated.leads.receive_brevo_event",
        subject_type: "brevo_inbound_event",
      },
      // 0115 (J7 decision 3): the E-4 run claimed
      {
        code: "elevated.maintenance.run_periodic",
        subject_type: "periodic_run",
      },
      // 0115 (J7 decision 6): the report of the rescue channel
      {
        code: "elevated.support.report_delivery_issue",
        subject_type: "code_delivery_report",
      },
    ]);
  });
});

describe("J6S-2 (0115): the family of a motif is bound to its connection role", () => {
  it.each([
    ["identity.request_code"],
    ["support.report_delivery_issue"],
    ["leads.receive_brevo_event"],
  ])("lets influx_auth write %s", async (operation) => {
    expect(
      await asAuth("select audit.append_elevated($1, gen_random_uuid())", [
        operation,
      ]),
    ).toEqual({ outcome: "rows", count: 1 });
  });

  it.each([["leads.drain_outbox"], ["maintenance.run_periodic"]])(
    "lets influx_worker write %s",
    async (operation) => {
      expect(
        await asWorker("select audit.append_elevated($1, gen_random_uuid())", [
          operation,
        ]),
      ).toEqual({ outcome: "rows", count: 1 });
    },
  );

  it.each([["leads.drain_outbox"], ["maintenance.run_periodic"]])(
    "refuses %s to influx_auth (42501)",
    async (operation) => {
      expect(
        await asAuth("select audit.append_elevated($1, gen_random_uuid())", [
          operation,
        ]),
      ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    },
  );

  it.each([
    ["identity.verify_code"],
    ["support.report_delivery_issue"],
    ["leads.receive_brevo_event"],
  ])("refuses %s to influx_worker (42501)", async (operation) => {
    expect(
      await asWorker("select audit.append_elevated($1, gen_random_uuid())", [
        operation,
      ]),
    ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("still answers 22023 before the family check for an unknown motif", async () => {
    expect(
      await asWorker("select audit.append_elevated($1, gen_random_uuid())", [
        "maintenance.unknown_task",
      ]),
    ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });
});

describe("EC-44 and G-1: audit.append_auth_event()", () => {
  it.each([
    "agent.break_glass_login",
    "agent.unexpected_mfa_factor",
    "agent.reauthentication_failed",
    "security.backoffice_login_failures",
  ])("writes %s on the account, with an empty payload", async (code) => {
    const account = dataSet.accounts.agent.b.id;
    expect(
      await writeAsAuth("audit.append_auth_event($1, $2::uuid)", [
        code,
        account,
      ]),
    ).toMatchObject({
      event_type: code,
      subject_type: "account",
      subject_id: account,
      payload: {},
    });
  });

  it.each([
    "account.role_granted",
    "elevated.identity.request_code",
    "agent.recovery_code_consumed",
    "agent.mfa_enrolled",
  ])("refuses %s (42501): closed list", async (code) => {
    expect(
      await asAuth("select audit.append_auth_event($1, gen_random_uuid())", [
        code,
      ]),
    ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("influx_auth reaches the register through the two narrow functions only", () => {
  it.each([
    "select audit.append('account.role_granted', 'account', gen_random_uuid())",
    "select seq from audit.audit_events limit 1",
    "select code from audit.event_types limit 1",
    "select * from audit.verify_chain('global', false, false)",
  ])("refuses: %s", async (statement) => {
    expect(await asAuth(statement)).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("keeps the chain continuous and verifiable after these lines", async () => {
    const [row] = await inRolledBackTransaction(
      migration,
      (tx) => tx<{ status: string }[]>`
        select status from audit.verify_chain('global', true, true)`,
    );
    expect(row?.status).toBe("ok");
  });
});
