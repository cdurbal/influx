// M4, the brand's anonymous creator search (docs/mvp/10 RG6, RG17, RG41, RG42, RG44, RG57 to RG60, RG63, RG64; 17
// §4.4, §7.1; D48, D78; jalons/l3f, commit 10; L3F-T10): the address in, the query out; the widenings below the
// threshold (the same for 0 and for 4, from the static list of the contract); the state of the screen from the
// answers of the API; the reasons « Proposé car » in codes and bands, and nothing else on a card. Pure functions,
// no browser.
import {
  CREATOR_SEARCH_PAGE_MAX,
  WIDENING_ORDER,
  creatorSearchBodySchema,
  creatorSearchCardSchema,
  creatorSearchReasonSchema,
  type CreatorSearchCard,
  type CreatorSearchFilters,
  type CreatorSearchResponse,
  CREATOR_SEARCH_REASON_PARAM_KEYS,
  CREATOR_SEARCH_VIGILANCE_CODES,
} from "@influx/contracts/creator-search";
import { describe, expect, it } from "vitest";
import {
  cardOfProjection,
  previewCardOf,
  type PreviewLabels,
} from "@/components/creator-profile/creator-preview-view";
import {
  addressOf,
  addressOfParams,
  addressParamsOf,
  bodyOf,
  cardVisualsOf,
  criteriaCountOf,
  criteriaOf,
  EMPTY_QUERY,
  initialSearchState,
  needsAsking,
  queryKeyOf,
  reasonTextOf,
  reasonTextsOf,
  screenOf,
  searchFailureOf,
  searchReducer,
  toggledFilters,
  vigilanceTextOf,
  waitOf,
  widenedQuery,
  wideningsOf,
  withCountry,
  withoutCriterion,
  withTopic,
  type SearchLabels,
  type SearchQuery,
  type SearchState,
} from "@/components/creator-search/creator-search-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import enCreatorSearch from "@/locales/en/creator-search.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";
import frCreatorSearch from "@/locales/fr/creator-search.json";

type Json = { [key: string]: Json | string };

/** The texts of a locale file as `t()` reads them: a missing key is a failure of the test, never a blank. */
function reader(messages: Json): (key: string) => string | null {
  return (key) => {
    let node: Json | string = messages;
    for (const part of key.split(".")) {
      if (typeof node === "string" || !(part in node)) {
        return null;
      }
      node = node[part] as Json | string;
    }
    return typeof node === "string" ? node : null;
  };
}

function labelsOf(profile: Json, search: Json): SearchLabels {
  const readProfile = reader(profile);
  const readSearch = reader(search);
  const fill = (found: string, values?: Record<string, string | number>) =>
    found.replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values?.[name] ?? `{${name}}`),
    );
  const card: PreviewLabels = {
    text: (key, values) => {
      const found = readProfile(key);
      if (found === null) {
        throw new Error(`missing card text: ${key}`);
      }
      return fill(found, values);
    },
    has: (key) => readProfile(key) !== null,
    topic: (code) => `topic:${code}`,
    network: (code) => `network:${code}`,
    format: (code) => `format:${code}`,
    usageRight: (code) => `right:${code}`,
    exclusivity: (code) => `exclusivity:${code}`,
    country: (code) => `country:${code}`,
    language: (code) => `language:${code}`,
    date: (iso) => `date:${iso.slice(0, 10)}`,
    count: (value) => `n${value}`,
  };
  return {
    card,
    text: (key, values) => {
      const found = readSearch(key);
      if (found === null) {
        throw new Error(`missing search text: ${key}`);
      }
      return fill(found, values);
    },
  };
}

const FR = labelsOf(
  frCreatorProfile as unknown as Json,
  frCreatorSearch as unknown as Json,
);
const EN = labelsOf(
  enCreatorProfile as unknown as Json,
  enCreatorSearch as unknown as Json,
);

const UUID = "5c1f0a3e-8a47-4c0b-8b53-0e2b9a1d7f10";
const ID = (digit: string) =>
  `${digit.repeat(8)}-aaaa-4aaa-8aaa-${digit.repeat(12)}`;

const CARD: CreatorSearchCard = creatorSearchCardSchema.parse({
  creator: {
    alias: "7K3M",
    headline: "Créatrice de tutoriels cuisine végétale",
    bio: null,
    primaryTopic: "food",
    secondaryTopics: [],
    tones: [],
    publicationLanguages: ["fr"],
    residenceCountry: "FR",
    travelScope: null,
    collaborationExperience: null,
    mainAudienceCountry: "FR",
    mainAudienceShareBand: "ge_80",
    audienceGenderBand: null,
    audienceBands: [],
    formats: ["instagram_reel"],
    usageRights: [],
    deliveryLead: null,
    maxExclusivity: null,
    acceptsNonMonetary: false,
    availability: "lt_1m",
    networks: [],
    visuals: [3, 1, 2].map((order) => ({
      id: ID(String(order)),
      order,
      caption: null,
    })),
  },
  reasons: [
    { code: "primary_topic", params: { topic: "food" } },
    {
      code: "main_audience",
      params: { country: "FR", shareBand: "ge_80" },
    },
  ],
  vigilance: "recent_profile",
});

function resultsOf(
  page: number,
  nextPage: number | null,
): CreatorSearchResponse {
  return {
    state: "results",
    countBand: "10_24",
    page,
    nextPage,
    capReached: false,
    cards: [CARD],
  };
}

const QUERY: SearchQuery = {
  filters: {
    F1: "beauty",
    F3: ["instagram", "tiktok"],
    F4: ["micro"],
    F6: { country: "FR", shareBands: ["ge_80", "50_80"] },
    F8: ["fr"],
    F11: ["instagram_reel"],
    F17: ["account_verified"],
  },
  sort: "audience",
  campaignId: UUID,
};

describe("L3F-T10: the address of M4 (RG6, RG11, RG17)", () => {
  it("writes the query canonically and reads it back, every facet, the sort, the campaign and the page", () => {
    const written = addressParamsOf(QUERY, 3);
    expect(written).toBe(
      `?F1=beauty&F3=instagram,tiktok&F4=micro&F6=FR&F6s=ge_80,50_80&F8=fr&F11=instagram_reel&F17=account_verified&sort=audience&campaign=${UUID}&page=3`,
    );
    const params = new URLSearchParams(written);
    expect(addressOf((name) => params.get(name) ?? undefined)).toEqual({
      query: QUERY,
      page: 3,
    });
    expect(addressParamsOf(EMPTY_QUERY)).toBe("");
    expect(queryKeyOf(QUERY)).toBe(addressParamsOf(QUERY));
  });

  it("ignores an unreadable value, never fails: an unknown code, a country that is none, a share without a country", () => {
    const read = (values: Record<string, string>) =>
      addressOf((name) => values[name]);
    expect(
      read({
        F1: "not a code",
        F3: "instagram,bad code,tiktok,instagram",
        F4: "!!",
        F6: "ZZZ",
        F6s: "ge_80",
        F17: "account_verified,made_up",
        sort: "by_price",
        campaign: "not-a-uuid",
        page: "0",
      }),
    ).toEqual({
      query: {
        filters: {
          F3: ["instagram", "tiktok"],
          F17: ["account_verified"],
        },
        sort: "default",
        campaignId: null,
      },
      page: 1,
    });
    expect(
      read({ F6s: "ge_80,lt_50,bogus", F6: "FR" }).query.filters.F6,
    ).toEqual({ country: "FR", shareBands: ["ge_80", "lt_50"] });
    for (const page of [
      "-1",
      "abc",
      "1.5",
      String(CREATOR_SEARCH_PAGE_MAX + 1),
    ]) {
      expect(read({ page }).page, page).toBe(1);
    }
    expect(read({ page: String(CREATOR_SEARCH_PAGE_MAX) }).page).toBe(
      CREATOR_SEARCH_PAGE_MAX,
    );
  });

  it("reads the searchParams of a page: the first of a repeated name, a missing one as none", () => {
    expect(
      addressOfParams({
        F1: ["food", "beauty"],
        sort: "new_profiles",
        F3: undefined,
      }),
    ).toEqual({
      query: {
        filters: { F1: "food" },
        sort: "new_profiles",
        campaignId: null,
      },
      page: 1,
    });
  });

  it("builds the body of the call from the whole entry of the contract and nothing else: no size of page, no tariff", () => {
    const body = bodyOf(QUERY, 2);
    expect(Object.keys(body).sort()).toEqual(
      ["campaignId", "filters", "page", "sort"].sort(),
    );
    expect(creatorSearchBodySchema.safeParse(body).success).toBe(true);
    expect(Object.keys(bodyOf(EMPTY_QUERY, 1)).sort()).toEqual([
      "filters",
      "page",
      "sort",
    ]);
  });
});

describe("L3F-T10: the criteria, the chips and the draft of the form (17 §4.4)", () => {
  it("lists one chip per value in the order of the form, the share of F6 apart, a code with no label as itself", () => {
    const chips = criteriaOf(QUERY.filters, FR);
    expect(chips.map((chip) => chip.id)).toEqual([
      "F1",
      "F3:instagram",
      "F3:tiktok",
      "F4:micro",
      "F6",
      "F6s:ge_80",
      "F6s:50_80",
      "F8:fr",
      "F11:instagram_reel",
      "F17:account_verified",
    ]);
    expect(chips.find((chip) => chip.id === "F1")?.label).toBe("topic:beauty");
    expect(chips.find((chip) => chip.id === "F6")?.label).toBe(
      "Pays d'audience : country:FR",
    );
    expect(chips.find((chip) => chip.id === "F6s:ge_80")?.label).toBe(
      "Part de l'audience : 80 % ou plus",
    );
    expect(criteriaOf({ F4: ["unlisted_band"] }, FR)[0]?.label).toBe(
      "unlisted_band",
    );
    expect(criteriaCountOf(QUERY.filters)).toBe(chips.length);
    expect(criteriaCountOf({})).toBe(0);
  });

  it("removes a chip: a value of a list, the last value takes its facet away, the country takes its shares", () => {
    const filters = (query: SearchQuery) => query.filters;
    expect(
      filters(withoutCriterion(QUERY, { facet: "F3", value: "tiktok" })).F3,
    ).toEqual(["instagram"]);
    expect(
      filters(withoutCriterion(QUERY, { facet: "F4", value: "micro" })).F4,
    ).toBeUndefined();
    expect(
      filters(withoutCriterion(QUERY, { facet: "F6", value: "ge_80" })).F6,
    ).toEqual({ country: "FR", shareBands: ["50_80"] });
    expect(
      filters(withoutCriterion(QUERY, { facet: "F6", value: null })).F6,
    ).toBeUndefined();
    expect(
      filters(withoutCriterion(QUERY, { facet: "F1", value: null })).F1,
    ).toBeUndefined();
    // the sort and the campaign are untouched by a chip
    const removed = withoutCriterion(QUERY, { facet: "F1", value: null });
    expect([removed.sort, removed.campaignId]).toEqual(["audience", UUID]);
  });

  it("ticks and unticks in the draft, caps a list at 20, sets the topic and the country (shares kept, then dropped with it)", () => {
    let draft: CreatorSearchFilters = {};
    draft = toggledFilters(draft, "F3", "instagram");
    draft = toggledFilters(draft, "F3", "tiktok");
    expect(draft.F3).toEqual(["instagram", "tiktok"]);
    draft = toggledFilters(draft, "F3", "instagram");
    expect(draft.F3).toEqual(["tiktok"]);
    draft = toggledFilters(draft, "F3", "tiktok");
    expect(draft.F3).toBeUndefined();

    let long: CreatorSearchFilters = {};
    for (let index = 0; index < 25; index += 1) {
      long = toggledFilters(long, "F11", `format_${index}`);
    }
    expect(long.F11).toHaveLength(20);

    // a share is ticked inside a country only
    expect(toggledFilters({}, "F6s", "ge_80")).toEqual({});
    draft = withCountry({}, "FR");
    draft = toggledFilters(draft, "F6s", "ge_80");
    expect(draft.F6).toEqual({ country: "FR", shareBands: ["ge_80"] });
    expect(withCountry(draft, "BE").F6).toEqual({
      country: "BE",
      shareBands: ["ge_80"],
    });
    expect(withCountry(draft, null).F6).toBeUndefined();
    expect(withCountry(draft, "not a country").F6).toBeUndefined();
    expect(withTopic({}, "food").F1).toBe("food");
    expect(withTopic({ F1: "food" }, null).F1).toBeUndefined();
  });
});

describe("L3F-T10: below the threshold, the widenings of WIDENING_ORDER (RG58, RG60, CA35, CA37)", () => {
  it("proposes the facets the query holds in the order of the contract, whatever the order of the criteria", () => {
    expect(
      wideningsOf(QUERY.filters).map((widening) => widening.facet),
    ).toEqual([...WIDENING_ORDER]);
    expect(
      wideningsOf({ F1: "food", F17: ["audience_verified"] }).map(
        (widening) => widening.facet,
      ),
    ).toEqual(["F17", "F1"]);
    expect(wideningsOf({})).toEqual([]);
  });

  it("loosens the share of F6 before removing its country, and removes any other facet whole", () => {
    expect(wideningsOf(QUERY.filters).find((w) => w.facet === "F6")?.mode).toBe(
      "loosen",
    );
    expect(wideningsOf({ F6: { country: "FR" } })[0]?.mode).toBe("remove");
    const loosen = widenedQuery(QUERY, { facet: "F6", mode: "loosen" });
    expect(loosen.filters.F6).toEqual({ country: "FR" });
    const remove = widenedQuery(QUERY, { facet: "F4", mode: "remove" });
    expect(remove.filters.F4).toBeUndefined();
    expect([remove.sort, remove.campaignId]).toEqual(["audience", UUID]);
  });

  it("gives the same screen for 0 and for 4 results: the answer holds no count, so the state is one", () => {
    const state = searchReducer(initialSearchState("k"), {
      type: "ask",
      queryKey: "k",
      page: 1,
    });
    const answered = searchReducer(state, {
      type: "answer",
      queryKey: "k",
      page: 1,
      response: { state: "too_narrow" },
    });
    expect(screenOf(answered, "k", 1)).toEqual({ kind: "too_narrow" });
  });
});

describe("L3F-T10: the state of the screen (17 §4.4, RG63, RG64)", () => {
  const ask = (state: SearchState, key: string, page: number) =>
    searchReducer(state, { type: "ask", queryKey: key, page });

  it("starts loading, shows the closed, unpublished and results states, a page at a time with the pages around it", () => {
    let state = initialSearchState("k");
    expect(screenOf(state, "k", 1)).toEqual({ kind: "loading" });
    state = ask(state, "k", 1);
    state = searchReducer(state, {
      type: "answer",
      queryKey: "k",
      page: 1,
      response: resultsOf(1, 2),
    });
    const first = screenOf(state, "k", 1);
    expect(first).toMatchObject({
      kind: "results",
      page: 1,
      countBand: "10_24",
      previousPage: null,
      nextPage: 2,
      capReached: false,
    });
    state = ask(state, "k", 2);
    state = searchReducer(state, {
      type: "answer",
      queryKey: "k",
      page: 2,
      response: resultsOf(2, null),
    });
    expect(screenOf(state, "k", 2)).toMatchObject({
      previousPage: 1,
      nextPage: null,
    });
    // going back to a page answered asks nothing: a page is one search of the bucket
    expect(needsAsking(state, "k", 1)).toBe(false);
    expect(needsAsking(state, "k", 3)).toBe(true);
    for (const terminal of ["closed", "brand_not_published"] as const) {
      const other = searchReducer(ask(initialSearchState("t"), "t", 1), {
        type: "answer",
        queryKey: "t",
        page: 1,
        response: { state: terminal },
      });
      expect(screenOf(other, "t", 1)).toEqual({ kind: terminal });
    }
  });

  it("forgets the pages of the query before when the query changes, and ignores a late answer for another query or page", () => {
    let state = ask(initialSearchState("a"), "a", 1);
    state = ask(state, "b", 1);
    expect(state.queryKey).toBe("b");
    expect(state.pages).toEqual({});
    const late = searchReducer(state, {
      type: "answer",
      queryKey: "a",
      page: 1,
      response: resultsOf(1, null),
    });
    expect(late).toBe(state);
    const wrongPage = searchReducer(state, {
      type: "answer",
      queryKey: "b",
      page: 2,
      response: resultsOf(2, null),
    });
    expect(wrongPage).toBe(state);
    expect(screenOf(state, "a", 1)).toEqual({ kind: "loading" });
  });

  it("keeps the results shown readable when the bucket is full or a page fails, and asks again only on retry", () => {
    let state = ask(initialSearchState("k"), "k", 1);
    state = searchReducer(state, {
      type: "answer",
      queryKey: "k",
      page: 1,
      response: resultsOf(1, 2),
    });
    state = ask(state, "k", 2);
    state = searchReducer(state, {
      type: "refused",
      queryKey: "k",
      page: 2,
      refusal: { code: "rate_limited", retryAfterSeconds: 5400 },
    });
    const screen = screenOf(state, "k", 2);
    expect(screen).toMatchObject({
      kind: "rate_limited",
      retryAfterSeconds: 5400,
    });
    expect(screen.kind === "rate_limited" ? screen.kept?.page : null).toBe(1);
    // a refused page is not asked again at every render
    expect(needsAsking(state, "k", 2)).toBe(false);
    state = searchReducer(state, { type: "retry", page: 2 });
    expect(needsAsking(state, "k", 2)).toBe(true);
    // a refusal with no results before it keeps nothing
    const alone = searchReducer(ask(initialSearchState("z"), "z", 1), {
      type: "refused",
      queryKey: "z",
      page: 1,
      refusal: { code: "internal" },
    });
    expect(screenOf(alone, "z", 1)).toEqual({ kind: "failed", kept: null });
  });

  it("tells a refusal as the screen says it: the bucket, the cap of pages, an unusable campaign, anything else; the wait in the unit of a sentence", () => {
    expect(searchFailureOf({ code: "rate_limited" })).toBe("rate_limited");
    expect(
      searchFailureOf({ code: "validation_failed", issues: ["page_cap"] }),
    ).toBe("page_cap");
    expect(
      searchFailureOf({
        code: "validation_failed",
        issues: ["invalid_filters"],
      }),
    ).toBe("unavailable");
    expect(searchFailureOf({ code: "not_found" })).toBe("forbidden");
    expect(searchFailureOf({})).toBe("unavailable");
    expect(waitOf(null)).toBeNull();
    expect(waitOf(0)).toBeNull();
    expect(waitOf(20)).toEqual({ unit: "minutes", count: 1 });
    expect(waitOf(125)).toEqual({ unit: "minutes", count: 3 });
    expect(waitOf(3600)).toEqual({ unit: "hours", count: 1 });
    expect(waitOf(5400)).toEqual({ unit: "hours", count: 2 });
  });
});

describe("L3F-T10: the card and « Proposé car » (RG41, RG42; 17 §7.1)", () => {
  it("writes every reason of the contract in French and in English, from codes and bands, with no placeholder left", () => {
    const params: Record<string, string> = {
      topic: "food",
      network: "instagram",
      audienceBand: "micro",
      country: "FR",
      shareBand: "50_80",
      language: "fr",
      format: "instagram_reel",
      availability: "lt_2w",
    };
    for (const code of Object.keys(
      CREATOR_SEARCH_REASON_PARAM_KEYS,
    ) as (keyof typeof CREATOR_SEARCH_REASON_PARAM_KEYS)[]) {
      const reason = creatorSearchReasonSchema.parse({
        code,
        params: Object.fromEntries(
          CREATOR_SEARCH_REASON_PARAM_KEYS[code].map((key) => [
            key,
            params[key],
          ]),
        ),
      });
      for (const labels of [FR, EN]) {
        const text = reasonTextOf(reason, labels);
        expect(text, code).not.toMatch(/\{\w+\}/);
      }
    }
    expect(reasonTextsOf(CARD, FR)).toEqual([
      "Thématique principale : topic:food",
      "Pays principal de l'audience, country:FR : 80 % ou plus",
    ]);
  });

  it("says a vigilance when the card has one, in both languages for every code, and nothing otherwise", () => {
    expect(vigilanceTextOf(CARD, FR)).toBe("Profil récent.");
    expect(vigilanceTextOf({ ...CARD, vigilance: null }, FR)).toBeNull();
    for (const code of CREATOR_SEARCH_VIGILANCE_CODES) {
      for (const labels of [FR, EN]) {
        expect(
          vigilanceTextOf({ ...CARD, vigilance: code }, labels),
          code,
        ).toBeTruthy();
      }
    }
  });

  it("draws the card of the preview: one source, the same rows, the first visual only on a card of the grid", () => {
    const grid = cardOfProjection(CARD.creator, FR.card, 1);
    expect(grid.visuals.map((visual) => visual.position)).toEqual([3]);
    const profile = cardOfProjection(CARD.creator, FR.card);
    expect(profile.visuals).toHaveLength(3);
    const preview = previewCardOf(
      {
        published: true,
        before: CARD.creator,
        after: { ...CARD.creator, audienceShares: [] } as never,
      },
      "before",
      FR.card,
    );
    expect(preview).toEqual(profile);
    expect(grid.shares).toEqual([]);
    // the visual a card asks for is the first of the creator's order, by alias and opaque identifier
    expect(cardVisualsOf(CARD)).toEqual([{ alias: "7K3M", visualId: ID("1") }]);
    expect(
      cardVisualsOf({ ...CARD, creator: { ...CARD.creator, visuals: [] } }),
    ).toEqual([]);
  });

  it("has every text of M4 in both languages, with the same keys and no amount, tariff or net", () => {
    const keys = (node: Json | string, prefix = ""): string[] =>
      typeof node === "string"
        ? [prefix]
        : Object.entries(node).flatMap(([key, value]) =>
            keys(value, prefix === "" ? key : `${prefix}.${key}`),
          );
    expect(keys(enCreatorSearch as unknown as Json).sort()).toEqual(
      keys(frCreatorSearch as unknown as Json).sort(),
    );
    const leaves = (node: Json | string): string[] =>
      typeof node === "string" ? [node] : Object.values(node).flatMap(leaves);
    const all = [
      ...leaves(frCreatorSearch as unknown as Json),
      ...leaves(enCreatorSearch as unknown as Json),
    ]
      .join(" | ")
      .toLowerCase();
    for (const word of [
      /tarif/,
      /prix/,
      /montant/,
      /net créateur/,
      /\bprice/,
      /\brates?\b/,
      /budget/,
      /\d\s?(€|eur|usd)/,
    ]) {
      expect(word.test(all), String(word)).toBe(false);
    }
  });
});
