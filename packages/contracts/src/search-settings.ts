// The settings of the anonymous creator search, as data (docs/mvp/04 §5.5; 10 RG2, RG11 to RG14,
// RG57, RG59, RG63, RG88; jalons/l3e/modele.md §4, §9, which prevails for every name). One zod schema
// per key of search.search_settings, the same bounds as the CHECK of migration 0316 (EC-L3E-03-1):
// apps/api validates a value it reads before using it, and the settings route of L3G validates what an
// administrator sends before search.write_search_setting(). The facets: the 24 codes of RG12 to RG14,
// their wave, the base (F12 suspended while D78 holds). The band of a count served (RG59): the only
// count a brand ever reads, never the exact one.
import { z } from "./zod.ts";

const wholeNumber = (min: number, max: number) =>
  z.number().int().min(min).max(max);

/** The eight keys of search.search_settings (closed by CHECK; no alert_thresholds, modele §9). */
export const SEARCH_SETTING_KEYS = [
  "is_open_to_advertisers",
  "k_anonymity_threshold",
  "page_size",
  "max_pages",
  "rate_limits",
  "cold_profile_quota",
  "critical_mass_thresholds",
  "region_display_threshold",
] as const;
export type SearchSettingKey = (typeof SEARCH_SETTING_KEYS)[number];

export const searchSettingValueSchemas = {
  /** D38, RG2, CA59: false = closed, no list served. */
  is_open_to_advertisers: z.boolean(),
  /** RG57: counted after the exclusions; below it, nothing listed (modele §4: 5 to 50). */
  k_anonymity_threshold: wholeNumber(5, 50),
  /** RG63, CA41: read at every call, never a parameter of the client. */
  page_size: wholeNumber(1, 50),
  max_pages: wholeNumber(1, 50),
  /** RG63, T15: per account, in base. */
  rate_limits: z
    .strictObject({
      perHour: wholeNumber(1, 1000),
      perDay: wholeNumber(1, 20_000),
      profileOpensPerDay: wholeNumber(1, 1000),
    })
    .refine((limits) => limits.perHour <= limits.perDay, {
      message: "per_hour_above_per_day",
    }),
  /** RG45: the cold profiles of page 1 of the default sort. */
  cold_profile_quota: z.strictObject({
    slots: wholeNumber(0, 50),
    recentDays: wholeNumber(1, 365),
  }),
  /** D38: what PROPOSES the opening, never flips it. */
  critical_mass_thresholds: z.strictObject({
    publishedProfiles: wholeNumber(1, 100_000),
    perTopic: wholeNumber(1, 100_000),
  }),
  /** 07 RG37, 10 RG15: the region shown from this many published profiles of a (country, region). */
  region_display_threshold: wholeNumber(5, 50),
} as const satisfies Record<SearchSettingKey, z.ZodType>;

/** One key and its value, as an administrator sends it and as apps/api reads it. */
export const searchSettingSchema = z.discriminatedUnion("key", [
  z.strictObject({
    key: z.literal("is_open_to_advertisers"),
    value: searchSettingValueSchemas.is_open_to_advertisers,
  }),
  z.strictObject({
    key: z.literal("k_anonymity_threshold"),
    value: searchSettingValueSchemas.k_anonymity_threshold,
  }),
  z.strictObject({
    key: z.literal("page_size"),
    value: searchSettingValueSchemas.page_size,
  }),
  z.strictObject({
    key: z.literal("max_pages"),
    value: searchSettingValueSchemas.max_pages,
  }),
  z.strictObject({
    key: z.literal("rate_limits"),
    value: searchSettingValueSchemas.rate_limits,
  }),
  z.strictObject({
    key: z.literal("cold_profile_quota"),
    value: searchSettingValueSchemas.cold_profile_quota,
  }),
  z.strictObject({
    key: z.literal("critical_mass_thresholds"),
    value: searchSettingValueSchemas.critical_mass_thresholds,
  }),
  z.strictObject({
    key: z.literal("region_display_threshold"),
    value: searchSettingValueSchemas.region_display_threshold,
  }),
]);
export type SearchSetting = z.infer<typeof searchSettingSchema>;

/** RG12 (the base), RG13 (the second wave), RG14 (the third): the 24 codes and their wave. */
export const SEARCH_FACET_WAVES = {
  F1: 1,
  F3: 1,
  F4: 1,
  F6: 1,
  F8: 1,
  F11: 1,
  F12: 1,
  F17: 1,
  F2: 2,
  F5: 2,
  F7: 2,
  F9: 2,
  F10: 2,
  F13: 2,
  F14: 2,
  F15: 2,
  F16: 2,
  F18: 2,
  F20: 2,
  F22: 2,
  F23: 2,
  F24: 2,
  F25: 2,
  F19: 3,
} as const;
export type SearchFacetCode = keyof typeof SEARCH_FACET_WAVES;
export const SEARCH_FACET_CODES = Object.keys(
  SEARCH_FACET_WAVES,
) as SearchFacetCode[];

/** D78: no price is entered, so F12 never opens while it holds (CHECK of 0316). */
export const SUSPENDED_FACET_CODES = ["F12"] as const;

export const searchFacetCodeSchema = z.enum(
  SEARCH_FACET_CODES as [SearchFacetCode, ...SearchFacetCode[]],
);

/** What search.write_facet_setting() receives: an open facet belongs to the base, F12 stays closed. */
export const searchFacetSettingSchema = z
  .strictObject({
    code: searchFacetCodeSchema,
    isOpen: z.boolean(),
    // the display order of RG11, named apart from the portfolio column (TM11.4)
    facetOrder: wholeNumber(1, 99),
    note: z.string().trim().min(1).max(500).nullable(),
  })
  .refine(
    (setting) =>
      !setting.isOpen ||
      (SEARCH_FACET_WAVES[setting.code] === 1 &&
        !SUSPENDED_FACET_CODES.some((code) => code === setting.code)),
    { message: "facet_not_openable" },
  );
export type SearchFacetSetting = z.infer<typeof searchFacetSettingSchema>;

/** RG59, modele §4: the band of a count above k (search.result_count_band() of 0316). */
export const RESULT_COUNT_BANDS = ["5_9", "10_24", "25_49", "50_plus"] as const;
export const resultCountBandSchema = z.enum(RESULT_COUNT_BANDS);
export type ResultCountBand = z.infer<typeof resultCountBandSchema>;
