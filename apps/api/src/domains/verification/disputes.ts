// The creator's own contests of a decision (docs/mvp/08 RG77, CA52, CA53; jalons/l2f/modele.md §1 points
// 7 to 9, §5; 0232, 0238; l2f-fiche invariants 6, 12, 13; commit 14). A creator contests the refusal of a
// request or the withdrawal of a badge, within `dispute_window_days` of its notification, once per
// decision; a brand does not (it corrects and submits again, 06 l. 718).
// - GET  /v1/me/verification/disputes  the decisions he may still contest, his contests, the window
// - POST /v1/me/verification/disputes  one contest, the decision named by `requestId` or `badgeId`
// The account is always the session's. A decision, a badge or a contest that is not his, and an
// unknown one, are one and the same thing for the database (42501): the API answers them as an address
// that does not exist (18 T14). He reads neither the deciders, nor the lock, the deadlines, the internal
// comment nor the review mode: the contract is closed and the reads select the columns he is granted.
// - The rules are the database's (0232): the window, the unicity, what is contestable. This file says
//   WHICH refusal came back, as the code and the issue of the contract, and checks what only the API can
//   check: the text of a contest is not a way to exchange contacts (RG19, `checkDisputeText`).
// - The text a creator wrote is never logged here, never in an error, never in the register.
import {
  contestableDecisionSchema,
  ownDisputesResponseSchema,
  submitDisputeResponseSchema,
  type OwnDispute,
  type OwnDisputesResponse,
  type SubmitDisputeBody,
  type SubmitDisputeResponse,
  type VerificationRefusalIssue,
} from "@influx/contracts/verification";
import { checkDisputeText } from "@influx/domain/verification";
import type { Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlMessageOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  readOwnContestable,
  readOwnDisputeRows,
  readVerificationInstant,
  submitOwnDisputeDoor,
  type OwnDisputeRow,
} from "./repository.ts";

/** What a door says in its DETAIL (55000), on the path `dispute`. */
const DISPUTE_ISSUES: ReadonlySet<string> = new Set<VerificationRefusalIssue>([
  "not_disputable",
  "already_disputed",
]);

/** The closing instant of the window, as the door writes it in its DETAIL (ISO 8601, UTC, seconds). */
const INSTANT_DETAIL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** The body field each 22023 MESSAGE of the door names. */
const BODY_FIELD_OF: Readonly<Record<string, string>> = {
  reason: "reasonCode",
  text: "text",
};

function conflict(
  issue: VerificationRefusalIssue,
  closesAt?: string,
): ApiError {
  return new ApiError("conflict", [
    { path: "dispute", issue },
    ...(closesAt === undefined
      ? []
      : [{ path: "dispute.closesAt", issue: closesAt }]),
  ]);
}

/**
 * The refusal of `verification.submit_own_dispute()` as the API answers it, or the error itself (an
 * internal one, 500).
 * - 42501: not his, not there, not a creator: "no such route" (T14.3, T14.4).
 * - 55000 by DETAIL: `not_disputable`, `already_disputed`, and `dispute_window_closed` whose DETAIL is
 *   the closing instant (carried on the path `dispute.closesAt`: the member's own decision, nobody else's).
 * - 22023 by MESSAGE: `reason`, `text`, a 400 on the body field.
 */
export function disputeRefusalOf(error: unknown): unknown {
  switch (sqlStateOf(error)) {
    case "42501":
      return new ApiError("not_found");
    case "55000": {
      const detail = sqlDetailOf(error);
      if (sqlMessageOf(error) === "dispute_window_closed") {
        // the door says the code in its MESSAGE and the closing instant in its DETAIL
        return conflict(
          "dispute_window_closed",
          detail !== null && INSTANT_DETAIL.test(detail) ? detail : undefined,
        );
      }
      return detail !== null && DISPUTE_ISSUES.has(detail)
        ? conflict(detail as VerificationRefusalIssue)
        : error;
    }
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

/** A contest as the member reads it: what he sent, its state, and its outcome once there is one. */
function disputeOf(row: OwnDisputeRow): OwnDispute {
  const decided =
    (row.state === "upheld" || row.state === "overturned") &&
    row.outcomeReasonCode !== null &&
    row.decidedAt !== null;
  return {
    id: row.id,
    requestId: row.requestId,
    badgeId: row.badgeId,
    level: row.level as OwnDispute["level"],
    networkCode: row.networkCode,
    reasonCode: row.reasonCode as OwnDispute["reasonCode"],
    text: row.text,
    submittedAt: row.submittedAt,
    state: row.state as OwnDispute["state"],
    outcome: decided
      ? {
          result: row.state as "upheld" | "overturned",
          reasonCode: row.outcomeReasonCode as NonNullable<
            OwnDispute["outcome"]
          >["reasonCode"],
          memberMessage: row.memberMessage,
          decidedAt: row.decidedAt as string,
        }
      : null,
  };
}

type Json = Record<string, unknown>;

/** An instant a jsonb carries (`2026-11-07T18:29:58.1+00:00`) as the instant of the contract. */
function instantOf(value: unknown): string {
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) {
    throw new Error("a decision of the door carries no instant");
  }
  return new Date(time).toISOString();
}

/** The decision the door names, in the shape of the contract (it checks the values again). */
function contestableOf(item: Json) {
  const common = {
    level: item.level,
    networkCode: item.network_code,
    reasonCode: item.reason_code,
    decidedAt: instantOf(item.decided_at),
    closesAt: instantOf(item.closes_at),
  };
  return contestableDecisionSchema.parse(
    item.kind === "refusal"
      ? { kind: "refusal", requestId: item.request_id, ...common }
      : {
          kind: "revocation",
          badgeId: item.badge_id,
          memberMessage:
            typeof item.member_message === "string"
              ? item.member_message
              : null,
          ...common,
        },
  );
}

/** GET: the decisions the creator may still contest, his contests, and the window in days. */
export async function readOwnDisputes(
  tx: Transaction,
): Promise<OwnDisputesResponse> {
  const asOf = await readVerificationInstant(tx);
  const contestable = await readOwnContestable(tx);
  const items = Array.isArray(contestable.decisions)
    ? contestable.decisions.filter(
        (item): item is Json => typeof item === "object" && item !== null,
      )
    : [];
  const disputes = await readOwnDisputeRows(tx);
  return ownDisputesResponseSchema.parse({
    asOf,
    windowDays: contestable.windowDays,
    contestable: items.map(contestableOf),
    disputes: disputes.map(disputeOf),
  });
}

/**
 * POST: one contest. The text is checked for contacts before the door (RG19); the door then holds the
 * window, the unicity and what is contestable, and its refusal becomes the answer of the API.
 */
export async function submitOwnDispute(
  tx: Transaction,
  body: SubmitDisputeBody,
): Promise<SubmitDisputeResponse> {
  const check = checkDisputeText({
    reasonCode: body.reasonCode,
    text: body.text,
  });
  if (!check.ok) {
    throw new RequestValidationError([
      {
        path: "text",
        issue:
          check.refusal === "contact_detected"
            ? "direct_contact"
            : check.refusal === "text_required"
              ? "text_required"
              : "invalid_text",
      },
    ]);
  }
  let disputeId: string;
  try {
    // a savepoint: the refusal of the door leaves the transaction readable
    disputeId = await tx.transaction((savepoint) =>
      submitOwnDisputeDoor(
        savepoint,
        {
          requestId: "requestId" in body ? body.requestId : null,
          badgeId: "badgeId" in body ? body.badgeId : null,
        },
        body.reasonCode,
        body.text ?? null,
      ),
    );
  } catch (error) {
    throw disputeRefusalOf(error);
  }
  const [row] = await readOwnDisputeRows(tx, disputeId);
  if (row === undefined) {
    throw new ApiError("not_found");
  }
  return submitDisputeResponseSchema.parse({ dispute: disputeOf(row) });
}
