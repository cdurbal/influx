/**
 * Cookie consent decision: value object, validity rules and storage port (11 §7).
 *
 * Storage is deliberately in memory only: the mockup lot forbids every web storage and cookie
 * API (01 §6.4, CA8, enforced by ESLint and guard test "no network or storage API"). The record
 * shape below is already the one the Lot 1 cookie will carry, so switching to a real cookie means
 * implementing readStoredConsent/writeStoredConsent only — no change in the component.
 *
 * In-memory behaviour matches the "storage unavailable" case of the spec (11 §6.3): the choice
 * holds for the current session and no error is ever shown.
 */

export type CookieConsentDecision = "accepted" | "rejected";

export type CookieConsentRecord = {
  decision: CookieConsentDecision;
  /** Version of the consent text: a new version re-opens the banner (11 §7). */
  version: number;
  /** ISO 8601 instant of the choice. */
  decidedAt: string;
};

/** Bump when the wording of `landing.cookieBanner.body` changes (11 §8). */
export const COOKIE_CONSENT_VERSION = 1;

/** Name of the Lot 1 cookie carrying the record below. */
export const COOKIE_CONSENT_NAME = "influx_cookie_consent";

/** 6 months, identical for "accepted" and "rejected" (11 §7, CNIL recommendation). */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/**
 * Global switch of the banner (11 §8, "no non-essential tracker" case). Turning it off hides the
 * banner everywhere without touching the "Cookies" link of the footer.
 */
export const IS_COOKIE_BANNER_ENABLED = true;

export function serializeConsent(record: CookieConsentRecord): string {
  return JSON.stringify(record);
}

export function parseConsent(value: string | null): CookieConsentRecord | null {
  if (!value) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Corrupted value: treated as "no choice yet", the conservative behaviour.
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const { decision, version, decidedAt } = parsed as Record<string, unknown>;
  if (
    (decision !== "accepted" && decision !== "rejected") ||
    typeof version !== "number" ||
    typeof decidedAt !== "string" ||
    Number.isNaN(Date.parse(decidedAt))
  ) {
    return null;
  }
  return { decision, version, decidedAt };
}

/** A record is honoured for 6 months and only for the current consent version (11 §7). */
export function isConsentValid(
  record: CookieConsentRecord,
  now: Date = new Date(),
): boolean {
  if (record.version !== COOKIE_CONSENT_VERSION) {
    return false;
  }
  const ageSeconds = (now.getTime() - Date.parse(record.decidedAt)) / 1000;
  return ageSeconds >= 0 && ageSeconds < COOKIE_CONSENT_MAX_AGE_SECONDS;
}

export function createConsent(
  decision: CookieConsentDecision,
  now: Date = new Date(),
): CookieConsentRecord {
  return {
    decision,
    version: COOKIE_CONSENT_VERSION,
    decidedAt: now.toISOString(),
  };
}

// Session-scoped store. Lot 1 replaces the two functions below by a read/write of the
// COOKIE_CONSENT_NAME cookie (max age COOKIE_CONSENT_MAX_AGE_SECONDS, SameSite=Lax, Secure),
// keeping this exact signature.
let sessionConsent: string | null = null;

/** Returns the valid stored choice, or null when the banner must be shown. */
export function readStoredConsent(
  now: Date = new Date(),
): CookieConsentRecord | null {
  if (typeof window === "undefined") {
    // Never decide on the server: the choice belongs to the browser (11 §7).
    return null;
  }
  const record = parseConsent(sessionConsent);
  return record && isConsentValid(record, now) ? record : null;
}

/** Stores the choice. Failing to store is not an error for the visitor (11 §6.3). */
export function writeStoredConsent(record: CookieConsentRecord): void {
  sessionConsent = serializeConsent(record);
}
