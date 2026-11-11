// The database half of E-3 `leads.drain_outbox` (docs/mvp/03 §4 P7; migration 0111): the four
// steps of the worker loop, each in its own short elevated transaction, never around an external
// call (02 §18.4 G4). The queries are in repository.ts.
//
//   claim     up to 20 pending lines, FOR UPDATE SKIP LOCKED, one per (subject, destination) at a
//             time (05 RG77, RG78), set to processing for this worker
//   begin     FIRST for each claimed line: the attempt is counted (RG79) and the state read at
//             consumption (RG37): account, consents in force, settings (EC-8); never an address
//   complete  the outcome: succeeded | skipped + reason | pending + delay | failed + cause, the dry
//             run always explicit (decision 2 of the architect, J6)
//   recover   the lines a stopped worker left in processing for more than 600 s (TM1.10), and
//             the configuration failures whose setting was corrected since (05 RG161, 0146)
//
// Register (EC-52 (3)): the claim is a reservation and the outcome of a queue line closes an
// existing line, so neither writes one; the journal line of a welcome e-mail is an insertion, whose
// subject is the account (elevated.leads.drain_outbox).
import type { BrevoIdsFromEnvironment } from "../../config/schema.ts";
import {
  withElevatedTransaction,
  type WorkerDatabase,
} from "../../db/index.ts";
import {
  beginAttempt,
  claimLines,
  completeAttempt,
  isLineNotInProcessing,
  readApolloSubject,
  readBrandProfileAttributes,
  readBrevoBadgeEmail,
  readBrevoCreatorProfileDecision,
  readBrevoErasureSubject,
  readBrevoPortfolioDecision,
  readBrevoProfileDecision,
  readBrevoSubject,
  readBrevoVerificationEmail,
  readCreatorProfileAttributes,
  readVerifiedBadge,
  recoverStaleLines,
  startWorkerStep,
  type AttemptOutcome,
  type ApolloSubject,
  type AttemptState,
  type BrandProfileAttributes,
  type BrevoBadgeEmail,
  type BrevoCreatorProfileDecision,
  type BrevoErasureSubject,
  type BrevoPortfolioDecision,
  type BrevoProfileDecision,
  type BrevoSubject,
  type BrevoVerificationEmail,
  type ClaimedLine,
  type CreatorProfileAttributes,
  type RecoveredLine,
  type VerifiedBadge,
  type WorkerStart,
  type WrittenStatus,
} from "./repository.ts";

/** The line is not in processing for this worker any more (55000): the loop abandons it. */
export class LineTakenBackError extends Error {
  constructor() {
    super("the queue line is not in processing for this worker");
    this.name = "LineTakenBackError";
  }
}

export type CompletedAttempt = {
  /** A pending outcome at the tenth attempt is written failed (05 RG79). */
  writtenStatus: WrittenStatus;
  journalInserted: boolean;
};

export async function claimOutboxBatch(
  database: WorkerDatabase,
  requestId: string,
  worker: string,
): Promise<ClaimedLine[]> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => ({ value: await claimLines(tx, worker), auditSubject: null }),
  );
}

export async function beginOutboxAttempt(
  database: WorkerDatabase,
  requestId: string,
  lineId: string,
  worker: string,
): Promise<AttemptState> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => ({
      value: await beginAttempt(tx, lineId, worker),
      auditSubject: null,
    }),
  );
}

export async function completeOutboxAttempt(
  database: WorkerDatabase,
  requestId: string,
  lineId: string,
  worker: string,
  outcome: AttemptOutcome,
): Promise<CompletedAttempt> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => {
      const recorded = await completeAttempt(tx, lineId, worker, outcome);
      return {
        value: {
          writtenStatus: recorded.writtenStatus,
          journalInserted: recorded.journalInserted,
        },
        // The journal line of a welcome e-mail is the only subject, on its account.
        auditSubject: recorded.journalInserted ? recorded.accountId : null,
      };
    },
  );
}

export async function recoverStaleOutboxLines(
  database: WorkerDatabase,
  requestId: string,
  startedAt: string,
): Promise<RecoveredLine[]> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => ({
      value: await recoverStaleLines(tx, startedAt),
      auditSubject: null,
    }),
  );
}

/**
 * The Brevo connectors' own read (0112): the subject's address and mapped fields, for a line in
 * processing for this worker. A privileged read of an address: its register line is on the
 * account (CLAUDE.md §5 rule 5). Its own short transaction, closed before the call (G4).
 */
export async function readBrevoSubjectOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoSubject | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const subject = await readBrevoSubject(tx, line.id, worker);
        return {
          value: subject,
          auditSubject:
            subject === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo contact connector's read of an erased account (0136, account.deleted): the contact id
 * and the address held until Brevo confirms, as readBrevoSubjectOf: a privileged read of an address,
 * its register line on the account, its own short transaction, closed before the call (G4).
 */
export async function readBrevoErasureSubjectOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoErasureSubject | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const subject = await readBrevoErasureSubject(tx, line.id, worker);
        return {
          value: subject,
          auditSubject:
            subject === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo connector's read of a brand decision (0211, profile.decision): the decision, its reason,
 * the message of the agent and the account's language, for a line in processing for this worker.
 * It reads no address (that comes from readBrevoSubjectOf); its register line is on the account all
 * the same, as the other privileged reads of the worker. Its own short transaction, closed before
 * the call (G4).
 */
export async function readBrevoProfileDecisionOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoProfileDecision | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const decision = await readBrevoProfileDecision(tx, line.id, worker);
        return {
          value: decision,
          auditSubject:
            decision === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo connector's read of a creator profile decision (0245, creator_profile.decision): the
 * kind of the entry, the decision, its reason, the message of the agent and the account's language,
 * for a line in processing for this worker. As readBrevoProfileDecisionOf: no address, its register
 * line on the account, its own short transaction closed before the call (G4).
 */
export async function readBrevoCreatorProfileDecisionOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoCreatorProfileDecision | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const decision = await readBrevoCreatorProfileDecision(
          tx,
          line.id,
          worker,
        );
        return {
          value: decision,
          auditSubject:
            decision === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo connector's read of the decision of a visual (0245, portfolio.decision): the decision,
 * its reason, whether it replaces another visual, the day of its deposit and the account's
 * language. Same shape as readBrevoCreatorProfileDecisionOf.
 */
export async function readBrevoPortfolioDecisionOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoPortfolioDecision | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const decision = await readBrevoPortfolioDecision(tx, line.id, worker);
        return {
          value: decision,
          auditSubject:
            decision === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo contact connector's read of the creator attributes (0245; 07 RG107 to RG110): the live
 * storefront of the line's account, for a Brevo contact line in processing for this worker. Never
 * called for an Apollo line (the base refuses it, RG109). Its own short transaction, closed before
 * the call (G4).
 */
export async function readCreatorProfileAttributesOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<CreatorProfileAttributes | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const attributes = await readCreatorProfileAttributes(
          tx,
          line.id,
          worker,
        );
        return {
          value: attributes,
          auditSubject:
            attributes === null
              ? null
              : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo connector's read of the facts of a verification e-mail (0227, verification.received,
 * .code_issued, .decision, .request_expired): the level, the reason, the date of the badge or the
 * kind and expiry of the code, and the account's language, for a line in processing for this
 * worker. It reads no address (that comes from readBrevoSubjectOf) and never the code; its
 * register line is on the account all the same, as the other privileged reads of the worker. Its
 * own short transaction, closed before the call (G4).
 */
export async function readBrevoVerificationEmailOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoVerificationEmail | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const facts = await readBrevoVerificationEmail(tx, line.id, worker);
        return {
          value: facts,
          auditSubject:
            facts === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo connector's read of the facts of an e-mail of the life of the badge (0236,
 * verification.expiry_*, .revoked_notice, .dispute_received, .dispute_outcome, .reconfirm_required,
 * .agent_opened_notice) for a line in processing for this worker: the object the line names, its
 * level, reason and dates, and the account's language. No address (readBrevoSubjectOf), no figure,
 * no handle. Its own short transaction, closed before the call (G4).
 */
export async function readBrevoBadgeEmailOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrevoBadgeEmail | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const facts = await readBrevoBadgeEmail(tx, line.id, worker);
        return {
          value: facts,
          auditSubject:
            facts === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Brevo contact connector's read of the badge level of the account (0227, VERIFIED_LEVEL and
 * VERIFIED_AT): for a brevo_contact line in processing for this worker, never Apollo. Its own
 * short transaction, closed before the call (G4).
 */
export async function readVerifiedBadgeOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<VerifiedBadge | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const badge = await readVerifiedBadge(tx, line.id, worker);
        return {
          value: badge,
          auditSubject:
            badge === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The contact connectors' read of the brand attributes (0212, profile.completed and lead.updated):
 * the live profile of the line's account, for a line in processing for this worker, shared by
 * Brevo and Apollo. It reads no address; its register line is on the account all the same, as the
 * other privileged reads of the worker. Its own short transaction, closed before the call (G4).
 */
export async function readBrandProfileAttributesOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<BrandProfileAttributes | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const attributes = await readBrandProfileAttributes(
          tx,
          line.id,
          worker,
        );
        return {
          value: attributes,
          auditSubject:
            attributes === null
              ? null
              : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The Apollo connector's own read (0113), as readBrevoSubjectOf: a privileged read of an address,
 * its register line on the account, its own short transaction, closed before the call (G4).
 */
export async function readApolloSubjectOf(
  database: WorkerDatabase,
  requestId: string,
  line: ClaimedLine,
  worker: string,
): Promise<ApolloSubject | null> {
  return translated(
    withElevatedTransaction(
      database,
      "leads.drain_outbox",
      requestId,
      async (tx) => {
        const subject = await readApolloSubject(tx, line.id, worker);
        return {
          value: subject,
          auditSubject:
            subject === null ? null : line.subjectKey.slice("account:".length),
        };
      },
    ),
  );
}

/**
 * The four steps as the worker loop sees them (drain.ts), each its own short transaction, closed
 * when the promise settles. Injected, so that the loop is tested on an in-memory queue.
 */
export type OutboxQueue = {
  /** `startedAt`: the start of this process by the database clock (WorkerStart). */
  recover(requestId: string, startedAt: string): Promise<RecoveredLine[]>;
  claim(requestId: string, worker: string): Promise<ClaimedLine[]>;
  /** Rejects with LineTakenBackError on a line no longer this worker's. */
  begin(
    requestId: string,
    lineId: string,
    worker: string,
  ): Promise<AttemptState>;
  /** Rejects with LineTakenBackError on a line no longer this worker's. */
  complete(
    requestId: string,
    lineId: string,
    worker: string,
    outcome: AttemptOutcome,
  ): Promise<CompletedAttempt>;
};

async function translated<T>(step: Promise<T>): Promise<T> {
  try {
    return await step;
  } catch (error) {
    throw isLineNotInProcessing(error) ? new LineTakenBackError() : error;
  }
}

/** The queue of the worker process, on its only pool (EC-20). */
export function createWorkerQueue(database: WorkerDatabase): OutboxQueue {
  return {
    recover: (requestId, startedAt) =>
      recoverStaleOutboxLines(database, requestId, startedAt),
    claim: (requestId, worker) => claimOutboxBatch(database, requestId, worker),
    begin: (requestId, lineId, worker) =>
      translated(beginOutboxAttempt(database, requestId, lineId, worker)),
    complete: (requestId, lineId, worker, outcome) =>
      translated(
        completeOutboxAttempt(database, requestId, lineId, worker, outcome),
      ),
  };
}

/**
 * The start step of the worker, before the first turn and under the motif of E-3 (no new motif in
 * 03 §P7). D68 (founder, 2026-10-17): the Brevo list ids of the environment go into
 * leads.sync_settings (0140, D69: no template id any more); only the ids given are merged, never a
 * null (05 RG163), and none given writes nothing; the base stays the source of truth (RG37). A
 * change is journaled settings.changed by the trigger of leads.sync_settings (0145, D67 (v)): no
 * elevated audit line. Then, in the same transaction (0146): the worker keys in force, for the
 * start check of 05 RG162 (read now, never cached), and the start instant by the database clock.
 */
export async function startWorker(
  database: WorkerDatabase,
  requestId: string,
  ids: BrevoIdsFromEnvironment,
): Promise<WorkerStart> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => ({
      value: await startWorkerStep(tx, ids.listIds),
      auditSubject: null,
    }),
  );
}
