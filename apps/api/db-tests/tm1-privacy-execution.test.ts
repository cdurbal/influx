// TM1 (J8, commit 8) — the minimal execution of the "mes données" requests, end to end on the local
// stack (21 §J8 point 6; 15 RG75 to RG85; 04 §9.2; runbook demandes-rgpd §4 to §6; 03 P7 E-5;
// migrations 0136, 0137): an admin approves from the account record under 2V + R (two admins: the
// peer form), the worker executes on ITS OWN pool (influx_privacy_login, never influx_worker_login),
// the member downloads the export with a fresh code each time (3 at most), the request closes only
// once Brevo confirmed. The SQL rules themselves are t8-privacy-execution's; here, the routes, the
// executor of apps/api and their seams. The drain is simulated by the migration role (the queue
// lines are settled as the drain would); GoTrue is an in-memory directory. Fixtures are COMMITTED by
// the migration role (random identifiers, disposable local stack); queue lines are removed and the
// internal profiles deactivated after the file.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  createWorkerDatabase,
  type ApiDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import {
  createPrivacyExecutor,
  readErasureNotificationSubjectOf,
} from "../src/domains/privacy/execution.ts";
import { DATA_EXPORT_CATEGORIES } from "../src/domains/privacy/notice.ts";
import type { GoTrueFailure, GoTrueOutcome } from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

let api: ApiDatabase;
let worker: WorkerDatabase;
const internals: string[] = [];
const members: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];
const executorLogs: string[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer | string): Buffer {
  return createHash("sha256").update(bytes).digest();
}

// --- GoTrue: the deletion of an erased account's user, in memory ---------------------------------

let deletedAuthUsers: string[] = [];
let gotrueAnswer: GoTrueFailure | null = null;

const directory = {
  async deleteUser(userId: string): Promise<GoTrueOutcome<null>> {
    if (gotrueAnswer !== null) {
      return gotrueAnswer;
    }
    deletedAuthUsers.push(userId);
    return { ok: true, value: null };
  },
};

function executor() {
  const write =
    (level: string) =>
    (object: object, message: string): void => {
      executorLogs.push(`${level} ${message} ${JSON.stringify(object)}`);
    };
  return createPrivacyExecutor({
    database: worker,
    directory,
    logger: { info: write("info"), warn: write("warn"), error: write("error") },
  });
}

async function tick(): Promise<void> {
  await executor().tick(new AbortController().signal);
}

// --- Accounts and sessions -------------------------------------------------------------------------

type Internal = { accountId: string; session: string };

async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const email = `tm1-privacy-${role}-${accountId}@example.test`;
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', 'Camille', true, now(),
              'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, 'Camille', now(), now(), ${randomUUID()})`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')`;
  });
  internals.push(accountId);
  return { accountId, session: token.toString("base64url") };
}

type Member = {
  accountId: string;
  authUserId: string;
  email: string;
  session: string;
  sessionId: string;
};

async function newMember(role: "advertiser" | "creator"): Promise<Member> {
  const accountId = randomUUID();
  const authUserId = randomUUID();
  const email = `tm1-privacy-member-${accountId}@example.test`;
  const token = randomBytes(32);
  const sessionId = await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${authUserId}, ${email}, now(), 'FR', 'fr', true, now(),
              ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    if (role === "advertiser") {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
    }
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
      values (${accountId}, 'marketing_email', true, 'signup_form', now())`;
    const [row] = await tx<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')
      returning id::text`;
    return row?.id ?? "";
  });
  members.push(accountId);
  const session = token.toString("base64url");
  watchedValues.push(email, session);
  return { accountId, authUserId, email, session, sessionId };
}

/** The fresh code of decision 4 of J7, as verify-code writes it (0118): the marker of a purpose. */
async function freshCode(
  member: Member,
  purpose: "data_export" | "account_deletion" = "data_export",
): Promise<void> {
  await migrationRole().begin(async (tx) => {
    await tx`alter table identity.sessions disable trigger sessions_guard_update`;
    await tx`
      update identity.sessions
         set reauthenticated_at = now(), reauth_purpose = ${purpose}
       where id = ${member.sessionId}`;
    await tx`alter table identity.sessions enable trigger sessions_guard_update`;
  });
}

/** A request deposited from the space (0120: the trigger dates it). */
async function deposit(
  member: Member,
  type: "access" | "erasure",
): Promise<string> {
  const [row] = await migrationRole()<{ id: string }[]>`
    insert into backoffice.data_subject_requests (request_type, requester_account_id)
    values (${type}::backoffice.data_request_type, ${member.accountId})
    returning id::text`;
  if (row === undefined) {
    throw new Error("no request deposited");
  }
  return row.id;
}

// --- Calls -----------------------------------------------------------------------------------------

function app() {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database: api,
  });
}

type Server = ReturnType<typeof app>;

function backoffice(
  server: Server,
  method: "GET" | "POST",
  url: string,
  internal: Internal,
  body?: object,
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      cookie: `__Host-influx-ops-session=${internal.session}`,
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

function web(
  server: Server,
  method: "GET" | "POST",
  url: string,
  member: Member | null,
  body?: unknown,
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      "x-real-ip": "2001:db8:5::7",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(member === null
        ? {}
        : { cookie: `__Host-influx-session=${member.session}` }),
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

function errorOf(response: LightMyRequestResponse) {
  const { error } = response.json<{ error: { code: string } }>();
  return { status: response.statusCode, code: error.code };
}

/** 15 RG75 step 6: requested by one admin, confirmed by the other (PD7: the peer form). */
async function approve(
  server: Server,
  requestId: string,
  requestType: "access" | "erasure",
): Promise<void> {
  const requested = await backoffice(
    server,
    "POST",
    "/v1/bo/dual-control",
    adminA,
    {
      code: "privacy.approve_data_request",
      requestId,
      requestType,
      reasonCode: "request_instructed",
    },
  );
  expect(requested.statusCode).toBe(200);
  const view = requested.json<{ id: string; target: unknown }>();
  // J8S-2 (PD1): the member account of the request, never an identifier alone nor its address
  const [owner] = await migrationRole()<{ account_id: string }[]>`
    select requester_account_id::text as account_id
      from backoffice.data_subject_requests where id = ${requestId}`;
  expect(view.target).toMatchObject({
    kind: "member_account",
    accountId: owner?.account_id,
  });
  expect(requested.body).not.toContain("@");
  const confirmed = await backoffice(
    server,
    "POST",
    `/v1/bo/dual-control/${view.id}/confirm`,
    adminB,
    {},
  );
  expect(confirmed.statusCode).toBe(200);
  expect(confirmed.json()).toEqual({ mode: "peer", reevaluated: null });
}

type Line = {
  id: string;
  event_type: string;
  destination: string;
  priority: number;
  status: string;
  payload: Record<string, unknown>;
};

async function linesOf(accountId: string, eventType: string): Promise<Line[]> {
  return migrationRole()<Line[]>`
    select id::text as id, event_type, destination::text as destination, priority,
           status::text as status, payload
      from leads.outbox_events
     where subject_key = ${`account:${accountId}`} and event_type = ${eventType}
     order by id`;
}

/** What the drain would write at the end of an attempt (0111). */
async function settle(
  lineId: string,
  outcome:
    | { status: "succeeded"; dryRun?: boolean; messageId?: string }
    | { status: "skipped"; reason: string },
): Promise<void> {
  if (outcome.status === "succeeded") {
    await migrationRole()`
      update leads.outbox_events
         set status = 'succeeded', attempts = 1, completed_at = now(),
             dry_run = ${outcome.dryRun ?? false},
             provider_message_id = ${outcome.messageId ?? null}
       where id = ${lineId}::bigint`;
  } else {
    await migrationRole()`
      update leads.outbox_events
         set status = 'skipped', attempts = 1, completed_at = now(),
             skip_reason = ${outcome.reason}
       where id = ${lineId}::bigint`;
  }
}

async function requestOf(requestId: string) {
  const [row] = await migrationRole()<
    {
      status: string;
      outcome_code: string | null;
      completed_at: string | null;
    }[]
  >`
    select status::text as status, outcome_code::text as outcome_code,
           completed_at::text as completed_at
      from backoffice.data_subject_requests where id = ${requestId}`;
  return row;
}

async function registerCodes(subjectId: string): Promise<string[]> {
  const rows = await migrationRole()<{ event_type: string }[]>`
    select event_type from audit.audit_events where subject_id = ${subjectId} order by seq`;
  return rows.map((row) => row.event_type);
}

let agent: Internal;
let adminA: Internal;
let adminB: Internal;

beforeAll(async () => {
  const silent = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  api = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    silent,
  );
  worker = createWorkerDatabase(
    {
      worker: localConnection("influx_worker_login"),
      privacy: localConnection("influx_privacy_login"),
    },
    silent,
  );
  agent = await newInternal("agent");
  adminA = await newInternal("admin");
  adminB = await newInternal("admin");
});

beforeEach(() => {
  deletedAuthUsers = [];
  gotrueAnswer = null;
});

afterAll(async () => {
  await closeDatabase(api);
  await closeDatabase(worker);
  if (members.length > 0) {
    await migrationRole()`
      delete from leads.outbox_events
       where subject_key = any (${members.map((id) => `account:${id}`)}::text[])`;
  }
  if (internals.length > 0) {
    await migrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------------

describe("access: approved under 2V + R, exported by the worker, downloaded in the space (runbook §4)", () => {
  it("goes from the record to three downloads, then closes once Brevo sent the e-mail", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await deposit(member, "access");

    // the record shows the request, not yet approved; an agent never approves (15 RG76)
    const record = await backoffice(
      server,
      "GET",
      `/v1/bo/accounts/${member.accountId}`,
      agent,
    );
    expect(record.json<{ dataRequests: unknown[] }>().dataRequests).toEqual([
      expect.objectContaining({
        id: requestId,
        type: "access",
        status: "received",
        execution: null,
        export: null,
      }),
    ]);
    const refused = await backoffice(
      server,
      "POST",
      "/v1/bo/dual-control",
      agent,
      {
        code: "privacy.approve_data_request",
        requestId,
        requestType: "access",
        reasonCode: "request_instructed",
      },
    );
    expect(errorOf(refused)).toEqual({ status: 403, code: "forbidden" });

    // PD1: the recap says what the action does, before the first gesture
    const requested = await backoffice(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA,
      {
        code: "privacy.approve_data_request",
        requestId,
        requestType: "erasure",
        reasonCode: "request_instructed",
      },
    );
    expect(errorOf(requested)).toEqual({ status: 404, code: "not_found" });
    await approve(server, requestId, "access");
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });
    const again = await backoffice(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA,
      {
        code: "privacy.approve_data_request",
        requestId,
        requestType: "access",
        reasonCode: "request_instructed",
      },
    );
    expect(errorOf(again)).toEqual({ status: 404, code: "not_found" });

    // nothing is exported before the worker runs it; then once
    expect(
      (await web(server, "GET", "/v1/me/data-export", member)).json(),
    ).toEqual({
      export: null,
    });
    await tick();
    await tick();
    const [ready, ...others] = await linesOf(
      member.accountId,
      "privacy.export_ready",
    );
    expect(others).toEqual([]);
    expect(ready).toMatchObject({
      destination: "brevo_transactional",
      priority: 100,
      status: "pending",
    });
    expect(await registerCodes(requestId)).toEqual(
      expect.arrayContaining([
        "privacy.execution_approved",
        "privacy.export_published",
        "elevated.privacy.execute_request",
      ]),
    );

    const state = await web(server, "GET", "/v1/me/data-export", member);
    expect(state.statusCode).toBe(200);
    const exported = state.json<{
      export: {
        id: string;
        requestId: string;
        downloadsLeft: number;
        available: boolean;
      };
    }>().export;
    expect(exported).toMatchObject({
      requestId,
      downloadsLeft: 3,
      available: true,
    });
    const download = `/v1/me/data-export/${exported.id}/download`;

    // a fresh code for EACH download (05 RG57)
    expect(errorOf(await web(server, "POST", download, member))).toEqual({
      status: 403,
      code: "reauthentication_required",
    });
    await freshCode(member);
    const first = await web(server, "POST", download, member);
    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    expect(first.headers["x-content-type-options"]).toBe("nosniff");
    expect(first.headers["content-disposition"]).toMatch(
      /^attachment; filename="influx-data-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const file = first.json<{
      export: {
        content: string;
        sha256: string;
        sizeBytes: number;
        downloadsLeft: number;
      };
    }>().export;
    expect(sha256(file.content).toString("hex")).toBe(file.sha256);
    expect(Buffer.byteLength(file.content, "utf8")).toBe(file.sizeBytes);
    expect(file.downloadsLeft).toBe(2);
    const document = JSON.parse(file.content) as {
      categories: string[];
      notice: { language: string; categories: Record<string, unknown> };
      data: Record<string, unknown>;
    };
    expect(document.categories).toEqual([...DATA_EXPORT_CATEGORIES]);
    expect(Object.keys(document.data).sort()).toEqual(
      [...DATA_EXPORT_CATEGORIES].sort(),
    );
    expect(document.notice.language).toBe("fr");
    // jsonb orders the keys of the stored notice its own way (EC-J8-48): the same 14 categories
    expect(Object.keys(document.notice.categories).sort()).toEqual(
      [...DATA_EXPORT_CATEGORIES].sort(),
    );
    expect(file.content).toContain(member.email);
    expect(errorOf(await web(server, "POST", download, member))).toEqual({
      status: 403,
      code: "reauthentication_required",
    });

    // another member never reaches it (18 T14.3): the 404 of an unknown export
    const other = await newMember("creator");
    await freshCode(other);
    expect(errorOf(await web(server, "POST", download, other))).toEqual({
      status: 404,
      code: "not_found",
    });

    for (const left of [1, 0]) {
      await freshCode(member);
      const next = await web(server, "POST", download, member);
      expect(
        next.json<{ export: { downloadsLeft: number } }>().export.downloadsLeft,
      ).toBe(left);
    }
    await freshCode(member);
    expect(errorOf(await web(server, "POST", download, member))).toEqual({
      status: 410,
      code: "export_unavailable",
    });
    expect(
      (await web(server, "GET", "/v1/me/data-export", member)).json<{
        export: { available: boolean };
      }>().export.available,
    ).toBe(false);

    // 15 RG79, RG85: closed once Brevo sent the e-mail, its messageId kept
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });
    await settle(ready?.id ?? "", { status: "succeeded", dryRun: true });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });
    await settle(ready?.id ?? "", {
      status: "succeeded",
      messageId: `<${randomUUID()}@smtp-relay.brevo.test>`,
    });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({
      status: "closed",
      outcome_code: "satisfaite",
    });
    const closed = await backoffice(
      server,
      "GET",
      `/v1/bo/accounts/${member.accountId}`,
      agent,
    );
    expect(closed.json<{ dataRequests: unknown[] }>().dataRequests).toEqual([
      expect.objectContaining({
        id: requestId,
        status: "closed",
        outcome: "satisfaite",
        execution: expect.objectContaining({ approvedBy: adminB.accountId }),
        export: expect.objectContaining({ downloads: 3 }),
      }),
    ]);
    expect(JSON.stringify(closed.json())).not.toContain('"content"');
  });

  it("answers 401 without a member session, on both routes (18 T14.1)", async () => {
    const server = app();
    expect(
      (await web(server, "GET", "/v1/me/data-export", null)).statusCode,
    ).toBe(401);
    expect(
      (
        await web(
          server,
          "POST",
          `/v1/me/data-export/${randomUUID()}/download`,
          null,
        )
      ).statusCode,
    ).toBe(401);
  });
});

describe("erasure: anonymised by the worker, propagated to Brevo, closed after its confirmation (04 §9.2, 15 RG79)", () => {
  it("anonymises, deletes the Auth user after the commit, and waits for Brevo before closing", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const requestId = await deposit(member, "erasure");
    await approve(server, requestId, "erasure");

    gotrueAnswer = {
      ok: false,
      reason: "unavailable",
      errorCode: null,
      status: null,
    };
    await tick();
    const [account] = await migrationRole()<
      { status: string; email: string; anonymized: boolean }[]
    >`
      select status::text as status, email, anonymized_at is not null as anonymized
        from identity.accounts where id = ${member.accountId}`;
    expect(account).toEqual({
      status: "deleted",
      email: `deleted+${member.accountId}@invalid`,
      anonymized: true,
    });
    const [{ sessions } = { sessions: -1 }] = await migrationRole()<
      { sessions: number }[]
    >`
      select count(*)::int as sessions from identity.sessions where account_id = ${member.accountId}`;
    expect(sessions).toBe(0);
    expect(
      (await web(server, "GET", "/v1/me/data-export", member)).statusCode,
    ).toBe(401);
    const deleted = await linesOf(member.accountId, "account.deleted");
    expect(
      deleted.map((line) => [line.destination, line.priority]).sort(),
    ).toEqual([
      ["apollo_contact", 0],
      ["brevo_contact", 0],
    ]);
    expect(deletedAuthUsers).toEqual([]);

    // GoTrue unavailable: tried again at each tick; the request never closes meanwhile
    for (const line of deleted) {
      await settle(
        line.id,
        line.destination === "brevo_contact"
          ? { status: "succeeded" }
          : { status: "skipped", reason: "erasure_not_propagated" },
      );
    }
    // D72 (0150): the confirmation e-mail is queued P1 and must leave with its messageId
    const mails = await linesOf(member.accountId, "privacy.erasure_completed");
    expect(
      mails.map((line) => [line.destination, line.priority, line.status]),
    ).toEqual([["brevo_transactional", 100, "pending"]]);
    await settle(mails[0]?.id ?? "", {
      status: "succeeded",
      messageId: "<tm1-erasure@smtp-relay.brevo.com>",
    });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });

    // a user already gone at GoTrue (404) counts as deleted
    gotrueAnswer = {
      ok: false,
      reason: "rejected",
      errorCode: "user_not_found",
      status: 404,
    };
    await tick();
    gotrueAnswer = null;
    await tick();
    expect(await requestOf(requestId)).toMatchObject({
      status: "closed",
      outcome_code: "satisfaite",
    });
    const [execution] = await migrationRole()<
      { held: string | null; deleted: boolean }[]
    >`
      select propagation_email as held, auth_user_deleted_at is not null as deleted
        from privacy.request_executions where request_id = ${requestId}`;
    expect(execution).toEqual({ held: null, deleted: true });
    expect(await registerCodes(member.accountId)).toEqual(
      expect.arrayContaining(["account.anonymized"]),
    );
  });

  it("D72 (T1, T4, T9): authorised by the member through the route, executed without an admin, answered by e-mail, closed after its messageId; the address can sign up again", async () => {
    const server = app();
    const member = await newMember("creator");
    await freshCode(member, "account_deletion");
    const deposited = await web(
      server,
      "POST",
      "/v1/me/data-requests",
      member,
      { type: "erasure" },
    );
    expect(deposited.json()).toMatchObject({
      outcome: "erasure_authorised",
      status: "in_progress",
    });
    const requestId = deposited.json<{ requestId: string }>().requestId;

    // T8: the record shows it as authorised by the member, with no approver (read-only)
    const record = await backoffice(
      server,
      "GET",
      `/v1/bo/accounts/${member.accountId}`,
      agent,
    );
    expect(record.json<{ dataRequests: unknown[] }>().dataRequests).toEqual([
      expect.objectContaining({
        id: requestId,
        type: "erasure",
        status: "in_progress",
        execution: expect.objectContaining({
          authorisedBy: "member_fresh_code",
          approvedBy: null,
          executedAt: null,
        }),
      }),
    ]);

    // the next turn of the worker erases it: no approval, no 2V
    await tick();
    const [account] = await migrationRole()<{ status: string }[]>`
      select status::text as status from identity.accounts where id = ${member.accountId}`;
    expect(account).toEqual({ status: "deleted" });
    expect(deletedAuthUsers).toEqual([member.authUserId]);
    const deleted = await linesOf(member.accountId, "account.deleted");
    expect(deleted).toHaveLength(2);

    // the answer reads the held address on the E-5 pool, in the language and zone of the account
    expect(await readErasureNotificationSubjectOf(worker, requestId)).toEqual({
      email: member.email,
      preferredLanguage: "fr",
      timeZone: "UTC",
      erasedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
    });
    // another request: nothing to answer
    expect(await readErasureNotificationSubjectOf(worker, randomUUID())).toBe(
      null,
    );

    // closed once Brevo and the answer both left
    for (const line of deleted) {
      await settle(
        line.id,
        line.destination === "brevo_contact"
          ? { status: "succeeded" }
          : { status: "skipped", reason: "erasure_not_propagated" },
      );
    }
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });
    const [mail] = await linesOf(member.accountId, "privacy.erasure_completed");
    await settle(mail?.id ?? "", {
      status: "succeeded",
      messageId: "<tm1-self-service@smtp-relay.brevo.com>",
    });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({
      status: "closed",
      outcome_code: "satisfaite",
    });
    // the address is released with the closure: nothing left to answer
    expect(await readErasureNotificationSubjectOf(worker, requestId)).toBe(
      null,
    );

    // CA31: the same address signs up again as an entirely new account
    const again = randomUUID();
    await migrationRole().begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${again}, ${randomUUID()}, ${member.email}, now(), 'FR', 'fr', true, now(),
                'individual'::identity.declared_status)`;
      await tx`
        insert into identity.account_roles (account_id, role)
        values (${again}, 'creator'::identity.account_role)`;
    });
    members.push(again);
    const [fresh] = await migrationRole()<{ id: string; status: string }[]>`
      select id::text as id, status::text as status from identity.accounts
       where email = ${member.email}`;
    expect(fresh).toEqual({ id: again, status: "active" });
    expect(again).not.toBe(member.accountId);
  });

  it("calls GoTrue with the account's Auth user, once, and never closes while Brevo has not confirmed", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await deposit(member, "erasure");
    await approve(server, requestId, "erasure");
    await tick();
    expect(deletedAuthUsers).toEqual([member.authUserId]);
    await tick();
    expect(deletedAuthUsers).toEqual([member.authUserId]);

    const deleted = await linesOf(member.accountId, "account.deleted");
    const brevo = deleted.find((line) => line.destination === "brevo_contact");
    const apollo = deleted.find(
      (line) => line.destination === "apollo_contact",
    );
    await settle(apollo?.id ?? "", {
      status: "skipped",
      reason: "erasure_not_propagated",
    });
    await settle(brevo?.id ?? "", { status: "succeeded", dryRun: true });
    const [mail] = await linesOf(member.accountId, "privacy.erasure_completed");
    await settle(mail?.id ?? "", {
      status: "succeeded",
      messageId: "<tm1-erasure@smtp-relay.brevo.com>",
    });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "in_progress" });
    await settle(brevo?.id ?? "", { status: "succeeded" });
    await tick();
    expect(await requestOf(requestId)).toMatchObject({ status: "closed" });
  });
});

describe("D60: nothing personal in the logs", () => {
  it("never logs an address nor a session", () => {
    const text = [...logStreams.map((read) => read()), ...executorLogs].join(
      "\n",
    );
    expect(valuesFoundIn(text, watchedValues)).toEqual([]);
    expect(
      executorLogs.some((line) => line.includes("privacy.request_executed")),
    ).toBe(true);
  });
});
