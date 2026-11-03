// Alerts route of the backoffice v0 (docs/mvp/05 §K RG104, CA62; 15 RG101, RG145; 17b §3.11).
// Backoffice surface; the aal2 guard of server.ts runs first.
// - GET /v1/bo/alerts (RG104, CA62): the state alerts AL24 to AL27, for their recipients, and for
//   the admins the "new browser" sign-ins of B-7 (RG145, 0138) and the `admin` roles granted
//   (J8S-4, RG101, 0142). `Cache-Control: no-store`.
import {
  ADMIN_ROLE_GRANT_ALERT_DAYS,
  alertsResponseSchema,
  NEW_BROWSER_ALERT_DAYS,
  type Alert,
  type AlertsResponse,
} from "@influx/contracts/backoffice-actions";
import type { Transaction } from "../../db/index.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  alertDefinitions,
  databaseNow,
  configurationFailures,
  destinationHealth,
  failuresPastDelay,
  lastBrevoReconciliation,
  newBrowserSignIns,
  queueDelays,
  queuePolicy,
} from "./alerts/repository.ts";
import { adminRoleGrants } from "./dual-control/repository.ts";
import {
  businessCutoff,
  businessHoursOf,
  delayAlerts,
  configurationAlerts,
  destinationAlerts,
  failureAlerts,
  reconciliationAlerts,
  thresholdCodes,
  thresholdNumber,
} from "./alerts.ts";
import type { BackofficeActionsDependencies } from "./action-guards.ts";

/** RG79 objectives and RG104 starting values, used when a threshold does not read (0130). */
const AL25_IMMEDIATE = ["brevo.unauthorized", "apollo.unauthorized"];
const AL25_QUOTA = ["brevo.rate_limited", "apollo.rate_limited"];

async function evaluateAlerts(
  tx: Transaction,
  context: BackofficeContext,
): Promise<AlertsResponse> {
  const now = await databaseNow(tx);
  const isAdmin = context.role === "admin";
  const definitions = new Map(
    (await alertDefinitions(tx, ["AL24", "AL25", "AL26", "AL27"])).map(
      (definition) => [definition.code, definition],
    ),
  );
  const visible = (code: string): boolean => {
    const recipients = definitions.get(code)?.recipients ?? [];
    return isAdmin
      ? recipients.includes("admin")
      : recipients.includes("agent") || recipients.includes("owner_agent");
  };
  const alerts: Alert[] = [];

  if (visible("AL24")) {
    const policy = await queuePolicy(tx, "lead_sync_failures");
    if (policy !== null) {
      const cutoff = businessCutoff(
        new Date(now),
        policy.targetDecisionMinutes,
        businessHoursOf(policy.businessHours),
      );
      alerts.push(
        ...failureAlerts(
          await failuresPastDelay(
            tx,
            cutoff.toISOString(),
            isAdmin ? null : context.accountId,
          ),
        ),
      );
    }
  }
  if (visible("AL25")) {
    const threshold = definitions.get("AL25")?.threshold;
    alerts.push(
      ...destinationAlerts(
        await destinationHealth(tx, {
          windowMinutes: thresholdNumber(threshold, "down_after_minutes", 15),
          immediateCodes: thresholdCodes(
            threshold,
            "immediate_error_codes",
            AL25_IMMEDIATE,
          ),
          quotaCodes: thresholdCodes(
            threshold,
            "quota_error_codes",
            AL25_QUOTA,
          ),
        }),
      ),
    );
  }
  if (visible("AL25")) {
    alerts.push(...configurationAlerts(await configurationFailures(tx)));
  }
  if (visible("AL26")) {
    const threshold = definitions.get("AL26")?.threshold;
    alerts.push(
      ...delayAlerts(
        await queueDelays(tx, {
          brevo_contact: thresholdNumber(
            threshold,
            "brevo_contact_max_minutes",
            60,
          ),
          apollo_contact: thresholdNumber(
            threshold,
            "apollo_contact_max_minutes",
            1440,
          ),
        }),
        thresholdNumber(threshold, "min_share_bp", 9900),
      ),
    );
  }
  if (visible("AL27")) {
    alerts.push(
      ...reconciliationAlerts(
        await lastBrevoReconciliation(tx),
        thresholdNumber(
          definitions.get("AL27")?.threshold,
          "max_unsubscribe_gap",
          0,
        ),
      ),
    );
  }
  // B-7 (05 RG145): the "new browser" sign-ins of the team, for the admins only.
  const signIns = isAdmin
    ? await newBrowserSignIns(tx, NEW_BROWSER_ALERT_DAYS)
    : [];
  // J8S-4 (15 RG101): the `admin` role granted, for the admins only (0142 refuses anyone else).
  const grants = isAdmin
    ? await adminRoleGrants(tx, ADMIN_ROLE_GRANT_ALERT_DAYS)
    : [];
  return {
    evaluatedAt: now,
    alerts,
    newBrowserSignIns: signIns,
    adminRoleGrants: grants,
  };
}

export function registerAlertRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.get(
    "/v1/bo/alerts",
    { schema: { response: { 200: alertsResponseSchema } } },
    async (request, reply): Promise<AlertsResponse> => {
      void reply.header("cache-control", "no-store");
      return withBackofficeSession(database, request, reply, (tx, context) =>
        evaluateAlerts(tx, context),
      );
    },
  );
}
