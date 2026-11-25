// What the routes of queues 2 and 3 share (docs/mvp/07 RG94; 15 RG36, C2; jalons/l2g/modele.md §3, §6; l2g
// commit 11): the act in a savepoint whose refusal becomes the answer of the API, the guard of the
// account the caller HOLDS, the session of a backoffice request, and the entry to open next.
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../../identity/backoffice-session.ts";
import { CONFLICT_OF_INTEREST, conflictOfInterest } from "../action-guards.ts";
import {
  entryAccountOf,
  nextEntryId,
  type CreatorQueue,
} from "./lists/repository.ts";
import { creatorRefusalOf } from "./refusals.ts";

export type CreatorQueuesDependencies = { database: ApiDatabase };

export const PROFILES_CREATOR_ENTRIES =
  "/v1/bo/queues/profiles-creator/entries";
export const PORTFOLIO_MODERATION_ENTRIES =
  "/v1/bo/queues/portfolio-moderation/entries";

/** The acts of one of the two queues, bound to its database (the routes of both share them). */
export function actsOf(database: ApiDatabase, queue: CreatorQueue) {
  async function run<T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await tx.transaction(act);
    } catch (error) {
      throw await creatorRefusalOf(
        tx,
        queue,
        error,
        entryId,
        context.accountId,
      );
    }
  }

  /**
   * One act on an entry, in the transaction of the request. An unknown entry, a visual still uploading
   * and the one of the caller's own account (hidden by the database) answer 404. The act runs in a
   * savepoint: its refusal leaves the transaction readable, for the name of the holder or the notice of
   * a lifted claim.
   */
  async function treated<T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    if ((await entryAccountOf(tx, queue, entryId)) === null) {
      throw new ApiError("not_found");
    }
    return run(tx, context, entryId, act);
  }

  /**
   * As `treated`, for an act an account holder may not take (15 RG36): an entry of an account the caller
   * holds is refused, the attempt journaled in the transaction, which commits (`queue.conflict_of_interest`,
   * CA19, 0215); the route answers 403 `conflict_of_interest` afterwards (unlessConflict). Giving a claim
   * back and an administrator's forced release stay `treated`: he gets rid of a claim, never decides.
   */
  async function decided<T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T | typeof CONFLICT_OF_INTEREST> {
    const target = await entryAccountOf(tx, queue, entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    if (target.ownerAgentId === context.accountId) {
      return conflictOfInterest(tx);
    }
    return run(tx, context, entryId, act);
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
    const entryId = await nextEntryId(tx, queue, context.accountId);
    return entryId === null ? null : { entryId };
  }

  return { run, treated, decided, inSession, next };
}
