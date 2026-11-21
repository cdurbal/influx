// The refusals of the doors of queue 9 (0330), as the API answers them (docs/mvp/15 C2, RG36; 17b I13;
// jalons/l3g/modele.md §5, "Refusals"; l3g-fiche invariants 11, 14; 18 T14). The database says each refusal by
// its SQLSTATE, its MESSAGE and its DETAIL; this file reads them and never a value:
//   42501 `forbidden` (an unknown request, an open one of a brand the caller holds, a role) -> 404, the same
//         answer as an address that does not exist (T14.3, T14.4)
//   55P03 (no live claim) -> 409 `claim` / `held_by_other` and the holder's name when the DETAIL is the
//         account of the live holder (C2), else `claim_not_held`: expired, given back or never taken
//   55000 `entry_closed` -> 409 on the path `entry`; any other 55000 is a setting the queue needs and the
//         base does not hold (claim_expiry_minutes): 503, nothing the caller can mend
//   22023 `reason` or `note` -> 400 on `reasonCode` or `note`
// Anything else is returned unchanged (a 500, whose log carries no value).
import type { Transaction } from "../../../db/index.ts";
import { sqlDetailOf, sqlStateOf } from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import { isForbidden } from "../action-guards.ts";
import { displayNameOf } from "../queues/decisions/repository.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The refusal of a door of the database as the code of the API (see the header); else unchanged. */
export async function teamSelectionRefusalOf(
  tx: Transaction,
  error: unknown,
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
        return new ApiError("conflict", [
          { path: "claim", issue: "held_by_other" },
          ...(name === null ? [] : [{ path: "claim.holder", issue: name }]),
        ]);
      }
      return new ApiError("conflict", [
        { path: "claim", issue: "claim_not_held" },
      ]);
    }
    case "55000":
      return detail === "entry_closed"
        ? new ApiError("conflict", [{ path: "entry", issue: "entry_closed" }])
        : new ApiError("service_unavailable");
    case "22023":
      if (detail === "reason") {
        return new RequestValidationError([
          { path: "reasonCode", issue: "invalid_reason" },
        ]);
      }
      if (detail === "note") {
        return new RequestValidationError([
          { path: "note", issue: "invalid_note" },
        ]);
      }
      return error;
    default:
      return error;
  }
}
