// The refusals of the doors of queues 2 and 3 (0244), as the API answers them (docs/mvp/07 RG94 to RG98;
// 15 C2, C4, RG36; jalons/l2g/modele.md §3 "Erreurs"; l2g commit 11). The database says each refusal by
// its SQLSTATE, its MESSAGE (the code) and its DETAIL (the precision); this file reads them and never a
// value (fiche invariant 13):
//   42501 (unknown entry, a visual still uploading, own account, an account held, a role)  -> 404, the
//         same answer as an unknown entry (T14.3, T14.4); the held account was journaled BEFORE the act
//         by the routes (`queue.conflict_of_interest`, 0215)
//   55P03 (no live claim)  -> 409 `claim` / `held_by_other` and the holder's name (C2), or
//         `claim_not_held`, or `claim_lifted` (A8)
//   55000 by DETAIL or MESSAGE -> 409 on the path `entry`: `entry_closed`, `stale_token`,
//         `profile_state`, `not_replaceable`, and `verified_handle` (its DETAIL is the field code: the
//         handle of a line under an active « Compte vérifié » belongs to queue 6, EC-L2G-04-5)
//   23514 (a required field is missing at the publication of a submission)  -> 409, the path is the
//         field, issue `required_field_missing` (07 RG4, RG16)
//   22023 -> 400 on the body field the MESSAGE names (`reason`, `member_message`, `internal_comment`)
// Anything else is returned unchanged (a 500, whose log carries no value).
import type { ValidationIssue } from "@influx/contracts/errors";
import type { CreatorDecisionConflictIssue } from "@influx/contracts/creator-queues";
import type { Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import { isForbidden } from "../action-guards.ts";
import { displayNameOf } from "../queues/decisions/repository.ts";
import { wasDispossessed, type CreatorQueue } from "./lists/repository.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The code of a required field of 0243: snake_case, a code never a value (07 RG15). */
const FIELD_CODE_PATTERN = /^[a-z][a-z_]{0,62}$/;

/** The 55000 of the doors, by the word the database puts in the DETAIL (the MESSAGE for `verified_handle`). */
const ENTRY_ISSUES: ReadonlySet<string> = new Set<CreatorDecisionConflictIssue>(
  ["entry_closed", "stale_token", "profile_state", "not_replaceable"],
);

function conflict(issues: readonly ValidationIssue[]): ApiError {
  return new ApiError("conflict", issues);
}

function entryConflict(issue: CreatorDecisionConflictIssue): ApiError {
  return conflict([{ path: "entry", issue }]);
}

/** The body field each 22023 MESSAGE names. */
const BODY_FIELD_OF: Readonly<Record<string, string>> = {
  reason: "reasonCode",
  member_message: "memberMessage",
  internal_comment: "internalComment",
};

/**
 * The refusal of a door of the database as the code of the API (see the header); else unchanged.
 * `queue` tells which table keeps the last forced release (the notice of a lifted claim, A8).
 */
export async function creatorRefusalOf(
  tx: Transaction,
  queue: CreatorQueue,
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
          {
            path: "claim",
            issue: "held_by_other" satisfies CreatorDecisionConflictIssue,
          },
          ...(name === null ? [] : [{ path: "claim.holder", issue: name }]),
        ]);
      }
      // no live claim: expired, given back, never taken, or lifted by an administrator (A8)
      const lifted = await wasDispossessed(tx, queue, entryId, caller);
      return conflict([
        {
          path: "claim",
          issue: (lifted
            ? "claim_lifted"
            : "claim_not_held") satisfies CreatorDecisionConflictIssue,
        },
      ]);
    }
    case "55000":
      if (sqlMessageOf(error) === "verified_handle") {
        return entryConflict("verified_handle");
      }
      return detail !== null && ENTRY_ISSUES.has(detail)
        ? entryConflict(detail as CreatorDecisionConflictIssue)
        : error;
    case "23514":
      return detail !== null && FIELD_CODE_PATTERN.test(detail)
        ? conflict([
            {
              path: detail,
              issue:
                "required_field_missing" satisfies CreatorDecisionConflictIssue,
            },
          ])
        : error;
    case "22023": {
      const message = sqlMessageOf(error);
      const field = message === null ? undefined : BODY_FIELD_OF[message];
      return field === undefined
        ? error
        : new RequestValidationError([
            { path: field, issue: `invalid_${message ?? "value"}` },
          ]);
    }
    default:
      return error;
  }
}
