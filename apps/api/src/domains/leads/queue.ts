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
  recoverStaleLines,
  type AttemptOutcome,
  type AttemptState,
  type ClaimedLine,
  type RecoveredLine,
  type WrittenStatus,
} from "./repository.ts";

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
