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
