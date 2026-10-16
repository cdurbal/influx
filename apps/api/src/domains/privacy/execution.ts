// E-5 `privacy.execute_request` in the loop of the worker (docs/mvp/03 P7; 15 RG75 steps 6 and 7,
// RG76, RG79; 04 §9.2; runbook demandes-rgpd §4 to §6; 21 §J8 point 6; migration 0136). Nothing
// here decides: an admin approved the request under 2V + R from the account sheet
// (backoffice.approve_data_request_execution, 03 P7 "déclenché par une tâche"); this task runs it on
// the pool of influx_privacy_login, never on influx_worker_login. Between two turns of the drain,
// with the periodic tasks (worker.ts), each approved request goes through three steps, each its own
// short elevated transaction:
//   execute           access: the export produced by the database, with the notice of the account's
//                     language (notice.ts), the e-mail privacy.export_ready queued (P1, no link);
//                     erasure: the anonymisation of 04 §9.2 and of 21 §J8, account.deleted queued
//                     to Brevo and Apollo (P0)
//   delete_auth_user  erasure: the Supabase Auth user deleted by the administration API, AFTER the
//                     commit (never inside a transaction, 02 §18.4 G4), then recorded; a user
//                     already gone counts as deleted
//   complete          closed with an outcome (15 RG77) once Brevo confirmed (RG79): the contact
//                     deleted, or the export's e-mail sent with its messageId; until then, nothing
// A step that fails is tried again at the next tick, from the state the database holds. Register
// (03 §6.7, EC-52): one elevated.privacy.execute_request line on the request per transaction with an
// effect; none for the read of the pending work nor for a closing not yet possible. Log lines (D60):
// request ids, steps, types and codes, never an account, an address or a content.
import { randomUUID } from "node:crypto";
import {
  withElevatedTransaction,
  type ElevatedResult,
  type Transaction,
  type WorkerDatabase,
} from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import type { GoTrueUserDirectory } from "../../platform/supabase.ts";
import { exportNotice, noticeLocaleOf } from "./notice.ts";
import {
  completeRequest,
  executeRequest,
  pendingWork,
  recordAuthUserDeleted,
  type PendingWork,
} from "./repository.ts";

/** Requests looked at per tick; the others wait for the next one (a minute later). */
export const PENDING_WORK_LIMIT = 20;

export type PrivacyLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type PrivacyExecutor = {
  /** Never throws: a failure is logged, and the step runs again at the next tick. */
  tick(signal: AbortSignal): Promise<void>;
};

export type PrivacyExecutorDependencies = {
  /** A worker database WITH its privacy pool (PRIVACY_DATABASE_URL). */
  database: WorkerDatabase;
  /** GoTrue with the worker's own key; null: an erasure waits at its Auth user, never closed. */
  directory: Pick<GoTrueUserDirectory, "deleteUser"> | null;
  logger: PrivacyLogger;
};

export function createPrivacyExecutor(
  dependencies: PrivacyExecutorDependencies,
): PrivacyExecutor {
  const { database, directory, logger } = dependencies;

  function elevated<T>(
    body: (tx: Transaction) => Promise<ElevatedResult<T>>,
  ): Promise<T> {
    return withElevatedTransaction(
      database,
      "privacy.execute_request",
      randomUUID(),
      body,
    );
  }

  async function deleteAuthUser(
    requestId: string,
    authUserId: string,
  ): Promise<void> {
    if (directory === null) {
      logger.warn(
        { requestId, step: "delete_auth_user" },
        "privacy.auth_user_deletion_unavailable",
      );
      return;
    }
    const deleted = await directory.deleteUser(authUserId);
    if (!deleted.ok && deleted.status !== 404) {
      logger.warn(
        {
          requestId,
          step: "delete_auth_user",
          reason: deleted.reason,
          status: deleted.status,
        },
        "privacy.auth_user_deletion_failed",
      );
      return;
    }
    await elevated(async (tx) => {
      const recorded = await recordAuthUserDeleted(tx, requestId);
      return { value: recorded, auditSubject: recorded ? requestId : null };
    });
  }

  async function run(item: PendingWork): Promise<void> {
    switch (item.step) {
      case "execute": {
        const notice =
          item.requestType === "access"
            ? exportNotice(noticeLocaleOf(item.preferredLanguage))
            : null;
        const executed = await elevated(async (tx) => {
          const result = await executeRequest(tx, item.requestId, notice);
          return {
            value: result,
            auditSubject: result === null ? null : item.requestId,
          };
        });
        if (executed === null) {
          // Executed meanwhile, or by another instance: nothing written here.
          return;
        }
        logger.info(
          { requestId: item.requestId, requestType: executed.requestType },
          "privacy.request_executed",
        );
        if (
          executed.requestType === "erasure" &&
          executed.authUserId !== null
        ) {
          await deleteAuthUser(item.requestId, executed.authUserId);
        }
        return;
      }
      case "delete_auth_user":
        if (item.authUserId !== null) {
          await deleteAuthUser(item.requestId, item.authUserId);
        }
        return;
      case "complete": {
        const outcome = await elevated(async (tx) => {
          const closed = await completeRequest(tx, item.requestId);
          return {
            value: closed,
            auditSubject: closed === null ? null : item.requestId,
          };
        });
        if (outcome !== null) {
          logger.info(
            {
              requestId: item.requestId,
              requestType: item.requestType,
              outcome,
            },
            "privacy.request_closed",
          );
        }
        return;
      }
    }
  }

  return {
    async tick(signal) {
      let work: PendingWork[];
      try {
        work = await elevated(async (tx) => ({
          value: await pendingWork(tx, PENDING_WORK_LIMIT),
          auditSubject: null,
        }));
      } catch (error) {
        logger.error(
          { code: sqlStateOf(error) },
          "privacy.pending_work_failed",
        );
        return;
      }
      for (const item of work) {
        if (signal.aborted) {
          return;
        }
        try {
          await run(item);
        } catch (error) {
          logger.error(
            {
              requestId: item.requestId,
              step: item.step,
              requestType: item.requestType,
              code: sqlStateOf(error),
            },
            "privacy.step_failed",
          );
        }
      }
    },
  };
}
