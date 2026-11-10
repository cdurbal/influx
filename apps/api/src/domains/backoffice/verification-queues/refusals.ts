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
// Queues 5 and 6 (L2F commit 14, 0232, 0233) reuse the same reading: their 55000 add `reviewer_is_decider`
// (the decider of the decision contested, while another person exists), `restore_expired` (the badge
// given back would be past its date), `line_deleted`, `handle_already_verified` (an ERROR there: a
// contest or an identifier change never escalates a grant) and `badge_not_holding`, all on the path
// `entry`; `reflection_delay` carries the seconds left in its DETAIL, served on `entry.reflectionSeconds`
// (the decider alone waits `dispute_reflection_hours`, the number is the database's, not a constant).
// D83 (L2F commit 15, 0234): the grant on the login address says `login_address_ineligible` by MESSAGE
// and its reason by DETAIL (`unverified`, `consumer_domain`, `other_domain`): 409 on `entry`, the reason
// on `entry.loginAddress` (a word, never the address nor its domain). The opening of a verification by an
// agent has its own reading, `openingRefusalOf` below.
import type { DECISION_CONFLICT_ISSUES } from "@influx/contracts/backoffice-queues";
import type { VerificationRefusalIssue } from "@influx/contracts/verification";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../../../platform/errors.ts";
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
  // queues 5 and 6 (0232, 0233)
  "reviewer_is_decider",
  "restore_expired",
  "line_deleted",
  "handle_already_verified",
  "badge_not_holding",
]);

const SECONDS_DETAIL = /^\d{1,9}$/;
const INSTANT_DETAIL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** What the database says of a login address that does not prove the domain (0234, EC-L2F-09-6). */
const LOGIN_ADDRESS_REASONS: ReadonlySet<string> = new Set([
  "unverified",
  "consumer_domain",
  "other_domain",
]);

/** The body field each 22023 MESSAGE names. */
const BODY_FIELD_OF: Readonly<Record<string, string>> = {
  reason: "reasonCode",
  member_message: "memberMessage",
  internal_comment: "internalComment",
  observed_handle: "observedHandle",
  // 0228 (L2ES-2): the handle typed does not match the one declared: the same field, its own issue
  observed_handle_mismatch: "observedHandle",
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

/**
 * The 22023 of a typed value the database refuses, as a 400 on the body field its MESSAGE names
 * (`invalid_<message>`, `code_mismatch` as is); `error` itself for a message this file does not know.
 */
function invalidFieldOf(error: unknown): unknown {
  const message = sqlMessageOf(error);
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

/** 0231: the issues the withdrawal of a badge says in its DETAIL (55000), on the path `badge`. */
const REVOCATION_ISSUES: ReadonlySet<string> =
  new Set<VerificationRefusalIssue>([
    "badge_not_holding",
    "revocation_pending",
  ]);

/**
 * The refusal of the request of a withdrawal (0231 verification.request_badge_revocation()), as the
 * API answers it: 42501 (unknown badge, own account, an account the caller holds) the same 404 as an
 * unknown address (T14.3, T14.4); 55000 `badge_not_holding` or `revocation_pending` a 409 on `badge`;
 * 22023 `reason` or `member_message` a 400 on `reasonCode` or `memberMessage`. Anything else, unchanged.
 */
export function revocationRefusalOf(error: unknown): unknown {
  if (isForbidden(error)) {
    return new ApiError("not_found");
  }
  const detail = sqlDetailOf(error);
  switch (sqlStateOf(error)) {
    case "55000":
      return detail !== null && REVOCATION_ISSUES.has(detail)
        ? conflict([{ path: "badge", issue: detail }])
        : error;
    case "22023":
      return invalidFieldOf(error);
    default:
      return error;
  }
}

/** The fields of the internal block of a brand, as the body names them (DETAIL of `internal_details_invalid`). */
const INTERNAL_FIELD_OF: Readonly<Record<string, string>> = {
  legal_name: "legalName",
  registration_country_code: "registrationCountryCode",
  registration_number: "registrationNumber",
};

/** The issues the opening of a verification says in its DETAIL (55000, 23514), on the path `request`. */
const OPENING_ISSUES: ReadonlySet<string> = new Set<VerificationRefusalIssue>([
  "account_unavailable",
  "already_verified",
  "rejection_cap",
  "website_domain_required",
  "internal_details_required",
]);

/**
 * The refusal of the opening of a verification by an agent (0234 verification.open_request_for_member(),
 * D83 A), as the API answers it:
 *   42501 (an unknown account, an internal one, the caller's own, a line that is not the account's, the
 *         population of the level) the same 404 as an unknown address (T14.3, T14.4);
 *   55000 by DETAIL: `account_unavailable`, `already_verified`, `rejection_cap`, a number of seconds
 *         (`retry_after`, RG60: also a `Retry-After`), a date or the message `duplicate_request`;
 *         409 on `request`;
 *   23514 `website_domain_required`, `internal_details_required`: 409 on `request`;
 *   22023 by MESSAGE `level`, `reason`, `opening_comment`: 400 on its body field;
 *         `internal_details_invalid` by DETAIL: the field of the block (`invalid_internal_details`), or
 *         the block already on the record (`internal_details_present`, on `internalDetails`).
 * Anything else is returned unchanged (a 500).
 */
export function openingRefusalOf(error: unknown): unknown {
  if (isForbidden(error)) {
    return new ApiError("not_found");
  }
  const detail = sqlDetailOf(error);
  switch (sqlStateOf(error)) {
    case "55000":
      if (detail !== null && SECONDS_DETAIL.test(detail)) {
        return new RetryLaterError("conflict", Number(detail), [
          { path: "request", issue: "retry_after" },
        ]);
      }
      if (detail !== null && INSTANT_DETAIL.test(detail)) {
        return conflict([
          { path: "request", issue: "duplicate_request" },
          { path: "submittedAt", issue: detail },
        ]);
      }
      if (detail !== null && OPENING_ISSUES.has(detail)) {
        return conflict([{ path: "request", issue: detail }]);
      }
      return sqlMessageOf(error) === "duplicate_request"
        ? conflict([{ path: "request", issue: "duplicate_request" }])
        : error;
    case "23514":
      return detail !== null && OPENING_ISSUES.has(detail)
        ? conflict([{ path: "request", issue: detail }])
        : error;
    case "22023": {
      const message = sqlMessageOf(error);
      if (message === "level") {
        return new RequestValidationError([
          { path: "level", issue: "invalid_level" },
        ]);
      }
      if (message === "reason") {
        return new RequestValidationError([
          { path: "openingReasonCode", issue: "invalid_reason" },
        ]);
      }
      if (message === "opening_comment") {
        return new RequestValidationError([
          { path: "openingComment", issue: "invalid_opening_comment" },
        ]);
      }
      if (message === "internal_details_invalid") {
        if (detail === "internal_details_present") {
          return new RequestValidationError([
            { path: "internalDetails", issue: "internal_details_present" },
          ]);
        }
        const field = detail === null ? undefined : INTERNAL_FIELD_OF[detail];
        return field === undefined
          ? error
          : new RequestValidationError([
              { path: field, issue: "invalid_internal_details" },
            ]);
      }
      return error;
    }
    default:
      return error;
  }
}

/** The refusal of a door as the API answers it (see the header); anything else, unchanged (a 500). */
export async function agentRefusalOf(
  tx: Transaction,
  error: unknown,
  requestId: string,
  caller: string,
  /** Whether the last forced release of THIS entry dispossessed the caller: the table is the queue's. */
  dispossessed: (
    tx: Transaction,
    entryId: string,
    caller: string,
  ) => Promise<boolean> = wasDispossessed,
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
      const lifted = await dispossessed(tx, requestId, caller);
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
      if (
        detail !== null &&
        SECONDS_DETAIL.test(detail) &&
        sqlMessageOf(error) === "reflection_delay"
      ) {
        return conflict([
          { path: "entry", issue: "reflection_delay" },
          { path: "entry.reflectionSeconds", issue: detail },
        ]);
      }
      if (
        detail !== null &&
        LOGIN_ADDRESS_REASONS.has(detail) &&
        sqlMessageOf(error) === "login_address_ineligible"
      ) {
        return conflict([
          { path: "entry", issue: "login_address_ineligible" },
          { path: "entry.loginAddress", issue: detail },
        ]);
      }
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
      return invalidFieldOf(error);
    }
    default:
      return error;
  }
}
