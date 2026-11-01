// What the "Santé technique" screen shapes from the answers of the database (docs/mvp/02 §20.5; 15
// RG165; 21 §J9 commit 9, EC-J9-5), without a database: the answers of backoffice.ops_* are given
// to the readers as the functions of 0148 write them. The p95 is computed from the histograms ADDED
// UP over every instance and is the upper bound of a bucket (never a stored value, never one per
// instance); the worker is judged by the very rule of AL50; the buckets of time are filled with
// zeros and the last one is in progress; an answer of an unexpected shape is an error, not a guess.
import { OPS_PROBE_TARGETS } from "@influx/contracts/backoffice-ops";
import { describe, expect, it } from "vitest";
import type { Transaction } from "../src/db/index.ts";
import {
  readErrorGroup,
  readErrorGroups,
  readOpsStatus,
  readProcesses,
  readTraffic,
} from "../src/domains/backoffice/ops-health.ts";
import { PROBE_TARGETS } from "../src/domains/ops/technical-alerts.ts";

/** A transaction that answers one jsonb column, whatever it is asked. */
function answering(value: unknown): Transaction {
  return {
    execute: () => Promise.resolve([{ answer: value }]),
  } as unknown as Transaction;
}

const NOW = "2026-10-26T12:07:30.000000Z";
const GROUP_ID = "6f9c3a52-0f55-4d3c-9d6e-0a5d9c1b7e21";

const GROUP = {
  id: GROUP_ID,
  source: "server",
  service: "api",
  error_type: "TypeError",
  message: "Cannot read properties of undefined",
  route: "/v1/auth/verify-code",
  status: "new",
  occurrence_count: 12,
  regression_count: 0,
  first_seen_at: "2026-10-20T08:00:00.123456Z",
  last_seen_at: "2026-10-26T12:00:00.654321Z",
  last_regressed_at: null,
  first_version: "abc123",
  last_version: "def456",
};

function histogram(...counts: number[]): number[] {
  return [...counts, ...Array<number>(9 - counts.length).fill(0)];
}

describe("the lists of the contract are the probe's own", () => {
  it("the targets of the screen are the targets of the probe (no second list)", () => {
    expect([...OPS_PROBE_TARGETS]).toEqual([...PROBE_TARGETS]);
  });
});

describe("readOpsStatus: the worker is judged by the rule of AL50", () => {
  const base = {
    now: NOW,
    probes: [],
    workers: [] as unknown[],
    worker_definition: {
      threshold: { heartbeat_max_age_seconds: 60 },
      is_active: true,
    },
    periodic: [],
    alerts: [],
  };

  it("a beat within the threshold is running, an older one is silent, no beat ever is silent", async () => {
    const running = await readOpsStatus(
      answering({
        ...base,
        workers: [
          {
            instance: "w1",
            version: "abc123",
            started_at: "2026-10-26T08:00:00Z",
            beat_at: "2026-10-26T12:07:20Z",
            loop_turn_at: "2026-10-26T12:07:10Z",
          },
        ],
      }),
    );
    expect(running.worker).toMatchObject({
      state: "running",
      maxBeatAgeSeconds: 60,
      processes: [
        { beatAgeSeconds: 10, loopTurnAgeSeconds: 20, silent: false },
      ],
    });
    const silent = await readOpsStatus(
      answering({
        ...base,
        workers: [
          {
            instance: "w1",
            version: "abc123",
            started_at: "2026-10-26T08:00:00Z",
            beat_at: "2026-10-26T12:05:00Z",
            loop_turn_at: "2026-10-26T12:05:00Z",
          },
        ],
      }),
    );
    expect(silent.worker.state).toBe("silent");
    expect(silent.worker.processes[0]?.silent).toBe(true);
    expect((await readOpsStatus(answering(base))).worker.state).toBe("silent");
  });

  it("without the threshold of AL50 nothing is evaluated: unknown, silent null (RG165, non fixé)", async () => {
    const status = await readOpsStatus(
      answering({
        ...base,
        worker_definition: { threshold: {}, is_active: true },
        workers: [
          {
            instance: "w1",
            version: "abc123",
            started_at: "2026-10-26T08:00:00Z",
            beat_at: "2026-10-26T12:07:20Z",
            loop_turn_at: "2026-10-26T12:07:20Z",
          },
        ],
      }),
    );
    expect(status.worker).toMatchObject({
      state: "unknown",
      maxBeatAgeSeconds: null,
    });
    expect(status.worker.processes[0]?.silent).toBeNull();
    expect(
      (await readOpsStatus(answering({ ...base, worker_definition: null })))
        .worker.state,
    ).toBe("unknown");
  });

  it("gives the instants in milliseconds and the flat value of an alert sorted by key", async () => {
    const status = await readOpsStatus(
      answering({
        ...base,
        probes: [
          {
            target: "api_health",
            last: {
              checked_at: "2026-10-26T12:07:00.123456Z",
              outcome: "down",
              status_code: 503,
              failure_code: "status",
              duration_ms: 12,
            },
            day: { checks: 10, failures: 1 },
            week: { checks: 70, failures: 1 },
            month: { checks: 300, failures: 2 },
          },
        ],
        alerts: [
          {
            code: "AL52",
            subject: "",
            opened_at: "2026-10-26T11:50:00.500000Z",
            last_notified_at: null,
            notified_count: 0,
            value: { threshold_bp: 100, share_bp: 130, since: "2026-10-26" },
          },
        ],
      }),
    );
    expect(status.probes[0]?.last?.checkedAt).toBe("2026-10-26T12:07:00.123Z");
    expect(status.alerts[0]).toMatchObject({
      openedAt: "2026-10-26T11:50:00.500Z",
      value: [
        { key: "share_bp", value: 130 },
        { key: "since", value: "2026-10-26" },
        { key: "threshold_bp", value: 100 },
      ],
    });
  });

  it("an answer of another shape is an error, never a guess", async () => {
    await expect(
      readOpsStatus(answering({ ...base, probes: [{ target: "somewhere" }] })),
    ).rejects.toThrow();
    await expect(readOpsStatus(answering(null))).rejects.toThrow();
  });
});

describe("readErrorGroups and readErrorGroup", () => {
  const counts = {
    new: 2,
    acknowledged: 1,
    fixed: 3,
    ignored: 0,
    regression: 1,
  };

  it("flags a regression only on a group still open that was reopened", async () => {
    const answer = await readErrorGroups(
      answering({
        counts,
        groups: [
          { ...GROUP, regression_count: 2, status: "new" },
          { ...GROUP, id: randomId(1), regression_count: 2, status: "fixed" },
          { ...GROUP, id: randomId(2), regression_count: 0, status: "new" },
        ],
      }),
      "all",
      null,
    );
    expect(answer.groups.map((group) => group.regression)).toEqual([
      true,
      false,
      false,
    ]);
    expect(answer.groups[0]).toMatchObject({
      firstSeenAt: "2026-10-20T08:00:00.123Z",
      lastSeenAt: "2026-10-26T12:00:00.654Z",
      errorType: "TypeError",
    });
    expect(answer.counts).toEqual(counts);
    expect(answer.truncated).toBe(false);
  });

  it("says when the list is cut: one group more than the cap came back", async () => {
    const groups = Array.from({ length: 101 }, (_, index) => ({
      ...GROUP,
      id: randomId(index),
    }));
    const answer = await readErrorGroups(
      answering({ counts, groups }),
      "open",
      "server",
    );
    expect(answer.groups).toHaveLength(100);
    expect(answer.truncated).toBe(true);
    expect(answer.source).toBe("server");
  });

  it("gives a group with its occurrences, and null for an unknown one", async () => {
    const detail = await readErrorGroup(
      answering({
        group: GROUP,
        occurrences: [
          {
            occurred_at: "2026-10-26T12:00:00.654321Z",
            service: "api",
            version: "def456",
            route: "/v1/auth/verify-code",
            request_id: "0b6a4d5e-3c2f-4a1b-8d7c-9e8f7a6b5c4d",
            account_id: null,
            message: "Cannot read properties of undefined",
            stack: "TypeError: x\n    at handler (src/x.ts:1:1)",
            user_agent_summary: null,
          },
        ],
      }),
      GROUP_ID,
    );
    expect(detail?.occurrences[0]).toMatchObject({
      occurredAt: "2026-10-26T12:00:00.654Z",
      requestId: "0b6a4d5e-3c2f-4a1b-8d7c-9e8f7a6b5c4d",
      accountId: null,
    });
    expect(await readErrorGroup(answering(null), GROUP_ID)).toBeNull();
  });
});

function randomId(seed: number): string {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, "0")}`;
}

describe("readTraffic: the p95 of the histograms added up", () => {
  const FROM = "2026-10-26T11:10:00.000000Z";

  function traffic(
    routes: unknown[],
    totals: unknown[],
    overrides: Record<string, unknown> = {},
  ) {
    return {
      now: NOW,
      from: FROM,
      bucket_seconds: 300,
      routes,
      totals,
      ...overrides,
    };
  }

  it("two instances of one minute are ADDED: 20 fast calls and 20 slow ones give a p95 of 1 s, not that of either one", async () => {
    // instance A alone: 20 calls, all <= 25 ms (p95 25 ms)
    const alone = await readTraffic(
      answering(
        traffic(
          [
            {
              method: "GET",
              route: "/v1/x",
              cells: [
                {
                  at: "2026-10-26T12:05:00.000000Z",
                  count: 20,
                  server_errors: 0,
                  throttled: 0,
                  buckets: histogram(20),
                },
              ],
            },
          ],
          [],
        ),
      ),
      "hour",
    );
    expect(alone.routes[0]?.summary.p95Ms).toBe(25);

    // A + B: B's 20 calls are in (500 ms, 1 s]; the database hands the sum of the two histograms
    const added = await readTraffic(
      answering(
        traffic(
          [
            {
              method: "GET",
              route: "/v1/x",
              // one cell per bucket of time: the database has added the instances up already
              cells: [
                {
                  at: "2026-10-26T12:05:00.000000Z",
                  count: 40,
                  server_errors: 2,
                  throttled: 1,
                  buckets: histogram(20, 0, 0, 0, 0, 20),
                },
              ],
            },
          ],
          [
            {
              at: "2026-10-26T12:05:00.000000Z",
              count: 40,
              server_errors: 2,
              throttled: 1,
              buckets: histogram(20, 0, 0, 0, 0, 20),
            },
          ],
        ),
      ),
      "hour",
    );
    // 40 calls, rank 38: the 38th call is in the 6th bucket (<= 1 s)
    expect(added.routes[0]?.summary).toMatchObject({
      calls: 40,
      serverErrors: 2,
      throttled: 1,
      p95Ms: 1000,
      p95Beyond: false,
    });
    expect(added.total.summary.p95Ms).toBe(1000);
  });

  it("the last bucket (more than 5 s) is 5000 and beyond; nothing measured is null", async () => {
    const answer = await readTraffic(
      answering(
        traffic(
          [
            {
              method: "POST",
              route: "/v1/slow",
              cells: [
                {
                  at: "2026-10-26T12:05:00.000000Z",
                  count: 10,
                  server_errors: 0,
                  throttled: 0,
                  buckets: histogram(0, 0, 0, 0, 0, 0, 0, 0, 10),
                },
              ],
            },
          ],
          [],
        ),
      ),
      "hour",
    );
    expect(answer.routes[0]?.summary).toMatchObject({
      p95Ms: 5000,
      p95Beyond: true,
    });
    expect(answer.total.summary).toMatchObject({
      calls: 0,
      p95Ms: null,
      p95Beyond: false,
    });
  });

  it("fills every bucket of time with zeros, the last one in progress with the minutes elapsed", async () => {
    const answer = await readTraffic(
      answering(
        traffic(
          [
            {
              method: "GET",
              route: "/v1/x",
              cells: [
                // the bucket in progress: 12:05 to 12:10, now 12:07:30 => 2 whole minutes elapsed
                {
                  at: "2026-10-26T12:05:00.000000Z",
                  count: 30,
                  server_errors: 0,
                  throttled: 0,
                  buckets: histogram(30),
                },
                // a closed bucket: 5 minutes
                {
                  at: "2026-10-26T11:10:00.000000Z",
                  count: 50,
                  server_errors: 0,
                  throttled: 0,
                  buckets: histogram(50),
                },
              ],
            },
          ],
          [],
        ),
      ),
      "hour",
    );
    const points = answer.routes[0]?.points ?? [];
    expect(points).toHaveLength(12);
    expect(points[0]).toMatchObject({
      at: "2026-10-26T11:10:00.000Z",
      calls: 50,
      callsPerMinute: 10,
      open: false,
    });
    expect(points[1]).toMatchObject({
      calls: 0,
      callsPerMinute: 0,
      p95Ms: null,
      open: false,
    });
    expect(points[11]).toMatchObject({
      at: "2026-10-26T12:05:00.000Z",
      calls: 30,
      callsPerMinute: 15,
      open: true,
    });
    // 80 calls over the 57 whole minutes written so far in the window
    expect(answer.routes[0]?.summary.callsPerMinute).toBeCloseTo(80 / 57, 5);
  });

  it("a histogram of another length is an error", async () => {
    await expect(
      readTraffic(
        answering(
          traffic(
            [],
            [
              {
                at: FROM,
                count: 1,
                server_errors: 0,
                throttled: 0,
                buckets: [1],
              },
            ],
          ),
        ),
        "hour",
      ),
    ).rejects.toThrow();
  });
});

describe("readProcesses", () => {
  it("gives the age of the last sample and of the last connection reading", async () => {
    const answer = await readProcesses(
      answering({
        now: NOW,
        processes: [
          {
            service: "api",
            instance: "a1",
            last_minute: "2026-10-26T12:05:00.000000Z",
            event_loop_delay_p99_ms: 12.5,
            event_loop_delay_max_ms: 60,
            rss_bytes: 200000000,
            heap_used_bytes: 80000000,
            cpu_percent: 7.5,
            hour: {
              samples: 58,
              event_loop_delay_p99_avg_ms: 11.2,
              event_loop_delay_max_ms: 90,
              rss_max_bytes: 210000000,
              cpu_max_percent: 20,
            },
          },
        ],
        database: {
          last: {
            minute: "2026-10-26T12:06:00.000000Z",
            connections: 14,
            max_connections: 60,
          },
          peak_24h: 31,
          samples: [
            {
              minute: "2026-10-26T12:06:00.000000Z",
              connections: 14,
              max_connections: 60,
            },
          ],
        },
      }),
    );
    expect(answer.processes[0]).toMatchObject({
      ageSeconds: 150,
      cpuPercent: 7.5,
    });
    expect(answer.database).toMatchObject({ lastAgeSeconds: 90, peak24h: 31 });
  });

  it("no reading yet: nulls, not zeros", async () => {
    const answer = await readProcesses(
      answering({
        now: NOW,
        processes: [],
        database: { last: null, peak_24h: null, samples: [] },
      }),
    );
    expect(answer.database).toEqual({
      last: null,
      lastAgeSeconds: null,
      peak24h: null,
      samples: [],
    });
  });
});
