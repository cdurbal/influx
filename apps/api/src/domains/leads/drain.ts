// The worker loop of E-3 `leads.drain_outbox` (02 §6, §11; 05 §I; J6 commit 3), over the four
// steps of queue.ts. Three short steps per line, never an external call while a transaction is
// open (02 §18.4 G4, lead-pipeline T9):
//
//   CLAIM    up to 20 lines in processing for this worker (one transaction)
//   CALL     per line: begin (the attempt counted, the state read at consumption: one
//            transaction), the connector's preparation, the locks of 02 §12.4, the call
//   OUTCOME  complete (one transaction)
//
// Each destination is a lane of its own, run side by side (05 RG75): a slow or failing provider
// delays no other destination, and each lane has its own rate budget (lead-pipeline T5). Within a
// lane the lines go one at a time, in the order of the claim (priority first, RG77, RG78).
// A turn every 2 s while there is work, every 5 s at rest (02 §11.1). On SIGTERM the attempts in
// progress finish and the lines not begun go back to pending without using an attempt (TM1.10).
// The locks, in this order, after the connector's qualification, mapping and output check:
//   dry_run   no call, succeeded with dry_run and the would_send line (decision 2 and 3)
//   no key    skipped_no_credentials (lock 1)
//   allow-list  live outside production, a recipient domain not listed: skipped_non_production
//             (lock 3, a positive condition)
// Log lines (D60): line ids, destinations, codes and attribute NAMES, never an account, an address,
// a value or a provider's message.
import { randomUUID } from "node:crypto";
import type { CallResult, Connector, Preparation } from "./connector.ts";
import { LineTakenBackError, type OutboxQueue } from "./queue.ts";
import { CategoryRateLimiter } from "./rate-limiter.ts";
import type {
  AttemptOutcome,
  AttemptState,
  ClaimedLine,
  OutboxDestination,
} from "./repository.ts";
import {
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
/** A destination without a connector in this process waits an hour, without using an attempt. */
export const CONNECTOR_UNAVAILABLE_DELAY_SECONDS = 3_600;

export type SyncSettings = {
  /** Read at start, immutable while running (03 §3.1). */
  mode: "live" | "dry_run";
  environment: string;
  /** E-mail domains a live run outside production may write to (02 §12.4 lock 3). */
  nonProductionRecipientAllowlist: readonly string[];
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
  /** The worker identifier of the claim (workerIdentifier). */
  worker: string;
  sync: SyncSettings;
  logger: DrainLogger;
  now: () => number;
  /** Resolves after `ms`, or as soon as `signal` aborts; never rejects. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export type OutboxDrain = {
  /** One turn: claim, then every lane to its end. Returns the number of lines claimed. */
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
  const { queue, connectors, worker, sync, logger, now, sleep } = dependencies;
  const limiter = new CategoryRateLimiter(now);
  const dryRun = sync.mode === "dry_run";
  const allowlist = new Set(
    sync.nonProductionRecipientAllowlist.map((domain) => domain.toLowerCase()),
  );

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
    if (dryRun) {
      // Decision 3: what it would have sent, by names only; never a column.
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
        },
        "leads.dry_run.would_send",
      );
    }
    // 16 RG137: the output check fails the line, in dry_run as in live (decision 2).
    if (rejected.length > 0) {
      return {
        status: "failed",
        dryRun,
        errorCode: "output_check_rejected",
        errorMessage: `attributes refused by the output check: ${rejected.join(", ")}`,
      };
    }
    if (dryRun) {
      return { status: "succeeded", dryRun: true };
    }
    if (!connector.hasCredentials) {
      return { status: "skipped", dryRun, reason: "skipped_no_credentials" };
    }
    if (
      sync.environment !== "production" &&
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

  async function turn(signal: AbortSignal): Promise<number> {
    if (signal.aborted) {
      return 0;
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
    return lines.length;
  }

  async function recover(): Promise<void> {
    try {
      const recovered = await queue.recover(randomUUID());
      if (recovered.length > 0) {
        logger.info(
          {
            count: recovered.length,
            failed: recovered.filter((line) => line.writtenStatus === "failed")
              .length,
          },
          "leads.lines.recovered",
        );
      }
    } catch (error) {
      logger.error({ err: error }, "leads.lines.recover_failed");
    }
  }

  async function run(signal: AbortSignal): Promise<void> {
    await recover();
    let lastRecovery = now();
    while (!signal.aborted) {
      let claimed = 0;
      try {
        claimed = await turn(signal);
      } catch (error) {
        logger.error({ err: error }, "leads.drain.turn_failed");
      }
      if (signal.aborted) {
        break;
      }
      await sleep(claimed > 0 ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS, signal);
      if (!signal.aborted && now() - lastRecovery >= RECOVER_INTERVAL_MS) {
        await recover();
        lastRecovery = now();
      }
    }
  }

  return { turn, run };
}
