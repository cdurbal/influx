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
 * signed at the end-of-J5 grouped review. leads.receive_brevo_event (E-1) and
 * identity.member_reauthenticate (E-2) enter with their codes at J7 (0115, decisions 2 and 4), and
 * identity.member_email_change (E-1) with its code at J7 commit 7 (0123, decision 5: the journal of
 * the two codes of an address change), to be signed at the end-of-J7 grouped review.
 */
export const SIGNED_ELEVATED_OPERATIONS = [
  "identity.request_code", // E-1, influx_auth
  "support.report_delivery_issue", // E-1, influx_auth (J5, 05 RG65)
  "identity.read_published_terms", // E-1, influx_auth (J5, 21 EC-62, identity.terms_in_force() only)
  "leads.receive_brevo_event", // E-1, influx_auth (J7 decision 2, leads.record_brevo_event() only)
  "identity.verify_code", // E-2, influx_auth
  "identity.complete_signup", // E-2, influx_auth (J5)
  "identity.backoffice_sign_in", // E-2, influx_auth
  "identity.backoffice_enroll_totp", // E-2, influx_auth
  "identity.backoffice_reauthenticate", // E-2, influx_auth
  "identity.member_reauthenticate", // E-2, influx_auth (J7 decision 4)
  "identity.member_email_change", // E-1, influx_auth (J7 decision 5, the journal of the two codes)
  "leads.drain_outbox", // E-3, influx_worker
  "maintenance.run_periodic", // E-4, influx_worker
  "privacy.execute_request", // E-5, influx_privacy
  "ops.record_telemetry", // E-6, influx_ops (J4, D60: errors and metrics, never business data)
] as const;

export type SignedElevatedOperation =
  (typeof SIGNED_ELEVATED_OPERATIONS)[number];

/**
 * The operations of P whose pool is not the one of their family (03 P7 rule 5). The Brevo webhook
 * is received by the api (E-1) although leads.* runs on the worker: the database binds it the same
 * way (audit.append_elevated(), 0115, J6S-2). Declared here, next to P, so that no module reachable
 * from the worker names an operation of the api (18 T6.3).
 */
export const ELEVATED_POOL_EXCEPTIONS: Readonly<
  Partial<Record<SignedElevatedOperation, "auth">>
> = {
  "leads.receive_brevo_event": "auth",
};

/**
 * Set U: operations with a caller (18 T6.1: A = U). E-1 enters with the login code, E-2 with its
 * verification and the backoffice sign-in (J3 commits 8 to 10); the public documents at J5 (EC-62),
 * then the sign-up (J5 commit 4, POST /v1/signup); E-3 with the worker's access to the queue (J6
 * commit 2, apps/api/src/domains/leads/queue.ts, migration 0111); the Brevo webhook (J7 commit 3,
 * apps/api/src/domains/leads/brevo-webhook.ts, migration 0116); E-4 with the periodic tasks (J7
 * commit 5, apps/api/src/domains/maintenance/periodic.ts, migration 0117); the re-authentication
 * and the address change of a member (J7 commit 7, apps/api/src/domains/identity/reauthentication.ts
 * and email-change.ts, migrations 0118 and 0123).
 */
export const ELEVATED_OPERATIONS = [
  "identity.request_code",
  "identity.read_published_terms",
  "identity.verify_code",
  "identity.complete_signup",
  "identity.backoffice_sign_in",
  "identity.backoffice_enroll_totp",
  "identity.backoffice_reauthenticate",
  "identity.member_reauthenticate",
  "identity.member_email_change",
  "leads.receive_brevo_event",
  "leads.drain_outbox",
  "maintenance.run_periodic",
  "ops.record_telemetry",
] as const satisfies readonly SignedElevatedOperation[];

export type ElevatedOperation = (typeof ELEVATED_OPERATIONS)[number];

/** Runtime check: the type alone is not a guarantee (a cast passes the compiler, 18 T6.2). */
export function isElevatedOperation(
  value: unknown,
): value is ElevatedOperation {
  return (ELEVATED_OPERATIONS as readonly unknown[]).includes(value);
}
