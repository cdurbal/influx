// Contract of the backoffice queues, queue 1 "profils marque à valider" (docs/mvp/06 RG63 to RG70,
// RG80; 15 RG26 to RG28, RG33, RG34, RG36, C1 to C8; 17b §2; jalons/l2c/file.md A1 to A10, D81;
// l2c-fiche invariants 2, 7, 9, 11 to 14; commit 11). Shared by apps/api and apps/backoffice.
// - The list carries NO coordinate: not the contact person, not an address, not a phone number
//   (D45, D46; invariant 12). The decision view, behind an opening that is journaled (L2BS-7), is
//   the only place where the contact person appears.
// - Every object is closed (strict): a field outside the list refuses the answer (RG80, RG81).
//   Nothing here carries an amount, a rate, a commission or a tariff (D48, D78).
// - Codes and identifiers only in an address and in the register (15 RG121); the texts a screen
//   shows come from its own translation files, except the message of a refusal, which is the very
//   text the brand will receive (apps/api/src/locales/{fr,en}/email.json, file.md A6).
import { z } from "./zod.ts";
import { accountOwnerSchema } from "./backoffice-accounts.ts";
import { uiLocaleSchema } from "./auth.ts";
import { brandProfileStatusSchema } from "./brand-profile.ts";
import { countryCodeSchema } from "./signup.ts";

/** The code of the queue in `backoffice.queues` (0206) and in the register payloads. */
export const BRAND_REVIEW_QUEUE = "profiles_advertiser";
export const queueCodeSchema = z.literal(BRAND_REVIEW_QUEUE);

/** 15 RG34: the cap of a page, set by the server. */
export const QUEUE_PAGE_SIZE_DEFAULT = 20;
export const QUEUE_PAGE_SIZE_MAX = 50;

export const REVIEW_ENTRY_KINDS = ["submission", "revision"] as const;
export const reviewEntryKindSchema = z.enum(REVIEW_ENTRY_KINDS);
export type ReviewEntryKind = z.infer<typeof reviewEntryKindSchema>;

export const REVIEW_ENTRY_STATES = [
  "open",
  "published",
  "rejected",
  "withdrawn",
] as const;
export const reviewEntryStateSchema = z.enum(REVIEW_ENTRY_STATES);

/** `profiles.moderated_fields` (0207, file.md A4): what a change re-validates. */
export const MODERATED_FIELD_CODES = [
  "advertiser.brand_name",
  "advertiser.logo",
  "advertiser.presentation",
  "advertiser.website_domain",
  "advertiser.contact_role",
  "advertiser.primary_sector",
] as const;
export const moderatedFieldCodeSchema = z.enum(MODERATED_FIELD_CODES);
export type ModeratedFieldCode = z.infer<typeof moderatedFieldCodeSchema>;

/** `profiles.advertiser_rejection_reasons` (0207, 06 RG66, file.md A6): the closed list. */
export const REJECTION_REASON_CODES = [
  "contact_in_public_field",
  "presentation_insufficient",
  "logo_non_compliant",
  "misleading_brand_name",
  "sector_inconsistent",
  "illicit_content",
  "duplicate_brand",
  "other",
] as const;
export const rejectionReasonCodeSchema = z.enum(REJECTION_REASON_CODES);
export type RejectionReasonCode = z.infer<typeof rejectionReasonCodeSchema>;

/** What a public text may hold that 06 RG19 forbids; the twin of packages/domain (parity tested). */
export const CONTACT_SIGNAL_CODES = [
  "email",
  "url",
  "domain",
  "phone",
  "handle",
  "messenger",
] as const;
export const contactSignalSchema = z.enum(CONTACT_SIGNAL_CODES);

/** The alerts of an entry (06 RG19, RG25, RG70, L2BS-8): informative, never a refusal. */
export const REVIEW_ALERT_CODES = [
  "direct_contact",
  "duplicate_brand",
  "duplicate_domain",
  "unusual_website_domain",
] as const;
export const reviewAlertCodeSchema = z.enum(REVIEW_ALERT_CODES);
export type ReviewAlertCode = z.infer<typeof reviewAlertCodeSchema>;

/** An opaque cursor of the list, issued by the server only. */
export const queueCursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,300}$/);

const instantSchema = z.iso.datetime();

// ---------------------------------------------------------------------------------------------
// GET /v1/bo/queues/counters (15 RG28, RG32; 17b §2.2)
// ---------------------------------------------------------------------------------------------

/** The delay of the queue, in clear on the head banner (17b §2.2): data, never a constant (RG38). */
export const queuePolicySchema = z.strictObject({
  decisionMinutes: z.number().int().positive(),
  claimTargetMinutes: z.number().int().positive().nullable(),
  escalateAfterMinutes: z.number().int().nonnegative().nullable(),
  /** The minutes count in business hours (04 §5.6); false: calendar time. */
  businessHours: z.boolean(),
});

/**
 * The permanent counters of a queue (15 RG28): the volume waiting and the age of the oldest entry,
 * those past their deadline, those without a holder. As the list: the entries of the caller's own
 * account and of the accounts the caller holds are not counted (15 RG36).
 */
export const queueCountersSchema = z.strictObject({
  queue: queueCodeSchema,
  pending: z.number().int().nonnegative(),
  oldestCreatedAt: instantSchema.nullable(),
  overdue: z.number().int().nonnegative(),
  unclaimed: z.number().int().nonnegative(),
  /** The empty state of 15 RG32 says how long ago the last entry was handled. */
  lastDecidedAt: instantSchema.nullable(),
  policy: queuePolicySchema,
});
export type QueueCounters = z.infer<typeof queueCountersSchema>;

export const queueCountersResponseSchema = z.strictObject({
  /** The instant of the database: durations are computed from it, never from a client clock. */
  asOf: instantSchema,
  queues: z.array(queueCountersSchema),
});
export type QueueCountersResponse = z.infer<typeof queueCountersResponseSchema>;

// ---------------------------------------------------------------------------------------------
// GET /v1/bo/queues/profiles-advertiser/entries (15 RG26, RG27 C5, RG33, RG34; 17b §2.2)
// ---------------------------------------------------------------------------------------------

/**
 * 15 RG33, as far as queue 1 applies them: the state is always `open` (a queue lists what waits),
 * the holder (free, me, one named agent), the responsible salesperson, the period (the day of the
 * submission), the overdue ones and the presence of an alert; plus the filters of 17b §1.7: the
 * country and the kind (first submission, or modification). Codes, identifiers and instants only.
 */
export const entriesQuerySchema = z
  .strictObject({
    kind: reviewEntryKindSchema.optional(),
    country: countryCodeSchema.optional(),
    overdue: z.literal("true").optional(),
    holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
    owner: z.union([z.literal("none"), z.uuid()]).optional(),
    from: instantSchema.optional(),
    to: instantSchema.optional(),
    alert: z.literal("true").optional(),
    cursor: queueCursorSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      Date.parse(query.from) <= Date.parse(query.to),
    { message: "period_order" },
  );
export type EntriesQuery = z.infer<typeof entriesQuerySchema>;

/** The lock of an entry (15 RG27 C2): a name, never a technical identifier alone. */
export const entryClaimSchema = z.strictObject({
  /** The holder of a LIVE claim; an expired one is no holder (file.md A9). */
  holder: accountOwnerSchema.nullable(),
  claimedAt: instantSchema.nullable(),
  claimExpiresAt: instantSchema.nullable(),
  heldByCaller: z.boolean(),
});
export type EntryClaim = z.infer<typeof entryClaimSchema>;

/** One line of the list (06 RG63): no coordinate, no e-mail, no contact person. */
export const queueEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  kind: reviewEntryKindSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  /** 15 RG27 C5: past its deadline; written in clear by the screen, never by colour alone. */
  overdue: z.boolean(),
  /** The trading name, until the legal name of L2E (EC-L2C-3); never the legal name. */
  brandName: z.string(),
  countryCode: countryCodeSchema,
  completenessPercent: z.number().int().min(0).max(100).nullable(),
  /** The fields a revision changes (06 RG63); empty for a first submission. */
  modifiedFields: z.array(moderatedFieldCodeSchema),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
  alerts: z.array(reviewAlertCodeSchema),
});
export type QueueEntryRow = z.infer<typeof queueEntryRowSchema>;

export const entriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  items: z.array(queueEntryRowSchema),
  /** Null at the last page: no infinite scroll (15 RG34, CA18). */
  nextCursor: queueCursorSchema.nullable(),
});
export type EntriesResponse = z.infer<typeof entriesResponseSchema>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/queues/profiles-advertiser/entries/:id/open (15 C1, C2; file.md A3, A9, A10)
// ---------------------------------------------------------------------------------------------

export const entryParamsSchema = z.strictObject({ id: z.uuid() });
export type EntryParams = z.infer<typeof entryParamsSchema>;

/** 15 C1, C2: claimed (just taken), held (already the caller's), read_only (a colleague's), closed. */
export const OPEN_OUTCOMES = [
  "claimed",
  "held",
  "read_only",
  "closed",
] as const;
export const openOutcomeSchema = z.enum(OPEN_OUTCOMES);
export type OpenOutcome = z.infer<typeof openOutcomeSchema>;

const logoSchema = z.strictObject({
  id: z.uuid(),
  byteSize: z.number().int().positive().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  activatedAt: instantSchema.nullable(),
});

/**
 * The profile as the live row holds it: the last VALIDATED version (06 RG9), whatever the entry.
 * The contact person is here and nowhere else (L2BS-7): the opening that served it is in the register.
 */
export const reviewedProfileSchema = z.strictObject({
  status: brandProfileStatusSchema,
  submittedAt: instantSchema.nullable(),
  firstPublishedAt: instantSchema.nullable(),
  completenessPercent: z.number().int().min(0).max(100).nullable(),
  brandName: z.string(),
  primarySector: z.string().nullable(),
  companySize: z.string().nullable(),
  websiteDomain: z.string().nullable(),
  presentation: z.string().nullable(),
  exclusivityBand: z.string().nullable(),
  collaborationRhythm: z.string().nullable(),
  offersNonMonetary: z.boolean().nullable(),
  contactRole: z.string().nullable(),
  lists: z.strictObject({
    secondarySectors: z.array(z.string()),
    targetMarkets: z.array(z.string()),
    workingLanguages: z.array(z.string()),
    topics: z.array(z.string()),
    networks: z.array(z.string()),
    formats: z.array(z.string()),
    audienceCountries: z.array(z.string()),
    usageRights: z.array(z.string()),
  }),
  logos: z.strictObject({
    active: logoSchema.nullable(),
    inReview: logoSchema.nullable(),
  }),
  contact: z.strictObject({
    firstName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    url: z.string().nullable(),
  }),
});
export type ReviewedProfile = z.infer<typeof reviewedProfileSchema>;

/** A value of a moderated field: a text (or its removal), or the logo it points to. */
export const revisionValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), text: z.string().nullable() }),
  z.strictObject({
    kind: z.literal("logo"),
    logoObjectId: z.uuid().nullable(),
  }),
]);
export type RevisionValue = z.infer<typeof revisionValueSchema>;

/** A pending revision: the validated value and the proposed one side by side (06 RG9). */
export const reviewedRevisionSchema = z.strictObject({
  id: z.uuid(),
  fieldCode: moderatedFieldCodeSchema,
  submittedAt: instantSchema,
  validated: revisionValueSchema,
  proposed: revisionValueSchema,
});
export type ReviewedRevision = z.infer<typeof reviewedRevisionSchema>;

const duplicateMatchesSchema = z
  .array(z.strictObject({ accountId: z.uuid(), brandName: z.string() }))
  .min(1);

/**
 * An alert for the moderator (RG19, RG25, RG70, L2BS-8). It names the field and the kind of signal,
 * never the text that matched; a duplicate names the published brand it resembles.
 */
export const reviewAlertSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("direct_contact"),
    field: z.enum(["advertiser.brand_name", "advertiser.presentation"]),
    signals: z.array(contactSignalSchema).min(1),
  }),
  z.strictObject({
    code: z.literal("unusual_website_domain"),
    field: z.literal("advertiser.website_domain"),
  }),
  z.strictObject({
    code: z.literal("duplicate_brand"),
    matches: duplicateMatchesSchema,
  }),
  z.strictObject({
    code: z.literal("duplicate_domain"),
    matches: duplicateMatchesSchema,
  }),
]);
export type ReviewAlert = z.infer<typeof reviewAlertSchema>;

/** A refusal reason with the message the brand will receive, in the brand's language (file.md A6). */
export const reviewReasonSchema = z.strictObject({
  code: rejectionReasonCodeSchema,
  position: z.number().int().positive(),
  requiresMemberMessage: z.boolean(),
  /** The text of the e-mail for this reason: what the agent sees is what is sent (RG66, C6). */
  message: z.string(),
  nextStep: z.string(),
});
export type ReviewReason = z.infer<typeof reviewReasonSchema>;

/** The last forced release of the claim (15 C4, file.md A8): the holder is told at his next opening. */
export const forcedReleaseSchema = z.strictObject({
  releasedAt: instantSchema,
  releasedBy: accountOwnerSchema.nullable(),
  holder: accountOwnerSchema.nullable(),
  holderIsCaller: z.boolean(),
  reasonCode: z.string(),
});

/** The decision of a closed entry (06 RG65, RG68, C8); the internal comment is for agents only. */
export const entryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: accountOwnerSchema.nullable(),
  /** Decided after its deadline (15 C8): marked, never blocked. */
  late: z.boolean(),
  rejectionReasonCode: rejectionReasonCodeSchema.nullable(),
  memberMessage: z.string().nullable(),
  internalComment: z.string().nullable(),
});

export const openedEntrySchema = z.strictObject({
  id: z.uuid(),
  kind: reviewEntryKindSchema,
  state: reviewEntryStateSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: entryDecisionSchema.nullable(),
});

/**
 * The decision view. `reviewToken` is the version of the profile the agent examines (file.md A3,
 * L2BS-1): returned with a claim only, sent back with the decision; a stale one refuses it.
 */
export const openEntryResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  entry: openedEntrySchema,
  account: z.strictObject({
    id: z.uuid(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  profile: reviewedProfileSchema,
  revisions: z.array(reviewedRevisionSchema),
  alerts: z.array(reviewAlertSchema),
  reasons: z.array(reviewReasonSchema),
});
export type OpenEntryResponse = z.infer<typeof openEntryResponseSchema>;

// ---------------------------------------------------------------------------------------------
// The decisions on an entry (commit 12): publish, reject, release, extend, force-release
// (06 RG6, RG65, RG66; 15 RG27 C3, C4, C6, C8; file.md A3, A6, A8, A9, A10; 17b §2.4, §2.6)
// ---------------------------------------------------------------------------------------------

/** `backoffice.claim_release_reasons` (0210, file.md A8): why an administrator lifts a claim. */
export const CLAIM_RELEASE_REASON_CODES = [
  "holder_absent",
  "overdue_entry",
  "wrong_claim",
] as const;
export const claimReleaseReasonCodeSchema = z.enum(CLAIM_RELEASE_REASON_CODES);
export type ClaimReleaseReasonCode = z.infer<
  typeof claimReleaseReasonCodeSchema
>;

/** The bounds the database holds (0210): a refusal message to the brand, an internal comment. */
export const MEMBER_MESSAGE_MIN_LENGTH = 20;
export const MEMBER_MESSAGE_MAX_LENGTH = 500;
export const INTERNAL_COMMENT_MAX_LENGTH = 1000;

/** The version of the profile the agent examined (L2BS-1): the one the opening returned, as is. */
const reviewTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
/** Facultative, for agents only: never shown to the brand, never in an e-mail or the register. */
const internalCommentSchema = z
  .string()
  .min(1)
  .max(INTERNAL_COMMENT_MAX_LENGTH);

/** `POST …/entries/:id/publish` (06 RG6, RG65): a human decision, bound to the version examined. */
export const publishEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  internalComment: internalCommentSchema.optional(),
});
export type PublishEntryRequest = z.infer<typeof publishEntryRequestSchema>;

/**
 * `POST …/entries/:id/reject` (06 RG65, RG66; 15 C6): a typed reason of the closed list, never a
 * refusal without one. `memberMessage` is the agent's own text, for the reason `other` only
 * (20 to 500 characters): the database says which reasons ask for it, and refuses the others.
 */
export const rejectEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: rejectionReasonCodeSchema,
  memberMessage: z
    .string()
    .min(MEMBER_MESSAGE_MIN_LENGTH)
    .max(MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
  internalComment: internalCommentSchema.optional(),
});
export type RejectEntryRequest = z.infer<typeof rejectEntryRequestSchema>;

/** `POST …/entries/:id/force-release` (15 C4, admin only): a typed reason, no free text. */
export const forceReleaseRequestSchema = z.strictObject({
  reasonCode: claimReleaseReasonCodeSchema,
});
export type ForceReleaseRequest = z.infer<typeof forceReleaseRequestSchema>;

/**
 * The entry to open next (17b §2.6): the one with the oldest deadline that nobody holds, among the
 * ones the caller may treat (RG36). Only an identifier: the screen opens it by the opening route,
 * which claims it and is journaled; null when the queue holds nothing to open.
 */
export const nextEntrySchema = z.strictObject({ entryId: z.uuid() }).nullable();

/** 15 C8: `late` marks a decision made after its deadline, which is never blocked. */
export const publishEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  /** The first publication of this account (06 RG78): `profile.completed` goes to the leads. */
  firstPublication: z.boolean(),
  next: nextEntrySchema,
});
export type PublishEntryResponse = z.infer<typeof publishEntryResponseSchema>;

export const rejectEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  next: nextEntrySchema,
});
export type RejectEntryResponse = z.infer<typeof rejectEntryResponseSchema>;

/** `POST …/entries/:id/release` (15 C3, "je rends la main"). */
export const releaseEntryResponseSchema = z.strictObject({
  released: z.literal(true),
});
export type ReleaseEntryResponse = z.infer<typeof releaseEntryResponseSchema>;

/** `POST …/entries/:id/extend` (file.md A9): the new expiry of the caller's claim. */
export const extendEntryResponseSchema = z.strictObject({
  claimExpiresAt: instantSchema,
});
export type ExtendEntryResponse = z.infer<typeof extendEntryResponseSchema>;

/** `POST …/entries/:id/force-release`: the claim is lifted; the dispossessed holder is named. */
export const forceReleaseResponseSchema = z.strictObject({
  released: z.literal(true),
  holder: accountOwnerSchema.nullable(),
});
export type ForceReleaseResponse = z.infer<typeof forceReleaseResponseSchema>;

/**
 * The refusals of a decision, as the `issue` of the details of the error envelope (409 unless
 * said): the claim is held by someone else (`claim` / `held_by_other`, the name in the detail
 * `claim.holder`), the caller holds no live claim (`claim_not_held`: expired, given back, never
 * taken), his claim was lifted by an administrator (`claim_lifted`: open the entry again, the
 * notice is there, A8), the entry is closed, the profile changed since it was opened (`stale_token`:
 * read again, L2BS-1), the profile is not in a state this entry decides (`profile_state`), a
 * required field is missing (path = the field, 06 RG15). A 400 for a value the database refuses
 * (`reasonCode`, `memberMessage`, `internalComment`).
 */
export const DECISION_CONFLICT_ISSUES = [
  "held_by_other",
  "claim_not_held",
  "claim_lifted",
  "entry_closed",
  "stale_token",
  "profile_state",
  "required_field_missing",
] as const;
