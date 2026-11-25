// Contract of "what a creator sees" of a campaign (docs/mvp/09 RG98, RG102, CA41, CA44, CA64, CA68,
// CA75; D48, D78; jalons/l3b/modele.md §6, commit 08). ONE contract, reused AS IT IS by L3C (the
// snapshot of a published campaign) and L3D (the creator's read of a published campaign): never a
// copy, never a second shape. The screen draws what it is given and never rebuilds it (RG102).
// - `campaignCreatorViewSchema`: exactly the 32 keys of campaigns.campaign_creator_view(uuid) (0305),
//   an ALLOW-LIST whose keys are always present (null, []). Never the currency, a band (budget or
//   product value), the total budget, the internal reference, the declaration of RG85, the
//   sensitivity of the sector, the state, an identifier nor max_applications (modele §6, D78).
// - `campaignBrandViewSchema`: the PUBLISHED brand profile, read live (RG2, 06 RG73, RG74 "before"):
//   the public identity, the expectations, the badge and its date, the ROLE of the contact person;
//   never the first name, an e-mail, a phone, a contact page (06 RG38, CA64), the registered name, a
//   registration number, the completeness nor an identifier. The logo is a presence flag: its image
//   is relayed by a route of its own, never embedded (EC-L3B-08-1).
// - `remunerationNotice`: the key of « À négocier avec votre commercial » (D78), always the same.
// No amount, no price, no net, no currency, no commission exists in it (CLAUDE.md §2, D48, D78).
import { z } from "./zod.ts";
import {
  collaborationRhythmSchema,
  companySizeBandSchema,
  contactRoleSchema,
  exclusivityBandSchema,
  workingLanguageSchema,
} from "./brand-profile.ts";
import {
  campaignDeliverableSchema,
  contentReviewDelaySchema,
  remunerationKindSchema,
  shippingPayerSchema,
  usageRightsDurationSchema,
  usageRightsTerritoryScopeSchema,
} from "./campaign.ts";
import { countryCodeSchema } from "./signup.ts";

/** A civil date as the base writes it, YYYY-MM-DD. */
const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * The campaign as a creator sees it (09 RG98; modele §6): the 32 keys of
 * campaigns.campaign_creator_view(uuid), in its order. L3C and L3D reuse this schema as it is.
 */
export const campaignCreatorViewSchema = z.strictObject({
  title: z.string().nullable(),
  campaignType: z.string().nullable(),
  publicSummary: z.string().nullable(),
  brief: z.string().nullable(),
  productDescription: z.string().nullable(),
  productSector: z.string().nullable(),
  restrictions: z.string().nullable(),
  keyMessages: z.array(z.string()),
  productIsSent: z.boolean().nullable(),
  creatorKeepsProduct: z.boolean().nullable(),
  shippingCostsBorneBy: shippingPayerSchema.nullable(),
  deliverables: z.array(campaignDeliverableSchema),
  /** Deduced from the deliverables, each once, in the order of their first line (RG35). */
  networks: z.array(z.string()),
  usageRights: z.string().nullable(),
  usageRightsDuration: usageRightsDurationSchema.nullable(),
  usageRightsTerritoryScope: usageRightsTerritoryScopeSchema.nullable(),
  usageRightsTerritories: z.array(countryCodeSchema),
  exclusivity: exclusivityBandSchema.nullable(),
  contentReviewDelay: contentReviewDelaySchema.nullable(),
  audienceCountries: z.array(countryCodeSchema),
  audienceLanguages: z.array(z.string()),
  audienceTopics: z.array(z.string()),
  audienceBands: z.array(z.string()),
  audienceAgeBands: z.array(z.string()),
  audienceGender: z.string().nullable(),
  /** The nature of the consideration alone (RG62, D78): no range, no band, no currency, no net. */
  remunerationKind: remunerationKindSchema.nullable(),
  creatorsWanted: z.number().int().nullable(),
  applicationsCloseOn: civilDateSchema.nullable(),
  contentDueOn: civilDateSchema.nullable(),
  startsOn: civilDateSchema.nullable(),
  endsOn: civilDateSchema.nullable(),
  requestedItems: z.array(z.string()),
});
export type CampaignCreatorView = z.infer<typeof campaignCreatorViewSchema>;

/** The badge « Marque vérifiée » while it holds, and the day it was granted (06 RG74): never the evidence. */
export const campaignBrandBadgeSchema = z.strictObject({
  since: z.iso.datetime(),
});

/**
 * The published brand profile as a creator sees it with a published campaign (06 RG73, RG74
 * "before"; 09 RG98, CA64). The values are the VALIDATED ones: a change waiting for review is never
 * in it (06 RG9).
 */
export const campaignBrandViewSchema = z.strictObject({
  /** The trading name (06 RG2), never the registered name of the internal block. */
  companyName: z.string(),
  /** An approved logo is in force; its image has its own relay (EC-L3B-08-1). */
  hasLogo: z.boolean(),
  primarySector: z.string().nullable(),
  secondarySectors: z.array(z.string()),
  companySize: companySizeBandSchema.nullable(),
  country: countryCodeSchema,
  targetMarkets: z.array(countryCodeSchema),
  workingLanguages: z.array(workingLanguageSchema),
  /** The domain alone (06 RG17). */
  website: z.string().nullable(),
  presentation: z.string().nullable(),
  topics: z.array(z.string()),
  networks: z.array(z.string()),
  formats: z.array(z.string()),
  audienceCountries: z.array(countryCodeSchema),
  usageRights: z.array(z.string()),
  exclusivityBand: exclusivityBandSchema.nullable(),
  collaborationRhythm: collaborationRhythmSchema.nullable(),
  offersNonMonetary: z.boolean().nullable(),
  /** The ROLE of the contact person, the only public field of the block (06 RG35, RG38, CA64). */
  contactRole: contactRoleSchema.nullable(),
  badge: campaignBrandBadgeSchema.nullable(),
});
export type CampaignBrandView = z.infer<typeof campaignBrandViewSchema>;

/** « À négocier avec votre commercial » (09 l. 496, D78): shown after the nature, on every campaign. */
export const CAMPAIGN_REMUNERATION_NOTICE = "campaign.budget.negotiate";

/**
 * GET /v1/me/campaigns/:id/creator-view (RG102, CA68): the brand's preview of what a creator sees,
 * exactly what the API serves. `brand`: null while the brand profile is not published (a creator
 * never sees an unpublished profile, 06 RG73).
 */
export const campaignCreatorViewResponseSchema = z.strictObject({
  campaign: campaignCreatorViewSchema,
  remunerationNotice: z.literal(CAMPAIGN_REMUNERATION_NOTICE),
  brand: campaignBrandViewSchema.nullable(),
});
export type CampaignCreatorViewResponse = z.infer<
  typeof campaignCreatorViewResponseSchema
>;
