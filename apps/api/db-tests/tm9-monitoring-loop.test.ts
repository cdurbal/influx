// TM9 (J9 commit 8) — the active monitoring of D60 end to end on the local stack (02 §11.3, §20.5;
// 15 RG165): the beat of the worker read by the api (AL50), the probe of the worker (AL49) with its
// results written to ops, the states kept in base so that two instances send one e-mail, and the
// "resolved" at the end. Real pools (influx_worker_login, influx_ops_login), the modules of
// src/domains/ops, a fake fetch for the targets and a fake sender: no network, no Brevo (16 RG148).
// The functions of 0147 themselves are tm9-ops-monitoring.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  createWorkerDatabase,
  type ApiDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import {
  createHeartbeat,
  createWorkerMonitor,
} from "../src/domains/ops/worker-monitor.ts";
import { watchWorkerOnce } from "../src/domains/ops/worker-watch.ts";
import type {
  TransactionalEmail,
  TransactionalSender,
} from "../src/platform/brevo-transactional.ts";
import { localSuperuser } from "./support.ts";

const ON_CALL = ["ops@influx.example"];
const RUN = randomUUID().slice(0, 8);
const ORIGINS = {
  web: "https://influx.example",
  backoffice: "https://bo.influx.example",
  api: "http://api.railway.internal:3100",
};

const connection = (role: LoginRole) => ({
  url: localRoleUrl(role),
  role,
  tls: false,
});
const quiet = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let superuser: postgres.Sql;
let api: ApiDatabase;
const workers: WorkerDatabase[] = [];
let sent: TransactionalEmail[] = [];

const sender: TransactionalSender = {
  async send(email) {
    sent.push(email);
    return { status: "sent", messageId: `<${String(sent.length)}@double>` };
  },
};

function workerDatabase(): WorkerDatabase {
  const database = createWorkerDatabase(
    { worker: connection("influx_worker_login") },
    quiet,
  );
  workers.push(database);
  return database;
}

function sentFor(code: string): TransactionalEmail[] {
  return sent.filter((email) => email.subject.includes(` ${code} `));
}

/** The monitoring state is the whole base's: cleared before and after each case. */
async function clearMonitoring(): Promise<void> {
  await superuser.begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`delete from ops.alert_states`;
    await tx`delete from ops.worker_heartbeats`;
    await tx`delete from ops.probe_results where instance like ${`tm9-${RUN}%`}`;
  });
}

beforeAll(() => {
  superuser = localSuperuser();
  api = createApiDatabase(
    {
      app: connection("influx_app"),
      auth: connection("influx_auth_login"),
      ops: connection("influx_ops_login"),
    },
    quiet,
  );
});

beforeEach(async () => {
  sent = [];
  await clearMonitoring();
});

afterEach(async () => {
  await clearMonitoring();
});

afterAll(async () => {
  await Promise.all(workers.map((database) => closeDatabase(database)));
  await closeDatabase(api);
});

describe("AL50: the api watches the beat of the worker (02 §11.3)", () => {
  it("raises it without any beat, once, to the on-call addresses, and resolves it after a beat", async () => {
    const watch = {
      database: api,
      sender,
      onCallRecipients: ON_CALL,
      logger: quiet,
    };
    expect(await watchWorkerOnce(watch)).toBe(true);
    expect(sentFor("AL50").map((email) => email.to)).toEqual(ON_CALL);

    expect(await watchWorkerOnce(watch)).toBe(true);
    expect(sentFor("AL50")).toHaveLength(1);

    const heartbeat = createHeartbeat({
      database: workerDatabase(),
      workerId: `worker-tm9-${RUN}`,
      instance: `tm9-${RUN}`,
      version: "test",
      startedAt: new Date().toISOString(),
      logger: quiet,
      elapsed: () => performance.now(),
    });
    await heartbeat.turned();
    await watchWorkerOnce(watch);
    const emails = sentFor("AL50");
    expect(emails).toHaveLength(2);
    expect(emails[1]?.subject).toContain("rétabli");
  });
});

describe("AL49: the probe of the worker (02 §20.5)", () => {
  function monitor(name: string, apiDown: () => boolean) {
    return createWorkerMonitor({
      database: workerDatabase(),
      probe: ORIGINS,
      sender,
      onCallRecipients: ON_CALL,
      instance: `tm9-${RUN}-${name}`,
      logger: quiet,
      fetch: async (url) =>
        String(url).endsWith("/health") && apiDown()
          ? new Response("", { status: 503 })
          : new Response("<html></html>", { status: 200 }),
      sleep: async () => undefined,
    });
  }

  it("writes its results, raises AL49 once for two instances, and says when it is over", async () => {
    let down = true;
    const first = monitor("a", () => down);
    const second = monitor("b", () => down);
    await first.tick();
    await second.tick();
    expect(sentFor("AL49")).toEqual([]);
    await first.tick();
    await second.tick();
    expect(sentFor("AL49").map((email) => email.to)).toEqual(ON_CALL);
    expect(sentFor("AL49")[0]?.text).toContain("/health");

    const [written] = await superuser<{ count: number }[]>`
      select count(*)::int as count from ops.probe_results
       where instance like ${`tm9-${RUN}-%`}`;
    expect(written?.count).toBe(16);
    const states = await superuser<{ subject_key: string; state: string }[]>`
      select subject_key, state from ops.alert_states where code = 'AL49' order by subject_key`;
    // A target that never failed writes no state: only the incident is kept.
    expect(states).toEqual([{ subject_key: "api_health", state: "open" }]);

    down = false;
    await first.tick();
    expect(sentFor("AL49")).toHaveLength(2);
    expect(sentFor("AL49")[1]?.subject).toContain("rétabli");
  });
});
