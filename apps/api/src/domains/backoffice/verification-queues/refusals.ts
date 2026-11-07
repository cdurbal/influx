// The refusals of the doors of queue 4 (0224), as the API answers them (docs/mvp/08 RG43, RG53, RG64;
// jalons/l2e/modele.md §4 "Erreurs"; l2e commit 14). The database says each refusal by its SQLSTATE,
// its MESSAGE (the code) and its DETAIL (the precision); this file reads them and never a value:
//   42501 (unknown request, draft, own account, an account held, a role)  -> 404, the same answer as
//         an unknown entry (T14.3, T14.4); the held account was journaled BEFORE the act (routes)
//   55P03 (no live claim)  -> 409 `claim` / `held_by_other` and the holder's name (C2), or
//         `claim_not_held`, or `claim_lifted` (A8)
//   55000, by DETAIL -> 409 on the path `entry`: `entry_closed`, `stale_token`, `ownership_prerequisite`,
//         `missing_evidence`, `no_registry_source`, `account_unavailable`
//   23514, by DETAIL -> 409 on the path `entry`: `website_domain_required`, `internal_details_required`,
//         `declared_figures_required`
//   22023, by MESSAGE -> 400 on the body field it names (`period_invalid` and `figures_invalid` say
//         which one in their DETAIL); `level`: the act does not fit the level of the request.
// `handle_already_verified` is an OUTCOME of a grant, never an error (EC-L2E-08-2).
import type { DECISION_CONFLICT_ISSUES } from "@influx/contracts/backoffice-queues";
import type { VerificationRefusalIssue } from "@influx/contracts/verification";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import { isForbidden } from "../action-guards.ts";
import { displayNameOf, wasDispossessed } from "./repository.ts";

type ClaimIssue = (typeof DECISION_CONFLICT_ISSUES)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ENTRY_ISSUES: ReadonlySet<string> = new Set<VerificationRefusalIssue>([
  "entry_closed",
  "stale_token",
  "ownership_prerequisite",
  "missing_evidence",
  "no_registry_source",
  "account_unavailable",
  "website_domain_required",
  "internal_details_required",
  "declared_figures_required",
]);

/** The body field each 22023 MESSAGE names. */
const BODY_FIELD_OF: Readonly<Record<string, string>> = {
  reason: "reasonCode",
  member_message: "memberMessage",
  internal_comment: "internalComment",
  observed_handle: "observedHandle",
  observed_platform_account_ref: "observedPlatformAccountRef",
  observed_domain: "observedDomain",
  observed_channel: "observedChannel",
  code_mismatch: "observedCode",
};

/** The figure a `figures_invalid` DETAIL names, in the camel case of the body. */
const FIGURE_FIELD_OF: Readonly<Record<string, string>> = {
  followers: "followers",
  posts_last_30_days: "postsLast30Days",
  avg_comments: "avgComments",
  engagement_bp: "engagementBp",
};

function conflict(issues: readonly ValidationIssue[]): ApiError {
  return new ApiError("conflict", issues);
}

/** The refusal of a door as the API answers it (see the header); anything else, unchanged (a 500). */
export async function agentRefusalOf(
  tx: Transaction,
  error: unknown,
  requestId: string,
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
          { path: "claim", issue: "held_by_other" satisfies ClaimIssue },
          ...(name === null ? [] : [{ path: "claim.holder", issue: name }]),
        ]);
      }
      // no live claim: expired, given back, never taken, or lifted by an administrator (A8)
      const lifted = await wasDispossessed(tx, requestId, caller);
      return conflict([
        {
          path: "claim",
          issue: (lifted
            ? "claim_lifted"
            : "claim_not_held") satisfies ClaimIssue,
        },
      ]);
    }
    case "55000":
    case "23514":
      return detail !== null && ENTRY_ISSUES.has(detail)
        ? conflict([{ path: "entry", issue: detail }])
        : error;
    case "22023": {
      const message = sqlMessageOf(error);
      if (message === "level") {
        return new RequestValidationError([
          { path: "level", issue: "invalid_level" },
        ]);
      }
      if (message === "period_invalid") {
        return new RequestValidationError([
          { path: "period", issue: detail ?? "period_invalid" },
        ]);
      }
      if (message === "figures_invalid") {
        const field = detail === null ? undefined : FIGURE_FIELD_OF[detail];
        return new RequestValidationError([
          { path: field ?? "figures", issue: "figures_invalid" },
        ]);
      }
      const field = message === null ? undefined : BODY_FIELD_OF[message];
      return field === undefined
        ? error
        : new RequestValidationError([
            {
              path: field,
              issue:
                message === "code_mismatch"
                  ? "code_mismatch"
                  : `invalid_${message ?? "value"}`,
            },
          ]);
    }
    default:
      return error;
  }
}
