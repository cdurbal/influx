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
//   recover   the lines a stopped worker left in processing for more than 600 s (TM1.10)
//
// Register (EC-52 (3)): the claim is a reservation and the outcome of a queue line closes an
// existing line, so neither writes one; the journal line of a welcome e-mail is an insertion, whose
// subject is the account (elevated.leads.drain_outbox).
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
  readBrevoErasureSubject,
  readBrevoSubject,
  recoverStaleLines,
  type AttemptOutcome,
  type ApolloSubject,
  type AttemptState,
  type BrevoErasureSubject,
  type BrevoSubject,
  type ClaimedLine,
  type RecoveredLine,
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
): Promise<RecoveredLine[]> {
  return withElevatedTransaction(
    database,
    "leads.drain_outbox",
    requestId,
    async (tx) => ({ value: await recoverStaleLines(tx), auditSubject: null }),
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
  recover(requestId: string): Promise<RecoveredLine[]>;
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
    recover: (requestId) => recoverStaleOutboxLines(database, requestId),
    claim: (requestId, worker) => claimOutboxBatch(database, requestId, worker),
    begin: (requestId, lineId, worker) =>
      translated(beginOutboxAttempt(database, requestId, lineId, worker)),
    complete: (requestId, lineId, worker, outcome) =>
      translated(
        completeOutboxAttempt(database, requestId, lineId, worker, outcome),
      ),
  };
}
