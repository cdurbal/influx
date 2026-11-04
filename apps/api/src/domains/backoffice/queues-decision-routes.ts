// Decision routes of queue 1, "profils marque à valider" (docs/mvp/06 RG6, RG9, RG19, RG65, RG66, RG69;
// 15 RG27 C2 to C4, C6 to C8, RG36, RG110, CA63; 17b §2.4, §2.6; jalons/l2c/file.md A3, A6, A8, A9, A10,
// D81; l2c-fiche invariants 1 to 4, 7, 11, 13; 18 T14). Backoffice surface; the aal2 guard of server.ts
// runs first, then each handler reads and writes through withBackofficeSession() (agent and admin).
// - POST /v1/bo/queues/profiles-advertiser/entries/:id/publish: the human decision that publishes
//   (RG6), bound to the version the agent examined (`reviewToken`, L2BS-1).
// - POST …/reject: the refusal with a typed reason; `memberMessage` for `other` only (RG66), a direct
//   contact in it refused here (RG19) as the e-mail of the brand holds no link (RG158).
// - POST …/release, …/extend: the holder gives the entry back, or takes the delay again (A9).
// - POST …/force-release: an administrator lifts a live claim with a typed reason (C4). An agent who
//   tries is refused 403 and the attempt is journaled (backoffice.action_refused, CA63) by the same
//   pattern as the other admin actions; the holder is told at his next opening or action (A8).
// The rules are the database's (0210): the functions lock the entry, check claim, token and required
// fields, and write the decision, the register and the leads events in ONE transaction. This file
// maps their refusals to codes, and never a trace (invariant 13):
//   42501 (unknown entry, own account, role)  -> 404, the same answer as an unknown entry (T14.3, T14.4)
//   55P03 (no live claim)  -> 409 `claim` / `held_by_other` and the holder's name (C2), or
//                             `claim_not_held`, or `claim_lifted` (A8)
//   55000 (`entry_closed`, `stale_token`, `profile_state`)  -> 409 on the path `entry`
//   23514 (a required field is missing)  -> 409, the path is the field, issue `required_field_missing`
//   22023 (`reason`, `member_message`, `internal_comment`)  -> 400 on the body field
// - RG36 (15, 13 RG35): the database does not refuse the caller who HOLDS the account (11): a
//   decision or an extension on such an entry answers 403 with the issue `conflict_of_interest`, as
//   the opening does. Giving a claim back stays open to him (he gets rid of it, never decides).
// - A decision answers with the entry to open next (17b §2.6), never opened for the caller here.
// - Every answer is `Cache-Control: no-store`.
import {
  entryParamsSchema,
  extendEntryResponseSchema,
  forceReleaseRequestSchema,
  forceReleaseResponseSchema,
  publishEntryRequestSchema,
  publishEntryResponseSchema,
  rejectEntryRequestSchema,
  rejectEntryResponseSchema,
  releaseEntryResponseSchema,
  type DECISION_CONFLICT_ISSUES,
  type EntryParams,
  type ExtendEntryResponse,
  type ForceReleaseRequest,
  type ForceReleaseResponse,
  type PublishEntryRequest,
  type PublishEntryResponse,
  type RejectEntryRequest,
  type RejectEntryResponse,
  type ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { adminOnly, isForbidden, unlessRefused } from "./action-guards.ts";
import {
  displayNameOf,
  extendClaim,
  forceRelease,
  nextEntryId,
  publishEntry,
  rejectEntry,
  releaseEntry,
  wasDispossessed,
} from "./queues/decisions/repository.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";
import { entryAccountOf } from "./queues/repository.ts";

type ConflictIssue = (typeof DECISION_CONFLICT_ISSUES)[number];

const ENTRIES = "/v1/bo/queues/profiles-advertiser/entries";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The code of a required field of 0203: snake_case, a code never a value (06 RG15). */
const FIELD_CODE_PATTERN = /^[a-z][a-z_]{0,62}$/;

function conflict(issues: readonly ValidationIssue[]): ApiError {
  return new ApiError("conflict", issues);
}

function entryConflict(issue: ConflictIssue): ApiError {
  return conflict([{ path: "entry", issue }]);
}

/** The refusal of a database function, as the code of the API (see the header); else unchanged. */
async function refusalOf(
  tx: Transaction,
  error: unknown,
  entryId: string,
  caller: string,
): Promise<unknown> {
  if (isForbidden(error)) {
    return new ApiError("not_found");
  }
  const detail = sqlDetailOf(error);
  switch (sqlStateOf(error)) {
    case "55P03": {
      if (detail !== null && UUID_PATTERN.test(detail)) {
        // C2: somebody else holds it, and the answer says who
        const name = await displayNameOf(tx, detail);
        return conflict([
          { path: "claim", issue: "held_by_other" satisfies ConflictIssue },
          ...(name === null ? [] : [{ path: "claim.holder", issue: name }]),
        ]);
      }
      // no live claim: expired, given back, never taken, or lifted by an administrator (A8)
      const lifted = await wasDispossessed(tx, entryId, caller);
      return conflict([
        {
          path: "claim",
          issue: (lifted
            ? "claim_lifted"
            : "claim_not_held") satisfies ConflictIssue,
        },
      ]);
    }
    case "55000":
      return detail === "entry_closed" ||
        detail === "stale_token" ||
        detail === "profile_state"
        ? entryConflict(detail)
        : error;
    case "23514":
      return detail !== null && FIELD_CODE_PATTERN.test(detail)
        ? conflict([
            {
              path: detail,
              issue: "required_field_missing" satisfies ConflictIssue,
            },
          ])
        : error;
    case "22023":
      switch (detail) {
        case "reason":
          return new RequestValidationError([
            { path: "reasonCode", issue: "invalid_reason" },
          ]);
        case "member_message":
          return new RequestValidationError([
            { path: "memberMessage", issue: "invalid_member_message" },
          ]);
        case "internal_comment":
          return new RequestValidationError([
            { path: "internalComment", issue: "invalid_internal_comment" },
          ]);
        default:
          return error;
      }
    default:
      return error;
  }
}

export type BackofficeQueueDecisionDependencies = { database: ApiDatabase };

export function registerBackofficeQueueDecisionRoutes(
  app: IdentityApp,
  dependencies: BackofficeQueueDecisionDependencies,
): void {
  const { database } = dependencies;

  /**
   * One act on an entry, in the transaction of the request. An unknown entry, and the one of the
   * caller's own account (hidden by the database), answer 404; with `conflictChecked`, an entry of
   * an account the caller holds answers 403 (RG36). The act runs in a savepoint: its refusal leaves
   * the transaction readable, for the name of the holder or the notice of a lifted claim.
   */
  async function treated<T>(
    request: FastifyRequest,
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    conflictChecked: boolean,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    const target = await entryAccountOf(tx, entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    if (conflictChecked && target.ownerAgentId === context.accountId) {
      // No line of the register without a migration: the identifiers only, to the process log (D60)
      request.log.warn(
        { queue: "profiles_advertiser", entryId },
        "queue.conflict_of_interest_refused",
      );
      throw new ApiError("forbidden", [
        { path: "entry", issue: "conflict_of_interest" },
      ]);
    }
    try {
      return await tx.transaction(act);
    } catch (error) {
      throw await refusalOf(tx, error, entryId, context.accountId);
    }
  }

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  /** 17b §2.6: the entry to open after a decision, or null. */
  async function next(
    tx: Transaction,
    context: BackofficeContext,
  ): Promise<{ entryId: string } | null> {
    const entryId = await nextEntryId(tx, context.accountId);
    return entryId === null ? null : { entryId };
  }

  app.post(
    `${ENTRIES}/:id/publish`,
    {
      schema: {
        params: entryParamsSchema,
        body: publishEntryRequestSchema,
        response: { 200: publishEntryResponseSchema },
      },
    },
    async (request, reply): Promise<PublishEntryResponse> => {
      const entryId = (request.params as EntryParams).id.toLowerCase();
      const body = request.body as PublishEntryRequest;
      return inSession(request, reply, async (tx, context) => {
        const decided = await treated(
          request,
          tx,
          context,
          entryId,
          true,
          (savepoint) =>
            publishEntry(
              savepoint,
              entryId,
              body.reviewToken,
              body.internalComment ?? null,
            ),
        );
        return { ...decided, next: await next(tx, context) };
      });
    },
  );

  app.post(
    `${ENTRIES}/:id/reject`,
    {
      schema: {
        params: entryParamsSchema,
        body: rejectEntryRequestSchema,
        response: { 200: rejectEntryResponseSchema },
      },
    },
    async (request, reply): Promise<RejectEntryResponse> => {
      const entryId = (request.params as EntryParams).id.toLowerCase();
      const body = request.body as RejectEntryRequest;
      // RG19: the message goes to the brand in an e-mail without any link; a direct contact is refused
      if (
        body.memberMessage !== undefined &&
        memberMessageSignals(body.memberMessage).length > 0
      ) {
        throw new RequestValidationError([
          { path: "memberMessage", issue: "direct_contact" },
        ]);
      }
      return inSession(request, reply, async (tx, context) => {
        const decided = await treated(
          request,
          tx,
          context,
          entryId,
          true,
          (savepoint) =>
            rejectEntry(
              savepoint,
              entryId,
              body.reviewToken,
              body.reasonCode,
              body.memberMessage ?? null,
              body.internalComment ?? null,
            ),
        );
        return { ...decided, next: await next(tx, context) };
      });
    },
  );

  app.post(
    `${ENTRIES}/:id/release`,
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: releaseEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ReleaseEntryResponse> => {
      const entryId = (request.params as EntryParams).id.toLowerCase();
      return inSession(request, reply, async (tx, context) => {
        await treated(request, tx, context, entryId, false, (savepoint) =>
          releaseEntry(savepoint, entryId),
        );
        return { released: true };
      });
    },
  );

  app.post(
    `${ENTRIES}/:id/extend`,
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: extendEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ExtendEntryResponse> => {
      const entryId = (request.params as EntryParams).id.toLowerCase();
      return inSession(request, reply, async (tx, context) => ({
        claimExpiresAt: await treated(
          request,
          tx,
          context,
          entryId,
          true,
          (savepoint) => extendClaim(savepoint, entryId),
        ),
      }));
    },
  );

  app.post(
    `${ENTRIES}/:id/force-release`,
    {
      schema: {
        params: entryParamsSchema,
        body: forceReleaseRequestSchema,
        response: { 200: forceReleaseResponseSchema },
      },
    },
    async (request, reply): Promise<ForceReleaseResponse> => {
      const entryId = (request.params as EntryParams).id.toLowerCase();
      const body = request.body as ForceReleaseRequest;
      // CA63: an agent's attempt is refused and journaled in a transaction that commits; the 403
      // is answered after. The masking of the button on the screen is never the control.
      return unlessRefused(
        await inSession(request, reply, (tx, context) =>
          adminOnly(
            tx,
            context,
            "queue.force_release_claim",
            async (): Promise<ForceReleaseResponse> => {
              const holder = await treated(
                request,
                tx,
                context,
                entryId,
                false,
                (savepoint) =>
                  forceRelease(savepoint, entryId, body.reasonCode),
              );
              return {
                released: true,
                holder:
                  holder === null
                    ? null
                    : {
                        accountId: holder,
                        displayName: await displayNameOf(tx, holder),
                      },
              };
            },
          ),
        ),
      );
    },
  );
}
