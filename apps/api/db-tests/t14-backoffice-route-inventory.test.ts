// T14 (J8, commit 10) — EVERY route of /v1/bo/*, read from the server itself rather than from a
// list kept by hand (docs/mvp/18 T14.1 to T14.4; 03 §6.2; 21 §J8 commit 10). The three T14 files
// of the commits 5 to 7 test each route in depth; this one makes sure none escapes them:
//   - the routes the server registers under /v1/bo/ are exactly those of the table below: a new
//     route fails here until it is placed (sessionless, or behind the session, with or without an
//     identifier in its path);
//   - each one is unreachable from the web surface (404, the answer of an unknown route), and each
//     route behind the session answers 401 without a session and with a member session;
//   - each route with an identifier answers an object that exists but is not the caller's EXACTLY
//     like an object that does not exist: same status, same code, same message (T14.3, T14.4).
// The fixtures (agents, admins, members, invitations, a dual control request) are COMMITTED by the
// migration role or through the routes (random identifiers, disposable local stack, like TM1); the
// internal profiles are deactivated after the file.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { BACKOFFICE_SESSIONLESS_ROUTES } from "../src/domains/identity/backoffice-routes.ts";
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

const NIL = "00000000-0000-4000-8000-000000000000";

type Method = "GET" | "POST";

/**
 * Every route of /v1/bo/*, as the server registers it (`:id` for an identifier), with a body that
 * passes its schema: a 401 must come from the missing session, never from a 400 on the body.
 */
const ROUTES: Readonly<Record<string, { body?: object }>> = {
  // Sessionless (BACKOFFICE_SESSIONLESS_ROUTES): their own tests are t8-backoffice-sign-in and
  // t14-backoffice-invitations-route; here, only the surface.
  "POST /v1/bo/auth/login": {},
  "POST /v1/bo/auth/enroll": {},
  "POST /v1/bo/auth/enroll/confirm": {},
  "POST /v1/bo/auth/invitation/accept": {},
  "POST /v1/bo/auth/logout": {},
  // Behind the session.
  "POST /v1/bo/auth/reauthenticate": {
    body: { password: "correct horse battery staple", code: "123456" },
  },
  "GET /v1/bo/me": {},
  "GET /v1/bo/accounts": {},
  "POST /v1/bo/accounts/search": {
    body: { email: "t14-inventory-search@example.test" },
  },
  "GET /v1/bo/accounts/counters": {},
  "GET /v1/bo/accounts/:id": {},
  "POST /v1/bo/accounts/:id/corrections": {
    body: { reasonCode: "signup_error", countryCode: "BE" },
  },
  "POST /v1/bo/accounts/:id/brevo-suppression/lift": {
    body: { reasonCode: "member_request" },
  },
  "POST /v1/bo/leads/replays": {
    body: {
      items: [{ accountId: NIL, destination: "brevo" }],
      reasonCode: "provider_recovered",
    },
  },
  "GET /v1/bo/settings/apollo": {},
  "GET /v1/bo/alerts": {},
  "GET /v1/bo/dual-control": {},
  "POST /v1/bo/dual-control": {
    body: {
      code: "leads.change_apollo_setting",
      setting: { key: "apollo_scope", value: "annonceurs_seuls" },
      reasonCode: "founder_decision",
    },
  },
  "GET /v1/bo/dual-control/degraded": {},
  "GET /v1/bo/dual-control/:id": {},
  "POST /v1/bo/dual-control/:id/confirm": { body: {} },
  "POST /v1/bo/dual-control/:id/cancel": {},
  "GET /v1/bo/internal-accounts": {},
  "GET /v1/bo/internal-invitations": {},
  "POST /v1/bo/internal-invitations": {
    body: {
      email: "t14-inventory-route@example.test",
      role: "agent",
      reasonCode: "new_team_member",
    },
  },
  "POST /v1/bo/internal-invitations/:id/revoke": {
    body: { reasonCode: "no_longer_needed" },
  },
  "GET /v1/bo/member-invitations": {},
  "POST /v1/bo/member-invitations": {
    body: {
      email: "t14-inventory-route-member@example.test",
      proposedRole: "creator",
      preferredLanguage: "fr",
    },
  },
  "POST /v1/bo/member-invitations/:id/revoke": {
    body: { reasonCode: "no_longer_needed" },
  },
};

let database: ApiDatabase;
const internals: string[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Internal = { accountId: string; session: string };

/** An active agent or admin with a TOTP factor, and a backoffice session proven by TOTP now. */
async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-inv-${role}-${accountId}@example.test`},
              now(), 'FR', 'fr', 'Dominique', true, now(), 'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, 'Dominique', now(), now(), ${randomUUID()})`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')`;
  });
  internals.push(accountId);
  return { accountId, session: token.toString("base64url") };
}

/** A member account with a session (the member cookie presented on the backoffice surface). */
async function newMember(): Promise<{ accountId: string; session: string }> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-inv-member-${accountId}@example.test`},
              now(), 'FR', 'fr', true, now(), 'individual')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'creator')`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')`;
  });
  return { accountId, session: token.toString("base64url") };
}

function app() {
  return buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
    database,
    identity: { backofficeAuthFloorMs: 0 },
  });
}

type Server = ReturnType<typeof app>;

function call(
  server: Server,
  method: Method,
  url: string,
  session: string | null,
  body?: object,
  options: { surface?: "backoffice" | "web"; cookie?: string } = {},
): Promise<LightMyRequestResponse> {
  const cookieName = options.cookie ?? "__Host-influx-ops-session";
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

/** T14.4: the whole answer but its request id — status, code and message. */
function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

/** "GET /v1/bo/accounts/:id" ⇒ its method and the path with `id` in place of the parameter. */
function concrete(route: string, id: string): { method: Method; url: string } {
  const [method = "", path = ""] = route.split(" ");
  return { method: method as Method, url: path.replace(":id", id) };
}

/**
 * The routes the server registers under /v1/bo/, as "METHOD /path" (HEAD of a GET left out),
 * rebuilt from the tree of `printRoutes`: each line is a segment, nested by its indentation, with
 * the methods of the route that ends there.
 */
async function registeredRoutes(server: Server): Promise<string[]> {
  await server.ready();
  const found: string[] = [];
  const stack: { depth: number; path: string }[] = [];
  for (const line of server.printRoutes({ commonPrefix: false }).split("\n")) {
    const match = /^([\s│├└─]*)(\S.*?)(?: \(([A-Z, ]+)\))?$/.exec(line);
    if (match === null) {
      continue;
    }
    const [, indent = "", segment = "", methods] = match;
    while ((stack.at(-1)?.depth ?? -1) >= indent.length) {
      stack.pop();
    }
    const path = `${stack.at(-1)?.path ?? ""}${segment}`;
    stack.push({ depth: indent.length, path });
    if (methods === undefined || !path.startsWith("/v1/bo/")) {
      continue;
    }
    for (const method of methods.split(", ")) {
      if (method !== "HEAD") {
        found.push(`${method} ${path}`);
      }
    }
  }
  return found.sort();
}

let agent: Internal;
let otherAgent: Internal;
let admin: Internal;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  agent = await newInternal("agent");
  otherAgent = await newInternal("agent");
  admin = await newInternal("admin");
});

afterAll(async () => {
  await closeDatabase(database);
  if (internals.length > 0) {
    await migrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------

describe("T14: the inventory of /v1/bo/* is the server's own (18 T14.1)", () => {
  it("every route the server registers under /v1/bo/ is in the table, and every route of the table exists", async () => {
    const registered = await registeredRoutes(app());
    expect(registered.length).toBeGreaterThan(0);
    expect(registered).toEqual(Object.keys(ROUTES).sort());
  });

  it("the sessionless routes are exactly the closed list of 03 §6.2, all of them POST", () => {
    const sessionless = Object.keys(ROUTES)
      .filter((route) =>
        BACKOFFICE_SESSIONLESS_ROUTES.includes(route.split(" ")[1] ?? ""),
      )
      .sort();
    expect(sessionless).toEqual(
      BACKOFFICE_SESSIONLESS_ROUTES.map((path) => `POST ${path}`).sort(),
    );
  });
});

describe("T14.1 on every route of /v1/bo/* (03 §6.2)", () => {
  it("the web surface never reaches one: the 404 of an unknown route, even with a member cookie", async () => {
    const server = app();
    const member = await newMember();
    const unknown = answer(
      await call(
        server,
        "GET",
        "/v1/bo/no-such-route",
        member.session,
        undefined,
        {
          surface: "web",
          cookie: "__Host-influx-session",
        },
      ),
    );
    expect(unknown.status).toBe(404);
    for (const [route, { body }] of Object.entries(ROUTES)) {
      const { method, url } = concrete(route, NIL);
      expect(
        answer(
          await call(server, method, url, member.session, body, {
            surface: "web",
            cookie: "__Host-influx-session",
          }),
        ),
        route,
      ).toEqual(unknown);
    }
  });

  it("behind the session: 401 unauthenticated without a session, and with a member session", async () => {
    const server = app();
    const member = await newMember();
    for (const [route, { body }] of Object.entries(ROUTES)) {
      const { method, url } = concrete(route, NIL);
      if (BACKOFFICE_SESSIONLESS_ROUTES.includes(url)) {
        continue;
      }
      for (const session of [null, member.session]) {
        const got = answer(await call(server, method, url, session, body));
        expect(
          got.status,
          `${route} (${session === null ? "none" : "member"})`,
        ).toBe(401);
        expect(got.error.code, route).toBe("unauthenticated");
      }
    }
  });
});

describe("T14.3, T14.4: an object that is not the caller's answers like one that does not exist", () => {
  it("the table names every route with an identifier", () => {
    expect(
      Object.keys(ROUTES)
        .filter((route) => route.includes(":id"))
        .sort(),
    ).toEqual(Object.keys(IDOR_CASES).sort());
  });

  /** Per route with an identifier: who asks, and an id that exists but is not theirs to touch. */
  const IDOR_CASES: Readonly<
    Record<string, () => Promise<{ who: Internal; id: string }[]>>
  > = {
    // An internal account (and the caller's own) is no member account (15 RG36, 03 C(3)).
    "GET /v1/bo/accounts/:id": async () => [
      { who: agent, id: admin.accountId },
      { who: agent, id: agent.accountId },
    ],
    "POST /v1/bo/accounts/:id/corrections": async () => [
      { who: agent, id: otherAgent.accountId },
      { who: admin, id: admin.accountId },
    ],
    "POST /v1/bo/accounts/:id/brevo-suppression/lift": async () => [
      { who: admin, id: agent.accountId },
      { who: admin, id: admin.accountId },
    ],
    // An agent never reaches the dual control (admins only): existing or not, the same answer.
    "GET /v1/bo/dual-control/:id": async () => [
      { who: agent, id: await dualControlRequest() },
    ],
    "POST /v1/bo/dual-control/:id/confirm": async () => [
      { who: agent, id: await dualControlRequest() },
    ],
    "POST /v1/bo/dual-control/:id/cancel": async () => [
      { who: agent, id: await dualControlRequest() },
    ],
    "POST /v1/bo/internal-invitations/:id/revoke": async () => [
      { who: agent, id: await internalInvitation() },
    ],
    // EC-J8-31: an agent's invitation is invisible to another agent.
    "POST /v1/bo/member-invitations/:id/revoke": async () => [
      { who: otherAgent, id: await memberInvitation() },
    ],
  };

  let pendingRequest: Promise<string> | undefined;

  /** One pending request of the admin, shared by the three cases (one per setting at a time). */
  function dualControlRequest(): Promise<string> {
    pendingRequest ??= requestDualControl();
    return pendingRequest;
  }

  afterAll(async () => {
    if (pendingRequest !== undefined) {
      const id = await pendingRequest;
      await call(
        app(),
        "POST",
        `/v1/bo/dual-control/${id}/cancel`,
        admin.session,
      );
    }
  });

  async function requestDualControl(): Promise<string> {
    const response = await call(
      app(),
      "POST",
      "/v1/bo/dual-control",
      admin.session,
      ROUTES["POST /v1/bo/dual-control"]?.body,
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ id: string }>().id;
  }

  async function internalInvitation(): Promise<string> {
    const response = await call(
      app(),
      "POST",
      "/v1/bo/internal-invitations",
      admin.session,
      {
        email: `t14-inventory-${randomUUID()}@example.test`,
        role: "agent",
        reasonCode: "new_team_member",
      },
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ invitationId: string }>().invitationId;
  }

  async function memberInvitation(): Promise<string> {
    const response = await call(
      app(),
      "POST",
      "/v1/bo/member-invitations",
      agent.session,
      {
        email: `t14-inventory-member-${randomUUID()}@example.test`,
        proposedRole: "creator",
        preferredLanguage: "fr",
      },
    );
    expect(response.statusCode).toBe(200);
    return response.json<{ invitationId: string }>().invitationId;
  }

  it("each route with an identifier: same status, code and message as an unknown id, for each role", async () => {
    const server = app();
    for (const [route, cases] of Object.entries(IDOR_CASES)) {
      const body = ROUTES[route]?.body;
      for (const { who, id } of await cases()) {
        const unknown = concrete(route, randomUUID());
        const other = concrete(route, id);
        const expected = answer(
          await call(server, unknown.method, unknown.url, who.session, body),
        );
        expect(expected.status, route).toBeGreaterThanOrEqual(400);
        expect(
          answer(
            await call(server, other.method, other.url, who.session, body),
          ),
          `${route} (${who === admin ? "admin" : "agent"})`,
        ).toEqual(expected);
      }
    }
  });
});
