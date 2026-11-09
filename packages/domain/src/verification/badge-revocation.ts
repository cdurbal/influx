// The reasons a badge is withdrawn for, by level (docs/mvp/08 RG73, RG74; 06 RG55; jalons/l2f/modele.md
// §1 point 5, l2f/textes.md « Retrait »; 0231 `verification.revocation_reasons`, `check_revocation_reason`).
// A closed list: a withdrawal never goes without a reason of it, whose `levels` hold the level of the
// badge. `escalatesToAdmin` is the escalation of RG73 (held by construction: only an administrator
// confirms and executes a withdrawal, EC-L2F-06-2); `requiresMemberMessage` asks for the agent's own
// message to the member (20 to 500 characters), refused for the others. Five reasons stand for a
// creator badge (RG73) and five for a brand badge (06 RG55); `influx_error` is for both and presents
// INFLUX's apologies, never an accusation. The sentences are the translation files', by code.
import { isMemberMessage } from "./limits.ts";
import type { VerificationLevel } from "./levels.ts";

/** `verification.revocation_reasons.code`, in the order of the table (`position`). */
export const REVOCATION_REASON_CODES = [
  "forged_evidence",
  "account_closed",
  "owner_changed",
  "terms_breach",
  "influx_error",
  "company_dissolved",
  "domain_transferred",
] as const;
export type RevocationReasonCode = (typeof REVOCATION_REASON_CODES)[number];

export type RevocationReason = {
  readonly code: RevocationReasonCode;
  /** The levels a badge may be withdrawn at for this reason (`levels`, 0231). */
  readonly levels: readonly VerificationLevel[];
  /** The agent's message to the member is required, and refused for a reason that does not ask for it. */
  readonly requiresMemberMessage: boolean;
  readonly escalatesToAdmin: boolean;
};

const EVERY_LEVEL: readonly VerificationLevel[] = [
  "account_verified",
  "audience_verified",
  "brand_verified",
];
const CREATOR_LEVELS: readonly VerificationLevel[] = [
  "account_verified",
  "audience_verified",
];
const BRAND_LEVEL: readonly VerificationLevel[] = ["brand_verified"];

export const REVOCATION_REASONS: readonly RevocationReason[] = [
  {
    code: "forged_evidence",
    levels: EVERY_LEVEL,
    requiresMemberMessage: false,
    escalatesToAdmin: true,
  },
  {
    code: "account_closed",
    levels: CREATOR_LEVELS,
    requiresMemberMessage: false,
    escalatesToAdmin: false,
  },
  {
    code: "owner_changed",
    levels: CREATOR_LEVELS,
    requiresMemberMessage: false,
    escalatesToAdmin: true,
  },
  {
    code: "terms_breach",
    levels: EVERY_LEVEL,
    requiresMemberMessage: true,
    escalatesToAdmin: true,
  },
  {
    code: "influx_error",
    levels: EVERY_LEVEL,
    requiresMemberMessage: false,
    escalatesToAdmin: true,
  },
  {
    code: "company_dissolved",
    levels: BRAND_LEVEL,
    requiresMemberMessage: false,
    escalatesToAdmin: false,
  },
  {
    code: "domain_transferred",
    levels: BRAND_LEVEL,
    requiresMemberMessage: false,
    escalatesToAdmin: false,
  },
];

/** The reasons offered for a badge of `level`, in the order of the table. */
export function revocationReasonsFor(
  level: VerificationLevel,
): readonly RevocationReason[] {
  return REVOCATION_REASONS.filter((reason) => reason.levels.includes(level));
}

export type RevocationRefusal =
  /** Not a reason of the list, or not one for this level (22023 `reason`). */
  "reason" | "member_message";

export type RevocationCheck =
  | { readonly ok: true; readonly escalatesToAdmin: boolean }
  | { readonly ok: false; readonly refusal: RevocationRefusal };

/**
 * What the database says of a withdrawal asked for (0231 `check_revocation_reason`): the reason must
 * be one of the level, and the message is given exactly when the reason asks for it (20 to 500
 * printable characters). Order of the refusals, the database's: reason, then message.
 */
export function checkRevocationReason(input: {
  readonly level: VerificationLevel;
  readonly reasonCode: string;
  readonly memberMessage: string | null | undefined;
}): RevocationCheck {
  const reason = REVOCATION_REASONS.find(
    (candidate) =>
      candidate.code === input.reasonCode &&
      candidate.levels.includes(input.level),
  );
  if (reason === undefined) return { ok: false, refusal: "reason" };
  const message = input.memberMessage ?? null;
  const given = message !== null;
  if (reason.requiresMemberMessage) {
    if (!given || !isMemberMessage(message)) {
      return { ok: false, refusal: "member_message" };
    }
  } else if (given) {
    return { ok: false, refusal: "member_message" };
  }
  return { ok: true, escalatesToAdmin: reason.escalatesToAdmin };
}
