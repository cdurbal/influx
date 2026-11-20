// Contract of the brand's anonymous creator search (docs/mvp/10 RG1, RG2, RG17, RG41, RG42, RG57 to
// RG59, RG63, RG65; CA1, CA3, CA34 to CA37, CA41, CA42, CA49, CA65; D48, D78; jalons/l3e/modele.md §2
// to §5, §7, §10, which prevails for every name). Shared by apps/api and apps/web. One route, for a
// brand alone: POST /v1/creator-search, the door search.search_creators() of 0319 and 0320.
// - The entry is CLOSED: the facets of the base of the pilot (F12 suspended while D78 holds), the
//   sort, the rank of the page and the campaign of origin; no size of page (the base holds it, RG63),
//   no other key (400). Whether a facet of the base is open is the base's (search.facet_settings).
// - The answer is a state: `closed` (D38), `brand_not_published` (RG1), `too_narrow` (below k, the
//   SAME answer for 0 and 4, nothing else, CA35), or `results`: the count in a band (RG59), the page,
//   the cards. A card is the layer A of the public projection (`creatorProjectionBeforeSchema`, the
//   one module of apps/api that builds it), referenced by its alias (RG65), with its reasons in codes
//   and bands (RG41, no label, no number) and at most one note of vigilance (RG42).
// No handle, URL, exact figure or share, completeness, state, refused sector, account identifier,
// `public_ref`, rank, score, exact count, price, rate, currency nor net exists in it, not even empty
// (fiche invariants 2, 3, 13; CLAUDE.md §2).
import { z } from "./zod.ts";
import { creatorProjectionBeforeSchema } from "./creator-projection.ts";
import { resultCountBandSchema } from "./search-settings.ts";
import { countryCodeSchema } from "./signup.ts";

/** The four sorts of the pilot (RG44, modele §6): the default order and three named ones. */
export const CREATOR_SEARCH_SORTS = [
  "default",
  "audience",
  "verified_first",
  "new_profiles",
] as const;
export const creatorSearchSortSchema = z.enum(CREATOR_SEARCH_SORTS);
export type CreatorSearchSort = z.infer<typeof creatorSearchSortSchema>;

/**
 * The highest page the contract admits (the domain of the door, 0320). The cap in force is lower, a
 * setting of the base (`max_pages`): beyond it, 400 `validation_failed` on `page` with the issue
 * `page_cap`, journaled (RG63, CA41, CA42).
 */
export const CREATOR_SEARCH_PAGE_MAX = 50;

/** The issue of `page` beyond the cap of the base (CA42). */
export const CREATOR_SEARCH_PAGE_CAP_ISSUE = "page_cap";

/** The issue of `filters` the base refused: a facet of the base closed in table (RG11, RG12). */
export const CREATOR_SEARCH_FILTERS_ISSUE = "invalid_filters";

/** A code of a reference list, as the door checks it (0319 §4.3). */
const filterCodeSchema = z.string().regex(/^[A-Za-z0-9_]{1,64}$/);

/** A list of 1 to 20 distinct values: OR inside a facet (RG17). */
function filterList<T extends z.ZodType<string>>(item: T, max: number) {
  return z
    .array(item)
    .min(1)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate",
    });
}

/** The share bands of the main country of the audience a brand may ask for (F6, 07 RG58). */
export const CREATOR_SEARCH_SHARE_BANDS = ["ge_80", "50_80", "lt_50"] as const;

/**
 * The filters (modele §3): key = facet code of the base, AND between them (RG17). F1 the main topic;
 * F3 networks, F4 audience bands of a listed line, F8 languages, F11 formats, F17 badges; F6 the main
 * country of the audience and its share, together.
 */
export const creatorSearchFiltersSchema = z.strictObject({
  F1: filterCodeSchema.optional(),
  F3: filterList(filterCodeSchema, 20).optional(),
  F4: filterList(filterCodeSchema, 20).optional(),
  F6: z
    .strictObject({
      country: countryCodeSchema,
      shareBands: filterList(z.enum(CREATOR_SEARCH_SHARE_BANDS), 3).optional(),
    })
    .optional(),
  F8: filterList(filterCodeSchema, 20).optional(),
  F11: filterList(filterCodeSchema, 20).optional(),
  F17: filterList(
    z.enum(["account_verified", "audience_verified"]),
    2,
  ).optional(),
});
export type CreatorSearchFilters = z.infer<typeof creatorSearchFiltersSchema>;
export type CreatorSearchFacetCode = keyof CreatorSearchFilters;

/**
 * RG60, CA37: the order in which the screen proposes to widen a search below k, a STATIC list, never
 * drawn from a query (modele §4).
 */
export const WIDENING_ORDER = [
  "F17",
  "F4",
  "F6",
  "F11",
  "F8",
  "F3",
  "F1",
] as const satisfies readonly CreatorSearchFacetCode[];

/**
 * The states of a brand's campaign a search may be linked to (L3F modele §1, L3ES-1): `draft` and
 * `rejected` answer as an unknown campaign, so the screen never offers them. The base decides
 * (`search.is_admitted_campaign()`); this list only draws the choice.
 */
export const CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES = [
  "pending_review",
  "published",
  "paused",
  "closed",
] as const;

/** POST /v1/creator-search: the whole entry, nothing else (no size of page, RG63). */
export const creatorSearchBodySchema = z.strictObject({
  filters: creatorSearchFiltersSchema,
  sort: creatorSearchSortSchema.default("default"),
  page: z.number().int().min(1).max(CREATOR_SEARCH_PAGE_MAX).default(1),
  /** The campaign of origin, one of the brand's own (RG37): another's answers as an unknown one. */
  campaignId: z.uuid().optional(),
});
export type CreatorSearchBody = z.infer<typeof creatorSearchBodySchema>;

/** A parameter of a reason: a code or a band, never a number (RG41, modele §7). */
const reasonParamSchema = z.string().regex(/^[A-Za-z0-9_]{1,64}$/);

const reasonOf = <Code extends string, Keys extends readonly string[]>(
  code: Code,
  keys: Keys,
) =>
  z.strictObject({
    code: z.literal(code),
    params: z.strictObject(
      Object.fromEntries(keys.map((key) => [key, reasonParamSchema])) as {
        [Key in Keys[number]]: typeof reasonParamSchema;
      },
    ),
  });

/** The « Proposé car » reasons (search.explanation_reasons of kind reason, 0316): code and keys. */
export const CREATOR_SEARCH_REASON_PARAM_KEYS = {
  topic_match: ["topic"],
  network_match: ["network", "audienceBand"],
  audience_country_match: ["country", "shareBand"],
  language_match: ["language"],
  format_match: ["format"],
  campaign_format: ["network", "format"],
  campaign_audience_country: ["country", "shareBand"],
  audience_verified: ["network"],
  account_verified: ["network"],
  figures_fresh: ["network"],
  available: ["availability"],
  primary_topic: ["topic"],
  main_audience: ["country", "shareBand"],
} as const;
export type CreatorSearchReasonCode =
  keyof typeof CREATOR_SEARCH_REASON_PARAM_KEYS;

const K = CREATOR_SEARCH_REASON_PARAM_KEYS;

export const creatorSearchReasonSchema = z.discriminatedUnion("code", [
  reasonOf("topic_match", K.topic_match),
  reasonOf("network_match", K.network_match),
  reasonOf("audience_country_match", K.audience_country_match),
  reasonOf("language_match", K.language_match),
  reasonOf("format_match", K.format_match),
  reasonOf("campaign_format", K.campaign_format),
  reasonOf("campaign_audience_country", K.campaign_audience_country),
  reasonOf("audience_verified", K.audience_verified),
  reasonOf("account_verified", K.account_verified),
  reasonOf("figures_fresh", K.figures_fresh),
  reasonOf("available", K.available),
  reasonOf("primary_topic", K.primary_topic),
  reasonOf("main_audience", K.main_audience),
]);
export type CreatorSearchReason = z.infer<typeof creatorSearchReasonSchema>;

/** The notes of vigilance (kind vigilance, 0316): one at most per card (RG42). */
export const CREATOR_SEARCH_VIGILANCE_CODES = [
  "stale_figures",
  "recent_profile",
  "audience_badge_to_renew",
  "declared_full",
] as const;
export const creatorSearchVigilanceSchema = z.enum(
  CREATOR_SEARCH_VIGILANCE_CODES,
);

/** A card (modele §2): the layer A whole, its 2 to 4 reasons, its note; no rank, no identifier. */
export const creatorSearchCardSchema = z.strictObject({
  creator: creatorProjectionBeforeSchema,
  reasons: z.array(creatorSearchReasonSchema).min(2).max(4),
  vigilance: creatorSearchVigilanceSchema.nullable(),
});
export type CreatorSearchCard = z.infer<typeof creatorSearchCardSchema>;

/** The states without a list (RG1, RG2, RG57, CA35): nothing else in them, no count. */
export const CREATOR_SEARCH_EMPTY_STATES = [
  "closed",
  "brand_not_published",
  "too_narrow",
] as const;

/**
 * POST /v1/creator-search, 200: a state alone, or the results (modele §4, §5). `nextPage` is null at
 * the end and at the cap; `capReached` says the cap hides cards (RG63); beyond the results, no card.
 */
export const creatorSearchResponseSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("closed") }),
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({ state: z.literal("too_narrow") }),
  z.strictObject({
    state: z.literal("results"),
    countBand: resultCountBandSchema,
    page: z.number().int().min(1).max(CREATOR_SEARCH_PAGE_MAX),
    nextPage: z.number().int().min(2).max(CREATOR_SEARCH_PAGE_MAX).nullable(),
    capReached: z.boolean(),
    cards: z.array(creatorSearchCardSchema),
  }),
]);
export type CreatorSearchResponse = z.infer<typeof creatorSearchResponseSchema>;
