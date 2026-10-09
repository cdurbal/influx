// The closed list of elevated operations (docs/mvp/03-matrice-des-droits-et-rls.md §4 P7 and
// §6.7; 18 T6). Only these operations may call withElevatedTransaction (apps/api/src/db/).
//
// Two lists, on purpose:
// - SIGNED_ELEVATED_OPERATIONS (set P of 18 T6): the list signed by expert-cybersecurite in 03 P7.
//   Changing it is a change of 03, signed by expert-cybersecurite.
// - ELEVATED_OPERATIONS (set U of 18 T6): the operations that have a caller in the code. An
//   operation enters U in the commit that introduces its first caller (E-1 and E-2 at J3, E-3 at
//   J6, E-4 with the first periodic task, E-5 at Lot 5). At J2, U is EMPTY: the mechanism exists
//   and is tested, but no operation can be run.

/**
 * Set P: 03 P7, E-1 to E-5, one motif per point of use (EC-5, signed revision of 2026-09-27).
 * E-6 enters with its migration (0016, J4), signed by expert-cybersecurite on 2026-10-06
 * (end-of-J4 grouped review). identity.read_published_terms enters E-1 at J5 (21 EC-62), to be
 * signed at the end-of-J5 grouped review.
 */
export const SIGNED_ELEVATED_OPERATIONS = [
  "identity.request_code", // E-1, influx_auth
  "support.report_delivery_issue", // E-1, influx_auth (J5, 05 RG65)
  "identity.read_published_terms", // E-1, influx_auth (J5, 21 EC-62, identity.terms_in_force() only)
  "identity.verify_code", // E-2, influx_auth
  "identity.complete_signup", // E-2, influx_auth (J5)
  "identity.backoffice_sign_in", // E-2, influx_auth
  "identity.backoffice_enroll_totp", // E-2, influx_auth
  "identity.backoffice_reauthenticate", // E-2, influx_auth
  "leads.drain_outbox", // E-3, influx_worker
  "maintenance.run_periodic", // E-4, influx_worker
  "privacy.execute_request", // E-5, influx_privacy
  "ops.record_telemetry", // E-6, influx_ops (J4, D60: errors and metrics, never business data)
] as const;

export type SignedElevatedOperation =
  (typeof SIGNED_ELEVATED_OPERATIONS)[number];

/**
 * Set U: operations with a caller (18 T6.1: A = U). E-1 enters with the login code, E-2 with its
 * verification and the backoffice sign-in (J3 commits 8 to 10); the public documents at J5 (EC-62),
 * then the sign-up (J5 commit 4, POST /v1/signup); E-3 with the worker's access to the queue (J6
 * commit 2, apps/api/src/domains/leads/queue.ts, migration 0111).
 */
export const ELEVATED_OPERATIONS = [
  "identity.request_code",
  "identity.read_published_terms",
  "identity.verify_code",
  "identity.complete_signup",
  "identity.backoffice_sign_in",
  "identity.backoffice_enroll_totp",
  "identity.backoffice_reauthenticate",
  "leads.drain_outbox",
  "ops.record_telemetry",
] as const satisfies readonly SignedElevatedOperation[];

export type ElevatedOperation = (typeof ELEVATED_OPERATIONS)[number];

/** Runtime check: the type alone is not a guarantee (a cast passes the compiler, 18 T6.2). */
export function isElevatedOperation(
  value: unknown,
): value is ElevatedOperation {
  return (ELEVATED_OPERATIONS as readonly unknown[]).includes(value);
}
