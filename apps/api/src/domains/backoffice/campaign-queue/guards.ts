// What the routes of queue 7 and of the campaign record share (docs/mvp/09 RG88; 15 RG36, C2; jalons/l3c/
// modele.md §1, §5, §6): the act in a savepoint whose refusal becomes the answer of the API, the guard of
// the account the caller HOLDS, the session of a backoffice request, and the entry to open next.
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../../identity/backoffice-session.ts";
import { CONFLICT_OF_INTEREST, conflictOfInterest } from "../action-guards.ts";
import {
  campaignEntryTargetOf,
  campaignTargetOf,
  nextCampaignEntryId,
} from "./lists/repository.ts";
import { campaignRefusalOf, type RefusalScope } from "./refusals.ts";

export type CampaignQueueDependencies = { database: ApiDatabase };

export const CAMPAIGN_ENTRIES = "/v1/bo/campaigns/entries";
export const CAMPAIGNS = "/v1/bo/campaigns";

/** The acts of queue 7 and of the campaign record, bound to the database (the routes of both share them). */
export function campaignActsOf(database: ApiDatabase) {
  async function run<T>(
    tx: Transaction,
    context: BackofficeContext,
    scope: RefusalScope,
    entryId: string | null,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await tx.transaction(act);
    } catch (error) {
      throw await campaignRefusalOf(
        tx,
        error,
        scope,
        entryId,
        context.accountId,
      );
    }
  }

  /**
   * One act on an entry, in the transaction of the request. An unknown entry, the one of the caller's own
   * account answer 404 (D84: an entry whose second opinion he asked is no longer hidden from him). The act
   * runs in a savepoint: its refusal leaves the transaction readable, for the name of the holder or the
   * notice of a lifted claim.
   */
  async function treated<T>(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    if ((await campaignEntryTargetOf(tx, entryId)) === null) {
      throw new ApiError("not_found");
    }
    return run(tx, context, "entry", entryId, act);
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
    const target = await campaignEntryTargetOf(tx, entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    if (target.ownerAgentId === context.accountId) {
      return conflictOfInterest(tx);
    }
    return run(tx, context, "entry", entryId, act);
  }

  /**
   * An act on the record of a campaign. An unknown campaign and the one of the caller's own account
   * answer 404. `heldRefused`: the act is one an account holder may not take (the correction of a pending
   * campaign, modele §6), refused 403 and journaled; the passages of an agent admit a held account
   * (modele §5).
   */
  async function onCampaign<T>(
    tx: Transaction,
    context: BackofficeContext,
    campaignId: string,
    heldRefused: (status: string) => boolean,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T | typeof CONFLICT_OF_INTEREST> {
    const target = await campaignTargetOf(tx, campaignId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    if (
      target.ownerAgentId === context.accountId &&
      heldRefused(target.status)
    ) {
      return conflictOfInterest(tx);
    }
    return run(tx, context, "campaign", null, act);
  }

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  /**
   * 17b §2.6: the entry to open after a decision, or null. `except` is the entry the caller has just given
   * back by asking a second opinion (D84): it is free again and readable by him, it is never the next one.
   */
  async function next(
    tx: Transaction,
    context: BackofficeContext,
    except: string | null = null,
  ): Promise<{ entryId: string } | null> {
    const entryId = await nextCampaignEntryId(tx, context.accountId, except);
    return entryId === null ? null : { entryId };
  }

  return { run, treated, decided, onCampaign, inSession, next };
}
