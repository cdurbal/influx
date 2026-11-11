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
import { localSuperuser, migrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";

type Method = "GET" | "POST" | "PUT";

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
  "GET /v1/bo/queues/counters": {},
  "GET /v1/bo/queues/profiles-advertiser/entries": {},
  "POST /v1/bo/queues/profiles-advertiser/entries/search": { body: {} },
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/open": {},
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/publish": {
    body: { reviewToken: "0".repeat(64) },
  },
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/reject": {
    body: {
      reviewToken: "0".repeat(64),
      reasonCode: "presentation_insufficient",
    },
  },
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/release": {},
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/extend": {},
  "GET /v1/bo/queues/profiles-advertiser/entries/:id/logo": {},
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  // L2G 11: queue 2 (the creator profiles, 0243, 0244) and queue 3 (the visuals of the portfolios)
  "GET /v1/bo/queues/profiles-creator/entries": {},
  "POST /v1/bo/queues/profiles-creator/entries/search": { body: {} },
  "POST /v1/bo/queues/profiles-creator/entries/:id/open": {},
  "POST /v1/bo/queues/profiles-creator/entries/:id/publish": {
    body: { reviewToken: "0".repeat(64) },
  },
  "POST /v1/bo/queues/profiles-creator/entries/:id/reject": {
    body: { reviewToken: "0".repeat(64), reasonCode: "bio_insufficient" },
  },
  "POST /v1/bo/queues/profiles-creator/entries/:id/release": {},
  "POST /v1/bo/queues/profiles-creator/entries/:id/extend": {},
  "POST /v1/bo/queues/profiles-creator/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "GET /v1/bo/queues/profiles-creator/entries/:id/portfolio/:itemId/image": {},
  "GET /v1/bo/queues/portfolio-moderation/entries": {},
  "POST /v1/bo/queues/portfolio-moderation/entries/search": { body: {} },
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/open": {},
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/approve": {
    body: { reviewToken: "0".repeat(64) },
  },
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/reject": {
    body: { reviewToken: "0".repeat(64), reasonCode: "watermark" },
  },
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/release": {},
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/extend": {},
  "POST /v1/bo/queues/portfolio-moderation/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "GET /v1/bo/queues/portfolio-moderation/entries/:id/image": {},
  "GET /v1/bo/queues/verification-creators/entries": {},
  "POST /v1/bo/queues/verification-creators/entries/search": { body: {} },
  "POST /v1/bo/queues/verification-creators/entries/:id/open": {},
  "POST /v1/bo/queues/verification-creators/entries/:id/reexamine": {
    body: { reviewToken: "0".repeat(64), reasonCode: "network_unreachable" },
  },
  "POST /v1/bo/queues/verification-creators/entries/:id/reject": {
    body: {
      reviewToken: "0".repeat(64),
      reasonCode: "other",
      memberMessage: "A message of at least twenty characters.",
    },
  },
  "POST /v1/bo/queues/verification-creators/entries/:id/release": {},
  "POST /v1/bo/queues/verification-creators/entries/:id/extend": {},
  "POST /v1/bo/queues/verification-creators/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "POST /v1/bo/queues/verification-creators/entries/:id/compare": {
    body: {
      reviewToken: "0".repeat(64),
      followers: 1,
      postsLast30Days: 1,
      avgComments: 1,
      engagementBp: null,
    },
  },
  "POST /v1/bo/queues/verification-creators/entries/:id/grant-account": {
    body: {
      reviewToken: "0".repeat(64),
      observedCode: "INFLUX-ABCDEFGH",
      observedHandle: "t14_inventory",
    },
  },
  "POST /v1/bo/queues/verification-creators/entries/:id/grant-audience": {
    body: {
      reviewToken: "0".repeat(64),
      followers: 1,
      postsLast30Days: 1,
      avgComments: 1,
      engagementBp: null,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-02",
      observedHandle: "t14_inventory",
    },
  },
  "GET /v1/bo/queues/verification-creators/entries/:id/evidence/:evidenceId":
    {},
  "GET /v1/bo/queues/verification-brands/entries": {},
  "POST /v1/bo/queues/verification-brands/entries/search": { body: {} },
  "POST /v1/bo/queues/verification-brands/entries/:id/open": {},
  "POST /v1/bo/queues/verification-brands/entries/:id/reexamine": {
    body: { reviewToken: "0".repeat(64), reasonCode: "network_unreachable" },
  },
  "POST /v1/bo/queues/verification-brands/entries/:id/reject": {
    body: {
      reviewToken: "0".repeat(64),
      reasonCode: "other",
      memberMessage: "A message of at least twenty characters.",
    },
  },
  "POST /v1/bo/queues/verification-brands/entries/:id/release": {},
  "POST /v1/bo/queues/verification-brands/entries/:id/extend": {},
  "POST /v1/bo/queues/verification-brands/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "POST /v1/bo/queues/verification-brands/entries/:id/grant": {
    body: {
      reviewToken: "0".repeat(64),
      observedCode: "INFLUX-ABCDEFGH",
      observedDomain: "t14-inventory.example.test",
      observedChannel: "dns_txt",
      registrySourceId: NIL,
    },
  },
  // L2F 14: queue 5 (the contests) and queue 6 (the identifiers changed)
  "GET /v1/bo/queues/verification-disputes/entries": {},
  "POST /v1/bo/queues/verification-disputes/entries/search": { body: {} },
  "POST /v1/bo/queues/verification-disputes/entries/:id/open": {},
  "POST /v1/bo/queues/verification-disputes/entries/:id/release": {},
  "POST /v1/bo/queues/verification-disputes/entries/:id/extend": {},
  "POST /v1/bo/queues/verification-disputes/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "POST /v1/bo/queues/verification-disputes/entries/:id/uphold": {
    body: {
      reviewToken: "0".repeat(64),
      outcomeReasonCode: "decision_confirmed",
    },
  },
  "POST /v1/bo/queues/verification-disputes/entries/:id/overturn": {
    body: {
      target: "revocation",
      reviewToken: "0".repeat(64),
      observedHandle: "t14_inventory",
    },
  },
  "GET /v1/bo/queues/verification-disputes/entries/:id/evidence/:evidenceId":
    {},
  "GET /v1/bo/queues/identifier-changes/entries": {},
  "POST /v1/bo/queues/identifier-changes/entries/search": { body: {} },
  "POST /v1/bo/queues/identifier-changes/entries/:id/open": {},
  "POST /v1/bo/queues/identifier-changes/entries/:id/release": {},
  "POST /v1/bo/queues/identifier-changes/entries/:id/extend": {},
  "POST /v1/bo/queues/identifier-changes/entries/:id/force-release": {
    body: { reasonCode: "holder_absent" },
  },
  "POST /v1/bo/queues/identifier-changes/entries/:id/confirm": {
    body: { reviewToken: "0".repeat(64), observedHandle: "t14_inventory" },
  },
  "POST /v1/bo/queues/identifier-changes/entries/:id/require-proof": {
    body: { reviewToken: "0".repeat(64) },
  },
  "GET /v1/bo/settings/apollo": {},
  // L2F 13: the badges of a member account, and the request of the withdrawal of one (opens a 2V)
  "GET /v1/bo/accounts/:id/badges": {},
  "POST /v1/bo/accounts/:id/badges/:badgeId/revocation": {
    body: { reasonCode: "forged_evidence" },
  },
  // L2F 15 (D83): a verification opened by an agent for a member, and the grant on the login address
  // (L2F 20: what the opening offers on the account, 0239)
  "GET /v1/bo/accounts/:id/verification-requests": {},
  "POST /v1/bo/accounts/:id/verification-requests": {
    body: {
      level: "brand_verified",
      socialAccountId: null,
      openingReasonCode: "existing_client",
    },
  },
  "POST /v1/bo/queues/verification-brands/entries/:id/grant-by-login": {
    body: { reviewToken: "0".repeat(64), registrySourceId: NIL },
  },
  // L2E 15: the registry sources of the brand's registration, read by agent and admin, written by admin
  "GET /v1/bo/verification/registry-sources": {},
  // L2F 21 (0229): an administrator adds the register of a country or of one of its States
  "POST /v1/bo/verification/registry-sources": {
    body: {
      countryCode: "US",
      subdivisionCode: "US-CA",
      name: "Registry of the inventory",
      url: "https://registry.example.test/",
      checkedOn: "2026-01-01",
      isActive: false,
    },
  },
  "PUT /v1/bo/verification/registry-sources/:id": {
    body: {
      name: "Registry of the inventory",
      url: "https://registry.example.test/",
      checkedOn: "2026-01-01",
      isActive: false,
    },
  },
  "GET /v1/bo/alerts": {},
  "GET /v1/bo/ops/status": {},
  "GET /v1/bo/ops/errors": {},
  "GET /v1/bo/ops/errors/:id": {},
  "GET /v1/bo/ops/traffic": {},
  "GET /v1/bo/ops/processes": {},
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
  // L2C 18b: the logo of an entry is named by a query (the route model keeps one `:id`)
  const query = path.endsWith("/logo") ? `?logo=${NIL}` : "";
  return {
    method: method as Method,
    url: `${path.replace(":id", id).replace(":evidenceId", NIL).replace(":badgeId", NIL).replace(":itemId", NIL)}${query}`,
  };
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
    // L2C 11: the entry of the caller's own account is hidden by the database (0207, C(3)): the
    // answer of an unknown entry. (An entry of an account the caller holds answers its own 403,
    // 17b §2.5: t14-backoffice-queue-route.)
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/open": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    // L2C 12: the same for every act on an entry; the force release is an admin's, an agent's attempt
    // is refused whatever the entry (the answer of an agent never depends on the identifier).
    "GET /v1/bo/queues/profiles-advertiser/entries/:id/logo": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/publish": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/reject": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/release": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/extend": async () => [
      { who: agent, id: await ownBrandEntry() },
    ],
    "POST /v1/bo/queues/profiles-advertiser/entries/:id/force-release":
      async () => [{ who: agent, id: await ownBrandEntry() }],
    // L2G 11: an entry of queue 2 and a visual of queue 3 on the caller's own account are hidden by the
    // database (0242, 0243, C(3)): the answer of an unknown entry, on every route of both queues. (An
    // account the caller holds answers its own 403, 17b §2.5: t14-creator-queue-route.)
    "POST /v1/bo/queues/profiles-creator/entries/:id/open": async () => [
      { who: agent, id: (await ownCreatorFixture()).entryId },
    ],
    "POST /v1/bo/queues/profiles-creator/entries/:id/publish": async () => [
      { who: agent, id: (await ownCreatorFixture()).entryId },
    ],
    "POST /v1/bo/queues/profiles-creator/entries/:id/reject": async () => [
      { who: agent, id: (await ownCreatorFixture()).entryId },
    ],
    "POST /v1/bo/queues/profiles-creator/entries/:id/release": async () => [
      { who: agent, id: (await ownCreatorFixture()).entryId },
    ],
    "POST /v1/bo/queues/profiles-creator/entries/:id/extend": async () => [
      { who: agent, id: (await ownCreatorFixture()).entryId },
    ],
    "POST /v1/bo/queues/profiles-creator/entries/:id/force-release":
      async () => [{ who: agent, id: (await ownCreatorFixture()).entryId }],
    "GET /v1/bo/queues/profiles-creator/entries/:id/portfolio/:itemId/image":
      async () => [{ who: agent, id: (await ownCreatorFixture()).entryId }],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/open": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/approve": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/reject": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/release": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/extend": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    "POST /v1/bo/queues/portfolio-moderation/entries/:id/force-release":
      async () => [{ who: agent, id: (await ownCreatorFixture()).itemId }],
    "GET /v1/bo/queues/portfolio-moderation/entries/:id/image": async () => [
      { who: agent, id: (await ownCreatorFixture()).itemId },
    ],
    // L2E 14: a verification request of the caller's own account is hidden by the database (0221,
    // C(3)): the answer of an unknown request, on every route of both views (an own request of the
    // creator view on the creator routes, of the brand view on the brand routes).
    "POST /v1/bo/queues/verification-creators/entries/:id/open": async () => [
      { who: agent, id: await ownVerificationRequest("creator") },
    ],
    "POST /v1/bo/queues/verification-creators/entries/:id/reexamine":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-creators/entries/:id/reject": async () => [
      { who: agent, id: await ownVerificationRequest("creator") },
    ],
    "POST /v1/bo/queues/verification-creators/entries/:id/release":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-creators/entries/:id/extend": async () => [
      { who: agent, id: await ownVerificationRequest("creator") },
    ],
    "POST /v1/bo/queues/verification-creators/entries/:id/force-release":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-creators/entries/:id/compare":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-creators/entries/:id/grant-account":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-creators/entries/:id/grant-audience":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "GET /v1/bo/queues/verification-creators/entries/:id/evidence/:evidenceId":
      async () => [{ who: agent, id: await ownVerificationRequest("creator") }],
    "POST /v1/bo/queues/verification-brands/entries/:id/open": async () => [
      { who: agent, id: await ownVerificationRequest("brand") },
    ],
    "POST /v1/bo/queues/verification-brands/entries/:id/reexamine":
      async () => [{ who: agent, id: await ownVerificationRequest("brand") }],
    "POST /v1/bo/queues/verification-brands/entries/:id/reject": async () => [
      { who: agent, id: await ownVerificationRequest("brand") },
    ],
    "POST /v1/bo/queues/verification-brands/entries/:id/release": async () => [
      { who: agent, id: await ownVerificationRequest("brand") },
    ],
    "POST /v1/bo/queues/verification-brands/entries/:id/extend": async () => [
      { who: agent, id: await ownVerificationRequest("brand") },
    ],
    "POST /v1/bo/queues/verification-brands/entries/:id/force-release":
      async () => [{ who: agent, id: await ownVerificationRequest("brand") }],
    "POST /v1/bo/queues/verification-brands/entries/:id/grant": async () => [
      { who: agent, id: await ownVerificationRequest("brand") },
    ],
    // L2F 14: an entry of queue 5 or 6 on the caller's own account answers like an unknown entry (T14.3)
    "POST /v1/bo/queues/verification-disputes/entries/:id/open": async () => [
      { who: agent, id: await ownDispute() },
    ],
    "POST /v1/bo/queues/verification-disputes/entries/:id/release":
      async () => [{ who: agent, id: await ownDispute() }],
    "POST /v1/bo/queues/verification-disputes/entries/:id/extend": async () => [
      { who: agent, id: await ownDispute() },
    ],
    "POST /v1/bo/queues/verification-disputes/entries/:id/force-release":
      async () => [{ who: agent, id: await ownDispute() }],
    "POST /v1/bo/queues/verification-disputes/entries/:id/uphold": async () => [
      { who: agent, id: await ownDispute() },
    ],
    "POST /v1/bo/queues/verification-disputes/entries/:id/overturn":
      async () => [{ who: agent, id: await ownDispute() }],
    "GET /v1/bo/queues/verification-disputes/entries/:id/evidence/:evidenceId":
      async () => [{ who: agent, id: await ownDispute() }],
    "POST /v1/bo/queues/identifier-changes/entries/:id/open": async () => [
      { who: agent, id: await ownIdentifierReview() },
    ],
    "POST /v1/bo/queues/identifier-changes/entries/:id/release": async () => [
      { who: agent, id: await ownIdentifierReview() },
    ],
    "POST /v1/bo/queues/identifier-changes/entries/:id/extend": async () => [
      { who: agent, id: await ownIdentifierReview() },
    ],
    "POST /v1/bo/queues/identifier-changes/entries/:id/force-release":
      async () => [{ who: agent, id: await ownIdentifierReview() }],
    "POST /v1/bo/queues/identifier-changes/entries/:id/confirm": async () => [
      { who: agent, id: await ownIdentifierReview() },
    ],
    "POST /v1/bo/queues/identifier-changes/entries/:id/require-proof":
      async () => [{ who: agent, id: await ownIdentifierReview() }],
    // L2F 13: the badges and the withdrawal of an internal account, and of the caller's own, are the
    // answer of an unknown account; a badge that is not the account's answers like an unknown one.
    "GET /v1/bo/accounts/:id/badges": async () => [
      { who: agent, id: admin.accountId },
      { who: agent, id: agent.accountId },
    ],
    "POST /v1/bo/accounts/:id/badges/:badgeId/revocation": async () => [
      { who: agent, id: otherAgent.accountId },
      { who: admin, id: admin.accountId },
    ],
    // L2F 15: the opening for an internal account or the caller's own is the answer of an unknown account;
    // the grant on the login address of the caller's own brand request, that of an unknown entry
    "GET /v1/bo/accounts/:id/verification-requests": async () => [
      { who: agent, id: otherAgent.accountId },
      { who: admin, id: admin.accountId },
      { who: agent, id: agent.accountId },
    ],
    "POST /v1/bo/accounts/:id/verification-requests": async () => [
      { who: agent, id: otherAgent.accountId },
      { who: admin, id: admin.accountId },
    ],
    "POST /v1/bo/queues/verification-brands/entries/:id/grant-by-login":
      async () => [{ who: agent, id: await ownVerificationRequest("brand") }],
    // An agent never writes a registry source (admin only, 0224): one that exists or not, the same 403.
    "PUT /v1/bo/verification/registry-sources/:id": async () => [
      { who: agent, id: await anyRegistrySource() },
    ],
    // An agent never reaches the "Santé technique" screen (admins only): a group that exists or not,
    // the same refusal.
    "GET /v1/bo/ops/errors/:id": async () => [
      { who: agent, id: await errorGroup() },
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

  /**
   * An entry of queue 1 on the agent's own account. One role per account (D41) makes it impossible
   * through the doors, so the superuser writes it with the foreign keys and the trigger of the
   * deadlines out of the way: the policy is a second line, and this is how it is tried.
   */
  let ownEntry: Promise<string> | undefined;

  /** One open entry per account (the unique index): shared by every route that tries it. */
  function ownBrandEntry(): Promise<string> {
    ownEntry ??= writeOwnBrandEntry();
    return ownEntry;
  }

  async function writeOwnBrandEntry(): Promise<string> {
    const entryId = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name, status, submitted_at)
        values (${agent.accountId}, 'Own account', 'pending_review', now())
        on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_review_entries
          (id, account_id, kind, created_at, sla_due_at, escalate_at)
        values (${entryId}, ${agent.accountId}, 'submission', now(), now() + interval '1 day',
                now() + interval '2 days')`;
    });
    ownEntries.push(entryId);
    return entryId;
  }

  const ownEntries: string[] = [];

  type OwnCreator = { entryId: string; itemId: string };
  let ownCreator: Promise<OwnCreator> | undefined;

  /**
   * A storefront of the agent's own account with an open entry of queue 2 and a pending visual of queue
   * 3 (L2G 11): the doors never write them (one role per account, D41), so the superuser writes them with
   * the foreign keys and the triggers out of the way; the policies of 0242 and 0243 are a second line,
   * and this is how they are tried. Removed with the file.
   */
  function ownCreatorFixture(): Promise<OwnCreator> {
    ownCreator ??= (async () => {
      const entryId = randomUUID();
      const itemId = randomUUID();
      await localSuperuser().begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          insert into profiles.creator_public_profiles
            (account_id, alias, residence_country_code, status)
          values (${agent.accountId}, profiles.new_creator_alias(), 'FR', 'pending_review')
          on conflict do nothing`;
        await tx`
          insert into profiles.creator_review_entries
            (id, account_id, kind, created_at, sla_due_at, escalate_at)
          values (${entryId}, ${agent.accountId}, 'submission', now(), now() + interval '1 day',
                  now() + interval '2 days')`;
        await tx`
          insert into profiles.portfolio_items
            (id, account_id, state, received_bytes, byte_size, width, height, checksum,
             exif_stripped, stored_at, sla_due_at, escalate_at)
          values (${itemId}, ${agent.accountId}, 'pending', 1000, 900, 1080, 1350,
                  ${"a".repeat(64)}, true, now(), now() + interval '1 day',
                  now() + interval '2 days')`;
      });
      return { entryId, itemId };
    })();
    return ownCreator;
  }

  afterAll(async () => {
    if (ownCreator !== undefined) {
      const { entryId, itemId } = await ownCreator;
      await localSuperuser().begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`delete from profiles.portfolio_items where id = ${itemId}`;
        await tx`delete from profiles.creator_review_entries where id = ${entryId}`;
        await tx`delete from profiles.creator_public_profiles where account_id = ${agent.accountId}`;
      });
    }
  });

  const ownRequests: Partial<Record<"creator" | "brand", Promise<string>>> = {};
  const ownRequestIds: string[] = [];

  /**
   * A pending verification request on the agent's own account, of the population asked: the doors never
   * write one (one role per account, D41), so the superuser writes it with the foreign keys and the
   * triggers out of the way; the policy of 0221 is a second line, and this is how it is tried.
   */
  function ownVerificationRequest(
    population: "creator" | "brand",
  ): Promise<string> {
    ownRequests[population] ??= writeOwnVerificationRequest(population);
    return ownRequests[population];
  }

  async function writeOwnVerificationRequest(
    population: "creator" | "brand",
  ): Promise<string> {
    const requestId = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (id, account_id, social_account_id, network_code, level, status, created_at,
           submitted_at, sla_due_at, escalate_at)
        values (${requestId}, ${agent.accountId},
                ${population === "creator" ? randomUUID() : null},
                ${population === "creator" ? "instagram" : null},
                ${population === "creator" ? "audience_verified" : "brand_verified"}::verification.badge_level,
                'pending', now(), now(), now() + interval '1 day', now() + interval '2 days')`;
    });
    ownRequestIds.push(requestId);
    return requestId;
  }

  const ownQueueIds: { dispute: string[]; review: string[] } = {
    dispute: [],
    review: [],
  };
  let ownDisputeEntry: Promise<string> | undefined;
  let ownReviewEntry: Promise<string> | undefined;

  /**
   * A contest (queue 5) on the agent's own account: the doors never write one, so the superuser writes
   * it with the foreign keys and the triggers out of the way; the policy of 0232 is a second line.
   */
  function ownDispute(): Promise<string> {
    ownDisputeEntry ??= (async () => {
      const id = randomUUID();
      await localSuperuser().begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          insert into verification.disputes
            (id, account_id, badge_id, level, network_code, reason_code, original_decider_ids,
             sla_due_at, escalate_at)
          values (${id}, ${agent.accountId}, ${randomUUID()}, 'audience_verified', 'instagram',
                  'misread', array[${otherAgent.accountId}]::uuid[], now() + interval '1 day',
                  now() + interval '2 days')`;
      });
      ownQueueIds.dispute.push(id);
      return id;
    })();
    return ownDisputeEntry;
  }

  /** An entry of queue 6 on the agent's own account, written the same way. */
  function ownIdentifierReview(): Promise<string> {
    ownReviewEntry ??= (async () => {
      const id = randomUUID();
      await localSuperuser().begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          insert into verification.identifier_change_reviews
            (id, account_id, social_account_id, network_code, badge_id, previous_handle, new_handle,
             sla_due_at, escalate_at)
          values (${id}, ${agent.accountId}, ${randomUUID()}, 'instagram', ${randomUUID()},
                  't14_before', 't14_after', now() + interval '1 day',
                  now() + interval '2 days')`;
      });
      ownQueueIds.review.push(id);
      return id;
    })();
    return ownReviewEntry;
  }

  afterAll(async () => {
    if (ownQueueIds.dispute.length > 0) {
      await migrationRole()`
        update verification.disputes set state = 'withdrawn', withdrawn_cause = 'account_erased', closed_at = now()
         where id = any(${ownQueueIds.dispute}::uuid[]) and state = 'open'`;
    }
    if (ownQueueIds.review.length > 0) {
      await migrationRole()`
        update verification.identifier_change_reviews set state = 'withdrawn', withdrawn_cause = 'account_erased', closed_at = now()
         where id = any(${ownQueueIds.review}::uuid[]) and state = 'open'`;
    }
  });

  afterAll(async () => {
    if (ownRequestIds.length > 0) {
      await migrationRole()`
        update verification.verification_requests set status = 'cancelled', cancelled_at = now(), closed_at = now()
         where id = any(${ownRequestIds}::uuid[]) and status = 'pending'`;
    }
  });

  afterAll(async () => {
    if (ownEntries.length > 0) {
      await migrationRole()`
        update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now()
         where id = any(${ownEntries}::uuid[]) and state = 'open'`;
    }
  });

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

  async function anyRegistrySource(): Promise<string> {
    const [row] = await migrationRole()<{ id: string }[]>`
      select id::text as id from verification.registry_sources order by id limit 1`;
    return row?.id ?? "";
  }

  /** One error group, committed by the migration role and removed with the file. */
  let groupFingerprint: Buffer | undefined;

  async function errorGroup(): Promise<string> {
    groupFingerprint = randomBytes(32);
    const [row] = await migrationRole()<{ id: string }[]>`
      insert into ops.error_groups
        (fingerprint, source, service, error_type, message, route, first_version, last_version)
      values (${groupFingerprint}, 'server', 'api', 'TypeError', 't14 inventory group',
              '/v1/t14/inventory', 'abc123', 'abc123')
      returning id::text`;
    return row?.id ?? "";
  }

  afterAll(async () => {
    if (groupFingerprint !== undefined) {
      await migrationRole()`
        delete from ops.error_groups where fingerprint = ${groupFingerprint}`;
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
