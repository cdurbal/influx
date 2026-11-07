// What the routes of queue 4 share (docs/mvp/08 RG53, RG61; 15 RG36; jalons/l2e/modele.md §6; l2e commit
// 14): the two views and their path segments, the target of an act in its view, the savepoint in which a
// door of the database is called, and the guard of the account the caller holds.
import type { VerificationQueueView } from "@influx/contracts/verification";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import type { BackofficeContext } from "../../identity/backoffice-session.ts";
import { CONFLICT_OF_INTEREST, conflictOfInterest } from "../action-guards.ts";
import { agentRefusalOf } from "./refusals.ts";
import {
  POPULATION_OF,
  requestTargetOf,
  type RequestTarget,
} from "./repository.ts";

export type VerificationQueuesDependencies = {
  database: ApiDatabase;
  /** Storage, for the pieces of an entry (verification-queues-decision-routes.ts). */
  store: ObjectStore;
};

/** The path segment of each view (modele §6). */
export const VIEW_SEGMENT: Readonly<Record<VerificationQueueView, string>> = {
  creators: "verification-creators",
  brands: "verification-brands",
};

export const VIEWS: readonly VerificationQueueView[] = ["creators", "brands"];

/**
 * The target of an act, in the view the route belongs to: an unknown request, a draft, the caller's own
 * account and a request of the other view are one and the same answer (404, T14.3, T14.4).
 */
export async function targetOf(
  tx: Transaction,
  requestId: string,
  view: VerificationQueueView,
): Promise<RequestTarget> {
  const target = await requestTargetOf(tx, requestId);
  if (target === null || target.population !== POPULATION_OF[view]) {
    throw new ApiError("not_found");
  }
  return target;
}

/**
 * One act on a request, in a savepoint of the request's transaction: its refusal leaves the transaction
 * readable, for the name of a holder or the notice of a lifted claim, and becomes the answer of the API.
 */
export async function inSavepoint<T>(
  tx: Transaction,
  requestId: string,
  caller: string,
  act: (savepoint: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await tx.transaction(act);
  } catch (error) {
    throw await agentRefusalOf(tx, error, requestId, caller);
  }
}

/** 08 RG53, 15 RG36 (0215): the caller HOLDS the account: refused, journaled, answered 403 after the commit. */
export async function unlessHeld(
  tx: Transaction,
  context: BackofficeContext,
  target: RequestTarget,
): Promise<typeof CONFLICT_OF_INTEREST | null> {
  return target.ownerAgentId === context.accountId
    ? conflictOfInterest(tx, context)
    : null;
}
