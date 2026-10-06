// POST /v1/auth/request-code on the local stack (docs/mvp/02 §18.10, applied literally; 05 RG39 to
// RG52, RG128 to RG135; 18 T8.1, T8.4, T8.5; lead-pipeline T1 and T10; 21 EC-3, EC-19, EC-52).
// Real database (pools of apps/api), real local GoTrue, and the Brevo double of @influx/test-kit:
// no external call. Every test reads its log stream BY VALUE (C-1). Addresses and client
// addresses are drawn at random: the counters of 0014 survive between runs.
import { randomBytes, randomUUID } from "node:crypto";
import { MATCHING_PHRASE_WORDS } from "../src/domains/identity/matching-phrase-words.ts";
import {
  localRoleUrl,
  requireLocalAuth,
  type LocalAuthStack,
  type LoginRole,
} from "@influx/test-kit/db";
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { createAuthTokenCodec } from "../src/platform/auth-tokens.ts";
import {
  createTransactionalSender,
  type TransactionalSender,
} from "../src/platform/brevo-transactional.ts";
import {
  createSupabaseAuth,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  captureLogs,
  testApiConfig,
  TOKEN_SIGNING_SECRET,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const FLOOR_MS = 1_000;
/** The raw agent of every request: it must never reach a log, a row or the e-mail (05 Q14). */
const AGENT_MARKER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131.0 marker-5b7e";

let local: LocalAuthStack;
let database: ApiDatabase;
let double: BrevoDouble;
let gotrue: SupabaseAuth;
const tokens = createAuthTokenCodec(TOKEN_SIGNING_SECRET);

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function newAddress(label: string): string {
  return `j3-rc-${label}-${randomUUID()}@example.test`;
}

/** A client address of its own /64: the per-IP counter of one test is never another's. */
function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::1`;
}

type Calls = string[];

/** GoTrue and Brevo wrapped to record the sequence of costly calls (18 T8.5). */
function instrumented(
  calls: Calls,
  options: { gotrueDelayMs?: number } = {},
): { supabaseAuth: SupabaseAuth } {
  const delay = () =>
    new Promise((resolve) => setTimeout(resolve, options.gotrueDelayMs ?? 0));
  return {
    supabaseAuth: {
      ...gotrue,
      async createUser(email) {
        calls.push("createUser");
        await delay();
        return gotrue.createUser(email);
      },
      async generateEmailCode(email) {
        calls.push("generateEmailCode");
        return gotrue.generateEmailCode(email);
      },
    },
  };
}

function countingSender(
  calls: Calls,
  settings: { mode?: "redirect" | "live"; testRecipients?: string[] } = {},
): TransactionalSender {
  const sender = createTransactionalSender(
    {
      mode: settings.mode ?? "live",
      testRecipients: settings.testRecipients ?? [],
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
  );
  return {
    send(email) {
      calls.push("send");
      return sender.send(email);
    },
  };
}

function app(
  options: {
    calls?: Calls;
    floorMs?: number;
    gotrueDelayMs?: number;
    sender?: TransactionalSender;
  } = {},
) {
  const calls = options.calls ?? [];
  const logs = captureLogs();
  const server = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: {
      ...instrumented(calls, { gotrueDelayMs: options.gotrueDelayMs }),
      sender: options.sender ?? countingSender(calls),
      ...(options.floorMs === undefined
        ? {}
        : { codeRequestFloorMs: options.floorMs }),
    },
  });
  return { server, logs, calls };
}

type Server = ReturnType<typeof app>["server"];

async function requestCode(
  server: Server,
  body: unknown,
  options: { clientAddress?: string; requestId?: string } = {},
): Promise<{
  response: LightMyRequestResponse;
  durationMs: number;
  requestId: string;
}> {
  const requestId = options.requestId ?? randomUUID();
  const started = performance.now();
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/request-code",
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": requestId,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "x-real-ip": options.clientAddress ?? newClientAddress(),
      "client-user-agent": AGENT_MARKER,
    },
    payload: JSON.stringify(body),
  });
  return { response, durationMs: performance.now() - started, requestId };
}

function loginCookieOf(response: LightMyRequestResponse): string | undefined {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [header];
  return cookies.find((cookie) => cookie.startsWith("__Host-influx-login="));
}

function codeOf(text: string | undefined): string {
  const code = /^(\d{6})$/m.exec(text ?? "")?.[1];
  if (code === undefined) {
    throw new Error("no code in the e-mail");
  }
  return code;
}

type JournalLine = {
  id: string;
  reference: string;
  status: string;
  account_id: string | null;
  recipient_email: string | null;
  locale: string;
  failure_code: string | null;
  provider_message_id: string | null;
  outbox_event_id: string | null;
  template_version: number;
};

async function journalOf(
  email: string,
  accountId: string | null = null,
): Promise<JournalLine[]> {
  return migrationRole()<JournalLine[]>`
    select id::text, reference::text, status::text, account_id::text, recipient_email, locale,
           failure_code, provider_message_id, outbox_event_id::text, template_version
      from leads.transactional_sends
     where recipient_email = ${email} or account_id = ${accountId}
     order by id`;
}

async function auditLinesOf(requestId: string) {
  return migrationRole()<
    {
      event_type: string;
      subject_type: string;
      subject_id: string;
      payload: unknown;
    }[]
  >`
    select event_type, subject_type, subject_id::text, payload
      from audit.audit_events where request_id = ${requestId}`;
}

/** A member account whose GoTrue user exists, in the given language (created by the test). */
async function newMemberAccount(label: string, language: "fr" | "en") {
  const email = newAddress(label);
  const created = await gotrue.createUser(email);
  if (!created.ok) {
    throw new Error("GoTrue user not created");
  }
  const accountId = randomUUID();
  await migrationRole()`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       display_name, is_adult_attested, adult_attested_at)
    values (${accountId}, ${created.value.userId}, ${email}, now(), 'FR', ${language},
            'J3 request-code', true, now())`;
  await migrationRole()`
    insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
  return { email, accountId };
}

/** Records a C-1 check of the file's end: these values never reach this log stream. */
function watch(text: () => string, values: string[]): void {
  afterAllChecks.push(() => ({ text: text(), values }));
}
const afterAllChecks: (() => { text: string; values: string[] })[] = [];

beforeAll(async () => {
  local = await requireLocalAuth();
  gotrue = createSupabaseAuth(
    { url: local.apiUrl, secretKey: local.secretKey },
    { warn: () => undefined },
  );
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
  double.reset();
});

afterAll(async () => {
  await double.close();
  await closeDatabase(database);
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 'j3-rc-%@example.test'`;
  for (const { id } of users) {
    await fetch(`${local.authUrl}/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        apikey: local.secretKey,
        authorization: `Bearer ${local.secretKey}`,
      },
    });
  }
});

describe("02 §18.10: a code that leaves", () => {
  it("answers 200 sent after the floor, with the phrase, the login cookie, the e-mail, the journal line and ONE audit line", async () => {
    const { server, logs, calls } = app();
    const email = newAddress("sent");
    const { response, durationMs, requestId } = await requestCode(server, {
      email: `  ${email.toUpperCase()} `,
      locale: "fr",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      outcome: string;
      retryAfterSeconds: number;
      matchingPhrase: string;
    }>();
    expect(body.outcome).toBe("sent");
    expect(body.retryAfterSeconds).toBe(60);
    expect(Object.keys(body).sort()).toEqual([
      "matchingPhrase",
      "outcome",
      "retryAfterSeconds",
    ]);
    expect(durationMs).toBeGreaterThanOrEqual(FLOOR_MS - 5);
    const [first = "", second = ""] = body.matchingPhrase.split(" ");
    expect(MATCHING_PHRASE_WORDS.fr).toContain(first);
    expect(MATCHING_PHRASE_WORDS.fr).toContain(second);
    expect(calls).toEqual(["createUser", "generateEmailCode", "send"]);

    // Step 9: the login cookie, signed, 15 min, never the code (RG47, RG48; J3-C rule 8).
    const cookie = loginCookieOf(response);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/; Max-Age=900(;|$)/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Strict/);
    expect(cookie).not.toMatch(/Domain=/i);
    const value = decodeURIComponent(
      cookie?.split(";")[0]?.split("=").slice(1).join("=") ?? "",
    );
    const token = tokens.readLogin(value, new Date());
    expect(token).toMatchObject({
      typ: "login",
      email,
      phrase: body.matchingPhrase,
    });

    // Step 7: one unitary send, the same phrase, the Idempotency-Key of the line (CA71).
    expect(double.messages).toHaveLength(1);
    const [message] = double.messages;
    const [line] = await journalOf(email);
    expect(message?.body.to).toEqual([{ email }]);
    expect(message?.headers["idempotency-key"]).toBe(
      `auth.login_code:${line?.id}`,
    );
    expect(message?.body.textContent).toContain(
      `Phrase de correspondance : ${body.matchingPhrase}`,
    );
    const code = codeOf(message?.body.textContent);
    expect(message?.body.subject).not.toContain(code);
    expect(message?.body.subject).not.toContain(body.matchingPhrase);
    expect(message?.body.textContent).toContain("(UTC)");

    // Steps 3 and 8: one line, P0, no queue event, sent with the provider's id.
    expect(line).toMatchObject({
      status: "sent",
      account_id: null,
      recipient_email: email,
      locale: "fr",
      outbox_event_id: null,
      failure_code: null,
      template_version: 1,
    });
    expect(line?.provider_message_id).toMatch(/@double\.brevo\.test>$/);
    expect(token?.ref).toBe(line?.reference);

    // EC-52: one line of register, subject = the random reference; the outcome writes none.
    const audit = await auditLinesOf(requestId);
    expect(audit).toEqual([
      {
        event_type: "elevated.identity.request_code",
        subject_type: "login_request",
        subject_id: line?.reference,
        payload: { operation: "identity.request_code" },
      },
    ]);

    // The code is the one GoTrue accepts (J3-A b3).
    expect(
      (
        await gotrue.verifyEmailCode(
          { forwardedFor: null, timeoutMs: 5_000 },
          email,
          code,
        )
      ).ok,
    ).toBe(true);

    // CA75, 05 RG52: neither the code nor the phrase in the rows of the request.
    const rows = await migrationRole()<{ text: string }[]>`
      select row_to_json(t)::text as text from leads.transactional_sends t where reference = ${line?.reference ?? ""}::uuid
      union all
      select row_to_json(a)::text from audit.audit_events a where request_id = ${requestId}`;
    const rowText = rows.map((row) => row.text).join("\n");
    expect(
      valuesFoundIn(rowText, [body.matchingPhrase, code, AGENT_MARKER]),
    ).toEqual([]);
    expect(message?.raw).not.toContain("marker-5b7e");
    expect(message?.raw).toContain("Firefox sur Windows");
    watch(logs.text, [email, code, body.matchingPhrase, value, AGENT_MARKER]);
  });

  it("writes nothing in outbox_events (lead-pipeline T1): the table does not exist at J3", async () => {
    const [row] = await migrationRole()<{ table: string | null }[]>`
      select to_regclass('leads.outbox_events')::text as table`;
    expect(row?.table).toBeNull();
  });
});

describe("18 T8.5, CA72: a known and an unknown address are answered alike", () => {
  it("gives the same answer, the same headers and the same sequence of calls; the phrase follows the page", async () => {
    const known = await newMemberAccount("known", "en");
    const unknown = newAddress("unknown");
    const runs = [];
    for (const email of [known.email, unknown]) {
      const calls: Calls = [];
      const { server, logs } = app({ calls });
      const result = await requestCode(server, { email, locale: "fr" });
      watch(logs.text, [email]);
      runs.push({ calls, result, email });
    }
    const [forKnown, forUnknown] = runs;
    const shape = (response: LightMyRequestResponse) => ({
      status: response.statusCode,
      headers: Object.keys(response.headers)
        .filter((name) => name !== "date")
        .sort(),
      keys: Object.keys(response.json<object>()).sort(),
      outcome: response.json<{ outcome: string }>().outcome,
      cookie: loginCookieOf(response)?.split(";").slice(1).join(";"),
    });
    if (forKnown === undefined || forUnknown === undefined) {
      throw new Error("two runs expected");
    }
    expect(shape(forKnown.result.response)).toEqual(
      shape(forUnknown.result.response),
    );
    expect(forKnown?.calls).toEqual([
      "createUser",
      "generateEmailCode",
      "send",
    ]);
    expect(forKnown?.calls).toEqual(forUnknown?.calls);
    for (const run of runs) {
      const phrase = run.result.response.json<{ matchingPhrase: string }>()
        .matchingPhrase;
      for (const word of phrase.split(" ")) {
        expect(MATCHING_PHRASE_WORDS.fr).toContain(word);
      }
    }
    // The e-mail follows the page as well at J3 (21 §3, EC-58), for both.
    expect(double.messages.map((message) => message.body.subject)).toEqual([
      "Votre code de connexion INFLUX",
      "Votre code de connexion INFLUX",
    ]);
    const [knownLine] = await journalOf(known.email, known.accountId);
    expect(knownLine).toMatchObject({
      account_id: known.accountId,
      recipient_email: null,
    });
  });
});

describe("05 RG44, RG45: rate limits aim at the attacker, never at the victim", () => {
  it("refuses the fourth request of an address within 15 min: no code, no line, no audit line; the code in progress stays valid", async () => {
    const { server, logs, calls } = app({ floorMs: 0 });
    const email = newAddress("ceiling");
    for (let index = 0; index < 3; index += 1) {
      const { response } = await requestCode(server, { email, locale: "en" });
      expect(response.json<{ outcome: string }>().outcome).toBe("sent");
    }
    const codeInProgress = codeOf(double.messages[2]?.body.textContent);
    calls.length = 0;
    const fourth = await requestCode(server, { email, locale: "en" });
    expect(fourth.response.statusCode).toBe(200);
    expect(fourth.response.json()).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(loginCookieOf(fourth.response)).toBeUndefined();
    expect(calls).toEqual([]);
    expect(await journalOf(email)).toHaveLength(3);
    expect(await auditLinesOf(fourth.requestId)).toEqual([]);
    expect(
      (
        await gotrue.verifyEmailCode(
          { forwardedFor: null, timeoutMs: 5_000 },
          email,
          codeInProgress,
        )
      ).ok,
    ).toBe(true);
    watch(logs.text, [email, codeInProgress]);
  });

  it("stops a burst from one network: 25 addresses, one request each, 20 codes (T8.4)", async () => {
    const { server, logs } = app({ floorMs: 0 });
    const clientAddress = newClientAddress();
    const emails = Array.from({ length: 25 }, (_, index) =>
      newAddress(`burst-${index}`),
    );
    const results = await Promise.all(
      emails.map((email) =>
        requestCode(server, { email, locale: "fr" }, { clientAddress }),
      ),
    );
    const outcomes = results.map(
      (result) => result.response.json<{ outcome: string }>().outcome,
    );
    expect(outcomes.filter((outcome) => outcome === "sent")).toHaveLength(20);
    expect(
      outcomes.filter((outcome) => outcome === "rate_limited"),
    ).toHaveLength(5);
    watch(logs.text, emails);
  });

  it("writes no audit line for twenty parallel requests beyond the ceiling (EC-52)", async () => {
    const { server } = app({ floorMs: 0 });
    const email = newAddress("parallel");
    for (let index = 0; index < 3; index += 1) {
      await requestCode(server, { email, locale: "fr" });
    }
    const refused = await Promise.all(
      Array.from({ length: 20 }, () =>
        requestCode(server, { email, locale: "fr" }),
      ),
    );
    for (const { response, requestId } of refused) {
      expect(response.json<{ outcome: string }>().outcome).toBe("rate_limited");
      expect(await auditLinesOf(requestId)).toEqual([]);
    }
    expect(await journalOf(email)).toHaveLength(3);
  });
});

describe("02 §18.6, 05 RG60, RG64: the three causes, never a false success", () => {
  it("provider unavailable: one call and no retry (T10), line failed, no cookie, no phrase, after the floor", async () => {
    const { server, logs, calls } = app();
    const email = newAddress("unavailable");
    double.queue({
      status: 503,
      body: { code: "unavailable", message: email },
    });
    const { response, durationMs, requestId } = await requestCode(server, {
      email,
      locale: "fr",
    });
    expect(response.json()).toEqual({
      outcome: "provider_unavailable",
      retryAfterSeconds: 60,
    });
    expect(durationMs).toBeGreaterThanOrEqual(FLOOR_MS - 5);
    expect(loginCookieOf(response)).toBeUndefined();
    expect(calls).toEqual(["createUser", "generateEmailCode", "send"]);
    expect(double.messages).toHaveLength(1);
    const lines = await journalOf(email);
    expect(lines).toMatchObject([
      {
        status: "failed",
        failure_code: "provider_unavailable",
        provider_message_id: null,
      },
    ]);
    expect(await auditLinesOf(requestId)).toHaveLength(1);
    watch(logs.text, [email, codeOf(double.messages[0]?.body.textContent)]);
  });

  it("undeliverable: outside BREVO_TEST_RECIPIENTS in redirect mode, set aside without a call", async () => {
    const calls: Calls = [];
    const { server, logs } = app({
      calls,
      floorMs: 0,
      sender: countingSender(calls, {
        mode: "redirect",
        testRecipients: ["team@influx.example"],
      }),
    });
    const email = newAddress("aside");
    const { response } = await requestCode(server, { email, locale: "en" });
    expect(response.json()).toEqual({
      outcome: "undeliverable",
      retryAfterSeconds: 60,
    });
    expect(double.messages).toHaveLength(0);
    expect(await journalOf(email)).toMatchObject([
      { status: "failed", failure_code: "undeliverable_address" },
    ]);
    watch(logs.text, [email]);
  });

  it("GoTrue beyond its budget of 2 000 ms (G1): provider unavailable, nothing sent", async () => {
    const { server, logs, calls } = app({ floorMs: 0, gotrueDelayMs: 2_500 });
    const email = newAddress("slow");
    const { response, durationMs } = await requestCode(server, {
      email,
      locale: "fr",
    });
    expect(response.json()).toEqual({
      outcome: "provider_unavailable",
      retryAfterSeconds: 60,
    });
    expect(durationMs).toBeLessThan(2_400);
    expect(calls).toEqual(["createUser"]);
    expect(double.messages).toHaveLength(0);
    expect(await journalOf(email)).toMatchObject([
      { status: "failed", failure_code: "provider_unavailable" },
    ]);
    watch(logs.text, [email]);
  });

  it("refuses a malformed request with 400 after the floor, writing nothing (02 §18.5 R2)", async () => {
    const { server, logs, calls } = app();
    const email = `not-an-address-${randomUUID()}`;
    for (const body of [
      { email, locale: "fr" },
      { email: newAddress("locale"), locale: "pt" },
      { email: newAddress("extra"), locale: "fr", role: "agent" },
    ]) {
      const { response, durationMs } = await requestCode(server, body);
      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        "validation_failed",
      );
      expect(durationMs).toBeGreaterThanOrEqual(FLOOR_MS - 5);
    }
    expect(calls).toEqual([]);
    expect(await journalOf(email)).toEqual([]);
    watch(logs.text, [email]);
  });
});

describe("C-1: nothing of the request in the log lines", () => {
  it("finds no address, code, phrase, cookie or browser agent in any captured stream", () => {
    // Runs last in the file: it reads the streams of every test above.
    const found = afterAllChecks.flatMap((check) => {
      const { text, values } = check();
      expect(text.length).toBeGreaterThan(0);
      return valuesFoundIn(text, values);
    });
    expect(afterAllChecks.length).toBeGreaterThan(8);
    expect(found).toEqual([]);
  });
});
