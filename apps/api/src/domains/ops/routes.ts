// POST /v1/ops/client-errors (docs/mvp/02 §20.5, "Erreurs du navigateur"; 21 §4 J4 point 3).
// "A door, treated as such": a session of the calling surface is required (member on web,
// internal in aal2 on the backoffice), the body is a strict schema of packages/contracts with a
// small ceiling, every value is cleaned again by the recorder, and the rate is bounded per
// account, per address and per instance. Over a bound the report is dropped silently: the
// collector never retries, a 429 would teach it nothing.
import { systemStatusSchema } from "@influx/contracts/system";
import { clientErrorReportSchema } from "@influx/contracts/ops";
import type { ApiDatabase } from "../../db/index.ts";
import { clientAddressOf } from "../../platform/client-address.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import { withMemberSession } from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import type { OpsRecorder } from "./recorder.ts";

export const CLIENT_ERRORS_ROUTE = "/v1/ops/client-errors";
/** A report is a few kilobytes at most (message 500, stack 4000, page 200). */
const BODY_LIMIT_BYTES = 16_384;

/** Bounds per minute (02 §20.5): per account, per client address, and for the whole instance. */
export const CLIENT_ERROR_RATE = {
  account: 10,
  address: 30,
  instance: 300,
} as const;

/** Fixed one-minute windows, in memory: one instance at the MVP (EC, J4). */
export class MinuteCounter {
  private minute = -1;
  private readonly counts = new Map<string, number>();
  private readonly now: () => Date;

  constructor(now: () => Date) {
    this.now = now;
  }

  /** True when `key` is still under `limit` for the current minute (and counts it). */
  take(key: string, limit: number): boolean {
    const minute = Math.floor(this.now().getTime() / 60_000);
    if (minute !== this.minute) {
      this.minute = minute;
      this.counts.clear();
    }
    const count = this.counts.get(key) ?? 0;
    if (count >= limit) {
      return false;
    }
    this.counts.set(key, count + 1);
    return true;
  }
}

export type OpsRouteDependencies = {
  database: ApiDatabase;
  recorder: OpsRecorder;
  now: () => Date;
};

export function registerOpsRoutes(
  app: IdentityApp,
  dependencies: OpsRouteDependencies,
): void {
  const counter = new MinuteCounter(dependencies.now);
  app.post(
    CLIENT_ERRORS_ROUTE,
    {
      bodyLimit: BODY_LIMIT_BYTES,
      config: { surface: "shared" },
      schema: {
        body: clientErrorReportSchema,
        response: { 200: systemStatusSchema },
      },
    },
    async (request, reply) => {
      const accountId =
        request.surface === "backoffice"
          ? await withBackofficeSession(
              dependencies.database,
              request,
              reply,
              async (_tx, context) => context.accountId,
            )
          : await withMemberSession(
              dependencies.database,
              request,
              reply,
              dependencies.now,
              async (_tx, context) => context.accountId,
            );
      const address = clientAddressOf(request);
      const addressKey =
        address.status === "known" ? address.throttleKey : "unknown";
      const accepted =
        counter.take(`account:${accountId}`, CLIENT_ERROR_RATE.account) &&
        counter.take(`address:${addressKey}`, CLIENT_ERROR_RATE.address) &&
        counter.take("instance", CLIENT_ERROR_RATE.instance);
      if (accepted) {
        const report = request.body;
        dependencies.recorder.recordBrowserError({
          surface: request.surface === "backoffice" ? "backoffice" : "web",
          errorType: report.errorType,
          kind: report.kind,
          message: report.message,
          stack: report.stack,
          page: report.page,
          accountId,
          userAgentSummary: userAgentSummaryOf(request),
        });
      } else {
        request.log.info({}, "client error report over its rate, dropped");
      }
      return { status: "ok" as const };
    },
  );
}
