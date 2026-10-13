// What Brevo reported back, processed by the worker (E-3 `leads.drain_outbox`; decisions 1 and 2 of
// the J7 start; 16 §I RG105 to RG108; 05 §J RG89, RG90, RG93; migration 0116). The route only
// wrote raw lines (commit 3); here, one line per short elevated transaction, all its effects and
// its outcome together, by leads.process_brevo_inbound_event(): no external call is ever made while
// it is open (02 §18.4 G4), and none is needed (RG106: a withdrawal is applied as it stands).
//   withdraws a right   unsubscribed, spam, hard_bounce, invalid_email, blocked: the consent
//                       withdrawn (source brevo_webhook) with consent.revoked priority 0 (RG78),
//                       the contact state, the suppression of a complaint (RG93), the incident and
//                       undeliverable on a transactional hard bounce (D37)
//   informs, unknown    an outcome only, never an account (RG107); unknown is journaled (RG105)
// Register (decision 1): one elevated.leads.drain_outbox line per EFFECTIVE change, on the account;
// none for an outcome without effect. Log lines (D60): the line id and the outcome code, and one
// aggregated count per batch; never an account, an address, an event's name or its reason.
import { randomUUID } from "node:crypto";
import {
  withElevatedTransaction,
  type WorkerDatabase,
} from "../../../db/index.ts";
import {
  processInboundLine,
  type BrevoInboundOutcome,
  type ProcessedInboundLine,
} from "./repository.ts";

export {
  BREVO_INBOUND_OUTCOMES,
  type BrevoInboundOutcome,
  type ProcessedInboundLine,
} from "./repository.ts";

/** At most this many raw lines per turn of the worker, each its own transaction. */
export const INBOUND_BATCH_SIZE = 50;

/** One raw line in its own elevated transaction, its register line when an effect was written. */
export async function processInboundEvent(
  database: WorkerDatabase,
  requestId: string,
): Promise<ProcessedInboundLine | null> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => {
      const processed = await processInboundLine(tx);
      return {
        value: processed,
        auditSubject: processed?.auditSubject ?? null,
      };
    },
  );
}

export type InboundLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
};

export type InboundProcessor = {
  /** Up to INBOUND_BATCH_SIZE lines, until none waits or `signal` aborts. Returns the count. */
  turn(signal: AbortSignal): Promise<number>;
};

export function createInboundProcessor(dependencies: {
  /** One line per call, its own transaction; injected so that the loop is tested in memory. */
  process: (requestId: string) => Promise<ProcessedInboundLine | null>;
  logger: InboundLogger;
  batchSize?: number;
}): InboundProcessor {
  const { process, logger } = dependencies;
  const batchSize = dependencies.batchSize ?? INBOUND_BATCH_SIZE;

  return {
    async turn(signal) {
      const counts: Partial<Record<BrevoInboundOutcome, number>> = {};
      let processed = 0;
      while (processed < batchSize && !signal.aborted) {
        const line = await process(randomUUID());
        if (line === null) {
          break;
        }
        processed += 1;
        counts[line.outcome] = (counts[line.outcome] ?? 0) + 1;
        if (line.outcome === "unknown_event") {
          // RG105: accepted, journaled, ignored; the name stays on the raw line (30 days).
          logger.warn(
            { inboundEventId: line.inboundEventId, outcome: line.outcome },
            "leads.brevo_inbound.unknown_event",
          );
        }
      }
      if (processed > 0) {
        logger.info(
          { processed, outcomes: counts },
          "leads.brevo_inbound.batch",
        );
      }
      return processed;
    },
  };
}
