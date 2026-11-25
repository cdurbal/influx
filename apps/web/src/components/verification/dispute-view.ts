// What the screens of a creator's contests show, decided outside the components (docs/mvp/08 RG10, RG73,
// RG77, CA52, CA53; 17 §5.3; jalons/l2f/modele.md §1 points 7 to 9, l2f/textes.md « Retrait »,
// « Contestation », « Issue »; commit 17). Pure functions, unit-tested (tests/dispute-view.test.ts): which
// decisions a row of a line offers to contest, what a withdrawal says, the body of a contest and what a
// refused call means, the outcome sentence. The database and the API decide what is contestable, within
// which window and once (0232, 0238): nothing here computes a window, reads a deadline or decides an
// outcome. The sentences are the translation files', by code, never an agent's name or a decider's.
//
// The front does not import @influx/domain (apps/api/tests/domain-guards.test.ts): the lists below are the
// contract's, and the one rule repeated is that `other` asks for the creator's text (the database refuses
// it too). No amount, rate, net or price (CLAUDE.md §2, D48, D78).
import {
  DISPUTE_REASON_CODES,
  REVOCATION_REASON_CODES,
  type ContestableDecision,
  type CreatorRejectionReasonCode,
  type CreatorVerificationLevel,
  type CreatorVerificationLine,
  type DisputeOutcomeReasonCode,
  type DisputeReasonCode,
  type OwnDispute,
  type OwnDisputesResponse,
  type RevocationReasonCode,
  type SubmitDisputeBody,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import type { AppealTarget } from "@/lib/member-paths";
import { refusalViewOf } from "./verification-view";

// --- The decisions a row offers to contest -----------------------------------------------------------

/** The decision a contest names, as the screen's target writes it. */
export function targetOfDecision(decision: ContestableDecision): AppealTarget {
  return decision.kind === "refusal"
    ? { kind: "refusal", requestId: decision.requestId }
    : { kind: "revocation", badgeId: decision.badgeId };
}

function isTargetOf(
  subject: { requestId: string | null; badgeId: string | null },
  target: AppealTarget,
): boolean {
  return target.kind === "refusal"
    ? subject.requestId === target.requestId
    : subject.badgeId === target.badgeId;
}

/** The decisions of a (network, level) row that the creator may still contest, in the order the API gave (newest first). */
export function contestablesOfRow(
  disputes: OwnDisputesResponse | null,
  networkCode: string,
  level: CreatorVerificationLevel,
): readonly ContestableDecision[] {
  return (disputes?.contestable ?? []).filter(
    (decision) =>
      decision.networkCode === networkCode && decision.level === level,
  );
}

/** The latest contest of a (network, level) row: the one whose follow-up the row says. */
export function latestDisputeOfRow(
  disputes: OwnDisputesResponse | null,
  networkCode: string,
  level: CreatorVerificationLevel,
): OwnDispute | null {
  const ofRow = (disputes?.disputes ?? []).filter(
    (dispute) => dispute.networkCode === networkCode && dispute.level === level,
  );
  return (
    [...ofRow].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ??
    null
  );
}

/** The decision of the target, when the creator may still contest it. */
export function contestableOfTarget(
  disputes: OwnDisputesResponse,
  target: AppealTarget,
): ContestableDecision | null {
  return (
    disputes.contestable.find((decision) =>
      isTargetOf(
        {
          requestId: decision.kind === "refusal" ? decision.requestId : null,
          badgeId: decision.kind === "revocation" ? decision.badgeId : null,
        },
        target,
      ),
    ) ?? null
  );
}

/** The contest of the target, when one exists (a decision is contested once). */
export function disputeOfTarget(
  disputes: OwnDisputesResponse,
  target: AppealTarget,
): OwnDispute | null {
  return (
    disputes.disputes.find((dispute) => isTargetOf(dispute, target)) ?? null
  );
}

// --- What a withdrawal says --------------------------------------------------------------------------

function isRevocationReason(code: string): code is RevocationReasonCode {
  return (REVOCATION_REASON_CODES as readonly string[]).includes(code);
}

/**
 * The reason of a withdrawal as the translation files hold it (`revocation.reason.<code>`): a code of the
 * closed list, the one that presents INFLUX's apologies when the badge was given by mistake (RG73). The
 * agent's own message is shown only when the API gave one, for the reason that asks for it.
 */
export function revocationViewOf(
  decision: Extract<ContestableDecision, { kind: "revocation" }>,
): { reason: RevocationReasonCode; message: string | null } {
  const message = (decision.memberMessage ?? "").trim();
  return {
    reason: isRevocationReason(decision.reasonCode)
      ? decision.reasonCode
      : "terms_breach",
    message: message === "" ? null : decision.memberMessage,
  };
}

// --- The body of a contest ---------------------------------------------------------------------------

/** What the creator typed: a reason of the closed list, then his words. */
export type AppealDraft = {
  reasonCode: DisputeReasonCode | null;
  text: string;
};

export const EMPTY_APPEAL_DRAFT: AppealDraft = { reasonCode: null, text: "" };

/** The reasons offered, in the order of the table (`dispute_reasons.position`). */
export const APPEAL_REASONS: readonly DisputeReasonCode[] =
  DISPUTE_REASON_CODES;

/** The reason asks for the creator's own words (the database refuses it without, 22023). */
export function appealReasonRequiresText(code: DisputeReasonCode): boolean {
  return code === "other";
}

/** What is still missing before a contest can be sent; the first one gets the focus. */
export type AppealProblem = "reason" | "text";

export function appealProblemOf(draft: AppealDraft): AppealProblem | null {
  if (draft.reasonCode === null) {
    return "reason";
  }
  return appealReasonRequiresText(draft.reasonCode) && draft.text.trim() === ""
    ? "text"
    : null;
}

/**
 * The body the API takes: the decision named by its own identifier, the reason, and the text with its
 * edges trimmed, left out when empty (it is optional but for `other`). Null while something is missing.
 */
export function appealBodyOf(
  target: AppealTarget,
  draft: AppealDraft,
): SubmitDisputeBody | null {
  if (draft.reasonCode === null || appealProblemOf(draft) !== null) {
    return null;
  }
  const text = draft.text.trim();
  const shared = {
    reasonCode: draft.reasonCode,
    ...(text === "" ? {} : { text }),
  };
  return target.kind === "refusal"
    ? { requestId: target.requestId, ...shared }
    : { badgeId: target.badgeId, ...shared };
}

// --- What a refused call means -----------------------------------------------------------------------

/** The message of `appeal.failure.*` a refused call leads to (the issues of 0232, RG19). */
export type AppealFailureKey =
  | "notDisputable"
  | "alreadyDisputed"
  | "windowClosed"
  | "gone"
  | "directContact"
  | "textRequired"
  | "invalidText"
  | "invalidReason"
  | "unavailable";

export type AppealFailure = {
  key: AppealFailureKey;
  /** The decision is not as the screen drew it: the contests are read again. */
  reload: boolean;
};

type Failed = Extract<RelayResult<unknown>, { kind: "failed" }>;

/** What a refused contest means for the screen, from the code and the issues of the error envelope. */
export function appealFailureOf(result: Failed): AppealFailure {
  const issues = result.issues ?? [];
  const has = (issue: string) => issues.includes(issue);
  if (result.code === "not_found") {
    return { key: "gone", reload: true };
  }
  if (result.code === "conflict") {
    if (has("already_disputed")) {
      return { key: "alreadyDisputed", reload: true };
    }
    if (has("dispute_window_closed")) {
      return { key: "windowClosed", reload: true };
    }
    if (has("not_disputable")) {
      return { key: "notDisputable", reload: true };
    }
  }
  if (result.code === "validation_failed") {
    // the text of a contest is not a way to exchange contacts (RG19); never echoed back
    if (has("direct_contact")) {
      return { key: "directContact", reload: false };
    }
    if (has("text_required")) {
      return { key: "textRequired", reload: false };
    }
    if (has("invalid_text")) {
      return { key: "invalidText", reload: false };
    }
    if (has("invalid_reason")) {
      return { key: "invalidReason", reload: false };
    }
  }
  return { key: "unavailable", reload: false };
}

// --- The follow-up of a contest ----------------------------------------------------------------------

/**
 * What the creator reads of the outcome of a contest (RG77 « notifié de l'issue avec un motif »), as the key
 * of its sentence in `appeal.outcome.*` and the words that complete it: `decision_confirmed` names the
 * initial motive, `decision_overturned` the badge and its new date, `other` the team's own message.
 *
 * EC-L2F-17-1: the initial motive of a withdrawal is no longer served once the contest is filed (the
 * contest keeps the creator's reason, not the decision's), so only a refusal still carried by the lines
 * can say it; a withdrawal confirmed says the decision stands, without its motive clause.
 */
export type OutcomeView =
  | { key: "decision_confirmed"; reason: CreatorRejectionReasonCode }
  | { key: "decision_confirmedBare" }
  | { key: "new_request_needed" }
  | { key: "other"; message: string }
  | {
      key: "decision_overturned";
      level: CreatorVerificationLevel;
      decidedAt: string;
    };

export function outcomeViewOf(
  dispute: OwnDispute,
  lines: readonly CreatorVerificationLine[],
): OutcomeView | null {
  const { outcome } = dispute;
  if (outcome === null) {
    return null;
  }
  const code: DisputeOutcomeReasonCode = outcome.reasonCode;
  switch (code) {
    case "decision_overturned":
      return {
        key: "decision_overturned",
        level: dispute.level,
        decidedAt: outcome.decidedAt,
      };
    case "new_request_needed":
      return { key: "new_request_needed" };
    case "other":
      return { key: "other", message: outcome.memberMessage ?? "" };
    case "decision_confirmed": {
      const refused =
        dispute.requestId === null
          ? null
          : (levelRequestsOf(lines, dispute).find(
              (request) => request.id === dispute.requestId,
            )?.refusal ?? null);
      return refused === null
        ? { key: "decision_confirmedBare" }
        : {
            key: "decision_confirmed",
            // the reason does not depend on where the refusal was given, only its next step does
            reason: refusalViewOf(refused, { level: "account_verified" })
              .reason,
          };
    }
  }
}

function levelRequestsOf(
  lines: readonly CreatorVerificationLine[],
  dispute: OwnDispute,
) {
  const line = lines.find(
    (candidate) => candidate.networkCode === dispute.networkCode,
  );
  return line === undefined
    ? []
    : line.requests.filter((request) => request.level === dispute.level);
}

/** Whether the contest is still waiting for a decision of the team. */
export function isDisputeOpen(dispute: OwnDispute): boolean {
  return dispute.state === "open";
}
