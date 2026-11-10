// The badges of an account in words, and the ask for a withdrawal in checks (docs/mvp/08 RG70, RG73 to
// RG77; 06 RG55; 15 RG75; jalons/l2f/modele.md §3 "0231", §5; L2F-18): pure functions of
// src/components/AccountBadgesBlock.tsx, without a browser. apps/api and the database decide (the
// reasons of a level, the message, the 2V, the held badge): this module only words, sorts and
// pre-checks what the agent typed so that an obviously wrong ask is not sent. No figure, no handle.
import {
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  type AccountBadgeRow,
  type AccountBadgesResponse,
  type RequestBadgeRevocationBody,
  type RevocationReasonRow,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import { formatDate } from "./view-model";

const t = messages.accountBadges;

type Level = AccountBadgeRow["level"];

/** The states a badge stands in: the only ones a withdrawal may reach (0231 `badge_not_holding`). */
const HELD_STATES: ReadonlySet<string> = new Set([
  "active",
  "to_refresh",
  "to_reconfirm",
]);

/** The states of a withdrawal's 2V that still stand: a second ask is refused (`revocation_pending`). */
const LIVE_REQUEST_STATES: ReadonlySet<string> = new Set([
  "pending",
  "confirmed",
  "degraded",
]);

export function isHeld(badge: AccountBadgeRow): boolean {
  return HELD_STATES.has(badge.state);
}

/** « Compte vérifié · Instagram » ; a brand's badge carries no network. */
export function badgeName(badge: {
  level: Level;
  networkCode: string | null;
}): string {
  const level = messages.verificationQueue.levels[badge.level];
  if (badge.networkCode === null) {
    return level;
  }
  return `${level} · ${networkName(badge.networkCode)}`;
}

export function networkName(code: string): string {
  return messages.verificationQueue.networks[code] ?? code;
}

/** The state, written: a colour never carries it alone (WCAG AA). */
export function stateWords(state: string): string {
  return t.state[state] ?? state;
}

/** The held ones first, then the history, each newest first. */
export function sortedBadges(
  badges: readonly AccountBadgeRow[],
): AccountBadgeRow[] {
  return [...badges].sort((a, b) => {
    const held = Number(isHeld(b)) - Number(isHeld(a));
    if (held !== 0) {
      return held;
    }
    return Date.parse(b.grantedAt) - Date.parse(a.grantedAt);
  });
}

/** The expiry, or the end, of a badge in words (RG70: « Compte vérifié » never expires, RG30, RG71). */
export function dateWords(badge: AccountBadgeRow): string {
  switch (badge.state) {
    case "active":
      return badge.expiresAt === null
        ? t.date.neverExpires
        : t.date.expires(formatDate(badge.expiresAt));
    case "to_refresh":
      return badge.expiresAt === null
        ? t.date.neverExpires
        : t.date.pastDue(formatDate(badge.expiresAt));
    case "to_reconfirm":
      return badge.expiresAt === null
        ? t.date.neverExpires
        : t.date.dueOn(formatDate(badge.expiresAt));
    case "revoked":
      return badge.revokedAt === null
        ? t.date.revoked("—")
        : t.date.revoked(formatDate(badge.revokedAt));
    case "replaced":
      return t.date.replaced(formatDate(badge.endedAt ?? badge.grantedAt));
    default:
      return t.date.expired(formatDate(badge.endedAt ?? badge.grantedAt));
  }
}

/** The reason of a withdrawal executed, in the agent's words; null while the badge stands. */
export function revokedForWords(badge: AccountBadgeRow): string | null {
  if (badge.state !== "revoked" || badge.revocationReasonCode === null) {
    return null;
  }
  return t.revokedFor(reasonWords(badge.revocationReasonCode));
}

export function reasonWords(code: string): string {
  return messages.dualControl.reasons[code] ?? code;
}

/** The 2V of a withdrawal, in words: live (waiting), or the last one, which has no effect. */
export function pendingWords(badge: AccountBadgeRow): string | null {
  if (badge.pendingRevocation === null) {
    return null;
  }
  return t.pending[badge.pendingRevocation.state] ?? null;
}

/** A withdrawal asked for and still alive: the ask is not offered again (`revocation_pending`). */
export function hasLiveRequest(badge: AccountBadgeRow): boolean {
  return (
    badge.pendingRevocation !== null &&
    LIVE_REQUEST_STATES.has(badge.pendingRevocation.state)
  );
}

export function disputeWords(badge: AccountBadgeRow): string | null {
  return badge.dispute === null
    ? null
    : (t.dispute[badge.dispute.state] ?? null);
}

/** The ask is offered for a held badge with no live request; the database decides the rest. */
export function canRequestWithdrawal(badge: AccountBadgeRow): boolean {
  return isHeld(badge) && !hasLiveRequest(badge);
}

/** The reasons offered for the badge's level, in the order of the table. */
export function reasonsFor(
  reasons: AccountBadgesResponse["reasons"],
  level: Level,
): RevocationReasonRow[] {
  return reasons
    .filter((reason) => reason.levels.includes(level))
    .sort((a, b) => a.position - b.position);
}

export type WithdrawalOutcome =
  { ok: true; body: RequestBadgeRevocationBody } | { ok: false; error: string };

/**
 * What the agent typed, checked as the database checks it (0231 `check_revocation_reason`): a reason of
 * the level, and the message given exactly when the reason asks for it, 20 to 500 characters.
 */
export function withdrawalOutcome(input: {
  badge: AccountBadgeRow;
  reasons: AccountBadgesResponse["reasons"];
  reasonCode: string;
  memberMessage: string;
}): WithdrawalOutcome {
  const reason = reasonsFor(input.reasons, input.badge.level).find(
    (candidate) => candidate.code === input.reasonCode,
  );
  if (reason === undefined) {
    return { ok: false, error: messages.common.reasonPlaceholder };
  }
  if (!reason.requiresMemberMessage) {
    return { ok: true, body: { reasonCode: reason.code } };
  }
  const message = input.memberMessage.trim();
  if (
    message.length < VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH ||
    message.length > VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: t.memberMessageInvalid(
        VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
        VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
      ),
    };
  }
  return {
    ok: true,
    body: { reasonCode: reason.code, memberMessage: message },
  };
}

/** The recap said before the gesture (PD1): the lines that apply to this badge. */
export function recapLines(badge: AccountBadgeRow): string[] {
  return [
    t.recap.withdrawn,
    ...(badge.level === "account_verified" ? [t.recap.cascade] : []),
    t.recap.notified,
    t.recap.appeal,
    t.recap.irreversible,
  ];
}

/** The refusal of the ask in words: a database conflict (not held, already asked) reloads the list. */
export function withdrawalRefusal(code: string | undefined): string | null {
  return code === "conflict" ? t.refused : null;
}
