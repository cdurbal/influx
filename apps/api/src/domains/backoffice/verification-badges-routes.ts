// Routes of the badges of a member account and of the request of their withdrawal (docs/mvp/08 RG73
// to RG76, CA49 to CA51; 06 RG55; 03 §3.2, PD1 to PD7; 15 RG36, RG110; 18 T14; jalons/l2f/modele.md
// §3 "0231", §5; l2f commit 13). Backoffice surface; the aal2 guard of server.ts runs first, then each
// handler reads and writes through withBackofficeSession() (agent and admin alike).
//   GET  /v1/bo/accounts/:id/badges                         the block « Badges » of the account's page:
//                                                           every badge, whatever its state, and the
//                                                           reasons a withdrawal may give
//   POST /v1/bo/accounts/:id/badges/:badgeId/revocation     asks for the withdrawal of a badge: opens
//                                                           the 2V; an administrator other than the
//                                                           asker confirms it at /double-validation/[id]
//                                                           (or the degraded form, 03 PD7)
// The withdrawal itself is never a route of this file: it is the confirmation of the 2V
// (actions-dual-control-routes.ts), which consumes the request once. This file only asks.
// - A badge never carries a figure, a handle, an agent or a network account identifier; the reasons
//   carry the sentence the member receives (what the agent reads is what is sent).
// - The message to the member is the agent's own text for the reasons that ask for it (`terms_breach`):
//   a direct contact (link, address, number) is refused (RG19), as in a refusal of queue 4.
// - An unknown account, an internal one, the caller's own, a badge that is not that account's: the same
//   404 (T14.3, T14.4). An account the caller HOLDS answers 403 `conflict_of_interest` after the trace
//   of the attempt (backoffice.action_refused, `queue.conflict_of_interest`) is committed (15 RG36).
// - Every answer is `Cache-Control: no-store`. Nothing typed by an agent is logged here.
import {
  accountBadgesResponseSchema,
  accountBadgeParamsSchema,
  requestBadgeRevocationBodySchema,
  requestBadgeRevocationResponseSchema,
  type AccountBadgesResponse,
  type AccountBadgeParams,
  type RequestBadgeRevocationBody,
  type RequestBadgeRevocationResponse,
} from "@influx/contracts/verification";
import { accountActionParamsSchema } from "@influx/contracts/backoffice-actions";
import type { AccountActionParams } from "@influx/contracts/backoffice-actions";
import { REVOCATION_REASONS } from "@influx/domain/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { revocationReasonText } from "../verification/badge-notice-email.ts";
import { conflictOfInterest, unlessConflict } from "./action-guards.ts";
import { databaseNow } from "./alerts/repository.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";
import { revocationRefusalOf } from "./verification-queues/refusals.ts";
import {
  badgeTargetOf,
  isMemberAccount,
  readAccountBadges,
  requestBadgeRevocation,
  type AccountBadgeRow,
} from "./verification-badges/repository.ts";

export type VerificationBadgesRoutesDependencies = { database: ApiDatabase };

/** The reasons of a withdrawal, in the order of the table, each with the sentence the member receives. */
function reasonsOf(): AccountBadgesResponse["reasons"] {
  return REVOCATION_REASONS.map((reason, index) => ({
    code: reason.code,
    position: index + 1,
    levels: [...reason.levels],
    requiresMemberMessage: reason.requiresMemberMessage,
    escalatesToAdmin: reason.escalatesToAdmin,
    // the backoffice speaks French (D36): the sentence the member receives in his own language is
    // written by the worker (badge-notice-email.ts), from the same file
    message: revocationReasonText(reason.code, "fr"),
  }));
}

/** A badge as the block shows it; the schema checks the database's values again. */
function badgeOf(
  row: AccountBadgeRow,
): AccountBadgesResponse["badges"][number] {
  return {
    id: row.id,
    level: row.level as AccountBadgesResponse["badges"][number]["level"],
    networkCode: row.networkCode,
    state: row.state as AccountBadgesResponse["badges"][number]["state"],
    grantedAt: row.grantedAt,
    expiresAt: row.expiresAt,
    endedAt: row.endedAt,
    revokedAt: row.revokedAt,
    revocationReasonCode:
      row.revocationReasonCode as AccountBadgesResponse["badges"][number]["revocationReasonCode"],
    pendingRevocation:
      row.pendingRevocationId === null || row.pendingRevocationState === null
        ? null
        : {
            dualControlRequestId: row.pendingRevocationId,
            state: row.pendingRevocationState as NonNullable<
              AccountBadgesResponse["badges"][number]["pendingRevocation"]
            >["state"],
          },
    dispute:
      row.disputeId === null || row.disputeState === null
        ? null
        : {
            id: row.disputeId,
            state: row.disputeState as NonNullable<
              AccountBadgesResponse["badges"][number]["dispute"]
            >["state"],
          },
  };
}

export function registerVerificationBadgesRoutes(
  app: IdentityApp,
  dependencies: VerificationBadgesRoutesDependencies,
): void {
  const { database } = dependencies;

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  app.get(
    "/v1/bo/accounts/:id/badges",
    {
      schema: {
        params: accountActionParamsSchema,
        response: { 200: accountBadgesResponseSchema },
      },
    },
    async (request, reply): Promise<AccountBadgesResponse> => {
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      return inSession(request, reply, async (tx) => {
        if (!(await isMemberAccount(tx, accountId))) {
          throw new ApiError("not_found");
        }
        const badges = await readAccountBadges(tx, accountId);
        return accountBadgesResponseSchema.parse({
          asOf: await databaseNow(tx),
          badges: badges.map(badgeOf),
          reasons: reasonsOf(),
        });
      });
    },
  );

  app.post(
    "/v1/bo/accounts/:id/badges/:badgeId/revocation",
    {
      schema: {
        params: accountBadgeParamsSchema,
        body: requestBadgeRevocationBodySchema,
        response: { 200: requestBadgeRevocationResponseSchema },
      },
    },
    async (request, reply): Promise<RequestBadgeRevocationResponse> => {
      const params = request.params as AccountBadgeParams;
      const accountId = params.id.toLowerCase();
      const badgeId = params.badgeId.toLowerCase();
      const body = request.body as RequestBadgeRevocationBody;
      // RG19: the message goes to the member in an e-mail without any link; a direct contact is refused
      if (
        body.memberMessage !== undefined &&
        memberMessageSignals(body.memberMessage).length > 0
      ) {
        throw new RequestValidationError([
          { path: "memberMessage", issue: "direct_contact" },
        ]);
      }
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          if (!(await isMemberAccount(tx, accountId))) {
            throw new ApiError("not_found");
          }
          const target = await badgeTargetOf(tx, accountId, badgeId);
          if (target === null) {
            throw new ApiError("not_found");
          }
          // 15 RG36 (0215): an account the caller holds is not his to withdraw a badge from
          if (target.ownerAgentId === context.accountId) {
            return conflictOfInterest(tx);
          }
          try {
            // a savepoint: the refusal of the door leaves the transaction readable
            const dualControlRequestId = await tx.transaction((savepoint) =>
              requestBadgeRevocation(
                savepoint,
                badgeId,
                body.reasonCode,
                body.memberMessage ?? null,
              ),
            );
            return { dualControlRequestId };
          } catch (error) {
            throw revocationRefusalOf(error);
          }
        }),
      );
    },
  );
}
