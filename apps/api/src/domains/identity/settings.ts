// Settings of the member authentication (docs/mvp/02 §18.4 G1 and G3; 05 RG44, RG136, RG137; 21
// §4, J3-C rule 6, EC-3, EC-21). Constants of the identity domain at J3; they move to the database
// with the settings of EC-8 if the need "without redeployment" of 02 §18.4 is confirmed.

/** G3: no answer to a code request before this many milliseconds, whatever the outcome. */
export const CODE_REQUEST_FLOOR_MS = 1_000;

/** G1: cumulated bound of steps 5 and 6 of 02 §18.10 (user creation, code generation). */
export const GOTRUE_CODE_BUDGET_MS = 2_000;

/** 05 RG44: code requests per address and per IP. */
export const CODE_REQUESTS_PER_EMAIL_15_MIN = 3;
export const CODE_REQUESTS_PER_EMAIL_HOUR = 10;
export const CODE_REQUESTS_PER_IP_HOUR = 20;

/**
 * EC-21: a request without a valid client address counts on ONE global counter with a strict
 * ceiling. The value is that of the backoffice (EC-47: 10 per hour): no value is written for the
 * member code; the most conservative one is taken (21 §3, EC-58).
 */
export const CODE_REQUESTS_UNKNOWN_IP_HOUR = 10;

/** 05 RG42, EC-3: attempts per code, reserved before GoTrue is called. */
export const CODE_ATTEMPTS = 5;

/** 05 RG40, RG136: a code is valid ten minutes from its request. */
export const CODE_VALIDITY_SECONDS = 600;

/** 05 RG44, EC-3 point 5: failed verifications per IP and per hour, checked before the call. */
export const CODE_VERIFY_FAILURES_PER_IP_HOUR = 20;

/** J3-C rule 6: bound of the verification by GoTrue. */
export const CODE_VERIFY_TIMEOUT_MS = 2_000;

/** EC-3 point 6 (A-3): platform failures in 15 min that raise security.verify_failure_spike. */
export const VERIFY_FAILURE_SPIKE = 100;

/** 03 §6.1, 05 RG54: the sliding expiry of a member session, 30 days (Max-Age of its cookie). */
export const MEMBER_SESSION_IDLE_SECONDS = 30 * 24 * 60 * 60;

// --- Backoffice sign-in (03 §6.1 B-1 to B-8, §6.9; 21 J3-C rules 4 and 6, EC-40, EC-47) -------

/** EC-40 point 3: no answer of the sign-in, the enrollment or R before this, whatever the outcome. */
export const BACKOFFICE_AUTH_FLOOR_MS = 1_500;

/** J3-C rule 6: all the GoTrue calls of one backoffice request, in total. */
export const BACKOFFICE_GOTRUE_BUDGET_MS = 5_000;

/** J3-C rule 6: bound of each GoTrue call of a backoffice request, within the total budget. */
export const BACKOFFICE_GOTRUE_CALL_TIMEOUT_MS = 2_000;

/** EC-47: attempts per couple (address, IP) in 15 minutes, reserved before GoTrue. */
export const BACKOFFICE_ATTEMPTS_PER_EMAIL_IP_15_MIN = 5;

/** EC-47: attempts per IP (/32, /64) and per hour. */
export const BACKOFFICE_ATTEMPTS_PER_IP_HOUR = 20;

/** EC-47: attempts per hour of all requests without a valid client address, every address. */
export const BACKOFFICE_ATTEMPTS_UNKNOWN_IP_HOUR = 10;

/** EC-47, A-4: failures per address and per hour that raise an alert, never a block. */
export const BACKOFFICE_FAILURES_PER_EMAIL_ALERT = 10;

/** EC-47: failures of the platform per hour that raise an error line (alert at J9). */
export const BACKOFFICE_FAILURES_PLATFORM_ALERT = 30;

/** EC-40 point 5: failed re-authentications of one session in 15 minutes that revoke it. */
export const REAUTHENTICATION_FAILURES_PER_SESSION = 5;

/**
 * J3S-1: attempts of R one session may reserve in 15 minutes, BEFORE GoTrue (the counter of the
 * failures above, request_count of its row): parallel requests never outrun the revocation.
 */
export const REAUTHENTICATION_ATTEMPTS_PER_SESSION = 5;

/**
 * J8S-6 (0143): attempts of R per IP (/32, /64) and per hour, in a bucket apart from the sign-in's
 * (20 / h): a team confirming its actions from one network never locks that network's sign-in.
 */
export const REAUTHENTICATION_ATTEMPTS_PER_IP_HOUR = 60;

/** EC-40 point 2: R holds while the last TOTP proof of the session is at most this old. */
export const REAUTHENTICATION_FRESHNESS_SECONDS = 300;

/**
 * J7 decision 4 (provisional): a member's fresh code serves its action this long, once. Written as
 * a literal in 0118 identity.consume_member_reauthentication(); t8-reauth-email-change ties the
 * two. Distinct from R of the backoffice, which only shares its value today.
 */
export const MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS = 300;

/** 03 §6.1, J3-C rule 8: the absolute bound of a backoffice session, the Max-Age of its cookie. */
export const BACKOFFICE_SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;

/** EC-56: the constant name under which a TOTP factor is enrolled, and its issuer. */
export const TOTP_FACTOR_NAME = "INFLUX";
export const TOTP_ISSUER = "INFLUX";

/** J3-A d, B-1 point 3: bound of the k-anonymity lookup of a new password. */
export const PWNED_PASSWORDS_TIMEOUT_MS = 2_000;

/**
 * 05 RG65, J7 decision 6: the rescue channel. The same answer, never before this many milliseconds
 * (like G3), on its own counters (0115: never those of the code). Per network, then per sign-in
 * address; a request without a valid client address counts on one global counter (EC-21).
 * Values fixed by expert-cybersecurite on 2026-10-14 (no global ceiling on known addresses: one
 * attacker would close the channel for everybody).
 */
export const DELIVERY_REPORT_FLOOR_MS = 1_000;
export const DELIVERY_REPORTS_PER_IP_HOUR = 5;
export const DELIVERY_REPORTS_UNKNOWN_IP_HOUR = 10;
export const DELIVERY_REPORTS_PER_EMAIL_HOUR = 3;
