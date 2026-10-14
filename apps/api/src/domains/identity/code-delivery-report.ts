// POST /v1/support/code-not-received, the rescue channel without sign-in (docs/mvp/05 RG65, CA26;
// 18 T15; J7 decision 6; 03 P7 E-1 support.report_delivery_issue). "Je ne reçois pas mon code":
// one report in backoffice.code_delivery_reports (0120), which feeds a backoffice queue (Lot 5).
//
//   1  The counters of the channel (0115: never those of the sign-in code), in ONE elevated
//      transaction with the write: per network (an unknown address shares one global key, EC-21)
//      then per sign-in address. Over the network's ceiling: 429. Over the address's: the same
//      answer as a report, nothing written (a third party cannot flood one person's queue, and the
//      answer still says nothing).
//   2  The report, written as typed: the addresses are never looked up, nothing is sent from here.
//
// It NEVER gives a code, NEVER opens a session, NEVER sends an e-mail, NEVER puts two members in
// touch (RG65). The route answers the same whatever the addresses, after the same floor
// (routes.ts). Nothing here logs an address nor the message (D60, C-1).
import type { CodeNotReceivedBody } from "@influx/contracts/support";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import type { ClientAddress } from "../../platform/client-address.ts";
import { recordCodeDeliveryReport, reserveAuthAttempt } from "./repository.ts";
import {
  DELIVERY_REPORTS_PER_EMAIL_HOUR,
  DELIVERY_REPORTS_PER_IP_HOUR,
  DELIVERY_REPORTS_UNKNOWN_IP_HOUR,
} from "./settings.ts";
import {
  addressThrottleKey,
  emailThrottleKey,
  globalThrottleKey,
} from "./throttle-keys.ts";

export type CodeDeliveryReportDependencies = {
  database: ApiDatabase;
  /** AUTH_THROTTLE_PEPPER. */
  pepper: string;
};

export type CodeDeliveryReportRequest = {
  requestId: string;
  body: CodeNotReceivedBody;
  clientAddress: ClientAddress;
  logger: { warn(object: object, message: string): void };
};

/** `rate_limited`: over the ceiling of the network only (the route answers 429). */
export type CodeDeliveryReportOutcome = "received" | "rate_limited";

export async function reportCodeNotReceived(
  dependencies: CodeDeliveryReportDependencies,
  request: CodeDeliveryReportRequest,
): Promise<CodeDeliveryReportOutcome> {
  const { pepper } = dependencies;
  const { body, clientAddress } = request;
  const outcome = await withElevatedTransaction(
    dependencies.database,
    "support.report_delivery_issue",
    request.requestId,
    async (tx) => {
      const networkAllowed =
        clientAddress.status === "known"
          ? await reserveAuthAttempt(
              tx,
              "delivery_report_ip",
              addressThrottleKey(clientAddress),
              "1h",
              DELIVERY_REPORTS_PER_IP_HOUR,
            )
          : await reserveAuthAttempt(
              tx,
              "delivery_report_unknown_ip",
              globalThrottleKey(pepper, "delivery_report_unknown_ip"),
              "1h",
              DELIVERY_REPORTS_UNKNOWN_IP_HOUR,
            );
      if (!networkAllowed) {
        return { value: "network" as const, auditSubject: null };
      }
      const addressAllowed = await reserveAuthAttempt(
        tx,
        "delivery_report_email",
        emailThrottleKey(pepper, body.loginEmail),
        "1h",
        DELIVERY_REPORTS_PER_EMAIL_HOUR,
      );
      if (!addressAllowed) {
        return { value: "address" as const, auditSubject: null };
      }
      const reportId = await recordCodeDeliveryReport(tx, {
        loginEmail: body.loginEmail,
        contactEmail: body.contactEmail,
        message: body.message ?? null,
        locale: body.locale,
      });
      // EC-36: the register line elevated.support.report_delivery_issue names the report.
      return { value: "recorded" as const, auditSubject: reportId };
    },
  );
  if (outcome === "recorded") {
    return "received";
  }
  // 18 T15.5: the overflow is logged, by its scope only (no address: D60).
  request.logger.warn(
    { scope: outcome },
    "support.report_delivery_issue: rate limited",
  );
  return outcome === "network" ? "rate_limited" : "received";
}
