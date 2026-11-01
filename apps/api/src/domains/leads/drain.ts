// The worker loop of E-3 `leads.drain_outbox` (02 §6, §11; 05 §I; J6 commit 3), over the four
// steps of queue.ts. Three short steps per line, never an external call while a transaction is
// open (02 §18.4 G4, lead-pipeline T9):
//
//   CLAIM    up to 20 lines in processing for this worker (one transaction)
//   CALL     per line: begin (the attempt counted, the state read at consumption: one
//            transaction), the connector's preparation, the locks of 02 §12.4, the call
//   OUTCOME  complete (one transaction)
//
// Each turn first processes what Brevo reported back (inbound/processing.ts, J7 commit 4), so that a
// withdrawal's consent.revoked lines (priority 0) are claimed by the same turn (05 RG92: < 5 min).
// Each destination is a lane of its own, run side by side (05 RG75): a slow or failing provider
// delays no other destination, and each lane has its own rate budget (lead-pipeline T5). Within a
// lane the lines go one at a time, in the order of the claim (priority first, RG77, RG78).
// Between two turns, at most once a minute, the periodic tasks of E-4 (J7 commit 5, decision 3;
// domains/maintenance/periodic.ts): in the same loop, never side by side with a turn.
// A turn every 2 s while there is work, every 5 s at rest (02 §11.1). On SIGTERM the attempts in
// progress finish and the lines not begun go back to pending without using an attempt (TM1.10).
// After the connector's preparation (a skip always first, 05 RG164), in this order:
//   would_send  dry_run: the line of decision 3, with the names of the missing settings
//   output check  a refusal fails output_check_rejected (16 RG137), never re-queued by itself
//   settings    a missing setting fails the line, in dry_run as in live: an incident without retry
//             (05 RG160), re-queued once the setting is corrected (RG161, below)
//   dry_run   no call, succeeded with dry_run (decision 2)
//   no key    deployed, credentials_missing, an incident (RG160); in development,
//             skipped_no_credentials (lock 1, 18 T17.1)
//   allow-list  live in development (the filter the configuration resolved, D70), a recipient
//             domain not listed: skipped_non_production (lock 3, a positive condition)
// The take-back, at start then at most once a minute between two turns, also re-queues the lines
// failed for a setting corrected since the start of their attempt, or for a key missing from an
// earlier process (05 RG161, D67 (i): in E-3, no new motif nor grant; 0146): the same line, the
// same idempotency key.
// Log lines (D60): line ids, destinations, codes and attribute NAMES, never an account, an address,
// a value or a provider's message.
import { randomUUID } from "node:crypto";
import type { RecipientFilter } from "../../config/schema.ts";
import type { CallResult, Connector, Preparation } from "./connector.ts";
import type { InboundProcessor } from "./inbound/processing.ts";
import { LineTakenBackError, type OutboxQueue } from "./queue.ts";
import { CategoryRateLimiter } from "./rate-limiter.ts";
import type {
  AttemptOutcome,
  AttemptState,
  ClaimedLine,
  OutboxDestination,
} from "./repository.ts";
import {
  configurationFailureCode,
  ratePerMinuteOf,
  retryDelaySeconds,
  retryScheduleOf,
  RG79_STARTING_SCHEDULE,
} from "./settings.ts";

/** 02 §11.1: a turn every 2 s while there is work, every 5 s at rest. */
export const ACTIVE_INTERVAL_MS = 2_000;
export const IDLE_INTERVAL_MS = 5_000;
/**
 * The longest a lane waits for its rate budget within a turn; beyond, the line goes back to
 * pending until its slot, without using an attempt.
 */
export const LANE_WAIT_BUDGET_MS = 2_000;
/** The take-back of orphans (TM1.10) at start, then at most once a minute between two turns. */
export const RECOVER_INTERVAL_MS = 60_000;
/** E-4: the due periodic tasks, at start, then at most once a minute between two turns. */
export const PERIODIC_INTERVAL_MS = 60_000;
/** A destination without a connector in this process waits an hour, without using an attempt. */
export const CONNECTOR_UNAVAILABLE_DELAY_SECONDS = 3_600;

export type SyncSettings = {
  /** Read at start, immutable while running (03 §3.1). */
  mode: "live" | "dry_run";
  /**
   * The recipients a live run may write to, resolved by the configuration (02 §12.4 lock 3, D70):
   * an allow-list of domains in development, unrestricted in a deployed environment.
   */
  recipientFilter: RecipientFilter;
  /**
   * 05 RG160 (D67, D70): a qualified line without a key fails credentials_missing, an incident, in
   * a deployed environment; it is skipped_no_credentials in development (02 §12.4 lock 1, 18
   * T17.1). Resolved by the configuration: the drain never reads the environment.
   */
  keyRequired: boolean;
};

export type DrainLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type DrainDependencies = {
  queue: OutboxQueue;
  /** One per destination; a missing one leaves its lines waiting. */
  connectors: Partial<Record<OutboxDestination, Connector>>;
  /** What Brevo reported back, processed at the start of each turn; none in the loop's tests. */
  inbound?: InboundProcessor;
  /** E-4 (maintenance/periodic.ts): never throws; none in the loop's tests. */
  periodic?: { tick(signal: AbortSignal): Promise<void> };
  /**
   * The beat of the worker (02 §11.3, ops/worker-monitor.ts): at start and after each turn;
   * never throws; none in the loop's tests.
   */
  heartbeat?: { turned(): Promise<void> };
  /** The worker identifier of the claim (workerIdentifier). */
  worker: string;
  /**
   * The start of this process by the database clock (its start step, 0146): the take-back
   * re-queues a credentials_missing line whose attempt began before it (05 RG161).
   */
  startedAt: string;
  sync: SyncSettings;
  logger: DrainLogger;
  now: () => number;
  /** Resolves after `ms`, or as soon as `signal` aborts; never rejects. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export type OutboxDrain = {
  /**
   * One turn: the raw Brevo lines, then claim and every lane to its end. Returns the number of raw
   * lines processed plus the number of queue lines claimed.
   */
  turn(signal: AbortSignal): Promise<number>;
  /** The loop, until `signal` aborts; the turn in progress always finishes. */
  run(signal: AbortSignal): Promise<void>;
};

const WORKER_PATTERN_INVALID = /[^A-Za-z0-9._:-]+/g;

/** A worker identifier for the claim (0111: [A-Za-z0-9][A-Za-z0-9._:-]{0,99}), new per process. */
export function workerIdentifier(instance: string): string {
  const replica = instance.replace(WORKER_PATTERN_INVALID, "-").slice(0, 60);
  return `worker-${replica}-${randomUUID().slice(0, 8)}`;
}

export function createOutboxDrain(
  dependencies: DrainDependencies,
): OutboxDrain {
  const {
    queue,
    connectors,
    inbound,
    periodic,
    heartbeat,
    worker,
    startedAt,
    sync,
    logger,
    now,
    sleep,
  } = dependencies;
  const limiter = new CategoryRateLimiter(now);
  const dryRun = sync.mode === "dry_run";
  const allowlist =
    sync.recipientFilter.kind === "allowlist"
      ? new Set(
          sync.recipientFilter.domains.map((domain) => domain.toLowerCase()),
        )
      : null;

  function takenBack(line: ClaimedLine): void {
    logger.warn(
      { outboxEventId: line.id, destination: line.destination },
      "leads.line.taken_back",
    );
  }

  /** A line not begun goes back to pending: no attempt is used (0111, TM1.10). */
  async function release(
    line: ClaimedLine,
    errorCode: string,
    retryInSeconds: number,
  ): Promise<void> {
    try {
      await queue.complete(randomUUID(), line.id, worker, {
        status: "pending",
        dryRun,
        errorCode,
        retryInSeconds,
      });
    } catch (error) {
      if (error instanceof LineTakenBackError) {
        takenBack(line);
        return;
      }
      throw error;
    }
    logger.info(
      {
        outboxEventId: line.id,
        destination: line.destination,
        errorCode,
        retryInSeconds,
      },
      "leads.line.released",
    );
  }

  function scheduleOf(state: AttemptState): readonly number[] {
    const schedule = retryScheduleOf(state.settings);
    if (schedule === null) {
      logger.error({ key: "retry_schedule" }, "leads.settings.invalid");
      return RG79_STARTING_SCHEDULE;
    }
    return schedule;
  }

  /** The outcome of one begun attempt; the call, if any, made with no transaction open. */
  async function decide(
    line: ClaimedLine,
    connector: Connector,
    state: AttemptState,
  ): Promise<AttemptOutcome> {
    const schedule = scheduleOf(state);
    const transient = (errorCode: string): AttemptOutcome => ({
      status: "pending",
      dryRun,
      errorCode,
      retryInSeconds: retryDelaySeconds(schedule, state.attempt),
    });

    let preparation: Preparation;
    try {
      preparation = await connector.prepare(line, state);
    } catch (error) {
      logger.error(
        { err: error, outboxEventId: line.id, destination: line.destination },
        "leads.connector.prepare_failed",
      );
      return transient("worker.connector_error");
    }
    if (preparation.kind === "skip") {
      return { status: "skipped", dryRun, reason: preparation.reason };
    }
    if (preparation.kind === "fail") {
      return { status: "failed", dryRun, errorCode: preparation.errorCode };
    }

    const { description } = preparation;
    const rejected = [...description.rejectedAttributeNames].sort();
    const missing = [...description.missingSettings].sort();
    if (dryRun) {
      // Decision 3: what it would have sent, by names only; never a column. 05 RG164: the trace
      // comes first, with the names of the missing settings, and the verdict after it.
      logger.info(
        {
          outboxEventId: line.id,
          eventType: line.eventType,
          destination: line.destination,
          operation: description.operation,
          templateCode: description.templateCode,
          attributeNames: [...description.attributeNames].sort(),
          outputCheck: rejected.length === 0 ? "pass" : "reject",
          rejectedAttributeNames: rejected,
          missingSettings: missing,
        },
        "leads.dry_run.would_send",
      );
    }
    // 16 RG137: the output check fails the line, in dry_run as in live (decision 2); it prevails
    // over a missing setting, and is never re-queued by itself (05 RG164).
    if (rejected.length > 0) {
      return {
        status: "failed",
        dryRun,
        errorCode: "output_check_rejected",
        errorMessage: `attributes refused by the output check: ${rejected.join(", ")}`,
      };
    }
    // 05 RG160: a setting of INFLUX missing is an incident, in dry_run as in live, without retry;
    // the names of the settings stay on the line, for the cause shown (RG99), never a value.
    const configurationCode = configurationFailureCode(missing);
    if (configurationCode !== null) {
      return {
        status: "failed",
        dryRun,
        errorCode: configurationCode,
        errorMessage: `settings missing: ${missing.join(", ")}`,
      };
    }
    if (dryRun) {
      return { status: "succeeded", dryRun: true };
    }
    if (!connector.hasCredentials) {
      return sync.keyRequired
        ? {
            status: "failed",
            dryRun,
            errorCode: "credentials_missing",
            errorMessage: "no key of this destination in the worker",
          }
        : { status: "skipped", dryRun, reason: "skipped_no_credentials" };
    }
    if (
      allowlist !== null &&
      !allowlist.has(preparation.recipientDomain.toLowerCase())
    ) {
      return { status: "skipped", dryRun, reason: "skipped_non_production" };
    }

    const perMinute = ratePerMinuteOf(state.settings, line.destination);
    if (perMinute === null) {
      // 16 RG139: never a call outside a budget.
      logger.error(
        { key: "rate_limits", destination: line.destination },
        "leads.settings.invalid",
      );
      return transient("settings.rate_limit_missing");
    }
    const wait = limiter.reserve(line.destination, perMinute);
    if (wait > 0) {
      await sleep(wait);
    }

    let result: CallResult;
    try {
      result = await preparation.send();
    } catch (error) {
      logger.error(
        { err: error, outboxEventId: line.id, destination: line.destination },
        "leads.connector.send_failed",
      );
      return transient("worker.connector_error");
    }
    return outcomeOf(line, result, schedule, state.attempt);
  }

  function outcomeOf(
    line: ClaimedLine,
    result: CallResult,
    schedule: readonly number[],
    attempt: number,
  ): AttemptOutcome {
    switch (result.kind) {
      case "succeeded": {
        const outcome: AttemptOutcome = { status: "succeeded", dryRun: false };
        if (result.providerContactId !== undefined) {
          outcome.providerContactId = result.providerContactId;
        }
        if (result.providerMessageId !== undefined) {
          outcome.providerMessageId = result.providerMessageId;
        }
        if (result.locale !== undefined) {
          outcome.locale = result.locale;
        }
        if (result.templateVersion !== undefined) {
          outcome.templateVersion = result.templateVersion;
        }
        return outcome;
      }
      case "retry": {
        const retryInSeconds = retryDelaySeconds(
          schedule,
          attempt,
          result.retryAfterSeconds,
        );
        if (result.rateLimited === true) {
          // lead-pipeline T5: the category pauses, the other categories do not.
          limiter.pause(line.destination, retryInSeconds * 1_000);
        }
        return {
          status: "pending",
          dryRun: false,
          errorCode: result.errorCode,
          ...(result.errorMessage === undefined
            ? {}
            : { errorMessage: result.errorMessage }),
          retryInSeconds,
        };
      }
      case "failed":
        return {
          status: "failed",
          dryRun: false,
          errorCode: result.errorCode,
          ...(result.errorMessage === undefined
            ? {}
            : { errorMessage: result.errorMessage }),
        };
    }
  }

  async function attempt(
    line: ClaimedLine,
    connector: Connector,
  ): Promise<void> {
    const requestId = randomUUID();
    let state: AttemptState;
    try {
      state = await queue.begin(requestId, line.id, worker);
    } catch (error) {
      if (error instanceof LineTakenBackError) {
        takenBack(line);
        return;
      }
      throw error;
    }
    const outcome = await decide(line, connector, state);
    let written: string;
    try {
      ({ writtenStatus: written } = await queue.complete(
        requestId,
        line.id,
        worker,
        outcome,
      ));
    } catch (error) {
      if (error instanceof LineTakenBackError) {
        takenBack(line);
        return;
      }
      throw error;
    }
    logger.info(
      {
        outboxEventId: line.id,
        destination: line.destination,
        attempt: state.attempt,
        status: written,
        ...(outcome.status === "skipped" ? { skipReason: outcome.reason } : {}),
        ...(outcome.status === "pending" || outcome.status === "failed"
          ? { errorCode: outcome.errorCode }
          : {}),
      },
      "leads.line.completed",
    );
  }

  async function handle(
    line: ClaimedLine,
    deadline: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) {
      return release(line, "worker_stopping", 0);
    }
    const connector = connectors[line.destination];
    if (connector === undefined) {
      return release(
        line,
        "worker.connector_unavailable",
        CONNECTOR_UNAVAILABLE_DELAY_SECONDS,
      );
    }
    const wait = limiter.delayMs(line.destination);
    if (wait > 0 && wait > deadline - now()) {
      return release(line, "rate_limited", Math.ceil(wait / 1_000));
    }
    if (wait > 0) {
      await sleep(wait);
      if (signal.aborted) {
        return release(line, "worker_stopping", 0);
      }
    }
    return attempt(line, connector);
  }

  async function lane(
    lines: readonly ClaimedLine[],
    signal: AbortSignal,
  ): Promise<void> {
    const deadline = now() + LANE_WAIT_BUDGET_MS;
    for (const line of lines) {
      try {
        await handle(line, deadline, signal);
      } catch (error) {
        // The line stays in processing: the take-back returns it (TM1.10).
        logger.error(
          { err: error, outboxEventId: line.id, destination: line.destination },
          "leads.line.error",
        );
      }
    }
  }

  /** A failure here never stops the queue: the raw lines wait for the next turn. */
  async function inboundTurn(signal: AbortSignal): Promise<number> {
    if (inbound === undefined) {
      return 0;
    }
    try {
      return await inbound.turn(signal);
    } catch (error) {
      logger.error({ err: error }, "leads.brevo_inbound.turn_failed");
      return 0;
    }
  }

  async function turn(signal: AbortSignal): Promise<number> {
    if (signal.aborted) {
      return 0;
    }
    const processed = await inboundTurn(signal);
    if (signal.aborted) {
      return processed;
    }
    const lines = await queue.claim(randomUUID(), worker);
    const lanes = new Map<OutboxDestination, ClaimedLine[]>();
    for (const line of lines) {
      const laneLines = lanes.get(line.destination) ?? [];
      laneLines.push(line);
      lanes.set(line.destination, laneLines);
    }
    await Promise.all(
      [...lanes.values()].map((laneLines) => lane(laneLines, signal)),
    );
    return processed + lines.length;
  }

  /**
   * The take-back (TM1.10) and, in the same step, the catch-up of 05 RG161: a system replay,
   * journaled by its motif, its codes and its count, never an account (no human actor: no register
   * line, 0146).
   */
  async function recover(): Promise<void> {
    try {
      const recovered = await queue.recover(randomUUID(), startedAt);
      const orphans = recovered.filter(
        (line) => line.reason === "worker_interrupted",
      );
      if (orphans.length > 0) {
        logger.info(
          {
            count: orphans.length,
            failed: orphans.filter((line) => line.writtenStatus === "failed")
              .length,
          },
          "leads.lines.recovered",
        );
      }
      const restored = recovered.filter(
        (line) => line.reason === "configuration_restored",
      );
      if (restored.length > 0) {
        const codes: Record<string, number> = {};
        for (const line of restored) {
          const code = line.errorCode ?? "unknown";
          codes[code] = (codes[code] ?? 0) + 1;
        }
        logger.info(
          { motif: "configuration_restored", count: restored.length, codes },
          "leads.lines.configuration_restored",
        );
      }
    } catch (error) {
      logger.error({ err: error }, "leads.lines.recover_failed");
    }
  }

  async function periodicTick(signal: AbortSignal): Promise<void> {
    if (periodic === undefined || signal.aborted) {
      return;
    }
    try {
      await periodic.tick(signal);
    } catch (error) {
      logger.error({ err: error }, "maintenance.periodic.tick_failed");
    }
  }

  async function run(signal: AbortSignal): Promise<void> {
    await heartbeat?.turned();
    await recover();
    let lastRecovery = now();
    await periodicTick(signal);
    let lastPeriodic = now();
    while (!signal.aborted) {
      let claimed = 0;
      try {
        claimed = await turn(signal);
      } catch (error) {
        logger.error({ err: error }, "leads.drain.turn_failed");
      }
      await heartbeat?.turned();
      if (signal.aborted) {
        break;
      }
      await sleep(claimed > 0 ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS, signal);
      if (!signal.aborted && now() - lastRecovery >= RECOVER_INTERVAL_MS) {
        await recover();
        lastRecovery = now();
      }
      if (!signal.aborted && now() - lastPeriodic >= PERIODIC_INTERVAL_MS) {
        await periodicTick(signal);
        lastPeriodic = now();
      }
    }
  }

  return { turn, run };
}
