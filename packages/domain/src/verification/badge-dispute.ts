// The contest of a refusal or of a withdrawal (docs/mvp/08 RG77, CA52, CA53; jalons/l2f/modele.md §1
// points 7 to 10, l2f/textes.md « Contestation », « Issue »; 0232). A creator contests ONE decision of
// his own, a refusal (`rejected`) or the withdrawal under 2V of a badge, within `dispute_window_days`
// of its notification; a brand corrects and submits again instead (06 l. 718). The window is a setting
// of the table and comes IN (RG100), counted in calendar days of the UTC date as the database counts
// them, the closing instant itself still inside. The sentences are the translation files', by code.
import { detectDirectContact } from "../shared/contact-detection.ts";
import { isDisputeText } from "./limits.ts";
import type {
  VerificationBadgeState,
  VerificationLevel,
  VerificationRequestStatus,
} from "./levels.ts";

const MILLISECONDS_IN_A_DAY = 86_400_000;

/** `verification.dispute_state` (0232): `open` waits in queue 5, the three others close the contest. */
export const DISPUTE_STATES = [
  "open",
  "upheld",
  "overturned",
  "withdrawn",
] as const;
export type DisputeState = (typeof DISPUTE_STATES)[number];

/** `verification.dispute_reasons` (0232), in the order of `position`; `other` asks for the creator's text. */
export const DISPUTE_REASONS = [
  { code: "misread", requiresText: false },
  { code: "evidence_valid", requiresText: false },
  { code: "reason_wrong", requiresText: false },
  { code: "other", requiresText: true },
] as const;
export type DisputeReasonCode = (typeof DISPUTE_REASONS)[number]["code"];

export type DisputeOutcome = "upheld" | "overturned";

/**
 * `verification.dispute_outcome_reasons` (0232), in the order of `position`: the motive an outcome is
 * notified with (RG77), tied to its outcome. `other` (upheld) asks for the agent's own message.
 */
export const DISPUTE_OUTCOME_REASONS = [
  {
    code: "decision_confirmed",
    outcome: "upheld",
    requiresMemberMessage: false,
  },
  {
    code: "new_request_needed",
    outcome: "upheld",
    requiresMemberMessage: false,
  },
  { code: "other", outcome: "upheld", requiresMemberMessage: true },
  {
    code: "decision_overturned",
    outcome: "overturned",
    requiresMemberMessage: false,
  },
] as const satisfies readonly {
  code: string;
  outcome: DisputeOutcome;
  requiresMemberMessage: boolean;
}[];
export type DisputeOutcomeReasonCode =
  (typeof DISPUTE_OUTCOME_REASONS)[number]["code"];

/** Whether the reason asks for the creator's text (22023 `text` otherwise missing). */
export function disputeReasonRequiresText(code: string): boolean {
  return DISPUTE_REASONS.some(
    (reason) => reason.code === code && reason.requiresText,
  );
}

export type DisputeWindow = {
  /** The contest may still be filed: `now` is not past `closesAt`. */
  readonly open: boolean;
  /** `notifiedAt` plus `windowDays` calendar days: the instant the database refuses after. */
  readonly closesAt: Date;
};

/**
 * The window of a contest (RG77, CA52): `windowDays` after the notification (`decided_at` of the
 * refusal, `revoked_at` of the withdrawal). 30 days accepted, 31 refused; the closing instant itself
 * is accepted (0232: refused when `now() > notified + window`). `windowDays` is the table's.
 */
export function disputeWindow(input: {
  readonly notifiedAt: Date;
  readonly now: Date;
  readonly windowDays: number;
}): DisputeWindow {
  const closesAt = new Date(
    input.notifiedAt.getTime() + input.windowDays * MILLISECONDS_IN_A_DAY,
  );
  return { open: input.now.getTime() <= closesAt.getTime(), closesAt };
}

/** The decision a creator would contest, as the member's own screen knows it. */
export type ContestedDecision =
  | {
      readonly kind: "refusal";
      readonly level: VerificationLevel;
      readonly requestStatus: VerificationRequestStatus;
    }
  | {
      readonly kind: "revocation";
      readonly level: VerificationLevel;
      readonly badgeState: VerificationBadgeState;
      /** Withdrawn by a 2V of THIS badge: neither the audience carried along nor the erasure (point 4). */
      readonly byDualControl: boolean;
    };

/**
 * Whether a decision is contestable at all, the window apart (modele points 4, 8; EC-L2F-8): a
 * creator's refusal (`rejected`; `closed` is not), or a badge withdrawn under 2V by name; never a
 * brand's.
 */
export function isDisputable(decision: ContestedDecision): boolean {
  if (decision.level === "brand_verified") return false;
  return decision.kind === "refusal"
    ? decision.requestStatus === "rejected"
    : decision.badgeState === "revoked" && decision.byDualControl;
}

export type DisputeTextRefusal =
  /** `other` without a text (22023 `text`). */
  | "text_required"
  /** Blank, over 1 000 characters or holding a control character (22023 `text`). */
  | "text_invalid"
  /** An e-mail, an address, a domain or a telephone number: the contest is not a way to exchange contacts (RG19). */
  | "contact_detected";

export type DisputeTextCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: DisputeTextRefusal };

const CONTACT_REFUSED = ["email", "url", "domain", "phone"] as const;

/**
 * The text of a contest (modele point 7): optional but for `other`, 1 to 1 000 printable characters.
 * The database holds the first two rules; the API adds the third (the signals of RG19, a `@pseudo`
 * being admitted). The text that matched is never returned.
 */
export function checkDisputeText(input: {
  readonly reasonCode: string;
  readonly text: string | null | undefined;
}): DisputeTextCheck {
  const text = input.text ?? null;
  if (text === null) {
    return disputeReasonRequiresText(input.reasonCode)
      ? { ok: false, refusal: "text_required" }
      : { ok: true };
  }
  if (!isDisputeText(text)) return { ok: false, refusal: "text_invalid" };
  const signals = detectDirectContact(text);
  return CONTACT_REFUSED.some((signal) => signals.includes(signal))
    ? { ok: false, refusal: "contact_detected" }
    : { ok: true };
}
