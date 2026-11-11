// Contract of "what a brand sees" (docs/mvp/07 RG16, RG84, RG85, RG104; 17 §9 S1; jalons/l2g/
// modele.md §6, EC-L2G-9): the public projection of a creator, layer A, served as it is by ONE module
// of apps/api. The creator reads it on his account (GET /v1/me/creator-profile/preview, two tabs,
// `before` and `after`); the search of Lot 3 calls the same module. The screen draws what it is given
// and never rebuilds it (RG104).
// `before`: what a brand sees before an introduction, layer A alone: approved visuals only, no handle,
// no URL, no exact figure, no completeness (RG86), no `public_ref`, no `social_account_id`. The region
// of residence is not served before Lot 3 (RG37). `after`: the same, plus the layer I of the lines the
// creator lists (handle, URL, exact figures sourced and dated), read from the session of the creator
// himself; what a brand reads after an introduction is Lot 4.
// No price, rate, net or currency exists in it (D48, D78, RG103).
import { z } from "./zod.ts";
import { countryCodeSchema } from "./signup.ts";
import {
  availabilityBandSchema,
  collaborationExperienceBandSchema,
  creatorExclusivityBandSchema,
  creatorUsageRightSchema,
  deliveryLeadBandSchema,
  travelScopeSchema,
  CREATOR_FIGURES_SOURCES,
} from "./creator-profile.ts";
import {
  PORTFOLIO_MAX_ITEMS,
  portfolioCaptionSchema,
} from "./creator-portfolio.ts";

/** An approved visual of the card and of the page (RG84, RG85): its id for the relay, its order, its caption. */
export const creatorProjectionVisualSchema = z.strictObject({
  id: z.uuid(),
  order: z.number().int().min(1).max(PORTFOLIO_MAX_ITEMS),
  caption: portfolioCaptionSchema.nullable(),
});
export type CreatorProjectionVisual = z.infer<
  typeof creatorProjectionVisualSchema
>;

/** A badge of a line, with the day it was granted (08): the level and the date, never the evidence. */
export const creatorProjectionBadgeSchema = z.strictObject({
  level: z.enum(["account_verified", "audience_verified"]),
  since: z.iso.datetime(),
});
export type CreatorProjectionBadge = z.infer<
  typeof creatorProjectionBadgeSchema
>;

/** A listed line, layer A: bands and codes (07 RG16 block 3), the source and the date of the figures (RG49, RG50). */
export const creatorProjectionNetworkSchema = z.strictObject({
  networkCode: z.string(),
  isPrimary: z.boolean(),
  audienceBand: z.string().nullable(),
  reachBand: z.string().nullable(),
  publicationFrequency: z.string().nullable(),
  commentBand: z.string().nullable(),
  /** Only while an audience badge of the line holds (07 RG48, RG102): never from a declared rate. */
  engagementBand: z.string().nullable(),
  figuresSource: z.enum(CREATOR_FIGURES_SOURCES),
  figuresMeasuredAt: z.iso.datetime().nullable(),
  badges: z.array(creatorProjectionBadgeSchema),
});
export type CreatorProjectionNetwork = z.infer<
  typeof creatorProjectionNetworkSchema
>;

/**
 * A share band of the audience of the main line (07 RG58, RG102 « tranches »): the other countries and
 * the age bands, a share under 10 % absent; the main country and the gender band are on the profile.
 */
export const creatorProjectionAudienceBandSchema = z.strictObject({
  dimension: z.enum(["country", "age"]),
  code: z.string(),
  shareBand: z.string(),
});
export type CreatorProjectionAudienceBand = z.infer<
  typeof creatorProjectionAudienceBandSchema
>;

/** The layer A of a published profile, and of its draft for the owner. */
export const creatorProjectionBeforeSchema = z.strictObject({
  /** The public alias (RG23), never the handle. */
  alias: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  primaryTopic: z.string().nullable(),
  secondaryTopics: z.array(z.string()),
  tones: z.array(z.string()),
  publicationLanguages: z.array(z.string()),
  residenceCountry: countryCodeSchema,
  travelScope: travelScopeSchema.nullable(),
  collaborationExperience: collaborationExperienceBandSchema.nullable(),
  mainAudienceCountry: countryCodeSchema.nullable(),
  mainAudienceShareBand: z.string().nullable(),
  audienceGenderBand: z.string().nullable(),
  audienceBands: z.array(creatorProjectionAudienceBandSchema),
  formats: z.array(z.string()),
  usageRights: z.array(creatorUsageRightSchema),
  deliveryLead: deliveryLeadBandSchema.nullable(),
  maxExclusivity: creatorExclusivityBandSchema.nullable(),
  acceptsNonMonetary: z.boolean(),
  availability: availabilityBandSchema.nullable(),
  networks: z.array(creatorProjectionNetworkSchema),
  /** The approved visuals in the creator's order: the card shows the first three (RG84), none: no image. */
  visuals: z.array(creatorProjectionVisualSchema).max(PORTFOLIO_MAX_ITEMS),
});
export type CreatorProjectionBefore = z.infer<
  typeof creatorProjectionBeforeSchema
>;

/**
 * A listed line with its layer I, for the creator reading his own "after" tab (modele §6, EC-L2G-9). The
 * exact figures are the declared ones while `figuresSource` is `declared`; on a line whose figures are
 * `agent_observed` they are null: the creator's session reads no observed value (0221 §12.5), and a
 * declared value never stands for an observed one (08 RG19, RG40).
 */
export const creatorProjectionIdentifiedNetworkSchema =
  creatorProjectionNetworkSchema.extend({
    handle: z.string().nullable(),
    profileUrl: z.string().nullable(),
    followersCount: z.number().int().nullable(),
    postsLast30Days: z.number().int().nullable(),
    avgCommentsPerPost: z.number().int().nullable(),
    avgReachPerPost: z.number().int().nullable(),
  });
export type CreatorProjectionIdentifiedNetwork = z.infer<
  typeof creatorProjectionIdentifiedNetworkSchema
>;

/** An exact share of the audience of the main line (07 RG102 « pourcentages exacts »), as the creator typed it. */
export const creatorProjectionAudienceShareSchema = z.strictObject({
  dimension: z.enum(["country", "age", "gender"]),
  code: z.string(),
  share: z.number().int().min(0).max(100),
});
export type CreatorProjectionAudienceShare = z.infer<
  typeof creatorProjectionAudienceShareSchema
>;

export const creatorProjectionAfterSchema =
  creatorProjectionBeforeSchema.extend({
    networks: z.array(creatorProjectionIdentifiedNetworkSchema),
    audienceShares: z.array(creatorProjectionAudienceShareSchema),
  });
export type CreatorProjectionAfter = z.infer<
  typeof creatorProjectionAfterSchema
>;

/**
 * GET /v1/me/creator-profile/preview (RG104): the two tabs. `published`: whether a brand can see
 * this profile now (a profile not published is seen by no one, the preview shows what it would be).
 */
export const creatorPreviewResponseSchema = z.strictObject({
  published: z.boolean(),
  before: creatorProjectionBeforeSchema,
  after: creatorProjectionAfterSchema,
});
export type CreatorPreviewResponse = z.infer<
  typeof creatorPreviewResponseSchema
>;
