// The worker loop of E-3 `leads.drain_outbox` (J6, commit 3): CLAIM, CALL, OUTCOME in three short
// steps, never an external call under a transaction (02 §18.4 G4), on an in-memory queue and
// in-memory connectors (16 RG148: no test ever reaches Brevo or Apollo). Covers lead-pipeline T9
// (a slow connector holds no lock and delays no other destination) and T5 (one rate budget per
// category), 18 TM1.7, TM1.8 and TM1.10 (SIGTERM during a batch), the three locks of 02 §12.4,
// the retry schedule of 05 RG79 (EC-9) and the dry-run line of the architect's decision 3, with
// no personal value in any log line (D60). The database half is in db-tests/tm1-worker-loop.
import { captureLogStream, valuesFoundIn } from "@influx/test-kit/logs";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CallResult,
  Connector,
  Preparation,
} from "../src/domains/leads/connector.ts";
import {
  createOutboxDrain,
  LANE_WAIT_BUDGET_MS,
  workerIdentifier,
  type DrainDependencies,
  type SyncSettings,
} from "../src/domains/leads/drain.ts";
import { CategoryRateLimiter } from "../src/domains/leads/rate-limiter.ts";
import {
  LineTakenBackError,
  type CompletedAttempt,
  type OutboxQueue,
} from "../src/domains/leads/queue.ts";
import type {
  AttemptOutcome,
  AttemptState,
  ClaimedLine,
  OutboxDestination,
  RecoveredLine,
} from "../src/domains/leads/repository.ts";
import {
  MAX_RETRY_DELAY_SECONDS,
  retryDelaySeconds,
} from "../src/domains/leads/settings.ts";
import { createLogger } from "../src/platform/logger.ts";

const ACCOUNT = "4f6c2a51-93d7-4b8e-a1c0-7e2d9b3f5a68";
/** Values the fake connectors hold, that no log line may carry (D60). */
const RECIPIENT = "lena-k7q2@example.test";
const RECIPIENT_DOMAIN = "example.test";
const ATTRIBUTE_VALUE = "Maison Verbeke-Lambrecht";
const PROVIDER_CONTACT = "provider-contact-9318";

const SCHEDULE = [0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400];
const SETTINGS: Record<string, unknown> = {
  retry_schedule: SCHEDULE,
  rate_limits: {
    brevo_contact_per_minute: 60,
    brevo_transactional_per_minute: 60,
    apollo_contact_per_minute: 20,
  },
};

// ---------------------------------------------------------------------------------------------
// The in-memory queue: the four steps of queue.ts, each one "transaction" that is open only
// while the step runs.
// ---------------------------------------------------------------------------------------------

type FakeLine = ClaimedLine & {
  status: "pending" | "processing" | "succeeded" | "skipped" | "failed";
  attempts: number;
};

type Completion = { id: string; outcome: AttemptOutcome; begun: boolean };

class FakeQueue implements OutboxQueue {
  readonly lines: FakeLine[] = [];
  readonly completions: Completion[] = [];
  readonly begun: string[] = [];
  readonly takenBack = new Set<string>();
  settings: Record<string, unknown> = SETTINGS;
  openTransactions = 0;
  recoveries = 0;
  #next = 1;

  add(
    destination: OutboxDestination,
    spec: { priority?: number; subject?: string; attempts?: number } = {},
  ): string {
    const id = String(this.#next++);
    this.lines.push({
      id,
      eventId: `event-${id}`,
      eventType: "lead.created",
      destination,
      subjectKey: spec.subject ?? `account:${ACCOUNT}`,
      priority: spec.priority ?? 100,
      payload: { account_id: ACCOUNT, event_id: `event-${id}` },
      idempotencyKey: `${destination}:${id}`,
      status: "pending",
      attempts: spec.attempts ?? 0,
    });
    return id;
  }

  line(id: string): FakeLine {
    const line = this.lines.find((candidate) => candidate.id === id);
    if (line === undefined) {
      throw new Error(`no line ${id}`);
    }
    return line;
  }

  outcomeOf(id: string): Completion | undefined {
    return this.completions.find((completion) => completion.id === id);
  }

  async #transaction<T>(step: () => T): Promise<T> {
    this.openTransactions += 1;
    try {
      await Promise.resolve();
      return step();
    } finally {
      this.openTransactions -= 1;
    }
  }

  recover(): Promise<RecoveredLine[]> {
    return this.#transaction(() => {
      this.recoveries += 1;
      return [];
    });
  }

  claim(): Promise<ClaimedLine[]> {
    return this.#transaction(() => {
      const claimed = this.lines
        .filter((line) => line.status === "pending")
        .sort((a, b) => a.priority - b.priority || Number(a.id) - Number(b.id));
      for (const line of claimed) {
        line.status = "processing";
      }
      return claimed.map((line) => ({ ...line }));
    });
  }

  begin(_requestId: string, lineId: string): Promise<AttemptState> {
    return this.#transaction(() => {
      if (this.takenBack.has(lineId)) {
        throw new LineTakenBackError();
      }
      const line = this.line(lineId);
      line.attempts += 1;
      this.begun.push(lineId);
      return {
        attempt: line.attempts,
        account: {
          id: ACCOUNT,
          status: "active",
          role: "advertiser",
          declaredStatus: "business",
          countryCode: "BE",
          preferredLanguage: "fr",
          emailVerified: true,
          marketingEmailConsent: true,
          commercialProspectionConsent: true,
        },
        settings: this.settings,
      };
    });
  }

  complete(
    _requestId: string,
    lineId: string,
    _worker: string,
    outcome: AttemptOutcome,
  ): Promise<CompletedAttempt> {
    return this.#transaction(() => {
      const line = this.line(lineId);
      // 0111: a pending outcome at the tenth attempt is written failed (RG79)
      const written =
        outcome.status === "pending" && line.attempts >= 10
          ? "failed"
          : outcome.status;
      line.status = written;
      this.completions.push({
        id: lineId,
        outcome,
        begun: this.begun.includes(lineId),
      });
      return { writtenStatus: written, journalInserted: false };
    });
  }
}

// ---------------------------------------------------------------------------------------------
// In-memory connectors
// ---------------------------------------------------------------------------------------------

type FakeConnector = Connector & {
  /** Ids of the lines whose call was made, in order. */
  sent: string[];
  /** Open queue transactions at the moment of each call (G4: always 0). */
  openAtCall: number[];
};

type ConnectorSpec = {
  hasCredentials?: boolean;
  recipientDomain?: string;
  skip?: string;
  fail?: string;
  rejected?: string[];
  result?: (line: ClaimedLine) => CallResult | Promise<CallResult>;
};

function connector(
  destination: OutboxDestination,
  queue: FakeQueue,
  spec: ConnectorSpec = {},
): FakeConnector {
  const sent: string[] = [];
  const openAtCall: number[] = [];
  const fake: FakeConnector = {
    destination,
    hasCredentials: spec.hasCredentials ?? true,
    sent,
    openAtCall,
    prepare(line: ClaimedLine): Promise<Preparation> {
      if (spec.skip !== undefined) {
        return Promise.resolve({ kind: "skip", reason: spec.skip });
      }
      if (spec.fail !== undefined) {
        return Promise.resolve({ kind: "fail", errorCode: spec.fail });
      }
      // The values stay in the closure: only the names and the verdict leave (decision 3).
      const attributes: Record<string, string> = {
        COMPANY: ATTRIBUTE_VALUE,
        EMAIL: RECIPIENT,
        LANGUAGE: "fr",
      };
      return Promise.resolve({
        kind: "mapped",
        description: {
          operation:
            destination === "brevo_transactional"
              ? "send_transactional"
              : "upsert_contact",
          templateCode:
            destination === "brevo_transactional"
              ? "account.welcome_advertiser"
              : null,
          attributeNames: Object.keys(attributes).reverse(),
          rejectedAttributeNames: spec.rejected ?? [],
        },
        recipientDomain: spec.recipientDomain ?? RECIPIENT_DOMAIN,
        send: async () => {
          sent.push(line.id);
          openAtCall.push(queue.openTransactions);
          if (spec.result !== undefined) {
            return spec.result(line);
          }
          return destination === "brevo_transactional"
            ? {
                kind: "succeeded",
                providerMessageId: `<message-${line.id}@relay.test>`,
                locale: "fr",
                templateVersion: 1,
              }
            : { kind: "succeeded", providerContactId: PROVIDER_CONTACT };
        },
      });
    },
  };
  return fake;
}

// ---------------------------------------------------------------------------------------------
// The drain under test, with a manual clock
// ---------------------------------------------------------------------------------------------

let capture: ReturnType<typeof captureLogStream>;
let clock: number;
let sleeps: number[];

beforeEach(() => {
  capture = captureLogStream();
  clock = 1_000_000;
  sleeps = [];
});

function drain(
  queue: FakeQueue,
  connectors: Partial<Record<OutboxDestination, Connector>>,
  sync: Partial<SyncSettings> = {},
  overrides: Partial<DrainDependencies> = {},
) {
  const dependencies: DrainDependencies = {
    queue,
    connectors,
    worker: "worker-test",
    sync: {
      mode: "live",
      environment: "staging",
      nonProductionRecipientAllowlist: ["example.test"],
      ...sync,
    },
    logger: createLogger(
      { service: "worker", environment: "staging", version: "test" },
      capture.destination,
    ),
    now: () => clock,
    sleep: (ms: number) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    ...overrides,
  };
  return createOutboxDrain(dependencies);
}

type LogLine = Record<string, unknown> & { msg: string; level: string };

function logLines(): LogLine[] {
  return capture.lines().map((line) => JSON.parse(line) as LogLine);
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let turn = 0; turn < 200 && !condition(); turn += 1) {
    await new Promise((done) => setImmediate(done));
  }
  expect(condition()).toBe(true);
}

// ---------------------------------------------------------------------------------------------

describe("lead-pipeline T9, 02 §18.4 G4: a slow connector holds no lock and delays no other destination", () => {
  it("calls with no queue transaction open, and closes the other destinations while the slow call waits", async () => {
    const queue = new FakeQueue();
    const slow = deferred<CallResult>();
    const apolloLine = queue.add("apollo_contact");
    const brevoLine = queue.add("brevo_contact");
    const welcome = queue.add("brevo_transactional");
    const apollo = connector("apollo_contact", queue, {
      result: () => slow.promise,
    });
    const brevo = connector("brevo_contact", queue);
    const transactional = connector("brevo_transactional", queue);
    const turn = drain(queue, {
      apollo_contact: apollo,
      brevo_contact: brevo,
      brevo_transactional: transactional,
    }).turn(new AbortController().signal);

    await waitUntil(
      () =>
        queue.outcomeOf(brevoLine) !== undefined &&
        queue.outcomeOf(welcome) !== undefined,
    );
    // Apollo is still in its call: its line is not closed, and no transaction is open
    expect(apollo.sent).toEqual([apolloLine]);
    expect(queue.outcomeOf(apolloLine)).toBeUndefined();
    expect(queue.openTransactions).toBe(0);

    slow.resolve({ kind: "succeeded", providerContactId: PROVIDER_CONTACT });
    expect(await turn).toBe(3);
    expect(queue.outcomeOf(apolloLine)?.outcome).toEqual({
      status: "succeeded",
      dryRun: false,
      providerContactId: PROVIDER_CONTACT,
    });
    expect([
      ...apollo.openAtCall,
      ...brevo.openAtCall,
      ...transactional.openAtCall,
    ]).toEqual([0, 0, 0]);
  });
});

describe("lead-pipeline T5: one rate budget per category", () => {
  it("a 429 on the contacts puts them off, the transactional e-mails leave in the same turn", async () => {
    const queue = new FakeQueue();
    const contacts = [
      queue.add("brevo_contact"),
      queue.add("brevo_contact"),
    ] as const;
    const welcomes = [
      queue.add("brevo_transactional"),
      queue.add("brevo_transactional"),
    ] as const;
    const brevo = connector("brevo_contact", queue, {
      result: () => ({
        kind: "retry",
        errorCode: "brevo.rate_limited",
        rateLimited: true,
        retryAfterSeconds: 120,
      }),
    });
    const transactional = connector("brevo_transactional", queue);
    const worker = drain(queue, {
      brevo_contact: brevo,
      brevo_transactional: transactional,
    });

    await worker.turn(new AbortController().signal);
    expect(transactional.sent).toEqual(welcomes);
    expect(queue.outcomeOf(contacts[0])?.outcome).toEqual({
      status: "pending",
      dryRun: false,
      errorCode: "brevo.rate_limited",
      retryInSeconds: 120,
    });
    // The second contact is not attempted: put off without using an attempt (TM1.8)
    expect(brevo.sent).toEqual([contacts[0]]);
    expect(queue.outcomeOf(contacts[1])).toMatchObject({
      begun: false,
      outcome: { status: "pending", errorCode: "rate_limited" },
    });
    const putOff = queue.outcomeOf(contacts[1])?.outcome;
    expect(putOff?.status === "pending" && putOff.retryInSeconds).toBe(120);
    expect(queue.line(contacts[1]).attempts).toBe(0);

    // Next turn, still within the pause: the contacts wait, a new e-mail leaves at once
    const later = queue.add("brevo_transactional");
    queue.line(contacts[1]).status = "pending";
    clock += 10_000;
    await worker.turn(new AbortController().signal);
    expect(transactional.sent).toEqual([...welcomes, later]);
    expect(brevo.sent).toEqual([contacts[0]]);
  });

  it("a contact budget used up never slows the e-mails: separate counters, read at consumption", async () => {
    const queue = new FakeQueue();
    queue.settings = {
      ...SETTINGS,
      rate_limits: {
        brevo_contact_per_minute: 1,
        brevo_transactional_per_minute: 60,
        apollo_contact_per_minute: 20,
      },
    };
    const contacts = [
      queue.add("brevo_contact"),
      queue.add("brevo_contact"),
    ] as const;
    const welcomes = [
      queue.add("brevo_transactional"),
      queue.add("brevo_transactional"),
    ] as const;
    const brevo = connector("brevo_contact", queue);
    const transactional = connector("brevo_transactional", queue);
    await drain(queue, {
      brevo_contact: brevo,
      brevo_transactional: transactional,
    }).turn(new AbortController().signal);

    expect(transactional.sent).toEqual(welcomes);
    expect(brevo.sent).toEqual([contacts[0]]);
    expect(queue.outcomeOf(contacts[1])).toMatchObject({
      begun: false,
      outcome: { status: "pending", errorCode: "rate_limited" },
    });
    // the e-mails waited one second between them (60 a minute), never a contact's minute
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(LANE_WAIT_BUDGET_MS);
  });

  it("spaces the calls of a category evenly, without a burst (16 RG139)", () => {
    const now = { value: 0 };
    const limiter = new CategoryRateLimiter(() => now.value);
    expect(limiter.reserve("brevo_contact", 60)).toBe(0);
    expect(limiter.reserve("brevo_contact", 60)).toBe(1_000);
    expect(limiter.reserve("brevo_transactional", 60)).toBe(0);
    expect(limiter.delayMs("brevo_contact")).toBe(2_000);
    now.value = 5_000;
    expect(limiter.delayMs("brevo_contact")).toBe(0);
    limiter.pause("brevo_contact", 30_000);
    expect(limiter.delayMs("brevo_contact")).toBe(30_000);
    expect(limiter.delayMs("brevo_transactional")).toBe(0);
  });
});

describe("TM1.7, RG75: destinations are independent, a destination keeps the order of the claim", () => {
  it("calls the lines of one destination in the order of the claim, one at a time", async () => {
    const queue = new FakeQueue();
    const ids = [
      queue.add("brevo_contact", { subject: "account:a" }),
      queue.add("brevo_contact", { subject: "account:b" }),
      queue.add("brevo_contact", { subject: "account:c", priority: 0 }),
    ] as const;
    const brevo = connector("brevo_contact", queue);
    await drain(queue, { brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(brevo.sent).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("a failing destination neither stops nor delays the others", async () => {
    const queue = new FakeQueue();
    const apolloLine = queue.add("apollo_contact");
    const brevoLine = queue.add("brevo_contact");
    const apollo = connector("apollo_contact", queue, {
      result: () => {
        throw new Error(`Apollo exploded for ${RECIPIENT}`);
      },
    });
    const brevo = connector("brevo_contact", queue);
    await drain(queue, { apollo_contact: apollo, brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(queue.outcomeOf(brevoLine)?.outcome.status).toBe("succeeded");
    // an unexpected error is transient, its message never kept nor logged
    expect(queue.outcomeOf(apolloLine)?.outcome).toEqual({
      status: "pending",
      dryRun: false,
      errorCode: "worker.connector_error",
      retryInSeconds: 60,
    });
    expect(valuesFoundIn(capture.text(), [RECIPIENT])).toEqual([]);
  });
});

describe("TM1.8, 05 RG79 (EC-9): transient failures wait by the schedule read at consumption", () => {
  it("waits retry_schedule[attempt] after each attempt, then the tenth is written failed", async () => {
    const queue = new FakeQueue();
    const id = queue.add("brevo_contact");
    const brevo = connector("brevo_contact", queue, {
      result: () => ({
        kind: "retry",
        errorCode: "brevo.unavailable",
        errorMessage: "Brevo answered 503",
      }),
    });
    const worker = drain(queue, { brevo_contact: brevo });
    const delays: number[] = [];
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      queue.line(id).status = "pending";
      clock += 120_000;
      await worker.turn(new AbortController().signal);
      const outcome = queue.completions.at(-1)?.outcome;
      delays.push(outcome?.status === "pending" ? outcome.retryInSeconds : -1);
    }
    expect(delays).toEqual([...SCHEDULE.slice(1), 86400]);
    expect(queue.line(id)).toMatchObject({ status: "failed", attempts: 10 });
    expect(queue.completions.at(-1)?.outcome).toMatchObject({
      errorCode: "brevo.unavailable",
      errorMessage: "Brevo answered 503",
    });
  });

  it("follows a schedule changed without redeployment, and a Retry-After bounded to 48 h", async () => {
    expect(retryDelaySeconds([5, 7], 1)).toBe(7);
    expect(retryDelaySeconds([5, 7], 4)).toBe(7);
    expect(retryDelaySeconds(SCHEDULE, 2, 30)).toBe(30);
    expect(retryDelaySeconds(SCHEDULE, 2, 10_000_000)).toBe(
      MAX_RETRY_DELAY_SECONDS,
    );
    expect(retryDelaySeconds(SCHEDULE, 2, 1.2)).toBe(2);

    const queue = new FakeQueue();
    const id = queue.add("apollo_contact");
    const apollo = connector("apollo_contact", queue, {
      result: () => ({ kind: "retry", errorCode: "apollo.unavailable" }),
    });
    queue.settings = { ...SETTINGS, retry_schedule: [0, 42] };
    await drain(queue, { apollo_contact: apollo }).turn(
      new AbortController().signal,
    );
    expect(queue.outcomeOf(id)?.outcome).toMatchObject({ retryInSeconds: 42 });
  });

  it("a permanent failure fails at once with its cause in clear", async () => {
    const queue = new FakeQueue();
    const id = queue.add("brevo_contact");
    const brevo = connector("brevo_contact", queue, {
      result: () => ({
        kind: "failed",
        errorCode: "brevo.invalid_parameter",
        errorMessage: "Brevo refused the attribute LANGUAGE",
      }),
    });
    await drain(queue, { brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(queue.outcomeOf(id)?.outcome).toEqual({
      status: "failed",
      dryRun: false,
      errorCode: "brevo.invalid_parameter",
      errorMessage: "Brevo refused the attribute LANGUAGE",
    });
  });

  it("never calls without a rate limit for the category: the line waits, the cause in clear", async () => {
    const queue = new FakeQueue();
    queue.settings = { ...SETTINGS, rate_limits: {} };
    const id = queue.add("brevo_contact");
    const brevo = connector("brevo_contact", queue);
    await drain(queue, { brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(brevo.sent).toEqual([]);
    expect(queue.outcomeOf(id)?.outcome).toEqual({
      status: "pending",
      dryRun: false,
      errorCode: "settings.rate_limit_missing",
      retryInSeconds: 60,
    });
  });
});

describe("TM1.10: SIGTERM during a batch loses no line", () => {
  it("finishes the attempt in progress, gives back the lines not begun without using an attempt", async () => {
    const queue = new FakeQueue();
    const ids = [
      queue.add("brevo_contact", { subject: "account:a" }),
      queue.add("brevo_contact", { subject: "account:b" }),
      queue.add("brevo_contact", { subject: "account:c" }),
    ] as const;
    const slow = deferred<CallResult>();
    const brevo = connector("brevo_contact", queue, {
      result: (line) =>
        line.id === ids[0]
          ? slow.promise
          : { kind: "succeeded", providerContactId: PROVIDER_CONTACT },
    });
    const stop = new AbortController();
    const turn = drain(queue, { brevo_contact: brevo }).turn(stop.signal);
    await waitUntil(() => brevo.sent.length === 1);
    stop.abort();
    slow.resolve({ kind: "succeeded", providerContactId: PROVIDER_CONTACT });
    await turn;

    expect(queue.outcomeOf(ids[0])?.outcome.status).toBe("succeeded");
    for (const id of [ids[1], ids[2]]) {
      expect(queue.outcomeOf(id)).toEqual({
        id,
        begun: false,
        outcome: {
          status: "pending",
          dryRun: false,
          errorCode: "worker_stopping",
          retryInSeconds: 0,
        },
      });
      expect(queue.line(id).attempts).toBe(0);
    }
    expect(brevo.sent).toEqual([ids[0]]);
  });

  it("takes back orphans at start, and stops between two turns without claiming again", async () => {
    const queue = new FakeQueue();
    const stop = new AbortController();
    // the rest between two turns lasts until the stop
    const worker = drain(
      queue,
      {},
      {},
      {
        sleep: (_ms: number, signal?: AbortSignal) =>
          new Promise<void>((done) => {
            signal?.addEventListener("abort", () => done(), { once: true });
          }),
      },
    );
    const running = worker.run(stop.signal);
    await waitUntil(() => queue.recoveries === 1);
    stop.abort();
    await running;
    expect(queue.recoveries).toBe(1);
  });

  it("abandons a line taken back meanwhile, without closing it twice", async () => {
    const queue = new FakeQueue();
    const id = queue.add("brevo_contact");
    queue.takenBack.add(id);
    const brevo = connector("brevo_contact", queue);
    await drain(queue, { brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(brevo.sent).toEqual([]);
    expect(queue.completions).toEqual([]);
    expect(logLines().map((line) => line.msg)).toContain(
      "leads.line.taken_back",
    );
  });

  it("a destination without a connector waits an hour, without using an attempt", async () => {
    const queue = new FakeQueue();
    const id = queue.add("apollo_contact");
    await drain(queue, {}).turn(new AbortController().signal);
    expect(queue.outcomeOf(id)).toEqual({
      id,
      begun: false,
      outcome: {
        status: "pending",
        dryRun: false,
        errorCode: "worker.connector_unavailable",
        retryInSeconds: 3600,
      },
    });
  });
});

describe("02 §12.4: the three locks of a non-production environment", () => {
  it("lock 2, dry_run: no call, succeeded with dry_run, and the would_send line without any value", async () => {
    const queue = new FakeQueue();
    const contact = queue.add("brevo_contact");
    const welcome = queue.add("brevo_transactional");
    const brevo = connector("brevo_contact", queue, { hasCredentials: false });
    const transactional = connector("brevo_transactional", queue);
    await drain(
      queue,
      { brevo_contact: brevo, brevo_transactional: transactional },
      { mode: "dry_run", nonProductionRecipientAllowlist: [] },
    ).turn(new AbortController().signal);

    expect([...brevo.sent, ...transactional.sent]).toEqual([]);
    for (const id of [contact, welcome]) {
      expect(queue.outcomeOf(id)?.outcome).toEqual({
        status: "succeeded",
        dryRun: true,
      });
    }
    const wouldSend = logLines().filter(
      (line) => line.msg === "leads.dry_run.would_send",
    );
    expect(wouldSend).toHaveLength(2);
    expect(
      wouldSend.find((line) => line.destination === "brevo_transactional"),
    ).toMatchObject({
      level: "info",
      outboxEventId: welcome,
      eventType: "lead.created",
      destination: "brevo_transactional",
      operation: "send_transactional",
      templateCode: "account.welcome_advertiser",
      attributeNames: ["COMPANY", "EMAIL", "LANGUAGE"],
      outputCheck: "pass",
      rejectedAttributeNames: [],
    });
    expect(capture.text()).not.toContain("@");
    expect(
      valuesFoundIn(capture.text(), [
        ACCOUNT,
        RECIPIENT,
        ATTRIBUTE_VALUE,
        "example.test",
      ]),
    ).toEqual([]);
  });

  it("the output check runs in dry_run as in live: a rejection fails the line, attribute names only", async () => {
    const queue = new FakeQueue();
    const dry = queue.add("brevo_contact", { subject: "account:a" });
    const brevo = connector("brevo_contact", queue, { rejected: ["COMPANY"] });
    await drain(queue, { brevo_contact: brevo }, { mode: "dry_run" }).turn(
      new AbortController().signal,
    );
    const live = queue.add("brevo_contact", { subject: "account:b" });
    await drain(queue, { brevo_contact: brevo }).turn(
      new AbortController().signal,
    );
    expect(brevo.sent).toEqual([]);
    expect(queue.outcomeOf(dry)?.outcome).toEqual({
      status: "failed",
      dryRun: true,
      errorCode: "output_check_rejected",
      errorMessage: "attributes refused by the output check: COMPANY",
    });
    expect(queue.outcomeOf(live)?.outcome).toMatchObject({
      status: "failed",
      dryRun: false,
      errorCode: "output_check_rejected",
    });
    expect(
      logLines().find((line) => line.msg === "leads.dry_run.would_send"),
    ).toMatchObject({
      outputCheck: "reject",
      rejectedAttributeNames: ["COMPANY"],
    });
  });

  it("lock 1, no key: skipped_no_credentials, nothing called", async () => {
    const queue = new FakeQueue();
    const id = queue.add("apollo_contact");
    const apollo = connector("apollo_contact", queue, {
      hasCredentials: false,
    });
    await drain(queue, { apollo_contact: apollo }).turn(
      new AbortController().signal,
    );
    expect(apollo.sent).toEqual([]);
    expect(queue.outcomeOf(id)?.outcome).toEqual({
      status: "skipped",
      dryRun: false,
      reason: "skipped_no_credentials",
    });
  });

  it("lock 3, live outside production: a domain off the allow-list is skipped_non_production, after the mapping", async () => {
    const queue = new FakeQueue();
    const outside = queue.add("brevo_transactional", { subject: "account:a" });
    const outsideBrevo = connector("brevo_transactional", queue, {
      recipientDomain: "gmail.com",
    });
    await drain(queue, { brevo_transactional: outsideBrevo }).turn(
      new AbortController().signal,
    );
    const listed = queue.add("brevo_transactional", { subject: "account:b" });
    const listedBrevo = connector("brevo_transactional", queue, {
      recipientDomain: "Example.TEST",
    });
    await drain(queue, { brevo_transactional: listedBrevo }).turn(
      new AbortController().signal,
    );
    expect(outsideBrevo.sent).toEqual([]);
    expect(queue.outcomeOf(outside)?.outcome).toEqual({
      status: "skipped",
      dryRun: false,
      reason: "skipped_non_production",
    });
    // the condition is positive: the domain is in the list, letter case aside
    expect(listedBrevo.sent).toEqual([listed]);
    expect(queue.outcomeOf(listed)?.outcome).toMatchObject({
      status: "succeeded",
      dryRun: false,
      locale: "fr",
      templateVersion: 1,
    });
  });

  it("in production, live calls every address: the allow-list is a non-production lock", async () => {
    const queue = new FakeQueue();
    queue.add("brevo_contact");
    const brevo = connector("brevo_contact", queue, {
      recipientDomain: "gmail.com",
    });
    await drain(
      queue,
      { brevo_contact: brevo },
      { environment: "production", nonProductionRecipientAllowlist: [] },
    ).turn(new AbortController().signal);
    expect(brevo.sent).toHaveLength(1);
  });

  it("a skip of the connector (qualification, RG80) is kept with its reason, nothing called", async () => {
    const queue = new FakeQueue();
    const id = queue.add("brevo_contact");
    const brevo = connector("brevo_contact", queue, { skip: "no_consent" });
    await drain(queue, { brevo_contact: brevo }, { mode: "dry_run" }).turn(
      new AbortController().signal,
    );
    expect(queue.outcomeOf(id)?.outcome).toEqual({
      status: "skipped",
      dryRun: true,
      reason: "no_consent",
    });
  });

  it("a line the connector cannot send fails at once with its cause, in dry_run as in live, nothing called", async () => {
    for (const mode of ["live", "dry_run"] as const) {
      const queue = new FakeQueue();
      const id = queue.add("brevo_transactional");
      const brevo = connector("brevo_transactional", queue, {
        fail: "template_not_supported",
      });
      await drain(queue, { brevo_transactional: brevo }, { mode }).turn(
        new AbortController().signal,
      );
      expect(queue.outcomeOf(id)?.outcome).toEqual({
        status: "failed",
        dryRun: mode === "dry_run",
        errorCode: "template_not_supported",
      });
      expect(brevo.sent).toHaveLength(0);
    }
  });
});

describe("D60: the log lines of the drain", () => {
  it("name lines, destinations and codes, never an account, an address or a value", async () => {
    const queue = new FakeQueue();
    queue.add("brevo_contact");
    queue.add("apollo_contact");
    queue.add("brevo_transactional");
    await drain(queue, {
      brevo_contact: connector("brevo_contact", queue),
      apollo_contact: connector("apollo_contact", queue, {
        result: () => ({
          kind: "retry",
          errorCode: "apollo.unavailable",
          errorMessage: `no answer for ${RECIPIENT}`,
        }),
      }),
      brevo_transactional: connector("brevo_transactional", queue, {
        recipientDomain: "gmail.com",
      }),
    }).turn(new AbortController().signal);

    const completed = logLines().filter(
      (line) => line.msg === "leads.line.completed",
    );
    expect(completed.map((line) => line.status).sort()).toEqual([
      "pending",
      "skipped",
      "succeeded",
    ]);
    expect(capture.text()).not.toContain("@");
    expect(
      valuesFoundIn(capture.text(), [
        ACCOUNT,
        RECIPIENT,
        ATTRIBUTE_VALUE,
        PROVIDER_CONTACT,
      ]),
    ).toEqual([]);
  });

  it("a worker identifier fits the database's pattern, whatever the replica id", () => {
    for (const instance of ["local", "8c1f…/replica 2", "x".repeat(300)]) {
      expect(workerIdentifier(instance)).toMatch(
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/,
      );
    }
    expect(workerIdentifier("local")).not.toBe(workerIdentifier("local"));
  });
});
