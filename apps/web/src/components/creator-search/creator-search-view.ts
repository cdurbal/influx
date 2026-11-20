// M4, the brand's anonymous creator search (docs/mvp/10 RG1, RG2, RG6, RG11, RG17, RG44, RG57 to RG60, RG63,
// RG64; 17 §4.4, §7.1; D38, D48, D78; jalons/l3f, commit 10), pure: the address in, the query out; the answer of
// `POST /v1/creator-search` in, the state of the screen out; the cards and the reasons as they are written. The
// answer is the ONLY input of a card: a card shows what the contract gives it (the layer A, its reasons in codes
// and bands, one note of vigilance) and no amount, tariff, currency, exact figure, rank or exact count exists in
// it, so none is built here (CLAUDE.md §2, D48, D78). The screen below the threshold is the same for 0 and for 4
// results, and its widenings are the static list of the contract (RG58, RG60, CA35, CA37): nothing here counts or
// asks. Nothing here ranks, filters or decides what is open: apps/api and the base do (E1 to E6, k, caps).
import {
  CREATOR_SEARCH_PAGE_MAX,
  CREATOR_SEARCH_SHARE_BANDS,
  CREATOR_SEARCH_SORTS,
  WIDENING_ORDER,
  creatorSearchBodySchema,
  creatorSearchFiltersSchema,
  type CreatorSearchBody,
  type CreatorSearchCard,
  type CreatorSearchFacetCode,
  type CreatorSearchFilters,
  type CreatorSearchReason,
  type CreatorSearchResponse,
  type CreatorSearchSort,
} from "@influx/contracts/creator-search";
import type { ResultCountBand } from "@influx/contracts/search-settings";
import { shortlistParamsSchema } from "@influx/contracts/shortlists";
import type { PreviewLabels } from "@/components/creator-profile/creator-preview-view";

/** The sort on opening (RG44): the default order, named « Pertinence » on the screen. */
export const DEFAULT_SEARCH_SORT: CreatorSearchSort = "default";

/** The sorts the control offers, in order (RG43, RG44): the four of the pilot, none by tariff (D78). */
export const SEARCH_SORTS: readonly CreatorSearchSort[] = CREATOR_SEARCH_SORTS;

/** The bands of audience of a listed line a brand may ask for (F4): the codes of the reference list (0201). */
export const AUDIENCE_BAND_CODES = [
  "nano",
  "micro",
  "mid",
  "macro",
  "mega",
] as const;

/** The badges a brand may ask for (F17). */
export const BADGE_CODES = ["account_verified", "audience_verified"] as const;

/** The share bands of the main country of the audience (F6), as the contract writes them. */
export const SHARE_BAND_CODES = CREATOR_SEARCH_SHARE_BANDS;

/** One card on a page of the grid, the first visual only (17 §7.1: one on the card, three on the profile). */
export const CARD_VISUALS_SHOWN = 1;

/** The query of a search: the criteria, the sort and the campaign of origin; the page is the address's own. */
export type SearchQuery = {
  filters: CreatorSearchFilters;
  sort: CreatorSearchSort;
  campaignId: string | null;
};

export const EMPTY_QUERY: SearchQuery = {
  filters: {},
  sort: DEFAULT_SEARCH_SORT,
  campaignId: null,
};

// --- the address ---------------------------------------------------------------------------------

/**
 * The parameters of the address of M4: a facet is its code (`F1` … `F17`, lists as codes separated by commas), the
 * share of F6 is `F6s`, then `sort`, `page`, `campaign` and `list` (the brand's active list: not a criterion, it never
 * changes the search nor its key). A value that is unreadable is ignored (never an error,
 * never a page that does not open): inside a list, the unreadable codes are dropped. The address is the applied
 * criteria: a reload, the back button and the request for a selection (reprise) read them.
 */
const PARAM = {
  topic: "F1",
  networks: "F3",
  audienceBands: "F4",
  country: "F6",
  shareBands: "F6s",
  languages: "F8",
  formats: "F11",
  badges: "F17",
  sort: "sort",
  page: "page",
  campaign: "campaign",
  list: "list",
} as const;

/** Reads one parameter of an address by its name; `undefined` when it holds none. */
export type ParamReader = (name: string) => string | undefined;

const CODE_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
const LIST_MAX = 20;
const SEPARATOR = ",";

/** The legible codes of a list written in an address: distinct, plain, at most 20; none when nothing is legible. */
function codesOf(raw: string | undefined): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const codes = [
    ...new Set(
      raw
        .split(SEPARATOR)
        .filter((code) => CODE_PATTERN.test(code))
        .slice(0, LIST_MAX),
    ),
  ];
  return codes.length === 0 ? undefined : codes;
}

/** The criteria an address holds, each one checked by the schema of the contract. */
function filtersOf(read: ParamReader): CreatorSearchFilters {
  const { shape } = creatorSearchFiltersSchema;
  const filters: CreatorSearchFilters = {};
  const topic = read(PARAM.topic);
  if (topic !== undefined && shape.F1.safeParse(topic).success) {
    filters.F1 = topic;
  }
  const lists = [
    ["F3", PARAM.networks],
    ["F4", PARAM.audienceBands],
    ["F8", PARAM.languages],
    ["F11", PARAM.formats],
  ] as const;
  for (const [facet, name] of lists) {
    const codes = codesOf(read(name));
    if (codes !== undefined) {
      filters[facet] = codes;
    }
  }
  const badges = codesOf(read(PARAM.badges))?.filter(
    (code) => shape.F17.safeParse([code]).success,
  );
  if (badges !== undefined && badges.length > 0) {
    filters.F17 = badges as NonNullable<CreatorSearchFilters["F17"]>;
  }
  const country = read(PARAM.country);
  if (country !== undefined) {
    const shareBands = codesOf(read(PARAM.shareBands))?.filter((code) =>
      (SHARE_BAND_CODES as readonly string[]).includes(code),
    ) as NonNullable<CreatorSearchFilters["F6"]>["shareBands"];
    const f6 = shape.F6.safeParse(
      shareBands === undefined || shareBands.length === 0
        ? { country }
        : { country, shareBands },
    );
    if (f6.success) {
      filters.F6 = f6.data;
    }
  }
  return filters;
}

/** The query, the page and the active list an address holds (every default when a value is missing or unreadable). */
export type SearchAddress = {
  query: SearchQuery;
  page: number;
  /** The list the panel « Ma sélection » shows; absent when the address names none (the newest one then). */
  listId?: string;
};

export function addressOf(read: ParamReader): SearchAddress {
  const sortValue = read(PARAM.sort);
  const sort =
    SEARCH_SORTS.find((candidate) => candidate === sortValue) ??
    DEFAULT_SEARCH_SORT;
  const campaign = read(PARAM.campaign);
  const campaignId =
    campaign !== undefined &&
    creatorSearchBodySchema.shape.campaignId.safeParse(campaign).success
      ? campaign
      : null;
  const pageValue = read(PARAM.page);
  const page =
    pageValue !== undefined && /^[0-9]{1,3}$/.test(pageValue)
      ? Number(pageValue)
      : 1;
  const list = read(PARAM.list);
  const listId =
    list !== undefined && shortlistParamsSchema.safeParse({ id: list }).success
      ? list
      : undefined;
  return {
    query: { filters: filtersOf(read), sort, campaignId },
    page: page >= 1 && page <= CREATOR_SEARCH_PAGE_MAX ? page : 1,
    ...(listId === undefined ? {} : { listId }),
  };
}

/** What Next gives a page for its query string: a value, a list of them, or nothing. */
export type RawSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/** `addressOf` over the `searchParams` of a page (the first value of a name repeated). */
export function addressOfParams(params: RawSearchParams): SearchAddress {
  return addressOf((name) => {
    const value = params[name];
    return typeof value === "string" ? value : value?.[0];
  });
}

/**
 * The query string of a query and a page, canonical (the order of the facets of the contract, defaults left out):
 * "" for the empty query, else "?F1=beauty&F3=instagram,tiktok". The same string is the key of a query.
 */
export function addressParamsOf(
  query: SearchQuery,
  page = 1,
  listId: string | null = null,
): string {
  const { filters } = query;
  const parts: string[] = [];
  const add = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== "") {
      parts.push(`${name}=${value}`);
    }
  };
  add(PARAM.topic, filters.F1);
  add(PARAM.networks, filters.F3?.join(SEPARATOR));
  add(PARAM.audienceBands, filters.F4?.join(SEPARATOR));
  add(PARAM.country, filters.F6?.country);
  add(PARAM.shareBands, filters.F6?.shareBands?.join(SEPARATOR));
  add(PARAM.languages, filters.F8?.join(SEPARATOR));
  add(PARAM.formats, filters.F11?.join(SEPARATOR));
  add(PARAM.badges, filters.F17?.join(SEPARATOR));
  if (query.sort !== DEFAULT_SEARCH_SORT) {
    add(PARAM.sort, query.sort);
  }
  add(PARAM.campaign, query.campaignId ?? undefined);
  add(PARAM.list, listId ?? undefined);
  if (page > 1) {
    add(PARAM.page, String(page));
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

/** The key of a query: two queries with the same criteria, sort and campaign are the same search. */
export function queryKeyOf(query: SearchQuery): string {
  return addressParamsOf(query);
}

/** The body of the call: the whole entry of the contract, nothing else (no size of page, RG63). */
export function bodyOf(query: SearchQuery, page: number): CreatorSearchBody {
  return {
    filters: query.filters,
    sort: query.sort,
    page,
    ...(query.campaignId === null ? {} : { campaignId: query.campaignId }),
  };
}

// --- the criteria ---------------------------------------------------------------------------------

/** The facets of the pilot in the order of the form, the order of the contract (7, F12 suspended). */
export const FACET_ORDER = [
  "F1",
  "F3",
  "F4",
  "F6",
  "F8",
  "F11",
  "F17",
] as const satisfies readonly CreatorSearchFacetCode[];

/**
 * The words of the screen: `card` reads the namespace `creatorProfile` (the words of the card, one source with the
 * preview of a creator), `text` the namespace `creatorSearch`. `text` may be asked only for a key that exists.
 */
export type SearchLabels = {
  card: PreviewLabels;
  text: (key: string, values?: Record<string, string | number>) => string;
};

/** A criterion applied, as a chip of « Critères actifs » (17 §4.4): removing it widens the search. */
export type Criterion = {
  id: string;
  facet: CreatorSearchFacetCode;
  /** The code the chip stands for; null for the chip of the whole facet (F1, the country of F6). */
  value: string | null;
  label: string;
};

function bandLabelOf(
  labels: PreviewLabels,
  group: string,
  code: string,
): string {
  const key = `${group}.${code}`;
  return labels.has(key) ? labels.text(key) : code;
}

/** The value of a facet as it is written: the topic, the network, the band… (a code without a label shows as itself). */
export function criterionValueLabel(
  facet: CreatorSearchFacetCode,
  code: string,
  labels: SearchLabels,
): string {
  switch (facet) {
    case "F1":
      return labels.card.topic(code);
    case "F3":
      return labels.card.network(code);
    case "F4":
      return bandLabelOf(labels.card, "reference.audience_band", code);
    case "F6":
      return labels.card.country(code);
    case "F8":
      return labels.card.language(code);
    case "F11":
      return labels.card.format(code);
    case "F17":
      return labels.text(`filters.badge.${code}`);
  }
}

/** The criteria applied, in the order of the form: one chip per value, the share of F6 apart (17 §4.4). */
export function criteriaOf(
  filters: CreatorSearchFilters,
  labels: SearchLabels,
): Criterion[] {
  const criteria: Criterion[] = [];
  for (const facet of FACET_ORDER) {
    if (facet === "F1" && filters.F1 !== undefined) {
      criteria.push({
        id: "F1",
        facet,
        value: null,
        label: criterionValueLabel(facet, filters.F1, labels),
      });
    } else if (facet === "F6" && filters.F6 !== undefined) {
      criteria.push({
        id: "F6",
        facet,
        value: null,
        label: labels.text("criteria.country", {
          country: labels.card.country(filters.F6.country),
        }),
      });
      for (const band of filters.F6.shareBands ?? []) {
        criteria.push({
          id: `F6s:${band}`,
          facet,
          value: band,
          label: labels.text("criteria.share", {
            share: bandLabelOf(labels.card, "preview.share", band),
          }),
        });
      }
    } else if (
      facet !== "F1" &&
      facet !== "F6" &&
      filters[facet] !== undefined
    ) {
      for (const code of filters[facet]) {
        criteria.push({
          id: `${facet}:${code}`,
          facet,
          value: code,
          label: criterionValueLabel(facet, code, labels),
        });
      }
    }
  }
  return criteria;
}

/** The query without one criterion: the chip removed. The last value of a list removes its facet. */
export function withoutCriterion(
  query: SearchQuery,
  criterion: Pick<Criterion, "facet" | "value">,
): SearchQuery {
  const filters: CreatorSearchFilters = { ...query.filters };
  const { facet, value } = criterion;
  if (facet === "F1" || value === null) {
    delete filters[facet];
  } else if (facet === "F6") {
    const shareBands = filters.F6?.shareBands?.filter((band) => band !== value);
    if (filters.F6 !== undefined) {
      filters.F6 =
        shareBands === undefined || shareBands.length === 0
          ? { country: filters.F6.country }
          : { country: filters.F6.country, shareBands };
    }
  } else {
    const rest = (filters[facet] ?? []).filter((code) => code !== value);
    if (rest.length === 0) {
      delete filters[facet];
    } else {
      (filters as Record<string, unknown>)[facet] = rest;
    }
  }
  return { ...query, filters };
}

/** Whether the query carries a criterion: what « Tout effacer » and the count of the button read. */
export function criteriaCountOf(filters: CreatorSearchFilters): number {
  let count = 0;
  for (const facet of FACET_ORDER) {
    if (facet === "F1") {
      count += filters.F1 === undefined ? 0 : 1;
    } else if (facet === "F6") {
      count +=
        filters.F6 === undefined ? 0 : 1 + (filters.F6.shareBands?.length ?? 0);
    } else {
      count += filters[facet]?.length ?? 0;
    }
  }
  return count;
}

// --- the draft of the form -----------------------------------------------------------------------------

/** The facets that hold a list of codes, and the share bands of F6 (the one list inside another facet). */
export type ListFacet = "F3" | "F4" | "F8" | "F11" | "F17" | "F6s";

/** The criteria with `code` ticked or unticked in a list of one facet; a list over 20 values is refused (RG17). */
export function toggledFilters(
  filters: CreatorSearchFilters,
  facet: ListFacet,
  code: string,
): CreatorSearchFilters {
  const next: CreatorSearchFilters = { ...filters };
  const tick = (list: readonly string[] | undefined): string[] => {
    const held = list ?? [];
    if (held.includes(code)) {
      return held.filter((value) => value !== code);
    }
    return held.length >= LIST_MAX ? [...held] : [...held, code];
  };
  if (facet === "F6s") {
    if (filters.F6 === undefined) {
      return next;
    }
    const bands = tick(filters.F6.shareBands) as NonNullable<
      CreatorSearchFilters["F6"]
    >["shareBands"];
    next.F6 =
      bands === undefined || bands.length === 0
        ? { country: filters.F6.country }
        : { country: filters.F6.country, shareBands: bands };
    return next;
  }
  const list = tick(filters[facet]);
  if (list.length === 0) {
    delete next[facet];
  } else {
    (next as Record<string, unknown>)[facet] = list;
  }
  return next;
}

/** The criteria with the topic of F1 set, or removed (`null`). */
export function withTopic(
  filters: CreatorSearchFilters,
  topic: string | null,
): CreatorSearchFilters {
  const next: CreatorSearchFilters = { ...filters };
  if (topic === null || !CODE_PATTERN.test(topic)) {
    delete next.F1;
  } else {
    next.F1 = topic;
  }
  return next;
}

/** The criteria with the country of F6 set (its share bands kept), or removed with them (`null`). */
export function withCountry(
  filters: CreatorSearchFilters,
  country: string | null,
): CreatorSearchFilters {
  const next: CreatorSearchFilters = { ...filters };
  const parsed =
    country === null
      ? null
      : creatorSearchFiltersSchema.shape.F6.safeParse({ country });
  if (parsed === null || !parsed.success || parsed.data === undefined) {
    delete next.F6;
    return next;
  }
  const bands = filters.F6?.shareBands;
  next.F6 =
    bands === undefined
      ? { country: parsed.data.country }
      : { country: parsed.data.country, shareBands: bands };
  return next;
}

// --- below the threshold: the widenings -------------------------------------------------------------

/** A widening proposed below the threshold: the facet and what is done to it. */
export type Widening = {
  facet: CreatorSearchFacetCode;
  /** `loosen`: the share of F6 is dropped, its country kept; `remove`: the whole facet. */
  mode: "remove" | "loosen";
};

/**
 * RG60, CA37: the widenings of a search below k, the facets the query holds taken from `WIDENING_ORDER` (a static
 * list of the contract). Nothing is asked, nothing counted: the same query, the same list, whether 0 or 4 profiles
 * answered.
 */
export function wideningsOf(filters: CreatorSearchFilters): Widening[] {
  return WIDENING_ORDER.filter((facet) => filters[facet] !== undefined).map(
    (facet) => ({
      facet,
      mode:
        facet === "F6" && (filters.F6?.shareBands?.length ?? 0) > 0
          ? "loosen"
          : "remove",
    }),
  );
}

/** The query a widening leads to. */
export function widenedQuery(
  query: SearchQuery,
  widening: Widening,
): SearchQuery {
  const filters: CreatorSearchFilters = { ...query.filters };
  if (widening.mode === "loosen" && filters.F6 !== undefined) {
    filters.F6 = { country: filters.F6.country };
  } else {
    delete filters[widening.facet];
  }
  return { ...query, filters };
}

// --- the state of the screen ------------------------------------------------------------------------

/** Why a page is not shown: what a screen says, from the code and the issue of the refusal. */
export type SearchFailure =
  "rate_limited" | "page_cap" | "forbidden" | "unavailable";

/** What the relay says of a refusal (`RelayResult` `failed`), reduced to what is read here. */
export type SearchRefusal = {
  code?: string;
  issues?: readonly string[];
  retryAfterSeconds?: number;
};

/** The issue the API names on `page` beyond its cap (RG63, CA42). */
const PAGE_CAP_ISSUE = "page_cap";

/**
 * The refusal of the API as the screen tells it: 429 the bucket of the account is full (RG64), 400 on `page` beyond
 * the cap (CA42), 404 a campaign that is not the brand's (it is never offered, so a stale address), anything else
 * « unavailable ». Never a technical word.
 */
export function searchFailureOf(refusal: SearchRefusal): SearchFailure {
  if (refusal.code === "rate_limited") {
    return "rate_limited";
  }
  if (
    refusal.code === "validation_failed" &&
    refusal.issues?.includes(PAGE_CAP_ISSUE) === true
  ) {
    return "page_cap";
  }
  if (refusal.code === "not_found") {
    return "forbidden";
  }
  return "unavailable";
}

/** One page of results as the API served it. */
export type ResultsPage = Extract<CreatorSearchResponse, { state: "results" }>;

/** The pages answered for ONE query, by rank, and what is being asked or was refused (the memory of a screen). */
export type SearchState = {
  queryKey: string;
  pages: Readonly<Record<number, CreatorSearchResponse>>;
  asking: number | null;
  refusal: {
    page: number;
    failure: SearchFailure;
    retryAfterSeconds: number | null;
  } | null;
};

export type SearchAction =
  | { type: "ask"; queryKey: string; page: number }
  | {
      type: "answer";
      queryKey: string;
      page: number;
      response: CreatorSearchResponse;
    }
  | {
      type: "refused";
      queryKey: string;
      page: number;
      refusal: SearchRefusal;
    }
  | { type: "retry"; page: number };

export function initialSearchState(queryKey = ""): SearchState {
  return { queryKey, pages: {}, asking: null, refusal: null };
}

/**
 * The state after an event. A query that changes forgets the pages of the one before; an answer for another query
 * or another page than the one asked is a late answer and changes nothing. A page answered stays: going back to it
 * never asks again (every page is one search of the bucket, RG64).
 */
export function searchReducer(
  state: SearchState,
  action: SearchAction,
): SearchState {
  switch (action.type) {
    case "ask": {
      const fresh =
        state.queryKey === action.queryKey
          ? state
          : initialSearchState(action.queryKey);
      return { ...fresh, asking: action.page, refusal: null };
    }
    case "answer":
      if (state.queryKey !== action.queryKey || state.asking !== action.page) {
        return state;
      }
      return {
        ...state,
        pages: { ...state.pages, [action.page]: action.response },
        asking: null,
        refusal: null,
      };
    case "refused":
      if (state.queryKey !== action.queryKey || state.asking !== action.page) {
        return state;
      }
      return {
        ...state,
        asking: null,
        refusal: {
          page: action.page,
          failure: searchFailureOf(action.refusal),
          retryAfterSeconds: action.refusal.retryAfterSeconds ?? null,
        },
      };
    case "retry":
      return state.refusal?.page === action.page
        ? { ...state, refusal: null }
        : state;
  }
}

/** Whether the screen must ask for a page: not answered, not being asked, not refused (a retry clears that). */
export function needsAsking(
  state: SearchState,
  queryKey: string,
  page: number,
): boolean {
  if (state.queryKey !== queryKey) {
    return true;
  }
  return (
    state.pages[page] === undefined &&
    state.asking !== page &&
    state.refusal?.page !== page
  );
}

/** The results a page shows, with the way to the pages around it (explicit, never infinite: RG63). */
export type ResultsScreen = {
  kind: "results";
  page: number;
  countBand: ResultCountBand;
  /** Said when the cap hides cards (CA41): never a silent end. */
  capReached: boolean;
  cards: readonly CreatorSearchCard[];
  previousPage: number | null;
  nextPage: number | null;
};

/** What the screen is, and nothing more: the states of 17 §4.4 (three specific ones, then the others). */
export type SearchScreen =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "brand_not_published" }
  | { kind: "too_narrow" }
  | ResultsScreen
  | {
      kind: "rate_limited";
      retryAfterSeconds: number | null;
      kept: ResultsScreen | null;
    }
  | { kind: "page_cap"; kept: ResultsScreen | null }
  | { kind: "forbidden" }
  | { kind: "failed"; kept: ResultsScreen | null };

function resultsScreenOf(response: ResultsPage): ResultsScreen {
  return {
    kind: "results",
    page: response.page,
    countBand: response.countBand,
    capReached: response.capReached,
    cards: response.cards,
    previousPage: response.page > 1 ? response.page - 1 : null,
    nextPage: response.nextPage,
  };
}

/** The results of the nearest page answered before `page`, else after it: they stay readable under a refusal (17 §4.4). */
function keptOf(state: SearchState, page: number): ResultsScreen | null {
  const answered = Object.entries(state.pages)
    .flatMap(([rank, response]) =>
      response.state === "results" ? [{ rank: Number(rank), response }] : [],
    )
    .sort((a, b) => a.rank - b.rank);
  const before = answered.filter(({ rank }) => rank < page).at(-1);
  const found = before ?? answered.find(({ rank }) => rank > page);
  return found === undefined ? null : resultsScreenOf(found.response);
}

/** The screen of a page of a query: the answer when there is one, else the refusal, else the loading. */
export function screenOf(
  state: SearchState,
  queryKey: string,
  page: number,
): SearchScreen {
  if (state.queryKey !== queryKey) {
    return { kind: "loading" };
  }
  const response = state.pages[page];
  if (response !== undefined) {
    return response.state === "results"
      ? resultsScreenOf(response)
      : { kind: response.state };
  }
  const { refusal } = state;
  if (refusal !== null && refusal.page === page) {
    const kept = keptOf(state, page);
    switch (refusal.failure) {
      case "rate_limited":
        return {
          kind: "rate_limited",
          retryAfterSeconds: refusal.retryAfterSeconds,
          kept,
        };
      case "page_cap":
        return { kind: "page_cap", kept };
      case "forbidden":
        return { kind: "forbidden" };
      default:
        return { kind: "failed", kept };
    }
  }
  return { kind: "loading" };
}

/** The wait the API asked for (`Retry-After`), in the unit a sentence says it: minutes under an hour, else hours. */
export function waitOf(seconds: number | null): {
  unit: "minutes" | "hours";
  count: number;
} | null {
  if (seconds === null || seconds <= 0) {
    return null;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60
    ? { unit: "minutes", count: Math.max(minutes, 1) }
    : { unit: "hours", count: Math.ceil(minutes / 60) };
}

// --- the cards --------------------------------------------------------------------------------------

/**
 * The visuals a card shows: the first approved one in the creator's order on a card (17 §7.1), `shown` of them on a
 * profile (three); none without.
 */
export function cardVisualsOf(
  card: Pick<CreatorSearchCard, "creator">,
  shown: number = CARD_VISUALS_SHOWN,
): {
  alias: string;
  visualId: string;
}[] {
  return [...card.creator.visuals]
    .sort((a, b) => a.order - b.order)
    .slice(0, shown)
    .map((visual) => ({ alias: card.creator.alias, visualId: visual.id }));
}

/** The key of a visual in the memory of the screen: the alias and its identifier, both opaque. */
export function visualKeyOf(alias: string, visualId: string): string {
  return `${alias}/${visualId}`;
}

/**
 * « Proposé car » (RG41): one sentence per reason, from its code and its parameters (codes and bands, never a
 * number). A code the words do not know shows as itself, never an invented sentence.
 */
export function reasonTextOf(
  reason: CreatorSearchReason,
  labels: SearchLabels,
): string {
  const { card } = labels;
  const params: Record<string, string> = { ...reason.params };
  const shareOf = (band: string | undefined) =>
    bandLabelOf(card, "preview.share", band ?? "");
  const key = `reason.${reason.code}`;
  switch (reason.code) {
    case "topic_match":
    case "primary_topic":
      return labels.text(key, { topic: card.topic(params.topic ?? "") });
    case "network_match":
      return labels.text(key, {
        network: card.network(params.network ?? ""),
        band: bandLabelOf(
          card,
          "reference.audience_band",
          params.audienceBand ?? "",
        ),
      });
    case "audience_country_match":
    case "campaign_audience_country":
    case "main_audience":
      return labels.text(key, {
        country: card.country(params.country ?? ""),
        share: shareOf(params.shareBand),
      });
    case "language_match":
      return labels.text(key, {
        language: card.language(params.language ?? ""),
      });
    case "format_match":
      return labels.text(key, { format: card.format(params.format ?? "") });
    case "campaign_format":
      return labels.text(key, {
        network: card.network(params.network ?? ""),
        format: card.format(params.format ?? ""),
      });
    case "audience_verified":
    case "account_verified":
    case "figures_fresh":
      return labels.text(key, { network: card.network(params.network ?? "") });
    case "available":
      return labels.text(key, {
        availability: bandLabelOf(
          card,
          "offer.availability",
          params.availability ?? "",
        ),
      });
  }
}

/** The sentences of « Proposé car », in the order of the API (the order of the tiers, RG41). */
export function reasonTextsOf(
  card: CreatorSearchCard,
  labels: SearchLabels,
): string[] {
  return card.reasons.map((reason) => reasonTextOf(reason, labels));
}

/** The note of vigilance, said when it is true even if it serves the profile badly (17 §7.1 rule 8, RG42). */
export function vigilanceTextOf(
  card: CreatorSearchCard,
  labels: SearchLabels,
): string | null {
  return card.vigilance === null
    ? null
    : labels.text(`vigilance.${card.vigilance}`);
}
