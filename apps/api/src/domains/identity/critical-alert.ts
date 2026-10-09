// EC-44 (docs/mvp/21 §3; 16 §H, RG86; J6 start decision 1): the e-mail internal.critical_alert
// on agent.break_glass_login (MFA-10) and agent.recovery_code_consumed (MFA-4). P0, on the
// synchronous path of apps/api, NEVER through leads.outbox_events (D43).
//
// Called AFTER the transaction that wrote the audit line has committed (G4):
//   1  one transaction (E-2) reads the recipients (active admin accounts, the break-glass account
//      excluded) and writes one `queued` P0 line per recipient and per alert;
//   2  one attempt per line, all at once (Promise.allSettled), Brevo bounded to 3 s; the
//      Idempotency-Key is the audit seq and the recipient's account (16 §H);
//   3  one transaction writes the outcomes.
// Nothing here ever changes the sign-in answer: any failure leaves the audit line, the `error`
// line of the sign-in, a `failed` journal line and `security.critical_alert_failed` with its
// failure code only. No address, no IP, no name, no code in a log line (D60, C-1).
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import type {
  SendOutcome,
  TransactionalSender,
} from "../../platform/brevo-transactional.ts";
import {
  renderCriticalAlertEmail,
  type CriticalAlertEvent,
} from "./critical-alert-email.ts";
import {
  closeP0Send,
  criticalAlertRecipients,
  insertCriticalAlertSend,
  type P0SendFailure,
} from "./repository.ts";

/** Version of the fixed template, COPIED on the journal line (04 R7). */
export const CRITICAL_ALERT_TEMPLATE_VERSION = 1;

/** One alert: the audit line that raised it. */
export type CriticalAlert = {
  eventType: CriticalAlertEvent;
  /** seq of the audit line (0011, 0114). */
  auditSeq: string;
  recoveryCodesLeft: number | null;
};

export type CriticalAlertDependencies = {
  database: ApiDatabase;
  sender: TransactionalSender;
};

export type CriticalAlertRequest = {
  requestId: string;
  logger: { error(object: object, message: string): void };
};

const FAILURE_OF: Readonly<
  Record<"undeliverable" | "unavailable", P0SendFailure>
> = {
  undeliverable: "undeliverable_address",
  unavailable: "provider_unavailable",
};

type PreparedSend = {
  alert: CriticalAlert;
  recipient: { accountId: string; email: string };
  reference: string;
};

/**
 * Sends the alerts of a sign-in. `subjectAccountId` is the account that signed in (the subject
 * of the audit lines). Never throws.
 */
export async function sendCriticalAlerts(
  dependencies: CriticalAlertDependencies,
  request: CriticalAlertRequest,
  subjectAccountId: string,
  alerts: readonly CriticalAlert[],
): Promise<void> {
  if (alerts.length === 0) {
    return;
  }
  const occurredAt = new Date();
  let prepared: PreparedSend[];
  try {
    prepared = await withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_sign_in",
      request.requestId,
      async (tx) => {
        const recipients = await criticalAlertRecipients(tx);
        const lines: PreparedSend[] = [];
        for (const alert of alerts) {
          for (const recipient of recipients) {
            lines.push({
              alert,
              recipient,
              reference: await insertCriticalAlertSend(
                tx,
                recipient.accountId,
                CRITICAL_ALERT_TEMPLATE_VERSION,
              ),
            });
          }
        }
        return {
          value: lines,
          auditSubject: lines.length === 0 ? null : subjectAccountId,
        };
      },
    );
  } catch {
    // The journal could not be written: nothing is sent (a P0 line is written before its call).
    request.logger.error(
      { failureCode: "journal_unavailable" },
      "security.critical_alert_failed",
    );
    return;
  }
  if (prepared.length === 0) {
    request.logger.error({}, "security.critical_alert_no_recipient");
    return;
  }

  const settled = await Promise.allSettled(
    prepared.map((line) =>
      dependencies.sender.send({
        template: "internal.critical_alert",
        to: line.recipient.email,
        idempotencyKey: `internal.critical_alert:${line.alert.auditSeq}:${line.recipient.accountId}`,
        ...renderCriticalAlertEmail({
          eventType: line.alert.eventType,
          occurredAt,
          auditReference: line.alert.auditSeq,
          recoveryCodesLeft: line.alert.recoveryCodesLeft,
        }),
      }),
    ),
  );
  const outcomes = settled.map(
    (result): SendOutcome =>
      result.status === "fulfilled" ? result.value : { status: "unavailable" },
  );
  for (const outcome of outcomes) {
    if (outcome.status !== "sent") {
      request.logger.error(
        { failureCode: FAILURE_OF[outcome.status] },
        "security.critical_alert_failed",
      );
    }
  }

  try {
    await withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_sign_in",
      request.requestId,
      async (tx) => {
        for (const [index, line] of prepared.entries()) {
          const outcome = outcomes[index] ?? { status: "unavailable" };
          await closeP0Send(
            tx,
            line.reference,
            outcome.status === "sent"
              ? { status: "sent", messageId: outcome.messageId }
              : { status: "failed", failureCode: FAILURE_OF[outcome.status] },
          );
        }
        // EC-52 (3): an outcome alone writes no audit line.
        return { value: undefined, auditSubject: null };
      },
    );
  } catch {
    // The lines stay `queued`: an attempt engaged, outcome unknown (0015), never retried.
    request.logger.error(
      { failureCode: "journal_unavailable" },
      "security.critical_alert_failed",
    );
  }
}
