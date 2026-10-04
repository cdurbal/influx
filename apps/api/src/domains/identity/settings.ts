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
