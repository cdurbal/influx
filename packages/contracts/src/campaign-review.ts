// Contract of queue 7 of the backoffice, « campagnes à valider » (`campaigns`), and of the record of a
// campaign for an agent (docs/mvp/09 RG1, RG5, RG8, RG9, RG85, RG87 to RG95, RG93, RG94; 15 RG26 to RG28,
// RG33, RG34, RG36, C1 to C8; 17b §3.8; jalons/l3c/modele.md §1, §3 to §6; l3c-fiche invariants 1, 2, 4
// to 6, 11, 12). Shared by apps/api and apps/backoffice. It follows the contract of queues 2 and 3
// (`creator-queues.ts`), whose claim, delay, cursor and refusal shapes it reuses, and holds what is
// particular to a campaign:
// - The LIST carries the brand, the title, the category, the mention of the enhanced review, the alerts of
//   detection and the duplicate alert (09 RG87): no text of the campaign, no band.
// - The budget is read by the LABEL of its band (D78, fiche invariant 12): the key of the label, never a
//   bound, a total or an amount. No operation on an amount exists in any route (D48, T16).
// - The first opinion of an enhanced review and the version token are returned to the holder of a live
//   claim only; the internal comment is never served (no right on its column, modele §9).
// - A detection alert names the field and the kind of signal (09 RG21 to RG23), never the text.
// - Every object is closed (strict). Nothing here carries a rate, a commission or a net (CLAUDE.md §2).
import { z } from "./zod.ts";
import { uiLocaleSchema } from "./auth.ts";
import { accountOwnerSchema } from "./backoffice-accounts.ts";
import {
  claimReleaseReasonCodeSchema,
  CONTACT_SIGNAL_CODES,
  entryClaimSchema,
  forcedReleaseSchema,
  INTERNAL_COMMENT_MAX_LENGTH,
  nextEntrySchema,
  openOutcomeSchema,
  queueCursorSchema,
  queuePolicySchema,
  QUEUE_PAGE_SIZE_DEFAULT,
  QUEUE_PAGE_SIZE_MAX,
  reviewEntryStateSchema,
} from "./backoffice-queues.ts";
import { exclusivityBandSchema } from "./brand-profile.ts";
import {
  campaignDeliverableSchema,
  campaignRejectionReasonCodeSchema,
  campaignStatusSchema,
  contentReviewDelaySchema,
  remunerationKindSchema,
  shippingPayerSchema,
  usageRightsDurationSchema,
  usageRightsTerritoryScopeSchema,
} from "./campaign.ts";
import { countryCodeSchema } from "./signup.ts";

/** The code of the queue in `backoffice.queues` (0307) and in the register payloads. */
export const CAMPAIGN_REVIEW_QUEUE = "campaigns";

const instantSchema = z.iso.datetime();
const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reviewTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
/** A code of a `reference.*` table: snake_case, at most 63 characters (0201). */
const referenceCodeSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);
/** Facultative, for agents only: never shown to the brand, never in an e-mail or the register (RG92). */
const internalCommentSchema = z
  .string()
  .min(1)
  .max(INTERNAL_COMMENT_MAX_LENGTH);

/**
 * The refusal reasons of a campaign (09 RG90, `campaigns.rejection_reasons`, 0303): the closed list, written
 * once in ./campaign.ts, which the brand's own refusal also reads (L3C-10), and re-exported here.
 */
export {
  CAMPAIGN_REJECTION_REASON_CODES,
  campaignRejectionReasonCodeSchema,
  type CampaignRejectionReasonCode,
} from "./campaign.ts";

/** The message the brand will receive for `illicit_content` and `other` (09 RG90): 20 to 500 characters. */
export const CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH = 20;
export const CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH = 500;
/** The reasoned opinion of the first examination of an enhanced review (modele §3): 20 to 1 000. */
export const CAMPAIGN_OPINION_MIN_LENGTH = 20;
export const CAMPAIGN_OPINION_MAX_LENGTH = 1000;

/** The reasons of an intervention of an agent (09 RG94, `campaigns.agent_interventions`, 0309). */
export const INTERVENTION_REASON_CODES = [
  "brand_request",
  "entry_error",
  "non_compliant_content",
  "other",
] as const;
export const interventionReasonCodeSchema = z.enum(INTERVENTION_REASON_CODES);
export type InterventionReasonCode = z.infer<
  typeof interventionReasonCodeSchema
>;

/** The kinds of intervention an agent leaves on a campaign (0309). */
export const INTERVENTION_KINDS = [
  "created",
  "corrected",
  "paused",
  "resumed",
  "closed",
] as const;
export const interventionKindSchema = z.enum(INTERVENTION_KINDS);

/** The fields an agent may correct (modele §6): the codes of `agent_interventions.field_code`. */
export const CAMPAIGN_CORRECTABLE_FIELDS = [
  "title",
  "campaign_type",
  "public_summary",
  "brief",
  "internal_reference",
  "product_description",
  "product_sector",
  "restrictions",
  "key_messages",
  "product_is_sent",
  "product_value_band",
  "creator_keeps_product",
  "shipping_costs_borne_by",
  "deliverables",
  "usage_rights",
  "usage_rights_duration",
  "usage_rights_territory",
  "exclusivity",
  "content_review_delay",
  "audience_countries",
  "audience_languages",
  "audience_bands",
  "audience_age_bands",
  "audience_gender",
  "audience_topics",
  "currency",
  "remuneration_kind",
  "budget_band",
  "creators_wanted",
  "total_budget",
  "applications_close_on",
  "content_due_on",
  "starts_on",
  "ends_on",
  "max_applications",
  "requested_items",
] as const;
export const campaignCorrectableFieldSchema = z.enum(
  CAMPAIGN_CORRECTABLE_FIELDS,
);
export type CampaignCorrectableField = z.infer<
  typeof campaignCorrectableFieldSchema
>;

/**
 * The fields whose value is a figure, a band or the currency: a correction of one is recorded and told
 * (code only), but its old and new values are never served back, even to an agent (D78, invariant 12).
 */
export const CAMPAIGN_UNSERVED_VALUE_FIELDS: readonly CampaignCorrectableField[] =
  ["currency", "budget_band", "total_budget", "product_value_band"];

// ---------------------------------------------------------------------------------------------
// Counters and alerts (15 RG28; 09 RG21 to RG23, RG95)
// ---------------------------------------------------------------------------------------------

export const campaignQueueCountersSchema = z.strictObject({
  queue: z.literal(CAMPAIGN_REVIEW_QUEUE),
  pending: z.number().int().nonnegative(),
  oldestCreatedAt: instantSchema.nullable(),
  overdue: z.number().int().nonnegative(),
  unclaimed: z.number().int().nonnegative(),
  lastDecidedAt: instantSchema.nullable(),
  policy: queuePolicySchema,
});
export type CampaignQueueCounters = z.infer<typeof campaignQueueCountersSchema>;

/** What a line of the list warns of: the kinds of detection (RG21 to RG23) and the duplicate (RG95). */
export const CAMPAIGN_ALERT_CODES = [
  "contact",
  "link",
  "amount",
  "duplicate",
] as const;
export const campaignAlertCodeSchema = z.enum(CAMPAIGN_ALERT_CODES);
export type CampaignAlertCode = z.infer<typeof campaignAlertCodeSchema>;

/** The texts of a campaign the detection reads (the twin of packages/domain `CAMPAIGN_FREE_TEXT_FIELDS`). */
export const CAMPAIGN_ALERT_FIELDS = [
  "title",
  "publicSummary",
  "brief",
  "productDescription",
  "restrictions",
  "keyMessages",
] as const;

/** One finding of detection in a text: the kind, the field, the key message of a list, the shapes; never the text. */
export const campaignTextAlertSchema = z.strictObject({
  code: z.enum(["contact", "link", "amount"]),
  field: z.enum(CAMPAIGN_ALERT_FIELDS),
  /** The rank (from 0) of the key message; null for a single text. */
  position: z.number().int().min(0).nullable(),
  signals: z.array(z.enum([...CONTACT_SIGNAL_CODES, "amount"])).min(1),
});
export type CampaignTextAlert = z.infer<typeof campaignTextAlertSchema>;

/** The campaign a duplicate alert points at (RG95): information, never a refusal. */
export const campaignDuplicateSchema = z.strictObject({
  campaignId: z.uuid(),
  title: z.string().nullable(),
  status: campaignStatusSchema,
});

// ---------------------------------------------------------------------------------------------
// The list (15 RG26, RG27 C5, RG33, RG34; 09 RG87)
// ---------------------------------------------------------------------------------------------

function periodIsOrdered(filters: { from?: string; to?: string }): boolean {
  return (
    filters.from === undefined ||
    filters.to === undefined ||
    Date.parse(filters.from) <= Date.parse(filters.to)
  );
}

/** The filters common to every queue (15 RG33): no filter is added without the project manager. */
const campaignFilterShape = {
  overdue: z.literal("true").optional(),
  holder: z.union([z.enum(["free", "me"]), z.uuid()]).optional(),
  owner: z.union([z.literal("none"), z.uuid()]).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  alert: z.literal("true").optional(),
  cursor: queueCursorSchema.optional(),
};

export const campaignEntriesQuerySchema = z
  .strictObject({
    ...campaignFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type CampaignEntriesQuery = z.infer<typeof campaignEntriesQuerySchema>;

/** The same page, the filters, the period and the cursor in the body (the relay refuses instants in a query). */
export const campaignEntriesSearchSchema = z
  .strictObject({
    ...campaignFilterShape,
    limit: z
      .number()
      .int()
      .min(1)
      .max(QUEUE_PAGE_SIZE_MAX)
      .default(QUEUE_PAGE_SIZE_DEFAULT),
  })
  .refine(periodIsOrdered, { message: "period_order" });
export type CampaignEntriesSearch = z.infer<typeof campaignEntriesSearchSchema>;
export type CampaignEntriesSearchBody = z.input<
  typeof campaignEntriesSearchSchema
>;

/** The phase of an entry: one examination, or the two of an enhanced review (09 RG85). */
export const CAMPAIGN_REVIEW_PHASES = ["single", "first", "second"] as const;
export const campaignReviewPhaseSchema = z.enum(CAMPAIGN_REVIEW_PHASES);
export type CampaignReviewPhase = z.infer<typeof campaignReviewPhaseSchema>;

/** One line of queue 7 (09 RG87): the brand, the title, the category, the mention, the alerts. */
export const campaignEntryRowSchema = z.strictObject({
  id: z.uuid(),
  campaignId: z.uuid(),
  advertiserAccountId: z.uuid(),
  brandName: z.string().nullable(),
  title: z.string().nullable(),
  campaignType: z.string().nullable(),
  sectorCode: z.string().nullable(),
  /** The sector is sensitive: two persons are required (RG85), read by join on every list. */
  enhancedReview: z.boolean(),
  /** `second`: the first examination is given, its author is named; the entry is hidden from him. */
  phase: campaignReviewPhaseSchema,
  firstReviewer: accountOwnerSchema.nullable(),
  /** The submission of the campaign: the instant the entry opened. */
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  owner: accountOwnerSchema.nullable(),
  claim: entryClaimSchema,
  alerts: z.array(campaignAlertCodeSchema),
});
export type CampaignEntryRow = z.infer<typeof campaignEntryRowSchema>;

export const campaignEntriesResponseSchema = z.strictObject({
  asOf: instantSchema,
  counters: campaignQueueCountersSchema.nullable(),
  items: z.array(campaignEntryRowSchema),
  /** Null at the last page: no infinite scroll (15 RG34, CA18). */
  nextCursor: queueCursorSchema.nullable(),
});
export type CampaignEntriesResponse = z.infer<
  typeof campaignEntriesResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// The campaign as an agent reads it (17b §3.8 block 2 and 3; 09 blocks 1 to 7)
// ---------------------------------------------------------------------------------------------

/** The brand of a campaign, as the agent who examines it sees it. */
export const campaignBrandSchema = z.strictObject({
  accountId: z.uuid(),
  name: z.string().nullable(),
  countryCode: countryCodeSchema,
  preferredLanguage: uiLocaleSchema,
  owner: accountOwnerSchema.nullable(),
  /** « Compte vérifié » of the brand in force (08). */
  verified: z.boolean(),
  /** The campaigns of the brand that are, or were, published (the line of 17b §3.8, block 1). */
  publishedCount: z.number().int().nonnegative(),
});

/**
 * The fields of the form as stored (null, [] when not entered), for the agent. The budget is its band
 * by the KEY of its label (D78): never the bounds, the total or the product value; the currency is not
 * served either. No amount exists in it.
 */
export const campaignFieldsSchema = z.strictObject({
  title: z.string().nullable(),
  campaignType: z.string().nullable(),
  publicSummary: z.string().nullable(),
  brief: z.string().nullable(),
  internalReference: z.string().nullable(),
  productDescription: z.string().nullable(),
  productSector: z.string().nullable(),
  /** The sector of the product is sensitive (09 RG84), read by join, never stored. */
  sectorIsSensitive: z.boolean(),
  restrictions: z.string().nullable(),
  keyMessages: z.array(z.string()),
  productIsSent: z.boolean().nullable(),
  creatorKeepsProduct: z.boolean().nullable(),
  shippingCostsBorneBy: shippingPayerSchema.nullable(),
  deliverables: z.array(campaignDeliverableSchema),
  usageRights: z.string().nullable(),
  usageRightsDuration: usageRightsDurationSchema.nullable(),
  usageRightsTerritoryScope: usageRightsTerritoryScopeSchema.nullable(),
  usageRightsTerritories: z.array(countryCodeSchema),
  exclusivity: exclusivityBandSchema.nullable(),
  contentReviewDelay: contentReviewDelaySchema.nullable(),
  contentDueOn: civilDateSchema.nullable(),
  audienceGender: z.string().nullable(),
  audienceCountries: z.array(countryCodeSchema),
  audienceLanguages: z.array(z.string()),
  audienceBands: z.array(z.string()),
  audienceAgeBands: z.array(z.string()),
  audienceTopics: z.array(z.string()),
  remunerationKind: remunerationKindSchema.nullable(),
  /** The key of the label of the budget band per creator (`price_band.<code>`), D78; null when none. */
  budgetBandLabelKey: z.string().nullable(),
  creatorsWanted: z.number().int().nullable(),
  applicationsCloseOn: civilDateSchema.nullable(),
  startsOn: civilDateSchema.nullable(),
  endsOn: civilDateSchema.nullable(),
  maxApplications: z.number().int().nullable(),
  requestedItems: z.array(z.string()),
});
export type CampaignFields = z.infer<typeof campaignFieldsSchema>;

/** The state and the cycle of the campaign (09 RG3, RG8, RG9). */
export const campaignCycleSchema = z.strictObject({
  status: campaignStatusSchema,
  submittedAt: instantSchema.nullable(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
  firstPublishedAt: instantSchema.nullable(),
  pausedAt: instantSchema.nullable(),
  /** Who paused it: the brand may resume its own pause, never INFLUX's (modele §5). */
  pauseOrigin: z.enum(["brand", "influx"]).nullable(),
  closedAt: instantSchema.nullable(),
  /** The commercial responsible, named at the publication (RG6, CA63). */
  owner: accountOwnerSchema.nullable(),
  /** The version of the instant served to creators; null before the first publication. */
  snapshotVersion: z.number().int().positive().nullable(),
});

/** The refusal of an entry or the decision that closed it: no internal comment (no right on its column). */
export const campaignEntryDecisionSchema = z.strictObject({
  decidedAt: instantSchema,
  decidedBy: accountOwnerSchema.nullable(),
  /** Decided after its deadline (15 C8): marked, never blocked. */
  late: z.boolean(),
  rejectionReasonCode: campaignRejectionReasonCodeSchema.nullable(),
  memberMessage: z.string().nullable(),
});

/** The history of the examinations of a campaign (the record of 17b, one line per entry). */
export const campaignEntryHistorySchema = z.strictObject({
  id: z.uuid(),
  state: reviewEntryStateSchema,
  createdAt: instantSchema,
  closedAt: instantSchema.nullable(),
  decision: campaignEntryDecisionSchema.nullable(),
  firstReviewedBy: accountOwnerSchema.nullable(),
  firstReviewedAt: instantSchema.nullable(),
});

/**
 * An act of an agent on the campaign (09 RG94). The old and the new value are the JSON of the field as
 * the base keeps it, as TEXT; null for a passage, for the three fields that serve no value
 * (`CAMPAIGN_UNSERVED_VALUE_FIELDS`). The internal comment is not served.
 */
export const campaignInterventionSchema = z.strictObject({
  id: z.uuid(),
  kind: interventionKindSchema,
  fieldCode: campaignCorrectableFieldSchema.nullable(),
  oldValueJson: z.string().nullable(),
  newValueJson: z.string().nullable(),
  reasonCode: interventionReasonCodeSchema,
  agent: accountOwnerSchema.nullable(),
  createdAt: instantSchema,
});

/** `GET /v1/bo/campaigns/:id`: the record of a campaign for an agent. The read is journaled (modele §6). */
export const campaignRecordResponseSchema = z.strictObject({
  asOf: instantSchema,
  id: z.uuid(),
  brand: campaignBrandSchema,
  cycle: campaignCycleSchema,
  fields: campaignFieldsSchema,
  alerts: z.array(campaignTextAlertSchema),
  duplicateOf: campaignDuplicateSchema.nullable(),
  entries: z.array(campaignEntryHistorySchema),
  interventions: z.array(campaignInterventionSchema),
});
export type CampaignRecordResponse = z.infer<
  typeof campaignRecordResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// The decision view (15 C1, C2; 17b §3.8)
// ---------------------------------------------------------------------------------------------

/** The reasons of a refusal, each with the message the brand will receive (09 RG90; what is read is what is sent). */
export const campaignReviewReasonSchema = z.strictObject({
  code: campaignRejectionReasonCodeSchema,
  position: z.number().int().positive(),
  requiresMemberMessage: z.boolean(),
  message: z.string(),
  nextStepMessage: z.string(),
});
export type CampaignReviewReason = z.infer<typeof campaignReviewReasonSchema>;

/** The state of the review of an entry (09 RG85, 17b §3.8 "Temps 1 / Temps 2"). */
export const campaignReviewStateSchema = z.strictObject({
  phase: campaignReviewPhaseSchema,
  enhancedReview: z.boolean(),
  firstReviewer: accountOwnerSchema.nullable(),
  firstReviewedAt: instantSchema.nullable(),
  /** The opinion of the first examiner: to the HOLDER of the live claim only, never otherwise (modele §1). */
  firstOpinion: z.string().nullable(),
});

export const openedCampaignEntrySchema = z.strictObject({
  id: z.uuid(),
  state: reviewEntryStateSchema,
  createdAt: instantSchema,
  slaDueAt: instantSchema,
  escalateAt: instantSchema.nullable(),
  overdue: z.boolean(),
  claim: entryClaimSchema,
  lastForcedRelease: forcedReleaseSchema.nullable(),
  decision: campaignEntryDecisionSchema.nullable(),
  review: campaignReviewStateSchema,
});

/**
 * `POST /v1/bo/campaigns/entries/:id/open`: opening is claiming (15 C1). `reviewToken` is the version the
 * agent examines: returned with a claim only, sent back with the decision; a stale one refuses it.
 * `responsibles` are the commercials a campaign may be given to (RG6, CA63).
 */
export const openCampaignEntryResponseSchema = z.strictObject({
  asOf: instantSchema,
  outcome: openOutcomeSchema,
  reviewToken: reviewTokenSchema.nullable(),
  entry: openedCampaignEntrySchema,
  campaignId: z.uuid(),
  brand: campaignBrandSchema,
  campaign: campaignFieldsSchema,
  status: campaignStatusSchema,
  alerts: z.array(campaignTextAlertSchema),
  duplicateOf: campaignDuplicateSchema.nullable(),
  reasons: z.array(campaignReviewReasonSchema),
  responsibles: z.array(accountOwnerSchema),
});
export type OpenCampaignEntryResponse = z.infer<
  typeof openCampaignEntryResponseSchema
>;

export const campaignEntryParamsSchema = z.strictObject({ id: z.uuid() });
export type CampaignEntryParams = z.infer<typeof campaignEntryParamsSchema>;
export const campaignRecordParamsSchema = z.strictObject({ id: z.uuid() });
export type CampaignRecordParams = z.infer<typeof campaignRecordParamsSchema>;

// ---------------------------------------------------------------------------------------------
// The decisions (09 RG5, RG85, RG89, RG90, RG92; modele §3, §4)
// ---------------------------------------------------------------------------------------------

/** `POST …/entries/:id/first-review` (enhanced review, time 1): a reasoned favourable opinion. */
export const firstReviewCampaignEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  opinion: z
    .string()
    .min(CAMPAIGN_OPINION_MIN_LENGTH)
    .max(CAMPAIGN_OPINION_MAX_LENGTH),
});
export type FirstReviewCampaignEntryRequest = z.infer<
  typeof firstReviewCampaignEntryRequestSchema
>;

export const firstReviewCampaignEntryResponseSchema = z.strictObject({
  firstReviewedAt: instantSchema,
  next: nextEntrySchema,
});
export type FirstReviewCampaignEntryResponse = z.infer<
  typeof firstReviewCampaignEntryResponseSchema
>;

/** `POST …/entries/:id/publish` (09 RG5): a human decision, bound to the version examined, a responsible named. */
export const publishCampaignEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  ownerAgentId: z.uuid(),
  internalComment: internalCommentSchema.optional(),
});
export type PublishCampaignEntryRequest = z.infer<
  typeof publishCampaignEntryRequestSchema
>;

export const publishCampaignEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  snapshotVersion: z.number().int().positive(),
  /** The first publication of this campaign (RG103): `campaign.published` goes to the leads. */
  firstPublication: z.boolean(),
  next: nextEntrySchema,
});
export type PublishCampaignEntryResponse = z.infer<
  typeof publishCampaignEntryResponseSchema
>;

/**
 * `POST …/entries/:id/reject` (09 RG90): a typed reason of the closed list. `memberMessage` is the agent's
 * own text for `illicit_content` and `other` only (20 to 500 characters, no direct contact); the database
 * says which reasons ask for it.
 */
export const rejectCampaignEntryRequestSchema = z.strictObject({
  reviewToken: reviewTokenSchema,
  reasonCode: campaignRejectionReasonCodeSchema,
  memberMessage: z
    .string()
    .min(CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH)
    .max(CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH)
    .optional(),
  internalComment: internalCommentSchema.optional(),
});
export type RejectCampaignEntryRequest = z.infer<
  typeof rejectCampaignEntryRequestSchema
>;

export const rejectCampaignEntryResponseSchema = z.strictObject({
  decidedAt: instantSchema,
  late: z.boolean(),
  next: nextEntrySchema,
});
export type RejectCampaignEntryResponse = z.infer<
  typeof rejectCampaignEntryResponseSchema
>;

/** `POST …/entries/:id/force-release` (15 C4, admin only): a typed reason, no free text. */
export const forceReleaseCampaignEntryRequestSchema = z.strictObject({
  reasonCode: claimReleaseReasonCodeSchema,
});

// ---------------------------------------------------------------------------------------------
// The record: correction, creation for a brand, pause, resume and close of an agent (09 RG1, RG8, RG9, RG94)
// ---------------------------------------------------------------------------------------------

/**
 * The value of a correction, as the base types it (modele §6): a text, a boolean, an integer, a date as
 * text, a list of codes or texts, the deliverables, or the territory `{scope, countries}`. The base checks
 * the shape per field (22023 `value`); this is the structural bound.
 */
export const campaignCorrectionValueSchema = z.union([
  z.null(),
  z.boolean(),
  z.number().int(),
  z.string().max(5000),
  z.array(z.union([z.string().max(1000), campaignDeliverableSchema])).max(50),
  z.strictObject({
    scope: z.string().max(63).nullable(),
    countries: z.array(z.string().max(63)).max(50).nullable().optional(),
  }),
]);
export type CampaignCorrectionValue = z.infer<
  typeof campaignCorrectionValueSchema
>;

/** `POST /v1/bo/campaigns/:id/corrections`: ONE field, a typed reason, a comment for `other` (RG94). */
export const correctCampaignFieldRequestSchema = z.strictObject({
  fieldCode: campaignCorrectableFieldSchema,
  value: campaignCorrectionValueSchema,
  reasonCode: interventionReasonCodeSchema,
  internalComment: internalCommentSchema.optional(),
});
export type CorrectCampaignFieldRequest = z.infer<
  typeof correctCampaignFieldRequestSchema
>;

/** `reviewToken`: the new version of a pending campaign under the caller's claim, else null. */
export const correctCampaignFieldResponseSchema = z.strictObject({
  interventionId: z.uuid(),
  reviewToken: reviewTokenSchema.nullable(),
});
export type CorrectCampaignFieldResponse = z.infer<
  typeof correctCampaignFieldResponseSchema
>;

/** `POST /v1/bo/campaigns`: a draft opened for a brand that called (09 RG1, Q2): the brand completes and submits it. */
export const createCampaignForBrandRequestSchema = z.strictObject({
  advertiserAccountId: z.uuid(),
  title: z.string().min(1).max(140),
  campaignType: referenceCodeSchema,
});
export type CreateCampaignForBrandRequest = z.infer<
  typeof createCampaignForBrandRequestSchema
>;

export const createCampaignForBrandResponseSchema = z.strictObject({
  campaignId: z.uuid(),
  interventionId: z.uuid(),
});
export type CreateCampaignForBrandResponse = z.infer<
  typeof createCampaignForBrandResponseSchema
>;

/** `POST /v1/bo/campaigns/:id/{pause|resume|close}`: a typed reason, a comment for `other` (RG93, RG94). */
export const campaignPassageRequestSchema = z.strictObject({
  reasonCode: interventionReasonCodeSchema,
  internalComment: internalCommentSchema.optional(),
});
export type CampaignPassageRequest = z.infer<
  typeof campaignPassageRequestSchema
>;

export const campaignPassageResponseSchema = z.strictObject({
  status: campaignStatusSchema,
  interventionId: z.uuid(),
});
export type CampaignPassageResponse = z.infer<
  typeof campaignPassageResponseSchema
>;

/**
 * The refusals of a decision or a passage, as the `issue` of the details of the error envelope (409
 * unless said): those of the queues (`held_by_other`, `claim_not_held`, `claim_lifted`, `entry_closed`,
 * `stale_token`) and those of queue 7: the state of the campaign does not allow the act
 * (`campaign_state`, `campaign_not_pausable`, `campaign_not_resumable`, `campaign_not_closable`,
 * `campaign_not_correctable`, `campaign_closed`), the enhanced review (`not_enhanced_review`,
 * `enhanced_review_required`, `enhanced_review`, `first_review_given`), the publication
 * (`brand_not_publishable`, `calendar_passed`, `live_campaign_cap`), and the creation (`brand_not_active`).
 * A 400 for a value the database refuses (`reasonCode`, `memberMessage`, `internalComment`, `opinion`,
 * `ownerAgentId`, `value`, `fieldCode`, `title`, `campaignType`, `unchanged`).
 */
export const CAMPAIGN_DECISION_CONFLICT_ISSUES = [
  "held_by_other",
  "claim_not_held",
  "claim_lifted",
  "entry_closed",
  "stale_token",
  "campaign_state",
  "campaign_not_pausable",
  "campaign_not_resumable",
  "campaign_not_closable",
  "campaign_not_correctable",
  "campaign_closed",
  "not_enhanced_review",
  "enhanced_review_required",
  "enhanced_review",
  "first_review_given",
  "brand_not_publishable",
  "calendar_passed",
  "live_campaign_cap",
  "brand_not_active",
] as const;
export type CampaignDecisionConflictIssue =
  (typeof CAMPAIGN_DECISION_CONFLICT_ISSUES)[number];
