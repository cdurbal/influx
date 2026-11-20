// The profile a brand opens, its private lists and its request to the INFLUX team (docs/mvp/10 RG1, RG15, RG41, RG42,
// RG50, RG51, RG55, RG61, RG63, RG65; 17 §4.4, §4.9, §7.1; D38, D45, D48, D78; jalons/l3f, commit 11; L3F-T11): the
// refusals as the screens tell them, what is typed before it leaves, the memory of the panel and of one list, the
// screen of a profile and its card (the same source as the grid), the addresses of the pages, the `list` of the
// address of M4. Pure functions, no browser.
import {
  creatorSearchCardSchema,
  type CreatorSearchCard,
} from "@influx/contracts/creator-search";
import {
  creatorSearchProfileResponseSchema,
  type CreatorSearchProfileResponse,
} from "@influx/contracts/creator-search-profile";
import {
  SELECTION_MESSAGE_ISSUE,
  selectionRequestBodySchema,
} from "@influx/contracts/selection-requests";
import {
  SHORTLIST_FULL_ISSUE,
  SHORTLIST_LIMIT_ISSUE,
  SHORTLIST_NAME_ISSUE,
  SHORTLIST_NOTE_ISSUE,
  type ShortlistItem,
  type ShortlistSummary,
} from "@influx/contracts/shortlists";
import { describe, expect, it } from "vitest";
import {
  renderedFieldsOf,
  type PreviewLabels,
} from "@/components/creator-profile/creator-preview-view";
import {
  addressOf,
  addressParamsOf,
  EMPTY_QUERY,
  queryKeyOf,
  type SearchLabels,
  type SearchQuery,
} from "@/components/creator-search/creator-search-view";
import {
  activeListIdOf,
  deadlineTextOf,
  detailReducer,
  INITIAL_DETAIL,
  INITIAL_SELECTION,
  listOf,
  membersOf,
  messageOf,
  messageProblemOf,
  nameProblemOf,
  noteOf,
  noteProblemOf,
  profileHref,
  profileScreenOf,
  profileViewOf,
  PROFILE_VISUALS_SHOWN,
  requestBodyOf,
  requestHref,
  searchHref,
  selectionFailureOf,
  selectionReducer,
  SELECTION_MESSAGE_MAX,
  SHORTLIST_NAME_MAX,
  SHORTLIST_NOTE_MAX,
  shortlistHref,
  type DetailState,
  type OpenedProfile,
  type SearchPlace,
  type SelectionState,
} from "@/components/creator-search/shortlists-view";
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

const LIST_A = "0b6a4f0e-8f3c-4c7e-9d51-2f6e3a1c9b77";
const LIST_B = "9a1d2c3b-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const CAMPAIGN = "5c1f0a3e-8a47-4c0b-8b53-0e2b9a1d7f10";
const ID = (digit: string) =>
  `${digit.repeat(8)}-aaaa-4aaa-8aaa-${digit.repeat(12)}`;

function cardOf(alias: string, visuals = 3): CreatorSearchCard {
  return creatorSearchCardSchema.parse({
    creator: {
      alias,
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
      visuals: Array.from({ length: visuals }, (_, index) => ({
        id: ID(String(index + 1)),
        order: index + 1,
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
}

function list(id: string, name: string, count: number): ShortlistSummary {
  return {
    id,
    name,
    campaignId: null,
    count,
    createdAt: "2026-11-20T10:00:00.000Z",
  };
}

function profileOf(region: string | null): OpenedProfile {
  const card = cardOf("7K3M");
  const response: CreatorSearchProfileResponse =
    creatorSearchProfileResponseSchema.parse({
      state: "profile",
      creator: card.creator,
      residenceRegion: region,
      reasons: card.reasons,
      vigilance: card.vigilance,
    });
  if (response.state !== "profile") {
    throw new Error("a profile was built");
  }
  return response;
}

const READY = (
  lists: ShortlistSummary[],
  members: Record<string, string[]> = {},
): SelectionState => ({ phase: "ready", lists, members });

describe("L3F-T11: the refusals the screens tell (RG51, RG61, RG63, CA49)", () => {
  it("reads a refusal as a failure a screen words: not found, bounds, name, note, message, bucket", () => {
    expect(selectionFailureOf({ code: "not_found" })).toBe("not_found");
    expect(selectionFailureOf({ code: "rate_limited" })).toBe("rate_limited");
    expect(
      selectionFailureOf({
        code: "conflict",
        issues: [SHORTLIST_LIMIT_ISSUE],
      }),
    ).toBe("limit");
    expect(
      selectionFailureOf({ code: "conflict", issues: [SHORTLIST_FULL_ISSUE] }),
    ).toBe("full");
    expect(
      selectionFailureOf({
        code: "validation_failed",
        issues: [SHORTLIST_NAME_ISSUE],
      }),
    ).toBe("invalid_name");
    expect(
      selectionFailureOf({
        code: "validation_failed",
        issues: [SHORTLIST_NOTE_ISSUE],
      }),
    ).toBe("invalid_note");
    expect(
      selectionFailureOf({
        code: "validation_failed",
        issues: [SELECTION_MESSAGE_ISSUE],
      }),
    ).toBe("invalid_message");
    // anything else, a conflict or a validation without a known issue included, is « unavailable »
    for (const refusal of [
      {},
      { code: "internal_error" },
      { code: "conflict" },
      { code: "validation_failed", issues: ["something_else"] },
    ]) {
      expect(selectionFailureOf(refusal), JSON.stringify(refusal)).toBe(
        "unavailable",
      );
    }
  });
});

describe("L3F-T11: what is typed, checked before it leaves (RG51, RG61)", () => {
  it("holds a name to 1 to 80 characters once trimmed, a note to 500, a message to 1 000, counted in characters", () => {
    expect(nameProblemOf("   ")).toBe("empty");
    expect(nameProblemOf(" Rentrée ")).toBeNull();
    expect(nameProblemOf("é".repeat(SHORTLIST_NAME_MAX))).toBeNull();
    expect(nameProblemOf("é".repeat(SHORTLIST_NAME_MAX + 1))).toBe("too_long");
    // two code units, one character
    expect(nameProblemOf("😀".repeat(SHORTLIST_NAME_MAX))).toBeNull();
    expect(noteProblemOf("x".repeat(SHORTLIST_NOTE_MAX))).toBeNull();
    expect(noteProblemOf("x".repeat(SHORTLIST_NOTE_MAX + 1))).toBe("too_long");
    expect(messageProblemOf("x".repeat(SELECTION_MESSAGE_MAX))).toBeNull();
    expect(messageProblemOf("x".repeat(SELECTION_MESSAGE_MAX + 1))).toBe(
      "too_long",
    );
  });

  it("sends a blank note or message as none (a note is cleared, a message is optional) and a text trimmed", () => {
    expect(noteOf("   ")).toBeNull();
    expect(noteOf(" à revoir ")).toBe("à revoir");
    expect(messageOf("")).toBeNull();
    expect(messageOf("  Profils beauté, ton posé  ")).toBe(
      "Profils beauté, ton posé",
    );
  });

  it("builds the request from every criterion, the campaign and the message, and nothing else (no price, rate, budget)", () => {
    const body = requestBodyOf(
      { F1: "beauty", F3: ["instagram"] },
      CAMPAIGN,
      "",
    );
    expect(body).toEqual({
      filters: { F1: "beauty", F3: ["instagram"] },
      campaignId: CAMPAIGN,
      message: null,
    });
    expect(Object.keys(body).sort()).toEqual(
      ["campaignId", "filters", "message"].sort(),
    );
    // the contract takes it as it is: a closed entry
    expect(selectionRequestBodySchema.safeParse(body).success).toBe(true);
    expect(requestBodyOf({}, null, " besoin ")).toEqual({
      filters: {},
      campaignId: null,
      message: "besoin",
    });
  });

  it("tells the day the team answers by, in the reader's language, as a date and never as a promise", () => {
    const iso = "2026-11-24T08:30:00.000Z";
    expect(deadlineTextOf(iso, "fr", "UTC")).toBe("24 novembre 2026");
    expect(deadlineTextOf(iso, "en", "UTC")).toBe("November 24, 2026");
  });
});

describe("L3F-T11: the memory of the panel « Ma sélection » (RG51, RG63, D45)", () => {
  it("shows the lists as the API gives them, or the state that closes the door (D38, RG1)", () => {
    const lists = [list(LIST_B, "Beauté", 2), list(LIST_A, "Cuisine", 0)];
    expect(
      selectionReducer(INITIAL_SELECTION, {
        type: "loaded",
        response: { state: "shortlists", shortlists: lists },
      }),
    ).toEqual({ phase: "ready", lists, members: {} });
    expect(
      selectionReducer(INITIAL_SELECTION, {
        type: "loaded",
        response: { state: "closed" },
      }),
    ).toEqual({ phase: "closed" });
    expect(
      selectionReducer(INITIAL_SELECTION, {
        type: "loaded",
        response: { state: "brand_not_published" },
      }),
    ).toEqual({ phase: "brand_not_published" });
    expect(selectionReducer(READY(lists), { type: "failed" })).toEqual({
      phase: "failed",
    });
    expect(selectionReducer(READY(lists), { type: "loading" })).toEqual(
      INITIAL_SELECTION,
    );
  });

  it("adds one creator at a time to a list already read: counted once, never twice, never to an unknown list", () => {
    const state = READY([list(LIST_A, "Cuisine", 1)], { [LIST_A]: ["2QX8"] });
    const added = selectionReducer(state, {
      type: "added",
      listId: LIST_A,
      alias: "7K3M",
    });
    expect(added).toEqual(
      READY([list(LIST_A, "Cuisine", 2)], { [LIST_A]: ["2QX8", "7K3M"] }),
    );
    // idempotent, as the door is
    expect(
      selectionReducer(added, { type: "added", listId: LIST_A, alias: "7K3M" }),
    ).toBe(added);
    // a list not read, or not the brand's: nothing guessed
    expect(
      selectionReducer(state, { type: "added", listId: LIST_B, alias: "7K3M" }),
    ).toBe(state);
    const removed = selectionReducer(added, {
      type: "removed",
      listId: LIST_A,
      alias: "2QX8",
    });
    expect(removed).toEqual(
      READY([list(LIST_A, "Cuisine", 1)], { [LIST_A]: ["7K3M"] }),
    );
    expect(
      selectionReducer(removed, {
        type: "removed",
        listId: LIST_A,
        alias: "2QX8",
      }),
    ).toBe(removed);
  });

  it("puts a list made first (newest first), replaces a list changed, forgets a list deleted with its creators", () => {
    const start = READY([list(LIST_A, "Cuisine", 0)], { [LIST_A]: [] });
    const made = selectionReducer(start, {
      type: "upserted",
      list: list(LIST_B, "Beauté", 0),
    });
    expect(made.phase === "ready" && made.lists.map((item) => item.id)).toEqual(
      [LIST_B, LIST_A],
    );
    const renamed = selectionReducer(made, {
      type: "upserted",
      list: { ...list(LIST_A, "Cuisine d'été", 0), campaignId: CAMPAIGN },
    });
    expect(listOf(renamed, LIST_A)).toMatchObject({
      name: "Cuisine d'été",
      campaignId: CAMPAIGN,
    });
    expect(renamed.phase === "ready" && renamed.lists).toHaveLength(2);
    const deleted = selectionReducer(renamed, {
      type: "deleted",
      listId: LIST_A,
    });
    expect(deleted.phase === "ready" && deleted.lists.map((i) => i.id)).toEqual(
      [LIST_B],
    );
    expect(deleted.phase === "ready" && LIST_A in deleted.members).toBe(false);
    // before the lists are known, a gesture changes nothing
    expect(
      selectionReducer(INITIAL_SELECTION, {
        type: "upserted",
        list: list(LIST_A, "Cuisine", 0),
      }),
    ).toBe(INITIAL_SELECTION);
  });

  it("shows the list the address names when it is the brand's, else the newest, else none; the creators wait until the list is read", () => {
    const state = READY(
      [list(LIST_B, "Beauté", 1), list(LIST_A, "Cuisine", 0)],
      { [LIST_A]: [] },
    );
    expect(activeListIdOf(state, LIST_A)).toBe(LIST_A);
    expect(activeListIdOf(state, null)).toBe(LIST_B);
    // an identifier that is none of the brand's lists is ignored, never trusted
    expect(activeListIdOf(state, ID("9"))).toBe(LIST_B);
    expect(activeListIdOf(READY([]), LIST_A)).toBeNull();
    expect(activeListIdOf(INITIAL_SELECTION, LIST_A)).toBeNull();
    expect(membersOf(state, LIST_A)).toEqual([]);
    expect(membersOf(state, LIST_B)).toBeNull();
    expect(membersOf(state, null)).toBeNull();
    expect(listOf(state, LIST_B)?.name).toBe("Beauté");
    expect(listOf(state, ID("9"))).toBeNull();
  });
});

describe("L3F-T11: one list and its creators (RG51, RG63, RG65)", () => {
  const item = (alias: string, note: string | null): ShortlistItem => ({
    creator: cardOf(alias, 1).creator,
    note,
    addedAt: "2026-11-20T10:00:00.000Z",
  });

  it("reads the list, or the state that closes the door, or the list that does not exist", () => {
    const ready = detailReducer(INITIAL_DETAIL, {
      type: "loaded",
      response: {
        state: "shortlist",
        shortlist: list(LIST_A, "Cuisine", 2),
        items: [item("7K3M", null), item("2QX8", "à rappeler")],
      },
    });
    expect(ready.phase).toBe("ready");
    expect(
      detailReducer(INITIAL_DETAIL, {
        type: "loaded",
        response: { state: "closed" },
      }),
    ).toEqual({ phase: "closed" });
    expect(detailReducer(INITIAL_DETAIL, { type: "gone" })).toEqual({
      phase: "gone",
    });
    expect(detailReducer(INITIAL_DETAIL, { type: "failed" })).toEqual({
      phase: "failed",
    });
  });

  it("notes a creator, takes one out (the count follows), and changes the list's name and campaign", () => {
    let state: DetailState = detailReducer(INITIAL_DETAIL, {
      type: "loaded",
      response: {
        state: "shortlist",
        shortlist: list(LIST_A, "Cuisine", 2),
        items: [item("7K3M", null), item("2QX8", null)],
      },
    });
    state = detailReducer(state, { type: "noted", alias: "7K3M", note: "ok" });
    expect(
      state.phase === "ready" &&
        state.items.map((entry) => [entry.creator.alias, entry.note]),
    ).toEqual([
      ["7K3M", "ok"],
      ["2QX8", null],
    ]);
    state = detailReducer(state, { type: "noted", alias: "7K3M", note: null });
    expect(state.phase === "ready" && state.items[0]?.note).toBeNull();
    state = detailReducer(state, { type: "removed", alias: "7K3M" });
    expect(state.phase === "ready" && state.list.count).toBe(1);
    expect(state.phase === "ready" && state.items).toHaveLength(1);
    // taking out one that is not there changes nothing
    expect(detailReducer(state, { type: "removed", alias: "7K3M" })).toBe(
      state,
    );
    state = detailReducer(state, {
      type: "listChanged",
      list: { ...list(LIST_A, "Cuisine d'été", 1), campaignId: CAMPAIGN },
    });
    expect(state.phase === "ready" && state.list).toMatchObject({
      name: "Cuisine d'été",
      campaignId: CAMPAIGN,
    });
    expect(
      detailReducer(INITIAL_DETAIL, { type: "removed", alias: "7K3M" }),
    ).toBe(INITIAL_DETAIL);
  });
});

describe("L3F-T11: the profile a brand opens (RG15, RG41, RG42, RG48, RG50, CA6, CA49)", () => {
  it("tells the states of the answer and the refusals: closed, not published, gone (one answer for unknown and excluded), bucket full, failed", () => {
    expect(profileScreenOf({ kind: "ok", data: { state: "closed" } })).toEqual({
      kind: "closed",
    });
    expect(
      profileScreenOf({ kind: "ok", data: { state: "brand_not_published" } }),
    ).toEqual({ kind: "brand_not_published" });
    const profile = profileOf(null);
    expect(profileScreenOf({ kind: "ok", data: profile })).toEqual({
      kind: "profile",
      profile,
    });
    expect(profileScreenOf({ kind: "failed", code: "not_found" })).toEqual({
      kind: "gone",
    });
    expect(
      profileScreenOf({
        kind: "failed",
        code: "rate_limited",
        retryAfterSeconds: 3600,
      }),
    ).toEqual({ kind: "rate_limited", retryAfterSeconds: 3600 });
    expect(profileScreenOf({ kind: "failed", code: "rate_limited" })).toEqual({
      kind: "rate_limited",
      retryAfterSeconds: null,
    });
    expect(profileScreenOf({ kind: "failed", code: "boom" })).toEqual({
      kind: "failed",
    });
    expect(profileScreenOf({ kind: "failed" })).toEqual({ kind: "failed" });
  });

  it("draws the card of the search with its three visuals, in the order of the card, and no field of RG48", () => {
    const view = profileViewOf(profileOf(null), FR);
    expect(PROFILE_VISUALS_SHOWN).toBe(3);
    expect(view.card.visuals.map((visual) => visual.position)).toEqual([
      1, 2, 3,
    ]);
    expect(view.card.alias).toBe("7K3M");
    // the rendered fields are the keys of the card of the contract, nothing of the list closed of RG48
    const fields = renderedFieldsOf(view.card);
    for (const forbidden of [
      "handle",
      "profileUrl",
      "followers",
      "engagementRate",
      "completeness",
      "refusedSectors",
      "rate",
      "price",
      "currency",
      "net",
    ]) {
      expect(fields, forbidden).not.toContain(forbidden);
    }
    // a card of the grid keeps one visual: the same function, the number shown is the only difference
    expect(profileViewOf(profileOf(null), EN).card.visuals).toHaveLength(3);
  });

  it("says the region only when the base serves it, as the code it is, and never otherwise (RG15, CA14, CA15)", () => {
    const without = profileViewOf(profileOf(null), FR);
    expect(
      without.card.profile.some((row) => row.field === "residenceRegion"),
    ).toBe(false);
    const withRegion = profileViewOf(profileOf("FR-IDF"), FR);
    const row = withRegion.card.profile.find(
      (found) => found.field === "residenceRegion",
    );
    expect(row).toEqual({
      field: "residenceRegion",
      label: frCreatorSearch.profile.region,
      value: "FR-IDF",
    });
    // the country stays, the city never exists
    expect(
      withRegion.card.profile.some(
        (found) => found.field === "residenceCountry",
      ),
    ).toBe(true);
    expect(
      withRegion.card.profile.some((found) => /ville|city/i.test(found.label)),
    ).toBe(false);
  });

  it("writes « Proposé car » and the note of vigilance in words, as the card of the grid does", () => {
    const view = profileViewOf(profileOf(null), FR);
    expect(view.reasons).toHaveLength(2);
    expect(view.reasons[0]).toBe("Thématique principale : topic:food");
    expect(view.vigilance).toBe(frCreatorSearch.vigilance.recent_profile);
    expect(profileViewOf(profileOf(null), EN).vigilance).toBe(
      enCreatorSearch.vigilance.recent_profile,
    );
  });
});

describe("L3F-T11: the addresses of the pages and the `list` of M4 (RG65, RG51)", () => {
  const QUERY: SearchQuery = {
    filters: { F1: "beauty", F3: ["instagram"] },
    sort: "audience",
    campaignId: CAMPAIGN,
  };
  const PLACE: SearchPlace = { query: QUERY, page: 2, listId: LIST_A };

  it("carries the active list in the address after the campaign, never in the key of a search", () => {
    const written = addressParamsOf(QUERY, 2, LIST_A);
    expect(written).toBe(
      `?F1=beauty&F3=instagram&sort=audience&campaign=${CAMPAIGN}&list=${LIST_A}&page=2`,
    );
    const params = new URLSearchParams(written);
    expect(addressOf((name) => params.get(name) ?? undefined)).toEqual({
      query: QUERY,
      page: 2,
      listId: LIST_A,
    });
    // a list is not a criterion: the same search, whatever the list
    expect(queryKeyOf(QUERY)).toBe(addressParamsOf(QUERY));
    expect(addressParamsOf(EMPTY_QUERY, 1, LIST_A)).toBe(`?list=${LIST_A}`);
    expect(addressParamsOf(EMPTY_QUERY)).toBe("");
  });

  it("ignores a list that is no identifier, and has none when the address names none", () => {
    expect(addressOf(() => undefined).listId).toBeUndefined();
    expect(
      addressOf((name) => (name === "list" ? "not-a-uuid" : undefined)).listId,
    ).toBeUndefined();
    expect(
      addressOf((name) => (name === "list" ? "1; drop" : undefined)).listId,
    ).toBeUndefined();
  });

  it("writes the paths of the profile (alias), the way back, the request and a list, in both languages", () => {
    expect(profileHref("7K3M", "fr", PLACE)).toBe(
      `/createurs/profil/7K3M?F1=beauty&F3=instagram&sort=audience&campaign=${CAMPAIGN}&list=${LIST_A}&page=2`,
    );
    expect(profileHref("7K3M", "en", { ...PLACE, listId: null, page: 1 })).toBe(
      `/creators/profile/7K3M?F1=beauty&F3=instagram&sort=audience&campaign=${CAMPAIGN}`,
    );
    expect(searchHref("en", PLACE)).toBe(
      `/creators?F1=beauty&F3=instagram&sort=audience&campaign=${CAMPAIGN}&list=${LIST_A}&page=2`,
    );
    // the request takes the criteria and the campaign back, from the first page
    expect(requestHref("fr", PLACE)).toBe(
      `/createurs/demande-de-selection?F1=beauty&F3=instagram&sort=audience&campaign=${CAMPAIGN}&list=${LIST_A}`,
    );
    expect(
      requestHref("fr", { query: EMPTY_QUERY, page: 1, listId: null }),
    ).toBe("/createurs/demande-de-selection");
    expect(shortlistHref("fr", LIST_A)).toBe(`/createurs/selections/${LIST_A}`);
    expect(shortlistHref("en", LIST_A)).toBe(`/creators/selections/${LIST_A}`);
  });
});

describe("L3F-T11: the words of the profile, the lists and the request (D45, D46, D48, D78, RG55)", () => {
  const GROUPS = [
    "shortlist",
    "panel",
    "profile",
    "lists",
    "list",
    "selectionRequest",
  ] as const;

  function texts(node: unknown, path = ""): [string, string][] {
    if (typeof node === "string") {
      return [[path, node]];
    }
    return Object.entries(node as Record<string, unknown>).flatMap(
      ([key, value]) => texts(value, path === "" ? key : `${path}.${key}`),
    );
  }

  it("has the same keys in both languages, every text non-empty", () => {
    for (const group of GROUPS) {
      const fr = texts(frCreatorSearch[group], group);
      const en = texts(enCreatorSearch[group], group);
      expect(
        fr.map(([key]) => key),
        group,
      ).toEqual(en.map(([key]) => key));
      for (const [key, text] of [...fr, ...en]) {
        expect(text.trim(), key).not.toBe("");
      }
    }
  });

  it("names no amount, tariff, currency nor commission and promises no contact or result", () => {
    const forbidden =
      /€|\$|\b(?:EUR|USD)\b|commission|tarif|\bprix\b|\bprice\b|budget|rate card|garantie?\b|vous contactera|will contact|guaranteed/i;
    for (const group of GROUPS) {
      for (const text of [frCreatorSearch[group], enCreatorSearch[group]]) {
        for (const [key, value] of texts(text, group)) {
          // « pas un nombre de profils garanti » and « no creator is told » deny a promise: the denial is the only mention
          if (key === "selectionRequest.sent.note") {
            expect(value).toMatch(/pas un nombre|not a guaranteed/);
            continue;
          }
          expect(value, key).not.toMatch(forbidden);
        }
      }
    }
  });

  it("asks for no e-mail nor telephone in the free message, and says to give none", () => {
    expect(frCreatorSearch.selectionRequest.messageHelp).toMatch(
      /ni e-mail ni téléphone/,
    );
    expect(enCreatorSearch.selectionRequest.messageHelp).toMatch(
      /no e-mail or phone/,
    );
    for (const text of [
      frCreatorSearch.selectionRequest.message,
      enCreatorSearch.selectionRequest.message,
    ]) {
      expect(text).not.toMatch(/mail|téléphone|phone|contact/i);
    }
  });
});
