// What the identified creator search shows and sends (docs/mvp/10 RG16, RG17, RG71 to RG73, RG76, RG77; 17b §3.3,
// §4.9; jalons/l3g/modele.md §2, §8; L3G-12), computed from the answers of apps/api. Pure functions, outside the
// components: the facets and their choices, the filters a click changes, the chips of the facets applied, the
// body of a search, the row in words, the three facets to widen with, what a refused call means. No rule is
// decided here: the database says which facet is open, which list is in bounds, which page is beyond the cap and
// which pair is blocked; these functions only spare a round trip and word what came back. No amount, tariff or
// price is read, kept or shown (D48, D78): the contract holds none. A block is a boolean, never worded as a motive
// nor an author (RG71).
import { ISO_COUNTRY_CODES } from "@influx/contracts/countries";
import {
  CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES,
  CREATOR_SEARCH_SHARE_BANDS,
  CREATOR_SEARCH_SORTS,
  WIDENING_ORDER,
  type CreatorSearchReason,
  type CreatorSearchSort,
} from "@influx/contracts/creator-search";
import {
  IDENTIFIED_DECLARED_STATUSES,
  IDENTIFIED_PROFILE_STATES,
  IDENTIFIED_SEARCH_FILTERS_ISSUE,
  IDENTIFIED_SEARCH_PAGE_CAP_ISSUE,
  type CampaignPrefillFilters,
  type IdentifiedCreatorFilters,
  type IdentifiedCreatorRow,
  type IdentifiedCreatorSearchBody,
  type IdentifiedNetwork,
} from "@influx/contracts/identified-creator-search";
import { messages } from "@/messages/fr";
import { humanCode } from "./queue-review-facts";
import { networkWords } from "./verification-queue-view";
import { countryName, formatDay } from "./view-model";

const t = messages.identifiedSearch;

export const IDENTIFIED_SEARCH_HREF = "/createurs/recherche";
/** Where a commercial picks a campaign: the campaigns are reached by their queue and their record (17b §1.2). */
export const CAMPAIGN_CHOICE_HREF = "/files/campagnes";

// --- Addresses -----------------------------------------------------------------------------------------

/** The search opened from a campaign (10 RG73): the address carries the identifier alone. */
export function compatibleHref(campaignId: string): string {
  return `${IDENTIFIED_SEARCH_HREF}?campagne=${campaignId}`;
}

/** Whether the base can admit the campaign to the search: out of draft and not rejected (modele §4). */
export function isCompatibleOffered(status: string): boolean {
  return (
    CREATOR_SEARCH_ORIGIN_CAMPAIGN_STATUSES as readonly string[]
  ).includes(status);
}

/** The campaign of the address: an identifier as the base writes it, or none (a free search). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function campaignOfAddress(value: string | null): string | null {
  return value !== null && UUID.test(value) ? value.toLowerCase() : null;
}

// --- The facets and their choices (reference lists, 04 R8: the codes are the base's, the words the front's) ---

export type Choice = { code: string; label: string };

/** The topics of reference.topics (0201). Words: the code in clear, as the other screens of the front do. */
export const TOPIC_CODES: readonly string[] = [
  "beauty",
  "fashion",
  "food",
  "travel",
  "sport_fitness",
  "wellness",
  "family",
  "home",
  "gaming",
  "tech",
  "entertainment",
  "music",
  "culture",
  "education",
  "business_finance",
  "automotive",
  "pets",
];

export const NETWORK_CODES: readonly string[] = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "x",
  "snapchat",
  "twitch",
  "pinterest",
  "threads",
];

/** The formats of reference.formats (0201). */
export const FORMAT_CODES: readonly string[] = [
  "instagram_post",
  "instagram_carousel",
  "instagram_reel",
  "instagram_story",
  "instagram_live",
  "tiktok_video",
  "tiktok_carousel",
  "tiktok_live",
  "youtube_video",
  "youtube_integration",
  "youtube_short",
  "youtube_live",
  "facebook_post",
  "facebook_reel",
  "facebook_story",
  "linkedin_post",
  "x_post",
  "threads_post",
  "snapchat_story",
  "snapchat_spotlight",
  "twitch_live",
  "pinterest_pin",
  "ugc_video",
  "ugc_photo",
];

/** The languages offered to the facet (ISO 639-1 codes of reference.languages, 0003): the usual ones, the base checks. */
export const LANGUAGE_CODES: readonly string[] = [
  "fr",
  "en",
  "es",
  "de",
  "it",
  "pt",
  "nl",
  "ar",
  "tr",
  "pl",
  "ru",
  "ja",
  "ko",
  "zh",
  "hi",
];

export const AUDIENCE_BAND_CODES: readonly string[] = [
  "nano",
  "micro",
  "mid",
  "macro",
  "mega",
];

export const SECTOR_CODES: readonly string[] = [
  "alcohol",
  "gambling",
  "cbd",
  "finance",
  "health",
  "crypto",
  "adult",
  "beauty_personal_care",
  "fashion_accessories",
  "food_beverages",
  "restaurants_hospitality",
  "travel_tourism",
  "sports_leisure",
  "home_garden",
  "consumer_electronics",
  "software_telecom",
  "video_games",
  "automotive_mobility",
  "media_entertainment",
  "education_training",
  "baby_kids",
  "pet_care",
  "retail_ecommerce",
  "real_estate",
  "business_services",
  "nonprofit_public",
];

export const BADGE_CODES = ["account_verified", "audience_verified"] as const;

const languageNames = new Intl.DisplayNames(["fr-FR"], { type: "language" });

export function languageWords(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function badgeWords(code: string): string {
  return t.badges[code] ?? humanCode(code);
}

function audienceBandWords(code: string): string {
  return t.audienceBands[code] ?? humanCode(code);
}

function shareBandWords(code: string): string {
  return t.shareBands[code] ?? humanCode(code);
}

/** The lists of a facet: a code of its list, in words, for the controls and the chips. */
export type ListFacet =
  "F3" | "F4" | "F8" | "F11" | "F17" | "G1" | "G2" | "G10";

/** What a list facet is called, what its choices are, how a choice reads, how its chip reads, how many it holds. */
type ListFacetSpec = {
  label: string;
  codes: readonly string[];
  words: (code: string) => string;
  chip: (value: string) => string;
  max: number;
};

const CHIPS = t.criteria;

export const LIST_FACETS: Readonly<Record<ListFacet, ListFacetSpec>> = {
  F3: {
    label: t.facets.networks,
    codes: NETWORK_CODES,
    words: networkWords,
    chip: CHIPS.networks,
    max: 20,
  },
  F4: {
    label: t.facets.audienceBands,
    codes: AUDIENCE_BAND_CODES,
    words: audienceBandWords,
    chip: CHIPS.audienceBands,
    max: 20,
  },
  F8: {
    label: t.facets.languages,
    codes: LANGUAGE_CODES,
    words: languageWords,
    chip: CHIPS.languages,
    max: 20,
  },
  F11: {
    label: t.facets.formats,
    codes: FORMAT_CODES,
    words: humanCode,
    chip: CHIPS.formats,
    max: 20,
  },
  F17: {
    label: t.facets.badges,
    codes: BADGE_CODES,
    words: badgeWords,
    chip: CHIPS.badges,
    max: 2,
  },
  G1: {
    label: t.facets.declaredStatus,
    codes: IDENTIFIED_DECLARED_STATUSES,
    words: (code) => t.declaredStatuses[code] ?? humanCode(code),
    chip: CHIPS.declaredStatus,
    max: 2,
  },
  G2: {
    label: t.facets.profileState,
    codes: IDENTIFIED_PROFILE_STATES,
    words: stateWords,
    chip: CHIPS.profileState,
    max: 5,
  },
  G10: {
    label: t.facets.refusedSectors,
    codes: SECTOR_CODES,
    words: humanCode,
    chip: CHIPS.refusedSectors,
    max: 20,
  },
};

export function choicesOf(facet: ListFacet): Choice[] {
  const spec = LIST_FACETS[facet];
  return spec.codes.map((code) => ({ code, label: spec.words(code) }));
}

export function topicChoices(): Choice[] {
  return TOPIC_CODES.map((code) => ({ code, label: humanCode(code) }));
}

export function shareChoices(): Choice[] {
  return CREATOR_SEARCH_SHARE_BANDS.map((code) => ({
    code,
    label: shareBandWords(code),
  }));
}

// --- The filters a click changes -----------------------------------------------------------------------

export type Filters = IdentifiedCreatorFilters;

/** A choice added to a list facet or taken away; an emptied list leaves the facet, a full one takes no more. */
export function toggledFilters(
  filters: Filters,
  facet: ListFacet,
  code: string,
): Filters {
  const current: readonly string[] = filters[facet] ?? [];
  const next = current.includes(code)
    ? current.filter((value) => value !== code)
    : [...current, code];
  if (next.length > LIST_FACETS[facet].max) {
    return filters;
  }
  const { [facet]: _left, ...rest } = filters;
  void _left;
  return (next.length === 0 ? rest : { ...rest, [facet]: next }) as Filters;
}

/** The main topic (F1): one code or none. */
export function withTopic(filters: Filters, code: string | null): Filters {
  const { F1: _left, ...rest } = filters;
  void _left;
  return code === null ? rest : { ...rest, F1: code };
}

/** The country of the audience (F6) or of the residence (G9): one country; F6 keeps its share bands while it stays. */
export function withCountry(
  filters: Filters,
  facet: "F6" | "G9",
  code: string | null,
): Filters {
  const { [facet]: current, ...rest } = filters;
  const country = ISO_COUNTRY_CODES.find((known) => known === code);
  if (country === undefined) {
    return rest;
  }
  if (facet === "F6") {
    const bands = filters.F6?.shareBands;
    return {
      ...rest,
      F6: bands === undefined ? { country } : { country, shareBands: bands },
    };
  }
  void current;
  return { ...rest, G9: { country } };
}

/** A share band of the country of the audience, added or taken away; without a country there is none to hold it. */
export function withShareBand(filters: Filters, band: string): Filters {
  const country = filters.F6?.country;
  if (country === undefined) {
    return filters;
  }
  const current: readonly string[] = filters.F6?.shareBands ?? [];
  const next = current.includes(band)
    ? current.filter((value) => value !== band)
    : [...current, band];
  const bands = (CREATOR_SEARCH_SHARE_BANDS as readonly string[]).filter(
    (value) => next.includes(value),
  ) as (typeof CREATOR_SEARCH_SHARE_BANDS)[number][];
  return {
    ...filters,
    F6: bands.length === 0 ? { country } : { country, shareBands: bands },
  };
}

/** The filters the brief proposes, as the search takes them. */
export function filtersOfPrefill(proposed: CampaignPrefillFilters): Filters {
  return { ...proposed };
}

// --- The chips of the facets applied ---------------------------------------------------------------------

/** One facet applied, one value of it: the chip says it and takes it away alone. */
export type Criterion = {
  id: string;
  facet: keyof Filters;
  /** The value taken away, or null for the whole facet. */
  value: string | null;
  text: string;
};

const LIST_ORDER: readonly ListFacet[] = [
  "F3",
  "F4",
  "F11",
  "F8",
  "F17",
  "G1",
  "G2",
  "G10",
];

export function criteriaOf(filters: Filters): Criterion[] {
  const criteria: Criterion[] = [];
  if (filters.F1 !== undefined) {
    criteria.push({
      id: "F1",
      facet: "F1",
      value: null,
      text: CHIPS.topic(humanCode(filters.F1)),
    });
  }
  if (filters.F6 !== undefined) {
    criteria.push({
      id: "F6",
      facet: "F6",
      value: null,
      text: CHIPS.audienceCountry(countryName(filters.F6.country)),
    });
    for (const band of filters.F6.shareBands ?? []) {
      criteria.push({
        id: `F6:${band}`,
        facet: "F6",
        value: band,
        text: CHIPS.share(shareBandWords(band)),
      });
    }
  }
  for (const facet of LIST_ORDER) {
    for (const code of filters[facet] ?? []) {
      criteria.push({
        id: `${facet}:${code}`,
        facet,
        value: code,
        text: LIST_FACETS[facet].chip(LIST_FACETS[facet].words(code)),
      });
    }
  }
  if (filters.G9 !== undefined) {
    criteria.push({
      id: "G9",
      facet: "G9",
      value: null,
      text: CHIPS.residence(countryName(filters.G9.country)),
    });
  }
  return criteria;
}

/** The filters without one chip: a share band alone, a value of a list, or the whole facet. */
export function withoutCriterion(
  filters: Filters,
  criterion: Pick<Criterion, "facet" | "value">,
): Filters {
  const { facet, value } = criterion;
  if (facet === "F6" && value !== null) {
    return withShareBand(filters, value);
  }
  if (value !== null && facet in LIST_FACETS) {
    return toggledFilters(filters, facet as ListFacet, value);
  }
  const { [facet]: _left, ...rest } = filters;
  void _left;
  return rest;
}

/** The facets the field names as the most restrictive to widen with, from the static list (RG60), at most three. */
export function wideningOf(
  filters: Filters,
): { facet: (typeof WIDENING_ORDER)[number]; label: string }[] {
  const names: Readonly<Record<(typeof WIDENING_ORDER)[number], string>> = {
    F17: t.facets.badges,
    F4: t.facets.audienceBands,
    F6: t.facets.audienceCountry,
    F11: t.facets.formats,
    F8: t.facets.languages,
    F3: t.facets.networks,
    F1: t.facets.topic,
  };
  return WIDENING_ORDER.filter((facet) => filters[facet] !== undefined)
    .slice(0, 3)
    .map((facet) => ({ facet, label: names[facet] }));
}

export function isEmptyFilters(filters: Filters): boolean {
  return Object.keys(filters).length === 0;
}

// --- What a search sends ----------------------------------------------------------------------------------

export type SearchQuery = {
  filters: Filters;
  sort: CreatorSearchSort;
  page: number;
  campaignId: string | null;
  /** The prefill the filters were drawn from (CA56): kept after « Vider », so that the correction is journaled. */
  prefillId: string | null;
};

export const FIRST_QUERY: SearchQuery = {
  filters: {},
  sort: "default",
  page: 1,
  campaignId: null,
  prefillId: null,
};

export function bodyOf(query: SearchQuery): IdentifiedCreatorSearchBody {
  return {
    filters: query.filters,
    sort: query.sort,
    page: query.page,
    ...(query.campaignId === null ? {} : { campaignId: query.campaignId }),
    ...(query.prefillId === null ? {} : { prefillId: query.prefillId }),
  };
}

export function sortOptions(): Choice[] {
  return CREATOR_SEARCH_SORTS.map((code) => ({
    code,
    label: t.sorts[code] ?? code,
  }));
}

export function sortOf(value: string): CreatorSearchSort {
  return CREATOR_SEARCH_SORTS.find((sort) => sort === value) ?? "default";
}

// --- The row in words --------------------------------------------------------------------------------------

function stateWords(state: string): string {
  return t.states[state] ?? humanCode(state);
}

const integer = new Intl.NumberFormat("fr-FR");

function integerWords(value: number): string {
  return integer.format(value);
}

/** Basis points as a percentage: 320 → « 3,2 % ». */
export function rateWords(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} %`;
}

/** A link of the creator only when it is an https address: nothing else is ever made a link (RG77, D46). */
export function safeProfileUrl(url: string | null): string | null {
  if (url === null) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export type HandleView = {
  network: string;
  text: string | null;
  href: string | null;
};

export type RowView = {
  key: string;
  alias: string;
  /** The real name, then the alias: two lines (17b §3.3). */
  legalName: string;
  handles: HandleView[];
  audience: string[];
  badges: string[];
  state: string;
  /** A profile not published says so in words, beside its state. */
  unpublished: boolean;
  blocked: boolean;
  owner: string;
  why: string;
  vigilance: string | null;
  exact: string[];
};

function reasonWords(reason: CreatorSearchReason): string {
  const r = t.reasons;
  const p = reason.params as Readonly<Record<string, string>>;
  const network = (code: string | undefined) => networkWords(code ?? null);
  switch (reason.code) {
    case "topic_match":
      return r.topic_match(humanCode(p.topic ?? ""));
    case "network_match":
      return r.network_match(
        network(p.network),
        audienceBandWords(p.audienceBand ?? ""),
      );
    case "audience_country_match":
      return r.audience_country_match(
        countryName(p.country ?? ""),
        shareBandWords(p.shareBand ?? ""),
      );
    case "language_match":
      return r.language_match(languageWords(p.language ?? ""));
    case "format_match":
      return r.format_match(humanCode(p.format ?? ""));
    case "campaign_format":
      return r.campaign_format(network(p.network), humanCode(p.format ?? ""));
    case "campaign_audience_country":
      return r.campaign_audience_country(
        countryName(p.country ?? ""),
        shareBandWords(p.shareBand ?? ""),
      );
    case "audience_verified":
      return r.audience_verified(network(p.network));
    case "account_verified":
      return r.account_verified(network(p.network));
    case "figures_fresh":
      return r.figures_fresh(network(p.network));
    case "available":
      return r.available(humanCode(p.availability ?? ""));
    case "primary_topic":
      return r.primary_topic(humanCode(p.topic ?? ""));
    case "main_audience":
      return r.main_audience(
        countryName(p.country ?? ""),
        shareBandWords(p.shareBand ?? ""),
      );
  }
}

export function whyWords(row: Pick<IdentifiedCreatorRow, "reasons">): string {
  return row.reasons.length === 0
    ? t.row.whyNone
    : row.reasons.map(reasonWords).join(t.row.reasonsJoin);
}

/** The exact line of a network: every figure the creator record serves, nothing estimated. */
export function networkExactWords(network: IdentifiedNetwork): string {
  const r = t.row;
  const parts: string[] = [];
  if (network.followers !== null) {
    parts.push(r.followers(integerWords(network.followers)));
  }
  if (network.postsLast30Days !== null) {
    parts.push(r.posts(integerWords(network.postsLast30Days)));
  }
  if (network.avgComments !== null) {
    parts.push(r.comments(integerWords(network.avgComments)));
  }
  if (network.engagementBp !== null) {
    parts.push(r.engagement(rateWords(network.engagementBp)));
  }
  if (network.measuredAt !== null) {
    parts.push(r.measured(formatDay(network.measuredAt.slice(0, 10))));
  }
  parts.push(r.sources[network.source] ?? network.source);
  return r.networkLine(
    networkWords(network.network),
    network.isPrimary,
    parts.length === 1 ? [r.noFigures, ...parts] : parts,
  );
}

/** The main line of the audience: the followers of the main network, the country and its share. */
function audienceWords(row: IdentifiedCreatorRow): string[] {
  const main =
    row.networks.find((network) => network.isPrimary) ?? row.networks[0];
  if (main === undefined || main.followers === null) {
    return [t.row.noAudience];
  }
  const country =
    row.mainAudience === null
      ? null
      : row.mainAudience.sharePercent === null
        ? countryName(row.mainAudience.country)
        : `${countryName(row.mainAudience.country)} ${integerWords(row.mainAudience.sharePercent)} %`;
  return [t.row.audienceLine(integerWords(main.followers), country)];
}

function badgeLines(row: IdentifiedCreatorRow): string[] {
  return row.networks.flatMap((network) =>
    network.badge === null
      ? []
      : [
          t.row.networkBadge(
            networkWords(network.network),
            network.badge.state === "to_refresh"
              ? `${badgeWords(network.badge.level)} (${t.badgeToRefresh})`
              : badgeWords(network.badge.level),
          ),
        ],
  );
}

function placeWords(row: IdentifiedCreatorRow): string {
  const country = countryName(row.residence.country);
  return row.residence.region === null
    ? country
    : `${country} (${row.residence.region})`;
}

export function rowViewOf(row: IdentifiedCreatorRow): RowView {
  const exact = [
    ...row.networks.map(networkExactWords),
    ...(row.mainAudience === null
      ? []
      : [
          t.row.mainAudience(
            countryName(row.mainAudience.country),
            row.mainAudience.sharePercent === null
              ? null
              : `${integerWords(row.mainAudience.sharePercent)} %`,
          ),
        ]),
    t.row.residence(placeWords(row)),
    ...(row.city === null ? [] : [t.row.city(row.city)]),
    ...(row.declaredStatus === null
      ? []
      : [
          t.row.declared(
            t.declaredStatuses[row.declaredStatus] ?? row.declaredStatus,
          ),
        ]),
    ...(row.refusedSectors.length === 0
      ? []
      : [t.row.refusedSectors(row.refusedSectors.map(humanCode).join(", "))]),
  ];
  return {
    key: row.accountId,
    alias: row.alias,
    legalName:
      row.legalName === null || row.legalName.trim() === ""
        ? t.row.unnamed
        : row.legalName,
    handles: row.networks.map((network) => ({
      network: networkWords(network.network),
      text:
        network.handle !== null
          ? `@${network.handle.replace(/^@+/, "")}`
          : network.pseudonym,
      href: safeProfileUrl(network.profileUrl),
    })),
    audience: audienceWords(row),
    badges: badgeLines(row),
    state: stateWords(row.status),
    unpublished: row.status !== "published",
    blocked: row.blocked,
    owner: row.ownerAgent?.firstName ?? t.row.noOwner,
    why: whyWords(row),
    vigilance:
      row.vigilance === null
        ? null
        : t.row.vigilance(t.vigilance[row.vigilance] ?? row.vigilance),
    exact,
  };
}

// --- What a refusal means ----------------------------------------------------------------------------------

/** The cause in clear of a search the base refused or could not serve; the facets stay as typed (17b §3.3). */
export function failureWords(
  code: string | undefined,
  issues: readonly string[] | undefined,
  retryAfterSeconds: number | undefined,
): string {
  const f = t.failures;
  if (code === "validation_failed") {
    if (issues?.includes(IDENTIFIED_SEARCH_PAGE_CAP_ISSUE) === true) {
      return f.pageCap;
    }
    if (issues?.includes(IDENTIFIED_SEARCH_FILTERS_ISSUE) === true) {
      return f.filters;
    }
  }
  if (code === "not_found") {
    return f.campaign;
  }
  if (code === "rate_limited") {
    return f.rateLimited(retryAfterSeconds ?? null);
  }
  if (code === "service_unavailable") {
    return f.setting;
  }
  return f.generic;
}
