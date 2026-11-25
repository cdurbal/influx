// Contract of the creator's read of the open campaigns (docs/mvp/11 RG13 to RG26, RG33, RG35, RG36,
// CA2 to CA5, CA10, CA15 to CA18; 09 RG98 to RG101; D46, D48, D78; jalons/l3d/modele.md §3, §4, §7,
// which prevails for every name). Shared by apps/api and apps/web. Three routes, for a creator alone:
// - GET /v1/open-campaigns?sort&page   the feed: a page of cards, the count before it (RG35);
// - GET /v1/open-campaigns/:id         the record of an OPEN campaign: the published snapshot whole,
//                                      the published brand profile whole, the notice of D78;
// - GET /v1/open-campaigns/:id/brand-logo  the logo of the brand of a visible campaign, relayed.
// The campaign is ALWAYS the creator view of the base (campaignCreatorViewSchema, the snapshot L3C
// freezes) and the brand ALWAYS the public view of brandPublicViewOf() (campaignBrandViewSchema): the
// card takes a subset of both by `.pick()`, never a field of its own (RG15 at the pilot, RG25). The
// identifier is the campaign's own, opaque (RG39). No amount, currency, band, total budget, internal
// reference, note, commercial owner, agent, sensitivity, declaration, state, count of applications or
// of views exists in it, not even empty (fiche invariant 1; CLAUDE.md §2), and no contact of the brand
// (D46, 06 RG38): the ROLE of its contact person only.
import { z } from "./zod.ts";
import { brandLogoSchema } from "./brand-profile.ts";
import {
  CAMPAIGN_REMUNERATION_NOTICE,
  campaignBrandViewSchema,
  campaignCreatorViewSchema,
} from "./campaign-creator-view.ts";

/** A civil date as the base writes it, YYYY-MM-DD (the UTC day of the first publication). */
const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The two sorts of RG33 (modele §4): the most recent first, or the nearest deadline first. */
export const OPEN_CAMPAIGN_SORTS = ["recent", "deadline"] as const;
export const openCampaignSortSchema = z.enum(OPEN_CAMPAIGN_SORTS);
export type OpenCampaignSort = z.infer<typeof openCampaignSortSchema>;

/**
 * The highest page the contract admits (the domain of the door, 0314 EC-L3D-02-4). The cap in force
 * is lower, a setting of the base (`campaign_feed_max_pages`): beyond it, 400 `validation_failed` on
 * `page` with the issue `page_cap`, journaled (RG21, CA18).
 */
export const OPEN_CAMPAIGNS_PAGE_MAX = 50;

/** GET /v1/open-campaigns: the sort (`recent` by default) and the rank of the page (1 by default). */
export const openCampaignsQuerySchema = z.strictObject({
  sort: openCampaignSortSchema.default("recent"),
  page: z.coerce.number().int().min(1).max(OPEN_CAMPAIGNS_PAGE_MAX).default(1),
});
export type OpenCampaignsQuery = z.infer<typeof openCampaignsQuerySchema>;

/** The issue of `page` beyond the cap of the base (RG21, CA18). */
export const OPEN_CAMPAIGNS_PAGE_CAP_ISSUE = "page_cap";

/** The path of a record and of a logo: the campaign's own identifier, opaque (RG39). */
export const openCampaignParamsSchema = z.strictObject({ id: z.uuid() });
export type OpenCampaignParams = z.infer<typeof openCampaignParamsSchema>;

/** What a card shows of the campaign (RG15 at the pilot, modele §3): a pick of the creator view. */
export const openCampaignCardCampaignSchema = campaignCreatorViewSchema.pick({
  title: true,
  audienceTopics: true,
  deliverables: true,
  remunerationKind: true,
  audienceCountries: true,
  startsOn: true,
  endsOn: true,
  applicationsCloseOn: true,
});
export type OpenCampaignCardCampaign = z.infer<
  typeof openCampaignCardCampaignSchema
>;

/** What a card shows of the brand (RG15 at the pilot, modele §3): a pick of the public view. */
export const openCampaignCardBrandSchema = campaignBrandViewSchema.pick({
  companyName: true,
  hasLogo: true,
  primarySector: true,
  companySize: true,
  badge: true,
});
export type OpenCampaignCardBrand = z.infer<typeof openCampaignCardBrandSchema>;

/**
 * One card of the feed (modele §3). `applicationsClosed`: the deadline is past by fewer than
 * `campaign_feed_closed_days` days, the card is greyed and opens no record (RG26, CA9).
 */
export const openCampaignCardSchema = z.strictObject({
  id: z.uuid(),
  publishedOn: civilDateSchema,
  applicationsClosed: z.boolean(),
  campaign: openCampaignCardCampaignSchema,
  brand: openCampaignCardBrandSchema,
  remunerationNotice: z.literal(CAMPAIGN_REMUNERATION_NOTICE),
});
export type OpenCampaignCard = z.infer<typeof openCampaignCardSchema>;

/**
 * GET /v1/open-campaigns (modele §4): `total` counts every card of the feed, greyed ones included
 * (RG35); `nextPage` is null at the end and at the cap; `capReached` says the cap hides cards (RG36).
 */
export const openCampaignsResponseSchema = z.strictObject({
  total: z.number().int().min(0),
  page: z.number().int().min(1).max(OPEN_CAMPAIGNS_PAGE_MAX),
  nextPage: z.number().int().min(2).max(OPEN_CAMPAIGNS_PAGE_MAX).nullable(),
  capReached: z.boolean(),
  items: z.array(openCampaignCardSchema),
});
export type OpenCampaignsResponse = z.infer<typeof openCampaignsResponseSchema>;

/**
 * GET /v1/open-campaigns/:id (modele §3): the published snapshot WHOLE and the published brand
 * profile WHOLE, never null (an unpublished brand has no visible campaign), and the notice of D78:
 * the payload of the brand's preview (09 RG102) plus `id` and `publishedOn`.
 */
export const openCampaignRecordResponseSchema = z.strictObject({
  id: z.uuid(),
  publishedOn: civilDateSchema,
  campaign: campaignCreatorViewSchema,
  brand: campaignBrandViewSchema,
  remunerationNotice: z.literal(CAMPAIGN_REMUNERATION_NOTICE),
});
export type OpenCampaignRecordResponse = z.infer<
  typeof openCampaignRecordResponseSchema
>;

/**
 * GET /v1/open-campaigns/:id/brand-logo: the logo in force of the brand of an open or greyed campaign,
 * relayed as JSON like the brand's own (no URL, no host of Storage, no token); null without one.
 */
export const openCampaignBrandLogoResponseSchema = z.strictObject({
  logo: brandLogoSchema.nullable(),
});
export type OpenCampaignBrandLogoResponse = z.infer<
  typeof openCampaignBrandLogoResponseSchema
>;
