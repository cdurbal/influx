// The sending of a technical alert (15 RG165, 02 §20.5): DIRECTLY to Brevo by the transactional
// sender of the process (the api for AL50, the worker with its own key for the others), NEVER
// through leads.outbox_events (an alert "base unreachable" or "worker stopped" cannot depend on what
// is down). One recipient per call (16 RG91), all at once, each bounded by the sender (3 s, its
// circuit). Never throws. A log line carries the code, the kind and counts: never an address, a
// subject, nor a body (D60, C-1).
import { createHash } from "node:crypto";
import type {
  SendOutcome,
  TransactionalSender,
} from "../../platform/brevo-transactional.ts";
import {
  renderTechnicalAlertEmail,
  type TechnicalAlertEmailInput,
} from "./technical-alert-email.ts";

export type AlertDeliveryLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
};

export type AlertDeliveryDependencies = {
  sender: TransactionalSender;
  logger: AlertDeliveryLogger;
};

/**
 * The Idempotency-Key of one e-mail to one recipient (02 §18.10 step 7): the alert, its opening,
 * its kind and number, the recipient; hashed, so that the key carries no address.
 */
export function technicalAlertIdempotencyKey(
  input: Pick<
    TechnicalAlertEmailInput,
    "code" | "kind" | "sequence" | "openedAt"
  >,
  subjectKey: string,
  recipient: string,
): string {
  const digest = createHash("sha256")
    .update(
      [
        input.code,
        subjectKey,
        input.openedAt.toISOString(),
        input.kind,
        String(input.sequence),
        recipient,
      ].join("\u0000"),
    )
    .digest("hex")
    .slice(0, 32);
  return `internal.technical_alert:${input.code}:${digest}`;
}

const FAILURE_OF: Readonly<Record<"undeliverable" | "unavailable", string>> = {
  undeliverable: "undeliverable_address",
  unavailable: "provider_unavailable",
};

/**
 * Sends the e-mail of an alert to each recipient. True when at least one accepted it: the caller
 * keeps the alert as notified; false, it sends it again at the next round.
 */
export async function deliverTechnicalAlert(
  dependencies: AlertDeliveryDependencies,
  input: TechnicalAlertEmailInput,
  subjectKey: string,
  recipients: readonly string[],
): Promise<boolean> {
  if (recipients.length === 0) {
    dependencies.logger.warn(
      { code: input.code, kind: input.kind },
      "ops.alert.no_recipient",
    );
    return false;
  }
  let email: ReturnType<typeof renderTechnicalAlertEmail>;
  try {
    email = renderTechnicalAlertEmail(input);
  } catch {
    dependencies.logger.warn(
      { code: input.code, kind: input.kind },
      "ops.alert.render_failed",
    );
    return false;
  }
  const settled = await Promise.allSettled(
    recipients.map((to) =>
      dependencies.sender.send({
        template: "internal.technical_alert",
        to,
        idempotencyKey: technicalAlertIdempotencyKey(input, subjectKey, to),
        ...email,
      }),
    ),
  );
  const outcomes = settled.map((result): SendOutcome =>
    result.status === "fulfilled" ? result.value : { status: "unavailable" },
  );
  const accepted = outcomes.filter(
    (outcome) => outcome.status === "sent",
  ).length;
  const failureCodes: Record<string, number> = {};
  for (const outcome of outcomes) {
    if (outcome.status !== "sent") {
      const code = FAILURE_OF[outcome.status];
      failureCodes[code] = (failureCodes[code] ?? 0) + 1;
    }
  }
  const line = {
    code: input.code,
    kind: input.kind,
    recipients: recipients.length,
    accepted,
    ...(accepted < recipients.length ? { failureCodes } : {}),
  };
  if (accepted === 0) {
    dependencies.logger.warn(line, "ops.alert.delivery_failed");
  } else {
    dependencies.logger.info(line, "ops.alert.sent");
  }
  return accepted > 0;
}
