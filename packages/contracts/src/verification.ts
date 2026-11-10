// Contract of the verification, « Compte vérifié », « Audience vérifiée », « Marque vérifiée »
// (docs/mvp/08 RG1 to RG14, RG25, RG36 to RG42, RG56 to RG59, RG82, RG89, RG90, RG96; 06 RG49 to
// RG56; jalons/l2e-fiche.md invariants 1, 6, 8, 9, 11, 13, 15, 17; jalons/l2e/modele.md §3, §4, §6;
// commit 11). Shared by apps/api, apps/web and apps/backoffice. Two families, never mixed:
// - the MEMBER side (a creator, a brand, and the public badge an advertiser will read): every object
//   is closed, and none carries an evidence key, a review token, an agent, a lock, an internal
//   comment, a gap, or an identifier of a network. A member reads the METADATA of his own pieces,
//   never their bytes (EC-L2E-7); the account is always the session's and no route takes one (T14).
// - the AGENT side: the bodies of the decisions, bound to the version examined (`reviewToken`). The
//   handle an agent types is a body field only, never a field of any answer a member reads.
// Nothing here carries an amount, a rate, a commission or a tariff (D48, D78, 08 RG8). The code lists
// repeat packages/domain's (this package carries no dependency on it); a test holds them equal.
// The queue entries and the decision view are the contract of commit 14 (last section), the registry
// sources that of commit 15.
import { z } from "./zod.ts";
import { accountOwnerSchema } from "./backoffice-accounts.ts";
import { uiLocaleSchema } from "./auth.ts";
import {
  entryClaimSchema,
  forcedReleaseSchema,
  openOutcomeSchema,
  QUEUE_PAGE_SIZE_DEFAULT,
  QUEUE_PAGE_SIZE_MAX,
  queueCursorSchema,
} from "./backoffice-queues.ts";
import { countryCodeSchema } from "./signup.ts";

const instantSchema = z.iso.datetime();
/** A calendar day, "YYYY-MM-DD", on the UTC date (08 RG37). */
const calendarDaySchema = z.iso.date();
/** The version of the request the agent examined (0224): the one the opening returned, as is. */
const reviewTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
/** A code of a `reference.*` table: snake_case, at most 63 characters (0201). */
export const referenceCodeSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

// ---------------------------------------------------------------------------------------------
// Closed lists (0221), twins of packages/domain/src/verification/levels.ts
// ---------------------------------------------------------------------------------------------

export const VERIFICATION_LEVELS = [
  "account_verified",
  "audience_verified",
  "brand_verified",
] as const;
export const verificationLevelSchema = z.enum(VERIFICATION_LEVELS);
export type VerificationLevel = z.infer<typeof verificationLevelSchema>;

/** The two levels a creator asks for, on one network line (08 RG11, RG14). */
export const CREATOR_VERIFICATION_LEVELS = [
  "account_verified",
  "audience_verified",
] as const;
export const creatorVerificationLevelSchema = z.enum(
  CREATOR_VERIFICATION_LEVELS,
);
export type CreatorVerificationLevel = z.infer<
  typeof creatorVerificationLevelSchema
>;

export const VERIFICATION_REQUEST_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "closed",
] as const;
export const verificationRequestStatusSchema = z.enum(
  VERIFICATION_REQUEST_STATUSES,
);
export type VerificationRequestStatus = z.infer<
  typeof verificationRequestStatusSchema
>;

export const VERIFICATION_BADGE_STATES = [
  "active",
  "to_refresh",
  "to_reconfirm",
  "expired",
  "revoked",
  "replaced",
] as const;
export const verificationBadgeStateSchema = z.enum(VERIFICATION_BADGE_STATES);
export type VerificationBadgeState = z.infer<
  typeof verificationBadgeStateSchema
>;

/** The states a badge is ever shown in: expired, revoked and replaced ones disappear (08 RG70, RG76). */
export const DISPLAYED_BADGE_STATES = [
  "active",
  "to_refresh",
  "to_reconfirm",
] as const;
export const displayedBadgeStateSchema = z.enum(DISPLAYED_BADGE_STATES);

export const VERIFICATION_EVIDENCE_STATES = [
  "pending",
  "active",
  "purging",
  "purged",
] as const;
export const verificationEvidenceStateSchema = z.enum(
  VERIFICATION_EVIDENCE_STATES,
);
export type VerificationEvidenceState = z.infer<
  typeof verificationEvidenceStateSchema
>;

export const VERIFICATION_EVIDENCE_SOURCES = [
  "public_profile",
  "native_dashboard",
  "domain_and_registry",
] as const;
export const verificationEvidenceSourceSchema = z.enum(
  VERIFICATION_EVIDENCE_SOURCES,
);

/**
 * The refusals of a creator request (`verification.rejection_reasons`, population `creator`, 0221;
 * 08 RG56, RG57, RG59): a closed list, a refusal never goes without one. `minor` stops everything;
 * `other` and `terms_breach` ask for the agent's own message.
 */
export const CREATOR_REJECTION_REASON_CODES = [
  "missing_evidence",
  "evidence_too_old",
  "evidence_unreadable",
  "evidence_wrong_source",
  "evidence_too_wide",
  "ownership_not_proven",
  "account_not_public",
  "ownership_prerequisite",
  "evidence_inconsistent",
  "evidence_suspected_forgery",
  "shared_account",
  "agency_managed",
  "terms_breach",
  "minor",
  "account_unavailable",
  "other",
] as const;
export const creatorRejectionReasonCodeSchema = z.enum(
  CREATOR_REJECTION_REASON_CODES,
);
export type CreatorRejectionReasonCode = z.infer<
  typeof creatorRejectionReasonCodeSchema
>;

/** The refusals of a brand request (population `brand`, 0221; l2e/modele.md §5, EC-L2E-11). */
export const BRAND_REJECTION_REASON_CODES = [
  "domain_code_not_found",
  "registration_not_found",
  "registration_unverifiable_country",
  "name_mismatch",
  "account_unavailable",
  "other",
] as const;
export const brandRejectionReasonCodeSchema = z.enum(
  BRAND_REJECTION_REASON_CODES,
);
export type BrandRejectionReasonCode = z.infer<
  typeof brandRejectionReasonCodeSchema
>;

/** Any refusal reason, as an agent sends it: the database says which list the request belongs to. */
export const verificationRejectionReasonCodeSchema = z.union([
  creatorRejectionReasonCodeSchema,
  brandRejectionReasonCodeSchema,
]);

/** « À réexaminer » (modele §1 point 2): an internal reason, the request stays pending (RG50). */
export const VERIFICATION_REEXAMINE_REASON_CODES = [
  "network_unreachable",
  "evidence_technical",
  "registry_unavailable",
  "storage_unavailable",
] as const;
export const verificationReexamineReasonCodeSchema = z.enum(
  VERIFICATION_REEXAMINE_REASON_CODES,
);

/** How a code of a brand is found online (0221, `ownership_codes.observed_channel`). */
export const BRAND_OBSERVED_CHANNELS = ["dns_txt", "web_page"] as const;
export const brandObservedChannelSchema = z.enum(BRAND_OBSERVED_CHANNELS);

/**
 * Every channel a constat on a brand's code is recorded with (0234): the two an agent types after
 * reading the domain, and `login_address` (D83 A-bis), which only the database writes, from the
 * verified login address of the account, on its own route (`grant-by-login`). A decision typed by
 * the agent accepts the first two alone (`brandObservedChannelSchema`).
 */
export const BRAND_CONSTAT_CHANNELS = [
  ...BRAND_OBSERVED_CHANNELS,
  "login_address",
] as const;
export const brandConstatChannelSchema = z.enum(BRAND_CONSTAT_CHANNELS);

// ---------------------------------------------------------------------------------------------
// The cycle of the badge (jalons/l2f; 0230 to 0235), twins of packages/domain/src/verification
// (badge-revocation, badge-dispute, agent-opening): this package carries no dependency on it, and
// apps/api/tests/domain-guards.test.ts holds the lists equal, db-tests/verification-domain-parity
// holds them equal to the tables.
// ---------------------------------------------------------------------------------------------

/** `verification.revocation_reasons.code`, in the order of `position` (0231; 08 RG73; 06 RG55). */
export const REVOCATION_REASON_CODES = [
  "forged_evidence",
  "account_closed",
  "owner_changed",
  "terms_breach",
  "influx_error",
  "company_dissolved",
  "domain_transferred",
] as const;
export const revocationReasonCodeSchema = z.enum(REVOCATION_REASON_CODES);
export type RevocationReasonCode = z.infer<typeof revocationReasonCodeSchema>;

/**
 * The effective state of the 2V of a withdrawal (0231 `dual_control_status_for`): `consumed` once the
 * withdrawal ran, `expired` past 24 h without effect, else the state of the request.
 */
export const REVOCATION_REQUEST_STATES = [
  "pending",
  "confirmed",
  "degraded",
  "cancelled",
  "consumed",
  "expired",
] as const;
export const revocationRequestStateSchema = z.enum(REVOCATION_REQUEST_STATES);

/** `verification.dispute_reasons.code`, in the order of `position` (0232): `other` asks for the text. */
export const DISPUTE_REASON_CODES = [
  "misread",
  "evidence_valid",
  "reason_wrong",
  "other",
] as const;
export const disputeReasonCodeSchema = z.enum(DISPUTE_REASON_CODES);
export type DisputeReasonCode = z.infer<typeof disputeReasonCodeSchema>;

/** `verification.dispute_state` (0232). */
export const DISPUTE_STATES = [
  "open",
  "upheld",
  "overturned",
  "withdrawn",
] as const;
export const disputeStateSchema = z.enum(DISPUTE_STATES);
export type DisputeState = z.infer<typeof disputeStateSchema>;

/** The two outcomes of a contest (08 RG77, CA53). */
export const DISPUTE_OUTCOMES = ["upheld", "overturned"] as const;
export const disputeOutcomeSchema = z.enum(DISPUTE_OUTCOMES);

/** `verification.dispute_outcome_reasons.code`, in the order of `position` (0232). */
export const DISPUTE_OUTCOME_REASON_CODES = [
  "decision_confirmed",
  "new_request_needed",
  "other",
  "decision_overturned",
] as const;
export const disputeOutcomeReasonCodeSchema = z.enum(
  DISPUTE_OUTCOME_REASON_CODES,
);
export type DisputeOutcomeReasonCode = z.infer<
  typeof disputeOutcomeReasonCodeSchema
>;
/** The motives of an upheld contest, the only ones an agent upholds with. */
export const DISPUTE_UPHELD_OUTCOME_REASON_CODES = [
  "decision_confirmed",
  "new_request_needed",
  "other",
] as const;
export const disputeUpheldOutcomeReasonCodeSchema = z.enum(
  DISPUTE_UPHELD_OUTCOME_REASON_CODES,
);

/** What a contest contests: the refusal of a request, or the withdrawal of a badge (0232 `kind`). */
export const DISPUTE_KINDS = ["refusal", "revocation"] as const;
export const disputeKindSchema = z.enum(DISPUTE_KINDS);

/** `disputes.review_mode` (0232): another person judged it, or the decider after the reflection delay. */
export const DISPUTE_REVIEW_MODES = ["independent", "delayed"] as const;
export const disputeReviewModeSchema = z.enum(DISPUTE_REVIEW_MODES);

/** `disputes.withdrawn_cause` (0232): why a contest left the queue without an outcome. */
export const DISPUTE_WITHDRAWN_CAUSES = [
  "superseded",
  "line_deleted",
  "account_erased",
] as const;
export const disputeWithdrawnCauseSchema = z.enum(DISPUTE_WITHDRAWN_CAUSES);

/** `verification.identifier_review_state` (0233) of an entry of queue 6. */
export const IDENTIFIER_REVIEW_STATES = [
  "open",
  "confirmed",
  "proof_required",
  "withdrawn",
] as const;
export const identifierReviewStateSchema = z.enum(IDENTIFIER_REVIEW_STATES);

/** `identifier_change_reviews.withdrawn_cause` (0233). */
export const IDENTIFIER_WITHDRAWN_CAUSES = [
  "reverted",
  "line_deleted",
  "badge_ended",
  "account_erased",
] as const;
export const identifierWithdrawnCauseSchema = z.enum(
  IDENTIFIER_WITHDRAWN_CAUSES,
);

/** Who opened a request (0234 `opened_by`) and the reasons of an agent (`opening_reasons`, D83 A). */
export const VERIFICATION_OPENERS = ["member", "agent"] as const;
export const verificationOpenerSchema = z.enum(VERIFICATION_OPENERS);
export const OPENING_REASON_CODES = [
  "invited_by_agent",
  "existing_client",
  "past_collaboration",
  "other",
] as const;
export const openingReasonCodeSchema = z.enum(OPENING_REASON_CODES);
export type OpeningReasonCode = z.infer<typeof openingReasonCodeSchema>;

/** The text of a contest (0232: 1 to 1 000 printable characters), the twin of the domain's. */
export const VERIFICATION_DISPUTE_TEXT_MAX_LENGTH = 1000;

/**
 * The refusals of the verification routes, as the `issue` of the details of the error envelope
 * (the database says them by MESSAGE, 0222, 0224; a value in DETAIL for `duplicate_request`, a date,
 * and `retry_after`, seconds, which travel as `Retry-After`, never in the body). 409 unless said.
 * `ownership_prerequisite` is written before the button (08 RG12), `handle_already_verified` is an
 * outcome of a decision, not an error. `code_expired` (0222, EC-L2E-06-3): an account request is
 * submitted with a live code only. `evidence_cap` (0223, 08 RG34): the request already holds its six
 * pieces; one must be removed before another is deposited (not a daily quota: no Retry-After).
 * Commit 14, the agent's side: `account_unavailable` (the account is no longer active: the agent closes
 * the request with that reason, EC-L2E-08-5), `website_domain_required`, `internal_details_required`
 * and `declared_figures_required` (a block the decision reads is missing, 23514), and
 * `decision_blocked` (503, path `evidence`: Storage does not answer, the audience decision waits,
 * D82 (5)). Commit 15: `active_source_exists` (a second active registry source for one country: the
 * administrator deactivates the first one before, 06 RG52).
 */
export const VERIFICATION_REFUSAL_ISSUES = [
  "duplicate_request",
  "retry_after",
  "rejection_cap",
  "ownership_prerequisite",
  "already_verified",
  "request_not_draft",
  "missing_evidence",
  "stale_token",
  "entry_closed",
  "no_registry_source",
  "code_expired",
  "evidence_cap",
  "account_unavailable",
  "website_domain_required",
  "internal_details_required",
  "declared_figures_required",
  "decision_blocked",
  "active_source_exists",
  // L2F (0230 to 0234), all 409: the badge to withdraw is not held, or a withdrawal is already
  // asked; the contest of a decision (not contestable, past its window with the closing instant in
  // the detail, already contested); the review of another person (the decider, or the reflection
  // delay, seconds in the detail); the badge given back would be past its date; a line deleted; a
  // handle already verified elsewhere (an outcome of the grant, an error of the identifier change);
  // the login address does not prove the domain (`unverified`, `consumer_domain`, `other_domain`).
  "badge_not_holding",
  "revocation_pending",
  "not_disputable",
  "dispute_window_closed",
  "already_disputed",
  "reviewer_is_decider",
  "reflection_delay",
  "restore_expired",
  "line_deleted",
  "handle_already_verified",
  "login_address_ineligible",
] as const;
export const verificationRefusalIssueSchema = z.enum(
  VERIFICATION_REFUSAL_ISSUES,
);
export type VerificationRefusalIssue = z.infer<
  typeof verificationRefusalIssueSchema
>;

// ---------------------------------------------------------------------------------------------
// Bounds the database holds (0221, 0222, 0224), twins of packages/domain/src/verification/limits.ts
// ---------------------------------------------------------------------------------------------

export const VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH = 100;
export const VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH = 1000;
export const VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH = 20;
export const VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH = 500;
export const VERIFICATION_LEGAL_NAME_MAX_LENGTH = 160;
export const VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH = 40;
export const VERIFICATION_POSTS_LAST_30_DAYS_MAX = 2_147_483_647;
export const VERIFICATION_ENGAGEMENT_BP_MAX = 10_000;

/**
 * The deposit of a piece (D82 (1) to (3), 08 RG34; 0221, 0223): the raw bytes of ONE image, 8 MiB at
 * most (the only exception to the 2 MiB of the relay), re-encoded into a WebP of the same pixels.
 */
export const VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES = 8_388_608;
/** The stored WebP, at most (the limit of the bucket verification-evidence, 0223). */
export const VERIFICATION_EVIDENCE_MAX_STORED_BYTES = 8_388_608;
/** The longest side of the image must reach it (D82 (2), `evidence_files_sides`). */
export const VERIFICATION_EVIDENCE_MIN_SIDE = 320;
/** The longest side WebP can hold (D82 (2), `evidence_files_sides`). */
export const VERIFICATION_EVIDENCE_MAX_SIDE = 16_383;

/**
 * The reasons of an `image_rejected` (path `evidence`) of a piece (CA21: images only): no bytes, a
 * type other than PNG, JPEG or WebP (PDF and SVG included, T9.4), bytes that do not decode, more than
 * 4 096² pixels or a side over 16 383, a longest side under 320 px, an output over 8 MiB.
 */
export const VERIFICATION_EVIDENCE_REJECTIONS = [
  "empty",
  "unsupported_type",
  "undecodable",
  "too_many_pixels",
  "too_small",
  "output_too_large",
] as const;
export type VerificationEvidenceRejection =
  (typeof VERIFICATION_EVIDENCE_REJECTIONS)[number];

/** `INFLUX-` and eight signs of 31 (0222): no link, no coordinate, nothing that reads as another sign. */
export const ownershipCodeSchema = z
  .string()
  .regex(/^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

// ---------------------------------------------------------------------------------------------
// MEMBER side: the public badge, and the views of a creator and of a brand on their own requests
// ---------------------------------------------------------------------------------------------

/**
 * What a badge says in public (08 RG1, RG4, RG5, RG89, RG90): the level, the network, the date, and
 * for the audience the period and the source. Never a handle, an URL, an agent, a gap, a reason.
 * `networkCode` is null for a brand (the badge is per account). An advertiser reads displayed states
 * `active` and `to_refresh` only (08 RG78: to reconfirm is the owner's).
 */
export const publicBadgeSchema = z.strictObject({
  level: verificationLevelSchema,
  networkCode: referenceCodeSchema.nullable(),
  state: z.enum(["active", "to_refresh"]),
  /** The date of the decision: it accompanies the badge everywhere (08 RG4). */
  grantedAt: instantSchema,
  /** The period the figures cover, audience level only (08 RG5). */
  periodStart: calendarDaySchema.nullable(),
  periodEnd: calendarDaySchema.nullable(),
  evidenceSource: verificationEvidenceSourceSchema,
});
export type PublicBadge = z.infer<typeof publicBadgeSchema>;

/** A badge as its owner reads it: the same facts, and the dates that tell him what to do next. */
export const ownBadgeSchema = z.strictObject({
  level: verificationLevelSchema,
  networkCode: referenceCodeSchema.nullable(),
  state: displayedBadgeStateSchema,
  grantedAt: instantSchema,
  periodStart: calendarDaySchema.nullable(),
  periodEnd: calendarDaySchema.nullable(),
  evidenceSource: verificationEvidenceSourceSchema,
  /** 90 days after the decision for the audience (08 RG69), 12 months for a brand (06 RG54). */
  expiresAt: instantSchema.nullable(),
  /**
   * The instant a badge « à rafraîchir » or « à reconfirmer » disappears: `expiresAt` and
   * `badge_grace_days` (08 RG70, `graceEndsAt` of packages/domain); null for an active badge.
   * Always present since L2F commit 13 (the routes of both populations serve it).
   */
  graceEndsAt: instantSchema.nullable(),
});
export type OwnBadge = z.infer<typeof ownBadgeSchema>;

/**
 * A piece of the member, metadata only (EC-L2E-7): no key, no checksum, no retention date, no
 * original name (never received, 18 T9.9). Its id names it for its removal and for nothing else.
 */
export const ownEvidenceSchema = z.strictObject({
  id: z.uuid(),
  state: verificationEvidenceStateSchema,
  createdAt: instantSchema,
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
});
export type OwnEvidence = z.infer<typeof ownEvidenceSchema>;

/** The code the member pastes in his bio (network) or his domain (brand); valid until `expiresAt` (08 RG21 to RG23). */
export const ownCodeSchema = z.strictObject({
  code: ownershipCodeSchema,
  expiresAt: instantSchema,
});
export type OwnCode = z.infer<typeof ownCodeSchema>;

/**
 * The refusal of a request, as its owner reads it (08 RG56, RG58, CA32): the reason, and the text of
 * the e-mail he receives for it. The internal comment, the agent and the figures are not here.
 */
export const ownRefusalSchema = z.strictObject({
  reasonCode: verificationRejectionReasonCodeSchema,
  /** What was sent to him: the translated message of the reason, or the agent's own for `other`. */
  message: z.string(),
  decidedAt: instantSchema,
});
export type OwnRefusal = z.infer<typeof ownRefusalSchema>;

/** One request of the member, without lock, agent, comment, reexamination or escalation (invariant 15). */
export const ownRequestSchema = z.strictObject({
  id: z.uuid(),
  level: verificationLevelSchema,
  status: verificationRequestStatusSchema,
  networkCode: referenceCodeSchema.nullable(),
  createdAt: instantSchema,
  submittedAt: instantSchema.nullable(),
  /** The live code of a request that asks for one; null once the request is decided. */
  code: ownCodeSchema.nullable(),
  evidence: z.array(ownEvidenceSchema),
  refusal: ownRefusalSchema.nullable(),
});
export type OwnRequest = z.infer<typeof ownRequestSchema>;

/** One network line of the creator: what is verified on it and what is asked (08 RG13). */
export const creatorVerificationLineSchema = z.strictObject({
  networkCode: referenceCodeSchema,
  badges: z.array(ownBadgeSchema),
  requests: z.array(ownRequestSchema),
});
export type CreatorVerificationLine = z.infer<
  typeof creatorVerificationLineSchema
>;

/** `GET /v1/me/verification` (creator): his lines, network by network; no badge is global (08 RG13). */
export const creatorVerificationResponseSchema = z.strictObject({
  asOf: instantSchema,
  lines: z.array(creatorVerificationLineSchema),
});
export type CreatorVerificationResponse = z.infer<
  typeof creatorVerificationResponseSchema
>;

/** `POST /v1/me/verification/requests`: the line is named by its network, never by an identifier. */
export const openVerificationRequestBodySchema = z.strictObject({
  networkCode: referenceCodeSchema,
  level: creatorVerificationLevelSchema,
});
export type OpenVerificationRequestBody = z.infer<
  typeof openVerificationRequestBodySchema
>;

export const verificationRequestParamsSchema = z.strictObject({
  id: z.uuid(),
});
export type VerificationRequestParams = z.infer<
  typeof verificationRequestParamsSchema
>;

export const verificationEvidenceParamsSchema = z.strictObject({
  id: z.uuid(),
  evidenceId: z.uuid(),
});
export type VerificationEvidenceParams = z.infer<
  typeof verificationEvidenceParamsSchema
>;

/** `POST …/requests`, `…/code`, `…/submit`, `…/cancel`: the request as it now stands. */
export const verificationRequestResponseSchema = z.strictObject({
  request: ownRequestSchema,
  /** `POST …/requests` only: false when the open request of the triplet is returned (08 RG14). */
  created: z.boolean(),
});
export type VerificationRequestResponse = z.infer<
  typeof verificationRequestResponseSchema
>;

/**
 * `PUT …/requests/:id/evidence` (commit 13): the piece stored, as metadata. `DELETE
 * …/evidence/:evidenceId` answers the request as it now stands (`verificationRequestResponseSchema`).
 */
export const verificationEvidenceResponseSchema = z.strictObject({
  evidence: ownEvidenceSchema,
});
export type VerificationEvidenceResponse = z.infer<
  typeof verificationEvidenceResponseSchema
>;

/**
 * The block of a brand that stays internal (06 RG51, RG52; 0222): returned to its OWNER only, never
 * to a creator, to Brevo or to Apollo. `legalName` is the registered name, the trading name of the
 * profile being another field.
 */
export const brandInternalDetailsSchema = z.strictObject({
  legalName: z.string().min(1).max(VERIFICATION_LEGAL_NAME_MAX_LENGTH),
  registrationCountryCode: countryCodeSchema,
  registrationNumber: z
    .string()
    .min(1)
    .max(VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH),
});
export type BrandInternalDetails = z.infer<typeof brandInternalDetailsSchema>;

/** `PUT /v1/me/brand-verification/internal-details`: the three fields, none optional (06 RG51). */
export const saveBrandInternalDetailsBodySchema = brandInternalDetailsSchema;
export type SaveBrandInternalDetailsBody = z.infer<
  typeof saveBrandInternalDetailsBodySchema
>;

/** `GET /v1/me/brand-verification`: the brand's badge, its request, and its internal block. */
export const brandVerificationResponseSchema = z.strictObject({
  asOf: instantSchema,
  badge: ownBadgeSchema.nullable(),
  request: ownRequestSchema.nullable(),
  internalDetails: brandInternalDetailsSchema.nullable(),
});
export type BrandVerificationResponse = z.infer<
  typeof brandVerificationResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// AGENT side: the figures and the decisions (08 RG9, RG36 to RG42, RG56 to RG59; 0224)
// ---------------------------------------------------------------------------------------------

const countSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/**
 * What the agent types after reading the evidence (08 RG38, RG38bis; cas limite 2): the three
 * figures are required, zero is accepted, never a negative; the engagement is optional, 0 to 100 %
 * in basis points, and absent when it could not be read (EC-L2E-12). No tranche: the system derives
 * it (RG20).
 */
export const observedFiguresSchema = z.strictObject({
  followers: countSchema,
  postsLast30Days: z
    .number()
    .int()
    .min(0)
    .max(VERIFICATION_POSTS_LAST_30_DAYS_MAX),
  avgComments: countSchema,
  engagementBp: z
    .number()
    .int()
    .min(0)
    .max(VERIFICATION_ENGAGEMENT_BP_MAX)
    .nullable(),
});
export type ObservedFigures = z.infer<typeof observedFiguresSchema>;

const internalCommentSchema = z
  .string()
  .min(1)
  .max(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH);
const observedHandleSchema = z
  .string()
  .min(1)
  .max(VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH);

/** `POST …/compare` (modele -19): the figures typed, then the declared ones come back with the threshold. */
export const compareFiguresRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  ...observedFiguresSchema.shape,
});
export type CompareFiguresRequest = z.infer<typeof compareFiguresRequestSchema>;

/**
 * The declared figures of the line and the threshold of the alert (`figures_gap_alert_percent`):
 * the gap is computed by the screen with packages/domain, at the read, never stored (08 RG41, RG42).
 * Sent to an agent after his own entry only, never to a member nor to an advertiser.
 */
export const compareFiguresResponseSchema = z.strictObject({
  declared: z.strictObject({
    followers: countSchema.nullable(),
    postsLast30Days: countSchema.nullable(),
    avgComments: countSchema.nullable(),
    engagementBp: z
      .number()
      .int()
      .min(0)
      .max(VERIFICATION_ENGAGEMENT_BP_MAX)
      .nullable(),
  }),
  gapAlertPercent: z.number().int().min(0).max(1000),
  /**
   * An observed figure is farther from its declared value than the threshold (08 RG42): an internal
   * alert computed here at the read, once, by packages/domain; it informs, never refuses.
   */
  alert: z.boolean(),
});
export type CompareFiguresResponse = z.infer<
  typeof compareFiguresResponseSchema
>;

/** `POST …/grant-account` (08 RG25, RG45, CA13, CA14): the code read online and the handle typed by the agent. */
export const grantAccountRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  observedCode: ownershipCodeSchema,
  observedHandle: observedHandleSchema,
  observedPlatformAccountRef: z.string().min(1).max(100).nullable().optional(),
  internalComment: internalCommentSchema.optional(),
});
export type GrantAccountRequest = z.infer<typeof grantAccountRequestSchema>;

/**
 * `POST …/grant-audience` (08 RG36 to RG38bis): the figures, the period, and the handle read on the
 * evidence. The period is checked by the database against `evidence_freshness_days`, from the
 * table (RG100); a gap with the declared figures never refuses it (RG42).
 */
export const grantAudienceRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  ...observedFiguresSchema.shape,
  periodStart: calendarDaySchema,
  periodEnd: calendarDaySchema,
  observedHandle: observedHandleSchema,
  internalComment: internalCommentSchema.optional(),
});
export type GrantAudienceRequest = z.infer<typeof grantAudienceRequestSchema>;

/** `POST …/grant` of a brand (06 RG49 to RG52): the code found at its domain, and the register consulted. */
export const grantBrandRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  observedCode: ownershipCodeSchema,
  observedDomain: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9.-]+$/),
  observedChannel: brandObservedChannelSchema,
  registrySourceId: z.uuid(),
  internalComment: internalCommentSchema.optional(),
});
export type GrantBrandRequest = z.infer<typeof grantBrandRequestSchema>;

/** The two outcomes of a decision that grants (0224): the second, a second constat of one handle, is an outcome and not an error (modele §4). */
export const VERIFICATION_GRANT_OUTCOMES = [
  "granted",
  "handle_already_verified",
] as const;
export const verificationGrantOutcomeSchema = z.enum(
  VERIFICATION_GRANT_OUTCOMES,
);

/**
 * The entry to open next (17b §2.6): the oldest one nobody holds in the same view, among the ones the
 * caller may treat (08 RG53). Only an identifier: the screen opens it by the opening route, which
 * claims it and is journaled; null when the view holds nothing to open.
 */
export const nextVerificationEntrySchema = z
  .strictObject({ entryId: z.uuid() })
  .nullable();

/** What a grant answers: the outcome, the badge when there is one, whether the deadline was missed (marked, never blocked). */
export const grantVerificationResponseSchema = z.strictObject({
  outcome: verificationGrantOutcomeSchema,
  badgeId: z.uuid().nullable(),
  decidedAt: instantSchema,
  late: z.boolean(),
  next: nextVerificationEntrySchema,
});
export type GrantVerificationResponse = z.infer<
  typeof grantVerificationResponseSchema
>;

/**
 * `POST …/reject` (08 RG56 to RG59; 0224): a typed reason of the closed list, never without one.
 * `memberMessage` is the agent's own text, for the reasons that ask for it (`other`,
 * `terms_breach`: 20 to 500 characters), refused for the others; the database says which.
 * `minor` ends everything without a badge and escalates (RG54, RG59).
 */
export const rejectVerificationRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: verificationRejectionReasonCodeSchema,
  memberMessage: z
    .string()
    .min(VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH)
    .max(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
  internalComment: internalCommentSchema.optional(),
});
export type RejectVerificationRequest = z.infer<
  typeof rejectVerificationRequestSchema
>;

export const rejectVerificationResponseSchema = z.strictObject({
  status: z.enum(["rejected", "closed"]),
  decidedAt: instantSchema,
  late: z.boolean(),
  escalated: z.boolean(),
  next: nextVerificationEntrySchema,
});
export type RejectVerificationResponse = z.infer<
  typeof rejectVerificationResponseSchema
>;

/** `POST …/reexamine` (modele §1 point 2): an internal reason, no comment, the request stays in the queue. */
export const reexamineVerificationRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: verificationReexamineReasonCodeSchema,
});
export type ReexamineVerificationRequest = z.infer<
  typeof reexamineVerificationRequestSchema
>;

export const reexamineVerificationResponseSchema = z.strictObject({
  reexaminedAt: instantSchema,
  next: nextVerificationEntrySchema,
});
export type ReexamineVerificationResponse = z.infer<
  typeof reexamineVerificationResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// MEMBER side: the contest of a decision (08 RG77, CA52, CA53; jalons/l2f/modele.md §1 points 7 to 9,
// §5; 0232). A creator contests a refusal or the withdrawal of a badge; a brand does not (it corrects
// and submits again, 06 l. 718). Every object is closed and carries neither the deciders, nor the
// lock, nor the internal comment, nor the review mode, nor the deadlines of the queue (invariant 13):
// the member reads what he wrote, the date, the state and, once decided, the outcome with its motive.
// ---------------------------------------------------------------------------------------------

const disputeTextSchema = z
  .string()
  .min(1)
  .max(VERIFICATION_DISPUTE_TEXT_MAX_LENGTH);

/**
 * A decision the creator may still contest (RG77): the refusal of a request, or the withdrawal of a
 * badge he held, named by its own identifier; `closesAt` is the end of `dispute_window_days` after
 * the notification (the instant itself is still inside, `disputeWindow` of packages/domain).
 */
export const contestableDecisionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("refusal"),
    requestId: z.uuid(),
    level: creatorVerificationLevelSchema,
    networkCode: referenceCodeSchema,
    reasonCode: creatorRejectionReasonCodeSchema,
    decidedAt: instantSchema,
    closesAt: instantSchema,
  }),
  z.strictObject({
    kind: z.literal("revocation"),
    badgeId: z.uuid(),
    level: creatorVerificationLevelSchema,
    networkCode: referenceCodeSchema,
    reasonCode: revocationReasonCodeSchema,
    /** The agent's own message to the member, where the reason asks for it (`terms_breach`). */
    memberMessage: z.string().nullable(),
    decidedAt: instantSchema,
    closesAt: instantSchema,
  }),
]);
export type ContestableDecision = z.infer<typeof contestableDecisionSchema>;

/** The outcome of a contest, with its motive (RG77 « notifié de l'issue avec un motif »). */
export const ownDisputeOutcomeSchema = z.strictObject({
  result: disputeOutcomeSchema,
  reasonCode: disputeOutcomeReasonCodeSchema,
  /** The team's own message, for the motive that asks for one (`other`). */
  memberMessage: z.string().nullable(),
  decidedAt: instantSchema,
});

/** A contest of the member: what he sent, its state, and its outcome once there is one. */
export const ownDisputeSchema = z.strictObject({
  id: z.uuid(),
  /** Exactly one of the two names the decision contested. */
  requestId: z.uuid().nullable(),
  badgeId: z.uuid().nullable(),
  level: creatorVerificationLevelSchema,
  networkCode: referenceCodeSchema,
  reasonCode: disputeReasonCodeSchema,
  text: z.string().nullable(),
  submittedAt: instantSchema,
  state: disputeStateSchema,
  outcome: ownDisputeOutcomeSchema.nullable(),
});
export type OwnDispute = z.infer<typeof ownDisputeSchema>;

/**
 * `GET /v1/me/verification/disputes` (creator): the decisions he may still contest, his contests, and
 * the window in days for the sentence « Vous pouvez contester cette décision pendant {n} jours ».
 */
export const ownDisputesResponseSchema = z.strictObject({
  asOf: instantSchema,
  windowDays: z.number().int().positive(),
  contestable: z.array(contestableDecisionSchema),
  disputes: z.array(ownDisputeSchema),
});
export type OwnDisputesResponse = z.infer<typeof ownDisputesResponseSchema>;

const submitDisputeShape = {
  reasonCode: disputeReasonCodeSchema,
  /** Required for `other`, optional for the others; no link, no contact (the API checks, RG19). */
  text: disputeTextSchema.optional(),
};

/**
 * `POST /v1/me/verification/disputes`: the decision is named by `requestId` (a refusal) or `badgeId`
 * (a withdrawal), one of the two and never both; the account is the session's (T14). The reason is a
 * code of the closed list, and `other` is never sent without its text.
 */
export const submitDisputeBodySchema = z
  .union([
    z.strictObject({ requestId: z.uuid(), ...submitDisputeShape }),
    z.strictObject({ badgeId: z.uuid(), ...submitDisputeShape }),
  ])
  .refine((body) => body.reasonCode !== "other" || body.text !== undefined, {
    message: "text_required",
  });
export type SubmitDisputeBody = z.infer<typeof submitDisputeBodySchema>;

export const submitDisputeResponseSchema = z.strictObject({
  dispute: ownDisputeSchema,
});
export type SubmitDisputeResponse = z.infer<typeof submitDisputeResponseSchema>;

/** The codes of the schemas a member reads: the test of the commit walks them for a forbidden key. */
export const MEMBER_VERIFICATION_RESPONSE_SCHEMAS = {
  publicBadge: publicBadgeSchema,
  creatorVerification: creatorVerificationResponseSchema,
  verificationRequest: verificationRequestResponseSchema,
  verificationEvidence: verificationEvidenceResponseSchema,
  brandVerification: brandVerificationResponseSchema,
  ownDisputes: ownDisputesResponseSchema,
  submitDispute: submitDisputeResponseSchema,
} as const;

// ---------------------------------------------------------------------------------------------
// AGENT side: queue 4, the entries, the decision view and the pieces (08 RG55, RG61 to RG67, RG84;
// jalons/l2e/modele.md §4, §6; commit 14). Every object is closed. A list line and the decision
// view carry NO declared figure (RG47, modele -19): the gap is read in the answer of the typing,
// `compareFiguresResponseSchema`, and nowhere before. Nothing here is served to a member.
// ---------------------------------------------------------------------------------------------

/** The two views of the queue (08 RG61: one table, two views, never a mixed screen), by path segment. */
export const VERIFICATION_QUEUE_VIEWS = ["creators", "brands"] as const;
export const verificationQueueViewSchema = z.enum(VERIFICATION_QUEUE_VIEWS);
export type VerificationQueueView = z.infer<typeof verificationQueueViewSchema>;

/** 08 RG62: oldest first by default; the others, the remaining SLA, the level asked and the network. */
export const VERIFICATION_QUEUE_SORTS = [
  "age",
  "sla",
  "level",
  "network",
] as const;
export const verificationQueueSortSchema = z.enum(VERIFICATION_QUEUE_SORTS);
export type VerificationQueueSort = z.infer<typeof verificationQueueSortSchema>;

/**
 * The alerts of a line (08 RG63, RG55), informative, never a refusal: refusals of the same triplet
 * within the window of the cap, another account declaring the same handle on the network, a holding
 * badge of another account on that handle. The gap between declared and observed is not here: it
 * exists only after the agent typed (RG48).
 */
export const VERIFICATION_QUEUE_ALERT_CODES = [
  "prior_rejections",
  "same_handle_elsewhere",
  "handle_verified_elsewhere",
] as const;
export const verificationQueueAlertCodeSchema = z.enum(
  VERIFICATION_QUEUE_ALERT_CODES,
);
export type VerificationQueueAlertCode = z.infer<
  typeof verificationQueueAlertCodeSchema
>;

/**
 * 08 RG62 filters: the level, the network, the holder (free, me, one agent), the responsible
 * salesperson, the period of the submission, the ones past their deadline, an alert, the ones
 * marked « à réexaminer ». Population is the view itself. The same filters travel in the query
 * string (GET) or in the body (POST …/search, as queue 1: the relay refuses an instant or a long
 * cursor in a query).
 */
const verificationEntriesFilterShape = {
  level: verificationLevelSchema.optional(),
  network: referenceCodeSchema.optional(),
  sort: verificationQueueSortSchema.default("age"),
  overdue: z.literal("true").optional(),
  holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
  owner: z.union([z.literal("none"), z.uuid()]).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  alert: z.literal("true").optional(),
  reexamine: z.literal("true").optional(),
  cursor: queueCursorSchema.optional(),
};

function verificationPeriodIsOrdered(filters: {
  from?: string | undefined;
  to?: string | undefined;
}): boolean {
  return (
    filters.from === undefined ||
    filters.to === undefined ||
    Date.parse(filters.from) <= Date.parse(filters.to)
  );
}

export const verificationEntriesQuerySchema = z
  .strictObject({
    ...verificationEntriesFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type VerificationEntriesQuery = z.infer<
  typeof verificationEntriesQuerySchema
>;

export const verificationEntriesSearchSchema = z
  .strictObject({
    ...verificationEntriesFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type VerificationEntriesSearch = z.infer<
  typeof verificationEntriesSearchSchema
>;
export type VerificationEntriesSearchBody = z.input<
  typeof verificationEntriesSearchSchema
>;

/** « À réexaminer »: the internal reason and when it was set; the entry stays in the queue (RG50). */
export const verificationReexamineMarkSchema = z.strictObject({
  reasonCode: verificationReexamineReasonCodeSchema,
  reexaminedAt: instantSchema,
});

/**
 * One line of the list (08 RG63), without opening anything: population is the view, then the level,
 * the network, the date of the submission, the deadlines, the alerts and the responsible agent.
 * `displayName` is the alias of a creator (never his handle: that is in the decision view) or the
 * trading name of a brand.
 */
export const verificationQueueEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  level: verificationLevelSchema,
  networkCode: referenceCodeSchema.nullable(),
  displayName: z.string().nullable(),
  countryCode: countryCodeSchema,
  submittedAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  /** Past its deadline: written in clear by the screen, still decidable and marked (RG65, C8). */
  overdue: z.boolean(),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
  reexamine: verificationReexamineMarkSchema.nullable(),
  alerts: z.array(verificationQueueAlertCodeSchema),
  /** Who opened the request (D83 A): the member himself, or an agent (the reason is in the dossier). */
  openedBy: verificationOpenerSchema,
});
export type VerificationQueueEntryRow = z.infer<
  typeof verificationQueueEntryRowSchema
>;

export const verificationEntriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  items: z.array(verificationQueueEntryRowSchema),
  /** Null at the last page: no infinite scroll (15 RG34). */
  nextCursor: queueCursorSchema.nullable(),
});
export type VerificationEntriesResponse = z.infer<
  typeof verificationEntriesResponseSchema
>;

/** A piece of the request, metadata only: the bytes come by the journalled route (RG84). */
export const verificationDossierEvidenceSchema = z.strictObject({
  id: z.uuid(),
  byteSize: z.number().int().positive().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  activatedAt: instantSchema.nullable(),
});

/** An earlier request of the same triplet, refusals included (08 RG55, RG60). */
export const verificationDossierHistorySchema = z.strictObject({
  id: z.uuid(),
  level: verificationLevelSchema,
  status: verificationRequestStatusSchema,
  submittedAt: instantSchema.nullable(),
  decidedAt: instantSchema.nullable(),
  reasonCode: verificationRejectionReasonCodeSchema.nullable(),
});

/** A badge of the same line or account, whatever its state (08 RG55). */
export const verificationDossierBadgeSchema = z.strictObject({
  id: z.uuid(),
  level: verificationLevelSchema,
  state: verificationBadgeStateSchema,
  grantedAt: instantSchema,
  expiresAt: instantSchema.nullable(),
});

export const verificationDossierAlertSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("prior_rejections"),
    count: z.number().int().positive(),
  }),
  z.strictObject({
    code: z.literal("same_handle_elsewhere"),
    accounts: z.number().int().positive(),
  }),
  z.strictObject({ code: z.literal("handle_verified_elsewhere") }),
]);
export type VerificationDossierAlert = z.infer<
  typeof verificationDossierAlertSchema
>;

/** A register an agent may consult for a brand (06 RG52): the one of its country, or GLEIF. */
export const verificationRegistrySourceRowSchema = z.strictObject({
  id: z.uuid(),
  sourceType: z.enum(["national", "e_justice", "gleif"]),
  countryCode: countryCodeSchema.nullable(),
  name: z.string(),
  url: z.string(),
  checkedOn: calendarDaySchema,
});
export type VerificationRegistrySourceRow = z.infer<
  typeof verificationRegistrySourceRowSchema
>;

/**
 * Who opened the request, and why (D83 A; 0234), as the decision view of queue 4 shows it, to agents
 * only: an agent's reason is a code of the closed list, its comment is internal, and the member's
 * own reading of it is the e-mail that told him. `loginAddressEligible` (A-bis): a brand whose
 * verified login address is on its domain, a consumer mailbox apart, so that `grant-by-login` is offered.
 */
export const verificationOpeningSchema = z.strictObject({
  openedBy: verificationOpenerSchema,
  reasonCode: openingReasonCodeSchema.nullable(),
  comment: z.string().nullable(),
  loginAddressEligible: z.boolean(),
});
export type VerificationOpening = z.infer<typeof verificationOpeningSchema>;

/**
 * The dossier an agent holding the live claim reads, everything of RG55 on one answer: the line as
 * the creator declared it (handle, pseudonym, address: to find the account, never a value to copy,
 * RG47), or the brand and its internal block; the pieces as metadata; the history; the alerts. No
 * figure the creator declared, no code (EC-L2E-08-3: the agent types what he reads), no key.
 */
export const verificationDossierSchema = z.strictObject({
  /** The code to look for expires then; the code itself never leaves the database (CA13, CA14). */
  codeExpiresAt: instantSchema.nullable(),
  creator: z
    .strictObject({
      handle: z.string().nullable(),
      pseudonym: z.string().nullable(),
      profileUrl: z.string().nullable(),
    })
    .nullable(),
  brand: z
    .strictObject({
      tradeName: z.string().nullable(),
      websiteDomain: z.string().nullable(),
      internalDetails: brandInternalDetailsSchema.nullable(),
      /** The registers this brand may be checked against; empty when none is active (RG52). */
      registrySources: z.array(verificationRegistrySourceRowSchema),
    })
    .nullable(),
  evidence: z.array(verificationDossierEvidenceSchema),
  history: z.array(verificationDossierHistorySchema),
  badges: z.array(verificationDossierBadgeSchema),
  alerts: z.array(verificationDossierAlertSchema),
  /** Who opened the request and why (D83 A), and whether the login address proves the domain (A-bis). */
  opening: verificationOpeningSchema,
});
export type VerificationDossier = z.infer<typeof verificationDossierSchema>;

/** A refusal reason of the population, with what the decision does with it (0221, RG56, RG59). */
export const verificationReasonRowSchema = z.strictObject({
  code: verificationRejectionReasonCodeSchema,
  position: z.number().int().positive(),
  requiresMemberMessage: z.boolean(),
  escalatesToAdmin: z.boolean(),
  purgesEvidence: z.boolean(),
  /**
   * The sentence the member receives for this reason, in the language of the account, from the files of
   * the e-mail (08 RG57; for `other` and `terms_breach` the agent's own text follows it), and what the
   * member can do next (null when nothing is added): what the agent reads is what is sent (L2E-22).
   */
  message: z.string().min(1),
  nextStep: z.string().min(1).nullable(),
});
export type VerificationReasonRow = z.infer<typeof verificationReasonRowSchema>;

/** The decision of a closed entry (08 RG61, C8); the internal comment is for agents only. */
export const verificationEntryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: accountOwnerSchema.nullable(),
  /** Decided after its deadline: marked, never blocked. */
  late: z.boolean(),
  status: z.enum(["approved", "rejected", "closed"]),
  reasonCode: verificationRejectionReasonCodeSchema.nullable(),
  memberMessage: z.string().nullable(),
  internalComment: z.string().nullable(),
});

export const verificationOpenedEntrySchema = z.strictObject({
  id: z.uuid(),
  level: verificationLevelSchema,
  networkCode: referenceCodeSchema.nullable(),
  status: verificationRequestStatusSchema,
  submittedAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  reexamine: verificationReexamineMarkSchema.nullable(),
  decision: verificationEntryDecisionSchema.nullable(),
});

/**
 * `POST …/entries/:id/open` (08 RG43, RG64): opening is claiming. `claimed` and `held` carry the
 * dossier and the review token of the snapshot it was read in; `read_only` (a colleague's, named)
 * and `closed` carry neither, and an agent who does not hold the claim reads nothing of the dossier.
 */
export const verificationOpenResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  entry: verificationOpenedEntrySchema,
  account: z.strictObject({
    id: z.uuid(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  dossier: verificationDossierSchema.nullable(),
  reasons: z.array(verificationReasonRowSchema),
});
export type VerificationOpenResponse = z.infer<
  typeof verificationOpenResponseSchema
>;

/** The longest base64 of a piece (8 MiB of bytes, the limit of the bucket, D82 (5)). */
export const VERIFICATION_EVIDENCE_MAX_BASE64_LENGTH =
  Math.ceil(VERIFICATION_EVIDENCE_MAX_STORED_BYTES / 3) * 4;

/**
 * `GET …/entries/:id/evidence/:evidenceId` (D82 (5)): the piece the dossier named, relayed as JSON like
 * the logo (type, sides, base64 bounded), for the screen to draw from a `blob:`. Never a key, an
 * address of Storage or a token (T9.2); each opening is one line of the register (RG84).
 */
export const verificationEvidenceReadResponseSchema = z.strictObject({
  contentType: z.literal("image/webp"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
  data: z.base64().max(VERIFICATION_EVIDENCE_MAX_BASE64_LENGTH),
});
export type VerificationEvidenceReadResponse = z.infer<
  typeof verificationEvidenceReadResponseSchema
>;

export const verificationEntryParamsSchema = z.strictObject({ id: z.uuid() });
export type VerificationEntryParams = z.infer<
  typeof verificationEntryParamsSchema
>;
export const verificationEntryEvidenceParamsSchema = z.strictObject({
  id: z.uuid(),
  evidenceId: z.uuid(),
});
export type VerificationEntryEvidenceParams = z.infer<
  typeof verificationEntryEvidenceParamsSchema
>;

// ---------------------------------------------------------------------------------------------
// AGENT and ADMIN side: the registry sources of the brand's registration (06 RG52, RG101; D79 (12);
// jalons/l2e/registres.md; commit 15). Read by agent and admin, written by an administrator only;
// every change is journaled with the former and the new value by the database. A source is a public
// page the agent opens by hand: nothing here is a credential, nothing is ever fetched by INFLUX.
// ---------------------------------------------------------------------------------------------

/** A source of `GET /v1/bo/verification/registry-sources`: all of them, the inactive ones too (RG101). */
export const verificationRegistrySourceAdminRowSchema = z.strictObject({
  id: z.uuid(),
  sourceType: z.enum(["national", "e_justice", "gleif"]),
  /** Null for GLEIF alone, which answers for every country (0221). */
  countryCode: countryCodeSchema.nullable(),
  name: z.string(),
  url: z.string(),
  checkedOn: calendarDaySchema,
  /** One active source per country; a source whose gratuity is "à confirmer" loads inactive. */
  isActive: z.boolean(),
  updatedAt: instantSchema,
});
export type VerificationRegistrySourceAdminRow = z.infer<
  typeof verificationRegistrySourceAdminRowSchema
>;

export const verificationRegistrySourcesResponseSchema = z.strictObject({
  sources: z.array(verificationRegistrySourceAdminRowSchema),
});
export type VerificationRegistrySourcesResponse = z.infer<
  typeof verificationRegistrySourcesResponseSchema
>;

export const VERIFICATION_REGISTRY_SOURCE_NAME_MIN_LENGTH = 2;
export const VERIFICATION_REGISTRY_SOURCE_NAME_MAX_LENGTH = 160;
export const VERIFICATION_REGISTRY_SOURCE_URL_MAX_LENGTH = 500;

export const verificationRegistrySourceParamsSchema = z.strictObject({
  id: z.uuid(),
});
export type VerificationRegistrySourceParams = z.infer<
  typeof verificationRegistrySourceParamsSchema
>;

/**
 * `PUT /v1/bo/verification/registry-sources/:id` (an administrator): name, page, day of the check by
 * hand and activation; never the country nor the type (a source belongs to its country). The page is
 * `https` and nothing else (0221 `registry_sources_url`); the day of the check is not in the future
 * (the database says so, 22023).
 */
export const updateVerificationRegistrySourceBodySchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(VERIFICATION_REGISTRY_SOURCE_NAME_MIN_LENGTH)
    .max(VERIFICATION_REGISTRY_SOURCE_NAME_MAX_LENGTH)
    // eslint-disable-next-line no-control-regex -- a control character in a name is what this refuses
    .regex(/^[^\u0000-\u001f\u007f]+$/),
  url: z
    .string()
    .trim()
    .max(VERIFICATION_REGISTRY_SOURCE_URL_MAX_LENGTH)
    // eslint-disable-next-line no-control-regex -- no space, no control character in an address
    .regex(/^https:\/\/[^\s\u0000-\u001f\u007f]+$/),
  checkedOn: calendarDaySchema,
  isActive: z.boolean(),
});
export type UpdateVerificationRegistrySourceBody = z.infer<
  typeof updateVerificationRegistrySourceBodySchema
>;

export const updateVerificationRegistrySourceResponseSchema = z.strictObject({
  source: verificationRegistrySourceAdminRowSchema,
});
export type UpdateVerificationRegistrySourceResponse = z.infer<
  typeof updateVerificationRegistrySourceResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// AGENT side: the withdrawal of a badge under 2V, and the badges of an account (08 RG73 to RG76;
// 06 RG55; jalons/l2f/modele.md §1 points 4, 5, §3 "0231", §5; 0231). An agent asks, an
// administrator distinct from the asker confirms: this contract carries the ask and the read, the
// 2V's own view is the one of `backoffice-actions.ts`. Nothing here is served to a member.
// ---------------------------------------------------------------------------------------------

/**
 * A reason of withdrawal as the agent chooses it, with what the withdrawal does with it (0231) and the
 * sentence the member receives, in his language (`message`: what the agent reads is what is sent).
 */
export const revocationReasonRowSchema = z.strictObject({
  code: revocationReasonCodeSchema,
  position: z.number().int().positive(),
  /** The levels a badge may be withdrawn at for this reason. */
  levels: z.array(verificationLevelSchema).min(1),
  /** The agent's own message to the member, 20 to 500 characters, required and refused otherwise. */
  requiresMemberMessage: z.boolean(),
  /** The escalation of RG73: held by construction, only an administrator confirms and executes. */
  escalatesToAdmin: z.boolean(),
  message: z.string().min(1),
});
export type RevocationReasonRow = z.infer<typeof revocationReasonRowSchema>;

/**
 * `POST /v1/bo/accounts/:id/badges/:badgeId/revocation` (an agent or an administrator): a reason of the
 * list of the badge's level; `memberMessage` is the agent's text for the reasons that ask for it
 * (`terms_breach`), refused for the others. The 2V is opened by this ask (charge: account, badge,
 * reason).
 */
export const requestBadgeRevocationBodySchema = z.strictObject({
  reasonCode: revocationReasonCodeSchema,
  memberMessage: z
    .string()
    .min(VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH)
    .max(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
});
export type RequestBadgeRevocationBody = z.infer<
  typeof requestBadgeRevocationBodySchema
>;

/** The 2V that was opened: the administrator confirms it at `/double-validation/[id]`. */
export const requestBadgeRevocationResponseSchema = z.strictObject({
  dualControlRequestId: z.uuid(),
});
export type RequestBadgeRevocationResponse = z.infer<
  typeof requestBadgeRevocationResponseSchema
>;

/** A badge of an account, whatever its state, with no figure and no identifier of a network (0231 `read_account_badges`). */
export const accountBadgeRowSchema = z.strictObject({
  id: z.uuid(),
  level: verificationLevelSchema,
  networkCode: referenceCodeSchema.nullable(),
  state: verificationBadgeStateSchema,
  grantedAt: instantSchema,
  expiresAt: instantSchema.nullable(),
  /** The end of the badge (`expired`, `revoked`, `replaced`), null while it stands. */
  endedAt: instantSchema.nullable(),
  revokedAt: instantSchema.nullable(),
  revocationReasonCode: revocationReasonCodeSchema.nullable(),
  /** A withdrawal asked for and not yet executed, with the effective state of its 2V. */
  pendingRevocation: z
    .strictObject({
      dualControlRequestId: z.uuid(),
      state: revocationRequestStateSchema,
    })
    .nullable(),
  /** The contest of the decision that ended this badge, when there is one. */
  dispute: z
    .strictObject({ id: z.uuid(), state: disputeStateSchema })
    .nullable(),
});
export type AccountBadgeRow = z.infer<typeof accountBadgeRowSchema>;

/** `GET /v1/bo/accounts/:id/badges`: the block « Badges » of the account's page, and the reasons it offers. */
export const accountBadgesResponseSchema = z.strictObject({
  asOf: instantSchema,
  badges: z.array(accountBadgeRowSchema),
  reasons: z.array(revocationReasonRowSchema),
});
export type AccountBadgesResponse = z.infer<typeof accountBadgesResponseSchema>;

export const accountBadgeParamsSchema = z.strictObject({
  id: z.uuid(),
  badgeId: z.uuid(),
});
export type AccountBadgeParams = z.infer<typeof accountBadgeParamsSchema>;

// ---------------------------------------------------------------------------------------------
// AGENT side: queue 5, the contests (08 RG77, RG78; 15 RG27 C1 to C8, RG29; jalons/l2f/modele.md §1
// points 7 to 10, §3 "0232", §5; 0232). Same rules as queue 4: opening is claiming, the review token
// binds a decision to the version examined, no entry leaves without a decision. The handle typed
// after an overturn is a body field only (0228). Nothing here is served to a member.
// ---------------------------------------------------------------------------------------------

/** 08 RG62 as queue 5 reads it: the sorts of queue 4, the level (creator levels) and what is contested. */
const disputeEntriesFilterShape = {
  level: creatorVerificationLevelSchema.optional(),
  network: referenceCodeSchema.optional(),
  kind: disputeKindSchema.optional(),
  sort: verificationQueueSortSchema.default("age"),
  overdue: z.literal("true").optional(),
  holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
  owner: z.union([z.literal("none"), z.uuid()]).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  cursor: queueCursorSchema.optional(),
};

export const disputeEntriesQuerySchema = z
  .strictObject({
    ...disputeEntriesFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type DisputeEntriesQuery = z.infer<typeof disputeEntriesQuerySchema>;

export const disputeEntriesSearchSchema = z
  .strictObject({
    ...disputeEntriesFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type DisputeEntriesSearch = z.infer<typeof disputeEntriesSearchSchema>;
export type DisputeEntriesSearchBody = z.input<
  typeof disputeEntriesSearchSchema
>;

/** One line of the list: no handle, no text of the creator (those are in the decision view). */
export const disputeEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  kind: disputeKindSchema,
  level: creatorVerificationLevelSchema,
  networkCode: referenceCodeSchema,
  /** The alias of the creator, never his handle. */
  displayName: z.string().nullable(),
  countryCode: countryCodeSchema,
  reasonCode: disputeReasonCodeSchema,
  submittedAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  /** Past its deadline: written in clear by the screen, still decidable and marked (C8). */
  overdue: z.boolean(),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
});
export type DisputeEntryRow = z.infer<typeof disputeEntryRowSchema>;

export const disputeEntriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  items: z.array(disputeEntryRowSchema),
  /** Null at the last page: no infinite scroll (15 RG34). */
  nextCursor: queueCursorSchema.nullable(),
});
export type DisputeEntriesResponse = z.infer<
  typeof disputeEntriesResponseSchema
>;

/**
 * The dossier an agent holding the live claim reads: what the creator wrote, the line as he declared
 * it (to find the account), the decision contested with its reason, the pieces as metadata. The review
 * mode is the one the decision would have NOW (`independent`: another person than the deciders;
 * `delayed`: a decider alone, from `reflectionUntil`). No key, no figure the creator declared.
 */
export const disputeDossierSchema = z.strictObject({
  kind: disputeKindSchema,
  reasonCode: disputeReasonCodeSchema,
  text: z.string().nullable(),
  submittedAt: instantSchema,
  reviewMode: disputeReviewModeSchema,
  /** `delayed` only: the earliest instant a decider may judge it alone. */
  reflectionUntil: instantSchema.nullable(),
  /** The persons who took the decision contested: they open it read-only while another person exists. */
  deciders: z.array(accountOwnerSchema),
  creator: z
    .strictObject({
      handle: z.string().nullable(),
      pseudonym: z.string().nullable(),
      profileUrl: z.string().nullable(),
    })
    .nullable(),
  refusal: z
    .strictObject({
      requestId: z.uuid(),
      reasonCode: creatorRejectionReasonCodeSchema,
      memberMessage: z.string().nullable(),
      decidedAt: instantSchema,
      /** The code of a refused account request expires then; the code itself never leaves the database. */
      codeExpiresAt: instantSchema.nullable(),
    })
    .nullable(),
  revocation: z
    .strictObject({
      badgeId: z.uuid(),
      grantedAt: instantSchema,
      expiresAt: instantSchema.nullable(),
      revokedAt: instantSchema,
      reasonCode: revocationReasonCodeSchema,
      memberMessage: z.string().nullable(),
      /** The audience carried along by a withdrawn « Compte vérifié » (modele point 4). */
      cascadeBadgeIds: z.array(z.uuid()),
    })
    .nullable(),
  evidence: z.array(verificationDossierEvidenceSchema),
});
export type DisputeDossier = z.infer<typeof disputeDossierSchema>;

/** A motive of outcome, with what it does and the sentence the member receives (`other`: the agent's text follows). */
export const disputeOutcomeReasonRowSchema = z.strictObject({
  code: disputeOutcomeReasonCodeSchema,
  outcome: disputeOutcomeSchema,
  position: z.number().int().positive(),
  requiresMemberMessage: z.boolean(),
  message: z.string().min(1),
});
export type DisputeOutcomeReasonRow = z.infer<
  typeof disputeOutcomeReasonRowSchema
>;

/** The decision of a closed contest (C8); the internal comment is for agents only. */
export const disputeEntryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: accountOwnerSchema.nullable(),
  late: z.boolean(),
  state: z.enum(["upheld", "overturned", "withdrawn"]),
  outcomeReasonCode: disputeOutcomeReasonCodeSchema.nullable(),
  reviewMode: disputeReviewModeSchema.nullable(),
  withdrawnCause: disputeWithdrawnCauseSchema.nullable(),
  memberMessage: z.string().nullable(),
  internalComment: z.string().nullable(),
});

export const disputeOpenedEntrySchema = z.strictObject({
  id: z.uuid(),
  kind: disputeKindSchema,
  level: creatorVerificationLevelSchema,
  networkCode: referenceCodeSchema,
  state: disputeStateSchema,
  submittedAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: disputeEntryDecisionSchema.nullable(),
});

/** `POST …/verification-disputes/entries/:id/open` (C1, C2): `claimed` and `held` carry the dossier and the token. */
export const disputeOpenResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  entry: disputeOpenedEntrySchema,
  account: z.strictObject({
    id: z.uuid(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  dossier: disputeDossierSchema.nullable(),
  outcomeReasons: z.array(disputeOutcomeReasonRowSchema),
});
export type DisputeOpenResponse = z.infer<typeof disputeOpenResponseSchema>;

const optionalPlatformAccountRefSchema = z
  .string()
  .min(1)
  .max(100)
  .nullable()
  .optional();

/**
 * `POST …/entries/:id/uphold`: the decision stands, with a motive of the upheld ones; `memberMessage`
 * is the team's own text for `other` (20 to 500 characters), refused for the others.
 */
export const upholdDisputeRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  outcomeReasonCode: disputeUpheldOutcomeReasonCodeSchema,
  memberMessage: z
    .string()
    .min(VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH)
    .max(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
  internalComment: internalCommentSchema.optional(),
});
export type UpholdDisputeRequest = z.infer<typeof upholdDisputeRequestSchema>;

/**
 * `POST …/entries/:id/overturn` (CA53): the decision is reversed, by what was contested: a refused
 * account request (the code read and the handle typed), a refused audience request (the figures, the
 * period, the handle), a withdrawn badge (the handle read again). Every overturn types the handle again
 * (0228) and gives a new date of decision.
 */
export const overturnDisputeRequestSchema = z.discriminatedUnion("target", [
  z.strictObject({
    target: z.literal("refusal_account"),
    reviewToken: reviewTokenSchema,
    observedCode: ownershipCodeSchema,
    observedHandle: observedHandleSchema,
    observedPlatformAccountRef: optionalPlatformAccountRefSchema,
    internalComment: internalCommentSchema.optional(),
  }),
  z.strictObject({
    target: z.literal("refusal_audience"),
    reviewToken: reviewTokenSchema,
    ...observedFiguresSchema.shape,
    periodStart: calendarDaySchema,
    periodEnd: calendarDaySchema,
    observedHandle: observedHandleSchema,
    internalComment: internalCommentSchema.optional(),
  }),
  z.strictObject({
    target: z.literal("revocation"),
    reviewToken: reviewTokenSchema,
    observedHandle: observedHandleSchema,
    internalComment: internalCommentSchema.optional(),
  }),
]);
export type OverturnDisputeRequest = z.infer<
  typeof overturnDisputeRequestSchema
>;

/** What a decision of queue 5 answers: the outcome, the badge given back, the mode of the review, the deadline marked. */
export const decideDisputeResponseSchema = z.strictObject({
  outcome: disputeOutcomeSchema,
  /** The badge granted by an overturn (a new date of decision); null when the decision stands. */
  badgeId: z.uuid().nullable(),
  decidedAt: instantSchema,
  late: z.boolean(),
  reviewMode: disputeReviewModeSchema,
  next: nextVerificationEntrySchema,
});
export type DecideDisputeResponse = z.infer<typeof decideDisputeResponseSchema>;

// ---------------------------------------------------------------------------------------------
// AGENT side: queue 6, the identifiers changed after a verification (08 RG78; 15 RG29;
// jalons/l2f/modele.md §1 points 12, 13, §3 "0233", §5; 0233). The badge stays; the agent confirms
// (« même compte », the handle typed) or requires a proof (« à reconfirmer »). The former and the
// new identifier are in the decision view only: never in a list, never public, never in a register.
// ---------------------------------------------------------------------------------------------

const identifierChangeEntriesFilterShape = {
  network: referenceCodeSchema.optional(),
  sort: verificationQueueSortSchema.default("age"),
  overdue: z.literal("true").optional(),
  holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
  owner: z.union([z.literal("none"), z.uuid()]).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  cursor: queueCursorSchema.optional(),
};

export const identifierChangeEntriesQuerySchema = z
  .strictObject({
    ...identifierChangeEntriesFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type IdentifierChangeEntriesQuery = z.infer<
  typeof identifierChangeEntriesQuerySchema
>;

export const identifierChangeEntriesSearchSchema = z
  .strictObject({
    ...identifierChangeEntriesFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(verificationPeriodIsOrdered, { message: "period_order" });
export type IdentifierChangeEntriesSearch = z.infer<
  typeof identifierChangeEntriesSearchSchema
>;
export type IdentifierChangeEntriesSearchBody = z.input<
  typeof identifierChangeEntriesSearchSchema
>;

/** One line of the list: the network and how often the identifier changed, no identifier. */
export const identifierChangeEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  networkCode: referenceCodeSchema,
  displayName: z.string().nullable(),
  countryCode: countryCodeSchema,
  changeCount: z.number().int().positive(),
  createdAt: instantSchema,
  lastChangedAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  overdue: z.boolean(),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
});
export type IdentifierChangeEntryRow = z.infer<
  typeof identifierChangeEntryRowSchema
>;

export const identifierChangeEntriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  items: z.array(identifierChangeEntryRowSchema),
  nextCursor: queueCursorSchema.nullable(),
});
export type IdentifierChangeEntriesResponse = z.infer<
  typeof identifierChangeEntriesResponseSchema
>;

/** The dossier an agent holding the live claim reads: the former and the new identifier, the badges held. */
export const identifierChangeDossierSchema = z.strictObject({
  networkCode: referenceCodeSchema,
  /** The identifier of the last constat `confirmed`, else the one seen at the decision of the held badge. */
  previousHandle: z.string().nullable(),
  newHandle: z.string(),
  changeCount: z.number().int().positive(),
  createdAt: instantSchema,
  lastChangedAt: instantSchema,
  /** The line as the creator now declares it, to find the account. */
  creator: z.strictObject({
    handle: z.string().nullable(),
    pseudonym: z.string().nullable(),
    profileUrl: z.string().nullable(),
  }),
  accountBadge: z
    .strictObject({
      id: z.uuid(),
      state: verificationBadgeStateSchema,
      grantedAt: instantSchema,
    })
    .nullable(),
  audienceBadge: z
    .strictObject({
      id: z.uuid(),
      state: verificationBadgeStateSchema,
      expiresAt: instantSchema.nullable(),
    })
    .nullable(),
});
export type IdentifierChangeDossier = z.infer<
  typeof identifierChangeDossierSchema
>;

/** The decision of a closed entry (C8); the internal comment is for agents only. */
export const identifierChangeDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: accountOwnerSchema.nullable(),
  late: z.boolean(),
  state: z.enum(["confirmed", "proof_required", "withdrawn"]),
  withdrawnCause: identifierWithdrawnCauseSchema.nullable(),
  observedHandle: z.string().nullable(),
  internalComment: z.string().nullable(),
});

export const identifierChangeOpenedEntrySchema = z.strictObject({
  id: z.uuid(),
  networkCode: referenceCodeSchema,
  state: identifierReviewStateSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema,
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: identifierChangeDecisionSchema.nullable(),
});

/** `POST …/identifier-changes/entries/:id/open` (C1, C2). */
export const identifierChangeOpenResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  entry: identifierChangeOpenedEntrySchema,
  account: z.strictObject({
    id: z.uuid(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  dossier: identifierChangeDossierSchema.nullable(),
});
export type IdentifierChangeOpenResponse = z.infer<
  typeof identifierChangeOpenResponseSchema
>;

/** `POST …/entries/:id/confirm` (« même compte »): the handle typed must be the one declared (0233); the badge is never rewritten. */
export const confirmIdentifierChangeRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  observedHandle: observedHandleSchema,
  internalComment: internalCommentSchema.optional(),
});
export type ConfirmIdentifierChangeRequest = z.infer<
  typeof confirmIdentifierChangeRequestSchema
>;

/** `POST …/entries/:id/require-proof` (« à reconfirmer »): no free text, the proof is asked again from the member's space. */
export const requireIdentifierProofRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  internalComment: internalCommentSchema.optional(),
});
export type RequireIdentifierProofRequest = z.infer<
  typeof requireIdentifierProofRequestSchema
>;

export const confirmIdentifierChangeResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  next: nextVerificationEntrySchema,
});
export type ConfirmIdentifierChangeResponse = z.infer<
  typeof confirmIdentifierChangeResponseSchema
>;

export const requireIdentifierProofResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  /** « Compte vérifié » now to reconfirm, and the audience tenue of the line with it. */
  badgeId: z.uuid().nullable(),
  audienceBadgeIds: z.array(z.uuid()),
  next: nextVerificationEntrySchema,
});
export type RequireIdentifierProofResponse = z.infer<
  typeof requireIdentifierProofResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// AGENT side: a verification opened by an agent, and the proof of a brand by its login address
// (decision D83, A and A-bis; 06 RG51; jalons/l2f/modele.md §1 point 14, §6; 0234). The same request,
// the same queue, the same unicity and the same decisions: the origin and the reason are carried by
// the request. « Audience vérifiée » is never opened this way, nor is a lot or an import. The domain
// of a brand is proven by the verified login address, read by the database and never typed.
// ---------------------------------------------------------------------------------------------

/**
 * `POST /v1/bo/accounts/:id/verification-requests` (an agent or an administrator, never on his own
 * account): « Compte vérifié » of a line (`socialAccountId`) or « Marque vérifiée » of the account
 * (no line, and the three fields of the internal block when it holds none). The reason is a code of
 * the closed list; its comment is required for `other`, 1 to 1 000 characters. The member is told by
 * e-mail, with no code in it.
 */
export const openVerificationForMemberBodySchema = z
  .strictObject({
    level: z.enum(["account_verified", "brand_verified"]),
    socialAccountId: z.uuid().nullable(),
    openingReasonCode: openingReasonCodeSchema,
    openingComment: internalCommentSchema.optional(),
    legalName: z
      .string()
      .min(1)
      .max(VERIFICATION_LEGAL_NAME_MAX_LENGTH)
      .optional(),
    registrationCountryCode: countryCodeSchema.optional(),
    registrationNumber: z
      .string()
      .min(1)
      .max(VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH)
      .optional(),
  })
  .refine(
    (body) =>
      body.openingReasonCode !== "other" || body.openingComment !== undefined,
    { message: "opening_comment_required" },
  )
  .refine(
    (body) =>
      (body.level === "account_verified") === (body.socialAccountId !== null),
    { message: "social_account_mismatch" },
  )
  .refine(
    (body) => {
      const given = [
        body.legalName,
        body.registrationCountryCode,
        body.registrationNumber,
      ].filter((value) => value !== undefined).length;
      return body.level === "brand_verified"
        ? given === 0 || given === 3
        : given === 0;
    },
    { message: "internal_details_invalid" },
  );
export type OpenVerificationForMemberBody = z.infer<
  typeof openVerificationForMemberBodySchema
>;

/** The request that now waits in queue 4, and whether it was just created (a request already open is taken over, never doubled). */
export const openVerificationForMemberResponseSchema = z.strictObject({
  requestId: z.uuid(),
  status: verificationRequestStatusSchema,
  created: z.boolean(),
});
export type OpenVerificationForMemberResponse = z.infer<
  typeof openVerificationForMemberResponseSchema
>;

/**
 * `POST /v1/bo/queues/verification-brands/entries/:id/grant-by-login` (A-bis): the same grant as a
 * brand's, without a code or a channel typed: the database reads the login address. The register of the
 * company is still consulted by the agent (06 RG52). The answer is the one of a grant.
 */
export const grantBrandByLoginRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  registrySourceId: z.uuid(),
  internalComment: internalCommentSchema.optional(),
});
export type GrantBrandByLoginRequest = z.infer<
  typeof grantBrandByLoginRequestSchema
>;
