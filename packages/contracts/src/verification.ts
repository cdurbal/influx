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
const referenceCodeSchema = z
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

/** The codes of the schemas a member reads: the test of the commit walks them for a forbidden key. */
export const MEMBER_VERIFICATION_RESPONSE_SCHEMAS = {
  publicBadge: publicBadgeSchema,
  creatorVerification: creatorVerificationResponseSchema,
  verificationRequest: verificationRequestResponseSchema,
  verificationEvidence: verificationEvidenceResponseSchema,
  brandVerification: brandVerificationResponseSchema,
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
