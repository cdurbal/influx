// T14 (J9, commit 9) — the "Santé technique" routes of the backoffice, on the local stack through
// the pools of apps/api (docs/mvp/02 §20.5; 15 RG165; 18 T14.1, T14.3, T14.4; 21 §J9 point 9,
// EC-J9-5; migration 0148):
//   GET /v1/bo/ops/status, /v1/bo/ops/errors, /v1/bo/ops/errors/:id, /v1/bo/ops/traffic,
//   /v1/bo/ops/processes.
// Admins only, read only. T14 on each route: the web surface never reaches them (the 404 of an
// unknown route), no session and a member session answer 401, an agent is refused with 403 AND
// journaled (backoffice.action_refused {ops.read_health}, 05 CA63) whatever the group asked for, and
// an admin reads: every answer passes the response schema of the route (a shape that drifts is a
// 500 here), carries `Cache-Control: no-store`, and holds nothing of 02 §20.8.
// The fixtures (an agent, an admin, a member, error groups, route metrics, a probe line) are
// COMMITTED by the migration role (random identifiers, disposable local stack, like TM1) and removed
// after the file; the internal profiles are deactivated.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
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

const RUN = randomUUID().replace(/-/g, "").slice(0, 12);
const ROUTE_MODEL = `/v1/t14ops/${RUN}`;
const INSTANCE = `t14ops-${RUN}`;
const NIL = "00000000-0000-4000-8000-000000000000";

const ROUTES = [
  "/v1/bo/ops/status",
  "/v1/bo/ops/errors",
  `/v1/bo/ops/errors/${NIL}`,
  "/v1/bo/ops/traffic",
  "/v1/bo/ops/processes",
] as const;

let database: ApiDatabase;
const internals: string[] = [];
const fingerprints: Buffer[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Caller = { accountId: string; session: string };

async function newInternal(role: "agent" | "admin"): Promise<Caller> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-ops-${role}-${accountId}@example.test`},
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

async function newMember(): Promise<Caller> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-ops-member-${accountId}@example.test`},
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

function get(
  server: ReturnType<typeof app>,
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
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
  });
}

async function group(
  label: string,
  status: "new" | "acknowledged" | "fixed",
  regressions = 0,
): Promise<string> {
  const fingerprint = randomBytes(32);
  fingerprints.push(fingerprint);
  const [row] = await migrationRole()<{ id: string }[]>`
    insert into ops.error_groups
      (fingerprint, source, service, error_type, message, route, status, regression_count,
       first_seen_at, first_version, last_version)
    values (${fingerprint}, 'server', 'api', 'TypeError', ${`t14ops ${RUN} ${label}`},
            ${ROUTE_MODEL}, ${status}::ops.error_status, ${regressions},
            now() - interval '2 days', 'abc123', 'abc123')
    returning id::text`;
  await migrationRole()`
    insert into ops.error_occurrences
      (group_fingerprint, service, version, route, request_id, account_id, message, stack)
    values (${fingerprint}, 'api', 'abc123', ${ROUTE_MODEL}, ${randomUUID()}, ${randomUUID()},
            'Cannot read properties of undefined', 'TypeError: x\n    at handler (src/x.ts:1:1)')`;
  return row?.id ?? "";
}

let agent: Caller;
let admin: Caller;
let acknowledged = "";

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
  admin = await newInternal("admin");
  await group("new", "new");
  acknowledged = await group("ack", "acknowledged");
  await group("regression", "new", 2);
  await group("fixed", "fixed");
  await migrationRole()`
    insert into ops.request_metrics
      (minute, service, instance, method, route, request_count, server_error_count,
       throttled_count, duration_buckets)
    values (date_trunc('minute', now() - interval '2 minutes'), 'api', ${INSTANCE}, 'GET', ${ROUTE_MODEL},
            100, 5, 1, '{40,30,10,10,5,3,1,1,0}'::integer[])`;
  await migrationRole()`
    insert into ops.process_metrics
      (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms, rss_bytes,
       heap_used_bytes, cpu_percent)
    values (date_trunc('minute', now() - interval '2 minutes'), 'api', ${INSTANCE}, 12, 60,
            200000000, 80000000, 7.5)`;
});

afterAll(async () => {
  await migrationRole()`
    delete from ops.request_metrics where instance = ${INSTANCE}`;
  await migrationRole()`
    delete from ops.process_metrics where instance = ${INSTANCE}`;
  // the occurrences go with their group (on delete cascade)
  for (const fingerprint of fingerprints) {
    await migrationRole()`
      delete from ops.error_groups where fingerprint = ${fingerprint}`;
  }
  await closeDatabase(database);
  if (internals.length > 0) {
    await migrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------

describe("T14.1 on the routes of the screen", () => {
  it("the web surface never reaches one: the 404 of an unknown route, even with a member cookie", async () => {
    const server = app();
    const member = await newMember();
    const options = { surface: "web", cookie: "__Host-influx-session" } as const;
    const unknown = await get(server, "/v1/bo/no-such-route", member.session, options);
    for (const url of ROUTES) {
      const response = await get(server, url, member.session, options);
      expect(response.statusCode, url).toBe(unknown.statusCode);
      expect(response.json<{ error: { code: string } }>().error.code, url).toBe(
        unknown.json<{ error: { code: string } }>().error.code,
      );
    }
  });

  it("no session and a member session: 401 on every route", async () => {
    const server = app();
    const member = await newMember();
    for (const url of ROUTES) {
      for (const session of [null, member.session]) {
        const response = await get(server, url, session);
        expect(response.statusCode, url).toBe(401);
        expect(response.json<{ error: { code: string } }>().error.code).toBe(
          "unauthenticated",
        );
      }
    }
  });
});

describe("an agent is refused and journaled (05 CA63)", () => {
  it("403 forbidden on every route, a group that exists or not, one trace per attempt", async () => {
    const server = app();
    const lines = async () =>
      migrationRole()<{ n: string }[]>`
        select count(*)::text as n from audit.audit_events
         where event_type = 'backoffice.action_refused' and subject_id = ${agent.accountId}
           and payload ->> 'action_code' = 'ops.read_health'`;
    const before = Number((await lines())[0]?.n);
    const urls = [
      ...ROUTES,
      `/v1/bo/ops/errors/${acknowledged}`,
      "/v1/bo/ops/errors?state=all",
      "/v1/bo/ops/traffic?window=week",
    ];
    for (const url of urls) {
      const response = await get(server, url, agent.session);
      expect(response.statusCode, url).toBe(403);
      expect(response.json<{ error: { code: string } }>().error.code, url).toBe(
        "forbidden",
      );
      expect(response.headers["cache-control"], url).toBe("no-store");
    }
    expect(Number((await lines())[0]?.n) - before).toBe(urls.length);
  });
});

describe("an admin reads the screen", () => {
  it("status: the four targets, the worker, the periodic tasks and the alerts, as the contract says", async () => {
    const response = await get(app(), "/v1/bo/ops/status", admin.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<{
      probes: { target: string }[];
      worker: { state: string; processes: unknown[] };
    }>();
    expect(body.probes.map((probe) => probe.target).sort()).toEqual([
      "api_health",
      "backoffice_sign_in",
      "web_home_en",
      "web_home_fr",
    ]);
    expect(["running", "silent", "unknown"]).toContain(body.worker.state);
  });

  it("errors: the open groups by default, a regression flagged, a state and a source chosen", async () => {
    const server = app();
    const open = (
      await get(server, "/v1/bo/ops/errors", admin.session)
    ).json<{
      state: string;
      groups: { message: string; status: string; regression: boolean }[];
      counts: Record<string, number>;
    }>();
    expect(open.state).toBe("open");
    const mine = open.groups.filter((g) =>
      g.message.startsWith(`t14ops ${RUN} `),
    );
    expect(mine.map((g) => g.message.slice(`t14ops ${RUN} `.length)).sort()).toEqual([
      "ack",
      "new",
      "regression",
    ]);
    expect(mine.find((g) => g.message.endsWith("regression"))?.regression).toBe(true);
    expect(mine.find((g) => g.message.endsWith(" new"))?.regression).toBe(false);

    const fixed = (
      await get(server, "/v1/bo/ops/errors?state=fixed&source=server", admin.session)
    ).json<{ groups: { message: string }[] }>();
    expect(
      fixed.groups.filter((g) => g.message.startsWith(`t14ops ${RUN} `)),
    ).toHaveLength(1);
    const browser = (
      await get(server, "/v1/bo/ops/errors?state=all&source=browser", admin.session)
    ).json<{ groups: { message: string }[] }>();
    expect(
      browser.groups.filter((g) => g.message.startsWith(`t14ops ${RUN} `)),
    ).toHaveLength(0);
  });

  it("errors: another state, another source or an unknown parameter is a 400, never a guess", async () => {
    const server = app();
    for (const url of [
      "/v1/bo/ops/errors?state=everything",
      "/v1/bo/ops/errors?source=worker",
      "/v1/bo/ops/errors?q=x",
      "/v1/bo/ops/traffic?window=month",
      "/v1/bo/ops/traffic?route=x",
    ]) {
      const response = await get(server, url, admin.session);
      expect(response.statusCode, url).toBe(400);
    }
  });

  it("errors/:id: the group and its occurrences with the request and the account; unknown: 404", async () => {
    const server = app();
    const found = await get(server, `/v1/bo/ops/errors/${acknowledged}`, admin.session);
    expect(found.statusCode).toBe(200);
    const detail = found.json<{
      group: { id: string; status: string };
      occurrences: { requestId: string | null; accountId: string | null; stack: string | null }[];
    }>();
    expect(detail.group).toMatchObject({ id: acknowledged, status: "acknowledged" });
    expect(detail.occurrences).toHaveLength(1);
    expect(detail.occurrences[0]?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(detail.occurrences[0]?.accountId).toMatch(/^[0-9a-f-]{36}$/);
    const unknown = await get(server, `/v1/bo/ops/errors/${randomUUID()}`, admin.session);
    expect(unknown.statusCode).toBe(404);
    expect((await get(server, "/v1/bo/ops/errors/not-a-uuid", admin.session)).statusCode).toBe(400);
  });

  it("traffic: the p95 comes from the histogram, never stored: 100 calls, p95 = the 95th, in its bucket", async () => {
    const response = await get(app(), "/v1/bo/ops/traffic?window=hour", admin.session);
    expect(response.statusCode).toBe(200);
    const traffic = response.json<{
      bucketSeconds: number;
      routes: {
        method: string;
        route: string;
        summary: { calls: number; serverErrors: number; throttled: number; p95Ms: number | null; p95Beyond: boolean };
        points: { calls: number; open: boolean }[];
      }[];
      total: { points: unknown[] };
    }>();
    expect(traffic.bucketSeconds).toBe(300);
    const mine = traffic.routes.find((route) => route.route === ROUTE_MODEL);
    // 100 calls: 40, 30, 10, 10, 5, 3, 1, 1, 0 — the 95th call falls in the 5th bucket (<= 500 ms)
    expect(mine?.summary).toMatchObject({
      calls: 100,
      serverErrors: 5,
      throttled: 1,
      p95Ms: 500,
      p95Beyond: false,
    });
    expect(mine?.points).toHaveLength(12);
    expect(mine?.points.reduce((total, point) => total + point.calls, 0)).toBe(100);
    expect(mine?.points.at(-1)?.open).toBe(true);
    expect(traffic.total.points).toHaveLength(12);
  });

  it("processes: each process with its last sample, the connections of the base", async () => {
    const response = await get(app(), "/v1/bo/ops/processes", admin.session);
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      processes: { instance: string; eventLoopDelayP99Ms: number; cpuPercent: number }[];
      database: { samples: unknown[] };
    }>();
    expect(body.processes.find((p) => p.instance === INSTANCE)).toMatchObject({
      eventLoopDelayP99Ms: 12,
      cpuPercent: 7.5,
    });
    expect(Array.isArray(body.database.samples)).toBe(true);
  });

  it("nothing of 02 §20.8 in any answer: no address, no URL with a query, no IP", async () => {
    const server = app();
    const texts: string[] = [];
    for (const url of [
      "/v1/bo/ops/status",
      "/v1/bo/ops/errors?state=all",
      `/v1/bo/ops/errors/${acknowledged}`,
      "/v1/bo/ops/traffic?window=day",
      "/v1/bo/ops/processes",
    ]) {
      texts.push((await get(server, url, admin.session)).body);
    }
    const all = texts.join("\n");
    expect(all).not.toMatch(/@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
    expect(all).not.toMatch(/https?:\/\//);
    expect(all).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });
});
