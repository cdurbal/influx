// Contract of queues 2 and 3 of the backoffice: « profils créateur à valider » (`profiles_creator`) and
// « visuels de portfolio à modérer » (`portfolio_moderation`) (docs/mvp/07 RG4 to RG10, RG77 to RG83,
// RG93 to RG99; 15 RG26 to RG28, RG33, RG34, RG36, C1 to C8; 17b §2.7 lines 2 and 3; jalons/l2g/
// modele.md §1 points 1, 2, 10, 12, §6; l2g-fiche invariants 1, 5, 7, 10, 13, 14). Shared by apps/api
// and apps/backoffice. It follows the contract of queue 1 (`backoffice-queues.ts`), whose claim, delay,
// cursor and refusal shapes it reuses, and holds what is particular to the creator:
// - Layer I is visible to the agent (he moderates what a brand will never see), but the LIST carries
//   no handle, no link, no figure and no caption: an alias, a country, network codes and a score.
// - Queue 3 has NO thumbnail in its list (D82 (7)): a visual is read by its holder, one at a time,
//   through a route that journals the read; the bytes travel as JSON in base64 like the member's.
// - A caption, a title or a bio is moderated TEXT: the alerts name the field and the kind of signal
//   (07 RG27, RG28), never the text that matched (EC-L2G-12).
// - Every object is closed (strict). Nothing here carries an amount, a rate, a tariff (D48, D78).
// - The message of a refusal is the very text the creator will receive in the e-mail of the decision,
//   written « arobase » / « at sign » where 07 writes the character (EC-L2G-10-1): the screen shows the
//   same words, so that what the agent reads is what is sent.
import { z } from "./zod.ts";
import { uiLocaleSchema } from "./auth.ts";
import { accountOwnerSchema } from "./backoffice-accounts.ts";
import {
  claimReleaseReasonCodeSchema,
  contactSignalSchema,
  DECISION_CONFLICT_ISSUES,
  entryClaimSchema,
  forcedReleaseSchema,
  INTERNAL_COMMENT_MAX_LENGTH,
  nextEntrySchema,
  openOutcomeSchema,
  queueCursorSchema,
  queuePolicySchema,
  QUEUE_PAGE_SIZE_DEFAULT,
  QUEUE_PAGE_SIZE_MAX,
  reviewEntryKindSchema,
  reviewEntryStateSchema,
} from "./backoffice-queues.ts";
import {
  availabilityBandSchema,
  collaborationExperienceBandSchema,
  creatorExclusivityBandSchema,
  creatorProfileStatusSchema,
  creatorRejectionReasonCodeSchema,
  CREATOR_FIGURES_SOURCES,
  CREATOR_MEMBER_MESSAGE_MAX_LENGTH,
  CREATOR_MEMBER_MESSAGE_MIN_LENGTH,
  CREATOR_MODERATED_FIELDS,
  deliveryLeadBandSchema,
  travelScopeSchema,
  usageRightInclusionSchema,
} from "./creator-profile.ts";
import {
  portfolioImageResponseSchema,
  portfolioRejectionReasonCodeSchema,
} from "./creator-portfolio.ts";
import { countryCodeSchema } from "./signup.ts";
import { verificationLevelSchema } from "./verification.ts";

/** The codes of the two queues in `backoffice.queues` (0243, 0244) and in the register payloads. */
export const CREATOR_REVIEW_QUEUE = "profiles_creator";
export const PORTFOLIO_REVIEW_QUEUE = "portfolio_moderation";
export const creatorQueueCodeSchema = z.enum([
  CREATOR_REVIEW_QUEUE,
  PORTFOLIO_REVIEW_QUEUE,
]);
export type CreatorQueueCode = z.infer<typeof creatorQueueCodeSchema>;

const instantSchema = z.iso.datetime();
const reviewTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
/** Facultative, for agents only: never shown to the creator, never in an e-mail or the register. */
const internalCommentSchema = z
  .string()
  .min(1)
  .max(INTERNAL_COMMENT_MAX_LENGTH);
/** A code of `reference.networks`: lower case, letters, digits and underscores. */
const networkCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,30}$/);

export const creatorEntryParamsSchema = z.strictObject({ id: z.uuid() });
export type CreatorEntryParams = z.infer<typeof creatorEntryParamsSchema>;
/** The visual of an entry of queue 2, named by the id the decision view served (`profile.visuals`). */
export const creatorEntryItemParamsSchema = z.strictObject({
  id: z.uuid(),
  itemId: z.uuid(),
});
export type CreatorEntryItemParams = z.infer<
  typeof creatorEntryItemParamsSchema
>;

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32): carried by the two lists, as the caller sees the queue (RG36)
// ---------------------------------------------------------------------------------------------

/**
 * The permanent counters of one of the two queues (15 RG28). They ride on the list answer: the
 * dashboard summary of `GET /v1/bo/queues/counters` keeps its closed list of queue codes (EC-L2G-11-1).
 */
export const creatorQueueCountersSchema = z.strictObject({
  queue: creatorQueueCodeSchema,
  pending: z.number().int().nonnegative(),
  oldestCreatedAt: instantSchema.nullable(),
  overdue: z.number().int().nonnegative(),
  unclaimed: z.number().int().nonnegative(),
  lastDecidedAt: instantSchema.nullable(),
  policy: queuePolicySchema,
});
export type CreatorQueueCounters = z.infer<typeof creatorQueueCountersSchema>;

// ---------------------------------------------------------------------------------------------
// Alerts (07 RG27, RG28; 15 RG93; EC-L2G-12): informative, never a refusal
// ---------------------------------------------------------------------------------------------

export const CREATOR_ALERT_CODES = ["direct_contact"] as const;
export const creatorAlertCodeSchema = z.enum(CREATOR_ALERT_CODES);
export type CreatorAlertCode = z.infer<typeof creatorAlertCodeSchema>;

export const CREATOR_ALERT_FIELDS = [
  "headline",
  "bio",
  "portfolio_caption",
] as const;

/** An identifying element in a moderated text: the field, the kind of signal, never the text. */
export const creatorReviewAlertSchema = z.strictObject({
  code: z.literal("direct_contact"),
  field: z.enum(CREATOR_ALERT_FIELDS),
  /** The visual of a caption; null for the title and the bio. */
  rowKey: z.uuid().nullable(),
  signals: z.array(contactSignalSchema).min(1),
});
export type CreatorReviewAlert = z.infer<typeof creatorReviewAlertSchema>;

// ---------------------------------------------------------------------------------------------
// The lists (15 RG26, RG27 C5, RG33, RG34; 17b §2.7)
// ---------------------------------------------------------------------------------------------

/** A period that ends before it starts is refused, never read as an empty list. */
function periodIsOrdered(filters: { from?: string; to?: string }): boolean {
  return (
    filters.from === undefined ||
    filters.to === undefined ||
    Date.parse(filters.from) <= Date.parse(filters.to)
  );
}

const commonFilterShape = {
  overdue: z.literal("true").optional(),
  holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
  owner: z.union([z.literal("none"), z.uuid()]).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  alert: z.literal("true").optional(),
  cursor: queueCursorSchema.optional(),
};

/** Queue 2 (17b: country, network, with or without a badge; and the kind: submission or revision). */
const creatorFilterShape = {
  ...commonFilterShape,
  kind: reviewEntryKindSchema.optional(),
  country: countryCodeSchema.optional(),
  network: networkCodeSchema.optional(),
  badge: z.enum(["with", "without"]).optional(),
};

export const creatorEntriesQuerySchema = z
  .strictObject({
    ...creatorFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type CreatorEntriesQuery = z.infer<typeof creatorEntriesQuerySchema>;

/** The same page, the filters, the period and the cursor in the body (the relay refuses instants in a query). */
export const creatorEntriesSearchSchema = z
  .strictObject({
    ...creatorFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type CreatorEntriesSearch = z.infer<typeof creatorEntriesSearchSchema>;
export type CreatorEntriesSearchBody = z.input<
  typeof creatorEntriesSearchSchema
>;

/** The kind of a visual of queue 3: a first deposit, or the replacement of an approved visual (RG81). */
export const PORTFOLIO_ENTRY_KINDS = ["deposit", "replacement"] as const;
export const portfolioEntryKindSchema = z.enum(PORTFOLIO_ENTRY_KINDS);
export type PortfolioEntryKind = z.infer<typeof portfolioEntryKindSchema>;

/** Queue 3 (17b: the profile, and the type). */
const portfolioFilterShape = {
  ...commonFilterShape,
  account: z.uuid().optional(),
  kind: portfolioEntryKindSchema.optional(),
};

export const portfolioEntriesQuerySchema = z
  .strictObject({
    ...portfolioFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type PortfolioEntriesQuery = z.infer<typeof portfolioEntriesQuerySchema>;

export const portfolioEntriesSearchSchema = z
  .strictObject({
    ...portfolioFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type PortfolioEntriesSearch = z.infer<
  typeof portfolioEntriesSearchSchema
>;
export type PortfolioEntriesSearchBody = z.input<
  typeof portfolioEntriesSearchSchema
>;

/** One line of queue 2 (17b: alias, country, networks declared, completeness, badges): no coordinate. */
export const creatorEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  kind: reviewEntryKindSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  /** 15 RG27 C5: past its deadline; written in clear by the screen, never by colour alone. */
  overdue: z.boolean(),
  /** The public alias (07 RG23): the title of the line, never a name. */
  alias: z.string(),
  countryCode: countryCodeSchema,
  /** The networks of the lines declared, the main one first: codes, never a handle. */
  networks: z.array(networkCodeSchema),
  /** The badges in force (08): the network and the level, never a figure. */
  badges: z.array(
    z.strictObject({
      networkCode: networkCodeSchema,
      level: verificationLevelSchema,
    }),
  ),
  completenessPercent: z.number().int().min(0).max(100).nullable(),
  /** The fields a revision changes; empty for a first submission. */
  modifiedFields: z.array(z.enum(CREATOR_MODERATED_FIELDS)),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
  alerts: z.array(creatorAlertCodeSchema),
});
export type CreatorEntryRow = z.infer<typeof creatorEntryRowSchema>;

export const creatorEntriesResponseSchema = z.strictObject({
  /** The instant of the database: durations are computed from it, never from a client clock. */
  asOf: instantSchema,
  counters: creatorQueueCountersSchema.nullable(),
  items: z.array(creatorEntryRowSchema),
  /** Null at the last page: no infinite scroll (15 RG34, CA18). */
  nextCursor: queueCursorSchema.nullable(),
});
export type CreatorEntriesResponse = z.infer<
  typeof creatorEntriesResponseSchema
>;

/**
 * One line of queue 3 (17b: the profile, the date of the deposit, the number of visuals of the
 * profile). NO thumbnail (D82 (7)): the visual is read by its holder, one at a time, and the read is
 * journaled; the list names the profile by its alias, never by a handle nor a caption.
 */
export const portfolioEntryRowSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  alias: z.string(),
  kind: portfolioEntryKindSchema,
  /** The instant the visual entered the queue: its deposit stored (the deadline runs from it). */
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  /** The visuals of the profile that count as deposited (07 RG4, RG88). */
  visualCount: z.number().int().nonnegative(),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
  alerts: z.array(creatorAlertCodeSchema),
});
export type PortfolioEntryRow = z.infer<typeof portfolioEntryRowSchema>;

export const portfolioEntriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  counters: creatorQueueCountersSchema.nullable(),
  items: z.array(portfolioEntryRowSchema),
  nextCursor: queueCursorSchema.nullable(),
});
export type PortfolioEntriesResponse = z.infer<
  typeof portfolioEntriesResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// The decision views (07 RG93, RG94; 15 C1, C2; l2g/modele.md §1 points 9, 10)
// ---------------------------------------------------------------------------------------------

/** A value of a moderated field, validated or proposed (07 RG9, modele point 6). */
export const creatorRevisionValueSchema = z.discriminatedUnion("kind", [
  /** The title, the bio, a handle, a link: a text (or its removal). */
  z.strictObject({ kind: z.literal("text"), text: z.string().nullable() }),
  /** A network line added to a published profile: the network it names. */
  z.strictObject({ kind: z.literal("line"), networkCode: networkCodeSchema }),
  /** A caption of an approved visual, with the statement of RG83 it comes with. */
  z.strictObject({
    kind: z.literal("caption"),
    caption: z.string().nullable(),
    brandDeclared: z.boolean(),
  }),
]);
export type CreatorRevisionValue = z.infer<typeof creatorRevisionValueSchema>;

/** A pending revision: the validated value and the proposed one side by side (07 RG9). */
export const creatorReviewedRevisionSchema = z.strictObject({
  id: z.uuid(),
  field: z.enum(CREATOR_MODERATED_FIELDS),
  /** The visual or the line; null for the title and the bio. */
  rowKey: z.uuid().nullable(),
  submittedAt: instantSchema,
  /** What is served today; null for a line not yet listed. */
  validated: creatorRevisionValueSchema.nullable(),
  proposed: creatorRevisionValueSchema,
});
export type CreatorReviewedRevision = z.infer<
  typeof creatorReviewedRevisionSchema
>;

/** The reasons of a refusal, each with the message the creator will receive (07 RG96; EC-L2G-10-1). */
export const creatorReviewReasonSchema = z.strictObject({
  code: creatorRejectionReasonCodeSchema,
  position: z.number().int().positive(),
  requiresMemberMessage: z.boolean(),
  /** The text of the e-mail for this reason: what the agent sees is what is sent. */
  message: z.string(),
  nextStep: z.enum(["fix", "contact"]),
  /** The sentence that closes the e-mail for this step. */
  nextStepMessage: z.string(),
});
export type CreatorReviewReason = z.infer<typeof creatorReviewReasonSchema>;

/** The grid of RG79, RG82, RG83 with the message of the e-mail (no message of the agent: RG97). */
export const portfolioReviewReasonSchema = z.strictObject({
  code: portfolioRejectionReasonCodeSchema,
  position: z.number().int().positive(),
  /** The control of the grid of RG79 (1 to 5, 7, 9); null for the two caption reasons. */
  gridControl: z.number().int().min(1).max(9).nullable(),
  message: z.string(),
});
export type PortfolioReviewReason = z.infer<typeof portfolioReviewReasonSchema>;

const decidedBySchema = accountOwnerSchema.nullable();

/** The decision of a closed entry of queue 2 (07 RG10, RG96, C8); the internal comment is for agents only. */
export const creatorEntryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: decidedBySchema,
  /** Decided after its deadline (15 C8): marked, never blocked. */
  late: z.boolean(),
  rejectionReasonCode: creatorRejectionReasonCodeSchema.nullable(),
  memberMessage: z.string().nullable(),
  internalComment: z.string().nullable(),
});

/** The decision of a visual (07 RG78, RG95): a typed reason on a refusal, never a message. */
export const portfolioEntryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: decidedBySchema,
  late: z.boolean(),
  rejectionReasonCode: portfolioRejectionReasonCodeSchema.nullable(),
  internalComment: z.string().nullable(),
});

/** One line of the profile (layer I, for the agent who moderates it). */
export const creatorReviewedLineSchema = z.strictObject({
  id: z.uuid(),
  networkCode: networkCodeSchema,
  isPrimary: z.boolean(),
  /** Layer A serves the line only once listed (modele point 6); a line added to a published profile waits. */
  listed: z.boolean(),
  handle: z.string().nullable(),
  pseudonym: z.string().nullable(),
  profileUrl: z.string().nullable(),
  followers: z.number().int().nonnegative().nullable(),
  postsLast30Days: z.number().int().nonnegative().nullable(),
  avgComments: z.number().int().nonnegative().nullable(),
  avgReach: z.number().int().nonnegative().nullable(),
  engagementRateBp: z.number().int().nonnegative().nullable(),
  figuresSource: z.enum(CREATOR_FIGURES_SOURCES),
  figuresMeasuredAt: instantSchema.nullable(),
  /** The badge on this line in force, if any (08). */
  badge: verificationLevelSchema.nullable(),
});
export type CreatorReviewedLine = z.infer<typeof creatorReviewedLineSchema>;

/** A visual of the profile that counts for the decision: pending or approved (modele point 10). */
export const creatorReviewedVisualSchema = z.strictObject({
  id: z.uuid(),
  state: z.enum(["pending", "approved"]),
  displayOrder: z.number().int().min(1).max(8).nullable(),
  caption: z.string().nullable(),
  brandDeclared: z.boolean(),
  replacesItemId: z.uuid().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
  createdAt: instantSchema,
});
export type CreatorReviewedVisual = z.infer<typeof creatorReviewedVisualSchema>;

/**
 * The profile as the live rows hold it: the last VALIDATED version of the titles, bio and captions
 * (07 RG9, CA48), whatever the entry. Layer N (names, address, contact) is NOT here: no decision needs
 * it (07 RG16), the record of the account is the only place an agent reads it.
 */
export const creatorReviewedProfileSchema = z.strictObject({
  alias: z.string(),
  status: creatorProfileStatusSchema,
  firstPublishedAt: instantSchema.nullable(),
  completenessPercent: z.number().int().min(0).max(100).nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  primaryTopic: z.string().nullable(),
  residenceRegion: z.string().nullable(),
  travelScope: travelScopeSchema.nullable(),
  collaborationExperience: collaborationExperienceBandSchema.nullable(),
  deliveryLead: deliveryLeadBandSchema.nullable(),
  maxExclusivity: creatorExclusivityBandSchema.nullable(),
  acceptsNonMonetary: z.boolean(),
  availability: availabilityBandSchema.nullable(),
  lists: z.strictObject({
    secondaryTopics: z.array(z.string()),
    tones: z.array(z.string()),
    publicationLanguages: z.array(z.string()),
    formats: z.array(z.string()),
    usageRights: z.array(
      z.strictObject({
        code: z.string(),
        inclusion: usageRightInclusionSchema,
      }),
    ),
    refusedSectors: z.array(z.string()),
  }),
  lines: z.array(creatorReviewedLineSchema),
  visuals: z.array(creatorReviewedVisualSchema),
});
export type CreatorReviewedProfile = z.infer<
  typeof creatorReviewedProfileSchema
>;

export const openedCreatorEntrySchema = z.strictObject({
  id: z.uuid(),
  kind: reviewEntryKindSchema,
  state: reviewEntryStateSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: creatorEntryDecisionSchema.nullable(),
});

/**
 * `POST …/profiles-creator/entries/:id/open`: opening is claiming (15 C1). `reviewToken` is the version
 * the agent examines (l2c/file.md A3): returned with a claim only, sent back with the decision; a
 * stale one refuses it. The bytes of a visual are NOT here: they are read one by one, by the holder,
 * through `…/entries/:id/portfolio/:itemId/image` (D82 (7)).
 */
export const openCreatorEntryResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  entry: openedCreatorEntrySchema,
  account: z.strictObject({
    id: z.uuid(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  profile: creatorReviewedProfileSchema,
  revisions: z.array(creatorReviewedRevisionSchema),
  alerts: z.array(creatorReviewAlertSchema),
  reasons: z.array(creatorReviewReasonSchema),
});
export type OpenCreatorEntryResponse = z.infer<
  typeof openCreatorEntryResponseSchema
>;

/** The visual that a replacement takes the place of (RG81): what it is today. */
export const replacedVisualSchema = z.strictObject({
  id: z.uuid(),
  displayOrder: z.number().int().min(1).max(8).nullable(),
  caption: z.string().nullable(),
});

export const openedPortfolioItemSchema = z.strictObject({
  id: z.uuid(),
  kind: portfolioEntryKindSchema,
  state: z.enum([
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "purging",
    "purged",
  ]),
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: portfolioEntryDecisionSchema.nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
  caption: z.string().nullable(),
  /** The statement of RG83 came with this caption (declared, dated, kept by the base). */
  brandDeclared: z.boolean(),
  replaces: replacedVisualSchema.nullable(),
});

/**
 * `POST …/portfolio-moderation/entries/:id/open`: the entry IS the visual (modele point 2). No bytes
 * here either: `…/entries/:id/image` relays them to the holder of the claim, journaled.
 */
export const openPortfolioItemResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  item: openedPortfolioItemSchema,
  account: z.strictObject({
    id: z.uuid(),
    alias: z.string(),
    countryCode: countryCodeSchema,
    preferredLanguage: uiLocaleSchema,
    owner: accountOwnerSchema.nullable(),
  }),
  alerts: z.array(creatorReviewAlertSchema),
  reasons: z.array(portfolioReviewReasonSchema),
});
export type OpenPortfolioItemResponse = z.infer<
  typeof openPortfolioItemResponseSchema
>;

/**
 * `GET …/entries/:id/portfolio/:itemId/image` (queue 2) and `GET …/entries/:id/image` (queue 3): the
 * visual relayed as JSON, to the HOLDER of a live claim only (D82 (7)), one line of the register per
 * read (`queue.portfolio_read`). Never a key, an address of Storage or a token.
 */
export const reviewImageResponseSchema = z.strictObject({
  state: z.enum(["pending", "approved"]),
  image: portfolioImageResponseSchema,
});
export type ReviewImageResponse = z.infer<typeof reviewImageResponseSchema>;

// ---------------------------------------------------------------------------------------------
// The acts (15 RG27 C3, C4, C6, C8; 07 RG5, RG10, RG78, RG95 to RG98)
// ---------------------------------------------------------------------------------------------

/** `POST …/profiles-creator/entries/:id/publish` (07 RG5): a human decision, bound to the version examined. */
export const publishCreatorEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  internalComment: internalCommentSchema.optional(),
});
export type PublishCreatorEntryRequest = z.infer<
  typeof publishCreatorEntryRequestSchema
>;

/**
 * `POST …/profiles-creator/entries/:id/reject` (07 RG10, RG96): a typed reason of the closed list, never
 * a refusal without one. `memberMessage` is the agent's own text, for the reason `other` only (20 to 500
 * characters, no direct contact: RG19, RG158); the database says which reasons ask for it.
 */
export const rejectCreatorEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: creatorRejectionReasonCodeSchema,
  memberMessage: z
    .string()
    .min(CREATOR_MEMBER_MESSAGE_MIN_LENGTH)
    .max(CREATOR_MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
  internalComment: internalCommentSchema.optional(),
});
export type RejectCreatorEntryRequest = z.infer<
  typeof rejectCreatorEntryRequestSchema
>;

/** `POST …/portfolio-moderation/entries/:id/approve` (07 RG78, RG95): one visual, one decision. */
export const approvePortfolioItemRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  internalComment: internalCommentSchema.optional(),
});
export type ApprovePortfolioItemRequest = z.infer<
  typeof approvePortfolioItemRequestSchema
>;

/** `POST …/portfolio-moderation/entries/:id/reject` (07 RG79, RG97): a reason of the grid; no message, no `other`. */
export const rejectPortfolioItemRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: portfolioRejectionReasonCodeSchema,
  internalComment: internalCommentSchema.optional(),
});
export type RejectPortfolioItemRequest = z.infer<
  typeof rejectPortfolioItemRequestSchema
>;

/** `POST …/entries/:id/force-release` (15 C4, admin only): a typed reason, no free text. */
export const forceReleaseCreatorEntryRequestSchema = z.strictObject({
  reasonCode: claimReleaseReasonCodeSchema,
});

/** 15 C8: `late` marks a decision made after its deadline, which is never blocked. */
export const publishCreatorEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  /** The first publication of this account (07 RG106): `profile.completed` goes to the leads. */
  firstPublication: z.boolean(),
  next: nextEntrySchema,
});
export type PublishCreatorEntryResponse = z.infer<
  typeof publishCreatorEntryResponseSchema
>;

/** A refusal, an approval: the instant and the lateness the database gave back (decided_at, sla_breached). */
export const decidedEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  next: nextEntrySchema,
});
export type DecidedEntryResponse = z.infer<typeof decidedEntryResponseSchema>;

/**
 * The refusals of a decision, as the `issue` of the details of the error envelope (409 unless said):
 * those of queue 1 (`held_by_other`, `claim_not_held`, `claim_lifted`, `entry_closed`, `stale_token`,
 * `profile_state`, `required_field_missing`, the path of the last one being the field) and the two of
 * L2G: the handle of a line under an active « Compte vérifié » belongs to queue 6 (`verified_handle`),
 * and a replacement whose original is no longer approved cannot take its place (`not_replaceable`).
 */
export const CREATOR_DECISION_CONFLICT_ISSUES = [
  ...DECISION_CONFLICT_ISSUES,
  "verified_handle",
  "not_replaceable",
] as const;
export type CreatorDecisionConflictIssue =
  (typeof CREATOR_DECISION_CONFLICT_ISSUES)[number];
