// The instant a member's badge « à rafraîchir » or « à reconfirmer » disappears (docs/mvp/08 RG70, RG93;
// jalons/l2f/modele.md §1 point 1; 0237): its expiry and the `badge_grace_days` of the closed list of
// parameters, added by the domain's own rule (`graceEndsAt`, packages/domain: the days come IN, the
// domain reads no parameter and no clock). An active badge has none (null): it is still current.
// And whether an active badge may already be renewed (08 RG70 « J-15 », 06 RG54; L2F fix-1, 0240): its
// expiry, the `badge_reminder_days` and the instant of the answer, by the domain's `isInRenewalWindow`.
import { graceEndsAt, isInRenewalWindow } from "@influx/domain/verification";

/** The states a badge is in during its grace period (08 RG70, RG78). */
const GRACE_STATES: ReadonlySet<string> = new Set([
  "to_refresh",
  "to_reconfirm",
]);

/** Whether the badge of this state has a grace period to serve (so the parameter has to be read). */
export function isInGrace(state: string): boolean {
  return GRACE_STATES.has(state);
}

/**
 * The end of the grace period as an instant (ISO, UTC), or null for a badge that is not in it or has
 * no expiry (an account badge never expires, RG30, RG71).
 */
export function graceEndOf(input: {
  state: string;
  expiresAt: string | null;
  graceDays: number | null;
}): string | null {
  if (
    !isInGrace(input.state) ||
    input.expiresAt === null ||
    input.graceDays === null
  ) {
    return null;
  }
  return graceEndsAt({
    expiresAt: new Date(input.expiresAt),
    graceDays: input.graceDays,
  }).toISOString();
}

/**
 * Whether a badge may hold a reminder window: active and with an expiry (the audience, the brand; an
 * account badge never expires). Only then is `badge_reminder_days` read.
 */
export function mayBeRenewable(input: {
  state: string;
  expiresAt: string | null;
}): boolean {
  return input.state === "active" && input.expiresAt !== null;
}

/**
 * The badge is active and its reminder window is open at `asOf` (the instant of the answer, the
 * database's): a new request may be opened now (the doors of 0230 open it) and keeps it.
 */
export function renewableOf(input: {
  state: string;
  expiresAt: string | null;
  reminderDays: number | null;
  asOf: string;
}): boolean {
  if (
    !mayBeRenewable(input) ||
    input.expiresAt === null ||
    input.reminderDays === null
  ) {
    return false;
  }
  return isInRenewalWindow({
    expiresAt: new Date(input.expiresAt),
    now: new Date(input.asOf),
    reminderDays: input.reminderDays,
  });
}
