// The refusals of the doors of queue 7 and of the campaign (0307 to 0309), as the API answers them (docs/mvp/
// 09 RG5, RG85, RG88 to RG90, RG94; 15 C2, C4, RG36; jalons/l3c/modele.md §3 to §6, "Refusals"). The database
// says each refusal by its SQLSTATE, its MESSAGE (the code) and its DETAIL (the precision); this file reads
// them and never a value (fiche invariant 11):
//   42501 (unknown, own account, an entry held or hidden, a role)  -> 404, the same answer as an unknown
//         one (T14.3, T14.4); the held account was journaled BEFORE the act by the routes
//         (`queue.conflict_of_interest`, 0215)
//   55P03 (no live claim)  -> 409 `claim` / `held_by_other` and the holder's name (C2), or `claim_not_held`,
//         or `claim_lifted` (A8)
//   55000 by DETAIL or MESSAGE -> 409 on the path `entry` (a decision) or `campaign` (an act on the record):
//         the closed list of CAMPAIGN_DECISION_CONFLICT_ISSUES; `live_campaign_cap` also names the live
//         campaigns of the brand (RG15), each as an issue of the path `campaign.live`
//   23514 `enhanced_review` -> 409, the declaration of the brand is missing for a sensitive sector (CA56, D84)
//   23514, 23503 on a correction -> 400 on `value`: a constraint of the campaign refused the value
//   22023 -> 400 on the body field the MESSAGE names
// Anything else is returned unchanged (a 500, whose log carries no value).
import type { ValidationIssue } from "@influx/contracts/errors";
import {
  CAMPAIGN_DECISION_CONFLICT_ISSUES,
  type CampaignDecisionConflictIssue,
} from "@influx/contracts/campaign-review";
import type { Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import { isForbidden } from "../action-guards.ts";
import { displayNameOf } from "../queues/decisions/repository.ts";
import { campaignWasDispossessed } from "./lists/repository.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ISSUES: ReadonlySet<string> = new Set(CAMPAIGN_DECISION_CONFLICT_ISSUES);

/** The body field each 22023 MESSAGE names. */
const BODY_FIELD_OF: Readonly<Record<string, string>> = {
  reason: "reasonCode",
  member_message: "memberMessage",
  internal_comment: "internalComment",
  opinion: "opinion",
  owner_agent: "ownerAgentId",
  value: "value",
  unchanged: "value",
  field_code: "fieldCode",
  title: "title",
  campaign_type: "campaignType",
};

/** Where a refusal sits: the entry a decision aims at, or the campaign an act on the record aims at. */
export type RefusalScope = "entry" | "campaign";

function conflict(issues: readonly ValidationIssue[]): ApiError {
  return new ApiError("conflict", issues);
}

function issueOf(
  scope: RefusalScope,
  issue: CampaignDecisionConflictIssue,
): ApiError {
  return conflict([{ path: scope, issue }]);
}

/**
 * The refusal of a door of the database as the code of the API (see the header); else unchanged. `entryId`
 * tells which entry keeps the last forced release (the notice of a lifted claim, A8): null for an act on
 * the record, which has no entry of its own.
 */
export async function campaignRefusalOf(
  tx: Transaction,
  error: unknown,
  scope: RefusalScope,
  entryId: string | null,
  caller: string,
): Promise<unknown> {
  if (isForbidden(error)) {
    return new ApiError("not_found");
  }
  const detail = sqlDetailOf(error);
  const message = sqlMessageOf(error);
  switch (sqlStateOf(error)) {
    case "55P03": {
      if (detail !== null && UUID_PATTERN.test(detail)) {
        // C2: somebody else holds it, and the answer says who
        const name = await displayNameOf(tx, detail);
        return conflict([
          {
            path: "claim",
            issue: "held_by_other" satisfies CampaignDecisionConflictIssue,
          },
          ...(name === null ? [] : [{ path: "claim.holder", issue: name }]),
        ]);
      }
      // no live claim: expired, given back, never taken, or lifted by an administrator (A8)
      const lifted =
        entryId !== null &&
        (await campaignWasDispossessed(tx, entryId, caller));
      return conflict([
        {
          path: "claim",
          issue: (lifted
            ? "claim_lifted"
            : "claim_not_held") satisfies CampaignDecisionConflictIssue,
        },
      ]);
    }
    case "55000": {
      if (message === "live_campaign_cap") {
        // RG15: the live campaigns of the brand, named so that the agent can tell the brand which to close
        const live = (detail ?? "")
          .split(",")
          .filter((id) => UUID_PATTERN.test(id))
          .map((id) => ({ path: "campaign.live", issue: id }));
        return conflict([
          {
            path: scope,
            issue: "live_campaign_cap" satisfies CampaignDecisionConflictIssue,
          },
          ...live,
        ]);
      }
      // the passages carry their code in the MESSAGE and the state in the DETAIL; the doors, their code in both
      const code =
        message !== null && ISSUES.has(message)
          ? message
          : detail !== null && ISSUES.has(detail)
            ? detail
            : null;
      return code === null
        ? error
        : issueOf(scope, code as CampaignDecisionConflictIssue);
    }
    case "23514":
      if (detail === "enhanced_review") {
        return issueOf(scope, "enhanced_review");
      }
      // a constraint of the campaign refused the value of a correction
      return scope === "campaign"
        ? new RequestValidationError([
            { path: "value", issue: "invalid_value" },
          ])
        : error;
    case "23503":
      return scope === "campaign"
        ? new RequestValidationError([
            { path: "value", issue: "invalid_value" },
          ])
        : error;
    case "22023": {
      const field = message === null ? undefined : BODY_FIELD_OF[message];
      return field === undefined
        ? error
        : new RequestValidationError([
            {
              path: field,
              issue:
                message === "unchanged"
                  ? "unchanged"
                  : `invalid_${message ?? "value"}`,
            },
          ]);
    }
    default:
      return error;
  }
}
