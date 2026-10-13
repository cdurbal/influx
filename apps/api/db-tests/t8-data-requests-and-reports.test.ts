// T8 (J7, commit 2bis) — "my data" and the rescue channel, the database half (migration 0120;
// decision 6 of the J7 start; EC-14; 05 RG57, RG65; 15 RG77): backoffice.submit_data_subject_request()
// (member, needs the marker of decision 4) and backoffice.record_code_delivery_report() (E-1
// support.report_delivery_issue, influx_auth only). Routes, template and procedure: commit 8.
//
// The marker is written by influx_auth and consumed by the member: each case runs in ONE
// rolled-back transaction of the local superuser (actAs, actAsMember of support.ts). The data set
// holds an open ACCESS request per member account: the deposits below are ERASURE requests.
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
  type UserContext,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
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
const FOREIGN_KEY_VIOLATION = "23503";

const SUBMIT =
  "select request_id::text, created from backoffice.submit_data_subject_request($1::uuid, $2::backoffice.data_request_type)";
const REPORT =
  "select backoffice.record_code_delivery_report($1, $2, $3, $4)::text as id";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function advertiserA(): UserContext {
  return {
    accountId: dataSet.accounts.advertiser.a.id,
    role: "advertiser",
    aal: "aal1",
  };
}

async function sessionOfAdvertiserA(
  tx: postgres.TransactionSql,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from identity.sessions
     where token_hash = ${dataSet.accounts.advertiser.a.sessionTokenHash}`;
  if (row === undefined) {
    throw new Error("no data set session");
  }
  return row.id;
}

async function mark(
  tx: postgres.TransactionSql,
  session: string,
  purpose: "email_change" | "data_export" | "account_deletion",
): Promise<void> {
  await actAs(
    tx,
    "auth",
    () =>
      tx`select identity.mark_member_reauthenticated(${session}::uuid,
                ${purpose}::identity.reauth_purpose)`,
  );
}

type Submitted = { request_id: string; created: boolean };

async function submit(
  tx: postgres.TransactionSql,
  session: string,
  type: string,
): Promise<Submitted | undefined> {
  return actAsMember(tx, "influx_advertiser", advertiserA(), async () => {
    const [row] = await tx.unsafe<Submitted[]>(SUBMIT, [session, type]);
    return row;
  });
}

function submitProbe(
  tx: postgres.TransactionSql,
  session: string,
  type: string,
): Promise<ProbeResult> {
  return actAsMember(tx, "influx_advertiser", advertiserA(), () =>
    probe(tx, SUBMIT, [session, type]),
  );
}

// ---------------------------------------------------------------------------------------------

describe("backoffice.submit_data_subject_request() (EC-14, decision 6)", () => {
  it("deposits an erasure request with the marker account_deletion: due in 30 days, P1 acknowledgement, register line", async () => {
    const result = await scenario(async (tx) => {
      const session = await sessionOfAdvertiserA(tx);
      await mark(tx, session, "account_deletion");
      const submitted = await submit(tx, session, "erasure");
      const id = submitted?.request_id ?? "";
      const [row] = await tx<
        {
          request_type: string;
          channel: string;
          status: string;
          due_days: number;
          requester: string;
        }[]
      >`
        select request_type::text, channel::text, status::text,
               extract(epoch from due_at - received_at)::int / 86400 as due_days,
               requester_account_id::text as requester
          from backoffice.data_subject_requests where id = ${id}`;
      const queue = await tx<
        {
          event_type: string;
          destination: string;
          priority: number;
          payload: Record<string, unknown>;
        }[]
      >`
        select event_type, destination::text, priority, payload from leads.outbox_events
         where event_type = 'privacy.request_received' and payload ->> 'request_id' = ${id}`;
      const lines = await tx<
        { subject_type: string; payload: Record<string, unknown> }[]
      >`
        select subject_type, payload from audit.audit_events
         where event_type = 'privacy.request_received' and subject_id = ${id}::uuid`;
      const [marker] = await tx<{ purpose: string | null }[]>`
        select reauth_purpose::text as purpose from identity.sessions where id = ${session}`;
      return { submitted, row, queue, lines, marker: marker?.purpose };
    });
    expect(result.submitted?.created).toBe(true);
    expect(result.row).toEqual({
      request_type: "erasure",
      channel: "self_service",
      status: "received",
      due_days: 30,
      requester: dataSet.accounts.advertiser.a.id,
    });
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]).toMatchObject({
      destination: "brevo_transactional",
      priority: 100,
      payload: {
        account_id: dataSet.accounts.advertiser.a.id,
        request_id: result.submitted?.request_id,
        email_code: "privacy.request_received",
      },
    });
    expect(result.lines).toEqual([
      {
        subject_type: "data_subject_request",
        payload: { request_type: "erasure" },
      },
    ]);
    // single use (decision 4)
    expect(result.marker).toBeNull();
  });

  it("returns the open request of the same type without a second acknowledgement (created = false)", async () => {
    const result = await scenario(async (tx) => {
      const session = await sessionOfAdvertiserA(tx);
      const [open] = await tx<{ id: string }[]>`
        select id::text from backoffice.data_subject_requests
         where requester_account_id = ${dataSet.accounts.advertiser.a.id}
           and request_type = 'access' and status <> 'closed'`;
      await mark(tx, session, "data_export");
      const submitted = await submit(tx, session, "access");
      const [queued] = await tx<{ n: number }[]>`
        select count(*)::int as n from leads.outbox_events
         where event_type = 'privacy.request_received' and payload ->> 'request_id' = ${open?.id ?? ""}`;
      return { open: open?.id, submitted, queued: queued?.n };
    });
    expect(result.submitted).toEqual({
      request_id: result.open,
      created: false,
    });
    expect(result.queued).toBe(0);
  });

  it.each([
    ["without a marker", null, "erasure", NOT_IN_PREREQUISITE_STATE],
    [
      "with the marker of the other right",
      "data_export",
      "erasure",
      NOT_IN_PREREQUISITE_STATE,
    ],
    [
      "with the email_change marker",
      "email_change",
      "access",
      NOT_IN_PREREQUISITE_STATE,
    ],
    [
      "for a right not exposed at J7",
      "data_export",
      "rectification",
      INVALID_PARAMETER,
    ],
  ] as const)("refuses a deposit %s", async (_label, purpose, type, code) => {
    const result = await scenario(async (tx) => {
      const session = await sessionOfAdvertiserA(tx);
      if (purpose !== null) {
        await mark(tx, session, purpose);
      }
      return submitProbe(tx, session, type);
    });
    expect(result).toEqual({ outcome: "error", code });
  });

  it("is refused to influx_auth and to the agent (42501)", async () => {
    const auth = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(tx, SUBMIT, [
          "00000000-0000-4000-8000-000000000000",
          "access",
        ]);
      },
    );
    const agent = await inRolledBackTransaction(
      loginRole("influx_app"),
      async (tx) => {
        await takeRole(tx, "influx_agent", {
          accountId: dataSet.accounts.agent.a.id,
          role: "agent",
          aal: "aal2",
        });
        return probe(tx, SUBMIT, [
          "00000000-0000-4000-8000-000000000000",
          "access",
        ]);
      },
    );
    expect([auth, agent]).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });
});

describe("backoffice.record_code_delivery_report() (E-1, influx_auth only, 05 RG65)", () => {
  function asAuth(
    parameters: (string | null)[],
    read = false,
  ): Promise<{ result: ProbeResult; row?: Record<string, unknown> }> {
    return scenario(async (tx) => {
      const result = await actAs(tx, "auth", () =>
        probe(tx, REPORT, parameters),
      );
      if (!read) {
        return { result };
      }
      const [row] = await tx<Record<string, unknown>[]>`
        select login_email, contact_email, message, locale, status::text as status,
               received_at = now() as fresh
          from backoffice.code_delivery_reports where received_at = now()`;
      return { result, row };
    });
  }

  it("writes one report, addresses normalised, message cleaned, and nothing else", async () => {
    const { result, row } = await asAuth(
      [
        "  Lost.Code@Example.TEST ",
        "Other@Example.test",
        "no code\r\nsince\tmonday",
        "fr",
      ],
      true,
    );
    expect(result).toEqual({ outcome: "rows", count: 1 });
    expect(row).toEqual({
      login_email: "lost.code@example.test",
      contact_email: "other@example.test",
      // control characters but the line feed become a space
      message: "no code \nsince monday",
      locale: "fr",
      status: "received",
      fresh: true,
    });
  });

  it.each([
    [
      "a message over 500 characters",
      ["a@example.test", "b@example.test", "x".repeat(501), "fr"],
      INVALID_PARAMETER,
    ],
    [
      "a malformed login address",
      ["not-an-address", "b@example.test", null, "fr"],
      INVALID_PARAMETER,
    ],
    [
      "a locale out of format",
      ["a@example.test", "b@example.test", null, "FR"],
      INVALID_PARAMETER,
    ],
    [
      "a locale that is not a UI language",
      ["a@example.test", "b@example.test", null, "de"],
      FOREIGN_KEY_VIOLATION,
    ],
  ] as const)("refuses %s", async (_label, parameters, code) => {
    const { result } = await asAuth([...parameters]);
    expect(result).toEqual({ outcome: "error", code });
  });

  it.each([
    ["influx_worker_login", "influx_worker"],
    ["influx_app", "influx_creator"],
  ] as const)("is refused to %s (42501)", async (login, role) => {
    const result = await inRolledBackTransaction(
      loginRole(login),
      async (tx) => {
        if (role === "influx_creator") {
          await takeRole(tx, role, {
            accountId: dataSet.accounts.creator.a.id,
            role: "creator",
            aal: "aal1",
          });
        } else {
          await takeRole(tx, role);
        }
        return probe(tx, REPORT, [
          "a@example.test",
          "b@example.test",
          null,
          "fr",
        ]);
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("never lets influx_auth read the reports back (write only)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(
          tx,
          "select login_email from backoffice.code_delivery_reports",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});
