// The closed vocabularies of the verification (docs/mvp/08 RG11, RG70, RG73; jalons/l2e/modele.md §3):
// levels, states of a request, states of a badge, the evidence states. The database holds the same
// lists as enums (0221); `packages/contracts/src/verification.ts` repeats them (it carries no
// dependency on this package) and `apps/api/tests/domain-guards.test.ts` holds the two equal.
// A badge says WHAT was observed, WHERE and WHEN, never WHO: no identifier is part of any list here.

/** The three levels, and only three (RG11). Account and audience are per network, the brand per account. */
export const VERIFICATION_LEVELS = [
  "account_verified",
  "audience_verified",
  "brand_verified",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

/** `verification.request_status` (0221). `pending` is the only state the queue lists (D81). */
export const VERIFICATION_REQUEST_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "closed",
] as const;
export type VerificationRequestStatus =
  (typeof VERIFICATION_REQUEST_STATUSES)[number];

/** `verification.badge_state` (0221; RG70, RG78). Only the first three are ever displayed. */
export const VERIFICATION_BADGE_STATES = [
  "active",
  "to_refresh",
  "to_reconfirm",
  "expired",
  "revoked",
  "replaced",
] as const;
export type VerificationBadgeState = (typeof VERIFICATION_BADGE_STATES)[number];

/** `verification.evidence_state` (0221, 0223): what a member may read of his pieces is this and a date. */
export const VERIFICATION_EVIDENCE_STATES = [
  "pending",
  "active",
  "purging",
  "purged",
] as const;
export type VerificationEvidenceState =
  (typeof VERIFICATION_EVIDENCE_STATES)[number];

/** The levels a creator asks for, on one network line (RG11, RG14). */
export const CREATOR_VERIFICATION_LEVELS = [
  "account_verified",
  "audience_verified",
] as const;
export type CreatorVerificationLevel =
  (typeof CREATOR_VERIFICATION_LEVELS)[number];

/** Where the evidence of a badge comes from (`verification.badges.evidence_source`, 0221). */
export const VERIFICATION_EVIDENCE_SOURCES = [
  "public_profile",
  "native_dashboard",
  "domain_and_registry",
] as const;
export type VerificationEvidenceSource =
  (typeof VERIFICATION_EVIDENCE_SOURCES)[number];
