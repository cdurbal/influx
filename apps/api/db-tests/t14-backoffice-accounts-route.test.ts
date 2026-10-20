// T14 (J8, commit 5) — the read API of the backoffice v0 on member accounts, on the local stack
// through the pools of apps/api (docs/mvp/05 RG97 to RG100, RG105, RG107; 15 RG34, RG40, RG49,
// RG50, CA30; 18 T14.1 to T14.4; 21 §J8 commit 5; migration 0133):
//   GET /v1/bo/accounts, POST /v1/bo/accounts/search (J8S-7: the term in the body, never in a
//   URL), GET /v1/bo/accounts/counters, GET /v1/bo/accounts/:id.
// T14 on each route: a member session and the web surface never reach them; an internal account,
// the caller's own and an unknown id answer the same 404, with the same body. RG107: no provider
// message, no contact id at a provider, no address in the list.
// The fixtures (agent, admin, members, sessions, queue lines, contact states) are COMMITTED by the
// migration role (random identifiers, disposable local stack, like TM1); the queue lines are
// removed and the internal profiles deactivated after the file. The list is read from the instant
// this file started (`from`): accounts of earlier runs never enter the expectations.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const ROUTES = [
  "/v1/bo/accounts",
  "/v1/bo/accounts/counters",
  "/v1/bo/accounts/00000000-0000-4000-8000-000000000000",
] as const;

let database: ApiDatabase;
/** The instant (database clock) before any fixture of this file. */
let startedAt: string;
const internals: string[] = [];
const members: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Internal = { accountId: string; email: string; session: string };

/** An active agent or admin with a TOTP factor, and a backoffice session proven by TOTP now. */
async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const email = `t14-bo-${role}-${accountId}@example.test`;
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
  watchedValues.push(email);
  return { accountId, email, session: token.toString("base64url") };
}

type Member = { accountId: string; email: string; session: string };

/** A committed member account: role, profile, sign-up consent (then a withdrawal if asked). */
async function newMember(
  role: "advertiser" | "creator",
  options: {
    country?: string;
    owner?: string;
    withdrawn?: boolean;
    utmSource?: string;
  } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `t14-member-${role}-${accountId}@example.test`;
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id,
         signup_utm_source)
      values (${accountId}, ${randomUUID()}, ${email}, now(), ${options.country ?? "FR"}, 'fr',
              true, now(),
              ${role === "advertiser" ? "business" : "individual"}::identity.declared_status,
              ${options.owner ?? null}, ${options.utmSource ?? null})`;
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
      values (${accountId}, 'marketing_email', true, 'signup_form', now() - interval '1 hour')`;
    if (options.withdrawn === true) {
      await tx`
        insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
        values (${accountId}, 'marketing_email', false, 'account_settings', now())`;
    }
    if (options.owner !== undefined) {
      await tx`
        insert into backoffice.ownership_assignments
          (account_id, agent_account_id, reason_code, assigned_at)
        values (${accountId}, ${options.owner}, 'signup_invitation', now())`;
    }
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')`;
  });
  members.push(accountId);
  watchedValues.push(email);
  return { accountId, email, session: token.toString("base64url") };
}

type LineSpec = {
  destination: "brevo_contact" | "apollo_contact";
  status: "pending" | "succeeded" | "skipped" | "failed";
  attempts?: number;
  skipReason?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Seconds between the line and its completion (a success in time, or late). */
  completedAfterSeconds?: number;
};

/** One lead.created queue line of the account, in a state (constraints of 0101, 0111). */
async function queueLine(accountId: string, line: LineSpec): Promise<void> {
  const event = randomUUID();
  const closed = line.status !== "pending";
  await migrationRole()`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status, attempts,
       available_at, skip_reason, last_error_code, last_error_message, completed_at)
    values (${event}, 'lead.created', ${line.destination}::leads.outbox_destination,
            ${`account:${accountId}`}, jsonb_build_object('event_id', ${event}::uuid),
            ${`lead.created:${event}`}, ${line.status}::leads.outbox_status, ${line.attempts ?? 0},
            now() + interval '10 minutes',
            ${line.status === "skipped" ? (line.skipReason ?? "no_consent") : null},
            ${line.errorCode ?? null}, ${line.errorMessage ?? null},
            case when ${closed}
                 then now() + make_interval(secs => ${line.completedAfterSeconds ?? 5}) end)`;
}

/** The state of a contact at one destination, as the worker writes it (0111). */
async function contactState(
  accountId: string,
  destination: "brevo_contact" | "apollo_contact",
  lastStatus: "succeeded" | "skipped" | "failed",
  lastCode: string | null,
): Promise<void> {
  await migrationRole()`
    insert into leads.contact_sync_states
      (account_id, destination, external_contact_id, last_attempt_at, last_success_at,
       last_status, last_error_code)
    values (${accountId}, ${destination}::leads.outbox_destination, ${`ext-${accountId}`}, now(),
            case when ${lastStatus === "succeeded"} then now() end,
            ${lastStatus}::leads.outbox_status, ${lastCode})`;
}

function app() {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
  });
}

type Server = ReturnType<typeof app>;

function get(
  server: Server,
  url: string,
  session: string | null,
  options: { surface?: "backoffice" | "web"; cookie?: string } = {},
): Promise<LightMyRequestResponse> {
  const cookieName = options.cookie ?? "__Host-influx-ops-session";
  return server.inject({
    method: "GET",
    url,
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
  });
}

/** POST /v1/bo/accounts/search (J8S-7): the term in the body, from `startedAt` by default. */
function search(
  server: Server,
  body: Record<string, string | number>,
  session: string | null,
  options: { surface?: "backoffice" | "web"; cookie?: string } = {},
): Promise<LightMyRequestResponse> {
  const cookieName = options.cookie ?? "__Host-influx-ops-session";
  return server.inject({
    method: "POST",
    url: "/v1/bo/accounts/search",
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
    payload: { from: startedAt, ...body },
  });
}

/** The body of an error envelope, without its request id (18 T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json<{
    error: { code: string; message: string; requestId: string };
  }>();
  return {
    status: response.statusCode,
    code: error.code,
    message: error.message,
  };
}

type Row = {
  id: string;
  role: string;
  countryCode: string;
  consent: { granted: boolean; source: string } | null;
  sync: Record<
    "brevo" | "apollo",
    {
      state: string;
      nature: string;
      cause: string;
      retryAt: string | null;
    }
  >;
  owner: { accountId: string; displayName: string | null } | null;
  source: { utmSource: string | null; viaInvitation: boolean };
};
type ListBody = { items: Row[]; nextCursor: string | null; search: string };

function listUrl(params: Record<string, string | number>): string {
  const query = new URLSearchParams({
    from: startedAt,
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  });
  return `/v1/bo/accounts?${query.toString()}`;
}

async function registerLines(
  eventType: string,
  subjectId: string,
): Promise<{ actor: string | null; payload: Record<string, unknown> }[]> {
  return migrationRole()<
    { actor: string | null; payload: Record<string, unknown> }[]
  >`
    select actor_account_id::text as actor, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_type = 'account' and subject_id = ${subjectId}
     order by seq`;
}

let agent: Internal;
let admin: Internal;
/** Advertiser, BE, owned by the agent: Brevo skipped no_consent, Apollo failed unauthorized. */
let alpha: Member;
/** Creator, FR, consent withdrawn: Brevo retry scheduled, Apollo never attempted. */
let beta: Member;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  const [clock] = await migrationRole()<{ now: string }[]>`
    select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as now`;
  startedAt = clock?.now ?? "";
  agent = await newInternal("agent");
  admin = await newInternal("admin");
  alpha = await newMember("advertiser", {
    country: "BE",
    owner: agent.accountId,
    utmSource: "newsletter",
  });
  await queueLine(alpha.accountId, {
    destination: "brevo_contact",
    status: "skipped",
    skipReason: "no_consent",
  });
  await contactState(alpha.accountId, "brevo_contact", "skipped", "no_consent");
  await queueLine(alpha.accountId, {
    destination: "apollo_contact",
    status: "failed",
    attempts: 10,
    errorCode: "apollo.unauthorized",
    errorMessage: "Apollo answered 401 for key t14-secret-detail",
  });
  await contactState(
    alpha.accountId,
    "apollo_contact",
    "failed",
    "apollo.unauthorized",
  );
  watchedValues.push("t14-secret-detail");
  beta = await newMember("creator", { withdrawn: true });
  await queueLine(beta.accountId, {
    destination: "brevo_contact",
    status: "pending",
    attempts: 2,
    errorCode: "brevo.unavailable",
  });
});

afterAll(async () => {
  await closeDatabase(database);
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

describe("T14 on every route of /v1/bo/accounts (18 T14.1; 03 §6.2)", () => {
  it("a member session is no session on the backoffice surface (401), on each route", async () => {
    const server = app();
    for (const route of ROUTES) {
      const response = await get(server, route, alpha.session);
      expect(errorBody(response), route).toEqual({
        status: 401,
        code: "unauthenticated",
        message: expect.any(String) as string,
      });
    }
    expect(
      errorBody(await search(server, { q: "t14-member" }, alpha.session)),
    ).toEqual({
      status: 401,
      code: "unauthenticated",
      message: expect.any(String) as string,
    });
  });

  it("the web surface never reaches a backoffice route (404), even with a member cookie", async () => {
    const server = app();
    for (const route of ROUTES) {
      const response = await get(server, route, alpha.session, {
        surface: "web",
        cookie: "__Host-influx-session",
      });
      expect(response.statusCode, route).toBe(404);
    }
    expect(
      (
        await search(server, { q: "t14-member" }, alpha.session, {
          surface: "web",
          cookie: "__Host-influx-session",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("no session: 401 on each route", async () => {
    const server = app();
    for (const route of ROUTES) {
      expect((await get(server, route, null)).statusCode, route).toBe(401);
    }
    expect((await search(server, { q: "t14-member" }, null)).statusCode).toBe(
      401,
    );
  });

  it("an unknown id, an internal account and the caller's own answer the same 404 (T14.3, T14.4), and journal nothing", async () => {
    const server = app();
    const bodies = [];
    for (const id of [randomUUID(), admin.accountId, agent.accountId]) {
      const response = await get(
        server,
        `/v1/bo/accounts/${id}`,
        agent.session,
      );
      bodies.push(errorBody(response));
      expect(await registerLines("history.account_read", id)).toEqual([]);
    }
    expect(bodies[0]).toEqual({
      status: 404,
      code: "not_found",
      message: expect.any(String) as string,
    });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("a malformed id is refused before any read (400)", async () => {
    const response = await get(
      app(),
      "/v1/bo/accounts/not-a-uuid",
      agent.session,
    );
    expect(errorBody(response)).toMatchObject({
      status: 400,
      code: "validation_failed",
    });
  });
});

describe("GET /v1/bo/accounts (05 RG97, RG99, RG100; 15 RG34)", () => {
  it("lists the member accounts newest first, never an internal one, with no address nor name", async () => {
    const response = await get(app(), listUrl({}), agent.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<ListBody>();
    const ids = body.items.map((row) => row.id);
    expect(ids).toEqual([beta.accountId, alpha.accountId]);
    expect(ids).not.toContain(agent.accountId);
    expect(ids).not.toContain(admin.accountId);
    expect(body.search).toBe("none");
    expect(body.nextCursor).toBeNull();
    // RG97 lists no address: the list is not the directory (03 C(17))
    expect(response.body).not.toContain("@");
    expect(response.body).not.toContain("Maison");
  });

  it("gives each destination its state and its cause in clear, a normal case apart from a failure (RG99, RG100)", async () => {
    const body = (
      await get(app(), listUrl({}), agent.session)
    ).json<ListBody>();
    const [betaRow, alphaRow] = body.items;
    expect(alphaRow?.sync).toEqual({
      brevo: {
        state: "skipped",
        nature: "normal_case",
        cause: "no_consent",
        retryAt: null,
        lastAttemptAt: expect.any(String) as string,
      },
      apollo: {
        state: "failed",
        nature: "incident",
        cause: "access_key_refused",
        retryAt: null,
        lastAttemptAt: expect.any(String) as string,
      },
    });
    expect(betaRow?.sync.brevo).toMatchObject({
      state: "pending",
      nature: "in_progress",
      cause: "retry_scheduled",
    });
    expect(betaRow?.sync.brevo.retryAt).not.toBeNull();
    expect(betaRow?.sync.apollo).toMatchObject({
      state: "not_attempted",
      cause: "not_attempted",
    });
    expect(alphaRow).toMatchObject({
      role: "advertiser",
      countryCode: "BE",
      consent: { granted: true, source: "signup_form" },
      owner: { accountId: agent.accountId, displayName: "Camille" },
      source: { utmSource: "newsletter", viaInvitation: false },
    });
    expect(betaRow?.consent).toMatchObject({
      granted: false,
      source: "account_settings",
    });
  });

  it("filters by role, country, consent and synchronisation state, per destination or either", async () => {
    const server = app();
    const ids = async (params: Record<string, string>) =>
      (await get(server, listUrl(params), agent.session))
        .json<ListBody>()
        .items.map((row) => row.id);
    expect(await ids({ role: "creator" })).toEqual([beta.accountId]);
    expect(await ids({ country: "BE" })).toEqual([alpha.accountId]);
    expect(await ids({ consent: "withdrawn" })).toEqual([beta.accountId]);
    expect(await ids({ declaredStatus: "business" })).toEqual([
      alpha.accountId,
    ]);
    expect(
      await ids({ syncDestination: "apollo", syncState: "failed" }),
    ).toEqual([alpha.accountId]);
    expect(
      await ids({ syncDestination: "brevo", syncState: "failed" }),
    ).toEqual([]);
    expect(await ids({ syncState: "pending" })).toEqual([beta.accountId]);
    expect(await ids({ to: startedAt })).toEqual([]);
  });

  it("pages by an opaque cursor, without overlap; the server caps the page (15 RG34)", async () => {
    const server = app();
    const first = (
      await get(server, listUrl({ limit: 1 }), agent.session)
    ).json<ListBody>();
    expect(first.items.map((row) => row.id)).toEqual([beta.accountId]);
    expect(first.nextCursor).not.toBeNull();
    const second = (
      await get(
        server,
        listUrl({ limit: 1, cursor: first.nextCursor ?? "" }),
        agent.session,
      )
    ).json<ListBody>();
    expect(second.items.map((row) => row.id)).toEqual([alpha.accountId]);
    expect(second.nextCursor).toBeNull();
    const refused: Record<string, string | number>[] = [
      { limit: 51 },
      { limit: 0 },
      { cursor: "bm90LWEtY3Vyc29y" },
      { unknown: "x" },
      // J8S-7: a term never travels in a URL; refused, never ignored
      { email: alpha.email },
      { q: "t14-member" },
      { syncDestination: "brevo" },
      { from: startedAt, to: "2020-01-01T00:00:00.000Z" },
    ];
    for (const params of refused) {
      const response = await get(server, listUrl(params), agent.session);
      expect(errorBody(response).code, JSON.stringify(params)).toBe(
        "validation_failed",
      );
    }
  });
});

describe("POST /v1/bo/accounts/search (05 RG98, 15 RG50, CA30; J8S-7)", () => {
  it("the exact address search is free and journals nothing; an internal address finds nothing", async () => {
    const server = app();
    const foundResponse = await search(
      server,
      { email: alpha.email.toUpperCase() },
      agent.session,
    );
    expect(foundResponse.statusCode, foundResponse.body).toBe(200);
    expect(foundResponse.headers["cache-control"]).toBe("no-store");
    const found = foundResponse.json<ListBody>();
    expect(found.items.map((row) => row.id)).toEqual([alpha.accountId]);
    expect(found.search).toBe("exact");
    const internal = (
      await search(server, { email: admin.email }, agent.session)
    ).json<ListBody>();
    const unknown = (
      await search(
        server,
        { email: `t14-nobody-${randomUUID()}@example.test` },
        agent.session,
      )
    ).json<ListBody>();
    expect(internal).toEqual(unknown);
    expect(internal.items).toEqual([]);
    expect(
      await registerLines("accounts.searched_partial", agent.accountId),
    ).toEqual([]);
  });

  it("filters a search like the list: role, period (J8T-7 at the API)", async () => {
    const server = app();
    const ids = async (body: Record<string, string>) =>
      (await search(server, body, agent.session))
        .json<ListBody>()
        .items.map((row) => row.id);
    expect(await ids({ email: beta.email, role: "creator" })).toEqual([
      beta.accountId,
    ]);
    expect(await ids({ email: beta.email, role: "advertiser" })).toEqual([]);
    expect(await ids({ email: beta.email, to: startedAt })).toEqual([]);
  });

  it("a partial search is journaled on the searcher, by the length of its term, never the term", async () => {
    const searcher = await newInternal("agent");
    // a fragment of the address itself: '@' and '.' reach the API in the body (EC-J8-58)
    const fragment = `${alpha.accountId.slice(-6)}@example.`;
    const response = await search(app(), { q: fragment }, searcher.session);
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json<ListBody>();
    expect(body.search).toBe("partial");
    expect(body.items.map((row) => row.id)).toEqual([alpha.accountId]);
    const lines = await registerLines(
      "accounts.searched_partial",
      searcher.accountId,
    );
    expect(lines).toEqual([
      {
        actor: searcher.accountId,
        payload: { outcome: "performed", term_length: fragment.length },
      },
    ]);
    expect(JSON.stringify(lines)).not.toContain(fragment);
  });

  it("without a term, it is the list (no journal line); never both terms; the filters stay checked", async () => {
    const server = app();
    const searcher = await newInternal("agent");
    const listed = (
      await search(server, { role: "creator" }, searcher.session)
    ).json<ListBody>();
    expect(listed.items.map((row) => row.id)).toEqual([beta.accountId]);
    expect(listed.search).toBe("none");
    expect(
      await registerLines("accounts.searched_partial", searcher.accountId),
    ).toEqual([]);
    const refused: Record<string, string>[] = [
      { email: alpha.email, q: "t14-member" },
      { q: "t1" },
      { email: "not-an-address" },
      { q: "t14-member", syncDestination: "brevo" },
      { q: "t14-member", unknown: "x" },
    ];
    for (const body of refused) {
      expect(
        errorBody(await search(server, body, agent.session)).code,
        JSON.stringify(body),
      ).toBe("validation_failed");
    }
  });

  it("beyond 20 partial searches in 15 minutes: 429 with Retry-After, the refusal journaled too", async () => {
    const searcher = await newInternal("agent");
    const server = app();
    for (let index = 0; index < 20; index += 1) {
      const response = await search(
        server,
        { q: "t14-member", limit: 1 },
        searcher.session,
      );
      expect(response.statusCode, `search ${index + 1}`).toBe(200);
    }
    const refused = await search(
      server,
      { q: "t14-member", limit: 1 },
      searcher.session,
    );
    expect(errorBody(refused)).toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    expect(refused.headers["retry-after"]).toBe("900");
    // the exact search stays free (RG98)
    expect(
      (await search(server, { email: alpha.email }, searcher.session))
        .statusCode,
    ).toBe(200);
    const outcomes = (
      await registerLines("accounts.searched_partial", searcher.accountId)
    ).map((line) => line.payload.outcome);
    expect(outcomes.filter((outcome) => outcome === "performed")).toHaveLength(
      20,
    );
    expect(outcomes.at(-1)).toBe("refused");
  });

  it("J8S-7: neither a searched address nor a fragment reaches a log line", async () => {
    const logs = captureLogs();
    const server = buildServer(testApiConfig(), {
      logDestination: logs.destination,
      database,
    });
    const fragment = `zz${randomUUID().slice(0, 12)}`;
    await search(server, { email: beta.email }, agent.session);
    await search(server, { q: fragment }, agent.session);
    expect(valuesFoundIn(logs.text(), [beta.email, fragment])).toEqual([]);
  });
});

describe("GET /v1/bo/accounts/:id (15 RG40, RG41, RG49; 05 RG99, RG107; EC-31)", () => {
  type Detail = {
    account: Row & {
      email: string;
      emailStatus: string;
      companyName: string | null;
    };
    ownership: { agentAccountId: string; reasonCode: string }[];
    history: {
      events: { eventType: string; actorType: string }[];
      nextBefore: number | null;
    };
  };

  it("opens the record: address, company, causes in clear, salespersons, history; the opening is journaled", async () => {
    const response = await get(
      app(),
      `/v1/bo/accounts/${alpha.accountId.toUpperCase()}`,
      agent.session,
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<Detail>();
    expect(body.account).toMatchObject({
      id: alpha.accountId,
      email: alpha.email,
      emailStatus: "unknown",
      companyName: `Maison ${alpha.accountId.slice(0, 8)}`,
      sync: {
        brevo: { cause: "no_consent", nature: "normal_case" },
        apollo: { cause: "access_key_refused", nature: "incident" },
      },
    });
    expect(body.ownership).toEqual([
      {
        agentAccountId: agent.accountId,
        agentDisplayName: "Camille",
        assignedAt: expect.any(String) as string,
        unassignedAt: null,
        reasonCode: "signup_invitation",
      },
    ]);
    expect(body.history.nextBefore).toBeNull();
    // RG107: neither the provider's message nor the contact id at the provider
    expect(response.body).not.toContain("t14-secret-detail");
    expect(response.body).not.toContain(`ext-${alpha.accountId}`);
    expect(
      await registerLines("history.account_read", alpha.accountId),
    ).toEqual([
      {
        actor: agent.accountId,
        payload: { limit: 51, before_seq: null },
      },
    ]);
  });

  it("shows the earlier openings in the history, and an admin reads the same record", async () => {
    const response = await get(
      app(),
      `/v1/bo/accounts/${alpha.accountId}`,
      admin.session,
    );
    expect(response.statusCode).toBe(200);
    const body = response.json<Detail>();
    expect(body.account.email).toBe(alpha.email);
    expect(body.history.events[0]).toMatchObject({
      eventType: "history.account_read",
      actorType: "agent",
    });
    const second = await get(
      app(),
      `/v1/bo/accounts/${alpha.accountId}?historyBefore=1`,
      admin.session,
    );
    expect(second.json<Detail>().history.events).toEqual([]);
  });
});

describe("GET /v1/bo/accounts/counters (05 RG105)", () => {
  type Counters = {
    day: string;
    signups: { total: number; advertiser: number; creator: number };
    topCountries: { countryCode: string; count: number }[];
    otherCountries: number;
    brevoWithinHour: { synced: number; eligible: number };
    apolloWithin24Hours: { synced: number; eligible: number };
    unhandledFailures: { brevo: number; apollo: number };
  };

  it("counts the sign-ups of the day, the deliveries in time apart from normal cases, and the failures to handle", async () => {
    const server = app();
    const before = (
      await get(server, "/v1/bo/accounts/counters", agent.session)
    ).json<Counters>();
    expect(before.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(before.topCountries.length).toBeLessThanOrEqual(5);
    expect(before.unhandledFailures.apollo).toBeGreaterThanOrEqual(1);

    const gamma = await newMember("creator", { country: "TV" });
    await queueLine(gamma.accountId, {
      destination: "brevo_contact",
      status: "succeeded",
      completedAfterSeconds: 30,
    });
    await queueLine(gamma.accountId, {
      destination: "apollo_contact",
      status: "skipped",
      skipReason: "out_of_apollo_scope_individual",
    });
    const delta = await newMember("advertiser", { country: "TV" });
    await queueLine(delta.accountId, {
      destination: "brevo_contact",
      status: "succeeded",
      completedAfterSeconds: 7200,
    });
    await queueLine(delta.accountId, {
      destination: "apollo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "apollo.rate_limited",
    });

    const after = (
      await get(server, "/v1/bo/accounts/counters", agent.session)
    ).json<Counters>();
    expect(after.signups.total - before.signups.total).toBe(2);
    expect(after.signups.creator - before.signups.creator).toBe(1);
    expect(after.signups.advertiser - before.signups.advertiser).toBe(1);
    // gamma in time, delta late: two eligible, one synced
    expect(after.brevoWithinHour.synced - before.brevoWithinHour.synced).toBe(
      1,
    );
    expect(
      after.brevoWithinHour.eligible - before.brevoWithinHour.eligible,
    ).toBe(2);
    // gamma's Apollo line is a normal case, out of the base (RG100)
    expect(
      after.apolloWithin24Hours.eligible - before.apolloWithin24Hours.eligible,
    ).toBe(1);
    expect(
      after.unhandledFailures.apollo - before.unhandledFailures.apollo,
    ).toBe(1);
    const countries = [
      ...after.topCountries.map((country) => country.count),
      after.otherCountries,
    ];
    expect(countries.reduce((sum, count) => sum + count, 0)).toBe(
      after.signups.total,
    );
  });
});

describe("D60: no address in the logs", () => {
  it("no address of this file in any log stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
