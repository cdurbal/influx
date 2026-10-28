// TM1 (J7, commit 8) — "mes données" and the rescue channel on the local stack (decision 6 of the
// J7 start; EC-14; 05 RG57, RG65, CA26; 17 §6.3; 18 T14, T15). The routes GET and POST
// /v1/me/data-requests (a REQUEST after a fresh code of its purpose, its acknowledgement queued,
// nothing executed; exempt from the terms gate, A3) and POST /v1/support/code-not-received (one
// answer whatever the addresses, never a code nor a session, its own counters). Real database
// (pools of apps/api, migration 0120), GoTrue as an in-memory double of the adapter, Brevo as the
// double of @influx/test-kit (RG148). Accounts are COMMITTED by the migration role (random
// identifiers, disposable local stack); their queue lines are removed after the file. Reports and
// requests are append-only (0120): they stay on the local stack.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import {
  startBrevoDouble,
  type BrevoDouble,
  type BrevoDoubleMessage,
} from "@influx/test-kit/brevo-double";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { createTransactionalSender } from "../src/platform/brevo-transactional.ts";
import type { GoTrueFailure, SupabaseAuth } from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import { localSuperuser, migrationRole } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
let double: BrevoDouble;
let termsInForce: string;
const accounts: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

// --- GoTrue: the two calls of a fresh code, in memory ----------------------------------------------

class GoTrueDouble {
  readonly users = new Map<string, string>();
  readonly codes = new Map<string, string>();

  add(email: string): string {
    const id = randomUUID();
    this.users.set(id, email);
    return id;
  }

  userOf(email: string): string | null {
    for (const [id, held] of this.users) {
      if (held === email) {
        return id;
      }
    }
    return null;
  }

  auth(): SupabaseAuth {
    const notUsed = (): never => {
      throw new Error("not used by these routes");
    };
    const rejected = (errorCode: string, status: number): GoTrueFailure => ({
      ok: false,
      reason: "rejected",
      errorCode,
      status,
    });
    return {
      createUser: notUsed,
      createPasswordUser: notUsed,
      deleteUser: notUsed,
      getUser: notUsed,
      generateEmailCode: async (email) => {
        const userId = this.userOf(email);
        if (userId === null) {
          return rejected("user_not_found", 404);
        }
        const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
        this.codes.set(email, code);
        return { ok: true, value: { userId, email, code } };
      },
      verifyEmailCode: async (_context, email, code) => {
        const userId = this.userOf(email);
        if (userId === null || this.codes.get(email) !== code) {
          return rejected("otp_expired", 403);
        }
        this.codes.delete(email);
        return { ok: true, value: { userId, email } };
      },
      verifyPassword: notUsed,
      withPasswordSession: notUsed,
      listFactors: notUsed,
      deleteFactor: notUsed,
      updateUserEmail: notUsed,
    };
  }
}

let gotrue: GoTrueDouble;

// --- Members and calls ------------------------------------------------------------------------------

type Member = {
  accountId: string;
  email: string;
  session: string;
  clientAddress: string;
};

/** 0127: the earlier of 30 days and one calendar month in UTC, the day clamped to the month's end. */
function legalDeadline(receivedAt: number): number {
  const at = new Date(receivedAt);
  const lastDay = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 2, 0),
  ).getUTCDate();
  const month = new Date(receivedAt);
  month.setUTCDate(1);
  month.setUTCMonth(at.getUTCMonth() + 1);
  month.setUTCDate(Math.min(at.getUTCDate(), lastDay));
  return Math.min(receivedAt + 30 * 24 * 3_600_000, month.getTime());
}

function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::5`;
}

function newAddress(label: string): string {
  const address = `tm1-data-${label}-${randomUUID()}@example.test`;
  watchedValues.push(address);
  return address;
}

async function newMember(
  options: { termsAccepted?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = newAddress("member");
  const authUserId = gotrue.add(email);
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${authUserId}, ${email}, now(), 'FR', 'fr',
              true, now(), 'individual'::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'creator'::identity.account_role)`;
    if (options.termsAccepted ?? true) {
      await tx`
        insert into identity.terms_acceptances
          (account_id, terms_version_id, nature, channel, locale)
        values (${accountId}, ${termsInForce}, 'acceptance', 'signup', 'fr')`;
    }
  });
  accounts.push(accountId);
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions
      (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  const session = token.toString("base64url");
  watchedValues.push(session);
  return { accountId, email, session, clientAddress: newClientAddress() };
}

function app(options: { reportFloorMs?: number } = {}) {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: {
      supabaseAuth: gotrue.auth(),
      sender: createTransactionalSender(
        {
          mode: "live",
          testRecipients: [],
          apiKey: "local-double-key",
          baseUrl: double.baseUrl,
          senderEmail: "no-reply@tx.influx.example",
        },
        {
          logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
          },
        },
      ),
      deliveryReportFloorMs: options.reportFloorMs ?? 0,
    },
  });
}

type Server = ReturnType<typeof app>;

async function call(
  server: Server,
  method: "GET" | "POST",
  url: string,
  member: Member | null,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      "x-real-ip": member?.clientAddress ?? newClientAddress(),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(member === null
        ? {}
        : { cookie: `__Host-influx-session=${member.session}` }),
      ...extra,
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

function codeOf(message: BrevoDoubleMessage | undefined): string {
  const code = /^(\d{6})$/m.exec(message?.body.textContent ?? "")?.[1];
  if (code === undefined) {
    throw new Error("no code in the e-mail");
  }
  return code;
}

type Purpose = "email_change" | "data_export" | "account_deletion";

/** Request then verify a fresh code for `purpose`. */
async function reauthenticate(
  server: Server,
  member: Member,
  purpose: Purpose,
): Promise<void> {
  const from = double.messages.length;
  const asked = await call(
    server,
    "POST",
    "/v1/me/reauthenticate/request-code",
    member,
    { purpose },
  );
  expect(asked.statusCode).toBe(200);
  const { reauthToken } = asked.json() as { reauthToken: string };
  watchedValues.push(reauthToken);
  const message = double.messages
    .slice(from)
    .find((candidate) => candidate.body.to?.[0]?.email === member.email);
  const verified = await call(
    server,
    "POST",
    "/v1/me/reauthenticate/verify-code",
    member,
    { purpose, code: codeOf(message), reauthToken },
  );
  expect(verified.json()).toMatchObject({ outcome: "reauthenticated" });
}

function errorOf(response: LightMyRequestResponse) {
  const { error } = response.json() as { error: { code: string } };
  return { status: response.statusCode, code: error.code };
}

type QueueLine = {
  event_type: string;
  destination: string;
  priority: number;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

async function acknowledgementsOf(accountId: string): Promise<QueueLine[]> {
  return migration<QueueLine[]>`
    select event_type, destination::text as destination, priority, payload, idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${accountId}`}
       and event_type = 'privacy.request_received'
     order by id`;
}

type ErasureFacts = {
  requests: { id: string; status: string; channel: string }[];
  executions: {
    request_id: string;
    authorised_by: string;
    approved_by_account_id: string | null;
    dual_control_request_id: string | null;
    executed_at: string | null;
  }[];
  dualControls: number;
};

/** What an erasure left in the database for an account (D72, T1). */
async function erasureFactsOf(accountId: string): Promise<ErasureFacts> {
  const requests = await migration<ErasureFacts["requests"]>`
    select id::text as id, status::text as status, channel::text as channel
      from backoffice.data_subject_requests
     where requester_account_id = ${accountId} and request_type = 'erasure'
     order by received_at, id`;
  const executions = await migration<ErasureFacts["executions"]>`
    select request_id::text as request_id, authorised_by,
           approved_by_account_id::text as approved_by_account_id,
           dual_control_request_id::text as dual_control_request_id,
           executed_at::text as executed_at
      from privacy.request_executions where account_id = ${accountId}
     order by approved_at, request_id`;
  const [dual] = await migration<{ count: string }[]>`
    select count(*)::text as count
      from backoffice.dual_control_requests d
      join privacy.request_executions e on e.dual_control_request_id = d.id
     where e.account_id = ${accountId}`;
  return {
    requests: [...requests],
    executions: [...executions],
    dualControls: Number(dual?.count ?? "0"),
  };
}

/** The register codes of a request, in order. */
async function registerOf(requestId: string): Promise<string[]> {
  const rows = await migration<{ event_type: string }[]>`
    select event_type from audit.audit_events where subject_id = ${requestId} order by seq`;
  return rows.map((row) => row.event_type);
}

beforeAll(async () => {
  migration = migrationRole();
  const [version] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  if (version === undefined) {
    throw new Error(
      "no terms of service in force WITH its text (on a workstation, run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = version.id;
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  double = await startBrevoDouble();
});

beforeEach(() => {
  gotrue = new GoTrueDouble();
  double.reset();
});

afterAll(async () => {
  await closeDatabase(database);
  await double.close();
  if (accounts.length > 0) {
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

// --- "Mes données" ------------------------------------------------------------------------------------

describe("POST and GET /v1/me/data-requests (EC-14; 05 RG57; 17 §6.3; decision 6)", () => {
  it("without a fresh code: 403 reauthentication_required, nothing written nor queued", async () => {
    const server = app();
    const member = await newMember();
    const refused = await call(server, "POST", "/v1/me/data-requests", member, {
      type: "access",
    });
    expect(errorOf(refused)).toEqual({
      status: 403,
      code: "reauthentication_required",
    });
    expect(
      (await call(server, "GET", "/v1/me/data-requests", member)).json(),
    ).toEqual({ requests: [] });
    expect(await acknowledgementsOf(member.accountId)).toEqual([]);
  });

  it("an export after a fresh code for data_export: a request due in 30 days, its acknowledgement queued P1 with ids only", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member, "data_export");
    const deposited = await call(
      server,
      "POST",
      "/v1/me/data-requests",
      member,
      { type: "access" },
    );
    expect(deposited.statusCode).toBe(200);
    const body = deposited.json() as {
      outcome: string;
      request: {
        id: string;
        type: string;
        receivedAt: string;
        dueAt: string;
        status: string;
        completedAt: null;
        outcome: null;
      };
    };
    watchedValues.push(body.request.id);
    expect(body).toMatchObject({
      outcome: "received",
      request: {
        type: "access",
        status: "received",
        completedAt: null,
        outcome: null,
      },
    });
    // 0127: the earlier of 30 days and one calendar month in UTC (art. 12(3))
    expect(Date.parse(body.request.dueAt)).toBe(
      legalDeadline(Date.parse(body.request.receivedAt)),
    );

    const lines = await acknowledgementsOf(member.accountId);
    expect(lines).toEqual([
      {
        event_type: "privacy.request_received",
        destination: "brevo_transactional",
        priority: 100,
        payload: {
          event_id: expect.any(String),
          account_id: member.accountId,
          request_id: body.request.id,
          email_code: "privacy.request_received",
        },
        idempotency_key: `privacy.request_received:${body.request.id}`,
      },
    ]);
    // nothing is executed: no export, no deletion; the account is untouched
    const [account] = await migration<{ status: string }[]>`
      select status::text from identity.accounts where id = ${member.accountId}`;
    expect(account?.status).toBe("active");

    // the screen reads it back
    expect(
      (await call(server, "GET", "/v1/me/data-requests", member)).json(),
    ).toEqual({ requests: [body.request] });

    // the marker was consumed (single use): a second deposit needs a new fresh code
    expect(
      errorOf(
        await call(server, "POST", "/v1/me/data-requests", member, {
          type: "access",
        }),
      ),
    ).toEqual({ status: 403, code: "reauthentication_required" });
    // with one, the open request is returned, nothing more is queued
    await reauthenticate(server, member, "data_export");
    const again = await call(server, "POST", "/v1/me/data-requests", member, {
      type: "access",
    });
    expect(again.json()).toEqual({
      outcome: "already_open",
      request: body.request,
    });
    expect(await acknowledgementsOf(member.accountId)).toHaveLength(1);
  });

  it("T1, T2 (D72): a deletion needs a fresh code for account_deletion; it is then authorised by the member alone, in one transaction", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member, "data_export");
    expect(
      errorOf(
        await call(server, "POST", "/v1/me/data-requests", member, {
          type: "erasure",
        }),
      ),
    ).toEqual({ status: 403, code: "reauthentication_required" });
    expect(await erasureFactsOf(member.accountId)).toEqual({
      requests: [],
      executions: [],
      dualControls: 0,
    });

    await reauthenticate(server, member, "account_deletion");
    const deposited = await call(
      server,
      "POST",
      "/v1/me/data-requests",
      member,
      { type: "erasure" },
    );
    expect(deposited.statusCode).toBe(200);
    const body = deposited.json() as {
      outcome: string;
      requestId: string;
      status: string;
    };
    expect(body).toEqual({
      outcome: "erasure_authorised",
      requestId: expect.any(String),
      status: "in_progress",
    });
    // the cookie is cleared as "fermer toutes les sessions" does
    const cookie = String(deposited.headers["set-cookie"]);
    expect(cookie).toContain("__Host-influx-session=;");
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    // every session of the account is closed, this one included
    expect(
      (await call(server, "GET", "/v1/me/sessions", member)).statusCode,
    ).toBe(401);
    // the facts: in progress, self-service, authorised by the member, no 2V, no approval
    expect(await erasureFactsOf(member.accountId)).toEqual({
      requests: [
        {
          id: body.requestId,
          status: "in_progress",
          channel: "self_service",
        },
      ],
      executions: [
        {
          request_id: body.requestId,
          authorised_by: "member_fresh_code",
          approved_by_account_id: null,
          dual_control_request_id: null,
          executed_at: null,
        },
      ],
      dualControls: 0,
    });
    expect(await registerOf(body.requestId)).toEqual([
      "privacy.request_received",
      "privacy.execution_authorised_by_member",
    ]);
    // no acknowledgement for an erasure: it would say that nothing is deleted automatically
    expect(await acknowledgementsOf(member.accountId)).toEqual([]);
  });

  it("T2: a code already consumed leaves nothing to create; an open erasure is returned as it is", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member, "account_deletion");
    const first = await call(server, "POST", "/v1/me/data-requests", member, {
      type: "erasure",
    });
    expect(first.json()).toMatchObject({ outcome: "erasure_authorised" });
    const requestId = (first.json() as { requestId: string }).requestId;

    // another session of the account (the first ones are closed): no fresh code, nothing created
    const token = randomBytes(32);
    await migration`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${createHash("sha256").update(token).digest()}, ${member.accountId}, 'member', null,
              'safari.ios')`;
    const other: Member = { ...member, session: token.toString("base64url") };
    watchedValues.push(other.session);
    expect(
      errorOf(
        await call(server, "POST", "/v1/me/data-requests", other, {
          type: "erasure",
        }),
      ),
    ).toEqual({ status: 403, code: "reauthentication_required" });

    // with a fresh code: the request still open is returned, nothing else written
    await reauthenticate(server, other, "account_deletion");
    const again = await call(server, "POST", "/v1/me/data-requests", other, {
      type: "erasure",
    });
    expect(again.json()).toEqual({
      outcome: "erasure_authorised",
      requestId,
      status: "in_progress",
    });
    const facts = await erasureFactsOf(member.accountId);
    expect(facts.requests).toHaveLength(1);
    expect(facts.executions).toHaveLength(1);
    expect(await registerOf(requestId)).toEqual([
      "privacy.request_received",
      "privacy.execution_authorised_by_member",
    ]);
  });

  it("A3: a member who has not accepted the terms in force still exercises these rights (the change of address stays gated)", async () => {
    const server = app();
    const member = await newMember({ termsAccepted: false });
    expect(
      errorOf(
        await call(
          server,
          "POST",
          "/v1/me/reauthenticate/request-code",
          member,
          { purpose: "email_change" },
        ),
      ),
    ).toEqual({ status: 403, code: "terms_acceptance_required" });
    expect(
      (await call(server, "GET", "/v1/me/data-requests", member)).statusCode,
    ).toBe(200);
    await reauthenticate(server, member, "account_deletion");
    const deposited = await call(
      server,
      "POST",
      "/v1/me/data-requests",
      member,
      { type: "erasure" },
    );
    expect(deposited.json()).toMatchObject({ outcome: "erasure_authorised" });
  });

  it("T14: a member never reads another's requests; no session, 401; another type, 400", async () => {
    const server = app();
    const owner = await newMember();
    const stranger = await newMember();
    await reauthenticate(server, owner, "data_export");
    await call(server, "POST", "/v1/me/data-requests", owner, {
      type: "access",
    });
    expect(
      (await call(server, "GET", "/v1/me/data-requests", stranger)).json(),
    ).toEqual({ requests: [] });
    expect(
      (await call(server, "GET", "/v1/me/data-requests", null)).statusCode,
    ).toBe(401);
    expect(
      (
        await call(server, "POST", "/v1/me/data-requests", owner, {
          type: "rectification",
        })
      ).statusCode,
    ).toBe(400);
  });
});

// --- The rescue channel -------------------------------------------------------------------------------

type ReportRow = {
  login_email: string;
  contact_email: string;
  message: string | null;
  locale: string;
  status: string;
};

async function reportsFor(loginEmail: string): Promise<ReportRow[]> {
  return localSuperuser()<ReportRow[]>`
    select login_email, contact_email, message, locale::text as locale, status::text as status
      from backoffice.code_delivery_reports
     where login_email = ${loginEmail}
     order by received_at`;
}

function report(
  server: Server,
  body: Record<string, unknown>,
  extra: Record<string, string> = {},
) {
  return call(
    server,
    "POST",
    "/v1/support/code-not-received",
    null,
    body,
    extra,
  );
}

describe("POST /v1/support/code-not-received (05 RG65, CA26; 18 T15; decision 6)", () => {
  it("CA26: a report reaches the queue; the same answer for a member's address and an unknown one; never a code, a session nor an e-mail", async () => {
    const server = app();
    const member = await newMember();
    const unknown = newAddress("unknown");
    const contact = newAddress("contact");
    const message = "Rien reçu\u0007 depuis hier.\nMerci";
    watchedValues.push("Rien reçu");
    const answers: LightMyRequestResponse[] = [];
    for (const loginEmail of [member.email, unknown]) {
      const requestId = randomUUID();
      const answer = await report(
        server,
        { loginEmail, contactEmail: contact, message, locale: "fr" },
        { "x-request-id": requestId },
      );
      answers.push(answer);
      const [audit] = await migration<
        { event_type: string; subject_type: string; subject_id: string }[]
      >`
        select event_type, subject_type, subject_id::text from audit.audit_events
         where request_id = ${requestId}`;
      expect(audit).toMatchObject({
        event_type: "elevated.support.report_delivery_issue",
        subject_type: "code_delivery_report",
      });
    }
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);
    expect(answers.map((answer) => answer.body)).toEqual([
      '{"outcome":"received"}',
      '{"outcome":"received"}',
    ]);
    expect(answers.map((answer) => answer.headers["set-cookie"])).toEqual([
      undefined,
      undefined,
    ]);
    expect(await reportsFor(member.email)).toEqual([
      {
        login_email: member.email,
        contact_email: contact,
        // 0120: a control character becomes a space; line feeds stay
        message: "Rien reçu  depuis hier.\nMerci",
        locale: "fr",
        status: "received",
      },
    ]);
    expect(await reportsFor(unknown)).toHaveLength(1);
    // RG65: nothing sent, no session opened, nothing journaled for the member
    expect(double.requests).toHaveLength(0);
    const [sessions] = await migration<{ count: number }[]>`
      select count(*)::int as count from identity.sessions
       where account_id = ${member.accountId}`;
    expect(sessions?.count).toBe(1);
    const [sends] = await migration<{ count: number }[]>`
      select count(*)::int as count from leads.transactional_sends
       where account_id = ${member.accountId}`;
    expect(sends?.count).toBe(0);
  });

  it("answers after the floor of 1 000 ms, a malformed body included (400)", async () => {
    const server = app({ reportFloorMs: 1_000 });
    const started = performance.now();
    const malformed = await report(server, {
      loginEmail: "not an address",
      contactEmail: newAddress("contact"),
      locale: "fr",
    });
    expect(malformed.statusCode).toBe(400);
    expect(performance.now() - started).toBeGreaterThanOrEqual(990);
  });

  it("T15.4: three reports per sign-in address and hour; beyond, the same answer and nothing written", async () => {
    const server = app();
    const loginEmail = newAddress("flooded");
    const answers: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      // a new network each time: only the address's counter can stop it
      const answer = await report(
        server,
        { loginEmail, contactEmail: newAddress("contact"), locale: "en" },
        { "x-real-ip": newClientAddress() },
      );
      answers.push(answer.statusCode);
      expect(answer.json()).toEqual({ outcome: "received" });
    }
    expect(answers).toEqual([200, 200, 200, 200]);
    expect(await reportsFor(loginEmail)).toHaveLength(3);
  });

  it("T15.1, T15.4: five reports per network and hour, then 429 rate_limited, whatever the addresses", async () => {
    const server = app();
    const network = newClientAddress();
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const answer = await report(
        server,
        {
          loginEmail: newAddress("network"),
          contactEmail: newAddress("contact"),
          locale: "fr",
        },
        { "x-real-ip": network },
      );
      statuses.push(answer.statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe("D60, C-1: no address, message, request id nor session in a log line", () => {
  it("searches every log stream of this file by value", () => {
    expect(logStreams.length).toBeGreaterThan(0);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
