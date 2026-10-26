// The D60 collection of apps/api on the local stack (docs/mvp/02 §20.5, §20.8; 21 §4 J4 point 3):
// T13.6 extended to the ops tables (a fake address, code and token never reach them), the cap of
// ten occurrences per fingerprint and minute, the per-minute histogram, and the browser door
// POST /v1/ops/client-errors (session required, strict body, bounded rate).
import { randomUUID } from "node:crypto";
import {
  localRoleUrl,
  type DataSet,
  type LoginRole,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { OpsRecorder } from "../src/domains/ops/recorder.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole, testDataSet } from "./support.ts";

const localConnection = (role: LoginRole) => ({
  url: localRoleUrl(role),
  role,
  tls: false,
});

/** Letters only: digits would be scrubbed out of the route model. */
const RUN = randomUUID()
  .replace(/[^a-f]/g, "")
  .slice(0, 10)
  .padEnd(4, "x");
const INSTANCE = `opstest-${RUN}`;
const SECRETS = {
  email: "anne.martin@example.test",
  code: "482913",
  token: "sb_secret_Zq81mWp0Lk7Hx2Yv9Ab3",
  uuid: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
};

let migration: postgres.Sql;
let dataSet: DataSet;
let database: ApiDatabase;
const silent = {
  warn: (object: object, message: string) => {
    throw new Error(`${message} ${JSON.stringify(object)}`);
  },
  info: () => undefined,
};

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { error: () => undefined, ...silent },
  );
});

afterAll(async () => {
  await migration`delete from ops.error_groups where route like ${`/v1/opstest/${RUN}%`}
                   or route like ${`/fr/opstest/${RUN}%`}`;
  await closeDatabase(database);
});

function recorder(now: () => Date = () => new Date()): OpsRecorder {
  return new OpsRecorder({ version: "test", instance: INSTANCE, now });
}

describe("T13.6 on the ops tables (02 §20.8)", () => {
  it("writes no address, code, token nor identifier of an error, its stack included", async () => {
    const ops = recorder();
    const error = new TypeError(
      `Cannot read properties of undefined (reading '${SECRETS.email}') code ${SECRETS.code} ${SECRETS.token} ${SECRETS.uuid}`,
    );
    error.stack = `TypeError: ${error.message}\n    at verify (C:\\work\\influx\\apps\\api\\src\\domains\\identity\\verify-code.ts:12:5)\n    at ${SECRETS.email} (node:internal/process/task_queues:95:5)`;
    const requestId = randomUUID();
    ops.recordServerError(error, {
      route: `/v1/opstest/${RUN}/:id`,
      requestId,
    });
    await ops.flush(database, silent);
    const rows = await migration<{ text: string }[]>`
      select concat_ws(' | ', o.message, o.stack, o.route, g.message, g.route) as text
        from ops.error_occurrences o join ops.error_groups g on g.fingerprint = o.group_fingerprint
       where o.request_id = ${requestId}`;
    expect(rows).toHaveLength(1);
    const text = rows[0]?.text ?? "";
    for (const value of Object.values(SECRETS)) {
      expect(text).not.toContain(value);
    }
    expect(text).toContain("apps/api/src/domains/identity/verify-code.ts");
    expect(text).not.toContain("C:");
  });

  it("withholds the message of an error that is neither ours nor the engine's", async () => {
    const ops = recorder();
    const requestId = randomUUID();
    ops.recordServerError(
      Object.assign(new Error(`insert failed for ${SECRETS.email}`), {
        code: "23505",
      }),
      { route: `/v1/opstest/${RUN}/withheld`, requestId },
    );
    await ops.flush(database, silent);
    const [row] = await migration<{ message: string }[]>`
      select message from ops.error_occurrences where request_id = ${requestId}`;
    expect(row?.message).toBe("Error [<n>] (message withheld)");
  });
});

describe("cap and metrics (02 §20.5)", () => {
  it("keeps ten occurrences per fingerprint and minute, and counts all of them", async () => {
    const ops = recorder();
    for (let index = 0; index < 12; index += 1) {
      ops.recordServerError(new RangeError("out of range"), {
        route: `/v1/opstest/${RUN}/cap`,
      });
    }
    await ops.flush(database, silent);
    const [row] = await migration<{ kept: number; counted: string }[]>`
      select (select count(*)::int from ops.error_occurrences o
               where o.group_fingerprint = g.fingerprint) as kept,
             g.occurrence_count::text as counted
        from ops.error_groups g where g.route = ${`/v1/opstest/${RUN}/cap`}`;
    expect(row).toEqual({ kept: 10, counted: "12" });
  });

  it("writes an ended minute once, with a histogram that adds up", async () => {
    const minute = Math.floor((Date.now() - 120_000) / 60_000) * 60_000;
    let now = new Date(minute + 5_000);
    const ops = recorder(() => now);
    ops.recordRequest("GET", `/v1/opstest/${RUN}/metric`, 200, 10);
    ops.recordRequest("GET", `/v1/opstest/${RUN}/metric`, 500, 30);
    ops.recordRequest("GET", `/v1/opstest/${RUN}/metric`, 429, 6_000);
    await ops.flush(database, silent);
    const before = await migration`
      select 1 from ops.request_metrics where instance = ${INSTANCE}`;
    expect(before).toHaveLength(0);

    now = new Date(minute + 65_000);
    await ops.flush(database, silent);
    await ops.flush(database, silent);
    const rows = await migration<
      {
        request_count: number;
        server_error_count: number;
        throttled_count: number;
        duration_buckets: number[];
      }[]
    >`
      select request_count, server_error_count, throttled_count, duration_buckets
        from ops.request_metrics where instance = ${INSTANCE}`;
    expect(rows).toEqual([
      {
        request_count: 3,
        server_error_count: 1,
        throttled_count: 1,
        duration_buckets: [1, 1, 0, 0, 0, 0, 0, 0, 1],
      },
    ]);
    await migration`delete from ops.request_metrics where instance = ${INSTANCE}`;
  });

  it("writes the signals of an ended minute once (15 RG165, AL61 and AL62; 0147)", async () => {
    const minute = Math.floor((Date.now() - 120_000) / 60_000) * 60_000;
    let now = new Date(minute + 5_000);
    const ops = recorder(() => now);
    ops.recordSignal("webhook_brevo_authenticated");
    ops.recordSignal("webhook_brevo_authenticated");
    ops.recordSignal("webhook_brevo_ignored");
    await ops.flush(database, silent);
    const before = await migration`
      select 1 from ops.signal_counts where instance = ${INSTANCE}`;
    expect(before).toHaveLength(0);

    now = new Date(minute + 65_000);
    await ops.flush(database, silent);
    await ops.flush(database, silent);
    const rows = await migration<{ signal: string; count: number }[]>`
      select signal::text as signal, count from ops.signal_counts
       where instance = ${INSTANCE} order by signal`;
    expect(rows).toEqual([
      { signal: "webhook_brevo_authenticated", count: 2 },
      { signal: "webhook_brevo_ignored", count: 1 },
    ]);
    await migration`delete from ops.signal_counts where instance = ${INSTANCE}`;
  });
});

describe("POST /v1/ops/client-errors (02 §20.5)", () => {
  const ops = recorder();
  // J6T-8: the rate windows are fixed minutes; on the real clock, twelve reports straddling a minute
  // boundary were all accepted. A frozen clock keeps every report of this block in one minute.
  const frozen = new Date();
  let instance: ReturnType<typeof buildServer> | undefined;
  const server = () =>
    (instance ??= buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
      database,
      ops,
      identity: { now: () => frozen },
    }));

  function report(page: string, message: string) {
    return {
      kind: "error",
      errorType: "TypeError",
      message,
      stack: `TypeError: x\n    at render (https://influx.example/_next/static/chunks/app.js:1:200)`,
      page,
    };
  }

  function send(
    surface: "web" | "backoffice",
    body: unknown,
    session: Buffer | null,
  ) {
    const cookieName =
      surface === "web" ? "__Host-influx-session" : "__Host-influx-ops-session";
    return server().inject({
      method: "POST",
      url: "/v1/ops/client-errors",
      headers: {
        "x-influx-internal": surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
        "client-user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        ...(session === null
          ? {}
          : { cookie: `${cookieName}=${session.toString("base64url")}` }),
      },
      payload: JSON.stringify(body),
    });
  }

  it("refuses a report without a session (401) and a body outside the schema (400)", async () => {
    const page = `/fr/opstest/${RUN}/door`;
    expect(
      (await send("web", report(page, "no session"), null)).statusCode,
    ).toBe(401);
    const extra = { ...report(page, "extra key"), email: SECRETS.email };
    expect(
      (await send("web", extra, dataSet.accounts.advertiser.a.sessionToken))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await send(
          "web",
          { ...report(page, "query"), page: `${page}?email=${SECRETS.email}` },
          dataSet.accounts.advertiser.a.sessionToken,
        )
      ).statusCode,
    ).toBe(400);
  });

  it("records a member's report as web, and an agent's as backoffice, with the account", async () => {
    const member = dataSet.accounts.creator.a;
    const agent = dataSet.accounts.agent.a;
    const web = await send(
      "web",
      report(`/fr/opstest/${RUN}/member`, `member broke ${SECRETS.email}`),
      member.sessionToken,
    );
    const backoffice = await send(
      "backoffice",
      report(`/fr/opstest/${RUN}/agent`, "agent broke"),
      agent.sessionToken,
    );
    expect([web.statusCode, backoffice.statusCode]).toEqual([200, 200]);
    // A member session is no session on the backoffice surface.
    expect(
      (
        await send(
          "backoffice",
          report(`/fr/opstest/${RUN}/agent`, "member on bo"),
          member.sessionToken,
        )
      ).statusCode,
    ).toBe(401);
    await ops.flush(database, silent);
    const rows = await migration<
      {
        service: string;
        account_id: string;
        message: string;
        user_agent_summary: string;
      }[]
    >`
      select service::text, account_id::text, message, user_agent_summary
        from ops.error_occurrences
       where route in (${`/fr/opstest/${RUN}/member`}, ${`/fr/opstest/${RUN}/agent`})
       order by service`;
    expect(rows).toEqual([
      {
        service: "backoffice",
        account_id: agent.id,
        message: "agent broke",
        user_agent_summary: "safari.macos",
      },
      {
        service: "web",
        account_id: member.id,
        message: "member broke <email>",
        user_agent_summary: "safari.macos",
      },
    ]);
  });

  it("drops the reports of an account over ten a minute, answering 200 to all", async () => {
    const member = dataSet.accounts.advertiser.b;
    const statuses: number[] = [];
    // Two fingerprints: neither reaches its own cap of ten, nor the account's cap of groups.
    for (const letter of "abababababab") {
      const response = await send(
        "web",
        report(`/fr/opstest/${RUN}/rate`, `report ${letter}`),
        member.sessionToken,
      );
      statuses.push(response.statusCode);
    }
    expect(new Set(statuses)).toEqual(new Set([200]));
    await ops.flush(database, silent);
    const [row] = await migration<{ count: number }[]>`
      select count(*)::int as count from ops.error_occurrences
       where route = ${`/fr/opstest/${RUN}/rate`}`;
    expect(row?.count).toBe(10);
  });
});

describe("J4S-6: new browser groups per account and hour (02 §20.5)", () => {
  it("opens five groups per account and hour at most; a known fingerprint, another account pass", async () => {
    const ops = recorder();
    const page = `/fr/opstest/${RUN}/groups`;
    const member = dataSet.accounts.creator.b.id;
    const other = dataSet.accounts.advertiser.a.id;
    const browser = (accountId: string, message: string) => {
      ops.recordBrowserError({
        surface: "web",
        errorType: "TypeError",
        kind: "error",
        message,
        stack: undefined,
        page,
        accountId,
        userAgentSummary: null,
      });
    };
    for (const letter of "abcdefg") {
      browser(member, `group ${letter}`);
    }
    browser(member, "group a");
    browser(other, "group f");
    const lines: string[] = [];
    await ops.flush(database, {
      ...silent,
      info: (object: object, message: string) => {
        lines.push(`${message} ${JSON.stringify(object)}`);
      },
    });
    const rows = await migration<{ account_id: string; message: string }[]>`
      select account_id::text, message from ops.error_occurrences
       where route = ${page} order by message, account_id`;
    expect(rows).toEqual(
      [
        { account_id: member, message: "group a" },
        { account_id: member, message: "group a" },
        { account_id: member, message: "group b" },
        { account_id: member, message: "group c" },
        { account_id: member, message: "group d" },
        { account_id: member, message: "group e" },
        { account_id: other, message: "group f" },
      ].sort((left, right) =>
        `${left.message}${left.account_id}`.localeCompare(
          `${right.message}${right.account_id}`,
        ),
      ),
    );
    expect(lines).toContain(
      'browser reports dropped, account over its new groups per hour {"dropped":2}',
    );
  });
});
