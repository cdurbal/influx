// How a badge ages, and what the member is offered next (docs/mvp/08 RG10, RG69, RG70, RG78, RG93,
// RG97; 06 RG54; jalons/l2f fiche invariants 1, 2, 15; l2f/modele.md §1 points 1, 6, 13; 0230). The
// state gives the KEY of its written label (or of the notice that says the badge ended), never the
// sentence: the sentences are the translation files', `08` RG10 and RG93 mot pour mot (hypothesis
// D34). Dates and delays come IN as arguments: `badge_grace_days` and `badge_reminder_days` are
// settings of the table (RG100), and the clock is the caller's. Nothing here is a colour: the label
// is the carrier (RG97), and nothing here moves a badge, only the worker does (invariant 1).
import {
  badgeDisplay,
  type BadgeLabelKey,
  type BadgeViewer,
} from "./badge-display.ts";
import type { VerificationBadgeState, VerificationLevel } from "./levels.ts";

const MILLISECONDS_IN_A_DAY = 86_400_000;

/** The notice an ended badge is told with: the audience that expired (RG70), the badge that was removed (RG73). */
export type BadgeEndNoticeKey = "verif.expiry.removed" | "verif.revoked.notice";

/**
 * The written key of a badge in a state, for the member who owns it, or `null` when nothing is said
 * on the web (the badge is not shown, or its end is told by e-mail only):
 * - `active`, `to_refresh`, `to_reconfirm`: the label of the badge (`badgeDisplay`: « à rafraîchir »,
 *   « à reconfirmer » of RG93, the brand's own line for its badge);
 * - `expired`: the creator's audience only, « Vos chiffres sont de nouveau affichés comme déclarés »
 *   (an account badge ends by a deleted line, a brand's end is an e-mail);
 * - `revoked`: a creator badge, the notice of RG73 « Votre badge a été retiré : {reason} »;
 * - `replaced`: nothing, a newer badge stands in its place.
 * An advertiser reads nothing of an ended badge: it has disappeared (RG70, RG76).
 */
export function badgeStateLabelKey(input: {
  readonly level: VerificationLevel;
  readonly state: VerificationBadgeState;
  readonly viewer: BadgeViewer;
}): BadgeLabelKey | BadgeEndNoticeKey | null {
  const { level, state, viewer } = input;
  switch (state) {
    case "active":
    case "to_refresh":
    case "to_reconfirm":
      return badgeDisplay({ level, state, viewer })?.labelKey ?? null;
    case "expired":
      return viewer === "owner" && level === "audience_verified"
        ? "verif.expiry.removed"
        : null;
    case "revoked":
      return viewer === "owner" && level !== "brand_verified"
        ? "verif.revoked.notice"
        : null;
    case "replaced":
      return null;
  }
}

/**
 * The instant a badge that is « à rafraîchir » or « à reconfirmer » disappears: its `expires_at` and
 * `badge_grace_days` calendar days (RG70 « 30 jours de grâce »; the task ends it then, 0230).
 */
export function graceEndsAt(input: {
  readonly expiresAt: Date;
  readonly graceDays: number;
}): Date {
  return new Date(
    input.expiresAt.getTime() + input.graceDays * MILLISECONDS_IN_A_DAY,
  );
}

/**
 * Whether `now` is in the window where an active badge may already be renewed and is reminded of
 * (`expires_at` minus `badge_reminder_days`, the reminder instant included; 0230).
 */
export function isInRenewalWindow(input: {
  readonly expiresAt: Date;
  readonly now: Date;
  readonly reminderDays: number;
}): boolean {
  return (
    input.expiresAt.getTime() - input.reminderDays * MILLISECONDS_IN_A_DAY <=
    input.now.getTime()
  );
}

/**
 * What the member is offered next on a line, by the badge he holds there (RG10, RG70, RG78, EC-L2F-13):
 * - `request`: nothing is held, the usual « faire vérifier »;
 * - `none`: nothing to do (an account badge never expires, RG30, RG71; an audience or a brand badge
 *   before its reminder window);
 * - `renew`: still active, the reminder window is open, a new request keeps the badge (RG70 « J-15 »);
 * - `refresh`: « à rafraîchir », a new request before the end of the grace (CA46, CA48: no ownership
 *   asked again while the identifier is unchanged);
 * - `reconfirm`: « à reconfirmer », the ownership proved again after a changed identifier (RG78);
 * - `request_again`: the badge ended (`expired`, `revoked`); a withdrawal is also contestable, which
 *   is the contest's own rule (`disputeWindow`, `isDisputable`) and not a step of this list.
 */
export const MEMBER_NEXT_STEPS = [
  "none",
  "request",
  "renew",
  "refresh",
  "reconfirm",
  "request_again",
] as const;
export type MemberNextStep = (typeof MEMBER_NEXT_STEPS)[number];

export function memberNextStep(input: {
  readonly level: VerificationLevel;
  /** The badge held on the line (or by the brand), `null` when none is. */
  readonly badge: {
    readonly state: VerificationBadgeState;
    readonly expiresAt: Date | null;
  } | null;
  readonly now: Date;
  readonly reminderDays: number;
}): MemberNextStep {
  const { badge } = input;
  if (badge === null) return "request";
  switch (badge.state) {
    case "active":
      return input.level !== "account_verified" &&
        badge.expiresAt !== null &&
        isInRenewalWindow({
          expiresAt: badge.expiresAt,
          now: input.now,
          reminderDays: input.reminderDays,
        })
        ? "renew"
        : "none";
    case "to_refresh":
      return "refresh";
    case "to_reconfirm":
      return "reconfirm";
    case "expired":
    case "revoked":
      return "request_again";
    case "replaced":
      return "none";
  }
}
