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
