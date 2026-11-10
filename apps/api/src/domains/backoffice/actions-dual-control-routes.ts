// Dual control routes of the backoffice v0 (docs/mvp/15 §F, RG110; 03 §1.3 PD1 to PD7; 17b §3.11,
// §3.13.c). Backoffice surface; the aal2 guard of server.ts runs first. Admin only, an agent's attempt
// refused AND journaled (CA63, backoffice.action_refused):
// - POST /v1/bo/dual-control (request: role change, admin invitation, Apollo key, "mes données");
//   GET /v1/bo/dual-control (J8 commit 9): the pending requests; GET /v1/bo/dual-control/:id;
//   POST /v1/bo/dual-control/:id/confirm (B-5: the confirmation and the action in ONE transaction
//   with a fresh second factor, PD3); POST /v1/bo/dual-control/:id/cancel.
// - GET /v1/bo/dual-control/degraded (PD6, J8S-1): the confirmations made alone, week by week.
// Unknown, internal and own targets answer the same 404 (18 T14.3, T14.4). `Cache-Control:
// no-store` everywhere.
import {
  degradedReviewQuerySchema,
  degradedReviewResponseSchema,
  dualControlCancelResponseSchema,
  dualControlConfirmResponseSchema,
  dualControlConfirmSchema,
  dualControlListResponseSchema,
  DUAL_CONTROL_LIST_CAP,
  dualControlParamsSchema,
  dualControlRequestSchema,
  dualControlViewSchema,
  type DegradedReviewQuery,
  type DegradedReviewResponse,
  type DualControlConfirm,
  type DualControlConfirmResponse,
  type DualControlListResponse,
  type DualControlParams,
  type DualControlRequestBody,
  type DualControlViewBody,
} from "@influx/contracts/backoffice-actions";
import { sqlDetailOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  withSensitiveAction,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { databaseNow } from "./alerts/repository.ts";
import { pendingDualControlIds } from "./dual-control/repository.ts";
import {
  cancelDualControl,
  confirmAndExecute,
  degradedConfirmationsByWeek,
  holdsRevocationAccount,
  dualControlExecutor,
  dualControlView,
  requestDualControl,
  type DualControlView,
  type RequestableDualControlAction,
} from "./dual-control.ts";
import {
  adminOnly,
  conflictOfInterest,
  isForbidden,
  unlessConflict,
  unlessRefused,
  type BackofficeActionsDependencies,
} from "./action-guards.ts";

function actionOfRequest(
  body: DualControlRequestBody,
): RequestableDualControlAction {
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

type DualControlMemberTarget = Extract<
  NonNullable<DualControlViewBody["target"]>,
  { kind: "member_account" }
>;
type DualControlBadgeTarget = Extract<
  NonNullable<DualControlViewBody["target"]>,
  { kind: "badge" }
>;

function viewBody(view: DualControlView): DualControlViewBody {
  const { target } = view;
  return {
    id: view.id,
    action: view.action,
    recap: { ...view.recap, consequences: [...view.recap.consequences] },
    // the response schema checks the country code, the level and the state again
    target:
      target?.kind === "member_account"
        ? {
            ...target,
            countryCode:
              target.countryCode as DualControlMemberTarget["countryCode"],
          }
        : target?.kind === "badge"
          ? {
              ...target,
              countryCode:
                target.countryCode as DualControlBadgeTarget["countryCode"],
              badgeState:
                target.badgeState as DualControlBadgeTarget["badgeState"],
            }
          : target,
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

/**
 * 0231: a withdrawal whose badge no longer holds (the task or a grant ended it since the request) is a
 * 409 on `badge`; the confirmation is rolled back with it, the request stays as it was. Anything else,
 * unchanged (the deliberate 42501 of the database stays the 403 of runSensitiveAction).
 */
function confirmRefusalOf(error: unknown): unknown {
  return sqlStateOf(error) === "55000" &&
    sqlDetailOf(error) === "badge_not_holding"
    ? new ApiError("conflict", [{ path: "badge", issue: "badge_not_holding" }])
    : error;
}

export function registerDualControlRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

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

  // 17b §2.7 queue 15: the actions awaiting a second validation (admin), each with its PD7 view.
  app.get(
    "/v1/bo/dual-control",
    { schema: { response: { 200: dualControlListResponseSchema } } },
    async (request, reply): Promise<DualControlListResponse> => {
      void reply.header("cache-control", "no-store");
      const views = unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "backoffice.dual_control", async () => {
            const found: DualControlView[] = [];
            for (const id of await pendingDualControlIds(
              tx,
              DUAL_CONTROL_LIST_CAP,
            )) {
              const view = await dualControlView(tx, context, id);
              if (view !== null) {
                found.push(view);
              }
            }
            return found;
          }),
        ),
      );
      return { requests: views.map(viewBody) };
    },
  );

  // PD6 (J8S-1): the weekly review of the dashboard, the confirmations made alone.
  app.get(
    "/v1/bo/dual-control/degraded",
    {
      schema: {
        querystring: degradedReviewQuerySchema,
        response: { 200: degradedReviewResponseSchema },
      },
    },
    async (request, reply): Promise<DegradedReviewResponse> => {
      void reply.header("cache-control", "no-store");
      const { weeks } = request.query as DegradedReviewQuery;
      return unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "backoffice.dual_control", async () => ({
            weeks,
            evaluatedAt: await databaseNow(tx),
            review: await degradedConfirmationsByWeek(tx, weeks),
          })),
        ),
      );
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
      const confirmed = unlessConflict(
        unlessRefused(
          await withSensitiveAction(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "backoffice.dual_control", async () => {
              // 15 RG36: the withdrawal of a badge of an account the confirmer holds is refused, traced
              if (await holdsRevocationAccount(tx, context, requestId)) {
                return conflictOfInterest(tx);
              }
              try {
                return await confirmAndExecute(
                  tx,
                  context,
                  {
                    requestId,
                    degradedJustification: body.degradedJustification,
                  },
                  dualControlExecutor(),
                );
              } catch (error) {
                throw confirmRefusalOf(error);
              }
            }),
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
}
