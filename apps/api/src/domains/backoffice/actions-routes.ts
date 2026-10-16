// Action routes of the backoffice v0 (docs/mvp/05 §K RG81, RG93, RG101 to RG104, RG108, CA58 to
// CA63; 15 §F, RG110; 03 §1.3 PD1 to PD7, §3.1; 17b §3.11, §3.13.c; 21 §J8 commit 6). Backoffice
// surface; the aal2 guard of server.ts runs first. The rules are the database's (0132, 0134): these
// handlers choose the transaction, read the refusal and say it.
// - POST /v1/bo/leads/replays: unit or batch replay of failed contact lines, selected by (account,
//   destination), never by an internal line id; 200 pairs and 200 lines at most, the surplus
//   refused and reported (CA59); one winner per line (CA61); a pair without consent is refused,
//   never replayed (RG103, CA60, EC-J8-4); no nominative lock (15 RG30). Agent and admin.
// - POST /v1/bo/accounts/:id/corrections (RG108): status, country, language. Agent and admin.
// - Admin only, an agent's attempt refused AND journaled (CA63, backoffice.action_refused):
//   GET /v1/bo/settings/apollo; POST /v1/bo/dual-control (request: role change, Apollo key);
//   GET /v1/bo/dual-control/:id; POST /v1/bo/dual-control/:id/confirm (B-5: the confirmation and
//   the action in ONE transaction with a fresh second factor, PD3); POST /v1/bo/dual-control/:id/
//   cancel; POST /v1/bo/accounts/:id/brevo-suppression/lift (RG93, B-5).
// - GET /v1/bo/alerts (RG104, CA62): the state alerts AL24 to AL27, for their recipients.
// Unknown, internal and own targets answer the same 404 (18 T14.3, T14.4). `Cache-Control:
// no-store` everywhere.
import {
  accountActionParamsSchema,
  alertsResponseSchema,
  apolloSettingsResponseSchema,
  correctionRequestSchema,
  correctionResponseSchema,
  dualControlCancelResponseSchema,
  dualControlConfirmResponseSchema,
  dualControlConfirmSchema,
  dualControlParamsSchema,
  dualControlRequestSchema,
  dualControlViewSchema,
  REPLAY_BATCH_CAP,
  replayRequestSchema,
  replayResponseSchema,
  suppressionLiftRequestSchema,
  suppressionLiftResponseSchema,
  type AccountActionParams,
  type Alert,
  type AlertsResponse,
  type ApolloSettingsResponse,
  type CorrectionRequest,
  type CorrectionResponse,
  type DualControlConfirm,
  type DualControlConfirmResponse,
  type DualControlParams,
  type DualControlRequestBody,
  type DualControlViewBody,
  type ReplayOutcome,
  type ReplayRequest,
  type ReplayResponse,
  type SuppressionLiftRequest,
  type SuppressionLiftResponse,
} from "@influx/contracts/backoffice-actions";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  withSensitiveAction,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  alertDefinitions,
  correctMemberAccount,
  databaseNow,
  destinationHealth,
  failuresPastDelay,
  lastBrevoReconciliation,
  liftBrevoSuppression,
  queueDelays,
  queuePolicy,
  readApolloSettings,
  recordRefusedAction,
  replayCandidates,
  replayOutboxLines,
  type ContactDestination,
  type RefusedActionCode,
  type ReplayCandidate,
} from "./repository.ts";
import { apolloSettingOf } from "./apollo-settings.ts";
import {
  businessCutoff,
  businessHoursOf,
  delayAlerts,
  destinationAlerts,
  failureAlerts,
  reconciliationAlerts,
  thresholdCodes,
  thresholdNumber,
} from "./alerts.ts";
import {
  cancelDualControl,
  confirmAndExecute,
  dualControlExecutor,
  dualControlView,
  requestDualControl,
  type DualControlAction,
  type DualControlView,
} from "./dual-control.ts";

export type BackofficeActionsDependencies = { database: ApiDatabase };

const CONTACT_DESTINATION: Readonly<
  Record<"brevo" | "apollo", ContactDestination>
> = { brevo: "brevo_contact", apollo: "apollo_contact" };

/** The deliberate refusal of the database functions (0130 to 0134): 42501 `forbidden`. */
export function isForbidden(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const { code, message } = current as Error & { code?: unknown };
    if (code === "42501") {
      return message === "forbidden";
    }
    current = current.cause;
  }
  return false;
}

/** The answer of a refused agent, given after the COMMIT of the trace of his attempt (CA63). */
export const REFUSED = Symbol("refused");

/**
 * CA63, 15 RG110: an action reserved to admin, attempted by an agent, is refused by the server and
 * the attempt journaled (backoffice.action_refused) in the transaction, which commits; the route
 * answers 403 afterwards. The masking of the screen is never the control.
 */
export async function adminOnly<T>(
  tx: Transaction,
  context: BackofficeContext,
  actionCode: RefusedActionCode,
  fn: () => Promise<T>,
): Promise<T | typeof REFUSED> {
  if (context.role !== "admin") {
    await recordRefusedAction(tx, actionCode);
    return REFUSED;
  }
  return fn();
}

export function unlessRefused<T>(value: T | typeof REFUSED): T {
  if (value === REFUSED) {
    throw new ApiError("forbidden");
  }
  return value;
}

// ---------------------------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------------------------

/** The outcome of a pair submitted to the database, from the outcomes of its lines (0132). */
function submittedOutcome(
  lines: readonly { outcome: string; detail: string | null }[],
): { outcome: ReplayOutcome; requeued: number } {
  const requeued = lines.filter((line) => line.outcome === "requeued").length;
  if (requeued > 0) {
    return { outcome: "requeued", requeued };
  }
  if (lines.some((line) => line.detail === "already_queued")) {
    return { outcome: "already_in_progress", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "already_succeeded")) {
    return { outcome: "already_synced", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "no_consent")) {
    return { outcome: "no_consent", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "normal_case")) {
    return { outcome: "normal_case", requeued: 0 };
  }
  return { outcome: "nothing_to_replay", requeued: 0 };
}

/** The outcome of a pair without a failed line, from its state (RG100, RG103, CA61). */
function idleOutcome(candidate: ReplayCandidate | undefined): ReplayOutcome {
  if (candidate === undefined) {
    return "nothing_to_replay";
  }
  if (candidate.live) {
    return "already_in_progress";
  }
  if (candidate.lastStatus === "succeeded") {
    return "already_synced";
  }
  if (candidate.lastStatus === "skipped") {
    return candidate.lastCode === "no_consent" ? "no_consent" : "normal_case";
  }
  return "nothing_to_replay";
}

const IGNORED: ReadonlySet<ReplayOutcome> = new Set([
  "already_in_progress",
  "already_synced",
]);

async function replay(
  tx: Transaction,
  body: ReplayRequest,
): Promise<ReplayResponse> {
  // the same pair twice is one pair
  const seen = new Set<string>();
  const pairs = body.items
    .map((item) => ({
      accountId: item.accountId.toLowerCase(),
      destination: item.destination,
    }))
    .filter((pair) => {
      const key = `${pair.accountId}|${pair.destination}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  const within = pairs.slice(0, REPLAY_BATCH_CAP);
  const candidates = new Map(
    (
      await replayCandidates(
        tx,
        within.map((pair) => ({
          accountId: pair.accountId,
          destination: CONTACT_DESTINATION[pair.destination],
        })),
      )
    ).map((candidate) => [
      `${candidate.accountId}|${candidate.destination}`,
      candidate,
    ]),
  );

  // CA59: 200 lines at most per operation; the pairs beyond are refused, and said
  const submitted = new Map<string, number[]>();
  let lineCount = 0;
  const overCap = new Set<string>();
  for (const pair of pairs.slice(REPLAY_BATCH_CAP)) {
    overCap.add(`${pair.accountId}|${pair.destination}`);
  }
  for (const pair of within) {
    const key = `${pair.accountId}|${pair.destination}`;
    const candidate = candidates.get(
      `${pair.accountId}|${CONTACT_DESTINATION[pair.destination]}`,
    );
    const ids = candidate?.failedIds ?? [];
    if (ids.length === 0) {
      continue;
    }
    if (lineCount + ids.length > REPLAY_BATCH_CAP) {
      overCap.add(key);
      continue;
    }
    lineCount += ids.length;
    submitted.set(key, ids);
  }

  const allIds = [...submitted.values()].flat();
  const lines =
    allIds.length === 0
      ? []
      : await replayOutboxLines(tx, allIds, body.reasonCode);
  const byId = new Map(lines.map((line) => [line.outboxId, line]));

  const items = pairs.map((pair) => {
    const key = `${pair.accountId}|${pair.destination}`;
    if (overCap.has(key)) {
      return { ...pair, outcome: "over_cap" as const, lines: 0 };
    }
    const ids = submitted.get(key);
    if (ids === undefined) {
      const candidate = candidates.get(
        `${pair.accountId}|${CONTACT_DESTINATION[pair.destination]}`,
      );
      return { ...pair, outcome: idleOutcome(candidate), lines: 0 };
    }
    const { outcome, requeued } = submittedOutcome(
      ids.flatMap((id) => {
        const line = byId.get(id);
        return line === undefined ? [] : [line];
      }),
    );
    return { ...pair, outcome, lines: requeued };
  });

  const requeued = items.filter((item) => item.outcome === "requeued").length;
  const ignored = items.filter((item) => IGNORED.has(item.outcome)).length;
  return {
    replayId: lines[0]?.replayId ?? null,
    requested: pairs.length,
    requeued,
    ignored,
    refused: pairs.length - requeued - ignored,
    items,
  };
}

// ---------------------------------------------------------------------------------------------
// Dual control
// ---------------------------------------------------------------------------------------------

function actionOfRequest(body: DualControlRequestBody): DualControlAction {
  switch (body.code) {
    case "identity.change_member_role":
      return {
        code: body.code,
        accountId: body.accountId.toLowerCase(),
        role: "advertiser",
        legalName: body.legalName,
      };
    case "identity.invite_admin":
      return { code: body.code, invitationId: body.invitationId.toLowerCase() };
    case "leads.change_apollo_setting":
      return { code: body.code, setting: body.setting };
    case "privacy.approve_data_request":
      return {
        code: body.code,
        requestId: body.requestId.toLowerCase(),
        requestType: body.requestType,
      };
  }
}

function viewBody(view: DualControlView): DualControlViewBody {
  return {
    id: view.id,
    action: view.action,
    recap: { ...view.recap, consequences: [...view.recap.consequences] },
    reasonCode: view.reasonCode,
    reasonNote: view.reasonNote,
    requestedBy: view.requestedBy,
    requestedAt: view.requestedAt,
    expiresAt: view.expiresAt,
    state: view.state,
    confirmation: view.confirmation,
    executed: view.executed,
    next: view.next,
  };
}

// ---------------------------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------------------------

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
  return { evaluatedAt: now, alerts };
}

// ---------------------------------------------------------------------------------------------

export function registerBackofficeActionRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.post(
    "/v1/bo/leads/replays",
    {
      schema: {
        body: replayRequestSchema,
        response: { 200: replayResponseSchema },
      },
    },
    async (request, reply): Promise<ReplayResponse> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as ReplayRequest;
      return withBackofficeSession(database, request, reply, (tx) =>
        replay(tx, body),
      );
    },
  );

  app.post(
    "/v1/bo/accounts/:id/corrections",
    {
      schema: {
        params: accountActionParamsSchema,
        body: correctionRequestSchema,
        response: { 200: correctionResponseSchema },
      },
    },
    async (request, reply): Promise<CorrectionResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      const body = request.body as CorrectionRequest;
      try {
        const changed = await withBackofficeSession(
          database,
          request,
          reply,
          (tx) =>
            correctMemberAccount(tx, accountId, {
              reasonCode: body.reasonCode,
              declaredStatus: body.declaredStatus ?? null,
              countryCode: body.countryCode ?? null,
              preferredLanguage: body.preferredLanguage ?? null,
              comment: body.comment ?? null,
            }),
        );
        return { changed };
      } catch (error) {
        if (isForbidden(error)) {
          // unknown, internal, own or inactive: the same answer (T14.3, T14.4)
          throw new ApiError("not_found");
        }
        switch (sqlStateOf(error)) {
          case "23514":
            // a blocked country (RG8), an individual advertiser (RG22)
            throw new ApiError("conflict");
          case "23503":
            throw new RequestValidationError([
              { path: "", issue: "unknown_reference" },
            ]);
          default:
            throw error;
        }
      }
    },
  );

  app.get(
    "/v1/bo/settings/apollo",
    { schema: { response: { 200: apolloSettingsResponseSchema } } },
    async (request, reply): Promise<ApolloSettingsResponse> => {
      void reply.header("cache-control", "no-store");
      const rows = unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "leads.read_apollo_settings", () =>
            readApolloSettings(tx),
          ),
        ),
      );
      return {
        settings: rows.flatMap((row) => {
          const setting = apolloSettingOf(row.key, row.value);
          return setting === null
            ? []
            : [
                {
                  setting,
                  updatedAt: row.updatedAt,
                  updatedBy: row.updatedBy,
                },
              ];
        }),
      };
    },
  );

  app.post(
    "/v1/bo/dual-control",
    {
      schema: {
        body: dualControlRequestSchema,
        response: { 200: dualControlViewSchema },
      },
    },
    async (request, reply): Promise<DualControlViewBody> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as DualControlRequestBody;
      try {
        const view = unlessRefused(
          await withBackofficeSession(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "backoffice.dual_control", async () => {
              const id = await requestDualControl(tx, {
                action: actionOfRequest(body),
                reasonCode: body.reasonCode,
                reasonNote: body.reasonNote ?? null,
              });
              return dualControlView(tx, context, id);
            }),
          ),
        );
        if (view === null) {
          throw new Error("a request just written could not be read back");
        }
        return viewBody(view);
      } catch (error) {
        if (isForbidden(error)) {
          // a role change: own account, unknown, internal or inactive target (T14.3, T14.4); an
          // admin invitation: unknown, not admin, used, revoked, expired or already confirmed; a
          // "mes données" request: unknown, of another type, closed, already approved, or of an
          // account no longer active (0136); an Apollo key: a value the database refuses (a
          // country it does not know)
          if (
            body.code === "identity.change_member_role" ||
            body.code === "identity.invite_admin" ||
            body.code === "privacy.approve_data_request"
          ) {
            throw new ApiError("not_found");
          }
          throw new RequestValidationError([
            { path: "setting.value", issue: "refused_value" },
          ]);
        }
        throw error;
      }
    },
  );

  app.get(
    "/v1/bo/dual-control/:id",
    {
      schema: {
        params: dualControlParamsSchema,
        response: { 200: dualControlViewSchema },
      },
    },
    async (request, reply): Promise<DualControlViewBody> => {
      void reply.header("cache-control", "no-store");
      const requestId = (request.params as DualControlParams).id.toLowerCase();
      const view = unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "backoffice.dual_control", () =>
            dualControlView(tx, context, requestId),
          ),
        ),
      );
      if (view === null) {
        throw new ApiError("not_found");
      }
      return viewBody(view);
    },
  );

  app.post(
    "/v1/bo/dual-control/:id/confirm",
    {
      schema: {
        params: dualControlParamsSchema,
        body: dualControlConfirmSchema,
        response: { 200: dualControlConfirmResponseSchema },
      },
    },
    async (request, reply): Promise<DualControlConfirmResponse> => {
      void reply.header("cache-control", "no-store");
      const requestId = (request.params as DualControlParams).id.toLowerCase();
      const body = request.body as DualControlConfirm;
      const confirmed = unlessRefused(
        await withSensitiveAction(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "backoffice.dual_control", () =>
            confirmAndExecute(
              tx,
              context,
              {
                requestId,
                degradedJustification: body.degradedJustification,
              },
              dualControlExecutor(),
            ),
          ),
        ),
      );
      return { mode: confirmed.mode, reevaluated: confirmed.result };
    },
  );

  app.post(
    "/v1/bo/dual-control/:id/cancel",
    {
      schema: {
        params: dualControlParamsSchema,
        response: { 200: dualControlCancelResponseSchema },
      },
    },
    async (request, reply): Promise<{ cancelled: true }> => {
      void reply.header("cache-control", "no-store");
      const requestId = (request.params as DualControlParams).id.toLowerCase();
      try {
        unlessRefused(
          await withBackofficeSession(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "backoffice.dual_control", () =>
              cancelDualControl(tx, context, requestId),
            ),
          ),
        );
      } catch (error) {
        if (isForbidden(error)) {
          throw new ApiError("forbidden");
        }
        throw error;
      }
      return { cancelled: true };
    },
  );

  app.post(
    "/v1/bo/accounts/:id/brevo-suppression/lift",
    {
      schema: {
        params: accountActionParamsSchema,
        body: suppressionLiftRequestSchema,
        response: { 200: suppressionLiftResponseSchema },
      },
    },
    async (request, reply): Promise<SuppressionLiftResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      const body = request.body as SuppressionLiftRequest;
      try {
        const resyncQueued = unlessRefused(
          await withSensitiveAction(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "leads.lift_brevo_suppression", () =>
              liftBrevoSuppression(tx, context.sessionId, accountId, {
                reasonCode: body.reasonCode,
                comment: body.comment ?? null,
              }),
            ),
          ),
        );
        return { resyncQueued };
      } catch (error) {
        if (sqlStateOf(error) === "55000") {
          // RG93: nothing recorded to lift
          throw new ApiError("conflict");
        }
        throw error;
      }
    },
  );

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
