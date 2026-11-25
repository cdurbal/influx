// Contract of the identified creator search of the INFLUX agents (docs/mvp/10 RG4, RG9, RG62, RG71 to
// RG73, RG76, RG78; 17b §3.3; CA56, CA58, CA61; D45, D46, D48, D78; jalons/l3g/modele.md §1 to §4, §8,
// which PREVAILS for every name). Shared by apps/api and apps/backoffice. Two routes, for an agent or an
// administrator alone (a member gets the 404 of a route that does not exist):
//   POST /v1/bo/creator-search                    the door search.search_creators_identified() of 0328
//   POST /v1/bo/campaigns/:id/creator-prefill     the door search.prefill_campaign_filters() of 0329
// - The entry is CLOSED: the facets of the base of the brand's search (RG71: the same facets, the same
//   bounds), plus the facets G1, G2, G8, G9, G10 of the identified view, the sort, the rank of the page,
//   the campaign of origin and the prefill the filters come from; no size of page (the base holds it,
//   RG76), no other key (400).
// - The answer is a page of identified rows: the EXACT count (no k, no switch, CA61), the page, the
//   rows. A row holds the identity (legal name, city: layers I and N), the states (G1, G2), the
//   residence (G9), the agent in charge (G8), the refused sectors (G10), the pair blocked (RG71: a
//   boolean, never its motive nor its author), every line of network with its exact figures, the
//   exact share of the main audience, and the reasons and the note of vigilance of the card (RG77).
// No e-mail, phone nor address (D46), no price, rate, budget, currency nor net (D48, D78, CLAUDE.md §2),
// no rank nor score exists in it, not even empty.
import { z } from "./zod.ts";
import {
  CREATOR_SEARCH_PAGE_MAX,
  creatorSearchFiltersSchema,
  creatorSearchReasonSchema,
  creatorSearchSortSchema,
  creatorSearchVigilanceSchema,
} from "./creator-search.ts";
import { countryCodeSchema } from "./signup.ts";

/** The issue of `page` beyond the cap of the base (RG76), the same word as the brand's. */
export const IDENTIFIED_SEARCH_PAGE_CAP_ISSUE = "page_cap";

/** The issue of `filters` the base refused (a facet closed in table, a list out of its bounds). */
export const IDENTIFIED_SEARCH_FILTERS_ISSUE = "invalid_filters";

/** G1: the status the creator declared at sign-up (04 `declared_status`). */
export const IDENTIFIED_DECLARED_STATUSES = ["individual", "business"] as const;
export const identifiedDeclaredStatusSchema = z.enum(
  IDENTIFIED_DECLARED_STATUSES,
);

/** G2: the five states of a creator profile (E1 lifted: a draft is searched and labelled). */
export const IDENTIFIED_PROFILE_STATES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "suspended",
] as const;
export const identifiedProfileStateSchema = z.enum(IDENTIFIED_PROFILE_STATES);
export type IdentifiedProfileState = z.infer<
  typeof identifiedProfileStateSchema
>;

const codeSchema = z.string().regex(/^[A-Za-z0-9_]{1,64}$/);
/** G8: the agents in charge, lowercase identifiers as the base checks them (EC-L3G-04-10). */
const agentIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
/** G9: a region of the shape of reference.regions, prefixed by its country. */
const regionCodeSchema = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,8}$/);

/** A list of 1 to `max` distinct values: OR inside a facet (RG17). */
function list<T extends z.ZodType<string>>(item: T, max: number) {
  return z
    .array(item)
    .min(1)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate",
    });
}

/**
 * The filters of the identified view (modele §2): the facets of the base as the brand's, plus G1
 * (declared status), G2 (state of the profile), G8 (agent in charge), G9 (residence, with regions of
 * that country), G10 (the creator refuses at least one of the sectors). G3 is Lot 4 (EC-L3G-2).
 */
export const identifiedCreatorFiltersSchema = creatorSearchFiltersSchema.extend(
  {
    G1: list(identifiedDeclaredStatusSchema, 2).optional(),
    G2: list(identifiedProfileStateSchema, 5).optional(),
    G8: list(agentIdSchema, 20).optional(),
    G9: z
      .strictObject({
        country: countryCodeSchema,
        regions: list(regionCodeSchema, 20).optional(),
      })
      .refine(
        (residence) =>
          (residence.regions ?? []).every((region) =>
            region.startsWith(`${residence.country}-`),
          ),
        { message: "region_of_another_country", path: ["regions"] },
      )
      .optional(),
    G10: list(codeSchema, 20).optional(),
  },
);
export type IdentifiedCreatorFilters = z.infer<
  typeof identifiedCreatorFiltersSchema
>;

/** POST /v1/bo/creator-search: the whole entry, nothing else (no size of page, RG76). */
export const identifiedCreatorSearchBodySchema = z.strictObject({
  filters: identifiedCreatorFiltersSchema,
  sort: creatorSearchSortSchema.default("default"),
  page: z.number().int().min(1).max(CREATOR_SEARCH_PAGE_MAX).default(1),
  /** The campaign of origin: any admitted campaign; the others answer as an unknown one (T14). */
  campaignId: z.uuid().optional(),
  /** The prefill the filters were drawn from (CA56): an own one, of the same campaign, under 24 h. */
  prefillId: z.uuid().optional(),
});
export type IdentifiedCreatorSearchBody = z.infer<
  typeof identifiedCreatorSearchBodySchema
>;

/** The badge a line holds, the best one: its level and its state, never its evidence (EC-L3G-04-4). */
export const identifiedNetworkBadgeSchema = z.strictObject({
  level: z.enum(["account_verified", "audience_verified"]),
  state: z.enum(["active", "to_refresh"]),
});

/** One line of network, its EXACT figures as the creator record serves them (modele §1, -2). */
export const identifiedNetworkSchema = z.strictObject({
  network: z.string(),
  isPrimary: z.boolean(),
  pseudonym: z.string().nullable(),
  handle: z.string().nullable(),
  profileUrl: z.string().nullable(),
  followers: z.number().int().nullable(),
  postsLast30Days: z.number().int().nullable(),
  avgComments: z.number().int().nullable(),
  engagementBp: z.number().int().nullable(),
  measuredAt: z.iso.datetime().nullable(),
  source: z.enum(["declared", "agent_observed"]),
  badge: identifiedNetworkBadgeSchema.nullable(),
});
export type IdentifiedNetwork = z.infer<typeof identifiedNetworkSchema>;

/** A row of the identified view (modele §1): identities and exact values, the reasons of the card. */
export const identifiedCreatorRowSchema = z.strictObject({
  accountId: z.uuid(),
  alias: z.string(),
  /** G2: the state of the profile; a profile never published is labelled by it. */
  status: identifiedProfileStateSchema,
  /** G1: what the creator declared at sign-up. */
  declaredStatus: identifiedDeclaredStatusSchema.nullable(),
  legalName: z.string().nullable(),
  city: z.string().nullable(),
  residence: z.strictObject({
    country: z.string(),
    region: z.string().nullable(),
  }),
  ownerAgent: z
    .strictObject({
      accountId: z.uuid(),
      firstName: z.string().nullable(),
    })
    .nullable(),
  refusedSectors: z.array(z.string()),
  /** RG71: an active block of the pair with the brand of the campaign; false without a campaign. */
  blocked: z.boolean(),
  networks: z.array(identifiedNetworkSchema),
  mainAudience: z
    .strictObject({
      country: z.string(),
      sharePercent: z.number().nullable(),
    })
    .nullable(),
  reasons: z.array(creatorSearchReasonSchema).max(4),
  vigilance: creatorSearchVigilanceSchema.nullable(),
});
export type IdentifiedCreatorRow = z.infer<typeof identifiedCreatorRowSchema>;

/**
 * POST /v1/bo/creator-search, 200: the page, with the exact count. `nextPage` is null at the end and
 * at the cap; `capReached` says the cap hides rows (RG76). A page beyond the cap is a 400 on `page`.
 */
export const identifiedCreatorSearchResponseSchema = z.strictObject({
  state: z.literal("results"),
  total: z.number().int().min(0),
  page: z.number().int().min(1).max(CREATOR_SEARCH_PAGE_MAX),
  nextPage: z.number().int().min(2).max(CREATOR_SEARCH_PAGE_MAX).nullable(),
  capReached: z.boolean(),
  rows: z.array(identifiedCreatorRowSchema),
});
export type IdentifiedCreatorSearchResponse = z.infer<
  typeof identifiedCreatorSearchResponseSchema
>;

/** The facets a prefill may propose (modele §4): never F17, a right, an exclusivity, an age, a tranche. */
export const campaignPrefillFiltersSchema = creatorSearchFiltersSchema.pick({
  F1: true,
  F3: true,
  F4: true,
  F6: true,
  F8: true,
  F11: true,
});
export type CampaignPrefillFilters = z.infer<
  typeof campaignPrefillFiltersSchema
>;

export const campaignPrefillParamsSchema = z.strictObject({ id: z.uuid() });
export type CampaignPrefillParams = z.infer<typeof campaignPrefillParamsSchema>;

/** POST /v1/bo/campaigns/:id/creator-prefill, 200: the proposed filters and the line that journals them. */
export const campaignPrefillResponseSchema = z.strictObject({
  prefillId: z.uuid(),
  campaign: z.strictObject({ id: z.uuid(), title: z.string() }),
  filters: campaignPrefillFiltersSchema,
});
export type CampaignPrefillResponse = z.infer<
  typeof campaignPrefillResponseSchema
>;
