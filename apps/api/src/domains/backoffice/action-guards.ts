// Guards shared by the backoffice action routes (docs/mvp/15 RG110, CA63; 18 T14.3, T14.4). Kept in
// their own file so that the route files of each sub-domain import them without a cycle.
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import {
  recordRefusedAction,
  type RefusedActionCode,
} from "./sync-replay/repository.ts";

export type BackofficeActionsDependencies = { database: ApiDatabase };

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

/** The answer of an act on an entry of an account the caller holds, after the COMMIT of its trace. */
export const CONFLICT_OF_INTEREST = Symbol("conflict_of_interest");

/**
 * 15 RG36, CA19, RG110 (0215): an act of an internal on an entry of an account he holds is refused
 * by the server (and by the database) and journaled in the transaction, which commits: the route
 * answers 403 `conflict_of_interest` afterwards (unlessConflict). The trace is an agent's
 * (record_refused_action is influx_agent's only, EC-L2C-fix-2-2): an admin who holds the account is
 * refused all the same.
 */
export async function conflictOfInterest(
  tx: Transaction,
  context: BackofficeContext,
): Promise<typeof CONFLICT_OF_INTEREST> {
  if (context.role === "agent") {
    await recordRefusedAction(tx, "queue.conflict_of_interest");
  }
  return CONFLICT_OF_INTEREST;
}

export function unlessConflict<T>(value: T | typeof CONFLICT_OF_INTEREST): T {
  if (value === CONFLICT_OF_INTEREST) {
    throw new ApiError("forbidden", [
      { path: "entry", issue: "conflict_of_interest" },
    ]);
  }
  return value;
}
