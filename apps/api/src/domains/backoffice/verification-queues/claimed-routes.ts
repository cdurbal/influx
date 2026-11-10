// What the routes of queues 5 (the contests) and 6 (the identifiers changed) share (docs/mvp/15 RG27 C1 to
// C4, C6, C8, RG29, RG36; 08 RG53, RG77, RG78; jalons/l2f/modele.md §5; 18 T14; l2f commit 14): the session
// of the backoffice, the guard of an account the caller holds (journaled BEFORE the act), the savepoint in
// which a door of the database is called, the entry to open next, and the three acts that do not depend on
// the queue: give the claim back, take the delay again, lift a claim (an administrator). Backoffice surface:
// the aal2 guard of server.ts runs first, then each handler reads and writes through withBackofficeSession()
// (agent and admin alike). Every answer is `Cache-Control: no-store`; nothing typed by anybody is logged.
//   POST …/entries/:id/{release, extend, force-release}
// - An unknown entry, the one of the caller's own account and, in the database's words, any 42501, answer
//   exactly alike (404, T14.3, T14.4); an act on an entry of an account the caller HOLDS answers 403
//   `conflict_of_interest` after the trace of the attempt (backoffice.action_refused,
//   `queue.conflict_of_interest`) is committed (15 RG36, 0215); giving a claim back stays open to him (he
//   gets rid of it, never decides), as the forced release of an administrator.
import {
  extendEntryResponseSchema,
  forceReleaseRequestSchema,
  forceReleaseResponseSchema,
  releaseEntryResponseSchema,
  type ExtendEntryResponse,
  type ForceReleaseRequest,
  type ForceReleaseResponse,
  type ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import {
  verificationEntryParamsSchema,
  type VerificationEntryParams,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../../identity/backoffice-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import {
  adminOnly,
  CONFLICT_OF_INTEREST,
  conflictOfInterest,
  isForbidden,
  unlessConflict,
  unlessRefused,
} from "../action-guards.ts";
import { displayNameOf } from "./repository.ts";
import {
  claimedTargetOf,
  extendClaimedEntry,
  forceReleaseClaimedEntry,
  nextClaimedEntryId,
  releaseClaimedEntry,
  wasDispossessedOfEntry,
  type ClaimedQueueKind,
  type ClaimedTarget,
} from "./claimed/repository.ts";
import { agentRefusalOf } from "./refusals.ts";

export type ClaimedQueueRoutes = {
  /** The path of the queue's entries: `/v1/bo/queues/<segment>/entries`. */
  entries: string;
  idOf: (request: FastifyRequest) => string;
  inSession: <T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ) => Promise<T>;
  /** The target of an act in this queue: an unknown entry and the caller's own account answer 404. */
  targetOf: (tx: Transaction, entryId: string) => Promise<ClaimedTarget>;
  /**
   * An act no holder of the account may take (RG53): the entry exists, is not his to treat; its refusals
   * become the answer of the API.
   */
  decided: <T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ) => Promise<T | typeof CONFLICT_OF_INTEREST>;
  /** One act in a savepoint: its refusal leaves the transaction readable and becomes the API's answer. */
  inSavepoint: <T>(
    tx: Transaction,
    entryId: string,
    caller: string,
    act: (savepoint: Transaction) => Promise<T>,
  ) => Promise<T>;
  /** The holder of the account of an OPEN entry: journaled before the act (RG36). */
  unlessHeld: (
    tx: Transaction,
    context: BackofficeContext,
    target: ClaimedTarget,
  ) => Promise<typeof CONFLICT_OF_INTEREST | null>;
  /** 17b §2.6: the entry to open after a decision, or null. */
  next: (
    tx: Transaction,
    context: BackofficeContext,
  ) => Promise<{ entryId: string } | null>;
};

/**
 * The plumbing of one queue and its three common acts, registered once. `segment` is the queue's path
 * segment (`verification-disputes`, `identifier-changes`, modele §5).
 */
export function registerClaimedQueueRoutes(
  app: IdentityApp,
  database: ApiDatabase,
  kind: ClaimedQueueKind,
  segment: string,
): ClaimedQueueRoutes {
  const entries = `/v1/bo/queues/${segment}/entries`;

  const idOf = (request: FastifyRequest): string =>
    (request.params as VerificationEntryParams).id.toLowerCase();

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  async function targetOf(
    tx: Transaction,
    entryId: string,
  ): Promise<ClaimedTarget> {
    const target = await claimedTargetOf(tx, kind, entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    return target;
  }

  async function inSavepoint<T>(
    tx: Transaction,
    entryId: string,
    caller: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await tx.transaction(act);
    } catch (error) {
      throw await agentRefusalOf(
        tx,
        error,
        entryId,
        caller,
        (inner, id, account) =>
          wasDispossessedOfEntry(inner, kind, id, account),
      );
    }
  }

  async function unlessHeld(
    tx: Transaction,
    context: BackofficeContext,
    target: ClaimedTarget,
  ): Promise<typeof CONFLICT_OF_INTEREST | null> {
    return target.ownerAgentId === context.accountId
      ? conflictOfInterest(tx)
      : null;
  }

  async function decided<T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T | typeof CONFLICT_OF_INTEREST> {
    const target = await targetOf(tx, entryId);
    const held = await unlessHeld(tx, context, target);
    if (held !== null) return held;
    return inSavepoint(tx, entryId, context.accountId, act);
  }

  async function next(
    tx: Transaction,
    context: BackofficeContext,
  ): Promise<{ entryId: string } | null> {
    const entryId = await nextClaimedEntryId(tx, context.accountId, kind);
    return entryId === null ? null : { entryId };
  }

  app.post(
    `${entries}/:id/release`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        response: { 200: releaseEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ReleaseEntryResponse> => {
      const entryId = idOf(request);
      return inSession(request, reply, async (tx, context) => {
        await targetOf(tx, entryId);
        await inSavepoint(tx, entryId, context.accountId, (savepoint) =>
          releaseClaimedEntry(savepoint, kind, entryId),
        );
        return { released: true };
      });
    },
  );

  app.post(
    `${entries}/:id/extend`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        response: { 200: extendEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ExtendEntryResponse> => {
      const entryId = idOf(request);
      const claimExpiresAt = unlessConflict(
        await inSession(request, reply, (tx, context) =>
          decided(tx, context, entryId, (savepoint) =>
            extendClaimedEntry(savepoint, kind, entryId),
          ),
        ),
      );
      return { claimExpiresAt };
    },
  );

  app.post(
    `${entries}/:id/force-release`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        body: forceReleaseRequestSchema,
        response: { 200: forceReleaseResponseSchema },
      },
    },
    async (request, reply): Promise<ForceReleaseResponse> => {
      const entryId = idOf(request);
      const body = request.body as ForceReleaseRequest;
      // CA63: an agent's attempt is refused and journaled in a transaction that commits; the 403 is
      // answered after. The masking of the button on the screen is never the control.
      return unlessRefused(
        await inSession(request, reply, (tx, context) =>
          adminOnly(
            tx,
            context,
            "queue.force_release_claim",
            async (): Promise<ForceReleaseResponse> => {
              await targetOf(tx, entryId);
              const holder = await inSavepoint(
                tx,
                entryId,
                context.accountId,
                (savepoint) =>
                  forceReleaseClaimedEntry(
                    savepoint,
                    kind,
                    entryId,
                    body.reasonCode,
                  ),
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

  return {
    entries,
    idOf,
    inSession,
    targetOf,
    decided,
    inSavepoint,
    unlessHeld,
    next,
  };
}

/** A 42501 of a door that is the answer of an unknown address (T14.3, T14.4). */
export function unknownOnForbidden(error: unknown): unknown {
  return isForbidden(error) ? new ApiError("not_found") : error;
}
