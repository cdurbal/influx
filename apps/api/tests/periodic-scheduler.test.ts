// E-4 in the loop of the worker (J7 commit 5, decision 3): the scheduler over an in-memory store,
// the reads of the reconciliation over a fake fetch, and the pure parts of the two tasks. The real
// database, the Brevo double and the GoTrue double are db-tests/tm1-periodic-tasks.
import { describe, expect, it } from "vitest";
import {
  AUTH_ORPHAN_AGE_MS,
  createAuthOrphanPurge,
  isPurgeableAge,
} from "../src/domains/maintenance/auth-orphan-purge.ts";
import {
  BrevoReadError,
  CONTACTS_PAGE_SIZE,
  createBrevoReads,
  MAX_PAGES,
} from "../src/domains/maintenance/brevo-reads.ts";
import { createBrevoReconciliation } from "../src/domains/maintenance/brevo-reconciliation.ts";
import {
  CLAIMED_ELSEWHERE_BACKOFF_MS,
  createPeriodicScheduler,
  isDue,
  createDataExportPurge,
  createOpsRetention,
  EXPORT_PURGE_BATCH,
  OPS_RETENTION_MAX_STEPS,
  periodKeyOf,
  PeriodicRunInterrupted,
  PeriodicTaskError,
  type PeriodicCounts,
  type PeriodicRun,
  type PeriodicStore,
  type PeriodicTask,
  type ReconciliationFinding,
} from "../src/domains/maintenance/periodic.ts";

const AT_0259 = Date.parse("2026-10-13T02:59:59.000Z");
const AT_0300 = Date.parse("2026-10-13T03:00:00.000Z");

type Finish = {
  run: PeriodicRun;
  outcome: string;
  counts: PeriodicCounts;
};

/** A store in memory: claims as ops.claim_periodic_run() does for one instance. */
function memoryStore(options: { claimedElsewhere?: boolean } = {}) {
  const claims: { task: PeriodicTask; periodKey: string }[] = [];
  const finishes: Finish[] = [];
  const findings: ReconciliationFinding[] = [];
  const store: PeriodicStore = {
    async claim(task, periodKey) {
      claims.push({ task, periodKey });
      return options.claimedElsewhere === true
        ? null
        : { runId: `run-${claims.length}`, attempt: 1 };
    },
    async finish(run, outcome, counts) {
      finishes.push({ run, outcome, counts: { ...counts } });
      return true;
    },
    async recordFindings(_run, written) {
      findings.push(...written);
      return { recorded: written.length, refused: 0 };
    },
    async filterAuthOrphans(_run, ids) {
      return [...ids];
    },
    async recordAuthOrphanPurge() {},
    async realignmentCandidates() {
      return [];
    },
    async purgeBrevoInbound() {
      return 0;
    },
    async purgeDataExports() {
      return 0;
    },
    async opsRetentionStep() {
      return { more: 0 };
    },
  };
  return { store, claims, finishes, findings };
}

function silentLogger() {
  const lines: { level: string; object: object; message: string }[] = [];
  return {
    lines,
    logger: {
      info: (object: object, message: string) =>
        lines.push({ level: "info", object, message }),
      warn: (object: object, message: string) =>
        lines.push({ level: "warn", object, message }),
      error: (object: object, message: string) =>
        lines.push({ level: "error", object, message }),
    },
  };
}

const signal = () => new AbortController().signal;

describe("periods and hours (decision 3)", () => {
  it("keys a daily task by UTC day and the purge of GoTrue by UTC hour, as 0117", () => {
    expect(periodKeyOf("brevo_reconciliation", AT_0259)).toBe("2026-10-13");
    expect(periodKeyOf("brevo_inbound_purge", AT_0259)).toBe("2026-10-13");
    expect(periodKeyOf("auth_orphan_purge", AT_0259)).toBe("2026-10-13T02");
    // J8 commit 8: an export past its deadline is emptied within the hour (runbook §4)
    expect(periodKeyOf("data_export_purge", AT_0259)).toBe("2026-10-13T02");
  });

  it("starts the reconciliation at 03:00 UTC, the other tasks at any hour", () => {
    expect(isDue("brevo_reconciliation", AT_0259, 3)).toBe(false);
    expect(isDue("brevo_reconciliation", AT_0300, 3)).toBe(true);
    expect(isDue("auth_orphan_purge", AT_0259, 3)).toBe(true);
    expect(isDue("brevo_inbound_purge", AT_0259, 3)).toBe(true);
  });
});

describe("the scheduler", () => {
  it("claims nothing for a task without its key in this process, nor the reconciliation before 03:00", async () => {
    const { store, claims } = memoryStore();
    const scheduler = createPeriodicScheduler({
      store,
      runners: { brevo_reconciliation: async () => {} },
      logger: silentLogger().logger,
      now: () => AT_0259,
    });
    await scheduler.tick(signal());
    expect(claims).toEqual([]);
  });

  it("runs each due task once per period, and closes it with its counts", async () => {
    let now = AT_0300;
    const { store, claims, finishes } = memoryStore();
    const scheduler = createPeriodicScheduler({
      store,
      runners: {
        brevo_reconciliation: async (_run, counts) => {
          counts.gap = 2;
        },
        auth_orphan_purge: async (_run, counts) => {
          counts.deleted = 1;
        },
      },
      logger: silentLogger().logger,
      now: () => now,
    });
    await scheduler.tick(signal());
    await scheduler.tick(signal());
    now += 3_600_000;
    await scheduler.tick(signal());
    expect(claims).toEqual([
      { task: "brevo_reconciliation", periodKey: "2026-10-13" },
      { task: "auth_orphan_purge", periodKey: "2026-10-13T03" },
      { task: "auth_orphan_purge", periodKey: "2026-10-13T04" },
    ]);
    expect(finishes.map((finish) => [finish.outcome, finish.counts])).toEqual([
      ["succeeded", { gap: 2 }],
      ["succeeded", { deleted: 1 }],
      ["succeeded", { deleted: 1 }],
    ]);
  });

  it("looks again at a period claimed elsewhere after the back-off only", async () => {
    let now = AT_0300;
    const { store, claims } = memoryStore({ claimedElsewhere: true });
    const scheduler = createPeriodicScheduler({
      store,
      runners: { brevo_inbound_purge: async () => {} },
      logger: silentLogger().logger,
      now: () => now,
    });
    await scheduler.tick(signal());
    now += CLAIMED_ELSEWHERE_BACKOFF_MS - 1;
    await scheduler.tick(signal());
    now += 1;
    await scheduler.tick(signal());
    expect(claims).toHaveLength(2);
  });

  it("closes a failed run failed, with the counts reached and a closed code only", async () => {
    const { store, finishes } = memoryStore();
    const { logger, lines } = silentLogger();
    const scheduler = createPeriodicScheduler({
      store,
      runners: {
        auth_orphan_purge: async (_run, counts) => {
          counts.deleted = 3;
          throw new PeriodicTaskError("gotrue.unavailable");
        },
        brevo_inbound_purge: async () => {
          throw new Error("a message that may quote someone@example.test");
        },
      },
      logger,
      now: () => AT_0300,
    });
    await scheduler.tick(signal());
    expect(finishes.map((finish) => [finish.outcome, finish.counts])).toEqual([
      ["failed", { deleted: 3 }],
      ["failed", {}],
    ]);
    const failures = lines.filter(
      (line) => line.message === "maintenance.periodic.failed",
    );
    expect(
      failures.map((line) => (line.object as { errorCode: string }).errorCode),
    ).toEqual(["gotrue.unavailable", "internal"]);
    expect(JSON.stringify(lines)).not.toContain("example.test");
  });

  it("counts a stop by the breaker on its run, the trace AL60 reads (J7S-2, 15 RG165)", async () => {
    const { store, finishes } = memoryStore();
    const { logger } = silentLogger();
    const scheduler = createPeriodicScheduler({
      store,
      runners: {
        auth_orphan_purge: async (_run, counts) => {
          counts.realign_checked = 0;
          throw new PeriodicTaskError("breaker.orphan_ratio");
        },
      },
      logger,
      now: () => AT_0300,
    });
    await scheduler.tick(signal());
    expect(finishes.map((finish) => [finish.outcome, finish.counts])).toEqual([
      ["failed", { realign_checked: 0, breaker_orphan_ratio: 1 }],
    ]);
  });

  it("leaves a run interrupted by a stop open, for a take-back after an hour", async () => {
    const { store, finishes } = memoryStore();
    const { logger, lines } = silentLogger();
    const scheduler = createPeriodicScheduler({
      store,
      runners: {
        auth_orphan_purge: async () => {
          throw new PeriodicRunInterrupted();
        },
      },
      logger,
      now: () => AT_0300,
    });
    await scheduler.tick(signal());
    expect(finishes).toEqual([]);
    expect(lines.map((line) => line.message)).toEqual([
      "maintenance.periodic.interrupted",
    ]);
  });

  it("never throws: a database failure of the claim is logged, the next tick tries again", async () => {
    const { store, claims } = memoryStore();
    let failing = true;
    const { logger, lines } = silentLogger();
    const scheduler = createPeriodicScheduler({
      store: {
        ...store,
        async claim(task, periodKey) {
          if (failing) {
            throw new Error("connection refused");
          }
          return store.claim(task, periodKey);
        },
      },
      runners: { brevo_inbound_purge: async () => {} },
      logger,
      now: () => AT_0300,
    });
    await scheduler.tick(signal());
    failing = false;
    await scheduler.tick(signal());
    expect(lines[0]?.message).toBe("maintenance.periodic.tick_failed");
    expect(claims).toHaveLength(1);
  });
});

describe("04 §9: the age of a GoTrue user", () => {
  const now = AT_0300;
  const hours = (count: number) => now - count * 3_600_000;

  it.each([
    [
      "created 23 hours ago",
      { createdAt: hours(23), updatedAt: hours(23), lastSignInAt: null },
      false,
    ],
    [
      "created 25 hours ago",
      { createdAt: hours(25), updatedAt: hours(25), lastSignInAt: null },
      true,
    ],
    [
      "exactly 24 hours old",
      {
        createdAt: now - AUTH_ORPHAN_AGE_MS,
        updatedAt: null,
        lastSignInAt: null,
      },
      false,
    ],
    [
      "old, updated 2 hours ago",
      { createdAt: hours(72), updatedAt: hours(2), lastSignInAt: null },
      false,
    ],
    [
      "old, signed in 3 hours ago",
      { createdAt: hours(72), updatedAt: hours(30), lastSignInAt: hours(3) },
      false,
    ],
    [
      "old, signed in 30 hours ago",
      { createdAt: hours(72), updatedAt: hours(30), lastSignInAt: hours(30) },
      true,
    ],
  ] as const)("%s: purgeable %s", (_label, user, expected) => {
    expect(isPurgeableAge({ userId: "u", ...user }, now)).toBe(expected);
  });
});

describe("J7S-2: the breaker of the GoTrue purge", () => {
  it("stops the run on the refusal of ops.filter_auth_orphans (55000), before any delete", async () => {
    const { store } = memoryStore();
    const deletes: string[] = [];
    const refusal = Object.assign(new Error("accounts read empty"), {
      code: "55000",
    });
    const purge = createAuthOrphanPurge({
      directory: {
        listUsers: async () => ({
          ok: true,
          value: {
            users: [
              {
                userId: "6f1c2a8e-2b8f-4c1e-9d7a-0c4b8e2f1a3d",
                createdAt: AT_0300 - 72 * 3_600_000,
                updatedAt: null,
                lastSignInAt: null,
              },
            ],
            nextPage: null,
          },
        }),
        readUser: async () => {
          throw new Error("not reached");
        },
        deleteUser: async (userId) => {
          deletes.push(userId);
          return { ok: true, value: null };
        },
        readUserAddress: async () => {
          throw new Error("not reached");
        },
        moveUserAddress: async () => {
          throw new Error("not reached");
        },
        userOfAddress: async () => {
          throw new Error("not reached");
        },
      },
      store: {
        ...store,
        filterAuthOrphans: async () => {
          throw refusal;
        },
      },
      now: () => AT_0300,
    });

    const failure = await purge(
      { runId: "run-1", attempt: 1 },
      {},
      signal(),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PeriodicTaskError);
    expect((failure as PeriodicTaskError).code).toBe("breaker.filter_refused");
    expect(deletes).toEqual([]);
  });
});

describe("the reconciliation (05 RG91, CA53)", () => {
  it("writes the blacklisted contacts and the complaints of the last 48 hours, to the second", async () => {
    const now = Date.parse("2026-10-13T12:00:00.000Z");
    const { store, findings } = memoryStore();
    const days: string[] = [];
    const counts: PeriodicCounts = {};
    const runner = createBrevoReconciliation({
      reads: {
        async contactsModifiedSince(since) {
          expect(since.toISOString()).toBe("2026-10-11T12:00:00.000Z");
          return [
            {
              email: "lost@example.test",
              emailBlacklisted: true,
              modifiedAt: Date.parse("2026-10-12T10:05:00.789Z"),
              influxAccountId: "0B6F7D1E-2C3A-4E5F-8A9B-1C2D3E4F5A6B",
            },
            {
              email: "kept@example.test",
              emailBlacklisted: false,
              modifiedAt: Date.parse("2026-10-13T10:00:00.000Z"),
              influxAccountId: "0b6f7d1e-2c3a-4e5f-8a9b-1c2d3e4f5a6c",
            },
            {
              email: "foreign@example.test",
              emailBlacklisted: true,
              modifiedAt: Date.parse("2026-10-13T09:00:00.000Z"),
              influxAccountId: "not-an-id",
            },
          ];
        },
        async smtpSpamEvents(startDay, endDay) {
          days.push(startDay, endDay);
          return [
            {
              email: "complaint@example.test",
              occurredAt: Date.parse("2026-10-13T08:00:00.400Z"),
              messageId: "<m1@smtp-relay.mailin.fr>",
            },
            {
              email: "older@example.test",
              occurredAt: Date.parse("2026-10-11T08:00:00.000Z"),
              messageId: "<m0@smtp-relay.mailin.fr>",
            },
          ];
        },
      },
      store,
      now: () => now,
    });
    await runner({ runId: "r", attempt: 1 }, counts, signal());
    expect(days).toEqual(["2026-10-11", "2026-10-13"]);
    expect(findings).toEqual([
      {
        event: "unsubscribed",
        occurredAt: "2026-10-12T10:05:00.000Z",
        messageId: null,
        email: "lost@example.test",
        accountRef: "0b6f7d1e-2c3a-4e5f-8a9b-1c2d3e4f5a6b",
      },
      {
        event: "unsubscribed",
        occurredAt: "2026-10-13T09:00:00.000Z",
        messageId: null,
        email: "foreign@example.test",
        accountRef: null,
      },
      {
        event: "spam",
        occurredAt: "2026-10-13T08:00:00.000Z",
        messageId: "<m1@smtp-relay.mailin.fr>",
        email: "complaint@example.test",
        accountRef: null,
      },
    ]);
    expect(counts).toEqual({
      contacts_listed: 3,
      unsubscribed_found: 2,
      spam_found: 1,
      gap: 3,
      refused: 0,
    });
  });
});

describe("16 §M1 operations 9 and 10: the reads, against a fake fetch", () => {
  type Call = { url: string; headers: Record<string, string> };

  function fakeFetch(answers: (url: URL) => { status: number; body: unknown }) {
    const calls: Call[] = [];
    const doFetch: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push({
        url: String(input),
        headers: init?.headers as Record<string, string>,
      });
      const answer = answers(url);
      return new Response(JSON.stringify(answer.body), {
        status: answer.status,
      });
    };
    return { calls, doFetch };
  }

  const SETTINGS = {
    apiKey: "local-double-key",
    baseUrl: "https://api.brevo.test/v3",
  };

  it("pages the contacts while a page is full, with the key and the instant of the reference", async () => {
    const contact = (index: number) => ({
      id: index,
      email: `c${index}@example.test`,
      emailBlacklisted: index === 0,
      modifiedAt: "2026-10-12T10:05:00.000+02:00",
      attributes: { INFLUX_ACCOUNT_ID: "x" },
    });
    const { calls, doFetch } = fakeFetch((url) => {
      const offset = Number(url.searchParams.get("offset"));
      const size = offset === 0 ? CONTACTS_PAGE_SIZE : 2;
      return {
        status: 200,
        body: {
          contacts: Array.from({ length: size }, (_, index) =>
            contact(offset + index),
          ),
          count: CONTACTS_PAGE_SIZE + 2,
        },
      };
    });
    const reads = createBrevoReads(SETTINGS, { fetch: doFetch });
    const listed = await reads.contactsModifiedSince(
      new Date("2026-10-11T03:00:00.000Z"),
    );
    expect(listed).toHaveLength(CONTACTS_PAGE_SIZE + 2);
    expect(listed[0]).toEqual({
      email: "c0@example.test",
      emailBlacklisted: true,
      modifiedAt: Date.parse("2026-10-12T08:05:00.000Z"),
      influxAccountId: "x",
    });
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.brevo.test/v3/contacts?limit=1000&offset=0&modifiedSince=2026-10-11T03%3A00%3A00.000Z&sort=asc",
      "https://api.brevo.test/v3/contacts?limit=1000&offset=1000&modifiedSince=2026-10-11T03%3A00%3A00.000Z&sort=asc",
    ]);
    expect(calls[0]?.headers["api-key"]).toBe("local-double-key");
  });

  it("reads the complaints of a range of days; `events` absent is none", async () => {
    const { calls, doFetch } = fakeFetch(() => ({ status: 200, body: {} }));
    const reads = createBrevoReads(SETTINGS, { fetch: doFetch });
    expect(await reads.smtpSpamEvents("2026-10-11", "2026-10-13")).toEqual([]);
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.brevo.test/v3/smtp/statistics/events?event=spam&startDate=2026-10-11&endDate=2026-10-13&limit=1000&offset=0&sort=asc",
    ]);
  });

  it.each([
    [401, "brevo.unauthorized"],
    [429, "brevo.rate_limited"],
    [503, "brevo.unavailable"],
    [400, "brevo.rejected"],
  ])("stops on a %s with the closed code %s", async (status, code) => {
    const { doFetch } = fakeFetch(() => ({
      status,
      body: { code: "x", message: "a@example.test" },
    }));
    const reads = createBrevoReads(SETTINGS, { fetch: doFetch });
    await expect(
      reads.smtpSpamEvents("2026-10-11", "2026-10-13"),
    ).rejects.toMatchObject({
      code,
      message: code,
    });
  });

  it("refuses a malformed contact, and stops after the last page allowed", async () => {
    const malformed = fakeFetch(() => ({
      status: 200,
      body: { contacts: [{ email: "a@example.test" }] },
    }));
    await expect(
      createBrevoReads(SETTINGS, {
        fetch: malformed.doFetch,
      }).contactsModifiedSince(new Date()),
    ).rejects.toBeInstanceOf(BrevoReadError);
    const endless = fakeFetch(() => ({
      status: 200,
      body: {
        contacts: Array.from({ length: CONTACTS_PAGE_SIZE }, () => ({
          email: "a@example.test",
          emailBlacklisted: false,
          modifiedAt: "2026-10-12T10:05:00.000Z",
        })),
      },
    }));
    await expect(
      createBrevoReads(SETTINGS, {
        fetch: endless.doFetch,
      }).contactsModifiedSince(new Date()),
    ).rejects.toMatchObject({ code: "brevo.too_many_pages" });
    expect(endless.calls).toHaveLength(MAX_PAGES);
  });

  it("reports a transport failure as unreachable, without the URL", async () => {
    const reads = createBrevoReads(SETTINGS, {
      fetch: async () => {
        throw new TypeError("fetch failed https://api.brevo.test/v3/contacts");
      },
    });
    await expect(reads.contactsModifiedSince(new Date())).rejects.toMatchObject(
      {
        message: "brevo.unreachable",
      },
    );
  });
});

describe("data_export_purge (runbook demandes-rgpd §4, J8 commit 8)", () => {
  it("empties the exports past their deadline by batches, until a batch is not full", async () => {
    const { store } = memoryStore();
    const batches = [EXPORT_PURGE_BATCH, EXPORT_PURGE_BATCH, 3];
    const limits: number[] = [];
    store.purgeDataExports = async (_run, limit) => {
      limits.push(limit);
      return batches.shift() ?? 0;
    };
    const counts: PeriodicCounts = {};
    await createDataExportPurge(store)(
      { runId: "run-1", attempt: 1 },
      counts,
      new AbortController().signal,
    );
    expect(counts).toEqual({ purged: 2 * EXPORT_PURGE_BATCH + 3 });
    expect(limits).toEqual([
      EXPORT_PURGE_BATCH,
      EXPORT_PURGE_BATCH,
      EXPORT_PURGE_BATCH,
    ]);
  });

  it("runs the retention of ops by steps until no more, adding up their counts (0147)", async () => {
    const { store } = memoryStore();
    const steps: PeriodicCounts[] = [
      { request_minutes_rolled_up: 4000, more: 1 },
      { request_minutes_rolled_up: 120, occurrences_purged: 7, more: 0 },
    ];
    let calls = 0;
    store.opsRetentionStep = async () => steps[calls++] ?? { more: 0 };
    const counts: PeriodicCounts = {};
    await createOpsRetention(store)(
      { runId: "run-1", attempt: 1 },
      counts,
      signal(),
    );
    expect(calls).toBe(2);
    expect(counts).toEqual({
      request_minutes_rolled_up: 4120,
      occurrences_purged: 7,
    });
  });

  it("bounds the steps of the retention of ops per run", async () => {
    const { store } = memoryStore();
    let calls = 0;
    store.opsRetentionStep = async () => {
      calls += 1;
      return { more: 1 };
    };
    await createOpsRetention(store)(
      { runId: "run-1", attempt: 1 },
      {},
      signal(),
    );
    expect(calls).toBe(OPS_RETENTION_MAX_STEPS);
  });

  it("stops between two batches once a stop is requested", async () => {
    const { store } = memoryStore();
    const stop = new AbortController();
    store.purgeDataExports = async () => {
      stop.abort();
      return EXPORT_PURGE_BATCH;
    };
    await expect(
      createDataExportPurge(store)(
        { runId: "run-1", attempt: 1 },
        {},
        stop.signal,
      ),
    ).rejects.toBeInstanceOf(PeriodicRunInterrupted);
  });
});
