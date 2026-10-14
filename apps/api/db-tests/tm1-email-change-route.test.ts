// TM1 (J7, commit 7) — "mon compte" (2a) on the local stack: the re-authentication by a fresh code
// (05 RG57, RG44, RG47; 03 A-10; decision 4) and the change of address (05 RG58, 03 A-11, 16 §H,
// RG74; decision 5): CA34, the edge case of 05 §8 ("tant qu'elle n'est pas complète, l'ancienne
// adresse reste la bonne"), the answers when the new address is taken, the outages, the queue
// payloads (ids only, never an address nor a code) and the logs (searched BY VALUE, C-1, D60).
// Real database (pools of apps/api, migrations 0118 and 0123), GoTrue as an in-memory double of the
// adapter, Brevo as the double of @influx/test-kit (RG148: no test reaches Brevo). The route
// accounts are COMMITTED by the migration role (random identifiers, disposable local stack, like
// TM10); their queue lines are removed after the file.
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
import type {
  GoTrueFailure,
  GoTrueOutcome,
  SupabaseAuth,
} from "../src/platform/supabase.ts";
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

// --- GoTrue: the adapter's interface, in memory --------------------------------------------------

/** The users GoTrue holds (id → address), the pending codes, and the calls that move an address. */
class GoTrueDouble {
  readonly users = new Map<string, string>();
  readonly codes = new Map<string, string>();
  readonly updates: { userId: string; email: string }[] = [];
  /** Failures answered, in order, by the next calls of updateUserEmail. */
  readonly updateFailures: GoTrueFailure[] = [];

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
      createUser: async (email) => {
        if (this.userOf(email) !== null) {
          return rejected("email_exists", 422);
        }
        return { ok: true, value: { userId: this.add(email), email } };
      },
      getUser: async (userId) => {
        const email = this.users.get(userId);
        return email === undefined
          ? rejected("user_not_found", 404)
          : { ok: true, value: { userId, email } };
      },
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
      updateUserEmail: async (
        userId,
        email,
      ): Promise<GoTrueOutcome<{ userId: string; email: string }>> => {
        this.updates.push({ userId, email });
        const failure = this.updateFailures.shift();
        if (failure !== undefined) {
          return failure;
        }
        const holder = this.userOf(email);
        if (holder !== null && holder !== userId) {
          return rejected("email_exists", 422);
        }
        if (!this.users.has(userId)) {
          return rejected("user_not_found", 404);
        }
        this.users.set(userId, email);
        return { ok: true, value: { userId, email } };
      },
    };
  }
}

let gotrue: GoTrueDouble;

// --- Members and calls ------------------------------------------------------------------------------

type Member = {
  accountId: string;
  authUserId: string;
  email: string;
  /** Cookie values of the member's open sessions; the first one is "this browser". */
  sessions: string[];
  sessionIds: string[];
  /** The client address of every call of this member (its own /64: counters never shared). */
  clientAddress: string;
};

function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::1`;
}

function newAddress(label: string): string {
  const address = `tm1-email-${label}-${randomUUID()}@example.test`;
  watchedValues.push(address);
  return address;
}

async function newMember(
  options: { sessions?: number; language?: "fr" | "en" } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = newAddress("member");
  const authUserId = gotrue.add(email);
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${authUserId}, ${email}, now(), 'FR', ${options.language ?? "fr"},
              true, now(), 'individual'::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'creator'::identity.account_role)`;
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsInForce}, 'acceptance', 'signup', 'fr')`;
  });
  accounts.push(accountId);
  const sessions: string[] = [];
  const sessionIds: string[] = [];
  for (let index = 0; index < (options.sessions ?? 1); index += 1) {
    const token = randomBytes(32);
    const [row] = await migration<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
              'firefox.windows')
      returning id::text as id`;
    sessions.push(token.toString("base64url"));
    sessionIds.push(row?.id ?? "");
    watchedValues.push(row?.id ?? "");
  }
  return {
    accountId,
    authUserId,
    email,
    sessions,
    sessionIds,
    clientAddress: newClientAddress(),
  };
}

function app() {
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
    },
  });
}

type Server = ReturnType<typeof app>;

async function call(
  server: Server,
  method: "GET" | "POST" | "DELETE",
  url: string,
  member: Member | null,
  body?: unknown,
  session = 0,
): Promise<LightMyRequestResponse> {
  const cookie = member?.sessions[session];
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      "x-real-ip": member?.clientAddress ?? newClientAddress(),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie === undefined
        ? {}
        : { cookie: `__Host-influx-session=${cookie}` }),
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

/**
 * A signed token with one character of its signed content changed (never its last character: the
 * low bits of the final base64 character carry nothing, the signature could still match).
 */
function altered(token: string): string {
  return `${token.slice(0, 5)}${token[5] === "x" ? "y" : "x"}${token.slice(6)}`;
}

/** The six digits alone on their line, in the text of an e-mail. */
function codeOf(message: BrevoDoubleMessage | undefined): string {
  const code = /^(\d{6})$/m.exec(message?.body.textContent ?? "")?.[1];
  if (code === undefined) {
    throw new Error("no code in the e-mail");
  }
  return code;
}

/** The messages received for this address since `from`. */
function messagesTo(address: string, from = 0): BrevoDoubleMessage[] {
  return double.messages
    .slice(from)
    .filter((message) => message.body.to?.[0]?.email === address);
}

/** Request then verify a fresh code for `purpose` on the given session; the journey token. */
async function reauthenticate(
  server: Server,
  member: Member,
  purpose: "email_change" | "data_export" = "email_change",
  session = 0,
): Promise<void> {
  const from = double.messages.length;
  const asked = await call(
    server,
    "POST",
    "/v1/me/reauthenticate/request-code",
    member,
    { purpose },
    session,
  );
  expect(asked.statusCode).toBe(200);
  const { reauthToken } = asked.json() as { reauthToken: string };
  watchedValues.push(reauthToken);
  const verified = await call(
    server,
    "POST",
    "/v1/me/reauthenticate/verify-code",
    member,
    { purpose, code: codeOf(messagesTo(member.email, from)[0]), reauthToken },
    session,
  );
  expect(verified.json()).toEqual({
    outcome: "reauthenticated",
    purpose,
    validForSeconds: 300,
  });
}

type Started = { requestId: string; old: string; new: string };

/** A fresh code, then POST /v1/me/email-change; the two codes received. */
async function startChange(
  server: Server,
  member: Member,
  newEmail: string,
): Promise<Started> {
  await reauthenticate(server, member);
  const from = double.messages.length;
  const started = await call(server, "POST", "/v1/me/email-change", member, {
    newEmail,
  });
  expect(started.statusCode).toBe(200);
  const { request } = started.json() as { request: { id: string } };
  watchedValues.push(request.id);
  return {
    requestId: request.id,
    old: codeOf(messagesTo(member.email, from)[0]),
    new: codeOf(messagesTo(newEmail, from)[0]),
  };
}

async function confirm(
  server: Server,
  member: Member,
  requestId: string,
  side: "old" | "new",
  code: string,
): Promise<LightMyRequestResponse> {
  return call(server, "POST", "/v1/me/email-change/confirm", member, {
    requestId,
    side,
    code,
  });
}

async function accountEmail(accountId: string): Promise<string> {
  const [row] = await migration<{ email: string }[]>`
    select email from identity.accounts where id = ${accountId}`;
  return row?.email ?? "";
}

type RequestRow = {
  completed: boolean;
  cancel_reason: string | null;
  old_confirmed: boolean;
  new_confirmed: boolean;
  digests: boolean;
};

async function requestRow(requestId: string): Promise<RequestRow | undefined> {
  const [row] = await migration<RequestRow[]>`
    select completed_at is not null as completed, cancel_reason::text as cancel_reason,
           old_confirmed_at is not null as old_confirmed,
           new_confirmed_at is not null as new_confirmed,
           old_code_hash is not null as digests
      from identity.email_change_requests where id = ${requestId}`;
  return row;
}

type QueueLine = {
  event_type: string;
  destination: string;
  priority: number;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

async function queueLinesOf(accountId: string): Promise<QueueLine[]> {
  return migration<QueueLine[]>`
    select event_type, destination::text as destination, priority, payload, idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${accountId}`}
     order by id`;
}

/** A message id of its own: the journal holds them unique across runs (0015). */
function messageId(): string {
  return `<${randomUUID()}@smtp-relay.mailin.fr>`;
}

function errorOf(response: LightMyRequestResponse) {
  const { error } = response.json() as { error: { code: string } };
  return { status: response.statusCode, code: error.code };
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

// --- Decision 4: the fresh code -------------------------------------------------------------------

describe("POST /v1/me/reauthenticate/* (05 RG57, RG44, RG47; 03 A-10; J7 decision 4)", () => {
  it("sends a sign-in code to the SESSION's address, journaled P0 with the account; nothing of the body chooses it", async () => {
    const server = app();
    const member = await newMember();
    const intruder = newAddress("intruder");
    const refused = await call(
      server,
      "POST",
      "/v1/me/reauthenticate/request-code",
      member,
      { purpose: "email_change", email: intruder },
    );
    expect(refused.statusCode).toBe(400);
    expect(double.messages).toHaveLength(0);

    const asked = await call(
      server,
      "POST",
      "/v1/me/reauthenticate/request-code",
      member,
      { purpose: "email_change" },
    );
    expect(asked.statusCode).toBe(200);
    expect(asked.json()).toMatchObject({
      outcome: "sent",
      retryAfterSeconds: 60,
      matchingPhrase: expect.any(String),
      reauthToken: expect.any(String),
    });
    expect(double.messages.map((message) => message.body.to)).toEqual([
      [{ email: member.email }],
    ]);
    expect(double.messages[0]?.body.tags).toEqual(["auth.login_code"]);
    const journal = await migration<
      { email_code: string; priority: string; account_id: string | null }[]
    >`
      select email_code, priority::text as priority, account_id::text as account_id
        from leads.transactional_sends
       where account_id = ${member.accountId}`;
    expect(journal).toEqual([
      {
        email_code: "auth.login_code",
        priority: "p0",
        account_id: member.accountId,
      },
    ]);
    const register = await migration<{ event_type: string }[]>`
      select event_type from audit.audit_events where subject_id = ${member.accountId}`;
    expect(register.map((line) => line.event_type)).toContain(
      "elevated.identity.member_reauthenticate",
    );
  });

  it("the right code marks THIS session for THIS purpose; another session stays unmarked", async () => {
    const server = app();
    const member = await newMember({ sessions: 2 });
    await reauthenticate(server, member, "email_change");
    const marks = await migration<
      { id: string; purpose: string | null; fresh: boolean }[]
    >`
      select id::text as id, reauth_purpose::text as purpose,
             reauthenticated_at > now() - interval '1 minute' as fresh
        from identity.sessions where account_id = ${member.accountId} order by created_at, id`;
    const byId = new Map(marks.map((mark) => [mark.id, mark]));
    expect(byId.get(member.sessionIds[0] ?? "")).toMatchObject({
      purpose: "email_change",
      fresh: true,
    });
    expect(byId.get(member.sessionIds[1] ?? "")?.purpose).toBeNull();
  });

  it("a journey of another session or another purpose is lost; a wrong code counts; ten minutes end it", async () => {
    const server = app();
    const member = await newMember({ sessions: 2 });
    const asked = await call(
      server,
      "POST",
      "/v1/me/reauthenticate/request-code",
      member,
      { purpose: "email_change" },
    );
    const { reauthToken } = asked.json() as { reauthToken: string };
    watchedValues.push(reauthToken);
    const code = codeOf(messagesTo(member.email)[0]);
    const verify = (body: Record<string, unknown>, session = 0) =>
      call(
        server,
        "POST",
        "/v1/me/reauthenticate/verify-code",
        member,
        { purpose: "email_change", code, reauthToken, ...body },
        session,
      );
    expect((await verify({}, 1)).json()).toEqual({ outcome: "session_lost" });
    expect((await verify({ purpose: "data_export" })).json()).toEqual({
      outcome: "session_lost",
    });
    expect(
      (await verify({ reauthToken: altered(reauthToken) })).json(),
    ).toEqual({ outcome: "session_lost" });
    const wrong = code === "000000" ? "000001" : "000000";
    expect((await verify({ code: wrong })).json()).toEqual({
      outcome: "invalid",
      attemptsLeft: 4,
    });
    // the right code still works after a wrong one (five attempts per code, RG42)
    expect((await verify({})).json()).toMatchObject({
      outcome: "reauthenticated",
    });
  });

  it("without a member session: 401, nothing sent", async () => {
    const server = app();
    const response = await call(
      server,
      "POST",
      "/v1/me/reauthenticate/request-code",
      null,
      { purpose: "email_change" },
    );
    expect(errorOf(response)).toEqual({ status: 401, code: "unauthenticated" });
    expect(double.messages).toHaveLength(0);
  });
});

// --- Decision 5: the change of address ------------------------------------------------------------

describe("POST /v1/me/email-change: behind a fresh code for this action only (RG57, A-10)", () => {
  it("without a fresh code, or with one for another action: 403 reauthentication_required, nothing recorded, nothing sent", async () => {
    const server = app();
    const member = await newMember();
    const newEmail = newAddress("new");
    const bare = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail,
    });
    expect(errorOf(bare)).toEqual({
      status: 403,
      code: "reauthentication_required",
    });
    await reauthenticate(server, member, "data_export");
    const from = double.messages.length;
    const other = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail,
    });
    expect(errorOf(other)).toEqual({
      status: 403,
      code: "reauthentication_required",
    });
    expect(double.messages.slice(from)).toHaveLength(0);
    const [count] = await migration<{ count: number }[]>`
      select count(*)::int as count from identity.email_change_requests
       where account_id = ${member.accountId}`;
    expect(count?.count).toBe(0);
  });

  it("the current address itself: 400, and the fresh code stays usable (refused before it is consumed)", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member);
    const same = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail: member.email.toUpperCase(),
    });
    expect(same.statusCode).toBe(400);
    expect(
      (same.json() as { error: { details: unknown } }).error.details,
    ).toEqual([{ path: "newEmail", issue: "same_as_current" }]);
    const newEmail = newAddress("new");
    const started = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail,
    });
    expect(started.statusCode).toBe(200);
    // single use: a second request needs a second fresh code
    const again = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail: newAddress("again"),
    });
    expect(errorOf(again).code).toBe("reauthentication_required");
  });
});

describe("05 CA34, RG58, A-11: a code to each address, and the old one stays the sign-in address until both are typed", () => {
  it("CA34 from end to end: two codes, the old address until the second, then the change, the notices and email.changed", async () => {
    const server = app();
    const member = await newMember({ sessions: 3 });
    const newEmail = newAddress("new");
    const from = double.messages.length;
    const started = await startChange(server, member, newEmail);

    // one e-mail per side, synchronous, keyed by the request and the side; no address in the body
    // (the fresh code of startChange is the first message: auth.login_code)
    const sent = double.messages
      .slice(from)
      .filter((message) => message.body.tags?.[0] !== "auth.login_code");
    expect(
      sent.map((message) => [message.body.to?.[0]?.email, message.body.tags]),
    ).toEqual([
      [member.email, ["auth.email_change_confirm_old"]],
      [newEmail, ["auth.email_change_confirm_new"]],
    ]);
    expect(sent.map((message) => message.headers["idempotency-key"])).toEqual([
      `auth.email_change_confirm_old:${started.requestId}`,
      `auth.email_change_confirm_new:${started.requestId}`,
    ]);
    for (const message of sent) {
      expect(
        `${message.body.textContent} ${message.body.htmlContent}`,
      ).not.toContain("@");
    }
    // the journal: P1, the old side with its account, the new side with its address only
    const journal = await migration<
      {
        email_code: string;
        priority: string;
        account_id: string | null;
        recipient_email: string | null;
        status: string;
      }[]
    >`
      select email_code, priority::text as priority, account_id::text as account_id,
             recipient_email, status::text as status
        from leads.transactional_sends
       where email_code like 'auth.email_change_confirm_%'
         and (account_id = ${member.accountId} or recipient_email = ${newEmail})
       order by id`;
    expect(journal).toEqual([
      {
        email_code: "auth.email_change_confirm_old",
        priority: "p1",
        account_id: member.accountId,
        recipient_email: null,
        status: "sent",
      },
      {
        email_code: "auth.email_change_confirm_new",
        priority: "p1",
        account_id: null,
        recipient_email: newEmail,
        status: "sent",
      },
    ]);

    // GET: "en attente de confirmation : 0 sur 2"
    const pending = await call(server, "GET", "/v1/me/email-change", member);
    expect(pending.json()).toEqual({
      request: {
        id: started.requestId,
        newEmail,
        expiresAt: expect.any(String),
        oldConfirmed: false,
        newConfirmed: false,
      },
    });
    const { request } = pending.json() as { request: { expiresAt: string } };
    const lifetimeHours =
      (Date.parse(request.expiresAt) - Date.now()) / 3_600_000;
    expect(lifetimeHours).toBeGreaterThan(23.9);
    expect(lifetimeHours).toBeLessThanOrEqual(24);

    // the old side: confirmed, 1 of 2; nothing changes anywhere (CA34)
    const first = await confirm(
      server,
      member,
      started.requestId,
      "old",
      started.old,
    );
    expect(first.json()).toMatchObject({
      outcome: "confirmed",
      request: { oldConfirmed: true, newConfirmed: false },
    });
    expect(await accountEmail(member.accountId)).toBe(member.email);
    expect(gotrue.users.get(member.authUserId)).toBe(member.email);
    expect(gotrue.updates).toEqual([]);
    expect(
      (await queueLinesOf(member.accountId)).filter(
        (line) => line.event_type === "email.changed",
      ),
    ).toEqual([]);
    // CA34: the sign-in still goes by the old address: its code request is the account's
    const login = await call(server, "POST", "/v1/auth/request-code", null, {
      email: member.email,
      locale: "fr",
    });
    expect(login.json()).toMatchObject({ outcome: "sent" });
    const [loginLine] = await migration<{ account_id: string | null }[]>`
      select account_id::text as account_id from leads.transactional_sends
       where email_code = 'auth.login_code' and account_id = ${member.accountId}
       order by id desc limit 1`;
    expect(loginLine?.account_id).toBe(member.accountId);
    // a code of one side never confirms the other (bound to the request AND the side)
    const crossed = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.old,
    );
    expect(crossed.json()).toEqual({ outcome: "invalid", attemptsLeft: 4 });

    // the new side: the change takes effect
    const second = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(second.json()).toEqual({ outcome: "completed" });
    expect(await accountEmail(member.accountId)).toBe(newEmail);
    expect(gotrue.users.get(member.authUserId)).toBe(newEmail);
    expect(await requestRow(started.requestId)).toEqual({
      completed: true,
      cancel_reason: null,
      old_confirmed: true,
      new_confirmed: true,
      digests: false,
    });
    // every other session is revoked (email_changed), this one is kept
    const sessions = await migration<
      { id: string; revocation_reason: string | null }[]
    >`
      select id::text as id, revocation_reason::text as revocation_reason
        from identity.sessions where account_id = ${member.accountId}`;
    expect(
      sessions
        .map((session) => [
          session.id === member.sessionIds[0],
          session.revocation_reason,
        ])
        .sort(),
    ).toEqual([
      [false, "email_changed"],
      [false, "email_changed"],
      [true, null],
    ]);
    const me = await call(server, "GET", "/v1/me", member);
    expect((me.json() as { email: string }).email).toBe(newEmail);
    const gone = await call(server, "GET", "/v1/me", member, undefined, 1);
    expect(gone.statusCode).toBe(401);

    // RG58, RG73, RG74: email.changed to Brevo and Apollo, both notices; identifiers only
    const lines = (await queueLinesOf(member.accountId)).filter(
      (line) => line.event_type === "email.changed",
    );
    expect(
      lines.map((line) => [
        line.destination,
        line.priority,
        line.payload.email_code ?? null,
        line.payload.recipient ?? null,
      ]),
    ).toEqual([
      ["brevo_contact", 100, null, null],
      ["apollo_contact", 100, null, null],
      ["brevo_transactional", 0, "auth.email_changed_notice", "previous"],
      ["brevo_transactional", 0, "auth.email_changed_notice", "current"],
    ]);
    for (const line of lines) {
      expect(line.payload.request_id).toBe(started.requestId);
      const text = JSON.stringify(line.payload);
      expect(text).not.toContain("@");
      expect(text).not.toContain(started.old);
      expect(text).not.toContain(started.new);
      expect(Object.keys(line.payload).sort()).toEqual(
        line.destination === "brevo_transactional"
          ? ["account_id", "email_code", "event_id", "recipient", "request_id"]
          : ["account_id", "event_id", "request_id"],
      );
    }
    const register = await migration<{ event_type: string }[]>`
      select event_type from audit.audit_events where subject_id = ${member.accountId}`;
    expect(register.map((line) => line.event_type)).toEqual(
      expect.arrayContaining([
        "elevated.identity.member_email_change",
        "email.changed",
      ]),
    );
    expect(await requestRow(started.requestId)).toMatchObject({
      completed: true,
    });
    // the request is closed: no code works on it any more
    const late = await confirm(
      server,
      member,
      started.requestId,
      "old",
      started.old,
    );
    expect(errorOf(late)).toEqual({ status: 404, code: "not_found" });
  });

  it("05 §8: 24 hours without both confirmations, the request expires and the old address stays", async () => {
    const server = app();
    const member = await newMember();
    const newEmail = newAddress("new");
    const started = await startChange(server, member, newEmail);
    await confirm(server, member, started.requestId, "old", started.old);
    // a day goes by (the local superuser only: the request's dates are written by the database)
    const superuser = localSuperuser();
    try {
      await superuser.begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          update identity.email_change_requests
             set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
           where id = ${started.requestId}`;
      });
    } finally {
      await superuser.end({ timeout: 1 });
    }
    const late = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(late.json()).toEqual({ outcome: "expired" });
    expect(await requestRow(started.requestId)).toMatchObject({
      completed: false,
      cancel_reason: "expired",
      digests: false,
    });
    expect(await accountEmail(member.accountId)).toBe(member.email);
    expect(gotrue.updates).toEqual([]);
    expect(
      (await call(server, "GET", "/v1/me/email-change", member)).json(),
    ).toEqual({
      request: null,
    });
  });

  it("five wrong codes on one side close the request (5 attempts per side, decision 5)", async () => {
    const server = app();
    const member = await newMember();
    const started = await startChange(server, member, newAddress("new"));
    const wrong = started.old === "000000" ? "000001" : "000000";
    const answers = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      answers.push(
        (await confirm(server, member, started.requestId, "old", wrong)).json(),
      );
    }
    expect(answers).toEqual([
      { outcome: "invalid", attemptsLeft: 4 },
      { outcome: "invalid", attemptsLeft: 3 },
      { outcome: "invalid", attemptsLeft: 2 },
      { outcome: "invalid", attemptsLeft: 1 },
      { outcome: "too_many_attempts" },
    ]);
    expect(await requestRow(started.requestId)).toMatchObject({
      cancel_reason: "too_many_attempts",
      digests: false,
    });
    const right = await confirm(
      server,
      member,
      started.requestId,
      "old",
      started.old,
    );
    expect(errorOf(right).code).toBe("not_found");
  });

  it("a new request replaces the open one: its codes no longer work", async () => {
    const server = app();
    const member = await newMember();
    const first = await startChange(server, member, newAddress("first"));
    const second = await startChange(server, member, newAddress("second"));
    expect(await requestRow(first.requestId)).toMatchObject({
      cancel_reason: "superseded",
    });
    expect(
      errorOf(await confirm(server, member, first.requestId, "old", first.old))
        .code,
    ).toBe("not_found");
    expect(
      (
        await confirm(server, member, second.requestId, "old", second.old)
      ).json(),
    ).toMatchObject({ outcome: "confirmed" });
  });
});

describe("decision 5: a taken address gets the answer of a success, and nothing changes", () => {
  it("GoTrue refuses the new address (email_exists): completed, the request closed address_unavailable, the account untouched", async () => {
    const server = app();
    const member = await newMember();
    const taken = newAddress("taken");
    const started = await startChange(server, member, taken);
    gotrue.add(taken); // a GoTrue user took it meanwhile
    await confirm(server, member, started.requestId, "old", started.old);
    const last = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(last.json()).toEqual({ outcome: "completed" });
    expect(await requestRow(started.requestId)).toMatchObject({
      completed: false,
      cancel_reason: "address_unavailable",
      digests: false,
    });
    expect(await accountEmail(member.accountId)).toBe(member.email);
    expect(gotrue.users.get(member.authUserId)).toBe(member.email);
    expect(
      (await queueLinesOf(member.accountId)).filter(
        (line) => line.event_type === "email.changed",
      ),
    ).toEqual([]);
  });

  it("another account holds it at completion: completed, GoTrue set back to the address in force", async () => {
    const server = app();
    const member = await newMember();
    const other = await newMember();
    const started = await startChange(server, member, other.email);
    // GoTrue does not know the other account's address (diverged): the database decides
    gotrue.users.delete(other.authUserId);
    await confirm(server, member, started.requestId, "old", started.old);
    const last = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(last.json()).toEqual({ outcome: "completed" });
    expect(await requestRow(started.requestId)).toMatchObject({
      cancel_reason: "address_unavailable",
    });
    expect(await accountEmail(member.accountId)).toBe(member.email);
    expect(gotrue.updates).toEqual([
      { userId: member.authUserId, email: other.email },
      { userId: member.authUserId, email: member.email },
    ]);
    expect(gotrue.users.get(member.authUserId)).toBe(member.email);
  });
});

describe("decision 5: outages never leave the account half-changed", () => {
  it("GoTrue unavailable: 503 email_change_unavailable, GoTrue set back, the request open; the same code completes it later", async () => {
    const server = app();
    const member = await newMember();
    const newEmail = newAddress("new");
    const started = await startChange(server, member, newEmail);
    await confirm(server, member, started.requestId, "old", started.old);
    gotrue.updateFailures.push({
      ok: false,
      reason: "unavailable",
      errorCode: null,
      status: null,
    });
    const failed = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(errorOf(failed)).toEqual({
      status: 503,
      code: "email_change_unavailable",
    });
    expect(await accountEmail(member.accountId)).toBe(member.email);
    expect(gotrue.users.get(member.authUserId)).toBe(member.email);
    expect(await requestRow(started.requestId)).toMatchObject({
      completed: false,
      cancel_reason: null,
      new_confirmed: true,
    });
    const retried = await confirm(
      server,
      member,
      started.requestId,
      "new",
      started.new,
    );
    expect(retried.json()).toEqual({ outcome: "completed" });
    expect(await accountEmail(member.accountId)).toBe(newEmail);
  });

  it("a code that did not leave: 503 email_change_unavailable, the request closed, never a silent skip", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member);
    double.queue(
      { status: 200, body: { messageId: messageId() } },
      { status: 503 },
    );
    const failed = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail: newAddress("new"),
    });
    expect(errorOf(failed)).toEqual({
      status: 503,
      code: "email_change_unavailable",
    });
    const [row] = await migration<{ cancel_reason: string | null }[]>`
      select cancel_reason::text as cancel_reason from identity.email_change_requests
       where account_id = ${member.accountId}`;
    expect(row?.cancel_reason).toBe("cancelled_by_holder");
    const statuses = await migration<{ email_code: string; status: string }[]>`
      select email_code, status::text as status from leads.transactional_sends
       where email_code like 'auth.email_change_confirm_%' and account_id = ${member.accountId}`;
    expect(statuses).toEqual([
      { email_code: "auth.email_change_confirm_old", status: "sent" },
    ]);
    expect(
      (await call(server, "GET", "/v1/me/email-change", member)).json(),
    ).toEqual({
      request: null,
    });
  });

  it("the new address refused by Brevo: 400 undeliverable on newEmail, the request closed", async () => {
    const server = app();
    const member = await newMember();
    await reauthenticate(server, member);
    double.queue(
      { status: 200, body: { messageId: messageId() } },
      {
        status: 400,
        body: { code: "invalid_parameter", message: "email is not valid" },
      },
    );
    const refused = await call(server, "POST", "/v1/me/email-change", member, {
      newEmail: newAddress("bounce"),
    });
    expect(refused.statusCode).toBe(400);
    expect(
      (refused.json() as { error: { details: unknown } }).error.details,
    ).toEqual([{ path: "newEmail", issue: "undeliverable" }]);
    expect(
      (await call(server, "GET", "/v1/me/email-change", member)).json(),
    ).toEqual({
      request: null,
    });
  });
});

describe("GET and DELETE /v1/me/email-change (17 §6.1; 18 T14)", () => {
  it("the holder cancels his open request; closed, unknown or another's: the same 404", async () => {
    const server = app();
    const member = await newMember();
    const stranger = await newMember();
    const started = await startChange(server, member, newAddress("new"));
    const foreign = await call(
      server,
      "DELETE",
      `/v1/me/email-change/${started.requestId}`,
      stranger,
    );
    const unknown = await call(
      server,
      "DELETE",
      `/v1/me/email-change/${randomUUID()}`,
      member,
    );
    expect(errorOf(foreign)).toEqual({ status: 404, code: "not_found" });
    expect(errorOf(unknown)).toEqual(errorOf(foreign));
    expect(
      (await call(server, "GET", "/v1/me/email-change", stranger)).json(),
    ).toEqual({ request: null });
    // nor may a stranger type a code of it
    expect(
      errorOf(
        await confirm(server, stranger, started.requestId, "old", started.old),
      ),
    ).toEqual({ status: 404, code: "not_found" });

    const cancelled = await call(
      server,
      "DELETE",
      `/v1/me/email-change/${started.requestId}`,
      member,
    );
    expect(cancelled.json()).toEqual({ outcome: "cancelled" });
    expect(await requestRow(started.requestId)).toMatchObject({
      cancel_reason: "cancelled_by_holder",
      digests: false,
    });
    const twice = await call(
      server,
      "DELETE",
      `/v1/me/email-change/${started.requestId}`,
      member,
    );
    expect(errorOf(twice)).toEqual({ status: 404, code: "not_found" });
  });
});

describe("D60, C-1: no address, request id, session id nor journey token in a log line", () => {
  it("searches every log stream of this file by value", () => {
    expect(logStreams.length).toBeGreaterThan(0);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
